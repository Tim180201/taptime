import { randomUUID } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { applyMigrationSet, loadMigrations } from '../../backend-schema/src/index.js';
import { closePoolAndDropTestDatabase } from '../../backend-schema/tests/support/postgresTestDatabaseCleanup.mjs';
import { TIME_ENTRY_EXPORT_MAXIMUM_ROWS, TIME_ENTRY_EXPORT_MAXIMUM_BYTES } from '@taptime/time-entry-export-contract';
import { AdministrationStopCoordinator } from '../../backend-time-review/src/AdministrationStopCoordinator.js';
import { TimeEntryExportCoordinator } from '../../backend-time-export/src/TimeEntryExportCoordinator.js';
import { seedDa2, ids, insertBulkStoppedEntries, verifier, tokens } from '../../backend-time-export/tests/fixtures.js';

const installerUrl = process.env.B3_DATABASE_URL ?? 'postgresql://timbartz@127.0.0.1:5432/taptime_b3';
const installer = new Pool({ connectionString: installerUrl, max: 1 });
const databaseName = `t099b_${randomUUID().replaceAll('-', '')}`;
const url = new URL(installerUrl); url.pathname = `/${databaseName}`;
const db = new Pool({ connectionString: url.href, max: 2 });
const login = `t099b_export_${randomUUID().replaceAll('-', '')}`;
const runtimeUrl = new URL(url); runtimeUrl.username = login; runtimeUrl.password = randomUUID();
const runtime = new Pool({ connectionString: runtimeUrl.href, max: 1, application_name: login });
const exporter = new TimeEntryExportCoordinator(runtime, verifier);
let created = false;
const north = randomUUID(), south = randomUUID(), recovered = randomUUID(), voided = randomUUID();
const manager = { user: randomUUID(), member: randomUUID(), role: 'standortleitung' };
const former = { user: randomUUID(), member: randomUUID(), role: 'employee' };
const actors = [
  { user: ids.adminA, member: ids.membershipAdminA, role: 'administrator' },
  { user: ids.employeeA, member: ids.membershipEmployeeA, role: 'employee' },
  manager, former,
  { user: ids.adminB, member: ids.membershipAdminB, role: 'administrator', foreign: true },
];
const from = '2026-06-30T22:00:00.000Z', to = '2026-07-31T22:00:00.000Z';
const auditId = randomUUID();
const requested = [ids.stoppedEntryA, ids.activeEntryA, ids.activeEntryB, recovered, voided];


async function seedPause(entry: string, start: string, stop: string) {
  const c = await db.connect(), pause = randomUUID(), a = randomUUID(), b = randomUUID();
  try {
    await c.query('BEGIN');
    for (const [event, at] of [[a, start], [b, stop]]) await c.query(`INSERT INTO taptime_server.work_events
      (id,organization_id,triggered_by_user_id,occurred_at,subject_type,trigger_type,content_hash,content_hash_algorithm,content_hash_version)
      VALUES($1,$2,$3,$4,'break','manual',repeat('a',64),'sha256',3)`, [event, ids.organizationA, ids.employeeA, at]);
    await c.query(`INSERT INTO taptime_server.break_intervals(id,organization_id,user_id,time_entry_id,status,start_work_event_id,started_at,started_via)
      VALUES($1,$2,$3,$4,'started',$5,$6,'manual')`, [pause, ids.organizationA, ids.employeeA, entry, a, start]);
    await c.query(`INSERT INTO taptime_server.canonical_decisions(work_event_id,organization_id,actor_user_id,subject_type,decision_type,time_entry_id,break_interval_id,engine_version,decision_payload)
      VALUES($1,$2,$3,'break','break_started',$4,$5,'test','{}')`, [a, ids.organizationA, ids.employeeA, entry, pause]);
    await c.query('COMMIT');
    await c.query('BEGIN');
    await c.query("UPDATE taptime_server.break_intervals SET status='stopped',stop_work_event_id=$1,stopped_at=$2,stopped_via='manual',row_version=row_version+1 WHERE id=$3", [b, stop, pause]);
    await c.query(`INSERT INTO taptime_server.canonical_decisions(work_event_id,organization_id,actor_user_id,subject_type,decision_type,time_entry_id,break_interval_id,engine_version,decision_payload)
      VALUES($1,$2,$3,'break','break_stopped',$4,$5,'test','{}')`, [b, ids.organizationA, ids.employeeA, entry, pause]);
    await c.query('COMMIT');
  } catch (error) { await c.query('ROLLBACK'); throw error; }
  finally { c.release(); }
}

