import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Pool, type PoolClient } from 'pg';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { applyMigrationSet, loadMigrations } from '../../backend-schema/src/index.js';
import { closePoolAndDropTestDatabase } from '../../backend-schema/tests/support/postgresTestDatabaseCleanup.mjs';
import { seedDa2, ids } from '../../backend-time-export/tests/fixtures.js';
import * as oldSetup from './fixtures/t137SetupPredecessor.js';

const installerUrl = process.env.B3_DATABASE_URL ?? 'postgresql://timbartz@127.0.0.1:5432/taptime_b3';
const installer = new Pool({ connectionString: installerUrl, max: 1 });
const databaseName = `t137_${randomUUID().replaceAll('-', '')}`;
const url = new URL(installerUrl); url.pathname = `/${databaseName}`;
const db = new Pool({ connectionString: url.href, max: 1 });
let created = false;
const north = randomUUID(), south = randomUUID(), empty = randomUUID(), archived = randomUUID();
const recovered = randomUUID(), voided = randomUUID();
const manager = { user: randomUUID(), member: randomUUID(), role: 'standortleitung', org: ids.organizationA };
const former = { user: randomUUID(), member: randomUUID(), role: 'employee', org: ids.organizationA };
const admin = { user: ids.adminA, member: ids.membershipAdminA, role: 'administrator', org: ids.organizationA };
const employee = { user: ids.employeeA, member: ids.membershipEmployeeA, role: 'employee', org: ids.organizationA };
const foreign = { user: ids.adminB, member: ids.membershipAdminB, role: 'administrator', org: ids.organizationB };
interface Actor { user: string; member: string; role: string; org: string }
const actors: Actor[] = [admin, manager, employee, former, foreign];
const from = '2026-06-30T22:00Z', to = '2026-07-31T22:00Z';

