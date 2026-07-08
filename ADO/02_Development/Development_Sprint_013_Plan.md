# Development Sprint 013 Plan – Membership Domain & Repository (DT-018)

Status: Planned
Role: Research / Implementation Support acting on behalf of Technical Lead (per AGR-001)
Epic: EP-007 – Product Architecture Foundation (implementation), governed in priority by EP-009 – Product Readiness Framework
Owner: Technical Lead
Approval Authority: Human Architect
Branch: `main`
Created Date: 2026-07-08
Related Development Task: DT-018 – Membership Domain & Repository (only)
Related Feature Blueprint / Technical Specification: FB-002 – Organization Management Foundation; TS-002 – Organization Management Foundation Technical Specification
Related Artifacts: `EP-007_Development_Tasks.md` (DT-017–DT-026), `Decision_Log.md`, `Project_Status.md`, `Development_Sprint_012_Closure.md`, `Development_Sprint_012_Plan.md`, EP-008 Chapters 00–03

---

## 1. Executive Summary

Development Sprint 012 completed DT-017 (Organization Domain & Repository): `Organization`, `OrganizationCreated`, `OrganizationRepository`, `InMemoryOrganizationRepository`, `OrganizationManagementService` all exist, Review Agent verified, Human Architect approved, 164/164 `packages/core` tests passing. Development Sprint 013 continues the TS-002 implementation sequence with the next unit: **DT-018 – Membership Domain & Repository only**. No other Development Task (DT-019–DT-026) is part of this sprint.

DT-018 is the correct next implementation unit because it is the only currently-unblocked task in the sequence that has not yet been implemented: `EP-007_Development_Tasks.md`'s Dependencies line for DT-018 states plainly, "DT-017 (an Organization must exist for a Membership to reference)" — now satisfied. DT-019 (`MembershipAuthorizationValidator`) depends on Membership existing as a domain concept first; DT-023–DT-025 depend on both DT-018 and DT-019; DT-026 depends on the entire chain. DT-020–DT-022 (the three read-only-repository write extensions) have no dependency on DT-018 and could in principle be implemented in parallel, but they are not part of this sprint, per the assigning task's explicit Sprint Scope.

This sprint is deliberately narrow and deliberately **foundation-only**, exactly as DT-018's own Objective states: it builds the mechanical capability to construct and save a `Membership`, and nothing about authorization. `MembershipService.grantMembership(...)` as planned here performs no authorization check, resolves no bootstrap question, and has no caller anywhere in the repository after this sprint — consistent with TS-002's own Application Services section, which describes `MembershipService` delegating "the 'may this request proceed' question" to `MembershipAuthorizationValidator` (DT-019, not built here) for every grant except the first Administrator Membership of a newly created Organization (the still-unresolved bootstrap question). This sprint plans the domain/repository/service triad only; wiring authorization in front of it is explicitly a later, not-yet-created task.

## 2. Repository Evidence

