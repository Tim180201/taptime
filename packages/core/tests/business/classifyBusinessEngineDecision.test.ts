import { describe, expect, it } from 'vitest';
import { classifyBusinessEngineDecision } from '../../src/business/classifyBusinessEngineDecision';
import { NfcAssignmentId, NfcTagId, OrganizationId, CustomerId, UserId, WorkEventId, TimeEntryId } from '../../src/domain/ids';
import { customerAssignmentTarget } from '../../src/domain/AssignmentTarget';
import { createTimestamp } from '../../src/domain/Timestamp';
import type { WorkEvent } from '../../src/domain/WorkEvent';
import type { StartedTimeEntry, StoppedTimeEntry } from '../../src/domain/TimeEntry';
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
const startedTimeEntry: StartedTimeEntry = {
  id: TimeEntryId('time-entry-1'),
  workEventId: workEvent.id,
  organizationId,
  userId: workEvent.triggeredBy,
  target,
  status: 'started',
  startedAt: workEvent.occurredAt,
};
const stoppedTimeEntry: StoppedTimeEntry = {
  ...startedTimeEntry,
  status: 'stopped',
  stoppedAt: createTimestamp('2026-07-06T10:00:00.000Z'),
  stoppedByWorkEventId: WorkEventId('work-event-stop'),
};

describe('classifyBusinessEngineDecision (DT-009, F-01)', () => {
  it.each([
    {
      status: 'time_entry_started',
      timeEntry: startedTimeEntry,
      event: { type: 'TimeEntryStarted', timeEntry: startedTimeEntry },
    },
    {
      status: 'time_entry_stopped',
      timeEntry: stoppedTimeEntry,
      event: { type: 'TimeEntryStopped', timeEntry: stoppedTimeEntry },
    },
    {
      status: 'duplicate_scan_ignored',
      workEvent,
      previousWorkEvent: workEvent,
      event: { type: 'DuplicateScanIgnored', workEvent, previousWorkEvent: workEvent },
    },
  ] satisfies readonly BusinessEngineDecision[])('classifies $status as no error', (decision) => {
    expect(classifyBusinessEngineDecision(decision)).toBeNull();
  });

  it('classifies an active entry for another target as recoverable', () => {
    const decision: BusinessEngineDecision = {
      status: 'active_entry_for_other_target_rejected',
      workEvent,
      activeTimeEntry: startedTimeEntry,
    };

    expect(classifyBusinessEngineDecision(decision)).toBe('recoverable');
  });

  it('classifies an inconsistent state escalation as deferred', () => {
    const decision: BusinessEngineDecision = {
      status: 'escalation_required',
      reason: 'work_event_precedes_previous_accepted_work_event',
      workEvent,
    };

    expect(classifyBusinessEngineDecision(decision)).toBe('deferred');
  });
});
