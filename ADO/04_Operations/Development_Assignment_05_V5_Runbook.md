# Development Assignment 5 — V5 Human Android Gate Runbook

- Status: **PHASE-0 RUN 16 CONSUMED FAIL-CLOSED AT FIRST TAG-A `technology_evidence`; NO B/X, HUMAN PASS, RETRY OR HARDWARE DEFECT — NFCA-ONLY PRODUCT/VALIDATION/OPERATOR SUPERSESSION PENDING — NO RUN AUTHORITY/DO NOT START**
- Date: 2026-07-30
- Owner: Technical Lead
- Approval authority for any run: Human Architect

## 0A. Run-16 terminal record and current non-executable correction

Run 16 matched `artifact`, `preflight`, `install_launch` and `waiting` in the offline operator
session. After the Human confirmed the exact displayed device binding, the first physical Tag-A
scan stopped at the fixed safe stage `technology_evidence`. No B/X scan, Human PASS or retry
occurred. The accepted terminal command was `abort`; final receipts were `cleanup:match` and
`failed:mismatch`. Raw technologies, UID and fingerprint were not disclosed. This is not a
hardware-defect finding.

The Human Architect explicitly decided NfcA-only v1 Product dispatch/Validation. The Technical
Lead delegated only its focused R3 implementation on baseline
`17f4b47b8429d3862789b7e13a23f8da9d28c449`, tree
`4bbfe9e3fdcdf474f1f506135560e4e111122fb5`; this record grants no run authority.

The Product NfcA/MifareUltralight artifact and the then-current Validation/Operator bindings are
historical **DO NOT INSTALL** or pending supersession. The current uncommitted correction and every
future replacement remain non-executable until separately reviewed and authorized. Its sole
read-only no-hardware readiness entry is
`npm run android:da5-v5-validation:verify --workspace=@taptime/mobile`. Its inputs are separate and
must never be collapsed:

| Readiness input class | Explicit variables; exact future values remain unbound |
|---|---|
| Execution Repository | `DA5_V5_VALIDATION_REPOSITORY_ROOT`, `DA5_V5_VALIDATION_EXECUTION_COMMIT`, `DA5_V5_VALIDATION_EXECUTION_TREE`; these bind the repository in which the closure/readiness code executes |
| Artifact Source | `DA5_V5_VALIDATION_SOURCE_COMMIT`, `DA5_V5_VALIDATION_SOURCE_TREE`, and for artifact verification `DA5_V5_VALIDATION_SOURCE_CLOSURE`; these bind the source represented by the immutable APK/manifest and may legitimately differ from Execution Repository commit/tree |
| Immutable tools | For each of `NODE`, `GIT`, `ADB`, `AAPT`, `APKSIGNER`, `HERMESC`, `UNZIP`: `DA5_V5_VALIDATION_<TOOL>_PATH`, `_BYTES`, `_MODE`, `_SHA256`; hermesc must equal the repository-resolved compiler and unzip must equal `/usr/bin/unzip`; no digest, byte count or mode is authorized by this draft |
| Android SDK | `ANDROID_HOME` and/or `ANDROID_SDK_ROOT`; if both are supplied they must be identical. ADB, aapt and apksigner must equal their exact SDK-derived paths |
| Artifact files | Existing exact `DA5_V5_VALIDATION_APK_*` and `DA5_V5_VALIDATION_MANIFEST_*` bindings |

The readiness path requires current Node to equal `process.execPath`; verifies every tool as a
canonical symlink-free regular executable with exact path/mode/size/SHA-256 and stable identity;
and requires clean state in the Validation source scopes. Its ordinary status call covers staged,
unstaged and untracked state with root `app.json` and `research/**` as explicit top-level
exclusions. A second `status --ignored=matching` call receives only the positive deduplicated
source scopes plus the exact 13-file transitive local `.mjs` import closure, detecting ignored
`.env*` and module-build residue without traversing or listing protected paths;
`apps/mobile/app.json` remains in scope. The mutation-capable operator executes the same readiness
boundary before session creation and before any ADB-capable object exists. Readiness executes Git
only, never ADB. The Product manifest must have exactly one MainActivity TECH+DEFAULT/no-data
filter and one exact metadata reference; compiled APK inspection must bind its numeric resource ID
to the uniquely resolved exact-NfcA XML tree. Duplicate/broader/TAG/NDEF or foreign
activity/activity-alias NFC bindings stop verification. The two ADB runners and APK inspector then
reattest and use their exact bound tool identities; successful completion rechecks stable
dev/inode/path metadata. After operator-abort arbitration, every winning typed child timeout at
reattestation, installed provenance, prelaunch, activity start, postlaunch or installation maps
only to `adb_child_timeout_mismatch`. Blank/foreign input or EOF during an active install is an
operator abort and converges through one cleanup. Native cancel unregister/cleanup-timeout failure
settles capture and remains `cleanup_failed` ahead of cancel/order outcomes. The UI coalesces only
the same active offer, removes it at settlement and rejects stale replay. This is not permission
to build, install or run.

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

**Phase 0 — Validation Binding Preflight** has no current authority. Sixteen prior one-time
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

Run 9 used baseline `2f057cb4e5d096e34785c72c51340f589c711dd2`, tree
`6f65f44e53574921f1e8e9fdfde94f7a9a9ade2c`. It emitted exactly `artifact:match`,
`preflight:match`, `install_launch:mismatch`, `cleanup:match`, `failed:mismatch`. It reached no
scan or Validation UI handoff. The aggregate receipt cannot reconstruct which install-/launch
boundary failed; no Product, NFC or hardware defect is proven. The authority is consumed, and
terminal cleanup restored package, process and global reverse state to zero.

Run 10 used baseline `b63641953536bb36625fcd42d850e429ddab8db3`, tree
`dc1b9a11e0391074b35139f5948ef6b2c45f1d26`. It emitted exactly `artifact:match`,
`preflight:match`, `stage=installation status=mismatch category=operation_mismatch`,
`install_launch:mismatch`, `cleanup:match`, `failed:mismatch`. It emitted no
`installed_provenance` receipt and reached no Validation UI, NFC or Tag step. Because the then
current `installation` category also summarized verification mismatches before the PackageManager
call, the exact cause is not further reconstructable and the category does not prove that the
install call ran. No Product, APK, NFC or hardware finding is established. The authority is consumed,
terminal cleanup matched, and another run remains **DO NOT START** without fresh exact Human
authorization.

