# EP-008 – Developer Implementation Manual

## Chapter 01 – Implementation Philosophy

Status: Draft  
Document ID: EP-008-CH01  
Epic: EP-008  
Owner: Technical Lead  
Approval Authority: Human Architect  
Repository Scope: TapTim.e ADO  
Integration Status: Branch integration for Human Architect review  
Related Artifacts: Product Vision, Decision Log, AVR-001, ADRs, TTAP-001, Feature Blueprints, Technical Specifications, Development Task Profile, EOM-001, AGR-001

---

## 1. Purpose

This chapter defines the implementation philosophy for TapTim.e.

It does not define product intent, architecture, feature behavior, technical specifications, development tasks or governance. Those responsibilities remain with their existing ADO artifacts. This chapter explains how developers shall work with those artifacts when turning approved engineering decisions into software.

The purpose of the implementation philosophy is to make developer decisions consistent across the codebase.

A developer working on TapTim.e shall not ask:

```text
What can I implement quickly?
```

The developer shall ask:

```text
What has the repository already approved, which responsibility owns this behavior, and how do I implement it without changing its meaning?
```

Implementation work is therefore not creative reinterpretation of architecture. It is disciplined translation of approved engineering knowledge into code, tests and evidence.

This chapter establishes the mental model for all later EP-008 chapters.

Later chapters explain repository foundation, solution structure, domain implementation, business engine implementation, application orchestration, infrastructure, mobile implementation, readiness and repository integration. This chapter defines the rules that apply to all of them.

---

## 2. Responsibilities

### 2.1 Responsibility of Implementation Philosophy

The implementation philosophy is responsible for developer conduct during implementation.

It defines how developers shall:

- use repository evidence before making implementation choices,
- distinguish implementation decisions from architecture decisions,
- preserve approved responsibilities,
- continue existing repository work instead of recreating it,
- handle incomplete evidence,
- escalate missing decisions,
- keep source code traceable to approved ADO artifacts,
- test behavior at the correct responsibility boundary,
- avoid moving business meaning into the wrong layer.

It is intentionally cross-cutting. It applies to every chapter of EP-008 and every implementation area of TapTim.e.

### 2.2 Responsibility of Developers

A developer implementing TapTim.e is responsible for producing code that matches approved repository knowledge.

The developer shall:

- inspect the current repository state before implementation,
- identify the source-of-truth artifacts for the task,
- use EP-008 as implementation guidance only,
- preserve architecture boundaries,
- preserve feature behavior,
- preserve technical specification intent,
- avoid duplicate concepts,
- write tests that verify the correct responsibility,
- document evidence and handover information.

The developer shall not:

- reinterpret product intent,
- make new architecture decisions silently,
- create new business rules from implementation convenience,
- infer product behavior from UI or persistence,
- treat missing repository evidence as permission to invent behavior,
- hide deviations inside implementation code.

### 2.3 Responsibility of the Technical Lead

The Technical Lead owns engineering governance and implementation guidance.

For EP-008, the Technical Lead is responsible for:

- translating approved repository knowledge into developer guidance,
- maintaining alignment with Product Vision, ADRs, TTAP, Feature Blueprints, Technical Specifications and Development Tasks,
- identifying when implementation guidance requires repository reconciliation,
- preventing duplication of architecture content,
- preparing implementation work for Development Agent execution,
- preserving traceability across engineering artifacts.

The Technical Lead shall not use EP-008 to change product scope or bypass Human Architect authority.

### 2.4 Responsibility of Review

Review remains separate from implementation guidance.

The Review Agent may use EP-008 as supporting evidence when reviewing implementation quality, but approval must still be based on the authoritative source artifacts and repository reality.

EP-008 does not replace:

- architecture compliance review,
- feature behavior validation,
- technical specification validation,
- evidence review,
- test validation.

### 2.5 Responsibility Boundaries

Implementation philosophy defines how to work.

It does not define what the product is, what the architecture is or what a feature does.

| Responsibility | Source of Truth | EP-008 Role |
|---|---|---|
| Product intent | Product Vision | Do not redefine. |
| Engineering decisions | Decision Log / ADRs | Apply through implementation guidance. |
| Technical architecture | TTAP and architecture artifacts | Preserve boundaries. |
| Feature behavior | Feature Blueprints | Implement only approved behavior. |
| Feature implementation detail | Technical Specifications | Align implementation. |
| Work scope | Development Tasks | Support execution, do not expand. |
| Engineering workflow | EOM-001 | Follow required handovers and gates. |
| Agent responsibilities | AGR-001 | Respect role boundaries. |

---

## 3. Diagram

### 3.1 Implementation Decision Flow

```text
Implementation Question
  -> Check Repository Reality
  -> Identify Source-of-Truth Artifact
  -> Determine Owning Responsibility
  -> Apply EP-008 Guidance
  -> Implement Smallest Correct Change
  -> Test at Responsibility Boundary
  -> Record Evidence and Handover
```

This flow prevents implementation work from becoming undocumented architecture work.

### 3.2 Missing Decision Flow

```text
Developer Encounters Missing Decision
  -> Verify Repository Evidence
  -> Confirm No Existing Artifact Owns the Answer
  -> Stop Business/Architecture Interpretation
  -> Document Missing Decision
  -> Escalate to Responsible Role
  -> Implement Only Safe Supporting Work
```

A missing decision is not a development opportunity. It is an engineering signal.

### 3.3 Responsibility Boundary Model

```text
UI / Mobile Layer
  captures facts and presents outcomes

Application Layer
  orchestrates use cases and calls responsibilities

Business Engine Boundary
  interprets facts and produces decisions/events

Domain Foundation
  provides stable concepts and invariants

Infrastructure Layer
  persists, transports and integrates data
```

The most important principle is that business meaning must remain inside the approved business decision boundary.

No implementation layer may claim a responsibility only because it is technically convenient.

---

## 4. Dependencies

### 4.1 Repository Evidence Dependency

Implementation depends on repository evidence.

Before making a meaningful implementation decision, developers shall verify the current repository content that applies to the task.

Minimum evidence checks usually include:

- current branch,
- relevant ADO artifact paths,
- Decision Log status,
- related ADRs,
- related Technical Architecture Profile sections,
- related Feature Blueprint,
- related Technical Specification,
- related Development Task,
- current source code reality.

The exact set depends on the task. The principle does not.

### 4.2 Dependency Priority

When implementation guidance, source code and architecture appear to overlap, apply this order:

1. Current repository reality.
2. Product Vision for product intent.
3. Decision Log and ADRs for durable decisions.
4. TTAP for architecture responsibilities.
5. Feature Blueprints for feature behavior.
6. Technical Specifications for feature implementation detail.
7. Development Tasks for assigned scope.
8. EP-008 for developer implementation guidance.
9. Existing source code as implementation state.

Repository reality is always inspected first because it tells the developer what actually exists. Approved architecture then defines what the repository is intended to become.

A conflict between source code and approved architecture shall be documented. It shall not be silently resolved by changing product or architecture meaning inside code.

### 4.3 Dependency on Existing Concepts

Developers shall reuse approved concepts before creating new ones.

Before adding a new type, module, service, event, decision result, adapter, repository, use case or rule object, verify whether an equivalent concept already exists in:

- approved artifacts,
- current source code,
- technical specifications,
- architecture documents,
- development tasks.

New concepts shall be introduced only when they are necessary, named consistently and traceable to an approved reason.

### 4.4 Dependency on Reviewability

Implementation must be reviewable.

A reviewer must be able to answer:

```text
Which approved artifact does this code implement?
Which responsibility owns this behavior?
What boundary does this test verify?
What evidence proves the implementation is correct?
```

If those questions cannot be answered, the implementation is not ready for review.

---

## 5. Rules

### 5.1 Repository Before Assumptions

Developers shall inspect repository evidence before implementing.

Do not rely on:

- memory,
- previous conversations,
- inferred behavior,
- file names alone,
- UI appearance,
- partial code snippets,
- architectural intuition.

Use the repository as the source of truth.

### 5.2 Reality Has Priority Over Architecture

The actual repository state determines the starting point for implementation.

If the repository does not yet contain the ideal architecture, the developer shall not pretend it does. The correct action is to document the gap and implement the approved next step.

This prevents accidental rewrites and protects ongoing work.

### 5.3 Continue, Never Recreate

Developers shall continue existing work.

Do not create a second implementation path just because the existing one is incomplete. Extend, refactor or reconcile according to approved scope.

Recreation is allowed only when explicitly approved by task scope or architecture decision.

### 5.4 Extend Before Create

When a capability is missing, first determine whether an existing artifact or implementation structure should be extended.

Creation of new permanent concepts requires a clear reason.

Good reasons include:

- approved architecture requires the concept,
- approved technical specification requires the concept,
- existing concept has a different responsibility,
- extension would violate separation of concerns,
- Human Architect or Technical Lead has approved the new scope through the workflow.

Bad reasons include:

- faster to create a new file,
- easier to test in isolation,
- naming preference,
- uncertainty about existing code,
- avoiding repository discovery.

### 5.5 Traceability Before Convenience

Convenient implementation is not sufficient.

Every meaningful implementation choice must be traceable to an approved reason.

Traceability may be captured in:

- commit message,
- development task notes,
- implementation evidence,
- role handover,
- test names,
- comments when they clarify architectural boundaries.

Traceability does not require excessive comments. It requires that the reason for code exists outside personal memory.

### 5.6 Implement Approved Decisions, Do Not Invent Missing Ones

Developers implement approved decisions.

When an implementation question is not answered by approved artifacts, the developer shall escalate it.

This is especially important for:

- business rules,
- state transitions,
- accepted/rejected/deferred outcomes,
- synchronization meaning,
- offline behavior,
- permissions,
- audit behavior,
- data retention,
- conflict resolution.

Missing product or architecture meaning must not be hidden inside code.

### 5.7 Business Meaning Belongs to the Business Decision Boundary

No UI, database, synchronization, transport or infrastructure component may determine business meaning.

Those components may capture, persist, synchronize or display information. They may not decide what a fact means for the business.

Examples:

```text
Allowed:
A mobile screen captures that an NFC tag was scanned.

Not allowed:
A mobile screen decides that the scan starts a work session.
```

```text
Allowed:
A repository stores a decision result.

Not allowed:
A repository determines whether the decision is accepted or rejected.
```

### 5.8 Keep Decisions Deterministic Where Business Rules Require Determinism

Business decisions must be deterministic when based on the same facts, rules and state.

Implementation shall avoid hidden dependencies such as:

- current UI state,
- network timing,
- database side effects,
- adapter-specific behavior,
- mutable global state,
- implicit system clock usage without explicit modeling.

When time or environment matters, it shall be passed explicitly or isolated behind a controlled abstraction.

### 5.9 Make Boundaries Explicit

Code shall make responsibility boundaries visible.

A reviewer should be able to distinguish:

- fact capture,
- use case orchestration,
- business interpretation,
- persistence,
- synchronization,
- presentation,
- test setup.

If those responsibilities are mixed in one file or function, the implementation is likely violating the manual.

### 5.10 Escalate Instead of Guessing

If an implementation question changes behavior, architecture or scope, the developer shall escalate.

Escalation is required when:

- the repository gives conflicting guidance,
- no artifact owns the answer,
- the answer would create a new business rule,
- implementation requires changing architecture boundaries,
- tests cannot define expected behavior from approved artifacts,
- a workaround would become permanent repository knowledge.

---

## 6. Examples

### 6.1 Example: Choosing Where Logic Belongs

A developer implements handling for a scanned NFC tag.

Correct reasoning:

```text
The scan itself is a fact.
The mobile layer captures the fact.
The application layer submits the fact.
The business decision boundary interprets the fact.
The result is persisted and presented after decision evaluation.
```

Incorrect reasoning:

```text
The NFC screen knows the user scanned a tag, so the screen can start a work session directly.
```

The incorrect version derives business meaning from UI input capture.

### 6.2 Example: Handling an Undefined Rule

A developer cannot find a rule for duplicate NFC scans within a short time window.

Correct response:

```text
Document the missing rule.
Escalate to the Technical Lead or Human Architect depending on whether the gap is technical or product-related.
Implement only safe plumbing if already approved.
Do not create hidden duplicate handling behavior.
```

Incorrect response:

```text
Ignore scans within 30 seconds because that seems reasonable.
```

The incorrect version invents a business rule.

### 6.3 Example: Persistence Boundary

Correct persistence role:

```text
Store WorkEventDecisionResult after the business decision boundary has produced it.
Load previous state required by the business decision boundary.
Return data without interpreting its business meaning.
```

Incorrect persistence role:

```text
If an open work session exists, automatically close it when another scan is inserted.
```

The incorrect version places state transition logic inside persistence.

### 6.4 Example: Test Placement

Correct test strategy:

```text
Business rule tests verify accepted/rejected/deferred decisions at the business decision boundary.
Application tests verify that facts are passed to the business decision boundary and results are handled.
Infrastructure tests verify persistence mapping.
UI tests verify capture and presentation.
```

Incorrect test strategy:

```text
Only test the UI flow and assume business correctness because the screen changes state.
```

The incorrect version tests presentation rather than business decision correctness.

### 6.5 Example: Traceable Commit

Good commit message:

```text
EP-008: add application use case boundary for NFC scan fact submission
```

Good implementation evidence:

```text
Implements fact submission without business interpretation in the mobile layer. Decision evaluation remains delegated to the business decision boundary according to approved architecture guidance.
```

Weak implementation evidence:

```text
Added NFC logic.
```

Traceability shall explain responsibility, not only activity.

---

## 7. Implementation Notes

### 7.1 Implementation Decisions vs Architecture Decisions

An implementation decision chooses how to code an approved responsibility.

An architecture decision changes responsibility, structure or long-term direction.

Examples of implementation decisions:

- choosing a function name that matches approved terminology,
- splitting a mapper for readability,
- adding tests around an approved boundary,
- passing a clock dependency explicitly for deterministic tests,
- using a local interface to decouple an adapter.

Examples of architecture decisions:

- moving business interpretation from the business decision boundary into infrastructure,
- changing event ownership,
- changing persistence responsibility,
- changing feature behavior,
- introducing a new runtime component responsibility,
- changing offline-first behavior.

Developers may make implementation decisions within task scope. They may not make architecture decisions silently.

### 7.2 Practical Developer Checklist

Before implementation:

```text
1. Am I on the correct branch?
2. Which task am I implementing?
3. Which Feature Blueprint or Technical Specification owns the behavior?
4. Which ADR or TTAP section constrains the structure?
5. Which existing code already implements related behavior?
6. Which responsibility boundary owns the change?
7. What tests prove correctness?
8. What evidence must I produce?
```

During implementation:

```text
1. Keep changes inside approved scope.
2. Avoid duplicate concepts.
3. Keep business meaning in the correct boundary.
4. Keep dependencies explicit.
5. Keep behavior deterministic where required.
6. Add tests at the correct level.
7. Document deviations immediately.
```

Before handover:

```text
1. Verify changed files.
2. Verify tests.
3. Verify traceability to ADO artifacts.
4. Record known risks.
5. Record open questions.
6. Identify next responsible role.
```

### 7.3 Implementation Pattern: Explicit Fact Submission

Facts should enter the system through explicit use-case or application boundaries.

A fact is not a business decision.

Examples of facts:

- `NfcTagScanned`,
- `QrCodeScanned`,
- `ManualEntryRequested`,
- `DeviceTimeObserved`,
- `OfflineStateDetected`.

Facts should be represented in a way that preserves what happened without prematurely deciding what it means.

Implementation guidance:

- name facts in past tense where appropriate,
- avoid embedding decision outcomes in fact names,
- keep fact capture separate from business interpretation,
- include metadata needed for deterministic evaluation,
- validate shape before business interpretation,
- pass facts to the approved decision boundary.

Anti-pattern:

```text
StartWorkSessionFromNfcScan
```

This name already assumes the business outcome.

Better pattern:

```text
NfcTagScanned
```

This name describes the fact only.

### 7.4 Implementation Pattern: Deterministic Decision Boundary

Business decisions should be implemented so the same inputs produce the same outputs under the same rules and state.

Implementation guidance:

- pass required state explicitly,
- avoid hidden reads from UI or infrastructure inside rule evaluation,
- isolate time dependencies,
- return explicit decision results,
- emit business events only after rule evaluation,
- make rejection and deferral outcomes explicit.

This pattern is expanded in Chapter 05 – Business Engine Foundation.

### 7.5 Implementation Pattern: Thin Adapters

Adapters shall translate between external systems and internal boundaries.

They shall not own business meaning.

Examples:

- NFC adapter reads tag data and emits a scan fact.
- Persistence adapter stores and loads records.
- Synchronization adapter transfers pending events.
- UI adapter presents decision results.

Adapters may handle technical errors. They may not decide business outcomes.

### 7.6 Error Handling Philosophy

Errors and business decisions are different concepts.

A rejected business decision is not necessarily an error.

Examples:

| Situation | Classification |
|---|---|
| Invalid NFC payload shape | Input validation or technical input issue |
| Unknown tag according to business rules | Business decision, likely rejected or deferred |
| Database unavailable | Infrastructure error |
| Offline device | Runtime condition, may lead to pending synchronization |
| Missing business rule | Engineering blocker requiring escalation |

Implementation shall keep these categories separate.

Do not model every non-success outcome as an exception.

### 7.7 Testing Philosophy

Tests shall verify the owning responsibility.

Business decision tests:

- verify facts, rules and state produce expected outcomes,
- avoid UI and infrastructure dependencies,
- include accepted, rejected, ignored, deferred and pending synchronization cases where defined.

Application tests:

- verify orchestration,
- verify correct delegation,
- verify error and result handling,
- avoid redefining business rules.

Infrastructure tests:

- verify mapping,
- verify storage behavior,
- verify synchronization transport behavior,
- avoid business interpretation.

UI tests:

- verify input capture,
- verify presentation of outcomes,
- verify user flow,
- avoid business decision logic.

### 7.8 Naming Philosophy

Names shall reflect responsibility.

