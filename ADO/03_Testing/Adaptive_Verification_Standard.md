# AVS-001 – Adaptive Verification and CI Efficiency Standard

Status: Active — Human Architect Accepted; Manual Operating Rules Effective; CI Automation Pending
Document ID: AVS-001
Version: 1.0
Date: 2026-07-20
Owner: Technical Lead
Approval Authority: Human Architect
Related Standards: EOM-001, DTP-001, OAP-001, RHS-001

## Purpose

AVS-001 defines how TapTim.e preserves professional verification quality while avoiding repeated
execution of unrelated tests, builds and CI jobs.

The standard replaces the informal practice of repeating the complete repository matrix after
nearly every intermediate action with an evidence-based, risk-adaptive verification model.

It does not lower the Definition of Done. It changes when and why each verification layer runs.

## Human Decision

The Human Architect accepted the following operating decision on 2026-07-20:

> TapTim.e shall use focused verification during implementation, complete affected-boundary
> verification before Technical-Lead acceptance, one complete candidate regression before
> independent review, and a complete exact-head CI gate for product/release candidates. Existing
> security, independent-review, artifact and Human physical gates remain intact.

## Current Repository Truth

At adoption time, `.github/workflows/ci.yml` starts the complete ten-job matrix for every push and
pull request targeting `main`:

1. Core, Mobile, Admin Web and neutral-contract quality;
2. B1 PostgreSQL spike;
3. B3 schema security;
4. B4 identity and Membership security;
5. B5 tenant-safe read model;
6. B6 server-canonical lifecycle;
7. C2/C3C/C3E1/C3E2/offline API and Mobile transport;
8. C3B secure Organization bootstrap;
9. C3C/C3E1/C3E2 administration security; and
10. synthetic server-connected Android E2E harness.

The workflow already cancels an older in-progress run when a newer run for the same reference
starts. It does not yet contain a reviewed change-impact classifier or documentation-only path.

Therefore:

- the manual verification rules in this standard take effect immediately;
- fewer intermediate pushes and fewer redundant local full-suite runs may be used immediately;
- automatic CI job selection requires a separate authorized implementation task;
- this document does not claim that the current GitHub Actions behavior has changed; and
- until that implementation is independently approved, every push to `main` still consumes the
  current complete CI matrix.

## Scope

AVS-001 applies to:

- implementation work;
- bug and security corrections;
- refactoring;
- tests and test infrastructure;
- database schema and migration work;
- build, packaging and artifact work;
- ADO and other documentation-only work;
- Technical-Lead verification;
- independent-review preparation;
- exact-head CI;
- physical-gate preparation; and
- future deployment and release verification.

It applies to Humans and Agents performing Technical Lead, Development, Review and Implementation
Support responsibilities.

## Non-Goals

AVS-001 does not:

- authorize implementation, production, production data, deployment or distribution;
- relax an existing authorization package or gate;
- make a focused test equivalent to a complete regression;
- allow a green source-only typecheck to be described as tests-inclusive;
- allow a failed test to be ignored because it appears unrelated or expensive;
- allow skipped jobs to be reported as executed;
- replace independent review;
- replace Human physical validation where required;
- permit evidence from one commit, tree, artifact or environment to be silently attributed to
  another; or
- optimize CI by weakening tenant isolation, authentication, durability, migration or artifact
  checks.

## Normative Language

`MUST`, `MUST NOT`, `SHALL`, `SHALL NOT`, `REQUIRED`, `SHOULD`, `SHOULD NOT` and `MAY` are used
normatively.

Where AVS-001 conflicts with a concrete Human authorization, accepted ADR, security boundary,
release gate or Physical-Gate runbook, the stricter requirement applies.

## Core Principles

### 1. Verify the Changed Risk

Verification SHALL follow the changed behavior, its transitive dependencies and its failure
impact, not merely the directory containing the edited file.

### 2. Fast Feedback First

During implementation, the smallest regression-effective test set SHALL run first. This shortens
the feedback loop without converting focused evidence into final evidence.

### 3. Full Confidence at Decision Points

Complete regression and exact-head CI SHALL be concentrated at the points where a candidate is
accepted, independently reviewed, physically tested, deployed or released.

### 4. Evidence Is Bound

Every verification claim SHALL identify the source state, command or job, result and relevant
environment. Artifact claims SHALL additionally identify artifact size, digest and required
identity/signature metadata.

### 5. Uncertainty Expands the Test Set

If impact cannot be determined confidently, the verifier SHALL select the broader boundary or the
complete matrix. Cost or elapsed time is not a reason to guess.

### 6. Quality Is Not a Run Count