- `Development_Sprint_012_Closure.md`, Section 14 (Next Sprint Recommendation): "Repository evidence supports proposing Development Sprint 013, scoped to DT-018 (Membership Domain & Repository) only... DT-018 is the next task in TS-002's dependency chain (it depends only on DT-017, which is now Completed)."
- `EP-007_Development_Tasks.md`, DT-017 "Implementation Notes" (Completed): confirms `Organization`, `OrganizationCreated`, `OrganizationRepository`, `InMemoryOrganizationRepository`, `OrganizationManagementService` exist, are exported from `packages/core/src/index.ts`, and that all 164 `packages/core` tests pass.
- `EP-007_Development_Tasks.md`, DT-018 section (as approved, including the earlier Technical Lead Review Follow-up wording): Objective, Repository Responsibility, Acceptance Criteria, Implementation Boundary, Testing Expectations, Out of Scope, Dependencies, Relationship to TS-002/FB-002 — used verbatim as this sprint's scope baseline (Section 10, below).
- `FB-002-organization-management-foundation.md`, Capability 2 (Membership): "The association between an actor, an Organization and a minimal Membership Role (Administrator or Employee — Roles carried by the Membership, not standalone entities)." Decision 2 (Create Membership): "Trigger: an actor is to be associated with an Organization and a minimal Role. Preconditions: the Organization must exist (Decision 1). Decision: associate the actor with the Organization and a Membership Role (Administrator or Employee). Result: MembershipGranted."
- `TS-002-organization-management-foundation.md`, Domain Model: `Membership` — "new. Associates one actor (`UserId`) with one `Organization` (`OrganizationId`) and one `MembershipRole`. Carries its own identifier (`MembershipId`, new branded ID...), following the same precedent ADR-0002 already set for `NfcAssignment`... Per FB-002's assumption (Open Question 2), one Membership per actor exists at a time." `MembershipRole` — "new. A value, not an entity: `'administrator' | 'employee'`... Not a standalone domain object." Ports: `MembershipRepository` — "new... Methods: find the Membership for a given `UserId`... save (create) a Membership." Application Services: `MembershipService` — "One responsibility: grant a Membership. Orchestrates: construct the `Membership` domain object..., call `MembershipRepository.save`, produce `MembershipGranted`. Delegates the 'may this request proceed' question to the new `MembershipAuthorizationValidator`... for every grant except the first Administrator Membership of a newly created Organization, which has no existing Administrator to authorize it — an explicit, unresolved bootstrapping question."
- TS-002 Sequence Diagram 2 (Membership Creation): `Administration request (actor, Organization, MembershipRole) -> MembershipService -> [except the bootstrapping case, see Open Questions] MembershipAuthorizationValidator -> constructs Membership domain object -> MembershipRepository.save -> MembershipGranted`. Repository evidence confirms `MembershipAuthorizationValidator` does not exist yet (DT-019, not started) — this sprint's `MembershipService` therefore constructs and saves without any authorization step, an explicit, disclosed narrowing of the full sequence to only what DT-018 itself builds (Section 3, below).
- Direct code inspection confirms the precedents this sprint reuses: `packages/core/src/domain/ids.ts`'s `Brand<Value, BrandName>`/`brandedNonEmptyString` factory, already used for `UserId` and `OrganizationId` (both directly consumed by `Membership`, unmodified); `packages/core/src/infrastructure/repositories/InMemoryOrganizationRepository.ts`'s constructor-seeded-array pattern (defensively copied, `[...organizations]`), built one sprint ago as the most recent, most directly comparable precedent; `packages/core/src/domain/events/OrganizationCreated.ts`'s `{ type, <payload> }` interface plus constructor-function pattern; `packages/core/src/application/OrganizationManagementService.ts`'s injectable-deterministic-id constructor pattern (`newOrganizationId: () => OrganizationId = () => OrganizationId(generateId())`); `packages/core/src/index.ts`'s exhaustive `export * from` barrel convention.
- `Product_Readiness_Assessment.md` Section 11.1 continues to name Organization Management as the primary Product Capability bottleneck for reaching pilot customers; DT-018 is one of ten Development Tasks in that sequence and does not close the bottleneck alone (Section 13, EP-009 Product Readiness Impact, below).

## 3. Why DT-018 Is Selected (and Why Nothing Else Is)

The Primary Planning Question is how DT-018 should be implemented as the smallest safe Development Sprint while preserving the existing architecture and the DT-017 pattern. Repository evidence answers this in three parts.

**Why DT-018, not any other DT-01x/02x task:** DT-018 is the only Organization Management task whose Dependencies (`EP-007_Development_Tasks.md`) are now fully satisfied and whose implementation has not yet begun. DT-019 (`MembershipAuthorizationValidator`) depends on `Membership` existing as a domain concept first, per its own Repository Responsibility ("Business Engine responsibility area... evaluates whether a Membership may perform an administrative action"); it cannot reasonably be built before DT-018 without inventing a domain type ahead of its own specification. DT-020–DT-022 have no dependency on DT-018 and could be implemented independently, but they are excluded here because the assigning task's Sprint Scope (Section 6) is explicitly limited to DT-018 alone — not because repository evidence requires excluding them.

**Why DT-018 alone, not DT-018 plus DT-019:** DT-019 is a separate, structurally distinct component (a Business-area validator, not a domain/repository/service triad) with its own Repository Responsibility, Acceptance Criteria, and dependency on `Membership` existing first. Combining it into this sprint would repeat the exact mistake Development Sprint 012's own plan warned against for DT-017+DT-018 ("reintroduce exactly the kind of oversized Development Task the Technical Lead's principles explicitly ask this decomposition to avoid"), and it would violate DT-018's own Out of Scope, which states directly that no task in this package wires authorization in front of `MembershipService`. The smallest safe Development Sprint is therefore DT-018 by itself.

**Why the DT-018 built here is deliberately narrower than TS-002's full Membership Creation sequence describes:** TS-002's Application Services section and Sequence Diagram 2 both describe `MembershipService` delegating to `MembershipAuthorizationValidator` for every grant except the bootstrap case. That validator does not exist yet (it is DT-019). Building `MembershipService` to call a component that does not exist is not possible without either stubbing it (undocumented, unapproved scope) or leaving the call out entirely. DT-018's own Acceptance Criteria and Out of Scope resolve this explicitly: `MembershipService` here "constructs a `Membership` and calls `MembershipRepository`'s save method, producing `MembershipGranted`" with no authorization step, and "no admin-facing Membership-granting flow is implemented or ready for use after DT-018 (or after DT-019)." This sprint plans exactly that narrower, already-approved scope — not a reinterpretation of it.

## 4. Business Objective

