import { normalizeTapTimeNameV1 } from '@taptime/administration-contract/names';
import { isManagedActiveSummaryRequestV5, isManagedActiveSummaryV5, type ManagedActiveSummaryV4 } from '@taptime/administration-contract/managed-people';
import type { AdministrationSetupCustomer, AdministrationSetupNfcTag, AdministrationSetupOrganization } from '@taptime/administration-contract/setup-projection';
import { isCanonicalUuid, isWorkTargetType, type ProjectSummary } from './index.js';
import { isCustomerHoursRequest, type CustomerDay, type CustomerPerson, type QuotaStage } from './customerHours.js';
import type { AssignedTargetResponse } from './targetAssignments.js';

export const SEARCH_PAGE_MAXIMUM_BYTES = 14_336;
export const MANAGED_PEOPLE_ACCEPT_V6 = 'application/vnd.taptime.managed-people.v6+json';
export type SearchKind = 'customer_hours' | 'customer_detail' | 'managed_people' | 'memberships'
  | 'setup_customers' | 'setup_tags' | 'work_targets' | 'backfill_targets' | 'projects';
export interface SearchPageRequest { readonly expectedMembershipId: string; readonly cursor: string | null; readonly limit: number }
export interface SearchListRequest extends SearchPageRequest { readonly search: string | null }
interface Month { readonly fromInclusive: string; readonly toExclusive: string }
export interface SearchRequests {
  customer_hours: SearchListRequest & Month;
  customer_detail: SearchPageRequest & Month & { readonly customerId: string };
  managed_people: SearchListRequest & Month & { readonly locationId: string | null; readonly isRunning: boolean | null };
  memberships: SearchListRequest & { readonly locationId: string | null; readonly active?: boolean | null };
  setup_customers: SearchListRequest & { readonly kind: 'customers' };
  setup_tags: SearchListRequest & { readonly kind: 'nfc_tags' };
  work_targets: SearchListRequest & { readonly targetType?: 'customer' | 'project' | 'general_work'; readonly assignedOnly?: boolean };
  backfill_targets: SearchListRequest & { readonly targetMembershipId: string; readonly assignedOnly?: boolean };
  projects: SearchListRequest;
}
export interface CustomerHoursSummary {
  readonly customerId: string; readonly displayName: string; readonly active: boolean;
  readonly workDurationSeconds: number; readonly running: boolean;
}
export interface CustomerHoursQuotaSummary extends CustomerHoursSummary { readonly quotaSeconds: number | null; readonly quotaStage: QuotaStage }
export type CustomerHoursPageResponse = { readonly version: 'customer-hours.v3'; readonly asOf: string; readonly nextCursor: string | null } & (
  { readonly scope: 'self'; readonly customers: readonly CustomerHoursSummary[] }
  | { readonly scope: 'people'; readonly customers: readonly CustomerHoursQuotaSummary[] });
export type CustomerHoursDetailResponse = { readonly version: 'customer-hours.detail.v1'; readonly asOf: string; readonly nextCursor: string | null } & (
  { readonly scope: 'self'; readonly customer: CustomerHoursSummary; readonly days: readonly CustomerDay[] }
  | { readonly scope: 'people'; readonly customer: CustomerHoursQuotaSummary; readonly people: readonly CustomerPerson[] });
export interface SearchSetupResponse {
  readonly status: 'succeeded'; readonly organization: AdministrationSetupOrganization;
  readonly customers: readonly AdministrationSetupCustomer[];
  readonly nfcTags: readonly (AdministrationSetupNfcTag & { readonly customerDisplayName: string | null })[];
  readonly nextCursor: string | null;
}
export interface SearchMembershipResponse {
  readonly status: 'succeeded'; readonly organization: AdministrationSetupOrganization;
  readonly employeeMemberships: readonly { readonly id: string; readonly displayName: string;
    readonly role: 'administrator' | 'standortleitung' | 'employee'; readonly active: boolean; readonly rowVersion: number;
    readonly location: { readonly id: string; readonly name: string } | null;
    readonly firstSignedInAt: string | null; readonly lastSignedInAt: string | null }[];
  readonly nextCursor: string | null;
}

