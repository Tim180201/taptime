# ADR-0008: Backend, Tenant Isolation and Async Foundation

Status: Proposed — Technical Lead Reviewed; Human Architect Decision Required
Date: 2026-07-13
Roadmap: Core Roadmap v2, Block B (DT-036–DT-044)
Owner: Technical Lead
Approval Authority: Human Architect
Related Artifacts: ADR-0004, ADR-0005, ADR-0006, ADR-0007, TTAP-001, FB-001, TS-001, FB-002, TS-002, `ADO/05_Evidence/Block_B_Backend_Tenant_Async_Architecture_Assessment.md`, `ADO/05_Evidence/Block_B_Independent_Architecture_Security_Review.md`

## Status Meaning

This ADR is a recommendation, not an approved platform selection. It authorizes no implementation, dependency installation, cloud resource creation or data migration.

If approved, ADR-0008 refines ADR-0007's deliberately open backend baseline. It does not supersede ADR-0007's mobile, offline-first, domain-first or explicit-synchronization decisions.

The first independent architecture/security review returned `CHANGES REQUIRED`. Its findings have been incorporated with the dispositions recorded in the related review artifact. Renewed Technical Lead review verified those corrections and approved this document as the Block B decision package. The ADR itself remains Proposed and has not received Human Architect approval.

## Context

Block A completed the local TimeEntry lifecycle, CI and tests-inclusive TypeScript checking. The remaining Block B findings are structural:

- no network-reachable backend or server-side tenant enforcement exists;
- all Core ports and their callers are synchronous;
- the only synchronization target is `FakeSynchronizationGateway`;
- authentication is still fake and constructed inside the mobile UI;
- Organization and Membership exist in the domain, but no server authority binds an authenticated identity to them;
- the current file adapters are single-process local prototypes, not server storage;
- offline WorkEvents and TimeEntries must remain auditable without moving Business Rules into a controller, database policy or adapter.

The backend choice must support the actual TapTim.e model: Organization-scoped relational data, an immutable WorkEvent trail, a one-active-TimeEntry-per-user invariant, idempotent offline synchronization, a minimal Administrator/Employee role model and a small implementation team.

## Proposed Decision

Subject to Human Architect approval, TapTim.e shall use this Block B baseline:

1. **Managed data and identity plane:** Supabase-managed PostgreSQL and Supabase Auth.
2. **Server application boundary:** an authenticated TapTim.e backend API invokes the existing Core Application/Business boundaries. Mobile and future Admin Web do not perform authoritative writes directly against database tables.
3. **Compute gate:** a persistent managed Node.js runtime is the preferred primary runtime for the transactional TapTim.e lifecycle API because it provides the clearest control over direct/session-pooled connections, transaction scope and connection reuse. Supabase Edge Functions remain suitable for narrow stateless tasks and may host the lifecycle API only if a spike proves full transactional and security suitability. The compute result shall be recorded before adapter implementation.
4. **Tenant model:** one pooled database and shared schema, with mandatory `organization_id`, composite tenant-preserving foreign keys, PostgreSQL Row Level Security (RLS), request-level membership checks and negative isolation tests. Database-per-Organization is not required for v1.
5. **Identity model:** the authentication provider proves identity only. A provider-neutral identity binding maps issuer/subject to TapTim.e `UserId`; the Membership table remains authoritative for Organization and role. Organization or role claims in a token are not the sole authorization source. V1 recommends one controlled sign-in method; additional providers/linking require explicit approval and no custom email-only linking logic.
6. **Authorization model:** only `administrator` and `employee` are user roles in v1. UI visibility is advisory; the backend and database enforce every permission.
7. **Async model:** every effectful port returns `Promise`, including local persistence, authentication, NFC capture and synchronization boundaries. Pure Domain/Business components remain synchronous. `T | Promise<T>` contracts are prohibited.
8. **Offline and sync model:** the mobile device keeps local WorkEvent capture and an explicit queue. `WorkEventId` is the idempotency identity. The backend stores immutable WorkEvent evidence, invokes the same Core Business Engine boundary for the canonical server decision, persists the decision and TimeEntry transition atomically, and returns a typed synchronization outcome. Revocation and device-time anomalies are evaluated explicitly before canonical lifecycle mutation.
9. **Audit model:** WorkEvents and canonical decisions are immutable operational evidence while their approved retention purpose applies; mutable operational records use optimistic concurrency where necessary; administrative changes produce append-only audit records. Duration remains derived and is never stored independently. Immutability never overrides applicable deletion, restriction or retention law.
10. **Access path:** provider service-role credentials never ship to Mobile or Admin Web. Privileged bypass is restricted to audited bootstrap/operations paths; normal requests preserve user context through authorization and persistence.
11. **Privacy model:** every personal-data class receives a documented purpose/legal basis, retention period and expiry action. Expiry may require physical deletion, legally effective anonymization, or approved continued restricted retention. Pseudonymized data remains personal data and is not assumed to satisfy an erasure request. Backup expiry/restore handling is part of the same policy and requires legal review.
12. **Clock/anomaly model:** device `occurredAt` is untrusted evidence; server `receivedAt` remains separate. Clock skew, backwards time, unusual duration and long offline delay are distinct signals. No simple absolute `occurredAt`/`receivedAt` threshold is a business rule because legitimate offline synchronization can be late. Suspicious cases escalate without silently changing working time; tolerances require Human Architect approval.
13. **Membership-revocation model:** a revoked Membership blocks ordinary current access, but a WorkEvent allegedly captured before `revokedAt` is not silently discarded. Grace-window processing, administrative review and categorical rejection are explicit product options; manipulated device time prevents `occurredAt < revokedAt` from being sufficient proof by itself.

