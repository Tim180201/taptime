# Development Sprint 003 Plan – Offline Queue Foundation

Status: Planned
Role: Research / Implementation Support acting on behalf of Technical Lead (per AGR-001)
Epic: EP-007 – Product Architecture Foundation
Owner: Technical Lead
Approval Authority: Human Architect
Branch: `main`
Created Date: 2026-07-05
Related Development Task: DT-007 (existing, reused — not redefined)
Related Artifacts: `EP-007_Development_Tasks.md`, `Development_Sprint_001_Plan.md`, `Development_Sprint_002_Plan.md`, TTAP-001, TS-001, FB-001, ADR-0004, ADR-0005, ADR-0007

---

## 1. Executive Summary

Development Sprint 003 implements **DT-007 – Offline Queue**, the next unimplemented task in the already-approved `EP-007_Development_Tasks.md` sequence. It gives the existing NFC-scan-to-TimeEntry pipeline (Development Sprint 001/002) the ability to mark a created `WorkEvent` (and, where one exists, its resulting `TimeEntry` outcome) as pending synchronization, store it durably enough to survive the current process, and make queue failures observable — without implementing the Synchronization Service itself (DT-008, out of scope) and without selecting or integrating a backend persistence technology (deferred, see Section 2).

This plan does **not** recommend "Persistence Foundation" (a durable/cloud-backed rebuild of DT-006's Repository Layer) as Sprint 003. Section 2 documents why, using repository evidence rather than the default assumption that persistence hardening is automatically next.

## 2. Why Sprint 003 Is the Correct Next Sprint (Not Persistence Foundation)

Repository evidence, not assumption, was used to evaluate the candidates:

1. **The Task Sequence in `EP-007_Development_Tasks.md` already names DT-007 as the next task after DT-006**, and DT-006 was deliberately scoped in Development Sprint 002 to "only a minimal in-memory slice... sufficient to support DT-004/DT-005" (`Development_Sprint_002_Plan.md`). Sprint 002 did not claim to satisfy DT-006 in full, but it did make DT-006's Acceptance Criteria ("Repositories do not contain business decisions", "Domain objects are not replaced by persistence document shapes") true for the current pipeline. There is no repository evidence that this in-memory slice is currently a blocker for anything the product needs next.

2. **ADR-0007 has not finalized a persistence technology.** Its Decision section states the backend baseline is "cloud-hosted operational persistence" in the abstract and explicitly says "the exact implementation libraries and service configuration may be refined during Technical Specification and Development Tasks." No Firestore (or other) client library exists in `packages/core/package.json` or anywhere in the repository (verified: only `typescript`, `vitest`, `@types/node` are dependencies). Committing to a durable backend now would require making a platform/vendor decision that is explicitly deferred — this is a scope risk, not a ready engineering task.

3. **ADR-0004 (Offline-first Core Events) contains an explicit Implementation Rule that would be violated by building backend persistence next**: "The Development Agent must not implement core time tracking as a direct online-only database write. The architecture must include a local event queue or equivalent offline-capable mechanism before production release." Building a cloud-backed `WorkEventRepository`/`TimeEntryRepository` before an offline queue exists in front of it would create exactly the online-only-write shape ADR-0004 forbids, and would likely require rework once the queue is inserted afterward — violating "Continue, Never Recreate."

4. **TTAP-001's Runtime Architecture flow and TS-001's Architecture Flow both place `OfflineQueue` immediately after the repository layer and before `SynchronizationService`** (`WorkEventRepository -> OfflineQueue -> SynchronizationService`). The repository already has a `WorkEventRepository`/`TimeEntryRepository` seam (DT-006 slice); the next unimplemented seam in the documented flow is the Offline Queue, not a rebuild of the repository seam that already exists.

5. **Three of TTAP-001's eleven Domain Events are entirely unimplemented**: `WorkEventQueuedForSync`, `WorkEventSynchronized`, `WorkEventSyncFailed`. The `SyncState` Value Object listed in TTAP-001 also does not exist anywhere in `packages/core/src/` (verified by direct search). DT-007 is what turns these from architecture-profile entries into working code. Backend persistence hardening would not touch any of these.

6. **DT-007 requires no new Human Architect decision.** Unlike Finding F-01 (duplicate-scan/toggle rule, still open, gates the rest of DT-005), DT-007's Acceptance Criteria ("Offline WorkEvents can be queued", "Queue records preserve traceability", "Queue failures are observable") can be fully implemented today from existing repository evidence, using the existing in-memory pattern established in DT-001–DT-006, exactly like every prior sprint in this repository.

Conclusion: Sprint 003 = DT-007 Offline Queue Foundation, built as an in-memory/fake implementation consistent with the rest of the current stack, deliberately not yet backed by a real database or real network synchronization.

## 3. Repository Evidence

- `ADO/02_Development/EP-007_Development_Tasks.md`: DT-001–DT-003 Completed (Review Agent verified, Human Architect approved); DT-004 (full) and DT-005 (deterministic branch only) and DT-006 (in-memory slice) implemented and committed to `main` (commit `78be5c9`), no review/approval status recorded yet for Sprint 002; DT-007–DT-010 have no implementation notes.
- `packages/core/src/` (direct inspection, commit `78be5c9`): no `OfflineQueue` port, no `SyncState` type, no `WorkEventQueuedForSync`/`WorkEventSynchronized`/`WorkEventSyncFailed` events exist.
- `packages/core/package.json` / root `package.json`: no persistence or backend client library present; `apps/` contains only a `.gitkeep` (no mobile app started).
- `ADO/01_Architecture/Technical_Architecture_Profile.md`: Runtime Architecture flow, Domain Events list, Value Objects list (Sections "Runtime Architecture", "Domain Architecture").
- `ADO/01_Architecture/Technical_Specifications/TS-001-...md`: Architecture Flow and Component Responsibilities table naming `OfflineQueue` as a distinct component from `WorkEventRepository` and `SynchronizationService`.
- `ADO/01_Architecture/Feature_Blueprints/FB-001-...md`: Business Rules "Offline operation shall preserve the WorkEvent locally" and "Synchronization failure shall not delete local work event evidence"; Acceptance Criteria "Offline operation can preserve the WorkEvent locally."
- `ADO/01_Architecture/ADR/ADR-0004-offline-first-core-events.md`: Implementation Rule requiring a local event queue before production release.
- `ADO/01_Architecture/ADR/ADR-0007-technology-platform-baseline.md`: persistence technology explicitly deferred; "Do not use persistence document shapes as the domain model," "Do not hide synchronization failures from the event flow."
- `ADO/00_Core/Decision_Log.md`: currently still reads "DT-004/DT-005 remain gated on Finding F-01" and "READY FOR DEVELOPMENT SPRINT 002" — stale relative to repository reality (Sprint 002 is committed and EP-008 is synchronized). Flagged again here as an open finding (first raised in the EP-008 Synchronization Update); not corrected by this plan, since Decision Log maintenance was not part of the assigned scope for this task.

## 4. Business Objective

Preserve every work event created by an employee's NFC scan even when the device cannot reach the backend at the moment of the scan, so that "One Tap. One Decision." (Product Vision, Product Principle 1) and "Offline by Default" (Product Principle 4) hold true in practice, not only as an architectural aspiration. No employee-visible work time may be lost because of a connectivity gap.

## 5. Technical Objective

Implement DT-007 (Offline Queue) as defined in `EP-007_Development_Tasks.md`: give the pipeline a queue seam that accepts a created `WorkEvent` (and, if produced, its `BusinessEngineDecision` outcome) as a record pending synchronization, stores it so it survives beyond the single method call that created it, exposes the pending records for a later Synchronization Service (DT-008, not built in this sprint) to consume, and makes queue-level failures (e.g. attempting to enqueue invalid or duplicate records) observable rather than silent.

## 6. Scope

- A `SyncState` value object (`pending`, `synchronized`, `failed`), matching TTAP-001's Value Objects list.
- An `OfflineQueue` port (interface) plus an in-memory implementation, consistent with every other port/adapter pair built in Sprint 001/002.
- A `QueuedWorkEventRecord` (or equivalently named) domain/application-level record type that pairs a `WorkEvent` with its current `SyncState` and, when available, its `BusinessEngineDecision` outcome — added without replacing or duplicating the existing `WorkEvent`/`TimeEntry`/`BusinessEngineDecision` types (Extend before Create).
- The `WorkEventQueuedForSync` domain event, emitted when a record enters the queue.
- Wiring `WorkEventCreationService` (or an equivalent thin orchestration addition) so that after a `WorkEvent` (and any resulting `TimeEntry` decision) is produced, it is also enqueued for synchronization — as an additional, explicit step, not a replacement of DT-004/DT-005/DT-006 behavior.
- Explicit, typed failure results when enqueueing cannot proceed (e.g. record already queued), instead of throwing an unstructured exception.
- Unit and integration tests covering: successful enqueue, an already-queued record, and querying pending records — extending the existing `NfcScanToTimeEntryPipeline.test.ts`-style end-to-end test to include the queue.

## 7. Out of Scope

- DT-008 Synchronization Service (retry logic, remote confirmation, conflict detection) — explicitly the next sprint after this one, not this one.
- Any real backend/database technology (Firestore or otherwise) — deferred per ADR-0007 and Section 2 above.
- `WorkEventSynchronized` / `WorkEventSyncFailed` events — these describe the outcome of synchronization (DT-008), not of queuing (DT-007), and are out of scope here.
- Resolution of Finding F-01 (duplicate-scan/toggle mechanism) — unrelated to this sprint; queuing applies regardless of which `BusinessEngineDecision` branch produced the record, including the `escalation_required` branch.
- Mobile/UI work (`apps/`) — no mobile app exists yet; this sprint remains inside `packages/core`.
- Any change to DT-001–DT-006 Acceptance Criteria, FB-001, TS-001, TTAP-001, ADRs or EP-008 — this plan implements existing architecture, it does not revise it.

## 8. Dependencies

- DT-004 (`WorkEventFactory`), DT-005 (`BusinessEngine`, deterministic branch), DT-006 (`InMemoryWorkEventRepository`, `InMemoryTimeEntryRepository`) — all implemented and committed (`78be5c9`); this sprint extends their output.
- TTAP-001 Domain Architecture (Value Objects: `SyncState`; Domain Events: `WorkEventQueuedForSync`) and Runtime Architecture (`WorkEventRepository -> OfflineQueue -> SynchronizationService`).
- ADR-0004 (Offline-first Core Events) — governs this sprint's implementation rule.
- ADR-0005 (Event-driven Business Engine) — the queue must not make or alter business decisions.
- No dependency on Finding F-01 resolution (see Section 7).

## 9. Existing Components (Reused, Not Recreated)

| Component | File | Reused As |
|---|---|---|
| `WorkEvent` | `packages/core/src/domain/WorkEvent.ts` | Input to the queue record; unchanged. |
| `BusinessEngineDecision` | `packages/core/src/business/BusinessEngineDecision.ts` | Optional companion data on the queue record; unchanged. |
| `WorkEventCreationService` | `packages/core/src/application/WorkEventCreationService.ts` | Extended with an additional enqueue step after existing persistence/event steps; existing behavior unchanged. |
| `WorkEventRepository` / `TimeEntryRepository` ports | `packages/core/src/ports/` | Unchanged; queue is an additional seam, not a replacement. |
| Domain event pattern (`workEventCreated`, `timeEntryStarted`) | `packages/core/src/domain/events/` | Followed exactly for the new `workEventQueuedForSync` constructor. |

## 10. Components to Implement

| Component | Type | Location (proposed, following existing structure) |
|---|---|---|
| `SyncState` | Domain value object | `packages/core/src/domain/SyncState.ts` |
| `QueuedWorkEventRecord` | Domain/application record type | `packages/core/src/domain/QueuedWorkEventRecord.ts` |
| `WorkEventQueuedForSync` | Domain event | `packages/core/src/domain/events/WorkEventQueuedForSync.ts` |
| `OfflineQueue` | Port (interface) | `packages/core/src/ports/OfflineQueue.ts` |
| `InMemoryOfflineQueue` | Infrastructure adapter | `packages/core/src/infrastructure/repositories/InMemoryOfflineQueue.ts` |
| Enqueue wiring | Application extension | `packages/core/src/application/WorkEventCreationService.ts` (extended, not replaced) |

## 11. Required Development Tasks

Per DTP-001 and the explicit instruction to reuse existing Development Tasks wherever repository evidence allows: **DT-007 – Offline Queue**, already defined in `EP-007_Development_Tasks.md` with Objective "Implement offline queue behavior for unsynchronized WorkEvents and related outcomes" and Acceptance Criteria "Offline WorkEvents can be queued," "Queue records preserve traceability," "Queue failures are observable," is reused as-is. Its Objective and Acceptance Criteria are not redefined by this plan.

No new Development Task ID is created. Repository evidence (Section 3) shows DT-007 already fully covers the scope in Section 6; nothing in this sprint falls outside DT-007's existing definition.

## 12. Testing Strategy

Following the pattern established in Development Sprint 001/002 (Section 7.6/7.7 of EP-008 Chapter 01/03):

- `OfflineQueue`/`InMemoryOfflineQueue` are tested at the infrastructure boundary: enqueue, duplicate-enqueue behavior, and retrieval of pending records — no business interpretation.
- Application-level wiring is tested by extending `WorkEventCreationService.test.ts` to assert that a `WorkEventQueuedForSync` event is emitted after a `WorkEvent` is created, regardless of which `BusinessEngineDecision` branch was produced.
- The end-to-end pipeline test (`NfcScanToTimeEntryPipeline.test.ts`) is extended with an assertion that a queued record exists for both the "started" and the "escalation_required" cases, confirming the queue does not depend on or alter the Business Engine's decision.
- No tests will assert anything about synchronization success, retry or remote conflict — those belong to DT-008's future test suite.

## 13. Risks

| Risk | Mitigation |
|---|---|
| Scope creep into Synchronization Service (DT-008) | Enforce Section 7 Out of Scope; the queue only stores and marks state, it does not attempt to synchronize. |
| Introducing a queue record type that duplicates `WorkEvent`/`TimeEntry` | `QueuedWorkEventRecord` wraps existing types by reference; it must not redefine their fields (Extend before Create, EP-008 Ch01 §5.4). |
| Silent failure on duplicate enqueue | Acceptance Criterion "Queue failures are observable" requires an explicit, typed result, not a thrown/swallowed exception, consistent with the `escalation_required` pattern from DT-005. |
| Premature technology commitment | No real persistence/database library is introduced in this sprint (Section 2, Section 7). |
| Confusing "queued" with "synchronized" | Only `WorkEventQueuedForSync` is emitted this sprint; `WorkEventSynchronized`/`WorkEventSyncFailed` remain unimplemented until DT-008. |

## 14. Definition of Done

- `SyncState`, `QueuedWorkEventRecord`, `WorkEventQueuedForSync`, `OfflineQueue` port and `InMemoryOfflineQueue` implemented per Section 10.
- `WorkEventCreationService` extended to enqueue every created `WorkEvent` regardless of `BusinessEngineDecision` branch.
- All new components have deterministic unit tests; the end-to-end pipeline test is extended per Section 12.
- `npm run typecheck` and `npm run test` pass across the monorepo.
- DT-007's existing Acceptance Criteria in `EP-007_Development_Tasks.md` are met and a "Development Sprint 003 Implementation Notes" subsection is added under DT-007 documenting what was implemented, mirroring the format used for DT-001–DT-006.
- No change is made to DT-001–DT-006 Acceptance Criteria, FB-001, TS-001, TTAP-001, any ADR, or EP-008.
- Review Agent verification and Human Architect approval are recorded before DT-007 is marked Completed (per DTP-001's Completion Rule: "Implementation alone never completes a Development Task").

## 15. Recommended Implementation Order

1. `SyncState` value object.
2. `QueuedWorkEventRecord` type.
3. `WorkEventQueuedForSync` domain event (following the existing `workEventCreated`/`timeEntryStarted` constructor pattern).
4. `OfflineQueue` port.
5. `InMemoryOfflineQueue` adapter, with its own unit tests (enqueue, duplicate detection, retrieval).
6. Wire `WorkEventCreationService` to enqueue after existing persistence/event steps; extend its unit tests.
7. Extend `NfcScanToTimeEntryPipeline.test.ts` for both decision branches.
8. Run `npm run typecheck` and `npm run test` for the whole monorepo.
9. Update `EP-007_Development_Tasks.md` DT-007 with a "Development Sprint 003 Implementation Notes" subsection (implementation summary and file references only — Objective/Acceptance Criteria unchanged).
10. Produce implementation evidence and role handover; request Review Agent verification.

---

## 16. Development Agent Prompt

The following prompt is written to be given directly to Claude Code (Development Agent) to execute Development Sprint 003. It is self-contained and does not require this planning document to be re-explained.

```text
You are the Development Agent for TapTim.e, implementing Development Sprint 003 (DT-007 – Offline Queue) inside the existing `packages/core` TypeScript package, on branch `main`.

CONTEXT (verify before writing code):
- Read `ADO/02_Development/Development_Sprint_003_Plan.md` in full — it is the authoritative scope for this task.
- Read `ADO/02_Development/EP-007_Development_Tasks.md`, DT-007 section, for the unchanged Objective and Acceptance Criteria you must satisfy.
- Read the current implementation: `packages/core/src/domain/WorkEvent.ts`, `TimeEntry.ts`, `packages/core/src/business/BusinessEngineDecision.ts`, `packages/core/src/application/WorkEventCreationService.ts`, and the existing domain event pattern in `packages/core/src/domain/events/WorkEventCreated.ts` and `TimeEntryStarted.ts`.
- Do not read this as permission to change DT-001–DT-006 behavior. You are extending, not replacing.

IMPLEMENTATION SCOPE (do exactly this, nothing more):
1. Add `packages/core/src/domain/SyncState.ts` — a `SyncState` type with at least `'pending' | 'synchronized' | 'failed'` states.
2. Add `packages/core/src/domain/QueuedWorkEventRecord.ts` — a record type referencing an existing `WorkEvent` and, optionally, a `BusinessEngineDecision`, plus a `SyncState`. Do not duplicate `WorkEvent`/`TimeEntry`/`BusinessEngineDecision` fields; reference the existing types.
3. Add `packages/core/src/domain/events/WorkEventQueuedForSync.ts` following the exact constructor-function pattern used in `WorkEventCreated.ts` and `TimeEntryStarted.ts`.
4. Add `packages/core/src/ports/OfflineQueue.ts` — an interface with at minimum: enqueue a `QueuedWorkEventRecord` (returning an explicit success/already-queued result, not throwing for the expected duplicate case), and retrieve pending records.
5. Add `packages/core/src/infrastructure/repositories/InMemoryOfflineQueue.ts` implementing `OfflineQueue`, following the style of `InMemoryWorkEventRepository.ts`/`InMemoryTimeEntryRepository.ts`.
6. Extend `packages/core/src/application/WorkEventCreationService.ts` so that after its existing DT-004/DT-005/DT-006 behavior (unchanged), it also enqueues the created `WorkEvent` (with its `BusinessEngineDecision`, whichever branch it was) into the `OfflineQueue`, and emits `WorkEventQueuedForSync`. This applies identically whether the decision was `time_entry_started` or `escalation_required` — the queue does not interpret the decision, it only records it.
7. Export all new public types/classes from `packages/core/src/index.ts`, following the existing export list order and style.

ARCHITECTURE BOUNDARIES (do not violate):
- The `OfflineQueue`/`InMemoryOfflineQueue` must not make business decisions and must not depend on the NFC library, UI, or a real database/network client. No persistence or backend library may be added to `package.json` in this sprint.
- `WorkEventCreationService` must remain an orchestrator: it calls the queue, it does not decide sync state itself beyond marking a newly enqueued record `pending`.
- Do not implement `WorkEventSynchronized` or `WorkEventSyncFailed` events, retry logic, or any network/backend call — that is DT-008, out of scope.
- Do not touch `FB-001`, `TS-001`, `TTAP-001`, any ADR, or `EP-008` — this is an implementation task, not an architecture task.
- Do not attempt to resolve Finding F-01 (duplicate-scan/toggle mechanism) — irrelevant to this task; queue every `WorkEvent` regardless of which `BusinessEngineDecision` branch produced it.
- Follow the existing constructor-injection pattern (explicit ID/clock/state functions with real defaults) used in `WorkEventFactory`/`BusinessEngine` if the new components need IDs or timestamps, so tests remain deterministic.

TESTING REQUIREMENTS:
- Unit tests for `InMemoryOfflineQueue`: enqueue, duplicate enqueue (must return an explicit "already queued" result, not throw), and retrieval of pending records only.
- Unit tests for the `WorkEventCreationService` extension: assert a `WorkEventQueuedForSync` event is emitted for both the `time_entry_started` and the `escalation_required` decision branches.
- Extend `packages/core/tests/application/NfcScanToTimeEntryPipeline.test.ts` (or add a sibling test) to assert an equivalent record exists in the queue after a full pipeline run, for both branches.
- Run `npm run typecheck` and `npm run test` at the repository root; both must pass before you consider the task done.

EXPECTED DELIVERABLES:
- All files listed under Implementation Scope, committed with a clear commit message referencing DT-007 and Development Sprint 003.
- A "Development Sprint 003 Implementation Notes" subsection added under DT-007 in `ADO/02_Development/EP-007_Development_Tasks.md`, in the same format as the existing DT-001–DT-006 notes (implementation summary and file references; do not alter DT-007's Objective or Acceptance Criteria).
- A short implementation summary (changed files, test results, known deviations) suitable for Review Agent evaluation.

STOP CONDITION:
Stop after completing the Implementation Scope, tests, and the DT-007 implementation notes update. Do not begin DT-008 (Synchronization Service). Do not mark DT-007 "Completed" yourself — that status requires Review Agent verification and Human Architect approval, per DTP-001's Completion Rule ("Implementation alone never completes a Development Task"). Wait for review.
```

---

## 17. Role Handover

Implemented scope in this task: Development Sprint 003 planning only — this document and the embedded Development Agent Prompt. No source code was written or modified. No architecture, ADR, TTAP-001, FB-001, TS-001 or EP-008 content was changed.

Changed artifacts: `ADO/02_Development/Development_Sprint_003_Plan.md` (new, this file). No other file was modified.

Related ADO artifacts consulted: Product Vision, Product Principles, Decision Log, AVR-001, ADR-0004, ADR-0005, ADR-0007, TTAP-001, Domain Model, FB-001, TS-001, Development Task Profile (DTP-001), `EP-007_Development_Tasks.md`, `Development_Sprint_001_Plan.md`, `Development_Sprint_002_Plan.md`, current `packages/core/src`/`packages/core/tests` source tree, EP-008 Chapters 00–03 (as synchronized).

Tests performed: none (planning-only task; no code changed).

Known deviations: none from the assigned task scope.

Open findings carried forward (not resolved by this task): (1) `ADO/00_Core/Decision_Log.md` still shows `DEV-SPRINT-002` as "Planned" and its Repository Status narrative is stale relative to actual repository state (first raised during the EP-008 Synchronization Update, still unaddressed); (2) Development Sprint 002 (DT-004 full/DT-005 partial/DT-006 slice) still has no recorded Review Agent verification or Human Architect approval; (3) Finding F-01 (duplicate-scan/toggle mechanism) remains open and continues to gate the remainder of DT-005, independent of this sprint.

Evidence produced: this plan document, including the repository-evidence-based justification for recommending Offline Queue Foundation (DT-007) over Persistence Foundation.

Next responsible role: Technical Lead / Human Architect review and approval of this Sprint 003 Plan. Per the assigned stop condition, implementation does not begin until that approval is given.

## 18. Stop Condition

Per task instruction: this task stops after producing the Development Sprint 003 Plan, the Development Agent Prompt and the Role Handover above. No code was implemented. No architecture, ADRs, TTAP-001 or EP-008 were modified. Awaiting Technical Lead / Human Architect approval before implementation begins.
