# Development Assignment 1 — Human Physical Validation Evidence

Date: 2026-07-20
Status: **FIRST THREE FAILED GATES RETAINED AS HISTORICAL EVIDENCE; DA1-PHYS-01,
DA1-PHYS-02 AND DA1-PHYS-03 REPOSITORY FINDINGS CLOSED BY INDEPENDENT REVIEW; FOURTH COMPLETE
FRESH GATE AUTHORIZED ON PRODUCT `7dbda3b`, REVIEWED ADO `798bada`, REVIEW SYNCHRONIZATION
`73b5105` AND EXACT-HEAD RUN `29714165784`; GATE A STEPS 1–4 PASSED BUT STEP 5 FAILED BECAUSE
THREE NATIVE NFC CAPTURES WERE INVALIDATED BEFORE LOCAL APPEND; FAILURE SYNCHRONIZATION
`3dd7983`/`e78b526` AND RUN `29716007657` INDEPENDENTLY APPROVED; FOCUSED CORRECTION
`48a21a7`, TREE `7c053be`, TECHNICAL-LEAD APPROVED, PUBLISHED AND EXACT-HEAD RUN
`29743923158` 10/10 GREEN; ADO PUBLICATION `2f6035b`, TREE `d5513a6`, AND RUN `29744637928`
10/10 GREEN; INDEPENDENT EXACT-DELTA CORRECTION REVIEW APPROVED WITH ZERO OPEN P0/P1/P2/P3;
DA1-PHYS-04 REPOSITORY FINDING CLOSED; NO CORRECTED PHYSICAL RESULT; FIFTH GATE MAY BE
SEPARATELY HUMAN-AUTHORIZED BUT IS NOT YET AUTHORIZED; PRODUCTION, PRODUCTION DATA, DEPLOYMENT
AND DISTRIBUTION NOT AUTHORIZED**
Owner: Human Architect + Technical Lead

## 1. Authorization and exact binding

The Human Architect explicitly authorized the complete fresh Human Physical Gate from
Authorization Section 9, Gates A–E, bound to:

- independently approved product head
  `767043d8f91bc2806cb1bd111989cf9b741b858c`, tree
  `19c434a8ba4586aeb1344778cbe483504ce46a34`;
- ADO synchronization head `72dc39e0ce6d7d65c561b287ae36bf7fbef8a54a`, tree
  `a3ca8dc065292d08be35c93b90901493c4fe3a68`; and
- exact-head GitHub Actions run `29692785824`, attempt 1, ten of ten jobs successful.

Production resources/data, deployment and distribution remained unauthorized.

The gate used the approved Samsung Galaxy A33 5G on Android 15 and two stable NTAG213 tags. The
release APK was built from a detached exact worktree at ADO head `72dc39e`, installed under the
synthetic package ID and verified both on disk and on device:

- APK SHA-256:
  `2d48f78bb9d879c0457af877b58a8807c0327e64f47bc415270c989c4489bf95`;
- APK size: 95,414,410 bytes; and
- installed-device APK hash: exact match.

Node 24.17.0, JDK 17, PostgreSQL 17 and numeric-loopback USB forwarding were used. No Metro,
LAN, tunnel, cloud backend or production resource participated.

## 2. Synthetic prerequisite preparation

Before the fresh Employee run, the strictly local harness and real approved Administration path
created the required two-customer/two-tag setup. Only shortened validation fingerprints were
recorded:

| Logical tag | Safe label | Customer | Validation fingerprint |
|---|---|---|---|
| Tag A | `DA1 TAG A` | `SYNTHETIC ANDROID CUSTOMER` | `B55E8B6AEB30` |
| Tag B | `DA1 TAG B` | `SYNTHETIC REASSIGNMENT TARGET` | `32A54C8F2F29` |

Sanitized server state after preparation was:

```text
Customers=2
NfcTags=2
NfcAssignments=2
AdminSetupReceipts=2
AuditEvents=4
WorkEvents=0
SyncReceipts=0
CanonicalDecisions=0
TimeEntries=0
```

The Administration session was signed out. No prerequisite setup observation is counted as a
Gate-A Employee observation.

## 3. Gate A result

Gate A failed at step 2, before a complete Employee lease could be obtained or activated.

The exact APK was reset to a fresh local state and started while the local backend remained
reachable. Employee authentication succeeded, but the application showed the fail-closed
protected-pending presentation instead of a ready scan state. Server-side inspection confirmed:

```text
OfflineCaptureLeases=0
OfflineCaptureLeaseItems=0
OfflineCaptureLeaseReceipts=0
WorkEvents=0
```

No tag was scanned for Gate A, airplane mode was not enabled and no queue-count observation was
accepted.

### 3.1 Exclusion of restored backup data

An initial reset still encountered protected encrypted state. To distinguish stale Android backup
from a product/native initialization defect, the Technical Lead then:

1. issued package-scoped wipe commands to each of the four configured Android backup transports,
   with explicit success confirmed for the active Google transport;
2. temporarily disabled the Android Backup Manager so no restore could run during the clean probe;
3. cleared only the synthetic application package data;
4. cleared logcat;
5. started the unchanged exact APK; and
6. re-enabled the Android Backup Manager immediately afterward.

On this clean first start, before any authentication or user input, the login screen was visible
and logcat again emitted the three SQLCipher failure records:

```text
sqlcipher_page_cipher: hmac check failed for pgno=1
sqlite3Codec: error decrypting page 1 data
sqlcipher_codec_ctx_set_error 1
```

The installed APK hash still matched exactly. This reproduction excludes an accepted prior
session, a queued WorkEvent, an Employee/Admin identity switch and restored synthetic backup data
as necessary causes.

