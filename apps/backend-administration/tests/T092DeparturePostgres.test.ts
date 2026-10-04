import { randomUUID } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import { beforeAll, beforeEach, afterAll, it, expect } from 'vitest';
import { migrate, B3_SCHEMA, B3_MIGRATION_TABLE } from '@taptime/backend-schema';
import { MembershipId, BusinessEngine, WorkEventId, createTimestamp, CustomerId, customerAssignmentTarget } from '@taptime/core';
import { EmployeeMembershipEnrollmentCoordinator } from '../src/EmployeeMembershipEnrollmentCoordinator.js';
import { ManualLifecycleIngestionCoordinator } from '@taptime/backend-lifecycle';
import { C3E1_INVITATION_RUNTIME_LOGIN, c3e1RuntimeConnectionString, ensureC3E1RuntimeLogins, removeC3E1RuntimeLogins, syntheticPassword, C3C_ISSUER, seedC3C, truncateC3C, ids, membershipIds, fixtureTokens, fixtureAccessTokenVerifier } from './fixtures.js';

const pool = new Pool({ connectionString: process.env.C3C_DATABASE_URL ?? 'postgresql://timbartz@127.0.0.1:5432/taptime_c3c', max: 5 });
let coordinator: EmployeeMembershipEnrollmentCoordinator;
let runtimePool: Pool;
const admin = { accessToken: fixtureTokens.adminA, expectedMembershipId: membershipIds.adminA };
const l1 = randomUUID(), l2 = randomUUID();
let user: string, member: string, entry: string;
const command = () => ({ ...admin, commandId: randomUUID(), targetMembershipId: MembershipId(member), expectedRowVersion: 1 });
async function asActor<T>(role: string, run: (c: PoolClient) => Promise<T>, actor: { user: string; member: string; role: string } = { user: ids.adminA, member: String(membershipIds.adminA), role: 'administrator' }): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    await c.query(`SELECT set_config('app.organization_id',$1,true),set_config('app.user_id',$2,true),set_config('app.membership_id',$3,true),set_config('app.membership_role',$4,true)`, [ids.organizationA, actor.user, actor.member, actor.role]);
    await c.query(`SET LOCAL ROLE ${role}`);
    const value = await run(c); await c.query('COMMIT'); return value;
  } catch (error) { await c.query('ROLLBACK'); throw error; } finally { c.release(); }
}
async function seedPerson(location: string | null = null) {
  user = randomUUID(); member = randomUUID(); entry = randomUUID();
  await pool.query('INSERT INTO taptime_server.users(id) VALUES($1)', [user]);
  await pool.query(`INSERT INTO taptime_server.memberships(id,organization_id,user_id,role,display_name) VALUES($1,$2,$3,'employee','Ausgeschiedene Person')`, [member, ids.organizationA, user]);
  if (location) await pool.query(`INSERT INTO taptime_server.membership_home_location_assignments(id,organization_id,membership_id,location_id) VALUES(gen_random_uuid(),$1,$2,$3)`, [ids.organizationA, member, location]);
}
async function seedRunning(minutes: number, pause = false) {
  const event = randomUUID(), began = new Date(Date.now() - minutes * 60_000).toISOString();
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    await c.query(`INSERT INTO taptime_server.work_events(id,organization_id,triggered_by_user_id,target_type,target_customer_id,occurred_at,trigger_type,content_hash,content_hash_algorithm,content_hash_version)
      VALUES($1,$2,$3,'customer',$4,$5,'manual',repeat('a',64),'sha256',2)`, [event, ids.organizationA, user, ids.customerA, began]);
    await c.query(`INSERT INTO taptime_server.time_entries(id,organization_id,user_id,target_type,target_customer_id,status,start_work_event_id,started_at,started_via)
      VALUES($1,$2,$3,'customer',$4,'started',$5,$6,'manual')`, [entry, ids.organizationA, user, ids.customerA, event, began]);
    await c.query(`INSERT INTO taptime_server.canonical_decisions(work_event_id,organization_id,actor_user_id,target_type,target_customer_id,decision_type,time_entry_id,engine_version,decision_payload)
      VALUES($1,$2,$3,'customer',$4,'time_entry_started',$5,'t092-fixture','{}')`, [event, ids.organizationA, user, ids.customerA, entry]);
    if (pause) {
      const breakEvent = randomUUID(), breakId = randomUUID(), breakAt = new Date(Date.now()-30*60_000).toISOString();
      await c.query(`INSERT INTO taptime_server.work_events(id,organization_id,triggered_by_user_id,occurred_at,subject_type,trigger_type,content_hash,content_hash_algorithm,content_hash_version)
        VALUES($1,$2,$3,$4,'break','manual',repeat('b',64),'sha256',3)`, [breakEvent, ids.organizationA, user, breakAt]);
      await c.query(`INSERT INTO taptime_server.break_intervals(id,organization_id,user_id,time_entry_id,status,start_work_event_id,started_at,started_via)
        VALUES($1,$2,$3,$4,'started',$5,$6,'manual')`, [breakId, ids.organizationA, user, entry, breakEvent, breakAt]);
      await c.query(`INSERT INTO taptime_server.canonical_decisions(work_event_id,organization_id,actor_user_id,subject_type,decision_type,time_entry_id,break_interval_id,engine_version,decision_payload)
        VALUES($1,$2,$3,'break','break_started',$4,$5,'t092-fixture','{}')`, [breakEvent, ids.organizationA, user, entry, breakId]);
    }
    await c.query('COMMIT');
  } catch (error) { await c.query('ROLLBACK'); throw error; } finally { c.release(); }
}
beforeAll(async () => {
  await pool.query(`DROP SCHEMA IF EXISTS ${B3_SCHEMA} CASCADE`);
  await pool.query(`DROP TABLE IF EXISTS ${B3_MIGRATION_TABLE}`);
  await migrate(pool);
  const password=syntheticPassword();
  await ensureC3E1RuntimeLogins(pool,password,syntheticPassword());
  runtimePool=new Pool({connectionString:c3e1RuntimeConnectionString(pool.options.connectionString!,C3E1_INVITATION_RUNTIME_LOGIN,password),max:4});
  coordinator=new EmployeeMembershipEnrollmentCoordinator(runtimePool,runtimePool,fixtureAccessTokenVerifier);
});
beforeEach(async () => { await truncateC3C(pool); await seedC3C(pool); await seedPerson(); });
afterAll(async () => { await runtimePool?.end(); await removeC3E1RuntimeLogins(pool); await pool.end(); });

