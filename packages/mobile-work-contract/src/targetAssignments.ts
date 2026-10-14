import { normalizeTapTimeNameV1 } from '@taptime/administration-contract/names';
import { isCanonicalUuid, type SafeWorkTarget } from './index.js';
import { isSearchCursor, type SearchListRequest } from './search.js';

export interface TargetAssignmentChangeRequest {
  readonly expectedMembershipId: string;
  readonly commandId: string;
  readonly membershipId: string;
  readonly targetType: 'customer' | 'project';
  readonly targetId: string;
  readonly assigned: boolean;
}
export type TargetAssignmentChangeResult = { readonly status: 'succeeded' | 'command_id_conflict'
  | 'target_not_selectable' | 'forbidden' | 'unauthorized' | 'invalid_request' | 'unavailable' };
export type TargetAssignmentQueryRequest = SearchListRequest & (
  { readonly membershipId: string } | { readonly targetType: 'customer' | 'project'; readonly targetId: string });
export type TargetAssignmentItem = { readonly assignmentId: string; readonly displayName: string } & (
  { readonly membershipId: string } | { readonly targetType: 'customer' | 'project'; readonly targetId: string });
export interface TargetAssignmentQueryResponse { readonly items: readonly TargetAssignmentItem[]; readonly nextCursor: string | null }
export type TargetAssignmentQueryResult = { readonly status: 'succeeded'; readonly response: TargetAssignmentQueryResponse }
  | { readonly status: 'invalid_request' | 'unauthorized' | 'forbidden' | 'unavailable' };
export interface AssignedWorkTargetResponse {
  readonly targets: readonly (SafeWorkTarget & { readonly assignedToMe: boolean })[];
  readonly nextCursor: string | null;
}
export interface AssignedBackfillTargetResponse {
  readonly targets: readonly (SafeWorkTarget & { readonly assignedToPerson: boolean })[];
  readonly nextCursor: string | null;
}
// Shared pickers consume either route; both variants still require an assignment
// marker. The route-specific types above retain the exact wire shape.
export interface AssignedTargetResponse {
  readonly targets: readonly (AssignedWorkTargetResponse['targets'][number] | AssignedBackfillTargetResponse['targets'][number])[];
  readonly nextCursor: string | null;
}
const object = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const targetType = (v: unknown) => v === 'customer' || v === 'project';
export function isTargetAssignmentChangeRequest(value: unknown): value is TargetAssignmentChangeRequest {
  return object(value) && Object.keys(value).length === 6 && isCanonicalUuid(value.expectedMembershipId)
    && isCanonicalUuid(value.commandId) && isCanonicalUuid(value.membershipId) && targetType(value.targetType)
    && isCanonicalUuid(value.targetId) && typeof value.assigned === 'boolean';
}
export function parseTargetAssignmentQuery(value: unknown): TargetAssignmentQueryRequest | null {
  if (!object(value) || !isCanonicalUuid(value.expectedMembershipId) || !isSearchCursor(value.cursor)
    || !Number.isSafeInteger(value.limit) || Number(value.limit) < 1 || Number(value.limit) > 50) return null;
  const byPerson = Object.hasOwn(value, 'membershipId');
  const keys = ['expectedMembershipId', 'cursor', 'limit', 'search', ...(byPerson ? ['membershipId'] : ['targetType', 'targetId'])];
  if (Object.keys(value).length !== keys.length || !keys.every(k => Object.hasOwn(value, k))
    || (byPerson ? !isCanonicalUuid(value.membershipId) : !targetType(value.targetType) || !isCanonicalUuid(value.targetId))) return null;
  let search: string | null = null;
  if (value.search !== null) {
    if (typeof value.search !== 'string') return null;
    const normalized = normalizeTapTimeNameV1(value.search, 'tag');
    if (normalized.status !== 'valid') return null;
    search = normalized.canonicalName;
  }
  return Object.freeze({ ...value, search }) as unknown as TargetAssignmentQueryRequest;
}
