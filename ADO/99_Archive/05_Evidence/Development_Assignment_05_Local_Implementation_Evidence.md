# Development Assignment 5 — Local Implementation Evidence

- Date: 2026-07-24
- Baseline commit: `fb32a2796e78c78ce12f856c908545de7ce7bf99`
- Baseline tree: `53d6b5d6c2c86a8a3245539d821a12fae6850673`
- Candidate phase: the Development Agent completed the original local working-tree delta without
  committing or publishing it; the Technical Lead subsequently published exact candidate
  `4cd471883a2b68e709bbe34e68eb592c2b83d511`, tree
  `a910522d826caba85dd1f14625a8f64d87e5742a`, for V4 and independent review; correction round 1
  was subsequently published as `ee13e9b149b760bccdbd43f2dc802029e0bee14d`, tree
  `11bc7b4a102cd694ff36a2d44c139951b5a339bb`, and passed V4 run `30113794052`
  12/12; correction round 2 was subsequently published as
  `452d8fd93aeec66560b3fa73065850d4584490d1`, tree
  `699349b0a65360da9fa63288c384b2e287d0012b`, and passed V4 run `30115776918`,
  attempt 1, 12/12
- Risk: AVS-001 R3
- Authority: Human-accepted ADR-0016/ADR-0017 Workstreams A–F through local V0–V3, followed by
  Technical-Lead acceptance, focused publication, exact-head V4 and independent exact-SHA review
- Development-Agent exclusions: commit, push, publication, V4, independent review, installation,
  ADB/device/Tag use, Human V5, signing, production, production data, deployment and distribution

## Change-Impact Record

The candidate changes the following connected boundaries:

- Core WorkTarget and NFC/manual trigger unions while retaining server-only Start/Stop decisions;
- migration `013`, tenant-qualified Customer/Project/General Work identity, Project administration,
  immutable trigger provenance and least-privilege roles/functions;
- additive manual lifecycle, Mobile own-time/manual-target and Project administration coordinators;
- additive offline lease/manifest/provenance v2 plus Mobile encrypted SQLite schema v3 while
  retaining v1 evidence and exact FIFO ordering;
- additive Admin time/review and CSV v2 target/provenance truth while retaining Customer-only CSV
  v1 bytes and failing non-Customer v1 ranges closed;
- strict Backend API routes, composition, parsers and safe diagnostic handling;
- narrow Android `ACTION_TECH_DISCOVERED` configuration, consume-once native NFC ingress, atomic
  native clock sampling and exclusive capture ownership;
- role-safe Mobile product navigation, manual capture, own time and synchronization screens;
- Admin Web Project administration and generalized time/review presentation; and
- workspace metadata, the root lockfile and the minimum CI dependency/test steps for the new
  internal workspaces.

The confirmed R3 correction round narrows native ingress to lifecycle ownership and exact
NTAG213-v1 technologies, strips all Android NFC references on every technology-intent exit,
exposes only leased Manual plus Scan/Sync in the offline shell, adds deterministic safe own-time
load-more/timezone truth, and correlates pending manual events with exact scheduler decisions
before refreshing own-time.

The authoritative exact file inventory is the tracked `git diff --name-only` plus the scoped
untracked inventory from:

```text
git ls-files --others --exclude-standard -- apps packages ADO
```

No `research/` access occurred. The protected root untracked `app.json` was not read or changed.
No existing migration `001`–`012`, production configuration or unrelated user file was modified.
The CI workflow changed only to build/typecheck/test the new Mobile-work workspaces in the
existing applicable jobs and to name the dynamically applied migration range truthfully as
`001`–`013`.

## Implemented truth

- Every Organization has one immutable built-in General Work target; Customer IDs remain stable;
  Projects are independent Organization targets with bounded create/list/deactivate authority and
  active-TimeEntry deactivation protection.
- NFC and manual triggers share the unchanged server Business Engine and five-second
  per-User/WorkTarget dedupe. The caller never selects Start or Stop.
