# Development Assignment 3 — Correction and Append-only Audit Authorization

- Status: **COMPLETE FRESH HUMAN V5 PASSED; DA3-PHYS-01/02/03 PHYSICAL CLOSURE CANDIDATE; PUBLICATION/EXACT-HEAD CI/INDEPENDENT FINAL REVIEW PENDING; RETRY/NEW RUN UNAUTHORIZED**
- Date: 2026-07-21
- Accepted/authorized baseline commit: `ff68f7a7d0ce69a65e88846ae1cca9abd5951f5d`
- Accepted/authorized baseline tree: `09ef169a68bb53420e07b6f3fcbbdc74e0c01d57`
- Baseline remote: `main == origin/main`, zero ahead/behind at implementation start
- Parent state: DA1/DT-060–DT-062 and DA2/DT-063–DT-068 closed for their recorded local scopes;
  production, deployment, distribution and DA3 remain open
- Owner: Technical Lead
- Decision authority: Human Architect
- Accepted architecture:
  `ADO/01_Architecture/ADR/ADR-0014-append-only-time-record-correction-and-review-adjudication.md`
- Roadmap scope: Development Assignment 3; DT-069–DT-074 authorized local implementation scope,
  still open pending publication, exact-head CI, independent final review and closure
- Risk class: AVS-001 **R3**
- Implementation authority: **GRANTED FOR WORKSTREAMS A–D AND AVS V0–V4 ON THE EXACT BASELINE ABOVE**
- Explicitly excluded authority: **production, production data, deployment, distribution and Physical Gate**
- Independent pre-implementation review: **APPROVED FOR CANDIDATE PUBLICATION — ZERO OPEN P0/P1/P2/P3**
- Focused V5-enablement baseline: `0b0d04034c88829fdc5c548b057e74554d4ee197`, tree
  `eee26501fd714738aa3ca106d93d5088261206e3`
- Focused V5-enablement authority: **GRANTED FOR LOCAL HARNESS, RUNBOOK, DA3-V5-F01,
  REGRESSION TESTS, AVS V0–V4 AND INDEPENDENT REVIEW ONLY**
- Focused V5-enablement review: **APPROVED — ZERO OPEN P0/P1/P2/P3**
- First V5 physical-run authority: **GRANTED ONCE ON 2026-07-22 AND CONSUMED BY THE FAILED RUN**
- First V5 physical result: **FAILED CLOSED AT GATE A; ZERO SERVER LIFECYCLE MUTATION; GATES B/C NOT STARTED; COMPLETE CLEANUP**
- Replacement V5 physical-run authority: **GRANTED ONCE ON 2026-07-22 AND CONSUMED BY
  DA3-PHYS-02**
- Replacement V5 physical result: **FAILED CLOSED DURING SETUP; CLEAN REINSTALL/GATES A–C NOT
  STARTED; COMPLETE CLEANUP**
- Third V5 physical-run authority: **GRANTED ONCE ON 2026-07-22 AND CONSUMED BY THE
  2026-07-23 OPERATOR-CONTROL FAILURE**
- Third V5 physical result: **FAILED CLOSED BEFORE GATE B; DA3-PHYS-03 P1; COMPLETE CLEANUP**
- Current correction state: **PUBLISHED AS `9424a588`/TREE `f2d9a875`, EVIDENCE-SYNCED AS
  `e025a2f`/TREE `4485a43`; EXACT-HEAD RUNS `29985219725` AND `29985663622`, ATTEMPT 1, PASSED
  12/12; INDEPENDENT EXACT-DELTA RE-REVIEW APPROVED WITH ZERO OPEN P0–P3 REVIEW FINDINGS;
  ARCHIVE `8545e08`/TREE `3440e78`/RUN `29986601053` AND FINAL SYNC
  `f726e16`/TREE `6421aa5`/RUN `29986934600` PASSED 12/12 AND ARE HUMAN-ACCEPTED**
- Later complete fresh V5 authority: **SEPARATELY GRANTED ON THE FULL CHAIN THROUGH
  `d2dba78`/TREE `ea67729`/RUN `29987351521`, THEN CONSUMED**
- Later complete fresh V5 result: **GATES A–C PASSED; COMPLETE CLEANUP; PHYSICAL EVIDENCE
  PUBLICATION/CI/INDEPENDENT FINAL REVIEW PENDING**
- Current replacement-run authority: **NOT GRANTED**

## 1. Authorized objective

Deliver the smallest complete, trustworthy operator workflow that makes time correction and
ADR-0012 Human review adjudication usable without destroying automatic lifecycle history:

1. bounded Administrator overview of effective time records and review evidence;
2. mandatory-reason, append-only correction of stopped records;
3. mandatory-reason, append-only adjudication of server-side review evidence;
4. safe release of resolved server/Mobile review-predecessor state;
5. corrected effective truth in the existing CSV v1 export; and
6. a minimal Admin Web surface that reaches those capabilities and the existing export route.

The Human Architect accepted DA3-P01–DA3-P16 and separately authorized Workstreams A–D plus AVS
V0–V4 on the exact baseline above on 2026-07-21. On 2026-07-22 the Human Architect separately
authorized the focused local V5 enablement and DA3-V5-F01 correction on the later exact baseline
recorded above. Neither authority includes the Human Physical Gate itself, production, production
data, deployment or distribution.

## 2. Repository truth at the pre-implementation candidate baseline

### 2.1 Closed foundations to preserve