beforeAll(async () => {
  await installer.query(`CREATE DATABASE "${databaseName}" TEMPLATE template0 ENCODING 'UTF8'`); created = true;
  const migrations = await loadMigrations();
  await applyMigrationSet(db, migrations.filter(m => m.version < '063'));
  await db.query(`CREATE ROLE ${login} LOGIN NOINHERIT PASSWORD '${runtimeUrl.password}'`);
  await db.query(`GRANT taptime_identity_resolver,taptime_time_exporter TO ${login}`);
  await seedDa2(db);
  expect(await new AdministrationStopCoordinator(db,verifier).execute(tokens.adminA, {
    expectedMembershipId:ids.membershipAdminA,targetMembershipId:ids.membershipEmployeeA2,
    timeRecordId:ids.activeEntryA,expectedRowVersion:1,commandId:randomUUID(),
    stoppedAt:'2026-07-21T12:00:00.000Z',reason:'Fixture Verwaltungsstopp',
  })).toMatchObject({status:'committed'});
  await db.query(`INSERT INTO taptime_server.locations(id,organization_id,display_name) VALUES($1,$3,'Nord'),($2,$3,'Süd')`, [north, south, ids.organizationA]);
  for (const person of [manager, former]) {
    await db.query('INSERT INTO taptime_server.users(id) VALUES($1)', [person.user]);
    await db.query(`INSERT INTO taptime_server.memberships(id,organization_id,user_id,role,display_name,created_at)
      VALUES($1,$2,$3,$4,'Synthetisch',transaction_timestamp()-interval '1 year')`, [person.member, ids.organizationA, person.user, person.role]);
  }
  for (const [member, location] of [[ids.membershipAdminA, north], [manager.member, north], [ids.membershipEmployeeA, north], [ids.membershipEmployeeA2, south], [former.member, north]]) {
    await db.query(`INSERT INTO taptime_server.membership_home_location_assignments(id,organization_id,membership_id,location_id,assigned_at)
      VALUES(gen_random_uuid(),$1,$2,$3,transaction_timestamp()-interval '1 year')`, [ids.organizationA, member, location]);
  }
  await db.query(`INSERT INTO taptime_server.membership_management_location_grants(id,organization_id,membership_id,location_id)
    VALUES(gen_random_uuid(),$1,$2,$3)`, [ids.organizationA, manager.member, north]);
  await db.query(`INSERT INTO taptime_server.work_target_location_assignments(id,organization_id,target_type,target_id,location_id)
    VALUES(gen_random_uuid(),$1,'customer',$2,$3)`, [ids.organizationA, ids.customerA, north]);
  await db.query('UPDATE taptime_server.organizations SET locations_enabled=true,row_version=row_version+1 WHERE id=$1', [ids.organizationA]);
  await seedPause(ids.stoppedEntryA, '2026-07-21T08:10Z', '2026-07-21T08:20Z');
  for (const [record, user, canonical] of [[ids.stoppedEntryA, ids.employeeA, ids.stoppedEntryA], [recovered, former.user, null], [voided, ids.employeeA, null]]) {
    for (const [revision, start] of [[1, '2026-07-21T08:05Z'], [2, '2026-07-31T22:00Z'], [3, '2026-07-31T21:59:59.999Z']] as const) {
      await db.query(`INSERT INTO taptime_server.time_record_revisions(organization_id,time_record_id,revision_number,previous_revision_number,canonical_time_entry_id,user_id,target_type,target_customer_id,
        effective_started_at,effective_stopped_at,base_row_version,actor_user_id,actor_membership_id,reason,command_id,request_hash)
        VALUES($1,$2,$3,$4,$5,$6,'customer',$7,$8::timestamptz,$8::timestamptz+interval '1 hour',CASE WHEN $5::uuid IS NULL THEN 0 ELSE 2 END,$9,$10,'Fixture',gen_random_uuid(),repeat('a',64))`,
      [ids.organizationA, record, revision, revision === 1 ? null : revision - 1, canonical, user, ids.customerA, canonical && revision === 3 ? '2026-07-21T08:15Z' : start, ids.adminA, ids.membershipAdminA]);
    }
  }
  await db.query(`INSERT INTO taptime_server.time_record_origins(organization_id,time_record_id,origin,created_by)
    VALUES($1,$2,'backfilled','administration')`, [ids.organizationA,recovered]);
  await db.query(`INSERT INTO taptime_server.time_record_comments
    (organization_id,time_record_id,comment_number,user_id,actor_membership_id,comment,command_id)
    VALUES($1,$2,1,$3,$4,'Vorher',gen_random_uuid()),
          ($1,$2,2,$3,$4,'Aktuell; "Übung"',gen_random_uuid()),
          ($5,$2,3,$6,$7,'Fremder Kommentar',gen_random_uuid())`,
    [ids.organizationA,ids.stoppedEntryA,ids.adminA,ids.membershipAdminA,ids.organizationB,ids.adminB,ids.membershipAdminB]);
  const voidClient = await db.connect();
  try {
    await voidClient.query('BEGIN');
    await voidClient.query("SELECT set_config('app.organization_id',$1,true),set_config('app.user_id',$2,true),set_config('app.membership_id',$3,true),set_config('app.membership_role','administrator',true)", [ids.organizationA, ids.adminA, ids.membershipAdminA]);
  await voidClient.query(`INSERT INTO taptime_server.time_record_voids(organization_id,time_record_id,reason_code,actor_membership_id,actor_role,command_id,user_id,target_type,target_id,started_at,stopped_at)
    VALUES($1,$2,'duplicate',$3,'administrator',gen_random_uuid(),$4,'customer',$5,'2026-07-31T21:59:59.999Z','2026-07-31T22:59:59.999Z')`,
  [ids.organizationA, voided, ids.membershipAdminA, ids.employeeA, ids.customerA]);
    await voidClient.query('COMMIT');
  } catch (error) { await voidClient.query('ROLLBACK'); throw error; }
  finally { voidClient.release(); }
  await db.query(`UPDATE taptime_server.memberships SET revoked_at=transaction_timestamp()-interval '1 day',row_version=row_version+1 WHERE id=$1`, [former.member]);
  await db.query('ANALYZE');
});
afterAll(async () => {
  await runtime.end();
  if (created) await closePoolAndDropTestDatabase({ targetPool: db, installerPool: installer, databaseName });
  else await db.end();
  if (created) await installer.query(`DROP ROLE IF EXISTS ${login}`);
  await installer.end();
});

