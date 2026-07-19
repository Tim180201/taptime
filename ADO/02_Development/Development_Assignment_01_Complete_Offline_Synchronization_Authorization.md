# Development Assignment 1 — Complete Offline Synchronization Architecture and Authorization Candidate

Status: **HUMAN-ACCEPTED CONTRACT; EXACT-BASELINE REPOSITORY WORKSTREAMS A–E PUBLISHED,
TECHNICAL-LEAD APPROVED AND ORIGINAL EXACT-HEAD CI 10/10 GREEN — INDEPENDENT IMPLEMENTATION
REVIEW RETURNED CHANGES REQUIRED FOR DA1-IMPL-01 (P2); FOCUSED CORRECTION `c71399a`, TREE
`7a159ce`, PUBLISHED AND EXACT-HEAD RUN `29692113159` 10/10 GREEN; INDEPENDENT EXACT-DELTA
RE-REVIEW OF FINAL HEAD `767043d`, TREE `19c434a`, APPROVED WITH ZERO OPEN P0/P1/P2/P3 AND
DA1-IMPL-01 CLOSED; COMPLETE FRESH HUMAN PHYSICAL GATE AUTHORIZED ON ADO HEAD `72dc39e` AND
EXACT-HEAD RUN `29692785824`, BUT GATE A FAILED BEFORE LEASE ACTIVATION WITH DA1-PHYS-01 (P1);
FOCUSED CORRECTION `04399fa`, TREE `ecf5e6f`, AND EXACT-HEAD RUN `29695449737` 10/10 GREEN;
INDEPENDENT EXACT-DELTA REVIEW OF HEAD `76be116`, TREE `d320db3`, AND RUN `29695605706`
APPROVED WITH ZERO OPEN P0/P1/P2/P3; DA1-PHYS-01 CLOSED; SECOND COMPLETE FRESH GATE-A–E RUN
AUTHORIZED ON PRODUCT `04399fa`, ADO HEAD `fb4a4e4` AND RUN `29696026676`, BUT GATE A FAILED AT
STEP 4 WITH DA1-PHYS-02 (P1); FOCUSED CORRECTION `e17fcb3` PLUS CROSS-IDENTITY HARDENING
`869e10f`, FINAL TREE `325fdd5`, PUBLISHED AND EXACT-HEAD RUNS `29696949408` AND `29697397146`
EACH 10/10 GREEN; INDEPENDENT EXACT-DELTA REVIEW OF HEAD `8d1a0d8`, TREE `3464697`, APPROVED
WITH ZERO OPEN P0/P1/P2/P3; DA1-PHYS-02 REPOSITORY FINDING CLOSED; THIRD COMPLETE FRESH
PHYSICAL GATE NOT YET AUTHORIZED; PRODUCTION, DEPLOYMENT AND DISTRIBUTION NOT AUTHORIZED**
Date: 2026-07-19
Candidate Baseline Commit: `1bb2d7d7b38928643cfd5c86b36c500c35f73276`
Candidate Baseline Tree: `c5c20f67155cdc0b4197908b4d1283cb7e619597`
Independently Reviewed Candidate Commit: `592334160655cde2f4189712eaf327c8a7edcb0e`
Independently Reviewed Candidate Tree: `96fffb5bb5e2793041c36b8f793c38ab1c2e5428`
Independent Review Exact-head CI: GitHub Actions run `29653357355`, attempt 1, 10/10 successful
Independent Review Verdict: **APPROVED — zero open P0/P1/P2/P3**
Human Contract Acceptance Date: 2026-07-18
Human Accepted Scope: ADR-0012 and Sections 3–13, including every numeric policy boundary
Candidate Parent State: C3E2 independently closed; tracked/staged repository clean; untracked
`research/` explicitly excluded and untouched
Human Direction: The Human Architect first authorized candidate preparation and subsequently
accepted ADR-0012 and Sections 3–13 on the independently reviewed commit, including every numeric
policy; the Human Architect then separately authorized repository implementation of Workstreams
A–E from exact baseline `180093091c47a926b5871a27ea8b00fb21b9b4ac`, tree
`73e77b6ca5dfd7671cdd3d77a344168fddff3627`
Owner: Technical Lead
Architecture Candidate:
`ADO/01_Architecture/ADR/ADR-0012-complete-offline-synchronization-platform.md`
Independent Review Evidence:
`ADO/05_Evidence/Development_Assignment_01_Independent_Pre_Implementation_Review.md`
Implementation Evidence:
`ADO/05_Evidence/Development_Assignment_01_Implementation_Evidence.md`
Independent Implementation Review and Correction Disposition:
`ADO/05_Evidence/Development_Assignment_01_Independent_Implementation_Review.md`
Physical Validation Evidence:
`ADO/05_Evidence/Development_Assignment_01_Physical_Validation_Evidence.md`
DA1-PHYS-01 Independent Exact-Delta Review:
`ADO/05_Evidence/Development_Assignment_01_DA1_PHYS_01_Independent_Exact_Delta_Review.md`
Roadmap Scope: Comprehensive Development Assignment 1; intended completion of DT-060–DT-062 only
after every required gate passes
Implementation Authority: **Granted for repository Workstreams A–E on the exact baseline above**
Implementation Release Date: 2026-07-18
Implementation Baseline Commit: `180093091c47a926b5871a27ea8b00fb21b9b4ac`
Implementation Baseline Tree: `73e77b6ca5dfd7671cdd3d77a344168fddff3627`
Excluded from this release: production resources/data, deployment, distribution and Human Physical
Gate execution

