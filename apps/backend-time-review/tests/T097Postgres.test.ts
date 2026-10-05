import { BUSINESS_ENGINE_ESCALATION_REASONS, TIME_REVIEW_REASONS, TIME_REVIEW_ROLES } from '@taptime/time-review-contract';
import { randomUUID } from 'node:crypto';
import { applyMigrationSet, loadMigrations } from '@taptime/backend-schema';
import { Pool } from 'pg';
import { afterAll, beforeEach, expect, it } from 'vitest';
import { TimeReviewCoordinator } from '../src/TimeReviewCoordinator.js';
import { ids, tokens, verifier, resetMigratePrepareAndSeed, runtimeConnectionString, DA3_READ_LOGIN, DA3_WRITE_LOGIN } from './fixtures.js';
const url = process.env.DA3_DATABASE_URL ?? 'postgresql://timbartz@127.0.0.1:5432/taptime_da3';
const password = process.env.DA3_RUNTIME_PASSWORD ?? 'da3-local-synthetic-only';
const installerPool = new Pool({connectionString:url});
const readPool = new Pool({connectionString:runtimeConnectionString(url,DA3_READ_LOGIN,password)});
const writePool = new Pool({connectionString:runtimeConnectionString(url,DA3_WRITE_LOGIN,password)});
const coordinator = new TimeReviewCoordinator(readPool,writePool,verifier);
beforeEach(()=>resetMigratePrepareAndSeed(installerPool,password));
afterAll(()=>Promise.all([installerPool.end(),readPool.end(),writePool.end()]));
const query = (cursor: string | null = null, token: string = tokens.adminA, membership: string = ids.membershipAdminA) => coordinator.queryReviewItemsV4({accessToken:token,request:{expectedMembershipId:membership,limit:100,cursor}});

it('T097: preserves microseconds and UUID tie order across more than two full pages',async()=>{
  const expected: string[] = [ids.legacyReviewEventA];
  for(let i=0;i<205;i++) {
    const id = randomUUID(); expected.push(id);
    await insertCanonicalEscalation(id,'work_event_precedes_active_time_entry',`2026-07-22T09:00:00.${String(123456+Math.floor(i/70)).padStart(6,'0')}Z`);
  }
  const seen:string[]=[];
  let cursor:string|null=null;
  for(let page=0;page<4;page++) {
    const result=await query(cursor); expect(result.status).toBe('ready');
    if(result.status!=='ready') return;
    seen.push(...result.value.items.map(item=>item.reviewItemId));
    cursor=result.value.nextCursor;
    if(cursor===null) break;
  }
  expect(cursor).toBeNull();
  expect(seen.length).toBe(expected.length);
  expect(new Set(seen)).toEqual(new Set(expected));
});

