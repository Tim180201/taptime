# EP-007 Development Tasks

Status: Draft  
Epic: EP-007 – Product Architecture Foundation  
Owner: Technical Lead  
Approval Authority: Human Architect  
Related Feature Blueprint: `ADO/01_Architecture/Feature_Blueprints/FB-001-nfc-scan-creates-work-event.md`; `ADO/01_Architecture/Feature_Blueprints/FB-002-organization-management-foundation.md` (DT-017–DT-026)  
Related Technical Specification: `ADO/01_Architecture/Technical_Specifications/TS-001-nfc-scan-creates-work-event.md`; `ADO/01_Architecture/Technical_Specifications/TS-002-organization-management-foundation.md` (DT-017–DT-026)  
Related Architecture: `ADO/01_Architecture/Technical_Architecture_Profile.md`  
Created Date: 2026-06-30  
Last Updated: 2026-07-18 (C3E2 independent closure synchronization; no new task created)

## Purpose

This document defines the Development Task structure for TapTim.e's implemented and planned Feature Blueprint/Technical Specification pairs. It originally defined only the initial Development Task structure for implementing TS-001 (DT-001–DT-016, NFC Scan Creates Work Event); it now also contains the Development Task decomposition for TS-002 (DT-017–DT-026, Organization Management Foundation). Both task sequences live in this one document because both are EP-007 Development Tasks; TS-001's and TS-002's own Feature Blueprints/Technical Specifications remain the authoritative source for the product behavior and architecture each task implements — this document only bounds and sequences the implementation units.

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

### Development Sprint 005 Implementation Notes

See `ADO/02_Development/Development_Sprint_005_Plan.md` for the full plan. Extension (not replacement): a second `NfcScanPort` implementation, `CliNfcScanAdapter`, accepts genuinely external, non-hard-coded-fixture input (a CLI argument or stdin-sourced string) instead of a Vitest literal, normalizing it into the same `NfcScanCaptureResult` shape — including an explicit `unreadable` result for missing/empty/whitespace-only input. `FakeNfcScanAdapter` is untouched and remains the test-only adapter. Objective and Acceptance Criteria above are unchanged and are satisfied again by this second implementation.

Implementation: `packages/core/src/infrastructure/adapters/CliNfcScanAdapter.ts`. Tests: `packages/core/tests/infrastructure/CliNfcScanAdapter.test.ts`.

### Development Sprint 011 Implementation Notes

See DT-016 below. A third `NfcScanPort` implementation, `RnNfcScanAdapter`, exists in `apps/mobile` — a real, hardware-backed adapter for Android, using `react-native-nfc-manager`. `NfcScanPort.ts` itself, `FakeNfcScanAdapter`, and `CliNfcScanAdapter` are all unchanged. Objective and Acceptance Criteria above are unchanged and are satisfied a third time by this implementation.

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

### Development Sprint 010 Implementation Notes

See DT-015 below. `WorkEventRepository`/`TimeEntryRepository` now have a second, durable, file-based implementation (`FileWorkEventRepository`/`FileTimeEntryRepository`) alongside the in-memory one above — the in-memory implementation is unchanged and remains the default. "Persistence failures are explicit" remains only trivially satisfied by both implementations (still no I/O failure paths — the file adapters use straightforward synchronous `fs` calls with no error handling beyond what Node itself throws); a real backend/Firestore implementation, still deferred, would need to address this properly.

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

### Development Sprint 010 Implementation Notes

See DT-015 below. `OfflineQueue` now has a second, durable, file-based implementation (`FileOfflineQueue`) alongside `InMemoryOfflineQueue` above — the in-memory implementation is unchanged and remains the default; its `already_queued` duplicate-enqueue semantics are matched exactly.

## DT-008 – Synchronization Service

Objective: Synchronize queued WorkEvents and related results with backend persistence.

Acceptance Criteria:

- Queued records can synchronize.
- Retryable failures preserve local state.
- Conflicts are observable.
- Successful synchronization updates SyncState.

### Development Sprint 004 Implementation Notes

Status: Implemented and committed (`e19de60`); typecheck clean and all 53 tests pass (verified 2026-07-05). Pending Review Agent verification and Human Architect approval before this task can be marked Completed (DTP-001: "Implementation alone never completes a Development Task"; AVR-001: "Validation requires evidence. Status shall never be upgraded by assumption.").

See `ADO/02_Development/Development_Sprint_004_Plan.md` for the full plan. Implemented as a `SynchronizationGateway` port + `FakeSynchronizationGateway` adapter (configurable success/retryable-failure/conflict outcomes), consistent with the fake/in-memory pattern used by DT-001–DT-007 — no real backend/database technology is introduced (deferred per ADR-0006/ADR-0007). `SynchronizationService` reads pending records via `OfflineQueue.findPending()`, attempts synchronization once per record per call (no retry scheduling/backoff — out of scope), and transitions `SyncState` via a narrowly-scoped `OfflineQueue.updateSyncState()` extension: `synchronized` on success, remains `pending` (never dropped) on a retryable failure, `failed` on conflict. `WorkEventSynchronized` and `WorkEventSyncFailed` are emitted following the existing constructor-function pattern; a conflict is distinguished from a plain retryable failure via `WorkEventSyncFailed.outcome`, since TTAP-001 names only one `WorkEventSyncFailed` event, not a separate conflict event. The service never reads `QueuedWorkEventRecord.decision` for anything beyond forwarding it (ADR-0005/ADR-0006). Objective and Acceptance Criteria above are unchanged.

Implementation: `packages/core/src/application/SynchronizationResult.ts`, `SynchronizationService.ts`, `packages/core/src/domain/events/WorkEventSynchronized.ts`, `WorkEventSyncFailed.ts`, `packages/core/src/ports/SynchronizationGateway.ts`, `OfflineQueue.ts` (extended with `updateSyncState`), `packages/core/src/infrastructure/adapters/FakeSynchronizationGateway.ts`, `infrastructure/repositories/InMemoryOfflineQueue.ts` (extended). Tests: `packages/core/tests/infrastructure/FakeSynchronizationGateway.test.ts`, `InMemoryOfflineQueue.test.ts` (extended), `packages/core/tests/application/SynchronizationService.test.ts`, `NfcScanToTimeEntryPipeline.test.ts` (extended for both decision branches through to `synchronized`).

## DT-009 – Error Handling

Objective: Implement explicit error handling for scan, assignment, WorkEvent, persistence and synchronization failures.

Acceptance Criteria:

- Errors are categorized consistently with TTAP-001.
- User-facing outcomes are clear enough for implementation.
- Technical errors remain observable for evidence and debugging.

### Development Sprint 009 Implementation Notes

Status: Completed — Review Agent verified, Human Architect approved (2026-07-07). Per Technical Lead authorization following independent Review Agent approval of Development Sprint 009, this task's status is updated from "Implemented — Pending Review" to "Completed" (Governance Closure, `ADO/02_Development/Development_Sprint_009_Closure.md`).

See `ADO/02_Development/Development_Sprint_009_Plan.md` for the full plan. Implemented as a shared `ErrorCategory` type (`'recoverable' | 'retryable' | 'deferred' | 'conflict' | 'fatal'`, exactly TTAP-001's Runtime Architecture wording) plus five pure, read-only classification functions — one per existing result/outcome type — mapping each rejection/failure reason onto that taxonomy without changing any of the five types' shapes or the business/application logic that produces them (verified: `AssignmentResolver`, `AssignmentValidator`, `BusinessEngine`, `WorkEventFactory`, `SynchronizationService`, `SessionService`, and all five result/outcome type files are byte-for-byte unchanged — confirmed by `git diff`). `ErrorCategory` lives in `domain/`, not `application/`, specifically so the business-layer classification functions can depend on it without inverting the approved dependency direction (Business depends on Domain, never the reverse).

**Final category mapping** (rationale documented in each classification function's own comments):

| Reason | Source type | Category |
|---|---|---|
| `unreadable` (capture) | `ScanPipelineOutcome` | recoverable |
| `unknown_tag` | `ScanPipelineOutcome` (resolution) | recoverable |
| `inactive_assignment` | `ScanPipelineOutcome` (resolution) | recoverable |
| `employee_not_authenticated` | `AssignmentValidationResult` | recoverable |
| `employee_lacks_organization_access` | `AssignmentValidationResult` | fatal |
| `missing_assignment_target` | `AssignmentValidationResult` | fatal |
| `assignment_target_disabled` | `AssignmentValidationResult` | fatal |
| `escalation_required` / `duplicate_scan_rule_undefined` | `BusinessEngineDecision` | deferred |
| `retryable_failure` | `SynchronizationResult` | retryable |
| `conflict` | `SynchronizationResult` | conflict |
| `invalid_credentials` | `AuthenticationResult` | recoverable |

**Rationale for the recoverable/fatal split** (no genuinely ambiguous case required escalation, but this distinction is an interpretive judgment call, documented explicitly rather than silently assumed, since TTAP-001 names the five categories without further definition): a reason is `recoverable` when the scanning employee's own immediate next action (rescan, sign in with a different/correct credential) can plausibly resolve it without anyone else's intervention. A reason is `fatal` (to this specific attempt, not to the application) when it reflects a data/permission state — wrong organization, a missing or disabled target — that only an administrator can correct; no amount of retrying by the employee changes the outcome. `retryable`/`conflict` reuse `SynchronizationResult`'s own existing, already-precise names. `deferred` reuses `BusinessEngineDecision`'s own existing "deliberate placeholder" framing for Finding F-01.

`ScanResultPresenter` was extended additively with two new methods, `presentScanOutcomeWithCategory()` and `presentEventWithCategory()`, each returning `{ message, category }` by calling the existing, completely unchanged `presentScanOutcome()`/`presentEvent()` methods internally and pairing the result with the new classification. Its pre-existing 16 tests were not modified; 9 new tests were added for the two new methods.

Implementation: `packages/core/src/domain/ErrorCategory.ts`, `packages/core/src/business/classifyAssignmentValidationResult.ts`, `classifyBusinessEngineDecision.ts`, `packages/core/src/application/classifyScanPipelineOutcome.ts`, `classifySynchronizationResult.ts`, `classifyAuthenticationResult.ts`, `packages/core/src/application/ScanResultPresenter.ts` (extended). Tests: `packages/core/tests/business/classifyAssignmentValidationResult.test.ts`, `classifyBusinessEngineDecision.test.ts`, `packages/core/tests/application/classifyScanPipelineOutcome.test.ts`, `classifySynchronizationResult.test.ts`, `classifyAuthenticationResult.test.ts`, `packages/core/tests/application/ScanResultPresenter.test.ts` (extended).

## DT-010 – Tests

Objective: Create verification coverage for the NFC Scan Creates Work Event implementation.

Acceptance Criteria:

- Tests verify normal, rejection, duplicate and offline flows.
- Tests verify Business Rules stay outside UI and persistence.
- Test evidence is attached to implementation handover.

### Development Sprint 005 Implementation Notes

See `ADO/02_Development/Development_Sprint_005_Plan.md` for the full plan. Extended (not replaced) with: unit tests for the new `CliNfcScanAdapter` (infrastructure boundary only) and `ScanResultPresenter` (presentation boundary only, exhaustively covering every currently-defined `ScanPipelineOutcome`/event shape, including both `BusinessEngineDecision` branches), plus a consolidated demonstration test that drives the DT-011 composition root — using the real, unmodified DT-001–DT-008 production classes, not mocks — through every currently-defined pipeline outcome (unreadable, unknown tag, accepted+started, accepted+escalated, synchronized, retryable failure, conflict) reachable from the demo's single seeded scenario. The remaining `AssignmentResolver`/`AssignmentValidator` rejection reasons not reachable from that single scenario (e.g. disabled customer, organization mismatch) are exhaustively covered at the `ScanResultPresenter` rendering-correctness level and were already covered at the business-decision level by DT-002/DT-003's own existing tests; this is a documented scope boundary, not a gap (see Development Sprint 005 Role Handover). Objective and Acceptance Criteria above are unchanged.

Implementation: `packages/core/tests/infrastructure/CliNfcScanAdapter.test.ts`, `packages/core/tests/application/ScanResultPresenter.test.ts`, `packages/core/tests/cli/runScan.test.ts`.

## DT-011 – Real Scan Composition Root & Result Presentation

Objective: Assemble DT-001–DT-008 into a single runnable composition driven by real external input, and implement TS-001's `ScanResultPresenter` to render every pipeline outcome.

Acceptance Criteria:

- A runnable entry point exists and can be executed outside the test runner.
- Real (non-hard-coded-fixture) input can trigger a scan through it.
- Every currently-defined pipeline outcome (accepted+started, accepted+escalated, each rejection reason, synchronized, retryable-failure, conflict) is rendered through `ScanResultPresenter`.
- No new business decision logic is introduced anywhere in the composition root.

### Development Sprint 005 Implementation Notes

Status: Completed — Review Agent verified, Human Architect approved (2026-07-06). Per Technical Lead authorization following independent Review Agent approval of Development Sprint 005, this task's status is updated from "Implemented — Pending Review" to "Completed" (Governance Closure, `ADO/02_Development/Development_Sprint_005_Closure.md`).

See `ADO/02_Development/Development_Sprint_005_Plan.md` for the full plan, including why this task does not attempt physical NFC hardware (Section 3: no mobile app or native module exists yet; that remains future Mobile Foundation work gated on an ADR-0007 mobile-validation decision). DT-011 was approved by the Human Architect as one combined task (composition root + `ScanResultPresenter`), not split into two Development Tasks.

Implemented: `ScanResultPresenter` (TS-001-named, never previously built) renders every `ScanPipelineOutcome` (capture/resolution/validation stages, all rejection reasons) and every downstream domain event (`WorkEventCreated`, `TimeEntryStarted`, `WorkEventQueuedForSync` — rendered distinctly for the `time_entry_started` and `escalation_required` `BusinessEngineDecision` branches — `WorkEventSynchronized`, `WorkEventSyncFailed` with `retryable_failure`/`conflict` distinguished). A composition root (`buildScanDemoPipeline`) wires `CliNfcScanAdapter` (DT-001 extension) → `AssignmentResolver` → `AssignmentValidator` → `WorkEventCreationService` (`WorkEventFactory`/`BusinessEngine`/in-memory repositories/`InMemoryOfflineQueue`) → `SynchronizationService`/`FakeSynchronizationGateway` → `ScanResultPresenter`, using every DT-001–DT-008 production class unmodified, seeded with small, clearly-labeled demo-only data (one Organization, one authenticated employee, one Customer, one NfcTag, one active NfcAssignment). A thin CLI entry point (`packages/core/src/cli/runScan.ts`, run via `npm run demo:scan --workspace=@taptime/core -- <payload> [success|retryable_failure|conflict]`) reads real, non-hard-coded CLI input; the composition logic itself is exported as `buildScanDemoPipeline` so tests can drive it directly and deterministically with the real production classes, not mocks. Manually verified runnable end-to-end outside the test runner via `tsx` for all seven outcome scenarios (see Implementation Summary in the handover). No new business decision logic was introduced; every accept/reject/escalate/sync decision remains exactly where DT-002–DT-005/DT-008 already put it.

Implementation: `packages/core/src/application/ScanResultPresenter.ts`, `packages/core/src/infrastructure/adapters/CliNfcScanAdapter.ts`, `packages/core/src/cli/runScan.ts`. Tests: `packages/core/tests/application/ScanResultPresenter.test.ts`, `packages/core/tests/infrastructure/CliNfcScanAdapter.test.ts`, `packages/core/tests/cli/runScan.test.ts`.

### Development Sprint 006 Implementation Notes

See `ADO/02_Development/Development_Sprint_006_Plan.md`. Two small, targeted extensions to this already-implemented task, no behavior change to the composition logic itself: (1) `packages/core/src/index.ts` now re-exports `./cli/runScan` (`buildScanDemoPipeline`, `DEMO_KNOWN_PAYLOAD`, supporting types) so `@taptime/mobile` (DT-012) can import and call the existing composition root, rather than reimplementing any part of it; (2) the CLI entry-point guard in `runScan.ts` was hardened (`typeof process !== 'undefined' && Array.isArray(process.argv) && typeof process.argv[1] === 'string'`) after Metro/Expo bundling proved that `process.argv` does not exist in the Expo/Hermes runtime the way it does under Node — without this guard, merely importing the module from a mobile app would have thrown at load time. This is a defensive fix to the module's own CLI-trigger condition, not a change to `buildScanDemoPipeline`'s behavior; all 81 existing `packages/core` tests continue to pass unchanged. Objective and Acceptance Criteria above are unchanged.

## DT-012 – Mobile Application Foundation

Objective: Establish `apps/mobile` as a runnable Expo/React Native application that depends on `@taptime/core` and invokes its existing DT-011 composition root from a real mobile JavaScript runtime, without duplicating any business logic.

Acceptance Criteria:

- `apps/mobile` exists as a workspace package and launches in the Expo development environment.
- It depends on `@taptime/core` and imports the composition root rather than re-implementing any part of it.
- A placeholder scan interaction (button/text-input, not real NFC) triggers the composition root and displays its outcome on-screen.
- No persistence, network, or auth code is added inside `apps/mobile`.
- `packages/core`'s business/application/domain code is unchanged except for the export extension described above.

### Development Sprint 006 Implementation Notes

Status: Completed — Review Agent verified, Human Architect approved (2026-07-06). Per Technical Lead authorization following independent Review Agent approval of Development Sprint 006, this task's status is updated from "Implemented — Pending Review" to "Completed" (Governance Closure, `ADO/02_Development/Development_Sprint_006_Closure.md`). The previously documented environment constraint (no simulator/device available in this session's environment) is unchanged as a historical implementation note; it is superseded for governance purposes by the recorded Review Agent verification.

See `ADO/02_Development/Development_Sprint_006_Plan.md` for the full plan, including the self-corrected sprint ordering rationale (Section 3: the React Native/Expo framework choice is already Approved/Validated per ADR-0007; only the backend/auth technology remains deferred, so a Mobile Foundation scaffold has no undecided dependency blocking it).

Implemented: `apps/mobile`, an Expo TypeScript (`blank-typescript` template) project, added to the existing npm workspaces (`apps/*` was already in the root workspaces glob; no root change needed). It depends on `@taptime/core` (workspace-linked) and imports only the package's public root export (`buildScanDemoPipeline`, `DEMO_KNOWN_PAYLOAD`) — no deep imports into `business/`, `domain/`, `application/` or `infrastructure/` subpaths, and no business, domain or persistence code exists inside `apps/mobile` (verified by direct inspection: `apps/mobile/src/` contains only `navigation/AppNavigator.tsx` and `screens/ScanScreen.tsx`). `AppNavigator` is a deliberately minimal single-screen "navigator" (no routing library added, per the plan's explicit allowance). `ScanScreen` provides a text-input + button placeholder scan trigger (not real NFC — none exists) and a "Synchronize" button, both calling the composition root's existing `scan(...)`/`synchronizePending(...)` functions unmodified, and renders the accumulated `ScanResultPresenter` output strings in a `Text` list — no new presentation or business logic.

