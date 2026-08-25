import type {
  BreakIntervalId,
  OrganizationId,
  TimeEntryId,
  UserId,
  WorkEventId,
} from './ids';
import type { Timestamp } from './Timestamp';
import type { WorkEventTriggerType } from './WorkEvent';

interface BreakIntervalBase {
  readonly id: BreakIntervalId;
  readonly organizationId: OrganizationId;
  readonly userId: UserId;
  readonly timeEntryId: TimeEntryId;
  readonly startedAt: Timestamp;
  readonly startedByWorkEventId: WorkEventId;
  readonly startedVia: WorkEventTriggerType;
}

export interface StartedBreakInterval extends BreakIntervalBase {
  readonly status: 'started';
}

export interface StoppedBreakInterval extends BreakIntervalBase {
  readonly status: 'stopped';
  readonly stoppedAt: Timestamp;
  readonly stoppedByWorkEventId: WorkEventId;
  readonly stoppedVia: WorkEventTriggerType;
}

export type BreakInterval = StartedBreakInterval | StoppedBreakInterval;