Begin representing "who belongs to which Organization, with what Role" as real, persistable data — the second concrete step (after DT-017's Organization) toward a repository state where a genuine pilot customer's Administrators and Employees are real Memberships, not fixture data. This does not by itself make TapTim.e pilot-ready (Section 13, below): no caller can request a Membership yet, and no authorization exists to gate the request even if one could. It is the necessary second step of the Organization Management capability the Product Readiness Assessment identifies as the primary bottleneck to reaching a pilot customer.

## 5. Technical Objective

Implement the `MembershipId` branded identifier, the `Membership` domain object, the `MembershipRole` value type, the `MembershipRepository` port, its `InMemoryMembershipRepository` implementation, the `MembershipGranted` domain event, and the `MembershipService` application service — exactly as specified in TS-002's Domain Model, Ports and Application Services sections and in DT-018's Acceptance Criteria — with zero change to any existing file outside these new additions plus their barrel-export registration and their tests. `Organization` and `OrganizationManagementService` (DT-017) are consumed only as a type reference (`OrganizationId`); neither is modified.

## 6. Scope

Per the assigning task, Development Sprint 013 includes only DT-018. The sprint plans implementation of:

- `MembershipId` branded identifier, added to `packages/core/src/domain/ids.ts` alongside the existing branded ID types.
- `MembershipRole` value type (`'administrator' | 'employee'`).
- `Membership` domain object (`MembershipId`, `organizationId: OrganizationId`, `userId: UserId`, `role: MembershipRole`).
- `MembershipGranted` domain event (carries the created `Membership`).
- `MembershipRepository` port (`findByUserId(userId: UserId): Membership | null` + a save/create method).
- `InMemoryMembershipRepository` adapter implementing the port.
- `MembershipService`, exposing `grantMembership(...)` — constructs a `Membership`, calls the repository's save method, produces `MembershipGranted`. Uses injectable deterministic `MembershipId` generation, following DT-017/`OrganizationManagementService`'s pattern.
- Unit tests for all of the above.
- Barrel-export registration in `packages/core/src/index.ts`, matching the existing convention exactly.

## 7. Out of Scope

Explicitly excluded from this sprint, per the assigning task:

- DT-019 (`MembershipAuthorizationValidator`), DT-020 (`CustomerRepository` write extension), DT-021 (`NfcTagRepository` write extension), DT-022 (`NfcAssignmentRepository` write extension), DT-023 (`OrganizationAdministrationService`), DT-024 (NFC Tag Registration), DT-025 (NFC Tag Assignment), DT-026 (Scan Pipeline Integration Verification).
- Any UI, any mobile work, any CLI command — none is built by this sprint; `MembershipService` exists as a callable class with no entry point, exactly as `OrganizationManagementService` exists today.
- Any Identity work, any `AuthenticationGateway` change, any `FakeAuthenticationGateway` change, any real authentication provider.
- Any Membership authorization — `MembershipService.grantMembership(...)` performs no authorization check; no `MembershipAuthorizationValidator` call is wired in front of it.
- Any first-Administrator bootstrap decision — TS-002's Open Question remains explicitly unresolved; this sprint neither answers it nor works around it.
- Any admin-facing Membership-granting flow — no caller of `MembershipService` is introduced in this sprint, so no such flow can be considered complete or ready for use after DT-018.
- Any backend/cloud persistence technology, database schema, or API design.
- Any change to FB-001/TS-001's scan pipeline.
- Any change to `BusinessEngine`, `AssignmentResolver`, `AssignmentValidator`, `WorkEventFactory`, `NfcScanApplicationService`, `CallerContext`, `OfflineQueue`, `SynchronizationService`, or error handling.
- Any change to `Organization` or `OrganizationManagementService` (DT-017) — consumed via `OrganizationId` only, not modified.
- Any change to FB-002, TS-002, EP-008, `Product_Readiness_Assessment.md`, or `Product_Readiness_Roadmap.md`.

## 8. Existing Components Reused (Patterns, Not Code)

Like DT-017, DT-018 introduces a new, freestanding domain slice with **no runtime dependency on any existing pipeline component or on `OrganizationManagementService`**. What it reuses is *pattern* — now including DT-017 itself as the most recent, most directly comparable precedent:

| Existing Precedent | File | Reused As |
|---|---|---|
| Branded ID factory | `packages/core/src/domain/ids.ts` (`Brand<Value, BrandName>`, `brandedNonEmptyString`) | `MembershipId` is added via this exact pattern; `UserId` and `OrganizationId` (both already existing) are consumed unmodified as `Membership`'s foreign-key-shaped fields. |
| Constructor-seeded in-memory repository | `packages/core/src/infrastructure/repositories/InMemoryOrganizationRepository.ts` (one sprint old; itself modeled on `InMemoryCustomerRepository.ts`) | Exact structural template for `InMemoryMembershipRepository`, including the defensive-copy behavior (`[...memberships]`) DT-017's own tests specifically verified. |
| Constructor-function domain event | `packages/core/src/domain/events/OrganizationCreated.ts` (itself modeled on `WorkEventCreated.ts`) | Exact structural template for `MembershipGranted`. |
| Injectable deterministic ID generation | `packages/core/src/application/OrganizationManagementService.ts` (`newOrganizationId: () => OrganizationId = () => OrganizationId(generateId())`) | Exact structural template for `MembershipService`'s `newMembershipId` constructor parameter. |
| "Orchestrates but does not interpret" Application Service boundary | `packages/core/src/application/OrganizationManagementService.ts` (EP-008 Ch03 §2.3/5.4) | `MembershipService` follows the same boundary, narrowed further: it owns no business rule at all, not even "no precondition beyond the request itself" — it performs no check of any kind, deferring even the presence-of-a-check question to a later task (DT-019 plus its wiring). |
| Exhaustive barrel export | `packages/core/src/index.ts` | New export lines added in the same grouped, `export * from` style — no new export convention introduced. |

No component from `business/`, the FB-001 scan pipeline, `OfflineQueue`, `SynchronizationService`, `CallerContext`, `Organization`, or `OrganizationManagementService` is called, imported, or otherwise touched by DT-018.

## 9. Components to Implement

Repository reality confirms the paths the assigning task proposed already match this repository's existing sibling-file conventions exactly (verified by direct inspection of `packages/core/src/domain/`, `ports/`, `infrastructure/repositories/`, `domain/events/`, `application/` — each already contains a DT-017 file of the corresponding kind in exactly these locations, one sprint old). No alternative location is better-justified; the proposed paths are used as-is.

| Component | Type | Location |
|---|---|---|
| `MembershipId` | Branded identifier | `packages/core/src/domain/ids.ts` (extended, not a new file) |
| `MembershipRole` | Domain value type | `packages/core/src/domain/MembershipRole.ts` |
| `Membership` | Domain object | `packages/core/src/domain/Membership.ts` |
| `MembershipGranted` | Domain event | `packages/core/src/domain/events/MembershipGranted.ts` |
| `MembershipRepository` | Port | `packages/core/src/ports/MembershipRepository.ts` |
| `InMemoryMembershipRepository` | Infrastructure adapter | `packages/core/src/infrastructure/repositories/InMemoryMembershipRepository.ts` |
| `MembershipService` | Application service | `packages/core/src/application/MembershipService.ts` |

`MembershipRole` is planned as its own file (`MembershipRole.ts`), separate from `Membership.ts`, mirroring how `AssignmentTarget.targetType`'s literal union and `SyncState`/`ErrorCategory` are each their own named type rather than inlined — a small naming/location judgment call, not a deviation from any Acceptance Criterion; if the Development Agent finds a same-file placement better matches an even closer sibling precedent, this must be documented, not silently decided (Section 12, Risks).

## 10. Development Task Mapping

DT-018 – Membership Domain & Repository, used exactly as approved in `EP-007_Development_Tasks.md` (no re-derivation, no reinterpretation):

- **Objective:** Introduce the Membership domain/repository/service foundation only — `Membership` and `MembershipRole` as real domain objects, a new `MembershipId` branded identifier, a `MembershipRepository` port with an in-memory implementation, and a `MembershipService` exposing a `grantMembership(...)` method. Builds the mechanical capability to construct and save a Membership; does not build an authorized, admin-facing "grant a Membership" flow.
- **Acceptance Criteria:** `MembershipId` added to `ids.ts` via the existing branded-ID factory pattern; `Membership` carries its own `MembershipId`, `organizationId: OrganizationId`, `userId: UserId`, `role: MembershipRole`; `MembershipRole` is `'administrator' | 'employee'`; `MembershipRepository` exists with `findByUserId(userId: UserId): Membership | null` and a save/create method, `InMemoryMembershipRepository` implements it; `MembershipService` constructs a `Membership` and calls the repository's save method, producing `MembershipGranted`; unit tests cover `MembershipId` construction (including empty/whitespace rejection), the repository's find/save round-trip and not-found case, and the service producing `MembershipGranted` with correct fields.
- **Implementation Boundary:** everything DT-017 lists, plus DT-017's own `Organization`/`OrganizationRepository`/`OrganizationManagementService` (consumed via `OrganizationId` only, not modified).
- **Out of Scope (per DT-018 itself):** the Membership-granting bootstrap question remains explicitly unresolved; `MembershipService.grantMembership(...)` performs no authorization check; no admin-facing Membership-granting flow is implemented or ready for use after DT-018; multi-organization membership is out of scope; a durable/file-backed `MembershipRepository` implementation is out of scope.
- **Dependencies (per `EP-007_Development_Tasks.md`):** DT-017 (an Organization must exist for a Membership to reference) — satisfied, Completed.

No other Development Task is mapped to this sprint.

## 11. Testing Strategy

- `npm run typecheck --workspace=@taptime/core` — must pass with no errors.
- `npm run test --workspace=@taptime/core` — must pass; all 164 pre-existing tests (as of Development Sprint 012) must remain green, plus new tests covering:
  - `MembershipId` construction (a valid non-empty string succeeds).
  - `MembershipId` rejection of an empty or whitespace-only string, mirroring every other branded ID's existing rejection behavior (`ids.test.ts`'s established pattern).
  - `InMemoryMembershipRepository`: save-then-find-by-userId round-trip.
  - `InMemoryMembershipRepository`: not-found case (`findByUserId` for a `userId` that was never saved returns `null`).
  - `MembershipService`: produces a `MembershipGranted` event carrying the correct `Membership` fields (`organizationId`, `userId`, `role`, a generated `MembershipId`).
  - `MembershipService`: calls the repository's save method with the exact constructed `Membership`.
  - `MembershipService`: deterministic when a fixed `MembershipId` generator is injected (mirroring DT-017's own test, not explicitly required by DT-018's Acceptance Criteria wording but directly implied by "uses injectable deterministic ID generation, following DT-017... patterns").
