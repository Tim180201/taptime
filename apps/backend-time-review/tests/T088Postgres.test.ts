import { randomUUID } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import { beforeAll, afterAll, expect, it } from 'vitest';
import { ids, resetMigratePrepareAndSeed } from './fixtures.js';

const pool = new Pool({connectionString:process.env.DA3_DATABASE_URL ?? 'postgresql://timbartz@127.0.0.1:5432/taptime_da3'});
const admin={org:ids.organizationA,user:ids.adminA,member:ids.membershipAdminA,role:'administrator'};
const employee={org:ids.organizationA,user:ids.employeeA,member:ids.membershipEmployeeA,role:'employee'};
const foreign={org:ids.organizationB,user:ids.adminB,member:ids.membershipAdminB,role:'administrator'};
type Actor={org:string;user:string;member:string;role:string};
const l1=randomUUID(),l2=randomUUID();
const manager={org:ids.organizationA,user:randomUUID(),member:randomUUID(),role:'standortleitung'};
const other={org:ids.organizationA,user:randomUUID(),member:randomUUID(),role:'employee'};
const ownManager=randomUUID(),otherRecord=randomUUID();
const request=(record:string=ids.stoppedEntryA,overrides={})=>({expectedMembershipId:employee.member,
  commandId:randomUUID(),timeRecordId:record,reasonCode:'duplicate',reasonText:null,...overrides});
async function context(c:PoolClient,who:Actor,role='taptime_time_review_writer') {
  await c.query(`SELECT set_config('app.organization_id',$1,true),set_config('app.user_id',$2,true),
    set_config('app.membership_id',$3,true),set_config('app.membership_role',$4,true)`,[who.org,who.user,who.member,who.role]);
  await c.query(`SET LOCAL ROLE ${role}`);
}
async function transaction(run:(c:PoolClient)=>Promise<void>) {
  const c=await pool.connect();try {await c.query('BEGIN');await run(c);}finally {await c.query('ROLLBACK');c.release();}
}
async function voidTime(c:PoolClient,who:Actor,record:string=ids.stoppedEntryA,overrides={}) {
  await context(c,who);
  return (await c.query('SELECT taptime_server.void_time_record_v1($1::jsonb) AS result',
    [JSON.stringify(request(record,{expectedMembershipId:who.member,...overrides}))])).rows[0]!.result;
}
async function history(c:PoolClient,who:Actor,target:string=who.member) {
  await context(c,who);
  return (await c.query(`SELECT taptime_server.read_voided_time_records_v1($1::jsonb) AS result`,[JSON.stringify({
    expectedMembershipId:who.member,targetMembershipId:target,fromInclusive:'2026-07-01T00:00:00.000Z',
    toExclusive:'2026-08-01T00:00:00.000Z',afterId:null,limit:100})])).rows[0]!.result;
}
beforeAll(async()=>{
  await resetMigratePrepareAndSeed(pool,'t088-synthetic');
  await pool.query(`INSERT INTO taptime_server.locations(id,organization_id,display_name) VALUES($1,$3,'A'),($2,$3,'B')`,[l1,l2,admin.org]);
  for(const who of [manager,other]) {
    await pool.query('INSERT INTO taptime_server.users(id) VALUES($1)',[who.user]);
    await pool.query(`INSERT INTO taptime_server.memberships(id,organization_id,user_id,role,display_name) VALUES($1,$2,$3,$4,$4)`,[who.member,who.org,who.user,who.role]);
  }
  await pool.query(`INSERT INTO taptime_server.membership_home_location_assignments(id,organization_id,membership_id,location_id)
    SELECT gen_random_uuid(),organization_id,id,CASE WHEN id=$3 THEN $2::uuid ELSE $1::uuid END FROM taptime_server.memberships WHERE organization_id=$4`,[l1,l2,other.member,admin.org]);
  await pool.query(`INSERT INTO taptime_server.work_target_location_assignments(id,organization_id,target_type,target_id,location_id)
    SELECT gen_random_uuid(),organization_id,target_type,target_id,$1 FROM taptime_server.work_targets WHERE organization_id=$2 AND active`,[l1,admin.org]);
  await pool.query(`INSERT INTO taptime_server.membership_management_location_grants(id,organization_id,membership_id,location_id) VALUES(gen_random_uuid(),$1,$2,$3)`,[admin.org,manager.member,l1]);
  await pool.query('UPDATE taptime_server.organizations SET locations_enabled=true,row_version=row_version+1 WHERE id=$1',[admin.org]);
  for(const [who,id] of [[manager,ownManager],[other,otherRecord]] as const) await pool.query(`INSERT INTO taptime_server.time_record_revisions
    (organization_id,time_record_id,revision_number,user_id,target_type,target_customer_id,effective_started_at,effective_stopped_at,base_row_version,actor_user_id,actor_membership_id,reason,command_id,request_hash)
    VALUES($1,$2,1,$3,'customer',$4,'2026-07-20T08:00:00Z','2026-07-20T09:00:00Z',0,$5,$6,'Nachtrag',gen_random_uuid(),repeat('a',64))`,[who.org,id,who.user,ids.customerA,admin.user,admin.member]);
});
afterAll(()=>pool.end());

