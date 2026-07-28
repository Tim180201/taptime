# Development Assignment 5 — V5 Human Android Evidence

- Status: **DA5-V5-VAL-NATIVE-CAPTURE-DIAGNOSTICS SOURCE/ARTIFACT EXACT-SHA REVIEW APPROVED WITH ZERO OPEN P0–P3; CURRENT `effc57a` APK/MANIFEST VERIFIED BUT INSTALLATION UNAUTHORIZED; SIX PHASE-0 AUTHORITIES CONSUMED FAIL-CLOSED WITHOUT AN ATTRIBUTABLE TAG RESULT; `e97bbe9` AND `7e8c0f7` APK/MANIFEST HISTORICAL/DO NOT INSTALL; PRODUCT HUMAN V5 NOT RUN/UNAUTHORIZED**
- Date: `NOT RUN`
- Artifact preparation date: 2026-07-28
- Owner: Technical Lead
- Human run authority: `NOT BOUND`

## 0. Current Validation Runtime truth — no Product Human result

The local Runtime Guard remains independently `APPROVED` with zero open P0–P3. Round-1 Exact-SHA
review of Validation App baseline `be32840` returned `CHANGES REQUIRED` for P1 Samsung package
visibility and P3 stale Runtime-Guard navigation. Intermediate `0f7e131` corrected both, but its
real build stopped before publication because the verifier rejected Expo's existing HTTPS query;
no artifact was published. Historical query-visibility correction
`5c239b1c30c6263a036077460e23373b767f66df`, tree
`53e8d4ed012ccc662f1005f895a3b6e685cf560e`, passed exact-head CI `30276804017`,
attempt 1, 12/12. Independent Exact-SHA re-review of review base
`11a8269de145ad33c230f55a064bd18f9bb59731`, tree
`2292010e43d2620fbdbba6eeb6a9d77c36674144`, and CI `30277641127`, attempt 1, 12/12,
returned `APPROVED` with zero open P0–P3; P1 and P3 are closed.

The exact Runtime correction/review sequence is recorded in Section 1 and
`ADO/05_Evidence/Development_Assignment_05_V5_Validation_Runtime_Correction_Independent_Exact_SHA_Review.md`.
Final correction `7e8c0f7742e6407b8917205fd337a552f7dec714`, tree
`3e4d1356b859fecf70d365fecbb563e2088100f3`, passed CI `30284566289`, attempt 1,
12/12; independent re-review returned `APPROVED` with zero open P0–P3. Its exact executable Metro
bundle/source closure, ExpoAsset absence, Validation package, local synthetic signer, exact
required native modules and zero forbidden modules or extra permissions are bound. The
`7e8c0f7` read-only APK/manifest passed the official verifier and independent Artifact Exact-SHA
review with zero open P0–P3 for that exact source. It is now **HISTORICAL — DO NOT INSTALL**
because DA5-V5-VAL-UI-01 changes the Validation Controller/UI.

Correction source `e97bbe9e2a281099899e2ecb3aad2588ef20f22d`, tree
`2958f456875e8dab3f10834df280e10a8438efce`, passed exact-head CI `30370977809`,
attempt 1, 12/12. Round-2 and Round-3 source reviews and the formal independent Source/Artifact
Exact-SHA review returned `APPROVED` with zero open P0–P3. The new read-only 65,629,505-byte APK
(`810b856f…13e28`) and 6,700-byte manifest (`af53d646…9e051`) passed the official verifier and
the exact package, signer, permission, runtime, native and source-closure review. The review is
archived in
`ADO/05_Evidence/Development_Assignment_05_DA5_V5_VAL_UI_01_Independent_Source_Artifact_Exact_SHA_Review.md`.
This closes the exact repository/source/artifact finding only. Because the native-capture
diagnostics correction changes the Validation source, the `e97bbe9` artifact is now
**HISTORICAL — DO NOT INSTALL**.

Six separately authorized Phase-0 attempts are consumed fail-closed without an attributable Tag
result. Run 5 used repository baseline
`55070aa9a74c2606668caba9dc113ae8d689bd8d`, installed and verified the then-current exact
`7e8c0f7` Validation APK and passed the Human-confirmed device checkpoint. Its first required
validation scan path then
failed closed generically without a distinguishable cause. No successful or attributable Tag
result can be claimed, and no hardware defect is proven. Final cleanup ended with package,
process and reverse mappings at zero. Run 6 used ADO baseline
`96daac0b3cf1cfe98249a8c94fe927f34ee33af1`, tree
`4e7ccd41a4fda0608a7e9deab7fbc258e1cf94bf`, installed and verified the then-current exact
`e97bbe9` artifact and passed the Human-confirmed device checkpoint. At the first required A-scan
it showed only `Prüfung sicher gestoppt` /
`Der Scan konnte nicht als gültiger lokaler Nachweis bestätigt werden`. No cause or Tag result is
attributable and no hardware defect is proven. Cleanup again confirmed package, process and
reverse mappings at zero.

