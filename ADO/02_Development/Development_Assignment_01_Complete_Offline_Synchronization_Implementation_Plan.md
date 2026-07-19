# Development Assignment 1 — Complete Offline Synchronization Implementation Plan

Status: **REPOSITORY IMPLEMENTATION PUBLISHED, TECHNICAL-LEAD APPROVED AND ORIGINAL EXACT-HEAD CI
10/10 GREEN — INDEPENDENT IMPLEMENTATION REVIEW RETURNED CHANGES REQUIRED FOR DA1-IMPL-01 (P2);
FOCUSED CORRECTION `c71399a`, TREE `7a159ce`, PUBLISHED AND EXACT-HEAD RUN `29692113159` 10/10
GREEN; INDEPENDENT EXACT-DELTA RE-REVIEW OF FINAL HEAD `767043d`, TREE `19c434a`, APPROVED WITH
ZERO OPEN P0/P1/P2/P3 AND DA1-IMPL-01 CLOSED; COMPLETE FRESH HUMAN PHYSICAL GATE AUTHORIZED ON
ADO HEAD `72dc39e` AND EXACT-HEAD RUN `29692785824`, BUT GATE A FAILED BEFORE LEASE ACTIVATION
WITH DA1-PHYS-01 (P1); FOCUSED CORRECTION `04399fa`, TREE `ecf5e6f`, AND EXACT-HEAD RUN
`29695449737` 10/10 GREEN; INDEPENDENT EXACT-DELTA REVIEW OF HEAD `76be116`, TREE `d320db3`,
AND RUN `29695605706` APPROVED WITH ZERO OPEN P0/P1/P2/P3; DA1-PHYS-01 CLOSED; FAILED GATE A
RETAINED, GATES B–E NOT STARTED; COMPLETE FRESH GATE-A–E RESTART REQUIRES SEPARATE HUMAN
AUTHORIZATION; PRODUCTION, DEPLOYMENT AND DISTRIBUTION NOT AUTHORIZED**
Date: 2026-07-19
Implementation Baseline Commit: `180093091c47a926b5871a27ea8b00fb21b9b4ac`
Implementation Baseline Tree: `73e77b6ca5dfd7671cdd3d77a344168fddff3627`
Architecture: `ADO/01_Architecture/ADR/ADR-0012-complete-offline-synchronization-platform.md`
Authorization:
`ADO/02_Development/Development_Assignment_01_Complete_Offline_Synchronization_Authorization.md`
Independent Implementation Review and Correction Disposition:
`ADO/05_Evidence/Development_Assignment_01_Independent_Implementation_Review.md`
Physical Validation Evidence:
`ADO/05_Evidence/Development_Assignment_01_Physical_Validation_Evidence.md`
Owner: Technical Lead

## 1. Objective and non-negotiable boundary

Implement Workstreams A–E of the Human-accepted ADR-0012 contract in the repository from the exact
authorized baseline. The server remains the only lifecycle authority. Lease, cached configuration,
device sequence, wall/monotonic time, network state and background execution are evidence or
orchestration inputs only.

The implementation stops before production resources/data, deployment, distribution and the Human
Physical Gate. Workstream E in this repository run therefore includes automated/native verification,
Technical-Lead audit, exact-head CI and independent implementation review preparation, but it may
not execute or claim the Human observations in Authorization Section 9.

## 2. Frozen package and module ownership

### 2.1 Shared decision-free contract

Add workspace package `@taptime/offline-sync-contract`:

- `src/constants.ts`: the accepted 12-hour, five-minute, 72-hour, page, projection, queue, body,
  response, retry and background numeric policies;
- `src/types.ts`: closed lease, local-store, queue, server-event, reconciliation and UI-safe result
  unions; lease/item/event wire records contain no token, provider subject, raw UID, client
  decision or provisional TimeEntry;
- `src/canonicalFraming.ts`: length-framed manifest input in exact ADR-0012 field order;
- `src/validation.ts`: canonical UUID, 43-character base64url binding/key, 64-character lowercase
  hexadecimal lookup/digest, ASCII cursor and strict timestamp/size validators;
- `src/vectors.ts`: shared RFC HMAC-SHA-256 vectors and TapTim.e manifest golden vectors.

The package performs no authorization, database access, networking, secure storage or lifecycle
decision.

### 2.2 Server capability package

Add workspace package `@taptime/backend-offline-sync`:

- `OfflineCaptureLeaseCoordinator`: authenticated lease issue and immutable page read;
- `OfflineLifecycleIngestionCoordinator`: one-event FIFO ingestion, exact idempotency, historical
  validation, review-only branch and unchanged Core `BusinessEngine`;
- `OfflineEventReconciliationCoordinator`: tenant-safe exact-ID lost-response recovery;
- `lookupHmac.ts`: Node `createHmac('sha256', key)` over canonical ADR-0009 UTF-8 payload;
- `manifestDigest.ts`: Node SHA-256 over the shared length-framed manifest;
- `types.ts`: narrow coordinator ports and closed results;
- `index.ts`: exports only the three capabilities, contracts and fixed role names.

No coordinator exposes a `Pool`, `PoolClient`, raw query surface, actor record, role selector or
lookup key. The lookup key exists only in the lease-issue stack and is never persisted.

### 2.3 Backend HTTP package

Extend `@taptime/backend-api` with exact routes:

- `POST /v1/offline-capture-leases`
- `POST /v1/offline-capture-leases/page`
- `POST /v1/lifecycle-events/offline`
- `POST /v1/lifecycle-events/reconcile`

Add dependencies named `offlineCaptureLeaseIssuer`, `offlineLifecycleIngestor` and
`offlineEventReconciliationReader`. Runtime configuration adds three distinct URLs:
`offlineLeaseDatabaseUrl`, `offlineEventDatabaseUrl` and
`offlineReconciliationDatabaseUrl`. Their decoded login names must be mutually distinct and
distinct from every existing API login.

Every route verifies a bearer token through its capability. Shared request bodies remain at most
16 KiB. Lease-page responses are at most 64 KiB; every other response is at most 16 KiB. Operation
timeout is ten seconds. Reconciliation accepts 1–25 canonical WorkEvent UUIDs. Lease pages accept
1–100 items and an optional ASCII cursor of at most 256 bytes. Duplicate security-relevant headers,
unknown JSON fields, redirects and unclosed result shapes fail closed.

### 2.4 Mobile infrastructure and orchestration

Add these non-React modules:

- `src/offline/OfflineInstallationIdentityStore.ts`: SecureStore-held 256-bit installation binding,
  separate 32-byte lookup key and SQLCipher key;
- `src/offline/AndroidMonotonicClock.ts`: narrow native boot marker plus
  `SystemClock.elapsedRealtime()` port;
- `src/offline/OfflineCaptureDatabase.ts`: one process-wide SQLCipher actor, integrity/schema
  verification, exclusive transactions, lease generations, append-only queue, retries and
  quarantine;
- `src/offline/LegacyLifecycleEvidenceImporter.ts`: exact E1/E2A v2 and protected-v1
  read-back-before-clear import;
- `src/offline/MobileLookupHmac.ts`: pinned `@noble/hashes` HMAC implementation;
- `src/offline/OfflineCaptureLeaseClient.ts`: strict issue/page transport and atomic generation
  assembly;
- `src/offline/OfflineLifecycleClient.ts`: strict per-event ingestion and exact-ID reconciliation;
- `src/offline/OfflineSyncScheduler.ts`: one single-flight persist-first FIFO scheduler;
- `src/offline/OfflineCaptureCoordinator.ts`: lease refresh, cold-start eligibility, logout and
  authority-rejection transitions;
- `src/offline/registerOfflineBackgroundTask.ts`: module-scope Expo task definition using the same
  scheduler only.

Replace the product one-record path with this database-backed path. React receives only immutable
safe view state and commands. It receives no SQL, key, lookup, raw payload, database row, access
token or evidence mutation capability.

Add a local Expo native module at `apps/mobile/modules/taptime-monotonic-clock` for Android boot and
elapsed-realtime evidence. Configure Expo SQLite with SQLCipher and register the accepted
background-task modules in tracked app configuration.

## 3. Frozen PostgreSQL migration `010`

Add only `apps/backend-schema/migrations/010_complete_offline_synchronization.sql`. Existing
migrations `001`–`009` and their ledger hashes remain byte-for-byte compatible.

### 3.1 Exact tables

The migration adds these exact tables:

- `taptime_server.offline_installations`
- `taptime_server.offline_capture_leases`
- `taptime_server.offline_capture_lease_items`
- `taptime_server.offline_capture_lease_receipts`
- `taptime_server.offline_sync_cursors`
- `taptime_server.offline_event_reconciliations`

