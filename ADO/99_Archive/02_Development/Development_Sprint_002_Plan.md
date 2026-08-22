# Development Sprint 002 – Business Decision Pipeline

Status: Planned
Sprint ID: DEV-SPRINT-002
Owner: Implementation Support (Claude / Cowork session, acting on behalf of Technical Lead per AGR-001)
Approval Authority: Technical Lead (ChatGPT) / Human Architect
Branch: `main` (planning only; no implementation branch created by this session)
Date: 2026-07-03
Implements: DT-004 (WorkEvent Factory, full), DT-005 (TimeEntry Generator / BusinessEngine, partial — see Section 6), a slice of DT-006 (Repository Layer, WorkEvent/TimeEntry persistence only) — all existing, unchanged IDs from `ADO/02_Development/EP-007_Development_Tasks.md`
Related: Product Vision, Product Principles, ADR-0002/0003/0004/0005/0006/0007, TTAP-001, FB-001, TS-001, Development Task Profile (DTP-001), EP-008 Chapters 00–03, Development Sprint 001 Plan, Repository Freeze Sprint

This document is planning only. No production code was modified by this session.

## 0. Repository Evidence Found Before Planning

Per "Repository before Assumptions," this plan is not written against assumed code — it is written against actual, already-present implementation evidence found in the working tree before planning began:

- `packages/core/src/**` and `packages/core/tests/**` contain a working, tested implementation of Development Sprint 001 (DT-001 `NfcScanAdapter`/`FakeNfcScanAdapter`, DT-002 `AssignmentResolver`, DT-003 `AssignmentValidator`, plus `NfcScanApplicationService`, `WorkEventCreationPort`, and supporting domain objects/ports/in-memory repositories), matching the Development Sprint 001 Plan's Section 8–11 almost exactly by name.
- `packages/core/node_modules/.vite/vitest/.../results.json` shows all 5 existing test files passing (`"failed":false` for `FakeNfcScanAdapter`, `NfcScanApplicationService`, `AssignmentValidator`, `AssignmentResolver`, `ids`).
- This implementation is **uncommitted** (`git status` shows `package.json`, `package-lock.json`, `tsconfig.base.json`, `packages/core/` as untracked) and has **not** been through Review Agent verification or a Role Handover recorded in the ADO — `EP-007_Development_Tasks.md` still shows DT-001–DT-003 without a completion/evidence entry. This plan does not change that status; it is noted here as a finding (Section 8, Risks) for Technical Lead attention, separate from Sprint 002 planning itself.
- `WorkEventCreationPort` (the stub boundary Development Sprint 001 defined) has the exact shape Sprint 002 must implement against:

```ts
export interface WorkEventCreationPort {
  handleValidatedAssignment(result: AcceptedAssignmentValidationResult): void;
}
```

  where `AcceptedAssignmentValidationResult` carries `{ status: 'accepted', assignment, target, caller }`. Sprint 002 begins exactly at this seam — it does not need to reopen or guess DT-001–DT-003's contracts.

## 1. Sprint Goal

Complete the business decision pipeline from an accepted assignment validation through to an observable Business Event:

```text
Scan Fact
  -> Assignment Resolver        (DT-002, existing, unchanged)
  -> Assignment Validator       (DT-003, existing, unchanged)
  -> Business Engine Boundary   (DT-004 WorkEvent Factory + DT-005 BusinessEngine, this sprint)
  -> Decision Result
  -> Business Event
```

Sprint 002 begins where Sprint 001 ended: at `WorkEventCreationPort.handleValidatedAssignment`. It implements `WorkEventFactory` (DT-004) fully, and `BusinessEngine`/TimeEntry decision logic (DT-005) for every case that is already deterministically defined by approved repository evidence — while explicitly not inventing the one business rule that is not yet defined (Finding F-01, Section 8).

## 2. Business Objective

Per FB-001's Business Goal and Decision Logic 3–4: turn a validated NFC scan into an auditable, traceable business record (`WorkEvent`) and a clear time-tracking outcome (`TimeEntry`), without any UI, persistence or infrastructure component ever deciding that outcome — completing the "One Tap. One Decision." promise from Product Vision/Product Principle 1 for the deterministic cases the repository has already defined.

## 3. Technical Objective