- B4/C1 resolve server authority from verified identity and exact current Membership.
- B6 owns online server-canonical lifecycle decisions and the byte-exact Organization/User advisory
  lock key.
- DA1 owns offline leases, encrypted FIFO evidence, synchronization, immutable reconciliations and
  durable `review_pending` results.
- DA1 intentionally leaves server and Mobile review-predecessor markers sticky until DA3.
- DA2 owns the isolated current-Administrator CSV export backend and exact CSV v1 dialect/limits.
- C3D supplies the current Admin Web authentication/session shell; DA3 extends it minimally and DA4
  remains the professional productization assignment.

### 2.2 Gaps DA3 must close

At the pre-implementation candidate checkpoint, the repository contained no:

- TimeEntry correction/revision table or effective projection;
- correction/adjudication role, pool, contract, coordinator or route;
- review-item Administrator projection;
- append-only Human review decision;
- proved server/Mobile predecessor-clear path;
- corrected/recovered record integration in export; or
- operator correction/review UI.

### 2.3 Existing constraints that shape the solution

- `time_entries` permits only one `started` to `stopped` update and has reverse traceability to
  CanonicalDecisions; DA3 cannot repurpose it for manual rows.
- `offline_event_reconciliations` rejects every UPDATE/DELETE.
- `has_offline_review_predecessor_v1` currently treats every historical `review_pending` row as
  permanently unresolved.
- `offline_sync_cursors.review_predecessor_sequence` and encrypted Mobile
  `review_pending_sequence` cannot currently clear.
- DA2 export currently reads raw `time_entries`; corrected truth therefore requires an explicit
  accepted amendment, not an invisible query change.
- existing server-side defer-only legacy WorkEvents have no device sequence and may not be
  retrofitted into offline-v2 evidence.

## 3. Proposed binding product and architecture contract

ADR-0014 DA3-P01 through DA3-P16 are incorporated by reference. They are individually material and
require explicit Human acceptance after independent review. In summary:

| ID | Proposed decision |
|---|---|
| DA3-P01 | Complete minimal operator workflow now; professional Admin Web remains DA4 |
| DA3-P02 | Exact current server-derived Administrator authority; exact self-only Mobile state exception |
| DA3-P03 | No mutation or retroactive automatic evaluation of original lifecycle/offline evidence |
| DA3-P04 | Stable logical time-record IDs and immutable contiguous revisions |
| DA3-P05 | Stopped-record-only correction; full start/stop replacement; no rounding/overlap engine |
| DA3-P06 | Mandatory verbatim 1–500-character Human reason |
| DA3-P07 | UUID command idempotency, request digest, expected versions and shared lifecycle lock |
| DA3-P08 | Bounded safe Administrator review-item projection |
| DA3-P09 | Append-only prefix adjudication; no-change, adjust-existing or recovered-closed-record outcome |
| DA3-P10 | Database-proved server predecessor clear and authenticated Mobile marker reconciliation |
| DA3-P11 | Legacy server evidence may be adjudicated; local-only evidence remains protected |
| DA3-P12 | CSV v1 shape unchanged; values come from one effective time-record snapshot |
| DA3-P13 | Distinct least-privilege read/write roles, function owners and runtime pools |
| DA3-P14 | Five strict routes plus minimal safe Admin Web workflow |
| DA3-P15 | Ledger-authoritative history plus one exact summary AuditEvent per successful command |
| DA3-P16 | No deletion/retention/legal/payroll/production claim |

## 4. Authorized implementation workstreams

Workstreams A–D are released only on the exact accepted baseline recorded above and remain bounded
by Sections 3, 8, 9 and 10.

### Workstream A — neutral contract and effective-record model

- add one neutral DA3 contract package with closed request/result unions, validation and golden
  vectors;
- define stable logical record, revision, review-item and adjudication types;
- define deterministic canonical request digests and strict reason/timestamp/UUID bounds;
- add migration `012` with append-only revision/adjudication/receipt tables and effective projection;
- keep migrations `001`–`011` byte-identical; and
- make the DA2 exporter consume only the minimum effective projection without gaining audit/reason
  access.

### Workstream B — least-privilege backend correction and review

- add isolated read/write roles, function owners and runtime pools;
- implement bounded overview and review-item queries;
- implement idempotent correction and exact-prefix adjudication transactions;
- share the byte-identical B6/DA1 Organization/User advisory lock;
- replace the predecessor predicate and implement database-proved cursor release without mutating
  reconciliations; and
- preserve generic disclosure-safe errors and connection retirement/context cleanup.

### Workstream C — API, minimal Admin Web and Mobile review truth

- add the five strict ADR-0014 routes with exact expected-Membership binding;
- extend the existing Admin Web shell with overview, correction, review and export-trigger surfaces;
- require visible before/after, explicit reason and final confirmation for writes;
- keep successful data out of stale sessions, URLs, logs and browser persistence;
- add the exact current-installation review-state reconciliation to Mobile; and
- clear only the encrypted status marker after exact authenticated server proof, never queue/evidence
  rows.

### Workstream D — synthetic operator journey and verification

- compose existing setup, lifecycle, offline, review, correction and export boundaries in a
  disposable PostgreSQL/synthetic journey;
- prove correction of a stopped canonical record and exact export overlay;
- prove one no-change adjudication, one recovered record and safe predecessor release;
- prove legacy server evidence remains non-canonical and local-only evidence remains protected;
- execute AVS V0–V4 and the failure/race matrix; and
- prepare V5 artifacts/runbook only if separately authorized after independent implementation
  approval.

