# Development Sprint 016 Plan – Organization Administration: Customer Registration (DT-023)

Status: Planned
Role: Research / Implementation Support acting on behalf of Technical Lead (per AGR-001)
Epic: EP-007 – Product Architecture Foundation (implementation), governed in priority by EP-009 – Product Readiness Framework
Owner: Technical Lead
Approval Authority: Human Architect
Branch: `main`
Created Date: 2026-07-08
Related Development Tasks: DT-023 – Organization Administration: Customer Registration (only)
Related Feature Blueprint / Technical Specification: FB-002 – Organization Management Foundation; TS-002 – Organization Management Foundation Technical Specification
Related Artifacts: `Development_Sprint_015_Closure.md`, `Development_Sprint_015_Plan.md`, `Development_Sprint_014_Closure.md`, `Development_Sprint_013_Closure.md`, `Development_Sprint_012_Closure.md`, `EP-007_Development_Tasks.md`, `Decision_Log.md`, `Project_Status.md`, EP-008 Chapters 00–03

---

## 1. Executive Summary

Development Sprint 015 completed DT-020, DT-021, and DT-022, giving `CustomerRepository`, `NfcTagRepository`, and `NfcAssignmentRepository` a real write path for the first time. Development Sprint 016 continues the TS-002 implementation sequence with the next unblocked unit: **DT-023 — Organization Administration: Customer Registration — and DT-023 only**. No other Development Task (DT-024, DT-025, DT-026) is part of this sprint.

DT-023 creates `OrganizationAdministrationService` for the first time — TS-002's single Application Service for FB-002 Capability 4 — with exactly one method, `createCustomer(...)`. This is the first Application Service in the Organization Management sequence to orchestrate a Business-area validator (`MembershipAuthorizationValidator`, DT-019) together with a repository write path (`CustomerRepository.save`, DT-020): both of its dependencies are now satisfied for the first time, which is exactly why DT-023 is the correct next step and not, for example, DT-024 or DT-025 (Section 5, below). `createCustomer(...)` calls `MembershipAuthorizationValidator.authorize(...)` first; on rejection, it returns the rejection reason and performs no write; on acceptance, it constructs a `Customer` (with `organizationId` taken from the requesting Membership), calls `CustomerRepository.save`, and produces `CustomerCreated`. It owns no business rule of its own — the authorization decision belongs to `MembershipAuthorizationValidator`, persistence belongs to `CustomerRepository`, and event representation belongs to `CustomerCreated` — exactly matching `NfcScanApplicationService`'s and `OrganizationManagementService`'s existing "orchestrates but does not interpret" boundary (EP-008 Ch03 §2.3/5.4).

After this sprint, an Administrator Membership can, for the first time, register a Customer through a real Application Service call — though still only from a test, since no UI, CLI, or mobile entry point calls `OrganizationAdministrationService` yet. `registerNfcTag(...)` (DT-024) and `assignNfcTag(...)` (DT-025) remain entirely unbuilt; they will later extend this same class, not create a second instance of it.

## 2. Repository Evidence

- `Development_Sprint_015_Closure.md`, Section 15 (Next Sprint Recommendation): "the next safe implementation step is DT-023 – OrganizationAdministrationService Customer Registration. DT-023 depends on both MembershipAuthorizationValidator (DT-019, complete since Development Sprint 014) and CustomerRepository.save (DT-020, complete as of this sprint) — both of its dependencies are now satisfied for the first time. DT-023 should be planned alone, not bundled with DT-024/DT-025, because it creates OrganizationAdministrationService for the first time... DT-024 and DT-025 should remain future work."
- `EP-007_Development_Tasks.md`, DT-023 section (as approved): Objective — "Create `OrganizationAdministrationService` (TS-002's single Application Service for Capability 4) with its first method, `createCustomer(...)`, orchestrating `MembershipAuthorizationValidator` and the DT-020 write path... **This task creates the `OrganizationAdministrationService` class itself; DT-024 and DT-025 extend this same class with their own methods — neither DT-024 nor DT-025 creates a separate or second instance of this service.**" Dependencies: "DT-019 (`MembershipAuthorizationValidator`), DT-020 (`CustomerRepository` write path)" — both confirmed Completed (`DEV-SPRINT-014`, `DEV-SPRINT-015` in `Decision_Log.md`).
- `TS-002-organization-management-foundation.md`, Application Services section: "**OrganizationAdministrationService** (Capability 4 / FB-002 Decisions 3–5). Three methods, one per FB-002 Decision... Each method: (1) calls `MembershipAuthorizationValidator`... with the requesting actor's Membership and the target Organization; (2) on acceptance, constructs the domain object and calls the relevant extended repository's save method; (3) produces the corresponding Event... or returns the rejection." Sequence Diagram 3 (Customer Registration): "Administration request (actor's Membership, Organization, Customer data) -> `OrganizationAdministrationService.createCustomer` -> `MembershipAuthorizationValidator` (accepted | membership_not_found | membership_lacks_administrator_role | cross_organization_access) -> [accepted] constructs Customer domain object -> `CustomerRepository.save` -> `CustomerCreated`." This sequence diagram is repository evidence directly confirming that `createCustomer(...)`'s rejection branch reuses `MembershipAuthorizationValidator`'s own three rejection reasons verbatim, not a separate `AdministrativeActionRejected` category — see Section 8 below for how this resolves the assigning task's own "prefer reusing `MembershipAuthorizationResult`... do not invent unrelated result categories" instruction.
- `FB-002-organization-management-foundation.md`, Decision 3 (Create Customer / AssignmentTarget): "Trigger: an Administrator Membership requests a new Customer within their Organization. Preconditions: the requesting Membership must have the Administrator Role and must belong to the target Organization. Decision: create the Customer, owned by that Organization; otherwise reject." Business Rule: "Only a Membership with the Administrator Role may create or assign Organization-owned pilot data."
- Direct code inspection confirms `MembershipAuthorizationValidator.authorize(membership: Membership | null, organizationId: OrganizationId): MembershipAuthorizationResult` (`packages/core/src/business/MembershipAuthorizationValidator.ts`), unchanged since Development Sprint 014, with `MembershipAuthorizationResult` a two-variant discriminated union: `{ status: 'accepted', membership: Membership }` or `{ status: 'rejected', reason: MembershipAuthorizationRejectionReason }` where `MembershipAuthorizationRejectionReason` is `'membership_not_found' | 'membership_lacks_administrator_role' | 'cross_organization_access'`.
- Direct code inspection confirms `CustomerRepository.save(customer: Customer): void` (`packages/core/src/ports/CustomerRepository.ts`) and `InMemoryCustomerRepository`'s implementation, both unchanged since Development Sprint 015; `Customer` is `{ id: CustomerId, organizationId: OrganizationId, active: boolean }` (`packages/core/src/domain/Customer.ts`); `CustomerCreated` is `{ type: 'CustomerCreated', customer: Customer }` plus a `customerCreated(customer)` constructor function (`packages/core/src/domain/events/CustomerCreated.ts`).
- Direct code inspection of `OrganizationManagementService.ts` and `MembershipService.ts` confirms the established Application Service constructor pattern this sprint will reuse: a single repository (or, for `OrganizationAdministrationService`, a validator plus a repository) injected via constructor, plus an injectable deterministic id generator defaulting to `() => XId(generateId())`, mirroring `WorkEventFactory`/`BusinessEngine`'s precedent.
- Direct code inspection of `NfcScanApplicationService.ts` confirms the established orchestration pattern for an Application Service that calls a Business-area component and branches on its result before deciding whether to perform a write — `OrganizationAdministrationService.createCustomer(...)` follows this shape directly: resolve → branch on acceptance/rejection → write only on acceptance → return a result.
- Direct code inspection confirms `OrganizationAdministrationService` does not exist anywhere in the repository today (`find . -iname "*OrganizationAdministrationService*"` returns no result) — this sprint creates it for the first time.

