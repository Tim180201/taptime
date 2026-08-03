# Development Assignment 5 — V5 Human Android Gate Runbook

## Current Product-start-bundle correction — DO NOT START hardware

The Product-Hardware run bound to `4dff147031e2d8ebbd95b9451705f66b35fbacd3` / tree
`be05ca8e893a00dbd95f84e7133e73f080f96547` is consumed. The standard operator stopped before
database, device preflight and installation with `Synthetic E2E release APK is missing`.
`DA5-V5-PRODUCT-START-BUNDLE-01` was the bundled verifier mistaking the importing
`da5V5Main.js` URL for the verifier's direct CLI URL. Authorized read-only cleanup inspection
proved Product/Validation packages and processes, reverse mappings, synthetic listeners and new
task PostgreSQL/runtime state absent; repository and remote were unchanged.

Executable correction `e939d8c40e7994c72ab1cd2e68e47f189ed8abc1` / tree
`dfd5e160c6c14d09daadcc192afaf81daf1ad060` makes the direct-CLI predicate module-specific and
leaves the existing externally supplied Product-APK verifier unchanged. Source import and the
built operator no longer auto-check the default APK path; explicit direct CLI missing/wrong APK
checks remain fail-closed. Independent prepublication review is `APPROVED`, zero open P0–P3.

The fresh no-custom-executor runtime candidate is preserved read-only at:

| Runtime entry | Exact binding |
|---|---|
| Root | `/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-product-operator/e939d8c4-379b2d9b` |
| Checkout | source `e939d8c40e7994c72ab1cd2e68e47f189ed8abc1` / tree `dfd5e160c6c14d09daadcc192afaf81daf1ad060`; sparse checkout excludes `research/`; tracked clean |
| Entrypoint | `checkout/apps/synthetic-android-e2e/dist/da5V5Main.js`; 846,602 bytes; mode `0444`; SHA-256 `379b2d9b32a26f3fb120b4247431644ae65c4eebe257893948a8e252989dd66b` |
| Source map | same directory, `da5V5Main.js.map`; 1,579,813 bytes; mode `0444`; SHA-256 `4c61abcfc81b77afa223e207c56a4fef05e249a2659129d32f2f2992b2468ed8` |
| Runtime manifest | root `operator-runtime-manifest.json`; 4,977 bytes; mode `0444`; SHA-256 `2b041dee0e945b680da15764b7584eced36c19d3860f6b4067cfc400988c627b` |

Fresh Node `24.17.0` / npm `11.13.0` V3 completed 20/20 builds and 21/21 typechecks.
Focused verifier tests passed 12/12, the built-bundle start smoke passed 1/1, Mobile passed
1,198/1,198, Synthetic passed 280 with 18 unchanged database-gated skips, and all other
non-database workspace suites passed. Exact unchanged database evidence is carried from parent
CI `30829321321`; V4 will rerun the full matrix on the final publication. Runtime-Guard artifact,
isolated PostgreSQL, environment creation and initial DA5 status matched, followed by complete
cleanup. Audit reports zero High/Critical vulnerabilities.

**DO NOT START HARDWARE, ADB OR INSTALLATION.** V4 Exact-Head CI and final independent
Exact-Head/Artifact review are pending. Product and Validation APKs remain unchanged. A fresh
exact Human authorization is mandatory after final `APPROVED`. Production, production data,
production/distribution signing, deployment and distribution remain unauthorized.

## Current Product-preinstall correction — DO NOT START hardware

The matched read-only inspection on `304ddb159f3def2b50d059678086e02aacbd51c9` / tree
`97940b61ce76017c9c295b1cb43fe007727f2ca9` did not start the Product operator or install
anything. That Human authority is superseded and must not be reused.

`DA5-V5-PRODUCT-PREINSTALL-01` is corrected by executable commit
`e525a9ad2b937356002928028fddaaa3e1dca301` / tree
`11aa7fdf526c9b149af5dc60ef5567fb727a24fe`, with verification-head fixture correction
`4329fec6783907b3549322a344085b96e7d00d16` / tree
`4165f9d88d07f80f0b3a4772764c53aa2f515e0f`. Exactly empty User-0 package-list output proves
absence; exactly the canonical package line proves presence, after which alone strict `base.apk`
inspection may run. Every other result fails closed. Strict main/secondary process parsing and
joint package/process/reverse-null proof remain mandatory at preinstall and cleanup.

The approved no-custom-executor runtime is preserved read-only at:

| Runtime entry | Exact binding |
|---|---|
| Root | `/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-product-operator/e525a9ad-00932e6a` |
| Checkout | source `e525a9ad2b937356002928028fddaaa3e1dca301` / tree `11aa7fdf526c9b149af5dc60ef5567fb727a24fe`; tracked clean |
| Entrypoint | `checkout/apps/synthetic-android-e2e/dist/da5V5Main.js`; 846,453 bytes; mode `0444`; SHA-256 `00932e6a1f8ba8d6ff95ff92ec8437b99c48a3f7e97e6b679f205b8f254b66c6` |
| Source map | same directory, `da5V5Main.js.map`; 1,579,577 bytes; mode `0444`; SHA-256 `2d4064af3424779f05cabab6d8e6f8bd66ad2d33fa08f4ffe0a654abec29eb1b` |
| Runtime manifest | root `operator-runtime-manifest.json`; 4,475 bytes; mode `0444`; SHA-256 `6ef434d2c1a5684b19bb9a349edc6fd3eefa3aa4d6f8846ba1e5f932de14708b` |

Local V3 and Exact-Head CI `30829321321`, attempt 1, are green; correction reviews are `APPROVED`.
**DO NOT START HARDWARE, ADB OR INSTALLATION** until this R0 delta is independently `APPROVED`
and a new exact Human authorization binds the corrected publication/runtime. Existing Product and
Validation artifacts remain unchanged. Production, production data, signing, deployment and
distribution remain unauthorized.

## Current governance override — automated Lean closure complete; V5 separately gated

ADR-0019 and the Lean authorization were Human-accepted and published at
`83635335aa4f547dc8994243c604dacf9797f593` / tree
`40b7655a94e607b8afe19f90f42a95f42ee6d582`; independent architecture/authorization review
returned `APPROVED` with zero open P0–P3. Lean stages 1–5 and automated V0–V4 are complete on
executable candidate `1b341d83592ea457c8ca722d01bfa2e64fe8cc40` / tree
`2db756832a81f07cdb1a927ff3076320cc253960`. Prepublication binding review and final independent
Exact-Head/Artifact review returned `APPROVED` with zero open P0–P3. Exact-head CI
`30786622180`, attempt 1, passed 12/12 without retry.

Fresh read-only hardware-candidate bindings, which supersede populated earlier `Current` artifact
rows later in this historical runbook, are:

| Artifact | Exact current binding |
|---|---|
| Product source | `83635335aa4f547dc8994243c604dacf9797f593` / tree `40b7655a94e607b8afe19f90f42a95f42ee6d582` |
| Product APK — DO NOT INSTALL | `/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5/lean-83635335-b0180c31769e4534/app-release-b0180c31769e4534.apk`; 95,522,751 bytes; mode `0444`; SHA-256 `b0180c31769e453472a20eb1e7eb4e0825a85be9429becf6bf4970e0875b67f8` |
| Product manifest | Same directory, `artifact-manifest.txt`; 1,968 bytes; mode `0444`; SHA-256 `83b93bbf33297334bfcca3aa30e5ed6772175f98a2a81dc80045454570fe937b` |
| Validation source | `83635335aa4f547dc8994243c604dacf9797f593` / tree `40b7655a94e607b8afe19f90f42a95f42ee6d582` |
| Validation APK — DO NOT INSTALL | `/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-validation/da5-v5-validation-83635335aa4f-9908d76ea97a1ae9/app-release-9908d76ea97a1ae9.apk`; 65,634,553 bytes; mode `0444`; SHA-256 `9908d76ea97a1ae95ad4a08b24f626d72e8cfc6ddb20d3d1629fa822686c9d29` |
| Validation manifest/closure | Same directory, `manifest-83635335aa4f.json`; 6,855 bytes; mode `0444`; SHA-256 `ab6a02980058259ae719bc597cfa4e7ba25ef0da28d2de4f0ee039884f373298`; 33-record sourceClosure digest `a50ec386e87217eb9a02fede94fd37a97fefb0734fa5a9791b7ff142a9c44c2f` |

The Product App is not installed. This runbook grants no Hardware/ADB/install authority and no
Product Human V5 action may start without a separate exact Human authorization. DA5 and R-034
remain open only for that gate. Production, production data, production signing, deployment and
distribution remain unauthorized. Attempt 15 remains consumed with no retry. CI
`30786622180` binds the executable candidate, not a future R0 documentation-sync head.

## Historical superseded Harness override — Attempt 14 consumed; Attempt 15 prospective read-only candidate

Attempt 14 is consumed fail-closed on exact publication `7f6c94886b4dff263e364ea8860b5de1b98b3b53`
/ tree `c6df9d7b05374f2baba369d3ca163ea83048b68a` and cannot be retried, repaired, resumed or
executed again. Its immutable 45-record distribution is six passed, two failed and 37 hard-stop
omissions. Gate 4 `NPM_CI` failed at `unexpected_output_root`; the mapped child nevertheless
exited 0 with stdout/stderr both 0 bytes. Quality count is zero, Cleanup/Postcleanup are complete,
artifact is `null` and raw output is false. Exact receipt/snapshot/manifest are 110,812 / 2,490 /
1,147 bytes with SHA-256 respectively
`6001c9786038acc8d76e08f9842ccd3b84dc714017134f3aad8df1e5ac779f88`,
`b75dd8ae0f973171f3806c03f963a4f500901e968ef8b2b99ab3cda60b0219bb` and
`53987c9676748016e7e1d16cfac8306266622d6e9a25102e86bb5c834cf5588c`, all mode `0444` under
the immutable mode-`0555` Attempt-14 Evidence root.

The prospective Attempt-15 root is
`/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-harness/attempt15-executor-4dad93bd-cfea2c8a-r1-outputbind`,
mode `0555`, with only mode-`0444` executor 410,449 bytes / SHA-256
`19fe8fe403c230ea0bd914d7e7beb54552954b161bf92033483d92c9a17b6769` and manifest 4,782 bytes /
SHA-256 `ecc5c2ced55db323bc02af9cf225161171b3bc59f0ed96c95da821422ef2c440`. Permitted non-mutating
candidate inspection is limited to:

```text
/Users/timbartz/.nvm/versions/node/v24.17.0/bin/node --check /Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-harness/attempt15-executor-4dad93bd-cfea2c8a-r1-outputbind/attempt15-executor.mjs
/Users/timbartz/.nvm/versions/node/v24.17.0/bin/node /Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-harness/attempt15-executor-4dad93bd-cfea2c8a-r1-outputbind/attempt15-executor.mjs --self-test
```

The exact original map remains unchanged. The adapted map adds only NPM_CI output roots derived
from exact `4dad93b…:package-lock.json` blob `77555096088f864860f2b6c75f51d364a7349d65`, 356,795
bytes / SHA-256 `62b8eb3f80ab31b683b263631ccfa915f25a9743d4d7430cbb05f81c9e8e1470`. It requires 34 install
nodes and the exact 17-root list/SHA
`13457aaa6dbfe55870b5dcc813eb3fd602d9bf0c3939378b89282c0ac087131f`; root `node_modules` makes
18 internal roots/SHA `8f2294960bc1db56e066acc987705918f914a5dd628ee3ff2f60c371ce4ce856`.
The only additional allowed output is the exact unchanged task cache. No broad checkout/apps/
packages/workspace/glob root is legal. All lockfile identity/parser/path/boundary/count/digest
checks occur before NPM_CI starts; every ambiguity hard-stops later nonterminal gates while the
unchanged terminal cleanup runs.

Fresh token `cfea2c8a` prospectively binds:

