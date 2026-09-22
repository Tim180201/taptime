import { describe, expect, it } from 'vitest';
import { BusinessEngine } from '../../src/business/BusinessEngine';
import { customerAssignmentTarget } from '../../src/domain/AssignmentTarget';
import { createTimestamp } from '../../src/domain/Timestamp';
import { BreakIntervalId, CustomerId, OrganizationId, TimeEntryId, UserId, WorkEventId } from '../../src/domain/ids';
import type { AdministrationWorkEvent, ManualWorkEvent } from '../../src/domain/WorkEvent';
import type { StartedTimeEntry } from '../../src/domain/TimeEntry';
import type { StartedBreakInterval } from '../../src/domain/BreakInterval';

const base = { organizationId: OrganizationId('org'), triggeredBy: UserId('person'), target: customerAssignmentTarget(CustomerId('target')) };
const start: ManualWorkEvent = { ...base, id: WorkEventId('start'), occurredAt: createTimestamp('2026-09-22T08:00:00.000Z'), trigger: { type: 'manual' } };
const active: StartedTimeEntry = { id: TimeEntryId('entry'), workEventId: start.id, organizationId: base.organizationId, userId: base.triggeredBy, target: base.target, status: 'started', startedAt: start.occurredAt, startedVia: 'manual' };
const pause: StartedBreakInterval = { id: BreakIntervalId('pause'), organizationId: base.organizationId, userId: base.triggeredBy, timeEntryId: active.id, status: 'started', startedAt: createTimestamp('2026-09-22T10:00:00.000Z'), startedByWorkEventId: WorkEventId('pause-start'), startedVia: 'manual' };
const admin = (at: string): AdministrationWorkEvent => ({ ...base, id: WorkEventId('administration-stop'), occurredAt: createTimestamp(at), trigger: { type: 'administration' } });
const context = (withPause: boolean) => ({ activeTimeEntryForUser: active, activeBreakIntervalForUser: withPause ? pause : null, previousAcceptedWorkEventForUserAndTarget: start });

describe('T-069 / D-076: administration closes time through the engine', () => {
  it.each(['2026-09-22T10:00:00.000Z', '2026-09-22T12:00:00.000Z'])('closes the open break and work with the same event at %s', at => {
    const stop = admin(at);
    expect(new BusinessEngine().evaluate(stop, context(true))).toMatchObject({
      status: 'time_entry_stopped',
      timeEntry: { ...active, status: 'stopped', stoppedAt: at, stoppedVia: 'administration', stoppedByWorkEventId: stop.id },
      closedBreakInterval: { ...pause, status: 'stopped', stoppedAt: at, stoppedVia: 'administration', stoppedByWorkEventId: stop.id },
    });
    expect(active.status).toBe('started'); expect(pause.status).toBe('started');
  });
  it('does not apply the device duplicate window to a deliberate administrative stop', () => {
    expect(new BusinessEngine().evaluate(admin('2026-09-22T08:00:01.000Z'), context(false))).toMatchObject({ status: 'time_entry_stopped', timeEntry: { stoppedVia: 'administration' } });
  });
  it('still rejects a device work trigger during a break', () => {
    expect(new BusinessEngine().evaluate({ ...admin('2026-09-22T12:00:00.000Z'), trigger: { type: 'manual' } }, context(true)).status).toBe('work_trigger_during_break_rejected');
  });
  it('still ignores a device trigger inside the duplicate window', () => {
    expect(new BusinessEngine().evaluate({ ...admin('2026-09-22T08:00:01.000Z'), trigger: { type: 'manual' } }, context(false)).status).toBe('duplicate_scan_ignored');
  });
  it('escalates a late device trigger instead of starting another entry, even during the duplicate window', () => {
    const event = { ...start, id: WorkEventId('late'), occurredAt: createTimestamp('2026-09-22T08:00:01.000Z') };
    expect(new BusinessEngine().evaluate(event, {
      activeTimeEntryForUser: null, previousAcceptedWorkEventForUserAndTarget: start,
      administrationStoppedBeforeTrigger: true,
    })).toMatchObject({ status: 'escalation_required', reason: 'administration_stopped', workEvent: event });
  });
  it('starts normally after the administrative action boundary', () => {
    expect(new BusinessEngine().evaluate({ ...start, occurredAt: createTimestamp('2026-09-22T13:00:00.000Z') }, {
      activeTimeEntryForUser: null, previousAcceptedWorkEventForUserAndTarget: admin('2026-09-22T12:00:00.000Z'),
      administrationStoppedBeforeTrigger: false,
    }).status).toBe('time_entry_started');
  });
});