## 5. Exact expected executable boundary

Expected changed areas after authorization:

- new ADR/authorization/contract/backend-review files;
- migration `012` and schema fixtures/verifiers;
- backend API types, routes, dependencies and runtime pool configuration;
- backend time-export query integration without CSV contract-shape changes;
- bounded Admin Web route/components/tests;
- narrow Mobile review-state reconciliation/store method/tests;
- synthetic integration and CI job/matrix updates if required; and
- truthful status, roadmap, risk and evidence synchronization.

Expected protected or unchanged behavior:

- Core BusinessEngine rules and automatic decision vocabulary;
- WorkEvent/CanonicalDecision/base TimeEntry historical rows;
- DA1 lease, HMAC, encrypted queue, persist-first FIFO and evidence immutability;
- NFC capture and C3 administration semantics;
- DA2 CSV dialect, columns, limits, formula protection and generation-audit meaning;
- production resources/data, deployment, distribution, signing and Store configuration; and
- legal/privacy/payroll/approval policy.

## 6. Change-Impact Record

### 6.1 Accepted architecture and authorized implementation baseline

- Baseline: `ff68f7a7d0ce69a65e88846ae1cca9abd5951f5d`, tree
  `09ef169a68bb53420e07b6f3fcbbdc74e0c01d57`.
- Accepted decisions: ADR-0014 and DA3-P01–DA3-P16.
- Authorized executable scope: Workstreams A–D and AVS V0–V4.
- Risk class: R3.
- Current verification: DA3 implementation AVS V0–V4 complete; implementation/evidence exact-head
  CI 12/12; independent exact-SHA review `APPROVED` with zero open P0–P3. Focused V5 product
  candidate `6eb68a3`, tree `bb8564f`, passed exact-head CI 12/12 and has a bound read-only
  synthetic APK. Evidence head `f4e2eeb`, tree `20e5715`, passed exact-head CI 12/12; independent
  V5 review returned `APPROVED` with zero open P0–P3. The physical run remains separately gated.
- Carried evidence: DA1/DA2 closure and their exact CI/review bindings remain evidence for their
  unchanged foundations; they are not DA3 correctness evidence.
- Excluded path: `research/` remains unread and untouched.

### 6.2 Implementation impact

DA3 crosses durable schema, RLS/roles, lifecycle concurrency, offline predecessor state, export,
Admin Web and Mobile status boundaries. Unknown impact expands verification. No performance or
contingent shortcut may narrow R3 gates.

## 7. Failure and race matrix

Implementation SHALL directly prove at least:

| Scenario | Required result |
|---|---|
| Missing/revoked/Employee/stale/cross-tenant authority | disclosure-safe denial; no rows/mutation |
| Active TimeEntry correction | not adjustable; no ledger/audit |
| Exact retry / changed-content retry | same result / conflict; never duplicate |
| Competing corrections | one revision winner; stale loser |
| Stop/correction races in both lock orders | deterministic complete old/new state |
| Correction/export races in both orders | one repeatable-read effective snapshot |
| Offline ingestion/adjudication races in both orders | no skipped predecessor or false clear |
| Non-prefix/out-of-order/mixed-user adjudication | complete rejection |
| Mixed offline-v2/legacy source-family adjudication | complete rejection |
| Recovered record with wrong tenant/target/evidence | complete rejection |
| Remaining unresolved row during cursor clear | database rejection |
| Stale/lost/malformed Mobile clear result | encrypted marker retained |
| Legacy server evidence adjudication | append-only Human result; no CanonicalDecision |
| Local-only legacy evidence | remains protected and undisclosed to browser |
| Audit/receipt/timeout/disconnect failure | rollback or durable idempotent committed result |
| Role/pool reuse | no actor/tenant/role/deadline leakage |
| Migration empty/replay/upgrade/rollback checks | ledger, ACL, policy and immutability exact |

## 8. Acceptance criteria

DA3 implementation may be technically approved only when:

1. independent pre-implementation review has zero unresolved P0–P3 findings — satisfied for the
   ADO-only candidate;
2. the Human Architect explicitly accepts DA3-P01–DA3-P16 on an exact published commit/tree;
3. a separate exact-baseline repository implementation authorization exists;
4. migrations `001`–`011` are byte-identical and migration `012` passes clean/replay/upgrade checks;
5. original lifecycle/offline evidence remains immutable;
6. correction is stopped-record-only, reason-required, idempotent and concurrency-safe;
7. supported review evidence receives exact append-only Human decisions and no automatic replay;
8. server/Mobile predecessor state clears only after exact proof;
9. effective overview and CSV return one coherent revision snapshot;
10. tenant/role/RLS/pool/function-owner boundaries fail closed under hostile tests;
11. the minimal Admin Web workflow is functional, accessible and session-safe;
12. all Workstreams A–D and AVS V0–V4 pass;
13. Technical-Lead diff/claim/security review is complete;
14. independent exact-SHA implementation review has zero unresolved P0–P3;
15. any required V5 Human functional gate is separately authorized and completed before closure;
16. DT-069–DT-074 close only for the exact evidenced local scope; and
17. no production, deployment, distribution, legal, payroll or DA4 productization claim is made.

## 9. Adaptive Verification Plan

### V0 — every change