The current diagnostics correction source is
`effc57a6780ff86784de0519a34abd6c5b7b8cd6`, tree
`758dbfaa04d0968fb25122352055fbcb80f8f022`, with exactly seven authorized changed files.
It adds six closed, typed, fixed-allowlist and disclosure-safe stages for Technology evidence,
UID readability, listener/registration, digest, concurrency and cleanup. It emits no raw UID,
payload, Technology list, provider diagnostic, exception text or Logcat. NFC acceptance,
timeouts and Controller fail-closed behavior are unchanged.

V3 passed 20/20 builds, 21/21 tests-inclusive typechecks and 21 workspace suites covering 147
test files and 2,373 tests, with exactly two documented optional B1 skips. Migrations 001–013
apply/replay/ledger, C3B CLI and Android export passed. The initial Synthetic stop was solely a
Technical-Lead runner database-name configuration; the previously unexecuted unchanged suite
then passed 288/288 on a fresh exact database. No ports or temporary residue remained. Exact-head
CI `30377569479`, attempt 1, passed 12/12. Independent source review and final prepublication
review returned `APPROVED` with zero open P0–P3.

The current read-only 65,631,681-byte APK (`e423073e…7330f`) and 6,700-byte manifest
(`9d1238e8…ccc22`) passed independent Artifact Exact-SHA review with zero open P0–P3. That review
verified all 32 manifest source-closure files byte-exact, package/signature/version and security
boundaries, DEX 4 required present / 14 forbidden absent, and Hermes Validation markers present
with Product/network/database/storage markers absent. It is archived in
`ADO/05_Evidence/Development_Assignment_05_DA5_V5_VAL_NATIVE_CAPTURE_DIAGNOSTICS_Independent_Source_Artifact_Exact_SHA_Review.md`.
No current Phase-0/hardware/ADB/installation authority exists, and Product Human V5 is `NOT RUN`.
No production, production-data, system-change, deployment or distribution result is claimed.
Historical candidate and review details remain preserved below.

## 1. Authority and exact binding

This record mirrors
`ADO/04_Operations/Development_Assignment_05_V5_Runbook.md`. It records the corrected read-only
current Validation artifact, the historical superseded artifacts and all six consumed Phase-0
attempts, but no attributable Tag result or Product Human result. It grants no new Human-run or
installation authority.

