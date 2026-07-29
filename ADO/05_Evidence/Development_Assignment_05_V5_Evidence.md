# Development Assignment 5 — V5 Human Android Evidence

- Status: **PHASE-0 RUNS 7–10 REMAIN CONSUMED FAIL-CLOSED HISTORY WITHOUT A PROVEN PRODUCT/APK/NFC/HARDWARE FINDING — FINAL INSTALL-CATEGORY CORRECTION `12d1ace`, TREE `b747b43`, PARENT `b636419`, EXACT-HEAD CI `30466798295` ATTEMPT 1 12/12, PRIOR ROUND-2 DELTA REVIEW AND FINAL INDEPENDENT EXACT-HEAD/V4 REVIEW ARE `APPROVED` WITH ZERO OPEN P0–P3; ROUND-1 P2 CLOSED; V2/V3 AND V4 GREEN — TEN PHASE-0 AUTHORITIES CONSUMED — DO NOT START; NO CURRENT PHASE-0, HARDWARE, ADB, INSTALLATION OR PRODUCT-HUMAN-V5 AUTHORITY**
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

Ten separately authorized Phase-0 attempts are consumed fail-closed without an attributable Tag
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
reverse mappings at zero. Run 7 used ADO baseline
`aebffbec7c72c028ace6365ecdcc413e314526dd`, tree
`9e0104229756fe223753916ace8247ee2626f4d5`, and exact `effc57a` source/artifact. It stopped at
the first required A-scan with fixed safe failure stage `technology_evidence`. The authority is
consumed; there is no fingerprint or Tag result. Concrete physical `techTypes` were intentionally
not exposed and remain unknown, no hardware defect is proven, and cleanup again confirmed
package, process and reverse mappings at zero.

Run 8 used ADO/code baseline `39a6ef09fad18375af025bc8ed12cc1ea6dda964`, tree
`10cdf16421fe564e1961a39d79e20775c0269fc4`, and the exact `03694f2` artifact. Installation
succeeded, but an ad-hoc host pathname regex rejected the legitimate Android-15 installed path
solely because it contained `~`. `.MainActivity` was not started, the Validation process was
absent, and no checkpoint, scan, fingerprint or Tag result was reached. Its authority is consumed;
uninstall succeeded and final package, process and global reverse state were zero. This is an
operator-boundary failure, not a Product, NFC or hardware result.

Run 9 used baseline `2f057cb4e5d096e34785c72c51340f589c711dd2`, tree
`6f65f44e53574921f1e8e9fdfde94f7a9a9ade2c`. Its complete safe receipt sequence was
`artifact:match`, `preflight:match`, `install_launch:mismatch`, `cleanup:match`,
`failed:mismatch`. No scan or Validation UI handoff occurred. That aggregate output cannot
reconstruct whether installation, installed provenance, prelaunch, explicit Activity start or
postlaunch verification failed. It proves no Product, NFC or hardware defect. The authority is
consumed, and terminal cleanup restored package, process and global reverse state to zero.

Run 10 used baseline `b63641953536bb36625fcd42d850e429ddab8db3`, tree
`dc1b9a11e0391074b35139f5948ef6b2c45f1d26`. Its complete safe receipt sequence was
`artifact:match`, `preflight:match`,
`stage=installation status=mismatch category=operation_mismatch`,
`install_launch:mismatch`, `cleanup:match`, `failed:mismatch`. It emitted no
`installed_provenance` receipt and reached no Validation UI, NFC or Tag step. Because the then
current `installation` category also summarized verification mismatches before the PackageManager
call, the exact cause is not further reconstructable and the category does not prove that the
install call ran. It establishes no Product, APK, NFC or hardware finding. The authority is
consumed, terminal cleanup matched, and another run remains **DO NOT START** without fresh exact
Human authorization.

The focused local Run-10 diagnostic correction preserves every stage, aggregate receipt,
mutation, cleanup and terminal boundary. A pre-install device re-attestation mismatch remains
`installation` + `verification_mismatch`; the category changes to `operation_mismatch` only
immediately before the PackageManager install call. The new regression proves no install mutation
or runner call, exact aggregate/terminal ordering and no synthetic-secret disclosure; the existing
true install-failure matrix remains `installation` + `operation_mismatch`.

Combined V2/V3 evidence on the unchanged 950-file tracked candidate used Node `24.17.0`, npm
`11.13.0` and task-owned PostgreSQL `17.10`. Carried isolated evidence supplied 20/20 builds,
21/21 tests-inclusive typechecks, Mobile 52/52 test-source inclusion, suites 1–8 covering 107 test
files and 1,275 passed tests, and migrations 001–013 apply/replay/ledger. Fresh authorized
continuation supplied suites 9–21 covering 42 test files and 1,240 passed tests with exactly two
optional B1 Supavisor skips, C3B `verify-bin`, the official unchanged `03694f2` artifact verifier
and one isolated Android export. Overall, 21/21 suites passed across 149 test files and 2,515
tests; Android bundled 861 modules into one 2,927,682-byte Hermes bundle plus 150-byte metadata.
No V4 was executed locally, and no ADB, installation or hardware action occurred. The final
tracked comparison matched 950/950 before the four-file ADO-only synchronization; that
synchronization changed no executable/test bytes. PostgreSQL stopped cleanly, ports `55439` and
`55435` were absent, and all task roots were removed.

