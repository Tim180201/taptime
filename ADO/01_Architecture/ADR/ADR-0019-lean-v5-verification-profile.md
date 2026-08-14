# ADR-0019: Lean V5 Verification Profile

## Fast-flight activation (`2026-08-13`)

The exact-head approved authorization published at
`9032581b1cb13b4a44f575aaface8a87989f4932` / tree
`03c06109a622e666d693ad9f28785ad834f4e663` activates the prospective fast-flight policy in
`Development_Assignment_05_V5_Fast_Flight_Cycle_Authorization.md`. The compiled, digest-bound
Supervisor is the only DA5 V5 start path: it starts one fresh child, never resumes or restarts,
and creates a closed post-cleanup receipt only after child exit and fresh clean-state attestation.
Every Human/Hardware invocation still requires separate exact authority. Current executable and
Hardware state remains **STOP** pending implementation verification, review, publication and V4.

The append-only Event Ledger is the single published event source. Historical attempt truth below
remains immutable and is referenced, not copied or reclassified.

### Current verification and V3-B amendment candidate (`2026-08-14`)

The independently approved pre-amendment candidate is tree
`b775c248bb268e91b141c62361b47614f38934a5`, full 18-path patch 212,896 bytes / SHA-256
`155bb35851508e30bed6c3b2908c8b410845ddd6fabc3bd795016bd0ed744cc1`. Fresh affected-boundary
V2 passed: Synthetic 16 files / 384 passed / 19 expected DB skips, Mobile 1 file / 120 passed,
both tests-inclusive typechecks, fresh build and both bundle bindings/checks.

Final V3-A is consumed `FAIL_CLOSED`: D01/D02, 11 databases, 27 migration invocations, 20 builds,
21 memberships/typechecks/suites (155 files; 3,043 tests: 3,040 passed, zero failed, three expected
skips) and C3B passed; the following no-install preflight stopped because the runner omitted exact
`TAPTIME_SYNTHETIC_E2E_PROFILE=da5-v5`. Repository source requires that value and rejects every
other profile. This is a runner-configuration failure, not a code or Product finding. No ADB,
installation, Product or Hardware action occurred; cleanup passed.

Only after independent ADO review `APPROVED`, exactly one **new** V3-B is authorized on this
amendment's resulting exact tree/patch. It reruns the complete established V3 from D01 with
absolute Node 24/npm CLI where npm is required; V3-A is diagnostic context only. From exact
candidate-checkout CWD `/Users/timbartz/Dokumente/GitHub/taptime` and the unchanged minimal
sanitized V3 environment, the read-only no-install gate directly invokes exactly once:
`/usr/bin/env TAPTIME_SYNTHETIC_E2E_PROFILE=da5-v5 /Users/timbartz/.nvm/versions/node/v24.17.0/bin/node apps/mobile/scripts/da5V5AndroidNoInstallPreflight.mjs`.
The helper is the direct child of bound absolute Node `24.17.0`; D01 binds its path/version/digest
and gate evidence binds exact CWD/argv, environment-name proof, raw output and return code. No npm
lifecycle, bare `node`/`npm`/`npx`, ADB or install is permitted. Any failure consumes V3-B with no
retry; green V3-B proceeds only to independent review, never Hardware.

- Status: **ACTIVE — HUMAN ACCEPTED; INDEPENDENTLY APPROVED; PUBLISHED**
- Date: 2026-08-02
- Historical candidate baseline commit: `456da51150f8748a647ab46aa10fd0e1f25b54bf`
- Historical candidate baseline tree: `a4ba688a55e6302f1588cc3ceda48d9a63c4933b`
- Accepted publication: `83635335aa4f547dc8994243c604dacf9797f593` / tree
  `40b7655a94e607b8afe19f90f42a95f42ee6d582`
- Executable Lean closure: `1b341d83592ea457c8ca722d01bfa2e64fe8cc40` / tree
  `2db756832a81f07cdb1a927ff3076320cc253960`
- Owner: Technical Lead
- Decision authority: Human Architect
- Related: AVS-001, DA5 V5 Runbook, DA5 V5 Evidence, R-034
- Historical candidate risk: AVS-001 **R0** for this ADO-only decision candidate; executable V5
  preparation remains **R3**

## 1. Context

The historical DA5 V5 Harness grew into a 45-gate, per-attempt executor and Evidence system.
That system correctly failed closed, but its operational complexity became disproportionate to
the Product risk being verified. Attempt 15 demonstrates the problem: 30 gates passed, the
mapped `MOBILE_FOCUS_TEST` child exited 0 with zero quality failures, and Gate 28 nevertheless
stopped on `unexpected_output_root`. The immutable run Evidence intentionally contains no raw
changed path. Static source inspection supports the inference that the Gate-28 allowlist omitted
the normal Vite cache beneath `apps/mobile/node_modules/.vite`; this is not an observed run path
and is not a Product defect.