## 1. Candidate objective

Deliver one cohesive, professional offline/synchronization platform:

```text
authenticated server lease + exact configuration generation
  -> encrypted transactional Mobile configuration/queue store
  -> warm or cold-start offline NFC evidence capture
  -> persist every online/offline event before first send
  -> one FIFO scheduler across foreground/manual/background triggers
  -> strict authenticated per-event synchronization gateway
  -> tenant-safe historical configuration/time/sequence reconciliation
  -> server-canonical Start/Stop or durable review evidence
  -> exact local clear/status recovery
```

This is one Development assignment, not a bundle of lower-quality micro-sprints. It may use
internally reviewable workstreams and atomic commits, but it closes only as a whole after complete
verification, exact-head CI, independent review and Human physical validation.

## 2. Repository truth reconciled on the candidate baseline

### 2.1 Existing product foundations that must be extended

- `ProductScanOrchestrator` owns exactly one `pendingEvidence` record and blocks a second scan.
- `ExpoSecureLifecycleEvidenceOutbox` stores one strict, at-most-2-KiB versioned record.
- `SessionBoundScanContextResolver` owns exactly one volatile positive context and always attempts
  live resolution first.
- `MobileSessionCoordinator` restores only a refresh token and exposes a scan session only after
  live server Membership context is resolved.
- `TapTimeLifecycleApiClient` supports the canonical and E2A defer-only endpoints with strict
  bounded response parsing.
- `ServerCanonicalLifecycleIngestionCoordinator` serializes Organization/User processing, locks
  current Membership/configuration and invokes the unchanged Core BusinessEngine only in its
  canonical policy.
- E2A defer-only ingestion writes WorkEvent, `received` SyncReceipt and Audit only; it never writes
  CanonicalDecision/TimeEntry.
- C3E2 preserves immutable historical Assignment rows with a shared server cutover time.
- migration `001` records IdentityBinding/Membership creation/revocation time; migration `002`
  records Assignment/Customer validity and WorkEvent/Receipt/Decision/Audit integrity.

### 2.2 Existing components that are not product authority

- Core `OfflineQueue`, `SynchronizationService`, `FileOfflineQueue` and
  `FakeSynchronizationGateway` are prototype/CLI surfaces.