Implement, as independently testable units, against the existing `packages/core` structure:

1. `WorkEventFactory` (DT-004): creates a `WorkEvent` domain object from an `AcceptedAssignmentValidationResult`, with full traceability (organization, assignment, target, caller, timestamp).
2. A `WorkEvent`/`TimeEntry` repository slice (part of DT-006): in-memory persistence sufficient to answer "does an active `TimeEntry` already exist for this (organization, target) pair?" — required by DT-005, not by DT-004.
3. `BusinessEngine` (DT-005, partial): given a `WorkEvent` and the current `TimeEntry` state for its target, deterministically produce `TimeEntryStarted` when no active `TimeEntry` exists. Every other case (an active `TimeEntry` already exists) is deliberately represented as an explicit "escalation" outcome, not a guessed decision (Section 6).

## 4. Scope

In scope:

- `WorkEvent` domain object (new — does not yet exist in `packages/core`), per TTAP-001's Aggregate Roots and FB-001 Decision Logic 3.
- `WorkEventFactory` (DT-004): full implementation and tests.
- `TimeEntry` domain object (new), per TTAP-001's Aggregate Roots.
- An in-memory `WorkEventRepository` / `TimeEntryRepository` (or a combined port), scoped only to what DT-005's deterministic branch needs: create/persist a `WorkEvent`, query whether an active `TimeEntry` exists for a given `(organizationId, targetId)`, create/persist a `TimeEntryStarted` outcome. This is a slice of DT-006, not all of it (no offline queue, no sync metadata, no Firestore).
- `BusinessEngine` (DT-005, partial): the "no active TimeEntry exists -> start" branch only, fully deterministic and tested.
- An explicit, typed "escalation" / "not yet determined" result for the branch that would otherwise require guessing the duplicate-scan/toggle rule (Finding F-01) — implemented as a safe, observable outcome, never a silent guess.
- Domain events for what this sprint actually produces: `WorkEventCreated`, `TimeEntryStarted` (per TTAP-001's Domain Events list).
- Tests for every case above, at the correct responsibility boundary (Section 7).

## 5. Out of Scope

- UI, navigation, any mobile presentation layer.
- Firebase/Firestore — continue with in-memory/fake repositories only, per Development Sprint 001's precedent and ADR-0007.
- Authentication implementation — `CallerContext` is already implemented (Sprint 001) and reused as-is.
- Real NFC SDK integration — unchanged from Sprint 001; `FakeNfcScanAdapter` continues to be used.
- Offline queue and synchronization (DT-007/DT-008).
- Reporting, pricing, admin portal, production deployment.
- **The duplicate-scan protection window and start/stop toggle mechanism itself (Finding F-01).** This is the one piece of TS-001-level business logic that remains explicitly undefined by repository evidence. Sprint 002 does not define it, guess it, or hard-code a plausible-looking value for it. See Section 6 and Section 8.
- `TimeEntryStopped`, `TimeEntryPending`, `DuplicateScanIgnored` events — all depend on the undefined toggle mechanism (F-01) and are therefore out of scope for this sprint.

## 6. Existing DT Mapping

| DT | Title (unchanged) | Sprint 002 Disposition |
|---|---|---|
| DT-001 | NFC Scan Adapter | Already implemented and tested (Sprint 001, uncommitted — see Section 0). Not touched by Sprint 002. |
| DT-002 | Assignment Resolver | Already implemented and tested (Sprint 001, uncommitted). Not touched by Sprint 002. |
| DT-003 | Assignment Validator | Already implemented and tested (Sprint 001, uncommitted). Not touched by Sprint 002. Its output (`AcceptedAssignmentValidationResult`) is Sprint 002's direct input. |
| DT-004 | WorkEvent Factory | **Fully in scope.** Deterministic per its own Acceptance Criteria ("WorkEvent contains required traceability. Invalid inputs do not create WorkEvents. Factory has deterministic tests.") — none of these criteria depend on the undefined toggle mechanism. |
| DT-005 | TimeEntry Generator | **Partially in scope.** In scope: the "no active TimeEntry for this target" branch, which deterministically resolves to `TimeEntryStarted` (FB-001 Decision Logic 4, "start" outcome) without needing F-01. Out of scope: the "an active TimeEntry already exists" branch (stop vs. defer vs. duplicate-ignore), which is exactly what Finding F-01 leaves undefined. This branch is implemented only as an explicit, typed escalation outcome — see Section 8. |
| DT-006 | Repository Layer | **Sliced.** Only the in-memory `WorkEvent`/`TimeEntry` persistence needed to support DT-004/DT-005's tests. No Firestore, no full repository surface, no offline/sync metadata (that remains DT-007/DT-008). |
| DT-007 | Offline Queue | Out of scope, unchanged. |
| DT-008 | Synchronization Service | Out of scope, unchanged. |
| DT-009 | Error Handling | Out of scope for this sprint's dedicated implementation; the escalation outcome in Section 8 satisfies TS-001's general error-classification intent for this specific case without a separate DT-009 implementation effort. |
| DT-010 | Tests | Ongoing/incremental, as in Sprint 001 — each task above carries its own tests; no separate DT-010 effort is scheduled this sprint. |

## 7. Required New DTs

**None.** Every unit of work in this sprint is covered by existing DT-004, DT-005 (partial) and a slice of DT-006. No new Development Task ID is created, per instruction.

The missing duplicate-scan/toggle mechanism (Finding F-01) is **not** proposed as a new DT, because defining it is a Technical Lead decision (a TS-001 addendum), not an implementation task — DTP-001 states "Development Tasks implement approved architecture without redefining product intent or architectural decisions." This is consistent with the recommendation already recorded in `ADO/02_Development/Repository_Freeze_Sprint.md`.

## 8. Risks

| Risk | Severity | Notes |
|---|---|---|
| Finding F-01 (duplicate-scan/toggle mechanism undefined) | BLOCKER for the "active TimeEntry exists" branch of DT-005 only | Unchanged across three prior evidence reports (Repository Readiness Assessment, Repository Maintenance Sprint 002, Repository Freeze Sprint). Sprint 002 works around it by implementing only the deterministic "no active TimeEntry" branch and representing the other branch as an explicit escalation outcome (Section 4, Section 12), per EP-008 Chapter 01 §6.2's own worked example for exactly this situation. Full DT-005 completion still requires a Technical Lead decision on this mechanism (recommended as a TS-001 addendum, per Repository Freeze Sprint's existing recommendation). |
| DT-001–DT-003 implementation is uncommitted and unreviewed | MEDIUM (process, not architecture) | Found in the working tree during this planning pass. Sprint 002 code depends on these modules' exact contracts (`AssignmentValidationResult`, `WorkEventCreationPort`). If they are changed or discarded before being committed and reviewed, Sprint 002's assumptions in Section 0 would need re-verification. Recommend committing and routing DT-001–DT-003 through Review Agent verification before or alongside Sprint 002 implementation, not after. |
| `WorkEvent`/`TimeEntry` are new domain objects not yet present in `packages/core` | LOW | TTAP-001 already names them as Aggregate Roots; no new central domain object is being invented, only implemented for the first time. |
| Escalation outcome for the undefined branch could be mistaken for a real product decision later | LOW–MEDIUM | Mitigated by naming and documentation requirements in Section 12 (must be unmistakably an escalation, not a silent default). |
| In-memory `WorkEvent`/`TimeEntry` repository slice could be mistaken for the final DT-006 design | LOW | Explicitly documented as a minimal slice, not the full Repository Layer; DT-006's remaining surface (Firestore-backed, sync metadata) is unchanged and still open. |

