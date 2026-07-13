# Block B Backend, Tenant Isolation and Async Architecture Assessment

Status: Technical Lead Approved as Decision Package — Human Architect Decision Required, No Implementation
Date: 2026-07-13
Roadmap: Core Roadmap v2, Block B (DT-036–DT-044)
Role: Implementation Agent supporting Technical Lead
Approval Authority for proposed architecture: Human Architect
Proposed ADR: `ADO/01_Architecture/ADR/ADR-0008-backend-tenant-isolation-and-async-foundation.md`

## 1. Purpose and Scope

This assessment is the repository-grounded decision package for Block B. It inventories current synchronous boundaries, maps the async migration impact, defines target responsibility and security boundaries, proposes a server data model, evaluates managed backend/auth options and identifies the decisions still requiring Human Architect approval.

This task changes documentation only. It does not:

- select a provider by implementation;
- install dependencies;
- create a backend adapter, server application or cloud resource;
- change a port or Application Service;
- change Business Rules;
- implement authentication, synchronization or Admin Web;
- update FB-001, TS-001, FB-002 or TS-002.

## 2. Executive Finding

TapTim.e does not need a rewrite. Its Domain, Business Engine and ports/adapters direction remain sound. Block B is nevertheless a cross-cutting migration because every effectful Core port is synchronous and every caller assumes immediate results.

The recommended architecture is:

```text
Mobile (offline capture + local queue)       Future Admin Web
                 |                                  |
                 +--------- authenticated API ------+
                                      |
                              Backend application
                         (Core use cases + Business Engine)
                                      |
                         tenant-scoped repository adapters
                                      |
                    Managed PostgreSQL + RLS + audit/sync data
                                      |
                              Managed authentication
```

Provider recommendation, pending approval: Supabase-managed PostgreSQL plus Supabase Auth, with a thin server API. A persistent managed Node.js runtime is the preferred primary runtime for the transactional lifecycle API. Supabase Edge Functions remain an alternative for narrow stateless tasks and may host lifecycle ingestion only after an expanded spike proves Core packaging, genuine multi-table rollback, JWT/RLS context, connection reuse and transaction-pool compatibility.

The critical security decision is not the provider name. It is that authorization is enforced from verified identity plus server Membership plus tenant-scoped persistence, with no client-trusted Organization/role and no general service-role bypass.

## 3. Repository Evidence Baseline

### 3.1 Governing decisions preserved

| Artifact | Constraint preserved by Block B |
|---|---|
| ADR-0004 | Core WorkEvents remain capturable offline and synchronized later. |
| ADR-0005 | NFC/controller/database code does not decide Start, Stop, Duplicate, Rejection or Escalation. |
| ADR-0006 | Database rows are persistence mappings, not the Domain Model. |
| ADR-0007 | Managed auth, cloud persistence and explicit application-controlled sync; provider was intentionally open. |
| TTAP-001 | Domain-first, observable, explicit synchronization, immutable event evidence and strict layers. |
| FB-001 / TS-001 / F-01 | Engine-driven TimeEntry lifecycle, user independence, duplicate ordering and WorkEvent traceability. |
| FB-002 / TS-002 | Organization/Membership separation, minimal Administrator/Employee roles and Organization-owned assets. |
| Core Roadmap v2 | Backend decision/security/async planning precedes server adapter implementation. |

### 3.2 Current code baseline

- Repository root is a two-workspace npm monorepo: `packages/core` and `apps/mobile`.
- Core currently has no runtime dependency and deliberately contains provider-neutral Domain, Business and Application code.
- Mobile uses Expo/React Native and `react-native-nfc-manager`.
- The only durable adapters are synchronous JSON-file adapters for WorkEvent, TimeEntry and OfflineQueue.
- There is no backend workspace, HTTP API, database migration, server authorization policy or real network adapter.
- There is no Admin Web workspace.
- CI, tests-inclusive typecheck and the full local TimeEntry lifecycle are present after Block A.
- An independent Claude architecture/security review returned `CHANGES REQUIRED` without rejecting the Supabase/PostgreSQL direction. All findings are incorporated in this corrected assessment and dispositioned in `Block_B_Independent_Architecture_Security_Review.md`.

## 4. Complete Synchronous Port Inventory

All 12 effectful ports return immediate values today. No port under `packages/core/src/ports` contains `Promise` or `async`.

| Port | Current synchronous operations | Current implementations | Direct production consumers |
|---|---|---|---|
| `AuthenticationGateway` | `authenticate` | `FakeAuthenticationGateway` | `SessionService` |
| `CustomerRepository` | `findById`, `save` | `InMemoryCustomerRepository` | `AssignmentValidator`, `OrganizationAdministrationService` |
| `MembershipRepository` | `findByUserId`, `save` | `InMemoryMembershipRepository` | `MembershipService`; future session resolution not wired |
| `NfcAssignmentRepository` | `findActiveByTagId`, `save` | `InMemoryNfcAssignmentRepository` | `AssignmentResolver`, `OrganizationAdministrationService` |
| `NfcScanPort` | `scan` | Fake, CLI and native React Native adapters | `NfcScanApplicationService` |
| `NfcTagRepository` | `findByPayload`, `register` | `InMemoryNfcTagRepository` | `AssignmentResolver`, `OrganizationAdministrationService` |
| `OfflineQueue` | `enqueue`, `findPending`, `updateSyncState` | In-memory and JSON-file adapters | `WorkEventCreationService`, `SynchronizationService` |
| `OrganizationRepository` | `findById`, `save` | `InMemoryOrganizationRepository` | `OrganizationManagementService` (save); no production read caller |
| `SynchronizationGateway` | `synchronize` | `FakeSynchronizationGateway` | `SynchronizationService` |
| `TimeEntryRepository` | `findActiveByUser`, `save`, `update` | In-memory and JSON-file adapters | `WorkEventCreationService` |
| `WorkEventCreationPort` | `handleValidatedAssignment` | `WorkEventCreationService` | `NfcScanApplicationService` |
| `WorkEventRepository` | `findLatestByUserAndTarget`, `save` | In-memory and JSON-file adapters | `WorkEventCreationService` |

### 4.1 Important repository-query gaps for server use

The current port shapes prove local use cases but are not yet sufficient as a complete server API:

- most find methods do not carry `OrganizationId` because current in-memory callers already hold an ID or globally search a payload;
- `MembershipRepository.findByUserId` assumes one Membership per actor;
- organization-wide TimeEntry/WorkEvent reads required by Admin Web/export do not exist;
- no optimistic-concurrency/version parameter exists;
- no explicit transaction/unit-of-work boundary spans WorkEvent, TimeEntry and decision persistence;
- `OfflineQueue.updateSyncState` silently ignores unknown IDs, which is acceptable in the prototype but insufficient for server evidence.

Block B implementation must not merely add `Promise` and then expose these exact methods remotely. It must preserve current use cases while making every server repository method tenant-explicit or request-scope-bound.

## 5. Application, Business Caller and Composition Inventory

### 5.1 Application-layer impact