## 4. Historical finding

### DA1-PHYS-01 — P1 — Fresh native SQLCipher store cannot initialize on the approved Android device

The exact release APK cannot establish its encrypted offline database on a clean first start of
the approved Galaxy A33/Android-15 device. `OfflineCaptureDatabase.initialize()` fails closed
before owner binding or lease issuance, so the mandatory offline-capture capability is unavailable
and Gate A cannot proceed.

This is P1 rather than P0 because the product fails closed: no lease, WorkEvent, Receipt,
CanonicalDecision or TimeEntry was created; no raw UID, token, key, provider subject, SQL content or
personal data was disclosed. It is nevertheless release-blocking because complete offline capture
is the primary Development Assignment 1 capability and cannot operate on the required reference
device.

The correction scope must establish and regressionswirksam prove the native first-run encrypted
database lifecycle. At minimum, it must prove on the exact supported Android build that:

- a new database is keyed before any incompatible page access;
- first-run cipher and database integrity checks succeed;
- force-stop/cold-start reopens the same encrypted store with the same installation key;
- wrong/missing keys still fail closed without deletion or rebinding;
- Android backup/restore rules cannot restore an encrypted database without its non-restorable
  device-bound key; and
- the complete fresh Gate A–E can restart only after independent correction approval and green
  exact-head CI.

No production-code correction was authorized or performed during this failed gate. The separately
authorized focused correction is recorded in Section 7.

Disposition: **Closed** by focused correction `04399fa` and the zero-finding independent
exact-delta review recorded in Section 8. This disposition does not turn the failed Gate-A
observation into a pass.

## 5. Gate disposition

| Gate | Result |
|---|---|
| A — lease and true cold-start offline capture | **FAILED / BLOCKED at step 2** |
| B — automatic FIFO synchronization | Not started |
| C — idempotency and lost response | Not started |
| D — stale authority/configuration fail closed | Not started |
| E — background capability truth and cleanup | Functional observations not started; cleanup completed |

No partial observation from this attempt may be reused in a later Gate A–E run.

## 6. Safe-data boundary and cleanup

No password, access/refresh token, invitation secret, SQLCipher/SecureStore key, raw NFC UID,
provider subject, internal database identifier or real-person data was copied into ADO or terminal
evidence. Only aggregate counts, public synthetic labels and 12-character validation fingerprints
were retained.

Cleanup completed:

- Mobile is on the unauthenticated login screen;
- no Admin Web session was started;
- local synthetic harness/listeners stopped;
- disposable database count: `0`;
- generated synthetic PostgreSQL role count: `0`;
- USB reverse mapping count: `0`;
- clipboard cleared; and
- Android Backup Manager restored to enabled.

## 7. Focused correction and native re-verification

Root cause was the native connection boundary, not stale device data or a key-generation defect.
Expo's exclusive-transaction helper opens another SQLite connection. SQLCipher key state and the
new file's first-page salt are connection-local, so migration of a fresh encrypted store cannot
cross that connection boundary.

Correction commit `04399fa7ef8b3e58e44e82a81c0b0757acae1adc`, tree
`ecf5e6f9f5dbe83d9100deb98ab6126ef7473ead`:

- opens one non-cached runtime-owned Expo SQLite actor connection;
- applies `PRAGMA key` and `BEGIN EXCLUSIVE`/migration/commit on that same connection;
- retains fail-closed cipher and database integrity checks;
- disables Android application backup and SecureStore automatic backup configuration;
- generates explicit legacy and Android-12+ exclusions for SecureStore, Expo SQLite and database
  data across cloud backup and device transfer; and
- makes the synthetic release build fail if its effective manifest/resources omit this boundary.

Native verification used the same approved Galaxy A33 5G on Android 15. The exact corrected product
APK passed both a cleared-data clean first start and force-stop/cold encrypted reopen without any
SQLCipher/SQLite/FATAL record. A controlled native diagnostic using the same connection/store path
proved correct-key reopen succeeds, a wrong key fails protected at cipher integrity, and a missing
SecureStore key fails protected as `missing_key`; neither negative path deleted or rebound the
database. Effective manifest/resources passed the backup-boundary verifier.

- corrected APK SHA-256:
  `289885a6f123f070d82f79e85aaaddb87658305e3bc8caafd1def4c8158b732e`;
- corrected APK size: 95,416,211 bytes;
- complete local tests: 1,628/1,628;
- Mobile: 385/385 in 28 files;
- all 15 Workspace typechecks and all available Workspace builds: passed;
- Android release: 690 tasks, passed; and
- exact-head GitHub Actions run `29695449737`, attempt 1: 10/10 jobs passed.

This verification is correction evidence, not a restarted Gate A–E observation. The app was
force-stopped and its synthetic package data cleared after the diagnostic. No authentication,
lease activation, NFC scan or lifecycle mutation was performed.

## 8. Independent exact-delta review

The independent read-only review bound:

- failed-evidence baseline `bd1ad611c7f594caef70bc55308cd2155bb5735d`, tree
  `02bb5c449c6867cb2280ee6aa912a4c9dbc4070f`;
- correction `04399fa7ef8b3e58e44e82a81c0b0757acae1adc`, tree
  `ecf5e6f9f5dbe83d9100deb98ab6126ef7473ead`;
- reviewed ADO head `76be116a5b3d62298bff5d784213a6da9a446c66`, tree
  `d320db3d77c9352422c73aaff378a4a18ff1396e`; and
- exact-head runs `29695449737` and `29695605706`, both attempt 1 and ten of ten successful.