| Binding | Evidence |
|---|---|
| One-run Human authorization/date | `NOT BOUND` |
| Product commit/tree and required V4 | `a323834f51607841d0cd5f11aafdbfd3dd93ed5f` / `65c669b0a941c21d23ffca5e79fa03285323a7cf`; CI `30149165373`, attempt 1, 12/12 |
| Product implementation-review binding/verdict | Round 2 `APPROVED`; zero open P0–P3 |
| Prior runbook/evidence commit/tree and independent-review verdict | `e6a06e2ec8f580d6314bfe5a51378f949d524b16` / `6dcdce405feb2eccb1462c373ab6be891152715c`; CI `30150095109`, attempt 1, 12/12; final independent Artifact/Evidence Exact-SHA review `APPROVED`, zero open P0–P3 |
| Runtime Guard source/CI | `ba1b6e922ceb7902ecedd9dc2df01d6b22d90867` / tree `980b6c57fdd71c12820f2890b640946db0d883c6`; CI `30255104609`, attempt 2, 12/12; attempt 1 was one B5 Docker-Hub pull timeout before checkout |
| Isolated-PostgreSQL enablement correction | Historical round-2 `7739757a4855ee7bac34408941e94c25516d75f5` / tree `0398066e92fef65562526f61c9515b0ef3be0114` / CI `30177897059`, attempt 1, 12/12. Round-3 `bbcb1b59703ee866539b2bc384ec9db8c2643fe4` / tree `dfb5abbca1f2ddf603d191ae3303d1336f5440c7` / parent `7739757a4855ee7bac34408941e94c25516d75f5`; exact-head CI `30185670176`, attempt 1, 12/12; independent review `CHANGES REQUIRED`, exactly two P1 and zero P0/P2/P3. Extra-round `43567d256e8f633f16866448e1fb5abbd8022733` / tree `feecced92abe9fc536a2db052b5a616d3e0f1cf7` / parent `bbcb1b59703ee866539b2bc384ec9db8c2643fe4`; exact-head CI `30186846379`, attempt 1, 12/12; Exact-Delta review `CHANGES REQUIRED`, exactly one P1 and zero P0/P2/P3; initdb P1-B closed. Human confirms the second local administrator and exact complete decision-time local macOS admin-group membership snapshot are trusted under Option A and authorized exactly one last focused ADO correction/review round limited to the remaining P1. Decision-time V1 anchor: exactly two direct members, zero nested groups; full-record SHA-256 `b006276c09d8f2713f6132ea79cec167ab3a3c2887ee53e95eb00c1cc33719a5`; membership SHA-256 `70a683b7ebc7981533015d5d63cf12dfb2eabbfa665c34720eddb4d09e9e3064`; combined snapshot SHA-256 `2384b0baccd9049d820794f8ebc9419e4af0fad6831a5a91c209baa0b4a02217`. At that extra-round checkpoint, future R3 still had to reproduce all three digests and both counts before capability/task-root creation and every trust use; mismatch returned to the Human Architect without dynamic acceptance or rebinding. The then-current last-round draft was R0/unbound, and focused publication, exact-head CI, independent approval and implementation authority were still pending. The later Runtime Guard is independently approved; the corrected Validation App has the separate approved source/CI/artifact binding below. |
| Runtime Guard artifact/review | Binary `/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-runtime-guard/ba1b6e922ceb7902ecedd9dc2df01d6b22d90867/da5_v5_runtime_guard`; 74,336 bytes; mode `0555`; SHA-256 `4b2a7e6b15d3348dffda94f9125c20a4db82bb8eb08a03aabd35932ad0d5853c`. Same-directory `guard-manifest.txt`; 19,971 bytes; mode `0444`; SHA-256 `957d6e99c271663763945026995e7463cf2f20b385eb942fd16a152d3de5f709`. Focused evidence SHA-256 `440928371f7acc48272eff2e819c37a851d66cae4a908ffa330228982328d708`; independent Exact-SHA `APPROVED`, zero open P0–P3 |
| Historical query-visibility correction source/review/CI | Round-1 baseline `be32840`, verdict `CHANGES REQUIRED` for P1/P3; intermediate `0f7e131` stopped before publication with no artifact; final source `5c239b1c30c6263a036077460e23373b767f66df` / tree `53e8d4ed012ccc662f1005f895a3b6e685cf560e`; CI `30276804017`, attempt 1, 12/12; review base `11a8269de145ad33c230f55a064bd18f9bb59731` / tree `2292010e43d2620fbdbba6eeb6a9d77c36674144`; CI `30277641127`, attempt 1, 12/12; independent Exact-SHA re-review `APPROVED`, zero open P0–P3; P1/P3 closed |
| Validation provider/query policy | Exactly one installed and active provider from `com.google.android.marvin.talkback` or `com.samsung.android.accessibility.talkback`; none or both fail closed; exact package name and safe version are bound. Packaged visibility is exactly one queries block, both TalkBack package queries, one exact `VIEW` + `BROWSABLE` + `https` intent and zero providers |
| Current DA5-V5-VAL-NATIVE-CAPTURE-DIAGNOSTICS source/review/CI | Source `effc57a6780ff86784de0519a34abd6c5b7b8cd6`; tree `758dbfaa04d0968fb25122352055fbcb80f8f022`; exactly seven authorized changed files; exact-head CI `30377569479`, attempt 1, 12/12; independent source review and final prepublication review `APPROVED`, zero open P0–P3 |
| Current Validation V3 | 20/20 builds; 21/21 tests-inclusive typechecks; 21 workspace suites / 147 test files / 2,373 tests; exactly two documented optional B1 skips; migrations 001–013 apply/replay/ledger, C3B CLI and Android export passed. Initial Synthetic stop solely from Technical-Lead runner database-name configuration; previously unexecuted unchanged suite passed 288/288 on a fresh exact database; no port or temporary residue |
| Current Validation APK/manifest — installation unauthorized | Directory `/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-validation/da5-v5-validation-effc57a6780f-e423073e51f72a68`; APK `app-release-e423073e51f72a68.apk`, 65,631,681 bytes, mode `0444`, SHA-256 `e423073e51f72a68421c8e4afd17a9b86c397ca83628deaf4b174543d817330f`; manifest `manifest-effc57a6780f.json`, 6,700 bytes, mode `0444`, SHA-256 `9d1238e821d92b26ed9bc9b9ee8ccd48607280ff0d0e752ec6965827c68ccc22`; independent Artifact Exact-SHA review `APPROVED`, zero open P0–P3 |
| Current Validation package/security boundary | `com.tim180201.mobile.validation`; versionCode `1`; versionName `1.0.0`; signing scope `local-validation-only`; one v2 signer with certificate SHA-256 `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`; NFC-only; no network permission; cleartext denied; backup disabled; no Product deep links or Tag dispatch |
| Current Validation source/native closure | Metro source closure 555 entries / 2,675,576 bytes / SHA-256 `e9fee0629af81357e4563836f9f5ef2b404c1ef97bc135d1cb3ed410f713b593`; executable 2,040,604 bytes / SHA-256 `c24457514436a63878107e1593dc90c6de17ad2424a6b625a6f18a14f66b8cfe`; unchanged native source 123 directories / 587 entries / 464 files / 1,176,224 bytes / SHA-256 `9194be29b96a67c47aa40a4bdea7494155695e088d769e21c77eff305b1ee259` |
| Current Artifact Exact-SHA review | `APPROVED`, zero open P0–P3; all 32 manifest source-closure files byte-exact; package/signature/version, NFC-only permission, backup/transfer disabled, cleartext/network blocked and no Product dispatch/deep link; DEX 4 required present / 14 forbidden absent; Hermes Validation markers present and Product/network/database/storage markers absent |
| Historical DA5-V5-VAL-UI-01 source/review/CI — DO NOT INSTALL | Source `e97bbe9e2a281099899e2ecb3aad2588ef20f22d`; tree `2958f456875e8dab3f10834df280e10a8438efce`; exact-head CI `30370977809`, attempt 1, 12/12; Round-2 and Round-3 source reviews and independent formal Source/Artifact Exact-SHA review `APPROVED`, zero open P0–P3 |
| Historical `e97bbe9` Validation APK/manifest — DO NOT INSTALL | Directory `/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-validation/da5-v5-validation-e97bbe9e2a28-810b856ff7113b4f`; APK `app-release-810b856ff7113b4f.apk`, 65,629,505 bytes, mode `0444`, SHA-256 `810b856ff7113b4f2a454007595e1b6c1ae5dc69c601a2120b577f124e213e28`; manifest `manifest-e97bbe9e2a28.json`, 6,700 bytes, mode `0444`, SHA-256 `af53d646558449a7a5c907fbdf59e3366c6ffd2755f6049141db8e567549e051`; official verifier `PASS` |
| Historical Validation Runtime correction source/review/CI | Baseline `dbf8cfe643b56bdb3c6c371a95bfc463bbf8042f` / tree `80e17f54d62d386a02af3aa7e71b152cc3edb7b5`; first source `86c55fb17f64325046f2b25b45b84550c5a4b2bd` / tree `3a771945bc34852e4de098464c6c5bb82e74540b`, CI `30282537778` attempt 1 failed only on five-second timeout; timeout candidate `534b6d23e9391431fb4527c76347c16821ce3e18` / tree `a07429424184b4cd0b10841ea3e57c872afc4c8d`, CI `30282863442` attempt 1 12/12, initial independent review `CHANGES REQUIRED` exactly one P1; source `7e8c0f7742e6407b8917205fd337a552f7dec714` / tree `3e4d1356b859fecf70d365fecbb563e2088100f3`, CI `30284566289` attempt 1 12/12, independent re-review `APPROVED`, zero open P0–P3; superseded for installation by DA5-V5-VAL-UI-01 source correction |
| Historical Validation Runtime closure — DO NOT INSTALL | Exact 2,032,807-byte executable Metro bundle SHA-256 `e4caf2db73cfbcdaf779f337bf3a3f99e95d182950522323052bc31ae10c93d3`; exact 555-source/2,667,064-source-byte closure SHA-256 `29691fc137c63906e5cf0c5cd47e2df0643064ab6dbddc00e0d3ec467d492ed3`; ExpoAsset absent; package `com.tim180201.mobile.validation`; local synthetic signer; exact required native modules; zero forbidden modules or extra permissions |
| Historical Validation APK/manifest — DO NOT INSTALL | APK `/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-validation/da5-v5-validation-7e8c0f7742e6-303bfd33cf7fa000/app-release-303bfd33cf7fa000.apk`; 65,626,753 bytes; mode `0444`; SHA-256 `303bfd33cf7fa000ee808a048f91883c18dbfe85c1ba359d3f0764ac7ae7f2f8`. Same-directory `manifest-7e8c0f7742e6.json`; 6,700 bytes; mode `0444`; SHA-256 `11c1664cee37caa8b093a9023f571e3b8733e8bb078bf7f78b6f20d8f39388a7`; official verifier `PASS`; independent Artifact Exact-SHA review `APPROVED`, zero open P0–P3 for historical source only |
| Read-only APK path/size/SHA-256/mode | `/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5/a323834/app-release-385c0c46f22dcac5.apk`; 95,522,787 bytes; `385c0c46f22dcac5b935bfdc6f574558f4e74748ed4a367ef399ddbd4299c547`; `0444` |
| Read-only artifact manifest path/size/SHA-256/mode | `/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5/a323834/artifact-manifest.txt`; 1,647 bytes; `1c1f1b7a5b92fab5510cde35a439fc6f0742b7bf2666d6319cd89b9a7d4dcadb`; `0444` |
| Package/version/signature/signer/packaged runtime values | `com.tim180201.mobile.synthetic`; versionCode `1`; versionName `1.0.0`; v2 `true`, v1/v3/v3.1/v4 `false`; one local synthetic non-production signer certificate SHA-256 `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`; packaged boundary/runtime `match` |
| Device model/OS/build/screen-unlocked mode | `NOT BOUND` |
| Approved Tag labels/safe fingerprints by assigned/unassigned/unrelated role | `NOT BOUND` |
| Synthetic services/status/offline controls | `NOT BOUND` |
| Admin Setup Preview 2 entry/result/safe-exit procedure | `NOT BOUND` |
| DA5-T06 five-second dedupe boundary/lifecycle-cancellation checkpoint | `NOT BOUND` |
| Reviewed Protected/Review fixture, labels, start state, cutover, expected sequence and scoped teardown | `NOT BOUND` |
| Large-text setting/active allowlisted TalkBack package and version | `NOT BOUND` |

