# Risk Register

Status: Active

Current R-038 dependency-security override: **Temporarily accepted through `2026-09-09` only for
the exact four-path DA5-V5 code candidate on baseline
`627e8512631c53bc2c6882aed80b163ab81051fd` / tree
`dfaf1d32574e4253aad07d99d84e3489cc5634aa`, pre-ADO diff SHA-256
`7d76ebb9d717ca7b2578b3e50e192b1abf1140c24b2895e5a1c4ff5ee870b37e`.** The lock correction
selects `js-yaml@4.3.1` and `nanoid@3.3.18`. The only accepted High findings are transitive `image-size@1.2.1`
`GHSA-w3rx-r6r6-pgpr` and `GHSA-5p2g-fcmc-qvqq`. Acceptance is limited to the reviewed
Expo/Metro build-tool path over fixed local Product inputs and does not accept new runtime,
untrusted-input or production reachability. This ADO-only synchronization does not broaden the
exception; any bound code/lock blob or reachability drift reopens it. Upgrade/removal or a new
explicit Human disposition is required no later than the expiry. Publication, Exact-Head CI and
every Hardware action remain separate gates.

Current R-034 ADB-reverse override: **Open only through separately gated Product Human/Hardware
V5 — latest run consumed/final-null; published `DA5-V5-PRODUCT-ADB-REVERSE-01` is V4-bound,
technically closed and artifact-bound, with final independent Review `APPROVED` and zero open
P0–P3. DO NOT INSTALL / DO NOT START.** On baseline
`6b7f60ba483a65f1723cbf29e87f8a439f0804c9` / tree
`fbe43ebce13fdc0d7851ca8384043b948c9ca898`, the run created the two owned reverse mappings and
then stopped before `install-create`. Bound ADB-37 `reverse --list` emitted exact transport
identifier `UsbFfs`; the Mobile and Synthetic parsers incorrectly treated it as the bound serial,
causing fallback `child_start_transport` and cleanup substage `reverse_list`. Terminal
recovery/observation established final null and no Product package installation, authentication,
NFC, Product or time action occurred.

One diagnostic post-failure mapping mutation is a P2 process risk and is excluded from authorized
run Evidence. It cannot validate the correction or any Product/Hardware result. The published
correction accepts only `UsbFfs`, retains identity exclusively through the bound `-s`/USB/model/
build/continuity chain and rejects foreign/malformed/duplicate/mapping-set ambiguity. Mobile
54/54 files and 1,243 tests, Synthetic 14/14 files with 291 passed plus 18 expected skips, focused
128/128 plus 13/13, the 2/2 bundle smoke and both tests-inclusive Typechecks are green. The
exactly-once final V3 is also `PASS` on the unchanged baseline/tree and pre-ADO-sync exact 11-file
Full-Index/Binary patch SHA-256
`a2baca0159e1c64c8b552a2d95b9b29aad5b5196be6aa11c205572df510bf1d6`: MJS syntax; complete
Mobile/Synthetic suites and Typechecks; exact 868/571-entry changed-test membership with SHA-256
`6d29af79968b01bb14f14b0ec3b0b280b4c6fd8dd4e9be04bab3b8cc7f34f3fe` /
`c79f5c314c1bc3df8002bc7ba53d975d4f671c8e49575f12e83b1134dacd84ae`; Synthetic build and bundle
syntax. Product/Validation APKs, Product rules, NFC, dependencies, lockfile, schema and workflow
are unchanged.

Executable publication `f8d68c541056cb19e0f222b8a2c04cd3db2b734f` / tree
`ddb4a69a2db0167b7a57c4f708f2cc64553f4799` has direct parent
`6b7f60ba483a65f1723cbf29e87f8a439f0804c9` / tree
`fbe43ebce13fdc0d7851ca8384043b948c9ca898` and
the exact 11-file, 38,897-byte Full-Index/Binary delta SHA-256
`abec3ca7acbe4619c724fa7dba9422db4dc987d48844f0d39a31043b9d32fdc9`. Exact-Head CI
`30943224381`, attempt 1, passed 12/12 without retry. The fresh exact-head runtime is read-only,
tracked-clean and artifact-bound; final sandbox-enforced Exact-Head/Artifact Review blocked an
adversarial write, proved repository/artifacts unchanged and returned `APPROVED` with zero open
P0–P3. This R0 ADO closure claims no CI for its own future documentation head. New ADB,
installation, Hardware, Human V5, production, production-data, deployment and distribution
authority remains absent.

Prior R-034 CI-clipboard-cleanup override: **Open only through the separately gated Product
Human/Hardware V5; the R3 executable correction is published, V4- and artifact-bound, and final
independent review is `APPROVED` with zero open P0–P3. Hardware remains DO NOT INSTALL / DO NOT
START.**
`DA5-V5-PRODUCT-INSTALL-02` is independently approved and published at
`c92744bc35a2c2fca27dd5ff7c54b39a93692fde` / tree
`60ef4d73916370367e5259e6557014e0364139b8`, but Exact-Head CI `30926820054`, attempt 1, is
11/12 without retry. All INSTALL-02 regressions were green. The sole failure is confirmed
`DA5-V5-CI-CLIPBOARD-CLEANUP-01`: Linux startup cleanup attempted macOS-only clipboard commands
despite no prior credential/clipboard ownership. The published correction binds cleanup duty before
possible mutation, releases it only after a zero proof, performs pristine close without a
platform process and preserves fail-closed cleanup for every outstanding duty. Independent review
returned `CHANGES REQUIRED` with exactly one P1: close could begin during initial clear and the
waiting inject could then write once. The correction rechecks close before the non-empty write and
returns `mismatch`. Focused 15/15 tests and tests-inclusive Synthetic Typecheck are green;
independent re-review returned `APPROVED` with zero open P0–P3. The exactly-once final Synthetic
V3 passed 14/14 files, 291 passed, 18 expected skips and 309 total; Typecheck, 571-entry membership,
build and bundle syntax passed. Unchanged Mobile/backend/dependency evidence carries under Lean
V5/ADR-0019.

Executable publication `7eead7560b075763a8ef5076d499b621d63dc3c7` / tree
`a832bcd574af169fd9600a2a0940f5f5d962914f`, parent
`c92744bc35a2c2fca27dd5ff7c54b39a93692fde` / tree
`60ef4d73916370367e5259e6557014e0364139b8`, changes exactly eight files. Its 32,916-byte
Full-Index/Binary delta has SHA-256
`c763bee4b070ec56ffbe799485df34e6e003665e39bd9fd0c0fa705b941d3bd8`; prepublication
correction re-review and publication-delta review are each `APPROVED` with zero open P0–P3.
Exact-Head CI `30930590588`, attempt 1, passed 12/12 without retry.

Fresh read-only Operator Runtime
`/Users/timbartz/Dokumente/GitHub/taptime-local-artifacts/da5-v5-product-operator/7eead756-dbacb6b9`
is exact, detached and tracked-clean, contains only `checkout/` plus its mode-`0444` manifest, has
no `research/`, and has no remaining task cache. Its mode-`0444` bundle/map/manifest are 894,993 /
1,659,518 / 6,815 bytes with SHA-256
`dbacb6b9c5c1a5e1a0960441331580acc6acf8e6f3c99e34985d99d504c80e3f` /
`c2e6eeb28be5dc6d0bfcb9ee19804e4ae61ba17143ad59c8d4d152988bdcc6dd` /
`320efc48f083d9b42bad043eac2e9c81cd0b8c21ea2f04487841666a41f36c32`. Node `24.17.0` / npm
`11.13.0`, fresh `npm ci` 695/717 and 18/18 dependency-closure builds bind the unchanged lockfile.
The unchanged Product APK remains mode `0444`, 95,522,751 bytes, SHA-256
`b0180c31769e453472a20eb1e7eb4e0825a85be9429becf6bf4970e0875b67f8`.

The first final substantive review found no Code, Artifact or CI defect but formally returned
`CHANGES REQUIRED` with one P2 because runtime read-only was not technically enforced. Fresh
independent re-review ran wholly under `/usr/bin/sandbox-exec` with `(deny file-write*)`; its
adversarial write attempt was blocked, and repository/artifacts remained identical before/after.
It returned `APPROVED` with zero open P0–P3 and closes that formal P2. Residual R-034 exposure is
therefore the separately unauthorized Human/Hardware V5, not an open clipboard correction.

No Hardware, ADB or installation occurred or is authorized; production, production data,
deployment and distribution remain separately unauthorized. This ADO-only R0 closure sync claims
no own test, CI or Artifact execution and does not move executable head `7eead756…`. A later
Hardware prompt must separately bind that executable head and the exact published ADO-closure head.

Historical prepublication R-034 Product-install-02 record: **Open / R3 Round-2 correction passed
final Lean-V3; independent Review Round 3 was pending and Hardware was prohibited at this recorded
point.** This section is superseded by the current override above. The Human Architect accepted the
Product-Human/Hardware run on `8723221aba847f778f97febc13f4dd8c1447cac4` / tree
`fcb6249a5ccdb402a39f7a0dd7beefb4930651d7` as consumed and fully cleaned. It reached complete
Product-APK runtime verification, then disclosed only install category `cleanup` and terminal
cleanup failure. Final scoped recovery proved Product/Validation package and process absence,
zero authorized reverse mappings/listeners, zero task-owned runtime state and destroyed
memory-only credentials; no authentication, NFC, Product or time action occurred.