it.each([
  ['employee own',employee,ids.stoppedEntryA,'committed'],['employee foreign person',employee,otherRecord,'forbidden'],
  ['manager own',manager,ownManager,'committed'],['manager home A',manager,ids.stoppedEntryA,'committed'],
  ['manager home B',manager,otherRecord,'forbidden'],['admin home B',admin,otherRecord,'committed'],
  ['other tenant',foreign,ids.stoppedEntryA,'forbidden'],['forged role',{...employee,role:'administrator'},otherRecord,'forbidden'],
] as const)('%s: SQL authority',async(_label,who,id,status)=>transaction(async c=>{
  expect(await voidTime(c,who,id)).toMatchObject({status});
}));
it('rejects revoked management grants and inactive membership/organization',async()=>transaction(async c=>{
  await c.query('UPDATE taptime_server.membership_management_location_grants SET revoked_at=clock_timestamp() WHERE membership_id=$1',[manager.member]);
  expect(await voidTime(c,manager)).toEqual({status:'forbidden'});
  await c.query('RESET ROLE');
  await c.query("UPDATE taptime_server.organizations SET status='paused',paused_at=clock_timestamp(),pause_reason='Testpause',row_version=row_version+1 WHERE id=$1",[admin.org]);
  expect(await voidTime(c,employee)).toEqual({status:'forbidden'});
}));
it('preserves command identity, rejects second voids and running entries',async()=>transaction(async c=>{
  expect(await voidTime(c,employee,ids.activeEntryA)).toEqual({status:'running'});
  const commandId=randomUUID();const first=await voidTime(c,employee,ids.stoppedEntryA,{commandId});
  expect(first).toMatchObject({status:'committed',idempotentRetry:false});
  expect(await voidTime(c,employee,ids.stoppedEntryA,{commandId})).toEqual({...first,idempotentRetry:true});
  expect(await voidTime(c,employee,ids.stoppedEntryA,{commandId,reasonCode:'misscan'})).toEqual({status:'command_id_conflict'});
  expect(await voidTime(c,employee,ids.activeEntryA,{commandId})).toEqual({status:'command_id_conflict'});
  expect(await voidTime(c,employee)).toEqual({status:'already_voided'});
}));
it.each([{reasonCode:'other',reasonText:null},{reasonCode:'other',reasonText:' '},{reasonCode:'other',reasonText:'x'.repeat(501)},
  {reasonCode:'unknown'},{reasonCode:'duplicate',reasonText:'unexpected'}])('rejects invalid reason %j in SQL',async extra=>transaction(async c=>{
  expect(await voidTime(c,employee,ids.stoppedEntryA,extra)).toEqual({status:'invalid_request'});
}));
it('retains immutable originals, revisions and who/when/why; history has its own visibility',async()=>transaction(async c=>{
  const snapshot=async()=>{await c.query('RESET ROLE');return (await c.query(`SELECT jsonb_build_object(
    'entries',(SELECT jsonb_agg(to_jsonb(e) ORDER BY id) FROM taptime_server.time_entries e),
    'revisions',(SELECT jsonb_agg(to_jsonb(r) ORDER BY time_record_id,revision_number) FROM taptime_server.time_record_revisions r)) AS value`)).rows[0]!.value;};
  const before=await snapshot();
  expect(await voidTime(c,employee)).toMatchObject({status:'committed'});
  expect(await snapshot()).toEqual(before);
  expect(await history(c,employee)).toMatchObject({status:'ready',records:[{timeRecordId:ids.stoppedEntryA,reasonCode:'duplicate',actorDisplayName:'Employee A'}]});
  expect(await history(c,manager,employee.member)).toMatchObject({status:'ready',records:[{timeRecordId:ids.stoppedEntryA}]});
  expect(await history(c,other,employee.member)).toEqual({status:'forbidden'});
  expect(await history(c,foreign,employee.member)).toEqual({status:'forbidden'});
  await c.query('RESET ROLE');
  for(const view of ['effective_time_records_v1','effective_time_records_v2'])expect((await c.query(`SELECT * FROM taptime_server.${view} WHERE time_record_id=$1`,[ids.stoppedEntryA])).rows).toEqual([]);
  expect((await c.query("SELECT * FROM taptime_server.audit_events WHERE event_type='TimeRecordVoided'")).rows).toHaveLength(1);
  await c.query('SAVEPOINT immutable');
  await expect(c.query("UPDATE taptime_server.time_record_voids SET reason_code='misscan'")).rejects.toMatchObject({code:'55000'});
  await c.query('ROLLBACK TO SAVEPOINT immutable');
  await expect(c.query('DELETE FROM taptime_server.time_record_voids')).rejects.toMatchObject({code:'55000'});
  await c.query('ROLLBACK TO SAVEPOINT immutable');
}));

