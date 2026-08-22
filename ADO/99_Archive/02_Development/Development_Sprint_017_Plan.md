# Development Sprint 017 Plan – Organization Administration: NFC Tag Registration (DT-024)

Status: Planned
Role: Research / Implementation Support acting on behalf of Technical Lead (per AGR-001)
Epic: EP-007 – Product Architecture Foundation (implementation), governed in priority by EP-009 – Product Readiness Framework
Owner: Technical Lead
Approval Authority: Human Architect
Branch: `main`
Created Date: 2026-07-09
Related Development Tasks: DT-024 – Organization Administration: NFC Tag Registration (only)
Related Feature Blueprint / Technical Specification: FB-002 – Organization Management Foundation; TS-002 – Organization Management Foundation Technical Specification
Related Artifacts: `Development_Sprint_016_Closure.md`, `Development_Sprint_016_Plan.md`, `Development_Sprint_015_Closure.md`, `Development_Sprint_014_Closure.md`, `Development_Sprint_013_Closure.md`, `Development_Sprint_012_Closure.md`, `EP-007_Development_Tasks.md`, `Decision_Log.md`, `Project_Status.md`, EP-008 Chapters 00–03

---

## 1. Executive Summary

Development Sprint 016 completed DT-023, creating `OrganizationAdministrationService` for the first time with its first method, `createCustomer(...)`. Development Sprint 017 continues the TS-002 implementation sequence with the next unblocked unit: **DT-024 — Organization Administration: NFC Tag Registration — and DT-024 only**. No other Development Task (DT-025, DT-026) is part of this sprint.

DT-024 extends the existing `OrganizationAdministrationService` — created by DT-023, not created again here — with a second method, `registerNfcTag(...)`, following exactly the same orchestration shape `createCustomer(...)` already established: call `MembershipAuthorizationValidator.authorize(...)` first; on rejection, return the rejection reason and perform no write; on acceptance, construct an `NfcTag` (with `organizationId` taken from the requesting Membership), call `NfcTagRepository.register`, and produce `NfcTagRegistered`. It owns no business rule of its own — the authorization decision belongs to `MembershipAuthorizationValidator`, persistence belongs to `NfcTagRepository`, and event representation belongs to `NfcTagRegistered` — exactly matching `createCustomer(...)`'s own "orchestrates but does not interpret" boundary (EP-008 Ch03 §2.3/5.4), now applied a second time inside the same service.

After this sprint, an Administrator Membership can, for the first time, register an NFC Tag through a real Application Service call, in addition to already being able to register a Customer — though still only from a test, since no UI, CLI, or mobile entry point calls `OrganizationAdministrationService` yet. `assignNfcTag(...)` (DT-025) remains entirely unbuilt; it will later extend this same class with a third method, not create a second instance of it.

## 2. Repository Evidence

- `Development_Sprint_016_Closure.md`, Section 15 (Next Sprint Recommendation): "the next safe implementation step is DT-024 – Organization Administration: NFC Tag Registration... its Dependencies (`MembershipAuthorizationValidator`, DT-019; `NfcTagRepository.register`, DT-021) are both already satisfied, and DT-023 having created the service class removes the last blocker... DT-024 should be planned alone, not bundled with DT-025... a materially more complex method than either of the first two `OrganizationAdministrationService` methods."
- `EP-007_Development_Tasks.md`, DT-024 section (as approved): Objective — "Extend `OrganizationAdministrationService` — **created by DT-023, not created again here** — with a second method, `registerNfcTag(...)`, orchestrating `MembershipAuthorizationValidator` and the DT-021 write path to let an Administrator Membership register an NFC Tag within their own Organization." Dependencies: "DT-023 (`OrganizationAdministrationService` must already exist as a class before this task can add a method to it), DT-019 (`MembershipAuthorizationValidator`), DT-021 (`NfcTagRepository` write path)" — all three confirmed Completed (`DEV-SPRINT-014`, `DEV-SPRINT-015`, `DEV-SPRINT-016` in `Decision_Log.md`).
- `TS-002-organization-management-foundation.md`, Application Services section: "**OrganizationAdministrationService** (Capability 4 / FB-002 Decisions 3–5). Three methods, one per FB-002 Decision... Each method: (1) calls `MembershipAuthorizationValidator`... with the requesting actor's Membership and the target Organization; (2) on acceptance, constructs the domain object and calls the relevant extended repository's save method; (3) produces the corresponding Event... or returns the rejection." Sequence Diagram 4 (NFC Tag Registration): "Administration request (actor's Membership, Organization, tag payload) -> `OrganizationAdministrationService.registerNfcTag` -> `MembershipAuthorizationValidator` -> [accepted] constructs NfcTag domain object -> `NfcTagRepository.save` -> `NfcTagRegistered`." This sequence diagram is direct repository evidence confirming `registerNfcTag(...)`'s rejection branch reuses `MembershipAuthorizationValidator`'s own rejection reasons, exactly mirroring DT-023's own already-implemented pattern — see Section 8 below for how this resolves the assigning task's own "prefer reusing `MembershipAuthorizationResult`... do not invent unrelated result categories" instruction. Note: TS-002's own prose names the write method `NfcTagRepository.save`, but DT-021's actual implementation (Development Sprint 015) named it `register` — direct code inspection of `packages/core/src/ports/NfcTagRepository.ts` confirms the real method name is `register(nfcTag: NfcTag): void`; this plan uses the repository's actual method name throughout, per "Reality Has Priority Over Architecture" (EP-008 Ch01 §5.4-adjacent principle already applied at DT-021's own closure).
- `FB-002-organization-management-foundation.md`, Decision 4 (Register NFC Tag): "Trigger: an Administrator Membership requests registering a new NFC Tag within their Organization. Preconditions: same as Decision 3. Decision: register the NFC Tag, owned by that Organization; otherwise reject. Result: `NfcTagRegistered`, or `AdministrativeActionRejected`." Business Rule: same as Decision 3's — "Only a Membership with the Administrator Role may create or assign Organization-owned pilot data."
- Direct code inspection confirms `OrganizationAdministrationService` (`packages/core/src/application/OrganizationAdministrationService.ts`) currently has exactly one method, `createCustomer(...)`, with a constructor taking `MembershipAuthorizationValidator`, `CustomerRepository`, and an injectable `newCustomerId`. `CreateCustomerResult` is `{ status: 'accepted', customer, event } | RejectedMembershipAuthorizationResult`, co-located in the same file.
- Direct code inspection confirms `NfcTagRepository.register(nfcTag: NfcTag): void` (`packages/core/src/ports/NfcTagRepository.ts`) and `InMemoryNfcTagRepository`'s implementation, both unchanged since Development Sprint 015; `NfcTag` is `{ id: NfcTagId, organizationId: OrganizationId, payload: NfcPayload }` (`packages/core/src/domain/NfcTag.ts`); `NfcPayload` is a branded string type with a `createNfcPayload(rawValue)` constructor that throws on an empty string (`packages/core/src/domain/NfcPayload.ts`) — i.e. `NfcPayload` values are already normalized/validated by construction before they ever reach `registerNfcTag(...)`, confirming the assigning task's "accept an already-normalized `NfcPayload`" instruction matches existing repository reality exactly, with no new normalization logic required. `NfcTagRegistered` is `{ type: 'NfcTagRegistered', nfcTag: NfcTag }` plus an `nfcTagRegistered(nfcTag)` constructor function (`packages/core/src/domain/events/NfcTagRegistered.ts`).
- Direct code inspection of `packages/core/tests/application/OrganizationAdministrationService.test.ts` confirms its current structure: six tests under a single `describe('OrganizationAdministrationService.createCustomer (DT-023)', ...)` block, importing `InMemoryCustomerRepository`, `MembershipAuthorizationValidator`, and `OrganizationAdministrationService` directly. This is the file DT-024 extends in place, per the assigning task's own instruction and per repository convention (one Application Service, one test file, extended as the service grows — mirroring how `AssignmentValidator.test.ts` was extended in place across DT-003 and later sprints, never split).
- Direct code inspection confirms `NfcTagId` exists in `packages/core/src/domain/ids.ts` as `Brand<string, 'NfcTagId'>` with a `brandedNonEmptyString<'NfcTagId'>('NfcTagId')` constant — the same branded-id idiom `CustomerId` already uses, confirming `newNfcTagId: () => NfcTagId = () => NfcTagId(generateId())` is a direct, structurally identical sibling to `createCustomer(...)`'s own `newCustomerId`.