| Component | Current behavior | Async impact |
|---|---|---|
| `SessionService.signIn` | immediate gateway forwarding | becomes async; real token/session failures cross this boundary |
| `NfcScanApplicationService.submitScan` | scan → resolve → validate → create synchronously | awaits the entire chain; UI receives `Promise<ScanPipelineOutcome>` |
| `WorkEventCreationService.handleValidatedAssignment` | multiple repository reads/writes plus queue | becomes async with strict ordering; local atomicity must be decided separately |
| `SynchronizationService.synchronizePending` | synchronous loop over fake gateway | becomes async; use sequential or explicitly bounded concurrency, never unawaited `forEach` |
| `OrganizationManagementService.createOrganization` | construct + save + event | becomes async because save is remote/server-backed |
| `MembershipService.grantMembership` | construct + save + event | becomes async; bootstrap/authorization remains a separate decision |
| `OrganizationAdministrationService` | authorization plus repository reads/writes | all three commands become async; pure validator stays sync |
| `ScanResultPresenter` | pure rendering/classification | remains synchronous |

### 5.2 Business-layer callers affected by async repositories

| Component | Reason | Target state |
|---|---|---|
| `AssignmentResolver` | reads NfcTag and active assignment | async orchestration/business-area component; decision order unchanged |
| `AssignmentValidator` | reads target Customer | async because of repository read; validation rules unchanged |
| `MembershipAuthorizationValidator` | no repository, pure inputs | remains synchronous |
| `BusinessEngine` | explicit state only | remains synchronous and repository-free |
| `WorkEventFactory` | pure construction | remains synchronous |
| classifiers/presenters | pure mapping | remain synchronous |

### 5.3 Composition roots and runtime boundaries

| Root / boundary | Current state | Required change after async contracts |
|---|---|---|
| `buildScanDemoPipeline` | Core demo root; in-memory/file substitution for three ports | returned `scan`/`synchronizePending` become async or demo root is isolated from product runtime in Block C |
| `runScanCli.ts` | Node-only file composition, calls synchronously | top-level `await`, explicit exit/error handling |
| `AppNavigator` | only stores `CallerContext` | future real composition root injects session/backend/local adapters |
| `LoginScreen` | constructs `SessionService(FakeAuthenticationGateway)` inside UI | construction moves out; handler awaits sign-in and handles loading/retry |
| `ScanScreen` | constructs demo pipeline and a separate native NFC adapter | future injected runtime awaits scan/sync; demo pipeline removed from product path in Block C |
| test composition | tests construct services/adapters directly | all effectful assertions/calls await; rejection tests cover promise failures and no partial writes |

### 5.4 Existing synchronization boundaries

```text
WorkEventCreationService
  -> WorkEventRepository.save (local evidence)
  -> TimeEntryRepository.save/update (local derived state)
  -> OfflineQueue.enqueue (pending record with full decision)

SynchronizationService
  -> OfflineQueue.findPending
  -> SynchronizationGateway.synchronize (fake only)
  -> OfflineQueue.updateSyncState
  -> observable success/failure event
```

Current strengths to preserve:

- queue identity is already `WorkEventId` and duplicate enqueue is explicit;
- retryable failure retains the record;
- conflict is distinct from retryable failure;
- WorkEvent plus BusinessEngineDecision are kept together;
- synchronization does not interpret business meaning.

Current limitations:

- no network protocol or server receipt;
- no retry schedule/backoff;
- no server idempotency or canonical decision;
- no batch/partial-response model;
- local WorkEvent, TimeEntry and queue writes are not atomic;
- file persistence is single-writer and not crash-safe;
- queue state is device-local and not itself server audit evidence.

## 6. Async Migration Impact Map

### 6.1 Target signatures

Every effectful operation receives a single Promise-based contract. Representative target forms:

```ts
interface CustomerRepository {
  findById(organizationId: OrganizationId, customerId: CustomerId): Promise<Customer | null>;
  save(customer: Customer): Promise<void>;
}

interface NfcScanPort {
  scan(): Promise<NfcScanCaptureResult>;
}

interface SynchronizationGateway {
  synchronize(record: QueuedWorkEventRecord): Promise<SynchronizationResult>;
}

interface WorkEventCreationPort {
  handleValidatedAssignment(result: AcceptedAssignmentValidationResult): Promise<void>;
}
```

Exact signatures remain an implementation-plan responsibility, but these rules are fixed:

- no `T | Promise<T>` compatibility unions;
- no hidden fire-and-forget writes;
- no Promise in pure Domain/Business methods;
- no provider-specific error/result in Core ports;
- expected product outcomes stay typed unions;
- callers await writes before emitting success.

### 6.2 Per-boundary impact

| Boundary | Signature change | Propagation | Main regression risk |
|---|---|---|---|
| Auth | gateway and `SessionService.signIn` return Promise | Login UI, navigation tests | stale/loading UI, token error conflated with invalid credentials |
| NFC | `scan` returns Promise | scan service, fake/CLI/native adapters, mobile tests | double capture, cancellation/timeouts; belongs partly to Block D |
| Resolution | tag/assignment reads return Promise | `AssignmentResolver.resolve`, scan service | altered unknown/inactive ordering |
| Validation | customer read returns Promise | `AssignmentValidator.validate`, scan service/admin assignment | cross-tenant lookup before caller check |
| Lifecycle | WorkEvent/TimeEntry/Queue return Promise | `WorkEventCreationService`, integration tests | partial local state and reordered audit/event emission |
| Organization admin | all repository writes/reads return Promise | three management services and tests | authorization checked after an awaited write or unscoped lookup |
| Sync | queue/gateway operations return Promise | sync service, CLI/mobile handlers | unawaited loop, duplicate requests, incorrect partial batch state |
| Composition | exposed use cases return Promise | CLI, Mobile and all composition tests | UI assumes success before persistence finishes |

### 6.3 Migration order

The safest order is compiler-enforced vertical slices, not a repository-wide `async` keyword sweep:

1. **Contract conventions and test helpers** — agree Promise/error/cancellation conventions; prohibit `MaybePromise`.
2. **Local queue + synchronization slice** — migrate `OfflineQueue`, `SynchronizationGateway`, `SynchronizationService`; proves network-shaped behavior without changing Business Rules.
3. **Authentication slice** — migrate `AuthenticationGateway` and `SessionService`; keep fake adapter parity.
4. **Organization administration slice** — migrate Organization/Membership/Customer/NfcTag/NfcAssignment repositories and their services/validators.
5. **Scan resolution/validation slice** — migrate `AssignmentResolver`, `AssignmentValidator` and `NfcScanApplicationService` dependencies.
6. **Lifecycle persistence slice** — migrate WorkEvent/TimeEntry repositories and `WorkEventCreationService`; explicitly test write ordering and failure points.
7. **NFC contract cleanup** — make `NfcScanPort` honestly async and remove the buffer bridge when Block D wires the real adapter.
8. **Composition roots** — update demo CLI and later real Mobile/Backend roots.
9. **Remove transitional shims** — no sync overloads or ignored Promises remain; `rg`/lint/test enforcement added.

Each slice must keep InMemory adapters, file adapters where still relevant, and tests behaviorally equivalent. Real backend dependencies are added only after the port migration slice they require is green.

### 6.4 Test impact

At minimum, migration tests must prove:

- every effectful call is awaited;
- original decision ordering and typed outcomes are unchanged;
- repository rejection does not emit a false success event;
- retryable sync failure preserves pending state;
- one failed record does not silently mark later records synchronized;
- cross-tenant authorization happens before data disclosure;
- in-memory test adapters conform to the same Promise contract as remote adapters;
- fake authentication and sync adapters remain deterministic;
- Mobile loading/cancellation prevents duplicate submissions.

