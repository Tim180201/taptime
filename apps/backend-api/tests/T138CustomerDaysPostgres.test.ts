import { randomUUID } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import { beforeAll, afterAll, expect, it } from 'vitest';
import { ids, resetMigratePrepareAndSeed, tokens, verifier } from '../../backend-time-review/tests/fixtures.js';
import { MobileWorkReadCoordinator } from '../../backend-mobile-work/src/MobileWorkReadCoordinator.js';
import { SEARCH_PAGE_MAXIMUM_BYTES, type CustomerPersonDaysResponse } from '@taptime/mobile-work-contract';
import { parseSearchResponse } from '../../mobile/src/search/search.js';

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
  await resetMigratePrepareAndSeed(pool, 't138-synthetic');
  await pool.query(`INSERT INTO taptime_server.locations(id,organization_id,display_name) VALUES($1,$3,'A'),($2,$3,'B')`, [locationA, locationB, ids.organizationA]);
  for (const actor of [manager, other]) {
    await pool.query('INSERT INTO taptime_server.users(id) VALUES($1)', [actor.user]);
    await pool.query("INSERT INTO taptime_server.memberships(id,organization_id,user_id,role,display_name,created_at) VALUES($1,$2,$3,$4,$5,'2020-01-01T00:00Z')", [actor.member, actor.org, actor.user, actor.role, actor === manager ? 'Leitung A' : 'Person B']);
  }
  for (const actor of [admin, manager, employee, other]) await pool.query(`INSERT INTO taptime_server.membership_home_location_assignments(id,organization_id,membership_id,location_id,assigned_at) VALUES(gen_random_uuid(),$1,$2,$3,'2020-01-01T00:00Z')`, [actor.org, actor.member, actor === other ? locationB : locationA]);
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

async function days(c:PoolClient,actor:Actor=admin,target:string=employee.member,customer:string=ids.customerA,from='2026-10-01T00:00:00+02:00',to='2026-11-01T00:00:00+01:00') {
  await context(c,actor);
  return (await c.query('SELECT taptime_server.read_customer_person_days_v1($1,$2,$3,$4) AS result',[from,to,customer,target])).rows[0]!.result;
}
async function listed(c:PoolClient,actor:Actor=admin,customer:string=ids.customerA,from='2026-10-01T00:00:00+02:00',to='2026-11-01T00:00:00+01:00') {
  await context(c,actor);
  return (await c.query('SELECT taptime_server.read_customer_hours_detail_v1($1,$2,$3,NULL,NULL,50) AS result',[from,to,customer])).rows[0]!.result;
}
it('T138: days total equals the exact customer person row, including cross-home work',()=>transaction(async c=>{
  for(const actor of [admin,manager])for(const target of [employee,other]){
    const list=await listed(c,actor),result=await days(c,actor,target.member);
    expect(result.person).toEqual(list.people.find((p:any)=>p.membershipId===target.member));
    expect(result.days.reduce((sum:number,day:any)=>sum+day.workDurationSeconds,0)).toBe(result.person.workDurationSeconds);
    expect(result.days).toEqual([{date:'2026-10-10',workDurationSeconds:target===employee?3600:7200,running:false}]);
  }
}));
it('T138: foreign customers, foreign or unknown people and other employees all return indistinguishable not_found',()=>transaction(async c=>{
  for(const [actor,target,customer] of [[admin,foreign.member,ids.customerA],[admin,employee.member,ids.customerB],[admin,randomUUID(),ids.customerA],[manager,other.member,customerB],[employee,other.member,ids.customerA],[foreign,employee.member,ids.customerA]] as const){
    expect(await days(c,actor,target,customer)).toEqual({status:'not_found'});
  }
  expect((await days(c,employee)).days).toEqual([{date:'2026-10-10',workDurationSeconds:3600,running:false}]);
}));
it('T138: former people and deleted customers retain their customer hours without an expiry',()=>transaction(async c=>{
  await record(other,ids.customerA,'2024-02-10T08:00Z','2024-02-10T10:00Z',c);
  await c.query("UPDATE taptime_server.memberships SET revoked_at='2024-03-01T00:00Z',row_version=row_version+1 WHERE id=$1",[other.member]);
  const result=await days(c,manager,other.member,ids.customerA,'2024-02-01T00:00:00+01:00','2024-03-01T00:00:00+01:00');
  expect(result.person.workDurationSeconds).toBe(7200);
  expect(result.person).toEqual((await listed(c,manager,ids.customerA,'2024-02-01T00:00:00+01:00','2024-03-01T00:00:00+01:00')).people.find((p:any)=>p.membershipId===other.member));
  expect((await days(c,manager,employee.member,inactive)).days).toEqual([{date:'2026-10-12',workDurationSeconds:3600,running:false}]);
  expect(await days(c,manager,other.member,inactiveLastB)).toEqual({status:'not_found'});
}));
it.each([
  ['2026-10-31T23:30:00+01:00','2026-11-01T01:30:00+01:00','2026-10-01T00:00:00+02:00','2026-11-01T00:00:00+01:00','2026-10-31',7200],
  ['2026-10-25T01:30:00+02:00','2026-10-25T03:30:00+01:00','2026-10-01T00:00:00+02:00','2026-11-01T00:00:00+01:00','2026-10-25',10800],
  ['2027-03-28T01:30:00+01:00','2027-03-28T03:30:00+02:00','2027-03-01T00:00:00+01:00','2027-04-01T00:00:00+02:00','2027-03-28',3600],
])('T138: assigns %s to its Berlin start day across DST and month boundaries',(start,stop,from,to,date,seconds)=>transaction(async c=>{
  await record(employee,empty,String(start),String(stop),c);
  const result=await days(c,admin,employee.member,empty,String(from),String(to));
  expect(result.days).toEqual([{date,workDurationSeconds:seconds,running:false}]);
  expect(result.person).toEqual((await listed(c,admin,empty,String(from),String(to))).people.find((p:any)=>p.membershipId===employee.member));
}));
it('T138: an empty month stays an empty day view and a full month fits the response budget',()=>transaction(async c=>{
  const blank=await days(c,admin,employee.member,ids.customerA,'2026-11-01T00:00:00+01:00','2026-12-01T00:00:00+01:00');
  expect(blank.days).toEqual([]);expect(blank.person.workDurationSeconds).toBe(0);
  await c.query('RESET ROLE');
  for(let day=1;day<=31;day++)await record(employee,empty,`2026-10-${String(day).padStart(2,'0')}T08:00Z`,`2026-10-${String(day).padStart(2,'0')}T09:00Z`,c);
  const result=await days(c,admin,employee.member,empty);
  expect(result.days).toHaveLength(31);
  expect(Buffer.byteLength(JSON.stringify({...result,nextCursor:null}))).toBeLessThanOrEqual(SEARCH_PAGE_MAXIMUM_BYTES);
}));

