# FB-002 – Organization Management Foundation

Status: Draft
Feature ID: FB-002
Feature Name: Organization Management Foundation
Version: 1.1
Epic: EP-009 – Product Readiness Framework (Product Capability Track); EP-007 – Product Architecture Foundation (architectural continuity)
Owner: Technical Lead
Approval Authority: Human Architect
Creation Date: 2026-07-07
Last Updated: 2026-07-07 (Technical Lead Review Follow-up: Capability Hierarchy naming evaluation; Membership Role terminology clarification)
Approval Date: Not yet approved
Related Product Vision: `ADO/01_Architecture/Product_Vision.md`
Related Product Principles: `ADO/01_Architecture/Product_Principles.md`
Related Domain Model: `ADO/01_Architecture/Domain_Model.md`
Related Role Model: `ADO/01_Architecture/Role_Model.md`
Related Architecture: `ADO/01_Architecture/Technical_Architecture_Profile.md` (TTAP-001)
Related ADRs: ADR-0002, ADR-0003, ADR-0005, ADR-0006, ADR-0007
Related Feature Blueprint: FB-001 – NFC Scan Creates Work Event (`ADO/01_Architecture/Feature_Blueprints/FB-001-nfc-scan-creates-work-event.md`)
Related Technical Specification: Not yet created (TS-002 is out of scope for this document)
Related Evidence: `ADO/05_Evidence/FB-002_Organization_Management_Scope_Assessment.md`
Related Governance: `ADO/02_Development/EP-009_Product_Readiness_Framework.md`, `ADO/05_Evidence/Product_Readiness_Assessment.md`, `ADO/05_Evidence/Product_Readiness_Roadmap.md`

## Purpose

FB-002 defines the second core product feature for TapTim.e: the minimal Organization and Membership foundation required for a real pilot customer.

It describes what shall exist so that an Organization, its Administrator(s), its Employees and its business assets (Customers, NFC Tags, NFC Assignments) are real, Organization-owned data — not the hard-coded demo fixtures FB-001's pipeline currently depends on (`buildScanDemoPipeline`, `FakeAuthenticationGateway`'s account map).

It does not define UI, database structure, API design, authentication provider selection or implementation details.

FDOS Rule:

> Feature Blueprints describe product behavior. They do not describe implementation.

## Business Goal

Enable TapTim.e to onboard a real pilot customer whose own Organization, Administrator, Employees, Customers and NFC Tags exist as real data, rather than as source-code fixtures shared by every user of the demo pipeline.

This is a precondition for any commercial pilot: without it, every organization using TapTim.e today is, in effect, the same hard-coded `'demo-org'`. The business value is unlocking the very first paying/piloting customer, per the Product Readiness Assessment's re-evaluated finding (Section 11.1) that Organization Management, not backend/cloud technology, is the primary bottleneck for reaching Pilot Customers.

## User Goal

An Administrator wants to set up their own business in TapTim.e: register the Customers/AssignmentTargets they do work for, register the NFC Tags they own, and assign each tag to the right Customer — all scoped to their own Organization, invisible to and unaffected by any other Organization's data.

An Employee wants to belong to their employer's Organization and scan an assigned NFC tag exactly as FB-001 already describes, with no change to that experience — the only difference is that the tag, its assignment and the resolved Customer are now real, Organization-owned data instead of a shared demo fixture.

## Business Context

TapTim.e is not merely a time tracking application. Per `Product_Vision.md`, it is the first capability of a broader Business Event Platform for small and medium-sized businesses, with the Business Engine as its strategic center. Development Sprints 001–011 built the first working scan-to-business-event foundation (FB-001/TS-001), most recently adding real NFC hardware integration (DT-016, Development Sprint 011). EP-009 established Product Readiness as a permanent governance stream running alongside Development Sprints and EP-008.

Every Development Sprint to date has proven and extended the *scan-to-WorkEvent* pipeline using one shared demo Organization, one demo Employee, one demo Customer and one demo NFC Tag, all defined as literal objects in `packages/core/src/cli/runScan.ts`, and one demo sign-in code authenticated by `FakeAuthenticationGateway`. This was correct and sufficient for proving the Business Engine, offline queue, durable persistence, error categorization and native NFC hardware integration in isolation. It is not sufficient for a second, real Organization to exist alongside the demo one. FB-002 closes that gap.

## Product Readiness Context

`Product_Readiness_Assessment.md` Section 11.1 (as re-evaluated after Technical Lead review) concludes that Organization Management is the primary bottleneck for reaching Pilot Customers, because no Feature Blueprint or Technical Specification exists for it — not because of any product-strategy gap. Section 12's Capability Hierarchy places this Blueprint's scope precisely:

```text
Business Event Platform
  |
  v
Identity            (who is acting: User, authentication, session)
  |
  v
Organization        (which business account: Organization, roles, membership)   <-- FB-002
  |
  v
People              (Employee, Admin, Team Lead — Role_Model.md's permission holders)   <-- FB-002 builds only its Membership slice (minimal)
  |
  v
Assets               (Customer, AssignmentTarget, NfcTag — the things work is tracked against)   <-- FB-002
  |
  v
NFC                 (the first trigger mechanism)   <-- FB-001, unchanged
  |
  v
Business Events / Business Engine / Time Tracking   <-- FB-001, unchanged
```

**Technical Lead Review Note (Capability Hierarchy naming).** The Technical Lead proposed replacing this hierarchy's "People" layer with "Membership" throughout this Blueprint. Repository evidence does not support a full replacement, and the existing wording is retained: `Product_Readiness_Assessment.md` Section 12.2 — the already-approved source of this diagram, not modified by this Blueprint — deliberately distinguishes the **Organization** layer's "roles, membership" (the abstract capability that an Organization has members and roles at all) from the **People** layer's "Employee, Admin, Team Lead" (the actual catalog of role-holder types, and, once a future Identity Feature Blueprint introduces real authenticated Users, potentially real actor/profile data — not only an association record). FB-002 itself builds only the narrower Membership slice of the People layer: an actor–Organization–Role association, with no standalone Person/User/Employee/Administrator domain object introduced (Domain Objects, below). Renaming the layer itself to "Membership" would overstate FB-002's own coverage and would remove the conceptual room the Assessment's hierarchy reserves for that broader, still-open People-layer scope (e.g., future User profile data). The diagram therefore keeps "People" exactly as `Product_Readiness_Assessment.md` Section 12.2 names it; the annotation beside it already makes explicit that FB-002 implements only its Membership slice.

`Product_Readiness_Roadmap.md` names Organization Management / FB-002 as a "Now" milestone item. `Development_Sprint_011_Closure.md` recommended, as one of two parallel next priorities, Human Architect initiation of FB-002 drafting. This Blueprint is that initiation, following the dedicated scope assessment referenced below.

## Repository Evidence

This Blueprint is built directly on `ADO/05_Evidence/FB-002_Organization_Management_Scope_Assessment.md`, which is the evidence baseline for every scope decision below. Key findings carried forward:

- ADR-0003 (Product Scope v1) already lists "Organization account," "User authentication," "Basic role model," "Employee users," "Customer records," "NFC tag registration," "NFC tag assignment to customers" and "Basic admin overview" as **In Scope for v1**, and explicitly lists "Customer self-service portal" as **Out of Scope for v1**. FB-002 is not new product scope; it is already-approved v1 scope that has never been translated into a Feature Blueprint.
- `Technical_Architecture_Profile.md` (TTAP-001) already names `Organization` as an Aggregate Root and `OrganizationId` as a domain identifier, and states "Every WorkEvent belongs to exactly one Organization" as an architectural invariant.
- Direct code inspection confirms: `Customer`, `NfcTag`, and `NfcAssignment` already exist as concrete, `organizationId`-scoped domain types (`packages/core/src/domain/`), but `CustomerRepository`, `NfcTagRepository` and `NfcAssignmentRepository` are all **read-only** today (`findById`, `findByPayload`, `findActiveByTagId` — no `save`/`create` method on any of the three, and none of their `InMemory*` implementations has one either). No `Organization`, `User`, `Employee`, `Administrator` or `Role` domain type exists anywhere in code — only the opaque `OrganizationId`/`UserId` branded identifiers exist, used inside `CallerContext`.
- `AssignmentValidator.validate()` already implements one real, tested piece of organization-scoped authorization: it rejects with `employee_lacks_organization_access` when `caller.organizationId !== assignment.organizationId`, and separately rejects via `missing_assignment_target` / `assignment_target_disabled`. This logic is preserved unchanged by FB-002 (Business Rules, below).
- `FakeAuthenticationGateway` is today's entire mechanism for "which Organization does this Employee belong to" — a hard-coded map of sign-in code to `{ userId, organizationId }`. Per the Scope Assessment's Addendum (Section 10, following a direct Technical Lead follow-up question), Identity (the authentication mechanism itself) and Membership (which Organization/Role a caller belongs to) are evidenced as separable: `Product_Readiness_Assessment.md` Section 12.2 already places "roles, membership" under the **Organization** capability layer, not the Identity layer, and `FakeAuthenticationGateway`'s existing multi-account constructor shows the two capabilities are not implementation-coupled today. FB-002 therefore includes Membership and excludes the authentication mechanism itself, per the Identity Boundary section below.
- `Role_Model.md` (Status: "Sprint 1 Draft," unchanged since 2026-06-26) defines four roles (System Owner, Administrator, Team Lead, Employee) with a full permission matrix, none of which has any code-level presence. FB-002 deliberately implements only the minimal Administrator/Employee distinction needed for pilot readiness, per the Technical Lead's explicit scope decision, leaving the full matrix as documented but not-yet-built target (Out of Scope, below).