async function snapshot(c: PoolClient, migrated = false) {
  const result: Record<string, unknown> = {};
  for (const version of [1, 2]) result[`view${version}`] = (await c.query(`SELECT * FROM taptime_server.effective_time_records_v${version} ORDER BY organization_id,time_record_id`)).rows;
  for (const actor of actors) for (const role of ['taptime_time_review_reader', 'taptime_membership_manager', 'taptime_mobile_own_time_reader', 'taptime_time_exporter']) {
    await c.query('RESET ROLE');
    const org = 'foreign' in actor ? ids.organizationB : ids.organizationA;
    await c.query("SELECT set_config('app.organization_id',$1,true),set_config('app.user_id',$2,true),set_config('app.membership_id',$3,true),set_config('app.membership_role',$4,true)", [org, actor.user, actor.member, actor.role]);
    await c.query(`SET LOCAL ROLE ${role}`);
    const calls: [string, unknown[]][] = role === 'taptime_time_review_reader'
      ? [1, 2].map(v => [`SELECT * FROM taptime_server.read_effective_time_records_v${v}($1,$2,$3,$4,$5,NULL,NULL,101)`, [org, actor.user, actor.member, from, to]])
      : role === 'taptime_time_exporter'
        ? [
          ...[1, 2, 3].map(v => [`SELECT * FROM taptime_server.read_effective_time_entry_export_v${v}($1,$2,$3,10001)`, [org, from, to]] as [string, unknown[]]),
          ...[1, 2, 3, 4].map(v => [`SELECT taptime_server.append_time_entry_export_audit_v${v}($1,$2,$3,$4,$5,$6,1,1000,$7)`, [auditId, org, actor.user, auditId, from, to, 'a'.repeat(64)]] as [string, unknown[]]),
          ['SELECT * FROM taptime_server.read_time_record_export_details_v1($1)', [requested]],
          [migrated ? `SELECT entry.organization_id, entry.time_entry_id, entry.employee_membership_id,
              entry.employee_display_name, entry.target_type, entry.target_display_name, entry.status,
              entry.started_via, entry.stopped_via, entry.started_at, entry.stopped_at,
              entry.break_duration_seconds, entry.effective_work_duration_seconds, entry.effective_revision_number,
              jsonb_build_object('origin',entry.origin,'changed',entry.changed,'comment',entry.comment) AS details
            FROM taptime_server.read_effective_time_entry_export_v4($1,$2,$3,10001) entry`
            : `SELECT entry.*, details.details FROM taptime_server.read_effective_time_entry_export_v3($1,$2,$3,10001) entry
               LEFT JOIN LATERAL taptime_server.read_time_record_export_details_v1(ARRAY[entry.time_entry_id]) details ON true`, [org,from,to]],
        ]
        : [
          ['SELECT * FROM taptime_server.read_time_record_calendar_v1($1)', [requested]],
          ['SELECT * FROM taptime_server.read_time_record_details_v1($1)', [requested]],
          ...(role === 'taptime_mobile_own_time_reader' ? [
            ['SELECT taptime_server.read_customer_hours_v1($1,$2)', [from, to]],
            ['SELECT taptime_server.read_customer_hours_v2($1,$2)', [from, to]],
            ['SELECT taptime_server.read_customer_hours_v3($1,$2,NULL,NULL,NULL,51)', [from, to]],
            ['SELECT taptime_server.read_customer_quota_alerts_v1($1,$2,NULL,NULL,51)', [from, to]],
          ] as [string, unknown[]][] : []),
        ];
    for (const [sql, values] of calls) {
      await c.query('SAVEPOINT invocation');
      const key = `${actor.member}/${role}/${sql.includes('details.details') || sql.includes('read_effective_time_entry_export_v4') ? 'combined-v4' : sql}`;
      try {
        result[key] = (await c.query(sql, values)).rows.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
        if (sql.includes('append_time_entry_export_audit')) {
          await c.query('RESET ROLE');
          result[key] = (await c.query('SELECT * FROM taptime_server.audit_events WHERE id=$1', [auditId])).rows;
          await c.query('ROLLBACK TO invocation');
        }
      }
      catch (error) { result[key] = { errorCode: (error as { code?: string }).code }; await c.query('ROLLBACK TO invocation'); }
      await c.query('RELEASE invocation');
    }
  }
  await c.query('RESET ROLE');
  return result;
}