It independently confirmed the same-connection SQLCipher transaction bracket, actor
serialization, fail-closed wrong/missing-key behavior, Android backup/cloud/device-transfer
exclusions and governance truth. Verdict: **APPROVED**, zero open P0/P1/P2/P3;
`DA1-PHYS-01` closed.

The review's PostgreSQL/native/device reproduction was limited by its sandbox. It classified that
environmental limitation as transparent and non-finding because the reviewed source/tests,
build-enforced verifier, two exact-head CI runs and recorded native evidence jointly carry the
claim. Full device behavior will be observed again in any separately authorized fresh gate.

Full review:
`ADO/05_Evidence/Development_Assignment_01_DA1_PHYS_01_Independent_Exact_Delta_Review.md`.

## 9. Second complete fresh restart authorization

After the independent approval recorded in Section 8 and green synchronization-head CI, the Human
Architect explicitly authorized a second complete fresh Gate-A–E run bound to:

- independently approved product correction
  `04399fa7ef8b3e58e44e82a81c0b0757acae1adc`, tree
  `ecf5e6f9f5dbe83d9100deb98ab6126ef7473ead`;
- ADO synchronization head `fb4a4e4b1c457112372770b9e4e6532f9dca0555`, tree
  `90425dec113ddf1f1569a2a986faf878cd93bfdb`; and
- exact-head GitHub Actions run `29696026676`, attempt 1, ten of ten jobs successful.

The authorization required a complete restart at Gate A step 1 and prohibited reuse of every
observation from the first failed attempt. Production resources/data, deployment and distribution
remained unauthorized.

## 10. Second fresh run — prerequisite and Gate A observations

The approved Galaxy A33 5G on Android 15 was connected over USB. The exact corrected APK was
installed from a clean package state and verified on the device:

```text
APK SHA-256=289885a6f123f070d82f79e85aaaddb87658305e3bc8caafd1def4c8158b732e
APK size=95416211 bytes
AirplaneMode=off
NfcState=on
AuthReverseMappings=1
ApiReverseMappings=1
```

The strictly local synthetic backend began from a newly created disposable database. The approved
Administration path prepared both physical tags again. Safe resulting state was:

```text
Customers=2
NfcTags=2
ActiveNfcAssignments=2
AdminSetupReceipts=2
AuditEvents=4
WorkEvents=0
SyncReceipts=0
CanonicalDecisions=0
TimeEntries=0
```

Because the encrypted local database is deliberately bound to one owner, attempting to reuse the
Admin-owned local store for the Employee failed closed as `protected_pending`. This was prerequisite
setup behavior, not an accepted Gate-A observation. With no pending evidence, the synthetic app was
then removed and the same hash-verified APK was reinstalled from a clean package state for the
Employee run; the server-side two-tag setup remained intact.

### 10.1 Gate A steps 1–2

The enrolled synthetic Employee authenticated while the local backend was reachable. The app
reached **Bereit zum Scannen**. Sanitized server inspection proved the complete Employee projection:

```text
EmployeeLeases=1
EmployeeLeaseDeclaredItems=2
EmployeeLeaseItems=2
ActiveNfcAssignments=2
ActiveCustomers=2
WorkEvents=0
```

No tag was scanned.

### 10.2 Gate A step 3

The Human tester enabled airplane mode. System inspection confirmed airplane mode active and NFC
still enabled. Both USB API reverse mappings were removed, leaving the application unable to reach
either the synthetic Auth listener or the TapTim.e API. The app was force-stopped and relaunched
from its installed release package; no Metro process participated.

### 10.3 Gate A step 4 failure

Instead of the mandatory explicit **Offline bereit** state with queue count zero, the exact app
showed:

```text
Sitzung wird sicher wiederhergestellt …
TapTim.e ist derzeit nicht verfügbar.
```

Logcat showed repeated connection refusal to the configured numeric-loopback Auth endpoint after
the cold start. No SQLCipher, SQLite, key-loss or database-integrity failure occurred. The server
remained at zero WorkEvents/SyncReceipts/CanonicalDecisions/TimeEntries. No Gate-A tag scan
occurred, and Gates B–E were not started.

## 11. Historical finding and disposition

### DA1-PHYS-02 — P1 — True offline cold start cannot expose the valid local capture lease

The complete two-item Employee lease is durably activated before airplane mode, but a true cold
start with both Auth and API unreachable cannot reach the authorized offline-capture UI:

1. `MobileSessionCoordinator.performRefresh()` maps transient provider-refresh unavailability to
   `runtime_unavailable`, not to the typed transient restoration state from which the offline
   coordinator may validate its local lease; and
2. `AppNavigator` renders a generic retry/sign-out message for `context_unavailable` and does not
   render the `ScanScreen` when the offline coordinator has independently reached
   `offline_ready`.

The behavior fails closed and discloses no old-owner detail, but it blocks the primary true
cold-start offline capability explicitly required by Authorization Section 9 and ADR-0012.
Severity is therefore P1.

The focused correction must preserve all existing authority and numeric policies while proving:

- transient Auth and/or API unreachability after a persisted refresh token does not become a
  storage/runtime failure;
- only a valid, same-owner, same-installation, unexpired local lease may enable the offline
  capture shell;
- rejection, logout, missing/corrupt storage, owner mismatch and expired/invalid lease remain
  fail-closed;
- the safe offline shell exposes no token, identifier or old-owner detail;
- the exact native build reaches **Offline bereit** after airplane-mode force-stop/relaunch with
  both local listeners unreachable; and
- all prior Mobile/session/navigation/offline tests plus new regressions remain green.

