# Development Assignment 5 — Lean Stage-6 Hardware Publication Closure

## Fast-flight publication closure — implementation candidate / STOP

Exact authority source is published commit
`9032581b1cb13b4a44f575aaface8a87989f4932`, tree
`03c06109a622e666d693ad9f28785ad834f4e663`. The fast-flight policy is active, but the new Flight
Package remains an uncommitted R3 implementation candidate until final V1/V2/V3, independent
implementation review, focused publication, V4 and exact runtime/artifact review complete.
No current Operator, ADB, installation, Product, Hardware, production, deployment or distribution
authority exists.

Publication must bind the Supervisor/child bundles and maps, immutable plan digest, exact source
delta, tests-inclusive typechecks, V1/V2/V3 evidence and the single Event-Ledger pointer. It must
not duplicate historical narrative or convert a test receipt into Physical evidence. Historical
correction-2 terminal truth below stays latest: authority consumed, no retry/resume/relogin/
replacement. The next Human/Hardware authorization, if any, must separately cite the final exact
reviewed head and binding set.

### Current verification and publication boundary (`2026-08-14`)

The independently approved pre-amendment candidate is tree
`b775c248bb268e91b141c62361b47614f38934a5`, full 18-path patch 212,896 bytes / SHA-256
`155bb35851508e30bed6c3b2908c8b410845ddd6fabc3bd795016bd0ed744cc1`. Fresh V2 passed:
Synthetic 16 files / 384 passed / 19 expected DB skips, Mobile 1 file / 120 passed, both
tests-inclusive typechecks, fresh build and exact bundle checks.

V3-A is consumed `FAIL_CLOSED` after D01/D02, 11 DB, 27 migrations, 20 builds, all 21
memberships/typechecks/suites (155 files; 3,040 passed / zero failed / three expected skips) and
C3B passed. The next no-install preflight failed because the runner omitted exact
`TAPTIME_SYNTHETIC_E2E_PROFILE=da5-v5`, which repository source requires. No ADB, install,
Product or Hardware action occurred; cleanup passed. Immutable evidence root
`v3-fast-b775c248-failed-profile-20260814T0049Z` is `0555` with 78 manifest-bound payload files
plus `evidence-manifest.txt` = 79 regular files total; receipt SHA-256
`d13dae77c997167962ac31c843e8ee22f904001957c25db0143dceb88c61fb75`; manifest SHA-256
`36d1172e26f330d12d3990a29e0e0bd31e42adc0fd80b71c09be373773fb79f1`. This is a runner
configuration failure, not a code/Product finding.

Independent ADO review `APPROVED` is prerequisite to exactly one new fresh V3-B on this
amendment's resulting exact tree/patch. V3-B reruns full V3 from D01 with no V3-A execution reuse.
Its preflight proves the exact unchanged minimal sanitized V3 environment. The established
read-only no-install gate binds candidate-checkout CWD exactly as
`/Users/timbartz/Dokumente/GitHub/taptime`, records exact CWD/argv plus raw output/return code and
directly invokes exactly once:
`/usr/bin/env TAPTIME_SYNTHETIC_E2E_PROFILE=da5-v5 /Users/timbartz/.nvm/versions/node/v24.17.0/bin/node apps/mobile/scripts/da5V5AndroidNoInstallPreflight.mjs`.
The helper is the direct child of D01-bound absolute Node `24.17.0`; no package lifecycle, bare
`node`/`npm`/`npx`, conflicting profile/DB-credential/secret variable, ADB or installation is
allowed. Failure consumes V3-B without retry; green V3-B requires independent review. Publication
and every Human/Hardware gate remain closed.

Status: **R0/V0 CORRECTION-2 CLOSURE CANDIDATE — PREPUBLICATION REVIEW 3 REQUIRED / AUTHORITY CONSUMED / STOP**

Owner: Technical Lead

Physical approval authority: Human Architect

Marker: `DA5-V5-ABORT-BEFORE-PREVIEW2-CORRECTION2-2026-08-13`.

## Current exact correction-2 closure

This section supersedes correction 1's inaccurate child-TMP relationship, its overbroad no-entry
wording and every conflicting generic task-state, immediate-cleanup, queue or clean-working-tree
assertion. Terminal classification remains **`FAIL_CLOSED / HUMAN ORDER DEVIATION BEFORE PREVIEW
2; LATER CURRENT STATE CLEAN`**, never Product PASS and no Product-defect finding. Authority `E`
is consumed; no retry, resume, relogin or replacement run is authorized.