it('preserves predecessor results, role/tenant/home/departure scope, latest revisions, voids, recovered records and Berlin month edges', async () => {
  const c = await db.connect();
  try {
    await c.query('BEGIN');
    const before = await snapshot(c);
    expect((before.view2 as { time_record_id: string }[]).map(r => r.time_record_id).sort())
      .toEqual([ids.stoppedEntryA, ids.activeEntryA, ids.activeEntryB, recovered].sort());
    const managed = before[`${ids.membershipAdminA}/taptime_membership_manager/SELECT * FROM taptime_server.read_time_record_calendar_v1($1)`];
    expect(Array.isArray(managed)).toBe(true);
    expect((managed as {time_record_id:string;calendar:{breakDurationSeconds:number;workDurationSeconds:number}}[])
      .find(row => row.time_record_id === ids.stoppedEntryA)?.calendar)
      .toMatchObject({breakDurationSeconds:300,workDurationSeconds:3300});
    expect(before[`${ids.membershipAdminA}/taptime_time_exporter/combined-v4`])
      .toEqual(expect.arrayContaining([expect.objectContaining({time_entry_id:ids.activeEntryA,details:expect.objectContaining({changed:true})})]));
    expect(before[`${ids.membershipAdminA}/taptime_time_exporter/combined-v4`])
      .toEqual(expect.arrayContaining([
        expect.objectContaining({time_entry_id:ids.stoppedEntryA,details:expect.objectContaining({comment:'Aktuell; "Übung"'})}),
        expect.objectContaining({time_entry_id:recovered,details:expect.objectContaining({origin:'backfilled'})}),
      ]));
    const migration = (await loadMigrations()).find(m => m.version === '063');
    expect(migration).toBeDefined();
    await c.query(migration!.sql);
    expect(await snapshot(c, true)).toEqual(before);
    expect((await c.query('SELECT taptime_server.maximum_time_entry_export_rows_v1() AS rows,taptime_server.maximum_time_entry_export_bytes_v1() AS bytes')).rows)
      .toEqual([{rows:TIME_ENTRY_EXPORT_MAXIMUM_ROWS,bytes:TIME_ENTRY_EXPORT_MAXIMUM_BYTES}]);
    await c.query('COMMIT');
  } catch (error) { await c.query('ROLLBACK'); throw error; }
  finally { c.release(); }
});