## 7. Target Responsibility Model

### 7.1 Core

Core owns:

- Domain identifiers/entities/events;
- Business Engine and all product decisions;
- pure validators/classifiers/presenters;
- use-case orchestration and provider-neutral ports;
- mapping-independent synchronization outcomes.

Core does not own:

- HTTP routes, JWT parsing or provider SDKs;
- SQL/RLS policies;
- React state/navigation;
- NFC SDK lifecycle;
- secrets, deployment configuration or logging transport.

### 7.2 Mobile App

Mobile owns:

- native NFC capture and capability state;
- encrypted/secure provider token storage;
- production-grade local database and offline queue;
- immediate local Core evaluation for offline feedback;
- connectivity observation, sync scheduling and retry UX;
- rendering only.

Mobile may cache Organization configuration needed for scans. Cache possession never grants server access. The app must expect the server to reject a revoked Membership or stale configuration.

### 7.3 Backend

Backend owns:

- token verification and identity binding;
- Membership/tenant resolution and role enforcement;
- API input limits, request correlation and rate limiting;
- Core use-case invocation;
- server repository adapters and transaction/concurrency control;
- idempotent WorkEvent ingestion;
- canonical decision, TimeEntry and audit persistence;
- tenant-safe queries for Mobile/Admin Web;
- operational logs/metrics without leaking cross-tenant data.

Controllers translate transport DTOs only. Adapters map Domain values to rows only. Neither may select a BusinessEngineDecision.

### 7.4 Future Admin Web

Admin Web owns:

- authenticated administrative UI;
- role-aware visibility and form validation for usability;
- calling backend commands/queries;
- rendering server outcomes.

Admin Web never:

- receives service-role credentials;
- queries unrestricted tables;
- treats hidden buttons as authorization;
- implements a separate permission matrix.

## 8. Server-Enforced Tenant Isolation

### 8.1 Selected model

Proposed v1 model: pooled PostgreSQL database, shared schema, row-level tenant key.

Why this fits v1:

- current entities already carry `OrganizationId`;
- one schema/migration path is proportionate to a small team;
- RLS and composite constraints provide hard logical isolation;
- per-Organization databases would add provisioning, migrations, backups and connection routing before contractual silo isolation is required.

Database-per-Organization remains a review trigger for regulated/enterprise requirements, not a default.

### 8.2 Request authorization algorithm

For every authenticated request:

1. Verify signature, issuer, audience, expiry and token type.
2. Resolve `(issuer, subject)` to stable TapTim.e `UserId`.
3. Read the current Membership and, for delayed WorkEvent ingestion only, its grant/revocation history for the requested Organization.
4. Reject absent/revoked Membership for ordinary API access before tenant-owned lookup.
5. Route alleged pre-revocation offline evidence through the dedicated restricted sync path; do not grant ordinary tenant access and do not silently discard the evidence.
6. Apply the not-yet-approved grace/review/rejection policy plus clock and historical-validity checks.
7. Check the required minimal role/capability.
8. Create a request actor context `{ userId, organizationId, role }`.
9. Pass that context to tenant-scoped Core/application ports.
10. Execute persistence with RLS/user context and tenant-qualified queries.
11. Record correlation, Organization, actor and outcome in audit/operational telemetry.

The server never trusts `userId`, role or Organization ownership from the body. A requested Organization ID is validated, then replaced with the server-resolved context for writes.

### 8.3 Database enforcement

Required database controls:

- RLS enabled and forced for every exposed tenant table;
- default deny for anonymous and authenticated roles until a policy exists;
- `USING` and `WITH CHECK` policies for reads/writes;
- membership lookup indexed by auth subject/User and Organization;
- composite foreign keys `(organization_id, referenced_id)`;
- partial unique indexes for one active assignment per tag and one active TimeEntry per user;
- immutable WorkEvent/decision/audit tables for normal roles;
- server-only lifecycle write function/transaction path;
- migrations and RLS policies version-controlled;
- automated positive and negative policy tests in CI before deployment;
- indexes on RLS predicate columns and query-plan/performance tests at representative tenant sizes;
- RLS helpers use `(select auth.uid())` or an equivalently measured safe pattern where appropriate;
- `SECURITY DEFINER` is exceptional: fixed trusted `search_path` with `pg_temp` last, fully schema-qualified objects, `PUBLIC` execute revoked and least-privilege grants applied in the same migration transaction;
- request/JWT context is transaction-local and proven not to leak through reused connections.

Supabase's service role bypasses RLS. Therefore:

- it is prohibited in Mobile/Admin Web;
- normal backend requests should preserve user JWT/RLS context or use a restricted database role with explicit request context;
- any bypass path is isolated to bootstrap/background operations, repeats authorization in server code and writes audit evidence;
- generic repositories may not be initialized with an unrestricted service role.

### 8.4 Mandatory negative isolation tests

For two Organizations A and B, tests must prove an A Employee and A Administrator cannot:

- read B rows by list, exact ID or guessed ID;
- insert a row with `organization_id = B`;
- update/delete B rows;
- reference a B Customer/NfcTag/NfcAssignment from an A row;
- submit a WorkEvent claiming B or another User;
- read B audit/sync receipts;
- elevate role by body/token metadata not backed by Membership;
- use stale membership after revocation;
- exploit a backend service-role endpoint.

The broader server test matrix must additionally prove:

- two devices for the same User synchronize concurrent scans in deterministic serialized order;
- same-user/same-target and same-user/different-target concurrent scans cannot create two active TimeEntries;
- different Users remain independent when devices synchronize concurrently;
- token expiry before a batch and token expiry/failed refresh during a batch do not mark unsent records synchronized;
- already committed records remain idempotently acknowledged when a refreshed batch resumes;
- pooled connections never expose Organization/JWT context from the previous request;
- delayed WorkEvents are checked against historical Membership, NfcAssignment, NfcTag and target validity.

Tests must cover both API behavior and direct RLS policy behavior.

## 9. Minimal Authentication and Authorization Model

### 9.1 Identity is not Membership

Authentication answers who proved control of a credential. Membership answers which Organization and role that stable TapTim.e User currently has.

Proposed mapping:

```text
Provider token (issuer + subject)
  -> identity_binding
  -> TapTim.e UserId
  -> active Membership
  -> OrganizationId + administrator|employee
```

Do not use provider Organizations, Cognito groups or Firebase custom claims as the primary TapTim.e Membership store. Token claims may be a cache/hint only; server Membership data is authoritative so role revocation does not wait on long-lived claim design.

Supabase Auth's current official behavior automatically links identities with the same verified email address to one user and removes conflicting unconfirmed identities when linking. It also supports authenticated manual linking. TapTim.e shall not implement its own email-equality linking algorithm and shall not assume an unverified email proves identity ownership.

V1 recommendation, pending Human Architect approval:

- enable one controlled sign-in method only;
- do not expose multiple OAuth/password/SSO methods until each provider/linking interaction is reviewed;
- if additional linking is approved, use only Supabase's documented verified automatic behavior or an explicit authenticated linking ceremony;
- audit link/unlink operations and preserve the stable TapTim.e `UserId` mapping;
- never merge two TapTim.e Users based only on matching request/profile email strings.

### 9.2 Permission matrix

