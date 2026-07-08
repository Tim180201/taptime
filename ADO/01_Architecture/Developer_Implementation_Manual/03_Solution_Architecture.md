# EP-008 – Developer Implementation Manual

## Chapter 03 – Solution Architecture

Status: Draft  
Document ID: EP-008-CH03  
Epic: EP-008  
Owner: Technical Lead  
Approval Authority: Human Architect  
Repository Scope: TapTim.e ADO  
Integration Status: Branch integration for Human Architect review  
Related Artifacts: TTAP-001, ADRs, Product Vision, Feature Blueprints, Technical Specifications, Development Task Profile, Decision Log, AVR-001

---

## 1. Purpose

This chapter explains how developers shall implement the approved TapTim.e solution architecture without redefining it.

It translates the existing technical architecture into practical implementation guidance. It does not replace TTAP-001, ADRs, Feature Blueprints or Technical Specifications. Those artifacts remain the source of truth for architecture, decisions, feature behavior and feature-specific implementation.

Chapter 03 answers the developer-facing question:

```text
How do I structure software so it preserves the approved TapTim.e architecture?
```

The chapter focuses on responsibilities, boundaries, dependency direction, communication flow, module placement and reviewable implementation patterns.

A developer shall use this chapter to decide where implementation logic belongs and where it does not belong.

---

## 2. Responsibilities

### 2.1 Solution Architecture Guidance Responsibility

This chapter is responsible for implementation guidance around solution structure.

It may explain:

- how architectural responsibilities map to implementation areas,
- which dependency directions are safe,
- how facts, decisions and events move through the solution,
- how to avoid responsibility leakage,
- how to test architectural boundaries,
- how to recognize implementation anti-patterns.

It may not define:

- new architecture,
- new runtime responsibilities,
- new feature behavior,
- new ADRs,
- final technology choices,
- final deployment topology,
- final source folder structure unless approved elsewhere.

### 2.2 Developer Responsibility

Developers shall preserve architectural responsibility boundaries while implementing assigned work.

A developer shall:

- identify which architecture responsibility owns the behavior,
- place code where that responsibility belongs,
- keep dependencies explicit,
- avoid cross-layer shortcuts,
- test behavior at the owning boundary,
- document deviations or missing architecture guidance.

A developer shall not move responsibility because another layer is easier to access.

### 2.3 Architecture Responsibility Areas

TapTim.e implementation shall be understood as responsibility areas rather than only technical layers.

| Area | Implementation Responsibility |
|---|---|
| Mobile / UI | Captures user/device input and presents outcomes. |
| Application | Orchestrates use cases and delegates to owning responsibilities. |
| Business Engine | Interprets facts, evaluates rules and produces decisions/events. |
| Domain | Provides stable domain concepts, invariants and terminology. |
| Infrastructure | Persists, transports, synchronizes and integrates data. |
| Shared | Contains stable cross-cutting utilities only when responsibility-neutral. |

Responsibility ownership matters more than folder names.

---

## 3. Diagram

### 3.1 Solution Responsibility Map

```text
Mobile / UI
  -> Application
  -> Business Engine
  -> Domain

Infrastructure
  -> supports Application / Business Engine through ports
  -> does not own business meaning

Domain
  -> remains independent of UI, infrastructure and runtime transport
```

### 3.2 Fact-to-Decision Flow

```text
Fact Captured
  -> Application Use Case
  -> Business Engine Evaluation
  -> Decision Result
  -> Business Event
  -> Persistence / Synchronization / Presentation
```

Facts enter the system before business meaning is assigned. Business events are produced only after rule evaluation.

### 3.3 Dependency Direction

```text
UI depends on Application contracts
Application depends on Business and Domain contracts
Business Engine depends on Domain concepts
Infrastructure implements technical ports
Domain does not depend on outer layers
```

The practical rule is:

```text
Dependencies may point inward toward stable responsibilities, not outward toward technical convenience.
```

---

## 4. Dependencies

### 4.1 TTAP Dependency

TTAP remains the source of truth for technical architecture. This chapter only explains how developers apply that architecture in implementation.

When this chapter appears incomplete, developers shall refer back to TTAP and related ADRs instead of inventing missing architecture.

### 4.2 ADR Dependency

Architecture decisions are recorded in ADRs and indexed by the Decision Log. Developers shall inspect relevant ADRs before changing solution structure, runtime boundaries, event handling, offline behavior, technology baseline or domain ownership.

### 4.3 Feature Blueprint and Technical Specification Dependency

Feature Blueprints define feature behavior. Technical Specifications define feature-specific implementation detail.

Solution architecture guidance shall not alter those artifacts. It only helps developers place implementation responsibilities correctly.

### 4.4 Existing Code Dependency

Existing code defines current repository reality. Developers shall inspect it before changing structure, but existing code does not override approved architecture. If the codebase conflicts with approved architecture, document the gap and escalate when needed.

---

## 5. Rules

### 5.1 Architecture Is a Responsibility Model

Do not implement architecture as a set of arbitrary folders. Implement it as a set of responsibilities.

A file belongs where its responsibility belongs.

### 5.2 UI Does Not Decide Business Meaning

UI may capture input and display outcomes. It may not decide accepted, rejected, ignored, deferred or pending business outcomes.

### 5.3 Infrastructure Does Not Decide Business Meaning

Infrastructure may persist, load, synchronize and integrate. It may not evaluate business rules or create business meaning.

### 5.4 Application Orchestrates But Does Not Interpret

Application use cases coordinate flow. They may validate input shape, call dependencies and handle results. They shall not become hidden business rule engines.

### 5.5 Business Engine Owns Business Interpretation

Business interpretation, deterministic decisions, decision results and state transitions belong to the approved business decision responsibility.

The Business Engine is an architectural responsibility, not necessarily a deployment unit.

### 5.6 Domain Must Remain Stable

Domain concepts shall be stable, framework-neutral and implementation-independent where possible. Domain should not depend on UI, persistence, synchronization or transport details.

### 5.7 Dependencies Must Be Explicit

Hidden dependencies create hidden architecture.

Avoid:

- global mutable state,
- implicit service lookups,
- direct database reads inside business rules,
- UI state inside business decisions,
- infrastructure callbacks that change business meaning.

### 5.8 Preserve Replaceability

Infrastructure and UI should remain replaceable. If replacing a database, scanner adapter or UI screen changes business behavior, responsibility is misplaced.

### 5.9 Test the Owning Boundary

Test behavior where responsibility lives.

- UI tests verify capture and presentation.
- Application tests verify orchestration.
- Business Engine tests verify decisions.
- Domain tests verify invariants.
- Infrastructure tests verify mapping and integration.

### 5.10 Escalate Architectural Ambiguity

If implementation requires changing ownership, dependency direction or responsibility boundaries, escalate before committing the change as normal implementation.

---

## 6. Examples

### 6.1 Correct NFC Flow

Correct responsibility flow:

```text
NFC Adapter detects tag
  -> Mobile captures NfcTagScanned fact
  -> Application submits fact
  -> Business Engine evaluates fact against rules/state
  -> Decision result is produced
  -> Business event is emitted when applicable
  -> Infrastructure persists/synchronizes result
  -> UI presents outcome
```

Incorrect flow:

```text
NFC screen detects tag
  -> UI checks database
  -> UI decides work session started
  -> UI writes event directly
```

The incorrect flow combines capture, persistence and business decision inside UI.

### 6.2 Correct Infrastructure Role

Correct:

```text
A repository loads previous decision state needed by a business rule and stores the evaluated result.
```

Incorrect:

```text
A repository decides whether a new scan closes an active work session.
```

The second version turns persistence into a business decision engine.

### 6.3 Correct Application Role

Correct:

```text
SubmitScanFactUseCase receives a scan fact, validates required fields, calls the business decision boundary and forwards the result to persistence or presentation handlers.
```

Incorrect:

```text
SubmitScanFactUseCase contains all scan interpretation rules and emits final events without a business decision boundary.
```

Application orchestration must not absorb business interpretation.

### 6.4 Correct Domain Role

Correct:

```text
Domain defines WorkEventId, ScanFact, DecisionResult and invariant-friendly value objects.
```

Incorrect:

```text
Domain imports mobile scanner SDK types or database entities.
```

Domain should not depend on technical adapters.

---

## 7. Implementation Notes

### 7.1 Responsibility Before Folder

Exact folder structure may evolve with repository implementation. The responsibility must remain clear even if folder names change.

Before adding code, ask:

```text
What responsibility does this code own?
Which approved artifact defines that responsibility?
Which layer should depend on it?
Which layer must not know about it?
```

### 7.2 Suggested Responsibility-Oriented Structure

The following structure is guidance, not an independent architecture decision:

```text
domain/
application/
business/
infrastructure/
mobile/
shared/
```

Use approved repository structure when it exists. If this guidance conflicts with repository reality, document the conflict and reconcile through the engineering workflow.

### 7.3 Ports and Adapters

Use ports to keep business/application responsibilities independent from infrastructure details.

Guidance:

- define required capabilities near the responsibility that needs them,
- implement technical details in infrastructure,
- keep adapter mapping explicit,
- avoid leaking database or SDK types into domain/business code.

### 7.4 State and Side Effects

State changes should happen after the owning responsibility has produced a result.

Business decisions should not be hidden as persistence side effects.

Side effects such as persistence, synchronization and notifications should be triggered from explicit decision results or application orchestration.

### 7.5 Error Handling Across Responsibilities

Classify errors by responsibility:

| Situation | Responsibility |
|---|---|
| Invalid input shape | UI/Application validation |
| Business rejection | Business Engine decision |
| Missing previous state | Application/Infrastructure coordination |
| Database unavailable | Infrastructure error |
| Offline device | Runtime condition handled through approved flow |
| Missing rule | Engineering escalation |

Do not collapse every non-success outcome into a technical exception.

### 7.6 Testing Expectations

Architecture is only useful when tests protect boundaries.

Expected test focus:

- business decision tests are deterministic and independent of UI/infrastructure,
- application tests verify delegation and result handling,
- infrastructure tests verify mapping and persistence/sync behavior,
- UI tests verify capture and presentation,
- integration tests verify approved flow across boundaries.

### 7.7 Review Checklist

Before handover, verify:

- responsibility is placed correctly,
- dependency direction is acceptable,
- UI does not contain business meaning,
- infrastructure does not contain business meaning,
- application is not a rule engine,
- domain is free from adapter concerns,
- tests exist at the owning boundary,
- deviations are documented.

---

## 8. Engineering Decision

### 8.1 Decision Statement

TapTim.e implementation shall preserve the approved solution architecture as a responsibility model.

Developers shall implement code according to responsibility ownership, explicit dependency direction and traceable architecture guidance. EP-008 explains implementation handling but does not redefine TTAP or ADR decisions.

### 8.2 Rationale

Solution architecture can fail during implementation when responsibilities are placed according to convenience rather than ownership.

The most important risk is business meaning leaking into UI, infrastructure or persistence. This would make TapTim.e difficult to test, hard to evolve and inconsistent with the approved architecture direction.

A responsibility-based implementation model prevents that drift.

### 8.3 Consequences

Developers must identify ownership before writing code.

Some implementation shortcuts are not allowed even when they are faster.

Tests must verify boundaries, not only end-to-end happy paths.

Architectural ambiguity must be escalated before it becomes permanent source code.

### 8.4 Non-Decisions

This chapter does not decide final folder names, deployment units, framework choices, database schema, synchronization protocol, mobile UI flow or feature-specific business rules.

Those remain governed by TTAP, ADRs, Feature Blueprints, Technical Specifications and future approved engineering artifacts.

---

## 9. Summary

