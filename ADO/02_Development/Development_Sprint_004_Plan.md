# Development Sprint 004 Plan – Synchronization Service Foundation

Status: Planned
Role: Research / Implementation Support acting on behalf of Technical Lead (per AGR-001)
Epic: EP-007 – Product Architecture Foundation
Owner: Technical Lead
Approval Authority: Human Architect
Branch: `main`
Created Date: 2026-07-05
Related Development Task: DT-008 (existing, reused — not redefined)
Related Artifacts: `EP-007_Development_Tasks.md`, `Development_Sprint_001_Plan.md`, `Development_Sprint_002_Plan.md`, `Development_Sprint_003_Plan.md`, `Development_Sprint_003_Closure.md`, TTAP-001, TS-001, FB-001, ADR-0004, ADR-0005, ADR-0006, ADR-0007

---

## 1. Executive Summary

Development Sprint 004 implements **DT-008 – Synchronization Service**, the next unimplemented task in the approved `EP-007_Development_Tasks.md` sequence, immediately following Development Sprint 003's Offline Queue (DT-007, now Completed). It gives the pipeline the ability to take `pending` records out of the `OfflineQueue` and drive them through synchronization outcomes (`synchronized`, `failed`/retryable) against a **fake, in-process synchronization target** — not a real backend — continuing the exact methodology used for every prior sprint (DT-001 fake NFC adapter, DT-002/003 in-memory repositories, DT-006 in-memory repositories, DT-007 in-memory queue).

## 2. Why Sprint 004 Is the Correct Next Sprint (Not Persistence Integration)

1. **DT-008 is the next task in the already-approved sequence** in `EP-007_Development_Tasks.md` (`DT-006 -> DT-007 -> DT-008 -> DT-009 -> DT-010`), and TS-001's Architecture Flow places `SynchronizationService` immediately after `OfflineQueue`, which Sprint 003 just completed. There is no repository evidence that skipping ahead to hardening DT-006's persistence is more urgent than finishing the flow TS-001 already documents in order.

2. **ADR-0007 still has not selected a persistence/backend technology.** Verified again this session: no database or backend client library exists in `packages/core/package.json` or the root `package.json` (only `typescript`, `vitest`, `@types/node`); `apps/` still contains only `.gitkeep`. ADR-0007 explicitly leaves "the exact implementation libraries and service configuration" to be "refined during Technical Specification and Development Tasks" — that refinement has not happened. Committing to Persistence Integration now would require making an undeferred technology choice, which is a decision, not an engineering task ready for a Development Sprint.

3. **DT-008's own Acceptance Criteria ("Queued records can synchronize," "Retryable failures preserve local state," "Conflicts are observable," "Successful synchronization updates SyncState") do not require a real backend to implement or test.** They describe *behavioral* guarantees — retry-preserves-state, conflicts-are-observable, state-transitions-are-correct — which are best proven with a deterministic, fake synchronization target (the same reasoning FB-001/TS-001 already apply to `FakeNfcScanAdapter` for hardware, and Sprint 003 applied to `InMemoryOfflineQueue` for storage). Building this now, against a fake gateway, produces the same testable guarantees a real backend integration would later need to satisfy, without the risk of coupling business/application code to an unfinalized technology.

4. **ADR-0006 (Domain-first Architecture)** explicitly instructs that "Firestore, or any other persistence technology, is infrastructure" and that domain/business code "must not treat Firestore collections or document shapes as the domain model." Implementing DT-008 against a fake gateway first, and only later substituting a real backend adapter behind the same port, is the direct application of this rule — the reverse order (pick a backend first, then retrofit synchronization logic around it) risks exactly the coupling ADR-0006 warns against.

5. **DT-008 requires no new Human Architect decision.** Unlike Finding F-01 (still open, blocks only the "stop"/"pending" branches of DT-005), DT-008's Acceptance Criteria can be fully implemented today from existing repository evidence (the `OfflineQueue`/`QueuedWorkEventRecord`/`SyncState` types Sprint 003 already built), using the same in-memory/fake pattern as every completed sprint so far.

6. **Sequencing risk if Persistence Integration were done first:** DT-006 is currently an in-memory slice with no failure modes (Acceptance Criterion "Persistence failures are explicit" is not yet meaningfully testable, because in-memory storage cannot fail). Hardening DT-006 into a real backend before DT-008 exists would mean building synchronization/retry/conflict logic against a real, possibly-flaky external system from the start, with no fake baseline to validate the state-machine logic against first — a materially higher-risk order than building the state machine against a fake gateway now and hardening the storage layer afterward.

