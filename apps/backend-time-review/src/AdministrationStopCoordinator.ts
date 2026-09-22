import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import type { AccessTokenVerifier } from '@taptime/backend-identity';
import { BusinessEngine, WorkEventId, createTimestamp, type AdministrationWorkEvent,
  type StartedTimeEntry, type StartedBreakInterval } from '@taptime/core';
import { isAdministrationStopRequest, isAdministrationStopResult, type AdministrationStopResult } from '@taptime/mobile-work-contract';

/** Person lock, authorization, engine decision and both stop transitions share one transaction. */
export class AdministrationStopCoordinator {
  private readonly engine = new BusinessEngine();
  constructor(private readonly pool: Pool, private readonly verifier: AccessTokenVerifier) {}

  async execute(accessToken: string, request: unknown): Promise<AdministrationStopResult> {
    if (!isAdministrationStopRequest(request)) return { status: 'invalid_request' };
    const identity = await this.verifier.verify(accessToken);
    if (identity.status !== 'verified') return { status: 'authority_rejected' };
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query("SET LOCAL statement_timeout='7s'");
      await client.query("SET LOCAL lock_timeout='5s'");
      await client.query('SET LOCAL ROLE taptime_identity_resolver');
      const actors = (await client.query('SELECT * FROM taptime_server.lock_request_actor($1,$2)', [identity.identity.issuer, identity.identity.subject])).rows;
      const actor = actors[0];
      if (actors.length !== 1 || actor.membership_id !== request.expectedMembershipId || actor.membership_role !== 'administrator') {
        await client.query('ROLLBACK'); return { status: 'authority_rejected' };
      }
      await client.query(`SELECT set_config('app.organization_id',$1,true),set_config('app.user_id',$2,true),
        set_config('app.membership_id',$3,true),set_config('app.membership_role',$4,true)`,
      [actor.organization_id, actor.user_id, actor.membership_id, actor.membership_role]);
      await client.query('SET LOCAL ROLE taptime_time_review_writer');
      const payload = JSON.stringify(request);
      const context = (await client.query('SELECT taptime_server.prepare_administration_stop_v1($1::jsonb) AS result', [payload])).rows[0]?.result;
      let result: unknown = context;
      if (context?.status === 'ready') {
        const active: StartedTimeEntry = context.activeTimeEntry;
        const pause: StartedBreakInterval | null = context.activeBreakInterval;
        const event: AdministrationWorkEvent = {
          id: WorkEventId(randomUUID()), organizationId: active.organizationId, triggeredBy: active.userId,
          target: active.target, occurredAt: createTimestamp(request.stoppedAt), trigger: { type: 'administration' },
        };
        const decision = this.engine.evaluate(event, {
          activeTimeEntryForUser: active, activeBreakIntervalForUser: pause,
          // Explicit stop: SQL validates the interval against start and every pause boundary.
          previousAcceptedWorkEventForUserAndTarget: null,
        });
        result = (await client.query('SELECT taptime_server.commit_administration_stop_v1($1::jsonb,$2::jsonb,$3::jsonb) AS result',
          [payload, JSON.stringify(event), JSON.stringify(decision)])).rows[0]?.result;
      }
      if (typeof result !== 'object' || result === null || !('status' in result)) throw new Error('Invalid stop result');
      if (result.status !== 'committed') {
        if (!isAdministrationStopResult(result)) throw new Error('Invalid stop rejection');
        await client.query('COMMIT'); return result;
      }
      // The required WAL position must follow the commit containing the event.
      await client.query('COMMIT');
      await client.query('BEGIN');
      await client.query("SET LOCAL statement_timeout='7s'");
      await client.query("SET LOCAL lock_timeout='5s'");
      await client.query(`SELECT set_config('app.organization_id',$1,true),set_config('app.user_id',$2,true),
        set_config('app.membership_id',$3,true),set_config('app.membership_role',$4,true)`,
      [actor.organization_id, actor.user_id, actor.membership_id, actor.membership_role]);
      await client.query('SET LOCAL ROLE taptime_time_review_writer');
      const archive = (await client.query(
        'SELECT * FROM taptime_server.record_administration_stop_archive_requirement_v1($1::jsonb)', [payload])).rows[0];
      const acknowledged = { ...result, requiredWalFile: archive?.required_wal_file, offsiteArchived: archive?.offsite_archived };
      if (!isAdministrationStopResult(acknowledged)) throw new Error('Invalid archive acknowledgement');
      await client.query('COMMIT'); return acknowledged;
    } catch {
      await client.query('ROLLBACK'); return { status: 'unavailable' };
    } finally { client.release(); }
  }
}
