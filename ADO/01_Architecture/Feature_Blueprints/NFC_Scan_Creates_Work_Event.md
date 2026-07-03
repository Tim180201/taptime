# FB-001 – NFC Scan Creates Work Event

Status: Approved  
Feature ID: FB-001  
Feature Name: NFC Scan Creates Work Event  
Epic: EP-007 – Product Architecture Foundation  
Owner: Technical Lead  
Approval Authority: Human Architect  
Related Product Vision: `ADO/01_Architecture/Product_Vision.md`  
Related Architecture: `ADO/01_Architecture/Technical_Architecture_Profile.md`  
Related ADRs: ADR-0002, ADR-0003, ADR-0004, ADR-0005, ADR-0006, ADR-0007  
Related Technical Specification: `ADO/01_Architecture/Technical_Specifications/TS-001-nfc-scan-creates-work-event.md`

## Purpose

FB-001 defines the first core product feature for TapTim.e.

It describes what shall happen when an employee scans an assigned NFC tag.

It does not define UI, database structure, API design or implementation details.

FDOS Rule:

> Feature Blueprints describe product behavior. They do not describe implementation.

## Business Goal

Enable fast, reliable and low-friction time tracking through NFC scans.

The business value is to reduce administrative work, prevent manual time tracking errors and make time capture feel like a natural part of the employee workflow.

## User Goal

An employee wants to scan an NFC tag and receive a clear result without deciding whether to start, stop or manually classify work time.

The user should perform one physical action and let TapTim.e interpret the business meaning.

## In Scope

- Employee scans an NFC tag.
- The system resolves the NFC tag assignment.
- The system validates whether the assignment can create a work event.
- The system creates a WorkEvent for valid scans.
- The Business Engine derives the next time tracking result from the WorkEvent.
- Offline operation preserves the WorkEvent locally when synchronization is unavailable.
- The employee receives a clear outcome.

## Out of Scope

- Payroll processing.
- Advanced approval workflows.
- Customer self-service.
- Multi-trigger support beyond NFC/manual fallback.
- GPS tracking as a primary feature.
- Public API.
- Detailed UI design.
- Database schema.
- Backend implementation.
- Synchronization implementation details.

## Product Rules

### One Tap. One Decision.

The employee performs one scan. The system derives the business result.

### Zero Decision UX

The employee shall not choose start or stop manually for the normal NFC scan flow.

### The Engine Decides

The Business Engine decides whether the WorkEvent starts, stops, rejects or defers time tracking.

### Offline by Default

Core work event capture must remain available offline.

### Everything is Auditable

Every successful or rejected scan outcome must be traceable.

## Business Rules

- An unknown NFC tag shall not create a WorkEvent.
- An inactive NFC assignment shall not create a WorkEvent.
- A disabled or inaccessible assignment target shall not create a normal WorkEvent.
- Duplicate scans inside the configured protection window shall not create duplicate TimeEntries.
- A valid NFC scan shall produce a business-level WorkEvent.
- A WorkEvent shall be interpreted by the Business Engine.
- The UI shall not decide whether the scan starts or stops work time.
- Offline operation shall preserve the WorkEvent locally.
- Synchronization failure shall not delete local work event evidence.
- The employee shall receive a clear outcome for accepted, rejected, duplicate or deferred scans.

## Domain Objects

FB-001 uses the domain language defined by TTAP-001.

Relevant domain objects:

- Organization
- Employee
- NfcTag
- NfcAssignment
- AssignmentTarget
- WorkEvent
- TimeEntry
- BusinessEngine
- OfflineQueue
- SyncState

No new central domain object is introduced by this blueprint.

## Events

The feature uses the following events:

- NfcTagScanned
- NfcAssignmentResolved
- NfcAssignmentRejected
- WorkEventCreated
- DuplicateScanIgnored
- TimeEntryStarted
- TimeEntryStopped
- TimeEntryPending
- WorkEventQueuedForSync

Events describe facts that happened.

## Decision Logic

### Decision 1: Resolve NFC Assignment

Trigger: NfcTagScanned

Decision:

- resolve the NFC tag to an active NfcAssignment.

Result:

- NfcAssignmentResolved or NfcAssignmentRejected.

### Decision 2: Validate Assignment Target

Trigger: NfcAssignmentResolved

Decision:

- determine whether the assignment target may create a WorkEvent.

Result:

- proceed to WorkEvent creation or reject with observable reason.

### Decision 3: Create WorkEvent

Trigger: valid assignment target

Decision:

- create WorkEvent.

Result:

- WorkEventCreated.

### Decision 4: Derive TimeEntry Outcome

Trigger: WorkEventCreated

Decision:

- start, stop, defer or reject time tracking.

Result:

- TimeEntryStarted, TimeEntryStopped, TimeEntryPending or rejection outcome.

## Edge Cases

- Unknown NFC tag.
- Unreadable NFC payload.
- Inactive assignment.
- Missing assignment target.
- Disabled customer.
- Employee not authenticated.
- Employee lacks organization access.
- Duplicate scan.
- Existing active TimeEntry for same assignment target.
- Offline without remote synchronization.
- Local queue write failure.
- Synchronization conflict after offline capture.

## Acceptance Criteria

- A known active NFC tag can create a WorkEvent.
- An unknown NFC tag does not create a WorkEvent.
- An inactive assignment does not create a WorkEvent.
- Duplicate scans inside the protection window do not create duplicate TimeEntries.
- The Business Engine owns start/stop/deferred decision logic.
- Offline operation can preserve the WorkEvent locally.
- The feature produces observable outcomes for success and rejection cases.
- The feature remains traceable to TTAP-001 and ADR-0002 through ADR-0007.
- No implementation details are required to understand feature behavior.

## Technical Notes

Technical implementation is deferred to TS-001.

## Traceability

```text
Product Vision
  -> ADR-0002 / ADR-0003 / ADR-0004 / ADR-0005 / ADR-0006 / ADR-0007
  -> TTAP-001
  -> FB-001
  -> TS-001
  -> Development Tasks
```