Conclusion: Sprint 004 = DT-008 Synchronization Service Foundation, built against a fake/in-memory synchronization gateway, deliberately not yet backed by a real network or database. "Persistence Integration" (a durable/backend-integrated DT-006) remains a valid future sprint, but only after a Human Architect/Technical Lead decision finalizes the backend technology deferred by ADR-0007 — that decision is not engineering work a Development Sprint can make on its own.

## 3. Repository Evidence

- `ADO/02_Development/EP-007_Development_Tasks.md`: DT-001–DT-003 Completed (Review Agent verified, Human Architect approved); DT-004 (full)/DT-005 (deterministic branch)/DT-006 (in-memory slice) implemented, committed (`78be5c9`), not yet reviewed/approved; DT-007 now Completed (Review Agent verified — one mechanical finding, corrected; Human Architect approved, `03c04bd`/`90fdea8`); DT-008–DT-010 have no implementation notes.
- `ADO/00_Core/Decision_Log.md`: `DEV-SPRINT-003` row added this session (Completed); Repository Status narrative now reads "READY FOR DEVELOPMENT SPRINT 004 PLANNING."
- `packages/core/src/` (direct inspection): `OfflineQueue` port and `InMemoryOfflineQueue` adapter exist and expose `findPending()`; no synchronization/remote-gateway port or adapter exists yet; no `WorkEventSynchronized`/`WorkEventSyncFailed` events exist yet, though both are named in TTAP-001's Domain Events list.
- `packages/core/package.json` / root `package.json`: no persistence or network client library present; `apps/` contains only `.gitkeep`.
- `ADO/01_Architecture/Technical_Architecture_Profile.md`: Runtime Architecture flow (`... -> Offline Queue -> Synchronization Layer -> ...`), Domain Events (`WorkEventQueuedForSync` now implemented; `WorkEventSynchronized`, `WorkEventSyncFailed` still not), Synchronization Layer responsibility ("controlled data exchange... explicit, observable and conflict-aware").
- `ADO/01_Architecture/Technical_Specifications/TS-001-...md`: `SynchronizationService` component responsibility ("Synchronize local records with backend persistence"); Synchronization Requirements (pending queue, retryable failures, duplicate-safe sync, conflict detection, remote confirmation, local preservation until success or conflict handling).
- `ADO/01_Architecture/Feature_Blueprints/FB-001-...md`: Business Rule "Synchronization failure shall not delete local work event evidence"; Edge Case "Synchronization conflict after offline capture."
- `ADO/01_Architecture/ADR/ADR-0004-offline-first-core-events.md`: Offline-first scope explicitly includes "synchronization queue" and "conflict detection."
- `ADO/01_Architecture/ADR/ADR-0006-domain-first-architecture.md`: persistence/backend technology is infrastructure, must not shape domain/business code.
- `ADO/01_Architecture/ADR/ADR-0007-technology-platform-baseline.md`: backend technology still explicitly deferred; "Do not hide synchronization failures from the event flow."

## 4. Business Objective

Ensure that a WorkEvent captured while offline is not just locally preserved (Sprint 003) but actually reaches a reliable "confirmed" or "needs attention" state the employee and organization can trust, so that "Everything is Auditable" (Product Principle 5) and "Offline by Default" (Product Principle 4) hold together — offline capture is only half of the promise; the other half is that captured work is eventually and observably reconciled.

## 5. Technical Objective

Implement DT-008 (Synchronization Service) as defined in `EP-007_Development_Tasks.md`: consume `pending` records from the `OfflineQueue` (DT-007), attempt synchronization against a fake/in-process synchronization gateway, and update each record's `SyncState` to `synchronized` or `failed` based on an explicit, typed synchronization outcome — including a distinct, observable conflict outcome — without ever making a business decision about the underlying `BusinessEngineDecision` payload.

## 6. Scope

