import { randomUUID } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import { afterAll, afterEach, beforeAll, beforeEach, expect, it } from 'vitest';
import { migrate } from '../src/index.js';
const pool = new Pool({ connectionString: process.env.B3_DATABASE_URL ?? 'postgresql://timbartz@127.0.0.1:5432/taptime_b3' });
let client: PoolClient;
let user: string, organization: string, membership: string;
let evidence: unknown[];
beforeAll(async () => { await migrate(pool); });
afterAll(async () => { await pool.end(); });
beforeEach(async () => {
  client = await pool.connect(); await client.query('BEGIN');
  user = randomUUID(); organization = randomUUID(); membership = randomUUID();
  await client.query('INSERT INTO taptime_server.users(id) VALUES ($1)', [user]);
  await client.query("INSERT INTO taptime_server.organizations(id,name) VALUES ($1,'Recovery fixture')", [organization]);
  await client.query(`INSERT INTO taptime_server.memberships(id,organization_id,user_id,role,created_by_user_id)
    VALUES ($1,$2,$3,'employee',$3)`, [membership, organization, user]);
  const control = (await client.query(`SELECT lpad(to_hex(system_identifier),16,'0') AS cluster,
    timeline_id,pg_current_wal_lsn()::text AS lsn FROM pg_control_system(),pg_control_checkpoint()`)).rows[0];
  evidence = [randomUUID(), control.cluster, control.timeline_id, 'latest', null, control.lsn, null];
});
afterEach(async () => { await client.query('ROLLBACK'); client.release(); });
const recordSql = 'SELECT taptime_server.record_restore_recovery_v1($1,$2,$3,$4,$5,$6,$7) AS id';
const readSql = 'SELECT * FROM taptime_server.read_latest_restore_recovery_v1($1,$2,$3)';
async function denied(sql: string, values: unknown[] = [], code = '42501') {
  await client.query('SAVEPOINT denial');
  await expect(client.query(sql, values)).rejects.toMatchObject({ code });
  await client.query('ROLLBACK TO denial');
}
it('grants activation only the versioned writer, app roles only the authenticated projection, and enforces RLS', async () => {
  const table = 'taptime_server.restore_recovery_operations';
  expect((await client.query(`SELECT relrowsecurity,relforcerowsecurity FROM pg_class WHERE oid=$1::regclass`, [table])).rows)
    .toEqual([{ relrowsecurity: true, relforcerowsecurity: true }]);
  const roles = (await client.query(`SELECT rolname FROM pg_roles WHERE rolname LIKE 'taptime_%'
    AND NOT rolsuper AND rolname <> 'taptime_restore_operation_owner'`)).rows;
  for (const { rolname } of roles) {
    const rights = (await client.query(`SELECT has_table_privilege($1,$2,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE') AS direct,
      has_function_privilege($1,'taptime_server.record_restore_recovery_v1(uuid,text,bigint,text,timestamptz,pg_lsn,timestamptz)','EXECUTE') AS writer`,
    [rolname, table])).rows[0];
    expect(rights, rolname).toEqual({ direct: false, writer: rolname === 'taptime_restore_activator' });
  }
  await client.query('SET LOCAL ROLE taptime_identity_resolver');
  await denied(recordSql, evidence);
  await denied(`SELECT * FROM ${table}`);
  await denied(`DELETE FROM ${table}`);
  await client.query('SET LOCAL ROLE taptime_restore_activator');
  await denied(`INSERT INTO ${table}(id) VALUES ($1)`, [randomUUID()]);
  await denied(`SELECT * FROM ${table}`);
  await denied(readSql, [organization, user, membership]);
});
it('preserves evidence and activation time on retry, appends a new restore, and rejects mutations and mismatches', async () => {
  await client.query('SET LOCAL ROLE taptime_restore_activator');
  expect((await client.query(recordSql, evidence)).rows[0].id).toBe(evidence[0]);
  await client.query('SET LOCAL ROLE NONE');
  const first = (await client.query('SELECT * FROM taptime_server.restore_recovery_operations WHERE id=$1', [evidence[0]])).rows[0];
  expect(first.time_basis).toBe('no_replayed_transaction');
  await client.query('SET LOCAL ROLE taptime_restore_activator');
  await client.query(recordSql, evidence);
  await denied(recordSql, [evidence[0], evidence[1], evidence[2], 'point_in_time', '2026-11-01T12:00:00Z', evidence[5], null], '22023');
  await denied(recordSql, [randomUUID(), '0000000000000000', ...evidence.slice(2)], '22023');
  await denied(recordSql, [randomUUID(), evidence[1], Number(evidence[2]) + 1, ...evidence.slice(3)], '22023');
  const secondId = randomUUID();
  await client.query(recordSql, [secondId, ...evidence.slice(1)]);
  await client.query('SET LOCAL ROLE NONE');
  expect((await client.query('SELECT * FROM taptime_server.restore_recovery_operations WHERE id=$1', [evidence[0]])).rows).toEqual([first]);
  await denied('UPDATE taptime_server.restore_recovery_operations SET activated_at=now()');
  await denied('DELETE FROM taptime_server.restore_recovery_operations');
  // CASCADE reaches the immutable guard even with recovery evidence referencing this operation.
  await denied('TRUNCATE taptime_server.restore_recovery_operations CASCADE');
  await client.query('SET LOCAL ROLE taptime_identity_resolver');
  expect((await client.query(readSql, [organization, user, membership])).rows[0].id).toBe(secondId);
});
it('checks the resolved member and active organization again and exposes no operational internals', async () => {
  await client.query('SET LOCAL ROLE taptime_identity_resolver');
  // Other tests may leave valid operational history: a fresh installation is covered by the physical test.
  await denied(readSql, [randomUUID(), user, membership]);
  await denied(readSql, [organization, randomUUID(), membership]);
  await denied(readSql, [organization, user, randomUUID()]);
  await client.query('SET LOCAL ROLE taptime_restore_activator');
  await client.query(recordSql, evidence);
  await client.query('SET LOCAL ROLE taptime_identity_resolver');
  expect(Object.keys((await client.query(readSql, [organization, user, membership])).rows[0]).sort())
    .toEqual(['activated_at','id','target_kind','target_time']);
  await client.query('SET LOCAL ROLE NONE');
  await client.query("UPDATE taptime_server.organizations SET status='paused',paused_at=now(),pause_reason='Recovery fixture',row_version=row_version+1 WHERE id=$1", [organization]);
  await client.query('SET LOCAL ROLE taptime_identity_resolver');
  await denied(readSql, [organization, user, membership]);
});