## Responsibility Boundaries

### Core

- Owns Domain types, Business Engine rules, authorization validators, use-case orchestration and provider-neutral ports.
- Remains independent of React Native, HTTP frameworks, provider SDKs, SQL and database document/row shapes.
- Supplies the same Business Engine implementation to offline mobile evaluation and server canonical evaluation.

### Mobile

- Owns NFC hardware access, secure session-token storage, mobile-local persistence, offline queueing, connectivity-triggered synchronization and presentation.
- May render capabilities based on role but never grants access.
- Never contains a backend secret and never writes authoritative TimeEntry state directly to server tables.

### Backend

- Validates access tokens and maps identity to TapTim.e `UserId`.
- Resolves active Membership, derives the tenant context and enforces role/Organization access.
- Invokes Core use cases and the Business Engine; owns HTTP/API mapping, rate limiting, server repository adapters, transactions, idempotency, audit persistence and operational observability.
- Does not reimplement Business Rules in controllers, SQL policies or adapters. Database constraints enforce integrity, not product interpretation.

### Future Admin Web

- Owns administrative presentation and command submission.
- Uses the same authenticated backend API and server authorization model as Mobile.
- Has no privileged database credential and no independent role/tenant rules.

## Tenant-Isolation Decision

Every tenant-owned row shall carry a non-null `organization_id`. Isolation uses defense in depth:

1. authenticated issuer/subject is verified server-side;
2. identity is mapped to a stable TapTim.e `UserId`;
3. the current or historically relevant Membership for the requested Organization is resolved from server data;
4. ordinary access requires an active Membership and the required role/capability;
5. a dedicated sync-ingestion path handles pre-revocation offline evidence according to the not-yet-approved revocation policy and never grants general tenant access;
6. repository queries are scoped by `organization_id` and never expose an unscoped list/find method;
7. composite foreign keys prevent relationships crossing Organization boundaries;
8. RLS repeats the Membership/Organization condition for reads and writes;
9. server-only lifecycle writes execute through a restricted transactional path;
10. automated tests prove cross-tenant reads, writes, references and guessed identifiers are denied.

The Organization identifier supplied by a client is a requested scope, never trusted authority. `WorkEvent.triggeredBy` and the owning User of a server TimeEntry are derived from the authenticated identity/Membership, not accepted from an arbitrary request body.

