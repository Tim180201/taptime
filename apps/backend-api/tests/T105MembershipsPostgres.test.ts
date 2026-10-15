import { createBackendHttpServer } from '../src/BackendHttpServer.js';
import { B4SessionAuthorityResolver, B4AdministrationSessionAuthorityResolver } from '../src/B4SessionAuthorityResolver.js';
import type { BackendApiDependencies } from '../src/types.js';
import { closeServer, listen } from './fixtures.js';
import type { AddressInfo } from 'node:net';
import { parseMembershipSearchResponse } from '@taptime/mobile-work-contract';
import { parseSearchResponse } from '../../mobile/src/search/search.js';
import { randomUUID } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { PostgresIdentityMembershipResolver, type AccessTokenVerifier } from '@taptime/backend-identity';
import { applyMigrationSet, loadMigrations } from '../../backend-schema/src/index.js';
import { definerFindings, tenantPolicyFindings } from '../../backend-schema/tests/support/catalogSecurity.js';
import { functionBodyDrift, latestFunctionBodies, type StoredFunction } from '../../backend-schema/tests/support/migrationFunctionBodies.js';
import { closePoolAndDropTestDatabase } from '../../backend-schema/tests/support/postgresTestDatabaseCleanup.mjs';
import { EmployeeMembershipEnrollmentCoordinator } from '../../backend-administration/src/EmployeeMembershipEnrollmentCoordinator.js';
const connectionString = process.env.B3_DATABASE_URL ?? 'postgresql://timbartz@127.0.0.1:5432/taptime_b3';
const installer = new Pool({ connectionString, max: 1 });
const databaseName = `t105_${randomUUID().replaceAll('-', '')}`;
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
  return who ? { status: 'verified', identity: { issuer: 'https://t105.invalid', subject: who.userId } }
    : { status: 'rejected', reason: 'invalid_signature' };
} };
const resolver = new PostgresIdentityMembershipResolver(db);
const memberships = new EmployeeMembershipEnrollmentCoordinator(db, db, verifier);
const catalog = async (c: Pool | PoolClient = db) => (await c.query(`SELECT proname, prosrc, proowner, prosecdef, proconfig, proacl::text
  FROM pg_proc WHERE oid='taptime_server.read_managed_memberships_v3(uuid,text,text,uuid,integer)'::regprocedure`)).rows;
