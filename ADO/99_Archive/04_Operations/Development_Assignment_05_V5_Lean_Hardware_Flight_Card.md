# Development Assignment 5 — Lean Stage-6 Hardware Flight Card

## Fast-flight card — implementation candidate / STOP

Governing authorization: `9032581b1cb13b4a44f575aaface8a87989f4932` / tree
`03c06109a622e666d693ad9f28785ad834f4e663`. The compiled Supervisor, plan digest, exact binding
set and external evidence parent must all match the independently reviewed/published Flight
Package before invocation. **No current invocation, ADB, install, Product or Hardware authority
exists.**

During a separately authorized run, respond only to the complete on-screen prompt contract with
`PASS`, `FAIL`, `AMBIGUOUS`, the requested integer queue count, or `ABORT`. Do only that action;
do not improvise, retry, resume, repair, reorder, expose a Credential or start another run.
Cleanup, child exit, fresh attestation and sealed receipt are mandatory before classification.
Only a receipt with every fast-lane predicate `MATCH` can support a later separately authorized
fresh run. Otherwise `STOP` and use normal publication/review routing. Historical correction-2
terminal truth and consumed authority below remain unchanged.

### Current verification / no flight authority (`2026-08-14`)

Candidate tree `b775c248bb268e91b141c62361b47614f38934a5` / full patch SHA-256
`155bb35851508e30bed6c3b2908c8b410845ddd6fabc3bd795016bd0ed744cc1` passed fresh V2
(Synthetic 384 passed / 19 expected DB skips; Mobile 120 passed; both tests-inclusive typechecks,
fresh build and bundle checks). V3-A is consumed `FAIL_CLOSED` after all gates through C3B passed:
the following no-install preflight lacked exact `TAPTIME_SYNTHETIC_E2E_PROFILE=da5-v5`. This is a
runner-configuration failure, not a code/Product finding. No ADB, install, Product or Hardware
action occurred; cleanup passed.

Independent ADO `APPROVED` review may authorize exactly one new V3-B on the resulting amendment
tree/patch. It must rerun full V3 from D01 and use absolute Node 24/npm CLI for the applicable npm
gates. The no-install gate binds exact candidate-checkout CWD
`/Users/timbartz/Dokumente/GitHub/taptime`, the unchanged minimal sanitized V3 environment and
directly invokes exactly once:
`/usr/bin/env TAPTIME_SYNTHETIC_E2E_PROFILE=da5-v5 /Users/timbartz/.nvm/versions/node/v24.17.0/bin/node apps/mobile/scripts/da5V5AndroidNoInstallPreflight.mjs`.
Gate evidence binds exact CWD/argv, environment-name proof, raw output and return code. The helper
is the direct child of D01-bound Node `24.17.0`; no package lifecycle or bare
`node`/`npm`/`npx` is allowed. V3-A is context only; failure consumes V3-B with no retry. Green
V3-B goes to independent review only. **No flight, ADB, install or Hardware authority is created.**

Status: **R0/V0 CORRECTION-2 CLOSURE CANDIDATE / LATER CURRENT STATE CLEAN / AUTHORITY CONSUMED / STOP**

Owner: Technical Lead

Physical approval authority: Human Architect

Marker: `DA5-V5-ABORT-BEFORE-PREVIEW2-CORRECTION2-2026-08-13`.

## Current terminal correction 2 — exact `/private/tmp`, later current state only

This correction supersedes correction 1's inaccurate child-TMP relationship, its overbroad
no-entry wording and every conflicting generic task-state, immediate-cleanup, queue or
clean-working-tree assertion. Terminal classification remains **`FAIL_CLOSED / HUMAN ORDER
DEVIATION BEFORE PREVIEW 2; LATER CURRENT STATE CLEAN`**, never Product PASS and no
Product-defect finding. `E` authority is consumed; do not retry, resume, relogin, replace or
continue.

