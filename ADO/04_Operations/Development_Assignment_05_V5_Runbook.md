# Development Assignment 5 — V5 Human Android Gate Runbook

- Status: **PHASE-0 RUN 7 CONSUMED AT SAFE `technology_evidence`; RUN 8 INSTALLED THE EXACT `03694f2` ARTIFACT BUT STOPPED BEFORE `.MainActivity` LAUNCH BECAUSE AN AD-HOC HOST REGEX REJECTED A LEGITIMATE ANDROID-15 `~` PATH; RUN 8 CLEANED PACKAGE/PROCESS/GLOBAL REVERSE TO ZERO — NO FINGERPRINT/TAG RESULT OR HARDWARE DEFECT PROVEN — EIGHT PHASE-0 AUTHORITIES CONSUMED — FORMAL OPERATOR REVIEW R1 `CHANGES REQUIRED`, EXACTLY TWO P1; LOCAL R1 CORRECTION PENDING INDEPENDENT RE-REVIEW/CI — NO CURRENT PHASE-0 OR HUMAN-V5 AUTHORITY/DO NOT START**
- Date: 2026-07-28
- Owner: Technical Lead
- Approval authority for any run: Human Architect

## 0. Current non-executable bindings and phase separation

The Runtime Guard is bound to source `ba1b6e922ceb7902ecedd9dc2df01d6b22d90867`,
tree `980b6c57fdd71c12820f2890b640946db0d883c6`, CI `30255104609`, attempt 2,
12/12, and independently approved immutable binary/manifest. Historical query-visibility correction
`5c239b1c30c6263a036077460e23373b767f66df`, tree
`53e8d4ed012ccc662f1005f895a3b6e685cf560e`, passed exact-head CI `30276804017`,
attempt 1, 12/12. Independent Exact-SHA re-review of review base
`11a8269de145ad33c230f55a064bd18f9bb59731`, tree
`2292010e43d2620fbdbba6eeb6a9d77c36674144`, and CI `30277641127`, attempt 1,
12/12, returned `APPROVED` with zero open P0–P3; P1 and P3 are closed. Stopped intermediate
`0f7e131` produced no published artifact.

The exact Validation Runtime correction/review sequence is archived in
`ADO/05_Evidence/Development_Assignment_05_V5_Validation_Runtime_Correction_Independent_Exact_SHA_Review.md`.
Historical correction `7e8c0f7742e6407b8917205fd337a552f7dec714`, tree
`3e4d1356b859fecf70d365fecbb563e2088100f3`, passed CI `30284566289`, attempt 1,
12/12; independent re-review returned `APPROVED` with zero open P0–P3. Its exact executable Metro
bundle/source closure, ExpoAsset absence, Validation package, local synthetic signer, exact
required native modules and zero forbidden modules or extra permissions are bound. The final
APK/manifest passed the official verifier and independent Artifact Exact-SHA review with zero
open P0–P3 for that exact historical source. The DA5-V5-VAL-UI-01 Controller/UI source correction
historically superseded it: the listed APK/manifest is **HISTORICAL — DO NOT INSTALL**.

**Phase 0 — Validation Binding Preflight** has no current authority. Eight prior one-time
authorizations are consumed without an attributable Tag result: run 1 stopped on a preinstalled
Validation package; run 2 on the unsupported Samsung provider in the then-prior build; run 3
because the generic launcher/package resolver did not uniquely start the explicit Activity and
cleaned; run 4
after explicit `.MainActivity` reached cold start but failed on missing ExpoAsset, opening
`DA5-V5-VAL-RUNTIME-01`. Run 5, on repository baseline
`55070aa9a74c2606668caba9dc113ae8d689bd8d`, installed and verified the then-current exact
`7e8c0f7` Validation APK, passed the Human-confirmed device checkpoint and then reached only the generic fail-closed
scan path without a distinguishable cause. No successful or attributable Tag result is Evidence,
and no hardware defect is proven. Cleanup again confirmed package, process and reverse mappings
at zero. Run 6 used ADO baseline `96daac0b3cf1cfe98249a8c94fe927f34ee33af1`, tree
`4e7ccd41a4fda0608a7e9deab7fbc258e1cf94bf`, installed and verified the then-current
`e97bbe9` artifact and passed the Human-confirmed device checkpoint. At the first required A-scan
it showed only `Prüfung sicher gestoppt` /
`Der Scan konnte nicht als gültiger lokaler Nachweis bestätigt werden`. No cause or Tag result is
attributable and no hardware defect is proven. Cleanup again confirmed package, process and
reverse mappings at zero. Run 7 used ADO baseline
`aebffbec7c72c028ace6365ecdcc413e314526dd`, tree
`9e0104229756fe223753916ace8247ee2626f4d5`, and exact `effc57a` source/artifact. It stopped at
the first required A-scan with the fixed safe failure stage `technology_evidence`. The authority
is consumed; no fingerprint or Tag result exists. Concrete physical `techTypes` were
intentionally not exposed and remain unknown, no hardware defect is proven, and cleanup again
confirmed package, process and reverse mappings at zero.

