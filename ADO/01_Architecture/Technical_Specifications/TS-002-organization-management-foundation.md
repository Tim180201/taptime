# TS-002 – Organization Management Foundation Technical Specification

Status: Approved by Human Architect — C3B/C3C/C3D/C3E1 independently closed for their authorized
scopes; C3E2 contract independently approved and Human-accepted, with implementation/production gated
Specification ID: TS-002
Version: 1.3
Last Updated: 2026-07-18 (C3E2 independent-review and Human-acceptance linkage; accepted TS contract unchanged)
Acceptance: Accepted 2026-07-14
Related Feature Blueprint: FB-002 (`ADO/01_Architecture/Feature_Blueprints/FB-002-organization-management-foundation.md`)
Related Evidence: `ADO/05_Evidence/FB-002_Organization_Management_Scope_Assessment.md`,
`ADO/05_Evidence/Block_C3A_Independent_Architecture_Security_Review.md`,
`ADO/05_Evidence/Block_C3B_Independent_Architecture_Security_Review.md`,
`ADO/05_Evidence/Block_C3B_Secure_Organization_Bootstrap_Evidence.md`,
`ADO/05_Evidence/Block_C3C_Normal_Administration_Backend_Evidence.md`,
`ADO/02_Development/Block_C3C_Normal_Administration_Backend_Closure.md`,
`ADO/05_Evidence/Block_C3D_Implementation_Evidence.md`,
`ADO/05_Evidence/Block_C3D_Physical_Validation_Evidence.md`,
`ADO/05_Evidence/Block_C3E1_Physical_Validation_Evidence.md`,
`ADO/05_Evidence/Block_C3E1_Independent_Final_Closure_Review.md`,
`ADO/02_Development/Block_C3E1_Identity_First_Employee_Membership_Authorization.md`,
`ADO/05_Evidence/Block_C3E2_Independent_Architecture_Security_Review.md`,
`ADO/02_Development/Block_C3E2_Explicit_Tag_Reassignment_Authorization.md`
Epic: EP-009 – Product Readiness Framework (Product Capability Track); EP-007 – Product Architecture Foundation (architectural continuity)
Owner: Technical Lead
Approval Authority: Human Architect
Related Architecture: `ADO/01_Architecture/Technical_Architecture_Profile.md` (TTAP-001)
Related ADRs: ADR-0002, ADR-0003, ADR-0005, ADR-0006, ADR-0007, ADR-0008, ADR-0009, ADR-0011
Related Technical Specification: TS-001 (`ADO/01_Architecture/Technical_Specifications/TS-001-nfc-scan-creates-work-event.md`) — extended, not replaced
Related Development Tasks: DT-017–DT-026 completed; C3B/C3C/C3D/C3E1 completed for authorized
scopes; C3E2 contract independently approved and Human-accepted, with implementation gated

## Purpose

TS-002 defines the technical implementation baseline for the accepted FB-002 Organization
Management Foundation. FB-002 remains the product authority; this specification owns its technical
realization.

It translates FB-002 into implementation-ready technical architecture: Domain Objects, Ports, Application Services, Business Events, sequence flows and responsibility boundaries. It does not redefine product intent (owned by FB-002), does not redesign existing architecture (owned by TTAP-001/ADRs/TS-001), and does not create Development Tasks, code, tests or an ADR.

## Primary Design Question

How is FB-002 implemented while preserving the existing Business Engine architecture?

Answer, in one sentence, elaborated throughout this document: every existing pipeline component (`AssignmentResolver`, `AssignmentValidator`, `WorkEventFactory`, `BusinessEngine`) already depends only on read-only repository ports (`NfcTagRepository.findByPayload`, `NfcAssignmentRepository.findActiveByTagId`, `CustomerRepository.findById`) — once those ports are backed by tenant-safe data written through the C3 administration boundary instead of `runScan.ts` literals, the pipeline operates without changing its decision logic. The Core foundation added Domain Objects, Ports and Application Services; the normative C3A amendment adds display fields and isolated server capabilities around that foundation without redesigning the scan engine.

## Architecture Principles Preserved

Per the Technical Lead's explicit direction, TS-002 does not redesign, and requires no change to:

- `BusinessEngine` (`packages/core/src/business/BusinessEngine.ts`)
- `AssignmentResolver` (`packages/core/src/business/AssignmentResolver.ts`)
- `AssignmentValidator` (`packages/core/src/business/AssignmentValidator.ts`)
- `WorkEventFactory` (`packages/core/src/business/WorkEventFactory.ts`)
- The scan pipeline (`NfcScanApplicationService`, `NfcScanPort`, `WorkEventCreationPort`)
- `CallerContext` (`packages/core/src/domain/CallerContext.ts`)
- `OfflineQueue` and its adapters
- `SynchronizationService` / `SynchronizationGateway`
- Error handling (`ErrorCategory`, the `classify*` functions)

Every design decision below was evaluated against this list and rejected if it required touching any of them. None does.

## Repository Evidence Baseline (Historical 2026-07-07 Snapshot)

TS-002 is built on FB-002 and its Scope Assessment, and on direct inspection of current repository code, confirming:

