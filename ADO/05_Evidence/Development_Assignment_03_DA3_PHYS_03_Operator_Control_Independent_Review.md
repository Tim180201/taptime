# Development Assignment 3 — DA3-PHYS-03 Operator-Control Independent Review

- Status: **APPROVED FOR FAILURE SYNCHRONIZATION AND DA3-PHYS-03 OPERATOR-CONTROL
  CORRECTION CANDIDATE — ZERO OPEN P0–P3 REVIEW FINDINGS**
- Review date: 2026-07-23
- Review mode: independent read-only exact-delta review
- Baseline commit/tree: `acf79ab257df6769d12bd489e27f721a0ae2d354`,
  `f80bec9a1de0a6106f7bf71b181f6930ffa5450a`
- Reviewed commit/tree: `a8b18d6fd3b6a36c81a49111fd0e48cdf4e54c8f`,
  `dae80d85bd2d0cacfa77382b5a131888020301b7`
- Reviewed exact-head CI: GitHub Actions run `29984028528`, attempt 1, **12/12 successful**
- Reviewer authority: read-only; no correction, repository mutation, Physical Gate or production
  authority

## 1. Verdict

**APPROVED FOR FAILURE SYNCHRONIZATION AND DA3-PHYS-03 OPERATOR-CONTROL CORRECTION CANDIDATE**

There are no open P0, P1, P2 or P3 review findings against the failure synchronization or proposed
correction boundary. `DA3-PHYS-01`, `DA3-PHYS-02` and `DA3-PHYS-03` remain open operational P1
findings and are not findings against the reviewed documentation delta.

## 2. Exact bindings and delta

The reviewer independently confirmed:

- reviewed commit `a8b18d6fd3b6a36c81a49111fd0e48cdf4e54c8f`, tree
  `dae80d85bd2d0cacfa77382b5a131888020301b7`, exact parent
  `acf79ab257df6769d12bd489e27f721a0ae2d354`;
- `main == origin/main == a8b18d6...` and a clean tracked worktree with only pre-existing
  untracked `app.json` outside the protected path;
- exact delta `acf79ab..a8b18d6`: 11 named tracked `ADO/*.md` files, `+452/-38`, no executable
  file and clean `git diff --check`;
- exact-head run `29984028528`, push, attempt 1, 12/12, exact reviewed head;
- all 12 commit/tree/parent bindings in Physical Evidence Section 18 and all 12 associated
  exact-head runs, each attempt 1 and 12/12; and
- no Product, schema, dependency, workflow, script, helper or artifact change since the carried
  executable baseline.

The unchanged artifact was independently recomputed:

- APK 95,437,611 bytes, mode `0444`, SHA-256
  `215b4c924f0b770248a36d188f341efe62278527e1cad1af6cc1babdcc1f39b1`;
- manifest 2,206 bytes, mode `0444`, SHA-256
  `07f0e5a116e76ddd9c17dcf66aa5bf5f4fbf0e1fbd4e152db13a8065b4b747d6`.

## 3. Failure truth

The failure record is complete and internally consistent:

1. exact preflight, seed-only setup, two Tags/Assignments, two setup receipts and four setup
   AuditEvents completed;
2. the clean exact-artifact reinstall boundary reached the normal Employee surface without
   `protected_pending`;
3. physical Start/Stop, append-only correction and export generation reached the documented safe
   aggregate;
4. the final eight AuditEvents reconcile exactly as four setup, two lifecycle, one correction and
   one export audit;
5. one revision, one correction receipt and one export audit existed; adjudications and review
   cursors remained zero;
6. the 523-byte CSV was hashed but its required CSV-v1, formula-safety, exactly-once and effective-
   timestamp assertions were not performed;
7. the later Employee sign-in used a mutable clipboard value without harness-password binding;
   disclosure-safe comparison proved `clipboard_vs_harness=mismatch`;
8. no Gate-B Tag was presented and Gate C did not start; and
9. the complete run is failed, consumed and supplies no reusable partial observation.

The earlier field-length claim was correctly withdrawn. The two preparation-only Node/build-order
failures are transparently separated from the counted physical run.

## 4. Classification and candidate assessment

`DA3-PHYS-03` severity **P1 is appropriate**:

- it is not P0 because there was no disclosure or unauthorized mutation and authentication failed
  closed on the wrong value;
- it is P1 because Gate A lacked mandatory CSV-content proof and the entire once-authorized run was
  blocked and consumed; and