| Resource/capability | Employee | Administrator | Enforcement point |
|---|---:|---:|---|
| Own Membership/minimum Organization info | Read | Read | API + RLS |
| Customer/NFC config needed to resolve scans | Read active subset/cache | Read all own tenant | API + RLS |
| Customer/NfcTag/NfcAssignment management | No | Create/update within tenant | Core validator + API + RLS/constraints |
| Own WorkEvent ingestion | Create via sync endpoint | Create own via sync endpoint | API derives actor + transaction |
| WorkEvent mutation/deletion | No | No | immutable table policy |
| Own TimeEntries | Read | Read own/all tenant | API + RLS |
| Direct TimeEntry lifecycle writes | No | No | server lifecycle transaction only |
| Membership management | No | own tenant, bootstrap excluded | API + RLS + audit |
| Audit evidence | No except own sync status | Read own tenant | API + RLS |
| Cross-tenant access | No | No | all layers |

No generic permission engine is justified for two roles. Explicit endpoint capabilities and tested policies are simpler and match FB-002.

### 9.3 Revocation and bootstrap gaps

Two product decisions remain necessary:

- first Organization/Administrator bootstrap has no existing Administrator to authorize it;
- current Membership domain has no revoked/inactive lifecycle.

Proposed technical accommodation is `revoked_at` server authorization metadata and one audited privileged bootstrap command. Neither should be implemented until the Human Architect approves the product behavior.

Employee invitation exposes a second provisioning gap: `Membership.userId` requires a stable TapTim.e `UserId`, but an invited employee may not yet have authenticated. The Human Architect must select one flow:

1. **Identity-first pilot provisioning:** an operator creates the provider identity/TapTim.e User first, then Membership.
2. **Pending invitation:** create a non-authorizing invitation/pending-user record, then create/activate `identity_binding`, User and Membership only after verified registration/acceptance.
3. **Reserved TapTim.e User:** create User/Membership in a non-active state and bind an identity after verified acceptance.

The exact creation point of User, `identity_binding` and active Membership is open. Pending records never grant tenant access and email possession alone never activates or links an account.

## 10. Server Data Model v1

This is a logical persistence model. It deliberately contains server metadata not present in Domain objects and must be mapped by adapters. It does not redefine Domain types.

### 10.1 Global conventions

- Primary IDs: UUID, compatible with current `crypto.randomUUID()` generation.
- Time: UTC `timestamptz`.
- Tenant tables: non-null `organization_id` plus `unique (organization_id, id)` for composite references.
- Server metadata: `created_at`, optional `updated_at`, and `row_version` where mutable/concurrent.
- Client event time and server receipt time are separate.
- No independently stored TimeEntry duration.
- JSON is reserved for immutable audit payloads/forward-compatible diagnostics, not core relational ownership.

### 10.2 Tables and constraints

#### `users` — minimal stable TapTim.e user registry

| Column | Purpose |
|---|---|
| `id uuid primary key` | stable provider-neutral TapTim.e `UserId` |
| `created_at timestamptz not null` | server evidence |
| `provisioning_state text` | only if the approved invitation flow requires pending/active distinction |

This is an identity anchor, not a new Employee profile Domain model. Whether it is created before invitation, at verified registration or during operator provisioning is a Human Architect decision.

#### `identity_bindings` — infrastructure identity mapping

| Column | Purpose |
|---|---|
| `id uuid primary key` | binding identity/audit key |
| `user_id uuid not null` | FK to stable TapTim.e User |
| `issuer text not null` | trusted token issuer |
| `subject text not null` | provider subject (`sub`) |
| `created_at timestamptz not null` | server evidence |
| `revoked_at timestamptz null` | binding no longer accepted without deleting audit evidence prematurely |

Constraints: unique `(issuer, subject)`. Multiple bindings per User are possible only if the approved login/linking policy permits them. No Organization, email-as-authority or role lives here.

#### `organizations`

| Column | Domain/server mapping |
|---|---|
| `id uuid primary key` | `Organization.id` |
| `name text not null` | `Organization.name` |
| `created_at timestamptz not null` | server metadata |
| `row_version bigint not null` | optimistic concurrency for mutable name/settings |

No Organization status is added until FB-002's open status question is decided.

#### `memberships`

| Column | Domain/server mapping |
|---|---|
| `id uuid primary key` | `Membership.id` |
| `organization_id uuid not null` | owning Organization |
| `user_id uuid not null` | stable TapTim.e User |
| `role text not null` | check `administrator` or `employee` |
| `created_at timestamptz not null` | server metadata |
| `revoked_at timestamptz null` | proposed authorization metadata, approval required |
| `created_by_user_id uuid null` | audit/bootstrap actor |

Constraints: FK Organization/User; unique `(organization_id, user_id)`. To preserve the current one-Membership-per-user assumption, add a partial unique active index on `user_id where revoked_at is null`. Remove only after a multi-Organization decision and Core port change.

#### `customers`

| Column | Mapping |
|---|---|
| `id uuid primary key` | `Customer.id` |
| `organization_id uuid not null` | tenant owner |
| `active boolean not null` | `Customer.active` |
| `activated_at timestamptz not null` | server-recorded beginning of Customer validity |
| `deactivated_at timestamptz null` | server-recorded end of Customer validity; null while active |
| `created_at`, `updated_at`, `row_version` | server metadata |

Constraints: unique `(organization_id, id)`; `active = true` requires `deactivated_at is null`; inactive state requires `deactivated_at >= activated_at`. Reactivation semantics are not invented by this persistence model and require an explicit product decision. These timestamps allow delayed WorkEvents to be checked against historical target validity without treating the current `active` value as historical truth. No customer name is invented because the current Domain does not define one.

#### `nfc_tags`

| Column | Mapping |
|---|---|
| `id uuid primary key` | `NfcTag.id` |
| `organization_id uuid not null` | tenant owner |
| `payload_value text not null` | normalized `NfcPayload`; final representation awaits Block D |
| `created_at timestamptz not null` | server metadata |

Constraints: unique `(organization_id, id)` and proposed unique `(organization_id, payload_value)`. Cross-Organization payload collisions are isolated and do not disclose another tenant's tag.

#### `nfc_assignments`

| Column | Mapping |
|---|---|
| `id uuid primary key` | `NfcAssignment.id` |
| `organization_id uuid not null` | tenant owner |
| `nfc_tag_id uuid not null` | Organization-scoped tag FK |
| `target_type text not null` | v1 check `customer` |
| `target_customer_id uuid not null` | Organization-scoped Customer FK |
| `active boolean not null` | current active mapping |
| `valid_from timestamptz not null` | server-recorded assignment start for delayed-event validation |
| `valid_to timestamptz null` | server-recorded assignment end; null only while active |
| `created_at`, `updated_at`, `row_version` | server metadata |

Constraints: composite FKs to NfcTag and Customer; partial unique `(organization_id, nfc_tag_id) where active`; `active = true` requires `valid_to is null`, inactive history requires `valid_to >= valid_from`. Existing assignment rows are not repurposed for a different target. The product workflow for reassignment remains an FB-002 Human Architect decision, but server history sufficient to evaluate a delayed WorkEvent must not be destroyed.

#### `work_events` — immutable audit evidence

