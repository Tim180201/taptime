# Development Assignment 5 — V5 Lean Verification Profile Authorization Candidate

- Status: **ADO-ONLY CANDIDATE — HUMAN DIRECTION ACCEPTED; INDEPENDENT REVIEW AND FOCUSED PUBLICATION REQUIRED; NO EXECUTION AUTHORITY**
- Date: 2026-08-02
- Baseline commit: `456da51150f8748a647ab46aa10fd0e1f25b54bf`
- Baseline tree: `a4ba688a55e6302f1588cc3ceda48d9a63c4933b`
- Owner: Technical Lead
- Approval authority: Human Architect
- Architecture: ADR-0019
- Verification: AVS-001

## 1. Purpose

This document is the architecture and authorization candidate for replacing the prospective DA5
V5 45-gate/per-attempt-executor model with the Lean V5 Verification Profile defined by ADR-0019.
It synchronizes the consumed Attempt-15 truth and defines the bounded scope that a later single
implementation authorization may activate.

This candidate is not executable authority. It authorizes no Product/test/script/workflow change,
dependency installation, build, artifact generation, local R3 execution, ADB action or Human V5.

## 2. Accepted direction

The Human Architect directed that future DA5 V5 verification contain no more than six stages:

1. baseline, dependency and artifact binding;
2. reproducible dependency establishment;
3. risk-adaptive Product/security/tenant/typecheck/build checks;
4. isolated backend/PostgreSQL verification;
5. exact-head CI, independent review, final artifact binding and cleanup; and
6. separately authorized Human/Hardware V5.

ADR-0019 supplies the normative architecture. AVS-001 remains controlling and the stricter
Product, security, artifact and V5 requirements remain intact.

## 3. Proposed implementation boundary

After this candidate receives independent `APPROVED` review with zero open P0–P3, is corrected
within its ADO-only authority if needed, and is focusedly published, the Technical Lead must stop
and request one compact exact implementation authorization. That later authorization may cover
only the changes necessary to:

- retire the historical 45-gate executor as the default future DA5 V5 path while preserving its
  artifacts and Evidence read-only;
- express the six Lean stages through standard repository commands and existing CI wherever
  possible;
- define bounded task-owned dependency, build, test, cache, database and cleanup roots;
- create a concise AVS Change-Impact/Evidence record and final artifact manifest;
- collect independent non-destructive failures safely while stopping immediately on invalid
  security, baseline, artifact or destructive-cleanup prerequisites; and
- connect the independently approved automated V0–V4 candidate to a separately authorized Human
  V5 run.

The later implementation SHOULD avoid a custom immutable per-attempt executor. A custom runner is
permitted only when its authorization identifies a concrete risk that standard commands cannot
bound adequately.

## 4. Proposed automated operating authority after implementation approval

The later implementation authorization may establish one continuous Development/Review cycle for
its exact published scope:

- focused V1 during correction;
- V2 for every affected Product/security/data boundary;
- one final V3 candidate regression when required by AVS-001;
- focused publication and the required V4 exact-head CI;
- independent read-only review for R2/R3;
- confirmed In-Scope corrections and corresponding focused re-verification/re-review; and
- final artifact identity and cleanup evidence.

Fresh Human prompts are not required between those automated V0–V4 steps solely because a
confirmed technical In-Scope finding changed the candidate. A Product, Business, architecture,
scope or authorization question stops the cycle. An unchanged failed check is not retried.

This future automated authority ends before Human/Hardware V5 and never covers production,
production data, deployment or distribution.

## 5. Verification and evidence contract

### 5.1 Change-impact first

Each candidate records baseline, changed files, transitive boundaries, risk, selected checks,
omissions, carried Evidence and uncertainty. If impact is ambiguous, the broader boundary or full
matrix is selected.

### 5.2 Carried Evidence

Green Evidence is reusable only with the exact AVS-001 unchanged-input binding. Carried Evidence
is labeled as carried. A documentation-only closure does not repeat Product verification unless a
stricter exact-head gate explicitly requires it.

### 5.3 Ordinary output

Normal output within declared standard dependency, compiler, bundler, test and cache roots is
permitted as one bounded tool class. It does not require per-file digests or a Human prompt.
Escape, protected-source mutation, unknown root, relevant symlink/mount ambiguity or unsafe
cleanup fails closed.

