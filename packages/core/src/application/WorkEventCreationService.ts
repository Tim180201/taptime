import type { WorkEventCreationPort } from '../ports/WorkEventCreationPort';
import type { AcceptedAssignmentValidationResult } from '../business/AssignmentValidationResult';
import type { WorkEventFactory } from '../business/WorkEventFactory';
import type { BusinessEngine } from '../business/BusinessEngine';
import type { WorkEventRepository } from '../ports/WorkEventRepository';
import type { TimeEntryRepository } from '../ports/TimeEntryRepository';
import type { OfflineQueue } from '../ports/OfflineQueue';
import type { DuplicateScanIgnored } from '../domain/events/DuplicateScanIgnored';
import { workEventCreated, type WorkEventCreated } from '../domain/events/WorkEventCreated';
import type { TimeEntryStarted } from '../domain/events/TimeEntryStarted';
import type { TimeEntryStopped } from '../domain/events/TimeEntryStopped';
import { workEventQueuedForSync, type WorkEventQueuedForSync } from '../domain/events/WorkEventQueuedForSync';
import { createTimestamp, type Timestamp } from '../domain/Timestamp';

type WorkEventCreationEvent =
  | WorkEventCreated
  | TimeEntryStarted
  | TimeEntryStopped
  | DuplicateScanIgnored
  | WorkEventQueuedForSync;

// The first real implementation of the WorkEventCreationPort seam defined by Development
// Sprint 001. Wires WorkEventFactory -> BusinessEngine -> repositories -> OfflineQueue.
// Orchestrates only: it loads explicit state, persists the engine result and emits its event;
// it never selects the business outcome itself. WorkEvent persistence remains unconditional.
// Every WorkEvent is enqueued for synchronization regardless of the BusinessEngineDecision
// branch - the queue does not interpret the decision, it only records it (Development Sprint
// 003 Plan, Section 6/16).
export class WorkEventCreationService implements WorkEventCreationPort {
  constructor(
    private readonly workEventFactory: WorkEventFactory,
    private readonly businessEngine: BusinessEngine,
    private readonly workEventRepository: WorkEventRepository,
    private readonly timeEntryRepository: TimeEntryRepository,
    private readonly offlineQueue: OfflineQueue,
    private readonly onEvent: (event: WorkEventCreationEvent) => void = () => {},
    private readonly now: () => Timestamp = () => createTimestamp(new Date().toISOString()),
  ) {}

  async handleValidatedAssignment(result: AcceptedAssignmentValidationResult): Promise<void> {
    const workEvent = this.workEventFactory.createFromAcceptedAssignment(result);
    const previousAcceptedWorkEventForUserAndTarget = await this.workEventRepository.findLatestByUserAndTarget(
      workEvent.organizationId,
      workEvent.triggeredBy,
      workEvent.target,
    );
    await this.workEventRepository.save(workEvent);
    this.onEvent(workEventCreated(workEvent));

    const activeTimeEntryForUser = await this.timeEntryRepository.findActiveByUser(
      workEvent.organizationId,
      workEvent.triggeredBy,
    );
    const decision = this.businessEngine.evaluate(workEvent, {
      activeTimeEntryForUser,
      previousAcceptedWorkEventForUserAndTarget,
    });

    switch (decision.status) {
      case 'time_entry_started':
        await this.timeEntryRepository.save(decision.timeEntry);
        this.onEvent(decision.event);
        break;
      case 'time_entry_stopped':
        await this.timeEntryRepository.update(decision.timeEntry);
        this.onEvent(decision.event);
        break;
      case 'duplicate_scan_ignored':
        this.onEvent(decision.event);
        break;
      case 'active_entry_for_other_target_rejected':
      case 'escalation_required':
        break;
      default:
        decision satisfies never;
    }

    const queueResult = await this.offlineQueue.enqueue({
      workEvent,
      decision,
      syncState: 'pending',
      queuedAt: this.now(),
    });

    if (queueResult.status === 'enqueued') {
      this.onEvent(workEventQueuedForSync(queueResult.record));
    }
  }
}
