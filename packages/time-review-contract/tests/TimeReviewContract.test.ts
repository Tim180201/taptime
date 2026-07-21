import { describe, expect, it } from 'vitest';
import {
  canonicalTimeReviewCommandPayload,
  validateMobileReviewStateRequest,
  validateReviewAdjudicationRequest,
  validateReviewItemQueryRequest,
  validateTimeRecordCorrectionRequest,
  validateTimeRecordQueryRequest,
} from '../src/index.js';

const expectedMembershipId = '22222222-2222-4222-8222-222222222222';
const commandId = '33333333-3333-4333-8333-333333333333';
const timeRecordId = '44444444-4444-4444-8444-444444444444';
const reviewItemId = '55555555-5555-4555-8555-555555555555';

describe('time-review contract', () => {
  it('accepts only a closed bounded time-record query', () => {
    const request = {
      expectedMembershipId,
      fromInclusive: '2026-07-01T00:00:00.000Z',
      toExclusive: '2026-08-01T00:00:00.000Z',
      limit: 100,
      cursor: null,
    };
    expect(validateTimeRecordQueryRequest(request).status).toBe('valid');
    expect(validateTimeRecordQueryRequest({ ...request, limit: 101 }).status).toBe('invalid_request');
    expect(validateTimeRecordQueryRequest({ ...request, organizationId: timeRecordId }).status)
      .toBe('invalid_request');
  });

  it('preserves the verbatim Human reason while enforcing btrim length and interval shape', () => {
    const request = {
      expectedMembershipId,
      commandId,
      timeRecordId,
      expectedBaseRowVersion: 2,
      expectedRevisionNumber: 0,
      startedAt: '2026-07-20T08:00:00.000Z',
      stoppedAt: '2026-07-20T16:00:00.000Z',
      reason: '  Kundennachweis geprüft  ',
    };
    const result = validateTimeRecordCorrectionRequest(request);
    expect(result).toMatchObject({ status: 'valid' });
    if (result.status === 'valid') expect(result.request.reason).toBe(request.reason);
    expect(validateTimeRecordCorrectionRequest({ ...request, reason: '   ' }).status)
      .toBe('invalid_request');
    expect(validateTimeRecordCorrectionRequest({ ...request, reason: '\u00a0' }).status)
      .toBe('valid');
    expect(validateTimeRecordCorrectionRequest({ ...request, reason: '😀'.repeat(500) }).status)
      .toBe('valid');
    expect(validateTimeRecordCorrectionRequest({ ...request, reason: '😀'.repeat(501) }).status)
      .toBe('invalid_request');
    expect(validateTimeRecordCorrectionRequest({
      ...request,
      startedAt: request.stoppedAt,
      stoppedAt: request.startedAt,
    }).status).toBe('invalid_request');
  });

  it('validates bounded review queries and exact unique adjudication item sets', () => {
    expect(validateReviewItemQueryRequest({ expectedMembershipId, limit: 25, cursor: null }).status)
      .toBe('valid');
    const request = {
      expectedMembershipId,
      commandId,
      reviewItemIds: [reviewItemId],
      resolution: { type: 'no_time_record_change' },
      reason: 'Serverbeleg erklärt.',
    };
    expect(validateReviewAdjudicationRequest(request).status).toBe('valid');
    expect(validateReviewAdjudicationRequest({
      ...request,
      reviewItemIds: [reviewItemId, reviewItemId],
    }).status).toBe('invalid_request');
  });

  it('defines a deterministic versioned canonical command payload', () => {
    const request = {
      expectedMembershipId,
      commandId,
      timeRecordId,
      expectedBaseRowVersion: 2,
      expectedRevisionNumber: 1,
      startedAt: '2026-07-20T08:00:00.000Z',
      stoppedAt: '2026-07-20T16:00:00.000Z',
      reason: 'Korrektur',
    };
    const first = canonicalTimeReviewCommandPayload(request);
    expect(canonicalTimeReviewCommandPayload({ ...request })).toBe(first);
    expect(first).toBe(
      '["time_record_correction_v1","22222222-2222-4222-8222-222222222222",'
      + '"33333333-3333-4333-8333-333333333333",'
      + '"44444444-4444-4444-8444-444444444444",2,1,'
      + '"2026-07-20T08:00:00.000Z","2026-07-20T16:00:00.000Z","Korrektur"]',
    );
    expect(canonicalTimeReviewCommandPayload({
      expectedMembershipId,
      commandId,
      reviewItemIds: [reviewItemId],
      resolution: {
        type: 'create_recovered_time_record',
        startedAt: request.startedAt,
        stoppedAt: request.stoppedAt,
      },
      reason: 'Wiederherstellung',
    })).toBe(
      '["review_adjudication_v1","22222222-2222-4222-8222-222222222222",'
      + '"33333333-3333-4333-8333-333333333333",'
      + '["55555555-5555-4555-8555-555555555555"],'
      + '["create_recovered_time_record","2026-07-20T08:00:00.000Z",'
      + '"2026-07-20T16:00:00.000Z"],"Wiederherstellung"]',
    );
    expect(canonicalTimeReviewCommandPayload({ ...request, reason: 'Andere Korrektur' }))
      .not.toBe(first);
  });

  it('allows only exact current-membership and installation identifiers for Mobile state', () => {
    expect(validateMobileReviewStateRequest({
      expectedMembershipId,
      installationId: '66666666-6666-4666-8666-666666666666',
    }).status).toBe('valid');
    expect(validateMobileReviewStateRequest({ expectedMembershipId }).status).toBe('invalid_request');
  });
});
