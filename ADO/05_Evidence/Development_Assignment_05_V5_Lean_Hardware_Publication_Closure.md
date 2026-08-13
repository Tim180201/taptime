# Development Assignment 5 — Lean Stage-6 Hardware Publication Closure

Status: **R0/V0 CURRENT TECHNICAL CLOSURE CANDIDATE — PREPUBLICATION REVIEW, FUTURE C AND EXACT-HEAD REVIEW REQUIRED / STOP BEFORE HARDWARE**

Owner: Technical Lead

Physical approval authority: Human Architect

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
