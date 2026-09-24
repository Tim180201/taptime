import { randomUUID } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BusinessEngine, WorkEventId, createTimestamp, type AdministrationWorkEvent } from '@taptime/core';
import { applyMigrationSet, loadMigrations } from '@taptime/backend-schema';
import type { AccessTokenVerifier } from '@taptime/backend-identity';
import { TimeReviewCoordinator } from '../src/TimeReviewCoordinator.js';
import { TimeSupplementCoordinator } from '../src/TimeSupplementCoordinator.js';
import { AdministrationStopCoordinator } from '../src/AdministrationStopCoordinator.js';
import { ids, resetMigratePrepareAndSeed, runtimeConnectionString, DA3_READ_LOGIN, DA3_WRITE_LOGIN, DA3_ISSUER } from './fixtures.js';

// All authority assertions execute real SECURITY DEFINER functions under the runtime role.
// The two tenants and home locations are synthetic; no production connection is used.
const pool = new Pool({ connectionString: process.env.DA3_DATABASE_URL ?? 'postgresql://timbartz@127.0.0.1:5432/taptime_da3' });
interface Person { name: string; org: string; user: string; member: string; role: string; home: string | null; closed: string; active: string; review: string; escalation: string }
const l1 = randomUUID(), l2 = randomUUID(), lf = randomUUID();
const person = (name: string, role: string, home: string | null, org: string = ids.organizationA): Person =>
  ({ name, role, home, org, user: randomUUID(), member: randomUUID(), closed: randomUUID(), active: randomUUID(), review: randomUUID(), escalation: randomUUID() });
const a = person('A', 'standortleitung', l1), b = person('B', 'standortleitung', l2);
const p = person('P', 'employee', l1), q = person('Q', 'employee', l2), r = person('R', 'employee', null);
const f = person('Foreign manager', 'standortleitung', lf, ids.organizationB), fp = person('Foreign person', 'employee', lf, ids.organizationB);
const admin = { ...person('Admin', 'administrator', l1), user: ids.adminA, member: ids.membershipAdminA };
const people = [a, b, p, q, r, f, fp];
const targetFor = (who: Person) => who.org === ids.organizationA ? ids.customerA : ids.customerB;
const writer = 'taptime_time_review_writer', reader = 'taptime_time_review_reader';
async function asActor<T>(who: Person, role: string, run: (c: PoolClient) => Promise<T>, commit = false): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    await c.query(`SELECT set_config('app.organization_id',$1,true),set_config('app.user_id',$2,true),
      set_config('app.membership_id',$3,true),set_config('app.membership_role',$4,true)`, [who.org, who.user, who.member, who.role]);
    await c.query(`SET LOCAL ROLE ${role}`);
    const result = await run(c);
    await c.query(commit ? 'COMMIT' : 'ROLLBACK');
    return result;
  } catch (error) { await c.query('ROLLBACK'); throw error; } finally { c.release(); }
}
const json = async (c: PoolClient, fn: string, request: unknown) =>
  (await c.query(`SELECT taptime_server.${fn}($1::jsonb) AS result`, [JSON.stringify(request)])).rows[0]!.result;
const backfill = (actor: Person, target: Person, overrides = {}) => ({ expectedMembershipId: actor.member, targetMembershipId: target.member,
  commandId: randomUUID(), targetType: 'customer', targetId: targetFor(target), startedAt: '2026-06-01T08:00:00.000Z',
  stoppedAt: '2026-06-01T09:00:00.000Z', reason: 'Vergessene Zeit', comment: null, ...overrides });
const stop = (actor: Person, target: Person) => ({ expectedMembershipId: actor.member, targetMembershipId: target.member,
  timeRecordId: target.active, expectedRowVersion: 1, commandId: randomUUID(), stoppedAt: '2026-07-21T12:00:00.000Z', reason: 'Stopp vergessen' });
const correct = async (c: PoolClient, actor: Person, target: Person) => (await c.query(
  `SELECT * FROM taptime_server.correct_time_record_v1($1,$2,$3,$4,repeat('a',64),$5,0,1,'2026-07-20T07:00:00Z','2026-07-20T16:00:00Z','Beginn berichtigt')`,
  [actor.org, actor.user, actor.member, randomUUID(), target.closed])).rows[0]!;
const adjudicate = async (c: PoolClient, actor: Person, target: Person, engine = false) => (await c.query(
  `SELECT * FROM taptime_server.adjudicate_time_review_items_v1($1,$2,$3,$4,repeat('b',64),$5,'no_time_record_change',NULL,NULL,NULL,NULL,NULL,'Geprüft')`,
  [actor.org, actor.user, actor.member, randomUUID(), [engine ? target.escalation : target.review]])).rows[0]!;
const reviews = async (c: PoolClient, who: Person, version = 2) => (await c.query(
  `SELECT * FROM taptime_server.read_time_review_items_v${version}($1,$2,$3,NULL,NULL,101)`, [who.org, who.user, who.member])).rows;
