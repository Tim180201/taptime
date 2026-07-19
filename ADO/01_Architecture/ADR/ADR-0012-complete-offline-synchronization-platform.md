# ADR-0012: Complete Offline Synchronization Platform

Status: **ACCEPTED BY HUMAN ARCHITECT; EXACT-BASELINE REPOSITORY IMPLEMENTATION PUBLISHED,
TECHNICAL-LEAD APPROVED AND ORIGINAL EXACT-HEAD CI 10/10 GREEN — INDEPENDENT IMPLEMENTATION
REVIEW RETURNED CHANGES REQUIRED FOR DA1-IMPL-01 (P2); FOCUSED CORRECTION `c71399a`, TREE
`7a159ce`, PUBLISHED AND EXACT-HEAD RUN `29692113159` 10/10 GREEN; INDEPENDENT EXACT-DELTA
RE-REVIEW OF FINAL HEAD `767043d`, TREE `19c434a`, APPROVED WITH ZERO OPEN P0/P1/P2/P3 AND
DA1-IMPL-01 CLOSED; SEPARATE HUMAN PHYSICAL GATE AUTHORIZATION MAY BE REQUESTED BUT IS NOT YET
GRANTED; PRODUCTION, DEPLOYMENT AND DISTRIBUTION NOT AUTHORIZED**
Date: 2026-07-19
Candidate Baseline Commit: `1bb2d7d7b38928643cfd5c86b36c500c35f73276`
Candidate Baseline Tree: `c5c20f67155cdc0b4197908b4d1283cb7e619597`
Independently Reviewed Candidate Commit: `592334160655cde2f4189712eaf327c8a7edcb0e`
Independently Reviewed Candidate Tree: `96fffb5bb5e2793041c36b8f793c38ab1c2e5428`
Human Acceptance Date: 2026-07-18
Roadmap: Comprehensive Development Assignment 1; completes the intended product scope of
DT-060–DT-062 if every gate below passes
Owner: Technical Lead
Decision Authority: Human Architect
Related Authorities: ADR-0004, ADR-0006, ADR-0008, ADR-0009, ADR-0010, B6, C1/C2, D, E1, E2A,
C3E1 and C3E2 closures
Authorization Candidate:
`ADO/02_Development/Development_Assignment_01_Complete_Offline_Synchronization_Authorization.md`
Independent Review Evidence:
`ADO/05_Evidence/Development_Assignment_01_Independent_Pre_Implementation_Review.md`
Implementation Authority: **Granted for repository Workstreams A–E on commit
`180093091c47a926b5871a27ea8b00fb21b9b4ac`, tree
`73e77b6ca5dfd7671cdd3d77a344168fddff3627`**
Implementation Plan:
`ADO/02_Development/Development_Assignment_01_Complete_Offline_Synchronization_Implementation_Plan.md`
Implementation Evidence:
`ADO/05_Evidence/Development_Assignment_01_Implementation_Evidence.md`
Independent Implementation Review and Correction Disposition:
`ADO/05_Evidence/Development_Assignment_01_Independent_Implementation_Review.md`

## Context

TapTim.e currently has two deliberately narrow offline foundations:

- E1 persists exactly one already-resolved server-ready lifecycle command in SecureStore before
  transmission.
- E2A permits one volatile same-session/same-payload scan-context fallback. Its dedicated
  defer-only endpoint can durably store WorkEvent, `received` SyncReceipt and Audit evidence, but
  intentionally creates no CanonicalDecision or TimeEntry mutation.

The product runtime therefore cannot yet capture multiple events, resolve tags after a cold start,
retry automatically, synchronize in the background, process events in a durable order or reconcile
historical configuration safely. The legacy Core `OfflineQueue` and `SynchronizationService` are
prototype/CLI components: their record contains a client BusinessEngineDecision, their concrete
network gateway is fake, and they are not composed into the product Mobile authority path. They
must not be promoted into the product path.

The next assignment must complete the offline/synchronization platform without moving Start/Stop
authority to the device. It must also remain truthful about the limits of mobile clocks, platform
background execution, device compromise and app uninstall.

## Decision candidate

### 1. Authority and user-visible meaning

1. The server remains the only source of Membership, Organization, Assignment, target and
   Start/Stop/duplicate/rejection decisions.
