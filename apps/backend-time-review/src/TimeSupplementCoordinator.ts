import type { Pool } from 'pg';
import type { AccessTokenVerifier } from '@taptime/backend-identity';
import { isBackfillTimeRequest, isCommentTimeRequest, isTimeSupplementResult,
  type TimeSupplementResult } from '@taptime/mobile-work-contract';

/** Online-only supplemental evidence. No WorkEvent, lease, or synchronization dependency. */
export class TimeSupplementCoordinator {
  constructor(private readonly pool: Pool, private readonly verifier: AccessTokenVerifier) {}
  async execute(accessToken: string, kind: 'backfill'|'comment', request: unknown): Promise<TimeSupplementResult> {
    if (!(kind==='backfill' ? isBackfillTimeRequest(request) : isCommentTimeRequest(request))) return {status:'invalid_request'};
    const expectedMembershipId=(request as {expectedMembershipId:string}).expectedMembershipId;
    const identity=await this.verifier.verify(accessToken);
    if (identity.status!=='verified') return {status:'authority_rejected'};
    const client=await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query("SET LOCAL statement_timeout='7s'");
      await client.query("SET LOCAL lock_timeout='5s'");
      await client.query('SET LOCAL ROLE taptime_identity_resolver');
      const actor=(await client.query(`SELECT * FROM taptime_server.lock_request_actor($1,$2)`,[identity.identity.issuer,identity.identity.subject])).rows;
      if (actor.length!==1 || actor[0].membership_id!==expectedMembershipId) {
        await client.query('ROLLBACK'); return {status:'authority_rejected'};
      }
      const a=actor[0];
      await client.query(`SELECT set_config('app.organization_id',$1,true),set_config('app.user_id',$2,true),
        set_config('app.membership_id',$3,true),set_config('app.membership_role',$4,true)`,
        [a.organization_id,a.user_id,a.membership_id,a.membership_role]);
      await client.query('SET LOCAL ROLE taptime_time_review_writer');
      const result=(await client.query(`SELECT taptime_server.${kind==='backfill'?'backfill_time_record_v1':'comment_time_record_v1'}($1::jsonb) AS result`,[JSON.stringify(request)])).rows[0]?.result;
      if (!isTimeSupplementResult(result)) throw new Error('Invalid supplemental result');
      await client.query('COMMIT'); return result;
    } catch {
      await client.query('ROLLBACK'); return {status:'unavailable'};
    } finally { client.release(); }
  }
}