Good names reduce architecture ambiguity.

Guidance:

- facts describe what happened,
- commands describe requested actions,
- decisions describe evaluated outcomes,
- events describe business-significant results after evaluation,
- adapters describe technical integration,
- use cases describe application orchestration.

Avoid names that mix responsibility.

Bad example:

```text
SaveAndApproveScanService
```

This combines persistence and business decision.

Better separation:

```text
SubmitScanFactUseCase
EvaluateScanDecision
PersistDecisionResult
```

Exact names may evolve with repository implementation, but responsibility separation shall remain visible.

### 7.9 Documentation Philosophy

Documentation shall clarify responsibility and traceability.

Do not duplicate source-of-truth content inside implementation comments.

Use comments when they explain:

- why a boundary exists,
- why a dependency is explicit,
- why a case is deferred,
- which approved artifact constrains behavior,
- why a temporary workaround is safe.

Avoid comments that restate code without explaining responsibility.

---

## 8. Engineering Decision

### 8.1 Decision Statement

TapTim.e implementation shall follow a repository-evidence-first, boundary-preserving implementation philosophy.

Developers shall implement approved decisions, preserve responsibility boundaries, avoid assumptions, keep business meaning in the approved business decision boundary and produce traceable evidence for implementation work.

### 8.2 Rationale

TapTim.e depends on clear separation between product intent, architecture, feature behavior, technical specification and implementation.

Without a shared implementation philosophy, developers may produce code that works locally but violates the approved engineering model.

Common risks include:

- business rules leaking into UI,
- persistence becoming a hidden decision engine,
- infrastructure determining product meaning,
- duplicate concepts emerging across layers,
- tests verifying presentation instead of business correctness,
- missing decisions being silently invented,
- implementation convenience overriding architecture.

The implementation philosophy reduces these risks by defining how developers think and act before writing code.

### 8.3 Consequences

Implementation work shall be slower when repository evidence is missing, because missing evidence must be escalated rather than guessed.

This is intentional.

The cost of escalation is lower than the cost of silently embedding incorrect business or architecture decisions into source code.

Developers gain freedom inside implementation boundaries, but not across product, architecture or feature boundaries.

Review becomes more reliable because code can be checked against explicit responsibilities and source-of-truth artifacts.

### 8.4 Non-Decisions

This chapter does not decide:

- final codebase folder structure,
- concrete framework patterns,
- exact class or function names,
- database schema,
- synchronization protocol,
- UI flow,
- feature behavior,
- deployment model,
- runtime component ownership beyond approved architecture.

Those topics belong to existing or future approved artifacts and later EP-008 chapters where appropriate.

---

## 9. Summary

TapTim.e developers shall implement from repository evidence, not assumptions.

They shall continue existing work, extend before creating, preserve responsibility boundaries and escalate missing decisions instead of inventing them.

EP-008 provides implementation guidance, but it does not replace Product Vision, ADRs, TTAP, Feature Blueprints, Technical Specifications, Development Tasks, EOM-001 or AGR-001.

The central implementation mindset is:

```text
Find the approved responsibility.
Implement the smallest correct change.
Test the owning boundary.
Document the evidence.
Escalate missing decisions.
```

This philosophy applies to every later chapter of the Developer Implementation Manual and to every implementation step in TapTim.e.

---

## 10. Implemented Reality (EP-008 Synchronization Update)

This section documents where the philosophy above has already been applied in committed code, so the guidance in Sections 5–7 is no longer only illustrative. Evidence verified 2026-07-03 against `main` commit `78be5c9` (Development Sprint 002) and `159d7f9` (Development Sprint 001).

### 10.1 "Escalate Instead of Guessing" Was Implemented, Not Just Illustrated

Section 6.2 of this chapter uses "duplicate NFC scans within a short time window" as an example of a rule that must be escalated rather than guessed. Development Sprint 002 (`ADO/02_Development/Development_Sprint_002_Plan.md`) encountered exactly this situation as Finding F-01 (duplicate-scan/toggle mechanism undefined) and implemented the escalation as a typed result rather than an invented rule:

`packages/core/src/business/BusinessEngineDecision.ts` defines:

```ts
export type BusinessEngineDecision =
  | { readonly status: 'time_entry_started'; readonly timeEntry: TimeEntry; readonly event: TimeEntryStarted }
  | { readonly status: 'escalation_required'; readonly reason: 'duplicate_scan_rule_undefined'; readonly workEvent: WorkEvent };
```

`packages/core/src/business/BusinessEngine.ts` returns the `escalation_required` branch whenever an active `TimeEntry` already exists for the target, instead of guessing whether the second scan should stop, be ignored, or be deferred:

```ts
if (activeTimeEntryForTarget !== null) {
  return { status: 'escalation_required', reason: 'duplicate_scan_rule_undefined', workEvent };
}
```

This is confirmed by test intent in `packages/core/tests/business/BusinessEngine.test.ts` ("returns an explicit escalation, never a guessed stop/duplicate/defer outcome, when an active TimeEntry already exists") and in `packages/core/tests/application/NfcScanToTimeEntryPipeline.test.ts` ("does not create a second active TimeEntry for a second scan of the same target (escalation, never a guess)"). No stop/duplicate/defer behavior has been invented; DT-005's Acceptance Criterion "Tests cover start, stop and pending outcomes" is therefore only partially satisfied, exactly as recorded in `EP-007_Development_Tasks.md` under DT-005.

### 10.2 "Keep Decisions Deterministic" (§5.8) Was Implemented via Explicit Dependency Injection

Section 5.8 requires avoiding hidden dependencies such as an implicit system clock and requires that time be passed explicitly. `WorkEventFactory` and `BusinessEngine` (`packages/core/src/business/WorkEventFactory.ts`, `BusinessEngine.ts`) both implement this literally: their ID and clock sources are constructor parameters with real defaults (`generateId`, `new Date().toISOString()`), overridable in tests:

```ts
constructor(
  private readonly newTimeEntryId: () => TimeEntryId = () => TimeEntryId(generateId()),
  private readonly now: () => Timestamp = () => createTimestamp(new Date().toISOString()),
) {}
```

