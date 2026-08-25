import { describe, expect, it } from 'vitest';
import { BusinessEngine, type BusinessEngineEvaluationContext } from '../../src/business/BusinessEngine';
import { customerAssignmentTarget } from '../../src/domain/AssignmentTarget';
import type { StartedBreakInterval } from '../../src/domain/BreakInterval';
import type { StartedTimeEntry } from '../../src/domain/TimeEntry';
import { createTimestamp } from '../../src/domain/Timestamp';
import type {
  BreakWorkEvent,
  ManualWorkEvent,
  NfcWorkEvent,
  WorkEvent,
  WorkTargetEvent,
} from '../../src/domain/WorkEvent';
import {
  BreakIntervalId,
  CustomerId,
  NfcAssignmentId,
  NfcTagId,
  OrganizationId,
  TimeEntryId,
  UserId,
  WorkEventId,
} from '../../src/domain/ids';

const organizationId = OrganizationId('org-1');
const userId = UserId('user-1');
const target = customerAssignmentTarget(CustomerId('customer-1'));
const otherTarget = customerAssignmentTarget(CustomerId('customer-2'));

function workEvent(
  id: string,
  at: string,
  other = false,
  via: 'nfc' | 'manual' = 'nfc',
): WorkTargetEvent {
  const base = {
    id: WorkEventId(id),
    organizationId,
    target: other ? otherTarget : target,
    triggeredBy: userId,
    occurredAt: createTimestamp(at),
  };
  return via === 'manual'
    ? { ...base, trigger: { type: 'manual' } } satisfies ManualWorkEvent
    : {
        ...base,
        assignmentId: NfcAssignmentId(`assignment-${id}`),
        nfcTagId: NfcTagId(`tag-${id}`),
      } satisfies NfcWorkEvent;
}

function breakEvent(id: string, at: string, via: 'nfc' | 'manual' = 'nfc'): BreakWorkEvent {
  const base = {
    id: WorkEventId(id),
    organizationId,
    subject: { type: 'break' as const },
    triggeredBy: userId,
    occurredAt: createTimestamp(at),
  };
  return via === 'manual'
    ? { ...base, trigger: { type: 'manual' } }
    : {
        ...base,
        assignmentId: NfcAssignmentId(`assignment-${id}`),
        nfcTagId: NfcTagId(`tag-${id}`),
        trigger: {
          type: 'nfc',
          assignmentId: NfcAssignmentId(`assignment-${id}`),
          nfcTagId: NfcTagId(`tag-${id}`),
        },
      };
}

function activeEntry(): StartedTimeEntry {
  return {
    id: TimeEntryId('time-entry-1'),
    workEventId: WorkEventId('work-start'),
    organizationId,
    userId,
    target,
    status: 'started',
    startedAt: createTimestamp('2026-08-25T08:00:00.000Z'),
    startedVia: 'nfc',
  };
}

function activeBreak(via: 'nfc' | 'manual' = 'nfc'): StartedBreakInterval {
  return {
    id: BreakIntervalId('break-1'),
    organizationId,
    userId,
    timeEntryId: TimeEntryId('time-entry-1'),
    status: 'started',
    startedAt: createTimestamp('2026-08-25T10:00:00.000Z'),
    startedByWorkEventId: WorkEventId('break-start'),
    startedVia: via,
  };
}

function context(
  entry: StartedTimeEntry | null,
  breakInterval: StartedBreakInterval | null,
  previous: WorkEvent | null = null,
): BusinessEngineEvaluationContext {
  return {
    activeTimeEntryForUser: entry,
    activeBreakIntervalForUser: breakInterval,
    previousAcceptedWorkEventForUserAndTarget: previous,
  };
}

describe('BusinessEngine T-012 break decision matrix', () => {
  it('rejects the single break trigger when no TimeEntry is active', () => {
    const event = breakEvent('break-no-work', '2026-08-25T10:00:00.000Z');
    expect(new BusinessEngine().evaluate(event, context(null, null))).toEqual({
      status: 'break_without_active_time_entry_rejected',
      workEvent: event,
    });
  });

  it.each(['nfc', 'manual'] as const)(
    'starts a break via %s while preserving the open TimeEntry and boundary provenance',
    (via) => {
      const entry = activeEntry();
      const event = breakEvent(`break-${via}`, '2026-08-25T10:00:00.000Z', via);
      const decision = new BusinessEngine(
        () => TimeEntryId('unused'),
        () => BreakIntervalId('break-new'),
      ).evaluate(event, context(entry, null));

      expect(decision).toEqual({
        status: 'break_started',
        timeEntry: entry,
        breakInterval: {
          id: 'break-new',
          organizationId,
          userId,
          timeEntryId: entry.id,
          status: 'started',
          startedAt: event.occurredAt,
          startedByWorkEventId: event.id,
          startedVia: via,
        },
        event: {
          type: 'BreakIntervalStarted',
          breakInterval: expect.objectContaining({ id: 'break-new', startedVia: via }),
        },
      });
      expect(entry.status).toBe('started');
    },
  );

  it.each(['nfc', 'manual'] as const)(
    'the same single break trigger ends an active break via %s',
    (via) => {
      const entry = activeEntry();
      const currentBreak = activeBreak();
      const event = breakEvent(`break-stop-${via}`, '2026-08-25T10:30:00.000Z', via);
      const decision = new BusinessEngine().evaluate(event, context(entry, currentBreak));

      expect(decision).toEqual(expect.objectContaining({
        status: 'break_stopped',
        timeEntry: entry,
        breakInterval: {
          ...currentBreak,
          status: 'stopped',
          stoppedAt: event.occurredAt,
          stoppedByWorkEventId: event.id,
          stoppedVia: via,
        },
      }));
      expect(decision.status).toBe('break_stopped');
      if (decision.status !== 'break_stopped') throw new Error('Expected break_stopped');
      expect(decision.timeEntry.status).toBe('started');
    },
  );

  it.each([
    ['nfc', 'same', false],
    ['nfc', 'other', true],
    ['manual', 'same', false],
    ['manual', 'other', true],
  ] as const)(
    'rejects a %s work trigger for the %s target during a break and leaves both open',
    (via, _label, other) => {
    const entry = activeEntry();
    const currentBreak = activeBreak();
    const event = workEvent(
      `work-${via}-${String(other)}`,
      '2026-08-25T10:15:00.000Z',
      other,
      via,
    );

    expect(new BusinessEngine().evaluate(event, context(entry, currentBreak))).toEqual({
      status: 'work_trigger_during_break_rejected',
      workEvent: event,
      activeTimeEntry: entry,
      activeBreakInterval: currentBreak,
    });
    expect(entry.status).toBe('started');
    expect(currentBreak.status).toBe('started');
  });

  it('applies the five-second duplicate guard to break triggers before toggling the break', () => {
    const previous = breakEvent('break-first', '2026-08-25T10:00:00.000Z');
    const duplicate = breakEvent('break-duplicate', '2026-08-25T10:00:04.999Z');
    const entry = activeEntry();
    const currentBreak = activeBreak();

    expect(new BusinessEngine().evaluate(duplicate, context(entry, currentBreak, previous))).toEqual({
      status: 'duplicate_scan_ignored',
      workEvent: duplicate,
      previousWorkEvent: previous,
      event: { type: 'DuplicateScanIgnored', workEvent: duplicate, previousWorkEvent: previous },
    });
  });
});