/** v4 memberships response; v3 remains closed and unchanged for installed clients. */
export function parseMembershipSearchResponse(value: unknown): SearchMembershipResponse | null {
  const exact = (v: Record<string, unknown>, keys: string[]) => Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
  const name = (v: unknown) => {
    if (typeof v !== 'string') return false;
    const parsed = normalizeTapTimeNameV1(v, 'customer');
    return parsed.status === 'valid' && parsed.canonicalName === v;
  };
  const timestamp = (v: unknown): v is string => typeof v === 'string' && Number.isFinite(Date.parse(v)) && new Date(v).toISOString() === v;
  if (!object(value) || !exact(value, ['status', 'organization', 'employeeMemberships', 'nextCursor']) || value.status !== 'succeeded'
    || !object(value.organization) || !exact(value.organization, ['id', 'name']) || !isCanonicalUuid(value.organization.id) || !name(value.organization.name)
    || !isSearchCursor(value.nextCursor) || !Array.isArray(value.employeeMemberships) || value.employeeMemberships.length > 50
    || (value.nextCursor !== null && value.employeeMemberships.length === 0)) return null;
  const ids = new Set<string>();
  for (const row of value.employeeMemberships) {
    if (!object(row) || !exact(row, ['id', 'displayName', 'role', 'active', 'rowVersion', 'location', 'firstSignedInAt', 'lastSignedInAt'])
      || !isCanonicalUuid(row.id) || ids.has(row.id) || !name(row.displayName) || !['administrator', 'standortleitung', 'employee'].includes(String(row.role))
      || typeof row.active !== 'boolean' || !Number.isSafeInteger(row.rowVersion) || Number(row.rowVersion) < 1
      || !(row.location === null || object(row.location) && exact(row.location, ['id', 'name']) && isCanonicalUuid(row.location.id) && name(row.location.name))) return null;
    if (!(row.firstSignedInAt === null && row.lastSignedInAt === null)
      && !(timestamp(row.firstSignedInAt) && timestamp(row.lastSignedInAt) && Date.parse(row.firstSignedInAt) <= Date.parse(row.lastSignedInAt))) return null;
    ids.add(row.id);
  }
  return value as unknown as SearchMembershipResponse;
}
export interface SearchResponses {
  customer_hours: CustomerHoursPageResponse;
  customer_detail: CustomerHoursDetailResponse;
  managed_people: ManagedActiveSummaryV4;
  memberships: SearchMembershipResponse;
  setup_customers: SearchSetupResponse;
  setup_tags: SearchSetupResponse;
  work_targets: AssignedTargetResponse;
  backfill_targets: AssignedTargetResponse;
  projects: { readonly projects: readonly ProjectSummary[]; readonly nextCursor: string | null };
}
export type SearchReadResult<K extends SearchKind> = { readonly status: 'succeeded'; readonly response: SearchResponses[K] }
  | { readonly status: 'invalid_request' | 'unauthorized' | 'forbidden' | 'not_found' | 'location_scope_forbidden' | 'authority_rejected' | 'unavailable' };