- `Customer`, `NfcTag`, `NfcAssignment`, `AssignmentTarget` already exist as `organizationId`-scoped domain types (`packages/core/src/domain/`) and require no shape change.
- `CustomerRepository`, `NfcTagRepository`, `NfcAssignmentRepository` (`packages/core/src/ports/`) are read-only today (`findById`, `findByPayload`, `findActiveByTagId`); none of their `InMemory*` implementations (`packages/core/src/infrastructure/repositories/`) has a write method.
- No `Organization`, `Membership`, `MembershipRole`, `User`, `Employee` or `Administrator` domain type exists anywhere in code; only the opaque `OrganizationId`/`UserId` branded identifiers exist (`packages/core/src/domain/ids.ts`), used inside `CallerContext`.
- `AssignmentValidator.validate()` already performs one real, tested organization-scoped authorization check (`employee_lacks_organization_access`, comparing `caller.organizationId` to `assignment.organizationId`) — the direct precedent this specification's new authorization check is modeled on.
- `FakeAuthenticationGateway` (`packages/core/src/infrastructure/adapters/`) is today's only source of "which Organization does this actor belong to" — a hard-coded account map. TS-002 does not replace it (Identity Boundary, below) but defines the Port a future Identity implementation would call to stop hard-coding it.
- `runScan.ts`'s `buildScanDemoPipeline()` constructs one literal demo `Organization`/`Customer`/`NfcTag`/`NfcAssignment` and passes them directly into `InMemory*Repository` constructors. TS-002's Administration flow is the replacement path for that construction — not a change to `runScan.ts` itself, which remains a legitimate demo/CLI composition root either way.
- `Technical_Architecture_Profile.md`'s Responsibility Areas (EP-008 Ch03 §2.3): Mobile/UI, Application, Business Engine, Domain, Infrastructure, Shared — TS-002 places every new component into these existing areas; it introduces no new area.

The baseline above is retained as creation-time evidence. Statements such as "read-only today",
"no Organization/Membership type" and "FakeAuthenticationGateway is today's only source" are not
current. The following amendment is normative where any historical section conflicts with it.

## Normative C3A Runtime Amendment (2026-07-14)

### C3A implementation baseline at amendment time

- DT-017–DT-026 implement and verify the complete Core-foundation sequence described below.
- ADR-0008 and migrations `001`–`005` implement PostgreSQL tenant integrity, forced RLS, temporal
  Assignments, administrative audit, identity binding and current-Membership resolution.
- B4/B5/B6 and C1/C2 provide issuer-bound identity verification, tenant-safe reads,
  server-canonical lifecycle transactions and authenticated HTTP transport.
- ADR-0009 provides the only supported physical v1 Tag payload: canonical Android UID.
- At the C3A amendment time, no bootstrap or normal administration route existed. Existing Core
  services remain internal foundation code and must not be exposed directly; later C3B/C3C
  implementation follows the fixed boundaries below rather than changing that rule.

### Normative precedence

The original Domain/Port/Application sections remain authoritative for the implemented in-process
foundation except where this amendment adds a real-runtime requirement. In particular, historical
claims that no backend/API/Identity implementation exists, that Customer/NfcTag shapes remain
unchanged for all future use, or that no additional architecture decision is needed are superseded.

### C3 runtime data extension

- `Customer` gains required non-unique `displayName`: ADR-0011 `taptime-name-v1`, 1–120 Unicode
  scalars and at most 480 normalized UTF-8 bytes.
- `NfcTag` gains required non-unique `displayName`: `taptime-name-v1`, 1–80 scalars and at most 320
  normalized UTF-8 bytes.
- PostgreSQL receives additive non-null columns and an explicit deterministic backfill for synthetic
  fixtures before constraints become strict. Its versioned normalizer uses the pinned Unicode 15.1
  White_Space/category tables and authoritative length checks from ADR-0011; Node uses identical
  generated tables and golden vectors for preflight.
- Admin read DTOs are projections, not Domain/database serialization:
  `AdminOrganizationSummary { id, name }`,
  `AdminCustomerSummary { id, displayName, active }` and
  `AdminNfcTagSummary { id, displayName, validationFingerprint, assignmentState, targetCustomerId }`.
  No Admin DTO returns `payload_value`.
- `validationFingerprint` is the first 12 uppercase hexadecimal characters of SHA-256 over the
  canonical payload. It is display-only and non-authoritative.

### Bootstrap capability

The first Organization/Admin flow does not call `OrganizationManagementService` and
`MembershipService` as free-standing public operations. A private `@taptime/backend-bootstrap` CLI
verifies the target's provider token, then connects with an individual short-lived
`LOGIN NOINHERIT` operator principal, requires TLS `verify-full` outside numeric loopback, and
explicitly assumes the execute-only `taptime_bootstrap_executor`. The SECURITY DEFINER capability's
distinct NOLOGIN owner has only exact SELECT/INSERT plus controlled BYPASSRLS; ordinary runtimes
cannot assume either role. It creates/reuses the safe IdentityBinding, creates Organization and first
Administrator Membership, appends exactly three truthful operator audit events and an append-only
idempotency receipt in one transaction. Audit and receipt persist exact `session_user` in an
immutable `operator_principal`; cross-operator replay fails closed with a separate rejection audit.
ADR-0011 defines the complete grant, credential, replay and disclosure contract.

`Organization.name` uses `taptime-name-v1`, the same 1–120 scalar/480-byte bound as Customer names,
and no global uniqueness constraint.

### Normal Admin write capability

The server accepts only raw access token, mandatory `expectedMembershipId` narrowing and a fixed
command/projection request. Missing or malformed expected Membership is `invalid_request`; mismatch
with the locked current Membership is `forbidden`. This check happens before receipt lookup or any
resource query.
An `AdminWriteSessionCoordinator` verifies identity, locks and derives the current active Membership
inside the same transaction, requires `administrator`, sets transaction-local actor/tenant/
Membership/correlation context and selects a dedicated narrow `taptime_admin_setup` role. It exposes
only expiring fixed methods; no caller receives a Pool, Client, SQL function, generic repository or
role selector.

