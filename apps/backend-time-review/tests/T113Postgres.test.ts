import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import {afterAll,beforeAll,expect,it} from 'vitest';
import {applyMigrationSet,loadMigrations} from '@taptime/backend-schema';
import {isTimeRecordDetails} from '@taptime/mobile-work-contract';
import {TimeReviewCoordinator} from '../src/TimeReviewCoordinator.js';
import {TimeSupplementCoordinator} from '../src/TimeSupplementCoordinator.js';
import {ids,resetMigratePrepareAndSeed,runtimeConnectionString,DA3_READ_LOGIN,DA3_WRITE_LOGIN,tokens,verifier} from './fixtures.js';
const url=process.env.DA3_DATABASE_URL??'postgresql://timbartz@127.0.0.1:5432/taptime_da3';
const pool=new Pool({connectionString:url});
const read=new Pool({connectionString:runtimeConnectionString(url,DA3_READ_LOGIN,'t113-synthetic')});
const write=new Pool({connectionString:runtimeConnectionString(url,DA3_WRITE_LOGIN,'t113-synthetic')});
const supplements=new TimeSupplementCoordinator(write,verifier),reviews=new TimeReviewCoordinator(read,write,verifier);
const request=(reason:string|null,day='02')=>({expectedMembershipId:ids.membershipAdminA,targetMembershipId:ids.membershipAdminA,commandId:randomUUID(),targetType:'customer' as const,targetId:ids.customerA,startedAt:`2026-06-${day}T08:00:37.123Z`,stoppedAt:`2026-06-${day}T09:00:48.987Z`,reason,comment:null as string|null});
let oldRecord:string;
async function details(id:string){
 const c=await pool.connect();try{
  await c.query('BEGIN');await c.query(`SELECT set_config('app.organization_id',$1,true),set_config('app.user_id',$2,true),set_config('app.membership_id',$3,true)`,[ids.organizationA,ids.adminA,ids.membershipAdminA]);
  await c.query('SET LOCAL ROLE taptime_mobile_own_time_reader');
  return (await c.query('SELECT details FROM taptime_server.read_time_record_details_v1($1::uuid[])',[[id]])).rows[0].details;
 }finally{await c.query('ROLLBACK');c.release();}
}
beforeAll(async()=>{
 await resetMigratePrepareAndSeed(pool,'t113-synthetic','051');
 const legacy=await supplements.execute(tokens.adminA,'backfill',request('Historischer Grund'));
 if(legacy.status!=='committed')throw new Error('Legacy fixture not committed');oldRecord=legacy.timeRecordId;
 expect((await details(oldRecord)).change.actor).toBe('administration');
 const names=(await pool.query("SELECT tablename FROM pg_tables WHERE schemaname='taptime_server' ORDER BY tablename")).rows.map(r=>r.tablename);
 const rows=()=>Promise.all(names.map(name=>pool.query(`SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY to_jsonb(r)::text),'[]') AS data FROM taptime_server.${name} r`).then(r=>r.rows)));
 const funcs=()=>pool.query("SELECT proname,prosrc,proacl,proowner FROM pg_proc WHERE pronamespace='taptime_server'::regnamespace ORDER BY proname,pronargs").then(r=>r.rows);
 const beforeRows=await rows(),beforeFunctions=await funcs();
 const migration=(await loadMigrations()).filter(m=>m.version==='052');expect(migration).toHaveLength(1);
 await applyMigrationSet(pool,migration);
 expect(await rows()).toEqual(beforeRows);
 const changed=['backfill_time_record_v1','correct_time_record_v1','read_time_record_details_v1'];
 expect((await funcs()).filter(r=>!changed.includes(r.proname))).toEqual(beforeFunctions.filter(r=>!changed.includes(r.proname)));
 expect((await funcs()).map(({prosrc,...r})=>r)).toEqual(beforeFunctions.map(({prosrc,...r})=>r));
 expect((await applyMigrationSet(pool,migration)).applied).toEqual([]);
});
afterAll(async()=>{await Promise.all([read.end(),write.end(),pool.end()]);});
it('projects existing ownership as self without changing rows or response keys',async()=>{
 const value=await details(oldRecord);expect(value.change).toMatchObject({actor:'self',reason:'Historischer Grund'});
 expect(isTimeRecordDetails(value)).toBe(true);
});
it('uses the real coordinators for self/default reasons, comments, foreign rejection and idempotency',async()=>{
 const command={...request(null,'03'),comment:'Eigene Notiz'};
 const first=await supplements.execute(tokens.adminA,'backfill',command);expect(first.status).toBe('committed');if(first.status!=='committed')return;
 expect(await supplements.execute(tokens.adminA,'backfill',command)).toEqual({...first,idempotentRetry:true});
 expect((await details(first.timeRecordId))).toMatchObject({comment:'Eigene Notiz',change:{actor:'self',reason:'Selbst nachgetragen'}});
 const correction={expectedMembershipId:ids.membershipAdminA,commandId:randomUUID(),timeRecordId:first.timeRecordId,expectedBaseRowVersion:0,expectedRevisionNumber:1,startedAt:command.startedAt,stoppedAt:'2026-06-03T10:00:00.000Z',reason:null};
 const corrected=await reviews.correctTimeRecord({accessToken:tokens.adminA,request:correction});expect(corrected.status).toBe('committed');
 expect(await reviews.correctTimeRecord({accessToken:tokens.adminA,request:correction})).toMatchObject({status:'committed',value:{idempotentRetry:true}});
 const value=await details(first.timeRecordId);expect(value.change).toMatchObject({actor:'self',reason:'Selbst geändert'});expect(isTimeRecordDetails(value)).toBe(true);
 expect(await reviews.correctTimeRecord({accessToken:tokens.adminA,request:{...correction,commandId:randomUUID(),timeRecordId:ids.stoppedEntryA}})).toEqual({status:'reason_required'});
 expect(await supplements.execute(tokens.adminA,'backfill',{...request(null,'04'),targetMembershipId:ids.membershipEmployeeA})).toEqual({status:'reason_required'});
 const supplied=await reviews.correctTimeRecord({accessToken:tokens.adminA,request:{...correction,commandId:randomUUID(),expectedRevisionNumber:2,stoppedAt:'2026-06-03T11:00:00.000Z',reason:'Eigener Grund'}});expect(supplied.status).toBe('committed');
 expect((await details(first.timeRecordId)).change).toMatchObject({actor:'self',reason:'Eigener Grund'});
});