```text
/private/tmp/taptime-da5-harness-4dad-attempt15-20260802-cfea2c8a
/private/tmp/taptime-da5-harness-4dad-attempt15-cache-20260802-cfea2c8a
/private/tmp/taptime-da5-harness-4dad-attempt15-logs-20260802-cfea2c8a
/private/tmp/taptime-da5-harness-4dad-attempt15-config-20260802-cfea2c8a
/Users/timbartz/Dokumente/GitHub/taptime-local-evidence/da5-v5-harness/attempt15-4dad93bd-cfea2c8a
/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-harness/attempt15-4dad93bd-cfea2c8a
/Users/timbartz/Dokumente/GitHub/taptime/.git/worktrees/taptime-da5-harness-4dad-attempt15-20260802-cfea2c8a
```

All seven paths are absent; self-test must leave them absent. Development syntax passed and the
bounded no-mutation self-test passed 387/387 with zero failures and fixture-name-set SHA-256
`7e77005f392e87a93937e823d4452b99f24538593dec55add66b6d9d135743a5`.

Attempt 15 is **PROSPECTIVE / READ-ONLY / NOT EXECUTED / DO NOT EXECUTE**. There is deliberately
no currently valid reference `--execute` command. A future exact execution publication must be a
caller-bound single child of `7f6c948…` / tree `c6df9d7…`; prepublication review, focused
publication, local AVS R3, V4 exact-head CI, final independent zero-finding approval and separate
exact Human one-run authority must all occur first and be bound by that later caller. This embedded
runbook claims none of those gates complete. Hardware, ADB, installation, Human/Product V5,
production, production data, deployment and distribution remain **DO NOT START**.

## Historical superseded Harness override — Attempt 14 candidate

Attempt 13 is consumed fail-closed and cannot be retried, repaired, resumed or executed. Its
immutable evidence is five passed, two failed and 38 hard-stop omissions; Gate 3 stopped at
`identity_byte_limit`, quality count is zero, Cleanup/Postcleanup completed, artifact is `null`
and raw output is false. Receipt/snapshot/manifest are 108,071 / 2,503 / 1,160 bytes with SHA-256
`6dacaad7db7bcec61f591724b3bcf6ce30aad88ecd2d60e05e301c3ca79285ae`,
`ea6b71d50122aefce343055cdef00422331c05247191beef1042ab6a6a39d74e` and
`2a2a19965a0708051dff7a7eda86eb4416c60b3f4dacb162d7590b2e9bd0a474`. Its accepted P2/P3 review
findings authorize no run and prove no Product or test cause.

The R6 executor remains immutable and is superseded by readonly root
`/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-harness/attempt14-executor-4dad93bd-3cc91245-r1-nodebind`,
mode `0555`, containing only mode-`0444` executor 388,219 bytes / SHA-256
`89c283b211456a1cf7ae20ee4ae551d7ef8a6a17dd443f541dd0cd2e314cfbb9` and manifest 3,729 bytes /
SHA-256 `c118bd24fe455f944bf81ccf10faeef7dea89f41f2b3490ee9470ad2228f69f1`. The correction preserves
source `4dad93bdbc3ccd3e09e2bcfba3680130a90e2799` / tree
`d44bc534c16866dbc16cd889098e6ca33d75d1f5`, Synthetic blob
`183b82674ed92e51375fad41e9efb034976ff5e3` and the exact inherited map SHA. It binds Node to
`/Users/timbartz/.nvm/versions/node/v24.17.0/bin/node`, `v24.17.0`, 120,591,840 bytes and SHA-256
`f5f9b9db4d95f5e0340982685f083de654c21eef9d9122cab5321081ccaa2601`; missing explicit size
retains the exact 32,000,000-byte generic limit.

Permitted non-mutating candidate inspection is limited to:

```text
/Users/timbartz/.nvm/versions/node/v24.17.0/bin/node --check /Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-harness/attempt14-executor-4dad93bd-3cc91245-r1-nodebind/attempt14-executor.mjs
/Users/timbartz/.nvm/versions/node/v24.17.0/bin/node /Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-harness/attempt14-executor-4dad93bd-3cc91245-r1-nodebind/attempt14-executor.mjs --self-test
```

Both commands must leave checkout, cache, logs, config, evidence, success-artifact and exact
registration absent. The final development self-test passed 354/354 fixtures, zero failures,
fixture-name-set SHA-256 `17e6b685be359459916b7970f58857eab7f14996017ec07f22164a65a12a3c7d`,
empty failure-set SHA-256 `4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945`
and real Node identity match. One earlier development self-test exposed only an incorrectly
initialized new Gate-3 sequence fixture (`gate_sequence_invalid`); the fixture was corrected and
the final bounded run passed. This was not an Attempt execution.

The following reference CLI shape is **FORBIDDEN TO RUN WITHOUT SEPARATE EXACT RUN
AUTHORIZATION THAT BINDS ALL REQUIRED EXTERNAL EVIDENCE**:

```text
/Users/timbartz/.nvm/versions/node/v24.17.0/bin/node /Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-harness/attempt14-executor-4dad93bd-3cc91245-r1-nodebind/attempt14-executor.mjs --execute \
  --approval-token APPROVED_ZERO_OPEN_P0_P3_EXACTLY_ONE_ATTEMPT14_R3 \
  --expected-manifest-sha256 c118bd24fe455f944bf81ccf10faeef7dea89f41f2b3490ee9470ad2228f69f1 \
  --execution-publication-repository /Users/timbartz/Dokumente/GitHub/taptime \
  --execution-publication-commit FUTURE_CALLER_BOUND_40_HEX_COMMIT \
  --execution-publication-tree FUTURE_CALLER_BOUND_40_HEX_TREE \
  --execution-publication-delta-sha256 FUTURE_CALLER_BOUND_64_HEX_CANONICAL_DELTA
```

The execution publication presented by the caller must be a single child of
`da64ae31648166184739b056a917ea2762bc9f23` / tree
`a20721ad15c5c824f3bf32987449ffa08569bede`; HEAD, local `origin/main`, exact six-path scope,
caller-supplied commit/tree/delta, all anchors and fresh state must match before `EVIDENCE_INIT`.
Before any execution: independent prepublication review, exact publication, one local AVS R3,
one V4 exact-head CI, final independent zero-finding approval and separate exact Human one-run
authorization are mandatory. This embedded runbook does not itself establish completion of those
external gates; the exact run authorization must bind their evidence. Attempt 14 is **NOT
EXECUTED / DO NOT EXECUTE WITHOUT SEPARATE EXACT RUN AUTHORIZATION**; Hardware and Human/Product
V5 remain **DO NOT START**. This section supersedes older Attempt-13 preparation procedure
below without erasing history.

- Status: **PHASE-0 RUN 18 ESTABLISHED SAFE TRANSFER BINDING A `B55E8B6AEB30`, B `32A54C8F2F29`, X `F61C9F702CFE`; FORMAT/DISTINCTNESS AND DEVICE/UI/10×A+10×B+10×X/NFCA/FINAL PASS/TERMINAL CLEANUP MATCHED WITH EXIT 0; VALIDATION APP REMOVED; AUTHORITY CONSUMED; R-035 LOCALLY MITIGATED; PRODUCT HUMAN V5 NOT RUN; PRODUCT APP NOT INSTALLED; R-034/DA5 OPEN; NO PRODUCT CORRECTNESS/PRODUCTION/DEPLOYMENT/DISTRIBUTION AUTHORITY**
- Date: 2026-07-31
- Owner: Technical Lead
- Approval authority for any run: Human Architect

Current Harness execution-binding override: the unchanged Round-5 executor is superseded by local
independently reviewed read-only publication candidate
`attempt13-executor-4dad93bd-483fcf40-r6-execbind`. Independent prepublication
exact-delta/artifact review Round 1 returned exactly one P3 for stale historic labels; Round 2
closure returned `APPROVED` with zero open P0–P3. It binds
the immutable Round-5 candidate, exact two-commit closure chain, corrected
`4dad93bdbc3ccd3e09e2bcfba3680130a90e2799` source and
Synthetic blob `183b82674ed92e51375fad41e9efb034976ff5e3`, and a single-parent execution publication
directly after `2a5f32b2d29d03f26e53eee07dfe3d0658192b49` / tree
`29a8485f2a19e20ae0c483e701b4a0e36a1ad4a7`. The publication commit/tree/delta are intentionally
not embedded or self-referentially asserted; they must be caller-bound and exactly verified at an
authorized execution. External V4 and final-review evidence are not asserted by this embedded
document. Attempt 13 remains **NOT EXECUTED / DO NOT EXECUTE**;
no run, Hardware or Human/Product V5 authority exists.

Historical Harness CI-closure context (2026-08-02): Attempt 12 is consumed fail-closed. Attempt-13 Round-5
review returned `APPROVED` with zero open P0–P3; the candidate was published as
`387421b3caeed988b159c93ff217fb78a0bee60c` / tree
`ace680660468e0374004869f205e6a1e0af0ac7f`, and its one authorized local AVS R3 verification
passed. V4 exact-head CI `30745607263`, attempt 1, failed closed 11/12 only in `Synthetic
server-connected Android E2E harness` job `91490562435` because its fixed July query/export
window excluded the current-date lifecycle row. `DA5-V5-CI-TIMEWINDOW-01` is confirmed. The
focused deterministic record-bound/window-bound test correction was locally verified, published
and remote-bound as `4dad93bdbc3ccd3e09e2bcfba3680130a90e2799` / tree
`d44bc534c16866dbc16cd889098e6ca33d75d1f5`. Exactly one replacement V4 exact-head CI,
`30748749632`, attempt 1, passed 12/12; Synthetic job `91498873248` passed 13/13 files with 283
passed and 14 platform-dependent skips, with Typecheck, Build and Cleanup green. Final independent
Exact-Head review returned `APPROVED` with zero open P0–P3. Do not rerun the unchanged failed
head. Attempt 13 remains **NOT EXECUTED / DO NOT EXECUTE**; no run, Hardware or Human/Product V5
authority exists.

## 0A. Run-18 fingerprint-transfer success and current Product boundary

Run 18 used exact ADO baseline `5a0d59c2b1767192d3d261cede7a2c2b11732d30` / tree
`e2970d1851ab55f99ff7a027e6268ec4b7622643`, Validation Artifact Source
`5675297dab94258e50d7371a95e07fe7a77fc51c` / tree
`b32af38c8ac769965ab062762004312d96d0de25`, and Validation Execution
`be76ce4a69c8a971ad73b5232082a9e500d8d471` / tree
`56abec5e7f2752f5004fe3e8667f47a917429c52`. APK SHA-256
`3d5450f257eda716bbda0a133a7630d3a2d8bb1f5095fdb1986e85aa0277d144` and manifest SHA-256
`1397f0504bbbf88e776ececb9796918586724a16c69a885c8e23631c2465e86a` matched.

Exact receipts were `artifact:match`, `preflight:match`, `install_launch:match`, `waiting:match`,
`human_pass:match`, `cleanup:match`, `complete:match`; exit was 0. Device/UI, 10×A then 10×B
then 10×X with 10/10 per role, `NfcA`, final UI `PASS` and complete cleanup matched. The transferred
12-uppercase-hex fingerprints are A `B55E8B6AEB30`, B `32A54C8F2F29` and X `F61C9F702CFE`;
format and pairwise distinctness were validated. The exact authority is consumed successfully and
R-035 is locally mitigated with the transfer binding established. Raw UID, payload, Technology
list, device serial and secrets remain prohibited.