## Minimal Role Decision

| Capability | Employee | Administrator |
|---|---:|---:|
| Authenticate and resolve own Membership | Yes | Yes |
| Read minimum active Organization configuration needed for scanning | Yes | Yes |
| Submit/synchronize own WorkEvents | Yes | Yes |
| Read own TimeEntries and own sync state | Yes | Yes |
| Create/manage Customers, NFC Tags and NFC Assignments | No | Yes |
| Manage Memberships within own Organization | No | Proposed, except first-admin bootstrap and subject to invitation/revocation decisions |
| Read Organization-wide WorkEvents, TimeEntries and audit evidence | No | Yes |
| Cross-Organization access | No | No |

`System Owner`, `Team Lead` and a generic policy engine remain out of scope. A backend bootstrap operator/service identity is an operational principal, not a third user role.

## Async Contract Decision

All effectful boundaries use one predictable contract:

```text
read(): Promise<Value | null>
list(): Promise<readonly Value[]>
write(value): Promise<void or typed expected outcome>
useCase(input): Promise<typed use-case outcome>
```

Expected business outcomes remain discriminated unions. Infrastructure/network failures do not become Business Engine decisions. Pure functions and classes — including `BusinessEngine`, `WorkEventFactory`, `MembershipAuthorizationValidator`, classifiers and presenters — remain synchronous.

Migration shall proceed as compiler-enforced vertical slices. A permanent compatibility type such as `T | Promise<T>` is prohibited because it lets callers accidentally omit `await`.

## Privacy, Retention and Immutability Decision Boundary

WorkEvents, canonical decisions and audit events are append-only during their valid operational/legal retention period. Append-only means normal application users cannot rewrite history; it does not mean personal data is retained forever or exempt from data-subject rights.

Before production data, a legally reviewed retention schedule must define per data class:

- purpose and Article 6 legal basis;
- applicable employment, tax, commercial or evidence retention duty and exact jurisdiction-specific period;
- the start event for the retention period;
- access restriction during retention;
- expiry action: physical deletion, genuine anonymization, or continued restricted retention where a documented legal obligation/exception applies;
- handling of identifiers and free-form/JSON audit payloads;
- effect of erasure, restriction and correction requests;
- propagation to replicas, exports, logs, backups and restore copies.

Pseudonymization reduces linkability but is reversible when additional information exists. It remains personal data and does not automatically satisfy an erasure request. Genuine anonymization must make identification no longer reasonably possible, including through linkage/inference, and requires legal/technical validation. If neither deletion nor genuine anonymization is lawful/feasible during a mandatory retention period, access must be restricted and the legal basis documented.

Backups require encryption, an approved region, a retention/expiry schedule and periodic restore tests. A restore must reapply all deletion, restriction, anonymization and revocation actions that occurred after the restored recovery point before the restored environment can serve traffic.

## Clock and Offline Anomaly Policy

`WorkEvent.occurredAt` is supplied by a device and is not trusted server time. `receivedAt` is server evidence and never overwrites `occurredAt`.

The server detects, records and evaluates separate anomaly classes:

- clock skew relative to trustworthy server/device calibration evidence;
- backwards time relative to prior accepted WorkEvents or active TimeEntry state;
- unusual or impossible derived duration;
- long offline delay between occurrence and receipt;
- inconsistent ordering across devices;
- event time around Membership grant/revocation or Assignment validity boundaries.

A large absolute `|occurredAt - receivedAt|` value alone must not reject an event: a legitimately offline device can synchronize days later. Conversely, `occurredAt < revokedAt` alone must not prove legitimacy because device time can be manipulated. Evidence may include device sequence/order, prior server calibration, queue creation metadata, Assignment/Membership validity and receipt history.

Suspicious cases produce a typed escalation/administrative-review outcome and do not silently start, stop or rewrite working time. Exact tolerances, acceptable offline duration and review behavior are Human Architect decisions before implementation.

## Membership Revocation and Offline Evidence

