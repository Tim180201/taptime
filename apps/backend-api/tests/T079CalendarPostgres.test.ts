import { randomUUID } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import { beforeAll, afterAll, expect, it } from 'vitest';
import { loadMigrations, applyMigrationSet } from '@taptime/backend-schema';
import { monthTimeSummary, calendarDayAllocations } from '@taptime/core';
import { isCalendarTimeResponse, isDetailedTimeResponse, validateOwnTimeResponse } from '@taptime/mobile-work-contract';
import { readManagedPerson } from '../../backend-administration/src/ManagedPeopleReader.js';
import { ids, resetMigratePrepareAndSeed } from '../../backend-time-review/tests/fixtures.js';
const pool=new Pool({connectionString:process.env.C2_DATABASE_URL??'postgresql://timbartz@127.0.0.1:5432/taptime_da3'});
const from='2026-07-01T00:00:00.000Z',to='2026-08-01T00:00:00.000Z';
const personUser=randomUUID(),personMember=randomUUID();
const command={accessToken:'synthetic',expectedMembershipId:ids.membershipAdminA,targetMembershipId:personMember,fromInclusive:from,toExclusive:to,cursor:null,limit:20};
let example:string, corrected:string,running:string,microseconds:string;
async function context(c:PoolClient,role:string,who:'admin'|'self'|'foreign'='admin') {
 const foreign=who==='foreign',self=who==='self';
 await c.query('RESET ROLE');
 await c.query(`SELECT set_config('app.organization_id',$1,true),set_config('app.user_id',$2,true),set_config('app.membership_id',$3,true),set_config('app.membership_role',$4,true)`,
 [foreign?ids.organizationB:ids.organizationA,foreign?ids.adminB:self?personUser:ids.adminA,
  foreign?ids.membershipAdminB:self?personMember:ids.membershipAdminA,self?'employee':'administrator']);
 await c.query(`SET LOCAL ROLE ${role}`);
}
async function seedRecord(start:string,stop:string|undefined,pauses:readonly (readonly [string,string])[]) {
 const c=await pool.connect(),id=randomUUID(),startEvent=randomUUID(),stopEvent=randomUUID();
 try {
  await c.query('BEGIN');
  for(const [event,at] of [[startEvent,start],...(stop?[[stopEvent,stop]]:[])]) await c.query(`INSERT INTO taptime_server.work_events(id,organization_id,triggered_by_user_id,target_type,target_customer_id,occurred_at,trigger_type,content_hash,content_hash_algorithm,content_hash_version)
   VALUES($1,$2,$3,'customer',$4,$5,'manual',repeat('a',64),'sha256',2)`,[event,ids.organizationA,personUser,ids.customerA,at]);
  await c.query(`INSERT INTO taptime_server.time_entries(id,organization_id,user_id,target_type,target_customer_id,status,start_work_event_id,started_at,started_via)
   VALUES($1,$2,$3,'customer',$4,'started',$5,$6,'manual')`,[id,ids.organizationA,personUser,ids.customerA,startEvent,start]);
  await c.query(`INSERT INTO taptime_server.canonical_decisions(work_event_id,organization_id,actor_user_id,target_type,target_customer_id,decision_type,time_entry_id,engine_version,decision_payload)
   VALUES($1,$2,$3,'customer',$4,'time_entry_started',$5,'test','{}')`,[startEvent,ids.organizationA,personUser,ids.customerA,id]);
  await c.query('COMMIT');
  if(!stop)return id;
  for(const [a,b] of pauses) await seedBreak(id,a,b);
  await c.query('BEGIN');
  await c.query("UPDATE taptime_server.time_entries SET status='stopped',stopped_at=$1,stop_work_event_id=$2,stopped_via='manual',row_version=row_version+1 WHERE id=$3",[stop,stopEvent,id]);
  await c.query(`INSERT INTO taptime_server.canonical_decisions(work_event_id,organization_id,actor_user_id,target_type,target_customer_id,decision_type,time_entry_id,engine_version,decision_payload)
   VALUES($1,$2,$3,'customer',$4,'time_entry_stopped',$5,'test','{}')`,[stopEvent,ids.organizationA,personUser,ids.customerA,id]);
  await c.query('COMMIT');return id;
 } catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}