**Spike-first, as instructed (Section 14 step 1):** before building any screen, a minimal `App.tsx` imported `buildScanDemoPipeline` from `@taptime/core` and was bundled via `npx expo export --platform ios`, which succeeded (630 modules, valid Hermes bytecode bundle) — proving the cross-package Metro/Bundler consumption path (Section 12's top risk) resolves cleanly. This also surfaced a real, previously-undiscovered risk: `runScan.ts`'s Node-CLI-only trigger guard read `process.argv[1]` unconditionally, which is not defined the way Node defines it in the Expo/Hermes runtime; this was hardened (see DT-011's Sprint 006 notes above) before proceeding, rather than working around it with a duplicated/simplified reimplementation.

**Environment constraint (documented, not silently worked around):** this execution environment has no iOS/Android simulator or device available. Full manual verification (launching the Expo development client/simulator, tapping the on-screen scan trigger, and eyeballing the rendered result) could not be performed and must be done by the Technical Lead/Human Architect or Review Agent on a real environment before DT-012 is marked Completed. What *was* verified in this environment: (1) `npx expo export --platform ios` succeeds and produces a valid bundle both before and after the full screen was built; (2) `npx tsc --noEmit` (using `apps/mobile`'s own Expo-based `tsconfig.json`) passes with no errors; (3) `apps/mobile` contains no business logic, verified by direct inspection and by the fact that its only `@taptime/core` import is the public root export; (4) the CLI demo (`npm run demo:scan --workspace=@taptime/core -- demo-tag-payload success`) was re-run and produces the same message shapes `ScanScreen` renders, since both consume the identical `buildScanDemoPipeline`/`ScanResultPresenter` — there is no second, divergent implementation to compare against.

`apps/mobile/tsconfig.json` extends `expo/tsconfig.base` (Expo's own required baseline for JSX/React Native module resolution), not the repository's root `tsconfig.base.json` (which targets a pure Node/TypeScript package and lacks JSX/React Native settings) — a deviation from the plan's literal Section 6 wording, made because Expo's own base config is required for the app to build at all; noted explicitly per "repository reality has priority."

Implementation: `apps/mobile/package.json`, `app.json`, `tsconfig.json`, `App.tsx`, `index.ts`, `src/navigation/AppNavigator.tsx`, `src/screens/ScanScreen.tsx`. `packages/core/src/index.ts` (export extension, see DT-011 Sprint 006 notes above). Verification: `npx expo export --platform ios` (bundling proof), `npx tsc --noEmit` (typecheck), manual CLI comparison via `npm run demo:scan`; no automated component test was added (no React Native component-testing framework — e.g. Jest/`@testing-library/react-native` — exists yet in this repository, and `ScanScreen`'s event handlers are thin, direct calls to the composition root with no branching logic of their own to unit-test; documented here as the accepted alternative per the plan's own Section 11 allowance).

## DT-013 – Authentication & Session Foundation

Objective: Establish a `Session`/current-user mechanism — an `AuthenticationGateway` port, a fake/local implementation, a `SessionService`, and a mobile Login screen — that produces a real `CallerContext` for the existing scan composition root, without changing any business decision logic that already depends on `CallerContext`.

Acceptance Criteria:

- `AuthenticationGateway` port and `FakeAuthenticationGateway` exist and are tested in isolation.
- `SessionService` calls the gateway and returns/produces a `CallerContext` using the existing `authenticatedCaller()`/`UNAUTHENTICATED_CALLER` helpers, unchanged.
- `apps/mobile` gains a `LoginScreen` that calls `SessionService` and, on success, navigates to `ScanScreen` carrying the resulting `CallerContext`.
- The scan composition root uses the signed-in session's `CallerContext` instead of the Sprint 005/006 hard-coded demo caller.
- `AssignmentValidator`'s existing `employee_not_authenticated` behavior is exercised, not modified.
- No persistence, network, or real managed-auth-provider code is added.

### Development Sprint 007 Implementation Notes

Status: Completed — Review Agent verified, Human Architect approved (2026-07-06), **for the narrowed scope actually implemented and reviewed only**: `AuthenticationGateway`, `FakeAuthenticationGateway`, `SessionService`, `AuthenticationResult` in `packages/core`. Per Technical Lead authorization following independent Review Agent approval of Development Sprint 007, this narrowed scope is marked Completed (Governance Closure, `ADO/02_Development/Development_Sprint_007_Closure.md`). **This does not close DT-013's full Acceptance Criteria above** — "`apps/mobile` gains a `LoginScreen`..." and "The scan composition root uses the signed-in session's `CallerContext`..." were explicitly not built this session (see the paragraph below) and were not part of what was reviewed. That remaining scope is carried forward as a proposed follow-up task (DT-014, not yet created or approved — see Development Sprint 007 Closure Summary) rather than silently treated as covered by this Completed status.

See `ADO/02_Development/Development_Sprint_007_Plan.md` for the full plan. **Scope actually implemented this session, per explicit Human Architect instruction narrowing the plan's Section 6 scope:** "Build only the AuthenticationGateway, FakeAuthenticationGateway and SessionService." Accordingly, this sprint delivers the `packages/core` authentication foundation only. The plan's remaining Section 6 items — extending `buildScanDemoPipeline`/`runScan.ts` to accept an externally-produced `CallerContext`, `apps/mobile`'s `LoginScreen`, and `AppNavigator`'s Login → Scan extension — were **not built this session** and remain open for a follow-up sprint/session before DT-013's Acceptance Criteria ("`apps/mobile` gains a `LoginScreen`...", "The scan composition root uses the signed-in session's `CallerContext`...") are fully satisfied. This is a deliberate, instructed scope split, not an oversight.

Implemented: `AuthenticationResult` (explicit typed result, mirroring `SynchronizationResult`'s pattern: `authenticated` | `rejected` with `reason: 'invalid_credentials'` — no password flow, no other rejection reason is determinable by a fake/local gateway). `AuthenticationGateway` port (`authenticate(credentials): AuthenticationResult`) with a `Credentials` shape of a single opaque `signInCode` (not a username/password pair, per the explicit "no password flows" instruction). `FakeAuthenticationGateway`, seeded by default with one clearly-labeled demo account (`DEFAULT_DEMO_ACCOUNT`: `signInCode: 'demo-employee-code'` → `userId: 'demo-employee'`, `organizationId: 'demo-org'` — matching `buildScanDemoPipeline`'s existing demo identity naming), and constructor-overridable with additional demo accounts for tests. `SessionService.signIn(credentials)` forwards the gateway's `AuthenticationResult` faithfully (verified by a dedicated test asserting it decides nothing beyond what the gateway returned); a standalone `toCallerContext(result)` function converts an `AuthenticationResult` into the existing, unchanged `CallerContext` shape via `authenticatedCaller()`/`UNAUTHENTICATED_CALLER` — no new identity type introduced. A dedicated pipeline-level test (`SessionDerivedCallerPipeline.test.ts`) proves a `SessionService`-derived `CallerContext` reaches the exact same `AssignmentValidator` outcomes (both accepted and the existing `employee_not_authenticated` rejection) as the hard-coded `authenticatedCaller(...)` fixture — `AssignmentValidator`/`BusinessEngine`/`WorkEventCreationService` are reused completely unmodified. `packages/core/src/index.ts` re-exports the four new public symbols. `runScan.ts`, `apps/mobile`, and all DT-001–DT-012 business logic are untouched.

Implementation: `packages/core/src/application/AuthenticationResult.ts`, `SessionService.ts`, `packages/core/src/ports/AuthenticationGateway.ts`, `packages/core/src/infrastructure/adapters/FakeAuthenticationGateway.ts`. Tests: `packages/core/tests/infrastructure/FakeAuthenticationGateway.test.ts`, `packages/core/tests/application/SessionService.test.ts`, `packages/core/tests/application/SessionDerivedCallerPipeline.test.ts`.

### Development Sprint 008 Implementation Notes

DT-013's remaining Acceptance Criteria above ("`apps/mobile` gains a `LoginScreen`...", "The scan composition root uses the signed-in session's `CallerContext`...") are now satisfied — see DT-014 below, which completes the mobile-integration half of this task without modifying anything implemented here in Sprint 007. `AuthenticationGateway`, `FakeAuthenticationGateway`, `SessionService`, `AuthenticationResult`, `authenticatedCaller()`/`UNAUTHENTICATED_CALLER` and `AssignmentValidator`'s `employee_not_authenticated` check are all unchanged by Sprint 008.

**Development Sprint 008 Governance Closure note:** DT-013 itself was already "Completed — Review Agent verified, Human Architect approved" as of the Development Sprint 007 Governance Closure, for its narrowed (`packages/core`-only) scope; that status is unchanged by this closure. With DT-014 (below) now also Completed, DT-013's full original Acceptance Criteria — across both Development Tasks together — are satisfied and reviewed.

## DT-014 – Mobile Session Integration

Objective: Complete the mobile-facing half of DT-013 — a `LoginScreen` in `apps/mobile` that calls the existing `SessionService`, and a composition root that accepts the resulting `CallerContext` instead of a hard-coded demo caller — so a real person can authenticate and enter the app.

Acceptance Criteria:

- `apps/mobile` gains a `LoginScreen` that calls `SessionService.signIn(...)` and, on success, navigates to `ScanScreen`, passing the resulting `CallerContext`.
- On rejection, the screen displays the gateway's rejection reason without inventing new business rules.
- `buildScanDemoPipeline`/`runScan.ts` accepts an externally-produced `CallerContext` while preserving existing CLI behavior.
- `ScanScreen`'s scan action uses the signed-in session's `CallerContext`.
- `AssignmentValidator`'s existing `employee_not_authenticated` behavior remains exercised, not modified.
- No persistence, network, or real managed-auth-provider code is added.

### Development Sprint 008 Implementation Notes

Status: Completed — Review Agent verified, Human Architect approved (2026-07-06). Per Technical Lead authorization following independent Review Agent approval of Development Sprint 008, this task's status is updated from "Implemented — Pending Review" to "Completed" (Governance Closure, `ADO/02_Development/Development_Sprint_008_Closure.md`). This closes DT-013's full Acceptance Criteria across both Development Tasks (Section above).

See `ADO/02_Development/Development_Sprint_008_Plan.md` for the full plan. This task closes exactly what `Development_Sprint_007_Closure.md` deferred: the mobile-facing half of DT-013.

Implemented: `buildScanDemoPipeline`'s `scan()` method now accepts an optional second `caller: CallerContext` parameter, defaulting to the pre-existing hard-coded `authenticatedCaller(UserId('demo-employee'), organizationId)` when omitted — the existing `npm run demo:scan` CLI and all pre-existing tests calling `scan(payload)` with one argument are unaffected (verified: all 94 pre-existing tests plus this sprint's own new tests pass unchanged). A new composition-level test (`runScan.callerOverride.test.ts`) proves both the default path and an externally-supplied, `SessionService`-derived `CallerContext` path produce correct, distinct outcomes, including that `AssignmentValidator`'s existing `employee_not_authenticated` rejection is reached unmodified for a rejected sign-in. `apps/mobile` gains `LoginScreen` (a sign-in-code text input + button calling `SessionService.signIn(...)` then `toCallerContext(...)`, displaying the gateway's `invalid_credentials` reason as-is on rejection — no new rejection reasons invented). `AppNavigator` was extended from a single-screen render to a minimal conditional Login → Scan flow (`useState<CallerContext | null>`; no routing library added — not found genuinely necessary for two screens, consistent with Sprint 006's precedent). `ScanScreen` now receives `caller: CallerContext` as a prop and passes it into `pipeline.scan(payload, caller)` instead of relying on the composition root's default. No business logic was added anywhere in `apps/mobile`; `apps/mobile`'s only `@taptime/core` imports remain its public root export (`SessionService`, `toCallerContext`, `FakeAuthenticationGateway`, `buildScanDemoPipeline`, `DEMO_KNOWN_PAYLOAD`, `CallerContext` type) — no deep imports into `business/`, `domain/`, `application/` or `infrastructure/` subpaths, verified by direct inspection.

**Verified in this environment (no simulator/device available, consistent with the constraint documented since Sprint 006):** `npx expo export --platform ios` succeeds (639 modules, valid Hermes bytecode bundle) both before and after these changes; `npx tsc --noEmit` (via `apps/mobile`'s own Expo-based `tsconfig.json`) passes with no errors; direct inspection confirms no business/authentication logic was duplicated inside `apps/mobile`. Full manual verification (launching the Expo development client/simulator, signing in via `LoginScreen`, confirming navigation to `ScanScreen`, and confirming a scan reflects the signed-in identity) could not be performed and must be done by the Technical Lead/Human Architect or Review Agent on a real environment before DT-014 is marked Completed.

Implementation: `packages/core/src/cli/runScan.ts` (extended), `apps/mobile/src/screens/LoginScreen.tsx` (new), `apps/mobile/src/navigation/AppNavigator.tsx` (extended), `apps/mobile/src/screens/ScanScreen.tsx` (extended). Tests: `packages/core/tests/cli/runScan.callerOverride.test.ts`.

## DT-015 – Local Persistence Foundation

Objective: Implement durable, file-based adapters for the existing `OfflineQueue`, `WorkEventRepository`, and `TimeEntryRepository` ports, proving queued WorkEvents, TimeEntries, and offline-queue state survive process restart, without introducing any cloud/backend persistence technology or new business logic.

Acceptance Criteria:

- `FileOfflineQueue`, `FileWorkEventRepository`, and `FileTimeEntryRepository` exist, implement their respective ports exactly, and are tested in isolation, including a dedicated test proving data survives a simulated process restart (a fresh adapter instance reading what a previous instance wrote).
- `buildScanDemoPipeline` can be configured to use the durable adapters instead of its in-memory defaults, with the in-memory defaults unchanged when no durable option is supplied.
- No new dependency is added to `packages/core/package.json`.
- No business/application logic (`AssignmentResolver`, `AssignmentValidator`, `BusinessEngine`, `WorkEventFactory`, `SynchronizationService`, `SessionService`) is modified.

### Development Sprint 010 Implementation Notes

Status: Completed — Review Agent verified, Human Architect approved (2026-07-07). As with DT-009, this task carries no simulator/device or narrowed-scope caveat: DT-015 is a pure `packages/core` change (the durable adapters, `JsonFileStore`, and the `runScan.ts`/`runScanCli.ts` split), verified in this environment via `npm run typecheck`/`npm run test` (154 `packages/core` tests pass, 27 new) and via genuinely separate OS process invocations proving cross-process durability (see Implementation Notes above). Its full, original Acceptance Criteria were implemented and reviewed in one pass.

See `ADO/02_Development/Development_Sprint_010_Plan.md` for the full plan, including why this sprint builds local, file-based persistence only, not cloud/backend technology (ADR-0004/ADR-0007 split local from cloud persistence; only the cloud half remains a deferred Human Architect decision).

**Implemented as specified:** a shared, dependency-free `JsonFileStore` helper (`readJsonArray`/`writeJsonArray`, using Node's built-in synchronous `fs`, matching the existing synchronous port signatures) reused by three new durable adapters — `FileOfflineQueue`, `FileWorkEventRepository`, `FileTimeEntryRepository` — each matching its in-memory counterpart's exact behavioral contract (including `FileOfflineQueue`'s `already_queued` duplicate handling). None of the three existing ports, the three existing in-memory adapters, or any business/application logic (`AssignmentResolver`, `AssignmentValidator`, `BusinessEngine`, `WorkEventFactory`, `SynchronizationService`, `SessionService`) were modified — verified by `git diff` showing zero changes to any of those files. No new dependency was added to `packages/core/package.json`; only Node's built-in `fs`/`path` are used.

**Required deviation from the plan's literal Section 6 wording, discovered and corrected during implementation:** the plan specified extending `buildScanDemoPipeline` with "an optional configuration selecting durable file-based storage (with a configurable directory/file path)" directly. Implementing it exactly that way — with the directory-to-adapter construction (and therefore the `fs`/`path` imports) inside `runScan.ts` itself — broke `apps/mobile`'s Metro bundling entirely (`Unable to resolve module path from .../runScan.ts`), because `packages/core/src/index.ts`'s barrel export (`export * from './cli/runScan'`, present since Sprint 006/DT-012) makes `runScan.ts` part of the static import graph every `@taptime/core` consumer resolves, and Node's `fs`/`path` have no React Native/Hermes equivalent — this is a **hard bundling failure**, not merely a runtime risk like the `process.argv`/`import.meta` guard from Sprint 006. This was caught by re-running the same `npx expo export --platform ios` verification step established in Sprint 006/008, immediately after wiring the storage option, before considering the sprint done — exactly the "prove it before building further" discipline those sprints established.

**Fix:** `buildScanDemoPipeline`'s `ScanDemoStorageOptions` now accepts pre-built port instances (`workEventRepository`, `timeEntryRepository`, `offlineQueue` — all type-only interface references, erased at compile time, so `runScan.ts` itself never imports `fs`/`path`/the File\*-adapter classes) instead of a raw directory string. The actual `fs`/`path`-dependent construction of durable adapter instances from a directory path now lives in a new, Node-only file, `packages/core/src/cli/runScanCli.ts`, which is the new `npm run demo:scan` entry point (`buildDurableStorage(directory)`) and is **not** re-exported from `packages/core/src/index.ts`. `apps/mobile` was not touched and does not need to be — it continues importing `buildScanDemoPipeline` from `@taptime/core`'s existing barrel unchanged, and `npx expo export --platform ios` was re-verified successful (645 modules) after this fix. This preserves DT-015's actual intent (`buildScanDemoPipeline` is configurable for durable storage; the in-memory default is unchanged) while being demonstrably necessary given Metro's inability to resolve Node built-ins — documented here rather than silently worked around.

**Verified:** all three new adapters' unit tests, including dedicated "survives simulated restart" tests (a fresh adapter instance pointed at the same temp directory correctly reads what a prior instance wrote). A composition-level test (`runScan.storageOverride.test.ts`) proves the default (in-memory) and durable-storage paths both work, that state does not leak between two different storage directories, and — the core proof this sprint exists to deliver — that a `TimeEntry` written by one pipeline instance causes a *second*, independently-constructed pipeline instance pointed at the same directory to correctly escalate (not re-start) a second scan of the same target. Manually re-verified via two genuinely separate OS process invocations (`TAPTIME_DEMO_STORAGE_DIR=<dir> npm run demo:scan -- demo-tag-payload success`, run twice): the first process starts a TimeEntry; the second, freshly-started process correctly reads it back from disk and escalates — real, not simulated, cross-process durability. The existing in-memory default (no environment variable) was re-verified unchanged: two separate process runs each independently start a TimeEntry, exactly as before this sprint.

**Explicitly out of scope, as planned, and documented as known limitations rather than built:** no concurrency/locking or atomic-write handling (a straightforward "read whole file, modify, write whole file" approach is used; a crash mid-write is not protected against); no cloud/backend persistence technology; no mobile-native storage library (`expo-sqlite`/`AsyncStorage`) wired into `apps/mobile` — this remains a natural, smaller follow-up task, analogous to the DT-013→DT-014 split.

Implementation: `packages/core/src/infrastructure/persistence/JsonFileStore.ts`, `FileOfflineQueue.ts`, `FileWorkEventRepository.ts`, `FileTimeEntryRepository.ts`, `packages/core/src/cli/runScan.ts` (extended, `ScanDemoStorageOptions` now interface-based), `packages/core/src/cli/runScanCli.ts` (new Node CLI entry point, replaces `runScan.ts` as the `demo:scan` script target). Tests: `packages/core/tests/infrastructure/persistence/JsonFileStore.test.ts`, `FileOfflineQueue.test.ts`, `FileWorkEventRepository.test.ts`, `FileTimeEntryRepository.test.ts`, `packages/core/tests/cli/runScan.storageOverride.test.ts`.

## DT-016 – Real NFC Hardware Integration

Objective: Implement a native NFC adapter for Android satisfying the existing `NfcScanPort` contract, wired into `apps/mobile`'s `ScanScreen`, proving a physical NFC tag scan reaches the unmodified Business Engine/composition pipeline.

Acceptance Criteria:

- A native adapter class exists, implements `NfcScanPort.scan()` exactly.
- `ScanScreen.tsx` triggers a real scan (not manual text entry) as its primary interaction.
- NFC-unavailable and NFC-disabled device states are surfaced distinctly rather than silently failing.
- No business/application logic (`AssignmentResolver`, `AssignmentValidator`, `BusinessEngine`, `WorkEventFactory`, `SynchronizationService`, `SessionService`, `NfcScanApplicationService`) is modified.
- `packages/core` gains no new dependency (the native library is `apps/mobile`-only, preserving ADR-0007's Domain Platform boundary).
- Physical-device validation is explicitly logged as an outstanding item, not silently assumed complete.

### Development Sprint 011 Implementation Notes

Status: Completed — Review Agent verified, Human Architect approved (2026-07-07), **physical-device validation still outstanding**. Mirroring the precedent set by DT-012 ("Completed... no simulator/device launch verification was performed during implementation") and reaffirmed by DT-006/DT-008/DT-014, the absence of real Android/NFC-tag hardware verification in this environment is an accurate, disclosed implementation note that no longer blocks Completed status once Review Agent verification and Human Architect approval are recorded — but it remains an outstanding item the Technical Lead/Human Architect must close with real device access before this task is considered functionally, not just structurally, proven (see Development Sprint 011 Closure, Section "Known Remaining Risks").

See `ADO/02_Development/Development_Sprint_011_Plan.md` for the full plan, including why this sprint targets real NFC hardware integration rather than Organization Management (Section 3: no Feature Blueprint exists for Organization Management yet; this repository has never once bypassed the mandatory Product Vision → Feature Blueprint → Technical Specification → Development Task order, and this task does not either).

**Library choice:** `react-native-nfc-manager` (`^3.17.2`), per the plan's own Section 2 evidence (already referenced by `Tech_Stack.md` as informing ADR-0007's platform baseline via the `frogs-zeiterfassung` reference project). It ships an Expo config plugin (`app.plugin.js`), added to `apps/mobile/app.json`'s `plugins` array, which adds the `android.permission.NFC` manifest permission and raises `compileSdkVersion` to 31+; no manual native-code editing was required.

**Implemented:** `RnNfcScanAdapter` (`apps/mobile/src/nfc/RnNfcScanAdapter.ts`) implements `NfcScanPort.scan()` exactly, unmodified from `packages/core/src/ports/NfcScanPort.ts`. Real NFC tag detection is inherently asynchronous (a physical tap can occur at any time), while the port's `scan()` method is synchronous; the adapter bridges the two exactly the way `CliNfcScanAdapter` already does for CLI input — `waitForNextTag()` (async) registers a native tag-discovery listener and buffers the normalized result; `scan()` (sync, satisfying the unmodified port) returns whatever is currently buffered. A separate, additional `checkCapability()` method (not part of `NfcScanPort`, exactly as `CliNfcScanAdapter.setInput()` is also additional-beyond-the-port) surfaces `NFC_Capability_Model.md`'s Required Failure States — `'not_supported'` and `'disabled'` — as narrowly-scoped capability states, not new `AssignmentResolver`/`AssignmentValidator` business rejection reasons; `ready` proceeds to `waitForNextTag()`. `ScanScreen.tsx` was extended (not rewritten): "Scan NFC Tag" is now the primary trigger, calling `checkCapability()` then `waitForNextTag()` and, on a captured result, `pipeline.scan(result.payload, caller)` — the exact same, unmodified composition-root call the placeholder already made. The manual text input, `Scan (manual)` button, and `Synchronize` button (DT-012/DT-014) are retained unchanged as a fallback/debug affordance, including their existing `testID`s. No change was made to `buildScanDemoPipeline`/`runScan.ts` — `apps/mobile` already supplies its own trigger via the screen, exactly as the plan's Section 8 anticipated, so no composition-root change was needed. `packages/core/package.json` gained no new dependency; `react-native-nfc-manager` is `apps/mobile`-only, preserving ADR-0007's Domain Platform boundary (verified: `git diff --stat -- packages/core/` is empty).

**Platform scope:** Android only, as scoped. `NFC_Capability_Model.md`'s own open question ("Is iOS NFC support in scope for v1?") is not resolved by this sprint and is not silently decided either way — the adapter's JS/TS code is not Android-exclusive at the type level (the library supports both platforms), but no iOS-specific testing, tuning, or product decision was made.

**Testing:** since `apps/mobile` had no test runner configured before this sprint (DT-012/DT-014 precedent: no component-testing framework existed), `vitest` (already used throughout `packages/core`, no new testing paradigm) was added to `apps/mobile` as a dev dependency, scoped to plain TypeScript logic tests only — no `jsdom`/React Native component rendering is exercised, so no `jest-expo`/`@testing-library/react-native` was needed. Unit tests cover `normalizeTag()`'s payload normalization (valid id, missing id, empty/whitespace id) and `RnNfcScanAdapter`'s capability-check branching (`not_supported`, `disabled`, `ready`) and its async-event-to-sync-`scan()` bridge (a test double simulates `react-native-nfc-manager`'s `DiscoverTag` event callback firing, proving `waitForNextTag()` resolves correctly and `scan()` reflects the buffered result afterward) and the `registerTagEvent()` failure path. 10 new tests, all passing; `packages/core`'s 154 pre-existing tests are unaffected (different workspace, no shared code changed).

**Verified in this environment (no physical Android device or NFC-capable simulator available — the same constraint documented since Development Sprint 006):** `npx tsc --noEmit` passes for both workspaces; `npx expo export --platform android` succeeds (666 modules, valid Hermes bytecode bundle) and `--platform ios` also still succeeds (668 modules, regression check) after adding the native dependency; `npx vitest run` passes (10/10) in `apps/mobile`; direct inspection (`git diff --stat -- packages/core/`) confirms zero changes to `packages/core`. **What could not be verified in this environment and remains an explicit outstanding item:** that a real NFC tag, on a real Android device, is actually detected, read, and produces the expected on-screen outcome — this requires physical hardware per ADR-0007's own Validation Requirements and must be performed by the Technical Lead/Human Architect (or Review Agent) with device access before this task is considered functionally proven, not just structurally correct.

**Explicitly out of scope, as planned:** Organization Management (no Feature Blueprint exists; tracked separately, not as a Development Sprint); NFC tag registration/provisioning (depends on the same not-yet-specified Organization/Customer management capability); iOS support (open product question, not decided); any change to `AssignmentResolver`, `AssignmentValidator`, `BusinessEngine`, `WorkEventFactory`, `SynchronizationService`, `SessionService`, `NfcScanApplicationService`, or the three DT-015 durable-persistence adapters (all confirmed unmodified).

**Known limitation, consistent with prior sprints' disclosure pattern:** `react-native-nfc-manager`'s peer dependency on `@expo/config-plugins` surfaces the same pre-existing moderate-severity `npm audit` findings already documented since Development Sprint 006 (Expo's own build-tooling transitive dependencies — `uuid`/`xcode`); not a new vulnerability class, not fixed (fixing would force a major Expo downgrade), same accepted-risk disposition as before.

Implementation: `apps/mobile/src/nfc/RnNfcScanAdapter.ts` (new), `apps/mobile/src/screens/ScanScreen.tsx` (extended), `apps/mobile/app.json` (plugin registration), `apps/mobile/package.json` (`react-native-nfc-manager`, `vitest` dependencies + `test` script), `apps/mobile/vitest.config.ts` (new). Tests: `apps/mobile/tests/nfc/normalizeTag.test.ts`, `RnNfcScanAdapter.test.ts`.

## Task Sequence — Organization Management Foundation (TS-002)

FB-002 and TS-002 have completed Technical Lead review. The following Development Tasks decompose TS-002 into the smallest safe, independently reviewable and testable implementation units, per the Technical Lead's explicit instruction to optimize for engineering quality rather than task count. Every task extends existing repository structure and reuses patterns already proven by DT-001–DT-016; none introduces an architectural redesign, and none touches `BusinessEngine`, `AssignmentResolver`, `AssignmentValidator`, `WorkEventFactory`, `NfcScanApplicationService`, `CallerContext`, `OfflineQueue`, `SynchronizationService`, or error handling — all confirmed unchanged by TS-002 itself.

```text
DT-017 Organization Domain & Repository
  -> DT-018 Membership Domain & Repository
  -> DT-019 Membership Authorization Validator
  -> DT-020 Customer Repository Write Extension       -\
  -> DT-021 NFC Tag Repository Write Extension          |-> (parallel, independent)
  -> DT-022 NFC Assignment Repository Write Extension -/
  -> DT-023 Organization Administration: Customer Registration (creates OrganizationAdministrationService)
  -> DT-024 Organization Administration: NFC Tag Registration (extends the same service, created by DT-023)
  -> DT-025 Organization Administration: NFC Tag Assignment (extends the same service, created by DT-023)
  -> DT-026 Existing Scan Pipeline Integration Verification
```

DT-020, DT-021 and DT-022 have no dependency on each other and have no dependency on DT-017–DT-019; they may be implemented and reviewed in any order. DT-023–DT-025 consume these write extensions and the MembershipAuthorizationValidator. DT-023, DT-024 and DT-025 are not independent, however: `OrganizationAdministrationService` is a single class, created by DT-023 and extended in place by DT-024 and DT-025, one method each — DT-024 and DT-025 must not be implemented as if creating their own instance of the service, and both depend on DT-023 for that reason (see each task's own Dependencies).

## DT-017 – Organization Domain & Repository

Objective: Introduce `Organization` as a real domain object (currently only `OrganizationId` exists), an `OrganizationRepository` port with an in-memory implementation, and an `OrganizationManagementService` that creates an Organization.

Repository Responsibility: Domain (`Organization` type) and Infrastructure (`OrganizationRepository` port + `InMemoryOrganizationRepository`) and Application (`OrganizationManagementService`) — three small, related additions bundled into one task because none is independently meaningful without the others, mirroring how DT-007 bundled a new domain type, a new port, a new adapter and a service extension into one Development Task.

Acceptance Criteria:

- `Organization` exists as a domain object: `OrganizationId` (existing, unchanged) plus a human-readable `name`. No `status` field (TS-002: not required by any Decision Logic; a pure additive follow-up if the Human Architect later requires one).
- `OrganizationRepository` port exists with `findById(id: OrganizationId): Organization | null` and a save/create method; `InMemoryOrganizationRepository` implements it, following the exact constructor-seeded pattern of `InMemoryCustomerRepository`.
- `OrganizationManagementService` constructs an `Organization` and calls `OrganizationRepository`'s save method, producing `OrganizationCreated` (new domain event, following the `WorkEventCreated`/`TimeEntryStarted` constructor-function idiom).
- Organization creation has no precondition beyond the request itself (TS-002 Decision 1) — a second, third, etc. Organization can always be created without depending on any other Organization's data.
- Unit tests cover: `InMemoryOrganizationRepository` (find/save round-trip, not-found case), `OrganizationManagementService` (produces `OrganizationCreated` with the correct fields).

Implementation Boundary (must not be touched): `Customer`, `NfcTag`, `NfcAssignment`, `AssignmentTarget`, `CallerContext`, any existing port, any existing repository, any existing Application Service, `BusinessEngine`, `AssignmentResolver`, `AssignmentValidator`, `WorkEventFactory`.

Testing Expectations: unit tests only, in isolation, no composition-level test yet (that is DT-026). No physical/device verification applicable.

Out of Scope: Organization status/suspension; Organization update or deletion; any UI or CLI entry point that calls `OrganizationManagementService` (a future Development Task or Mobile/CLI concern, not designed here); durable/file-backed `OrganizationRepository` implementation (may follow DT-015's precedent later, not required now).

Dependencies: TS-002 (Section "Domain Model", "Ports", "Application Services"), FB-002 (Capability 1). None on DT-001–DT-016 beyond the existing `ids.ts`/domain-event idiom they established.

Relationship to TS-002: Implements Capability 1's Domain Model (`Organization`), Ports (`OrganizationRepository`), and Application Services (`OrganizationManagementService`) sections exactly as specified; implements Sequence Diagram 1 (Organization Creation).

Relationship to FB-002: Implements Capability 1 (Organization) and Decision 1 (Create Organization) exactly as specified; satisfies the In Scope item "Organization existence as a real, addressable business container."

### Implementation Notes

Status: Completed — implemented during Development Sprint 012, Review Agent verified, Human Architect approved (see `ADO/02_Development/Development_Sprint_012_Closure.md`). Per DTP-001's Completion Rule, this status reflects verification and approval, not implementation alone.

Commit: `5be51b5`.

Implementation summary: `Organization` domain object added (`packages/core/src/domain/Organization.ts`) as `{ id: OrganizationId; name: string }` — no `status` field, exactly as scoped. `OrganizationCreated` domain event added (`packages/core/src/domain/events/OrganizationCreated.ts`) following the `WorkEventCreated` constructor-function idiom. `OrganizationRepository` port added (`packages/core/src/ports/OrganizationRepository.ts`) with `findById` and `save`. `InMemoryOrganizationRepository` added (`packages/core/src/infrastructure/repositories/InMemoryOrganizationRepository.ts`), following the exact constructor-seeded pattern of `InMemoryCustomerRepository`. `OrganizationManagementService` added (`packages/core/src/application/OrganizationManagementService.ts`) with a single `createOrganization(name)` method; no precondition beyond the request itself, matching TS-002 Decision 1; deterministic ID generation is injectable via an optional constructor parameter (`newOrganizationId`), mirroring `WorkEventFactory`/`BusinessEngine`'s established constructor pattern. All five additions are exported from `packages/core/src/index.ts` in the established grouped-barrel convention.

Test results: 10 new unit tests added — 5 in `packages/core/tests/infrastructure/InMemoryOrganizationRepository.test.ts` (not-found case, save-then-find round-trip, does-not-find-different-id, constructor-seeded, does-not-mutate-input-array) and 5 in `packages/core/tests/application/OrganizationManagementService.test.ts` (produces correct `OrganizationCreated` and repository state, calls save with the exact constructed `Organization`, deterministic with an injected generator, generates a unique id by default, no-precondition/duplicate-name-succeeds independently). `npm run test --workspace=@taptime/core`: 33 test files, 164 tests, all passing (up from 154 pre-Sprint-012). `npm run typecheck --workspace=@taptime/core`: clean, no errors.

Known limitations: none beyond what was deliberately left open by design — no UI/CLI entry point calling `OrganizationManagementService` (out of scope per this task's own Acceptance Criteria), no durable/file-backed `OrganizationRepository` implementation, no Organization status/suspension/update/deletion. Scope isolation independently verified: no changes to `apps/mobile`, `BusinessEngine`, `AssignmentResolver`, `AssignmentValidator`, `WorkEventFactory`, `NfcScanApplicationService`, `CallerContext`, `OfflineQueue`, or `SynchronizationService`; `Membership`, `MembershipAuthorizationValidator`, and `OrganizationAdministrationService` do not exist anywhere in the repository; `CustomerRepository`/`NfcTagRepository`/`NfcAssignmentRepository` remain read-only (no `save(` methods).

## DT-018 – Membership Domain & Repository

Objective: Introduce the Membership **domain/repository/service foundation only** — `Membership` and `MembershipRole` as real domain objects, a new `MembershipId` branded identifier, a `MembershipRepository` port with an in-memory implementation, and a `MembershipService` exposing a `grantMembership(...)` method. This task builds the mechanical capability to construct and save a Membership; it does not build, and must not be read as building, an authorized, admin-facing "grant a Membership" flow (see Out of Scope).

Repository Responsibility: Domain (`Membership`, `MembershipRole`, `MembershipId`) and Infrastructure (`MembershipRepository` port + `InMemoryMembershipRepository`) and Application (`MembershipService`) — same bundling rationale as DT-017.

Acceptance Criteria:

- `MembershipId` is added to `packages/core/src/domain/ids.ts` alongside the existing branded ID types, following the exact same `Brand<Value, BrandName>`/`brandedNonEmptyString` factory pattern.
- `Membership` exists as a domain object: its own `MembershipId`, `organizationId: OrganizationId`, `userId: UserId`, `role: MembershipRole` — carrying its own identity rather than only a compound key, following the precedent ADR-0002 already set for `NfcAssignment`.
- `MembershipRole` exists as a value, not an entity: `'administrator' | 'employee'`, mirroring the existing string-literal-union idiom already used for `AssignmentTarget.targetType`.
- `MembershipRepository` port exists with `findByUserId(userId: UserId): Membership | null` (one Membership per actor, per FB-002's single-membership assumption) and a save/create method; `InMemoryMembershipRepository` implements it.
- `MembershipService` constructs a `Membership` and calls `MembershipRepository`'s save method, producing `MembershipGranted`.
- Unit tests cover: `MembershipId` construction (including the existing empty/whitespace-string rejection behavior every other branded ID already has), `InMemoryMembershipRepository` (find/save round-trip, not-found case), `MembershipService` (produces `MembershipGranted` with the correct fields).

Implementation Boundary (must not be touched): everything DT-017 lists, plus DT-017's own `Organization`/`OrganizationRepository`/`OrganizationManagementService` (consumed, not modified).

Testing Expectations: unit tests only, in isolation.

Out of Scope: **the Membership-granting bootstrap question** (TS-002 Open Questions: how the very first Administrator Membership of a newly created Organization is authorized, when no prior Administrator Membership exists to authorize it) remains explicitly unresolved after this task — `MembershipService.grantMembership(...)` as built here performs no authorization check itself (DT-019 builds `MembershipAuthorizationValidator` as a separate, standalone component; no task in this package wires it in front of `MembershipService`). **Consequently, no admin-facing Membership-granting flow is implemented or ready for use after DT-018 (or after DT-019) — `MembershipService` alone is domain/repository/service foundation, callable only from tests or a future, not-yet-created orchestration, and must not be treated as a safe, authorized capability until the Human Architect resolves the bootstrap question and a task wiring `MembershipAuthorizationValidator` in front of it is planned.** This is a deliberately carried-forward gap, not a new Development Task added here, per instruction. Multi-organization membership (`findByUserId` returning more than one result) is out of scope, per FB-002 Open Question 2. Durable/file-backed `MembershipRepository` implementation is out of scope.

Dependencies: DT-017 (an Organization must exist for a Membership to reference).

Relationship to TS-002: Implements Capability 2's Domain Model (`Membership`, `MembershipRole`), Ports (`MembershipRepository`), and Application Services (`MembershipService`) sections; implements Sequence Diagram 2 (Membership Creation).

Relationship to FB-002: Implements Capability 2 (Membership) and Decision 2 (Create Membership); satisfies the In Scope items "Membership" and "Minimal Membership Roles: Administrator, Employee only."

### Implementation Notes

Status: Completed — implemented during Development Sprint 013, Review Agent verified, Human Architect approved (see `ADO/02_Development/Development_Sprint_013_Closure.md`). Per DTP-001's Completion Rule, this status reflects verification and approval, not implementation alone.

Commit: `b24144d`.

Implementation summary: `MembershipId` added to `packages/core/src/domain/ids.ts` via the file's existing `Brand<Value, BrandName>`/`brandedNonEmptyString` factory pattern. `MembershipRole` added (`packages/core/src/domain/MembershipRole.ts`) as `'administrator' | 'employee'`. `Membership` domain object added (`packages/core/src/domain/Membership.ts`) with its own `id: MembershipId`, `organizationId: OrganizationId`, `userId: UserId`, `role: MembershipRole`, following ADR-0002's `NfcAssignment` association-identity precedent. `MembershipGranted` domain event added (`packages/core/src/domain/events/MembershipGranted.ts`) following the `OrganizationCreated` constructor-function idiom. `MembershipRepository` port added (`packages/core/src/ports/MembershipRepository.ts`) with `findByUserId`/`save` only, no `findById`. `InMemoryMembershipRepository` added (`packages/core/src/infrastructure/repositories/InMemoryMembershipRepository.ts`), following `InMemoryOrganizationRepository`'s constructor-seeded pattern exactly. `MembershipService` added (`packages/core/src/application/MembershipService.ts`) with a single `grantMembership(organizationId, userId, role)` method; deterministic id generation is injectable via an optional constructor parameter (`newMembershipId`), mirroring `OrganizationManagementService`'s pattern. All new symbols are exported from `packages/core/src/index.ts` in the established grouped-barrel convention. Confirmed by dedicated tests: `MembershipService` performs no authorization check and applies no first-Administrator bootstrap special-case — both proven, not merely absent by omission.

Test results: 11 new unit tests added — 5 in `packages/core/tests/infrastructure/InMemoryMembershipRepository.test.ts` (not-found case, save-then-find-by-userId round-trip, does-not-find-under-a-different-userId, constructor-seeded, does-not-mutate-input-array) and 6 in `packages/core/tests/application/MembershipService.test.ts` (produces correct `MembershipGranted` and repository state, calls save with the exact constructed `Membership`, deterministic with an injected generator, generates a unique id by default, performs no authorization check, applies no bootstrap special-case); `packages/core/tests/domain/ids.test.ts` extended with `MembershipId` construction/rejection assertions inside its existing test cases (no new test-file-level count). `npm run test --workspace=@taptime/core`: 35 test files, 175 tests, all passing (up from 164 pre-Sprint-013). `npm run typecheck --workspace=@taptime/core`: clean, no errors.

Known limitations: none beyond what was deliberately left open by design — no UI/CLI entry point calling `MembershipService`, no authorization check (`MembershipAuthorizationValidator` is DT-019, not built here), no first-Administrator bootstrap resolution, no durable/file-backed `MembershipRepository` implementation, no multi-organization membership support. Scope isolation independently verified: `Organization`, `OrganizationRepository`, `InMemoryOrganizationRepository`, `OrganizationManagementService` (DT-017) confirmed byte-for-byte unchanged; no changes to `apps/mobile`, `BusinessEngine`, `AssignmentResolver`, `AssignmentValidator`, `WorkEventFactory`, `NfcScanApplicationService`, `CallerContext`, `OfflineQueue`, `SynchronizationService`, `AuthenticationGateway`, or `FakeAuthenticationGateway`; `MembershipAuthorizationValidator` and `OrganizationAdministrationService` do not exist anywhere in the repository; `CustomerRepository`/`NfcTagRepository`/`NfcAssignmentRepository` remain read-only (no `save(` methods).

## DT-019 – Membership Authorization Validator

Objective: Implement `MembershipAuthorizationValidator`, a new Business-area component structurally identical to the existing `AssignmentValidator` — pure, deterministic, no side effects — that evaluates whether a Membership may perform an administrative action against a target Organization.

Repository Responsibility: Business Engine responsibility area, directly alongside `AssignmentValidator`, per TS-002's explicit placement decision (this is a Business Rule, not an Application-layer concern).

Acceptance Criteria:

- `MembershipAuthorizationValidator` takes a `Membership` (or its absence) and a target `OrganizationId` and returns an accepted/rejected result, mirroring `AssignmentValidationResult`'s `{ status: 'accepted' | 'rejected', reason? }` shape exactly.
- Rejection reasons, exactly as TS-002 specifies: `membership_not_found` (no Membership exists for the actor), `membership_lacks_administrator_role` (Membership exists but carries the Employee role), `cross_organization_access` (Membership's Organization differs from the target Organization).
- The component has no side effects and no dependency on any repository directly inside its own decision logic (the Membership is passed in, exactly as `AssignmentValidator.validate()` receives its inputs already resolved) — consistent with "Application Orchestrates But Does Not Interpret" and the equal-and-opposite rule that Business components decide without performing I/O themselves.
- Unit tests cover: accepted case (Administrator Membership, matching Organization); each of the three rejection reasons independently.

Implementation Boundary (must not be touched): `AssignmentValidator` itself is not modified in any way — `MembershipAuthorizationValidator` is a new, separate, structurally analogous class, not an extension of `AssignmentValidator`. No Application Service is built or modified by this task.

Testing Expectations: unit tests only, in isolation, following `AssignmentValidator.test.ts`'s existing structure (one test per acceptance/rejection branch).

Out of Scope: any caller of this validator (DT-023–DT-025's responsibility for Customer/NfcTag/NfcAssignment administration; no task in this package wires it in front of `MembershipService.grantMembership(...)`, so it does not resolve DT-018's Membership-granting bootstrap question either — this task creates the validator component only, it does not decide who may grant a Membership); any change to `AssignmentValidator`'s own `employee_lacks_organization_access`/`missing_assignment_target`/`assignment_target_disabled` behavior, which remains exactly as-is per TS-002 Decision 7.

Dependencies: DT-018 (`Membership`/`MembershipRole` domain objects must exist).

Relationship to TS-002: Implements the "New Business-Area Component" section exactly; the shared precondition for Sequence Diagrams 2–5.

Relationship to FB-002: Implements Decision 6 (Evaluate Whether an Actor May Perform an Administrative Action) and the Business Rule "Only a Membership with the Administrator Role may create or assign Organization-owned pilot data."

### Implementation Notes

Status: Completed — implemented during Development Sprint 014, Review Agent verified, Human Architect approved (see `ADO/02_Development/Development_Sprint_014_Closure.md`). Per DTP-001's Completion Rule, this status reflects verification and approval, not implementation alone.

Commit: `874ecaf`.

Implementation summary: `MembershipAuthorizationResult` added (`packages/core/src/business/MembershipAuthorizationResult.ts`) as a discriminated union mirroring `AssignmentValidationResult`'s `{ status: 'accepted' | 'rejected', reason? }` shape, with `MembershipAuthorizationRejectionReason` restricted to `membership_not_found` | `membership_lacks_administrator_role` | `cross_organization_access`. `MembershipAuthorizationValidator` added (`packages/core/src/business/MembershipAuthorizationValidator.ts`) as a class exposing a single `authorize(membership: Membership | null, organizationId: OrganizationId): MembershipAuthorizationResult` method; decision order: `null` Membership → `membership_not_found`; non-administrator role → `membership_lacks_administrator_role`; `organizationId` mismatch → `cross_organization_access`; otherwise → accepted. Deliberately, and per this task's own Acceptance Criteria, the class takes no constructor dependency on any repository — a disclosed divergence from `AssignmentValidator`'s constructor-injected-`CustomerRepository` shape, since its inputs are passed in already resolved by a future caller. Both symbols are exported from `packages/core/src/index.ts` in the established grouped-barrel convention, alongside `AssignmentValidator`/`AssignmentValidationResult`.

Test results: 6 new unit tests added in `packages/core/tests/business/MembershipAuthorizationValidator.test.ts` — the accepted case (Administrator Membership, matching Organization), each of the three required rejection branches independently, plus two tests beyond the minimum bar (purity/determinism; no first-Administrator bootstrap special-casing). `npm run test --workspace=@taptime/core`: 36 test files, 181 tests, all passing (up from 175 pre-Sprint-014). `npm run typecheck --workspace=@taptime/core`: clean, no errors.

Known limitations: none beyond what was deliberately left open by design — `MembershipAuthorizationValidator` has no caller anywhere in the repository (not wired into `MembershipService` or any Application Service, per this task's own Out of Scope); the first-Administrator bootstrap question remains unresolved; no admin-facing Membership-granting flow exists. Scope isolation independently verified: `AssignmentValidator`, `MembershipService`, `OrganizationManagementService` confirmed byte-for-byte unchanged; no changes to `apps/mobile`, `AssignmentResolver`, `WorkEventFactory`, `BusinessEngine`, `NfcScanApplicationService`, `CallerContext`, `OfflineQueue`, `SynchronizationService`, `AuthenticationGateway`, or `FakeAuthenticationGateway`; `OrganizationAdministrationService` does not exist anywhere in the repository; `CustomerRepository`/`NfcTagRepository`/`NfcAssignmentRepository` remain read-only (no `save(` methods).

## DT-020 – Customer Repository Write Extension

Objective: Extend the existing `CustomerRepository` port with one additive save/create method, update `InMemoryCustomerRepository` accordingly, and introduce the `CustomerCreated` domain event.

Repository Responsibility: Infrastructure (port extension + adapter update) and Domain (new event). No Application Service is built by this task (DT-023 consumes it).

Acceptance Criteria:

- `CustomerRepository` gains one new method (create/save a `Customer`); `findById` is unchanged, byte-for-byte, and its existing tests continue to pass unmodified.
- `InMemoryCustomerRepository` implements the new method, consistent with its existing constructor-seeded-array pattern.
- `CustomerCreated` domain event exists, carrying the created `Customer`, following the `WorkEventCreated` idiom exactly.
- A dedicated test proves the new save method and `findById` compose correctly (save then find-by-id returns the saved Customer).
- `AssignmentValidator`'s existing `CustomerRepository.findById` usage is verified unchanged and its existing tests pass without modification.

Implementation Boundary (must not be touched): `Customer`'s shape (no field added, removed or renamed); `AssignmentValidator`; any other repository.

Testing Expectations: unit tests only, in isolation; explicit non-regression check that `AssignmentValidator.test.ts` requires no changes.

Out of Scope: any authorization check on who may call the new save method (DT-023's responsibility); Customer update/deactivation; durable/file-backed implementation.

Dependencies: None beyond existing repository code. Independent of DT-017/DT-018/DT-019 (may be implemented in parallel).

Relationship to TS-002: Implements the "Extended Existing Ports" (`CustomerRepository`) and part of the "Business Events" sections.

Relationship to FB-002: Implements part of Capability 3 (Business Assets) and Decision 3's write path (Create Customer / AssignmentTarget).

### Implementation Notes

Status: Completed — implemented during Development Sprint 015, Review Agent verified, Human Architect approved (see `ADO/02_Development/Development_Sprint_015_Closure.md`). Per DTP-001's Completion Rule, this status reflects verification and approval, not implementation alone.

Commit: `7db5ade`.

Implementation summary: `CustomerRepository` (`packages/core/src/ports/CustomerRepository.ts`) extended with `save(customer: Customer): void`; `findById` unchanged, byte-for-byte. `InMemoryCustomerRepository` (`packages/core/src/infrastructure/repositories/InMemoryCustomerRepository.ts`) implements `save` as a single `.push(customer)` onto its internal array, and its constructor was upgraded from a bare-reference assignment to the defensive-copy pattern (`this.customers = [...customers]`), matching `InMemoryOrganizationRepository`/`InMemoryMembershipRepository`. `CustomerCreated` (`packages/core/src/domain/events/CustomerCreated.ts`) added as a `{ type: 'CustomerCreated', customer: Customer }` interface plus a `customerCreated(customer)` constructor function, following the `WorkEventCreated` idiom exactly. Registered in `packages/core/src/index.ts`'s existing `domain/events/` grouped export section.

Test results: 5 new unit tests added in `packages/core/tests/infrastructure/InMemoryCustomerRepository.test.ts` — not-found baseline, save-then-`findById` round-trip, "does not find under a different id," constructor-seeded lookup, and no-mutation-of-constructor-input. `npm run test --workspace=@taptime/core`: 39 test files, 197 tests, all passing (up from 181 pre-Sprint-015). `npm run typecheck --workspace=@taptime/core`: clean, no errors. `AssignmentValidator.test.ts` (5 tests) re-run and confirmed passing with zero modification; `git diff` against the pre-Sprint-015 commit confirms `AssignmentValidator.ts` and its test file are byte-for-byte unchanged.

Known limitations: none beyond what was deliberately left open by design — `CustomerRepository.save` has no caller anywhere in the repository (not wired into any Application Service, per this task's own Out of Scope); no authorization check exists on who may call it (DT-023's responsibility); `Customer` update/deactivation remains unimplemented; only an in-memory adapter exists, no durable/file-backed implementation. Scope isolation independently verified: `Customer`'s shape, `AssignmentValidator`, `AssignmentResolver`, `MembershipService`, `OrganizationManagementService`, `MembershipAuthorizationValidator` all confirmed byte-for-byte unchanged; no changes to `apps/mobile`; `OrganizationAdministrationService` does not exist anywhere in the repository.

## DT-021 – NFC Tag Repository Write Extension

Objective: Extend the existing `NfcTagRepository` port with one additive save/create (registration) method, update `InMemoryNfcTagRepository` accordingly, and introduce the `NfcTagRegistered` domain event.

Repository Responsibility: Infrastructure (port extension + adapter update) and Domain (new event).

Acceptance Criteria:

- `NfcTagRepository` gains one new method (register/save an `NfcTag`); `findByPayload` is unchanged, byte-for-byte, and its existing tests continue to pass unmodified.
- `InMemoryNfcTagRepository` implements the new method.
- `NfcTagRegistered` domain event exists, carrying the registered `NfcTag`.
- A dedicated test proves the new save method and `findByPayload` compose correctly (register then find-by-payload returns the registered tag).
- `AssignmentResolver`'s existing `NfcTagRepository.findByPayload` usage is verified unchanged and its existing tests pass without modification.

Implementation Boundary (must not be touched): `NfcTag`'s shape; `AssignmentResolver`; any other repository.

Testing Expectations: unit tests only, in isolation; explicit non-regression check that `AssignmentResolver.test.ts` requires no changes.

Out of Scope: any authorization check (DT-024's responsibility); tag deactivation/retirement; any physical tag-provisioning workflow (`NFC_Capability_Model.md`'s own open question, "Do we need tag provisioning inside the app?" — not resolved here, per FB-002 Open Question 7); durable/file-backed implementation.

Dependencies: None beyond existing repository code. Independent of DT-017/DT-018/DT-019/DT-020/DT-022.

Relationship to TS-002: Implements the "Extended Existing Ports" (`NfcTagRepository`) and part of the "Business Events" sections.

Relationship to FB-002: Implements part of Capability 3 (Business Assets) and Decision 4's write path (Register NFC Tag).

### Implementation Notes

Status: Completed — implemented during Development Sprint 015, Review Agent verified, Human Architect approved (see `ADO/02_Development/Development_Sprint_015_Closure.md`). Per DTP-001's Completion Rule, this status reflects verification and approval, not implementation alone.

Commit: `7db5ade`.

Implementation summary: `NfcTagRepository` (`packages/core/src/ports/NfcTagRepository.ts`) extended with `register(nfcTag: NfcTag): void`; `findByPayload` unchanged, byte-for-byte. `InMemoryNfcTagRepository` (`packages/core/src/infrastructure/repositories/InMemoryNfcTagRepository.ts`) implements `register` as a single `.push(nfcTag)`, and its constructor was upgraded to the same defensive-copy pattern as `InMemoryCustomerRepository`. `NfcTagRegistered` (`packages/core/src/domain/events/NfcTagRegistered.ts`) added as a `{ type: 'NfcTagRegistered', nfcTag: NfcTag }` interface plus an `nfcTagRegistered(nfcTag)` constructor function. Registered in `packages/core/src/index.ts`'s existing `domain/events/` grouped export section.

Test results: 5 new unit tests added in `packages/core/tests/infrastructure/InMemoryNfcTagRepository.test.ts` — not-found baseline, register-then-`findByPayload` round-trip, "does not find under a different payload," constructor-seeded lookup, and no-mutation-of-constructor-input. `npm run test --workspace=@taptime/core`: 39 test files, 197 tests, all passing. `npm run typecheck --workspace=@taptime/core`: clean. `AssignmentResolver.test.ts` (5 tests) re-run and confirmed passing with zero modification; `git diff` against the pre-Sprint-015 commit confirms `AssignmentResolver.ts` and its test file are byte-for-byte unchanged.

Known limitations: none beyond what was deliberately left open by design — `NfcTagRepository.register` has no caller anywhere in the repository; no authorization check exists on who may call it (DT-024's responsibility); tag deactivation/retirement and any physical tag-provisioning workflow remain unimplemented (FB-002 Open Question 7, unresolved); only an in-memory adapter exists. Scope isolation independently verified: `NfcTag`'s shape, `AssignmentResolver`, `AssignmentValidator`, `MembershipService`, `OrganizationManagementService`, `MembershipAuthorizationValidator` all confirmed byte-for-byte unchanged; no changes to `apps/mobile`; `OrganizationAdministrationService` does not exist anywhere in the repository.

## DT-022 – NFC Assignment Repository Write Extension

Objective: Extend the existing `NfcAssignmentRepository` port with one additive save/create method, update `InMemoryNfcAssignmentRepository` accordingly, and introduce the `NfcTagAssigned` domain event.

Repository Responsibility: Infrastructure (port extension + adapter update) and Domain (new event).

Acceptance Criteria:

- `NfcAssignmentRepository` gains one new method (create/save an `NfcAssignment`); `findActiveByTagId` is unchanged, byte-for-byte, and its existing tests continue to pass unmodified.
- `InMemoryNfcAssignmentRepository` implements the new method.
- `NfcTagAssigned` domain event exists, carrying the created `NfcAssignment`.
- A dedicated test proves the new save method and `findActiveByTagId` compose correctly (create an active assignment, then find-active-by-tag-id returns it).
- `AssignmentResolver`'s existing `NfcAssignmentRepository.findActiveByTagId` usage is verified unchanged and its existing tests pass without modification.

Implementation Boundary (must not be touched): `NfcAssignment`'s shape; `AssignmentTarget`'s shape; `AssignmentResolver`; any other repository.

Testing Expectations: unit tests only, in isolation; explicit non-regression check that `AssignmentResolver.test.ts` requires no changes.

Out of Scope: any authorization or same-organization cross-check (DT-025's responsibility); re-assignment/assignment history semantics (FB-002 Open Question 3, not resolved here); durable/file-backed implementation.

Dependencies: None beyond existing repository code. Independent of DT-017/DT-018/DT-019/DT-020/DT-021.

Relationship to TS-002: Implements the "Extended Existing Ports" (`NfcAssignmentRepository`) and part of the "Business Events" sections.

Relationship to FB-002: Implements part of Capability 3 (Business Assets) and Decision 5's write path (Assign NFC Tag).

### Implementation Notes

Status: Completed — implemented during Development Sprint 015, Review Agent verified, Human Architect approved (see `ADO/02_Development/Development_Sprint_015_Closure.md`). Per DTP-001's Completion Rule, this status reflects verification and approval, not implementation alone.

Commit: `7db5ade`.

Implementation summary: `NfcAssignmentRepository` (`packages/core/src/ports/NfcAssignmentRepository.ts`) extended with `save(nfcAssignment: NfcAssignment): void`; `findActiveByTagId` unchanged, byte-for-byte. `InMemoryNfcAssignmentRepository` (`packages/core/src/infrastructure/repositories/InMemoryNfcAssignmentRepository.ts`) implements `save` as a single `.push(nfcAssignment)`, and its constructor was upgraded to the same defensive-copy pattern. `NfcTagAssigned` (`packages/core/src/domain/events/NfcTagAssigned.ts`) added as a `{ type: 'NfcTagAssigned', nfcAssignment: NfcAssignment }` interface plus an `nfcTagAssigned(nfcAssignment)` constructor function. Registered in `packages/core/src/index.ts`'s existing `domain/events/` grouped export section.

Test results: 6 new unit tests added in `packages/core/tests/infrastructure/InMemoryNfcAssignmentRepository.test.ts` — not-found baseline, save-active-then-`findActiveByTagId` round-trip, "does not return an inactive assignment" (explicit non-regression proof of pre-existing behavior), "does not find under a different tag id," constructor-seeded lookup, and no-mutation-of-constructor-input. `npm run test --workspace=@taptime/core`: 39 test files, 197 tests, all passing. `npm run typecheck --workspace=@taptime/core`: clean. `AssignmentResolver.test.ts` (5 tests) re-run and confirmed passing with zero modification; `git diff` against the pre-Sprint-015 commit confirms `AssignmentResolver.ts` and its test file are byte-for-byte unchanged.

Known limitations: none beyond what was deliberately left open by design — `NfcAssignmentRepository.save` has no caller anywhere in the repository; no authorization or same-Organization cross-check exists (DT-025's responsibility); re-assignment/assignment history semantics (FB-002 Open Question 3) remain unresolved — `save` accepts and stores whatever `NfcAssignment` it is given, with no uniqueness enforcement; only an in-memory adapter exists. Scope isolation independently verified: `NfcAssignment`'s shape, `AssignmentTarget`'s shape, `AssignmentResolver`, `AssignmentValidator`, `MembershipService`, `OrganizationManagementService`, `MembershipAuthorizationValidator` all confirmed byte-for-byte unchanged; no changes to `apps/mobile`; `OrganizationAdministrationService` does not exist anywhere in the repository.

## DT-023 – Organization Administration: Customer Registration

Objective: Create `OrganizationAdministrationService` (TS-002's single Application Service for Capability 4) with its first method, `createCustomer(...)`, orchestrating `MembershipAuthorizationValidator` and the DT-020 write path to let an Administrator Membership create a Customer within their own Organization. **This task creates the `OrganizationAdministrationService` class itself; DT-024 and DT-025 extend this same class with their own methods — neither DT-024 nor DT-025 creates a separate or second instance of this service.**

Repository Responsibility: Application (orchestration only — no business rule owned directly, per `NfcScanApplicationService`'s existing "orchestrates but does not interpret" boundary).

Acceptance Criteria:

- `OrganizationAdministrationService.createCustomer(...)` calls `MembershipAuthorizationValidator` first; on rejection, returns the rejection reason and performs no write.
- On acceptance, constructs a `Customer` (`organizationId` taken from the requesting Membership's Organization, per TS-002 Decision 3) and calls `CustomerRepository`'s new save method, producing `CustomerCreated`.
- An Employee Membership attempting this method is rejected with `membership_lacks_administrator_role`; an Administrator Membership of a different Organization is rejected with `cross_organization_access`.
- Unit tests cover: accepted path (Customer created, event produced); each rejection path, verifying no write occurs on rejection.

Implementation Boundary (must not be touched): `MembershipAuthorizationValidator` (consumed, not modified); `CustomerRepository` (consumed, not modified beyond DT-020); any FB-001 pipeline component.

Testing Expectations: unit tests, including a test double or in-memory `MembershipAuthorizationValidator`/`CustomerRepository` combination proving the full orchestration; no composition-level pipeline test yet (DT-026).

Out of Scope: any UI or CLI entry point calling this service; Customer field validation beyond what `Customer`'s existing shape already requires.

Dependencies: DT-019 (`MembershipAuthorizationValidator`), DT-020 (`CustomerRepository` write path).

Relationship to TS-002: Implements Capability 4's `createCustomer` method and Sequence Diagram 3 (Customer Registration) exactly.

Relationship to FB-002: Implements Decision 3 (Create Customer / AssignmentTarget) and the Business Rule "Only a Membership with the Administrator Role may create or assign Organization-owned pilot data."

### Implementation Notes

Status: Completed — implemented during Development Sprint 016, Review Agent verified, Human Architect approved (see `ADO/02_Development/Development_Sprint_016_Closure.md`). Per DTP-001's Completion Rule, this status reflects verification and approval, not implementation alone.

Commit: `5f95573`.

Implementation summary: `OrganizationAdministrationService` added (`packages/core/src/application/OrganizationAdministrationService.ts`) with exactly one method, `createCustomer(membership: Membership | null, organizationId: OrganizationId): CreateCustomerResult`. Constructor takes `MembershipAuthorizationValidator`, `CustomerRepository`, and an injectable `newCustomerId: () => CustomerId = () => CustomerId(generateId())`, mirroring `OrganizationManagementService`'s/`MembershipService`'s established pattern. `createCustomer(...)` calls `authorize(membership, organizationId)` first; on rejection, returns the `RejectedMembershipAuthorizationResult` unchanged, with no `Customer` construction and no `CustomerRepository.save` call; on acceptance, constructs a `Customer` (`organizationId` sourced from the accepted Membership's own `organizationId`, per TS-002 Decision 3), calls `CustomerRepository.save`, and returns `{ status: 'accepted', customer, event: customerCreated(customer) }`. `CreateCustomerResult` (co-located in the same file) is `{ status: 'accepted', customer, event } | RejectedMembershipAuthorizationResult` — reusing `RejectedMembershipAuthorizationResult` verbatim for every rejection rather than inventing a new category, following TS-002 Sequence Diagram 3's own rejection-reason list exactly. Exported from `packages/core/src/index.ts` in the established grouped-barrel convention, alongside `OrganizationManagementService`/`MembershipService`.

Test results: 6 new unit tests added in `packages/core/tests/application/OrganizationAdministrationService.test.ts` — the accepted path (result shape and repository round-trip); a spy-based test confirming `CustomerRepository.save` is called exactly once with the constructed `Customer`; each of the three required rejection branches independently (`membership_not_found`, `membership_lacks_administrator_role`, `cross_organization_access`), each with its own no-write assertion; and a sixth test proving, via a single consolidated spy assertion, that `CustomerRepository.save` is never called across all three rejection scenarios. `npm run test --workspace=@taptime/core`: 40 test files, 203 tests, all passing (up from 197 pre-Sprint-016). `npm run typecheck --workspace=@taptime/core`: clean, no errors. `npm run typecheck --workspace=apps/mobile`: clean. `npm run test --workspace=apps/mobile`: 10/10 passing (unaffected).

Known limitations: none beyond what was deliberately left open by design — `OrganizationAdministrationService.createCustomer(...)` has no caller anywhere in the repository outside its own test file (no UI, CLI, or mobile entry point calls it, per this task's own Out of Scope); `registerNfcTag(...)`/`assignNfcTag(...)` (DT-024/DT-025) do not exist yet; no authorization beyond `MembershipAuthorizationValidator`'s own three rejection reasons; no Customer field validation beyond the existing `Customer` shape. Scope isolation independently verified: `MembershipAuthorizationValidator`, `MembershipAuthorizationResult`, `Membership`, `MembershipRole`, `Customer`, `CustomerCreated`, `CustomerRepository`, `InMemoryCustomerRepository`, `OrganizationManagementService`, `MembershipService`, `AssignmentResolver`, `AssignmentValidator` all confirmed byte-for-byte unchanged (and all of their test files); no changes to `apps/mobile`, `NfcTagRepository`, `NfcAssignmentRepository`, `BusinessEngine`, `WorkEventFactory`, `NfcScanApplicationService`, `CallerContext`, `OfflineQueue`, `SynchronizationService`, or error handling; no `registerNfcTag(`/`assignNfcTag(` occurrence anywhere in `packages/core/src`.

## DT-024 – Organization Administration: NFC Tag Registration

Objective: Extend `OrganizationAdministrationService` — **created by DT-023, not created again here** — with a second method, `registerNfcTag(...)`, orchestrating `MembershipAuthorizationValidator` and the DT-021 write path to let an Administrator Membership register an NFC Tag within their own Organization.

Repository Responsibility: Application (orchestration only), same boundary as DT-023.

Acceptance Criteria:

- `OrganizationAdministrationService.registerNfcTag(...)` calls `MembershipAuthorizationValidator` first; on rejection, returns the rejection reason and performs no write.
- On acceptance, constructs an `NfcTag` (`organizationId` taken from the requesting Membership's Organization) and calls `NfcTagRepository`'s new save method, producing `NfcTagRegistered`.
- Same rejection-path coverage as DT-023, applied to tag registration.
- Unit tests cover: accepted path; each rejection path, verifying no write occurs on rejection.

Implementation Boundary (must not be touched): `MembershipAuthorizationValidator`; `NfcTagRepository` (beyond DT-021); any FB-001 pipeline component.

Testing Expectations: unit tests, same structure as DT-023.

Out of Scope: any UI or CLI entry point; any physical tag-provisioning workflow (same exclusion as DT-021); duplicate-payload handling across Organizations (FB-002 Open Question 5, not resolved here).

Dependencies: DT-023 (`OrganizationAdministrationService` must already exist as a class before this task can add a method to it), DT-019 (`MembershipAuthorizationValidator`), DT-021 (`NfcTagRepository` write path).

Relationship to TS-002: Implements Capability 4's `registerNfcTag` method and Sequence Diagram 4 (NFC Tag Registration) exactly.

Relationship to FB-002: Implements Decision 4 (Register NFC Tag) and the same Business Rule as DT-023.

### Implementation Notes

Status: Completed — Review Agent verified, Human Architect approved (2026-07-09). Implemented and committed (`eee9151`, Development Sprint 017).

Implementation summary: `OrganizationAdministrationService` extended (`packages/core/src/application/OrganizationAdministrationService.ts`) with a second method, `registerNfcTag(membership: Membership | null, organizationId: OrganizationId, payload: NfcPayload): RegisterNfcTagResult`. The constructor gains a third required dependency, `NfcTagRepository`, positioned before both existing defaulted id generators: `(membershipAuthorizationValidator, customerRepository, nfcTagRepository, newCustomerId = default, newNfcTagId = default)`. `registerNfcTag(...)` calls `authorize(membership, organizationId)` first; on rejection, returns the `RejectedMembershipAuthorizationResult` unchanged, with no `NfcTag` construction and no `NfcTagRepository.register` call; on acceptance, constructs an `NfcTag` (`organizationId` sourced from the accepted Membership's own `organizationId`, per TS-002 Sequence Diagram 4; `payload` taken from the already-normalized `NfcPayload` argument, unchanged), calls `NfcTagRepository.register`, and returns `{ status: 'accepted', nfcTag, event: nfcTagRegistered(nfcTag) }`. `RegisterNfcTagResult` (co-located in the same file) is `{ status: 'accepted', nfcTag, event } | RejectedMembershipAuthorizationResult` — reusing `RejectedMembershipAuthorizationResult` verbatim, the same design DT-023 established, now traced to TS-002 Sequence Diagram 4. No new `index.ts` export line was needed; `OrganizationAdministrationService` was already exported in full as a class by DT-023.

**Disclosed mid-sprint correction:** the first implementation pass positioned the new `nfcTagRepository` constructor parameter after the already-existing defaulted `newCustomerId` parameter — a signature TypeScript accepts without a declaration-site error, but one that silently broke the constructor's required positional arity for the six pre-existing `createCustomer` tests (which called it with only 3 positional arguments). This was undetected by `npm run typecheck` (`packages/core/tsconfig.json`'s `"include": ["src"]` does not cover `tests/`) and undetected by `npm run test` (Vitest's esbuild transpilation does not type-check), producing a false-green result. An independent Review Agent reproduced the defect directly using a temporary tests-inclusive `tsc --noEmit` run, surfacing exactly six `TS2554` errors, and a corrective Development Agent Prompt specified reordering the constructor (all required dependencies before all defaulted id generators, matching `OrganizationManagementService`'s/`MembershipService`'s existing idiom) plus updating the six affected test call sites with a throwaway `InMemoryNfcTagRepository` argument and zero assertion change. The corrected order is present in commit `eee9151`, independently re-verified at governance closure using the same tests-inclusive `tsc --noEmit` technique, confirming zero errors remain in `OrganizationAdministrationService.test.ts`.

Test results: `packages/core/tests/application/OrganizationAdministrationService.test.ts` extended to 13 tests total — the 6 pre-existing `createCustomer` tests (constructor call sites updated for the new required argument, zero assertion changed) plus 7 new `registerNfcTag` tests: the accepted path (result shape and repository round-trip); a spy-based test confirming `NfcTagRepository.register` is called exactly once with the constructed `NfcTag`; each of the three required rejection branches independently (`membership_not_found`, `membership_lacks_administrator_role`, `cross_organization_access`), each with its own no-write assertion; a consolidated spy assertion proving `NfcTagRepository.register` is never called across all three rejection scenarios; and a deterministic-`NfcTagId`-generation test using an injected fixed generator. `npm run test --workspace=@taptime/core`: 40 test files, 210 tests, all passing (up from 203 pre-Sprint-017). `npm run typecheck --workspace=@taptime/core`: clean, no errors. A supplementary, out-of-band tests-inclusive `tsc --noEmit` run (temporary tsconfig, deleted after use) independently confirms zero type errors remain in this test file. `npm run typecheck --workspace=apps/mobile`: clean. `npm run test --workspace=apps/mobile`: 10/10 passing (unaffected).

Known limitations: none beyond what was deliberately left open by design — `OrganizationAdministrationService.registerNfcTag(...)` has no caller anywhere in the repository outside its own test file (no UI, CLI, or mobile entry point calls it, per this task's own Out of Scope); `assignNfcTag(...)` (DT-025) does not exist yet; no re-normalization or re-validation of the `NfcPayload` argument is performed, per this task's Implementation Boundary; duplicate-payload handling across Organizations remains unresolved (FB-002 Open Question 5). Scope isolation independently verified: `MembershipAuthorizationValidator`, `MembershipAuthorizationResult`, `Membership`, `NfcTag`, `NfcPayload`, `NfcTagRegistered`, `NfcTagRepository`, `InMemoryNfcTagRepository`, `CustomerRepository`, `InMemoryCustomerRepository`, `AssignmentResolver`, `AssignmentValidator` all confirmed byte-for-byte unchanged (and all of their test files); no changes to `apps/mobile`, `NfcAssignmentRepository`, `BusinessEngine`, `WorkEventFactory`, `NfcScanApplicationService`, `CallerContext`, `OfflineQueue`, `SynchronizationService`, or error handling; no `assignNfcTag(` occurrence anywhere in `packages/core/src`. A separate, disclosed, out-of-scope repository-hygiene finding: `packages/core/tsconfig.json`'s `"include": ["src"]` leaves `tests/` outside `npm run typecheck`'s coverage — the same condition that let this sprint's constructor-arity regression through initially — not resolved by this task, carried forward for future Technical Lead disposition.

## DT-025 – Organization Administration: NFC Tag Assignment

Objective: Extend `OrganizationAdministrationService` — **created by DT-023, not created again here** — with a third method, `assignNfcTag(...)`, orchestrating `MembershipAuthorizationValidator`, a same-Organization cross-check between the NfcTag and the AssignmentTarget, and the DT-022 write path.

Repository Responsibility: Application (orchestration only), same boundary as DT-023/DT-024.

Acceptance Criteria:

- `OrganizationAdministrationService.assignNfcTag(...)` calls `MembershipAuthorizationValidator` first; on rejection, returns the rejection reason and performs no write.
- On acceptance, additionally verifies the target `NfcTag` and `AssignmentTarget` both belong to the same Organization as the requesting Membership (TS-002 Decision 5) — mirroring `AssignmentValidator`'s existing cross-check pattern; a mismatch is rejected with `cross_organization_access` without a write.
- On full acceptance, constructs an `NfcAssignment` and calls `NfcAssignmentRepository`'s new save method, producing `NfcTagAssigned`.
- Unit tests cover: accepted path; `MembershipAuthorizationValidator` rejection paths; the additional same-Organization Tag/Target mismatch rejection, verifying no write occurs on any rejection.

Implementation Boundary (must not be touched): `MembershipAuthorizationValidator`; `NfcAssignmentRepository` (beyond DT-022); `AssignmentTarget`'s shape; any FB-001 pipeline component.

Testing Expectations: unit tests, same structure as DT-023/DT-024, plus the additional cross-check case.

Out of Scope: any UI or CLI entry point; re-assignment of an already-assigned tag (FB-002 Open Question 3, not resolved here — this task creates a new assignment only, it does not define re-assignment semantics).

Dependencies: DT-023 (`OrganizationAdministrationService` must already exist as a class before this task can add a method to it — and a Customer/AssignmentTarget must exist, via `createCustomer`, to assign a tag to), DT-024 (`OrganizationAdministrationService` must already have `registerNfcTag` — and the NfcTag must actually be registered before it can be assigned), DT-019 (`MembershipAuthorizationValidator`), DT-022 (`NfcAssignmentRepository` write path).

Relationship to TS-002: Implements Capability 4's `assignNfcTag` method and Sequence Diagram 5 (NFC Tag Assignment) exactly.

Relationship to FB-002: Implements Decision 5 (Assign NFC Tag) and the Business Rule "A Tag may be assigned only to an AssignmentTarget in the same Organization."

### Implementation Notes

Status: Completed — Review Agent verified, Human Architect approved (2026-07-09). Implemented and committed (`2c9cdab`, Development Sprint 018).

Implementation summary: `OrganizationAdministrationService` extended (`packages/core/src/application/OrganizationAdministrationService.ts`) with a third and final method, `assignNfcTag(membership: Membership | null, organizationId: OrganizationId, nfcTag: NfcTag, target: AssignmentTarget): AssignNfcTagResult`. The constructor gains a fourth required dependency, `NfcAssignmentRepository`, positioned before all three defaulted id generators: `(membershipAuthorizationValidator, customerRepository, nfcTagRepository, nfcAssignmentRepository, newCustomerId = default, newNfcTagId = default, newNfcAssignmentId = default)`. `assignNfcTag(...)` calls `authorize(membership, organizationId)` first; on rejection, returns the `RejectedMembershipAuthorizationResult` unchanged, with no further check and no write. On acceptance, it performs two same-Organization checks before any write: it compares the supplied `nfcTag.organizationId` directly against the accepted Membership's own `organizationId` (no repository call — `NfcTag` is accepted as an already-resolved parameter, mirroring `registerNfcTag(...)`'s own already-normalized-`NfcPayload` precedent); it resolves the supplied `AssignmentTarget`'s owning `Customer` via `customerRepository.findById(target.targetId)` and compares its `organizationId` the same way, treating a `null` (not-found) result identically to a mismatch. Either check failing returns `{ status: 'rejected', reason: 'cross_organization_access' }` with no write. On full acceptance, constructs an `NfcAssignment` (`organizationId` sourced from the accepted Membership's own `organizationId`, `nfcTagId` from `nfcTag.id`, `target` unchanged, `active: true`), calls `nfcAssignmentRepository.save`, and returns `{ status: 'accepted', nfcAssignment, event: nfcTagAssigned(nfcAssignment) }`. `AssignNfcTagResult` (co-located in the same file) is `{ status: 'accepted', nfcAssignment, event } | RejectedMembershipAuthorizationResult` — reusing `RejectedMembershipAuthorizationResult` verbatim, the same design DT-023/DT-024 established, now traced to TS-002 Sequence Diagram 5. No new `index.ts` export line was needed; `OrganizationAdministrationService`, `NfcAssignmentRepository`, `InMemoryNfcAssignmentRepository`, `NfcAssignment`, and `NfcTagAssigned` were all already exported from prior sprints.

**Disclosed planning finding, confirmed implemented as decided:** `AssignmentTarget` carries no `organizationId` of its own, so verifying its ownership requires resolving the underlying `Customer`, which can return `null` if the target does not exist. `MembershipAuthorizationResult` has no distinct "not found" rejection reason, and FB-002 Decision 5's own Result line names only two outcomes (`NfcTagAssigned`, or `CrossOrganizationAccessRejected`). Per `Development_Sprint_018_Plan.md` Section 8, a missing target `Customer` is treated identically to an Organization mismatch, both producing `cross_organization_access` — confirmed present in the committed code and covered by a dedicated test.

**Constructor-arity discipline, correctly applied:** unlike DT-024's own disclosed mid-sprint regression, this sprint's fourth required constructor dependency was positioned correctly on the first pass — `Development_Sprint_018_Plan.md` specified the exact signature verbatim rather than in prose. Independently re-verified at governance closure using the same tests-inclusive `tsc --noEmit` technique that originally caught DT-024's regression: zero `OrganizationAdministrationService`-related errors.

Test results: `packages/core/tests/application/OrganizationAdministrationService.test.ts` extended to 22 tests total — the 13 pre-existing `createCustomer`/`registerNfcTag` tests (constructor call sites updated for the new required argument, zero assertion changed) plus 9 new `assignNfcTag` tests: an accepted-path test combining the full result-shape assertion with a `NfcAssignmentRepository.save`-called-once-with assertion; the three `MembershipAuthorizationValidator` rejection paths; an `NfcTag` Organization mismatch rejection; an `AssignmentTarget`/`Customer` Organization mismatch rejection; a missing-`Customer` rejection; a consolidated spy assertion proving `NfcAssignmentRepository.save` is never called across all six rejection scenarios; and a deterministic-`NfcAssignmentId`-generation test. `npm run test --workspace=@taptime/core`: 40 test files, 219 tests, all passing (up from 210 pre-Sprint-018). `npm run typecheck --workspace=@taptime/core`: clean, no errors. A supplementary, out-of-band tests-inclusive `tsc --noEmit` run (temporary tsconfig, deleted after use) independently confirms zero type errors remain in this test file. `npm run typecheck --workspace=apps/mobile`: clean. `npm run test --workspace=apps/mobile`: 10/10 passing (unaffected).

Known limitations: none beyond what was deliberately left open by design — `OrganizationAdministrationService.assignNfcTag(...)` has no caller anywhere in the repository outside its own test file (no UI, CLI, or mobile entry point calls it, per this task's own Out of Scope); the missing-target-Customer resolution means the caller cannot distinguish "not found" from "wrong Organization" from the result alone — a genuine, disclosed limitation of the current result vocabulary, not merely a documentation note; no check against `NfcAssignmentRepository.findActiveByTagId(...)` is performed before saving, so reassignment of an already-assigned tag is not prevented, per this task's own Out of Scope (FB-002 Open Question 3, not resolved here). Scope isolation independently verified: `MembershipAuthorizationValidator`, `MembershipAuthorizationResult`, `Membership`, `NfcTag`, `NfcAssignment`, `AssignmentTarget`, `Customer`, `NfcTagAssigned`, `NfcAssignmentRepository`, `NfcTagRepository`, `CustomerRepository`, `AssignmentResolver`, `AssignmentValidator` all confirmed byte-for-byte unchanged (and all of their test files); `NfcTagRepository` is not even called by `assignNfcTag(...)`; no changes to `apps/mobile`, `BusinessEngine`, `WorkEventFactory`, `NfcScanApplicationService`, `CallerContext`, `OfflineQueue`, `SynchronizationService`, or error handling; no scan-pipeline integration verification (DT-026) was performed by this task.

**Post-closure C3A reconciliation (2026-07-14):** the limitation also includes accepting a detached
`NfcTag` that is never reloaded from `NfcTagRepository` and not checking `Customer.active`. The
review-ready ADR-0011 therefore prohibits exposing this method directly as an API. Proposed C3
reloads Tag/Customer in a current
tenant write transaction and maps missing/inactive/inaccessible targets to
`assignment_target_unavailable`. This note does not rewrite DT-025's historical implementation.

## DT-026 – Existing Scan Pipeline Integration Verification

Objective: Prove, without changing any pipeline code, that `AssignmentResolver`, `AssignmentValidator`, `WorkEventFactory` and `BusinessEngine` produce identical outcomes when `NfcTagRepository`/`NfcAssignmentRepository`/`CustomerRepository` are populated through DT-020–DT-025's Administration flow instead of `runScan.ts`'s hard-coded demo fixture.

Repository Responsibility: Tests/verification only — no production code in `business/`, `application/`, or `domain/` is added or modified by this task, mirroring DT-010's and DT-011's role as composition/verification-focused tasks.

Acceptance Criteria:

- A new composition-level test constructs a real (non-demo) Organization, Administrator Membership and Employee Membership via DT-017/DT-018; creates a Customer, registers an NFC Tag, and assigns it via DT-023/DT-024/DT-025; then drives a scan through the unmodified `NfcScanApplicationService`/`AssignmentResolver`/`AssignmentValidator`/`WorkEventFactory`/`BusinessEngine` pipeline and asserts the same `WorkEventCreated`/`TimeEntryStarted` outcome shape DT-011's existing demo-pipeline test already asserts for the fixture case.
- A second test proves cross-Organization data is correctly invisible/rejected: a scan using a Membership from Organization A cannot resolve or validate against Organization B's Tag/Assignment/Customer, exercising `AssignmentValidator`'s existing `employee_lacks_organization_access` unchanged.
- `git diff` confirms zero changes to `AssignmentResolver.ts`, `AssignmentValidator.ts`, `WorkEventFactory.ts`, `BusinessEngine.ts`, `NfcScanApplicationService.ts`, `CallerContext.ts`.
- `runScan.ts`'s existing `buildScanDemoPipeline` and its existing tests are verified unchanged and continue to pass — this task does not require modifying the demo CLI pipeline (a future, separate, non-required follow-up may let it optionally accept Organization-owned repository instances, mirroring DT-015's `ScanDemoStorageOptions` precedent, but that is not part of this task).

Implementation Boundary (must not be touched): every file listed in "Architecture Principles Preserved" in TS-002; this task adds tests only.

Testing Expectations: composition-level tests only, using real (unmocked) production classes throughout, exactly as DT-011's and DT-015's composition tests already do.

Out of Scope: any CLI or mobile entry point wiring the new Administration Services into `runScan.ts`/`apps/mobile` (a future Development Task, not required to prove TS-002's architectural claim); performance/scale testing; any new business decision logic.

Dependencies: DT-017, DT-018, DT-019, DT-020, DT-021, DT-022, DT-023, DT-024, DT-025 — this is the final, integrating task and requires all preceding Organization Management tasks to exist.

Relationship to TS-002: Implements Capability 5 (Scan Pipeline Enablement) and Sequence Diagram 6 (Existing Scan Using Organization-Owned Data); directly verifies TS-002's Primary Design Question answer.

Relationship to FB-002: Implements the In Scope item "Replacing hard-coded, source-code demo fixtures as a product capability goal" and Decision 7 (Evaluate Whether a Scan Belongs to the Same Organization Context, unchanged).

### Implementation Notes

Status: Completed — Review Agent verified, Human Architect approved (2026-07-09), Development Sprint 019.

Implementation summary: A new composition-level test file, `packages/core/tests/application/OrganizationOwnedScanPipeline.test.ts` (245 lines, 2 tests), was added — no production code was added or modified anywhere in the repository. The accepted-path test constructs a real Organization via `OrganizationManagementService.createOrganization(...)`, a real Administrator Membership and a real Employee Membership via `MembershipService.grantMembership(...)`, a real Customer/NfcTag/NfcAssignment via `OrganizationAdministrationService.createCustomer(...)` → `registerNfcTag(...)` → `assignNfcTag(...)`, then wires the *same* `CustomerRepository`/`NfcTagRepository`/`NfcAssignmentRepository` instances directly into a real `AssignmentResolver`/`AssignmentValidator` (not fresh instances, proving genuine data-flow integration), triggers a scan through the unmodified `NfcScanApplicationService`/`WorkEventCreationService`/`WorkEventFactory`/`BusinessEngine` pipeline, and asserts a saved `WorkEvent` and a started `TimeEntry` matching the same outcome shape DT-011's existing fixture-based pipeline test already asserts. The cross-Organization rejection test proves the pipeline's existing `employee_lacks_organization_access` rejection (`AssignmentValidator`, unchanged since Development Sprint 001) still fires correctly against Administration-created data, with no new rejection reason invented. Committed to `main` at `72e45f5`.

Test results: `npm run test --workspace=@taptime/core` — 221/221 tests passing (219 pre-existing + 2 new), 41 test files; `npm run typecheck --workspace=@taptime/core` — clean; a supplementary tests-inclusive `tsc --noEmit` check confirmed zero new type errors attributable to the new file (12 pre-existing, unrelated errors unchanged); `runScan.ts`'s own existing CLI tests (14 tests, 3 files) confirmed passing with zero diff; `OrganizationAdministrationService.test.ts` (22 tests) and `NfcScanToTimeEntryPipeline.test.ts` (2 tests) both confirmed passing with zero modification; `npm run typecheck --workspace=apps/mobile` — clean; `npm run test --workspace=apps/mobile` — 10/10 passing (unaffected). Zero production-code diff confirmed two independent ways: `git show --stat` on the implementation commit and a full-range `git diff --stat` against Development Sprint 018's own commit, both empty for every file under `packages/core/src/` and `apps/mobile/src/`.

Known limitations: this proof is repository-internal only — no UI, CLI, or mobile entry point calls any Organization Management Application Service after this task, and this task deliberately does not change that; DT-026 does not make TapTim.e pilot-ready by itself. This completes the DT-017–DT-026 TS-002 Organization Management Foundation Development Task sequence in full — no DT-027 or later task exists anywhere in FB-002, TS-002, or this document. The missing-target-Customer result-vocabulary limitation disclosed at DT-025's closure, the Membership-granting bootstrap question, tag reassignment/history semantics, tag payload collision semantics (FB-002 Open Questions), and `packages/core/tsconfig.json`'s standing `"include": ["src"]` `tests/`-typecheck-coverage gap all remain unresolved, unaffected by this task. See `Development_Sprint_019_Closure.md` for full evidence.

**Post-closure C3A/C3B-feasibility reconciliation (2026-07-14):** accepted FB-002 v1.2, TS-002 v1.2 and ADR-0011
resolve the architecture questions above without changing DT-026's code/test evidence. The Core
foundation remains complete; this sentence records the 2026-07-14 state, before later C3C/C3D
closures.

**Post-closure C3C reconciliation checkpoint (2026-07-15):** TS-002 v1.3 and the authorized C3C
implementation add the tenant-safe normal setup backend/API around this unchanged historical Core
foundation. Local Node-24/PostgreSQL-17 verification passed, but C3C still awaits its implementation
head, independent final review and exact-head ten-job CI. This does not change DT-017–DT-026's
Completed status, create a new EP-007 Development Task or complete DT-063–DT-066. C3D/C3E and
production remain gated.

## Dependencies

- ADR-0007 must exist.
- TTAP-001 EP-007 extension must exist.
- FB-001 must exist.
- TS-001 must exist.
- For DT-017–DT-026: FB-002 and TS-002 must exist and have completed Technical Lead review (both satisfied as of this update).

## Completion Rule

This task structure is ready for Development Agent planning only after Review Agent approval of the EP-007 repository integration.

DT-017–DT-026 were planned and subsequently implemented, reviewed and approved across Development
Sprints 012–019; their populated Implementation Notes and closures are the evidence. This original
planning gate is satisfied. The accepted C3A package reconciles the completed Core foundation with the real
backend/runtime boundary; it does not retroactively convert the Core services into transport
authority. C3B, C3C, C3D and C3E1 separately completed after Human acceptance and their applicable
authorization/review/CI/Human gates without creating a new EP-007 Development Task. C3E2 later
completed the same separately governed cycle without creating a new EP-007 task.

Current checkpoint (2026-07-15): C3C repository implementation commit
`b90729a0a4b325f523cd98ea5a741defb00155f6` passed the complete 1,394-test matrix, three independent
exact-SHA reviews with zero open P0/P1/P2/P3 and exact-head ten-of-ten GitHub Actions run
`29375259275`; C3C is closed for that repository scope. Its ADO closure-publication commit
`9c79c6d2f2166d22cc61bfbc03ba79c434bbbfe0` passed all ten jobs in exact-head run `29376668158`.
C3D was still unauthorized at this checkpoint and DT-063–DT-066 remained open. This checkpoint
supplements rather than rewrites the historical DT-017–DT-026 completion evidence above.

Current closure reconciliation (2026-07-18): C3D corrections passed independent zero-finding
review and exact-head CI, its complete fresh Galaxy A33/NTAG213 Human physical gate passed, and ADO
closure commit `a0419866c2b992ae8fc5474144064bc0652d215a` passed exact-head ten-of-ten run
`29407078949`. The former combined C3E planning label is now split into C3E1 identity-first Employee
Membership setup and C3E2 explicit Tag reassignment. The initial C3E1 authorization package received
six P2 contract findings and no P0/P1/P3. Corrected commit `70d163f` passed zero-finding independent
re-review and exact-head CI; the Human Architect accepted/authorized C3E1 implementation. Initial
implementation `42b7c7a` was published and passed exact-head ten-of-ten run `29414515751`, but final
review returned `CHANGES REQUIRED` with three P2 and three P3 findings. Correction `450d767` passed
zero-finding independent delta review and exact-head ten-of-ten run `29416554531`. First strictly
local harness commit `ee522a5` passed exact-head CI but independent review returned
`CHANGES REQUIRED`; focused correction `4338910` passed zero-finding delta re-review and exact-head
ten-of-ten run `29420832927`. The complete fresh Galaxy A33/NTAG213 Human Gate then passed. Closure
commit `fe0781b` passed exact-head ten-of-ten run `29645336694` and independent zero-finding final
review. C3E1 is closed for its authorized scope. C3E2 later completed its separate implementation
and Human Gate; closure commit `a2fdebc`, tree `1872f9f`, passed exact-head ten-of-ten run
`29652072268` and zero-finding independent final review. C3E2 is closed for its authorized local
repository/device scope. This reconciliation creates no new EP-007
Development Task: DT-063–DT-066 remain candidate Roadmap-v2 work outside the completed
DT-017–DT-026 sequence.
