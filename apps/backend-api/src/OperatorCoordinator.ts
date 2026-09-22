import type { Pool } from 'pg';
import type { AccessTokenVerifier } from '@taptime/backend-identity';
import { accountInvitationEmailHash, normalizeInvitationEmail, type AccountInvitationContext, type SupabaseAccountInviter } from '@taptime/backend-administration';

export type OperatorAction = 'session' | 'overview' | 'create' | 'status' | 'audit' | 'health';
type Result = Record<string,unknown> & {status:string};
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** A separate capability connection; tenant coordinators and credentials never enter here. */
export class OperatorCoordinator {
  constructor(private readonly pool: Pool, private readonly verifier: AccessTokenVerifier,
    private readonly inviter?: Pick<SupabaseAccountInviter,'issuer'|'invite'|'needsAttention'>,
    private readonly version: string|null = null) {}

  async execute(token: string,action: OperatorAction,input: unknown): Promise<Result> {
    const verified = await this.verifier.verify(token);
    if (verified.status !== 'verified') return {status:'unauthorized'};
    const client = await this.pool.connect();
    let committed = false;
    let invitationContext: AccountInvitationContext | undefined;
    let invitationEmail: string | undefined;
    let invitedSubject: string | undefined;
    try {
      await client.query('BEGIN ISOLATION LEVEL READ COMMITTED');
      await client.query("SET LOCAL statement_timeout='8s'; SET LOCAL idle_in_transaction_session_timeout='10s'; SET LOCAL ROLE taptime_platform_operator");
      const query = async (sql: string,args: unknown[] = []): Promise<Result> => {
        const row = (await client.query<{result:Result}>(`SELECT taptime_server.${sql} AS result`,args)).rows[0];
        if (!row || typeof row.result?.status!=='string') throw new Error('Invalid operator result');
        return row.result;
      };
      const session = await query('read_operator_session_v1($1,$2)',[verified.identity.issuer,verified.identity.subject]);
      if (session.status!=='active') return {status:'forbidden'};
      if (verified.aal!=='aal1' && verified.aal!=='aal2') return {status:'unauthorized'};
      if (action!=='session' && verified.aal!=='aal2') return {status:'mfa_required'};
      let result: Result;
      if (action==='session') result={status:verified.aal==='aal2'?'active':'mfa_required',aal:verified.aal};
      else if (!record(input)) return {status:'invalid_request'};
      else if (action==='overview' && keys(input,[])) result=await query('read_operator_overview_v1()');
      else if (action==='health' && keys(input,[])) result={...await query('read_operator_health_v1()'),version:this.version};
      else if (action==='audit' && keys(input,['before','limit'],true)) {
        if ((input.before!==undefined && input.before!==null && (typeof input.before!=='string' || !/^[1-9][0-9]{0,17}$/.test(input.before)))
          || (input.limit!==undefined && (!Number.isInteger(input.limit) || Number(input.limit)<1 || Number(input.limit)>100))) return {status:'invalid_request'};
        result=await query('read_platform_audit_v1($1,$2)',[input.before??null,input.limit??50]);
      } else if (action==='status' && keys(input,['commandId','organizationId','status','reason','rowVersion'])
        && validUuid(input.commandId) && validUuid(input.organizationId) && (input.status==='active'||input.status==='paused')
        && typeof input.reason==='string' && input.reason.trim().length>0 && input.reason.length<=500
        && Number.isSafeInteger(input.rowVersion) && Number(input.rowVersion)>0) {
        result=await query('operator_set_organization_status_v1($1,$2,$3,$4,$5)',
          [input.commandId,input.organizationId,input.status,input.reason,input.rowVersion]);
      } else if (action==='create' && keys(input,['commandId','name','email']) && validUuid(input.commandId)
        && typeof input.name==='string' && input.name.length<=4096) {
        if (!this.inviter) return {status:'account_creation_not_configured'};
        const email=normalizeInvitationEmail(input.email);
        if (email===null) return {status:'invalid_email'};
        const hash=accountInvitationEmailHash(email);
        const args=[input.commandId,input.name,hash,this.inviter.issuer];
        result=await query('operator_create_organization_v1($1,$2,$3,$4,NULL)',args);
        if (result.status==='prepared') {
          const operatorId=(await client.query<{id:string}>("SELECT current_setting('app.operator_id') id")).rows[0]!.id;
          invitationContext={correlationId:input.commandId,operatorId,deadlineEpochMilliseconds:Date.now()+7_000};
          invitationEmail=email;
          const invitation=await this.inviter.invite(email,invitationContext);
          if (invitation.status!=='invited' && invitation.status!=='existing') {
            if (invitation.status==='invitation_needs_attention') this.inviter.needsAttention(email,invitationContext);
            return {status:invitation.status};
          }
          if (invitation.status==='invited') invitedSubject=invitation.subject;
          result=await query('operator_create_organization_v1($1,$2,$3,$4,$5)',[...args,invitation.subject]);
          if (invitedSubject!==undefined && result.status!=='succeeded') throw new Error('Operator invitation completion rejected');
        }
      } else return {status:'invalid_request'};
      await client.query('COMMIT'); committed=true;
      return result;
    } catch (error) {
      if (invitedSubject!==undefined && invitationContext!==undefined && invitationEmail!==undefined) {
        this.inviter!.needsAttention(invitationEmail,invitationContext,invitedSubject);
        return {status:'invitation_needs_attention'};
      }
      throw error;
    } finally {
      if (!committed) await client.query('ROLLBACK').catch(() => undefined);
      client.release();
    }
  }
}
function record(value: unknown): value is Record<string,unknown> {return value!==null && typeof value==='object' && !Array.isArray(value);}
function validUuid(value: unknown): value is string {return typeof value==='string' && uuid.test(value);}
function keys(value: Record<string,unknown>,allowed: string[],optional=false): boolean {
  return Object.keys(value).every(k=>allowed.includes(k)) && (optional || Object.keys(value).length===allowed.length);
}