Repeated execution of unchanged tests against unchanged inputs does not create new product
confidence. New evidence is required when code, configuration, dependencies, environment,
artifact or risk changes.

## Change-Impact Record

Before selecting verification, the responsible Agent SHALL create a concise Change-Impact Record
in the task notes, implementation evidence or final handover.

The record contains:

- exact baseline commit and tree when available;
- changed files and intended behavior;
- affected workspaces and transitive consumers;
- affected security, data and runtime boundaries;
- risk class;
- selected verification levels;
- checks intentionally not run and the evidence-based reason;
- evidence carried forward, including its exact binding; and
- any uncertainty that forced broader verification.

The record may be concise for a small task. It may not be omitted.

## Risk Classes

### R0 — Non-Executable Documentation

All changed files are human-readable documentation and do not affect:

- source code;
- schemas or migrations;
- dependencies or lockfiles;
- compiler, bundler, native or release configuration;
- CI workflows or verification scripts;
- generated runtime inputs;
- security policy enforcement; or
- an artifact used for installation, deployment or release.

R0 classification requires an exact diff proving those conditions.

### R1 — Isolated Low-Risk Implementation

The change is contained within one well-understood component or workspace, has no privileged or
durable-data effect and has an explicit regression test.

Examples include a pure presenter correction or a local non-security UI rendering change.

### R2 — Boundary or Cross-Component Change

The change affects a public contract, shared package, API parser, Mobile/Web coordination,
repository adapter, build boundary or multiple workspaces.

### R3 — Security, Durability or Release-Critical Change

R3 includes any change involving:

- authentication, authorization, Membership or identity binding;
- Organization isolation, RLS or least-privilege roles;
- NFC capture ownership, concurrency, session generation or tag reassignment;
- offline persistence, queue ordering, idempotency, retry or reconciliation;
- encryption, SecureStore, SQLCipher, backup or transfer boundaries;
- schema migrations, transaction isolation or canonical lifecycle decisions;
- secrets, runtime configuration, CORS or disclosure boundaries;
- build, signing, packaging, artifact verification or installer behavior;
- CI selection logic, test runners or verification tools; or
- production, deployment, rollback, backup or recovery.

R3 SHALL fail closed and receives the broadest relevant verification.

## Verification Levels

### V0 — Integrity and Scope Check

Purpose: prove what changed and that the repository remains structurally valid.

Minimum:

- exact tracked diff and scope review;
- clean whitespace/error check;
- reference/link or formatting validation where available;
- no unsupported status, approval, CI or closure claim; and
- tracked working-tree preservation.

V0 is required for every task.

### V1 — Focused Feedback

Purpose: catch defects quickly while work is in progress.

Minimum:

- directly changed tests;
- a regression test that fails against the previous defect where applicable;
- nearest contract/parser/behavior tests; and
- a focused typecheck or static check for the changed source.

V1 MAY run repeatedly during implementation.

V1 alone is never final Technical-Lead evidence for R2 or R3.

### V2 — Affected-Boundary Verification

Purpose: prove the complete impacted dependency boundary before technical acceptance.

Minimum:

- complete tests for every affected workspace;
- tests-inclusive typechecks for changed test sources;
- relevant builds, bundles or declarations;
- direct database/migration verification if a persistence boundary is affected;
- direct adversarial or failure-path checks for changed security behavior; and
- unchanged-boundary confirmation for explicitly protected neighboring components.

V2 is required before Technical-Lead `APPROVED` for executable changes.

### V3 — Complete Candidate Regression

Purpose: establish one complete local candidate baseline before independent review or another
high-consequence gate.

Minimum:

- all locally executable repository suites;
- all applicable tests-inclusive typechecks;
- all applicable builds and bundles;
- migration-ledger verification against clean PostgreSQL where relevant;
- native release or artifact verification where relevant;
- exact test counts and disclosed skips; and
- final diff/scope inspection.

V3 is required:

- once for the final implementation candidate before its independent review;
- after any R3 correction;
- after dependency, lockfile, toolchain, root configuration or CI-verifier changes;
- when accumulated changes cross multiple architectural boundaries;
- when affected scope is uncertain;
- when V1 or V2 exposes an unexplained failure; and
- before a release or Physical-Gate candidate is published if the governing package requires it.

V3 SHOULD NOT be repeated after an unchanged documentation-only synchronization unless a stricter
existing gate explicitly requires it.

### V4 — Complete Exact-Head CI

Purpose: prove the published candidate on an independent clean runner.

The complete required GitHub Actions matrix SHALL pass on the exact commit selected as the
product, correction, artifact, deployment or release candidate.

V4 is required:

- for every final product implementation candidate;
- for every published security or R3 correction;
- before independent review where the review package requires exact-head CI;
- before a Human Physical Gate;
- before deployment or release; and
- whenever an explicit authorization package requires complete exact-head CI.