Disposition: **Repository finding closed by the independently approved correction recorded in
Section 14.** No production-code correction was performed during the failed gate itself, the
failed observation remains failed, and no later physical observation is claimed.

## 12. Second-run gate disposition and cleanup

| Gate | Result |
|---|---|
| A — lease and true cold-start offline capture | **FAILED / BLOCKED at step 4** |
| B — automatic FIFO synchronization | Not started |
| C — idempotency and lost response | Not started |
| D — stale authority/configuration fail closed | Not started |
| E — background capability truth and cleanup | Functional observations not started; abort cleanup completed |

No observation from either failed attempt may be reused in a later complete Gate-A–E run.

Abort cleanup was verified:

- airplane mode off;
- synthetic Mobile process stopped and package removed;
- no Admin Web session started;
- local harness/listeners stopped;
- disposable database count: `0`;
- generated synthetic PostgreSQL role count: `0`;
- USB reverse mapping count: `0`; and
- clipboard cleared.

No password, token, key, provider subject, raw NFC UID, internal identifier or personal data was
recorded.

## 13. Focused correction and verification

Focused correction `e17fcb3f1286095c345e6a4ce965790361901099`, tree
`44320bc8bb5a25b71300c03d8d50c5a8561ebf0a`, changes only ten Mobile source/test files:

- transient provider-refresh failure now suspends access authority, clears the access token and
  authenticated snapshot, preserves only the stored refresh path and enters
  `context_unavailable`;
- `retryContext()` re-enters the existing refresh single-flight when authority is suspended, and a
  stale failing refresh cannot override a newer provider event;
- a foreground/network signal restores the suspended session before it schedules synchronization;
- `AppNavigator` exposes `ScanScreen` only when the session is `context_unavailable` and the
  offline coordinator has independently reached an eligible offline capture/in-progress state;
  and
- the shell shows only `Offline-Erfassung`; storage/runtime failures, logout, rejection,
  missing/invalid lease and protected identity states remain closed.

Final adversarial audit identified that an explicit new login with an unavailable backend context
must not be able to consult a retained lease from the prior identity. Hardening
`869e10f7d54e1c16a60a06a4b37ccedc5d0bfac1`, tree
`325fdd5b003e1bccaee15eeac6b0b82826316554`, changes five Mobile source/test files:

- offline restoration eligibility is established only by startup restoration from existing stored
  credentials or by a previously fully resolved authenticated session;
- explicit new login and Employee-enrollment login do not establish that eligibility until the
  backend context resolves;
- logout, rejection and storage failure clear the eligibility with all other in-memory authority;
  and
- `OfflineCaptureCoordinator` checks the eligibility before reading any local lease, so a new
  login plus backend unavailability remains inactive even if an old lease is structurally valid.

Local evidence:

- Mobile: 406/406 in 29 test files, tests-inclusive typecheck green;
- focused session/offline/navigation/screen regressions: 93/93;
- Core: 290/290; Admin Web: 44/44; offline contract: 7/7;
- all required Workspace typechecks and builds green;
- Android Expo export, `git diff --check`, backup-boundary verifier and 690-task native release
  build green; and
- candidate APK: 95,418,203 bytes, SHA-256
  `0f2e0ea9385dd34ecd3f24da4970d11ab50df77f44debf82d5b0009e7dfa44c5`.

The candidate APK was not installed and no third physical run was attempted. Exact-head GitHub
Actions runs `29696949408` and `29697397146`, each attempt 1, push to `main`, passed all ten jobs.

## 14. Independent exact-delta review

The independent read-only reviewer verified:

- the exact linear chain `c8295e5` → `e17fcb3` → `f7c66c8` → `869e10f` → `8d1a0d8`,
  including every parent and tree;
- final reviewed head `8d1a0d86539790028526e8d62c1f867c1b68fe57`, tree
  `3464697130900ed55e68acc02e5fb5af41db90a5`;
- the complete 17-file +515/-75 Mobile/ADO delta;
- exact-head runs `29696949408`, `29697168956`, `29697397146` and `29697544630`, each attempt 1
  and ten of ten successful;
- Mobile 406/406, the exact 93/93 focused regressions, tests-inclusive Mobile typecheck, Core
  290/290, Admin Web 44/44, Offline Contract 7/7 and Administration Contract 4/4; and
- transient suspension, retry/race safety, pre-read cross-identity restoration binding, unchanged
  owner/install/time/completeness checks, disclosure-free navigation and
  restoration-before-scheduling.

Verdict: **APPROVED**, zero open P0/P1/P2/P3; `DA1-PHYS-02` repository finding closed.

The review sandbox lacked the Android toolchain/device and did not independently reproduce the
native build, backup verifier or APK hash. This transparent environment limit was accepted as a
non-finding because the changed JavaScript orchestration was fully reproduced, all four exact-head
CI runs were green and the missing on-device behavior remains assigned to the next complete gate.

Full review:
`ADO/05_Evidence/Development_Assignment_01_DA1_PHYS_02_Independent_Exact_Delta_Review.md`.

Tree comparison confirms that `869e10f..8d1a0d8` changes only the seven declared ADO files:
Mobile product code, Admin Web and the synthetic harness are identical to product correction
`869e10f`. The still-uninstalled APK hash and size recorded in Section 13 therefore remain bound
to the independently reviewed product code. This review synchronization also changes ADO only.

## 15. Historical next step after DA1-PHYS-02 review

After that review synchronization received a green exact-head CI run, the Human Architect could
separately authorize a third complete fresh Gate-A–E run. That authorization had to bind the
approved product correction, reviewed ADO head, this synchronization head, exact CI and exact
APK/Web/harness artifacts. The run had to restart at Gate A step 1 and reuse no observation from
either failed attempt. Sections 16–21 record the later authorization and result. Production
resources/data, deployment and distribution remained unauthorized.

