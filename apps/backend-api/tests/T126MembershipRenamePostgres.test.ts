import { createBackendHttpServer } from '../src/BackendHttpServer.js';
import { B4SessionAuthorityResolver, B4AdministrationSessionAuthorityResolver } from '../src/B4SessionAuthorityResolver.js';
import type { BackendApiDependencies } from '../src/types.js';
import { closeServer, listen } from './fixtures.js';
import type { AddressInfo } from 'node:net';
import { randomUUID } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { PostgresIdentityMembershipResolver, type AccessTokenVerifier } from '@taptime/backend-identity';
import { applyMigrationSet, loadMigrations } from '../../backend-schema/src/index.js';
import { definerFindings, tenantPolicyFindings } from '../../backend-schema/tests/support/catalogSecurity.js';
import { AdminWebApiClient } from '../../admin-web/src/AdminWebApiClient';
import { MembershipId } from '@taptime/core';
import { closePoolAndDropTestDatabase } from '../../backend-schema/tests/support/postgresTestDatabaseCleanup.mjs';
import { EmployeeMembershipEnrollmentCoordinator } from '../../backend-administration/src/EmployeeMembershipEnrollmentCoordinator.js';
const connectionString = process.env.B3_DATABASE_URL ?? 'postgresql://timbartz@127.0.0.1:5432/taptime_b3';
const installer = new Pool({ connectionString, max: 1 });
const databaseName = `t126_${randomUUID().replaceAll('-', '')}`;
const url = new URL(connectionString); url.pathname = `/${databaseName}`;
const db = new Pool({ connectionString: url.href, max: 3 });
let created = false;
const org = randomUUID(), otherOrg = randomUUID(), location = randomUUID(), otherLocation = randomUUID();
const actor = (role: string, organizationId = org) => ({ userId: randomUUID(), membershipId: randomUUID(), organizationId, role });
const admin = actor('administrator'), manager = actor('standortleitung'), employee = actor('employee'),
  outside = actor('employee'), departed = actor('employee'), foreign = actor('administrator', otherOrg);
const actors = { admin, manager, employee, outside, departed, foreign };
const verifier: AccessTokenVerifier = { async verify(token) {
  const who = actors[token.split('.')[0] as keyof typeof actors];
  return who ? { status: 'verified', identity: { issuer: 'https://t126.invalid', subject: who.userId } }
    : { status: 'rejected', reason: 'invalid_signature' };
} };
const resolver = new PostgresIdentityMembershipResolver(db);
const memberships = new EmployeeMembershipEnrollmentCoordinator(db, db, verifier);
async function asRole<T>(role: string, who: typeof admin, work: (c: PoolClient) => Promise<T>) {
  const c = await db.connect();
  try {
    await c.query('BEGIN');
    await c.query("SELECT set_config('app.organization_id',$1,true),set_config('app.user_id',$2,true),set_config('app.membership_id',$3,true),set_config('app.membership_role',$4,true)",
      [who.organizationId, who.userId, who.membershipId, who.role]);
    await c.query(`SET LOCAL ROLE ${role}`);
    const result = await work(c); await c.query('COMMIT'); return result;
  } catch (error) { await c.query('ROLLBACK'); throw error; }
  finally { c.release(); }
}
const query = (who: keyof typeof actors = 'admin', patch: Record<string, unknown> = {}) => memberships.querySearch('memberships', {
  accessToken: who, request: { expectedMembershipId: actors[who].membershipId, search: null, cursor: null, limit: 50, locationId: null, ...patch },
});
beforeAll(async () => {
  expect(Number((await installer.query('SHOW server_version_num')).rows[0].server_version_num)).toBeGreaterThanOrEqual(170000);
  await installer.query(`CREATE DATABASE "${databaseName}" TEMPLATE template0 ENCODING 'UTF8'`); created = true;
  const migrations = await loadMigrations();
  await applyMigrationSet(db, migrations.filter(m => m.version < '060'));
  await db.query('INSERT INTO taptime_server.organizations(id,name) VALUES($1,\'T126 Betrieb\'),($2,\'Anderer Betrieb\')', [org, otherOrg]);
  await db.query('INSERT INTO taptime_server.locations(id,organization_id,display_name) VALUES($1,$2,\'Nord\'),($3,$2,\'Süd\')', [location, org, otherLocation]);
  for (const [name, who] of Object.entries(actors)) {
    await db.query('INSERT INTO taptime_server.users(id) VALUES($1)', [who.userId]);
    await db.query('INSERT INTO taptime_server.memberships(id,organization_id,user_id,role,display_name) VALUES($1,$2,$3,$4,$5)',
      [who.membershipId, who.organizationId, who.userId, who.role, who === admin ? null : name]);
    await db.query('INSERT INTO taptime_server.identity_bindings(id,user_id,issuer,subject) VALUES(gen_random_uuid(),$1,\'https://t126.invalid\',$2)', [who.userId, who.userId]);
    if (who.organizationId === org) await db.query(`INSERT INTO taptime_server.membership_home_location_assignments(id,organization_id,membership_id,location_id)
      VALUES(gen_random_uuid(),$1,$2,$3)`, [org, who.membershipId, who === outside ? otherLocation : location]);
  }
  await db.query(`INSERT INTO taptime_server.membership_management_location_grants(id,organization_id,membership_id,location_id)
    VALUES(gen_random_uuid(),$1,$2,$3)`, [org, manager.membershipId, location]);
  await db.query('UPDATE taptime_server.organizations SET locations_enabled=true,row_version=row_version+1 WHERE id=$1', [org]);
  await db.query('UPDATE taptime_server.memberships SET revoked_at=clock_timestamp(),row_version=row_version+1 WHERE id=$1', [departed.membershipId]);
  await applyMigrationSet(db, migrations.filter(m => m.version >= '060'));
}, 30_000);
afterAll(async () => {
  if (created) await closePoolAndDropTestDatabase({ targetPool: db, installerPool: installer, databaseName }); else await db.end();
  await installer.end();
});
const version = async (who = employee) => Number((await db.query('SELECT row_version FROM taptime_server.memberships WHERE id=$1', [who.membershipId])).rows[0].row_version);
const rename = async (who: keyof typeof actors, target = employee, name = 'Neuer Name', commandId = randomUUID(), expectedRowVersion?: number) =>
  memberships.renameMembership({ accessToken: who, expectedMembershipId: MembershipId(actors[who].membershipId), commandId,
    targetMembershipId: MembershipId(target.membershipId), expectedRowVersion: expectedRowVersion ?? await version(target), displayName: name });