Executable `M` `9380758f3e149718c8c0b8d34a1818de64c0d8d1`, exact
`apps/synthetic-android-e2e/src/da5V5Main.ts:232-237`, passes
`temporaryBase: '/private/tmp'`; Guard mkdtemp therefore creates `/private/tmp/.t5-*` directly,
not beneath an additional child TMP base. The immutable historical roots remain byte-exact:

- original root
  `/Users/timbartz/Dokumente/GitHub/taptime-local-evidence/da5-v5/hardware-42b330a-abort-before-preview2-20260813`
  is `0555`: `receipt.txt` 3,825 bytes / `0444` / SHA-256
  `98e7278983dce827133cddcdfb3cb1617b6b072179ad39e93f6ea44ab3221f94`; manifest 1,827 bytes /
  `0444` / SHA-256 `db24eb313181a64f488becf552c0fd9d70583e375a7f79d17c5ca357afae3813`;
- correction-1 root
  `/Users/timbartz/Dokumente/GitHub/taptime-local-evidence/da5-v5/hardware-42b330a-abort-before-preview2-20260813-correction1`
  is `0555`: `correction-receipt.txt` 3,155 bytes / `0444` / SHA-256
  `fd94e071d611ff7c08b1220b85d8aad740e3f750cd6edffe2f687f4443dcee81`; manifest 1,831 bytes /
  `0444` / SHA-256 `1a453bfa8474462a13fda346b76e78daa82f007154c8545fcc887e300c6d0da8`.

Neither historical root was changed. Correction 1's child-base description is not exact source
truth, and its no-entry wording is not bound by its sealed bytes because the type-filter-free
recheck occurred only after correction 1 was sealed, after Review. New immutable correction-2
root
`/Users/timbartz/Dokumente/GitHub/taptime-local-evidence/da5-v5/hardware-42b330a-abort-before-preview2-20260813-correction2`
is `0555`, containing exactly `correction-receipt.txt` 3,549 bytes / `0444` / SHA-256
`da712709ab51016a822b6eb3a282a89f038f6ebaf64a533bcae008c9e1064b4a` and
`evidence-manifest.txt` 3,014 bytes / `0444` / SHA-256
`6e3b86c39df0200e276a3b6993de199ad059642197e0d11de0ea2ddfe78f9c5d`.

Correction 2 binds only the Technical-Lead-reported later read-only check after Review:
`current_cleanup_correction2=MATCH`; a max-depth-one name check for `/private/tmp/.t5-*` without
a file-type filter found no entry; bound Guard and `/private/tmp/.t5-*/run-*/data` PostgreSQL
processes were zero; owned ports 3000/54321/55435 were zero; exact Product
package/process/reverse mappings were absent; Operator process was zero; standard profile matched
at font scale 1, accessibility 0 and services null. The staged index was clean while the working
tree was intentionally dirty with this exact eight-ADO-path candidate; no clean repository or
working tree is claimed. This proves only later current state, never immediate abort cleanup.
Queue remains unobserved and unclaimed.

Exact candidate scope remains only these eight existing ADO paths: `ADO/README.md`,
`ADO/00_Core/Project_Status.md`, `ADO/00_Core/Risk_Register.md`, `ADO/00_Core/Decision_Log.md`,
`ADO/04_Operations/Development_Assignment_05_V5_Lean_Hardware_Flight_Card.md`,
`ADO/04_Operations/Development_Assignment_05_V5_Runbook.md`,
`ADO/05_Evidence/Development_Assignment_05_V5_Evidence.md` and this file. Change impact is
non-executable documentation only; AVS classification is R0/V0. Review 3 must examine this exact
candidate. No Product test, Typecheck, build, V3/V4, CI, ADB, Hardware, commit or push is run or
authorized. Publication and every later exact-head/Human gate remain STOP.

## Preserved exact correction-1 closure

Marker: `DA5-V5-ABORT-BEFORE-PREVIEW2-CORRECTION1-2026-08-13`.

This preserved correction-1 section is superseded by correction 2 above. Its terminal
classification is
**`FAIL_CLOSED / HUMAN ORDER DEVIATION BEFORE PREVIEW 2; LATER CURRENT STATE CLEAN`**, never
Product PASS and no Product-defect finding. Authority `E` is consumed; no retry, resume, relogin
or replacement run is authorized.

