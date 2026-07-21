# Development Assignment 1 — Complete Offline Synchronization Implementation Plan

Status: **REPOSITORY IMPLEMENTATION PUBLISHED, TECHNICAL-LEAD APPROVED AND ORIGINAL EXACT-HEAD CI
10/10 GREEN — INDEPENDENT IMPLEMENTATION REVIEW RETURNED CHANGES REQUIRED FOR DA1-IMPL-01 (P2);
FOCUSED CORRECTION `c71399a`, TREE `7a159ce`, PUBLISHED AND EXACT-HEAD RUN `29692113159` 10/10
GREEN; INDEPENDENT EXACT-DELTA RE-REVIEW OF FINAL HEAD `767043d`, TREE `19c434a`, APPROVED WITH
ZERO OPEN P0/P1/P2/P3 AND DA1-IMPL-01 CLOSED; COMPLETE FRESH HUMAN PHYSICAL GATE AUTHORIZED ON
ADO HEAD `72dc39e` AND EXACT-HEAD RUN `29692785824`, BUT GATE A FAILED BEFORE LEASE ACTIVATION
WITH DA1-PHYS-01 (P1); FOCUSED CORRECTION `04399fa`, TREE `ecf5e6f`, AND EXACT-HEAD RUN
`29695449737` 10/10 GREEN; INDEPENDENT EXACT-DELTA REVIEW OF HEAD `76be116`, TREE `d320db3`,
AND RUN `29695605706` APPROVED WITH ZERO OPEN P0/P1/P2/P3; DA1-PHYS-01 CLOSED; SECOND FRESH
GATE A FAILED AT STEP 4 WITH DA1-PHYS-02 (P1); FOCUSED CORRECTION `e17fcb3` PLUS CROSS-IDENTITY
HARDENING `869e10f`, FINAL TREE `325fdd5`, PUBLISHED AND EXACT-HEAD RUNS `29696949408` AND
`29697397146` EACH 10/10 GREEN; INDEPENDENT EXACT-DELTA REVIEW OF HEAD `8d1a0d8`, TREE
`3464697`, APPROVED WITH ZERO OPEN P0/P1/P2/P3; DA1-PHYS-02 REPOSITORY FINDING CLOSED; THIRD
COMPLETE FRESH PHYSICAL GATE AUTHORIZED AND EXECUTED; GATES A–C PASSED, GATE D FAILED
MANDATORY MOBILE REVIEW-STATE TRUTH WITH DA1-PHYS-03 (P1), GATE E NOT STARTED; FOCUSED
CORRECTION `7dbda3b`, TREE `e6abc9e`, PUBLISHED AND EXACT-HEAD RUN `29700339367` 10/10 GREEN;
INDEPENDENT EXACT-DELTA REVIEW OF HEAD `798bada`, TREE `d181370`, APPROVED WITH ZERO OPEN
P0/P1/P2/P3; DA1-PHYS-03 REPOSITORY FINDING CLOSED; FOURTH COMPLETE FRESH GATE AUTHORIZED
ON PRODUCT `7dbda3b`, REVIEWED ADO `798bada`, SYNCHRONIZATION HEAD `73b5105` AND RUN
`29714165784`; GATE A STEPS 1–4 PASSED BUT STEP 5 FAILED AFTER THREE NATIVE NFC DELIVERIES
LEFT THE LOCAL QUEUE AT ZERO; FAILURE SYNCHRONIZATION `3dd7983`/`e78b526` AND RUN
`29716007657` INDEPENDENTLY APPROVED; FOCUSED CORRECTION `48a21a7`, TREE `7c053be`,
TECHNICAL-LEAD APPROVED, PUBLISHED AND EXACT-HEAD RUN `29743923158` 10/10 GREEN;
ADO PUBLICATION `2f6035b`, TREE `d5513a6`, AND RUN `29744637928` 10/10 GREEN; INDEPENDENT
EXACT-DELTA CORRECTION REVIEW APPROVED WITH ZERO OPEN P0/P1/P2/P3; DA1-PHYS-04 REPOSITORY
FINDING CLOSED; AT THAT POINT NO CORRECTED PHYSICAL RESULT; DA1-ARTIFACT-01 REBINDING REVIEW APPROVED AND
NEW FIFTH COMPLETE FRESH GATE HUMAN-AUTHORIZED ON ADO/ARTIFACT HEAD `e0fd175`, EXACT-HEAD RUN
`29747561139` AND REPLACEMENT APK SHA-256 `4239f6c6…6b7c`; EXACT PRE-INSTALL AND DEVICE
BINDING PASSED, BUT GATE A FAILED DURING STEP 1 BEFORE LOGIN BECAUSE THE APK OMITTED THE REQUIRED
SYNTHETIC AUTH URL, API URL AND PUBLISHABLE KEY; DA1-ARTIFACT-02 (P1 OPERATIONAL) OPEN; GATES
B–E NOT STARTED; COMPLETE ABORT CLEANUP PASSED; FOCUSED CORRECTION `0fdddbc`, TREE
`62b5efc`, TECHNICAL-LEAD APPROVED, PUBLISHED AND EXACT-HEAD RUN `29751390803` 10/10 GREEN;
AT THAT POINT UNINSTALLED RUNTIME-COMPLETE 95,425,695-BYTE APK SHA-256 `aa081fca…5ffbf` PRESERVED;
INDEPENDENT FINAL REVIEW OF ADO HEAD `1527855`, TREE `1bc2511`, APPROVED WITH ZERO OPEN
P0/P1/P2/P3 AND CLOSED DA1-ARTIFACT-02; RUN `29752205717` ATTEMPT 2 10/10; SIXTH COMPLETE
FRESH HUMAN GATE SEPARATELY AUTHORIZED ON REVIEW-SYNCHRONIZATION `0e2590b`, TREE `23fc9d3`, RUN
`29830332699` AND EXACT RUNTIME-COMPLETE APK; GATES A–E PASSED AFRESH; COMPLETE CLEANUP PASSED;
PHYSICAL EVIDENCE `8d5b2bb`, TREE `592f9da`, AND EXACT-HEAD RUN `29836085810` 10/10;
INDEPENDENT FINAL CLOSURE REVIEW APPROVED WITH ZERO OPEN P0/P1/P2/P3; DA1 AND DT-060–DT-062
CLOSURE APPROVED FOR THE AUTHORIZED LOCAL SCOPE; CLOSURE-PUBLICATION EXACT-HEAD CI PENDING;
PRODUCTION, PRODUCTION DATA, DEPLOYMENT AND DISTRIBUTION NOT AUTHORIZED**
Date: 2026-07-21
Implementation Baseline Commit: `180093091c47a926b5871a27ea8b00fb21b9b4ac`
Implementation Baseline Tree: `73e77b6ca5dfd7671cdd3d77a344168fddff3627`
Architecture: `ADO/01_Architecture/ADR/ADR-0012-complete-offline-synchronization-platform.md`
Authorization:
`ADO/02_Development/Development_Assignment_01_Complete_Offline_Synchronization_Authorization.md`
Independent Implementation Review and Correction Disposition:
`ADO/05_Evidence/Development_Assignment_01_Independent_Implementation_Review.md`
Physical Validation Evidence:
`ADO/05_Evidence/Development_Assignment_01_Physical_Validation_Evidence.md`
DA1-PHYS-01 Independent Exact-Delta Review:
`ADO/05_Evidence/Development_Assignment_01_DA1_PHYS_01_Independent_Exact_Delta_Review.md`
DA1-PHYS-02 Independent Exact-Delta Review:
`ADO/05_Evidence/Development_Assignment_01_DA1_PHYS_02_Independent_Exact_Delta_Review.md`
DA1-PHYS-03 Independent Exact-Delta Review:
`ADO/05_Evidence/Development_Assignment_01_DA1_PHYS_03_Independent_Exact_Delta_Review.md`
DA1-PHYS-04 Failure-Synchronization Independent Exact-Delta Review:
`ADO/05_Evidence/Development_Assignment_01_DA1_PHYS_04_Failure_Synchronization_Independent_Exact_Delta_Review.md`
DA1-ARTIFACT-02 Independent Exact-Delta and Artifact Final Review:
`ADO/05_Evidence/Development_Assignment_01_DA1_ARTIFACT_02_Independent_Exact_Delta_Artifact_Review.md`
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

