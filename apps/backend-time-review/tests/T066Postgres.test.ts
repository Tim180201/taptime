import { applyMigrationSet, loadMigrations } from '@taptime/backend-schema';
import { randomUUID } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { ids, resetMigratePrepareAndSeed } from './fixtures.js';

const pool = new Pool({ connectionString: process.env.DA3_DATABASE_URL ?? 'postgresql://timbartz@127.0.0.1:5432/taptime_da3' });
interface Actor { user:string; membership:string; role:string; org:string }
const admin: Actor = { user: ids.adminA, membership: ids.membershipAdminA, role: 'administrator', org: ids.organizationA };
const employee = { user: randomUUID(), membership: randomUUID(), role: 'employee', org: ids.organizationA };
const manager = { user: randomUUID(), membership: randomUUID(), role: 'standortleitung', org: ids.organizationA };
const foreign = { user: ids.adminB, membership: ids.membershipAdminB, role: 'administrator', org: ids.organizationB };
const iso = (d: Date) => d.toISOString();
const interval = (days: number, hours = 1) => {
  const start = new Date(); start.setUTCDate(start.getUTCDate() - days); start.setUTCHours(8,0,0,0);
  return { startedAt: iso(start), stoppedAt: iso(new Date(+start + hours * 3600000)) };
};
function input(overrides: Record<string, unknown> = {}) {
  return { expectedMembershipId: admin.membership, targetMembershipId: admin.membership,
    commandId: randomUUID(), targetType: 'customer', targetId: ids.customerA,
    ...interval(2), reason: 'Vergessener Tag', comment: null, ...overrides };
}
async function actor<T>(who: Actor, role: string, run: (c: PoolClient) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    await c.query(`SELECT set_config('app.organization_id',$1,true),set_config('app.user_id',$2,true),
      set_config('app.membership_id',$3,true),set_config('app.membership_role',$4,true)`,
    [who.org,who.user,who.membership,who.role]);
    await c.query(`SET LOCAL ROLE ${role}`);
    const result = await run(c); await c.query('COMMIT'); return result;
  } catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
}
const write = (who: Actor, request = input()) => actor(who,'taptime_time_review_writer', async c =>
  (await c.query('SELECT taptime_server.backfill_time_record_v1($1::jsonb) AS result',[JSON.stringify(request)])).rows[0]!.result);
const comment = (who: Actor, timeRecordId: string, text: string, commandId = randomUUID()) =>
  actor(who,'taptime_time_review_writer', async c => (await c.query(
    'SELECT taptime_server.comment_time_record_v1($1::jsonb) AS result',
    [JSON.stringify({expectedMembershipId:who.membership,timeRecordId,comment:text,commandId})])).rows[0]!.result);
const details = (who: Actor, recordIds: string[]) => actor(who,'taptime_mobile_own_time_reader', async c =>
  (await c.query('SELECT * FROM taptime_server.read_time_record_details_v1($1::uuid[])',[recordIds])).rows);

beforeAll(async () => {
  await resetMigratePrepareAndSeed(pool,'t066-synthetic','029');
  const tables=(await pool.query("SELECT tablename FROM pg_tables WHERE schemaname='taptime_server' ORDER BY tablename")).rows;
  const snapshot=async()=>Promise.all(tables.map(async ({tablename})=>(await pool.query(
    `SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY to_jsonb(r)::text),'[]') AS rows FROM taptime_server.${tablename} r`)).rows));
  const before=await snapshot();
  const definition=async()=> (await pool.query("SELECT pg_get_functiondef('taptime_server.read_effective_time_entry_export_v3(uuid,timestamptz,timestamptz,integer)'::regprocedure) AS definition")).rows;
  const beforeV3=await definition();
  await applyMigrationSet(pool,(await loadMigrations()).filter(m=>m.version==='030'));
  expect(await snapshot()).toEqual(before);
  expect(await definition()).toEqual(beforeV3);
  for (const who of [employee,manager]) {
    await pool.query('INSERT INTO taptime_server.users(id) VALUES ($1)',[who.user]);
    await pool.query(`INSERT INTO taptime_server.memberships(id,organization_id,user_id,role) VALUES ($1,$2,$3,$4)`,
      [who.membership,who.org,who.user,who.role]);
  }
});
afterAll(() => pool.end());

