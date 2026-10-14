import { randomUUID } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AccessTokenVerifier } from '@taptime/backend-identity';
import type { TargetAssignmentChangeRequest } from '@taptime/mobile-work-contract';
import { applyMigrationSet, loadMigrations } from '../../backend-schema/src/index.js';
import { closePoolAndDropTestDatabase } from '../../backend-schema/tests/support/postgresTestDatabaseCleanup.mjs';
import { AdminWriteSessionCoordinator } from '../../backend-administration/src/AdminWriteSessionCoordinator.js';
import { MobileWorkReadCoordinator } from '../../backend-mobile-work/src/MobileWorkReadCoordinator.js';
import { TimeReviewCoordinator } from '../../backend-time-review/src/TimeReviewCoordinator.js';

const connectionString = process.env.B3_DATABASE_URL ?? 'postgresql://timbartz@127.0.0.1:5432/taptime_b3';
const installer = new Pool({ connectionString, max: 1 });
const databaseName = `t118_assignments_${randomUUID().replaceAll('-', '')}`;
const url = new URL(connectionString); url.pathname = `/${databaseName}`;
const db = new Pool({ connectionString: url.href, max: 3 });
let created = false;
const org = randomUUID(), foreignOrg = randomUUID(), flatOrg = randomUUID();
const locationA = randomUUID(), locationB = randomUUID();
const actor = (role: string, organization = org) => ({ user: randomUUID(), member: randomUUID(), role, org: organization });
const actors = { admin: actor('administrator'), manager: actor('standortleitung'), manager2: actor('standortleitung'), employee: actor('employee'),
  outside: actor('employee'), foreign: actor('administrator', foreignOrg), flat: actor('administrator', flatOrg) };
type Who = keyof typeof actors;
const customerA = randomUUID(), customerB = randomUUID(), foreignCustomer = randomUUID(), unbound = randomUUID(), projectA = randomUUID();
const month = { fromInclusive: '2026-09-30T22:00:00.000Z', toExclusive: '2026-10-31T23:00:00.000Z' };
const verifier: AccessTokenVerifier = { async verify(token) {
  const who = actors[token as Who];
  return who ? { status: 'verified', identity: { issuer: 'https://t118.invalid', subject: who.user } }
    : { status: 'rejected', reason: 'invalid_signature' };
} };
const setup = new AdminWriteSessionCoordinator(db, verifier);
const mobile = new MobileWorkReadCoordinator(db, db, verifier, Buffer.alloc(32, 18).toString('base64url'));
const review = new TimeReviewCoordinator(db, db, verifier);

async function person(who: ReturnType<typeof actor>, name: string, home: string | null) {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await client.query('INSERT INTO taptime_server.users(id) VALUES($1)', [who.user]);
    await client.query('INSERT INTO taptime_server.identity_bindings(id,user_id,issuer,subject) VALUES(gen_random_uuid(),$1::uuid,$2,$3)', [who.user, 'https://t118.invalid', who.user]);
    await client.query('INSERT INTO taptime_server.memberships(id,organization_id,user_id,role,display_name) VALUES($1,$2,$3,$4,$5)', [who.member, who.org, who.user, who.role, name]);
    if (home) await client.query(`INSERT INTO taptime_server.membership_home_location_assignments(id,organization_id,membership_id,location_id)
      VALUES(gen_random_uuid(),$1,$2,$3)`, [who.org, who.member, home]);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}
async function customer(id: string, name: string, organization = org, location: string | null = locationA) {
  await db.query('INSERT INTO taptime_server.customers(id,organization_id,display_name,active,activated_at) VALUES($1,$2,$3,true,transaction_timestamp())', [id, organization, name]);
  if (location) await db.query(`INSERT INTO taptime_server.work_target_location_assignments(id,organization_id,target_type,target_id,location_id)
    VALUES(gen_random_uuid(),$1,'customer',$2,$3)`, [organization, id, location]);
}
async function transaction<T>(who: Who, role: string, action: (c: PoolClient) => Promise<T>): Promise<T> {
  const client = await db.connect(), a = actors[who];
  try {
    await client.query('BEGIN');
    await client.query(`SELECT set_config('app.organization_id',$1,true),set_config('app.user_id',$2,true),
      set_config('app.membership_id',$3,true),set_config('app.membership_role',$4,true)`, [a.org, a.user, a.member, a.role]);
    await client.query(`SET LOCAL ROLE ${role}`);
    return await action(client);
  } finally { await client.query('ROLLBACK'); client.release(); }
}
const changeRequest = (who: Who, patch: Partial<TargetAssignmentChangeRequest> = {}): TargetAssignmentChangeRequest => ({ expectedMembershipId: actors[who].member, commandId: randomUUID(),
  membershipId: actors.employee.member, targetType: 'customer', targetId: customerA, assigned: true, ...patch });
