import { validateClosedPageRequest, validateWorkTargetResponse, type MobileWorkTargetQueryResponse, type SafeWorkTarget, validateOwnTimeResponse, type SafeOwnTimeRecord, type MobileOwnTimeQueryResponse } from './index.js';

export const TIME_DETAILS_ACCEPT = 'application/vnd.taptime.time-details.v2+json';
export interface TimeRecordDetails {
  readonly administrationStop?: { readonly at: string; readonly reason: string };
  readonly origin: 'nfc' | 'manual' | 'backfilled' | 'recovered';
  readonly baseRowVersion: number;
  readonly effectiveRevisionNumber: number;
  readonly comment: string | null;
  readonly changed: boolean;
  readonly change: { readonly at: string; readonly reason: string; readonly actor: 'self' | 'administration' } | null;
  readonly overlapsAnotherRecord: boolean;
}
export type DetailedTimeRecord = SafeOwnTimeRecord & { readonly details: TimeRecordDetails };
export interface DetailedTimeResponse extends Omit<MobileOwnTimeQueryResponse,'activeRecord'|'records'> {
  readonly activeRecord: DetailedTimeRecord | null;
  readonly records: readonly DetailedTimeRecord[];
}
export interface BackfillTimeRequest {
  readonly expectedMembershipId: string; readonly targetMembershipId: string; readonly commandId: string;
  readonly targetType: 'customer'|'project'|'general_work'; readonly targetId: string;
  readonly startedAt: string; readonly stoppedAt: string; readonly reason: string|null; readonly comment: string|null;
}
export interface CommentTimeRequest {
  readonly expectedMembershipId: string; readonly commandId: string; readonly timeRecordId: string; readonly comment: string;
}
export type TimeSupplementResult = { readonly status: 'committed'; readonly timeRecordId: string; readonly idempotentRetry: boolean }
  | { readonly status: 'authority_rejected'|'invalid_request'|'invalid_interval'|'outside_window'|'reason_required'|'invalid_comment'|'overlap'|'command_id_conflict'|'unavailable' };
const object = (v:unknown):v is Record<string,unknown> => typeof v==='object' && v!==null && !Array.isArray(v);
const keys = (v:Record<string,unknown>, k:string[]) => Object.keys(v).length===k.length && k.every(key=>Object.hasOwn(v,key));
const uuid = (v:unknown):v is string => typeof v==='string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v);
const timestamp = (v:unknown):v is string => typeof v==='string' && Number.isFinite(Date.parse(v)) && new Date(v).toISOString()===v;
const text = (v:unknown):v is string => typeof v==='string' && Array.from(v.trim()).length>=1 && Array.from(v).length<=500;
// Historical correction reasons use PostgreSQL btrim, including space-padded
// reasons and whitespace other than U+0020. Do not reinterpret stored history.
const historicalReason = (v:unknown):v is string => {
  if(typeof v!=='string') return false;
  const length=Array.from(v.replace(/^ +| +$/g,'')).length;
  return length>=1 && length<=500;
};
export function isBackfillTimeRequest(v:unknown):v is BackfillTimeRequest {
  return object(v) && keys(v,['expectedMembershipId','targetMembershipId','commandId','targetType','targetId','startedAt','stoppedAt','reason','comment'])
    && uuid(v.expectedMembershipId) && uuid(v.targetMembershipId) && uuid(v.commandId) && uuid(v.targetId)
    && ['customer','project','general_work'].includes(String(v.targetType)) && timestamp(v.startedAt) && timestamp(v.stoppedAt)
    && (v.reason===null || text(v.reason)) && (v.comment===null || text(v.comment));
}
export function isCommentTimeRequest(v:unknown):v is CommentTimeRequest {
  return object(v) && keys(v,['expectedMembershipId','commandId','timeRecordId','comment'])
    && uuid(v.expectedMembershipId) && uuid(v.commandId) && uuid(v.timeRecordId) && text(v.comment);
}
export function isTimeRecordDetails(v:unknown):v is TimeRecordDetails {
  return object(v) && keys(v,['origin','baseRowVersion','effectiveRevisionNumber','comment','changed','change','overlapsAnotherRecord',
      ...(Object.hasOwn(v,'administrationStop')?['administrationStop']:[])])
    && (!Object.hasOwn(v,'administrationStop') || (object(v.administrationStop) && keys(v.administrationStop,['at','reason'])
      && timestamp(v.administrationStop.at) && historicalReason(v.administrationStop.reason)))
    && ['nfc','manual','backfilled','recovered'].includes(String(v.origin))
    && Number.isSafeInteger(v.baseRowVersion) && Number(v.baseRowVersion)>=0
    && Number.isSafeInteger(v.effectiveRevisionNumber) && Number(v.effectiveRevisionNumber)>=0
    && (v.comment===null || text(v.comment)) && typeof v.changed==='boolean' && typeof v.overlapsAnotherRecord==='boolean'
    && (v.change===null || (object(v.change) && keys(v.change,['at','reason','actor']) && timestamp(v.change.at)
      && historicalReason(v.change.reason) && ['self','administration'].includes(String(v.change.actor))));
}
export function isDetailedTimeResponse(v:unknown):v is DetailedTimeResponse {
  if (!object(v) || !Array.isArray(v.records)) return false;
  const records=[...v.records,...(v.activeRecord===null?[]:[v.activeRecord])];
  if (!records.every(r=>object(r) && isTimeRecordDetails(r.details))) return false;
  const base=(r:Record<string,unknown>)=>{const {details,...rest}=r;return {...rest,stoppedVia:rest.stoppedVia==='administration'?'manual':rest.stoppedVia};};
  return validateOwnTimeResponse({...v,records:v.records.map(base),activeRecord:v.activeRecord===null?null:base(v.activeRecord as Record<string,unknown>)});
}
export function isTimeSupplementResult(v:unknown):v is TimeSupplementResult {
  return object(v) && (v.status==='committed'
    ? keys(v,['status','timeRecordId','idempotentRetry']) && uuid(v.timeRecordId) && typeof v.idempotentRetry==='boolean'
    : keys(v,['status']) && ['authority_rejected','invalid_request','invalid_interval','outside_window','reason_required','invalid_comment','overlap','command_id_conflict','unavailable'].includes(String(v.status)));
}

export interface BackfillTargetQueryRequest {
  readonly expectedMembershipId: string;
  readonly targetMembershipId: string;
  readonly limit: number;
  readonly cursor: string | null;
}
export type BackfillTargetQueryResponse = MobileWorkTargetQueryResponse & { readonly status: 'ready' };
export type BackfillTargetSelection = { readonly status: 'ready'; readonly targets: readonly SafeWorkTarget[] }
  | { readonly status: 'authority_rejected' | 'unavailable' | 'offline' };
export function isBackfillTargetQueryRequest(value:unknown):value is BackfillTargetQueryRequest {
  if(!object(value) || !uuid(value.targetMembershipId)) return false;
  const {targetMembershipId,...page}=value;
  return validateClosedPageRequest(page,50);
}
export function isBackfillTargetQueryResponse(value:unknown):value is BackfillTargetQueryResponse {
  if(!object(value) || value.status!=='ready') return false;
  const {status,...page}=value;
  return validateWorkTargetResponse(page);
}
