import { describe, expect, it } from 'vitest';
import { BusinessEngine, type BusinessEngineEvaluationContext } from '../../src/business/BusinessEngine';
import { NfcAssignmentId, NfcTagId, OrganizationId, CustomerId, UserId, WorkEventId, TimeEntryId } from '../../src/domain/ids';
import { customerAssignmentTarget } from '../../src/domain/AssignmentTarget';
import { createTimestamp } from '../../src/domain/Timestamp';
import type { AssignmentTarget } from '../../src/domain/AssignmentTarget';
import type { WorkEvent } from '../../src/domain/WorkEvent';
import type { StartedTimeEntry } from '../../src/domain/TimeEntry';

const organizationId = OrganizationId('org-1');
const userId = UserId('user-1');
const target = customerAssignmentTarget(CustomerId('customer-1'));
const otherTarget = customerAssignmentTarget(CustomerId('customer-2'));

function buildWorkEvent(
  id: string,
  occurredAt: string,
  eventTarget: AssignmentTarget = target,
  triggeredBy = userId,
  eventOrganizationId = organizationId,
): WorkEvent {
  return {
    id: WorkEventId(id),
    organizationId: eventOrganizationId,
    assignmentId: NfcAssignmentId(`assignment-${id}`),
    nfcTagId: NfcTagId(`tag-${id}`),
    target: eventTarget,
    triggeredBy,
    occurredAt: createTimestamp(occurredAt),
  };
}

function buildStartedTimeEntry(startWorkEvent: WorkEvent): StartedTimeEntry {
  return {
    id: TimeEntryId('time-entry-1'),
    workEventId: startWorkEvent.id,
    organizationId: startWorkEvent.organizationId,
    userId: startWorkEvent.triggeredBy,
    target: startWorkEvent.target,
    status: 'started',
    startedAt: startWorkEvent.occurredAt,
  };
}

function context(
  activeTimeEntryForUser: StartedTimeEntry | null,
  previousAcceptedWorkEventForUserAndTarget: WorkEvent | null,
): BusinessEngineEvaluationContext {
  return { activeTimeEntryForUser, previousAcceptedWorkEventForUserAndTarget };
}