Run 11 used baseline `d8549c3f1d14c15846d4f81dbe7669a598626633`, tree
`04ea2d0571a2e030fe99fbba27b622e68604644e`. It emitted exactly `artifact:match`,
`preflight:match`,
`stage=installation status=mismatch category=operation_mismatch`,
`install_launch:mismatch`, `cleanup:match`, `failed:mismatch`. It emitted no
`installed_provenance` receipt and reached no Validation UI, NFC or Tag step. On that exact
operator, the category proves entry into the existing PackageManager-call boundary but cannot
distinguish a rejected ADB/child transport from a resolved PackageManager operation with a
non-accepted exact `Success` receipt. No Product, APK, NFC or hardware finding is established.
The authority is consumed and terminal cleanup matched.

The authorized focused local correction preserves the FD-/snapshot-bound streaming install,
exact APK/package/user-0 binding, timeouts, fail-closed behavior, zeroization and cleanup. A
rejected install runner maps only to fixed `adb_child_transport_mismatch`; only after the runner
resolves does a non-exact `Success` receipt map to fixed
`package_manager_receipt_mismatch`. Pre-install verification and later Activity categories stay
unchanged. Receipts cannot contain raw errors/stderr, PackageManager output, paths or serials.
Focused verification passes the complete Operator test file 139/139 and the Mobile
tests-inclusive typecheck, with the changed test source proven included. The one complete
safe-root V3 used Node `24.17.0`, npm `11.13.0` and PostgreSQL `17.10`; it passed 20/20 builds,
21/21 tests-inclusive typechecks and 21/21 workspace suites with 2,516 passed tests and exactly
two optional B1 skips. Migrations 001–013 apply/replay/ledger, C3B `verify-bin`, the unchanged
official `03694f2` artifact verifier and an 861-module Android export passed; candidate bytes
matched, and ports `55439`/`55435` plus process state ended at zero. Published candidate
`9549da9cda578c60ca11144221e8030fb95697d3`, tree
`ced33c8d9d9cdef7d628a47147427ed6147b898a`, parent
`d8549c3f1d14c15846d4f81dbe7669a598626633`, passed exact-head CI `30471511446`,
attempt 1, 12/12. Prepublication review round 1 found exactly one P3 ADO-truth gap and no
code/test finding; round 2 approved and closed it. Final independent Exact-Head review returned
`APPROVED` with zero open P0–P3. The correction is technically final; the operator remains
**DO NOT START**.

Run 12 used ADO baseline `3fcbcdec79dada8d43041a241127e52f4775e8d8`, tree
`74cac3e8611e39938e2c52c25df8cde38be254d2`, and exact candidate `9549da9`/tree
`ced33c8`. It emitted exactly `artifact:match`, `preflight:match`,
`stage=installation status=mismatch category=adb_child_transport_mismatch`,
`install_launch:mismatch`, `cleanup:match`, `failed:mismatch`. It emitted no
`installed_provenance` receipt and reached no Validation UI, NFC or Tag step. Its authority is
consumed, terminal cleanup matched, and no Product, APK, NFC or hardware finding is established.

The focused local Run-12 correction changes only the PackageManager streaming invocation from
`shell -T` to `shell -T -x`. The official ADB shell contract defines `-x` as disabling remote
exit-code propagation and stdout/stderr separation. A remote PackageManager rejection therefore
settles the ADB child and reaches the strict single-line parser. Only exact `Success` succeeds.
Fixed allowlisted output forms map to disclosure-safe policy/user, artifact/parse/signature,
installed-state/version/signature-conflict, storage or command-contract/usage categories.
Unknown, malformed or multiline output remains generic `package_manager_receipt_mismatch`; a
real spawn, stream, timeout, abort or ADB-child failure still rejects and maps to
`adb_child_transport_mismatch`. No raw output, code or detail is emitted or persisted. The shared
ADB runner, streaming snapshot, exact artifact/package/user-0 binding, timeouts, zeroization,
provenance, fail-closed behavior and cleanup remain unchanged. Focused Operator regression passes
150/150 and the tests-inclusive Mobile typecheck passes with the test
source included. A complete Mobile attempt passed 51/52 files and 866/867 tests; the sole failure
was the known generated native-output contamination exceeding the locked Validation native-source
closure. It was not retried or removed. The Run-12 install candidate remains V1/V2-focused green.
A later isolated V3 attempt is not recognized as V3: after all 288/288 Synthetic assertions
passed, two post-test PostgreSQL `57P01` events exposed that the local Guard stopped PostgreSQL
before closing its still-live pools. Preceding wrapper setup stops likewise provide no V3
evidence. The Human Architect replaced that contradictory order with successful capability/DB
reattestation, closure of all owned Runtime pools and the active Installer pool, unchanged
binary/lifecycle reattestation and only then `STOP_FAST`. The focused Guard suite passes 78/78 and
the Synthetic workspace tests-inclusive typecheck passes. Final combined candidate
`3a77603825db573bdabb2d4202fe7cca5383c1ed`, tree
`3996b4c27d2970b99e1b407217dd269e62be72ce`, parent
`3fcbcdec79dada8d43041a241127e52f4775e8d8`, passed V3 with 20/20 builds, 21/21
tests-inclusive typechecks and 21/21 suites / 2,529 passed tests / two expected skips, plus
migration, binary, artifact, export and cleanup verification. Exact-head CI `30479752844`,
attempt 1, passed 12/12 without retry. Independent prepublication and final Exact-SHA reviews
each returned `APPROVED` with zero open P0–P3. The Run-12 diagnostic and local Guard cleanup
correction is technically closed; the operator remains **DO NOT START**.

Run 13 used baseline `63feaf48a98e656dcceb395098bea8b260420e16`, tree
`1d635956eb22c9bba99834ca831159741889e83f`. Its complete disclosure-safe receipt sequence was
`artifact:match`, `preflight:match`,
`stage=installation status=mismatch category=adb_child_transport_mismatch`,
`install_launch:mismatch`, `cleanup:match`, `failed:mismatch`. The read-only device binding
matched before installation. It emitted no `installed_provenance` or `waiting` receipt and
reached no Validation UI, NFC or Tag step. Its authority is consumed, terminal cleanup matched,
and no Product, APK, NFC or hardware finding is established.

