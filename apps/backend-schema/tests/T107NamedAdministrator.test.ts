import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import {beforeAll,afterAll,expect,it} from 'vitest';
import {applyMigrationSet,loadMigrations,migrate} from '../src/index.js';
import {latestFunctionBodies,functionBodyDrift,type StoredFunction} from './support/migrationFunctionBodies.js';
const pool=new Pool({connectionString:process.env.B3_DATABASE_URL??'postgresql://timbartz@127.0.0.1:5432/taptime_b3'});
const issuer='https://synthetic.invalid/t107',subject='operator-t107';
beforeAll(async()=>{
 await pool.query('DROP SCHEMA IF EXISTS taptime_server CASCADE; DROP TABLE IF EXISTS public.taptime_server_schema_migrations');
 await applyMigrationSet(pool,(await loadMigrations()).filter(m=>m.version<'050'));
 await pool.query('INSERT INTO taptime_server.platform_operators(issuer,subject) VALUES($1,$2)',[issuer,subject]);
});
afterAll(()=>pool.end());
it('upgrades with existing data and preserves the old creator body, permissions and ledger',async()=>{
 const before=(await pool.query("SELECT prosrc FROM pg_proc WHERE oid='taptime_server.operator_create_organization_v3(uuid,text,bytea,text,text,boolean,integer)'::regprocedure")).rows;
 const operators=(await pool.query('SELECT * FROM taptime_server.platform_operators')).rows;
 await migrate(pool);expect((await pool.query('SELECT * FROM taptime_server.platform_operators')).rows).toEqual(operators);
 expect((await pool.query("SELECT prosrc FROM pg_proc WHERE oid='taptime_server.operator_create_organization_v3(uuid,text,bytea,text,text,boolean,integer)'::regprocedure")).rows).toEqual(before);
 const migrations=await loadMigrations();expect(await migrate(pool)).toEqual({applied:[],alreadyApplied:migrations.map(m=>m.version)});
 const signature='taptime_server.operator_create_organization_v4(uuid,text,bytea,text,text,boolean,integer,text)';
 const f=(await pool.query(`SELECT p.prosecdef,p.proconfig,r.rolname FROM pg_proc p JOIN pg_roles r ON r.oid=p.proowner WHERE p.oid=$1::regprocedure`,[signature])).rows[0];
 expect(f).toEqual({prosecdef:true,proconfig:['search_path=pg_catalog'],rolname:'taptime_platform_operator_owner'});
 const roles=(await pool.query("SELECT rolname FROM pg_roles WHERE rolname LIKE 'taptime_%' AND NOT rolcanlogin AND NOT rolbypassrls AND NOT rolsuper")).rows;
 for(const {rolname} of roles)expect((await pool.query("SELECT has_function_privilege($1,$2,'EXECUTE') allowed",[rolname,signature])).rows[0].allowed,rolname).toBe(rolname==='taptime_platform_operator');
 const actual=(await pool.query<StoredFunction>("SELECT proname name,pronargs arity,prosrc body FROM pg_proc WHERE pronamespace='taptime_server'::regnamespace AND prokind='f'")).rows;
 expect(functionBodyDrift(actual,latestFunctionBodies(migrations))).toEqual([]);
});
it('SQL rejects empty or invalid names, binds the name into idempotency and never discloses it to operator reads',async()=>{
 const c=await pool.connect();
 try{
  await c.query('BEGIN; SET LOCAL ROLE taptime_platform_operator');await c.query('SELECT taptime_server.read_operator_session_v1($1,$2)',[issuer,subject]);
  const command=randomUUID();
  const create=async(name:string|null)=>(await c.query("SELECT taptime_server.operator_create_organization_v4($1,'Betrieb',$2,$3,'named-person',true,10,$4) result",[command,Buffer.alloc(32,9),issuer,name])).rows[0].result;
  for(const name of [null,'','\u00a0\t','\u200b','x'.repeat(121)])expect(await create(name)).toEqual({status:'invalid_request'});
  const result=await create('Erika Beispiel');expect(result.status).toBe('succeeded');expect(await create('Erika Beispiel')).toEqual(result);
  expect(await create('Andere Person')).toEqual({status:'command_id_conflict'});
  for(const fn of ['read_operator_overview_v1()','read_operator_overview_v2()','read_platform_audit_v1(NULL,100)','read_platform_audit_v2(NULL,100)'])expect(JSON.stringify((await c.query(`SELECT taptime_server.${fn} result`)).rows)).not.toContain('Erika Beispiel');
  await c.query('RESET ROLE');expect((await c.query('SELECT display_name FROM taptime_server.memberships WHERE organization_id=$1',[result.organization_id])).rows).toEqual([{display_name:'Erika Beispiel'}]);
 }finally{await c.query('ROLLBACK');c.release();}
});
