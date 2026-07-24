import { describe, expect, it } from 'vitest';
import {
  validateManualLifecycleRequest,
  validateMobileOwnTimeQueryRequest,
  validateMobileWorkTargetQueryRequest,
  validateProjectCreateRequest,
  validateProjectDeactivateRequest,
} from '../src/index.js';

const membershipId = '10000000-0000-4000-8000-000000000001';
const workEventId = '20000000-0000-4000-8000-000000000001';
const targetId = '30000000-0000-4000-8000-000000000001';
const receiptId = '40000000-0000-4000-8000-000000000001';

describe('DA5 closed mobile work contracts', () => {
  it('accepts exact bounded page requests and rejects authority fields', () => {
    expect(validateMobileOwnTimeQueryRequest({
      expectedMembershipId: membershipId,
      limit: 20,
      cursor: null,
    })).toBe(true);
    expect(validateMobileWorkTargetQueryRequest({
      expectedMembershipId: membershipId,
      limit: 50,
      cursor: 'v1:target',
    })).toBe(true);
    expect(validateMobileOwnTimeQueryRequest({
      expectedMembershipId: membershipId,
      organizationId: targetId,
      limit: 20,
      cursor: null,
    })).toBe(false);
  });

  it('keeps manual actions target-only and caller lifecycle-free', () => {
    expect(validateManualLifecycleRequest({
      expectedMembershipId: membershipId,
      workEvent: {
        id: workEventId,
        target: { targetType: 'project', targetId },
      },
      receipt: { id: receiptId, attemptNumber: 1 },
    })).toBe(true);
    expect(validateManualLifecycleRequest({
      expectedMembershipId: membershipId,
      workEvent: {
        id: workEventId,
        target: { targetType: 'customer', targetId },
        action: 'start',
      },
      receipt: { id: receiptId, attemptNumber: 1 },
    })).toBe(false);
  });

  it('accepts exact Project commands and rejects stale/hostile shapes', () => {
    expect(validateProjectCreateRequest({
      expectedMembershipId: membershipId,
      commandId: receiptId,
      projectId: targetId,
      displayName: 'Projekt Nord',
    })).toBe(true);
    expect(validateProjectDeactivateRequest({
      expectedMembershipId: membershipId,
      commandId: receiptId,
      projectId: targetId,
      expectedRowVersion: 2,
    })).toBe(true);
    expect(validateProjectDeactivateRequest({
      expectedMembershipId: membershipId,
      commandId: receiptId,
      projectId: targetId,
      expectedRowVersion: 0,
    })).toBe(false);
  });
});
