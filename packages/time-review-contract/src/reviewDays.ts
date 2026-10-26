import { businessDay, dayStart, shiftDay } from '@taptime/core';
import { isCanonicalTimeReviewTimestamp as timestamp, isCanonicalTimeReviewUuid as uuid } from './validation.js';

export const REVIEW_DAYS_MAXIMUM_CASES = 20;
export const REVIEW_DAYS_MAXIMUM_ROWS = 50;
export const REVIEW_DAYS_MAXIMUM_BYTES = 14 * 1024;
export interface ReviewDaysRequest {
  readonly expectedMembershipId: string;
  readonly reviewItemIds: readonly string[];
  readonly cursor: string | null;
}
export interface ReviewDayRecord {
  readonly timeRecordId: string;
  readonly targetDisplayName: string;
  readonly startedAt: string;
  readonly stoppedAt: string | null;
}
export interface ReviewDay {
  readonly reviewItemId: string;
  readonly windowStartedAt: string;
  readonly windowEndedAt: string;
  readonly records: readonly ReviewDayRecord[];
  readonly activeRecord: ReviewDayRecord | null;
  /** Only the last day of a page may continue on the next page. */
  readonly complete: boolean;
}
export interface ReviewDaysResponse {
  readonly status: 'ready';
  readonly days: readonly ReviewDay[];
  readonly nextCursor: string | null;
}
function exact(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
}
function cursor(value: unknown): value is string | null {
  return value === null || typeof value === 'string' && value.length <= 512 && /^d1:[A-Za-z0-9_-]+$/.test(value);
}
export function parseReviewDaysRequest(value: unknown): ReviewDaysRequest | null {
  if (!exact(value, ['expectedMembershipId', 'reviewItemIds', 'cursor']) || !uuid(value.expectedMembershipId)
    || !Array.isArray(value.reviewItemIds) || !value.reviewItemIds.length || value.reviewItemIds.length > REVIEW_DAYS_MAXIMUM_CASES
    || !value.reviewItemIds.every(uuid) || new Set(value.reviewItemIds).size !== value.reviewItemIds.length || !cursor(value.cursor)) return null;
  return value as unknown as ReviewDaysRequest;
}
function record(value: unknown, from: string, to: string, active: boolean): value is ReviewDayRecord {
  return exact(value, ['timeRecordId', 'targetDisplayName', 'startedAt', 'stoppedAt']) && uuid(value.timeRecordId)
    && typeof value.targetDisplayName === 'string' && Array.from(value.targetDisplayName).length <= 120
    && timestamp(value.startedAt) && value.startedAt < to
    && (active ? value.stoppedAt === null : timestamp(value.stoppedAt) && value.stoppedAt >= value.startedAt && value.stoppedAt > from);
}
export function parseReviewDaysResponse(value: unknown, request: ReviewDaysRequest): ReviewDaysResponse | null {
  if (!exact(value, ['status', 'days', 'nextCursor']) || value.status !== 'ready' || !cursor(value.nextCursor)
    || !Array.isArray(value.days) || value.days.length > REVIEW_DAYS_MAXIMUM_CASES
    || !value.days.length && value.nextCursor !== null) return null;
  const seen = new Set<string>();
  let lastOrdinal = -1, rows = 0;
  for (const [index, day] of value.days.entries()) {
    if (!exact(day, ['reviewItemId', 'windowStartedAt', 'windowEndedAt', 'records', 'activeRecord', 'complete'])
      || !uuid(day.reviewItemId) || seen.has(day.reviewItemId) || !timestamp(day.windowStartedAt) || !timestamp(day.windowEndedAt)
      || typeof day.complete !== 'boolean' || !day.complete && (value.nextCursor === null || index !== value.days.length - 1)
      || !Array.isArray(day.records)) return null;
    const ordinal = request.reviewItemIds.indexOf(day.reviewItemId);
    if (ordinal <= lastOrdinal) return null;
    lastOrdinal = ordinal; seen.add(day.reviewItemId);
    const date = businessDay(day.windowStartedAt);
    if (new Date(dayStart(date)).toISOString() !== day.windowStartedAt
      || new Date(dayStart(shiftDay(date, 1))).toISOString() !== day.windowEndedAt) return null;
    if (!day.records.every(row => record(row, day.windowStartedAt as string, day.windowEndedAt as string, false))
      || day.activeRecord !== null && !record(day.activeRecord, day.windowStartedAt, day.windowEndedAt, true)) return null;
    const records = [...day.records as ReviewDayRecord[], ...(day.activeRecord ? [day.activeRecord as ReviewDayRecord] : [])];
    if (new Set(records.map(row => row.timeRecordId)).size !== records.length) return null;
    rows += records.length;
  }
  if (rows > REVIEW_DAYS_MAXIMUM_ROWS || new TextEncoder().encode(JSON.stringify(value)).length > REVIEW_DAYS_MAXIMUM_BYTES) return null;
  return value as unknown as ReviewDaysResponse;
}
