import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Pool, type PoolClient } from 'pg';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { MembershipId, WorkEventId, CustomerId, customerAssignmentTarget } from '@taptime/core';
import { ManualLifecycleIngestionCoordinator } from '../../backend-lifecycle/src/ManualLifecycleIngestionCoordinator.js';
import { AdministrationStopCoordinator } from '../../backend-time-review/src/AdministrationStopCoordinator.js';
import { readManagedPerson } from '../../backend-administration/src/ManagedPeopleReader.js';
import { ids, tokens, verifier as fixtureVerifier, resetMigratePrepareAndSeed } from '../../backend-time-review/tests/fixtures.js';
import { definerFindings, tenantPolicyFindings } from '../../backend-schema/tests/support/catalogSecurity.js';
import { LockScreenCoordinator } from '../src/LockScreenCoordinator.js';
import type { LockScreenAction, LockScreenCapabilityRequest } from '@taptime/mobile-work-contract';

const url = process.env.C2_DATABASE_URL ?? 'postgresql://timbartz@127.0.0.1:5432/taptime_da3';
const installer = new Pool({ connectionString: url });
const login = `t104a_${randomUUID().replaceAll('-', '')}`;
const runtimeUrl = new URL(url); runtimeUrl.username = login; runtimeUrl.password = 'synthetic-t104a';
const runtime = new Pool({ connectionString: runtimeUrl.href, max: 4 });
const issuer = 'https://t104a.invalid/auth';
const subjects = new Set<string>();
const verifier = { verify: vi.fn(async (token: string) => subjects.has(token)
  ? { status: 'verified' as const, identity: { issuer, subject: token } } : fixtureVerifier.verify(token)) };
const archive = { requireOffsiteArchive: vi.fn(async () => ({ requiredWalFile: '000000010000000000000001', offsiteArchived: true })) };
const manual = new ManualLifecycleIngestionCoordinator(runtime, verifier, archive);
const lockScreen = new LockScreenCoordinator(runtime, verifier, archive);
type Person = { user: string; member: string; token: string; organization: string; entry: string; installation: string; binding: string; target: string };

beforeAll(async () => {
  await resetMigratePrepareAndSeed(installer, 'synthetic-t104a');
  expect((await installer.query('SHOW server_version_num')).rows[0]?.server_version_num).toMatch(/^17/);
  await installer.query(`CREATE ROLE ${login} LOGIN NOINHERIT PASSWORD 'synthetic-t104a';
    GRANT taptime_identity_resolver,taptime_server_lifecycle,taptime_time_review_writer,taptime_membership_manager,taptime_time_exporter TO ${login}`);
});
afterAll(async () => {
  await runtime.end(); await installer.query(`DROP OWNED BY ${login}; DROP ROLE ${login}`); await installer.end();
});

