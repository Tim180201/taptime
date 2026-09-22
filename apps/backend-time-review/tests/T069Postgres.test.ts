import { randomUUID } from 'node:crypto';
import { Pool, type PoolClient } from 'pg';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { ids, resetMigratePrepareAndSeed, DA3_WRITE_LOGIN, runtimeConnectionString, tokens, verifier } from './fixtures.js';
import { AdministrationStopCoordinator } from '../src/AdministrationStopCoordinator.js';

const pool = new Pool({ connectionString: process.env.DA3_DATABASE_URL ?? 'postgresql://timbartz@127.0.0.1:5432/taptime_da3' });
const request = (overrides: Record<string, unknown> = {}) => ({
  expectedMembershipId: ids.membershipAdminA, targetMembershipId: ids.membershipEmployeeA,
  timeRecordId: ids.activeEntryA, expectedRowVersion: 1, commandId: randomUUID(),
  stoppedAt: '2026-07-21T12:00:00.000Z', reason: 'Stopp vergessen', ...overrides,
});
async function actor<T>(run: (c: PoolClient) => Promise<T>, who = 'admin') {
  const c = await pool.connect();
  const foreign = who === 'foreign'; const employee = who === 'employee';
  try {
    await c.query('BEGIN');
    await c.query(`SELECT set_config('app.organization_id',$1,true), set_config('app.user_id',$2,true),
      set_config('app.membership_id',$3,true), set_config('app.membership_role',$4,true)`,
    [foreign ? ids.organizationB : ids.organizationA, foreign ? ids.adminB : employee ? ids.employeeA : ids.adminA,
      foreign ? ids.membershipAdminB : employee ? ids.membershipEmployeeA : ids.membershipAdminA, employee ? 'employee' : 'administrator']);
    await c.query('SET LOCAL ROLE taptime_time_review_writer');
    const result = await run(c); await c.query('COMMIT'); return result;
  } catch (e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
}
const prepare = (r = request(), who = 'admin') => actor(async c =>
  (await c.query('SELECT taptime_server.prepare_administration_stop_v1($1::jsonb) AS result', [JSON.stringify(r)])).rows[0].result, who);

beforeAll(async () => { await resetMigratePrepareAndSeed(pool, 't069-synthetic'); });
afterAll(() => pool.end());

it('authorizes the administrator and returns the locked engine context', async () => {
  expect(await prepare()).toMatchObject({ status: 'ready', activeTimeEntry: { id: ids.activeEntryA, status: 'started' }, activeBreakInterval: null });
});
it.each([
  ['employee', 'employee', { expectedMembershipId: ids.membershipEmployeeA }, 'authority_rejected'],
  ['foreign tenant', 'foreign', { expectedMembershipId: ids.membershipAdminB }, 'authority_rejected'],
  ['wrong row version', 'admin', { expectedRowVersion: 2 }, 'conflict'],
  ['already stopped', 'admin', { timeRecordId: ids.stoppedEntryA }, 'conflict'],
  ['before beginning', 'admin', { stoppedAt: '2026-07-21T07:00:00.000Z' }, 'invalid_interval'],
  ['same as beginning', 'admin', { stoppedAt: '2026-07-21T08:00:00.000Z' }, 'invalid_interval'],
  ['over 24 hours', 'admin', { stoppedAt: '2026-07-22T08:00:00.001Z' }, 'invalid_interval'],
  ['future', 'admin', { stoppedAt: '2099-07-22T08:00:00.000Z' }, 'invalid_interval'],
  ['no reason', 'admin', { reason: ' ' }, 'reason_required'],
] as const)('rejects %s at the database boundary', async (_label, who, overrides, status) => {
  expect(await prepare(request(overrides), who)).toEqual({ status });
});

it('rejects location managers at the SQL boundary', async () => {
  await pool.query("UPDATE taptime_server.memberships SET role='standortleitung',row_version=row_version+1 WHERE id=$1", [ids.membershipAdminA]);
  try { expect(await prepare()).toEqual({ status: 'authority_rejected' }); }
  finally { await pool.query("UPDATE taptime_server.memberships SET role='administrator',row_version=row_version+1 WHERE id=$1", [ids.membershipAdminA]); }
});

async function seedBreak(at: string, stoppedAt?: string) {
  const c = await pool.connect(); const id = randomUUID(); const start = randomUUID(); const stop = randomUUID();
  try {
    await c.query('BEGIN');
    for (const [event, time] of [[start, at], ...(stoppedAt ? [[stop, stoppedAt]] : [])]) {
      await c.query(`INSERT INTO taptime_server.work_events(id,organization_id,triggered_by_user_id,occurred_at,subject_type,trigger_type,
        content_hash,content_hash_algorithm,content_hash_version) VALUES($1,$2,$3,$4,'break','manual',repeat('a',64),'sha256',3)`, [event, ids.organizationA, ids.employeeA, time]);
    }
    await c.query(`INSERT INTO taptime_server.break_intervals(id,organization_id,user_id,time_entry_id,status,start_work_event_id,started_at,started_via)
      VALUES($1,$2,$3,$4,'started',$5,$6,'manual')`, [id, ids.organizationA, ids.employeeA, ids.activeEntryA, start, at]);
    await c.query(`INSERT INTO taptime_server.canonical_decisions(work_event_id,organization_id,actor_user_id,subject_type,decision_type,time_entry_id,break_interval_id,engine_version,decision_payload)
      VALUES($1,$2,$3,'break','break_started',$4,$5,'test','{}')`, [start, ids.organizationA, ids.employeeA, ids.activeEntryA, id]);
    await c.query('COMMIT');
    if (stoppedAt) {
      await c.query('BEGIN');
      await c.query("UPDATE taptime_server.break_intervals SET status='stopped',stopped_at=$1,stop_work_event_id=$2,stopped_via='manual',row_version=row_version+1 WHERE id=$3", [stoppedAt, stop, id]);
      await c.query(`INSERT INTO taptime_server.canonical_decisions(work_event_id,organization_id,actor_user_id,subject_type,decision_type,time_entry_id,break_interval_id,engine_version,decision_payload)
        VALUES($1,$2,$3,'break','break_stopped',$4,$5,'test','{}')`, [stop, ids.organizationA, ids.employeeA, ids.activeEntryA, id]);
      await c.query('COMMIT');
    }
    return id;
  } catch(e) { await c.query('ROLLBACK'); throw e; } finally { c.release(); }
}
let openBreak: string;
it('rejects an end before a closed pause end and before an open pause start', async () => {
  await seedBreak('2026-07-21T09:00:00.000Z', '2026-07-21T09:30:00.000Z');
  expect(await prepare(request({ stoppedAt: '2026-07-21T09:15:00.000Z' }))).toEqual({ status: 'end_before_break' });
  openBreak = await seedBreak('2026-07-21T10:00:00.000Z');
  expect(await prepare(request({ stoppedAt: '2026-07-21T09:45:00.000Z' }))).toEqual({ status: 'end_before_break' });
});
it('stops through live authority and the engine, closes the pause and retains immutable audit/idempotency', async () => {
  const runtime = new Pool({ connectionString: runtimeConnectionString(pool.options.connectionString!, DA3_WRITE_LOGIN, 't069-synthetic') });
  try {
    const coordinator = new AdministrationStopCoordinator(runtime, verifier);
    const r = request();
    expect(await coordinator.execute(tokens.rejected, r)).toEqual({ status: 'authority_rejected' });
    const result = await coordinator.execute(tokens.adminA, r);
    expect(result).toEqual({ status: 'committed', timeRecordId: ids.activeEntryA, idempotentRetry: false, requiredWalFile: expect.stringMatching(/^[0-9A-F]{24}$/), offsiteArchived: false });
    const entry = (await pool.query('SELECT * FROM taptime_server.time_entries WHERE id=$1', [ids.activeEntryA])).rows[0];
    const pause = (await pool.query('SELECT * FROM taptime_server.break_intervals WHERE id=$1', [openBreak])).rows[0];
    expect(entry).toMatchObject({ status: 'stopped', stopped_via: 'administration', row_version: '2' });
    expect(pause).toMatchObject({ status: 'stopped', stopped_via: 'administration', stop_work_event_id: entry.stop_work_event_id });
    expect(pause.stopped_at).toEqual(entry.stopped_at);
    expect((await pool.query('SELECT trigger_type,triggered_by_user_id FROM taptime_server.work_events WHERE id=$1', [entry.stop_work_event_id])).rows)
      .toEqual([{ trigger_type: 'administration', triggered_by_user_id: ids.employeeA }]);
    expect((await pool.query("SELECT actor_user_id,work_event_user_id,payload FROM taptime_server.audit_events WHERE event_type='TimeEntryStoppedByAdministration'")).rows)
      .toMatchObject([{ actor_user_id: ids.adminA, work_event_user_id: ids.employeeA, payload: { reason: r.reason, stoppedAt: r.stoppedAt, timeRecordId: ids.activeEntryA } }]);
    expect(await coordinator.execute(tokens.adminA, r)).toEqual({ ...result, idempotentRetry: true });
    expect(await coordinator.execute(tokens.adminA, { ...r, reason: 'Anders' })).toEqual({ status: 'command_id_conflict' });
    await expect(pool.query("UPDATE taptime_server.administration_stop_commands SET reason='ersetzt'")).rejects.toMatchObject({ code: '55000' });
  } finally { await runtime.end(); }
});

it('marks details and export v4 and restricts the late-trigger boundary to the affected person', async () => {
  const c=await pool.connect();
  try {
    await c.query('BEGIN');
    await c.query(`SELECT set_config('app.organization_id',$1,true),set_config('app.user_id',$2,true),
      set_config('app.membership_id',$3,true),set_config('app.membership_role','employee',true)`,
      [ids.organizationA,ids.employeeA,ids.membershipEmployeeA]);
    await c.query('SET LOCAL ROLE taptime_mobile_own_time_reader');
    const details=(await c.query('SELECT details FROM taptime_server.read_time_record_details_v1($1::uuid[])',[[ids.activeEntryA]])).rows[0].details;
    expect(details).toMatchObject({changed:true,administrationStop:{reason:'Stopp vergessen'}});
    await c.query('SET LOCAL ROLE taptime_server_lifecycle');
    const action=(await pool.query('SELECT action_at::text FROM taptime_server.administration_stop_commands WHERE time_entry_id=$1',[ids.activeEntryA])).rows[0].action_at;
    for(const [at,expected] of [['2026-07-21T08:00:00.000Z',false],['2026-07-21T08:00:01.000Z',true],[action,false]] as const) {
      expect((await c.query('SELECT taptime_server.was_stopped_by_administration_v1($1) AS stopped',[at])).rows[0].stopped).toBe(expected);
    }
    await c.query("SELECT set_config('app.user_id',$1,true)",[ids.adminA]);
    expect((await c.query("SELECT taptime_server.was_stopped_by_administration_v1('2026-07-21T09:00:00Z') AS stopped")).rows[0].stopped).toBe(false);
    await c.query('ROLLBACK');
    await c.query('BEGIN');
    await c.query(`SELECT set_config('app.organization_id',$1,true),set_config('app.user_id',$2,true),
      set_config('app.membership_id',$3,true),set_config('app.membership_role','administrator',true)`,[ids.organizationA,ids.adminA,ids.membershipAdminA]);
    await c.query('SET LOCAL ROLE taptime_time_exporter');
    expect((await c.query('SELECT details FROM taptime_server.read_time_record_export_details_v1($1::uuid[])',[[ids.activeEntryA]])).rows[0].details.changed).toBe(true);
    await c.query('ROLLBACK');
  } finally {await c.query('ROLLBACK');c.release();}
});

it('preserves legacy person-time bytes and exports the administration stop as changed in v4',async()=>{
  const {EmployeeMembershipEnrollmentCoordinator}=await import('@taptime/backend-administration');
  const reader=new EmployeeMembershipEnrollmentCoordinator(pool,pool,verifier);
  const {TimeEntryExportCoordinator}=await import('@taptime/backend-time-export');
  const c=await pool.connect();
  try {
    await c.query('BEGIN');
    await c.query(`SELECT set_config('app.organization_id',$1,true),set_config('app.user_id',$2,true),set_config('app.membership_id',$3,true),set_config('app.membership_role','administrator',true)`,[ids.organizationA,ids.adminA,ids.membershipAdminA]);
    await c.query('SET LOCAL ROLE taptime_membership_manager');
    const command={accessToken:tokens.adminA,expectedMembershipId:ids.membershipAdminA,targetMembershipId:ids.membershipEmployeeA,
      fromInclusive:'2026-07-01T00:00:00.000Z',toExclusive:'2026-08-01T00:00:00.000Z',limit:20,cursor:null};
    const old=await reader.readManagedPersonTime(command),current=await reader.readManagedPersonTime({...command,includeTimeDetails:true});
    expect(old.status).toBe('succeeded');expect(current.status).toBe('succeeded');
    if(old.status!=='succeeded'||current.status!=='succeeded') throw new Error('Expected person time');
    const stopped=current.value.records.find(r=>r.timeRecordId===ids.activeEntryA)!;
    expect(stopped).toMatchObject({stoppedVia:'administration',details:{changed:true,administrationStop:{reason:'Stopp vergessen'}}});
    const legacy={...current.value,records:current.value.records.map(({details,...record})=>({...record,stoppedVia:record.stoppedVia==='administration'?'manual':record.stoppedVia}))};
    expect(JSON.stringify(old.value)).toBe(JSON.stringify(legacy));
    await c.query('ROLLBACK');
  } finally {await c.query('ROLLBACK');c.release();}
  const command={accessToken:tokens.adminA,correlationId:randomUUID(),request:{expectedMembershipId:ids.membershipAdminA,
    fromInclusive:'2026-07-21T00:00:00.000Z',toExclusive:'2026-07-22T00:00:00.000Z'}};
  const exporter=new TimeEntryExportCoordinator(pool,verifier);
  for(const method of ['exportTimeEntriesV3','exportTimeEntriesV4'] as const) {
    const result=await exporter[method](command);expect(result.status).toBe('succeeded');
    if(result.status!=='succeeded') throw new Error('Expected CSV');
    const [header,row]=Buffer.from(result.bytes).toString('utf8').trim().split('\r\n');
    const columns=header!.split('";"').map(v=>v.replace(/^"|"$/g,''));
    const values=row!.split('";"').map(v=>v.replace(/^"|"$/g,''));
    expect(row).toContain('end=manual');
    if(method==='exportTimeEntriesV4') expect(values[columns.indexOf('changed')]).toBe('yes');
    else expect(columns).not.toContain('changed');
  }
});

it('binds archive demand to the command, receipt and target, retaining it until external evidence arrives', async () => {
  const command = (await pool.query('SELECT * FROM taptime_server.administration_stop_commands')).rows[0];
  const before = (await pool.query('SELECT * FROM taptime_server.lifecycle_event_archive_requirements')).rows[0];
  expect(before).toMatchObject({work_event_id:command.work_event_id,receipt_id:command.receipt_id,
    user_id:ids.employeeA,membership_id:ids.membershipEmployeeA});
  const runtime = new Pool({connectionString:runtimeConnectionString(pool.options.connectionString!,DA3_WRITE_LOGIN,'t069-synthetic')});
  try {
    const coordinator = new AdministrationStopCoordinator(runtime,verifier);
    const pending = await Promise.all([coordinator.execute(tokens.adminA,command.request_payload),coordinator.execute(tokens.adminA,command.request_payload)]);
    expect(pending).toEqual([expect.objectContaining({status:'committed',idempotentRetry:true,offsiteArchived:false}),
      expect.objectContaining({status:'committed',idempotentRetry:true,offsiteArchived:false})]);
    expect((await pool.query('SELECT * FROM taptime_server.lifecycle_event_archive_requirements')).rows).toEqual([before]);
    const register = (request:unknown,who='admin') => actor(async c => c.query(
      'SELECT * FROM taptime_server.record_administration_stop_archive_requirement_v1($1::jsonb)',[JSON.stringify(request)]),who);
    await expect(register(command.request_payload,'foreign')).rejects.toMatchObject({code:'42501'});
    await expect(register(command.request_payload,'employee')).rejects.toMatchObject({code:'42501'});
    await expect(register({...command.request_payload,targetMembershipId:ids.membershipAdminA})).rejects.toMatchObject({code:'42501'});
    await expect(register({...command.request_payload,commandId:randomUUID()})).rejects.toMatchObject({code:'42501'});
    expect((await pool.query(`SELECT has_function_privilege('taptime_server_lifecycle',
      'taptime_server.record_administration_stop_archive_requirement_v1(jsonb)','EXECUTE') AS allowed`)).rows[0].allowed).toBe(false);
    await expect(pool.query("UPDATE taptime_server.lifecycle_event_archive_requirements SET required_wal_lsn=required_wal_lsn")).rejects.toMatchObject({code:'55000'});
    const c=await pool.connect();
    try {
      await c.query('BEGIN');await c.query('SET LOCAL ROLE taptime_wal_archiver');
      const files=(await c.query('SELECT * FROM taptime_server.read_pending_offsite_wal_files_v1()')).rows;
      expect(JSON.stringify(files)).toContain(before.required_wal_file);
      await c.query('ROLLBACK');
    } finally {await c.query('ROLLBACK');c.release();}
    await recordSyntheticLifecycleArchive(command.work_event_id);
    expect(await coordinator.execute(tokens.adminA,command.request_payload)).toEqual({status:'committed',
      timeRecordId:ids.activeEntryA,idempotentRetry:true,requiredWalFile:before.required_wal_file,offsiteArchived:true});
    expect((await pool.query('SELECT * FROM taptime_server.lifecycle_event_archive_requirements')).rows).toEqual([before]);
  } finally {await runtime.end();}
});

let syntheticLifecycleBaseSequence=0;
async function recordSyntheticLifecycleArchive(workEventId: string): Promise<void> {
  const requirement = await pool.query<{ readonly required_wal_file: string }>(
    `SELECT required_wal_file
     FROM taptime_server.lifecycle_event_archive_requirements
     WHERE organization_id = $1::uuid AND work_event_id = $2::uuid`,
    [ids.organizationA, workEventId],
  );
  const walFile = requirement.rows[0]?.required_wal_file;
  if (walFile === undefined) throw new Error('Lifecycle WAL requirement was not persisted');
  const cluster = await pool.query<{
    readonly archive_identifier: string;
    readonly segment_bytes: string;
  }>(`
    SELECT pg_catalog.lpad(pg_catalog.to_hex(control.system_identifier), 16, '0')
             AS archive_identifier,
           pg_catalog.pg_size_bytes(
             pg_catalog.current_setting('wal_segment_size')
           )::text AS segment_bytes
    FROM pg_catalog.pg_control_system() AS control
  `);
  const archiveIdentifier = cluster.rows[0]?.archive_identifier;
  const segmentBytes = BigInt(cluster.rows[0]?.segment_bytes ?? '0');
  if (archiveIdentifier === undefined || !/^[0-9a-f]{16}$/u.test(archiveIdentifier)) {
    throw new Error('Lifecycle archive has no PostgreSQL cluster identifier');
  }
  const precedingWalFile = precedingLifecycleWalFile(walFile, segmentBytes) ?? walFile;
  syntheticLifecycleBaseSequence += 1;
  const baseArchive = `base-${archiveIdentifier}-20990102T${String(
    syntheticLifecycleBaseSequence,
  ).padStart(6, '0')}Z`;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SET LOCAL ROLE taptime_wal_archiver');
    await client.query(
      `SELECT taptime_server.record_offsite_base_backup_v1(
         $1, $2::pg_lsn, $3
       )`,
      [baseArchive, lifecycleWalFileStartLsn(precedingWalFile, segmentBytes),
        precedingWalFile],
    );
    await client.query(
      `SELECT taptime_server.record_offsite_wal_archive_v1($1, $2, $3)`,
      [precedingWalFile, `wal-${archiveIdentifier}-${precedingWalFile}`, '0'.repeat(64)],
    );
    await client.query(
      `SELECT taptime_server.advance_offsite_wal_archive_watermark_v1($1, $2)`,
      [baseArchive, precedingWalFile],
    );
    if (precedingWalFile !== walFile) {
      await client.query(
        `SELECT taptime_server.record_offsite_wal_archive_v1($1, $2, $3)`,
        [walFile, `wal-${archiveIdentifier}-${walFile}`, '1'.repeat(64)],
      );
      await client.query(
        `SELECT taptime_server.advance_offsite_wal_archive_watermark_v1($1, $2)`,
        [baseArchive, walFile],
      );
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

function precedingLifecycleWalFile(walFile: string, segmentBytes: bigint): string | null {
  if (!/^[0-9A-F]{24}$/u.test(walFile) || segmentBytes <= 0n) {
    throw new Error('Cannot derive preceding lifecycle WAL segment');
  }
  const timeline = walFile.slice(0, 8);
  let log = BigInt(`0x${walFile.slice(8, 16)}`);
  let segment = BigInt(`0x${walFile.slice(16)}`);
  const segmentsPerLog = (2n ** 32n) / segmentBytes;
  if (segment === 0n) {
    if (log === 0n) return null;
    log -= 1n;
    segment = segmentsPerLog - 1n;
  } else {
    segment -= 1n;
  }
  const hex = (value: bigint) => value.toString(16).toUpperCase().padStart(8, '0');
  return `${timeline}${hex(log)}${hex(segment)}`;
}

function lifecycleWalFileStartLsn(walFile: string, segmentBytes: bigint): string {
  const log = BigInt(`0x${walFile.slice(8, 16)}`);
  const segment = BigInt(`0x${walFile.slice(16)}`);
  return `${log.toString(16).toUpperCase()}/${(segment * segmentBytes)
    .toString(16).toUpperCase()}`;
}