const records = async (c: PoolClient, who: Person, version = 2) => (await c.query(
  `SELECT * FROM taptime_server.read_effective_time_records_v${version}($1,$2,$3,'2026-07-01T00:00:00Z','2026-08-01T00:00:00Z',NULL,NULL,101)`,
  [who.org, who.user, who.member])).rows;
const details = async (c: PoolClient) => (await c.query('SELECT * FROM taptime_server.read_time_record_details_v1($1::uuid[])',
  [people.flatMap(who => [who.closed, who.active])])).rows;

beforeAll(async () => {
  await resetMigratePrepareAndSeed(pool, 't062-synthetic', '032');
  await pool.query(`INSERT INTO taptime_server.locations(id,organization_id,display_name) VALUES ($1,$4,'Eins'),($2,$4,'Zwei'),($3,$5,'Fremd')`,
    [l1,l2,lf,ids.organizationA,ids.organizationB]);
  for (const who of people) {
    await pool.query('INSERT INTO taptime_server.users(id) VALUES($1)', [who.user]);
    await pool.query('INSERT INTO taptime_server.identity_bindings(id,user_id,issuer,subject) VALUES(gen_random_uuid(),$1,$2,$3)',[who.user,DA3_ISSUER,who.member]);
    await pool.query(`INSERT INTO taptime_server.memberships(id,organization_id,user_id,role,display_name) VALUES($1,$2,$3,$4,$5)`,
      [who.member,who.org,who.user,who.role,who.name]);
  }
  // Complete activation first. R is former staff with history but no current home.
  await pool.query(`INSERT INTO taptime_server.membership_home_location_assignments(id,organization_id,membership_id,location_id)
    SELECT gen_random_uuid(),organization_id,id,CASE WHEN organization_id=$1 THEN $2::uuid ELSE $3::uuid END FROM taptime_server.memberships`,
    [ids.organizationA,l1,lf]);
  for (const who of [b,q]) {
    await pool.query('UPDATE taptime_server.membership_home_location_assignments SET revoked_at=clock_timestamp() WHERE membership_id=$1', [who.member]);
    await pool.query('INSERT INTO taptime_server.membership_home_location_assignments(id,organization_id,membership_id,location_id) VALUES(gen_random_uuid(),$1,$2,$3)', [who.org,who.member,l2]);
  }
  await pool.query(`INSERT INTO taptime_server.work_target_location_assignments(id,organization_id,target_type,target_id,location_id)
    SELECT gen_random_uuid(),organization_id,target_type,target_id,CASE WHEN organization_id=$1 THEN $2::uuid ELSE $3::uuid END FROM taptime_server.work_targets WHERE active`,
    [ids.organizationA,l1,lf]);
  for(const who of [b,q]) await pool.query('INSERT INTO taptime_server.membership_work_location_grants(id,organization_id,membership_id,location_id) VALUES(gen_random_uuid(),$1,$2,$3)',[who.org,who.member,l1]);
  for (const who of [a,b,f]) await pool.query(`INSERT INTO taptime_server.membership_management_location_grants(id,organization_id,membership_id,location_id)
    VALUES(gen_random_uuid(),$1,$2,$3)`, [who.org,who.member,who.home]);
  for (const who of people) {
    const adminUser = who.org===ids.organizationA ? ids.adminA : ids.adminB;
    const adminMember = who.org===ids.organizationA ? ids.membershipAdminA : ids.membershipAdminB;
    await pool.query(`INSERT INTO taptime_server.time_record_revisions(organization_id,time_record_id,revision_number,user_id,target_type,target_customer_id,
      effective_started_at,effective_stopped_at,base_row_version,actor_user_id,actor_membership_id,reason,command_id,request_hash)
      VALUES($1,$2,1,$3,'customer',$4,'2026-07-20T08:00:00Z','2026-07-20T16:00:00Z',0,$5,$6,'Nachgetragen',$7,repeat('a',64))`,
      [who.org,who.closed,who.user,targetFor(who),adminUser,adminMember,randomUUID()]);
    const c=await pool.connect(), event=randomUUID();
    try {
      await c.query('BEGIN');
      for (const id of [event,who.review,who.escalation]) await c.query(`INSERT INTO taptime_server.work_events(id,organization_id,triggered_by_user_id,target_type,target_customer_id,
        occurred_at,trigger_type,content_hash,content_hash_algorithm,content_hash_version)
        VALUES($1,$2,$3,'customer',$4,'2026-07-21T08:00:00Z','manual',repeat('a',64),'sha256',2)`, [id,who.org,who.user,targetFor(who)]);
      await c.query(`INSERT INTO taptime_server.time_entries(id,organization_id,user_id,target_type,target_customer_id,status,start_work_event_id,started_at,started_via)
        VALUES($1,$2,$3,'customer',$4,'started',$5,'2026-07-21T08:00:00Z','manual')`, [who.active,who.org,who.user,targetFor(who),event]);
      await c.query(`INSERT INTO taptime_server.canonical_decisions(work_event_id,organization_id,actor_user_id,target_type,target_customer_id,decision_type,time_entry_id,engine_version,decision_payload)
        VALUES($1,$2,$3,'customer',$4,'time_entry_started',$5,'test','{}')`, [event,who.org,who.user,targetFor(who),who.active]);
      await c.query(`INSERT INTO taptime_server.audit_events(id,organization_id,actor_user_id,work_event_user_id,work_event_id,event_type,entity_type,entity_id,occurred_at,correlation_id,payload)
        VALUES(gen_random_uuid(),$1,$2,$2,$3,'LifecycleDeferred','WorkEvent',$3,transaction_timestamp(),'t062','{}')`, [who.org,who.user,who.review]);
      await c.query(`INSERT INTO taptime_server.canonical_decisions(work_event_id,organization_id,actor_user_id,target_type,target_customer_id,decision_type,reason,engine_version,decision_payload)
        VALUES($1,$2,$3,'customer',$4,'escalation_required','work_event_precedes_active_time_entry','test','{}')`, [who.escalation,who.org,who.user,targetFor(who)]);
      await c.query('COMMIT');
    } catch(error) { await c.query('ROLLBACK'); throw error; } finally { c.release(); }
  }
  await pool.query('UPDATE taptime_server.organizations SET locations_enabled=true,row_version=row_version+1');
  await pool.query('UPDATE taptime_server.memberships SET revoked_at=clock_timestamp(),row_version=row_version+1 WHERE id=$1', [r.member]);
  expect((await pool.query('SELECT * FROM taptime_server.membership_home_location_assignments WHERE membership_id=$1 AND revoked_at IS NULL', [r.member])).rows).toEqual([]);
  await insertOfflineReviewForLegacyEvent();
  // Migration rehearsal on populated 032: rows, protected function definitions and administrator
  // responses remain byte-identical; the migration runner also proves a second application is a no-op.
  const tableNames=(await pool.query("SELECT tablename FROM pg_tables WHERE schemaname='taptime_server' ORDER BY tablename")).rows.map(row=>row.tablename as string);
  const snapshot=async()=>JSON.stringify(await Promise.all(tableNames.map(async name=>(await pool.query(
    `SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY to_jsonb(r)::text),'[]') AS rows FROM taptime_server.${name} r`)).rows)));
  const fixedDefinitions=async()=>JSON.stringify((await pool.query(`SELECT oid::regprocedure::text AS name,pg_get_functiondef(oid) AS definition
    FROM pg_proc WHERE pronamespace='taptime_server'::regnamespace AND (proname LIKE '%export%' OR proname IN (
    'has_current_time_review_administrator_v1','has_current_admin_setup_authority','has_active_administrator_membership',
    'has_current_nfc_setup_authority_v1','has_membership_management_authority_v1','lock_project_for_administration_v1')) ORDER BY name`)).rows);
  const adminResponses=async()=>JSON.stringify(await asActor(admin,reader,async c=>({records1:await records(c,admin,1),records2:await records(c,admin),reviews1:await reviews(c,admin,1),reviews2:await reviews(c,admin),
    details:(await details(c)).sort((x,y)=>x.time_record_id.localeCompare(y.time_record_id))})));
  const before={data:await snapshot(),definitions:await fixedDefinitions(),responses:await adminResponses()};
  const migration=(await loadMigrations()).filter(m=>m.version>'032');
  // No future migration is guessed here; the source defines the installed set.
  if(migration.length) {
    await applyMigrationSet(pool,migration);
    expect({data:await snapshot(),definitions:await fixedDefinitions(),responses:await adminResponses()}).toEqual(before);
    expect((await applyMigrationSet(pool,migration)).applied).toEqual([]);
  }

});
afterAll(() => pool.end());