export interface SearchReader<K extends SearchKind> {
  querySearch<T extends K>(kind: T, command: { readonly accessToken: string; readonly request: SearchRequests[T] }): Promise<SearchReadResult<T>>;
}
const object = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const fields: Record<SearchKind, readonly string[]> = {
  customer_hours: ['fromInclusive', 'toExclusive'], customer_detail: ['customerId', 'fromInclusive', 'toExclusive'],
  managed_people: ['fromInclusive', 'toExclusive', 'locationId', 'isRunning'], memberships: ['locationId'],
  setup_customers: ['kind'], setup_tags: ['kind'], work_targets: [], backfill_targets: ['targetMembershipId'], projects: [],
};
export function isSearchCursor(value: unknown): value is string | null {
  return value === null || typeof value === 'string' && /^[\x21-\x7e]{1,2048}$/.test(value);
}
/** New paths have closed request shapes. Normalization never relaxes old parsers. */
export function parseSearchRequest<K extends SearchKind>(kind: K, value: unknown): SearchRequests[K] | null {
  if (!object(value) || !Object.hasOwn(fields, kind)) return null;
  const expected = ['expectedMembershipId', 'cursor', 'limit', ...(kind === 'customer_detail' ? [] : ['search']), ...fields[kind],
    ...(kind === 'memberships' && Object.hasOwn(value, 'active') ? ['active'] : []),
    ...((kind === 'work_targets' || kind === 'backfill_targets') && Object.hasOwn(value, 'assignedOnly') ? ['assignedOnly'] : []),
    ...(kind === 'work_targets' && Object.hasOwn(value, 'targetType') ? ['targetType'] : [])];
  if (Object.keys(value).length !== expected.length || !expected.every(key => Object.hasOwn(value, key))
    || !isCanonicalUuid(value.expectedMembershipId) || !isSearchCursor(value.cursor)
    || !Number.isSafeInteger(value.limit) || Number(value.limit) < 1 || Number(value.limit) > 50) return null;
  let search: string | null = null;
  if (kind !== 'customer_detail' && value.search !== null) {
    if (typeof value.search !== 'string') return null;
    const normalized = normalizeTapTimeNameV1(value.search, 'tag');
    if (normalized.status !== 'valid') return null;
    search = normalized.canonicalName;
  }
  if (kind === 'customer_hours' || kind === 'customer_detail') {
    if (!isCustomerHoursRequest({ expectedMembershipId: value.expectedMembershipId, fromInclusive: value.fromInclusive, toExclusive: value.toExclusive })) return null;
  }
  if (kind === 'customer_detail' && !isCanonicalUuid(value.customerId)) return null;
  if (kind === 'managed_people' && !isManagedActiveSummaryRequestV5({ expectedMembershipId: value.expectedMembershipId, cursor: null, limit: 1,
    locationId: value.locationId, isRunning: value.isRunning, fromInclusive: value.fromInclusive, toExclusive: value.toExclusive })) return null;
  if (kind === 'memberships' && value.locationId !== null && !isCanonicalUuid(value.locationId)) return null;
  if (kind === 'memberships' && Object.hasOwn(value, 'active') && value.active !== null && typeof value.active !== 'boolean') return null;
  if (kind === 'setup_customers' && value.kind !== 'customers' || kind === 'setup_tags' && value.kind !== 'nfc_tags') return null;
  if (kind === 'backfill_targets' && !isCanonicalUuid(value.targetMembershipId)) return null;
  if ((kind === 'work_targets' || kind === 'backfill_targets') && Object.hasOwn(value, 'assignedOnly') && typeof value.assignedOnly !== 'boolean') return null;
  if (kind === 'work_targets' && Object.hasOwn(value, 'targetType') && !isWorkTargetType(value.targetType)) return null;
  return Object.freeze({ ...value, ...(kind === 'customer_detail' ? {} : { search }) }) as unknown as SearchRequests[K];
}
export function isManagedActiveSummaryV6(value: unknown): value is ManagedActiveSummaryV4 {
  if (!object(value) || !Array.isArray(value.people) || value.people.length > 50 || !isSearchCursor(value.nextCursor)) return false;
  // V6 changes page/cursor bounds, preserving the exact v5 payload and row validators.
  return new Set(value.people.map(p => p?.membershipId)).size === value.people.length
    && isManagedActiveSummaryV5({ ...value, people: [], nextCursor: null })
    && value.people.every(person => isManagedActiveSummaryV5({ ...value, people: [person], nextCursor: null }));
}
