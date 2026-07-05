# EP-007 Development Tasks – NFC Scan Creates Work Event

Status: Draft  
Epic: EP-007 – Product Architecture Foundation  
Owner: Technical Lead  
Approval Authority: Human Architect  
Related Feature Blueprint: `ADO/01_Architecture/Feature_Blueprints/FB-001-nfc-scan-creates-work-event.md`  
Related Technical Specification: `ADO/01_Architecture/Technical_Specifications/TS-001-nfc-scan-creates-work-event.md`  
Related Architecture: `ADO/01_Architecture/Technical_Architecture_Profile.md`  
Created Date: 2026-06-30

## Purpose

This document defines the initial Development Task structure for implementing TS-001.

Development Tasks are bounded implementation units. They do not redefine product intent, Business Rules or architecture.

FDOS Rule:

> Development Tasks implement approved architecture without redefining product intent or architectural decisions.

## Task Sequence

```text
DT-001 NFC Scan Adapter
  -> DT-002 Assignment Resolver
  -> DT-003 Assignment Validator
  -> DT-004 WorkEvent Factory
  -> DT-005 TimeEntry Generator
  -> DT-006 Repository Layer
  -> DT-007 Offline Queue
  -> DT-008 Synchronization Service
  -> DT-009 Error Handling
  -> DT-010 Tests
```

## DT-001 – NFC Scan Adapter

Objective: Implement the technical adapter boundary that reads NFC payloads and exposes normalized scan data to the Application Layer.

Acceptance Criteria:

- Adapter exposes normalized NFC payloads.
- Adapter errors are explicit.
- Domain and Business Engine do not depend on NFC library APIs.

### Development Sprint 001 Implementation Notes

Status: Completed — Review Agent verified, Human Architect approved (2026-07-03).

See `ADO/02_Development/Development_Sprint_001_Plan.md` for the full plan. Summary: implemented as a port/interface plus a fake or manually-triggered test double for this sprint; no real NFC SDK or native platform NFC API integration. Objective and Acceptance Criteria above are unchanged.

Implementation: `packages/core/src/ports/NfcScanPort.ts`, `packages/core/src/infrastructure/adapters/FakeNfcScanAdapter.ts`. Tests: `packages/core/tests/infrastructure/FakeNfcScanAdapter.test.ts`.

## DT-002 – Assignment Resolver

Objective: Resolve an NfcPayload to an NfcAssignment within organization context.

Acceptance Criteria:

- Known tags resolve to assignments.
- Unknown tags return explicit rejection.
- Resolution does not create WorkEvents.

### Development Sprint 001 Implementation Notes

Status: Completed — Review Agent verified, Human Architect approved (2026-07-03).

See `ADO/02_Development/Development_Sprint_001_Plan.md`. Implemented against an in-memory/fake repository (no Firebase/Firestore) for this sprint. Objective and Acceptance Criteria above are unchanged.

Implementation: `packages/core/src/business/AssignmentResolver.ts`. Tests: `packages/core/tests/business/AssignmentResolver.test.ts`.

## DT-003 – Assignment Validator

Objective: Validate whether a resolved assignment and target may create a WorkEvent.

Acceptance Criteria:

- Inactive assignments are rejected.
- Missing targets are rejected.
- Unauthorized access is rejected.
- Valid assignments produce a validation success result.

### Development Sprint 001 Implementation Notes

Status: Completed — Review Agent verified, Human Architect approved (2026-07-03).

See `ADO/02_Development/Development_Sprint_001_Plan.md`. Implemented against an in-memory/fake repository for this sprint. The validation success result is shaped to be handed to a stubbed `WorkEventCreationPort` (interface only, no implementation) so DT-004 (WorkEvent Factory) has a defined seam. Duplicate-scan protection and start/stop toggle logic (Finding F-01, still open per `ADO/02_Development/Repository_Freeze_Sprint.md`) remain explicitly out of scope for this task. Objective and Acceptance Criteria above are unchanged.

Implementation: `packages/core/src/business/AssignmentValidator.ts`, `packages/core/src/application/NfcScanApplicationService.ts`, `packages/core/src/ports/WorkEventCreationPort.ts` (interface only). Tests: `packages/core/tests/business/AssignmentValidator.test.ts`, `packages/core/tests/application/NfcScanApplicationService.test.ts`.