- WorkEvents and canonical TimeEntries retain exact NFC/manual provenance, including mixed
  lifecycle truth; recovered records retain null trigger provenance.
- Online manual capture uses the first database transaction timestamp. Offline manual and NFC
  evidence share one durable owner-bound FIFO and device sequence.
- V1 protected offline evidence remains readable and routable through v1. Additive v2 leases and
  commands use the accepted discriminated item/trigger unions and manifest/content-hash versions.
- Mobile own-time is self-only and effective; manual targets contain only safe active target
  identity/type/display data. Admin time/review and CSV v2 expose generalized target/provenance
  truth without broadening correction authority.
- The Android ingress is UID-only, consume-once and exclusive. It does not claim locked-screen,
  force-stop bypass, universal dispatch, NDEF identity or background-service behavior.

## Verification Summary

### V0

- `HEAD` and `origin/main` both resolved to the exact baseline commit; `HEAD^{tree}` resolved to the
  exact baseline tree.
- `git diff --check`: passed.
- Tracked and scoped untracked inventories were inspected with protected untracked paths excluded.
- Dependency inventory: `npm ls --all --depth=0` passed.
- `.github/workflows/ci.yml` parsed successfully as YAML after the focused dependency-step change.
- Disposable DA5 PostgreSQL databases were explicitly named, checked before creation and removed;
  a final catalog query returned none of them.

### V1 and V2

Focused contract, Core, migration, PostgreSQL, API, offline, lifecycle, export, review, Admin Web,
Mobile coordinator/runtime/native-ingress/plugin and presenter tests passed during implementation.
Notable complete affected results included:

- Core: 43 files, 290 tests.
- Backend schema/security: 1 file, 128 tests.
- Backend lifecycle: 1 file, 90 tests.
- Backend administration: 3 files, 121 tests.
- Backend offline synchronization: 2 files, 14 tests.
- Backend API: 9 files, 234 tests.
- Backend TimeEntry export: 2 files, 15 tests.
- Backend time/review: 1 file, 11 tests, including real PostgreSQL Project/manual provenance.
- Admin Web: 7 files, 87 tests.
- Mobile: 36 files, 453 tests.

### V3

Environment:

- Node.js `v24.17.0`
- npm `11.13.0`
- PostgreSQL `17.10` on numeric loopback

Complete local candidate result:

- all 21 workspace test suites executed;
- 1,896 tests passed;
- two B1 Supavisor integration tests skipped by their existing optional environment gate;
- all 21 workspace typechecks passed;
- all 20 applicable workspace builds passed;
- the changed test workspaces use test-inclusive TypeScript configurations; Mobile
  `tsc --listFilesOnly` proved inclusion of all 36 Mobile test files;
- migrations `001`–`013` applied to clean PostgreSQL, replayed with no new application and passed
  migration-ledger verification;
- the C3B built CLI passed `verify-bin`;
- `npx expo export --platform android` passed and bundled 861 modules into an isolated temporary
  export; no APK was built, installed, signed or distributed; and
- all task-owned disposable PostgreSQL databases were removed.

After the confirmed R3 corrections, exactly one fresh complete V3 was executed with the counts and
all-green result above. Its initial workspace aggregate reached B1 without the required local
environment variables, and the first focused continuation still omitted `B1_RUNTIME_PASSWORD`;
neither attempt collected a test. The exact B1 suite then continued with all three required local
variables and passed 39 tests with its two existing optional Supavisor skips. Previously completed
workspaces were not redundantly rerun. The final ADO synchronization is R0 over that unchanged
executable/workflow candidate.

## Failures and retries

- The first Backend API v2 typecheck exposed a TypeScript generic inference ambiguity between v1
  and v2 read projections. The handler branches were made explicit; the final typecheck passed.
