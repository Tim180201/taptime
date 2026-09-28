import { isOrganizationPausedError, type AccessTokenVerifier } from '@taptime/backend-identity';
import { isVoidTimeRequest,isVoidTimeResult,isVoidedTimeQuery,isVoidedTimeResponse,
  type VoidTimeResult,type VoidedTimeResponse } from '@taptime/mobile-work-contract';
import type { Pool } from 'pg';

/** Online evidence only; shares the least-privilege time-review runtime login. */
export class TimeVoidCoordinator {
  constructor(private readonly pool:Pool,private readonly verifier:AccessTokenVerifier){}
  async void(accessToken:string,request:unknown):Promise<VoidTimeResult> {
    if(!isVoidTimeRequest(request))return {status:'invalid_request'};
    return this.execute(accessToken,request,'void_time_record_v1',isVoidTimeResult);
  }
  async query(accessToken:string,request:unknown):Promise<VoidedTimeResponse> {
    if(!isVoidedTimeQuery(request))return {status:'invalid_request'};
    return this.execute(accessToken,request,'read_voided_time_records_v1',isVoidedTimeResponse);
  }
  private async execute<T extends VoidTimeResult|VoidedTimeResponse>(accessToken:string,request:{expectedMembershipId:string},
    fn:'void_time_record_v1'|'read_voided_time_records_v1',valid:(value:unknown)=>value is T):Promise<T|{status:'authority_rejected'|'unavailable'}> {
    const identity=await this.verifier.verify(accessToken);
    if(identity.status!=='verified')return {status:'authority_rejected'};
    const client=await this.pool.connect();
    try {
      await client.query('BEGIN ISOLATION LEVEL READ COMMITTED');
      await client.query("SET LOCAL statement_timeout='7s'");await client.query("SET LOCAL lock_timeout='5s'");
      await client.query('SET LOCAL ROLE taptime_identity_resolver');
      const rows=(await client.query('SELECT * FROM taptime_server.lock_request_actor($1,$2)',[identity.identity.issuer,identity.identity.subject])).rows;
      const actor=rows[0];
      if(rows.length!==1||actor.membership_id!==request.expectedMembershipId){await client.query('ROLLBACK');return {status:'authority_rejected'};}
      await client.query(`SELECT set_config('app.organization_id',$1,true),set_config('app.user_id',$2,true),
        set_config('app.membership_id',$3,true),set_config('app.membership_role',$4,true)`,
        [actor.organization_id,actor.user_id,actor.membership_id,actor.membership_role]);
      await client.query('SET LOCAL ROLE taptime_time_review_writer');
      const value:unknown=(await client.query(`SELECT taptime_server.${fn}($1::jsonb) AS result`,[JSON.stringify(request)])).rows[0]?.result;
      if(!valid(value))throw new Error('Invalid void result');
      await client.query('COMMIT');return value;
    }catch(error){await client.query('ROLLBACK');if(isOrganizationPausedError(error))throw error;return {status:'unavailable'};}
    finally{client.release();}
  }
}
