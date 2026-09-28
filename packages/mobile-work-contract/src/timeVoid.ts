/** Stornierungen are separate history, never duration-bearing time records. */
export const VOID_REASONS = {duplicate:'Doppelt erfasst',misscan:'Fehlscan',other:'Sonstiges'} as const;
export type VoidReasonCode = keyof typeof VOID_REASONS;
export interface VoidTimeRequest {
  readonly expectedMembershipId:string; readonly commandId:string; readonly timeRecordId:string;
  readonly reasonCode:VoidReasonCode; readonly reasonText:string|null;
}
export type VoidTimeResult = {readonly status:'committed';readonly timeRecordId:string;readonly idempotentRetry:boolean}
  | {readonly status:'forbidden'|'running'|'review_open'|'already_voided'|'command_id_conflict'|'invalid_request'|'unavailable'|'authority_rejected'};
export interface VoidedTimeRecord {
  readonly timeRecordId:string; readonly targetDisplayName:string; readonly startedAt:string; readonly stoppedAt:string;
  readonly voidedAt:string; readonly actorDisplayName:string; readonly reasonCode:VoidReasonCode; readonly reasonText:string|null;
}
export interface VoidedTimeQuery {
  readonly expectedMembershipId:string; readonly targetMembershipId:string; readonly fromInclusive:string; readonly toExclusive:string;
  readonly afterId:string|null; readonly limit:number;
}
export type VoidedTimeResponse = {readonly status:'ready';readonly records:readonly VoidedTimeRecord[];readonly nextAfterId:string|null}
  | {readonly status:'forbidden'|'invalid_request'|'unavailable'|'authority_rejected'};
export type VoidedTimeSelection = {readonly status:'ready';readonly records:readonly VoidedTimeRecord[]}
  | {readonly status:'forbidden'|'invalid_request'|'unavailable'|'authority_rejected'|'offline'};
const object=(v:unknown):v is Record<string,unknown>=>typeof v==='object'&&v!==null&&!Array.isArray(v);
const keys=(v:Record<string,unknown>,names:readonly string[])=>Object.keys(v).length===names.length&&names.every(n=>Object.hasOwn(v,n));
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v);
const timestamp=(v:unknown):v is string=>typeof v==='string'&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString()===v;
export const isVoidReason=(code:unknown,text:unknown)=>typeof code==='string'&&Object.hasOwn(VOID_REASONS,code)
  && (code==='other'?typeof text==='string'&&text.trim().length>0&&Array.from(text).length<=500:text===null);
export function isVoidTimeRequest(v:unknown):v is VoidTimeRequest {
  return object(v)&&keys(v,['expectedMembershipId','commandId','timeRecordId','reasonCode','reasonText'])
    &&uuid(v.expectedMembershipId)&&uuid(v.commandId)&&uuid(v.timeRecordId)&&isVoidReason(v.reasonCode,v.reasonText);
}
export function isVoidTimeResult(v:unknown):v is VoidTimeResult {
  return object(v)&&(v.status==='committed'?keys(v,['status','timeRecordId','idempotentRetry'])&&uuid(v.timeRecordId)&&typeof v.idempotentRetry==='boolean'
    :keys(v,['status'])&&['forbidden','running','review_open','already_voided','command_id_conflict','invalid_request','unavailable','authority_rejected'].includes(String(v.status)));
}
export function isVoidedTimeQuery(v:unknown):v is VoidedTimeQuery {
  return object(v)&&keys(v,['expectedMembershipId','targetMembershipId','fromInclusive','toExclusive','afterId','limit'])
    &&uuid(v.expectedMembershipId)&&uuid(v.targetMembershipId)&&timestamp(v.fromInclusive)&&timestamp(v.toExclusive)
    &&Date.parse(v.toExclusive)>Date.parse(v.fromInclusive)
    &&(v.afterId===null||uuid(v.afterId))&&Number.isInteger(v.limit)&&Number(v.limit)>=1&&Number(v.limit)<=100;
}
export function isVoidedTimeResponse(v:unknown):v is VoidedTimeResponse {
  if(!object(v))return false;
  if(v.status!=='ready')return keys(v,['status'])&&['forbidden','invalid_request','unavailable','authority_rejected'].includes(String(v.status));
  return keys(v,['status','records','nextAfterId'])&&(v.nextAfterId===null||uuid(v.nextAfterId))&&Array.isArray(v.records)&&v.records.length<=100
    &&v.records.every(r=>object(r)&&keys(r,['timeRecordId','targetDisplayName','startedAt','stoppedAt','voidedAt','actorDisplayName','reasonCode','reasonText'])
      &&uuid(r.timeRecordId)&&typeof r.targetDisplayName==='string'&&typeof r.actorDisplayName==='string'
      &&timestamp(r.startedAt)&&timestamp(r.stoppedAt)&&Date.parse(r.stoppedAt)>=Date.parse(r.startedAt)&&timestamp(r.voidedAt)&&isVoidReason(r.reasonCode,r.reasonText));
}
export async function loadVoidedTimePages(query:Omit<VoidedTimeQuery,'afterId'|'limit'>,
  read:(query:VoidedTimeQuery)=>Promise<VoidedTimeResponse>):Promise<VoidedTimeSelection> {
  const records:VoidedTimeRecord[]=[],seen=new Set<string>();let afterId:string|null=null;
  do {
    const result=await read({...query,afterId,limit:100});
    if(result.status!=='ready')return result;
    for(const record of result.records){if(seen.has(record.timeRecordId))return {status:'unavailable'};seen.add(record.timeRecordId);records.push(record);}
    if(result.nextAfterId!==null&&(result.records.length===0||result.nextAfterId!==result.records.at(-1)?.timeRecordId))return {status:'unavailable'};
    afterId=result.nextAfterId;
  }while(afterId!==null);
  return {status:'ready',records};
}