- exact baseline/status/diff inventory excluding `research/`;
- changed-file and generated-artifact inventory;
- `git diff --check` and ADO link/reference checks;
- migrations `001`–`011` immutability digest; and
- claim-to-evidence/authority audit.

### V1 — focused implementation feedback

- contract validation/digest/golden vectors;
- focused migration role/RLS/immutability tests;
- coordinator/API idempotency, stale-version and error mapping;
- Admin Web correction/review state tests;
- Mobile exact-clear/retain tests; and
- tests-inclusive typechecks for every changed test boundary.

### V2 — affected-boundary verification

- complete schema, identity, lifecycle, offline, time-review, export, API, Admin Web and Mobile suites;
- direct PostgreSQL lock-order, hostile-role, rollback, idempotency and pool-reuse matrix;
- exact effective-view/export snapshot races;
- legacy/protected evidence tests;
- composed disposable operator journey; and
- all affected builds/bundles.

### V3 — final local candidate

- every locally executable workspace test;
- all applicable tests-inclusive typechecks and builds;
- migrations `001`–`012` clean/repeat/ledger/immutability verification on PostgreSQL 17;
- Admin Web production build and Android Expo export;
- dependency graph/audit with explicit existing advisory disposition;
- complete synthetic PostgreSQL journey and cleanup proof; and
- final diff, authority, security and documentation audit.

### V4 — exact-head publication gate

- focused committed product SHA/tree;
- complete GitHub Actions matrix on that exact head;
- independent exact-SHA implementation review; and
- fresh V3/V4 after every R3 correction.

### V5 — Human functional/physical gate

Focused local enablement preparation was separately authorized on `0b0d040`, including the harness,
runbook, DA3-V5-F01 correction, AVS V0–V4 and independent review. A later separate exact-bound Human
authorization released one physical run. That run failed closed at Gate A with `DA3-PHYS-01` (P1),
zero server lifecycle mutation and complete cleanup; Gates B/C did not start. The authority is
consumed. Any correction and replacement run require new review and Human authorization. V5 cannot
use production data or replace V2–V4.

## 10. Explicit non-goals

- implementation before the required review/Human/exact-baseline gates;
- active TimeEntry correction, void/delete, generic manual entry or bulk correction;
- automatic overlap, break, rounding, approval, payroll or billing rules;
- mutation or replay of WorkEvents, CanonicalDecisions or reconciliations;
- device-only legacy evidence extraction or deletion;
- CSV v2, scheduled/email export, analytics or server-side file retention;
- professional Admin Web/Mobile productization beyond the exact minimal DA3 workflow;
- production resources/data, deployment, distribution, signing, Store or Physical Gate;
- legal/privacy/retention approval; and
- access to `research/`.

## 11. Required release sequence and current gate

```text
Technical Lead ADO-only candidate
  -> exact candidate diff and V0
  -> independent pre-implementation review
  -> Technical Lead finding disposition and corrected re-review if needed
  -> focused candidate publication and exact-head CI
  -> explicit Human acceptance of DA3-P01–DA3-P16
  -> separate Human exact-baseline implementation authorization
  -> Workstreams A–D implementation
  -> AVS V1/V2/V3 and Technical-Lead approval
  -> focused implementation publication and V4
  -> independent exact-SHA implementation review
  -> corrections/re-review as required
  -> separately authorized V5 if required
  -> ADO-only exact-scope closure publication
```

No later arrow is implied by an earlier arrow.

The independent read-only review approved the ADO-only candidate for publication and reported zero
open P0/P1/P2/P3. The candidate was published as
`ff68f7a7d0ce69a65e88846ae1cca9abd5951f5d`, tree
`09ef169a68bb53420e07b6f3fcbbdc74e0c01d57`. The Human Architect then explicitly accepted
DA3-P01–DA3-P16 and separately authorized Workstreams A–D plus AVS V0–V4 on exactly that baseline.
The focused implementation is published at `0f71aca270969866037f2e31cc05ef8730e0ecd1`, tree
`e3e2ed780c217a520d382b98971991510bb99973`; exact-head GitHub Actions run `29859522776`, attempt
1, passed 12/12. Independent exact-SHA implementation review returned `APPROVED` with zero open
P0/P1/P2/P3. The reviewer recommended retaining V5. The Human Architect subsequently authorized
only its focused local enablement preparation on `0b0d040`, tree `eee2650`, and then separately
authorized DA3-V5-F01 on the same baseline. Product candidate `6eb68a3`, tree `bb8564f`, passed
exact-head run `29927309720` 12/12 and has a bound read-only synthetic APK. Independent exact-SHA
V5 review bound Evidence head `f4e2eeb`, tree `20e5715`, and run `29928717227` 12/12 and returned
`APPROVED` with zero open P0/P1/P2/P3. The Human Architect then authorized exactly one physical run
bound to Product `6eb68a3`, Evidence `f4e2eeb`, review publication `b142626`, their exact
CI/artifact bindings and the approved Galaxy-A33/two-NTAG213 set. That authority was consumed.
Prerequisite setup passed, but Gate A failed closed with `DA3-PHYS-01` (P1) when the same
installation switched from the Administrator setup owner to the Employee identity. Server
lifecycle and DA3 evidence counts remained zero; Gates B/C were not started and complete cleanup
passed. No correction or replacement run is authorized. Production, production data, deployment
and distribution remain **NOT AUTHORIZED**.

## 12. Independent pre-implementation review mandate

