import { isCanonicalUuid } from './index.js';
const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isIsoTimestamp = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/.test(v) && Number.isFinite(Date.parse(v));

export interface CustomerHoursRequest {
  readonly expectedMembershipId: string;
  readonly fromInclusive: string;
  readonly toExclusive: string;
}
interface Duration { readonly workDurationSeconds: number; readonly running: boolean }
export interface CustomerDay extends Duration { readonly date: string }
export interface CustomerPerson extends Duration { readonly membershipId: string; readonly displayName: string }
interface Customer extends Duration { readonly customerId: string; readonly displayName: string; readonly active: boolean }
export type CustomerHoursResponse = {
  readonly version: 'customer-hours.v1'; readonly asOf: string;
} & ({ readonly scope: 'self'; readonly customers: readonly (Customer & { readonly days: readonly CustomerDay[] })[] }
  | { readonly scope: 'people'; readonly customers: readonly (Customer & { readonly people: readonly CustomerPerson[] })[] });
export type CustomerHoursResult = { readonly status: 'ready'; readonly value: CustomerHoursResponse }
  | { readonly status: 'unavailable' | 'authority_rejected' };
const keys = (v: Record<string, unknown>, fields: readonly string[]) => Object.keys(v).length === fields.length && fields.every(k => k in v);
const seconds = (v: unknown): v is number => Number.isSafeInteger(v) && Number(v) >= 0;
const name = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 480;
const duration = (v: Record<string, unknown>) => seconds(v.workDurationSeconds) && typeof v.running === 'boolean';
export function isCustomerHoursRequest(v: unknown): v is CustomerHoursRequest {
  return isObject(v) && keys(v, ['expectedMembershipId','fromInclusive','toExclusive']) && isCanonicalUuid(v.expectedMembershipId)
    && isIsoTimestamp(v.fromInclusive) && isIsoTimestamp(v.toExclusive) && Date.parse(v.toExclusive) > Date.parse(v.fromInclusive);
}
export function isCustomerHoursResponse(v: unknown): v is CustomerHoursResponse {
  if (!isObject(v) || !keys(v, ['version','asOf','scope','customers']) || v.version !== 'customer-hours.v1'
    || !isIsoTimestamp(v.asOf) || !['self','people'].includes(String(v.scope)) || !Array.isArray(v.customers)) return false;
  const own = v.scope === 'self';
  return v.customers.every(c => {
    if (!isObject(c) || !keys(c, ['customerId','displayName','active','workDurationSeconds','running',own ? 'days' : 'people'])
      || !isCanonicalUuid(c.customerId) || !name(c.displayName) || typeof c.active !== 'boolean' || !duration(c)) return false;
    const parts = own ? c.days : c.people;
    return Array.isArray(parts) && parts.every(p => isObject(p) && duration(p) && (own
      ? keys(p,['date','workDurationSeconds','running']) && typeof p.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p.date)
      : keys(p,['membershipId','displayName','workDurationSeconds','running']) && isCanonicalUuid(p.membershipId) && name(p.displayName)))
      && parts.reduce((sum,p) => sum + p.workDurationSeconds,0) === c.workDurationSeconds;
  }) && new Set(v.customers.map(c => c.customerId)).size === v.customers.length;
}