The install-category correction is technically final and published as
`12d1ace89494851025555d1d06d45570c4fcc4cb`, tree
`b747b4306637d90765b33f273ad89291bd4ea9a7`, on exact parent
`b63641953536bb36625fcd42d850e429ddab8db3`. Its exact code/test delta is limited to
`apps/mobile/scripts/da5V5ValidationPhase0OperatorCore.mjs` and
`apps/mobile/tests/runtime/da5V5ValidationPhase0Operator.test.ts`; the published six-file delta
contains only the four synchronized ADO truth files in addition. V2/V3 above are green.
Exact-head V4 CI `30466798295`, attempt 1, completed successfully 12/12. The prior round-2 delta
review and final independent Exact-Head/V4 review returned `APPROVED` with zero open P0–P3,
closing the round-1 P2. All ten Phase-0 authorities remain consumed; the operator remains
**DO NOT START**, with no new Phase-0, hardware, ADB, installation or Product Human-V5 authority.

Non-code preparation stops were retained rather than hidden: contaminated main-workspace native
dependency outputs exceeded the fail-closed source-closure bound; the first clean safe-root ran
Mobile before required contract entrypoints; B1 first lacked `B1_RUNTIME_PASSWORD`; the first
artifact-verifier binding supplied 32 paths instead of 32 `{path, sha256}` records; and the first
Expo invocation supplied an unsupported positional project path. Each stopped fail-fast without
an unchanged retry. Each continuation required a new exact Technical-Lead authorization and
changed only runner environment or invocation; the subsequently required checks passed and all
task-owned state was cleaned.

The now-historical diagnostics correction source is
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

The now-historical read-only 65,631,681-byte `effc57a` APK (`e423073e…7330f`) and 6,700-byte manifest
(`9d1238e8…ccc22`) passed independent Artifact Exact-SHA review with zero open P0–P3. That review
verified all 32 manifest source-closure files byte-exact, package/signature/version and security
boundaries, DEX 4 required present / 14 forbidden absent, and Hermes Validation markers present
with Product/network/database/storage markers absent. It is archived in
`ADO/05_Evidence/Development_Assignment_05_DA5_V5_VAL_NATIVE_CAPTURE_DIAGNOSTICS_Independent_Source_Artifact_Exact_SHA_Review.md`.
After run 7 the artifact is no longer installed and is **HISTORICAL — DO NOT INSTALL**.

`DA5-V5-VAL-TECH-01` confirms a repository defect in that exact source: its helper required a
closed Technology allowlist, rejected duplicate entries and imposed the allowlist length as a
maximum. Focused correction source `03694f2d877bc323791e93473ad01ceb82af70df`, tree
`6c6039683e067ef29f1f917a60c2628d26e38784`, passed exact-head CI `30386552118`,
attempt 1, 12/12; prepublication review round 2 returned `APPROVED` with zero open P0–P3.
An array must contain both fully qualified `android.nfc.tech.NfcA` and
`android.nfc.tech.MifareUltralight`; additional or duplicated entries are ignored for the
decision and are neither returned nor persisted. Contract, output label, UID/digest handling,
timeout, Controller and filter remain unchanged.

One fresh research-free build published the read-only candidate directory
`/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-validation/da5-v5-validation-03694f2d877b-d2084486b07f27bd`.
Its 65,631,433-byte `0444` APK has SHA-256
`d2084486b07f27bdbd72f9f32e38531f8de31dad18ef4789cab2ec44135e05f5`; its 6,700-byte
`0444` manifest has SHA-256
`aa2a243cd4f81ead806c43e27d6f9c12c28e396db64fe556d8ddf02a8d52f347`. All 32 source-closure
entries matched the exact source. Package/version, local-only v2 signer, NFC-only/no-network/
cleartext/backup boundary, required/forbidden native modules and Validation-only runtime markers
matched, and the official verifier returned `PASS`. Independent Source/Artifact Exact-SHA review
returned `APPROVED` with zero open P0–P3. The candidate remains **DO NOT INSTALL** because no
separate Phase-0, installation, ADB or hardware authority exists.
The safe run-7 stage and repository diagnosis expose no concrete physical Technology list,
fingerprint or Tag result and prove no hardware defect.