- it is correctly classified as operator-control/evidence execution, not Product, schema, APK,
  authentication or server-canonical failure.

Runbook Section 5 step 5 was already unambiguous: it requires the canonical columns, formula-safe
dialect and corrected effective timestamps exactly once while prohibiting only recording an
internal ID or CSV body. The omission was therefore an operator failure, not a pre-existing
Repository defect.

The proposed correction boundary is narrow and sufficient:

- every required CSV assertion becomes an explicit stop point before progression or deletion;
- a SHA-256 digest binds the high-entropy per-run memory-only password before every injection;
- digest comparison detects a wrong value even when its length matches;
- fixed non-secret emails do not touch the credential clipboard; and
- any mismatch fails before authentication.

For the normative wording, the reviewer recommends explicitly stating that comparison output is
limited to `match/mismatch` and where the digest is held. This is a refinement, not a finding.

## 5. Cleanup, disclosure and protected-path deviation

Cleanup evidence is complete: CSV and clipboard cleared, Web/harness stopped, package and approved
mappings zero, four listeners zero, schema/ledger/generated roles zero and detached worktree
removed. The initial disconnect invocation with no attached device was a cleanup condition; the
mandatory cleanup completion after reconnect was not a Gate retry.

Disclosure remained safe. Only aggregate counts, hashes, approved fingerprints and safe status
values were recorded. No password value was output or persisted.

The Technical Lead's one path-scoped `git status -- research` probe is sufficiently visible and
accurately bounded: no protected contained filename/content was emitted and no state changed, but
the explicit protected-path rule was violated. Its disposition as a documented governance
deviation without another P-number is appropriate. The reviewer recommends, without opening a
finding, norming `git status -- . ':!research'` as the standard runbook worktree check.

The reviewer did not access `research/`.

## 6. AVS assessment

- Risk class R0: independently confirmed for the reviewed repository delta.
- V0: diff, scope, whitespace, references, bindings, artifact, remote and tracked-state claims
  reproduced.
- V1/V2/V3: correctly omitted because no executable input changed.
- V4: run `29984028528`, attempt 1, exact head, 12/12.
- V5: failed closed; no observation is reusable.

Carried Product, enablement, correction, CI and artifact evidence is accurately distinguished from
freshly reproduced review evidence.

## 7. Remaining risks and authority

`DA3-PHYS-01`, `DA3-PHYS-02`, `DA3-PHYS-03`, DA3 and DT-069–DT-074 remain open. The debug signer
remains unsuitable for distribution and the existing moderate toolchain advisories remain
separately disclosed.

This review authorizes neither correction implementation nor retry, repair, resume, a new Physical
Gate, installation/ADB, production, production data, deployment or distribution. A positive
verdict permits only later Human consideration of the proposed correction.

## 8. Subsequent Human acceptance and focused correction authority

The Human Architect subsequently accepted this review on exact reviewed commit
`a8b18d6fd3b6a36c81a49111fd0e48cdf4e54c8f`, tree
`dae80d85bd2d0cacfa77382b5a131888020301b7`, exact-head run `29984028528`, attempt 1, 12/12, as the
binding review basis.

The Human Architect separately authorized only the focused ADO-only operator-control correction:
explicit CSV proof stop points, a memory-only session-held SHA-256 password digest, comparison
before every injection with output limited to `match/mismatch`, non-secret email entry without
credential-clipboard mutation, fail-before-authentication on mismatch and mandatory
`research/`-excluding worktree pathspec. Review archival, necessary ADO truth synchronization, AVS
R0/V0, focused publication, exact-head CI and independent exact-delta re-review are also
authorized.

Product code, schema, dependencies, workflow, helper, APK, retry, repair, resume, Physical Gate,
production, production data, deployment and distribution remain unauthorized.

## 9. Subsequent correction publication

The Human-authorized correction and this review archive were subsequently published as
`9424a588683fc78cae1d47861366eff25d501952`, tree
`f2d9a8755be7b5ee021873a5fff6c3f5d5db8b32`, exact parent
`a8b18d6fd3b6a36c81a49111fd0e48cdf4e54c8f`, with exactly 12 ADO Markdown files and
`+465/-59`. Local R0/V0 passed; V1–V3 were inapplicable. Exact-head run `29985219725`, push,
attempt 1, passed 12/12.

This subsequent record does not modify the independent verdict above. Independent exact-delta
re-review of the published correction and Evidence sync remains mandatory. No new operational or
Physical authority follows.
