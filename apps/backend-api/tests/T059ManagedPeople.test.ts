import { MANAGED_PEOPLE_ACCEPT_V3, MANAGED_PEOPLE_ACCEPT_V2, isManagedActiveSummary, isManagedActiveSummaryV2, isManagedActiveSummaryV3 } from '@taptime/administration-contract/managed-people';
import { AdminWebApiClient } from '../../admin-web/src/AdminWebApiClient.js';
import { rangeSummary } from '../../mobile/src/screens/ownTimeCalendar.js';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createBackendHttpServer } from '../src/BackendHttpServer.js';
import { unavailableOfflineDependencies } from './offlineTestDependencies.js';
import { TapTimeEmployeesApiClient } from '../../mobile/src/employees/TapTimeEmployeesApiClient.js';
import { isCalendarTimeResponse, TIME_CALENDAR_ACCEPT, TIME_DETAILS_ACCEPT } from '@taptime/mobile-work-contract';
import { EmployeeMembershipEnrollmentCoordinator, SupabaseAccountInviter } from '../../backend-administration/src/index.js';
import { ensureC3E1RuntimeLogins, removeC3E1RuntimeLogins, c3e1RuntimeConnectionString, C3E1_INVITATION_RUNTIME_LOGIN,
  C3E1_ENROLLMENT_RUNTIME_LOGIN, fixtureAccessTokenVerifier, fixtureTokens, syntheticPassword } from '../../backend-administration/tests/fixtures.js';
import { randomUUID } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import { beforeAll, beforeEach, afterAll, describe, it, expect } from 'vitest';
import { applyMigrationSet, loadMigrations, migrate, B3_SCHEMA, B3_MIGRATION_TABLE } from '@taptime/backend-schema';
import { ids, seedC3C, truncateC3C } from '../../backend-administration/tests/fixtures.js';

const pool = new Pool({ connectionString: process.env.C2_DATABASE_URL ?? 'postgresql://timbartz@127.0.0.1:5432/taptime_c2' });
const a = '51000000-0000-4000-8000-000000000001';
const b = '51000000-0000-4000-8000-000000000002';
const foreign = '51000000-0000-4000-8000-000000000003';
const targetB = '12000000-0000-4000-8000-000000000005';
const from = '2026-10-01T00:00:00+02:00';
const to = '2026-11-01T00:00:00+01:00';
const records: string[] = [];

async function seed(carry = false) {
  await seedC3C(pool);
  await pool.query(`UPDATE taptime_server.memberships SET role = 'standortleitung', row_version = row_version + 1 WHERE id = $1`, [ids.membershipEmployeeA]);
  await pool.query(`INSERT INTO taptime_server.memberships (id, organization_id, user_id, role, created_by_user_id, display_name)
    VALUES ($1, $2, $3, 'employee', $4, 'Person B')`, [targetB, ids.organizationA, ids.orphan, ids.adminA]);
  records.length = 0;
  // Real source rows with deferred canonical-decision constraints, before location activation.
  for (const [org, user, customer] of [[ids.organizationA, ids.adminA2, ids.customerA],
    [ids.organizationA, ids.orphan, ids.customerA], [ids.organizationB, ids.adminB, ids.customerB]]) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const [started, stopped] of [...(carry ? [['2026-09-30T20:00:00Z','2026-10-01T04:00:00Z']] : []), ['2026-10-05T08:00:00Z', '2026-10-05T10:00:00Z'],
        ['2026-10-05T08:00:00Z', '2026-10-05T11:00:00Z'], ['2026-10-25T00:30:00Z', null]]) {
        const entry = randomUUID(), start = randomUUID(), stop = stopped ? randomUUID() : null;
        records.push(entry);
        for (const [event, time] of [[start, started], ...(stop ? [[stop, stopped]] : [])]) {
          await client.query(`INSERT INTO taptime_server.work_events (id, organization_id, target_type, target_customer_id,
            triggered_by_user_id, occurred_at, content_hash, content_hash_algorithm, content_hash_version, trigger_type)
            VALUES ($1,$2,'customer',$3,$4,$5,$6,'sha256',2,'manual')`, [event, org, customer, user, time, 'a'.repeat(64)]);
        }
        await client.query(`INSERT INTO taptime_server.time_entries (id, organization_id, user_id, target_type, target_customer_id,
          status, start_work_event_id, stop_work_event_id, started_at, stopped_at, started_via, stopped_via)
          VALUES ($1,$2,$3,'customer',$4,$5,$6,$7,$8,$9,'manual',$10)`,
        [entry, org, user, customer, 'started', start, null, started, null, null]);
        for (const [event, decision] of [[start, 'time_entry_started'], ...(stop ? [[stop, 'time_entry_stopped']] : [])]) {
          if (decision === 'time_entry_stopped') {
            await client.query('SET CONSTRAINTS ALL IMMEDIATE');
            await client.query('SET CONSTRAINTS ALL DEFERRED');
            await client.query(`UPDATE taptime_server.time_entries SET status='stopped', stop_work_event_id=$2, stopped_at=$3, stopped_via='manual', row_version=row_version+1 WHERE id=$1`, [entry,stop,stopped]);
          }
          await client.query(`INSERT INTO taptime_server.canonical_decisions (work_event_id, organization_id, actor_user_id,
            target_type, target_customer_id, decision_type, time_entry_id, engine_version, decision_payload)
            VALUES ($1,$2,$3,'customer',$4,$5,$6,'core-0.1.0',$7)`, [event, org, user, customer, decision, entry, JSON.stringify({ status: decision })]);
        }
      }
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }
  await pool.query(`INSERT INTO taptime_server.locations (id, organization_id, display_name)
    VALUES ($1,$4,'Standort A'),($2,$4,'Standort B'),($3,$5,'Fremder Standort')`, [a,b,foreign,ids.organizationA,ids.organizationB]);
  await pool.query(`INSERT INTO taptime_server.membership_home_location_assignments (id, organization_id, membership_id, location_id)
    SELECT gen_random_uuid(), organization_id, id, CASE WHEN organization_id = $1 THEN
      CASE WHEN id = $4 THEN $3::uuid ELSE $2::uuid END ELSE $5::uuid END FROM taptime_server.memberships`,
  [ids.organizationA,a,b,targetB,foreign]);
  await pool.query(`INSERT INTO taptime_server.work_target_location_assignments (id, organization_id, target_type, target_id, location_id)
    SELECT gen_random_uuid(), organization_id, target_type, target_id, CASE WHEN organization_id=$1 THEN $2::uuid ELSE $3::uuid END
    FROM taptime_server.work_targets WHERE active`, [ids.organizationA,a,foreign]);
  await pool.query(`INSERT INTO taptime_server.membership_management_location_grants (id, organization_id, membership_id, location_id)
    VALUES (gen_random_uuid(),$1,$2,$3)`, [ids.organizationA,ids.membershipEmployeeA,a]);
  await pool.query(`UPDATE taptime_server.organizations SET locations_enabled=true, row_version=row_version+1`);
}
async function context<T>(actor: 'manager' | 'admin' | 'foreign' | 'employee', operation: (client: PoolClient) => Promise<T>) {
  const client = await pool.connect();
  const who = actor === 'manager' ? [ids.organizationA,ids.employeeA,ids.membershipEmployeeA,'standortleitung']
    : actor === 'admin' ? [ids.organizationA,ids.adminA,ids.membershipAdminA,'administrator']
      : actor === 'foreign' ? [ids.organizationB,ids.adminB,ids.membershipAdminB,'administrator']
        : [ids.organizationA,ids.orphan,targetB,'employee'];
  try {
    await client.query('BEGIN');
    await client.query(`SELECT set_config('app.organization_id',$1,true),set_config('app.user_id',$2,true),
      set_config('app.membership_id',$3,true),set_config('app.membership_role',$4,true)`, who);
    await client.query('SET LOCAL ROLE taptime_membership_manager');
    return await operation(client);
  } finally { await client.query('ROLLBACK'); client.release(); }
}
const person = (actor: Parameters<typeof context>[0], target: string, start = from, end = to, after: [string, string] | null = null, limit = 21) => context(actor, async (c) =>
  (await c.query(`SELECT * FROM taptime_server.read_managed_person_time_v1($1,$2,$3,$4,$5,$6)`, [target,start,end,after?.[0]??null,after?.[1]??null,limit])).rows);
