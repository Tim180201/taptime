# Development Assignment 1 — Complete Offline Synchronization Implementation Evidence

Status: **REPOSITORY IMPLEMENTATION PUBLISHED AND TECHNICAL-LEAD APPROVED — ORIGINAL
IMPLEMENTATION EXACT-HEAD CI 10/10 GREEN; INDEPENDENT IMPLEMENTATION REVIEW RETURNED CHANGES
REQUIRED FOR DA1-IMPL-01 (P2); FOCUSED CORRECTION `c71399a`, TREE `7a159ce`, PUBLISHED AND
EXACT-HEAD RUN `29692113159` 10/10 GREEN; INDEPENDENT EXACT-DELTA RE-REVIEW OF FINAL HEAD
`767043d`, TREE `19c434a`, APPROVED WITH ZERO OPEN P0/P1/P2/P3 AND DA1-IMPL-01 CLOSED;
COMPLETE FRESH HUMAN PHYSICAL GATE AUTHORIZED ON ADO HEAD `72dc39e` AND EXACT-HEAD RUN
`29692785824`, BUT GATE A FAILED BEFORE LEASE ACTIVATION WITH DA1-PHYS-01 (P1); GATES B–E NOT
STARTED; FOCUSED CORRECTION `04399fa`, TREE `ecf5e6f`, AND EXACT-HEAD RUN `29695449737` 10/10
GREEN; INDEPENDENT EXACT-DELTA REVIEW OF HEAD `76be116`, TREE `d320db3`, AND RUN `29695605706`
APPROVED WITH ZERO OPEN P0/P1/P2/P3; DA1-PHYS-01 CLOSED; COMPLETE FRESH GATE-A–E RESTART
AUTHORIZED ON PRODUCT `04399fa`, ADO HEAD `fb4a4e4` AND RUN `29696026676`, BUT GATE A FAILED
AT STEP 4 WITH DA1-PHYS-02 (P1); FOCUSED CORRECTION `e17fcb3` PLUS CROSS-IDENTITY HARDENING
`869e10f`, FINAL TREE `325fdd5`, PUBLISHED AND EXACT-HEAD RUNS `29696949408` AND `29697397146`
EACH 10/10 GREEN; INDEPENDENT EXACT-DELTA REVIEW OF HEAD `8d1a0d8`, TREE `3464697`, APPROVED
WITH ZERO OPEN P0/P1/P2/P3; DA1-PHYS-02 REPOSITORY FINDING CLOSED; THIRD COMPLETE FRESH
PHYSICAL GATE NOT YET AUTHORIZED; PRODUCTION, DEPLOYMENT AND DISTRIBUTION NOT AUTHORIZED**
Date: 2026-07-19
Human-Accepted Contract Commit: `592334160655cde2f4189712eaf327c8a7edcb0e`
Implementation Baseline Commit: `180093091c47a926b5871a27ea8b00fb21b9b4ac`
Implementation Baseline Tree: `73e77b6ca5dfd7671cdd3d77a344168fddff3627`
Implementation Commit: `4f51918993e02b7bf51a1194f8d4d750abfae7c4`
Implementation Tree: `617081f34e34cbf5e314a26f4cc634c846c2e319`
Implementation Exact-head CI: GitHub Actions run `29675842388`, attempt 1, push to `main`, 10/10
jobs successful
DA1-IMPL-01 Correction Commit: `c71399a349ec5615acee5abc13eda726bcdaa84f`
DA1-IMPL-01 Correction Tree: `7a159ce6e21548c69dd2a77fed3e17f3e7865212`
DA1-IMPL-01 Correction Exact-head CI: GitHub Actions run `29692113159`, attempt 1, push to `main`,
10/10 jobs successful
Independent Exact-delta Re-review Head: `767043d8f91bc2806cb1bd111989cf9b741b858c`
Independent Exact-delta Re-review Tree: `19c434a8ba4586aeb1344778cbe483504ce46a34`
Final Reviewed-head CI: GitHub Actions run `29692304824`, attempt 1, push to `main`, 10/10 jobs
successful
Independent Exact-delta Re-review Verdict: **APPROVED — zero open P0/P1/P2/P3;
DA1-IMPL-01 closed**
DA1-PHYS-01 Correction Commit: `04399fa7ef8b3e58e44e82a81c0b0757acae1adc`
DA1-PHYS-01 Correction Tree: `ecf5e6f9f5dbe83d9100deb98ab6126ef7473ead`
DA1-PHYS-01 Correction Exact-head CI: GitHub Actions run `29695449737`, attempt 1, push to `main`,
10/10 jobs successful
DA1-PHYS-01 Correction Reviewed Head:
`76be116a5b3d62298bff5d784213a6da9a446c66`
DA1-PHYS-01 Correction Reviewed Tree:
`d320db3d77c9352422c73aaff378a4a18ff1396e`
DA1-PHYS-01 Correction Reviewed-head CI: GitHub Actions run `29695605706`, attempt 1, push to
`main`, 10/10 jobs successful
DA1-PHYS-01 Correction Review: **APPROVED — zero open P0/P1/P2/P3; finding closed**
Second Fresh Physical-gate Binding: product `04399fa7ef8b3e58e44e82a81c0b0757acae1adc`,
ADO head `fb4a4e4b1c457112372770b9e4e6532f9dca0555`, exact-head run `29696026676`
Second Fresh Physical-gate Result: **Gate A failed at step 4; DA1-PHYS-02 opened as P1; Gates B–E
not started; repository finding later closed by independent review**
DA1-PHYS-02 Correction Commit: `e17fcb3f1286095c345e6a4ce965790361901099`
DA1-PHYS-02 Correction Tree: `44320bc8bb5a25b71300c03d8d50c5a8561ebf0a`
DA1-PHYS-02 Correction Exact-head CI: GitHub Actions run `29696949408`, attempt 1, push to `main`,
10/10 jobs successful
DA1-PHYS-02 Initial ADO Synchronization Head:
`f7c66c834590f5ab7af87651bf7537ac1296d9cd`
DA1-PHYS-02 Initial ADO Synchronization Tree:
`1862fd117423b97e607d8fd412bc1a34b9fe0715`
DA1-PHYS-02 Initial ADO Exact-head CI: GitHub Actions run `29697168956`, attempt 1, push to `main`,
10/10 jobs successful
DA1-PHYS-02 Cross-identity Hardening Commit:
`869e10f7d54e1c16a60a06a4b37ccedc5d0bfac1`
DA1-PHYS-02 Final Product Tree: `325fdd5b003e1bccaee15eeac6b0b82826316554`
DA1-PHYS-02 Hardening Exact-head CI: GitHub Actions run `29697397146`, attempt 1, push to `main`,
10/10 jobs successful
DA1-PHYS-02 Independently Reviewed Head:
`8d1a0d86539790028526e8d62c1f867c1b68fe57`
DA1-PHYS-02 Independently Reviewed Tree:
`3464697130900ed55e68acc02e5fb5af41db90a5`
DA1-PHYS-02 Reviewed-head CI: GitHub Actions run `29697544630`, attempt 1, push to `main`, 10/10
jobs successful
DA1-PHYS-02 Review: **APPROVED — zero open P0/P1/P2/P3; repository finding closed**
Architecture:
`ADO/01_Architecture/ADR/ADR-0012-complete-offline-synchronization-platform.md`
Authorization:
`ADO/02_Development/Development_Assignment_01_Complete_Offline_Synchronization_Authorization.md`
Implementation Plan:
`ADO/02_Development/Development_Assignment_01_Complete_Offline_Synchronization_Implementation_Plan.md`
Independent Implementation Review and Correction Disposition:
`ADO/05_Evidence/Development_Assignment_01_Independent_Implementation_Review.md`
Owner: Technical Lead