Product Human V5 did not run and the Product App was not installed. Run 18 establishes no Product
correctness. R-034 and DA5 remain open. The R3 Harness-artifact closure and its independent
source/artifact Exact-SHA review must complete with zero open P0–P3 before any later separate exact
Product-Human-V5 authorization. Attempt 1 failed closed before build/test/artifact because the
isolated dependency step selected unauthorized Node `26.3.1` / npm `11.16.0`. `npm ci` exited 0
and installed the locked 695-package tree only into task-owned `node_modules`; cleanup completely
removed the worktree, `node_modules` and every dependency output, with no registered worktree
remaining. No Product/APK or system installation occurred. No retry is authorized by that failure
record. The separately approved attempt-2 authorization matched fresh paths, source/tree, hashes,
Node/npm and lifecycle proof, and bound `npm ci` exited 0. Dependency closure then failed closed
before build/test/artifact because `npm ls --all --json` returned `ELSPROBLEMS` for two
extraneous Expo packages and invalid `expo-modules-core`; it also wrote one debug log outside the
bound cache. Cleanup removed checkout, cache, `node_modules`, dependency output, debug log and
worktree registration completely. The attempt-3 authorization then received independent
`APPROVED` review with zero open P0–P3, but its execution was not independently verified. Every
attempt-3 path/source/hash/tool binding, npm exit, gate-order, omission and external-log-set claim
is **Development-reported/unverified** because no disclosure-safe raw/receipt artifact was
preserved and task logs were cleaned. Development reported a predicate-1 fail-closed stop and
cleanup; the failure-evidence gap remains open. Independent review confirmed only the four bound
paths and worktree registration absent, current package-lock hash exact and the six-file ADO-only
delta without executable delta. Attempt 4 received independent authorization review `APPROVED`
with zero open P0–P3 and ran only within the exact technical boundary. Fresh-path/source/tool,
bound install, globally recursive clean exit-0 npm closure, dependency/workspace/lifecycle/
external-log and V0 gates passed; Mobile focused tests passed 38/38. V1 failed closed before any
Synthetic test executed because `@taptime/backend-schema` could not resolve from its package
entry. The receipt explicitly proves only `V2`, `BUILD`, `NODE_CHECK`, `METAFILE_RUNTIME` and
`ARTIFACT_PRESERVE` omitted. It contains no Mobile/Synthetic typecheck command IDs or omission decisions;
Development reported both tests-inclusive typechecks omitted, but that claim is unverified and a
separate fail-closed evidence gap. No output artifact exists. Cleanup removed all task execution state and preserved only
the `0444` receipt/snapshot/manifest evidence under
`/Users/timbartz/Dokumente/GitHub/taptime-local-evidence/da5-v5-harness/attempt4-a0359a87`.
Independent review identified this P2 evidence-claim gap; correction re-review is pending and
Attempt 4 grants no retry. Attempt-5 candidate review returned `APPROVED` with zero open P0–P3.
Execution passed the evidence-first preflight, bound install, strict global/affected npm closure,
dependency-file/tool/source and external-log predicates, then stopped at
`DEPENDENCY_BINDINGS` when the lifecycle-binding verification exited 2. V0, all 16 prerequisite
builds and every focus/typecheck/V2/Node/metafile/artifact step are explicitly omitted. No build
output or artifact exists. Cleanup removed checkout/cache/logs/`node_modules` and registration;
immutable evidence remains under
`/Users/timbartz/Dokumente/GitHub/taptime-local-evidence/da5-v5-harness/attempt5-a0359a87`.
Attempt 5 is `NOT_VERIFIED`; independent execution/evidence review is pending and no retry is
authorized. Hardware, Human, Product installation, ADB and
Product Human V5 remain **DO NOT START**. Production, production data, deployment and
distribution remain unauthorized.

Attempt-6 candidate review returned `APPROVED` with zero open P0–P3. Attempt 6 started, recorded
only green `EVIDENCE_INIT` and `SOURCE_BINDING`, was interrupted and is consumed. Its only
evidence is the unchanged 2,716-byte mode-`0444` receipt, SHA-256
`6a5b23db67bbe1ff6715f377e3f0f041942d8e8b447b5e3e45cb7aa224ad5402`; no checkout, install,
build, test, Typecheck or artifact exists.

Attempt 7 is consumed fail-closed, but its authorization is **UNVERIFIED** because no exact
candidate/digest/review preceded execution. Its receipt uses aggregate dependency/build/V1/V2
records and lacks V0, individual build IDs and separate Typecheck IDs; those results are therefore
Development-reported/unverified. Verified facts are the immutable receipt, `METAFILE_RUNTIME`
exit 2, completed cleanup/path absence and no artifact. Attempt-8 candidate review Round 3 returned
`APPROVED` with zero open P0–P3. Its single execution is consumed fail-closed. Records 1–7 retain
their stated decisions and npm exit/count evidence, but the normative per-command external-log
isolation is insufficient/unverified: `NPM_CI` and `GLOBAL_NPM_LS` have only before hashes and
`WORKSPACE_NPM_LS` has neither side. Record 8 detected cumulative drift that cannot be attributed;
records 9–41 are individually omitted and records 42–45 completed cleanup/finalization. No
external npm log was mutated or raw name/content preserved; no build/test/Typecheck/artifact ran.
Failure/evidence review returned `CHANGES REQUIRED` with exactly one P2, corrected here.

Attempt 9 was independently `APPROVED` with zero open P0–P3 on published candidate
`9d9aa10242231d85afd5a9b018c0652f60b90de2` / tree
`7aa1bcd0026372b196b0fc7d39cd6fbf8b2233ee`; its single execution is consumed fail-closed.
`EVIDENCE_INIT` passed. The first exact no-checkout worktree process exited 0, then the runner
rejected macOS `/tmp` -> `/private/tmp` normalization as `noncanonical_cwd`; `WORKTREE_ADD`
failed and records 3–41 are omitted. No npm, install, build, test, Typecheck, Metafile, TalkBack or
artifact gate ran. The immutable receipt records `CLEANUP` failed with
`Cannot read properties of undefined (reading 'root')`, `POSTCLEANUP` failed with
`worktree_registration_residue`, and `FINALIZE` failed closed. A later separate
Development-reported cleanup operation cannot alter those records. Independent review verified
only current absence of the literal/canonical checkout, cache, log, config and artifact roots and
the exact worktree registration/list mapping. Immutable receipt/snapshot/manifest SHA-256 values are
`8b1b6669e7f55df2d93773e1c8d8446ee7c4ea4a552ba261d39679ee958de5ba`,
`55398e75e02544df79be62b8ac72be739ff5a725d159847fa49e4d1a0cf49b6b` and
`1653d957e6af823388792e049a0b87356dc2ac1fe14b4f8219aaed4a946ad677`. No artifact or retry exists.
Exact Attempt 10 was independently `APPROVED` with zero open P0–P3 on published
`a08e2e89a2aa3962b1bc4ddeb0f77e480f1f4f85` / tree
`dbec8fb277b1a915153c765cad4c5a060e0626b4`; its single R3 execution is consumed fail-closed.
Records 1–30 passed. At record 31 both mapped `SYNTHETIC_TYPECHECK` processes exited 0 and the gate
failed with predicate code `synthetic_typecheck_test_not_listed`. The deliberately non-preserved
`--listFilesOnly` output has no persisted normalized count/digest, required path, observed match or
membership boolean. Independent review cannot decide between config exclusion and matcher/path
normalization; config exclusion is unproved and statically unlikely because the tracked Synthetic
tsconfig includes `tests` and the expected tracked test exists. No Harness, TypeScript-configuration
or Product defect is inferred. Records 32–41 are individually omitted; no V2, Node, Metafile,
TalkBack closure or artifact gate ran, and no Harness artifact exists. Snapshot, cleanup
and postcleanup passed; cleanup is complete with all ten manifest flags true, while `FINALIZE`
remains `FAIL_CLOSED`. The external npm-log baseline remained count `11` / SHA-256
`80a1dc655812427ae4541df6e2bd9ece4834efa17bfa9d5e2dec2370a74f79af`. Immutable receipt,
snapshot and manifest are respectively 111,980 / 64,793 / 3,980 bytes with SHA-256
`d4bd5c9566a213abfcd1872bce92cb745414f8f6c682a52ed00f278e74f6f99f`,
`c323f3d6c59936f6c489497e4689d1b44562a26e979717323417d35ebacd914d` and
`081d3c77fa5b044eefd4fa8c0fb1d623af1fb14fcf5ac0c585d28223cbc1b64e`; files are mode `0444`
and their directory mode `0555`. Independent failure/evidence review returned `CHANGES REQUIRED`
with exactly one P2. The current six-file R0 Attempt-11 candidate corrects that overclaim and remains
**REVIEW PENDING / NOT EXECUTED / DO NOT EXECUTE**. No retry or resume is authorized.
Hardware/Human/Product V5 remains **DO NOT START**.

The exact Attempt-11 candidate remains **REVIEW PENDING / NOT EXECUTED / DO NOT EXECUTE**. Fresh
token `fdf09c30` binds only new canonical `/private/tmp` checkout/cache/log/config paths, new
`attempt11-a0359a87-fdf09c30` artifact/evidence roots and the matching worktree registration.
Executable source/tree remains `a0359a87fd1738c8493929a1661cbbc7adb3c07c` /
`102c913e264bd0ccce1d085db1c50bd407f7d4a4`. The authorization contains the exact 1,437-byte
descriptor, 290-byte npmrc and 72,103-byte direct no-shell 45-gate map, with SHA-256 respectively
`ac819b20cbc26ebb650216012c81a8c9ed76e5468e883e37c8bbd25926e9c9f4`,
`459d76447f1fbd04d46628f7a97e1f69281e3e38eb9b970bfddb480b6c0379c0` and
`9bc2cb1c4bac854126a16b2047cd875537eb32399322cd2212de8587f4236168`. Both Typecheck gates now
require the exact Round-2 byte/decode/LF/CR/terminal-LF/line-limit/path-set pipeline. The line-limit
counter is memory-only; `listed_file_count` is only the final deduplicated canonical-set cardinality,
and raw lists or raw/split line counts never persist. Candidate review returned `CHANGES REQUIRED`
with exactly two P2 corrected here; re-review is pending. All Attempt-10 log, omission, Cleanup V2 and FINALIZE
gates otherwise remain unchanged.

Run 17 remains the historical successful stability/UI/cleanup record:

Run 17 used authorized Validation Artifact Source
`5675297dab94258e50d7371a95e07fe7a77fc51c` / tree
`b32af38c8ac769965ab062762004312d96d0de25` and Execution Repository
`be76ce4a69c8a971ad73b5232082a9e500d8d471` / tree
`56abec5e7f2752f5004fe3e8667f47a917429c52`. ADO CI head
`f45f49aa6c56c70a503322a043bec3d2360c2176` / tree
`714300da7656822dd9b7a2a42fe1be85ab33aa6c` passed exact-head CI `30612797541`,
attempt 1, 12/12. Later R0 `[skip ci]` closure head
`3b544c731d15428334bbadc8e70a3492ef60b886` / tree
`52eb3a2bd4f9676a22dbfbb5eaacf9fccb474e02` carries that evidence only and is not the
Exact-Head-CI SHA.

The exact terminal receipts were `artifact:match`, `preflight:match`,
`install_launch:match`, `waiting:match`, `human_pass:match`, `cleanup:match`,
`complete:match`; exit was 0. Human device confirmation matched `SM-A336B`, Android 15/API 35,
build `samsung/a33xnseea/a33x:15/AP3A.240905.015.A2/A336BXXUDFYE3:user/release-keys`, Owner
User 0, 200 % text scale and Samsung TalkBack `15.1.01.1`; package/process/reverse null state
matched. The Human confirmed exactly 10 A, then 10 B, then 10 X, every role 10/10, `NfcA`,
three pairwise-distinct 12-uppercase-hex safe fingerprints, exact final title
`Alle drei Rollen stabil gebunden`, exact final text
`A, B und X sind stabil, eindeutig und voneinander verschieden.` and `PASS`.

The three concrete safe values were not transferred before run-17 cleanup. That historical
operational transfer gap, not a Product, Validation or hardware defect, is now locally mitigated by
run 18. Terminal operator evidence confirms the Validation App was removed.

Run 16 remains historical: it matched `artifact`, `preflight`, `install_launch` and `waiting`,
then stopped at the first physical Tag-A `technology_evidence`. No B/X, Human PASS or retry
occurred; `abort`, `cleanup:match` and `failed:mismatch` closed that run without raw technology,
UID or fingerprint disclosure or a hardware-defect finding.

The Human Architect explicitly decided NfcA-only v1 Product dispatch/Validation. The Technical
Lead delegated only its focused R3 implementation on baseline
`17f4b47b8429d3862789b7e13a23f8da9d28c449`, tree
`4bbfe9e3fdcdf474f1f506135560e4e111122fb5`; this record grants no run authority.