The focused Run-13 correction is confined to a Validation-only streaming-install runner; the
shared ADB runner remains unchanged. Child start/transport, timeout, stdin-pipe abort and
nonzero/signal exit are distinct disclosure-safe terminal categories. `EPIPE`/`ECONNRESET`
remains provisional until the same absolute timeout observes actual child close and complete
stdout. Only then may the existing strict single-line PackageManager parser run; exact `Success`
still requires the unchanged installed-artifact provenance proof. Missing or ambiguous terminal
evidence fails closed, and stderr, raw errors, device paths, serials and PackageManager details
remain undisclosed. Focused V1/V2 passes 161/161 tests and the tests-inclusive Mobile typecheck.
The final complete Mobile run passed 52/53 files and 887/888 tests; only the known unrelated generated
native-output contamination exceeded the locked Validation native-source closure, and it was not
retried or removed. Pre-sync ten-file V3 patch SHA-256
`265bdc5b6c5c31897743fdbcc1160deccc2a9c152bb3cca85c7f598ad08899b4` passed fresh,
research-free sparse-safe-root V3 with Node `24.17.0`, npm `11.13.0`, task-owned PostgreSQL
`17.10`, 20/20 builds, 21/21 tests-inclusive typechecks including changed Mobile tests,
migrations 001–013 apply/replay/ledger, 21/21 suites / 150 files / 2,540 passed tests / exactly two
optional B1 Supavisor skips, C3B `verify-bin`, unchanged Validation APK/manifest verifier,
861-module Android export and final ports `55439`/`55435` plus task cleanup matched. Wrapper setup
first lacked `rg` in `PATH` after green builds/typechecks and later omitted the already bound
artifact-verifier environment after all suites; both stopped outside Product verification. The
same safe root continued without code change or retry of green gates, and final exact bindings
passed. That patch was captured while the four ADO files still said `V3 pending`; the subsequent
R0 synchronization changed only those documents, while all six code/test files remained
byte-identical. AVS evidence therefore transfers to round-1 candidate
`a03811011eed2d3ebde1c94e60c42f806bde7ecf`, tree
`b21d39887ea613294ed2d9612fd3fa0ff5025a0e`, parent `63feaf48…`, with six-file
code/test diff SHA-256 `ad34c36fbfc5088252a6bd961c426ccae4fdc3b7b8e212bc25481eb17a390452`
and full ten-file candidate diff SHA-256
`ed0047c1311bc83f664cf67702d8150bc2575d9d88f31449704a480b2ddaa4b8`.
Independent round 1 returned `CHANGES REQUIRED` for exactly this one P3 ADO finding and no code,
security or test finding. The focused ADO-only correction was published as commit
`ac51dfd338c75c4bbc0c73345e4d045924022423`, tree
`3d1f3ddfec3d0f07a1ceea7f5ab87029b18d69a5`, parent
`a03811011eed2d3ebde1c94e60c42f806bde7ecf`, and `origin/main` matched that commit exactly.
V3 evidence transferred under the documented R0 byte-identity boundary and was not rerun.
Exact-head CI `30485438652`, attempt 1, event `push`, completed successfully with 12/12 and zero
failed checks. The independent pre-V4 Exact-Delta review and final independent Exact-Head/V4
review both returned `APPROVED` with zero open P0–P3, closing the P3 and the Run-13 correction
scope technically. This following closure synchronization is R0; its own `[skip ci]` commit and
tree remain pending and are not claimed. No ADB, hardware or installation occurred. This
correction does not authorize another Phase-0 run.

Run 14 used baseline `887801943064d686da40785d64cd1105431c44ac`, tree
`5c15f0fae9c14844b604addf1c38b3bd5203647e`. The Operator session started and emitted exactly
`artifact:mismatch`, `cleanup:match`, `failed:mismatch`. It stopped internally at artifact
verification before preflight, ADB or installation because the cleaned Operator environment did
not retain the exact Android SDK binding. No device/install mutation occurred and the authority is
consumed.

Run 15 used the same exact baseline after binding `ANDROID_HOME` and `ANDROID_SDK_ROOT` to the
already authorized SDK. Offline artifact verification matched, then the Operator emitted
`artifact:match`, `preflight:match`,
`stage=installation status=mismatch category=adb_stdin_pipe_abort_mismatch`,
`install_launch:mismatch`, `cleanup:match`, `failed:mismatch`. It emitted no
`installed_provenance` or `waiting` receipt and reached no Validation UI, NFC or Tag step. The
authority is consumed, cleanup matched and no Product, APK, NFC or hardware finding is established.