- A `SynchronizationGateway` port (interface) representing "the remote system," with a fake/in-memory implementation whose behavior (success, retryable failure, conflict) is configurable for deterministic tests — mirroring `FakeNfcScanAdapter`'s role for hardware.
- A `SynchronizationResult` type covering at least: `synchronized`, `retryable_failure`, `conflict` — modeled as an explicit, typed result (never a thrown exception for expected outcomes), consistent with `BusinessEngineDecision`/`EnqueueResult`'s established pattern.
- A `SynchronizationService` (or `SynchronizationApplicationService`) that reads pending records via `OfflineQueue.findPending()`, calls the `SynchronizationGateway` for each, and updates the record's `SyncState` accordingly (`synchronized` on success; remains `pending` — not silently dropped — on retryable failure; a distinct, observable state or event for `conflict`).
- `WorkEventSynchronized` and `WorkEventSyncFailed` domain events (both already named in TTAP-001), emitted following the exact same constructor-function pattern as `WorkEventQueuedForSync`.
- Extending `OfflineQueue` (or adding a narrowly-scoped companion method) only as far as needed to let the Synchronization Service update a record's `SyncState` in place — without turning the queue into something that interprets business meaning (EP-008 Ch01 §10.4/Ch03 §10.13).
- Unit and integration tests covering: successful synchronization, retryable failure (record stays `pending`, is not lost), and conflict (observable, distinct from a plain failure).

## 7. Out of Scope

- Any real backend/database/network technology — deferred per ADR-0006/ADR-0007 and Section 2 above; the "remote" side is a fake/in-process gateway only.
- Automatic retry scheduling/backoff timers — this sprint proves the state transitions and observability of a single synchronization attempt per record; scheduling policy is a later concern once a real backend exists to schedule against.
- DT-009 Error Handling (repository-wide error categorization) — DT-008 only needs to classify its own synchronization outcomes, not build the general error-handling framework.
- DT-010 Tests (dedicated cross-cutting test task) — DT-008 carries its own tests per Section 12, but does not attempt the broader DT-010 scope.
- Resolution of Finding F-01 — unrelated; synchronization applies uniformly to a `QueuedWorkEventRecord` regardless of which `BusinessEngineDecision` branch produced it, exactly as DT-007 already established.
- Mobile/UI work (`apps/`) — remains inside `packages/core`.
- Any change to DT-001–DT-007 Acceptance Criteria, FB-001, TS-001, TTAP-001, ADRs or EP-008 — this plan implements existing architecture, it does not revise it.

## 8. Dependencies

- DT-007 (`OfflineQueue`, `InMemoryOfflineQueue`, `QueuedWorkEventRecord`, `SyncState`) — Completed (`03c04bd`/`90fdea8`); this sprint consumes its output.
- TTAP-001 Domain Events `WorkEventSynchronized`/`WorkEventSyncFailed` (named, not yet implemented) and Runtime Architecture's Synchronization Layer responsibility.
- TS-001 Synchronization Requirements section.
- ADR-0004 (offline-first: synchronization/conflict handling in scope), ADR-0006 (domain-first: no backend coupling), ADR-0007 (backend technology still deferred — this sprint must not force that decision).
- No dependency on Finding F-01 resolution (see Section 7).

## 9. Existing Components (Reused, Not Recreated)

| Component | File | Reused As |
|---|---|---|
| `OfflineQueue` / `InMemoryOfflineQueue` | `packages/core/src/ports/OfflineQueue.ts`, `infrastructure/repositories/InMemoryOfflineQueue.ts` | Source of pending records; `findPending()` read unchanged; only a state-update path is added. |
| `QueuedWorkEventRecord` | `packages/core/src/domain/QueuedWorkEventRecord.ts` | Unchanged shape; its `syncState` field is what this sprint transitions. |
| `SyncState` | `packages/core/src/domain/SyncState.ts` | Already defines `'pending' \| 'synchronized' \| 'failed'`; this sprint is the first to produce `'synchronized'`/`'failed'`. |
| Domain event pattern (`workEventQueuedForSync`, `workEventCreated`, `timeEntryStarted`) | `packages/core/src/domain/events/` | Followed exactly for `workEventSynchronized`/`workEventSyncFailed` constructors. |
| Explicit-result pattern (`EnqueueResult`, `BusinessEngineDecision`) | `packages/core/src/ports/OfflineQueue.ts`, `business/BusinessEngineDecision.ts` | Followed for `SynchronizationResult` (typed outcomes, not thrown exceptions). |

## 10. Components to Implement