Artifact preparation on approved source `814cb9013be7da98e46a4c36c5d4e716eef4cf46`,
tree `0181c50faf6936ea1236f4454d536bf734334c91`, produced one local read-only Product
Synthetic artifact candidate. After the separately approved APFS Tool-Identity correction, the
authorized rebuild from source and execution commit
`5675297dab94258e50d7371a95e07fe7a77fc51c`, tree
`b32af38c8ac769965ab062762004312d96d0de25`, published one read-only Validation candidate.
Publisher initial, staged and final checks passed. The first standalone verifier invocation from
the retained build checkout stopped at repository readiness because ignored module-build residue
was present; no artifact inspection had begun. The authorized corrected invocation from a fresh
clean execution checkout passed with `da5_v5_validation_artifact_verified`. This first stop is an
operational wrong-location record, not a Contract or Artifact finding.

The Product NfcA/MifareUltralight artifact and the then-current Validation/Operator bindings are
historical **DO NOT INSTALL/DO NOT START**. Artifact Binding Review R1 of the first hardbinding
candidate returned `CHANGES REQUIRED` with one P1 and three P2. The published correction retains
both exact artifacts and binds Validation Artifact Source to the ordered
33-record source closure, whose compact-JSON SHA-256 is
`62aaa737428ef90b52fc9790ab1cc268537e8d5f5add1fce785bdb501bade763`.
It removes Execution self-literals, derives the Execution Repository from the loaded readiness
module, cross-checks the exact 59-field Product manifest and attests aapt, apksigner, unzip and
hermesc before and after use. Source and prepublication reviews returned `APPROVED` with zero open
P0–P3. The first final V3 detected one real stale Validation bundle binding: Mobile covered only
53/54 test sources and 1,168/1,169 tests. The focused two-file correction updated the executable
bundle to 2,044,686 bytes / SHA-256
`f33e4ecdf0e0d34e39220be9a96d952f3f9718692e766a6e57bdddd28b3b2a88` and the
555-entry / 2,679,201-source-byte closure to SHA-256
`93224940aeab41a86bef9bf3fc959d85f8d7cbdc69876cf94c900abd5d9c6bdd`; focused
verification passed 8/8 and independent bundle re-review returned `APPROVED` with zero open
P0–P3. The corrected candidate was committed as
`be76ce4a69c8a971ad73b5232082a9e500d8d471`, tree
`56abec5e7f2752f5004fe3e8667f47a917429c52`, parent
`cda51c81255dfd7b8944e7d19efb7d209eae7001`, parent tree
`e2ee3bc6cef96c33e9cce692309891577767f1a7`.

The only complete final V3 on that commit/tree used a research-free sparse safe root and a narrow
ADB-free `PATH`; Node 24.17.0, npm 11.13.0 and PostgreSQL 17.10. It passed `npm ci`, 20/20 builds,
21/21 tests-inclusive typechecks, all 54 Mobile test sources including the changed test, migrations
001–013 apply/replay/ledger for nine databases, 21/21 suites with 151 test files and 2,821 passed
tests plus exactly two documented optional B1 skips, Mobile 54/54 and 1,169/1,169, Synthetic 13/13
and 290/290, C3B verify-bin, the no-install Product preflight, the existing exact Validation
artifact standalone verifier from a fresh clean execution checkout, and an 861-module Expo
Android export. The verifier kept Artifact Source
`5675297dab94258e50d7371a95e07fe7a77fc51c` / tree
`b32af38c8ac769965ab062762004312d96d0de25` with its exact 33-record closure. Ports 55439/55435
and the tracked safe root were clean after cleanup.

Before that complete successful run, the setup wrapper stopped because `npm ci` first ran in the
main checkout instead of the safe root; no gate had started. A later premature Admin-Web build
stopped before its dependency build; no green build was claimed or selectively repeated, and the
complete CI dependency ordering produced the final green run. No ADB command was executed; the
Validation verifier only checked the bound ADB file identity read-only. ADO CI head
`f45f49aa6c56c70a503322a043bec3d2360c2176`/tree
`714300da7656822dd9b7a2a42fe1be85ab33aa6c` passed exact-head CI `30612797541`, attempt 1,
12/12. Correction
`9c6eec7`/tree `0aaa6de` closed the two docs-only P3 findings, and both independent Exact-Delta
re-reviews returned `APPROVED` with zero open P0–P3. At that historical pre-run checkpoint, this
R0 synchronization carried V3/V4 without a second V3 or CI; the non-hardware preparation was
technically `APPROVED`/`MERGE_READY`, both artifacts were **DO NOT INSTALL**, the operator was
**DO NOT START** and Human Phase 0/hardware was unauthorized. Run 17 later passed under its
separate exact authorization and consumed that authority. Run 18 later established the exact safe
transfer binding and consumed its separate authority. Post-run, both artifacts are again **DO NOT
INSTALL** and the operator **DO NOT START** for every new action; DA5 and R-034 remain open while
R-035 is locally mitigated. The sole read-only no-hardware readiness entry is
`npm run android:da5-v5-validation:verify --workspace=@taptime/mobile`. Its inputs are separate and
must never be collapsed:

| Readiness input class | Explicit variables and current non-executable binding |
|---|---|
| Execution Repository | `DA5_V5_VALIDATION_REPOSITORY_ROOT`, `DA5_V5_VALIDATION_EXECUTION_COMMIT`, `DA5_V5_VALIDATION_EXECUTION_TREE`; root must equal the canonical symlink-free root derived from the loaded readiness module and commit/tree must equal that root's actual HEAD/tree. Current candidate: `be76ce4a69c8a971ad73b5232082a9e500d8d471` / `56abec5e7f2752f5004fe3e8667f47a917429c52` — **DO NOT START** |
| Artifact Source | `DA5_V5_VALIDATION_SOURCE_COMMIT`, `DA5_V5_VALIDATION_SOURCE_TREE`, and for artifact verification `DA5_V5_VALIDATION_SOURCE_CLOSURE`; current artifact source is explicitly `5675297dab94258e50d7371a95e07fe7a77fc51c` / `b32af38c8ac769965ab062762004312d96d0de25`, separate from Execution `be76ce4a69c8a971ad73b5232082a9e500d8d471` / `56abec5e7f2752f5004fe3e8667f47a917429c52`, with the exact 33-record closure |
| Immutable tools | For each of `NODE`, `GIT`, `ADB`, `AAPT`, `APKSIGNER`, `HERMESC`, `UNZIP`: `DA5_V5_VALIDATION_<TOOL>_PATH`, `_BYTES`, `_MODE`, `_SHA256`; hermesc must equal the repository-resolved compiler and unzip must equal `/usr/bin/unzip`; the current execution form supplies these exact bindings, but grants no Human-run authority |
| Android SDK | `ANDROID_HOME` and/or `ANDROID_SDK_ROOT`; if both are supplied they must be identical. ADB, aapt and apksigner must equal their exact SDK-derived paths |
| Artifact files | Exact `DA5_V5_VALIDATION_APK_*` and `DA5_V5_VALIDATION_MANIFEST_*` values from the current candidate rows below |

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

**Phase 0 — Validation Binding Preflight** has no new execution authority after successful run 17
consumed its exact authority. Runs 1–16 are consumed without an attributable Tag result; run 17
passed as recorded in Section 0A. Historical run 1 stopped on a preinstalled
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
Product rule or later Product-Human-V5 workflow. It also does not supersede the mandatory R3
Harness-artifact closure and independent review prerequisite.

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

The historical safe stage did not reveal the concrete physical `techTypes` and proved no
fingerprint, Tag result or hardware defect. The later successful run 17 bound the independently
approved exact Product/Validation/operator set, Galaxy A33, OS/build/accessibility values and
three Human-confirmed distinct safe A/B/X fingerprints. ADO CI head
`f45f49aa6c56c70a503322a043bec3d2360c2176`/tree
`714300da7656822dd9b7a2a42fe1be85ab33aa6c` passed exact-head CI `30612797541`, attempt 1,
12/12; both Exact-Delta re-reviews of docs-only correction `9c6eec7`/tree `0aaa6de` returned
`APPROVED` with zero open P0–P3. Later R0 `[skip ci]` closure
`3b544c731d15428334bbadc8e70a3492ef60b886`/tree
`52eb3a2bd4f9676a22dbfbb5eaacf9fccb474e02` carries that evidence only and is not the
Exact-Head-CI SHA. This is carried evidence only and is not exact-head CI for run-18 ADO baseline
`5a0d59c` or this R0 synchronization. Run-17 authority is consumed; run 18 separately established
the transfer binding A `B55E8B6AEB30`, B `32A54C8F2F29`, X `F61C9F702CFE` and consumed its
exact authority. Both artifacts are **DO NOT INSTALL** and the operator is **DO NOT START** for
every new action. No APK listed below may be installed under current authority; all entries are
non-executable audit bindings. The R3 Harness-artifact closure and independent review must pass
before Product Human V5 may receive separate exact authorization; no auth, network, database,
Product action or timekeeping is authorized.

