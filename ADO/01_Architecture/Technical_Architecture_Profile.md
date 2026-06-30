# TapTim.e Technical Architecture Profile

Status: Review Ready  
Document ID: TTAP-001  
Epic: EP-003 / EP-007  
Owner: Technical Lead  
Approval Authority: Human Architect  
FDOS Reference: FDOS Genesis Core  
Last Updated: 2026-06-30

## Purpose

The TapTim.e Technical Architecture Profile defines how TapTim.e software is technically designed within the FDOS framework.

FDOS provides the methodology. TapTim.e defines the concrete project architecture.

The Product Vision describes why TapTim.e exists. Feature Blueprints describe what the product shall do. Technical Specifications describe how approved product behavior is implemented within the TapTim.e architecture.

This document does not redefine FDOS. It defines the TapTim.e-specific technical architecture profile used to create implementation-ready specifications.

FDOS Rule:

> Project architecture applies FDOS without redefining FDOS Core.

## Architecture Structure

TTAP-001 is organized into four primary architecture sections:

```text
Architecture Principles
  -> Domain Architecture
  -> Runtime Architecture
  -> Infrastructure Architecture
```

The purpose of this structure is to keep architecture responsibilities explicit and prevent duplicate architectural truth across Feature Blueprints, Technical Specifications and Development Tasks.

FDOS Rule:

> Extend existing architecture before creating new architecture artifacts.

## 1. Architecture Principles

TapTim.e follows these project-level technical architecture principles.

### Domain First

Technology follows the business domain. The domain model is not derived from UI screens, database tables or framework structures.

### Event Driven

Relevant business actions create explicit and auditable Events. Events describe facts that happened.

### Business Engine

Business decisions belong to the Business Engine. No other layer may contain hidden business decisions.

### Stateless UI

The UI displays state and collects user input. It does not make business decisions.

### Offline First

TapTim.e must remain operational when network access is unavailable. Synchronization is handled explicitly and predictably.

### Explicit Architecture

Important technical decisions must be documented. Implicit architecture is treated as a risk.

### Observable Systems

The system must be understandable during operation. Events, logs and evidence support debugging, auditability and organizational learning.

### Extend before Create

Existing repository artifacts shall be extended before new artifacts are created.

New top-level architecture artifacts may only be introduced when an existing artifact cannot carry the responsibility without duplication or ambiguity.

FDOS Rule:

> Architecture quality increases by clarifying existing responsibility before adding new responsibility.

## 2. Domain Architecture

Domain Architecture defines the conceptual business model of TapTim.e.

It is the authoritative place for central domain language, domain relationships, aggregate boundaries, domain events, invariants and Business Engine responsibility.

Feature Blueprints may use this language. They shall not redefine it.

Technical Specifications may implement this architecture. They shall not reinterpret it.

### Ubiquitous Language

| Term | Meaning |
|---|---|
| Organization | A business customer account using TapTim.e. |
| User | A person authenticated in TapTim.e. |
| Employee | A user who records work time. |
| Admin | A user who manages organization data and reviews time tracking information. |
| Customer | A business target for tracked work in v1. |
| NfcTag | A physical NFC token that provides a technical identifier. |
| NfcAssignment | The active mapping between an NFC tag and an Assignment Target. |
| Assignment Target | The business object an NFC tag points to. In v1 this is a Customer. |
| Raw Scan Event | The technical fact that a scan occurred on a device. |
| Work Event | The business-level event created from a valid trigger. |
| Time Entry | A business record representing started, active or completed work time. |
| Business Engine | The domain component that interprets Work Events and derives business outcomes. |
| Offline Queue | The runtime mechanism that stores unsynchronized operational events. |
| Synchronization | The controlled exchange between local operational state and backend persistence. |

### Aggregate Roots

#### Organization

Owns organization-level configuration and business ownership boundaries.

Related entities:

- users,
- customers,
- NFC assignments,
- time entries.

#### NfcTag

Represents a physical NFC token.

The tag itself has no business meaning. Business meaning is resolved through NfcAssignment.

#### NfcAssignment

Represents the current mapping between one NfcTag and one Assignment Target.

NfcAssignment owns assignment validity state.

#### WorkEvent