## 3. Why DT-023 Is Selected

The Primary Planning Question is how DT-023 should create `OrganizationAdministrationService` with only customer-registration capability while preserving the existing architecture and avoiding premature DT-024/DT-025 work. Repository evidence answers directly why DT-023, specifically, is next: `EP-007_Development_Tasks.md` names DT-023's Dependencies as DT-019 and DT-020, and both are now Completed (`DEV-SPRINT-014`, `DEV-SPRINT-015`) — DT-023 is the only remaining Organization Management Development Task whose full dependency set is satisfied and whose implementation has not yet begun. DT-024 depends on DT-021 (also complete) but additionally depends on DT-023 itself having created `OrganizationAdministrationService` first, since DT-024 extends that same class rather than creating a new one; the same is true of DT-025 with respect to DT-022. DT-023 is therefore the only task in the DT-023–DT-025 group that can be started today.

## 4. Why DT-024 and DT-025 Are Not Included

DT-024 (NFC Tag Registration) and DT-025 (NFC Tag Assignment) both extend the exact same `OrganizationAdministrationService` class this sprint creates — `EP-007_Development_Tasks.md`'s own DT-024 wording is explicit: "Extend `OrganizationAdministrationService` — **created by DT-023, not created again here** — with a second method." Bundling DT-023 with either or both would require either building all three methods against a class that does not exist yet at planning time (circular), or building the class first and its later methods "while already in this area," which is exactly the discipline `Development_Sprint_015_Plan.md` Section 4 warned against for the reverse case (DT-023–DT-025 sharing one class is precisely why *that* plan declined to bundle DT-023 into Sprint 015). The three-method service is deliberately being built one method at a time, each on its own Development Task, each independently reviewable: DT-023's `createCustomer(...)` can be fully verified — typechecked, tested, and reasoned about — without any knowledge of what `registerNfcTag(...)` or `assignNfcTag(...)` will eventually look like. This is the same "smallest safe Development Sprint" discipline every prior single-task Organization Management sprint (012, 013, 014) already applied, now reapplied here after Sprint 015's evidence-justified three-task exception. DT-025 additionally requires verifying that an `NfcTag` and an `AssignmentTarget` belong to the same Organization (FB-002 Decision 5) — a cross-check `createCustomer(...)` has no equivalent of — which is a further, independent reason not to plan it alongside DT-023 before DT-023's own simpler shape is implemented and reviewed first.

## 5. Business Objective

Give an Administrator Membership a real, callable way to register a Customer within their own Organization — the first Application Service in Organization Management to combine an authorization decision with a persistence write. This is a genuine step toward Organization Management usability (Section 13, below), but it does not by itself make TapTim.e pilot-ready: no UI, CLI, or mobile entry point calls `OrganizationAdministrationService` after this sprint, so a Customer can still be registered only from a test.

## 6. Technical Objective

Create `OrganizationAdministrationService` with exactly one method, `createCustomer(...)`, that: (1) calls `MembershipAuthorizationValidator.authorize(membership, organizationId)` first; (2) on rejection, returns the rejection reason and performs no write; (3) on acceptance, constructs a `Customer` with `organizationId` taken from the requesting Membership's own `organizationId`, calls `CustomerRepository.save`, and produces `CustomerCreated`. Zero change to `MembershipAuthorizationValidator`, `MembershipAuthorizationResult`, `Membership`, `MembershipRole`, `Customer`, `CustomerRepository`, `InMemoryCustomerRepository`, or `CustomerCreated` — all four are consumed exactly as they exist today.