- `QueuedWorkEventRecord` contains a client BusinessEngineDecision and therefore cannot be reused
  in the product Mobile server-canonical path.
- `expo-sqlite`, `expo-network`, `expo-background-task` and `expo-task-manager` are not currently
  installed.
- no persisted configuration/identity lease, multi-event product queue, automatic scheduler,
  background sync, sequence cursor or offline reconciliation endpoint exists.

### 2.3 Open truth carried into this assignment

- DT-060–DT-062 and Block E remain open.
- E1/E2A do not prove airplane mode, cold-start capture, multiple events, automatic sync,
  post-revocation evidence intake, historical evaluation or production operation.
- existing E2A deferred rows and protected v1 evidence have no approved automatic adjudication.
- iOS NFC, production cloud, production personal data, distribution, correction UI, export and
  pilot/customer operation remain outside this assignment.

## 3. Architecture contract incorporated by reference

ADR-0012 Sections 1–10 are mandatory implementation boundaries, not suggestions. In particular:

- server-only lifecycle decisions;
- 12-hour exact offline capture lease;
- five-minute clock-anchor tolerance;
- 72-hour automatic-evaluation window;
- Android same-boot `SystemClock.elapsedRealtime()` proof for automatic evaluation, with
  reboot/invalid monotonic evidence forced to review-only;
- one offline owner per installation;
- SQLCipher-backed Expo SQLite with SecureStore-held key;
- 4,096-item/4-MiB configuration activation limits;
- 256-event/4-KiB-per-event/1-MiB queue limits;
- strict FIFO with no later-event bypass;
- two-second/full-jitter/five-minute retry policy and bounded `Retry-After`;
- platform background work as best-effort only;
- isolated per-event offline lifecycle route and least-privilege database capability;
- exact durable acknowledgement before local deletion;
- durable review evidence instead of unauthorized mutation;
- no reinterpretation of E2A/protected legacy evidence.

Changing one of these values or boundaries requires a reviewed candidate correction and renewed
Human acceptance before implementation continues.

## 4. Authorized implementation shape

This section defines the repository implementation released by the Human Architect on the exact
baseline recorded above.

### Workstream A — contracts, migration and least privilege

1. Add migration `010` only after a complete migration `001`–`009` compatibility audit.
2. Add the exact ADR-0012 tables with forced RLS, tenant-qualified integrity,
   immutable/append-only constraints and strict result shapes.
3. Add the three exact no-login/no-inherit/no-bypass executor roles plus separate function owners
   and three distinct API pool/logins for lease issue, event ingestion and reconciliation. Fixed
   selection must be server-owned; no request may choose or pivot to a database role.
4. Add security-definer functions only where RLS cannot express the required lock/capability
   boundary. Pin `search_path`, revoke PUBLIC, grant exact execution and test contaminated role
   graphs.
5. Add the four exact ADR-0012 routes for lease creation/page, offline lifecycle ingestion and
   reconciliation. Bodies/headers are closed, bounded and duplicate-header safe.
6. Preserve canonical/E2A API compatibility and all existing migration ledgers/hashes.

### Workstream B — encrypted Mobile persistence and legacy import

1. Install and pin only the ADR-0012 dependency set through Expo-compatible resolution.
2. Configure SQLCipher and required background native settings in tracked app configuration.
3. Implement a narrow database owner/port with exclusive transactions, migrations, prepared
   statements, size accounting, integrity checks and one process-wide actor.
4. Implement atomic lease-generation assembly/activation and exact cross-runtime HMAC lookup using
   pinned `@noble/hashes` on Mobile and Node native crypto on the server.
5. Implement the append-only queue, monotonic device sequence, scheduler metadata, protected
   quarantine and exact durable clear.
