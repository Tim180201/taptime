# Development Assignment 3 — V5 Enablement Evidence

- Status: **AVS V0–V4/INDEPENDENT REVIEW APPROVED; FIRST AUTHORIZED PHYSICAL RUN FAILED CLOSED; DA3-PHYS-01 P1 OPEN**
- Date: 2026-07-22
- Authorized enablement baseline commit: `0b0d04034c88829fdc5c548b057e74554d4ee197`
- Authorized enablement baseline tree: `eee26501fd714738aa3ca106d93d5088261206e3`
- Product candidate commit: `6eb68a3b4f9567600e12ec5a4f4b72ca4da99dca`
- Product candidate tree: `bb8564fd0911d2b32dccb776f4a3f938621ee052`
- Product candidate CI: GitHub Actions run `29927309720`, attempt 1, **12/12 successful**
- Evidence-sync commit/tree: `f4e2eeb3bb47ed1dd3b2f0cf10fd0f725650d6ba`,
  `20e5715c448331f5d99536259743dccc7005dffb`
- Evidence-sync CI: GitHub Actions run `29928717227`, attempt 1, **12/12 successful**
- Independent V5 enablement review: **APPROVED — ZERO OPEN P0/P1/P2/P3**
- Risk class: AVS-001 **R3**
- Owner: Technical Lead
- Authorized enablement: focused local DA3 V5 harness/runbook, DA3-V5-F01, regression tests, AVS
  V0–V4 and independent review
- Later physical authority: one exact-bound run authorized and consumed by a failed Gate A
- Unauthorized now: any correction or replacement run, production, production data, deployment
  and distribution

## 1. Authority and inherited evidence

The Human Architect separately authorized the focused local V5 enablement on the exact baseline
above, including harness, runbook, AVS V0–V4 and independent review. The Human Architect then
explicitly authorized focused finding `DA3-V5-F01` on the same exact baseline: correct the Backend
API export adapter to pass only the three canonical export fields and add regression coverage.

This scope inherits, but does not replace, the independently approved DA3 implementation evidence:
implementation `0f71aca270969866037f2e31cc05ef8730e0ecd1`, tree
`e3e2ed780c217a520d382b98971991510bb99973`, exact-head run `29859522776` 12/12 and independent
review `APPROVED` with zero open P0–P3. The enablement starts from later review-synchronized head
`0b0d040`, tree `eee2650`; `main == origin/main` and the tracked worktree was clean at start.

The focused product candidate was published as `6eb68a3`, tree `bb8564f`, and its exact-head
GitHub Actions run `29927309720`, attempt 1, passed all 12 jobs. This publication and its artifact
were synchronized at Evidence head `f4e2eeb`, tree `20e5715`, whose exact-head run `29928717227`,
attempt 1, also passed all 12 jobs. Independent exact-SHA review then returned `APPROVED` with zero
open P0/P1/P2/P3 and independently confirmed the product/Evidence/CI/artifact bindings.

Untracked user-owned `app.json` and `research/` were preserved. `research/` was not read, listed,
searched or changed.

## 2. Enablement implementation

The candidate:

1. replaces the synthetic harness's DA3 unavailable stubs with the real time-export and time-review
   coordinators on three isolated runtime pools;
2. adds exact identity-resolution plus least-privilege export/read/write role graphs and complete
   cleanup coverage for the generated logins;
3. exposes only safe aggregate counts for revisions, adjudications, export audits and DA3 command
   receipts through the existing loopback operator `status` command;
4. adds a real disposable-PostgreSQL journey covering Employee denial, Administrator correction,
   legacy adjudication, effective CSV and append-only ledger/audit increments;
5. updates the harness documentation to migrations `001`–`012` and the real DA1/DA2/DA3 graph; and
6. adds the candidate-only V5 runbook with exact binding, retain/clear, abort, disclosure and cleanup
   requirements while keeping the physical run closed.

No production configuration, endpoint, credential, personal data, deployment, distribution or
Physical Gate action is introduced.

## 3. DA3-V5-F01 — export adapter exact-shape failure

### Finding

The first real DA3 harness run reached the existing Admin export route but returned disclosure-safe
HTTP 400 `invalid_request`. Direct tracing proved the API validator produces an internal validated
object containing five fields (`expectedMembershipId`, the two canonical timestamps and two epoch
helpers), while `BackendHttpServer` forwarded that full internal object to
`TimeEntryExportCoordinator`. The coordinator correctly revalidates the exact public three-field
shape and therefore rejected every real request. Mock-based API tests asserted only a partial
object and did not detect the extra fields.

