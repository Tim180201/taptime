import { randomUUID } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { applyMigrationSet, loadMigrations } from '../src/index.js';
import { closePoolAndDropTestDatabase } from './support/postgresTestDatabaseCleanup.mjs';

const connectionString = process.env.B3_DATABASE_URL ?? 'postgresql://timbartz@127.0.0.1:5432/taptime_b3';
const installer = new Pool({ connectionString, max: 1 });
const databaseName = `t116b_sort_${randomUUID().replaceAll('-', '')}`;
const url = new URL(connectionString); url.pathname = `/${databaseName}`;
const pool = new Pool({ connectionString: url.href, max: 1 });
const org = randomUUID(), admin = randomUUID(), membership = randomUUID();
const names = ['Ärztehaus', 'Özdemir', 'Abel', 'Zander'];
const expected = ['Abel', 'Ärztehaus', 'Özdemir', 'Zander'];
const customers = names.map(name => ({ name, id: randomUUID() }));
const people = names.map((name, i) => ({ name, user: i === 0 ? admin : randomUUID(), id: i === 0 ? membership : randomUUID() }));
const from = '2026-09-30T22:00:00Z', to = '2026-10-31T23:00:00Z';
let created = false;
beforeAll(async () => {
  await installer.query(`CREATE DATABASE "${databaseName}" TEMPLATE template0 ENCODING 'UTF8'`); created = true;
  await applyMigrationSet(pool, await loadMigrations());
  await pool.query("INSERT INTO taptime_server.organizations(id,name) VALUES($1,'Sortiertest')", [org]);
  for (const person of people) {
    await pool.query('INSERT INTO taptime_server.users(id) VALUES($1)', [person.user]);
    await pool.query('INSERT INTO taptime_server.memberships(id,organization_id,user_id,role,display_name) VALUES($1,$2,$3,$4,$5)',
      [person.id, org, person.user, person.user === admin ? 'administrator' : 'employee', person.name]);
  }
  for (const customer of customers) {
    await pool.query('INSERT INTO taptime_server.customers(id,organization_id,display_name,active,activated_at) VALUES($1,$2,$3,true,transaction_timestamp())', [customer.id, org, customer.name]);
    for (const person of people) await pool.query(`INSERT INTO taptime_server.time_record_revisions
      (organization_id,time_record_id,revision_number,user_id,target_type,target_customer_id,effective_started_at,effective_stopped_at,base_row_version,actor_user_id,actor_membership_id,reason,command_id,request_hash)
      VALUES($1,gen_random_uuid(),1,$2,'customer',$3,'2026-10-01T08:00:00Z','2026-10-01T09:00:00Z',0,$4,$5,'Test',gen_random_uuid(),repeat('a',64))`, [org, person.user, customer.id, admin, membership]);
  }
});
afterAll(async () => {
  if (created) await closePoolAndDropTestDatabase({ targetPool: pool, installerPool: installer, databaseName });
  else await pool.end();
  await installer.end();
});
async function asRole(role: string, run: (client: PoolClient) => Promise<void>) {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    await c.query("SELECT set_config('app.organization_id',$1,true),set_config('app.user_id',$2,true),set_config('app.membership_id',$3,true),set_config('app.membership_role','administrator',true)", [org, admin, membership]);
    await c.query(`SET LOCAL ROLE ${role}`);
    await run(c);
  } finally { await c.query('ROLLBACK'); c.release(); }
}
for (const version of [3, 4]) for (const paginate of [false, true]) {
  it(`T116b people v${version}: ICU order ${paginate ? 'across cursor boundaries' : 'in one page'}`, () => asRole('taptime_membership_manager', async c => {
    const found: string[] = []; let cursor: string | null = null;
    do {
      const page: { result_status: string; membership_id: string; membership_display_name: string }[] = (await c.query(`SELECT * FROM taptime_server.read_managed_active_summary_v${version}(NULL,NULL,$1,$2${version === 4 ? ',$3,$4' : ''})`,
        version === 4 ? [cursor, paginate ? 1 : 20, from, to] : [cursor, paginate ? 1 : 20])).rows;
      expect(page.every(row => row.result_status === 'succeeded')).toBe(true);
      const rows = page.filter(row => row.membership_id).slice(0, paginate ? 1 : 20);
      found.push(...rows.map(row => row.membership_display_name));
      cursor = paginate && page.length > 1 ? rows[0]!.membership_id : null;
      if (found.length > people.length) throw new Error('Cursor did not advance');
    } while (cursor !== null);
    expect(found).toEqual(expected);
  }));
}
it('T116b customer hours sorts both customers and their people with ICU', () => asRole('taptime_mobile_own_time_reader', async c => {
  const rows = (await c.query('SELECT taptime_server.read_customer_hours_v1($1,$2) AS result', [from, to])).rows[0].result.customers;
  expect.soft(rows.map((row: { displayName: string }) => row.displayName)).toEqual(expected);
  for (const row of rows) expect.soft(row.people.map((person: { displayName: string }) => person.displayName)).toEqual(expected);
}));
for (const paginate of [false, true]) it(`T116b targets: ICU order ${paginate ? 'across cursor boundaries' : 'in one page'}`, () => asRole('taptime_mobile_target_reader', async c => {
  const found: string[] = []; let cursor: { display_name: string; target_id: string } | null = null;
  do {
    const rows: { target_type: string; display_name: string; target_id: string }[] = (await c.query('SELECT * FROM taptime_server.read_mobile_work_targets_v1($1,$2,$3,$4,$5,$6,$7)',
      [org, admin, membership, cursor ? 1 : null, cursor?.display_name ?? null, cursor?.target_id ?? null, paginate ? 1 : 51])).rows;
    const customers = rows.filter(row => row.target_type === 'customer');
    found.push(...customers.map(row => row.display_name));
    cursor = paginate && customers.length ? customers.at(-1)! : null;
    if (found.length > names.length) throw new Error('Cursor did not advance');
  } while (cursor !== null);
  expect(found).toEqual(expected);
}));
