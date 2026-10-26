import { measureCases } from './read-measurement.js';
import { observeSql as createSqlObserver } from './sql-observer.js';
import { dayStart, shiftMonth } from '@taptime/core';
import { TIME_CALENDAR_ACCEPT_V2, TIME_CALENDAR_ACCEPT, TIME_DETAILS_ACCEPT_V3, MANAGED_PEOPLE_ACCEPT_V6, SEARCH_PAGE_MAXIMUM_BYTES } from '@taptime/mobile-work-contract';
import { OFFLINE_LEASE_PAGE_MAXIMUM_ITEMS } from '@taptime/offline-sync-contract';
import { TIME_ENTRY_EXPORT_MAXIMUM_ROWS, TIME_ENTRY_EXPORT_DEADLINE_MILLISECONDS } from '@taptime/time-entry-export-contract';
import { readFile } from 'node:fs/promises';
import { people, customers, workCards, organization, type Person } from './dataset.js';
import { id, iso, proxyHeaders, save, type Environment } from './support.js';

export type Body = Record<string, unknown>;
export interface Reading { name:string; path:string; role:'administrator'|'standortleitung'|'employee'|'operator';
  body?:Body; accept?:string; paginated?:boolean; targetMs:number; targetBytes?:number; expectedStatus?:number; legacy?:boolean }
export interface Reply { status:number; text:string; bytes:number; milliseconds:number; headers:Record<string,string> }
export const quantile = (values:number[], p:number) => [...values].sort((a,b)=>a-b)[Math.max(0,Math.ceil(values.length*p)-1)] ?? 0;
export const monthWindow = (month:string) => ({ fromInclusive:iso(dayStart(month+'-01')),toExclusive:iso(dayStart(shiftMonth(month,1)+'-01')) });

export class Http {
  private sequence=0;
  private tokens=new Map<string,string>();
  constructor(readonly env:Environment) {}
  async request(path:string, body:Body|undefined, person:Person|'operator', accept='application/json', address?:string):Promise<Reply> {
    const subject=person==='operator'?id('operator-subject'):person.user;
    if (!this.tokens.has(subject)) this.tokens.set(subject,await this.env.token(subject,person==='operator'));
    const n=this.sequence++;
    // A separate synthetic client address per isolated read measurement; the burst uses five shared addresses.
    const ip=address??`198.18.${Math.floor(n/250)%250}.${1+n%250}`;
    const before=performance.now();
    const response=await fetch(this.env.origin+path,{ method:body===undefined?'GET':'POST',
      headers:{ Authorization:`Bearer ${this.tokens.get(subject)}`,Accept:accept,'Content-Type':'application/json',
        ...proxyHeaders(ip),...(person==='operator'?{'x-forwarded-host':'operator.pilot.invalid'}:{}) },
      body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(15_000) });
    const text=await response.text();
    return { status:response.status,text,bytes:Buffer.byteLength(text),milliseconds:performance.now()-before,
      headers:Object.fromEntries(response.headers) };
  }
}