it.each([[employee,ids.stoppedEntryA,true],[employee,otherRecord,false],[manager,otherRecord,false],
  [{...employee,role:'administrator'},otherRecord,false],[foreign,ids.stoppedEntryA,false]] as const)
  ('direct SQL INSERT enforces live membership, scope and RLS (%j)',async(who,id,allowed)=>transaction(async c=>{
    await context(c,who);
    const insert=()=>c.query(`INSERT INTO taptime_server.time_record_voids
      (organization_id,time_record_id,reason_code,reason_text,actor_membership_id,actor_role,command_id)
      VALUES($1,$2,'duplicate',NULL,$3,$4,$5)`,[who.org,id,who.member,who.role,randomUUID()]);
    if(allowed){await insert();expect((await c.query('SELECT * FROM taptime_server.time_record_voids')).rows).toHaveLength(1);await c.query('RESET ROLE');expect((await c.query("SELECT * FROM taptime_server.audit_events WHERE event_type='TimeRecordVoided'")).rows).toHaveLength(1);}
    else await expect(insert()).rejects.toMatchObject({code:'42501'});
  }));
it('forces RLS on every application table, including voids, and gives no UPDATE/DELETE/TRUNCATE',async()=>{
  const rows=(await pool.query(`SELECT relname,relrowsecurity,relforcerowsecurity FROM pg_class WHERE relnamespace='taptime_server'::regnamespace AND relkind='r'`)).rows;
  expect(rows.some(r=>r.relname==='time_record_voids')).toBe(true);expect(rows.every(r=>r.relrowsecurity&&r.relforcerowsecurity)).toBe(true);
  for(const privilege of ['UPDATE','DELETE','TRUNCATE'])expect((await pool.query(`SELECT has_table_privilege('taptime_time_review_writer','taptime_server.time_record_voids',$1) AS allowed`,[privilege])).rows[0]!.allowed).toBe(false);
});
it('a manager can void own time even when own home is outside management assignments',async()=>transaction(async c=>{
  await c.query('UPDATE taptime_server.membership_home_location_assignments SET revoked_at=clock_timestamp() WHERE membership_id=$1 AND revoked_at IS NULL',[manager.member]);
  await c.query('INSERT INTO taptime_server.membership_home_location_assignments(id,organization_id,membership_id,location_id) VALUES(gen_random_uuid(),$1,$2,$3)',[manager.org,manager.member,l2]);
  expect(await voidTime(c,manager,ownManager)).toMatchObject({status:'committed'});
}));
it('backfilled and corrected records remain as revisions; their old interval becomes available',async()=>transaction(async c=>{
  await context(c,admin);
  const corrected=(await c.query(`SELECT * FROM taptime_server.correct_time_record_v1($1,$2,$3,$4,repeat('b',64),$5,0,1,'2026-07-20T08:00:00Z','2026-07-20T10:00:00Z','Berichtigt')`,
    [admin.org,admin.user,admin.member,randomUUID(),ownManager])).rows[0];
  expect(corrected.result_status).toBe('committed');
  await c.query('RESET ROLE');
  const before=(await c.query('SELECT * FROM taptime_server.time_record_revisions WHERE time_record_id=$1 ORDER BY revision_number',[ownManager])).rows;
  expect(await voidTime(c,manager,ownManager,{reasonCode:'other',reasonText:'Falscher Tag'})).toMatchObject({status:'committed'});
  await c.query('RESET ROLE');expect((await c.query('SELECT * FROM taptime_server.time_record_revisions WHERE time_record_id=$1 ORDER BY revision_number',[ownManager])).rows).toEqual(before);
  await context(c,admin);
  const backfilled=(await c.query('SELECT taptime_server.backfill_time_record_v1($1::jsonb) AS result',[JSON.stringify({
    expectedMembershipId:admin.member,targetMembershipId:manager.member,commandId:randomUUID(),targetType:'customer',targetId:ids.customerA,
    startedAt:'2026-07-20T08:00:00.000Z',stoppedAt:'2026-07-20T10:00:00.000Z',reason:'Richtig nachtragen',comment:null})])).rows[0]!.result;
  expect(backfilled.status).toBe('committed');expect(await voidTime(c,manager,backfilled.timeRecordId)).toMatchObject({status:'committed'});
}));

