import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { Pool, type PoolClient } from 'pg';
import { afterAll, beforeAll, expect, it } from 'vitest';
import type { AccessTokenVerifier } from '@taptime/backend-identity';
import { TimeReviewCoordinator } from '../../backend-time-review/src/TimeReviewCoordinator.js';
import { ids, DA3_ISSUER, DA3_READ_LOGIN, runtimeConnectionString, resetMigratePrepareAndSeed } from '../../backend-time-review/tests/fixtures.js';
import { closePoolAndDropTestDatabase } from '../../backend-schema/tests/support/postgresTestDatabaseCleanup.mjs';
import { definerFindings, tenantPolicyFindings } from '../../backend-schema/tests/support/catalogSecurity.js';
import { createBackendHttpServer } from '../src/BackendHttpServer.js';
import type { BackendApiDependencies } from '../src/types.js';
import { listen, closeServer } from './fixtures.js';

const installerUrl = process.env.B3_DATABASE_URL ?? 'postgresql://timbartz@127.0.0.1:5432/taptime_b3';
const installer = new Pool({ connectionString: installerUrl, max: 1 });
const databaseName = `t135_${randomUUID().replaceAll('-', '')}`;
const url = new URL(installerUrl); url.pathname = `/${databaseName}`;
const db = new Pool({ connectionString: url.href, max: 2 });
const runtime = new Pool({ connectionString: runtimeConnectionString(url.href, DA3_READ_LOGIN, 't135-synthetic'), max: 1 });
let created = false, base = '';
const north = randomUUID(), south = randomUUID();
type Actor = { user: string; member: string; role: string; org: string };
const person = (role = 'employee') => ({ user: randomUUID(), member: randomUUID(), role, org: ids.organizationA });
const admin = { user: ids.adminA, member: ids.membershipAdminA, role: 'administrator', org: ids.organizationA };
const employee = { user: ids.employeeA, member: ids.membershipEmployeeA, role: 'employee', org: ids.organizationA };
const foreign = { user: ids.adminB, member: ids.membershipAdminB, role: 'administrator', org: ids.organizationB };
const manager = person('standortleitung'), outside = person(), former = person(), oldFormer = person();
const actors = { admin, employee, foreign, manager, outside, former, oldFormer };
const verifier: AccessTokenVerifier = { async verify(token) {
  const name = token.split('.')[0] as keyof typeof actors;
  return actors[name] ? { status: 'verified', identity: { issuer: DA3_ISSUER, subject: actors[name].member } }
    : { status: 'rejected', reason: 'invalid_signature' };
} };
const coordinator = new TimeReviewCoordinator(runtime, runtime, verifier);
const server = createBackendHttpServer({ timeReview: coordinator } as unknown as BackendApiDependencies);
const reviews = { outside: randomUUID(), foreign: randomUUID(), former: randomUUID(), oldFormer: randomUUID(),
  summer: randomUUID(), winter: randomUUID(), large: randomUUID() };
const largeRecords: string[] = [];
const summerRecords: string[] = [];

