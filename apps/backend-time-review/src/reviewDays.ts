import { createHash } from 'node:crypto';
import { isCanonicalTimeReviewUuid, parseReviewDaysResponse, REVIEW_DAYS_MAXIMUM_BYTES, REVIEW_DAYS_MAXIMUM_ROWS,
  type ReviewDay, type ReviewDaysRequest, type ReviewDaysResponse } from '@taptime/time-review-contract';
import type { QueryResultRow } from 'pg';

export interface ReviewDayRow extends QueryResultRow {
  review_item_id: string;
  row_kind: number;
  window_started_at: Date;
  window_ended_at: Date;
  time_record_id: string | null;
  target_display_name: string | null;
  started_at: Date | null;
  stopped_at: Date | null;
  cursor_started_at: string;
  cursor_record_id: string;
}
type Position = readonly [string, number, string, string];
function context(request: ReviewDaysRequest): string {
  return createHash('sha256').update(JSON.stringify(['review-days.v1', request.expectedMembershipId, request.reviewItemIds])).digest('hex');
}
export function reviewDaysPosition(request: ReviewDaysRequest): Position | null | undefined {
  if (request.cursor === null) return null;
  try {
    const encoded = request.cursor.slice(3), text = Buffer.from(encoded, 'base64url').toString('utf8');
    const value: unknown = JSON.parse(text);
    if (Buffer.from(text).toString('base64url') !== encoded || !Array.isArray(value) || value.length !== 5
      || value[0] !== context(request) || !isCanonicalTimeReviewUuid(value[1]) || !request.reviewItemIds.includes(value[1])
      || ![0, 1, 2].includes(value[2]) || typeof value[3] !== 'string'
      || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(value[3]) || !Number.isFinite(Date.parse(value[3]))
      || !isCanonicalTimeReviewUuid(value[4])) return undefined;
    return [value[1], value[2], value[3], value[4]];
  } catch { return undefined; }
}
function cursor(request: ReviewDaysRequest, row: ReviewDayRow): string {
  return `d1:${Buffer.from(JSON.stringify([context(request), row.review_item_id, row.row_kind,
    row.cursor_started_at, row.cursor_record_id])).toString('base64url')}`;
}
export function reviewDaysPage(request: ReviewDaysRequest, rows: readonly ReviewDayRow[]): ReviewDaysResponse {
  // The lookahead is one row. Reduce the prefix by measured UTF-8 bytes, never
  // by estimates or a raised limit. Cursor timestamps retain PostgreSQL precision.
  for (let count = Math.min(rows.length, REVIEW_DAYS_MAXIMUM_ROWS); count >= 0; count--) {
    if (rows.length && !count) break;
    const days: ReviewDay[] = [];
    for (const [index, row] of rows.slice(0, count).entries()) {
      let day = days.at(-1);
      if (day?.reviewItemId !== row.review_item_id) {
        day = { reviewItemId: row.review_item_id, windowStartedAt: row.window_started_at.toISOString(),
          windowEndedAt: row.window_ended_at.toISOString(), records: [], activeRecord: null, complete: false };
        days.push(day);
      }
      const record = row.row_kind === 0 ? null : {
        timeRecordId: row.time_record_id!, targetDisplayName: row.target_display_name!,
        startedAt: row.started_at!.toISOString(), stoppedAt: row.stopped_at?.toISOString() ?? null,
      };
      days[days.length - 1] = { ...day,
        records: row.row_kind === 2 ? [...day.records, record!] : day.records,
        activeRecord: row.row_kind === 1 ? record : day.activeRecord,
        complete: rows[index + 1]?.review_item_id !== row.review_item_id,
      };
    }
    const page: ReviewDaysResponse = { status: 'ready', days,
      nextCursor: rows.length > count ? cursor(request, rows[count - 1]!) : null };
    if (Buffer.byteLength(JSON.stringify(page)) > REVIEW_DAYS_MAXIMUM_BYTES) continue;
    if (!parseReviewDaysResponse(page, request)) throw new Error('Invalid review day projection');
    return page;
  }
  throw new Error('Review day row exceeds the fixed response boundary');
}