The independent reviewer must inspect the complete candidate delta against the exact baseline and at
minimum answer:

1. Does the proposal preserve immutable lifecycle/offline evidence and automatic engine authority?
2. Is the effective revision/recovered-record model internally coherent and tenant-safe?
3. Are stopped-only correction and future/overlap semantics explicit and professionally usable?
4. Can idempotency, expected versions or lock ordering lose/duplicate a correction?
5. Can any adjudication skip evidence, clear a predecessor falsely or reinterpret legacy evidence?
6. Is Mobile marker clearing exact, authenticated, fail-closed and evidence-preserving?
7. Does CSV v1 remain truthful and backward-compatible while using effective records?
8. Are read/write/export roles, pools, RLS and function-owner privileges least privilege?
9. Is the minimal Admin Web boundary enough for DA3 without swallowing DA4?
10. Are every material Human product decision and all non-goals explicit?
11. Is AVS R3 V0–V5 proportionate across schema/lifecycle/offline/export/Web/Mobile?
12. Are roadmap/status/authority claims accurate and is any P0/P1/P2/P3 finding open?

## 13. First V5 physical-run disposition — 2026-07-22

The exact first-run record is
`ADO/05_Evidence/Development_Assignment_03_Physical_Validation_Evidence.md`.
`DA3-PHYS-01` is P1 and remains open. The current architecture deliberately protects the encrypted
offline-store owner against silent cross-identity rebinding; the current V5 procedure nevertheless
requires Administrator setup followed by Employee Gate A on that same installation. Resolving the
mismatch requires a new Human decision and independent review. This document does not select an
operational reinstall correction or authorize a product identity-transition change.

Independent exact-delta review of failure-publication head
`a66788e880022d3da14aedddba7e373b73f55eb3`, tree
`55242152c996a0d1ef6f695b99452d43d5356a40`, and exact-head run `29933136031` returned
`APPROVED FOR FAILURE SYNCHRONIZATION` with zero P0–P3 findings against the synchronization. That
review confirms the diagnosis and correction decision boundary but grants neither correction nor
replacement-run authority. `DA3-PHYS-01` remains P1 open.

## 14. DA3-PHYS-01 correction decision and exact authority — 2026-07-22

On exact failure-review publication baseline
`f0c9db3d2fc8ed5fae3d54f147a696c56a79aec3`, tree
`27cabe61e25a77fe73427aded735dfb4e59cbe01`, the Human Architect selected the operational clean
exact-artifact reinstall boundary after Administrator setup and authorized its focused
implementation, Runbook/Evidence, AVS V0–V4 and independent review. The Physical Gate remained
separately unauthorized.

The authorized correction scope is only:

- retain the real Administrator-created synthetic server prerequisites;
- sign out, remove only the two owned reverse mappings and uninstall only
  `com.tim180201.mobile.synthetic`;
- prove zero package/mapping state;
- reinstall the same hash/signature/runtime-verified immutable APK without rebuilding it;
- prove unchanged safe server aggregates and zero lifecycle/DA3 evidence before Employee Gate A;
- preserve every permanent single-owner, logout, encryption, backup and fail-closed product rule;
- run AVS V0–V4 and obtain an independent exact-delta review.

No product identity-transition implementation, source/schema/dependency/workflow change, ADB run,
installation, replacement Physical Gate, production resource/data, deployment or distribution is
authorized by this correction task. A later physical run requires its own exact-bound Human
authorization after independent correction approval.

The focused ADO-only correction was published as `f7a2b1e`, tree `a8caed6`, after local AVS
V0–V3. Exact-head run `29935693909`, attempt 1, passed 12/12 and completed V4. Independent
exact-delta review returned `APPROVED FOR DA3-PHYS-01 OPERATIONAL CORRECTION` with zero P0–P3
findings. The correction is technically accepted as the reviewed procedural basis for a later
fresh run; no replacement-run authority exists.

## 15. DA3-PHYS-01 independent correction disposition — 2026-07-22

The independent reviewer bound correction `f7a2b1e`/tree `a8caed6`, Evidence sync
`1ed3263`/tree `dc26ae7`, their exact ADO-only deltas, exact-head 12/12 CI, the complete predecessor
chain and unchanged immutable APK/manifest. The reviewer independently confirmed the fail-closed
single-owner behavior and the scoped disconnect, exact-package uninstall/zero proof, same-artifact
clean reinstall, unchanged-server-state, Employee-only authentication, abort/cleanup and disclosure
boundaries. Verdict: `APPROVED FOR DA3-PHYS-01 OPERATIONAL CORRECTION`; P0–P3: zero.

This disposition completes the independent review authorized for the operational correction. It
authorizes no ADB, install/uninstall, device interaction or Physical Gate and does not close
`DA3-PHYS-01`, DA3 or DT-069–DT-074. At this correction-review checkpoint, any replacement run
required a new separate Human authorization bound to the final review-publication commit/tree/CI,
exact artifact, approved device, both tags, both installations and the interim package-only
uninstall. Section 16 records the later consumed replacement-run authority and failure.

## 16. Replacement-run failure and consumed authority — 2026-07-22

The Human Architect issued one complete fresh replacement-run authorization bound to Product
`6eb68a3`, V5 Evidence `f4e2eeb`, review publication `b142626`, operational correction `f7a2b1e`,
correction sync `1ed3263`, independent-correction-review publication `b8f1eb7`, their exact trees
and six 12/12 CI runs, the immutable APK and approved device/tag set. Exact preflight and initial
installation passed.