The Human Architect therefore directed TapTim.e to replace the 45-gate approach prospectively
with a maximum-six-stage verification profile. Historical attempts and their immutable Evidence
remain truthful and unchanged. The decision changes verification orchestration, not Product
behavior, Product acceptance, security policy, tenant isolation or Human/Physical authority.

## 2. Decision

### 2.1 Verify the Product boundary

V5 preparation SHALL verify TapTim.e, its security and data boundaries, and the final artifact.
A new control or Evidence field is justified only by a concrete Product, security,
reproducibility or cleanup risk. Verification infrastructure SHALL NOT become an independently
expanding product.

Standard repository commands and the existing CI workflow are preferred. A custom immutable
per-attempt executor is not required by default. If a future concrete risk requires a custom
runner, its necessity, bounded scope and lifecycle require explicit technical review.

### 2.2 Maximum-six-stage profile

One V5 candidate SHALL use no more than these six stages:

1. **Baseline, dependency and artifact binding** — verify the selected commit/tree, protected
   scope, lockfile/toolchain inputs and any carried Evidence. Bind installable or releasable
   artifacts and manifests by exact identity where they already exist.
2. **Reproducible dependency establishment** — reconstruct locked dependencies in a bounded
   local/CI workspace using standard repository commands. Treat only escaped, ambiguous or
   cleanup-resistant output as a failure.
3. **Risk-adaptive automated Product verification** — execute the AVS-selected Product,
   security, tenant-isolation, tests-inclusive typecheck and build boundaries. Start focused,
   expand when impact or uncertainty requires it, and run one complete candidate regression at
   the applicable AVS decision point.
4. **Isolated backend/PostgreSQL verification** — exercise the relevant database, migration,
   least-privilege, tenant and lifecycle boundaries against disposable synthetic state; clean up
   all task-owned state.
5. **Publication closure** — bind the final artifact, publish the focused candidate, obtain the
   required exact-head CI and independent review, and complete bounded cleanup. A documentation
   closure carries exact unchanged evidence without pretending that it reran Product checks.
6. **Human/Hardware V5** — run only under a separate exact Human authorization against the
   independently approved artifact, device and operational bindings.

Stages MAY be combined when their boundaries and evidence remain unambiguous. They MUST NOT be
split into additional per-tool or per-file Human authorization gates merely to reproduce the
historical attempt structure.

### 2.3 AVS-001 remains controlling

This decision applies AVS-001; it does not weaken it:

- V0 is required for every change.
- R2/R3 changes retain affected-boundary verification, complete candidate regression,
  exact-head CI and independent review as required by AVS-001 and the governing package.
- V5 remains separate Human/Physical evidence and cannot be inferred from V0–V4.
- Unknown impact expands verification; elapsed time or quota does not justify guessing.
- A standard typecheck is never described as tests-inclusive unless the configuration proves it.

### 2.4 Evidence reuse and reruns

Exact green Evidence MAY be carried forward only when all risk-relevant inputs are unchanged and
the binding required by AVS-001 is recorded. Carried Evidence is labeled as carried, not freshly
executed. Already-green unchanged checks are not rerun merely because an ADO synchronization or
an unrelated correction occurred.

An unchanged failed check is never retried to seek a green result. A confirmed In-Scope
technical finding changes the relevant input, receives focused regression coverage and triggers
only the affected verification plus the final AVS decision-point gates. Independent findings MAY
be collected and corrected together when continuing is non-destructive, causally independent and
does not conceal a safety precondition failure.

Once a concrete R2/R3 implementation scope has independent `APPROVED` review and exact
publication, automated V0–V4 work—including confirmed In-Scope corrections and required
reruns—does not require a fresh Human prompt for every intermediate technical finding. Product,
Business, architecture or scope ambiguity still returns to the Human Architect.

### 2.5 Bounded ordinary tool output

Normal dependency, compiler, bundler, test and cache output within declared task-owned or
workspace-local tool roots is not a standalone security finding and requires neither an
individual file digest nor a per-attempt Human authorization. The declaration may use a narrow
standard tool root rather than enumerate every generated file.

The run fails closed when output:

- escapes the declared repository/task-owned roots;
- crosses a protected or foreign workspace boundary;
- is a symlink, mount or identity ambiguity relevant to a destructive cleanup decision;
- changes tracked source, schema, dependencies, lockfiles, workflow or protected configuration
  outside the authorized delta; or
- cannot be removed safely from an exactly bounded task-owned root.

Published Product artifacts, manifests, selected commits/trees and security-critical external
tools retain exact size/digest/version or equivalent identity binding where required. Temporary
cache files do not become release artifacts.

### 2.6 Concise truthful evidence

The default Evidence package is a concise Change-Impact Record plus:

- selected baseline and final candidate identities;
- commands or CI jobs actually executed;
- result, count, disclosed skip and attempt information;
- carried Evidence and its exact unchanged-input binding;
- omitted checks with evidence-based reasons;
- failures and corrective changes;
- final artifact/manifest identity where applicable; and
- bounded cleanup result.

Raw logs, secrets, arbitrary paths, per-file cache manifests and duplicate status prose are not
required. Disclosure-safe summaries do not replace diagnostic information needed to investigate
a real Product or security failure; such information remains local and bounded under the
applicable data policy.

### 2.7 Failure handling

Baseline, final artifact, security, tenant, authorization or destructive-cleanup ambiguity is an
immediate fail-closed stop. Independent non-destructive Product checks MAY continue after a
quality failure when their prerequisites remain valid, so one run can collect an actionable
failure set. The report must distinguish executed failure, dependency omission and safety stop.

Temporary dependency, build, test and database roots must be task-owned, bounded and cleaned.
Cleanup failure is reported truthfully and may not be hidden by a successful Product assertion.

### 2.8 Historical 45-gate evidence

Attempts 1–15 remain immutable historical Evidence with their recorded outcomes. Attempt 15 is
consumed and cannot be retried, repaired or resumed. This ADR prospectively supersedes the
45-gate/per-attempt-executor requirement; it does not rewrite those attempts and does not
authorize Attempt 16 or any other legacy executor run.

## 3. Consequences

### Positive

- Product confidence is concentrated at meaningful AVS decision points.
- Legitimate bounded tool caches no longer create per-file governance work.
- Findings can be diagnosed and corrected in coherent batches.
- Human authorization remains focused on Product, architecture, Physical and production risk.
- Historical Evidence remains auditable without dictating future orchestration.

### Trade-offs

- Change-impact classification and carried-Evidence reasoning must be explicit.
- Broader tool roots require careful containment and cleanup boundaries.
- Ambiguous impact selects the broader Product boundary rather than a custom narrow gate.
- Exact final artifact and V5 bindings remain intentionally strict.

## 4. Current activation and authority boundary

The activation conditions are complete. The Human Architect accepted the ADR and Lean
authorization, independent architecture/authorization review returned `APPROVED` with zero open
P0–P3, and the focused decision was published at
`83635335aa4f547dc8994243c604dacf9797f593` / tree
`40b7655a94e607b8afe19f90f42a95f42ee6d582`.

Lean stages 1–5 and automated V0–V4 completed on executable
`1b341d83592ea457c8ca722d01bfa2e64fe8cc40` / tree
`2db756832a81f07cdb1a927ff3076320cc253960`. Exact-head CI run `30786622180`, attempt 1, passed
12/12 without retry, and final independent Exact-Head/Artifact Review returned `APPROVED` with
zero open P0–P3. This is carried executable Evidence, not Evidence freshly produced by a later
ADO-only synchronization.

The historical 45-gate/per-attempt Harness is superseded. All attempts remain immutable and
consumed; Attempt 16 and every legacy Harness rerun remain unauthorized. Active authority stops
immediately before Human/Hardware V5. A fresh exact Human start signal is required before
Hardware, ADB, installation or any Product run. Production, production data, production signing,
deployment and distribution require separate authorization.

Current R0 candidate baseline `2d0cbd01ce483987c375eeee9ecc49f37e2185f8` / tree
`840fd156fe46614adf9d1bec2a018a2c6b453c1c` is not the future Hardware-authority ADO head. Only
after focused R0 publication may a new one-time Human Hardware authorization be issued. Before
that authorization, Publication Closure must truth-synchronize and review the exact then-final
published ADO commit/tree, including the governing Flight Card and Runbook versions. The live
authorization must quote that ADO commit/tree and exactly bind Operator executable/tree, runtime
manifest/entrypoint/map, APK plus artifact manifest/package/signature, governing Node/toolchain,
and exact device/Tags/environment/Guard/Credential constraints. Any missing or differing binding stops
before Phase B, ADB, installation or Hardware without retry. No future commit/tree is claimed by
this candidate.

## 5. Historical candidate Change-Impact Record

- Baseline: commit `456da51150f8748a647ab46aa10fd0e1f25b54bf`, tree
  `a4ba688a55e6302f1588cc3ceda48d9a63c4933b`.
- Changed boundary: ADO governance only; no executable, schema, dependency, lockfile, workflow or
  artifact input.
- Risk: R0 for this candidate; the policy governs future R3 verification without reducing it.
- Verification: AVS V0 only—exact scope/diff, whitespace, headings/navigation/references and
  truth consistency.
- Product suites/V1–V5: not run; not relevant to an unactivated documentation-only candidate and
  not authorized.
- Carried Evidence: immutable Attempt-15 facts recorded in the DA5 V5 Evidence document.
- Historical next gate: the independent review and focused publication later completed as
  recorded in Section 4. The current next gate is a separately authorized Human/Hardware V5 run.