## 7. Scope

Per the assigning task, Development Sprint 016 includes only DT-023. The sprint plans implementation of:

- `OrganizationAdministrationService` class, newly created.
- `createCustomer(...)` method only — no `registerNfcTag(...)`, no `assignNfcTag(...)`.
- `MembershipAuthorizationValidator` orchestration (called first, unconditionally, before any write).
- `Customer` construction (on acceptance only), with `organizationId` taken from the requesting Membership.
- `CustomerRepository.save` usage (on acceptance only).
- `CustomerCreated` event production (on acceptance only).
- Explicit rejection handling: the rejection reason is returned; no write occurs; no event is produced.
- Unit tests for the accepted path and every rejection path, including explicit proof that no write occurs on rejection.
- Barrel-export registration of `OrganizationAdministrationService` in `packages/core/src/index.ts`, within the existing `application/` grouped section.

## 8. Out of Scope

Explicitly excluded from this sprint, per the assigning task:

- DT-024 (NFC Tag Registration), DT-025 (NFC Tag Assignment), DT-026 (Scan Pipeline Integration Verification).
- `registerNfcTag(...)`, `assignNfcTag(...)` — no method beyond `createCustomer(...)` is added to `OrganizationAdministrationService`.
- Any UI, any mobile work, any CLI command.
- Any Identity work, any `AuthenticationGateway` change, any `FakeAuthenticationGateway` change, any real authentication provider.
- Any change to `MembershipService`, `OrganizationManagementService`, or `MembershipAuthorizationValidator`.
- Any change to `CustomerRepository` beyond using its already-existing `save` method (added by DT-020); no change to `NfcTagRepository` or `NfcAssignmentRepository`.
- Any change to `AssignmentResolver`, `AssignmentValidator`, `BusinessEngine`, `WorkEventFactory`, `NfcScanApplicationService`, `CallerContext`, `OfflineQueue`, `SynchronizationService`, or error handling.
- Any backend/cloud persistence technology, any database schema, any API design, any durable/file-backed adapter implementation.
- Any physical NFC validation, any tag registration, any tag assignment, any scan-pipeline integration verification.
- Any Membership bootstrap decision (TS-002's own surfaced Open Question, still unresolved).
- Any Customer update or deactivation.
- Any Customer field validation beyond what `Customer`'s existing shape already requires (`id`, `organizationId`, `active` — no new field, no new constraint).

**Result-shape scope note:** per the assigning task's own instruction ("prefer reusing `MembershipAuthorizationResult` unless TS-002/repository evidence requires a wrapper result; do not invent unrelated result categories"), `createCustomer(...)`'s return type is designed in Section 10 below as a minimal wrapper that reuses `MembershipAuthorizationResult`'s existing `RejectedMembershipAuthorizationResult` variant verbatim for every rejection path, adding only a new accepted variant (since `MembershipAuthorizationResult`'s own accepted variant carries a `Membership`, not a `Customer`/`CustomerCreated`, and `createCustomer(...)`'s caller needs the created `Customer`). FB-002 Decision 3's own "Result: `CustomerCreated`, or `AdministrativeActionRejected`" phrasing is a product-level description of the two possible outcomes, not a directive to name a new type `AdministrativeActionRejected` — TS-002's own Sequence Diagram 3 is the more precise, implementation-facing evidence, and it names the exact three rejection reasons `MembershipAuthorizationResult` already defines, confirming reuse rather than invention is correct here.

## 9. Existing Components Reused (Patterns, Not Code)

| Existing Precedent | File | Reused As |
|---|---|---|
| Application Service constructor pattern: repository/validator injected, deterministic id generation injectable | `packages/core/src/application/OrganizationManagementService.ts`, `MembershipService.ts` | Exact structural template for `OrganizationAdministrationService`'s constructor: `MembershipAuthorizationValidator` and `CustomerRepository` injected, `newCustomerId: () => CustomerId = () => CustomerId(generateId())` following the same default-parameter idiom. |
| Application Service orchestrates a Business-area result and branches before writing | `packages/core/src/application/NfcScanApplicationService.ts` (branches on `AssignmentValidationResult.status` before calling `WorkEventCreationPort`) | Exact structural template for `createCustomer(...)`: branch on `MembershipAuthorizationResult.status` before calling `CustomerRepository.save`. |
| Discriminated-union result type, accepted/rejected, reusing an existing rejection-reason union | `packages/core/src/business/AssignmentValidationResult.ts` (accepted variant carries additional fields beyond the rejected variant's) | Exact structural template for the new `CreateCustomerResult` type (Section 10): an accepted variant carrying `customer`/`event`, and a rejected variant identical in shape to `RejectedMembershipAuthorizationResult`. |
| "Orchestrates but does not interpret" boundary | `NfcScanApplicationService`, `OrganizationManagementService`, `MembershipService` (EP-008 Ch03 §2.3/5.4) | Applied identically: `OrganizationAdministrationService` owns no business rule; the authorization decision belongs to `MembershipAuthorizationValidator`, persistence to `CustomerRepository`, event shape to `CustomerCreated`. |
| Dedicated Application Service test file, accepted-plus-every-rejection-path coverage | `packages/core/tests/application/MembershipService.test.ts`, `OrganizationManagementService.test.ts` | Exact structural template for `OrganizationAdministrationService.test.ts`. |

No component from `AssignmentResolver`, `AssignmentValidator`, `BusinessEngine`, `WorkEventFactory`, the FB-001 scan pipeline, `OfflineQueue`, `SynchronizationService`, or `CallerContext` is called, imported, or otherwise touched by DT-023.

## 10. Components to Implement

| Component | Type | Location |
|---|---|---|
| `OrganizationAdministrationService` | Application Service (new) | `packages/core/src/application/OrganizationAdministrationService.ts` |
| `CreateCustomerResult` | Result type (new, minimal wrapper — see Section 8) | Co-located in `packages/core/src/application/OrganizationAdministrationService.ts`, following `NfcScanApplicationService`/`ScanPipelineOutcome`'s precedent of an Application-layer result type living beside the service that produces it, since — unlike `MembershipAuthorizationResult` — this result type is specific to one Application Service method's own return shape, not a reusable Business-area evaluation result |

`CreateCustomerResult` is designed as:

```typescript
export type CreateCustomerResult =
  | { readonly status: 'accepted'; readonly customer: Customer; readonly event: CustomerCreated }
  | RejectedMembershipAuthorizationResult;
```

This reuses `RejectedMembershipAuthorizationResult` (`{ status: 'rejected', reason: MembershipAuthorizationRejectionReason }`) verbatim, exactly matching TS-002 Sequence Diagram 3's own rejection-reason list, and adds only the minimum new accepted-branch shape the caller needs (the created `Customer` and its `CustomerCreated` event) — no new rejection category is invented, and no existing type is modified.

Repository reality confirms the proposed path matches this repository's existing convention exactly (verified by direct inspection of `packages/core/src/application/`, which already holds `OrganizationManagementService.ts`, `MembershipService.ts`, `NfcScanApplicationService.ts` as flat, one-file-per-service entries with no subdirectory). Tests are planned as a new `packages/core/tests/application/OrganizationAdministrationService.test.ts`, mirroring `MembershipService.test.ts`/`OrganizationManagementService.test.ts`'s existing location.

## 11. Development Task Mapping

**DT-023 – Organization Administration: Customer Registration**, used exactly as approved in `EP-007_Development_Tasks.md`:

- **Objective:** Create `OrganizationAdministrationService` with its first method, `createCustomer(...)`, orchestrating `MembershipAuthorizationValidator` and the DT-020 write path to let an Administrator Membership create a Customer within their own Organization.
- **Acceptance Criteria:** `createCustomer(...)` calls `MembershipAuthorizationValidator` first; on rejection, returns the rejection reason and performs no write; on acceptance, constructs a `Customer` (`organizationId` from the requesting Membership's Organization) and calls `CustomerRepository.save`, producing `CustomerCreated`; an Employee Membership is rejected with `membership_lacks_administrator_role`; an Administrator Membership of a different Organization is rejected with `cross_organization_access`; unit tests cover the accepted path and every rejection path, verifying no write occurs on rejection.
- **Implementation Boundary:** `MembershipAuthorizationValidator` (consumed, not modified); `CustomerRepository` (consumed, not modified beyond DT-020, already complete); any FB-001 pipeline component — none touched.
- **Testing Expectations:** unit tests, including a test-double or in-memory `MembershipAuthorizationValidator`/`CustomerRepository` combination proving the full orchestration; no composition-level pipeline test yet (DT-026's responsibility).
- **Out of Scope (per DT-023 itself):** any UI or CLI entry point calling this service; Customer field validation beyond what `Customer`'s existing shape already requires.
- **Dependencies:** DT-019 (`MembershipAuthorizationValidator`), DT-020 (`CustomerRepository` write path) — both Completed.

No other Development Task is mapped to this sprint.

## 12. Testing Strategy

- `npm run typecheck --workspace=@taptime/core` — must pass with no errors.
- `npm run test --workspace=@taptime/core` — must pass; all 197 pre-existing tests (as of Development Sprint 015) must remain green, plus new tests in `OrganizationAdministrationService.test.ts` covering:
  - **Accepted path:** an Administrator Membership whose `organizationId` matches the target Organization results in a `Customer` being constructed, `CustomerRepository.save` being called exactly once, and `CustomerCreated` being produced carrying that `Customer`.
  - **Missing Membership rejection:** `membership` passed as `null` results in `{ status: 'rejected', reason: 'membership_not_found' }`, with `CustomerRepository.save` never called.
  - **Employee Membership rejection:** a Membership with `role: 'employee'` results in `{ status: 'rejected', reason: 'membership_lacks_administrator_role' }`, with `CustomerRepository.save` never called.
  - **Cross-Organization rejection:** an Administrator Membership whose `organizationId` differs from the target Organization results in `{ status: 'rejected', reason: 'cross_organization_access' }`, with `CustomerRepository.save` never called.
  - **No-write proof, explicit:** for every one of the three rejection cases above, a dedicated assertion (e.g. an in-memory `CustomerRepository`/spy confirming zero `save` calls, or asserting the repository's own read state is unchanged) proves no write occurred — not merely inferred from the returned result shape.
- **Explicit non-regression requirements (per the assigning task):**
  - `MembershipAuthorizationValidator.test.ts` must pass **without any modification** — confirmed by an empty `git diff` against the pre-Sprint-016 commit.
  - `packages/core/tests/infrastructure/InMemoryCustomerRepository.test.ts` must pass **without any modification** — `CustomerRepository`'s read (`findById`) and write (`save`) behavior are both unchanged by this sprint.
  - `AssignmentValidator.test.ts` must pass **without any modification**.
  - No FB-001 scan-pipeline test (`AssignmentResolver.test.ts`, `NfcScanApplicationService`-related tests, `BusinessEngine.test.ts`, `WorkEventFactory.test.ts`) requires any behavioral change.
- No `apps/mobile` tests are expected or required — DT-023 adds no `apps/mobile` code and no `apps/mobile` file is touched.
- No physical-device validation is relevant to DT-023.
- Explicit scope-isolation check: `git diff --stat` outside the new `OrganizationAdministrationService.ts`, its new test file, and `packages/core/src/index.ts`'s export addition must be empty. In particular, `MembershipAuthorizationValidator.ts`, `MembershipAuthorizationResult.ts`, `Membership.ts`, `MembershipRole.ts`, `Customer.ts`, `CustomerCreated.ts`, `CustomerRepository.ts`, `InMemoryCustomerRepository.ts`, `AssignmentResolver.ts`, and `AssignmentValidator.ts` must be confirmed byte-for-byte unchanged.

## 13. Risks

| Risk | Mitigation |
|---|---|
| Implementing `registerNfcTag(...)` or `assignNfcTag(...)` alongside `createCustomer(...)` "since the class already exists now" | Out of Scope (Section 8) explicitly forbids this; DT-024/DT-025 are separate, later Development Tasks per Section 4's reasoning. |
| Inventing a new `AdministrativeActionRejected` result type instead of reusing `MembershipAuthorizationResult`'s rejection shape | Section 8/10 resolve this directly from repository evidence (TS-002 Sequence Diagram 3): the rejection branch reuses `RejectedMembershipAuthorizationResult` verbatim; only a new accepted variant is added. |
| Modifying `MembershipAuthorizationValidator` to add a Customer-specific check (e.g. accepting an optional Customer-creation flag) | Implementation Boundary (DT-023's own Acceptance Criteria) states the validator is "consumed, not modified"; `createCustomer(...)` calls `authorize(membership, organizationId)` exactly as it exists today, with no new parameter. |
| Adding Customer field validation beyond `Customer`'s existing shape (e.g. a name field, a uniqueness check) "since this is the first real creation flow" | Out of Scope, per DT-023's own Out of Scope and the assigning task's explicit exclusion; `Customer`'s shape (`id`, `organizationId`, `active`) is unchanged by this sprint. |
| Wiring `OrganizationAdministrationService` into a UI, CLI, or composition root "to make it usable" | Out of Scope, per DT-023's own Out of Scope ("any UI or CLI entry point calling this service"); no caller is introduced for `createCustomer(...)` by this sprint. |
| Accidentally modifying `MembershipAuthorizationValidator.test.ts`, `InMemoryCustomerRepository.test.ts`, or `AssignmentValidator.test.ts` while adding new test coverage nearby | Testing Strategy (Section 12) states this as an explicit, separately-verified requirement — all three files must show zero diff, checked directly via `git diff` before the sprint is considered complete. |
| Resolving the Membership-granting bootstrap question while deciding what happens if no Membership exists for the requesting actor | `authorize(null, ...)` already handles this today, rejecting unconditionally with `membership_not_found` (Development Sprint 014); `createCustomer(...)` performs no special-casing of its own — it simply returns whatever `MembershipAuthorizationValidator` decides. |

## 14. EP-009 Product Readiness Impact

Per the assigning task's explicit anti-overclaiming framing: DT-023 is foundational but more product-facing than DT-020–DT-022. DT-023 creates the first real Organization Administration application flow. DT-023 enables future pilot setup but does not by itself make TapTim.e pilot-ready. DT-023 does not create UI, CLI, mobile setup, tag registration, tag assignment, or scan integration.

- **Engineering Readiness:** Expected to **Improve (marginally)**. Repository evidence: this is the first Application Service to orchestrate a Business-area validator together with a repository write, backed by new dedicated tests proving both the accepted path and every rejection path, including explicit no-write proofs. This is the same kind of code-quality-level improvement DT-017–DT-022's own closures each recorded — not a readiness-category jump.
- **Product Readiness:** Expected to **Improve (marginally)**. Repository evidence: a real, testable Customer-registration capability now exists as an orchestrated flow, not just a repository method — a genuine step toward Capability 4 (Administration) being usable, though still not reachable from outside a test.
- **Customer Readiness:** Expected to remain **No Change**. DT-023 does not change Customer Readiness in a user-facing way — no UI, CLI, or mobile entry point calls `OrganizationAdministrationService`, so no real Administrator can register a real Customer through any real path after this sprint.
- **Deployment Readiness:** Expected to remain **No Change**. No build, release-pipeline, or hosting-target work is touched.
- **Technical Operations Readiness:** Expected to remain **No Change**. No CI/CD, monitoring, or environment-separation work is touched.
- **Scaling Readiness:** Expected to remain **No Change**. `OrganizationAdministrationService` orchestrates existing in-memory-only components; no new persistence or concurrency property is introduced.

This evaluation will be re-confirmed with actual, not merely expected, evidence at Sprint 016's governance closure, following the same discipline every prior sprint's closure applied.

## 15. Definition of Done

For the eventual implementation and closure of this sprint (not performed by this planning task itself — see Stop Condition):

- `OrganizationAdministrationService` exists with exactly one method, `createCustomer(...)`, implemented exactly as specified in Sections 7/10/11.
- `npm run typecheck --workspace=@taptime/core` and `npm run test --workspace=@taptime/core` both pass; all 197 pre-existing tests remain green.
- `MembershipAuthorizationValidator.test.ts`, `InMemoryCustomerRepository.test.ts`, and `AssignmentValidator.test.ts` all pass with zero modification, confirmed by `git diff` showing no changes to any of the three files.
- `git diff` confirms zero changes to any file outside the new `OrganizationAdministrationService.ts`, its new test file, and `packages/core/src/index.ts`'s export addition.
- `EP-007_Development_Tasks.md`'s DT-023 "Implementation Notes" placeholder is filled in with the actual implementation summary, at closure time (not part of this planning task).
- Review Agent verification and Human Architect approval are recorded before DT-023 is marked Completed (DTP-001: "Implementation alone never completes a Development Task").

## 16. Recommended Implementation Order

1. Inspect `OrganizationManagementService.ts`, `MembershipService.ts` (constructor/id-generation pattern) and `NfcScanApplicationService.ts` (orchestrate-then-branch pattern) as the two structural precedents this task combines.
2. Define `OrganizationAdministrationService`'s constructor: `MembershipAuthorizationValidator`, `CustomerRepository`, and an injectable `newCustomerId: () => CustomerId = () => CustomerId(generateId())`.
3. Define `CreateCustomerResult` (Section 10) beside the service.
4. Implement `createCustomer(...)`'s accepted path: call `authorize(...)`, on acceptance construct `Customer`, call `CustomerRepository.save`, return `{ status: 'accepted', customer, event: customerCreated(customer) }`.
5. Implement `createCustomer(...)`'s rejected-path return handling: on rejection, return the `RejectedMembershipAuthorizationResult` unchanged, performing no write.
6. Add a test for the accepted path.
7. Add tests for all three rejection paths (`membership_not_found`, `membership_lacks_administrator_role`, `cross_organization_access`).
8. Add explicit no-write-on-rejection assertions to each of the three rejection tests.
9. Register `OrganizationAdministrationService` in `packages/core/src/index.ts`'s existing `application/` grouped export section.
10. Run `npm run typecheck --workspace=@taptime/core` and `npm run test --workspace=@taptime/core`; explicitly confirm `MembershipAuthorizationValidator.test.ts`, `InMemoryCustomerRepository.test.ts`, and `AssignmentValidator.test.ts` show zero diff and still pass; confirm `git diff --stat` touches only the expected files.

Repository evidence supports this order directly: it mirrors `OrganizationManagementService`'s and `MembershipService`'s own construct-then-orchestrate build order, extended with `NfcScanApplicationService`'s branch-before-write discipline; validation is deliberately last, after both the accepted and every rejected path exist, consistent with every prior sprint's own approach.

---

## 17. Development Agent Prompt

The following prompt is written to be given directly to Claude Code (Development Agent) to execute Development Sprint 016. It is self-contained and does not require this planning document to be re-explained.

```text
You are the Development Agent for TapTim.e, implementing Development Sprint 016 ("Organization Administration: Customer Registration," DT-023 only) on branch `main`.

CONTEXT (verify before writing code):
- Read `ADO/02_Development/Development_Sprint_016_Plan.md` in full — it is the authoritative scope for this task.
- Read `ADO/01_Architecture/Feature_Blueprints/FB-002-organization-management-foundation.md` (Decision 3) and `ADO/01_Architecture/Technical_Specifications/TS-002-organization-management-foundation.md` (Application Services section, Sequence Diagram 3) — the product/technical basis for what you are building.
- Read `ADO/02_Development/EP-007_Development_Tasks.md`'s "## DT-023" section — your exact Objective, Acceptance Criteria, Implementation Boundary, Out of Scope and Dependencies.
- Read these existing files as your structural templates: `packages/core/src/application/OrganizationManagementService.ts` and `MembershipService.ts` (constructor pattern: repository/validator injected, deterministic id generation injectable via a default parameter), `packages/core/src/application/NfcScanApplicationService.ts` (orchestrate-then-branch pattern: call a Business-area component, branch on its result, write only on acceptance), `packages/core/src/business/AssignmentValidationResult.ts` (discriminated-union result shape: an accepted variant with extra fields, a rejected variant).
- Read the components you will consume, all unmodified: `packages/core/src/business/MembershipAuthorizationValidator.ts`, `packages/core/src/business/MembershipAuthorizationResult.ts`, `packages/core/src/domain/Membership.ts`, `packages/core/src/domain/MembershipRole.ts`, `packages/core/src/domain/Customer.ts`, `packages/core/src/domain/events/CustomerCreated.ts`, `packages/core/src/ports/CustomerRepository.ts`, `packages/core/src/infrastructure/repositories/InMemoryCustomerRepository.ts`, `packages/core/src/domain/ids.ts` (for `CustomerId`), `packages/core/src/domain/generateId.ts`.
- Do not modify `MembershipAuthorizationValidator.ts`, `MembershipAuthorizationResult.ts`, `Membership.ts`, `MembershipRole.ts`, `Customer.ts`, `CustomerCreated.ts`, `CustomerRepository.ts`, `InMemoryCustomerRepository.ts`, `MembershipService.ts`, `OrganizationManagementService.ts`, `AssignmentResolver.ts`, `AssignmentValidator.ts`, `AssignmentValidationResult.ts`, any of their test files, `NfcTagRepository.ts`, `InMemoryNfcTagRepository.ts`, `NfcAssignmentRepository.ts`, `InMemoryNfcAssignmentRepository.ts`, `BusinessEngine.ts`, `WorkEventFactory.ts`, `NfcScanApplicationService.ts`, `CallerContext.ts`, `OfflineQueue`-related files, `SynchronizationService.ts`, any error-classification file, FB-001, TS-001, TTAP-001, any ADR, Product Vision, Product Principles, Domain Model, Role Model, EP-008, EP-009, FB-002, or TS-002.

IMPLEMENTATION SCOPE (do exactly this, nothing more):

1. Create `packages/core/src/application/OrganizationAdministrationService.ts`:
   - A `CreateCustomerResult` type: `{ readonly status: 'accepted'; readonly customer: Customer; readonly event: CustomerCreated } | RejectedMembershipAuthorizationResult` (import `RejectedMembershipAuthorizationResult` from `../business/MembershipAuthorizationResult`).
   - An `OrganizationAdministrationService` class with a constructor taking `MembershipAuthorizationValidator`, `CustomerRepository`, and an injectable `newCustomerId: () => CustomerId = () => CustomerId(generateId())` (mirroring `OrganizationManagementService`'s/`MembershipService`'s exact constructor-parameter-default pattern).
   - A `createCustomer(membership: Membership | null, organizationId: OrganizationId): CreateCustomerResult` method:
     - Call `this.membershipAuthorizationValidator.authorize(membership, organizationId)` first.
     - If the result's `status` is `'rejected'`, return that result unchanged. Do not call `CustomerRepository.save`. Do not construct a `Customer`. Do not produce `CustomerCreated`.
     - If the result's `status` is `'accepted'`, construct a `Customer` with a new `CustomerId` (via `newCustomerId()`), `organizationId` taken from the *requesting Membership's own* `organizationId` (i.e. `result.membership.organizationId`, per TS-002 Decision 3 — not the `organizationId` parameter blindly, though in the accepted case they are equal by construction of `authorize`'s own cross-Organization check), and `active: true`. Call `this.customerRepository.save(customer)`. Return `{ status: 'accepted', customer, event: customerCreated(customer) }`.

2. Register `OrganizationAdministrationService` in `packages/core/src/index.ts`, within the existing `application/` grouped export section, directly beside `OrganizationManagementService`/`MembershipService`'s own export lines.

3. Create `packages/core/tests/application/OrganizationAdministrationService.test.ts`:
   - Accepted-path test: an Administrator Membership whose `organizationId` matches the target Organization results in `CustomerRepository.save` being called once with a `Customer` whose `organizationId` matches, and the returned result's `event.customer` matching the saved `Customer`.
   - Missing-Membership test: `createCustomer(null, organizationId)` returns `{ status: 'rejected', reason: 'membership_not_found' }`; assert `CustomerRepository.save` was never called (use an in-memory `CustomerRepository`/spy and assert on its post-call state, e.g. `findById` returns `null` for any id, or a call-count spy).
   - Employee-Membership test: a Membership with `role: 'employee'` returns `{ status: 'rejected', reason: 'membership_lacks_administrator_role' }`; assert no write occurred.
   - Cross-Organization test: an Administrator Membership whose `organizationId` differs from the target `organizationId` returns `{ status: 'rejected', reason: 'cross_organization_access' }`; assert no write occurred.

EXPECTED DECISION BEHAVIOR (must match exactly):
- Accepted: Administrator Membership, matching target Organization → construct `Customer`, save, produce `CustomerCreated`.
- Rejected, `membership_not_found`: `membership` is `null`.
- Rejected, `membership_lacks_administrator_role`: `membership.role !== 'administrator'`.
- Rejected, `cross_organization_access`: `membership.organizationId !== organizationId`.
- For every rejection: return the rejection result/reason; do not save a `Customer`; do not produce `CustomerCreated`.

ARCHITECTURE BOUNDARIES (do not violate):
- Do not implement `registerNfcTag(...)` or `assignNfcTag(...)` — DT-024/DT-025's responsibility, not this task's.
- Do not modify `MembershipAuthorizationValidator` in any way — not even to add an overload or a new parameter.
- Do not add any Customer field validation beyond `Customer`'s existing shape (`id`, `organizationId`, `active`) — no name field, no uniqueness check.
- Do not wire `OrganizationAdministrationService` into any UI, CLI, or composition root — it has no caller after this sprint.
- Do not touch `AssignmentResolver.ts`, `AssignmentValidator.ts`, or their test files in any way. Confirm this with `git diff` before finishing.
- Do not touch `apps/mobile`, `packages/core/src/cli/runScan.ts`, or any CLI entry point.
- Do not implement DT-024, DT-025, DT-026, or any other Development Task — this sprint is DT-023 only.

TESTING REQUIREMENTS:
- The new test file must cover: the accepted path, and each of the three rejection paths, with an explicit no-write assertion for every rejection case (not merely inferred from the returned result shape).
- Run `MembershipAuthorizationValidator.test.ts`, `InMemoryCustomerRepository.test.ts`, and `AssignmentValidator.test.ts` and confirm all pass with **zero modification** — do not touch any of these three files.
- Run `npm run typecheck --workspace=@taptime/core` and `npm run test --workspace=@taptime/core`; both must pass, with all 197 pre-existing tests remaining green, before you consider the task done.
- Confirm via `git diff --stat` that only the new `OrganizationAdministrationService.ts`, its new test file, and `packages/core/src/index.ts` were changed — `MembershipAuthorizationValidator.ts`, `MembershipAuthorizationResult.ts`, `Membership.ts`, `MembershipRole.ts`, `Customer.ts`, `CustomerCreated.ts`, `CustomerRepository.ts`, `InMemoryCustomerRepository.ts`, `AssignmentResolver.ts`, and `AssignmentValidator.ts` must show zero diff.

EXPECTED DELIVERABLES:
- Two new files (`OrganizationAdministrationService.ts`, `OrganizationAdministrationService.test.ts`) and the extended `packages/core/src/index.ts`, committed with a clear commit message referencing DT-023 and Development Sprint 016.
- A short implementation summary (changed files, test results, the exact `CreateCustomerResult` shape used and why) suitable for Review Agent evaluation. Do NOT update `EP-007_Development_Tasks.md`'s DT-023 "Implementation Notes" section yourself — that update happens at governance closure, a separate, later task.

STOP CONDITION:
Stop after completing the Implementation Scope and tests above. Do not begin DT-024 or any other Development Task. Do not create Development Sprint 017. Do not modify FB-002, TS-002, or `EP-007_Development_Tasks.md`. Wait for review.
```

---

## 18. Role Handover

Implemented scope in this task: Development Sprint 016 planning only — this document and the embedded Development Agent Prompt, scoped exclusively to DT-023. No source code was written or modified. No architecture, ADR, TTAP-001, FB-001, TS-001, FB-002, TS-002, Product Vision, Product Principles, Domain Model, Role Model, EP-008, or EP-009 content was changed.

Changed artifacts: `ADO/02_Development/Development_Sprint_016_Plan.md` (new, this file). `ADO/00_Core/Decision_Log.md` was deliberately **not** updated — see the disclosed judgment call below. `ADO/00_Core/Project_Status.md` was updated with a small, targeted change — see below.

**Disclosed judgment call (Decision_Log.md):** the assigning task instructed updating `Decision_Log.md` "only if the repository's current sprint-planning pattern requires a DEV-SPRINT-016 Planned row." This repeats the same evaluation performed for every Sprint Plan since Sprint 003: `Decision_Log.md` currently shows `DEV-SPRINT-012` through `DEV-SPRINT-015` each received their first row only at Governance Closure, not at planning time (confirmed by direct grep of the Decision Log for each `DEV-SPRINT-01[2-5]` entry, each already carrying "Completed" status with no prior "Planned" row visible anywhere in the file's history this session has produced). Per "repository evidence decides," `Decision_Log.md` is therefore not updated by this task; a `DEV-SPRINT-016` row will be added at Sprint 016's governance closure, consistent with every prior sprint since Sprint 003.

**Disclosed judgment call (Project_Status.md):** a small, targeted update was made — the Status line, one Current State bullet reference, the Current Epics bullet, and Immediate Next Steps item 3 — to reflect that Development Sprint 016 (DT-023) is now Planned, mirroring exactly the same small-update pattern Development Sprints 012, 013, 014, and 015's own plans applied when each first became Planned. No FB-002/TS-002 status language was touched (both remain correctly described as "reviewed," not "approved") and no other section was altered.

Related ADO artifacts consulted: `Development_Sprint_015_Closure.md`, `Development_Sprint_015_Plan.md`, `Development_Sprint_014_Closure.md`, `Development_Sprint_013_Closure.md`, `Development_Sprint_012_Closure.md`, `FB-002-organization-management-foundation.md`, `TS-002-organization-management-foundation.md`, `EP-007_Development_Tasks.md` (DT-023/DT-024 sections), `Decision_Log.md`, `Project_Status.md`, and direct inspection of current repository code: `packages/core/src/application/OrganizationManagementService.ts`, `MembershipService.ts`, `NfcScanApplicationService.ts`, `packages/core/src/business/MembershipAuthorizationValidator.ts`, `MembershipAuthorizationResult.ts`, `AssignmentValidationResult.ts`, `packages/core/src/domain/Membership.ts`, `MembershipRole.ts`, `Customer.ts`, `packages/core/src/domain/events/CustomerCreated.ts`, `packages/core/src/ports/CustomerRepository.ts`, `packages/core/src/infrastructure/repositories/InMemoryCustomerRepository.ts`, `packages/core/src/index.ts`, and direct search confirming `OrganizationAdministrationService` does not exist anywhere in the repository today.

Tests performed: none (planning-only task; no code changed). Current repository test/typecheck state (197 `packages/core` tests passing, typecheck clean, plus 10 `apps/mobile` tests, as verified and recorded at Development Sprint 015's governance closure) is cited here, not re-run since no code changed.

Known deviations: none from the assigned task scope.

Unresolved questions / open findings carried forward, unaffected by this task: the Membership-granting bootstrap question; FB-002's remaining Open Questions (including tag reassignment/history semantics and tag payload collision semantics, relevant to the still-unplanned DT-025); DT-016 physical-device validation; iOS NFC support; Development Sprint 002/004 governance backlog; Finding F-01; the backend/cloud persistence technology decision; the future Identity-layer Feature Blueprint; FB-002's/TS-002's own "Draft" header status fields; `CustomerRepository.save`/`NfcTagRepository.register`/`NfcAssignmentRepository.save` all still have no caller today, and `createCustomer(...)` will be the first exception once implemented — but is not implemented by this planning task.

Evidence produced: this plan document and the embedded Development Agent Prompt and Role Handover.

Next responsible role: Technical Lead / Human Architect review and approval of this Sprint 016 Plan. Per the assigned stop condition, implementation does not begin until approval is given, and no further Development Task beyond DT-023 is started within this sprint even after approval.

## 19. Stop Condition

Per task instruction: stop after producing this Development Sprint 016 Plan and the minimum required cross-reference update (Project_Status.md only, per the disclosed judgment call above). No code was implemented or modified. Sprint 016 execution has not begun. DT-024 has not been started. Development Sprint 017 was not created. Awaiting Technical Lead / Human Architect review.