it('keyed calendar work stays bounded when unrelated historical records and completed pauses grow', async () => {
  const c = await db.connect();
  const measure = async () => {
    await c.query('BEGIN');
    try {
      await c.query("SELECT set_config('app.organization_id',$1,true),set_config('app.user_id',$2,true),set_config('app.membership_id',$3,true),set_config('app.membership_role','employee',true)", [ids.organizationA, ids.employeeA, ids.membershipEmployeeA]);
      await c.query('SET LOCAL ROLE taptime_mobile_own_time_reader');
      const plan = (await c.query(`EXPLAIN (ANALYZE,BUFFERS,FORMAT JSON)
        SELECT * FROM taptime_server.read_time_record_calendar_v1($1)`, [[ids.stoppedEntryA]])).rows[0]['QUERY PLAN'][0].Plan;
      return plan['Shared Hit Blocks'] + plan['Shared Read Blocks'];
    } finally { await c.query('ROLLBACK'); }
  };
  try {
    const before = await measure();
    await insertBulkStoppedEntries(db, 2000, Date.parse('2026-06-01T00:00:00.000Z'));
    await db.query(`INSERT INTO taptime_server.time_record_revisions(organization_id,time_record_id,revision_number,user_id,target_type,target_customer_id,
      effective_started_at,effective_stopped_at,base_row_version,actor_user_id,actor_membership_id,reason,command_id,request_hash)
      SELECT $1,gen_random_uuid(),1,$2,'customer',$3,'2026-05-01T08:00Z'::timestamptz,'2026-05-01T09:00Z'::timestamptz,0,$4,$5,'Foreign history',gen_random_uuid(),repeat('a',64)
      FROM generate_series(1,2000)`, [ids.organizationB,ids.employeeB,ids.customerB,ids.adminB,ids.membershipAdminB]);
    const entries = (await db.query("SELECT id,started_at,stopped_at FROM taptime_server.time_entries WHERE id::text LIKE '61000000-%' ORDER BY id LIMIT 100")).rows;
    for (const entry of entries) await seedPause(entry.id, entry.started_at.toISOString(), entry.stopped_at.toISOString());
    await db.query('ANALYZE');
    const after = await measure();
    // Allow index height/cache-plan variation, not a scan proportional to the added history.
    expect(after).toBeLessThan(before * 3);
  } finally { c.release(); }
});