it('T097: known reason lists cover the current SQL checks and every Engine reason',async()=>{
  const checks=await installerPool.query<{table_name:string;definition:string}>(`SELECT conrelid::regclass::text AS table_name, pg_get_constraintdef(oid) AS definition FROM pg_constraint
    WHERE contype='c' AND conrelid IN ('taptime_server.canonical_decisions'::regclass,
      'taptime_server.offline_event_reconciliations'::regclass,'taptime_server.offline_skipped_sequences'::regclass)`);
  const sqlValues=(table:string,column:string)=>checks.rows.filter(row=>row.table_name===`taptime_server.${table}`).flatMap(({definition})=>[...definition.matchAll(new RegExp(`\\b${column} = ANY \\(ARRAY\\[([^\\]]+)\\]`, 'g'))]
    .flatMap(match=>[...match[1]!.matchAll(/'([^']+)'::text/g)].map(value=>value[1]!)));
  const engine=sqlValues('canonical_decisions','reason');
  expect(new Set(engine)).toEqual(new Set(BUSINESS_ENGINE_ESCALATION_REASONS));
  const reasons=[...engine,...sqlValues('offline_skipped_sequences','reason'),
    ...sqlValues('offline_event_reconciliations','review_reason').filter(reason=>reason!=='business_engine_escalation')];
  expect(reasons.length).toBeGreaterThan(0);
  for(const reason of reasons) expect(TIME_REVIEW_REASONS,reason).toContain(reason);
  const roles=await installerPool.query<{definition:string}>(`SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint
    WHERE contype='c' AND conrelid='taptime_server.memberships'::regclass`);
  const membershipRoles=roles.rows.flatMap(({definition})=>[...definition.matchAll(/'([^']+)'::text/g)].map(match=>match[1]));
  for(const role of TIME_REVIEW_ROLES) expect(membershipRoles).toContain(role);
});

it('T097: a canonical break has no invented target and can be closed',async()=>{
  const id=randomUUID();
  await installerPool.query(`INSERT INTO taptime_server.work_events
    (id,organization_id,triggered_by_user_id,occurred_at,received_at,subject_type,trigger_type,content_hash,content_hash_algorithm,content_hash_version)
    VALUES($1,$2,$3,'2026-07-19T08:00:00Z','2026-07-19T08:00:00Z','break','manual',repeat('a',64),'sha256',3)`,[id,ids.organizationA,ids.employeeA]);
  await installerPool.query(`INSERT INTO taptime_server.canonical_decisions
    (work_event_id,organization_id,actor_user_id,subject_type,decision_type,reason,engine_version,decision_payload)
    VALUES($1,$2,$3,'break','escalation_required','work_event_precedes_active_break','test','{}')`,[id,ids.organizationA,ids.employeeA]);
  const result=await query();
  expect(result).toMatchObject({status:'ready',value:{items:expect.arrayContaining([expect.objectContaining({reviewItemId:id,targetType:'break',targetId:null,targetDisplayName:'Pause'})])}});
  expect(await query(null,tokens.adminB,ids.membershipAdminB)).toMatchObject({status:'ready',value:{items:[]}});
  expect(await coordinator.adjudicateReviewItems({accessToken:tokens.adminA,request:{expectedMembershipId:ids.membershipAdminA,commandId:randomUUID(),reviewItemIds:[id],resolution:{type:'no_time_record_change'},reason:'Pause geprüft'}})).toMatchObject({status:'committed'});
  const after=await query(); if(after.status!=='ready') throw new Error('Read failed');
  expect(after.value.items.map(item=>item.reviewItemId)).not.toContain(id);
});

it('T097: offline break evidence remains visible alongside skipped sequences and releases its queue after closing',async()=>{
  const id=randomUUID(), skipped=randomUUID();
  await installerPool.query(`INSERT INTO taptime_server.work_events
    (id,organization_id,triggered_by_user_id,occurred_at,subject_type,trigger_type,content_hash,content_hash_algorithm,content_hash_version)
    VALUES($1,$2,$3,'2026-07-21T08:00:00Z','break','manual',repeat('a',64),'sha256',3)`,[id,ids.organizationA,ids.employeeA]);
  const installation=await insertOfflineBreakReview(id);
  expect((await installerPool.query('SELECT review_predecessor_sequence FROM taptime_server.offline_sync_cursors WHERE installation_id=$1',[installation])).rows)
    .toEqual([{review_predecessor_sequence:'1'}]);
  await installerPool.query(`INSERT INTO taptime_server.offline_skipped_sequences
    (organization_id,installation_id,user_id,membership_id,device_sequence,work_event_id,receipt_id,
     lease_id,lease_item_id,occurred_at,reason,evidence_sha256,request_hash)
    SELECT organization_id,installation_id,user_id,membership_id,2,$2,gen_random_uuid(),lease_id,lease_item_id,
      '2026-07-21T09:00:00Z','invalid_response',repeat('a',64),repeat('b',64)
    FROM taptime_server.offline_event_reconciliations WHERE work_event_id=$1`,[id,skipped]);
  const result=await query();
  expect(result).toMatchObject({status:'ready',value:{items:expect.arrayContaining([
    expect.objectContaining({reviewItemId:id,source:'offline_v2',targetId:null,targetDisplayName:'Pause'}),
    expect.objectContaining({reviewItemId:skipped,source:'offline_skip',targetId:null,targetDisplayName:'Pause'}),
  ])}});
  expect(await coordinator.adjudicateReviewItems({accessToken:tokens.adminA,request:{expectedMembershipId:ids.membershipAdminA,
    commandId:randomUUID(),reviewItemIds:[id],resolution:{type:'no_time_record_change'},reason:'Pause geprüft'}})).toMatchObject({status:'committed'});
  const cursor=await installerPool.query('SELECT review_predecessor_sequence FROM taptime_server.offline_sync_cursors WHERE installation_id=$1',[installation]);
  expect(cursor.rows).toEqual([{review_predecessor_sequence:null}]);
  const after=await query();
  expect(after).toMatchObject({status:'ready',value:{items:expect.arrayContaining([expect.objectContaining({reviewItemId:skipped})])}});
  if(after.status!=='ready') throw new Error('Read failed');
  expect(after.value.items.map(item=>item.reviewItemId)).not.toContain(id);
});

it.each(['offline_v2','server_legacy'] as const)('T097: %s break rejects both time-changing actions without writes',async source=>{
  const id=await insertBreak();
  if(source==='offline_v2') await insertOfflineBreakReview(id);
  else await installerPool.query(`INSERT INTO taptime_server.canonical_decisions
    (work_event_id,organization_id,actor_user_id,subject_type,decision_type,reason,engine_version,decision_payload)
    VALUES($1,$2,$3,'break','escalation_required','work_event_precedes_active_break','test','{}')`,[id,ids.organizationA,ids.employeeA]);
  for(const resolution of [
    {type:'create_recovered_time_record' as const,startedAt:'2026-07-19T07:00:00.000Z',stoppedAt:'2026-07-19T09:00:00.000Z'},
    {type:'adjust_existing_time_record' as const,timeRecordId:ids.stoppedEntryA,expectedBaseRowVersion:1,expectedRevisionNumber:0,
      startedAt:'2026-07-19T07:00:00.000Z',stoppedAt:'2026-07-19T09:00:00.000Z'},
  ]) {
    const commandId=randomUUID();
    expect(await coordinator.adjudicateReviewItems({accessToken:tokens.adminA,request:{expectedMembershipId:ids.membershipAdminA,
      commandId,reviewItemIds:[id],resolution,reason:'Nicht als Arbeit buchen'}})).toMatchObject({status:'invalid_evidence'});
    const writes=await installerPool.query(`SELECT command_id FROM taptime_server.time_review_command_receipts WHERE command_id=$1
      UNION ALL SELECT command_id FROM taptime_server.time_record_revisions WHERE command_id=$1
      UNION ALL SELECT command_id FROM taptime_server.offline_review_adjudications WHERE command_id=$1`,[commandId]);
    expect(writes.rows).toEqual([]);
  }
});

it('T097: migration preserves existing work adjudications and their retry',async()=>{
  await resetMigratePrepareAndSeed(installerPool,password,'044');
  const command={accessToken:tokens.adminA,request:{expectedMembershipId:ids.membershipAdminA,commandId:randomUUID(),
    reviewItemIds:[ids.legacyReviewEventA],resolution:{type:'no_time_record_change' as const},reason:'Arbeitsfall geprüft'}};
  expect(await coordinator.adjudicateReviewItems(command)).toMatchObject({status:'committed'});
  const before=await installerPool.query('SELECT to_jsonb(a) AS row FROM taptime_server.offline_review_adjudications a');
  await applyMigrationSet(installerPool,await loadMigrations());
  const after=await installerPool.query("SELECT to_jsonb(a)-'subject_type' AS row FROM taptime_server.offline_review_adjudications a");
  expect(after.rows).toEqual(before.rows);
  expect(await coordinator.adjudicateReviewItems(command)).toMatchObject({status:'committed',value:{idempotentRetry:true}});
});

it('T097: database ties nullable targets to real break evidence and still requires a note',async()=>{
  const pause=await insertBreak();
  const insert=(eventId:string,targetType:string|null,targetId:string|null,reason='Pause geprüft',userId:string=ids.employeeA)=>installerPool.query(
    `INSERT INTO taptime_server.offline_review_adjudications
      (organization_id,work_event_id,user_id,target_type,target_customer_id,subject_type,source_family,
       actor_user_id,actor_membership_id,resolution,reason,command_id)
     VALUES($1,$2,$3,$4,$5,'break','server_legacy',$6,$7,'no_time_record_change',$8,$9)`,
    [ids.organizationA,eventId,userId,targetType,targetId,ids.adminA,ids.membershipAdminA,reason,randomUUID()]);
  await expect(insert(ids.legacyReviewEventA,null,null)).rejects.toMatchObject({code:'23514'});
  await expect(insert(pause,'customer',ids.customerA)).rejects.toMatchObject({code:'23514'});
  await expect(insert(pause,null,ids.customerA)).rejects.toMatchObject({code:'23514'});
  await expect(insert(pause,'customer',null)).rejects.toMatchObject({code:'23514'});
  await expect(insert(pause,null,null,'   ')).rejects.toMatchObject({code:'23514'});
  await expect(insert(pause,null,null,'Pause geprüft',ids.adminB)).rejects.toMatchObject({code:'23514'});
  await expect(insert(randomUUID(),null,null)).rejects.toMatchObject({code:'23514'});
  await insert(pause,null,null);
  expect((await installerPool.query('SELECT subject_type,target_type,target_customer_id,resolution FROM taptime_server.offline_review_adjudications WHERE work_event_id=$1',[pause])).rows)
    .toEqual([{subject_type:'break',target_type:null,target_customer_id:null,resolution:'no_time_record_change'}]);
});

async function insertBreak():Promise<string> {
  const id=randomUUID();
  await installerPool.query(`INSERT INTO taptime_server.work_events
    (id,organization_id,triggered_by_user_id,occurred_at,received_at,subject_type,trigger_type,content_hash,content_hash_algorithm,content_hash_version)
    VALUES($1,$2,$3,'2026-07-19T08:00:00Z','2026-07-19T08:00:00Z','break','manual',repeat('a',64),'sha256',3)`,[id,ids.organizationA,ids.employeeA]);
  return id;
}

async function insertCanonicalEscalation(
  eventId: string,
  reason:
    | 'active_time_entry_organization_mismatch'
    | 'active_time_entry_user_mismatch'
    | 'previous_work_event_organization_mismatch'
    | 'previous_work_event_user_mismatch'
    | 'previous_work_event_target_mismatch'
    | 'work_event_precedes_active_time_entry'
    | 'work_event_precedes_previous_accepted_work_event',
  occurredAt: string,
): Promise<void> {
  await installerPool.query(
    `INSERT INTO taptime_server.work_events
      (id, organization_id, assignment_id, nfc_tag_id, target_type,
       target_customer_id, triggered_by_user_id, occurred_at, received_at,
       content_hash, content_hash_algorithm, content_hash_version)
     VALUES ($1, $2, $3, $4, 'customer', $5, $6, $7, $7,
       repeat('e', 64), 'sha256', 1)`,
    [
      eventId, ids.organizationA, ids.assignmentA, ids.tagA,
      ids.customerA, ids.employeeA, occurredAt,
    ],
  );
  await installerPool.query(
    `INSERT INTO taptime_server.canonical_decisions
      (work_event_id, organization_id, actor_user_id, target_type,
       target_customer_id, decision_type, reason, engine_version, decision_payload)
     VALUES ($1, $2, $3, 'customer', $4, 'escalation_required', $5,
       'taptime-core-test', pg_catalog.jsonb_build_object('status',
       'escalation_required', 'reason', $5::text))`,
    [eventId, ids.organizationA, ids.employeeA, ids.customerA, reason],
  );
}

async function insertOfflineBreakReview(eventId: string): Promise<string> {
  const installationId = '91000000-0000-4000-8000-000000000301';
  const leaseId = '92000000-0000-4000-8000-000000000301';
  const itemId = '93000000-0000-4000-8000-000000000301';
  const receiptId = '94000000-0000-4000-8000-000000000301';
  await installerPool.query(
    `INSERT INTO taptime_server.offline_installations
      (id, organization_id, user_id, membership_id, identity_binding_id, binding_digest)
     VALUES ($1, $2, $3, $4, '11000000-0000-4000-8000-000000000302', decode(repeat('11', 32), 'hex'))`,
    [installationId, ids.organizationA, ids.employeeA, ids.membershipEmployeeA],
  );
  await installerPool.query(
    `INSERT INTO taptime_server.offline_capture_leases
      (id, organization_id, installation_id, identity_binding_id, user_id, membership_id,
       membership_row_version, membership_role, issued_at, expires_at,
       configuration_revision, item_count, serialized_bytes, manifest_digest)
     VALUES ($1, $2, $3, '11000000-0000-4000-8000-000000000302', $4, $5,
       1, 'employee', '2026-07-21T00:00:00Z', '2026-07-21T12:00:00Z',
       repeat('a', 64), 1, 1, repeat('b', 64))`,
    [leaseId, ids.organizationA, installationId, ids.employeeA, ids.membershipEmployeeA],
  );
  await installerPool.query(`INSERT INTO taptime_server.offline_capture_lease_items
    (id,organization_id,lease_id,installation_id,item_type,subject_type,display_name)
    VALUES($1,$2,$3,$4,'manual_break','break','Pause')`,[itemId,ids.organizationA,leaseId,installationId]);
  await installerPool.query(`INSERT INTO taptime_server.sync_receipts
    (id,organization_id,user_id,subject_type,work_event_id,attempt_number,status)
    VALUES($1,$2,$3,'break',$4,1,'received')`,[receiptId,ids.organizationA,ids.employeeA,eventId]);
  await installerPool.query(
    `INSERT INTO taptime_server.offline_sync_cursors
      (organization_id, installation_id, user_id, membership_id,
       last_durable_sequence, review_predecessor_sequence)
     VALUES ($1, $2, $3, $4, 1, 1)`,
    [ids.organizationA, installationId, ids.employeeA, ids.membershipEmployeeA],
  );
  await installerPool.query(
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
      ids.organizationA, eventId, receiptId, installationId,
      leaseId, itemId, ids.employeeA, ids.membershipEmployeeA,
    ],
  );
  return installationId;
}