Executable `M` `9380758f3e149718c8c0b8d34a1818de64c0d8d1`, exact
`apps/synthetic-android-e2e/src/da5V5Main.ts:232-237`, passes
`temporaryBase: '/private/tmp'`; Guard mkdtemp therefore creates `/private/tmp/.t5-*` directly,
not beneath an additional child TMP base. The immutable historical roots remain byte-exact:
original `0555`
`/Users/timbartz/Dokumente/GitHub/taptime-local-evidence/da5-v5/hardware-42b330a-abort-before-preview2-20260813`
contains `receipt.txt` 3,825 bytes / `0444` / SHA-256
`98e7278983dce827133cddcdfb3cb1617b6b072179ad39e93f6ea44ab3221f94` and manifest 1,827 bytes /
`0444` / SHA-256 `db24eb313181a64f488becf552c0fd9d70583e375a7f79d17c5ca357afae3813`;
correction-1 `0555`
`/Users/timbartz/Dokumente/GitHub/taptime-local-evidence/da5-v5/hardware-42b330a-abort-before-preview2-20260813-correction1`
contains `correction-receipt.txt` 3,155 bytes / `0444` / SHA-256
`fd94e071d611ff7c08b1220b85d8aad740e3f750cd6edffe2f687f4443dcee81` and manifest 1,831 bytes /
`0444` / SHA-256 `1a453bfa8474462a13fda346b76e78daa82f007154c8545fcc887e300c6d0da8`.
Neither root was changed. Correction 1's child-base description is not exact source truth, and
its no-entry wording is not bound by its sealed bytes because the type-filter-free recheck
occurred only after correction 1 was sealed, after Review.

New immutable correction-2 root
`/Users/timbartz/Dokumente/GitHub/taptime-local-evidence/da5-v5/hardware-42b330a-abort-before-preview2-20260813-correction2`
is `0555`, containing exactly `correction-receipt.txt` 3,549 bytes / `0444` / SHA-256
`da712709ab51016a822b6eb3a282a89f038f6ebaf64a533bcae008c9e1064b4a` and manifest 3,014 bytes /
`0444` / SHA-256 `6e3b86c39df0200e276a3b6993de199ad059642197e0d11de0ea2ddfe78f9c5d`.
It binds only the Technical-Lead-reported later read-only check after Review:
`current_cleanup_correction2=MATCH`; max-depth-one `/private/tmp/.t5-*` name check without type
filter found no entry; bound Guard and `/private/tmp/.t5-*/run-*/data` PostgreSQL processes were
zero; owned ports 3000/54321/55435 were zero; exact Product package/process/reverse mappings were
absent; Operator process was zero; standard profile matched at font scale 1, accessibility 0 and
services null. The staged index was clean while the working tree was intentionally dirty with the
exact eight-ADO-path candidate; no clean repository or working tree is claimed. This proves only
later current state, never immediate abort cleanup. Queue remains unobserved and unclaimed. This
card remains an AVS R0/V0 documentation-only STOP; no test, build, Typecheck, CI, ADB, Hardware,
commit or push is run or claimed.

## Preserved terminal correction 1 — immediate cleanup unverified

Marker: `DA5-V5-ABORT-BEFORE-PREVIEW2-CORRECTION1-2026-08-13`.

This preserved correction-1 block is superseded by correction 2 above. Its terminal
classification is
**`FAIL_CLOSED / HUMAN ORDER DEVIATION BEFORE PREVIEW 2; LATER CURRENT STATE CLEAN`**, never
Product PASS and no Product-defect finding. `E` authority is consumed; do not retry, resume,
relogin, replace or continue.

The original immutable `0555` Evidence root
`/Users/timbartz/Dokumente/GitHub/taptime-local-evidence/da5-v5/hardware-42b330a-abort-before-preview2-20260813`
remains historical flawed Evidence: receipt
3,825 bytes / `0444` / `98e7278983dce827133cddcdfb3cb1617b6b072179ad39e93f6ea44ab3221f94`;
manifest 1,827 bytes / `0444` /
`db24eb313181a64f488becf552c0fd9d70583e375a7f79d17c5ca357afae3813`. Its generic task-state
and queue claims are not independently bound and are superseded. The original task-root check
covered only repository-local `.t5-*`; correction 1 inaccurately described an exact bound child
TMP base, while correction 2 binds direct `/private/tmp/.t5-*`. `da5_v5_aborted` precedes
cleanup. Complete immediate post-abort cleanup cannot be reconstructed and remains unverified.