## DT-004 – WorkEvent Factory

Objective: Create WorkEvent domain objects from valid scan and assignment context.

Acceptance Criteria:

- WorkEvent contains required traceability.
- Invalid inputs do not create WorkEvents.
- Factory has deterministic tests.

### Development Sprint 002 Implementation Notes

See `ADO/02_Development/Development_Sprint_002_Plan.md`. Fully in scope for Sprint 002 — none of this task's Acceptance Criteria depend on Finding F-01 (duplicate-scan/toggle mechanism). Consumes `AcceptedAssignmentValidationResult` from DT-003 (`packages/core/src/business/AssignmentValidationResult.ts`). Objective and Acceptance Criteria above are unchanged.

## DT-005 – TimeEntry Generator

Objective: Derive TimeEntry results from Business Engine decisions.

Acceptance Criteria:

- TimeEntry results derive from Business Engine decisions.
- UI does not decide start or stop.
- Tests cover start, stop and pending outcomes.

### Development Sprint 002 Implementation Notes

See `ADO/02_Development/Development_Sprint_002_Plan.md`. Partially in scope for Sprint 002: the "no active TimeEntry exists for target" branch (deterministically produces `TimeEntryStarted`) is implemented and tested this sprint. The "active TimeEntry already exists" branch (stop/duplicate/defer) depends on Finding F-01 (duplicate-scan/toggle mechanism, still open per `ADO/02_Development/Repository_Freeze_Sprint.md`) and is represented only as an explicit escalation outcome, not implemented as a business decision. This task's Acceptance Criteria ("Tests cover start, stop and pending outcomes") is therefore only partially satisfied by Sprint 002 — full satisfaction requires F-01 to be resolved first. Objective and Acceptance Criteria above are unchanged.

## DT-006 – Repository Layer

Objective: Implement repository boundaries for storing and loading WorkEvents, TimeEntries and assignment data required by TS-001.

Acceptance Criteria:

- Repositories do not contain business decisions.
- Domain objects are not replaced by persistence document shapes.
- Persistence failures are explicit.

### Development Sprint 002 Implementation Notes

See `ADO/02_Development/Development_Sprint_002_Plan.md`. Only a minimal in-memory slice is in scope for Sprint 002: persist `WorkEvent`s and answer whether an active `TimeEntry` exists for a given target, sufficient to support DT-004/DT-005. No Firestore-backed implementation and no synchronization metadata (DT-007/DT-008 remain out of scope). Objective and Acceptance Criteria above are unchanged; this sprint satisfies them only for the in-memory slice, not the full repository surface.

## DT-007 – Offline Queue

Objective: Implement offline queue behavior for unsynchronized WorkEvents and related outcomes.

Acceptance Criteria:

- Offline WorkEvents can be queued.
- Queue records preserve traceability.
- Queue failures are observable.

### Development Sprint 003 Implementation Notes

Status: Completed — Review Agent verified (one mechanical finding: a typecheck/test coverage gap for `QueuedWorkEventRecord.decision: null`, documented below as a Known Remaining Risk), Human Architect approved (2026-07-05).

See `ADO/02_Development/Development_Sprint_003_Plan.md` for the full plan. Implemented as an in-memory `OfflineQueue` port + `InMemoryOfflineQueue` adapter, consistent with the in-memory pattern used by DT-001–DT-006 (no real backend/database, deferred per ADR-0007). `WorkEventCreationService` was extended (not replaced) to enqueue every created `WorkEvent` — together with its `BusinessEngineDecision`, whichever branch produced it — as a `QueuedWorkEventRecord` with `syncState: 'pending'`, emitting `WorkEventQueuedForSync`. This applies identically to the `time_entry_started` and `escalation_required` branches; the queue does not interpret the Business Engine's decision (ADR-0005). Duplicate enqueue attempts for the same `WorkEvent` id return an explicit `{ status: 'already_queued' }` result rather than throwing. Objective and Acceptance Criteria above are unchanged.

