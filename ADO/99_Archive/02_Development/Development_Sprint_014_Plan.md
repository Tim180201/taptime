# Development Sprint 014 Plan – Membership Authorization Validator (DT-019)

Status: Planned
Role: Research / Implementation Support acting on behalf of Technical Lead (per AGR-001)
Epic: EP-007 – Product Architecture Foundation (implementation), governed in priority by EP-009 – Product Readiness Framework
Owner: Technical Lead
Approval Authority: Human Architect
Branch: `main`
Created Date: 2026-07-08
Related Development Task: DT-019 – Membership Authorization Validator (only)
Related Feature Blueprint / Technical Specification: FB-002 – Organization Management Foundation; TS-002 – Organization Management Foundation Technical Specification
Related Artifacts: `EP-007_Development_Tasks.md` (DT-017–DT-026), `Decision_Log.md`, `Project_Status.md`, `Development_Sprint_013_Closure.md`, `Development_Sprint_013_Plan.md`, `Development_Sprint_012_Closure.md`, EP-008 Chapters 00–03

---

## 1. Executive Summary

Development Sprint 012 completed DT-017 (Organization Domain & Repository); Development Sprint 013 completed DT-018 (Membership Domain & Repository): `Membership`, `MembershipRole`, `MembershipRepository`, `InMemoryMembershipRepository`, `MembershipService` all exist, Review Agent verified, Human Architect approved, 175/175 `packages/core` tests passing. Development Sprint 014 continues the TS-002 implementation sequence with the next unit: **DT-019 – Membership Authorization Validator only**. No other Development Task (DT-020–DT-026) is part of this sprint.

DT-019 is the correct next implementation unit because it is the only currently-unblocked task in the sequence that has not yet been implemented: `EP-007_Development_Tasks.md`'s Dependencies line for DT-019 states "DT-018 (`Membership`/`MembershipRole` domain objects must exist)" — now satisfied. DT-023–DT-025 (`OrganizationAdministrationService`'s three methods) depend on DT-019 directly, per TS-002's own Sequence Diagrams 3–5, each of which shows an `OrganizationAdministrationService` method calling `MembershipAuthorizationValidator` before proceeding. DT-020–DT-022 (the three read-only-repository write extensions) have no dependency on DT-019 and could in principle be implemented in parallel, but they are not part of this sprint, per the assigning task's explicit Sprint Scope.

This sprint is deliberately narrow and deliberately **standalone**: it builds a new Business-area validator — structurally identical in shape to the existing `AssignmentValidator` (pure, deterministic, no side effects, no repository dependency) — that answers exactly one question: "may this Membership perform an administrative action for this Organization?" It does not wire this validator in front of `MembershipService`, does not modify `MembershipService` or `OrganizationManagementService` in any way, does not resolve the first-Administrator bootstrap question, and does not create any admin-facing flow. `MembershipAuthorizationValidator` after this sprint is reachable only from its own unit tests — exactly the same "callable, not yet called" state DT-017's `OrganizationManagementService` and DT-018's `MembershipService` were each left in by their own sprints.

## 2. Repository Evidence

