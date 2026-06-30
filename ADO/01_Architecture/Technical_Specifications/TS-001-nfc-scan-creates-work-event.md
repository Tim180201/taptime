# TS-001 – NFC Scan Creates Work Event Technical Specification

Status: Draft  
Specification ID: TS-001  
Related Feature Blueprint: FB-001  
Epic: EP-007 – Product Architecture Foundation  
Owner: Technical Lead  
Approval Authority: Human Architect  
Created Date: 2026-06-30  
Last Updated: 2026-06-30  
Related Architecture: `ADO/01_Architecture/Technical_Architecture_Profile.md`  
Related ADRs: ADR-0002, ADR-0003, ADR-0004, ADR-0005, ADR-0006, ADR-0007  
Related Development Tasks: `ADO/02_Development/EP-007_Development_Tasks.md`

## 1. Technical Overview

TS-001 transforms FB-001 into an implementation-ready technical design.

It defines the component responsibilities, interfaces, data flow, error handling, runtime behavior, persistence impact, synchronization impact and testing requirements for NFC Scan Creates Work Event.

TS-001 does not redefine product intent, Business Rules, domain language or architecture principles.

FDOS Rule:

> Technical Specifications implement approved Blueprint behavior without reinterpreting it.

## 2. System Context

The feature runs through the following architecture context:

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

Affected layers:

- UI Layer
- Application Layer
- Business Engine
- Domain Layer
- Infrastructure Layer
- Persistence Layer
- Synchronization Layer

Unchanged layers:

- Product Vision
- Feature Blueprint Standard
- Development Task Profile

## 3. Architecture Overview

The normal technical flow is:

```text
NFC Scan
  -> NfcScanAdapter
  -> NfcScanApplicationService
  -> AssignmentResolver
  -> AssignmentValidator
  -> WorkEventFactory
  -> BusinessEngine
  -> TimeEntryGenerator
  -> WorkEventRepository
  -> OfflineQueue
  -> SynchronizationService
  -> ScanResultPresenter
```

The UI triggers the flow and displays the result. It does not make business decisions.

The Business Engine decides the time tracking outcome.

Persistence stores operational state but does not define business meaning.

## 4. Components

### NfcScanAdapter

Layer: Infrastructure  
Responsibility: Read NFC payload from the mobile platform and return a normalized NfcPayload.

Does not:

- resolve assignments,
- create WorkEvents,
- make Business Engine decisions.

### NfcScanApplicationService

Layer: Application  
Responsibility: Orchestrate the scan flow across adapter, resolver, validator, factory, Business Engine and persistence.

Does not:

- own Business Rules,
- directly manipulate UI state,
- define persistence schema.

### AssignmentResolver

Layer: Domain / Application boundary  
Responsibility: Resolve NfcPayload to NfcAssignment inside organization context.

### AssignmentValidator

Layer: Domain  
Responsibility: Validate whether the resolved assignment can create a WorkEvent.

### WorkEventFactory

Layer: Domain  
Responsibility: Create a WorkEvent from a valid scan and assignment resolution.

### BusinessEngine

Layer: Business Engine  
Responsibility: Interpret WorkEvent and derive TimeEntry result.

### TimeEntryGenerator

Layer: Domain / Business Engine  
Responsibility: Create or complete TimeEntry records according to Business Engine decisions.

### WorkEventRepository

Layer: Persistence  
Responsibility: Save and load WorkEvent records.

Does not make business decisions.

### OfflineQueue

Layer: Synchronization  
Responsibility: Preserve unsynchronized WorkEvents and related outcomes until synchronization can occur.

### SynchronizationService

Layer: Synchronization  
Responsibility: Synchronize queued WorkEvents and resulting records with backend persistence.

### ScanResultPresenter

Layer: Application / UI boundary  
Responsibility: Provide display-ready scan outcomes to the UI.

Does not determine business outcome.

## 5. Interfaces

### NfcScanAdapter

Input:

- none or platform scan trigger.

Output:

- NfcPayload
- adapter error.

### NfcScanApplicationService

Input:

- authenticated user context,
- organization context,
- scan request.

Output:

- ScanResult.

### AssignmentResolver

Input:

- OrganizationId,
- NfcPayload.

Output:

- NfcAssignmentResolved
- NfcAssignmentRejected.

### AssignmentValidator

Input:

- Employee,
- NfcAssignment,
- AssignmentTarget.

Output:

- valid assignment result,
- rejection reason.

### WorkEventFactory

Input:

- OrganizationId,
- EmployeeId,
- NfcTagId,
- NfcAssignment,
- AssignmentTarget,
- Timestamp.

Output:

- WorkEvent.

### BusinessEngine

Input:

- WorkEvent,
- relevant current domain state.

