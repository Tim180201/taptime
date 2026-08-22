# Development Sprint 015 Plan – Repository Write Extensions (DT-020, DT-021, DT-022)

Status: Planned
Role: Research / Implementation Support acting on behalf of Technical Lead (per AGR-001)
Epic: EP-007 – Product Architecture Foundation (implementation), governed in priority by EP-009 – Product Readiness Framework
Owner: Technical Lead
Approval Authority: Human Architect
Branch: `main`
Created Date: 2026-07-08
Related Development Tasks: DT-020 – Customer Repository Write Extension; DT-021 – NFC Tag Repository Write Extension; DT-022 – NFC Assignment Repository Write Extension (bundled, no others)
Related Feature Blueprint / Technical Specification: FB-002 – Organization Management Foundation; TS-002 – Organization Management Foundation Technical Specification
Related Artifacts: `EP-007_Development_Tasks.md` (DT-017–DT-026), `Decision_Log.md`, `Project_Status.md`, `Development_Sprint_014_Closure.md`, `Development_Sprint_014_Plan.md`, `Development_Sprint_013_Closure.md`, `Development_Sprint_012_Closure.md`, EP-008 Chapters 00–03

---

## 1. Executive Summary

Development Sprint 012 completed DT-017 (Organization Domain & Repository); Development Sprint 013 completed DT-018 (Membership Domain & Repository); Development Sprint 014 completed DT-019 (Membership Authorization Validator). Development Sprint 015 continues the TS-002 implementation sequence with the next unblocked unit: **DT-020, DT-021, and DT-022 — the three repository write extensions, bundled together**. No other Development Task (DT-023–DT-026) is part of this sprint.

This is the first Development Sprint in the Organization Management sequence to bundle more than one Development Task, and repository evidence supports doing so here specifically: `EP-007_Development_Tasks.md`'s own Dependencies lines for all three tasks state independence from each other and from DT-017–DT-019 ("Independent of DT-017/DT-018/DT-019/DT-020/DT-021/DT-022," in each task's own wording), and each task is the same shape — extend one existing read-only repository port with one additive write method, update its in-memory adapter, add one new domain event that follows an idiom this repository has now used five times (`WorkEventCreated`, `OrganizationCreated`, `MembershipGranted`, and now `CustomerCreated`/`NfcTagRegistered`/`NfcTagAssigned`). None of the three touches a file any of the others touch — `CustomerRepository`/`InMemoryCustomerRepository`, `NfcTagRepository`/`InMemoryNfcTagRepository`, and `NfcAssignmentRepository`/`InMemoryNfcAssignmentRepository` are three entirely separate file pairs.

This sprint is deliberately narrow and deliberately **repository-write-only**: it does not build `OrganizationAdministrationService` (DT-023–DT-025), does not perform any authorization check, does not wire any of the three new write methods into anything that calls them, and does not touch `AssignmentResolver` or `AssignmentValidator` — both of which continue to call only the pre-existing read methods (`findById`, `findByPayload`, `findActiveByTagId`) exactly as before. After this sprint, a `Customer`, an `NfcTag`, and an `NfcAssignment` can each be constructed and saved only from a test — the same "callable, not yet called" state DT-017/DT-018/DT-019 each left their own components in.

## 2. Repository Evidence