Classification: **P1 before correction** because the real Admin Web/API export path was unusable.
The boundary failed closed and disclosed no tenant or row data.

### Authorized correction

`BackendHttpServer` now constructs and freezes a fresh coordinator request containing exactly:

- `expectedMembershipId`;
- `fromInclusive`; and
- `toExclusive`.

The focused API regression now requires deep equality rather than partial matching, and the real
PostgreSQL journey requires a successful CSV over the corrected record. No contract, product rule,
CSV shape, role, pool or export range semantics changed.

## 4. Verification ledger

### Observed feedback before final candidate

- Focused Backend API export regression after correction: **12/12 passed**.
- Synthetic harness tests without the documented database environment variable: **35 passed,
  11 skipped**; explicitly rejected as V1 evidence.
- First database-backed rerun before rebuilding the local workspace package output: **45/46 passed**; the
  stale built Backend API still returned the original 400 and the run was rejected.
- Local `esbuild` initially resolved to a Linux ARM binary on macOS and failed with exit 126.
  `npm rebuild esbuild` repaired only ignored local dependencies; no tracked source or lockfile
  changed for that repair.
- Backend API rebuild plus the exact database-backed rerun: **46/46 passed, zero skips**.
- Synthetic harness tests-inclusive typecheck: passed.
- Synthetic harness build: passed.

### Exact candidate publication and artifact construction

- The focused product commit is `6eb68a3b4f9567600e12ec5a4f4b72ca4da99dca`, tree
  `bb8564fd0911d2b32dccb776f4a3f938621ee052`; exact-head run `29927309720`, attempt 1, passed
  **12/12** jobs.
- A first isolated dependency install resolved Node `v26.3.1` through the login shell and was
  rejected before any artifact build. The accepted isolated checkout used Node `v24.17.0`,
  OpenJDK `17.0.19` and Android Build Tools `36.0.0`.
- The first Node-24 build stopped before APK packaging because a clean `npm ci` has no generated
  `@taptime/offline-sync-contract/dist/index.js`. A subsequent unsequenced root workspace build
  also returned non-zero after building some packages because npm's workspace order reached
  backend consumers before their generated dependency types. Neither run produced or contributed
  an accepted APK.
- The accepted fresh run built exactly `@taptime/core`, `@taptime/offline-sync-contract` and
  `@taptime/time-review-contract`, then ran
  `npm run android:synthetic-e2e:build --workspace=@taptime/mobile`. Gradle passed **712 tasks**
  (679 executed, 33 up-to-date), Metro bundled 850 modules, and the build emitted all three
  mandatory readiness markers: `offline_storage_android_backup_boundary_verified`,
  `synthetic_e2e_android_runtime_complete_verified` and `synthetic_e2e_android_apk_ready`.
- Read-only APK:
  `/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da3-v5/6eb68a3/app-release-215b4c924f0b7702.apk`;
  95,437,611 bytes; mode `0444`; SHA-256
  `215b4c924f0b770248a36d188f341efe62278527e1cad1af6cc1babdcc1f39b1`.
- Package/version: `com.tim180201.mobile.synthetic`, `1.0.0` (`1`), minimum SDK 24, target SDK 36.
  `apksigner` verifies exactly one APK Signature Scheme v2 signer. Its local synthetic debug
  certificate SHA-256 is
  `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`; this is not a production
  or distribution signer.
- The packaged manifest has `allowBackup=false`, `usesCleartextTraffic=false` and both required
  backup-rule references. The Hermes runtime verifier passed against the generated binary, the
  offline-storage verifier passed against the generated and merged release manifests/rules, and
  the copied APK's identical SHA-256 plus an independent packaged-manifest dump bind those results
  to the read-only candidate.
- Adjacent read-only binding manifest:
  `/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da3-v5/6eb68a3/artifact-manifest.txt`;
  2,206 bytes; mode `0444`; SHA-256
  `07f0e5a116e76ddd9c17dcf66aa5bf5f4fbf0e1fbd4e152db13a8065b4b747d6`.
- No APK installation, ADB command, device interaction or Physical Gate action was performed.
  The isolated build worktree and its intermediate files were removed after the bound artifact
  was copied and reverified. Pre-existing workspace and user files were not removed.

### Independent exact-SHA review

The independent read-only review bound baseline `0b0d040`/tree `eee2650`, product
`6eb68a3`/tree `bb8564f`, Evidence `f4e2eeb`/tree `20e5715`, both 12/12 CI runs and the exact
read-only artifact/manifest. It independently traced DA3-V5-F01, least-privilege harness roles and
cleanup, safe status counts, real correction/adjudication/export coverage, retain/clear runbook
semantics, artifact package/signature/manifest and Hermes completeness. Verdict: **APPROVED** with
zero open P0/P1/P2/P3. Full record:
`ADO/05_Evidence/Development_Assignment_03_Independent_V5_Enablement_Review.md`.