it('removes precisely the voided seconds from calendar, customer hours, quota and actual CSV v3/v4',async()=>{
  const {TimeEntryExportCoordinator}=await import('@taptime/backend-time-export');
  const {tokens,verifier}=await import('./fixtures.js');
  const target=randomUUID();
  const c=await pool.connect();let removed:string,kept:string;
  const from='2026-06-30T22:00:00.000Z',to='2026-07-31T22:00:00.000Z';
  try {
    await c.query('BEGIN');
    await c.query("INSERT INTO taptime_server.customers(id,organization_id,display_name,active) VALUES($1,$2,'Storno-Summenprobe',true)",[target,admin.org]);
    await c.query("INSERT INTO taptime_server.work_target_location_assignments(id,organization_id,target_type,target_id,location_id) VALUES(gen_random_uuid(),$1,'customer',$2,$3)",[admin.org,target,l1]);
    await c.query(`INSERT INTO taptime_server.customer_quota_settings(organization_id,customer_id,minutes,set_at,actor_membership_id,actor_role,command_id)
      VALUES($1,$2,240,'2026-07-01T00:00:00Z',$3,'administrator',gen_random_uuid())`,[admin.org,target,admin.member]);
    const backfill=async(start:string,end:string)=>{
      await context(c,admin);const result=(await c.query('SELECT taptime_server.backfill_time_record_v1($1::jsonb) AS result',[JSON.stringify({
        expectedMembershipId:admin.member,targetMembershipId:admin.member,commandId:randomUUID(),targetType:'customer',targetId:target,
        startedAt:start,stoppedAt:end,reason:'Summenprobe',comment:null})])).rows[0]!.result;
      expect(result.status).toBe('committed');return result.timeRecordId as string;
    };
    removed=await backfill('2026-07-05T08:00:00.000Z','2026-07-05T11:00:00.000Z');
    kept=await backfill('2026-07-06T08:00:00.000Z','2026-07-06T09:00:00.000Z');
    await c.query('COMMIT');
  }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
  const exporter=new TimeEntryExportCoordinator(pool,verifier);
  const csv=async(version:3|4)=>{
    const result=await (version===3?exporter.exportTimeEntriesV3:exporter.exportTimeEntriesV4).call(exporter,
      {accessToken:tokens.adminA,correlationId:randomUUID(),request:{expectedMembershipId:admin.member,fromInclusive:from,toExclusive:to}});
    expect(result.status).toBe('succeeded');if(result.status!=='succeeded')throw new Error('CSV failed');
    return Buffer.from(result.bytes).toString('utf8').split('\r\n');
  };
  const beforeCsv=await Promise.all([csv(3),csv(4)]);
  await transaction(async c=>{
    const read=async()=>{
      await context(c,admin,'taptime_mobile_own_time_reader');
      const calendar=(await c.query('SELECT * FROM taptime_server.read_time_record_calendar_v1($1::uuid[])',[[removed,kept]])).rows;
      await context(c,admin,'taptime_mobile_own_time_reader');
      const customers=(await c.query('SELECT taptime_server.read_customer_hours_v2($1,$2) AS result',[from,to])).rows[0]!.result.customers;
      return {calendar,customer:customers.find((r:{customerId:string})=>r.customerId===target)};
    };
    const before=await read();expect(before.customer).toMatchObject({workDurationSeconds:14400,quotaStage:'exceeded'});
    expect(before.calendar.reduce((sum,r)=>sum+r.calendar.workDurationSeconds,0)).toBe(14400);
    expect(await voidTime(c,admin,removed)).toMatchObject({status:'committed'});
    const after=await read();expect(after.customer).toMatchObject({workDurationSeconds:3600,quotaStage:'ok'});
    expect(after.calendar).toEqual(before.calendar.filter(r=>r.time_record_id!==removed));
    // Commit this single cancellation so the production export coordinator can
    // use independent real transactions and exercise both serializers/audits.
    await c.query('COMMIT');
  });
  const afterCsv=await Promise.all([csv(3),csv(4)]);
  for(let i=0;i<2;i++){
    const parse=(line:string)=>[...line.matchAll(/"((?:[^"]|"")*)"(?:;|$)/g)].map(match=>match[1]!.replaceAll('""','"'));
    const durationColumn=parse(beforeCsv[i]![0]!).indexOf('effective_work_duration_seconds');
    expect(durationColumn).toBeGreaterThanOrEqual(0);
    const total=(lines:string[])=>lines.filter(line=>line.includes('Storno-Summenprobe')).reduce((sum,line)=>sum+Number(parse(line)[durationColumn]),0);
    expect(total(beforeCsv[i]!)).toBe(14400);expect(total(afterCsv[i]!)).toBe(3600);
    expect(beforeCsv[i]!.some(line=>line.includes('2026-07-05T08:00:00.')&&line.includes('Storno-Summenprobe'))).toBe(true);
    expect(afterCsv[i]!.some(line=>line.includes('2026-07-05T08:00:00.')&&line.includes('Storno-Summenprobe'))).toBe(false);
    // A running fixture has a time-dependent duration; the unaffected stopped
    // row must be byte-identical in each version.
    expect(afterCsv[i]!.find(line=>line.includes('2026-07-06T08:00:00.')&&line.includes('Storno-Summenprobe'))).toBe(beforeCsv[i]!.find(line=>line.includes('2026-07-06T08:00:00.')&&line.includes('Storno-Summenprobe')));
  }
});