async function person(organization: string = ids.organizationA): Promise<Person> {
  const user = randomUUID(), member = randomUUID(), token = randomUUID(), binding = randomUUID(), installation = randomUUID();
  const target = organization === ids.organizationA ? ids.customerA : ids.customerB;
  subjects.add(token);
  await installer.query('INSERT INTO taptime_server.users(id) VALUES($1)', [user]);
  await installer.query("INSERT INTO taptime_server.memberships(id,organization_id,user_id,role,display_name) VALUES($1,$2,$3,'employee','Sperrbildschirm Test')", [member, organization, user]);
  await installer.query('INSERT INTO taptime_server.identity_bindings(id,user_id,issuer,subject) VALUES($1,$2,$3,$4)', [binding, user, issuer, token]);
  await installer.query('INSERT INTO taptime_server.offline_installations(id,organization_id,user_id,membership_id,identity_binding_id,binding_digest) VALUES($1,$2,$3,$4,$5,$6)',
    [installation, organization, user, member, binding, randomBytes(32)]);
  const started = await manual.ingestManual({ accessToken: token, expectedMembershipId: MembershipId(member),
    workEvent: { id: WorkEventId(randomUUID()), target: customerAssignmentTarget(CustomerId(target)) }, receipt: { id: randomUUID(), attemptNumber: 1 } });
  if (started.status !== 'synchronized' || started.decision.status !== 'time_entry_started') throw new Error('Fixture did not start time');
  return { user, member, token, binding, installation, target, organization, entry: started.serverTimeEntryId! };
}
function request(p: Person): LockScreenCapabilityRequest { return { expectedMembershipId: p.member, timeEntryId: p.entry, installationId: p.installation }; }
async function issue(p: Person, patch: Partial<LockScreenCapabilityRequest> = {}) {
  const result = await lockScreen.issue(p.token, { ...request(p), ...patch });
  if (result.status !== 'issued') throw new Error('Fixture did not issue capability');
  return result;
}
const hash = (key: string) => createHash('sha256').update(Buffer.from(key, 'base64url')).digest();
const action = (key: string, action: LockScreenAction, commandId = randomUUID()) => lockScreen.perform(key, { action, commandId });
async function eventCount(p: Person) { return Number((await installer.query('SELECT count(*) FROM taptime_server.work_events WHERE organization_id=$1 AND triggered_by_user_id=$2', [p.organization, p.user])).rows[0].count); }
async function context(client: PoolClient, role: string, p: { organization: string; user: string; member: string }, memberRole = 'employee') {
  await client.query(`SELECT set_config('app.organization_id',$1,true),set_config('app.user_id',$2,true),set_config('app.membership_id',$3,true),set_config('app.membership_role',$4,true)`,
    [p.organization, p.user, p.member, memberRole]);
  await client.query(`SET LOCAL ROLE ${role}`);
}
async function administrativeStop(p: Person) {
  const row = (await installer.query('SELECT row_version FROM taptime_server.time_entries WHERE id=$1', [p.entry])).rows[0];
  const result = await new AdministrationStopCoordinator(runtime, verifier).execute(tokens.adminA, {
    expectedMembershipId: ids.membershipAdminA, commandId: randomUUID(), timeRecordId: p.entry, targetMembershipId: p.member,
    expectedRowVersion: Number(row.row_version), stoppedAt: new Date().toISOString(), reason: 'Test Verwaltungsstopp',
  });
  expect(result.status).toBe('committed');
}

it('issues only for the authenticated own running entry and its installation; stores only 32-byte SHA-256', async () => {
  const p = await person(), other = await person(), foreign = await person(ids.organizationB);
  const issued = await issue(p);
  expect(Buffer.from(issued.capability, 'base64url')).toHaveLength(32);
  const row = (await installer.query('SELECT * FROM taptime_server.lock_screen_capabilities WHERE key_sha256=$1', [hash(issued.capability)])).rows[0];
  expect(row).toMatchObject({ user_id: p.user, membership_id: p.member, time_entry_id: p.entry, installation_id: p.installation, last_used_at: null, revoked_at: null });
  expect(row.expires_at.getTime() - row.issued_at.getTime()).toBe(24 * 60 * 60 * 1000);
  expect(JSON.stringify(row)).not.toContain(issued.capability);
  for (const patch of [{ timeEntryId: other.entry }, { timeEntryId: foreign.entry }, { expectedMembershipId: other.member }, { installationId: other.installation }, { installationId: foreign.installation }, { installationId: randomUUID() }]) {
    expect(await lockScreen.issue(p.token, { ...request(p), ...patch })).toEqual({ status: 'unauthorized' });
  }
  expect(await lockScreen.issue('invalid', request(p))).toEqual({ status: 'unauthorized' });
});

it('checks every action in running, paused and stopped state; supports immediate repeated pause/resume and stop from pause', async () => {
  const p = await person(), { capability } = await issue(p);
  const transitions = [
    ['resume', 'state_changed', 'running', 0], ['pause', 'applied', 'paused', 1], ['pause', 'state_changed', 'paused', 0],
    ['resume', 'applied', 'running', 1], ['pause', 'applied', 'paused', 1], ['resume', 'applied', 'running', 1],
    ['pause', 'applied', 'paused', 1], ['stop', 'applied', 'stopped', 2],
  ] as const;
  for (const [name, status, state, count] of transitions) {
    const before = await eventCount(p);
    expect(await action(capability, name)).toMatchObject({ status, state: { status: state, timeEntryId: p.entry }, idempotentRetry: false });
    expect(await eventCount(p)).toBe(before + count);
  }
  // Reset the synthetic limiter window to test the remaining state matrix, without waiting a minute.
  await installer.query('UPDATE taptime_server.lock_screen_capabilities SET rate_window_started_at=clock_timestamp()-interval \'1 minute\' WHERE key_sha256=$1', [hash(capability)]);
  const count = await eventCount(p);
  for (const name of ['pause', 'resume', 'stop'] as const) expect(await action(capability, name)).toMatchObject({ status: 'state_changed', state: { status: 'stopped' } });
  expect(await eventCount(p)).toBe(count);
  expect(await lockScreen.issue(p.token, request(p))).toEqual({ status: 'unauthorized' });
  const events = (await installer.query(`SELECT e.lock_screen_action,e.trigger_type,d.decision_type FROM taptime_server.work_events e
    JOIN taptime_server.canonical_decisions d ON d.work_event_id=e.id WHERE e.triggered_by_user_id=$1 AND e.lock_screen_action IS NOT NULL ORDER BY e.received_at,e.occurred_at`, [p.user])).rows;
  expect(events.every(e => e.trigger_type === 'manual')).toBe(true);
  expect(events.map(e => e.lock_screen_action)).toEqual(['pause', 'resume', 'pause', 'resume', 'pause', 'resume', 'stop']);
  const audit = (await installer.query("SELECT payload FROM taptime_server.audit_events WHERE work_event_user_id=$1 AND payload ? 'lockScreenAction'", [p.user])).rows;
  expect(audit).toHaveLength(events.length);
  expect(JSON.stringify(audit)).not.toContain(capability);
  expect((await installer.query('SELECT stopped_via FROM taptime_server.time_entries WHERE id=$1', [p.entry])).rows[0].stopped_via).toBe('manual');
});