New immutable `0555` correction root
`/Users/timbartz/Dokumente/GitHub/taptime-local-evidence/da5-v5/hardware-42b330a-abort-before-preview2-20260813-correction1`
contains exactly correction receipt
3,155 bytes / `0444` / `fd94e071d611ff7c08b1220b85d8aad740e3f750cd6edffe2f687f4443dcee81`
and manifest 1,831 bytes / `0444` /
`1a453bfa8474462a13fda346b76e78daa82f007154c8545fcc887e300c6d0da8`. It proves only two
separately timed Technical-Lead-reported later current checks: package/process absent, owned
mappings empty, standard profile `MATCH`, Operator absent and a historical tracked/staged-clean
report; then `current_guard_cleanup=MATCH` and the listed Guard/PostgreSQL/owned-port checks.
Correction 2 supersedes correction 1's child-base and no-entry scope. It does not reconstruct
immediate cleanup. The schema has no queue field,
the queue checkpoint was not reached and no machine queue Evidence exists; queue state/event is
not observed or claimed.

## Preserved predecessor terminal override — abort before Admin Setup Preview 2

Marker: `DA5-V5-ABORT-BEFORE-PREVIEW2-CLOSURE-2026-08-13`.

Exact published ADO baseline is `E` `42b330a1ea700169d7adcd1c3bf54e3dfb868d0a` / tree
`21aad9fa3e0dd7de1d87c66fdaaba8ee0cdc6a92`, parent `C`
`33a1d70c06b0275c59be20bf9d5afc4c8af44767`. Fresh read-only preflight and the exact name-only
child-environment predicate matched. The continuous Operator reached `da5_v5_ready`,
`device-preflight=match`, Human Tag readiness PASS, verified installation, Administrator
Credential/login, initial all-zero digital state and the first Tag-A-to-Customer-A setup. Exact
reattestation then showed one active Tag-A/Customer-A assignment and one setup receipt, with no
lifecycle or NFC/manual/time record; it did not prove queue state.

**STOP.** Before the mandatory Admin Setup Preview 2 operation, the Human reported an accidental
sign-out. Relogin or continuation was not allowed. Ordinary-idle `abort` was accepted exactly
once, emitted `da5_v5_aborted` and exited 1. Correction 1 binds only later current state, not
immediate complete cleanup. Terminal state is **`FAIL_CLOSED / HUMAN ORDER DEVIATION BEFORE
PREVIEW 2; LATER CURRENT STATE CLEAN`**, not PASS and not a Product defect. `E` authority is
consumed; do not retry, resume, relogin, replace or continue.

Preview 2, Employee, Tags B/X, Gates B–F and Accessibility were not reached. Immutable Evidence
root is
`/Users/timbartz/Dokumente/GitHub/taptime-local-evidence/da5-v5/hardware-42b330a-abort-before-preview2-20260813`
mode `0555`: receipt 3,825 bytes / `0444` /
`98e7278983dce827133cddcdfb3cb1617b6b072179ad39e93f6ea44ab3221f94`; manifest 1,827 bytes /
`0444` / `db24eb313181a64f488becf552c0fd9d70583e375a7f79d17c5ca357afae3813`.
The accidental sign-out and other stated Human observations are Human-reported; they are not
inferred from machine receipts or later current-state checks. The original generic task-state and
queue claims are superseded. This card permits documentation correction only, not ADB,
installation, Operator restart, Hardware or any Product action.

## Preserved prior startup-environment closure

Marker: `DA5-V5-STARTUP-ENV-FAILURE-CLOSURE-2026-08-13`.

## Current STOP and next-start override