| Component | Type | Location (proposed, following existing structure) |
|---|---|---|
| `SynchronizationGateway` | Port (interface) | `packages/core/src/ports/SynchronizationGateway.ts` |
| `FakeSynchronizationGateway` | Infrastructure adapter (test/dev double) | `packages/core/src/infrastructure/adapters/FakeSynchronizationGateway.ts` |
| `SynchronizationResult` | Application/business result type | `packages/core/src/application/SynchronizationResult.ts` (or alongside the service) |
| `SynchronizationService` | Application service | `packages/core/src/application/SynchronizationService.ts` |
| `WorkEventSynchronized` | Domain event | `packages/core/src/domain/events/WorkEventSynchronized.ts` |
| `WorkEventSyncFailed` | Domain event | `packages/core/src/domain/events/WorkEventSyncFailed.ts` |
| `OfflineQueue` state-update method | Port extension | `packages/core/src/ports/OfflineQueue.ts` (extended, not replaced) |

## 11. Development Task Mapping

Per DTP-001 and the explicit instruction to reuse existing Development Tasks wherever repository evidence allows: **DT-008 – Synchronization Service**, already defined in `EP-007_Development_Tasks.md` with Objective "Synchronize queued WorkEvents and related results with backend persistence" and Acceptance Criteria "Queued records can synchronize," "Retryable failures preserve local state," "Conflicts are observable," "Successful synchronization updates SyncState," is reused as-is. Its Objective and Acceptance Criteria are not redefined; this sprint satisfies them against a fake gateway, the same way DT-006 satisfied its own criteria against in-memory storage rather than a real database. No new Development Task ID is created — repository evidence (Section 3) shows DT-008 already fully covers the scope in Section 6.

## 12. Testing Strategy