2. Every product scan is persisted locally before its first lifecycle transmission, including an
   online scan. If an older event is pending for the same offline owner, later scans join the same
   FIFO queue and cannot bypass it through the canonical online route.
3. An offline scan is presented only as locally saved/pending. Mobile must never claim that work
   started or stopped until an exact server acknowledgement carries the canonical decision.
4. Network state, cached configuration, a lease, device time, route selection and a client sequence
   are evidence and orchestration inputs only. None grants authority.
5. A modified/rooted device, copied local key or fabricated NFC input is outside the physical-proof
   guarantee. The server still applies tenant, identity, lease, configuration, time and idempotency
   checks; this ADR does not claim device attestation.

### 2. Server-issued offline capture lease

After a fully authenticated C1/C2 session, a new authenticated lease projection endpoint may issue
one active offline capture lease for the exact installation, User, Organization, Membership and
role. The server persists the lease and its immutable item manifest.

The lease contract is fixed as follows:

- server-generated UUID lease ID and an opaque client-generated 256-bit installation binding that
  is registered only through the authenticated lease request;
- exact IdentityBinding ID, User, Organization, Membership, Membership `rowVersion` and role;
- server `issuedAt` and `expiresAt`, with a **12-hour capture lifetime**;
- immutable configuration revision and item-manifest digest;
- exact Assignment, NFC Tag and target IDs plus safe display projection for each eligible item;
- a random per-installation lookup key generated on Mobile and held only in SecureStore; the
  authenticated lease request submits its exact 32 bytes transiently so the server can compute the
  projection lookup values, but the key is neither authority nor persisted/logged server-side;
- a full HMAC-SHA-256 lookup value and server-generated UUID lease-item ID per canonical NFC
  payload;
- no access/refresh token, raw provider subject, raw UID or server credential in SQLite;
- strict paginated projection of at most 100 items per page, one revision/lease across all pages,
  duplicate rejection and atomic activation only after the final manifest/count/digest matches;
- a hard client activation limit of 4,096 items and 4 MiB serialized projection data. Oversize or
  incomplete projections fail closed and leave the prior unexpired lease intact.

The server computes and persists only HMAC-SHA-256 lookup values for the lease projection, using
the transient client-generated lookup key. The device computes the same HMAC over the captured
canonical ADR-0009 payload using its SecureStore key and resolves only an exact full-length match.
The exact lookup contract is HMAC-SHA-256 over the UTF-8 bytes of the canonical payload, encoded as
64 lowercase hexadecimal characters. A duplicate lookup value inside one lease makes lease issue
unavailable; it is never resolved by first-match behavior.

Lease items are ordered lexicographically by lease-item UUID. The manifest digest is lowercase
SHA-256 over the complete ordered item stream using the existing unambiguous UTF-8 byte-length
framing pattern, with fields in this order: lease-item ID, lookup value, Assignment ID, NFC Tag ID,
target type, target ID and approved display name. Page boundaries are not part of the digest.
The raw UID exists only during NFC capture/HMAC computation, server-side lease-HMAC construction and
the already authorized live scan-context request; it is never written to SQLite, SecureStore, logs,
UI, Audit or the offline lifecycle body. Mobile HMAC uses pinned `@noble/hashes` and shared RFC test
vectors; the server uses Node's native `createHmac`, and cross-runtime contract tests must match
byte-for-byte.

Lease refresh is attempted while authenticated when less than 30 minutes remain. A new generation
is assembled separately, then atomically replaces the prior active projection. Configuration
changes do not make a device authoritative: the server revalidates the exact historical
configuration during ingestion.

### 3. Cold-start offline identity boundary

Mobile may enter an explicit `offline_capture` state after process/device restart only when all of
the following hold:

- the last product session was fully authenticated and produced an unexpired exact lease;
- refresh/context restoration failed with a typed transient transport condition, not authority
  rejection, malformed response or unknown failure;
- SecureStore and the encrypted database are available and their owner/generation bindings match;
- no explicit logout marker invalidated offline capture;
- the current server time cannot be read, so lease validity is checked against the persisted
  server-issued time anchor, Android boot marker and `SystemClock.elapsedRealtime()` sample through
  a narrow native clock port plus the wall-time consistency checks described below.

This state exposes only NFC capture and queue status. It exposes no Admin capability, lease secret,
token, raw UID, Membership administration or server-derived Start/Stop state.