`DA5-V5-PRODUCT-INSTALL-02` is confirmed: cleanup overwrote the primary install category;
session/abandon/cleanup state was not a durable per-run transaction; transient cleanup failures
could stop progress without a closed substage; and signal abort was not distinct. The local
uncommitted candidate on that unchanged baseline adds exact transaction/runner/device/serial and
memory-only ownership binding, persistent coalesced cleanup with at most one abandon attempt per
bound session, primary-plus-cleanup disclosure and fail-closed `signal_abort`. Independent review
Round 1 returned `CHANGES REQUIRED` with exactly two P1, four P2 and one P3. The corrected
candidate now requires proven zero plus a resource-specific mutation before removing the Product
package or either mapping; pre-existing foreign state is observation-only. It keeps one persistent
package-removal flight, never uninstalls during final-zero, rejects stronger later uncertainty as
`uncertainty_escalation`, terminally settles signal/EOF cleanup rejection, and applies one absolute
60-second uncertain-cleanup deadline. Only explicitly typed transient command failures retry once
at the three authorized cleanup boundaries; abort, device/binding, parse, ownership and permanent
errors do not retry. Round-2 independent review returned `CHANGES REQUIRED`
with exactly one P1 and no P0, P2 or P3 because early null-resource cleanup could complete while
Guard, PostgreSQL capability or Environment acquisition remained in flight. The correction keeps
immediate failure/abort/input latching and gates one persistent cleanup flight on independent
monotone startup settlement; normal lifecycle handoff and catch settle without a signal-cycle, so
every late acquired resource is closed exactly once. Focused Synthetic profile 36/36 and the
tests-inclusive Synthetic Typecheck passed.

Final composite Lean-V3 is `PASS`. Before this ADO sync the candidate remained exactly 12 tracked
paths, 158,738 full-index/binary bytes, SHA-256
`ef86b48ad5882b1020b593a8a82139ff618a5b0dd0ef7d2eff2e1433493b557a`. Fresh Synthetic passed
14/14 files, 286 tests plus 18 expected skips, tests-inclusive Typecheck, exact 571-entry
membership SHA-256 `45ac1d63ca5f619fcb432594b8495ec08968af1aed99edb8c336d357dcb74e5b`,
build and bundle syntax. The fresh mode-`0644` bundle/map are 894,145 / 1,658,075 bytes with
SHA-256 `6612aca547727e1b77b2e0deb88bd029f80fba0eb30ca39c962fe84fbb9a5f19` /
`a010852ceebe55878e7b211b183ea785a86a812336ab73f0eff246e6da992779`. Byte-identical Mobile
evidence carries without rerun: 54/54 files, 1,243/1,243 tests, Typecheck pass and 868-entry list
SHA-256 `11d72c73fe9c420a4c7b4aaadbdcad91187ec78500b5f7c8b68c9dd07f2f82e6`.
AVS carry-forward is limited to the remaining 19 unchanged workspace test suites, 19 Typechecks and 19 builds, Guard 89/89,
unchanged privileged database/migration evidence, dependency installation/integrity/audits,
C3B/Android export/APK verification and cleanup from exact composite source
`bcddf757c7ef64e82c167b39f20d763fdb159ceb` / tree
`ee00e3246f2cd5498cc67eabf9b2f7e2fc19205b`; fresh Synthetic replaces its old evidence, exact
Mobile evidence carries as stated, and old runtime bundle/map/manifest does not carry. Residual
risk remains R3 until independent final Review Round 3, V4, exact publication/runtime binding and
final approval. The candidate remains uncommitted and unapproved. No APK, dependency, lockfile, schema, workflow,
Product-rule or NFC change is present; Product and Validation APKs remain unchanged. Hardware,
ADB/install, CI, V4, publication, a new Product-Human V5 run, production, deployment and
distribution remain unauthorized.

Current R-034 Product-start-bundle override: **Open / R3 only pending fresh Product Human/Hardware
V5 authority.** The authority on
`4dff147031e2d8ebbd95b9451705f66b35fbacd3` is consumed after the standard Product operator
stopped before database, device preflight and installation. Confirmed finding
`DA5-V5-PRODUCT-START-BUNDLE-01` was a bundled-module direct-CLI false positive in
`verifySyntheticE2eAndroidRuntime.mjs`, not a Product-APK, device or NFC failure. Post-failure
read-only evidence proved package/process/reverse/listener/task-runtime null state.

Correction `e939d8c40e7994c72ab1cd2e68e47f189ed8abc1` / tree
`dfd5e160c6c14d09daadcc192afaf81daf1ad060` preserves exact external APK verification while
making import and bundled execution side-effect-free. Focused tests, hardware-free artifact
smoke, fresh V3, audit without High/Critical, runtime binding and cleanup are green; independent
prepublication review is `APPROVED` with zero open P0–P3. Publication
`e5a566bc60be7dc7647183bbbcfb9947ac3a6fb7` / tree
`05a0f4c2ff4006a73ec18b2d19c74cb903d064f0` passed Exact-Head CI `30834192270`, attempt 1,
12/12 without retry; final independent Exact-Head/Artifact review is `APPROVED` with zero open
P0–P3. Residual risk is limited to the separately authorized Human/Hardware gate. Product and
Validation APKs are unchanged. Hardware/ADB/install and all production/deployment/distribution
actions remain unauthorized. This R0 sync claims no CI for its documentation-only head.

Current R-034 Product-preinstall override: **Open / R3 pending R0 ADO review and fresh Product
Human/Hardware V5.** The matched read-only inspection on `304ddb159f3def2b50d059678086e02aacbd51c9`
did not start the operator or install anything; its authority is superseded. Correction
`e525a9ad2b937356002928028fddaaa3e1dca301` / tree
`11aa7fdf526c9b149af5dc60ef5567fb727a24fe` closes Android-15 package-null handling while
preserving strict path/process/joint-null/cleanup boundaries. Both code and fixture corrections
are independently `APPROVED`; Exact-Head CI `30829321321`, attempt 1, passed 12/12. Final technical
review requested only this P3 sync. Hardware/ADB/install and production, production-data, signing,
deployment and distribution remain unauthorized.

Current R-034 Lean-V5 override: **Open / R3 only pending the separately authorized Product
Human/Hardware V5 gate.** The Human Architect accepted ADR-0019 and the Lean authorization at
`83635335aa4f547dc8994243c604dacf9797f593` / tree
`40b7655a94e607b8afe19f90f42a95f42ee6d582`; independent architecture/authorization review is
`APPROVED` with zero open P0–P3. Lean stages 1–5 and automated V0–V4 completed on executable
candidate `1b341d83592ea457c8ca722d01bfa2e64fe8cc40` / tree
`2db756832a81f07cdb1a927ff3076320cc253960`. Its exact six-file executable delta changes no
dependency, lockfile, schema, workflow or Product rule.

Fresh isolated V3 passed all applicable builds and workspace typechecks plus 2,835 tests and two
expected/disclosed B1 skips; exact-head CI `30786622180`, attempt 1, passed 12/12 without retry.
Prepublication binding review and final Exact-Head/Artifact review are `APPROVED` with zero open
P0–P3. Fresh artifacts are exactly bound and cleanup is complete: PostgreSQL stopped, port closed,
task worktree/cache/cluster absent. The automated mitigation is complete and the candidate is
hardware-gate ready. The Product App is not installed; Hardware/ADB/install and all production,
production-data, production-signing, deployment and distribution actions remain unauthorized.
Attempt 15 remains consumed with no retry. This R0 sync does not claim CI for its future
documentation-only head.

Historical superseded R-034 Attempt-15 override: Attempt 14 is consumed fail-closed on publication
`7f6c94886b4dff263e364ea8860b5de1b98b3b53` / tree
`c6df9d7b05374f2baba369d3ca163ea83048b68a` with no retry, repair, resume or further execution.
Its immutable 45 records are six passed, two failed and 37 hard-stop omissions. Gate 4 `NPM_CI`
failed with `unexpected_output_root` although the mapped process exited 0 with zero stdout/stderr
bytes; quality-failure count is zero, Cleanup/Postcleanup are complete, artifact is `null` and raw
output is false. The immutable mode-`0555` Attempt-14 Evidence root contains only three
mode-`0444` entries: receipt 110,812 bytes /
`6001c9786038acc8d76e08f9842ccd3b84dc714017134f3aad8df1e5ac779f88`, snapshot 2,490 bytes /
`b75dd8ae0f973171f3806c03f963a4f500901e968ef8b2b99ab3cda60b0219bb`, and manifest 1,147 bytes /
`53987c9676748016e7e1d16cfac8306266622d6e9a25102e86bb5c834cf5588c`. No Product, test,
Hardware or Human-V5 conclusion follows.

Residual status remains **Open / R3**. The prospective read-only Attempt-15 candidate root
`attempt15-executor-4dad93bd-cfea2c8a-r1-outputbind` is mode `0555`; its only mode-`0444` entries
are executor 410,449 bytes / `19fe8fe403c230ea0bd914d7e7beb54552954b161bf92033483d92c9a17b6769`
and manifest 4,782 bytes / `ecc5c2ced55db323bc02af9cf225161171b3bc59f0ed96c95da821422ef2c440`.
It preserves the exact original map and all unchanged Attempt-14 bindings. The bounded correction
derives allowed NPM_CI output solely from exact source lockfile blob
`77555096088f864860f2b6c75f51d364a7349d65`, 356,795 bytes / SHA-256
`62b8eb3f80ab31b683b263631ccfa915f25a9743d4d7430cbb05f81c9e8e1470`, plus the exact known
workspace boundary: 34 direct install nodes, 17 workspace roots / compact-list SHA
`13457aaa6dbfe55870b5dcc813eb3fd602d9bf0c3939378b89282c0ac087131f`, and with root
`node_modules` 18 internal roots / SHA
`8f2294960bc1db56e066acc987705918f914a5dd628ee3ff2f60c371ce4ce856`. Only the exact unchanged
cache is additionally allowed. Missing/malformed/oversize/drift lockfile, absolute/traversal path,
unknown workspace, count/digest drift or any adjacent/unallowlisted checkout output hard-stops
before progress; no broad root or glob is accepted. Development syntax and 387/387 bounded
no-mutation fixtures passed, but no independent review, publication, CI, final review or Attempt
execution occurred.

Attempt 15 is **PROSPECTIVE / READ-ONLY / NOT EXECUTED / DO NOT EXECUTE WITHOUT FUTURE SEPARATE
EXACT RUN AUTHORIZATION**. Its fresh token `cfea2c8a` paths and registration remain absent. Any
future execution publication must be one exact caller-bound child of `7f6c948…` / tree `c6df9d7…`.
All prepublication review, publication, local R3, V4, final independent approval and Human run
authority gates remain pending and caller-bound. R-034, Hardware/Human/Product V5 and production,
deployment and distribution prohibitions remain open. This block supersedes the older current
Attempt-14 candidate text below without rewriting history.