The initial commands are:

```text
createCustomer(expectedMembershipId, commandId, displayName)
provisionNfcTag(expectedMembershipId, commandId, customerId, displayName, canonicalPayload)
readSetupProjection(expectedMembershipId, cursor, limit)
```

The provisioning command atomically resolves the current tenant's active Customer, validates the
ADR-0009 payload, inserts the Tag and first active Assignment, writes its command receipt and appends
audit evidence. It takes IDs/values, never a deserialized Membership, Customer or NfcTag object.

Normal receipts are append-only and unique by `(organization_id, command_id)`. They store exact
actor User, expected Membership, command type, hash version, canonical digest, safe result code and
only applicable result IDs; never a raw request/name input, token/identity claim or NFC payload. The
digest uses ADR-0011's domain-separated length-prefixed tuple. Exact authority/type/digest replay
returns the stored result; any difference is `command_id_conflict`.

After authority/expected-Membership validation, each mutation takes the ADR-0011 transaction-scoped
advisory lock for its versioned `(organization_id, command_id)` key before receipt lookup. This
serializes two same-tenant Administrators racing the same ID; the waiter re-reads and maps exact
actor/Membership/type/digest or returns `command_id_conflict`. A unique violation is defence-in-depth
and is mapped by the same re-read, never returned directly.

C3C allowlists only `taptime_admin_setup` in the administrative audit trigger in addition to the
existing role. `createCustomer` appends exactly one `CustomerCreated`; `provisionNfcTag` appends
exactly one `NfcTagRegistered` plus one `NfcTagAssigned`. Actor is current derived User,
`operator_principal` is null and correlation is command ID. Exact replay and rollback append no
events; payload/receipt contain no raw UID.

### Runtime result contract

The C3 typed/HTTP boundary separates authority, resource state and infrastructure:

| Condition | Public result | HTTP class |
|---|---|---:|
| invalid/expired identity, missing/revoked binding or no active Membership | `unauthorized` | 401 |
| Employee, expected-Membership mismatch or role mismatch | `forbidden` | 403 |
| missing/inactive/inaccessible Customer target | `assignment_target_unavailable` | 404 |
| tenant-local payload already registered by a different command | `tag_payload_already_registered` | 409 |
| command ID reused with different authority, type or normalized content | `command_id_conflict` | 409 |
| malformed/extra-key/over-limit command | `invalid_request` | 400 |
| timeout/database/infrastructure failure | `service_unavailable` | 503 |

The missing-Customer branch is never serialized as `cross_organization_access`. Tenant-scoped
queries make absent and foreign resources indistinguishable. Internal diagnostics can retain an
allowlisted cause without resource IDs or cross-tenant disclosure.

Precedence is normative: validate current authority and expected Membership; return an exact stored
receipt; reject a divergent receipt; then evaluate resources. An existing tenant-local payload under
a different command is always `tag_payload_already_registered`, irrespective of Assignment state.
`assignment_conflict` belongs only to a later explicit assign/reassign capability.

### Assignment and payload invariants

- One active Membership per User is normative for v1.
- NFC payload uniqueness is `(organization_id, payload_value)`; the same payload in another tenant
  is allowed and not observable.
- One active Assignment per `(organization_id, nfc_tag_id)` is normative.
- The initial provision command never reassigns. A later explicit reassignment locks the old row,
  treats same-target as semantic idempotency and otherwise deactivates old plus appends new in one
  transaction. Historical WorkEvents retain their Assignment snapshot.
- Authenticated Android owns Customer selection, Tag label entry, native capture and direct
  provision submission. Its raw payload may exist only as an ephemeral transport-internal value
  between adapter and coordinator; it is absent from React component/state, persistence, Web,
  response, receipt, audit and normal diagnostics. This is a supported-client boundary, not device
  attestation or server proof of a physical scan.

### Membership boundary

First-Administrator bootstrap is the only bypass of normal Administrator authorization. Later grants
require a stable verified User and current server-derived Administrator. No last Administrator may
be revoked/demoted without atomic replacement. Invitation, revocation and role-change transport/UI
remain outside the initial setup API.

## Core-Foundation Domain Model (Implemented)

### Domain Objects Added by DT-017–DT-019

- **Organization** — added in the Core foundation with identifier plus human-readable `name`. V1 has no active/inactive `status`; Organization suspension is explicitly deferred and requires a separate product/security decision.
- **Membership** — added in the Core foundation to associate `UserId`, `OrganizationId` and `MembershipRole`, with its own `MembershipId` following ADR-0002's association-identity precedent. One active Membership per User is already schema-enforced and retained in the review-ready C3 v1 proposal; multi-Organization Membership is a future ADR trigger.
- **MembershipRole** — added as the value `'administrator' | 'employee'`, carried by a Membership rather than modeled as a standalone entity.

### Existing Domain Objects Reused; C3 Display Extension Above

- `Customer`, `AssignmentTarget`, `NfcTag`, `NfcAssignment` — the original Core-foundation step reused
  their then-current shapes and added only write paths. The normative C3A amendment now requires
  additive Customer/Tag display names for the real setup runtime; IDs, Organization scoping,
  canonical payload and Assignment identity/history remain preserved.