The original immutable `0555` Evidence root
`/Users/timbartz/Dokumente/GitHub/taptime-local-evidence/da5-v5/hardware-42b330a-abort-before-preview2-20260813`
remains historical flawed Evidence: receipt
3,825 bytes / `0444` / `98e7278983dce827133cddcdfb3cb1617b6b072179ad39e93f6ea44ab3221f94`;
manifest 1,827 bytes / `0444` /
`db24eb313181a64f488becf552c0fd9d70583e375a7f79d17c5ca357afae3813`. Its generic task-state
and every queue-zero/no-queue-event claim are not independently bound and are superseded. The
original task-root check covered only repository-local `.t5-*`; correction 1 inaccurately
described an exact bound child TMP base, while correction 2 binds direct `/private/tmp/.t5-*`.
`da5_v5_aborted` precedes cleanup. Complete cleanup immediately after abort cannot be
reconstructed and remains unverified.

New immutable `0555` correction root
`/Users/timbartz/Dokumente/GitHub/taptime-local-evidence/da5-v5/hardware-42b330a-abort-before-preview2-20260813-correction1`
contains exactly correction receipt
3,155 bytes / `0444` / `fd94e071d611ff7c08b1220b85d8aad740e3f750cd6edffe2f687f4443dcee81`
and manifest 1,831 bytes / `0444` /
`1a453bfa8474462a13fda346b76e78daa82f007154c8545fcc887e300c6d0da8`. It binds two
separately timed Technical-Lead-reported read-only later current-state checks: package/process
absent, owned mappings empty, standard profile `MATCH`, Operator absent and a historical
tracked/staged-clean report; then `current_guard_cleanup=MATCH` and the listed
Guard/PostgreSQL/owned-port checks. Correction 2 supersedes correction 1's child-base and
no-entry scope. This proves only later current state and cannot reconstruct immediate post-abort
cleanup. The status schema has no queue field, the queue
checkpoint was not reached and no machine queue Evidence exists; queue state/event is not
observed or claimed.

Candidate status remains R0/V0 correction-only and requires renewed independent prepublication
review of these exact eight ADO paths. No Product test, Typecheck, build, V3/V4, CI, ADB,
Hardware, commit or push is run or authorized. Publication and every later exact-head/Human gate
remain STOP.

## Preserved predecessor exact Human-order-deviation closure

Marker: `DA5-V5-ABORT-BEFORE-PREVIEW2-CLOSURE-2026-08-13`.

This section supersedes later conflicting current/scope/authority statements and preserves them
as history. Baseline is exact published `E`
`42b330a1ea700169d7adcd1c3bf54e3dfb868d0a` / tree
`21aad9fa3e0dd7de1d87c66fdaaba8ee0cdc6a92`, parent `C`
`33a1d70c06b0275c59be20bf9d5afc4c8af44767`.

Fresh read-only preflight and exact name-only child-environment checks matched. Operator/device/
install receipts, Administrator Credential/login, initial zero state, first Tag-A-to-Customer-A
setup and exact post-setup reattestation reached the boundaries recorded in the V5 Evidence. The
reattestation proved one active Tag-A and Customer-A assignment plus one setup receipt, with zero
lifecycle/NFC/manual/time state; it did not prove queue state.

Before mandatory Admin Setup Preview 2, the Human reported an accidental sign-out. It is an order
deviation, not a machine receipt. Relogin was forbidden. Ordinary-idle `abort` ran exactly once,
emitted `da5_v5_aborted` and exited 1. Correction 1 binds only later current state, not immediate
cleanup. Classification is **`FAIL_CLOSED / HUMAN ORDER DEVIATION BEFORE PREVIEW 2; LATER CURRENT
STATE CLEAN`**, never PASS and no Product defect. `E` authority is consumed; no retry, resume,
relogin or replacement run is authorized. No lifecycle/time event was observed at reached
machine checkpoints; queue state/event is unobserved and unclaimed. Preview 2, Employee, Tags
B/X, Gates B–F and Accessibility did not occur.

Immutable disclosure-safe root
`/Users/timbartz/Dokumente/GitHub/taptime-local-evidence/da5-v5/hardware-42b330a-abort-before-preview2-20260813`
is mode `0555`: receipt 3,825 bytes / `0444` / SHA-256
`98e7278983dce827133cddcdfb3cb1617b6b072179ad39e93f6ea44ab3221f94`; manifest 1,827 bytes /
`0444` / SHA-256 `db24eb313181a64f488becf552c0fd9d70583e375a7f79d17c5ca357afae3813`.
Human-reported facts are distinct from machine receipts/later current-state checks. The original
generic task-state and queue claims are superseded by correction 1.

