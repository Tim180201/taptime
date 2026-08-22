# Development Sprint 012 Plan – Organization Domain & Repository (DT-017)

Status: Planned
Role: Research / Implementation Support acting on behalf of Technical Lead (per AGR-001)
Epic: EP-007 – Product Architecture Foundation (implementation), governed in priority by EP-009 – Product Readiness Framework
Owner: Technical Lead
Approval Authority: Human Architect
Branch: `main`
Created Date: 2026-07-07
Related Development Task: DT-017 – Organization Domain & Repository (only)
Related Feature Blueprint / Technical Specification: FB-002 – Organization Management Foundation; TS-002 – Organization Management Foundation Technical Specification
Related Artifacts: `EP-007_Development_Tasks.md` (DT-017–DT-026), `Decision_Log.md`, `Project_Status.md`, `Development_Sprint_011_Closure.md`, `EP-009_Product_Readiness_Framework.md`, `Product_Readiness_Assessment.md`, `Product_Readiness_Roadmap.md`, EP-008 Chapters 00–03

---

## 1. Executive Summary

FB-002 and TS-002 have completed Technical Lead review, and the DT-017–DT-026 Development Task decomposition has been approved. Development Sprint 012 begins the Organization Management implementation sequence with the smallest possible first unit: **DT-017 – Organization Domain & Repository only**. No other Development Task (DT-018–DT-026) is part of this sprint.