No current Phase-0/hardware/ADB/installation authority exists, and Product Human V5 is `NOT RUN`.
No production, production-data, system-change, deployment or distribution result is claimed.
Historical candidate and review details remain preserved below.

## 1. Authority and exact binding

This record mirrors
`ADO/04_Operations/Development_Assignment_05_V5_Runbook.md`. It records the historical Validation
artifacts, exact TECH-01 source/CI/source-review bindings, the independently approved exact
replacement artifact and all ten consumed Phase-0 attempts, but no attributable Tag result or
Product Human result. It grants no new Human-run or installation authority.

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
| Historical DA5-V5-VAL-NATIVE-CAPTURE-DIAGNOSTICS source/review/CI | Source `effc57a6780ff86784de0519a34abd6c5b7b8cd6`; tree `758dbfaa04d0968fb25122352055fbcb80f8f022`; exactly seven authorized changed files; exact-head CI `30377569479`, attempt 1, 12/12; independent source review and final prepublication review `APPROVED`, zero open P0–P3 |
| Historical `effc57a` Validation V3 | 20/20 builds; 21/21 tests-inclusive typechecks; 21 workspace suites / 147 test files / 2,373 tests; exactly two documented optional B1 skips; migrations 001–013 apply/replay/ledger, C3B CLI and Android export passed. Initial Synthetic stop solely from Technical-Lead runner database-name configuration; previously unexecuted unchanged suite passed 288/288 on a fresh exact database; no port or temporary residue |
| Historical `effc57a` Validation APK/manifest — DO NOT INSTALL | Directory `/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-validation/da5-v5-validation-effc57a6780f-e423073e51f72a68`; APK `app-release-e423073e51f72a68.apk`, 65,631,681 bytes, mode `0444`, SHA-256 `e423073e51f72a68421c8e4afd17a9b86c397ca83628deaf4b174543d817330f`; manifest `manifest-effc57a6780f.json`, 6,700 bytes, mode `0444`, SHA-256 `9d1238e821d92b26ed9bc9b9ee8ccd48607280ff0d0e752ec6965827c68ccc22`; independent Artifact Exact-SHA review `APPROVED`, zero open P0–P3 |
| Historical `effc57a` Validation package/security boundary | `com.tim180201.mobile.validation`; versionCode `1`; versionName `1.0.0`; signing scope `local-validation-only`; one v2 signer with certificate SHA-256 `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`; NFC-only; no network permission; cleartext denied; backup disabled; no Product deep links or Tag dispatch |
| Historical `effc57a` Validation source/native closure | Metro source closure 555 entries / 2,675,576 bytes / SHA-256 `e9fee0629af81357e4563836f9f5ef2b404c1ef97bc135d1cb3ed410f713b593`; executable 2,040,604 bytes / SHA-256 `c24457514436a63878107e1593dc90c6de17ad2424a6b625a6f18a14f66b8cfe`; unchanged native source 123 directories / 587 entries / 464 files / 1,176,224 bytes / SHA-256 `9194be29b96a67c47aa40a4bdea7494155695e088d769e21c77eff305b1ee259` |
| Historical `effc57a` Artifact Exact-SHA review | `APPROVED`, zero open P0–P3; all 32 manifest source-closure files byte-exact; package/signature/version, NFC-only permission, backup/transfer disabled, cleartext/network blocked and no Product dispatch/deep link; DEX 4 required present / 14 forbidden absent; Hermes Validation markers present and Product/network/database/storage markers absent |
| `DA5-V5-VAL-TECH-01` source/review/CI | `03694f2d877bc323791e93473ad01ceb82af70df`; tree `6c6039683e067ef29f1f917a60c2628d26e38784`; exact-head CI `30386552118`, attempt 1, 12/12; prepublication review round 2 `APPROVED`, zero open P0–P3 |
| Validation Phase-0 operator source/review/CI — DO NOT START | Baseline `39a6ef09fad18375af025bc8ed12cc1ea6dda964`, tree `10cdf16421fe564e1961a39d79e20775c0269fc4`; candidate `083fdfb259089d976e48f824e0862f10637d3290`, tree `24bd130500934c6a48fd9314fa06387d6ebdedcd`; exact-head CI `30402655381`, attempt 1, 12/12; independent Exact-SHA re-review round 2 `APPROVED`, zero open P0–P3; both round-1 P1 findings closed; no Phase-0, installation, ADB or hardware authority |
| Final install-category correction/review — DO NOT START | Candidate `12d1ace89494851025555d1d06d45570c4fcc4cb`; tree `b747b4306637d90765b33f273ad89291bd4ea9a7`; parent `b63641953536bb36625fcd42d850e429ddab8db3`; exact code/test delta limited to the Operator core and focused runtime test, plus four synchronized ADO truth files; V2/V3 green; exact-head V4 CI `30466798295`, attempt 1, 12/12; prior round-2 delta review and final independent Exact-Head/V4 review `APPROVED`, zero open P0–P3; round-1 P2 closed; no Phase-0, installation, ADB or hardware authority |
| Historical install-/launch-diagnostic predecessor/review — DO NOT START | Candidate `8ce03852e782d541319bb852f216cf596ab1787f`; tree `f5b914c1b8f1243244733808beaef54f0351a563`; parent `2f057cb4e5d096e34785c72c51340f589c711dd2`; exact eight-file +488/-132 delta; patch SHA-256 `c8418fe6382c8a23ada44254c2fdc35652acbb73a8f99983f5cbb4cc11b46984`; V1/V2 executed green; unchanged V3 carried from `496ca59`/tree `b398b89`; exact-head CI `30459539801`, attempt 1, 12/12; independent Exact-Delta/Commit/Tree/CI review `APPROVED`, zero open P0–P3; no Phase-0, installation, ADB or hardware authority |
| Historical published Phase-0 readiness candidate/review — DO NOT START | Candidate `496ca59f0965670b29a210b8aa2443b99bb4a386`, tree `b398b89c77f7f0b4799a7a06b11bd2daf51fd34a`; baseline `fa1aaa782415aceb85c0aa5c1233732ef9afa4dc`, tree `da69081517d2b0b9631eaef393b0a6022735061e`; safe-root V3/eight-file candidate has no code finding; exact-candidate CI `30427205223`, attempt 1, completed failure 11/12; job `90496143535` passed 3/3 files and 121/121 assertions before later unhandled PostgreSQL `57P01` on `taptime_c3e1_dirty_*`; formal review `CHANGES REQUIRED`, exactly one P2 CI/test-reliability finding, no Product/Security finding; no retry |
| PostgreSQL test-cleanup correction — technically closed/DO NOT START | Candidate `21e518151a3f4727ebf4ce90cd1557660960ff21`, tree `8f764f9260378b631b4b026355852c324d6dc06b`; parent `d63c62de9eced5f7dd62c8c957d4c2fffce77bf9`, tree `753feedcae6724e711557e6492bbe26fa0b02083`; seven test-only files, +192/-12, delta SHA-256 `b0406bc02a085649060b3dfdb263db00694e501efbe1c247f3ba49fec3cb53e2`; V1 2/2, V2 B3 128/128 + C3B 60/60 + C3C/C3E1 102/102 and three tests-inclusive typechecks passed; unchanged green V3 carried from `496ca59`; exact-head CI `30429746848`, attempt 1, 12/12 without retry; independent source/delta and final Exact-SHA/V4 reviews `APPROVED`, zero open P0–P3; historical P2 closed; no hardware authority |
| `DA5-V5-VAL-TECH-01` candidate APK/manifest — DO NOT INSTALL | Directory `/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-validation/da5-v5-validation-03694f2d877b-d2084486b07f27bd`; APK `app-release-d2084486b07f27bd.apk`, 65,631,433 bytes, mode `0444`, SHA-256 `d2084486b07f27bdbd72f9f32e38531f8de31dad18ef4789cab2ec44135e05f5`; manifest `manifest-03694f2d877b.json`, 6,700 bytes, mode `0444`, SHA-256 `aa2a243cd4f81ead806c43e27d6f9c12c28e396db64fe556d8ddf02a8d52f347`; official verifier `PASS`; independent Source/Artifact Exact-SHA review `APPROVED`, zero open P0–P3 |
| `DA5-V5-VAL-TECH-01` candidate package/security/source boundary | All 32 manifest source-closure entries byte-exact; `com.tim180201.mobile.validation`; versionCode `1`; versionName `1.0.0`; `local-validation-only`; one v2 signer, certificate SHA-256 `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`; NFC-only; no network permission; cleartext denied; backup/transfer denied; no Product deep links or Tag dispatch; required native modules present, forbidden modules absent; Validation marker present and Product runtime marker absent |
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
review results are not Human preflight evidence or Human-run authority. The `effc57a`, `e97bbe9`
and `7e8c0f7` APK/manifest artifacts are historical/DO NOT INSTALL.
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