- `CallerContext` — unchanged shape. TS-002 does not alter `{ status: 'authenticated', userId, organizationId } | { status: 'unauthenticated' }`. The current server runtime derives identity and Membership through B4/C1 rather than trusting a client-populated `CallerContext`; the Core lookup remains foundation evidence only.

### No User / Identity Domain

The Core foundation introduced no `User`, `Employee` or `Administrator` domain entity and no
Identity domain concept. B3/B4 later added server User/IdentityBinding persistence; C3 does not turn
those transport/persistence records into new Core domain entities.

## Core-Foundation Ports (Implemented)

Evaluated against repository evidence; only the following are justified.

### Ports Added by DT-017–DT-018

- **OrganizationRepository** — added because no `Organization` type/repository existed in the creation
  baseline. Methods: find by `OrganizationId`; save/create.
- **MembershipRepository** — added with find-by-`UserId` and save/create for the implemented one-active-
  Membership v1 invariant. B4/C1 now own real identity resolution; multi-Organization Membership
  would require revisiting this Core port under a future ADR.

### Existing Ports Extended by DT-020–DT-022

- **CustomerRepository** — gained save/create; `findById` retained its read semantics.
- **NfcTagRepository** — gained register/save; `findByPayload` retained its read semantics.
- **NfcAssignmentRepository** — gained save/create; `findActiveByTagId` retained its read semantics.

### Explicitly Not Introduced

- No separate "writer" or "command" port type alongside each existing "reader" port. Repository evidence (every existing repository port names a single cohesive concept — "the Customer repository," not "the Customer reader" and "the Customer writer") supports extending the existing interfaces in place, not introducing a new port-splitting pattern the repository does not otherwise use.
- No changes to `AuthenticationGateway`, `NfcScanPort`, `WorkEventCreationPort`, `OfflineQueue`, `SynchronizationGateway`, `WorkEventRepository`, `TimeEntryRepository` — none is implicated by FB-002's scope.

## Core-Foundation Application Services (Implemented)

Evaluated against repository evidence and against the granularity already established by existing services (`NfcScanApplicationService` orchestrates several steps as one cohesive service, rather than one service per step; `SynchronizationService` and `SessionService` are similarly single-purpose orchestrators). The Technical Lead's candidate list (OrganizationManagementService, MembershipService, CustomerManagementService, NfcRegistrationService, AssignmentManagementService) is not adopted as-is: splitting Customer/NFC-Tag/NFC-Assignment administration into three separate services would fragment one cohesive Administrator use-case area (FB-002 Capability 4) more finely than any existing service in this repository is split, without evidence requiring it. TS-002 instead defines three Application Services, mapped one-to-one to FB-002's Capabilities 1, 2 and 4 (Capability 3 is data, not a service; Capability 5 reuses existing services unchanged):

- **OrganizationManagementService** (Capability 1 / FB-002 Decision 1). One Core-foundation responsibility: construct and save an Organization and produce `OrganizationCreated`. It has no authority checks and therefore is not a public C3 use case; ADR-0011's hardened bootstrap capability owns real first-Organization creation.
- **MembershipService** (Capability 2 / FB-002 Decision 2). One responsibility: construct and save a
  Membership and produce `MembershipGranted`. The implemented DT-018 service deliberately performs
  no Organization-existence, actor-authorization or first-Administrator check. It is a foundation
  component, not a public use case. Contrary to the original pre-implementation expectation, it
  does **not** delegate to `MembershipAuthorizationValidator`; C3 must place it only behind
  ADR-0011's private bootstrap or a future server-derived normal-grant coordinator.
- **OrganizationAdministrationService** (Capability 4 / FB-002 Decisions 3–5). Three in-process Core methods create a Customer/AssignmentTarget, register an NfcTag and assign an NfcTag to an AssignmentTarget. They validate detached domain inputs with `MembershipAuthorizationValidator`, construct the domain object, call the repository and return the corresponding Event/rejection. The implemented `assignNfcTag` does not reload the Tag, verify `Customer.active` or check an existing active Assignment. It is therefore foundation code only. C3 accepts scalar command data, reloads every resource under the current locked tenant and enforces database state inside one transaction.

None of these services owns a business rule directly — each orchestrates and delegates to a Business-area validator or an existing/extended repository, exactly matching `NfcScanApplicationService`'s existing "orchestrates but does not interpret" boundary (EP-008 Ch03 §2.3).

## Core-Foundation Business-Area Component (Implemented)

- **MembershipAuthorizationValidator** — added in the Business Engine responsibility area as a pure,
  deterministic in-process validator. It returns `membership_not_found`,
  `membership_lacks_administrator_role` or `cross_organization_access`. These remain Core-foundation
  results only; the C3 transport uses the normative disclosure-safe table above.

`AssignmentValidator` itself is not modified; its existing `employee_lacks_organization_access` check continues to operate exactly as today (FB-002 Decision 7 restates this without changing it).

## Core-Foundation Business Events (Implemented)

Domain events added under `packages/core/src/domain/events/`, following the existing
`WorkEventCreated`/`TimeEntryStarted` idiom:

- **OrganizationCreated** — carries the created `Organization`.
- **MembershipGranted** — carries the created `Membership`.
- **CustomerCreated** — carries the created `Customer`.
- **NfcTagRegistered** — carries the registered `NfcTag`.
- **NfcTagAssigned** — carries the created `NfcAssignment`.

None of these is a raw external "fact" the way `NfcTagScanned` is (a fact normalizes external sensor input before business meaning is assigned). Administration requests originate as deliberate, already-structured Application Service calls, not raw external input — so each Application Service method proceeds directly from validated request to domain construction to Event, without an intermediate "fact" stage. This is a genuine, evidence-based structural difference from the scan pipeline's two-stage Fact → Decision flow, not an inconsistency.