Historical query correction exact-head CI `30276804017`, attempt 1, and review-base CI
`30277641127`, attempt 1, each passed 12/12 and its independent Exact-SHA re-review closed P1/P3.
Final Runtime correction exact-head CI `30284566289`, attempt 1, passed 12/12; its independent
re-review and Artifact Exact-SHA review each returned `APPROVED` with zero open P0–P3, and the
official artifact verifier returned `PASS` for the exact final binding above. These automated and
review results are not Human preflight evidence or Human-run authority. The current `effc57a`
APK/manifest is independently reviewed but remains uninstalled and installation-unauthorized;
the `e97bbe9` and `7e8c0f7` artifacts are historical/DO NOT INSTALL.
Any new Phase 0 still requires a separate fresh exact Human authorization binding that exact
artifact, device, accessibility state and A/B/X Tags.

### 1.1 Historical enablement and isolated-PostgreSQL correction sequence — no Human result

Corrected ADO authorization candidate `cddb66d82047284c72688cc90a7491af761b8791`, tree
`8cda19f8df42febb34a03a4db4911d5ea8acae79`, passed exact-head CI `30159987539`,
attempt 1, 12/12; independent exact-delta re-review returned `APPROVED` with zero open P0–P3.
On exactly that baseline, the R3 enablement implementation was published as
`15f43b1b05e136e0d6643b1f10c1fc8310cfa838`, tree
`ed1e55c08dd13392f6f72bcf9265cdfaf547fa72`, and passed exact-head CI `30165425892`,
attempt 1, 12/12. Formal Exact-SHA review round 1 returned `CHANGES REQUIRED` with exactly four
P1, two P2 and one P3. Subsequent specialist audits additionally found sticky reverse-cleanup
uncertainty (P2), productive artifact/FD, binary-digest, stdin-runner-close and
installed-package-path verification gaps (P2), and legacy PostgreSQL provisioner
preflight/scoped-removal/password-state defects (P1/P2). The then-current
focused correction candidate kept an aborted/error reverse-mutation outcome sticky `uncertain`
through compensating close and the final Android-cleanup handoff; it performs full stable-FD
digest/lifecycle and buffer-zeroization verification, settles binary digest and stdin-runner
failures only after child close while retaining the first error, enforces the
installed-package-path parser boundary, and performs all legacy role/session/membership-option/setting/dependency
checks plus authoritative password-state verification behind an installer-superuser proof before
any exact scoped mutation. Focused Mobile passed 77/77 and complete Mobile passed 542/542;
real-PostgreSQL preservation passed 4/4, the normal success path passed 3/3 and complete Synthetic
passed 161/161. Both tests-inclusive typechecks, the Synthetic build, all
changed-MJS syntax checks, immutable-artifact/no-install preflight, scoped diff-check and final
PostgreSQL null-state proof passed.
The first attempted complete invocation remained incomplete only because its operator environment
pointed `backend-mobile-work` at the fresh empty task-owned `taptime_da3`. After correcting only
that invocation environment and making no code change, a full fresh invocation completed green:
21/21 workspace suites passed with 2,063 tests and exactly two optional B1 Supavisor skips, 21/21
tests-inclusive typechecks and 20/20 applicable builds passed, migrations 001–013 passed clean
apply/replay/ledger verification on PostgreSQL 17.10, C3B `verify-bin` passed, Mobile test sources
were included 39/39 by `tsc --listFilesOnly`, Android export completed with 861 modules and the
immutable-artifact/no-install preflight matched. Cleanup removed task-owned `taptime_da3` and
temporary export data; the DA5 Harness end state was `0|false|false|false` for generated roles,
schema, ledger and Legacy Guard DB, with no listeners on ports 3000/54321. The incomplete
invocation was an operator-environment issue, not a Product defect.