6. Import E1/E2A v2 and protected v1 records using the read-back-before-clear protocol.
7. Add the narrow Android boot-marker/`SystemClock.elapsedRealtime()` native clock port; a boot
   change or impossible monotonic value must make evidence review-only, never dropped.
8. Never expose SQL, keys, raw UID, evidence or configuration capabilities to React.

### Workstream C — session, scan and scheduler orchestration

1. Add an explicit offline-capture session state that can follow only a typed transient restoration
   failure with a valid local lease.
2. Make logout/authority rejection disable new offline capture without deleting pending evidence.
3. Replace the one-record ProductScan path with persist-first FIFO submission for every online and
   offline event.
4. Preserve exact scan-generation, native NFC cancel and stale-response protections.
5. Add one single-flight scheduler used by event, foreground, manual, network-hint and background
   triggers.
6. Keep background-task definition outside React/global as required by the native platform.
7. Present only safe queue count, pending/review/server-decision outcomes and support guidance.

### Workstream D — server reconciliation and canonical evaluation

1. Verify token and exact identity binding, then lock lease/owner/sequence/configuration before
   evaluation.
2. Accept no client User/Organization/role/configuration/time decision as authority.
3. Reuse the unchanged Core BusinessEngine as the only lifecycle decision source.
4. Evaluate only the next exact sequence under every ADR-0012 automatic predicate.
5. Store late/revoked/stale/predecessor-blocked evidence through the isolated defer-only branch.
6. Make every successful path atomic across WorkEvent, Receipt, Audit and any Decision/TimeEntry
   mutation.
7. Return exact idempotent prior results for retries and disclosure-safe closed conflicts otherwise.
8. Add tenant-safe reconciliation-by-exact-ID for lost-response recovery.

### Workstream E — verification, physical gate and closure

1. Complete all automated matrices in Section 8.
2. Produce a custom Android development/internal build containing SQLCipher/background modules.
3. Run the complete fresh Human gate in Section 9.
4. Obtain independent final implementation review of the full baseline-to-head delta.
5. Correct every P0/P1/P2/P3 finding and rerun exact-delta review.
6. Publish focused closure truth only after exact-head CI and Human observations pass.

## 5. Required exact contracts

The implementation plan must freeze exact TypeScript/PostgreSQL/HTTP names before coding. It may
choose names, not semantics. The minimum closed result vocabulary is:

| Layer | Required states |
|---|---|
| Lease | ready, incomplete/oversize, authority rejected, unavailable |
| Local store | ready, full, protected, migration failed, unavailable |
| Queue | pending, in flight, retry wait, protected/review predecessor |
| Server event | synchronized, review pending, retryable pending, conflict, authority rejected |
| UI | offline ready, saved locally, synchronizing, server review pending, server decision, protected |

Every server durable result carries exact WorkEvent ID, Receipt ID and device sequence. Every
retryable/conflict/review code is a closed union. Raw database/provider/network errors never cross
the API or UI.

## 6. Security invariants

- An access token is verified for every server request and never persisted in the offline database.
- A lease/expected Membership/install binding can narrow but never grant actor authority; the lease
  binds the exact IdentityBinding, Membership role and Membership `rowVersion`.
- A lease item is not physical-scan attestation and no closure may describe it as one.
- Cross-Organization, cross-User, cross-Membership, cross-installation and cross-lease access fails
  before data disclosure or mutation.
- Identity/Membership/configuration rows are locked before the decisive checks; revoke/reassign
  races cannot pass on stale reads.
- Only the exact historical Assignment interval containing `occurredAt` may identify a target.
- Current revoked authority cannot create a canonical decision, even when the event predates
  revocation.
- Queue order is per installation/owner and server evaluation remains serialized per
  Organization/User.
- No client BusinessEngineDecision or provisional TimeEntry reaches transport or persistence.
- No raw UID, provider subject/token/error, SQLCipher key or lookup key reaches logs/UI/audit
  payloads.