## 9. Component Responsibilities

| Component | Responsibility | Sprint 002 Disposition |
|---|---|---|
| `WorkEventFactory` | Create a `WorkEvent` from an `AcceptedAssignmentValidationResult`, with traceability (org, assignment, target, caller, timestamp). | New, full implementation. |
| `WorkEvent` (domain object) | Immutable record of a business-level event derived from a valid trigger (TTAP-001 Aggregate Root). | New. |
| `TimeEntry` (domain object) | Business record representing started/active/completed work time (TTAP-001 Aggregate Root). | New — `started` state only this sprint. |
| `WorkEventRepository` / `TimeEntryRepository` (in-memory slice) | Persist `WorkEvent`s; answer "is there an active `TimeEntry` for this target?" | New, minimal, in-memory only (DT-006 slice). |
| `BusinessEngine` | Interpret a `WorkEvent` plus current `TimeEntry` state and derive a decision result. | New, partial: deterministic `start` branch only; explicit escalation for the other branch. |
| `NfcScanApplicationService` | Already implemented (Sprint 001); calls `WorkEventCreationPort.handleValidatedAssignment` on acceptance. | Unchanged. The Sprint 002 `WorkEventFactory`/`BusinessEngine` pair becomes the concrete implementation behind that port. |

## 10. Testing Strategy

