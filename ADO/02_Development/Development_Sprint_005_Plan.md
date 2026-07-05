# Development Sprint 005 Plan – First Real Scan

Status: Planned
Role: Research / Implementation Support acting on behalf of Technical Lead (per AGR-001)
Epic: EP-007 – Product Architecture Foundation
Owner: Technical Lead
Approval Authority: Human Architect
Branch: `main`
Created Date: 2026-07-05
Related Development Tasks: DT-001 (extended, reused), DT-010 (extended, reused), **DT-011 (new — justified in Section 3)**
Related Artifacts: `EP-007_Development_Tasks.md`, `Development_Sprint_001_Plan.md`–`Development_Sprint_004_Plan.md`, `Development_Sprint_004_Closure.md`, TTAP-001, TS-001, FB-001, ADR-0004, ADR-0006, ADR-0007

---

## 1. Executive Summary

The Technical Lead's proposal — stop building infrastructure and instead prove the implemented Business Core can process a scan from start to finish — is **accepted, with one evidence-based scope correction**: "real input" in this repository cannot yet mean *physical NFC radio hardware*, because no mobile app or native module has ever been started (verified: `apps/` contains only `.gitkeep`; no React Native/Expo/native-NFC dependency exists anywhere in the repo). Building that would be a new, much larger undertaking (Mobile Foundation, ADR-0007's deferred mobile validation) and would violate this sprint's own boundaries ("no UI polish," "no deployment"). Development Sprint 005 instead delivers the first **real, non-test, running composition** of the entire approved pipeline (DT-001–DT-008) driven by genuinely external input (not a hard-coded Vitest fixture), plus the one named-but-never-built TS-001 component that makes the outcome observable: `ScanResultPresenter`. This is the most direct, lowest-risk way to prove "the complete architecture works with real input" using only what repository evidence already supports.

## 2. Repository Evidence

- `apps/` contains only `.gitkeep` (verified by direct listing); no mobile app, no React Native/Expo project, no native NFC module exists anywhere in the repository.
- `packages/core/package.json` / root `package.json`: no native/mobile/hardware dependency of any kind; only `typescript`, `vitest`, `@types/node`.
- `packages/core/src/infrastructure/adapters/FakeNfcScanAdapter.ts` is the **only** implementation of `NfcScanPort` that has ever existed; `Development_Sprint_001_Plan.md` explicitly scoped DT-001 as "no real NFC SDK or native platform NFC API integration."
- `ADR-0007-technology-platform-baseline.md`: the mobile baseline ("React Native / Expo... Native NFC capability through platform-compatible modules") is a *decision*, not yet an *implementation*; its own "Validation Requirements" section lists "NFC scan capability on the supported mobile platform" as something to validate "before production implementation proceeds" — i.e. a distinct, not-yet-started validation activity, not a natural next increment of the current TypeScript-only `packages/core` work.
- `TS-001-nfc-scan-creates-work-event.md` Architecture Flow names eleven components ending in `ScanResultPresenter` ("Provide display-ready scan result"). Verified by direct search: **no `ScanResultPresenter` exists anywhere in `packages/core/src/`.** Every other named component in that flow (`NfcScanAdapter` through `SynchronizationService`) is now implemented (DT-001–DT-008); this is the one gap.
- `EP-007_Development_Tasks.md`: DT-001–DT-008 all have implementation notes; DT-009 (Error Handling) and DT-010 (Tests) have none. Neither DT-009 nor DT-010's Objective ("Implement explicit error handling..." / "Create verification coverage...") describes assembling the components into one runnable, externally-triggerable program — verified by re-reading both Objectives in full.
- Every existing integration test (`NfcScanToTimeEntryPipeline.test.ts`) wires the full pipeline **inside Vitest**, using hard-coded literal payloads/timestamps/ids for determinism. There is no artifact anywhere in the repository — script, CLI, or otherwise — that runs the pipeline as a standalone program outside the test runner.
- `ADO/02_Development/Development_Sprint_004_Closure.md`: DT-008 (Synchronization Service) is implemented and tested but recorded as "Implemented — Pending Review," not Completed — noted as a dependency risk in Section 9, not a blocker for planning.
- Product Vision (`Product_Vision.md`), Product Principles ("One Tap. One Decision.", "Zero Decision UX"): the product's core promise is that a single external interaction becomes exactly one interpreted outcome. No sprint so far has demonstrated this as one coherent running system — only as isolated unit/integration tests.

