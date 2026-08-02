# ADR-0019: Lean V5 Verification Profile

- Status: **CANDIDATE — HUMAN DIRECTION ACCEPTED; INDEPENDENT REVIEW AND FOCUSED PUBLICATION REQUIRED BEFORE ACTIVATION**
- Date: 2026-08-02
- Candidate baseline commit: `456da51150f8748a647ab46aa10fd0e1f25b54bf`
- Candidate baseline tree: `a4ba688a55e6302f1588cc3ceda48d9a63c4933b`
- Owner: Technical Lead
- Decision authority: Human Architect
- Related: AVS-001, DA5 V5 Runbook, DA5 V5 Evidence, R-034
- Candidate risk: AVS-001 **R0** for this ADO-only decision candidate; future executable V5
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

## 4. Activation and authority boundary

The Human Architect accepted the direction represented by this candidate. The profile becomes
active only after:

1. an independent architecture/authorization review returns `APPROVED` with zero open P0–P3;
2. confirmed ADO-only In-Scope corrections, if any, receive required re-review; and
3. the focused ADO-only candidate is published exactly.

Before activation, the existing executable boundaries remain unchanged. After activation, a
single compact, exact implementation authorization is still required before Product code, tests,
verification scripts, workflows, executors, artifacts or any local R3 execution may change or
run. Human/Hardware V5, production, production data, deployment and distribution always require
their own separate authorization.

This ADR creates no Product correctness, test-pass, CI, independent-approval, artifact or V5
claim.

## 5. Change-Impact Record

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
- Next gate: independent read-only architecture/authorization review, then focused ADO-only
  publication if `APPROVED`.
