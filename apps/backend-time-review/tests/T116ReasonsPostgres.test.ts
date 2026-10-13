import {randomUUID} from 'node:crypto';
import {Pool,type PoolClient} from 'pg';
import {afterAll,beforeAll,expect,it} from 'vitest';
import {BusinessEngine,WorkEventId,createTimestamp,type AdministrationWorkEvent} from '@taptime/core';
import {applyMigrationSet,loadMigrations} from '@taptime/backend-schema';
import {ids,resetMigratePrepareAndSeed} from './fixtures.js';
const pool=new Pool({connectionString:process.env.DA3_DATABASE_URL??'postgresql://timbartz@127.0.0.1:5432/taptime_da3'});
const people=['administrator','standortleitung','employee'].map(role=>({role,user:randomUUID(),member:randomUUID(),record:randomUUID()}));
const location=randomUUID();
const start=new Date();start.setUTCDate(start.getUTCDate()-2);start.setUTCHours(8,0,0,0);
const startedAt=start.toISOString(),stoppedAt=new Date(+start+3600000).toISOString();
beforeAll(async()=>{
 await resetMigratePrepareAndSeed(pool,'t116-reasons','052');
 const tables=(await pool.query("SELECT tablename FROM pg_tables WHERE schemaname='taptime_server' ORDER BY tablename")).rows;
 const snapshot=()=>Promise.all(tables.map(({tablename})=>pool.query(`SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]') AS data FROM taptime_server.${tablename} t`).then(r=>r.rows)));
 const before=await snapshot();
 await applyMigrationSet(pool,(await loadMigrations()).filter(m=>m.version>'052'));
 expect(await snapshot()).toEqual(before);
 for(const person of people){
  await pool.query('INSERT INTO taptime_server.users(id) VALUES($1)',[person.user]);
  await pool.query('INSERT INTO taptime_server.memberships(id,organization_id,user_id,role) VALUES($1,$2,$3,$4)',[person.member,ids.organizationA,person.user,person.role]);
  await pool.query(`INSERT INTO taptime_server.time_record_revisions(organization_id,time_record_id,revision_number,user_id,target_type,target_customer_id,effective_started_at,effective_stopped_at,base_row_version,actor_user_id,actor_membership_id,reason,command_id,request_hash)
   VALUES($1,$2,1,$3,'customer',$4,'2026-06-01T08:00:00Z','2026-06-01T09:00:00Z',0,$5,$6,'Bestand',gen_random_uuid(),repeat('a',64))`,[ids.organizationA,person.record,person.user,ids.customerA,ids.adminA,ids.membershipAdminA]);
 }
 await pool.query("INSERT INTO taptime_server.locations(id,organization_id,display_name) VALUES($1,$2,'Standort')",[location,ids.organizationA]);
 await pool.query('INSERT INTO taptime_server.membership_home_location_assignments(id,organization_id,membership_id,location_id) SELECT gen_random_uuid(),organization_id,id,$1 FROM taptime_server.memberships WHERE organization_id=$2',[location,ids.organizationA]);
 await pool.query("INSERT INTO taptime_server.work_target_location_assignments(id,organization_id,target_type,target_id,location_id) SELECT gen_random_uuid(),organization_id,target_type,target_id,$1 FROM taptime_server.work_targets WHERE organization_id=$2 AND active",[location,ids.organizationA]);
 await pool.query('INSERT INTO taptime_server.membership_management_location_grants(id,organization_id,membership_id,location_id) VALUES(gen_random_uuid(),$1,$2,$3)',[ids.organizationA,people[1]!.member,location]);
 await pool.query('UPDATE taptime_server.organizations SET locations_enabled=true,row_version=row_version+1 WHERE id=$1',[ids.organizationA]);
});
afterAll(()=>pool.end());
const json=async(c:PoolClient,fn:string,request:unknown)=>(await c.query(`SELECT taptime_server.${fn}($1::jsonb) AS result`,[JSON.stringify(request)])).rows[0].result;
async function scenario(index:number,own:boolean,action:string,reason:string|null){
 const actor=people[index]!,target=own?actor:people[(index+1)%people.length]!;
 const c=await pool.connect();const commandId=randomUUID(),active=randomUUID(),event=randomUUID();
 try{
  await c.query('BEGIN');
  if(action==='stop'){
   await c.query(`INSERT INTO taptime_server.work_events(id,organization_id,triggered_by_user_id,target_type,target_customer_id,occurred_at,trigger_type,content_hash,content_hash_algorithm,content_hash_version)
    VALUES($1,$2,$3,'customer',$4,$5,'manual',repeat('b',64),'sha256',2)`,[event,ids.organizationA,target.user,ids.customerA,startedAt]);
   await c.query(`INSERT INTO taptime_server.time_entries(id,organization_id,user_id,target_type,target_customer_id,status,start_work_event_id,started_at,started_via) VALUES($1,$2,$3,'customer',$4,'started',$5,$6,'manual')`,[active,ids.organizationA,target.user,ids.customerA,event,startedAt]);
   await c.query(`INSERT INTO taptime_server.canonical_decisions(work_event_id,organization_id,actor_user_id,target_type,target_customer_id,decision_type,time_entry_id,engine_version,decision_payload) VALUES($1,$2,$3,'customer',$4,'time_entry_started',$5,'test','{}')`,[event,ids.organizationA,target.user,ids.customerA,active]);
  }
  await c.query('SET CONSTRAINTS ALL IMMEDIATE');
  await c.query('SET CONSTRAINTS ALL DEFERRED');
  await c.query("SELECT set_config('app.organization_id',$1,true),set_config('app.user_id',$2,true),set_config('app.membership_id',$3,true),set_config('app.membership_role',$4,true)",[ids.organizationA,actor.user,actor.member,actor.role]);
  await c.query('SET LOCAL ROLE taptime_time_review_writer');
  const request={expectedMembershipId:actor.member,targetMembershipId:target.member,commandId,targetType:'customer',targetId:ids.customerA,startedAt,stoppedAt,reason,comment:null};
  let result;let repeat:()=>Promise<any>;
  if(action==='backfill') repeat=()=>json(c,'backfill_time_record_v1',request);
  else if(action==='correct')repeat=async()=>{const r=(await c.query(`SELECT * FROM taptime_server.correct_time_record_v1($1,$2,$3,$4,repeat('c',64),$5,0,1,$6,$7,$8)`,[ids.organizationA,actor.user,actor.member,commandId,target.record,startedAt,stoppedAt,reason])).rows[0];return {status:r.result_status,timeRecordId:r.time_record_id,idempotentRetry:r.idempotent_retry};};
  else if(action==='void')repeat=()=>json(c,'void_time_record_v1',{expectedMembershipId:actor.member,commandId,timeRecordId:target.record,reasonCode:reason,reasonText:reason==='other'?'Beleg':null});
  else {
   const stopRequest={expectedMembershipId:actor.member,targetMembershipId:target.member,commandId,timeRecordId:active,expectedRowVersion:1,stoppedAt,reason};
   repeat=async()=>{const prepared=await json(c,'prepare_administration_stop_v1',stopRequest);if(prepared.status!=='ready')return prepared;
    const entry=prepared.activeTimeEntry,workEvent:AdministrationWorkEvent={id:WorkEventId(randomUUID()),organizationId:entry.organizationId,triggeredBy:entry.userId,target:entry.target,occurredAt:createTimestamp(stoppedAt),trigger:{type:'administration'}};
    const decision=new BusinessEngine().evaluate(workEvent,{activeTimeEntryForUser:entry,activeBreakIntervalForUser:null,previousAcceptedWorkEventForUserAndTarget:null});
    return (await c.query('SELECT taptime_server.commit_administration_stop_v1($1::jsonb,$2::jsonb,$3::jsonb) AS result',[JSON.stringify(stopRequest),JSON.stringify(workEvent),JSON.stringify(decision)])).rows[0].result;
   };
  }
  result=await repeat();
  const forbidden=actor.role==='employee'&&(action==='correct'||action==='stop'||!own);
  const required=actor.role==='standortleitung'&&!own&&action!=='void';
  const blank=reason===null||!reason.replace(/[\s\u0001\u0085\u200b]/g,'');
  const invalid=action==='void'?reason==='none':(required&&blank)||(reason!==null&&Array.from(reason).length>500);
  expect(result.status,`${actor.role}/${own?'own':'foreign'}/${action}/${reason?.length??'null'}`).toBe(action==='void'&&invalid?'invalid_request':forbidden?(action==='void'?'forbidden':'authority_rejected'):invalid?'reason_required':'committed');
  if(result.status!=='committed')return;
  expect(await repeat()).toMatchObject({status:'committed',idempotentRetry:true});
  await c.query('RESET ROLE');
  if(action==='void')expect((await c.query('SELECT reason_code FROM taptime_server.time_record_voids WHERE command_id=$1',[commandId])).rows[0].reason_code).toBe(reason??'none');
  else {
   const expected=blank?(own?`Selbst ${action==='backfill'?'nachgetragen':action==='correct'?'geändert':'beendet'}`:'Kein Grund angegeben'):reason;
   const table=action==='stop'?'administration_stop_commands':'time_record_revisions';
   expect((await c.query(`SELECT reason FROM taptime_server.${table} WHERE command_id=$1`,[commandId])).rows[0].reason).toBe(expected);
   if(action==='stop')expect((await c.query("SELECT payload->>'reason' AS reason FROM taptime_server.audit_events WHERE correlation_id=$1",[commandId])).rows[0].reason).toBe(expected);
  }
 }finally{await c.query('ROLLBACK');c.release();}
}
for(let index=0;index<people.length;index++)for(const own of [true,false])for(const action of ['backfill','correct','stop','void'])
 for(const reason of action==='void'?[null,'duplicate','misscan','other','none']:[null,' \t\u200b',' Unverändert speichern ','x'.repeat(500),'x'.repeat(501),' '.repeat(501)])
 it(`D134 ${people[index]!.role} ${own?'own':'foreign'} ${action} reason ${reason===null?'null':reason.length}`,()=>scenario(index,own,action,reason));
