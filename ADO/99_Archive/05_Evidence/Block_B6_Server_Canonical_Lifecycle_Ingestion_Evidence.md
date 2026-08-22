# Block B6 — Server-canonical Lifecycle Ingestion Evidence

Status: Completed — Technical Lead, GitHub CI and Independent Security Approved

Date: 2026-07-13

Authorized baseline: `3e83a525e1a37f489225ec68794330270aadcc88`

## 1. Delivered boundary

The new private `@taptime/backend-lifecycle` Node 24 workspace implements one cohesive,
non-HTTP transaction boundary. Its closed command contains only:

- raw access token and requested Organization;
- WorkEvent ID, Assignment ID, Tag ID, customer target and `occurredAt` evidence;
- Receipt ID, positive attempt number and optional client TimeEntry ID.

The coordinator accepts no authoritative User, role, Membership, database role, server TimeEntry,
Decision type/reason or lifecycle transition. Adversarial runtime objects and signed token claims
containing those fields are ignored. It exposes no Actor, `Pool`, `PoolClient`, role selector or raw
query callback.

## 2. Actual transaction and decision provenance

Every WorkEvent uses one separate `READ COMMITTED` transaction:

1. the concrete existing B4 `SupabaseJwtAccessTokenVerifier` verifies the asymmetric token;
2. migration `005` locks the verified active IdentityBinding and active Membership with `FOR SHARE`;
3. requested Organization is compared to the locked Membership;
4. actor/correlation values are set only transaction-locally and the fixed lifecycle role is
   selected;
5. `pg_advisory_xact_lock(hashtextextended(Organization + separator + User, 0))` serializes one
   owning User; no session advisory lock exists;
6. a separate fixed-search-path helper validates the active Membership context and locks the exact
   Assignment, NfcTag and Customer snapshot with `FOR SHARE`;
7. the active TimeEntry is loaded `FOR UPDATE` and the latest same-target WorkEvent having a
   CanonicalDecision is loaded;
8. the unchanged `@taptime/core` `BusinessEngine.evaluate()` chooses the result;
9. WorkEvent, exact required TimeEntry mutation, CanonicalDecision, synchronized SyncReceipt and
   allowlisted AuditEvent commit atomically.

No SQL trigger, adapter or test helper selects Start, Stop, Duplicate, Other-Target rejection or
Escalation. PostgreSQL's existing B3 constraints only validate that the persisted engine output is
relationally truthful.

| Core result | TimeEntry mutation | CanonicalDecision relation | Receipt server TimeEntry |
|---|---|---|---|
| `time_entry_started` | insert exact Core StartedTimeEntry | `time_entry_id` | exact new ID |
| `time_entry_stopped` | one versioned started-to-stopped update | `time_entry_id` | exact stopped ID |
| `duplicate_scan_ignored` | none | `previous_work_event_id` | `NULL` |
| `active_entry_for_other_target_rejected` | none | `active_time_entry_id` | exact active ID |
| `escalation_required` | none | allowlisted Core `reason` | `NULL` |

Start, Stop and later Start are verified as three ordered commits, not one collapsed batch.

## 3. Migration `005` and least privilege

Migration `005_locked_identity_membership_resolver.sql` adds two narrow lock helpers:

- `lock_request_actor(text,text)` is `SECURITY DEFINER`, fixed-search-path, locks only the verified
  active IdentityBinding/Membership and is executable only by `taptime_identity_resolver`;
- `lock_lifecycle_configuration(uuid,uuid)` is `SECURITY DEFINER`, fixed-search-path, requires the
  exact transaction-local Organization/User/Membership context, locks only one Assignment plus its
  Tag/Customer and is executable only by `taptime_server_lifecycle`.

Both functions are revoked from `PUBLIC`. No table mutation grant, mutation policy or general query
surface was added. The synthetic B6 login is `LOGIN NOINHERIT`, owns no schema relation, has no
superuser/database/role/replication/RLS-bypass privilege and has exactly the resolver and lifecycle
parent roles. Direct table access, Employee/Administrator role selection, DDL and access after
`RESET ROLE` are denied.

Migrations `001`–`004` are byte-for-byte unchanged from the authorized baseline:

| Migration | SHA-256 at baseline and working tree |
|---|---|
| `001_foundation.sql` | `82e749096e5031687a187caa6743f3c57ac7cff61ba3fb22a6a2c58b8a87ca5d` |
| `002_domain_and_lifecycle.sql` | `4549a0b56157fb7e775e83140c03dbe014bc4f33a156770ca26e27954e049b08` |
| `003_grants_and_rls.sql` | `8285127d87c207e0750844247ef8d5ca6d706fb6b53754a3eb21eab3cb5558dc` |
| `004_identity_membership_resolver.sql` | `c2dc0b6c1934fd8f3bb49e9b5a58a1b1a9cda938eed4872b077193fa160a2522` |

## 4. Idempotency and deferred truth

The implementation imports the existing B3 canonical WorkEvent hash v1 helper. Its field order,
UTC-millisecond normalization, UTF-8 encoding, SHA-256 algorithm/version and golden digest remain
exactly the B1/B3-approved vector.

