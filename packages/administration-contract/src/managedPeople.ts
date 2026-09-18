import { LONGEST_BERLIN_CALENDAR_MONTH_MILLISECONDS } from '@taptime/core';

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
  readonly membershipId: string;
  readonly displayName: string;
  readonly role: 'administrator' | 'standortleitung' | 'employee';
  readonly location: { readonly id: string; readonly name: string } | null;
  readonly isRunning: boolean;
  readonly runningSince: string | null;
  readonly runningTargetDisplayName: string | null;
}
export interface ManagedActiveSummary {
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