Ten later separately authorized Phase-0 attempts occurred as recorded below; none produced an
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
| Phase 0 run 7 | On ADO baseline `aebffbec7c72c028ace6365ecdcc413e314526dd` / tree `9e0104229756fe223753916ace8247ee2626f4d5`, the exact `effc57a` artifact was installed/verified and the authorized checkpoint passed; the first required A-scan stopped at fixed safe stage `technology_evidence` | Authority consumed; no fingerprint or Tag result; concrete physical `techTypes` intentionally not exposed and unknown; no hardware defect proven; package/process/reverse zero; artifact now historical/DO NOT INSTALL |
| Phase 0 run 8 | On ADO/code baseline `39a6ef09fad18375af025bc8ed12cc1ea6dda964` / tree `10cdf16421fe564e1961a39d79e20775c0269fc4`, the exact `03694f2` artifact installed successfully; an ad-hoc host regex then rejected its legitimate Android-15 installed path solely because it contained `~`, before `.MainActivity` launch | Authority consumed; Validation process absent; no checkpoint, scan, fingerprint or Tag result and no hardware defect proven; uninstall succeeded; package/process/global reverse zero |
| Phase 0 run 9 | On baseline `2f057cb4e5d096e34785c72c51340f589c711dd2` / tree `6f65f44e53574921f1e8e9fdfde94f7a9a9ade2c`, the operator emitted exactly `artifact:match`, `preflight:match`, `install_launch:mismatch`, `cleanup:match`, `failed:mismatch`; no scan or UI handoff was reached and the exact install-/launch cause is not reconstructable | Authority consumed; no Product, NFC or hardware defect proven; terminal cleanup restored package/process/global reverse zero |
| Phase 0 run 10 | On baseline `b63641953536bb36625fcd42d850e429ddab8db3` / tree `dc1b9a11e0391074b35139f5948ef6b2c45f1d26`, the operator emitted exactly `artifact:match`, `preflight:match`, `stage=installation status=mismatch category=operation_mismatch`, `install_launch:mismatch`, `cleanup:match`, `failed:mismatch`; no `installed_provenance` receipt or UI/NFC/Tag step was reached, and the exact cause is not reconstructable because the then-current category also summarized pre-install verification mismatches | Authority consumed; terminal cleanup matched; no Product, APK, NFC or hardware finding proven; another run remains DO NOT START without fresh exact Human authorization |

