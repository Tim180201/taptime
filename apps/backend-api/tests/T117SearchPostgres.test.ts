import { randomUUID } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AccessTokenVerifier } from '@taptime/backend-identity';
import { applyMigrationSet, loadMigrations } from '../../backend-schema/src/index.js';
import { closePoolAndDropTestDatabase } from '../../backend-schema/tests/support/postgresTestDatabaseCleanup.mjs';
import { AdminWriteSessionCoordinator } from '../../backend-administration/src/AdminWriteSessionCoordinator.js';
import { EmployeeMembershipEnrollmentCoordinator } from '../../backend-administration/src/EmployeeMembershipEnrollmentCoordinator.js';
import { MobileWorkReadCoordinator } from '../../backend-mobile-work/src/MobileWorkReadCoordinator.js';
import { ProjectAdministrationCoordinator } from '../../backend-mobile-work/src/ProjectAdministrationCoordinator.js';
import { TimeReviewCoordinator } from '../../backend-time-review/src/TimeReviewCoordinator.js';

// Explicit red-run switch: use the real predecessor coordinators/SQL, never a fake
// search implementation. Every business case executes before 056 exists. Normal runs
// require the new methods and migration; there is no automatic fallback to old code.
const legacy = process.env.T117_LEGACY_BASELINE === '1';
const connectionString = process.env.B3_DATABASE_URL ?? 'postgresql://timbartz@127.0.0.1:5432/taptime_b3';
const installer = new Pool({ connectionString, max: 1 });
const databaseName = `t117_search_${randomUUID().replaceAll('-', '')}`;
const url = new URL(connectionString); url.pathname = `/${databaseName}`;
const db = new Pool({ connectionString: url.href, max: 3 });
let created = false;
const org = randomUUID(), foreignOrg = randomUUID(), flatOrg = randomUUID();
const locationA = randomUUID(), locationB = randomUUID();
const actor = (role: string, organization = org) => ({ user: randomUUID(), member: randomUUID(), role, org: organization });
const admin = actor('administrator'), manager = actor('standortleitung'), employee = actor('employee');
const outside = actor('employee'), homeless = actor('employee', flatOrg), foreign = actor('administrator', foreignOrg), flat = actor('employee', flatOrg);
const actors = { admin, manager, employee, outside, homeless, foreign, flat };
const verifier: AccessTokenVerifier = { async verify(token) {
  const who = actors[token as keyof typeof actors];
  return who ? { status: 'verified', identity: { issuer: 'https://t117.invalid', subject: who.user } }
    : { status: 'rejected', reason: 'invalid_signature' };
} };
const mobile = new MobileWorkReadCoordinator(db, db, verifier, Buffer.alloc(32, 17).toString('base64url'));
const projects = new ProjectAdministrationCoordinator(db, verifier);
const setup = new AdminWriteSessionCoordinator(db, verifier);
const memberships = new EmployeeMembershipEnrollmentCoordinator(db, db, verifier);
const review = new TimeReviewCoordinator(db, db, verifier);
const month = { fromInclusive: '2026-09-30T22:00:00.000Z', toExclusive: '2026-10-31T23:00:00.000Z' };
const names = ['Abel', 'Ärztehaus', 'Özdemir', 'Özdemir A', 'Özdemir B', 'Zander', 'Literal %_'];
const customers = names.map(name => ({ id: randomUUID(), name }));
const otherCustomer = randomUUID(), foreignCustomer = randomUUID(), flatCustomer = randomUUID();
const inactive = randomUUID(), inactiveNeverBound = randomUUID();
const bulkCustomers: string[] = [], bulkMembers: string[] = [], bulkTags: string[] = [], bulkProjects: string[] = [];
const kinds = ['customer_hours', 'managed_people', 'memberships', 'setup_customers', 'setup_tags', 'work_targets', 'backfill_targets', 'projects'] as const;
type Kind = typeof kinds[number] | 'customer_detail';
type Who = keyof typeof actors;
const oldSnapshots = new Map<string, unknown>();
let oldFunctions: Record<string, unknown>[];
const functionCatalog = async () => (await db.query(`SELECT proname,pg_get_function_identity_arguments(oid) AS arguments,
  prosrc,proowner,prosecdef,proconfig,proacl::text FROM pg_proc
  WHERE pronamespace='taptime_server'::regnamespace AND prokind='f' ORDER BY proname,arguments`)).rows;