SQLite schema version 2 contains owner/installation, assembling and active lease generations,
lease items, immutable queued events, scheduler metadata and protected quarantine. The queue state
is one of `pending`, `in_flight`, `retry_wait`, `protected_review_predecessor`. Startup changes
`in_flight` back to `pending` transactionally.

Version 2 migrates version 1 exclusively and adds only a nullable, owner-bound
`review_pending_sequence`. A durable review acknowledgement writes the earliest sequence and
deletes the exact FIFO head atomically. The marker is not an authority input or local
adjudication; it exists solely so later session/lease/foreground/restart paths cannot falsely
replace a mandatory review warning with a ready state.

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
The Human Architect then authorized a complete fresh restart on product `04399fa`, ADO head
`fb4a4e4` and exact-head run `29696026676`. Gate A obtained a complete two-item Employee lease,
then failed at step 4 after airplane-mode force-stop/relaunch without Auth/API reachability: the app
showed `TapTim.e ist derzeit nicht verfügbar` instead of the explicit offline-capture state.
No tag was scanned, lifecycle mutation counts remained zero and Gates B–E were not started.
Focused correction `e17fcb3f1286095c345e6a4ce965790361901099`, tree
`44320bc8bb5a25b71300c03d8d50c5a8561ebf0a`, suspends access credentials on transient provider
refresh failure, retains only the stored refresh path for retry, admits the offline shell only
behind `context_unavailable` plus an independently eligible local capture state, and orders
foreground/network session restoration before synchronization scheduling. Cross-identity
hardening `869e10f7d54e1c16a60a06a4b37ccedc5d0bfac1`, tree
`325fdd5b003e1bccaee15eeac6b0b82826316554`, additionally gates local-lease restoration on stored
startup credentials or a previously resolved authenticated context, so explicit new login plus
backend unavailability cannot open an old lease. Mobile passes 406/406 in 29 files with 93/93
focused regressions, required Workspace typechecks/builds and Android export/native release build
pass, and exact-head runs `29696949408` and `29697397146` each passed ten of ten jobs.
Independent exact-delta review bound final head `8d1a0d86539790028526e8d62c1f867c1b68fe57`,
tree `3464697130900ed55e68acc02e5fb5af41db90a5`, the complete five-commit chain, 17-file
+515/-75 delta and all four exact-head ten-job runs. Verdict `APPROVED`, zero open P0/P1/P2/P3;
`DA1-PHYS-02` is closed as a repository finding. Closure still requires another separate Human
authorization, a complete fresh Gate-A–E run, truthful physical evidence synchronization and
independent final closure review.

