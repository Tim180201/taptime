# TS-002 – Organization Management Foundation Technical Specification

Status: Draft
Specification ID: TS-002
Related Feature Blueprint: FB-002 (`ADO/01_Architecture/Feature_Blueprints/FB-002-organization-management-foundation.md`)
Related Evidence: `ADO/05_Evidence/FB-002_Organization_Management_Scope_Assessment.md`
Epic: EP-009 – Product Readiness Framework (Product Capability Track); EP-007 – Product Architecture Foundation (architectural continuity)
Owner: Technical Lead
Approval Authority: Human Architect
Related Architecture: `ADO/01_Architecture/Technical_Architecture_Profile.md` (TTAP-001)
Related ADRs: ADR-0002, ADR-0003, ADR-0005, ADR-0006, ADR-0007
Related Technical Specification: TS-001 (`ADO/01_Architecture/Technical_Specifications/TS-001-nfc-scan-creates-work-event.md`) — extended, not replaced
Related Development Tasks: Not yet created (out of scope for this document)

## Purpose

TS-002 defines the technical implementation baseline for FB-002 – Organization Management Foundation, now the authoritative feature definition following Technical Lead review.

It translates FB-002 into implementation-ready technical architecture: Domain Objects, Ports, Application Services, Business Events, sequence flows and responsibility boundaries. It does not redefine product intent (owned by FB-002), does not redesign existing architecture (owned by TTAP-001/ADRs/TS-001), and does not create Development Tasks, code, tests or an ADR.

## Primary Design Question

How is FB-002 implemented while preserving the existing Business Engine architecture?

Answer, in one sentence, elaborated throughout this document: every existing pipeline component (`AssignmentResolver`, `AssignmentValidator`, `WorkEventFactory`, `BusinessEngine`) already depends only on read-only repository ports (`NfcTagRepository.findByPayload`, `NfcAssignmentRepository.findActiveByTagId`, `CustomerRepository.findById`) — once those ports are backed by data written through FB-002's new write-capable Administration flow instead of `runScan.ts`'s hard-coded literals, the entire existing pipeline operates correctly with zero code changes. TS-002 therefore only adds new Domain Objects, new/extended Ports, and new Application Services alongside the existing architecture; it changes nothing inside it.

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

## Repository Evidence Baseline

TS-002 is built on FB-002 and its Scope Assessment, and on direct inspection of current repository code, confirming:

- `Customer`, `NfcTag`, `NfcAssignment`, `AssignmentTarget` already exist as `organizationId`-scoped domain types (`packages/core/src/domain/`) and require no shape change.
- `CustomerRepository`, `NfcTagRepository`, `NfcAssignmentRepository` (`packages/core/src/ports/`) are read-only today (`findById`, `findByPayload`, `findActiveByTagId`); none of their `InMemory*` implementations (`packages/core/src/infrastructure/repositories/`) has a write method.
- No `Organization`, `Membership`, `MembershipRole`, `User`, `Employee` or `Administrator` domain type exists anywhere in code; only the opaque `OrganizationId`/`UserId` branded identifiers exist (`packages/core/src/domain/ids.ts`), used inside `CallerContext`.
- `AssignmentValidator.validate()` already performs one real, tested organization-scoped authorization check (`employee_lacks_organization_access`, comparing `caller.organizationId` to `assignment.organizationId`) — the direct precedent this specification's new authorization check is modeled on.
- `FakeAuthenticationGateway` (`packages/core/src/infrastructure/adapters/`) is today's only source of "which Organization does this actor belong to" — a hard-coded account map. TS-002 does not replace it (Identity Boundary, below) but defines the Port a future Identity implementation would call to stop hard-coding it.
- `runScan.ts`'s `buildScanDemoPipeline()` constructs one literal demo `Organization`/`Customer`/`NfcTag`/`NfcAssignment` and passes them directly into `InMemory*Repository` constructors. TS-002's Administration flow is the replacement path for that construction — not a change to `runScan.ts` itself, which remains a legitimate demo/CLI composition root either way.
- `Technical_Architecture_Profile.md`'s Responsibility Areas (EP-008 Ch03 §2.3): Mobile/UI, Application, Business Engine, Domain, Infrastructure, Shared — TS-002 places every new component into these existing areas; it introduces no new area.

## Domain Model

### New Domain Objects