## 1. Authority and exact scope

The Human Architect separately authorized repository implementation of Development Assignment 1,
Workstreams A–E, from the exact baseline above after accepting ADR-0012 and Authorization Sections
3–13. The implementation stays inside that release:

- repository contracts, dependencies, migration `010`, backend/API, Mobile/native and automated
  verification only;
- no production resource, production data, deployment or distribution;
- no Human Physical Gate execution or claim;
- the server remains the sole lifecycle authority;
- accepted numeric and authority policies are unchanged.

`research/` was not read, listed or modified during implementation.

## 2. Implemented repository boundary

### Shared contract and cryptography

- New decision-free `@taptime/offline-sync-contract` workspace with closed lease, event,
  reconciliation, local-state and UI-safe unions.
- Accepted numeric limits are centralized and immutable: 12-hour lease, five-minute anchor
  tolerance, 72-hour automatic window, 4,096 items/4 MiB activation, 256 events/1 MiB unresolved
  queue, 16-KiB request/response, 64-KiB lease-page response and 1–900-second retry bounds.
- Node and Mobile share exact canonical framing, validation and golden HMAC-SHA-256/manifest
  vectors. The raw NFC payload and lookup key do not enter lease persistence or result contracts.

### PostgreSQL and least privilege

- Additive migration `010_complete_offline_synchronization.sql`; migrations `001`–`009` and their
  ledger semantics remain intact.