The focused non-executable `DA5-V5-INSTALL-SESSION-01` candidate replaces the combined one-shot
stream with exact `install-create`, `install-write` and `install-commit` stages under one install
deadline. The exact canonical session ID remains memory-only; the sealed snapshot, `-R`,
package/User-0/size binding, exact write-byte and PackageManager receipts, and installed
SHA/provenance proof remain mandatory. Every known uncommitted session failure triggers one
bounded idempotent `install-abandon` before ordinary cleanup, and cleanup cannot match without
proven session absence or settlement. A partial `EPIPE`/`ECONNRESET` reaches only the existing
strict parser after terminal child/stdout evidence; partial success, empty, malformed or multiline
evidence remains fail-closed. On exact baseline
`887801943064d686da40785d64cd1105431c44ac`, tree
`5c15f0fae9c14844b604addf1c38b3bd5203647e`, the uncommitted nine-path candidate had original
pre-sync diff SHA-256
`1ca772260b64d402b19af6012c15074d2c801c3a63c52790319db056977dc084`. Focused scope passed
179/179. Fresh research-free safe-root V3 passed `npm ci`, 20/20 builds, 21/21 tests-inclusive
typechecks, Mobile test-source inclusion 53/53, migrations 001–013 apply/replay/ledger and 21/21
workspace suites across 150 test files with 2,558 passed and exactly two expected optional B1
Supavisor skips. Mobile passed 53/53 files and 906 tests. C3B `verify-bin`, the unchanged
Validation APK/manifest verifier and an Expo Android export of 861 modules passed; ports
`55439`/`55435` were absent and Guard/task cleanup matched. Prepublication review returned
`CHANGES REQUIRED` with exactly one P3 against the stale ADO V3 binding and no code, test,
security, tenant-isolation, install-session or cleanup finding. This four-file R0 sync is the
historical correction. It and the candidate were published as
`352b2d164bf4c8f0703fe50ef7746c7cbcfa9ab0`, tree
`d27432bc6c934a83842c8ca661723f4dd15aaf5b`. Exact-head CI `30547584412`,
attempt 1, passed 12/12 and remains historical green evidence for that exact source. Final
Exact-Head review nevertheless returned `CHANGES REQUIRED` with exactly one P3: after a
successful `install-create` or `install-write`, device re-attestation drift still inherited
`adb_child_transport_mismatch` before the next PackageManager mutation. The published candidate
is not closed, and that CI remains predecessor-only evidence. This authorized focused additional
round keeps both re-attestation boundaries at `verification_mismatch` and switches to
`adb_child_transport_mismatch` only immediately before `install-write` or `install-commit`.
Focused V1/V2 passes the changed MJS syntax check, the complete Operator file at 171/171 and the
tests-inclusive Mobile typecheck with the changed test source included. The only new final V3 is
complete for the uncommitted six-path candidate on baseline
`352b2d164bf4c8f0703fe50ef7746c7cbcfa9ab0`, tree
`d27432bc6c934a83842c8ca661723f4dd15aaf5b`; its pre-sync diff SHA-256
`d5c99d072415198e28c6fd2bf97d4b81869ed6fcff5a759606ba6bd56b415683` remained exact
throughout V3. A research-free sparse Safe Root with a narrow ADB-free `PATH` passed `npm ci`,
20/20 builds, 21/21 tests-inclusive typechecks, Mobile source inclusion 53/53, migrations 001–013
apply/replay/ledger and 21/21 workspace suites across 150 test files with 2,560 passed and exactly
two expected B1 skips; Mobile passed 53/53 files and 908 tests. The protection check first stopped
before `npm ci` because global `adb` was visible; narrowing `PATH` meant no V3 gate had started or
was repeated. The artifact-verifier wrapper stopped before the verifier because it named the
wrong absolute `jq` path; with `/usr/bin/jq`, the first actual verifier run passed and no green
stage was repeated. C3B `verify-bin`, unchanged Validation APK/manifest verification and an Expo
Android export of 861 modules passed. Ports `55439`/`55435` were clear, task/Guard cleanup matched
and the Safe Root was recoverably moved to Trash. The exact six-path implementation diff SHA-256
`e11b9a0a7aaad54c7416d680feffdbdefce793d298e320a70dd5868c96d99927` was published as
`4067f629f12ee0fa2994de0e4b64946924dc5e6f`, tree
`10629b848a7ad6435a2f9683d6f700d327d28f8d`, on parent
`352b2d164bf4c8f0703fe50ef7746c7cbcfa9ab0`. Exact-head push V4 `30552233999`, attempt 1,
passed 12/12 without retry. Final independent Exact-Head/V4 review returned `APPROVED` with zero
P0–P3; the correction is technically closed and `MERGE_READY`, but not Human-run-ready.
Historical CI `30547584412` remains predecessor history. This four-document closure sync is R0:
executable/test blobs remain byte-identical to `4067f62`, V3/V4 carry forward, and a second CI is
neither required nor authorized. The closure-sync commit/tree remain pending and unclaimed. It
grants no new Phase-0, Human-run, ADB, installation or hardware authority and remains **DO NOT
START**.

The focused local Run-10 diagnostic correction preserves every stage, aggregate receipt,
mutation, cleanup and terminal boundary. A pre-install device re-attestation mismatch remains
`installation` + `verification_mismatch`; the category changes to `operation_mismatch` only
immediately before the PackageManager install call. The regression proves zero install
mutation/call, exact aggregate/terminal ordering and no synthetic-secret disclosure, while the
existing true install-failure matrix remains `operation_mismatch`.

Combined V2/V3 on the unchanged 950-file tracked candidate used Node `24.17.0`, npm `11.13.0`
and task-owned PostgreSQL `17.10`. Carried isolated evidence supplied 20/20 builds, 21/21
tests-inclusive typechecks, Mobile 52/52 test-source inclusion, suites 1–8 and migrations 001–013
apply/replay/ledger. Fresh authorized continuation supplied suites 9–21, C3B `verify-bin`, the
official unchanged `03694f2` verifier and one isolated Android export. Overall, 21/21 suites
passed across 149 test files and 2,515 tests with exactly two optional B1 Supavisor skips; Android
bundled 861 modules. No V4 was executed locally, and no ADB, installation or hardware action
occurred.

The install-category correction is technically final and published as
`12d1ace89494851025555d1d06d45570c4fcc4cb`, tree
`b747b4306637d90765b33f273ad89291bd4ea9a7`, on exact parent
`b63641953536bb36625fcd42d850e429ddab8db3`. Its exact code/test delta is limited to
`apps/mobile/scripts/da5V5ValidationPhase0OperatorCore.mjs` and
`apps/mobile/tests/runtime/da5V5ValidationPhase0Operator.test.ts`; the published six-file delta
contains only the four synchronized ADO truth files in addition. V2/V3 above are green.
Exact-head V4 CI `30466798295`, attempt 1, completed successfully 12/12. The prior round-2 delta
review and final independent Exact-Head/V4 review returned `APPROVED` with zero open P0–P3,
closing the round-1 P2. At that historical checkpoint, all ten Phase-0 authorities were consumed;
the operator remains
**DO NOT START**, with no new Phase-0, hardware, ADB, installation or Product Human-V5 authority.

Non-code preparation stops remain explicit: contaminated main-workspace native dependency outputs
exceeded the fail-closed source-closure bound; the first clean safe-root lacked required contract
entrypoints before Mobile; B1 first lacked its required synthetic runtime password; the first
verifier binding supplied paths instead of 32 `{path, sha256}` records; and the first Expo
invocation used an unsupported positional project path. Each stopped fail-fast without an
unchanged retry. Separately authorized runner-only continuations passed every remaining gate and
cleaned all task-owned database, port and temporary-root state.

### 0.1 Approved Validation Phase-0 operator correction — non-executable

The focused correction is published as
`083fdfb259089d976e48f824e0862f10637d3290`, tree
`24bd130500934c6a48fd9314fa06387d6ebdedcd`, exact parent
`39a6ef09fad18375af025bc8ed12cc1ea6dda964`, and consists of
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