## 3. Why Sprint 005 Is the Correct Next Sprint (With a Scope Correction)

**Accepted:** proving the pipeline works end-to-end is higher-value right now than more infrastructure. DT-009 (Error Handling) is premature — it would be categorizing failure modes for a pipeline that has never been exercised as a single running program, and Sprint 005 will surface which categorization actually matters. Real backend Persistence Integration remains blocked by ADR-0007's still-deferred technology choice (unchanged since Sprint 004). Finding F-01 remains a product decision, not engineering work, and does not block a demonstration — the `escalation_required` branch is itself one of the outcomes worth demonstrating, exactly as `BusinessEngine.test.ts` already proves it deterministically.

**Scope correction:** the literal pipeline diagram in the task ("Real NFC Tag ↓ NFC Adapter") describes TS-001's architecture correctly, but "Real NFC Tag" cannot be satisfied by physical hardware today without first building an entire mobile/native foundation that does not exist and is explicitly out of this sprint's own boundary ("no UI polish," "no deployment"). The evidence-supported equivalent is: replace the *test-fixture-driven* trigger with a *genuinely external, non-hard-coded* trigger (e.g. a CLI argument or stdin payload representing a scanned tag), feeding the same, real, unmodified production classes DT-001–DT-008 already built — proving the architecture, not simulating a mobile app.

**Why now, not later:** `ScanResultPresenter` is not new architecture — it is named in TS-001 today and has simply never been built. Implementing it, plus a composition root, requires no ADR change, no TTAP change, no new product decision, and reuses one hundred percent of DT-001–DT-008's existing, tested code. This is the textbook "Extend Before Create" / "Continue Never Recreate" situation: the pieces exist, only the assembly and the last named component are missing.

## 4. Business Objective

Prove, with a runnable artifact rather than only test assertions, that "One Tap. One Decision." (Product Vision) already holds for the implemented Business Core: a single external scan signal flows through resolution, validation, business decision, queuing and synchronization to a clear, observable outcome — without a mobile app, a backend, or a human in the loop deciding anything the Business Engine should decide.

## 5. Technical Objective

Assemble DT-001 through DT-008's already-implemented components into a single, real (non-test) composition root, add a genuinely external trigger mechanism for `NfcScanPort`, implement TS-001's still-missing `ScanResultPresenter` component to render each outcome, and demonstrate all of the pipeline's currently-defined outcomes (accepted-and-started, accepted-and-escalated, rejected variants, synchronized, retryable-failure, conflict) through that one running program.

## 6. Scope

- A new, real (non-fake-only) trigger mechanism for `NfcScanPort` — e.g. a CLI-argument or stdin-driven adapter that accepts a payload string as genuinely external input, as an additional implementation of the existing `NfcScanPort` interface (extends DT-001, does not replace `FakeNfcScanAdapter`, which remains for tests).
- `ScanResultPresenter` (TS-001-named, not yet implemented): a small component that turns a `ScanPipelineOutcome` (and, where relevant, the eventual `SyncState`) into a display-ready, human-readable result — console output is sufficient; no UI framework.
- A composition root (a runnable script/entry point in `packages/core`, e.g. `packages/core/src/cli/runScan.ts` plus an npm script) that wires: the new real-input adapter → `AssignmentResolver` → `AssignmentValidator` → `WorkEventFactory` → `BusinessEngine` → `InMemoryWorkEventRepository`/`InMemoryTimeEntryRepository` → `InMemoryOfflineQueue` → `SynchronizationService`/`FakeSynchronizationGateway` → `ScanResultPresenter`, using the exact same production classes DT-001–DT-008 already built (no new business logic).
- Small, hard-coded-but-clearly-labeled seed data (one Organization, one authenticated employee `CallerContext`, one Customer, one NfcTag, one active NfcAssignment) sufficient to drive a realistic scenario — constructed programmatically in the composition root, not through an admin UI (out of scope, Section 7).
- Extending the existing test suite (reusing DT-010) to cover the new adapter and presenter at their own responsibility boundaries, and to record consolidated test evidence for the demonstration.

