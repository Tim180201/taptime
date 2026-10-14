import { isCustomerHoursRequest } from './customerHours.js';
import { isCanonicalUuid } from './index.js';
import { isSearchCursor, type CustomerHoursQuotaSummary, type SearchPageRequest } from './search.js';

export interface QuotaAlertsQueryRequest extends SearchPageRequest {
  readonly fromInclusive: string;
  readonly toExclusive: string;
}
export interface QuotaAlertsQueryResponse {
  readonly version: 'customer-quota-alerts.v1';
  readonly scope: 'self' | 'people';
  readonly asOf: string;
  readonly customers: readonly CustomerHoursQuotaSummary[];
  readonly nextCursor: string | null;
}
export type QuotaAlertsQueryResult = { readonly status: 'succeeded'; readonly response: QuotaAlertsQueryResponse }
  | { readonly status: 'invalid_request' | 'unauthorized' | 'forbidden' | 'unavailable' };
export function parseQuotaAlertsQuery(value: unknown): QuotaAlertsQueryRequest | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const r = value as Record<string, unknown>;
  if (Object.keys(r).length !== 5 || !isCanonicalUuid(r.expectedMembershipId) || !isSearchCursor(r.cursor)
    || !Number.isSafeInteger(r.limit) || Number(r.limit) < 1 || Number(r.limit) > 50
    || !isCustomerHoursRequest({ expectedMembershipId: r.expectedMembershipId, fromInclusive: r.fromInclusive, toExclusive: r.toExclusive })) return null;
  return value as QuotaAlertsQueryRequest;
}