The run failed closed during prerequisite setup before Tag B, Section 4.1 or Gates A–C. Fresh
harness startup already provided two seeded Customers; following Runbook Section 4 step 7 literally
created two more. Those Customer writes appended two administration receipts/AuditEvents. After
one correct Tag-A assignment, sanitized status was four Customers, one Tag/Assignment, three
administration receipts, four AuditEvents and zero lifecycle/DA3 rows. The step-8 requirement of
exactly two receipts/four setup audits after two Tag assignments was already unreachable.

`DA3-PHYS-02` is P1 open against this deterministic procedure/baseline contradiction.
`DA3-PHYS-01` also remains open because its reviewed clean-reinstall boundary was not reached.
Scoped cleanup and final package/mapping/listener/schema/ledger/runtime-role zero checks passed.
The replacement-run authority is consumed. This record authorizes no wording correction, retry,
new run, production resource/data, deployment or distribution. A focused ADO-only correction,
independent review and new exact-bound Human authorization are mandatory before another run.

## 17. DA3-PHYS-02 review acceptance and focused correction authority — 2026-07-22

Independent read-only review of exact failure synchronization `abd58be3`, tree `b2cb210`, parent
`b8f1eb7`, its 11-file `+302/-47` R0 delta and exact-head run `29939539390` 12/12 returned
`APPROVED FOR FAILURE SYNCHRONIZATION AND DA3-PHYS-02 CORRECTION CANDIDATE` with zero open P0–P3.
The reviewer independently verified the seeded two-Customer baseline, receipt/audit arithmetic,
deterministic step-7/step-8 contradiction, P1 severity, stop point, zero lifecycle/DA3 mutation,
cleanup/disclosure and narrow correction boundary.

The Human Architect explicitly accepted that review on `abd58be3`/tree `b2cb210`/run
`29939539390` and authorized only:

- focused ADO-only correction of Runbook Section 4 step 7;
- use of exactly `Synthetic Android Customer` and `Synthetic Reassignment Target`;
- prohibition of any additional Customer creation during the V5 run;
- retention of step 8's exact two-administration-receipt/four-setup-AuditEvent invariant;
- archival of the independent review and necessary ADO truth synchronization;
- AVS R0/V0, focused publication, exact-head CI and independent exact-delta re-review.

Runbook step 7 now implements exactly that boundary. Focused correction publication
`4d54dc2981759498de94571e2b2a4c6f134c88d5`, tree
`ad9b6ba661dae7572a8b825fe1ceadac8c108b79`, parent `abd58be3`, contains exactly 12 ADO Markdown
files (`+309/-52`) and passed exact-head run `29941019865`, attempt 1, 12/12. No product code,
schema, dependency, APK, retry, Physical Gate, production resource/data, deployment or distribution
is authorized. `DA3-PHYS-01`, `DA3-PHYS-02`, DA3 and DT-069–DT-074 remain open. A later new run
requires independent exact-delta re-review and a new separate exact-bound Human authorization.

## 18. DA3-PHYS-02 correction independent exact-delta re-review — 2026-07-22

Independent read-only re-review bound baseline `abd58be3`/tree `b2cb210`, correction
`4d54dc2`/tree `ad9b6ba`, Evidence sync `53ec139`/tree `9963960`, their exact parent chain,
combined 12-ADO-file `+326/-51` delta and exact-head runs `29941019865` plus `29941415806`, both
12/12. The reviewer independently confirmed the seed names, no-additional-Customer rule, exact
Tag-to-seed mapping, unchanged step-8 two-receipt/four-audit invariant, cross-document truth,
R0/V0, disclosure boundary and unchanged APK.

Verdict: `APPROVED FOR DA3-PHYS-02 ADO CORRECTION`; no open P0–P3 review findings. Archived report:
`ADO/05_Evidence/Development_Assignment_03_DA3_PHYS_02_Correction_Independent_Exact_Delta_Review.md`.

Review archival publication `030dbf6f44a7f6c03adc089b1a2f8dae73c114eb`, tree
`8695708f82ed98a068338ac33029151ee349f1d6`, parent `53ec139`, contains exactly 12 ADO Markdown
files (`+248/-21`) and passed exact-head run `29942397982`, attempt 1, 12/12.

This review and publication create no execution authority. `DA3-PHYS-01`, `DA3-PHYS-02`, DA3 and
DT-069–DT-074 remain open. At that publication checkpoint, explicit Human acceptance and a new
separate exact-bound authorization were required before any further V5 run. Retry, Physical Gate,
product code, schema, dependency, APK change, production resource/data, deployment and
distribution remained unauthorized. Section 19 records the later acceptance without execution
authority.

## 19. Human acceptance of the DA3-PHYS-02 correction review — 2026-07-22

The Human Architect accepted the independent correction review archived at
`030dbf6f44a7f6c03adc089b1a2f8dae73c114eb`, tree
`8695708f82ed98a068338ac33029151ee349f1d6`, exact-head run `29942397982`, attempt 1, 12/12, and
the final Evidence sync `22ee4636b1fec83b0693fdb6f688d3191cfa04ee`, tree
`3d70d5dd4d2cb5257fbcf3374d82485981f8f763`, exact-head run `29942786556`, attempt 1, 12/12, as
the binding review basis.