Ordinary API access ends when Membership is revoked. Offline WorkEvents captured before revocation require an explicit product policy so legitimate work is not silently lost and forged backdated events are not silently accepted.

Options requiring Human Architect disposition:

1. **Grace window:** accept eligible evidence submitted within a defined server-time window after `revokedAt`, subject to anomaly and historical-validity checks.
2. **Administrative review:** ingest immutable evidence into a quarantined/deferred state without TimeEntry mutation; an authorized Administrator reviews it.
3. **Categorical rejection:** reject synchronization after revocation, with an explicit observable reason and retained local evidence. This has wage/evidence consequences and cannot be the implicit default.

A combined policy may use a short grace window and then administrative review. Every path must verify the Membership and NfcAssignment were valid at the alleged event time and must account for manipulated device time.

## Identity Linking and Provisioning

Supabase Auth currently automatically links identities that use the same verified email address to one user and documents safeguards around unverified identities. TapTim.e must not reproduce or extend this behavior with custom email-only linking.

V1 recommendation:

- enable one controlled sign-in method initially;
- require explicit architecture/security approval before enabling another OAuth/password/SSO provider;
- rely only on provider-documented verified linking or an authenticated explicit linking ceremony;
- never create/merge `identity_binding` rows solely because two requests contain the same email address;
- audit every manual/provider-link change.

Invitation/provisioning remains open. An Administrator cannot create a normal Membership for an unregistered employee unless a stable TapTim.e `UserId` exists. The Human Architect must choose whether invitation creates a pending User/identity placeholder, whether first successful registration creates the User/`identity_binding` and then activates Membership, or whether pilot operations provision identity first. Pending invitations must not confer access.

## Compute, Transactions, Pooling and Locks

Preferred primary runtime: a persistent managed Node.js service with an application connection pool using a direct database connection where available or Supavisor session mode where required. This minimizes uncertainty for Core reuse and multi-table lifecycle transactions.

Supabase Edge Functions remain appropriate for narrow stateless tasks. They may host the lifecycle API only if a spike proves all of the following under the exact deployment and connection mode:

- import and execution of the real `@taptime/core` package;
- one genuine multi-table transaction covering WorkEvent, decision, TimeEntry, receipt and audit writes;
- rollback after an injected failure at every write stage;
- JWT validation and RLS/request-context propagation;
- connection creation/reuse behavior under concurrency and cold/warm invocations;
- no tenant/JWT/session variable leakage when a pooled connection is reused;
- behavior of the selected driver with Supavisor session mode and transaction mode;
- transaction mode's lack of prepared-statement support, with driver prepared statements disabled if that mode is used;
- load sufficient to expose pool exhaustion and ordering defects.

Per-user serialization may use a row lock or `pg_advisory_xact_lock` only inside the same database transaction as the reads and writes. Session-level advisory locks are prohibited because they outlive rollback semantics and are unsafe with pooled/reused sessions. Any request-scoped database context must be set transaction-locally and reset by transaction completion.

## Server Persistence Principles

- UUIDs generated by the current Core are compatible with client-created offline identities.
- UTC `timestamptz` is used for persisted instants.
- Client `occurred_at` and server `received_at` remain separate facts.
- Client `occurred_at` is untrusted evidence and is evaluated under the Clock and Offline Anomaly Policy.
- WorkEvents are immutable after acceptance.
- One active TimeEntry per `(organization_id, user_id)` is enforced by a partial unique index.
- Start/stop WorkEvent foreign keys and stopped-state consistency are enforced by constraints.
- Tenant-owned references use `(organization_id, id)` composite keys.
- NFC payload uniqueness is Organization-scoped for the proposed v1 schema; the payload representation remains subject to Block D's NFC payload/security decision.
- Sync retries with an existing identical `WorkEventId` are idempotent success; the same ID with different content is a conflict.
- `content_hash` uses one versioned canonical representation with an explicit field allowlist, fixed field order, UTF-8 encoding, timestamp normalization and named hash algorithm; hash version is stored with the hash.
- Server decision records include an engine version for replay/audit diagnostics.
- Local and server TimeEntry identities may differ. Reconciliation is explicit through `WorkEventId -> sync_receipt -> canonical decision -> server_time_entry_id`; the server never silently overwrites a local ID association.
- Historical Membership, NfcAssignment, NfcTag and target validity at the alleged event time is checked for delayed WorkEvents.
- Backups are encrypted, region-bound, retention-governed and subject to regular restore tests.