Historical superseded R-034 Attempt-14 override: Attempt 13 is consumed fail-closed with no retry, repair,
resume or execution. Its immutable 45-record evidence is five passed, two failed and 38 hard-stop
omissions; Gate 3 `SOURCE_TOOL_BINDING` stopped at `identity_byte_limit`, quality count is zero,
Cleanup/Postcleanup completed, artifact is `null` and raw output is false. Exact receipt/snapshot/
manifest identities are respectively 108,071 / 2,503 / 1,160 bytes and SHA-256
`6dacaad7db7bcec61f591724b3bcf6ce30aad88ecd2d60e05e301c3ca79285ae`,
`ea6b71d50122aefce343055cdef00422331c05247191beef1042ab6a6a39d74e` and
`2a2a19965a0708051dff7a7eda86eb4416c60b3f4dacb162d7590b2e9bd0a474`. Accepted independent P2/P3
findings establish the missing explicit Node byte-size binding and documentation correction
boundary; they establish no Product or test defect.

The immutable R6 executor is superseded by the read-only Attempt-14 execution/publication
candidate root
`attempt14-executor-4dad93bd-3cc91245-r1-nodebind` (mode `0555`; mode-`0444` executor 388,219 bytes /
`89c283b211456a1cf7ae20ee4ae551d7ef8a6a17dd443f541dd0cd2e314cfbb9`; manifest 3,729 bytes /
`c118bd24fe455f944bf81ccf10faeef7dea89f41f2b3490ee9470ad2228f69f1`). It preserves the original
candidate, closure chain, corrected source/tree/Synthetic blob and inherited serialized map hash,
but binds Node exactly to `/Users/timbartz/.nvm/versions/node/v24.17.0/bin/node`, `v24.17.0`,
120,591,840 bytes and SHA-256
`f5f9b9db4d95f5e0340982685f083de654c21eef9d9122cab5321081ccaa2601`. Explicit size is its exact
read limit and post-read equality; missing size retains the exact 32,000,000-byte generic limit.
Focused regressions cover size ±1, SHA drift, Node→npm→git order, pre-later-gate hard stop and
the unchanged cleanup/null-state closure.

Residual status remains **Open / R3**. Attempt 14 is **NOT EXECUTED / DO NOT EXECUTE WITHOUT
SEPARATE EXACT RUN AUTHORIZATION**. Any execution publication presented to the executor must be a
caller-bound direct child of
`da64ae31648166184739b056a917ea2762bc9f23` / tree
`a20721ad15c5c824f3bf32987449ffa08569bede`; independent review, exact publication, one local R3,
one V4 exact-head CI, final independent zero-finding approval and separate exact Human run
authorization remain mandatory. This embedded block does not itself establish completion of
those external gates; the separate exact run authorization must bind their external evidence.
This block supersedes only stale current
Attempt-13 preparation text below; R-034, Hardware/Human/Product V5 and all production/deployment/
distribution prohibitions remain open.

Current R-034 execution-binding override: the unchanged Round-5 executor is superseded by the
independently reviewed read-only publication candidate
`attempt13-executor-4dad93bd-483fcf40-r6-execbind` (376,105-byte executor SHA-256
`810090e78b247820a2ffb24a97846d74c76768db22c2e3d5f77c68084c7e50b6`; 2,648-byte manifest
SHA-256 `b60ecb41200c4cbc5010fba22af63ab919ee373ae0b6f80fa1cc5628a7778717`). Independent
prepublication exact-delta/artifact review Round 1 returned exactly one P3 for stale historic
labels; Round 2 closure returned `APPROVED` with zero open P0–P3. The candidate preserves
the immutable `387421b3caeed988b159c93ff217fb78a0bee60c` / `ace680660468e0374004869f205e6a1e0af0ac7f`
candidate and canonical six-path delta SHA-256
`301e74d813cff2648c0009a575df703ce886d21de8d23d18b8a8badb9a917024`; exact closure chain
`4dad93bdbc3ccd3e09e2bcfba3680130a90e2799` →
`2a5f32b2d29d03f26e53eee07dfe3d0658192b49`; corrected source
`4dad93bdbc3ccd3e09e2bcfba3680130a90e2799` / `d44bc534c16866dbc16cd889098e6ca33d75d1f5`
with Synthetic blob `183b82674ed92e51375fad41e9efb034976ff5e3`; and unchanged command-map SHA-256
`5bc7e519d4a942f4ceed7e5a4b3a5e6dc5ecbf6d8b7ac8648616d0e0a2291a03`. The
execution-publication commit must have the single direct parent
`2a5f32b2d29d03f26e53eee07dfe3d0658192b49` / tree
`29a8485f2a19e20ae0c483e701b4a0e36a1ad4a7` and exact matching HEAD, local `origin/main`, tree,
six-path scope and canonical delta. Its commit, tree and canonical delta are intentionally not
embedded or self-referentially asserted by this document or the manifest; a caller must bind them
exactly for executor verification at an authorized execution. The normative gate order is the
approved prepublication exact-delta/artifact review, focused exact publication, one local AVS R3
verification of the publication, one V4 exact-head CI, final independent exact-head/artifact
review `APPROVED` with zero open P0–P3, and only then a separate exact Human authorization for one
Attempt-13 run. This embedded document makes no claim that the external V4 or final-review evidence
occurred. Attempt 13 remains **NOT EXECUTED / DO NOT EXECUTE**; R-034 remains open.

Historical R-034 CI-closure context (2026-08-02): Attempt-13 Round-5 review returned `APPROVED` with
zero open P0–P3 and the candidate was published as
`387421b3caeed988b159c93ff217fb78a0bee60c` / tree
`ace680660468e0374004869f205e6a1e0af0ac7f`; its one authorized local AVS R3 verification passed.
V4 exact-head CI `30745607263`, attempt 1, failed closed 11/12 only in `Synthetic server-connected
Android E2E harness` job `91490562435`. `DA5-V5-CI-TIMEWINDOW-01` is confirmed: the fixed July
query/export window excluded the current-date lifecycle row. A focused deterministic
record-bound/window-bound correction was locally verified, published and remote-bound as
`4dad93bdbc3ccd3e09e2bcfba3680130a90e2799` / tree
`d44bc534c16866dbc16cd889098e6ca33d75d1f5`. Exactly one replacement V4 exact-head CI,
`30748749632`, attempt 1, passed 12/12; Synthetic job `91498873248` passed 13/13 files with 283
passed and 14 platform-dependent skips, plus green Typecheck, Build and Cleanup. Final independent
Exact-Head review returned `APPROVED` with zero open P0–P3. An unchanged retry of the failed head
remains forbidden. R-034 remains open. Attempt 13, Hardware and Human/Product V5 remain `DO NOT
EXECUTE` / `DO NOT START`. This paragraph supersedes only stale Attempt-13 preparation state in
the R-034 row below; all historical evidence and risk boundaries remain unchanged.