Explicit logout immediately disables new offline capture and removes the active lookup key. Pending
records remain encrypted and bound to their original owner; another identity cannot inspect,
rebind, retry, replace or delete them. A different identity remains blocked until the original
queue has received exact durable server acknowledgements or the separately defined destructive
recovery flow is completed after reauthentication and explicit Human confirmation.

Provider/identity or Membership authority rejection invalidates new capture immediately. It never
silently erases queued evidence.

### 4. Time and revocation policy

Device wall time is untrusted. On Android, a narrow native clock port records a boot marker and
`SystemClock.elapsedRealtime()` at lease activation and capture. Unlike a JavaScript
process-relative performance clock, this survives force-stop/process restart within the same boot.
The product records both the physical capture timestamp already provided by the NFC adapter and the
native monotonic delta relative to the server-issued lease anchor. A changed boot marker or
decreasing monotonic value does not discard the scan, but marks its clock proof unverified and makes
it review-only. The following numeric policy is proposed for Human acceptance:

- capture timestamp must fall no earlier than five minutes before lease `issuedAt`;
- capture timestamp must fall no later than five minutes after lease `expiresAt`;
- monotonic and wall-clock deltas may differ by at most five minutes;
- automatic evaluation requires the same boot marker and a non-decreasing native monotonic sample;
- automatic canonical evaluation is permitted only when the server receives the event no later
  than 72 hours after lease expiry;
- a later event may still be stored durably as review evidence, but cannot mutate a TimeEntry;
- Membership and identity binding must have existed at capture time;
- current active identity binding and exact current Membership are required for automatic
  evaluation;
- post-revocation upload may use only the isolated evidence-intake branch and can never create a
  CanonicalDecision or TimeEntry.

These values are product/security policy, not implementation details. Independent review must
challenge them explicitly and the Human Architect must accept them before implementation.

### 5. Encrypted transactional Mobile store

The product Mobile path replaces the one-record outbox with a single-owner encrypted database using
the Expo-SDK-compatible `expo-sqlite` SQLCipher build:

- `expo-sqlite` with `useSQLCipher: true`; no Expo Go claim, because SQLCipher requires a custom
  native build;
- a randomly generated 256-bit database key held only in SecureStore, with platform accessibility
  limited to the unlocked device and no biometric invalidation dependency;
- `PRAGMA key` immediately after open, then cipher/integrity verification before any schema access;
- WAL, foreign keys, an explicit schema version and `withExclusiveTransactionAsync()` for every
  mutation that crosses tables;
- one runtime-owned database actor; React, background tasks and transport adapters receive narrow
  capabilities, never a database handle or SQL surface;
- parameterized/prepared statements only for values, except the SQLCipher `PRAGMA key` bootstrap,
  which uses one internally generated and strictly validated 64-lowercase-hex key literal before any
  untrusted data or SQL is reachable;
- database migrations that are monotonic, crash-safe and rollback-tested.

The v1 schema contains:

- one exact offline owner/installation record;
- lease generations and immutable configuration items;
- an append-only event queue;
- persisted next-attempt/backoff metadata;
- protected/quarantined legacy or corrupt evidence metadata.

Each queued event contains only the immutable server-ready WorkEvent/Receipt IDs and fields, exact
owner/Membership/lease/item binding, physical timestamp, monotonic delta, device sequence and
submission provenance. It contains no token, raw UID, provider object/error, client BusinessEngine
decision or provisional TimeEntry.

Capacity is fixed at **256 unresolved events**, **4 KiB per event** and **1 MiB total unresolved
event bytes**. Capacity is checked inside the append transaction; when any limit would be exceeded,
the scan fails closed before capture is acknowledged. No event is overwritten, compacted, edited or
evicted before an exact durable acknowledgement.

Missing SecureStore key with an existing database, failed cipher/integrity check, unknown schema,
corrupt row, impossible sequence or migration failure enters a disclosure-free protected-storage
state. The runtime does not auto-delete, recreate or skip past the affected owner. App uninstall or
platform-key loss can destroy local-only evidence and is stated as a residual platform risk; no
documentation may call SecureStore or the device database an irreplaceable backup.

### 6. Legacy migration

On first successful database initialization, the runtime reads the existing E1/E2A SecureStore key
under its existing process-local serialization:

1. exact replayable v2 evidence is inserted into the queue transactionally with its original IDs,
   timestamp, Membership and mode;