async function seedBreak(entry:string,start:string,stop?:string) {
 const c=await pool.connect(),id=randomUUID(),a=randomUUID(),b=randomUUID();
 try {
  await c.query('BEGIN');
  for(const [event,at] of [[a,start],...(stop?[[b,stop]]:[])]) await c.query(`INSERT INTO taptime_server.work_events(id,organization_id,triggered_by_user_id,occurred_at,subject_type,trigger_type,content_hash,content_hash_algorithm,content_hash_version)
   VALUES($1,$2,$3,$4,'break','manual',repeat('a',64),'sha256',3)`,[event,ids.organizationA,personUser,at]);
  await c.query(`INSERT INTO taptime_server.break_intervals(id,organization_id,user_id,time_entry_id,status,start_work_event_id,started_at,started_via)
   VALUES($1,$2,$3,$4,'started',$5,$6,'manual')`,[id,ids.organizationA,personUser,entry,a,start]);
  await c.query(`INSERT INTO taptime_server.canonical_decisions(work_event_id,organization_id,actor_user_id,subject_type,decision_type,time_entry_id,break_interval_id,engine_version,decision_payload)
   VALUES($1,$2,$3,'break','break_started',$4,$5,'test','{}')`,[a,ids.organizationA,personUser,entry,id]);
  await c.query('COMMIT');
  if(stop){await c.query('BEGIN');await c.query("UPDATE taptime_server.break_intervals SET status='stopped',stopped_at=$1,stop_work_event_id=$2,stopped_via='manual',row_version=row_version+1 WHERE id=$3",[stop,b,id]);
   await c.query(`INSERT INTO taptime_server.canonical_decisions(work_event_id,organization_id,actor_user_id,subject_type,decision_type,time_entry_id,break_interval_id,engine_version,decision_payload)
    VALUES($1,$2,$3,'break','break_stopped',$4,$5,'test','{}')`,[b,ids.organizationA,personUser,entry,id]);await c.query('COMMIT');}
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}
beforeAll(async()=>{
 await resetMigratePrepareAndSeed(pool,'t079-synthetic','033');
 await pool.query('INSERT INTO taptime_server.users(id) VALUES($1)',[personUser]);
 await pool.query("INSERT INTO taptime_server.memberships(id,organization_id,user_id,role,display_name) VALUES($1,$2,$3,'employee','Kalenderperson')",[personMember,ids.organizationA,personUser]);
 example=await seedRecord('2026-07-18T22:59:58.900+02:00','2026-07-19T01:00:00.200+02:00',[
  ['2026-07-18T23:59:59.050+02:00','2026-07-19T00:00:00.150+02:00']]);
 corrected=await seedRecord('2026-07-17T08:00:00Z','2026-07-17T16:00:00Z',[
  ['2026-07-17T08:30:00Z','2026-07-17T09:30:00Z'],['2026-07-17T14:30:00Z','2026-07-17T15:30:00Z']]);
 await pool.query(`INSERT INTO taptime_server.time_record_revisions(organization_id,time_record_id,canonical_time_entry_id,revision_number,user_id,target_type,target_customer_id,
  effective_started_at,effective_stopped_at,base_row_version,actor_user_id,actor_membership_id,reason,command_id,request_hash)
  VALUES($1,$2,$2,1,$3,'customer',$4,'2026-07-17T09:00:00Z','2026-07-17T15:00:00Z',2,$5,$6,'Berichtigt',$7,repeat('a',64))`,
  [ids.organizationA,corrected,personUser,ids.customerA,ids.adminA,ids.membershipAdminA,randomUUID()]);
 microseconds=await seedRecord('2026-07-16T10:00:00.000900Z','2026-07-16T11:00:00.000100Z',[]);
 running=await seedRecord('2026-07-21T08:00:00Z',undefined,[]);
 await seedBreak(running,'2026-07-21T09:00:00Z');
});
afterAll(()=>pool.end());
it('034 preserves both existing managed replies byte-for-byte in one transaction and leaves old SQL readers unchanged',async()=>{
 const c=await pool.connect();try{
  await c.query('BEGIN');await context(c,'taptime_membership_manager');
  const legacy=await readManagedPerson(c,command),details=await readManagedPerson(c,{...command,includeTimeDetails:true});
  await c.query('RESET ROLE');
  const definitions=await c.query("SELECT proname,pg_get_functiondef(oid) AS definition FROM pg_proc WHERE pronamespace='taptime_server'::regnamespace AND proname IN ('read_mobile_own_time_v1','read_mobile_own_time_v2','read_managed_person_time_v1','read_time_record_details_v1') ORDER BY proname");
  await c.query((await loadMigrations()).find(m=>m.version==='034')!.sql);
  expect((await c.query("SELECT proname,pg_get_functiondef(oid) AS definition FROM pg_proc WHERE pronamespace='taptime_server'::regnamespace AND proname IN ('read_mobile_own_time_v1','read_mobile_own_time_v2','read_managed_person_time_v1','read_time_record_details_v1') ORDER BY proname")).rows).toEqual(definitions.rows);
  await context(c,'taptime_membership_manager');
  expect(JSON.stringify(await readManagedPerson(c,command))).toBe(JSON.stringify(legacy));
  expect(JSON.stringify(await readManagedPerson(c,{...command,includeTimeDetails:true}))).toBe(JSON.stringify(details));
  await c.query('ROLLBACK');
 }finally{await c.query('ROLLBACK');c.release();}
 await applyMigrationSet(pool,(await loadMigrations()).filter(m=>m.version==='034'));
});
it('real PostgreSQL calendar equals export including clipped correction, midnight rounding and running pause',async()=>{
 const c=await pool.connect();try{
  await c.query('BEGIN');await context(c,'taptime_membership_manager');
  const result=await readManagedPerson(c,{...command,includeTimeDetails:true,includeCalendarBreaks:true});
  if(result.status!=='succeeded')throw Error('calendar unavailable');
  expect(isCalendarTimeResponse(result.value)).toBe(true);expect(isDetailedTimeResponse(result.value)).toBe(false);expect(validateOwnTimeResponse(result.value)).toBe(false);
  const midnight=result.value.records.find(r=>r.timeRecordId===example)!;
  expect(midnight.calendar).toMatchObject({workDurationSeconds:7200,breakDurationSeconds:1});
  expect(calendarDayAllocations(midnight).reduce((s,p)=>s+p.workSeconds,0)).toBe(7200);
  expect(result.value.records.find(r=>r.timeRecordId===corrected)!.calendar).toMatchObject({workDurationSeconds:18000,breakDurationSeconds:3600});
  const precise=result.value.records.find(r=>r.timeRecordId===microseconds)!;
  expect(Date.parse(precise.stoppedAt!)-Date.parse(precise.startedAt)).toBe(3600000);
  expect(precise.calendar!.workDurationSeconds).toBe(3599);
  expect(calendarDayAllocations(precise).map(d=>d.workSeconds)).toEqual([3599]);
  const active=result.value.activeRecord!;expect(active.calendar!.breakIntervals.at(-1)!.stoppedAt).toBe(active.calendar!.asOf);
  expect(new Set([...result.value.records,active].map(r=>r.calendar!.asOf)).size).toBe(1);
  await context(c,'taptime_time_exporter');
  const exported=(await c.query('SELECT * FROM taptime_server.read_effective_time_entry_export_v3($1,$2,$3,10001)',[ids.organizationA,from,to])).rows.filter(r=>r.employee_membership_id===personMember);
  const sum=(field:string)=>exported.reduce((s,r)=>s+Number(r[field]),0);
  expect(monthTimeSummary(result.value,'2026-07').milliseconds/1000).toBe(sum('effective_work_duration_seconds'));
  expect(monthTimeSummary(result.value,'2026-07').breakMilliseconds/1000).toBe(sum('break_duration_seconds'));
  await context(c,'taptime_mobile_own_time_reader','self');
  const own=(await c.query('SELECT * FROM taptime_server.read_time_record_calendar_v1($1::uuid[])',[[example,corrected,running]])).rows;
  expect(own.find(r=>r.time_record_id===example).calendar).toEqual(midnight.calendar);
  await context(c,'taptime_mobile_own_time_reader');
  expect((await c.query('SELECT * FROM taptime_server.read_time_record_calendar_v1($1::uuid[])',[[example]])).rows).toEqual([]);
  await context(c,'taptime_membership_manager','foreign');
  expect((await c.query('SELECT * FROM taptime_server.read_time_record_calendar_v1($1::uuid[])',[[example]])).rows).toEqual([]);
 }finally{await c.query('ROLLBACK');c.release();}
});
it('uses current home-location authority on every new-calendar read',async()=>{
 const location=randomUUID(),other=randomUUID();
 await pool.query(`INSERT INTO taptime_server.locations(id,organization_id,display_name) VALUES($1,$3,'Eins'),($2,$3,'Zwei')`,[location,other,ids.organizationA]);
 await pool.query(`INSERT INTO taptime_server.membership_home_location_assignments(id,organization_id,membership_id,location_id) VALUES(gen_random_uuid(),$1,$2,$3)`,[ids.organizationA,personMember,location]);
 await pool.query("UPDATE taptime_server.memberships SET role='standortleitung',row_version=row_version+1 WHERE id=$1",[ids.membershipAdminA]);
 await pool.query(`INSERT INTO taptime_server.membership_management_location_grants(id,organization_id,membership_id,location_id) VALUES(gen_random_uuid(),$1,$2,$3)`,[ids.organizationA,ids.membershipAdminA,location]);
 // Activation checks need a complete setup; scoped authorization also fails closed when disabled.
 const c=await pool.connect();try{
  await c.query('BEGIN');await c.query("UPDATE taptime_server.organizations SET locations_enabled=true,row_version=row_version+1 WHERE id=$1",[ids.organizationA]);
  await context(c,'taptime_membership_manager');
  expect((await c.query('SELECT * FROM taptime_server.read_time_record_calendar_v1($1::uuid[])',[[example]])).rows).toHaveLength(1);
  await c.query('RESET ROLE');await c.query('UPDATE taptime_server.membership_home_location_assignments SET revoked_at=clock_timestamp() WHERE membership_id=$1',[personMember]);
  await c.query(`INSERT INTO taptime_server.membership_home_location_assignments(id,organization_id,membership_id,location_id) VALUES(gen_random_uuid(),$1,$2,$3)`,[ids.organizationA,personMember,other]);
  await context(c,'taptime_membership_manager');expect((await c.query('SELECT * FROM taptime_server.read_time_record_calendar_v1($1::uuid[])',[[example]])).rows).toEqual([]);
 }finally{await c.query('ROLLBACK');c.release();}
});