Run 8 used ADO/code baseline `39a6ef09fad18375af025bc8ed12cc1ea6dda964`, tree
`10cdf16421fe564e1961a39d79e20775c0269fc4`, and the exact `03694f2` artifact. Installation
succeeded, but an ad-hoc host pathname regex rejected the legitimate Android-15 installed path
solely because it contained `~`. `.MainActivity` was not started, the Validation process was
absent, and no checkpoint, scan, fingerprint or Tag result was reached. Its authority is consumed;
uninstall succeeded and final package, process and global reverse state were zero. This is an
operator-boundary failure, not a Product, NFC or hardware result.

### 0.1 Tracked Validation Phase-0 operator candidate — non-executable

The focused correction consists of
`apps/mobile/scripts/da5V5ValidationPhase0OperatorCore.mjs`, its `.d.mts`, the thin direct CLI
`apps/mobile/scripts/da5V5ValidationPhase0Operator.mjs` and
`apps/mobile/tests/runtime/da5V5ValidationPhase0Operator.test.ts`, plus the minimal shared
Android ADB-runner `.mjs`/`.d.mts` deadline correction and its already focused runner test. It has
no package script. It
fixes the exact `03694f2` APK/manifest/source closure, requires one exact USB device plus
Human-bound model/build inputs and exactly one non-headless running Owner User 0, requires complete
user-0 package null, accepts bounded legitimate Android installed paths, streams only a stable
verified host snapshot to `cmd package install -R --user 0`, proves installed bytes, version and
identity before latching ownership, launches only
`com.tim180201.mobile.validation/.MainActivity` as user 0, and owns fail-closed conditional user-0
cleanup without creating or removing reverse mappings. It re-attests the ownership token before
force-stop and again before version-conditional uninstall; absent, ambiguous or changed
provenance is preserved and returns mismatch.

The direct future invocation shape is:

```sh
TAPTIME_DA5_V5_VALIDATION_PHASE0_PROFILE=da5-v5-validation-phase0 \
TAPTIME_DA5_V5_VALIDATION_DEVICE_MODEL='<future exact Human-authorized model>' \
TAPTIME_DA5_V5_VALIDATION_ANDROID_BUILD='<future exact Human-authorized build fingerprint>' \
node apps/mobile/scripts/da5V5ValidationPhase0Operator.mjs
```

This is a protocol description, not execution authority. After automatic preflight, an authorized
operator enters exact `install-launch`, completes any separately authorized Human UI work outside
the operator, then enters exact `cleanup`; `abort` is the only optional early stop. Wrong,
duplicate or out-of-order input, EOF, signal or failure goes fail-closed through cleanup. The
first finish/abort request starts one absolute deadline shared by active-operation settlement and
cleanup; every cleanup wait and ADB call is capped to its remaining budget, expiry cannot match,
and the shared text/binary ADB runner force-settles after SIGKILL grace even without child close.
The final post-R1-correction safe-root V3 passed 20/20 builds, 21/21 tests-inclusive typechecks,
21/21 workspace suites covering 148 test files and 2,484 passed tests with exactly two documented
optional B1 skips, migrations 001–013 apply/replay/ledger, C3B binary verification, 52/52 Mobile
test-source inclusion, the unchanged official Validation artifact verifier and Android export of
861 modules. One initial Synthetic invocation exposed only the sparse-runner omission of tracked
`.github/workflows/ci.yml`; materializing that tracked directory and executing only the affected
adapter file passed 31/31, completing the unique Synthetic matrix at 288/288 without changing
candidate bytes.
Formal review R1 is `CHANGES REQUIRED` with exactly the two corrected P1 findings above. The local
candidate is **PENDING independent re-review/CI — DO NOT START** and grants no Phase-0,
installation, ADB, hardware or Product Human-V5 authority.

`DA5-V5-VAL-UI-01` tracks the repository-visible accessibility/UI reliability gap:
identical repeated TalkBack activations require a separate one-shot/coalescing boundary while
true concurrent, out-of-order and foreign Controller calls remain strict fail-closed. Its focused
correction source `e97bbe9e2a281099899e2ecb3aad2588ef20f22d`, tree
`2958f456875e8dab3f10834df280e10a8438efce`, passed exact-head CI `30370977809`,
attempt 1, 12/12. Round-2 and Round-3 source reviews plus the formal independent Source/Artifact
Exact-SHA review returned `APPROVED` with zero open P0–P3. The exact replacement APK/manifest
passed the official verifier and that independent review. Because the following native-capture
diagnostics correction changes the Validation source, the `e97bbe9` APK/manifest is now
**HISTORICAL — DO NOT INSTALL**.