- Organization-qualified, forced-RLS offline installation, lease, item, receipt, cursor and
  reconciliation tables.
- Three distinct executor roles and three distinct non-login function owners for lease,
  event-ingestion and reconciliation capabilities. Roles are normalized fail-closed on rerun and
  receive no sibling membership, DDL, arbitrary role selection or general table authority.
- Runtime functions are `PUBLIC`-revoked, fixed-search-path capabilities. The additional
  predecessor check prevents a later installation from bypassing unresolved review evidence for
  the same Organization/User.
- Exact event/sequence/receipt collision precedence, advisory locking, atomic cursor advance,
  immutable durable result identity and lost-response reconciliation are covered by PostgreSQL
  integration tests.
- Historical Assignment/Customer deactivation after physical capture remains valid only for the
  earlier captured interval. Missing historical configuration is non-durable
  `temporarily_unavailable`; it is never silently adjudicated.

### Backend and HTTP

- New `@taptime/backend-offline-sync` package owns authenticated lease issue/page, one-event FIFO
  ingestion and exact-ID reconciliation.
- Four exact routes were added:
  `POST /v1/offline-capture-leases`,
  `POST /v1/offline-capture-leases/page`,
  `POST /v1/lifecycle-events/offline` and
  `POST /v1/lifecycle-events/reconcile`.
- Runtime composition requires three username-distinct PostgreSQL URLs in addition to every
  existing pool. Duplicate usernames and request-selected role/authority hints fail closed.
- Strict exact-key parsing, canonical UUID/base64url/timestamp validation, body and response byte
  limits, ten-second deadline, bounded `Retry-After`, disclosure-safe diagnostics and closed result
  mapping are exercised through the real HTTP server.
- The CI remains ten jobs; the neutral offline contract is built/tested in Quality, the real
  PostgreSQL offline matrix runs in the API job, and the synthetic job builds every new dependency.

### Mobile and Android

- Separate SecureStore-held 256-bit installation binding, lookup key and SQLCipher key.
- One SQLCipher-backed database actor verifies cipher integrity/schema, owns exclusive
  transactions, assembles immutable lease generations, appends evidence before network work,
  enforces FIFO/size limits and quarantines ambiguous or corrupt state without deletion.
- E1/E2A legacy evidence is read back before clear and imported only under the accepted
  review-safe rules.
- Lease pagination rejects duplicate items/lookups, cross-owner/header drift, manifest mismatch,
  non-adjacent cursor cycles, more than 41 page responses and incomplete/oversize activation.
- One process-wide single-flight scheduler handles runtime/session/foreground/append/network/manual
  and background triggers. Network is only a hint; Expo background execution remains explicitly
  best effort.
- A local Expo native module supplies Android boot marker and
  `SystemClock.elapsedRealtime()` evidence. Expo SQLite is configured with SQLCipher and the
  background/network/task modules are tracked.
- Scan UI receives only immutable safe states such as locally saved, synchronizing, server review,
  server decision or protected. It receives no token, key, SQL, raw UID or client lifecycle
  decision capability.

## 3. Adversarial and failure evidence