it('uses the real least-privilege runtime login and serializes two simultaneous cancellations',async()=>{
  const {TimeVoidCoordinator}=await import('../src/TimeVoidCoordinator.js');
  const {DA3_WRITE_LOGIN,runtimeConnectionString,verifier,tokens}=await import('./fixtures.js');
  const runtime=new Pool({connectionString:runtimeConnectionString(pool.options.connectionString!,DA3_WRITE_LOGIN,'t088-synthetic')});
  try {
    const service=new TimeVoidCoordinator(runtime,verifier);
    expect(await service.void(tokens.employeeA,request(otherRecord,{expectedMembershipId:admin.member}))).toEqual({status:'authority_rejected'});
    expect(await service.void(tokens.employeeA,request(otherRecord))).toEqual({status:'forbidden'});
    const input=request(otherRecord,{expectedMembershipId:admin.member});
    const results=await Promise.all([service.void(tokens.adminA,input),service.void(tokens.adminA,{...input,commandId:randomUUID()})]);
    expect(results.map(r=>r.status).sort()).toEqual(['already_voided','committed']);
    expect(await service.query(tokens.adminA,{expectedMembershipId:admin.member,targetMembershipId:other.member,
      fromInclusive:'2026-07-20T00:00:00.000Z',toExclusive:'2026-07-21T00:00:00.000Z',afterId:null,limit:1})).toMatchObject({status:'ready',records:[{timeRecordId:otherRecord}],nextAfterId:null});
  }finally{await runtime.end();}
});
it('paginates history within the requested person and window and rejects oversized ranges',async()=>transaction(async c=>{
  expect(await voidTime(c,employee)).toMatchObject({status:'committed'});
  await context(c,employee);
  const query={expectedMembershipId:employee.member,targetMembershipId:employee.member,
    fromInclusive:'2026-07-01T00:00:00.000Z',toExclusive:'2026-08-01T00:00:00.000Z',afterId:null,limit:1};
  const read=async(extra={})=>(await c.query('SELECT taptime_server.read_voided_time_records_v1($1::jsonb) AS result',[JSON.stringify({...query,...extra})])).rows[0]!.result;
  const page=await read();expect(page.records).toHaveLength(1);expect(page.nextAfterId).toBeNull();
  expect(await read({afterId:page.records[0].timeRecordId})).toEqual({status:'ready',records:[],nextAfterId:null});
  expect(await read({toExclusive:'2027-01-01T00:00:00.000Z'})).toEqual({status:'invalid_request'});
  expect(await read({fromInclusive:'2026-07-30T00:00:00.000Z'})).toEqual({status:'ready',records:[],nextAfterId:null});
}));

it('replays the identical request after a membership role change without rewriting the original audit role',async()=>transaction(async c=>{
  const commandId=randomUUID();expect(await voidTime(c,employee,ids.stoppedEntryA,{commandId})).toMatchObject({status:'committed',idempotentRetry:false});
  await c.query('RESET ROLE');await c.query("UPDATE taptime_server.memberships SET role='administrator',row_version=row_version+1 WHERE id=$1",[employee.member]);
  expect(await voidTime(c,{...employee,role:'administrator'},ids.stoppedEntryA,{commandId})).toMatchObject({status:'committed',idempotentRetry:true});
  await c.query('RESET ROLE');expect((await c.query('SELECT actor_role FROM taptime_server.time_record_voids WHERE command_id=$1',[commandId])).rows).toEqual([{actor_role:'employee'}]);
}));