## 7. Out of Scope

- Firestore or any real backend/database — still deferred per ADR-0006/ADR-0007; the composition root uses the existing in-memory repositories and `FakeSynchronizationGateway`, unchanged.
- Authentication / Login — the composition root constructs an `authenticatedCaller(...)` `CallerContext` directly, exactly as every existing test already does; no login flow is built.
- Organization management — seed data is hard-coded in the composition root; no admin CRUD is built.
- Reporting, Admin Portal, UI polish, deployment — none of these exist and none are introduced.
- Physical NFC hardware / native modules / mobile app (`apps/`) — explicitly deferred per Section 3's scope correction; this remains future Mobile Foundation work (EP-008's not-yet-written Chapter 08) gated on an ADR-0007 mobile-validation decision the Human Architect has not yet made.
- DT-009 (Error Handling, full scope) — Sprint 005 only needs `ScanResultPresenter` to render the outcomes the pipeline already produces; a full error-categorization framework across every failure type remains a separate, future task.
- Resolution of Finding F-01 — unrelated; the demonstration shows the `escalation_required` outcome exactly as-is, without inventing a stop/duplicate/defer rule.
- Any change to DT-001–DT-008 Acceptance Criteria, business logic, FB-001, TS-001, TTAP-001, ADRs or EP-008.

## 8. Existing Components (Reused, Not Recreated)

| Component | File | Reused As |
|---|---|---|
| `NfcScanPort` | `packages/core/src/ports/NfcScanPort.ts` | Interface the new real-input adapter implements; unchanged. |
| `FakeNfcScanAdapter` | `packages/core/src/infrastructure/adapters/FakeNfcScanAdapter.ts` | Remains the test-only adapter; untouched. |
| `AssignmentResolver`, `AssignmentValidator`, `WorkEventFactory`, `BusinessEngine` | `packages/core/src/business/` | Wired into the composition root unmodified. |
| `InMemoryNfcTagRepository`, `InMemoryNfcAssignmentRepository`, `InMemoryCustomerRepository`, `InMemoryWorkEventRepository`, `InMemoryTimeEntryRepository`, `InMemoryOfflineQueue` | `packages/core/src/infrastructure/repositories/` | Seeded and wired into the composition root unmodified. |
| `SynchronizationService`, `FakeSynchronizationGateway` | `packages/core/src/application/`, `infrastructure/adapters/` | Wired in unmodified; gateway configured to demonstrate success and, separately, failure/conflict. |
| `NfcScanApplicationService`, `WorkEventCreationService` | `packages/core/src/application/` | Orchestration reused unmodified. |
| `ScanPipelineOutcome` | `packages/core/src/application/ScanPipelineOutcome.ts` | Input type `ScanResultPresenter` renders. |

## 9. Required Components

| Component | Type | Location (proposed, following existing structure) |
|---|---|---|
| Real-input `NfcScanPort` adapter (e.g. `StdinNfcScanAdapter` or `CliNfcScanAdapter`) | Infrastructure adapter | `packages/core/src/infrastructure/adapters/` |
| `ScanResultPresenter` | Application/presentation component (TS-001-named) | `packages/core/src/application/ScanResultPresenter.ts` |
| Composition root / demo entry point | Runnable script | `packages/core/src/cli/runScan.ts` (or equivalent), plus an npm script (e.g. `npm run demo:scan --workspace=@taptime/core -- <payload>`) |
| Seed data module for the demo | Application/fixture data | Co-located with the composition root; clearly labeled as demo-only, not production seed data |

## 10. Development Task Mapping

