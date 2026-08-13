# Development Assignment 5 — Lean Stage-6 Hardware Flight Card

Status: **R0/V0 TECHNICAL PRE-HARDWARE CLOSURE CANDIDATE / EXACT-REVIEWED FUTURE C REQUIRED / STOP BEFORE HARDWARE**

Owner: Technical Lead

Physical approval authority: Human Architect

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