The round-1 correction was then published as
`a73173a0abe893c80f97b151262b18aa92b5bff5`, tree
`028e48247620c3d271f1dec04dbdcc83ab28c251`, and passed exact-head CI
`30169277329`, attempt 1, 12/12. Formal review round 2 returned `CHANGES REQUIRED` with exactly
two P1 findings against the Legacy PostgreSQL provisioner quarantine/session barrier and
dependency-safe cleanup boundary, plus one P3 finding against stale ADO navigation/status truth.
The uncommitted Shared-Cluster follow-up then specified the exact `NOLOGIN`/password-null
quarantine before any destructive transaction, failed closed on a fresh exact-role-OID activity
and granted-`virtualxid` census before every destructive step, and used namespace-wide dependency
proofs with `RESTRICT` cleanup. Focused red regressions reproduced both P1 defects 2/2; the
corrected Legacy preservation/concurrency boundary passed 7/7, the DA5 least-privilege success
boundary passed 3/3 and complete Synthetic passed 164/164. The tests-inclusive Synthetic
typecheck, explicit test-source inclusion proof and Synthetic build passed. Full V3,
Technical-Lead acceptance, a committed SHA/tree and Exact-Head CI binding, and formal review
round 3 remain pending; no follow-up approval is claimed here.

A subsequent precommit PostgreSQL safety audit found additional Role-OID ABA, DA5 preparation
TOCTOU/adoption, cleanup ownership/fingerprint/atomicity and real-PostgreSQL proof gaps in that
uncommitted follow-up. That later Shared-Cluster WIP revalidated exact role OID/state under a fixed
PostgreSQL-17 catalog-lock order before quarantine and destructive mutation; kept DA5 preparation
in one migration-locked/catalog-locked transaction with exact absence proofs and explicit
creation only; and bound cleanup to the immutable prepared profile plus a catalog-derived
ownership fingerprint before one rollback-safe destructive transaction. A safe new red
regression reproduced the cleanup profile mismatch 1/1 before correction. Corrected focused
Legacy preservation/concurrency passed 14/14, ownership-bound cleanup passed 9/9, the DA5
least-privilege success boundary passed 3/3 and complete Synthetic passed 180/180. The
tests-inclusive Synthetic typecheck, explicit 9/9 test-source inclusion proof, Synthetic build,
scoped diff-check and final PostgreSQL `0|false|false|false` null-state proof passed. The
raw-protocol authentication-boundary regression is deterministic, but local PostgreSQL 17 uses
host `trust`: its authenticated-role branch ran, while the implemented SASL/hidden-startup-VXID
branch was not locally exercised. Full workspace V3, Technical-Lead acceptance, a committed
SHA/tree and Exact-Head CI binding, and formal review round 3 remain pending; no follow-up
approval is claimed here.

