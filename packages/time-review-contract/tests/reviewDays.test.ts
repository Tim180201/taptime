import { expect, it } from 'vitest';
import { parseReviewDaysRequest, parseReviewDaysResponse, REVIEW_DAYS_MAXIMUM_CASES, REVIEW_DAYS_MAXIMUM_BYTES } from '../src/index.js';

const member = '10000000-0000-4000-8000-000000000001';
const review = '20000000-0000-4000-8000-000000000001';
const record = '30000000-0000-4000-8000-000000000001';
const request = { expectedMembershipId: member, reviewItemIds: [review], cursor: null };
const day = { reviewItemId: review, windowStartedAt: '2026-03-28T23:00:00.000Z', windowEndedAt: '2026-03-29T22:00:00.000Z',
  records: [{ timeRecordId: record, targetDisplayName: 'Werkstatt', startedAt: '2026-03-29T08:00:00.000Z', stoppedAt: '2026-03-29T09:00:00.000Z' }],
  activeRecord: null, complete: true };
const response = { status: 'ready', days: [day], nextCursor: null };
it('accepts only case IDs and the fixed, duplicate-free batch boundary', () => {
  expect(parseReviewDaysRequest(request)).toEqual(request);
  for (const patch of [{ targetMembershipId: member }, { fromInclusive: day.windowStartedAt }, { limit: 100 },
    { reviewItemIds: [] }, { reviewItemIds: [review, review] }, { reviewItemIds: ['invalid'] },
    { reviewItemIds: Array.from({ length: REVIEW_DAYS_MAXIMUM_CASES + 1 }, (_, index) => `20000000-0000-4000-8000-${String(index).padStart(12, '0')}`) }]) {
    expect(parseReviewDaysRequest({ ...request, ...patch })).toBeNull();
  }
});
it('checks the shared response against its exact requested IDs and Berlin day', () => {
  expect(parseReviewDaysResponse(response, request)).toEqual(response);
  expect(parseReviewDaysResponse({ ...response, days: [{ ...day, reviewItemId: member }] }, request)).toBeNull();
  expect(parseReviewDaysResponse({ ...response, days: [{ ...day, windowEndedAt: '2026-03-29T23:00:00.000Z' }] }, request)).toBeNull();
  expect(parseReviewDaysResponse({ ...response, days: [day, day] }, request)).toBeNull();
  expect(parseReviewDaysResponse({ ...response, days: [{ ...day, records: [...day.records, ...day.records] }] }, request)).toBeNull();
  expect(parseReviewDaysResponse({ ...response, days: [{ ...day, complete: false }] }, request)).toBeNull();
  expect(parseReviewDaysResponse({ ...response, secret: 'unexpected' }, request)).toBeNull();
});
it('rejects oversized UTF-8 content even if each display name is within its field limit', () => {
  const records = Array.from({ length: REVIEW_DAYS_MAXIMUM_CASES }, (_, index) => ({ ...day.records[0],
    timeRecordId: `30000000-0000-4000-8000-${String(index).padStart(12, '0')}`, targetDisplayName: '😀'.repeat(120) }));
  const oversized = { ...response, days: [{ ...day, records }, { ...day, reviewItemId: member, records }] };
  expect(new TextEncoder().encode(JSON.stringify(oversized)).length).toBeGreaterThan(REVIEW_DAYS_MAXIMUM_BYTES);
  expect(parseReviewDaysResponse(oversized, { ...request, reviewItemIds: [review, member] })).toBeNull();
});

it('accepts a valid zero-duration record inside the day, as the existing time contract does', () => {
  const zero={...day.records[0]!,stoppedAt:day.records[0]!.startedAt};
  const page={...response,days:[{...day,records:[zero]}]};
  expect(parseReviewDaysResponse(page,request)).toEqual(page);
});