it.each([
  ['employee for another',employee,{},'authority_rejected'],
  ['employee outside month',employee,{targetMembershipId:employee.membership,...interval(100)},'outside_window'],
  ['administrator without reason',admin,{reason:' '},'reason_required'],
  ['location manager',manager,{targetMembershipId:manager.membership},'authority_rejected'],
  ['foreign tenant',foreign,{},'authority_rejected'],
  ['foreign target',admin,{targetId:ids.customerB},'authority_rejected'],
  ['future',admin,{...interval(-1)},'invalid_interval'],
  ['empty',admin,{...interval(1,0)},'invalid_interval'],
  ['reversed',admin,{...interval(1,-1)},'invalid_interval'],
  ['over 24 hours',admin,{...interval(3,24.001)},'invalid_interval'],
  ['canonical overlap',admin,{targetMembershipId:ids.membershipEmployeeA,startedAt:'2026-07-20T09:00:00.000Z',stoppedAt:'2026-07-20T10:00:00.000Z'},'overlap'],
  ['running overlap',admin,{targetMembershipId:ids.membershipEmployeeA,...interval(1)},'overlap'],
] as const)('rejects %s at the SQL boundary',async (_name,who,overrides,status) => {
  expect(await write(who,input({expectedMembershipId:who.membership,...overrides}))).toMatchObject({status});
});
it('creates revision 1 without WorkEvent, deduplicates commands, rejects a conflicting payload and overlap',async () => {
  const before = (await pool.query('SELECT * FROM taptime_server.work_events ORDER BY id')).rows;
  const request = input({...interval(5)});
  const first = await write(admin,request);
  expect(first).toMatchObject({status:'committed',idempotentRetry:false});
  expect(await write(admin,request)).toEqual({...first,idempotentRetry:true});
  expect(await write(admin,{...request,reason:'Anders'})).toMatchObject({status:'command_id_conflict'});
  expect(await write(admin,input({...interval(5)}))).toMatchObject({status:'overlap'});
  expect((await pool.query('SELECT * FROM taptime_server.work_events ORDER BY id')).rows).toEqual(before);
  expect((await pool.query('SELECT revision_number,canonical_time_entry_id FROM taptime_server.time_record_revisions WHERE time_record_id=$1',[first.timeRecordId])).rows)
    .toEqual([{revision_number:'1',canonical_time_entry_id:null}]);
  expect(await details(admin,[first.timeRecordId])).toMatchObject([{details:{origin:'backfilled',changed:false,overlapsAnotherRecord:false}}]);
  const moved = interval(6);
  await actor(admin,'taptime_time_review_writer',c=>c.query(`SELECT * FROM taptime_server.correct_time_record_v1($1,$2,$3,$4,repeat('b',64),$5,0,1,$6,$7,'Ende berichtigt')`,
    [admin.org,admin.user,admin.membership,randomUUID(),first.timeRecordId,moved.startedAt,moved.stoppedAt]));
  expect(await details(admin,[first.timeRecordId])).toMatchObject([{details:{origin:'backfilled',changed:true,change:{reason:'Ende berichtigt',actor:'administration'}}}]);
});
it('allows employee current/previous Berlin month and admin unlimited past/exactly 24h',async () => {
  const now = new Date(); const berlin = new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit'}).formatToParts(now);
  const y=Number(berlin.find(p=>p.type==='year')!.value),m=Number(berlin.find(p=>p.type==='month')!.value);
  for (const startedAt of [interval(1).startedAt,new Date(Date.UTC(y,m-2,15,8)).toISOString()]) {
    expect(await write(employee,input({expectedMembershipId:employee.membership,targetMembershipId:employee.membership,
      startedAt,stoppedAt:new Date(Date.parse(startedAt)+3600000).toISOString(),reason:null,comment:'Vergessen'})))
      .toMatchObject({status:'committed'});
  }
  expect(await write(admin,input({...interval(100,24)}))).toMatchObject({status:'committed'});
});
it('rejects recovered overlap and marks both entries if a later recovery overlaps backfilled time',async () => {
  const backfilled = await write(admin,input({...interval(10)}));
  expect(backfilled.status).toBe('committed');
  const recovered = randomUUID(); const times=interval(10);
  await pool.query(`INSERT INTO taptime_server.time_record_revisions
    (organization_id,time_record_id,revision_number,user_id,target_type,target_customer_id,effective_started_at,effective_stopped_at,
    base_row_version,actor_user_id,actor_membership_id,reason,command_id,request_hash)
    VALUES ($1,$2,1,$3,'customer',$4,$5,$6,0,$3,$7,'Wiederhergestellt',$8,repeat('a',64))`,
  [admin.org,recovered,admin.user,ids.customerA,times.startedAt,times.stoppedAt,admin.membership,randomUUID()]);
  expect(await write(admin,input(times))).toMatchObject({status:'overlap'});
  const rows=await details(admin,[backfilled.timeRecordId,recovered]);
  expect(rows.map(r=>r.details.origin).sort()).toEqual(['backfilled','recovered']);
  expect(rows.every(r=>r.details.overlapsAnotherRecord)).toBe(true);
});
it('rejects foreign comments and stores immutable own comment history with idempotency',async () => {
  const own = {user:ids.employeeA,membership:ids.membershipEmployeeA,role:'employee',org:ids.organizationA};
  for (const who of [admin,foreign,employee,manager]) {
    expect(await comment(who,ids.stoppedEntryA,'Fremd')).toMatchObject({status:'authority_rejected'});
  }
  for (const text of ['', ' ', 'x'.repeat(501)]) expect(await comment(own,ids.stoppedEntryA,text)).toMatchObject({status:'invalid_comment'});
  const commandId=randomUUID(); const first=await comment(own,ids.stoppedEntryA,'Erste Fassung',commandId);
  expect(first).toMatchObject({status:'committed',idempotentRetry:false});
  expect(await comment(own,ids.stoppedEntryA,'Erste Fassung',commandId)).toEqual({...first,idempotentRetry:true});
  expect(await comment(own,ids.stoppedEntryA,'Anders',commandId)).toMatchObject({status:'command_id_conflict'});
  expect(await comment(own,ids.stoppedEntryA,'x'.repeat(500))).toMatchObject({status:'committed'});
  expect((await pool.query('SELECT comment FROM taptime_server.time_record_comments WHERE time_record_id=$1 ORDER BY comment_number',[ids.stoppedEntryA])).rows)
    .toEqual([{comment:'Erste Fassung'},{comment:'x'.repeat(500)}]);
  expect(await details(foreign,[ids.stoppedEntryA])).toEqual([]);
  expect(await details(own,[ids.stoppedEntryA])).toMatchObject([{details:{comment:'x'.repeat(500)}}]);
  await expect(pool.query("UPDATE taptime_server.time_record_comments SET comment='Ersetzt'")).rejects.toMatchObject({code:'55000'});
});
it('serializes concurrent overlapping backfills',async () => {
  const results=await Promise.all([write(admin,input({...interval(12)})),write(admin,input({...interval(12)}))]);
  expect(results.map(r=>r.status).sort()).toEqual(['committed','overlap']);
});
it('enables and forces RLS on every application table',async () => {
  const rows=(await pool.query(`SELECT relname,relrowsecurity,relforcerowsecurity FROM pg_class
    WHERE relnamespace='taptime_server'::regnamespace AND relkind='r'`)).rows;
  expect(rows.some(r=>r.relname==='time_record_origins')).toBe(true);
  expect(rows.every(r=>r.relrowsecurity && r.relforcerowsecurity)).toBe(true);
});