The entire Shared-Cluster follow-up above is now `BLOCKED`, is not Candidate Evidence and is not
the current green path. Its focused 180/180 Synthetic result remains a historical WIP observation
only and is not Human/hardware Evidence.

The first isolated-PostgreSQL authorization candidate was published at
`72fbd3c20329dfbf3e8a1509025bd630b1bb130a`, tree
`dda615edd2e91c6b4d50bf979386937a9f3d249f`. CI `30176432929`, attempt 2, passed 12/12; attempt 1
timed out while pulling the Docker Hub image before checkout and tested no repository source.
Independent candidate review returned `CHANGES REQUIRED` with five P1, one P2 and one P3.

Round-2 correction candidate `7739757a4855ee7bac34408941e94c25516d75f5`, tree
`0398066e92fef65562526f61c9515b0ef3be0114`, exact parent `72fbd3c`, passed exact-head CI
`30177897059`, attempt 1, 12/12. Its technically enforced read-only Ultra re-review returned
`CHANGES REQUIRED` with exactly five P1, one P2 and one P3: terminal/process-group signals could
bypass PostgreSQL supervision under `detached=false`; compiler/helper/initdb lacked bounded
terminal hang cleanup; compiler/toolchain/environment trust was incomplete; rename lacked
source-inode/no-replace safety; final stat-to-unlink retained a destructive same-UID TOCTOU; the
copy-ready prompt named only one candidate file; and Decision Log/ADO navigation was stale.

The round-3 ADO draft specifies one native Runtime Guard compiled/tested once during the future R3
software phase, retained read-only with an Exact-SHA manifest and only verified—not compiled—by
later operational/hardware runs. It is the direct initdb/PostgreSQL parent in its own POSIX
session/process group with private-pipe-only Node control, bounded artifact-producer/initdb
termination, closed trusted toolchain/runtime environments and
platform-no-replace/descriptor/mount checks. It does not claim atomic same-UID cleanup: POSIX has
no portable inode-conditional unlink. The Human Architect selected Option A: one exclusive
trusted single-user operator session, with hostile/malicious same-UID processes and mount/unmount
churn outside the threat model. That selection is not implementation approval. The seven-file
correction still requires focused publication, successful exact-head CI and independent
`APPROVED` with zero open P0–P3 before only the exact R3 scope may activate through the
`AGENTS.md` standing rule. No implementation, installation, ADB, device/Tag or Human/hardware
authority exists.

Focused round-3 candidate `bbcb1b59703ee866539b2bc384ec9db8c2643fe4`, tree
`dfb5abbca1f2ddf603d191ae3303d1336f5440c7`, exact parent
`7739757a4855ee7bac34408941e94c25516d75f5`, passed exact-head CI `30185670176`, attempt 1,
12/12. Independent read-only review returned `CHANGES REQUIRED` with exactly two P1 and zero
P0/P2/P3: the PostgreSQL 17.10 Homebrew trust boundary needed root-or-exact-same-EUID ownership
plus complete canonical-chain/ACL/stable-identity binding and revalidation under Option A, and
initdb leader observation had to remain non-reaping until after its final possible negative-PGID
signal. The Human Architect authorized exactly one additional focused ADO correction/review round
beyond the three-round limit, limited to those findings. Focused extra-round candidate
`43567d256e8f633f16866448e1fb5abbd8022733`, tree
`feecced92abe9fc536a2db052b5a616d3e0f1cf7`, exact parent
`bbcb1b59703ee866539b2bc384ec9db8c2643fe4`, passed exact-head CI `30186846379`, attempt 1,
12/12. Its independent Exact-Delta review returned `CHANGES REQUIRED` with exactly one P1 and zero
P0/P2/P3: the current same-EUID-owned Homebrew Cellar ancestor is observed at mode `0775`, so
blanket group-write rejection cannot run and the exact trusted group plus complete current
membership snapshot were not bound. The review explicitly closed initdb P1-B.