- `Development_Sprint_014_Closure.md`, Section 14 (Next Sprint Recommendation): "Repository evidence supports proposing Development Sprint 015, scoped to DT-020 (`CustomerRepository` write extension), DT-021 (`NfcTagRepository` write extension), and DT-022 (`NfcAssignmentRepository` write extension) together... Bundling these three together... is a first candidate for a slightly larger-than-DT-017/018/019 sprint, since none has a partial-completion risk and none depends on the others."
- `EP-007_Development_Tasks.md`, DT-019 Implementation Notes (Completed): confirms `MembershipAuthorizationResult`, `MembershipAuthorizationValidator` exist, are exported, and that all 181 `packages/core` tests pass.
- `EP-007_Development_Tasks.md`, DT-020/DT-021/DT-022 sections (as approved): each states "Dependencies: None beyond existing repository code. Independent of DT-017/DT-018/DT-019" plus, for each, independence from the other two write-extension tasks — used verbatim as this sprint's scope baseline (Section 10, below).
- `FB-002-organization-management-foundation.md`, Decision 3 (Create Customer / AssignmentTarget): "Decision: create the Customer, owned by that Organization; otherwise reject. Result: CustomerCreated, or AdministrativeActionRejected." Decision 4 (Register NFC Tag): "Decision: register the NFC Tag, owned by that Organization; otherwise reject. Result: NfcTagRegistered, or AdministrativeActionRejected." Decision 5 (Assign NFC Tag): "Decision: create the NfcAssignment if the Tag and the AssignmentTarget belong to the same Organization as the requesting Membership; otherwise reject. Result: NfcTagAssigned, or CrossOrganizationAccessRejected." This sprint implements only each Decision's *write mechanism*; the *preconditions* (Administrator role, same-Organization membership, cross-Organization checks) are explicitly DT-023–DT-025's responsibility, per DT-020/021/022's own Out of Scope.
- `TS-002-organization-management-foundation.md`, Extended Existing Ports: "**CustomerRepository** — extend with one new method: save (create) a Customer. `findById` is unchanged... **NfcTagRepository** — extend with one new method: save (register) an NfcTag. `findByPayload` is unchanged... **NfcAssignmentRepository** — extend with one new method: save (create) an NfcAssignment. `findActiveByTagId` is unchanged." Business Events: "**CustomerCreated** — carries the created `Customer`. **NfcTagRegistered** — carries the registered `NfcTag`. **NfcTagAssigned** — carries the created `NfcAssignment`," each following "the existing `WorkEventCreated`/`TimeEntryStarted` idiom: a `type` discriminant plus the created/decided domain object."
- Direct code inspection confirms current read-only shapes: `CustomerRepository` (`findById(customerId): Customer | null`), `NfcTagRepository` (`findByPayload(payload): NfcTag | null`), `NfcAssignmentRepository` (`findActiveByTagId(nfcTagId): NfcAssignment | null`) — each a single-method interface today, each implemented by a constructor-seeded `InMemory*` adapter following the exact pattern `InMemoryOrganizationRepository`/`InMemoryMembershipRepository` already established. `Customer` (`id`, `organizationId`, `active`), `NfcTag` (`id`, `organizationId`, `payload`), `NfcAssignment` (`id`, `organizationId`, `nfcTagId`, `target`, `active`) are all confirmed unchanged-shape candidates — no field is added by this sprint.
- Direct code inspection of `AssignmentResolver.ts` confirms it calls only `NfcTagRepository.findByPayload` and `NfcAssignmentRepository.findActiveByTagId`; `AssignmentValidator.ts` confirms it calls only `CustomerRepository.findById`. Neither file calls, imports, or otherwise references a write method — none exists yet, and after this sprint neither file is modified to call the new ones.
- Direct search (`find`) confirms none of `InMemoryCustomerRepository.test.ts`, `InMemoryNfcTagRepository.test.ts`, `InMemoryNfcAssignmentRepository.test.ts` currently exists under `packages/core/tests/infrastructure/` — these three repositories' read behavior is exercised today only indirectly, through `AssignmentResolver.test.ts`/`AssignmentValidator.test.ts` fixtures. This sprint is the first to give each of the three its own dedicated test file, following the precedent `InMemoryOrganizationRepository.test.ts`/`InMemoryMembershipRepository.test.ts` already established for DT-017/DT-018.
- `Product_Readiness_Assessment.md` Section 11.1 continues to name Organization Management as the primary Product Capability bottleneck for reaching pilot customers; DT-020–DT-022 are three of ten Development Tasks in that sequence and do not close the bottleneck alone (Section 13, EP-009 Product Readiness Impact, below).

## 3. Why DT-020, DT-021 and DT-022 Are Selected