async function asActor<T>(who: Actor, run: (client: PoolClient) => Promise<T>, role = 'taptime_time_review_reader') {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.organization_id',$1,true),set_config('app.user_id',$2,true),set_config('app.membership_id',$3,true),set_config('app.membership_role',$4,true)", [who.org, who.user, who.member, who.role]);
    await client.query(`SET LOCAL ROLE ${role}`);
    return await run(client);
  } finally { await client.query('ROLLBACK'); client.release(); }
}
async function review(who: Actor, id: string, at: string) {
  await db.query(`INSERT INTO taptime_server.work_events(id,organization_id,triggered_by_user_id,target_type,target_customer_id,
    occurred_at,trigger_type,content_hash,content_hash_algorithm,content_hash_version)
    VALUES($1,$2,$3,'customer',$4,$5,'manual',repeat('a',64),'sha256',2)`,
  [id, who.org, who.user, who.org === ids.organizationA ? ids.customerA : ids.customerB, at]);
  await db.query(`INSERT INTO taptime_server.audit_events(id,organization_id,actor_user_id,work_event_user_id,work_event_id,
    event_type,entity_type,entity_id,occurred_at,correlation_id,payload)
    VALUES(gen_random_uuid(),$1,$2,$2,$3,'LifecycleDeferred','WorkEvent',$3,transaction_timestamp(),'t135','{}')`, [who.org, who.user, id]);
}
async function record(start: string, stop: string) {
  const id = randomUUID();
  await db.query(`INSERT INTO taptime_server.time_record_revisions(organization_id,time_record_id,revision_number,user_id,target_type,target_customer_id,
    effective_started_at,effective_stopped_at,base_row_version,actor_user_id,actor_membership_id,reason,command_id,request_hash)
    VALUES($1,$2,1,$3,'customer',$4,$5,$6,0,$7,$8,'SYNTHETISCH',gen_random_uuid(),repeat('a',64))`,
  [ids.organizationA, id, ids.employeeA, ids.customerA, start, stop, ids.adminA, ids.membershipAdminA]);
  return id;
}
const request = async (who: keyof typeof actors, reviewItemIds: string[], cursor: string | null = null, extra = {}) => {
  const response = await fetch(`${base}/v1/administration/review-days/query`, { method: 'POST',
    headers: { authorization: `Bearer ${who}.payload.signature`, 'content-type': 'application/json' },
    body: JSON.stringify({ expectedMembershipId: actors[who].member, reviewItemIds, cursor, ...extra }) });
  const text = await response.text();
  return { status: response.status, bytes: Buffer.byteLength(text), body: JSON.parse(text) };
};

