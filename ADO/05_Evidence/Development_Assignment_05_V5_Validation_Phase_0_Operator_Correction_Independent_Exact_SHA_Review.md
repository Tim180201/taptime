# Development Assignment 5 — V5 Validation Phase-0 Operator Correction Independent Exact-SHA Review

- Status: **HISTORICAL ROUND-2 `083fdfb` APPROVED; LATER READINESS `496ca59` CHANGES REQUIRED**
- Review date: 2026-07-29
- Review mode: historical independent read-only Exact-SHA re-review, round 2; separate later
  independent formal-readiness review record
- Verdict: historical `083fdfb` `APPROVED`; later `496ca59` `CHANGES REQUIRED`
- Open findings: historical P0 `0`, P1 `0`, P2 `0`, P3 `0`; later P0 `0`, P1 `0`, P2 `1`,
  P3 `0`

## 1. Authority and exact review binding

This record archives the completed independent round-2 review of the exact focused Validation
Phase-0 operator correction. The correction authority was limited to the tracked operator,
shared Android ADB runner, focused tests and the four accompanying ADO truth records. It did not
authorize Product behavior, NFC semantics, a hardware run or production activity.

| Binding | Reviewed value |
|---|---|
| Authorized baseline/parent | `39a6ef09fad18375af025bc8ed12cc1ea6dda964`; tree `10cdf16421fe564e1961a39d79e20775c0269fc4` |
| Candidate/operator commit | `083fdfb259089d976e48f824e0862f10637d3290`; tree `24bd130500934c6a48fd9314fa06387d6ebdedcd` |
| Exact-head CI | GitHub Actions run `30402655381`, attempt 1, 12/12 successful, exact candidate |
| Exact delta | 11 authorized files, `+3949/-81` |

The review confirmed the exact parent/candidate/tree bindings, `HEAD`, `main`, `origin/main` and
remote binding at the candidate, and the exact 11-file scope. The reviewer made no repository
write and ran no tests, ADB command, installation or hardware action.

## 2. Exact reviewed scope

The exact candidate contains only:

1. `ADO/README.md`
2. `ADO/00_Core/Project_Status.md`
3. `ADO/04_Operations/Development_Assignment_05_V5_Runbook.md`
4. `ADO/05_Evidence/Development_Assignment_05_V5_Evidence.md`
5. `apps/mobile/scripts/da5V5AndroidDevice.d.mts`
6. `apps/mobile/scripts/da5V5AndroidDevice.mjs`
7. `apps/mobile/scripts/da5V5ValidationPhase0Operator.mjs`
8. `apps/mobile/scripts/da5V5ValidationPhase0OperatorCore.d.mts`
9. `apps/mobile/scripts/da5V5ValidationPhase0OperatorCore.mjs`
10. `apps/mobile/tests/runtime/da5V5AdbChildEnvironment.test.ts`
11. `apps/mobile/tests/runtime/da5V5ValidationPhase0Operator.test.ts`

The operator binds the exact `03694f2` APK, manifest and source closure, accepts bounded legitimate
Android installed paths including `~`, installs only from a stable verified host snapshot,
proves installed bytes and identity, launches only
`com.tim180201.mobile.validation/.MainActivity` as User 0 and owns fail-closed cleanup without
reverse mutation.

No Product runtime, NFC acceptance rule, dependency, lockfile, schema, workflow, package script,
artifact byte or signing input changed.

## 3. Round-1 P1 disposition

Both round-1 P1 findings are closed:

- **P1 — Android user/package provenance:** the correction requires exactly one non-headless
  running Owner User 0, proves the complete User-0 package-null state including known, hidden and
  uninstalled PackageManager views, uses `-R` and explicit User-0 package actions, and latches
  ownership only after exact path, canonical-path, stat, version and digest proof. The ownership
  token is re-attested before force-stop and again before version-conditional uninstall. Missing,
  ambiguous, replaced or exchanged provenance preserves residue and returns mismatch.
- **P1 — cleanup/runner deadline:** the first finish or abort request starts one absolute deadline
  shared by active-operation settlement and cleanup. Every remaining wait and ADB call is capped
  to that deadline, expiry cannot match, and both text and binary runner paths settle terminally
  after TERM/KILL grace without depending on child close.

The review independently confirmed the resulting User-0, package, artifact and device-provenance
boundaries, exchange detection, cleanup ownership and hard deadline.

## 4. AVS evidence