async function oldResponse(kind: Kind) {
  const input = { expectedMembershipId: admin.member, cursor: null, limit: 20 };
  // Compare the actual old TS boundary too, including its existing cursor bounds.
  if (kind === 'work_targets') return mobile.queryWorkTargets({ accessToken: 'admin', request: input });
  if (kind === 'projects') return projects.queryProjects({ accessToken: 'admin', request: input });
  return invoke(kind, 'admin', {}, true);
}

async function person(who: ReturnType<typeof actor>, name: string, location: string | null) {
  await db.query('INSERT INTO taptime_server.users(id) VALUES($1)', [who.user]);
  await db.query('INSERT INTO taptime_server.identity_bindings(id,user_id,issuer,subject) VALUES(gen_random_uuid(),$1,$2,$3)', [who.user, 'https://t117.invalid', who.user]);
  await db.query('INSERT INTO taptime_server.memberships(id,organization_id,user_id,role,display_name) VALUES($1,$2,$3,$4,$5)', [who.member, who.org, who.user, who.role, name]);
  if (location) await db.query(`INSERT INTO taptime_server.membership_home_location_assignments(id,organization_id,membership_id,location_id)
    VALUES(gen_random_uuid(),$1,$2,$3)`, [who.org, who.member, location]);
}
async function customer(id: string, name: string, organization = org, location: string | null = locationA) {
  await db.query('INSERT INTO taptime_server.customers(id,organization_id,display_name,active,activated_at) VALUES($1,$2,$3,true,transaction_timestamp())', [id, organization, name]);
  if (location) await db.query(`INSERT INTO taptime_server.work_target_location_assignments(id,organization_id,target_type,target_id,location_id)
    VALUES(gen_random_uuid(),$1,'customer',$2,$3)`, [organization, id, location]);
}
async function hours(who: ReturnType<typeof actor>, target: string) {
  await db.query(`INSERT INTO taptime_server.time_record_revisions(organization_id,time_record_id,revision_number,user_id,target_type,target_customer_id,
    effective_started_at,effective_stopped_at,base_row_version,actor_user_id,actor_membership_id,reason,command_id,request_hash)
    VALUES($1,gen_random_uuid(),1,$2,'customer',$3,'2026-10-01T08:00Z','2026-10-01T09:00Z',0,$4,$5,'Test',gen_random_uuid(),repeat('a',64))`, [who.org, who.user, target, admin.user, admin.member]);
}
async function tag(target: string, name: string) {
  const id = randomUUID();
  await db.query(`INSERT INTO taptime_server.nfc_tags(id,organization_id,display_name,payload_value)
    VALUES($1,$2,$3,$4)`, [id, org, name, `nfc:uid:v1:${id.replaceAll('-', '').slice(0, 14).toUpperCase()}`]);
  await db.query(`INSERT INTO taptime_server.nfc_assignments(id,organization_id,nfc_tag_id,target_type,target_customer_id,active)
    VALUES(gen_random_uuid(),$1,$2,'customer',$3,true)`, [org, id, target]);
  return id;
}
async function project(name: string, location = locationA) {
  const id = randomUUID();
  await db.query('INSERT INTO taptime_server.projects(id,organization_id,display_name,active) VALUES($1,$2,$3,true)', [id, org, name]);
  await db.query(`INSERT INTO taptime_server.work_target_location_assignments(id,organization_id,target_type,target_id,location_id)
    VALUES(gen_random_uuid(),$1,'project',$2,$3)`, [org, id, location]);
  return id;
}
function request(kind: Kind, who: Who, extra: Record<string, unknown> = {}) {
  return { expectedMembershipId: actors[who].member, cursor: null, limit: 50,
    ...(kind === 'customer_detail' ? { customerId: customers[0]!.id } : { search: null }),
    ...(['customer_hours', 'customer_detail', 'managed_people'].includes(kind) ? month : {}),
    ...(['managed_people', 'memberships'].includes(kind) ? { locationId: null } : {}),
    ...(kind === 'managed_people' ? { isRunning: null } : {}),
    ...(kind.startsWith('setup_') ? { kind: kind === 'setup_tags' ? 'nfc_tags' : 'customers' } : {}),
    ...(kind === 'backfill_targets' ? { targetMembershipId: employee.member } : {}), ...extra };
}
async function invoke(kind: Kind, who: Who = 'admin', extra: Record<string, unknown> = {}, old = legacy): Promise<any> {
  const input: any = request(kind, who, extra), accessToken = who;
  if (!old) {
    const coordinator = kind === 'projects' ? projects : kind.startsWith('setup_') ? setup
      : kind === 'managed_people' || kind === 'memberships' ? memberships : kind === 'backfill_targets' ? review : mobile;
    return (coordinator as any).querySearch(kind, { accessToken, request: input });
  }
  const { search, kind: ignoredKind, targetType, ...previous } = input;
  previous.limit = Math.min(previous.limit, 20);
  // The old TS catalog cursor rejects long names on page two (256 ASCII chars).
  // For the SQL business baseline, drive the exact predecessor query directly.
  // oldResponse separately snapshots the actual predecessor coordinator reply.
  if ((kind === 'work_targets' || kind === 'projects') && old) {
    if (kind === 'projects' && actors[who].role !== 'administrator') return { status: 'forbidden' };
    const c = await db.connect(), a = actors[who];
    try {
      await c.query('BEGIN');
      await c.query("SELECT set_config('app.organization_id',$1,true),set_config('app.user_id',$2,true),set_config('app.membership_id',$3,true),set_config('app.membership_role',$4,true)", [a.org, a.user, a.member, a.role]);
      await c.query(`SET LOCAL ROLE ${kind === 'projects' ? 'taptime_project_administrator' : 'taptime_mobile_target_reader'}`);
      const after = input.cursor === null ? null : JSON.parse(Buffer.from(input.cursor, 'base64url').toString('utf8'));
      const found = kind === 'work_targets'
        ? (await c.query('SELECT * FROM taptime_server.read_mobile_work_targets_v1($1,$2,$3,$4,$5,$6,$7)', [a.org, a.user, a.member, after?.rank ?? null, after?.name ?? null, after?.id ?? null, previous.limit + 1])).rows
        : (await c.query('SELECT id AS target_id,display_name,active,row_version FROM taptime_server.projects WHERE organization_id=$1 AND ($2::text IS NULL OR (display_name COLLATE "C",id)>($2::text COLLATE "C",$3::uuid)) ORDER BY display_name COLLATE "C",id LIMIT $4', [a.org, after?.name ?? null, after?.id ?? null, previous.limit + 1])).rows;
      const page = found.slice(0, previous.limit), last = page.at(-1);
      return { status: 'succeeded', response: {
        [kind === 'work_targets' ? 'targets' : 'projects']: page.map(r => kind === 'work_targets'
          ? { targetType: r.target_type, targetId: r.target_id, displayName: r.display_name }
          : { projectId: r.target_id, displayName: r.display_name, active: r.active, rowVersion: Number(r.row_version) }),
        nextCursor: found.length > previous.limit && last ? Buffer.from(JSON.stringify({ id: last.target_id, name: last.display_name, rank: last.target_type === 'customer' ? 1 : last.target_type === 'project' ? 2 : 3 })).toString('base64url') : null,
      } };
    } finally { await c.query('ROLLBACK'); c.release(); }
  }
  if (kind === 'customer_hours' || kind === 'customer_detail') {
    const result = await mobile.queryCustomerHours({ accessToken, request: { expectedMembershipId: previous.expectedMembershipId, ...month, responseVersion: 'customer-hours.v2' } });
    if (result.status !== 'succeeded') return result;
    if (kind === 'customer_hours') return { ...result, response: { ...result.response, nextCursor: null } };
    const found: any = result.response.customers.find(c => c.customerId === input.customerId);
    if (!found) return { status: 'not_found' };
    const { people, days, ...head } = found;
    return { status: 'succeeded', response: { scope: result.response.scope, asOf: result.response.asOf, customer: head, ...(people ? { people } : { days }), nextCursor: null } };
  }
  let result: any;
  if (kind === 'work_targets') result = await mobile.queryWorkTargets({ accessToken, request: previous });
  else if (kind === 'projects') result = await projects.queryProjects({ accessToken, request: previous });
  else if (kind === 'backfill_targets') result = await review.queryBackfillTargets({ accessToken, request: previous });
  else if (kind.startsWith('setup_')) result = await setup.readSetupProjection({ accessToken, ...previous });
  else if (kind === 'memberships') result = await memberships.readEmployeeMembershipsProjectionV2({ accessToken, ...previous });
  else result = await memberships.readManagedActiveSummary({ accessToken, ...previous, includeSelectedMonth: true, includeMonthHours: true, includePackageUsage: true });
  if (result.status === 'ready') return { status: 'succeeded', response: result.value };
  return result.status === 'succeeded' ? { status: 'succeeded', response: result.response ?? result.value ?? result } : result;
}
function rows(kind: Kind, response: any): any[] {
  return response[kind === 'managed_people' || kind === 'customer_detail' ? 'people' : kind === 'memberships' ? 'employeeMemberships'
    : kind === 'setup_tags' ? 'nfcTags' : kind === 'projects' ? 'projects' : kind.endsWith('targets') ? 'targets' : 'customers'] ?? [];
}
const rowId = (row: any): string => row.customerId ?? row.membershipId ?? row.targetId ?? row.projectId ?? row.id;
async function all(kind: Kind, who: Who = 'admin', extra: Record<string, unknown> = {}, old = legacy) {
  const collected: any[] = [], pages: any[] = []; let cursor: string | null = null;
  do {
    const result = await invoke(kind, who, { ...extra, cursor }, old);
    expect(result.status, `${kind}/${who}, old=${old}, page=${pages.length}`).toBe('succeeded');
    const response = result.response, page = rows(kind, response);
    pages.push(response); collected.push(...page);
    expect(pages.length, 'Cursor must advance').toBeLessThan(600);
    expect(new Set(collected.map(rowId)).size, 'No duplicate at a page boundary').toBe(collected.length);
    cursor = response.nextCursor;
    if (cursor && !old) expect(page.length).toBeGreaterThan(0);
  } while (cursor);
  return { rows: collected, pages };
}
const stable = (value: any): any => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object'
  ? Object.fromEntries(Object.entries(value).filter(([key]) => !['asOf', 'serverTime'].includes(key)).map(([key, v]) => [key, stable(v)])) : value;