DT-017 is the correct first implementation unit because every other Organization Management task depends on it, directly or transitively (`EP-007_Development_Tasks.md`'s Task Sequence diagram): Membership (DT-018) cannot reference an Organization that does not yet exist as a real domain object; the Administration flows (DT-023–DT-025) cannot be authorized or scoped without one; the integration verification (DT-026) has nothing to verify against without one. DT-017 itself has no dependency on anything Organization Management-specific — only on idioms this repository already established across DT-001–DT-016 (the branded-ID pattern, the constructor-seeded in-memory repository pattern, the constructor-function domain-event pattern, the barrel-export convention).

This sprint is deliberately narrow: it adds one new domain object, one new port, one new in-memory adapter, one new event, and one new orchestration service — nothing else. It has **zero runtime dependency on the existing FB-001 scan pipeline** (`AssignmentResolver`, `AssignmentValidator`, `WorkEventFactory`, `BusinessEngine`, `NfcScanApplicationService`) and touches no file any of them depend on. This is the safest possible starting point for Organization Management implementation: if anything about the approach needs correcting, it is corrected before any component with a dependent (DT-018 depends on DT-017; nothing yet depends on DT-018) exists.

## 2. Repository Evidence

- `FB-002-organization-management-foundation.md`, Capability 1 (Organization): "A real Organization exists as the owning business container," and Decision 1 (Create Organization): "Organization creation has no dependency on any other Organization's data."
- `TS-002-organization-management-foundation.md`, Domain Model: `Organization` is "new. Minimal shape: an identifier (`OrganizationId`, already existing) plus a human-readable `name`... `status` is therefore not included now." Ports: `OrganizationRepository` — "new, because no `Organization` type or repository exists at all today." Application Services: `OrganizationManagementService` — "One responsibility: create an Organization... Owns no business rule beyond 'an Organization can always be created.'"
- `EP-007_Development_Tasks.md`, DT-017 section (as approved, including the Technical Lead review follow-up wording): Objective, Acceptance Criteria, Implementation Boundary, Testing Expectations, Out of Scope, Dependencies — used verbatim as this sprint's scope baseline (Section 10, below).
- Direct code inspection confirms the precedents this sprint reuses: `packages/core/src/domain/ids.ts`'s `Brand<Value, BrandName>`/`brandedNonEmptyString` factory (already used for `OrganizationId` itself); `packages/core/src/infrastructure/repositories/InMemoryCustomerRepository.ts`'s constructor-seeded-array pattern (`constructor(private readonly customers: readonly Customer[] = [])`); `packages/core/src/domain/events/WorkEventCreated.ts`'s `{ type, <payload> }` interface plus constructor-function pattern; `packages/core/src/index.ts`'s exhaustive `export * from` barrel convention, grouped by domain/ports/business/application/infrastructure.
- `Product_Readiness_Assessment.md` Section 11.1 and `Product_Readiness_Roadmap.md` ("Now" / "Before Pilot Customers" milestones) both name Organization Management as the primary Product Capability bottleneck for reaching pilot customers — the reason this Development Sprint exists at all, though DT-017 alone does not close that bottleneck (Section 13, EP-009 Product Readiness Impact, below).
- `Development_Sprint_011_Closure.md` recorded, as one of two parallel next priorities, "Human Architect initiation of FB-002 (Organization Management) drafting" — since satisfied by FB-002, TS-002, and the DT-017–DT-026 decomposition; this sprint is the first implementation step following that chain.

## 3. Why DT-017 Is Selected (and Why Nothing Else Is)

The Primary Planning Question is how DT-017 should be implemented as the smallest safe Development Sprint while preserving the existing architecture. Repository evidence answers this in two parts.

**Why DT-017, not any other DT-01x/02x task:** `EP-007_Development_Tasks.md`'s own Task Sequence diagram places DT-017 first for a structural reason, not merely a numbering one — every subsequent task either directly depends on it (DT-018: "an Organization must exist for a Membership to reference") or transitively depends on it through DT-018/DT-019 (DT-023–DT-025) or through the whole chain (DT-026). No Organization Management task can be implemented before DT-017 without violating a stated Dependency. DT-020, DT-021 and DT-022 (the repository write extensions) have no dependency on DT-017 and could in principle be implemented in any order relative to it — but they are not part of this sprint either, because Sprint Scope (Section 6) is explicitly limited to DT-017 alone, per the assigning task's own instruction, not because repository evidence requires excluding them.

**Why DT-017 alone, not DT-017 plus a "quick" adjacent task:** DT-017 is self-contained — it introduces no shared file that a second task would also need to touch, and it has no partial-completion risk (all five of its components — domain object, port, adapter, event, service — are small enough to implement, test and review together as one coherent unit, unlike, for example, DT-013/DT-014's necessary split across two sessions). Combining it with DT-018 would reintroduce exactly the kind of "oversized Development Task" the Technical Lead's principles explicitly ask this decomposition to avoid; combining it with any later task would violate that task's own stated Dependency on DT-017 being complete and reviewed first. The smallest safe Development Sprint is therefore DT-017 by itself.

## 4. Business Objective

Begin replacing the single, shared, hard-coded `'demo-org'` fixture with real, creatable Organization data — the first concrete step toward a repository state where a genuine pilot customer's business is represented as its own Organization, not as a copy of the demo. This does not by itself make TapTim.e pilot-ready (Section 13, below); it is the necessary first step of the Organization Management capability the Product Readiness Assessment identifies as the primary bottleneck to reaching one.

## 5. Technical Objective

Implement the `Organization` domain object, the `OrganizationRepository` port, its `InMemoryOrganizationRepository` implementation, the `OrganizationCreated` domain event, and the `OrganizationManagementService` application service — exactly as specified in TS-002's Domain Model, Ports and Application Services sections and in DT-017's Acceptance Criteria — with zero change to any existing file outside these five new additions plus their barrel-export registration and their tests.

## 6. Scope

Per the assigning task, Development Sprint 012 includes only DT-017. The sprint plans implementation of:

- `Organization` domain object (`OrganizationId` + `name`; no `status` field).
- `OrganizationRepository` port (`findById(id: OrganizationId): Organization | null` + a save/create method).
- `InMemoryOrganizationRepository` adapter implementing the port.
- `OrganizationCreated` domain event (carries the created `Organization`).
- `OrganizationManagementService` (constructs an `Organization`, calls the repository's save method, produces `OrganizationCreated`).
- Unit tests for all of the above.
- Barrel-export registration in `packages/core/src/index.ts`, matching the existing convention exactly.

## 7. Out of Scope

Explicitly excluded from this sprint, per the assigning task:

- DT-018 (Membership Domain & Repository), DT-019 (MembershipAuthorizationValidator), DT-020 (`CustomerRepository` write extension), DT-021 (`NfcTagRepository` write extension), DT-022 (`NfcAssignmentRepository` write extension), DT-023 (`OrganizationAdministrationService`), DT-024 (NFC Tag Registration), DT-025 (NFC Tag Assignment), DT-026 (Scan Pipeline Integration Verification).
- Any UI, any mobile work, any CLI command that calls `OrganizationManagementService` — none is built by this sprint; `OrganizationManagementService` exists as a callable class with no entry point yet, exactly as TS-002 anticipates ("Mobile / UI... not touched by TS-002").
- Any Identity work, any `AuthenticationGateway` change, any `FakeAuthenticationGateway` change.
- Any Membership bootstrap decision (the "who authorizes the first Administrator" open question) — irrelevant to this sprint, since no Membership work begins here at all.
- Any backend/cloud persistence technology, database schema, or API design.
- Any change to FB-001/TS-001's scan pipeline.
- Any change to `BusinessEngine`, `AssignmentResolver`, `AssignmentValidator`, `WorkEventFactory`, `NfcScanApplicationService`, `CallerContext`, `OfflineQueue`, `SynchronizationService`, or error handling (`ErrorCategory`/`classify*` functions).
- Any change to FB-002, TS-002, EP-008, `Product_Readiness_Assessment.md`, or `Product_Readiness_Roadmap.md`.

## 8. Existing Components Reused (Patterns, Not Code)

Unlike Development Sprint 011 (DT-016), which reused an existing *runtime* component (`NfcScanPort`) directly, DT-017 introduces a new, freestanding domain slice with **no runtime dependency on any existing pipeline component**. What it reuses is *pattern*, not code:

| Existing Precedent | File | Reused As |
|---|---|---|
| Branded ID factory | `packages/core/src/domain/ids.ts` (`Brand<Value, BrandName>`, `brandedNonEmptyString`) | `OrganizationId` already exists via this pattern; no new ID type is needed for DT-017 itself (`MembershipId` is DT-018's concern). |
| Constructor-seeded in-memory repository | `packages/core/src/infrastructure/repositories/InMemoryCustomerRepository.ts` | Exact structural template for `InMemoryOrganizationRepository`. |
| Constructor-function domain event | `packages/core/src/domain/events/WorkEventCreated.ts` | Exact structural template for `OrganizationCreated`. |
| "Orchestrates but does not interpret" Application Service boundary | `packages/core/src/application/NfcScanApplicationService.ts` (EP-008 Ch03 §2.3) | `OrganizationManagementService` follows the same boundary: it owns no business rule beyond "an Organization can always be created" (TS-002). |
| Exhaustive barrel export | `packages/core/src/index.ts` | New export lines added in the same grouped, `export * from` style — no new export convention introduced. |

No component from `business/`, the FB-001 scan pipeline, `OfflineQueue`, `SynchronizationService`, or `CallerContext` is called, imported, or otherwise touched by DT-017.

## 9. Components to Implement

Repository reality confirms the paths the assigning task proposed already match this repository's existing sibling-file conventions exactly (verified by direct inspection of `packages/core/src/domain/`, `ports/`, `infrastructure/repositories/`, `domain/events/`, `application/` — each already contains files of the corresponding kind in exactly these locations). No alternative location is better-justified; the proposed paths are used as-is.

| Component | Type | Location |
|---|---|---|
| `Organization` | Domain object | `packages/core/src/domain/Organization.ts` |
| `OrganizationCreated` | Domain event | `packages/core/src/domain/events/OrganizationCreated.ts` |
| `OrganizationRepository` | Port | `packages/core/src/ports/OrganizationRepository.ts` |
| `InMemoryOrganizationRepository` | Infrastructure adapter | `packages/core/src/infrastructure/repositories/InMemoryOrganizationRepository.ts` |
| `OrganizationManagementService` | Application service | `packages/core/src/application/OrganizationManagementService.ts` |

## 10. Development Task Mapping

DT-017 – Organization Domain & Repository, used exactly as approved in `EP-007_Development_Tasks.md` (no re-derivation, no reinterpretation):

- **Objective:** Introduce `Organization` as a real domain object (currently only `OrganizationId` exists), an `OrganizationRepository` port with an in-memory implementation, and an `OrganizationManagementService` that creates an Organization.
- **Acceptance Criteria:** `Organization` exists as `OrganizationId` + `name`, no `status` field; `OrganizationRepository` exists with `findById` and a save/create method; `InMemoryOrganizationRepository` implements it, following `InMemoryCustomerRepository`'s pattern; `OrganizationManagementService` constructs an `Organization` and calls the save method, producing `OrganizationCreated`; Organization creation has no precondition beyond the request itself; unit tests cover the repository's find/save round-trip and not-found case, and the service producing `OrganizationCreated` with correct fields.
- **Dependencies (per EP-007_Development_Tasks.md):** TS-002 (Domain Model / Ports / Application Services sections), FB-002 (Capability 1). None on DT-001–DT-016 beyond the `ids.ts`/domain-event idiom.
- **Implementation Boundary:** `Customer`, `NfcTag`, `NfcAssignment`, `AssignmentTarget`, `CallerContext`, any existing port, any existing repository, any existing Application Service, `BusinessEngine`, `AssignmentResolver`, `AssignmentValidator`, `WorkEventFactory` — none may be touched.

No other Development Task is mapped to this sprint.

## 11. Testing Strategy

- `npm run typecheck --workspace=@taptime/core` — must pass with no errors.
- `npm run test --workspace=@taptime/core` — must pass; all pre-existing tests (154 as of Development Sprint 011) must remain green, plus new tests for `InMemoryOrganizationRepository` (find/save round-trip, not-found case) and `OrganizationManagementService` (produces `OrganizationCreated` with correct fields).
- No `apps/mobile` tests are expected or required — DT-017 adds no `apps/mobile` code and no `apps/mobile` file is touched.
- No physical-device validation is relevant to DT-017 — it introduces no NFC, mobile, or hardware-facing code.
- Explicit non-regression check: `git diff --stat` outside the five new files (Section 9), their tests, and the `index.ts` export additions must be empty.

## 12. Risks

| Risk | Mitigation |
|---|---|
| Inventing an `Organization.status` field "for completeness," not required by any Decision Logic | Acceptance Criteria (Section 10) and TS-002 explicitly exclude it; the Development Agent Prompt (Section 16) states this directly. |
| Scope creep into DT-018 ("since Organization is done, Membership is a natural next small step") | Out of Scope (Section 7) explicitly names DT-018–DT-026 as excluded; the Stop Condition (Section 18) reinforces stopping after DT-017. |
| `OrganizationManagementService` accidentally acquiring a business rule of its own (e.g., name-uniqueness validation not specified anywhere) | TS-002 states the service "owns no business rule beyond 'an Organization can always be created'"; any such validation would be an undocumented, unapproved addition — Acceptance Criteria do not require it, and it must not be added. |
| Naming/location drift from the sibling-file conventions this sprint depends on for reviewability | Section 9 confirms proposed paths already match repository reality; no deviation is expected, but if the Development Agent finds one is necessary, it must be documented with reasoning, per this repository's standing "repository reality has priority" practice. |
| Under-testing the "not-found" branch of `InMemoryOrganizationRepository.findById`, mirroring the kind of untested-typed-state gap DT-007 disclosed for `QueuedWorkEventRecord.decision: null` | Acceptance Criteria explicitly require a dedicated not-found-case test; call this out directly in the Development Agent Prompt's testing requirements (Section 16). |

## 13. EP-009 Product Readiness Impact

Evaluated per EP-009's domain list (`EP-009_Product_Readiness_Framework.md`), using repository evidence only, consistent with every prior sprint closure's per-domain discipline:

- **Engineering Readiness:** Marginally, positively affected — proves the domain/port/adapter/event/service pattern for a net-new Organization capability, extending (not redesigning) the architecture established by DT-001–DT-016. Not a tier-level change by itself; it is one of ten planned Organization Management tasks.
- **Product Readiness:** **Unchanged.** No product-facing or pilot-facing capability exists after DT-017 alone — `OrganizationManagementService` has no caller anywhere in the repository (no CLI, no UI, no test-only demo entry point beyond its own unit tests). An Organization can be constructed and saved in a test, but nothing in the running system (CLI demo or `apps/mobile`) can create one yet.
- **Customer Readiness:** **Unchanged.** A pilot customer's Organization cannot be created through any user-facing or operator-facing path after this sprint; that requires DT-023 at minimum (an Administrator-facing creation flow) and, more completely, DT-017–DT-026 together plus a future entry point.
- **Deployment Readiness:** **Unchanged.** No new dependency, no new persistence technology, no deployment-relevant change.
- **Technical Operations Readiness:** **Unchanged.** No operational tooling, monitoring, or runbook implication.
- **Scaling Readiness:** **Unchanged.** In-memory-only implementation, consistent with every other repository added at this stage of the pattern (e.g., DT-007's `InMemoryOfflineQueue` before DT-015's durable adapter); no scaling property is introduced or resolved.

**Explicit statement, per the assigning task's own instruction:** DT-017 is foundational. It will not, by itself, make TapTim.e pilot-ready. It begins the Organization capability required for pilot readiness, one of ten Development Tasks (DT-017–DT-026) that collectively — and, even then, likely alongside a future Identity-layer Feature Blueprint and an actual admin-facing entry point not yet designed — are what would eventually move the Product/Customer Readiness domains. No domain's tier is claimed to change as a result of this sprint alone.

## 14. Definition of Done

For the eventual implementation and closure of this sprint (not performed by this planning task itself — see Stop Condition):

- `Organization`, `OrganizationRepository`, `InMemoryOrganizationRepository`, `OrganizationCreated`, `OrganizationManagementService` exist exactly as specified in Sections 6/9/10.
- `npm run typecheck --workspace=@taptime/core` and `npm run test --workspace=@taptime/core` both pass; all pre-existing tests remain green.
- `git diff` confirms zero changes to any file outside the five new files, their tests, and `packages/core/src/index.ts`'s export additions.
- `EP-007_Development_Tasks.md`'s DT-017 "Implementation Notes" placeholder is filled in with the actual implementation summary, at closure time (not part of this planning task).
- Review Agent verification and Human Architect approval are recorded before DT-017 is marked Completed (DTP-001: "Implementation alone never completes a Development Task").

## 15. Recommended Implementation Order

1. Add the `Organization` domain object.
2. Add the `OrganizationCreated` domain event.
3. Add the `OrganizationRepository` port.
4. Add `InMemoryOrganizationRepository`.
5. Add `OrganizationManagementService`.
6. Register all five in `packages/core/src/index.ts`'s barrel export, in the existing grouped style (domain, then events, then ports, then infrastructure, then application — matching the file's current section ordering).
7. Add unit tests for the repository (round-trip, not-found) and the service (produces `OrganizationCreated` with correct fields).
8. Run `npm run typecheck --workspace=@taptime/core` and `npm run test --workspace=@taptime/core`; confirm `git diff --stat` touches only the expected files.

Repository evidence supports this order directly: each step's output is a precondition for the next (the event must exist before the service can produce it; the port must exist before the in-memory adapter can implement it; the adapter must exist before the service can call it), and testing is deliberately last, after all production code exists, consistent with DT-001–DT-016's own established order.

---

## 16. Development Agent Prompt

The following prompt is written to be given directly to Claude Code (Development Agent) to execute Development Sprint 012. It is self-contained and does not require this planning document to be re-explained.

```text
You are the Development Agent for TapTim.e, implementing Development Sprint 012 ("Organization Domain & Repository," DT-017 only) on branch `main`.

CONTEXT (verify before writing code):
- Read `ADO/02_Development/Development_Sprint_012_Plan.md` in full — it is the authoritative scope for this task.
- Read `ADO/01_Architecture/Feature_Blueprints/FB-002-organization-management-foundation.md` (Capability 1) and `ADO/01_Architecture/Technical_Specifications/TS-002-organization-management-foundation.md` (Domain Model, Ports, Application Services sections) — the product/technical basis for what you are building.
- Read `ADO/02_Development/EP-007_Development_Tasks.md`'s "## DT-017 – Organization Domain & Repository" section — your exact Objective, Acceptance Criteria, Implementation Boundary and Dependencies.
- Read these existing files as your structural templates, exactly: `packages/core/src/domain/ids.ts` (branded ID pattern — `OrganizationId` already exists here, you do not need a new ID type), `packages/core/src/infrastructure/repositories/InMemoryCustomerRepository.ts` (constructor-seeded in-memory repository pattern), `packages/core/src/domain/events/WorkEventCreated.ts` (constructor-function domain event pattern), `packages/core/src/application/NfcScanApplicationService.ts` (the "orchestrates but does not interpret" Application Service boundary your new service must also follow), `packages/core/src/index.ts` (the barrel-export convention).
- Do not modify DT-001–DT-016 business/application/domain/infrastructure code, FB-001, TS-001, TTAP-001, any ADR, Product Vision, Product Principles, Domain Model, Role Model, EP-008, EP-009, FB-002, or TS-002.

IMPLEMENTATION SCOPE (do exactly this, nothing more):
1. Create `Organization` in `packages/core/src/domain/Organization.ts`: a domain object with `id: OrganizationId` and `name: string`. Do NOT add a `status` field — TS-002 explicitly excludes it as not required by any Decision Logic.
2. Create `OrganizationCreated` in `packages/core/src/domain/events/OrganizationCreated.ts`, following `WorkEventCreated.ts`'s exact shape: a `type: 'OrganizationCreated'` discriminant plus the created `Organization`, and a constructor function.
3. Create the `OrganizationRepository` port in `packages/core/src/ports/OrganizationRepository.ts`: `findById(id: OrganizationId): Organization | null` plus one save/create method (name it consistently with this repository's existing verb choices — e.g. `save`).
4. Create `InMemoryOrganizationRepository` in `packages/core/src/infrastructure/repositories/InMemoryOrganizationRepository.ts`, implementing `OrganizationRepository`, following `InMemoryCustomerRepository.ts`'s exact structural pattern (constructor-seeded array, plus your new save method appending to that array — you decide the exact in-memory mechanics, consistent with how this repository's other `InMemory*` adapters already behave).
5. Create `OrganizationManagementService` in `packages/core/src/application/OrganizationManagementService.ts`: constructs an `Organization` (generate its `OrganizationId` the same way other domain objects in this repository generate IDs — see `packages/core/src/domain/generateId.ts` and how `WorkEventFactory`/`BusinessEngine` use it), calls `OrganizationRepository`'s save method, and returns/produces `OrganizationCreated`. This service owns no business rule beyond "an Organization can always be created" — do not add name validation, uniqueness checks, or any other rule not explicitly required by DT-017's Acceptance Criteria.
6. Register all five new exports in `packages/core/src/index.ts`, in the same grouped, `export * from` style already used there (domain object near the other domain exports, event near the other event exports, port near the other port exports, in-memory adapter near the other infrastructure exports, service near the other application exports).

ARCHITECTURE BOUNDARIES (do not violate):
- Do not touch `Customer`, `NfcTag`, `NfcAssignment`, `AssignmentTarget`, `CallerContext`, or any existing port, repository, business class, or Application Service.
- Do not touch `BusinessEngine`, `AssignmentResolver`, `AssignmentValidator`, `WorkEventFactory`, `NfcScanApplicationService`, `OfflineQueue`, `SynchronizationService`, or any error-classification function.
- Do not touch `apps/mobile`, `packages/core/src/cli/runScan.ts`, or any CLI entry point — no wiring of `OrganizationManagementService` into anything runnable is part of this sprint.
- Do not implement DT-018 (Membership), DT-019 (MembershipAuthorizationValidator), or any other Development Task — this sprint is DT-017 only.
- Do not add a `status` field to `Organization` and do not add any authorization/permission check anywhere in this sprint's code (Membership and its authorization validator do not exist yet).

TESTING REQUIREMENTS:
- Unit tests for `InMemoryOrganizationRepository`: a save-then-find-by-id round-trip test, and an explicit not-found-case test (find-by-id for an id that was never saved returns `null`) — do not skip the not-found case.
- Unit tests for `OrganizationManagementService`: verify it produces an `OrganizationCreated` event carrying the correct `Organization` fields, and that the repository's save method was called with that same `Organization`.
- Run `npm run typecheck --workspace=@taptime/core` and `npm run test --workspace=@taptime/core`; both must pass, with all pre-existing tests remaining green, before you consider the task done.
- Confirm via `git diff --stat` that only the five new files, their tests, and `packages/core/src/index.ts` were changed.

EXPECTED DELIVERABLES:
- The five new files and their tests, committed with a clear commit message referencing DT-017 and Development Sprint 012.
- `packages/core/src/index.ts` updated with the five new export lines.
- A short implementation summary (changed files, test results, any naming/location decisions you made and why) suitable for Review Agent evaluation. Do NOT update `EP-007_Development_Tasks.md`'s DT-017 "Implementation Notes" section yourself — that update happens at governance closure, a separate, later task.

STOP CONDITION:
Stop after completing the Implementation Scope and tests above. Do not begin DT-018 or any other Development Task. Do not create Development Sprint 013. Do not modify FB-002, TS-002, or `EP-007_Development_Tasks.md`. Wait for review.
```

---

## 17. Role Handover

Implemented scope in this task: Development Sprint 012 planning only — this document and the embedded Development Agent Prompt, scoped exclusively to DT-017. No source code was written or modified. No architecture, ADR, TTAP-001, FB-001, TS-001, FB-002, TS-002, Product Vision, Product Principles, Domain Model, Role Model, EP-008, or EP-009 content was changed.

Changed artifacts: `ADO/02_Development/Development_Sprint_012_Plan.md` (new, this file). `ADO/00_Core/Decision_Log.md` was deliberately **not** updated — see the disclosed judgment call below. `ADO/00_Core/Project_Status.md` was updated with a small, targeted change — see below.

**Disclosed judgment call (Decision_Log.md):** the assigning task instructed updating `Decision_Log.md` "only if the repository's current sprint-planning pattern requires a DEV-SPRINT-012 Planned row." Direct inspection of `Decision_Log.md` found exactly one prior instance of a standalone "Planned" status row (`DEV-SPRINT-002`, from early in this repository's history); every subsequent Sprint Plan (003 through 011) received its first Decision Log row only at Governance Closure, not at planning time — the single "Planned" precedent is not the repository's current, established pattern. Per "repository evidence decides," `Decision_Log.md` is therefore not updated by this task; a `DEV-SPRINT-012` row will be added at Sprint 012's governance closure, consistent with Sprints 003–011.

**Disclosed judgment call (Project_Status.md):** several targeted updates were made — the Status line, one Current State bullet, the Current Epics bullet, the Goals bullet, and Immediate Next Steps item 3 — reflecting that FB-002/TS-002 have completed a Technical Lead review round and that DT-017–DT-026 now exist and Sprint 012 (DT-017 only) is Planned. **Correction applied during this update:** an initial draft of these edits described FB-002/TS-002 as "approved" — this was caught and corrected before finalizing, because both documents' own header "Status" fields still read "Draft" with "Approval Date: Not yet approved," and no task in this engagement has ever instructed changing those fields. Project_Status.md now says "reviewed," not "approved," for FB-002/TS-002, and explicitly flags the Draft-status/Approval-Date discrepancy as something the Technical Lead/Human Architect should reconcile independently — consistent with AVR-001's "Validation requires evidence. Status shall never be upgraded by assumption."

Related ADO artifacts consulted: `FB-002-organization-management-foundation.md`, `TS-002-organization-management-foundation.md`, `EP-007_Development_Tasks.md` (DT-017 section and Task Sequence diagram), `Decision_Log.md`, `Project_Status.md`, `Development_Sprint_011_Closure.md`, `EP-009_Product_Readiness_Framework.md`, `Product_Readiness_Assessment.md` (Section 11.1), `Product_Readiness_Roadmap.md`, EP-008 Chapter 03 (Responsibility Areas), and direct inspection of current repository code: `packages/core/src/domain/ids.ts`, `packages/core/src/infrastructure/repositories/InMemoryCustomerRepository.ts`, `packages/core/src/domain/events/WorkEventCreated.ts`, `packages/core/src/application/NfcScanApplicationService.ts`, `packages/core/src/index.ts`.

Tests performed: none (planning-only task; no code changed). Current repository test/typecheck state (154 `packages/core` tests passing, typecheck clean) was verified in the immediately preceding sessions and is cited here, not re-run since no code changed.

Known deviations: none from the assigned task scope.

Unresolved questions / open findings carried forward, unaffected by this task: FB-002's eight Open Questions and TS-002's newly surfaced Membership-granting bootstrap question (irrelevant to DT-017 itself, relevant starting DT-018); DT-016 physical-device validation; iOS NFC support; Development Sprint 002/004 governance backlog; Finding F-01; the backend/cloud persistence technology decision; the future Identity-layer Feature Blueprint.

Evidence produced: this plan document and the embedded Development Agent Prompt and Role Handover.

Next responsible role: Technical Lead / Human Architect review and approval of this Sprint 012 Plan. Per the assigned stop condition, implementation does not begin until approval is given, and no further Development Task beyond DT-017 is started within this sprint even after approval.

## 18. Stop Condition

Per task instruction: stop after producing this Development Sprint 012 Plan and the minimum required cross-reference update (Project_Status.md only, per the disclosed judgment call above). No code was implemented or modified. Sprint 012 execution has not begun. DT-018 has not been started. Development Sprint 013 was not created. Awaiting Technical Lead / Human Architect review.