export function readCases(reference:string):Reading[] {
  const result:Reading[]=[];
  const month=monthWindow(shiftMonth(reference.slice(0,7),-1));
  for (const role of ['administrator','standortleitung','employee'] as const) {
    const person=role==='administrator'?people[0]!:role==='standortleitung'?people[1]!:people[6]!;
    const base={expectedMembershipId:person.member,cursor:null,limit:50};
    const search={...base,search:null};
    const add=(name:string,path:string,body:Body|undefined,options:Partial<Reading>={})=>result.push({name,path,role,body,targetMs:300,...options});
    add('session-mobile','/v1/session',undefined);
    add('session-web','/v2/session',undefined);
    add('own-time','/v1/mobile/own-time/query',{...base,limit:20},{accept:TIME_CALENDAR_ACCEPT_V2,paginated:true,targetMs:1000});
    add('voided-time','/v1/time-records/voided/query',{expectedMembershipId:person.member,targetMembershipId:person.member,...month,afterId:null,limit:100});
    add('work-targets','/v2/mobile/work-targets/query',search,{paginated:true,targetBytes:SEARCH_PAGE_MAXIMUM_BYTES});
    add('assigned-work-targets','/v2/mobile/work-targets/query',{...search,assignedOnly:true},{paginated:true,targetBytes:SEARCH_PAGE_MAXIMUM_BYTES});
    add('customer-month','/v2/customers/hours/query',{...search,...month},{paginated:true,targetBytes:SEARCH_PAGE_MAXIMUM_BYTES});
    add('customer-hours-v1','/v1/customers/hours/query',{expectedMembershipId:person.member,...month,responseVersion:'customer-hours.v2'},{legacy:true});
    add('customer-detail','/v2/customers/hours/detail',{...base,...month,customerId:customers[0]!.id},{paginated:true,targetBytes:SEARCH_PAGE_MAXIMUM_BYTES});
    add('quota-alerts','/v2/customers/quota-alerts/query',{...base,...month},{paginated:true,targetBytes:SEARCH_PAGE_MAXIMUM_BYTES});
    add('backfill-targets','/v2/administration/time-records/backfill-targets/query',{...search,targetMembershipId:person.member},{paginated:true,targetBytes:SEARCH_PAGE_MAXIMUM_BYTES,expectedStatus:role==='employee'?403:200});
    add('assigned-backfill-targets','/v2/administration/time-records/backfill-targets/query',{...search,targetMembershipId:person.member,assignedOnly:true},{paginated:true,targetBytes:SEARCH_PAGE_MAXIMUM_BYTES,expectedStatus:role==='employee'?403:200});
    if (role==='employee') continue;
    add('people-month-web','/v2/administration/managed-active-summary',{...search,...month,locationId:null,isRunning:null},{paginated:true,targetMs:1000,targetBytes:SEARCH_PAGE_MAXIMUM_BYTES});
    add('people-month-mobile','/v1/administration/managed-active-summary',{...search,...month,locationId:null,isRunning:null},{accept:MANAGED_PEOPLE_ACCEPT_V6,paginated:true,targetMs:1000,targetBytes:SEARCH_PAGE_MAXIMUM_BYTES});
    add('people-running','/v2/administration/managed-active-summary',{...search,...month,locationId:null,isRunning:true},{paginated:true,targetMs:1000,targetBytes:SEARCH_PAGE_MAXIMUM_BYTES});
    add('person-month-web','/v2/administration/managed-person-time',{...base,...month,limit:20,targetMembershipId:people[6]!.member},{paginated:true,targetMs:1000});
    add('person-month-mobile','/v1/administration/managed-person-time',{...base,...month,limit:20,targetMembershipId:people[6]!.member},{accept:TIME_CALENDAR_ACCEPT,paginated:true,targetMs:1000});
    for (const version of [3,4]) add(`memberships-v${version}`,`/v${version}/administration/employee-memberships-projection`,{...search,locationId:null},{paginated:true,targetBytes:SEARCH_PAGE_MAXIMUM_BYTES});
    add('membership-name','/v1/administration/memberships/name',{expectedMembershipId:person.member,targetMembershipId:people[6]!.member});
    add('setup-initial','/v2/administration/setup-projection',{...base,limit:20});
    for (const kind of ['customers','nfc_tags']) add(`setup-${kind}`,'/v3/administration/setup-projection',{...search,kind},{paginated:true,targetBytes:SEARCH_PAGE_MAXIMUM_BYTES});
    add('projects','/v2/administration/projects/query',search,{paginated:true,targetBytes:SEARCH_PAGE_MAXIMUM_BYTES,expectedStatus:role==='standortleitung'?403:200});
    add('locations','/v1/administration/locations/query',{...base,limit:100},{paginated:true});
    for (const kind of ['locations','memberships','work_targets','activation_gaps']) add(`location-setup-${kind}-F018`,'/v1/administration/location-setup/query',{...base,kind,limit:100},{paginated:true,expectedStatus:role==='standortleitung'?403:200});
    add('time-records','/v2/administration/time-records/query',{...base,...month,limit:20},{accept:TIME_DETAILS_ACCEPT_V3,paginated:true});
    add('review-items','/v4/administration/review-items/query',{...base,limit:100},{paginated:true});
    add('archive-people','/v1/administration/archive/people',{...search,locationId:null,membershipId:null},{paginated:true,targetBytes:SEARCH_PAGE_MAXIMUM_BYTES});
    add('archive-targets','/v1/administration/archive/targets',{...search,locationId:null},{paginated:true,targetBytes:SEARCH_PAGE_MAXIMUM_BYTES});
    add('archive-status','/v1/administration/archive/status',{expectedMembershipId:person.member,
      membershipIds:people.slice(190).map(p=>p.member),targets:customers.slice(490).map(c=>({targetType:'customer',targetId:c.id}))});
    add('assignments-person','/v1/administration/target-assignments/query',{...search,membershipId:people[6]!.member},{paginated:true,targetBytes:SEARCH_PAGE_MAXIMUM_BYTES});
    add('assignments-customer','/v1/administration/target-assignments/query',{...search,targetType:'customer',targetId:customers[0]!.id},{paginated:true,targetBytes:SEARCH_PAGE_MAXIMUM_BYTES});
    add('tag-inspect','/v2/administration/nfc-tags/inspect',{expectedMembershipId:person.member,canonicalPayload:'nfc:uid:v1:00000000000001'});
  }
  for (const path of ['session','overview','health','audit']) result.push({ name:`operator-${path}`,path:`/v1/operator/${path}`,role:'operator',
    body:path==='session'?undefined:path==='audit'?{before:null,limit:50}:{},targetMs:300,accept:'application/vnd.taptime.operator.v3+json' });
  return result;
}

