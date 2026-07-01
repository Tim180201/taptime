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
