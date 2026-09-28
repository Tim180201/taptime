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
  return (await c.query('SELECT taptime_server.read_customer_hours_v2($1::timestamptz,$2::timestamptz) AS result', [from, to])).rows[0]!.result;
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
  await resetMigratePrepareAndSeed(pool, 't085-synthetic');
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
async function set(c: PoolClient, actor: Actor, customer:string=ids.customerA, minutes: number|null=2400, command=randomUUID()) {
  await context(c, actor, 'taptime_admin_setup');
  return (await c.query('SELECT taptime_server.set_customer_quota_v1($1,$2,$3) AS result',[customer,minutes,command])).rows[0]!.result;
}
it('administrator sets, changes and removes with immutable history and real actor',()=>transaction(async c=>{
  for(const minutes of [2400,3000,null]) expect(await set(c,admin,ids.customerA,minutes)).toBe('succeeded');
  await c.query('RESET ROLE');
  const rows=(await c.query('SELECT minutes,actor_membership_id,actor_role FROM taptime_server.customer_quota_settings ORDER BY sequence')).rows;
  expect(rows.map(r=>r.minutes)).toEqual([2400,3000,null]);
  expect(rows.every(r=>r.actor_membership_id===admin.member && r.actor_role==='administrator')).toBe(true);
  expect((await read(c)).customers.find((r:any)=>r.customerId===ids.customerA)).toMatchObject({quotaSeconds:null,quotaStage:'none'});
}));
it('manager writes only active customers in their current managed location',()=>transaction(async c=>{
  expect(await set(c,manager)).toBe('succeeded');
  await c.query('RESET ROLE');
  expect((await c.query('SELECT actor_role FROM taptime_server.customer_quota_settings')).rows[0].actor_role).toBe('standortleitung');
  await expect(set(c,manager,customerB)).rejects.toMatchObject({code:'42501'});
}));
it.each(['revoked','disabled','inactive'])('manager denied after %s',mode=>transaction(async c=>{
  if(mode==='revoked') await c.query('UPDATE taptime_server.membership_management_location_grants SET revoked_at=now() WHERE membership_id=$1',[manager.member]);
  if(mode==='disabled') await c.query('UPDATE taptime_server.organizations SET locations_enabled=false,row_version=row_version+1 WHERE id=$1',[ids.organizationA]);
  await expect(set(c,manager,mode==='inactive'?inactive:ids.customerA)).rejects.toMatchObject({code:'42501'});
}));
it.each([employee,{...employee,role:'administrator'},foreign])('employee, forged hint and other tenant cannot write',actor=>transaction(async c=>{
  await expect(set(c,actor)).rejects.toMatchObject({code:'42501'});
}));
it('direct INSERT is guarded by RLS for employee with setup capability',()=>transaction(async c=>{
  await context(c,employee,'taptime_admin_setup');
  await expect(c.query(`INSERT INTO taptime_server.customer_quota_settings(organization_id,customer_id,minutes,actor_membership_id,actor_role,command_id)
    VALUES($1,$2,30,$3,'employee',$4)`,[employee.org,ids.customerA,employee.member,randomUUID()])).rejects.toMatchObject({code:'42501'});
}));
it('retry is idempotent and conflicting values or actors conflict',()=>transaction(async c=>{
  const command=randomUUID();
  expect(await set(c,admin,ids.customerA,30,command)).toBe('succeeded');
  expect(await set(c,admin,ids.customerA,30,command)).toBe('succeeded');
  expect(await set(c,admin,ids.customerA,60,command)).toBe('command_id_conflict');
  expect(await set(c,manager,ids.customerA,30,command)).toBe('command_id_conflict');
  await c.query('RESET ROLE');
  expect((await c.query('SELECT * FROM taptime_server.customer_quota_settings')).rowCount).toBe(1);
}));
it.each([0,29,31,44641])('invalid minutes %s rejected',minutes=>transaction(async c=>{
  await expect(set(c,admin,ids.customerA,minutes)).rejects.toMatchObject({code:'22023'});
}));
it('month history uses latest setting before exclusive Berlin end, removal retained',()=>transaction(async c=>{
  for(const [at,minutes] of [['2026-09-15T10:00Z',2400],['2026-10-15T10:00Z',3000],['2026-10-31T23:00Z',null]])
    await c.query(`INSERT INTO taptime_server.customer_quota_settings(organization_id,customer_id,minutes,set_at,actor_membership_id,actor_role,command_id)
      VALUES($1,$2,$3,$4,$5,'administrator',$6)`,[admin.org,ids.customerA,minutes,at,admin.member,randomUUID()]);
  for(const [from,to,seconds] of [['2026-09-01T00:00+02:00','2026-10-01T00:00+02:00',144000],['2026-10-01T00:00+02:00','2026-11-01T00:00+01:00',180000],['2026-11-01T00:00+01:00','2026-12-01T00:00+01:00',null]])
    expect((await read(c,admin,String(from),String(to))).customers.find((r:any)=>r.customerId===ids.customerA).quotaSeconds).toBe(seconds);
}));
it.each([[323964,'ok'],[324000,'warning'],[360000,'exceeded']])('exact threshold at %s seconds', (seconds,stage)=>transaction(async c=>{
  await set(c,admin,empty,6000);
  await c.query('RESET ROLE');
  await record(employee,empty,'2026-10-10T00:00Z',new Date(Date.parse('2026-10-10T00:00Z')+Number(seconds)*1000).toISOString(),c);
  expect((await read(c)).customers.find((r:any)=>r.customerId===empty)).toMatchObject({quotaSeconds:360000,quotaStage:stage});
}));
it('employees receive no quota fields, even with forged role; tenants cannot read settings',()=>transaction(async c=>{
  await set(c,admin);
  const result=await read(c,{...employee,role:'administrator'});
  expect(result.scope).toBe('self');
  expect(JSON.stringify(result)).not.toMatch(/quota|warning|exceeded/);
  await context(c,foreign,'taptime_admin_setup');
  expect((await c.query('SELECT * FROM taptime_server.customer_quota_settings')).rows).toEqual([]);
}));
it.each(['UPDATE taptime_server.customer_quota_settings SET minutes=60','DELETE FROM taptime_server.customer_quota_settings'])('append-only even for owner: %s',sql=>transaction(async c=>{
  await set(c,admin);await c.query('RESET ROLE');
  await expect(c.query(sql)).rejects.toMatchObject({code:'55000'});
}));
it('includes running seconds in quota stage and keeps v1 byte shape',()=>transaction(async c=>{
  await c.query(`INSERT INTO taptime_server.customer_quota_settings(organization_id,customer_id,minutes,set_at,actor_membership_id,actor_role,command_id)
    VALUES($1,$2,30,'2020-01-01Z',$3,'administrator',$4)`,[admin.org,ids.customerA,admin.member,randomUUID()]);
  const bounds=(await c.query(`SELECT date_trunc('month',started_at AT TIME ZONE 'Europe/Berlin') AT TIME ZONE 'Europe/Berlin' AS start,
    (date_trunc('month',started_at AT TIME ZONE 'Europe/Berlin')+interval '1 month') AT TIME ZONE 'Europe/Berlin' AS stop FROM taptime_server.time_entries WHERE id=$1`,[ids.activeEntryA])).rows[0];
  const value=await read(c,admin,bounds.start.toISOString(),bounds.stop.toISOString());
  expect(value.customers.find((r:any)=>r.customerId===ids.customerA)).toMatchObject({running:true,quotaSeconds:1800,quotaStage:'exceeded'});
  const old=(await c.query('SELECT taptime_server.read_customer_hours_v1($1,$2) AS value',[bounds.start,bounds.stop])).rows[0].value;
  expect(old.version).toBe('customer-hours.v1');expect(JSON.stringify(old)).not.toContain('quota');
}));
it('RLS itself permits only a current manager in the customer location',()=>transaction(async c=>{
  await context(c,manager,'taptime_admin_setup');
  const command=randomUUID();
  await c.query("SELECT set_config('app.correlation_id',$1,true)",[command]);
  const sql=`INSERT INTO taptime_server.customer_quota_settings(organization_id,customer_id,minutes,actor_membership_id,actor_role,command_id) VALUES($1,$2,30,$3,'standortleitung',$4)`;
  await c.query(sql,[manager.org,ids.customerA,manager.member,command]);
  const otherCommand=randomUUID();await c.query("SELECT set_config('app.correlation_id',$1,true)",[otherCommand]);
  await expect(c.query(sql,[manager.org,customerB,manager.member,otherCommand])).rejects.toMatchObject({code:'42501'});
}));
it('administration coordinator uses the live actor and database quota command end to end',async()=>{
  const {AdminWriteSessionCoordinator}=await import('../../backend-administration/src/index.js');
  const {verifier,tokens}=await import('../../backend-time-review/tests/fixtures.js');
  const coordinator=new AdminWriteSessionCoordinator(pool,verifier),commandId=randomUUID();
  const command={accessToken:tokens.adminA,expectedMembershipId:admin.member,customerId:ids.customerA,minutes:2400,commandId};
  expect(await coordinator.setCustomerQuota(command)).toEqual({status:'succeeded'});
  expect(await coordinator.setCustomerQuota(command)).toEqual({status:'succeeded'});
  expect(await coordinator.setCustomerQuota({...command,minutes:3000})).toEqual({status:'command_id_conflict'});
  expect(await coordinator.setCustomerQuota({...command,accessToken:tokens.employeeA,expectedMembershipId:employee.member,commandId:randomUUID()})).toEqual({status:'forbidden'});
  expect(await coordinator.setCustomerQuota({...command,customerId:ids.customerB,commandId:randomUUID()})).toEqual({status:'forbidden'});
});
