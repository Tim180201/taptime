import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import { migrate } from '../src/index.js';
import { ids, seedB3, truncateB3 } from './fixtures.js';

const pool = new Pool({ connectionString: process.env.B3_DATABASE_URL });
const issuer = 'https://synthetic.invalid/auth';
const member = '12000000-0000-4000-8000-000000000002';
const paths = [
  ['resolve_request_actor', 'taptime_identity_resolver'],
  ['lock_request_actor', 'taptime_identity_resolver'],
  ['lock_offline_active_actor_v1', 'taptime_offline_lease_issuer'],
  ['lock_offline_historical_actor_v1', 'taptime_offline_event_ingestor'],
] as const;
beforeAll(async () => {
  await pool.query('DROP SCHEMA IF EXISTS taptime_server CASCADE; DROP TABLE IF EXISTS public.taptime_server_schema_migrations');
  await migrate(pool);
});
beforeEach(async () => { await truncateB3(pool); await seedB3(pool); });
afterAll(() => pool.end());
async function resolve(name: string, role: string, subject = 'employee-a') {
  const client = await pool.connect();
  try {
    await client.query(`BEGIN; SET LOCAL ROLE ${role}; SET LOCAL app.offline_archive_contract_version='4'`);
    return await client.query(`SELECT * FROM taptime_server.${name}($1,$2${name.includes('historical') ? ',$3' : ''})`,
      name.includes('historical') ? [issuer, subject, member] : [issuer, subject]);
  } finally { await client.query('ROLLBACK'); client.release(); }
}
async function pause() {
  await pool.query(`UPDATE taptime_server.organizations SET status='paused', paused_at=now(),
    pause_reason='Synthetic pause', row_version=row_version+1 WHERE id=$1`, [ids.organizationA]);
}
it.each(paths)('%s rejects a paused organization and resolves it again after resuming', async (name, role) => {
  expect((await resolve(name, role)).rowCount).toBe(1);
  await pause();
  await expect(resolve(name, role)).rejects.toMatchObject({ code: 'P0068' });
  expect((await resolve(name, role, 'unknown')).rowCount).toBe(0);
  await pool.query(`UPDATE taptime_server.organizations SET status='active', paused_at=NULL,
    pause_reason=NULL, row_version=row_version+1 WHERE id=$1`, [ids.organizationA]);
  expect((await resolve(name, role)).rowCount).toBe(1);
});
it('preserves historical revoked memberships only in active organizations without disclosing a paused state', async () => {
  await pool.query('UPDATE taptime_server.memberships SET revoked_at=now(),row_version=row_version+1 WHERE id=$1', [member]);
  const historical = () => resolve('lock_offline_historical_actor_v1', 'taptime_offline_event_ingestor');
  expect((await historical()).rows[0]).toMatchObject({ membership_current: false, identity_current: true });
  await pause();
  await expect(historical()).rejects.toMatchObject({ code: '42501' });
  for (const [name, role] of paths.filter(([name]) => !name.includes('historical'))) {
    expect((await resolve(name, role)).rowCount).toBe(0);
  }
});
it('serializes an in-flight write with pausing and records status commands idempotently', async () => {
  const reader = await pool.connect(); const writer = await pool.connect();
  try {
    await reader.query('BEGIN; SET LOCAL ROLE taptime_identity_resolver');
    await reader.query('SELECT * FROM taptime_server.lock_request_actor($1,$2)', [issuer, 'employee-a']);
    await writer.query("BEGIN; SET LOCAL lock_timeout='100ms'");
    await expect(writer.query(`UPDATE taptime_server.organizations SET status='paused', paused_at=now(),
      pause_reason='Blocked',row_version=row_version+1 WHERE id=$1`, [ids.organizationA])).rejects.toMatchObject({ code: '55P03' });
  } finally { await writer.query('ROLLBACK'); await reader.query('ROLLBACK'); writer.release(); reader.release(); }
  await pool.query("INSERT INTO taptime_server.platform_operators(issuer,subject) VALUES($1,'operator')", [issuer]);
  const client = await pool.connect();
  try {
    await client.query('BEGIN; SET LOCAL ROLE taptime_platform_operator');
    await client.query("SELECT taptime_server.read_operator_session_v1($1,'operator')", [issuer]);
    const command = ['96000000-0000-4000-8000-000000000001', ids.organizationA, 'paused', 'A reason', 1];
    const invoke = () => client.query('SELECT taptime_server.operator_set_organization_status_v1($1,$2,$3,$4,$5) result', command);
    const first = (await invoke()).rows[0].result;
    expect(first).toMatchObject({ status: 'succeeded', row_version: 2 });
    expect((await invoke()).rows[0].result).toEqual(first);
    await client.query('COMMIT');
  } finally { await client.query('ROLLBACK'); client.release(); }
  expect((await pool.query("SELECT FROM taptime_server.platform_audit_events WHERE action='organization_paused'")).rowCount).toBe(1);
});