| Column | Mapping |
|---|---|
| `id uuid primary key` | client-created `WorkEvent.id`, idempotency identity |
| `organization_id uuid not null` | server-derived tenant |
| `assignment_id uuid not null` | Organization-scoped assignment FK |
| `nfc_tag_id uuid not null` | Organization-scoped tag FK |
| `target_type`, `target_customer_id` | immutable target snapshot/reference |
| `triggered_by_user_id uuid not null` | server-derived actor |
| `occurred_at timestamptz not null` | device event time |
| `received_at timestamptz not null` | server receipt time |
| `content_hash text not null` | hash of the versioned canonical WorkEvent representation |
| `content_hash_algorithm text not null` | fixed named algorithm, recommended `sha256` for v1 |
| `content_hash_version smallint not null` | canonicalization version, beginning at `1` |

Normal roles cannot update/delete. The server verifies assignment/tag/target all share the tenant. Indexes support latest `(organization_id, triggered_by_user_id, target, occurred_at desc)`.

Canonical v1 hash input must be specified before implementation as UTF-8 bytes of a deterministic representation containing exactly these domain fields in fixed order: `id`, `organizationId`, `assignmentId`, `nfcTagId`, `target.targetType`, `target.targetId`, `triggeredBy`, `occurredAt`. Strings use their exact normalized Domain values; timestamps use one UTC ISO-8601 representation with millisecond precision; no server metadata (`received_at`), JSON object order, whitespace or optional transport field participates. The server recomputes the hash after authoritative tenant/User derivation and never trusts a client-supplied hash. The stored version and algorithm make future migrations explicit. A shared test-vector document must prove equivalent Mobile/Backend hashes.

#### `work_event_decisions` — canonical server decision

| Column | Purpose |
|---|---|
| `work_event_id uuid primary key` | one canonical decision per WorkEvent |
| `organization_id uuid not null` | tenant key/composite FK |
| `decision_type text not null` | five current `BusinessEngineDecision` statuses |
| `reason text null` | precise escalation/rejection detail where applicable |
| `time_entry_id uuid null` | resulting/affected TimeEntry |
| `previous_work_event_id uuid null` | duplicate traceability |
| `engine_version text not null` | diagnostic replay version |
| `decided_at timestamptz not null` | server processing time |
| `decision_payload jsonb not null` | immutable serialized evidence for forward-compatible audit, not query authority |

The decision is produced by Core BusinessEngine, not SQL. Database checks restrict valid status/required-null combinations.

#### `time_entries`

| Column | Mapping |
|---|---|
| `id uuid primary key` | `TimeEntry.id` |
| `organization_id uuid not null` | tenant owner |
| `user_id uuid not null` | owning user |
| `target_type`, `target_customer_id` | AssignmentTarget |
| `status text not null` | `started` or `stopped` |
| `start_work_event_id uuid not null` | starting WorkEvent |
| `started_at timestamptz not null` | start event time |
| `stop_work_event_id uuid null` | stopping WorkEvent |
| `stopped_at timestamptz null` | stop event time |
| `row_version bigint not null` | optimistic concurrency |

Constraints:

- composite tenant FKs to start/stop WorkEvents and target;
- stopped fields both null for `started`, both non-null for `stopped`;
- `stopped_at >= started_at`;
- partial unique `(organization_id, user_id) where status = 'started'`;
- no duration column;
- normal client roles cannot insert/update directly.

#### `sync_receipts`

| Column | Purpose |
|---|---|
| `work_event_id uuid primary key` | idempotent sync identity |
| `organization_id`, `user_id` | tenant/actor scope |
| `first_received_at`, `last_attempt_at` | server timing |
| `attempt_count integer` | retry diagnostics |
| `status text` | `received`, `synchronized`, `retryable_failure` or `conflict` |
| `client_decision_hash text null` | compare client evidence without making it authoritative |
| `server_decision_work_event_id uuid null` | canonical decision reference |
| `conflict_code text null` | machine-readable result |
| `client_time_entry_id uuid null` | local TimeEntry identity reported as sync evidence |
| `server_time_entry_id uuid null` | canonical server TimeEntry identity from decision persistence |

An identical retry returns the stored result. Same ID/different payload is conflict. Retry transport attempts need not create duplicate WorkEvents.

Local/server TimeEntry reconciliation is explicit and stable:

```text
local TimeEntry.workEventId
  -> WorkEventId
  -> sync_receipts.work_event_id
  -> work_event_decisions.time_entry_id
  -> server TimeEntry.id
```

The receipt may carry both local and server IDs, but `WorkEventId` and the canonical decision are the authoritative association. The server never assumes independently generated TimeEntry IDs match and the client never silently rewrites historical local IDs without an explicit mapping update.

#### `audit_events` — append-only administrative/security audit

| Column | Purpose |
|---|---|
| `id uuid primary key` | audit identity |
| `organization_id uuid not null` | tenant owner |
| `actor_user_id uuid null` | null only for named system/bootstrap operation |
| `event_type text not null` | e.g. OrganizationCreated, MembershipGranted, NfcTagAssigned |
| `entity_type`, `entity_id` | affected record |
| `occurred_at timestamptz not null` | business/audit time |
| `recorded_at timestamptz not null` | server time |
| `correlation_id text not null` | request/sync trace |
| `payload jsonb not null` | immutable before/after/event evidence appropriate to event type |

No normal update/delete. Audit payload must exclude credentials, access tokens and unnecessary NFC/user personal data.

### 10.3 Privacy, retention, erasure and backup lifecycle

Append-only is an application-integrity control during an approved retention period, not a promise of permanent personal-data retention. Before production, a legal review for the operating jurisdiction and employment/time-record context must approve a numeric retention schedule and its legal bases. Production remains blocked while the Work/Time record period is unset.

Proposed retention classes:

| Data class | Proposed basis/purpose | Proposed period/action | Approval state |
|---|---|---|---|
| WorkEvents, canonical decisions, TimeEntries | contract/employment time-record performance plus applicable statutory record/evidence duties | numeric jurisdiction-specific period `RET_WORK_RECORD` starts at the legally defined trigger; then physical deletion or genuine anonymization unless continued retention is legally required | Legal + Human Architect decision required |
| Administrative audit events | security, accountability and defense of authorized Organization administration | proposed `RET_AUDIT = 12 months` after event, extended only for an open incident/legal hold; then delete or genuinely anonymize | Legal/Human Architect confirmation required |
| Sync receipts and transport diagnostics | idempotency, retry/conflict support and incident diagnosis | proposed `RET_SYNC = 90 days` after terminal sync state; unresolved conflict/review follows the related WorkEvent hold; then delete non-required transport detail | Technical Lead plus legal confirmation |
| Identity bindings and Membership authorization metadata | account access, tenant authorization and revocation evidence | active account period; after account/contract end use approved deletion/restriction schedule, retaining only legally required evidence | Invitation/revocation + legal decision required |
| Pending invitations | onboarding only | proposed expiry after 30 days unless renewed; expired invitation grants no access and is deleted after minimal anti-abuse/audit period | Human Architect decision required |
| Database backups/PITR | disaster recovery | proposed rolling `RET_BACKUP <= 35 days`, never longer without approved need; expired copies are removed by provider/customer process | Region/plan/legal confirmation required |

The numeric proposals are architecture recommendations, not claims about statutory German/EU retention law. Legal counsel must identify the actual legal bases, mandatory periods, limitation periods, employee-rights constraints and any Article 17 exceptions before approval.

Expiry handling:

1. **Physical deletion:** remove the personal record and dependent personal references where no legal basis remains, while preserving non-personal aggregate metrics only if they cannot identify a person.
2. **Genuine anonymization:** irreversibly remove direct and indirect identifiability, including user links, precise combinations/timestamps and free-form payloads where linkage/inference remains reasonably possible. Effectiveness requires documented testing and legal review.
3. **Pseudonymization:** replace/separate identifiers under technical controls. This reduces risk but remains personal data under GDPR and does not automatically satisfy a deletion request.
4. **Restricted retention:** where law requires continued storage, record the legal basis/expiry, block ordinary processing, minimize access and retain a legal-hold/restriction audit.

Backups and restore copies:

- encrypt backups in transit and at rest; verify provider evidence and customer-managed export encryption;
- keep backup/restore region consistent with the approved residency policy;
- maintain an encrypted deletion/restriction ledger outside the restored recovery point;
- restore only into an isolated environment, then replay deletions, anonymizations, revocations and restrictions completed after the backup before serving traffic;
- perform and evidence a restore test at least quarterly initially, including deletion-ledger replay, RLS policies, custom roles/secrets and audit integrity;
- include manually exported/off-site copies in inventory, retention and destruction evidence.

### 10.4 Clock, offline delay and historical validity

`occurred_at` is untrusted device evidence; `received_at` is trusted server receipt evidence. They serve different purposes and are never collapsed into one timestamp.

Detection is multi-signal, not a simple absolute difference rule:

| Signal | Example | Required response |
|---|---|---|
| Clock skew | event time implausibly ahead/behind recent server calibration | flag/score anomaly; tolerance pending decision |
| Backwards time | event precedes the active entry or previous accepted event | existing BusinessEngine escalation; no TimeEntry mutation |
| Unusual duration | derived interval negative or outside approved operational bounds | escalation/review, never silent clamping |
| Long offline delay | large `received_at - occurred_at` with coherent local sequence | may be legitimate; evaluate separately, do not reject solely by age |
| Multi-device ordering | two devices submit overlapping event streams | serialize per User, preserve both evidence records, escalate ambiguous order |
| Historical validity | event alleges time before grant/after revoke or outside Assignment validity | require historical Membership/Assignment evidence and clock-confidence checks |

The Human Architect must approve concrete tolerances, normal maximum offline delay and review outcomes. Until then, suspicious cases are quarantined/deferred with immutable evidence and no canonical TimeEntry change.

### 10.5 Membership revocation with delayed sync

Events captured before `revoked_at` must not disappear silently. The ingestion endpoint may authenticate the account yet deny normal tenant access, and route only the claimed pre-revocation WorkEvent evidence to a restricted decision path.

Product options:

- **Grace window:** accept review-eligible sync until server `received_at <= revoked_at + GRACE`, after checking local sequence, clock confidence and historical Membership/Assignment validity.
- **Administrative follow-up:** store evidence/receipt as deferred without TimeEntry mutation; notify an authorized Administrator for correction/approval handling.
- **Categorical rejection:** return an explicit permanent conflict/rejection and retain local evidence. This is not a safe implicit default because legitimate working time could be lost.

`occurred_at < revoked_at` is necessary but not sufficient evidence because device time can be manipulated. A combined grace-then-review recommendation is preferred, but exact behavior and durations remain Human Architect decisions.

### 10.6 Transaction boundaries

Server WorkEvent ingestion must atomically:

1. establish idempotency by WorkEvent ID within the transaction;
2. validate tenant-owned and historically valid references;
3. serialize the decision stream for `(organization_id, user_id)` using row locks or `pg_advisory_xact_lock` within this same transaction;
4. load active TimeEntry and previous matching WorkEvent;
5. invoke the synchronous Core BusinessEngine;
6. insert immutable WorkEvent and canonical decision;
7. insert/update TimeEntry for Start/Stop only;
8. write sync receipt and audit evidence;
9. commit, or return retry/conflict without partial server state.

Business rules remain in Core. SQL constraints/locking detect invalid or concurrent persistence; they do not choose Start/Stop/Duplicate.

Session-level advisory locks are prohibited. Transaction-level advisory locks release with commit/rollback and must be acquired after the transaction begins. Any JWT/tenant session variable uses transaction-local scope. Tests must prove rollback releases locks/context and a reused pooled connection cannot observe the prior request's actor or Organization.

The local mobile WorkEvent/TimeEntry/Queue atomicity question is separate. A production local database should eventually provide a transaction or unit-of-work adapter; this package does not invent that port.

## 11. Managed Backend and Auth Evaluation

Ratings are relative to current TapTim.e needs, not universal provider rankings.

| Option | Tenant integrity | Offline fit | Core/server fit | Operational load | Lock-in | Overall v1 fit |
|---|---|---|---|---|---|---|
| Supabase PostgreSQL/Auth + thin API | Strong: RLS, FKs, transactions | Good with existing explicit queue; no automatic replacement | Strong; TypeScript compute, relational adapters | Low–medium | Medium, PostgreSQL portable | **Recommended** |
| Firebase Auth/Firestore/Functions | Medium–strong if rules exhaustive; weaker relational constraints | Strong SDK cache, but overlaps explicit sync | Medium; document mappings and server-rule bypass need care | Low–medium | Medium–high | Viable fallback |
| AWS Cognito/API/Lambda/data services | Strong but many policy surfaces | Requires explicit design | Strong but high integration complexity | High for current team | Medium–high | Overweight for v1 |
| Auth0 + managed PostgreSQL + custom API | Strong with well-built API/RLS | Requires explicit design | Strong separation; extra vendor/runtime | Medium–high | Medium | Revisit for enterprise SSO |

### 11.1 Supabase findings

- PostgreSQL RLS attaches policies to tables and can authorize row-by-row using Auth identity.
- Supabase Auth uses JWTs and integrates with RLS.
- Supabase Auth currently automatically links identities with the same verified email to one user and documents safeguards for unverified identities; provider enablement therefore changes account-linking behavior and requires explicit approval.
- Expo React Native is an officially documented client environment.
- Database migrations, local stack and pgTAP policy tests are supported.
- Edge Functions are server-side TypeScript on Deno and can validate JWTs/call Postgres.
- Service-role access bypasses RLS; this is a high-risk privilege, not a normal adapter credential.
- Supavisor session mode is intended for persistent backends, while transaction mode is intended for temporary serverless/edge clients and does not support prepared statements.

Fit conclusion: best match for Organization-owned relational data and enforceable invariants while keeping explicit offline sync.

### 11.2 Firebase findings

- Firestore offers offline persistence and later client synchronization.
- Security Rules can use Firebase Auth, but rules are not filters; queries must match authorization constraints.
- Server client libraries bypass Firestore Security Rules and rely on IAM/application enforcement.
- Custom claims support access-control metadata but are limited and are not intended for general Membership data.
- Emulator-based Security Rules tests are available.

Fit conclusion: credible and familiar, but relational tenant references, uniqueness and canonical transactional TimeEntry updates would require more application/rule discipline. Built-in sync does not eliminate TapTim.e's WorkEvent protocol.

### 11.3 AWS findings

- Cognito is a managed OIDC identity provider with groups and administrator-created users.
- API Gateway/Lambda and managed data services can provide explicit APIs.
- Cognito groups and Verified Permissions can model roles/multi-tenancy.

Fit conclusion: powerful, but a policy service/group model is unnecessary duplication for two roles and increases deployment/IAM burden.

### 11.4 Auth0 findings

