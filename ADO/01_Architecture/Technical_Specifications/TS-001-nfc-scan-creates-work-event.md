# TS-001 – NFC Scan Creates Work Event Technical Specification

Status: Approved  
Specification ID: TS-001  
Related Feature Blueprint: FB-001  
Epic: EP-007 – Product Architecture Foundation  
Owner: Technical Lead  
Approval Authority: Human Architect  
Last Updated: 2026-07-13
Engine Decision Amendment: Approved by Human Architect, 2026-07-13
Related Architecture: `ADO/01_Architecture/Technical_Architecture_Profile.md`  
Related ADRs: ADR-0002, ADR-0003, ADR-0004, ADR-0005, ADR-0006, ADR-0007  
Related Development Tasks: `ADO/02_Development/EP-007_Development_Tasks.md`

## Purpose

TS-001 defines the technical implementation baseline for NFC Scan Creates Work Event.

It implements FB-001 without redefining product intent.

## Architecture Flow

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

## Component Responsibilities

| Component | Responsibility |
|---|---|
| NfcScanAdapter | Read platform NFC payload and normalize it. |
| NfcScanApplicationService | Orchestrate the scan flow. |
| AssignmentResolver | Resolve NFC payload to assignment. |
| AssignmentValidator | Validate assignment and target. |
| WorkEventFactory | Create WorkEvent from valid scan context. |
| BusinessEngine | Interpret WorkEvent and derive business result. |
| TimeEntryGenerator | Create or complete TimeEntry records. |
| WorkEventRepository | Persist WorkEvent records. |
| OfflineQueue | Preserve pending sync records. |
| SynchronizationService | Synchronize local records with backend persistence. |
| ScanResultPresenter | Provide display-ready scan result. |

## Layer Rules

- UI does not decide business outcome.
- Application layer orchestrates but does not own Business Rules.
- Business Engine owns business decisions.
- Domain layer is independent from UI, NFC libraries and persistence APIs.
- Persistence stores state but does not define product behavior.
- Synchronization preserves local evidence until success or conflict handling.

## Runtime Behaviour

### Online Flow

1. Employee scans NFC tag.
2. Adapter reads NFC payload.
3. Application service resolves assignment.
4. Validator confirms assignment and target.
5. Factory creates WorkEvent.
6. Business Engine derives result.
7. TimeEntry result is produced.
8. Records are persisted.
9. Synchronization confirms remote state.
10. UI displays outcome.

### Offline Flow

1. Employee scans NFC tag.
2. Local assignment data is used.
3. WorkEvent is created if local rules allow.
4. Business Engine derives local result.
5. Records are stored locally.
6. OfflineQueue marks pending sync.
7. SynchronizationService retries later.
8. UI displays local confirmation with pending state.

### Rejection Flow

1. Scan input is unreadable, unknown, inactive, invalid or unauthorized.
2. Resolver or validator rejects the input.
3. No normal WorkEvent is created.
4. Rejection outcome is observable.
5. UI displays safe result information.

### Business Engine Decision Context

Every validated WorkEvent reaches the Business Engine as a trigger, never as a preselected start or stop command.

The Business Engine evaluates:

- authenticated `UserId`,
- `OrganizationId`,
- resolved `AssignmentTarget`,
- WorkEvent timestamp,
- the User's active TimeEntry, if any,
- the previous accepted scan for the same User and AssignmentTarget,
- the five-second duplicate protection window.

The Application Layer may load and pass required state into the Business Engine. It shall not interpret that state or select the business outcome.

### Version 1 Decision Table

| Condition | Business Engine outcome |
|---|---|
| Previous accepted scan for the same User and AssignmentTarget occurred less than five seconds earlier | `duplicate_scan_ignored` |
| User has no active TimeEntry | `time_entry_started` for the resolved AssignmentTarget |
| User has an active TimeEntry for the resolved AssignmentTarget | `time_entry_stopped` |
| User has an active TimeEntry for another AssignmentTarget | `active_entry_for_other_target_rejected` |
| Required state is ambiguous or inconsistent | `escalation_required` |

Duplicate evaluation occurs before start or stop evaluation. Different Users are evaluated independently, including when they scan the same AssignmentTarget.

### TimeEntry Lifecycle Requirements

A TimeEntry shall contain or reference:

- its owning `OrganizationId`,
- its owning `UserId`,
- its `AssignmentTarget`,
- its lifecycle status (`started` or `stopped`),
- `startedAt`,
- the WorkEvent that started it,
- `stoppedAt` and the WorkEvent that stopped it when completed.

Duration is derived from `startedAt` and `stoppedAt` and shall not be persisted as an independently mutable value.

The TimeEntry repository boundary shall support:

- finding the active TimeEntry for a User,
- distinguishing same-target from other-target active state,
- persisting a newly started TimeEntry,
- replacing or updating that TimeEntry with its stopped state without creating a second active record.

The Business Engine remains a pure decision boundary: required state is passed explicitly and no hidden repository dependency is introduced into the engine.

## Persistence Requirements

Persistence must support:

- NfcTag records,
- NfcAssignment records,
- AssignmentTarget references,
- WorkEvent records,
- TimeEntry records,
- User ownership of TimeEntry records,
- start and stop WorkEvent traceability,
- SyncState metadata,
- rejection or diagnostic evidence where required.

## Synchronization Requirements

Synchronization must support:

- pending WorkEvent queue,
- retryable failures,
- duplicate-safe sync,
- conflict detection,
- remote confirmation,
- local preservation until success or conflict handling.

## Security Requirements

- user must be authenticated,
- organization context must be verified,
- employee must have permission to create WorkEvents,
- assignment target must belong to the organization,
- backend writes must enforce organization boundaries.

## Testing Requirements

Required tests:

- NFC adapter boundary,
- assignment resolver,
- assignment validator,
- WorkEvent factory,
- Business Engine,
- TimeEntry generator,
- five-second duplicate scan protection before start/stop evaluation,
- start -> stop -> restart lifecycle for the same User and AssignmentTarget,
- independent TimeEntries for different Users on the same AssignmentTarget,
- rejection of parallel active TimeEntries for different AssignmentTargets by the same User,
- offline queue,
- synchronization retry,
- rejection outcome,
- architecture boundaries.

## Risks

| Risk | Mitigation |
|---|---|
| NFC support differs between devices | Validate early on target devices. |
| Offline assignment data is stale | Define sync freshness and conflict handling. |
| Duplicate scans create unintended stop/start transitions | Apply the five-second per-User/per-AssignmentTarget protection window before lifecycle evaluation. |
| One User accumulates parallel active TimeEntries | Query active state by User and reject another target in version 1. |
| One User stops another User's TimeEntry | Persist User ownership and evaluate active state per User. |
| Business logic leaks into UI | Test and review layer boundaries. |
| Persistence model becomes domain model | Keep domain types independent. |
| Synchronization conflicts are hidden | Preserve conflict evidence. |

## Release Evidence

Required release evidence:

- implementation summary,
- changed files,
- test output,
- offline validation,
- synchronization validation,
- architecture compliance review,
- Role Handover.