## 16. Third complete fresh gate authorization and artifact binding

The Human Architect explicitly authorized the complete third fresh Gate A–E run from step 1,
reusing no observation from either failed predecessor. The authorization bound:

- independently approved product correction
  `869e10f7d54e1c16a60a06a4b37ccedc5d0bfac1`, tree
  `325fdd5b003e1bccaee15eeac6b0b82826316554`;
- independently reviewed ADO head `8d1a0d86539790028526e8d62c1f867c1b68fe57`, tree
  `3464697130900ed55e68acc02e5fb5af41db90a5`;
- review synchronization head `bc89c70bda3be78355964cd27cb462170670eeaa`, tree
  `b7a64a9c7a94454ffd4f7cf981b788369a2d9e63`;
- exact-head GitHub Actions run `29697976617`, attempt 1, ten of ten jobs successful; and
- the previously uninstalled candidate APK of 95,418,203 bytes with SHA-256
  `0f2e0ea9385dd34ecd3f24da4970d11ab50df77f44debf82d5b0009e7dfa44c5`.

Only local synthetic Android/Web/API/PostgreSQL resources, the approved Galaxy A33 on Android 15
and the two approved NTAG213 tags participated. Production resources/data, deployment and
distribution remained unauthorized.

## 17. Third-run observations through Gate C

Gate A passed from a clean install. Administrator setup, Employee authentication, the complete
two-item lease, airplane-mode cold restart and true offline A→B→A capture were observed afresh.
The encrypted FIFO reported one, two and three pending operations in order and retained all three
across force-stop.

Gate B passed. Restoration required no manual retry. Exact server evidence showed sequence 1
started Tag A, sequence 2 was rejected as `active_entry_for_other_target_rejected`, and sequence 3
stopped Tag A. The queue reached zero; three WorkEvents, three Receipts and three canonical
Decisions existed with one stopped TimeEntry.

Gate C passed with the strictly local response-dropping proxy. One Tag-A event committed on the
server while its response was withheld. Automatic recovery reconciled the exact event without a
second WorkEvent, Receipt, Decision or TimeEntry mutation and cleared the local queue.

## 18. Gate D failure: DA1-PHYS-03

After controlled historical-valid setup, the decisive stale sequence was created as follows:

1. while the Employee device remained offline, sequence 11 captured Tag A under
   `SYNTHETIC ANDROID CUSTOMER`;
2. Admin Web reassigned Tag A to `SYNTHETIC REASSIGNMENT TARGET`;
3. sequence 12 captured stale Tag A under the old local generation; and
4. sequence 13 captured Tag B as the later FIFO successor.

After automatic restore, exact server evidence was:

| Sequence | Durable result | Reason / decision |
|---:|---|---|
| 11 | `synchronized` | `active_entry_for_other_target_rejected` |
| 12 | `review_pending` | `historical_configuration_not_valid`; no canonical decision |
| 13 | `review_pending` | `predecessor_requires_review`; no canonical decision |

The server cursor ended at durable sequence 13 with review predecessor 12. Sequences 11–13 created
exactly one canonical decision and zero TimeEntries. Final sanitized counts were four
Administration setup receipts, 21 AuditEvents, 11 canonical Decisions, two Customers, four NFC
Assignments, two NFC Tags, 13 synchronization Receipts, three TimeEntries with two stopped, and
13 WorkEvents. Server-canonical authority, FIFO blocking and no-duplicate safety therefore passed.

The mandatory Mobile truth requirement failed: after the exact local acknowledgements removed the
queue rows, a later authenticated session/lease refresh replaced `Sichere Prüfung erforderlich`
with `Bereit zum Scannen`, even though sequence 12 remained an unresolved server review
predecessor. Later captures could consequently appear normal while the server still forced them
to review. This is `DA1-PHYS-03` (P1). The fault is user-state truthfulness and durable local
review visibility; no unauthorized lifecycle mutation or sensitive disclosure occurred.

Gate E was not started. No observation from this failed third run may be reused in a later run.

## 19. Abort cleanup

The synthetic Android session and Admin Web session were signed out. The app was uninstalled,
browser closed, local Vite/harness processes stopped, disposable database dropped, generated
synthetic roles removed, USB reverse mappings removed and clipboard cleared. The package, local
listeners and synthetic database were absent afterward. The pre-existing B1 reference database
and its two roles were not part of the gate and were preserved. No secret, token, provider
subject, raw NFC UID, internal identifier or personal data was recorded.

## 20. Focused DA1-PHYS-03 correction

Product correction `7dbda3bc0a56009c7e6931e3ad8320514f64f4a8`, tree
`e6abc9ebaadc70cf4b2f78caa46f332b3fb21309`, changes only seven Mobile/offline-contract
source and test files:

- local SQLCipher schema version 2 adds an owner-bound nullable
  `review_pending_sequence`, with an exclusive version-1-to-2 migration;
- a durable `review_pending` acknowledgement records the earliest review sequence atomically in
  the same exclusive transaction before deleting the exact FIFO head;
- identity mismatch or deletion mismatch rolls the marker and deletion back together;
- scheduler empty-queue handling and coordinator session/lease restoration read the encrypted
  marker fail-closed; the marker dominates `idle`, authenticated-ready and offline-ready states;
  and
- no automatic clear, remote adjudication, lifecycle decision, authority rule or numeric
  ADR-0012 policy was added or changed.