| Phase 0 artifact | Exact binding |
|---|---|
| Runtime Guard binary | `/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-runtime-guard/ba1b6e922ceb7902ecedd9dc2df01d6b22d90867/da5_v5_runtime_guard`; 74,336 bytes; mode `0555`; SHA-256 `4b2a7e6b15d3348dffda94f9125c20a4db82bb8eb08a03aabd35932ad0d5853c` |
| Runtime Guard manifest/review | Same directory, `guard-manifest.txt`; 19,971 bytes; mode `0444`; SHA-256 `957d6e99c271663763945026995e7463cf2f20b385eb942fd16a152d3de5f709`; focused evidence SHA-256 `440928371f7acc48272eff2e819c37a851d66cae4a908ffa330228982328d708`; independent Exact-SHA `APPROVED`, zero open P0–P3 |
| Current NfcA-only Product source — DO NOT INSTALL | `814cb9013be7da98e46a4c36c5d4e716eef4cf46`; tree `0181c50faf6936ea1236f4454d536bf734334c91`; source/prepublication reviews `APPROVED`, zero open P0–P3; current operator candidate final V3 passed |
| Current NfcA-only Product APK — DO NOT INSTALL | `/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5/814cb90/app-release-fd0886dc1c393d3b.apk`; 95,522,751 bytes; mode `0444`; SHA-256 `fd0886dc1c393d3b09b5ce575215e4767c84335362ec7cbe5f1948877c714d96` |
| Current NfcA-only Product manifest — DO NOT INSTALL | Same directory, `artifact-manifest.txt`; 1,964 bytes; mode `0444`; SHA-256 `c0645dda543394cba9d6029b41a23aff5bcb5d0d805e3e944d9f8f880d1d5639` |
| Current Product package/runtime boundary | `com.tim180201.mobile.synthetic`; versionCode `1`; versionName `1.0.0`; one v2 signer, v1/v3/v3.1/v4 false; certificate SHA-256 `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`; compiled unique exact-NfcA resource and packaged runtime matched |
| Current Validation Artifact Source — DO NOT INSTALL | `5675297dab94258e50d7371a95e07fe7a77fc51c`; tree `b32af38c8ac769965ab062762004312d96d0de25`; exact 33-record closure |
| Current Validation Execution Repository — DO NOT START | `be76ce4a69c8a971ad73b5232082a9e500d8d471`; tree `56abec5e7f2752f5004fe3e8667f47a917429c52`; parent `cda51c81255dfd7b8944e7d19efb7d209eae7001`, parent tree `e2ee3bc6cef96c33e9cce692309891577767f1a7`; canonical loaded-module root and actual HEAD/tree matched in final V3 |
| Pre-run ADO/V4/re-review closure | ADO CI head `f45f49aa6c56c70a503322a043bec3d2360c2176`/tree `714300da7656822dd9b7a2a42fe1be85ab33aa6c`; exact-head CI `30612797541`, attempt 1, 12/12; docs-only correction `9c6eec7`/tree `0aaa6de`; both Exact-Delta re-reviews `APPROVED`, zero open P0–P3; later R0 `[skip ci]` closure `3b544c731d15428334bbadc8e70a3492ef60b886`/tree `52eb3a2bd4f9676a22dbfbb5eaacf9fccb474e02` carries the evidence only and is not the Exact-Head-CI SHA; at that checkpoint no Human/hardware authority. Run 17 later passed under separate exact authorization, which is now consumed |
| Current Validation APK — DO NOT INSTALL | `/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-validation/da5-v5-validation-5675297dab94-3d5450f257eda716/app-release-3d5450f257eda716.apk`; 65,634,553 bytes; mode `0444`; SHA-256 `3d5450f257eda716bbda0a133a7630d3a2d8bb1f5095fdb1986e85aa0277d144` |
| Current Validation manifest/closure — DO NOT INSTALL | Same directory, `manifest-5675297dab94.json`; 6,855 bytes; mode `0444`; SHA-256 `1397f0504bbbf88e776ececb9796918586724a16c69a885c8e23631c2465e86a`; 33 ordered source records; compact-JSON SHA-256 `62aaa737428ef90b52fc9790ab1cc268537e8d5f5add1fce785bdb501bade763` |
| Current Validation bundle/source closure | Executable Metro bundle 2,044,686 bytes / SHA-256 `f33e4ecdf0e0d34e39220be9a96d952f3f9718692e766a6e57bdddd28b3b2a88`; 555 entries / 2,679,201 source bytes / SHA-256 `93224940aeab41a86bef9bf3fc959d85f8d7cbdc69876cf94c900abd5d9c6bdd`; focused 8/8 verification and independent bundle re-review `APPROVED`, zero open P0–P3 |
| Current Validation artifact publication/verification | Publisher initial/staged/final `PASS`; exact existing artifact verifier returned `da5_v5_validation_artifact_verified` from a fresh clean execution checkout at `be76ce4a69c8a971ad73b5232082a9e500d8d471` / tree `56abec5e7f2752f5004fe3e8667f47a917429c52`, while preserving Artifact Source `5675297dab94258e50d7371a95e07fe7a77fc51c` / tree `b32af38c8ac769965ab062762004312d96d0de25` and its exact 33-record closure; no ADB command was executed. The earlier retained-build-checkout readiness stop occurred before artifact inspection and is not an Artifact finding |
| Historical `effc57a` Validation source/review/CI — DO NOT INSTALL | `effc57a6780ff86784de0519a34abd6c5b7b8cd6`; tree `758dbfaa04d0968fb25122352055fbcb80f8f022`; exactly seven authorized changed files; exact-head CI `30377569479`, attempt 1, 12/12; independent source review and final prepublication review `APPROVED`, zero open P0–P3 |
| Historical `effc57a` Validation V3 | 20/20 builds; 21/21 tests-inclusive typechecks; 21 workspace suites / 147 test files / 2,373 tests; exactly two documented optional B1 skips; migrations 001–013 apply/replay/ledger, C3B CLI and Android export passed. Initial Synthetic stop solely from Technical-Lead runner database-name configuration; previously unexecuted unchanged suite passed 288/288 on a fresh exact database; no port or temporary residue |
| Historical `effc57a` Validation APK — DO NOT INSTALL | `/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-validation/da5-v5-validation-effc57a6780f-e423073e51f72a68/app-release-e423073e51f72a68.apk`; 65,631,681 bytes; mode `0444`; SHA-256 `e423073e51f72a68421c8e4afd17a9b86c397ca83628deaf4b174543d817330f`; Artifact Exact-SHA review `APPROVED`, zero open P0–P3 |
| Historical `effc57a` Validation manifest — DO NOT INSTALL | Same directory, `manifest-effc57a6780f.json`; 6,700 bytes; mode `0444`; SHA-256 `9d1238e821d92b26ed9bc9b9ee8ccd48607280ff0d0e752ec6965827c68ccc22`; Artifact Exact-SHA review `APPROVED`, zero open P0–P3 |
| Historical `effc57a` Validation package/security boundary | `com.tim180201.mobile.validation`; versionCode `1`; versionName `1.0.0`; signing scope `local-validation-only`; one v2 signer with certificate SHA-256 `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`; NFC-only; no network permission; cleartext denied; backup disabled; no Product deep links or Tag dispatch |
| Historical `effc57a` Validation native/source closure | Metro source closure 555 entries / 2,675,576 bytes / SHA-256 `e9fee0629af81357e4563836f9f5ef2b404c1ef97bc135d1cb3ed410f713b593`; executable 2,040,604 bytes / SHA-256 `c24457514436a63878107e1593dc90c6de17ad2424a6b625a6f18a14f66b8cfe`; unchanged native source 123 directories / 587 entries / 464 files / 1,176,224 bytes / SHA-256 `9194be29b96a67c47aa40a4bdea7494155695e088d769e21c77eff305b1ee259` |
| Historical `effc57a` Artifact Exact-SHA review | `APPROVED`, zero open P0–P3; all 32 manifest source-closure files byte-exact; package/signature/version, NFC-only permission, backup/transfer disabled, cleartext/network blocked and no Product dispatch/deep link; DEX 4 required present / 14 forbidden absent; Hermes Validation markers present and Product/network/database/storage markers absent |
| Historical `DA5-V5-VAL-TECH-01` source/review/CI | `03694f2d877bc323791e93473ad01ceb82af70df`; tree `6c6039683e067ef29f1f917a60c2628d26e38784`; exact-head CI `30386552118`, attempt 1, 12/12; prepublication review round 2 `APPROVED`, zero open P0–P3 |
| Validation Phase-0 operator source/review/CI — DO NOT START | Baseline `39a6ef09fad18375af025bc8ed12cc1ea6dda964`, tree `10cdf16421fe564e1961a39d79e20775c0269fc4`; candidate `083fdfb259089d976e48f824e0862f10637d3290`, tree `24bd130500934c6a48fd9314fa06387d6ebdedcd`; exact-head CI `30402655381`, attempt 1, 12/12; independent Exact-SHA re-review round 2 `APPROVED`, zero open P0–P3; both round-1 P1 findings closed; no Phase-0, installation, ADB or hardware authority |
| Final install-category correction/review — DO NOT START | Candidate `12d1ace89494851025555d1d06d45570c4fcc4cb`; tree `b747b4306637d90765b33f273ad89291bd4ea9a7`; parent `b63641953536bb36625fcd42d850e429ddab8db3`; exact code/test delta limited to the Operator core and focused runtime test, plus four synchronized ADO truth files; V2/V3 green; exact-head V4 CI `30466798295`, attempt 1, 12/12; prior round-2 delta review and final independent Exact-Head/V4 review `APPROVED`, zero open P0–P3; round-1 P2 closed; no Phase-0, installation, ADB or hardware authority |
| Run-12 diagnostic/local Guard cleanup correction — technically closed/DO NOT START | Candidate `3a77603825db573bdabb2d4202fe7cca5383c1ed`; tree `3996b4c27d2970b99e1b407217dd269e62be72ce`; parent `3fcbcdec79dada8d43041a241127e52f4775e8d8`; V3 20/20 builds, 21/21 tests-inclusive typechecks, 21/21 suites / 2,529 passed / two expected skips plus migration/bin/artifact/export/cleanup match; exact-head CI `30479752844`, attempt 1, 12/12 without retry; independent prepublication and final Exact-SHA reviews `APPROVED`, zero open P0–P3; no Phase-0, installation, ADB, hardware or Product Human-V5 authority |
| Historical install-/launch-diagnostic predecessor/review — DO NOT START | Candidate `8ce03852e782d541319bb852f216cf596ab1787f`; tree `f5b914c1b8f1243244733808beaef54f0351a563`; parent `2f057cb4e5d096e34785c72c51340f589c711dd2`; exact eight-file +488/-132 delta; patch SHA-256 `c8418fe6382c8a23ada44254c2fdc35652acbb73a8f99983f5cbb4cc11b46984`; V1/V2 executed green; unchanged V3 carried from `496ca59`/tree `b398b89`; exact-head CI `30459539801`, attempt 1, 12/12; independent Exact-Delta/Commit/Tree/CI review `APPROVED`, zero open P0–P3; no Phase-0, installation, ADB or hardware authority |
| Historical published Phase-0 readiness candidate — DO NOT START | Candidate `496ca59f0965670b29a210b8aa2443b99bb4a386`, tree `b398b89c77f7f0b4799a7a06b11bd2daf51fd34a`; exact baseline `fa1aaa782415aceb85c0aa5c1233732ef9afa4dc`, tree `da69081517d2b0b9631eaef393b0a6022735061e`; Toybox process parsing, explicit one-time `human-pass`, deterministic terminal receipt ordering, four catchable signals and exact 30-presentation Human protocol; safe-root V3/eight-file candidate has no code finding; exact-candidate CI `30427205223`, attempt 1, failed 11/12 after job `90496143535` passed 3/3 files and 121/121 assertions but emitted later unhandled PostgreSQL `57P01` on `taptime_c3e1_dirty_*`; formal review `CHANGES REQUIRED`, exactly one P2 CI/test-reliability finding, no Product/Security finding; no retry |
| PostgreSQL test-cleanup correction — technically closed/DO NOT START | Candidate `21e518151a3f4727ebf4ce90cd1557660960ff21`, tree `8f764f9260378b631b4b026355852c324d6dc06b`; parent `d63c62de9eced5f7dd62c8c957d4c2fffce77bf9`, tree `753feedcae6724e711557e6492bbe26fa0b02083`; seven test-only files, +192/-12, delta SHA-256 `b0406bc02a085649060b3dfdb263db00694e501efbe1c247f3ba49fec3cb53e2`; V1 2/2, V2 B3 128/128 + C3B 60/60 + C3C/C3E1 102/102 and three tests-inclusive typechecks passed; unchanged green V3 carried from `496ca59`; exact-head CI `30429746848`, attempt 1, 12/12 without retry; independent source/delta and final Exact-SHA/V4 reviews `APPROVED`, zero open P0–P3; historical P2 closed; no hardware authority |
| Historical `DA5-V5-VAL-TECH-01` candidate APK — DO NOT INSTALL | `/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-validation/da5-v5-validation-03694f2d877b-d2084486b07f27bd/app-release-d2084486b07f27bd.apk`; 65,631,433 bytes; mode `0444`; SHA-256 `d2084486b07f27bdbd72f9f32e38531f8de31dad18ef4789cab2ec44135e05f5`; official verifier `PASS`; independent Source/Artifact Exact-SHA review `APPROVED`, zero open P0–P3 |
| Historical `DA5-V5-VAL-TECH-01` candidate manifest — DO NOT INSTALL | Same directory, `manifest-03694f2d877b.json`; 6,700 bytes; mode `0444`; SHA-256 `aa2a243cd4f81ead806c43e27d6f9c12c28e396db64fe556d8ddf02a8d52f347`; all 32 source-closure entries matched; independent Source/Artifact Exact-SHA review `APPROVED`, zero open P0–P3 |
| Historical `DA5-V5-VAL-TECH-01` package/security boundary — DO NOT INSTALL | `com.tim180201.mobile.validation`; versionCode `1`; versionName `1.0.0`; `local-validation-only`; one v2 signer with certificate SHA-256 `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`; NFC-only; no network permission; cleartext denied; backup/transfer denied; no Product deep links or Tag dispatch; required native modules present, forbidden modules absent; Validation marker present and Product runtime marker absent |
| Historical `e97bbe9` Validation source/review/CI — DO NOT INSTALL | `e97bbe9e2a281099899e2ecb3aad2588ef20f22d`; tree `2958f456875e8dab3f10834df280e10a8438efce`; exact-head CI `30370977809`, attempt 1, 12/12; Round-2/Round-3 source reviews and formal Source/Artifact Exact-SHA review `APPROVED`, zero open P0–P3 |
| Historical `e97bbe9` Validation APK/manifest — DO NOT INSTALL | Directory `/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-validation/da5-v5-validation-e97bbe9e2a28-810b856ff7113b4f`; APK `app-release-810b856ff7113b4f.apk`, 65,629,505 bytes, mode `0444`, SHA-256 `810b856ff7113b4f2a454007595e1b6c1ae5dc69c601a2120b577f124e213e28`; manifest `manifest-e97bbe9e2a28.json`, 6,700 bytes, mode `0444`, SHA-256 `af53d646558449a7a5c907fbdf59e3366c6ffd2755f6049141db8e567549e051` |
| Historical Validation APK — DO NOT INSTALL | `/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-validation/da5-v5-validation-7e8c0f7742e6-303bfd33cf7fa000/app-release-303bfd33cf7fa000.apk`; 65,626,753 bytes; mode `0444`; SHA-256 `303bfd33cf7fa000ee808a048f91883c18dbfe85c1ba359d3f0764ac7ae7f2f8` |
| Historical Validation manifest — DO NOT INSTALL | Same directory, `manifest-7e8c0f7742e6.json`; 6,700 bytes; mode `0444`; SHA-256 `11c1664cee37caa8b093a9023f571e3b8733e8bb078bf7f78b6f20d8f39388a7` |
| Historical `03694f2` package/runtime — DO NOT INSTALL | `com.tim180201.mobile.validation`; signer `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`; `local-validation-only`; historical `NfcA+MifareUltralight`; exact roles A/B/X; exactly one active installed provider from `com.google.android.marvin.talkback` or `com.samsung.android.accessibility.talkback`; none or both fail closed; exactly one queries block with those two package queries, one exact `VIEW` + `BROWSABLE` + `https` intent and zero providers; no Product deep link or Tag dispatch |
| Historical native/source verification — DO NOT INSTALL | Correction `7e8c0f7742e6407b8917205fd337a552f7dec714`, tree `3e4d1356b859fecf70d365fecbb563e2088100f3`; exact-head CI `30284566289`, attempt 1, 12/12; exact 2,032,807-byte executable Metro bundle SHA-256 `e4caf2db73cfbcdaf779f337bf3a3f99e95d182950522323052bc31ae10c93d3`; exact 555-source/2,667,064-source-byte closure SHA-256 `29691fc137c63906e5cf0c5cd47e2df0643064ab6dbddc00e0d3ec467d492ed3`; independent correction re-review and Artifact Exact-SHA review each `APPROVED`, zero open P0–P3; official artifact verifier `PASS`; superseded for installation by DA5-V5-VAL-UI-01 source correction |
| Run-17 device/accessibility and A/B/X outcome | `SM-A336B`; Android 15/API 35; build `samsung/a33xnseea/a33x:15/AP3A.240905.015.A2/A336BXXUDFYE3:user/release-keys`; Owner User 0; 200 %; Samsung TalkBack `15.1.01.1`; 10×A then 10×B then 10×X, every role 10/10, `NfcA`, three distinct safe fingerprints and Human PASS matched. Concrete safe A/B/X values were not transferred before run-17 cleanup; run 18 later established the transfer binding |
| Run-18 fingerprint-transfer outcome | ADO baseline `5a0d59c2b1767192d3d261cede7a2c2b11732d30` / tree `e2970d1851ab55f99ff7a027e6268ec4b7622643`; source `5675297` / tree `b32af38`, execution `be76ce4` / tree `56abec5`; APK/manifest matched; device/UI/10×A+10×B+10×X/NfcA/final PASS/receipts/cleanup matched; A `B55E8B6AEB30`, B `32A54C8F2F29`, X `F61C9F702CFE`; format and pairwise distinctness validated; exit 0; authority consumed; R-035 locally mitigated; Product App not installed and Product Human V5 `NOT RUN` |
| One-time Phase 0 authorization/result | `RUN 1 CONSUMED — PREINSTALLED PACKAGE`; `RUN 2 CONSUMED — SAMSUNG PROVIDER UNSUPPORTED BY PRIOR BUILD`; `RUN 3 CONSUMED — GENERIC RESOLVER DID NOT UNIQUELY START EXPLICIT ACTIVITY`; `RUN 4 CONSUMED — EXPLICIT MAINACTIVITY COLD START FAILED MISSING EXPOASSET`; `RUN 5 CONSUMED — EXACT APK/DEVICE CHECKPOINT PASSED, THEN GENERIC FAIL-CLOSED SCAN PATH`; `RUN 6 CONSUMED — EXACT e97bbe9 APK/DEVICE CHECKPOINT PASSED, THEN FIRST A-SCAN SHOWED ONLY GENERIC FAIL-CLOSED STATE`; `RUN 7 CONSUMED — EXACT effc57a APK/DEVICE CHECKPOINT PASSED, THEN FIRST A-SCAN STOPPED AT SAFE technology_evidence`; `RUN 8 CONSUMED — EXACT 03694f2 APK INSTALLED, THEN LEGITIMATE ANDROID-15 ~ PATH REJECTED BEFORE MAINACTIVITY LAUNCH`; `RUN 9 CONSUMED — artifact:match, preflight:match, install_launch:mismatch, cleanup:match, failed:mismatch; NO SCAN/UI HANDOFF AND EXACT CAUSE NOT RECONSTRUCTABLE`; `RUN 10 CONSUMED — artifact:match, preflight:match, installation/operation_mismatch, install_launch:mismatch, cleanup:match, failed:mismatch; NO installed_provenance OR UI/NFC/TAG STEP; EXACT CAUSE NOT RECONSTRUCTABLE BECAUSE PRE-INSTALL VERIFICATION WAS SUMMARIZED BY THE SAME CATEGORY`; `RUN 11 CONSUMED — BASELINE d8549c3/TREE 04ea2d0; artifact:match, preflight:match, stage=installation status=mismatch category=operation_mismatch, install_launch:mismatch, cleanup:match, failed:mismatch; NO installed_provenance OR UI/NFC/TAG STEP`; `RUN 12 CONSUMED — BASELINE 3fcbcdec/TREE 74cac3e; artifact:match, preflight:match, stage=installation status=mismatch category=adb_child_transport_mismatch, install_launch:mismatch, cleanup:match, failed:mismatch; NO installed_provenance OR UI/NFC/TAG STEP`; `RUN 13 CONSUMED — BASELINE 63feaf48/TREE 1d63595; artifact:match, preflight:match, stage=installation status=mismatch category=adb_child_transport_mismatch, install_launch:mismatch, cleanup:match, failed:mismatch; NO installed_provenance/WAITING/UI/NFC/TAG STEP`; runs 5–13 have no attributable Tag result and prove no hardware defect; runs 10–13 establish no Product/APK finding; run-7 physical `techTypes` remain unknown; no current authority |