Exact candidate scope is only these eight existing ADO paths: `ADO/README.md`,
`ADO/00_Core/Project_Status.md`, `ADO/00_Core/Risk_Register.md`,
`ADO/00_Core/Decision_Log.md`,
`ADO/04_Operations/Development_Assignment_05_V5_Lean_Hardware_Flight_Card.md`,
`ADO/04_Operations/Development_Assignment_05_V5_Runbook.md`,
`ADO/05_Evidence/Development_Assignment_05_V5_Evidence.md` and this file. Change impact is
non-executable documentation only: no source, configuration, schema, dependency, lockfile, test,
workflow, runtime or artifact input changed. AVS classification is R0/V0. Product tests,
Typechecks, builds, V3/V4, CI, ADB, Hardware, commit and push are not run or claimed.

Candidate V0 at handover is `PASS`: `HEAD`, tree and parent match the exact refs above; scoped
tracked diff names are exactly these eight paths; the scoped index is empty; `git diff --check`
exits 0; all eight references exist; no mode change or executable delta is present; both original
immutable Evidence files and both correction Evidence files re-match their recorded sizes, modes
and SHA-256 values; and the correction root contains exactly those two files. No V1–V5, Product
suite, Typecheck, build, CI, ADB or Hardware check was executed for this R0 delta.

## Preserved prior startup-environment closure

Marker: `DA5-V5-STARTUP-ENV-FAILURE-CLOSURE-2026-08-13`.

## Current exact failure closure and publication gate

This section supersedes later conflicting current/scope/authority statements and preserves them as
history. Baseline is published `C` `33a1d70c06b0275c59be20bf9d5afc4c8af44767` / tree
`ce4c62cf64f8bfe6a1891813e6a9fadec3168af5`. Executable `M`
`9380758f3e149718c8c0b8d34a1818de64c0d8d1`, corrected V3, CI `31695047997`, final r4 runtime
and APK 95,526,563 bytes / `0444` / SHA-256
`b02fdb2544225d03e3142fa30f12caa8fedf889a558b39cc040cca03f9539234` remain unchanged.

The exact one-time authority was consumed by one r4 invocation. Fixed nonsecret wrapper `LANG`
was rejected before PostgreSQL owner creation by exact source lines 712/1830 and r4 bundle line
2183. Terminal exit was 1 after about 0.23 seconds; sole output `da5_v5_start_failed`; no
`da5_v5_ready`; no retry. Immediate task/listener/package/process/mapping null and standard-profile
continuity matched. No database/runtime/install/Product/NFC/Tag/accessibility mutation occurred.
Classification: **`FAIL_CLOSED AND CLEAN / STARTUP-ENV WRAPPER`**, not Product defect; no
executable correction required.

Immutable `0555` Evidence root
`/Users/timbartz/Dokumente/GitHub/taptime-local-evidence/da5-v5/hardware-33a1d70-startup-env-failure-20260813`
contains receipt 4,317 bytes / `0444` /
`bf5608695d6d3e495ecb09a6b2203da82335e9b982e12e3966383c29f32262c0` and manifest 1,446 bytes /
`0444` / `ed4b507d512f7f65a3bae0ad8bbdc46dba48c72df1f1cd389c13ebe536b85506`.
The observed sequence is Technical-Lead-reported, not raw transcript; exact start time was not
independently preserved.

Exact candidate scope is only these eight existing ADO paths: `ADO/README.md`,
`ADO/00_Core/Project_Status.md`, `ADO/00_Core/Risk_Register.md`, `ADO/00_Core/Decision_Log.md`,
`ADO/04_Operations/Development_Assignment_05_V5_Runbook.md`,
`ADO/04_Operations/Development_Assignment_05_V5_Lean_Hardware_Flight_Card.md`,
`ADO/05_Evidence/Development_Assignment_05_V5_Evidence.md` and this file. AVS classification is
R0/V0: no executable, configuration, schema, dependency, lockfile, test, workflow, runtime or
artifact delta. Product tests, Typechecks, builds, V3/V4, CI, runtime/APK generation, ADB and
Hardware are neither required nor authorized.

Required sequence: independent prepublication review of the exact eight-document candidate → one
focused `[skip ci]` publication at intentionally unknown future `E` → independent exact-head
read-only review binding `E`, the exact eight paths/blobs/delta and carried M/r4/APK evidence →
**STOP** → fresh one-time Human authority. No post-publication self-hash edit is required. The old
authority grants no restart, resume or replacement.

