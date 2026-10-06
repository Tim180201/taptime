import { businessDay, dayStart, shiftMonth, LONGEST_BERLIN_CALENDAR_MONTH_MILLISECONDS } from '@taptime/core';

export interface ManagedPersonTimeRequest {
  readonly expectedMembershipId: string;
  readonly targetMembershipId: string;
  readonly fromInclusive: string;
  readonly toExclusive: string;
  readonly cursor: string | null;
  readonly limit: number;
}
export interface ManagedActiveSummaryRequest {
  readonly expectedMembershipId: string;
  readonly locationId: string | null;
  readonly isRunning: boolean | null;
  readonly cursor: string | null;
  readonly limit: number;
}
export interface ManagedPerson {
  readonly monthWorkDurationSeconds?: number;
  readonly departedAt?: string | null;
  readonly membershipId: string;
  readonly displayName: string;
  readonly role: 'administrator' | 'standortleitung' | 'employee';
  readonly location: { readonly id: string; readonly name: string } | null;
  readonly isRunning: boolean;
  readonly runningSince: string | null;
  readonly runningTargetDisplayName: string | null;
}
export interface OrganizationPackageUsage {
  readonly packageSize: number | null;
  readonly activeAccessCount: number;
}
export interface ManagedActiveSummary {
  readonly packageUsage?: OrganizationPackageUsage | null;
  readonly serverTime: string;
  readonly runningCount: number;
  readonly totalCount: number;
  readonly people: readonly ManagedPerson[];
  readonly nextCursor: string | null;
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export const isManagedUuid = (v: unknown): v is string => typeof v === 'string' && uuid.test(v);
export const isManagedTimestamp = (v: unknown): v is string => typeof v === 'string'
  && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(v)
  && Number.isFinite(Date.parse(v)) && new Date(v).toISOString() === v;
const object = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const keys = (v: Record<string, unknown>, names: string[]) => Object.keys(v).sort().join(',') === names.sort().join(',');
const text = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && [...v].length <= 120;
const cursor = (v: unknown) => v === null || (typeof v === 'string' && /^[\x20-\x7e]{1,256}$/.test(v));
const page = (v: Record<string, unknown>) => isManagedUuid(v.expectedMembershipId)
  && Number.isSafeInteger(v.limit) && Number(v.limit) >= 1 && Number(v.limit) <= 20 && cursor(v.cursor);
export function isManagedPersonTimeRequest(v: unknown): v is ManagedPersonTimeRequest {
  return object(v) && keys(v,['expectedMembershipId','targetMembershipId','fromInclusive','toExclusive','cursor','limit'])
    && page(v) && isManagedUuid(v.targetMembershipId) && isManagedTimestamp(v.fromInclusive) && isManagedTimestamp(v.toExclusive)
    && Date.parse(v.toExclusive) > Date.parse(v.fromInclusive)
    && Date.parse(v.toExclusive) - Date.parse(v.fromInclusive) <= LONGEST_BERLIN_CALENDAR_MONTH_MILLISECONDS;
}
export function isManagedActiveSummaryRequest(v: unknown): v is ManagedActiveSummaryRequest {
  return object(v) && keys(v,['expectedMembershipId','locationId','isRunning','cursor','limit']) && page(v)
    && (v.locationId === null || isManagedUuid(v.locationId)) && (v.isRunning === null || typeof v.isRunning === 'boolean');
}
export function isManagedPerson(v: unknown): v is ManagedPerson {
  return object(v) && keys(v,['membershipId','displayName','role','location','isRunning','runningSince','runningTargetDisplayName'])
    && isManagedUuid(v.membershipId) && text(v.displayName)
    && (v.role === 'employee' || v.role === 'standortleitung' || v.role === 'administrator')
    && (v.location === null || (object(v.location) && keys(v.location,['id','name']) && isManagedUuid(v.location.id) && text(v.location.name)))
    && typeof v.isRunning === 'boolean' && (v.isRunning
      ? isManagedTimestamp(v.runningSince) && text(v.runningTargetDisplayName)
      : v.runningSince === null && v.runningTargetDisplayName === null);
}
export function isManagedActiveSummary(v: unknown): v is ManagedActiveSummary {
  return object(v) && keys(v,['serverTime','runningCount','totalCount','people','nextCursor']) && isManagedTimestamp(v.serverTime)
    && Number.isSafeInteger(v.runningCount) && Number.isSafeInteger(v.totalCount)
    && Number(v.runningCount) >= 0 && Number(v.totalCount) >= Number(v.runningCount)
    && Array.isArray(v.people) && v.people.length <= 20 && v.people.every(isManagedPerson)
    && new Set(v.people.map(p=>p.membershipId)).size === v.people.length && cursor(v.nextCursor);
}

/** Additive negotiation preserves the strict v1 parser used by shipped apps. */
export const MANAGED_PEOPLE_ACCEPT_V2 = 'application/vnd.taptime.managed-people.v2+json';
export function isManagedActiveSummaryV2(v: unknown): v is ManagedActiveSummary {
  if (!object(v) || !Array.isArray(v.people)) return false;
  const people: unknown[] = [];
  for (const person of v.people) {
    if (!object(person) || !Object.hasOwn(person,'departedAt')
      || !(person.departedAt === null || isManagedTimestamp(person.departedAt))
      || (person.departedAt !== null && person.isRunning !== false)) return false;
    const { departedAt, ...current } = person;
    people.push(current);
  }
  return isManagedActiveSummary({...v,people});
}

/** Only v3 carries monthly seconds; old exact-key parsers still reject these rows. */
export const MANAGED_PEOPLE_ACCEPT_V3 = 'application/vnd.taptime.managed-people.v3+json';
export interface ManagedActiveSummaryV3 extends ManagedActiveSummary {
  readonly people: readonly (ManagedPerson & { readonly departedAt: string | null; readonly monthWorkDurationSeconds: number })[];
}
export function isManagedActiveSummaryV3(v: unknown): v is ManagedActiveSummaryV3 {
  if (!object(v) || !Array.isArray(v.people)) return false;
  const people: unknown[] = [];
  for (const person of v.people) {
    if (!object(person) || !Number.isSafeInteger(person.monthWorkDurationSeconds)
      || Number(person.monthWorkDurationSeconds) < 0) return false;
    const { monthWorkDurationSeconds, ...previous } = person;
    people.push(previous);
  }
  return isManagedActiveSummaryV2({...v,people});
}

/** v4 adds organization-wide package counts only for administrators. */
export const MANAGED_PEOPLE_ACCEPT_V4 = 'application/vnd.taptime.managed-people.v4+json';
export interface ManagedActiveSummaryV4 extends ManagedActiveSummaryV3 {
  readonly packageUsage: OrganizationPackageUsage | null;
}
export function isOrganizationPackageUsage(v: unknown): v is OrganizationPackageUsage {
  return object(v) && keys(v,['packageSize','activeAccessCount'])
    && (v.packageSize === null || (Number.isSafeInteger(v.packageSize) && Number(v.packageSize) >= 1 && Number(v.packageSize) <= 2147483647))
    && Number.isSafeInteger(v.activeAccessCount) && Number(v.activeAccessCount) >= 0;
}
export function isManagedActiveSummaryV4(v: unknown): v is ManagedActiveSummaryV4 {
  if (!object(v) || !Object.hasOwn(v,'packageUsage')
    || !(v.packageUsage === null || isOrganizationPackageUsage(v.packageUsage))) return false;
  const {packageUsage,...previous}=v;
  return isManagedActiveSummaryV3(previous);
}

/** v5 selects a full business month; the response retains the exact v4 shape. */
export const MANAGED_PEOPLE_ACCEPT_V5 = 'application/vnd.taptime.managed-people.v5+json';
export interface ManagedActiveSummaryRequestV5 extends ManagedActiveSummaryRequest {
  readonly fromInclusive: string;
  readonly toExclusive: string;
}
export function isManagedActiveSummaryRequestV5(v: unknown): v is ManagedActiveSummaryRequestV5 {
  if (!object(v) || !isManagedTimestamp(v.fromInclusive) || !isManagedTimestamp(v.toExclusive)) return false;
  const {fromInclusive,toExclusive,...previous}=v;
  if (!isManagedActiveSummaryRequest(previous)) return false;
  try {
    const month=businessDay(Date.parse(fromInclusive)).slice(0,7);
    return Date.parse(fromInclusive)===dayStart(`${month}-01`)
      && Date.parse(toExclusive)===dayStart(`${shiftMonth(month,1)}-01`);
  } catch { return false; }
}
export const isManagedActiveSummaryV5 = isManagedActiveSummaryV4;