// D-100 uses WorkEvent.occurred_at (not receipt/audit time) and the latest interval.
type ReviewSource='legacy'|'canonical'|'offline';
const reviewSources:ReviewSource[]=['legacy','canonical','offline'];
async function prepareReview(c:PoolClient,source:ReviewSource,who:Actor,at:string) {
  await c.query('RESET ROLE');const event=randomUUID();
  await c.query(`INSERT INTO taptime_server.work_events(id,organization_id,triggered_by_user_id,target_type,target_customer_id,
    occurred_at,received_at,trigger_type,content_hash,content_hash_algorithm,content_hash_version)
    VALUES($1,$2,$3,'customer',$4,$5,'2026-09-28T10:00:00Z','manual',repeat('d',64),'sha256',2)`,[event,who.org,who.user,ids.customerA,at]);
  let open:()=>Promise<unknown>;
  if(source==='canonical')open=()=>c.query(`INSERT INTO taptime_server.canonical_decisions(work_event_id,organization_id,actor_user_id,target_type,
    target_customer_id,decision_type,reason,engine_version,decision_payload) VALUES($1,$2,$3,'customer',$4,'escalation_required',
    'work_event_precedes_active_time_entry','d100','{}')`,[event,who.org,who.user,ids.customerA]);
  else if(source==='legacy')open=()=>c.query(`INSERT INTO taptime_server.audit_events(id,organization_id,actor_user_id,work_event_user_id,work_event_id,
    event_type,entity_type,entity_id,occurred_at,correlation_id,payload) VALUES(gen_random_uuid(),$1,$2,$2,$3,'LifecycleDeferred','WorkEvent',$3,
    '2026-09-28T10:00:00Z','d100','{}')`,[who.org,who.user,event]);
  else {
    let binding=(await c.query('SELECT id FROM taptime_server.identity_bindings WHERE user_id=$1 LIMIT 1',[who.user])).rows[0]?.id as string|undefined;
    if(!binding){binding=randomUUID();await c.query("INSERT INTO taptime_server.identity_bindings(id,user_id,issuer,subject) VALUES($1,$2,'https://d100.invalid',$3)",[binding,who.user,randomUUID()]);}
    const installation=randomUUID(),lease=randomUUID(),item=randomUUID(),receipt=randomUUID();
    await c.query(`INSERT INTO taptime_server.offline_installations(id,organization_id,user_id,membership_id,identity_binding_id,binding_digest)
      VALUES($1,$2,$3,$4,$5,decode(repeat(replace($1::uuid::text,'-',''),2),'hex'))`,[installation,who.org,who.user,who.member,binding]);
    await c.query(`INSERT INTO taptime_server.offline_capture_leases(id,organization_id,installation_id,identity_binding_id,user_id,membership_id,
      membership_row_version,membership_role,issued_at,expires_at,configuration_revision,item_count,serialized_bytes,manifest_digest)
      VALUES($1,$2,$3,$4,$5,$6,1,$7,'2026-07-20T00:00:00Z','2026-07-20T12:00:00Z',repeat('a',64),1,1,repeat('b',64))`,[lease,who.org,installation,binding,who.user,who.member,who.role]);
    await c.query(`INSERT INTO taptime_server.offline_capture_lease_items(id,organization_id,lease_id,installation_id,lookup_value,assignment_id,nfc_tag_id,
      target_type,target_customer_id,display_name,assignment_row_version,target_row_version)
      VALUES($1,$2,$3,$4,repeat('c',64),$5,$6,'customer',$7,'Customer A',1,1)`,[item,who.org,lease,installation,ids.assignmentA,ids.tagA,ids.customerA]);
    await c.query(`INSERT INTO taptime_server.sync_receipts(id,organization_id,user_id,target_type,target_customer_id,work_event_id,attempt_number,status)
      VALUES($1,$2,$3,'customer',$4,$5,1,'received')`,[receipt,who.org,who.user,ids.customerA,event]);
    await c.query(`INSERT INTO taptime_server.offline_sync_cursors(organization_id,installation_id,user_id,membership_id,last_durable_sequence,review_predecessor_sequence)
      VALUES($1,$2,$3,$4,1,1)`,[who.org,installation,who.user,who.member]);
    open=()=>c.query(`INSERT INTO taptime_server.offline_event_reconciliations(organization_id,work_event_id,receipt_id,installation_id,lease_id,lease_item_id,
      user_id,membership_id,device_sequence,request_content_hash,boot_marker,monotonic_anchor_milliseconds,monotonic_delta_milliseconds,wall_clock_anchor,
      clock_proof_status,clock_proof_version,provenance_version,result_status,review_reason)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,1,repeat('d',64),'d100',0,0,'2026-07-20T00:00:00Z','review_only',1,1,'review_pending','capture_time_out_of_bounds')`,
      [who.org,event,receipt,installation,lease,item,who.user,who.member]);
  }
  return {event,open};
}
const reviewPositions=[['begin','08:00:00','review_open'],['inside','12:00:00','review_open'],['end','16:00:00','review_open'],
  ['one second before','07:59:59','committed'],['one second after','16:00:01','committed']] as const;
