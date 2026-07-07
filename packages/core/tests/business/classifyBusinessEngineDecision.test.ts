import { describe, expect, it } from 'vitest';
import { classifyBusinessEngineDecision } from '../../src/business/classifyBusinessEngineDecision';
import { NfcAssignmentId, NfcTagId, OrganizationId, CustomerId, UserId, WorkEventId, TimeEntryId } from '../../src/domain/ids';
import { customerAssignmentTarget } from '../../src/domain/AssignmentTarget';
import { createTimestamp } from '../../src/domain/Timestamp';
import type { WorkEvent } from '../../src/domain/WorkEvent';
import type { TimeEntry } from '../../src/domain/TimeEntry';
import type { BusinessEngineDecision } from '../../src/business/BusinessEngineDecision';

const organizationId = OrganizationId('org-1');
const target = customerAssignmentTarget(CustomerId('customer-1'));
const workEvent: WorkEvent = {
  id: WorkEventId('work-event-1'),
  organizationId,
  assignmentId: NfcAssignmentId('assignment-1'),
  nfcTagId: NfcTagId('tag-1'),
  target,
  triggeredBy: UserId('user-1'),
  occurredAt: createTimestamp('2026-07-06T09:00:00.000Z'),
};
const timeEntry: TimeEntry = {
  id: TimeEntryId('time-entry-1'),
  workEventId: workEvent.id,
  organizationId,
  target,
  status: 'started',
  startedAt: createTimestamp('2026-07-06T09:00:01.000Z'),
};

describe('classifyBusinessEngineDecision (DT-009)', () => {
  it('returns null for time_entry_started (not an error)', () => {
    const decision: BusinessEngineDecision = {
      status: 'time_entry_started',
      timeEntry,
      event: { type: 'TimeEntryStarted', timeEntry },
    };

    expect(classifyBusinessEngineDecision(decision)).toBeNull();
  });

  it('classifies escalation_required as deferred, documenting Finding F-01 without resolving it', () => {
    const decision: BusinessEngineDecision = {
      status: 'escalation_required',
      reason: 'duplicate_scan_rule_undefined',
      workEvent,
    };

    expect(classifyBusinessEngineDecision(decision)).toBe('deferred');
  });
});