## 3. Why DT-024 Is Selected

The Primary Planning Question is how DT-024 should extend `OrganizationAdministrationService` with NFC Tag registration while preserving the existing architecture and avoiding premature DT-025 assignment work. Repository evidence answers directly why DT-024, specifically, is next: `EP-007_Development_Tasks.md` names DT-024's Dependencies as DT-023, DT-019, and DT-021, and all three are now Completed (`DEV-SPRINT-016`, `DEV-SPRINT-014`, `DEV-SPRINT-015`) — DT-024 is the only remaining Organization Management Development Task whose full dependency set is satisfied and whose implementation has not yet begun. DT-025 depends on DT-022 (also complete) but additionally depends on DT-024 itself having added `registerNfcTag(...)` first (an NFC Tag must be registered before it can be assigned) and on `createCustomer(...)` having already produced a Customer/`AssignmentTarget` to assign a tag to. DT-024 is therefore the only task in the DT-024–DT-025 pair that can be started today.

## 4. Why DT-025 Is Not Included

DT-025 (NFC Tag Assignment) extends the exact same `OrganizationAdministrationService` class this sprint extends further — `EP-007_Development_Tasks.md`'s own DT-025 wording is explicit: "Extend `OrganizationAdministrationService` — **created by DT-023, not created again here** — with a third method." Bundling DT-024 with DT-025 would repeat exactly the risk `Development_Sprint_016_Closure.md` Section 15 already reasoned against: DT-025 requires an additional, materially more complex cross-check beyond what `createCustomer(...)`/`registerNfcTag(...)` need — verifying that the target `NfcTag` and `AssignmentTarget` already belong to the same Organization as the requesting Membership (FB-002 Decision 5, TS-002 Sequence Diagram 5), mirroring `AssignmentValidator`'s existing cross-check pattern. This is a genuinely different shape of method, not a repetition of `registerNfcTag(...)`'s shape, and verifying it correctly would become entangled with verifying `registerNfcTag(...)`'s own, simpler correctness if both were built and reviewed in the same sprint. The three-method service continues to be built one method at a time, each independently reviewable: DT-024's `registerNfcTag(...)` can be fully verified — typechecked, tested, and reasoned about — without any knowledge of what `assignNfcTag(...)` will eventually look like, exactly as DT-023's `createCustomer(...)` was verified without any knowledge of `registerNfcTag(...)`. DT-025 additionally depends on DT-024 having been implemented first (an `NfcTag` must exist, registered, before it can be assigned) — a second, independent reason DT-025 cannot be planned in the same sprint as DT-024, since DT-024's own output does not yet exist at this planning task's time of writing.

## 5. Business Objective

Give an Administrator Membership a real, callable way to register an NFC Tag within their own Organization — the second Application Service method in Organization Management to combine an authorization decision with a persistence write, and the first to extend an already-existing Application Service rather than create one. This is a genuine step toward Organization Management usability (Section 14, below), but it does not by itself make TapTim.e pilot-ready: no UI, CLI, or mobile entry point calls `OrganizationAdministrationService` after this sprint, so an NFC Tag can still be registered only from a test, and no tag can yet be assigned to a Customer (DT-025).

## 6. Technical Objective

Extend `OrganizationAdministrationService` with exactly one new method, `registerNfcTag(...)`, that: (1) calls `MembershipAuthorizationValidator.authorize(membership, organizationId)` first; (2) on rejection, returns the rejection reason and performs no write; (3) on acceptance, constructs an `NfcTag` with `organizationId` taken from the requesting Membership's own `organizationId` and `payload` taken from the already-normalized `NfcPayload` supplied to the method, calls `NfcTagRepository.register`, and produces `NfcTagRegistered`. Zero change to `MembershipAuthorizationValidator`, `MembershipAuthorizationResult`, `Membership`, `NfcTag`, `NfcPayload`, `NfcTagRepository`, `InMemoryNfcTagRepository`, `NfcTagRegistered`, or `createCustomer(...)`'s own existing behavior — every one of these is consumed exactly as it exists today.