- Early focused generalized time/review PostgreSQL fixture attempts exposed, in order, the absent
  default `taptime_da3` database, the existing deferred Decision/TimeEntry foreign-key lifecycle,
  a missing explicit `started` status and an active-entry conflict in test setup. The regression
  was corrected to use a disposable database, two canonical lifecycle transactions and a separate
  seeded User; the complete final suite passed 11/11.
- The first repository build exposed an unhandled additive `mobile_work_failed` diagnostic in the
  synthetic Android harness. The exhaustive safe-event mapping was added; the final repository
  typecheck and all 20 applicable builds passed.
- The first Synthetic Android E2E attempt used a disposable database name rejected by the harness'
  exact safety validator. It produced 77 passing tests, 13 gated skips and two setup-suite
  failures before Product execution. The unchanged source was rerun against the mandated existing
  `taptime_synthetic_android_e2e` test database and passed 90/90.
- The first combined final artifact-validation command invoked the root-relative CI path while its
  working directory was `apps/mobile`; C3B `verify-bin` had already passed, while YAML validation
  failed with `ENOENT` and Android export did not start. Repeating the two unexecuted checks with
  the correct `../../.github/workflows/ci.yml` path passed YAML validation and Android export.

No failed assertion remains open.

## Post-publication review and correction round 1

Exact-head V4 run `30108718178`, attempt 1, passed 12/12 against published candidate
`4cd471883a2b68e709bbe34e68eb592c2b83d511`. Independent exact-SHA implementation review returned
`CHANGES REQUIRED` with exactly three findings:

- P1: a pending native Tag without current authenticated or exact offline-restoration authority
  could survive the ingress poll and replay after later authentication;
- P2: own-time continuation requests recomputed their rolling transaction-time frame, so the
  Mobile immutable-frame check could reject valid load-more; and
- P3: Project Status still described the already published/V4-reviewed candidate as uncommitted.

Focused correction round 1 binds native ingress to a private current capture-authority token and
the exact in-flight cold/warm session transition. Missing, signed-out, replaced, Membership-stale
or runtime-stale authority clears the native slot before normalization/submission; one exact valid
authenticated/offline-restoration attempt remains consumable once and no UID enters the authority
reader. Own-time continuation cursors now retain the initial 31-day server frame plus keyset,
carry actor/Membership-bound integrity, remain versioned/opaque/bounded and fail closed for
structural tamper, cross-user reuse, future/expired frames and duplicate Mobile records.

Subsequent Technical-Lead inspection found that the first uncommitted cursor MAC derived its key
only from the public Actor UUID tuple and was therefore client-forgeable. The focused supplement
requires `TAPTIME_MOBILE_OWN_TIME_CURSOR_HMAC_KEY` as canonical unpadded base64url for exactly 32
bytes whenever the Backend API composes Mobile own-time reads. Runtime and coordinator boundaries
both reject a missing or malformed value without echoing it. HMAC key derivation now combines the
server-only key with Organization, User and Membership before signing the immutable frame/keyset
payload. Equal configured keys continue across requests and instances; rotation to a different key
fails closed before the own-time data function is called. Cursor timestamps are rejected outside
the ECMAScript `Date` range before any `Date` is constructed, and the transport remains at most 256
ASCII characters.

Corrected V1/V2 passed the focused native/offline tests, complete Mobile 461/461, complete
Backend Mobile Work 8/8 including two real PostgreSQL multipage/security cases, complete Backend
API 235/235 and complete schema/security 128/128. All affected tests-inclusive typechecks and
applicable builds passed. The corrected final V3 then passed:

- all 21 workspace suites, 1,908 tests passed and two existing optional B1 Supavisor tests skipped;
- all 21 workspace tests-inclusive typechecks;
- all 20 applicable workspace builds; Mobile has no build script and is covered by Android export;
- clean migration 001–013 application, replay and ledger verification;
- C3B built-CLI verification; and
- Android export of 861 modules to an isolated temporary output.