The Human Architect confirms the second local administrator and exact complete decision-time
local macOS admin-group membership snapshot are trusted under Option A and authorizes exactly one last
focused ADO correction/review round limited to the remaining P1. The current last-round R0 draft
requires disclosure-safe immutable group-record and sorted UID/GUID membership binding to exactly
two decision-time direct members, zero nested groups, full-record digest
`b006276c09d8f2713f6132ea79cec167ab3a3c2887ee53e95eb00c1cc33719a5`, membership digest
`70a683b7ebc7981533015d5d63cf12dfb2eabbfa665c34720eddb4d09e9e3064` and combined snapshot
digest `2384b0baccd9049d820794f8ebc9419e4af0fad6831a5a91c209baa0b4a02217`. Later R3 must
recompute all three and both counts; mismatch returns to the Human Architect, never a later-
current rebind. Exact-group/exact-member/exact-mode revalidation, the canonical binaries' exact
observed `0555`, and fail-closed rejection of all other group/world write, group/member/mode/ACL/
symlink/swap drift remain mandatory. It changes no Product code or system/Homebrew/account/group/
membership/ownership/permission state and preserves Shared-Cluster `BLOCKED`/not-Evidence truth.
This paragraph is governance history, not Candidate Evidence, implementation approval or Human/
hardware authority; focused publication, exact-head CI and independent Exact-Delta `APPROVED`
with zero open P0–P3 remain required.

Six later separately authorized Phase-0 attempts occurred as recorded below; none produced an
attributable Tag result or reached Product Human V5. The Harness can accept A/B/X values only from
the operator and cannot independently prove their origin. Any further hardware action requires a
new explicit Human authorization.

Do not add credentials, credential/password/identity digests, tokens, secrets, raw UID/payload,
provider subjects, device serials, encryption keys, internal identifiers, CSV bodies or personal
data.

## 2. Consumed Phase-0 attempts and current preflight stop

| Attempt | Fail-closed stop | Cleanup/result |
|---|---|---|
| Phase 0 run 1 | Before Product action: Validation package already installed | Authority consumed; package zero and zero reverse mappings confirmed; no Tag scanned |
| Phase 0 run 2 | Before installation/NFC: active Samsung TalkBack `15.1.01.1` unsupported by the prior Google-only app | Authority consumed; package zero and zero reverse mappings confirmed; no Tag scanned |
| Phase 0 run 3 | Before Tag scan: generic launcher/package resolver did not uniquely start the explicit Activity | Authority consumed; cleaned; no Tag scanned |
| Phase 0 run 4 | Explicit `.MainActivity` reached cold start, then failed on missing ExpoAsset (`DA5-V5-VAL-RUNTIME-01`) | Authority consumed; package/process/reverse zero; no Tag scanned |
| Phase 0 run 5 | Then-current exact `7e8c0f7` Validation APK installed/verified and device checkpoint Human-confirmed; first required validation scan path then showed only generic fail-closed state with no distinguishable cause | Authority consumed; no attributable Tag result and no hardware defect proven; package/process/reverse zero; artifact now historical/DO NOT INSTALL |
| Phase 0 run 6 | On ADO baseline `96daac0b3cf1cfe98249a8c94fe927f34ee33af1` / tree `4e7ccd41a4fda0608a7e9deab7fbc258e1cf94bf`, the then-current exact `e97bbe9` artifact was installed/verified and the device checkpoint Human-confirmed; the first required A-scan showed only `Prüfung sicher gestoppt` / `Der Scan konnte nicht als gültiger lokaler Nachweis bestätigt werden` | Authority consumed; no cause or Tag result attributable and no hardware defect proven; package/process/reverse zero; artifact now historical/DO NOT INSTALL |

Final cleanup was package/process/reverse zero. The run-6 artifact is no longer installed; the
current `effc57a` artifact was not installed and no further hardware/ADB action occurred.
Another Phase 0 requires a fresh exact Human authorization.

### 2.1 Closed repository/source/artifact findings — Human Phase 0 still gated

`DA5-V5-VAL-UI-01` records a repository-visible accessibility/UI reliability gap capable of
reaching the strict Controller concurrency rejection when TalkBack repeats an otherwise identical
device-confirmation or active-scan activation. This code-level gap does not retrospectively prove
the indistinguishable run-5 cause or a hardware defect. The focused local correction adds a
separate UI-only explicit offer/revision boundary for identical repeated activations, keeps true
concurrent/out-of-order/foreign Controller calls fail-closed, restricts UI failure reasons to a
fixed disclosure-safe allowlist and removes Reset while capture owns the native operation while
retaining explicit Cancel/cleanup. It supplies no new Phase-0 authority. Source
`e97bbe9e2a281099899e2ecb3aad2588ef20f22d`, tree
`2958f456875e8dab3f10834df280e10a8438efce`, exact-head CI `30370977809`, attempt 1,
12/12, its Round-2/Round-3 source reviews and formal Source/Artifact Exact-SHA review are
`APPROVED` with zero open P0–P3. The exact replacement APK/manifest passed the official verifier.
That `e97bbe9` artifact and the earlier `7e8c0f7` values are now **HISTORICAL — DO NOT INSTALL**.