Chapter 03 explains how developers implement TapTim.e solution architecture without redefining it.

The key implementation rule is:

```text
Place behavior where its approved responsibility belongs.
```

UI captures and presents. Application orchestrates. Business Engine interprets facts and produces decisions/events. Domain provides stable concepts. Infrastructure persists, transports and integrates.

The solution must remain traceable, testable and boundary-preserving.

---

## 10. Implemented Reality (Development Sprint 001–004 & 006–014)

This section documents how the responsibility model in Sections 2–7 has actually been implemented in `packages/core`, per Development Sprint 001 (`Development_Sprint_001_Plan.md`, DT-001–DT-003), Development Sprint 002 (`Development_Sprint_002_Plan.md`, DT-004 full scope, DT-005 deterministic branch, DT-006 in-memory slice), Development Sprint 003 (`Development_Sprint_003_Plan.md`, DT-007 Offline Queue) and Development Sprint 004 (`Development_Sprint_004_Plan.md`, DT-008 Synchronization Service). Evidence verified 2026-07-05 against `main` at commit `e19de60` (Sprint 004), preceded by `03c04bd`/`90fdea8` (Sprint 003), `78be5c9` (Sprint 002) and `159d7f9` (Sprint 001). It does not restate FB-001, TS-001, TTAP-001 or ADR content; it explains how that already-approved architecture was built. DT-001–DT-003 and DT-007 are Completed (Review Agent verified, Human Architect approved per `EP-007_Development_Tasks.md`); DT-004/DT-005 (partial)/DT-006 (slice)/DT-008 are implemented and committed to `main` but carry no recorded review/approval yet — DT-008 in particular is explicitly pending an independent Review Agent review at the time of this update (see Chapter 00 Section 10.6) — this distinction applies to every subsection below.

### 10.1 Implementation Boundaries as Built

| Responsibility Area (Section 2.3) | Implemented As | Files |
|---|---|---|
| Mobile / UI | Not yet implemented | — |
| Application | `NfcScanApplicationService`, `WorkEventCreationService`, `SynchronizationService` | `packages/core/src/application/` |
| Business Engine | `AssignmentResolver`, `AssignmentValidator`, `WorkEventFactory`, `BusinessEngine` | `packages/core/src/business/` |
| Domain | `WorkEvent`, `TimeEntry`, facts, events, value objects | `packages/core/src/domain/` |
| Infrastructure | Fake/in-memory adapters and repositories, including the offline queue and synchronization gateway adapters | `packages/core/src/infrastructure/` |
| Ports (seams between the above) | Interfaces only, no framework code | `packages/core/src/ports/` |

No mobile/UI layer exists yet; nothing in Sprint 001–004 required one, since all four sprints stopped at the business-decision-queueing-and-synchronization boundary (DT-001–DT-008), before presentation (DT-009–DT-010 and the mobile client).

### 10.2 Business Pipeline Implementation

The pipeline in Section 3.2 ("Fact Captured -> Application Use Case -> Business Engine Evaluation -> Decision Result -> Business Event -> Persistence/Sync/Presentation") is implemented end-to-end for the "online, first scan" case by `NfcScanApplicationService.submitScan` (DT-001/002/003 seam) calling into `WorkEventCreationService.handleValidatedAssignment` (DT-004/005/006 seam):

```ts
submitScan(caller: CallerContext): ScanPipelineOutcome {
  const captureResult = this.nfcScanPort.scan();
  if (captureResult.status === 'unreadable') {
    return { stage: 'capture', status: 'unreadable' };
  }
  const fact = nfcTagScanned(captureResult.payload, this.now());
  const resolution = this.assignmentResolver.resolve(fact);
  if (resolution.type === 'NfcAssignmentRejected') {
    return { stage: 'resolution', status: 'rejected', reason: resolution.reason };
  }
  const validationResult = this.assignmentValidator.validate(resolution.assignment, caller);
  if (validationResult.status === 'accepted') {
    this.workEventCreationPort.handleValidatedAssignment(validationResult);
  }
  return { stage: 'validation', result: validationResult };
}
```

This is orchestration only (Section 5.4): it calls the resolver and validator, and hands an already-accepted result to the `WorkEventCreationPort` seam; it does not itself decide acceptance, rejection or TimeEntry outcomes. The full pipeline, wired end-to-end with in-memory adapters, is exercised by `packages/core/tests/application/NfcScanToTimeEntryPipeline.test.ts`.

### 10.3 Assignment Resolver Implementation (DT-002)

`packages/core/src/business/AssignmentResolver.ts` resolves an `NfcTagScanned` fact to an `NfcAssignmentResolution` without creating a WorkEvent, matching FB-001 Decision Logic 1 and DT-002's Acceptance Criteria:

```ts
resolve(fact: NfcTagScanned): NfcAssignmentResolution {
  const tag = this.nfcTagRepository.findByPayload(fact.payload);
  if (tag === null) {
    return nfcAssignmentRejected(fact.payload, 'unknown_tag');
  }
  const assignment = this.nfcAssignmentRepository.findActiveByTagId(tag.id);
  if (assignment === null) {
    return nfcAssignmentRejected(fact.payload, 'inactive_assignment');
  }
  return nfcAssignmentResolved(assignment);
}
```

Unknown tags and inactive assignments both produce an explicit rejection result (`nfcAssignmentRejected`) rather than a thrown error or a silent default, keeping rejection a first-class decision result rather than an exception (Section 7.5 of this chapter, and Chapter 01 Section 7.6).

### 10.4 Assignment Validator Implementation (DT-003)

`packages/core/src/business/AssignmentValidator.ts` implements FB-001 Decision Logic 2 (Validate Assignment Target) as an ordered sequence of explicit rejection checks, each with its own reason code, falling through to `accepted` only when all checks pass:

```ts
validate(assignment: NfcAssignment, caller: CallerContext): AssignmentValidationResult {
  if (caller.status !== 'authenticated') {
    return { status: 'rejected', assignment, reason: 'employee_not_authenticated' };
  }
  if (caller.organizationId !== assignment.organizationId) {
    return { status: 'rejected', assignment, reason: 'employee_lacks_organization_access' };
  }
  const target = this.customerRepository.findById(assignment.target.targetId);
  if (target === null) {
    return { status: 'rejected', assignment, reason: 'missing_assignment_target' };
  }
  if (!target.active) {
    return { status: 'rejected', assignment, reason: 'assignment_target_disabled' };
  }
  return { status: 'accepted', assignment, target, caller };
}
```

The `accepted` branch's result type (`AcceptedAssignmentValidationResult`) is the only input `WorkEventFactory.createFromAcceptedAssignment` (DT-004) accepts — see Section 10.6 below for why this closes off invalid inputs at the type level rather than by runtime check.

### 10.5 Business Engine Boundary Implementation (DT-004, DT-005 partial)

Section 5.5 states the Business Engine owns business interpretation and decision results. This is implemented as two collaborating, separately-testable units:

`WorkEventFactory` (DT-004) turns an accepted validation result into a `WorkEvent`, adding traceability fields (`assignmentId`, `nfcTagId`, `triggeredBy`, `occurredAt`) without making any accept/reject decision itself — the type of its input already guarantees the result is accepted:

```ts
createFromAcceptedAssignment(result: AcceptedAssignmentValidationResult): WorkEvent {
  return {
    id: this.newWorkEventId(),
    organizationId: result.assignment.organizationId,
    assignmentId: result.assignment.id,
    nfcTagId: result.assignment.nfcTagId,
    target: result.assignment.target,
    triggeredBy: result.caller.userId,
    occurredAt: this.now(),
  };
}
```