## In Scope

- Organization existence as a real, addressable business container (not only an ID).
- Organization status, if repository evidence or Decision Logic requires distinguishing an active Organization from an inactive one (see Open Questions).
- Membership: an association between an actor (`UserId`) and an Organization, carrying a minimal Membership Role.
- Minimal Membership Roles: Administrator, Employee only — Roles carried by a Membership, not standalone domain entities.
- Customer / AssignmentTarget creation, owned by an Organization.
- NFC Tag registration, owned by an Organization.
- NFC Tag assignment to an AssignmentTarget, within the same Organization.
- Organization-scoped data ownership for Customer, NfcTag and NfcAssignment.
- Organization-scoped authorization for administrative actions (creating/registering/assigning), mirroring the organization-scoping already enforced for scans by `AssignmentValidator`.
- Preservation of FB-001's existing scan authorization behavior, unchanged.
- Pilot/manual provisioning of Organizations, Memberships, Customers and NFC Tags (an Administrator or an equivalent manual/internal mechanism performs setup; no self-service signup flow).
- Replacing hard-coded, source-code demo fixtures as a product capability goal — the demo Organization may continue to exist as one Organization among others, but must no longer be the *only* Organization the system can represent.
- Relationship to FB-001's existing scan flow (Cross-Blueprint References, below).
- Relationship to EP-009 Product Readiness (Product Readiness Context, above).

## Out of Scope