The now-historical diagnostics correction source is
`effc57a6780ff86784de0519a34abd6c5b7b8cd6`, tree
`758dbfaa04d0968fb25122352055fbcb80f8f022`, with exactly seven authorized changed files.
It adds six closed, typed, fixed-allowlist and disclosure-safe stages for Technology evidence,
UID readability, listener/registration, digest, concurrency and cleanup. It emits no raw UID,
payload, Technology list, provider diagnostic, exception text or Logcat; NFC acceptance,
timeouts and Controller fail-closed behavior are unchanged. V3 passed 20/20 builds, 21/21
tests-inclusive typechecks and 21 workspace suites / 147 test files / 2,373 tests, with exactly
two documented optional B1 skips. Migrations 001–013 apply/replay/ledger, C3B CLI and Android
export passed. The initial Synthetic stop was solely a Technical-Lead runner database-name
configuration; the previously unexecuted unchanged suite passed 288/288 on a fresh exact
database. No ports or temporary residue remained. Exact-head CI `30377569479`, attempt 1, passed
12/12. Independent source review and final prepublication review returned `APPROVED` with zero
open P0–P3. The exact replacement APK/manifest below passed independent Artifact Exact-SHA review
with zero open P0–P3.

These reviews close only their exact historical repository/source/artifact correction. Run 7 and
repository inspection confirm `DA5-V5-VAL-TECH-01`: the `effc57a` helper imposed a closed
Technology allowlist, maximum length and duplicate rejection. Focused correction source
`03694f2d877bc323791e93473ad01ceb82af70df`, tree
`6c6039683e067ef29f1f917a60c2628d26e38784`, passed exact-head CI `30386552118`,
attempt 1, 12/12; prepublication review round 2 returned `APPROVED` with zero open P0–P3.
Both fully qualified `android.nfc.tech.NfcA` and
`android.nfc.tech.MifareUltralight` remain required, while additional or duplicated entries are
ignored without returning or persisting them. Contract, output label, UID/digest handling,
timeout, Controller and filter remain unchanged. The exact replacement APK/manifest below passed
the official verifier and independent Source/Artifact Exact-SHA review with zero open P0–P3. It
remains **DO NOT INSTALL** because no separate Phase-0, installation, ADB or hardware authority
exists.

The safe stage does not reveal the concrete physical `techTypes` and proves no fingerprint, Tag
result or hardware defect. A future fresh one-time authorization must bind this independently
approved exact replacement artifact, the Galaxy A33 plus still-unbound OS/build/accessibility
values and three still-unbound safe Tag fingerprints to A/B/X. No APK listed below may be
installed under current authority; all entries are non-executable audit bindings. Future scans
remain read-only and must perform no auth, network, database, Product action or timekeeping.
Complete uninstall and scoped cleanup are mandatory.