it('reads the whole previous Berlin month only in the new own-time representation',async()=>{
  const rows=await actor(employee,'taptime_mobile_own_time_reader',c=>c.query(`SELECT * FROM taptime_server.read_mobile_own_time_v2($1,$2,$3,NULL,NULL,NULL,NULL,21)`,[employee.org,employee.user,employee.membership]));
  expect(rows.rows.length).toBeGreaterThan(1);
  const boundary=(await pool.query("SELECT (date_trunc('month',transaction_timestamp() AT TIME ZONE 'Europe/Berlin')-interval '1 month') AT TIME ZONE 'Europe/Berlin' AS boundary")).rows[0].boundary;
  expect(rows.rows.every(r=>+r.window_started_at===+boundary)).toBe(true);
});

it('resolves live token authority through the runtime login and rejects stale or forged membership',async()=>{
  const {TimeSupplementCoordinator}=await import('../src/TimeSupplementCoordinator.js');
  const {DA3_WRITE_LOGIN,runtimeConnectionString,tokens,verifier}=await import('./fixtures.js');
  const runtime=new Pool({connectionString:runtimeConnectionString(pool.options.connectionString!,DA3_WRITE_LOGIN,'t066-synthetic')});
  try {
    const coordinator=new TimeSupplementCoordinator(runtime,verifier);
    expect(await coordinator.execute(tokens.rejected,'backfill',input())).toEqual({status:'authority_rejected'});
    expect(await coordinator.execute(tokens.employeeA,'backfill',input())).toEqual({status:'authority_rejected'});
    expect(await coordinator.execute(tokens.adminB,'backfill',input())).toEqual({status:'authority_rejected'});
    const request=input({...interval(17)});
    const first=await coordinator.execute(tokens.adminA,'backfill',request);
    expect(first).toMatchObject({status:'committed',idempotentRetry:false});
    expect(await coordinator.execute(tokens.adminA,'backfill',request)).toEqual({...first,idempotentRetry:true});
    expect(await coordinator.execute(tokens.employeeA,'comment',{expectedMembershipId:ids.membershipEmployeeA,
      commandId:randomUUID(),timeRecordId:ids.stoppedEntryA,comment:'Über echte Autorität'})).toMatchObject({status:'committed'});
    await pool.query(`UPDATE taptime_server.memberships SET role='standortleitung',row_version=row_version+1 WHERE id=$1`,[admin.membership]);
    try { expect(await coordinator.execute(tokens.adminA,'backfill',input({...interval(18)}))).toEqual({status:'authority_rejected'}); }
    finally {await pool.query(`UPDATE taptime_server.memberships SET role='administrator',row_version=row_version+1 WHERE id=$1`,[admin.membership]);}
  } finally {await runtime.end();}
});