| Later Phase 0 results | `RUN 14 CONSUMED — BASELINE 8878019/TREE 5c15f0f; OPERATOR-SESSION artifact:mismatch, cleanup:match, failed:mismatch BEFORE PREFLIGHT/ADB/INSTALLATION`; `RUN 15 CONSUMED — SAME BASELINE; OFFLINE ARTIFACT MATCH, THEN artifact:match, preflight:match, stage=installation status=mismatch category=adb_stdin_pipe_abort_mismatch, install_launch:mismatch, cleanup:match, failed:mismatch; NO installed_provenance/WAITING/UI/NFC/TAG STEP`; `RUN 16 CONSUMED — artifact:match, preflight:match, install_launch:match, waiting:match, HUMAN-CONFIRMED DEVICE BINDING, FIRST TAG-A technology_evidence, abort, cleanup:match, failed:mismatch; NO ACCEPTED FINGERPRINT/B/X/HUMAN PASS/RETRY`; `RUN 17 CONSUMED SUCCESSFULLY — SOURCE 5675297/TREE b32af38, EXECUTION be76ce4/TREE 56abec5; CI 30612797541 ATTEMPT 1 12/12 ONLY ON ADO CI HEAD f45f49aa6c56c70a503322a043bec3d2360c2176/TREE 714300da7656822dd9b7a2a42fe1be85ab33aa6c; artifact:match, preflight:match, install_launch:match, waiting:match, human_pass:match, cleanup:match, complete:match; EXIT 0; DEVICE/UI/10×A+10×B+10×X/NFCA/FINAL TITLE+TEXT/PASS CONFIRMED; VALIDATION APP REMOVED`; `RUN 18 CONSUMED SUCCESSFULLY — ADO 5a0d59c/TREE e2970d1; SOURCE 5675297/TREE b32af38, EXECUTION be76ce4/TREE 56abec5; SAME MATCHING RECEIPTS/DEVICE/UI/ORDER/NFCA/FINAL PASS/CLEANUP, EXIT 0; A B55E8B6AEB30, B 32A54C8F2F29, X F61C9F702CFE; FORMAT AND PAIRWISE DISTINCTNESS VALIDATED; R-035 LOCALLY MITIGATED`; carried CI is not exact-head CI for run 18 or this sync; no Product Human V5 authority |

**Later Product Human V5** remains the separate run described below. Successful Validation
Phase-0 runs 17 and 18 supply no Product/Human-V5 result. The Product App was not installed. The
run-18 transfer binding locally mitigates R-035 but authorizes no Product installation, Product
action or other hardware action. The R3 Harness-artifact closure and independent review must pass
before Product Human V5 may receive separate exact authorization.
Production, production data, system changes, deployment and distribution remain unauthorized.

## 1. Purpose and authority boundary

This runbook defines one fresh Human Android observation for ADR-0016 DA5-P12 and ADR-0017
DA5-T15. It minimizes repetition through staged gates, but every listed boundary remains
mandatory.

The historical carried V0–V4 software closure used Source+Lock baseline
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
| Product Human V5 one-run authorization and date | `UNBOUND — DO NOT START`; may not be bound before the R3 Harness-artifact closure and independent source/artifact Exact-SHA review pass with zero open P0–P3; successful Validation Phase-0 run-17 and transfer run-18 authorities are separate and consumed |
| Product source commit/tree and review state | `814cb9013be7da98e46a4c36c5d4e716eef4cf46` / `0181c50faf6936ea1236f4454d536bf734334c91`; source/prepublication reviews `APPROVED`, zero open P0–P3; current execution candidate final V3 passed |
| Historical runbook/evidence commit/tree and review — not current binding | `e6a06e2ec8f580d6314bfe5a51378f949d524b16` / `6dcdce405feb2eccb1462c373ab6be891152715c`; CI `30150095109`, attempt 1, 12/12; historical Artifact/Evidence Exact-SHA review `APPROVED`, zero open P0–P3 |
| Read-only Product APK path, byte size, SHA-256 and exact mode | `/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5/814cb90/app-release-fd0886dc1c393d3b.apk`; 95,522,751 bytes; `fd0886dc1c393d3b09b5ce575215e4767c84335362ec7cbe5f1948877c714d96`; `0444` |
| Read-only Product manifest path, byte size, SHA-256 and exact mode | `/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5/814cb90/artifact-manifest.txt`; 1,964 bytes; `c0645dda543394cba9d6029b41a23aff5bcb5d0d805e3e944d9f8f880d1d5639`; `0444` |
| Package, version, signature scheme, signer digest and packaged manifest/runtime values | `com.tim180201.mobile.synthetic`; versionCode `1`; versionName `1.0.0`; v2 `true`, v1/v3/v3.1/v4 `false`; one local synthetic non-production signer certificate SHA-256 `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`; packaged boundary/runtime `match` per adjacent manifest |
| Read-only Validation Artifact Source commit/tree | `5675297dab94258e50d7371a95e07fe7a77fc51c` / `b32af38c8ac769965ab062762004312d96d0de25`; exact 33-record closure |
| Validation Execution Repository commit/tree | `be76ce4a69c8a971ad73b5232082a9e500d8d471` / `56abec5e7f2752f5004fe3e8667f47a917429c52` — **DO NOT START**; matched the canonical loaded-module root's actual HEAD/tree in final V3 |
| Pre-run ADO/V4/re-review closure | Historical Validation/Phase-0 binding remains ADO CI head `f45f49aa6c56c70a503322a043bec3d2360c2176`/tree `714300da7656822dd9b7a2a42fe1be85ab33aa6c`, exact-head CI `30612797541`, attempt 1, 12/12, `9c6eec7`/tree `0aaa6de`, both Exact-Delta re-reviews `APPROVED`, and carried R0 `[skip ci]` closure `3b544c731d15428334bbadc8e70a3492ef60b886`/tree `52eb3a2bd4f9676a22dbfbb5eaacf9fccb474e02`; none is reinterpreted as exact-head CI for run 18 or this synchronization. Current Product-Harness TalkBack tracked-source evidence: `a0359a87fd1738c8493929a1661cbbc7adb3c07c`/tree `102c913e264bd0ccce1d085db1c50bd407f7d4a4`, parent `3f8eb8f582a2458e628ab8c76240a291aaba27f5`; exact seven-file +294/-5 delta SHA-256 `30a7b90bd59de29af0c6bd97b4a809df933b230baa69508cea0ca189a78e27fb`; exact-head CI `30638926835`, attempt 1, 12/12; independent Exact-Head review `APPROVED`, zero open P0–P3; Mobile 38/38, Synthetic 60/60, both tests-inclusive typechecks and Guard closure 4/4 files / 123 passed / 18 expected skips green. `DA5-V5-HARNESS-ARTIFACT-01` remains open because the startable ignored bundle predates that source and is not authorized execution evidence. Its R3 closure and independent source/artifact Exact-SHA review must pass before any separate Product-Human-V5 authorization. Runs 17 and 18 remain separately consumed; R-035 is locally mitigated; DA5/R-034 and Product Human V5 remain open; this row grants no Human-run authority |
| Read-only Validation APK path, byte size, SHA-256 and exact mode | `/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-validation/da5-v5-validation-5675297dab94-3d5450f257eda716/app-release-3d5450f257eda716.apk`; 65,634,553 bytes; `3d5450f257eda716bbda0a133a7630d3a2d8bb1f5095fdb1986e85aa0277d144`; `0444` |
| Read-only Validation manifest/closure | Same directory, `manifest-5675297dab94.json`; 6,855 bytes; `1397f0504bbbf88e776ececb9796918586724a16c69a885c8e23631c2465e86a`; `0444`; 33 records; compact-JSON SHA-256 `62aaa737428ef90b52fc9790ab1cc268537e8d5f5add1fce785bdb501bade763` |
| Device model, OS/build and approved screen-unlocked mode | `UNBOUND — DO NOT START` |
| Approved assigned, unassigned and unrelated Tag labels/safe fingerprints | `UNBOUND — DO NOT START` |
| Exact synthetic services, status boundary and controlled-offline switch | `UNBOUND — DO NOT START` |
| Admin Setup Preview 2 entry, preview/validation result and safe exit procedure | `UNBOUND — DO NOT START` |
| DA5-T06 exact five-second dedupe boundary and lifecycle-cancellation checkpoint | `UNBOUND — DO NOT START` |
| Separately reviewed Protected/Review induction fixture, synthetic labels, exact start state, cutover procedure, expected state sequence and scoped teardown | `UNBOUND — DO NOT START` |
| Exact large-text setting and active allowlisted TalkBack package/version | `UNBOUND — DO NOT START`; technical candidate context supports exact Google or Samsung package/version, including Samsung, but the future authorization must bind one exact active provider/version and setting |