This acceptance satisfies only the outstanding Human review-acceptance gate. The Human Architect
explicitly did **not** authorize a Physical Gate. No run, installation, uninstall, ADB/loopback,
device or Tag interaction, retry, repair, resume, product/schema/dependency/APK change, production
resource/data, deployment or distribution is authorized. `DA3-PHYS-01`, `DA3-PHYS-02`, DA3 and
DT-069–DT-074 remain open. Any later complete fresh V5 run requires a new, separate, exact-bound
Human authorization.

## 20. Third V5 run authority and consumed operator-control failure — 2026-07-22/23

The Human Architect separately authorized one complete fresh V5 run after publication
`acf79ab257df6769d12bd489e27f721a0ae2d354`, tree
`f80bec9a1de0a6106f7bf71b181f6930ffa5450a`, and exact-head run `29946654825`, attempt 1, 12/12.
The authorization bound the complete previously approved Product/Evidence/correction/review chain,
the unchanged read-only APK/manifest, Galaxy A33/Android 15, both approved tags, both installs,
scoped disconnect/uninstall, Gates A–C, disclosure-safe evidence and mandatory cleanup. Any failed,
interrupted or ambiguous run consumed the authority; retry, repair and resume were excluded.

The run passed exact preflight, seed-only Tag-A/Tag-B setup with two receipts/four audits, the
reviewed clean exact-artifact reinstall boundary and real Gate-A Start/Stop, correction and export
generation. It nevertheless failed closed before Gate B:

1. the Technical Lead instructed the Human not to open the CSV, so the mandatory CSV-v1 column,
   formula-safety and effective-timestamp assertions were not performed; and
2. after Mobile sign-out, the Technical Lead injected a mutable clipboard value without first
   binding it to the running harness password. Exact post-failure SHA-256 comparison returned
   mismatch even though the fixed Employee email and clipboard-value field length were correct.

No Gate-B tag was presented and Gate C did not start. The final disclosure-safe state contained
two setup receipts, eight AuditEvents, two WorkEvents/Decisions/sync receipts, one stopped
TimeEntry, one append-only revision/correction receipt and one export audit. No review
adjudication/cursor existed. Mandatory cleanup removed the generated CSV, clipboard value, app,
reverse mappings, listeners, schema, migration ledger, generated roles and temporary worktree.

`DA3-PHYS-03` is P1 open against operator-control/evidence execution; it is not a Product-code
finding. Failed-run observations cannot close `DA3-PHYS-01` or `DA3-PHYS-02`. During repository
cleanup the Technical Lead also issued one prohibited path-scoped `git status -- research` probe.
It emitted no protected filename/content and changed nothing, but the boundary violation is part
of the review record.

This synchronization proposes, but does not authorize, the narrow next correction boundary:

- preserve every existing runbook/product/security rule;
- make every mandatory CSV assertion an explicit recorded stop point before advancement/deletion;
- bind the memory-only synthetic password to a disclosure-safe digest at harness start and compare
  it before every injection;
- enter fixed non-secret synthetic emails without touching the credential clipboard; and
- fail before authentication on any credential-source mismatch.

At that checkpoint, independent read-only review still had to validate the failure truth, severity
and candidate boundary. This failure record itself authorized no runbook correction,
product/schema/dependency/APK change, retry/new run, production resource/data, deployment or
distribution. Section 21 records the later review and focused correction authority.

## 21. DA3-PHYS-03 review acceptance and focused ADO-only authority — 2026-07-23

Independent read-only review archived at
`ADO/05_Evidence/Development_Assignment_03_DA3_PHYS_03_Operator_Control_Independent_Review.md`
bound failure synchronization `a8b18d6fd3b6a36c81a49111fd0e48cdf4e54c8f`, tree
`dae80d85bd2d0cacfa77382b5a131888020301b7`, parent
`acf79ab257df6769d12bd489e27f721a0ae2d354`, its exact 11-file `+452/-38` ADO-only delta and
exact-head run `29984028528`, attempt 1, 12/12. It independently confirmed the failure truth,
P1 operator-control classification, complete cleanup/disclosure, protected-path deviation, R0/V0
and narrow candidate. Verdict:
`APPROVED FOR FAILURE SYNCHRONIZATION AND DA3-PHYS-03 OPERATOR-CONTROL CORRECTION CANDIDATE`;
zero open P0–P3 review findings.

The Human Architect accepted that exact review basis and authorized only the focused ADO-only
correction now present in the runbook:

1. each CSV-v1, formula-safety, exactly-once and effective-timestamp proof is an explicit stop point
   before progress or deletion;
2. the memory-only synthetic password is bound at harness start to a SHA-256 digest held only in
   live operator-session state;
3. every password injection requires a successful digest comparison whose only output is
   `match/mismatch`;
4. fixed non-secret synthetic emails never mutate the credential clipboard;
5. mismatch, missing binding or ambiguity fails before authentication; and
6. every worktree check explicitly excludes `research/` by pathspec.

Review archival, necessary ADO status/Evidence/Decision/Risk synchronization, AVS R0/V0, focused
publication, exact-head CI and independent exact-delta re-review are authorized. Product code,
schema, dependencies, workflow, helper and APK changes are not authorized or present. Retry,
repair, resume, Physical Gate, installation/ADB, production, production data, deployment and
distribution remain unauthorized. `DA3-PHYS-01`, `DA3-PHYS-02`, `DA3-PHYS-03`, DA3 and
DT-069–DT-074 remain open.