- **DT-001 (extended, reused)** — its Objective ("Implement the technical adapter boundary that reads NFC payloads and exposes normalized scan data") is technology-agnostic and already satisfied once by `FakeNfcScanAdapter`; the new real-input adapter is a second implementation of the same task, not a new task. DT-001's Acceptance Criteria are unchanged and are satisfied again by the new adapter.
- **DT-010 (extended, reused)** — "Create verification coverage... Tests verify normal, rejection, duplicate and offline flows... Test evidence is attached to implementation handover" already describes exactly the kind of consolidated verification this sprint produces; Sprint 005 extends it rather than creating a new testing task.
- **DT-011 (new) — Real Scan Composition Root & Result Presentation.** Repository evidence (Section 2) shows no existing DT-001–DT-010 Objective covers assembling the already-built components into one runnable, externally-triggered program, nor implementing the TS-001-named but never-built `ScanResultPresenter`. Per the standing instruction to create new DT identifiers only when no existing DT covers the work, and to propose new IDs after the existing sequence without implementing them without approval: DT-011 is proposed here for Human Architect/Technical Lead approval, not yet implemented.
  - Objective: Assemble DT-001–DT-008 into a single runnable composition driven by real external input, and implement TS-001's `ScanResultPresenter` to render every pipeline outcome.
  - Acceptance Criteria: A runnable entry point exists and can be executed outside the test runner; real (non-hard-coded-fixture) input can trigger a scan through it; every currently-defined pipeline outcome (accepted+started, accepted+escalated, each rejection reason, synchronized, retryable-failure, conflict) is rendered through `ScanResultPresenter`; no new business decision logic is introduced anywhere in the composition root.

## 11. Testing Strategy

- Unit tests for the new real-input adapter at the infrastructure boundary only (payload parsing/normalization, explicit "unreadable" result for malformed input) — no business logic, mirroring `FakeNfcScanAdapter.test.ts`'s scope.
- Unit tests for `ScanResultPresenter`: given each `ScanPipelineOutcome`/sync outcome shape, assert the rendered output is correct and complete — no business logic, mirroring the presentation-only boundary already defined in Chapter 03 §5.2/§7.6 (UI/presentation tests verify capture and presentation, not business meaning).
- One consolidated integration/demo test (or a documented manual run, or both) proving the composition root produces each of the outcomes listed in DT-011's Acceptance Criteria end-to-end, using the real production classes, not mocks.
- No test may assert anything about a real backend, real network, or physical NFC hardware — none exist and none are introduced this sprint.

## 12. Risks

| Risk | Mitigation |
|---|---|
| "Real input" is misread as "physical NFC hardware," triggering unplanned mobile/native scope | Section 3's scope correction is explicit; DT-011's Acceptance Criteria define "real" as "externally-triggered, non-hard-coded-fixture," not hardware-based. |
| Composition root quietly grows business logic (e.g. deciding what counts as a valid demo scenario) | DT-011 Acceptance Criteria explicitly forbids new business decision logic; all decisions remain in `AssignmentResolver`/`AssignmentValidator`/`BusinessEngine`, unmodified. |
| `ScanResultPresenter` scope creep into a UI/DT-009 error-handling framework | Scope limited to rendering already-produced outcome types; full error categorization remains explicitly out of scope (Section 7). |
| DT-008 is still "Implemented — Pending Review," not Completed | Sprint 005 reuses `SynchronizationService` as-is; if review later requires changes, the composition root's wiring (a thin consumer) should need minimal rework — flagged as a dependency, not a blocker for planning. |
| Seed/demo data mistaken for a real onboarding/admin flow | Explicitly labeled as demo-only in code and docs; Organization management remains out of scope (Section 7). |

## 13. Definition of Done

- New real-input `NfcScanPort` adapter implemented and unit-tested (DT-001 extension).
- `ScanResultPresenter` implemented and unit-tested (DT-011).
- Composition root runnable outside the test runner, wiring DT-001–DT-008 unmodified, producing observable output for every currently-defined pipeline outcome (DT-011).
- Consolidated test evidence recorded against DT-010.
- `npm run typecheck` and `npm run test` pass across the monorepo.
- `EP-007_Development_Tasks.md` gets a new `## DT-011 – Real Scan Composition Root & Result Presentation` section (Objective/Acceptance Criteria as in Section 10) plus a "Development Sprint 005 Implementation Notes" subsection under it and under DT-001/DT-010, following the established format.
- No change to DT-001–DT-008 business logic, FB-001, TS-001, TTAP-001, any ADR, Product Vision, or EP-008.
- Review Agent verification and Human Architect approval are recorded before DT-011 (or the DT-001/DT-010 extensions) are marked Completed (DTP-001: "Implementation alone never completes a Development Task").

## 14. Recommended Implementation Order

