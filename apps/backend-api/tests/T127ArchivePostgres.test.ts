import { createBackendHttpServer } from '../src/BackendHttpServer.js';
import type { BackendApiDependencies } from '../src/types.js';
import { closeServer, listen } from './fixtures.js';
import type { AddressInfo } from 'node:net';
import type { AccessTokenVerifier } from '@taptime/backend-identity';
import { EmployeeMembershipEnrollmentCoordinator } from '../../backend-administration/src/EmployeeMembershipEnrollmentCoordinator.js';
import { type ArchiveKind, type ArchiveRequests, SEARCH_PAGE_MAXIMUM_BYTES } from '@taptime/mobile-work-contract';
import { randomUUID } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { applyMigrationSet, loadMigrations } from '../../backend-schema/src/index.js';
import { closePoolAndDropTestDatabase } from '../../backend-schema/tests/support/postgresTestDatabaseCleanup.mjs';
import { definerFindings, tenantPolicyFindings } from '../../backend-schema/tests/support/catalogSecurity.js';

// Deliberate red proof against the real predecessor, not a replacement implementation.
const legacy = process.env.T127_LEGACY_BASELINE === '1';
const connectionString = process.env.B3_DATABASE_URL ?? 'postgresql://timbartz@127.0.0.1:5432/taptime_b3';
const installer = new Pool({ connectionString, max: 1 });
const databaseName = `t127_${randomUUID().replaceAll('-', '')}`;
const url = new URL(connectionString); url.pathname = `/${databaseName}`;
const db = new Pool({ connectionString: url.href, max: 3 });
let created = false;
const org = randomUUID(), foreignOrg = randomUUID(), north = randomUUID(), south = randomUUID();
const person = (role = 'employee', tenant = org) => ({ id: randomUUID(), user: randomUUID(), role, org: tenant });
const admin = person('administrator'), manager = person('standortleitung'), employee = person(), old = person(),
  visitor = person(), recent = person(), empty = person(), outside = person(), foreign = person('administrator', foreignOrg);
const actors = { admin, manager, employee, visitor, old, recent, empty, outside, foreign };
const customer = randomUUID(), project = randomUUID(), outsideCustomer = randomUUID(), foreignCustomer = randomUUID();
let from: string, to: string, began: string, departed: string;
const bulkPeople: string[] = [], bulkTargets: string[] = [];
const duplicateTarget = randomUUID(), unboundTarget = randomUUID(), movedTarget = randomUUID(), reviewTarget = randomUUID();
let oldRecord: string;
let beforeFunctions: { proname: string; args: string }[];
const catalog = async () => (await db.query(`SELECT proname,pg_get_function_identity_arguments(oid) AS args,prosrc,proowner,prosecdef,proconfig,proacl::text
  FROM pg_proc WHERE pronamespace='taptime_server'::regnamespace ORDER BY proname,args`)).rows;
