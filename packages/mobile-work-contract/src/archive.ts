import { isManagedPersonTimeRequest, isManagedTimestamp, isManagedUuid, type ManagedPersonTimeRequest } from '@taptime/administration-contract/managed-people';
import { normalizeTapTimeNameV1 } from '@taptime/administration-contract/names';
import { isCalendarTimeResponse, type DetailedTimeResponse, type DetailedTimeRecord, type CalendarTimeData } from './index.js';
import { isSearchCursor, isManagedActiveSummaryV6, parseSearchRequest, type SearchRequests, type SearchResponses, type SearchListRequest } from './search.js';

export type ArchiveKind = 'people' | 'targets' | 'status' | 'managed_people' | 'person_time';
export interface ArchiveTargetId { readonly targetType: 'customer' | 'project'; readonly targetId: string }
export interface ArchiveRequests {
  people: SearchListRequest & { readonly locationId: string | null; readonly membershipId: string | null };
  targets: SearchListRequest & { readonly locationId: string | null };
  status: { readonly expectedMembershipId: string; readonly membershipIds: readonly string[]; readonly targets: readonly ArchiveTargetId[] };
  managed_people: SearchRequests['managed_people'];
  person_time: ManagedPersonTimeRequest;
}
interface Location { readonly id: string; readonly name: string }
export interface ArchivePerson {
  readonly membershipId: string; readonly displayName: string | null;
  readonly role: 'administrator' | 'standortleitung' | 'employee'; readonly location: Location | null;
  readonly revokedAt: string; readonly lastStartedAt: string | null;
}
export interface ArchiveTarget extends ArchiveTargetId {
  readonly displayName: string; readonly location: Location | null;
  readonly deactivatedAt: string; readonly lastStartedAt: string | null;
}
export interface ManagedPersonTimeV2 extends Omit<DetailedTimeResponse, 'activeRecord' | 'records'> {
  readonly canManageTime: boolean;
  readonly activeRecord: (DetailedTimeRecord & { readonly calendar: CalendarTimeData }) | null;
  readonly records: readonly (DetailedTimeRecord & { readonly calendar: CalendarTimeData })[];
}
export interface ArchiveResponses {
  people: { readonly people: readonly ArchivePerson[]; readonly nextCursor: string | null };
  targets: { readonly targets: readonly ArchiveTarget[]; readonly nextCursor: string | null };
  status: { readonly people: readonly { readonly membershipId: string; readonly archived: boolean }[];
    readonly targets: readonly (ArchiveTargetId & { readonly archived: boolean })[] };
  managed_people: SearchResponses['managed_people'];
  person_time: ManagedPersonTimeV2;
}
export type ArchiveReadResult<K extends ArchiveKind> = { readonly status: 'succeeded'; readonly response: ArchiveResponses[K] }
  | { readonly status: 'invalid_request' | 'forbidden' | 'unauthorized' };