- `Development_Sprint_013_Closure.md`, Section 14 (Next Sprint Recommendation): "Repository evidence supports proposing Development Sprint 014, scoped to DT-019... DT-019 is the next task in TS-002's dependency chain (it depends on `Membership` existing, which is now Completed)."
- `EP-007_Development_Tasks.md`, DT-018 Implementation Notes (Completed): confirms `MembershipId`, `MembershipRole`, `Membership`, `MembershipGranted`, `MembershipRepository`, `InMemoryMembershipRepository`, `MembershipService` exist, are exported from `packages/core/src/index.ts`, and that all 175 `packages/core` tests pass.
- `EP-007_Development_Tasks.md`, DT-019 section (as approved): Objective, Repository Responsibility, Acceptance Criteria, Implementation Boundary, Testing Expectations, Out of Scope, Dependencies, Relationship to TS-002/FB-002 — used verbatim as this sprint's scope baseline (Section 10, below).
- `FB-002-organization-management-foundation.md`, Decision 6 (Evaluate Whether an Actor May Perform an Administrative Action): "Trigger: any of Decisions 3–5. Decision: the actor's Membership must exist, must carry the Administrator Role, and must belong to the same Organization as the data being created/registered/assigned. Result: proceed, or AdministrativeActionRejected / CrossOrganizationAccessRejected." FB-002's Business Rules state the same rule in prose: "Only a Membership with the Administrator Role may create or assign Organization-owned pilot data."
- `TS-002-organization-management-foundation.md`, New Business-Area Component: "`MembershipAuthorizationValidator` — new, placed in the Business Engine responsibility area, directly alongside and structurally identical in shape to the existing `AssignmentValidator`: a pure, deterministic class with no side effects, taking domain objects in and returning a validation result out. Evaluates whether a Membership may perform an administrative action against a target Organization (FB-002 Decision 6): rejects with `membership_not_found`..., `membership_lacks_administrator_role`..., or `cross_organization_access`... — otherwise accepts... This is a business rule..., so it belongs in the Business responsibility area, not inside an Application Service." TS-002 additionally confirms: "`AssignmentValidator` itself is not modified; its existing `employee_lacks_organization_access` check continues to operate exactly as today."
- TS-002's Responsibility Boundaries table: "Business Engine | `MembershipAuthorizationValidator` (new, structurally identical to `AssignmentValidator`). `AssignmentResolver`, `AssignmentValidator`, `WorkEventFactory`, `BusinessEngine` unchanged." TS-002 Sequence Diagrams 3–5 each show `OrganizationAdministrationService`'s methods calling `MembershipAuthorizationValidator` before proceeding — evidence that DT-019 is a shared precondition for DT-023–DT-025, not just for DT-018's own bootstrap question.
- Direct code inspection confirms the precedents this sprint reuses: `packages/core/src/business/AssignmentValidator.ts`'s pure `validate(...)` method shape and its constructor-injected-repository pattern (deliberately **not** reused here — see Section 3, "why the DT-019 validator takes no repository"); `packages/core/src/business/AssignmentValidationResult.ts`'s `{ status: 'accepted' | 'rejected', reason? }` discriminated-union shape, the exact structural template for `MembershipAuthorizationResult`; `packages/core/src/domain/Membership.ts`/`MembershipRole.ts` (DT-018, one sprint old), which `MembershipAuthorizationValidator` consumes as plain input, unmodified.
- `Product_Readiness_Assessment.md` Section 11.1 continues to name Organization Management as the primary Product Capability bottleneck for reaching pilot customers; DT-019 is one of ten Development Tasks in that sequence and does not close the bottleneck alone (Section 13, EP-009 Product Readiness Impact, below).

## 3. Why DT-019 Is Selected (and Why Nothing Else Is)

The Primary Planning Question is how DT-019 should be implemented as the smallest safe Development Sprint while preserving the existing architecture and keeping authorization separate from `MembershipService`. Repository evidence answers this in three parts.

**Why DT-019, not any other DT-02x task:** DT-019 is the only Organization Management task whose Dependencies (`EP-007_Development_Tasks.md`) are now fully satisfied and whose implementation has not yet begun. DT-023–DT-025 (`OrganizationAdministrationService`) each depend on `MembershipAuthorizationValidator` existing first, per TS-002's own Sequence Diagrams 3–5, which show every one of the three methods calling it before proceeding — building `OrganizationAdministrationService` before DT-019 would mean building an Application Service that calls a component that does not exist. DT-020–DT-022 (the repository write extensions) have no dependency on DT-019 and could be implemented independently, but they are excluded here because the assigning task's Sprint Scope (Section 6) is explicitly limited to DT-019 alone — not because repository evidence requires excluding them.

**Why DT-019 alone, not DT-019 plus any part of DT-023–DT-025:** `OrganizationAdministrationService` (DT-023–DT-025) is a separate, structurally distinct component (an Application Service, not a Business-area validator) with its own dependencies — it needs `MembershipAuthorizationValidator` (this sprint) **and** the three repository write extensions (DT-020–DT-022, not this sprint) before any of its three methods can be meaningfully implemented. Combining any part of it into this sprint would violate its own stated Dependencies and repeat the "oversized Development Task" mistake every prior sprint plan in this sequence has explicitly declined. The smallest safe Development Sprint is therefore DT-019 by itself.