it.each(reviewSources.flatMap(source=>reviewPositions.map(([label,time,status])=>({source,label,time,status}))))(
  'D-100 $source at $label uses inclusive effective bounds',async({source,time,status})=>transaction(async c=>{
    await (await prepareReview(c,source,employee,`2026-07-20T${time}Z`)).open();
    expect(await voidTime(c,employee)).toMatchObject({status});
  }));
it.each(reviewSources)('D-100 %s for a different person never blocks',async source=>transaction(async c=>{
  await (await prepareReview(c,source,manager,'2026-07-20T12:00:00Z')).open();
  expect(await voidTime(c,employee)).toMatchObject({status:'committed'});
}));
it.each(reviewSources)('D-100 %s permits cancellation after a real adjudication',async source=>transaction(async c=>{
  const review=await prepareReview(c,source,employee,'2026-07-20T12:00:00Z');await review.open();
  expect(await voidTime(c,employee)).toEqual({status:'review_open'});
  await context(c,admin);
  const result=(await c.query(`SELECT * FROM taptime_server.adjudicate_time_review_items_v1($1,$2,$3,$4,repeat('a',64),$5::uuid[],
    'no_time_record_change',NULL,NULL,NULL,NULL,NULL,'Fall entschieden')`,[admin.org,admin.user,admin.member,randomUUID(),[review.event]])).rows[0];
  expect(result.result_status).toBe('committed');
  expect(await voidTime(c,employee)).toMatchObject({status:'committed'});
}));
it.each(reviewSources.flatMap(source=>[{source,time:'11:00:00',status:'review_open'},{source,time:'08:30:00',status:'committed'}]))(
  'D-100 $source at $time uses corrected interval rather than original',async({source,time,status})=>transaction(async c=>{
    await context(c,admin);
    const corrected=(await c.query(`SELECT * FROM taptime_server.correct_time_record_v1($1,$2,$3,$4,repeat('b',64),$5,0,1,
      '2026-07-20T10:00:00Z','2026-07-20T12:00:00Z','Intervall berichtigt')`,[admin.org,admin.user,admin.member,randomUUID(),ownManager])).rows[0];
    expect(corrected.result_status).toBe('committed');
    await (await prepareReview(c,source,manager,`2026-07-20T${time}Z`)).open();
    expect(await voidTime(c,manager,ownManager)).toMatchObject({status});
  }));
it.each(reviewSources)('D-100 %s also rejects direct capability-role INSERT',async source=>transaction(async c=>{
  await (await prepareReview(c,source,employee,'2026-07-20T12:00:00Z')).open();await context(c,employee);
  await expect(c.query(`INSERT INTO taptime_server.time_record_voids(organization_id,time_record_id,reason_code,actor_membership_id,actor_role,command_id)
    VALUES($1,$2,'duplicate',$3,$4,$5)`,[employee.org,ids.stoppedEntryA,employee.member,employee.role,randomUUID()])).rejects.toMatchObject({code:'23514',message:'review_open'});
}));