export interface ArchiveReader {
  queryArchive<K extends ArchiveKind>(kind: K, command: { readonly accessToken: string; readonly request: ArchiveRequests[K] }): Promise<ArchiveReadResult<K>>;
}
const object = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const exact = (v: Record<string, unknown>, keys: string[]) => Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
const uuidOrNull = (v: unknown) => v === null || isManagedUuid(v);
const name = (v: unknown): v is string => typeof v === 'string' && [...v].length >= 1 && [...v].length <= 120 && !v.includes('\0');
const location = (v: unknown) => v === null || object(v) && exact(v, ['id', 'name']) && isManagedUuid(v.id) && name(v.name);
const timestampOrNull = (v: unknown) => v === null || isManagedTimestamp(v);
const targetId = (v: Record<string, unknown>) => (v.targetType === 'customer' || v.targetType === 'project') && isManagedUuid(v.targetId);
const unique = (values: readonly string[]) => new Set(values).size === values.length;
export function parseArchiveRequest<K extends ArchiveKind>(kind: K, value: unknown): ArchiveRequests[K] | null {
  if (kind === 'managed_people') return parseSearchRequest('managed_people', value) as ArchiveRequests[K] | null;
  if (kind === 'person_time') return isManagedPersonTimeRequest(value) ? value as ArchiveRequests[K] : null;
  if (!object(value) || !isManagedUuid(value.expectedMembershipId)) return null;
  if (kind === 'status') {
    if (!exact(value, ['expectedMembershipId', 'membershipIds', 'targets']) || !Array.isArray(value.membershipIds)
      || !Array.isArray(value.targets) || value.membershipIds.length + value.targets.length > 200
      || !value.membershipIds.every(isManagedUuid) || !unique(value.membershipIds)
      || !value.targets.every(t => object(t) && exact(t, ['targetType', 'targetId']) && targetId(t))
      || !unique(value.targets.map(t => `${t.targetType}/${t.targetId}`))) return null;
    return value as unknown as ArchiveRequests[K];
  }
  if (kind !== 'people' && kind !== 'targets') return null;
  if (!exact(value, ['expectedMembershipId', 'search', 'cursor', 'limit', 'locationId', ...(kind === 'people' ? ['membershipId'] : [])])
    || !uuidOrNull(value.locationId) || (kind === 'people' && !uuidOrNull(value.membershipId))
    || !isSearchCursor(value.cursor) || !Number.isSafeInteger(value.limit) || Number(value.limit) < 1 || Number(value.limit) > 50) return null;
  let search: string | null = null;
  if (value.search !== null) {
    if (typeof value.search !== 'string') return null;
    const normalized = normalizeTapTimeNameV1(value.search, 'tag');
    if (normalized.status !== 'valid') return null;
    search = normalized.canonicalName;
  }
  return { ...value, search } as unknown as ArchiveRequests[K];
}
export function isArchiveResponse<K extends ArchiveKind>(kind: K, value: unknown): value is ArchiveResponses[K] {
  if (!object(value)) return false;
  if (kind === 'managed_people') return isManagedActiveSummaryV6(value);
  if (kind === 'person_time') {
    const { canManageTime, ...time } = value;
    return typeof canManageTime === 'boolean' && isCalendarTimeResponse(time);
  }
  if (kind === 'status') return exact(value, ['people', 'targets']) && Array.isArray(value.people) && Array.isArray(value.targets)
    && value.people.length + value.targets.length <= 200
    && value.people.every(p => object(p) && exact(p, ['membershipId', 'archived']) && isManagedUuid(p.membershipId) && typeof p.archived === 'boolean')
    && value.targets.every(t => object(t) && exact(t, ['targetType', 'targetId', 'archived']) && targetId(t) && typeof t.archived === 'boolean')
    && unique(value.people.map(p => p.membershipId)) && unique(value.targets.map(t => `${t.targetType}/${t.targetId}`));
  if (!exact(value, [kind, 'nextCursor']) || !isSearchCursor(value.nextCursor)) return false;
  const rows = value[kind];
  if (!Array.isArray(rows) || rows.length > 50 || (value.nextCursor !== null && !rows.length)) return false;
  if (kind === 'people') return rows.every(p => object(p)
    && exact(p, ['membershipId', 'displayName', 'role', 'location', 'revokedAt', 'lastStartedAt'])
    && isManagedUuid(p.membershipId) && (p.displayName === null || name(p.displayName))
    && ['administrator', 'standortleitung', 'employee'].includes(String(p.role))
    && location(p.location) && isManagedTimestamp(p.revokedAt) && timestampOrNull(p.lastStartedAt))
    && unique(rows.map(p => p.membershipId));
  return rows.every(t => object(t) && exact(t, ['targetType', 'targetId', 'displayName', 'location', 'deactivatedAt', 'lastStartedAt'])
    && targetId(t) && name(t.displayName) && location(t.location) && isManagedTimestamp(t.deactivatedAt) && timestampOrNull(t.lastStartedAt))
    && unique(rows.map(t => `${t.targetType}/${t.targetId}`));
}