| Phase 0 artifact | Exact binding |
|---|---|
| Runtime Guard binary | `/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-runtime-guard/ba1b6e922ceb7902ecedd9dc2df01d6b22d90867/da5_v5_runtime_guard`; 74,336 bytes; mode `0555`; SHA-256 `4b2a7e6b15d3348dffda94f9125c20a4db82bb8eb08a03aabd35932ad0d5853c` |
| Runtime Guard manifest/review | Same directory, `guard-manifest.txt`; 19,971 bytes; mode `0444`; SHA-256 `957d6e99c271663763945026995e7463cf2f20b385eb942fd16a152d3de5f709`; focused evidence SHA-256 `440928371f7acc48272eff2e819c37a851d66cae4a908ffa330228982328d708`; independent Exact-SHA `APPROVED`, zero open P0–P3 |
| Historical `effc57a` Validation source/review/CI — DO NOT INSTALL | `effc57a6780ff86784de0519a34abd6c5b7b8cd6`; tree `758dbfaa04d0968fb25122352055fbcb80f8f022`; exactly seven authorized changed files; exact-head CI `30377569479`, attempt 1, 12/12; independent source review and final prepublication review `APPROVED`, zero open P0–P3 |
| Historical `effc57a` Validation V3 | 20/20 builds; 21/21 tests-inclusive typechecks; 21 workspace suites / 147 test files / 2,373 tests; exactly two documented optional B1 skips; migrations 001–013 apply/replay/ledger, C3B CLI and Android export passed. Initial Synthetic stop solely from Technical-Lead runner database-name configuration; previously unexecuted unchanged suite passed 288/288 on a fresh exact database; no port or temporary residue |
| Historical `effc57a` Validation APK — DO NOT INSTALL | `/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-validation/da5-v5-validation-effc57a6780f-e423073e51f72a68/app-release-e423073e51f72a68.apk`; 65,631,681 bytes; mode `0444`; SHA-256 `e423073e51f72a68421c8e4afd17a9b86c397ca83628deaf4b174543d817330f`; Artifact Exact-SHA review `APPROVED`, zero open P0–P3 |
| Historical `effc57a` Validation manifest — DO NOT INSTALL | Same directory, `manifest-effc57a6780f.json`; 6,700 bytes; mode `0444`; SHA-256 `9d1238e821d92b26ed9bc9b9ee8ccd48607280ff0d0e752ec6965827c68ccc22`; Artifact Exact-SHA review `APPROVED`, zero open P0–P3 |
| Historical `effc57a` Validation package/security boundary | `com.tim180201.mobile.validation`; versionCode `1`; versionName `1.0.0`; signing scope `local-validation-only`; one v2 signer with certificate SHA-256 `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`; NFC-only; no network permission; cleartext denied; backup disabled; no Product deep links or Tag dispatch |
| Historical `effc57a` Validation native/source closure | Metro source closure 555 entries / 2,675,576 bytes / SHA-256 `e9fee0629af81357e4563836f9f5ef2b404c1ef97bc135d1cb3ed410f713b593`; executable 2,040,604 bytes / SHA-256 `c24457514436a63878107e1593dc90c6de17ad2424a6b625a6f18a14f66b8cfe`; unchanged native source 123 directories / 587 entries / 464 files / 1,176,224 bytes / SHA-256 `9194be29b96a67c47aa40a4bdea7494155695e088d769e21c77eff305b1ee259` |
| Historical `effc57a` Artifact Exact-SHA review | `APPROVED`, zero open P0–P3; all 32 manifest source-closure files byte-exact; package/signature/version, NFC-only permission, backup/transfer disabled, cleartext/network blocked and no Product dispatch/deep link; DEX 4 required present / 14 forbidden absent; Hermes Validation markers present and Product/network/database/storage markers absent |
| `DA5-V5-VAL-TECH-01` source/review/CI | `03694f2d877bc323791e93473ad01ceb82af70df`; tree `6c6039683e067ef29f1f917a60c2628d26e38784`; exact-head CI `30386552118`, attempt 1, 12/12; prepublication review round 2 `APPROVED`, zero open P0–P3 |
| `DA5-V5-VAL-TECH-01` candidate APK — DO NOT INSTALL | `/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-validation/da5-v5-validation-03694f2d877b-d2084486b07f27bd/app-release-d2084486b07f27bd.apk`; 65,631,433 bytes; mode `0444`; SHA-256 `d2084486b07f27bdbd72f9f32e38531f8de31dad18ef4789cab2ec44135e05f5`; official verifier `PASS`; independent Source/Artifact Exact-SHA review `APPROVED`, zero open P0–P3 |
| `DA5-V5-VAL-TECH-01` candidate manifest — DO NOT INSTALL | Same directory, `manifest-03694f2d877b.json`; 6,700 bytes; mode `0444`; SHA-256 `aa2a243cd4f81ead806c43e27d6f9c12c28e396db64fe556d8ddf02a8d52f347`; all 32 source-closure entries matched; independent Source/Artifact Exact-SHA review `APPROVED`, zero open P0–P3 |
| `DA5-V5-VAL-TECH-01` package/security boundary | `com.tim180201.mobile.validation`; versionCode `1`; versionName `1.0.0`; `local-validation-only`; one v2 signer with certificate SHA-256 `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`; NFC-only; no network permission; cleartext denied; backup/transfer denied; no Product deep links or Tag dispatch; required native modules present, forbidden modules absent; Validation marker present and Product runtime marker absent |
| Historical `e97bbe9` Validation source/review/CI — DO NOT INSTALL | `e97bbe9e2a281099899e2ecb3aad2588ef20f22d`; tree `2958f456875e8dab3f10834df280e10a8438efce`; exact-head CI `30370977809`, attempt 1, 12/12; Round-2/Round-3 source reviews and formal Source/Artifact Exact-SHA review `APPROVED`, zero open P0–P3 |
| Historical `e97bbe9` Validation APK/manifest — DO NOT INSTALL | Directory `/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-validation/da5-v5-validation-e97bbe9e2a28-810b856ff7113b4f`; APK `app-release-810b856ff7113b4f.apk`, 65,629,505 bytes, mode `0444`, SHA-256 `810b856ff7113b4f2a454007595e1b6c1ae5dc69c601a2120b577f124e213e28`; manifest `manifest-e97bbe9e2a28.json`, 6,700 bytes, mode `0444`, SHA-256 `af53d646558449a7a5c907fbdf59e3366c6ffd2755f6049141db8e567549e051` |
| Historical Validation APK — DO NOT INSTALL | `/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-validation/da5-v5-validation-7e8c0f7742e6-303bfd33cf7fa000/app-release-303bfd33cf7fa000.apk`; 65,626,753 bytes; mode `0444`; SHA-256 `303bfd33cf7fa000ee808a048f91883c18dbfe85c1ba359d3f0764ac7ae7f2f8` |
| Historical Validation manifest — DO NOT INSTALL | Same directory, `manifest-7e8c0f7742e6.json`; 6,700 bytes; mode `0444`; SHA-256 `11c1664cee37caa8b093a9023f571e3b8733e8bb078bf7f78b6f20d8f39388a7` |
| Package/runtime | `com.tim180201.mobile.validation`; signer `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`; `local-validation-only`; `NfcA+MifareUltralight`; exact roles A/B/X; exactly one active installed provider from `com.google.android.marvin.talkback` or `com.samsung.android.accessibility.talkback`; none or both fail closed; exactly one queries block with those two package queries, one exact `VIEW` + `BROWSABLE` + `https` intent and zero providers; no Product deep link or Tag dispatch |
| Historical native/source verification — DO NOT INSTALL | Correction `7e8c0f7742e6407b8917205fd337a552f7dec714`, tree `3e4d1356b859fecf70d365fecbb563e2088100f3`; exact-head CI `30284566289`, attempt 1, 12/12; exact 2,032,807-byte executable Metro bundle SHA-256 `e4caf2db73cfbcdaf779f337bf3a3f99e95d182950522323052bc31ae10c93d3`; exact 555-source/2,667,064-source-byte closure SHA-256 `29691fc137c63906e5cf0c5cd47e2df0643064ab6dbddc00e0d3ec467d492ed3`; independent correction re-review and Artifact Exact-SHA review each `APPROVED`, zero open P0–P3; official artifact verifier `PASS`; superseded for installation by DA5-V5-VAL-UI-01 source correction |
| Device, accessibility and A/B/X fingerprints | `UNBOUND — DO NOT START` |
| One-time Phase 0 authorization/result | `RUN 1 CONSUMED — PREINSTALLED PACKAGE`; `RUN 2 CONSUMED — SAMSUNG PROVIDER UNSUPPORTED BY PRIOR BUILD`; `RUN 3 CONSUMED — GENERIC RESOLVER DID NOT UNIQUELY START EXPLICIT ACTIVITY`; `RUN 4 CONSUMED — EXPLICIT MAINACTIVITY COLD START FAILED MISSING EXPOASSET`; `RUN 5 CONSUMED — EXACT APK/DEVICE CHECKPOINT PASSED, THEN GENERIC FAIL-CLOSED SCAN PATH`; `RUN 6 CONSUMED — EXACT e97bbe9 APK/DEVICE CHECKPOINT PASSED, THEN FIRST A-SCAN SHOWED ONLY GENERIC FAIL-CLOSED STATE`; `RUN 7 CONSUMED — EXACT effc57a APK/DEVICE CHECKPOINT PASSED, THEN FIRST A-SCAN STOPPED AT SAFE technology_evidence`; `RUN 8 CONSUMED — EXACT 03694f2 APK INSTALLED, THEN LEGITIMATE ANDROID-15 ~ PATH REJECTED BEFORE MAINACTIVITY LAUNCH`; runs 5–8 have no attributable Tag result and prove no hardware defect; run-7 physical `techTypes` remain unknown; final cleanup package/process/global reverse zero; no current authority |