The populated historical artifact/evidence rows retain their recorded independent approvals. The
current Product/Validation/operator candidate passed final V3, exact-head CI and both Exact-Delta
re-reviews with zero open P0–P3; the non-hardware preparation is technically
`APPROVED`/`MERGE_READY`. This R0 synchronization carries V3/V4 without a second V3 or CI. The
Human gate remains unbound. None of these rows is a Human-run authorization. Every remaining
operational binding and a separate exact Human authorization are still mandatory.

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

## 7. Attempt-11 terminal operator record — 2026-08-01

The earlier Attempt-11 candidate-state text is historical. Exact authorization publication
`32272ca8e1155839380797cadb64fbc454bf2133` / tree
`4f11d9a86f7a060a3a2cfccda4eb7520c2145aa1` activated one run against executable source
`a0359a87fd1738c8493929a1661cbbc7adb3c07c` / tree
`102c913e264bd0ccce1d085db1c50bd407f7d4a4`. That run is consumed fail-closed.

Records 1–31 passed in exact order. Both Typecheck records retained the corrected disclosure-safe
membership objects and included their exact required tests; no raw list was retained. Record 32
`V2_SYNTHETIC_TEST` recorded process exit 1. Do not infer a cause: raw output was not preserved and
the command may not be rerun under this authority. Records 33–41 are omitted, so there is no
startable/preserved Harness artifact. Records 42–44 passed and cleanup state is
`cleanup_complete`; every temporary/output root and the worktree registration/list mapping are
absent. Record 45 is `FAIL_CLOSED`.

Preserved evidence is only the immutable mode-`0444` receipt/snapshot/manifest under
`/Users/timbartz/Dokumente/GitHub/taptime-local-evidence/da5-v5-harness/attempt11-a0359a87-fdf09c30`,
with SHA-256 respectively
`9b555534c18ca90fb1a4c18f377bb5f488d04f8805db3692564ff4d08f9916ef`,
`6f0a840d22a17fcc6b77a1f447bf6e1f23ef6f15fecf96b77a7dde491da58abc` and
`b1e198bd18e3c5eb71e4374f4114e3620f79929732bc87083dc834275cad5653`; directory mode is `0555`.
Independent failure/evidence review returned `CHANGES REQUIRED` with exactly one P2. Gate 32
proves only the exact mapped Vitest run exited 1, with `raw_output_preserved:false` and
`mapped_process_exit_nonzero`. Assertion, collection, transform, hook, configuration,
worker/process and infrastructure causes cannot be distinguished; no Product, Harness or test
defect is proven. The fail-closed stop and cleanup remain safe.

Both passed Typecheck records preserve exactly nine result fields and
`raw_list_preserved:false`: Mobile recorded 103,561 bytes/868 final normalized entries and
Synthetic 68,700 bytes/569; each exact expected member is included. For any possible future
authorization, the open need is a bounded closed Vitest pass/failure result schema, a
source-allowlisted expected-test set with normalized repository-relative count/digest/membership,
test/file counts, and a closed failure category plus stable canonical signature. Messages, stacks,
raw stdout/stderr, arbitrary paths and secrets remain excluded. If JSON output were later chosen,
its output root would need exact command mapping, bounds, schema and cleanup. That Attempt-11
terminal runbook section itself binds no Attempt-12 candidate, token, digest, map or path and
grants no later execution authority. Do not
retry or resume Attempt 11, install, use ADB/device/Tags or start Hardware/Human/Product V5.

## Attempt-12 candidate operating contract — do not execute

Status is `REVIEW PENDING / NOT EXECUTED / DO NOT EXECUTE`. Attempt 11 is consumed and its single
P2 review finding is evidence undecidability at Gate 32, not a diagnosed Product, Harness or test
defect. This R0 ADO-only candidate creates no paths, worktree, installation, process, receipt or
other Attempt state.

Independent Attempt-12 Round-1 review returned `CHANGES REQUIRED` with exactly one P2: the
29-result/13-binding schema was not fully closed for type/null/default, lifecycle tuples,
category precedence and signature state. Round 2 corrected that point. Round-2 review returned
`CHANGES REQUIRED` with exactly two P2 and one P3 for incomplete within-bucket simultaneous-fault
precedence, absent disclosure-safe signal termination and stale document-head truth. Round 3
corrected those findings. Round-3 review then returned `CHANGES REQUIRED` with exactly one P2:
signal-terminated `WORKTREE_ADD[0]` was not fully integrated into Cleanup V2 timing,
reattestation and removal authority. The first focused correction closed that coupling. Its
re-review returned `CHANGES REQUIRED` with exactly one P2 because terminal `cleanup_residue` lacked
schema-legal absorbing receipt retention for all 56 mismatch/ambiguity tuples. This correction
closes only that point and remains independent-re-review pending.

If and only if independent review returns `APPROVED` and this exact candidate is then published,
the standing Human authorization may activate one exact R3 Attempt-12 run. That conditional run
uses token `710d46dc`, exact unchanged source
`a0359a87fd1738c8493929a1661cbbc7adb3c07c` / tree
`102c913e264bd0ccce1d085db1c50bd407f7d4a4`, the inherited direct no-shell 45-gate order and
three npm groups, Membership Receipt Schema V1 and Cleanup Receipt Schema/Contract V2. The exact
descriptor/npmrc/map SHA-256 values are
`dffb1647781084f9e81ff34447d603ebbfaad1c2b1d595109b1eebc6cbd9210a`,
`7308ea83d13da67fa75178f530444db9649f371cd79266363d1f2d7f49f64c82`, and
`5bc7e519d4a942f4ceed7e5a4b3a5e6dc5ecbf6d8b7ac8648616d0e0a2291a03`.
The command map is exactly 222,596 compact UTF-8 bytes. Cleanup Receipt Schema V2 is exactly
84,102 compact UTF-8 bytes / SHA-256
`4caa1b43e2b99b22400ce16213bff4b890dd855b13e4caafae8829fe7ff82d94`. The embedded reporter
schema remains exactly 73,538 compact UTF-8 bytes / SHA-256
`c78b307bb5003e1d81a97dd909b9ddaeeabda4c98d1475f1a185e680cfb304a7`.

Before Gate 32, `DEPENDENCY_BINDINGS` must verify the exact locked reporter implementation files
and package-lock resolved/integrity. At Gate 32 the exact existing process receives only
`--reporter=json` and the exact checkout-internal `--outputFile`. Stdout/stderr use non-forwarded
1 MiB bounded pipes whose content/digest is discarded; overflow fails closed. Before spawn,
reporter root/file must be absent. After spawn,
the runner bounds the file at 16 MiB, verifies `lstat`/realpath/device/inode/regular-file and exact
single-entry containment, parses strict UTF-8 JSON in memory, rejects unknown/unbounded fields,
normalizes only canonical checkout-contained test paths, and checks exact counter, status,
membership and exit consistency. Expected membership is the embedded exact 13-file tracked
allowlist; compact set SHA-256 is
`6d3d0d28585a65d8e1357716285896176549416262b3fdba5e5a88ff4966716f`.

Persist only the exact 31-field sanitized result plus 13-field reporter-binding receipt. Every
direct child process record includes only closed `termination_kind`, `exit_code` and
`signal_category`; raw signal names/numbers and synthetic signal exit codes are forbidden. Raw JSON,
stdout/stderr, names, titles, messages, failure messages, stacks, timestamps, metadata, tags,
arbitrary paths and secrets must not enter any receipt, snapshot, manifest or artifact. Reported
failure classes remain explicitly ambiguous when the JSON cannot safely narrow them. Stable
signatures cover only the closed canonical sanitized values and identifier hashes.

Construct all 31 result and 13 binding defaults before the first fallible preflight step. Follow
only the embedded twelve-state lifecycle and terminal tuples. Before full normalization the
status matrix mandates null process/reporter/observed/count/signature fields as applicable; a
started process has exactly an exit/integer/null or signal/null/closed-category tuple, and a
normalized result always has all safe counts, exact membership and a nonnull signature. Select
the one validation code using the 46 strictly ranked checks; `unknown_field` precedes
`schema_type_mismatch`, and all 12 multi-fault fixtures must match. Then select category/code by
the exact first-match exhaustive algorithm; do not infer or combine categories.

For `WORKTREE_ADD[0]`, copy outer `termination_kind`, nullable `exit_code` and nullable closed
`signal_category` exactly into `identity_binding_timing` and reject any inequality. On signal,
reattest checkout, registration and worktree mapping once; classify every observation exactly as
`absent|exact|mismatch|ambiguous`. All absent is unbound, all exact is bound, other absent/exact
mixtures are partial, and any mismatch/ambiguity is cleanup residue. Do not launch deletion from
unbound, partial or residue. A fully exact signal-bound state may enter Cleanup only through the
existing identity-/mapping-revalidation rules; signal still fails the process gate and never
authorizes a later fallible spawn. The eight signal fixtures and six termination fixtures are
normative; removal-without-full-binding is rejected.

For each of the 56 mismatch/ambiguity tuples, persist `cleanup_residue` at binding. At `CLEANUP`
and `POSTCLEANUP`, retain residue only under the exact named boundary rule: increment the sequence
once, preserve every other cleanup-state fact, set every root/registration removal attempt false,
and do not repair, rebind, reobserve-to-bound, resume or promote. Do not interpret this as a
general residue self-transition. At `FINALIZE`, perform no transition or removal; copy the named
gate records exactly, keep residue, set both completion flags false and record `FAIL_CLOSED`.

Remove the exact reporter file/root by recorded identity before writing the Gate-32 receipt. If
identity-safe removal is impossible, record only the bounded deferred disposition, do not copy the
raw reporter, fail the gate, and leave removal solely to the already bound Gate-43 checkout
cleanup; `FINALIZE` cannot pass until Cleanup V2 proves complete absence. Never rerun Vitest for
diagnosis. Do not start any of these steps before approval plus publication, and do not use this
candidate for Hardware, device/ADB/Tags or Human/Product V5.

If cleanup residue follows normalization, keep normalized counts, override category/code to
reporter-contract/cleanup-failed and recompute the canonical signature before receipt append.
Before normalization, signature is always null. A missing, null or stale signature in a purported
normalized tuple is invalid evidence and fails closed.