- No `apps/mobile` tests are expected or required — DT-018 adds no `apps/mobile` code and no `apps/mobile` file is touched.
- No physical-device validation is relevant to DT-018.
- Explicit non-regression check: `git diff --stat` outside the six new files (Section 9), the `ids.ts` extension, their tests, and the `index.ts` export additions must be empty. In particular, `Organization.ts` and `OrganizationManagementService.ts` must be confirmed byte-for-byte unchanged.

## 12. Risks

| Risk | Mitigation |
|---|---|
| Silently wiring `MembershipAuthorizationValidator` (or a stub of it) into `MembershipService` "since TS-002's sequence diagram shows it" | Section 3 explains directly why this sprint's `MembershipService` is a deliberate, already-approved narrowing of TS-002's full sequence; DT-019 does not exist yet, and DT-018's own Out of Scope forbids any authorization wiring here. The Development Agent Prompt (Section 16) states this directly. |
| Resolving or silently working around the first-Administrator bootstrap question (e.g., by special-casing "the first Membership for an Organization needs no authorization") | DT-018's Out of Scope names this exact question and states it "remains explicitly unresolved after this task"; `MembershipService.grantMembership(...)` performs the same unconditional construct-and-save for every call, with no first-Membership special case. |
| Scope creep into DT-019/DT-020–DT-022 ("since Membership is done, the authorization validator or a repository write extension is a natural next small step") | Out of Scope (Section 7) explicitly names DT-019–DT-026 as excluded; the Stop Condition (Section 18) reinforces stopping after DT-018. |
| Adding a `findById(id: MembershipId)` method to `MembershipRepository` "for completeness," alongside `findByUserId` | Not required by DT-018's Acceptance Criteria or TS-002's Ports section, both of which name only `findByUserId` plus a save method; not added unless a future task's Acceptance Criteria require it. |
| `MembershipRole` naming/location drift (own file vs. inlined in `Membership.ts`) | Section 9 discloses this as a judgment call, not a hidden decision; if the Development Agent finds repository reality favors a different placement, it must document why, per this repository's standing "repository reality has priority" practice. |
| Under-testing `MembershipId`'s empty/whitespace rejection, mirroring the kind of gap DT-007 disclosed for `QueuedWorkEventRecord.decision: null` | Acceptance Criteria explicitly require this test, called out directly in the Development Agent Prompt's testing requirements (Section 16). |
| Accidentally validating that the referenced `Organization` exists (e.g., calling `OrganizationRepository.findById` from inside `MembershipService`) | Neither DT-018's Acceptance Criteria nor TS-002's Sequence Diagram 2 include this step; `MembershipService` trusts its `organizationId` parameter exactly as `OrganizationManagementService` trusts its `name` parameter — no cross-repository call is introduced. |