**Later Product Human V5** remains the separate run described below. None of the eight consumed
Phase-0 attempts supplies a Product/Human-V5 result. No further installation, ADB or hardware action is authorized
until a fresh exact Human authorization; production, production data, system changes, deployment
and distribution remain unauthorized.

## 1. Purpose and authority boundary

This runbook defines one fresh Human Android observation for ADR-0016 DA5-P12 and ADR-0017
DA5-T15. It minimizes repetition through staged gates, but every listed boundary remains
mandatory.

The carried software closure is current Source+Lock baseline
`a323834f51607841d0cd5f11aafdbfd3dd93ed5f`, tree
`65c669b0a941c21d23ffca5e79fa03285323a7cf`, exact-head CI `30149165373`,
attempt 1, 12/12. Independent implementation review round 2 returned `APPROVED` with zero open
P0–P3. Exact Evidence commit `e6a06e2ec8f580d6314bfe5a51378f949d524b16`, tree
`6dcdce405feb2eccb1462c373ab6be891152715c`, passed exact-head CI `30150095109`,
attempt 1, 12/12; final independent Artifact/Evidence Exact-SHA review returned `APPROVED` with
zero open P0–P3.

Those facts close the DA5 V0–V4 software scope only. **This document does not authorize V5,
installation, ADB, device or Tag interaction.** One future fresh run requires a separate exact
Human-Architect authorization despite the completed artifact/evidence review and CI. The
authorization must quote every binding in Section 3.

A failed, interrupted or ambiguous preflight, action, observation or checkpoint consumes that
one-run authority. Stop, mark the entire run failed and clean up. No retry, repair, resume,
replacement action or evidence reuse is allowed.

## 2. Fixed safety and disclosure boundary

- Use only fresh synthetic accounts and synthetic data on the exact local environment named by
  the future authorization.
- Use only the separately named, screen-unlocked Samsung/reference Android device and separately
  named approved Tags. An unnamed device or Tag must not be connected, presented or observed.
- Keep every endpoint local and exactly bound. LAN, tunnel, cloud and production resources are
  prohibited.
- Record only exact source/artifact bindings, public synthetic labels, safe UI states, Human
  pass/fail checkpoints and disclosure-safe aggregate results.
