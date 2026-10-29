import { randomUUID } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { MembershipId } from '@taptime/core';
import type { AccessTokenVerifier } from '@taptime/backend-identity';
import { EmployeeMembershipEnrollmentCoordinator } from '../../backend-administration/src/EmployeeMembershipEnrollmentCoordinator.js';
import { AdministrationStopCoordinator } from '../../backend-time-review/src/AdministrationStopCoordinator.js';
import { TimeSupplementCoordinator } from '../../backend-time-review/src/TimeSupplementCoordinator.js';
import { definerFindings, tenantPolicyFindings } from '../../backend-schema/tests/support/catalogSecurity.js';
import { applyMigrationSet, loadMigrations } from '../../backend-schema/src/index.js';
import { closePoolAndDropTestDatabase } from '../../backend-schema/tests/support/postgresTestDatabaseCleanup.mjs';

const connectionString = process.env.B3_DATABASE_URL ?? 'postgresql://timbartz@127.0.0.1:5432/taptime_b3';
const installer = new Pool({ connectionString, max: 1 });
const databaseName = `t123_${randomUUID().replaceAll('-', '')}`;
const url = new URL(connectionString); url.pathname = `/${databaseName}`;
const db = new Pool({ connectionString: url.href, max: 4 });
let created = false;
const org = randomUUID(), otherOrg = randomUUID(), customer = randomUUID();
const actor = (role: string, organizationId = org) => ({ userId: randomUUID(), membershipId: randomUUID(), organizationId, role });
const admin = actor('administrator'), manager = actor('standortleitung'), employee = actor('employee'),
  departed = actor('employee'), foreign = actor('administrator', otherOrg);