## 22. DA3-PHYS-03 correction publication and exact-head CI — 2026-07-23

The Technical Lead approved and published the exact 12-ADO-Markdown-file `+465/-59` correction
delta as `9424a588683fc78cae1d47861366eff25d501952`, tree
`f2d9a8755be7b5ee021873a5fff6c3f5d5db8b32`, parent
`a8b18d6fd3b6a36c81a49111fd0e48cdf4e54c8f`. AVS R0/V0 passed exact scope, zero unstaged tracked
delta, whitespace, reference, status/authority, disclosure and required-control checks. V1–V3
were omitted because no executable input changed.

Exact-head GitHub Actions run `29985219725`, push, attempt 1, completed successfully with all 12
jobs on that commit. No Product code, schema, migration, dependency, lockfile, workflow, helper,
harness, configuration or APK changed. Independent exact-delta re-review of the complete
correction-plus-Evidence-sync range remains mandatory.

This publication creates no retry, repair, resume, Physical Gate, installation/ADB, production,
production-data, deployment or distribution authority. All three DA3 physical P1 findings, DA3
and DT-069–DT-074 remain open.

## 23. DA3-PHYS-03 correction independent exact-delta re-review — 2026-07-23

Independent read-only re-review bound failure synchronization
`a8b18d6fd3b6a36c81a49111fd0e48cdf4e54c8f`, correction
`9424a588683fc78cae1d47861366eff25d501952` and Evidence sync
`e025a2f860e21f968439a239525c55f63bd258a5`. It reproduced the exact 12-file `+465/-59`,
12-file `+139/-25` and combined 12-file `+579/-59` ADO-only deltas, exact-head 12/12 runs
`29984028528`, `29985219725` and `29985663622`, all carried bindings, the immutable artifact and
every authorized operator control.

The verdict is `APPROVED FOR DA3-PHYS-03 ADO OPERATOR-CONTROL CORRECTION` with zero open
P0/P1/P2/P3 review findings. Review archival/publication and its exact-head CI remain the current
authorized work. The review closes no physical finding and grants no retry, repair, resume,
Physical Gate, installation/ADB, production, production-data, deployment or distribution
authority. Only later separate Human acceptance plus a new exact-bound complete-run authorization
could reopen the Physical Gate at that review checkpoint; Section 24 records the later acceptance
without execution authority.

Review archive `8545e08cd118f85c0c9defccea0fac0961e9a72e`, tree
`3440e78f379974ebf1f48ca76ad1d923ed9aeb76`, exact parent
`e025a2f860e21f968439a239525c55f63bd258a5`, contains exactly 12 ADO Markdown files and
`+283/-32`. AVS R0/V0 passed; V1–V3 were inapplicable. Exact-head run `29986601053`, push,
attempt 1, passed 12/12. At that checkpoint, Human acceptance and any new exact-bound complete-run
authorization remained separate and pending. Section 24 records the later acceptance without
execution authority.

## 24. Human acceptance of the DA3-PHYS-03 correction review — 2026-07-23

The Human Architect accepted the independent correction review archived at
`8545e08cd118f85c0c9defccea0fac0961e9a72e`, tree
`3440e78f379974ebf1f48ca76ad1d923ed9aeb76`, exact-head run `29986601053`, attempt 1, 12/12, and
the final Evidence sync `f726e169e00d205bfc36ee9b12673e0c70aae235`, tree
`6421aa5974f5168ce6f2631f0a56fe9f7cd6f151`, exact-head run `29986934600`, attempt 1, 12/12, as
the binding review basis.

This acceptance satisfies only the outstanding Human review-acceptance gate. The Human Architect
explicitly did **not** authorize a Physical Gate. No run, installation/uninstall, ADB/loopback,
device or Tag interaction, retry, repair, resume, Product/schema/dependency/workflow/helper/APK
change, production resource/data, deployment or distribution is authorized. `DA3-PHYS-01/02/03`,
DA3 and DT-069–DT-074 remain open. Any later complete fresh V5 requires a new, separate,
exact-bound Human authorization.

## 25. Later complete fresh V5 result — 2026-07-23

After publication `d2dba78344bf5b8234d62a905d69de315d5d4e4c`, tree
`ea6772944c3fd71c1e0f1d40d71a04e441b449fd`, passed exact-head run `29987351521`, attempt 1,
12/12, the Human Architect separately issued a new one-time complete fresh V5 authority on the
unchanged full predecessor chain, immutable APK/manifest, Galaxy A33/Android 15 and two synthetic
NTAG213 Tags.

The final fresh run passed seed-only setup, the reviewed clean exact-artifact reinstall boundary,
Gate A correction/effective CSV including all four mandatory content stop points, Gate B ordered
offline cutover/review-predecessor behavior, Gate C ordered partial/complete adjudication and
exact Mobile marker retention/clear across cold relaunch. The original six offline reconciliation
rows remained unchanged. Both sessions signed out and cleanup proved zero package, approved
mappings/listeners, disposable database/schema/ledger, generated roles, credential clipboard and
task-created worktree.

The Human confirmed every required physical UI observation and directed formal synchronization
after the Technical Lead's complete pass/cleanup report. `DA3-PHYS-01/02/03` are physical-closure
candidates. DA3 and DT-069–DT-074 remain open pending focused ADO publication, exact-head CI and
independent final review. The one-time authority is consumed; no retry, repair, resume or new run
is authorized. Production, production data, deployment and distribution remain unauthorized.