Tests supply fixed functions (e.g. `() => TimeEntryId('time-entry-1')`), which is what makes the `BusinessEngine.test.ts` determinism test ("same WorkEvent and same active-TimeEntry state always produce the same decision") possible without mocking a global clock.

### 10.3 Traceability in Practice

Sprint 002 source comments follow the traceability guidance of Section 5.5/7.9: e.g. `BusinessEngineDecision.ts` states in-file why the escalation branch exists ("intentionally not a stop/duplicate/defer decision... because the rule that would decide it (Finding F-01...) is not yet defined by repository evidence"), rather than leaving the reason only in a commit message or plan document.

### 10.4 The Offline Queue Confirms the Business Meaning Boundary (Development Sprint 003)

Section 5.7 states that no infrastructure component may determine business meaning; it may only capture, persist, synchronize or display. Development Sprint 003 (DT-007, `ADO/02_Development/Development_Sprint_003_Plan.md`) implemented the `OfflineQueue` in exact accordance with this rule rather than as an exception to it.

`packages/core/src/application/WorkEventCreationService.ts` enqueues every `WorkEvent` together with whatever `BusinessEngineDecision` the Business Engine already produced, unchanged:

```ts
const queueResult = this.offlineQueue.enqueue({
  workEvent,
  decision,
  syncState: 'pending',
  queuedAt: this.now(),
});
```

The queue is handed the decision after it has been made; it never calls `businessEngine.evaluate` itself and never branches on `decision.status` to decide what to store. Both the `time_entry_started` and `escalation_required` branches are queued identically. This is the same discipline as Section 10.1's escalation example: the queue does not attempt to interpret or improve on a decision it was not asked to make.

A common mistake this guards against: it would have been technically easy to make `OfflineQueue.enqueue` skip escalated records, or to have it decide retry priority based on business outcome. Either choice would silently move business interpretation into infrastructure. Sprint 003 avoided this by keeping `EnqueueResult` limited to `'enqueued' | 'already_queued'` — a storage-level outcome only, never a business one.

### 10.5 The Synchronization Service Keeps the Same Discipline (Development Sprint 004)

Development Sprint 004 (DT-008, `ADO/02_Development/Development_Sprint_004_Plan.md`) added a second component that touches every queued record — `SynchronizationService` — and it was built under the identical constraint as the queue itself: it may forward `QueuedWorkEventRecord.decision`, but it may never read it to decide anything. `packages/core/tests/application/SynchronizationService.test.ts` makes this an explicit, named test case rather than an implicit assumption: "does not read or branch on `QueuedWorkEventRecord.decision` for anything other than forwarding it." This is Section 5.7 applied a second time to a second infrastructure-adjacent component, showing the rule generalizes rather than being a one-off fix for the queue.

Sprint 004 also reinforces Section 5.10 ("Escalate Instead of Guessing") in a new way: `SynchronizationResult` (`packages/core/src/application/SynchronizationResult.ts`) distinguishes `'retryable_failure'` from `'conflict'` as separate, typed outcomes rather than collapsing them into one "sync failed" case. A conflict (the remote record was already modified) is a fundamentally different situation from a transient network problem, and guessing that they can be treated identically would hide exactly the kind of ambiguity FB-001's Edge Case "Synchronization conflict after offline capture" calls out by name. `SynchronizationService.synchronizePending()` keeps a retryable failure's record `pending` (eligible for a future attempt) while a conflict is marked `failed` and reported distinctly via `WorkEventSyncFailed.outcome` — the code makes the same distinction the architecture requires, rather than picking whichever branch was easier to implement.

### 10.6 The Mobile Foundation Preserves the Same Boundary (Development Sprint 006)

Section 5.7's rule ("no infrastructure/UI component may determine business meaning") now applies to a UI runtime for the first time. `apps/mobile/src/screens/ScanScreen.tsx` calls the existing DT-011 composition root's `pipeline.scan(payload)` and `pipeline.synchronizePending('success')` directly and unmodified — it contains no branching on `BusinessEngineDecision`, `ScanPipelineOutcome`, or any domain event, and renders only the string lines `ScanResultPresenter` already produced. Verified by direct inspection: `apps/mobile/src/` contains exactly two files (`navigation/AppNavigator.tsx`, `screens/ScanScreen.tsx`), neither of which imports from `@taptime/core`'s `business/`, `domain/`, or `application/` subpaths — only the package's public root export. This is the same discipline Sections 10.4/10.5 describe for the Offline Queue and Synchronization Service, now demonstrated to hold across a process/runtime boundary (Node/Vitest to Expo/Hermes) as well as across module boundaries within one process.

A related risk was found, not guessed around: `runScan.ts`'s CLI-trigger guard read `process.argv[1]` unconditionally, which the Expo/Hermes runtime does not define the way Node does. Rather than working around this from inside `apps/mobile` (which would have required either duplicating composition-root logic or adding a mobile-specific branch to it), the guard itself was hardened in `packages/core` so the same, single `buildScanDemoPipeline` remains the only implementation for both the CLI and the mobile screen — a direct application of "Extend Before Create" to a cross-runtime compatibility problem.

### 10.7 Authentication Extends the Same Boundary, Not a New One (Development Sprint 007)

Development Sprint 007 (DT-013) introduces the repository's first authentication-adjacent component, and it was built under the identical constraint every prior infrastructure-adjacent component has followed since Section 10.1: it may establish a `CallerContext`, but it may never decide anything about assignments, WorkEvents, or business outcomes. `packages/core/src/application/SessionService.ts`'s `signIn(credentials)` forwards `AuthenticationGateway.authenticate(credentials)`'s result exactly as given — a dedicated test (`SessionService.test.ts`) asserts it "does not itself decide anything beyond what the gateway returned," mirroring `SynchronizationService.test.ts`'s equivalent assertion (Section 10.5). `AuthenticationResult` (`{ status: 'authenticated'; userId; organizationId } | { status: 'rejected'; reason: 'invalid_credentials' }`) is the same explicit-typed-result idiom as `SynchronizationResult`/`EnqueueResult`/`BusinessEngineDecision`, applied a fourth time.

