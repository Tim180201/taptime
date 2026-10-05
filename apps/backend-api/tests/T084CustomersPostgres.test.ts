import { randomUUID } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import { beforeAll, afterAll, expect, it } from 'vitest';
import { ids, resetMigratePrepareAndSeed } from '../../backend-time-review/tests/fixtures.js';

const pool = new Pool({ connectionString: process.env.C2_DATABASE_URL ?? 'postgresql://timbartz@127.0.0.1:5432/taptime_da3' });
const locationA = randomUUID(), locationB = randomUUID(), customerB = randomUUID(), empty = randomUUID(), inactive = randomUUID(), inactiveEmpty = randomUUID();
const inactiveLastB = randomUUID(), inactiveNeverBound = randomUUID();
interface Actor {user: string; member: string; role: string; org: string}
const manager = { user: randomUUID(), member: randomUUID(), role: 'standortleitung', org: ids.organizationA };
const employee = { user: ids.employeeA, member: ids.membershipEmployeeA, role: 'employee', org: ids.organizationA };
const other = { user: randomUUID(), member: randomUUID(), role: 'employee', org: ids.organizationA };
const admin = { user: ids.adminA, member: ids.membershipAdminA, role: 'administrator', org: ids.organizationA };
const foreign = { user: ids.adminB, member: ids.membershipAdminB, role: 'administrator', org: ids.organizationB };
async function context(c: PoolClient, actor: Actor = admin, role = 'taptime_mobile_own_time_reader') {
  await c.query('RESET ROLE');
  await c.query(`SELECT set_config('app.organization_id',$1,true),set_config('app.user_id',$2,true),set_config('app.membership_id',$3,true),set_config('app.membership_role',$4,true)`, [actor.org, actor.user, actor.member, actor.role]);
  await c.query(`SET LOCAL ROLE ${role}`);
}
async function read(c: PoolClient, actor: Actor = admin, from = '2026-10-01T00:00:00+02:00', to = '2026-11-01T00:00:00+01:00') {
  await context(c, actor);
  return (await c.query('SELECT taptime_server.read_customer_hours_v1($1::timestamptz,$2::timestamptz) AS result', [from, to])).rows[0]!.result;
}
async function transaction(run: (c: PoolClient) => Promise<void>) {
  const c = await pool.connect();
  try { await c.query('BEGIN'); await run(c); } finally { await c.query('ROLLBACK'); c.release(); }
}
async function record(actor: Actor, customer: string, start: string, stop: string, db: Pool | PoolClient = pool) {
  await db.query(`INSERT INTO taptime_server.time_record_revisions(organization_id,time_record_id,revision_number,user_id,target_type,target_customer_id,
    effective_started_at,effective_stopped_at,base_row_version,actor_user_id,actor_membership_id,reason,command_id,request_hash)
    VALUES($1,$2,1,$3,'customer',$4,$5,$6,0,$7,$8,'Nachgetragen',$9,repeat('a',64))`,
  [actor.org, randomUUID(), actor.user, customer, start, stop, actor.org === ids.organizationA ? admin.user : foreign.user, actor.org === ids.organizationA ? admin.member : foreign.member, randomUUID()]);
}
beforeAll(async () => {
  await resetMigratePrepareAndSeed(pool, 't084-synthetic');
  await pool.query(`INSERT INTO taptime_server.locations(id,organization_id,display_name) VALUES($1,$3,'A'),($2,$3,'B')`, [locationA, locationB, ids.organizationA]);
  for (const actor of [manager, other]) {
    await pool.query('INSERT INTO taptime_server.users(id) VALUES($1)', [actor.user]);
    await pool.query('INSERT INTO taptime_server.memberships(id,organization_id,user_id,role,display_name) VALUES($1,$2,$3,$4,$5)', [actor.member, actor.org, actor.user, actor.role, actor === manager ? 'Leitung A' : 'Person B']);
  }
  for (const actor of [admin, manager, employee, other]) await pool.query(`INSERT INTO taptime_server.membership_home_location_assignments(id,organization_id,membership_id,location_id) VALUES(gen_random_uuid(),$1,$2,$3)`, [actor.org, actor.member, actor === other ? locationB : locationA]);
  await pool.query(`INSERT INTO taptime_server.membership_management_location_grants(id,organization_id,membership_id,location_id) VALUES(gen_random_uuid(),$1,$2,$3)`, [manager.org, manager.member, locationA]);
  for (const [id, name] of [[customerB, 'Kunde B'], [empty, 'Ohne Stunden'], [inactive, 'Historisch'], [inactiveEmpty, 'Stillgelegt ohne Stunden'], [inactiveLastB, 'Historisch zuletzt B'], [inactiveNeverBound, 'Historisch nie gebunden']]) await pool.query(`INSERT INTO taptime_server.customers(id,organization_id,display_name,active,activated_at) VALUES($1,$2,$3,true,clock_timestamp())`, [id, ids.organizationA, name]);
  await pool.query(`INSERT INTO taptime_server.work_target_location_assignments(id,organization_id,target_type,target_id,location_id,assigned_at)
    SELECT gen_random_uuid(),organization_id,target_type,target_id,CASE WHEN target_id=$2 THEN $3::uuid ELSE $4::uuid END,'2026-01-01T00:00Z'
    FROM taptime_server.work_targets WHERE organization_id=$1 AND active AND target_id<>$5`, [ids.organizationA, customerB, locationB, locationA, inactiveNeverBound]);
  // The latest assignment, not an entry's accepted location or an older A binding, wins.
  await pool.query(`UPDATE taptime_server.work_target_location_assignments SET revoked_at='2026-02-01T00:00Z' WHERE target_id=$1`, [inactiveLastB]);
  await pool.query(`INSERT INTO taptime_server.work_target_location_assignments(id,organization_id,target_type,target_id,location_id,assigned_at)
    VALUES('00000000-0000-4000-8000-000000000001',$1,'customer',$2,$3,'2026-02-01T00:00Z')`, [ids.organizationA, inactiveLastB, locationB]);
  await pool.query(`INSERT INTO taptime_server.work_target_location_assignments(id,organization_id,target_type,target_id,location_id,assigned_at,revoked_at)
    VALUES(gen_random_uuid(),$1,'customer',$2,$3,'2025-12-01T00:00Z','2026-01-01T00:00Z')`, [ids.organizationA, inactive, locationB]);
  await record(employee, ids.customerA, '2026-10-10T08:00Z', '2026-10-10T09:00Z');
  await record(other, ids.customerA, '2026-10-10T10:00Z', '2026-10-10T12:00Z');
  await record(other, customerB, '2026-10-11T08:00Z', '2026-10-11T12:00Z');
  await record(employee, inactive, '2026-10-12T08:00Z', '2026-10-12T09:00Z');
  await record(employee, inactiveLastB, '2026-10-13T08:00Z', '2026-10-13T09:00Z');
  await record(other, inactiveLastB, '2026-10-13T10:00Z', '2026-10-13T12:00Z');
  await record(employee, inactiveNeverBound, '2026-10-14T08:00Z', '2026-10-14T09:00Z');
  await record(foreign, ids.customerB, '2026-10-12T08:00Z', '2026-10-12T17:00Z');
  await pool.query('UPDATE taptime_server.customers SET active=false,deactivated_at=clock_timestamp(),row_version=row_version+1 WHERE id=ANY($1::uuid[])', [[inactive, inactiveEmpty, inactiveLastB, inactiveNeverBound]]);
  await pool.query('UPDATE taptime_server.organizations SET locations_enabled=true,row_version=row_version+1 WHERE id=$1', [ids.organizationA]);
});
afterAll(() => pool.end());
it('administrator sees all customers and people in the tenant, including B hours at A', () => transaction(async c => {
  const result = await read(c);
  expect(result.scope).toBe('people');
  expect(result.customers.map((r: any) => r.customerId)).toEqual(expect.arrayContaining([ids.customerA, customerB, empty, inactive]));
  expect(result.customers.map((r: any) => r.customerId)).not.toEqual(expect.arrayContaining([ids.customerB]));
  expect(result.customers.find((r: any) => r.customerId === ids.customerA)).toMatchObject({ workDurationSeconds: 10800, people: expect.arrayContaining([{ membershipId: other.member, displayName: 'Person B', workDurationSeconds: 7200, running: false }]) });
}));
it('manager sees customer A including person B, never customer B', () => transaction(async c => {
  const result = await read(c, manager);
  expect(result.customers.map((r: any) => r.customerId)).not.toContain(customerB);
  expect(result.customers.find((r: any) => r.customerId === ids.customerA)).toMatchObject({ workDurationSeconds: 10800, people: expect.arrayContaining([expect.objectContaining({ membershipId: other.member, workDurationSeconds: 7200 })]) });
}));
it('employee sees only own seconds, daily details and zero, even with a forged role hint', () => transaction(async c => {
  const result = await read(c, { ...employee, role: 'administrator' });
  expect(result.scope).toBe('self');
  expect(result.customers.find((r: any) => r.customerId === ids.customerA)).toMatchObject({ workDurationSeconds: 3600, days: [{ date: '2026-10-10', workDurationSeconds: 3600, running: false }] });
  expect(result.customers.find((r: any) => r.customerId === empty).workDurationSeconds).toBe(0);
  expect(result.customers.every((r: any) => !('people' in r))).toBe(true);
  expect(JSON.stringify(result)).not.toContain(other.member);
  expect(result.customers.map((r: any) => r.customerId)).not.toContain(customerB);
}));
it('disabled locations allow employee all active customers and manager no scope', () => transaction(async c => {
  await c.query('UPDATE taptime_server.organizations SET locations_enabled=false,row_version=row_version+1 WHERE id=$1', [ids.organizationA]);
  expect((await read(c, employee)).customers.map((r: any) => r.customerId)).toContain(customerB);
  expect((await read(c, manager)).customers).toEqual([]);
}));
it('isolates tenants and rejects a mismatched session membership', () => transaction(async c => {
  expect((await read(c, foreign)).customers.map((r: any) => r.customerId)).toEqual([ids.customerB]);
  await expect(read(c, { ...employee, member: foreign.member })).rejects.toMatchObject({ code: '42501' });
}));
it('D099 employee sees a previously bound inactive customer across locations, with only own hours', () => transaction(async c => {
  const result = await read(c, {...employee, role:'administrator'});
  expect(result.scope).toBe('self');
  expect(result.customers.find((r:any)=>r.customerId===inactiveLastB)).toEqual({
    customerId:inactiveLastB,displayName:'Historisch zuletzt B',active:false,workDurationSeconds:3600,running:false,
    days:[{date:'2026-10-13',workDurationSeconds:3600,running:false}],
  });
  expect(result.customers.every((r:any)=>!('people' in r))).toBe(true);
  expect(JSON.stringify(result)).not.toContain(other.member);
  expect((await read(c, other)).customers.map((r: any) => r.customerId)).not.toContain(inactive);
  expect((await read(c)).customers.map((r: any) => r.customerId)).not.toContain(inactiveEmpty);
}));
it('D099 manager uses the latest customer binding and current grants', () => transaction(async c => {
  const result = await read(c, manager);
  expect(result.customers.find((r:any)=>r.customerId===inactive)).toMatchObject({active:false,workDurationSeconds:3600});
  expect(result.customers.map((r:any)=>r.customerId)).not.toContain(inactiveLastB);
  await c.query('RESET ROLE');
  await c.query('UPDATE taptime_server.membership_management_location_grants SET revoked_at=clock_timestamp() WHERE membership_id=$1', [manager.member]);
  expect((await read(c, manager)).customers).toEqual([]);
}));
it.each([true,false])('T100 never-bound inactive customer retains own hours without granting manager or other employee access, locations enabled=%s', enabled => transaction(async c => {
  if (!enabled) await c.query('UPDATE taptime_server.organizations SET locations_enabled=false,row_version=row_version+1 WHERE id=$1', [ids.organizationA]);
  expect((await read(c)).customers.map((r:any)=>r.customerId)).toContain(inactiveNeverBound);
  expect((await read(c,employee)).customers.find((r:any)=>r.customerId===inactiveNeverBound)).toMatchObject({active:false,workDurationSeconds:3600,days:[{date:'2026-10-14',workDurationSeconds:3600,running:false}]});
  for (const actor of [other,manager]) expect((await read(c,actor)).customers.map((r:any)=>r.customerId)).not.toContain(inactiveNeverBound);
}));
it.each([admin,manager,employee])('D099 inactive customers disappear without visible hours in the chosen month for $role', actor => transaction(async c => {
  const result=await read(c,actor,'2026-11-01T00:00:00+01:00','2026-12-01T00:00:00+01:00');
  expect(result.customers.every((r:any)=>r.active)).toBe(true);
}));
it.each([true,false])('D099 breaks equal assignment timestamps by descending ID, latest at A=%s', atA => transaction(async c => {
  const customer=randomUUID();
  await c.query(`INSERT INTO taptime_server.customers(id,organization_id,display_name,active,activated_at) VALUES($1,$2,'Zeitgleich',true,clock_timestamp())`,[customer,ids.organizationA]);
  await c.query(`INSERT INTO taptime_server.work_target_location_assignments(id,organization_id,target_type,target_id,location_id,assigned_at,revoked_at)
    VALUES('00000000-0000-4000-8000-000000000002',$1,'customer',$2,$3,'2026-01-01T00:00Z','2026-02-01T00:00Z'),
          ('ffffffff-ffff-4fff-8fff-ffffffffffff',$1,'customer',$2,$4,'2026-01-01T00:00Z','2026-02-01T00:00Z')`,
    [ids.organizationA,customer,atA?locationB:locationA,atA?locationA:locationB]);
  await record(employee,customer,'2026-10-15T08:00Z','2026-10-15T09:00Z',c);
  await c.query('UPDATE taptime_server.customers SET active=false,deactivated_at=clock_timestamp(),row_version=row_version+1 WHERE id=$1',[customer]);
  expect((await read(c,manager)).customers.some((r:any)=>r.customerId===customer)).toBe(atA);
}));
it.each([['2026-10-01T00:00:00Z','2026-11-01T00:00:00Z'], [null,null], ['2026-10-01T00:00:00+02:00','2026-12-01T00:00:00+01:00']])('rejects non-Berlin or unbounded month %s', (from,to) => transaction(async c => {
  await context(c);
  await expect(c.query('SELECT taptime_server.read_customer_hours_v1($1,$2)', [from,to])).rejects.toMatchObject({ code: '22023' });
}));