The first V3 aggregate command reached B1 without the required local environment variables. B1
collected no test and wrote a failed setup report. The same V3 continued from B1 with all three
required variables; B1 passed 39 tests with its two existing optional skips, and workspaces 1–9
were not rerun. The earlier V2-only attempt to invoke `npm run build --workspace=@taptime/mobile`
also failed before execution because Mobile intentionally has no build script; no product check
failed. Task-owned PostgreSQL databases and temporary Android/report outputs were removed after
evidence capture. The correction remains an uncommitted local delta; corrected V4 and independent
re-review have not occurred.

The server-key supplement used focused V1/V2 only under the exact Technical-Lead delegation.
Backend Mobile Work passed 7/7 focused coordinator tests plus 2/2 real PostgreSQL tests, including
same-key cross-instance continuation and different-key/cross-user/tamper rejection. Backend API
passed 236/236, including missing/malformed key composition rejection without secret disclosure.
Both affected tests-inclusive typechecks and both builds passed. The first focused Backend API run
exposed that configuration did not itself reject the malformed key before dependency composition;
validation was moved to the runtime boundary and 5/5 focused tests passed. Its next typecheck
exposed an optional-key narrowing error; the explicit composed-reader value corrected it and the
typecheck passed. The first complete Mobile Work invocation passed all seven unit tests but could
not collect its two PostgreSQL tests because the default `taptime_da3` database was absent. An
explicit disposable `taptime_da5_cursor_supplement` database was created, migrations 001–013 were
applied, only the two blocked PostgreSQL tests were continued and passed, and the database plus
runtime role were removed. At that focused handoff no full V3 had been rerun; the preceding
1,908-test V3 remained truthful only for the pre-supplement local state.

### Final supplemented V3

The subsequent exact final-candidate R3 step executed one complete fresh V3 on the unchanged
supplemented executable candidate:

- all 21 workspace suites collected tests on the first intended aggregate pass;
- 1,910 tests passed and only the two existing optional B1 Supavisor tests skipped;
- all 21 workspace tests-inclusive typechecks passed;
- all 20 applicable workspace builds passed; Mobile has no build script;
- a clean task-owned `taptime_da3` applied migrations 001–013, replayed with `applied=none` and
  passed ledger verification;
- Mobile `tsc --listFilesOnly` matched exactly 36/36 repository Mobile test files;
- the built C3B CLI passed `verify-bin`;
- Android export bundled 861 modules into one isolated temporary output; and
- the task-owned `taptime_da3` and Android temporary path were removed, while the pre-existing
  dedicated B1 and Synthetic E2E databases were preserved and the Synthetic database had no
  remaining `taptime_server` schema.

The aggregate used Node.js `v24.17.0`, npm `11.13.0` and PostgreSQL `17.10`, with every required
B1 installer/runtime/password variable, all direct Backend database variables and the exact
numeric-loopback Synthetic E2E database set before it began. No assertion failed and no workspace
was rerun. Two orchestration commands were rejected before spawning their intended checks: the
first parallel C3B/Mobile-inclusion wrapper interpolated a shell variable in the tool wrapper, and
the first Android export wrapper contained a prohibited recursive cleanup command. C3B and Mobile
inclusion then each executed once and passed; one actual Android export executed and passed, and
its exact temporary path was removed through the recoverable Trash operation. Dependency
inventory, CI YAML parsing, whitespace/diff checks and final protected-path-aware status inspection
also passed.

## Post-publication review and correction round 2

Correction-round-1 publication `ee13e9b149b760bccdbd43f2dc802029e0bee14d`, tree
`11bc7b4a102cd694ff36a2d44c139951b5a339bb`, passed exact-head V4 run `30113794052`, attempt 1,
12/12. Independent implementation review round 2 returned `CHANGES REQUIRED` with three findings:

- P1: native ingress still captured authority only at the later polling boundary, so a Tag
  received before login/new authority could be processed when the first poll occurred after the
  new authority became ready;
- P2: SQL `interval '31 days'` used calendar-day arithmetic for the own-time frame and therefore
  produced 743 or 745 elapsed hours across Europe/Berlin DST changes instead of exact 744 hours;
  and
