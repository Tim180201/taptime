# Development Assignment 1 — Human Physical Validation Evidence

Date: 2026-07-19
Status: **FAILED GATE A RETAINED AS HISTORICAL EVIDENCE; FOCUSED CORRECTION `04399fa` AND
INDEPENDENT EXACT-DELTA REVIEW APPROVED WITH ZERO OPEN P0/P1/P2/P3; DA1-PHYS-01 CLOSED;
GATES B–E NOT STARTED; COMPLETE FRESH GATE-A–E RESTART REQUIRES SEPARATE HUMAN AUTHORIZATION**
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

## 9. Exact next step

Bind the approved correction product head, the current ADO synchronization head, exact-head CI and
the exact APK/Web/harness artifacts. The Human Architect may then separately authorize a complete
fresh restart of Gates A–E at Gate A step 1. No observation from this failed attempt may be reused.
Production resources/data, deployment and distribution remain unauthorized.
