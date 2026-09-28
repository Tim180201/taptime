import { isCanonicalUuid } from './index.js';
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isIsoTimestamp = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/.test(v) && Number.isFinite(Date.parse(v));

export interface CustomerHoursRequest {
  readonly responseVersion?: 'customer-hours.v2';
  readonly expectedMembershipId: string;
  readonly fromInclusive: string;
  readonly toExclusive: string;
}
interface Duration { readonly workDurationSeconds: number; readonly running: boolean }
export interface CustomerDay extends Duration { readonly date: string }
export interface CustomerPerson extends Duration { readonly membershipId: string; readonly displayName: string }
interface Customer extends Duration { readonly customerId: string; readonly displayName: string; readonly active: boolean }
export type CustomerHoursResponse = {
  readonly version: 'customer-hours.v1' | 'customer-hours.v2'; readonly asOf: string;
} & ({ readonly scope: 'self'; readonly customers: readonly (Customer & { readonly days: readonly CustomerDay[] })[] }
  | { readonly scope: 'people'; readonly customers: readonly (Customer & { readonly quotaSeconds?: number | null; readonly quotaStage?: QuotaStage; readonly people: readonly CustomerPerson[] })[] });
export type CustomerHoursResult = { readonly status: 'ready'; readonly value: CustomerHoursResponse }
  | { readonly status: 'unavailable' | 'authority_rejected' };
const keys = (v: Record<string, unknown>, fields: readonly string[]) => Object.keys(v).length === fields.length && fields.every(k => k in v);
const seconds = (v: unknown): v is number => Number.isSafeInteger(v) && Number(v) >= 0;
const name = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 480;
const duration = (v: Record<string, unknown>) => seconds(v.workDurationSeconds) && typeof v.running === 'boolean';
export function isCustomerHoursRequest(v: unknown): v is CustomerHoursRequest {
  return isObject(v) && keys(v, ['expectedMembershipId','fromInclusive','toExclusive',...('responseVersion' in v ? ['responseVersion'] : [])]) && (!('responseVersion' in v) || v.responseVersion==='customer-hours.v2') && isCanonicalUuid(v.expectedMembershipId)
    && isIsoTimestamp(v.fromInclusive) && isIsoTimestamp(v.toExclusive) && Date.parse(v.toExclusive) > Date.parse(v.fromInclusive);
}
export function isCustomerHoursResponse(v: unknown): v is CustomerHoursResponse {
  if (!isObject(v) || !keys(v, ['version','asOf','scope','customers']) || !['customer-hours.v1','customer-hours.v2'].includes(String(v.version))
    || !isIsoTimestamp(v.asOf) || !['self','people'].includes(String(v.scope)) || !Array.isArray(v.customers)) return false;
  const own = v.scope === 'self';
  return v.customers.every(c => {
    if (!isObject(c) || !keys(c, ['customerId','displayName','active','workDurationSeconds','running',own ? 'days' : 'people',...(!own && v.version==='customer-hours.v2' ? ['quotaSeconds','quotaStage'] : [])])
      || !isCanonicalUuid(c.customerId) || !name(c.displayName) || typeof c.active !== 'boolean' || !duration(c)) return false;
    if (!own && v.version==='customer-hours.v2' && !validQuota(c)) return false;
    const parts = own ? c.days : c.people;
    return Array.isArray(parts) && parts.every(p => isObject(p) && duration(p) && (own
      ? keys(p,['date','workDurationSeconds','running']) && typeof p.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p.date)
      : keys(p,['membershipId','displayName','workDurationSeconds','running']) && isCanonicalUuid(p.membershipId) && name(p.displayName)))
      && parts.reduce((sum,p) => sum + p.workDurationSeconds,0) === c.workDurationSeconds;
  }) && new Set(v.customers.map(c => c.customerId)).size === v.customers.length;
}

export type QuotaStage = 'none' | 'ok' | 'warning' | 'exceeded';
function validQuota(c: Record<string,unknown>): boolean {
  if(c.quotaSeconds===null) return c.quotaStage==='none';
  if(!seconds(c.quotaSeconds) || c.quotaSeconds<1800 || c.quotaSeconds>2678400 || c.quotaSeconds%1800!==0) return false;
  return c.quotaStage===(Number(c.workDurationSeconds)>=c.quotaSeconds?'exceeded':Number(c.workDurationSeconds)*10>=c.quotaSeconds*9?'warning':'ok');
}
export interface SetCustomerQuotaRequest {
  readonly expectedMembershipId: string; readonly commandId: string;
  readonly customerId: string; readonly minutes: number|null;
}
export type SetCustomerQuotaResult = {readonly status: 'succeeded'|'command_id_conflict'|'forbidden'|'unauthorized'|'invalid_request'|'unavailable'};
export function isSetCustomerQuotaRequest(v:unknown): v is SetCustomerQuotaRequest {
  return isObject(v) && keys(v,['expectedMembershipId','commandId','customerId','minutes'])
    && isCanonicalUuid(v.expectedMembershipId) && isCanonicalUuid(v.commandId) && isCanonicalUuid(v.customerId)
    && (v.minutes===null || Number.isInteger(v.minutes) && Number(v.minutes)>=30 && Number(v.minutes)<=44640 && Number(v.minutes)%30===0);
}
export function parseQuotaHours(input:string): number|null|undefined {
  if(input.trim()==='') return null;
  if(!/^\d+(?:[.,]\d+)?$/.test(input.trim())) return undefined;
  const minutes=Number(input.trim().replace(',','.'))*60;
  return Number.isInteger(minutes) && minutes>=30 && minutes<=44640 && minutes%30===0 ? minutes : undefined;
}
export const quotaStageLabel=(stage:QuotaStage|undefined):string => stage==='exceeded'?'Kontingent überschritten':stage==='warning'?'Kontingent fast erreicht':'';
export const quotaNoticeKey=(membership:string,month:string,customer:string,stage:QuotaStage)=>
  `taptime.quota.v1.${membership}.${month}.${customer}.${stage}`;

export interface QuotaNotice {readonly key:string;readonly customerId:string;readonly displayName:string;readonly stage:'warning'|'exceeded'}
export interface QuotaNoticeStorage {read(key:string):Promise<string|null>;write(key:string):Promise<void>}
export async function unseenQuotaNotices(value:CustomerHoursResponse,membership:string,month:string,storage:QuotaNoticeStorage):Promise<QuotaNotice[]> {
  if(value.scope!=='people')return [];
  const notices:QuotaNotice[]=[];
  for(const customer of value.customers){
    const stage=customer.quotaStage;
    if(stage!=='warning' && stage!=='exceeded')continue;
    const key=quotaNoticeKey(membership,month,customer.customerId,stage);
    if(await storage.read(key)!=='1')notices.push({key,customerId:customer.customerId,displayName:customer.displayName,stage});
  }
  return notices;
}