Rejections (`membership_not_found`, `membership_lacks_administrator_role`, `cross_organization_access`) are not Events; they are validation-result variants returned by `MembershipAuthorizationValidator`, exactly mirroring how `AssignmentValidationResult`'s rejected variants are a Business-area result type, not a domain Event, today.

No FB-001 event (`NfcTagScanned`, `NfcAssignmentResolved`, `NfcAssignmentRejected`, `WorkEventCreated`, `DuplicateScanIgnored`, `TimeEntryStarted`, `TimeEntryStopped`, `TimeEntryPending`, `WorkEventQueuedForSync`) is redefined, renamed or given new fields.

## Core-Foundation Sequence Diagrams (Historical In-Process Boundary)

Text-flow, matching TS-001's existing style. These diagrams explain DT-017–DT-026; their detached
Membership/Organization/NfcTag parameters are never transport inputs. The normative C3A sequence
above supersedes them for the real server boundary.

### 1. Organization Creation

```text
Administration request (Organization name)
  -> OrganizationManagementService
  -> constructs Organization domain object
  -> OrganizationRepository.save
  -> OrganizationCreated
```

### 2. Membership Creation

```text
Administration request (actor, Organization, MembershipRole)
  -> [trusted coordinator derives/authorizes actor; private bootstrap is a separate path]
  -> MembershipService (foundation construction/persistence only)
  -> constructs Membership domain object
  -> MembershipRepository.save
  -> MembershipGranted
```

### 3. Customer Registration

```text
Administration request (actor's Membership, Organization, Customer data)
  -> OrganizationAdministrationService.createCustomer
  -> MembershipAuthorizationValidator (accepted | membership_not_found | membership_lacks_administrator_role | cross_organization_access)
  -> [accepted] constructs Customer domain object
  -> CustomerRepository.save
  -> CustomerCreated
```

### 4. NFC Tag Registration

```text
Administration request (actor's Membership, Organization, tag payload)
  -> OrganizationAdministrationService.registerNfcTag
  -> MembershipAuthorizationValidator
  -> [accepted] constructs NfcTag domain object
  -> NfcTagRepository.save
  -> NfcTagRegistered
```

### 5. NFC Tag Assignment

```text
Administration request (actor's Membership, NfcTag, AssignmentTarget)
  -> OrganizationAdministrationService.assignNfcTag
  -> MembershipAuthorizationValidator
  -> [accepted] verify NfcTag and AssignmentTarget belong to the same Organization as the Membership
  -> constructs NfcAssignment domain object
  -> NfcAssignmentRepository.save
  -> NfcTagAssigned
```

### 6. Existing Scan Using Organization-Owned Data

```text
Employee scans NFC tag
  -> NfcScanApplicationService (unchanged)
  -> AssignmentResolver.resolve (unchanged) -> NfcTagRepository.findByPayload / NfcAssignmentRepository.findActiveByTagId (unchanged reads, now returning data saved via Flows 3-5)
  -> AssignmentValidator.validate (unchanged) -> CustomerRepository.findById (unchanged read, now returning data saved via Flow 3)
  -> WorkEventFactory.createFromAcceptedAssignment (unchanged)
  -> BusinessEngine.evaluate (unchanged)
  -> identical to TS-001's existing Online/Offline/Rejection Runtime Behaviour — no step added, removed or reordered
```

This sixth flow is the direct answer to the Primary Design Question: it is character-for-character TS-001's existing flow, unmodified, reading data now written through Flows 1–5 instead of `runScan.ts` literals.

## Responsibility Boundaries

Mapped to the existing Responsibility Areas (`Technical_Architecture_Profile.md`; EP-008 Ch03 §2.3) — no new area is introduced:

| Area | Implemented foundation and current C3 effect |
|---|---|
| Domain | `Organization`, `Membership`, `MembershipRole` and their creation events were added by the Core foundation; `MembershipId` was added to `ids.ts`. C3 additionally requires `Customer.displayName` and `NfcTag.displayName`; `NfcAssignment`, `AssignmentTarget` and `CallerContext` retain their Core identities/shapes. |
| Business Engine | The Core foundation added `MembershipAuthorizationValidator`, structurally analogous to `AssignmentValidator`. `AssignmentResolver`, `AssignmentValidator`, `WorkEventFactory` and `BusinessEngine` remain unchanged. |
| Application | The Core foundation added orchestration-only `OrganizationManagementService`, `MembershipService` and `OrganizationAdministrationService`. C3 places them behind the server-derived boundaries above rather than exposing them directly. `NfcScanApplicationService`, `SynchronizationService`, `SessionService` and `WorkEventCreationService` remain unchanged. |
| Infrastructure | The Core foundation added `OrganizationRepository`, `MembershipRepository` and their `InMemory*` implementations, then extended Customer/Tag/Assignment repositories with writes. C3B/C3C supply the completed PostgreSQL capabilities; later C3E capabilities remain gated. `OfflineQueue`, `SynchronizationGateway`, `AuthenticationGateway`, `NfcScanPort` and `WorkEventCreationPort` remain unchanged. |
| Mobile / UI | Not touched by the Core foundation. Completed C3D owns the separately authorized Admin Web and protected Android Administrator capture; neither calls the Core services directly. |
| Shared | `ids.ts` extended additively with `MembershipId`. No other shared utility changes. |

