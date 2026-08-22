# Development Sprint 009 Plan – Error & Outcome Categorization

Status: Planned
Role: Research / Implementation Support acting on behalf of Technical Lead (per AGR-001)
Epic: EP-007 – Product Architecture Foundation
Owner: Technical Lead
Approval Authority: Human Architect
Branch: `main`
Created Date: 2026-07-06
Related Development Task: **DT-009 (existing — defined in EP-007's original task sequence, never yet implemented)**
Related Artifacts: `EP-007_Development_Tasks.md`, `Development_Sprint_001_Plan.md`–`Development_Sprint_008_Plan.md`, `MVP_Readiness_Assessment.md`, TTAP-001, TS-001, FB-001, ADR-0006, ADR-0007, `Role_Model.md`, `System_Overview.md`

---

## 1. Executive Summary

Repository evidence does **not** support Firestore/real persistence as Sprint 009 — the backend/persistence technology decision ADR-0007 defers is still not made (verified: no `Firestore`/"backend technology" decision exists anywhere in `Decision_Log.md`), so building toward it now would repeat the exact mistake Sprints 005–008 each deliberately avoided. Less obviously, repository evidence also does **not** support a "viewing capability" sprint (the next item in this role's own prior MVP roadmap): `Role_Model.md`'s "View own time entries" permission and `System_Overview.md`'s "Reporting/export capabilities" boundary item are named at the *product* level, but **no query/read component for this exists anywhere in TTAP-001, FB-001, or TS-001** (verified: `WorkEventRepository`/`TimeEntryRepository` expose only `save()`/`findActiveByTarget()`, no general query method; TTAP-001's Runtime Architecture and Domain Events lists contain no viewing/query/reporting component). Building it now would mean inventing a new architectural component — precisely what this task instructs against ("Do not create new architecture").

Instead, the highest-value, best-evidenced next sprint is **DT-009 — Error Handling**, an existing Development Task defined since EP-007's original task sequence and never yet implemented. TTAP-001's Runtime Architecture already states, as approved architecture: "Errors shall be categorized as recoverable, retryable, deferred, conflict or fatal." Today, five sprints' worth of result types (`ScanPipelineOutcome`, `AssignmentValidationResult`, `BusinessEngineDecision`, `SynchronizationResult`, `AuthenticationResult`) each express rejection/failure in their own ad hoc shape, with no mapping onto this already-approved taxonomy anywhere in the codebase. Implementing DT-009 requires no new architecture, no Human Architect technology decision, and no invented component — only "Extend Before Create" applied to a taxonomy that has been sitting, approved and unused, since TTAP-001 was written.

## 2. Repository Evidence

- `ADO/01_Architecture/Technical_Architecture_Profile.md` line 234 (Runtime Architecture, immediately following the pipeline diagram): "Errors shall be categorized as recoverable, retryable, deferred, conflict or fatal." This is Approved architecture (TTAP-001's status), not a proposal — verified by direct inspection of the surrounding section.
- `ADO/02_Development/EP-007_Development_Tasks.md`'s DT-009 section (verified by direct inspection): "Objective: Implement explicit error handling for scan, assignment, WorkEvent, persistence and synchronization failures. Acceptance Criteria: Errors are categorized consistently with TTAP-001. User-facing outcomes are clear enough for implementation. Technical errors remain observable for evidence and debugging." No Implementation Notes subsection exists under DT-009 — unlike DT-001–DT-008 and DT-011–DT-014, it has never been started.
- Direct inspection of every current result/outcome type shows five independent, ad hoc shapes with no shared categorization:
  - `packages/core/src/application/ScanPipelineOutcome.ts`: `{ stage: 'capture'; status: 'unreadable' }`, `{ stage: 'resolution'; status: 'rejected'; reason: 'unknown_tag' | 'inactive_assignment' }`.
  - `packages/core/src/business/AssignmentValidationResult.ts`: `reason: 'employee_not_authenticated' | 'employee_lacks_organization_access' | 'missing_assignment_target' | 'assignment_target_disabled'`.
  - `packages/core/src/business/BusinessEngineDecision.ts`: `status: 'escalation_required'; reason: 'duplicate_scan_rule_undefined'` — its own in-file comment already calls this "a deliberate placeholder, not a business decision," conceptually matching TTAP-001's "deferred" category, but the code contains no explicit `'deferred'` tag.
  - `packages/core/src/application/SynchronizationResult.ts`: `status: 'retryable_failure' | 'conflict'` — these names already closely mirror two of TTAP-001's five categories by coincidence, but are not formally unified with the other four result types.
  - `packages/core/src/application/AuthenticationResult.ts`: `status: 'rejected'; reason: 'invalid_credentials'`.
- `MVP_Readiness_Assessment.md` Section 9: "MVP-B08 | DT-009 Error Handling not started — failures are only distinguishable at the component level, not consistently categorized per TTAP-001 | MEDIUM | Sprint 010." This assessment predates Sprints 006–008 (Mobile/Auth), which have since closed every BLOCKER-rated finding except MVP-B03 (no NFC hardware) and MVP-B05 (a Human Architect product decision, not engineering). With those closed, MVP-B08 is now the highest-rated *engineering* finding that is both unblocked and architecturally pre-approved.
- `Role_Model.md` line 39 ("View own time entries | Yes | Yes | Yes | Yes") and `System_Overview.md` line 35 ("Reporting/export capabilities") name a viewing/reporting capability at the product-boundary level, but neither TTAP-001's Runtime Architecture/Domain Events, FB-001, nor TS-001 defines a query/read component, endpoint, or port for it — verified by direct search for "view"/"query"/"report" across all three (no matches beyond a single TTAP-001 glossary line describing the Admin *role*, not a component). Building this now would require inventing a new port (e.g. a `WorkEventRepository`/`TimeEntryRepository` query method or a new read-side service) that is not currently approved anywhere — this task's explicit "Do not create new architecture" instruction rules this out for Sprint 009.
- `ADR-0007-technology-platform-baseline.md`'s Decision section still defers "the exact implementation libraries and service configuration" for backend/persistence; `Decision_Log.md` has no row recording a chosen backend or persistence technology (verified by direct search — no "Firestore" or "backend technology" decision entry exists). This is the same blocker that has correctly ruled out a persistence sprint since Sprint 005.
- All 98 `packages/core` tests currently pass and `apps/mobile`/`packages/core` both typecheck cleanly (verified this session) — DT-009 can be implemented and tested without touching any of this passing baseline's behavior, only adding a classification layer on top of it.

## 3. Why Sprint 009 Is the Correct Next Sprint

**Repository evidence rules out both of the two most obvious alternatives**, and the task's own caution against assuming Firestore is well-founded: the backend/persistence technology decision remains unmade, exactly as it has since Sprint 005, and attempting it now would require a Human Architect decision this role cannot make. Less obviously, a "viewing" sprint — which this role's own prior `MVP_Readiness_Assessment.md` had originally sequenced next — turns out to require inventing a new architectural component (a query/read port) that no approved artifact currently names. Recommending it would violate this task's own explicit "Do not create new architecture" instruction, so it cannot be Sprint 009 either, regardless of its BLOCKER-level business value in the MVP assessment. This is itself a repository-evidence-driven correction to this role's own prior roadmap, made openly rather than silently carried forward.

By contrast, DT-009 requires zero new architecture: TTAP-001 already approved a five-category error taxonomy years before this sprint, and it has simply never been implemented. Every sprint since Sprint 001 has added another ad hoc result/rejection shape (`ScanPipelineOutcome`, `AssignmentValidationResult`, `BusinessEngineDecision`, `SynchronizationResult`, and now `AuthenticationResult`) without ever mapping any of them onto the one taxonomy TTAP-001 actually specifies. This is the same "already-approved-but-unbuilt architecture" pattern that made Authentication the right call for Sprint 007/008 (TS-001's "user must be authenticated" was approved but unbuilt) — DT-009 is the last such gap of this kind remaining in the current Development Task sequence (DT-001–DT-014 are otherwise all either Completed or gated on Finding F-01, a product decision).

This does not contradict the overall MVP roadmap shape; it corrects the *next* item in it once repository evidence (rather than the original assessment's general sequencing intuition) is checked against what TTAP-001, FB-001, and TS-001 actually approve today.

## 4. Business Objective

Give every existing and future TapTim.e outcome — a rejected scan, a queued WorkEvent, a synchronization failure, a rejected sign-in — the same, already-promised classification (recoverable, retryable, deferred, conflict, or fatal) so that both the employee (via clearer, more consistent on-screen feedback) and future engineering work (via a stable, shared vocabulary for "what kind of failure is this") benefit from architecture that has been approved since TTAP-001 was written but never delivered.

## 5. Technical Objective

Introduce a single, shared `ErrorCategory` type (`'recoverable' | 'retryable' | 'deferred' | 'conflict' | 'fatal'`, per TTAP-001's exact wording) and a small set of pure classification functions that map each existing result/outcome type (`ScanPipelineOutcome`, `AssignmentValidationResult`, `BusinessEngineDecision`, `SynchronizationResult`, `AuthenticationResult`) onto it — without changing any of those types' existing shapes, fields, or the business/application logic that produces them, and without introducing any new architectural component.

## 6. Scope

- A new shared type, `ErrorCategory` (e.g. `packages/core/src/domain/ErrorCategory.ts` or `packages/core/src/application/ErrorCategory.ts`, per the Development Agent's judgment on the most consistent existing location), with exactly TTAP-001's five named values and nothing else.
- Pure classification functions, one per existing result/outcome type, each taking that type's existing value and returning an `ErrorCategory` (or `null`/`undefined` for non-error outcomes such as `accepted`/`time_entry_started`/`synchronized`/`authenticated`) — e.g. `classifyScanPipelineOutcome(outcome)`, `classifyAssignmentValidationResult(result)`, `classifyBusinessEngineDecision(decision)`, `classifySynchronizationResult(result)`, `classifyAuthenticationResult(result)`.
- An explicit, documented mapping table (in code comments and/or the implementation notes) from every existing rejection/failure reason to one of the five categories, for example (subject to the Development Agent's own review against TTAP-001's category definitions, and escalated rather than guessed if genuinely ambiguous, per "Escalate Instead of Guessing"):
  - `unreadable` (capture) → recoverable
  - `unknown_tag`, `inactive_assignment` (resolution) → recoverable
  - `employee_not_authenticated`, `invalid_credentials` → recoverable
  - `employee_lacks_organization_access`, `missing_assignment_target`, `assignment_target_disabled` → fatal
  - `escalation_required` / `duplicate_scan_rule_undefined` → deferred (matches the type's own existing in-file comment)
  - `retryable_failure` → retryable
  - `conflict` → conflict
- Extending `ScanResultPresenter` (DT-011) to include the classified category alongside its existing rendered outcome strings, so the mobile UI's existing output log (Sprint 006/008) surfaces this classification without any new UI component — an extension of existing presentation logic, not a new one.
- Unit tests for every new classification function, covering every currently-defined rejection/failure reason.

## 7. Out of Scope

- **Any change to the business/application logic that produces these result types** — `AssignmentResolver`, `AssignmentValidator`, `BusinessEngine`, `WorkEventFactory`, `SynchronizationService`, `SessionService` are all unchanged; classification is a pure, read-only mapping applied after a decision is already made.
- **Firestore or any real persistence/backend technology** — unchanged from every prior sprint's deferral; still gated on an undecided Human Architect technology decision.
- **A viewing/query/reporting capability of any kind** — no such component is approved in TTAP-001/FB-001/TS-001 today; recommending or building it would require new architecture (Section 3).
- **Retry scheduling, backoff policies, or any behavior change based on a result's category** — DT-009's Acceptance Criteria require errors to be *categorized* and *observable*, not acted upon differently; introducing category-based behavior (e.g. auto-retry for `'retryable'`) would be new business/application logic, not categorization, and is not requested here.
- **Resolving Finding F-01** (duplicate-scan/toggle mechanism) — still a Human Architect product decision, unaffected by this sprint; `escalation_required`'s classification as `'deferred'` documents the existing placeholder, it does not resolve it.
- **Real NFC hardware** — unaffected.
- **Any change to FB-001, TS-001, TTAP-001, any ADR, Product Vision, Product Principles, Domain Model, Role Model, or EP-008.**

## 8. Existing Components (Reused, Not Recreated)

| Component | File | Reused As |
|---|---|---|
| `ScanPipelineOutcome` | `packages/core/src/application/ScanPipelineOutcome.ts` | Classified, not modified. |
| `AssignmentValidationResult` | `packages/core/src/business/AssignmentValidationResult.ts` | Classified, not modified. |
| `BusinessEngineDecision` | `packages/core/src/business/BusinessEngineDecision.ts` | Classified, not modified; its own "deliberate placeholder" comment directly informs the `'deferred'` mapping. |
| `SynchronizationResult` | `packages/core/src/application/SynchronizationResult.ts` | Classified; its `retryable_failure`/`conflict` names already closely mirror two TTAP-001 categories. |
| `AuthenticationResult` | `packages/core/src/application/AuthenticationResult.ts` | Classified, not modified. |
| `ScanResultPresenter` | `packages/core/src/application/ScanResultPresenter.ts` | Extended to surface the classified category in its existing rendered strings. |
| TTAP-001 Runtime Architecture (error taxonomy) | `ADO/01_Architecture/Technical_Architecture_Profile.md` line 234 | The authoritative source for the five category names; cited, not duplicated. |

## 9. Components to Implement

| Component | Type | Location (proposed) |
|---|---|---|
| `ErrorCategory` type | Domain/shared type | `packages/core/src/domain/ErrorCategory.ts` (or `application/`, per Development Agent judgment) |
| `classifyScanPipelineOutcome()` | Pure function | `packages/core/src/application/` (near `ScanPipelineOutcome`) |
| `classifyAssignmentValidationResult()` | Pure function | `packages/core/src/business/` (near `AssignmentValidationResult`) |
| `classifyBusinessEngineDecision()` | Pure function | `packages/core/src/business/` (near `BusinessEngineDecision`) |
| `classifySynchronizationResult()` | Pure function | `packages/core/src/application/` (near `SynchronizationResult`) |
| `classifyAuthenticationResult()` | Pure function | `packages/core/src/application/` (near `AuthenticationResult`) |
| `ScanResultPresenter` extension | Application code | `packages/core/src/application/ScanResultPresenter.ts` (extended) |

## 10. Development Task Mapping

- **DT-009 (existing, not new) — Error Handling.** This is not a newly-proposed task: it has existed in `EP-007_Development_Tasks.md`'s original task sequence since EP-007 was established, with its Objective and Acceptance Criteria already approved (Section 2). This sprint is simply the first to implement it. No new Development Task identifier is required.
  - Objective (unchanged, already approved): "Implement explicit error handling for scan, assignment, WorkEvent, persistence and synchronization failures."
  - Acceptance Criteria (unchanged, already approved): "Errors are categorized consistently with TTAP-001." "User-facing outcomes are clear enough for implementation." "Technical errors remain observable for evidence and debugging."
  - This plan's Section 6 scope is this role's proposed interpretation of how to satisfy those Acceptance Criteria using only already-approved architecture; the Development Agent should treat TTAP-001 line 234 as authoritative if any conflict arises.

## 11. Testing Strategy

- Unit tests for each new classification function, exhaustively covering every currently-defined rejection/failure reason across all five result types (verified list in Section 6) — each test asserts the specific `ErrorCategory` value, not just "some category."
- A test confirming non-error outcomes (`accepted`, `time_entry_started`, `synchronized`, `authenticated`) are correctly excluded from classification (return `null`/`undefined`, or whatever explicit "not an error" signal the Development Agent chooses) rather than silently mapped to an arbitrary category.
- A test confirming `ScanResultPresenter`'s extended output includes the classified category for at least one rejection/failure case per result type, without altering its existing rendered message content for already-tested scenarios (extending `ScanResultPresenter.test.ts`'s existing 16 tests, not replacing them).
- No new tests are needed for `AssignmentResolver`, `AssignmentValidator`, `BusinessEngine`, `WorkEventFactory`, `SynchronizationService`, or `SessionService` — none are modified.
- `npm run typecheck` and `npm run test` must pass across the monorepo; all 98 pre-existing `packages/core` tests must remain green.

## 12. Risks

| Risk | Mitigation |
|---|---|
| Guessing an ambiguous category for a rejection reason not clearly matching one of TTAP-001's five definitions | Per "Escalate Instead of Guessing" (already the repository's established pattern for Finding F-01), the Development Agent should document any genuinely ambiguous mapping as an explicit open question in the implementation notes rather than silently picking one. |
| Classification logic quietly gaining the power to change behavior (e.g. auto-retrying `'retryable'` outcomes) | Out of Scope (Section 7) explicitly forbids this; classification functions must be pure and read-only, never triggering a side effect. |
| Modifying the underlying result/outcome types' shapes instead of classifying them externally | Scope (Section 6) explicitly requires classification via separate pure functions, not by adding a `category` field to the existing types themselves, to minimize risk to already-tested code — unless the Development Agent finds a compelling reason to do otherwise, which should be documented. |
| Treating this sprint as license to also build viewing/reporting "since we're touching outcomes anyway" | Out of Scope (Section 7) explicitly excludes this; Section 3 explains why that would require new architecture not yet approved. |
| `ScanResultPresenter` extension inadvertently changing existing rendered message text, breaking its 16 existing tests | Testing Strategy (Section 11) explicitly requires extending, not replacing, existing test coverage, and treating any existing-test failure as a signal to revisit the extension approach. |

## 13. Definition of Done

- `ErrorCategory` type exists with exactly TTAP-001's five named values.
- A classification function exists for each of `ScanPipelineOutcome`, `AssignmentValidationResult`, `BusinessEngineDecision`, `SynchronizationResult`, `AuthenticationResult`, each tested exhaustively against every currently-defined rejection/failure reason.
- `ScanResultPresenter` surfaces the classified category in its existing rendered output, with its pre-existing 16 tests still passing.
- No business/application logic that produces these result types is modified; `AssignmentResolver`, `AssignmentValidator`, `BusinessEngine`, `WorkEventFactory`, `SynchronizationService`, `SessionService` are all unchanged (verified by diff).
- `npm run typecheck` and `npm run test` pass across the monorepo (all 98 pre-existing tests, plus new tests added this sprint, all green).
- `EP-007_Development_Tasks.md`'s existing `## DT-009 – Error Handling` section gains a "Development Sprint 009 Implementation Notes" subsection (its Objective/Acceptance Criteria are unchanged, already approved).
- No change to FB-001, TS-001, TTAP-001, any ADR, Product Vision, Product Principles, Domain Model, Role Model, or EP-008.
- Review Agent verification and Human Architect approval are recorded before DT-009 is marked Completed (DTP-001: "Implementation alone never completes a Development Task").

## 14. Recommended Implementation Order

1. Define the `ErrorCategory` type with exactly TTAP-001's five values.
2. Implement `classifySynchronizationResult()` first — its existing `retryable_failure`/`conflict` names already closely mirror two categories, making it the lowest-risk starting point to validate the overall approach.
3. Implement `classifyAuthenticationResult()`, `classifyAssignmentValidationResult()`, `classifyScanPipelineOutcome()`, and `classifyBusinessEngineDecision()`, in that order of increasing ambiguity, escalating (not guessing) any case that does not clearly map to one of the five categories.
4. Write exhaustive unit tests for each classification function as it is implemented.
5. Extend `ScanResultPresenter` to surface the classified category in its rendered output; extend its existing test file accordingly.
6. Run `npm run typecheck` and `npm run test` for the whole monorepo.
7. Add the "Development Sprint 009 Implementation Notes" subsection to DT-009 in `EP-007_Development_Tasks.md`.
8. Produce implementation evidence and role handover; request Review Agent verification.

---

## 15. Development Agent Prompt

The following prompt is written to be given directly to Claude Code (Development Agent) to execute Development Sprint 009. It is self-contained and does not require this planning document to be re-explained.

```text
You are the Development Agent for TapTim.e, implementing Development Sprint 009 ("Error & Outcome Categorization," DT-009) on branch `main`. This implements an existing, previously-unbuilt Development Task.

CONTEXT (verify before writing code):
- Read `ADO/02_Development/Development_Sprint_009_Plan.md` in full — it is the authoritative scope for this task.
- Read `ADO/01_Architecture/Technical_Architecture_Profile.md` line ~234 (Runtime Architecture): "Errors shall be categorized as recoverable, retryable, deferred, conflict or fatal." This exact taxonomy is what you are implementing — do not invent additional categories or rename these.
- Read `ADO/02_Development/EP-007_Development_Tasks.md`'s DT-009 section — its Objective and Acceptance Criteria are already approved and unchanged by this sprint.
- Read all five existing result/outcome types: `packages/core/src/application/ScanPipelineOutcome.ts`, `packages/core/src/business/AssignmentValidationResult.ts`, `packages/core/src/business/BusinessEngineDecision.ts`, `packages/core/src/application/SynchronizationResult.ts`, `packages/core/src/application/AuthenticationResult.ts`. Do not modify any of them.
- Read `packages/core/src/application/ScanResultPresenter.ts` and its test file — you will extend, not rewrite, this.
- Do not modify DT-001–DT-014 business/application logic, FB-001, TS-001, TTAP-001, any ADR, Product Vision, Product Principles, Domain Model, Role Model, or EP-008.

IMPLEMENTATION SCOPE (do exactly this, nothing more, in this order):
1. Define `ErrorCategory` as a type with exactly the values `'recoverable' | 'retryable' | 'deferred' | 'conflict' | 'fatal'`.
2. Implement a pure classification function for each of the five result/outcome types, each returning an `ErrorCategory` for a rejection/failure case, and `null` (or an equivalent explicit "not an error" signal) for a success case. Use the mapping suggested in the plan's Section 6 as a starting point; if any rejection reason does not clearly fit one of the five categories, document this as an open question in your implementation notes rather than guessing.
3. Write exhaustive unit tests for each classification function, covering every currently-defined rejection/failure reason and confirming success cases are excluded.
4. Extend `ScanResultPresenter` so its rendered output includes the classified category for rejection/failure outcomes, without changing the text of any already-tested success-case message.
5. Extend `ScanResultPresenter.test.ts` to cover the new category output; do not remove or weaken any existing assertion.

ARCHITECTURE BOUNDARIES (do not violate):
- Classification functions must be pure and read-only — they must never trigger a retry, change a `SyncState`, or otherwise alter behavior based on a category.
- Do not modify `AssignmentResolver`, `AssignmentValidator`, `BusinessEngine`, `WorkEventFactory`, `SynchronizationService`, `SessionService`, or any of the five result/outcome types' existing shapes.
- Do not build any viewing, reporting, or query capability — that is explicitly out of scope and would require new architecture not approved here.
- Do not attempt to resolve Finding F-01 — `escalation_required`'s classification as `'deferred'` documents the existing placeholder, it does not resolve it.
- Do not touch FB-001, TS-001, TTAP-001, any ADR, Product Vision, Product Principles, Domain Model, Role Model, or EP-008.

TESTING REQUIREMENTS:
- Exhaustive unit tests for every classification function against every currently-defined rejection/failure reason.
- Extended `ScanResultPresenter.test.ts` coverage for the new category output.
- Run `npm run typecheck` and `npm run test` at the repository root; both must pass (existing 98 tests remain green) before you consider the task done.

EXPECTED DELIVERABLES:
- The new `ErrorCategory` type and classification functions, the `ScanResultPresenter` extension, and their tests — committed with a clear commit message referencing DT-009 and Development Sprint 009.
- A new "Development Sprint 009 Implementation Notes" subsection added under DT-009 in `ADO/02_Development/EP-007_Development_Tasks.md` (its Objective/Acceptance Criteria are unchanged).
- A short implementation summary (changed files, test results, the final category mapping table, and any ambiguous cases escalated rather than guessed) suitable for Review Agent evaluation.

STOP CONDITION:
Stop after completing the Implementation Scope, tests, and the EP-007_Development_Tasks.md update. Do not begin any further sprint (no persistence, no viewing/reporting, no real NFC). Do not mark DT-009 "Completed" yourself — that status requires Review Agent verification and Human Architect approval. Wait for review.
```

---

## 16. Role Handover

Implemented scope in this task: Development Sprint 009 planning only — this document and the embedded Development Agent Prompt. No source code was written or modified. No architecture, ADR, TTAP-001, FB-001, TS-001, Product Vision, Product Principles, Domain Model, Role Model, or EP-008 content was changed.

Changed artifacts: `ADO/02_Development/Development_Sprint_009_Plan.md` (new, this file). No other file was modified.

Related ADO artifacts consulted: Product Vision, Product Principles, Decision Log, AVR-001, ADR-0006, ADR-0007, TTAP-001 (Runtime Architecture error taxonomy specifically), Domain Model, Role Model, System_Overview.md, FB-001, TS-001, Development Task Profile (DTP-001), `EP-007_Development_Tasks.md` (DT-009 section and DT-001–DT-014 for completeness), `Development_Sprint_001_Plan.md`–`Development_Sprint_008_Plan.md`, `Development_Sprint_007_Closure.md`, `Development_Sprint_008_Closure.md`, `MVP_Readiness_Assessment.md`, current `packages/core/src` (all five result/outcome types, `ScanResultPresenter.ts`, `WorkEventRepository.ts`, `TimeEntryRepository.ts`), EP-008 Chapters 00–03 (read for context only, not modified per this task's explicit "Do not update EP-008" instruction).

Tests performed: none (planning-only task; no code changed). `packages/core`'s current test/typecheck state was verified this session (98 tests passing, typecheck clean for both `packages/core` and `apps/mobile`); not re-run after this document was written since no code changed.

Known deviations: none from the assigned task scope. Two corrections to prior framing are documented explicitly in Sections 1–3: (1) this task's "Current Project State" does not name a specific next-sprint assumption, but the Engineering Question explicitly warns against assuming Firestore Persistence — repository evidence (no backend technology decision recorded) confirms this warning is well-founded; (2) this role's own prior `MVP_Readiness_Assessment.md` roadmap had implicitly suggested a viewing/reporting sprint would follow Mobile/Auth — on this review, no TTAP-001/FB-001/TS-001 component exists for viewing/querying data, so recommending it would require inventing new architecture, which this task explicitly forbids; DT-009 is recommended instead, as the one remaining already-approved-but-unimplemented piece of architecture.

Open findings carried forward (not resolved by this task): (1) Development Sprint 002 (DT-004/005/006) and Development Sprint 004 (DT-008) remain without recorded Review Agent verification or Human Architect approval; (2) Development Sprint 005's EP-008 implementation narrative remains unsynchronized; (3) Finding F-01 (duplicate-scan/toggle mechanism) remains open and continues to gate DT-005's remaining outcomes; (4) `QueuedWorkEventRecord.decision: null` still has no integration-level test coverage; (5) the backend/persistence and real-managed-auth-provider technology decisions ADR-0007 defers are both still not made; (6) a viewing/reporting capability remains a named product requirement (`Role_Model.md`, `System_Overview.md`) with no approved architectural component to build against — a future Feature Blueprint/Technical Specification extension would be needed before it can be planned as a Development Task, which is a Technical Lead/Human Architect decision, not something resolved by this planning task.

Evidence produced: this plan document, including the repository-evidence basis for rejecting both Firestore Persistence and a viewing sprint, and for recommending DT-009 instead.

Next responsible role: Technical Lead / Human Architect review and approval of this Sprint 009 Plan. Per the assigned stop condition, implementation does not begin until that approval is given.

## 17. Stop Condition

Per task instruction: this task stops after producing the Development Sprint 009 Plan, the Development Agent Prompt and the Role Handover above. No code was implemented. No architecture, ADRs, TTAP-001, Product Vision, Product Principles, Domain Model, Role Model, or EP-008 were modified. Awaiting Technical Lead / Human Architect approval before implementation begins.