let predecessor: unknown;
let oldRows: unknown;
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
const v3 = () => asRole('taptime_membership_manager', admin, async c => (await c.query('SELECT * FROM taptime_server.read_managed_memberships_v3(null,null,null,null,51)')).rows);
const signIn = (who = employee) => resolver.recordSignIn(who) as Promise<void>;
const query = (who: keyof typeof actors = 'admin', patch: Record<string, unknown> = {}) => memberships.querySearch('memberships', {
  accessToken: who, request: { expectedMembershipId: actors[who].membershipId, search: null, cursor: null, limit: 50, locationId: null, ...patch },
});
beforeAll(async () => {
  await installer.query(`CREATE DATABASE "${databaseName}" TEMPLATE template0 ENCODING 'UTF8'`); created = true;
  const migrations = await loadMigrations();
  await applyMigrationSet(db, migrations.filter(m => m.version < '059'));
  await db.query('INSERT INTO taptime_server.organizations(id,name) VALUES($1,\'T105 Betrieb\'),($2,\'Anderer Betrieb\')', [org, otherOrg]);
  await db.query('INSERT INTO taptime_server.locations(id,organization_id,display_name) VALUES($1,$2,\'Nord\'),($3,$2,\'Süd\')', [location, org, otherLocation]);
  for (const [name, who] of Object.entries(actors)) {
    await db.query('INSERT INTO taptime_server.users(id) VALUES($1)', [who.userId]);
    await db.query('INSERT INTO taptime_server.memberships(id,organization_id,user_id,role,display_name) VALUES($1,$2,$3,$4,$5)',
      [who.membershipId, who.organizationId, who.userId, who.role, name]);
    await db.query('INSERT INTO taptime_server.identity_bindings(id,user_id,issuer,subject) VALUES(gen_random_uuid(),$1,\'https://t105.invalid\',$2)', [who.userId, who.userId]);
    if (who.organizationId === org) await db.query(`INSERT INTO taptime_server.membership_home_location_assignments(id,organization_id,membership_id,location_id)
      VALUES(gen_random_uuid(),$1,$2,$3)`, [org, who.membershipId, who === outside ? otherLocation : location]);
  }
  await db.query(`INSERT INTO taptime_server.membership_management_location_grants(id,organization_id,membership_id,location_id)
    VALUES(gen_random_uuid(),$1,$2,$3)`, [org, manager.membershipId, location]);
  await db.query('UPDATE taptime_server.organizations SET locations_enabled=true,row_version=row_version+1 WHERE id=$1', [org]);
  await db.query('UPDATE taptime_server.memberships SET revoked_at=clock_timestamp(),row_version=row_version+1 WHERE id=$1', [departed.membershipId]);
  predecessor = await catalog(); oldRows = await v3();
  await applyMigrationSet(db, migrations.filter(m => m.version >= '059' && process.env.T105_PRE_MIGRATION !== '1'));
}, 30_000);
afterAll(async () => {
  if (created) await closePoolAndDropTestDatabase({ targetPool: db, installerPool: installer, databaseName }); else await db.end();
  await installer.end();
});
it('T105 records first and last session, keeps first immutable, and identity reads never write', async () => {
  await resolver.resolve({ issuer: 'https://t105.invalid', subject: employee.userId });
  expect((await db.query('SELECT * FROM taptime_server.membership_sign_ins WHERE membership_id=$1', [employee.membershipId])).rows).toEqual([]);
  await signIn();
  const first = (await db.query('SELECT * FROM taptime_server.membership_sign_ins WHERE membership_id=$1', [employee.membershipId])).rows[0];
  expect(first.first_signed_in_at).toEqual(first.last_signed_in_at);
  await signIn();
  const second = (await db.query('SELECT * FROM taptime_server.membership_sign_ins WHERE membership_id=$1', [employee.membershipId])).rows[0];
  expect(second.first_signed_in_at).toEqual(first.first_signed_in_at);
  expect(second.last_signed_in_at.getTime()).toBeGreaterThanOrEqual(first.last_signed_in_at.getTime());
  await resolver.resolve({ issuer: 'https://t105.invalid', subject: employee.userId });
  expect((await db.query('SELECT * FROM taptime_server.membership_sign_ins WHERE membership_id=$1', [employee.membershipId])).rows[0]).toEqual(second);
});
it('T105 only records an active matching membership, with no runtime table writes', async () => {
  await expect(signIn(departed)).rejects.toThrow();
  await expect(signIn({ ...employee, organizationId: otherOrg })).rejects.toThrow();
  await expect(signIn({ ...employee, userId: foreign.userId })).rejects.toThrow();
  await expect(asRole('taptime_membership_manager', admin, c => c.query('SELECT taptime_server.record_membership_sign_in_v1($1,$2,$3)', [org, employee.userId, employee.membershipId]))).rejects.toMatchObject({ code: '42501' });
  await expect(asRole('taptime_identity_resolver', employee, c => c.query('DELETE FROM taptime_server.membership_sign_ins'))).rejects.toMatchObject({ code: '42501' });
});
it('T105 filters active and revoked memberships on the server and enforces location scope', async () => {
  const all = await query(); expect(all.status).toBe('succeeded');
  if (all.status !== 'succeeded') return;
  expect(all.response.employeeMemberships.map(m => m.id).sort()).toEqual([admin, manager, employee, outside, departed].map(m => m.membershipId).sort());
  for (const active of [true, false, null]) {
    const result = await query('admin', { active }); expect(result.status).toBe('succeeded');
    if (result.status === 'succeeded') expect(result.response.employeeMemberships).toEqual(all.response.employeeMemberships.filter(m => active === null || m.active === active));
  }
  const row = all.response.employeeMemberships.find(m => m.id === employee.membershipId) as any;
  expect(row.firstSignedInAt).toMatch(/^\d{4}-/); expect(row.lastSignedInAt).toMatch(/^\d{4}-/);
  expect(all.response.employeeMemberships.find(m => m.id === outside.membershipId)).toMatchObject({ firstSignedInAt: null, lastSignedInAt: null });
  const scoped = await query('manager'); expect(scoped.status).toBe('succeeded');
  if (scoped.status === 'succeeded') expect(scoped.response.employeeMemberships.every(m => m.location?.id === location)).toBe(true);
  expect((await query('manager', { locationId: otherLocation, active: false })).status).toBe('location_scope_forbidden');
  expect((await query('employee')).status).toBe('forbidden');
  const first = await query('admin', { active: true, limit: 1 });
  if (first.status !== 'succeeded') throw new Error('first page unavailable');
  expect(first.response.nextCursor).not.toBeNull();
  expect((await query('admin', { active: false, cursor: first.response.nextCursor })).status).toBe('invalid_request');
});
it('T105 RLS hides other organizations even with a temporary direct read grant', async () => {
  await signIn(foreign);
  const c = await db.connect();
  try {
    await c.query('BEGIN'); await c.query('GRANT SELECT ON taptime_server.membership_sign_ins TO taptime_membership_manager');
    await c.query("SELECT set_config('app.organization_id',$1,true)", [org]); await c.query('SET LOCAL ROLE taptime_membership_manager');
    expect((await c.query('SELECT * FROM taptime_server.membership_sign_ins WHERE organization_id=$1', [otherOrg])).rows).toEqual([]);
    expect((await c.query('SELECT organization_id FROM taptime_server.membership_sign_ins')).rows.every(r => r.organization_id === org)).toBe(true);
  } finally { await c.query('ROLLBACK'); c.release(); }
});
it('T105 keeps v3 byte-for-byte unchanged and derives security checks from the catalog', async () => {
  expect(await catalog()).toEqual(predecessor); expect(await v3()).toEqual(oldRows);
  const c = await db.connect();
  try {
    expect(await definerFindings(c)).toEqual([]); expect(await tenantPolicyFindings(c)).toEqual([]);
    expect((await c.query(`SELECT relname FROM pg_class WHERE relnamespace='taptime_server'::regnamespace AND relkind IN ('r','p') AND (NOT relrowsecurity OR NOT relforcerowsecurity)`)).rows).toEqual([]);
    const owner = (await c.query(`SELECT r.rolcanlogin,r.rolsuper,r.rolcreaterole FROM pg_class c JOIN pg_roles r ON r.oid=c.relowner WHERE c.oid='taptime_server.membership_sign_ins'::regclass`)).rows[0];
    expect(owner).toEqual({ rolcanlogin: false, rolsuper: false, rolcreaterole: false });
    expect((await c.query(`SELECT confdeltype FROM pg_constraint WHERE conrelid='taptime_server.membership_sign_ins'::regclass AND confrelid='taptime_server.organizations'::regclass`)).rows).toEqual([{ confdeltype: 'c' }]);
  } finally { c.release(); }
});
it('T105 detects a drifted function body and recovers on rollback', async () => {
  const migrations = await loadMigrations(), expected = latestFunctionBodies(migrations);
  const c = await db.connect();
  const bodies = async () => (await c.query<StoredFunction>(`SELECT proname AS name,pronargs AS arity,prosrc AS body FROM pg_proc WHERE pronamespace='taptime_server'::regnamespace AND proname IN ('record_membership_sign_in_v1','read_managed_memberships_v4')`)).rows;
  try {
    const actual = await bodies(); expect(actual.map(r => r.name).sort()).toEqual(['read_managed_memberships_v4','record_membership_sign_in_v1']);
    expect(functionBodyDrift(actual, expected)).toEqual([]);
    await c.query('BEGIN');
    await c.query(`CREATE OR REPLACE FUNCTION taptime_server.record_membership_sign_in_v1(requested_organization_id uuid,requested_user_id uuid,requested_membership_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $probe$ BEGIN RETURN; END $probe$`);
    expect(functionBodyDrift(await bodies(), expected)).toEqual([expect.stringContaining('record_membership_sign_in_v1')]);
  } finally { await c.query('ROLLBACK'); c.release(); }
  const check = await db.connect();
  try { expect(await definerFindings(check)).toEqual([]); } finally { check.release(); }
});