Published ADO baseline is `C` `33a1d70c06b0275c59be20bf9d5afc4c8af44767` / tree
`ce4c62cf64f8bfe6a1891813e6a9fadec3168af5`; executable `M`
`9380758f3e149718c8c0b8d34a1818de64c0d8d1`, final r4 runtime and Product APK SHA-256
`b02fdb2544225d03e3142fa30f12caa8fedf889a558b39cc040cca03f9539234` remain unchanged.
One exact authorized r4 invocation rejected wrapper `LANG` before PostgreSQL ownership and exited
1 after about 0.23 seconds with sole output `da5_v5_start_failed`, no `da5_v5_ready`, no retry
and immediate all-null/standard-profile-unchanged checks. Outcome:
**`FAIL_CLOSED AND CLEAN / STARTUP-ENV WRAPPER`**, not Product finding and no executable fix.

Immutable `0555` Evidence root:
`/Users/timbartz/Dokumente/GitHub/taptime-local-evidence/da5-v5/hardware-33a1d70-startup-env-failure-20260813`;
receipt 4,317 bytes / `0444` /
`bf5608695d6d3e495ecb09a6b2203da82335e9b982e12e3966383c29f32262c0`; manifest 1,446 bytes /
`0444` / `ed4b507d512f7f65a3bae0ad8bbdc46dba48c72df1f1cd389c13ebe536b85506`.
Sequence is Technical-Lead-reported, not raw transcript; exact start time is unproved.

**STOP.** Authority is consumed; no restart, resume, replacement, Phase B, ADB or install. Next:
independent exact-eight-doc review → focused `[skip ci]` publication at unknown `E` → independent
exact-head review → STOP → fresh one-time Human authorization. No CI/V3/runtime/APK rebuild.

Before any later Node invocation, record a disclosure-safe name-only environment `MATCH`: exact
`PATH` `/Users/timbartz/Library/Android/sdk/platform-tools:/usr/bin:/bin:/usr/sbin:/sbin`; only
required `HOME`/`USER`/`LOGNAME`/`SHELL`/`TMPDIR`, exact equal `ANDROID_HOME`/
`ANDROID_SDK_ROOT`, and the exact required Operator `TAPTIME_*` names listed in the Runbook.
`LANG`, `LANGUAGE`, all `LC_*`, `PG*`, `PQ*`, database URL/credential names, `ADB_*`,
`ANDROID_ADB_*`, `ANDROID_SERIAL` and every other unlisted name must be absent. Predicate failure
stops before Node; no values or secrets enter the receipt.

## Preserved prior pre-Hardware card

Marker: `DA5-V5-PRE-HARDWARE-CLOSURE-M-2026-08-13`.

## Boundary

This is the compact index for one continuous DA5 Lean Stage-6 Hardware flight. It does not
shorten AVS-001 V5 and does not replace `Development_Assignment_05_V5_Runbook.md`. Every Physical
observation, checkpoint, fresh-first-step rule, fail-closed stop, standard-profile restoration
and cleanup obligation in that Runbook remains controlling.

This card is ADO/pre-Hardware preparation only. It grants no Operator, ADB, installation,
Hardware or Human V5 execution authority.

The Technical Lead/Codex owns every digital command, binding, status read, disclosure-safe
Evidence update and cleanup action. The Human performs only irreducible physical/visual work:
device unlock/settings, Tag presentation, UI observation and `PASS`/`FAIL`/`AMBIGUOUS`, plus
hidden Credential entry only at the exact active Operator prompt. Never record a secret, device
UID/serial, raw NFC UID/payload, raw Product data or personal data.

**STOP HERE.** Current authority ends before Hardware, ADB, installation and Operator start. Do
not begin Phase B or C unless this Publication Closure candidate has first received independent
`APPROVED`, been focusedly published, and then received independent exact-head read-only review
of the actual published closure commit/tree. The live task must contain the separately issued
fresh, explicit, exact Human start signal quoting that reviewed head. Failure, ambiguity,
missing/changed binding, wrong order or interruption consumes that one-run authority: fail
closed, do not retry/resume/rebuild, and follow only the governing restoration/cleanup path.

