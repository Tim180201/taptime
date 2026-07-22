# Development Assignment 3 — Correction and Append-only Audit Authorization

- Status: **IMPLEMENTATION/V5 ENABLEMENT INDEPENDENTLY APPROVED; FIRST AUTHORIZED PHYSICAL RUN FAILED CLOSED; DA3-PHYS-01 P1 OPEN**
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
  still open pending separate Physical Gate authorization/execution, disposition and closure
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
- Current correction/replacement-run authority: **NOT GRANTED**

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