const readName = (who: keyof typeof actors, target = employee) => memberships.readMembershipName({ accessToken: who,
  expectedMembershipId: MembershipId(actors[who].membershipId), targetMembershipId: MembershipId(target.membershipId) });
it('T126 names a legacy administrator, themselves and another administrator, with exact audit history', async () => {
  expect(await readName('admin', admin)).toMatchObject({ status: 'succeeded', displayName: null });
  const command = randomUUID(), before = await version(admin);
  expect(await rename('admin', admin, '  Andre\u0301 Beispiel  ', command)).toMatchObject({ status: 'succeeded', membership: { rowVersion: before + 1 }, idempotentRetry: false });
  expect(await readName('admin', admin)).toMatchObject({ displayName: 'André Beispiel', rowVersion: before + 1 });
  const events = (await db.query('SELECT event_type,actor_user_id,payload,occurred_at FROM taptime_server.audit_events WHERE correlation_id=$1', [command])).rows;
  expect(events).toEqual([{ event_type: 'MembershipRenamed', actor_user_id: admin.userId, occurred_at: expect.any(Date),
    payload: { oldName: null, newName: 'André Beispiel', rowVersion: before + 1, membershipId: admin.membershipId, action: 'rename' } }]);
  // A role change creates an actual second administrator in the same tenant.
  expect(await memberships.changeMembershipRole({ accessToken: 'admin', expectedMembershipId: MembershipId(admin.membershipId), commandId: randomUUID(),
    targetMembershipId: MembershipId(outside.membershipId), expectedRowVersion: await version(outside), role: 'administrator' })).toMatchObject({ status: 'succeeded' });
  expect(await rename('admin', outside, 'Zweiter Administrator')).toMatchObject({ status: 'succeeded' });
  expect(await memberships.changeMembershipRole({ accessToken: 'admin', expectedMembershipId: MembershipId(admin.membershipId), commandId: randomUUID(),
    targetMembershipId: MembershipId(outside.membershipId), expectedRowVersion: await version(outside), role: 'employee' })).toMatchObject({ status: 'succeeded' });
});
it('T126 enforces location, role and tenant boundaries on reads and writes', async () => {
  expect(await rename('manager', employee, 'Im Norden')).toMatchObject({ status: 'succeeded' });
  for (const target of [outside, admin, manager]) {
    expect(await rename('manager', target)).toEqual({ status: 'forbidden' });
    expect(await readName('manager', target)).toEqual({ status: 'forbidden' });
  }
  expect(await rename('employee', employee)).toEqual({ status: 'forbidden' });
});
it('T126 blocks reads and writes across the tenant boundary', async () => {
  expect(await rename('foreign', employee)).toEqual({ status: 'target_unavailable' });
  expect(await readName('foreign', employee)).toEqual({ status: 'forbidden' });
});
it('T126 keeps departed people immutable and rejects stale and unchanged requests', async () => {
  expect(await rename('admin', departed)).toEqual({ status: 'already_departed' });
  expect(await rename('manager', departed)).toEqual({ status: 'already_departed' });
  expect(await readName('admin', departed)).toEqual({ status: 'forbidden' });
  expect(await rename('admin', employee, 'Anders', randomUUID(), 1)).toEqual({ status: 'stale_row_version' });
  expect(await rename('admin', employee, 'Im Norden')).toEqual({ status: 'invalid_request' });
});
it('T126 receipts repeat the original result after further edits and conflict across commands', async () => {
  const command = randomUUID(), rowVersion = await version(employee);
  const first = await rename('admin', employee, '  Éva  ', command, rowVersion);
  expect(first.status).toBe('succeeded');
  expect((await db.query('SELECT payload FROM taptime_server.audit_events WHERE correlation_id=$1', [command])).rows[0].payload).toMatchObject({ oldName: 'Im Norden', newName: 'Éva' });
  await rename('admin', employee, 'Eva Danach');
  expect(await rename('admin', employee, 'E\u0301va', command, rowVersion)).toEqual({ ...first, idempotentRetry: true });
  for (const [name, target, v] of [['Anders', employee, rowVersion], ['Éva', outside, rowVersion], ['Éva', employee, rowVersion + 1]] as const) {
    expect(await rename('admin', target, name, command, v)).toEqual({ status: 'command_id_conflict' });
  }
  expect(await rename('manager', employee, 'Éva', command, rowVersion)).toEqual({ status: 'command_id_conflict' });
  expect(await memberships.changeMembershipRole({ accessToken: 'admin', expectedMembershipId: MembershipId(admin.membershipId), commandId: command,
    targetMembershipId: MembershipId(employee.membershipId), expectedRowVersion: rowVersion, role: 'administrator' })).toEqual({ status: 'command_id_conflict' });
  expect((await db.query('SELECT * FROM taptime_server.audit_events WHERE correlation_id=$1', [command])).rows).toHaveLength(1);
});
it('T126 SQL normalizes and rejects null, whitespace, controls and long names', async () => {
  for (const name of [null, '', '   ', 'Eva\nNord', 'a'.repeat(4097)]) {
    await asRole('taptime_membership_manager', admin, async c => {
      const command = randomUUID(); await c.query("SELECT set_config('app.correlation_id',$1,true)", [command]);
      expect((await c.query('SELECT * FROM taptime_server.rename_membership_v1($1,$2,$3,$4)', [command, employee.membershipId, await version(employee), name])).rows[0].result_status).toBe('invalid_request');
    });
  }
});
it('T126 concurrent equal commands produce one write and one receipt', async () => {
  const command = randomUUID(), v = await version(employee);
  const results = await Promise.all([rename('admin', employee, 'Gleichzeitig', command, v), rename('admin', employee, 'Gleichzeitig', command, v)]);
  expect(results.map(r => r.status)).toEqual(['succeeded', 'succeeded']);
  expect(results.map(r => r.status === 'succeeded' && r.idempotentRetry).sort()).toEqual([false, true]);
  expect(await version(employee)).toBe(v + 1);
});
it('T126 direct updates cannot bypass the trigger, even with temporarily granted UPDATE', async () => {
  await expect(db.query('UPDATE taptime_server.memberships SET display_name=$1,row_version=row_version+1 WHERE id=$2', ['Bypass', employee.membershipId])).rejects.toMatchObject({ code: '23514' });
  const c = await db.connect();
  try {
    await c.query('BEGIN');
    await c.query('GRANT UPDATE(display_name) ON taptime_server.memberships TO taptime_membership_management_function_owner');
    await c.query('SET LOCAL ROLE taptime_membership_management_function_owner');
    await expect(c.query('UPDATE taptime_server.memberships SET display_name=$1,row_version=row_version+1 WHERE id=$2', ['Bypass', employee.membershipId])).rejects.toMatchObject({ code: '23514' });
  } finally { await c.query('ROLLBACK'); c.release(); }
  expect((await db.query("SELECT pg_has_role('taptime_membership_manager','taptime_membership_rename_owner','MEMBER') AS member")).rows[0].member).toBe(false);
});
it('T126 uses current names in the existing people, payroll and CSV projections', async () => {
  const customer = randomUUID(), record = randomUUID();
  await asRole('none', admin, async c => {
    await c.query("INSERT INTO taptime_server.customers(id,organization_id,display_name,active,activated_at) VALUES($1,$2,'Kunde',true,clock_timestamp())", [customer, org]);
    await c.query("INSERT INTO taptime_server.work_target_location_assignments(id,organization_id,target_type,target_id,location_id) VALUES(gen_random_uuid(),$1,'customer',$2,$3)", [org, customer, location]);
  });
  await db.query(`INSERT INTO taptime_server.time_record_revisions(organization_id,time_record_id,revision_number,user_id,target_type,target_customer_id,
    effective_started_at,effective_stopped_at,base_row_version,actor_user_id,actor_membership_id,reason,command_id,request_hash)
    VALUES($1,$2,1,$3,'customer',$4,'2026-09-15T08:00:00Z','2026-09-15T09:00:00Z',0,$5,$6,'Nachgetragen',$7,repeat('a',64))`,
    [org, record, employee.userId, customer, admin.userId, admin.membershipId, randomUUID()]);
  const reads = () => asRole('taptime_time_exporter', admin, c => c.query("SELECT * FROM taptime_server.read_effective_time_entry_export_v3($1,'2026-09-01','2026-10-01',10001)", [org]));
  const before = (await reads()).rows[0]; expect(before).toBeDefined();
  await rename('admin', employee, 'Name im Export');
  const after = (await reads()).rows[0];
  expect(after.employee_display_name).toBe('Name im Export');
  expect({ ...after, employee_display_name: before.employee_display_name }).toEqual(before);
  const people = await query();
  expect(people.status === 'succeeded' && people.response.employeeMemberships.find(m => m.id === employee.membershipId)?.displayName).toBe('Name im Export');
  const rows = await asRole('taptime_time_review_reader', admin, c => c.query("SELECT * FROM taptime_server.read_effective_time_records_v2($1,$2,$3,'2026-09-01','2026-10-01',NULL,NULL,50)", [org, admin.userId, admin.membershipId]));
  expect(rows.rows[0].employee_display_name).toBe('Name im Export');
});
it('T126 catalog enforces definer owners, fixed paths, grants and tenant policies', async () => {
  const c = await db.connect();
  try {
    expect(await definerFindings(c)).toEqual([]); expect(await tenantPolicyFindings(c)).toEqual([]);
    expect((await c.query(`SELECT relname FROM pg_class WHERE relnamespace='taptime_server'::regnamespace AND relkind IN ('r','p') AND (NOT relrowsecurity OR NOT relforcerowsecurity)`)).rows).toEqual([]);
    expect((await c.query("SELECT proname FROM pg_proc WHERE proowner='taptime_membership_rename_owner'::regrole ORDER BY proname")).rows.map(r => r.proname)).toEqual(['read_membership_name_v1', 'rename_membership_v1']);
  } finally { c.release(); }
});
it('T126 real HTTP routes validate bodies, authenticate, map conflicts and apply the exact Web contract', async () => {
  const server = createBackendHttpServer({ sessionAuthority: new B4SessionAuthorityResolver(verifier, resolver, resolver),
    administrationSessionAuthority: new B4AdministrationSessionAuthorityResolver(verifier, resolver, resolver), employeeEnrollment: memberships,
  } as unknown as BackendApiDependencies);
  await listen(server);
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const body = { expectedMembershipId: admin.membershipId, targetMembershipId: employee.membershipId, expectedRowVersion: await version(employee), commandId: randomUUID(), displayName: 'Per HTTP' };
  const post = (patch: object = {}, token = 'admin', path = 'rename') => fetch(`${origin}/v1/administration/memberships/${path}`, {
    method: 'POST', headers: { authorization: `Bearer ${token}.header.signature`, 'content-type': 'application/json' }, body: JSON.stringify({ ...body, ...patch }),
  });
  try {
    const webClient = new AdminWebApiClient((path, init) => fetch(origin + path, init));
    expect(await webClient.readMembershipName('admin.header.signature', admin.membershipId, admin.membershipId)).toEqual({ status: 'succeeded', value: { displayName: 'André Beispiel', rowVersion: await version(admin) } });
    expect((await post({ extra: true })).status).toBe(400);
    expect((await post({ displayName: '' })).status).toBe(400);
    expect((await post({}, 'unknown')).status).toBe(401);
    expect((await post({ expectedMembershipId: manager.membershipId, targetMembershipId: outside.membershipId }, 'manager')).status).toBe(403);
    const success = await post(); expect(success.status).toBe(200);
    expect(await success.json()).toEqual({ status: 'succeeded', membership: { id: employee.membershipId, role: 'employee', active: true, rowVersion: body.expectedRowVersion + 1 }, idempotentRetry: false });
    expect(await webClient.renameMembership('admin.header.signature', admin.membershipId, body.commandId, employee.membershipId, body.expectedRowVersion, body.displayName)).toEqual({ status: 'succeeded', value: true });
    expect((await post({ displayName: 'Konflikt' })).status).toBe(409);
    expect((await post({ commandId: randomUUID() })).status).toBe(409);
  } finally { await closeServer(server); }
});