- Storage/parse/migration/capacity ambiguity fails closed without auto-delete.
- Local evidence is cleared only after an exact durable server proof or an explicit separately
  authorized destructive recovery.
- Background/network APIs schedule work only; they cannot change authority or evidence state by
  themselves.
- All database roles are normalized on every clean/dirty migration run and pool release resets
  role/GUC/transaction state.

## 7. Failure and race matrix

At minimum, implementation must specify and test:

- process death before append, during append, after append/before send, during send, after server
  commit/before response, after response/before local delete and during local delete;
- force-stop/reboot with valid lease, expired lease, pending queue and in-flight marker;
- SecureStore unavailable, missing key, wrong key, SQLCipher integrity failure, unknown schema,
  partial migration, corrupt row and capacity boundary;
- lease pagination duplicate, cross-tenant page, revision change, missing page, bad manifest,
  oversized projection and interrupted activation;
- logout, sign-in replacement, Membership revoke/regrant, IdentityBinding revoke, role change and
  app-state generation changes during every async phase;
- Tag reassignment/Customer deactivation between capture and ingestion;
- multiple scans before connectivity, across two tags/targets, with an active TimeEntry;
- online scan while older offline evidence is pending;
- duplicate task invocations and foreground/manual/background overlap;
- network listener false-positive/false-negative and request timeout;
- exact retry, same-ID/different-content, same-sequence/different-event, sequence gap and lost
  response reconciliation;
- clock moved backward/forward, monotonic mismatch, lease-boundary tolerance and 72-hour boundary;
- force-stop with the same Android boot marker and full reboot with a changed boot marker;
- revoked/late/historical-invalid evidence-only persistence with zero Decision/TimeEntry delta;
- unresolved predecessor causing every later event to become review evidence;
- E1/E2A v2 import, protected v1 import and clear ambiguity;
- pool acquisition/query/commit/rollback/release failure and injected failure after every write.

## 8. Mandatory automated verification

No subset replaces the complete matrix. The future implementation must run:

1. complete Core tests and tests-inclusive Core typecheck;
2. complete Mobile tests and a proven tests-inclusive Mobile TypeScript configuration;
3. dedicated pure queue/scheduler/session state-machine tests;
4. actual Android native SQLCipher database migration/integrity/transaction tests, not only mocks;
5. complete backend schema clean-install, dirty-role, migration ledger/hash and RLS matrix on
   PostgreSQL 17;
6. complete backend identity/read-model/lifecycle/API tests;
7. new offline lease/ingestion/reconciliation PostgreSQL/JWT adversarial integration matrix;
8. existing Administration Contract/Admin Web/synthetic Android E2E suites;
9. extended synthetic Android E2E for multi-event offline/restore/automatic sync;
10. workspace source and tests-inclusive typechecks;
11. all package builds/declaration bundles and Admin Web production build;
12. Android export plus tracked custom native Android build with SQLCipher/background configuration;
13. `npm ls`, lockfile-only dependency scope check and license/integrity review;
14. `git diff --check`, migration inventory, generated-tree cleanliness and no secret/raw UID scans;
15. repeated targeted race/fault tests sufficient to disprove order dependence/flakiness.

Test counts must be reported from the final exact head, never copied from a prior baseline. A source
TypeScript check cannot be described as tests-inclusive unless its executed config includes tests.

## 9. Mandatory fresh Human physical gate

The gate uses the approved Galaxy A33 5G / Android 15 and two stable NTAG213 tags under synthetic,
non-personal test identities. It begins only after independent implementation approval and green
exact-head CI.

### Gate A — lease and true cold-start offline capture

1. Start the strictly local synthetic backend and install the exact reviewed custom APK.
2. Sign in as the enrolled Employee, obtain the complete lease and prove safe projection counts.
3. Enter airplane mode, force-stop the app and relaunch it without Metro/backend reachability.
4. Confirm the explicit offline-capture state without a Start/Stop claim.
5. Scan Tag A, Tag B, then Tag A again with more than the existing five-second duplicate window
   between the two Tag-A captures; each scan must be saved and queue count must become 1/2/3.