async function asActor<T>(who: typeof admin, run: (c: PoolClient) => Promise<T>, role = 'taptime_membership_manager') {
  const c = await db.connect();
  try {
    await c.query('BEGIN');
    await c.query("SELECT set_config('app.organization_id',$1,true),set_config('app.user_id',$2,true),set_config('app.membership_id',$3,true),set_config('app.membership_role',$4,true)", [who.org, who.user, who.id, who.role]);
    await c.query(`SET LOCAL ROLE ${role}`);
    return await run(c);
  } finally { await c.query('ROLLBACK'); c.release(); }
}
async function seedPerson(who: typeof admin, name: string | null, location = north, departure: string | null = null) {
  await db.query('INSERT INTO taptime_server.users(id) VALUES($1)', [who.user]);
  await db.query(`INSERT INTO taptime_server.memberships(id,organization_id,user_id,role,display_name,created_at)
    VALUES($1,$2,$3,$4,$5,transaction_timestamp()-interval '1 year')`, [who.id, who.org, who.user, who.role, name]);
  await db.query("INSERT INTO taptime_server.identity_bindings(id,user_id,issuer,subject) VALUES(gen_random_uuid(),$1,'https://t127.invalid',$2)", [who.user, who.user]);
  if (who.org === org) await db.query(`INSERT INTO taptime_server.membership_home_location_assignments(id,organization_id,membership_id,location_id,assigned_at)
    VALUES(gen_random_uuid(),$1,$2,$3,transaction_timestamp()-interval '1 year')`, [org, who.id, location]);
  if (departure) await db.query('UPDATE taptime_server.memberships SET revoked_at=$2,row_version=row_version+1 WHERE id=$1', [who.id, departure]);
}
async function hours(who: typeof admin, target = customer, start = began) {
  const id = randomUUID();
  await db.query(`INSERT INTO taptime_server.time_record_revisions(organization_id,time_record_id,revision_number,user_id,target_type,target_customer_id,
    effective_started_at,effective_stopped_at,base_row_version,actor_user_id,actor_membership_id,reason,command_id,request_hash)
    VALUES($1,$2,1,$3,'customer',$4,$5::timestamptz,$5::timestamptz+interval '1 hour',0,$6,$7,'Test',gen_random_uuid(),repeat('a',64))`,
  [who.org, id, who.user, target, start, admin.user, admin.id]);
  return id;
}
async function seedTarget(id: string, name: string, type = 'customer', location = north, tenant = org) {
  if (type === 'customer') await db.query(`INSERT INTO taptime_server.customers(id,organization_id,display_name,active,activated_at)
    VALUES($1,$2,$3,true,transaction_timestamp()-interval '1 year')`, [id, tenant, name]);
  else await db.query('INSERT INTO taptime_server.projects(id,organization_id,display_name) VALUES($1,$2,$3)', [id, tenant, name]);
  if (tenant === org) await db.query(`INSERT INTO taptime_server.work_target_location_assignments(id,organization_id,target_type,target_id,location_id,assigned_at)
    VALUES(gen_random_uuid(),$1,$2,$3,$4,transaction_timestamp()-interval '1 year')`, [tenant, type, id, location]);
}
beforeAll(async () => {
  expect(Math.floor(Number((await installer.query('SHOW server_version_num')).rows[0].server_version_num) / 10000)).toBe(17);
  await installer.query(`CREATE DATABASE "${databaseName}" TEMPLATE template0 ENCODING 'UTF8'`); created = true;
  const migrations = await loadMigrations();
  await applyMigrationSet(db, migrations.filter(m => m.version < '061'));
  beforeFunctions = await catalog();
  const dates = (await db.query(`SELECT
    (date_trunc('month',transaction_timestamp() AT TIME ZONE 'Europe/Berlin')-interval '3 months') AT TIME ZONE 'Europe/Berlin' AS start,
    (date_trunc('month',transaction_timestamp() AT TIME ZONE 'Europe/Berlin')-interval '2 months') AT TIME ZONE 'Europe/Berlin' AS finish`)).rows[0];
  from = dates.start.toISOString(); to = dates.finish.toISOString();
  began = new Date(dates.start.getTime()+86400_000).toISOString();
  departed = new Date(dates.start.getTime()+10*86400_000).toISOString();
  await db.query("INSERT INTO taptime_server.organizations(id,name) VALUES($1,'Archiv'),($2,'Fremd')", [org, foreignOrg]);
  await db.query("INSERT INTO taptime_server.locations(id,organization_id,display_name) VALUES($1,$2,'Nord'),($3,$2,'Süd')", [north, org, south]);
  for (const [name, who] of Object.entries(actors)) await seedPerson(who, who === empty ? null : name,
    [outside, visitor].includes(who) ? south : north, [old, empty, outside, visitor].includes(who) ? departed : who === recent ? new Date().toISOString() : null);
  await db.query(`INSERT INTO taptime_server.membership_management_location_grants(id,organization_id,membership_id,location_id)
    VALUES(gen_random_uuid(),$1,$2,$3)`, [org, manager.id, north]);
  await seedTarget(customer, 'Ärztehaus'); await seedTarget(project, 'Projekt', 'project');
  await seedTarget(outsideCustomer, 'Süd', 'customer', south); await seedTarget(foreignCustomer, 'Fremd', 'customer', north, foreignOrg);
  await seedTarget(reviewTarget, 'Lesbares Ziel', 'customer', south);
  await hours(employee, reviewTarget); await hours(visitor, customer);
  oldRecord = await hours(old); await hours(outside, outsideCustomer);
  await seedTarget(duplicateTarget, 'Gleich', 'customer'); await seedTarget(duplicateTarget, 'Gleich', 'project');
  await seedTarget(movedTarget, 'Umgezogen', 'customer', south);
  await db.query('UPDATE taptime_server.work_target_location_assignments SET revoked_at=transaction_timestamp() WHERE target_id=$1', [movedTarget]);
  await db.query(`INSERT INTO taptime_server.work_target_location_assignments(id,organization_id,target_type,target_id,location_id)
    VALUES(gen_random_uuid(),$1,'customer',$2,$3)`, [org, movedTarget, north]);
  await db.query(`INSERT INTO taptime_server.customers(id,organization_id,display_name,active,activated_at)
    VALUES($1,$2,'Ohne Standort',true,transaction_timestamp()-interval '1 year')`, [unboundTarget, org]);
  for (let i = 0; i < 65; i++) {
    const who = person(), id = randomUUID(), name = `Bulk ${'界'.repeat(110)}${String(i).padStart(3, '0')}`;
    bulkPeople.push(who.id); bulkTargets.push(id);
    await seedPerson(who, name, north, departed); await seedTarget(id, name, i % 2 ? 'project' : 'customer');
  }
  await db.query("UPDATE taptime_server.customers SET active=false,deactivated_at=clock_timestamp(),row_version=row_version+1");
  await db.query("UPDATE taptime_server.projects SET active=false,deactivated_at=clock_timestamp(),row_version=row_version+1");
  await db.query('UPDATE taptime_server.organizations SET locations_enabled=true,row_version=row_version+1 WHERE id=$1', [org]);
  if (!legacy) await applyMigrationSet(db, migrations.filter(m => m.version >= '061'));
});
afterAll(async () => {
  if (created) await closePoolAndDropTestDatabase({ targetPool: db, installerPool: installer, databaseName }); else await db.end();
  await installer.end();
});
const summary = (who: typeof admin, running: boolean | null = null, start = from, end = to) => asActor(who, async c =>
  (await c.query(`SELECT * FROM taptime_server.read_managed_active_summary_${legacy ? 'v5' : 'v6'}(NULL,$1,NULL,NULL,51,$2,$3,NULL)`, [running, start, end])).rows);