The complete logical schema and constraint map are in the related Block B assessment. They remain persistence mappings, not Domain definitions.

## Options Considered

### A. Supabase PostgreSQL + Supabase Auth + thin server API — Recommended

Strengths:

- PostgreSQL constraints, transactions and RLS fit TapTim.e's relational, Organization-owned model.
- Auth JWTs integrate with RLS while Membership remains application data.
- Schema migrations and policy tests can be version-controlled and run locally.
- A managed Node.js API and optional TypeScript Edge Functions fit the repository language, subject to the compute/transaction spike.
- PostgreSQL reduces data-model lock-in compared with a provider-specific document model.

Costs/risks:

- Supabase does not replace TapTim.e's explicit mobile offline queue.
- RLS and service-role bypass require rigorous tests and credential discipline.
- Supabase Auth automatically links identities with the same verified email under its documented rules; TapTim.e provider enablement/linking must be deliberately constrained.
- Edge Functions use Deno and serverless transaction pooling; Core packaging, full rollback, lock behavior, prepared-statement configuration and request-context isolation must be proven before using them for lifecycle ingestion.

### B. Firebase Authentication + Cloud Firestore + Cloud Functions

Strengths:

- Strong mobile SDK maturity and built-in offline cache/synchronization.
- Existing reference-project experience.
- Security Rules and emulator-based rule tests are available.

Costs/risks:

- Firestore Security Rules are not query filters; every query must prove its authorization constraints.
- Server SDKs bypass Firestore Security Rules and rely on IAM/application enforcement.
- Cross-entity tenant constraints, one-active-entry uniqueness and transactional audit mappings are less natural in a document model.
- Built-in client synchronization overlaps with, but does not replace, TapTim.e's explicit auditable queue/conflict protocol.

Disposition: viable fallback if mobile offline SDK leverage is prioritized over relational integrity.

### C. AWS Cognito + API Gateway/Lambda + managed PostgreSQL or DynamoDB

Strengths:

- Strong managed identity, IAM, policy and deployment capabilities.
- Supports explicit API boundaries and sophisticated future enterprise requirements.

Costs/risks:

- Multiple services, IAM policy surfaces and higher operational complexity are disproportionate for two roles and the current team capacity.
- Cognito groups or Verified Permissions must not become a duplicate source of truth for TapTim.e Membership.

Disposition: technically capable, not recommended for v1 complexity/capacity.

### D. Auth0 + managed PostgreSQL + custom Node API

Strengths:

- Strong OIDC/API model and optional B2B Organization features.
- Clear separation of identity and application persistence.

Costs/risks:

- Adds provider and deployment surfaces.
- Auth0 Organizations/Roles would overlap with TapTim.e Organization/Membership unless carefully mapped.
- Organization feature availability depends on plan; premature for the current single-Membership v1 scope.

Disposition: reconsider if enterprise federation/SSO becomes an approved near-term requirement.

## Consequences

Positive:

- Tenant enforcement exists independently of Mobile/Admin behavior.
- Current Core logic remains reusable and testable.
- Relational constraints make cross-tenant references and lifecycle invariants enforceable.
- Explicit synchronization and WorkEvent evidence remain first-class.
- Async migration is completed before network adapters create a mixed contract.

Negative:

- Most application tests and composition callers must become async.
- A server deployment unit, database migrations, RLS tests and environment management are required.
- Mobile-local persistence still needs a production-grade adapter; Supabase is not that adapter.
- Server canonical evaluation introduces conflict/reconciliation product questions for late offline events.
- Append-only auditability must be reconciled with legally reviewed retention, erasure, restriction and anonymization operations.
- Clock, revocation and historical-validity anomalies require a review path rather than only synchronous success/rejection.