## 13. EP-009 Product Readiness Impact

Evaluated per EP-009's domain list (`EP-009_Product_Readiness_Framework.md`), using repository evidence only, consistent with Development Sprint 012's own per-domain discipline:

- **Engineering Readiness:** Marginally, positively affected — extends the domain/port/adapter/event/service pattern DT-017 just proved out to a second, genuinely new domain area (an association type with its own identity, following ADR-0002's `NfcAssignment` precedent, rather than a simple root entity). Not a tier-level change by itself; it is the second of ten planned Organization Management tasks.
- **Product Readiness:** **Unchanged.** No product-facing or pilot-facing capability exists after DT-018 alone — `MembershipService` has no caller anywhere in the repository, exactly as `OrganizationManagementService` has none today. A Membership can be constructed and saved in a test, but nothing in the running system can grant one yet, and no authorization exists even if something could call it.
- **Customer Readiness:** **Unchanged.** DT-018 does not change Customer Readiness in a user-facing way — a pilot customer's Administrators and Employees cannot be granted Memberships through any user-facing or operator-facing path after this sprint; that requires DT-019 (authorization), DT-023 at minimum (an Administrator-facing flow), and the still-unresolved bootstrap decision.
- **Deployment Readiness:** **Unchanged.** No new dependency, no new persistence technology, no deployment-relevant change.
- **Technical Operations Readiness:** **Unchanged.** No operational tooling, monitoring, or runbook implication.
- **Scaling Readiness:** **Unchanged.** In-memory-only implementation, consistent with DT-017 and every other repository added at this stage of the pattern; no scaling property is introduced or resolved.

**Explicit statement, per the assigning task's own instruction:** DT-018 is foundational. It begins the Membership capability required for pilot readiness. It does not by itself make TapTim.e pilot-ready. It does not change Customer Readiness in a user-facing way. No domain's tier is claimed to change as a result of this sprint alone.

## 14. Definition of Done

For the eventual implementation and closure of this sprint (not performed by this planning task itself — see Stop Condition):

- `MembershipId`, `MembershipRole`, `Membership`, `MembershipGranted`, `MembershipRepository`, `InMemoryMembershipRepository`, `MembershipService` exist exactly as specified in Sections 6/9/10.
- `npm run typecheck --workspace=@taptime/core` and `npm run test --workspace=@taptime/core` both pass; all 164 pre-existing tests remain green.
- `git diff` confirms zero changes to any file outside the new files, `ids.ts`'s extension, their tests, and `packages/core/src/index.ts`'s export additions — in particular, `Organization.ts` and `OrganizationManagementService.ts` are confirmed byte-for-byte unchanged.
- `EP-007_Development_Tasks.md`'s DT-018 "Implementation Notes" placeholder is filled in with the actual implementation summary, at closure time (not part of this planning task).
- Review Agent verification and Human Architect approval are recorded before DT-018 is marked Completed (DTP-001: "Implementation alone never completes a Development Task").

## 15. Recommended Implementation Order

1. Add `MembershipId` to `ids.ts`.
2. Add the `MembershipRole` value type.
3. Add the `Membership` domain object.
4. Add the `MembershipGranted` domain event.
5. Add the `MembershipRepository` port.
6. Add `InMemoryMembershipRepository`.
7. Add `MembershipService` with injectable deterministic `MembershipId` generation.
8. Register all in `packages/core/src/index.ts`'s barrel export, in the existing grouped style (domain, then events, then ports, then infrastructure, then application — matching the file's current section ordering and DT-017's own five-line addition as the most recent precedent).
9. Add unit tests (`MembershipId` construction and rejection, repository round-trip and not-found, service event/save/determinism).
10. Run `npm run typecheck --workspace=@taptime/core` and `npm run test --workspace=@taptime/core`; confirm `git diff --stat` touches only the expected files.

Repository evidence supports this order directly: each step's output is a precondition for the next (`MembershipRole` and `MembershipId` must exist before `Membership` can reference them; the event must exist before the service can produce it; the port must exist before the in-memory adapter can implement it; the adapter must exist before the service can call it), and testing is deliberately last, after all production code exists — the identical order DT-017 (Development Sprint 012) already used successfully.

---

## 16. Development Agent Prompt

The following prompt is written to be given directly to Claude Code (Development Agent) to execute Development Sprint 013. It is self-contained and does not require this planning document to be re-explained.

```text
You are the Development Agent for TapTim.e, implementing Development Sprint 013 ("Membership Domain & Repository," DT-018 only) on branch `main`.

CONTEXT (verify before writing code):
- Read `ADO/02_Development/Development_Sprint_013_Plan.md` in full — it is the authoritative scope for this task.
- Read `ADO/01_Architecture/Feature_Blueprints/FB-002-organization-management-foundation.md` (Capability 2, Decision 2) and `ADO/01_Architecture/Technical_Specifications/TS-002-organization-management-foundation.md` (Domain Model, Ports, Application Services sections, and Sequence Diagram 2) — the product/technical basis for what you are building.
- Read `ADO/02_Development/EP-007_Development_Tasks.md`'s "## DT-018 – Membership Domain & Repository" section — your exact Objective, Acceptance Criteria, Implementation Boundary, Out of Scope and Dependencies.
- Read these existing files as your structural templates, exactly: `packages/core/src/domain/ids.ts` (branded ID pattern — `UserId` and `OrganizationId` already exist here; add `MembershipId` the same way), `packages/core/src/domain/Organization.ts` and `packages/core/src/infrastructure/repositories/InMemoryOrganizationRepository.ts` and `packages/core/src/domain/events/OrganizationCreated.ts` and `packages/core/src/application/OrganizationManagementService.ts` (DT-017, completed one sprint ago — your nearest, most directly comparable precedent for every one of the six components you are building), `packages/core/src/index.ts` (the barrel-export convention).
- Do not modify DT-001–DT-017 domain/business/application/infrastructure code (including `Organization.ts`, `OrganizationRepository.ts`, `InMemoryOrganizationRepository.ts`, `OrganizationManagementService.ts` — consume `OrganizationId` only), FB-001, TS-001, TTAP-001, any ADR, Product Vision, Product Principles, Domain Model, Role Model, EP-008, EP-009, FB-002, or TS-002.

IMPLEMENTATION SCOPE (do exactly this, nothing more):
1. Add `MembershipId` to `packages/core/src/domain/ids.ts`, following the exact same `Brand<Value, BrandName>`/`brandedNonEmptyString` factory pattern already used for every other ID type in that file.
2. Create `MembershipRole` in `packages/core/src/domain/MembershipRole.ts`: a value type, `'administrator' | 'employee'` — not a class, not an entity, not exported as anything beyond the literal union type.
3. Create `Membership` in `packages/core/src/domain/Membership.ts`: a domain object with its own `id: MembershipId`, `organizationId: OrganizationId`, `userId: UserId`, and `role: MembershipRole`.
4. Create `MembershipGranted` in `packages/core/src/domain/events/MembershipGranted.ts`, following `OrganizationCreated.ts`'s exact shape: a `type: 'MembershipGranted'` discriminant plus the created `Membership`, and a constructor function.
5. Create the `MembershipRepository` port in `packages/core/src/ports/MembershipRepository.ts`: `findByUserId(userId: UserId): Membership | null` plus one save/create method (name it consistently with `OrganizationRepository`'s verb choice — e.g. `save`). Do NOT add a `findById(id: MembershipId)` method — it is not required by DT-018's Acceptance Criteria.
6. Create `InMemoryMembershipRepository` in `packages/core/src/infrastructure/repositories/InMemoryMembershipRepository.ts`, implementing `MembershipRepository`, following `InMemoryOrganizationRepository.ts`'s exact structural pattern (constructor-seeded array, defensively copied so the caller's array cannot be mutated by later saves).
7. Create `MembershipService` in `packages/core/src/application/MembershipService.ts`, exposing `grantMembership(organizationId: OrganizationId, userId: UserId, role: MembershipRole): MembershipGranted`. Generate the new `Membership`'s `MembershipId` using an injectable generator following `OrganizationManagementService`'s exact pattern (`newMembershipId: () => MembershipId = () => MembershipId(generateId())`). Call `MembershipRepository`'s save method, then return/produce `MembershipGranted`. This service performs NO authorization check of any kind — it does not call `OrganizationRepository`, does not check whether the `organizationId` refers to a real Organization, and does not call any validator (`MembershipAuthorizationValidator` does not exist yet — it is a later Development Task, DT-019). Do not add any precondition, uniqueness check, or special-casing for "the first Membership of an Organization."
8. Register all new exports in `packages/core/src/index.ts`, in the same grouped, `export * from` style already used there (domain object and value type near the other domain exports, event near the other event exports, port near the other port exports, in-memory adapter near the other infrastructure exports, service near the other application exports) — the same five-line-addition pattern DT-017 just established.

ARCHITECTURE BOUNDARIES (do not violate):
- Do not touch `Organization`, `OrganizationRepository`, `InMemoryOrganizationRepository`, `OrganizationManagementService`, `OrganizationCreated`, `Customer`, `NfcTag`, `NfcAssignment`, `AssignmentTarget`, `CallerContext`, or any existing port, repository, business class, or Application Service.
- Do not touch `BusinessEngine`, `AssignmentResolver`, `AssignmentValidator`, `WorkEventFactory`, `NfcScanApplicationService`, `OfflineQueue`, `SynchronizationService`, or any error-classification function.
- Do not touch `apps/mobile`, `packages/core/src/cli/runScan.ts`, or any CLI entry point — no wiring of `MembershipService` into anything runnable is part of this sprint.
- Do not implement DT-019 (`MembershipAuthorizationValidator`), DT-020–DT-022 (repository write extensions), DT-023–DT-025 (`OrganizationAdministrationService`), DT-026, or any other Development Task — this sprint is DT-018 only.
- Do not introduce a `User`, `Employee`, `Administrator`, or Identity domain entity — Administrator and Employee are `MembershipRole` values only, carried by a `Membership`.
- Do not resolve the first-Administrator bootstrap question in any form (no special case, no default role, no implicit authorization).

TESTING REQUIREMENTS:
- `MembershipId` construction: a valid non-empty string succeeds.
- `MembershipId` rejection: an empty string and a whitespace-only string both throw, mirroring every other branded ID's existing test coverage in `ids.test.ts`.
- `InMemoryMembershipRepository`: a save-then-find-by-userId round-trip test.
- `InMemoryMembershipRepository`: an explicit not-found-case test (`findByUserId` for a `userId` that was never saved returns `null`) — do not skip this case.
- `MembershipService`: verify `grantMembership(...)` produces a `MembershipGranted` event carrying the correct `Membership` fields, and that the repository's save method was called with that same `Membership`.
- `MembershipService`: verify deterministic output when a fixed `MembershipId` generator is injected.
- Run `npm run typecheck --workspace=@taptime/core` and `npm run test --workspace=@taptime/core`; both must pass, with all 164 pre-existing tests remaining green, before you consider the task done.
- Confirm via `git diff --stat` that only the new files, `ids.ts`, their tests, and `packages/core/src/index.ts` were changed — `Organization.ts` and `OrganizationManagementService.ts` must show zero diff.

EXPECTED DELIVERABLES:
- The new files and their tests, committed with a clear commit message referencing DT-018 and Development Sprint 013.
- `packages/core/src/index.ts` updated with the new export lines.
- A short implementation summary (changed files, test results, any naming/location decisions you made and why) suitable for Review Agent evaluation. Do NOT update `EP-007_Development_Tasks.md`'s DT-018 "Implementation Notes" section yourself — that update happens at governance closure, a separate, later task.

STOP CONDITION:
Stop after completing the Implementation Scope and tests above. Do not begin DT-019 or any other Development Task. Do not create Development Sprint 014. Do not modify FB-002, TS-002, `Organization.ts`, `OrganizationManagementService.ts`, or `EP-007_Development_Tasks.md`. Wait for review.
```

---

## 17. Role Handover

Implemented scope in this task: Development Sprint 013 planning only — this document and the embedded Development Agent Prompt, scoped exclusively to DT-018. No source code was written or modified. No architecture, ADR, TTAP-001, FB-001, TS-001, FB-002, TS-002, Product Vision, Product Principles, Domain Model, Role Model, EP-008, or EP-009 content was changed.

Changed artifacts: `ADO/02_Development/Development_Sprint_013_Plan.md` (new, this file). `ADO/00_Core/Decision_Log.md` was deliberately **not** updated — see the disclosed judgment call below. `ADO/00_Core/Project_Status.md` was updated with a small, targeted change — see below.

**Disclosed judgment call (Decision_Log.md):** the assigning task instructed updating `Decision_Log.md` "only if the repository's current sprint-planning pattern requires a DEV-SPRINT-013 Planned row." This repeats the same evaluation performed for Development Sprint 012's own plan: every Sprint Plan from 003 through 012 received its first Decision Log row only at Governance Closure, not at planning time (the sole exception, `DEV-SPRINT-002`, is a single historical outlier, not the established pattern, and was already so-documented in Development Sprint 012's own Role Handover). Per "repository evidence decides," `Decision_Log.md` is therefore not updated by this task; a `DEV-SPRINT-013` row will be added at Sprint 013's governance closure, consistent with every prior sprint since Sprint 003.