Any future start uses the Runbook's allowlisted child environment and pre-Node name-only
predicate/receipt. It must prove exact platform-tools/system `PATH`; only required identity/temp,
exact Android roots and exact Operator `TAPTIME_*` names; and absence of all locale,
PostgreSQL/database-credential, ADB-control and other unlisted names. It records no values,
credential, digest, serial or personal data and stops before Node on mismatch.

## Preserved prior technical closure candidate

Marker: `DA5-V5-PRE-HARDWARE-CLOSURE-M-2026-08-13`.

## Current exact technical closure truth

This section supersedes every conflicting binding or scope statement later in this file. Historical
failures remain retained and non-reusable; they are not relabeled as PASS.

| Boundary | Exact closure binding |
|---|---|
| Executable | `HEAD == main == origin/main == M` `9380758f3e149718c8c0b8d34a1818de64c0d8d1` / tree `3c3b566124cf8c7ccd7727faf3a8aa76231f20f7` |
| Parents / merge delta | First parent `B` `489a853e1af45e60bab0b94bcce05d674f6af700`; second parent `D` `cc6767d118a66e7926b2a5c2a457684695d05d45`; `M` versus `B` exactly five ADO paths |
| Exact M-vs-B paths | `ADO/00_Core/Decision_Log.md`; `ADO/00_Core/Project_Status.md`; `ADO/00_Core/Risk_Register.md`; `ADO/02_Development/Development_Assignment_05_V5_Final_V3_Sequencing_Correction_Authorization.md`; `ADO/README.md` |
| A→B artifact hardbinding delta | Ordinary `git diff --binary A B` is 10,441 bytes / SHA-256 `d430d51edf2459f37b96f6634611ad6092d9aa23330ec923da15e7dc2fc55127`; canonical `git diff --full-index --binary A B` is 10,705 bytes / SHA-256 `b875bc186f2e218f608c69d2ebe579fc580e363664fd5efb6135c7961931610a` |
| B→M first-parent merge delta | Ordinary `git diff --binary B M` is 23,453 bytes / SHA-256 `f11c8f1fc6ac7a11d9f23514a6b5a2a70e4aac0a3714096012de9c50f70c84c6`; canonical `git diff --full-index --binary B M` is 23,783 bytes / SHA-256 `1b277ac1dc786944ec48fd22f1875d9d7db6afaeb37f5a02d9af8f7a4df19b1c` |
| D→M second-parent merge delta | Ordinary `git diff --binary D M` is 116,666 bytes / SHA-256 `6fd0a85e22c34a576a6bce802e693169857def5bf1cdcbc0b4d2c6c49341feb6`; canonical `git diff --full-index --binary D M` is 117,788 bytes / SHA-256 `5fbbda1bfa52d318d7986cf74d5a91eea5547dcd07524123dddb80e8429c46dd` |
| R4 manifest recipe audit | The final R4 runtime manifest named below is the canonical runtime binding for all six recipe/byte/SHA-256 tuples above; its independent Round-4 review returned `APPROVED`, zero open P0–P3 |
| Corrected V3 | Independently `APPROVED`, zero findings; 20/20 builds; 21/21 tests-inclusive Typechecks; 21/21 suites; 153 files; 3,026 pass, zero fail and three named expected skips; migrations, additional gates, Expo/artifact and cleanup passed |
| V3 evidence | `/Users/timbartz/Dokumente/GitHub/taptime-local-evidence/da5-v5/v3-9380758-corrected-4r21J4`; receipt 4,366 bytes / `0444` / SHA-256 `227b4a7e0028a85067ba5a22089ba201e4d678210a310ec6062279a446cbd2bc`; manifest 10,540 bytes / `0444` / SHA-256 `cc3299d4df6de04afb26aa9d834fab93f9eb105c4d8b3bb7833c43538379b2ae` |
| Exact-head CI | `31695047997`, attempt 1, exact `M`, 12/12 successful, no retry |
| Source-A Product artifact | Root `/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5/lean-03e0e48a-b02fdb2544225d03`; APK 95,526,563 bytes / `0444` / SHA-256 `b02fdb2544225d03e3142fa30f12caa8fedf889a558b39cc040cca03f9539234`; 59-LF-field manifest 1,968 bytes / `0444` / SHA-256 `91725bb6f14306eb40d0e4414f38511fc829250799af91bacf840ac622efc577` |
| Product identity/security | `com.tim180201.mobile.synthetic`, versionCode `1`, versionName `1.0.0`; v2 true and v1/v3/v3.1/v4 false; one `local-synthetic-non-production` signer certificate `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`; backup/cleartext/offline exclusions, NfcA and one-Hermes/runtime-contract bindings exactly per full manifest |
| Final Round-4 Operator runtime | `/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-product-operator/9380758f-f06a1b50-r4`; final independent `APPROVED`, zero open P0–P3 |
| Runtime manifest | 16,492 bytes / `0444` / SHA-256 `8a179bf8ef7dd206f6095d4d1248780062fe3a7d8db78d45276dbf356b95609d` |
| Runtime entry / map | Entry 935,974 bytes / `0444` / SHA-256 `f06a1b508369fc525e562485f7a08bd5b1174034d0554cdb5174b3bbf3ef70d5`; map 1,739,281 bytes / `0444` / SHA-256 `aba65ced7deb7aa6a44809cc2fef33e202c0157b3056cd00324911e7890dc30a`, version 3, no `sourceRoot`, 90/90/90 |
| Runtime dependencies | Hidden lock 328,432 bytes / `0444` / SHA-256 `9c6a9279f40fd88e2e958db388595b3b3575fb3dcb49c436562a83444d8bf0c4`; Node `24.17.0` / binary SHA-256 `f5f9b9db4d95f5e0340982685f083de654c21eef9d9122cab5321081ccaa2601`; npm `11.13.0` CLI 54-byte SHA-256 `8e5f6f3429f8cdbe693cdc29904e9d5a7b127a494bd15c804bd54c7403bfcbe7` |
| Runtime correction provenance | R1 rejected for npm-hash transcription; r2 closed it but closure review found the A→B recipe label; r3 fixed A→B but formal re-review found remaining B→M/D→M labels; r4 exhaustively binds ordinary plus full-index recipes for all three pairs, reused reviewed bytes without rebuild and passed final Round-4 review |
| Authorization disposition | Fresh-artifact rebinding and final-V3 sequencing authorizations are fulfilled/superseded by this closure |
| Physical history | The consumed Hardware failure stays historical/non-reusable. Its actual root cause is not positively proved; machine `READY` identifiers, the real lifecycle regression and safe abort close only the technical gap, not a physical PASS |