const allowedPairs = [[a,p],[a,a],[b,q],[b,b],[f,fp],[f,f]] as const;
const operations = ['backfill','correct','review','escalation','stop'] as const;
it.each(allowedPairs.flatMap(([actor,target])=>operations.map(operation=>({actor,target,operation,label:`${actor.name} → ${target.name}: ${operation}`}))))('$label within its home scope in PostgreSQL', async ({actor,target,operation}) => {
  await asActor(actor,writer,async c => {
    if(operation==='backfill') {expect(await json(c,'backfill_time_record_v1',backfill(actor,target))).toMatchObject({status:'committed'});return;}
    if(operation==='correct') {expect(await correct(c,actor,target)).toMatchObject({result_status:'committed'});return;}
    if(operation==='escalation') expect(await adjudicate(c,actor,target)).toMatchObject({result_status:'committed'});
    if(operation==='review' || operation==='escalation') {expect(await adjudicate(c,actor,target,operation==='escalation')).toMatchObject({result_status:'committed'});return;}
    const request=stop(actor,target), context=await json(c,'prepare_administration_stop_v1',request);
    expect(context).toMatchObject({status:'ready'});
    const event: AdministrationWorkEvent={id:WorkEventId(randomUUID()),organizationId:context.activeTimeEntry.organizationId,
      triggeredBy:context.activeTimeEntry.userId,target:context.activeTimeEntry.target,occurredAt:createTimestamp(request.stoppedAt),trigger:{type:'administration'}};
    const decision=new BusinessEngine().evaluate(event,{activeTimeEntryForUser:context.activeTimeEntry,activeBreakIntervalForUser:context.activeBreakInterval,previousAcceptedWorkEventForUserAndTarget:null});
    const result=(await c.query('SELECT taptime_server.commit_administration_stop_v1($1::jsonb,$2::jsonb,$3::jsonb) AS result',[JSON.stringify(request),JSON.stringify(event),JSON.stringify(decision)])).rows[0]!.result;
    expect(result).toMatchObject({status:'committed'});
  });
});