Output:

- TimeEntryStarted,
- TimeEntryStopped,
- TimeEntryPending,
- rejection outcome.

### WorkEventRepository

Input:

- WorkEvent.

Output:

- persisted WorkEvent reference or persistence error.

### OfflineQueue

Input:

- WorkEvent,
- TimeEntry outcome,
- SyncState.

Output:

- queued state or queue error.

### SynchronizationService

Input:

- queued WorkEvent records.

Output:

- synchronization success,
- retryable failure,
- conflict,
- fatal failure.

## 6. Data Flow

```text
NfcPayload
  -> NfcAssignment
  -> AssignmentTarget
  -> WorkEvent
  -> BusinessEngineDecision
  -> TimeEntryResult
  -> Local Persistence
  -> Offline Queue
  -> Remote Synchronization
```

Business state is derived before persistence.

Persistence stores the result of domain decisions. It does not create the decision.

## 7. Runtime Behaviour

### Normal Online Flow

1. Employee scans NFC tag.
2. Adapter reads payload.
3. Application Service resolves assignment.
4. Validator confirms assignment.
5. Factory creates WorkEvent.
6. Business Engine derives TimeEntry result.
7. WorkEvent and TimeEntry result are persisted.
8. Synchronization confirms remote state.
9. UI displays confirmation.

### Offline Flow

1. Employee scans NFC tag.
2. Adapter reads payload.
3. Assignment resolution uses locally available assignment data.
4. WorkEvent is created if local data permits.
5. Business Engine derives local outcome.
6. WorkEvent and outcome are stored locally.
7. OfflineQueue marks item as pending.
8. SynchronizationService retries later.
9. UI displays local confirmation with pending sync state.

### Rejection Flow

1. Employee scans NFC tag.
2. Resolver or validator rejects scan.
3. No normal WorkEvent is created.
4. Rejection outcome is observable.
5. UI displays clear rejection reason where appropriate.

## 8. Persistence

Persistence must support:

- NfcTag records,
- NfcAssignment records,
- AssignmentTarget references,
- WorkEvent records,
- TimeEntry records,
- SyncState metadata,
- rejection or diagnostic evidence where required.

Persistence does not define product behavior.

## 9. Synchronization

Synchronization must support:

- pending WorkEvent queue,
- retryable failures,
- duplicate-safe synchronization,
- conflict detection,
- remote confirmation,
- local preservation until success or conflict handling.

Synchronization failures shall not remove local evidence.

## 10. Security

Security requirements:

- user must be authenticated,
- organization context must be verified,
- employee must have permission to create WorkEvents,
- assignment target must belong to the organization,
- backend writes must enforce organization boundaries.

Security rules protect data access but do not replace Business Engine decisions.

## 11. Performance

The scan feedback loop should feel immediate.

Performance-sensitive areas:

- NFC payload read,
- local assignment lookup,
- Business Engine decision,
- local persistence write,
- UI confirmation.

Remote synchronization must not block local scan confirmation when offline-first behavior applies.

## 12. Testing

Required test categories:

- NfcScanAdapter boundary tests,
- AssignmentResolver tests,
- AssignmentValidator tests,
- WorkEventFactory tests,
- BusinessEngine tests,
- TimeEntryGenerator tests,
- duplicate scan protection tests,
- offline queue tests,
- synchronization retry tests,
- rejection outcome tests,
- architecture boundary tests.

## 13. Deployment

No production deployment shall occur until:

- platform NFC capability is validated,
- local persistence works,
- offline queue behavior is tested,
- backend security boundaries are tested,
- synchronization behavior is verified,
- evidence is attached to the Development Task completion.

## 14. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| NFC support differs between devices | Scan reliability risk | Validate early on target devices. |
| Offline assignment data is stale | Incorrect local decision risk | Define sync freshness and conflict handling. |
| Duplicate scans create duplicate TimeEntries | Data integrity risk | Implement duplicate protection. |
| Business logic leaks into UI | Architecture risk | Test and review layer boundaries. |
| Persistence model becomes domain model | Maintainability risk | Keep domain types independent from persistence. |
| Synchronization conflicts are hidden | Auditability risk | Preserve conflict evidence. |

## 15. Architecture Decisions

TS-001 depends on:

- ADR-0002 NFC Assignment Model,
- ADR-0004 Offline-first Core Events,
- ADR-0005 Event-driven Business Engine,
- ADR-0006 Domain-first Architecture,
- ADR-0007 Technology Platform Baseline.

No new ADR is introduced by TS-001.

## 16. Release Evidence

Required release evidence:

- implementation summary,
- changed files,
- test output,
- offline behavior validation,
- synchronization validation,
- architecture compliance review,
- Review Agent decision,
- Role Handover.