async function change(c: PoolClient, who: Who = 'admin', patch = {}) {
  const request = changeRequest(who, patch);
  await c.query("SELECT set_config('app.correlation_id',$1,true)", [request.commandId]);
  return (await c.query('SELECT taptime_server.change_target_assignment_v1($1::jsonb) result', [request])).rows[0].result;
}
async function query(c: PoolClient, selector: Record<string, unknown>, search: string | null = null, afterName: string | null = null, afterId: string | null = null, limit = 51) {
  return (await c.query('SELECT taptime_server.read_target_assignments_v1($1,$2,$3,$4,$5,$6,$7) result',
    [selector.membershipId ?? null, selector.targetType ?? null, selector.targetId ?? null, search, afterName, afterId, limit])).rows[0].result;
}
async function targets(c: PoolClient, who: Who, assignedOnly: boolean, backfill = false) {
  const a = actors[who];
  await c.query(`SET LOCAL ROLE ${backfill ? 'taptime_time_review_reader' : 'taptime_mobile_target_reader'}`);
  return (await c.query(backfill
    ? 'SELECT * FROM taptime_server.read_time_backfill_targets_v3($1,$2,$3,$4,null,null,null,51,null,$5)'
    : 'SELECT * FROM taptime_server.read_mobile_work_targets_v3($1,$2,$3,null,null,null,51,null,null,$4)',
  backfill ? [a.org, a.user, a.member, actors.employee.member, assignedOnly] : [a.org, a.user, a.member, assignedOnly])).rows;
}
async function seedAssignment(c: PoolClient, member = actors.employee.member, target = customerA, type = 'customer') {
  await c.query('RESET ROLE');
  await c.query(`INSERT INTO taptime_server.target_assignments(id,organization_id,membership_id,target_type,target_id,assigned_by)
    VALUES(gen_random_uuid(),$1,$2,$3,$4,$5)`, [org, member, type, target, actors.admin.member]);
  await c.query('SET LOCAL ROLE taptime_admin_setup');
}
const quotaCustomers: string[] = [];
beforeAll(async () => {
  await installer.query(`CREATE DATABASE "${databaseName}" TEMPLATE template0 ENCODING 'UTF8'`); created = true;
  // Setup deliberately uses only pre-existing tables. Missing T118 SQL must fail
  // each individual business test, never prevent the suite from running at all.
  await applyMigrationSet(db, await loadMigrations());
  for (const id of [org, foreignOrg, flatOrg]) await db.query("INSERT INTO taptime_server.organizations(id,name) VALUES($1,'T118 Test')", [id]);
  await db.query("INSERT INTO taptime_server.locations(id,organization_id,display_name) VALUES($1,$3,'A'),($2,$3,'B')", [locationA, locationB, org]);
  for (const [key, a] of Object.entries(actors)) await person(a, key === 'employee' ? 'Änne' : key, a.org === org ? key === 'outside' ? locationB : locationA : null);
  await db.query(`INSERT INTO taptime_server.membership_management_location_grants(id,organization_id,membership_id,location_id)
    VALUES(gen_random_uuid(),$1,$2,$3)`, [org, actors.manager.member, locationA]);
  await customer(customerA, 'Ärztehaus'); await customer(customerB, 'Zander', org, locationB);
  await customer(foreignCustomer, 'Fremd', foreignOrg, null); await customer(unbound, 'Ohne Bindung', org, null);
  await db.query('UPDATE taptime_server.customers SET active=false,deactivated_at=transaction_timestamp(),row_version=row_version+1 WHERE id=$1', [unbound]);
  await db.query("INSERT INTO taptime_server.projects(id,organization_id,display_name,active) VALUES($1,$2,'Ärzte Projekt',true)", [projectA, org]);
  await db.query(`INSERT INTO taptime_server.work_target_location_assignments(id,organization_id,target_type,target_id,location_id)
    VALUES(gen_random_uuid(),$1,'project',$2,$3)`, [org, projectA, locationA]);
  // More than one full unfiltered page precedes the alerts. All names respect
  // the production name contract; long names also exercise the wire byte budget.
  for (let i = 0; i < 110; i++) {
    const id = randomUUID(); await customer(id, i < 55 ? `A Quiet ${i}` : '😀'.repeat(120));
    if (i < 55) continue;
    quotaCustomers.push(id);
    await db.query(`INSERT INTO taptime_server.customer_quota_settings(organization_id,customer_id,minutes,set_at,actor_membership_id,actor_role,command_id)
      VALUES($1,$2,60,'2026-09-01',$3,'administrator',gen_random_uuid())`, [org, id, actors.admin.member]);
    await db.query(`INSERT INTO taptime_server.time_record_revisions(organization_id,time_record_id,revision_number,user_id,target_type,target_customer_id,
      effective_started_at,effective_stopped_at,base_row_version,actor_user_id,actor_membership_id,reason,command_id,request_hash)
      VALUES($1,gen_random_uuid(),1,$2,'customer',$3,'2026-10-01T08:00Z',$4,0,$5,$6,'Test',gen_random_uuid(),repeat('a',64))`,
    [org, actors.employee.user, id, i % 2 ? '2026-10-01T08:54Z' : '2026-10-01T09:00Z', actors.admin.user, actors.admin.member]);
  }
  await db.query('UPDATE taptime_server.organizations SET locations_enabled=true,row_version=row_version+1 WHERE id=$1', [org]);
}, 60_000);
afterAll(async () => {
  if (created) await closePoolAndDropTestDatabase({ targetPool: db, installerPool: installer, databaseName }); else await db.end();
  await installer.end();
});