export const actorFor = (role:Reading['role']) => role==='operator'?'operator':role==='administrator'?people[0]!:role==='standortleitung'?people[1]!:people[6]!;

export async function measureReads(http:Http, reference:string, profile:string, smoke:boolean) {
  const results:unknown[]=[];
  const fixtures:Record<string,unknown>={};
  const cases=readCases(reference);
  // TL decision for T-099b: the unused v1 contract keeps its full result and
  // existing response bound. Derive its expected rejection from actual bytes,
  // independently of the measured HTTP status (never hide an unexpected 503).
  const serverSource=await readFile('apps/backend-api/src/BackendHttpServer.ts','utf8');
  const bound=serverSource.match(/TIME_REVIEW_READ_RESPONSE_MAXIMUM_BYTES = (\d+) \* 1024/);
  if(!bound)throw new Error('Legacy response bound changed; review the expectation probe');
  const responseLimitBytes=Number(bound[1])*1024;
  const legacy=[];
  for(const item of cases.filter(item=>item.legacy)) {
    const actor=actorFor(item.role) as Person, client=await http.env.db.connect();
    try {
      await client.query('BEGIN');
      await client.query("SELECT set_config('app.organization_id',$1,true),set_config('app.user_id',$2,true),set_config('app.membership_id',$3,true),set_config('app.membership_role',$4,true)",[organization,actor.user,actor.member,item.role]);
      await client.query('SET LOCAL ROLE taptime_mobile_own_time_reader');
      const value=(await client.query('SELECT taptime_server.read_customer_hours_v2($1,$2) AS result',[item.body!.fromInclusive,item.body!.toExclusive])).rows[0].result;
      const encodedBytes=Buffer.byteLength(JSON.stringify(value));
      item.expectedStatus=encodedBytes>responseLimitBytes?503:200;
      legacy.push({role:item.role,encodedBytes,responseLimitBytes,expectedStatus:item.expectedStatus});
    } finally {await client.query('ROLLBACK');client.release();}
  }
  await save(`${profile}/legacy-customer-hours-expectations.json`,legacy);
  for (const role of ['administrator','standortleitung','employee'] as const) {
    const actor=actorFor(role) as Person;
    const running=(await http.env.db.query('SELECT id FROM taptime_server.time_entries WHERE user_id=$1 AND stopped_at IS NULL',[actor.user])).rows[0];
    if(!running)throw new Error(`Missing running fixture for ${role}`);
    cases.push({name:'lock-screen-capability',path:'/v1/lock-screen/capability',role,
      body:{expectedMembershipId:actor.member,timeEntryId:running.id,installationId:null},targetMs:300});
    const command={commandId:id(`read-lease-${role}`),installationBinding:Buffer.alloc(32,actor.index+1).toString('base64url'),lookupKey:Buffer.alloc(32,99).toString('base64url')};
    const leaseReply=await http.request('/v3/offline-capture-leases',command,actor);
    if(leaseReply.status!==200)throw new Error(`Read lease setup: ${leaseReply.text}`);
    const page=JSON.parse(leaseReply.text).page;
    cases.push({name:'offline-lease',path:'/v3/offline-capture-leases',role,body:command,targetMs:300});
    if(page.nextCursor)cases.push({name:'offline-lease-page',path:'/v3/offline-capture-leases/page',role,
      body:{leaseId:page.leaseId,cursor:page.nextCursor,limit:OFFLINE_LEASE_PAGE_MAXIMUM_ITEMS},targetMs:300,paginated:true});
    cases.push({name:'offline-reconcile',path:'/v2/lifecycle-events/reconcile',role,
      body:{workEventIds:[id(`${profile}-offline-event-${actor.index}-1`)]},targetMs:300});
    cases.push({name:'offline-review-state',path:'/v1/offline-review-state/query',role,
      body:{expectedMembershipId:actor.member,installationId:page.installationId},targetMs:300});
  }
  return (await measureCases(http,cases,actorFor,profile,smoke,save,results,fixtures)).results;
}

export const observeSql=()=>createSqlObserver(save);