`BusinessEngine` (DT-005, deterministic branch only) then evaluates the resulting `WorkEvent` against explicitly-passed state (`activeTimeEntryForTarget: TimeEntry | null` — Section 5.7's "dependencies must be explicit", not a hidden repository read inside the engine) and produces a `BusinessEngineDecision` — see Section 10.6.

### 10.6 Decision Result Flow

`packages/core/src/business/BusinessEngineDecision.ts` is the Decision Result type referenced generically in Section 3.2:

```ts
export type BusinessEngineDecision =
  | { readonly status: 'time_entry_started'; readonly timeEntry: TimeEntry; readonly event: TimeEntryStarted }
  | { readonly status: 'escalation_required'; readonly reason: 'duplicate_scan_rule_undefined'; readonly workEvent: WorkEvent };
```

Only two branches exist because only two are covered by current repository evidence: no active TimeEntry for the target (deterministically starts one) and an active TimeEntry already existing (escalated, per Finding F-01 — see EP-008 Chapter 01, Section 10.1, for why this is an escalation and not an invented stop/duplicate/defer rule). DT-005's remaining Acceptance Criteria ("stop and pending outcomes") have no corresponding branch yet.

### 10.7 Business Event Generation

Facts (Chapter 01 Section 7.3) and business events are kept as distinct implemented types. `NfcTagScanned` (`domain/facts/`) is a fact; `WorkEventCreated` and `TimeEntryStarted` (`domain/events/`) are business events emitted only after their owning responsibility has produced a result, matching Section 3.2 ("Business events are produced only after rule evaluation"):

```ts
export function workEventCreated(workEvent: WorkEvent): WorkEventCreated {
  return { type: 'WorkEventCreated', workEvent };
}
export function timeEntryStarted(timeEntry: TimeEntry): TimeEntryStarted {
  return { type: 'TimeEntryStarted', timeEntry };
}
```

`WorkEventCreationService` (DT-004/005/006 wiring) is the only place these are constructed and emitted, via an injected `onEvent` callback — persistence and event emission are both driven from the decision result, not from inside the repositories:

```ts
handleValidatedAssignment(result: AcceptedAssignmentValidationResult): void {
  const workEvent = this.workEventFactory.createFromAcceptedAssignment(result);
  this.workEventRepository.save(workEvent);
  this.onEvent(workEventCreated(workEvent));
  const activeTimeEntryForTarget = this.timeEntryRepository.findActiveByTarget(
    workEvent.organizationId, workEvent.target,
  );
  const decision = this.businessEngine.evaluate(workEvent, activeTimeEntryForTarget);
  if (decision.status === 'time_entry_started') {
    this.timeEntryRepository.save(decision.timeEntry);
    this.onEvent(decision.event);
  }
}
```

Note that `WorkEvent` persistence is unconditional (every validated scan is auditable), while `TimeEntry` persistence and the `TimeEntryStarted` event are conditional on the Business Engine's decision — this is the concrete implementation of Section 5.4 ("Application Orchestrates But Does Not Interpret"): the service always records the fact of a WorkEvent, but only acts on a TimeEntry when the Business Engine, not the application service, has decided one should exist.

### 10.8 Testing Strategy as Implemented

The test layout matches Section 7.6's expectations exactly:

- Business Engine decision tests (`packages/core/tests/business/BusinessEngine.test.ts`, `WorkEventFactory.test.ts`, `AssignmentResolver.test.ts`, `AssignmentValidator.test.ts`) are deterministic, pass fixed ID/clock functions, and contain no UI or infrastructure dependency.
- Application orchestration tests (`packages/core/tests/application/WorkEventCreationService.test.ts`, `NfcScanApplicationService.test.ts`) verify delegation and result handling.
- Infrastructure tests (`packages/core/tests/infrastructure/InMemoryWorkEventRepository.test.ts`, `InMemoryTimeEntryRepository.test.ts`, `FakeNfcScanAdapter.test.ts`) verify storage/lookup behavior only.
- One integration test (`NfcScanToTimeEntryPipeline.test.ts`) wires all of the above together with real (in-memory) implementations of every port, verifying the approved flow across boundaries end-to-end, including the escalation case for a repeated scan.

### 10.9 Implementation Examples for Developers

A minimal, correct new use case built on this pipeline should: accept a fact or an already-validated result, not decide on it; call the Business Engine or resolver/validator for interpretation; persist the WorkEvent unconditionally and the business outcome conditionally on the decision; emit business events only from the decision result, never from inside a repository. The `WorkEventCreationService` in Section 10.7 above is the reference example for this shape.

### 10.10 Common Implementation Mistakes Observed to Avoid

Based on how DT-004/DT-005 were deliberately scoped, the following mistakes are called out because they were explicitly designed against:

- Guessing the duplicate-scan/toggle rule instead of escalating it (would have violated Chapter 01 Section 5.10 and silently created undocumented product behavior — avoided via `BusinessEngineDecision`'s `escalation_required` branch).
- Reading `activeTimeEntryForTarget` from inside `BusinessEngine` instead of passing it in explicitly (would have violated Section 5.7 of this chapter — avoided by making it a parameter of `evaluate`).
- Allowing `WorkEventFactory` to accept a rejected or pending validation result (would have required a runtime check; avoided structurally by typing the method parameter as `AcceptedAssignmentValidationResult` only).
- Persisting a `TimeEntry` unconditionally alongside the `WorkEvent` (would have hidden the Business Engine's decision inside a repository call; avoided by making `TimeEntry` persistence conditional on `decision.status === 'time_entry_started'`).

### 10.11 Responsibility Boundaries Confirmed by Implementation

Implementation confirms, rather than contradicts, Section 5: `AssignmentResolver`/`AssignmentValidator`/`WorkEventFactory`/`BusinessEngine` contain all business interpretation for this slice (Section 5.5); `NfcScanApplicationService`/`WorkEventCreationService` only orchestrate and never branch on business meaning themselves beyond dispatching on already-produced decision results (Section 5.4); `InMemory*Repository` classes (Section 5.3) only store/retrieve and perform no rule evaluation, confirmed by inspection of `InMemoryWorkEventRepository.ts` and `InMemoryTimeEntryRepository.ts`, whose only non-trivial logic is a lookup filter (`findActiveByTarget`), not a decision.

### 10.12 Offline Queue Implementation (DT-007)

Development Sprint 003 implements the `OfflineQueue` component named in TS-001's Architecture Flow and TTAP-001's Runtime Architecture, sitting immediately after the repository layer and before the (not-yet-built) Synchronization Service. It exists to satisfy ADR-0004's Implementation Rule ("must not implement core time tracking as a direct online-only database write... must include a local event queue or equivalent offline-capable mechanism") and FB-001's Business Rules that a WorkEvent's local evidence must survive regardless of connectivity. Concretely, it is a small, storage-only seam that every created `WorkEvent` passes through on its way toward eventual synchronization — it does not sit in front of WorkEvent creation, it sits after it (Section 10.7 below).

### 10.13 Queue Responsibilities and Boundaries

The `OfflineQueue`'s responsibility is narrow and explicit: accept a `QueuedWorkEventRecord` (a `WorkEvent`, its `BusinessEngineDecision`, and a `SyncState`), store it, and report whether storing succeeded or the record was already present. It has exactly one non-trivial rule, and that rule is about identity, not business meaning: `packages/core/src/infrastructure/repositories/InMemoryOfflineQueue.ts` keys records by `WorkEvent.id` and returns `{ status: 'already_queued' }` instead of overwriting:

```ts
enqueue(record: QueuedWorkEventRecord): EnqueueResult {
  if (this.records.has(record.workEvent.id)) {
    return { status: 'already_queued', workEventId: record.workEvent.id };
  }
  this.records.set(record.workEvent.id, record);
  return { status: 'enqueued', record };
}
```

What must never move into the queue (Section 5.3/5.5 of this chapter): any interpretation of `BusinessEngineDecision.status`, any retry/backoff/conflict logic (that is DT-008's Synchronization Service responsibility), and any decision about whether a `WorkEvent` "deserves" to be queued. The queue stores what it is given; it does not filter or rank by business outcome (EP-008 Ch01 Section 10.4).

### 10.14 Queue Interfaces

`packages/core/src/ports/OfflineQueue.ts` defines the seam other components depend on, following the same port/adapter pattern as every other DT-001–DT-006 seam (Section 7.3 of this chapter):

```ts
export type EnqueueResult =
  | { readonly status: 'enqueued'; readonly record: QueuedWorkEventRecord }
  | { readonly status: 'already_queued'; readonly workEventId: WorkEventId };

export interface OfflineQueue {
  enqueue(record: QueuedWorkEventRecord): EnqueueResult;
  findPending(): readonly QueuedWorkEventRecord[];
}
```

`findPending()` is the read side of the seam DT-008's future Synchronization Service will consume — it returns only records whose `SyncState` is `'pending'`, filtering out any already-marked `'synchronized'`/`'failed'` records without interpreting why they reached that state.

### 10.15 Queue Persistence Abstraction

`QueuedWorkEventRecord` (`packages/core/src/domain/QueuedWorkEventRecord.ts`) references the existing `WorkEvent` and `BusinessEngineDecision` types by value rather than redefining their fields, and adds only what the queue itself needs — `syncState: SyncState` and `queuedAt: Timestamp`:

```ts
export interface QueuedWorkEventRecord {
  readonly workEvent: WorkEvent;
  readonly decision: BusinessEngineDecision | null;
  readonly syncState: SyncState;
  readonly queuedAt: Timestamp;
}
```

`SyncState` (`packages/core/src/domain/SyncState.ts`) is the Value Object named in TTAP-001's Domain Architecture, implemented as `'pending' | 'synchronized' | 'failed'`. Only `'pending'` is ever produced this sprint; `'synchronized'`/`'failed'` are named now (per TTAP-001) but set only by the future Synchronization Service. `InMemoryOfflineQueue` is, deliberately, the only persistence abstraction implemented — no real database or network client was introduced (Development Sprint 003 Plan, Section 2/7), consistent with ADR-0007 leaving the backend persistence technology undecided.

### 10.16 Business Event Flow After Queueing

`WorkEventCreationService.handleValidatedAssignment` (extended, not replaced, in Development Sprint 003) enqueues after its existing DT-004/005/006 steps and emits `WorkEventQueuedForSync` only when the enqueue actually happened:

```ts
const queueResult = this.offlineQueue.enqueue({
  workEvent, decision, syncState: 'pending', queuedAt: this.now(),
});
if (queueResult.status === 'enqueued') {
  this.onEvent(workEventQueuedForSync(queueResult.record));
}
```

This preserves the event ordering already established in Sprint 001/002 (`WorkEventCreated`, then conditionally `TimeEntryStarted`) and simply adds `WorkEventQueuedForSync` as the last event in the sequence — it does not reorder or replace the earlier events, and it is emitted regardless of whether the Business Engine's decision was `time_entry_started` or `escalation_required` (EP-008 Ch01 Section 10.4). `WorkEventSynchronized`/`WorkEventSyncFailed` (also named in TTAP-001) are not emitted anywhere yet — they belong to DT-008.

### 10.17 Application and Business Engine Responsibilities, Reconfirmed

Sprint 003 changes nothing about who decides what. `WorkEventFactory` and `BusinessEngine` (DT-004/DT-005) are unmodified by this sprint; `WorkEventCreationService` (Application layer, Section 5.4) gained one additional orchestration step — call the queue after the decision is known — without gaining any new decision-making responsibility. The Business Engine still does not know the queue exists; `BusinessEngine.evaluate`'s signature is untouched by DT-007.

### 10.18 Testing Strategy for the Queue

Following the same layering as Section 10.8: `InMemoryOfflineQueue.test.ts` tests the infrastructure boundary only (enqueue, duplicate-enqueue-returns-explicit-result rather than throwing, retrieval of pending-only records) with no business logic involved. `WorkEventCreationService.test.ts` and `NfcScanToTimeEntryPipeline.test.ts` were both extended to assert a `QueuedWorkEventRecord` exists after a full pipeline run for **both** the `time_entry_started` and `escalation_required` branches — proving the queue's behavior does not depend on the Business Engine's decision. One coverage gap is recorded rather than silently left implicit: `QueuedWorkEventRecord.decision` is typed as `BusinessEngineDecision | null`, but no current application code path constructs a record with `decision: null` — that state is exercised only by `InMemoryOfflineQueue.test.ts`'s own standalone fixture, not through the wired service/pipeline tests (recorded as a Known Remaining Risk under DT-007 in `EP-007_Development_Tasks.md`).

### 10.19 Common Implementation Pitfalls (Queue)

- Letting the queue branch on `decision.status` (e.g. to skip escalated records, or to prioritize retries) — this would move business interpretation into infrastructure (Section 5.3/5.5); avoided by treating `decision` as opaque payload.
- Throwing on a duplicate enqueue instead of returning `{ status: 'already_queued' }` — would make a routine, expected condition (a WorkEvent already known to the queue) indistinguishable from a real failure; avoided by using the same explicit-result pattern as `BusinessEngineDecision`'s `escalation_required` branch.
- Overwriting an existing record on a repeated enqueue — would silently discard the original `queuedAt`/state; `InMemoryOfflineQueue` explicitly checks existence before writing.
- Emitting `WorkEventSynchronized`/`WorkEventSyncFailed` early, before a real Synchronization Service exists to justify them — would create events with no producer that actually confirms their meaning; DT-007 emits only `WorkEventQueuedForSync`.
- Introducing a database client "since we're touching persistence anyway" — out of scope per ADR-0007 and the Development Sprint 003 Plan; `InMemoryOfflineQueue` intentionally has no I/O.

### 10.20 Synchronization Service Implementation (DT-008)

Development Sprint 004 implements the `SynchronizationService` component named in TS-001's Architecture Flow and TTAP-001's Runtime Architecture, the step immediately after the Offline Queue. Its job is narrow and matches TS-001's Synchronization Requirements directly: read `pending` records, attempt to reconcile each with the remote side exactly once per call, and update `SyncState` based on an explicit, typed outcome — never based on the `WorkEvent`'s or `TimeEntry`'s business meaning. `packages/core/src/application/SynchronizationService.ts`:

```ts
synchronizePending(): void {
  for (const record of this.offlineQueue.findPending()) {
    const result = this.synchronizationGateway.synchronize(record);

    if (result.status === 'synchronized') {
      this.offlineQueue.updateSyncState(record.workEvent.id, 'synchronized');
      this.onEvent(workEventSynchronized({ ...record, syncState: 'synchronized' }));
      continue;
    }
    if (result.status === 'conflict') {
      this.offlineQueue.updateSyncState(record.workEvent.id, 'failed');
      this.onEvent(workEventSyncFailed({ ...record, syncState: 'failed' }, 'conflict', result.reason));
      continue;
    }
    // retryable_failure: SyncState stays 'pending' - never dropped from the queue.
    this.onEvent(workEventSyncFailed(record, 'retryable_failure', result.reason));
  }
}
```

No real backend is called here — `SynchronizationGateway` (Section 10.22) is implemented only as a fake this sprint, deliberately, per ADR-0006/ADR-0007 (Development Sprint 004 Plan, Section 2/7).

### 10.21 Queue Synchronization Responsibilities and Boundaries

`OfflineQueue` (DT-007) gained exactly one new capability this sprint — `updateSyncState(workEventId, syncState)` — and nothing else. It does not gain a "synchronize" method, does not call `SynchronizationGateway` itself, and does not decide when synchronization should be attempted; `SynchronizationService` owns that orchestration entirely, and the queue remains a passive store that `SynchronizationService` reads from and writes state back to. This preserves DT-007's original responsibility boundary (EP-008 Ch01 §10.4) rather than widening it: the queue still only stores what it is given and reports storage-level outcomes, never business or synchronization-policy outcomes.

### 10.22 Synchronization Interfaces

`packages/core/src/ports/SynchronizationGateway.ts` defines the seam representing "the remote side," with exactly the shape DT-008's Acceptance Criteria require and nothing more:

```ts
export interface SynchronizationGateway {
  synchronize(record: QueuedWorkEventRecord): SynchronizationResult;
}
```

`SynchronizationResult` (`packages/core/src/application/SynchronizationResult.ts`) is a three-way explicit result — `'synchronized' | 'retryable_failure' | 'conflict'` — following the same typed-outcome pattern as `BusinessEngineDecision` and `EnqueueResult`, so a caller can never mistake "needs a retry" for "needs human/architectural attention" (a conflict). `FakeSynchronizationGateway` (`infrastructure/adapters/`) implements the port as a manually-configurable double (`configureSuccess()`, `configureRetryableFailure(reason)`, `configureConflict(reason)`), mirroring `FakeNfcScanAdapter`'s role for hardware — it is a test/dev double by design, not a placeholder for missing effort.

### 10.23 Queue Persistence Abstraction, Extended

No new persistence abstraction was introduced this sprint. `InMemoryOfflineQueue.updateSyncState` (extended, not replaced) performs an in-place `Map` update:

```ts
updateSyncState(workEventId: WorkEventId, syncState: SyncState): void {
  const existing = this.records.get(workEventId);
  if (existing === undefined) { return; }
  this.records.set(workEventId, { ...existing, syncState });
}
```

`SyncState`'s `'synchronized'` and `'failed'` values (named in TTAP-001 since Sprint 003, unused until now) are produced for the first time this sprint. Still no real database or network client exists anywhere in `packages/core` — verified by inspecting `package.json` (only `typescript`, `vitest`, `@types/node`).

### 10.24 Business Event Flow After Synchronization

`WorkEventSynchronized` and `WorkEventSyncFailed` (`domain/events/`) extend the event sequence Sprint 001–003 already established (`WorkEventCreated` → conditionally `TimeEntryStarted` → `WorkEventQueuedForSync`) with a fourth and, for failure cases, alternative step. `WorkEventSyncFailed` carries an `outcome: 'retryable_failure' | 'conflict'` field specifically because TTAP-001 names only one `WorkEventSyncFailed` event, not a separate conflict event — Sprint 004 satisfies "Conflicts are observable" (DT-008 Acceptance Criteria) by distinguishing the outcome inside the single approved event type rather than inventing a new, unapproved event name.

### 10.25 Application and Business Engine Responsibilities, Reconfirmed Again

`WorkEventFactory`, `BusinessEngine`, and `BusinessEngineDecision` (DT-004/DT-005) are untouched by Sprint 004 — verified by their unchanged file content. `SynchronizationService` sits entirely downstream of the Business Engine's decision and only ever forwards `QueuedWorkEventRecord.decision`, confirmed by a dedicated test (Section 10.26). This is the third sprint in a row (after DT-006's repositories and DT-007's queue) where a new infrastructure-adjacent component was added without widening who is allowed to interpret business meaning.

### 10.26 Testing Strategy for Synchronization

`FakeSynchronizationGateway.test.ts` tests the double's configurability only. `SynchronizationService.test.ts` covers all three outcomes plus two boundary-preserving assertions: a dedicated test that the service "does not read or branch on `QueuedWorkEventRecord.decision` for anything other than forwarding it," and a test that multiple pending records are all processed in one pass. `NfcScanToTimeEntryPipeline.test.ts` was extended so a full scan run reaches `synchronized` end-to-end for both the `time_entry_started` and `escalation_required` branches, mirroring exactly how DT-007's own pipeline extension proved the queue was decision-agnostic.

### 10.27 Common Implementation Pitfalls (Synchronization)

- Letting `SynchronizationService` or `SynchronizationGateway` branch on `decision.status` — would reintroduce business interpretation into infrastructure; both only ever forward `decision` untouched.
- Collapsing `retryable_failure` and `conflict` into one "failed" case — would make FB-001's "Synchronization conflict after offline capture" edge case invisible; the two are distinct fields/branches throughout.
- Dropping a record from the queue on any failure — a retryable failure must leave `SyncState` at `pending`; only `conflict` moves a record out of `findPending()` (to `failed`), and even then it remains inspectable in the queue, not deleted.
- Adding retry scheduling/backoff timers this sprint — explicitly out of scope (Development Sprint 004 Plan, Section 7); one attempt per call is the full extent of DT-008's scope.
- Reaching for a real database/network client "since synchronization is the point" — still deferred per ADR-0006/ADR-0007; `FakeSynchronizationGateway` is the only implementation this sprint, by design, not by omission.

### 10.29 Mobile Application Foundation Implementation (DT-012)

Development Sprint 006 implements the repository's first component of TS-001's Architecture Flow to run outside `packages/core`'s own process: a real Expo/React Native application (`apps/mobile`) that invokes the existing DT-011 composition root from a mobile JavaScript runtime. Its job is narrow by design: present a placeholder scan trigger, call the unmodified composition root, and render its output — nothing else. No new component is named for this in TTAP-001/TS-001; `apps/mobile` is the runtime host for TS-001's already-approved components, not a new architectural component of its own.

### 10.30 Mobile App Responsibilities and Boundaries

`apps/mobile` owns exactly one responsibility: UI capture and display. `AppNavigator` (a deliberately minimal single-screen function, no routing library added) renders `ScanScreen`, which holds only React state for the current input text and accumulated output lines. Every business, domain, application and infrastructure responsibility already assigned to DT-001–DT-011 remains entirely inside `packages/core`; `apps/mobile` imports only `buildScanDemoPipeline` and `DEMO_KNOWN_PAYLOAD` from `@taptime/core`'s public root export — no deep import into `business/`, `domain/`, `application/`, `ports/`, or `infrastructure/` exists anywhere in `apps/mobile` (verified by direct inspection of both files under `apps/mobile/src/`).

### 10.31 Composition Root Usage From Mobile

`ScanScreen` calls the composition root exactly as the CLI does: `pipeline.scan(payload)` on the "Scan" button and `pipeline.synchronizePending('success')` on the "Synchronize" button, where `pipeline = buildScanDemoPipeline((line) => setOutputLines((prev) => [...prev, line]))`. `packages/core/src/index.ts` was extended (not duplicated) to re-export `./cli/runScan`'s `buildScanDemoPipeline`, `DEMO_KNOWN_PAYLOAD`, and supporting types specifically so this could happen without `apps/mobile` re-implementing any part of DT-011. Making this cross-runtime consumption work surfaced one real defect, not hypothetical: `runScan.ts`'s CLI-trigger guard unconditionally read `process.argv[1]`, which the Expo/Hermes runtime does not define the way Node does; merely importing the module from `apps/mobile` would otherwise have thrown at load time. The guard was hardened (`typeof process !== 'undefined' && Array.isArray(process.argv) && typeof process.argv[1] === 'string'`) in `packages/core` itself, so both the CLI and the mobile screen keep using the identical, single implementation.

### 10.32 Placeholder Scan Flow

`ScanScreen` presents a `TextInput` (defaulted to `DEMO_KNOWN_PAYLOAD`, editable) and a "Scan" button — not real NFC hardware, since none exists (no native module, no physical tag reader; Development Sprint 005 Plan Section 3 and Development Sprint 006 Plan Section 3 both record this as a deliberate, not accidental, scope boundary). A second "Synchronize" button calls `pipeline.synchronizePending('success')` with the outcome hard-coded to `'success'` — the on-screen flow currently has no path to trigger `'retryable_failure'` or `'conflict'`, unlike the CLI (`npm run demo:scan -- <payload> [success|retryable_failure|conflict]`), which can trigger all three. This is recorded as a current limitation (Section 10.36), not a defect: `SynchronizationService`/`FakeSynchronizationGateway` themselves are unchanged and still support all three outcomes: only the mobile screen's UI does not yet expose a control for choosing one.

### 10.33 Testing Strategy for the Mobile Foundation

No React Native component-testing framework (e.g. Jest with `@testing-library/react-native`) exists yet in this repository, and `ScanScreen`'s handlers are thin, direct, unbranching calls to the composition root — so no automated component test was added for Sprint 006; this is documented as the accepted alternative (Development Sprint 006 Plan Section 11), not an oversight. What was verified instead: `npx expo export --platform ios` succeeds and produces a valid Hermes bytecode bundle (630 modules) both before and after `ScanScreen` was built, proving the cross-package Metro/bundler consumption path; `npx tsc --noEmit` passes against `apps/mobile`'s own `tsconfig.json`; and the CLI demo (`npm run demo:scan --workspace=@taptime/core -- demo-tag-payload success`) was re-run and produces the same message shapes `ScanScreen` renders, since both consume the identical `buildScanDemoPipeline`/`ScanResultPresenter` — there is no second, divergent implementation to compare against. This Sprint 006 closure additionally re-confirmed, in this session, that this typecheck/bundling evidence still holds and that all 81 `packages/core` tests continue to pass unchanged.

### 10.34 Common Implementation Pitfalls (Mobile Foundation) and Reconciliation

- Re-implementing any part of the composition root or `ScanResultPresenter` inside `apps/mobile` instead of importing the existing DT-011 root — would duplicate logic across two runtimes; avoided by extending `packages/core/src/index.ts`'s exports instead.
- Adding persistence, network, or auth code "since the app needs to work eventually" — explicitly out of scope for DT-012 and this chapter's own responsibility boundaries; `apps/mobile` contains none.
- Working around the Expo/Hermes `process.argv` incompatibility with a mobile-specific fork of `runScan.ts` — would create a second implementation to keep in sync; the shared guard was hardened instead (Section 10.31).
- Reconciliation with Section 7.2: that section's suggested `mobile/` folder is not implemented as a subfolder of `packages/core/src` — the repository instead added `apps/mobile` as a separate, top-level workspace package (Chapter 02 Section 10.4), which serves the same responsibility-oriented purpose (isolating mobile-runtime code from domain/business/application/infrastructure) at the workspace level rather than the folder level. Recorded here as a documented reconciliation, per Section 7.1's own instruction, not silently treated as a deviation.
- `apps/mobile/tsconfig.json` extending `expo/tsconfig.base` rather than the root `tsconfig.base.json` is likewise a documented deviation, required for Expo's own JSX/React Native module resolution, not an inconsistency introduced by oversight.

### 10.36 Authentication & Session Foundation Implementation (DT-013)

Development Sprint 007 implements the first piece of TS-001's Security Requirements ("user must be authenticated") that has ever had code behind it. Its job is exactly as narrow as every prior infrastructure-adjacent component: authenticate a credential and produce (or reject) a `CallerContext` — never decide anything about assignments, WorkEvents, or business outcomes. `packages/core/src/application/SessionService.ts`:

```ts
export class SessionService {
  constructor(private readonly authenticationGateway: AuthenticationGateway) {}

  signIn(credentials: Credentials): AuthenticationResult {
    return this.authenticationGateway.authenticate(credentials);
  }
}

export function toCallerContext(result: AuthenticationResult): CallerContext {
  if (result.status === 'authenticated') {
    return authenticatedCaller(result.userId, result.organizationId);
  }
  return UNAUTHENTICATED_CALLER;
}
```

No real managed authentication provider is called here — `AuthenticationGateway` (Section 10.38) is implemented only as a fake this sprint, deliberately, per ADR-0007 (the *category* "managed authentication provider" is Approved; the *specific* provider is a Human Architect decision not yet made, exactly as ADR-0007 deferred the specific synchronization/persistence technology before DT-007/DT-008 built fakes against approved ports).

**Scope actually built, per explicit Human Architect instruction narrowing the Development Sprint 007 Plan's Section 6:** only `AuthenticationGateway`, `FakeAuthenticationGateway`, `SessionService`, and `AuthenticationResult`, all inside `packages/core`. The plan's mobile `LoginScreen`, `AppNavigator` extension, and the composition root's substitution of a real session for its hard-coded demo caller were **not built this session** (Chapter 00 Section 10.9). This section documents what exists, not the full DT-013 Acceptance Criteria.

### 10.37 Authentication Responsibilities and Boundaries

`CallerContext` (`packages/core/src/domain/CallerContext.ts`, Development Sprint 001) is unchanged: `SessionService` produces values through its existing, exported `authenticatedCaller()`/`UNAUTHENTICATED_CALLER` helpers, introducing no new identity type. `AssignmentValidator` (`packages/core/src/business/AssignmentValidator.ts`, DT-003) is unchanged and untouched by this sprint — its existing `caller.status !== 'authenticated'` check, returning `{ status: 'rejected', reason: 'employee_not_authenticated' }`, is exercised by the new `SessionDerivedCallerPipeline.test.ts` (Section 10.39), not modified by it. This preserves the exact responsibility boundary Section 10.1 established for the queue and Section 10.20 established for synchronization: a new infrastructure-adjacent capability was added without widening who is allowed to interpret business meaning.

### 10.38 Authentication Interfaces

`packages/core/src/ports/AuthenticationGateway.ts` defines the seam representing "the eventual managed authentication provider," with exactly the shape DT-013's narrowed Acceptance Criteria require and nothing more:

```ts
export interface Credentials {
  readonly signInCode: string;
}

export interface AuthenticationGateway {
  authenticate(credentials: Credentials): AuthenticationResult;
}
```

`Credentials` is deliberately a single opaque `signInCode`, not a username/password pair — this sprint builds no password flow, no registration, no credential management. `AuthenticationResult` (`packages/core/src/application/AuthenticationResult.ts`) is a two-way explicit result — `{ status: 'authenticated'; userId; organizationId } | { status: 'rejected'; reason: 'invalid_credentials' }` — following the same typed-outcome pattern as `BusinessEngineDecision`, `EnqueueResult`, and `SynchronizationResult`. `FakeAuthenticationGateway` (`infrastructure/adapters/`) implements the port against a small, clearly-labeled, constructor-overridable set of in-memory demo accounts (`DEFAULT_DEMO_ACCOUNT`: `signInCode: 'demo-employee-code'` → the same `'demo-employee'`/`'demo-org'` identity `buildScanDemoPipeline` already uses) — mirroring `FakeSynchronizationGateway`'s role as a configurable double, not a placeholder built by omission.

### 10.39 Testing Strategy for Authentication

`FakeAuthenticationGateway.test.ts` tests the double's configurability (successful sign-in, invalid-credentials rejection) only. `SessionService.test.ts` covers both `AuthenticationResult` branches plus a dedicated boundary-preserving assertion that `SessionService` "does not itself decide anything beyond what the gateway returned," mirroring `SynchronizationService.test.ts`'s equivalent test (Section 10.26). `SessionDerivedCallerPipeline.test.ts` is the sprint's most significant test: it proves a `CallerContext` produced via `SessionService`/`FakeAuthenticationGateway` reaches identical `AssignmentValidator` outcomes — both the accepted path and the existing `employee_not_authenticated` rejection — as the pre-existing hard-coded `authenticatedCaller(...)` fixture, without any change to `AssignmentValidator` itself. All 94 `packages/core` tests pass (81 pre-existing plus 13 new: 6 in `SessionService.test.ts`, 5 in `FakeAuthenticationGateway.test.ts`, 2 in `SessionDerivedCallerPipeline.test.ts`); `npm run typecheck` is clean for both `packages/core` and `apps/mobile`.

### 10.40 Common Implementation Pitfalls (Authentication)

- Letting `SessionService` or `AuthenticationGateway` branch on organization/assignment/WorkEvent business meaning — would reintroduce business interpretation into an infrastructure-adjacent seam; both only ever authenticate-or-reject a credential.
- Introducing a new identity/`CallerContext`-like type for authenticated sessions instead of reusing the existing one — would create two identity shapes for `AssignmentValidator` and downstream code to reconcile; `toCallerContext()` reuses `authenticatedCaller()`/`UNAUTHENTICATED_CALLER` unchanged.
- Modifying `AssignmentValidator`'s existing authentication check "since we're building auth now" — the whole value of Sprint 001's `CallerContext` seam is that it did not need to change; `SessionDerivedCallerPipeline.test.ts` exists specifically to prove this.
- Building a real managed-authentication-provider integration (e.g. Firebase Auth) this sprint — explicitly out of scope; the specific provider remains a Human Architect decision not yet made, and `FakeAuthenticationGateway` is the only implementation this sprint, by design.
- Treating DT-013 as fully Completed while its `apps/mobile` half remained unbuilt — resolved this sprint (Section 10.44): DT-014 completed the mobile `LoginScreen` and composition-root wiring, and DT-013's Status line now reflects full Acceptance Criteria satisfaction across both tasks.

### 10.41 Mobile Session Integration Implementation (DT-014)

Development Sprint 008 completes DT-013's mobile-facing Acceptance Criteria, deliberately deferred by Human Architect instruction during Sprint 007 (Section 10.36). Its job is exactly as narrow as Section 10.36 anticipated: let a real credential reach the existing `SessionService`, and let the resulting `CallerContext` reach the existing composition root — nothing else. `packages/core/src/cli/runScan.ts`'s composition root:

```ts
scan(rawPayload: string | undefined, caller: CallerContext = defaultCaller): ScanPipelineOutcome {
  const outcome = applicationService.submitScan(caller);
  // ...
}
```

`defaultCaller` remains the Sprint 005 hard-coded `authenticatedCaller(UserId('demo-employee'), organizationId)`, preserved so the existing CLI (`npm run demo:scan`) is unaffected — the extension is additive (an optional parameter with a default), not a rewrite, following the same discipline as DT-007's `updateSyncState` extension (Section 10.21) and DT-011's export addition (Chapter 00 Section 10.1).

### 10.42 Mobile Login Responsibilities and Boundaries

`apps/mobile/src/screens/LoginScreen.tsx` owns exactly one responsibility: capture a `signInCode`, call `SessionService.signIn(...)`/`toCallerContext(...)` (both unchanged from Sprint 007), and hand the resulting `CallerContext` to whoever navigates next. It introduces no new rejection reasons, no role/permission logic, and no identity type of its own — verified by direct inspection, its only `@taptime/core` imports are `SessionService`, `toCallerContext`, `FakeAuthenticationGateway`, and the `CallerContext` type (the same public-root-export-only discipline `ScanScreen` already established, Section 10.30). `AppNavigator` (`apps/mobile/src/navigation/AppNavigator.tsx`) was extended from a single-screen render to a minimal `useState<CallerContext | null>`-driven conditional: `LoginScreen` when no caller is signed in, `ScanScreen` (now taking `caller` as a prop) once one is. No routing library was added — Sprint 006's precedent of deferring that dependency held for a second screen too. `ScanScreen`'s scan action now calls `pipeline.scan(payload, caller)`, passing the signed-in identity into the extended composition root (Section 10.41) instead of relying on its default.

### 10.43 Testing Strategy for Mobile Session Integration

`packages/core/tests/cli/runScan.callerOverride.test.ts` is the sprint's core proof: it confirms `buildScanDemoPipeline`'s extended `scan()` signature produces correct, distinct outcomes for both the default hard-coded caller (existing behavior, unaffected) and an externally-supplied, `SessionService`-derived `CallerContext` — including that `AssignmentValidator`'s pre-existing `employee_not_authenticated` rejection is reached, unmodified, for a rejected sign-in. This sits alongside, and reuses the same proof strategy as, Sprint 007's `SessionDerivedCallerPipeline.test.ts` (Section 10.39) — this sprint's job was to prove the *wiring* reaches that already-proven path, not to re-prove the business-logic substitution. All 98 `packages/core` tests pass (94 pre-existing plus 4 new); `apps/mobile` and `packages/core` both typecheck cleanly. As with DT-012, no automated component test was added for `LoginScreen`/`AppNavigator` (no React Native component-testing framework exists yet in this repository); `npx expo export --platform ios` (639 modules) and `npx tsc --noEmit` were used as the same bundling/typecheck proof DT-012 established, and no iOS/Android simulator or device was available to manually verify the Login → Scan flow launches and behaves correctly — an accurate, documented limitation (Chapter 00 Section 10.10), not a silently-skipped step.

### 10.44 Common Implementation Pitfalls (Mobile Session Integration)

- Re-implementing or duplicating `SessionService`/`AuthenticationGateway` logic inside `apps/mobile` instead of calling the existing `packages/core` exports — `LoginScreen` only ever calls the existing functions.
- Changing `buildScanDemoPipeline`'s `scan()` signature in a way that breaks the existing CLI — avoided by making the new parameter optional with the pre-existing hard-coded caller as its default, proven non-breaking by `runScan.callerOverride.test.ts`.
- Adding a routing library or multi-screen state library not required for a two-screen conditional render — `AppNavigator`'s `useState<CallerContext | null>` was sufficient, consistent with Sprint 006's own precedent of avoiding unneeded dependencies.
- Modifying `AssignmentValidator`, `SessionService`, `AuthenticationGateway`, or `FakeAuthenticationGateway` "while we're touching authentication again" — none were touched; only `runScan.ts`'s composition and `apps/mobile`'s two screens changed.
- Claiming simulator/device launch verification occurred when it did not — Chapter 00 Section 10.10 records this limitation accurately, mirroring DT-012's own precedent, rather than asserting an untested claim.

### 10.45 Error Handling Implementation (DT-009)

Development Sprint 009 implements a Development Task that has existed in `EP-007_Development_Tasks.md`'s original sequence since EP-007 was established, but was never started until this sprint: TTAP-001's Runtime Architecture line "Errors shall be categorized as recoverable, retryable, deferred, conflict or fatal" is now implemented as an actual type and a set of classification functions, rather than remaining an unimplemented sentence in an architecture document. `packages/core/src/domain/ErrorCategory.ts`:

```ts
export type ErrorCategory = 'recoverable' | 'retryable' | 'deferred' | 'conflict' | 'fatal';
```

Five pure functions — `classifyScanPipelineOutcome`, `classifyAssignmentValidationResult`, `classifyBusinessEngineDecision`, `classifySynchronizationResult`, `classifyAuthenticationResult` — each take an existing result/outcome value and return an `ErrorCategory`, or `null` for a non-error (success) case. No business/application logic that produces these result types was modified — `AssignmentResolver`, `AssignmentValidator`, `BusinessEngine`, `WorkEventFactory`, `SynchronizationService`, and `SessionService` are all byte-for-byte unchanged, confirmed by `git diff` against the pre-Sprint-009 commit.

### 10.46 Error Propagation Model and Responsibility Boundaries

Classification is deliberately one-directional and read-only: a classification function is called *after* a business/application/infrastructure component has already produced its result, and its output (an `ErrorCategory`) is never read back into any of those components — verified by direct inspection, none of the five classification functions are imported anywhere inside `business/AssignmentResolver.ts`, `business/AssignmentValidator.ts`, `business/BusinessEngine.ts`, `business/WorkEventFactory.ts`, `application/SynchronizationService.ts`, or `application/SessionService.ts`. This preserves the same responsibility boundary Sections 10.1/10.20/10.36 already established for the queue, synchronization service, and session service: an infrastructure/presentation-adjacent capability may observe and label a decision, but it may never make one or feed back into one. `ErrorCategory` itself lives in `domain/`, not `application/`, specifically so the two `business/`-layer classification functions can depend on it without inverting the approved Business-depends-on-Domain dependency direction (Chapter 02 Section 10.7).

### 10.47 Application and Business Engine Responsibilities, Confirmed a Fourth Time

`AssignmentResolver`, `AssignmentValidator`, `BusinessEngine`, `WorkEventFactory` (business layer) and `SynchronizationService`, `SessionService` (application layer) all remain exactly as Sections 10.3/10.4/10.17/10.25/10.37 already described them — none gained, lost, or changed a responsibility this sprint. The only application-layer component actually extended is `ScanResultPresenter` (DT-011), which gained two additive methods, `presentScanOutcomeWithCategory()` and `presentEventWithCategory()`, each pairing an existing, unchanged rendered message (from `presentScanOutcome()`/`presentEvent()`) with its classified category — `presentScanOutcome()` and `presentEvent()` themselves were not modified, and their 16 pre-existing tests were not touched.

### 10.48 Testing Strategy for Error Classification

Each classification function has its own dedicated, exhaustive test file covering every currently-defined rejection/failure reason for its result type, plus a confirmation that success cases (`accepted`, `time_entry_started`, `synchronized`, `authenticated`) return `null`: `classifyScanPipelineOutcome.test.ts` (8 tests), `classifyAssignmentValidationResult.test.ts` (5 tests), `classifyBusinessEngineDecision.test.ts` (2 tests), `classifySynchronizationResult.test.ts` (3 tests), `classifyAuthenticationResult.test.ts` (2 tests) — 20 new tests. `ScanResultPresenter.test.ts` was extended from 16 to 25 tests, covering `presentScanOutcomeWithCategory()`/`presentEventWithCategory()` for at least one case per result type without modifying any pre-existing assertion. All 127 `packages/core` tests pass (98 pre-existing + 29 new); `packages/core` and `apps/mobile` both typecheck cleanly.

### 10.49 Common Implementation Pitfalls (Error Classification)

- Letting a classification function trigger a side effect (e.g. auto-retrying a `'retryable'` outcome, or auto-escalating a `'deferred'` one) — would move classification from observability into business/application logic; all five functions are pure and return only a value.
- Adding a `category` field directly onto the existing result/outcome types instead of classifying them externally — would risk widening five already-tested types' shapes for a concern (observability) that does not belong to their own responsibility; classification is external and additive instead.
- Guessing at an ambiguous category without documenting the reasoning — the `recoverable`/`fatal` split for `AssignmentValidationResult`/`AuthenticationResult` rejection reasons is a genuine interpretive judgment call (TTAP-001 names the five categories without further defining them), and it is written out explicitly in each function's own comments (Chapter 01 Section 10.9) rather than left implicit.
- Resolving Finding F-01 as a side effect of classifying `escalation_required` as `'deferred'` — classification only labels the existing placeholder (`BusinessEngineDecision`'s own "deliberate placeholder" comment); it does not decide the duplicate-scan/toggle rule.
- Building a viewing/reporting screen around the new category field "since it's finally observable now" — out of scope for this sprint (Development Sprint 009 Plan Section 7); no query/read component for viewing exists in TTAP-001/FB-001/TS-001 today (Chapter 00 Section 10.11).

### 10.51 Local Persistence Foundation Implementation (DT-015)

Development Sprint 010 closes the local half of ADR-0004's Implementation Rule ("the architecture must include a local event queue or equivalent offline-capable mechanism before production release"), which had remained unimplemented through DT-006/DT-007 (in-memory only) since Development Sprint 002/003. A shared, dependency-free helper, `packages/core/src/infrastructure/persistence/JsonFileStore.ts`, provides `readJsonArray`/`writeJsonArray` over Node's built-in synchronous `fs`; three new adapters — `FileOfflineQueue`, `FileWorkEventRepository`, `FileTimeEntryRepository` — are built on top of it, each implementing the same `OfflineQueue`/`WorkEventRepository`/`TimeEntryRepository` port its in-memory counterpart already implements, with no port change. `FileOfflineQueue` reproduces `InMemoryOfflineQueue`'s `already_queued` duplicate-enqueue semantics exactly. No new dependency was added to `packages/core/package.json` (confirmed by diff: only the `demo:scan` script's target file changed).

### 10.52 The Composition Root Gains a Storage Option Without Gaining a Runtime Dependency

`buildScanDemoPipeline` (`packages/core/src/cli/runScan.ts`) gained a second, optional parameter, `storage?: ScanDemoStorageOptions`, following the identical additive-parameter pattern Sections 10.36/10.44 already used for `caller: CallerContext`: when omitted, the three existing `InMemory*` adapters are constructed exactly as before, and every pre-existing call site and test is unaffected. `ScanDemoStorageOptions` is typed only against the port interfaces (`WorkEventRepository`, `TimeEntryRepository`, `OfflineQueue`) — a type-only reference is erased at compile time, so `runScan.ts` itself never needs a runtime import of `fs`/`path` or of the `File*`-adapter classes. This was a required, discovered deviation from the plan's literal wording (a raw directory-string parameter), documented in `EP-007_Development_Tasks.md`'s DT-015 Implementation Notes and in Chapter 01 Section 10.10: constructing durable adapters from a directory path does need `fs`/`path`, so that construction now lives in a new, Node-only file, `packages/core/src/cli/runScanCli.ts` (Chapter 02 Section 10.8), which is the new `demo:scan` script target. `runScan.ts` remains part of `packages/core/src/index.ts`'s barrel export and therefore part of `apps/mobile`'s static import graph (Section 10.30); `runScanCli.ts` is not re-exported from that barrel, and `apps/mobile` was not touched.

### 10.53 Persistence Boundary Discipline, Confirmed a Sixth Time

None of the three new adapters read or branch on a `BusinessEngineDecision`, `AssignmentValidationResult`, `ScanPipelineOutcome`, `SynchronizationResult`, or `AuthenticationResult` value — each stores and retrieves exactly the record type its port already defines (`QueuedWorkEventRecord`, `WorkEvent`, `TimeEntry`), the same discipline Sections 10.4/10.5 (renumbered 10.1's queue/sync narrative), 10.46 (error classification) and Chapter 01 Section 10.10 already describe for the in-memory queue, the synchronization service, and the classification functions. `AssignmentResolver`, `AssignmentValidator`, `BusinessEngine`, `WorkEventFactory`, `SynchronizationService`, and `SessionService` are all byte-for-byte unchanged, confirmed by `git diff` against the pre-Sprint-010 commit — a storage-technology change required zero business/application-layer changes, the concrete proof of ADR-0006's "any persistence technology is infrastructure."

### 10.54 A Discovered Bundling Constraint Was Documented and Fixed, Not Guessed Around

Wiring the plan's literal "configurable directory/file path" parameter directly into `runScan.ts` broke `apps/mobile`'s Metro bundling (`Unable to resolve module path from .../runScan.ts`) because Node's `fs`/`path` have no React Native/Hermes equivalent and `runScan.ts` sits inside `apps/mobile`'s static import graph (Section 10.30). This was caught by re-running the same `npx expo export --platform ios` verification step Sections 10.30/10.44 already established, immediately after wiring the storage option — before considering the sprint done. The fix (Section 10.52) keeps `runScan.ts` interface-typed only and isolates the `fs`/`path`-dependent construction inside the new, Node-only `runScanCli.ts`; `npx expo export --platform ios` was re-verified successful (645 modules) after the fix, and `apps/mobile` required no change of its own.

### 10.55 Testing Strategy for Local Persistence

Each new adapter has its own dedicated test file mirroring its in-memory counterpart's test coverage, plus a dedicated "survives simulated restart" test: a fresh adapter instance, pointed at the same temp directory a prior instance wrote to, correctly reads back what was written. `JsonFileStore.test.ts` (6 tests), `FileOfflineQueue.test.ts` (9 tests), `FileWorkEventRepository.test.ts` (4 tests), `FileTimeEntryRepository.test.ts` (4 tests) — 23 tests — plus a composition-level `runScan.storageOverride.test.ts` (4 tests) proving both the default (in-memory) and durable-storage paths work, that state does not leak between two different storage directories, and that a `TimeEntry` written by one pipeline instance causes a second, independently-constructed pipeline instance pointed at the same directory to correctly escalate rather than re-start. All 154 `packages/core` tests pass (127 pre-existing + 27 new); `packages/core` and `apps/mobile` both typecheck cleanly. Beyond the automated suite, cross-process durability was manually verified via two genuinely separate OS process invocations (`TAPTIME_DEMO_STORAGE_DIR=<dir> npm run demo:scan -- demo-tag-payload success`, run twice): the second, freshly-started process correctly read back what the first had written.

### 10.56 Common Implementation Pitfalls (Local Persistence)

- Adding a new npm dependency (a JSON/file library) when Node's built-in `fs` already suffices — no new dependency was added; `packages/core/package.json`'s only change is the `demo:scan` script's target file.
- Wiring `fs`/`path`-dependent construction directly into `runScan.ts` "since it's simpler" — this is the exact mistake Section 10.54 discovered and fixed; it breaks `apps/mobile`'s Metro bundling because `runScan.ts` is part of its static import graph.
- Treating this sprint as license to also choose a cloud/backend persistence technology "since we're doing persistence now" — explicitly out of scope (Development Sprint 010 Plan Section 7); the backend/cloud technology decision remains an undecided Human Architect decision (ADR-0007).
- Building a mobile-native storage adapter (`expo-sqlite`/`AsyncStorage`) inside `apps/mobile` as part of this sprint — explicitly deferred as a smaller, separate follow-up task, analogous to the DT-013→DT-014 split; not attempted here.
- Adding concurrency/locking or atomic-write handling "to be safe" — explicitly out of scope for this sprint's single-process, single-writer use case; documented as a known limitation instead of built.
- Silently changing `InMemoryOfflineQueue`/`InMemoryWorkEventRepository`/`InMemoryTimeEntryRepository`'s existing behavior while building the new adapters — none of the three in-memory classes were modified, confirmed by diff; they remain the unchanged default.

### 10.58 Real NFC Hardware Integration Implementation (DT-016)

Development Sprint 011 implements a third `NfcScanPort` implementation, `RnNfcScanAdapter` (`apps/mobile/src/nfc/RnNfcScanAdapter.ts`), using `react-native-nfc-manager`. Real NFC tag detection is inherently asynchronous (a physical tap can occur at any time), while `NfcScanPort.scan()` is synchronous; the adapter bridges the two exactly the way `CliNfcScanAdapter` already bridges CLI input to the same synchronous contract — an async `waitForNextTag()` registers a native tag-discovery listener and buffers the normalized result, and the synchronous `scan()` returns whatever is currently buffered. A separate `checkCapability()` method (additional to the port, exactly as `CliNfcScanAdapter.setInput()` is also additional) surfaces `NFC_Capability_Model.md`'s Required Failure States as narrowly-scoped capability states (`'not_supported'`, `'disabled'`, `'ready'`), not new business rejection reasons. `NfcScanPort.ts` itself, `FakeNfcScanAdapter`, and `CliNfcScanAdapter` are all unchanged.

### 10.59 Mobile Composition and Boundary Discipline for Real NFC

`ScanScreen.tsx` was extended, not rewritten: "Scan NFC Tag" is now the primary trigger, calling `checkCapability()` then `waitForNextTag()` and, on a captured result, the exact same, unmodified `pipeline.scan(result.payload, caller)` call the Development Sprint 006/008 placeholder already made. The manual text input and its `Scan (manual)`/`Synchronize` buttons (DT-012/DT-014) are retained unchanged as a fallback/debug affordance, including their existing `testID`s. No change was made to `buildScanDemoPipeline`/`runScan.ts` — `apps/mobile` already supplies its own trigger via the screen (Section 10.30's pattern), so no composition-root change was needed for this sprint. `packages/core/package.json` gained no new dependency; `react-native-nfc-manager` is `apps/mobile`-only, preserving ADR-0007's Domain Platform boundary, confirmed by `git diff --stat -- packages/core/` being empty.

### 10.60 Platform Scope and the Prioritization Question, Both Disclosed Rather Than Assumed

This sprint targets Android only, as scoped; `NFC_Capability_Model.md`'s own open question ("Is iOS NFC support in scope for v1?") is not resolved and not silently decided either way — the library supports both platforms at the type level, but no iOS-specific testing, tuning, or product decision was made. Separately, this is the first Development Sprint planned directly against EP-009's Product Readiness priorities rather than the next unstarted DT number alone: repository evidence (`Product_Readiness_Assessment.md` Section 11.1) ranks Organization Management above real NFC hardware integration as a Product Readiness priority, but Organization Management has no Feature Blueprint, so this sprint implemented the next Roadmap item this repository's engineering order already permits instead — see `Development_Sprint_011_Plan.md` Section 3 and Chapter 01 Section 10.11 for the full reasoning.

### 10.61 Testing Strategy for Real NFC Hardware Integration

Since `apps/mobile` had no test runner configured before this sprint, `vitest` was added as a dev dependency, scoped to plain TypeScript logic tests only (Chapter 02 Section 10.9). Tests cover `normalizeTag()`'s payload normalization (valid id, missing id, empty/whitespace id), `RnNfcScanAdapter`'s capability-check branching (`not_supported`, `disabled`, `ready`), its async-event-to-sync-`scan()` bridge (a test double simulates the native library's `DiscoverTag` event callback firing), and the `registerTagEvent()` failure path — 10 new tests, all passing; `packages/core`'s 154 pre-existing tests are unaffected (different workspace, no shared code changed). `npx expo export --platform android` (666 modules) and `--platform ios` (668 modules, regression check) both succeed after adding the native dependency. **What could not be verified in this environment and remains an explicit, disclosed outstanding item:** that a real NFC tag, on a real Android device, is actually detected, read, and produces the expected on-screen outcome — this requires physical hardware per ADR-0007's own Validation Requirements, mirroring the exact disclosure pattern Sections 10.29/10.34/10.44 already established for DT-012/DT-014.

### 10.62 Common Implementation Pitfalls (Real NFC Hardware Integration)

- Adding `react-native-nfc-manager` (or any native NFC dependency) to `packages/core` instead of `apps/mobile` only — would violate ADR-0007's Domain Platform boundary; the dependency is `apps/mobile`-only.
- Silently deciding the iOS-vs-Android question by implementing or testing iOS behavior without it being an explicit product decision — `NFC_Capability_Model.md` names this as still open; this sprint targets Android only and does not resolve it.
- Treating a capability failure (`'not_supported'`/`'disabled'`) as a new `AssignmentResolver`/`AssignmentValidator` business rejection reason — these are technical/capability states surfaced by the adapter's additional `checkCapability()` method, not business decisions.
- Claiming physical-device validation occurred when it did not — Chapter 00 Section 10.13 and this sprint's Decision Log entry record this limitation accurately, mirroring DT-012's own precedent, rather than asserting an untested claim.
- Proceeding to implement Organization Management or NFC tag registration/provisioning "since we're touching NFC again" — both remain out of scope; Organization Management has no Feature Blueprint (Section 10.60), and tag registration depends on it.

### 10.64 Organization Domain & Repository Implementation (DT-017)

Development Sprint 012 implements the first slice of FB-002/TS-002 (Organization Management Foundation): `Organization` (`packages/core/src/domain/Organization.ts`) as a plain domain object, `{ id: OrganizationId; name: string }`, with no `status` field (TS-002: no Decision Logic references an inactive-Organization rejection path; a pure additive follow-up if the Human Architect later requires one). `OrganizationCreated` (`packages/core/src/domain/events/OrganizationCreated.ts`) follows the existing `WorkEventCreated` constructor-function idiom exactly: `organizationCreated(organization)` returns `{ type: 'OrganizationCreated', organization }`. `OrganizationRepository` (`packages/core/src/ports/OrganizationRepository.ts`) mirrors `CustomerRepository`'s minimal read shape (`findById`) plus the one write method (`save`) this specification's new repository needs. `InMemoryOrganizationRepository` (`packages/core/src/infrastructure/repositories/InMemoryOrganizationRepository.ts`) follows `InMemoryCustomerRepository`'s constructor-seeded pattern byte-for-byte: an optional `readonly Organization[]` constructor argument, defensively copied (`[...organizations]`) so the caller's array cannot be mutated by later `save` calls. `OrganizationManagementService` (`packages/core/src/application/OrganizationManagementService.ts`) exposes a single method, `createOrganization(name: string): OrganizationCreated`, constructing an `Organization` with an injectable id generator (`newOrganizationId: () => OrganizationId = () => OrganizationId(generateId())`, mirroring `WorkEventFactory`/`BusinessEngine`'s established constructor pattern so tests do not depend on hidden randomness), calling `organizationRepository.save(organization)`, and returning `organizationCreated(organization)`.

### 10.65 Application Service Boundary Discipline, Confirmed for Organization Management

`OrganizationManagementService` owns no business rule beyond "an Organization can always be created" (TS-002 Decision 1, FB-002 Decision 1) — no name validation, no uniqueness check, no precondition beyond the request itself. This is the same "orchestrates but does not interpret" boundary `NfcScanApplicationService` already established (Section 10.2/EP-008 Ch03 §2.3/5.4), now applied to a service with no prior Organization-related code to extend. `BusinessEngine`, `AssignmentResolver`, `AssignmentValidator`, `WorkEventFactory`, `NfcScanApplicationService`, `CallerContext`, `OfflineQueue`, and `SynchronizationService` are all confirmed byte-for-byte unchanged by `git diff` against the pre-Sprint-012 commit — Organization Management's first slice required zero changes to any existing business/application file, the same proof pattern Sections 10.53/10.59/10.65 already establish for storage and NFC-input boundary changes, now extended to a genuinely new domain area rather than a swapped adapter.

### 10.66 Testing Strategy for Organization Domain & Repository

`InMemoryOrganizationRepository.test.ts` (5 tests): not-found case (`findById` on an empty repository returns `null`), save-then-find round-trip, does-not-find-a-different-id after a save, constructor-seeded lookups work without a prior `save` call, and does-not-mutate-the-input-array passed to the constructor. `OrganizationManagementService.test.ts` (5 tests): `createOrganization` produces the correct `OrganizationCreated` event and repository state, calls `save` with the exact constructed `Organization`, is deterministic when a fixed id generator is injected, generates a unique id by default when no generator is injected, and succeeds independently on a second call with a duplicate name (proving no uniqueness precondition exists, per TS-002 Decision 1). All 10 tests are new; `npm run test --workspace=@taptime/core` reports 33 test files and 164 tests passing (154 pre-existing + 10 new); `npm run typecheck --workspace=@taptime/core` is clean. No composition-level or `apps/mobile` test exists yet for this capability — no UI/CLI entry point calls `OrganizationManagementService`, per DT-017's own Out of Scope.

### 10.67 Common Implementation Pitfalls (Organization Domain & Repository)

- Adding a `status`/`active` field to `Organization` "for future use" — explicitly not required by any Decision Logic in FB-002/TS-002; DT-017's Acceptance Criteria call for a pure additive follow-up later if the Human Architect requires one, not a speculative field now.
- Adding a uniqueness check or name-validation rule inside `OrganizationManagementService` — TS-002 Decision 1 states Organization creation has no precondition beyond the request itself; a second, third, etc. Organization can always be created.
- Building a UI/CLI entry point that calls `OrganizationManagementService` "since the service already exists" — explicitly out of scope for DT-017; a future Development Task's concern.
- Starting Membership, `MembershipAuthorizationValidator`, or `OrganizationAdministrationService` "while already in this area" — each is a separate, later Development Task (DT-018–DT-025) with its own dependencies; none was started by DT-017, confirmed by direct search finding no such file anywhere in the repository.
- Adding a `save` method to `CustomerRepository`/`NfcTagRepository`/`NfcAssignmentRepository` as part of this task — those extensions belong to DT-020/DT-021/DT-022 respectively, not DT-017; all three ports remain read-only, confirmed by direct grep finding no `save(` method on any of the three.

### 10.69 Membership Domain & Repository Implementation (DT-018)

Development Sprint 013 implements the second slice of FB-002/TS-002 (Organization Management Foundation): `MembershipId` (`packages/core/src/domain/ids.ts`), a new branded identifier added via the file's existing `Brand<Value, BrandName>`/`brandedNonEmptyString` factory pattern. `MembershipRole` (`packages/core/src/domain/MembershipRole.ts`) is a value type, `'administrator' | 'employee'`, mirroring the existing string-literal-union idiom already used for `AssignmentTarget.targetType`/`SyncState`/`ErrorCategory`. `Membership` (`packages/core/src/domain/Membership.ts`) is a domain object carrying its own `id: MembershipId` plus `organizationId: OrganizationId`, `userId: UserId`, and `role: MembershipRole` — an association object with its own identity, following the same precedent ADR-0002 already set for `NfcAssignment`, per FB-002's assumption that one Membership per actor exists at a time. `MembershipGranted` (`packages/core/src/domain/events/MembershipGranted.ts`) follows `OrganizationCreated`'s constructor-function idiom exactly. `MembershipRepository` (`packages/core/src/ports/MembershipRepository.ts`) exposes `findByUserId(userId: UserId): Membership | null` plus `save` — no `findById(id: MembershipId)` method, matching TS-002's Ports section exactly. `InMemoryMembershipRepository` (`packages/core/src/infrastructure/repositories/InMemoryMembershipRepository.ts`) follows `InMemoryOrganizationRepository`'s constructor-seeded pattern byte-for-byte, including the defensive array copy. `MembershipService` (`packages/core/src/application/MembershipService.ts`) exposes `grantMembership(organizationId: OrganizationId, userId: UserId, role: MembershipRole): MembershipGranted`, constructing a `Membership` with an injectable id generator (`newMembershipId`, mirroring `OrganizationManagementService`'s pattern exactly), calling `membershipRepository.save(membership)`, and returning `membershipGranted(membership)`.

### 10.70 Application Service Boundary Discipline, Narrowed Further Than TS-002's Full Sequence

`MembershipService` owns no business rule of any kind — not even "no precondition beyond the request itself" (TS-002 Decision 1's framing for `OrganizationManagementService`), because it performs no check at all: no authorization, no verification that `organizationId` refers to a real Organization, and no special-casing for a first/bootstrap Membership. This is a deliberate, disclosed narrowing of TS-002's own Sequence Diagram 2, which shows `MembershipService` delegating to `MembershipAuthorizationValidator` for every grant except the bootstrap case — that validator does not exist yet (DT-019), so the delegation step is simply absent here, not stubbed or worked around. Two dedicated tests prove this absence directly rather than leaving it as an inference: one grants a Membership against an `organizationId` with no known Organization and confirms it still succeeds; another grants two Memberships for the same Organization back-to-back and confirms neither receives special treatment. `Organization`, `OrganizationRepository`, `InMemoryOrganizationRepository`, and `OrganizationManagementService` (DT-017) are all confirmed byte-for-byte unchanged by `git diff` against the pre-Sprint-013 commit — `Membership` consumes `OrganizationId` only as a type, with no runtime call into DT-017's code.

### 10.71 Testing Strategy for Membership Domain & Repository

`ids.test.ts` gained `MembershipId` assertions inside its two existing test cases (a valid non-empty string succeeds; an empty or whitespace-only string throws), matching every other branded ID's existing rejection coverage — this adds coverage without adding new test-file-level test counts. `InMemoryMembershipRepository.test.ts` (5 tests): not-found case (`findByUserId` on an empty repository returns `null`), save-then-find-by-userId round-trip, does-not-find-a-Membership-saved-under-a-different-userId, constructor-seeded lookups, and does-not-mutate-the-input-array passed to the constructor. `MembershipService.test.ts` (6 tests): `grantMembership` produces the correct `MembershipGranted` event and repository state, calls `save` with the exact constructed `Membership`, is deterministic when a fixed id generator is injected, generates a unique id by default when no generator is injected, performs no authorization check (succeeds for an `organizationId` with no known Organization), and applies no special case for a second Membership grant. 11 tests are new; `npm run test --workspace=@taptime/core` reports 35 test files and 175 tests passing (164 pre-existing + 11 new); `npm run typecheck --workspace=@taptime/core` is clean. No composition-level or `apps/mobile` test exists yet for this capability — no UI/CLI entry point calls `MembershipService`, per DT-018's own Out of Scope.

### 10.72 Common Implementation Pitfalls (Membership Domain & Repository)

- Wiring `MembershipAuthorizationValidator` (or a stub of it) into `MembershipService` "since TS-002's sequence diagram shows it" — that validator does not exist yet (DT-019); DT-018's own Out of Scope forbids any authorization wiring here, and this sprint's tests directly prove no such call occurs.
- Resolving or silently working around the first-Administrator bootstrap question (e.g., special-casing "the first Membership for an Organization needs no authorization") — TS-002's Open Question remains explicitly unresolved; `MembershipService.grantMembership(...)` performs the same unconditional construct-and-save for every call, proven by a dedicated test.
- Adding a `findById(id: MembershipId)` method to `MembershipRepository` "for completeness" — not required by DT-018's Acceptance Criteria or TS-002's Ports section, both of which name only `findByUserId` plus a save method.
- Calling `OrganizationRepository.findById` from inside `MembershipService` to verify the referenced Organization exists — neither DT-018's Acceptance Criteria nor TS-002's Sequence Diagram 2 include this step; `MembershipService` trusts its `organizationId` parameter exactly as `OrganizationManagementService` trusts its `name` parameter.
- Starting DT-019 (`MembershipAuthorizationValidator`), DT-020–DT-022 (repository write extensions), or DT-023–DT-025 (`OrganizationAdministrationService`) "while already in this area" — each is a separate, later Development Task with its own dependencies; none was started by DT-018, confirmed by direct search finding no such file anywhere in the repository, and confirmed by direct grep finding no `save(` method on `CustomerRepository`/`NfcTagRepository`/`NfcAssignmentRepository`.

### 10.74 Membership Authorization Validator Implementation (DT-019)

Development Sprint 014 implements the third slice of FB-002/TS-002 (Organization Management Foundation): `MembershipAuthorizationResult` (`packages/core/src/business/MembershipAuthorizationResult.ts`), a discriminated union mirroring `AssignmentValidationResult`'s `{ status: 'accepted' | 'rejected', reason? }` shape exactly, with `MembershipAuthorizationRejectionReason` restricted to `'membership_not_found' | 'membership_lacks_administrator_role' | 'cross_organization_access'`. `MembershipAuthorizationValidator` (`packages/core/src/business/MembershipAuthorizationValidator.ts`) is a class exposing a single `authorize(membership: Membership | null, organizationId: OrganizationId): MembershipAuthorizationResult` method, with decision logic in exactly this order: a `null` Membership rejects with `membership_not_found`; a non-administrator `role` rejects with `membership_lacks_administrator_role`; an `organizationId` mismatch rejects with `cross_organization_access`; otherwise, accept. The class takes no constructor argument — it is a pure function of its two method inputs.

### 10.75 A Deliberate, Evidence-Required Divergence From `AssignmentValidator`'s Constructor Shape

TS-002 describes `MembershipAuthorizationValidator` as "structurally identical in shape to the existing `AssignmentValidator`," and `AssignmentValidator` is constructed with a `CustomerRepository` that it calls inside `validate()` to resolve the `Customer` an `NfcAssignment` targets. `MembershipAuthorizationValidator` deliberately does not reuse this constructor shape: DT-019's own Acceptance Criteria state directly that the component has "no dependency on any repository directly inside its own decision logic (the Membership is passed in, exactly as `AssignmentValidator.validate()` receives its inputs already resolved)." This is not an inconsistency with the "structurally identical" framing — it is the same underlying principle (a Business component decides without performing I/O itself) applied to a component whose future caller will already have resolved its `Membership` input, unlike `AssignmentValidator`, which must resolve a `Customer` from the `NfcAssignment` it receives. `AssignmentValidator`, `MembershipService`, and `OrganizationManagementService` are all confirmed byte-for-byte unchanged by `git diff` against the pre-Sprint-014 commit; direct grep of `MembershipService.ts` confirms it contains no call to `MembershipAuthorizationValidator` (only a code comment referencing it as future scope) — the validator has no wired caller anywhere in the repository after this sprint.

### 10.76 Testing Strategy for Membership Authorization Validator

`MembershipAuthorizationValidator.test.ts` (6 tests): the accepted case (an Administrator Membership whose `organizationId` matches the target Organization), each of the three required rejection branches independently (`membership_not_found` for a `null` Membership, `membership_lacks_administrator_role` for an Employee Membership, `cross_organization_access` for an Administrator Membership belonging to a different Organization), plus two tests beyond DT-019's minimum bar: purity/determinism (the same inputs always produce the same result) and an explicit proof that no first-Administrator bootstrap special-casing exists (`membership_not_found` is rejected unconditionally, with no branch treating "no Membership yet" as an implicit acceptance). All 6 tests are new; `npm run test --workspace=@taptime/core` reports 36 test files and 181 tests passing (175 pre-existing + 6 new); `npm run typecheck --workspace=@taptime/core` is clean. No composition-level or `apps/mobile` test exists for this capability — no Application Service or entry point calls `MembershipAuthorizationValidator`, per DT-019's own Out of Scope.

### 10.77 Common Implementation Pitfalls (Membership Authorization Validator)

- Giving `MembershipAuthorizationValidator` a constructor dependency on `MembershipRepository` or `OrganizationRepository` "to match `AssignmentValidator`'s shape exactly" — DT-019's Acceptance Criteria explicitly forbid any repository dependency inside the validator's own decision logic; its inputs are passed in already resolved.
- Wiring `MembershipAuthorizationValidator` into `MembershipService` "since it's the obvious next step" — Out of Scope for DT-019; wiring a caller in front of it is DT-023–DT-025's responsibility, not this task's.
- Resolving or silently working around the first-Administrator bootstrap question inside the validator (e.g., a branch that accepts when no Membership exists, reasoning "this must be the first one") — TS-002's Open Question remains explicitly unresolved; `authorize(null, ...)` always rejects with `membership_not_found`, proven by a dedicated test.
- Modifying `AssignmentValidator` to share logic with the new validator ("DRY") — DT-019's Implementation Boundary states `AssignmentValidator` "is not modified in any way"; structural similarity is deliberate, code sharing is not required or requested.
- Starting DT-020–DT-022 (repository write extensions) or DT-023–DT-025 (`OrganizationAdministrationService`) "while already in this area" — each is a separate, later Development Task with its own dependencies; none was started by DT-019, confirmed by direct search finding no `OrganizationAdministrationService` file anywhere in the repository, and confirmed by direct grep finding no `save(` method on `CustomerRepository`/`NfcTagRepository`/`NfcAssignmentRepository`.

### 10.78 Known Gaps (Renumbered; Extended for Development Sprint 014)

DT-006 implements only the in-memory slice needed for DT-004/DT-005 as its default (no synchronization metadata beyond what DT-015 now adds for durability); DT-007/DT-008 remain fake/in-memory-by-default adapters with no real network behavior; no retry scheduling or backoff policy exists yet; DT-005's "stop" and "pending" outcomes remain unimplemented pending Finding F-01 resolution (its `escalation_required` outcome is now classified `'deferred'`, Section 10.45, but the underlying rule remains undefined); `QueuedWorkEventRecord.decision`'s `null` state still has no integration-level test coverage (Section 10.18). DT-008 itself is implemented and tested but not yet reviewed/approved (Chapter 00 Section 10.6). A mobile UI layer exists (DT-012, Sections 10.29–10.34): no simulator/device launch verification has ever been performed in any environment this work has run in (Chapter 00 Section 10.7/10.10/10.13, historical); the on-screen "Synchronize" control cannot trigger `retryable_failure`/`conflict`, only `success` (Section 10.32); no automated component test exists for `ScanScreen`'s React rendering specifically, only for the NFC adapter logic beneath it (Section 10.61). Authentication (DT-013 + DT-014) is fully wired end-to-end, with the same limitations as before (no real managed authentication provider; in-memory-only session; no role/permission enforcement; no credential-management flow). Error classification (DT-009, Sections 10.45–10.49) remains observability-only. Local persistence (DT-015, Sections 10.51–10.56) exists as a durable, file-based option behind the existing ports, not yet wired into `apps/mobile`'s own on-device storage; cloud/backend persistence technology remains undecided (ADR-0007). Real NFC hardware integration (DT-016, Sections 10.58–10.62) now exists for Android, but: physical Android device/NFC-tag validation has not been performed in any environment this work has run in (Section 10.61) — the single most important outstanding item carried forward from Development Sprint 011; iOS support remains an open, undecided product question; NFC tag registration/provisioning still does not exist (depends on Organization Management Administration, DT-024, below). **Organization Management (FB-002/TS-002) now has its first three implemented slices** — `Organization`/`OrganizationRepository`/`OrganizationManagementService` (DT-017, Sections 10.64–10.67), `MembershipId`/`MembershipRole`/`Membership`/`MembershipRepository`/`InMemoryMembershipRepository`/`MembershipService` (DT-018, Sections 10.69–10.72), and `MembershipAuthorizationResult`/`MembershipAuthorizationValidator` (DT-019, Sections 10.74–10.77) — but everything else it names remains unbuilt: the `CustomerRepository`/`NfcTagRepository`/`NfcAssignmentRepository` write extensions (DT-020–DT-022), `OrganizationAdministrationService` and its Customer registration/NFC tag registration/NFC tag assignment methods (DT-023–DT-025), and the scan-pipeline integration verification task (DT-026) are all not started; the Membership-granting bootstrap question TS-002 surfaced (how a new Organization's first Administrator Membership is authorized when no prior Administrator exists) remains explicitly unresolved; `MembershipAuthorizationValidator` has no caller anywhere in the repository; no UI/CLI entry point calls `OrganizationManagementService` or `MembershipService` either, so an Organization or a Membership can be created only from a test today. Development Sprint 005's composition-root/`ScanResultPresenter` narrative has still not been synchronized into this chapter (Chapter 00 Section 10.8) — DT-011's row in Section 10.2's status table is the only place that work is currently reflected here. A viewing/reporting capability remains a named product requirement (`Role_Model.md`, `System_Overview.md`) with no approved architectural component to build against — not attempted this sprint. These gaps are carried over largely unchanged from `EP-007_Development_Tasks.md` and the Sprint 002/003/004/006/007/008/009/010/011/012/013/014 plans; this chapter does not attempt to resolve them.
