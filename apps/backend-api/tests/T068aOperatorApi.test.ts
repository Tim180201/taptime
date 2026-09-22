import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { migrate } from '../../backend-schema/src/index.js';
import { ids, seedB3, truncateB3 } from '../../backend-schema/tests/fixtures.js';
import { OperatorCoordinator } from '../src/OperatorCoordinator.js';
import { createBackendHttpServer, requestRateLimitScope } from '../src/BackendHttpServer.js';
import { createBackendApiRuntime, type BackendApiRuntimeConfiguration } from '../src/runtime.js';
import type { BackendApiDependencies } from '../src/types.js';
import { closeServer, listen } from './fixtures.js';
import { EmployeeMembershipEnrollmentCoordinator } from '../../backend-administration/src/EmployeeMembershipEnrollmentCoordinator.js';
import type { SupabaseAccountInviter } from '../../backend-administration/src/SupabaseAccountInviter.js';
import { MembershipId } from '@taptime/core';

const pool = new Pool({connectionString:process.env.B3_DATABASE_URL ?? 'postgresql://timbartz@127.0.0.1:5432/taptime_b3'});
const issuer='https://synthetic.invalid/auth';
const operator='90000000-0000-4000-8000-000000000001';
const verifier={verify:vi.fn(async (token:string) => ({status:'verified' as const,
  identity:{issuer,subject:token==='member'?'employee-a':'operator'},aal:token==='low'?'aal1' as const:'aal2' as const}))};
beforeAll(async () => {
  await pool.query('DROP SCHEMA IF EXISTS taptime_server CASCADE; DROP TABLE IF EXISTS public.taptime_server_schema_migrations');
  await migrate(pool);
});
beforeEach(async () => {
  await truncateB3(pool); await pool.query('TRUNCATE taptime_server.platform_operators CASCADE'); await seedB3(pool);
  await pool.query('INSERT INTO taptime_server.platform_operators(id,issuer,subject) VALUES($1,$2,\'operator\')',[operator,issuer]);
});
afterAll(() => pool.end());
it('requires MFA for every action and active operator authority even for session', async () => {
  const coordinator=new OperatorCoordinator(pool,verifier);
  expect(await coordinator.execute('low','session',{})).toEqual({status:'mfa_required',aal:'aal1'});
  for (const action of ['overview','create','status','audit','health'] as const) {
    expect(await coordinator.execute('low',action,{})).toEqual({status:'mfa_required'});
    expect(await coordinator.execute('member',action,{})).toEqual({status:'forbidden'});
  }
  expect(await coordinator.execute('high','session',{})).toEqual({status:'active',aal:'aal2'});
  await pool.query('UPDATE taptime_server.platform_operators SET revoked_at=now() WHERE id=$1',[operator]);
  expect(await coordinator.execute('high','session',{})).toEqual({status:'forbidden'});
});
it('rolls back provider failures and uses an idempotent command before sending mail', async () => {
  const invite=vi.fn().mockResolvedValue({status:'invitation_delivery_failed'});
  const inviter={issuer,invite,needsAttention:vi.fn()};
  const coordinator=new OperatorCoordinator(pool,verifier,inviter);
  const request={commandId:'93000000-0000-4000-8000-000000000001',name:'Neuer Betrieb',email:'admin@example.invalid'};
  expect(await coordinator.execute('high','create',request)).toEqual({status:'invitation_delivery_failed'});
  expect((await pool.query('SELECT count(*)::int count FROM taptime_server.organizations')).rows[0].count).toBe(2);
  invite.mockResolvedValue({status:'invited',subject:'new-admin'});
  const result=await coordinator.execute('high','create',request);
  expect(result.status).toBe('succeeded');
  expect(await coordinator.execute('high','create',request)).toEqual(result);
  expect(invite).toHaveBeenCalledTimes(2);
  invite.mockResolvedValue({status:'existing',subject:'employee-a'});
  expect(await coordinator.execute('high','create',{...request,commandId:'93000000-0000-4000-8000-000000000002'}))
    .toEqual({status:'identity_unavailable'});
});
it('has a separate 30/min budget and returns 404 for other forwarded hosts', async () => {
  expect(requestRateLimitScope('/v1/operator/overview')).toBe('operator_api');
  const execute=vi.fn().mockResolvedValue({status:'active',aal:'aal2'});
  const server=createBackendHttpServer({operator:{execute}} as unknown as BackendApiDependencies);
  await listen(server); const address=server.address();
  if (!address || typeof address==='string') throw new Error('No address');
  try {
    for (const host of ['admin.tb-infra.de','api.tb-infra.de','betreiber.tb-infra.de.evil','']) {
      const response=await fetch(`http://127.0.0.1:${address.port}/v1/operator/session`,{headers:{'x-forwarded-host':host,authorization:'Bearer a.b.c'}});
      expect(response.status).toBe(404); await response.text();
    }
    expect(execute).not.toHaveBeenCalled();
    const response=await fetch(`http://127.0.0.1:${address.port}/v1/operator/session`,{headers:{'x-forwarded-host':'betreiber.tb-infra.de',authorization:'Bearer a.b.c'}});
    expect(response.status).toBe(200); await response.text();
  } finally {await closeServer(server);}
});
it('starts without operator credentials and rejects a reused tenant login', async () => {
  const fields=['session','readModel','lifecycle','administration','employeeInvitation','employeeEnrollment','reassignment',
    'offlineLease','offlineEvent','offlineReconciliation','timeEntryExport','timeReviewRead','timeReviewWrite'];
  const config={...Object.fromEntries(fields.map(f => [`${f}DatabaseUrl`,`postgresql://${f}@127.0.0.1:55468/taptime_t068a`])),
    supabaseIssuer:'https://example.supabase.co/auth/v1'} as unknown as BackendApiRuntimeConfiguration;
  expect(() => createBackendApiRuntime({...config,operatorDatabaseUrl:config.sessionDatabaseUrl})).toThrow(/distinct|separate|different/i);
  const runtime=createBackendApiRuntime(config); await listen(runtime.server);
  const address=runtime.server.address(); if (!address || typeof address==='string') throw new Error('No address');
  try {
    const response=await fetch(`http://127.0.0.1:${address.port}/v1/operator/session`,{headers:{'x-forwarded-host':'betreiber.tb-infra.de'}});
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({error:{code:'operator_not_configured'}});
  } finally {await runtime.close();}
});