### AVS completion state

| Level | State | Evidence |
|---|---|---|
| V0 | Passed | exact baseline/status/authority inventory; changed-file and dependency inventory; `git diff --check`; migrations `001`–`012` unchanged; ADO references resolve |
| V1 | Passed | focused API 12/12; real PostgreSQL harness 46/46 with zero skips; affected tests-inclusive typechecks and builds |
| V2 | Passed | complete schema 128, review 10, export 14, API 224, offline 13, Admin Web 52 and Mobile 421 suites plus affected contracts/harness |
| V3 | Passed | 1,758 tests across all 19 workspaces, two explicit optional B1 skips, all 19 typechecks/builds, migration clean/replay/ledger, Admin Web build, Android export, audit and cleanup |
| V4 | Passed | product `6eb68a3`/tree `bb8564f` and Evidence `f4e2eeb`/tree `20e5715`; exact-head runs `29927309720` and `29928717227` passed 12/12; read-only APK/manifest bound; independent exact-SHA review `APPROVED` with zero open P0–P3 |
| V5 | **Failed closed** | one exact-bound run passed preflight/setup but failed Gate A with `DA3-PHYS-01` P1, zero lifecycle mutation and complete cleanup; Gates B/C not started |

No failed or skipped run is counted as successful candidate evidence. The independent review bound
the exact product and Evidence heads plus both exact-head CI results and the immutable artifact.

The V3 total is the sum of the independently reported workspace results: administration contract
4; Core 290; offline contract 7; export contract 10; review contract 5; Admin Web 52; backend
administration 121; backend API 224; B1 39; bootstrap 189; identity 55; lifecycle 88; offline
synchronization 13; read model 42; schema 128; time export 14; time review 10; Mobile 421; synthetic
harness 46. B1 alone reports two optional Supavisor-mode skips.

PostgreSQL 17 evidence includes migrations `001`–`012` clean apply, no-op replay and exact ledger,
the full 128-test schema security matrix, all affected DA1/DA2/DA3 suites, and disposal of both
Technical-Lead-created V3 databases. The retained synthetic database has zero `taptime_server`
schemas, zero migration tables, zero generated synthetic runtime roles and zero active connections.
`npm audit` reports the unchanged 11 moderate Expo/Xcode toolchain advisories and zero high or
critical advisories. The lockfile change adds only the four existing local workspace links required
by the harness.

## 5. Current risks and stop condition

- The first physical procedure failed closed at Gate A with `DA3-PHYS-01`; no Gate-B/C observation
  exists and automated evidence cannot substitute for a later newly authorized Human run.
- The exact APK is bound to the committed, CI-green and independently approved product/Evidence
  heads, but its integrity must be recomputed immediately before any later authorized run.
- The APK uses the expected local synthetic debug signer and is unsuitable for distribution.
- Eleven existing moderate Expo/Xcode toolchain advisories remain separately disclosed; no known
  high or critical advisory is accepted silently.
- DA3 and DT-069–DT-074 remain open. This candidate does not close a roadmap item.

The authorized enablement reached V4 and independent approval. A later separately authorized first
V5 run failed closed and consumed its one-run authority. The next step is independent review of the
failure synchronization followed by a new Human correction decision; no fresh run is currently
authorized.

## 6. Subsequent first Physical Gate — failed closed

The Human Architect authorized one run bound to Product `6eb68a3`, this Evidence head `f4e2eeb`,
review-publication `b142626`, the three exact 12/12 CI runs, immutable APK and approved local
Galaxy-A33/two-NTAG213 set. Artifact/device/loopback/database preflight and both real Administrator
tag assignments passed. During Gate A, before any accepted Start observation, the following
Employee session displayed `Ausstehender Vorgang geschützt`.

The safe UI state is the tracked `protected_pending / identity_mismatch` result. Immediate server
status remained zero for WorkEvents, Decisions, receipts, TimeEntries and all DA3
revision/export/review rows. Source diagnosis opens `DA3-PHYS-01` (P1): the Administrator session
binds the encrypted offline-store owner; logout intentionally retains that owner; the runbook then
switches to Employee on the same installation. Gates B/C were not started. Both sign-outs,
clipboard clear, scoped disconnect, uninstall, listener/schema/role/connection zero checks and
temporary-worktree disposal passed. Exact record:
`ADO/05_Evidence/Development_Assignment_03_Physical_Validation_Evidence.md`.