That separate third-run authorization was later granted against product `869e10f`, reviewed ADO
head `8d1a0d8`, synchronization head `bc89c70`, exact-head run `29697976617` and the exact
hash-bound APK. Gates A–C passed. Gate D preserved server-canonical safety but failed the mandatory
Mobile truth requirement: after durable review acknowledgements deleted their exact queue rows,
later session/lease restoration displayed `Bereit zum Scannen` although the server still held an
unresolved review predecessor. `DA1-PHYS-03` was opened as P1; Gate E was not started and full
abort cleanup passed.

Focused correction `7dbda3bc0a56009c7e6931e3ad8320514f64f4a8`, tree
`e6abc9ebaadc70cf4b2f78caa46f332b3fb21309`, implements the version-2 durable marker described
in Section 4.3 and makes it dominate scheduler/coordinator ready states fail-closed. Mobile passes
409/409 in 29 files; all required local verification and the 690-task native release build pass;
exact-head run `29700339367` passed ten of ten jobs. Independent exact-delta review remains
mandatory before the repository finding can close. No corrected physical result or fourth-run
authorization was claimed at that point.

Independent exact-delta review subsequently bound predecessor `bc89c70`, product correction
`7dbda3b`, final reviewed ADO head `798bada`, tree `d181370`, the exact 14-file +557/-63 delta and
exact-head runs `29700339367` and `29700546787`, each attempt 1 and ten of ten green. Verdict:
`APPROVED`, zero open P0/P1/P2/P3. `DA1-PHYS-03` is closed as a repository finding.

The Human Architect subsequently authorized the fourth complete fresh Gate A–E run bound to
product `7dbda3bc0a56009c7e6931e3ad8320514f64f4a8`, reviewed ADO head
`798bada77a4fbc7ba235bc692afcf3bd9ffc760b`, review-synchronization head
`73b5105ba23f667c2a6ee0f12fce171da85bb036`, exact-head run `29714165784` and the exact
95,422,571-byte candidate APK SHA-256
`e634f03a0eedf43a3c1d2d7d94213c223ea13c627556e641e39c9d08c4f93623`.

A technical preflight with an unnecessary legacy fixture-only control was fully discarded and
verified clean before the counted run. Real Administrator setup, exact Employee artifact and lease,
and cold true-offline entry passed Gate A steps 1–4. Gate A step 5 failed: Android delivered three
separate physical NFC captures through native registration, `TECH_DISCOVERED`/`onNewIntent`,
resume and unregistration, but Mobile remained at zero pending and the server remained at zero
lifecycle mutations.