The historical install-/launch-diagnostic predecessor
`8ce03852e782d541319bb852f216cf596ab1787f`, tree
`f5b914c1b8f1243244733808beaef54f0351a563`, on parent
`2f057cb4e5d096e34785c72c51340f589c711dd2` keeps that aggregate, ownership, deadline, cleanup
and terminal protocol unchanged. Its exact eight-file +488/-132 delta has patch SHA-256
`c8418fe6382c8a23ada44254c2fdc35652acbb73a8f99983f5cbb4cc11b46984`. On failure it adds
exactly one disclosure-safe receipt for the matching boundary: `installation`,
`installed_provenance`, `prelaunch`, `activity_start` or `postlaunch`. Its required category is
closed to `operation_mismatch` or `verification_mismatch`; the category follows only the fixed
local control-flow boundary and never `Error.message` or command output. The diagnostic receipt
immediately precedes the existing `install_launch:mismatch`. V1/V2 executed green with both MJS
syntax checks, the complete affected Operator test file at 137/137 and the Mobile tests-inclusive
typecheck including the changed test source. Unchanged green V3 from `496ca59`/tree `b398b89` is
carried. Exact-head CI `30459539801`, attempt 1, passed 12/12; independent
Exact-Delta/Commit/Tree/CI review returned `APPROVED` with zero open P0–P3. The operator remains
**DO NOT START** and this approval grants no Phase-0, installation, ADB, hardware or Product
Human-V5 authority; any run requires separate fresh exact Human authorization.

#### Historical published readiness candidate and consumed failed V4/review

The published eight-file candidate
`496ca59f0965670b29a210b8aa2443b99bb4a386`, tree
`b398b89c77f7f0b4799a7a06b11bd2daf51fd34a`, starts from exact baseline
`fa1aaa782415aceb85c0aa5c1233732ef9afa4dc`, tree
`da69081517d2b0b9631eaef393b0a6022735061e`. It remains **DO NOT START**. It changes no
Validation App, APK, manifest, artifact, NFC acceptance rule, dependency, lockfile, schema,
Product rule or later Product-Human-V5 workflow.

The final fresh detached sparse safe-root V3 bound executable-patch SHA-256
`5dea48121b62fe7ebb4894f72425aa5ef5f759e113c3dd349f9fd48bb29fe9b4` and exact Node
`24.17.0`/npm `11.13.0`/task-owned PostgreSQL `17.10`. The first alphabetical build aggregate
passed 15/20 and stopped five dependency-sensitive builds before their fresh internal declarations
existed; only those five were continued topologically and passed 5/5 with candidate bytes
unchanged, completing 20/20 unique builds. All 21/21 tests-inclusive typechecks and 21/21 suites
passed across 148 test files, 2,505 tests and exactly two optional B1 Supavisor skips. Migrations
001–013 applied, replayed with `applied=none` and passed ledger verification; C3B `verify-bin`,
52/52 Mobile test-source inclusion, the unchanged official artifact verifier and one isolated
861-module Android export passed. The exact task PostgreSQL was stopped, ports 55437 and 55435
were absent, and the complete task root was moved recoverably to Trash. The subsequent four-file
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
a focused harness correction and new CI required new Human authority.

#### PostgreSQL test-cleanup correction and technical closure

The subsequently authorized focused test-only correction is
`21e518151a3f4727ebf4ce90cd1557660960ff21`, tree
`8f764f9260378b631b4b026355852c324d6dc06b`, on exact parent
`d63c62de9eced5f7dd62c8c957d4c2fffce77bf9`, tree
`753feedcae6724e711557e6492bbe26fa0b02083`. Its seven-file test-only delta is +192/-12 with
SHA-256 `b0406bc02a085649060b3dfdb263db00694e501efbe1c247f3ba49fec3cb53e2`.
The known B3, C3B, C3C and C3E1 dirty-database finalizers now wait boundedly for zero sessions
of the exact bound test database after `Pool.end()` and then drop it without `FORCE`; the
separate pre-test cleanup and C3E2 remain unchanged.

Focused V1 passed 2/2. V2 passed B3 128/128, C3B 60/60 and C3C+C3E1 102/102; the three
tests-inclusive typechecks passed. The unchanged safe-root V3 evidence from
`496ca59`/tree `b398b89` was carried forward because product, operator, Validation App/artifact,
workflow, dependencies and lockfile did not change. Exact-head CI `30429746848`, attempt 1,
passed 12/12 without retry. Independent source/delta and final Exact-SHA/V4 reviews returned
`APPROVED` with zero open P0–P3, closing the historical P2. This technical closure grants no
Phase-0, installation, ADB, hardware, device/Tag or Product Human-V5 authority; the operator
remains **DO NOT START**.

The readiness delta uses the Android-Toybox-compatible exact process query
`ps -A -w -o NAME:4`. Only the exact unpadded header `NAME` and unpadded, whitespace-free process
rows are accepted; `-w` preserves full package and `package:process` names instead of silently
truncating them. Any header, padding, column or row deviation fails closed.

The following checks are **INFO-only pre-authority readiness**, not a Helper, wrapper, start or
hardware authorization:

1. Use the canonical repository CWD
   `/Users/timbartz/Dokumente/GitHub/taptime` and require its canonical real path to be identical.
2. Bind the separately named Execution Repository commit/tree and require clean staged, unstaged
   and untracked Validation source scopes, retaining the explicit `research/**` and root-`app.json`
   exclusions without listing either protected path.
3. Resolve and bind canonical absolute Node, Git, ADB, aapt and apksigner paths plus exact regular
   executable mode, byte size and SHA-256; Node must equal `process.execPath`, and Android tools
   must equal the SDK-derived paths. Do not rely on aliases, shell functions or PATH substitution.
4. Start the future operator only from a cleaned environment with `NODE_OPTIONS` unset and without
   `ADB_SERVER_SOCKET`, `ANDROID_ADB_SERVER_PORT`, `ANDROID_SERIAL`, `ADB_VENDOR_KEYS` or any other
   ADB override. These checks may not install, launch, contact hardware or change system state.

The direct future invocation shape is:

```sh
TAPTIME_DA5_V5_VALIDATION_PHASE0_PROFILE=da5-v5-validation-phase0 \
TAPTIME_DA5_V5_VALIDATION_DEVICE_MODEL='<future exact Human-authorized model>' \
TAPTIME_DA5_V5_VALIDATION_ANDROID_BUILD='<future exact Human-authorized build fingerprint>' \
node apps/mobile/scripts/da5V5ValidationPhase0Operator.mjs
```