## Required Approval and Open Decisions

Human Architect decisions required before implementation:

1. Approve or reject Supabase PostgreSQL + Supabase Auth as the v1 managed platform.
2. Approve the pooled-schema/RLS tenant model rather than database-per-Organization isolation.
3. Decide the first Organization/first Administrator bootstrap rule.
4. Confirm the current one-active-Membership-per-user v1 assumption or approve multi-Organization membership before schema implementation.
5. Decide the product outcome for a late offline WorkEvent whose server-canonical decision conflicts with local state.
6. Approve Membership revocation/deactivation semantics before real user administration.
7. Approve region/data-residency, backup and retention requirements with privacy/legal input before production data.
8. Approve the personal-data retention/erasure strategy for immutable WorkEvents, decisions and audit events, including when physical deletion, genuine anonymization, pseudonymization/restriction or continued legally required retention applies.
9. Decide how pre-revocation offline WorkEvents are handled: grace window, administrative review, categorical rejection or a defined combination.
10. Approve the Clock and Offline Anomaly Policy: separate anomaly classes, tolerances, maximum ordinary offline delay and escalation/review behavior.
11. Approve the v1 sign-in method and whether/when additional providers or identity linking are permitted.
12. Decide the invitation/provisioning sequence for an employee who has no TapTim.e `UserId`, including creation timing for User, `identity_binding` and Membership.
13. Approve NFC payload uniqueness/representation before production migration.

Technical Lead decisions/gates required:

1. Confirm managed Node runtime deployment/connection mode; permit Edge lifecycle compute only after the expanded compute/transaction spike passes.
2. Exact API protocol and DTO versioning.
3. Mobile local database technology and atomic local lifecycle boundary.
4. Concrete database migration and RLS test tooling, including performance plans and safe `SECURITY DEFINER` review.
5. Versioned canonical `content_hash` specification and local/server TimeEntry identity mapping contract.
6. Backup encryption evidence, restore-test cadence and deletion-ledger/replay mechanism for restored copies.

## Implementation Gate

No backend adapter, async migration, provider dependency or cloud resource may be introduced until:

- this ADR receives Human Architect disposition;
- the open product decisions that affect schema/security are resolved or explicitly deferred with safe defaults;
- renewed Technical Lead review has confirmed the independent review findings are incorporated;
- the independent architecture/security review and dispositions remain linked as evidence;
- the first implementation slice has a short plan with negative tenant-isolation tests.

## Review Triggers

Revisit this ADR when:

- one User may belong to multiple Organizations;
- enterprise SSO/federation becomes near-term scope;
- data-residency or contractual isolation requires siloed infrastructure;
- non-customer AssignmentTargets are implemented;
- synchronization conflicts require a different server-authority model;
- legal review changes retention, erasure, anonymization or backup requirements;
- additional authentication providers or identity-linking methods are proposed;
- provider evidence invalidates the compute or RLS assumptions.

## Official Primary Sources for Corrective Decisions

Accessed 2026-07-13:

- [EUR-Lex: GDPR Article 17 and related definitions](https://eur-lex.europa.eu/eli/reg/2016/679/art_17/oj/eng)
- [European Data Protection Board: anonymisation and pseudonymisation](https://www.edpb.europa.eu/topics/ai-and-technology/anonymisationpseudonymisation_en)
- [Supabase Auth identity linking](https://supabase.com/docs/guides/auth/auth-identity-linking)
- [Supabase database connection modes and Supavisor](https://supabase.com/docs/guides/database/connecting-to-postgres)
- [PostgreSQL transaction-level versus session-level advisory locks](https://www.postgresql.org/docs/current/explicit-locking.html)
- [PostgreSQL safe `SECURITY DEFINER` functions](https://www.postgresql.org/docs/current/sql-createfunction.html)
- [Supabase database backups](https://supabase.com/docs/guides/platform/backups)
- [Supabase regions](https://supabase.com/docs/guides/platform/regions)