| ID | Risk | Category | Severity | Status | Mitigation |
|---|---|---|---|---|---|
| R-001 | NFC behavior differs between devices and Android versions. | Technical | High | Open | NFC remains isolated. Block-D device-local/product checks and E2A warm-session transport-loss/restart passed on Galaxy A33 5G / Android 15 with NTAG213 tags; require a broader supported Android/tag matrix and iOS-specific validation before release claims. |
| R-002 | Reusing frogs assumptions without review may import technical debt. | Architecture | High | Open | Treat frogs as evidence and reference only; document reuse decisions through ADRs. |
| R-003 | Stack decision made too early may reduce long-term maintainability. | Architecture | Medium | Open | Delay stack lock-in until architecture review and product capability mapping. |
| R-004 | Missing automated tests may block professional release quality. | Quality | High | Mitigated — Continuous | Root CI runs lockfile install, Core/Mobile typecheck/tests/build/export plus dedicated backend/security suites. E2A implementation commit `4b5ecdc` passed all eight jobs in run `29348512506`; preserve and extend coverage for every new slice. |
| R-005 | Firebase security rules may become product-critical and hard to validate manually. | Security | High | Open | Require security rules tests and release evidence before production release. |
| R-006 | A missing tenant filter, incorrect RLS policy or privileged bypass could expose one Organization's data to another. | Security | Critical | Open | Require default-deny RLS, composite tenant foreign keys, no client service credential, API plus direct-policy negative tests and independent security review before backend release. |
| R-007 | Migrating synchronous ports after backend adapters exist could create mixed contracts, unawaited writes and changed decision ordering. | Architecture | High | Open | Approve the async impact map first; migrate compiler-enforced vertical slices; prohibit `T \| Promise<T>` ports; test every failure point. |
| R-008 | Offline local TimeEntry state may conflict with the server-canonical result when WorkEvents arrive late or concurrently. | Product / Synchronization | High | Open | E2A stores cached-context actions only as deferred evidence and never mutates a TimeEntry. Physical evidence ended with 2 WorkEvents but only 1 Decision and 1 still-started TimeEntry, proving no deferred Stop for that path. Continue immutable/idempotent ingestion and obtain a Human Architect reconciliation decision before later evaluation. |
| R-009 | Provider roles or token claims could become a stale duplicate of TapTim.e Membership authorization. | Security / Architecture | High | Open | Treat Auth as identity only; resolve Organization and role from server Membership data for every request; use claims only as non-authoritative hints. |
| R-010 | Unrestricted backend service credentials could bypass database tenant policies. | Security | Critical | Open | Restrict bypass credentials to isolated audited bootstrap/worker paths; preserve user/RLS context for normal requests; test bypass endpoints explicitly. |
| R-011 | Append-only WorkEvent/decision/audit evidence may conflict with storage limitation, erasure and backup-copy obligations. | Privacy / Legal | Critical | Open | Require legally reviewed purpose/basis and numeric retention per data class; distinguish deletion, genuine anonymization, pseudonymization and restricted legal hold; replay deletions/restrictions after restore. |
| R-012 | Untrusted or manipulated device time may silently create, remove or distort payable working time. | Product / Security | Critical | Open | E2A introduces no clock or grace threshold and cannot turn cached-context evidence into working time. Keep `occurredAt` and `receivedAt` separate; detect clock skew, backwards time, unusual duration and offline delay independently; Human Architect sets tolerances before later evaluation. |
| R-013 | Membership revocation may either discard legitimate pre-revocation offline work or accept forged backdated events. | Product / Security | Critical | Open | E2A compares the exact expected Membership with current locked authority and retains local evidence after revocation/regrant mismatch. A later policy must decide grace/review/reject behavior and verify historical Membership/Assignment validity plus multi-signal clock evidence. |
| R-014 | Automatic or custom account linking may bind the wrong person to a TapTim.e User or Membership. | Identity / Security | Critical | Open | Use one controlled v1 sign-in method; enable additional providers only after review; never merge on email equality alone; rely on verified provider linking/authenticated ceremony and audit all link changes. |
| R-015 | Pooling, session advisory locks or leaked request variables may carry tenant/JWT context across reused database connections. | Security / Reliability | Critical | Open | Prefer managed Node; use row locks or `pg_advisory_xact_lock` in the same transaction only; transaction-local context; test Supavisor modes, prepared-statement settings, rollback, reuse and cross-request leakage. |
| R-016 | A client-selected defer endpoint does not attest the device, physical scan or network history; a modified authenticated client can still call the canonical endpoint within its existing capability. | Security / Fraud | High | Open | Treat E2A route selection as a supported-product boundary only. Removing C2 reverse `tcp:3000` validated transport behavior but attests neither device, scan nor network history. Before stronger fraud claims, design server-issued per-event proof, anomaly policy and any required device attestation in a separate ADR. |
| R-017 | A protected legacy, identity-mismatched, conflicted or non-durable single outbox record can block further scans indefinitely. | Product / Operations | High | Open | Physical E2A evidence proves a valid v2 record survives force-stop/restart, but legacy/conflict/non-durable recovery remains unavailable. Preserve evidence fail-closed, disclose no foreign-identity details and authorize support/admin reconciliation before pilot operations; never auto-delete or silently rebind. |
| R-018 | A bootstrap or normal Admin write path could bypass tenant authority, misattribute the operator or expose the broad existing Administrator grant surface. | Security / Architecture | Critical | C3B/C3C repository mitigation completed; production gates open | Accepted ADR-0011 fixes a named-operator CLI, exact SECURITY-DEFINER role/receipt/audit boundary, mandatory expected-Membership narrowing and separate normal setup session. C3B's role/rollback/concurrency/attribution matrix passed independent final review and exact-head nine-job CI. C3C's fourth least-privilege pool, current-authority lock/narrowing, fixed capabilities, success-only receipt/audit, receipt-integrity binding and role/ACL/race matrix passed the complete 1,394-test regression, three exact-SHA independent reviews with zero open P0/P1/P2/P3 and exact-head ten-job run `29375259275`. Repository mitigation is closed; external IAM/TLS/cloud/deployment, monitoring, pooling and production-data gates remain. |
| R-019 | Opaque Customer/Tag identifiers or raw NFC payloads could make setup unusable and leak technical identifiers into normal UI, logs or audit. | Product / Privacy | High | Mitigated for completed C3C/C3D synthetic scope; production remains gated | Accepted FB-002 v1.2/TS-002 v1.3 require bounded non-unique Customer/Tag display names and safe projections. C3C implements required names, a stored 12-character non-authoritative SHA-256 validation fingerprint, no raw-payload setup-role SELECT and leakage/response/audit/receipt tests. C3D's independent review, exact-head CI and fresh Galaxy A33/NTAG213 Human gate proved safe Web/Android projections and ephemeral Android capture without raw payload in normal UI/state/evidence. This does not close production logging/operations/privacy validation or authorize production data. |
| R-020 | A TimeEntry export could expose another tenant's or excessive personal time data, execute spreadsheet formulas, return a mixed lifecycle snapshot or create unaudited output. | Security / Privacy | Critical | Mitigated for authorized local DA2 scope; production gates open | Implementation `f385814`, tree `48b5ba8`, exact-head run `29847593708` 11/11, independent exact-SHA review `APPROVED` with zero open P0–P3 and closure publication `fa171a5`/run `29848853594` 11/11 prove the Human-accepted isolated role/pool, server-derived current-Administrator authority, forced RLS, exact columns, UTC/range/row/byte limits, deterministic CSV/formula neutralization, repeatable-read snapshot and success audit/content hash. Direct PostgreSQL/API/contract/integration tests cover cross-tenant denial, revoked attribution, missing-row fail-closed behavior, lifecycle races, limits, rollback and pool reuse. Production personal data, retention/legal approval, deployment and distribution remain gated. |
| R-021 | Treating DT-063–DT-066 as unimplemented tasks could duplicate or broaden the already closed C3 setup authority and create conflicting identity, tenant, NFC or administration paths. | Architecture / Governance | High | Mitigated for authorized local DA2 scope; pilot operations remain gated | DA2 adds no second setup implementation. Its disposable journey composes the existing C3B/C3C/C3E1/C3E2 and B6 boundaries through public coordinators and proves complete cleanup. Independent exact-SHA review returned `APPROVED` with zero open P0–P3; closure publication `fa171a5` passed run `29848853594` 11/11. DT-063–DT-066 are closed only for this evidenced local integration scope; pilot-grade operational onboarding and UI remain open. |
| R-022 | In-place TimeEntry correction or an unconstrained effective overlay could destroy canonical history, lose concurrent lifecycle changes, duplicate logical records or make overview/export disagree. | Data integrity / Architecture | Critical | Mitigated for authorized local DA3 scope; production gates open | Human-accepted ADR-0014 and implementation `0f71aca` keep WorkEvents, CanonicalDecisions and base TimeEntries immutable; corrections append full contiguous revisions under the byte-identical Organization/User lifecycle lock, exact expected versions and idempotent command receipts. One effective projection feeds overview/export. Direct stop/correction/export races, hostile mutation and rollback pass locally and in exact-head CI. The final complete fresh Human V5 produced one correction, exact effective CSV and unchanged base lifecycle rows. Evidence publication `7cb510a` passed exact-head run `29996799069` 12/12; independent final review returned `APPROVED FOR DA3-V5 PHYSICAL CLOSURE` with zero open P0–P3 and was Human accepted. Production remains gated. |
| R-023 | Human review adjudication could skip an unresolved predecessor, retroactively invent an automatic decision, clear server/Mobile review state falsely or discard protected legacy evidence. | Offline durability / Audit | Critical | Mitigated for authorized local DA3 scope; production gates open | Implementation `0f71aca` forbids replay/mutation, requires exact ordered-prefix append-only adjudication, database-proved cursor clear and authenticated exact-installation Mobile marker reconciliation. Both ingestion/adjudication lock orders, hostile false-clear, stale/lost Mobile clear and legacy/protected evidence pass. The final complete fresh Human V5 proved ordered partial retention, complete adjudication, exact marker clear/persistence and byte-stable reconciliation evidence. Evidence publication `7cb510a` passed exact-head run `29996799069` 12/12; independent final review returned zero open P0–P3 and was Human accepted. Production remains gated. |
| R-024 | A correction/review operator surface or new database pool could expose another tenant's personal time/evidence, retain privileged state across sign-out or broaden existing lifecycle/export roles. | Security / Privacy | Critical | Mitigated for authorized local DA3 scope; production/legal gates open | DA3-P02/P08/P13/P14 are implemented with server-derived current Administrator authority, exact expected Membership, bounded safe projections, distinct roles/function owners/pools, forced RLS and session-safe Admin Web behavior. Focused V5 candidate `6eb68a3` and Evidence `f4e2eeb` each passed exact-head CI 12/12. The final fresh Human V5 passed both sign-outs and full local cleanup; evidence publication `7cb510a` and independent zero-finding final review close the local DA3 boundary. Production personal data, legal/retention and deployment remain gated. |
| R-025 | An API adapter may forward validator-only normalized/helper fields into a downstream coordinator that correctly enforces an exact public request shape, making the real route unusable even while a mocked partial-object test passes. | Integration / Reliability | High | Mitigated for authorized local scope; independent review approved | The real disposable PostgreSQL V5 journey exposed this on the DA2/DA3 export route as disclosure-safe HTTP 400. The Human-authorized correction constructs a frozen three-field coordinator request; the API regression requires deep equality and the real 46-test PostgreSQL harness requires successful effective CSV. Product `6eb68a3` passed the full 1,758-test R3 matrix and run `29927309720` 12/12; Evidence `f4e2eeb` passed run `29928717227` 12/12; independent exact-SHA review returned `APPROVED` with zero open P0–P3. Final fresh V5 and independent final closure review subsequently passed for the authorized local scope. Production remains separate. |
| R-026 | A physical procedure that authenticates an Administrator for setup and then a different Employee on the same installation can conflict with the deliberately permanent encrypted offline-store owner binding and block all later capture as an identity mismatch. | Security / Operations | Critical | Closed as `DA3-PHYS-01` for authorized local scope; new runs/production separately gated | The first exact-bound V5 run proved the mismatch. The reviewed clean exact-artifact reinstall correction preserves owner fail-closed behavior and Product/APK identity. The final complete fresh run passed uninstall/package-mapping zero proof, exact same-APK reinstall, Employee ready state and all Gates A–C. Evidence publication `7cb510a` passed run `29996799069` 12/12; independent final review approved physical closure with zero open P0–P3 and was Human accepted. |
| R-027 | A Physical-Gate runbook can combine a seeded harness baseline with an instruction to create duplicate prerequisites while requiring aggregate receipts/audits that only the seeded baseline can satisfy. | Operations / Governance | Critical | Closed as `DA3-PHYS-02` for authorized local scope; new runs/production separately gated | The reviewed correction uses exactly `Synthetic Android Customer` and `Synthetic Reassignment Target`, prohibits additional Customer creation and retains the exact two-receipt/four-audit invariant. The final complete fresh run passed that exact setup aggregate and all Gates A–C. Evidence publication `7cb510a` passed run `29996799069` 12/12; independent final review approved physical closure with zero open P0–P3 and was Human accepted. |
| R-028 | A long Human Physical Gate can silently lose evidentiary validity when operator instructions advance on UI success without required artifact-content assertions or reuse a mutable clipboard credential after another value overwrote it. | Operations / Governance | Critical | Closed as `DA3-PHYS-03` for authorized local scope; new runs/production separately gated | The third V5 run exposed the missing CSV proofs and credential mismatch. Published correction `9424a588`/tree `f2d9a875`, Evidence sync `e025a2f`/tree `4485a43`, independent review archive `8545e08` and final sync `f726e16` passed their exact-head 12/12 runs and were Human accepted. The final complete fresh run passed all four CSV stop points before deletion, live-session password-digest matches before every injection, fixed-email clipboard isolation, protected-path-excluding checks and complete cleanup. Evidence publication `7cb510a` passed run `29996799069` 12/12; independent final review approved physical closure with zero open P0–P3 and was Human accepted. |
| R-029 | Professional Admin Web restructuring could silently truncate personal time/review data, weaken explicit privileged-action confirmation or restore stale privileged state after session replacement. | Product / Security / Privacy | Critical | Locally mitigated for authorized implementation scope; Human V5 remains open after an operational gate failure | Human-accepted ADR-0015 is implemented with cursor-backed loaded-versus-complete truth, preserved C3/DA2/DA3 confirmations and command intents, session/Membership plus refresh-epoch binding, memory-only auth, navigation-safe volatile invitation destruction and automated accessibility/interaction coverage. Final F05 correction `f0f1e17`, tree `5259887`, passed exact-head run `30009111061` 12/12; independent exact-SHA review returned `APPROVED` with zero open P0–P3. The DA4-V5 enablement correction `e731a77`, tree `6c2b34d`, passed final corrected V3 with 1,825 tests and exact-head CI `30022981656` 12/12; independent round 2 returned `APPROVED`, `MERGE_READY` and zero open P0–P3. The first Human V5 failed at `DA4-V5-H01`; it proves no Product defect and supplies no closure evidence. A new exact-bound Human gate and production boundaries remain open. |
| R-030 | A large but valid TimeRecord or review projection can exceed an unrelated offline-response ceiling and fail with HTTP 503, making accepted 100/1 pagination impossible even though the browser permits the body. | Integration / Reliability | High | Locally mitigated as `DA4-V5-F01`; Human V5 remains open | Authorized discovery reproduced the 503. Candidate `454b751f`/tree `c69717e` passed CI `30016627509` 12/12 and independent zero-finding review. The correction applies a named 256-KiB ceiling only to successful TimeReview reads. Focused regressions pass 6/6; the real Synthetic Harness passes both TimeRecord/review 100/1 within final affected 78/78, while malformed dependency output above 256 KiB still fails closed. Final correction `e731a77`, tree `6c2b34d`, passed exactly one new final 1,825-test V3, all 19 tests-inclusive typechecks, all 18 applicable builds, migration/replay and complete cleanup; exact-head CI `30022981656` passed 12/12 and independent review round 2 approved with zero open P0–P3. Errors, writes and neighboring routes remain unchanged. The failed Human gate reached both 100/1 Safari observations but cannot close V5; production boundaries remain gated. |
| R-031 | An operator may irreversibly advance a fail-closed Human-gate checkpoint after an abbreviated or ambiguous Human response, causing an otherwise valid run to abort before the UI result and Harness state are jointly confirmed. | Operations / Gate reliability | Medium | Procedural correction independently approved; historical P2 `DA4-V5-H01` remains until a fresh successful gate/final review | The first DA4 Human Browser Gate failed when the Tag-reassignment checkpoint was sent after `passt` instead of word-for-word confirmation of `NFC-Tag wurde sicher neu zugeordnet.` The mismatch auto-aborted and cleanup prevented reconstruction of the differing database dimension; no Security, Product or data-integrity defect is proven. The runbook requires exact UI-message confirmation, read-only status, disclosure of expected/current result, `Checkpoint ausführen?` and explicit Human `Ja` before every checkpoint. Independent review of `cd5d1e17`/tree `c251f72`/CI `30078462282` returned `APPROVED` with zero open P0–P3 review findings. The exact mismatch dimension remains intentionally unknown and the handshake remains operator-dependent. A copy-ready exact-bound Human authorization candidate may be prepared; no run is authorized. |
| R-032 | A long Human browser matrix can outlive the accepted 15-minute invitation TTL while a fixed gate invariant still requires the invitation to remain active, aborting a valid Product state or encouraging an unauthorized replacement invitation. | Operations / Gate reliability | High | F07 independently approved; fresh Human proof pending | `DA4-V5-H03` passed all Safari writes and Chrome read-only checks, then stopped before the first Chrome write when active invitations naturally became `0` while the invitation receipt and AuditEvent remained exact. Migration 008 fixes the Product TTL at 15 minutes. F07 `60b8f1a3` preserves that rule and reports exact disclosure-safe unconsumed plus expired-unconsumed counts: immediate creation must be active; later checkpoints accept only a monotonic active-to-expired transition while all durable and write aggregates remain exact. V0–V3, exact-head CI `30092933085` attempt 2 at 12/12 and independent Exact-SHA review are green with zero open P0–P3. No retry, replacement invitation or Human run is authorized; the risk remains open until a separately authorized fresh V5 passes. |
| R-033 | A Mobile own-time view could expose another user/Organization or privileged correction evidence, omit recovered/corrected truth, or falsely infer no active work from a bounded history page. | Security / Privacy / Product truth | Critical | Software mitigation independently approved; fresh Human V5 pending | The current Source+Lock baseline `a323834f51607841d0cd5f11aafdbfd3dd93ed5f`, tree `65c669b0a941c21d23ffca5e79fa03285323a7cf`, passed exact-head CI `30149165373` 12/12 and independent implementation review round 2 `APPROVED` with zero open P0–P3. The execute-only current-actor capability remains server-authoritative, tenant/actor-bound and omits privileged correction/audit detail while returning active truth independently from bounded history. The read-only synthetic APK candidate does not replace fresh Human Android V5. |
| R-034 | Android Tag Dispatch or a manual generalized-target path could open the app for an unrelated Tag, bypass current Membership/Assignment authority, duplicate a lifecycle action, strand active Project time, mislabel provenance/export data or corrupt protected offline evidence. | Security / Product / Data integrity | Critical | Open — Validation Phase 0 passed; Harness artifact closure and Product Human V5 pending | Separately authorized Phase-0 run 17 passed the exact Validation device/UI/30-presentation/Human-PASS/terminal-cleanup protocol on `SM-A336B`, Android 15/API 35, and removed the Validation App with exit 0. Separately authorized run 18 established the safe transfer binding A `B55E8B6AEB30`, B `32A54C8F2F29`, X `F61C9F702CFE` with valid format and pairwise distinctness. Both used Artifact Source `5675297dab94258e50d7371a95e07fe7a77fc51c` / tree `b32af38c8ac769965ab062762004312d96d0de25` and Execution Repository `be76ce4a69c8a971ad73b5232082a9e500d8d471` / tree `56abec5e7f2752f5004fe3e8667f47a917429c52`. CI `30612797541`, attempt 1, passed 12/12 only on ADO CI head `f45f49aa6c56c70a503322a043bec3d2360c2176` / tree `714300da7656822dd9b7a2a42fe1be85ab33aa6c`; it is carried evidence and not exact-head CI for run-18 ADO baseline `5a0d59c2b1767192d3d261cede7a2c2b11732d30` or this synchronization. The separate Product-Harness TalkBack tracked-source correction `a0359a87fd1738c8493929a1661cbbc7adb3c07c` / tree `102c913e264bd0ccce1d085db1c50bd407f7d4a4` passed exact-head CI `30638926835`, attempt 1, 12/12 and independent Exact-Head review `APPROVED` with zero open P0–P3. Its exact seven-file +294/-5 delta SHA-256 is `30a7b90bd59de29af0c6bd97b4a809df933b230baa69508cea0ca189a78e27fb`; Product preinstall and Gate E source logic binds exactly one authorized Google or Samsung TalkBack package/version and fails closed for none, inactive, both, foreign or drift. `DA5-V5-HARNESS-ARTIFACT-01` remains open because the actual startable ignored bundle predates that correction and is not authorized execution evidence. Independent attempt-1 and attempt-2 authorization reviews returned `APPROVED` with zero open P0–P3, but both R3 attempts remain historical fail-closed before build/test/artifact. Attempt 1 selected unauthorized Node `26.3.1` / npm `11.16.0`; attempt 2 matched exact Node `24.17.0` / npm `11.13.0`, source/tree, hashes and lifecycle proof, then global `npm ls --all --json` returned exactly the known two extraneous Expo packages plus invalid `expo-modules-core` and created one external debug log. Both cleanups fully removed task-owned dependency/output/worktree state; no Product/APK or system installation occurred. The attempt-3 authorization then received independent `APPROVED` review with zero open P0–P3; its execution was not independently verified. All claimed exact path/source/hash/tool bindings, npm exits, gate order, omissions and external-log-set equality are **Development-reported/unverified** because no disclosure-safe raw/receipt artifact was preserved and task logs were cleaned. Development reported a predicate-1 fail-closed stop and cleanup, but the failure-evidence gap remains open. Independent review confirmed only current state: four bound paths and worktree registration absent, exact current package-lock hash, and the six-file ADO-only delta with no executable delta. Under continuous Human authority, the attempt-4 candidate received independent `APPROVED` review with zero open P0–P3. Exact R3 execution passed fresh-path/source/tool binding, bound `npm ci`, globally recursive clean exit-0 npm closure, dependency/workspace/lifecycle/external-log predicates and V0; Mobile focused tests passed 38/38. V1 then failed closed before any Synthetic test executed because `@taptime/backend-schema` could not resolve from its package entry. Receipt and manifest explicitly prove only `V2`, `BUILD`, `NODE_CHECK`, `METAFILE_RUNTIME` and `ARTIFACT_PRESERVE` omitted. They contain no separate Mobile/Synthetic typecheck command IDs or omission decisions; Development reported both tests-inclusive typechecks omitted, but that claim is unverified and remains a separate fail-closed evidence gap. No artifact output exists. Cleanup removed checkout/cache/logs/`node_modules`/worktree registration and preserved only the mode-`0444` receipt, pre-cleanup snapshot and evidence manifest under `/Users/timbartz/Dokumente/GitHub/taptime-local-evidence/da5-v5-harness/attempt4-a0359a87`. Independent review identified this P2 evidence-claim gap; correction re-review is pending and Attempt 4 grants no retry. Attempt-5 candidate review returned `APPROVED` with zero open P0–P3. Exact execution passed evidence-first fresh-path/source/tool, bound `npm ci`, global and affected-workspace recursive-clean npm closure, dependency-file and external-log predicates. Lifecycle-binding verification then exited 2, so `DEPENDENCY_BINDINGS` failed closed before V0 or any of the 16 prerequisite builds. Every later focus/typecheck/V2/Node/metafile/artifact ID is explicitly omitted; no generated build output or artifact exists. Cleanup removed all task execution state and preserved the mode-`0444` receipt/snapshot/manifest under `/Users/timbartz/Dokumente/GitHub/taptime-local-evidence/da5-v5-harness/attempt5-a0359a87`. Attempt 5 is `NOT_VERIFIED`; independent execution/evidence review is pending and no retry is authorized. Attempt-6 candidate review returned `APPROVED` with zero open P0–P3. Attempt 6 started, passed only `EVIDENCE_INIT` and `SOURCE_BINDING`, was interrupted and is consumed; its sole mode-`0444` receipt is 2,716 bytes with SHA-256 `6a5b23db67bbe1ff6715f377e3f0f041942d8e8b447b5e3e45cb7aa224ad5402`. No Attempt-6 checkout, install, build, test, Typecheck or artifact exists. No exact Attempt-7 candidate, digest or independent review was bound before execution, so authorization is UNVERIFIED. Its aggregate dependency/build/V1/V2 receipt records lack V0, 16 individual build IDs and separate Typecheck IDs; those execution results are Development-reported/unverified. Verified facts remain the immutable receipt, `METAFILE_RUNTIME` exit 2, completed cleanup/path absence and no artifact. Attempt-8 candidate review Round 3 returned `APPROVED` with zero open P0–P3. Its single execution produced all 45 records in order and is consumed fail-closed. Records 1–7 preserve their stated decisions and npm exit/count evidence, but the normative per-command external-log isolation is insufficient/unverified: `NPM_CI` and `GLOBAL_NPM_LS` have only before hashes and `WORKSPACE_NPM_LS` has neither side. Record 8 `EXTERNAL_LOG_CHECK` detected cumulative drift that cannot be attributed to an individual npm invocation; records 9–41 are individually omitted and records 42–45 completed snapshot, cleanup, post-cleanup and finalization. No external npm log was mutated or raw name/content preserved. No lifecycle/V0/build/test/Typecheck/artifact gate ran and no Harness artifact exists. Attempt-8 failure/evidence review returned `CHANGES REQUIRED` with exactly one P2, corrected by the current six-file candidate. Exact Attempt 9 was independently `APPROVED` with zero open P0–P3 on published `9d9aa10242231d85afd5a9b018c0652f60b90de2` / tree `7aa1bcd0026372b196b0fc7d39cd6fbf8b2233ee`; its execution is consumed fail-closed. `EVIDENCE_INIT` passed and the first no-checkout worktree process exited 0, then literal `/tmp` versus canonical `/private/tmp` caused `WORKTREE_ADD` `noncanonical_cwd`; records 3–41 were omitted, so no npm, dependency, lifecycle, V0, build, test, Typecheck, Metafile, TalkBack or artifact gate ran. Immutable `CLEANUP` failed with `Cannot read properties of undefined (reading 'root')`, `POSTCLEANUP` failed with `worktree_registration_residue`, and `FINALIZE` failed closed. A later separate cleanup operation is Development-reported/unverified and cannot supersede those records; independent review verified only current absence of the literal/canonical task roots and exact registration/list mapping. Exact Attempt 10 was independently `APPROVED` with zero open P0–P3 on published `a08e2e89a2aa3962b1bc4ddeb0f77e480f1f4f85` / tree `dbec8fb277b1a915153c765cad4c5a060e0626b4`; its single R3 execution is consumed fail-closed. Records 1–30 passed. Record 31 `SYNTHETIC_TYPECHECK` failed with predicate code `synthetic_typecheck_test_not_listed` after both mapped processes exited 0; records 32–41 are omitted. The immutable evidence has no Gate-31 result object, normalized count/digest, required path, observed match or membership boolean. Independent failure/evidence review returned `CHANGES REQUIRED` with exactly one P2: the cause is undecidable; config exclusion is unproved and statically unlikely because the tracked Synthetic tsconfig includes `tests` and the expected tracked test exists, while matcher/path-normalization failure is also unproved. Snapshot, cleanup and postcleanup passed with final state `cleanup_complete` and all ten cleanup flags true; `FINALIZE` remains `FAIL_CLOSED`. Immutable receipt/snapshot/manifest SHA-256 values are `d4bd5c9566a213abfcd1872bce92cb745414f8f6c682a52ed00f278e74f6f99f`, `c323f3d6c59936f6c489497e4689d1b44562a26e979717323417d35ebacd914d` and `081d3c77fa5b044eefd4fa8c0fb1d623af1fb14fcf5ac0c585d28223cbc1b64e`. The exact Attempt-11 R0 candidate binds fresh token `fdf09c30` and the closed membership schema; it is `REVIEW PENDING / NOT EXECUTED / DO NOT EXECUTE`, needs independent approval plus exact publication and grants no execution authority. No authorized Harness artifact exists. Hardware/Human/Product V5 remains `DO NOT START`. Attempt 3 supplies no independently verified Product-App installation or Product-Human-V5 execution evidence. Phase 0 therefore does not validate Product Tag Dispatch, manual target, lifecycle, offline, authentication, network or database behavior. All Human-run fields remain unbound/DO NOT START and no Product action, production, deployment or distribution is authorized. |
| R-035 | The DA5-V5 Harness can accept operator-supplied A/B/X binding values but cannot independently prove their origin from the physically labelled device/Tags, so an incorrect binding could enter a Hardware Gate as trusted preflight evidence. | Security / Operations / Gate reliability | Critical | Locally mitigated — run-18 transfer binding established; Product Human V5 remains open | Run 17 established the fixed physical order 10×A, 10×B, 10×X, 10/10 for every role, `NfcA`, three pairwise-distinct 12-uppercase-hex safe fingerprints, exact final UI and `PASS`, then terminal cleanup. The separately authorized run 18 on ADO baseline `5a0d59c2b1767192d3d261cede7a2c2b11732d30` / tree `e2970d1851ab55f99ff7a027e6268ec4b7622643` reverified artifact/execution/device/UI/order/receipts/cleanup and transferred A `B55E8B6AEB30`, B `32A54C8F2F29`, X `F61C9F702CFE`; format and pairwise distinctness passed. Its authority was consumed successfully, so the local transfer-process finding is mitigated and the later Harness input binding is established. No raw UID, payload, Technology list, device serial or secret may be recorded. This mitigation proves no Product correctness and authorizes neither Product Human V5 nor production, deployment or distribution. |
| R-036 | POSIX automatic cleanup is name-based: no portable inode-conditional unlink/rmdir exists, no-replace rename protects only the destination, and a malicious same-UID process can swap the source or a child entry between final identity check and rename/unlink. | Security / Local operations / Cleanup integrity | Critical | Open — extra-round review has exactly one P1; initdb P1-B closed; Human trusted exact decision-time admin-group snapshot and authorized one last focused ADO round; publication/CI/approval and R3 mitigation pending | The Human Architect selected one exclusive trusted operator session and now confirms that the second local administrator and exact complete decision-time local macOS admin-group membership snapshot are trusted. Hostile/malicious same-UID or exact-bound trusted-member processes and mount/unmount churn are expressly outside the threat model; no atomic same-UID safety is claimed. Within that model, preserve a verified root-owned-sticky/private-`0700` parent boundary, retained FDs, strongest-platform no-replace rename, mount/device checks, convergent descriptor-relative walks and post-operation stop-on-mismatch. Observable pre-operation mismatch prevents deletion; a synchronized last-stat race may remove one sacrificial substitute, after which every further delete must stop and residue remains. Extra-round candidate `43567d256e8f633f16866448e1fb5abbd8022733`, tree `feecced92abe9fc536a2db052b5a616d3e0f1cf7`, exact parent `bbcb1b59703ee866539b2bc384ec9db8c2643fe4`, passed exact-head CI `30186846379`, attempt 1, 12/12, but Exact-Delta review returned `CHANGES REQUIRED` with exactly one P1 and zero P0/P2/P3: the current same-EUID-owned Homebrew Cellar ancestor is observed at mode `0775`, so blanket group-write rejection is unusable and the exact trusted group plus complete current membership set were not bound. The review closed initdb P1-B. The Human Architect authorized exactly one last focused ADO correction/review round limited to the remaining P1. The current R0 draft binds the exact decision-time group record and complete sorted UID/GUID membership manifest disclosure-safely; permits group write only for same-EUID-owned canonical ancestors with exact group, unchanged record/membership and exact manifest-bound observed mode; keeps canonical binaries exact observed `0555` and non-group/world-writable; and fails on every other group-write, world-write, group/member/mode/ACL/symlink/swap or stable-identity mismatch before capability/task-root creation and use. It performs and authorizes no account/group/membership/ownership/permission/Homebrew/system mutation. Shared-Cluster WIP remains `BLOCKED` and not Evidence. Neither the selection nor last round grants implementation or hardware authority: focused seven-file publication, successful exact-head CI and independent Exact-Delta `APPROVED` with zero open P0–P3 must precede activation of the exact R3 scope under the `AGENTS.md` standing rule. Product, Business and NFC semantics are unchanged. |
| R-037 | An optional Location/delegation layer could weaken the Organization tenant boundary, leak data across Locations or tenants, grant stale/implicit privileged authority, expose unassigned legacy data, return silent partial/mixed correction-review-export results, or rewrite/misattribute historical work when people/resources move. | Security / Privacy / Authorization / Data integrity | Critical | Open — exact corrected ADO candidate independently `APPROVED` for publication with zero open P0–P3 and R1 P1 closed; only P1 assignment decision Human-accepted; remaining ADR-0020/DA6 Human disposition and all implementation authority pending; remains open through exact R3 implementation, independent review and required Human gate | R1 found exactly one P1 against predecessor diff SHA-256 `475edf4654fc23bd33e1e0c8db1306f98a0ec2cc83bf4fe1a00587cd66e49e4f`: normative assignment was missing. The Human-accepted correction keeps Organization as the hard tenant boundary and the feature effectively off until atomic activation proves one active Home per active user/Membership plus unique active resource/WorkTarget/NFC bindings. Home does not narrow Administrator authority. Additional Work Grants authorize only Employee work; separate Management Grants authorize only the closed delegated matrix and neither inherits the other. Employee work is limited to Home plus current Work Grants; resource/NFC/explicit General Work resolution fixes one immutable accepted Work Location per accepted record without GPS/geolocation claim. Manager master-data scope uses current Resource Location, Employee scope current Home/minimal Work relation and time/correction/review/export immutable record Location; current Management Grant for every Location, no own-time and reject-all mixed scope are mandatory. Revocation applies to new decisions and removes Manager historical privileged access; deactivation immediately removes all Location/delegated authority while retaining assignments/history, and reactivation revalidates all. Setup/transitions/grants/revocation/actions are append-only audited. Independent re-review of exact corrected seven-file Full-Index-Diff SHA-256 `e30591baf23f00bf4cc56ed1bf8fa0f7c4c9c86dfc0c962bd5a36f490791a9de` returned `APPROVED` with zero open P0–P3 and closed R1 P1; R1 remains historically `CHANGES REQUIRED`. Review evidence is `ADO/05_Evidence/Development_Assignment_06_Optional_Locations_Independent_Architecture_Authorization_Review.md`. Workstream E still feeds RLS/IAM, observability, backup/restore, deletion/retention and operations. Any implementation remains R3 with adversarial Cross-Tenant/Cross-Location/auth/data-visibility/historical-attribution verification, complete regression, exact-head CI, independent review and Human gate. Frogs-specific workflows, providers/cost/cloud/legal decisions, Product implementation and production remain outside authority. |
| R-038 | Known High advisories in transitive `image-size@1.2.1` could become relevant if the dependency becomes reachable from untrusted or runtime image input. | Security / Availability | High | Temporarily accepted through `2026-09-09`; remediation/reassessment gate open | Exception only for `GHSA-w3rx-r6r6-pgpr` and `GHSA-5p2g-fcmc-qvqq`, bound to the exact four code/lock blobs and pre-ADO diff SHA-256 `7d76ebb9d717ca7b2578b3e50e192b1abf1140c24b2895e5a1c4ff5ee870b37e` recorded in current Evidence; ADO-only publication does not broaden it. Reviewed reachability is limited to Expo/Metro build tooling over fixed local Product inputs; no broader runtime, untrusted-input or production acceptance follows. Keep `js-yaml@4.3.1` and `nanoid@3.3.18` fixed. Upgrade/remove `image-size`, or obtain a new explicit Human disposition, by expiry; any bound-blob/dependency/reachability/input drift reopens the gate immediately. |