- P3: Project Status and this evidence did not yet record the published correction, its exact tree,
  V4 run and review-round-2 result.

Focused correction round 2 exposes only UID-free native capture evidence consisting of the
same-boot marker and `elapsedRealtime` capture point. The coordinator creates one immutable
valid-from boundary for the exact current authenticated or offline-restoration authority and
accepts only matching-boot captures strictly after that boundary. Equality is rejected
fail-closed because millisecond evidence cannot distinguish a same-tick pre-authority Tag from a
later capture. Missing evidence, a pre-authority
capture, changed native-slot evidence or a stale/replaced authority clears the slot; the UID is
read only by the existing consume-once scan path after the authority checks. The reverse race is
covered explicitly: a Tag captured before the new authority with its first poll only after
login-ready is discarded, while a later eligible authenticated/offline capture remains
consumable once.

The own-time SQL and TypeScript boundaries now use exact 744-hour arithmetic. Real PostgreSQL
tests under `Europe/Berlin` prove the exact frame across both 2026 DST transitions, distinguish it
from the 743-hour spring and 745-hour fall calendar-day results, retain the immutable continuation
frame and reject 743-hour/745-hour requests.

Focused V1/V2 passed Backend Schema 128/128, Backend Mobile Work 10/10 and Mobile 462/462. All
three affected tests-inclusive typechecks and both applicable builds passed. The first focused
PostgreSQL DST test run exposed only invalid test SQL syntax from qualifying the special
`extract` expression; the corrected query and unchanged product implementation passed 3/3 on a
freshly migrated disposable database. Both focused disposable databases and their runtime roles
were removed.

Exactly one final complete fresh V3 was then executed for the correction-round-2 executable
candidate:

- all 21 workspace suites completed with 1,912 passed tests and only the two existing optional
  B1 Supavisor skips;
- all 21 workspace tests-inclusive typechecks passed;
- all 20 applicable workspace builds passed; Mobile has no build script;
- clean migrations 001–013 applied, replayed with `applied=none` and passed ledger verification;
- Mobile TypeScript inclusion matched all 36/36 repository Mobile test files;
- the built C3B CLI passed `verify-bin`;
- Android export bundled 861 modules to one isolated temporary output; and
- all three task-owned PostgreSQL databases were removed, the Android temporary path was moved to
  Trash, and the preserved Synthetic E2E database had no remaining `taptime_server` schema.

The first test aggregate supplied four C2 runtime URLs with the installer identity instead of
their exact runtime logins. Two Backend API files therefore collected no tests, while the other
seven Backend API files passed 95 tests and every other workspace continued successfully. The
focused continuation used the correct runtime identities but was first invoked from the repository
root, which did not apply the Backend API workspace's serial file configuration: C1 passed 43/43
while C2 failed before collection because the concurrent C1 reset had already applied the clean
migration set. C2 alone under the correct workspace configuration then passed 98/98. No already
completed workspace was repeated and no product assertion failed.

Migration replay passed on its first invocation. The immediately chained ledger command did not
inherit the inline database variable and exited before execution; C3B and Mobile-inclusion checks
behind it did not start. The three unexecuted checks were continued with explicit environment and
all passed. One Android export executed and passed.

Technical-Lead pre-publication inspection then identified that the initial `>=` comparison still
accepted capture evidence equal to the millisecond-resolution authority boundary. The focused
correction changed eligibility to strict `>` and added one exact same-boot/current-authority
regression: equality is rejected and the next millisecond is accepted. Focused Native/Offline
tests passed 24/24 and the tests-inclusive Mobile typecheck passed.