it.each([
  ['2026-10-31T23:30:00+01:00','2026-11-01T01:30:00+01:00','2026-10-01T00:00:00+02:00','2026-11-01T00:00:00+01:00',7200],
  ['2026-10-25T01:30:00+02:00','2026-10-25T03:30:00+01:00','2026-10-01T00:00:00+02:00','2026-11-01T00:00:00+01:00',10800],
  ['2027-03-28T01:30:00+01:00','2027-03-28T03:30:00+02:00','2027-03-01T00:00:00+01:00','2027-04-01T00:00:00+02:00',3600],
])('uses entry start month and real elapsed seconds across %s', (start,stop,from,to,seconds) => transaction(async c => {
  await c.query(`INSERT INTO taptime_server.time_record_revisions(organization_id,time_record_id,revision_number,user_id,target_type,target_customer_id,
    effective_started_at,effective_stopped_at,base_row_version,actor_user_id,actor_membership_id,reason,command_id,request_hash)
    VALUES($1,$2,1,$3,'customer',$4,$5,$6,0,$7,$8,'Nachgetragen',$9,repeat('a',64))`,
    [ids.organizationA,randomUUID(),employee.user,empty,start,stop,admin.user,admin.member,randomUUID()]);
  expect((await read(c,employee,String(from),String(to))).customers.find((r:any)=>r.customerId===empty).workDurationSeconds).toBe(seconds);
  expect((await read(c,employee,'2026-11-01T00:00:00+01:00','2026-12-01T00:00:00+01:00')).customers.find((r:any)=>r.customerId===empty).workDurationSeconds).toBe(0);
}));
it('runtime cannot call the internal calculation to read foreign pauses', () => transaction(async c => {
  await context(c, employee);
  await expect(c.query(`SELECT * FROM taptime_server.time_record_duration_v1($1,$2,now(),now())`,[ids.organizationB,ids.activeEntryA])).rejects.toMatchObject({code:'42501'});
}));
it('uses current grants and home assignment on every read', () => transaction(async c => {
  await c.query('UPDATE taptime_server.membership_management_location_grants SET revoked_at=clock_timestamp() WHERE membership_id=$1', [manager.member]);
  expect((await read(c, manager)).customers).toEqual([]);
  await c.query('RESET ROLE');
  await c.query('UPDATE taptime_server.membership_home_location_assignments SET revoked_at=clock_timestamp() WHERE membership_id=$1', [employee.member]);
  const result=await read(c, employee);
  expect(result.customers.every((r:any)=>!r.active)).toBe(true);
  expect(result.customers.map((r:any)=>r.customerId)).toEqual(expect.arrayContaining([inactive,inactiveLastB]));
}));
it('rejects a revoked membership even with a previously valid session', () => transaction(async c => {
  await c.query('UPDATE taptime_server.memberships SET revoked_at=clock_timestamp(),row_version=row_version+1 WHERE id=$1', [employee.member]);
  await expect(read(c, employee)).rejects.toMatchObject({code:'42501'});
}));
it('ignores project and general work', () => transaction(async c => {
  const project=randomUUID();
  await c.query(`INSERT INTO taptime_server.projects(id,organization_id,display_name) VALUES($1,$2,'Projekt')`,[project,ids.organizationA]);
  const targets=await c.query(`SELECT target_type,target_id FROM taptime_server.work_targets WHERE organization_id=$1 AND target_type IN ('project','general_work')`,[ids.organizationA]);
  for (const target of targets.rows) await c.query(`INSERT INTO taptime_server.time_record_revisions(organization_id,time_record_id,revision_number,user_id,target_type,target_customer_id,
    effective_started_at,effective_stopped_at,base_row_version,actor_user_id,actor_membership_id,reason,command_id,request_hash)
    VALUES($1,$2,1,$3,$7,$8,'2026-10-11T12:00Z','2026-10-11T14:00Z',0,$4,$5,'Nachgetragen',$6,repeat('b',64))`,
    [ids.organizationA,randomUUID(),employee.user,admin.user,admin.member,randomUUID(),target.target_type,target.target_id]);
  const result = await read(c, employee);
  expect(result.customers.find((r:any)=>r.customerId===ids.customerA).workDurationSeconds).toBe(3600);
  expect(result.customers.find((r:any)=>r.customerId===empty).workDurationSeconds).toBe(0);
}));