R-036 decision-time trust anchor: the accepted snapshot is exactly two direct members and zero
nested groups, full-record digest
`b006276c09d8f2713f6132ea79cec167ab3a3c2887ee53e95eb00c1cc33719a5`, membership digest
`70a683b7ebc7981533015d5d63cf12dfb2eabbfa665c34720eddb4d09e9e3064` and combined snapshot
digest `2384b0baccd9049d820794f8ebc9419e4af0fad6831a5a91c209baa0b4a02217`. Later R3/preflight
must reproduce all three and both counts before capability/task-root creation and every trust use.
Mismatch returns to the Human Architect; dynamic acceptance, anchor update or rebinding to a
later-current group/member state is not mitigation and is forbidden. Only the digests, counts and
match/mismatch are disclosure-safe; no protected identity value is recorded.

Current R-034 Harness update: exact Attempt 10 was independently `APPROVED` with zero open P0–P3
on published `a08e2e89a2aa3962b1bc4ddeb0f77e480f1f4f85` / tree
`dbec8fb277b1a915153c765cad4c5a060e0626b4`; its single R3 execution is consumed fail-closed.
Records 1–30 passed, including dependency/lifecycle/V0, all 16 prerequisite builds, both focused
tests and Mobile Typecheck. Record 31 `SYNTHETIC_TYPECHECK` failed with predicate code
`synthetic_typecheck_test_not_listed` after both mapped processes exited 0; records 32–41 are
omitted. The immutable evidence contains no Gate-31 result object, normalized count/digest,
required path, observed match or membership boolean. Independent review cannot decide between
config exclusion and matcher/path normalization; config exclusion is unproved and statically
unlikely because the tracked Synthetic tsconfig includes `tests` and the expected tracked test
exists. No Harness, TypeScript-configuration or Product defect is inferred. Snapshot, cleanup and
postcleanup passed with final state `cleanup_complete`, all ten
cleanup flags true and exact task-root/registration/mapping absence. `FINALIZE` remains
`FAIL_CLOSED`; no Harness artifact exists. Immutable receipt/snapshot/manifest SHA-256 values are
`d4bd5c9566a213abfcd1872bce92cb745414f8f6c682a52ed00f278e74f6f99f`,
`c323f3d6c59936f6c489497e4689d1b44562a26e979717323417d35ebacd914d` and
`081d3c77fa5b044eefd4fa8c0fb1d623af1fb14fcf5ac0c585d28223cbc1b64e`. Independent
failure/evidence review returned `CHANGES REQUIRED` with exactly one P2. The current six-file R0
Attempt-11 candidate corrects the overclaim and remains **REVIEW PENDING / NOT EXECUTED / DO NOT
EXECUTE**; no retry or resume is authorized. R-034 and DA5 remain open, and Hardware/Human/Product
V5 remains **DO NOT START**.