This is a protocol description, not execution authority. After automatic preflight, an authorized
operator enters exact `install-launch`. Receipt `waiting:match` is only the handoff to the
separately authorized Human sequence below; it is not a UI attestation.

Any future independently approved install-launch failure must emit exactly one of the five fixed
stage/category receipts above immediately before the aggregate `install_launch:mismatch`. The
PackageManager install uses exact `shell -T -x` so a remote rejection reaches only the strict
single-line parser. Only exact `Success` succeeds. Fixed allowlisted forms may emit only the safe
policy/user, artifact/parse/signature, installed-state/version/signature-conflict, storage,
command-contract/usage or generic receipt category; unknown, malformed and multiline output is
generic. True local ADB/child failures continue to reject before it. Raw errors, codes, details,
installed paths, device serials and PackageManager output remain prohibited.

After `waiting:match`, the future Human and operator must perform exactly this sequence:

1. On the Validation UI require the exact title
   `Geräte- und Bedienungshilfen-Bindung prüfen` and exact text
   `Alle angezeigten Werte exakt mit dem Hardware-Runbook abgleichen.` Compare the displayed
   model, Android release/API/build, exact **200 %** font scale and TalkBack package/version with
   the future authorization. Exactly one installed and active provider is permitted:
   `com.google.android.marvin.talkback` at the authorized version or
   `com.samsung.android.accessibility.talkback` at the authorized version. None, both, a different
   package or a different version fails closed. Only after exact equality may the Human activate
   `Gerätebindung exakt bestätigen`.
2. Perform exactly 30 separate successful stable physical presentations in the fixed order:
   ten Tag-A presentations for role A, then ten Tag-B presentations for role B, then ten Tag-X
   presentations for role X. This is **10 A + 10 B + 10 X**, not three scans. At every
   presentation use only the physically matching marked Tag for the active role; no substitution,
   interleaving or out-of-order role is allowed.
3. Require each role to finish at `10 / 10`, require three pairwise-distinct disclosure-safe
   12-uppercase-hex SHA-256 fingerprints and require the displayed Technology value `NfcA` for
   every role. The future superseding boundary requires fully qualified
   `android.nfc.tech.NfcA`; additional or duplicated Android technologies are ignored for the
   decision and are neither displayed nor persisted. MifareUltralight alone is insufficient. No
   raw UID, payload or raw Technology list may be recorded.
4. After the thirtieth successful presentation require the exact final title
   `Alle drei Rollen stabil gebunden` and exact final text
   `A, B und X sind stabil, eindeutig und voneinander verschieden.`
5. Only after personally confirming every preceding UI observation does the trusted Human state
   exact `PASS`. The operator then enters exact `human-pass` once, requires the unique receipt
   `human_pass:match`, and only then enters exact `cleanup`.

The operator does not infer or independently attest UI truth. `human-pass` is the explicit
one-time trusted Human handoff after the runbook-bound UI sequence. It is valid only once in
`waiting`; it moves the session into a separate Human-passed state. `cleanup` from `waiting` is a
failure, and cleanup can satisfy success only from that Human-passed state. Early, duplicate,
late, foreign or out-of-order input fails closed. Exact `abort` starts the same one-time
fail/cleanup flight from every pre-completion state.

Any Cancel, timeout, safe failure stage, failure title/text, ambiguity, wrong Tag/role/order,
non-distinct fingerprint, Technology mismatch or desire to reset consumes the authority. Do not
press `Lokale Nachweise löschen`, retry, repair, resume or reuse an observation; enter exact
`abort` immediately and complete cleanup.

The catchable signals are exactly `SIGHUP`, `SIGINT`, `SIGQUIT` and `SIGTERM`. Repeated or mixed
delivery uses the same idempotent fail/cleanup flight, and all four handlers remain active until
cleanup and terminal settlement finish. `SIGKILL` and `SIGSTOP` are not catchable and are
therefore explicitly excluded from the protocol; they cannot produce a valid terminal receipt or
successful evidence.