it('stops a running entry and replays the command after its end, always returning current state', async () => {
  const p = await person(), { capability } = await issue(p), command = randomUUID();
  const before = await eventCount(p);
  expect(await action(capability, 'stop', command)).toMatchObject({ status: 'applied', state: { status: 'stopped', breakStartedAt: null } });
  expect(await action(capability, 'stop', command)).toMatchObject({ status: 'applied', idempotentRetry: true, state: { status: 'stopped' } });
  expect(await eventCount(p)).toBe(before + 1);
  expect(await action(capability, 'pause', command)).toEqual({ status: 'command_id_conflict' });
});

it('deduplicates concurrent commands and retries an earlier pause after resume without toggling again', async () => {
  const p = await person(), { capability } = await issue(p), command = randomUUID();
  const before = await eventCount(p);
  const results = await Promise.all([action(capability, 'pause', command), action(capability, 'pause', command)]);
  expect(results).toEqual(expect.arrayContaining([expect.objectContaining({ idempotentRetry: false }), expect.objectContaining({ idempotentRetry: true })]));
  expect(await eventCount(p)).toBe(before + 1);
  await action(capability, 'resume');
  expect(await action(capability, 'pause', command)).toMatchObject({ status: 'applied', idempotentRetry: true, state: { status: 'running' } });
  expect(await eventCount(p)).toBe(before + 2);
});

it('rejects unknown, expired, replaced and revoked keys uniformly, including command replays', async () => {
  const p = await person(), first = await issue(p), second = await issue(p), command = randomUUID();
  expect(await action(first.capability, 'pause')).toEqual({ status: 'unauthorized' });
  expect(await action(randomBytes(32).toString('base64url'), 'pause')).toEqual({ status: 'unauthorized' });
  await action(second.capability, 'pause', command);
  await installer.query("UPDATE taptime_server.lock_screen_capabilities SET issued_at=clock_timestamp()-interval '1 hour',expires_at=clock_timestamp()-interval '1 second' WHERE key_sha256=$1", [hash(second.capability)]);
  expect(await action(second.capability, 'pause', command)).toEqual({ status: 'unauthorized' });
  const third = await issue(p);
  await administrativeStop(p);
  await installer.query('UPDATE taptime_server.memberships SET revoked_at=clock_timestamp(),row_version=row_version+1 WHERE id=$1', [p.member]);
  expect((await installer.query('SELECT revoked_at FROM taptime_server.lock_screen_capabilities WHERE key_sha256=$1', [hash(third.capability)])).rows[0].revoked_at).not.toBeNull();
  expect(await action(third.capability, 'stop')).toEqual({ status: 'unauthorized' });
  expect(await lockScreen.issue(p.token, request(p))).toEqual({ status: 'unauthorized' });
});