it.each([false, true])('23:59 h: revoke stops work and pause=%s atomically through the engine; exact retry', async pause => {
  await seedRunning(1439, pause);
  const request = command();
  const first = await coordinator.revokeMembership(request);
  expect(first.status).toBe('succeeded');
  const membership = (await pool.query('SELECT revoked_at FROM taptime_server.memberships WHERE id=$1', [member])).rows[0];
  const time = (await pool.query('SELECT status,stopped_at,stopped_via,stop_work_event_id FROM taptime_server.time_entries WHERE id=$1', [entry])).rows[0];
  expect(time).toMatchObject({ status: 'stopped', stopped_via: 'administration', stopped_at: membership.revoked_at });
  expect((await pool.query('SELECT trigger_type FROM taptime_server.work_events WHERE id=$1', [time.stop_work_event_id])).rows).toEqual([{ trigger_type: 'administration' }]);
  if (pause) expect((await pool.query('SELECT status,stopped_at,stop_work_event_id FROM taptime_server.break_intervals WHERE time_entry_id=$1', [entry])).rows)
    .toEqual([{ status: 'stopped', stopped_at: membership.revoked_at, stop_work_event_id: time.stop_work_event_id }]);
  expect(await coordinator.revokeMembership(request)).toMatchObject({ status: 'succeeded', idempotentRetry: true });
  expect((await pool.query('SELECT 1 FROM taptime_server.administration_stop_commands WHERE time_entry_id=$1', [entry])).rowCount).toBe(1);
});
it('24:01 h: conflict without any mutation; chosen valid administration end then allows revoke', async () => {
  await seedRunning(1441);
  const request = command();
  expect(await coordinator.revokeMembership(request)).toEqual({ status: 'running_time_too_long' });
  expect((await pool.query('SELECT revoked_at,row_version FROM taptime_server.memberships WHERE id=$1', [member])).rows).toEqual([{ revoked_at: null, row_version: '1' }]);
  expect((await pool.query('SELECT status FROM taptime_server.time_entries WHERE id=$1', [entry])).rows).toEqual([{ status: 'started' }]);
  await asActor('taptime_time_review_writer', async c => {
    const start = (await pool.query('SELECT started_at FROM taptime_server.time_entries WHERE id=$1', [entry])).rows[0].started_at;
    const stop = { expectedMembershipId: admin.expectedMembershipId, targetMembershipId: member, timeRecordId: entry, expectedRowVersion: 1, commandId: randomUUID(), stoppedAt: new Date(start.getTime()+23*3600_000).toISOString(), reason: 'Ende berichtigt' };
    const context = (await c.query('SELECT taptime_server.prepare_administration_stop_v1($1::jsonb) AS result', [JSON.stringify(stop)])).rows[0].result;
    const event = { id: WorkEventId(randomUUID()), organizationId: context.activeTimeEntry.organizationId, triggeredBy: context.activeTimeEntry.userId, target: context.activeTimeEntry.target, occurredAt: createTimestamp(stop.stoppedAt), trigger: { type: 'administration' as const } };
    const decision = new BusinessEngine().evaluate(event, { activeTimeEntryForUser: context.activeTimeEntry, activeBreakIntervalForUser: context.activeBreakInterval, previousAcceptedWorkEventForUserAndTarget: null });
    expect((await c.query('SELECT taptime_server.commit_administration_stop_v1($1::jsonb,$2::jsonb,$3::jsonb) AS result', [JSON.stringify(stop), JSON.stringify(event), JSON.stringify(decision)])).rows[0].result.status).toBe('committed');
  });
  expect(await coordinator.revokeMembership(request)).toMatchObject({ status: 'succeeded' });
});
it('SQL revoke alone refuses an open time; departed mutation returns conflict rather than authority rejection', async () => {
  await seedRunning(60);
  expect(await asActor('taptime_membership_manager', async c => {
    const r = command(); await c.query("SELECT set_config('app.correlation_id',$1,true)", [r.commandId]);
    return (await c.query("SELECT * FROM taptime_server.manage_membership_v1($1,$2,1,'revoke',NULL)", [r.commandId, member])).rows[0].result_status;
  })).toBe('running_time_active');
  await coordinator.revokeMembership(command());
  expect(await coordinator.revokeMembership(command())).toEqual({ status: 'already_departed' });
  expect(await coordinator.changeMembershipRole({ ...command(), role: 'administrator' })).toEqual({ status: 'already_departed' });
});
it('departed staff can be listed and backfilled only up to departure', async () => {
  await coordinator.revokeMembership(command());
  const oldSummary = await coordinator.readManagedActiveSummary({ ...admin, locationId: null, isRunning: null, cursor: null, limit: 20 });
  expect(oldSummary).toMatchObject({ status: 'succeeded' });
  const summary = await coordinator.readManagedActiveSummary({ ...admin, locationId: null, isRunning: null, cursor: null, limit: 20, includeDeparted: true } as Parameters<typeof coordinator.readManagedActiveSummary>[0]);
  expect(summary).toMatchObject({ status: 'succeeded', value: { people: expect.arrayContaining([expect.objectContaining({ membershipId: member, departedAt: expect.any(String) })]) } });
  const departure = (await pool.query('SELECT revoked_at FROM taptime_server.memberships WHERE id=$1', [member])).rows[0].revoked_at as Date;
  const backfill = { expectedMembershipId: admin.expectedMembershipId, targetMembershipId: member, commandId: randomUUID(), targetType: 'customer', targetId: ids.customerA, startedAt: new Date(departure.getTime()-7200_000).toISOString(), stoppedAt: departure.toISOString(), reason: 'Vergessen', comment: null };
  const filled=await asActor('taptime_time_review_writer', async c => (await c.query('SELECT taptime_server.backfill_time_record_v1($1::jsonb) AS result', [JSON.stringify(backfill)])).rows[0].result);
  expect(filled).toMatchObject({status:'committed'});
  await assertDepartureCorrection(filled.timeRecordId,departure);
  expect(await asActor('taptime_time_review_writer',async c=>(await c.query('SELECT taptime_server.backfill_time_record_v1($1::jsonb) AS result',
    [JSON.stringify({...backfill,commandId:randomUUID(),targetId:ids.inactiveCustomerA})])).rows[0].result)).toMatchObject({status:'authority_rejected'});
  expect(await asActor('taptime_time_review_writer', async c => (await c.query('SELECT taptime_server.backfill_time_record_v1($1::jsonb) AS result', [JSON.stringify({ ...backfill, commandId: randomUUID(), startedAt: departure.toISOString(), stoppedAt: new Date(departure.getTime()+1).toISOString() })])).rows[0].result)).toEqual({ status: 'after_departure' });
});

