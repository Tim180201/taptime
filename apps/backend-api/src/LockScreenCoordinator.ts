import { createHash, randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import type { AccessTokenVerifier } from '@taptime/backend-identity';
import { isOrganizationPausedError } from '@taptime/backend-identity';
import { BusinessEngine, BreakIntervalId, MembershipId, TimeEntryId, WorkEventId, CustomerId, ProjectId, GeneralWorkTargetId,
  customerAssignmentTarget, projectWorkTarget, generalWorkTarget } from '@taptime/core';
import { applyManualLifecycleEvent, PostgresLifecycleArchiveDurability, LifecycleArchivePendingError,
  type LifecycleArchiveDurabilityPort } from '@taptime/backend-lifecycle';
import { isLockScreenCapability, isLockScreenCapabilityRequest, isLockScreenCapabilityResult, isLockScreenActionRequest,
  isLockScreenActionResult, isLockScreenState, type LockScreenCapabilityRequest, type LockScreenCapabilityResult,
  type LockScreenActionRequest, type LockScreenActionResult, type LockScreenState } from '@taptime/mobile-work-contract';

type Actor = { organization_id: string; user_id: string; membership_id: string; membership_role: 'employee' | 'standortleitung' | 'administrator' };
type EventReceipt = { workEventId: string; receiptId: string };
type PreparedAction = { status: 'prepared' | 'applied' | 'state_changed'; state: LockScreenState; actor: Actor; events: EventReceipt[]; idempotentRetry: boolean };

export class LockScreenCoordinator {
  private readonly engine = new BusinessEngine(() => TimeEntryId(randomUUID()), () => BreakIntervalId(randomUUID()));
  constructor(private readonly pool: Pool, private readonly verifier: AccessTokenVerifier,
    private readonly archive: LifecycleArchiveDurabilityPort = new PostgresLifecycleArchiveDurability()) {}

  async issue(accessToken: string, request: LockScreenCapabilityRequest): Promise<LockScreenCapabilityResult> {
    if (!isLockScreenCapabilityRequest(request)) return { status: 'unauthorized' };
    const identity = await this.verifier.verify(accessToken);
    if (identity.status !== 'verified') return { status: 'unauthorized' };
    return this.transaction(async client => {
      await client.query('SET LOCAL ROLE taptime_identity_resolver');
      const actor = (await client.query<Actor>('SELECT * FROM taptime_server.lock_request_actor($1,$2)',
        [identity.identity.issuer, identity.identity.subject])).rows[0];
      if (!actor || actor.membership_id !== request.expectedMembershipId) return { status: 'unauthorized' };
      await client.query(`SELECT set_config('app.organization_id',$1,true),set_config('app.user_id',$2,true),
        set_config('app.membership_id',$3,true),set_config('app.membership_role',$4,true)`,
      [actor.organization_id, actor.user_id, actor.membership_id, actor.membership_role]);
      await client.query('SET LOCAL ROLE taptime_server_lifecycle');
      const value: unknown = (await client.query('SELECT taptime_server.issue_lock_screen_capability_v1($1,$2) AS value',
        [request.timeEntryId, request.installationId])).rows[0]?.value;
      if (!isLockScreenCapabilityResult(value)) throw new Error('Invalid lock screen issue result');
      return value;
    });
  }

  async perform(capability: string, request: LockScreenActionRequest): Promise<LockScreenActionResult> {
    if (!isLockScreenCapability(capability) || !isLockScreenActionRequest(request)) return { status: 'unauthorized' };
    // Never hand plaintext to pg: even parameter/error logging can only see the digest.
    const digest = createHash('sha256').update(Buffer.from(capability, 'base64url')).digest();
    let receipts: EventReceipt[] = [];
    let archiveActor: Actor | undefined;
    return this.transaction(async client => {
      await client.query('SET LOCAL ROLE taptime_server_lifecycle');
      const prepared: PreparedAction | Exclude<LockScreenActionResult, { state: LockScreenState }> =
        (await client.query('SELECT taptime_server.perform_lock_screen_action_v1($1,$2,$3) AS value',
          [digest, request.action, request.commandId])).rows[0]?.value;
      if (prepared.status !== 'prepared' && prepared.status !== 'applied' && prepared.status !== 'state_changed') {
        if (!isLockScreenActionResult(prepared)) throw new Error('Invalid lock screen action result');
        return prepared;
      }
      if (!isLockScreenState(prepared.state)) throw new Error('Invalid lock screen action state');
      archiveActor = prepared.actor;
      receipts = prepared.events;
      if (prepared.status !== 'prepared') return { status: prepared.status, state: prepared.state, idempotentRetry: prepared.idempotentRetry };
      const state = prepared.state;
      const target = state.target.targetType === 'customer' ? customerAssignmentTarget(CustomerId(state.target.targetId))
        : state.target.targetType === 'project' ? projectWorkTarget(ProjectId(state.target.targetId))
          : generalWorkTarget(GeneralWorkTargetId(state.target.targetId));
      const actions = request.action === 'stop' && state.status === 'paused' ? ['resume', 'stop'] as const : [request.action];
      for (const action of actions) {
        const receipt = { workEventId: randomUUID(), receiptId: randomUUID() };
        const base = { accessToken: '', expectedMembershipId: MembershipId(prepared.actor.membership_id),
          receipt: { id: receipt.receiptId, attemptNumber: 1 as const } };
        const command = action === 'stop' ? { ...base, workEvent: { id: WorkEventId(receipt.workEventId), target } }
          : { ...base, workEvent: { id: WorkEventId(receipt.workEventId), subject: { type: 'break' as const } } };
        const occurredAt = (await client.query<{ at: Date }>("SELECT date_trunc('milliseconds',clock_timestamp()) AS at")).rows[0]!.at.toISOString();
        const { decision } = await applyManualLifecycleEvent(client, prepared.actor,
          command, this.engine, occurredAt, action);
        const expected = action === 'pause' ? 'break_started' : action === 'resume' ? 'break_stopped' : 'time_entry_stopped';
        if (decision.status !== expected) throw new Error('Lock screen action could not be applied');
        receipts.push(receipt);
      }
      const value: unknown = (await client.query('SELECT taptime_server.finish_lock_screen_action_v1($1,$2::jsonb) AS value',
        [request.commandId, JSON.stringify(receipts)])).rows[0]?.value;
      if (!isLockScreenActionResult(value)) throw new Error('Invalid lock screen completion');
      return value;
    }, async client => {
      if (!archiveActor) return;
      for (const receipt of receipts) {
        const result = await this.archive.requireOffsiteArchive(client, {
          organizationId: archiveActor.organization_id, userId: archiveActor.user_id,
          membershipId: archiveActor.membership_id, membershipRole: archiveActor.membership_role,
        }, receipt);
        if (!result.offsiteArchived) throw new LifecycleArchivePendingError();
      }
    });
  }

  private async transaction<T>(work: (client: PoolClient) => Promise<T>, afterCommit?: (client: PoolClient) => Promise<void>): Promise<T> {
    const client = await this.pool.connect();
    let open = false;
    let discard = false;
    try {
      await client.query('BEGIN ISOLATION LEVEL READ COMMITTED'); open = true;
      const value = await work(client);
      await client.query('COMMIT'); open = false;
      await afterCommit?.(client);
      return value;
    } catch (error) {
      if (open) await client.query('ROLLBACK').catch(() => { discard = true; });
      // Neither pg details nor a provider's token-bearing exception escapes this boundary.
      if (isOrganizationPausedError(error)) throw new Error('Lock screen authority unavailable');
      throw new Error('Lock screen operation unavailable');
    } finally { client.release(discard); }
  }
}