Represents a business-level work trigger after technical input has been validated and interpreted enough to enter the Business Engine.

#### TimeEntry

Represents tracked work time derived from Work Events and Business Engine decisions.

### Entities

| Entity | Responsibility |
|---|---|
| User | Represents an authenticated person. |
| Employee | Represents a user allowed to create work events. |
| Customer | Represents the v1 assignment target for work. |
| NfcTag | Represents a physical NFC token. |
| NfcAssignment | Represents the mapping from NFC tag to target. |
| WorkEvent | Represents a valid business work event. |
| TimeEntry | Represents a time tracking result. |

### Value Objects

| Value Object | Responsibility |
|---|---|
| OrganizationId | Identifies an organization. |
| UserId | Identifies a user. |
| CustomerId | Identifies a customer. |
| NfcTagId | Identifies an NFC tag internally. |
| NfcPayload | Represents the technical payload read from a tag. |
| AssignmentTarget | Represents target type and target identifier. |
| WorkEventId | Identifies a work event. |
| TimeEntryId | Identifies a time entry. |
| Timestamp | Represents event and record time. |
| SyncState | Represents synchronization state. |
| ScanDeduplicationWindow | Represents duplicate scan protection boundaries. |

### Domain Events

Events are immutable facts and use past-tense names.

Initial domain event language:

- NfcTagScanned
- NfcAssignmentResolved
- NfcAssignmentRejected
- WorkEventCreated
- DuplicateScanIgnored
- TimeEntryStarted
- TimeEntryStopped
- TimeEntryPending
- WorkEventQueuedForSync
- WorkEventSynchronized
- WorkEventSyncFailed

### Business Rules

- An unknown NFC tag shall not create a WorkEvent.
- An inactive NFC assignment shall not create a WorkEvent.
- An NFC tag does not directly represent a customer.
- Business meaning is resolved through NfcAssignment.
- Duplicate scans within the configured protection window shall not create duplicate TimeEntries.
- Core work event capture shall work offline.
- Synchronization failures shall preserve local operational evidence.
- UI shall not decide whether a scan starts or stops work time.
- Persistence shall not decide product meaning.

### Invariants

- Every WorkEvent belongs to exactly one Organization.
- Every WorkEvent is traceable to a trigger.
- Every NFC-triggered WorkEvent is traceable to an NfcTag and NfcAssignment resolution outcome.
- A TimeEntry must be derived from Business Engine logic.
- A TimeEntry shall not be created directly by UI code.
- A rejected scan must be observable as a rejection outcome.
- Offline-created WorkEvents must remain locally available until synchronization succeeds or a recoverable conflict flow exists.

### Relationships

```text
Organization
  -> Users
  -> Customers
  -> NfcTags
  -> NfcAssignments
  -> WorkEvents
  -> TimeEntries

NfcTag
  -> NfcAssignment
  -> AssignmentTarget

NfcTagScanned
  -> NfcAssignmentResolved
  -> WorkEventCreated
  -> Business Engine Decision
  -> TimeEntryStarted / TimeEntryStopped / TimeEntryPending
```

## 3. Runtime Architecture

Runtime Architecture defines how TapTim.e behaves while running.

### System Context

TapTim.e is structured as a layered system:

```text
Mobile App
  -> UI Layer
  -> Application Layer
  -> Business Engine
  -> Domain Layer
  -> Infrastructure Layer
  -> Persistence Layer
  -> Synchronization Layer
```

A Technical Specification must explain where a feature belongs in this system context.

FDOS Rule:

> Implementation work must be placed inside the correct architectural context before development begins.

### Architectural Layers

#### UI Layer

Responsible for user interaction and state presentation. The UI Layer does not contain Business Rules.

#### Application Layer

Responsible for orchestration between UI, Business Engine, Domain and Infrastructure. It coordinates workflows but does not own business decisions.

#### Business Engine

Responsible for business decisions. It evaluates Events, Business Rules and Domain state.

#### Domain Layer

Responsible for core domain concepts and business language. The Domain Layer is independent of UI, persistence and external infrastructure.

#### Infrastructure Layer

Responsible for technical integrations, platform services and external systems. Infrastructure adapts external reality to the internal domain model.

#### Persistence Layer