The more significant proof is `SessionDerivedCallerPipeline.test.ts`: it demonstrates that a `CallerContext` produced by `SessionService`/`FakeAuthenticationGateway` reaches exactly the same `AssignmentValidator` outcomes — both the accepted path and the pre-existing `employee_not_authenticated` rejection — as the Sprint 001-era hard-coded `authenticatedCaller(...)` fixture. `AssignmentValidator` itself was not touched to make this true; the whole point of `CallerContext`'s Sprint 001 design ("the pipeline receives caller identity, it does not establish one") was that a real identity-establishing mechanism could be substituted later without altering the business rule that consumes it. Sprint 007 is the first sprint to actually exercise that seam, six sprints after it was built, and it held without modification — a direct, delayed confirmation that Section 5.7's boundary was drawn in the right place from the start.

Development Sprint 007's own scope was narrowed by explicit Human Architect instruction to `packages/core` only (`AuthenticationGateway`, `FakeAuthenticationGateway`, `SessionService`, `AuthenticationResult`); the mobile Login screen and composition-root wiring that would let a real user actually reach this seam through `apps/mobile` were not built this session (Chapter 00 Section 10.9, Resolved). This chapter documents the boundary discipline of what was built, not a claim that a user can yet sign in through the app.

### 10.8 The Mobile Login Screen Introduces No New Decisions Either (Development Sprint 008)

Development Sprint 008 (DT-014) completes the wiring Section 10.7 anticipated, and it was held to the identical constraint: `apps/mobile/src/screens/LoginScreen.tsx` calls `SessionService.signIn(...)` and `toCallerContext(...)` exactly as they already existed, and forwards the result — an accepted `CallerContext` or the gateway's `invalid_credentials` reason — without adding a single new business rule about what makes a credential valid. Verified by direct inspection: `LoginScreen`'s only `@taptime/core` imports are `SessionService`, `toCallerContext`, `FakeAuthenticationGateway`, and the `CallerContext` type — the same public-root-export-only pattern `ScanScreen` already established in Section 10.6, extended to a second screen rather than given a different rule.

The more significant proof, again, is at the composition root, not the UI: `buildScanDemoPipeline`'s `scan()` method gained an optional `caller: CallerContext` parameter, defaulting to the pre-existing Sprint 005 hard-coded fixture when omitted (`packages/core/src/cli/runScan.ts`). This is an additive change to a function signature, not a rewrite — the existing CLI and every pre-existing test calling `scan(payload)` with one argument continue to behave identically, confirmed by a dedicated test (`runScan.callerOverride.test.ts`) alongside all 94 pre-existing tests remaining green. `AssignmentValidator`'s `employee_not_authenticated` rejection — the same check exercised by Sprint 007's `SessionDerivedCallerPipeline.test.ts` — is now reachable from a real UI action for the first time, six sprints after DT-003 first implemented it, without a single line of that check ever needing to change. This is the clearest evidence yet that Sprint 001's original design choice — "the pipeline receives caller identity, it does not establish one" — correctly anticipated every later sprint that would eventually establish one.

### 10.9 Classifying an Error Is Not the Same as Deciding One (Development Sprint 009)

Section 5.7's rule — no infrastructure/presentation-adjacent component may determine business meaning — is tested a fifth time by Development Sprint 009 (DT-009), and in a new direction: rather than *forwarding* an already-made decision (as the queue, synchronization service, and session service all do), DT-009's five classification functions (`classifyScanPipelineOutcome`, `classifyAssignmentValidationResult`, `classifyBusinessEngineDecision`, `classifySynchronizationResult`, `classifyAuthenticationResult`) *read* an already-made decision and attach a label to it, without ever feeding back into the decision itself. Each function is pure — it accepts an existing result value and returns an `ErrorCategory` (or `null` for a non-error outcome) — and none of them are called from anywhere inside `AssignmentResolver`, `AssignmentValidator`, `BusinessEngine`, `WorkEventFactory`, `SynchronizationService`, or `SessionService`; all five of those files are verified byte-for-byte unchanged by this sprint. This is an important variant of "no infrastructure component may determine business meaning": classification here is not infrastructure *forwarding* a business decision (Sections 10.4/10.5/10.7's pattern) but a documentation/observability layer *reading* one, and the same discipline applies — a classification function that changed behavior based on category (e.g. silently retrying a `'retryable'` outcome) would have crossed from observability into business/application logic, which DT-009's own Out of Scope explicitly forbids.

The `employee_not_authenticated`/`invalid_credentials` -> `'recoverable'` and `employee_lacks_organization_access`/`missing_assignment_target`/`assignment_target_disabled` -> `'fatal'` split (`classifyAssignmentValidationResult.ts`, `classifyAuthenticationResult.ts`) is a genuine interpretive judgment call — TTAP-001 names the five categories without further defining them — and it is documented explicitly in each function's own code comments (the distinguishing test: can the scanning employee's own next action resolve this, or does it require an administrator?) rather than being silently assumed. This follows Section 5.10's "Escalate Instead of Guessing" in its written form: the reasoning is recorded, not hidden, even though no case was ambiguous enough to require an actual escalation this sprint.

### 10.10 A Storage Technology Swap Is Not a Business Change, and a Discovered Constraint Is Not Guessed Around (Development Sprint 010)

Section 5.4 ("Extend Before Create") and Section 5.7 ("Business Meaning Belongs to the Business Decision Boundary") are both tested by Development Sprint 010 (DT-015) in combination. `FileOfflineQueue`, `FileWorkEventRepository`, and `FileTimeEntryRepository` (`packages/core/src/infrastructure/persistence/`) implement the exact same `OfflineQueue`/`WorkEventRepository`/`TimeEntryRepository` ports their in-memory counterparts already implement — no port was widened, narrowed, or given a new method to accommodate durability, and none of the three new adapters read or branch on a `BusinessEngineDecision`, `AssignmentValidationResult`, or any other business-decision value; they persist and retrieve exactly what they are given, mirroring Sections 10.4/10.5's discipline for `InMemoryOfflineQueue`/`SynchronizationService` a third and fourth time, now for a durable storage technology rather than an in-memory or fake one. This is the clearest demonstration yet of ADR-0006's "any persistence technology is infrastructure": swapping an adapter's storage technology from a `Map` to a JSON file on disk required zero changes to any business/application file, confirmed by `git diff` showing `AssignmentResolver`, `AssignmentValidator`, `BusinessEngine`, `WorkEventFactory`, `SynchronizationService`, and `SessionService` byte-for-byte unchanged.