beforeAll(async () => {
  await installer.query(`CREATE DATABASE "${databaseName}" TEMPLATE template0 ENCODING 'UTF8'`); created = true;
  const migrations = await loadMigrations();
  await applyMigrationSet(db, migrations.filter(m => m.version < '056'));
  for (const [id, name] of [[org, 'Test A'], [foreignOrg, 'Test B'], [flatOrg, 'Ohne Standorte']]) await db.query('INSERT INTO taptime_server.organizations(id,name) VALUES($1,$2)', [id, name]);
  await db.query(`INSERT INTO taptime_server.locations(id,organization_id,display_name) VALUES($1,$3,'A'),($2,$3,'B')`, [locationA, locationB, org]);
  for (const [key, who] of Object.entries(actors)) await person(who, key === 'admin' ? 'Özdemir Admin' : key === 'manager' ? 'Özdemir Leitung' : `Person ${key}`,
    who.org === org && key !== 'homeless' ? key === 'outside' ? locationB : locationA : null);
  await db.query(`INSERT INTO taptime_server.membership_management_location_grants(id,organization_id,membership_id,location_id)
    VALUES(gen_random_uuid(),$1,$2,$3)`, [org, manager.member, locationA]);
  await db.query(`INSERT INTO taptime_server.membership_work_location_grants(id,organization_id,membership_id,location_id)
    VALUES(gen_random_uuid(),$1,$2,$3)`, [org, employee.member, locationB]);
  for (const c of customers) { await customer(c.id, c.name); await tag(c.id, `Karte ${c.name}`); await project(c.name); }
  await customer(otherCustomer, 'Özdemir Außen', org, locationB); await tag(otherCustomer, 'Außenkarte'); await project('Özdemir Außen', locationB);
  await customer(foreignCustomer, 'Özdemir Fremd', foreignOrg, null);
  await customer(flatCustomer, 'Özdemir Frei', flatOrg, null);
  await customer(inactive, 'Özdemir Inaktiv', org, locationB); await hours(employee, inactive);
  await db.query(`INSERT INTO taptime_server.work_target_location_assignments(id,organization_id,target_type,target_id,location_id,assigned_at,revoked_at)
    VALUES(gen_random_uuid(),$1,'customer',$2,$3,'2020-01-01','2020-01-02')`, [org, inactive, locationA]);
  await customer(inactiveNeverBound, 'Özdemir Historisch', org, null); await hours(employee, inactiveNeverBound);
  await db.query('UPDATE taptime_server.customers SET active=false,deactivated_at=transaction_timestamp(),row_version=row_version+1 WHERE id=ANY($1::uuid[])', [[inactive, inactiveNeverBound]]);
  // Large fixtures exercise the byte budget, ties, and customer totals independently
  // of search. Names use all 120 Unicode scalars allowed by the existing contract.
  for (let i = 0; i < 200; i++) {
    const who = actor('employee'); bulkMembers.push(who.member);
    await person(who, '😀'.repeat(120), locationA); await hours(who, customers[0]!.id);
    if (i < 50) {
      const id = randomUUID(); bulkCustomers.push(id); await customer(id, '😀'.repeat(120));
      bulkTags.push(await tag(id, '😀'.repeat(80))); bulkProjects.push(await project('😀'.repeat(120)));
    }
  }
  await db.query(`INSERT INTO taptime_server.customer_quota_settings(organization_id,customer_id,minutes,set_at,actor_membership_id,actor_role,command_id)
    VALUES($1,$2,12000,'2026-10-01',$3,'administrator',gen_random_uuid()),
      ($1,$2,30,'2099-01-01',$3,'administrator',gen_random_uuid())`, [org, customers[0]!.id, admin.member]);
  const c = await db.connect(), event = randomUUID(), entry = randomUUID();
  try {
    await c.query('BEGIN');
    await c.query(`INSERT INTO taptime_server.work_events(id,organization_id,triggered_by_user_id,target_type,target_customer_id,occurred_at,trigger_type,content_hash,content_hash_algorithm,content_hash_version)
      VALUES($1,$2,$3,'customer',$4,'2026-09-01T08:00Z','manual',repeat('a',64),'sha256',2)`, [event, org, outside.user, otherCustomer]);
    await c.query(`INSERT INTO taptime_server.time_entries(id,organization_id,user_id,target_type,target_customer_id,status,start_work_event_id,started_at,started_via)
      VALUES($1,$2,$3,'customer',$4,'started',$5,'2026-09-01T08:00Z','manual')`, [entry, org, outside.user, otherCustomer, event]);
    await c.query(`INSERT INTO taptime_server.canonical_decisions(work_event_id,organization_id,actor_user_id,target_type,target_customer_id,decision_type,time_entry_id,engine_version,decision_payload)
      VALUES($1,$2,$3,'customer',$4,'time_entry_started',$5,'test','{}')`, [event, org, outside.user, otherCustomer, entry]);
    await c.query('COMMIT');
  } catch (error) { await c.query('ROLLBACK'); throw error; } finally { c.release(); }
  await db.query('UPDATE taptime_server.organizations SET locations_enabled=true,row_version=row_version+1 WHERE id=$1', [org]);
  for (const kind of kinds) oldSnapshots.set(kind, stable(await oldResponse(kind)));
  oldFunctions = await functionCatalog();
  if (!legacy) await applyMigrationSet(db, migrations);
}, 60_000);
afterAll(async () => {
  if (created) await closePoolAndDropTestDatabase({ targetPool: db, installerPool: installer, databaseName });
  else await db.end();
  await installer.end();
});