export async function sizeAndCounts(env:Environment,profile:string) {
  const bytes=Number((await env.db.query('SELECT pg_database_size(current_database()) AS bytes')).rows[0].bytes);
  const tables=(await env.db.query(`SELECT relname,pg_total_relation_size(relid)::bigint AS total_bytes,
    pg_relation_size(relid)::bigint AS table_bytes,pg_indexes_size(relid)::bigint AS index_bytes,n_live_tup
    FROM pg_stat_user_tables ORDER BY pg_total_relation_size(relid) DESC`)).rows;
  const indexes=(await env.db.query('SELECT indexrelname,pg_relation_size(indexrelid)::bigint AS bytes FROM pg_stat_user_indexes ORDER BY pg_relation_size(indexrelid) DESC LIMIT 15')).rows;
  const monthly=(await env.db.query(`SELECT to_char(started_at AT TIME ZONE 'Europe/Berlin','YYYY-MM') AS month,count(*)::int AS canonical
    FROM taptime_server.time_entries GROUP BY 1 ORDER BY 1`)).rows;
  const backfills=(await env.db.query(`SELECT to_char(effective_started_at AT TIME ZONE 'Europe/Berlin','YYYY-MM') AS month,count(*)::int AS backfilled
    FROM taptime_server.time_record_revisions r WHERE revision_number=1 AND NOT EXISTS(SELECT 1 FROM taptime_server.time_entries t WHERE t.id=r.time_record_id) GROUP BY 1 ORDER BY 1`)).rows;
  const result={bytes,tables,indexes,monthly,backfills}; await save(`${profile}/size.json`,result); return result;
}

export async function exports(http:Http,reference:string,profile:string,smoke:boolean) {
  const results=[];
  for (const offset of [-3,-2,-1,0]) for (const version of [3,4]) {
    const month=shiftMonth(reference.slice(0,7),offset);
    const samples=[];
    for(let sample=0;sample<(smoke?1:20);sample++)samples.push(await http.request(`/v${version}/time-entries/export`,{expectedMembershipId:people[0]!.member,...monthWindow(month)},people[0]!,'text/csv'));
    const response=samples[0]!;
    results.push({month,version,...response,text:response.status===200?undefined:response.text,
      rows:response.status===200?response.text.trimEnd().split('\n').length-1:null,targetMs:8000,maximumRows:TIME_ENTRY_EXPORT_MAXIMUM_ROWS,
      samples:samples.map(({text,headers,...sample})=>({...sample,rows:sample.status===200?text.trimEnd().split('\n').length-1:null})),p50:quantile(samples.map(s=>s.milliseconds),.5),p95:quantile(samples.map(s=>s.milliseconds),.95)});
    await save(`${profile}/exports.json`,results);
    console.log(`${profile}: export ${month} v${version}: ${response.status}, ${response.milliseconds.toFixed(1)} ms`);
  }
  await save(`${profile}/exports.json`,results);return results;
}

// Controlled local contention only, after latency/size measurements. This exercises
// F-043 without changing a runtime timeout or manufacturing a successful export.
export async function timeoutProbe(http:Http,reference:string,profile:string) {
  const runtime=await readFile('apps/backend-api/src/runtime.ts','utf8');
  const server=await readFile('apps/backend-api/src/BackendHttpServer.ts','utf8');
  const coordinator=await readFile('apps/backend-time-export/src/TimeEntryExportCoordinator.ts','utf8');
  if (!/createRuntimePool\(timeEntryExportDatabase.connectionString, true\)/.test(runtime)
    || !/query_timeout: exportDeadline \? 0 :/.test(runtime)
    || !server.includes('Math.min(timeoutMilliseconds, TIME_ENTRY_EXPORT_DEADLINE_MILLISECONDS)')
    || !coordinator.includes('DEFAULT_INTERNAL_DEADLINE_MILLISECONDS = TIME_ENTRY_EXPORT_DEADLINE_MILLISECONDS')) {
    throw new Error('Export deadline composition changed; review the F043 probe');
  }
  const budgets={poolQueryMs:0,httpOperationMs:TIME_ENTRY_EXPORT_DEADLINE_MILLISECONDS,
    coordinatorDefaultMs:TIME_ENTRY_EXPORT_DEADLINE_MILLISECONDS};
  const blocker=await http.env.db.connect();
  try {
    await blocker.query('BEGIN');
    await blocker.query('LOCK TABLE taptime_server.time_entries IN ACCESS EXCLUSIVE MODE');
    const response=await http.request('/v4/time-entries/export',{
      expectedMembershipId:people[0]!.member,...monthWindow(shiftMonth(reference.slice(0,7),-1)),
    },people[0]!,'text/csv');
    await save(`${profile}/F043-probe.json`,{budgets,response,artificialContention:true});
  } finally {await blocker.query('ROLLBACK');blocker.release();}
}