it.each([q,r,b,fp,f])('A cannot write across the boundary to $name (including no home)', async target => {
  await asActor(a,writer,async c => {
    expect(await json(c,'backfill_time_record_v1',backfill(a,target))).toEqual({status:'authority_rejected'});
    expect((await correct(c,a,target)).result_status).not.toBe('committed');
    expect((await adjudicate(c,a,target)).result_status).not.toBe('committed');
    expect((await adjudicate(c,a,target,true)).result_status).not.toBe('committed');
    expect(await json(c,'prepare_administration_stop_v1',stop(a,target))).toEqual({status:'authority_rejected'});
  });
});

it.each([1,2])('filters both read v%s routes and details by current home before pagination', async version => {
  await asActor(a,reader,async c => {
    const allowed=[a.user,p.user,ids.employeeA];
    const reviewRows=await reviews(c,a,version);
    expect(reviewRows.map(row=>row.review_item_id)).toEqual(expect.arrayContaining([a.review,a.escalation,p.review,p.escalation,ids.legacyReviewEventA]));
    expect(reviewRows.map(row=>row.employee_user_id).every(id=>allowed.includes(id))).toBe(true);
    const entries=await records(c,a,version);
    expect(entries.map(row=>row.time_record_id)).toEqual(expect.arrayContaining([a.closed,p.closed]));
    expect(entries.some(row=>[q.closed,r.closed,fp.closed].includes(row.time_record_id))).toBe(false);
    expect((await details(c)).map(row=>row.time_record_id).sort()).toEqual([a.active,a.closed,p.active,p.closed].sort());
  });
});

it('exposes review/time sections only from SQL authority and keeps setup/export shut', async () => {
  const rows=await asActor(a,'taptime_identity_resolver',async c=>(await c.query('SELECT * FROM taptime_server.read_administration_session_v2($1,$2,$3)',[a.org,a.user,a.member])).rows);
  expect(rows).toEqual([expect.objectContaining({role:'standortleitung',time_records_available:true,review_items_available:true,setup_available:false,time_export_available:false,management_location_id:l1})]);
});

it('allows own comments, requires a backfill reason and keeps foreign comments shut', async () => {
  await asActor(a,writer,async c=>{
    expect(await json(c,'comment_time_record_v1',{expectedMembershipId:a.member,timeRecordId:a.closed,commandId:randomUUID(),comment:'Eigene Notiz'})).toMatchObject({status:'committed'});
    expect(await json(c,'comment_time_record_v1',{expectedMembershipId:a.member,timeRecordId:p.closed,commandId:randomUUID(),comment:'Fremde Notiz'})).toEqual({status:'authority_rejected'});
    expect(await json(c,'backfill_time_record_v1',backfill(a,p,{reason:null}))).toEqual({status:'reason_required'});
  });
});

async function transferHome(who: Person, home: string) {
  const c=await pool.connect();
  try {
    await c.query('BEGIN');
    await c.query('UPDATE taptime_server.membership_home_location_assignments SET revoked_at=clock_timestamp() WHERE membership_id=$1 AND revoked_at IS NULL',[who.member]);
    await c.query('INSERT INTO taptime_server.membership_home_location_assignments(id,organization_id,membership_id,location_id) VALUES(gen_random_uuid(),$1,$2,$3)',[who.org,who.member,home]);
    await c.query('COMMIT');
  } catch(error) {await c.query('ROLLBACK');throw error;} finally {c.release();}
}
it('a review follows the person on a home transfer', async () => {
  await transferHome(p,l2);
  try {
    expect((await asActor(a,reader,c=>reviews(c,a))).some(row=>row.employee_user_id===p.user)).toBe(false);
    expect((await asActor(b,reader,c=>reviews(c,b))).some(row=>row.employee_user_id===p.user)).toBe(true);
    expect((await asActor(a,writer,c=>adjudicate(c,a,p))).result_status).toBe('authority_rejected');
    expect((await asActor(b,writer,c=>adjudicate(c,b,p))).result_status).toBe('committed');
  } finally {
    await transferHome(p,l1);
  }
});

