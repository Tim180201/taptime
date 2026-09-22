import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { migrate } from '../src/index.js';
import { ids, seedB3, truncateB3 } from './fixtures.js';

const pool = new Pool({ connectionString: process.env.B3_DATABASE_URL
  ?? 'postgresql://timbartz@127.0.0.1:5432/taptime_b3', max: 4 });
const issuer = 'https://synthetic.invalid/auth';
const operator = '90000000-0000-4000-8000-000000000001';
beforeAll(async () => {
  await pool.query('DROP SCHEMA IF EXISTS taptime_server CASCADE; DROP TABLE IF EXISTS public.taptime_server_schema_migrations');
  await migrate(pool);
});
beforeEach(async () => {
  await truncateB3(pool);
  // The tables are introduced by 032; a missing table is a deliberate red proof.
  await pool.query('TRUNCATE taptime_server.platform_operators CASCADE');
  await seedB3(pool);
});
afterAll(() => pool.end());

async function asOperator<T>(operation: (client: import('pg').PoolClient) => Promise<T>) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN; SET LOCAL ROLE taptime_platform_operator');
    await client.query(`SELECT taptime_server.read_operator_session_v1($1,'operator')`, [issuer]);
    const result = await operation(client);
    await client.query('COMMIT');
    return result;
  } catch(e) { await client.query('ROLLBACK'); throw e; }
  finally { client.release(); }
}

describe('T-068a operator capabilities (D-068)', () => {
  beforeEach(async () => {
    await pool.query(`INSERT INTO taptime_server.platform_operators(id,issuer,subject) VALUES($1,$2,'operator')`, [operator,issuer]);
  });
  it('resolves only active operators and denies every other runtime role', async () => {
    const roles = await pool.query(`SELECT rolname FROM pg_roles WHERE rolname LIKE 'taptime_%'
      AND NOT rolsuper AND NOT rolbypassrls AND rolname<>'taptime_platform_operator'`);
    const functions = await pool.query(`SELECT p.oid::regprocedure::text signature FROM pg_proc p
      JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='taptime_server'
      AND p.proname IN ('read_operator_session_v1','read_operator_overview_v1','read_operator_health_v1',
        'read_platform_audit_v1','operator_create_organization_v1','operator_set_organization_status_v1')`);
    expect(functions.rows.map(r => r.signature.split('(')[0])).toEqual(expect.arrayContaining([
      'taptime_server.read_operator_session_v1', 'taptime_server.read_operator_overview_v1',
      'taptime_server.read_operator_health_v1', 'taptime_server.read_platform_audit_v1',
      'taptime_server.operator_create_organization_v1', 'taptime_server.operator_set_organization_status_v1']));
    for (const role of roles.rows) for (const fn of functions.rows) {
      const privilege = await pool.query('SELECT has_function_privilege($1,$2,\'EXECUTE\') allowed',[role.rolname,fn.signature]);
      expect(privilege.rows[0].allowed,`${role.rolname}: ${fn.signature}`).toBe(false);
    }
    expect(await asOperator(async c => (await c.query(`SELECT current_setting('app.operator_id') id`)).rows[0].id)).toBe(operator);
    await pool.query('UPDATE taptime_server.platform_operators SET revoked_at=now() WHERE id=$1',[operator]);
    expect(await asOperator(async c => (await c.query(`SELECT current_setting('app.operator_id') id`)).rows[0].id)).toBe('');
    await expect(asOperator(c => c.query('SELECT taptime_server.read_operator_overview_v1()'))).rejects.toMatchObject({code:'42501'});
  });
  it('creates the first administrator atomically and retries without another organization', async () => {
    const command = '93000000-0000-4000-8000-000000000001';
    const create = (c: import('pg').PoolClient, subject: string|null) => c.query(`SELECT taptime_server.operator_create_organization_v1(
      $1,'  Neuer Betrieb  ',$2,$3,$4) result`,[command,Buffer.alloc(32,1),issuer,subject]);
    const created = await asOperator(async c => {
      expect((await create(c,null)).rows[0].result.status).toBe('prepared');
      return (await create(c,'first-admin')).rows[0].result;
    });
    expect(created.status).toBe('succeeded');
    expect(await asOperator(async c => (await create(c,null)).rows[0].result)).toEqual(created);
    const memberships = await pool.query(`SELECT m.role,o.name FROM taptime_server.memberships m
      JOIN taptime_server.organizations o ON o.id=m.organization_id WHERE o.id=$1`,[created.organization_id]);
    expect(memberships.rows).toEqual([{role:'administrator',name:'Neuer Betrieb'}]);
    for (const subject of ['employee-a','operator']) {
      const result = await asOperator(async c => (await c.query(`SELECT taptime_server.operator_create_organization_v1(
        gen_random_uuid(),'Kein Betrieb',$1,$2,$3) result`,[Buffer.alloc(32,2),issuer,subject])).rows[0].result);
      expect(result).toEqual({status:'identity_unavailable'});
    }
    const aborted = await pool.connect();
    try {
      await aborted.query('BEGIN; SET LOCAL ROLE taptime_platform_operator');
      await aborted.query(`SELECT taptime_server.read_operator_session_v1($1,'operator')`,[issuer]);
      await aborted.query(`SELECT taptime_server.operator_create_organization_v1(gen_random_uuid(),'Fehlversuch',$1,$2,NULL)`,[Buffer.alloc(32,3),issuer]);
      await aborted.query('ROLLBACK');
    } finally { aborted.release(); }
    expect((await pool.query(`SELECT name FROM taptime_server.organizations WHERE name IN ('Kein Betrieb','Fehlversuch')`)).rows).toEqual([]);
  });
  it('returns only the explicitly allowed aggregate fields', async () => {
    const allowed = new Set(['status','organizations','totals','organization_id','name','created_at','row_version',
      'administrators','location_managers','employees','active_now','last_tap','tags','active_assignments','open_invitations',
      'taps_today','database_bytes','last_archived_at','last_base_at','events','next_before','id','action','reason','actor']);
    const check = (value: unknown): void => {
      if (Array.isArray(value)) { value.forEach(check); return; }
      if (value && typeof value==='object') for (const [key,item] of Object.entries(value)) {
        expect(allowed.has(key),key).toBe(true); check(item);
      }
    };
    await asOperator(async c => {
      for (const sql of ['read_operator_overview_v1()','read_operator_health_v1()','read_platform_audit_v1(NULL,20)']) {
        check((await c.query(`SELECT taptime_server.${sql} result`)).rows[0].result);
      }
    });
  });
});

