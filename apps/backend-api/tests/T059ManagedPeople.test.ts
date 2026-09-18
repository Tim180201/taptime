import { rangeSummary } from '../../mobile/src/screens/ownTimeCalendar.js';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createBackendHttpServer } from '../src/BackendHttpServer.js';
import { unavailableOfflineDependencies } from './offlineTestDependencies.js';
import { TapTimeEmployeesApiClient } from '../../mobile/src/employees/TapTimeEmployeesApiClient.js';
import { validateOwnTimeResponse } from '@taptime/mobile-work-contract';
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
let invitations: Pool, enrollment: Pool, coordinator: EmployeeMembershipEnrollmentCoordinator, server: Server, origin: string;
beforeAll(async () => {
  await pool.query(`DROP SCHEMA IF EXISTS ${B3_SCHEMA} CASCADE; DROP TABLE IF EXISTS ${B3_MIGRATION_TABLE}`);
  await migrate(pool);
  const password=syntheticPassword();
  await ensureC3E1RuntimeLogins(pool,password,password);
  const database=process.env.C2_DATABASE_URL ?? 'postgresql://timbartz@127.0.0.1:5432/taptime_c2';
  invitations=new Pool({connectionString:c3e1RuntimeConnectionString(database,C3E1_INVITATION_RUNTIME_LOGIN,password)});
  enrollment=new Pool({connectionString:c3e1RuntimeConnectionString(database,C3E1_ENROLLMENT_RUNTIME_LOGIN,password)});
  const provider=new SupabaseAccountInviter('https://synthetic.invalid/auth/v1','synthetic-local-only','https://admin.example.test/willkommen',()=>{},async(input,init)=>{
    if (new URL(String(input)).pathname.endsWith('/admin/users')) return Response.json({users:[]});
    return Response.json({id:randomUUID(),email:JSON.parse(String(init?.body)).email});
  });
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
beforeEach(async () => { await truncateC3C(pool); await seed(); });
afterAll(async () => {
  if(server) await new Promise<void>(resolve=>server.close(()=>resolve()));
  await invitations?.end(); await enrollment?.end();
  await removeC3E1RuntimeLogins(pool); await pool.end();
});
function mobile(token:string) {
  return new TapTimeEmployeesApiClient(origin,{async post(endpoint,body){
    rateNow+=60_001; // A new rate-limit window for each independent authorization case.
    const response=await fetch(endpoint,{method:'POST',headers:{authorization:`Bearer header.${token}.signature`,'content-type':'application/json'},body});
    return {status:'response',statusCode:response.status,contentType:response.headers.get('content-type'),body:await response.text()};
  }});
}

describe('T059 SQL scope and migration', () => {
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
    expect(validateOwnTimeResponse(first.value)).toBe(true);
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
    expect(rangeSummary({...first.value,records,nextCursor:null},'2026-10-01','2026-10-02')).toEqual({complete:true,milliseconds:6*60*60*1000});
  });
  it('migrates populated 027 without changing any application row and enforces RLS on every table', async () => {
    await pool.query(`DROP SCHEMA ${B3_SCHEMA} CASCADE; DROP TABLE ${B3_MIGRATION_TABLE}`);
    const migrations = await loadMigrations();
    await applyMigrationSet(pool,migrations.filter(m=>m.version<='027'));
    await seed();
    const snapshot = async () => {
      const tables = (await pool.query(`SELECT tablename FROM pg_tables WHERE schemaname='taptime_server' ORDER BY tablename`)).rows;
      const rows: Record<string, unknown> = {};
      for (const {tablename} of tables) rows[tablename] = (await pool.query(`SELECT to_jsonb(t) AS row FROM taptime_server.${tablename} t ORDER BY to_jsonb(t)::text`)).rows;
      return rows;
    };
    const before = await snapshot();
    expect((await migrate(pool)).applied).toEqual(migrations.filter(m=>m.version>'027').map(m=>m.version));
    expect(await snapshot()).toEqual(before);
    expect((await pool.query(`SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='taptime_server' AND c.relkind='r' AND NOT(c.relrowsecurity AND c.relforcerowsecurity)`)).rows).toEqual([]);
    expect((await summary('manager'))[0]).toMatchObject({running_count:'1',total_count:'3'});
  });
});
