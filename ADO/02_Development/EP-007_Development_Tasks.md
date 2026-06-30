# EP-007 Development Tasks – NFC Scan Creates Work Event

Status: Draft  
Epic: EP-007 – Product Architecture Foundation  
Owner: Technical Lead  
Approval Authority: Human Architect  
Related Feature Blueprint: `ADO/01_Architecture/Feature_Blueprints/FB-001-nfc-scan-creates-work-event.md`  
Related Technical Specification: `ADO/01_Architecture/Technical_Specifications/TS-001-nfc-scan-creates-work-event.md`  
Related Architecture: `ADO/01_Architecture/Technical_Architecture_Profile.md`  
Created Date: 2026-06-30  
Last Updated: 2026-06-30

## Purpose

This document defines the initial Development Task structure for implementing TS-001.

Development Tasks are bounded implementation units. They do not redefine product intent, Business Rules or architecture.

FDOS Rule:

> Development Tasks implement approved architecture without redefining product intent or architectural decisions.

## Task Sequence

```text
DT-001 NFC Scan Adapter
  -> DT-002 Assignment Resolver
  -> DT-003 Assignment Validator
  -> DT-004 WorkEvent Factory
  -> DT-005 TimeEntry Generator
  -> DT-006 Repository Layer
  -> DT-007 Offline Queue
  -> DT-008 Synchronization Service
  -> DT-009 Error Handling
  -> DT-010 Tests
```

## DT-001 – NFC Scan Adapter

Status: Draft  
Task Type: Feature Task  
Priority: High  
Owner: Development Agent  
Engineering Effort: Medium

### Objective

Implement the technical adapter boundary that reads NFC payloads and exposes normalized scan data to the Application Layer.

### In Scope

- NFC adapter interface.
- Normalized NfcPayload output.
- Adapter-level errors.
- Platform boundary isolation.

### Out of Scope

- Assignment resolution.
- WorkEvent creation.
- Business Engine decisions.
- Persistence.

### Acceptance Criteria

- Adapter exposes normalized NFC payloads.
- Adapter errors are explicit.
- Domain and Business Engine do not depend on NFC library APIs.
- Tests or validation evidence are provided where feasible.

## DT-002 – Assignment Resolver

Status: Draft  
Task Type: Feature Task  
Priority: High  
Owner: Development Agent  
Engineering Effort: Medium

### Objective

Resolve an NfcPayload to an NfcAssignment within organization context.

### In Scope

- Assignment lookup boundary.
- Unknown tag handling.
- Organization-scoped resolution.

### Out of Scope

- Assignment validity rules.
- WorkEvent creation.
- TimeEntry generation.

### Acceptance Criteria

- Known tags resolve to assignments.
- Unknown tags return explicit rejection.
- Resolution does not create WorkEvents.
- Tests cover known and unknown tag cases.

## DT-003 – Assignment Validator

Status: Draft  
Task Type: Feature Task  
Priority: High  
Owner: Development Agent  
Engineering Effort: Medium

### Objective

Validate whether a resolved assignment and target may create a WorkEvent.

### In Scope

- Active assignment validation.
- Target existence validation.
- Employee access validation.
- Rejection reason output.

### Out of Scope

- NFC payload reading.
- Persistence schema design.
- TimeEntry decisions.

### Acceptance Criteria

- Inactive assignments are rejected.
- Missing targets are rejected.
- Unauthorized access is rejected.
- Valid assignments produce a validation success result.

## DT-004 – WorkEvent Factory

Status: Draft  
Task Type: Feature Task  
Priority: High  
Owner: Development Agent  
Engineering Effort: Medium

### Objective

Create WorkEvent domain objects from valid scan and assignment context.

### In Scope

- WorkEvent creation.
- Required domain identifiers.
- Timestamp handling.
- Traceability to scan and assignment.

### Out of Scope

- Business Engine decision logic.
- Synchronization.
- UI feedback.

### Acceptance Criteria

- WorkEvent contains required traceability.
- Invalid inputs do not create WorkEvents.
- Factory has deterministic tests.

## DT-005 – TimeEntry Generator

Status: Draft  
Task Type: Feature Task  
Priority: High  
Owner: Development Agent  
Engineering Effort: Medium

### Objective

Derive TimeEntry results from Business Engine decisions.