The focused suites prove:

- exact lease idempotency, immutable pagination and projection digest;
- cross-Organization, cross-User, cross-installation and sibling-role rejection;
- later revocation/historical capture separation and 72-hour review transition;
- event, device-sequence and receipt collision fail-closed behavior with zero extra writes;
- sequence gaps, lock retry, lost response, exact reconciliation and same-result replay;
- unresolved review predecessor propagation across installations;
- transactional queue append, capacity exhaustion without eviction, startup recovery, logout
  protection and identity/key mismatch quarantine;
- persist-first scan behavior, single-flight FIFO, no later-event bypass and bounded retry jitter;
- legacy read-back-before-clear, injected migration/write failure and protected-v1 disposition;
- API extra-field/header/size/timeout/diagnostic rejection; and
- extended synthetic lease → offline capture → synchronization/reconciliation state.

No raw NFC payload, access token, SecureStore secret or SQLCipher key is persisted in server offline
tables, API diagnostics or React state.

## 4. Fresh local verification

Node 24, PostgreSQL 17 and Android release verification:

| Scope | Result |
|---|---:|
| Core | 290/290, 43 files |
| Mobile | 383/383, 27 files |
| Admin Web | 44/44, 5 files |
| Administration contract | 4/4 |
| Offline synchronization contract | 7/7 |
| Backend Schema | 125/125 |
| Backend Identity | 55/55 |
| Backend Read Model | 42/42 |
| Backend Lifecycle | 88/88 |
| Backend Bootstrap | 189/189 |
| Backend Administration | 121/121, 3 files |
| Backend Offline Synchronization | 13/13, 2 files |
| Backend API | 208/208, 6 files |
| Synthetic Android/Auth/API/PostgreSQL harness | 18/18, 2 files |
| B1 direct PostgreSQL harness | 39 passed, 2 unchanged optional Supavisor modes skipped |
| Total passed | 1,626 |

All 15 workspace TypeScript checks passed. Their package configurations include test sources where
tests exist. All workspace builds passed, including declarations/bundles, Admin Web Vite production
build, synthetic harness bundle and built C3B CLI verification. Android Expo export passed.

A fresh generated Android release build succeeded with 690 actionable Gradle tasks. It recognized
`taptime-monotonic-clock` 1.0.0, Expo SQLite/SQLCipher, background task, network and task-manager
modules and bundled the current 848-module JavaScript graph. The local-only APK is
`/private/tmp/taptime-android-final-20260718-2148/app-release.apk`, SHA-256
`e23903cebc4d82a2e4f149f70738e7b7070318edfe34bff08f2d9065a41458c2`. The pre-existing untracked
Android tree was restored after the build and is not part of this delta.

`npm ls --all --omit=optional`, migration apply/rerun/ledger verification, CI YAML parsing and
`git diff --check` passed.

## 5. Dependency-audit disposition

`npm audit --omit=dev` reports one moderate advisory family as 11 transitive occurrences:
`uuid@7.0.3` under `expo -> @expo/config-plugins -> xcode@3.0.1`. The advisory concerns caller-
provided buffers in UUID v3/v5/v6. The pinned Xcode project generator calls only `uuid.v4()` with no
buffer and is build/prebuild tooling, not the Android/product runtime or offline data path.

The registry offers no compatible `xcode` update; `xcode@3.0.1` still requires `uuid ^7.0.3`.
`npm audit fix --force` proposes the breaking and incorrect downgrade to Expo 46. A trial forced
major override was deliberately not retained because it is outside the upstream dependency
contract. This is a documented non-exploitable toolchain disposition, not a zero-advisory claim.
It must be rechecked when Expo/config-plugins publishes a compatible dependency update.

## 6. Independent review correction, approval and remaining gates

The original Technical-Lead review found that the published Workstreams A–E implementation matched
the accepted architecture and authorization. Focused commit
`4f51918993e02b7bf51a1194f8d4d750abfae7c4`, tree
`617081f34e34cbf5e314a26f4cc634c846c2e319`, was fast-forward pushed from the exact authorized
baseline. GitHub Actions run `29675842388`, attempt 1, bound the exact implementation head and
passed all ten jobs.