it('does not use Supabase for actions; checks paused organizations and restores all pool context', async () => {
  const p = await person(), { capability } = await issue(p);
  verifier.verify.mockClear();
  await installer.query("UPDATE taptime_server.organizations SET status='paused',paused_at=clock_timestamp(),pause_reason='Test',row_version=row_version+1 WHERE id=$1", [p.organization]);
  try { expect(await action(capability, 'pause')).toEqual({ status: 'unauthorized' }); }
  finally { await installer.query("UPDATE taptime_server.organizations SET status='active',paused_at=NULL,pause_reason=NULL,row_version=row_version+1 WHERE id=$1", [p.organization]); }
  expect(verifier.verify).not.toHaveBeenCalled();
  expect(await action(capability, 'pause')).toMatchObject({ status: 'applied' });
  const client = await runtime.connect();
  try {
    const row = (await client.query("SELECT current_setting('role') AS role,nullif(current_setting('app.user_id',true),'') AS person")).rows[0];
    expect(row).toEqual({ role: 'none', person: null });
  } finally { client.release(); }
});

it('bounds each key to ten calls per minute across coordinator instances', async () => {
  const p = await person(), { capability } = await issue(p);
  const other = new LockScreenCoordinator(runtime, verifier, archive);
  for (let i = 0; i < 10; i++) expect(await other.perform(capability, { action: 'resume', commandId: randomUUID() })).toMatchObject({ status: 'state_changed' });
  expect(await action(capability, 'pause')).toMatchObject({ status: 'rate_limited', retryAfterSeconds: expect.any(Number) });
  expect((await installer.query('SELECT last_used_at FROM taptime_server.lock_screen_capabilities WHERE key_sha256=$1', [hash(capability)])).rows[0].last_used_at).not.toBeNull();
});

it('rotates only the same entry/installation and purges expired rows plus receipts after seven days', async () => {
  const p = await person(), first = await issue(p), noInstallation = await issue(p, { installationId: null });
  await action(first.capability, 'resume');
  const replacement = await issue(p);
  expect(await action(first.capability, 'pause')).toEqual({ status: 'unauthorized' });
  expect(await action(noInstallation.capability, 'resume')).toMatchObject({ status: 'state_changed' });
  await installer.query("UPDATE taptime_server.lock_screen_capabilities SET issued_at=transaction_timestamp()-interval '9 days',expires_at=transaction_timestamp()-interval '8 days' WHERE key_sha256=$1", [hash(first.capability)]);
  const eventTotal = await eventCount(p);
  await issue(p);
  expect((await installer.query('SELECT * FROM taptime_server.lock_screen_capabilities WHERE key_sha256=$1', [hash(first.capability)])).rows).toEqual([]);
  expect((await installer.query('SELECT * FROM taptime_server.lock_screen_commands WHERE user_id=$1', [p.user])).rows).toHaveLength(1);
  expect(await eventCount(p)).toBe(eventTotal);
  expect(await action(replacement.capability, 'stop')).toEqual({ status: 'unauthorized' });
});

it('keeps all SECURITY DEFINER, tenant-policy and RLS invariants and denies runtime table access', async () => {
  const client = await installer.connect();
  try {
    expect(await definerFindings(client)).toEqual([]); expect(await tenantPolicyFindings(client)).toEqual([]);
    expect((await client.query("SELECT relname FROM pg_class WHERE relnamespace='taptime_server'::regnamespace AND relkind IN ('r','p') AND (NOT relrowsecurity OR NOT relforcerowsecurity)")).rows).toEqual([]);
    expect((await client.query(`SELECT r.rolname,c.relname FROM pg_roles r CROSS JOIN pg_class c
      WHERE c.oid IN ('taptime_server.lock_screen_capabilities'::regclass,'taptime_server.lock_screen_commands'::regclass)
      AND r.rolname LIKE 'taptime_%' AND NOT r.rolsuper AND r.rolname<>'taptime_lock_screen_owner'
      AND (has_table_privilege(r.oid,c.oid,'SELECT,INSERT,UPDATE,DELETE'))`)).rows).toEqual([]);
    expect((await client.query(`SELECT rolname FROM pg_roles WHERE rolname LIKE 'taptime_%'
      AND NOT rolsuper AND rolname<>'taptime_lock_screen_owner'
      AND has_schema_privilege(oid,'taptime_crypto','USAGE,CREATE')`)).rows).toEqual([]);
  } finally { client.release(); }
  const limited = await runtime.connect();
  try {
    await limited.query('BEGIN'); await limited.query('SET LOCAL ROLE taptime_server_lifecycle');
    await expect(limited.query('SELECT * FROM taptime_server.lock_screen_capabilities')).rejects.toMatchObject({ code: '42501' });
  } finally { await limited.query('ROLLBACK'); limited.release(); }
});

