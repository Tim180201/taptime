# Block B6 — Server-canonical Lifecycle Ingestion Authorization

Status: Authorized — Awaiting Implementation
Authorization Date: 2026-07-13
Human Architect Authorization: Explicitly supplied after B5 closure
Owner: Technical Lead
Architecture Authority: `ADO/01_Architecture/ADR/ADR-0008-backend-tenant-isolation-and-async-foundation.md`

## 1. Authorized Objective

Implement one production-shaped, non-HTTP managed-Node transaction boundary for synchronization of
one authenticated User's WorkEvent at a time. The boundary must persist immutable WorkEvent
evidence, invoke the genuine unchanged Core `BusinessEngine.evaluate()` with server-loaded state,
apply only that returned TimeEntry transition, persist the exact CanonicalDecision, write the typed
SyncReceipt mapping and append allowlisted lifecycle Audit evidence atomically.

B6 is an adapter/orchestration slice. It may not add or reinterpret a Business Rule in SQL,
controller logic or persistence mapping.

## 2. Authorized Trust and Transaction Boundary

```text
raw access token + requested Organization + client WorkEvent evidence + receipt metadata
  -> existing B4 asymmetric JWT verifier
  -> BEGIN READ COMMITTED
  -> restricted identity-resolver role
  -> lock current IdentityBinding and active Membership from verified issuer/subject
  -> compare resolved Organization with requested Organization
  -> transaction-local database-derived User/Organization/Membership context
  -> fixed taptime_server_lifecycle role
  -> transaction-level per-Organization/User advisory lock
  -> lock/recheck current authority and authoritative Assignment/Tag/Customer snapshot
  -> load active TimeEntry FOR UPDATE and latest canonically evaluated same-target WorkEvent
  -> unchanged real @taptime/core BusinessEngine.evaluate()
  -> persist only that exact result and its receipt/audit mapping
  -> COMMIT, or full ROLLBACK on any failure
```

No request, token claim, structurally constructed context or client decision may select User,
Organization, Membership role, database role, target, TimeEntry transition, CanonicalDecision type
or escalation reason.

## 3. Authorized Input and Result Shape

The command may contain only:

- raw access token and requested `OrganizationId`;
- client WorkEvent evidence: `WorkEventId`, `NfcAssignmentId`, `NfcTagId`, customer target and
  `occurredAt`;
- explicit synchronization metadata required by the existing schema, such as receipt identity,
  positive attempt number and optional client TimeEntry reconciliation identity.

`triggeredBy`, authoritative Organization, role, server TimeEntry ID, Decision type/reason and
server transition state are never accepted as request authority. Client target/Tag evidence must
exactly match the locked server Assignment snapshot before canonical evaluation.

Expected outcomes must be typed and disclosure-safe: synchronized canonical result, identical
idempotent retry, conflicting WorkEvent-ID content, deferred/non-automatable evidence, access-token
rejection, unavailable current authority and requested-Organization mismatch. PostgreSQL, pool,
mapping, impossible persisted-state and programming failures remain thrown infrastructure errors.

## 4. Mandatory Atomic Persistence

For a newly canonically evaluated WorkEvent, one transaction must contain:

1. canonical-hash-v1 WorkEvent insert with actor/Organization derived from locked authority;
2. the exact TimeEntry insert or started-to-stopped update returned by Core, or no mutation for the
   other three Core outcomes;
3. the exact five-way CanonicalDecision relational mapping and allowlisted diagnostic payload;
4. a `synchronized` SyncReceipt mapped to the same Decision and optional exact server TimeEntry;
5. one allowlisted lifecycle AuditEvent.

An injected failure after every write stage must prove complete rollback. Start and Stop for the
same TimeEntry remain ordered separate per-WorkEvent commits; B6 may not collapse multiple queued
events into one final-state transaction.

## 5. Idempotency and Deferred Safety

- Canonical hash v1 remains the B3/B1-approved exact field allowlist, order, timestamp
  normalization, UTF-8 encoding, SHA-256 algorithm and stored version.
- An identical existing WorkEvent ID/content returns the already persisted canonical truth without
  re-running or duplicating the lifecycle transition.
- The same WorkEvent ID with different canonical content is a typed conflict and preserves all
  original rows.
- Automatic TimeEntry mutation requires current active Membership and an exact, currently active
  Assignment/Tag/Customer configuration locked for the transaction.
- Evidence requiring revoked-Membership, inactive/historical Assignment, device-time grace or other
  unapproved historical interpretation must never fabricate a Core decision or mutate a TimeEntry.
  Where the already-approved B3 evidence shape is applicable, it may append WorkEvent plus a
  `LifecycleDeferred` AuditEvent only, with no CanonicalDecision or SyncReceipt.
- The separate post-revocation/offline grace and administrative-review product path remains out of
  scope because no numeric/product policy or deferred Receipt vocabulary is approved.

## 6. Mandatory Security Hardening

- Additive migration `005` is authorized only for an execute-only, fixed-search-path resolver that
  locks the verified active IdentityBinding and Membership for the lifecycle transaction. Existing
  migrations `001`–`004` remain byte-for-byte unchanged.
- The B6 runtime login is `LOGIN NOINHERIT`, non-owner, non-superuser, no `BYPASSRLS`, and has
  exactly the identity-resolver and lifecycle parent roles — never Employee, Administrator,
  installer or service-role authority.
- Use only transaction-level advisory locking; session-level locks are forbidden.
- Lock current authority and mutable configuration rows so concurrent revocation/deactivation
  cannot race canonical mutation.
- Preserve B3 forced RLS, composite tenant/User/target foreign keys, append-only evidence and
  reciprocal deferred Decision/TimeEntry truth constraints.
- No Pool, PoolClient, role selector, raw query or structurally constructible actor authority may
  escape the cohesive transaction boundary.

## 7. Mandatory Adversarial Evidence

The isolated B6 suite must use real PostgreSQL 17 plus the existing real B4 asymmetric JWT verifier
and cover at minimum:

- all five genuine Core decisions and exact relational mappings;
- sequential Start -> Stop -> Start in separate transactions;
- identical retry versus same-ID/different-content conflict;
- cross-tenant IDs, same-Organization other User, forged claims and snapshot mismatch;
- concurrent duplicate submissions, per-user serialization and one-active-entry enforcement;
- Membership/IdentityBinding revocation and Assignment/Customer/Tag deactivation races;
- callback/capability absence, runtime-role graph, `RESET ROLE`, RLS and pooled context cleanup;
- rollback after every write stage and preservation of append-only originals;
- deferred/no-mutation paths without invented Core reasons or false receipts;
- exact canonical hash golden vector and injection-shaped values as parameters;
- B5, B4, B3, B1, Core and Mobile regressions.

CI must receive an isolated B6 Node 24/PostgreSQL 17 job with clean-install, migrations `001`–`005`,
idempotent ledger verification, tests-inclusive typecheck, complete B6 tests and build.

## 8. Explicit Non-goals

No HTTP/API route, deployment, Supabase/cloud resource, production credential/data, Mobile wiring,
batch ingestion, new Business Rule, numeric clock/grace/offline threshold, post-revocation review
workflow, administrator correction flow, retention/deletion implementation, monitoring/load work or
Block C runtime composition is authorized.

Implementation ends at `Implemented — Awaiting Technical Lead Review`. It must not commit or push
and must not infer authorization for any later block.