it('serializes concurrent operator and 026 invitations for the same normalized email', async () => {
  const arrived = gate();
  const release = gate();
  const subject = '94000000-0000-4000-8000-000000000001';
  const operatorInviter = { issuer, needsAttention: vi.fn(), invite: vi.fn(async () => {
    arrived.resolve(); await release.promise;
    return { status: 'invited' as const, subject };
  }) };
  const memberInviter = { issuer, needsAttention: vi.fn(),
    invite: vi.fn(async () => ({ status: 'existing' as const, subject })) };
  const memberVerifier = { verify: async () => ({ status: 'verified' as const, identity: { issuer, subject: 'admin-a' } }) };
  const operatorCoordinator = new OperatorCoordinator(pool, verifier, operatorInviter);
  const memberCoordinator = new EmployeeMembershipEnrollmentCoordinator(pool, pool, memberVerifier,
    memberInviter as unknown as SupabaseAccountInviter);
  const creating = operatorCoordinator.execute('high', 'create', {
    commandId: '94000000-0000-4000-8000-000000000002', name: 'Concurrent', email: ' SAME@Example.invalid ',
  });
  await arrived.promise;
  const inviting = memberCoordinator.createAccountInvitation({ accessToken: 'admin',
    expectedMembershipId: MembershipId('12000000-0000-4000-8000-000000000001'),
    commandId: '94000000-0000-4000-8000-000000000003', displayName: 'Same person',
    email: 'same@example.invalid', locationId: null });
  try {
    await vi.waitFor(async () => {
      const waiting = await pool.query(`SELECT FROM pg_stat_activity WHERE datname=current_database()
        AND pid<>pg_backend_pid() AND query LIKE '%employee_account_invitation_v1(%' AND wait_event_type='Lock'`);
      expect(waiting.rowCount! > 0 || memberInviter.invite.mock.calls.length > 0).toBe(true);
    });
    expect(memberInviter.invite).not.toHaveBeenCalled();
  } finally { release.resolve(); await Promise.allSettled([creating, inviting]); }
  expect((await creating).status).toBe('succeeded');
  expect(await inviting).toEqual({ status: 'email_exists' });
  expect(operatorInviter.needsAttention).not.toHaveBeenCalled();
});

function gate(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>(complete => { resolve = complete; });
  return { promise, resolve };
}

it('reports ambiguous invitations', async () => {
  const invite = vi.fn().mockResolvedValue({ status: 'invitation_needs_attention' });
  const needsAttention = vi.fn();
  const coordinator = new OperatorCoordinator(pool, verifier, { issuer, invite, needsAttention });
  const request = { commandId: '95000000-0000-4000-8000-000000000001', name: 'Rejected', email: 'repair@example.invalid' };
  expect(await coordinator.execute('high', 'create', request)).toEqual({ status: 'invitation_needs_attention' });
  expect(needsAttention).toHaveBeenCalledWith(request.email,
    expect.objectContaining({ correlationId: request.commandId, operatorId: operator }));
});
it('reports external success without a local completion', async () => {
  const invite = vi.fn();
  const needsAttention = vi.fn();
  const coordinator = new OperatorCoordinator(pool, verifier, { issuer, invite, needsAttention });
  const request = { commandId: '95000000-0000-4000-8000-000000000001', name: 'Rejected', email: 'repair@example.invalid' };
  const subject = '95000000-0000-4000-8000-000000000002';
  invite.mockResolvedValue({ status: 'invited', subject });
  await pool.query("ALTER TABLE taptime_server.organizations ADD CONSTRAINT t068a_completion_failure CHECK(name <> 'Rejected')");
  try {
    expect(await coordinator.execute('high', 'create', request)).toEqual({ status: 'invitation_needs_attention' });
    expect(needsAttention).toHaveBeenCalledWith(request.email,
      expect.objectContaining({ correlationId: request.commandId, operatorId: operator }), subject);
    expect((await pool.query('SELECT FROM taptime_server.identity_bindings WHERE subject=$1', [subject])).rowCount).toBe(0);
  } finally { await pool.query('ALTER TABLE taptime_server.organizations DROP CONSTRAINT t068a_completion_failure'); }
});