describe.each(kinds)('T117 PostgreSQL %s', kind => {
  it('matches case-insensitively, normalizes NFC and trim, and returns no unknown names', async () => {
    const result = await all(kind, 'admin', { search: '\u2003o\u0308zD\u00a0', limit: 2 });
    expect(result.rows.length).toBeGreaterThan(0);
    expect(result.rows.every(r => `${r.displayName} ${r.customerDisplayName ?? ''}`.toLocaleLowerCase('und').includes('özd'))).toBe(true);
    expect((await all(kind, 'admin', { search: 'not-present-t117' })).rows).toEqual([]);
  });
  it.each(['', '  ', 'x'.repeat(81), '😀'.repeat(81)])('rejects invalid search %j', async search => {
    expect((await invoke(kind, 'admin', { search })).status).toBe('invalid_request');
  });
  it('walks searched pages without gaps or duplicates and binds the cursor to search', async () => {
    const one = await all(kind, 'admin', { search: 'özd', limit: 1 });
    const many = await all(kind, 'admin', { search: 'özd', limit: 50 });
    expect(one.rows.map(rowId)).toEqual(many.rows.map(rowId));
    const first = one.pages[0]; expect(first.nextCursor).not.toBeNull();
    expect((await invoke(kind, 'admin', { search: 'zander', cursor: first.nextCursor, limit: 1 })).status).toBe('invalid_request');
  });
  it('keeps every G1 page below the byte budget and delivers all four-byte names', async () => {
    const result = await all(kind, 'admin', { search: '😀', limit: 50 });
    const expected = kind === 'managed_people' || kind === 'memberships' ? bulkMembers : kind === 'setup_tags' ? bulkTags
      : kind === 'projects' ? bulkProjects : kind.endsWith('targets') ? [...bulkCustomers, ...bulkProjects] : bulkCustomers;
    expect(result.rows.map(rowId).sort()).toEqual([...expected].sort());
    expect(result.pages.length).toBeGreaterThan(1);
    for (const page of result.pages) expect(Buffer.byteLength(JSON.stringify(page), 'utf8')).toBeLessThanOrEqual(14_336);
  });
  it('preserves each predecessor scope and never broadens it through search', async () => {
    for (const who of Object.keys(actors) as Who[]) {
      const oldResult = await invoke(kind, who, {}, true);
      if (oldResult.status !== 'succeeded') { expect((await invoke(kind, who, { search: 'özd' })).status).toBe(oldResult.status); continue; }
      const before = await all(kind, who, {}, true);
      const after = await all(kind, who);
      expect(after.rows.map(rowId).sort()).toEqual(before.rows.map(rowId).sort());
      const found = await all(kind, who, { search: 'özd' });
      expect(found.rows.every(r => before.rows.some(p => rowId(p) === rowId(r)))).toBe(true);
    }
  });
  it('leaves the old route/coordinator response unchanged after 056', async () => {
    expect(stable(await oldResponse(kind))).toEqual(oldSnapshots.get(kind));
  });
});
it('T117 customer detail pages 200 people, repeats the head and preserves the total', async () => {
  const result = await all('customer_detail');
  expect(result.rows.map(rowId).sort()).toEqual([...bulkMembers].sort());
  expect(result.pages.length).toBeGreaterThan(1);
  const head = result.pages[0].customer;
  expect(head.workDurationSeconds).toBe(result.rows.reduce((sum, p) => sum + p.workDurationSeconds, 0));
  for (const page of result.pages) { expect(page.customer).toEqual(head); expect(Buffer.byteLength(JSON.stringify(page))).toBeLessThanOrEqual(14_336); }
});
it('T117 invisible and cross-tenant customer details are not_found', async () => {
  for (const customerId of [otherCustomer, foreignCustomer, randomUUID(), inactiveNeverBound]) {
    expect((await invoke('customer_detail', 'manager', { customerId })).status).toBe('not_found');
  }
});
it('T117 own inactive hours retain days without leaking people or quota', async () => {
  const result = await invoke('customer_detail', 'employee', { customerId: inactive });
  expect(result.status).toBe('succeeded');
  expect(result.response).toMatchObject({ scope: 'self', days: [{ date: '2026-10-01', workDurationSeconds: 3600, running: false }], nextCursor: null });
  expect(result.response.people).toBeUndefined(); expect(result.response.customer.quotaSeconds).toBeUndefined();
});
it('T117 customer sums across pages equal the old v2 answer', async () => {
  const old = (await all('customer_hours', 'admin', {}, true)).rows;
  const next = (await all('customer_hours')).rows;
  expect(next.map(r => [r.customerId, r.workDurationSeconds]).sort()).toEqual(old.map(r => [r.customerId, r.workDurationSeconds]).sort());
  expect(next.every(r => !('people' in r) && !('days' in r))).toBe(true);
});
it('T117 managed counts are independent of search and cursor, and v6 uses s6', async () => {
  const whole = await invoke('managed_people');
  const selected = await invoke('managed_people', 'admin', { search: 'özd', limit: 1 });
  expect(selected.response.totalCount).toBe(whole.response.totalCount);
  expect(selected.response.runningCount).toBe(whole.response.runningCount);
  expect(whole.response.runningCount).toBeGreaterThan(0);
  expect((await invoke('managed_people', 'admin', { search: 'not-present-t117', isRunning: true })).response)
    .toMatchObject({ people: [], runningCount: whole.response.runningCount, totalCount: whole.response.totalCount });
  expect(selected.response.nextCursor).toMatch(/^s6/);
});
it('T117 binds work-target cursors to target type and never treats LIKE metacharacters specially', async () => {
  const first = await invoke('work_targets', 'admin', { search: 'özd', targetType: 'customer', limit: 1 });
  expect(first.response.targets.every((r: any) => r.targetType === 'customer')).toBe(true);
  expect((await invoke('work_targets', 'admin', { search: 'özd', targetType: 'project', cursor: first.response.nextCursor })).status).toBe('invalid_request');
  const literal = await all('work_targets', 'admin', { search: '%_' });
  expect(literal.rows.map(r => r.displayName)).toEqual(['Literal %_', 'Literal %_']);
});
it('T117 SQL sorting uses ICU with id ties for all target lists', async () => {
  for (const kind of ['customer_hours', 'setup_customers', 'projects', 'work_targets', 'backfill_targets'] as const) {
    const visible = (await all(kind, 'admin', { limit: 2 })).rows.filter(r => names.includes(r.displayName) && (!r.targetType || r.targetType === 'customer'));
    expect(visible.map(r => r.displayName)).toEqual(['Abel', 'Ärztehaus', 'Literal %_', 'Özdemir', 'Özdemir A', 'Özdemir B', 'Zander']);
  }
});
it('T117 preserves D-102 home visibility while work targets include additional work grants', async () => {
  expect((await all('work_targets', 'employee', { search: 'Außen' })).rows.map(rowId)).toContain(otherCustomer);
  expect((await all('customer_hours', 'employee', { search: 'Außen' })).rows).toEqual([]);
  expect((await invoke('customer_detail', 'employee', { customerId: otherCustomer })).status).toBe('not_found');
  // D-099: an old binding in the manager scope does not override the latest binding.
  expect((await all('customer_hours', 'manager', { search: 'Inaktiv' })).rows).toEqual([]);
  expect((await invoke('customer_detail', 'manager', { customerId: inactive })).status).toBe('not_found');
});
it('T117 uses the predecessor quota at the month boundary on list and every detail page', async () => {
  const prior = (await all('customer_hours', 'admin', {}, true)).rows.find(row => row.customerId === customers[0]!.id);
  const list = (await all('customer_hours', 'admin', { search: 'Abel' })).rows[0];
  expect(list).toMatchObject({ quotaSeconds: prior.quotaSeconds, quotaStage: prior.quotaStage });
  expect(list.quotaSeconds).toBe(12000 * 60);
  for (const page of (await all('customer_detail')).pages) expect(page.customer).toEqual(list);
});
it('T117 binds location, month, person and detail-customer filters into cursors', async () => {
  const cases: [Kind, Record<string, unknown>][] = [
    ['managed_people', { locationId: locationB }], ['managed_people', { isRunning: true }],
    ['managed_people', { fromInclusive: '2026-08-31T22:00:00.000Z', toExclusive: '2026-09-30T22:00:00.000Z' }],
    ['memberships', { locationId: locationB }], ['backfill_targets', { targetMembershipId: outside.member }],
    ['customer_detail', { customerId: otherCustomer }],
    ['customer_hours', { fromInclusive: '2026-08-31T22:00:00.000Z', toExclusive: '2026-09-30T22:00:00.000Z' }],
  ];
  for (const [kind, patch] of cases) {
    const first = await invoke(kind, 'admin', { limit: 1 });
    expect(first.response.nextCursor).not.toBeNull();
    expect((await invoke(kind, 'admin', { ...patch, cursor: first.response.nextCursor })).status).toBe('invalid_request');
  }
});
it('T117 leaves every predecessor body and capability unchanged and copies the function owner/ACL', async () => {
  const current = await functionCatalog();
  for (const prior of oldFunctions) expect(current.find(row => row.proname === prior.proname && row.arguments === prior.arguments)).toEqual(prior);
  for (const [next, prior] of [
    ['read_customer_hours_v3', 'read_customer_hours_v2'], ['read_customer_hours_detail_v1', 'read_customer_hours_v2'],
    ['read_managed_active_summary_v5', 'read_managed_active_summary_v4'], ['read_managed_memberships_v3', 'read_managed_memberships_v2'],
    ['read_mobile_work_targets_v2', 'read_mobile_work_targets_v1'], ['read_time_backfill_targets_v2', 'read_time_backfill_targets_v1'],
  ]) {
    const original = current.find(row => row.proname === prior)!;
    const added = current.find(row => row.proname === next)!;
    expect(added).toBeDefined();
    for (const key of ['proowner', 'prosecdef', 'proconfig', 'proacl']) expect(added[key], `${next}.${key}`).toEqual(original[key]);
  }
});
it.each([...kinds, 'customer_detail'] as const)('T117 %s rejects a NUL cursor before binding SQL text', async kind => {
  const first = await invoke(kind, 'admin', { limit: 1 });
  const cursor: string = first.response.nextCursor;
  expect(cursor).not.toBeNull();
  const [prefix, encoded] = cursor.split(':');
  const key = JSON.parse(Buffer.from(encoded!, 'base64url').toString('utf8'));
  key[1] = '\u0000';
  const invalid = `${prefix}:${Buffer.from(JSON.stringify(key)).toString('base64url')}`;
  await expect(invoke(kind, 'admin', { cursor: invalid })).resolves.toMatchObject({ status: 'invalid_request' });
});