2. protected Membership-unknown v1 evidence is imported into protected quarantine and is never
   inferred or rebound;
3. the inserted row is read back and compared exactly;
4. only then is the matching legacy SecureStore record cleared;
5. any read/write/clear ambiguity retains the original evidence and blocks new scans.

The legacy Core `QueuedWorkEventRecord`, `FileOfflineQueue`, `SynchronizationService` and
`FakeSynchronizationGateway` remain demo/CLI-only. Product code must not import or translate their
client decision field.

### 7. FIFO queue and synchronization scheduler

One durable, monotonic `deviceSequence` is allocated per installation/owner inside the same
transaction that appends the event. The queue head is the only event eligible for transmission.
Process restart converts an unfinished in-flight attempt back to pending without changing immutable
submission data.

A single-flight scheduler owns all foreground, manual and background attempts. Triggers are:

- runtime start;
- successful authenticated-session restoration;
- app foreground;
- successful event append;
- network-state change as a hint;
- user-selected retry;
- platform background-task invocation.

Expected transport failures use full-jitter exponential backoff: two-second base, five-minute cap.
An exact valid `Retry-After` from 1 through 900 seconds takes precedence; larger, malformed or
negative values are rejected. Retry count/backoff metadata is local orchestration data and never
changes WorkEvent/Receipt IDs, `attemptNumber = 1`, capture time, owner, lease/item or sequence.

`expo-network` is a scheduling hint only; `isConnected`/`isInternetReachable` never authorizes,
rejects or clears evidence. A real request result remains authoritative.

`expo-background-task` plus `expo-task-manager` may invoke the same narrow scheduler from global
task scope. It performs synchronization only; it never starts NFC or Admin work. Platform execution
is best-effort: Android WorkManager has a minimum 15-minute interval, iOS chooses its own window,
and user termination/vendor policy may suppress work. Therefore:

- foreground/event/manual triggers provide the primary synchronization path;
- no copy, test or closure may promise an exact background-sync time;
- expiry/cancellation leaves the current row durable and returns a truthful task result;
- background-task registration and native configuration require a development/internal build.

### 8. Server ingestion and reconciliation

Add the strict authenticated product route `POST /v1/lifecycle-events/offline`, backed only by the
isolated `taptime_offline_event_ingestor` capability and its distinct pool. The request is a closed
union containing the existing immutable lifecycle command plus:

- exact expected Membership ID;
- lease ID and lease item ID;
- installation binding and device sequence;
- opaque boot-session marker, native monotonic anchor/delta, clock-proof status and offline
  provenance version.

The route is per event, not a client-decided batch. The scheduler still drains multiple events
automatically in FIFO order. This keeps each durable result inside one PostgreSQL transaction and
preserves existing WorkEvent/Receipt idempotency.

The server transaction must:

1. verify the access token;
2. resolve and lock the exact IdentityBinding/User without accepting client claims as authority;
3. lock the lease, owner, Membership, installation stream and sequence cursor;
4. validate the exact lease item and Assignment/Tag/target tuple;
5. validate capture time against the lease, identity/Membership lifetime and numeric policy;
6. lock the historical Assignment/Customer rows and prove that their validity intervals contain
   `occurredAt`;
7. serialize by Organization/User with the existing advisory-lock boundary;
8. detect exact retry/content conflict before any new write;
9. either invoke the unchanged Core BusinessEngine under the automatic-evaluation predicate or
   persist evidence only;
10. atomically write WorkEvent, exact SyncReceipt, Audit and, only when eligible, CanonicalDecision
    plus TimeEntry mutation;
11. advance the installation/owner sequence cursor only with the exact durable result;
12. return a closed, disclosure-safe response bound to WorkEvent ID, Receipt ID and device sequence.

The lease item is a configuration lookup reference, not proof of a physical scan. A modified client
that knows its own lease can select another item from that lease; the unchanged server rules,
identity/configuration locks and evidence audit still apply. Device attestation/anti-fraud remains
out of scope.

Automatic evaluation requires all of the following:

- exact current active IdentityBinding and same exact current active Membership;
- exact current Membership role and `rowVersion` still match the lease;
- lease/item/time checks passed;
- historical Assignment, NFC Tag and Customer configuration was valid at `occurredAt`;
- the event is the next contiguous device sequence;
- no older unresolved evidence exists for that Organization/User;
- the 72-hour automatic-evaluation window is met.