const actors = { admin, manager, employee, departed, foreign };
async function asRole<T>(role: string, who: typeof admin, work: (client: PoolClient) => Promise<T>, command = randomUUID()) {
  const client = await db.connect();
  try {
    await client.query(role === 'taptime_time_exporter' ? 'BEGIN ISOLATION LEVEL REPEATABLE READ' : 'BEGIN');
    await client.query(`SELECT set_config('app.organization_id',$1,true),set_config('app.user_id',$2,true),
      set_config('app.membership_id',$3,true),set_config('app.membership_role',$4,true),set_config('app.correlation_id',$5,true)`,
    [who.organizationId, who.userId, who.membershipId, who.role, command]);
    await client.query(`SET LOCAL ROLE ${role}`);
    const result = await work(client); await client.query('COMMIT'); return result;
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
beforeAll(async () => {
  const version = Number((await installer.query('SHOW server_version_num')).rows[0].server_version_num);
  expect(Math.floor(version / 10000)).toBe(17);
  await installer.query(`CREATE DATABASE "${databaseName}" TEMPLATE template0 ENCODING 'UTF8'`); created = true;
  await applyMigrationSet(db, await loadMigrations());
  await db.query("INSERT INTO taptime_server.organizations(id,name) VALUES($1,'SYNTHETISCH Lohn'),($2,'SYNTHETISCH Fremd')", [org, otherOrg]);
  await db.query("INSERT INTO taptime_server.customers(id,organization_id,display_name,active,activated_at) VALUES($1,$2,'SYNTHETISCH Kunde',true,'2026-01-01')", [customer,org]);
  for (const [name, who] of Object.entries(actors)) {
    await db.query('INSERT INTO taptime_server.users(id) VALUES($1)', [who.userId]);
    await db.query('INSERT INTO taptime_server.memberships(id,organization_id,user_id,role,display_name) VALUES($1,$2,$3,$4,$5)',
      [who.membershipId, who.organizationId, who.userId, who.role, `SYNTHETISCH ${name}`]);
    await db.query("INSERT INTO taptime_server.identity_bindings(id,user_id,issuer,subject) VALUES(gen_random_uuid(),$1,'https://t123.invalid',$2)", [who.userId, who.userId]);
  }
}, 30_000);
afterAll(async () => {
  if (created) await closePoolAndDropTestDatabase({ targetPool: db, installerPool: installer, databaseName }); else await db.end();
  await installer.end();
});
it('T123 personnel numbers start empty and administrators can read the editable version', async () => {
  const result = await asRole('taptime_membership_manager', admin, client => client.query(
    'SELECT * FROM taptime_server.read_membership_payroll_v1($1)', [employee.membershipId]));
  expect(result.rows).toEqual([{ personnel_number: null, row_version: '1' }]);
});
it('T123 an empty complete Berlin month has no monthly payroll rows', async () => {
  const result = await asRole('taptime_time_exporter', admin, client => client.query(
    `SELECT * FROM taptime_server.read_effective_time_entry_export_v5($1,'2026-08-31T22:00:00Z','2026-09-30T22:00:00Z')`, [org]));
  expect(result.rows).toEqual([]);
});

const verifier: AccessTokenVerifier = { async verify(token) {
  const who = actors[token as keyof typeof actors];
  return who ? { status: 'verified', identity: { issuer: 'https://t123.invalid', subject: who.userId } }
    : { status: 'rejected', reason: 'invalid_signature' };
} };
const memberships = new EmployeeMembershipEnrollmentCoordinator(db, db, verifier);
const version = async (who = employee) => Number((await db.query('SELECT row_version FROM taptime_server.memberships WHERE id=$1', [who.membershipId])).rows[0].row_version);
const personnel = async (value: string | null, who: keyof typeof actors = 'admin', target = employee, commandId = randomUUID(), expectedRowVersion?: number) =>
  memberships.setPersonnelNumber({ accessToken: who, expectedMembershipId: MembershipId(actors[who].membershipId), commandId,
    targetMembershipId: MembershipId(target.membershipId), expectedRowVersion: expectedRowVersion ?? await version(target), personnelNumber: value });
const wage = async (value: string | null, who: keyof typeof actors = 'admin') => memberships.setWorkWageType({
  accessToken: who, expectedMembershipId: MembershipId(actors[who].membershipId), commandId: randomUUID(),
  expectedRowVersion: Number((await db.query('SELECT row_version FROM taptime_server.organizations WHERE id=$1', [actors[who].organizationId])).rows[0].row_version), workWageType: value });

it('T123 preserves leading zeroes and records set, change and clear with exact old/new values', async () => {
  const commands: string[] = [];
  for (const value of ['001-A', 'a'.repeat(20), null]) {
    const command = randomUUID(); commands.push(command);
    const before = await version();
    expect(await personnel(value, 'admin', employee, command)).toEqual({ status: 'succeeded', rowVersion: before + 1, idempotentRetry: false });
    expect((await db.query('SELECT personnel_number FROM taptime_server.memberships WHERE id=$1', [employee.membershipId])).rows[0].personnel_number).toBe(value);
  }
  const events = (await db.query('SELECT event_type,actor_user_id,entity_id,payload FROM taptime_server.audit_events WHERE correlation_id=ANY($1::text[]) ORDER BY occurred_at', [commands])).rows;
  expect(events.map(e => [e.event_type,e.actor_user_id,e.entity_id,e.payload.oldValue,e.payload.newValue])).toEqual([
    ['PersonnelNumberChanged',admin.userId,employee.membershipId,null,'001-A'],
    ['PersonnelNumberChanged',admin.userId,employee.membershipId,'001-A','a'.repeat(20)],
    ['PersonnelNumberChanged',admin.userId,employee.membershipId,'a'.repeat(20),null],
  ]);
  for (const value of ['000001', '12', null]) expect((await wage(value)).status).toBe('succeeded');
  const changes = (await db.query("SELECT payload FROM taptime_server.audit_events WHERE event_type='WorkWageTypeChanged' ORDER BY occurred_at")).rows;
  expect(changes.map(e => [e.payload.oldValue,e.payload.newValue])).toEqual([[null,'000001'],['000001','12'],['12',null]]);
});
it('T123 rejects manager, employee and cross-tenant reads/writes at coordinator and SQL boundaries', async () => {
  for (const who of ['manager','employee'] as const) {
    expect(await personnel('SECRET',who)).toEqual({ status:'forbidden' });
    expect(await wage('123',who)).toEqual({ status:'forbidden' });
    expect(await memberships.readMembershipPayroll({accessToken:who,expectedMembershipId:MembershipId(actors[who].membershipId),targetMembershipId:MembershipId(employee.membershipId)})).toEqual({status:'forbidden'});
    // Merely claiming an administrator role must not change the real membership authority.
    await asRole('taptime_membership_manager',{...actors[who],role:'administrator'},async c => {
      const command=randomUUID(); await c.query("SELECT set_config('app.correlation_id',$1,true)",[command]);
      expect((await c.query('SELECT * FROM taptime_server.set_payroll_value_v1($1,$2,$3,$4)',[command,employee.membershipId,await version(),'FORGED'])).rows[0].result_status).toBe('forbidden');
      expect((await c.query('SELECT * FROM taptime_server.read_membership_payroll_v1($1)',[employee.membershipId])).rows).toEqual([]);
    });
    await expect(asRole('taptime_time_exporter',actors[who],c=>c.query("SELECT * FROM taptime_server.read_effective_time_entry_export_v5($1,'2026-08-31T22:00Z','2026-09-30T22:00Z')",[org]))).rejects.toMatchObject({code:'42501'});
  }
  expect(await personnel('SECRET','foreign')).toEqual({status:'target_unavailable'});
  expect(await memberships.readMembershipPayroll({accessToken:'foreign',expectedMembershipId:MembershipId(foreign.membershipId),targetMembershipId:MembershipId(employee.membershipId)})).toEqual({status:'forbidden'});
  await expect(asRole('taptime_time_exporter',foreign,c=>c.query("SELECT * FROM taptime_server.read_effective_time_entry_export_v5($1,'2026-08-31T22:00Z','2026-09-30T22:00Z')",[org]))).rejects.toMatchObject({code:'42501'});
});
it('T123 enforces exact identifier shapes in SQL as well as at the coordinator', async () => {
  await expect(memberships.readPayrollSettings({accessToken:'admin',expectedMembershipId:MembershipId(admin.membershipId),
    fromInclusive:'0000-01-01T00:00:00.000Z',toExclusive:'0000-02-01T00:00:00.000Z'})).resolves.toEqual({status:'invalid_request'});
  for (const value of ['', ' ', 'A_1', 'ä', 'A\n', 'A\r', 'a'.repeat(21)]) {
    expect(await personnel(value)).toEqual({status:'invalid_request'});
    await asRole('taptime_membership_manager',admin,async c=>{
      const command=randomUUID(); await c.query("SELECT set_config('app.correlation_id',$1,true)",[command]);
      expect((await c.query('SELECT * FROM taptime_server.set_payroll_value_v1($1,$2,$3,$4)',[command,employee.membershipId,await version(),value])).rows[0].result_status).toBe('invalid_request');
    });
  }
  for (const value of ['', '1.0', '-1', '1\n', '１２', '1234567']) expect(await wage(value)).toEqual({status:'invalid_request'});
});
it('T123 serializes equal commands, keeps original receipts after later edits, and rejects stale commands', async () => {
  const command=randomUUID(),v=await version();
  const results=await Promise.all([personnel('002','admin',employee,command,v),personnel('002','admin',employee,command,v)]);
  expect(results.map(r=>r.status)).toEqual(['succeeded','succeeded']);
  expect(results.map(r=>r.status==='succeeded'&&r.idempotentRetry).sort()).toEqual([false,true]);
  expect((await personnel('003')).status).toBe('succeeded');
  expect(await personnel('002','admin',employee,command,v)).toEqual({status:'succeeded',rowVersion:v+1,idempotentRetry:true});
  expect(await personnel('004','admin',employee,command,v)).toEqual({status:'command_id_conflict'});
  expect(await personnel('004','admin',employee,randomUUID(),v)).toEqual({status:'stale_row_version'});
  expect((await db.query('SELECT * FROM taptime_server.audit_events WHERE correlation_id=$1',[command])).rows).toHaveLength(1);
});
it('T123 keeps uniqueness against former people, but permits the same number in another tenant', async () => {
  expect((await personnel('FORMER-001','admin',departed)).status).toBe('succeeded');
  await seedRecord('2026-09-03T08:00:00Z','2026-09-03T09:00:00Z',[],departed.userId);
  await db.query('UPDATE taptime_server.memberships SET revoked_at=clock_timestamp(),row_version=row_version+1 WHERE id=$1',[departed.membershipId]);
  expect((await personnel('FORMER-001')).status).toBe('personnel_number_conflict');
  expect((await personnel('FORMER-001','foreign',foreign)).status).toBe('succeeded');
  expect((await db.query('SELECT personnel_number FROM taptime_server.memberships WHERE id=$1',[departed.membershipId])).rows[0].personnel_number).toBe('FORMER-001');
});
it('T123 guards direct payroll writes, immutable receipts, and the complete catalog inventory', async () => {
  await expect(db.query("UPDATE taptime_server.memberships SET personnel_number='BYPASS',row_version=row_version+1 WHERE id=$1",[employee.membershipId])).rejects.toMatchObject({code:'23514'});
  await expect(db.query("UPDATE taptime_server.organizations SET work_wage_type='9',row_version=row_version+1 WHERE id=$1",[org])).rejects.toMatchObject({code:'23514'});
  await expect(db.query('DELETE FROM taptime_server.payroll_command_receipts WHERE organization_id=$1',[org])).rejects.toMatchObject({code:'42501'});
  const c=await db.connect();try {
    expect(await definerFindings(c)).toEqual([]); expect(await tenantPolicyFindings(c)).toEqual([]);
    const tables=await c.query("SELECT relname,relrowsecurity,relforcerowsecurity FROM pg_class WHERE relnamespace='taptime_server'::regnamespace AND relkind='r' AND relname <> 'schema_migrations'");
    for(const table of tables.rows) expect(table,table.relname).toMatchObject({relrowsecurity:true,relforcerowsecurity:true});
  }finally{c.release();}
});

async function seedRecord(start:string,stop:string|undefined,pauses:readonly (readonly [string,string])[],user=employee.userId) {
 const c=await db.connect(),id=randomUUID(),startEvent=randomUUID(),stopEvent=randomUUID();
 try {
  await c.query('BEGIN');
  for(const [event,at] of [[startEvent,start],...(stop?[[stopEvent,stop]]:[])]) await c.query(`INSERT INTO taptime_server.work_events(id,organization_id,triggered_by_user_id,target_type,target_customer_id,occurred_at,trigger_type,content_hash,content_hash_algorithm,content_hash_version)
   VALUES($1,$2,$3,'customer',$4,$5,'manual',repeat('a',64),'sha256',2)`,[event,org,user,customer,at]);
  await c.query(`INSERT INTO taptime_server.time_entries(id,organization_id,user_id,target_type,target_customer_id,status,start_work_event_id,started_at,started_via)
   VALUES($1,$2,$3,'customer',$4,'started',$5,$6,'manual')`,[id,org,user,customer,startEvent,start]);
  await c.query(`INSERT INTO taptime_server.canonical_decisions(work_event_id,organization_id,actor_user_id,target_type,target_customer_id,decision_type,time_entry_id,engine_version,decision_payload)
   VALUES($1,$2,$3,'customer',$4,'time_entry_started',$5,'test','{}')`,[startEvent,org,user,customer,id]);
  await c.query('COMMIT');
  if(!stop)return id;
  for(const [a,b] of pauses) await seedBreak(id,a,b,user);
  await c.query('BEGIN');
  await c.query("UPDATE taptime_server.time_entries SET status='stopped',stopped_at=$1,stop_work_event_id=$2,stopped_via='manual',row_version=row_version+1 WHERE id=$3",[stop,stopEvent,id]);
  await c.query(`INSERT INTO taptime_server.canonical_decisions(work_event_id,organization_id,actor_user_id,target_type,target_customer_id,decision_type,time_entry_id,engine_version,decision_payload)
   VALUES($1,$2,$3,'customer',$4,'time_entry_stopped',$5,'test','{}')`,[stopEvent,org,user,customer,id]);
  await c.query('COMMIT');return id;
 } catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}
async function seedBreak(entry:string,start:string,stop?:string,user=employee.userId) {
 const c=await db.connect(),id=randomUUID(),a=randomUUID(),b=randomUUID();
 try {
  await c.query('BEGIN');
  for(const [event,at] of [[a,start],...(stop?[[b,stop]]:[])]) await c.query(`INSERT INTO taptime_server.work_events(id,organization_id,triggered_by_user_id,occurred_at,subject_type,trigger_type,content_hash,content_hash_algorithm,content_hash_version)
   VALUES($1,$2,$3,$4,'break','manual',repeat('a',64),'sha256',3)`,[event,org,user,at]);
  await c.query(`INSERT INTO taptime_server.break_intervals(id,organization_id,user_id,time_entry_id,status,start_work_event_id,started_at,started_via)
   VALUES($1,$2,$3,$4,'started',$5,$6,'manual')`,[id,org,user,entry,a,start]);
  await c.query(`INSERT INTO taptime_server.canonical_decisions(work_event_id,organization_id,actor_user_id,subject_type,decision_type,time_entry_id,break_interval_id,engine_version,decision_payload)
   VALUES($1,$2,$3,'break','break_started',$4,$5,'test','{}')`,[a,org,user,entry,id]);
  await c.query('COMMIT');
  if(stop){await c.query('BEGIN');await c.query("UPDATE taptime_server.break_intervals SET status='stopped',stopped_at=$1,stop_work_event_id=$2,stopped_via='manual',row_version=row_version+1 WHERE id=$3",[stop,b,id]);
   await c.query(`INSERT INTO taptime_server.canonical_decisions(work_event_id,organization_id,actor_user_id,subject_type,decision_type,time_entry_id,break_interval_id,engine_version,decision_payload)
    VALUES($1,$2,$3,'break','break_stopped',$4,$5,'test','{}')`,[b,org,user,entry,id]);await c.query('COMMIT');}
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}

it('T123 monthly sums equal completed v4 rows in one snapshot: pauses, correction, void, backfill, administration stop, former, DST and boundary', async () => {
  const corrected=await seedRecord('2026-09-02T08:00Z','2026-09-02T16:00Z',[
    ['2026-09-02T08:30Z','2026-09-02T09:30Z'],['2026-09-02T14:30Z','2026-09-02T15:30Z']]);
  await db.query(`INSERT INTO taptime_server.time_record_revisions(organization_id,time_record_id,canonical_time_entry_id,revision_number,user_id,target_type,target_customer_id,
    effective_started_at,effective_stopped_at,base_row_version,actor_user_id,actor_membership_id,reason,command_id,request_hash)
    VALUES($1,$2,$2,1,$3,'customer',$4,'2026-09-02T09:00Z','2026-09-02T15:00Z',2,$5,$6,'SYNTHETISCH Berichtigung',$7,repeat('a',64))`,
    [org,corrected,employee.userId,customer,admin.userId,admin.membershipId,randomUUID()]);
  const canceled=await seedRecord('2026-09-04T08:00Z','2026-09-04T09:00Z',[]);
  await asRole('taptime_time_review_writer',admin,async c=>expect((await c.query('SELECT taptime_server.void_time_record_v1($1::jsonb) AS result',
    [JSON.stringify({expectedMembershipId:admin.membershipId,commandId:randomUUID(),timeRecordId:canceled,reasonCode:'duplicate',reasonText:null})])).rows[0].result.status).toBe('committed'));
  const supplement=new TimeSupplementCoordinator(db,verifier);
  for(const minute of ['00','01']) expect((await supplement.execute('admin','backfill',{
    expectedMembershipId:admin.membershipId,targetMembershipId:employee.membershipId,commandId:randomUUID(),targetType:'customer',targetId:customer,
    startedAt:`2026-09-05T08:${minute}:00.000Z`,stoppedAt:`2026-09-05T08:${minute}:17.000Z`,reason:'SYNTHETISCH Nachtrag',comment:null,
  })).status).toBe('committed');
  const stopped=await seedRecord('2026-09-06T08:00Z',undefined,[]);
  await seedBreak(stopped,'2026-09-06T08:30Z');
  expect((await new AdministrationStopCoordinator(db,verifier).execute('admin',{
    expectedMembershipId:admin.membershipId,targetMembershipId:employee.membershipId,timeRecordId:stopped,expectedRowVersion:1,
    commandId:randomUUID(),stoppedAt:'2026-09-06T09:00:00.000Z',reason:'SYNTHETISCH Verwaltungsstopp',
  })).status).toBe('committed');
  await seedRecord('2026-09-30T21:59:59Z','2026-09-30T22:00:16Z',[]);
  await seedRecord('2026-03-29T00:30Z','2026-03-29T02:30Z',[]);
  await seedRecord('2026-10-25T00:30Z','2026-10-25T02:30Z',[]);
  await seedRecord('2026-09-20T08:00Z',undefined,[]);
  await seedRecord('2026-09-20T08:00Z',undefined,[],manager.userId); // Running-only person must get a row.
  const periods=[['03','2026-02-28T23:00Z','2026-03-31T22:00Z',7200],['09','2026-08-31T22:00Z','2026-09-30T22:00Z',19851],['10','2026-09-30T22:00Z','2026-10-31T23:00Z',7200]] as const;
  for(const [month,from,to,expectedSeconds] of periods) await asRole('taptime_time_exporter',admin,async c=>{
    const v4=(await c.query('SELECT * FROM taptime_server.read_effective_time_entry_export_v4($1,$2,$3,1000)',[org,from,to])).rows;
    const v5=(await c.query('SELECT * FROM taptime_server.read_effective_time_entry_export_v5($1,$2,$3)',[org,from,to])).rows;
    expect(v5.map(r=>r.employee_membership_id).sort()).toEqual([...new Set(v4.map(r=>r.employee_membership_id))].sort());
    for(const row of v5) {
      const entries=v4.filter(e=>e.employee_membership_id===row.employee_membership_id);
      expect(BigInt(row.work_duration_seconds)).toBe(entries.filter(e=>e.status==='stopped').reduce((sum,e)=>sum+BigInt(e.effective_work_duration_seconds),0n));
      expect(row.has_running_time).toBe(entries.some(e=>e.status==='started'));
      expect(Number(row.source_row_count)).toBe(entries.length); expect(row.payroll_month).toBe(`${month}.2026`);
    }
    expect(Number(v5.find(r=>r.employee_membership_id===employee.membershipId).work_duration_seconds)).toBe(expectedSeconds);
    if(month==='09') {
      expect(v5.find(r=>r.employee_membership_id===departed.membershipId)).toMatchObject({personnel_number:'FORMER-001',work_duration_seconds:'3600'});
      expect(v5.find(r=>r.employee_membership_id===manager.membershipId)).toMatchObject({personnel_number:null,work_duration_seconds:'0',has_running_time:true});
      expect(v4.find(r=>r.time_entry_id===canceled)).toBeUndefined();
    }
  });
  expect(await memberships.readPayrollSettings({accessToken:'admin',expectedMembershipId:MembershipId(admin.membershipId),
    fromInclusive:'2026-08-31T22:00:00.000Z',toExclusive:'2026-09-30T22:00:00.000Z'})).toMatchObject({status:'succeeded',missingPersonnelNumberCount:1});
},30_000);