6. Force-stop/relaunch again and confirm all three pending events remain protected in order.

### Gate B — automatic FIFO synchronization

1. Restore connectivity without pressing a per-event retry button.
2. Confirm foreground/event scheduler drains exactly sequence 1/2/3.
3. Confirm exact server counts, receipts, audits and canonical decisions.
4. Confirm the resulting TimeEntries match the unchanged BusinessEngine and event order.
5. Restart the app and prove the queue is empty only after exact durable acknowledgements.

### Gate C — idempotency and lost response

1. Arm a synthetic interruption after server commit and before Mobile receives the response.
2. Capture one event, observe it remain pending, then restore transport.
3. Confirm automatic exact retry/reconciliation returns the prior result with zero duplicate
   WorkEvent, Receipt, Decision or TimeEntry mutation.

### Gate D — stale authority/configuration fail closed

1. Capture offline evidence, then use the approved Admin flow to reassign its Tag or revoke the
   Membership before upload.
2. Restore connectivity.
3. Confirm the server stores at most exact review evidence, creates zero unauthorized
   CanonicalDecision/TimeEntry mutation and shows truthful review-pending copy.
4. Confirm every later queued event cannot bypass the unresolved predecessor.

### Gate E — background capability truth and cleanup

1. Verify the background task is registered in the exact build.
2. Use the development-only native trigger to invoke the same scheduler and prove single-flight
   idempotency. Do not claim a real-time OS scheduling SLA.
3. Sign out, verify new offline capture is disabled and safe UI discloses no old-owner details.
4. Remove test schema/roles/listeners/reverse mappings and confirm both app and Web sessions signed
   out.

All observations and sanitized machine counts go into a new physical evidence artifact. No token,
password, invitation secret, raw UID, provider subject or real personal data may be copied into ADO.

## 10. Acceptance criteria

Assignment 1 is complete only when:

- ADR-0012 is independently approved and Human accepted before coding;
- implementation began from the exact separately authorized baseline;
- every Workstream A–E item is present or explicitly removed through renewed Human decision;
- online and offline events use the same persist-first FIFO product path;
- cold-start offline capture works only under the exact lease/session boundary;
- multiple events survive restart and synchronize automatically in order;
- server-only decisions, historical configuration checks and revocation rules are proven;
- all strict durable/non-durable outcomes retain or clear local evidence correctly;
- migration from E1/E2A evidence is lossless/fail-closed;
- SQLCipher and background native behavior are proven in the actual Android build;
- every automated suite/check is green on final head;
- independent implementation and final closure reviews have zero open P0/P1/P2/P3;
- exact-head CI passes;
- the complete fresh Human physical gate passes;
- Project Status, Decision Log, roadmaps and evidence state only the achieved scope.

Only then may DT-060–DT-062 be marked completed for the approved Android/local
repository/synthetic-server scope.

## 11. Explicit non-goals

- Admin correction/adjudication UI or privileged Human resolution of review evidence
  (Development Assignment 3);
- setup/export backend (Assignment 2);
- broad Admin Web or Mobile visual productization (Assignments 4/5);
- production cloud, production secrets/data, monitoring, backup/recovery or operational SLOs
  (Assignment 6);
- signing/store/internal distribution (Assignment 7);
- public website (Assignment 8);
- iOS NFC;
- device attestation/anti-cloning/anti-fraud guarantees;
- multi-user queue ownership on one installation;
- remote deletion or silent expiry of unresolved evidence;
- automatic reinterpretation of E2A/protected legacy evidence;
- legal/commercial/privacy approval.

## 12. Delivery and review sequence