beforeAll(async () => {
  expect(Math.floor(Number((await installer.query('SHOW server_version_num')).rows[0].server_version_num) / 10000)).toBe(17);
  await installer.query(`CREATE DATABASE "${databaseName}" TEMPLATE template0 ENCODING 'UTF8'`); created = true;
  await resetMigratePrepareAndSeed(db, 't135-synthetic');
  await db.query("INSERT INTO taptime_server.locations(id,organization_id,display_name) VALUES($1,$3,'Nord'),($2,$3,'Süd')", [north, south, ids.organizationA]);
  for (const who of [manager, outside, former, oldFormer]) {
    await db.query('INSERT INTO taptime_server.users(id) VALUES($1)', [who.user]);
    await db.query("INSERT INTO taptime_server.memberships(id,organization_id,user_id,role,display_name,created_at) VALUES($1,$2,$3,$4,'SYNTHETISCH',transaction_timestamp()-interval '1 year')", [who.member, who.org, who.user, who.role]);
  }
  for (const who of Object.values(actors)) {
    await db.query('INSERT INTO taptime_server.identity_bindings(id,user_id,issuer,subject) VALUES(gen_random_uuid(),$1,$2,$3) ON CONFLICT DO NOTHING', [who.user, DA3_ISSUER, who.member]);
    if (who.org === ids.organizationA) await db.query(`INSERT INTO taptime_server.membership_home_location_assignments(id,organization_id,membership_id,location_id,assigned_at)
      VALUES(gen_random_uuid(),$1,$2,$3,transaction_timestamp()-interval '1 year')`, [who.org, who.member, who === outside ? south : north]);
  }
  await db.query('INSERT INTO taptime_server.membership_management_location_grants(id,organization_id,membership_id,location_id) VALUES(gen_random_uuid(),$1,$2,$3)', [ids.organizationA, manager.member, north]);
  await db.query(`INSERT INTO taptime_server.work_target_location_assignments(id,organization_id,target_type,target_id,location_id)
    SELECT gen_random_uuid(),organization_id,target_type,target_id,$2 FROM taptime_server.work_targets WHERE organization_id=$1 AND active AND target_type<>'general_work'`, [ids.organizationA, north]);
  await db.query('UPDATE taptime_server.organizations SET locations_enabled=true,row_version=row_version+1 WHERE id=$1', [ids.organizationA]);
  const now = new Date().toISOString();
  await review(outside, reviews.outside, now); await review(foreign, reviews.foreign, now);
  await review(former, reviews.former, now); await review(oldFormer, reviews.oldFormer, '2026-01-01T12:00:00.000Z');
  await db.query('UPDATE taptime_server.memberships SET revoked_at=clock_timestamp(),row_version=row_version+1 WHERE id=$1', [former.member]);
  await db.query("UPDATE taptime_server.memberships SET revoked_at=transaction_timestamp()-interval '3 months',row_version=row_version+1 WHERE id=$1", [oldFormer.member]);
  await review(employee, reviews.summer, '2026-03-29T01:30:00.000Z');
  await review(employee, reviews.winter, '2026-10-25T01:30:00.000Z');
  summerRecords.push(await record('2026-03-28T22:30:00.000Z', '2026-03-28T23:30:00.000Z'));
  summerRecords.push(await record('2026-03-29T21:30:00.000Z', '2026-03-29T22:30:00.000Z'));
  await record('2026-03-28T22:00:00.000Z', '2026-03-28T23:00:00.000Z');
  await record('2026-03-29T22:00:00.000Z', '2026-03-29T23:00:00.000Z');
  await review(employee, reviews.large, '2026-06-01T12:00:00.000Z');
  for (let index = 0; index < 65; index++) {
    const start = Date.parse('2026-06-01T00:00:00.000Z') + index * 60_000;
    largeRecords.push(await record(new Date(start).toISOString(), new Date(start + 30_000).toISOString()));
  }
  await listen(server); base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => {
  await closeServer(server); await runtime.end();
  if (created) await closePoolAndDropTestDatabase({ installerPool: installer, databaseName, targetPool: db });
  else await db.end();
  await installer.end();
});

it('T135: derives person and day from the case and omits foreign, unknown and unauthorized IDs', async () => {
  const requested = [ids.legacyReviewEventA, reviews.outside, reviews.foreign, reviews.former, reviews.oldFormer, ids.stoppedStartEventA, randomUUID()];
  const result = await request('manager', requested);
  expect(result.status).toBe(200);
  expect(result.body.days.map((day: { reviewItemId: string }) => day.reviewItemId)).toEqual([ids.legacyReviewEventA, reviews.former]);
  expect((await request('admin', [reviews.outside])).body.days).toHaveLength(1);
  expect((await request('foreign', [ids.legacyReviewEventA])).body).toMatchObject({ days: [], nextCursor: null });
  expect((await request('employee', [ids.legacyReviewEventA])).status).toBe(403);
  expect((await request('manager', [reviews.foreign])).body).toEqual((await request('manager', [randomUUID()])).body);
  expect((await request('manager', [ids.legacyReviewEventA], null, { targetMembershipId: outside.member })).status).toBe(400);
});
it('T135: uses the 23-hour and 25-hour Berlin days and includes only overlapping closed times', async () => {
  const result = await request('admin', [reviews.summer, reviews.winter]);
  expect(result.status).toBe(200);
  expect(result.body.days[0]).toMatchObject({ windowStartedAt: '2026-03-28T23:00:00.000Z', windowEndedAt: '2026-03-29T22:00:00.000Z', activeRecord: null, complete: true });
  expect(result.body.days[0].records.map((row: { timeRecordId: string }) => row.timeRecordId)).toEqual(summerRecords);
  expect(result.body.days[1]).toMatchObject({ windowStartedAt: '2026-10-24T22:00:00.000Z', windowEndedAt: '2026-10-25T23:00:00.000Z', activeRecord: { timeRecordId: ids.activeEntryA } });
});
it('T135: includes the current running record only if it starts before the case day ends', async () => {
  const result = await request('admin', [ids.legacyReviewEventA, reviews.summer]);
  expect(result.status).toBe(200);
  expect(result.body.days[0].activeRecord).toMatchObject({ timeRecordId: ids.activeEntryA, stoppedAt: null });
  expect(result.body.days[1].activeRecord).toBeNull();
});
it('T135: bounds each UTF-8 response and traverses the complete day without duplicate or missing times', async () => {
  await db.query('UPDATE taptime_server.customers SET display_name=$1,row_version=row_version+1 WHERE id=$2', ['界'.repeat(120), ids.customerA]);
  const seen: string[] = [], cursors = new Set<string>();
  let cursor: string | null = null;
  do {
    const result = await request('admin', [reviews.large], cursor);
    expect(result.status).toBe(200); expect(result.bytes).toBeLessThanOrEqual(14 * 1024);
    expect(result.body.days).toHaveLength(1);
    seen.push(...result.body.days[0].records.map((row: { timeRecordId: string }) => row.timeRecordId));
    cursor = result.body.nextCursor;
    if (cursor) {
      expect(cursors.has(cursor)).toBe(false); cursors.add(cursor);
      expect(result.body.days[0].complete).toBe(false);
      expect((await request('admin', [reviews.summer], cursor)).status).toBe(400);
    } else expect(result.body.days[0].complete).toBe(true);
  } while (cursor);
  expect(seen).toEqual(largeRecords); expect(cursors.size).toBeGreaterThan(0);
});
it('T135: validates batch size and exact fields before opening the read capability', async () => {
  for (const invalid of [[], Array.from({ length: 21 }, () => randomUUID()), [ids.legacyReviewEventA, ids.legacyReviewEventA], ['bad']])
    expect((await request('admin', invalid)).status).toBe(400);
  expect((await request('admin', Array.from({ length: 20 }, () => randomUUID()))).body).toMatchObject({ days: [], nextCursor: null });
});
it('T135: the new SQL reader is tenant bound even when called directly with the runtime role', async () => {
  const result = await asActor(manager, client => client.query('SELECT * FROM taptime_server.read_review_days_v1($1,NULL,NULL,NULL,NULL,51)', [[reviews.outside, reviews.foreign, ids.legacyReviewEventA]]));
  expect(new Set(result.rows.map(row => row.review_item_id))).toEqual(new Set([ids.legacyReviewEventA]));
  await asActor(manager, async client => {
    expect(await definerFindings(client)).toEqual([]); expect(await tenantPolicyFindings(client)).toEqual([]);
  });
});

async function insertOfflineBreakReview(eventId: string): Promise<string> {
  const installationId = '91000000-0000-4000-8000-000000000301';
  const leaseId = '92000000-0000-4000-8000-000000000301';
  const itemId = '93000000-0000-4000-8000-000000000301';
  const receiptId = '94000000-0000-4000-8000-000000000301';
  await db.query(
    `INSERT INTO taptime_server.offline_installations
      (id, organization_id, user_id, membership_id, identity_binding_id, binding_digest)
     VALUES ($1, $2, $3, $4, '11000000-0000-4000-8000-000000000302', decode(repeat('11', 32), 'hex'))`,
    [installationId, ids.organizationA, ids.employeeA, ids.membershipEmployeeA],
  );
  await db.query(
    `INSERT INTO taptime_server.offline_capture_leases
      (id, organization_id, installation_id, identity_binding_id, user_id, membership_id,
       membership_row_version, membership_role, issued_at, expires_at,
       configuration_revision, item_count, serialized_bytes, manifest_digest)
     VALUES ($1, $2, $3, '11000000-0000-4000-8000-000000000302', $4, $5,
       1, 'employee', '2026-07-21T00:00:00Z', '2026-07-21T12:00:00Z',
       repeat('a', 64), 1, 1, repeat('b', 64))`,
    [leaseId, ids.organizationA, installationId, ids.employeeA, ids.membershipEmployeeA],
  );
  await db.query(`INSERT INTO taptime_server.offline_capture_lease_items
    (id,organization_id,lease_id,installation_id,item_type,subject_type,display_name)
    VALUES($1,$2,$3,$4,'manual_break','break','Pause')`,[itemId,ids.organizationA,leaseId,installationId]);
  await db.query(`INSERT INTO taptime_server.sync_receipts
    (id,organization_id,user_id,subject_type,work_event_id,attempt_number,status)
    VALUES($1,$2,$3,'break',$4,1,'received')`,[receiptId,ids.organizationA,ids.employeeA,eventId]);
  await db.query(
    `INSERT INTO taptime_server.offline_sync_cursors
      (organization_id, installation_id, user_id, membership_id,
       last_durable_sequence, review_predecessor_sequence)
     VALUES ($1, $2, $3, $4, 1, 1)`,
    [ids.organizationA, installationId, ids.employeeA, ids.membershipEmployeeA],
  );
  await db.query(
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

it('T135: offline breaks and skipped evidence use the same context and closed cases disappear', async () => {
  const pause=randomUUID(), skipped=randomUUID();
  await db.query(`INSERT INTO taptime_server.work_events
    (id,organization_id,triggered_by_user_id,occurred_at,subject_type,trigger_type,content_hash,content_hash_algorithm,content_hash_version)
    VALUES($1,$2,$3,'2026-07-21T08:00:00Z','break','manual',repeat('a',64),'sha256',3)`,[pause,ids.organizationA,ids.employeeA]);
  await insertOfflineBreakReview(pause);
  await db.query(`INSERT INTO taptime_server.offline_skipped_sequences
    (organization_id,installation_id,user_id,membership_id,device_sequence,work_event_id,receipt_id,
     lease_id,lease_item_id,occurred_at,reason,evidence_sha256,request_hash)
    SELECT organization_id,installation_id,user_id,membership_id,2,$2,gen_random_uuid(),lease_id,lease_item_id,
      '2026-07-21T09:00:00Z','invalid_response',repeat('a',64),repeat('b',64)
    FROM taptime_server.offline_event_reconciliations WHERE work_event_id=$1`,[pause,skipped]);
  const result=await request('manager',[pause,skipped]);expect(result.status).toBe(200);
  expect(result.body.days.map((day:{reviewItemId:string})=>day.reviewItemId)).toEqual([pause,skipped]);
  expect(result.body.days[0].activeRecord.timeRecordId).toBe(ids.activeEntryA);
  await db.query(`INSERT INTO taptime_server.offline_skip_resolutions(organization_id,work_event_id,actor_user_id,actor_membership_id,
    command_id,request_hash,reason,resolution) VALUES($1,$2,$3,$4,gen_random_uuid(),repeat('d',64),'Synthetisch geprüft','no_time_record_change')`,
    [ids.organizationA,skipped,ids.adminA,ids.membershipAdminA]);
  expect((await request('manager',[skipped])).body).toEqual({status:'ready',days:[],nextCursor:null});
});
it('T135: every cursor page rechecks the live manager scope', async () => {
  const first=await request('manager',[reviews.large]);expect(first.status).toBe(200);expect(first.body.nextCursor).not.toBeNull();
  await db.query('UPDATE taptime_server.membership_management_location_grants SET revoked_at=clock_timestamp() WHERE membership_id=$1',[manager.member]);
  const next=await request('manager',[reviews.large],first.body.nextCursor);
  expect(next.status).toBe(403);
});

it('T135: a valid zero-duration record does not make the whole batch unavailable', async () => {
  const zero=await record('2026-03-29T12:00:00.000Z','2026-03-29T12:00:00.000Z');
  const result=await request('admin',[reviews.summer,reviews.winter]);expect(result.status).toBe(200);
  expect(result.body.days[0].records).toContainEqual(expect.objectContaining({timeRecordId:zero,startedAt:'2026-03-29T12:00:00.000Z',stoppedAt:'2026-03-29T12:00:00.000Z'}));
});