it('live role downgrade rejects a stale manager context immediately', async () => {
  await pool.query("UPDATE taptime_server.memberships SET role='employee',row_version=row_version+1 WHERE id=$1",[a.member]);
  try {
    expect(await asActor(a,writer,c=>json(c,'backfill_time_record_v1',backfill(a,p)))).toEqual({status:'authority_rejected'});
    expect((await asActor(a,writer,c=>correct(c,a,p))).result_status).toBe('authority_rejected');
    expect((await asActor(a,writer,c=>adjudicate(c,a,p))).result_status).toBe('authority_rejected');
    expect(await asActor(a,writer,c=>json(c,'prepare_administration_stop_v1',stop(a,p)))).toEqual({status:'authority_rejected'});
    expect(await asActor(a,reader,c=>details(c))).toEqual([]);
    await expect(asActor(a,reader,c=>reviews(c,a))).rejects.toMatchObject({code:'42501'});
    await expect(asActor(a,reader,c=>records(c,a))).rejects.toMatchObject({code:'42501'});
  } finally {
    await pool.query("UPDATE taptime_server.memberships SET role='standortleitung',row_version=row_version+1 WHERE id=$1",[a.member]);
    await pool.query('INSERT INTO taptime_server.membership_management_location_grants(id,organization_id,membership_id,location_id) VALUES(gen_random_uuid(),$1,$2,$3)',[a.org,a.member,l1]);
  }
});

it('cannot forge administrator context or another membership', async () => {
  for(const actor of [{...a,role:'administrator'},{...a,member:admin.member}]) {
    expect(await asActor(actor,writer,c=>json(c,'backfill_time_record_v1',backfill(actor,q)))).toEqual({status:'authority_rejected'});
    expect((await asActor(actor,writer,c=>correct(c,actor,q))).result_status).toBe('authority_rejected');
    expect(await asActor(actor,reader,c=>details(c))).toEqual([]);
  }
});

it('administrator corrects former staff history; D-092 restricts only backfills', async () => {
  await asActor(admin,writer,async c=>{
    for(const target of [a,b,p,q]) {
      expect(await json(c,'backfill_time_record_v1',backfill(admin,target))).toMatchObject({status:'committed'});
      expect((await correct(c,admin,target)).result_status).toBe('committed');
    }
    expect(await json(c,'backfill_time_record_v1',backfill(admin,r))).toEqual({status:'authority_rejected'});
    expect((await correct(c,admin,r)).result_status).toBe('committed');
  });
  expect((await asActor(a,writer,c=>correct(c,a,r))).result_status).toBe('authority_rejected');
});

it('two simultaneous decisions on the same item have exactly one winner', async () => {
  const outcomes=await Promise.all([asActor(a,writer,c=>adjudicate(c,a,p),true),asActor(a,writer,c=>adjudicate(c,a,p),true)]);
  expect(outcomes.map(row=>row.result_status).sort()).toEqual(['committed','conflict']);
});

it('uses the real runtime login and unchanged manager role for reads, edits, self stop and archival',async()=>{
 const readPool=new Pool({connectionString:runtimeConnectionString(pool.options.connectionString!,DA3_READ_LOGIN,'t062-synthetic')});
 const writePool=new Pool({connectionString:runtimeConnectionString(pool.options.connectionString!,DA3_WRITE_LOGIN,'t062-synthetic')});
 const verifier:AccessTokenVerifier={verify:async()=>({status:'verified',identity:{issuer:DA3_ISSUER,subject:a.member}})};
 const review=new TimeReviewCoordinator(readPool,writePool,verifier),supplement=new TimeSupplementCoordinator(writePool,verifier),stopper=new AdministrationStopCoordinator(writePool,verifier);
 try {
  const page=await review.queryReviewItemsV2({accessToken:'synthetic',request:{expectedMembershipId:a.member,limit:100,cursor:null}});
  expect(page).toMatchObject({status:'ready'});
  expect(JSON.stringify(page)).not.toContain(q.review);
  expect(await review.correctTimeRecord({accessToken:'synthetic',request:{expectedMembershipId:a.member,commandId:randomUUID(),timeRecordId:a.closed,
   expectedBaseRowVersion:0,expectedRevisionNumber:1,startedAt:'2026-07-20T07:00:00.000Z',stoppedAt:'2026-07-20T16:00:00.000Z',reason:'Berichtigt'}})).toMatchObject({status:'committed'});
  expect(await review.adjudicateReviewItems({accessToken:'synthetic',request:{expectedMembershipId:a.member,commandId:randomUUID(),reviewItemIds:[a.review],resolution:{type:'no_time_record_change'},reason:'Geprüft'}})).toMatchObject({status:'committed'});
  expect(await supplement.execute('synthetic','backfill',backfill(a,p))).toMatchObject({status:'committed'});
  expect(await supplement.execute('synthetic','backfill',backfill(a,q))).toEqual({status:'authority_rejected'});
  expect(await supplement.execute('synthetic','comment',{expectedMembershipId:a.member,commandId:randomUUID(),timeRecordId:a.closed,comment:'Notiz'})).toMatchObject({status:'committed'});
  expect(await stopper.execute('synthetic',stop(a,q))).toEqual({status:'authority_rejected'});
  for(const target of [a,p]) {
   const request=stop(a,target);
   const first=await stopper.execute('synthetic',request);
   expect(first).toMatchObject({status:'committed',idempotentRetry:false,offsiteArchived:false,requiredWalFile:expect.stringMatching(/^[0-9A-F]{24}$/)});
   expect(await stopper.execute('synthetic',request)).toMatchObject({...first,idempotentRetry:true});
  }
  const requirements=await pool.query('SELECT membership_id FROM taptime_server.lifecycle_event_archive_requirements WHERE membership_id=ANY($1::uuid[])',[ [a.member,p.member] ]);
  expect(requirements.rows.map(row=>row.membership_id).sort()).toEqual([a.member,p.member].sort());
 } finally {await Promise.all([readPool.end(),writePool.end()]);}
});