All tenant-owned keys and foreign keys are Organization-qualified. Tables use forced RLS.
Installation/lease/item ownership and immutable historical evidence are constrained in PostgreSQL,
not inferred in TypeScript. Lease/items/receipts/reconciliations are append-only; the sync cursor
permits only exact monotonic advancement by one under its executor function.

`offline_installations` stores only the SHA-256 digest of the 43-character installation binding,
never the binding or lookup key. `offline_capture_lease_items` stores only the HMAC lookup and exact
Assignment/NfcTag/target snapshot. `offline_event_reconciliations` binds WorkEvent, Receipt,
installation, lease item, device sequence, closed outcome/review code and optional canonical
Decision mapping with a strict result-shape constraint.

### 3.2 Exact roles

Add and normalize on clean and contaminated installations:

- `taptime_offline_lease_issuer`
- `taptime_offline_event_ingestor`
- `taptime_offline_reconciliation_reader`

Each is `NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS`.
Each receives a separate `NOLOGIN NOINHERIT` function owner with fixed safe `search_path`.
Functions are revoked from `PUBLIC`; only the corresponding executor receives exact `EXECUTE`.
Executor roles have no sibling membership, ownership, DDL, general table grant or arbitrary role
selection.

### 3.3 Transaction functions

Freeze these capability functions:

- `taptime_server.current_offline_actor_matches_v1`
- `taptime_server.lock_offline_active_actor_v1`
- `taptime_server.lock_offline_historical_actor_v1`
- `taptime_server.lock_offline_capture_projection_v1`
- `taptime_server.lock_offline_historical_configuration_v1`
- `taptime_server.has_offline_review_predecessor_v1`
- `taptime_server.read_offline_event_reconciliations_v1`

The Node coordinators retain transaction ownership and Core evaluation. Security-definer functions
exist only for cross-RLS locking or atomic append/advance boundaries that cannot be represented by
ordinary forced-RLS grants.

## 4. Frozen wire and state contracts

### 4.1 Lease issue

Request:

```text
commandId: canonical UUID
installationBinding: 43-character unpadded base64url
lookupKey: 43-character unpadded base64url encoding exactly 32 bytes
```

Ready response header:

```text
leaseId, installationId, identityBindingId, userId, organizationId, membershipId,
membershipRowVersion, role, issuedAt, expiresAt, configurationRevision,
itemCount, serializedBytes, manifestDigest, nextCursor, items[]
```

Each item contains exactly `itemId`, `lookup`, `assignmentId`, `nfcTagId`, `targetType`,
`targetId`, `displayName`. Items are ordered lexicographically by `itemId`. Pagination is bound to
one immutable lease. Duplicate lookup, duplicate item, cross-owner page, changed revision,
incomplete projection, digest mismatch or activation above 4,096 items/4 MiB returns the closed
incomplete/oversize state and preserves the prior unexpired local generation.

### 4.2 Offline event

The request contains the existing server-ready lifecycle command plus:

```text
expectedMembershipId, leaseId, leaseItemId, installationBinding, deviceSequence,
bootMarker, monotonicAnchorMilliseconds, monotonicDeltaMilliseconds,
wallClockAnchor, clockProofVersion, provenanceVersion
```

The event carries exact IDs and physical capture time only. It carries no raw UID, token in the
body, provider identity, role, Organization authority claim, BusinessEngine decision or provisional
TimeEntry.

Closed server results are:

- `synchronized`;
- `review_pending` with exactly one of
  `identity_or_membership_not_current`, `capture_time_out_of_bounds`,
  `automatic_window_elapsed`, `historical_configuration_not_valid`,
  `predecessor_requires_review`;
- `pending` with `sequence_gap`, `lock_retry`, `temporarily_unavailable` and optional bounded
  `retryAfterSeconds` from 1–900;
- `conflict` with `event_content_conflict`, `sequence_content_conflict`,
  `lease_binding_conflict`, `receipt_metadata_conflict`;
- `authority_rejected` with no provider/database detail.

Every durable `synchronized` or `review_pending` result contains exact `workEventId`, `receiptId`
and `deviceSequence`. Local deletion requires all three to match the immutable queue head.

### 4.3 Mobile local state

SQLite schema version 1 contains owner/installation, assembling and active lease generations,
lease items, immutable queued events, scheduler metadata and protected quarantine. The queue state
is one of `pending`, `in_flight`, `retry_wait`, `protected_review_predecessor`. Startup changes
`in_flight` back to `pending` transactionally.