describe('BusinessEngine (F-01 lifecycle)', () => {
  it('starts a TimeEntry at the WorkEvent timestamp when the user has no active entry', () => {
    const engine = new BusinessEngine(() => TimeEntryId('time-entry-1'));
    const workEvent = buildWorkEvent('work-event-start', '2026-07-13T08:00:00.000Z');

    const decision = engine.evaluate(workEvent, context(null, null));

    expect(decision).toEqual({
      status: 'time_entry_started',
      timeEntry: {
        id: 'time-entry-1',
        workEventId: workEvent.id,
        organizationId,
        userId,
        target,
        status: 'started',
        startedAt: workEvent.occurredAt,
        startedVia: 'nfc',
      },
      event: {
        type: 'TimeEntryStarted',
        timeEntry: expect.objectContaining({ workEventId: workEvent.id, startedAt: workEvent.occurredAt }),
      },
    });
  });

  it('ignores a scan less than five seconds after the previous accepted scan before evaluating stop', () => {
    const engine = new BusinessEngine();
    const previousWorkEvent = buildWorkEvent('work-event-start', '2026-07-13T08:00:00.000Z');
    const activeTimeEntry = buildStartedTimeEntry(previousWorkEvent);
    const workEvent = buildWorkEvent('work-event-duplicate', '2026-07-13T08:00:04.999Z');

    const decision = engine.evaluate(workEvent, context(activeTimeEntry, previousWorkEvent));

    expect(decision).toEqual({
      status: 'duplicate_scan_ignored',
      workEvent,
      previousWorkEvent,
      event: { type: 'DuplicateScanIgnored', workEvent, previousWorkEvent },
    });
  });

  it('stops at exactly five seconds and preserves start/stop WorkEvent traceability', () => {
    const engine = new BusinessEngine();
    const startWorkEvent = buildWorkEvent('work-event-start', '2026-07-13T08:00:00.000Z');
    const activeTimeEntry = buildStartedTimeEntry(startWorkEvent);
    const stopWorkEvent = buildWorkEvent('work-event-stop', '2026-07-13T08:00:05.000Z');

    const decision = engine.evaluate(stopWorkEvent, context(activeTimeEntry, startWorkEvent));

    expect(decision).toEqual({
      status: 'time_entry_stopped',
      timeEntry: {
        ...activeTimeEntry,
        status: 'stopped',
        stoppedAt: stopWorkEvent.occurredAt,
        stoppedByWorkEventId: stopWorkEvent.id,
        stoppedVia: 'nfc',
      },
      event: {
        type: 'TimeEntryStopped',
        timeEntry: expect.objectContaining({
          workEventId: startWorkEvent.id,
          stoppedByWorkEventId: stopWorkEvent.id,
          stoppedAt: stopWorkEvent.occurredAt,
        }),
      },
    });
  });

  it('stops a later scan for the same target', () => {
    const engine = new BusinessEngine();
    const startWorkEvent = buildWorkEvent('work-event-start', '2026-07-13T08:00:00.000Z');
    const stopWorkEvent = buildWorkEvent('work-event-stop', '2026-07-13T12:00:00.000Z');

    const decision = engine.evaluate(
      stopWorkEvent,
      context(buildStartedTimeEntry(startWorkEvent), startWorkEvent),
    );

    expect(decision.status).toBe('time_entry_stopped');
  });

  it('rejects an active TimeEntry for another target without changing it', () => {
    const engine = new BusinessEngine();
    const activeStartWorkEvent = buildWorkEvent('work-event-other-target', '2026-07-13T08:00:00.000Z', otherTarget);
    const activeTimeEntry = buildStartedTimeEntry(activeStartWorkEvent);
    const workEvent = buildWorkEvent('work-event-current', '2026-07-13T08:00:10.000Z');

    const decision = engine.evaluate(workEvent, context(activeTimeEntry, null));

    expect(decision).toEqual({
      status: 'active_entry_for_other_target_rejected',
      workEvent,
      activeTimeEntry,
    });
  });

  it('starts independently for another user on the same target when that user has no active entry', () => {
    const engine = new BusinessEngine(() => TimeEntryId('time-entry-user-2'));
    const otherUserId = UserId('user-2');
    const workEvent = buildWorkEvent('work-event-user-2', '2026-07-13T08:00:00.000Z', target, otherUserId);

    const decision = engine.evaluate(workEvent, context(null, null));

    expect(decision).toEqual(
      expect.objectContaining({
        status: 'time_entry_started',
        timeEntry: expect.objectContaining({ userId: otherUserId, target }),
      }),
    );
  });

  it.each([
    [
      'organization',
      { organizationId: OrganizationId('org-2') },
      'active_time_entry_organization_mismatch',
    ],
    ['user', { userId: UserId('user-2') }, 'active_time_entry_user_mismatch'],
  ] as const)('escalates an active TimeEntry with a mismatched %s', (_label, override, reason) => {
    const engine = new BusinessEngine();
    const startWorkEvent = buildWorkEvent('work-event-start', '2026-07-13T08:00:00.000Z');
    const activeTimeEntry = { ...buildStartedTimeEntry(startWorkEvent), ...override };
    const workEvent = buildWorkEvent('work-event-current', '2026-07-13T08:00:10.000Z');

    expect(engine.evaluate(workEvent, context(activeTimeEntry, startWorkEvent))).toEqual({
      status: 'escalation_required',
      reason,
      workEvent,
    });
  });

  it('escalates a WorkEvent that runs backward relative to the active TimeEntry', () => {
    const engine = new BusinessEngine();
    const startWorkEvent = buildWorkEvent('work-event-start', '2026-07-13T08:00:05.000Z');
    const activeTimeEntry = buildStartedTimeEntry(startWorkEvent);
    const workEvent = buildWorkEvent('work-event-backward', '2026-07-13T08:00:04.999Z');

    expect(engine.evaluate(workEvent, context(activeTimeEntry, null))).toEqual({
      status: 'escalation_required',
      reason: 'work_event_precedes_active_time_entry',
      workEvent,
    });
  });

  it('escalates a WorkEvent that runs backward relative to the previous accepted WorkEvent', () => {
    const engine = new BusinessEngine();
    const previousWorkEvent = buildWorkEvent('work-event-previous', '2026-07-13T08:00:05.000Z');
    const workEvent = buildWorkEvent('work-event-backward', '2026-07-13T08:00:04.999Z');

    expect(engine.evaluate(workEvent, context(null, previousWorkEvent))).toEqual({
      status: 'escalation_required',
      reason: 'work_event_precedes_previous_accepted_work_event',
      workEvent,
    });
  });

  it('is deterministic for the same WorkEvent and explicit context', () => {
    const engine = new BusinessEngine(() => TimeEntryId('time-entry-1'));
    const workEvent = buildWorkEvent('work-event-start', '2026-07-13T08:00:00.000Z');
    const evaluationContext = context(null, null);

    expect(engine.evaluate(workEvent, evaluationContext)).toEqual(engine.evaluate(workEvent, evaluationContext));
  });
});