Regression evidence proves fresh schema version 2, exclusive version-1 migration, atomic
marker/deletion rollback, persistence after queue deletion, and dominance across an empty later
session-restored trigger and authenticated lease restoration. Local Mobile passes 409/409 in
29 files; Offline Contract passes 7/7; both tests-inclusive TypeScript checks, all 15 Workspace
typechecks, all available Workspace builds, Android export, dependency graph, migration ledger,
`git diff --check`, backup-boundary verification and the 690-task native release build pass.
The broader local matrix passed 1,642 tests with ten environment-gated synthetic tests and two
unchanged optional Supavisor modes skipped.

Exact-head GitHub Actions run `29700339367`, attempt 1, push to `main`, passed all ten jobs. The
exact uninstalled correction artifact built from `7dbda3b` is 95,422,571 bytes with SHA-256
`e634f03a0eedf43a3c1d2d7d94213c223ea13c627556e641e39c9d08c4f93623`.

Independent exact-delta review of final ADO head `798bada`, tree `d181370`, returned
`APPROVED` with zero open P0/P1/P2/P3. `DA1-PHYS-03` is closed as a repository finding.
No corrected physical result, fourth-run authorization, production authority, deployment or
distribution was claimed at that point.

## 21. Historical next step after the third-run failure

The required ADO synchronization and exact-head CI were published, followed by the independent
read-only exact-delta review recorded in Section 22. At that point, a fourth complete fresh
Gate A–E run still required a new, separate Human-Architect authorization and could reuse no
observation from any failed run.

## 22. Independent exact-delta review

The independent reviewer verified:

- predecessor `bc89c70`, tree `b7a64a9`;
- product correction `7dbda3b`, tree `e6abc9e`;
- reviewed ADO head `798bada`, tree `d181370`;
- the exact 14-file +557/-63 delta;
- product run `29700339367` and ADO run `29700546787`, each attempt 1 and ten of ten green;
- Mobile 409/409, Offline Contract 7/7, Core 290/290, Admin Web 44/44 and Administration
  Contract 4/4;
- tests-inclusive Mobile and Offline Contract typechecks; and
- atomic marker/head deletion, exclusive version-1 migration, earliest-marker retention,
  owner/identity binding and fail-closed Coordinator/Scheduler dominance.

Verdict: **APPROVED**, zero open P0/P1/P2/P3. `DA1-PHYS-03` is closed as a repository finding.

The reviewer transparently did not reproduce PostgreSQL/native Android checks or the host APK
path in its sandbox. This was accepted as a non-finding because both exact-head ten-job runs are
green, the changed behavior is regression-tested and the missing corrected on-device proof remains
assigned to the next separately authorized complete gate.

Full review:
`ADO/05_Evidence/Development_Assignment_01_DA1_PHYS_03_Independent_Exact_Delta_Review.md`.

## 23. Historical next step after DA1-PHYS-03 review

After this review synchronization had green exact-head CI, the Human Architect could separately
authorize a fourth complete fresh Gate A–E run. The authorization had to bind product correction
`7dbda3b`, reviewed ADO head `798bada`, this review-synchronization head and CI, and the exact
APK/Web/harness artifacts. The run had to begin at Gate A step 1 and reuse no observation from any
of the three failed runs. That review did not itself authorize or start the run.

Production resources/data, deployment and distribution remain unauthorized.

## 24. Fourth complete fresh gate authorization and exact binding

The Human Architect separately authorized a fourth complete fresh Gate A–E run from Gate A step 1,
reusing no observation from any of the three failed predecessors. The authorization bound:

- independently approved product correction
  `7dbda3bc0a56009c7e6931e3ad8320514f64f4a8`, tree
  `e6abc9ebaadc70cf4b2f78caa46f332b3fb21309`;
- independently reviewed ADO head `798bada77a4fbc7ba235bc692afcf3bd9ffc760b`,
  tree `d181370ca6e2199ca76d46313ad57113c52cd100`;
- review synchronization head `73b5105ba23f667c2a6ee0f12fce171da85bb036`,
  tree `2a87a324c1a967a8573852c5387a18ce5adcba75`;
- exact-head GitHub Actions run `29714165784`, attempt 1, push to `main`, ten of ten jobs
  successful; and
- the previously uninstalled 95,422,571-byte candidate APK with SHA-256
  `e634f03a0eedf43a3c1d2d7d94213c223ea13c627556e641e39c9d08c4f93623`,
  plus the unchanged Web/harness artifacts from the same product state.

Only the approved Galaxy A33 5G on Android 15, two stable NTAG213 tags, numeric-loopback USB
forwarding and strictly local synthetic Android/Auth/API/PostgreSQL resources participated.
Production resources/data, deployment and distribution remained unauthorized.

## 25. Separated preflight reset

An initial technical preflight installed the exact APK and began the real Administrator setup.
Before any Employee Gate-A observation, the Technical Lead detected that the legacy fixture-only
`arm-tag-a` operator control had been armed unnecessarily and remained `armed` after the real
Administration path created the first Tag.

That preflight was not reused. The harness, schema, generated roles, disposable database, package,
reverse mappings and clipboard were completely cleared. Verification showed zero schema, zero
generated runtime roles, no package, no database, no listener on ports 3000/5173/54321 and zero
reverse mappings. A new disposable database, new memory-only synthetic password and new exact APK
installation were then created. The fourth run observations below begin only after that complete
reset; no preflight setup or observation contributes to them.

## 26. Fourth-run prerequisite and Gate A result

The counted fourth run freshly proved:

- host and installed-device APK SHA-256 both exactly
  `e634f03a0eedf43a3c1d2d7d94213c223ea13c627556e641e39c9d08c4f93623`;