## Exact carried bindings — read-only

| Boundary | Exact value |
|---|---|
| Lean decision | `83635335aa4f547dc8994243c604dacf9797f593` / tree `40b7655a94e607b8afe19f90f42a95f42ee6d582`; Human-accepted; independent `APPROVED`, zero open P0–P3 |
| Automated closure | `1b341d83592ea457c8ca722d01bfa2e64fe8cc40` / tree `2db756832a81f07cdb1a927ff3076320cc253960`; stages 1–5 and V0–V4 complete; CI `30786622180`, attempt 1, 12/12; final independent `APPROVED` |
| Current executable | `HEAD == main == origin/main == M` `9380758f3e149718c8c0b8d34a1818de64c0d8d1` / tree `3c3b566124cf8c7ccd7727faf3a8aa76231f20f7`; parents `B` `489a853e1af45e60bab0b94bcce05d674f6af700` and `D` `cc6767d118a66e7926b2a5c2a457684695d05d45`; `M` versus `B` exactly five ADO paths |
| Source / hardbinding | `A` `03e0e48ad53ff91b24ee1182abf782473317988d` / tree `4465f8ee5be41f82cdaed5f31f2da92b839c952d`; `B` tree `841727f8228f85ab91f5f7e9e9a052608e105152`; ordinary `git diff --binary A B` 10,441 bytes / SHA-256 `d430d51edf2459f37b96f6634611ad6092d9aa23330ec923da15e7dc2fc55127`; canonical `git diff --full-index --binary A B` 10,705 bytes / SHA-256 `b875bc186f2e218f608c69d2ebe579fc580e363664fd5efb6135c7961931610a` |
| Corrected V3 | Independently `APPROVED`, zero findings; immutable `v3-9380758-corrected-4r21J4` receipt SHA-256 `227b4a7e0028a85067ba5a22089ba201e4d678210a310ec6062279a446cbd2bc` and manifest `cc3299d4df6de04afb26aa9d834fab93f9eb105c4d8b3bb7833c43538379b2ae`; 20/20 builds, 21/21 tests-inclusive Typechecks, 21/21 suites, 3,026 pass/0 fail/3 named expected skips; cleanup complete |
| Exact-head CI | Run `31695047997`, attempt 1, exact `M`, 12/12 successful, no retry |
| Future ADO closure `C` | This candidate changes exactly ten existing ADO files. Its future focused publication commit/tree `C` is intentionally unknown and must not be predicted here. Independent prepublication approval and then independent exact-head review must bind `C`, exact ten-path delta/blobs and no executable/config/schema/dependency/test/workflow/artifact delta |
| Required live ADO binding | Only exact-head-reviewed `C` may be quoted by a later one-time Human authorization, together with exact `M`/tree/lineage, CI, corrected V3 evidence, APK/manifest, runtime manifest/entry/map, Node/toolchain and privately recorded device/Tags/ports/mappings/Guard/Credential constraints; no raw secret, UID or serial in ADO |
| Operator runtime | `/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-product-operator/9380758f-f06a1b50-r4`; final Round-4 independent `APPROVED`, zero open P0–P3 |
| Runtime manifest | `operator-runtime-manifest.json`; 16,492 bytes; mode `0444`; SHA-256 `8a179bf8ef7dd206f6095d4d1248780062fe3a7d8db78d45276dbf356b95609d` |
| Runtime entrypoint | `checkout/apps/synthetic-android-e2e/dist/da5V5Main.js`; 935,974 bytes; mode `0444`; SHA-256 `f06a1b508369fc525e562485f7a08bd5b1174034d0554cdb5174b3bbf3ef70d5` |
| Runtime map | Adjacent `.map`; 1,739,281 bytes; mode `0444`; SHA-256 `aba65ced7deb7aa6a44809cc2fef33e202c0157b3056cd00324911e7890dc30a`; version 3, no `sourceRoot`, 90/90/90 |
| Runtime dependencies | Hidden lock 328,432 bytes / `0444` / SHA-256 `9c6a9279f40fd88e2e958db388595b3b3575fb3dcb49c436562a83444d8bf0c4`; npm `11.13.0` CLI 54 bytes / SHA-256 `8e5f6f3429f8cdbe693cdc29904e9d5a7b127a494bd15c804bd54c7403bfcbe7` |
| Runtime correction chain | R1 rejected for npm-hash transcription; r2 closed it but exposed the A→B recipe label; r3 fixed A→B but exposed B→M/D→M labels; r4 exhaustively binds ordinary and full-index recipes for all three pairs without rebuild and is final `APPROVED` |
| Product APK | `/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5/lean-03e0e48a-b02fdb2544225d03/app-release-b02fdb2544225d03.apk`; 95,526,563 bytes; mode `0444`; SHA-256 `b02fdb2544225d03e3142fa30f12caa8fedf889a558b39cc040cca03f9539234` |
| APK manifest | Same directory `artifact-manifest.txt`; 1,968 bytes; 59 LF fields; mode `0444`; SHA-256 `91725bb6f14306eb40d0e4414f38511fc829250799af91bacf840ac622efc577` |
| Complete manifest equality | Runtime manifest and APK `artifact-manifest.txt` must each match the full bound size, mode and digest plus every parsed field; selected-field checks are insufficient |
| APK identity/security | Package `com.tim180201.mobile.synthetic`; versionCode `1`; versionName `1.0.0`; v2 `true`, v1/v3/v3.1/v4 `false`; signer count `1`; `local-synthetic-non-production` certificate SHA-256 `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`; `allow-backup=false`; `uses-cleartext-traffic=false`; base deny with 127.0.0.1-only exception; offline backup exclusions; exact NfcA binding; one Hermes bundle and runtime-contract match |
| Node | `/Users/timbartz/.nvm/versions/node/v24.17.0/bin/node`; `v24.17.0`; 120,591,840 bytes; mode `0755`; SHA-256 `f5f9b9db4d95f5e0340982685f083de654c21eef9d9122cab5321081ccaa2601` |