Because this changed the executable R3 candidate after the preceding V3, one new final complete
V3 superseded that run. It passed the same complete matrix with 1,912 tests and the two existing
optional B1 Supavisor skips, all 21 tests-inclusive typechecks, all 20 applicable builds, clean
migration apply/replay/ledger verification, C3B built-CLI verification, Mobile 36/36 test-file
inclusion and Android export of 861 modules. The test aggregate collected every workspace on its
first invocation with the corrected runtime identities and serial Backend API configuration; no
failure or continuation occurred. The task-owned `taptime_da3` database was removed, the
Synthetic database was schema-free and the Android temporary output was moved recoverably to
Trash.

## Correction-round-2 publication and independent review round 3

The Technical Lead published correction round 2 as exact commit
`452d8fd93aeec66560b3fa73065850d4584490d1`, tree
`699349b0a65360da9fa63288c384b2e287d0012b`. Exact-head V4 run `30115776918`,
attempt 1, passed 12/12.

Independent review round 3 was bound to that exact commit, tree and V4 run. Its verdict was
`CHANGES REQUIRED` solely for one P3 governance-truth finding: Project Status and this evidence
still described correction-round-2 publication, V4 and re-review as pending. The review approved
and closed P1 capture-time authority and P2 exact 744-hour own-time duration; no P0, P1 or P2
finding remains open.

After the normal three-round limit, the Human Architect authorized exactly one focused R0
synchronization of only Project Status and this evidence record. This synchronization changes no
executable, schema, dependency, configuration, workflow or artifact input, requires only AVS
R0/V0 and was published as `b777f7027f436caf785f657ae9fc29795fd60bcb`, tree
`54b257f50eb4d565a60ee6f6171921033695a1c7`. Independent R0 Exact-Delta review returned
`APPROVED`, `MERGE_READY`, with zero open P0–P3. The synchronization neither repeats nor
supersedes product V3/V4 and closes the DA5 V0–V4 software scope.

## Final pre-hardware Workstream-F shell

The final authorized pre-hardware R0 candidate adds only:

- `ADO/04_Operations/Development_Assignment_05_V5_Runbook.md`; and
- `ADO/05_Evidence/Development_Assignment_05_V5_Evidence.md`.

The runbook is a concise staged operator shell for ADR-0016 DA5-P12 and ADR-0017 DA5-T15. The
evidence record is empty and `NOT RUN`. Neither document claims its own review result, requires a
self-SHA, binds an APK/device/Tag or authorizes installation, ADB, device/Tag interaction or Human
V5. Before any future fresh run, exact reviewed product/review and read-only APK/manifest
size/SHA-256/mode bindings, separately named approved device/Tags and a separate exact Human
authorization remain mandatory.

## Remaining gates and risks

- Correction-round-2 publication and exact-head V4 are complete at
  `452d8fd93aeec66560b3fa73065850d4584490d1`, tree
  `699349b0a65360da9fa63288c384b2e287d0012b`, V4 run `30115776918`, attempt 1,
  12/12.
- Independent exact-bound review round 3's sole P3 stale-truth finding and its approved P1/P2
  closure were synchronized at `b777f7027f436caf785f657ae9fc29795fd60bcb`, tree
  `54b257f50eb4d565a60ee6f6171921033695a1c7`. Independent R0 Exact-Delta review returned
  `APPROVED`, `MERGE_READY`, with zero open P0–P3; DA5 V0–V4 software is technically closed.
- The current V5 runbook/evidence R0 shell claims no review outcome for itself. It must be
  independently reviewed before it can form part of a future exact Human authorization.
- Human Android V5, real-device NFC/Tag dispatch, accessibility observation, process restart and
  controlled offline/online physical paths were not run and remain separately authorized gates.
- Exact Android vendor/Tag routing remains a Human-qualified best-effort matrix as specified by
  ADR-0017; automated source tests and Android export do not replace it.
- Production, production data, legal/privacy approval, signing, deployment and distribution remain
  unauthorized.

The next operational action is independent Exact-Delta review of the pre-hardware R0 runbook and
evidence shell candidate. Product V3/V4 is not repeated because no executable or artifact input
changed. Human V5 remains stopped until a later separate exact-bound Human authorization.