- Never record credentials, password digests, tokens, invitation/enrollment secrets, raw NFC UID
  or payload, provider subjects, device serials, encryption keys, internal identifiers or personal
  data. A screenshot is optional and prohibited while any such value is visible.
- Do not build, modify, sign, deploy or distribute an artifact during the run.
- Do not access `research/`. Repository checks must use an explicit protected-path exclusion and
  must also exclude the repository-root `app.json`.
- Production, production data, signing, deployment, distribution, pilot operation and
  legal/privacy approval remain unauthorized.

## 3. Mandatory exact binding — fill and verify before start

Every still-`UNBOUND` field below must be filled by the future authorization and independently
verified before any installation, device/Tag interaction or Gate A action. This runbook requires
no self-SHA.

| Binding | Required exact value |
|---|---|
| One-run Human authorization and date | `UNBOUND — DO NOT START` |
| Product commit/tree and required V4 | `a323834f51607841d0cd5f11aafdbfd3dd93ed5f` / `65c669b0a941c21d23ffca5e79fa03285323a7cf`; CI `30149165373`, attempt 1, 12/12 |
| Product implementation-review binding/verdict | Round 2 `APPROVED`; zero open P0–P3 |
| Runbook/evidence commit/tree and independent-review verdict | `e6a06e2ec8f580d6314bfe5a51378f949d524b16` / `6dcdce405feb2eccb1462c373ab6be891152715c`; CI `30150095109`, attempt 1, 12/12; final independent Artifact/Evidence Exact-SHA review `APPROVED`, zero open P0–P3 |
| Read-only APK path, byte size, SHA-256 and exact mode | `/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5/a323834/app-release-385c0c46f22dcac5.apk`; 95,522,787 bytes; `385c0c46f22dcac5b935bfdc6f574558f4e74748ed4a367ef399ddbd4299c547`; `0444` |
| Read-only artifact manifest path, byte size, SHA-256 and exact mode | `/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5/a323834/artifact-manifest.txt`; 1,647 bytes; `1c1f1b7a5b92fab5510cde35a439fc6f0742b7bf2666d6319cd89b9a7d4dcadb`; `0444` |
| Package, version, signature scheme, signer digest and packaged manifest/runtime values | `com.tim180201.mobile.synthetic`; versionCode `1`; versionName `1.0.0`; v2 `true`, v1/v3/v3.1/v4 `false`; one local synthetic non-production signer certificate SHA-256 `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`; packaged boundary/runtime `match` per adjacent manifest |
| Device model, OS/build and approved screen-unlocked mode | `UNBOUND — DO NOT START` |
| Approved assigned, unassigned and unrelated Tag labels/safe fingerprints | `UNBOUND — DO NOT START` |
| Exact synthetic services, status boundary and controlled-offline switch | `UNBOUND — DO NOT START` |
| Admin Setup Preview 2 entry, preview/validation result and safe exit procedure | `UNBOUND — DO NOT START` |
| DA5-T06 exact five-second dedupe boundary and lifecycle-cancellation checkpoint | `UNBOUND — DO NOT START` |
| Separately reviewed Protected/Review induction fixture, synthetic labels, exact start state, cutover procedure, expected state sequence and scoped teardown | `UNBOUND — DO NOT START` |
| Exact large-text setting and active allowlisted TalkBack package/version | `UNBOUND — DO NOT START` |

The populated product and artifact/evidence rows are independently approved. They are not a
Human-run authorization. Every remaining operational binding and a separate exact Human
authorization are still mandatory.

At preflight, recompute both read-only file sizes, SHA-256 digests and modes from the preserved APK
and manifest. Independently verify package/version, signature/signer and packaged
manifest/runtime values from the APK. Require exact equality with the authorization. Any changed
source, review, CI, file, mode, dependency, configuration, device, OS, Tag or synthetic
environment invalidates the binding and consumes the run authority.

The Protected/Review fixture must bind one exact DA5-compatible historical cutover procedure. Its
reviewed expected sequence is:

```text
clean FIFO and no review marker
-> active_entry_for_other_target_rejected
-> review_pending/historical_configuration_not_valid
-> review_pending/predecessor_requires_review
-> FIFO drained and protected/review-required UI
-> protected/review-required UI retained after one cold relaunch
```

The fixture uses only named synthetic Customer assignments and approved Tags, never device-clock
tampering. If its exact source/procedure, starting aggregate, cutover action, expected safe
aggregate or fixture-scoped teardown is absent or differs, do not start.

## 4. Preflight and short Human checkpoints

Before Gate A:

1. Verify the exact repository heads and a clean tracked worktree with both protected exclusions.
2. Verify the Section 3 bindings without rebuilding or changing the read-only files.
3. Require only the authorized USB device, no unexpected mapping/listener, no retained package
   state and fresh synthetic database/accounts/data.