Run 10 terminal cleanup matched. The run-7 through run-9 artifacts are no longer installed, run
10 reached no attributable installation provenance, and no further hardware/ADB action occurred.
Another Phase 0 requires a fresh exact Human authorization.

### 2.1 Validation Phase-0 operator R1 correction — independently approved, non-executable

On baseline `39a6ef09fad18375af025bc8ed12cc1ea6dda964`, tree
`10cdf16421fe564e1961a39d79e20775c0269fc4`, the focused correction is published as
`083fdfb259089d976e48f824e0862f10637d3290`, tree
`24bd130500934c6a48fd9314fa06387d6ebdedcd`. It adds only a Core, thin direct CLI, `.d.mts` and
one focused runtime test, with no package script. The candidate binds the exact `03694f2`
APK/manifest and all 32 source-closure records, accepts bounded legitimate
Android installed paths including `~`, streams only a stable verified host snapshot into the exact
package install, proves the installed bytes and identity, launches only
`com.tim180201.mobile.validation/.MainActivity`, and owns fail-closed cleanup without reverse
mutation.

Formal review R1 returned `CHANGES REQUIRED` with exactly two P1 findings: implicit User-0 package
inspection combined with global/default install/uninstall made package provenance fail-open, and
cleanup/finish used only a loop-entry bound while ADB calls, active-operation settlement and
post-SIGKILL runner completion could exceed it. The local R1 correction now accepts only the exact
non-headless single running Owner User 0 topology, proves package null with the user-0
known/hidden/uninstalled PackageManager view, uses `-R` and explicit user-0 package actions, and
latches ownership only after exact install success plus path/canonical/stat/version/digest proof.
It re-attests that token before force-stop and before version-conditional uninstall; any unproved,
ambiguous or replaced package is preserved with mismatch. One absolute deadline now begins at the
first finish/abort request, caps every cleanup wait/ADB call and forbids a match at expiry. Both
shared text and binary ADB paths force terminal rejection after TERM/KILL grace without depending
on child close. Android exposes a version-conditional uninstall but no atomic
digest/signature-conditional uninstall; the remaining same-version final race is therefore
bounded by the existing trusted exclusive Option-A operator/session assumption and is not claimed
as protection against a hostile same-user concurrent package actor.

Focused R1-correction V1/V2 on 2026-07-28 used no ADB or hardware: all three changed operator/
shared-runner MJS entry points passed `node --check`; the exact operator and shared child-runner
test files passed 128/128 together; Mobile `tsc --noEmit` passed; and
`tsc --noEmit --listFilesOnly` explicitly included both changed test sources. No V3, artifact
verification, Android export, exact-head CI, installation or hardware action was run for this R1
correction.

The initial focused regression proof failed exactly one test because the deliberately narrow
parser rejected the legitimate Android-15 `~` path. After correction, both operator files passed
`node --check`, the focused suite passed 92/92, Mobile `tsc --noEmit` passed, and
`tsc --noEmit --listFilesOnly` confirmed the focused test is included. All 32 source-closure files
matched the immutable manifest byte-exactly, and the official read-only Validation artifact
verifier was run exactly once and passed. These checks used no ADB or hardware.