**Why the DT-019 validator takes no repository dependency, unlike `AssignmentValidator`:** `AssignmentValidator` is constructed with a `CustomerRepository` and calls `findById` inside its own `validate()` method. DT-019's own Acceptance Criteria explicitly do **not** ask for this: "The component has no side effects and no dependency on any repository directly inside its own decision logic (the Membership is passed in, exactly as `AssignmentValidator.validate()` receives its inputs already resolved)." This is a deliberate, evidence-based divergence from `AssignmentValidator`'s exact constructor shape, not an inconsistency — `AssignmentValidator`'s repository call exists because `AssignmentValidator` receives an `NfcAssignment` and must resolve the `Customer` it targets; `MembershipAuthorizationValidator` receives its `Membership` (or its absence) and target `OrganizationId` already resolved by its future caller, so it needs no lookup of its own. The Development Agent Prompt (Section 16) states this directly to prevent a mechanical "copy `AssignmentValidator`'s constructor" mistake.

## 4. Business Objective

Establish, as a standalone and independently testable rule, exactly who may perform an administrative action within an Organization — the authorization gate that must exist before any Administrator-facing capability (Customer creation, NFC Tag registration, NFC Tag assignment; DT-023–DT-025) can be built safely. This does not by itself make TapTim.e pilot-ready (Section 13, below): the validator has no caller yet, and DT-023–DT-025 still require the repository write extensions (DT-020–DT-022) before they can be implemented. It is the necessary third step of the Organization Management capability the Product Readiness Assessment identifies as the primary bottleneck to reaching a pilot customer.

## 5. Technical Objective