- **Organization** — new. Minimal shape: an identifier (`OrganizationId`, already existing) plus a human-readable `name`. Repository evidence does not require an explicit `status` field: no Decision Logic in FB-002 references an "inactive Organization" rejection path, and ADR-0003's v1 scope does not mention organization suspension. `status` is therefore not included now; if the Human Architect resolves FB-002's Open Question 6 to require one, it is a pure additive field change, not a redesign (extends the Aggregate Root TTAP-001 already names, per ADR-0006's domain-first rule).
- **Membership** — new. Associates one actor (`UserId`) with one `Organization` (`OrganizationId`) and one `MembershipRole`. Carries its own identifier (`MembershipId`, new branded ID, added to `ids.ts` alongside the existing branded ID types), following the same precedent ADR-0002 already set for `NfcAssignment` — an association object gets its own identity, not just a compound key of the things it associates. Per FB-002's assumption (Open Question 2), one Membership per actor exists at a time; the repository (below) is shaped accordingly.
- **MembershipRole** — new. A value, not an entity: `'administrator' | 'employee'`, carried by a `Membership`, mirroring the existing string-literal-union idiom already used for `AssignmentTarget.targetType` and `SyncState`/`ErrorCategory`. Not a standalone domain object — consistent with FB-002's Technical Lead Review Follow-up, which clarified Administrator/Employee as Membership Roles, not entities.

### Existing Domain Objects Reused, Unchanged

- `Customer`, `AssignmentTarget`, `NfcTag`, `NfcAssignment` — same shape, same `organizationId` scoping already in place. TS-002 adds only a write path for each (Ports, below); no field is added, removed or renamed.
- `CallerContext` — unchanged shape. TS-002 does not alter `{ status: 'authenticated', userId, organizationId } | { status: 'unauthenticated' }`. A `Membership` is what a future Identity implementation would look up to populate a real `CallerContext.organizationId`; TS-002 defines the lookup Port (`MembershipRepository.findByUserId`, below) but not the Identity mechanism that would call it (Identity Boundary, below).

### No User / Identity Domain

Per FB-002's Identity Boundary, TS-002 introduces no `User`, `Employee` or `Administrator` domain entity, and no Identity domain concept. `UserId` remains the only representation of "an actor," exactly as it is today.

## Ports

Evaluated against repository evidence; only the following are justified.

### New Ports

- **OrganizationRepository** — new, because no `Organization` type or repository exists at all today. Methods: find an Organization by its `OrganizationId`; save (create) an Organization. Mirrors the existing `CustomerRepository`'s minimal read shape, plus the one write method every new repository in this specification needs.
- **MembershipRepository** — new, same justification. Methods: find the Membership for a given `UserId` (per FB-002's single-membership assumption); save (create) a Membership. This is the Port a future Identity implementation would call to replace `FakeAuthenticationGateway`'s hard-coded account map — noted here as an integration point, not designed here (Identity Boundary, below). If the Human Architect later resolves FB-002 Open Question 2 to allow multi-organization membership, this method's signature is the one identified extension point that would need revisiting.

### Extended Existing Ports

- **CustomerRepository** — extend with one new method: save (create) a Customer. `findById` is unchanged. No new port type introduced; the existing interface gains a write method, exactly as the Technical Lead's candidate list anticipated ("CustomerRepository extensions").
- **NfcTagRepository** — extend with one new method: save (register) an NfcTag. `findByPayload` is unchanged.
- **NfcAssignmentRepository** — extend with one new method: save (create) an NfcAssignment. `findActiveByTagId` is unchanged.

### Explicitly Not Introduced

- No separate "writer" or "command" port type alongside each existing "reader" port. Repository evidence (every existing repository port names a single cohesive concept — "the Customer repository," not "the Customer reader" and "the Customer writer") supports extending the existing interfaces in place, not introducing a new port-splitting pattern the repository does not otherwise use.
- No changes to `AuthenticationGateway`, `NfcScanPort`, `WorkEventCreationPort`, `OfflineQueue`, `SynchronizationGateway`, `WorkEventRepository`, `TimeEntryRepository` — none is implicated by FB-002's scope.

## Application Services

Evaluated against repository evidence and against the granularity already established by existing services (`NfcScanApplicationService` orchestrates several steps as one cohesive service, rather than one service per step; `SynchronizationService` and `SessionService` are similarly single-purpose orchestrators). The Technical Lead's candidate list (OrganizationManagementService, MembershipService, CustomerManagementService, NfcRegistrationService, AssignmentManagementService) is not adopted as-is: splitting Customer/NFC-Tag/NFC-Assignment administration into three separate services would fragment one cohesive Administrator use-case area (FB-002 Capability 4) more finely than any existing service in this repository is split, without evidence requiring it. TS-002 instead defines three Application Services, mapped one-to-one to FB-002's Capabilities 1, 2 and 4 (Capability 3 is data, not a service; Capability 5 reuses existing services unchanged):

- **OrganizationManagementService** (Capability 1 / FB-002 Decision 1). One responsibility: create an Organization. Orchestrates: construct the `Organization` domain object, call `OrganizationRepository.save`, produce `OrganizationCreated`. Owns no business rule beyond "an Organization can always be created" (FB-002's Decision 1 preconditions: none).
- **MembershipService** (Capability 2 / FB-002 Decision 2). One responsibility: grant a Membership. Orchestrates: construct the `Membership` domain object (actor, Organization, `MembershipRole`), call `MembershipRepository.save`, produce `MembershipGranted`. Delegates the "may this request proceed" question to the new `MembershipAuthorizationValidator` (Business responsibility area, below) for every grant except the first Administrator Membership of a newly created Organization, which has no existing Administrator to authorize it — an explicit, unresolved bootstrapping question, carried into Open Questions/Extension Points below exactly as FB-002 left it open (Open Question 1).
- **OrganizationAdministrationService** (Capability 4 / FB-002 Decisions 3–5). Three methods, one per FB-002 Decision: create a Customer/AssignmentTarget; register an NfcTag; assign an NfcTag to an AssignmentTarget. Each method: (1) calls `MembershipAuthorizationValidator` (below) with the requesting actor's Membership and the target Organization; (2) on acceptance, constructs the domain object and calls the relevant extended repository's save method; (3) produces the corresponding Event (`CustomerCreated`, `NfcTagRegistered`, `NfcTagAssigned`) or returns the rejection. `assignNfcTag` additionally requires (per FB-002 Decision 5) that the NfcTag and the AssignmentTarget already belong to the same Organization as the requesting Membership, mirroring `AssignmentValidator`'s existing cross-check pattern.

None of these services owns a business rule directly — each orchestrates and delegates to a Business-area validator or an existing/extended repository, exactly matching `NfcScanApplicationService`'s existing "orchestrates but does not interpret" boundary (EP-008 Ch03 §2.3).

## New Business-Area Component

- **MembershipAuthorizationValidator** — new, placed in the Business Engine responsibility area, directly alongside and structurally identical in shape to the existing `AssignmentValidator`: a pure, deterministic class with no side effects, taking domain objects in and returning a validation result out. Evaluates whether a Membership may perform an administrative action against a target Organization (FB-002 Decision 6): rejects with `membership_not_found` (no Membership exists for the actor), `membership_lacks_administrator_role` (Membership exists but carries the Employee role), or `cross_organization_access` (Membership's Organization differs from the target Organization's data) — otherwise accepts. This is a business rule (FB-002's Business Rules already state it in prose: "Only a Membership with the Administrator Role may create or assign Organization-owned pilot data"), so it belongs in the Business responsibility area, not inside an Application Service, exactly as `AssignmentValidator` already established the precedent for the equivalent scan-time rule.

`AssignmentValidator` itself is not modified; its existing `employee_lacks_organization_access` check continues to operate exactly as today (FB-002 Decision 7 restates this without changing it).

## Business Events

New domain events (`packages/core/src/domain/events/`, following the existing `WorkEventCreated`/`TimeEntryStarted` idiom: a `type` discriminant plus the created/decided domain object):

- **OrganizationCreated** — carries the created `Organization`.
- **MembershipGranted** — carries the created `Membership`.
- **CustomerCreated** — carries the created `Customer`.
- **NfcTagRegistered** — carries the registered `NfcTag`.
- **NfcTagAssigned** — carries the created `NfcAssignment`.

None of these is a raw external "fact" the way `NfcTagScanned` is (a fact normalizes external sensor input before business meaning is assigned). Administration requests originate as deliberate, already-structured Application Service calls, not raw external input — so each Application Service method proceeds directly from validated request to domain construction to Event, without an intermediate "fact" stage. This is a genuine, evidence-based structural difference from the scan pipeline's two-stage Fact → Decision flow, not an inconsistency.

Rejections (`membership_not_found`, `membership_lacks_administrator_role`, `cross_organization_access`) are not Events; they are validation-result variants returned by `MembershipAuthorizationValidator`, exactly mirroring how `AssignmentValidationResult`'s rejected variants are a Business-area result type, not a domain Event, today.

No FB-001 event (`NfcTagScanned`, `NfcAssignmentResolved`, `NfcAssignmentRejected`, `WorkEventCreated`, `DuplicateScanIgnored`, `TimeEntryStarted`, `TimeEntryStopped`, `TimeEntryPending`, `WorkEventQueuedForSync`) is redefined, renamed or given new fields.

## Sequence Diagrams

Text-flow, matching TS-001's existing style.

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
  -> MembershipService
  -> [except the bootstrapping case, see Open Questions] MembershipAuthorizationValidator
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

| Area | New / Changed in TS-002 |
|---|---|
| Domain | `Organization`, `Membership`, `MembershipRole` (new); `OrganizationCreated`, `MembershipGranted`, `CustomerCreated`, `NfcTagRegistered`, `NfcTagAssigned` (new events); `MembershipId` added to `ids.ts`. `Customer`, `NfcTag`, `NfcAssignment`, `AssignmentTarget`, `CallerContext` unchanged. |
| Business Engine | `MembershipAuthorizationValidator` (new, structurally identical to `AssignmentValidator`). `AssignmentResolver`, `AssignmentValidator`, `WorkEventFactory`, `BusinessEngine` unchanged. |
| Application | `OrganizationManagementService`, `MembershipService`, `OrganizationAdministrationService` (new, orchestration-only, mirroring `NfcScanApplicationService`'s boundary). `NfcScanApplicationService`, `SynchronizationService`, `SessionService`, `WorkEventCreationService` unchanged. |
| Infrastructure | `OrganizationRepository`, `MembershipRepository` (new ports + new `InMemory*` implementations); `CustomerRepository`, `NfcTagRepository`, `NfcAssignmentRepository` (extended with a save method + updated `InMemory*` implementations). Durable/file-backed adapters for the new/extended repositories are a future, additive follow-up, exactly mirroring DT-015's precedent (in-memory default, durable adapter optional) — not required by TS-002 itself. `OfflineQueue`, `SynchronizationGateway`, `AuthenticationGateway`, `NfcScanPort`, `WorkEventCreationPort` unchanged. |
| Mobile / UI | Not touched by TS-002. Whatever entry point eventually calls these new Application Services (a CLI command mirroring `runScanCli.ts`'s precedent, or a future minimal admin screen) is Development Task / future-TS scope, not designed here. |
| Shared | `ids.ts` extended additively with `MembershipId`. No other shared utility changes. |

No business logic moves between areas; no new responsibility area is invented.

## Extension Strategy

TS-002 extends, and does not replace:

- **FB-001 / TS-001**: the entire scan pipeline (Sequence 6, above) is reused verbatim. TS-002 adds no new step to it and removes none.
- **Business Engine**: unchanged. It continues to receive the same `WorkEvent` shape from the same `WorkEventFactory`, regardless of whether the underlying `NfcAssignment`/`Customer` came from a fixture or from real Organization-owned data.
- **AssignmentValidator**: unchanged. Its `employee_lacks_organization_access`/`missing_assignment_target`/`assignment_target_disabled` outcomes are exactly preserved; `MembershipAuthorizationValidator` is a new, separate, structurally analogous component for administrative actions, not a modification of `AssignmentValidator`.
- **Current repositories**: `CustomerRepository`/`NfcTagRepository`/`NfcAssignmentRepository` gain one additive method each; every existing method and every existing caller of those methods is unaffected.
- **Current adapters**: `FakeAuthenticationGateway`, `FakeNfcScanAdapter`, `CliNfcScanAdapter`, `FakeSynchronizationGateway` are all unchanged. `runScan.ts`'s `buildScanDemoPipeline` continues to work exactly as today; it is not required to change for TS-002 to be implemented, though a future Development Task may choose to let it optionally accept Organization-owned repository instances the same way DT-015 let it optionally accept durable storage instances.
- **Current scan flow**: identical (Sequence 6, above).

Document of exactly what remains unchanged (for review convenience, repeating the Architecture Principles Preserved list): `BusinessEngine`, `AssignmentResolver`, `AssignmentValidator`, `WorkEventFactory`, `NfcScanApplicationService`, `NfcScanPort`, `WorkEventCreationPort`, `CallerContext`, `OfflineQueue`, `SynchronizationService`/`SynchronizationGateway`, `ErrorCategory` and its `classify*` functions.

## Identity Boundary

Unchanged from FB-002: TS-002 does not specify a real authentication provider, OAuth, Firebase Auth, Auth0, password handling, token/session architecture, or credential lifecycle. `FakeAuthenticationGateway` is not modified. `MembershipRepository.findByUserId` is defined as the Port a future Identity implementation would call to determine a real caller's `organizationId` (replacing today's hard-coded account map), but that future implementation, its provider, and its integration into `SessionService`/`toCallerContext` are explicitly out of scope here.

## Implementation Strategy (Logical Dependency Order, Not Development Tasks)

Recommended order, by dependency only — no Development Task numbering:

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

Each step is a precondition for the next: Membership cannot be authorized without an Organization to belong to; Administration cannot be authorized without `MembershipAuthorizationValidator`; the existing scan pipeline cannot be verified against real data until the extended repositories and Administration Service exist.

## Out of Scope

Unchanged from FB-002, restated for this specification's own boundary:

- Identity Provider selection, OAuth, Firebase Auth, password handling (Identity Boundary, above).
- Billing, reporting, exports, analytics, Customer self-service portal.
- The full `Role_Model.md` role matrix; Team Lead/System Owner implementation; permission-management UI.
- Approval workflows.
- Backend/cloud persistence technology, database schema, API design (REST/GraphQL), deployment topology, cloud provider selection — all remain deferred per ADR-0007 and are not resolved or narrowed by this specification.
- Any change to FB-001's business rules, decision logic, duplicate-scan/Finding F-01 behavior, or Business Engine decision logic.

## Quality Requirements Self-Check

- Implementation-readiness: every new/extended component's responsibility, dependency direction and boundary is stated; a Development Agent should need no further architectural decision beyond ordinary implementation choices (naming, exact method signatures, test structure).
- Traceability: every new component is traced to a specific FB-002 Capability/Decision and to a specific existing repository precedent (`AssignmentValidator`, `CustomerRepository`, `NfcScanApplicationService`, `ids.ts`, ADR-0002's `NfcAssignment` identity precedent).
- Authoritative for FB-002: this document is the complete technical translation of FB-002's five Capabilities; nothing in FB-002's In Scope is left technically unaddressed, and nothing beyond it is introduced.

## Open Questions Carried Forward (Not Resolved Here)

Unchanged from FB-002, plus one newly surfaced during this specification:

- FB-002 Open Questions 1–8 (provisioning mechanism, multi-organization membership, tag re-assignment/history, exact rejection semantics for "no Membership at all," cross-Organization payload collisions, Organization status, tag physical-provisioning workflow, Identity-layer sequencing) all remain open, unresolved by TS-002, and unaffected by it.
- **Newly surfaced (Membership-granting bootstrap):** `MembershipAuthorizationValidator` requires an existing Administrator Membership to authorize granting a new one — but the very first Membership of a newly created Organization has no existing Administrator to grant it. TS-002 does not resolve this; it is flagged as a Human Architect decision needed before or during implementation of `MembershipService` (candidates might include: the actor who created the Organization is automatically its first Administrator Membership, or an explicit pilot/manual bootstrap step outside `MembershipAuthorizationValidator`'s normal check — neither is decided here).

## Traceability

```text
Product Vision
  -> ADR-0002 / ADR-0003 / ADR-0005 / ADR-0006 / ADR-0007
  -> TTAP-001
  -> FB-001 (existing, unchanged) -> TS-001 (existing, unchanged)
  -> FB-002 (existing, Technical-Lead-reviewed)
  -> TS-002 (this document)
  -> Development Tasks (not yet created)
```

## Role Handover

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

## Stop Condition

Per task instruction: stop after TS-002 has been created. Do not create Development Tasks. Do not begin Sprint 012. Wait for Technical Lead review.