## Exact R0 publication scope and gate

This candidate modifies exactly these ten existing ADO paths and creates no file:

1. `ADO/README.md`
2. `ADO/00_Core/Project_Status.md`
3. `ADO/00_Core/Risk_Register.md`
4. `ADO/00_Core/Decision_Log.md`
5. `ADO/02_Development/Development_Assignment_05_V5_Fresh_Artifact_Rebinding_Authorization.md`
6. `ADO/02_Development/Development_Assignment_05_V5_Final_V3_Sequencing_Correction_Authorization.md`
7. `ADO/04_Operations/Development_Assignment_05_V5_Runbook.md`
8. `ADO/04_Operations/Development_Assignment_05_V5_Lean_Hardware_Flight_Card.md`
9. `ADO/05_Evidence/Development_Assignment_05_V5_Evidence.md`
10. `ADO/05_Evidence/Development_Assignment_05_V5_Lean_Hardware_Publication_Closure.md`

AVS-001 classification is R0, V0 only. No executable, configuration, schema, dependency,
lockfile, test, workflow, runtime or artifact input changes. No npm, build, test, Typecheck,
V3/V4, CI, ADB, install or Hardware action is run for this documentation delta.

Required order is: independent prepublication review → focused commit/push of only these ten files
as future closure head `C` → independent exact-head read-only review. `C` is intentionally unknown
and this candidate must not invent it. The exact-head review must bind `C` commit/tree, the exact
ten-file delta and blobs, `M`/tree/lineage, CI, corrected V3 evidence, APK/manifest, R4 runtime
manifest/entry/map and Node/toolchain, and reconfirm no non-ADO delta. No second Flight Card and no
post-publication ADO self-hash edit is required.

After that exact-head review, **STOP**. A new one-time Human authorization must quote the reviewed
`C` commit/tree and exact ten-file delta/blobs, `M`/tree/lineage, CI, V3 evidence, APK/manifest,
runtime manifest/entry/map, Node/toolchain and the private device/Tags/ports/mappings/Guard/
Credential binding. It must not place a secret, raw UID or serial in ADO. Until then there is no
ADB, installation, Operator device run, Hardware or Product-Human authority.