1. Implement the real-input `NfcScanPort` adapter; unit-test it.
2. Implement `ScanResultPresenter`; unit-test it against each outcome shape.
3. Build the composition root wiring all DT-001–DT-008 components together, unmodified, ending at `ScanResultPresenter`.
4. Seed minimal, clearly-labeled demo data (organization, employee, customer, tag, assignment) inside the composition root.
5. Exercise the composition root for each currently-defined outcome (accepted+started, accepted+escalated, each rejection reason, synchronized, retryable-failure, conflict), capturing output as evidence.
6. Extend/consolidate tests under DT-010; run `npm run typecheck` and `npm run test` for the whole monorepo.
7. Add the new `DT-011` section to `EP-007_Development_Tasks.md` plus Sprint 005 implementation notes under DT-001, DT-010 and DT-011.
8. Produce implementation evidence and role handover; request Review Agent verification.

---

## 15. Development Agent Prompt

The following prompt is written to be given directly to Claude Code (Development Agent) to execute Development Sprint 005. It is self-contained and does not require this planning document to be re-explained.

```text
You are the Development Agent for TapTim.e, implementing Development Sprint 005 ("First Real Scan") inside the existing `packages/core` TypeScript package, on branch `main`.

CONTEXT (verify before writing code):
- Read `ADO/02_Development/Development_Sprint_005_Plan.md` in full — it is the authoritative scope for this task, including why this sprint does NOT attempt physical NFC hardware (Section 3).
- Read `ADO/02_Development/EP-007_Development_Tasks.md` for the full current state of DT-001–DT-010; you will add a new DT-011 section as part of this task's deliverables (do not invent additional new DT IDs).
- Read the current implementation end to end: `packages/core/src/ports/NfcScanPort.ts`, `infrastructure/adapters/FakeNfcScanAdapter.ts`, `packages/core/src/application/NfcScanApplicationService.ts`, `WorkEventCreationService.ts`, `SynchronizationService.ts`, and the full existing integration test `packages/core/tests/application/NfcScanToTimeEntryPipeline.test.ts` — this is your reference for how all the pieces already wire together inside a test; your job is to wire the same pieces together as a runnable program.
- Do not modify DT-001–DT-008 business logic, FB-001, TS-001, TTAP-001, any ADR, Product Vision, or EP-008.

IMPLEMENTATION SCOPE (do exactly this, nothing more):
1. Add a new implementation of `NfcScanPort` that accepts genuinely external input (e.g. a CLI argument or stdin line representing a scanned payload) rather than a hard-coded test literal — place it under `packages/core/src/infrastructure/adapters/`, following `FakeNfcScanAdapter.ts`'s style. It must return the same `NfcScanResult`-shaped values (including an explicit "unreadable" result for malformed input) as the existing port contract requires.
2. Add `packages/core/src/application/ScanResultPresenter.ts` — a small component that takes a `ScanPipelineOutcome` (and, where applicable, a resulting `SyncState`/`SynchronizationResult`) and produces a display-ready, human-readable description of the outcome (console output is sufficient). It must not make any business decision or alter any pipeline data — presentation only.
3. Add a composition root (e.g. `packages/core/src/cli/runScan.ts`) that: seeds one Organization, one authenticated employee `CallerContext`, one Customer, one NfcTag and one active NfcAssignment into the existing in-memory repositories; wires the new adapter → `AssignmentResolver` → `AssignmentValidator` → `WorkEventFactory`/`BusinessEngine` (via the existing `NfcScanApplicationService`/`WorkEventCreationService`) → `InMemoryOfflineQueue` → `SynchronizationService`/`FakeSynchronizationGateway` → `ScanResultPresenter`, using every existing production class unmodified; and add an npm script to run it (e.g. `"demo:scan": "..."` in `packages/core/package.json`).
4. Export any new public types/classes from `packages/core/src/index.ts` that make sense to export, following the existing style — the composition root script itself does not need to be exported.

ARCHITECTURE BOUNDARIES (do not violate):
- The composition root and the new adapter/presenter must not introduce any new business decision logic. All accept/reject/escalate/sync decisions remain exactly where DT-002–DT-005/DT-008 already put them.
- Do not add a real database, real network client, authentication/login flow, organization-management UI, or any mobile/native NFC integration — none of that exists and none is in scope (see the plan's Section 7).
- `ScanResultPresenter` renders outcomes; it does not decide them.
- Do not touch `FB-001`, `TS-001`, `TTAP-001`, any ADR, Product Vision, or `EP-008`.
- Do not attempt to resolve Finding F-01; demonstrate the `escalation_required` outcome exactly as the Business Engine already produces it.

TESTING REQUIREMENTS:
- Unit tests for the new adapter (payload parsing, explicit "unreadable" case) — infrastructure boundary only.
- Unit tests for `ScanResultPresenter` — given each outcome shape, assert correct rendered output.
- A consolidated test (or documented run) proving the composition root produces each currently-defined outcome: accepted+started, accepted+escalated, each rejection reason, synchronized, retryable-failure, conflict.
- Run `npm run typecheck` and `npm run test` at the repository root; both must pass before you consider the task done.

EXPECTED DELIVERABLES:
- All files listed under Implementation Scope, committed with a clear commit message referencing DT-011 (and the DT-001/DT-010 extensions) and Development Sprint 005.
- A new `## DT-011 – Real Scan Composition Root & Result Presentation` section added to `ADO/02_Development/EP-007_Development_Tasks.md` (Objective/Acceptance Criteria as defined in the plan's Section 10), plus "Development Sprint 005 Implementation Notes" subsections under DT-001, DT-010 and the new DT-011.
- A short implementation summary (changed files, test results, known deviations, and how to run the demo) suitable for Review Agent evaluation.

