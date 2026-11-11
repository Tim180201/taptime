import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { Pool } from 'pg';
import { expect, it } from 'vitest';
import { build } from 'esbuild';
import YAML from 'yaml';
import { applyMigrationSet, loadMigrations, migrate } from '@taptime/backend-schema';
import type { AccessTokenVerifier } from '@taptime/backend-identity';
import type { OfflineCaptureLeasePage, OfflineLifecycleEventCommand } from '@taptime/offline-sync-contract';
import { OfflineCaptureLeaseCoordinator, OfflineLifecycleIngestionCoordinator } from '../src/index.js';

const execute = promisify(execFile);
const image = 'postgres:17.10-bookworm';
const verifier: AccessTokenVerifier = {
  async verify() { return { status: 'verified', identity: { issuer: 'restore-test', subject: 'employee' } }; },
};
const ids = Object.fromEntries(['user', 'binding', 'organization', 'membership', 'customer',
  'tag', 'assignment'].map((name) => [name, randomUUID()])) as Record<string, string>;
const installationBinding = Buffer.alloc(32, 1).toString('base64url');
const lookupKey = Buffer.alloc(32, 2).toString('base64url');

// This uses physical base backup + real archived WAL. No table snapshot, dump or mocked recovery.
it('proves latest/historical recovery and exposes a lost unarchived lease on replay', async () => {
  const prefix = `taptime-t052-${randomUUID()}`;
  const source = `${prefix}-source`;
  const containers: string[] = [];
  const volumes: string[] = [];
  const pools: Pool[] = [];
  const directories: string[] = [];
  const migrationVersion = randomUUID().replaceAll('-', '').slice(0, 7);
  const migrationImage = `ghcr.io/tim180201/taptime-backend-api:${migrationVersion}`;
  const network = `${prefix}-migration`;
  const migrations = await loadMigrations();
  const recoveryMigration = migrations.find(item => item.name === 'restore_recovery_operations')!;
  const beforeRecovery = migrations.filter(item => item.version < recoveryMigration.version);
  let migrationCompose: string;
  async function docker(...args: string[]) {
    return (await execute('docker', args, { maxBuffer: 16 * 1024 * 1024 })).stdout.trim();
  }
  async function volume(suffix: string) {
    const name = `${prefix}-${suffix}`;
    await docker('volume', 'create', name);
    volumes.push(name);
    return name;
  }
  async function connect(container: string) {
    const address = await docker('port', container, '5432/tcp').catch(async error => {
      const logs = await execute('docker', ['logs', container]).catch(() => null);
      console.error(logs ? logs.stdout + logs.stderr : 'Container log unavailable');
      throw error;
    });
    const port = address.split(':').at(-1)!;
    const pool = new Pool({ connectionString: `postgresql://postgres@127.0.0.1:${port}/postgres`, max: 2 });
    pools.push(pool);
    await expect.poll(async () => {
      try { return (await pool.query('SELECT NOT pg_is_in_recovery() AS ready')).rows[0]?.ready; }
      catch { return false; }
    }, { timeout: 60_000, interval: 200 }).toBe(true);
    return pool;
  }
  // Exercise the production SQL and shell functions, not a recreation of their SQL.
  const verifyScript = fileURLToPath(new URL('../../../infrastructure/backup/taptime-restore-verify', import.meta.url));
  const activateScript = fileURLToPath(new URL('../../../infrastructure/backup/taptime-restore-activate', import.meta.url));
  async function activate(pool: Pool, container: string, target: string) {
    const measured = (await pool.query(`SELECT pg_last_wal_replay_lsn()::text AS lsn,
      pg_last_xact_replay_timestamp() AS replayed_at, timeline_id FROM pg_control_checkpoint()`)).rows[0];
    const captured = (await execute('bash', ['-c', 'source "$1"; DATABASE_NAME=postgres; capture_recovery_evidence "$2"',
      'recovery-test', verifyScript, container])).stdout.trim();
    const evidence = Object.fromEntries(captured.split('\n').map(line => line.split('=')));
    expect(evidence.replay_lsn).toBe(measured.lsn);
    expect(Number(evidence.timeline)).toBe(measured.timeline_id);
    expect(evidence.replayed_at === 'none' ? null : new Date(evidence.replayed_at!).toISOString())
      .toBe(measured.replayed_at?.toISOString() ?? null);
    const clusterId = (await pool.query("SELECT lpad(to_hex(system_identifier),16,'0') AS id FROM pg_control_system()")).rows[0].id;
    const decimalCluster = (await pool.query('SELECT system_identifier::text AS id FROM pg_control_system()')).rows[0].id;
    const targetLabel = target;
    const baseArchive = `base-${clusterId}-20260917T000000Z`;
    const directory = await mkdtemp(join(process.cwd(), '.t055a-restore-'));
    directories.push(directory);
    const archivedMigrations = target === 'latest' ? migrations : beforeRecovery;
    const manifest = join(directory, 'source-migration-checksums.tsv');
    await writeFile(manifest, archivedMigrations.map(item => `${item.checksum}  ./${item.version}_${item.name}.sql\n`).join(''));
    await execute('bash', ['-c', `source "$1"
      check_restored_migrations "$2" postgres "$3"
      check_restored_rls "$2" postgres`, 'restore-check-test', verifyScript, container, manifest]);
    await rm(manifest);
    await pool.end(); pools.splice(pools.indexOf(pool), 1);
    await docker('stop', container);
    await docker('cp', `${container}:/var/lib/postgresql/data/.`, directory);
    const stamp = new Date(Date.now() + volumes.length * 1_000).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const materialized = `taptime-postgres-restored-${stamp}`;
    volumes.push(materialized);
    await execute('bash', ['-c', `source "$1"
      RESTORE_SYSTEM_IDENTIFIER="$5"; RESTORE_ARCHIVE_IDENTIFIER="$6"
      materialize_verified_restore "$2" "$3" "$4" "$7"`,
    'materialization-test', verifyScript, directory, materialized, baseArchive, decimalCluster, clusterId, captured],
    { env: { ...process.env, RESTORE_IMAGE: image, TAPTIME_RESTORE_TARGET_TIME: targetLabel === 'latest' ? '' : targetLabel } });
    await docker('rm', container);
    await docker('run', '-d', '--name', container, '-p', '127.0.0.1::5432',
      '-v', `${materialized}:/var/lib/postgresql/data`, image);
    pool = await connect(container);
    const marker = await docker('exec', container, 'cat', '/var/lib/postgresql/data/.taptime-restore-complete');
    expect(marker).toBe(`format=2\ncluster=${clusterId}\narchive=${baseArchive}\ntarget=${targetLabel}\n${captured}`);
    expect(await docker('volume', 'inspect', '--format', '{{index .Labels "com.taptime.restore.target"}}', materialized)).toBe(targetLabel);
    const ledger = async () => (await pool.query('SELECT * FROM public.taptime_server_schema_migrations ORDER BY version')).rows;
    const priorLedger = await ledger();
    expect(priorLedger.map(row => row.version)).toEqual(
      archivedMigrations.map(item => item.version));
    await docker('network', 'connect', '--alias', 'database', network, container);
    const runMigration = async () => (await execute('bash', ['-c',
      'source "$1"; migrate_candidate_database "$2" "$3"',
      'migration-test', activateScript, migrationVersion, materialized],
    { env: { ...process.env, TAPTIME_RESTORE_COMPOSE_FILE: migrationCompose } })).stdout;
    const migrationOutput = await runMigration();
    expect(migrationOutput).toContain(target === 'latest' ? 'applied=none' : `applied=${recoveryMigration.version}`);
    const migratedLedger = await ledger();
    expect(migratedLedger.map(row => row.version)).toEqual(migrations.map(item => item.version));
    expect(migratedLedger.filter(row => priorLedger.some(prior => prior.version === row.version))).toEqual(priorLedger);
    const record = async () => (await execute('bash', ['-c', `source "$1"
      DATABASE_NAME=postgres
      compose_with_volume() { shift 2; shift; command docker exec --user postgres "$TEST_CANDIDATE" "\${@:5}"; }
      record_recovery_operation test test "$2" "$3" "$4" "$5" "$6" "$7"`,
    'activation-test', activateScript, clusterId, targetLabel, evidence.operation!, evidence.timeline!, evidence.replay_lsn!, evidence.replayed_at!],
    { env: { ...process.env, TEST_CANDIDATE: container } })).stdout.trim();
    expect(await record()).toBe(evidence.operation);
    const originalOperation = (await pool.query('SELECT * FROM taptime_server.restore_recovery_operations WHERE id=$1', [evidence.operation])).rows[0];
    expect(await record()).toBe(evidence.operation);
    expect((await pool.query('SELECT * FROM taptime_server.restore_recovery_operations WHERE id=$1', [evidence.operation])).rows).toEqual([originalOperation]);
    expect(originalOperation).toMatchObject({ cluster_identifier: clusterId, timeline_id: String(measured.timeline_id),
      replay_lsn: measured.lsn, replayed_transaction_at: measured.replayed_at,
      time_basis: measured.replayed_at === null ? 'no_replayed_transaction' : 'last_replayed_transaction',
      target_kind: target === 'latest' ? 'latest' : 'point_in_time', target_time: targetLabel === 'latest' ? null : new Date(targetLabel) });
    if (measured.replayed_at !== null) expect(originalOperation.activated_at.getTime()).toBeGreaterThan(measured.replayed_at.getTime());
    // The later deploy uses this same Compose service/CLI: it has nothing left to apply.
    expect(await runMigration()).toContain('applied=none');
    expect(await ledger()).toEqual(migratedLedger);
    // A rolled-back pre-069 app's migrator also preserves the additive schema/history.
    expect((await applyMigrationSet(pool, beforeRecovery)).applied).toEqual([]);
    expect(await ledger()).toEqual(migratedLedger);
    expect((await pool.query('SELECT * FROM taptime_server.restore_recovery_operations WHERE id=$1', [evidence.operation])).rows)
      .toEqual([originalOperation]);
    await docker('network', 'disconnect', network, container);
    return { pool, operation: originalOperation };
  }
  const ingest = (pool: Pool, command: OfflineLifecycleEventCommand) =>
    new OfflineLifecycleIngestionCoordinator(pool, verifier).ingest({ accessToken: 'valid', command });
  async function lease(pool: Pool) {
    const result = await new OfflineCaptureLeaseCoordinator(pool, verifier).issue({
      accessToken: 'valid', command: { commandId: randomUUID(), installationBinding, lookupKey },
    });
    if (result.status !== 'ready') throw new Error(`Lease: ${result.status}`);
    return result.page;
  }
  try {
    // Package the production migrator exactly as the backend Dockerfile does,
    // using installed dependencies and a local Node base; no npm install or pull.
    const migrationDirectory = await mkdtemp(join(process.cwd(), '.t055a-migrator-'));
    directories.push(migrationDirectory);
    await build({
      entryPoints: [fileURLToPath(new URL('../../backend-schema/src/cli.ts', import.meta.url))],
      bundle: true, platform: 'node', target: 'node24', format: 'esm', external: ['pg-native'],
      banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
      outfile: join(migrationDirectory, 'schema/migrate.js'),
    });
    await cp(fileURLToPath(new URL('../../backend-schema/migrations/', import.meta.url)), join(migrationDirectory, 'migrations'), { recursive: true });
    await writeFile(join(migrationDirectory, 'Dockerfile'), `FROM node:24.17.0-bookworm-slim
WORKDIR /app
COPY schema/ ./schema/
COPY migrations/ ./migrations/
USER node
`);
    await docker('build', '--network', 'none', '--pull=false', '--tag', migrationImage, migrationDirectory);
    await docker('network', 'create', '--internal', network);
    const compose = YAML.parse(await readFile(fileURLToPath(new URL('../../../infrastructure/docker-compose.server.yml', import.meta.url)), 'utf8'));
    const service = compose.services.migration;
    // Keep the actual service image, command, profile, secret and security options.
    // Only connect it to this disposable candidate instead of production's database.
    delete service.depends_on;
    service.environment.B3_DATABASE_URL = 'postgresql://postgres@database:5432/postgres';
    const secret = join(migrationDirectory, 'synthetic-password');
    await writeFile(secret, 'restore-test');
    migrationCompose = join(migrationDirectory, 'compose.yml');
    await writeFile(migrationCompose, YAML.stringify({ name: prefix, services: { migration: service },
      networks: { 'taptime-internal': { external: true, name: network } },
      secrets: { postgres_installer_password: { file: secret } } }));
    const data = await volume('data');
    const base = await volume('base');
    const currentBase = await volume('base-current');
    const wal = await volume('wal');
    await docker('run', '--rm', '--network', 'none', '-v', `${base}:/base`, '-v', `${currentBase}:/base-current`, '-v', `${wal}:/archive`,
      image, 'chown', '-R', 'postgres:postgres', '/base', '/base-current', '/archive');
    containers.push(source);
    await docker('run', '-d', '--name', source, '-p', '127.0.0.1::5432',
      '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', '-v', `${data}:/var/lib/postgresql/data`,
      '-v', `${base}:/base`, '-v', `${currentBase}:/base-current`, '-v', `${wal}:/archive`, image, 'postgres',
      '-c', 'wal_level=replica', '-c', 'archive_mode=on',
      '-c', 'archive_command=test ! -f /archive/%f && cp %p /archive/%f');
    const original = await connect(source);
    // The base and historical target precede recovery metadata; latest WAL includes it.
    await applyMigrationSet(original, beforeRecovery);
    await original.query(`
      INSERT INTO taptime_server.users (id) VALUES ('${ids.user}');
      INSERT INTO taptime_server.identity_bindings (id,user_id,issuer,subject)
        VALUES ('${ids.binding}','${ids.user}','restore-test','employee');
      INSERT INTO taptime_server.organizations (id,name) VALUES ('${ids.organization}','Restore fixture');
      INSERT INTO taptime_server.memberships (id,organization_id,user_id,role,created_by_user_id)
        VALUES ('${ids.membership}','${ids.organization}','${ids.user}','employee','${ids.user}');
      INSERT INTO taptime_server.customers (id,organization_id,display_name,active,activated_at)
        VALUES ('${ids.customer}','${ids.organization}','Restore customer',true,now());
      INSERT INTO taptime_server.nfc_tags (id,organization_id,display_name,payload_value)
        VALUES ('${ids.tag}','${ids.organization}','Restore tag','nfc:uid:v1:04AABBCC');
      INSERT INTO taptime_server.nfc_assignments
        (id,organization_id,nfc_tag_id,target_type,target_customer_id,active,valid_from)
        VALUES ('${ids.assignment}','${ids.organization}','${ids.tag}','customer','${ids.customer}',true,now());
    `);
    const archivedLease = await lease(original);
    await docker('exec', '-u', 'postgres', source, 'pg_basebackup', '-D', '/base', '-Fp', '-Xs', '-c', 'fast');
    await docker('exec', '-u', 'postgres', source, 'pg_verifybackup', '/base');
    const historicalTarget = (await original.query(`SELECT to_char(clock_timestamp() AT TIME ZONE 'UTC',
      'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS target`)).rows[0].target;
    const first = command(archivedLease, 1, 1_000);
    const phone = [first];
    const firstDecision = await ingest(original, first);
    expect(firstDecision).toMatchObject({ status: 'synchronized', archiveStatus: 'archive_pending',
      decision: { status: 'time_entry_started' } });
    expect((await migrate(original)).applied).toContain(recoveryMigration.version);
    // Deploy establishes a new verified base for the migrated source set.
    // Preserve the old base for the pre-069 historical target.
    await docker('exec', '-u', 'postgres', source, 'pg_basebackup', '-D', '/base-current', '-Fp', '-Xs', '-c', 'fast');
    await docker('exec', '-u', 'postgres', source, 'pg_verifybackup', '/base-current');
    const requiredWal = (await original.query(`SELECT required_wal_file FROM
      taptime_server.offline_event_archive_requirements WHERE work_event_id=$1`, [first.workEvent.id])).rows[0].required_wal_file;
    await original.query('SELECT pg_switch_wal()');
    await expect.poll(async () => {
      try { await docker('exec', source, 'test', '-f', `/archive/${requiredWal}`); return true; }
      catch { return false; }
    }, { timeout: 60_000, interval: 200 }).toBe(true);
    const label = await docker('exec', source, 'cat', '/base/backup_label');
    const start = /START WAL LOCATION: (\S+) \(file (\w+)\)/.exec(label)!;
    const cluster = (await original.query(`SELECT lpad(to_hex(system_identifier),16,'0') AS id
      FROM pg_control_system()`)).rows[0].id;
    const baseName = `base-${cluster}-20260917T000000Z`;
    // Register only files that the real archiver copied, with their read-back content digest.
    const walFiles = (await docker('exec', source, 'ls', '/archive')).split('\n')
      .filter((name) => /^[0-9A-F]{24}$/.test(name) && name >= start[2]!).sort();
    const archiver = await original.connect();
    try {
      await archiver.query('BEGIN');
      await archiver.query('SET LOCAL ROLE taptime_wal_archiver');
      await archiver.query('SELECT taptime_server.record_offsite_base_backup_v1($1,$2::pg_lsn,$3)',
        [baseName, start[1], start[2]]);
      for (const file of walFiles) {
        const digest = (await docker('exec', source, 'sha256sum', `/archive/${file}`)).split(' ')[0];
        await archiver.query('SELECT taptime_server.record_offsite_wal_archive_v1($1,$2,$3)',
          [file, `wal-${cluster}-${file}`, digest]);
        await archiver.query('SELECT taptime_server.advance_offsite_wal_archive_watermark_v1($1,$2)',
          [baseName, file]);
      }
      await archiver.query('COMMIT');
    } catch (error) {
      await archiver.query('ROLLBACK');
      throw error;
    } finally { archiver.release(); }
    expect(await ingest(original, first)).toMatchObject({ archiveStatus: 'offsite_archived' });
    phone.shift(); // The same archive condition that authorizes SQLite acknowledgement.
    // Freeze the external archive before creating the unarchived tail.
    await original.query("ALTER SYSTEM SET archive_command = 'false'");
    await original.query('SELECT pg_reload_conf()');
    const second = command(archivedLease, 2, 60_000);
    phone.push(second);
    const secondDecision = await ingest(original, second);
    expect(secondDecision).toMatchObject({ status: 'synchronized', archiveStatus: 'archive_pending',
      decision: { status: 'time_entry_stopped' } });
    const lostLease = await lease(original);
    const third = command(lostLease, 3, 120_000);
    phone.push(third);
    expect(await ingest(original, third)).toMatchObject({ status: 'synchronized', archiveStatus: 'archive_pending',
      decision: { status: 'time_entry_started' } });
    let dump = '';
    try { dump = await docker('exec', source, 'pg_waldump', '-p', '/archive', walFiles.at(-1)!); }
    catch (error) { dump = (error as { stdout: string }).stdout; }
    const latestLsn = [...dump.matchAll(/lsn: ([0-9A-F]+\/[0-9A-F]+)/g)].at(-1)?.[1];
    expect(latestLsn).toBeDefined();
    await original.end(); pools.splice(pools.indexOf(original), 1);
    await docker('kill', '--signal', 'KILL', source);
    await docker('rm', source);
    // Source disk is destroyed. Restore candidates can only read the base and frozen WAL.
    await docker('volume', 'rm', data); volumes.splice(volumes.indexOf(data), 1);
    async function restore(suffix: string, target: string) {
      const restoredData = await volume(suffix);
      await docker('run', '--rm', '--network', 'none', '-v', `${suffix === 'latest' ? currentBase : base}:/base:ro`,
        '-v', `${restoredData}:/restore`, image, 'sh', '-c',
        `cp -a /base/. /restore/ && printf "%s\\n" "restore_command = 'cp /archive/%f %p'" "${target}" "recovery_target_action = 'promote'" >> /restore/postgresql.auto.conf && touch /restore/recovery.signal && chown -R postgres:postgres /restore`);
      const name = `${prefix}-${suffix}`;
      containers.push(name);
      await docker('run', '-d', '--name', name, '-p', '127.0.0.1::5432',
        '-v', `${restoredData}:/var/lib/postgresql/data`, '-v', `${wal}:/archive:ro`, image);
      return connect(name);
    }
    let latest = await restore('latest', `recovery_target_lsn = '${latestLsn}'`);
    expect((await latest.query('SELECT id FROM taptime_server.work_events ORDER BY occurred_at')).rows)
      .toEqual([{ id: first.workEvent.id }]);
    expect((await latest.query('SELECT id FROM taptime_server.offline_capture_leases WHERE id=$1', [lostLease.leaseId])).rows)
      .toEqual([]);
    const activatedLatest = await activate(latest, `${prefix}-latest`, 'latest');
    latest = activatedLatest.pool;
    const replayedSecond = await ingest(latest, phone[0]!);
    expect(replayedSecond).toMatchObject({ status: 'synchronized',
      decision: secondDecision.status === 'synchronized' ? secondDecision.decision : undefined });
    const replayedThird = await ingest(latest, phone[1]!);
    // Finding, not a claim of correctness: retained event alone cannot reconstruct its lost lease.
    expect(replayedThird).toEqual({ status: 'conflict', reason: 'lease_binding_conflict' });
    console.info('LATEST: deleted event present; retained event with archived lease replays same stop; retained event with lost lease changes start -> lease_binding_conflict.');
    let historical = await restore('historical', `recovery_target_time = '${historicalTarget.replace('T', ' ').replace(/Z$/, '+00')}'`);
    const activatedHistorical = await activate(historical, `${prefix}-historical`, historicalTarget);
    historical = activatedHistorical.pool;
    expect(activatedHistorical.operation.id).not.toBe(activatedLatest.operation.id);
    expect((await historical.query('SELECT id FROM taptime_server.work_events')).rows).toEqual([]);
    expect(await ingest(historical, phone[0]!)).toMatchObject({ status: 'pending', reason: 'sequence_gap' });
    console.info('HISTORICAL: deleted event absent; retained successor cannot fill missing sequence.');
  } finally {
    await Promise.allSettled(pools.map((pool) => pool.end()));
    for (const name of containers) await docker('rm', '-f', name).catch(() => undefined);
    for (const name of volumes) await docker('volume', 'rm', name).catch(() => undefined);
    await docker('network', 'rm', network).catch(() => undefined);
    await docker('image', 'rm', migrationImage).catch(() => undefined);
    for (const directory of directories) await rm(directory, { recursive: true, force: true });
  }
}, 180_000);

function command(lease: OfflineCaptureLeasePage, deviceSequence: number, delta: number): OfflineLifecycleEventCommand {
  return {
    organizationId: ids.organization!, expectedMembershipId: ids.membership!,
    leaseId: lease.leaseId, leaseItemId: lease.items[0]!.itemId, installationBinding,
    deviceSequence, provenanceVersion: 1,
    clock: { bootMarker: 'restore-boot', monotonicAnchorMilliseconds: 10_000,
      monotonicDeltaMilliseconds: delta, wallClockAnchor: lease.issuedAt,
      clockProofStatus: 'verified_same_boot', clockProofVersion: 1 },
    workEvent: { id: randomUUID(), assignmentId: ids.assignment!, nfcTagId: ids.tag!,
      target: { targetType: 'customer', targetId: ids.customer! },
      occurredAt: new Date(Date.parse(lease.issuedAt) + delta).toISOString() },
    receipt: { id: randomUUID(), attemptNumber: 1 },
  };
}