it('location manager sees and edits departed staff only from the last home; the following month is the visibility limit', async () => {
  await pool.query(`INSERT INTO taptime_server.locations(id,organization_id,display_name) VALUES($1,$3,'Eins'),($2,$3,'Zwei')`, [l1,l2,ids.organizationA]);
  const ownMember=member, ownUser=user;
  await seedPerson(l2); const foreignMember=member;
  await pool.query(`INSERT INTO taptime_server.membership_home_location_assignments(id,organization_id,membership_id,location_id)
    SELECT gen_random_uuid(),organization_id,id,$2 FROM taptime_server.memberships m WHERE organization_id=$1
    AND NOT EXISTS(SELECT 1 FROM taptime_server.membership_home_location_assignments h WHERE h.membership_id=m.id)`, [ids.organizationA,l1]);
  await pool.query(`INSERT INTO taptime_server.work_target_location_assignments(id,organization_id,target_type,target_id,location_id)
    SELECT gen_random_uuid(),organization_id,target_type,target_id,$2 FROM taptime_server.work_targets WHERE organization_id=$1 AND active`,[ids.organizationA,l1]);
  await pool.query(`UPDATE taptime_server.memberships SET role='standortleitung',row_version=row_version+1 WHERE id=$1`,[membershipIds.employeeA]);
  await pool.query(`INSERT INTO taptime_server.membership_management_location_grants(id,organization_id,membership_id,location_id) VALUES(gen_random_uuid(),$1,$2,$3)`,[ids.organizationA,membershipIds.employeeA,l1]);
  await pool.query('UPDATE taptime_server.organizations SET locations_enabled=true,row_version=row_version+1 WHERE id=$1',[ids.organizationA]);
  const manager={accessToken:fixtureTokens.employeeA,expectedMembershipId:membershipIds.employeeA};
  expect(await coordinator.revokeMembership({...command(),...manager})).toEqual({status:'forbidden'});
  await coordinator.revokeMembership(command());
  member=ownMember;user=ownUser;entry=randomUUID();await seedRunning(60,true);
  expect(await coordinator.revokeMembership({...command(),...manager})).toMatchObject({status:'succeeded'});
  const query={...manager,locationId:null,isRunning:null,cursor:null,limit:20,includeDeparted:true};
  const summary=await coordinator.readManagedActiveSummary(query);
  expect(summary.status).toBe('succeeded'); if(summary.status!=='succeeded') return;
  expect(summary.value.people.map(p=>p.membershipId)).toContain(ownMember);
  expect(summary.value.people.map(p=>p.membershipId)).not.toContain(foreignMember);
  const departure=(await pool.query('SELECT revoked_at FROM taptime_server.memberships WHERE id=$1',[ownMember])).rows[0].revoked_at as Date;
  const request={expectedMembershipId:manager.expectedMembershipId,targetMembershipId:ownMember,commandId:randomUUID(),targetType:'customer',targetId:ids.customerA,
    startedAt:new Date(departure.getTime()-4*3600_000).toISOString(),stoppedAt:new Date(departure.getTime()-3*3600_000).toISOString(),reason:'Vergessen',comment:null};
  const actor={user:ids.employeeA,member:String(manager.expectedMembershipId),role:'standortleitung'};
  const fill=(r:unknown)=>asActor('taptime_time_review_writer',async c=>(await c.query('SELECT taptime_server.backfill_time_record_v1($1::jsonb) AS result',[JSON.stringify(r)])).rows[0].result,actor);
  const filled=await fill(request);
  expect(filled).toMatchObject({status:'committed'});
  await assertDepartureCorrection(filled.timeRecordId,departure,actor);
  expect(await fill({...request,commandId:randomUUID(),targetMembershipId:foreignMember})).toMatchObject({status:'authority_rejected'});
  expect(await fill({...request,commandId:randomUUID(),stoppedAt:new Date(departure.getTime()+1).toISOString()})).toMatchObject({status:'after_departure'});
  // Berlin month boundaries, including October's extra hour. Condition is derived from the departure month.
  const visible=(at:string)=>pool.query(`SELECT taptime_server.departure_is_visible_v1('2026-09-10T09:00:00Z',$1::timestamptz) AS visible`,[at]);
  expect((await visible('2026-10-31T22:59:59.999Z')).rows[0].visible).toBe(true);
  expect((await visible('2026-10-31T23:00:00.000Z')).rows[0].visible).toBe(false);
  const former=randomUUID();
  await pool.query('INSERT INTO taptime_server.users(id) VALUES($1)',[former]);
  await pool.query(`INSERT INTO taptime_server.memberships(id,organization_id,user_id,role,display_name,created_at,revoked_at)
    VALUES($1,$2,$1,'employee','Lange ausgeschieden',transaction_timestamp()-interval '4 months',transaction_timestamp()-interval '3 months')`,[former,ids.organizationA]);
  const all=await coordinator.readManagedActiveSummary({...query,...admin});
  expect(all.status).toBe('succeeded'); if(all.status==='succeeded') expect(all.value.people.map(p=>p.membershipId)).not.toContain(former);
});