Failure of an automatic predicate does not silently drop evidence. When identity can be safely
bound to the persisted lease, the isolated evidence branch may write WorkEvent, a `received`
Receipt and Audit with a closed review reason and no BusinessEngine/TimeEntry mutation. Missing or
unprovable ownership/configuration is non-durable and leaves Mobile evidence pending.

Closed durable review reasons are:

- `identity_or_membership_not_current`;
- `capture_time_out_of_bounds`;
- `automatic_window_elapsed`;
- `historical_configuration_not_valid`;
- `predecessor_requires_review`.

A sequence gap is retryable and non-durable. Same-ID/different-content, same sequence/different
event, lease/item mismatch and Receipt metadata mismatch are conflicts. Exact retries return the
previous exact result without a second mutation.

Once an event becomes durable review evidence, every later queued event can also be accepted only
as review evidence until the unresolved predecessor is adjudicated. Assignment 1 provides the
durable status/projection needed for that later work; Development Assignment 3 owns the privileged
correction/adjudication UI and append-only Human decision.

Existing E2A deferred rows and protected v1 records are never retroactively evaluated or assigned a
device sequence. They remain protected legacy evidence for Assignment 3.

### 9. Response, clear and reconciliation contract

The exact product result union distinguishes:

- canonical `synchronized`, with exact IDs/sequence and canonical decision;
- durable `review_pending`, with exact IDs/sequence and one closed reason;
- retryable `pending`, with a closed reason and optional bounded retry delay;
- `conflict`;
- `authority_rejected`;
- infrastructure/protocol unavailable.

Mobile deletes exactly one queue row only after a strict durable `synchronized` or
`review_pending` acknowledgement matches its WorkEvent ID, Receipt ID and device sequence. Local
delete failure retains/replays the row. Every other result retains it. UI receives aggregate queue
counts and safe result copy only, never raw evidence.

A tenant-safe authenticated reconciliation projection returns the server status for exact queued
IDs and permits recovery from a lost response. It cannot list another user/Organization, infer a
Membership, alter evidence or create a decision.

### 10. Schema, role and API evolution

Implementation adds exactly
`apps/backend-schema/migrations/010_complete_offline_synchronization.sql` with tenant-qualified
constraints, forced RLS and immutable/append-only triggers around:

- `offline_installations`;
- `offline_capture_leases`;
- `offline_capture_lease_items`;
- `offline_capture_lease_receipts`;
- `offline_sync_cursors`;
- `offline_event_reconciliations`.

Lease creation is command-idempotent. Its receipt stores only a SHA-256 hash of the transient
32-byte lookup key, never the key. An exact retry with the same command/key returns the same lease;
same command with different content conflicts.

The exact no-login/no-inherit/no-bypass executor roles are:

- `taptime_offline_lease_issuer`;
- `taptime_offline_event_ingestor`;
- `taptime_offline_reconciliation_reader`.

Each receives its own distinct runtime login/pool and its own no-login/no-inherit
`*_function_owner`; only a narrowly scoped function owner may use BYPASSRLS where required. A pool
cannot switch into either sibling capability. No role receives broad table mutation or a
cross-tenant/global list.

The exact API routes are:

- `POST /v1/offline-capture-leases` — strict body containing command UUID, 43-character base64url
  installation binding and 43-character base64url 32-byte lookup key; returns lease header plus the
  first item page;
- `POST /v1/offline-capture-leases/page` — strict lease ID/cursor/limit body;
- `POST /v1/lifecycle-events/offline` — one exact immutable event;
- `POST /v1/lifecycle-events/reconcile` — exact-ID status recovery, at most 25 IDs.

All request bodies remain at most 16 KiB. Lease-page responses alone may use the existing
incremental parser with a 64-KiB hard cap; every other response retains 16 KiB. All routes retain the
existing ten-second timeout, strict JSON media type, manual redirect and credential-omission
boundaries. Lease pages use 1–100 items, one immutable lease/revision/manifest and an opaque cursor
of at most 256 ASCII characters. Names use the existing approved safe projection contract.

The security shape is non-negotiable: no inherited role graph, no broad table capability, no
cross-tenant/global list, no client-selected role, transaction-local actor context, fixed pool
selection, lock-before-check for revocation/configuration races, rollback fault injection and pool
cleanup tests.