The independent review of publication head `de895215b28110b8fe7129863df17795351b5795` later returned
`CHANGES REQUIRED` with exactly one P2, `DA1-IMPL-01`: the Offline Organization/User advisory-lock
input used `:` while the existing B6 boundary used U+001F. The focused local correction now uses
the byte-identical B6 key and adds a real canonical-versus-Offline PostgreSQL concurrency test. The
test observes the Offline session waiting at `pg_advisory_xact_lock`, then proves deterministic
`time_entry_started` followed by `duplicate_scan_ignored`. The complete corrected local matrix is
1,626 passed tests, all 15 Workspace TypeScript checks and all available Workspace builds. Focused
correction `c71399a349ec5615acee5abc13eda726bcdaa84f`, tree
`7a159ce6e21548c69dd2a77fed3e17f3e7865212`, passed exact-head GitHub Actions run
`29692113159`, attempt 1, with all ten jobs successful.

The renewed independent exact-delta review bound final reviewed head
`767043d8f91bc2806cb1bd111989cf9b741b858c`, tree
`19c434a8ba4586aeb1344778cbe483504ce46a34`, the exact `de89521..767043d` delta and both green
ten-job runs `29692113159` and `29692304824`. It returned **APPROVED** with zero open
P0/P1/P2/P3 and closed `DA1-IMPL-01`.

The Human Architect subsequently authorized the complete fresh Human Physical Gate. Gate A failed
at step 2 before lease activation with `DA1-PHYS-01` (P1): the exact hash-verified APK reproduced
SQLCipher page-1 HMAC/decryption failure on clean first start of the approved
Galaxy-A33/Android-15 device before authentication after package-scoped backup cleanup, app-data
clear and a probe with Android Backup Manager disabled. No Gate-A tag scan occurred and Gates B–E
were not started. See
`ADO/05_Evidence/Development_Assignment_01_Physical_Validation_Evidence.md`.

The focused `DA1-PHYS-01` correction removes Expo's second native transaction connection from the
SQLCipher path. One non-cached runtime-owned actor connection now receives the key and performs
`BEGIN EXCLUSIVE`, schema/data work and commit, preserving first-file salt and key continuity.
Android backup is disabled and generated legacy/full-backup and Android-12+ cloud/device-transfer
rules explicitly exclude SecureStore, Expo's `files/SQLite` directory and the database domain.

Native Galaxy-A33/Android-15 evidence passes the exact corrected product APK on a clean first
start and after force-stop/cold encrypted reopen. A controlled native diagnostic using the same
connection/store path proves a wrong key returns protected cipher-integrity failure, a missing
SecureStore key returns `missing_key`, and neither path deletes or rebinds the retained database.
The corrected APK is 95,416,211 bytes with SHA-256
`289885a6f123f070d82f79e85aaaddb87658305e3bc8caafd1def4c8158b732e`; its effective manifest
and generated resources passed the build-time backup-boundary verifier. Local verification passes
1,628/1,628 tests, all 15 Workspace typechecks, all available Workspace builds, dependency
tree validation, `git diff --check` and the 690-task Android release build. Exact-head run
`29695449737` passed all ten jobs.

The independent exact-delta review verified the full `bd1ad61` → `04399fa` → `76be116` chain,
the same-connection SQLCipher bracket, actor serialization, protected wrong/missing-key behavior,
Android backup/cloud/device-transfer boundaries, both exact-head ten-job CI runs and truthful ADO.
It independently reproduced Mobile 385/385 plus tests-inclusive typecheck, Core 290/290, Admin Web
44/44 and both contract suites. Verdict: **APPROVED**, zero open P0/P1/P2/P3;
`DA1-PHYS-01` closed. See
`ADO/05_Evidence/Development_Assignment_01_DA1_PHYS_01_Independent_Exact_Delta_Review.md`.