## Boundary

This ADO-only candidate closes the publication truth of the Lean Stage-6 pre-Hardware package. It
does not authorize Operator execution, ADB, installation, Hardware, Human V5, production,
production data, production signing, deployment or distribution. It records no secret, device
UID/serial, raw NFC UID/payload, raw Product data or personal data.

The candidate deliberately does not predict or embed its own future commit/tree. After
independent candidate approval it may be focusedly committed and pushed; only a subsequent
independent exact-head read-only review may bind the actual published closure commit/tree. No
further ADO mutation is required solely to insert that self-identity.

## Historical predecessor preparation truth — superseded by the current closure above

| Boundary | Exact published result |
|---|---|
| Preparation HEAD | `HEAD == main == origin/main == 3a0469ac1d0c9d781e49648a73bc9ef019423c8e`; tree `4521f179bbae8867c6776d643679cce32658c979` |
| Parent | `2d0cbd01ce483987c375eeee9ecc49f37e2185f8`; tree `840fd156fe46614adf9d1bec2a018a2c6b453c1c` |
| Exact preparation delta | Nine ADO files; 405 insertions and 63 deletions; Full Binary Diff SHA-256 `b98c6fcb424cf2fda31748efa2b0ce5b79f77bdc0da1e1a32364ae9f48efaf52` |
| Prepublication review | Corrected candidate independently `APPROVED`, zero open P0–P3 |
| Classification | AVS-001 R0, documentation-only; no executable/runtime/artifact input delta; this publication is not the Product CI source |

The exact nine-file preparation scope was:

1. `ADO/01_Architecture/ADR/ADR-0019-lean-v5-verification-profile.md`
2. `ADO/00_Core/Decision_Log.md`
3. `ADO/00_Core/Project_Status.md`
4. `ADO/00_Core/Risk_Register.md`
5. `ADO/02_Development/Development_Assignment_05_V5_Harness_Artifact_Closure_Authorization.md`
6. `ADO/04_Operations/Development_Assignment_05_V5_Runbook.md`
7. `ADO/05_Evidence/Development_Assignment_05_V5_Evidence.md`
8. `ADO/README.md`
9. `ADO/04_Operations/Development_Assignment_05_V5_Lean_Hardware_Flight_Card.md`

## Prepared governing files at `3a0469ac`

| File | Git blob | Bytes | SHA-256 | Mode |
|---|---|---:|---|---|
| Flight Card | `657eb575c23e7b41b1a1e40593e48bd283b24796` | 10,846 | `6cfacd144c780876a2ed2cc41ac93c8de76c5cb3c64523c52f444f79c3c23627` | Git `100644`; working `0644` |
| Runbook | `9827a27afc8882fe29dbfb20433035f1b3b9b321` | 213,251 | `c720934e872af8b4d228521467fe39a27b2f1df9f97065f97f0d2520a56ce19a` | Git `100644`; working `0644` |
| V5 Evidence | `7477234fa17820ddf8c847bbb22122b7a0d7a0ee` | 260,193 | `372372993ad27ed3f39f923402e1b8c8cebf017dfbf553d1cf419ff2dfacd3eb` | Git `100644`; working `0644` |
| Project Status | `4b1ce546c5288c1b9bb07c093ee282193cdd13ae` | 253,688 | `5cef76333e37326486fcf7e4d041f7d47e2546bd6a4a55be7d593343dc3d4afc` | Git `100644`; working `0644` |

These are the exact prepared versions in the published baseline. The governing live procedure
versions will instead be the exact blobs present in the later independently reviewed published
closure head.

## Carried Product, runtime and artifact Evidence

No Product verification is rerun for this R0 closure. The full exact bindings remain controlling
in the Flight Card and `Development_Assignment_05_V5_Evidence.md`; key carried identities are:

- ADR-0019 publication `83635335aa4f547dc8994243c604dacf9797f593` / tree
  `40b7655a94e607b8afe19f90f42a95f42ee6d582`; Lean closure
  `1b341d83592ea457c8ca722d01bfa2e64fe8cc40` / tree
  `2db756832a81f07cdb1a927ff3076320cc253960`; CI `30786622180`, attempt 1, 12/12;
  final independent `APPROVED`, zero open P0–P3.
- Current Operator `22fe85d540c8949f179b96589ed493f0211002db` / tree
  `7514edfe90da11a3288fec0df872fb7010238c0b`; CI `31630253237`, attempt 1, 12/12;
  final strict independent `APPROVED`, zero open P0–P3.