Attempt-11 mitigation candidate: **REVIEW PENDING / NOT EXECUTED / DO NOT EXECUTE**. Fresh token
`fdf09c30` binds new canonical checkout/cache/log/config/artifact/evidence/registration paths while
executable source/tree stays `a0359a87fd1738c8493929a1661cbbc7adb3c07c` /
`102c913e264bd0ccce1d085db1c50bd407f7d4a4`. The mechanically inherited direct no-shell 45-gate
map is 72,103 bytes / SHA-256
`9bc2cb1c4bac854126a16b2047cd875537eb32399322cd2212de8587f4236168`; descriptor/npmrc SHA-256
values are `ac819b20cbc26ebb650216012c81a8c9ed76e5468e883e37c8bbd25926e9c9f4` and
`459d76447f1fbd04d46628f7a97e1f69281e3e38eb9b970bfddb480b6c0379c0`. The added closed,
bounded, disclosure-safe Round-2 membership schema orders byte/decode/LF/CR/terminal-LF/line-limit/
canonical-set processing. Its logical-line counter remains memory-only, and `listed_file_count`
counts only the final deduplicated set. Candidate review returned `CHANGES REQUIRED` with exactly
two P2 corrected here; independent re-review/publication remain gates. Cleanup V2 and all
log/omission/finalization gates remain otherwise unchanged.