it('returns the marker only in authorized managed-person history and keeps duration identical to export', async () => {
  const p = await person(), { capability } = await issue(p);
  await action(capability, 'pause'); await action(capability, 'stop');
  const client = await runtime.connect();
  try {
    await client.query('BEGIN');
    const admin = { organization: ids.organizationA, user: ids.adminA, member: ids.membershipAdminA };
    await context(client, 'taptime_membership_manager', admin, 'administrator');
    const read = await readManagedPerson(client, { accessToken: tokens.adminA, expectedMembershipId: ids.membershipAdminA, targetMembershipId: p.member,
      fromInclusive: new Date(Date.now() - 60000).toISOString(), toExclusive: new Date(Date.now() + 60000).toISOString(), cursor: null, limit: 20 }, true);
    expect(read.status).toBe('succeeded');
    if (read.status !== 'succeeded') throw new Error('Missing person history');
    const record = read.value.records.find(r => r.timeRecordId === p.entry)!;
    expect(record.details?.lockScreenActions?.map(e => e.action)).toEqual(['pause', 'resume', 'stop']);
    await context(client, 'taptime_time_exporter', admin, 'administrator');
    const exported = (await client.query('SELECT * FROM taptime_server.read_effective_time_entry_export_v3($1,$2,$3,10001)',
      [p.organization, new Date(Date.now() - 60000).toISOString(), new Date(Date.now() + 60000).toISOString()])).rows.find(r => r.time_entry_id === p.entry);
    expect(Number(exported.effective_work_duration_seconds)).toBe(record.calendar?.workDurationSeconds);
    expect(exported.stopped_via).toBe('manual');
    await context(client, 'taptime_membership_manager', { organization: ids.organizationB, user: ids.adminB, member: ids.membershipAdminB }, 'administrator');
    expect((await client.query('SELECT * FROM taptime_server.read_lock_screen_history_v1($1::uuid[])', [[p.entry]])).rows).toEqual([]);
  } finally { await client.query('ROLLBACK'); client.release(); }
});

it('after an administration stop, Beenden cannot start another time (blind-toggle red witness)', async () => {
  const p = await person(), { capability } = await issue(p);
  await administrativeStop(p);
  const before = await eventCount(p);
  if (process.env.T104A_BLIND_TOGGLE === '1') {
    // Mutation witness: substitute the actual legacy blind manual trigger for the checked action.
    const engine = await readFile(new URL('../../../packages/core/src/business/BusinessEngine.ts', import.meta.url), 'utf8');
    const bounce = Number(engine.match(/DUPLICATE_WINDOW_MILLISECONDS\s*=\s*([\d_]+)/)?.[1]?.replaceAll('_', ''));
    if (!Number.isFinite(bounce)) throw new Error('Missing engine duplicate window');
    await new Promise(resolve => setTimeout(resolve, bounce + 50));
    const blind = await manual.ingestManual({ accessToken: p.token, expectedMembershipId: MembershipId(p.member),
      workEvent: { id: WorkEventId(randomUUID()), target: customerAssignmentTarget(CustomerId(p.target)) }, receipt: { id: randomUUID(), attemptNumber: 1 } });
    expect(blind).toMatchObject({ status: 'synchronized', decision: { status: 'time_entry_started' } });
  } else {
    expect(await action(capability, 'stop')).toMatchObject({ status: 'state_changed', state: { status: 'stopped' } });
  }
  expect((await installer.query("SELECT id FROM taptime_server.time_entries WHERE user_id=$1 AND status='started'", [p.user])).rows).toEqual([]);
  expect(await eventCount(p)).toBe(before);
});

it('does not acknowledge an unarchived action; retry archives the same events without another booking', async () => {
  const p = await person(), { capability } = await issue(p), commandId = randomUUID();
  const pending = { requireOffsiteArchive: vi.fn(async () => ({ requiredWalFile: '000000010000000000000001', offsiteArchived: false })) };
  const coordinator = new LockScreenCoordinator(runtime, verifier, pending);
  const before = await eventCount(p);
  await expect(coordinator.perform(capability, { action: 'pause', commandId })).rejects.toThrow('Lock screen operation unavailable');
  expect(await eventCount(p)).toBe(before + 1);
  expect(await action(capability, 'pause', commandId)).toMatchObject({ status: 'applied', idempotentRetry: true });
  expect(await eventCount(p)).toBe(before + 1);
});