it('T105 real v1/v2 sessions record sign-ins while the installed v3 App parser remains compatible', async () => {
  const server = createBackendHttpServer({
    sessionAuthority: new B4SessionAuthorityResolver(verifier, resolver, resolver),
    administrationSessionAuthority: new B4AdministrationSessionAuthorityResolver(verifier, resolver, resolver),
    recordMembershipSignIn: resolver.recordSignIn.bind(resolver), employeeEnrollment: memberships,
  } as unknown as BackendApiDependencies);
  await listen(server);
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const headers = { authorization: 'Bearer admin.header.signature', 'content-type': 'application/json' };
  const before = (await db.query('SELECT * FROM taptime_server.membership_sign_ins WHERE membership_id=$1', [admin.membershipId])).rows;
  expect(before).toEqual([]);
  try {
    for (const path of ['/v1/session', '/v2/session']) expect((await fetch(origin + path, { headers })).status).toBe(200);
    expect((await db.query('SELECT * FROM taptime_server.membership_sign_ins WHERE membership_id=$1', [admin.membershipId])).rows).toHaveLength(1);
    const request = { expectedMembershipId: admin.membershipId, locationId: null, search: null, cursor: null, limit: 50 };
    const post = (version: number, patch = {}) => fetch(`${origin}/v${version}/administration/employee-memberships-projection`, { headers, method: 'POST', body: JSON.stringify({ ...request, ...patch }) });
    const legacy = await post(3); expect(legacy.status).toBe(200);
    const legacyBody = await legacy.json(); expect(parseSearchResponse('memberships', legacyBody)).not.toBeNull();
    expect(JSON.stringify(legacyBody)).not.toMatch(/SignedInAt/);
    expect((await post(3, { active: true })).status).toBe(400);
    const next = await post(4, { active: false }); expect(next.status).toBe(200);
    const parsed = parseMembershipSearchResponse(await next.json()); expect(parsed).not.toBeNull();
    expect(parsed!.employeeMemberships.map(m => m.id)).toEqual([departed.membershipId]);
  } finally { await closeServer(server); }
});