No business logic moves between areas; no new responsibility area is invented.

## Extension Strategy

TS-002 extends, and does not replace:

- **FB-001 / TS-001**: the entire scan pipeline (Sequence 6, above) is reused verbatim. TS-002 adds no new step to it and removes none.
- **Business Engine**: unchanged. It continues to receive the same `WorkEvent` shape from the same `WorkEventFactory`, regardless of whether the underlying `NfcAssignment`/`Customer` came from a fixture or from real Organization-owned data.
- **AssignmentValidator**: unchanged. Its `employee_lacks_organization_access`/`missing_assignment_target`/`assignment_target_disabled` outcomes are exactly preserved; `MembershipAuthorizationValidator` is a new, separate, structurally analogous component for administrative actions, not a modification of `AssignmentValidator`.
- **Current repositories**: the Core foundation added one write method to each of `CustomerRepository`/`NfcTagRepository`/`NfcAssignmentRepository`; C3 adds display data and server adapters without changing the existing scan-read semantics.
- **Current adapters**: `FakeAuthenticationGateway`, `FakeNfcScanAdapter`, `CliNfcScanAdapter`, `FakeSynchronizationGateway` are all unchanged. `runScan.ts`'s `buildScanDemoPipeline` continues to work exactly as today; it is not required to change for TS-002 to be implemented, though a future Development Task may choose to let it optionally accept Organization-owned repository instances the same way DT-015 let it optionally accept durable storage instances.
- **Current scan flow**: identical (Sequence 6, above).

Document of exactly what remains unchanged (for review convenience, repeating the Architecture Principles Preserved list): `BusinessEngine`, `AssignmentResolver`, `AssignmentValidator`, `WorkEventFactory`, `NfcScanApplicationService`, `NfcScanPort`, `WorkEventCreationPort`, `CallerContext`, `OfflineQueue`, `SynchronizationService`/`SynchronizationGateway`, `ErrorCategory` and its `classify*` functions.

## Identity Boundary (Historical Core Scope; Current Runtime Uses ADR-0008/C1)

The original Core specification did not select or implement Identity and correctly left
`FakeAuthenticationGateway` unchanged. ADR-0008, B4 and C1 later supplied the real v1 provider/token/
session boundary. C3 reuses that concrete verification and server Membership resolution; it does not
revive `MembershipRepository.findByUserId` or a client-supplied CallerContext as runtime authority.
Provider linking, password lifecycle and additional sign-in methods remain outside TS-002.

## Historical Core Implementation Order (Completed by DT-017–DT-026)

The original dependency order was:

```text
Organization (domain object + OrganizationRepository + OrganizationManagementService)
  |
  v
Membership (domain object + MembershipRole + MembershipRepository + MembershipService + MembershipAuthorizationValidator)
  |
  v
Extended repositories (CustomerRepository.save, NfcTagRepository.save, NfcAssignmentRepository.save + updated InMemory* implementations)
  |
  v
OrganizationAdministrationService (createCustomer, registerNfcTag, assignNfcTag)
  |
  v
Existing Scan Pipeline Integration (no code change — verification only: confirm AssignmentResolver/AssignmentValidator/WorkEventFactory/BusinessEngine behave identically when NfcTagRepository/NfcAssignmentRepository/CustomerRepository are backed by Administration-flow-written data instead of runScan.ts literals)
```

DT-017–DT-026 completed this order. It is not the C3 runtime sequence; C3B bootstrap, C3C normal
setup backend/API and C3D UI/capture are completed after their separate review/CI/Human-gate
cycles. C3E is now planned as separately gated C3E1 identity-first Employee Membership setup and
C3E2 explicit reassignment.

## Historical Core-Foundation Out of Scope and Current C3 Exclusions

Unchanged from FB-002, restated for this specification's own boundary:

- Additional Identity Provider selection, OAuth expansion and password-product behavior beyond the
  approved ADR-0008/C1 v1 boundary (Identity Boundary, above).
- Billing, reporting, exports, analytics, Customer self-service portal.
- The full `Role_Model.md` role matrix; Team Lead/System Owner implementation; permission-management UI.
- Approval workflows.
- The original Core slice excluded backend/cloud/schema/API work. ADR-0008 and B3–C2 later delivered
  that foundation. C3 still excludes cloud deployment selection, production data and generic API
  design beyond ADR-0011's fixed setup capability.
- Public/self-service Organization signup; generic Membership CRUD; invitation/revocation/role
  management; Organization status/rename; delete; implicit reassignment; Web/iOS NFC capture.
- Any change to FB-001's business rules, decision logic, duplicate-scan/Finding F-01 behavior, or Business Engine decision logic.

## Quality Requirements Self-Check

- Core-foundation implementation-readiness: DT-017–DT-026 have implemented and verified the original
  component sequence. The historical claim that no further architecture decision was needed applied
  only to that in-process foundation, not a real C3 transport/runtime.
- C3 readiness: ADR-0011 and the normative amendment above now decide bootstrap, normal write
  authority, display fields, result vocabulary, payload uniqueness and Assignment history. C3B and
  C3C passed their separate exact-baseline authorization, implementation, review and CI gates; C3D
  additionally passed its complete fresh Human physical gate. C3E1 product correction `450d767`,
  harness correction `4338910`, complete fresh Human physical gate and closure commit `fe0781b`
  passed their review/CI gates. The separate C3E2 contract at `dbefc1c` passed independent
  zero-finding review and exact-head ten-job CI; Sections 3–13 are Human-accepted, while separate
  repository implementation authority remains pending.