- `provisioning=disarmed`, airplane mode off, NFC on and exactly the two approved loopback reverse
  mappings before setup;
- the real Administrator path created `DA1 TAG A` / `B55E8B6AEB30` and `DA1 TAG B` /
  `32A54C8F2F29` for the two synthetic Customers;
- the safe prerequisite snapshot was two Customers, two Tags, two active Assignments, two
  administration receipts, four AuditEvents and zero WorkEvents/SyncReceipts/CanonicalDecisions/
  TimeEntries; and
- the Administrator signed out, followed by a clean reinstall of the same hash-verified APK for
  the Employee while the server setup remained unchanged.

Gate A steps 1–4 passed afresh:

1. the strictly local harness and exact reviewed APK started cleanly;
2. the enrolled Employee reached `Bereit zum Scannen`; read-only aggregate proof showed one
   Employee lease, two declared items, two stored items, one lease receipt, two active Customers,
   two active Assignments and zero lifecycle rows;
3. airplane mode was enabled, NFC remained on, both reverse mappings were removed, the app was
   force-stopped and the release activity cold-started without Metro/Auth/API reachability; and
4. Mobile truthfully displayed `Offline bereit` with zero pending operations and no Start/Stop
   claim.

Gate A step 5 failed. Three separate explicit physical capture attempts reached the Android app,
but Mobile remained `Offline bereit` with zero pending operations. The required accepted A→B→A
sequence and queue progression 1/2/3 therefore were not established; exact tag order is not
inferred from diagnostic logs.

Disclosure-safe filtered Android evidence independently confirmed each attempt:

- `registerTagEvent`;
- Android `TECH_DISCOVERED` delivery through `onNewIntent`;
- `onResume`; and
- exact native capture unregistration.

There were three registrations, three physical NFC deliveries and three unregistrations, with no
fatal error, ANR, JavaScript/native bridge error, database error or secure-storage error. The
server remained exactly zero WorkEvents, zero SyncReceipts, zero CanonicalDecisions, zero
TimeEntries and zero offline cursor rows. Mobile never falsely claimed local persistence.

Gate A failed at step 5. Gates B–E were not started and no fourth-run observation may be reused.

## 27. DA1-PHYS-04 finding and read-only root-cause diagnosis

### DA1-PHYS-04 — P1 — Offline NFC foreground transition invalidates the active capture

The NFC foreground-dispatch cycle itself produces an Android foreground transition. During a valid
offline scan:

1. `OfflineSchedulingLifecycle` calls `triggerForeground()`;
2. the coordinator sees the suspended `context_unavailable` session and calls `retryContext()`;
3. the expected offline refresh failure republishes the same suspended session state;
4. the coordinator's session listener unconditionally advances its generation and transitions the
   session, cancelling the active capture; and
5. the already delivered NFC result fails the stale-generation guard and returns before
   `lookupActiveItem()` and `appendEvent()`.

The replacement transition republishes `offline_ready` with queue count zero. This matches all
three physical attempts exactly and explains why the native event succeeded without a durable
local row.

The current regression matrix does not compose this race: the authenticated persistence test uses
a no-op session subscription; the cold-start offline test reaches `offline_ready` but never scans;
the foreground/network-hint test has no concurrent NFC capture; native adapter tests isolate the
callback; and there is no `OfflineSchedulingLifecycle` integration test for the combined
pause/resume, failed retry and delivered-tag sequence.

This is P1, not P0. The primary offline capability is release-blocked, but the product failed
closed: it created no local evidence claim, no server mutation, no authority escalation and no
sensitive disclosure.

The focused correction must preserve exactly one active capture across a semantically unchanged
suspended/offline session notification, without weakening identity, generation, logout,
cross-identity or stale-async-event cancellation. Equality of the public
`context_unavailable` status alone is insufficient; unchanged identity/restoration generation must
be established from private trusted evidence, and uncertainty must still cancel. A
regressionswirksam test must reproduce:

```text
offline_ready
  -> explicit NFC scan
  -> Android pause/resume foreground hint
  -> failed context retry with unchanged suspended identity
  -> delivered physical capture
  -> exactly one durable append and queue count 1
```

No product correction or corrected physical result is claimed here.

## 28. Fourth-run abort cleanup

Complete abort cleanup passed:

- airplane mode returned to off and NFC remained on;
- the Mobile process was force-stopped and the synthetic package uninstalled;
- the Admin session had already signed out and no Admin Web session had been started;
- the harness stopped normally;
- disposable schema count, generated runtime-role count and dedicated database count were zero;
- reverse-mapping count was zero;
- listeners on ports 3000, 5173 and 54321 were absent;
- the clipboard was cleared; and
- the tracked repository remained clean.

No password, token, raw NFC UID/payload, provider subject, SQLCipher/SecureStore key, internal
database identifier or real-person data was recorded.

## 29. Historical next step after the fourth-run failure

Publish this truthful fourth-run/`DA1-PHYS-04` synchronization and obtain green exact-head CI.
Then obtain an independent read-only review of the exact authorization binding, attempt separation,
physical evidence, P1 classification, root-cause diagnosis, regression gap, cleanup and proposed
focused correction boundary.

Before any later complete gate can be authorized, the previously used disclosure-safe Gate-C
response-drop procedure must also be preserved in a durable reviewed operator runbook or helper
rather than relying on transient session history.

No fifth physical run is authorized. Production resources/data, deployment and distribution
remain unauthorized.

The failure synchronization and independent review described above were subsequently completed as
recorded in Section 30. This historical next step does not describe a correction approval.