- Read-only runtime root
  `/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-product-operator/22fe85d5-2a48d52d`:
  manifest SHA-256 `2e24bb5c5d39089ef871d9fd986a67532d51f71df3a6e1652b1b1e232bf6e1fe`,
  entrypoint SHA-256 `2a48d52d204ef8cfba73d9a789de3ef50ecefa29e32c51953bc75b9d48d023a6`,
  map SHA-256 `a51b9cfa0dfa883bf5d091789051ec16c85529afbecd53b37017940fa16a70d2`;
  exact sizes and modes remain as bound in the Flight Card.
- Product APK SHA-256 `b0180c31769e453472a20eb1e7eb4e0825a85be9429becf6bf4970e0875b67f8`
  and artifact-manifest SHA-256
  `83b93bbf33297334bfcca3aa30e5ed6772175f98a2a81dc80045454570fe937b`;
  package `com.tim180201.mobile.synthetic`, versionCode `1`, versionName `1.0.0`, v2 `true`,
  v1/v3/v3.1/v4 `false`, one local V5 debug signer certificate SHA-256
  `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`.
- Node `/Users/timbartz/.nvm/versions/node/v24.17.0/bin/node`, `v24.17.0`, 120,591,840 bytes,
  mode `0755`, SHA-256
  `f5f9b9db4d95f5e0340982685f083de654c21eef9d9122cab5321081ccaa2601`; read-only bundle check
  `PASS` on 2026-08-12.

Both manifests require full bound size, mode and digest plus every parsed field to match. Carried
Evidence is not fresh execution and this documentation candidate is not a new Product CI source.

## Historical predecessor R0 change-impact record and V0

- Baseline: `3a0469ac1d0c9d781e49648a73bc9ef019423c8e` / tree
  `4521f179bbae8867c6776d643679cce32658c979`.
- Intended delta: exactly the seven existing ADO files named by this closure task plus this new
  closure Evidence file; navigation and temporal gate truth only.
- Affected executable workspaces or transitive runtime consumers: none.
- Security, tenant, durable-data, schema, dependency, lockfile, configuration, workflow, script,
  runtime and artifact boundaries: unchanged.
- Risk and verification: AVS-001 R0; V0 only. Product V1–V5, npm, install, build, test, Typecheck,
  CI, ADB and Hardware are omitted because the exact governing Product inputs are unchanged and
  those actions are neither required for this R0 delta nor authorized.
- Carried Evidence: the exact CI, independent reviews, runtime, APK/manifests and Node bindings
  above. No new Product-correctness claim is derived from this documentation.
- Candidate V0: `PASS` on 2026-08-12. Scoped status contains exactly seven modified ADO files plus
  this new ADO file; tracked `git diff --check` exited 0; new-file
  `git diff --no-index --check /dev/null <closure>` returned the expected diff exit 1 with no
  diagnostics; targeted baseline/blob/gate/self-hash markers and
  `HEAD == main == origin/main == 3a0469ac...` are consistent. Exact inventory proves no
  executable delta. These checks must be independently reproduced before publication.

## Historical predecessor activation sequence

1. Obtain independent read-only review of this uncommitted R0 candidate. Required verdict is
   `APPROVED` with zero open P0–P3 before publication.
2. Focusedly commit and push only the approved eight-file ADO delta. Because it is R0 and carries
   the unchanged exact Product CI, the publication may use the repository skip-CI convention;
   that docs commit remains not a Product CI source.
3. Run an independent exact-head read-only review after publication. It must quote the actual
   published closure commit/tree, prove the exact eight-file delta from `3a0469ac`, bind all final
   closure blobs including the governing Flight Card and Runbook, and confirm no executable,
   test, script, workflow, schema, dependency, lockfile, runtime or artifact input changed.
4. Do not create another ADO mutation solely to embed that commit/tree. The external exact-head
   review is the durable binding.
5. Only the exact-reviewed published closure head may be quoted by a future one-time Human
   Hardware authorization. The live signal must additionally bind Operator executable/tree,
   runtime manifest/entrypoint/map, APK plus artifact manifest/package/signature, governing
   Node/toolchain, and exact device/Tags/environment/Guard/Credential constraints.

Any absent, stale or differing value stops before Phase B, ADB, installation or Hardware without
retry. DA6 remains frozen before this gate and is not a DA5 Hardware blocker. The full Runbook and
AVS-001 Physical Gate remain controlling and unshortened.
