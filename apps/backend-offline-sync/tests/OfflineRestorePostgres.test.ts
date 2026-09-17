import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { promisify } from 'node:util';
import { Pool } from 'pg';
import { expect, it } from 'vitest';
import { migrate } from '@taptime/backend-schema';
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
    const address = await docker('port', container, '5432/tcp');
    const port = address.split(':').at(-1)!;
    const pool = new Pool({ connectionString: `postgresql://postgres@127.0.0.1:${port}/postgres`, max: 2 });
    pools.push(pool);
    await expect.poll(async () => {
      try { return (await pool.query('SELECT NOT pg_is_in_recovery() AS ready')).rows[0]?.ready; }
      catch { return false; }
    }, { timeout: 60_000, interval: 200 }).toBe(true);
    return pool;
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
    const data = await volume('data');
    const base = await volume('base');
    const wal = await volume('wal');
    await docker('run', '--rm', '--network', 'none', '-v', `${base}:/base`, '-v', `${wal}:/archive`,
      image, 'chown', '-R', 'postgres:postgres', '/base', '/archive');
    containers.push(source);
    await docker('run', '-d', '--name', source, '-p', '127.0.0.1::5432',
      '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', '-v', `${data}:/var/lib/postgresql/data`,
      '-v', `${base}:/base`, '-v', `${wal}:/archive`, image, 'postgres',
      '-c', 'wal_level=replica', '-c', 'archive_mode=on',
      '-c', 'archive_command=test ! -f /archive/%f && cp %p /archive/%f');
    const original = await connect(source);
    await migrate(original);
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
    const historicalTarget = (await original.query('SELECT clock_timestamp()::text AS target')).rows[0].target;
    const first = command(archivedLease, 1, 1_000);
    const phone = [first];
    const firstDecision = await ingest(original, first);
    expect(firstDecision).toMatchObject({ status: 'synchronized', archiveStatus: 'archive_pending',
      decision: { status: 'time_entry_started' } });
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
      await docker('run', '--rm', '--network', 'none', '-v', `${base}:/base:ro`,
        '-v', `${restoredData}:/restore`, image, 'sh', '-c',
        `cp -a /base/. /restore/ && printf "%s\\n" "restore_command = 'cp /archive/%f %p'" "${target}" "recovery_target_action = 'promote'" >> /restore/postgresql.auto.conf && touch /restore/recovery.signal && chown -R postgres:postgres /restore`);
      const name = `${prefix}-${suffix}`;
      containers.push(name);
      await docker('run', '-d', '--name', name, '-p', '127.0.0.1::5432',
        '-v', `${restoredData}:/var/lib/postgresql/data`, '-v', `${wal}:/archive:ro`, image);
      return connect(name);
    }
    const latest = await restore('latest', `recovery_target_lsn = '${latestLsn}'`);
    expect((await latest.query('SELECT id FROM taptime_server.work_events ORDER BY occurred_at')).rows)
      .toEqual([{ id: first.workEvent.id }]);
    expect((await latest.query('SELECT id FROM taptime_server.offline_capture_leases WHERE id=$1', [lostLease.leaseId])).rows)
      .toEqual([]);
    const replayedSecond = await ingest(latest, phone[0]!);
    expect(replayedSecond).toMatchObject({ status: 'synchronized',
      decision: secondDecision.status === 'synchronized' ? secondDecision.decision : undefined });
    const replayedThird = await ingest(latest, phone[1]!);
    // Finding, not a claim of correctness: retained event alone cannot reconstruct its lost lease.
    expect(replayedThird).toEqual({ status: 'conflict', reason: 'lease_binding_conflict' });
    console.info('LATEST: deleted event present; retained event with archived lease replays same stop; retained event with lost lease changes start -> lease_binding_conflict.');
    const historical = await restore('historical', `recovery_target_time = '${historicalTarget}'`);
    expect((await historical.query('SELECT id FROM taptime_server.work_events')).rows).toEqual([]);
    expect(await ingest(historical, phone[0]!)).toMatchObject({ status: 'pending', reason: 'sequence_gap' });
    console.info('HISTORICAL: deleted event absent; retained successor cannot fill missing sequence.');
  } finally {
    await Promise.allSettled(pools.map((pool) => pool.end()));
    for (const name of containers) await docker('rm', '-f', name).catch(() => undefined);
    for (const name of volumes) await docker('volume', 'rm', name).catch(() => undefined);
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