## Attempt-13 superseding execution-binding candidate — do not execute

The independently reviewed read-only publication-candidate root is
`/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-harness/attempt13-executor-4dad93bd-483fcf40-r6-execbind`,
mode `0555`, with exactly two mode-`0444` entries: executor 376,105 bytes / SHA-256
`810090e78b247820a2ffb24a97846d74c76768db22c2e3d5f77c68084c7e50b6` and manifest 2,648 bytes /
SHA-256 `b60ecb41200c4cbc5010fba22af63ab919ee373ae0b6f80fa1cc5628a7778717`. Candidate review may use
only these non-mutating artifact commands:

```text
/Users/timbartz/.nvm/versions/node/v24.17.0/bin/node --check /Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-harness/attempt13-executor-4dad93bd-483fcf40-r6-execbind/attempt13-executor.mjs
/Users/timbartz/.nvm/versions/node/v24.17.0/bin/node /Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-harness/attempt13-executor-4dad93bd-483fcf40-r6-execbind/attempt13-executor.mjs --self-test
```

The executor separately verifies, before `EVIDENCE_INIT`, the immutable Round-5 candidate and its
single parent/tree/exact six-path canonical delta; both exact correction/closure commits, trees and
single parents; corrected source `4dad93bdbc3ccd3e09e2bcfba3680130a90e2799` /
`d44bc534c16866dbc16cd889098e6ca33d75d1f5` with Synthetic test blob
`183b82674ed92e51375fad41e9efb034976ff5e3`, 94,403 bytes and SHA-256
`f47409fa4135e45c04ac63b00dc02cd636375cd7728b6a5d1d9b67f6ad6cc198`; and the
execution-publication domain. The byte-exact Attempt-12 command-map SHA-256 remains
`5bc7e519d4a942f4ceed7e5a4b3a5e6dc5ecbf6d8b7ac8648616d0e0a2291a03`.

The execution publication must be a single-parent commit directly after
`2a5f32b2d29d03f26e53eee07dfe3d0658192b49` / tree
`29a8485f2a19e20ae0c483e701b4a0e36a1ad4a7`; caller-bound commit, tree and canonical delta must
match HEAD and local `origin/main`, exactly the six scoped ADO files and a clean scoped worktree.
Its commit, tree and canonical delta are intentionally not embedded or self-referentially asserted
by this document or the manifest; the caller must bind them exactly at invocation. The invocation
shape is:

```text
/Users/timbartz/.nvm/versions/node/v24.17.0/bin/node /Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-harness/attempt13-executor-4dad93bd-483fcf40-r6-execbind/attempt13-executor.mjs --execute \
  --approval-token APPROVED_ZERO_OPEN_P0_P3_EXACTLY_ONE_ATTEMPT13_R3 \
  --expected-manifest-sha256 b60ecb41200c4cbc5010fba22af63ab919ee373ae0b6f80fa1cc5628a7778717 \
  --execution-publication-repository /Users/timbartz/Dokumente/GitHub/taptime \
  --execution-publication-commit <exact-future-published-commit> \
  --execution-publication-tree <exact-future-published-tree> \
  --execution-publication-delta-sha256 <canonical-direct-six-path-delta-sha256>
```

This command is reference-only and forbidden without a separate exact Human single-run
authorization. The normative gate order is the approved prepublication exact-delta/artifact
review, focused exact publication, one local AVS R3 verification of the publication, one V4
exact-head CI, final independent exact-head/artifact review `APPROVED` with zero open P0–P3, and
only then that Human authorization. This embedded document makes no claim that the external V4 or
final-review evidence occurred. No step activates the next automatically. Attempt 13 is **NOT
EXECUTED / DO NOT EXECUTE**. Hardware, ADB, installation, Human/Product V5,
production, production data, deployment and distribution remain unauthorized.

## Historical Round-5 candidate procedure — superseded unchanged

Attempt 12 is consumed with immutable 34/2/9 gate distribution, no artifact and no retry. Do not
rerun or diagnose it. Attempt 13 uses fresh token `483fcf40` and the exact paths and external
executor hashes in the authorization. During candidate review only these non-mutating commands are
permitted:

```text
/Users/timbartz/.nvm/versions/node/v24.17.0/bin/node --check /Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-harness/attempt13-executor-a0359a87-483fcf40-r5-plcym5sw/attempt13-executor.mjs
/Users/timbartz/.nvm/versions/node/v24.17.0/bin/node /Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-harness/attempt13-executor-a0359a87-483fcf40-r5-plcym5sw/attempt13-executor.mjs --self-test
```

Neither command may create an Attempt path. The retained Round-3 and Round-4 artifacts remain
immutable and were superseded by this now-historical Round-5 candidate. The Round-5 artifact is
352,258 bytes with executor SHA-256
`f5cad177fc8efaefcb0d8d1b52f626c809be9cb3f46e9446a62cd6b60a74b4ec`; its 1,111-byte manifest
SHA-256 is `8d6416d99717efe8929d3f6dcb639fa10a9dd8ab14dd452eabc6d23ca9d23fab` and binds the superseded
Round-4 root plus both Round-4 entry digests.
Round-2 review returned three P1 and four P2 findings; Round 3 corrects receipt/Gate-42/artifact
transactions, fresh Postcleanup observation, committed-record quality links, Gate-32 matrix and
failing-file closure, and exact source identity. The focused Round-4 correction closes the local
snapshot-residue branch, total truthful artifact rollback under state ambiguity, prejournal
rollback-failure retention and the stale authorization header. Formal Round-4 review returned
`CHANGES REQUIRED` with exactly two P1 findings. Focused Round 5
persists the descriptor/lstat-bound receipt creation identity before fallible initial
realpath/readback while retaining the handle and binding on failure. It also requires strict exact
artifact state, transaction and nested identity shapes before equality, absence or removal: only
exact `{exists:false,stat:null}` proves absence; malformed, falsy or partial values retain residue
with zero removal, and empty identities never compare equal or establish creation binding.
Development syntax passed, and the necessary final bounded collect-all no-mutation self-test
passed 314/314 fixtures, 45 gates and 25
collectable gates with zero fixture failures. Fixture-name-set SHA-256 is
`8d69314f7a703cfe5c44011033e3325e505667c33f9d631618172ff72e9262c4`; empty failure-set and
empty-ledger SHA-256 are `4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945`;
maximum-ledger SHA-256 is `8b3f59e179040dcb3d30611abb1ef55fc679b4fe807ac9ce721d678fc122055d`, with
`raw_output_preserved:false` and `mutation_performed:false`. Intermediate development runs failed
closed at one legacy fail-fast fixture, one pre-fixture name guard and the complete nine-item
preflight matrix before their common map-derived correction. Independent exact-delta/artifact
re-review remains pending. The prior V3
claim remains revoked; V3 is `PENDING` until the Technical Lead independently repeats the final
exact checks. Product source remains unchanged. This was not Product or Attempt execution, created
no Attempt path and proves no Product correctness.

The historical Round-5 order printed here is superseded by the execution-binding procedure above.
The normative gate order is independent prepublication exact-delta/artifact review of the
superseding candidate `APPROVED` with zero open P0–P3; exact publication; exactly one local AVS R3
verification of that publication; one new V4
exact-head CI; final independent exact-head/artifact review `APPROVED` with zero open P0–P3; then
a separate exact Human authorization for one Attempt-13 run. The local R3 verification is not an
Attempt execution. No step activates the next automatically. The obsolete Round-5 command below
is retained as historical text only, is not valid for the superseding candidate and remains
forbidden. Only a later separate Human authorization may bind its exact published
commit, tree, delta and single-run scope before the Technical Lead invokes it:

```text
/Users/timbartz/.nvm/versions/node/v24.17.0/bin/node <exact-executor> --execute \
  --approval-token APPROVED_ZERO_OPEN_P0_P3_EXACTLY_ONE_ATTEMPT13_R3 \
  --expected-manifest-sha256 8d6416d99717efe8929d3f6dcb639fa10a9dd8ab14dd452eabc6d23ca9d23fab \
  --publication-repository /Users/timbartz/Dokumente/GitHub/taptime \
  --publication-commit <exact-published-commit> \
  --publication-tree <exact-published-tree> \
  --publication-delta-sha256 <SHA-256-of-exact-git-diff-output>
```

The delta digest is SHA-256 of the executor's exact direct `git diff --binary --full-index
--no-ext-diff <preparation> <publication> -- <six sorted ADO paths>` UTF-8 stdout after removal of
its single final LF. Never substitute a different digest convention.

Operational interpretation is deterministic:

- The pure-fixture `--self-test` is bounded collect-all: it executes every isolated allowlisted
  fixture, returns sorted closed failure tuples and their digest, and is PASS only with zero
  failures. Runner setup, overflow, artifact/map IO and non-fixture infrastructure errors hard-stop.
- Gate 42 permits exactly three snapshot outcomes: `snapshot:null` only after proved absence; the
  unchanged fully bound `{name,bytes,sha256}` object; or the fixed safe-name residue
  `{name,status,removal_attempted:false}` with status `present_unbound|present_ambiguous`. Residue
  exposes no bytes, digest, content, raw path or identity details, authorizes zero removal, forces
  `evidence_preserved:false` and `FAIL_CLOSED`, and remains in the exact three-entry Evidence set.
- Artifact rollback requires exact parent and creation identity. Null/partial transaction state,
  an observation failure or missing/ambiguous binding authorizes no removal and finalizes only a
  truthful residue with no success claim. A creation-bound descriptor requires a proved created
  object and nonnull creation identity.
- Prejournal rollback failures are never suppressed and never clear the receipt/root bindings
  still required for exact terminal recovery. Incomplete or ambiguous recovery records only the
  closed safe outcome and performs zero unbound removal.

- A collectable quality failure does not stop unrelated gates. Record it once, continue only DAG
  nodes whose direct prerequisites remain available, and mark direct dependents
  `dependency_omitted`.
- A signal, non-start, infrastructure/worker anomaly, parser/schema/bounds problem, raw-output
  risk, path/symlink/special-file/output-root mutation, source/tool/publication/identity/mapping
  mismatch or Cleanup anomaly hard-stops; remaining Gates through 41 are
  `not_run_hard_stop`.
- Gate-32 preflight failure remains a legal `not_started` result. If the mapped process never
  starts, persist `processes:[]` plus the explicit gate termination tuple. Its pre/post inventory
  has exactly two allowed roots, `node_modules` and the reporter root; only the exact
  identity-bound reporter root may change and must be restored.
- Gates 42–45 always run. CLEANUP and POSTCLEANUP must each retain their mapped child record and
  the four exact cleanup objects. Never remove a checkout or registration unless all exact
  identities and the worktree-list mapping revalidate.
- Do not add a Git probe around Cleanup or Postcleanup. Use only their mapped children and fresh
  bounded filesystem/mapped-output observations. Missing, partial, mismatched or ambiguous binding
  performs zero removal and ends in absorbing `cleanup_residue`; only exact bound state may proceed
  `bound -> cleanup_applied -> cleanup_complete`.
- Gate 32 may be collected only after complete normalized 13/13 membership and safe persisted
  `failing_files`. Validate the exact 31-field result, 13-field binding and all cross-field
  partitions against the loaded map's
  `DA5_V5_ATTEMPT13_VITEST_FAILURE_SIGNATURE_V1`. Source size/digest drift uses the existing
  `unexpected_file_path` code. Reporter/signature/cleanup uncertainty hard-stops.
- Gate 39 remains independent of Gate 38, but requires the successful exact Gate-34 esbuild and
  metafile after a green first Gate-34 child. Gate 40 requires Gate 39. Gate 41 requires zero
  failures and no residue.
- Do not create the success artifact at Gate 41. The executor stages two bounded files in memory
  and publishes them only during successful Finalize after exact Cleanup/Postcleanup. Any failure
  requires artifact-path absence.
- Finalize must derive from frozen copies of already committed records. Its common transaction
  stages artifact/evidence/modes and commits the receipt last; any caught write/chmod fault rolls
  back the staged prefix. Do not claim crash atomicity.

Do not manually repair, resume, remove ambiguous residue, repeat only failed tests, or invoke a
second Attempt. Stop after the one terminal receipt. Hardware, ADB, install, device/Tag and
Human/Product V5 operations are outside this procedure.
