import type { WorkEventCreationPort } from '../ports/WorkEventCreationPort';
import type { AcceptedAssignmentValidationResult } from '../business/AssignmentValidationResult';
import type { WorkEventFactory } from '../business/WorkEventFactory';
import type { BusinessEngine } from '../business/BusinessEngine';
import type { WorkEventRepository } from '../ports/WorkEventRepository';
import type { TimeEntryRepository } from '../ports/TimeEntryRepository';
import type { OfflineQueue } from '../ports/OfflineQueue';
import { workEventCreated, type WorkEventCreated } from '../domain/events/WorkEventCreated';
import type { TimeEntryStarted } from '../domain/events/TimeEntryStarted';
import { workEventQueuedForSync, type WorkEventQueuedForSync } from '../domain/events/WorkEventQueuedForSync';
import { createTimestamp, type Timestamp } from '../domain/Timestamp';

type WorkEventCreationEvent = WorkEventCreated | TimeEntryStarted | WorkEventQueuedForSync;

// The first real implementation of the WorkEventCreationPort seam defined by Development
// Sprint 001. Wires WorkEventFactory (DT-004) -> BusinessEngine (DT-005, deterministic branch)
// -> in-memory repositories (DT-006 slice) -> OfflineQueue (DT-007). Orchestrates only; it
// makes no business decision itself (EP-008 Ch03 5.4) - WorkEvent persistence is unconditional
// (auditability), TimeEntry persistence only happens for the 'time_entry_started' decision.
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

  handleValidatedAssignment(result: AcceptedAssignmentValidationResult): void {
    const workEvent = this.workEventFactory.createFromAcceptedAssignment(result);
    this.workEventRepository.save(workEvent);
    this.onEvent(workEventCreated(workEvent));

    const activeTimeEntryForTarget = this.timeEntryRepository.findActiveByTarget(
      workEvent.organizationId,
      workEvent.target,
    );
    const decision = this.businessEngine.evaluate(workEvent, activeTimeEntryForTarget);

    if (decision.status === 'time_entry_started') {
      this.timeEntryRepository.save(decision.timeEntry);
      this.onEvent(decision.event);
    }

    const queueResult = this.offlineQueue.enqueue({
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