## 30. Independent failure-synchronization review

Independent read-only review bound:

- failure-synchronization head
  `3dd798376180051c0dbd8d9e4ee058acff89b43f`, tree
  `e78b5268eb53fd5659461ee290778f7bf3bb70a0`;
- exact parent `73b5105ba23f667c2a6ee0f12fce171da85bb036`, tree
  `2a87a324c1a967a8573852c5387a18ce5adcba75`;
- the exact seven-ADO-file `+383/-61` delta; and
- exact-head GitHub Actions run `29716007657`, attempt 1, ten of ten jobs successful.

Verdict: `APPROVED`, with no P0–P3 against the fourth-run binding, attempt separation, physical
truth, P1 classification, root-cause diagnosis, cleanup or focused correction boundary.
`DA1-PHYS-04` remained open because the review did not assess or approve a product correction.
The device-bound observations were not independently reproduced and were not described as such.

Full review:
`ADO/05_Evidence/Development_Assignment_01_DA1_PHYS_04_Failure_Synchronization_Independent_Exact_Delta_Review.md`.

## 31. Separately authorized and published correction

The Human Architect subsequently authorized only the focused `DA1-PHYS-04` repository correction
on exact baseline `3dd798376180051c0dbd8d9e4ee058acff89b43f`, tree
`e78b5268eb53fd5659461ee290778f7bf3bb70a0`, with exact-head run `29716007657`. The fifth
Human Physical Gate, production resources/data, deployment and distribution remained
unauthorized.

The Technical-Lead-approved correction:

- gives the retained offline provider context a private credential-free snapshot of session
  generation, restoration revision and trusted unavailable source;
- keeps a real unchanged retry publication on the same snapshot;
- rotates the snapshot for credential, authority, source/context, storage, logout or identity
  change;
- preserves one active offline scan only while that private snapshot remains current;
- retains and compares the complete expected owner/install/lease/activation context before durable
  append; and
- continues to cancel public-status-only, uncertain, cross-identity, owner/install, storage and
  genuinely stale work fail-closed.

Local regression evidence is Mobile 415/415 in 30 files, focused Mobile 63/63 and the hardened
four-test lifecycle subset 4/4 in twenty runs. Core 290/290, Admin Web 44/44, both contracts
7/7 and 4/4, Backend Offline 13/13, Backend API 208/208, Workspace typechecks/builds, migrations
001–010 apply/rerun/ledger verification, Expo export, 656-task release build and backup boundary
pass.

The disclosure-safe Gate-C proxy/controller/runbook passes 27/27 focused tests and the fresh
PostgreSQL-17 Harness passes 45/45 in four files. The helper has not been operated in a new
physical run. The uninstalled candidate APK is 95,425,607 bytes with SHA-256
`b34572b9813c4fb8013b09a4a530e5bc88ed4730ceacda46f6fe682bca88c6c0`; it has not been
installed for corrected physical observation. The dependency audit retains the existing 11
moderate transitive `uuid@7.0.3` toolchain occurrences.

No fourth-run observation is converted into a pass and none may be reused.

## 32. Independent exact-delta correction review

The correction is published as commit
`48a21a7ed75c3ab3b15fec93669b5ca2d87d5a30`, tree
`7c053beeb0c9ef550216bd1dad0a59fc226866a6`, exact parent
`3dd798376180051c0dbd8d9e4ee058acff89b43f`, with an exact 24-file `+3027/-37` delta.
GitHub Actions run `29743923158`, attempt 1, push to `main`, is bound to that exact head and passed
ten of ten jobs. This is repository/CI evidence only and not a corrected physical observation.

ADO publication head `2f6035b1da9e7946cfca8d10c3d406a8c0b852ec`, tree
`d5513a6ec2fe99c4f2b6fae9b3452004453b965b`, exact parent `48a21a7`, changed only seven ADO
files in a `+107/-68` delta and passed exact-head run `29744637928`, attempt 1, ten of ten.

Independent read-only exact-delta review verified the complete chain, both deltas and both
exact-head CI runs. It confirmed the private credential-free continuity snapshot, preservation
only for the exact retained provider-suspended context, complete active-context revalidation and
all required fail-closed invalidations. It also confirmed the numeric-loopback one-shot Gate-C
proxy, USB-only scoped reverse controller, recovery behavior and disclosure-safe runbook.

The reviewer independently reproduced Mobile 415/415, the four-test lifecycle regression plus five
separate repetitions, Gate-C helper 27/27 and tests-inclusive Mobile/Synthetic typechecks. The
PostgreSQL Harness, migration, Android-export, release-build and exact APK evidence were
transparently not independently reproduced.

Verdict: `APPROVED`, zero open P0/P1/P2/P3. `DA1-PHYS-04` is closed as a repository finding.
The fourth failed physical run remains historical and supplies no corrected physical result.

Full review:
`ADO/05_Evidence/Development_Assignment_01_DA1_PHYS_04_Independent_Exact_Delta_Review.md`.

## 33. Current exact next step

Publish this truthful review synchronization and obtain green exact-head CI. The Human Architect
may then separately authorize a fifth complete fresh Gate A–E run bound to the independently
approved correction, the review-synchronization commit/tree and CI, the exact 95,425,607-byte APK
SHA-256 `b34572b9813c4fb8013b09a4a530e5bc88ed4730ceacda46f6fe682bca88c6c0`, unchanged
Web/Harness artifacts and the reviewed Gate-C runbook/helper.

The fifth run is not authorized by this document. If separately authorized, it starts again at
Gate A step 1 and reuses no observation from any failed run. Production resources/data, deployment
and distribution remain unauthorized.