- `FakeSynchronizationGateway` tests (infrastructure boundary): configurable success/retryable-failure/conflict responses, no business interpretation.
- `SynchronizationService` unit tests: a `pending` record becomes `synchronized` on gateway success and emits `WorkEventSynchronized`; a record stays `pending` (not lost, not marked `failed` permanently) on a retryable failure and emits `WorkEventSyncFailed` with a retryable reason; a conflict produces a distinct, observable outcome rather than being indistinguishable from a plain failure.
- Integration test extending the existing pipeline tests (`NfcScanToTimeEntryPipeline.test.ts`-style): a full scan produces a queued record, then a synchronization pass transitions it to `synchronized`, proving the seam end-to-end for both the `time_entry_started` and `escalation_required` decision branches (mirroring DT-007's own dual-branch tests).
- No test will assert anything about a real network or database — the gateway remains fake throughout this sprint.

## 13. Risks

| Risk | Mitigation |
|---|---|
| Scope creep into real backend integration | Enforce Section 7 Out of Scope; `SynchronizationGateway` has exactly one implementation this sprint, and it is fake. |
| Confusing "retryable failure" with "conflict" | `SynchronizationResult` must model them as distinct outcomes (Acceptance Criterion "Conflicts are observable" is separate from "Retryable failures preserve local state"). |
| Losing a record on failure | A retryable failure must leave the record's `SyncState` as `pending` (or an equivalent still-visible-to-retry state), never silently remove it from the queue. |
| Queue/service coupling to business meaning | `SynchronizationService` must not read `QueuedWorkEventRecord.decision` for any purpose other than passing it along; it decides sync outcomes, never business outcomes (EP-008 Ch01 §10.4 precedent). |
| Premature retry/backoff policy design | Explicitly out of scope (Section 7); a single attempt per record this sprint is sufficient to prove the state machine. |

## 14. Definition of Done

- `SynchronizationGateway` port, `FakeSynchronizationGateway` adapter, `SynchronizationResult` type, `SynchronizationService`, `WorkEventSynchronized` and `WorkEventSyncFailed` events implemented per Section 10.
- `OfflineQueue` extended (not replaced) with a state-update capability the service uses to transition `SyncState`.
- All new components have deterministic unit tests; the pipeline integration test is extended per Section 12.
- `npm run typecheck` and `npm run test` pass across the monorepo.
- DT-008's existing Acceptance Criteria in `EP-007_Development_Tasks.md` are met and a "Development Sprint 004 Implementation Notes" subsection is added under DT-008, mirroring the format used for DT-001–DT-007.
- No change is made to DT-001–DT-007 Acceptance Criteria, FB-001, TS-001, TTAP-001, any ADR, or EP-008.
- Review Agent verification and Human Architect approval are recorded before DT-008 is marked Completed (DTP-001: "Implementation alone never completes a Development Task").

## 15. Recommended Implementation Order

1. `SynchronizationResult` type (`synchronized` / `retryable_failure` / `conflict`).
2. `WorkEventSynchronized` and `WorkEventSyncFailed` domain events, following the existing constructor pattern.
3. `SynchronizationGateway` port.
4. `FakeSynchronizationGateway` adapter, with its own configurable-outcome unit tests.
5. Extend `OfflineQueue` with the minimal state-update method the service needs (e.g. `markSynchronized`/`markFailed`, or an equivalent single `update` method) — extend the existing port, do not replace it.
6. Implement `SynchronizationService`, wiring gateway + queue + event emission; unit test all three outcomes.
7. Extend the pipeline-level integration test to cover a full scan-to-synchronized run for both `BusinessEngineDecision` branches.
8. Run `npm run typecheck` and `npm run test` for the whole monorepo.
9. Update `EP-007_Development_Tasks.md` DT-008 with a "Development Sprint 004 Implementation Notes" subsection (implementation summary and file references only — Objective/Acceptance Criteria unchanged).
10. Produce implementation evidence and role handover; request Review Agent verification.

---

## 16. Development Agent Prompt

The following prompt is written to be given directly to Claude Code (Development Agent) to execute Development Sprint 004. It is self-contained and does not require this planning document to be re-explained.

```text
You are the Development Agent for TapTim.e, implementing Development Sprint 004 (DT-008 – Synchronization Service) inside the existing `packages/core` TypeScript package, on branch `main`.

CONTEXT (verify before writing code):
- Read `ADO/02_Development/Development_Sprint_004_Plan.md` in full — it is the authoritative scope for this task.
- Read `ADO/02_Development/EP-007_Development_Tasks.md`, DT-008 section, for the unchanged Objective and Acceptance Criteria you must satisfy.
- Read the current implementation: `packages/core/src/ports/OfflineQueue.ts`, `infrastructure/repositories/InMemoryOfflineQueue.ts`, `packages/core/src/domain/QueuedWorkEventRecord.ts`, `SyncState.ts`, `packages/core/src/domain/events/WorkEventQueuedForSync.ts`, and `packages/core/src/business/BusinessEngineDecision.ts` (for the established explicit-typed-result pattern).
- Do not read this as permission to change DT-001–DT-007 behavior. You are extending, not replacing.

IMPLEMENTATION SCOPE (do exactly this, nothing more):
1. Add `packages/core/src/application/SynchronizationResult.ts` (or an equivalent location alongside the new service) — a typed union of at least `'synchronized' | 'retryable_failure' | 'conflict'` outcomes, following the same explicit-result style as `BusinessEngineDecision`/`EnqueueResult`.
2. Add `packages/core/src/domain/events/WorkEventSynchronized.ts` and `WorkEventSyncFailed.ts`, following the exact constructor-function pattern used in `WorkEventQueuedForSync.ts`.
3. Add `packages/core/src/ports/SynchronizationGateway.ts` — an interface representing the remote synchronization target, with one method to attempt synchronizing a `QueuedWorkEventRecord` and return a `SynchronizationResult`.
4. Add `packages/core/src/infrastructure/adapters/FakeSynchronizationGateway.ts` implementing `SynchronizationGateway` with a configurable outcome (success/retryable-failure/conflict) for deterministic tests, following the style of `FakeNfcScanAdapter.ts`.
5. Extend `packages/core/src/ports/OfflineQueue.ts` (and `InMemoryOfflineQueue.ts`) with the minimal capability needed to transition a record's `SyncState` in place after a synchronization attempt — do not replace `enqueue`/`findPending`.
6. Add `packages/core/src/application/SynchronizationService.ts` that reads pending records via `OfflineQueue.findPending()`, calls `SynchronizationGateway` for each, updates the queue's `SyncState` accordingly, and emits `WorkEventSynchronized` on success or `WorkEventSyncFailed` on retryable failure or conflict (with the outcome distinguishable in the emitted event).
7. Export all new public types/classes from `packages/core/src/index.ts`, following the existing export list order and style.

ARCHITECTURE BOUNDARIES (do not violate):
- `SynchronizationGateway`/`FakeSynchronizationGateway` and `SynchronizationService` must not make business decisions and must not read or branch on `QueuedWorkEventRecord.decision` for anything other than passing it along untouched. No real network or database library may be added to `package.json` in this sprint.
- A retryable failure must never cause a record to be dropped from the queue; it must remain visible as still-pending (or an equivalent still-retryable state).
- A conflict outcome must be distinguishable from a plain retryable failure in both the `SynchronizationResult` type and the emitted event — do not collapse them into one case.
- Do not implement retry scheduling, backoff timers, or any real backend/database integration — out of scope for this sprint (see the plan's Section 7).
- Do not touch `FB-001`, `TS-001`, `TTAP-001`, any ADR, or `EP-008` — this is an implementation task, not an architecture task.
- Do not attempt to resolve Finding F-01 — irrelevant to this task.
- Follow the existing constructor-injection pattern (explicit ID/clock/outcome functions with real-ish defaults) if new components need determinism for tests.

TESTING REQUIREMENTS:
- Unit tests for `FakeSynchronizationGateway`: each configured outcome (synchronized, retryable_failure, conflict) is returned correctly.
- Unit tests for `SynchronizationService`: a pending record transitions to `synchronized` and emits `WorkEventSynchronized` on gateway success; remains retryable (not lost) and emits `WorkEventSyncFailed` on retryable failure; produces a distinct, observable outcome on conflict.
- Extend the existing pipeline-level test (or add a sibling test) so a full scan-to-synchronized run is proven end-to-end for both the `time_entry_started` and `escalation_required` decision branches.
- Run `npm run typecheck` and `npm run test` at the repository root; both must pass before you consider the task done.

EXPECTED DELIVERABLES:
- All files listed under Implementation Scope, committed with a clear commit message referencing DT-008 and Development Sprint 004.
- A "Development Sprint 004 Implementation Notes" subsection added under DT-008 in `ADO/02_Development/EP-007_Development_Tasks.md`, in the same format as the existing DT-001–DT-007 notes (implementation summary and file references; do not alter DT-008's Objective or Acceptance Criteria).
- A short implementation summary (changed files, test results, known deviations) suitable for Review Agent evaluation.

STOP CONDITION:
Stop after completing the Implementation Scope, tests, and the DT-008 implementation notes update. Do not begin DT-009 (Error Handling). Do not mark DT-008 "Completed" yourself — that status requires Review Agent verification and Human Architect approval. Wait for review.
```

---

## 17. Role Handover

Implemented scope in this task: Development Sprint 004 planning only — this document and the embedded Development Agent Prompt. No source code was written or modified. No architecture, ADR, TTAP-001, FB-001, TS-001, Product Vision or EP-008 content was changed.

Changed artifacts (this phase): `ADO/02_Development/Development_Sprint_004_Plan.md` (new, this file). See the separate `Development_Sprint_003_Closure.md` for Phase 1's governance changes.

Related ADO artifacts consulted: Product Vision, Product Principles, Decision Log, AVR-001, ADR-0003, ADR-0004, ADR-0005, ADR-0006, ADR-0007, TTAP-001, Domain Model, FB-001, TS-001, Development Task Profile (DTP-001), `EP-007_Development_Tasks.md`, `Development_Sprint_001_Plan.md`, `Development_Sprint_002_Plan.md`, `Development_Sprint_003_Plan.md`, current `packages/core/src`/`packages/core/tests` source tree, EP-008 Chapters 00–03 (as synchronized through Sprint 003).

Tests performed: none (planning-only task; no code changed).

Known deviations: none from the assigned task scope.

Open findings carried forward (not resolved by this task): (1) Development Sprint 002 (DT-004 full/DT-005 partial/DT-006 slice) still has no recorded Review Agent verification or Human Architect approval; (2) Finding F-01 (duplicate-scan/toggle mechanism) remains open and continues to gate DT-005's remaining "stop"/"pending" outcomes; (3) `QueuedWorkEventRecord.decision: null` still has no integration-level test coverage (documented, not resolved).

Evidence produced: this plan document, `Development_Sprint_003_Closure.md`, and the repository-evidence-based justification for recommending Synchronization Service Foundation (DT-008) over Persistence Integration.

Next responsible role: Technical Lead / Human Architect review and approval of the Sprint 003 Closure actions and the Sprint 004 Plan. Per the assigned stop condition, implementation does not begin until that approval is given.

## 18. Stop Condition

Per task instruction: this task stops after Phase 1 (Sprint 003 Closure) and Phase 2 (Sprint 004 Plan, Development Agent Prompt, Role Handover). No code was implemented. No architecture, ADRs, TTAP-001, Product Vision or EP-008 were modified. Awaiting Technical Lead / Human Architect approval before implementation begins.
