import { describe, expect, expectTypeOf, it } from 'vitest';
import { customerAssignmentTarget } from '../../src/domain/AssignmentTarget';
import { CustomerId, OrganizationId, TimeEntryId, UserId, WorkEventId } from '../../src/domain/ids';
import { createTimestamp } from '../../src/domain/Timestamp';
import { timeEntryStarted } from '../../src/domain/events/TimeEntryStarted';
import { timeEntryStopped } from '../../src/domain/events/TimeEntryStopped';
import type { StartedTimeEntry, StoppedTimeEntry } from '../../src/domain/TimeEntry';

const startWorkEventId = WorkEventId('work-event-start');
const stopWorkEventId = WorkEventId('work-event-stop');
const startedAt = createTimestamp('2026-07-13T08:00:00.000Z');
const stoppedAt = createTimestamp('2026-07-13T12:00:00.000Z');

const startedTimeEntry: StartedTimeEntry = {
  id: TimeEntryId('time-entry-1'),
  workEventId: startWorkEventId,
  organizationId: OrganizationId('org-1'),
  userId: UserId('user-1'),
  target: customerAssignmentTarget(CustomerId('customer-1')),
  status: 'started',
  startedAt,
};

const stoppedTimeEntry: StoppedTimeEntry = {
  ...startedTimeEntry,
  status: 'stopped',
  stoppedAt,
  stoppedByWorkEventId: stopWorkEventId,
};

describe('TimeEntry lifecycle domain foundation', () => {
  it('creates a TimeEntryStarted event typed to and containing the started TimeEntry', () => {
    const event = timeEntryStarted(startedTimeEntry);

    expectTypeOf(event.timeEntry).toEqualTypeOf<StartedTimeEntry>();
    expect(event).toEqual({ type: 'TimeEntryStarted', timeEntry: startedTimeEntry });
  });

  it('creates a TimeEntryStopped event typed to and containing the stopped TimeEntry', () => {
    const event = timeEntryStopped(stoppedTimeEntry);

    expectTypeOf(event.timeEntry).toEqualTypeOf<StoppedTimeEntry>();
    expect(event).toEqual({ type: 'TimeEntryStopped', timeEntry: stoppedTimeEntry });
  });

  it('preserves start and stop WorkEvent traceability and the stop timestamp', () => {
    expect(stoppedTimeEntry.workEventId).toBe(startWorkEventId);
    expect(stoppedTimeEntry.stoppedByWorkEventId).toBe(stopWorkEventId);
    expect(stoppedTimeEntry.stoppedAt).toBe(stoppedAt);
  });
});