Responsible for durable storage. Persistence does not define product behavior.

#### Synchronization Layer

Responsible for controlled data exchange between local and remote state. Synchronization must be explicit, observable and conflict-aware.

### Engineering Responsibilities

TapTim.e separates responsibilities strictly:

- UI does not contain Business Rules.
- Application orchestration does not make product decisions.
- Business Engine does not depend on mobile framework classes.
- Domain does not depend on databases.
- Repositories do not contain business decisions.
- Services do not redefine product behavior.
- Events are immutable facts.
- Persistence stores state but does not create product meaning.

FDOS Rule:

> Every layer has a clear responsibility. Responsibility leakage is an architecture defect.

### NFC Work Event Runtime Flow

```text
User scans NFC tag
  -> UI receives scan result
  -> Application Layer creates NfcTagScanned input
  -> Assignment Resolver resolves NfcAssignment
  -> Assignment Validator validates assignment and target
  -> WorkEvent Factory creates WorkEvent
  -> Business Engine evaluates WorkEvent
  -> TimeEntry result is produced
  -> Offline Queue stores unsynchronized event/result when required
  -> Synchronization Layer syncs when possible
  -> UI displays outcome
```

### Error Strategy

Runtime errors shall be categorized as:

- recoverable,
- retryable,
- deferred,
- conflict,
- fatal.

Errors that affect business outcome must be observable and traceable.

### Observability

The system shall preserve enough evidence to understand:

- what trigger occurred,
- which assignment was resolved or rejected,
- which business decision was made,
- whether offline queueing occurred,
- whether synchronization succeeded or failed.

## 4. Infrastructure Architecture

Infrastructure Architecture defines the technical platform boundary.

Infrastructure decisions are governed by ADR-0007.

### Mobile Platform

The mobile platform provides:

- NFC scan capture,
- user interaction,
- local runtime state,
- offline-capable event capture,
- synchronization triggers.

### Backend Platform

The backend platform provides:

- authentication,
- durable persistence,
- security enforcement,
- synchronization targets,
- audit support.

### Authentication

Authentication verifies user identity and organization access.

Authentication does not define product behavior.

### Persistence

Persistence stores:

- organization records,
- users and roles,
- customers,
- NFC tags,
- NFC assignments,
- work events,
- time entries,
- synchronization metadata.

Persistence shall not define domain language or Business Rules.

### Deployment and CI/CD

Deployment and CI/CD shall support:

- repeatable builds,
- test execution,
- review evidence,
- migration validation where required,
- release traceability.

### External Services

External services may support authentication, persistence, hosting or operational observability.

External services must not own TapTim.e product decisions.

## Technical Architecture Specification

A Technical Architecture Specification answers how an approved Feature Blueprint is implemented in TapTim.e.

It must describe:

- affected architectural layers,
- involved components,
- changed interfaces,
- created or processed Events,
- changed data structures,
- persistence impact,
- synchronization impact,
- technical risks,
- required tests.

It must not redefine Product Vision, Product Principles, Business Goals, User Goals, Business Rules or Product Rules.

FDOS Rule:

> The Technical Architecture Specification implements the approved Blueprint. It does not reinterpret it.

## Completion Requirement

A Technical Architecture Specification is complete when an unfamiliar senior software engineer can implement the feature without requiring architectural interpretation.

The engineer may ask implementation questions. The engineer must not need to ask architectural questions.

FDOS Rule:

> Technical ambiguity must be resolved before implementation begins.

## System Architecture Requirements

Every Technical Architecture Specification documents:

- system context,
- architecture overview,
- component responsibilities,
- interface contracts,
- data flow,
- dependency rules,
- affected external systems.

The specification identifies affected layers and unchanged layers.

Component responsibilities must not overlap unnecessarily.

Interface contracts describe inputs, outputs, error conditions and side effects. They describe communication, not implementation.

Data flow documents where information moves, where state changes occur and where Events are produced.

Allowed dependency direction follows the architectural layering from UI toward persistence. Reverse dependencies are not permitted unless explicitly justified.

## Runtime Architecture Requirements

Every Technical Architecture Specification documents runtime behavior through:

- Event Architecture,
- State Management,
- Persistence Strategy,
- Synchronization Strategy,
- Error Strategy,
- Observability,
- Technical Risks,
- Architecture Decisions.

Events document producers, consumers, triggers, follow-up events and architectural impact.

Business state never belongs to the UI.

Persistence stores state but never defines product behavior.

Synchronization documents trigger, local changes, queue behavior, conflict strategy, retry strategy and remote confirmation.

Errors are categorized as recoverable, retryable, deferred, conflict or fatal.

Architecture decisions explain why a solution was chosen.

FDOS Rule:

> Runtime behavior shall be explained through explicit event flow.

## Engineering Quality Requirements

Every Technical Architecture Specification evaluates:

- Security Architecture,
- Performance Strategy,
- Reliability,
- Testability,
- Observability Quality,
- Deployment Considerations,
- Maintainability.

Security is an architectural concern, not an implementation detail.

Performance-critical operations, asynchronous processing, blocking operations, expected performance goals and resource considerations must be documented.

Reliability documents failure scenarios, recovery strategy, offline behavior, duplicate handling and consistency guarantees.

Testability explains testable components, isolation strategy, mocking boundaries, deterministic behavior and integration testing scope.

Deployment considerations include database migrations, infrastructure changes, API changes, feature flags, rollback strategy and deployment risks.

FDOS Rule:

> Engineering quality shall be designed before implementation begins.

## Implementation Strategy Requirements

Every Technical Architecture Specification defines:

- implementation approach,
- incremental delivery,
- migration strategy,
- backward compatibility,
- rollout strategy,
- risk reduction,
- testing strategy,
- release evidence.

The implementation approach explains whether the feature extends existing architecture, introduces new components or replaces existing functionality.

Incremental delivery should reduce risk and provide measurable progress.

Migration is documented even when no migration is required.

Backward compatibility covers previous application versions, existing APIs, stored data and historical events.

Release evidence may include test results, review outcomes, migration validation, runtime evidence and operational verification.

FDOS Rule:

> A feature is complete only when implementation is supported by objective engineering evidence.

## Technical Architecture Template

Every Technical Architecture Specification follows this template:

1. Technical Overview
2. System Context
3. Architecture Overview
4. Components
5. Interfaces
6. Data Flow
7. Runtime Behaviour
8. Persistence
9. Synchronization
10. Security
11. Performance
12. Testing
13. Deployment
14. Risks
15. Architecture Decisions
16. Release Evidence

## Naming Conventions

Events use past-tense facts.

Services describe responsibilities.

Repositories represent aggregates.

Components describe business capabilities.

## Documentation Standards

Architecture documentation shall:

- eliminate ambiguity,
- document responsibilities,
- define boundaries,
- justify decisions,
- avoid implementation details.

## Engineering Best Practices

- Business Rules never belong to the UI.
- Repositories do not contain business logic.
- Events are immutable.
- Components have one responsibility.
- Prefer explicit architecture over implicit assumptions.
- Prefer simplicity over unnecessary complexity.
- Extend existing artifacts before creating new artifacts.

## Architecture Review Checklist

Before approval verify:

- architecture complete,
- layering correct,
- responsibilities defined,
- interfaces documented,
- runtime behaviour explained,
- risks documented,
- security reviewed,
- performance assessed,
- deployment evaluated,
- no duplicate architectural source of truth introduced.

## Engineering Checklist

Before implementation verify:

- architecture understood,
- risks accepted,
- migration evaluated,
- testing planned,
- rollout planned,
- monitoring prepared,
- evidence identified.

## Living Architecture

Technical Architecture Specifications are living engineering documents.

They evolve with the product and always reflect the current architectural reality.

## Closing Principles

Architecture before implementation.

Explicit decisions before implicit assumptions.

Quality before speed.

Understandability before complexity.

Maintainability before short-term optimization.

Every implementation begins with architecture. Every architecture serves the product.

Extend before Create.

## Engineering Baseline

This Technical Architecture Profile establishes the architectural engineering baseline for all future Technical Architecture Specifications within the TapTim.e project.

EP-007 extends TTAP-001 into the Product Architecture Foundation by adding Domain Architecture, Runtime Architecture and Infrastructure Architecture without creating a separate Domain Model artifact.