- Identical WorkEvent content returns the existing Decision without calling Core again or mutating
  a TimeEntry.
- The same Receipt/attempt is idempotent. A new positive attempt may append only one correctly
  mapped Receipt. Receipt metadata collisions return one generic typed conflict.
- Same WorkEvent ID with different canonical content returns a disclosure-safe typed conflict and
  preserves every original row.
- Missing/mismatched foreign configuration returns one generic deferred result without evidence
  rewriting. Exact but inactive current Assignment/Customer state writes only WorkEvent plus
  `LifecycleDeferred` AuditEvent: no CanonicalDecision, TimeEntry mutation or false synchronized
  Receipt.
- Exact active configuration is also deferred with the same truthful evidence-only mapping when
  `occurredAt` predates `Assignment.valid_from`, `Tag.created_at` or `Customer.activated_at`.
- An identical retry of that historical evidence remains deferred without re-running Core. Fixed
  event/configuration timestamps do not become historically valid through passage of server time.
- Revoked/unknown authority is rejected generically. No post-revocation grace, historical
  configuration interpretation or device-clock rule is invented.

The current B3 schema has no Tag active/deactivated state. B6 therefore treats existence as the
current Tag fact, locks the row against deletion and records this as a remaining model boundary.

## 5. Adversarial test evidence

The isolated suite has **67 direct PostgreSQL/JWT tests** and covers:

- all five genuine Core decisions and exact WorkEvent/TimeEntry/Decision/Receipt/Audit mappings;
- Start → Stop → Start, one-active-entry enforcement, same-User serialization and different-User
  independence;
- identical retry without engine re-evaluation, Receipt retry/new attempt, Receipt collision and
  same-ID/different-content conflict;
- rollback after each of the five write stages plus Stop-state rollback preservation;
- cross-tenant and same-Organization cross-User guessed IDs, foreign Assignment/Tag/Customer,
  snapshot mismatches, forged claims/command fields and SQL-injection-shaped input;
- invalid signature, expiry, unknown/revoked binding, revoked Membership and requested-Organization
  mismatch;
- concurrent IdentityBinding/Membership revocation and Assignment/Customer deactivation/Tag
  deletion against held transaction locks;
- all three event-time validity starts for active Assignment/Tag/Customer snapshots;
- retry of temporally invalid evidence without historical reinterpretation or duplicate writes;
- exact role graph, function grants/search paths, direct/DDL/`RESET ROLE` denial, transaction-local
  role/GUC cleanup, lock release and unnamed-query execution;
- migrations `001`–`005`, idempotent migration ledger and canonical hash golden vector.

## 6. Verification results

Local runtime: Node `24.14.0`; direct PostgreSQL `17.10` (Homebrew, ARM64). Tests use only generated
asymmetric keys, local loopback JWKS infrastructure, synthetic credentials and synthetic data.

| Verification | Result |
|---|---|
| `npm ci` from the lockfile | Passed; 565 packages, unchanged baseline of 11 moderate findings |
| B6 tests-inclusive typecheck | Passed |
| B6 direct PostgreSQL tests | 67 passed |
| B6 build | Passed |
| migration `001`–`005` clean apply/rerun/ledger | Passed |
| B3 tests-inclusive typecheck / tests / build | Passed / 125 passed / passed |
| B4 tests-inclusive typecheck / tests / build | Passed / 54 passed / passed |
| B5 tests-inclusive typecheck / tests / build | Passed / 41 passed / passed |
| B1 tests-inclusive typecheck / direct PostgreSQL tests / build | Passed / 39 passed, 2 permitted Supavisor skips / passed |
| Core tests-inclusive typecheck / tests | Passed / 262 passed |
| Mobile typecheck / tests | Passed / 10 passed |
| Root workspace build | Passed |
| `git diff --check` | Passed |

The lockfile contains the new workspace links but no newly introduced third-party package. The
existing audit baseline remains **11 moderate, 0 high, 0 critical** findings and is not modified by
this scope.

## 7. CI and remaining limits

One isolated GitHub Actions job uses Node `24.17.0`, PostgreSQL `17.10-alpine`, `npm ci`, required
Core/schema/B4 builds, clean migration `001`–`005` apply plus rerun/ledger verification, B6
tests-inclusive typecheck, all B6 tests and B6 build. No secret or cloud access is required. GitHub
Actions run `29269282536` passed all six jobs for implementation commit `9531672`.

Remaining gates:

- no HTTP/API, production adapter, cloud/Supabase provisioning, Mobile wiring or batch endpoint;
- no Supavisor-mode validation or production connection/pooling/load proof;
- no post-revocation offline grace/review path, historical Assignment interpretation, clock
  tolerance, administrative correction or reconciliation policy;
- no production personal data until privacy, retention, deletion and backup gates are approved.

Block B6 is completed after Technical Lead, GitHub CI and independent security approval. This
evidence does not approve Block C or any production deployment. Closure and independent finding
dispositions are recorded in the corresponding B6 closure/review artifacts.