Intermediate implementation checkpoints SHOULD NOT be pushed only to obtain additional complete
CI runs when V1/V2 can provide equivalent development feedback.

### V5 — Human, Physical and Operational Validation

Purpose: verify behavior that automated source and CI evidence cannot establish.

V5 includes:

- real-device NFC;
- airplane-mode and process-restart behavior;
- Human-visible disclosure and interaction checks;
- exact APK/artifact binding;
- deployment rehearsal;
- backup/restore and recovery exercises; and
- production-readiness gates.

V5 requires separate Human authorization when the governing artifact says so. No observation from
an aborted or failed fresh gate may be reused unless the governing authorization explicitly
allows it.

## Required Verification by Risk

| Risk | During implementation | Before Technical-Lead approval | Before independent review/publication | Before Physical/Release gate |
|---|---|---|---|---|
| R0 | V0 | V0 | V0 plus any explicit document-review check | Stricter existing gate wins |
| R1 | V1 | V0 + V2 | One V3 candidate run, unless the accepted task explicitly narrows it | V4 and V5 if applicable |
| R2 | V1 | V0 + V2 | V3 + V4 on the selected candidate | V4 exact binding + applicable V5 |
| R3 | V1 plus adversarial checks | V0 + V2 | V3 + V4; independent review mandatory | Fresh V4 binding + separately authorized V5 |

## Documentation-Only and ADO-Only Changes

A documentation-only change MAY omit product test suites only when the Change-Impact Record proves
R0.

Required evidence:

- exact changed-file list;
- proof that no executable, schema, dependency, configuration, workflow, script or artifact input
  changed;
- V0 integrity checks;
- truthful references to existing test/CI evidence; and
- no new product correctness claim derived solely from documentation.

An ADO-only synchronization MAY carry forward a complete product CI result when:

- the exact product commit/tree remains named;
- the synchronization delta is R0;
- no generated artifact or runtime value changes;
- the carried evidence is identified as carried, not freshly executed; and
- no accepted authorization package explicitly requires a second complete exact-head run on the
  ADO head.

This rule is prospective. It does not retroactively weaken Development Assignment 1 or any other
existing exact-head binding.

## Test-Inclusive Typecheck Rule

A typecheck SHALL be described as tests-inclusive only when objective evidence proves that the
executed configuration includes the relevant test files.

Vitest or another transpile-and-run test result is not, by itself, a TypeScript typecheck.

If the standard workspace configuration excludes tests, the task SHALL run a supplementary
tests-inclusive configuration or report the gap. A source-only typecheck may still be reported,
but only by its accurate name.

## Complete Regression Cadence

During active development:

- V1 runs as needed;
- V2 runs once the affected implementation boundary is coherent;
- V3 runs once on the final review candidate rather than after every intermediate edit;
- V4 runs once on the final published candidate rather than on disposable checkpoints; and
- after CI automation exists, one scheduled complete matrix SHOULD run at least weekly during
  active repository development to detect dependency/environment drift.

No scheduled run is required during a period with no repository or dependency change unless a
release, compliance or operational rule requires it.

## Push and Publication Discipline

Agents SHALL avoid pushing transient or known-incomplete candidates to `main`.

The preferred sequence is:

1. implement locally with V1;
2. complete the affected boundary with V2;
3. run one V3 candidate regression;
4. obtain Technical-Lead approval;
5. publish the focused candidate once;
6. obtain one V4 exact-head result;
7. prepare the independent-review prompt; and
8. synchronize review/closure documentation without repeating product verification unless a
   stricter gate requires it.

Fewer pushes MUST NOT be achieved by creating an oversized, mixed-scope or unreviewable delta.

## Failure and Retry Policy

A failed check SHALL be investigated.

It may not be excluded merely because:

- it is slow;
- it passed previously;
- the changed file appears unrelated; or
- a rerun might turn green.

An unchanged CI attempt MAY be rerun when evidence identifies an infrastructure or teardown
failure after the tested assertions completed. The report SHALL preserve:

- the failed attempt;
- the exact failure;
- the reason it is classified as infrastructure/teardown;
- the unchanged source binding; and
- the successful retry, if any.

A repeated or unexplained failure is a repository finding and expands verification scope.

## Evidence Reuse

Evidence MAY be carried forward only when all relevant inputs are unchanged.

Required binding:

- source commit and tree;
- changed range proving the affected input stayed unchanged;
- dependency and lockfile state;
- toolchain/configuration state;
- command or CI job;
- environment relevant to the result; and
- result, count, skip and attempt information.

Artifact evidence additionally requires:

- byte size;
- cryptographic digest;
- package/version identity where applicable;
- signature identity where applicable;
- runtime-configuration verification where applicable; and
- preservation location and mutability state.

Evidence reuse SHALL be rejected if any relevant input changed or cannot be proven unchanged.

## Independent Review Requirements

Whenever an independent review is due, the Technical Lead SHALL provide the Human Architect with a
complete copy-ready Review Agent prompt.

The review package SHALL contain:

- exact baseline, candidate commit, tree and delta;
- exact changed-file scope;
- authorization and exclusions;
- Change-Impact Record and risk class;
- V0–V4 results that actually occurred;
- omitted checks and rationale;
- carried-forward evidence and its binding;
- open findings and known limitations;
- explicit prohibition on repository changes by the reviewer unless separately authorized; and
- the exact verdict format, including P0–P3 findings.

The independent reviewer MAY reproduce focused or adversarial checks. It SHALL not be told to
accept the Technical Lead's risk classification without verification.

## Human Physical Gate Requirements

AVS-001 does not shorten a Physical Gate.

Before a Physical Gate:

- the product/correction must have independent `APPROVED` review with no open blocking finding;
- the exact required V4 run must be green;
- the Human Architect must separately authorize the run;
- source, ADO head, artifact, size, digest, signature, package and runtime configuration must be
  bound as required;
- device and local infrastructure preflight must pass; and
- the run starts fresh at its first mandatory step.

## Future CI Automation Requirements

Automatic selective CI is not authorized by this document alone. A separate Infrastructure Task
shall implement it.

That task MUST provide:

- a version-controlled dependency and path-to-job map;
- a fail-closed classifier where unknown or ambiguous paths select the complete matrix;
- explicit full-matrix override for candidate, security, release and manual runs;
- a lightweight always-run integrity/governance job;
- a required aggregate result that distinguishes authorized skips from executed passes;
- tests proving every path class and transitive dependency;
- lockfile, root configuration, workflow and classifier self-change rules that select all jobs;
- one scheduled complete-matrix workflow during active development;
- preserved concurrency cancellation;
- auditable output listing selected and omitted jobs with reasons;
- no use of production secrets or production data; and
- independent review before the classifier controls a required gate.

No job-selection implementation may infer safety from folder names alone where a shared contract,
schema, build script or transitive consumer exists.

## Roles

### Human Architect

- accepts or rejects changes to verification policy;
- separately authorizes Physical, deployment and release gates; and
- decides whether a stricter product-specific gate may be relaxed prospectively.

### Technical Lead

- owns Change-Impact classification;
- selects and justifies verification levels;
- expands scope when uncertainty exists;
- approves technical evidence;
- produces the independent-review prompt whenever review is due; and
- prevents optimization from reducing security or product truth.

### Development and Implementation Support Agents

- run V1 and V2 as instructed;
- add regression-effective tests;
- report every failure and omitted check truthfully; and
- do not redefine risk or gate requirements.

### Review Agent

- independently verifies scope, risk and evidence;
- challenges unsafe omissions;
- distinguishes carried evidence from freshly reproduced evidence; and
- returns an evidence-based verdict without implementing changes.

## Standard Completion Report

Every implementation or correction handover SHALL include:

```text
Verification Summary

Baseline commit/tree:
Candidate commit/tree:
Risk class:
Changed boundaries:
V0:
V1:
V2:
V3:
V4:
V5:
Carried evidence:
Checks not run and reason:
Failures/retries:
Remaining risks:
Next required gate:
```

Fields that do not apply remain present as `Not applicable` or `Not authorized`.

## Metrics

The Technical Lead SHOULD periodically record:

- complete local regression runs per Development Assignment;
- complete CI runs per published candidate;
- duplicate runs caused only by documentation synchronization;
- cancelled superseded runs;
- failed attempts and root causes;
- average feedback time for V1/V2; and
- defects found after a narrower verification level.

Metrics guide improvement. They SHALL NOT become quotas that pressure an Agent to skip required
verification.

## Adoption and Precedence

AVS-001 applies prospectively from 2026-07-20.

For work already governed by an accepted authorization, implementation plan, Physical-Gate
runbook or exact-head requirement, the existing stricter text remains authoritative until the
Human Architect explicitly amends it.

In particular, AVS-001 does not alter the current Development Assignment 1
`DA1-ARTIFACT-02` review, artifact rebinding or future Human Physical Gate requirements.

## Revision History

| Version | Date | Change | Approval |
|---|---|---|---|
| 1.0 | 2026-07-20 | Established risk-adaptive local verification, concentrated complete candidate regression, exact-head CI requirements, evidence-reuse rules and the separately gated selective-CI target | Human Architect accepted |