- Access tokens are intended for APIs and require issuer/audience/signature/scope validation.
- Auth0 Organizations support B2B membership/organization roles, including users shared across organizations.
- Organization feature availability depends on plan and Management API constraints.

Fit conclusion: strong future option for enterprise federation. Today it risks duplicating the already-defined TapTim.e Organization/Membership model.

### 11.5 Compute runtime and transaction recommendation

Preferred primary runtime: managed persistent Node.js, using direct PostgreSQL connectivity when the deployment network supports it, otherwise Supavisor session mode. It must use an application pool sized against database limits and expose pool/transaction metrics.

Edge Functions remain suitable for narrow stateless endpoints, webhooks or orchestration that does not require the lifecycle transaction. Using Edge Functions for lifecycle ingestion requires the B1 spike to prove:

1. real Core import/bundle behavior under Deno;
2. WorkEvent + decision + TimeEntry + receipt + audit in one transaction;
3. injected rollback at every step;
4. `pg_advisory_xact_lock` or row locks inside that transaction;
5. JWT/RLS and transaction-local tenant context;
6. no context leakage across warm/reused pooled connections;
7. connection reuse/cold-start behavior under concurrency;
8. Supavisor session and transaction mode behavior;
9. disabled prepared statements in transaction mode and driver compatibility;
10. pool exhaustion/backpressure behavior.

Failure of any lifecycle-critical criterion selects managed Node without revisiting the Supabase PostgreSQL/Auth recommendation.

## 12. Recommendation and Migration Sequence

### 12.1 Recommended decisions

1. Approve ADR-0008's Supabase PostgreSQL/Auth recommendation.
2. Use pooled shared-schema tenancy with mandatory RLS/composite tenant constraints.
3. Keep TapTim.e Membership as authorization authority; provider Auth supplies identity only.
4. Use backend API commands for mutations and canonical WorkEvent processing; no direct authoritative client table writes.
5. Migrate all effectful Core ports to Promise contracts before real adapters.
6. Keep offline local Core evaluation and queue; re-run the same Business Engine server-side for canonical persistence.
7. Require idempotency, transactions, engine version and append-only audit in the first server schema.
8. Use managed Node as primary lifecycle compute; require the complete B1 proof before allowing Edge lifecycle compute.
9. Block production until privacy retention/erasure, clock anomaly, revocation-sync and identity-provisioning decisions are approved.

### 12.2 Implementation sequence after approval

| Phase | Scope | Exit evidence |
|---|---|---|
| B0 | Human decisions + independent security review | approved ADR/open-decision disposition |
| B1 | Node/Edge compute, pooling and transaction spike; no product integration | Core import; genuine five-table transaction/rollback; `pg_advisory_xact_lock`/row-lock proof; JWT/RLS transaction-local context; no cross-connection context leak; connection reuse; Supavisor session/transaction modes; prepared-statements-off proof in transaction mode |
| B2 | Async contract migration by vertical slices | typecheck/tests unchanged semantically; no mixed contracts |
| B3 | Versioned schema, constraints and RLS tests | two-tenant negative matrix green locally/CI |
| B4 | Identity binding + Membership resolution server slice | token cannot cross/escalate tenant |
| B5 | Read-only Organization/config repository adapter slice | tenant-safe reads from server |
| B6 | Idempotent WorkEvent ingestion + canonical lifecycle transaction | start/stop/duplicate/retry/conflict integration tests |
| B7 | Mobile sync gateway integration (Block E may own final runtime wiring) | offline queue reaches server without losing evidence |

Do not begin with all repositories or direct Mobile database access. The first real server slice should be narrow enough to prove security and transaction semantics before expanding.

## 13. Risks and Mitigations

| Risk | Severity | Mitigation / gate |
|---|---|---|
| RLS policy omission or service-role bypass leaks tenant data | Critical | default deny, forced RLS, no client service role, API+RLS negative tests, independent review |
| Async migration changes decision ordering or emits false success | High | vertical slices, awaited writes, failure-point tests, no `MaybePromise` |
| Offline local state conflicts with server canonical state | High/Product | idempotent receipts, engine version, explicit conflict result; Human decision on reconciliation |
| WorkEvent/TimeEntry partial server writes | Critical | one transaction, constraints, idempotency lock |
| Dynamic Membership stored only in token claims becomes stale | High | server Membership authority; token claims hints only |
| Provider Organization/role model duplicates TapTim.e domain | High | identity binding separation; no provider groups as source of truth |
| Edge Function runtime cannot reuse/test Core or transactions cleanly | Medium | managed Node is primary; permit Edge lifecycle use only after the expanded time-boxed spike passes |
| Supabase direct client convenience bypasses backend boundaries | High | architecture rule: mutations through API; RLS remains defense in depth |
| File adapter mistaken for production mobile persistence | High | keep prototype label; select mobile-native transactional store separately |
| NFC payload collision/sensitivity decision affects schema | Medium | Organization-scoped provisional uniqueness; Block D decision before production migration |
| One-Membership schema blocks future multi-Organization actors | Medium/Product | explicit Human decision; partial index isolated for later migration |
| Audit payload accumulates secrets/personal data | High | event allowlists, no credentials/tokens, retention/privacy review |
| Append-only evidence conflicts with erasure/storage-limitation duties | Critical/Legal | legally reviewed per-class retention schedule; deletion/genuine anonymization/restricted hold; deletion replay after restore; pseudonymization not treated as erasure |
| Manipulated or drifting device time silently changes payable duration | Critical/Product | separate clock/backwards/duration/offline-delay signals; no absolute-delay-only rule; suspicious evidence deferred without TimeEntry mutation |
| Membership revocation causes legitimate offline work loss or enables forged backdating | Critical/Product | explicit grace/review/reject policy; historical validity and clock-confidence checks; local evidence retained |
| Automatic/custom account linking joins the wrong person to a TapTim.e User | Critical/Security | one v1 login method; provider-documented verified linking only after approval; no custom email equality merge; link audit |
| Invitation creates Membership without a verified/stable User identity | High/Security | approved pending-invitation/provisioning state; no access before verified binding and activation |
| Pooling, locks or request variables leak tenant/JWT context between requests | Critical/Security | managed Node primary; transaction-local context; `pg_advisory_xact_lock`/row locks only; session-lock prohibition; reuse/concurrency leak tests |
| Transaction pooler prepared-statement incompatibility breaks lifecycle writes | High/Availability | test session/transaction modes; disable prepared statements in transaction mode; driver-specific spike evidence |
| Backup/restore resurrects erased, revoked or restricted data | Critical/Privacy | encryption/region/retention controls; isolated restore; deletion/revocation ledger replay; quarterly restore evidence |

## 14. Human Architect Decisions Still Required