Per EP-008 Chapter 01 §7.7 / Chapter 03 §7.6 and TS-001's Testing Requirements, matching the pattern already established by Sprint 001's tests:

- **Domain tests**: `WorkEvent`/`TimeEntry` construction and traceability invariants (e.g., a `WorkEvent` always carries its originating assignment and caller).
- **Business decision tests** (deterministic, no infrastructure dependencies): `WorkEventFactory` — valid input produces a `WorkEvent`, invalid/incomplete input does not. `BusinessEngine` — no active `TimeEntry` for the target produces `TimeEntryStarted`; an active `TimeEntry` for the target produces the explicit escalation outcome (never a guessed stop/duplicate/defer result).
- **Infrastructure tests**: in-memory `WorkEventRepository`/`TimeEntryRepository` — persistence and lookup behavior only, no business interpretation (consistent with TS-001's Layer Rules).
- **Application/integration test**: extend or add a test that drives the full pipeline `NfcScanApplicationService.submitScan(...)` through to a concrete `WorkEventCreationPort` implementation backed by `WorkEventFactory`/`BusinessEngine`, verifying an accepted scan ultimately produces `TimeEntryStarted` end-to-end when no prior session exists — this is the sprint's primary "pipeline complete" proof.
- Explicitly **not** required this sprint: any test asserting stop/duplicate/defer behavior (depends on F-01), offline/queue tests, synchronization tests.

## 11. Definition of Done

Per DTP-001, applied to this sprint:

- `WorkEventFactory` (DT-004) implemented, matching its existing Acceptance Criteria in `EP-007_Development_Tasks.md`, unchanged.
- `BusinessEngine`'s deterministic branch (DT-005, partial) implemented and tested; the undefined branch is represented only as an explicit, documented escalation outcome — verified that no stop/duplicate/defer logic was guessed or hard-coded.
- The in-memory `WorkEvent`/`TimeEntry` repository slice (DT-006 slice) implemented and tested, scoped exactly as Section 4 describes — no Firestore, no sync metadata added.
- All tests in Section 10 written and passing.
- No Business Rule or decision logic exists inside UI, persistence, or infrastructure code.
- Role Handover produced by the Development Agent, per EOM-001.
- DT-004 and the in-scope part of DT-005/DT-006 are proposed as ready for Review Agent verification — status in `EP-007_Development_Tasks.md` updated only after that verification, not unilaterally by the Development Agent, consistent with Development Sprint 001's own Definition of Done.
- F-01 remains explicitly open and undecided by this sprint; the escalation outcome must not be interpreted as F-01 being resolved.

## 12. Recommended Implementation Order

```text
1. WorkEvent domain object (traceability fields: id, organizationId, assignment, target,
   caller, timestamp)
2. TimeEntry domain object (id, workEventId, organizationId, targetId, status: 'started', ...)
3. WorkEventRepository / TimeEntryRepository in-memory implementation (create + query
   "active TimeEntry for target?")
4. WorkEventFactory (consumes AcceptedAssignmentValidationResult -> WorkEvent)
5. BusinessEngine:
   a. no active TimeEntry for target -> create TimeEntry (status 'started'), emit
      TimeEntryStarted
   b. active TimeEntry already exists -> return an explicit, clearly-named escalation
      result (e.g. a `BusinessDecisionResult` variant such as
      { status: 'escalation_required', reason: 'duplicate_scan_rule_undefined' } or
      equivalent) - never a guessed stop/duplicate/defer outcome
6. Concrete WorkEventCreationPort implementation wiring WorkEventFactory -> BusinessEngine
7. Tests for every layer above (Section 10), including the end-to-end pipeline test
8. Role Handover
```

This continues directly from Development Sprint 001's own Implementation Order (which ended at step 6, "WorkEventCreationPort stub interface, no implementation") — step 6 here is exactly where that stub gets its first real implementation.

---

## 13. Development Agent Implementation Prompt

```text
You are the Development Agent for TapTim.e.

Task: Implement Development Sprint 002 - Business Decision Pipeline.

Context: Development Sprint 001 (DT-001 NFC Scan Adapter, DT-002 Assignment Resolver,
DT-003 Assignment Validator) is already implemented and tested in packages/core/ (found
in the working tree - verify it is still present and its tests still pass before you
start; if it has changed, re-read it before proceeding). Do NOT modify DT-001-DT-003
code except to wire it to your new WorkEventCreationPort implementation.

Scope: Implement ONLY:
- DT-004 - WorkEvent Factory (full implementation, per its existing Objective/Acceptance
  Criteria in ADO/02_Development/EP-007_Development_Tasks.md - unchanged)
- DT-005 - TimeEntry Generator / BusinessEngine, DETERMINISTIC BRANCH ONLY: when no
  active TimeEntry exists for the assignment target, create one and emit
  TimeEntryStarted. Do NOT implement stop/duplicate/defer logic.
- A minimal slice of DT-006 - Repository Layer: in-memory WorkEvent/TimeEntry
  persistence sufficient to support the above. No Firestore, no sync metadata.

Read before implementing, in this order:
1. ADO/01_Architecture/Technical_Architecture_Profile.md (TTAP-001) - WorkEvent/TimeEntry
   Aggregate Roots, Domain Events
2. ADO/01_Architecture/Feature_Blueprints/FB-001-nfc-scan-creates-work-event.md (FB-001)
   - Decision Logic 3 and 4
3. ADO/01_Architecture/Technical_Specifications/TS-001-nfc-scan-creates-work-event.md
   (TS-001) - WorkEventFactory/BusinessEngine/TimeEntryGenerator component responsibilities
4. ADO/02_Development/EP-007_Development_Tasks.md (DT-004, DT-005, DT-006 sections)
5. ADO/02_Development/Development_Sprint_001_Plan.md and packages/core/ (existing code -
   read WorkEventCreationPort.ts and AssignmentValidationResult.ts first, they are your
   direct input contract)
6. ADO/02_Development/Development_Sprint_002_Plan.md (this plan, Sections 1-12)
7. ADO/01_Architecture/Developer_Implementation_Manual/ Chapters 00-03

You MUST:
- Implement WorkEvent and TimeEntry as new domain objects, independent of UI,
  persistence and infrastructure (TTAP-001 Domain layer rule).
- Implement WorkEventFactory so it always produces a WorkEvent with full traceability
  from an AcceptedAssignmentValidationResult, and never from a rejected one.
- Implement BusinessEngine's "no active TimeEntry" branch deterministically: same
  inputs (WorkEvent + no active TimeEntry) always produce TimeEntryStarted.
- When an active TimeEntry already exists for the target, return an explicit, clearly
  and honestly named escalation/undetermined result. Document in code comments and in
  your Role Handover that this is a deliberate placeholder for Finding F-01, not a
  business decision.
- Implement the WorkEvent/TimeEntry repository slice in-memory only.
- Provide a concrete implementation of WorkEventCreationPort that wires
  WorkEventFactory -> BusinessEngine, and connect it so NfcScanApplicationService's
  existing pipeline can be driven end-to-end in a test.
- Write tests per Section 10, including one end-to-end pipeline test.
- Keep all business meaning inside WorkEventFactory/BusinessEngine. No UI, persistence,
  adapter or infrastructure code may decide these outcomes.

You MUST NOT:
- Guess, hard-code, or approximate a duplicate-scan protection window or start/stop
  toggle rule. If you find yourself needing one, stop and escalate in your Role
  Handover instead - do not implement a plausible-looking default.
- Implement TimeEntryStopped, TimeEntryPending, or DuplicateScanIgnored - all depend on
  the undefined mechanism (Finding F-01) and are out of scope.
- Implement Firebase/Firestore, offline queue, or synchronization (DT-006's remaining
  surface, DT-007, DT-008).
- Build any UI, navigation, authentication, or NFC SDK integration.
- Modify DT-001-DT-003 business logic (AssignmentResolver, AssignmentValidator,
  NfcScanApplicationService's orchestration) - only wire your new
  WorkEventCreationPort implementation into the existing pipeline.
- Create new Development Task IDs.

When you finish, or if you must stop early:
- Produce the mandatory Role Handover per EOM-001.
- Do not mark DT-004, DT-005, or DT-006 status as complete in
  EP-007_Development_Tasks.md yourself - that follows Review Agent verification.
- Explicitly flag in your Role Handover: (a) whether DT-001-DT-003 were still present
  and passing when you started, (b) that Finding F-01 remains open and blocks full
  DT-005 completion, and (c) the exact shape of your escalation result type, so the
  Technical Lead can design the real mechanism against it later.
- Stop. Do not continue into DT-007/DT-008 or any later task without explicit approval.
```

---

## 14. Role Handover

```text
ROLE HANDOVER

Current Role: Implementation Support (acting on behalf of Technical Lead per AGR-001, this session)
Status: COMPLETED (planning only)
Completed Work: Created Development Sprint 002 plan (Sections 1-12), confirmed DT-004/DT-005/
  DT-006 as the existing task IDs this sprint maps to (no new IDs), discovered and verified
  uncommitted Development Sprint 001 implementation evidence in packages/core/ (all 5 existing
  tests passing per vitest results.json), defined the Development Agent prompt (Section 13),
  extended EP-007_Development_Tasks.md with sprint-specific implementation notes under
  DT-004/DT-005/DT-006, added Decision Log and ADO/README.md traceability.
Created Artifacts: ADO/02_Development/Development_Sprint_002_Plan.md (this document).
Changed Artifacts: ADO/02_Development/EP-007_Development_Tasks.md (added "Development Sprint
  002 Implementation Notes" under DT-004, DT-005, DT-006 - Objective/Acceptance Criteria
  unchanged); ADO/00_Core/Decision_Log.md (new row); ADO/README.md (navigation pointer).
Evidence: Direct reading of TTAP-001, FB-001, TS-001, EP-007_Development_Tasks.md, Development
  Sprint 001 Plan, EP-008 Chapters 00-03; direct reading of packages/core/src and
  packages/core/tests (WorkEventCreationPort.ts, AssignmentValidationResult.ts,
  NfcScanApplicationService.ts, AssignmentResolver.ts, AssignmentValidator.ts, index.ts,
  AssignmentValidator.test.ts); vitest results.json showing all 5 existing tests passing;
  git status/log confirming this implementation is uncommitted and not yet Review-Agent-verified.
Known Risks: Finding F-01 continues to block only the "active TimeEntry exists" branch of
  DT-005 - this sprint works around it with an explicit escalation outcome rather than
  guessing. DT-001-DT-003 remain uncommitted and unreviewed in the working tree; Sprint 002's
  assumptions depend on their current contracts (Section 0) and should be re-verified if they
  change before implementation.
Open Questions: F-01 mechanism definition (Technical Lead, required before DT-005 can be fully
  completed - recommended as a TS-001 addendum, per Repository Freeze Sprint's existing
  recommendation); disposition of committing/reviewing the uncommitted DT-001-DT-003
  implementation (Technical Lead); F-09/F-10 (low priority, unrelated to this sprint).
Next Responsible Role: Technical Lead / Human Architect to approve this plan and the Section 13
  prompt, and to decide whether DT-001-DT-003 should be committed and reviewed before or
  alongside Sprint 002 implementation; Development Agent (Codex / Claude Code per AGR-001) to
  execute once approved; Review Agent (ChatGPT per AGR-001) to verify implementation before
  DT-004/DT-005/DT-006 are marked complete.
Reason for Handover: Per stop condition - plan, DT mapping, prompt and handover are complete.
  No code was implemented or modified by this planning session.
Prompt for Next Role: Review this plan, in particular the DT-005 scope split (Section 6) and
  the escalation-outcome approach to Finding F-01 (Section 8, Section 12). Approve, adapt or
  reject. If approved, hand Section 13 verbatim to the Development Agent, alongside direction
  on the uncommitted DT-001-DT-003 code (Risks, above).
```

## Stop Condition

Development Sprint 002 planning is complete. No source files were created or modified. No implementation started. No Codex/Development Agent work initiated. Waiting for Technical Lead / Human Architect approval before any implementation begins.
