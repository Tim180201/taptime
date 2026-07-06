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

### Development Sprint 005 Implementation Notes

See `ADO/02_Development/Development_Sprint_005_Plan.md` for the full plan. Extension (not replacement): a second `NfcScanPort` implementation, `CliNfcScanAdapter`, accepts genuinely external, non-hard-coded-fixture input (a CLI argument or stdin-sourced string) instead of a Vitest literal, normalizing it into the same `NfcScanCaptureResult` shape — including an explicit `unreadable` result for missing/empty/whitespace-only input. `FakeNfcScanAdapter` is untouched and remains the test-only adapter. Objective and Acceptance Criteria above are unchanged and are satisfied again by this second implementation.

Implementation: `packages/core/src/infrastructure/adapters/CliNfcScanAdapter.ts`. Tests: `packages/core/tests/infrastructure/CliNfcScanAdapter.test.ts`.

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

Status: Implemented and committed (`e19de60`); typecheck clean and all 53 tests pass (verified 2026-07-05). Pending Review Agent verification and Human Architect approval before this task can be marked Completed (DTP-001: "Implementation alone never completes a Development Task"; AVR-001: "Validation requires evidence. Status shall never be upgraded by assumption.").

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

## Dependencies

- ADR-0007 must exist.
- TTAP-001 EP-007 extension must exist.
- FB-001 must exist.
- TS-001 must exist.

## Completion Rule

This task structure is ready for Development Agent planning only after Review Agent approval of the EP-007 repository integration.