| Decision | Recommendation | Why approval is required |
|---|---|---|
| Managed backend/auth platform | Supabase PostgreSQL + Supabase Auth | resolves ADR-0007's deferred provider decision |
| Tenant deployment model | pooled schema + RLS, not database per Organization | security/cost/operational architecture |
| First Organization/Admin bootstrap | one audited privileged server command/manual provisioning | product ownership/security behavior is currently undefined |
| Membership cardinality | retain one active Membership per User for v1 | FB-002 assumption affects schema and login UX |
| Membership revocation | approve explicit revocation/deactivation semantics | required for safe real user administration; absent from Domain |
| Offline conflict outcome | server canonical decision + explicit conflict/deferred reconciliation | affects user-visible time truth and correction workflow |
| Region/residency/backup retention | choose deployment/backup region, encryption evidence, retention and restore-test cadence after privacy/legal input | customer data/legal commitment |
| NFC payload scope/representation | Organization-scoped uniqueness provisionally; finalize in Block D | affects security, collision behavior and migration |
| Privacy/erasure/anonymization | approve legal bases and numeric periods for every data class plus deletion, genuine anonymization, pseudonymization/restriction and restored-copy treatment | append-only evidence does not override GDPR/storage limitation; pseudonymized data remains personal data |
| Pre-revocation offline WorkEvents | prefer defined grace window followed by administrative review; categorical rejection only by explicit decision | legitimate work must not disappear, forged backdating must not be accepted |
| Clock/offline anomaly policy | approve separate skew/backwards/duration/offline-delay tolerances and review outcomes; no absolute-difference-only rule | device time is untrusted and long offline delay may be legitimate |
| Login/linking methods | one controlled v1 sign-in method; add providers/linking only after explicit review | Supabase automatic same-verified-email linking changes identity behavior |
| Unregistered employee invitation/provisioning | choose identity-first, pending invitation or reserved inactive User flow | defines creation/activation timing of User, `identity_binding` and Membership |

## 15. Technical Lead Decisions After Human Approval

- Managed Node deployment/connection mode; Edge lifecycle compute only after the expanded spike passes.
- REST/RPC endpoint layout and versioned transport DTOs.
- exact server repository interfaces and transaction adapter.
- database migration naming/tooling and RLS CI harness, including performance/query-plan and safe `SECURITY DEFINER` tests.
- local mobile persistence technology and transactional unit-of-work shape.
- batch sync size, retry/backoff, request timeout and observability implementation details.
- versioned canonical WorkEvent hash test vectors and local/server TimeEntry ID mapping DTO.
- backup encryption verification, deletion-ledger mechanism and restore-test runbook.

## 16. Acceptance Gates for Block B Implementation

Before the first backend adapter is called complete:

- ADR-0008 approved or replaced;
- all effectful ports are consistently async;
- no Business Rule moved into UI/controller/adapter/SQL;
- two-tenant negative API and RLS tests pass;
- no service credential exists in client bundles;
- server ingestion is idempotent and transactional;
- immutable WorkEvent, decision and audit evidence are demonstrable;
- approved numeric retention/expiry actions exist for every personal-data class, and pseudonymization is not represented as erasure;
- backup encryption/region/retention evidence and a successful isolated restore plus deletion-ledger replay exist;
- device-time, long-offline, pre-/post-revocation and historical-validity test matrices are green;
- multi-device/concurrent same-User scans are serialized without a second active TimeEntry;
- token expiry and failed refresh mid-batch preserve correct pending/idempotent queue state;
- canonical content-hash vectors match across client/server and TimeEntry ID mapping is explicit;
- pool reuse tests prove no JWT/tenant context leakage and no session-level advisory lock exists;
- existing 262 Core and 10 Mobile tests remain green or are migrated with equivalent assertions;
- Root typecheck, Core build and CI remain green;
- conflict/retry behavior is observable and does not drop local evidence.

## 17. Documentation Reconciliation Findings

- ADR-0007 is not contradicted; it intentionally chose only a managed-backend category and left the exact provider open.
- `Tech_Stack.md` remains a pointer to ADR-0007 and should not duplicate this package. If ADR-0008 is approved, that pointer may later add ADR-0008 as the backend refinement.
- FB-002/TS-002 deliberately excluded backend/auth/schema. This package fills that later architecture gap without changing their product rules.
- `Role_Model.md` remains a broader draft. This package uses only FB-002's implemented Administrator/Employee subset.
- `System_Overview.md`, `Domain_Model.md` and older EP-008 narrative contain stale open questions/implementation descriptions. They are not mass-updated here; ADR-0008 and this assessment are the Block B review source, and full narrative synchronization remains a block-boundary activity.
- External CTO findings K5–K7 remain open until implementation. This package resolves the decision basis, not the findings themselves.
- The independent Block B architecture/security review initially returned `CHANGES REQUIRED`. Its accepted/corrected findings are preserved in `Block_B_Independent_Architecture_Security_Review.md`; renewed Technical Lead review verified the corrections and approved this as a decision package for Human Architect disposition, not as an approved ADR or implementation authorization.

## 18. Official Primary Sources Consulted

Accessed 2026-07-13:

Supabase:

- [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Auth](https://supabase.com/docs/guides/auth)
- [Expo React Native quickstart](https://supabase.com/docs/guides/getting-started/quickstarts/expo-react-native)
- [Edge Functions](https://supabase.com/docs/guides/functions)
- [Local development and schema migrations](https://supabase.com/docs/guides/local-development/overview)
- [Database/RLS testing overview](https://supabase.com/docs/guides/local-development/testing/overview)
- [Identity linking](https://supabase.com/docs/guides/auth/auth-identity-linking)
- [Database connection modes and Supavisor](https://supabase.com/docs/guides/database/connecting-to-postgres)
- [Database backups](https://supabase.com/docs/guides/platform/backups)
- [Available regions](https://supabase.com/docs/guides/platform/regions)
- [RLS performance and policy guidance](https://supabase.com/docs/guides/database/postgres/row-level-security)

PostgreSQL:

- [Explicit and advisory locking](https://www.postgresql.org/docs/current/explicit-locking.html)
- [Safe `SECURITY DEFINER` functions](https://www.postgresql.org/docs/current/sql-createfunction.html)

EU privacy:

- [EUR-Lex: GDPR Article 17 and related definitions](https://eur-lex.europa.eu/eli/reg/2016/679/art_17/oj/eng)
- [EUR-Lex: GDPR Article 5 storage limitation](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32016R0679)
- [European Data Protection Board: anonymisation/pseudonymisation](https://www.edpb.europa.eu/topics/ai-and-technology/anonymisationpseudonymisation_en)

Firebase:

- [Cloud Firestore offline data](https://firebase.google.com/docs/firestore/manage-data/enable-offline)
- [Firestore queries and Security Rules](https://firebase.google.com/docs/firestore/security/rules-query)
- [Security Rules emulator tests](https://firebase.google.com/docs/firestore/security/test-rules-emulator)
- [Firebase Authentication custom claims](https://firebase.google.com/docs/auth/admin/custom-claims)
- [Firebase Authentication](https://firebase.google.com/docs/auth)

AWS:

- [Amazon Cognito user pools](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools.html)
- [Cognito user pool groups](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools-user-groups.html)
- [Verified Permissions authorization-model guidance](https://docs.aws.amazon.com/verifiedpermissions/latest/userguide/design-authz-strategy.html)

Auth0:

- [Auth0 Organizations overview](https://auth0.com/docs/manage-users/organizations/organizations-overview)
- [Validate access tokens](https://auth0.com/docs/secure/tokens/access-tokens/validate-access-tokens)

## 19. Handover

Evidence produced: corrected assessment, proposed ADR-0008 and the independent review/disposition artifact. No implementation, provider commitment or Human Architect approval has occurred.

Next responsible roles:

1. Technical Lead: perform renewed review of the corrected package and all independent-review dispositions.
2. Human Architect: only after Technical Lead readiness, decide the items in Section 14 and approve/reject/replace ADR-0008.
3. Only after approval: create the first short Block B implementation plan and B1 spike plan.