describe('T118 assignment commands in PostgreSQL', () => {
  it('protects the original assignment and permits only one active row per pair', async () => {
    await transaction('admin', 'taptime_admin_setup', async c => {
      await seedAssignment(c); await c.query('RESET ROLE');
      for (const sql of [
        `UPDATE taptime_server.target_assignments SET membership_id='${actors.admin.member}' WHERE organization_id='${org}'`,
        `DELETE FROM taptime_server.target_assignments WHERE organization_id='${org}'`,
        `INSERT INTO taptime_server.target_assignments(organization_id,membership_id,target_type,target_id,assigned_by)
         VALUES('${org}','${actors.employee.member}','customer','${customerA}','${actors.admin.member}')`,
      ]) {
        await c.query('SAVEPOINT rejected_change');
        await expect(c.query(sql)).rejects.toMatchObject({ code: sql.startsWith('INSERT') ? '23505' : '23514' });
        await c.query('ROLLBACK TO SAVEPOINT rejected_change');
      }
    });
  });
  it.each(['admin', 'manager'] as const)('%s assigns and ends customers and projects without erasing history', async who => {
    await transaction(who, 'taptime_admin_setup', async c => {
      for (const [targetType, targetId] of [['customer', customerA], ['project', projectA]]) {
        expect(await change(c, who, { targetType, targetId })).toEqual({ status: 'succeeded' });
        expect(await change(c, who, { targetType, targetId, assigned: false })).toEqual({ status: 'succeeded' });
        expect(await change(c, who, { targetType, targetId })).toEqual({ status: 'succeeded' });
      }
      await c.query('RESET ROLE');
      const rows = (await c.query('SELECT * FROM taptime_server.target_assignments WHERE organization_id=$1', [org])).rows;
      expect(rows).toHaveLength(4);
      expect(rows.filter(r => r.ended_at !== null)).toHaveLength(2);
      expect(rows.every(r => r.assigned_by === actors[who].member)).toBe(true);
      expect(rows.filter(r => r.ended_at !== null).every(r => r.ended_by === actors[who].member)).toBe(true);
    });
  });
  it('records no-ops, detects content conflicts and does not reapply an old command', async () => {
    await transaction('admin', 'taptime_admin_setup', async c => {
      const commandId = randomUUID();
      expect(await change(c, 'admin', { commandId, assigned: false })).toEqual({ status: 'succeeded' });
      expect(await change(c, 'admin', { commandId, assigned: false })).toEqual({ status: 'succeeded' });
      expect(await change(c, 'admin', { commandId, assigned: true })).toEqual({ status: 'command_id_conflict' });
      expect(await change(c)).toEqual({ status: 'succeeded' });
      expect(await change(c)).toEqual({ status: 'succeeded' });
      expect(await change(c, 'admin', { commandId, assigned: false })).toEqual({ status: 'succeeded' });
      await c.query('RESET ROLE');
      const rows = (await c.query('SELECT * FROM taptime_server.target_assignments WHERE organization_id=$1', [org])).rows;
      expect(rows).toHaveLength(1); expect(rows[0].ended_at).toBeNull();
    });
  });
  it.each([
    ['manager', { membershipId: actors.manager.member }, 'forbidden'],
    ['manager', { membershipId: actors.manager2.member }, 'forbidden'],
    ['manager', { membershipId: actors.admin.member }, 'forbidden'],
    ['manager', { membershipId: actors.manager.member, assigned: false }, 'forbidden'],
    ['manager', { membershipId: actors.manager2.member, assigned: false }, 'forbidden'],
    ['manager', { membershipId: actors.admin.member, assigned: false }, 'forbidden'],
    ['manager', { membershipId: actors.outside.member }, 'forbidden'],
    ['manager', { membershipId: actors.outside.member, assigned: false }, 'forbidden'],
    ['manager', { targetId: customerB }, 'forbidden'],
    ['manager', { targetId: unbound }, 'forbidden'],
    ['employee', {}, 'forbidden'],
    ['admin', { targetId: customerB }, 'target_not_selectable'],
    ['admin', { targetId: foreignCustomer }, 'forbidden'],
    ['admin', { membershipId: actors.foreign.member }, 'forbidden'],
    ['foreign', {}, 'forbidden'],
  ] as const)('%s rejects %j with %s', async (who, patch, status) => {
    await transaction(who, 'taptime_admin_setup', async c => expect(await change(c, who, patch)).toEqual({ status }));
  });
  it.each(['admin', 'manager'] as const)('administrator may assign to %s, including self', async person => {
    await transaction('admin', 'taptime_admin_setup', async c => {
      expect(await change(c, 'admin', { membershipId: actors[person].member })).toEqual({ status: 'succeeded' });
      const result = await query(c, { membershipId: actors[person].member });
      expect(result.items.map((item: any) => item.targetId)).toEqual([customerA]);
    });
  });
  it('allows ending after the target leaves the manager scope or is inactive', async () => {
    await transaction('manager', 'taptime_admin_setup', async c => {
      await seedAssignment(c, actors.employee.member, customerB);
      expect(await change(c, 'manager', { targetId: customerB, assigned: false })).toEqual({ status: 'succeeded' });
      await seedAssignment(c);
      await c.query('RESET ROLE');
      await c.query('UPDATE taptime_server.customers SET active=false,deactivated_at=transaction_timestamp(),row_version=row_version+1 WHERE id=$1', [customerA]);
      await c.query('SET LOCAL ROLE taptime_admin_setup');
      expect(await change(c, 'manager', { assigned: false })).toEqual({ status: 'succeeded' });
      await c.query('RESET ROLE');
      const ended = (await c.query('SELECT ended_at,ended_by FROM taptime_server.target_assignments WHERE organization_id=$1', [org])).rows;
      expect(ended).toHaveLength(2);
      expect(ended.every(row => row.ended_at !== null && row.ended_by === actors.manager.member)).toBe(true);
    });
  });
  it('keeps RLS forced, rejects direct runtime writes and enforces tenant keys', async () => {
    const tables = (await db.query(`SELECT relname,relrowsecurity,relforcerowsecurity FROM pg_class WHERE relnamespace='taptime_server'::regnamespace AND relkind='r'`)).rows;
    expect(tables.find(t => t.relname === 'target_assignments')).toBeDefined();
    expect(tables.every(t => t.relrowsecurity && t.relforcerowsecurity)).toBe(true);
    for (const role of ['taptime_admin_setup', 'taptime_mobile_target_reader', 'taptime_time_review_reader']) {
      expect((await db.query("SELECT has_table_privilege($1,'taptime_server.target_assignments','INSERT,UPDATE,DELETE') allowed", [role])).rows[0].allowed).toBe(false);
    }
    await expect(db.query(`INSERT INTO taptime_server.target_assignments(id,organization_id,membership_id,target_type,target_id,assigned_by)
      VALUES(gen_random_uuid(),$1,$2,'customer',$3,$4)`, [org, actors.foreign.member, customerA, actors.admin.member])).rejects.toMatchObject({ code: '23503' });
  });
});

