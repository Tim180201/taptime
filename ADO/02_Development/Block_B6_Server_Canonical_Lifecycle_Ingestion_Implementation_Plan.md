# Block B6 — Server-canonical Lifecycle Ingestion Implementation Plan

Status: Implemented — Awaiting Technical Lead Review

Date: 2026-07-13

Authorized baseline: `3e83a525e1a37f489225ec68794330270aadcc88`

## 1. Objective and trust boundary

Block B6 adds one non-HTTP, managed-Node lifecycle-ingestion boundary. Its command accepts only a
raw access token, a requested Organization, immutable WorkEvent evidence and SyncReceipt metadata.
User, Membership, Organization authority, database role, BusinessEngine result, Decision reason and
server TimeEntry mapping are never request authority.

The coordinator owns the whole transaction and never exposes a `PoolClient`, resolved actor, role
selector or raw-query capability. It uses the existing concrete B4 asymmetric JWT verifier and the
unchanged Core `BusinessEngine.evaluate()` implementation. PostgreSQL validates the persisted Core
result; it does not choose a lifecycle result.

## 2. Transaction sequence

Each WorkEvent is processed in a separate `READ COMMITTED` transaction:

1. Verify the raw token with `SupabaseJwtAccessTokenVerifier` before opening a database transaction.
2. `BEGIN ISOLATION LEVEL READ COMMITTED` and select `taptime_identity_resolver` locally.
3. Resolve and `FOR SHARE` lock the active IdentityBinding and active Membership through migration
   `005`; reject zero/multiple rows and compare the requested Organization.
4. Set User, Organization, Membership, Membership Role and correlation context transaction-locally.
5. Select only the fixed `taptime_server_lifecycle` role.
6. Serialize by Organization/User with `pg_advisory_xact_lock`; no session lock is used.
7. Lock the authoritative Assignment, NfcTag and Customer snapshot. Client evidence must match the
   locked snapshot. Inactive current configuration, or an event predating Assignment validity, Tag
   creation or Customer activation, is deferred without inventing a Core result.
8. Check canonical WorkEvent-v1 idempotency before evaluation. An identical retry returns the
   existing Decision; different content yields a disclosure-safe typed conflict.
9. Lock the active User TimeEntry with `FOR UPDATE`, load the latest accepted same-target WorkEvent,
   construct the server-authoritative Core WorkEvent and call the unchanged `BusinessEngine`.
10. Atomically write WorkEvent, the exact required TimeEntry mutation, CanonicalDecision,
    synchronized SyncReceipt and allowlisted AuditEvent, then commit.

Rollback after any write stage must remove every new row and preserve pre-existing append-only
evidence and TimeEntry state. Start, Stop and a later Start remain three ordered transactions.

## 3. Schema and least privilege

- Migrations `001`–`004` remain byte-for-byte unchanged.
- Additive migration `005` adds a narrow security-definer authority-lock resolver plus a separate
  context-bound configuration-lock helper. Both have fixed safe search paths and are revoked from
  `PUBLIC`; execute is granted only to the corresponding resolver or lifecycle role. No new table
  mutation grant or policy is introduced.
- The B6 runtime login is synthetic in local/CI tests, `LOGIN NOINHERIT`, non-owner, non-superuser,
  without database/role/replication/RLS bypass privileges, and has exactly the resolver and
  lifecycle parent roles. `RESET ROLE` has no schema/table/function access.
- Existing RLS, immutable grants, deferred lifecycle constraints and audit rules are not weakened.

## 4. Result and error model

Expected outcomes are typed and disclosure-safe:

- synchronized new result or idempotent retry with the persisted Core Decision mapping;
- WorkEvent content conflict without foreign row details;
- deferred current-configuration case without a fabricated Decision, TimeEntry mutation or
  synchronized Receipt;
- token, identity/Membership and requested-Organization rejection using the existing B4 vocabulary.

PostgreSQL, pool, mapping and invariant failures remain thrown infrastructure errors. Receipt ID or
attempt collisions are rejected generically and never reveal another tenant's identifiers.

## 5. Verification matrix

The isolated Node 24/PostgreSQL 17 suite will cover:

- all five Core outcomes and exact Decision/Receipt/TimeEntry mappings;
- Start → Stop → Start, one-active-entry enforcement and same-/different-User concurrency;
- identical WorkEvent retry, Receipt retry, new attempts and same-ID/different-content conflict;
- cross-tenant, same-Organization cross-User, Assignment/Tag/Customer/TimeEntry guessing, forged
  token claims, requested-Organization mismatch and SQL-injection-shaped values;
- unknown/revoked authority and concurrent IdentityBinding/Membership/configuration changes;
- active configuration whose event time predates Assignment, Tag or Customer validity starts;
- rollback after every write stage, append-only evidence preservation, xact-lock and pooled
  role/GUC cleanup;
- exact runtime role graph, direct/DDL/`RESET ROLE` denial, migration `005` grants, rerun and ledger;
- canonical hash golden vector and unnamed-query execution.

Regression gates remain B5, B4, B3, B1, Core and Mobile typechecks/tests/builds. CI receives one
isolated B6 job using Node 24.17.0 and PostgreSQL 17.10.

## 6. Explicit exclusions and remaining gates

No HTTP API, cloud resource, Mobile wiring, batch transaction, production data, productive
PostgreSQL/Supabase deployment, clock threshold, revocation grace rule, historical assignment
interpretation, administrative correction flow or Block C work is authorized. Post-revocation
offline review, historical configuration resolution, Supavisor validation, privacy/retention and
production provisioning remain separate Human-Architect/Technical-Lead gates.