4. Install only the exact bound APK through the separately reviewed scoped procedure. Enable NFC
   and keep the device screen unlocked.
5. Require the authorized disclosure-safe status boundary to report fresh zero DA5 setup,
   lifecycle, queue, sync and protected-state evidence before the first action.

After each staged gate, the operator states only the expected and observed safe result. The Human
answers `PASS`, `FAIL` or `AMBIGUOUS`. Only `PASS` permits the next gate. Short acknowledgement
never replaces a listed observation.

Immediately after the Human confirms each first action that will later have an intended opposite
Start/Stop for the same User/WorkTarget, the operator captures the exact named
`dedupe-window-baseline`. The harness queries a fresh PostgreSQL server clock only after that
action, keeps the allow-listed phase/target baseline only in process memory and records only
`dedupe_window_baseline=match`. It must not derive this baseline from WorkEvent persistence; this
conservatively covers an action still held only in the encrypted offline FIFO.

Before the matching opposite action, the operator consumes that exact single-use baseline through
`dedupe-window-check` and must prove that strictly more than the five-second DA5-T06 window has
elapsed. Record only `dedupe_window_elapsed=match`; do not record wall-clock or monotonic
timestamps. A missing, wrong-phase, wrong-target, reused, equal-to-five-seconds or ambiguous
baseline fails before the action. No elapsed check is required before a first action.

## 5. Staged Human gate

### Gate A — Authentication, enrollment and setup exclusion

1. Exercise the authorized fresh synthetic authentication/enrollment path. Verify signed-out,
   Employee and Administrator navigation disclose only role-appropriate screens and actions.
2. In Administrator setup, present only the approved assigned Tag and complete its authorized
   synthetic Customer assignment. Require setup UI success and setup aggregates, with zero
   lifecycle action. Require that first assignment capture to finish and release capture
   ownership.
3. Start the separately bound second operation named **Admin Setup Preview 2**. Within only that
   new setup capture/preview, present the already assigned Tag. Require setup-side
   preview/validation only, with zero lifecycle WorkEvent/Decision/Receipt/Audit, zero queue item
   and no navigation into lifecycle handling.
4. Safely cancel/leave Admin Setup Preview 2 through its bound exit. After returning to the normal
   shell and again after refresh/relaunch, require zero replay and unchanged lifecycle/queue
   aggregates. Verify Administrator setup state remains visible and correct.
5. Sign out and present the assigned Tag. Require signed-out rejection with zero lifecycle or
   queue mutation.
6. After Employee authentication, present the separately approved unassigned Tag and unrelated
   Tag. Require safe rejection and zero lifecycle or queue mutation for each.

Checkpoint: auth/enrollment, role boundary, completed first assignment capture, separately started
and safely exited Admin Setup Preview 2, zero setup-to-lifecycle replay, setup preservation and all
three rejection paths are unambiguous.

### Gate B — Cold launch, background resume and same-Tag dedupe

1. From a cold, non-running app with unlocked screen and authenticated synthetic Employee
   authority, present the approved assigned Customer Tag. Require one cold launch and exactly one
   NFC lifecycle result.
2. Present that same Tag again within the exact bound dedupe interval. Require no second lifecycle
   mutation, but exactly one additional persisted WorkEvent, Decision, Receipt and Audit with
   Decision `duplicate_scan_ignored`. Own-time and the current TimeEntry remain unchanged.
   After the Human confirms that duplicate result, capture the named Gate-B Customer baseline.
3. Before the intended opposite lifecycle result, consume that same baseline and require
   `dedupe_window_elapsed=match`. Then put the app in the background and present the same Tag.
   Require one background/resume dispatch and exactly one next lifecycle result.
4. Verify active/history truth and immutable NFC provenance for both accepted results.

Checkpoint: cold launch, warm/background resume, consume-once ownership and same-Tag dedupe pass
with exact duplicate evidence and without a second TimeEntry mutation.

### Gate C — Online targets, mixed provenance and own-time truth

Use only valid server-decided toggles; never select Start or Stop manually.

1. Exercise the online Customer path with one NFC action and the matching manual Customer action
   so the resulting pair proves mixed NFC/manual provenance. After Human confirmation of the
   first action, capture the named Gate-C Customer baseline; consume it and require
   `dedupe_window_elapsed=match` before the intended opposite action.
2. Exercise one online manual Project Start/Stop pair. After Human confirmation of Start, capture
   the named Gate-C Project baseline; consume it and require
   `dedupe_window_elapsed=match` before Stop.
3. Exercise one online manual General Work Start/Stop pair. After Human confirmation of Start,
   capture the named Gate-C General Work baseline; consume it and require
   `dedupe_window_elapsed=match` before Stop.
4. After each pair, require the current active state, ordered own-time active/history projection,
   exact Customer/Project/General target label and immutable trigger provenance to agree.

NFC remains Customer-assignment-based; this gate does not invent NFC assignment to Project or
General Work.

Checkpoint: applicable NFC/manual Customer plus manual Project/General online coverage and
own-time truth are complete.