describe('T118 assignment reads in PostgreSQL', () => {
  it.each([false, true])('marks and filters only still visible targets (backfill=%s)', async backfill => {
    const who = backfill ? 'admin' : 'employee';
    await transaction(who, 'taptime_admin_setup', async c => {
      await seedAssignment(c); await seedAssignment(c, actors.employee.member, customerB); await seedAssignment(c, actors.employee.member, projectA, 'project');
      const all = await targets(c, who, false, backfill), assigned = await targets(c, who, true, backfill);
      expect(assigned.map(r => r.target_id).sort()).toEqual([customerA, projectA].sort());
      expect(all.some(r => r.target_id === customerB)).toBe(false);
      expect(assigned.find(r => r.target_id === customerA).assigned).toBe(true);
      expect(all.some(r => r.assigned === false)).toBe(true);
      expect(assigned.every(r => r.assigned === true)).toBe(true);
    });
  });
  it('filters inactive targets and departed people without ending their assignment history', async () => {
    await transaction('admin', 'taptime_admin_setup', async c => {
      await seedAssignment(c); await seedAssignment(c, actors.outside.member);
      await c.query('RESET ROLE');
      await c.query('UPDATE taptime_server.memberships SET revoked_at=transaction_timestamp(),row_version=row_version+1 WHERE id=$1', [actors.outside.member]);
      await c.query('SET LOCAL ROLE taptime_admin_setup');
      expect((await query(c, { targetType: 'customer', targetId: customerA })).items.map((r: any) => r.membershipId)).toEqual([actors.employee.member]);
      await c.query('RESET ROLE');
      await c.query('UPDATE taptime_server.customers SET active=false,deactivated_at=transaction_timestamp(),row_version=row_version+1 WHERE id=$1', [customerA]);
      await c.query('SET LOCAL ROLE taptime_admin_setup');
      expect((await query(c, { membershipId: actors.employee.member })).items).toEqual([]);
      await c.query('RESET ROLE');
      expect((await c.query('SELECT * FROM taptime_server.target_assignments WHERE organization_id=$1 AND ended_at IS NULL', [org])).rows).toHaveLength(2);
    });
  });
  it('queries either side, searches with ICU and pages by name/id inside the management scope', async () => {
    await transaction('manager', 'taptime_admin_setup', async c => {
      await seedAssignment(c); await seedAssignment(c, actors.outside.member); await seedAssignment(c, actors.employee.member, projectA, 'project');
      for (const who of ['admin', 'manager', 'manager2'] as const) await seedAssignment(c, actors[who].member);
      expect((await query(c, { targetType: 'customer', targetId: customerA })).items.map((r: any) => r.membershipId)).toEqual([actors.employee.member]);
      expect((await query(c, { targetType: 'customer', targetId: customerA }, 'ÄN')).items.map((r: any) => r.membershipId)).toEqual([actors.employee.member]);
      const first = await query(c, { membershipId: actors.employee.member }, 'är', null, null, 1);
      expect(first.items).toHaveLength(1);
      const second = await query(c, { membershipId: actors.employee.member }, 'är', first.items[0].displayName, first.items[0].assignmentId, 1);
      expect(second.items).toHaveLength(1); expect(second.items[0].targetId).not.toBe(first.items[0].targetId);
      expect((await query(c, { membershipId: actors.employee.member }, 'missing')).items).toEqual([]);
    });
  });
  it.each([
    ['manager', { membershipId: actors.manager.member }], ['manager', { membershipId: actors.manager2.member }],
    ['manager', { membershipId: actors.admin.member }],
    ['manager', { membershipId: actors.outside.member }], ['manager', { targetType: 'customer', targetId: customerB }],
    ['employee', { membershipId: actors.employee.member }], ['admin', { targetType: 'customer', targetId: foreignCustomer }],
    ['foreign', { membershipId: actors.employee.member }],
  ] as const)('%s cannot query %j', async (who, selector) => {
    await transaction(who, 'taptime_admin_setup', async c => expect(await query(c, selector)).toEqual({ status: 'forbidden' }));
  });
});