Do not run the legacy 45-gate Harness, create Attempt 16, run `npm ci`, repeat V3/V4, or rebuild
an APK/runtime because of this R0 synchronization. All historical attempts are immutable and
consumed. DA6 is frozen before this gate and is not a DA5 blocker.

## Publication Closure and live authority gate

1. Exact `M` and all carried V3/CI/APK/runtime Evidence above are immutable inputs, not the future
   Hardware-authority closure head.
2. This R0 closure candidate must receive independent `APPROVED` before a focused commit/push.
   Its future commit/tree is deliberately unknown here and need not be embedded afterward.
3. After publication, an independent exact-head read-only review must bind the actual published
   `C` commit/tree, all exact ten changed-path blobs, and confirm the exact scoped delta and
   that no executable, test, script, workflow, schema, dependency, lockfile, runtime or artifact
   input changed.
4. Only that externally exact-reviewed published closure head may be quoted by one new one-time
   Human Hardware authorization. The live signal must also bind Operator executable/tree, runtime
   manifest/entrypoint/map, APK plus artifact manifest/package/signature, governing Node/toolchain,
   and exact device/Tags/environment/Guard/Credential constraints.
5. A missing, stale or differing value stops before Phase B, ADB, installation or Hardware. The
   authority is not repairable or retryable.

## Phase A — offline preflight proven

After independent exact-head review of the published Publication Closure and before requesting or
accepting the Human start signal, the Technical Lead records only disclosure-safe
`MATCH`/`MISMATCH` for:

1. all exact read-only Operator/runtime/APK/Node bindings above, including complete byte-for-byte
   and parsed-field equality of both the runtime manifest and APK artifact manifest;
2. carried CI/review Evidence plus exact equality to the reviewed published closure commit/tree
   and every governing procedure blob recorded by that exact-head review;
3. null unexpected package/process, owned mapping/listener, disposable database/role, task
   runtime and stale Credential state;
