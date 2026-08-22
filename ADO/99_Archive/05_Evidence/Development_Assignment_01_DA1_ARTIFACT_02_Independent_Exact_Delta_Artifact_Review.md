# Development Assignment 1 — DA1-ARTIFACT-02 Independent Exact-Delta and Artifact Final Review

Status: **APPROVED — ZERO OPEN P0/P1/P2/P3; DA1-ARTIFACT-02 CLOSED AS AN ARTIFACT-PIPELINE
FINDING; SIXTH COMPLETE FRESH HUMAN PHYSICAL GATE ELIGIBLE FOR SEPARATE HUMAN AUTHORIZATION BUT
NOT AUTHORIZED BY THIS REVIEW**
Review Date: 2026-07-21
Review Scope: Read-only exact-delta, build-path, verifier, artifact-evidence and governance review
Owner: Independent Review Agent
Approval Authority for artifact rebinding or any later physical run: Human Architect

## 1. Final verdict

**APPROVED** — zero open P0/P1/P2/P3.

The reviewer implemented nothing, installed nothing, created no commit or push and changed no
repository or artifact file. The reviewer neither read nor listed `research/`.

## 2. Exact review binding

The reviewer independently confirmed:

- reviewed head and `origin/main` at review time:
  `1527855b3db4bf387e4efc9e09691a15d588408b`;
- reviewed tree: `1bc2511a540944901e10566fca914f1fab70ee13`;
- correction baseline: `d6cc071f2c2e9849753bfa3e5e1cd6aa564e87b2`, tree
  `765b8a2771a6bcbf2eb07a486b96d36f4dfe0e29`;
- correction commit: `0fdddbce53369e3c73f345eee1c077226a40797f`, tree
  `62b5efc4efd36da1fbd0e6f2058a448aabd1ab1a`, exact parent `d6cc071f…`;
- correction delta: exactly nine Mobile build/script/test files, `+240/-10`;
- ADO/artifact synchronization commit `1527855…`, exact parent `0fdddbc…`;
- ADO synchronization delta: exactly seven ADO files, `+294/-20`, no non-ADO file;
- clean `git diff --check` and clean tracked working tree; and
- product runtime, UI, backend, migrations, business rules and numeric ADR-0012 policy boundaries
  byte-identical to product commit `48a21a7ed75c3ab3b15fec93669b5ca2d87d5a30`, tree
  `7c053beeb0c9ef550216bd1dad0a59fc226866a6`.

## 3. Exact-head CI

The reviewer directly confirmed:

- run `29751390803`, push on exact correction head `0fdddbc…`, attempt 1, ten of ten jobs
  successful; and
- run `29752205717`, push on exact ADO head `1527855…`, attempt 2, ten of ten jobs successful.

The second run truthfully remains a rerun. Attempt 1 was not treated as approval evidence. Its
documented C3B teardown failure after 189/189 passing assertions remained consistent with the
visible rerun marker and adjacent byte-identical green runs; unauthenticated review access did not
expose the attempt-1 log.

## 4. Gradle, Metro and Hermes build path

The correction uses `./gradlew --no-daemon clean assembleRelease` and reports the synthetic APK as
ready only after the backup boundary and Hermes runtime verifiers pass.

The exact synthetic runtime contract contains only:

- `http://127.0.0.1:54321`;
- `http://127.0.0.1:3000`; and
- `sb_publishable_taptime_synthetic_android_e2e`.

No remote or production endpoint and no production authority was introduced.

## 5. Deterministic runtime verifier and pre-ADB boundary

The reviewer confirmed that the verifier:

- requires exactly one `assets/index.android.bundle`;
- extracts it to a temporary directory;
- resolves the repository Hermes compiler for the supported host platform;
- performs a real Hermes bytecode dump;
- fails closed for each absent required literal; and
- removes temporary material in `finally`.

The installer invokes this same verifier before its first ADB operation. A runtime-incomplete APK
therefore cannot pass the build-ready boundary or reach installation through the approved helper.

## 6. Artifact access boundary

The independent review environment could not access either preserved path below because they were
outside its mounted directories:

- failed evidence APK: 95,425,607 bytes, SHA-256
  `4239f6c609430d3926dbfc053c7ad0688a4022903eef8a3ffe1ebeece2356b7c`; and
- runtime-complete candidate: 95,425,695 bytes, SHA-256
  `aa081fca431174cf90698b4afaaa5c1f5f28ed976c54cda7a74df72a49d5ffbf`.

The reviewer did not claim to have independently reproduced either binary's size, hash,
signature, signer certificate, manifest or runtime result. It accepted the source binding and the
mandatory immediate fail-closed pre-install checks without inventing binary access.

## 7. Independently reproduced verification

The reviewer reproduced Mobile 419/419 in 31 files, including the new runtime-verifier suite.
Those tests evaluate the exact three required Hermes literals with one accepted and three
individual fail-closed cases. The composition-boundary tests additionally bind the real release
and installer scripts to the loopback-only contract.

Core, Admin Web and neutral contracts were unchanged by exact diff. The focused 20/20 check and
two clean native releases remain Technical-Lead/CI evidence rather than independently reproduced
host evidence.

## 8. Governance truth

The reviewed seven-file ADO synchronization consistently preserved:

- the fifth failed run as historical evidence;
- `DA1-PHYS-04` as independently closed;
- the failed APK as immutable evidence;
- the new APK as uninstalled and not physically validated;
- prohibition on reusing any earlier observation;
- no sixth Gate A–E authorization or execution;
- accurate distinction between CI attempts 1 and 2; and
- no production, production-data, deployment or distribution authority.

## 9. DA1-ARTIFACT-02 disposition

`DA1-ARTIFACT-02` is closed with this review as an artifact-pipeline finding. The former gap —
package, hash and signature checks did not prove runtime completeness — is now closed by the
frozen runtime contract, deterministic Hermes verifier, build-ready boundary, pre-ADB installer
boundary and regression-effective tests.

This closure is not a corrected physical result and does not close Development Assignment 1.

## 10. Eligibility of a later gate

The Human Architect may now separately rebind the exact runtime-complete candidate and authorize a
sixth complete fresh Gate A–E run. The review itself authorizes neither rebinding nor execution.

Any later authorized run must:

- repeat immediate size, SHA-256, signature, signer/package/version, backup-boundary and runtime
  checks;
- abort before installation on any mismatch;
- begin at Gate A step 1; and
- reuse no observation from any earlier run or preflight.

Production resources, production data, deployment and distribution remain unauthorized.

## 11. Exact next step

After truthful review synchronization and its required exact-head CI, the Human Architect may
separately authorize the exact candidate and the sixth complete fresh Human Physical Gate.

If that gate passes, its evidence must be synchronized truthfully and Development Assignment 1
still requires its independent final closure review.
