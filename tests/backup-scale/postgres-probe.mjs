import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { localDocker, requireLocalImage } from './local-docker.mjs';

if (process.env.TAPTIME_BACKUP_SCALE !== 'synthetic-local-only') {
  throw new Error('Set TAPTIME_BACKUP_SCALE=synthetic-local-only.');
}
const docker = localDocker();
const image = process.env.TAPTIME_BACKUP_SCALE_POSTGRES_IMAGE || 'postgres:17.10-bookworm';
const imageDetails = requireLocalImage(docker, image);
const name = `t136-pg-probe-${randomUUID()}`;
/** @type {{kind: string, image: string, imageDetails: object, startedAt: string,
 * container: string, observations: object[], cleanup: boolean, settings?: Record<string,string>,
 * finishedAt?: string, error?: string, cleanupError?: string}} */
const result = { kind: 'synthetic-postgres-segment-probe', image, imageDetails,
  startedAt: new Date().toISOString(), container: name, observations: [], cleanup: false };
let created = false;
let interrupted = false;
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { interrupted = true; });
/** @param {string} command */
const sql = command => docker(['exec', '--user', 'postgres', name, 'psql', '-X', '-qAt',
  '--set', 'ON_ERROR_STOP=on', '--dbname=postgres', '--command', command]).trim();
const snapshot = () => JSON.parse(sql(`SELECT json_build_object(
  'lsn', pg_current_wal_insert_lsn()::text,
  'segment', pg_walfile_name(pg_current_wal_insert_lsn()),
  'walBytes', (SELECT wal_bytes::text FROM pg_stat_wal))`));
/** @param {string} value */
const lsn = value => {
  const [upper, lower] = value.split('/');
  return BigInt(`0x${upper}`) * 0x100000000n + BigInt(`0x${lower}`);
};

try {
  process.stderr.write(`T-136 local probe container: ${name}\n`);
  created = true;
  docker(['run', '--detach', '--rm', '--pull=never', '--network=none', '--name', name,
    '--env', 'POSTGRES_HOST_AUTH_METHOD=trust', image, 'postgres', '-c', "listen_addresses=",
    '-c', 'wal_level=replica']);
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    if (interrupted) throw new Error('Interrupted.');
    try {
      // The entrypoint's temporary bootstrap server also accepts socket queries.
      // Wait until PID 1 is the final postgres process before collecting evidence.
      ready = docker(['exec', name, 'cat', '/proc/1/comm']).trim() === 'postgres' && sql('SELECT 1') === '1';
    } catch { /* isolated cluster is starting */ }
    if (ready) break;
    await delay(500);
  }
  if (!ready) throw new Error('Local PostgreSQL did not become ready.');
  /** @type {Record<string,string>} */
  const settings = JSON.parse(sql(`SELECT json_object_agg(name, setting) FROM pg_settings
    WHERE name IN ('server_version_num','wal_segment_size','archive_mode','archive_timeout',
      'checkpoint_timeout','max_wal_size','full_page_writes','wal_compression')`));
  result.settings = settings;
  if (!settings.server_version_num.startsWith('17')) throw new Error('PostgreSQL 17 is required.');
  const segmentBytes = BigInt(settings.wal_segment_size);
  sql('CREATE TABLE synthetic_probe(id integer PRIMARY KEY, value text); INSERT INTO synthetic_probe VALUES (1, repeat(\'synthetic\', 100));');
  /** @param {string} label @param {() => unknown} action */
  const measure = (label, action) => {
    if (interrupted) throw new Error('Interrupted.');
    const before = snapshot();
    const started = performance.now();
    action();
    const seconds = (performance.now() - started) / 1000;
    const after = snapshot();
    result.observations.push({ label, before, after, seconds,
      lsnAdvanceBytes: String(lsn(after.lsn) - lsn(before.lsn)),
      segmentIndexAdvance: Number(lsn(after.lsn) / segmentBytes - lsn(before.lsn) / segmentBytes) });
  };
  measure('checkpoint-with-dirty-page', () => sql('CHECKPOINT'));
  measure('switch-after-checkpoint', () => sql('SELECT pg_switch_wal()'));
  measure('switch-without-new-WAL', () => sql('SELECT pg_switch_wal()'));
  for (let cycle = 1; cycle <= 2; cycle++) {
    measure(`base-${cycle}-pg_basebackup-fetch-fast`, () => docker(['exec', '--user', 'postgres', name,
      'sh', '-ec', 'pg_basebackup --dbname=dbname=postgres --format=tar --pgdata=- --wal-method=fetch --checkpoint=fast --manifest-checksums=SHA256 > /tmp/t136-base.tar'],
    { timeout: 120_000 }));
    measure(`base-${cycle}-explicit-post-backup-switch`, () => sql('SELECT pg_switch_wal()'));
  }
  measure('checkpoint-without-application-write', () => sql('CHECKPOINT'));
  // Production has receipt/checkpoint WAL before the next hourly backup, and
  // writers may run while Borg stores/checks the base. Keep those cases separate.
  sql("UPDATE synthetic_probe SET value = value || 'before-base'");
  measure('base-with-preexisting-WAL', () => docker(['exec', '--user', 'postgres', name,
    'sh', '-ec', 'pg_basebackup --dbname=dbname=postgres --format=tar --pgdata=- --wal-method=fetch --checkpoint=fast --manifest-checksums=SHA256 > /tmp/t136-base.tar'],
  { timeout: 120_000 }));
  measure('post-base-switch-without-intervening-write', () => sql('SELECT pg_switch_wal()'));
  sql("UPDATE synthetic_probe SET value = value || 'during-borg-phase'");
  measure('post-base-switch-with-intervening-write', () => sql('SELECT pg_switch_wal()'));
  result.finishedAt = new Date().toISOString();
} catch (error) {
  result.error = error instanceof Error ? error.message : String(error);
  process.exitCode = 1;
} finally {
  if (created) {
    try {
      docker(['rm', '--force', '--volumes', name]);
      result.cleanup = true;
    } catch (error) {
      result.cleanupError = error instanceof Error ? error.message : String(error);
      process.exitCode = 1;
    }
  }
  console.log(JSON.stringify(result, null, 2));
}