it('T138: real coordinator and client agree on bounded pages, identity and not_found',async()=>{
  for(let day=1;day<=31;day++)await record(employee,empty,`2026-10-${String(day).padStart(2,'0')}T08:00Z`,`2026-10-${String(day).padStart(2,'0')}T09:00Z`);
  const coordinator=new MobileWorkReadCoordinator(pool,pool,verifier,Buffer.alloc(32,138).toString('base64url'));
  const base={expectedMembershipId:admin.member,customerId:empty,targetMembershipId:employee.member,
    fromInclusive:'2026-09-30T22:00:00.000Z',toExclusive:'2026-10-31T23:00:00.000Z',limit:7};
  let cursor:string|null=null;
  const dates:string[]=[];
  do {
    const request={...base,cursor};
    const result=await coordinator.querySearch('customer_person_days',{accessToken:tokens.adminA,request});
    expect(result.status).toBe('succeeded');if(result.status!=='succeeded')throw new Error(result.status);
    const page:CustomerPersonDaysResponse=result.response;
    expect(parseSearchResponse('customer_person_days',page,request)).toEqual(page);
    expect(page.person.workDurationSeconds).toBe(31*3600);
    expect(Buffer.byteLength(JSON.stringify(page))).toBeLessThanOrEqual(SEARCH_PAGE_MAXIMUM_BYTES);
    expect(page.days.length).toBeLessThanOrEqual(request.limit);
    dates.push(...page.days.map(d=>d.date));cursor=page.nextCursor;
    if(cursor)expect(await coordinator.querySearch('customer_person_days',{accessToken:tokens.adminA,request:{...request,cursor,targetMembershipId:other.member}})).toEqual({status:'invalid_request'});
  }while(cursor);
  expect(dates).toEqual(Array.from({length:31},(_,i)=>`2026-10-${String(i+1).padStart(2,'0')}`));
  for(const targetMembershipId of [foreign.member,randomUUID(),manager.member])
    expect(await coordinator.querySearch('customer_person_days',{accessToken:tokens.adminA,request:{...base,cursor:null,targetMembershipId}})).toEqual({status:'not_found'});
  expect(await coordinator.querySearch('customer_person_days',{accessToken:tokens.employeeA,request:{...base,expectedMembershipId:employee.member,targetMembershipId:other.member,cursor:null}})).toEqual({status:'not_found'});
});
it('T138: live scope changes and revoked actors cannot keep their read authority',()=>transaction(async c=>{
  await c.query('UPDATE taptime_server.membership_management_location_grants SET revoked_at=clock_timestamp() WHERE membership_id=$1',[manager.member]);
  expect(await days(c,manager)).toEqual({status:'not_found'});
  await c.query('RESET ROLE');
  await c.query('UPDATE taptime_server.memberships SET revoked_at=clock_timestamp(),row_version=row_version+1 WHERE id=$1',[employee.member]);
  await expect(days(c,employee)).rejects.toMatchObject({code:'42501'});
}));

it('T138: a running entry and its day use the same transaction time as the person row',()=>transaction(async c=>{
  const from='2026-07-01T00:00:00+02:00',to='2026-08-01T00:00:00+02:00';
  const result=await days(c,admin,employee.member,ids.customerA,from,to);
  expect(result.person).toEqual((await listed(c,admin,ids.customerA,from,to)).people.find((p:any)=>p.membershipId===employee.member));
  expect(result.person.running).toBe(true);
  expect(result.days.find((d:any)=>d.date==='2026-07-21').running).toBe(true);
  expect(result.days.reduce((sum:number,d:any)=>sum+d.workDurationSeconds,0)).toBe(result.person.workDurationSeconds);
}));