describe('T118 quota SQL', () => {
  it.each(['admin', 'manager', 'employee'] as const)('filters before paging for %s with the same stages and visibility as v2', async who => {
    await transaction(who, 'taptime_mobile_own_time_reader', async c => {
      const old = (await c.query('SELECT taptime_server.read_customer_hours_v2($1,$2) result', [month.fromInclusive, month.toExclusive])).rows[0].result;
      const expected = old.customers.filter((row: any) => ['warning', 'exceeded'].includes(row.quotaStage));
      const collected: any[] = []; let name: string | null = null, id: string | null = null;
      do {
        const result: any = (await c.query('SELECT taptime_server.read_customer_quota_alerts_v1($1,$2,$3,$4,$5) result',
          [month.fromInclusive, month.toExclusive, name, id, 7])).rows[0].result;
        expect(result.scope).toBe(who === 'employee' ? 'self' : 'people');
        expect(result.customers.every((r: any) => ['warning', 'exceeded'].includes(r.quotaStage))).toBe(true);
        collected.push(...result.customers);
        if (result.customers.length < 7) break;
        const last = result.customers.at(-1); name = last.displayName; id = last.customerId;
        expect(collected.length).toBeLessThanOrEqual(quotaCustomers.length);
      } while (id);
      expect(collected.map(r => r.customerId).sort()).toEqual(expected.map((r: any) => r.customerId).sort());
      for (const item of collected) expect(item.quotaStage).toBe(expected.find((r: any) => r.customerId === item.customerId).quotaStage);
    });
  });
});