### In Scope

- Start outcome.
- Stop outcome.
- Pending outcome.
- Business Engine integration boundary.

### Out of Scope

- UI decision logic.
- Direct NFC handling.
- Synchronization implementation.

### Acceptance Criteria

- TimeEntry results derive from Business Engine decisions.
- UI does not decide start or stop.
- Tests cover start, stop and pending outcomes.

## DT-006 – Repository Layer

Status: Draft  
Task Type: Feature Task  
Priority: Medium  
Owner: Development Agent  
Engineering Effort: Medium

### Objective

Implement repository boundaries for storing and loading WorkEvents, TimeEntries and assignment data required by TS-001.

### In Scope

- Repository interfaces.
- Persistence adapter boundaries.
- WorkEvent persistence.
- TimeEntry persistence.
- Assignment read access.

### Out of Scope

- Business Rules.
- UI state.
- Platform NFC access.

### Acceptance Criteria

- Repositories do not contain business decisions.
- Domain objects are not replaced by persistence document shapes.
- Persistence failures are explicit.

## DT-007 – Offline Queue

Status: Draft  
Task Type: Feature Task  
Priority: High  
Owner: Development Agent  
Engineering Effort: Medium

### Objective

Implement offline queue behavior for unsynchronized WorkEvents and related outcomes.

### In Scope

- Pending sync state.
- Local preservation.
- Retry eligibility.
- Queue failure handling.

### Out of Scope

- Remote synchronization protocol.
- Business Engine decisions.

### Acceptance Criteria

- Offline WorkEvents can be queued.
- Queue records preserve traceability.
- Queue failures are observable.
- Tests cover offline queue behavior.

## DT-008 – Synchronization Service

Status: Draft  
Task Type: Feature Task  
Priority: High  
Owner: Development Agent  
Engineering Effort: Large

### Objective

Synchronize queued WorkEvents and related results with backend persistence.

### In Scope

- Sync attempt flow.
- Retryable failure handling.
- Conflict detection boundary.
- Remote confirmation handling.

### Out of Scope

- NFC scan handling.
- Business Rule definitions.
- UI design.

### Acceptance Criteria

- Queued records can synchronize.
- Retryable failures preserve local state.
- Conflicts are observable.
- Successful synchronization updates SyncState.

## DT-009 – Error Handling

Status: Draft  
Task Type: Enhancement Task  
Priority: Medium  
Owner: Development Agent  
Engineering Effort: Medium

### Objective

Implement explicit error handling for scan, assignment, WorkEvent, persistence and synchronization failures.

### In Scope

- Recoverable errors.
- Retryable errors.
- Deferred errors.
- Conflict errors.
- Fatal errors.
- User-safe result mapping.

### Out of Scope

- Product copywriting.
- Full UI design.
- Business Rule changes.

### Acceptance Criteria

- Errors are categorized consistently with TTAP-001.
- User-facing outcomes are clear enough for implementation.
- Technical errors remain observable for evidence and debugging.

## DT-010 – Tests

Status: Draft  
Task Type: Testing Task  
Priority: High  
Owner: Development Agent  
Engineering Effort: Large

### Objective

Create verification coverage for the NFC Scan Creates Work Event implementation.

### In Scope

- Domain tests.
- Business Engine tests.
- Assignment tests.
- WorkEvent tests.
- TimeEntry tests.
- Offline queue tests.
- Synchronization tests.
- Architecture boundary tests.

### Out of Scope

- Manual release approval.
- Product acceptance.

### Acceptance Criteria

- Tests verify normal, rejection, duplicate and offline flows.
- Tests verify Business Rules stay outside UI and persistence.
- Test evidence is attached to implementation handover.

## Dependencies

- ADR-0007 must exist.
- TTAP-001 EP-007 extension must exist.
- FB-001 must exist.
- TS-001 must exist.
- Development Agent shall not implement tasks before Technical Lead handover and Human Architect approval where required.

## Risks

- Task boundaries may need refinement after implementation begins.
- NFC platform validation may create follow-up tasks.
- Synchronization conflict handling may require additional dedicated tasks.
- Security rules may require infrastructure-specific tasks after backend configuration is finalized.

## Completion Rule

This task structure is ready for Development Agent planning only after Review Agent approval of the EP-007 repository integration.
