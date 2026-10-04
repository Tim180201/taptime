import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Pool, type PoolClient } from 'pg';
import { beforeAll,afterAll,expect,it } from 'vitest';
import { loadMigrations,applyMigrationSet } from '@taptime/backend-schema';
import { ManualLifecycleIngestionCoordinator } from '../../backend-lifecycle/src/ManualLifecycleIngestionCoordinator.js';
import { MobileWorkReadCoordinator } from '../../backend-mobile-work/src/MobileWorkReadCoordinator.js';
import { MembershipId,WorkEventId,CustomerId,customerAssignmentTarget } from '@taptime/core';
import { isCaptureTimeResponse,isCalendarTimeResponse } from '@taptime/mobile-work-contract';
import { ids,resetMigratePrepareAndSeed } from '../../backend-time-review/tests/fixtures.js';
const url=process.env.C2_DATABASE_URL??'postgresql://timbartz@127.0.0.1:5432/taptime_da3';
const pool=new Pool({connectionString:url});
const login=`t103_runtime_${randomUUID().replaceAll('-','')}`,runtimeUrl=new URL(url);
runtimeUrl.username=login;runtimeUrl.password='t103-synthetic';
const runtime=new Pool({connectionString:runtimeUrl.href});
const user=randomUUID(),member=randomUUID(),issuer='https://t103.invalid/auth';
const verifier={verify:async()=>({status:'verified' as const,identity:{issuer,subject:'t103-person'}})};
// Load the real mobile coordinator at runtime, keeping React Native ambient globals out of the Node typecheck.
const mobileCoordinatorModule=new URL('../../mobile/src/work/MobileWorkCoordinator.ts',import.meta.url).href;
const {MobileWorkCoordinator}=await import(/* @vite-ignore */ mobileCoordinatorModule);
type ManualTriggerResult={status:'accepted';outcome:string}|{status:'unavailable'};
const read=new MobileWorkReadCoordinator(runtime,runtime,verifier,Buffer.alloc(32,7).toString('base64url'));
const lifecycle=new ManualLifecycleIngestionCoordinator(runtime,verifier,{requireOffsiteArchive:async()=>({requiredWalFile:'000000010000000000000001',offsiteArchived:true})});
const request={expectedMembershipId:member,cursor:null,limit:20};
async function context(c:PoolClient,who='self'){
 await c.query('RESET ROLE');
 await c.query("SELECT set_config('app.organization_id',$1,true),set_config('app.user_id',$2,true),set_config('app.membership_id',$3,true),set_config('app.membership_role','employee',true)",[who==='foreign'?ids.organizationB:ids.organizationA,who==='other'?ids.employeeA:user,who==='other'?ids.membershipEmployeeA:member]);
 await c.query('SET LOCAL ROLE taptime_mobile_own_time_reader');
}
beforeAll(async()=>{
 await resetMigratePrepareAndSeed(pool,'t103-synthetic','042');
 await pool.query('INSERT INTO taptime_server.users(id) VALUES($1)',[user]);
 await pool.query("INSERT INTO taptime_server.memberships(id,organization_id,user_id,role,display_name) VALUES($1,$2,$3,'employee','T103 Synthetic')",[member,ids.organizationA,user]);
 await pool.query('INSERT INTO taptime_server.identity_bindings(id,user_id,issuer,subject) VALUES($1,$2,$3,$4)',[randomUUID(),user,issuer,'t103-person']);
 await pool.query(`CREATE ROLE ${login} LOGIN PASSWORD 't103-synthetic'; GRANT taptime_identity_resolver,taptime_mobile_own_time_reader,taptime_mobile_target_reader,taptime_server_lifecycle TO ${login}`);
});
afterAll(async()=>{await runtime.end();await pool.query(`DROP OWNED BY ${login};DROP ROLE ${login}`);await pool.end();});
it('043 preserves every legacy own-time SQL reply byte-for-byte and all existing function bodies',async()=>{
 const c=await pool.connect();try{
  await c.query('BEGIN');
  const definitions=async()=> (await c.query("SELECT oid::regprocedure::text AS name,pg_get_functiondef(oid) AS body FROM pg_proc WHERE pronamespace='taptime_server'::regnamespace ORDER BY name")).rows;
  const before=await definitions();
  const snapshot=async()=>{
   await context(c,'other');
   const result=[];
   for(const version of ['v1','v2']) {
    const rows=(await c.query(`SELECT * FROM taptime_server.read_mobile_own_time_${version}($1,$2,$3,NULL,NULL,NULL,NULL,20)`,[ids.organizationA,ids.employeeA,ids.membershipEmployeeA])).rows;
    result.push(rows);
    const recordIds=rows.map(r=>r.time_record_id);
    for(const projection of ['details','calendar'])result.push((await c.query(`SELECT * FROM taptime_server.read_time_record_${projection}_v1($1::uuid[])`,[recordIds])).rows);
   }
   return JSON.stringify(result);
  };
  const old=await snapshot();await c.query('RESET ROLE');
  await c.query((await loadMigrations()).find(m=>m.version==='043')!.sql);
  expect(await snapshot()).toBe(old);await c.query('RESET ROLE');
  const after=await definitions();for(const definition of before)expect(after.find(r=>r.name===definition.name)).toEqual(definition);
 }finally{await c.query('ROLLBACK');c.release();}
 await applyMigrationSet(pool,(await loadMigrations()).filter(m=>m.version==='043'));
});
it('real mobile sequence starts, pauses, stops the pause and time, with matching calendar/export durations',async()=>{
 const readOwn=async()=>{
  const result=await read.queryOwnTime({accessToken:'self',request,includeTimeDetails:true,includeCalendarBreaks:true,includeActiveCapture:true});
  if(result.status!=='succeeded')throw Error(`own time ${result.status}`);
  expect(isCaptureTimeResponse(result.response)).toBe(true);return result.response;
 };
 const order:string[]=[];
 const convert=(value:Awaited<ReturnType<typeof lifecycle.ingestManual>>):ManualTriggerResult=>value.status==='synchronized'
   ? {status:'accepted',outcome:value.decision.status}:{status:'unavailable'};
 const api={read:async()=>({status:'ready',ownTime:await readOwn(),targets:{targets:[{targetType:'customer',targetId:ids.customerA,displayName:'Kunde A'}],nextCursor:null}}),
 readOwnTimePage:async()=>({status:'unavailable'}),
 triggerManual:async()=>{order.push('work');return convert(await lifecycle.ingestManual({accessToken:'self',expectedMembershipId:MembershipId(member),workEvent:{id:WorkEventId(randomUUID()),target:customerAssignmentTarget(CustomerId(ids.customerA))},receipt:{id:randomUUID(),attemptNumber:1}}));},
 triggerBreak:async()=>{order.push('break');return convert(await lifecycle.ingestManualBreak({accessToken:'self',expectedMembershipId:MembershipId(member),workEvent:{id:WorkEventId(randomUUID()),subject:{type:'break'}},receipt:{id:randomUUID(),attemptNumber:1}}));}};
 const snapshot={generation:1,session:{userId:user,membershipId:member,organizationId:ids.organizationA,role:'employee' as const,nfcSetupAvailable:false}};
 const work=new MobileWorkCoordinator({capture:()=>snapshot,isCurrent:()=>true,subscribe:()=>()=>{}},api);
 await work.refresh();await work.triggerManual({targetType:'customer',targetId:ids.customerA,displayName:'Kunde A'});
 expect(work.getState()).toMatchObject({outcome:'time_entry_started'});
 await work.triggerBreak();expect(work.getState()).toMatchObject({outcome:'break_started'});
 const paused=await readOwn();expect(paused.activeRecord?.targetId).toBe(ids.customerA);expect(paused.activeRecord?.breakStartedAt).toBeTypeOf('string');
 const old=await read.queryOwnTime({accessToken:'self',request,includeTimeDetails:true,includeCalendarBreaks:true});
 expect(old.status==='succeeded' && isCalendarTimeResponse(old.response)).toBe(true);
 const c=await pool.connect();try{await c.query('BEGIN');
  for(const who of ['other','foreign']){await context(c,who);expect((await c.query('SELECT * FROM taptime_server.read_mobile_active_capture_v1($1::uuid[])',[[paused.activeRecord!.timeRecordId]])).rows).toEqual([]);}
 }finally{await c.query('ROLLBACK');c.release();}
 // Use the actual engine duplicate window without changing its behavior or hard-coding its age.
 const engineSource=await readFile(new URL('../../../packages/core/src/business/BusinessEngine.ts',import.meta.url),'utf8');
 const duplicateWindow=Number(engineSource.match(/DUPLICATE_WINDOW_MILLISECONDS\s*=\s*([\d_]+)/)?.[1]?.replaceAll('_',''));
 if(!Number.isFinite(duplicateWindow)||duplicateWindow<0)throw Error('Engine duplicate window is unavailable');
 await new Promise(resolve=>setTimeout(resolve,duplicateWindow+100));
 await work.stopActiveTime();expect(order).toEqual(['work','break','break','work']);
 const stopped=await readOwn();expect(stopped.activeRecord).toBeNull();expect(stopped.records).toHaveLength(1);
 const record=stopped.records[0]!;expect(record.calendar?.breakIntervals).toHaveLength(1);
 expect(work.getState()).toMatchObject({outcome:'time_entry_stopped',feedback:expect.stringMatching(/^Zeit beendet · .* · .*–.* · .* min$/)});
 const e=await pool.connect();try{await e.query('BEGIN');await e.query("SELECT set_config('app.organization_id',$1,true),set_config('app.user_id',$2,true),set_config('app.membership_id',$3,true),set_config('app.membership_role','administrator',true)",[ids.organizationA,ids.adminA,ids.membershipAdminA]);await e.query('SET LOCAL ROLE taptime_time_exporter');
  const exported=(await e.query('SELECT * FROM taptime_server.read_effective_time_entry_export_v3($1,$2,$3,10001)',[ids.organizationA,new Date(Date.parse(record.startedAt)-1).toISOString(),new Date(Date.parse(record.stoppedAt!)+1).toISOString()])).rows.find(r=>r.time_entry_id===record.timeRecordId);
  expect(exported).toBeDefined();expect(Number(exported.effective_work_duration_seconds)).toBe(record.calendar?.workDurationSeconds);expect(Number(exported.break_duration_seconds)).toBe(record.calendar?.breakDurationSeconds);
 }finally{await e.query('ROLLBACK');e.release();}
});