STOP CONDITION:
Stop after completing the Implementation Scope, tests, and the EP-007_Development_Tasks.md updates. Do not begin any further sprint. Do not mark DT-011 (or the DT-001/DT-010 extensions) "Completed" yourself — that status requires Review Agent verification and Human Architect approval. Wait for review.
```

---

## 16. Role Handover

Implemented scope in this task: Development Sprint 005 planning only — this document and the embedded Development Agent Prompt. No source code was written or modified. No architecture, ADR, TTAP-001, FB-001, TS-001, Product Vision or EP-008 content was changed.

Changed artifacts: `ADO/02_Development/Development_Sprint_005_Plan.md` (new, this file). No other file was modified.

Related ADO artifacts consulted: Product Vision, Product Principles, Decision Log, AVR-001, TTAP-001, Domain Model, ADR-0004, ADR-0006, ADR-0007, FB-001, TS-001, Development Task Profile (DTP-001), `EP-007_Development_Tasks.md`, `Development_Sprint_001_Plan.md`–`Development_Sprint_004_Plan.md`, `Development_Sprint_004_Closure.md`, current `packages/core/src`/`packages/core/tests` source tree, EP-008 Chapters 00–03 (as synchronized through Sprint 004).

Tests performed: none (planning-only task; no code changed).

Known deviations: none from the assigned task scope. One judgment call is flagged for Human Architect/Technical Lead review rather than decided unilaterally: DT-011 bundles the composition root and `ScanResultPresenter` into a single Development Task on the grounds that neither is meaningful without the other; if stricter one-responsibility-per-task granularity is preferred, this could be split into two DTs before implementation begins.

Open findings carried forward (not resolved by this task): (1) `DEV-SPRINT-002` Decision Log entry remains stale ("Planned"); (2) Development Sprint 004 (DT-008) remains "Implemented — Pending Review," not Completed; (3) Finding F-01 (duplicate-scan/toggle mechanism) remains open; (4) `QueuedWorkEventRecord.decision: null` integration-coverage gap remains open.

Evidence produced: this plan document, including the repository-evidence-based scope correction (composition root + `ScanResultPresenter`, not physical NFC hardware) and the DT-011 justification.

Next responsible role: Technical Lead / Human Architect review and approval of this Sprint 005 Plan, including a decision on whether to accept DT-011 as proposed or split it. Per the assigned stop condition, implementation does not begin until that approval is given.

## 17. Stop Condition

Per task instruction: this task stops after producing the Development Sprint 005 Plan, the Development Agent Prompt and the Role Handover above. No code was implemented. No architecture, ADRs, TTAP-001, Product Vision or EP-008 were modified. Awaiting Technical Lead / Human Architect approval before implementation begins.