it('T127 red proof: Gerade aktiv never includes a departed person', async () => {
  for (const who of [admin, manager]) expect((await summary(who, true)).filter(r => r.membership_id).map(r => r.membership_id)).not.toContain(recent.id);
});
it('T127 red proof: an older month includes a person who departed three months ago', async () => {
  for (const who of [admin, manager]) expect((await summary(who)).filter(r => r.membership_id).map(r => r.membership_id)).toContain(old.id);
});
const verifier: AccessTokenVerifier = { async verify(token) {
  const who = actors[token.split('.')[0] as keyof typeof actors];
  return who ? { status: 'verified', identity: { issuer: 'https://t127.invalid', subject: who.user } } : { status: 'rejected', reason: 'invalid_signature' };
} };
const coordinator = new EmployeeMembershipEnrollmentCoordinator(db, db, verifier);
async function query<K extends ArchiveKind>(kind: K, who: keyof typeof actors = 'admin', patch: Record<string, unknown> = {}) {
  const request = { expectedMembershipId: actors[who].id,
    ...(kind === 'status' ? { membershipIds: [], targets: [] } : kind === 'person_time'
      ? { targetMembershipId: old.id, fromInclusive: from, toExclusive: to, cursor: null, limit: 20 }
      : { search: null, cursor: null, limit: 50, locationId: null,
        ...(kind === 'people' ? { membershipId: null } : kind === 'managed_people' ? { fromInclusive: from, toExclusive: to, isRunning: null } : {}) }), ...patch } as unknown as ArchiveRequests[K];
  return coordinator.queryArchive(kind, { accessToken: who, request });
}
const current = it.skipIf(legacy);
current('T127 archive people use the last home without a deadline; names stay nullable', async () => {
  for (const who of ['admin', 'manager'] as const) {
    const result = await query('people', who, { membershipId: old.id });
    expect(result).toMatchObject({ status: 'succeeded', response: { people: [{ membershipId: old.id, displayName: 'old', revokedAt: departed,
      location: { id: north }, lastStartedAt: began }], nextCursor: null } });
    expect(await query('people', who, { membershipId: empty.id })).toMatchObject({ status: 'succeeded', response: { people: [{ displayName: null, lastStartedAt: null }] } });
    expect(await query('people', who, { membershipId: employee.id })).toMatchObject({ status: 'succeeded', response: { people: [] } });
  }
  expect(await query('people', 'manager', { membershipId: outside.id })).toMatchObject({ response: { people: [] } });
  expect(await query('people', 'manager', { locationId: south })).toEqual({ status: 'forbidden' });
  expect(await query('people', 'admin', { membershipId: outside.id, locationId: south })).toMatchObject({ response: { people: [{ membershipId: outside.id }] } });
  expect(await query('people', 'foreign', { membershipId: old.id })).toMatchObject({ response: { people: [] } });
});
current.each(['people', 'targets', 'status', 'managed_people', 'person_time'] as const)('T127 %s denies employees and revoked actors', async kind => {
  expect(await query(kind, 'employee')).toEqual({ status: 'forbidden' });
  expect(await query(kind, 'old')).toEqual({ status: 'unauthorized' });
  expect(await query(kind, 'manager', { expectedMembershipId: admin.id })).toEqual({ status: 'forbidden' });
});
current('T127 targets use the last binding for both customers and projects and exclude other tenants', async () => {
  const result = await query('targets', 'manager', { search: 'ärz' });
  expect(result).toMatchObject({ response: { targets: [{ targetId: customer, targetType: 'customer', lastStartedAt: began, location: { id: north } }] } });
  expect(await query('targets', 'manager', { search: 'projekt' })).toMatchObject({ response: { targets: [{ targetId: project, lastStartedAt: null }] } });
  expect(await query('targets', 'manager', { search: 'Süd' })).toMatchObject({ response: { targets: [] } });
  expect(await query('targets', 'admin', { search: 'Süd' })).toMatchObject({ response: { targets: [{ targetId: outsideCustomer }] } });
  expect(await query('targets', 'manager', { search: 'Umgezogen' })).toMatchObject({ response: { targets: [{ targetId: movedTarget, location: { id: north } }] } });
  expect(await query('targets', 'manager', { search: 'Ohne' })).toMatchObject({ response: { targets: [] } });
  expect(await query('targets', 'admin', { search: 'Ohne' })).toMatchObject({ response: { targets: [{ targetId: unboundTarget, location: null }] } });
  expect(await query('targets', 'admin', { search: 'Fremd' })).toMatchObject({ response: { targets: [] } });
  expect(await query('targets', 'foreign', { search: 'Fremd' })).toMatchObject({ response: { targets: [{ targetId: foreignCustomer }] } });
});
current.each(['people', 'targets'] as const)('T127 %s searches, pages losslessly and bounds actual UTF-8 envelopes', async kind => {
  let cursor: string | null = null;
  const ids: string[] = [];
  do {
    const result: import('@taptime/mobile-work-contract').ArchiveReadResult<typeof kind> = await query(kind, 'manager', { search: 'bulk', cursor });
    expect(result.status).toBe('succeeded'); if (result.status !== 'succeeded') throw new Error(result.status);
    expect(Buffer.byteLength(JSON.stringify(result.response))).toBeLessThanOrEqual(SEARCH_PAGE_MAXIMUM_BYTES);
    const rows = kind === 'people' ? (result.response as import('@taptime/mobile-work-contract').ArchiveResponses['people']).people
      : (result.response as import('@taptime/mobile-work-contract').ArchiveResponses['targets']).targets;
    expect(rows.length).toBeGreaterThan(0); expect(rows.length).toBeLessThan(50);
    ids.push(...rows.map(r => 'membershipId' in r ? r.membershipId : r.targetId));
    cursor = result.response.nextCursor;
    if (cursor) {
      expect(await query(kind, 'manager', { search: 'changed', cursor })).toEqual({ status: 'invalid_request' });
      expect(await query(kind, 'admin', { search: 'bulk', cursor })).toEqual({ status: 'invalid_request' });
      expect(await query(kind, 'manager', { search: 'bulk', locationId: north, cursor })).toEqual({ status: 'invalid_request' });
    }
    expect(ids.length).toBeLessThanOrEqual((kind === 'people' ? bulkPeople : bulkTargets).length);
  } while (cursor);
  expect(new Set(ids).size).toBe(ids.length);
  expect(ids.sort()).toEqual([...(kind === 'people' ? bulkPeople : bulkTargets)].sort());
});
current('T127 target cursor handles the same name and ID in two target types', async () => {
  const first = await query('targets', 'manager', { search: 'gleich', limit: 1 });
  expect(first).toMatchObject({ response: { targets: [{ targetId: duplicateTarget, targetType: 'customer' }], nextCursor: expect.any(String) } });
  if (first.status !== 'succeeded') throw new Error(first.status);
  expect(await query('targets', 'manager', { search: 'gleich', cursor: first.response.nextCursor, limit: 1 }))
    .toMatchObject({ response: { targets: [{ targetId: duplicateTarget, targetType: 'project' }], nextCursor: null } });
});
current('T127 monthly people include only former people with time; counts stay active-only', async () => {
  for (const who of ['admin', 'manager'] as const) {
    const result = await query('managed_people', who);
    expect(result.status).toBe('succeeded'); if (result.status !== 'succeeded') throw new Error(result.status);
    const people = result.response.people;
    expect(people.find(p => p.membershipId === old.id)).toMatchObject({ monthWorkDurationSeconds: 3600, departedAt: departed });
    expect(people.map(p => p.membershipId)).not.toContain(empty.id);
    expect(people.map(p => p.membershipId)).not.toContain(recent.id);
    expect(result.response.totalCount).toBe(Object.values(actors).filter(p => p.org === org && [admin, manager, employee].includes(p)).length);
    expect(result.response.runningCount).toBe(0);
    expect(await query('managed_people', who, { fromInclusive: to, toExclusive: new Date(new Date(to).getTime()+28*86400_000).toISOString() })).toEqual({ status: 'invalid_request' });
  }
  expect((await summary(manager)).filter(r => r.membership_id).map(r => r.membership_id)).not.toContain(outside.id);
});
current('T127 person v2 reads beyond D-115 but cannot change, backfill or review that person', async () => {
  expect(await query('person_time', 'manager')).toMatchObject({ status: 'succeeded', response: { canManageTime: false, records: [{ timeRecordId: oldRecord }] } });
  expect(await query('person_time', 'admin')).toMatchObject({ status: 'succeeded', response: { canManageTime: true } });
  expect(await query('person_time', 'manager', { targetMembershipId: recent.id })).toMatchObject({ response: { canManageTime: true } });
  expect(await query('person_time', 'manager', { targetMembershipId: outside.id })).toEqual({ status: 'forbidden' });
  expect(await query('person_time', 'foreign')).toEqual({ status: 'forbidden' });
  const request = { expectedMembershipId: manager.id, targetMembershipId: old.id, commandId: randomUUID(), targetType: 'customer', targetId: customer,
    startedAt: began, stoppedAt: new Date(Date.parse(began)+3600_000).toISOString(), reason: 'Test', comment: null };
  expect(await asActor(manager, async c => (await c.query('SELECT taptime_server.backfill_time_record_v1($1::jsonb) AS result', [JSON.stringify(request)])).rows[0].result, 'taptime_time_review_writer'))
    .toMatchObject({ status: 'authority_rejected' });
  expect(await asActor(manager, async c => (await c.query('SELECT * FROM taptime_server.has_time_management_authority_v1($1,$2,$3,$4)', [org, manager.user, manager.id, old.user])).rows, 'taptime_time_review_reader')).toEqual([]);
});
current('T127 status omits inaccessible, missing and foreign IDs; includes active status', async () => {
  const patch = { membershipIds: [old.id, employee.id, outside.id, foreign.id, randomUUID()], targets: [
    { targetType: 'customer', targetId: customer }, { targetType: 'project', targetId: project },
    { targetType: 'customer', targetId: outsideCustomer }, { targetType: 'customer', targetId: foreignCustomer },
  ] };
  const result = await query('status', 'manager', patch);
  expect(result.status).toBe('succeeded'); if (result.status !== 'succeeded') throw new Error(result.status);
  expect(result.response.people).toHaveLength(2);
  expect(result.response.people).toEqual(expect.arrayContaining([{ membershipId: old.id, archived: true }, { membershipId: employee.id, archived: false }]));
  expect(result.response.targets).toHaveLength(2);
  expect(result.response.targets).toEqual(expect.arrayContaining([{ targetType: 'customer', targetId: customer, archived: true }, { targetType: 'project', targetId: project, archived: true }]));
  expect(await query('status', 'manager', { membershipIds: Array.from({ length: 201 }, () => randomUUID()) })).toEqual({ status: 'invalid_request' });
  expect(await query('status', 'manager', { membershipIds: Array.from({ length: 200 }, () => randomUUID()) })).toMatchObject({ status: 'succeeded', response: { people: [], targets: [] } });
});
current('T127 rechecks live grants and rejects stale cursors instead of authorizing with them', async () => {
  const first = await query('people', 'manager', { search: 'bulk', limit: 1 });
  if (first.status !== 'succeeded') throw new Error(first.status);
  await asActor(admin, async c => {
    await c.query('RESET ROLE');
    await c.query('UPDATE taptime_server.membership_management_location_grants SET revoked_at=clock_timestamp() WHERE membership_id=$1 AND revoked_at IS NULL', [manager.id]);
    await c.query("SELECT set_config('app.user_id',$1,true),set_config('app.membership_id',$2,true),set_config('app.membership_role','standortleitung',true)", [manager.user, manager.id]);
    await c.query('SET LOCAL ROLE taptime_membership_manager');
    expect((await c.query('SELECT * FROM taptime_server.read_archive_people_v1(NULL,NULL,NULL,NULL,NULL,51)')).rows).toMatchObject([{ result_status: 'forbidden' }]);
  });
});
current('T127 catalog is hardened and every predecessor function remains unchanged', async () => {
  const added = new Set(['read_archive_people_v1', 'read_archive_targets_v1', 'read_archive_status_v1', 'read_managed_active_summary_v6', 'read_managed_person_time_v2']);
  const after = await catalog();
  // Later migrations may add functions; every predecessor must still exist unchanged.
  const identity = (row: { proname: string; args: string }) => JSON.stringify([row.proname, row.args]);
  const predecessors = new Set(beforeFunctions.map(identity));
  expect(after.filter(r => predecessors.has(identity(r)))).toEqual(beforeFunctions);
  expect(after.filter(r => added.has(r.proname)).map(r => r.proname).sort()).toEqual([...added].sort());
  const c = await db.connect();
  try {
    expect(await definerFindings(c)).toEqual([]); expect(await tenantPolicyFindings(c)).toEqual([]);
    expect((await c.query(`SELECT relname FROM pg_class WHERE relnamespace='taptime_server'::regnamespace AND relkind='r'
      AND (NOT relrowsecurity OR NOT relforcerowsecurity)`)).rows).toEqual([]);
  } finally { c.release(); }
});
current('T127 status marks a visible customer contributor without opening their person archive', async () => {
  const customerDetail = await asActor(manager, async c => (await c.query(
    'SELECT taptime_server.read_customer_hours_detail_v1($1,$2,$3,NULL,NULL,51) AS value', [from, to, customer])).rows[0].value, 'taptime_mobile_own_time_reader');
  expect(customerDetail.people.map((p: { membershipId: string }) => p.membershipId)).toContain(visitor.id);
  expect(await query('status', 'manager', { membershipIds: [visitor.id, outside.id, foreign.id] }))
    .toEqual({ status: 'succeeded', response: { people: [{ membershipId: visitor.id, archived: true }], targets: [] } });
  expect(await query('people', 'manager', { membershipId: visitor.id })).toMatchObject({ response: { people: [] } });
  expect(await query('person_time', 'manager', { targetMembershipId: visitor.id })).toEqual({ status: 'forbidden' });
});
current('T127 status marks a target from readable time even outside the target archive scope', async () => {
  const result = await query('status', 'manager', { targets: [{ targetType: 'customer', targetId: reviewTarget }, { targetType: 'customer', targetId: outsideCustomer }] });
  expect(result).toEqual({ status: 'succeeded', response: { people: [], targets: [{ targetType: 'customer', targetId: reviewTarget, archived: true }] } });
  expect(await query('targets', 'manager', { search: 'Lesbares Ziel' })).toMatchObject({ response: { targets: [] } });
});
current('T127 person v2 preserves the exact details and calendar of the existing reader in one snapshot', async () => {
  await asActor(admin, async c => {
    const rows = (await c.query(`WITH old AS (SELECT * FROM taptime_server.read_time_record_calendar_v1(ARRAY[$1::uuid])),
      new AS (SELECT * FROM taptime_server.read_managed_person_time_v2($2,$3,$4,NULL,NULL,21))
      SELECT old.details AS old_details,new.details,old.calendar AS old_calendar,new.calendar FROM old JOIN new USING(time_record_id)`, [oldRecord, old.id, from, to])).rows;
    expect(rows).toHaveLength(1);
    expect(rows[0].details).toEqual(rows[0].old_details); expect(rows[0].calendar).toEqual(rows[0].old_calendar);
  });
  const result = await query('person_time', 'manager');
  expect(result).toMatchObject({ response: { canManageTime: false, records: [{ details: { effectiveRevisionNumber: 1 }, calendar: { workDurationSeconds: 3600, breakDurationSeconds: 0 } }] } });
});
current('T127 SQL boundaries reject oversized pages and status batches directly', async () => {
  await asActor(admin, async c => {
    for (const sql of [
      'SELECT * FROM taptime_server.read_archive_people_v1(NULL,NULL,NULL,NULL,NULL,52)',
      'SELECT * FROM taptime_server.read_archive_targets_v1(NULL,NULL,NULL,NULL,NULL,52)',
      "SELECT * FROM taptime_server.read_archive_targets_v1(NULL,NULL,NULL,NULL,'customer',10)",
    ]) expect((await c.query(sql)).rows).toMatchObject([{ result_status: 'invalid_request' }]);
    expect((await c.query('SELECT * FROM taptime_server.read_archive_status_v1($1,$2,$3)', [Array.from({ length: 201 }, () => randomUUID()), [], []])).rows)
      .toMatchObject([{ result_status: 'invalid_request' }]);
  });
});
current('T127 connects all five real HTTP routes through actor resolution to PostgreSQL', async () => {
  const server = createBackendHttpServer({ employeeEnrollment: coordinator } as unknown as BackendApiDependencies);
  await listen(server);
  try {
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const common = { expectedMembershipId: manager.id, cursor: null, limit: 20 };
    const list = { ...common, locationId: null, search: null };
    const calls = [
      ['/v1/administration/archive/people', { ...list, membershipId: old.id }, { people: [{ membershipId: old.id }] }],
      ['/v1/administration/archive/targets', { ...list, search: 'Ärzte' }, { targets: [{ targetId: customer }] }],
      ['/v1/administration/archive/status', { expectedMembershipId: manager.id, membershipIds: [old.id], targets: [] }, { people: [{ membershipId: old.id, archived: true }] }],
      ['/v2/administration/managed-active-summary', { ...list, fromInclusive: from, toExclusive: to, isRunning: true }, { people: [] }],
      ['/v2/administration/managed-person-time', { ...common, targetMembershipId: old.id, fromInclusive: from, toExclusive: to }, { canManageTime: false, records: [{ timeRecordId: oldRecord, calendar: { workDurationSeconds: 3600 } }] }],
    ] as const;
    for (const [path, body, expected] of calls) {
      const response = await fetch(base + path, { method: 'POST', headers: { authorization: 'Bearer manager.payload.signature', 'content-type': 'application/json' }, body: JSON.stringify(body) });
      expect(response.status).toBe(200); expect(await response.json()).toMatchObject(expected);
    }
  } finally { await closeServer(server); }
});
