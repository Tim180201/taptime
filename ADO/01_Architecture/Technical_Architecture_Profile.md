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

The Product Vision describes why TapTim.e exists. The Feature Blueprint describes what the product shall do. The Technical Architecture Specification describes how approved product behavior is implemented within the TapTim.e architecture.

This document does not redefine FDOS. It defines the TapTim.e-specific technical architecture profile used to create implementation-ready specifications.

FDOS Rule:

> Project architecture applies FDOS without redefining FDOS Core.

## Architectural Principles

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

## System Context

TapTim.e is structured as a layered system:

```text
Mobile App
  -> Application Layer
  -> Business Engine
  -> Domain
  -> Infrastructure
  -> Persistence
  -> Synchronization
```

A Technical Architecture Specification must explain where a feature belongs in this system context.

FDOS Rule:

> Implementation work must be placed inside the correct architectural context before development begins.

## Architectural Layers

### UI Layer

Responsible for user interaction and state presentation. The UI Layer does not contain Business Rules.

### Application Layer

Responsible for orchestration between UI, Business Engine, Domain and Infrastructure. It coordinates workflows but does not own business decisions.

### Business Engine

Responsible for business decisions. It evaluates Events, Business Rules and Domain state.

### Domain Layer

Responsible for core domain concepts and business language. The Domain Layer is independent of UI, persistence and external infrastructure.

### Infrastructure Layer

Responsible for technical integrations, platform services and external systems. Infrastructure adapts external reality to the internal domain model.

### Persistence Layer

Responsible for durable storage. Persistence does not define product behavior.

### Synchronization Layer

Responsible for controlled data exchange between local and remote state. Synchronization must be explicit, observable and conflict-aware.

## Engineering Responsibilities

TapTim.e separates responsibilities strictly:

- UI does not contain Business Rules.
- Application orchestration does not make product decisions.
- Business Engine does not depend on framework classes.
- Domain does not depend on databases.
- Repositories do not contain business decisions.
- Services do not redefine product behavior.
- Events are immutable facts.
- Persistence stores state but does not create product meaning.

FDOS Rule:

> Every layer has a clear responsibility. Responsibility leakage is an architecture defect.

## EP-007 Product Architecture Foundation

EP-007 extends TTAP-001 into the Product Architecture Foundation without creating a separate Domain Model artifact.

Architecture is organized as:

```text
Architecture Principles
  -> Domain Architecture
  -> Runtime Architecture
  -> Infrastructure Architecture
```

## Domain Architecture

Domain Architecture defines the conceptual business model of TapTim.e.

It is the authoritative place for central domain language, relationships, aggregate boundaries, domain events, invariants and Business Engine responsibility.

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
| WorkEvent | The business-level event created from a valid trigger. |
| TimeEntry | A business record representing started, active or completed work time. |
| Business Engine | The domain component that interprets WorkEvents and derives business outcomes. |
| Offline Queue | The runtime mechanism that stores unsynchronized operational events. |
| Synchronization | The controlled exchange between local operational state and backend persistence. |

### Aggregate Roots

- Organization
- NfcTag
- NfcAssignment
- WorkEvent
- TimeEntry

### Value Objects

- OrganizationId
- UserId
- CustomerId
- NfcTagId
- NfcPayload
- AssignmentTarget
- WorkEventId
- TimeEntryId
- Timestamp
- SyncState
- ScanDeduplicationWindow

### Domain Events

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

### Invariants

- Every WorkEvent belongs to exactly one Organization.
- Every WorkEvent is traceable to a trigger.
- Every NFC-triggered WorkEvent is traceable to an NfcTag and NfcAssignment resolution outcome.
- A TimeEntry must be derived from Business Engine logic.
- A TimeEntry shall not be created directly by UI code.
- A rejected scan must be observable as a rejection outcome.
- Offline-created WorkEvents must remain locally available until synchronization succeeds or a recoverable conflict flow exists.

## Runtime Architecture

Runtime Architecture defines how TapTim.e behaves while running.

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

Errors shall be categorized as recoverable, retryable, deferred, conflict or fatal.

## Infrastructure Architecture

Infrastructure Architecture defines the technical platform boundary and is governed by ADR-0007.

The mobile platform provides NFC scan capture, user interaction, local runtime state, offline-capable event capture and synchronization triggers.

The backend platform provides authentication, durable persistence, security enforcement, synchronization targets and audit support.

Persistence stores organization records, users and roles, customers, NFC tags, NFC assignments, work events, time entries and synchronization metadata.

External services may support authentication, persistence, hosting or operational observability. External services must not own TapTim.e product decisions.

## Technical Architecture Specification

A Technical Architecture Specification answers how an approved Feature Blueprint is implemented in TapTim.e.

It must describe affected layers, components, interfaces, events, data structures, persistence impact, synchronization impact, risks and tests.

It must not redefine Product Vision, Product Principles, Business Goals, User Goals, Business Rules or Product Rules.

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

## Closing Principles

Architecture before implementation.

Explicit decisions before implicit assumptions.

Quality before speed.

Understandability before complexity.

Maintainability before short-term optimization.

Every implementation begins with architecture. Every architecture serves the product.

Extend before Create.