Section 5.10 ("Escalate Instead of Guessing") and Section 5.2 ("Reality Has Priority Over Architecture") were both applied when the plan's literal wording ("an optional configuration selecting durable file-based storage, with a configurable directory/file path") turned out to be unbuildable as written: giving `buildScanDemoPipeline` (in `runScan.ts`) a raw directory-string parameter would require that file to import Node's `fs`/`path` modules, and because `packages/core/src/index.ts`'s barrel export makes `runScan.ts` part of `apps/mobile`'s static import graph (Section 10.6's Metro-compatibility precedent), this broke `apps/mobile`'s bundling entirely — a hard failure, not a style preference. Rather than silently working around this (for example, by duplicating `buildScanDemoPipeline`'s wiring logic inside a mobile-only file, which Section 5.3 "Continue, Never Recreate" would forbid), the discovered constraint was documented in the Development Task's own Implementation Notes and resolved by keeping `runScan.ts` typed only against the port interfaces (erased at compile time, so no runtime `fs`/`path` import is needed there) and moving the actual directory-to-adapter construction into a new, Node-only `runScanCli.ts`. `npx expo export --platform ios` was re-run and re-verified successful immediately after the fix, following the same "prove it before building further" discipline Section 10.6 established for the original `process.argv` guard.

### 10.11 A Real-Hardware Adapter Swap Confirms the Same Boundary a Sixth Time, and a Priority Question Is Escalated Rather Than Guessed (Development Sprint 011)

Section 5.7 ("Business Meaning Belongs to the Business Decision Boundary") and Section 5.4 ("Extend Before Create") are both tested once more by Development Sprint 011 (DT-016), and once more they hold without modification. `RnNfcScanAdapter` (`apps/mobile/src/nfc/RnNfcScanAdapter.ts`) is a third implementation of the unchanged `NfcScanPort` interface — after `FakeNfcScanAdapter` (Development Sprint 001) and `CliNfcScanAdapter` (Development Sprint 005) — and, like Section 10.10's file-based persistence adapters, it required zero changes to any business/application file: `AssignmentResolver`, `AssignmentValidator`, `BusinessEngine`, `WorkEventFactory`, `SynchronizationService`, `SessionService`, and `NfcScanApplicationService` are all confirmed byte-for-byte unchanged by `git diff`. The adapter's own additional `checkCapability()` method (not part of `NfcScanPort`, exactly as `CliNfcScanAdapter.setInput()` is also additional-beyond-the-port) surfaces "NFC not available"/"NFC disabled" as narrowly-scoped capability states, not new `AssignmentResolver`/`AssignmentValidator` business rejection reasons — the same discipline Section 10.9 already applied to error classification, now applied to a hardware-capability boundary instead of a result-classification one.

This sprint also tested Section 5.10 ("Escalate Instead of Guessing") in a new way: rather than an implementation choice, the question this time was *sequencing*. Repository evidence (`Product_Readiness_Assessment.md` Section 11.1) had identified Organization Management as the higher-ranked Product Readiness priority for this sprint to target. Development Sprint 011's own plan (`Development_Sprint_011_Plan.md` Section 3) evaluated this directly and declined to implement Organization Management anyway, because no Feature Blueprint exists for it — implementing it would have required either inventing Blueprint-level product decisions without Human Architect authority, or bypassing `Feature_Blueprint_Standard.md`'s explicit rule ("No code is written before the relevant Feature Blueprint has been approved"), both of which this task correctly refused. This is the same discipline as Finding F-01 and the backend technology decision before it: when a genuine product decision blocks the most obviously "correct" next step, the decision is escalated and a different, already-specified, unblocked item is implemented instead — not guessed at, and not skipped past.

### 10.12 Building a New Domain From Nothing Still Follows the Same Idioms, Not New Ones (Development Sprint 012)

Development Sprint 012 (DT-017) is the first Development Task to build a domain object, a repository port, an in-memory adapter, and an Application Service with no pre-existing Organization-related code to extend — a different starting condition from DT-015/DT-016 (Section 10.10/10.11), which each swapped or added an adapter behind a port TS-001 had already named. Section 5.4 ("Extend Before Create") therefore applies here one level down: rather than extending an existing port, DT-017 extends existing *idioms*. `Organization` follows `Customer`'s plain-interface shape; `InMemoryOrganizationRepository` follows `InMemoryCustomerRepository`'s constructor-seeded pattern byte-for-byte (verified by direct comparison); `OrganizationCreated` follows `WorkEventCreated`'s constructor-function event idiom; `OrganizationManagementService.createOrganization(name)` follows `WorkEventFactory`/`BusinessEngine`'s injectable-dependency constructor pattern for deterministic id generation, and — like `NfcScanApplicationService` — orchestrates but does not interpret: it owns no business rule beyond "an Organization can always be created" (TS-002 Decision 1), with no name validation and no uniqueness precondition. `BusinessEngine`, `AssignmentResolver`, `AssignmentValidator`, `WorkEventFactory`, `NfcScanApplicationService`, `CallerContext`, `OfflineQueue`, and `SynchronizationService` are all confirmed byte-for-byte unchanged by `git diff`, the same verification discipline every prior sprint's philosophy note has applied.

This sprint also confirms Section 5.10 ("Escalate Instead of Guessing") holds for scope boundaries, not only technology or sequencing choices: TS-002 named ten Development Tasks (DT-017–DT-026) for the full Organization Management foundation, and Development Sprint 012's own plan deliberately implemented only the first of them, rather than absorbing adjacent, already-specified work (Membership, Administration) into the same sprint because it was "close enough." The Membership-granting bootstrap question TS-002 surfaced remains explicitly unresolved — DT-017 introduces no `Membership` code at all, so there is nothing here that could silently answer it.

### 10.13 An Association's Own Identity Is Still Just Extending an Idiom, and Proving an Absence Is Stronger Than Asserting One (Development Sprint 013)

Development Sprint 013 (DT-018) extends Section 10.12's "building a new domain from nothing still follows the same idioms" finding one level further: `Membership` is the first domain object built during Organization Management that carries its own identity (`MembershipId`) while also referencing two other identifiers (`organizationId: OrganizationId`, `userId: UserId`) as plain fields — not a redesign, but a direct reuse of the precedent ADR-0002 already established for `NfcAssignment` ("an association object gets its own identity, not just a compound key of the things it associates"). `MembershipRole` follows the existing string-literal-union idiom (`AssignmentTarget.targetType`, `SyncState`, `ErrorCategory`); `InMemoryMembershipRepository`, `MembershipGranted`, and `MembershipService`'s injectable deterministic id generation each follow DT-017's own precedent byte-for-byte, now the nearer template than the original DT-001–DT-016 idioms it was itself once derived from — a sign the pattern is stabilizing, not drifting, as Organization Management's task sequence continues.

This sprint also demonstrates a stronger form of Section 5.10's "Escalate Instead of Guessing" discipline: rather than leaving "`MembershipService` performs no authorization check" as an inference a reader would have to draw from what DT-018's Acceptance Criteria simply don't mention, this sprint's own tests directly assert the absence — one test grants a Membership against an `organizationId` with no known Organization and confirms it still succeeds; another grants a second Membership for the same Organization and confirms no special-casing occurs for "the first one." TS-002's own Sequence Diagram 2 shows `MembershipService` delegating to `MembershipAuthorizationValidator`; that component does not exist yet (DT-019), so building `MembershipService` to call it was never an option — but proving the *absence* of that call, rather than merely not adding it, is a more rigorous application of the same principle Section 10.9 first established for error classification ("the reasoning is recorded, not hidden").

### 10.14 "Structurally Identical" Means Shape and Contract, Not a Copied Constructor (Development Sprint 014)

Development Sprint 014 (DT-019) tests a nuance of Section 5.4 ("Extend Before Create") that no prior Organization Management sprint had to confront: TS-002 describes `MembershipAuthorizationValidator` as "structurally identical in shape to the existing `AssignmentValidator`," and `AssignmentValidator` is constructed with a `CustomerRepository` dependency that it calls inside its own `validate()` method. A literal reading of "structurally identical" could have produced a `MembershipAuthorizationValidator` with its own repository dependency, mirroring `AssignmentValidator`'s constructor exactly. DT-019's own Acceptance Criteria forbid this directly: "no dependency on any repository directly inside its own decision logic (the Membership is passed in, exactly as `AssignmentValidator.validate()` receives its inputs already resolved)." The implementation follows this precisely — `MembershipAuthorizationValidator` takes no constructor argument at all; its `authorize(membership, organizationId)` method receives both inputs already resolved by whatever future caller invokes it. "Structurally identical" therefore means the *shape* (a class with one evaluation method) and the *contract* (pure, deterministic, no side effects, an accepted/rejected result), not every implementation detail of the nearest existing precedent — a distinction worth carrying into any future Business-area component built "alongside" an existing one.

This sprint also continues Section 10.13's "proving an absence is stronger than asserting one" discipline, applied to a new component's very first sprint rather than to a service's boundary: two of the six tests exist purely to prove properties the Acceptance Criteria imply but do not explicitly demand — that the validator is deterministic (the same inputs always produce the same result, confirming purity without needing to inspect the implementation), and that no first-Administrator bootstrap special-casing exists (`membership_not_found` is rejected unconditionally, with no branch that treats "no Membership yet" as an implicit acceptance for a hypothetical first grant). Both properties could have been left as reasonable inferences from a four-line, four-branch method; proving them directly keeps that inference checkable by a Review Agent rather than resting on trust in the implementation's apparent simplicity.

### 10.15 Bundling Three Development Tasks Is Safe Exactly When Verification Can Stay Independent (Development Sprint 015)

Development Sprint 015 (DT-020, DT-021, DT-022) is the first Development Sprint in this engagement to bundle more than one Development Task, and it tests a boundary none of Sections 10.12–10.14 had reason to confront: when is bundling itself the correct application of "smallest safe Development Sprint," rather than a relaxation of it? The answer this sprint demonstrates is structural, not a judgment call made in the abstract: `CustomerRepository`/`InMemoryCustomerRepository`, `NfcTagRepository`/`InMemoryNfcTagRepository`, and `NfcAssignmentRepository`/`InMemoryNfcAssignmentRepository` are three completely disjoint file pairs, each task's own `EP-007_Development_Tasks.md` Dependencies line states independence from the other two, and this closure's own verification (Section 4 of `Development_Sprint_015_Closure.md`) confirmed each task's Acceptance Criteria could be checked in complete isolation from the other two, using `git diff --stat` to show zero file overlap. This is the same underlying test Section 5.9 (Composability) and Section 5.4 (Extend Before Create) already apply to individual components, now applied one level up, to sprint-scoping itself: bundling is safe precisely when it does not create any verification dependency between the bundled tasks, and unsafe the moment it would (as DT-023–DT-025 — which share one class, `OrganizationAdministrationService` — will be, per `Development_Sprint_015_Plan.md` Section 5's reasoning for why DT-023 was deliberately excluded from this bundle).

This sprint also extends Section 10.12's "extending idioms, not creating new ones" finding to a case where the idiom being extended was itself already present at Development Sprint 001, not one introduced by a recent sibling sprint: `InMemoryCustomerRepository`, `InMemoryNfcTagRepository`, and `InMemoryNfcAssignmentRepository` all predate Organization Management entirely, and DT-020/021/022's task was to bring their constructor pattern in line with `InMemoryOrganizationRepository`'s newer defensive-copy convention (Section 10.12's own precedent) rather than to invent a write-method shape from nothing. The disclosed choice to make this upgrade — not explicitly named as required by any single Acceptance Criterion's prose, but implied by each task's own "does not mutate the input array" test requirement — is a small, evidence-grounded application of Section 5.4 in the direction of consistency across a repository's *entire* history, not just its most recent additions.