async function racePerson() {
  const who:Actor={org:admin.org,user:randomUUID(),member:randomUUID(),role:'employee'},record=randomUUID();
  const c=await pool.connect();try{await c.query('BEGIN');
  await c.query('INSERT INTO taptime_server.users(id) VALUES($1)',[who.user]);
  await c.query("INSERT INTO taptime_server.memberships(id,organization_id,user_id,role) VALUES($1,$2,$3,'employee')",[who.member,who.org,who.user]);
  await c.query('INSERT INTO taptime_server.membership_home_location_assignments(id,organization_id,membership_id,location_id) VALUES(gen_random_uuid(),$1,$2,$3)',[who.org,who.member,l1]);
  await c.query(`INSERT INTO taptime_server.time_record_revisions(organization_id,time_record_id,revision_number,user_id,target_type,target_customer_id,
    effective_started_at,effective_stopped_at,base_row_version,actor_user_id,actor_membership_id,reason,command_id,request_hash)
    VALUES($1,$2,1,$3,'customer',$4,'2026-07-20T08:00:00Z','2026-07-20T16:00:00Z',0,$5,$6,'Testeintrag',gen_random_uuid(),repeat('a',64))`,[who.org,record,who.user,ids.customerA,admin.user,admin.member]);
  await c.query('COMMIT');return {who,record};
  }finally{await c.query('ROLLBACK');c.release();}
}
async function expectAdvisoryWait(waiter:number,blocker:number) {
  const until=Date.now()+2000;
  do {
    const state=(await pool.query(`SELECT wait_event,pg_blocking_pids(pid) AS blockers FROM pg_stat_activity WHERE pid=$1`,[waiter])).rows[0];
    if(state?.wait_event==='advisory'&&state.blockers.includes(blocker))return;
    await new Promise(resolve=>setTimeout(resolve,10));
  }while(Date.now()<until);
  throw new Error('Expected a real PostgreSQL advisory wait on the competing transaction');
}
it.each(reviewSources.flatMap(source=>(['function','direct'] as const).flatMap(write=>(['review','void'] as const).map(first=>({source,write,first})))))(
  'D-100 concurrent $source versus $write, $first obtains lock first',async({source,write,first})=>{
    const {who,record}=await racePerson(),creator=await pool.connect(),canceller=await pool.connect();
    try {
      await creator.query('BEGIN');await canceller.query('BEGIN');
      for(const c of [creator,canceller])await c.query("SET LOCAL statement_timeout='8s'");
      const creatorPid=(await creator.query('SELECT pg_backend_pid() AS pid')).rows[0].pid as number;
      const cancellerPid=(await canceller.query('SELECT pg_backend_pid() AS pid')).rows[0].pid as number;
      const review=await prepareReview(creator,source,who,'2026-07-20T12:00:00Z');
      const cancel=async()=>{
        if(write==='function')return voidTime(canceller,who,record);
        await context(canceller,who);await canceller.query(`INSERT INTO taptime_server.time_record_voids
          (organization_id,time_record_id,reason_code,actor_membership_id,actor_role,command_id) VALUES($1,$2,'duplicate',$3,$4,$5)`,[who.org,record,who.member,who.role,randomUUID()]);
        return {status:'committed'};
      };
      if(first==='review') {
        await review.open();
        const pending=cancel().then(result=>({result,error:null}),error=>({result:null,error}));
        await expectAdvisoryWait(cancellerPid,creatorPid);
        await creator.query('COMMIT');const outcome=await pending;
        if(write==='function')expect(outcome.result).toEqual({status:'review_open'});
        else expect(outcome.error).toMatchObject({code:'23514',message:'review_open'});
        await canceller.query('ROLLBACK');
        expect((await pool.query('SELECT * FROM taptime_server.time_record_voids WHERE time_record_id=$1',[record])).rows).toEqual([]);
      } else {
        expect(await cancel()).toMatchObject({status:'committed'});
        const pending=review.open();
        await expectAdvisoryWait(creatorPid,cancellerPid);await canceller.query('COMMIT');await pending;await creator.query('COMMIT');
        expect((await pool.query('SELECT * FROM taptime_server.time_record_voids WHERE time_record_id=$1',[record])).rows).toHaveLength(1);
        expect((await pool.query('SELECT * FROM taptime_server.work_events WHERE id=$1',[review.event])).rows).toHaveLength(1);
      }
    }finally{
      await Promise.all([creator.query('ROLLBACK'),canceller.query('ROLLBACK')]);creator.release();canceller.release();
    }
  });
it('D-100 refuses a stale repeatable-read snapshot for function and direct INSERT',async()=>{
  const c=await pool.connect();try {
    await c.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
    expect(await voidTime(c,employee)).toEqual({status:'invalid_request'});
    await expect(c.query(`INSERT INTO taptime_server.time_record_voids(organization_id,time_record_id,reason_code,actor_membership_id,actor_role,command_id)
      VALUES($1,$2,'duplicate',$3,$4,$5)`,[employee.org,ids.stoppedEntryA,employee.member,employee.role,randomUUID()])).rejects.toMatchObject({code:'25001'});
  }finally{await c.query('ROLLBACK');c.release();}
});

it.each(['\u0001','\u0085','\u200b','\u00a0\t'])('T106 rejects invisible void reason in SQL %j',async reasonText=>transaction(async c=>{
  expect(await voidTime(c,employee,ids.stoppedEntryA,{reasonCode:'other',reasonText})).toEqual({status:'invalid_request'});
  expect((await c.query('SELECT * FROM taptime_server.time_record_voids')).rows).toEqual([]);
}));
