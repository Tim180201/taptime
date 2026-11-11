import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { parseRestoreRecoveryStateV1 } from '@taptime/offline-sync-contract';
import { readRestoreRecovery } from '../src/RestoreRecoveryReader.js';
import { c1Ids, resetAndSeedC1, resetMigrateAndPrepareLogin, runtimeConnectionString } from './fixtures.js';
const connection = process.env.C2_DATABASE_URL ?? 'postgresql://timbartz@127.0.0.1:5432/taptime_c2';
const password = process.env.C2_SESSION_RUNTIME_PASSWORD ?? 'c2-session-local-synthetic-only';
const installer = new Pool({ connectionString: connection });
const runtime = new Pool({ connectionString: process.env.C2_SESSION_DATABASE_URL ?? runtimeConnectionString(connection, password), max: 1 });
const session = { organizationId: c1Ids.organizationA, userId: c1Ids.employeeA, membershipId: c1Ids.employeeAMembership };
beforeAll(async () => {
  await resetMigrateAndPrepareLogin(installer, password);
  await resetAndSeedC1(installer, { issuerA: 'https://recovery-a.test', issuerB: 'https://recovery-b.test' });
});
afterAll(async () => { await runtime.end(); await installer.end(); });
it('reads through the real non-superuser session login and shared parser, preserving PITR microseconds', async () => {
  expect(await readRestoreRecovery(runtime, session)).toEqual({ contractVersion: 1, operation: null });
  const operationId = randomUUID();
  const targetTime = '2026-11-01T12:34:56.123456Z';
  const client = await installer.connect();
  try {
    const point = (await client.query(`SELECT lpad(to_hex(system_identifier),16,'0') AS cluster,
      timeline_id,pg_current_wal_lsn()::text AS lsn FROM pg_control_system(),pg_control_checkpoint()`)).rows[0];
    await client.query('BEGIN');
    await client.query('SET LOCAL ROLE taptime_restore_activator');
    await client.query('SELECT taptime_server.record_restore_recovery_v1($1,$2,$3,$4,$5,$6,$7)',
      [operationId, point.cluster, point.timeline_id, 'point_in_time', targetTime, point.lsn, null]);
    await client.query('COMMIT');
  } finally { client.release(); }
  const result = await readRestoreRecovery(runtime, session);
  expect(parseRestoreRecoveryStateV1(result)).toEqual(result);
  expect(result.operation).toMatchObject({ id: operationId, target: { kind: 'point_in_time', time: targetTime } });
  expect(Object.keys(result.operation!).sort()).toEqual(['activatedAt','id','target']);
  await expect(readRestoreRecovery(runtime, { ...session, organizationId: c1Ids.organizationB })).rejects.toMatchObject({ code: '42501' });
  expect((await runtime.query('SELECT current_user AS role')).rows[0].role).toBe('taptime_c2_session_runtime');
});
