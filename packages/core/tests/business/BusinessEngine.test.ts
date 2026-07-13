import { describe, expect, it } from 'vitest';
import { BusinessEngine } from '../../src/business/BusinessEngine';
import { NfcAssignmentId, NfcTagId, OrganizationId, CustomerId, UserId, WorkEventId, TimeEntryId } from '../../src/domain/ids';
import { customerAssignmentTarget } from '../../src/domain/AssignmentTarget';
import { createTimestamp } from '../../src/domain/Timestamp';
import type { WorkEvent } from '../../src/domain/WorkEvent';
import type { TimeEntry } from '../../src/domain/TimeEntry';

const organizationId = OrganizationId('org-1');
const target = customerAssignmentTarget(CustomerId('customer-1'));

const workEvent: WorkEvent = {
  id: WorkEventId('work-event-1'),
  organizationId,
  assignmentId: NfcAssignmentId('assignment-1'),
  nfcTagId: NfcTagId('tag-1'),
  target,
  triggeredBy: UserId('user-1'),
  occurredAt: createTimestamp('2026-07-03T12:00:00.000Z'),
};

describe('BusinessEngine (DT-005, deterministic branch)', () => {
  it('produces TimeEntryStarted owned by the WorkEvent user when no active TimeEntry exists for the target', () => {
    const engine = new BusinessEngine(
      () => TimeEntryId('time-entry-1'),
      () => createTimestamp('2026-07-03T12:00:01.000Z'),
    );

    const decision = engine.evaluate(workEvent, null);

    expect(decision).toEqual({
      status: 'time_entry_started',
      timeEntry: {
        id: 'time-entry-1',
        workEventId: workEvent.id,
        organizationId,
        userId: workEvent.triggeredBy,
        target,
        status: 'started',
        startedAt: '2026-07-03T12:00:01.000Z',
      },
      event: {
        type: 'TimeEntryStarted',
        timeEntry: {
          id: 'time-entry-1',
          workEventId: workEvent.id,
          organizationId,
          userId: workEvent.triggeredBy,
          target,
          status: 'started',
          startedAt: '2026-07-03T12:00:01.000Z',
        },
      },
    });
  });

  it('returns an explicit escalation, never a guessed stop/duplicate/defer outcome, when an active TimeEntry already exists', () => {
    const engine = new BusinessEngine();
    const activeTimeEntry: TimeEntry = {
      id: TimeEntryId('time-entry-existing'),
      workEventId: WorkEventId('work-event-existing'),
      organizationId,
      userId: UserId('user-1'),
      target,
      status: 'started',
      startedAt: createTimestamp('2026-07-03T11:00:00.000Z'),
    };

    const decision = engine.evaluate(workEvent, activeTimeEntry);

    expect(decision).toEqual({
      status: 'escalation_required',
      reason: 'duplicate_scan_rule_undefined',
      workEvent,
    });
  });

  it('is deterministic: same WorkEvent and same active-TimeEntry state always produce the same decision', () => {
    const engine = new BusinessEngine(
      () => TimeEntryId('time-entry-1'),
      () => createTimestamp('2026-07-03T12:00:01.000Z'),
    );

    const first = engine.evaluate(workEvent, null);
    const second = engine.evaluate(workEvent, null);

    expect(first).toEqual(second);
  });
});