4. exact local-only synthetic endpoints, Guard and controlled-offline capability; and
5. one named standard-profile device plus approved assigned, unassigned and unrelated Tags ready
   for fresh binding without recording UID/serial/raw values.

Outcome: `PREFLIGHT MATCH — WAIT FOR HUMAN START SIGNAL` or fail closed and clean up. Phase A
authorizes no ADB, installation or Hardware interaction.

## Phase B — Human device, Tags and Credentials ready

After the fresh exact Human start signal only:

1. Human unlocks the one bound device and confirms its standard profile; Technical Lead runs all
   digital binding/status commands.
2. Human makes only the requested Tag role available and presents nothing until prompted.
3. Human enters each Credential only at the active hidden prompt after confirming the exact field
   is empty/active; Technical Lead records only the safe receipt and visible-result confirmation.
4. Unexpected device/profile/Tag/Credential state stops with no retry. If accessibility
   preparation began, standard-profile restoration proof precedes cleanup.

## Phase C — one continuous exact Operator run

The Technical Lead drives the current Operator continuously and asks the Human only for the
physical/visual prompts below. Each checkpoint requires every detailed Runbook observation and an
unambiguous Human `PASS`; `FAIL` or `AMBIGUOUS` terminates the flight.

| Checkpoint | Human-only action | Governing observations retained |
|---|---|---|
| Gate A | Credential/visible confirmations and prompted Tag presentations | Authentication/enrollment roles; first assignment; separate Admin Setup Preview 2 plus safe exit/no replay; setup retained; signed-out/unassigned/unrelated rejection; exact clean-identity/package-clear Employee transition and `Bereit zum Scannen` before Tag B |
| Gate B | Present assigned Tag and move app foreground/background when prompted | Fresh cold launch; same-Tag dedupe; consume-once baseline; background/resume opposite action; active/history/provenance truth |
| Gate C | Prompted Customer Tag/manual actions and UI confirmation | Online Customer mixed NFC/manual provenance; Project and General Work manual pairs; elapsed-baseline checks; own-time/target/provenance truth |
| Gate D | Prompted physical network state and Tags | Controlled-offline FIFO/restart/sync; cancellation with zero replay; exact Protected/Review cutover sequence; protected state after cold relaunch; terminal Product-mutation stop |
| Gate E | Enable bound TalkBack/large text only after preparation; inspect surfaces; restore profile | Exact ordered eight-surface accessibility/layout observations; two narrow reauth handoffs; unchanged aggregates; mandatory `font_scale=1.0`, accessibility off/empty and read-only profile proof |
| Gate F | Visual final confirmation | Exact disclosure-safe final truth, no duplicate/foreign mutation, sign-outs and complete scoped package/mapping/listener/fixture/database/role/task cleanup |

Every dedupe baseline, elapsed check, fixture transition, status read, Operator command and
Evidence update is Technical-Lead-owned. The Human never copies commands, hashes, identifiers or
logs. Begin fresh at the Runbook's first mandatory step; reuse no observation from a failed,
aborted or earlier run.

## Phase D — exact stop, cleanup and Evidence

1. Stop Product mutation at the exact Runbook boundary. Use only the success terminal path after
   pass or the exact `abort`/terminal path available after failure, ambiguity or early stop.
2. If Gate E preparation occurred, Human restores the standard profile and Technical Lead proves
   it read-only before any completion claim.
3. Technical Lead performs scoped cleanup and repeated-null proof for package/process, owned
   mappings/listeners, fixture, disposable database/roles, runtime/task state and sessions.
4. Record only exact bindings, checkpoint result, safe failure stage/category, restoration and
   cleanup/null outcome in `ADO/05_Evidence/Development_Assignment_05_V5_Evidence.md`.
5. Cleanup success never converts failure or ambiguity into pass. Only the Human Architect or an
   explicitly delegated Human tester may mark the fresh V5 `PASSED`.

Terminal state is `PASSED AND CLEAN`, `FAIL_CLOSED AND CLEAN`, or `FAIL_CLOSED WITH CLEANUP RISK`.
None authorizes production, production data, production signing, deployment or distribution.