async function waitForBlockedQuery(pattern: string, blocker?: number) {
  const deadline = Date.now()+5000;
  while (Date.now()<deadline) {
    const rows = await pool.query(`SELECT 1 FROM pg_stat_activity WHERE datname=current_database()
      AND pid<>pg_backend_pid() AND wait_event_type='Lock' AND query LIKE $1
      AND ($2::integer IS NULL OR $2=ANY(pg_blocking_pids(pid)))`, [pattern,blocker??null]);
    if(rows.rowCount) return;
    await new Promise(resolve=>setTimeout(resolve,10));
  }
  throw new Error('Expected concurrent PostgreSQL lock wait');
}
it.each(['start-first','revoke-first'])('parallel start/revoke (%s) cannot leave revoked staff with open time', async order => {
  await pool.query('INSERT INTO taptime_server.identity_bindings(id,user_id,issuer,subject) VALUES(gen_random_uuid(),$1::uuid,$2,$1::text)',[user,C3C_ISSUER]);
  const lifecycle = new ManualLifecycleIngestionCoordinator(pool,{verify:async()=>({status:'verified',identity:{issuer:C3C_ISSUER,subject:user}})},
    {requireOffsiteArchive:async()=>({requiredWalFile:'000000010000000000000000',offsiteArchived:true})});
  const start = ()=>lifecycle.ingestManual({accessToken:'t092',expectedMembershipId:MembershipId(member),
    workEvent:{id:WorkEventId(randomUUID()),target:customerAssignmentTarget(CustomerId(ids.customerA))},receipt:{id:randomUUID(),attemptNumber:1}});
  let startResult, revokeResult;
  if(order==='start-first') {
    const gate=await pool.connect();
    try {
      await gate.query('BEGIN');
      await gate.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`${ids.organizationA}\u001f${user}`]);
      const pid=(await gate.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
      const pendingStart=start(); await waitForBlockedQuery('%pg_advisory_xact_lock%',pid);
      const pendingRevoke=coordinator.revokeMembership(command());
      await waitForBlockedQuery('%manage_membership_v1%');
      await gate.query('COMMIT');
      [startResult,revokeResult]=await Promise.all([pendingStart,pendingRevoke]);
    } finally {await gate.query('ROLLBACK');gate.release();}
    expect(startResult).toMatchObject({status:'synchronized',decision:{status:'time_entry_started'}});
  } else {
    let release!:()=>void, held!:()=>void;
    const gate=new Promise<void>(r=>release=r), reached=new Promise<void>(r=>held=r);
    const pendingRevoke=coordinator.revokeMembership(command(),{beforeCommit:async()=>{held();await gate;}});
    await reached;
    const pendingStart=start(); await waitForBlockedQuery('%lock_request_actor%');
    release();[startResult,revokeResult]=await Promise.all([pendingStart,pendingRevoke]);
    expect(startResult).toMatchObject({status:'rejected',reason:'identity_or_membership_unavailable'});
  }
  expect(revokeResult).toMatchObject({status:'succeeded'});
  expect((await pool.query(`SELECT 1 FROM taptime_server.memberships m JOIN taptime_server.time_entries t
    ON t.organization_id=m.organization_id AND t.user_id=m.user_id WHERE m.id=$1 AND m.revoked_at IS NOT NULL AND t.status='started'`,[member])).rows).toEqual([]);
});


async function assertDepartureCorrection(timeRecordId:string,departure:Date,actor={user:String(ids.adminA),member:String(admin.expectedMembershipId),role:'administrator'}) {
  const correct=(end:Date,revision:number)=>asActor('taptime_time_review_writer',async c=>(await c.query(
    `SELECT * FROM taptime_server.correct_time_record_v1($1,$2,$3,$4,repeat('a',64),$5,0,$6,$7,$8,'Berichtigt')`,
    [ids.organizationA,actor.user,actor.member,randomUUID(),timeRecordId,revision,new Date(departure.getTime()-5*3600_000).toISOString(),end.toISOString()])).rows[0],actor);
  expect(await correct(departure,1)).toMatchObject({result_status:'committed'});
  expect(await correct(new Date(departure.getTime()+1),2)).toMatchObject({result_status:'after_departure'});
}