### 5.4 Exact identities

Exact identity remains mandatory where applicable for:

- final installable/releasable Product artifacts and manifests;
- selected source/publication commits and trees;
- dependency/lock state used to build the final artifact;
- security-critical external tools; and
- the exact Human V5 artifact/device/environment package required by its runbook.

### 5.5 Concise record

The default Evidence contains command/job, result, count, disclosed skips, carried evidence,
omissions, corrective delta, final artifact identity and cleanup. It excludes secrets, raw
Product data, arbitrary raw logs and per-file cache manifests.

## 6. Attempt-15 terminal synchronization

Attempt 15 executed once on publication commit
`456da51150f8748a647ab46aa10fd0e1f25b54bf`, tree
`a4ba688a55e6302f1588cc3ceda48d9a63c4933b`, and is consumed fail-closed. It cannot be retried,
repaired, resumed or reused as a new run.

Its immutable mode-`0555` Evidence root contains exactly three mode-`0444` files:

| File | Bytes | SHA-256 |
|---|---:|---|
| Receipt | 151,401 | `b27b17620aa659cec5c820ff0fdb97c2b33adc40adc4e68bce6a043daad5ac3f` |
| Precleanup snapshot | 2,503 | `3fdf644461cbd3bc96576d9cf36d2b6292be8101bdd4af74c739a7810021b5a1` |
| Evidence manifest | 1,160 | `d50c50a4b8dae5fcb356dc790e1eb8ebe69b0612c853119bc7e44748b53ceacb` |

All 45 records exist: 30 passed, two failed and 13 `not_run_hard_stop`. Gate 28
`MOBILE_FOCUS_TEST` failed with `unexpected_output_root`; the mapped child exited 0, stdout was
322 bytes, stderr was zero bytes and quality-failure count was zero. Gate 45 records
`hard_stop_recorded`. Cleanup and Postcleanup completed, artifact is `null` and
`raw_output_preserved` is false.

The independent failure review returned `CHANGES REQUIRED`:

- P2: static source analysis shows that `apps/mobile/vitest.config.ts` has no `cacheDir` and
  Vite 8.1.3 resolves the nearest package cache to `apps/mobile/node_modules/.vite`, while the
  Gate-28 output allowance did not include that normal root. Because the immutable run Evidence
  omits raw paths, the actual changed run path is an inference only. No Product defect is proven.
- P3: the existing six Harness ADO documents still described Attempt 15 as prospective and must
  reflect its terminal Evidence.

No Attempt-16 cache-allowlist correction is authorized or proposed. ADR-0019 replaces that
approach prospectively after its activation gates.

## 7. Explicit exclusions

This candidate does not authorize:

- Product code, tests, scripts, workflows, dependencies, lockfiles or schemas;
- Product rules, security rules, tenant behavior or NFC semantics;
- executor, Product artifact or manifest creation;
- dependency installation, build, CI dispatch or local R3 execution;
- retry, repair or resume of Attempt 15;
- Hardware, ADB, installation or Human/Product V5;
- production, production data, system changes, deployment or distribution; or
- access to `research/`.

## 8. Candidate activation gates

1. AVS R0/V0 exact-scope and consistency verification.
2. Independent read-only architecture/authorization review with verdict `APPROVED` and zero open
   P0–P3.
3. Confirmed ADO-only In-Scope corrections and re-review, if required, within three rounds.
4. Focused ADO-only publication.
5. Technical Lead stop and one compact, exact Human implementation authorization before any
   executable change or R3 run.

No statement in this candidate claims those gates have completed.

## 9. Change-Impact Record

- Baseline: `456da51150f8748a647ab46aa10fd0e1f25b54bf` / tree
  `a4ba688a55e6302f1588cc3ceda48d9a63c4933b`.
- Scope: the exact ADO-only candidate/synchronization paths named by the Human authorization.
- Affected runtime boundary: none until a later separately authorized implementation.
- Risk class: R0.
- V0: exact file/diff, whitespace, headings/navigation/reference and truth consistency.
- V1–V5: not run and not authorized; no executable input changed.
- Carried Evidence: immutable Attempt-15 identities and terminal counts above.
- Remaining risk: R-034 and DA5 remain open; Lean activation, implementation, final V0–V4 and
  Human V5 remain pending.
- Next gate: independent read-only review of this exact candidate.