it('allows an administrator to comment an own entry, while rejecting another person’s entry',async()=>{
  const own=await write(admin,input({...interval(23)}));
  expect(own.status).toBe('committed');
  expect(await comment(admin,own.timeRecordId,'Meine Notiz')).toMatchObject({status:'committed'});
  expect(await details(admin,[own.timeRecordId])).toMatchObject([{details:{comment:'Meine Notiz'}}]);
  expect(await comment(admin,ids.stoppedEntryA,'Fremde Notiz')).toEqual({status:'authority_rejected'});
});

it('negotiates distinct provenance in payroll reads without changing the legacy representation',async()=>{
  const {TimeReviewCoordinator}=await import('../src/TimeReviewCoordinator.js');
  const {DA3_READ_LOGIN,DA3_WRITE_LOGIN,runtimeConnectionString,tokens,verifier}=await import('./fixtures.js');
  const readPool=new Pool({connectionString:runtimeConnectionString(pool.options.connectionString!,DA3_READ_LOGIN,'t066-synthetic')});
  const writePool=new Pool({connectionString:runtimeConnectionString(pool.options.connectionString!,DA3_WRITE_LOGIN,'t066-synthetic')});
  try {
    const times=interval(24);const made=await write(admin,input(times));expect(made.status).toBe('committed');
    const coordinator=new TimeReviewCoordinator(readPool,writePool,verifier);
    const command={accessToken:tokens.adminA,request:{expectedMembershipId:admin.membership,fromInclusive:times.startedAt,toExclusive:times.stoppedAt,cursor:null,limit:20}};
    const before=JSON.stringify(await coordinator.queryTimeRecordsV2(command));
    expect(await coordinator.queryTimeRecordsV2({...command,includeTimeDetails:true})).toMatchObject({status:'ready',value:{records:[{details:{origin:'backfilled'}}]}});
    expect(JSON.stringify(await coordinator.queryTimeRecordsV2(command))).toBe(before);
  } finally {await readPool.end();await writePool.end();}
});