it('a scoped manager adjudicates offline evidence and only releases its proved cursor',async()=>{
 await asActor(a,writer,async c=>{
  const target={...p,user:ids.employeeA,member:ids.membershipEmployeeA,review:ids.legacyReviewEventA};
  expect((await adjudicate(c,a,target)).result_status).toBe('committed');
 });
 // The rolled-back test must leave immutable evidence and the pending cursor in place.
 const rows=await pool.query(`SELECT review_predecessor_sequence FROM taptime_server.offline_sync_cursors WHERE membership_id=$1`,[ids.membershipEmployeeA]);
 expect(rows.rows).toEqual([{review_predecessor_sequence:'1'}]);
});

it('revoking the live management grant removes every time authority without changing the role',async()=>{
 await pool.query('UPDATE taptime_server.membership_management_location_grants SET revoked_at=clock_timestamp() WHERE membership_id=$1 AND revoked_at IS NULL',[b.member]);
 try {
  expect(await asActor(b,writer,c=>json(c,'backfill_time_record_v1',backfill(b,q)))).toEqual({status:'authority_rejected'});
  expect((await asActor(b,writer,c=>correct(c,b,q))).result_status).toBe('authority_rejected');
  expect((await asActor(b,writer,c=>adjudicate(c,b,q))).result_status).toBe('authority_rejected');
  expect(await asActor(b,writer,c=>json(c,'prepare_administration_stop_v1',stop(b,q)))).toEqual({status:'authority_rejected'});
  expect(await asActor(b,reader,c=>details(c))).toEqual([]);
  await expect(asActor(b,reader,c=>reviews(c,b))).rejects.toMatchObject({code:'42501'});
  const session=await asActor(b,'taptime_identity_resolver',c=>c.query('SELECT * FROM taptime_server.read_administration_session_v2($1,$2,$3)',[b.org,b.user,b.member]));
  expect(session.rows).toEqual([expect.objectContaining({role:'standortleitung',time_records_available:false,review_items_available:false})]);
 } finally {
  await pool.query('INSERT INTO taptime_server.membership_management_location_grants(id,organization_id,membership_id,location_id) VALUES(gen_random_uuid(),$1,$2,$3)',[b.org,b.member,l2]);
 }
});

async function insertOfflineReviewForLegacyEvent(): Promise<string> {
  const installationId = '91000000-0000-4000-8000-000000000301';
  const leaseId = '92000000-0000-4000-8000-000000000301';
  const itemId = '93000000-0000-4000-8000-000000000301';
  const receiptId = '94000000-0000-4000-8000-000000000301';
  await pool.query(
    `INSERT INTO taptime_server.offline_installations
      (id, organization_id, user_id, membership_id, identity_binding_id, binding_digest)
     VALUES ($1, $2, $3, $4, '11000000-0000-4000-8000-000000000302', decode(repeat('11', 32), 'hex'))`,
    [installationId, ids.organizationA, ids.employeeA, ids.membershipEmployeeA],
  );
  await pool.query(
    `INSERT INTO taptime_server.offline_capture_leases
      (id, organization_id, installation_id, identity_binding_id, user_id, membership_id,
       membership_row_version, membership_role, issued_at, expires_at,
       configuration_revision, item_count, serialized_bytes, manifest_digest)
     VALUES ($1, $2, $3, '11000000-0000-4000-8000-000000000302', $4, $5,
       1, 'employee', '2026-07-21T00:00:00Z', '2026-07-21T12:00:00Z',
       repeat('a', 64), 1, 1, repeat('b', 64))`,
    [leaseId, ids.organizationA, installationId, ids.employeeA, ids.membershipEmployeeA],
  );
  await pool.query(
    `INSERT INTO taptime_server.offline_capture_lease_items
      (id, organization_id, lease_id, installation_id, lookup_value, assignment_id,
       nfc_tag_id, target_type, target_customer_id, display_name,
       assignment_row_version, target_row_version)
     VALUES ($1, $2, $3, $4, repeat('c', 64), $5, $6, 'customer', $7, 'Customer A',
       1, 1)`,
    [itemId, ids.organizationA, leaseId, installationId, ids.assignmentA, ids.tagA, ids.customerA],
  );
  await pool.query(
    `INSERT INTO taptime_server.sync_receipts
      (id, organization_id, user_id, target_type, target_customer_id, work_event_id,
       attempt_number, status)
     VALUES ($1, $2, $3, 'customer', $4, $5, 1, 'received')`,
    [receiptId, ids.organizationA, ids.employeeA, ids.customerA, ids.legacyReviewEventA],
  );
  await pool.query(
    `INSERT INTO taptime_server.offline_sync_cursors
      (organization_id, installation_id, user_id, membership_id,
       last_durable_sequence, review_predecessor_sequence)
     VALUES ($1, $2, $3, $4, 1, 1)`,
    [ids.organizationA, installationId, ids.employeeA, ids.membershipEmployeeA],
  );
  await pool.query(
    `INSERT INTO taptime_server.offline_event_reconciliations
      (organization_id, work_event_id, receipt_id, installation_id, lease_id,
       lease_item_id, user_id, membership_id, device_sequence, request_content_hash,
       boot_marker, monotonic_anchor_milliseconds, monotonic_delta_milliseconds,
       wall_clock_anchor, clock_proof_status, clock_proof_version, provenance_version,
       result_status, review_reason)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1, repeat('d', 64),
       'da3-boot', 0, 0, '2026-07-21T00:00:00Z', 'review_only', 1, 1,
       'review_pending', 'capture_time_out_of_bounds')`,
    [
      ids.organizationA, ids.legacyReviewEventA, receiptId, installationId,
      leaseId, itemId, ids.employeeA, ids.membershipEmployeeA,
    ],
  );
  return installationId;
}