1. Publish this ADO-only candidate from the exact baseline.
2. Obtain independent pre-implementation architecture/security review.
3. Correct every finding and obtain exact-delta re-review until zero P0/P1/P2/P3 remain.
4. Human Architect explicitly accepts ADR-0012 and this candidate, including all numeric policies.
5. Human Architect separately states the exact implementation baseline and grants implementation.
6. Technical Lead freezes exact names/contracts in an implementation plan without widening scope.
7. Implement Workstreams A–E with focused atomic commits and continuous full verification.
8. Technical Lead performs complete-diff architecture/security audit.
9. Publish implementation, obtain exact-head CI and independent implementation review.
10. Correct/re-review any finding, rerun exact-head CI, then run the complete fresh Human gate.
11. Publish truthful closure and obtain final independent closure review.

One comprehensive assignment does not remove any review point above. It removes artificial
micro-sprint handoffs while preserving every quality/security gate.

## 13. Current release gate

**REPOSITORY IMPLEMENTATION AND DA1-PHYS-01 CORRECTION INDEPENDENTLY APPROVED — SECOND
AUTHORIZED COMPLETE FRESH HUMAN PHYSICAL GATE FAILED AT GATE A STEP 4 WITH DA1-PHYS-02 (P1);
FOCUSED CORRECTION `e17fcb3` PLUS CROSS-IDENTITY HARDENING `869e10f`, FINAL TREE `325fdd5`,
AND EXACT-HEAD RUNS `29696949408` AND `29697397146` EACH 10/10 GREEN;
INDEPENDENT EXACT-DELTA REVIEW OF HEAD `8d1a0d8`, TREE `3464697`, APPROVED WITH ZERO OPEN
P0/P1/P2/P3; DA1-PHYS-02 REPOSITORY FINDING CLOSED; THIRD COMPLETE FRESH PHYSICAL GATE NOT
YET AUTHORIZED; PRODUCTION GATES REMAIN CLOSED.**

Candidate publication, exact-head CI, independent zero-finding pre-implementation review, explicit
Human acceptance of ADR-0012/Sections 3–13 and the separate exact-baseline repository
implementation release are complete. Workstreams A–E may be implemented and verified in the
repository from commit `180093091c47a926b5871a27ea8b00fb21b9b4ac`, tree
`73e77b6ca5dfd7671cdd3d77a344168fddff3627`.

The corrected repository implementation passed independent exact-delta re-review with zero open
P0/P1/P2/P3 on final reviewed head `767043d8f91bc2806cb1bd111989cf9b741b858c`, tree
`19c434a8ba4586aeb1344778cbe483504ce46a34`, after green exact-head runs `29692113159` and
`29692304824`. `DA1-IMPL-01` is closed.

The Human Architect subsequently authorized the complete fresh Physical Gate bound to product head
`767043d8f91bc2806cb1bd111989cf9b741b858c`, ADO synchronization head
`72dc39e0ce6d7d65c561b287ae36bf7fbef8a54a` and exact-head run `29692785824`. Gate A failed at
step 2 before lease activation: the exact hash-verified APK reproduced SQLCipher page-1
HMAC/decryption failure on a clean first start of the approved Galaxy A33/Android-15 device before
authentication. `DA1-PHYS-01` was opened as P1; no Gate-A tag scan occurred, Gates B–E were not
started and no observation from the failed attempt may be reused.

Focused correction `04399fa`, tree `ecf5e6f`, passes the required native first-run/reopen,
wrong/missing-key and backup-boundary evidence plus exact-head run `29695449737`, attempt 1, ten
of ten jobs. Independent exact-delta review of head `76be116`, tree `d320db3`, and run
`29695605706` returned `APPROVED` with zero open P0/P1/P2/P3 and closed `DA1-PHYS-01`.
The failed attempt remains historical evidence and Gates B–E were not started. A complete fresh
Gate-A–E restart may now be separately authorized by the Human Architect, but is not authorized
by this contract synchronization or review. Production resources/data, deployment and
distribution remain unauthorized.

