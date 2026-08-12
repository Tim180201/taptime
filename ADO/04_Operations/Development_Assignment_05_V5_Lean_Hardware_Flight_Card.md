# Development Assignment 5 — Lean Stage-6 Hardware Flight Card

Status: **ADO PRE-HARDWARE PREPARATION / PUBLICATION CLOSURE PENDING / STOP BEFORE HARDWARE**

Owner: Technical Lead

Physical approval authority: Human Architect

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
not begin Phase B or C until focused R0 publication and reviewed Publication Closure are complete
and the live task contains the separately issued fresh, explicit, exact Human start signal.
Failure, ambiguity, missing/changed binding, wrong order or interruption consumes that one-run
authority: fail closed, do not retry/resume/rebuild, and follow only the governing
restoration/cleanup path.

## Exact carried bindings — read-only

| Boundary | Exact value |
|---|---|
| Lean decision | `83635335aa4f547dc8994243c604dacf9797f593` / tree `40b7655a94e607b8afe19f90f42a95f42ee6d582`; Human-accepted; independent `APPROVED`, zero open P0–P3 |
| Automated closure | `1b341d83592ea457c8ca722d01bfa2e64fe8cc40` / tree `2db756832a81f07cdb1a927ff3076320cc253960`; stages 1–5 and V0–V4 complete; CI `30786622180`, attempt 1, 12/12; final independent `APPROVED` |
| Current Operator | `22fe85d540c8949f179b96589ed493f0211002db` / tree `7514edfe90da11a3288fec0df872fb7010238c0b`; CI `31630253237`, attempt 1, 12/12; final strict review `APPROVED`, zero open P0–P3 |
| R0 ADO candidate baseline | `2d0cbd01ce483987c375eeee9ecc49f37e2185f8` / tree `840fd156fe46614adf9d1bec2a018a2c6b453c1c`; documentation-only, not the Operator CI source and not the future Hardware-authority ADO head |
| Required final ADO binding | Unknown and unbound in this candidate. After focused R0 publication, reviewed Publication Closure must truth-synchronize the exact then-final published ADO commit/tree, including the governing Flight Card and Runbook versions. Do not predict or insert a future hash |
| Operator runtime | `/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-product-operator/22fe85d5-2a48d52d` |
| Runtime manifest | `operator-runtime-manifest.json`; 10,726 bytes; mode `0444`; SHA-256 `2e24bb5c5d39089ef871d9fd986a67532d51f71df3a6e1652b1b1e232bf6e1fe` |
| Runtime entrypoint | `checkout/apps/synthetic-android-e2e/dist/da5V5Main.js`; 930,095 bytes; mode `0444`; SHA-256 `2a48d52d204ef8cfba73d9a789de3ef50ecefa29e32c51953bc75b9d48d023a6` |
| Runtime map | Adjacent `.map`; 1,728,717 bytes; mode `0444`; SHA-256 `a51b9cfa0dfa883bf5d091789051ec16c85529afbecd53b37017940fa16a70d2` |
| Product APK | `/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5/lean-83635335-b0180c31769e4534/app-release-b0180c31769e4534.apk`; 95,522,751 bytes; mode `0444`; SHA-256 `b0180c31769e453472a20eb1e7eb4e0825a85be9429becf6bf4970e0875b67f8` |
| APK manifest | Same directory `artifact-manifest.txt`; 1,968 bytes; mode `0444`; SHA-256 `83b93bbf33297334bfcca3aa30e5ed6772175f98a2a81dc80045454570fe937b` |
| Complete manifest equality | Runtime manifest and APK `artifact-manifest.txt` must each match the full bound size, mode and digest plus every parsed field; selected-field checks are insufficient |
| APK identity | Package `com.tim180201.mobile.synthetic`; versionCode `1`; versionName `1.0.0`; signature schemes v2 `true`, v1/v3/v3.1/v4 `false`; signer count `1`; signer certificate SHA-256 `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`; local V5 debug identity, no production-signing claim |
| Node | `/Users/timbartz/.nvm/versions/node/v24.17.0/bin/node`; `v24.17.0`; 120,591,840 bytes; mode `0755`; SHA-256 `f5f9b9db4d95f5e0340982685f083de654c21eef9d9122cab5321081ccaa2601`; read-only bundle check `PASS` on 2026-08-12 |

Do not run the legacy 45-gate Harness, create Attempt 16, run `npm ci`, repeat V3/V4, or rebuild
an APK/runtime because of this R0 synchronization. All historical attempts are immutable and
consumed. DA6 is frozen before this gate and is not a DA5 blocker.

## Publication Closure and live authority gate

1. Publish this focused R0 ADO delta first; the candidate baseline above cannot serve as the
   future Hardware-authority ADO head.
2. Truth-synchronize and review the exact then-final published ADO commit/tree as Publication
   Closure, including the exact governing Flight Card and Runbook versions.
3. Only then may the Human Architect issue one new one-time Hardware authorization. Its live start
   signal must fully quote that exact final ADO commit/tree and bind the Operator executable/tree,
   runtime manifest/entrypoint/map, APK plus artifact manifest/package/signature, governing
   Node/toolchain, and exact device/Tags/environment/Guard/Credential constraints.
4. A missing, stale or differing value stops before Phase B, ADB, installation or Hardware. The
   authority is not repairable or retryable. This candidate claims no future commit/tree.

## Phase A — offline preflight proven

After reviewed Publication Closure and before requesting or accepting the Human start signal, the
Technical Lead records only disclosure-safe `MATCH`/`MISMATCH` for:

1. all exact read-only Operator/runtime/APK/Node bindings above, including complete byte-for-byte
   and parsed-field equality of both the runtime manifest and APK artifact manifest;
2. carried CI/review Evidence plus exact equality to the reviewed final published ADO commit/tree
   and its governing Flight Card/Runbook versions;
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
