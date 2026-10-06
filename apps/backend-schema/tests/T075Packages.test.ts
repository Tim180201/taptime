import { randomUUID } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import { applyMigrationSet, loadMigrations, migrate } from '../src/index.js';
import { ids, seedB3, truncateB3 } from './fixtures.js';
const pool=new Pool({connectionString:process.env.B3_DATABASE_URL ?? 'postgresql://timbartz@127.0.0.1:5432/taptime_b3'});
const issuer='https://synthetic.invalid/auth';
async function reset(){await pool.query('DROP SCHEMA IF EXISTS taptime_server CASCADE; DROP TABLE IF EXISTS public.taptime_server_schema_migrations');}
beforeAll(async()=>{await reset();await migrate(pool);});
beforeEach(async()=>{await truncateB3(pool);await pool.query('TRUNCATE taptime_server.platform_operators CASCADE');await seedB3(pool);
  await pool.query("INSERT INTO taptime_server.platform_operators(issuer,subject) VALUES($1,'operator')",[issuer]);});
afterAll(()=>pool.end());
async function operator<T>(run:(c:PoolClient)=>Promise<T>){const c=await pool.connect();try{
  await c.query('BEGIN; SET LOCAL ROLE taptime_platform_operator');
  await c.query("SELECT taptime_server.read_operator_session_v1($1,'operator')",[issuer]);
  const value=await run(c);await c.query('COMMIT');return value;
}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}
async function usage(org:string,at:string){return (await pool.query('SELECT taptime_server.organization_access_usage_v1($1,$2) value',[org,at])).rows[0].value;}
async function interval(org:string,start:string,end:string|null,role='employee'){
  const user=randomUUID();await pool.query('INSERT INTO taptime_server.users(id) VALUES($1)',[user]);
  await pool.query(`INSERT INTO taptime_server.memberships(id,organization_id,user_id,role,created_by_user_id,created_at,revoked_at)
    VALUES($1,$2,$1,$3,$1,$4,$5)`,[user,org,role,start,end]);
}
it('upgrades the preceding migration with data, keeps null packages and replays the ledger',async()=>{
  await reset();const migrations=await loadMigrations(), index=migrations.findIndex(m=>m.version==='048');
  expect(index).toBeGreaterThan(0);await applyMigrationSet(pool,migrations.slice(0,index));await seedB3(pool);
  const before=(await pool.query('SELECT id,created_at,revoked_at FROM taptime_server.memberships ORDER BY id')).rows;
  const c=await pool.connect();try{
    await c.query('BEGIN');await c.query(migrations[index]!.sql);
    expect((await c.query('SELECT package_size FROM taptime_server.organizations')).rows.every(r=>r.package_size===null)).toBe(true);
    await c.query('ROLLBACK');
    expect((await c.query("SELECT column_name FROM information_schema.columns WHERE table_schema='taptime_server' AND table_name='organizations' AND column_name='package_size'")).rows).toEqual([]);
  }finally{await c.query('ROLLBACK');c.release();}
  expect((await migrate(pool)).applied).toEqual(migrations.slice(index).map(m=>m.version));
  expect((await pool.query('SELECT package_size FROM taptime_server.organizations')).rows.every(r=>r.package_size===null)).toBe(true);
  expect((await pool.query('SELECT id,created_at,revoked_at FROM taptime_server.memberships ORDER BY id')).rows).toEqual(before);
  expect(await migrate(pool)).toEqual({applied:[],alreadyApplied:migrations.map(m=>m.version)});
});
it('counts every role and intramonth peaks, including both repeated October hours and Berlin boundaries',async()=>{
  const org=randomUUID();await pool.query("INSERT INTO taptime_server.organizations(id,name) VALUES($1,'Kalender')",[org]);
  await interval(org,'2026-09-01T00:00:00Z',null,'administrator');
  // September-only access ends at October midnight in Berlin, not UTC midnight.
  await interval(org,'2026-09-30T21:00:00Z','2026-09-30T22:00:00Z');
  await interval(org,'2026-09-30T22:00:00Z','2026-10-10T00:00:00Z','standortleitung');
  await interval(org,'2026-10-05T00:00:00Z','2026-10-10T00:00:00Z');
  // Simultaneous ends/starts must not manufacture a peak of five.
  await interval(org,'2026-10-10T00:00:00Z','2026-10-20T00:00:00Z');
  await interval(org,'2026-10-10T00:00:00Z','2026-10-20T00:00:00Z');
  await interval(org,'2026-10-25T00:15:00Z','2026-10-25T01:45:00Z');
  await interval(org,'2026-10-25T01:15:00Z','2026-10-25T02:00:00Z');
  await interval(org,'2026-10-25T01:15:00Z','2026-10-25T01:15:00Z'); // empty interval
  await interval(org,'2026-10-31T23:00:00Z',null); // November, after the DST shift
  expect(await usage(org,'2026-10-01T00:00:00Z')).toMatchObject({active_access_count:2,current_month:'2026-10',current_month_peak:2,previous_month_peak:2});
  expect(await usage(org,'2026-10-25T01:30:00Z')).toMatchObject({active_access_count:3,current_month_peak:3});
  expect(await usage(org,'2026-10-31T22:59:59Z')).toMatchObject({active_access_count:1,current_month_peak:3,previous_month:'2026-09',previous_month_peak:2});
  expect(await usage(org,'2026-10-31T23:00:00Z')).toMatchObject({active_access_count:2,current_month:'2026-11',current_month_peak:2,previous_month_peak:3});
  expect(await usage(org,'2027-01-01T00:00:00Z')).toMatchObject({current_month:'2027-01',previous_month:'2026-12',current_month_peak:2});
  const empty=randomUUID();await pool.query("INSERT INTO taptime_server.organizations(id,name) VALUES($1,'Leer')",[empty]);
  expect(await usage(empty,'2026-10-31T23:00:00Z')).toMatchObject({active_access_count:0,current_month_peak:0,previous_month_peak:0});
});
it('creates, changes and clears packages with audited values, required reason, concurrency and idempotency',async()=>{
  const command=randomUUID();
  const create=(c:PoolClient,size:number|null)=>c.query(`SELECT taptime_server.operator_create_organization_v3($1,'Neu',$2,$3,'first-admin',true,$4) result`,[command,Buffer.alloc(32,1),issuer,size]);
  const result=await operator(async c=>(await create(c,2)).rows[0].result);expect(result.status).toBe('succeeded');
  expect(await operator(async c=>(await create(c,2)).rows[0].result)).toEqual(result);
  expect(await operator(async c=>(await create(c,3)).rows[0].result)).toEqual({status:'command_id_conflict'});
  const org=result.organization_id;
  const change=(id:string,size:number|null,reason:string,version:number)=>operator(async c=>(await c.query('SELECT taptime_server.operator_set_organization_package_v1($1,$2,$3,$4,$5) result',[id,org,size,reason,version])).rows[0].result);
  expect(await change(randomUUID(),4,' ',1)).toEqual({status:'invalid_request'});
  expect(await change(randomUUID(),0,'Ungültig',1)).toEqual({status:'invalid_request'});
  const edit=randomUUID();const changed=await change(edit,4,'Mehr Zugänge',1);expect(changed.status).toBe('succeeded');
  expect(await change(edit,4,'Mehr Zugänge',1)).toEqual(changed);
  expect(await change(randomUUID(),5,'Veraltet',1)).toEqual({status:'conflict'});
  expect((await change(randomUUID(),null,'Paket entfernen',2)).status).toBe('succeeded');
  const audit=await operator(async c=>(await c.query('SELECT taptime_server.read_platform_audit_v2(NULL,100) result')).rows[0].result);
  expect(audit.events.filter((e:{organization_id:string})=>e.organization_id===org).map((e:Record<string,unknown>)=>[e.action,e.package_size_before,e.package_size_after,e.reason]))
    .toEqual([['organization_package_changed',4,null,'Paket entfernen'],['organization_package_changed',2,4,'Mehr Zugänge'],['organization_created',null,2,null]]);
  expect((await pool.query('SELECT package_size FROM taptime_server.organizations WHERE id=$1',[org])).rows[0].package_size).toBeNull();
  await expect(pool.query('UPDATE taptime_server.platform_audit_events SET package_size_after=5')).rejects.toMatchObject({code:'42501'});
});
it('exposes only aggregate fields to operators and preserves the old exact contracts',async()=>{
  await operator(async c=>{
    const old=(await c.query('SELECT taptime_server.read_operator_overview_v1() result')).rows[0].result;
    const current=(await c.query('SELECT taptime_server.read_operator_overview_v2() result')).rows[0].result;
    expect(current.organizations.map(({package_usage,...row}:Record<string,unknown>)=>row)).toEqual(old.organizations);
    for(const row of current.organizations){expect(Object.keys(row.package_usage).sort()).toEqual(['active_access_count','current_month','current_month_peak','package_size','previous_month','previous_month_peak']);}
    const audit=(await c.query('SELECT taptime_server.read_platform_audit_v1(NULL,100) result')).rows[0].result;
    for(const row of audit.events) expect(Object.keys(row).sort()).toEqual(['action','actor','created_at','id','organization_id','reason']);
  });
});
it('derives the complete new function privilege inventory and checks all application table RLS',async()=>{
  const migration=(await loadMigrations()).find(m=>m.version==='048')!;
  const names=[...migration.sql.matchAll(/CREATE FUNCTION taptime_server\.([a-z0-9_]+)/g)].map(m=>m[1]);
  const functions=(await pool.query(`SELECT p.proname,p.oid::regprocedure::text signature,r.rolname owner,p.prosecdef,p.proconfig
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace JOIN pg_roles r ON r.oid=p.proowner
    WHERE n.nspname='taptime_server' AND p.proname=ANY($1)`,[names])).rows;
  expect(functions.map(f=>f.proname).sort()).toEqual(names.sort());
  const roles=(await pool.query("SELECT rolname FROM pg_roles WHERE rolname LIKE 'taptime_%' AND NOT rolcanlogin AND NOT rolbypassrls AND NOT rolsuper")).rows;
  for(const f of functions){
    const admin=f.proname==='read_organization_package_v1', privateFn=f.proname==='organization_access_usage_v1';
    expect(f).toMatchObject({owner:admin?'taptime_membership_management_function_owner':'taptime_platform_operator_owner',prosecdef:true,proconfig:['search_path=pg_catalog']});
    for(const role of roles){
      expect((await pool.query("SELECT has_function_privilege($1,$2,'EXECUTE') allowed",[role.rolname,f.signature])).rows[0].allowed,`${role.rolname}: ${f.proname}`)
        .toBe(!privateFn && role.rolname===(admin?'taptime_membership_manager':'taptime_platform_operator'));
    }
  }
  expect((await pool.query(`SELECT relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='taptime_server' AND relkind IN ('r','p') AND NOT (relrowsecurity AND relforcerowsecurity)`)).rows).toEqual([]);
  for(const role of roles) expect((await pool.query("SELECT has_column_privilege($1,'taptime_server.organizations','package_size','UPDATE') allowed",[role.rolname])).rows[0].allowed,role.rolname).toBe(false);
});