The complete Mobile suite was run once in the existing workspace: 51/52 test files and 792/793
tests passed. Only `da5V5ValidationNativeSourceBinding.test.ts` failed because existing generated
native `.cxx`/`build` residue expanded the enumerated native closure beyond its fixed source bound;
the new operator paths are not members of that closure. Per Technical-Lead direction nothing was
deleted or moved and the suite was not repeated in the contaminated workspace.

The final fresh safe-root V3 used Node `24.17.0`, npm `11.13.0` and a task-owned isolated
PostgreSQL `17.10` cluster. It passed 20/20 builds, 21/21 tests-inclusive typechecks and 21/21
workspace suites covering 148 test files, 2,467 passed tests and exactly two documented optional
B1 skips. Migrations 001–013 applied, replayed idempotently and passed ledger verification; the
C3B binary check, 52/52 Mobile test-file inclusion, the unchanged official Validation artifact
verifier and Android export of 861 modules passed. The first Backend API invocation stopped only
because the Technical-Lead runner had bound four C2 runtime URLs to the installer identity; after
correcting that environment binding, Backend API and the then-unexecuted remaining workspaces
passed. The first Synthetic invocation later stopped only because its task-owned database used an
alternate safe name while the suite requires exact `taptime_synthetic_android_e2e`; renaming that
same isolated database and rerunning only Synthetic produced 288/288. Neither runner correction
changed candidate bytes. The isolated server, port, worktree and export were cleaned; the three
task-owned directories were moved recoverably to the macOS Trash. No ADB or hardware was used.

The final post-R1-correction fresh safe-root V3 used the same exact toolchain and a new task-owned
isolated PostgreSQL `17.10` cluster. It passed 20/20 builds, 21/21 tests-inclusive typechecks and
21/21 workspace suites covering 148 test files, 2,484 passed tests and exactly two documented
optional B1 skips. Migrations 001–013 applied, replayed idempotently and passed ledger
verification; the C3B binary check, 52/52 Mobile test-file inclusion, the unchanged official
Validation artifact verifier and Android export of 861 modules passed. The first Synthetic
invocation passed 12/13 files and 285/288 tests; its three failures were exact
`Da5V5CiPostgresAdapter` `ENOENT` results because the Technical-Lead sparse-worktree definition
had omitted the tracked `.github/workflows/ci.yml`. Materializing only tracked `.github` and
executing only that affected file passed 31/31; candidate bytes were unchanged and the combined
unique Synthetic matrix is 13/13 files and 288/288 tests. The final exact 11-file candidate
matched the source workspace byte-for-byte and passed scoped diff inspection. Task PostgreSQL,
ports, worktree and export were cleaned, the existing local PostgreSQL listener remained
untouched, and the three task-owned directories were moved recoverably to the macOS Trash. No ADB,
installation or hardware was used.

Exact-head CI `30402655381`, attempt 1, passed 12/12 on
`083fdfb259089d976e48f824e0862f10637d3290`. Independent Exact-SHA re-review round 2 returned
`APPROVED` with zero open P0–P3 and closed both round-1 P1 findings. The review archive is
`ADO/05_Evidence/Development_Assignment_05_V5_Validation_Phase_0_Operator_Correction_Independent_Exact_SHA_Review.md`.
The candidate remains **DO NOT START** and grants no Phase-0, installation, ADB, hardware or
Product Human-V5 authority.

### 2.2 Historical published Phase-0 readiness candidate — V3 passed; V4 failed; review changes required; Human not run

The published eight-file candidate
`496ca59f0965670b29a210b8aa2443b99bb4a386`, tree
`b398b89c77f7f0b4799a7a06b11bd2daf51fd34a`, starts from exact baseline
`fa1aaa782415aceb85c0aa5c1233732ef9afa4dc`, tree
`da69081517d2b0b9631eaef393b0a6022735061e`. It replaces only the incompatible process-query
boundary with strict Android-Toybox `ps -A -w -o NAME:4` parsing, adds the one-time
`human-pass`/separate Human-passed state, extends the persistent idempotent signal set to exactly
`SIGHUP`, `SIGINT`, `SIGQUIT` and `SIGTERM`, and makes terminal receipt/deadline ordering
deterministic. It changes no Validation App or artifact input and remains **DO NOT START**.