describe('D-092 target-person work authority',()=>{
 const c1=randomUUID(),c2=randomUUID(),c2b=randomUUID(),allowedRecord=randomUUID(),forbiddenRecord=randomUUID();
 beforeAll(async()=>{
  await transferHome(p,l2);
  await pool.query('UPDATE taptime_server.membership_management_location_grants SET revoked_at=clock_timestamp() WHERE membership_id=$1 AND revoked_at IS NULL',[a.member]);
  await pool.query('INSERT INTO taptime_server.membership_management_location_grants(id,organization_id,membership_id,location_id) VALUES(gen_random_uuid(),$1,$2,$3)',[a.org,a.member,l2]);
  const client=await pool.connect();
  try {
   await client.query('BEGIN');
   for(const [target,location,name] of [[c1,l1,'C1 actor only'],[c2,l2,'C2 person only'],[c2b,l2,'C2 second permitted target']]) {
    await client.query("INSERT INTO taptime_server.customers(id,organization_id,display_name,active,activated_at) VALUES($1,$2,$3,true,clock_timestamp())",[target,a.org,name]);
    await client.query("INSERT INTO taptime_server.work_target_location_assignments(id,organization_id,target_type,target_id,location_id) VALUES(gen_random_uuid(),$1,'customer',$2,$3)",[a.org,target,location]);
   }
   for(const [record,target] of [[allowedRecord,c2],[forbiddenRecord,c1]]) await client.query(`INSERT INTO taptime_server.time_record_revisions(organization_id,time_record_id,revision_number,user_id,target_type,target_customer_id,
     effective_started_at,effective_stopped_at,base_row_version,actor_user_id,actor_membership_id,reason,command_id,request_hash)
     VALUES($1,$2,1,$3,'customer',$4,'2026-07-20T08:00:00Z','2026-07-20T16:00:00Z',0,$5,$6,'Historisch',$7,repeat('a',64))`,
     [a.org,record,p.user,target,admin.user,admin.member,randomUUID()]);
   await client.query('COMMIT');
  } catch(error) {await client.query('ROLLBACK');throw error;} finally {client.release();}
 });
 it.each([a,admin])('$name may backfill P with C2 even without personal work rights there',async actor=>{
  expect(await asActor(actor,writer,c=>json(c,'backfill_time_record_v1',backfill(actor,p,{targetId:c2,startedAt:'2026-06-02T08:00:00.000Z',stoppedAt:'2026-06-02T09:00:00.000Z'})))).toMatchObject({status:'committed'});
 });
 it.each([a,admin])('$name must reject backfill outside P work rights',async actor=>{
  expect(await asActor(actor,writer,c=>json(c,'backfill_time_record_v1',backfill(actor,p,{targetId:c1,startedAt:'2026-06-02T08:00:00.000Z',stoppedAt:'2026-06-02T09:00:00.000Z'})))).toEqual({status:'authority_rejected'});
 });
 it.each([a,admin])('$name may correct P current permitted target',async actor=>{
  expect((await asActor(actor,writer,c=>correct(c,actor,{...p,closed:allowedRecord}))).result_status).toBe('committed');
 });
 it.each([a,admin])('$name may correct an existing target outside P current work rights',async actor=>{
  expect((await asActor(actor,writer,c=>correct(c,actor,{...p,closed:forbiddenRecord}))).result_status).toBe('committed');
 });
 it('keeps personal target choices unchanged and separates management choices',async()=>{
  const own=await asActor(a,'taptime_mobile_target_reader',async c=>(await c.query('SELECT * FROM taptime_server.read_mobile_work_targets_v1($1,$2,$3,NULL,NULL,NULL,51)',[a.org,a.user,a.member])).rows);
  expect(own.map(row=>row.target_id)).toContain(c1);expect(own.map(row=>row.target_id)).not.toContain(c2);
  const managed=await asActor(a,reader,async c=>(await c.query('SELECT * FROM taptime_server.read_time_backfill_targets_v1($1,$2,$3,$4,NULL,NULL,51)',[a.org,a.user,a.member,p.member])).rows);
  expect(managed.map(row=>row.target_id)).toContain(c2);expect(managed.map(row=>row.target_id)).not.toContain(c1);
 });
 it('reads exactly P personal choices through the real runtime, with person-bound pagination and tenant rejection',async()=>{
  const readPool=new Pool({connectionString:runtimeConnectionString(pool.options.connectionString!,DA3_READ_LOGIN,'t062-synthetic')});
  const verifier:AccessTokenVerifier={verify:async()=>({status:'verified',identity:{issuer:DA3_ISSUER,subject:a.member}})};
  const coordinator=new TimeReviewCoordinator(readPool,readPool,verifier);
  try {
   const personal=await asActor(p,'taptime_mobile_target_reader',async c=>(await c.query('SELECT * FROM taptime_server.read_mobile_work_targets_v1($1,$2,$3,NULL,NULL,NULL,51)',[p.org,p.user,p.member])).rows);
   const result=await coordinator.queryBackfillTargets({accessToken:'synthetic',request:{expectedMembershipId:a.member,targetMembershipId:p.member,limit:1,cursor:null}});
   expect(result.status).toBe('ready');if(result.status!=='ready') return;
   const targets=[...result.value.targets];let cursor=result.value.nextCursor;
   while(cursor!==null) {
    const next=await coordinator.queryBackfillTargets({accessToken:'synthetic',request:{expectedMembershipId:a.member,targetMembershipId:p.member,limit:1,cursor}});
    expect(next.status).toBe('ready');if(next.status!=='ready') return;
    targets.push(...next.value.targets);cursor=next.value.nextCursor;
   }
   expect(targets.map(t=>t.targetId).sort()).toEqual(personal.map(row=>row.target_id).sort());
   expect(targets.map(t=>t.targetId)).toContain(c2);expect(targets.map(t=>t.targetId)).not.toContain(c1);
   for(const target of [fp,r,a]) expect(await coordinator.queryBackfillTargets({accessToken:'synthetic',request:{expectedMembershipId:a.member,targetMembershipId:target.member,limit:50,cursor:null}})).toEqual({status:'authority_rejected'});
   const forged=Buffer.from(JSON.stringify([q.member,'customer',c2])).toString('base64url');
   expect(await coordinator.queryBackfillTargets({accessToken:'synthetic',request:{expectedMembershipId:a.member,targetMembershipId:p.member,limit:50,cursor:forged}})).toEqual({status:'unavailable'});
  } finally {await readPool.end();}
 });
 it('uses P additional work grant outside management scope, and rejects retries immediately after its revocation',async()=>{
  const grant=randomUUID();
  await pool.query('INSERT INTO taptime_server.membership_work_location_grants(id,organization_id,membership_id,location_id) VALUES($1,$2,$3,$4)',[grant,p.org,p.member,l1]);
  const request=backfill(a,p,{targetId:c1,startedAt:'2026-06-03T08:00:00.000Z',stoppedAt:'2026-06-03T09:00:00.000Z'});
  try {
   for(const actor of [a,admin]) {
    const targets=await asActor(actor,reader,async c=>(await c.query('SELECT * FROM taptime_server.read_time_backfill_targets_v1($1,$2,$3,$4,NULL,NULL,51)',[actor.org,actor.user,actor.member,p.member])).rows);
    expect(targets.map(row=>row.target_id)).toEqual(expect.arrayContaining([c1,c2]));
    expect((await asActor(actor,writer,c=>correct(c,actor,{...p,closed:forbiddenRecord}))).result_status).toBe('committed');
   }
   expect(await asActor(a,writer,c=>json(c,'backfill_time_record_v1',request),true)).toMatchObject({status:'committed'});
  } finally {await pool.query('UPDATE taptime_server.membership_work_location_grants SET revoked_at=clock_timestamp() WHERE id=$1',[grant]);}
  expect(await asActor(a,writer,c=>json(c,'backfill_time_record_v1',request))).toEqual({status:'authority_rejected'});
 });

 it('preserves own target choices for an administrator without a management-role work bypass',async()=>{
  for(const [targetId,status] of [[c1,'committed'],[c2,'authority_rejected']]) expect(await asActor(admin,writer,c=>json(c,'backfill_time_record_v1',backfill(admin,admin,{targetId,
   startedAt:'2026-06-04T08:00:00.000Z',stoppedAt:'2026-06-04T09:00:00.000Z'})))).toMatchObject({status});
 });
 it('corrects deactivated targets and preserves history while D-092 excludes them from backfills',async()=>{
  await pool.query('UPDATE taptime_server.customers SET active=false,deactivated_at=clock_timestamp(),row_version=row_version+1 WHERE id=$1',[c2]);
  for(const actor of [a,admin]) {
   expect((await asActor(actor,writer,c=>correct(c,actor,{...p,closed:allowedRecord}))).result_status).toBe('committed');
   const history=await asActor(actor,reader,c=>records(c,actor));
   expect(history.map(row=>row.time_record_id)).toContain(allowedRecord);
   const targets=await asActor(actor,reader,async c=>(await c.query('SELECT * FROM taptime_server.read_time_backfill_targets_v1($1,$2,$3,$4,NULL,NULL,51)',[actor.org,actor.user,actor.member,p.member])).rows);
   expect(targets.map(row=>row.target_id)).not.toContain(c2);
  }
 });

});