The Primary Planning Question is how DT-020/DT-021/DT-022 should be implemented together as the smallest safe bundled Development Sprint while preserving existing scan-pipeline behavior. Repository evidence answers this directly: all three tasks are now the only Organization Management tasks whose Dependencies are fully satisfied (each depends on "existing repository code" only, already present since Development Sprint 001) and whose implementation has not yet begun. DT-023–DT-025 (`OrganizationAdministrationService`'s three methods) each depend on the corresponding write extension existing first — DT-023 needs DT-020, DT-024 needs DT-021, DT-025 needs DT-022 — so none of DT-023–DT-025 can be implemented before this sprint completes. DT-019 (Membership Authorization Validator, Development Sprint 014) is a precondition for `OrganizationAdministrationService` too, but not for the write extensions themselves, which is exactly why the write extensions and the authorization validator could be — and were — sequenced as separate, independent sprints rather than combined.

## 4. Why Bundling Is Safe Here

Every prior Organization Management sprint (012, 013, 014) was deliberately scoped to exactly one Development Task, and each of those plans explicitly reasoned against bundling adjacent work. This sprint is the first exception, and the justification is structural, not a relaxation of standards:

- **No shared file.** `CustomerRepository.ts`/`InMemoryCustomerRepository.ts`, `NfcTagRepository.ts`/`InMemoryNfcTagRepository.ts`, and `NfcAssignmentRepository.ts`/`InMemoryNfcAssignmentRepository.ts` are three completely disjoint file pairs, plus three disjoint new event files and three disjoint new test files. A reviewer can evaluate any one of the three write extensions in complete isolation from the other two — there is no interleaving to reason about.
- **No dependency between the three.** `EP-007_Development_Tasks.md` states this explicitly and symmetrically: DT-020 is "Independent of DT-017/DT-018/DT-019" (and, by the same reasoning applied consistently across the three sections, of DT-021/DT-022 too); DT-021 is "Independent of DT-017/DT-018/DT-019/DT-020/DT-022"; DT-022 is "Independent of DT-017/DT-018/DT-019/DT-020/DT-021." No task's Acceptance Criteria reference another's output.
- **No partial-completion risk.** Each of the three is independently small and independently testable — a single additive method, a single adapter update, a single new event, a handful of tests. If any one were rejected in review, the other two would remain entirely valid and mergeable on their own; nothing about their bundling creates an all-or-nothing dependency.
- **Identical shape, not identical content.** All three follow the exact same four-step pattern (extend port, update adapter, add event, add tests) that DT-020's own Objective, DT-021's own Objective, and DT-022's own Objective each independently describe in near-identical language — bundling them avoids writing three separate, nearly-identical Sprint Plans and three separate, nearly-identical Development Agent Prompts, which would themselves be a form of unnecessary process overhead this repository's own "smallest safe Development Sprint" principle does not require when the tasks are this structurally uniform.

This is not a new precedent being set casually: it is the same "smallest safe Development Sprint" discipline applied to a case where the three smallest safe units happen to be siblings with zero interaction, rather than a sequential chain.

## 5. Why DT-023 Is Not Included

`OrganizationAdministrationService` (DT-023, and by extension DT-024/DT-025, which extend the same class) is a fundamentally different kind of component from DT-020–DT-022: it is an Application Service, not a repository/domain-event extension, and its own Acceptance Criteria require calling `MembershipAuthorizationValidator` (DT-019, complete) *and* the write method this sprint's own three tasks introduce. Including any part of DT-023 in this sprint would mean building an orchestration layer before its second dependency (the write extensions) is finished within the same sprint — the same "oversized Development Task" risk every prior sprint plan in this sequence has explicitly declined, now doubly true because DT-023 depends on all of DT-019 *and* DT-020 being done first, not just one. The assigning task's own Sprint Scope confirms this directly: DT-023–DT-025 are named explicitly as excluded. The smallest safe Development Sprint that finishes unblocking `OrganizationAdministrationService` is DT-020/DT-021/DT-022 together, and no further.

## 6. Business Objective

Give the Organization Management data model — `Customer`, `NfcTag`, `NfcAssignment` — a real, persistable write path for the first time, completing the "read-only since Development Sprint 001" half of each repository's story. This does not by itself make TapTim.e pilot-ready (Section 13, below): none of the three new write methods has a caller yet, so no Customer, NFC Tag, or NFC Tag Assignment can be created through any real path after this sprint. It is the necessary fourth/fifth/sixth step of the Organization Management capability the Product Readiness Assessment identifies as the primary bottleneck to reaching a pilot customer, and it is what directly unblocks `OrganizationAdministrationService` (DT-023–DT-025).

## 7. Technical Objective

Extend `CustomerRepository`, `NfcTagRepository`, and `NfcAssignmentRepository` each with exactly one additive save/create/register method; update `InMemoryCustomerRepository`, `InMemoryNfcTagRepository`, and `InMemoryNfcAssignmentRepository` accordingly; and add `CustomerCreated`, `NfcTagRegistered`, and `NfcTagAssigned` domain events, each following the established `WorkEventCreated`/`OrganizationCreated`/`MembershipGranted` constructor-function idiom exactly — with zero change to `Customer`, `NfcTag`, `NfcAssignment`, `AssignmentTarget`'s shapes, and zero change to `AssignmentResolver` or `AssignmentValidator`.

## 8. Scope

Per the assigning task, Development Sprint 015 includes only DT-020, DT-021, and DT-022. The sprint plans implementation of:

- `CustomerRepository` gains one additive save/create method; `InMemoryCustomerRepository` implements it; `CustomerCreated` domain event carries the created `Customer`.
- `NfcTagRepository` gains one additive save/create/register method; `InMemoryNfcTagRepository` implements it; `NfcTagRegistered` domain event carries the registered `NfcTag`.
- `NfcAssignmentRepository` gains one additive save/create method; `InMemoryNfcAssignmentRepository` implements it; `NfcTagAssigned` domain event carries the created `NfcAssignment`.
- Unit tests for all of the above, including explicit non-regression checks that `AssignmentResolver.test.ts` and `AssignmentValidator.test.ts` require no changes.
- Barrel-export registration in `packages/core/src/index.ts` for the three new events (the three port/adapter changes are additive to already-exported types and classes, requiring no new export lines of their own).

## 9. Out of Scope

Explicitly excluded from this sprint, per the assigning task:

- DT-023 (`OrganizationAdministrationService` — Customer registration), DT-024 (NFC Tag Registration application flow), DT-025 (NFC Tag Assignment application flow), DT-026 (Scan Pipeline Integration Verification).
- Any UI, any mobile work, any CLI command.
- Any Identity work, any `AuthenticationGateway` change, any `FakeAuthenticationGateway` change, any real authentication provider.
- Any change to `MembershipService`, `OrganizationManagementService`, or `MembershipAuthorizationValidator`.
- Any change to `AssignmentValidator` or `AssignmentResolver` — both continue to call only their existing read methods, unmodified.
- Any change to `BusinessEngine`, `WorkEventFactory`, `NfcScanApplicationService`, `CallerContext`, `OfflineQueue`, `SynchronizationService`, or error handling.
- Any authorization check on who may call any of the three new write methods (DT-023/DT-024/DT-025's responsibility).
- Any resolution of same-Organization assignment semantics, tag reassignment/history semantics, or tag payload collision semantics — all remain open FB-002 Open Questions, untouched by this sprint.
- Any durable/file-backed adapter implementation, any backend/cloud persistence technology, any database schema, any API design.
- Any physical NFC validation, any tag-provisioning workflow.
- Any change to `Customer`, `NfcTag`, `NfcAssignment`, or `AssignmentTarget`'s shape.
- Any change to `Organization`, `Membership`, or any DT-017/DT-018/DT-019 component — consumed, if at all, only as read-only type references.
- Any change to FB-002, TS-002, EP-008, `Product_Readiness_Assessment.md`, or `Product_Readiness_Roadmap.md`.

## 10. Existing Components Reused (Patterns, Not Code)

All three write extensions reuse the exact same set of precedents, now doubly established by DT-017 and DT-018's own repository/event work:

| Existing Precedent | File | Reused As |
|---|---|---|
| Additive port extension, read method unchanged | `packages/core/src/ports/OrganizationRepository.ts`/`MembershipRepository.ts` (both already combine a read and a write method in one interface) | Exact structural template for adding a write method to `CustomerRepository`/`NfcTagRepository`/`NfcAssignmentRepository` without touching their existing read method. |
| Constructor-seeded in-memory repository, defensive array copy | `packages/core/src/infrastructure/repositories/InMemoryOrganizationRepository.ts`/`InMemoryMembershipRepository.ts` | Exact structural template for each `InMemory*` adapter's new save method — append to an internally-held array, never mutate the constructor's input array. |
| Constructor-function domain event | `packages/core/src/domain/events/OrganizationCreated.ts`/`MembershipGranted.ts` | Exact structural template for `CustomerCreated`, `NfcTagRegistered`, `NfcTagAssigned`. |
| Dedicated per-repository test file, round-trip plus not-found coverage | `packages/core/tests/infrastructure/InMemoryOrganizationRepository.test.ts`/`InMemoryMembershipRepository.test.ts` | Exact structural template for the first-ever dedicated test files for `InMemoryCustomerRepository`, `InMemoryNfcTagRepository`, `InMemoryNfcAssignmentRepository`. |
| Explicit non-regression check via existing test suite | `Development_Sprint_012_Plan.md`/`013`/`014`'s own Testing Strategy sections | Applied here to `AssignmentResolver.test.ts`/`AssignmentValidator.test.ts` specifically, since those are the two existing consumers of the read methods being extended. |

No component from `business/` beyond `AssignmentResolver`/`AssignmentValidator` (read-only, unmodified), `application/`, the FB-001 scan pipeline's remaining components, `OfflineQueue`, `SynchronizationService`, or `CallerContext` is called, imported, or otherwise touched by DT-020–DT-022.

## 11. Components to Implement

Repository reality confirms the paths the assigning task proposed already match this repository's existing sibling-file conventions exactly (verified by direct inspection of `packages/core/src/domain/events/`, `ports/`, `infrastructure/repositories/` — each already contains DT-017/DT-018's files of the corresponding kind in exactly these locations). No alternative location is better-justified; the proposed paths are used as-is.

| Component | Type | Location |
|---|---|---|
| `CustomerCreated` | Domain event | `packages/core/src/domain/events/CustomerCreated.ts` |
| `NfcTagRegistered` | Domain event | `packages/core/src/domain/events/NfcTagRegistered.ts` |
| `NfcTagAssigned` | Domain event | `packages/core/src/domain/events/NfcTagAssigned.ts` |
| `CustomerRepository` | Port (extended, not new) | `packages/core/src/ports/CustomerRepository.ts` |
| `NfcTagRepository` | Port (extended, not new) | `packages/core/src/ports/NfcTagRepository.ts` |
| `NfcAssignmentRepository` | Port (extended, not new) | `packages/core/src/ports/NfcAssignmentRepository.ts` |
| `InMemoryCustomerRepository` | Infrastructure adapter (extended, not new) | `packages/core/src/infrastructure/repositories/InMemoryCustomerRepository.ts` |
| `InMemoryNfcTagRepository` | Infrastructure adapter (extended, not new) | `packages/core/src/infrastructure/repositories/InMemoryNfcTagRepository.ts` |
| `InMemoryNfcAssignmentRepository` | Infrastructure adapter (extended, not new) | `packages/core/src/infrastructure/repositories/InMemoryNfcAssignmentRepository.ts` |

Tests are planned as three new files under `packages/core/tests/infrastructure/` — `InMemoryCustomerRepository.test.ts`, `InMemoryNfcTagRepository.test.ts`, `InMemoryNfcAssignmentRepository.test.ts` — the first dedicated test file each of these three repositories has ever had, matching this repository's existing `tests/` mirror-of-`src/` layout exactly.

## 12. Development Task Mapping

**DT-020 – Customer Repository Write Extension**, used exactly as approved in `EP-007_Development_Tasks.md`:

- **Objective:** Extend `CustomerRepository` with one additive save/create method, update `InMemoryCustomerRepository`, introduce `CustomerCreated`.
- **Acceptance Criteria:** one new method; `findById` unchanged byte-for-byte, existing tests unmodified; `InMemoryCustomerRepository` implements the new method per its existing constructor-seeded pattern; `CustomerCreated` carries the created `Customer`, following the `WorkEventCreated` idiom; a dedicated test proves save-then-`findById` composes correctly; `AssignmentValidator`'s existing `findById` usage verified unchanged, its tests pass without modification.
- **Implementation Boundary:** `Customer`'s shape; `AssignmentValidator`; any other repository — none touched.
- **Out of Scope (per DT-020 itself):** authorization on who may call the new method (DT-023's responsibility); Customer update/deactivation; durable/file-backed implementation.
- **Dependencies:** None beyond existing repository code — satisfied.

**DT-021 – NFC Tag Repository Write Extension**, used exactly as approved:

- **Objective:** Extend `NfcTagRepository` with one additive save/create/register method, update `InMemoryNfcTagRepository`, introduce `NfcTagRegistered`.
- **Acceptance Criteria:** one new method; `findByPayload` unchanged byte-for-byte, existing tests unmodified; `InMemoryNfcTagRepository` implements the new method; `NfcTagRegistered` carries the registered `NfcTag`; a dedicated test proves register-then-`findByPayload` composes correctly; `AssignmentResolver`'s existing `findByPayload` usage verified unchanged, its tests pass without modification.
- **Implementation Boundary:** `NfcTag`'s shape; `AssignmentResolver`; any other repository — none touched.
- **Out of Scope (per DT-021 itself):** authorization (DT-024's responsibility); tag deactivation/retirement; any physical tag-provisioning workflow; durable/file-backed implementation.
- **Dependencies:** None beyond existing repository code — satisfied.

**DT-022 – NFC Assignment Repository Write Extension**, used exactly as approved:

- **Objective:** Extend `NfcAssignmentRepository` with one additive save/create method, update `InMemoryNfcAssignmentRepository`, introduce `NfcTagAssigned`.
- **Acceptance Criteria:** one new method; `findActiveByTagId` unchanged byte-for-byte, existing tests unmodified; `InMemoryNfcAssignmentRepository` implements the new method; `NfcTagAssigned` carries the created `NfcAssignment`; a dedicated test proves create-then-`findActiveByTagId` composes correctly for an active assignment; `AssignmentResolver`'s existing `findActiveByTagId` usage verified unchanged, its tests pass without modification.
- **Implementation Boundary:** `NfcAssignment`'s shape; `AssignmentTarget`'s shape; `AssignmentResolver`; any other repository — none touched.
- **Out of Scope (per DT-022 itself):** authorization or same-Organization cross-check (DT-025's responsibility); re-assignment/assignment history semantics; durable/file-backed implementation.
- **Dependencies:** None beyond existing repository code — satisfied.

No other Development Task is mapped to this sprint.

## 13. Testing Strategy

- `npm run typecheck --workspace=@taptime/core` — must pass with no errors.
- `npm run test --workspace=@taptime/core` — must pass; all 181 pre-existing tests (as of Development Sprint 014) must remain green, plus new tests covering:
  - `InMemoryCustomerRepository`: save-then-`findById` round-trip; not-found case unchanged; constructor-seeded lookups; does-not-mutate-input-array.
  - `InMemoryNfcTagRepository`: register-then-`findByPayload` round-trip; not-found case unchanged; constructor-seeded lookups; does-not-mutate-input-array.
  - `InMemoryNfcAssignmentRepository`: create-active-assignment-then-`findActiveByTagId` round-trip; not-found/inactive case unchanged (an inactive assignment must not be returned by `findActiveByTagId`, exactly as today); constructor-seeded lookups; does-not-mutate-input-array.
- **Explicit non-regression requirement (per the assigning task):** `AssignmentResolver.test.ts` and `AssignmentValidator.test.ts` must both pass **without any modification** — not a single assertion changed, not a single fixture altered. This is verified by running both files' existing test suites unchanged and confirming `git diff` shows zero changes to either test file.
- No `apps/mobile` tests are expected or required — DT-020–DT-022 add no `apps/mobile` code and no `apps/mobile` file is touched.
- No physical-device validation is relevant to DT-020–DT-022.
- Explicit non-regression check: `git diff --stat` outside the three new event files, the three port files, the three adapter files, the three new test files, and `packages/core/src/index.ts`'s export additions must be empty. In particular, `AssignmentResolver.ts`, `AssignmentValidator.ts`, `Customer.ts`, `NfcTag.ts`, `NfcAssignment.ts`, and `AssignmentTarget.ts` must be confirmed byte-for-byte unchanged.

## 14. Risks

| Risk | Mitigation |
|---|---|
| Wiring any of the three new write methods into `AssignmentResolver`, `AssignmentValidator`, or any Application Service "since it's now available" | Out of Scope (Section 9) explicitly forbids this; no caller is introduced for any of the three write methods by this sprint. |
| Beginning `OrganizationAdministrationService` (DT-023) once all three write extensions exist, reasoning "the last blocker is gone" | DT-023 also depends on DT-019 (already complete) — the write extensions completing does not change DT-023's own Dependencies wording, which names it as a separate, later Development Task; the Stop Condition (Section 18) reinforces stopping after DT-022. |
| Adding an authorization check, an Organization-existence check, or a same-Organization cross-check inside any of the three new write methods "since Decision 3/4/5 mention it" | Each Decision's *precondition* (Administrator role, same-Organization membership) is explicitly DT-023/024/025's responsibility per DT-020/021/022's own Out of Scope; the write methods themselves perform no such check, mirroring `OrganizationManagementService`/`MembershipService`'s own "no precondition beyond the request itself" precedent. |
| Accidentally modifying `AssignmentResolver.test.ts` or `AssignmentValidator.test.ts` while adding new test coverage nearby | Testing Strategy (Section 13) states this as an explicit, separately-verified requirement — both files must show zero diff, checked directly via `git diff` before the sprint is considered complete. |
| Resolving tag reassignment/history semantics, tag payload collision semantics, or the "one active assignment per tag" question while implementing `InMemoryNfcAssignmentRepository`'s save method | All three are named FB-002 Open Questions, explicitly out of scope; the save method accepts and stores whatever `NfcAssignment` it is given, exactly as `InMemoryOrganizationRepository`/`InMemoryMembershipRepository` accept and store whatever they are given, with no uniqueness or business-rule enforcement of its own. |
| Treating this sprint's bundling as license to bundle DT-023–DT-025 together in the next sprint without re-evaluating their own dependency structure | Section 4's justification is specific to DT-020–DT-022's zero-shared-file, zero-mutual-dependency structure; DT-023–DT-025 share one class (`OrganizationAdministrationService`) and must be evaluated on their own evidence, not assumed bundleable by precedent. |

## 15. Definition of Done

For the eventual implementation and closure of this sprint (not performed by this planning task itself — see Stop Condition):

- `CustomerCreated`, `NfcTagRegistered`, `NfcTagAssigned` exist; `CustomerRepository`, `NfcTagRepository`, `NfcAssignmentRepository` each carry one new write method; `InMemoryCustomerRepository`, `InMemoryNfcTagRepository`, `InMemoryNfcAssignmentRepository` each implement it — exactly as specified in Sections 8/11/12.
- `npm run typecheck --workspace=@taptime/core` and `npm run test --workspace=@taptime/core` both pass; all 181 pre-existing tests remain green.
- `AssignmentResolver.test.ts` and `AssignmentValidator.test.ts` both pass with zero modification, confirmed by `git diff` showing no changes to either file.
- `git diff` confirms zero changes to any file outside the three new event files, the three port files, the three adapter files, their tests, and `packages/core/src/index.ts`'s export additions.
- `EP-007_Development_Tasks.md`'s DT-020, DT-021, and DT-022 "Implementation Notes" placeholders are each filled in with the actual implementation summary, at closure time (not part of this planning task).
- Review Agent verification and Human Architect approval are recorded before DT-020/DT-021/DT-022 are marked Completed (DTP-001: "Implementation alone never completes a Development Task").

## 16. Recommended Implementation Order

1. Add `CustomerCreated` event.
2. Extend `CustomerRepository` with the new save/create method.
3. Update `InMemoryCustomerRepository`.
4. Add `InMemoryCustomerRepository.test.ts` (round-trip, not-found, constructor-seeded, no-mutation).
5. Add `NfcTagRegistered` event.
6. Extend `NfcTagRepository` with the new save/register method.
7. Update `InMemoryNfcTagRepository`.
8. Add `InMemoryNfcTagRepository.test.ts` (round-trip, not-found, constructor-seeded, no-mutation).
9. Add `NfcTagAssigned` event.
10. Extend `NfcAssignmentRepository` with the new save/create method.
11. Update `InMemoryNfcAssignmentRepository`.
12. Add `InMemoryNfcAssignmentRepository.test.ts` (round-trip, not-found/inactive, constructor-seeded, no-mutation).
13. Register the three new events in `packages/core/src/index.ts`'s barrel export.
14. Run `npm run typecheck --workspace=@taptime/core` and `npm run test --workspace=@taptime/core`; explicitly confirm `AssignmentResolver.test.ts`/`AssignmentValidator.test.ts` show zero diff and still pass; confirm `git diff --stat` touches only the expected files.

Repository evidence supports this order directly: each task's own event-then-port-then-adapter-then-tests sequence mirrors DT-017/DT-018's own successful order, repeated three times in Customer → NfcTag → NfcAssignment order (the order the assigning task itself proposed, and the order Decisions 3 → 4 → 5 appear in FB-002); validation is deliberately last, after all six production files exist, consistent with every prior sprint's own discipline.

---

## 17. Development Agent Prompt

The following prompt is written to be given directly to Claude Code (Development Agent) to execute Development Sprint 015. It is self-contained and does not require this planning document to be re-explained.

```text
You are the Development Agent for TapTim.e, implementing Development Sprint 015 ("Repository Write Extensions," DT-020 + DT-021 + DT-022 only) on branch `main`.

CONTEXT (verify before writing code):
- Read `ADO/02_Development/Development_Sprint_015_Plan.md` in full — it is the authoritative scope for this task.
- Read `ADO/01_Architecture/Feature_Blueprints/FB-002-organization-management-foundation.md` (Decisions 3, 4, 5) and `ADO/01_Architecture/Technical_Specifications/TS-002-organization-management-foundation.md` (Extended Existing Ports, Business Events sections) — the product/technical basis for what you are building.
- Read `ADO/02_Development/EP-007_Development_Tasks.md`'s "## DT-020", "## DT-021", and "## DT-022" sections — your exact Objective, Acceptance Criteria, Implementation Boundary, Out of Scope and Dependencies for each.
- Read these existing files as your structural templates: `packages/core/src/ports/OrganizationRepository.ts`/`MembershipRepository.ts` (a port combining a read and a write method), `packages/core/src/infrastructure/repositories/InMemoryOrganizationRepository.ts`/`InMemoryMembershipRepository.ts` (constructor-seeded adapter with a defensive array copy and a save method), `packages/core/src/domain/events/OrganizationCreated.ts`/`MembershipGranted.ts` (the constructor-function event idiom), `packages/core/tests/infrastructure/InMemoryOrganizationRepository.test.ts`/`InMemoryMembershipRepository.test.ts` (the round-trip/not-found/constructor-seeded/no-mutation test shape).
- Read the three files you will extend and their two current callers, all unmodified: `packages/core/src/ports/CustomerRepository.ts`, `packages/core/src/ports/NfcTagRepository.ts`, `packages/core/src/ports/NfcAssignmentRepository.ts`, `packages/core/src/infrastructure/repositories/InMemoryCustomerRepository.ts`, `packages/core/src/infrastructure/repositories/InMemoryNfcTagRepository.ts`, `packages/core/src/infrastructure/repositories/InMemoryNfcAssignmentRepository.ts`, `packages/core/src/business/AssignmentResolver.ts`, `packages/core/src/business/AssignmentValidator.ts`, `packages/core/tests/business/AssignmentResolver.test.ts`, `packages/core/tests/business/AssignmentValidator.test.ts`.
- Do not modify `AssignmentResolver.ts`, `AssignmentValidator.ts`, `AssignmentResolver.test.ts`, `AssignmentValidator.test.ts`, `Customer.ts`, `NfcTag.ts`, `NfcAssignment.ts`, `AssignmentTarget.ts`, `Organization.ts`, `OrganizationRepository.ts`, `InMemoryOrganizationRepository.ts`, `OrganizationManagementService.ts`, `Membership.ts`, `MembershipRole.ts`, `MembershipRepository.ts`, `InMemoryMembershipRepository.ts`, `MembershipService.ts`, `MembershipAuthorizationResult.ts`, `MembershipAuthorizationValidator.ts`, FB-001, TS-001, TTAP-001, any ADR, Product Vision, Product Principles, Domain Model, Role Model, EP-008, EP-009, FB-002, or TS-002.

IMPLEMENTATION SCOPE (do exactly this, nothing more, for all three tasks):

DT-020 (Customer):
1. Create `CustomerCreated` in `packages/core/src/domain/events/CustomerCreated.ts`, following `OrganizationCreated.ts`'s exact shape: a `type: 'CustomerCreated'` discriminant plus the created `Customer`, and a constructor function.
2. Extend `CustomerRepository` (`packages/core/src/ports/CustomerRepository.ts`) with exactly one new method (save/create a `Customer`; name it consistently with `OrganizationRepository`'s verb choice — e.g. `save`). Do NOT change `findById`'s signature or behavior.
3. Update `InMemoryCustomerRepository` (`packages/core/src/infrastructure/repositories/InMemoryCustomerRepository.ts`) to implement the new method, following `InMemoryOrganizationRepository.ts`'s exact constructor-seeded, defensive-copy pattern. Do NOT change `findById`'s implementation.
4. Create `packages/core/tests/infrastructure/InMemoryCustomerRepository.test.ts`: save-then-`findById` round-trip; not-found case (unchanged behavior, still tested); constructor-seeded lookups; does-not-mutate-input-array.

DT-021 (NfcTag):
5. Create `NfcTagRegistered` in `packages/core/src/domain/events/NfcTagRegistered.ts`, same shape convention, carrying the registered `NfcTag`.
6. Extend `NfcTagRepository` (`packages/core/src/ports/NfcTagRepository.ts`) with exactly one new method (register/save an `NfcTag`). Do NOT change `findByPayload`.
7. Update `InMemoryNfcTagRepository` (`packages/core/src/infrastructure/repositories/InMemoryNfcTagRepository.ts`) to implement the new method, same pattern as DT-020's adapter update.
8. Create `packages/core/tests/infrastructure/InMemoryNfcTagRepository.test.ts`: register-then-`findByPayload` round-trip; not-found case; constructor-seeded lookups; does-not-mutate-input-array.

DT-022 (NfcAssignment):
9. Create `NfcTagAssigned` in `packages/core/src/domain/events/NfcTagAssigned.ts`, same shape convention, carrying the created `NfcAssignment`.
10. Extend `NfcAssignmentRepository` (`packages/core/src/ports/NfcAssignmentRepository.ts`) with exactly one new method (create/save an `NfcAssignment`). Do NOT change `findActiveByTagId`.
11. Update `InMemoryNfcAssignmentRepository` (`packages/core/src/infrastructure/repositories/InMemoryNfcAssignmentRepository.ts`) to implement the new method, same pattern.
12. Create `packages/core/tests/infrastructure/InMemoryNfcAssignmentRepository.test.ts`: create-active-assignment-then-`findActiveByTagId` round-trip; verify an inactive assignment is still correctly excluded by `findActiveByTagId` (unchanged behavior); constructor-seeded lookups; does-not-mutate-input-array.

Finally:
13. Register `CustomerCreated`, `NfcTagRegistered`, `NfcTagAssigned` in `packages/core/src/index.ts`, in the same grouped, `export * from` style already used there, near the other domain-event exports (`OrganizationCreated`, `MembershipGranted`).

ARCHITECTURE BOUNDARIES (do not violate):
- Do not touch `AssignmentResolver.ts`, `AssignmentValidator.ts`, or their test files in any way — not even a whitespace change. Confirm this with `git diff` before finishing.
- Do not touch `Customer`, `NfcTag`, `NfcAssignment`, or `AssignmentTarget`'s shape — no field added, removed, or renamed.
- Do not touch `Organization`, `Membership`, `MembershipRole`, `MembershipAuthorizationValidator`, `MembershipService`, or `OrganizationManagementService`.
- Do not add any authorization check, Organization-existence check, or same-Organization cross-check inside any of the three new write methods.
- Do not add any uniqueness check, deduplication, or "one active assignment per tag" enforcement inside `InMemoryNfcAssignmentRepository`'s new save method — it stores whatever it is given.
- Do not create `OrganizationAdministrationService` or any Application Service.
- Do not wire any of the three new write methods into anything that calls them — they have no caller after this sprint.
- Do not touch `apps/mobile`, `packages/core/src/cli/runScan.ts`, or any CLI entry point.
- Do not implement DT-023, DT-024, DT-025, DT-026, or any other Development Task — this sprint is DT-020 + DT-021 + DT-022 only.

TESTING REQUIREMENTS:
- All three new dedicated test files (Sections above) must cover: round-trip (write then read), the existing not-found/inactive case still working correctly, constructor-seeded lookups, and no-mutation-of-constructor-input.
- Run the existing `AssignmentResolver.test.ts` and `AssignmentValidator.test.ts` suites and confirm both pass with **zero modification** — do not touch either file, even to add a comment.
- Run `npm run typecheck --workspace=@taptime/core` and `npm run test --workspace=@taptime/core`; both must pass, with all 181 pre-existing tests remaining green, before you consider the task done.
- Confirm via `git diff --stat` that only the three new event files, the three port files, the three adapter files, their three new test files, and `packages/core/src/index.ts` were changed — `AssignmentResolver.ts`, `AssignmentValidator.ts`, `Customer.ts`, `NfcTag.ts`, `NfcAssignment.ts`, `AssignmentTarget.ts` must show zero diff.

EXPECTED DELIVERABLES:
- Nine new files (three events, three test files, plus the three port/adapter pairs are extensions not new files) and the extended `CustomerRepository.ts`/`NfcTagRepository.ts`/`NfcAssignmentRepository.ts`/`InMemoryCustomerRepository.ts`/`InMemoryNfcTagRepository.ts`/`InMemoryNfcAssignmentRepository.ts`, committed with a clear commit message referencing DT-020, DT-021, DT-022 and Development Sprint 015.
- `packages/core/src/index.ts` updated with the three new export lines.
- A short implementation summary (changed files, test results, any naming decisions you made for each of the three save/register/create method names and why) suitable for Review Agent evaluation. Do NOT update `EP-007_Development_Tasks.md`'s DT-020/DT-021/DT-022 "Implementation Notes" sections yourself — that update happens at governance closure, a separate, later task.

STOP CONDITION:
Stop after completing the Implementation Scope and tests above. Do not begin DT-023 or any other Development Task. Do not create Development Sprint 016. Do not modify FB-002, TS-002, or `EP-007_Development_Tasks.md`. Wait for review.
```

---

## 18. Role Handover

Implemented scope in this task: Development Sprint 015 planning only — this document and the embedded Development Agent Prompt, scoped exclusively to DT-020, DT-021, and DT-022. No source code was written or modified. No architecture, ADR, TTAP-001, FB-001, TS-001, FB-002, TS-002, Product Vision, Product Principles, Domain Model, Role Model, EP-008, or EP-009 content was changed.

Changed artifacts: `ADO/02_Development/Development_Sprint_015_Plan.md` (new, this file). `ADO/00_Core/Decision_Log.md` was deliberately **not** updated — see the disclosed judgment call below. `ADO/00_Core/Project_Status.md` was updated with a small, targeted change — see below.

**Disclosed judgment call (Decision_Log.md):** the assigning task instructed updating `Decision_Log.md` "only if the repository's current sprint-planning pattern requires a DEV-SPRINT-015 Planned row." This repeats the same evaluation performed for Development Sprints 012, 013, and 014's own plans: every Sprint Plan from 003 through 014 received its first Decision Log row only at Governance Closure, not at planning time. Per "repository evidence decides," `Decision_Log.md` is therefore not updated by this task; a `DEV-SPRINT-015` row will be added at Sprint 015's governance closure, consistent with every prior sprint since Sprint 003.

**Disclosed judgment call (Project_Status.md):** a small, targeted update was made — the Status line, one Current State bullet reference, the Current Epics bullet, and Immediate Next Steps item 3 — to reflect that Development Sprint 015 (DT-020/DT-021/DT-022, bundled) is now Planned, mirroring exactly the same small-update pattern Development Sprints 012, 013, and 014's own plans applied when each first became Planned. No FB-002/TS-002 status language was touched (both remain correctly described as "reviewed," not "approved") and no other section was altered.

Related ADO artifacts consulted: `Development_Sprint_014_Closure.md`, `Development_Sprint_014_Plan.md`, `Development_Sprint_013_Closure.md`, `Development_Sprint_012_Closure.md`, `FB-002-organization-management-foundation.md`, `TS-002-organization-management-foundation.md`, `EP-007_Development_Tasks.md` (DT-019 Implementation Notes, DT-020/DT-021/DT-022 sections, and Task Sequence diagram), `Decision_Log.md`, `Project_Status.md`, EP-008 Chapters 00–03, and direct inspection of current repository code: `packages/core/src/domain/Customer.ts`, `NfcTag.ts`, `NfcAssignment.ts`, `AssignmentTarget.ts`, `packages/core/src/ports/CustomerRepository.ts`, `NfcTagRepository.ts`, `NfcAssignmentRepository.ts`, `packages/core/src/infrastructure/repositories/InMemoryCustomerRepository.ts`, `InMemoryNfcTagRepository.ts`, `InMemoryNfcAssignmentRepository.ts`, `packages/core/src/business/AssignmentResolver.ts`, `AssignmentValidator.ts`, `packages/core/src/index.ts`, and direct search confirming no dedicated test file currently exists for any of the three `InMemory*` repositories being extended.

Tests performed: none (planning-only task; no code changed). Current repository test/typecheck state (181 `packages/core` tests passing, typecheck clean, as verified and recorded at Development Sprint 014's governance closure) is cited here, not re-run since no code changed.

Known deviations: none from the assigned task scope.

Unresolved questions / open findings carried forward, unaffected by this task: the Membership-granting bootstrap question; FB-002's remaining Open Questions (including tag reassignment/history semantics and tag payload collision semantics, both directly relevant to but not resolved by DT-022/DT-021); DT-016 physical-device validation; iOS NFC support; Development Sprint 002/004 governance backlog; Finding F-01; the backend/cloud persistence technology decision; the future Identity-layer Feature Blueprint; FB-002's/TS-002's own "Draft" header status fields; `MembershipAuthorizationValidator` still has no caller anywhere in the repository.

Evidence produced: this plan document and the embedded Development Agent Prompt and Role Handover.

Next responsible role: Technical Lead / Human Architect review and approval of this Sprint 015 Plan. Per the assigned stop condition, implementation does not begin until approval is given, and no further Development Task beyond DT-020/DT-021/DT-022 is started within this sprint even after approval.

## 19. Stop Condition

Per task instruction: stop after producing this Development Sprint 015 Plan and the minimum required cross-reference update (Project_Status.md only, per the disclosed judgment call above). No code was implemented or modified. Sprint 015 execution has not begun. DT-023 has not been started. Development Sprint 016 was not created. Awaiting Technical Lead / Human Architect review.