Read-only diagnosis opens `DA1-PHYS-04` as P1. NFC foreground dispatch causes the scheduling
lifecycle to retry the suspended provider context. The expected offline failure republishes the
same semantic session state; the coordinator nevertheless advances its generation and invalidates
the already delivered capture before lookup/append. The focused correction must suppress only
that semantically unchanged cancellation and must preserve logout, cross-identity, owner/install,
storage-failure and stale-async fail-closed behavior. Public `context_unavailable` status equality
alone is insufficient; unchanged identity/restoration generation must be proven from private
trusted evidence and uncertainty must still cancel. A regression must compose offline-ready
capture, Android pause/resume, failed context retry and exactly one durable append/queue increment.

Gate A failed, Gates B–E were not started, no observation may be reused and complete abort cleanup
passed. Before any later complete physical run, the previously used disclosure-safe Gate-C
response-drop procedure must be committed as a durable reviewed operator runbook or helper. No
product correction, fifth gate, production resource/data, deployment or distribution is
authorized by this synchronization.

Independent review of failure-synchronization head `3dd7983`, tree `e78b526`, and exact-head run
`29716007657` returned `APPROVED` with no P0–P3 against the truth, diagnosis, P1 classification
or correction boundary. The Human Architect then separately authorized the focused correction on
that exact baseline; `DA1-PHYS-04` remained open.

The Technical-Lead-approved correction adds a private offline-restoration snapshot
containing only session generation, restoration revision and trusted unavailable source. It
preserves an active offline capture only across a publication for which that private snapshot is
still exact, retains the expected complete active owner/install/lease context and revalidates
before durable append. Credential, source, authority, storage, logout, cross-identity,
owner/install and genuinely stale changes still invalidate fail-closed. No public
`context_unavailable` equality, local authority, new decision or numeric-policy change is added.

Regression evidence is Mobile 415/415 in 30 files, focused Mobile 63/63 and a hardened four-test
lifecycle subset repeated twenty times at 4/4. The fixed Gate-C one-shot proxy, scoped reverse
controller, recovery command and operator runbook pass 27/27 focused tests; a fresh
PostgreSQL-17 Harness passes 45/45 in four files with tests-inclusive typecheck/build. Core
290/290, Admin Web 44/44, both contracts 7/7 and 4/4, Backend Offline 13/13, Backend API 208/208,
Workspace checks/builds, migration apply/rerun/ledger verification, Android export, 656-task
synthetic release and backup-boundary verifier pass. The uninstalled 95,425,607-byte APK SHA-256
is `b34572b9813c4fb8013b09a4a530e5bc88ed4730ceacda46f6fe682bca88c6c0`. The existing 11
moderate transitive `uuid@7.0.3` toolchain advisory occurrences remain truthfully reported.

The correction is published as commit
`48a21a7ed75c3ab3b15fec93669b5ca2d87d5a30`, tree
`7c053beeb0c9ef550216bd1dad0a59fc226866a6`, parent
`3dd798376180051c0dbd8d9e4ee058acff89b43f`, in an exact 24-file `+3027/-37` delta.
GitHub Actions run `29743923158`, attempt 1, push to `main`, passed all ten exact-head jobs.
ADO publication head `2f6035b1da9e7946cfca8d10c3d406a8c0b852ec`, tree
`d5513a6ec2fe99c4f2b6fae9b3452004453b965b`, passed exact-head run `29744637928`, attempt 1,
ten of ten.

Independent exact-delta correction review returned `APPROVED` with zero open P0/P1/P2/P3 and
closed `DA1-PHYS-04` as a repository finding. No corrected physical result exists. That review
made a fifth complete fresh Gate A–E run eligible for separate Human authorization; the later
authorization and artifact blocker are recorded below.

Correction review:
`ADO/05_Evidence/Development_Assignment_01_DA1_PHYS_04_Independent_Exact_Delta_Review.md`.

The Human Architect subsequently authorized the fifth complete fresh gate against the reviewed
chain and exact APK hash. Pre-install verification found that exact binary was no longer
available, so no installation or physical observation began. The exact-size replacement APK
SHA-256 `4239f6c609430d3926dbfc053c7ad0688a4022903eef8a3ffe1ebeece2356b7c` is preserved
read-only outside the repository but is not covered by that authorization.

At that historical point, `DA1-ARTIFACT-01` was an operational P1 blocker and the plan returned to
the artifact-review gate. Its later review, authorization and superseding result are recorded in
Section 9.

## 9. Current artifact correction gate

