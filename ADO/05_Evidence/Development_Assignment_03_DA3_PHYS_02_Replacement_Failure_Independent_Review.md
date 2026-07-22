# Development Assignment 3 — DA3-PHYS-02 Replacement-Failure Independent Review

- Status: **APPROVED FOR FAILURE SYNCHRONIZATION AND DA3-PHYS-02 CORRECTION CANDIDATE**
- Date: 2026-07-22
- Role: Independent read-only Review Agent
- Reviewed baseline commit/tree: `b8f1eb7262258a4242a4c8268969c92a05d20c55`,
  `71966b09f266c0cb3c1bba1eb0f71e97c1e8ea5b`
- Reviewed failure-synchronization commit/tree:
  `abd58be3a6231fd7d3e298f2ec111677b53de8a0`,
  `b2cb2109777b223794a3808bc0e821a459a5d3b8`
- Reviewed exact-head CI: GitHub Actions run `29939539390`, attempt 1, 12/12 successful
- Verdict: **APPROVED FOR FAILURE SYNCHRONIZATION AND DA3-PHYS-02 CORRECTION CANDIDATE**
- Open findings: **none at P0, P1, P2 or P3 against the reviewed synchronization/candidate**

## 1. Scope and independence

The reviewer worked read-only, left the repository unchanged and reviewed the exact 11-file
Markdown-only delta `b8f1eb7..abd58be` (`+302/-47`). The review authorized no document change,
retry, Physical Gate, production resource/data, deployment or distribution action.

## 2. Exact binding verification

The reviewer independently confirmed:

- exact parent, candidate commits and trees;
- `main == origin/main == abd58be...` with a tracked-clean worktree;
- only the pre-existing user-owned untracked paths `app.json` and `research/`, without content
  access;
- AVS R0: exactly 11 changed `ADO/` Markdown files and no source, schema, dependency, lockfile,
  workflow, script, configuration or artifact change;
- `git diff --check` clean;
- run `29939539390` on exact candidate head and predecessor run `29937437746` on exact baseline,
  both attempt 1 and 12/12 successful;
- the five earlier Product/Evidence/review/correction CI bindings and their commit chain; and
- the unchanged 95,437,611-byte mode-`0444` synthetic APK with SHA-256
  `215b4c924f0b770248a36d188f341efe62278527e1cad1af6cc1babdcc1f39b1` and package
  `com.tim180201.mobile.synthetic`.

## 3. Independent technical verification

The real harness baseline inserts exactly two Customers, `Synthetic Android Customer` and
`Synthetic Reassignment Target`, through its installer path. That seed path creates zero
administration command receipts and zero AuditEvents.

The normal Administrator Customer-write path creates one Customer, one administration receipt and
one `CustomerCreated` AuditEvent. Normal Tag provisioning creates one administration receipt plus
the two setup AuditEvents `NfcTagRegistered` and `NfcTagAssigned`. The replacement-run observation
therefore reconciles exactly: two additional Customer writes plus one Tag provision produce three
receipts and four AuditEvents. Two Tag provisions without additional Customer writes produce the
required two receipts and four AuditEvents.

Runbook Section 4 step 7 required two Customer creations while step 8 required the exact
two-receipt/four-audit aggregate. On the seeded baseline those requirements were mutually
exclusive. The contradiction was deterministic and not observer-dependent. The APK, product
behavior and the DA3-PHYS-01 clean-reinstall correction did not fail.

## 4. Finding disposition

**No open P0–P3 findings.**

Transparent non-finding observations from the reviewer:

- the step-7/step-8 contradiction had passed multiple earlier independent reviews, including two
  reviews in the same chain; this is context about procedural-review depth, not a finding against
  the synchronization that exposed it; and
- failure synchronization `abd58be3` correctly did not modify steps 7/8 before correction
  authority existed and labelled the wording only as a non-implemented candidate.

The reviewer accepted P1 severity for `DA3-PHYS-02`: the procedure cannot complete its mandatory
setup and therefore blocks V5 and DA3/DT-069–DT-074 closure, while fail-closed behavior, zero
lifecycle/DA3 mutation and absence of disclosure exclude P0.

The stop occurred correctly after Tag A made the final aggregate provably unreachable and before
Tag B, the clean exact-artifact reinstall boundary or Gates A–C. No failed observation is reused.
Cleanup and disclosure evidence were accepted as truthful, including explicit Mobile sign-out,
memory-only Admin-Web session disposal after the tab had closed, both clipboard clears, scoped
disconnect, exact-package uninstall and listener/schema/ledger/runtime-role/connection zero proof.

`DA3-PHYS-01` remains open because its corrected reinstall boundary was never reached.

## 5. Approved correction candidate

The independently approved correction candidate is deliberately ADO-only and exact:

1. use the two Customers already seeded by the fresh harness;
2. prohibit additional Customer creation during this V5 run;
3. assign Tag A to `Synthetic Android Customer` and Tag B to
   `Synthetic Reassignment Target`; and
4. retain the exact requirement of two administration receipts and four setup AuditEvents.

The reviewer confirmed that the two seeded Customers also satisfy Gate B's reassignment need. No
code, harness, schema, product rule or artifact change is required by this candidate.

## 6. Verdict and authority boundary

**APPROVED FOR FAILURE SYNCHRONIZATION AND DA3-PHYS-02 CORRECTION CANDIDATE**

`DA3-PHYS-01`, `DA3-PHYS-02`, DA3 and DT-069–DT-074 remain open. The review does not authorize a
document change, retry or Physical Gate and does not revive consumed authority. Before any new run,
the focused ADO-only correction requires explicit Human authorization, publication with exact-head
CI, independent exact-delta re-review and a new separate Human authorization bound to the final
commits/trees/CI, immutable artifact, approved device/tags, both installations and the interim
package-only uninstall. Production, production data, deployment and distribution remain
unauthorized.