The final fresh detached sparse safe-root V3 bound executable-patch SHA-256
`5dea48121b62fe7ebb4894f72425aa5ef5f759e113c3dd349f9fd48bb29fe9b4`, Node
`24.17.0`, npm `11.13.0` and task-owned PostgreSQL `17.10`. Its unique build evidence is
20/20: the first alphabetical invocation passed 15/20, then only the five dependency-sensitive
not-yet-successful builds ran topologically and passed 5/5 without candidate-byte changes.
Typechecks passed 21/21. All 21/21 workspace suites passed across 148 test files and 2,505 tests
with exactly two optional B1 Supavisor skips; Mobile passed 52/52 files and 857/857 tests, and
Synthetic passed 13/13 files and 288/288 tests. Migrations 001–013 applied, replayed with
`applied=none` and passed ledger verification. C3B `verify-bin`, 52/52 Mobile test-source
inclusion, the unchanged official `03694f2` artifact verifier and one isolated Android export of
861 modules passed. One pre-mutation migration-runner assertion stopped only on the macOS
`/tmp`/`/private/tmp` lexical alias before the canonical-path continuation passed; the Mobile
inclusion `tsc --listFilesOnly` succeeded before two comparison-only PATH corrections and its
single final comparison matched 52/52. No product assertion was retried. PostgreSQL was
reattested and stopped, ports 55437/55435 were absent, and the complete task root containing the
safe clone, npm cache, PGDATA and export was moved recoverably to Trash. The candidate's four-file
ADO synchronization was R0 over unchanged executable/test bytes. The safe-root V3/eight-file
candidate itself has no code finding.

Exact-candidate CI `30427205223`, attempt 1, completed failure with 11/12 jobs. Job
`90496143535` became red after its 3/3 files and 121/121 assertions passed because a subsequent
unhandled PostgreSQL `57P01` occurred on `taptime_c3e1_dirty_*`. The C3E1 test, backend and
workflow are unchanged; the test blob is identical to green `083fdfb` and five previous green CI
runs. The cause is the `dirtyPool.end()` to immediate `DROP DATABASE ... WITH (FORCE)` sequence
racing asynchronous client-end handling in `pg-pool@3.14.0`. Independent formal review returned
`CHANGES REQUIRED` with exactly one P2 outside the candidate scope for CI/test reliability and no
Product or Security finding. No retry was authorized or executed. At that historical checkpoint,
a focused harness correction and new CI required new Human authority; no Phase-0, installation,
ADB or hardware authority existed.

### 2.3 PostgreSQL test-cleanup correction — V4/review approved; Human not run

The subsequently authorized focused test-only correction is
`21e518151a3f4727ebf4ce90cd1557660960ff21`, tree
`8f764f9260378b631b4b026355852c324d6dc06b`, on exact parent
`d63c62de9eced5f7dd62c8c957d4c2fffce77bf9`, tree
`753feedcae6724e711557e6492bbe26fa0b02083`. Its exact seven-file test-only delta is
+192/-12 with SHA-256
`b0406bc02a085649060b3dfdb263db00694e501efbe1c247f3ba49fec3cb53e2`. It removes the
equivalent post-`Pool.end()`/drop race from the known B3, C3B, C3C and C3E1 dirty-database
finalizers: each waits boundedly for zero sessions of the exact bound test database, then drops
without `FORCE`. The separate pre-test cleanup and C3E2 remain unchanged.

Focused V1 passed 2/2. V2 passed B3 128/128, C3B 60/60 and C3C+C3E1 102/102; tests-inclusive
typechecks for schema, bootstrap and administration passed. The unchanged safe-root V3 evidence
from `496ca59`/tree `b398b89` was carried forward under unchanged product, operator, Validation
App/artifact, workflow, dependencies and lockfile. Exactly one new full exact-head CI,
`30429746848`, attempt 1, passed 12/12; no retry occurred. Independent source/delta and final
Exact-SHA/V4 reviews returned `APPROVED` with zero open P0–P3. The historical P2 is closed; no
Product or Security finding remains.

This correction and its evidence grant no Phase-0, installation, ADB, hardware, device/Tag or
Product Human-V5 authority. The operator remains **DO NOT START**, and Product Human V5 remains
`NOT RUN`.

### 2.4 Historical install-/launch-diagnostic predecessor — exact candidate/review approved; Human not run

Candidate `8ce03852e782d541319bb852f216cf596ab1787f`, tree
`f5b914c1b8f1243244733808beaef54f0351a563`, on exact parent
`2f057cb4e5d096e34785c72c51340f589c711dd2` contains the exact eight-file +488/-132 delta with
patch SHA-256 `c8418fe6382c8a23ada44254c2fdc35652acbb73a8f99983f5cbb4cc11b46984`.
It preserves the aggregate `install_launch`, fail-closed cleanup, ownership, absolute deadline,
Human-PASS and terminal semantics. A failure emits exactly one matching fixed stage from
`installation`, `installed_provenance`, `prelaunch`, `activity_start` and `postlaunch`, plus
exactly one category from `operation_mismatch` and `verification_mismatch`, immediately before
`install_launch:mismatch`. The mapping is selected only by local closed control flow. No
`Error.message`, raw command output, installed path, device serial or PackageManager output is
emitted.