describe('T-068a schema boundaries (D-074)', () => {
  it.each(['READ COMMITTED','REPEATABLE READ'])('serializes competing authorities under %s', async isolation => {
    const first=await pool.connect(), second=await pool.connect();
    try {
      await first.query('BEGIN');
      await second.query(`BEGIN ISOLATION LEVEL ${isolation}`);
      // Establish the snapshot before the opposing transaction writes.
      const pid=(await second.query('SELECT pg_backend_pid() pid')).rows[0].pid;
      await first.query(`INSERT INTO taptime_server.platform_operators(id,issuer,subject) VALUES($1,$2,'race')`,[operator,issuer]);
      const competing=second.query(`INSERT INTO taptime_server.identity_bindings(id,user_id,issuer,subject)
        VALUES(gen_random_uuid(),$1,$2,'race')`,[ids.employeeA,issuer]).then(()=>null,e=>e as {code:string});
      const deadline=Date.now()+2_000;
      let blocked=false;
      while (Date.now()<deadline) {
        blocked=(await pool.query(`SELECT wait_event_type='Lock' blocked FROM pg_stat_activity WHERE pid=$1`,[pid])).rows[0]?.blocked===true;
        if (blocked) break;
        await new Promise(resolve=>setTimeout(resolve,10));
      }
      expect(blocked,'Competing identity must wait for the authority transaction').toBe(true);
      await first.query('COMMIT');
      expect((await competing)?.code).toBe(isolation==='REPEATABLE READ'?'40001':'23514');
      await second.query('ROLLBACK');
    } finally {await first.query('ROLLBACK');await second.query('ROLLBACK');first.release();second.release();}
  });
  it('forces RLS on every application table and keeps the capability unprivileged', async () => {
    const tables = await pool.query(`SELECT relname FROM pg_class JOIN pg_namespace n ON n.oid=relnamespace
      WHERE n.nspname='taptime_server' AND relkind='r' AND NOT (relrowsecurity AND relforcerowsecurity)`);
    expect(tables.rows).toEqual([]);
    const role = await pool.query(`SELECT rolcanlogin, rolsuper, rolbypassrls FROM pg_roles
      WHERE rolname='taptime_platform_operator'`);
    expect(role.rows).toEqual([{ rolcanlogin:false, rolsuper:false, rolbypassrls:false }]);
  });

  it('rejects granting an operator who already has an active membership', async () => {
    // D-074: identity cannot gain a second authority even through a root grant.
    await expect(pool.query(`INSERT INTO taptime_server.platform_operators(id,issuer,subject)
      VALUES($1,$2,'employee-a')`, [operator,issuer])).rejects.toMatchObject({ code:'23514' });
  });

  it('rejects membership creation for an active operator and allows it after revocation', async () => {
    await pool.query(`UPDATE taptime_server.memberships SET revoked_at=now(),row_version=row_version+1 WHERE user_id=$1`, [ids.employeeA]);
    await pool.query(`INSERT INTO taptime_server.platform_operators(id,issuer,subject)
      VALUES($1,$2,'employee-a')`, [operator,issuer]);
    await expect(pool.query(`INSERT INTO taptime_server.memberships(id,organization_id,user_id,role)
      VALUES(gen_random_uuid(),$1,$2,'employee')`, [ids.organizationB,ids.employeeA]))
      .rejects.toMatchObject({ code:'23514' });
    await pool.query(`UPDATE taptime_server.platform_operators SET revoked_at=now() WHERE id=$1`, [operator]);
    await expect(pool.query(`INSERT INTO taptime_server.memberships(id,organization_id,user_id,role)
      VALUES(gen_random_uuid(),$1,$2,'employee')`, [ids.organizationB,ids.employeeA])).resolves.toBeDefined();
  });

  it('also rejects the identity-binding-last path and operator reactivation', async () => {
    await pool.query(`INSERT INTO taptime_server.platform_operators(id,issuer,subject) VALUES($1,$2,'new-account')`,
      [operator,issuer]);
    await expect(pool.query(`INSERT INTO taptime_server.identity_bindings(id,user_id,issuer,subject)
      VALUES(gen_random_uuid(),$1,$2,'new-account')`, [ids.employeeA,issuer]))
      .rejects.toMatchObject({ code:'23514' });
    await pool.query(`UPDATE taptime_server.platform_operators SET revoked_at=now() WHERE id=$1`, [operator]);
    await pool.query(`INSERT INTO taptime_server.identity_bindings(id,user_id,issuer,subject)
      VALUES(gen_random_uuid(),$1,$2,'new-account')`, [ids.employeeA,issuer]);
    await expect(pool.query(`UPDATE taptime_server.platform_operators SET revoked_at=NULL WHERE id=$1`,
      [operator])).rejects.toMatchObject({ code:'23514' });
  });

  it('preserves every audit event, including root actions, against update/delete', async () => {
    await pool.query(`INSERT INTO taptime_server.platform_audit_events(operator_principal,action)
      VALUES('root@test','operator_granted')`);
    await expect(pool.query(`UPDATE taptime_server.platform_audit_events SET action='changed'`))
      .rejects.toMatchObject({ code:'42501' });
    await expect(pool.query(`DELETE FROM taptime_server.platform_audit_events`))
      .rejects.toMatchObject({ code:'42501' });
  });

  it('starts existing organizations active and rejects inconsistent pause metadata', async () => {
    const result = await pool.query(`SELECT status,paused_at,pause_reason FROM taptime_server.organizations`);
    expect(result.rows.every(r => r.status==='active' && r.paused_at===null && r.pause_reason===null)).toBe(true);
    await expect(pool.query(`UPDATE taptime_server.organizations SET status='paused'`))
      .rejects.toMatchObject({ code:'23514' });
  });
});