## Phase H — read-only DA5 V5 synthetic artifact candidate

The artifact build was bound to current Source+Lock baseline
`a323834f51607841d0cd5f11aafdbfd3dd93ed5f`, tree
`65c669b0a941c21d23ffca5e79fa03285323a7cf`, exact-head CI `30149165373`,
attempt 1, 12/12. Independent implementation review round 2 returned `APPROVED` with zero open
P0–P3. No product, schema, dependency, workflow or build-script file was changed in this phase.

A fresh disposable research-free sparse checkout used Node.js `v24.17.0` and npm `11.13.0`.
The correct checkout's `npm ci` passed. Installed dependency inspection found only PostCSS
`8.5.18` and brace-expansion `5.0.8`, whose installed Node engine is `20 || >=22`. Full and
runtime-only `npm audit` each returned exit 1 for 11 moderate findings, with zero high and zero
critical findings. The required `@taptime/mobile-work-contract`,
`@taptime/offline-sync-contract` and `@taptime/time-review-contract` builds passed.

Exactly one actual
`npm run android:synthetic-e2e:build --workspace=@taptime/mobile` invocation ran with JDK
`17.0.19` and Android Build Tools `36.0.0`. Gradle completed successfully, and each required
marker occurred exactly once:

- `offline_storage_android_backup_boundary_verified`;
- `synthetic_e2e_android_runtime_complete_verified`; and
- `synthetic_e2e_android_apk_ready`.

The resulting read-only files are retained under
`/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5/a323834/`:

- `app-release-385c0c46f22dcac5.apk`: 95,522,787 bytes, SHA-256
  `385c0c46f22dcac5b935bfdc6f574558f4e74748ed4a367ef399ddbd4299c547`, mode `0444`;
- `artifact-manifest.txt`: 1,647 bytes, SHA-256
  `1c1f1b7a5b92fab5510cde35a439fc6f0742b7bf2666d6319cd89b9a7d4dcadb`,
  mode `0444`.

Independent checks against the final copied APK confirmed package
`com.tim180201.mobile.synthetic`, versionCode `1`, versionName `1.0.0`, exactly one local
synthetic non-production signer certificate with SHA-256
`fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`, signature scheme v2
enabled and v1/v3/v3.1/v4 disabled. The packaged application has `allowBackup=false`, global
cleartext disabled with only the synthetic `127.0.0.1` network-security exception, the required
backup/extraction references and exclusions, `TECH_DISCOVERED` plus NfcA/MifareUltralight,
exactly one Hermes Android bundle and a matching synthetic runtime contract. The adjacent
manifest contains no synthetic runtime literal.

One orchestration mistake invoked the first `npm ci` from the primary checkout rather than the
disposable checkout. Protected-path-aware tracked status remained clean; the installation was
then repeated successfully in the correct disposable checkout. No tracked product file was
changed by that mistake.

No APK installation, ADB, device/Tag interaction, Human V5, external-service/fixture run,
accessibility gate, production signing, production or production-data access, deployment or
distribution occurred. All such Human/physical gates remain `NOT RUN` and their bindings remain
`UNBOUND`. At the Phase-H handoff, independent artifact review and Evidence exact-head CI were
pending and this phase claimed no self-approval.

## Phase I — final Artifact/Evidence review synchronization

Exact Evidence commit `e6a06e2ec8f580d6314bfe5a51378f949d524b16`, tree
`6dcdce405feb2eccb1462c373ab6be891152715c`, parent Product
`a323834f51607841d0cd5f11aafdbfd3dd93ed5f`, passed exact-head CI `30150095109`,
attempt 1, 12/12. Final independent Artifact/Evidence Exact-SHA review returned `APPROVED` with
zero open P0–P3. APK and manifest identity, size, SHA-256 and `0444` modes are unchanged. No
installation, ADB, Human/hardware V5, production, production-data access, signing, deployment or
distribution occurred or is authorized.