beforeAll(async () => {
  await installer.query(`CREATE DATABASE "${databaseName}" TEMPLATE template0 ENCODING 'UTF8'`); created = true;
  await applyMigrationSet(db, (await loadMigrations()).filter(m => m.version < '067'));
  await seedDa2(db);
  const pause = randomUUID(), pauseStart = randomUUID(), pauseStop = randomUUID();
  const pauseClient = await db.connect();
  try {
    await pauseClient.query('BEGIN');
    for (const [event, at] of [[pauseStart, '2026-07-21T08:10Z'], [pauseStop, '2026-07-21T08:20Z']])
      await pauseClient.query(`INSERT INTO taptime_server.work_events(id,organization_id,triggered_by_user_id,occurred_at,subject_type,trigger_type,content_hash,content_hash_algorithm,content_hash_version)
        VALUES($1,$2,$3,$4,'break','manual',repeat('a',64),'sha256',3)`, [event, ids.organizationA, employee.user, at]);
    await pauseClient.query(`INSERT INTO taptime_server.break_intervals(id,organization_id,user_id,time_entry_id,status,start_work_event_id,started_at,started_via)
      VALUES($1,$2,$3,$4,'started',$5,'2026-07-21T08:10Z','manual')`, [pause, ids.organizationA, employee.user, ids.stoppedEntryA, pauseStart]);
    await pauseClient.query(`INSERT INTO taptime_server.canonical_decisions(work_event_id,organization_id,actor_user_id,subject_type,decision_type,time_entry_id,break_interval_id,engine_version,decision_payload)
      VALUES($1,$2,$3,'break','break_started',$4,$5,'test','{}')`, [pauseStart, ids.organizationA, employee.user, ids.stoppedEntryA, pause]);
    await pauseClient.query('COMMIT');
    await pauseClient.query('BEGIN');
    await pauseClient.query(`UPDATE taptime_server.break_intervals SET status='stopped',stop_work_event_id=$1,stopped_at='2026-07-21T08:20Z',stopped_via='manual',row_version=row_version+1 WHERE id=$2`, [pauseStop, pause]);
    await pauseClient.query(`INSERT INTO taptime_server.canonical_decisions(work_event_id,organization_id,actor_user_id,subject_type,decision_type,time_entry_id,break_interval_id,engine_version,decision_payload)
      VALUES($1,$2,$3,'break','break_stopped',$4,$5,'test','{}')`, [pauseStop, ids.organizationA, employee.user, ids.stoppedEntryA, pause]);
    await pauseClient.query('COMMIT');
  } finally { pauseClient.release(); }
  await db.query(`INSERT INTO taptime_server.locations(id,organization_id,display_name) VALUES($1,$3,'Nord'),($2,$3,'Süd')`, [north, south, ids.organizationA]);
  for (const actor of [manager, former]) {
    await db.query('INSERT INTO taptime_server.users(id) VALUES($1)', [actor.user]);
    await db.query(`INSERT INTO taptime_server.memberships(id,organization_id,user_id,role,display_name,created_at)
      VALUES($1,$2,$3,$4,'Synthetisch','2020-01-01T00:00Z')`, [actor.member, actor.org, actor.user, actor.role]);
  }
  for (const [member, location] of [[admin.member, north], [manager.member, north], [employee.member, south], [ids.membershipEmployeeA2, south], [former.member, north]])
    await db.query(`INSERT INTO taptime_server.membership_home_location_assignments(id,organization_id,membership_id,location_id,assigned_at)
      VALUES(gen_random_uuid(),$1,$2,$3,'2026-01-01T00:00Z')`, [ids.organizationA, member, location]);
  await db.query(`INSERT INTO taptime_server.membership_management_location_grants(id,organization_id,membership_id,location_id)
    VALUES(gen_random_uuid(),$1,$2,$3)`, [ids.organizationA, manager.member, north]);
  for (const [customer, name] of [[empty, 'Ähre'], [archived, 'Ähre']]) await db.query(`INSERT INTO taptime_server.customers(id,organization_id,display_name,active,activated_at)
    VALUES($1,$2,$3,true,'2026-01-01T00:00Z')`, [customer, ids.organizationA, name]);
  for (const [customer, location] of [[ids.customerA, north], [empty, south], [archived, north]])
    await db.query(`INSERT INTO taptime_server.work_target_location_assignments(id,organization_id,target_type,target_id,location_id,assigned_at)
      VALUES(gen_random_uuid(),$1,'customer',$2,$3,'2026-01-01T00:00Z')`, [ids.organizationA, customer, location]);
  // A cross-home contributor is visible in customer detail/status; an expired former
  // person is still visible by home, but cannot authorize new actor reads.
  for (const [record, user, target] of [[recovered, former.user, archived], [voided, employee.user, empty]])
    await db.query(`INSERT INTO taptime_server.time_record_revisions(organization_id,time_record_id,revision_number,user_id,target_type,target_customer_id,
      effective_started_at,effective_stopped_at,base_row_version,actor_user_id,actor_membership_id,reason,command_id,request_hash)
      VALUES($1,$2,1,$3,'customer',$4,'2026-07-31T21:59:59.999Z','2026-07-31T22:59:59.999Z',0,$5,$6,'Synthetisch',gen_random_uuid(),repeat('a',64))`,
    [ids.organizationA, record, user, target, admin.user, admin.member]);
  await db.query(`INSERT INTO taptime_server.time_record_revisions(organization_id,time_record_id,revision_number,previous_revision_number,user_id,target_type,target_customer_id,
    effective_started_at,effective_stopped_at,base_row_version,actor_user_id,actor_membership_id,reason,command_id,request_hash)
    VALUES($1,$2,2,1,$3,'customer',$4,'2026-07-01T08:00Z','2026-07-01T09:00Z',0,$5,$6,'Neueste Fassung',gen_random_uuid(),repeat('a',64))`,
  [ids.organizationA, recovered, former.user, archived, admin.user, admin.member]);
  await db.query(`UPDATE taptime_server.customers SET active=false,deactivated_at=clock_timestamp(),row_version=row_version+1 WHERE id=$1`, [archived]);
  await db.query(`UPDATE taptime_server.memberships SET revoked_at='2026-08-01T00:00Z',row_version=row_version+1 WHERE id=$1`, [former.member]);
  for (const [customer, minutes] of [[ids.customerA, 60], [archived, 60], [empty, 30]])
    await db.query(`INSERT INTO taptime_server.customer_quota_settings(organization_id,customer_id,minutes,set_at,actor_membership_id,actor_role,command_id)
      VALUES($1,$2,$3,'2026-07-01T00:00Z',$4,'administrator',gen_random_uuid())`, [ids.organizationA, customer, minutes, admin.member]);
  await db.query(`INSERT INTO taptime_server.customer_quota_settings(organization_id,customer_id,minutes,set_at,actor_membership_id,actor_role,command_id)
    VALUES($1,$2,NULL,'2026-07-01T00:00Z',$3,'administrator',gen_random_uuid())`, [ids.organizationA, empty, admin.member]);
  const c = await db.connect();
  try {
    await c.query('BEGIN');
    await context(c, admin, 'taptime_time_review_writer');
    await c.query('RESET ROLE');
    await c.query(`INSERT INTO taptime_server.time_record_voids(organization_id,time_record_id,reason_code,actor_membership_id,actor_role,command_id,user_id,target_type,target_id,started_at,stopped_at)
      VALUES($1,$2,'duplicate',$3,'administrator',gen_random_uuid(),$4,'customer',$5,'2026-07-31T21:59:59.999Z','2026-07-31T22:59:59.999Z')`,
    [ids.organizationA, voided, admin.member, employee.user, empty]);
    await c.query('COMMIT');
  } finally { c.release(); }
  await db.query('UPDATE taptime_server.organizations SET locations_enabled=true,row_version=row_version+1 WHERE id=$1', [ids.organizationA]);
});
afterAll(async () => {
  if (created) await closePoolAndDropTestDatabase({ targetPool: db, installerPool: installer, databaseName });
  else await db.end();
  await installer.end();
});
async function context(c: PoolClient, actor: Actor, role: string) {
  await c.query('RESET ROLE');
  await c.query("SELECT set_config('app.organization_id',$1,true),set_config('app.user_id',$2,true),set_config('app.membership_id',$3,true),set_config('app.membership_role',$4,true)",
    [actor.org, actor.user, actor.member, actor.role]);
  await c.query(`SET LOCAL ROLE ${role}`);
}
async function invoke(c: PoolClient, sql: string, params: unknown[]) {
  await c.query('SAVEPOINT invocation');
  try { return (await c.query(sql, params)).rows; }
  catch (error) { await c.query('ROLLBACK TO invocation'); return { error: (error as { code: string }).code }; }
  finally { await c.query('RELEASE invocation'); }
}
async function snapshot(c: PoolClient, setup: { initial: string; tags: string }) {
  const results: Record<string, unknown> = {};
  for (const actor of actors) {
    await context(c, actor, 'taptime_mobile_own_time_reader');
    for (const limit of [1, 3, 51]) for (const search of [null, 'Ä', 'missing']) for (const after of [null, archived])
      results[`${actor.member}/month/${limit}/${search}/${after}`] = await invoke(c, 'SELECT taptime_server.read_customer_hours_v3($1,$2,$3,$4,$5,$6) result', [from, to, search, after ? 'Ähre' : null, after, limit]);
    for (const limit of [1, 51]) for (const after of [null, archived])
      results[`${actor.member}/quota/${limit}/${after}`] = await invoke(c, 'SELECT taptime_server.read_customer_quota_alerts_v1($1,$2,$3,$4,$5) result', [from, to, after ? 'Ähre' : null, after, limit]);
    await context(c, actor, 'taptime_membership_manager');
    for (const members of [[], [employee.member, former.member, foreign.member, randomUUID()]])
      results[`${actor.member}/archive/${members.length}`] = await invoke(c, 'SELECT * FROM taptime_server.read_archive_status_v1($1,$2,$3)', [members, [ids.customerA, archived, empty, ids.customerB], []]);
    await context(c, actor, 'taptime_server_lifecycle');
    for (const entry of [ids.stoppedEntryA, ids.activeEntryA, ids.activeEntryB, null])
      results[`${actor.member}/lock/${entry}`] = await invoke(c, 'SELECT taptime_server.lock_screen_archive_status_v1($1)', [entry]);
    await context(c, actor, 'taptime_admin_setup');
    for (const kind of [null, 0, 1]) for (const limit of [1, 21])
      results[`${actor.member}/setup/${kind}/${limit}`] = await invoke(c, setup.initial, [actor.org, kind, kind === 0 ? ids.customerA : ids.tagA, limit]);
    for (const search of [null, 'Nord', 'missing']) for (const limit of [1, 51])
      results[`${actor.member}/tags/${search}/${limit}`] = await invoke(c, setup.tags, [actor.org, search, null, null, limit]);
  }
  await c.query('RESET ROLE'); return results;
}
it('T137 preserves every changed read, ordering, role and tenant result on identical data and transaction time', async () => {
  const c = await db.connect();
  try {
    await c.query('BEGIN');
    const before = await snapshot(c, oldSetup);
    expect((before[`${admin.member}/month/51/null/null`] as any)[0].result.customers.length).toBeGreaterThan(1);
    expect((before[`${manager.member}/archive/4`] as any).some((r: any) => r.entity_id === employee.member)).toBe(true);
    const migration = (await loadMigrations()).find(m => m.version === '067'); expect(migration).toBeDefined();
    await c.query(migration!.sql);
    const source = await readFile(new URL('../../backend-administration/src/AdminWriteSessionCoordinator.ts', import.meta.url), 'utf8');
    const setup = {
      initial: source.match(/`(WITH setup_items AS \([\s\S]*?LIMIT \$4)`/)![1]!,
      tags: source.match(/: `\s*(SELECT 1 AS kind_order,tag.id,[\s\S]*?LIMIT \$5)`/)![1]!,
    };
    expect(await snapshot(c, setup)).toEqual(before);
  } finally { await c.query('ROLLBACK'); c.release(); }
});