**Disclosed judgment call (Project_Status.md):** a small, targeted update was made — the Status line, one Current State bullet reference, the Current Epics bullet, and Immediate Next Steps item 3 — to reflect that Development Sprint 013 (DT-018 only) is now Planned, mirroring exactly the same small-update pattern Development Sprint 012's own plan applied when it first became Planned. No FB-002/TS-002 status language was touched (both remain correctly described as "reviewed," not "approved," from the prior closure) and no other section was altered.

Related ADO artifacts consulted: `Development_Sprint_012_Closure.md`, `Development_Sprint_012_Plan.md`, `FB-002-organization-management-foundation.md`, `TS-002-organization-management-foundation.md`, `EP-007_Development_Tasks.md` (DT-017 Implementation Notes, DT-018 section, and Task Sequence diagram), `Decision_Log.md`, `Project_Status.md`, EP-008 Chapters 00–03 (Ch03 §10.64–10.68 specifically, for DT-017's implemented-reality narrative), and direct inspection of current repository code: `packages/core/src/domain/ids.ts`, `packages/core/src/domain/Organization.ts`, `packages/core/src/domain/events/OrganizationCreated.ts`, `packages/core/src/ports/OrganizationRepository.ts`, `packages/core/src/infrastructure/repositories/InMemoryOrganizationRepository.ts`, `packages/core/src/application/OrganizationManagementService.ts`, `packages/core/src/index.ts`.

Tests performed: none (planning-only task; no code changed). Current repository test/typecheck state (164 `packages/core` tests passing, typecheck clean, as verified and recorded at Development Sprint 012's governance closure) is cited here, not re-run since no code changed.

Known deviations: none from the assigned task scope.

Unresolved questions / open findings carried forward, unaffected by this task: TS-002's Membership-granting bootstrap question (directly relevant to, but not resolved by, DT-018 — resolution is a Human Architect decision, and even once resolved, wiring it is a separate future task, not DT-018 or DT-019 alone); FB-002's remaining Open Questions; DT-016 physical-device validation; iOS NFC support; Development Sprint 002/004 governance backlog; Finding F-01; the backend/cloud persistence technology decision; the future Identity-layer Feature Blueprint; FB-002's/TS-002's own "Draft" header status fields.

Evidence produced: this plan document and the embedded Development Agent Prompt and Role Handover.

Next responsible role: Technical Lead / Human Architect review and approval of this Sprint 013 Plan. Per the assigned stop condition, implementation does not begin until approval is given, and no further Development Task beyond DT-018 is started within this sprint even after approval.

## 18. Stop Condition

Per task instruction: stop after producing this Development Sprint 013 Plan and the minimum required cross-reference update (Project_Status.md only, per the disclosed judgment call above). No code was implemented or modified. Sprint 013 execution has not begun. DT-019 has not been started. Development Sprint 014 was not created. Awaiting Technical Lead / Human Architect review.