Implementation: `packages/core/src/domain/SyncState.ts`, `QueuedWorkEventRecord.ts`, `domain/events/WorkEventQueuedForSync.ts`, `packages/core/src/ports/OfflineQueue.ts`, `packages/core/src/infrastructure/repositories/InMemoryOfflineQueue.ts`, `packages/core/src/application/WorkEventCreationService.ts` (extended). Tests: `packages/core/tests/infrastructure/InMemoryOfflineQueue.test.ts`, `packages/core/tests/application/WorkEventCreationService.test.ts` (extended), `packages/core/tests/application/NfcScanToTimeEntryPipeline.test.ts` (extended for both decision branches).

**Known Remaining Risk:** `QueuedWorkEventRecord.decision` is typed as `BusinessEngineDecision | null`, but no current code path constructs a record with `decision: null` — that state is exercised only by `InMemoryOfflineQueue.test.ts`'s own fixture, not through the wired `WorkEventCreationService`/pipeline tests. Typecheck and all tests pass today (no functional defect), but this typed state has no integration-level test coverage and should be re-checked when DT-008 adds a second writer of `QueuedWorkEventRecord`.

## DT-008 – Synchronization Service

Objective: Synchronize queued WorkEvents and related results with backend persistence.

Acceptance Criteria:

- Queued records can synchronize.
- Retryable failures preserve local state.
- Conflicts are observable.
- Successful synchronization updates SyncState.

### Development Sprint 004 Implementation Notes

See `ADO/02_Development/Development_Sprint_004_Plan.md` for the full plan. Implemented as a `SynchronizationGateway` port + `FakeSynchronizationGateway` adapter (configurable success/retryable-failure/conflict outcomes), consistent with the fake/in-memory pattern used by DT-001–DT-007 — no real backend/database technology is introduced (deferred per ADR-0006/ADR-0007). `SynchronizationService` reads pending records via `OfflineQueue.findPending()`, attempts synchronization once per record per call (no retry scheduling/backoff — out of scope), and transitions `SyncState` via a narrowly-scoped `OfflineQueue.updateSyncState()` extension: `synchronized` on success, remains `pending` (never dropped) on a retryable failure, `failed` on conflict. `WorkEventSynchronized` and `WorkEventSyncFailed` are emitted following the existing constructor-function pattern; a conflict is distinguished from a plain retryable failure via `WorkEventSyncFailed.outcome`, since TTAP-001 names only one `WorkEventSyncFailed` event, not a separate conflict event. The service never reads `QueuedWorkEventRecord.decision` for anything beyond forwarding it (ADR-0005/ADR-0006). Objective and Acceptance Criteria above are unchanged.

Implementation: `packages/core/src/application/SynchronizationResult.ts`, `SynchronizationService.ts`, `packages/core/src/domain/events/WorkEventSynchronized.ts`, `WorkEventSyncFailed.ts`, `packages/core/src/ports/SynchronizationGateway.ts`, `OfflineQueue.ts` (extended with `updateSyncState`), `packages/core/src/infrastructure/adapters/FakeSynchronizationGateway.ts`, `infrastructure/repositories/InMemoryOfflineQueue.ts` (extended). Tests: `packages/core/tests/infrastructure/FakeSynchronizationGateway.test.ts`, `InMemoryOfflineQueue.test.ts` (extended), `packages/core/tests/application/SynchronizationService.test.ts`, `NfcScanToTimeEntryPipeline.test.ts` (extended for both decision branches through to `synchronized`).

## DT-009 – Error Handling

Objective: Implement explicit error handling for scan, assignment, WorkEvent, persistence and synchronization failures.

Acceptance Criteria:

- Errors are categorized consistently with TTAP-001.
- User-facing outcomes are clear enough for implementation.
- Technical errors remain observable for evidence and debugging.

## DT-010 – Tests

Objective: Create verification coverage for the NFC Scan Creates Work Event implementation.

Acceptance Criteria:

- Tests verify normal, rejection, duplicate and offline flows.
- Tests verify Business Rules stay outside UI and persistence.
- Test evidence is attached to implementation handover.

## Dependencies

- ADR-0007 must exist.
- TTAP-001 EP-007 extension must exist.
- FB-001 must exist.
- TS-001 must exist.

## Completion Rule

This task structure is ready for Development Agent planning only after Review Agent approval of the EP-007 repository integration.
