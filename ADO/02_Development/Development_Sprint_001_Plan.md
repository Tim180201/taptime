# Development Sprint 001 – Business Pipeline Foundation

Status: Planned
Sprint ID: DEV-SPRINT-001
Owner: Implementation Support (Claude / Cowork session, acting on behalf of Technical Lead per AGR-001)
Approval Authority: Technical Lead (ChatGPT) / Human Architect
Branch: `main` (planning only; no implementation branch created yet)
Date: 2026-07-03
Implements: DT-001 (NFC Scan Adapter), DT-002 (Assignment Resolver), DT-003 (Assignment Validator) — `ADO/02_Development/EP-007_Development_Tasks.md` (existing, authoritative task IDs, unchanged)
Related: Product Vision, Product Principles, ADR-0002/0003/0004/0005/0006/0007, TTAP-001, FB-001, TS-001, Development Task Profile (DTP-001), EP-008 Chapters 00–03, Repository Maintenance Sprint 002

This document is planning only. No production code, source files, or Development Agent work has been started. Per repository evidence review, DT-001, DT-002 and DT-003 already exist with approved objectives and acceptance criteria in `EP-007_Development_Tasks.md`; this plan does not redefine them, it extends them with a concrete implementation and handover plan.

---

## 1. Sprint Goal

Establish the first testable slice of the TapTim.e business pipeline, reframed per repository evidence and Human Architect direction as:

```text
NFC Scan Fact
  -> Assignment Resolution
  -> Assignment Validation
  -> Business Engine Boundary preparation
```

This is the entry segment of TS-001's full architecture flow (`NfcScanAdapter -> NfcScanApplicationService -> AssignmentResolver -> AssignmentValidator -> WorkEventFactory -> BusinessEngine -> ...`). Development Sprint 001 implements the first four components up to and including `AssignmentValidator`, and defines (but does not implement) the boundary contract that `WorkEventFactory`/`BusinessEngine` (DT-004/DT-005, out of scope) will consume next.

## 2. Business Objective

Per FB-001's Business Goal: enable fast, reliable, low-friction time tracking through NFC scans, reducing administrative work and manual time-tracking errors. Development Sprint 001 delivers the first verifiable proof that a scan can be turned into a resolved, validated assignment outcome without any business meaning leaking into UI, infrastructure or persistence — the precondition FB-001/TS-001/ADR-0007 all require before WorkEvent/TimeEntry logic (DT-004/DT-005) can be built on top of it.

## 3. Technical Objective

Implement, as independently testable units:

1. A technical adapter boundary that captures a raw NFC scan and exposes it as a normalized fact (DT-001).
2. An application-layer boundary that receives that fact and orchestrates the pipeline (part of DT-001/DT-002 per TS-001's `NfcScanApplicationService`).
3. Resolution of the fact to an `NfcAssignment` (DT-002).
4. Validation of whether that assignment and its target may proceed toward WorkEvent creation (DT-003).

All four run independent of any concrete NFC library, UI framework, database or backend — per ADR-0007's Implementation Rules ("Do not bind domain logic directly to NFC library APIs") and TTAP-001's Domain layer rule ("independent of UI, persistence and external infrastructure").

## 4. Scope

In scope (maps to DT-001–DT-003 in `EP-007_Development_Tasks.md`):

- Domain foundation needed for this slice: `NfcTagId`, `NfcPayload`, `NfcTag`, `NfcAssignment`, `AssignmentTarget`, `OrganizationId`, `CustomerId` (or generic Assignment Target identifier), plus the fact/result types below.
- Fact model: a `NfcTagScanned` fact type (normalized scan data, per TS-001/TTAP-001 naming — facts describe what happened, not a business decision).
- Decision result model: explicit result types for resolution (`NfcAssignmentResolved` / `NfcAssignmentRejected`) and validation (an explicit accepted/rejected/deferred validation outcome type), per FB-001 Decision Logic 1–2 and TS-001 Rejection Flow.
- Business event model: the domain events this slice actually produces (`NfcTagScanned`, `NfcAssignmentResolved`, `NfcAssignmentRejected`) as immutable, past-tense facts/events, per TTAP-001's Domain Events list and Feature_Blueprint_Standard's Events rule.
- Business Engine boundary preparation: an explicit, stubbed interface/contract for handing a validated assignment result to `WorkEventFactory` (DT-004) — interface only, no implementation, so DT-004/DT-005 have a defined contract to implement against later without this sprint guessing their behavior.
- Application use case boundary: `NfcScanApplicationService` (or equivalently named use case) that receives the fact and orchestrates adapter -> resolver -> validator, per TS-001's component table and EP-008 Chapter 01/03's "thin orchestration, no business interpretation" rule.
- Assignment resolution and validation contracts: `AssignmentResolver`, `AssignmentValidator` as defined in TS-001, implemented against an in-memory/fake data source for this sprint (no Firebase/Firestore).
- Unit-testable implementation foundation: deterministic tests for every accepted/rejected outcome documented in FB-001's Edge Cases that fall within DT-001–DT-003 (unknown tag, unreadable payload, inactive assignment, missing target, disabled customer, employee not authenticated/authorized — as applicable to resolution/validation; duplicate-scan and offline-queue edge cases are explicitly DT-004+ and out of scope here).

## 5. Out of Scope

Explicitly excluded from Development Sprint 001 (per instruction and per repository evidence on what DT-004+ own):

- UI screens, navigation, any mobile presentation layer.
- Firebase/Firestore implementation (ADR-0007 backend baseline) — use in-memory/fake persistence only.
- Authentication implementation — assume an already-authenticated `Employee`/`UserId` is passed in; do not implement login.
- Real NFC SDK integration (`react-native-nfc-manager` or native platform NFC APIs) — `NfcScanAdapter` is implemented as a port/interface with a fake or manually-triggered test double that produces the same normalized `NfcPayload` shape a real adapter would. Swapping in the real SDK later must not require changing anything above the adapter boundary — this is the explicit point of the port/adapter pattern (EP-008 Chapter 03, §7.3).
- Offline queue and synchronization implementation (DT-007/DT-008) — out of scope; do not build a queue, do not implement retry/conflict logic.
- `WorkEventFactory`, `BusinessEngine` decision logic, `TimeEntryGenerator` (DT-004/DT-005) — represented only as a stub interface boundary this sprint's code may call, never implemented. This intentionally avoids Repository Readiness Assessment Finding F-01 (duplicate-scan window / start-stop toggle mechanism undefined): that mechanism belongs to DT-004/DT-005 and is not needed to implement or test DT-001–DT-003.
- Reporting, pricing, admin portal, production deployment, full app shell.

## 6. Input Artifacts

Read and applied for this plan (repository evidence only, no inferred architecture):

- `README.md`, `ADO/README.md` — repository navigation and current status.
- `ADO/01_Architecture/Product_Vision.md`, `Product_Principles.md` — "One Tap. One Decision.", "The Engine Decides", "Everything is Auditable".
- `ADO/00_Core/Decision_Log.md`, `ADO/00_Governance/AVR-001_Artifact_Validation_Register.md` — current approval/validation state.
- ADR-0002 (NFC Assignment Model), ADR-0003 (Product Scope v1), ADR-0004 (Offline-first Core Events), ADR-0005 (Event-driven Business Engine), ADR-0006 (Domain-first Architecture), ADR-0007 (Technology Platform Baseline).
- `ADO/01_Architecture/Technical_Architecture_Profile.md` (TTAP-001) — Ubiquitous Language, Aggregate Roots, Value Objects, Domain Events, Invariants, Runtime Architecture.
- `ADO/01_Architecture/Domain_Model.md` — core domain idea (`Trigger -> Work Event -> Business Rules -> Time Entry`), NFC Assignment Model.
- `ADO/01_Architecture/Feature_Blueprints/FB-001-nfc-scan-creates-work-event.md` (FB-001) — Business/User Goal, Product Rules, Business Rules, Decision Logic 1–2, Edge Cases.
- `ADO/01_Architecture/Technical_Specifications/TS-001-nfc-scan-creates-work-event.md` (TS-001) — architecture flow, component responsibilities, layer rules, runtime flows, testing requirements.
- `ADO/01_Architecture/Development_Task_Profile.md` (DTP-001) — task structure, Definition of Done, task types.
- `ADO/02_Development/EP-007_Development_Tasks.md` — existing DT-001, DT-002, DT-003 definitions (authoritative, unchanged by this plan).
- `ADO/01_Architecture/Developer_Implementation_Manual/00_Introduction.md` through `03_Solution_Architecture.md` (EP-008 Chapters 00–03) — implementation philosophy, repository foundation, solution architecture guidance.

## 7. Implementation Assumptions

Stated explicitly so the Development Agent does not need to guess:

- An `Employee` is already authenticated and organization-scoped before this pipeline runs; login/authentication is out of scope (Section 5). The pipeline receives a caller identity, it does not establish one.
- Persistence for `NfcTag`/`NfcAssignment`/`AssignmentTarget` lookups is an in-memory or fake repository implementing the same port the real (future) Firestore-backed repository will implement. No real database is used in this sprint.
- The real NFC hardware/SDK is not available or required; `NfcScanAdapter`'s test double may be triggered manually (e.g., a test helper that supplies a raw payload) as long as it emits the same normalized fact shape a real adapter would.
- Duplicate-scan protection, start/stop toggle semantics and any other logic that requires the still-undefined mechanism (Repository Readiness Assessment Finding F-01) are explicitly not needed for DT-001–DT-003 and must not be implemented or guessed at in this sprint.
- Multi-organization / multi-tenant correctness (an assignment must belong to the calling employee's organization) is in scope for `AssignmentValidator` per FB-001's Business Rules and TS-001's Security Requirements, since it is part of "may this assignment/target create a WorkEvent," not part of the undefined DT-004/DT-005 mechanism.

## 8. Required Components

Per TS-001's component table, limited to this sprint's slice:

| Component | Responsibility (per TS-001) | Sprint 001 Implementation |
|---|---|---|
| `NfcScanAdapter` | Read platform NFC payload and normalize it. | Port/interface + fake/test-double implementation only. No real NFC SDK. |
| `NfcScanApplicationService` | Orchestrate the scan flow. | Full implementation: receives the fact, calls resolver then validator, returns/forwards the outcome. No business interpretation inside it (EP-008 Ch. 03 §5.4). |
| `AssignmentResolver` | Resolve NFC payload to assignment. | Full implementation against a fake/in-memory repository. |
| `AssignmentValidator` | Validate assignment and target. | Full implementation against a fake/in-memory repository. |
| `WorkEventFactory` (DT-004) | Create WorkEvent from valid scan context. | Not implemented. Represented only as a stub interface this sprint's validated-outcome type is shaped to be passed to later. |

## 9. Required Domain Objects

Per TTAP-001's Ubiquitous Language/Value Objects and Domain_Model.md, limited to this slice:

- `OrganizationId`, `UserId` (or `EmployeeId`) — caller identity/context (assumed pre-authenticated per Section 7).
- `NfcTagId`, `NfcPayload` — technical scan identity and normalized payload.
- `NfcTag` — the tag aggregate (as needed to resolve payload -> tag).
- `NfcAssignment` — active mapping between an `NfcTag` and an `AssignmentTarget` (per ADR-0002).
- `AssignmentTarget` — the resolved business target (v1: `Customer`/`CustomerId`, per Domain_Model.md's Initial Target Types table).
- A validation outcome type (e.g. `AssignmentValidationResult`) expressing accepted/rejected (and, if evidence supports it, deferred) with an explicit, observable reason for rejection — per FB-001's "The employee shall receive a clear outcome for accepted, rejected, duplicate or deferred scans" (duplicate/deferred beyond simple accept/reject remain DT-004+ concerns; DT-003 only needs accepted/rejected here).

No new central Domain Object is introduced beyond what TTAP-001/FB-001 already name — consistent with FB-001's own statement, "No new central domain object is introduced by this blueprint."

## 10. Required Interfaces

- `NfcScanPort` (or equivalent name) — the contract `NfcScanAdapter` implements; the fake test double and the future real adapter both implement this same port.
- `NfcTagRepository` / `NfcAssignmentRepository` (or a combined read port) — the contract `AssignmentResolver`/`AssignmentValidator` depend on; implemented in-memory for this sprint, swappable for a Firestore-backed implementation later without changing resolver/validator logic (ADR-0007 Implementation Rules).
- `WorkEventCreationPort` (or equivalent stub) — the contract that will receive an accepted `AssignmentValidationResult` and hand it to `WorkEventFactory` (DT-004). Defined as a boundary interface only in this sprint (e.g., a single method signature and its input/output shape); no implementation, no business logic.

## 11. Required Application Use Cases

- `SubmitScanFactUseCase` (or equivalently named), per EP-008 Chapter 01 §7.3's "Explicit Fact Submission" pattern: receives a `NfcTagScanned` fact from the adapter boundary, validates input shape only (not business meaning), and delegates to `AssignmentResolver` then `AssignmentValidator`.
- This use case must not decide accept/reject itself (EP-008 Ch. 03 §5.4, "Application Orchestrates But Does Not Interpret") — it forwards facts and returns/forwards results.

## 12. Business Engine Boundary

For Development Sprint 001, the "Business Engine Boundary" consists of the decision logic already owned by `AssignmentResolver` (resolve vs. reject an unknown/unreadable tag) and `AssignmentValidator` (accept vs. reject an inactive assignment, missing target, disabled customer, or unauthorized employee/organization mismatch) — per FB-001 Decision Logic 1 ("Resolve NFC Assignment") and Decision Logic 2 ("Validate Assignment Target").

The literal `BusinessEngine` component named in TS-001 (which interprets a created `WorkEvent` into a `TimeEntry` start/stop/defer/reject outcome, DT-005) is **not** part of this sprint. It is represented only by the stub `WorkEventCreationPort` (Section 10) so DT-001–DT-003 code has a defined seam to call, without this sprint inventing what happens on the other side of it.

Both AssignmentResolver and AssignmentValidator decisions must be deterministic (same input -> same output), must not depend on UI state, wall-clock time (beyond what is explicitly passed in), or any infrastructure side effect, per EP-008 Chapter 01 §5.8/§7.4.

## 13. Testing Strategy

Per EP-008 Chapter 01 §7.7 and Chapter 03 §7.6 (testing philosophy) and TS-001's Testing Requirements:

- **Business decision tests** (deterministic, no UI/infrastructure dependencies): `AssignmentResolver` and `AssignmentValidator` outcomes for every applicable FB-001 edge case within scope — unknown tag, unreadable payload, inactive assignment, missing assignment target, disabled customer, employee not authenticated, employee lacks organization access. Each case asserts an explicit accepted/rejected result with an observable reason, never a silent fallthrough.
- **Application tests**: `NfcScanApplicationService` / `SubmitScanFactUseCase` orchestration — verify it calls resolver then validator in order, forwards facts and results without altering them, and does not itself decide accept/reject.
- **Adapter tests**: `NfcScanAdapter`'s fake/test-double implementation — verify it exposes a normalized `NfcPayload` matching the `NfcScanPort` contract; do not test real hardware/SDK behavior (none exists yet).
- **Domain tests**: invariants on `NfcAssignment`/`AssignmentTarget`/value objects as applicable (e.g., an `NfcAssignment` cannot resolve to a missing target).
- Explicitly **not** required this sprint: duplicate-scan protection tests, offline/queue tests, synchronization tests, `WorkEventFactory`/`BusinessEngine`/`TimeEntryGenerator` tests (DT-004/DT-005 own these).

## 14. Definition of Done

Per DTP-001's Definition of Done, applied to this sprint:

- DT-001, DT-002, DT-003 implementations exist, matching their existing Objective/Acceptance Criteria in `EP-007_Development_Tasks.md` (unchanged).
- All tests in Section 13 are written and passing.
- No Business Rule or decision logic exists inside UI, persistence or infrastructure code (architecture compliance, TTAP-001/TS-001/ADR-0007).
- `WorkEventCreationPort` (or equivalent) exists as an interface only — verified that no implementation or business logic was added to it.
- No real NFC SDK, Firebase/Firestore, or authentication implementation was introduced.
- Role Handover (Section 17 pattern) produced by the Development Agent, per EOM-001.
- Development Task status in `EP-007_Development_Tasks.md` updated for DT-001–DT-003 only after Review Agent verification — not by the Development Agent unilaterally.

## 15. Implementation Order

```text
1. Domain objects and value objects (Section 9) + NfcScanPort / repository ports (Section 10)
2. NfcScanAdapter fake/test-double (DT-001)
3. AssignmentResolver against in-memory repository (DT-002)
4. AssignmentValidator against in-memory repository (DT-003)
5. NfcScanApplicationService / SubmitScanFactUseCase orchestrating 2-4
6. WorkEventCreationPort stub interface (no implementation)
7. Tests for every layer above, per Section 13
8. Role Handover
```

This order matches the existing DT-001 -> DT-002 -> DT-003 sequence already documented in `EP-007_Development_Tasks.md`'s Task Sequence diagram; it is not a reordering.

## 16. Handover to Development Agent

See Section 18 (Development Agent Prompt) for the literal prompt. Summary: the Development Agent (Codex / Claude Code, per AGR-001) implements DT-001–DT-003 exactly as scoped above, does not touch UI/Firebase/NFC SDK/sync, writes the tests in Section 13, and stops for Role Handover and Review Agent verification before any further Development Task begins.

---

## 17. Development Task Breakdown

DT-001, DT-002 and DT-003 already exist, are Decision-Log-registered (`EP-007-DT`), and are **not redefined** by this plan. Their Objective and Acceptance Criteria in `ADO/02_Development/EP-007_Development_Tasks.md` remain authoritative and unchanged. This sprint plan extends them with the concrete implementation breakdown in Sections 8–15 above, and (see Changed Artifacts in the Role Handover) adds a "Development Sprint 001 Implementation Notes" subsection directly under each of DT-001, DT-002 and DT-003 in that file, cross-referencing this plan.

No task beyond DT-003 is created, per instruction. The `WorkEventCreationPort` stub (Section 10) is deliberately not a new Development Task — it is an interface produced as part of DT-002/DT-003's own acceptance criteria ("Domain and Business Engine do not depend on NFC library APIs" / clean handoff), not a unit of work in its own right.

---

## 18. Development Agent Prompt

The following is the literal prompt for the Development Agent (Codex / Claude Code, per AGR-001):

```text
You are the Development Agent for TapTim.e.

Task: Implement Development Sprint 001 - Business Pipeline Foundation.

Scope: Implement ONLY the following existing Development Tasks, exactly as defined in
ADO/02_Development/EP-007_Development_Tasks.md (do not change their Objective or
Acceptance Criteria):
- DT-001 - NFC Scan Adapter
- DT-002 - Assignment Resolver
- DT-003 - Assignment Validator

Read before implementing, in this order:
1. ADO/01_Architecture/Technical_Architecture_Profile.md (TTAP-001)
2. ADO/01_Architecture/Feature_Blueprints/FB-001-nfc-scan-creates-work-event.md (FB-001)
3. ADO/01_Architecture/Technical_Specifications/TS-001-nfc-scan-creates-work-event.md (TS-001)
4. ADO/02_Development/EP-007_Development_Tasks.md (DT-001, DT-002, DT-003 sections)
5. ADO/02_Development/Development_Sprint_001_Plan.md (this plan, Sections 1-17)
6. ADO/01_Architecture/Developer_Implementation_Manual/ Chapters 00-03

Pipeline to implement:
NFC Scan Fact -> Assignment Resolution -> Assignment Validation -> Business Engine Boundary
(stub only)

You MUST:
- Implement NfcScanAdapter as a port/interface plus a fake or manually-triggered test
  double. Do NOT integrate a real NFC SDK or native platform NFC API.
- Implement AssignmentResolver and AssignmentValidator against an in-memory or fake
  repository. Do NOT implement Firebase/Firestore or any real database.
- Implement NfcScanApplicationService (or equivalently named use case) that orchestrates
  adapter -> resolver -> validator. It must not itself decide accept/reject.
- Define a WorkEventCreationPort (or equivalent) as an interface ONLY - no implementation,
  no business logic. This is the seam for DT-004 (WorkEventFactory), which is out of scope.
- Keep all business meaning (resolve/reject, validate/reject) inside AssignmentResolver
  and AssignmentValidator. No UI, persistence, adapter or infrastructure code may decide
  these outcomes.
- Write deterministic unit tests for every FB-001 edge case in scope: unknown tag,
  unreadable payload, inactive assignment, missing assignment target, disabled customer,
  employee not authenticated, employee lacks organization access.
- Write application-level tests verifying orchestration only (no business rule
  duplication).
- Preserve all architecture boundaries and dependency directions defined in TTAP-001 and
  EP-008 Chapter 03 (domain independent of UI/infrastructure/NFC libraries).

You MUST NOT:
- Build any UI screen, navigation, or mobile presentation code.
- Implement Firebase, Firestore, or any authentication flow.
- Integrate a real NFC SDK or native NFC intent handling.
- Implement offline queue or synchronization logic (DT-007/DT-008).
- Implement WorkEventFactory, BusinessEngine decision logic, or TimeEntryGenerator
  (DT-004/DT-005) - stub the boundary only, per WorkEventCreationPort above.
- Invent a duplicate-scan protection mechanism or start/stop toggle rule. This is
  explicitly undefined (Repository Readiness Assessment Finding F-01) and out of scope
  for DT-001-DT-003. If you believe you need it, stop and escalate instead of guessing.
- Create new Development Task IDs. If you believe additional foundation work is required
  beyond DT-001-DT-003, propose it in your Role Handover instead of implementing it.

When you finish, or if you must stop early:
- Produce the mandatory Role Handover per EOM-001 (Current Role, Status, Completed Work,
  Created Artifacts, Evidence, Known Risks, Open Questions, Next Responsible Role, Reason
  for Handover, Prompt for Next Role).
- Do not mark DT-001/DT-002/DT-003 status as complete in EP-007_Development_Tasks.md
  yourself - that follows Review Agent verification per DTP-001's Definition of Done.
- Stop. Do not continue into DT-004 or any later task without explicit approval.
```

---

## 19. Role Handover

```text
ROLE HANDOVER

Current Role: Implementation Support (acting on behalf of Technical Lead per AGR-001, this session)
Status: COMPLETED (planning only)
Completed Work: Created Development Sprint 001 plan (Sections 1-16), confirmed DT-001/DT-002/
  DT-003 as the existing, unchanged, authoritative task definitions to implement, defined the
  Development Agent prompt (Section 18), extended EP-007_Development_Tasks.md with
  sprint-specific implementation notes under DT-001-DT-003 (see Changed Artifacts below),
  added Decision Log traceability and ADO/README.md navigation for this sprint.
Created Artifacts: ADO/02_Development/Development_Sprint_001_Plan.md (this document).
Changed Artifacts: ADO/02_Development/EP-007_Development_Tasks.md (added "Development Sprint
  001 Implementation Notes" subsections under DT-001, DT-002, DT-003 - Objective/Acceptance
  Criteria unchanged); ADO/00_Core/Decision_Log.md (new row); ADO/README.md (navigation pointer).
Evidence: Direct reading of TTAP-001, FB-001, TS-001, Domain_Model.md, EP-007_Development_Tasks.md,
  DTP-001, EP-008 Chapters 00-03, Decision Log, AVR-001, prior Human Architect clarification
  resolving the DT-001-003 ID collision (this session).
Known Risks: WorkEventCreationPort's exact shape may need revision once DT-004 is actually
  planned - it is intentionally minimal/stubbed and not treated as approved architecture, only
  as a placeholder seam. Repository Readiness Assessment Finding F-01 remains open and continues
  to block DT-004/DT-005, not this sprint.
Open Questions: None blocking DT-001-DT-003. F-01 (duplicate-scan mechanism), F-05 (Product
  Vision status), F-06/F-09/F-10 (low-priority hygiene) remain open from prior sprints and are
  unaffected by this plan.
Next Responsible Role: Technical Lead / Human Architect to approve this plan and the Development
  Agent prompt; Development Agent (Codex / Claude Code per AGR-001) to execute once approved;
  Review Agent (ChatGPT per AGR-001) to verify implementation before DT-001-DT-003 are marked
  complete.
Reason for Handover: Per stop condition - plan, task breakdown, prompt and handover are complete.
  No code, no source files, no Development Agent work started.
Prompt for Next Role: Review this plan and the Section 18 prompt. Approve, adapt or reject.
  If approved, hand Section 18 verbatim to the Development Agent. Do not start implementation
  without this approval.
```

## Stop Condition

Development Sprint 001 planning is complete. No source files created. No implementation started. No Codex/Development Agent work initiated. Waiting for Technical Lead / Human Architect approval before any implementation begins.