## 7. Scope

Per the assigning task, Development Sprint 017 includes only DT-024. The sprint plans implementation of:

- `OrganizationAdministrationService.registerNfcTag(...)`, added to the existing class (no new class, no new file).
- `MembershipAuthorizationValidator` orchestration (called first, unconditionally, before any write) — identical pattern to `createCustomer(...)`.
- `NfcTag` construction (on acceptance only), with `organizationId` taken from the requesting Membership, `payload` taken from an already-normalized `NfcPayload` argument.
- `NfcTagRepository.register` usage (on acceptance only).
- `NfcTagRegistered` event production (on acceptance only).
- Explicit rejection handling: the rejection reason is returned; no write occurs; no event is produced.
- Unit tests for the accepted path and every rejection path, extending the existing `OrganizationAdministrationService.test.ts` in place, including explicit proof that no write occurs on rejection and that `createCustomer(...)`'s own existing tests continue to pass unmodified.
- Barrel-export registration only if repository convention requires it — direct inspection (Section 9, Components to Implement) confirms `OrganizationAdministrationService` is already exported from `packages/core/src/index.ts`, so no new export line is required for this sprint.

## 8. Out of Scope

Explicitly excluded from this sprint, per the assigning task:

- DT-025 (NFC Tag Assignment), DT-026 (Scan Pipeline Integration Verification).
- `assignNfcTag(...)` — no method beyond `registerNfcTag(...)` is added to `OrganizationAdministrationService`.
- Any Customer registration changes beyond preserving `createCustomer(...)`'s existing, already-implemented behavior exactly as it is today.
- Any UI, any mobile work, any CLI command.
- Any Identity work, any `AuthenticationGateway` change, any `FakeAuthenticationGateway` change, any real authentication provider.
- Any change to `MembershipService`, `OrganizationManagementService`, or `MembershipAuthorizationValidator`.
- Any change to `NfcTagRepository` beyond using its already-existing `register` method (added by DT-021); no change to `CustomerRepository` or `NfcAssignmentRepository`.
- Any change to `AssignmentResolver`, `AssignmentValidator`, `BusinessEngine`, `WorkEventFactory`, `NfcScanApplicationService`, `CallerContext`, `OfflineQueue`, `SynchronizationService`, or error handling.
- Any backend/cloud persistence technology, any database schema, any API design, any durable/file-backed adapter implementation.
- Any physical NFC validation, any physical tag writing/provisioning workflow, any NFC tag assignment, any scan-pipeline integration verification.
- Any Membership bootstrap decision (TS-002's own surfaced Open Question, still unresolved).
- Any tag reassignment/history semantics, any tag payload collision semantics (FB-002 Open Questions 3 and 5, explicitly not resolved by DT-024 per its own Out of Scope: "duplicate-payload handling across Organizations... not resolved here").
- Any same-Organization assignment semantics for DT-025 — that cross-check belongs entirely to `assignNfcTag(...)`, not to `registerNfcTag(...)`.

**Result-shape scope note:** per the assigning task's own instruction ("prefer reusing `MembershipAuthorizationResult` unless TS-002/repository evidence requires a wrapper result; do not invent unrelated result categories"), `registerNfcTag(...)`'s return type is designed in Section 10 below following DT-023's own already-implemented `CreateCustomerResult` precedent exactly: a minimal wrapper that reuses `MembershipAuthorizationResult`'s existing `RejectedMembershipAuthorizationResult` variant verbatim for every rejection path, adding only a new accepted variant carrying the registered `NfcTag` and its `NfcTagRegistered` event. FB-002 Decision 4's "Result: `NfcTagRegistered`, or `AdministrativeActionRejected`" phrasing is the same product-level two-outcome description Decision 3 used for `createCustomer(...)`, already correctly resolved at DT-023's implementation by reusing the validator's own rejection shape rather than inventing `AdministrativeActionRejected` as a real type — DT-024 follows that same, now-precedented resolution.

## 9. Existing Components Reused (Patterns, Not Code)

| Existing Precedent | File | Reused As |
|---|---|---|
| `OrganizationAdministrationService.createCustomer(...)`'s exact orchestration shape: authorize first, branch, write only on acceptance | `packages/core/src/application/OrganizationAdministrationService.ts` (DT-023, already implemented) | Exact structural template for `registerNfcTag(...)` — the nearer, sibling-method precedent, now closer than `NfcScanApplicationService`'s original orchestrate-then-branch shape DT-023 itself was derived from. |
| `CreateCustomerResult`'s discriminated-union design: accepted variant with extra fields, `RejectedMembershipAuthorizationResult` reused verbatim | `packages/core/src/application/OrganizationAdministrationService.ts` (`CreateCustomerResult`, DT-023) | Exact structural template for a new `RegisterNfcTagResult` type: an accepted variant carrying `nfcTag`/`event`, and the same `RejectedMembershipAuthorizationResult` reused, not re-invented. |
| Injectable deterministic id generation, one branded-id generator per method's own domain object | `OrganizationAdministrationService`'s existing `newCustomerId: () => CustomerId = () => CustomerId(generateId())` constructor parameter | Exact structural template for a new `newNfcTagId: () => NfcTagId = () => NfcTagId(generateId())` constructor parameter, added alongside the existing one, not replacing it. |
| "Orchestrates but does not interpret" boundary | `OrganizationAdministrationService.createCustomer(...)`, `NfcScanApplicationService`, `OrganizationManagementService`, `MembershipService` (EP-008 Ch03 §2.3/5.4) | Applied identically a second time within the same service: `registerNfcTag(...)` owns no business rule; the authorization decision belongs to `MembershipAuthorizationValidator`, persistence to `NfcTagRepository`, event shape to `NfcTagRegistered`. |
| Extending a single Application Service test file in place as the service grows, rather than splitting into multiple test files | `packages/core/tests/application/OrganizationAdministrationService.test.ts` (currently DT-023's 6 tests only) | Same file extended with a second `describe` block (or additional `it` blocks) for `registerNfcTag`, mirroring how `AssignmentValidator.test.ts` has been extended in place across multiple sprints without ever being split. |
| Explicit no-write-on-rejection proof, both per-rejection and consolidated | DT-023's own test 6 (`'never calls CustomerRepository.save for any rejection path (explicit spy proof)'`) | Exact structural template for an equivalent consolidated `NfcTagRepository.register` no-write proof across all three `registerNfcTag(...)` rejection paths. |

No component from `AssignmentResolver`, `AssignmentValidator`, `BusinessEngine`, `WorkEventFactory`, the FB-001 scan pipeline, `OfflineQueue`, `SynchronizationService`, `CallerContext`, `CustomerRepository`, or `NfcAssignmentRepository` is called, imported, or otherwise touched by DT-024.

## 10. Components to Implement

| Component | Type | Location |
|---|---|---|
| `OrganizationAdministrationService.registerNfcTag(...)` | Application Service method (extends existing class, no new file) | `packages/core/src/application/OrganizationAdministrationService.ts` |
| `RegisterNfcTagResult` | Result type (new, minimal wrapper — see Section 8) | Co-located in `packages/core/src/application/OrganizationAdministrationService.ts`, directly beside `CreateCustomerResult`, following the same one-result-type-per-method-in-the-same-file convention DT-023 already established. |

`RegisterNfcTagResult` is designed as:

```typescript
export type RegisterNfcTagResult =
  | { readonly status: 'accepted'; readonly nfcTag: NfcTag; readonly event: NfcTagRegistered }
  | RejectedMembershipAuthorizationResult;
```

This reuses `RejectedMembershipAuthorizationResult` verbatim, exactly matching TS-002 Sequence Diagram 4's own rejection-reason list and DT-023's own already-implemented `CreateCustomerResult` design, and adds only the minimum new accepted-branch shape the caller needs (the registered `NfcTag` and its `NfcTagRegistered` event) — no new rejection category is invented, and no existing type is modified.

Repository reality confirms no new file and no new barrel-export line are required: `OrganizationAdministrationService` is already exported from `packages/core/src/index.ts` (registered at DT-023's implementation), and adding a method to an already-exported class requires no export-statement change. The existing test file, `packages/core/tests/application/OrganizationAdministrationService.test.ts`, is extended in place — no second test file is created, per the assigning task's own explicit instruction and per repository convention (Section 9).

## 11. Development Task Mapping

**DT-024 – Organization Administration: NFC Tag Registration**, used exactly as approved in `EP-007_Development_Tasks.md`:

- **Objective:** Extend `OrganizationAdministrationService` — created by DT-023, not created again here — with a second method, `registerNfcTag(...)`, orchestrating `MembershipAuthorizationValidator` and the DT-021 write path to let an Administrator Membership register an NFC Tag within their own Organization.
- **Acceptance Criteria:** `registerNfcTag(...)` calls `MembershipAuthorizationValidator` first; on rejection, returns the rejection reason and performs no write; on acceptance, constructs an `NfcTag` (`organizationId` taken from the requesting Membership's Organization) and calls `NfcTagRepository`'s existing write method, producing `NfcTagRegistered`; same rejection-path coverage as DT-023, applied to tag registration; unit tests cover the accepted path and every rejection path, verifying no write occurs on rejection.
- **Implementation Boundary:** `MembershipAuthorizationValidator` (consumed, not modified); `NfcTagRepository` (consumed, not modified beyond DT-021, already complete); any FB-001 pipeline component — none touched.
- **Testing Expectations:** unit tests, same structure as DT-023.
- **Out of Scope (per DT-024 itself):** any UI or CLI entry point; any physical tag-provisioning workflow (same exclusion as DT-021); duplicate-payload handling across Organizations (FB-002 Open Question 5, not resolved here).
- **Dependencies:** DT-023 (`OrganizationAdministrationService` must already exist), DT-019 (`MembershipAuthorizationValidator`), DT-021 (`NfcTagRepository` write path) — all three Completed.

No other Development Task is mapped to this sprint.

## 12. Testing Strategy

- `npm run typecheck --workspace=@taptime/core` — must pass with no errors.
- `npm run test --workspace=@taptime/core` — must pass; all 203 pre-existing tests (as of Development Sprint 016) must remain green, plus new tests extending `OrganizationAdministrationService.test.ts` covering:
  - **Accepted path:** an Administrator Membership whose `organizationId` matches the target Organization, given an already-normalized `NfcPayload`, results in an `NfcTag` being constructed, `NfcTagRepository.register` being called exactly once, and `NfcTagRegistered` being produced carrying that `NfcTag`.
  - **Missing Membership rejection:** `membership` passed as `null` results in `{ status: 'rejected', reason: 'membership_not_found' }`, with `NfcTagRepository.register` never called.
  - **Employee Membership rejection:** a Membership with `role: 'employee'` results in `{ status: 'rejected', reason: 'membership_lacks_administrator_role' }`, with `NfcTagRepository.register` never called.
  - **Cross-Organization rejection:** an Administrator Membership whose `organizationId` differs from the target Organization results in `{ status: 'rejected', reason: 'cross_organization_access' }`, with `NfcTagRepository.register` never called.
  - **No-write proof, explicit:** for every one of the three rejection cases above, a dedicated assertion (in-memory `NfcTagRepository`/spy confirming zero `register` calls) proves no write occurred — following DT-023's own precedent of both individual per-test assertions and one consolidated cross-rejection proof.
  - **Deterministic `NfcTagId` generation:** at least one test injects a fixed `newNfcTagId` generator and asserts the resulting `NfcTag.id` matches it exactly, mirroring DT-023's own `CustomerId` injection tests.
  - **`createCustomer(...)` non-regression, explicit:** DT-023's existing six tests are re-run and confirmed to require zero modification — no rewritten assertion, no changed fixture — directly demonstrating that adding `registerNfcTag(...)` did not alter `createCustomer(...)`'s own behavior.
- **Explicit non-regression requirements (per the assigning task):**
  - `OrganizationAdministrationService.test.ts`'s existing six `createCustomer(...)` tests must pass **without any modification** — confirmed by an empty `git diff` against those six tests specifically (the file itself will grow, but the six existing tests' content must not change).
  - `MembershipAuthorizationValidator.test.ts` must pass **without any modification** — confirmed by an empty `git diff` against the pre-Sprint-017 commit.
  - `packages/core/tests/infrastructure/InMemoryNfcTagRepository.test.ts` must pass **without any modification** — `NfcTagRepository`'s read (`findByPayload`) and write (`register`) behavior are both unchanged by this sprint.
  - `AssignmentResolver.test.ts` must pass **without any modification** — `AssignmentResolver` calls `NfcTagRepository.findByPayload`, which this sprint does not touch.
  - No FB-001 scan-pipeline test (`AssignmentValidator.test.ts`, `NfcScanApplicationService`-related tests, `BusinessEngine.test.ts`, `WorkEventFactory.test.ts`) requires any behavioral change.
- No `apps/mobile` tests are expected or required — DT-024 adds no `apps/mobile` code and no `apps/mobile` file is touched.
- No physical-device validation is relevant to DT-024.
- Explicit scope-isolation check: `git diff --stat` outside `OrganizationAdministrationService.ts` and its existing test file must be empty — no new file is expected for this sprint (Section 10). In particular, `MembershipAuthorizationValidator.ts`, `MembershipAuthorizationResult.ts`, `Membership.ts`, `NfcTag.ts`, `NfcPayload.ts`, `NfcTagRegistered.ts`, `NfcTagRepository.ts`, `InMemoryNfcTagRepository.ts`, `AssignmentResolver.ts`, and `AssignmentValidator.ts` must be confirmed byte-for-byte unchanged.

## 13. Risks

| Risk | Mitigation |
|---|---|
| Implementing `assignNfcTag(...)` alongside `registerNfcTag(...)` "since the method pattern is now established" | Out of Scope (Section 8) explicitly forbids this; DT-025 is a separate, later Development Task per Section 4's reasoning, and additionally depends on DT-024's own output (a registered NfcTag) existing first. |
| Inventing a new `AdministrativeActionRejected` result type instead of reusing `MembershipAuthorizationResult`'s rejection shape (repeating a question DT-023 already resolved) | Section 8/10 resolve this directly from repository evidence (TS-002 Sequence Diagram 4 and DT-023's own already-implemented `CreateCustomerResult` precedent): the rejection branch reuses `RejectedMembershipAuthorizationResult` verbatim; only a new accepted variant is added. |
| Accidentally modifying `createCustomer(...)`'s own implementation while adding `registerNfcTag(...)` nearby in the same file | Testing Strategy (Section 12) requires explicit non-regression confirmation that all six existing `createCustomer(...)` tests pass with zero modification; `git diff` on the six existing test bodies specifically (not just the file as a whole) is checked. |
| Modifying `MembershipAuthorizationValidator` to add an NfcTag-specific check (e.g. accepting an optional tag-registration flag) | Implementation Boundary (DT-024's own Acceptance Criteria) states the validator is not to be touched; `registerNfcTag(...)` calls `authorize(membership, organizationId)` exactly as `createCustomer(...)` already does, with no new parameter. |
| Resolving duplicate-payload handling across Organizations, or any tag-provisioning workflow, "since this is the natural place for it" | Out of Scope, per DT-024's own Out of Scope ("duplicate-payload handling across Organizations... not resolved here") and the assigning task's explicit exclusion; `NfcTagRepository.register` performs no uniqueness check of its own, confirmed by direct inspection (a single `.push(...)`). |
| Wiring `OrganizationAdministrationService.registerNfcTag(...)` into a UI, CLI, or composition root "to make it usable" | Out of Scope, per DT-024's own Out of Scope ("any UI or CLI entry point"); no caller is introduced for `registerNfcTag(...)` by this sprint. |
| Accidentally modifying `MembershipAuthorizationValidator.test.ts`, `InMemoryNfcTagRepository.test.ts`, or `AssignmentResolver.test.ts` while adding new test coverage nearby | Testing Strategy (Section 12) states this as an explicit, separately-verified requirement — all three files must show zero diff, checked directly via `git diff` before the sprint is considered complete. |

## 14. EP-009 Product Readiness Impact

Per the assigning task's explicit anti-overclaiming framing: DT-024 is foundational but product-facing. DT-024 creates the second real Organization Administration application flow. DT-024 enables future pilot setup by allowing authorized NFC Tag registration through an Application Service. DT-024 does not by itself make TapTim.e pilot-ready. DT-024 does not change Customer Readiness in a user-facing way because no UI, CLI, mobile setup, tag assignment, or scan integration exists yet.

- **Engineering Readiness:** Expected to **Improve (marginally)**. Repository evidence: this is the second Application Service method to orchestrate a Business-area validator together with a repository write, extending an already-proven pattern (DT-023) to a second domain object, backed by new dedicated tests proving both the accepted path and every rejection path plus non-regression of `createCustomer(...)`. The same kind of code-quality-level improvement DT-017–DT-023's own closures each recorded — not a readiness-category jump.
- **Product Readiness:** Expected to **Improve (marginally)**. Repository evidence: a second real, testable Administration capability now exists as an orchestrated flow — NFC Tag registration, alongside Customer registration — a genuine step toward Capability 4 (Administration) being fully usable, though still not reachable from outside a test, and still one method short of a complete registration-to-assignment flow (DT-025).
- **Customer Readiness:** Expected to remain **No Change**. DT-024 does not change Customer Readiness in a user-facing way — no UI, CLI, or mobile entry point calls `OrganizationAdministrationService`, so no real Administrator can register a real NFC Tag through any real path after this sprint.
- **Deployment Readiness:** Expected to remain **No Change**. No build, release-pipeline, or hosting-target work is touched.
- **Technical Operations Readiness:** Expected to remain **No Change**. No CI/CD, monitoring, or environment-separation work is touched.
- **Scaling Readiness:** Expected to remain **No Change**. `registerNfcTag(...)` orchestrates existing in-memory-only components; no new persistence or concurrency property is introduced.

This evaluation will be re-confirmed with actual, not merely expected, evidence at Sprint 017's governance closure, following the same discipline every prior sprint's closure applied.

## 15. Definition of Done

For the eventual implementation and closure of this sprint (not performed by this planning task itself — see Stop Condition):

- `OrganizationAdministrationService.registerNfcTag(...)` exists, implemented exactly as specified in Sections 7/10/11; `createCustomer(...)` is confirmed unchanged.
- `npm run typecheck --workspace=@taptime/core` and `npm run test --workspace=@taptime/core` both pass; all 203 pre-existing tests remain green.
- `OrganizationAdministrationService.test.ts`'s six existing `createCustomer(...)` tests, `MembershipAuthorizationValidator.test.ts`, `InMemoryNfcTagRepository.test.ts`, and `AssignmentResolver.test.ts` all pass with zero modification, confirmed by `git diff` showing no changes to any of them.
- `git diff` confirms zero changes to any file outside `OrganizationAdministrationService.ts` and its existing test file.
- `EP-007_Development_Tasks.md`'s DT-024 "Implementation Notes" placeholder is filled in with the actual implementation summary, at closure time (not part of this planning task).
- Review Agent verification and Human Architect approval are recorded before DT-024 is marked Completed (DTP-001: "Implementation alone never completes a Development Task").

## 16. Recommended Implementation Order

1. Inspect `OrganizationAdministrationService.createCustomer(...)`'s existing implementation and its existing six tests as the direct structural precedent this task extends.
2. Define `RegisterNfcTagResult` (Section 10), co-located beside `CreateCustomerResult`.
3. Add `newNfcTagId: () => NfcTagId = () => NfcTagId(generateId())` as a new constructor parameter, added alongside the existing `newCustomerId` parameter without altering its position, default, or behavior.
4. Implement `registerNfcTag(...)`'s accepted path: call `authorize(...)`, on acceptance construct `NfcTag`, call `NfcTagRepository.register`, return `{ status: 'accepted', nfcTag, event: nfcTagRegistered(nfcTag) }`.
5. Implement `registerNfcTag(...)`'s rejected-path return handling: on rejection, return the `RejectedMembershipAuthorizationResult` unchanged, performing no write.
6. Extend `OrganizationAdministrationService.test.ts` with a test for the accepted path.
7. Add tests for all three rejection paths (`membership_not_found`, `membership_lacks_administrator_role`, `cross_organization_access`).
8. Add explicit no-write-on-rejection assertions to each of the three rejection tests, plus one consolidated cross-rejection proof.
9. Add a deterministic-`NfcTagId`-generation test with an injected fixed generator.
10. Re-run the six pre-existing `createCustomer(...)` tests unmodified and confirm they still pass.
11. Confirm no barrel-export change is required (Section 10); if repository evidence at implementation time shows otherwise, add the minimum required export line only.
12. Run `npm run typecheck --workspace=@taptime/core` and `npm run test --workspace=@taptime/core`; explicitly confirm `MembershipAuthorizationValidator.test.ts`, `InMemoryNfcTagRepository.test.ts`, and `AssignmentResolver.test.ts` show zero diff and still pass; confirm `git diff --stat` touches only the expected files.

Repository evidence supports this order directly: it mirrors DT-023's own construct-then-orchestrate-then-test build order, now applied to a second method within the same class; validation is deliberately last, after both the new accepted/rejected paths and the pre-existing `createCustomer(...)` tests are confirmed intact, consistent with every prior sprint's own approach.

---

## 17. Development Agent Prompt

The following prompt is written to be given directly to Claude Code (Development Agent) to execute Development Sprint 017. It is self-contained and does not require this planning document to be re-explained.

```text
You are the Development Agent for TapTim.e, implementing Development Sprint 017 ("Organization Administration: NFC Tag Registration," DT-024 only) on branch `main`.

CONTEXT (verify before writing code):
- Read `ADO/02_Development/Development_Sprint_017_Plan.md` in full — it is the authoritative scope for this task.
- Read `ADO/01_Architecture/Feature_Blueprints/FB-002-organization-management-foundation.md` (Decision 4) and `ADO/01_Architecture/Technical_Specifications/TS-002-organization-management-foundation.md` (Application Services section, Sequence Diagram 4) — the product/technical basis for what you are building.
- Read `ADO/02_Development/EP-007_Development_Tasks.md`'s "## DT-024" section — your exact Objective, Acceptance Criteria, Implementation Boundary, Out of Scope and Dependencies.
- Read `packages/core/src/application/OrganizationAdministrationService.ts` in full — this is the existing file you will extend, not replace. Study `createCustomer(...)`'s exact shape: it is the direct structural template for `registerNfcTag(...)`.
- Read `packages/core/tests/application/OrganizationAdministrationService.test.ts` in full — this is the existing test file you will extend in place. Do not create a second test file.
- Read the components you will consume, all unmodified: `packages/core/src/business/MembershipAuthorizationValidator.ts`, `packages/core/src/business/MembershipAuthorizationResult.ts`, `packages/core/src/domain/Membership.ts`, `packages/core/src/domain/NfcTag.ts`, `packages/core/src/domain/NfcPayload.ts`, `packages/core/src/domain/events/NfcTagRegistered.ts`, `packages/core/src/ports/NfcTagRepository.ts`, `packages/core/src/infrastructure/repositories/InMemoryNfcTagRepository.ts`, `packages/core/src/domain/ids.ts` (for `NfcTagId`), `packages/core/src/domain/generateId.ts`.
- Do not modify `MembershipAuthorizationValidator.ts`, `MembershipAuthorizationResult.ts`, `Membership.ts`, `NfcTag.ts`, `NfcPayload.ts`, `NfcTagRegistered.ts`, `NfcTagRepository.ts`, `InMemoryNfcTagRepository.ts`, `MembershipService.ts`, `OrganizationManagementService.ts`, `AssignmentResolver.ts`, `AssignmentValidator.ts`, `AssignmentValidationResult.ts`, any of their test files, `CustomerRepository.ts`, `InMemoryCustomerRepository.ts`, `NfcAssignmentRepository.ts`, `InMemoryNfcAssignmentRepository.ts`, `BusinessEngine.ts`, `WorkEventFactory.ts`, `NfcScanApplicationService.ts`, `CallerContext.ts`, `OfflineQueue`-related files, `SynchronizationService.ts`, any error-classification file, FB-001, TS-001, TTAP-001, any ADR, Product Vision, Product Principles, Domain Model, Role Model, EP-008, EP-009, FB-002, or TS-002.
- Do not modify `createCustomer(...)`'s own implementation. Adding `registerNfcTag(...)` must not require changing a single line of the existing method.

IMPLEMENTATION SCOPE (do exactly this, nothing more):

1. In `packages/core/src/application/OrganizationAdministrationService.ts`:
   - Add a `RegisterNfcTagResult` type, co-located beside `CreateCustomerResult`: `{ readonly status: 'accepted'; readonly nfcTag: NfcTag; readonly event: NfcTagRegistered } | RejectedMembershipAuthorizationResult` (import `NfcTag`, `NfcTagRegistered`/`nfcTagRegistered`, `NfcTagId` alongside the existing imports; `RejectedMembershipAuthorizationResult` is already imported).
   - Add a new constructor parameter, `NfcTagRepository`, and a new injectable `newNfcTagId: () => NfcTagId = () => NfcTagId(generateId())`, added alongside (not replacing) the existing `CustomerRepository` and `newCustomerId` parameters.
   - Add a `registerNfcTag(membership: Membership | null, organizationId: OrganizationId, payload: NfcPayload): RegisterNfcTagResult` method:
     - Call `this.membershipAuthorizationValidator.authorize(membership, organizationId)` first.
     - If the result's `status` is `'rejected'`, return that result unchanged. Do not call `NfcTagRepository.register`. Do not construct an `NfcTag`. Do not produce `NfcTagRegistered`.
     - If the result's `status` is `'accepted'`, construct an `NfcTag` with a new `NfcTagId` (via `newNfcTagId()`), `organizationId` taken from `result.membership.organizationId` (mirroring `createCustomer(...)`'s own precedent of sourcing from the accepted Membership, not the raw parameter), and `payload` taken from the method's `payload` argument unchanged (it is already a normalized `NfcPayload`, no further validation needed). Call `this.nfcTagRepository.register(nfcTag)`. Return `{ status: 'accepted', nfcTag, event: nfcTagRegistered(nfcTag) }`.
   - Do not change `createCustomer(...)`'s own body, signature, or the order/defaults of its existing constructor parameters.

2. Confirm whether `packages/core/src/index.ts` requires any change. `OrganizationAdministrationService` is already exported from a prior sprint; adding a method to an already-exported class typically requires no new export line. Verify this directly rather than assuming, and add the minimum required line only if repository reality at implementation time shows otherwise.

3. Extend `packages/core/tests/application/OrganizationAdministrationService.test.ts` (do not create a second file):
   - Accepted-path test: an Administrator Membership whose `organizationId` matches the target Organization, given a normalized `NfcPayload`, results in `NfcTagRepository.register` being called once with an `NfcTag` whose `organizationId` matches, and the returned result's `event.nfcTag` matching the registered `NfcTag`.
   - Missing-Membership test: `registerNfcTag(null, organizationId, payload)` returns `{ status: 'rejected', reason: 'membership_not_found' }`; assert `NfcTagRepository.register` was never called.
   - Employee-Membership test: a Membership with `role: 'employee'` returns `{ status: 'rejected', reason: 'membership_lacks_administrator_role' }`; assert no write occurred.
   - Cross-Organization test: an Administrator Membership whose `organizationId` differs from the target `organizationId` returns `{ status: 'rejected', reason: 'cross_organization_access' }`; assert no write occurred.
   - A consolidated test proving `NfcTagRepository.register` is never called across all three rejection scenarios in one place (mirroring DT-023's own test 6).
   - A deterministic-`NfcTagId`-generation test: inject a fixed `newNfcTagId` generator and assert the resulting `NfcTag.id` matches it exactly.
   - Do not modify any of the six pre-existing `createCustomer(...)` tests. Re-run them and confirm they still pass unchanged.

EXPECTED DECISION BEHAVIOR (must match exactly):
- Accepted: Administrator Membership, matching target Organization, normalized `NfcPayload` provided → construct `NfcTag`, register, produce `NfcTagRegistered`.
- Rejected, `membership_not_found`: `membership` is `null`.
- Rejected, `membership_lacks_administrator_role`: `membership.role !== 'administrator'`.
- Rejected, `cross_organization_access`: `membership.organizationId !== organizationId`.
- For every rejection: return the rejection result/reason; do not register an `NfcTag`; do not produce `NfcTagRegistered`.

ARCHITECTURE BOUNDARIES (do not violate):
- Do not implement `assignNfcTag(...)` — DT-025's responsibility, not this task's.
- Do not modify `MembershipAuthorizationValidator` in any way.
- Do not add any NFC payload normalization, uniqueness check, or duplicate-payload handling beyond what `createNfcPayload`/`NfcTagRepository.register` already do — `NfcPayload` arrives already normalized; `register` performs no uniqueness check of its own.
- Do not wire `OrganizationAdministrationService.registerNfcTag(...)` into any UI, CLI, or composition root — it has no caller after this sprint.
- Do not touch `AssignmentResolver.ts`, `AssignmentValidator.ts`, or their test files in any way. Confirm this with `git diff` before finishing.
- Do not touch `apps/mobile`, `packages/core/src/cli/runScan.ts`, or any CLI entry point.
- Do not implement DT-025, DT-026, or any other Development Task — this sprint is DT-024 only.

TESTING REQUIREMENTS:
- The extended test file must cover: the accepted path, each of the three rejection paths with an explicit no-write assertion, one consolidated no-write proof, and deterministic `NfcTagId` generation — while leaving all six pre-existing `createCustomer(...)` tests unmodified.
- Run `MembershipAuthorizationValidator.test.ts`, `InMemoryNfcTagRepository.test.ts`, and `AssignmentResolver.test.ts` and confirm all pass with **zero modification** — do not touch any of these three files.
- Run `npm run typecheck --workspace=@taptime/core` and `npm run test --workspace=@taptime/core`; both must pass, with all 203 pre-existing tests remaining green, before you consider the task done.
- Confirm via `git diff --stat` that only `OrganizationAdministrationService.ts` and its existing test file were changed (plus `packages/core/src/index.ts` only if step 2 above determines it is actually required) — `MembershipAuthorizationValidator.ts`, `MembershipAuthorizationResult.ts`, `Membership.ts`, `NfcTag.ts`, `NfcPayload.ts`, `NfcTagRegistered.ts`, `NfcTagRepository.ts`, `InMemoryNfcTagRepository.ts`, `AssignmentResolver.ts`, and `AssignmentValidator.ts` must show zero diff.

EXPECTED DELIVERABLES:
- Two changed files (`OrganizationAdministrationService.ts`, its existing test file extended in place), committed with a clear commit message referencing DT-024 and Development Sprint 017.
- A short implementation summary (changed files, test results, the exact `RegisterNfcTagResult` shape used and why, confirmation that `createCustomer(...)` required zero changes) suitable for Review Agent evaluation. Do NOT update `EP-007_Development_Tasks.md`'s DT-024 "Implementation Notes" section yourself — that update happens at governance closure, a separate, later task.

STOP CONDITION:
Stop after completing the Implementation Scope and tests above. Do not begin DT-025 or any other Development Task. Do not create Development Sprint 018. Do not modify FB-002, TS-002, or `EP-007_Development_Tasks.md`. Wait for review.
```

---

## 18. Role Handover

Implemented scope in this task: Development Sprint 017 planning only — this document and the embedded Development Agent Prompt, scoped exclusively to DT-024. No source code was written or modified. No architecture, ADR, TTAP-001, FB-001, TS-001, FB-002, TS-002, Product Vision, Product Principles, Domain Model, Role Model, EP-008, or EP-009 content was changed.

Changed artifacts: `ADO/02_Development/Development_Sprint_017_Plan.md` (new, this file). `ADO/00_Core/Decision_Log.md` was deliberately **not** updated — see the disclosed judgment call below. `ADO/00_Core/Project_Status.md` was updated with a small, targeted change — see below.

**Disclosed judgment call (Decision_Log.md):** the assigning task instructed updating `Decision_Log.md` "only if the repository's current sprint-planning pattern requires a DEV-SPRINT-017 Planned row." This repeats the same evaluation performed for every Sprint Plan since Sprint 003: `Decision_Log.md` currently shows `DEV-SPRINT-012` through `DEV-SPRINT-016` each received their first row only at Governance Closure, not at planning time (confirmed by direct grep of the Decision Log for each `DEV-SPRINT-01[2-6]` entry, each already carrying "Completed" status with no prior "Planned" row visible anywhere). Per "repository evidence decides," `Decision_Log.md` is therefore not updated by this task; a `DEV-SPRINT-017` row will be added at Sprint 017's governance closure, consistent with every prior sprint since Sprint 003.

**Disclosed judgment call (Project_Status.md):** a small, targeted update was made — the Status line, one Current State bullet reference, the Current Epics bullet, and Immediate Next Steps item 3 — to reflect that Development Sprint 017 (DT-024) is now Planned, mirroring exactly the same small-update pattern Development Sprints 012 through 016's own plans applied when each first became Planned. No FB-002/TS-002 status language was touched (both remain correctly described as "reviewed," not "approved") and no other section was altered.

Related ADO artifacts consulted: `Development_Sprint_016_Closure.md`, `Development_Sprint_016_Plan.md`, `Development_Sprint_015_Closure.md`, `Development_Sprint_014_Closure.md`, `Development_Sprint_013_Closure.md`, `Development_Sprint_012_Closure.md`, `FB-002-organization-management-foundation.md`, `TS-002-organization-management-foundation.md`, `EP-007_Development_Tasks.md` (DT-024/DT-025 sections), `Decision_Log.md`, `Project_Status.md`, and direct inspection of current repository code: `packages/core/src/application/OrganizationAdministrationService.ts`, `packages/core/src/business/MembershipAuthorizationValidator.ts`, `MembershipAuthorizationResult.ts`, `packages/core/src/domain/Membership.ts`, `NfcTag.ts`, `NfcPayload.ts`, `packages/core/src/domain/events/NfcTagRegistered.ts`, `packages/core/src/ports/NfcTagRepository.ts`, `packages/core/src/infrastructure/repositories/InMemoryNfcTagRepository.ts`, `packages/core/src/domain/ids.ts`, `packages/core/src/index.ts`, and `packages/core/tests/application/OrganizationAdministrationService.test.ts`.

Tests performed: none (planning-only task; no code changed). Current repository test/typecheck state (203 `packages/core` tests passing, typecheck clean, plus 10 `apps/mobile` tests, as verified and recorded at Development Sprint 016's governance closure) is cited here, not re-run since no code changed.

Known deviations: none from the assigned task scope.

Unresolved questions / open findings carried forward, unaffected by this task: the Membership-granting bootstrap question; FB-002's remaining Open Questions (tag reassignment/history semantics, tag payload collision semantics, same-Organization assignment semantics — all relevant to the still-unplanned DT-025, not resolved here); DT-016 physical-device validation; iOS NFC support; Development Sprint 002/004 governance backlog; Finding F-01; the backend/cloud persistence technology decision; the future Identity-layer Feature Blueprint; FB-002's/TS-002's own "Draft" header status fields; `NfcTagRepository.register`/`NfcAssignmentRepository.save` still have no caller today outside their own test files; `OrganizationAdministrationService.createCustomer(...)` remains uncalled outside its own test file, and `registerNfcTag(...)` will join it in that same state once implemented — but is not implemented by this planning task.

Evidence produced: this plan document and the embedded Development Agent Prompt and Role Handover.

Next responsible role: Technical Lead / Human Architect review and approval of this Sprint 017 Plan. Per the assigned stop condition, implementation does not begin until approval is given, and no further Development Task beyond DT-024 is started within this sprint even after approval.

## 19. Stop Condition

Per task instruction: stop after producing this Development Sprint 017 Plan and the minimum required cross-reference update (Project_Status.md only, per the disclosed judgment call above). No code was implemented or modified. Sprint 017 execution has not begun. DT-025 has not been started. Development Sprint 018 was not created. Awaiting Technical Lead / Human Architect review.