Append allocates the next sequence and enforces at most 256 unresolved events, 4 KiB serialized
event bytes and 1 MiB total unresolved bytes in the same exclusive transaction. It never edits,
overwrites or evicts evidence. Missing key with existing database, wrong key, failed cipher
integrity, unknown schema, corrupt row, impossible sequence or ambiguous migration enters a
protected state without deletion.

### 4.4 Scheduler

All runtime-start, session-restore, foreground, append, network-hint, manual and background triggers
enter one process-wide single-flight scheduler. It submits only the queue head. A later event never
bypasses a pending or review predecessor.

Retry uses full jitter over `min(5 minutes, 2 seconds * 2^attempt)` and honors a valid server
`Retry-After` of 1–900 seconds exactly. Network state is a hint only. Background registration has
an Android minimum interval of 15 minutes and makes no latency or delivery guarantee.

## 5. Implementation sequence

1. Create this plan and synchronize implementation authority truth.
2. Add the shared contract package and golden cryptographic/manifest vectors.
3. Add migration `010`, fixtures, ledger/inventory checks and the complete RLS/role matrix.
4. Add the backend offline package with lease, ingestion and reconciliation coordinators.
5. Add the four API routes, separate runtime pools and strict response/body handling.
6. Install the exact Expo-compatible dependency set and verify the lockfile/dependency graph.
7. Add the SQLCipher store, SecureStore identity/key lifecycle, legacy import and native clock.
8. Add lease transport/activation, persist-first scan path, single-flight scheduler and background
   composition.
9. Update safe UI states without exposing authority/evidence internals.
10. Run the complete automated/native/adversarial matrix and repeated race/fault tests.
11. Perform a complete-delta Technical-Lead architecture/security audit.
12. Commit/push only the approved repository scope, verify exact-head CI and provide the independent
    implementation-review prompt.
13. Stop. The Human Physical Gate requires a later distinct Human authorization after independent
    implementation approval and green exact-head CI.

## 6. Verification matrix

The final implementation head must run and report:

- shared HMAC/manifest golden vectors in Node and Mobile;
- Core complete tests and tests-inclusive typecheck;
- Mobile complete tests and proven tests-inclusive typecheck;
- pure database/queue/lease/session/scheduler state-machine suites;
- actual Android SQLCipher/native-clock migration, integrity and transaction tests;
- PostgreSQL 17 clean install, rerun, contaminated-role, ledger/hash, forced-RLS and
  least-privilege matrices;
- complete identity/read-model/lifecycle/administration/API regressions;
- offline lease/event/reconciliation PostgreSQL/JWT adversarial integration;
- Admin Web, Administration Contract and synthetic Android E2E regressions;
- extended multi-event offline/restore/automatic-sync synthetic path;
- all builds/declaration bundles, Admin Web production build and Android export/custom build;
- `npm ls`, dependency/lockfile/license/integrity review;
- `git diff --check`, migration inventory, generated-tree cleanliness and scoped secret/raw-UID
  scans;
- repeated targeted concurrency, retry, lost-response and injected-write-failure tests.

No test count may be copied from the baseline. Any skipped or unavailable native check must be
reported as an open implementation blocker, not described as passing.

## 7. Stop conditions

Stop and escalate before continuing if implementation would require:

- changing an accepted numeric policy or authority boundary;
- a client lifecycle decision, provisional TimeEntry or raw UID in transport/persistence;
- automatic deletion, eviction, rebinding or reinterpretation of unresolved evidence;
- automatic adjudication of E1/E2A/protected-v1 evidence;
- a broad database grant, shared offline runtime login or request-selected role;
- production resources/data, deployment, distribution or Human Physical Gate execution;
- a business rule outside unchanged Core `BusinessEngine` behavior.

## 8. Closure truth

Repository implementation success alone will not close Development Assignment 1. The separately
authorized fresh Human Physical Gate failed at Gate A before lease activation with
`DA1-PHYS-01` (P1): the exact APK reproduced SQLCipher page-1 HMAC/decryption failure on clean
first start before authentication. Gates B–E were not started. Focused correction `04399fa`, tree
`ecf5e6f`, passes native first start, encrypted cold reopen, protected wrong/missing-key handling,
the explicit Android backup/transfer boundary and exact-head run `29695449737` ten of ten.
Independent exact-delta review of head `76be116`, tree `d320db3`, and exact-head run
`29695605706` returned `APPROVED` with zero open P0/P1/P2/P3 and closed `DA1-PHYS-01`.
Closure still requires a separately authorized complete fresh Gate-A–E run, truthful physical
evidence synchronization and independent final closure review.