it('keeps overlap truth when the latest canonical or recovered revision moves outside the old interval',async()=>{
  const canonical=(await pool.query(`SELECT * FROM taptime_server.effective_time_records_v2
    WHERE time_record_id=$1`,[ids.stoppedEntryA])).rows[0];
  const recovered=randomUUID();
  await pool.query(`INSERT INTO taptime_server.time_record_revisions
    (organization_id,time_record_id,revision_number,user_id,target_type,target_customer_id,effective_started_at,effective_stopped_at,
    base_row_version,actor_user_id,actor_membership_id,reason,command_id,request_hash)
    VALUES($1,$2,1,$3,'customer',$4,$5,$6,0,$7,$8,'Overlap probe',gen_random_uuid(),repeat('e',64))`,
  [admin.org,recovered,canonical.user_id,ids.customerA,canonical.effective_started_at,canonical.effective_stopped_at,admin.user,admin.membership]);
  const recordIds=[ids.stoppedEntryA,recovered];
  const compare=async()=>{
    const expected=(await pool.query(`SELECT r.time_record_id,EXISTS(
      SELECT 1 FROM taptime_server.effective_time_records_v2 other
      WHERE other.organization_id=r.organization_id AND other.user_id=r.user_id AND other.time_record_id<>r.time_record_id
        AND other.effective_started_at<coalesce(r.effective_stopped_at,'infinity'::timestamptz)
        AND coalesce(other.effective_stopped_at,'infinity'::timestamptz)>r.effective_started_at) AS overlaps
      FROM taptime_server.effective_time_records_v2 r WHERE r.time_record_id=ANY($1::uuid[]) ORDER BY r.time_record_id`,[recordIds])).rows;
    const actual=await actor(admin,'taptime_time_review_reader',async c=>(await c.query(
      'SELECT * FROM taptime_server.read_time_record_details_v1($1::uuid[]) ORDER BY time_record_id',[recordIds])).rows);
    expect(actual.map(r=>({time_record_id:r.time_record_id,overlaps:r.details.overlapsAnotherRecord}))).toEqual(expected);
    return actual;
  };
  expect((await compare()).every(r=>r.details.overlapsAnotherRecord)).toBe(true);
  const correct=async(recordId:string,start:string,end:string)=>{
    const current=(await pool.query('SELECT * FROM taptime_server.effective_time_records_v2 WHERE time_record_id=$1',[recordId])).rows[0];
    const result=await actor(admin,'taptime_time_review_writer',async c=>(await c.query(
      `SELECT * FROM taptime_server.correct_time_record_v1($1,$2,$3,$4,repeat('e',64),$5,$6,$7,$8,$9,'Moved interval')`,
      [admin.org,admin.user,admin.membership,randomUUID(),recordId,current.base_row_version,current.effective_revision_number,start,end])).rows);
    expect(result[0].result_status).toBe('committed');
  };
  await correct(ids.stoppedEntryA,'2026-06-01T08:00:00Z','2026-06-01T09:00:00Z');
  await compare();
  await correct(recovered,'2026-06-01T08:30:00Z','2026-06-01T09:30:00Z');
  expect((await compare()).every(r=>r.details.overlapsAnotherRecord)).toBe(true);
  await correct(recovered,'2026-06-01T09:00:00Z','2026-06-01T10:00:00Z');
  expect((await compare()).every(r=>!r.details.overlapsAnotherRecord)).toBe(true);
});