it('streams multiple bounded batches with exactly one CSV header and the same bytes as the existing byte consumer', async () => {
  const command = { accessToken: tokens.adminA, correlationId: randomUUID(), request: {
    expectedMembershipId: ids.membershipAdminA, fromInclusive: '2026-06-01T00:00:00.000Z', toExclusive: '2026-06-02T00:00:00.000Z',
  } };
  for (const version of [3, 4] as const) {
    const invoke = version === 3 ? exporter.exportTimeEntriesV3.bind(exporter) : exporter.exportTimeEntriesV4.bind(exporter);
    const buffered = await invoke(command);
    expect(buffered.status).toBe('succeeded');
    const streamed = await invoke({ ...command, correlationId: randomUUID() }, { streamResponse: true });
    expect(streamed.status).toBe('streaming');
    if (buffered.status !== 'succeeded' || streamed.status !== 'streaming') throw new Error('Export failed');
    const chunks: Buffer[] = [];
    for await (const chunk of streamed.stream) chunks.push(Buffer.from(chunk));
    expect(Buffer.concat(chunks)).toEqual(Buffer.from(buffered.bytes));
    expect(chunks.length).toBeGreaterThan(2);
    expect(chunks.every(chunk => chunk.length < buffered.byteCount)).toBe(true);
  }
});

it('releases an abandoned CSV stream on abort before its first read', async () => {
  const abort = new AbortController();
  const result = await exporter.exportTimeEntriesV4({accessToken:tokens.adminA,correlationId:randomUUID(),request:{
    expectedMembershipId:ids.membershipAdminA,fromInclusive:from,toExclusive:to,
  }},{streamResponse:true,signal:abort.signal});
  expect(result.status).toBe('streaming');
  if(result.status!=='streaming')throw new Error(result.status);
  const closed=new Promise<void>(resolve=>result.stream.once('close',resolve));
  abort.abort(); await closed;
  // Capacity cleanup is asynchronous after close; the next request must acquire it.
  const next=await exporter.exportTimeEntriesV3({accessToken:tokens.adminA,correlationId:randomUUID(),request:{
    expectedMembershipId:ids.membershipAdminA,fromInclusive:from,toExclusive:to,
  }});
  expect(next.status).toBe('succeeded');
  expect((await db.query('SELECT pid FROM pg_stat_activity WHERE application_name=$1',[login])).rows).toEqual([]);
});

it.each(['preflight','stream'] as const)('cancels the server query and discards its connection on client abort during %s', async stage => {
  const blocker = await db.connect();
  try {
    await blocker.query('BEGIN');
    if (stage === 'preflight') await blocker.query('LOCK TABLE taptime_server.time_entries IN ACCESS EXCLUSIVE MODE');
    const abort = new AbortController();
    const pending = exporter.exportTimeEntriesV4({ accessToken: tokens.adminA, correlationId: randomUUID(), request: {
      expectedMembershipId: ids.membershipAdminA, fromInclusive: from, toExclusive: to,
    } }, { signal: abort.signal, streamResponse: stage === 'stream',
      afterSnapshotRead: stage === 'stream' ? async () => { await blocker.query('LOCK TABLE taptime_server.break_intervals IN ACCESS EXCLUSIVE MODE'); } : undefined,
    }).then(async result => {
      if (result.status !== 'streaming') return result;
      try { for await (const _ of result.stream) { /* consume until cancellation */ } }
      catch { return { status: 'service_unavailable' }; }
      return { status: 'unexpected_complete_stream' };
    });
    let blocked = false;
    for (let poll = 0; poll < 200; poll++) {
      const activity = await db.query("SELECT pid FROM pg_stat_activity WHERE application_name=$1 AND wait_event_type='Lock'", [login]);
      if (activity.rowCount) { blocked = true; break; }
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    expect(blocked).toBe(true);
    abort.abort();
    expect(await pending).toEqual({ status: 'service_unavailable' });
    expect(runtime.totalCount).toBe(0);
    expect((await db.query('SELECT pid FROM pg_stat_activity WHERE application_name=$1', [login])).rows).toEqual([]);
  } finally { await blocker.query('ROLLBACK'); blocker.release(); }
});