### Gate E — TalkBack, text scaling and layout

At the exact large-text setting, enable the bound TalkBack version and inspect the authentication,
setup, scan/manual-target, own-time, sync/pending and error/rejection surfaces already reached.
Require logical focus order, meaningful labels/roles, announced state changes, visible focus,
non-color-only meaning, readable controls and no clipped, overlapping, unreachable or
horizontally overflowing essential content. Do not repeat lifecycle writes for accessibility.

Checkpoint: accessibility and layout pass on the exact bound device/settings.

Gate E must pass before Gate D starts because Gate D ends at the mandatory protected-state stop.

### Gate D — Controlled offline, reviewed Protected/Review fixture and final stop

1. Activate only the exact authorized controlled-offline switch and prove loss of the bound
   server path without changing authentication, device or app state.
2. Exercise the applicable ordinary offline matrix once: assigned Customer NFC with matching
   manual Customer action, one manual Project pair and one manual General Work pair. Immediately
   after Human confirmation of each first pending action, capture its named Gate-D ordinary
   target baseline; consume that same baseline and require `dedupe_window_elapsed=match` before
   its intended opposite action. Require FIFO order, target/provenance truth and explicit pending
   UI; no server success may be claimed.
3. Restart the app once while ordinary evidence is pending. Require durable restoration,
   unchanged order and no false ready/cleared state. Restore only the authorized server path and
   require one ordered synchronization, no duplicate result and eventual own-time active/history
   agreement.
4. At the exact lifecycle-cancellation checkpoint bound in Section 3, begin only the named
   cancellable action and perform the named background/restart transition. Require the stale or
   cancelled result to produce zero later mutation or replay. Do not repeat the action.
5. Require the ordinary FIFO to be clean and no review marker to exist. Start only the separately
   reviewed Protected/Review fixture. Require Tag A to have no active TimeEntry; after
   that clean checkpoint, start approved Tag B online so its other target is active. This is Tag
   B's first action and has no preceding elapsed check. After Human confirmation of Start, capture
   the named Gate-D Tag-B/Customer-B baseline.
6. Enter the bound cold offline state and capture approved Tag A once before cutover. While the
   device remains offline, require its pending UI and capture the named Gate-D Tag-A baseline.
   Then execute only the fixture's reviewed synthetic reassignment of Tag A from its named
   Customer A to named Customer B. Do not alter device clocks.
7. Consume the Gate-D Tag-A baseline and require `dedupe_window_elapsed=match`, then capture stale
   Tag A once after cutover. Consume the independently retained Gate-D Tag-B/Customer-B baseline
   and require `dedupe_window_elapsed=match` before capturing Tag B as its intended successor
   action.
8. Restore only the approved path and allow automatic FIFO reconciliation without per-event retry.
   Require, in order:
   `active_entry_for_other_target_rejected`,
   `review_pending/historical_configuration_not_valid`, then
   `review_pending/predecessor_requires_review`. Require zero TimeEntry mutation for both
   review-pending outcomes, a drained FIFO and the protected/review-required UI.
9. Force-stop and cold relaunch exactly once as part of the fixture. Require the same protected/
   review-required state to persist.
10. Stop at `protected_review_fixture_checkpoint=match`. Do not repair, retry, adjudicate, clear,
    resume, continue to another gate or reuse any fixture state or observation. Proceed directly
    to Gate F cleanup.

Checkpoint: ordinary offline parity/restart/cancellation and the separately reviewed historical
cutover sequence are exact; `review_pending` and protected state persist at the final mandatory
stop.

### Gate F — Final truth and complete cleanup

1. Require the disclosure-safe final status to match only the staged actions, with no duplicate,
   foreign or unexplained setup/lifecycle/sync evidence.
2. Sign out every Mobile/Admin session and clear clipboard, downloads and temporary screenshots.
3. Stop synthetic services normally; remove only scoped mappings/listeners and the exact synthetic
   package. Never use blanket device cleanup.
4. Invoke only the Protected/Review fixture's separately reviewed scoped teardown. Do not
   adjudicate, repair, retry or clear fixture records through product actions.
5. Remove the task-owned synthetic database/schema/ledger and generated runtime roles through the
   reviewed scoped procedure.
6. Require zero authorized package, mapping, listener, fixture and disposable database/role
   residue.
7. Reverify the tracked repository against the authorized head using both protected exclusions
   and leave unrelated repository, device and PostgreSQL state untouched.

Cleanup is mandatory after pass, failure or abort. Cleanup success does not convert a failed or
ambiguous run into a pass.

## 6. Result authority

Record only in
`ADO/05_Evidence/Development_Assignment_05_V5_Evidence.md`. Only the Human Architect or an
explicitly delegated Human tester may mark a separately authorized fresh V5 `PASSED`. Automated
tests, V4, software review, this shell or a clean preflight do not pass V5 or authorize production,
signing, deployment or distribution.