V1/V2 executed green: both changed MJS files passed `node --check`; the complete affected Mobile
Operator test file passed 137/137; Mobile `tsc --noEmit` passed and its `--listFilesOnly` result
included the changed test source. The first typecheck exposed only a new test-callback
implicit-`any` (`TS7006`); that test typing was corrected and the repeated focused
test/typecheck sequence passed. Unchanged green V3 from `496ca59`/tree `b398b89` was carried.
Exact-head CI `30459539801`, attempt 1, passed 12/12. Independent
Exact-Delta/Commit/Tree/CI review returned `APPROVED` with zero open P0–P3.

No ADB, installation, App launch, hardware or network action was performed. The candidate remains
**DO NOT START**; this approval grants no Phase-0, installation, ADB, hardware or Product Human-V5
authority. Any run requires separate fresh exact Human authorization.

### 2.5 Final install-category correction — V2/V3/V4 and reviews approved; Human not run

Published candidate `12d1ace89494851025555d1d06d45570c4fcc4cb`, tree
`b747b4306637d90765b33f273ad89291bd4ea9a7`, has exact parent
`b63641953536bb36625fcd42d850e429ddab8db3`. Its exact code/test delta is limited to
`apps/mobile/scripts/da5V5ValidationPhase0OperatorCore.mjs` and
`apps/mobile/tests/runtime/da5V5ValidationPhase0Operator.test.ts`; the complete published
six-file delta adds only the four synchronized ADO truth files. The correction keeps pre-install
device re-attestation mismatches in `verification_mismatch` and switches to
`operation_mismatch` immediately before the PackageManager install call.

V2/V3 passed as recorded above. Exact-head V4 CI `30466798295`, attempt 1, completed
successfully 12/12. The prior round-2 delta review and final independent Exact-Head/V4 review
returned `APPROVED` with zero open P0–P3; the round-1 P2 is closed. This is the technically final
install-category correction. All ten Phase-0 authorities remain consumed, the operator remains
**DO NOT START**, and no fresh Phase-0, hardware, ADB, installation or Product Human-V5 authority
exists.

Any future separately authorized Phase-0 record must populate every row below. The automated
operator does not attest UI truth; only the trusted Human can provide the one-time PASS handoff
after all UI rows match.

| Future Phase-0 Human observation | Result |
|---|---|
| Exact displayed model, Android release/API/build and **200 %** font scale match the authorization | `NOT RUN` |
| Exactly one installed and active authorized Google-or-Samsung TalkBack package/version | `NOT RUN` |
| Role A: ten separate successful stable presentations using only physical Tag A | `NOT RUN` |
| Role B: ten separate successful stable presentations using only physical Tag B, after A | `NOT RUN` |
| Role X: ten separate successful stable presentations using only physical Tag X, after B | `NOT RUN` |
| Three pairwise-distinct disclosure-safe 12-uppercase-hex fingerprints | `NOT RUN` |
| Every role displays `NfcA+MifareUltralight` under the unchanged required-subset boundary | `NOT RUN` |
| Final title `Alle drei Rollen stabil gebunden` | `NOT RUN` |
| Final text `A, B und X sind stabil, eindeutig und voneinander verschieden.` | `NOT RUN` |
| Explicit trusted Human `PASS`, then unique operator receipt `human_pass:match` | `NOT RUN` |
| Cleanup after Human-passed state | `NOT RUN` |
| Terminal `complete:match` with no later `failed:mismatch` | `NOT RUN` |

Cancel, timeout, any safe failure stage/text, ambiguity, wrong Tag/role/order, reset desire or any
early, duplicate, late or foreign command consumes a future authority and requires immediate
`abort`/cleanup without reset, retry, resume or evidence reuse. `complete:match` would prove only
the combined Human-PASS handshake plus operator/cleanup success, never APK approval or Product
Human V5.

### 2.5 Historical closed findings and confirmed TECH-01 correction — Human Phase 0 still gated

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
`effc57a` APK/manifest is now historical/DO NOT INSTALL.

`DA5-V5-VAL-TECH-01` is confirmed as an over-strict closed-list repository check. Source
`03694f2d877bc323791e93473ad01ceb82af70df`, tree
`6c6039683e067ef29f1f917a60c2628d26e38784`, exact-head CI `30386552118`, attempt 1,
12/12, and prepublication review round 2 are `APPROVED` with zero open P0–P3. `NfcA` and
`MifareUltralight` remain mandatory as a required subset of any Android-reported Technology
array, while every additional or duplicated entry is ignored without disclosure or storage.
Contract, output label, UID/digest semantics, timeout, Controller and filter remain unchanged.
The exact replacement APK/manifest passed the official verifier and independent Source/Artifact
Exact-SHA review with zero open P0–P3, but remains **DO NOT INSTALL**. The run-7
`technology_evidence` stage does not disclose the physical list and proves no fingerprint, Tag
result or hardware defect. Any future Phase-0 use requires a fresh separate exact Human
authorization binding this independently approved replacement source/artifact.

### 2.6 Product Human-V5 preflight

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