The `DA1-ARTIFACT-01` synchronization was published as `e0fd175`, tree `fed47cf`, and passed
exact-head run `29747561139` ten of ten. Independent rebinding review returned `APPROVED` with
zero open P0/P1/P2/P3, and the Human Architect separately authorized the replacement-hash-bound
fifth complete fresh gate.

The exact 95,425,607-byte APK SHA-256 `4239f6c6…6b7c` passed immediate host/device identity,
signature, package/version and backup-boundary verification. It nevertheless failed Gate A during
step 1 before login. Its Hermes bytecode lacks both required numeric-loopback URLs and the required
publishable key even though the unchanged repository build script declares them. The application
failed closed, all sanitized mutable server counts remained zero and full abort cleanup passed.

This opens `DA1-ARTIFACT-02` as an operational P1. No product-source correction is authorized or
implied. The next bounded work must:

1. preserve the failed artifact unchanged;
2. identify and constrain the artifact-generation path that lost the three compile-time values;
3. produce a new exact-source release only through an audited single invocation;
4. fail the build or pre-install gate unless deterministic Hermes inspection proves the exact Auth
   URL, API URL and publishable key are embedded;
5. repeat package, signature, backup-boundary, host/device size/hash and clean-launch verification;
6. publish focused evidence and obtain exact-head CI plus independent artifact review; and
7. obtain a new separate Human authorization before restarting the complete Gate A–E sequence.

Gates B–E remain not started. No observation from any prior run may be reused.

### Focused correction execution

Independent review approved failure synchronization `d6cc071`, tree `765b8a2`, exact-head run
`29749902585` and the focused correction boundary. The Human Architect separately authorized only
that correction.

Technical-Lead-approved commit `0fdddbc`, tree `62b5efc`, parent `d6cc071`, implements the
bounded correction in exactly nine Mobile build/script/test files (`+240/-10`):

- one frozen exact synthetic runtime contract is shared by the build and verifier;
- the audited release uses a fresh Gradle process and clean task graph;
- the build fails unless deterministic Hermes inspection proves both exact numeric-loopback URLs
  and the exact publishable key inside exactly one Android bundle;
- the installer repeats the same verification before any ADB/device action; and
- regression tests reject every individual missing value and preserve composition enforcement.

The retained failed APK is rejected for all three missing values. Core 290/290, Mobile 419/419,
Admin Web 44/44, Offline Contract 7/7, applicable tests-inclusive typechecks/builds and two clean
native releases pass. Exact-head run `29751390803`, attempt 1, passed ten of ten.

The exact-source runtime-complete release is preserved read-only and uninstalled at 95,425,695
bytes with SHA-256
`aa081fca431174cf90698b4afaaa5c1f5f28ed976c54cda7a74df72a49d5ffbf`.
Package/version, APK-v2 signature, offline backup/transfer boundaries and all three Hermes values
pass. The failed APK remains separately unchanged.

Independent final review bound correction `0fdddbc`, tree `62b5efc`, publication head `1527855`,
tree `1bc2511`, and exact-head runs `29751390803` attempt 1 plus `29752205717` attempt 2. It
returned `APPROVED` with zero open P0/P1/P2/P3 and closed `DA1-ARTIFACT-02`. The reviewer
independently reproduced Mobile 419/419 but transparently could not mount the two external APKs.
The Technical Lead subsequently reverified both exact immutable local artifacts, the failed
artifact's three-value rejection and the corrected artifact's Hermes contract, v2 signer,
package/version and manifest backup bindings.

The Human Architect then separately authorized the sixth complete fresh Gate A–E run on exact
review-synchronization `0e2590b`, tree `23fc9d3`, exact-head run `29830332699` and the exact
runtime-complete artifact. Immediate host/device binding passed and all five gates passed afresh:
cold true-offline A→B→A persistence; automatic FIFO; lost-response idempotency; stale-cutover
review truth that remained dominant after queue zero and restart; one native background worker from
two immediate development-only triggers without mutation; safe sign-out and complete cleanup.

Physical evidence publication `8d5b2bb`, tree `592f9da`, passed exact-head run `29836085810`,
attempt 1, ten of ten. Independent final closure review returned `APPROVED` with zero open
P0/P1/P2/P3. The implementation plan and every Acceptance Section 10 condition are satisfied for
the authorized local Android/repository/synthetic-server scope; DA1 and DT-060–DT-062 close after
green exact-head CI for the final documentation-only closure publication. Production resources/data,
deployment and distribution remain unauthorized.