- Traceability: every new component is traced to a specific FB-002 Capability/Decision and to a specific existing repository precedent (`AssignmentValidator`, `CustomerRepository`, `NfcScanApplicationService`, `ids.ts`, ADR-0002's `NfcAssignment` identity precedent).
- Accepted FB-002/TS-002 baseline: this document covers the implemented Core foundation and
  corrected C3A runtime contract. Independent re-review passed and Human Architect acceptance is
  complete. C3B, C3C, C3D and C3E1 are separately closed for their recorded scopes; C3E2 remains
  gated.

## Former Open Questions — Current Disposition

- First Organization/Admin: resolved and implemented by ADR-0011's private C3B operator bootstrap.
- Membership cardinality: one active Membership per User for v1.
- Reassignment/history: temporal append-only history and one active Assignment per Tag; explicit
  reassignment implementation later gated.
- Missing/wrong-Organization resource semantics: disclosure-safe
  `assignment_target_unavailable`; authorization remains a separate forbidden result.
- Payload collision: Organization-scoped uniqueness, same value across tenants allowed/undisclosed.
- Organization status: explicitly deferred; no suspension semantics in C3 v1.
- Physical provisioning: canonical Android UID/capture resolved by ADR-0009; protected Android
  registration selected; NDEF writing/iOS/Web capture deferred.
- Identity sequencing: resolved by ADR-0008/B4/C1 before C3 runtime.
- Customer/Tag usability: required display names are part of the completed C3C repository
  implementation.
- Normal Membership invitation/revocation/last-admin UI: remains separately gated, not an ambiguity
  in the initial C3 setup surface.

## Traceability

```text
Product Vision
  -> ADR-0002 / ADR-0003 / ADR-0005 / ADR-0006 / ADR-0007 / ADR-0008 / ADR-0009
  -> TTAP-001
  -> FB-001 (existing, unchanged) -> TS-001 (existing, unchanged)
  -> FB-002 v1.2 (accepted)
  -> TS-002 v1.3 (C3A/C3B contract plus exact C3C transport amendment)
  -> DT-017–DT-026 (Core foundation complete)
  -> ADR-0011 / C3A (independently validated and Human-accepted)
  -> C3B (completed) / C3C (completed) / C3D (completed)
  -> C3E1 identity-first Employee Membership (authorized repository/Human scope completed)
  -> C3E2 explicit reassignment (gated)
```

## C3D Closure Synchronization and C3E Split (2026-07-15)

C3D implementation, both correction cycles, exact-head CI and the complete fresh Galaxy
A33/NTAG213 Human physical gate are now closed on the evidence recorded in the related C3D
artifacts. This status synchronization changes no TS-002 product rule, result contract, Domain
shape or transport authority.

The former combined C3E planning label is split for authorization discipline:

- **C3E1** is identity-first Employee Membership setup. Its initial authorization-package review
  returned six P2 contract findings and no P0/P1/P3. Corrected commit `70d163f` fixes the historical
  Membership, pre-Membership state, token/cap, HTTP, lock and audit boundaries, passed zero-finding
  independent re-review and was Human-accepted with separate repository implementation authority.
  Product correction `450d767`, harness correction `4338910` and the complete fresh Human physical
  gate subsequently passed. Closure commit `fe0781b` passed exact-head ten-of-ten run `29645336694`
  and independent zero-finding final review.
- **C3E2** is explicit Tag reassignment. Its independently approved contract has Human acceptance
  for Sections 3–13, but implementation remains separately gated because Assignment history and
  future time attribution are a distinct privileged boundary from identity/Membership authority.

This split itself created no Development Task or code. The later Human decision authorizes only the
exact C3E1 repository slice on `70d163f`; it creates no C3E2 or production authority.

## Review Reconciliation Note (2026-07-14)

Version 1.1 was accepted after direct source/schema reconciliation and independent C3A
correction review. The
original sections remain useful evidence for why the Core foundation was shaped as it was. The
normative C3A amendment corrects their time-dependent statements and adds the transport/security
contract required for real runtime work. Human Architect acceptance and C3B implementation closure
are complete. C3C was later explicitly authorized on baseline `c1148d57` and its repository
implementation completed at `b90729a0a4b325f523cd98ea5a741defb00155f6` after exact-SHA review and
exact-head CI. The later C3D closure and C3E1/C3E2 disposition are recorded in the dated
synchronization section above.

## C3B Feasibility Amendment (Version 1.2, 2026-07-14)

Version 1.2 changes only the versioned `taptime-name-v1` Unicode authority from the C3A-reviewed
Unicode-17 proposal to PostgreSQL-17-authoritative Unicode 15.1. PostgreSQL 17.10 reports internal
Unicode 15.1 even when separately installed ICU data is newer; Node 24 therefore uses pinned
UCD-15.1 property tables and rejects post-15.1 assignments before normalization. The C3B
authorization and independent pre-review record this feasibility correction. All other accepted
C3A behavior, result, authority and gating decisions remain unchanged; a future Unicode change
requires `taptime-name-v2` rather than a silent v1 mutation.

## C3C Exact Runtime Amendment (Version 1.3, 2026-07-14)

Version 1.3 freezes the transport details that the accepted logical C3A contract intentionally left
to the separately gated implementation slice. The Human Architect explicitly authorized C3C on
baseline `c1148d57edb12312a102f090715c4b28308f6347` after three independent read-only pre-reviews.

The exact authenticated JSON surface is:

```text
POST /v1/administration/customers
  { expectedMembershipId, commandId, displayName }

POST /v1/administration/nfc-tags/provision
  { expectedMembershipId, commandId, customerId, displayName, canonicalPayload }

POST /v1/administration/setup-projection
  { expectedMembershipId, cursor, limit }
```

The body is the single expected-Membership source for these routes; the C2 lifecycle narrowing
header is rejected here. This is a narrowing identifier, not a caller-supplied Membership or
authority object. Every UUID input must already be canonical lowercase text. No Organization,
User, role, active state or complete Domain object is accepted. The server derives and locks all
authority before receipt or resource visibility.

Customer mutation success is
`{ status: "succeeded", idempotentRetry, customer: AdminCustomerSummary }`. Tag provision success is
`{ status: "succeeded", idempotentRetry, nfcTag: AdminNfcTagSummary, assignmentId }`. Both are HTTP
200 and contain no Domain Event or raw payload. The fixed failure vocabulary and HTTP mapping remain
the table in this specification.

Projection returns
`{ status: "succeeded", organization, customers, nfcTags, nextCursor }`. It uses one v1 keyset
cursor across Customers ordered by UUID followed by Tags ordered by UUID, with a combined integer
limit of 1–20 and a maximum 256-byte cursor. `assignmentState` is exactly `assigned | unassigned`;
`targetCustomerId` is a UUID exactly when assigned and otherwise null. The encoded response must
remain below 16 KiB at maximum allowed name lengths.

Migration `007` supplies a neutral pure C3 Unicode/digest contract, ID-only ASCII fixture backfill,
database-authoritative name/digest validation, a setup-only canonical UID insert guard, safe stored
fingerprint, success-only receipt, fail-closed setup audit allowlist and the distinct setup role.
The fourth API login may assume only identity resolver and setup roles. Deadline propagation plus
PostgreSQL lock/statement/transaction bounds prevents a reported timeout from leaving an
uncontrolled write transaction. The complete binding details and stop conditions are normative in
`ADO/02_Development/Block_C3C_Normal_Administration_Backend_Authorization.md`.

## Historical Role Handover (2026-07-07)

Implemented scope: TS-002 – Organization Management Foundation Technical Specification created as a Draft, translating the Technical-Lead-reviewed FB-002 into implementation-ready architecture (new Domain Objects, Ports, Application Services, one new Business-area validator, Business Events, six sequence flows, responsibility-area mapping, extension strategy, logical implementation order). No Development Task, code, test, ADR, or TTAP change was created or modified.

Changed files:

- New: `ADO/01_Architecture/Technical_Specifications/TS-002-organization-management-foundation.md` (this document).
- Updated: `ADO/00_Core/Decision_Log.md` (new TS-002 entry).
- Updated: `ADO/README.md` (Technical Specifications navigation row).
- `ADO/00_Core/Project_Status.md`: reviewed; a small targeted update is included because the file explicitly tracks "Technical Lead review/approval of FB-002 followed by TS-002 drafting" as its next step — that step is now done, so the same staleness-avoidance judgment applied during FB-002's own creation applies again here.

Related ADO artifacts consulted: FB-002 (current, post-review version), `ADO/05_Evidence/FB-002_Organization_Management_Scope_Assessment.md`, FB-001, TS-001, `Technical_Architecture_Profile.md`, ADR-0002, ADR-0003, ADR-0005, ADR-0006, ADR-0007, `Domain_Model.md`, `Role_Model.md`, `Development_Sprint_011_Closure.md`, `EP-007_Development_Tasks.md`, `Decision_Log.md`, EP-008 Chapter 03 (Responsibility Areas), and direct inspection of current repository code: `packages/core/src/domain/`, `packages/core/src/ports/`, `packages/core/src/infrastructure/repositories/`, `packages/core/src/infrastructure/adapters/`, `packages/core/src/business/` (`AssignmentResolver.ts`, `AssignmentValidator.ts`, `AssignmentValidationResult.ts`, `WorkEventFactory.ts`, `BusinessEngine.ts`), `packages/core/src/application/` (`NfcScanApplicationService.ts`, `WorkEventCreationPort.ts`), `packages/core/src/domain/events/WorkEventCreated.ts`, `packages/core/src/domain/facts/NfcTagScanned.ts`.

Known deviations: the Technical Lead's candidate Application Service list (OrganizationManagementService, MembershipService, CustomerManagementService, NfcRegistrationService, AssignmentManagementService) was not adopted as-is — three services were defined instead of five, with an explicit evidence-based justification (Application Services, above) that further fragmentation is not supported by this repository's existing service granularity. This is a disclosed deviation from the candidate list, not from the assigned task, which explicitly instructed "Do NOT simply accept these. Repository evidence decides."

Unresolved questions / open findings carried forward: FB-002's eight Open Questions; the newly surfaced Membership-granting bootstrap question (Open Questions, above); all previously carried-forward findings (DT-016 physical-device validation; iOS NFC support; Development Sprint 002/004 governance backlog; Finding F-01; the backend/cloud persistence technology decision; the future Identity-layer Feature Blueprint) remain exactly as previously recorded.

Evidence produced: this specification, the Decision Log entry, and the ADO/README.md navigation update.

Next responsible role: Technical Lead to review TS-002 for approval readiness. Per the assigned stop condition, this task does not create Development Tasks and does not begin Development Sprint 012.

## Historical Stop Condition (Satisfied 2026-07-07)

Per task instruction: stop after TS-002 has been created. Do not create Development Tasks. Do not begin Sprint 012. Wait for Technical Lead review.