## R-034 Attempt-11 terminal update — 2026-08-01

This update supersedes only the older Attempt-11 candidate-state text above. Exact publication
`32272ca8e1155839380797cadb64fbc454bf2133` / tree
`4f11d9a86f7a060a3a2cfccda4eb7520c2145aa1` activated one R3 execution; it is consumed
fail-closed. Records 1–31 passed, including both focused tests and both corrected tests-inclusive
Typecheck membership gates. Record 32 `V2_SYNTHETIC_TEST` recorded exact mapped process exit 1.
Because raw output was contractually not retained and no second invocation is authorized, its
cause remains undiagnosed; no Product, Harness, test, security or tenant-isolation defect is
inferred. Records 33–41 are omitted and no Harness artifact exists.

Cleanup reached `cleanup_complete`; all ten cleanup flags are true, every Attempt-11 temporary or
artifact root and the exact worktree registration/list mapping are absent, and the external
npm-log set stayed at count 11 / SHA-256
`80a1dc655812427ae4541df6e2bd9ece4834efa17bfa9d5e2dec2370a74f79af`. Immutable
receipt/snapshot/manifest SHA-256 values are respectively
`9b555534c18ca90fb1a4c18f377bb5f488d04f8805db3692564ff4d08f9916ef`,
`6f0a840d22a17fcc6b77a1f447bf6e1f23ef6f15fecf96b77a7dde491da58abc` and
`b1e198bd18e3c5eb71e4374f4114e3620f79929732bc87083dc834275cad5653`. Independent
failure/evidence review returned `CHANGES REQUIRED` with exactly one P2. Gate 32 proves only exact
mapped Vitest exit 1, `raw_output_preserved:false` and `mapped_process_exit_nonzero`; assertion,
collection, transform, hook, configuration, worker/process and infrastructure causes are
indistinguishable. No Product, Harness, test, security or tenant-isolation defect is proven;
fail-closed behavior and cleanup remain safe.

Both passed Typecheck records preserve exactly nine result fields and
`raw_list_preserved:false`: Mobile recorded 103,561 bytes/868 final normalized entries and
Synthetic 68,700 bytes/569, with each exact expected member included. The non-authorizing open
need for any possible later candidate is a bounded closed Vitest pass/failure result schema, a
source-allowlisted expected-test set with normalized repository-relative count/digest/membership,
test/file counts, and a closed failure category plus stable canonical signature. Messages, stacks,
raw stdout/stderr, arbitrary paths and secrets remain excluded. A later-selected JSON output root
would need exact mapping, bounds, schema and cleanup before authorization. At that terminal
checkpoint R-034 remained open, Attempt 11 was consumed, no Attempt-12 candidate was yet bound,
and no retry, resume, Attempt-12 execution, Hardware, Human/Product V5, production, deployment or
distribution was authorized.