The reviewed operator correction is R3 because it controls privileged ADB installation and
cleanup. Its exact evidence is:

- V0: exact 11-file candidate scope, binding and diff integrity confirmed.
- V1: 3/3 changed Node entry-point syntax checks and the exact focused operator/shared-runner
  suites, 128/128 passed.
- V2: Mobile tests-inclusive typecheck passed; source-inclusion output included both changed test
  sources.
- V3: final post-correction safe-root evidence passed 20/20 builds, 21/21 tests-inclusive
  typechecks and 21/21 suites covering 148 test files and 2,484 passed tests, with exactly two
  documented optional B1 skips. Migrations 001–013 apply/replay/ledger, C3B binary verification,
  52/52 Mobile test-source inclusion, the unchanged artifact verifier and the 861-module Android
  export passed. Synthetic completed the unique 13/13-file, 288/288-test matrix after the one
  disclosed safe-root fixture correction; candidate bytes were unchanged.
- V4: exact-head run `30402655381`, attempt 1, passed 12/12 on
  `083fdfb259089d976e48f824e0862f10637d3290`.
- V5: `NOT RUN`; not authorized.

The independent re-review carried the bound V1–V4 evidence and performed no new test, ADB,
installation or hardware execution.

## 5. Residual risk and verdict

The sole accepted residual risk is the documented Option-A boundary: the operator does not claim
protection against concurrent privileged manipulation by a competing process under the same
trusted local User. No other residual review finding remains.

Verdict: **APPROVED** for the exact candidate and CI binding above, with zero open P0–P3. The two
round-1 P1 findings are closed.

## 6. Authority and publication boundary

The candidate remains **DO NOT START**. All eight Phase-0 authorities are consumed. No new
Phase-0, installation, ADB, hardware, device/Tag or Product Human-V5 authority follows. Product
Human V5 remains `NOT RUN` and requires a new separate exact Human authorization.

Production, production data, system changes, deployment and distribution remain unauthorized.

The ADO-only archival synchronization that adds this record is R0/V0 and carries the exact
candidate V3/V4 evidence without repeating it. This record binds only the reviewed candidate and
its CI; it does not and cannot certify its own future publication commit, tree, remote state, CI
or review.

## 7. Separate later Phase-0 readiness candidate V4 and formal-review disposition

This later record does not amend or reopen the historical round-2 `APPROVED` verdict for
`083fdfb` above. It records the separately published readiness candidate and the consumed result
of its exact-candidate V4 and formal review.

| Later binding | Consumed value |
|---|---|
| Baseline/parent | `fa1aaa782415aceb85c0aa5c1233732ef9afa4dc`; tree `da69081517d2b0b9631eaef393b0a6022735061e` |
| Published eight-file readiness candidate | `496ca59f0965670b29a210b8aa2443b99bb4a386`; tree `b398b89c77f7f0b4799a7a06b11bd2daf51fd34a` |
| Safe-root V3 disposition | Green; the eight-file candidate itself has no code finding |
| Exact-candidate V4 | GitHub Actions run `30427205223`, attempt 1, completed failure, 11/12 |
| Red job | `90496143535`; 3/3 files and 121/121 assertions passed before a subsequent unhandled PostgreSQL `57P01` on `taptime_c3e1_dirty_*` |
| Formal-review verdict | `CHANGES REQUIRED`; P0 `0`, P1 `0`, P2 `1`, P3 `0` |

The C3E1 test, backend and workflow were unchanged. The test blob is identical to green
`083fdfb` and five previous green CI runs. The failure cause is the `dirtyPool.end()` to immediate
`DROP DATABASE ... WITH (FORCE)` sequence racing asynchronous client-end handling in
`pg-pool@3.14.0`.

The sole later finding is an out-of-scope P2 for CI/test reliability. It is not a Product or
Security finding and does not add a code finding to the safe-root V3/eight-file candidate. The
failed exact-candidate CI consumes V4; no retry was authorized or executed. A focused harness
correction and a new CI run require new Human authority.

The candidate and operator remain **DO NOT START**. No Phase-0, installation, ADB, hardware,
device/Tag or Product Human-V5 authority follows. No hardware action occurred.

This five-file ADO-only truth synchronization is R0/V0 over unchanged code, test and workflow
bytes. It carries the consumed V4/review truth without executing tests or CI and cannot certify
its own future publication commit, tree, remote state, CI or review.