Existing canonical and E2A endpoints remain backward compatible during migration. The default
product composition moves to the new durable queue/gateway only after legacy import and all
cross-version tests pass.

## Consequences

Positive:

- cold-start and multi-event offline capture become possible without local Start/Stop authority;
- every product event follows one crash-safe FIFO path online or offline;
- historical C3E2 Assignment intervals can be evaluated deterministically;
- retries, app restarts and background invocations converge on exact idempotent server results;
- revoked/stale/late evidence is preserved without unauthorized TimeEntry mutation;
- DT-060–DT-062 can close after implementation, review, CI and Human physical proof.

Negative:

- SQLCipher and background execution require a custom native build and materially expand the native
  test surface;
- the 12-hour/5-minute/72-hour policy is a new Human-owned product/security decision;
- no client-only mechanism proves honest device time or a genuine physical tag;
- a review-pending predecessor can prevent automatic evaluation of later evidence;
- device uninstall or platform key loss can destroy evidence that never reached the server;
- Assignment 3 remains required to adjudicate review evidence and corrections.

## Alternatives considered

### Reuse the Core prototype queue

Rejected. It carries a client decision and fake/demo gateway semantics, conflicting with
server-canonical authority and the product transport boundary.

### Store an array in SecureStore

Rejected. SecureStore is not a transactional database, cannot provide indexed FIFO/sequence,
capacity accounting, atomic lease-generation replacement or safe multi-row migrations, and its own
platform documentation says not to rely on it as the sole source for irreplaceable critical data.

### Plain SQLite under the app sandbox

Rejected for the candidate because the database includes tenant configuration and unresolved time
evidence. SQLCipher plus a platform-keystore-held key gives the intended at-rest boundary. The
trade-off is custom builds and key-loss recovery risk.

### Let Mobile create provisional Start/Stop decisions

Rejected. It would split authority, make later reconciliation ambiguous and violate ADR-0005,
ADR-0006, ADR-0008 and the B6/C2 product boundary.

### Process later events around a blocked predecessor

Rejected. Start/Stop is order-dependent. Skipping an unresolved predecessor could create a
plausible but incorrect TimeEntry history.

### Promise immediate background sync

Rejected. WorkManager/BGTaskScheduler execution is deferrable and platform-controlled. Foreground
and manual triggers are required.

## Required external dependency boundary

Four Expo-SDK-compatible native packages plus one pinned, zero-dependency HMAC implementation are
proposed:

- `expo-sqlite` `~57.0.1`;
- `expo-network` `~57.0.0`;
- `expo-background-task` `~57.0.2`;
- `expo-task-manager` `~57.0.5`;
- `@noble/hashes` `2.2.0`, importing only HMAC and SHA-256 submodules.

The Expo packages must be installed through Expo's compatible-version installer. Every package must
be exact in the lockfile and covered by `npm ls`, integrity/license/supply-chain inspection, native
Android build/export and dependency-diff review. Primary references:

- <https://docs.expo.dev/versions/latest/sdk/sqlite/>
- <https://docs.expo.dev/versions/latest/sdk/network/>
- <https://docs.expo.dev/versions/latest/sdk/background-task/>
- <https://docs.expo.dev/versions/latest/sdk/task-manager/>
- <https://docs.expo.dev/versions/latest/sdk/securestore/>
- <https://www.npmjs.com/package/@noble/hashes>

## Review triggers

Review this ADR before changing any numeric lease/time/capacity/backoff value; adding iOS NFC,
device attestation, multi-owner queues, remote queue deletion, client decisions, provisional
TimeEntries, bulk ingestion, push-triggered sync, production personal data, a different encrypted
database, a different background framework or automatic adjudication of legacy/review evidence.

## Acceptance and activation

This ADR remains proposed until:

1. an independent read-only architecture/security review returns `APPROVED` with zero open
   P0/P1/P2/P3;
2. every finding is dispositioned in a renewed exact-delta review;
3. the Human Architect explicitly accepts the decision, including the 12-hour lease, five-minute
   clock tolerance, 72-hour automatic window, capacity limits and review-pending semantics;
4. the Human Architect separately authorizes implementation on an exact commit/tree baseline.

Until all four occur, ADR-0010/E1/E2A remain the only approved offline product behavior and no
production-code, schema, dependency or native-configuration change from this candidate may begin.