const summary = (actor: Parameters<typeof context>[0], location: string | null = null, running: boolean | null = null, cursor: string | null = null, limit = 20) => context(actor, async (c) =>
  (await c.query(`SELECT * FROM taptime_server.read_managed_active_summary_v1($1,$2,$3,$4)`, [location,running,cursor,limit])).rows);

let rateNow=Date.now();
let runtimePassword:string;
let invitations: Pool, enrollment: Pool, coordinator: EmployeeMembershipEnrollmentCoordinator, server: Server, origin: string;
beforeAll(async () => {
  await pool.query(`DROP SCHEMA IF EXISTS ${B3_SCHEMA} CASCADE; DROP TABLE IF EXISTS ${B3_MIGRATION_TABLE}`);
  await migrate(pool);
  const password=runtimePassword=syntheticPassword();
  await ensureC3E1RuntimeLogins(pool,password,password);
  const database=process.env.C2_DATABASE_URL ?? 'postgresql://timbartz@127.0.0.1:5432/taptime_c2';
  invitations=new Pool({connectionString:c3e1RuntimeConnectionString(database,C3E1_INVITATION_RUNTIME_LOGIN,password)});
  enrollment=new Pool({connectionString:c3e1RuntimeConnectionString(database,C3E1_ENROLLMENT_RUNTIME_LOGIN,password)});
  const provider=new SupabaseAccountInviter('https://synthetic.invalid/auth/v1','synthetic-local-only','https://admin.example.test/willkommen',()=>{},async(input,init)=>{
    if (new URL(String(input)).pathname.endsWith('/settings')) return Response.json({disable_signup:true,mailer_autoconfirm:false});
    if (new URL(String(input)).pathname.endsWith('/admin/users')) return Response.json({users:[]});
    return Response.json({id:randomUUID(),email:JSON.parse(String(init?.body)).email});
  },'synthetic-public-key');
  coordinator=new EmployeeMembershipEnrollmentCoordinator(invitations,enrollment,{ verify: token => fixtureAccessTokenVerifier.verify(token.replace(/^header\./,'').replace(/\.signature$/,'')) },provider);
  server=createBackendHttpServer({
    ...unavailableOfflineDependencies(), employeeEnrollment:coordinator,
    sessionAuthority:{async resolve(){return {status:'rejected'};}},
    scanContextResolver:{async resolve(){return {status:'not_resolved'};}},
    lifecycleIngestor:{async ingest(){return {status:'deferred',evidenceStored:false,reason:'configuration_unavailable_or_inactive'};}},
    deferredLifecycleIngestor:{async ingestDeferred(){return {status:'deferred',evidenceStored:false,reason:'configuration_unavailable_or_inactive'};}},
    administration:{async createCustomer(){return {status:'unauthorized'};},async provisionNfcTag(){return {status:'unauthorized'};},async readSetupProjection(){return {status:'unauthorized'};}},
    tagReassignment:{async reassignNfcTag(){return {status:'unauthorized'};}},
  },{rateLimitClock:()=>rateNow});
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  origin=`http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
beforeEach(async () => { await migrate(pool); await truncateC3C(pool); await seed(); });
afterAll(async () => {
  if(server) await new Promise<void>(resolve=>server.close(()=>resolve()));
  await invitations?.end(); await enrollment?.end();
  await removeC3E1RuntimeLogins(pool); await pool.end();
});
function mobile(token:string) {
  return new TapTimeEmployeesApiClient(origin,{async post(endpoint,body,options){
    rateNow+=60_001; // A new rate-limit window for each independent authorization case.
    const response=await fetch(endpoint,{method:'POST',headers:{authorization:`Bearer header.${token}.signature`,'content-type':'application/json', ...(options?.includeMonthHours?{accept:MANAGED_PEOPLE_ACCEPT_V3}:options?.includeDeparted?{accept:MANAGED_PEOPLE_ACCEPT_V2}:options?.includeCalendarBreaks?{accept:TIME_CALENDAR_ACCEPT}:options?.includeTimeDetails?{accept:TIME_DETAILS_ACCEPT}:{})},body});
    return {status:'response',statusCode:response.status,contentType:response.headers.get('content-type'),body:await response.text()};
  }});
}

describe('T059 SQL scope and migration', () => {
  it('T-066 details retain every granted location and exclude ungranted locations', async () => {
    const all=(await person('admin',ids.membershipAdminA2)).concat(await person('admin',targetB))
      .filter(row=>row.time_record_id).map(row=>row.time_record_id as string);
    const read=()=>context('manager',async client=>(await client.query(
      'SELECT * FROM taptime_server.read_time_record_details_v1($1::uuid[])',[all])).rows);
    const first=await read();
    expect(first.length).toBeGreaterThan(0); expect(first.length).toBeLessThan(all.length);
    await pool.query(`INSERT INTO taptime_server.membership_management_location_grants
      (id,organization_id,membership_id,location_id) VALUES(gen_random_uuid(),$1,$2,$3)`,[ids.organizationA,ids.membershipEmployeeA,b]);
    expect((await read()).map(row=>row.time_record_id).sort()).toEqual([...new Set(all)].sort());
    await pool.query(`UPDATE taptime_server.membership_management_location_grants SET revoked_at=now()
      WHERE organization_id=$1 AND membership_id=$2 AND location_id=$3`,[ids.organizationA,ids.membershipEmployeeA,a]);
    expect((await read()).every(row=>!first.some(previous=>previous.time_record_id===row.time_record_id))).toBe(true);
  });
  it('a: location A reads its person, never B or a person without a home', async () => {
    expect((await person('manager', ids.membershipAdminA2)).filter(r=>r.row_kind==='history')).toHaveLength(2);
    expect(await person('manager',targetB)).toMatchObject([{row_kind:'forbidden',time_record_id:null}]);
    await context('manager', async c => {
      await c.query('RESET ROLE');
      await c.query(`UPDATE taptime_server.membership_home_location_assignments SET revoked_at=transaction_timestamp() WHERE membership_id=$1`, [ids.membershipAdminA2]);
      await c.query('SET LOCAL ROLE taptime_membership_manager');
      expect((await c.query(`SELECT * FROM taptime_server.read_managed_person_time_v1($1,$2,$3,NULL,NULL,21)`, [ids.membershipAdminA2,from,to])).rows).toMatchObject([{row_kind:'forbidden',time_record_id:null}]);
      expect((await c.query(`SELECT * FROM taptime_server.read_managed_active_summary_v1(NULL,NULL,NULL,20)`)).rows[0]).toMatchObject({running_count:'0',total_count:'2'});
    });
  });
  it('b: admin reads each own person and no person of a second tenant, in both directions', async () => {
    for (const target of [ids.membershipAdminA2,targetB]) expect((await person('admin',target)).some(r=>r.row_kind==='history')).toBe(true);
    for (const [actor,target] of [['admin',ids.membershipAdminB],['foreign',ids.membershipAdminA2],['admin',randomUUID()]] as const) {
      expect(await person(actor,target)).toMatchObject([{row_kind:'forbidden',target_display_name:null,time_record_id:null}]);
    }
  });
  it('c: employees have no capability on either SQL access path', async () => {
    expect(await person('employee',targetB)).toMatchObject([{row_kind:'forbidden'}]);
    expect(await summary('employee')).toMatchObject([{result_status:'forbidden',membership_id:null}]);
  });
  it('d: counts active memberships and running people within the current scope, including filtered pages', async () => {
    const own = await summary('manager');
    expect(own[0]).toMatchObject({result_status:'succeeded',running_count:'1',total_count:'3'});
    expect(own.map(r=>r.membership_id)).not.toContain(targetB);
    expect((await summary('admin'))[0]).toMatchObject({running_count:'2',total_count:'4'});
    expect((await summary('foreign'))[0]).toMatchObject({running_count:'1',total_count:'1'});
    expect((await summary('manager',null,true))[0]).toMatchObject({membership_id:ids.membershipAdminA2,is_running:true,running_target_display_name:'Active Customer A'});
    expect(await summary('manager',b)).toMatchObject([{result_status:'forbidden',membership_id:null}]);
    expect(await summary('admin',foreign)).toMatchObject([{result_status:'forbidden',membership_id:null}]);
    const page = await summary('admin',null,null,null,1);
    expect(page).toHaveLength(2); // limit + 1, like the membership projection
    const next = await summary('admin',null,null,page[0]!.membership_id,1);
    expect(next[0]!.membership_id).toBe(page[1]!.membership_id);
  });
  it('e: Berlin October including the repeated hour, exact range guard and ascending keyset with equal starts', async () => {
    const page = await person('admin',ids.membershipAdminA2,from,to,null,1);
    const first = page.find(r=>r.row_kind==='history')!;
    expect(first).toBeDefined();
    const next = await person('admin',ids.membershipAdminA2,from,to,[first.started_at.toISOString(),first.time_record_id],1);
    expect(next.find(r=>r.row_kind==='history')!.time_record_id).not.toBe(first.time_record_id);
    const boundary = await pool.query(`SELECT extract(epoch FROM taptime_server.maximum_calendar_month_range()) AS seconds`);
    const end = new Date(Date.parse(from)+Number(boundary.rows[0].seconds)*1000);
    expect((await person('admin',ids.membershipAdminA2,from,end.toISOString()))[0]!.row_kind).not.toBe('invalid_request');
    expect(await person('admin',ids.membershipAdminA2,from,new Date(end.getTime()+1).toISOString())).toMatchObject([{row_kind:'invalid_request'}]);
    expect(await person('admin',ids.membershipAdminA2,to,from)).toMatchObject([{row_kind:'invalid_request'}]);
    // A foreign cursor supplies only an ordering boundary, never a data/authority source.
    expect(await person('manager',targetB,from,to,[first.started_at.toISOString(),first.time_record_id])).toMatchObject([{row_kind:'forbidden'}]);
  });
  it('a/d: revocation applies again to the next page, active row and summary', async () => {
    const page = await person('manager',ids.membershipAdminA2,from,to,null,1);
    const first = page.find(r=>r.row_kind==='history')!;
    await pool.query(`UPDATE taptime_server.membership_management_location_grants SET revoked_at=transaction_timestamp() WHERE membership_id=$1`, [ids.membershipEmployeeA]);
    expect(await person('manager',ids.membershipAdminA2,from,to,[first.started_at.toISOString(),first.time_record_id])).toMatchObject([{row_kind:'forbidden',time_record_id:null}]);
    expect(await summary('manager')).toMatchObject([{result_status:'forbidden',membership_id:null}]);
  });
  it('a–e: real runtime role, HTTP and Mobile share the own-time shape and bound cursors', async()=>{
    const command={expectedMembershipId:ids.membershipEmployeeA,targetMembershipId:ids.membershipAdminA2,
      fromInclusive:new Date(from).toISOString(),toExclusive:new Date(to).toISOString(),cursor:null,limit:1};
    const client=mobile(fixtureTokens.employeeA);
    const first=await client.personTime(command);
    expect(first.status).toBe('ready');
    if(first.status!=='ready') throw new Error('Expected managed time');
    expect(isCalendarTimeResponse(first.value)).toBe(true);
    expect(first.value.activeRecord).not.toBeNull();
    expect(first.value.nextCursor).not.toBeNull();
    const next=await client.personTime({...command,cursor:first.value.nextCursor});
    expect(next.status).toBe('ready');
    if(next.status==='ready') expect(next.value.records[0]!.timeRecordId).not.toBe(first.value.records[0]!.timeRecordId);
    expect(await coordinator.readManagedPersonTime({...command,accessToken:`header.${fixtureTokens.employeeA}.signature`,targetMembershipId:targetB,cursor:first.value.nextCursor})).toEqual({status:'invalid_request'});
    expect(await client.personTime({...command,targetMembershipId:targetB})).toEqual({status:'authority_rejected'});
    expect(await mobile(fixtureTokens.adminB).personTime({...command,expectedMembershipId:ids.membershipAdminB})).toEqual({status:'authority_rejected'});
    const summary=await client.summary({expectedMembershipId:ids.membershipEmployeeA,locationId:null,isRunning:true,cursor:null,limit:1});
    expect(summary).toMatchObject({status:'ready',value:{runningCount:1,totalCount:3,people:[{membershipId:ids.membershipAdminA2}]}});
    await expect(invitations.query('SELECT * FROM taptime_server.effective_time_records_v2')).rejects.toMatchObject({code:'42501'});
    await pool.query(`UPDATE taptime_server.membership_management_location_grants SET revoked_at=transaction_timestamp() WHERE membership_id=$1`,[ids.membershipEmployeeA]);
    expect(await client.personTime({...command,cursor:first.value.nextCursor})).toEqual({status:'authority_rejected'});
    expect(await client.summary({expectedMembershipId:ids.membershipEmployeeA,locationId:null,isRunning:null,cursor:null,limit:20})).toEqual({status:'authority_rejected'});
  });
  it('T049 b/c/d: Web reads only the authorised location and uses real running counts',async()=>{
    const web=new AdminWebApiClient((path,init)=>fetch(`${origin}${path}`,init));
    const token=`header.${fixtureTokens.employeeA}.signature`;
    const query={expectedMembershipId:ids.membershipEmployeeA,locationId:a,isRunning:null,cursor:null,limit:20};
    const result=await web.managedActiveSummary(token,query);
    expect(result).toMatchObject({status:'succeeded',value:{runningCount:1,totalCount:3}});
    if(result.status !== 'succeeded') throw new Error('Missing scoped summary');
    expect(Number.isFinite(Date.parse(result.value.serverTime))).toBe(true);
    expect(result.value.people.every(person=>person.location?.id === a)).toBe(true);
    const request={expectedMembershipId:ids.membershipEmployeeA,targetMembershipId:ids.membershipAdminA2,
      fromInclusive:new Date(from).toISOString(),toExclusive:new Date(to).toISOString(),cursor:null,limit:20};
    expect(await web.managedPersonTime(token,request)).toMatchObject({status:'succeeded'});
    expect(await web.managedPersonTime(token,{...request,targetMembershipId:targetB})).toEqual({status:'rejected'});
    expect(await web.managedActiveSummary(token,{...query,locationId:b})).toEqual({status:'rejected'});
    expect(await web.managedPersonTime(`header.${fixtureTokens.adminB}.signature`,{...request,expectedMembershipId:ids.membershipAdminB})).toEqual({status:'rejected'});
    expect(await web.managedActiveSummary(`header.${fixtureTokens.orphan}.signature`,{...query,expectedMembershipId:targetB})).toEqual({status:'rejected'});
  });
  it('c: real employee HTTP responses contain only a generic forbidden code on both routes',async()=>{
    for(const [path,body] of [
      ['managed-person-time',{expectedMembershipId:targetB,targetMembershipId:ids.membershipAdminA2,fromInclusive:new Date(from).toISOString(),toExclusive:new Date(to).toISOString(),cursor:null,limit:20}],
      ['managed-active-summary',{expectedMembershipId:targetB,locationId:null,isRunning:null,cursor:null,limit:20}],
    ] as const) {
      const response=await fetch(`${origin}/v1/administration/${path}`,{method:'POST',headers:{authorization:`Bearer header.${fixtureTokens.orphan}.signature`,'content-type':'application/json'},body:JSON.stringify(body)});
      expect(response.status).toBe(403); expect(await response.json()).toEqual({error:{code:'forbidden'}});
    }
  });
  it('g: Mobile invitations succeed for admin and location A, reject B and a second tenant',async()=>{
    for(const [token,expectedMembershipId,locationId] of [[fixtureTokens.adminA,ids.membershipAdminA,b],[fixtureTokens.employeeA,ids.membershipEmployeeA,a]]) {
      expect(await mobile(token!).invite({expectedMembershipId:expectedMembershipId!,locationId:locationId!,commandId:randomUUID(),displayName:'Neue Person',email:`${randomUUID()}@example.test`})).toEqual({status:'succeeded'});
    }
    for(const [token,expectedMembershipId,locationId] of [[fixtureTokens.employeeA,ids.membershipEmployeeA,b],[fixtureTokens.employeeA,ids.membershipEmployeeA,foreign],[fixtureTokens.adminA,ids.membershipAdminA,foreign]]) {
      expect(await mobile(token!).invite({expectedMembershipId:expectedMembershipId!,locationId:locationId!,commandId:randomUUID(),displayName:'Neue Person',email:`${randomUUID()}@example.test`})).toEqual({status:'authority_rejected'});
    }
  });
  it('e/h: carries a closed night shift into the month and pages it without losing six hours',async()=>{
    await truncateC3C(pool);await seed(true);
    const client=mobile(fixtureTokens.employeeA);
    const request={expectedMembershipId:ids.membershipEmployeeA,targetMembershipId:ids.membershipAdminA2,
      fromInclusive:new Date(from).toISOString(),toExclusive:new Date(to).toISOString(),cursor:null,limit:1};
    const first=await client.personTime(request);
    expect(first.status).toBe('ready');if(first.status!=='ready') throw new Error('Expected first page');
    expect(first.value.records[0]!.startedAt).toBe('2026-09-30T20:00:00.000Z');
    const records=[...first.value.records];let cursor=first.value.nextCursor;
    while(cursor!==null) {
      const next=await client.personTime({...request,cursor});
      expect(next.status).toBe('ready');if(next.status!=='ready') throw new Error('Expected next page');
      records.push(...next.value.records);cursor=next.value.nextCursor;
    }
    expect(records).toHaveLength(3);
    expect(new Set(records.map(r=>r.timeRecordId)).size).toBe(records.length);
    expect(rangeSummary({...first.value,records,nextCursor:null},'2026-10-01','2026-10-02')).toEqual({complete:true,milliseconds:6*60*60*1000,breakMilliseconds:0});
  });
  it.each(['027','028'])('migrates populated %s without changing data or existing session authority', async (baseline) => {
    await pool.query(`DROP SCHEMA ${B3_SCHEMA} CASCADE; DROP TABLE ${B3_MIGRATION_TABLE}`);
    const migrations = await loadMigrations();
    await applyMigrationSet(pool,migrations.filter(m=>m.version<=baseline));
    await seed();
    const snapshot = async () => {
      const tables = (await pool.query(`SELECT tablename FROM pg_tables WHERE schemaname='taptime_server' ORDER BY tablename`)).rows;
      const rows: Record<string, unknown> = {};
      for (const {tablename} of tables) rows[tablename] = (await pool.query(`SELECT to_jsonb(t) AS row FROM taptime_server.${tablename} t ORDER BY to_jsonb(t)::text`)).rows;
      return rows;
    };
    const sessionSnapshot=async()=>{
      const client=await pool.connect();
      try {
        await client.query('BEGIN');await client.query('SET LOCAL ROLE taptime_identity_resolver');
        const results=[];
        for(const params of [[ids.organizationA,ids.adminA,ids.membershipAdminA],
          [ids.organizationA,ids.employeeA,ids.membershipEmployeeA],[ids.organizationA,ids.orphan,targetB],
          [ids.organizationB,ids.employeeA,ids.membershipEmployeeA]]) {
          results.push(await client.query('SELECT * FROM taptime_server.read_administration_session_v2($1,$2,$3)',params));
        }
        return results;
      } finally {await client.query('ROLLBACK');client.release();}
    };
    const functionProtection=async()=> (await pool.query(`SELECT pg_get_userbyid(proowner) AS owner,
      proacl::text,prosecdef,provolatile,proconfig,proargtypes::text
      FROM pg_proc WHERE oid='taptime_server.read_administration_session_v2(uuid,uuid,uuid)'::regprocedure`)).rows;
    const otherFunctions=async()=> (await pool.query(`SELECT p.proname,pg_get_functiondef(p.oid) AS definition,
      pg_get_userbyid(p.proowner) AS owner,p.proacl::text
      FROM pg_proc p JOIN pg_namespace n ON p.pronamespace=n.oid
      WHERE n.nspname='taptime_server' AND p.proname <> 'read_administration_session_v2'
      ORDER BY p.proname,p.proargtypes::text`)).rows;
    const before = await snapshot(), oldSessions=await sessionSnapshot(), protection=await functionProtection();
    const functions=baseline === '028' ? await otherFunctions() : null;
    // This regression owns the 028/029 upgrade; later additive tables have their own upgrade tests.
    const upgrade=migrations.filter(m=>m.version<= '029');
    expect((await applyMigrationSet(pool,upgrade)).applied).toEqual(upgrade.filter(m=>m.version>baseline).map(m=>m.version));
    expect(await snapshot()).toEqual(before);
    expect(await functionProtection()).toEqual(protection);
    if(functions !== null) expect(await otherFunctions()).toEqual(functions);
    const sessions=await sessionSnapshot();
    for(const [index,old] of oldSessions.entries()) {
      const oldColumns=old.fields.map(field=>field.name);
      expect(sessions[index]!.rows.map(row=>Object.fromEntries(oldColumns.map(name=>[name,row[name]])))).toEqual(old.rows);
    }
    for(const [index,role] of ['administrator','standortleitung','employee'].entries()) {
      expect(sessions[index]!.rows.length).toBeGreaterThan(0);
      for(const row of sessions[index]!.rows) expect(row).toMatchObject({role,own_time_available:true,manual_capture_available:true});
    }
    expect(sessions[1]!.rows[0]).toMatchObject({review_items_available:false});
    expect(sessions[3]!.rows).toEqual([]);
    expect((await pool.query(`SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='taptime_server' AND c.relkind='r' AND NOT(c.relrowsecurity AND c.relforcerowsecurity)`)).rows).toEqual([]);
    expect((await summary('manager'))[0]).toMatchObject({running_count:'1',total_count:'3'});
  });
});

it('T-066 negotiates person details explicitly, keeps legacy bytes, and scopes detail reads by live location',async()=>{
  await ensureC3E1RuntimeLogins(pool,runtimePassword,runtimePassword);
  const body={expectedMembershipId:ids.membershipEmployeeA,targetMembershipId:ids.membershipAdminA2,
    fromInclusive:'2026-09-30T22:00:00.000Z',toExclusive:'2026-10-31T23:00:00.000Z',cursor:null,limit:20};
  const query=async(accept?:string)=>{
    rateNow+=60_001;
    return fetch(`${origin}/v1/administration/managed-person-time`,{method:'POST',headers:{
      authorization:`Bearer header.${fixtureTokens.employeeA}.signature`,'content-type':'application/json',...(accept?{accept}:{})},body:JSON.stringify(body)});
  };
  const legacyResponse=await query();expect(legacyResponse.status).toBe(200);
  const legacy=await legacyResponse.text();
  for (const accept of ['application/json','application/vnd.taptime.unknown+json']) {
    const response=await query(accept);expect(response.headers.get('vary')).toBe('Accept');expect(await response.text()).toBe(legacy);
  }
  const response=await query('application/vnd.taptime.time-details.v2+json');expect(response.status).toBe(200);
  const detailed=await response.json() as {records:Array<{timeRecordId:string;details:{origin:string;overlapsAnotherRecord:boolean}}>};
  expect(detailed.records).toHaveLength(2);expect(detailed.records.every(r=>r.details.origin==='manual'&&r.details.overlapsAnotherRecord)).toBe(true);
  const detailIds=async()=>context('manager',async c=>(await c.query('SELECT * FROM taptime_server.read_time_record_details_v1($1::uuid[])',[records])).rows.map(r=>r.time_record_id));
  expect((await detailIds()).sort()).toEqual(records.slice(0,3).sort());
  await pool.query(`UPDATE taptime_server.membership_management_location_grants SET revoked_at=transaction_timestamp() WHERE membership_id=$1`,[ids.membershipEmployeeA]);
  expect(await detailIds()).toEqual([]);
});

it('T-066 returns times and correction versions from one snapshot during a concurrent correction',async()=>{
  const {readManagedPerson}=await import('../../backend-administration/src/ManagedPeopleReader.js');
  await context('manager',async c=>{
    const query=c.query.bind(c);let injected=false;
    const wrapped=new Proxy(c,{get(target,key){if(key!=='query') return Reflect.get(target,key);return async(text:string,args?:unknown[])=>{
      const result=await query(text,args);
      if(!injected && text.includes('read_managed_person_time_v1')) {
        injected=true;
        await pool.query(`INSERT INTO taptime_server.time_record_revisions
          (organization_id,time_record_id,revision_number,canonical_time_entry_id,user_id,target_type,target_customer_id,
           effective_started_at,effective_stopped_at,base_row_version,actor_user_id,actor_membership_id,reason,command_id,request_hash)
          SELECT organization_id,id,1,id,user_id,target_type,target_customer_id,started_at+interval '1 hour',stopped_at+interval '1 hour',row_version,$2,$3,'Parallel berichtigt',$4,repeat('a',64)
          FROM taptime_server.time_entries WHERE id=$1`,[records[0],ids.adminA,ids.membershipAdminA,randomUUID()]);
      }
      return result;
    };}});
    const response=await readManagedPerson(wrapped,{accessToken:'synthetic',expectedMembershipId:ids.membershipEmployeeA,targetMembershipId:ids.membershipAdminA2,fromInclusive:new Date(from).toISOString(),toExclusive:new Date(to).toISOString(),cursor:null,limit:20,includeTimeDetails:true});
    expect(response.status).toBe('succeeded');if(response.status!=='succeeded') throw new Error('Expected person time');
    expect(response.value.records.find(r=>r.timeRecordId===records[0])).toMatchObject({startedAt:'2026-10-05T08:00:00.000Z',details:{effectiveRevisionNumber:0}});
  });
});


it('T092 negotiates departed people for web/mobile and preserves the shipped v1 response',async()=>{
  // This legacy fixture contains a future open entry; choose another active person without time.
  const target=ids.membershipAdminA;
  await pool.query('UPDATE taptime_server.memberships SET revoked_at=clock_timestamp(),row_version=row_version+1 WHERE id=$1',[target]);
  const request={expectedMembershipId:ids.membershipEmployeeA,locationId:null,isRunning:null,cursor:null,limit:20};
  const query=async(accept?:string)=>{
    rateNow+=60_001;
    return fetch(`${origin}/v1/administration/managed-active-summary`,{method:'POST',headers:{
      authorization:`Bearer header.${fixtureTokens.employeeA}.signature`,'content-type':'application/json',...(accept?{accept}:{})},body:JSON.stringify(request)});
  };
  const legacy=await query();expect(legacy.status).toBe(200);
  const old=await legacy.json() as {people:Array<{membershipId:string}>};expect(old.people.some((p:{membershipId:string})=>p.membershipId===target)).toBe(false);
  expect(old.people.every((p:object)=>!Object.hasOwn(p,'departedAt'))).toBe(true);
  const response=await query(MANAGED_PEOPLE_ACCEPT_V2);expect(response.status).toBe(200);expect(response.headers.get('vary')).toBe('Accept');
  const value=await response.json() as {people:unknown[]};expect(value.people).toContainEqual(expect.objectContaining({membershipId:target,departedAt:expect.any(String),isRunning:false}));
  expect(await mobile(fixtureTokens.employeeA).summary(request)).toMatchObject({status:'ready',value:{people:expect.arrayContaining([expect.objectContaining({membershipId:target,departedAt:expect.any(String)})])}});
  const web=new AdminWebApiClient((path,init)=>fetch(`${origin}${path}`,init));
  expect(await web.managedActiveSummary(`header.${fixtureTokens.employeeA}.signature`,request)).toMatchObject({status:'succeeded',value:{people:expect.arrayContaining([expect.objectContaining({membershipId:target,departedAt:expect.any(String)})])}});
});

const summaryV3=(actor:Parameters<typeof context>[0],cursor:string|null=null,location:string|null=null)=>context(actor,async c=>
  (await c.query('SELECT * FROM taptime_server.read_managed_active_summary_v3($1,NULL,$2,20)',[location,cursor])).rows);
it.each([
  {transport:'SQL',isRunning:true},{transport:'SQL',isRunning:false},
  {transport:'HTTP',isRunning:true},{transport:'HTTP',isRunning:false},
])('T102 $transport keeps paging when the anchor leaves the isRunning=$isRunning filter',async({transport,isRunning})=>{
  const people=Array.from({length:22},(_,i)=>({member:randomUUID(),user:randomUUID(),entry:randomUUID(),name:`Cursor ${String(i).padStart(2,'0')}`}));
  const changeRunning=async(c:PoolClient,person:typeof people[number],running:boolean)=>{
    const event=randomUUID(),at=running?'2026-10-06T08:00:00Z':'2026-10-06T09:00:00Z';
    await c.query(`INSERT INTO taptime_server.work_events(id,organization_id,triggered_by_user_id,target_type,target_customer_id,occurred_at,trigger_type,content_hash,content_hash_algorithm,content_hash_version)
      VALUES($1,$2,$3,'customer',$4,$5,'manual',repeat('a',64),'sha256',2)`,[event,ids.organizationA,person.user,ids.customerA,at]);
    if(running)await c.query(`INSERT INTO taptime_server.time_entries(id,organization_id,user_id,target_type,target_customer_id,status,start_work_event_id,started_at,started_via)
      VALUES($1,$2,$3,'customer',$4,'started',$5,$6,'manual')`,[person.entry,ids.organizationA,person.user,ids.customerA,event,at]);
    else await c.query(`UPDATE taptime_server.time_entries SET status='stopped',stop_work_event_id=$2,stopped_at=$3,stopped_via='manual',row_version=row_version+1 WHERE id=$1`,[person.entry,event,at]);
    await c.query(`INSERT INTO taptime_server.canonical_decisions(work_event_id,organization_id,actor_user_id,target_type,target_customer_id,decision_type,time_entry_id,engine_version,decision_payload)
      VALUES($1,$2,$3,'customer',$4,$5,$6,'test','{}')`,[event,ids.organizationA,person.user,ids.customerA,running?'time_entry_started':'time_entry_stopped',person.entry]);
  };
  const c=await pool.connect();try {
    await c.query('BEGIN');
    for(const person of people) {
      await c.query('INSERT INTO taptime_server.users(id) VALUES($1)',[person.user]);
      await c.query(`INSERT INTO taptime_server.memberships(id,organization_id,user_id,role,display_name)
        VALUES($1,$2,$3,'employee',$4)`,[person.member,ids.organizationA,person.user,person.name]);
      await c.query(`INSERT INTO taptime_server.membership_home_location_assignments(id,organization_id,membership_id,location_id)
        VALUES(gen_random_uuid(),$1,$2,$3)`,[ids.organizationA,person.member,a]);
      if(isRunning)await changeRunning(c,person,true);
    }
    await c.query('COMMIT');
    const readPage=async(cursor:string|null)=>{
      if(transport==='SQL')return context('admin',async reader=>{
        const rows=(await reader.query('SELECT * FROM taptime_server.read_managed_active_summary_v3($1,$2,$3,20)',[a,isRunning,cursor])).rows;
        expect(rows[0].result_status).toBe('succeeded');
        expect(rows.every(row=>row.is_running===isRunning)).toBe(true);
        const shown=rows.slice(0,20);
        return {ids:shown.map(row=>row.membership_id as string),cursor:rows.length>20?shown.at(-1)!.membership_id as string:null};
      });
      rateNow+=60_001;
      const response=await fetch(`${origin}/v1/administration/managed-active-summary`,{method:'POST',headers:{
        authorization:`Bearer header.${fixtureTokens.adminA}.signature`,'content-type':'application/json',accept:MANAGED_PEOPLE_ACCEPT_V3,
      },body:JSON.stringify({expectedMembershipId:ids.membershipAdminA,locationId:a,isRunning,cursor,limit:20})});
      expect(response.status).toBe(200);
      const value=await response.json();
      if(!isManagedActiveSummaryV3(value))throw Error('Missing v3 summary');
      expect(value.people.every(person=>person.isRunning===isRunning)).toBe(true);
      return {ids:value.people.map(person=>person.membershipId),cursor:value.nextCursor};
    };
    const expected=[isRunning?ids.membershipAdminA2:ids.membershipAdminA,...people.map(person=>person.member),...(isRunning?[]:[ids.membershipEmployeeA])];
    const first=await readPage(null);
    expect(first.ids).toEqual(expected.slice(0,20));expect(first.cursor).not.toBeNull();
    const anchor=people.find(person=>person.member===first.ids.at(-1))!;
    await c.query('BEGIN');await changeRunning(c,anchor,!isRunning);await c.query('COMMIT');
    expect((await c.query('SELECT status FROM taptime_server.time_entries WHERE id=$1',[anchor.entry])).rows[0].status).toBe(isRunning?'stopped':'started');
    const second=await readPage(first.cursor);
    expect(second.ids).toEqual(expected.slice(first.ids.length));expect(second.cursor).toBeNull();
    const combined=[...first.ids,...second.ids];
    expect(combined).toEqual(expected);expect(new Set(combined).size).toBe(expected.length);
  }finally{await c.query('ROLLBACK');c.release();}
});
it('T102 pages 45 people across location boundaries, then departed people without gaps or repeats',async()=>{
  const third=randomUUID();
  await pool.query(`INSERT INTO taptime_server.locations(id,organization_id,display_name) VALUES($1,$2,'Standort C')`,[third,ids.organizationA]);
  const c=await pool.connect();try {
    await c.query('BEGIN');
  for(let i=0;i<45;i++) {
    const user=randomUUID(),member=randomUUID();
    await c.query('INSERT INTO taptime_server.users(id) VALUES($1)',[user]);
    await c.query(`INSERT INTO taptime_server.memberships(id,organization_id,user_id,role,display_name)
      VALUES($1,$2,$3,'employee',$4)`,[member,ids.organizationA,user,`Name ${String(44-i).padStart(2,'0')}`]);
    await c.query(`INSERT INTO taptime_server.membership_home_location_assignments(id,organization_id,membership_id,location_id)
      VALUES(gen_random_uuid(),$1,$2,$3)`,[ids.organizationA,member,[a,b,third][i%3]]);
    if(i===0)await c.query('UPDATE taptime_server.memberships SET revoked_at=clock_timestamp(),row_version=row_version+1 WHERE id=$1',[member]);
  }
    await c.query('COMMIT');
  }finally{await c.query('ROLLBACK');c.release();}
  const expected=(await pool.query(`SELECT m.id FROM taptime_server.memberships m
    LEFT JOIN taptime_server.locations l ON l.id=taptime_server.membership_management_home_v1(m.organization_id,m.id)
    WHERE m.organization_id=$1 ORDER BY m.revoked_at IS NOT NULL,l.display_name COLLATE "C",COALESCE(m.display_name,CASE m.role WHEN 'administrator' THEN 'Administrator' WHEN 'standortleitung' THEN 'Standortleitung' ELSE 'Mitarbeiter' END) COLLATE "C",m.id`,[ids.organizationA])).rows.map(r=>r.id);
  const actual:string[]=[];let cursor:string|null=null;
  do {
    const page=await summaryV3('admin',cursor);
    expect(page[0].result_status).toBe('succeeded');
    const shown=page.slice(0,20);actual.push(...shown.map(r=>r.membership_id));
    cursor=page.length>20?shown.at(-1)!.membership_id:null;
  }while(cursor);
  expect(actual).toEqual(expected);expect(new Set(actual).size).toBe(expected.length);
  const own=await summaryV3('manager');expect(own.every(r=>r.location_id===a)).toBe(true);
  const tail=await summaryV3('manager',own[19]?.membership_id ?? own[0].membership_id);
  expect(tail.filter(r=>r.membership_id).every(r=>r.location_id===a)).toBe(true);
});
it('T102 rejects foreign, unselected and unknown cursor anchors and reevaluates grants',async()=>{
  for(const cursor of [targetB,ids.membershipAdminB,randomUUID()]) {
    expect(await summaryV3('manager',cursor)).toMatchObject([{result_status:'invalid_request',membership_id:null}]);
  }
  expect(await summaryV3('admin',targetB,a)).toMatchObject([{result_status:'invalid_request',membership_id:null}]);
  expect(await summaryV3('employee')).toMatchObject([{result_status:'forbidden',membership_id:null}]);
  expect(await summaryV3('admin',null,foreign)).toMatchObject([{result_status:'forbidden'}]);
  const own=await summaryV3('manager');
  await pool.query('UPDATE taptime_server.membership_management_location_grants SET revoked_at=clock_timestamp() WHERE membership_id=$1',[ids.membershipEmployeeA]);
  expect(await summaryV3('manager',own[0].membership_id)).toMatchObject([{result_status:'forbidden',membership_id:null}]);
});
it('T102 HTTP negotiates v3, preserves exact v1/v2 shapes, and binds cursors to version and filter',async()=>{
  const body={expectedMembershipId:ids.membershipAdminA,locationId:null,isRunning:null,cursor:null,limit:1};
  const query=async(accept:string)=>{
    rateNow+=60_001;
    const response=await fetch(`${origin}/v1/administration/managed-active-summary`,{method:'POST',headers:{authorization:`Bearer header.${fixtureTokens.adminA}.signature`,'content-type':'application/json',accept},body:JSON.stringify(body)});
    expect(response.status).toBe(200);expect(response.headers.get('vary')).toBe('Accept');return response.json();
  };
  expect(isManagedActiveSummary(await query('application/json'))).toBe(true);
  expect(isManagedActiveSummaryV2(await query(MANAGED_PEOPLE_ACCEPT_V2))).toBe(true);
  const v3=await query(MANAGED_PEOPLE_ACCEPT_V3);expect(isManagedActiveSummaryV3(v3)).toBe(true);
  if(!isManagedActiveSummaryV3(v3))throw Error('Missing v3 summary');
  expect(v3.nextCursor).toMatch(/^[\x20-\x7e]{1,256}$/);expect(v3.nextCursor).not.toContain(v3.people[0]!.displayName);
  expect(await coordinator.readManagedActiveSummary({...body,accessToken:`header.${fixtureTokens.adminA}.signature`,cursor:v3.nextCursor})).toEqual({status:'invalid_request'});
  expect(await coordinator.readManagedActiveSummary({...body,accessToken:`header.${fixtureTokens.adminA}.signature`,includeMonthHours:true,locationId:a,cursor:v3.nextCursor})).toEqual({status:'invalid_request'});
  const mobileResult=await mobile(fixtureTokens.adminA).summary(body);expect(mobileResult.status).toBe('ready');
  if(mobileResult.status==='ready')expect(isManagedActiveSummaryV3(mobileResult.value)).toBe(true);
  const web=new AdminWebApiClient((path,init)=>fetch(`${origin}${path}`,init));
  rateNow+=60_001;
  const webResult=await web.managedActiveSummary(`header.${fixtureTokens.adminA}.signature`,body);
  expect(webResult.status).toBe('succeeded');if(webResult.status==='succeeded')expect(isManagedActiveSummaryV3(webResult.value)).toBe(true);
});
it('T102 046→047 preserves old functions and populated rows, rollback and repeated migration are safe',async()=>{
  await pool.query(`DROP SCHEMA ${B3_SCHEMA} CASCADE; DROP TABLE ${B3_MIGRATION_TABLE}`);
  const migrations=await loadMigrations();await applyMigrationSet(pool,migrations.filter(m=>m.version<'047'));await seed();
  const snapshot=async(c:Pool|PoolClient)=>{
    const tables=(await c.query(`SELECT tablename FROM pg_tables WHERE schemaname='taptime_server' ORDER BY tablename`)).rows;
    const rows:Record<string,unknown>={};for(const {tablename} of tables)rows[tablename]=(await c.query(`SELECT to_jsonb(t) AS row FROM taptime_server.${tablename} t ORDER BY to_jsonb(t)::text`)).rows;
    return rows;
  };
  const oldFunctions=async(c:Pool|PoolClient)=>(await c.query(`SELECT proname,pg_get_functiondef(oid) AS definition,proacl::text FROM pg_proc
    WHERE pronamespace='taptime_server'::regnamespace AND proname IN ('read_managed_active_summary_v1','read_managed_active_summary_v2') ORDER BY proname`)).rows;
  const before=await snapshot(pool),definitions=await oldFunctions(pool);
  const c=await pool.connect();try {
    await c.query('BEGIN');await c.query(migrations.find(m=>m.version==='047')!.sql);
    expect(await snapshot(c)).toEqual(before);expect(await oldFunctions(c)).toEqual(definitions);
    await c.query('ROLLBACK');expect((await c.query(`SELECT to_regprocedure('taptime_server.read_managed_active_summary_v3(uuid,boolean,uuid,integer)') AS function`)).rows[0].function).toBeNull();
  }finally{await c.query('ROLLBACK');c.release();}
  expect((await applyMigrationSet(pool,migrations)).applied).toEqual(['047']);expect((await applyMigrationSet(pool,migrations)).applied).toEqual([]);
  expect(await snapshot(pool)).toEqual(before);expect(await oldFunctions(pool)).toEqual(definitions);
  const protection=(await pool.query(`SELECT pg_get_userbyid(proowner) AS owner,prosecdef,provolatile,proconfig FROM pg_proc
    WHERE oid='taptime_server.read_managed_active_summary_v3(uuid,boolean,uuid,integer)'::regprocedure`)).rows[0];
  expect(protection).toEqual({owner:'taptime_membership_management_function_owner',prosecdef:true,provolatile:'s',proconfig:['search_path=pg_catalog']});
  const callers=(await pool.query(`SELECT grantee.rolname FROM pg_proc p CROSS JOIN LATERAL aclexplode(p.proacl) acl
    LEFT JOIN pg_roles grantee ON grantee.oid=acl.grantee
    WHERE p.oid='taptime_server.read_managed_active_summary_v3(uuid,boolean,uuid,integer)'::regprocedure AND acl.privilege_type='EXECUTE' ORDER BY grantee.rolname`)).rows;
  expect(callers).toEqual([{rolname:'taptime_membership_management_function_owner'},{rolname:'taptime_membership_manager'}]);
  await context('admin',async c=>{await expect(c.query('SELECT * FROM taptime_server.break_intervals')).rejects.toMatchObject({code:'42501'});});
  await context('admin',async c=>{await expect(c.query('SELECT * FROM taptime_server.time_record_duration_v1($1,NULL,now(),now())',[ids.organizationA])).rejects.toMatchObject({code:'42501'});});
  expect((await pool.query(`SELECT c.relname FROM pg_class c WHERE c.relnamespace='taptime_server'::regnamespace AND c.relkind='r' AND NOT(c.relrowsecurity AND c.relforcerowsecurity)`)).rows).toEqual([]);
});

it('T102 retains the last home of departed people, and skips location sorting when disabled',async()=>{
  // A fresh read follows the committed command, as on the HTTP path.
  await pool.query('UPDATE taptime_server.memberships SET revoked_at=clock_timestamp(),row_version=row_version+1 WHERE id=$1',[ids.membershipEmployeeA]);
  await context('admin',async c=>{
    // Revocation already ends the home assignment through the production trigger.
    // D-115 still resolves the last home assignment for departed people.
    await c.query('SET LOCAL ROLE taptime_membership_manager');
    expect((await c.query('SELECT * FROM taptime_server.read_managed_active_summary_v3(NULL,NULL,NULL,20)')).rows.at(-1)).toMatchObject({membership_id:ids.membershipEmployeeA,location_id:a});
    await c.query('RESET ROLE');
    await c.query('UPDATE taptime_server.organizations SET locations_enabled=false,row_version=row_version+1 WHERE id=$1',[ids.organizationA]);
    const user=randomUUID(),member=randomUUID();
    await c.query('INSERT INTO taptime_server.users(id) VALUES($1)',[user]);
    await c.query(`INSERT INTO taptime_server.memberships(id,organization_id,user_id,role,display_name)
      VALUES($1,$2,$3,'employee','Aaron')`,[member,ids.organizationA,user]);
    await c.query('SET LOCAL ROLE taptime_membership_manager');
    const rows=(await c.query('SELECT * FROM taptime_server.read_managed_active_summary_v3(NULL,NULL,NULL,20)')).rows;
    expect(rows.every(r=>r.location_id===null)).toBe(true);
    expect(rows.map(r=>r.membership_id)).toEqual([member,...[ids.membershipAdminA,ids.membershipAdminA2].sort(),targetB,ids.membershipEmployeeA]);
    expect(rows.slice(1,3).map(r=>r.membership_display_name)).toEqual(['Administrator','Administrator']);
    expect(rows.at(-1).departed_at).not.toBeNull();
  });
});