The first finish/abort request starts one absolute deadline shared by active-operation settlement
and cleanup; every cleanup wait and ADB call is capped to its remaining budget, expiry cannot
match, and the shared text/binary ADB runner force-settles after SIGKILL grace even without child
close. `complete:match` is emitted only after Human-PASS receipt, cleanup, deadline and all prior
receipt preconditions succeed. It is terminal and can never be followed by `failed:mismatch`.
A failed path emits only terminal `failed:mismatch`, and the CLI exits nonzero. Conversely,
`complete:match` makes the CLI exit zero. This terminal result proves only the combined
Human-PASS handshake plus operator/cleanup success; it is not APK approval, a Product-Human-V5
pass or production authority.
The final post-R1-correction safe-root V3 passed 20/20 builds, 21/21 tests-inclusive typechecks,
21/21 workspace suites covering 148 test files and 2,484 passed tests with exactly two documented
optional B1 skips, migrations 001–013 apply/replay/ledger, C3B binary verification, 52/52 Mobile
test-source inclusion, the unchanged official Validation artifact verifier and Android export of
861 modules. One initial Synthetic invocation exposed only the sparse-runner omission of tracked
`.github/workflows/ci.yml`; materializing that tracked directory and executing only the affected
adapter file passed 31/31, completing the unique Synthetic matrix at 288/288 without changing
candidate bytes.
Historical formal review R1 returned `CHANGES REQUIRED` with exactly the two corrected P1
findings above. Exact-head CI `30402655381`, attempt 1, passed 12/12 on the correction.
Independent Exact-SHA re-review round 2 returned `APPROVED` with zero open P0–P3 and closed both
P1 findings. The candidate remains **DO NOT START** and grants no Phase-0, installation, ADB,
hardware or Product Human-V5 authority.

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
`android.nfc.tech.MifareUltralight` were required by that historical contract, while additional
or duplicated entries were ignored. This is superseded by the NfcA-only correction and is not a
future instruction. The exact historical replacement APK/manifest below passed
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
| Validation Phase-0 operator source/review/CI — DO NOT START | Baseline `39a6ef09fad18375af025bc8ed12cc1ea6dda964`, tree `10cdf16421fe564e1961a39d79e20775c0269fc4`; candidate `083fdfb259089d976e48f824e0862f10637d3290`, tree `24bd130500934c6a48fd9314fa06387d6ebdedcd`; exact-head CI `30402655381`, attempt 1, 12/12; independent Exact-SHA re-review round 2 `APPROVED`, zero open P0–P3; both round-1 P1 findings closed; no Phase-0, installation, ADB or hardware authority |
| Final install-category correction/review — DO NOT START | Candidate `12d1ace89494851025555d1d06d45570c4fcc4cb`; tree `b747b4306637d90765b33f273ad89291bd4ea9a7`; parent `b63641953536bb36625fcd42d850e429ddab8db3`; exact code/test delta limited to the Operator core and focused runtime test, plus four synchronized ADO truth files; V2/V3 green; exact-head V4 CI `30466798295`, attempt 1, 12/12; prior round-2 delta review and final independent Exact-Head/V4 review `APPROVED`, zero open P0–P3; round-1 P2 closed; no Phase-0, installation, ADB or hardware authority |
| Run-12 diagnostic/local Guard cleanup correction — technically closed/DO NOT START | Candidate `3a77603825db573bdabb2d4202fe7cca5383c1ed`; tree `3996b4c27d2970b99e1b407217dd269e62be72ce`; parent `3fcbcdec79dada8d43041a241127e52f4775e8d8`; V3 20/20 builds, 21/21 tests-inclusive typechecks, 21/21 suites / 2,529 passed / two expected skips plus migration/bin/artifact/export/cleanup match; exact-head CI `30479752844`, attempt 1, 12/12 without retry; independent prepublication and final Exact-SHA reviews `APPROVED`, zero open P0–P3; no Phase-0, installation, ADB, hardware or Product Human-V5 authority |
| Historical install-/launch-diagnostic predecessor/review — DO NOT START | Candidate `8ce03852e782d541319bb852f216cf596ab1787f`; tree `f5b914c1b8f1243244733808beaef54f0351a563`; parent `2f057cb4e5d096e34785c72c51340f589c711dd2`; exact eight-file +488/-132 delta; patch SHA-256 `c8418fe6382c8a23ada44254c2fdc35652acbb73a8f99983f5cbb4cc11b46984`; V1/V2 executed green; unchanged V3 carried from `496ca59`/tree `b398b89`; exact-head CI `30459539801`, attempt 1, 12/12; independent Exact-Delta/Commit/Tree/CI review `APPROVED`, zero open P0–P3; no Phase-0, installation, ADB or hardware authority |
| Historical published Phase-0 readiness candidate — DO NOT START | Candidate `496ca59f0965670b29a210b8aa2443b99bb4a386`, tree `b398b89c77f7f0b4799a7a06b11bd2daf51fd34a`; exact baseline `fa1aaa782415aceb85c0aa5c1233732ef9afa4dc`, tree `da69081517d2b0b9631eaef393b0a6022735061e`; Toybox process parsing, explicit one-time `human-pass`, deterministic terminal receipt ordering, four catchable signals and exact 30-presentation Human protocol; safe-root V3/eight-file candidate has no code finding; exact-candidate CI `30427205223`, attempt 1, failed 11/12 after job `90496143535` passed 3/3 files and 121/121 assertions but emitted later unhandled PostgreSQL `57P01` on `taptime_c3e1_dirty_*`; formal review `CHANGES REQUIRED`, exactly one P2 CI/test-reliability finding, no Product/Security finding; no retry |
| PostgreSQL test-cleanup correction — technically closed/DO NOT START | Candidate `21e518151a3f4727ebf4ce90cd1557660960ff21`, tree `8f764f9260378b631b4b026355852c324d6dc06b`; parent `d63c62de9eced5f7dd62c8c957d4c2fffce77bf9`, tree `753feedcae6724e711557e6492bbe26fa0b02083`; seven test-only files, +192/-12, delta SHA-256 `b0406bc02a085649060b3dfdb263db00694e501efbe1c247f3ba49fec3cb53e2`; V1 2/2, V2 B3 128/128 + C3B 60/60 + C3C/C3E1 102/102 and three tests-inclusive typechecks passed; unchanged green V3 carried from `496ca59`; exact-head CI `30429746848`, attempt 1, 12/12 without retry; independent source/delta and final Exact-SHA/V4 reviews `APPROVED`, zero open P0–P3; historical P2 closed; no hardware authority |
| `DA5-V5-VAL-TECH-01` candidate APK — DO NOT INSTALL | `/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-validation/da5-v5-validation-03694f2d877b-d2084486b07f27bd/app-release-d2084486b07f27bd.apk`; 65,631,433 bytes; mode `0444`; SHA-256 `d2084486b07f27bdbd72f9f32e38531f8de31dad18ef4789cab2ec44135e05f5`; official verifier `PASS`; independent Source/Artifact Exact-SHA review `APPROVED`, zero open P0–P3 |
| `DA5-V5-VAL-TECH-01` candidate manifest — DO NOT INSTALL | Same directory, `manifest-03694f2d877b.json`; 6,700 bytes; mode `0444`; SHA-256 `aa2a243cd4f81ead806c43e27d6f9c12c28e396db64fe556d8ddf02a8d52f347`; all 32 source-closure entries matched; independent Source/Artifact Exact-SHA review `APPROVED`, zero open P0–P3 |
| `DA5-V5-VAL-TECH-01` package/security boundary | `com.tim180201.mobile.validation`; versionCode `1`; versionName `1.0.0`; `local-validation-only`; one v2 signer with certificate SHA-256 `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`; NFC-only; no network permission; cleartext denied; backup/transfer denied; no Product deep links or Tag dispatch; required native modules present, forbidden modules absent; Validation marker present and Product runtime marker absent |
| Historical `e97bbe9` Validation source/review/CI — DO NOT INSTALL | `e97bbe9e2a281099899e2ecb3aad2588ef20f22d`; tree `2958f456875e8dab3f10834df280e10a8438efce`; exact-head CI `30370977809`, attempt 1, 12/12; Round-2/Round-3 source reviews and formal Source/Artifact Exact-SHA review `APPROVED`, zero open P0–P3 |
| Historical `e97bbe9` Validation APK/manifest — DO NOT INSTALL | Directory `/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-validation/da5-v5-validation-e97bbe9e2a28-810b856ff7113b4f`; APK `app-release-810b856ff7113b4f.apk`, 65,629,505 bytes, mode `0444`, SHA-256 `810b856ff7113b4f2a454007595e1b6c1ae5dc69c601a2120b577f124e213e28`; manifest `manifest-e97bbe9e2a28.json`, 6,700 bytes, mode `0444`, SHA-256 `af53d646558449a7a5c907fbdf59e3366c6ffd2755f6049141db8e567549e051` |
| Historical Validation APK — DO NOT INSTALL | `/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-validation/da5-v5-validation-7e8c0f7742e6-303bfd33cf7fa000/app-release-303bfd33cf7fa000.apk`; 65,626,753 bytes; mode `0444`; SHA-256 `303bfd33cf7fa000ee808a048f91883c18dbfe85c1ba359d3f0764ac7ae7f2f8` |
| Historical Validation manifest — DO NOT INSTALL | Same directory, `manifest-7e8c0f7742e6.json`; 6,700 bytes; mode `0444`; SHA-256 `11c1664cee37caa8b093a9023f571e3b8733e8bb078bf7f78b6f20d8f39388a7` |
| Historical `03694f2` package/runtime — DO NOT INSTALL | `com.tim180201.mobile.validation`; signer `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`; `local-validation-only`; historical `NfcA+MifareUltralight`; exact roles A/B/X; exactly one active installed provider from `com.google.android.marvin.talkback` or `com.samsung.android.accessibility.talkback`; none or both fail closed; exactly one queries block with those two package queries, one exact `VIEW` + `BROWSABLE` + `https` intent and zero providers; no Product deep link or Tag dispatch |
| Historical native/source verification — DO NOT INSTALL | Correction `7e8c0f7742e6407b8917205fd337a552f7dec714`, tree `3e4d1356b859fecf70d365fecbb563e2088100f3`; exact-head CI `30284566289`, attempt 1, 12/12; exact 2,032,807-byte executable Metro bundle SHA-256 `e4caf2db73cfbcdaf779f337bf3a3f99e95d182950522323052bc31ae10c93d3`; exact 555-source/2,667,064-source-byte closure SHA-256 `29691fc137c63906e5cf0c5cd47e2df0643064ab6dbddc00e0d3ec467d492ed3`; independent correction re-review and Artifact Exact-SHA review each `APPROVED`, zero open P0–P3; official artifact verifier `PASS`; superseded for installation by DA5-V5-VAL-UI-01 source correction |
| Device, accessibility and A/B/X fingerprints | `UNBOUND — DO NOT START` |
| One-time Phase 0 authorization/result | `RUN 1 CONSUMED — PREINSTALLED PACKAGE`; `RUN 2 CONSUMED — SAMSUNG PROVIDER UNSUPPORTED BY PRIOR BUILD`; `RUN 3 CONSUMED — GENERIC RESOLVER DID NOT UNIQUELY START EXPLICIT ACTIVITY`; `RUN 4 CONSUMED — EXPLICIT MAINACTIVITY COLD START FAILED MISSING EXPOASSET`; `RUN 5 CONSUMED — EXACT APK/DEVICE CHECKPOINT PASSED, THEN GENERIC FAIL-CLOSED SCAN PATH`; `RUN 6 CONSUMED — EXACT e97bbe9 APK/DEVICE CHECKPOINT PASSED, THEN FIRST A-SCAN SHOWED ONLY GENERIC FAIL-CLOSED STATE`; `RUN 7 CONSUMED — EXACT effc57a APK/DEVICE CHECKPOINT PASSED, THEN FIRST A-SCAN STOPPED AT SAFE technology_evidence`; `RUN 8 CONSUMED — EXACT 03694f2 APK INSTALLED, THEN LEGITIMATE ANDROID-15 ~ PATH REJECTED BEFORE MAINACTIVITY LAUNCH`; `RUN 9 CONSUMED — artifact:match, preflight:match, install_launch:mismatch, cleanup:match, failed:mismatch; NO SCAN/UI HANDOFF AND EXACT CAUSE NOT RECONSTRUCTABLE`; `RUN 10 CONSUMED — artifact:match, preflight:match, installation/operation_mismatch, install_launch:mismatch, cleanup:match, failed:mismatch; NO installed_provenance OR UI/NFC/TAG STEP; EXACT CAUSE NOT RECONSTRUCTABLE BECAUSE PRE-INSTALL VERIFICATION WAS SUMMARIZED BY THE SAME CATEGORY`; `RUN 11 CONSUMED — BASELINE d8549c3/TREE 04ea2d0; artifact:match, preflight:match, stage=installation status=mismatch category=operation_mismatch, install_launch:mismatch, cleanup:match, failed:mismatch; NO installed_provenance OR UI/NFC/TAG STEP`; `RUN 12 CONSUMED — BASELINE 3fcbcdec/TREE 74cac3e; artifact:match, preflight:match, stage=installation status=mismatch category=adb_child_transport_mismatch, install_launch:mismatch, cleanup:match, failed:mismatch; NO installed_provenance OR UI/NFC/TAG STEP`; `RUN 13 CONSUMED — BASELINE 63feaf48/TREE 1d63595; artifact:match, preflight:match, stage=installation status=mismatch category=adb_child_transport_mismatch, install_launch:mismatch, cleanup:match, failed:mismatch; NO installed_provenance/WAITING/UI/NFC/TAG STEP`; runs 5–13 have no attributable Tag result and prove no hardware defect; runs 10–13 establish no Product/APK finding; run-7 physical `techTypes` remain unknown; no current authority |

| Later Phase 0 results | `RUN 14 CONSUMED — BASELINE 8878019/TREE 5c15f0f; OPERATOR-SESSION artifact:mismatch, cleanup:match, failed:mismatch BEFORE PREFLIGHT/ADB/INSTALLATION`; `RUN 15 CONSUMED — SAME BASELINE; OFFLINE ARTIFACT MATCH, THEN artifact:match, preflight:match, stage=installation status=mismatch category=adb_stdin_pipe_abort_mismatch, install_launch:mismatch, cleanup:match, failed:mismatch; NO installed_provenance/WAITING/UI/NFC/TAG STEP`; `RUN 16 CONSUMED — artifact:match, preflight:match, install_launch:match, waiting:match, HUMAN-CONFIRMED DEVICE BINDING, FIRST TAG-A technology_evidence, abort, cleanup:match, failed:mismatch; NO ACCEPTED FINGERPRINT/B/X/HUMAN PASS/RETRY`; runs 5–16 have no successful attributable Tag result and prove no hardware defect; run 16 supersedes the old Product/Validation/Operator installability assumptions; no current authority |

**Later Product Human V5** remains the separate run described below. None of the sixteen consumed
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