describe('T118 coordinator and quota seams', () => {
  it('bounds assignment pages in both directions and binds cursors to the selector and search', async () => {
    const bulkMembers: string[] = [];
    try {
      for (let i = 0; i < 40; i++) {
        const who = actor('employee'); await person(who, '😀'.repeat(120), locationA); bulkMembers.push(who.member);
        await db.query(`INSERT INTO taptime_server.target_assignments(organization_id,membership_id,target_type,target_id,assigned_by)
          VALUES($1,$2,'customer',$3,$4)`, [org, who.member, customerA, actors.admin.member]);
      }
      for (const target of quotaCustomers) await db.query(`INSERT INTO taptime_server.target_assignments(organization_id,membership_id,target_type,target_id,assigned_by)
        VALUES($1,$2,'customer',$3,$4)`, [org, actors.employee.member, target, actors.admin.member]);
      for (const selector of [{ membershipId: actors.employee.member }, { targetType: 'customer' as const, targetId: customerA }]) {
        const request = { expectedMembershipId: actors.manager.member, search: '😀', cursor: null, limit: 50, ...selector };
        const collected: any[] = []; let cursor: string | null = null, pages = 0;
        do {
          const result: any = await setup.queryTargetAssignments({ accessToken: 'manager', request: { ...request, cursor } });
          expect(result.status).toBe('succeeded');
          expect(Buffer.byteLength(JSON.stringify(result.response))).toBeLessThanOrEqual(14_336);
          collected.push(...result.response.items); cursor = result.response.nextCursor;
          expect(++pages).toBeLessThanOrEqual(quotaCustomers.length + bulkMembers.length);
          if (pages === 1) {
            expect(cursor).not.toBeNull();
            expect(await setup.queryTargetAssignments({ accessToken: 'manager', request: { ...request, search: 'different', cursor } })).toEqual({ status: 'invalid_request' });
            const other = 'membershipId' in selector ? { membershipId: actors.manager.member } : { targetType: 'project' as const, targetId: projectA };
            expect(await setup.queryTargetAssignments({ accessToken: 'manager', request: { expectedMembershipId: actors.manager.member, search: '😀', limit: 50, cursor, ...other } })).toEqual({ status: 'invalid_request' });
          }
        } while (cursor);
        expect(collected.map(row => row.targetId ?? row.membershipId).sort()).toEqual([...('membershipId' in selector ? quotaCustomers : bulkMembers)].sort());
        expect(new Set(collected.map(row => row.assignmentId)).size).toBe(collected.length);
      }
    } finally {
      await db.query(`UPDATE taptime_server.target_assignments SET ended_at=clock_timestamp(),ended_by=$2
        WHERE organization_id=$1 AND ended_at IS NULL AND (membership_id=ANY($3::uuid[]) OR target_id=ANY($4::uuid[]))`, [org, actors.admin.member, bulkMembers, quotaCustomers]);
    }
  });
  it('serializes concurrent repeats and rejects a receipt reused by another authorized actor', async () => {
    const command = changeRequest('admin', { targetType: 'project', targetId: projectA });
    const invoke = () => setup.changeTargetAssignment({ ...command, accessToken: 'admin' });
    expect(await Promise.all([invoke(), invoke()])).toEqual([{ status: 'succeeded' }, { status: 'succeeded' }]);
    try {
      expect((await db.query('SELECT * FROM taptime_server.target_assignments WHERE organization_id=$1 AND target_id=$2 AND ended_at IS NULL', [org, projectA])).rows).toHaveLength(1);
      expect(await setup.changeTargetAssignment({ ...command, expectedMembershipId: actors.manager.member, accessToken: 'manager' })).toEqual({ status: 'command_id_conflict' });
    } finally { await setup.changeTargetAssignment({ ...command, commandId: randomUUID(), assigned: false, accessToken: 'admin' }); }
  });
  it('round-trips assignment writes and both target markers through production coordinators', async () => {
    const command = changeRequest('admin');
    expect(await (setup as any).changeTargetAssignment({ ...command, accessToken: 'admin' })).toEqual({ status: 'succeeded' });
    try {
      for (const [kind, coordinator, token, fields, flag] of [
        ['work_targets', mobile, 'employee', {}, 'assignedToMe'],
        ['backfill_targets', review, 'admin', { targetMembershipId: actors.employee.member }, 'assignedToPerson'],
      ] as const) {
        const result = await (coordinator as any).querySearch(kind, { accessToken: token, request: {
          expectedMembershipId: actors[token].member, cursor: null, limit: 50, search: null, assignedOnly: true, ...fields } });
        expect(result.status).toBe('succeeded');
        expect(result.response.targets).toEqual([{ targetType: 'customer', targetId: customerA, displayName: 'Ärztehaus', [flag]: true }]);
      }
    } finally { await (setup as any).changeTargetAssignment({ ...command, accessToken: 'admin', commandId: randomUUID(), assigned: false }); }
  });
  it.each(['admin', 'manager', 'employee'] as const)('quota alerts match v2 for %s across all pages and stay below 14 KiB', async who => {
    const previous = await mobile.queryCustomerHours({ accessToken: who, request: { expectedMembershipId: actors[who].member, ...month, responseVersion: 'customer-hours.v2' } });
    expect(previous.status).toBe('succeeded');
    const expected = (previous as any).response.customers.filter((r: any) => ['warning', 'exceeded'].includes(r.quotaStage));
    const items: any[] = []; let cursor: string | null = null, count = 0;
    do {
      const result: any = await mobile.queryQuotaAlerts({ accessToken: who, request: { expectedMembershipId: actors[who].member, ...month, cursor, limit: 50 } });
      expect(result.status).toBe('succeeded');
      expect(result.response.scope).toBe(who === 'employee' ? 'self' : 'people');
      expect(Buffer.byteLength(JSON.stringify(result.response))).toBeLessThanOrEqual(14_336);
      items.push(...result.response.customers); cursor = result.response.nextCursor;
      expect(++count).toBeLessThanOrEqual(quotaCustomers.length + 1);
    } while (cursor);
    expect(items.map(r => r.customerId).sort()).toEqual(expected.map((r: any) => r.customerId).sort());
    for (const item of items) expect(item.quotaStage).toBe(expected.find((r: any) => r.customerId === item.customerId).quotaStage);
    if (who !== 'employee') { expect(items).toHaveLength(quotaCustomers.length); expect(count).toBeGreaterThan(1); }
  });
});