Implement `MembershipAuthorizationResult` (an explicit accepted/rejected result type, mirroring `AssignmentValidationResult`'s shape exactly) and `MembershipAuthorizationValidator` (a pure, deterministic Business-area class exposing a single evaluation method) — exactly as specified in TS-002's New Business-Area Component section and in DT-019's Acceptance Criteria — with zero change to any existing file outside these new additions plus their barrel-export registration and their tests. `AssignmentValidator`, `Membership`, `MembershipRole`, and `MembershipService` are consumed only as read-only inputs/type references; none is modified.

## 6. Scope

Per the assigning task, Development Sprint 014 includes only DT-019. The sprint plans implementation of:

- `MembershipAuthorizationResult` (or equivalent explicit result type) — an accepted/rejected discriminated union, mirroring `AssignmentValidationResult`'s `{ status: 'accepted' | 'rejected', reason? }` shape.
- Three rejection reasons, exactly as TS-002/FB-002 specify: `membership_not_found`, `membership_lacks_administrator_role`, `cross_organization_access`.
- `MembershipAuthorizationValidator` — a pure, deterministic class with a single evaluation method, taking a `Membership | null` and a target `OrganizationId`, returning a `MembershipAuthorizationResult`.
- Unit tests covering the accepted branch and all three rejected branches independently.
- Barrel-export registration in `packages/core/src/index.ts`, matching the existing convention exactly.

## 7. Out of Scope

Explicitly excluded from this sprint, per the assigning task:

- DT-020 (`CustomerRepository` write extension), DT-021 (`NfcTagRepository` write extension), DT-022 (`NfcAssignmentRepository` write extension), DT-023 (`OrganizationAdministrationService`), DT-024 (NFC Tag Registration), DT-025 (NFC Tag Assignment), DT-026 (Scan Pipeline Integration Verification).
- Any UI, any mobile work, any CLI command.
- Any Identity work, any `AuthenticationGateway` change, any `FakeAuthenticationGateway` change, any real authentication provider.
- Any change to `MembershipService` — `MembershipAuthorizationValidator` is not wired in front of it; `MembershipService.grantMembership(...)` continues to perform no authorization check, exactly as DT-018 left it.
- Any change to `OrganizationManagementService`.
- Any first-Administrator bootstrap decision — TS-002's Open Question remains explicitly unresolved; this sprint creates the validator component only, it does not decide who may grant a Membership.
- Any admin-facing Membership-granting flow.
- Any repository writes, any change to `CustomerRepository`/`NfcTagRepository`/`NfcAssignmentRepository` (all remain read-only after this sprint).
- Any backend/cloud persistence technology, database schema, or API design.
- Any change to FB-001/TS-001's scan pipeline.
- Any change to `BusinessEngine`, `AssignmentResolver`, `AssignmentValidator`, `WorkEventFactory`, `NfcScanApplicationService`, `CallerContext`, `OfflineQueue`, `SynchronizationService`, or error handling.
- Any change to `Organization`, `OrganizationManagementService`, `Membership`, `MembershipRole`, `MembershipRepository`, `InMemoryMembershipRepository`, or `MembershipService` (DT-017/DT-018) — consumed as read-only inputs/types only.
- Any change to FB-002, TS-002, EP-008, `Product_Readiness_Assessment.md`, or `Product_Readiness_Roadmap.md`.

## 8. Existing Components Reused (Patterns, Not Code)

Unlike DT-017/DT-018, which each built a full domain/port/adapter/service triad, DT-019 builds a single Business-area component with **no runtime dependency on any repository, port, or Application Service**. What it reuses is *pattern* and *shape*, most directly from `AssignmentValidator` (structural template) and `Membership`/`MembershipRole` (DT-018, consumed as input types only):

| Existing Precedent | File | Reused As |
|---|---|---|
| Pure, deterministic Business-area validator | `packages/core/src/business/AssignmentValidator.ts` | Structural template for `MembershipAuthorizationValidator`'s shape (a class with one evaluation method) — **not** its constructor signature; `AssignmentValidator`'s `CustomerRepository` dependency is deliberately not reused (Section 3). |
| Accepted/rejected discriminated-union result type | `packages/core/src/business/AssignmentValidationResult.ts` (`{ status: 'accepted' \| 'rejected', reason? }`) | Exact structural template for `MembershipAuthorizationResult`. |
| Domain input types, unmodified | `packages/core/src/domain/Membership.ts`, `packages/core/src/domain/MembershipRole.ts` (DT-018, one sprint old) | Consumed as read-only input types; `Membership`'s `organizationId`/`role` fields are exactly what the validator's decision logic inspects. |
| Exhaustive barrel export | `packages/core/src/index.ts` | New export lines added in the same grouped, `export * from` style — no new export convention introduced. |

No component from `application/`, `infrastructure/`, the FB-001 scan pipeline, `OfflineQueue`, `SynchronizationService`, `CallerContext`, `MembershipService`, or `OrganizationManagementService` is called, imported, or otherwise touched by DT-019.

## 9. Components to Implement

Repository reality confirms the paths the assigning task proposed already match this repository's existing sibling-file conventions: `packages/core/src/business/` already contains `AssignmentValidator.ts` and `AssignmentValidationResult.ts` side by side, the exact pairing DT-019 extends. No alternative location is better-justified; the proposed paths are used as-is.

| Component | Type | Location |
|---|---|---|
| `MembershipAuthorizationResult` | Business-area result type | `packages/core/src/business/MembershipAuthorizationResult.ts` |
| `MembershipAuthorizationValidator` | Business-area validator | `packages/core/src/business/MembershipAuthorizationValidator.ts` |

Tests are planned under `packages/core/tests/business/`, alongside `AssignmentValidator.test.ts` and `AssignmentValidationResult`'s own coverage, matching this repository's existing `tests/` mirror-of-`src/` layout exactly.

## 10. Development Task Mapping

DT-019 – Membership Authorization Validator, used exactly as approved in `EP-007_Development_Tasks.md` (no re-derivation, no reinterpretation):

- **Objective:** Implement `MembershipAuthorizationValidator`, a new Business-area component structurally identical to the existing `AssignmentValidator` — pure, deterministic, no side effects — that evaluates whether a Membership may perform an administrative action against a target Organization.
- **Acceptance Criteria:** `MembershipAuthorizationValidator` takes a `Membership` (or its absence) and a target `OrganizationId` and returns an accepted/rejected result, mirroring `AssignmentValidationResult`'s shape exactly; rejection reasons exactly `membership_not_found`, `membership_lacks_administrator_role`, `cross_organization_access`; no side effects and no direct repository dependency inside its own decision logic; unit tests cover the accepted case and each of the three rejection reasons independently.
- **Implementation Boundary:** `AssignmentValidator` itself is not modified in any way; no Application Service is built or modified by this task.
- **Out of Scope (per DT-019 itself):** any caller of this validator (DT-023–DT-025's responsibility); it does not resolve DT-018's Membership-granting bootstrap question; any change to `AssignmentValidator`'s own rejection behavior.
- **Dependencies (per `EP-007_Development_Tasks.md`):** DT-018 (`Membership`/`MembershipRole` domain objects must exist) — satisfied, Completed.

No other Development Task is mapped to this sprint.

## 11. Testing Strategy

- `npm run typecheck --workspace=@taptime/core` — must pass with no errors.
- `npm run test --workspace=@taptime/core` — must pass; all 175 pre-existing tests (as of Development Sprint 013) must remain green, plus new tests covering:
  - Accepted case: an Administrator Membership whose `organizationId` matches the target Organization is accepted.
  - Rejected — `membership_not_found`: no Membership is provided (`null`).
  - Rejected — `membership_lacks_administrator_role`: an Employee Membership, matching Organization.
  - Rejected — `cross_organization_access`: an Administrator Membership whose `organizationId` differs from the target Organization.
- No `apps/mobile` tests are expected or required — DT-019 adds no `apps/mobile` code and no `apps/mobile` file is touched.
- No physical-device validation is relevant to DT-019.
- Explicit non-regression check: `git diff --stat` outside the two new files (Section 9), their tests, and the `index.ts` export additions must be empty. In particular, `AssignmentValidator.ts`, `MembershipService.ts`, and `OrganizationManagementService.ts` must be confirmed byte-for-byte unchanged.

## 12. Risks

| Risk | Mitigation |
|---|---|
| Copying `AssignmentValidator`'s constructor signature literally, giving `MembershipAuthorizationValidator` a repository dependency it does not need | Section 3 explains directly why this sprint's validator takes no repository; DT-019's own Acceptance Criteria state "no dependency on any repository directly inside its own decision logic." The Development Agent Prompt (Section 16) states this directly. |
| Wiring `MembershipAuthorizationValidator` into `MembershipService` "since it's a natural next step" | Out of Scope (Section 7) explicitly forbids this; DT-019's own Out of Scope names it as a later task's responsibility (DT-023–DT-025), not this one. |
| Resolving or silently working around the first-Administrator bootstrap question inside the validator (e.g., a special "no Membership yet, but this is the first one" acceptance path) | DT-019's Out of Scope states directly that this task "does not resolve DT-018's Membership-granting bootstrap question either — this task creates the validator component only." No bootstrap-aware branch is added. |
| Scope creep into DT-020–DT-025 ("since the validator is done, wiring one caller is a small next step") | Out of Scope (Section 7) explicitly names DT-020–DT-026 as excluded; the Stop Condition (Section 18) reinforces stopping after DT-019. |
| Modifying `AssignmentValidator` to share logic with the new validator ("DRY") | DT-019's Implementation Boundary states `AssignmentValidator` "is not modified in any way — `MembershipAuthorizationValidator` is a new, separate, structurally analogous class, not an extension of `AssignmentValidator`." Structural similarity is deliberate; code sharing is not required or requested. |
| Under-testing one of the three rejection branches, or conflating two of them into a single test | Acceptance Criteria explicitly require all three rejection reasons tested independently; called out directly in the Development Agent Prompt's testing requirements (Section 16). |

## 13. EP-009 Product Readiness Impact

Evaluated per EP-009's domain list (`EP-009_Product_Readiness_Framework.md`), using repository evidence only, consistent with Development Sprint 012/013's own per-domain discipline:

- **Engineering Readiness:** Marginally, positively affected — extends the pure/deterministic Business-area validator pattern `AssignmentValidator` already established to a second, genuinely new rule (administrative-action authorization), reusing `AssignmentValidationResult`'s exact result-type shape. Not a tier-level change by itself; it is the third of ten planned Organization Management tasks.
- **Product Readiness:** **Unchanged.** No product-facing or pilot-facing capability exists after DT-019 alone — `MembershipAuthorizationValidator` has no caller anywhere in the repository. It can be exercised only in a test.
- **Customer Readiness:** **Unchanged.** DT-019 does not change Customer Readiness in a user-facing way — no administrative action can be authorized through any real path after this sprint; that requires DT-023–DT-025 (which themselves require DT-020–DT-022) to actually call this validator.
- **Deployment Readiness:** **Unchanged.** No new dependency, no new persistence technology, no deployment-relevant change.
- **Technical Operations Readiness:** **Unchanged.** No operational tooling, monitoring, or runbook implication.
- **Scaling Readiness:** **Unchanged.** A pure, stateless function/class with no persistence dimension at all; no scaling property is introduced or resolved.

**Explicit statement, per the assigning task's own instruction:** DT-019 is foundational. It creates the authorization rule required before administration flows can be safely built. It does not by itself make TapTim.e pilot-ready. It does not change Customer Readiness in a user-facing way. It does not resolve Membership bootstrap. No domain's tier is claimed to change as a result of this sprint alone.

## 14. Definition of Done

For the eventual implementation and closure of this sprint (not performed by this planning task itself — see Stop Condition):

- `MembershipAuthorizationResult`, `MembershipAuthorizationValidator` exist exactly as specified in Sections 6/9/10.
- `npm run typecheck --workspace=@taptime/core` and `npm run test --workspace=@taptime/core` both pass; all 175 pre-existing tests remain green.
- `git diff` confirms zero changes to any file outside the two new files, their tests, and `packages/core/src/index.ts`'s export additions — in particular, `AssignmentValidator.ts`, `MembershipService.ts`, and `OrganizationManagementService.ts` are confirmed byte-for-byte unchanged.
- `EP-007_Development_Tasks.md`'s DT-019 "Implementation Notes" placeholder is filled in with the actual implementation summary, at closure time (not part of this planning task).
- Review Agent verification and Human Architect approval are recorded before DT-019 is marked Completed (DTP-001: "Implementation alone never completes a Development Task").

## 15. Recommended Implementation Order

1. Add `MembershipAuthorizationResult`.
2. Add `MembershipAuthorizationValidator`.
3. Add a test for the accepted case (Administrator Membership, matching Organization).
4. Add a test for `membership_not_found` (no Membership provided).
5. Add a test for `membership_lacks_administrator_role` (Employee Membership).
6. Add a test for `cross_organization_access` (Administrator Membership, different Organization).
7. Register both new exports in `packages/core/src/index.ts`'s barrel export.
8. Run `npm run typecheck --workspace=@taptime/core` and `npm run test --workspace=@taptime/core`; confirm `git diff --stat` touches only the expected files.

Repository evidence supports this order directly: the result type must exist before the validator can return it, and testing every branch (one accepted, three rejected) is deliberately ordered last, after all production code exists — the identical order DT-017/DT-018 already used successfully, adapted for a validator's four-branch decision surface instead of a single-path service.

---

## 16. Development Agent Prompt

The following prompt is written to be given directly to Claude Code (Development Agent) to execute Development Sprint 014. It is self-contained and does not require this planning document to be re-explained.

```text
You are the Development Agent for TapTim.e, implementing Development Sprint 014 ("Membership Authorization Validator," DT-019 only) on branch `main`.

CONTEXT (verify before writing code):
- Read `ADO/02_Development/Development_Sprint_014_Plan.md` in full — it is the authoritative scope for this task.
- Read `ADO/01_Architecture/Feature_Blueprints/FB-002-organization-management-foundation.md` (Decision 6) and `ADO/01_Architecture/Technical_Specifications/TS-002-organization-management-foundation.md` (New Business-Area Component section) — the product/technical basis for what you are building.
- Read `ADO/02_Development/EP-007_Development_Tasks.md`'s "## DT-019 – Membership Authorization Validator" section — your exact Objective, Acceptance Criteria, Implementation Boundary, Out of Scope and Dependencies.
- Read these existing files as your structural templates: `packages/core/src/business/AssignmentValidator.ts` (the shape of a Business-area validator class — a class with one evaluation method; do NOT copy its constructor, which takes a `CustomerRepository` — your validator takes no repository, see below), `packages/core/src/business/AssignmentValidationResult.ts` (the exact `{ status: 'accepted' | 'rejected', reason? }` discriminated-union shape your new result type must follow), `packages/core/src/domain/Membership.ts` and `packages/core/src/domain/MembershipRole.ts` (DT-018, completed one sprint ago — the input types your validator consumes, unmodified), `packages/core/src/index.ts` (the barrel-export convention).
- Do not modify `AssignmentValidator.ts`, `AssignmentValidationResult.ts`, `Membership.ts`, `MembershipRole.ts`, `MembershipRepository.ts`, `InMemoryMembershipRepository.ts`, `MembershipService.ts`, `Organization.ts`, `OrganizationRepository.ts`, `InMemoryOrganizationRepository.ts`, `OrganizationManagementService.ts`, FB-001, TS-001, TTAP-001, any ADR, Product Vision, Product Principles, Domain Model, Role Model, EP-008, EP-009, FB-002, or TS-002.

IMPLEMENTATION SCOPE (do exactly this, nothing more):
1. Create `MembershipAuthorizationResult` in `packages/core/src/business/MembershipAuthorizationResult.ts`: a discriminated union mirroring `AssignmentValidationResult`'s exact shape — an accepted variant (`{ status: 'accepted' }`, plus whatever fields you find directly useful to carry forward, e.g. the `Membership` itself) and a rejected variant (`{ status: 'rejected', reason: MembershipAuthorizationRejectionReason }`), where `MembershipAuthorizationRejectionReason` is exactly `'membership_not_found' | 'membership_lacks_administrator_role' | 'cross_organization_access'` — no other reason.
2. Create `MembershipAuthorizationValidator` in `packages/core/src/business/MembershipAuthorizationValidator.ts`: a class with a single evaluation method (name it consistently with `AssignmentValidator.validate(...)`'s verb choice — e.g. `authorize` or `validate`) taking a `Membership | null` and a target `OrganizationId`, and returning a `MembershipAuthorizationResult`. Decision logic, exactly in this order: (a) if the Membership is `null` or absent, reject with `membership_not_found`; (b) if the Membership's `role` is `'employee'`, reject with `membership_lacks_administrator_role`; (c) if the Membership's `organizationId` does not equal the target `OrganizationId`, reject with `cross_organization_access`; (d) otherwise (Administrator role, matching Organization), accept. This class takes NO constructor dependency on any repository — it is a pure function of its two inputs, unlike `AssignmentValidator`.
3. Register both new exports in `packages/core/src/index.ts`, in the same grouped, `export * from` style already used there, near the other `business/` exports (`AssignmentValidator`, `AssignmentValidationResult`, etc.).

ARCHITECTURE BOUNDARIES (do not violate):
- Do not touch `AssignmentValidator`, `AssignmentValidationResult`, `AssignmentResolver`, `WorkEventFactory`, `BusinessEngine`, `NfcScanApplicationService`, `CallerContext`, `OfflineQueue`, `SynchronizationService`, or any error-classification function.
- Do not touch `Membership`, `MembershipRole`, `MembershipRepository`, `InMemoryMembershipRepository`, `MembershipService`, `Organization`, `OrganizationRepository`, `InMemoryOrganizationRepository`, or `OrganizationManagementService` — consume `Membership`/`MembershipRole`/`OrganizationId` as types only.
- Do not wire `MembershipAuthorizationValidator` into `MembershipService` or any other Application Service — it has no caller after this sprint.
- Do not touch `apps/mobile`, `packages/core/src/cli/runScan.ts`, or any CLI entry point.
- Do not implement DT-020 (`CustomerRepository` write extension), DT-021, DT-022, DT-023 (`OrganizationAdministrationService`), DT-024, DT-025, DT-026, or any other Development Task — this sprint is DT-019 only.
- Do not resolve the first-Administrator bootstrap question in any form (no special "no Membership yet, but this is the first one" acceptance path).
- Do not give `MembershipAuthorizationValidator` a constructor dependency on `MembershipRepository`, `OrganizationRepository`, or any other repository — its inputs are passed in directly, exactly as DT-019's Acceptance Criteria require.

TESTING REQUIREMENTS:
- Accepted case: an Administrator-role Membership whose `organizationId` matches the target `OrganizationId` — result is `accepted`.
- Rejected — `membership_not_found`: `null` (or equivalent absence) passed as the Membership — result is `rejected` with reason `membership_not_found`.
- Rejected — `membership_lacks_administrator_role`: an Employee-role Membership whose `organizationId` matches the target — result is `rejected` with reason `membership_lacks_administrator_role`.
- Rejected — `cross_organization_access`: an Administrator-role Membership whose `organizationId` does NOT match the target — result is `rejected` with reason `cross_organization_access`.
- Run `npm run typecheck --workspace=@taptime/core` and `npm run test --workspace=@taptime/core`; both must pass, with all 175 pre-existing tests remaining green, before you consider the task done.
- Confirm via `git diff --stat` that only the two new files, their tests, and `packages/core/src/index.ts` were changed — `AssignmentValidator.ts`, `MembershipService.ts`, and `OrganizationManagementService.ts` must show zero diff.

EXPECTED DELIVERABLES:
- The two new files and their tests, committed with a clear commit message referencing DT-019 and Development Sprint 014.
- `packages/core/src/index.ts` updated with the two new export lines.
- A short implementation summary (changed files, test results, any naming decisions you made — e.g. the exact method name you chose — and why) suitable for Review Agent evaluation. Do NOT update `EP-007_Development_Tasks.md`'s DT-019 "Implementation Notes" section yourself — that update happens at governance closure, a separate, later task.

STOP CONDITION:
Stop after completing the Implementation Scope and tests above. Do not begin DT-020 or any other Development Task. Do not create Development Sprint 015. Do not modify FB-002, TS-002, or `EP-007_Development_Tasks.md`. Wait for review.
```

---

## 17. Role Handover

Implemented scope in this task: Development Sprint 014 planning only — this document and the embedded Development Agent Prompt, scoped exclusively to DT-019. No source code was written or modified. No architecture, ADR, TTAP-001, FB-001, TS-001, FB-002, TS-002, Product Vision, Product Principles, Domain Model, Role Model, EP-008, or EP-009 content was changed.

Changed artifacts: `ADO/02_Development/Development_Sprint_014_Plan.md` (new, this file). `ADO/00_Core/Decision_Log.md` was deliberately **not** updated — see the disclosed judgment call below. `ADO/00_Core/Project_Status.md` was updated with a small, targeted change — see below.

**Disclosed judgment call (Decision_Log.md):** the assigning task instructed updating `Decision_Log.md` "only if the repository's current sprint-planning pattern requires a DEV-SPRINT-014 Planned row." This repeats the same evaluation performed for Development Sprints 012 and 013's own plans: every Sprint Plan from 003 through 013 received its first Decision Log row only at Governance Closure, not at planning time (the sole exception, `DEV-SPRINT-002`, is a single historical outlier, already so-documented in Development Sprint 012's own Role Handover). Per "repository evidence decides," `Decision_Log.md` is therefore not updated by this task; a `DEV-SPRINT-014` row will be added at Sprint 014's governance closure, consistent with every prior sprint since Sprint 003.

**Disclosed judgment call (Project_Status.md):** a small, targeted update was made — the Status line, one Current State bullet reference, the Current Epics bullet, and Immediate Next Steps item 3 — to reflect that Development Sprint 014 (DT-019 only) is now Planned, mirroring exactly the same small-update pattern Development Sprints 012 and 013's own plans applied when each first became Planned. No FB-002/TS-002 status language was touched (both remain correctly described as "reviewed," not "approved") and no other section was altered.

Related ADO artifacts consulted: `Development_Sprint_013_Closure.md`, `Development_Sprint_013_Plan.md`, `Development_Sprint_012_Closure.md`, `FB-002-organization-management-foundation.md`, `TS-002-organization-management-foundation.md`, `EP-007_Development_Tasks.md` (DT-018 Implementation Notes, DT-019 section, and Task Sequence diagram), `Decision_Log.md`, `Project_Status.md`, EP-008 Chapters 00–03 (Ch03 §10.69–10.73 specifically, for DT-018's implemented-reality narrative), and direct inspection of current repository code: `packages/core/src/business/AssignmentValidator.ts`, `packages/core/src/business/AssignmentValidationResult.ts`, `packages/core/src/domain/Membership.ts`, `packages/core/src/domain/MembershipRole.ts`, `packages/core/src/ports/MembershipRepository.ts`, `packages/core/src/infrastructure/repositories/InMemoryMembershipRepository.ts`, `packages/core/src/application/MembershipService.ts`, `packages/core/src/index.ts`.

Tests performed: none (planning-only task; no code changed). Current repository test/typecheck state (175 `packages/core` tests passing, typecheck clean, as verified and recorded at Development Sprint 013's governance closure) is cited here, not re-run since no code changed.

Known deviations: none from the assigned task scope.

Unresolved questions / open findings carried forward, unaffected by this task: TS-002's Membership-granting bootstrap question (directly relevant to, but not resolved by, DT-019 — resolution is a Human Architect decision, and even once resolved, wiring `MembershipAuthorizationValidator` in front of `MembershipService` is a separate future task, not DT-019 itself); FB-002's remaining Open Questions; DT-016 physical-device validation; iOS NFC support; Development Sprint 002/004 governance backlog; Finding F-01; the backend/cloud persistence technology decision; the future Identity-layer Feature Blueprint; FB-002's/TS-002's own "Draft" header status fields.

Evidence produced: this plan document and the embedded Development Agent Prompt and Role Handover.

Next responsible role: Technical Lead / Human Architect review and approval of this Sprint 014 Plan. Per the assigned stop condition, implementation does not begin until approval is given, and no further Development Task beyond DT-019 is started within this sprint even after approval.

## 18. Stop Condition

Per task instruction: stop after producing this Development Sprint 014 Plan and the minimum required cross-reference update (Project_Status.md only, per the disclosed judgment call above). No code was implemented or modified. Sprint 014 execution has not begun. DT-020 has not been started. Development Sprint 015 was not created. Awaiting Technical Lead / Human Architect review.