The Human Architect subsequently authorized that complete fresh restart, bound to product
correction `04399fa7ef8b3e58e44e82a81c0b0757acae1adc`, ADO synchronization head
`fb4a4e4b1c457112372770b9e4e6532f9dca0555` and exact-head run `29696026676`. Fresh
prerequisite setup and a clean Employee install produced one complete Employee lease with two
declared and two stored items for the two active assignments. After airplane mode, removal of both
USB reverse mappings, force-stop and cold relaunch without Auth/API reachability, the app showed
`TapTim.e ist derzeit nicht verfügbar` instead of the mandatory explicit offline-capture state.
No tag was scanned and server lifecycle counts remained zero.

Gate A failed at step 4; Gates B–E were not started and no observation from either failed attempt
may be reused. Focused correction `e17fcb3f1286095c345e6a4ce965790361901099`, tree
`44320bc8bb5a25b71300c03d8d50c5a8561ebf0a`, maps transient provider-refresh unavailability
to a suspended retryable context without retaining access authority, restores through the
existing single-flight capability, exposes a disclosure-free offline shell only for eligible
offline coordinator states, and retries restoration before foreground/network scheduling.
Cross-identity hardening `869e10f7d54e1c16a60a06a4b37ccedc5d0bfac1`, tree
`325fdd5b003e1bccaee15eeac6b0b82826316554`, permits local-lease restoration only from stored
startup credentials or a previously resolved session; explicit new login with unavailable backend
context remains closed. Local Mobile verification is 406/406 in 29 files with 93/93 focused
regressions; required Workspace typechecks/builds, Android export/native release build and
`git diff --check` pass. Exact-head runs `29696949408` and `29697397146`, each attempt 1, passed
ten of ten jobs.

Independent read-only exact-delta review bound the complete linear `c8295e5` → `e17fcb3` →
`f7c66c8` → `869e10f` → `8d1a0d8` chain, final reviewed tree
`3464697130900ed55e68acc02e5fb5af41db90a5`, the 17-file +515/-75 delta and all four exact-head
ten-job runs. It returned `APPROVED` with zero open P0/P1/P2/P3 and closed `DA1-PHYS-02` as a
repository finding. The review independently reproduced Mobile 406/406, focused regressions
93/93, tests-inclusive Mobile typecheck, Core 290/290, Admin Web 44/44 and both contracts.

No corrected physical result is claimed. The failed second run remains historical; a third
complete fresh Gate-A–E restart still requires a new separate Human authorization and must reuse
no prior observation. Production resources/data, deployment and distribution remain unauthorized.

## 14. Independent review mandate

The reviewer must inspect the exact candidate commit/tree, its parent and the complete candidate
delta. At minimum, the review must answer:

1. Does the candidate preserve server-canonical authority online/offline?
2. Can any lease, cache, sequence, network/background state or client claim grant authority?
3. Are the 12-hour/5-minute/72-hour policies coherent, testable and safe?
4. Can revoke/reassign/time/order races create an unauthorized TimeEntry mutation?
5. Is SQLCipher/SecureStore key lifecycle truthful, including uninstall/key-loss residual risk?
6. Is legacy E1/E2A evidence migrated without loss/rebinding?
7. Are FIFO, capacity, backpressure, corrupt-row and lost-response rules complete?
8. Are background execution guarantees accurately bounded to Expo/platform behavior?
9. Is the proposed schema/role/API capability sufficiently narrow for implementation?
10. Can later review evidence block order without being silently skipped?
11. Are automated and physical gates sufficient to prove the claimed scope?
12. Do governance artifacts distinguish the locally Technical-Lead-approved implementation
    candidate from still-pending publication, exact-head CI, independent approval, Human Physical
    Gate and final closure?

Any P0/P1/P2/P3 implementation finding requires correction, renewed exact-delta review and green
exact-head CI before the Human Physical Gate may be authorized.