### Attempt-12 mitigation candidate — review pending, no execution authority

The exact R0 ADO-only candidate is `REVIEW PENDING / NOT EXECUTED / DO NOT EXECUTE` on baseline
`f029bdab6e7a92f74b38903ee8ee5ecc21ca6a11` / tree
`ee741a0f58e9c5fde2e11774a44bc3346a2b1755`, with fresh token `710d46dc` and unchanged source
`a0359a87fd1738c8493929a1661cbbc7adb3c07c` / tree
`102c913e264bd0ccce1d085db1c50bd407f7d4a4`. Attempt 11 remains consumed; no Attempt-12 state
exists.

Independent review of Attempt-12 Round 1 returned `CHANGES REQUIRED` with exactly one P2 because
the 29-field result and 13-field binding contracts did not fully close type/null/default,
lifecycle, category precedence and signature state. Round 2 corrected that evidence-contract gap.
Round-2 review returned `CHANGES REQUIRED` with exactly two P2 and one P3 for incomplete
within-bucket precedence, missing signal-termination closure and stale document-head truth. Round
3 corrected those findings. Round-3 review returned `CHANGES REQUIRED` with exactly one P2 in
signal-terminated `WORKTREE_ADD[0]` Cleanup-V2 identity timing/removal authority. The first focused
correction closed that coupling. Its re-review returned `CHANGES REQUIRED` with exactly one P2:
terminal `cleanup_residue` lacked schema-legal absorbing receipt retention for the 56
mismatch/ambiguity tuples. This correction closes only that P2 and remains pending independent
re-review.

The candidate mitigates only the Attempt-11 P2 evidence-decidability gap. Attempt 11's direct
no-shell 45-gate order, three npm groups and exact Typecheck membership contract remain unchanged.
Direct argv are unchanged; Cleanup Schema/Contract V2 is strengthened only for signal-terminated
`WORKTREE_ADD[0]`, and every child receipt retains the
closed not-started/exit/signal tuple without persisting raw signal values. The reporter extension
binds locked Vitest 4.1.9 JSON output to
one checkout-internal root/file, caps it at 16 MiB, validates closed structure, file identity,
canonical path, exact counter and termination/result consistency, and requires membership equal to the exact 13
tracked source-allowlisted test files (set digest
`6d3d0d28585a65d8e1357716285896176549416262b3fdba5e5a88ff4966716f`). Only sanitized counts,
digests, membership, closed deliberately ambiguous category and stable signature may persist.
Raw reporter JSON/stdout/stderr, names, messages, stacks, arbitrary paths and secrets remain
excluded. Identity-safe cleanup occurs before receipt or is deferred only to bound checkout
cleanup with fail-closed finalization.

Cleanup Receipt Schema V2 is 84,102 compact UTF-8 bytes / SHA-256
`4caa1b43e2b99b22400ce16213bff4b890dd855b13e4caafae8829fe7ff82d94`; the reporter schema remains
73,538 bytes / SHA-256 `c78b307bb5003e1d81a97dd909b9ddaeeabda4c98d1475f1a185e680cfb304a7`.
The containing command map is 222,596 bytes / SHA-256
`5bc7e519d4a942f4ceed7e5a4b3a5e6dc5ecbf6d8b7ac8648616d0e0a2291a03`. Exact 31-field
materialization, five normalization statuses, twelve lifecycle states, terminal tuples, 46 ranked
first-failure checks, 12 multi-fault fixtures, signal-safe termination, exhaustive categories and
normalized cleanup-override re-signing now fail closed.
The 13 timing fields deep-equal outer/inner termination data, all 64 signal
reattestation tuples are disjoint/exhaustive, eight signal fixtures bind Cleanup/POSTCLEANUP
terminals, and removal is rejected unless checkout, registration and mapping are fully exact and
then revalidated by the existing Cleanup-V2 rules. The 56 mismatch/ambiguity fixtures keep
`cleanup_residue` absorbing through only the named Cleanup/Postcleanup receipt boundaries; no
removal, repair, rebind, resume or promotion is legal, and FINALIZE remains deterministic
`FAIL_CLOSED` with both completion flags false.

This reduces evidence ambiguity for a possible future exact run; it does not establish that any
Attempt-11 failure class occurred and does not close R-034. Independent `APPROVED` review and
exact publication remain prerequisites for the standing Human authorization to activate one
future R3 run. No current execution, Hardware, Human/Product V5, production, deployment or
distribution authority follows.

### DA5 Harness Attempt-12 terminal risk and Attempt-13 mitigation candidate

Attempt 12 is consumed fail-closed with no artifact or retry. Immutable evidence proves 34 passed,
two failed and nine omitted gates, not the previously reported 35/1/9. Gate 32 safely proves only
an exact exit-1 normalized Vitest result with 13/13 file membership and the closed ambiguous
assertion/test-hook category; no Product or test cause is established. Independent review leaves
three P2 evidence/executor-contract findings and the corrected P3 distribution as the mitigation
input: incomplete CLEANUP/POSTCLEANUP child evidence, no prepublished exact executor anchor, and
missing canonical Gate-32 per-file failure-signature components.

The Attempt-13 candidate mitigates those gaps by exact external executor/manifest SHA binding,
persisted canonical `failing_files` inputs, and mapped child records carrying
`cleanup_state_before`, `actual_root_results`, `actual_registration_result` and
`cleanup_state_after` at both CLEANUP and POSTCLEANUP. Its collect-safe rule reduces repeat-run
pressure without weakening fail-closed boundaries: at most 25 closed, unique and gate-sorted
quality failures may accumulate; all safety, provenance, identity/mapping, schema, disclosure,
signal, worker/infrastructure, output-integrity and cleanup anomalies hard-stop. Only independent
nodes continue, direct dependents are omitted, terminal cleanup always runs and an artifact is
forbidden on any failure.

The exact preparation baseline is `db1fc8891d03753b2266957d45137e1817e46156` / tree
`4fa39b6261e5f856d8f982bedee1ec843b371ed6`. The prior read-only Round-3 and Round-4 artifacts
remain immutable and are superseded. The historical, superseded Round-5 root
`attempt13-executor-a0359a87-483fcf40-r5-plcym5sw` contains only the 352,258-byte executor,
SHA-256 `f5cad177fc8efaefcb0d8d1b52f626c809be9cb3f46e9446a62cd6b60a74b4ec`, and its 1,111-byte
manifest, SHA-256 `8d6416d99717efe8929d3f6dcb639fa10a9dd8ab14dd452eabc6d23ca9d23fab`.

Round-2 review returned three P1 and four P2 findings. Round 3 closes them with exact receipt
full-write/sync/readback and rollback, null-safe Gate-42 finalization plus bound snapshot rollback,
parent/creation-bound artifact rollback or truthful residue, fresh Postcleanup identities,
immutable committed-record quality signatures, complete Gate-32 preflight/failing-file validation,
and exact bounded source lstat/fstat/size/digest checks. The success artifact is never claimed on
failure; ambiguous rollback authorizes no removal and remains a `FAIL_CLOSED` residue. The model
still claims caught-exception rollback, not crash atomicity. Focused Round 4 closes the remaining
snapshot/artifact/prejournal transaction risk: snapshot absence must be proved; otherwise a
present but unbound or ambiguous fixed-name snapshot is disclosed only by the closed
`{name,status,removal_attempted:false}` residue, remains in the exact Evidence set, forces zero
removal and `FAIL_CLOSED`; null/partial artifact state and every rollback-observation failure also
retain truthful residue; prejournal rollback failures are surfaced and keep the bindings needed
for safe terminal disposition.

Formal Round-4 review returned `CHANGES REQUIRED` with exactly two P1 findings. Focused Round 5
persists the descriptor/lstat-bound prejournal creation identity before initial realpath/readback
and retains its handle/binding on failure. It also rejects malformed, falsy or partial artifact
state, transaction and nested identity shapes before equality, absence or removal decisions.
Only exact `{exists:false,stat:null}` proves absence; all ambiguous shapes retain truthful residue
and authorize zero removal, and empty identities never compare equal or establish creation
binding.

The pure-fixture runner is now bounded collect-all. It records only unique allowlisted fixture
names and closed safe failure codes, with count and digest; setup, bound overflow and non-fixture
failures hard-stop. Intermediate development runs truthfully exposed one legacy fail-fast red, one
pre-fixture name-guard hard-stop and then nine complete preflight-matrix reds. Their single
map-derived correction produced Round-3 V1 syntax and V2 no-mutation self-test PASS 264/264 with
zero failures. The necessary final Round-5 syntax/no-mutation check passed 314/314 fixtures with
zero failures. Fixture-name-set SHA-256 is
`8d69314f7a703cfe5c44011033e3325e505667c33f9d631618172ff72e9262c4`; empty failure-set and
empty-ledger SHA-256 are `4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945`;
maximum-ledger SHA-256 is `8b3f59e179040dcb3d30611abb1ef55fc679b4fe807ac9ce721d678fc122055d`. Independent
exact-delta/artifact re-review is pending. The prior V3 claim remains revoked; V3 is `PENDING`
until the Technical Lead independently repeats the final exact checks. Product source is unchanged.
No Product or Attempt execution occurred and no Product correctness is proved.

Residual risk remains **Open / R3**. The normative gate order for the superseding execution-binding
candidate is: independent prepublication exact-delta/artifact review `APPROVED` with zero P0–P3;
exact publication; exactly one
local AVS R3 verification of the published execution-binding candidate; one new V4 exact-head CI;
final independent exact-head/artifact review `APPROVED`
with zero P0–P3; and a separate exact Human authorization before any Attempt-13 run. The local R3
verification is not an Attempt execution. No standing or automatic run authority exists, and
current verification changes no Product or Human gate authority.

## Risk Handling Rule

Risks are not backlog noise. A risk must either be accepted, mitigated, transferred or closed with evidence.