The native-capture diagnostics correction is source
`effc57a6780ff86784de0519a34abd6c5b7b8cd6`, tree
`758dbfaa04d0968fb25122352055fbcb80f8f022`, exact-head CI `30377569479`, attempt 1,
12/12. It maps Technology evidence, UID readability, listener/registration, digest, concurrency
and cleanup to six closed, typed, fixed allowlisted disclosure-safe stages without raw UID,
payload, Technology list, provider diagnostic, exception text or Logcat. NFC acceptance, timeouts
and Controller fail-closed behavior remain unchanged. Independent source review, final
prepublication review and Artifact Exact-SHA review are `APPROVED` with zero open P0–P3. The
current `effc57a` APK/manifest remains uninstalled and installation-unauthorized until a fresh
exact Human Phase-0 authorization.

### 2.2 Product Human-V5 preflight

| Check | Result | Safe observation |
|---|---|---|
| Separate exact Human authorization | `NOT RUN` | — |
| Repository/product/review/CI binding | `NOT RUN` | — |
| APK and manifest size/SHA-256/mode | `NOT RUN` | — |
| Package/version/signature/signer/runtime verification | `NOT RUN` | — |
| Named device/OS and approved Tags | `NOT RUN` | — |
| Fresh synthetic services/accounts/data and zero state | `NOT RUN` | — |
| Admin Setup Preview 2 and Protected/Review fixture review bindings | `NOT RUN` | — |
| Scoped install, NFC enabled and screen unlocked | `NOT RUN` | — |

## 3. Staged Human results

| Gate | Mandatory coverage | Result | Human checkpoint |
|---|---|---|---|
| A | Auth/enrollment, completed first assignment capture, separate Admin Setup Preview 2, zero lifecycle/queue/replay, setup preservation and rejection paths | `NOT RUN` | — |
| B | Cold/background Tag Dispatch; duplicate WorkEvent/Decision/Receipt/Audit with `duplicate_scan_ignored`; zero second TimeEntry mutation | `NOT RUN` | — |
| C | Online target/provenance/own-time truth with every opposite toggle strictly after five seconds | `NOT RUN` | — |
| E | TalkBack, text scaling, focus/labels/announcements and layout | `NOT RUN` | — |
| D | Ordinary offline/restart/cancellation, reviewed historical cutover, ordered `review_pending`, protected-state stop and no reuse | `NOT RUN` | — |
| F | Final safe truth and complete cleanup | `NOT RUN` | — |

## 4. Disclosure-safe result record

Populate only after a separately authorized run. Keep values aggregate and synthetic.

| Observation | Result |
|---|---|
| Initial safe aggregate | `NOT RUN` |
| Accepted/rejected action sequence matched the runbook | `NOT RUN` |
| Target and immutable provenance truth | `NOT RUN` |
| Own-time active/history truth | `NOT RUN` |
| Every intended opposite toggle had `dedupe_window_elapsed=match` | `NOT RUN` |
| Duplicate persisted four evidence records and zero second TimeEntry mutation | `NOT RUN` |
| Queue, synchronization and protected-state truth | `NOT RUN` |
| Protected/Review fixture reached the exact ordered outcomes and mandatory stop | `NOT RUN` |
| No duplicate, foreign or unexplained mutation | `NOT RUN` |
| Sensitive-data disclosure check | `NOT RUN` |

## 5. Failure, interruption or ambiguity

- Disposition: `NOT RUN`
- Gate/step: —
- Disclosure-safe symptom: —
- Later gates not started: —
- Authority consumed: `NOT RUN`
- Retry/repair/resume performed: `NOT RUN`

Any `FAIL` or `AMBIGUOUS` result consumes the complete one-run authority. Preserve only safe
diagnostics, mark all later gates not started and perform cleanup. No observation is reusable.

## 6. Cleanup

| Check | Result |
|---|---|
| Mobile/Admin sign-out and clipboard/download/screenshot cleanup | `NOT RUN` |
| Scoped service shutdown and mapping/listener cleanup | `NOT RUN` |
| Exact synthetic package removed | `NOT RUN` |
| Protected/Review fixture scoped teardown, without product repair/adjudication | `NOT RUN` |
| Disposable database/schema/ledger/runtime roles removed | `NOT RUN` |
| Repository binding reverified with protected exclusions | `NOT RUN` |
| Unrelated device/repository/PostgreSQL state preserved | `NOT RUN` |

## 7. Final Human disposition

- Overall result: `NOT RUN`
- Human checkpoint authority: `NOT BOUND`
- DA5 V5 closure decision: `NOT RUN`

This shell, automated evidence, software `MERGE_READY` status or cleanup alone cannot pass V5.
Production, production data, signing, deployment and distribution remain unauthorized.