- Self-service Organization signup or registration flow.
- Customer self-service portal (ADR-0003 already excludes this from v1).
- Billing, subscriptions, pricing, invoices.
- The full four-role permission matrix (`Role_Model.md`'s System Owner / Administrator / Team Lead / Employee distinctions and its Version 1 Minimal Permission Matrix) beyond the minimal Administrator/Employee Membership Roles.
- Team Lead role implementation.
- System Owner role implementation.
- Permission-management UI.
- User lifecycle management beyond minimal Membership (no invitations, deactivation workflows, or multi-organization membership).
- Password flows, OAuth, magic links, token/session architecture, managed identity provider selection (Firebase Auth, Auth0 or otherwise) — see Identity Boundary.
- The backend/cloud persistence technology decision (remains deferred per ADR-0007; FB-002 does not resolve it).
- Reporting, exports, time correction, approval workflows.
- Mobile-native NFC tag writing/physical provisioning; iOS-specific NFC behavior; physical-device validation of scanning (these remain DT-016's and NFC_Capability_Model.md's open items, untouched by FB-002).
- Any change to FB-001's business rules, decision logic or the duplicate-scan/Finding F-01 behavior.
- Any change to Business Engine decision logic.

## Product Rules

FB-002 is evaluated against the same Product Principles FB-001 was evaluated against:

- **One Tap. One Decision.** Not directly applicable to administrative setup, which is inherently a multi-step configuration activity, not a single operational interaction. This principle continues to govern only the Employee's scan experience, which FB-002 leaves entirely unchanged.
- **The Engine Decides.** Unaffected. FB-002 introduces no new Business Engine decision; it only supplies the Business Engine's existing inputs (Customer, NfcTag, NfcAssignment, CallerContext) from real Organization-owned data instead of fixtures.
- **Zero Decision UX.** Applies to the Employee's scan flow only, which is unchanged. Administrative setup (registering a tag, assigning it) is necessarily a deliberate decision by the Administrator, not an operational scan; this does not conflict with Zero Decision UX, which governs operational work, not one-time setup.
- **Offline by Default.** Not required for administrative setup. Organization/Membership/Customer/NfcTag/NfcAssignment creation are configuration activities, reasonably assumed to require connectivity; FB-001's offline-by-default guarantee for the scan/WorkEvent/TimeEntry path is entirely preserved and unaffected.
- **Everything is Auditable.** Applies directly: every Organization, Membership, Customer, NfcTag and NfcAssignment creation is a traceable business fact (see Events, below), consistent with FB-001's existing auditability rule for scans.
- **Professional Simplicity.** Directly supports the Technical Lead's explicit scope decision to keep FB-002 a small foundation (Organization, Membership, minimal Roles, Business Assets, Administration) rather than a full admin platform (Out of Scope, above).

## Actors

Administrator and Employee are not standalone domain entities. Both are **Membership Roles** — a Role carried by a Membership within an Organization (Core Concepts, Domain Objects, below). They are listed here as Actors, per Feature Blueprint Standard convention, for readability only; every reference to "an Administrator" or "an Employee" below means "an actor whose Membership in that Organization carries the Administrator/Employee Role," not a separate Administrator/Employee entity.

- **Organization** — the business container itself. Not a person, but the scoping context every other actor and Business Asset belongs to.
- **Administrator (Membership Role)** — an actor whose Membership carries the Administrator Role. May create Customers/AssignmentTargets, register NFC Tags, and assign NFC Tags to AssignmentTargets, only within their own Organization.
- **Employee (Membership Role)** — an actor whose Membership carries the Employee Role. May scan an assigned NFC Tag exactly as FB-001 describes; may not perform any administrative action (Business Rules, below).

System Owner and Team Lead (`Role_Model.md`) are explicitly not implemented as distinct Membership Roles in this Blueprint; every Membership in FB-002's scope carries either the Administrator or Employee Role (Out of Scope, above; Open Questions, below).

## Core Concepts

- **Organization**: the owning business container for all of an actor's and business asset's data. Every Customer, NfcTag and NfcAssignment belongs to exactly one Organization.
- **Membership**: the association between an actor and an Organization, carrying exactly one minimal Membership Role (Administrator or Employee). Membership answers "which Organization and role is this actor associated with?" — distinct from Identity, which answers "who has authenticated?" (Identity Boundary, below).
- **Membership Role (minimal)**: Administrator or Employee — a property carried by a Membership, not a standalone domain entity in its own right. Determines whether a Membership may perform administrative actions (Business Rules, below). Not the full `Role_Model.md` matrix.
- **Customer / AssignmentTarget**: an Organization-owned target that work is tracked against, exactly as already modeled by FB-001/ADR-0002 — FB-002 adds the ability to create one, not a new shape for it.
- **NFC Tag**: an Organization-owned physical token identifier, exactly as already modeled by FB-001/ADR-0002 — FB-002 adds the ability to register one, not a new shape for it.
- **NFC Assignment**: the Organization-owned mapping of an NFC Tag to an AssignmentTarget, exactly as already modeled by FB-001/ADR-0002 — FB-002 adds the ability to create one, not a new shape for it.

## Domain Objects

FB-002 uses the domain language defined by TTAP-001 and `Domain_Model.md`, extending it as follows:

- **Organization** — extended from an identifier-only concept (`OrganizationId`) to a real domain object. New.
- **Membership** — the association of an actor with an Organization and a minimal Membership Role. New.
- **Membership Role (minimal)** — Administrator or Employee, carried by a Membership; not a standalone domain object. New, minimal subset of `Role_Model.md`'s documented four roles.
- **Customer / AssignmentTarget** — existing, unchanged shape (ADR-0002, FB-001). Extended only with a creation capability.
- **NfcTag** — existing, unchanged shape (ADR-0002, FB-001). Extended only with a registration capability.
- **NfcAssignment** — existing, unchanged shape (ADR-0002, FB-001). Extended only with a creation capability.
- **CallerContext** — existing, unchanged shape (Development Sprint 001). FB-002 does not alter it; a Membership is what a future Technical Specification would use to populate `CallerContext.organizationId` for a real (non-fixture) caller, but that population mechanism belongs to Identity, not FB-002 (Identity Boundary, below).

No change is made to `WorkEvent`, `TimeEntry`, `BusinessEngine`, `OfflineQueue`, or `SyncState`.

## Business Rules

- Every Organization exists independently of the demo Organization; the system must be able to represent more than one Organization.
- Every Customer belongs to exactly one Organization.
- Every NFC Tag belongs to exactly one Organization.
- Every NFC Assignment belongs to exactly one Organization.
- A Tag may be assigned only to an AssignmentTarget in the same Organization.
- Only a Membership with the Administrator Role may create or assign Organization-owned pilot data (Customer/AssignmentTarget creation, NFC Tag registration, NFC Tag assignment).
- An Employee Membership may scan but may not administer Organization-owned assets.
- A scan may only be evaluated inside the Organization context of the authenticated caller's Membership — this is a restatement, not a change, of `AssignmentValidator`'s existing `employee_lacks_organization_access` behavior, which FB-002 must preserve exactly.
- Cross-Organization access must be rejected or impossible by construction for both administrative actions (new, per FB-002) and scan evaluation (existing, per FB-001/`AssignmentValidator`).
- A Membership belongs to exactly one Organization (Open Questions records whether this may ever change).
- FB-002 does not invent duplicate-scan behavior (Finding F-01 remains exactly as FB-001 left it).
- FB-002 does not invent billing or pricing rules.
- FB-002 does not invent or specify real authentication behavior (Identity Boundary, below).

## Events

- OrganizationCreated
- MembershipGranted
- CustomerCreated
- NfcTagRegistered
- NfcTagAssigned
- AdministrativeActionRejected (an actor without an Administrator Membership, or an actor acting outside their own Organization, attempted to create/register/assign)
- CrossOrganizationAccessRejected (an administrative action or scan resolution was attempted against a different Organization's data)

Events describe facts that happened, consistent with FB-001's existing event style (e.g., `NfcTagScanned`, `WorkEventCreated`). No event above changes or duplicates any FB-001 event (`NfcTagScanned`, `NfcAssignmentResolved`, `NfcAssignmentRejected`, `WorkEventCreated`, `DuplicateScanIgnored`, `TimeEntryStarted`, `TimeEntryStopped`, `TimeEntryPending`, `WorkEventQueuedForSync`), which remain entirely owned by FB-001.

## Decision Logic

### Decision 1: Create Organization

Trigger: an Administrator-provisioning action (pilot/manual setup) requests a new Organization.

Preconditions: none beyond the request itself — Organization creation has no dependency on any other Organization's data.

Decision: create the Organization.

Result: OrganizationCreated.

### Decision 2: Create Membership

Trigger: an actor is to be associated with an Organization and a minimal Role.

Preconditions: the Organization must exist (Decision 1).

Decision: associate the actor with the Organization and a Membership Role (Administrator or Employee).

Result: MembershipGranted.

### Decision 3: Create Customer / AssignmentTarget

Trigger: an Administrator Membership requests a new Customer within their Organization.

Preconditions: the requesting Membership must have the Administrator Role and must belong to the target Organization.

Decision: create the Customer, owned by that Organization; otherwise reject.

Result: CustomerCreated, or AdministrativeActionRejected.

### Decision 4: Register NFC Tag

Trigger: an Administrator Membership requests registration of a new NFC Tag within their Organization.

Preconditions: same as Decision 3.

Decision: register the NFC Tag, owned by that Organization; otherwise reject.

Result: NfcTagRegistered, or AdministrativeActionRejected.

### Decision 5: Assign NFC Tag

Trigger: an Administrator Membership requests assigning a registered NFC Tag to an AssignmentTarget.

Preconditions: the requesting Membership must have the Administrator Role and belong to the same Organization as both the NFC Tag and the AssignmentTarget.

Decision: create the NfcAssignment if the Tag and the AssignmentTarget belong to the same Organization as the requesting Membership; otherwise reject.

Result: NfcTagAssigned, or CrossOrganizationAccessRejected.

### Decision 6: Evaluate Whether an Actor May Perform an Administrative Action

Trigger: any of Decisions 3–5.

Decision: the actor's Membership must exist, must carry the Administrator Role, and must belong to the same Organization as the data being created/registered/assigned.

Result: proceed, or AdministrativeActionRejected / CrossOrganizationAccessRejected.

### Decision 7: Evaluate Whether a Scan Belongs to the Same Organization Context

Trigger: NfcAssignmentResolved (FB-001, unchanged).

Decision: this is `AssignmentValidator`'s existing, preserved decision — the caller's `organizationId` (now sourced from a real Membership rather than a fixture) must match the resolved assignment's `organizationId`.

Result: proceed to FB-001's existing validation outcomes, or `employee_lacks_organization_access` (unchanged).

Decision Logic here remains conceptual, as required at Feature Blueprint level; no implementation classes, database schema or API endpoints are specified.

## Capability Breakdown

**Capability 1 — Organization.** The customer business container. Establishes that an Organization is a real, creatable thing, not only an identifier.

**Capability 2 — Membership.** The association between an actor, an Organization and a minimal Membership Role (Administrator or Employee — Roles carried by the Membership, not standalone entities). Answers "which Organization and role is this actor associated with?"

**Capability 3 — Business Assets.** Customer/AssignmentTarget, NFC Tag, and NFC Assignment, each owned by exactly one Organization — the same shapes FB-001 already defines, now creatable rather than fixed.

**Capability 4 — Administration.** The minimal Administrator actions required to prepare a pilot: create a Customer/AssignmentTarget, register an NFC Tag, assign an NFC Tag to an AssignmentTarget — each scoped to the Administrator's own Organization.

**Capability 5 — Scan Pipeline Enablement.** How the existing FB-001 scan pipeline (`AssignmentResolver`, `AssignmentValidator`, `WorkEventFactory`, `BusinessEngine`, the NFC adapter architecture) consumes Organization-owned data produced by Capabilities 1–4 instead of `runScan.ts`'s hard-coded demo fixture, with zero change to that pipeline's own logic.

## User Flows

### Flow 1 — Pilot Organization Setup (Administrator)

```text
Organization exists (Capability 1)
  -> Administrator Membership exists, belonging to that Organization (Capability 2)
  -> Administrator creates Customer / AssignmentTarget (Capability 4 -> Capability 3)
  -> Administrator registers NFC Tag (Capability 4 -> Capability 3)
  -> Administrator assigns NFC Tag to AssignmentTarget (Capability 4 -> Capability 3)
```

### Flow 2 — Employee Scan Against Real Organization Data (unchanged from FB-001, now Organization-owned)

```text
Employee Membership exists, belonging to the same Organization (Capability 2)
  -> Employee scans assigned NFC Tag (FB-001, unchanged)
  -> AssignmentResolver resolves tag -> assignment (FB-001, unchanged, now reading Organization-owned data)
  -> AssignmentValidator evaluates organization-scoped authorization (FB-001, unchanged)
  -> Business Engine evaluates the scan and derives the WorkEvent/TimeEntry outcome (FB-001, unchanged)
```

### Flow 3 — Rejected Cross-Organization Attempt

```text
Administrator (Organization A) attempts to create/register/assign data referencing Organization B's Customer/NfcTag
  -> Decision 6 rejects: CrossOrganizationAccessRejected
```

## Edge Cases

- An actor with no Membership at all attempts an administrative action.
- An Employee Membership attempts an administrative action (create/register/assign).
- An Administrator attempts to create a Customer, register a Tag, or assign a Tag referencing a different Organization's data (Flow 3).
- An Organization has zero Administrators (no one able to provision it).
- An NFC Tag is registered but never assigned (valid, inert state — mirrors FB-001's "inactive assignment" edge case, but at the registration stage).
- An NFC Tag already assigned to one AssignmentTarget is assigned again to a different AssignmentTarget within the same Organization (re-assignment; `Domain_Model.md`'s own Open Modeling Question, "Can one NFC tag have multiple assignments over time?", applies and is not resolved here — see Open Questions).
- Two different Organizations independently register a Tag with the same physical payload (payload collision across Organizations — not resolved here; see Open Questions).
- A Customer/AssignmentTarget is created but never referenced by any NFC Assignment (valid, inert state).
- An authenticated caller's Membership cannot be found at scan time (distinct from FB-001's existing `employee_not_authenticated`; this is "authenticated but not a member of any Organization" — see Open Questions on exact rejection semantics).
- The demo Organization (`'demo-org'`) continues to exist alongside real Organizations; nothing in FB-002 requires removing it.

## Acceptance Criteria

- A real, non-demo Organization can exist and be distinguished from `'demo-org'`.
- An Administrator Membership scoped to a real Organization can create a Customer/AssignmentTarget, register an NFC Tag, and assign that Tag to the AssignmentTarget, all within that Organization.
- An Employee Membership scoped to the same Organization can scan the assigned Tag and receive the same FB-001-defined outcome as the demo pipeline already produces, without any change to `AssignmentResolver`, `AssignmentValidator`, `WorkEventFactory` or `BusinessEngine`.
- An Administrator Membership cannot create, register or assign data referencing a different Organization's Customer or Tag.
- An Employee Membership cannot perform any administrative action (create/register/assign).
- `AssignmentValidator`'s existing `employee_lacks_organization_access`, `missing_assignment_target` and `assignment_target_disabled` outcomes remain unchanged and continue to pass their existing tests.
- The feature remains traceable to TTAP-001, ADR-0002, ADR-0003, ADR-0006 and the FB-002 Scope Assessment.
- No implementation details are required to understand feature behavior.

## Technical Notes

Technical implementation is deferred to a future TS-002, not created by this Blueprint. For the Technical Lead's future sizing reference only (not a specification): the Scope Assessment identifies that `CustomerRepository`, `NfcTagRepository` and `NfcAssignmentRepository` are read-only today and would need write-capable methods; no `Organization`/`Membership`/`Role` domain type or repository exists at all today and would need to be created; the backend/cloud persistence technology for any new writable repository remains an independently deferred decision (ADR-0007) that this Blueprint does not resolve. Technical Notes here introduce no Business Rules, Product Rules or business decisions beyond what is already stated above.

## Identity Boundary

Identity is explicitly not part of FB-002. FB-002 does not specify: a real authentication provider, Firebase Auth, Auth0, OAuth, password reset, magic links, token handling, or credential lifecycle. Identity remains a separate, future capability/Feature Blueprint, gated on ADR-0007's own already-deferred managed-authentication-provider decision.

Membership, however, is part of FB-002. The distinction: Identity answers "who has authenticated?"; Membership answers "which Organization and role is this actor associated with?" FB-002 may assume an already-authenticated caller, or a pilot/manual identity mechanism (e.g., today's `FakeAuthenticationGateway`, possibly extended with more manually-configured accounts), but does not design the authentication mechanism itself. This boundary is evidenced, not asserted, by `Product_Readiness_Assessment.md` Section 12.2 (which places "roles, membership" under the Organization layer, distinct from Identity) and by the FB-002 Scope Assessment's Addendum (Section 10), which found the two capabilities are not implementation-coupled today (`FakeAuthenticationGateway`'s existing multi-account design).

## Cross-Blueprint References

- **FB-001 – NFC Scan Creates Work Event.** FB-002 depends on FB-001 because Capability 5 (Scan Pipeline Enablement) requires that FB-001's existing pipeline be able to operate on Organization-owned data. Affected Domain Objects: `Customer`, `NfcTag`, `NfcAssignment` (creation capability added; shapes unchanged). Affected Business Rules: none of FB-001's Business Rules change; FB-002 adds new Business Rules governing creation/administration, layered alongside FB-001's existing scan-time rules. Affected Decision Logic: none of FB-001's Decision Logic (Decisions 1–4 in FB-001) changes; FB-002's Decision 7 explicitly restates, and requires the preservation of, FB-001's/`AssignmentValidator`'s existing organization-scoped check. FB-002 must not redefine FB-001.

## Architecture Decision References

- **ADR-0002 (NFC Assignment Model)** — constrains FB-002 to keep `NfcTag`, `NfcAssignment` and `AssignmentTarget` conceptually separate and to keep the target type extensible; FB-002's NFC Tag registration/assignment capabilities must produce data in this exact shape, not a simplified or collapsed one.
- **ADR-0003 (Product Scope v1)** — already approves "Organization account," "User authentication," "Basic role model," "Employee users," "Customer records," "NFC tag registration," "NFC tag assignment to customers" and "Basic admin overview" as v1 scope, and already excludes "Customer self-service portal." FB-002 operates entirely within this already-approved boundary.
- **ADR-0006 (Domain-first Architecture)** — constrains FB-002's new Domain Objects (Organization, Membership, minimal Role) to be modeled as business concepts first; no persistence-technology shape may define them.
- **ADR-0007 (Technology Platform Baseline)** — its deferred backend/cloud persistence technology decision and its deferred managed-authentication-provider decision both remain unresolved by FB-002; FB-002 depends on neither being resolved first (Technical Notes, Identity Boundary, above).

ADR references explain why an architectural boundary exists; they do not replace this Blueprint's own content.

## Open Questions

Carried forward from the FB-002 Scope Assessment (Section 8) and from `Domain_Model.md`/`Role_Model.md`'s own open questions, requiring Human Architect decision before or during a future TS-002:

1. How is Organization/Membership initially established for a pilot — direct config entry, an internal admin tool, or a minimal Administrator-only UI? (Manual/admin-driven provisioning is the recommended direction; the exact mechanism is not decided here.)
2. Can a Membership ever span more than one Organization? `Role_Model.md`'s own Open Questions ask this; `CallerContext`'s current shape assumes no; FB-002 assumes no.
3. Can one NFC Tag have multiple assignments over time (re-assignment), and should assignment history be immutable for auditability? (`Domain_Model.md`'s own Open Modeling Question; not resolved by FB-002.)
4. What is the correct rejection semantics and Event name when an authenticated actor has no Membership at all, versus a Membership in the wrong Organization? (Edge Cases, above.)
5. Should an NFC Tag payload collision across two different Organizations be prevented, detected, or considered out of scope for a pilot where only one or a small number of real Organizations exist? (Edge Cases, above.)
6. Is an explicit Organization "status" (active/inactive) required for pilot readiness, or is Organization existence alone sufficient? (`In Scope` lists this conditionally.)
7. Should NFC Tag registration in a future TS-002 include any physical-provisioning workflow, or only registration of an already-encoded payload string, mirroring today's `createNfcPayload(DEMO_KNOWN_PAYLOAD)` pattern? (`NFC_Capability_Model.md`'s own Open Technical Question, "Do we need tag provisioning inside the app?", applies and is not resolved here.)
8. When should the future Identity-layer Feature Blueprint (real authentication provider) be scheduled relative to FB-002/TS-002 — before, after, or fully in parallel? (Identity Boundary, above.)

## Traceability

```text
Product Vision
  -> ADR-0002 / ADR-0003 / ADR-0005 / ADR-0006 / ADR-0007
  -> TTAP-001
  -> FB-001 (existing, unchanged)
  -> FB-002 (this Blueprint)
  -> FB-002 Scope Assessment (ADO/05_Evidence/FB-002_Organization_Management_Scope_Assessment.md)
  -> TS-002 (not yet created)
  -> Development Tasks (not yet created)
```

## Revision Note (Technical Lead Review Follow-up, 2026-07-07)

FB-002 has completed a first round of Technical Lead review. This is a refinement of the Draft, not a rewrite; no Business Rule, Domain Object, Decision Logic outcome, Scope item, or Acceptance Criterion changed in meaning.

- **Change 1 (Capability Hierarchy naming).** Evaluated the Technical Lead's proposal to replace "People" with "Membership" throughout the Capability Hierarchy. Repository evidence (`Product_Readiness_Assessment.md` Section 12.2's already-approved layer distinction between "Organization" and "People," and the fact that FB-002 builds only a Membership-shaped slice of a layer that could in future also hold real User/profile data) contradicts a full replacement. The existing "People" wording is retained, with an added explanation in Product Readiness Context. See that section's "Technical Lead Review Note" for the full reasoning.
- **Change 2 (Membership Role terminology).** Administrator and Employee are now consistently described as **Membership Roles** — Roles carried by a Membership within an Organization, not standalone domain entities. Clarified in Actors, Core Concepts, Domain Objects, In Scope, Out of Scope, Capability Breakdown, and Decision 2. No new concept was introduced and no Business Rule was modified; Business Rules already used this framing ("a Membership with the Administrator Role," "An Employee Membership") and were left untouched.

Version bumped to 1.1 to reflect this refinement round (Status remains Draft; not yet Approved).

## Role Handover

Implemented scope: FB-002 – Organization Management Foundation created as a Draft Feature Blueprint, per the Technical Lead's explicit scope decision (Organization, Membership, minimal Administrator/Employee Roles, Organization-owned Business Assets, Administration, Scan Pipeline Enablement), directly built on `ADO/05_Evidence/FB-002_Organization_Management_Scope_Assessment.md` and its Identity/Membership-split Addendum. No TS-002, no Development Task, no ADR, no TTAP change, no EP-008 change, no code, and no test was created or modified.

Changed files:

- New: `ADO/01_Architecture/Feature_Blueprints/FB-002-organization-management-foundation.md` (this document).
- Updated: `ADO/00_Core/Decision_Log.md` (new entry recording FB-002's creation).
- Updated: `ADO/README.md` (Feature Blueprints navigation row updated to reference FB-002 alongside FB-001).
- Updated: `ADO/00_Core/Project_Status.md` (Status line, one Current State bullet, Current Epics/Goals, and Immediate Next Steps item 3). This is judged a material repository-state change, not a discretionary rewrite: `Project_Status.md` explicitly tracked "initiate Feature Blueprint drafting for Organization Management (FB-002)" as an open next step and Goal; that step is now done, and leaving the text unchanged would have made it actively inaccurate (it would still tell a reader to *initiate* drafting rather than to *review* the resulting Draft). No other content in the file was touched.

Related ADO artifacts consulted: `ADO/05_Evidence/FB-002_Organization_Management_Scope_Assessment.md`, `Product_Vision.md`, `Product_Principles.md`, `Domain_Model.md`, `Role_Model.md`, `System_Overview.md` (previously reviewed in this engagement, content not found to have drifted), `NFC_Capability_Model.md`, `Technical_Architecture_Profile.md`, `Feature_Blueprint_Standard.md`, `FB-001-nfc-scan-creates-work-event.md`, ADR-0002, ADR-0003, ADR-0005, ADR-0006, ADR-0007, `EP-007_Development_Tasks.md`, `EP-009_Product_Readiness_Framework.md`, `Product_Readiness_Assessment.md`, `Product_Readiness_Roadmap.md`, `Development_Sprint_011_Closure.md`, `Decision_Log.md`, and direct inspection of current repository code (`packages/core/src/domain/`, `packages/core/src/ports/`, `packages/core/src/infrastructure/repositories/`, `packages/core/src/business/AssignmentResolver.ts`, `packages/core/src/business/AssignmentValidator.ts`, `packages/core/src/infrastructure/adapters/FakeAuthenticationGateway.ts`, `packages/core/src/application/SessionService.ts`, `packages/core/src/cli/runScan.ts`).

Known deviations: none from the assigned task scope. The Blueprint follows FB-001's established style and metadata format, extended (not redesigned) with additional sections (Business Context, Product Readiness Context, Repository Evidence, Actors, Core Concepts, Capability Breakdown, User Flows, Identity Boundary, Open Questions) as explicitly required by this task's Blueprint Quality Requirements, and as justified by FB-002's larger identity/membership/authorization surface compared to FB-001's narrower scan-only scope.

Unresolved questions / open findings carried forward: the eight Open Questions above; all pre-existing open findings from prior Development Sprint closures (physical Android device/NFC-tag validation of DT-016; iOS NFC support; Development Sprint 002/004 governance backlog; Development Sprint 005's unsynchronized EP-008 narrative; Finding F-01; the backend/cloud persistence technology decision; the future Identity-layer Feature Blueprint) remain exactly as previously recorded and are not affected by this task.

Evidence produced: this Blueprint, the Decision Log entry, and the ADO/README.md navigation update.

Next responsible role: Technical Lead to review FB-002 for approval readiness; Human Architect to resolve the Open Questions (Section "Open Questions") that a future TS-002 would need decided. Per the assigned stop condition, this task does not create TS-002, does not create Development Tasks, and does not begin Development Sprint 012.

**Follow-up (Technical Lead Review Follow-up, 2026-07-07):** Applied Change 1 and Change 2 above (Revision Note). Only this file (`ADO/01_Architecture/Feature_Blueprints/FB-002-organization-management-foundation.md`) was modified — no Decision Log, README, Project_Status, code, or other repository file was touched, per this follow-up's explicit instruction. Stop condition: stop after this update; await further Technical Lead review.

## Stop Condition

Per task instruction: stop after FB-002 has been created and the minimum required cross-references have been updated. Do not continue to TS-002. Do not create Development Tasks. Do not begin Sprint 012. Await Technical Lead review.