The separately authorized complete fresh restart on product `04399fa`, ADO head `fb4a4e4` and
run `29696026676` obtained a complete two-item Employee lease and reached `Bereit zum Scannen`.
After airplane mode, removal of both Auth/API reverse mappings and force-stop/relaunch, the app
showed `TapTim.e ist derzeit nicht verfügbar` instead of the mandatory explicit offline-capture
state. No tag was scanned and server WorkEvent/Receipt/Decision/TimeEntry counts remained zero.
`DA1-PHYS-02` was opened as P1; Gate A failed at step 4 and Gates B–E were not started.

Focused product correction `e17fcb3f1286095c345e6a4ce965790361901099`, tree
`44320bc8bb5a25b71300c03d8d50c5a8561ebf0a`, changes only ten Mobile source/test files:

- a transient provider refresh failure suspends provider authority, clears the in-memory access
  token and authenticated snapshot, preserves the stored refresh path, and enters the typed
  `context_unavailable` state;
- `retryContext()` uses the existing single-flight refresh path when access authority is
  suspended, while a stale refresh failure cannot override a newer accepted provider event;
- the offline coordinator can validate the still-current local lease during that typed transient
  state, and foreground/network hints restore the session before scheduling synchronization;
- React renders `ScanScreen` only for the exact offline-ready/in-progress safe state set and labels
  it `Offline-Erfassung`, without passing retained User/Organization/Membership identifiers; and
- missing/invalid local context, storage/runtime failure, rejection, logout and protected identity
  states remain closed.

The Technical Lead's final adversarial audit then identified a cross-identity ambiguity: a new
explicit login whose backend context could not be resolved might otherwise reach the same
`context_unavailable` shell and consult a retained lease from the prior identity. Follow-up
hardening `869e10f7d54e1c16a60a06a4b37ccedc5d0bfac1`, tree
`325fdd5b003e1bccaee15eeac6b0b82826316554`, changes five Mobile source/test files and binds that
lease consultation to either cold-start restoration from already stored credentials or a
previously fully resolved authenticated session. New sign-in, Employee-enrollment sign-in,
logout, rejection and storage failure clear or never establish that restoration eligibility.
Backend-unavailable explicit login therefore remains inactive even when a structurally valid old
local lease exists.

Regression evidence covers suspended cold-start restoration, concurrent retry, stale provider
events, valid and invalid local contexts, network restoration ordering, shell-state admission and
disclosure-free presentation, including the new-login/old-lease adversarial boundary. Local Mobile
verification passes 406/406 tests in 29 files, focused regressions 93/93 and its tests-inclusive
TypeScript check. Core remains 290/290 and Admin Web 44/44. Both neutral contract checks, Android
export, all required Workspace typechecks/builds, `git diff --check`, the Android backup boundary
verifier and the 690-task native release build pass. The generated but uninstalled candidate APK
is 95,418,203 bytes with SHA-256
`0f2e0ea9385dd34ecd3f24da4970d11ab50df77f44debf82d5b0009e7dfa44c5`. Exact-head GitHub
Actions runs `29696949408` and `29697397146`, each attempt 1, passed all ten jobs.

Independent read-only exact-delta review bound the complete `c8295e5` → `e17fcb3` → `f7c66c8`
→ `869e10f` → `8d1a0d8` chain, final tree
`3464697130900ed55e68acc02e5fb5af41db90a5`, exact 17-file +515/-75 delta and all four
exact-head ten-job runs. It independently reproduced Mobile 406/406, the exact 93/93 focused
regressions, tests-inclusive Mobile typecheck, Core 290/290, Admin Web 44/44, Offline Contract
7/7 and Administration Contract 4/4. It confirmed the pre-read restoration binding, unchanged
owner/install/time/completeness checks, race safety, disclosure-free shell and
restoration-before-scheduling. Verdict: **APPROVED**, zero open P0/P1/P2/P3;
`DA1-PHYS-02` repository finding closed. See
`ADO/05_Evidence/Development_Assignment_01_DA1_PHYS_02_Independent_Exact_Delta_Review.md`.

Still pending and not claimed here:

1. another separately authorized complete fresh Human Gate A–E run;
2. truthful physical closure synchronization and independent final closure review; and
3. any production resource/data, deployment or distribution decision.

DT-060–DT-062 remain open until every applicable later gate is complete.
