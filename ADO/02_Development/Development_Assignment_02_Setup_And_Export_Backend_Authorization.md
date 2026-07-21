# Development Assignment 2 — Setup and Export Backend Implementation Authorization

- Status: **COMPLETED FOR AUTHORIZED LOCAL SETUP-INTEGRATION/EXPORT-BACKEND SCOPE — INDEPENDENT REVIEW ZERO OPEN P0–P3; CLOSURE PUBLICATION EXACT-HEAD CI 11/11; PRODUCTION/DEPLOYMENT/DISTRIBUTION UNAUTHORIZED**
- Date: 2026-07-21
- Candidate Baseline Commit: `e5978702eca7adb3de3fd85db37921b4a441ca59`
- Candidate Baseline Tree: `98ae795bbf4e1d3eb44e12db62024272e861a279`
- Authorized Implementation Baseline Commit: `30c4f5d1d8e6fedeb4b6c1f168d6e1f70a4fef76`
- Authorized Implementation Baseline Tree: `242331b6a34cd19a16fd8a9bea993b2349cbb6dc`
- Authorized Baseline CI: GitHub Actions `29843878706`, attempt 1, 10/10 successful
- Initial Independent Review: `CHANGES REQUIRED` — DA2-REV-01 (P2), no P0/P1/P3
- Technical-Lead Disposition: Multiple-history/re-grant premise rejected because migration `001` permanently enforces one Membership per `(organization_id, user_id)` and C3E1 forbids historical re-onboarding; explicit join/missing-row behavior accepted and corrected in DA2-P07
- Final Independent Re-review: `APPROVED FOR CANDIDATE PUBLICATION` — original premise withdrawn, adjusted DA2-P07 correction approved, DA2-REV-01 closed, zero open P0/P1/P2/P3
- Independent Implementation Review: `APPROVED` — reviewed evidence head `1e4dee29857ac7f0cc4510a753c44e6bbf1a4cba`, tree `d6c3adff4f9e323f248222bbc88a67490f8bedb5`; zero open P0/P1/P2/P3
- Candidate Parent State: Development Assignment 1 and DT-060–DT-062 closed for their authorized local Android/repository/synthetic-server scope; C3B/C3C/C3D/C3E1/C3E2 independently closed for their recorded scopes; tracked/staged repository clean outside the protected boundary; existing untracked root `app.json` preserved and unread
- Human Direction: After candidate publication and exact-head CI, the Human Architect explicitly accepted ADR-0013 and DA2-P01–DA2-P12 on commit `30c4f5d1d8e6fedeb4b6c1f168d6e1f70a4fef76` / tree `242331b6a34cd19a16fd8a9bea993b2349cbb6dc` and separately directed the Technical Lead to begin implementation immediately
- Owner: Technical Lead
- Architecture Candidate: `ADO/01_Architecture/ADR/ADR-0013-tenant-safe-setup-integration-and-time-entry-export.md`
- Roadmap Scope: Development Assignment 2; setup integration plus DT-067/DT-068 export backend candidate, with DT-063–DT-066 status disposition only after exact closure evidence
- Implementation Authority: **GRANTED FOR WORKSTREAMS A–D AND AVS V0–V4 ONLY**

## 1. Candidate objective

Deliver one cohesive backend assignment that:

1. preserves and integrates the already closed C3 setup boundaries rather than rebuilding them;
2. adds the missing tenant-safe, bounded and audited Administrator CSV export of canonical
   TimeEntries; and
3. proves a synthetic bootstrap-to-export path that can later be consumed by professional Admin Web
   productization without moving authority into the browser.

This assignment authorizes implementation of the accepted exact-baseline contract. It does not
authorize any production resource/data access, deployment, distribution, Physical Gate or UI
productization.

## 2. Repository truth reconciled on the candidate baseline

### 2.1 Closed foundations to extend

- C3B owns private first Organization/Administrator bootstrap and named-operator audit.
- C3C owns current-Administrator Customer creation, atomic first Tag registration/Assignment and
  bounded safe setup projection through `taptime_admin_setup`.
- C3D owns Admin Web Customer creation and protected Android native NFC provisioning without raw UID
  in React/Web/persistence.
- C3E1 owns identity-first Employee invitation/redemption and a safe Employee projection.
- C3E2 owns explicit, active-work-safe, history-preserving Tag reassignment.
- B4/C1 own identity and current Membership resolution; B5 is five fixed point reads only.
- B6 and DA1 own server-canonical online/offline lifecycle decisions and canonical TimeEntries.
- on the accepted baseline, migration `010` was latest and CI had ten jobs; the local candidate adds
  migration `011` and an isolated eleventh DA2 job.

### 2.2 Accepted-baseline export gap now implemented locally

The accepted baseline provided none of the following; the local implementation candidate now adds
all of them within Workstreams B/C:

- an export-specific contract or CSV dialect;
- a TimeEntry list/export coordinator;
- an export-specific database role, RLS policy or pool;
- a backend export route;
- export generation audit/hash evidence;
- bounded range/row/byte policy; or
- spreadsheet formula-injection protection.

ADR-0003 and the Product Readiness Roadmap require basic export/reporting, but they do not decide
these details.

### 2.3 Status semantics

DT-063–DT-068 are Roadmap candidate labels, not formal tasks inside EP-007. DA2 may later close
DT-063–DT-066 only for an explicitly evidenced local setup-integration scope and DT-067/DT-068 only
for an explicitly evidenced export-backend scope. No candidate document itself closes them.

## 3. Architecture contract incorporated by reference

ADR-0013 is the accepted implementation boundary. Its Sections 4–9 are mandatory implementation
and review targets.
In particular:

- DA2-P01–DA2-P12 are explicitly Human-accepted and binding;
- existing C3 setup authority is preserved byte-for-byte unless a reviewed correction is required;
- export receives its own least-privilege role, migration and runtime pool;
- only a current server-derived Administrator may export;
- range, rows and bytes are bounded;
- exact CSV serialization neutralizes spreadsheet formulas;
- successful generation is audit/hash-bound without server-side file retention; and
- production, UI productization, correction and deployment remain out of scope.

## 4. Authorized implementation workstreams

Workstreams A–D are released on the exact authorized implementation baseline.

### Workstream A — setup integration and truth reconciliation

- add no second setup implementation;
- build a disposable synthetic integration harness that composes existing C3B/C3C/C3E1/C3E2,
  lifecycle/DA1 and export boundaries;
- prove Customer, Employee, Tag and Assignment setup without code edits;
- prove historical Customer attribution before/after explicit reassignment;
- preserve all current raw-NFC, identity, receipt, audit and least-privilege boundaries; and
- produce an evidence-based DT-063–DT-066 local-scope disposition only at final closure.

### Workstream B — neutral contract and migration `011`

- add `@taptime/time-entry-export-contract` with exact types, validation, CSV serializer and golden
  vectors;
- add migration `011` with `taptime_time_exporter`, forced-RLS/column grants and fixed export-audit
  capability;
- preserve and directly verify `memberships_organization_user_unique`; add no Membership re-grant
  model;
- keep migrations `001`–`010` byte-identical; and
- add direct PostgreSQL role/ACL/RLS/audit/rollback/race evidence.

### Workstream C — export coordinator and API

- add isolated `@taptime/backend-time-export`;
- add one strict Administrator-only POST export route;
- add one distinct validated runtime database URL/pool;
- serialize only the exact accepted CSV schema and headers;
- map TimeEntry `(organization_id, user_id)` only to the sole retained same-Organization Membership
  and fail closed on missing integrity without bytes/audit;
- enforce range/row/byte limits before audit/commit; and
- return no partial CSV and no provider/database/tenant-sensitive diagnostics.

### Workstream D — verification, evidence and governance

- add an isolated Node-24/PostgreSQL-17 DA2 CI job;
- execute AVS-001 R3 V0–V4 verification described in Section 9;
- create implementation/evidence artifacts only after a separate implementation release;
- obtain independent exact-SHA implementation review; and
- close only after every finding is dispositioned and exact-head CI is green.

## 5. Change-Impact Record

### 5.1 Local implementation candidate

The local candidate adds the neutral export contract, migration `011`, isolated export coordinator,
strict API route/runtime pool, synthetic Setup-to-Export journey, isolated DA2 CI job and required
fixture/governance synchronization. It changes no Core decision, Mobile/Admin-Web product behavior,
existing C3 authority or production resource.

### 5.2 Anticipated executable boundary after authorization

Expected affected areas are:

- new ADR/contract/workspace/test files;
- new migration `011` and schema verification;
- backend API types, route parsing/mapping and runtime pool configuration;
- backend/API/schema fixtures and CI workflow;
- synthetic integration harness/evidence; and
- current status/roadmap/risk documentation.

Expected unaffected behavior includes:

- Core BusinessEngine and lifecycle decisions;
- DA1 lease, Mobile queue, scheduler and offline reconciliation;
- NFC capture/normalization;
- C3B/C3C/C3D/C3E1/C3E2 product semantics;
- Admin Web/Mobile UI in this assignment; and
- production/deployment/distribution.

### 5.3 Risk classification

Overall AVS class: **R3**.

Reasons:

- new migration/RLS/role/function-owner boundary;
- tenant-wide read of personal time records;
- CSV injection and disclosure risk;
- audit/hash integrity;
- new runtime pool and route; and
- future coupling to correction and productization.

Unknown or broader impact expands verification; it never reduces it.

## 6. Human decisions and implementation authorization — satisfied

The Human Architect accepted ADR-0013 DA2-P01 through DA2-P12 on the exact published baseline and
separately authorized immediate implementation. Any amendment still requires Technical-Lead impact
analysis and, if material, renewed independent and Human review.

## 7. Failure and race matrix

At minimum, the later implementation must prove:

| Scenario | Required result |
|---|---|
| Employee, absent/revoked Membership or expected-Membership mismatch | disclosure-safe 401/403; zero TimeEntry visibility and zero success audit |
| Cross-tenant IDs/data with otherwise valid Administrator | current Organization rows only; no existence disclosure |
| Stop commits before export snapshot | stopped row with exact stop/duration |
| Stop commits after export snapshot | truthful started row in that export; no mixed row |
| Empty interval | valid header-only CSV and one successful generation audit |
| Interval over 31 days | `invalid_request`; no query success/audit |
| More than 10,000 rows or 8 MiB | `export_limit_exceeded`; no truncated success/audit |
| Display name begins with spreadsheet formula character | deterministic apostrophe neutralization before hash |
| Quote, semicolon, CRLF-attempt or Unicode text | exact canonical escaping; no row/column injection |
| Audit insert, serialization, timeout or connection failure | rollback and JSON `service_unavailable`; no CSV bytes |
| Client disconnect after commit | generated audit remains truthful; never described as downloaded |
| Pool reuse after success/failure | no actor/tenant/role/deadline context leakage |
| Reassignment before/after lifecycle events | export Customer attribution follows immutable TimeEntry target truth |
| Membership is revoked after TimeEntry creation | the same retained same-Organization/User Membership supplies its stable ID and nullable immutable name; exactly one CSV row |
| Corrupted fixture has TimeEntry without its same-Organization/User Membership | disclosure-safe `service_unavailable`; complete rollback, zero CSV bytes and zero success audit; no cross-Organization/current/latest fallback |

## 8. Acceptance criteria

DA2 may close only when:

1. ADR-0013 product decisions are independently reviewed and Human-accepted.
2. A separate exact-baseline implementation authorization exists.
3. Existing setup boundaries remain unchanged or every required correction is separately justified.
4. One synthetic setup-to-export chain passes with complete cleanup.
5. Export is current-Administrator-only, server-derived and tenant-safe.
6. CSV v1 exactly matches the accepted schema/dialect/ordering/limits.
7. Started entries, stopped entries, empty results and duration truth are proven.
8. DA2-P07 proves exactly one same-Organization/User Membership per canonical TimeEntry, stable
   attribution after revocation and fail-closed missing-row integrity without bytes/audit.
9. Cross-tenant, formula-injection, response truncation and audit failure cases fail closed.
10. Migration `011`, role/ACL/RLS/audit policies and migrations `001`–`010` immutability pass.
11. Complete V3 candidate regression and V4 exact-head CI pass.
12. Technical-Lead diff/claim/security audit is complete.
13. Independent implementation review has zero unresolved P0/P1/P2/P3.
14. Closure states precisely whether DT-063–DT-066 and DT-067/DT-068 close for which local scope.
15. No production, deployment, distribution, correction or UI-productization claim is made.

## 9. Adaptive Verification Plan

### V0 — every change

- exact baseline/status/diff inventory excluding `research/`;
- generated-artifact and migration inventory;
- `git diff --check`; and
- claim-to-evidence table.

### V1 — focused implementation feedback

- contract golden vectors;
- focused DA2-P07 same-Organization/User join, revoked-row stability and missing-row fail-closed
  vectors;
- focused migration/role/export coordinator/API tests;
- focused tests-inclusive typechecks; and
- deterministic serializer repetition/property cases.

### V2 — affected-boundary verification before Technical-Lead approval

- contract, schema, identity, administration, lifecycle, offline, export and API workspaces;
- PostgreSQL authority/uniqueness/attribution/race/rollback/cleanup matrix;
- exact response/header/body/size/disclosure tests;
- setup-to-export synthetic integration; and
- relevant builds.

### V3 — final local review candidate

- all workspace tests and tests-inclusive typechecks;
- all available builds, Admin Web build and Android Expo export;
- migrations `001`–`011` empty/repeat/ledger/immutability verification;
- clean dependency graph or explicit environment-hygiene disposition;
- complete synthetic PostgreSQL integration; and
- final diff/claim/evidence audit.

### V4 — exact-head gate

- committed exact candidate SHA/tree;
- complete GitHub Actions matrix including the isolated DA2 job;
- independent exact-SHA review; and
- no carried executable evidence across an unproven delta.

### V5 — Human/operational validation

No physical-device validation is proposed because DA2 changes no native/NFC/UI behavior. A later
data-free Human functional export check, if desired, requires separate authorization and cannot
replace V2–V4.

## 10. Explicit non-goals

- implementation beyond the exact accepted Workstreams A–D and AVS V0–V4 authority;
- changes to Product Vision, One Tap/One Decision or BusinessEngine rules;
- setup feature duplication or generic CRUD;
- corrections, approval, payroll, billing or rounding;
- Admin Web/Mobile productization or download UI;
- production resources/data, deployment, observability, backup/recovery or IAM;
- public/scheduled/email export or server-side export storage;
- physical gate, APK, distribution or Store work;
- legal/privacy retention approval; and
- access to `research/`.

## 11. Delivery and review sequence

```text
Technical Lead ADO-only candidate
  -> exact candidate diff and baseline inventory
  -> independent pre-implementation review
  -> Technical Lead finding disposition
  -> independent accepted-with-adjustment/full-candidate re-review with zero open P0–P3
  -> focused candidate publication and exact-head CI
  -> Human Architect acceptance of DA2-P01–DA2-P12
  -> separate Human exact-baseline implementation authorization
  -> Development Agent implementation workstreams A–D
  -> AVS V1/V2/V3 and Technical-Lead approval
  -> focused implementation publication and V4 exact-head CI
  -> independent exact-SHA implementation review
  -> finding corrections/re-review as required
  -> ADO-only closure publication and exact-head CI
```

No later arrow is implied by completion of an earlier arrow.

## 12. Current release gate

Current state: **the independently approved candidate was published at
`30c4f5d1d8e6fedeb4b6c1f168d6e1f70a4fef76`, tree
`242331b6a34cd19a16fd8a9bea993b2349cbb6dc`, and exact-head run `29843878706` passed 10/10. The
Human Architect accepted ADR-0013/DA2-P01–DA2-P12 and explicitly authorized immediate repository
implementation of Workstreams A–D on that exact baseline. Implementation commit `f385814`, tree
`48b5ba8`, completed Workstreams A–D and passed Technical-Lead/AVS V0–V4 plus exact-head run
`29847593708` 11/11. Independent exact-SHA review bound evidence head `1e4dee2`/tree `d6c3adf` and
run `29847934091` 11/11, returned `APPROVED` and reported zero open P0–P3. Exact-scope ADO closure
`fa171a5`, tree `be13e0c`, passed exact-head run `29848853594`, attempt 1, 11/11. DA2 and
DT-063–DT-068 are closed for the exact local scopes stated in the closure evidence**.

Allowed now:

- read-only use and verification of the closed local repository/synthetic-server scope;
- truthful closure-evidence maintenance; and
- separately authorized follow-up architecture work that does not reinterpret DA2-P01–DA2-P12.

Forbidden now:

- production resource/data access;
- deployment/distribution and Physical Gate execution;
- Admin Web/Mobile UI productization or correction/payroll/legal-retention scope; and
- any new DA2 implementation or scope expansion without a separate authorization.

## 13. Independent pre-implementation review mandate

The independent reviewer must inspect the complete candidate delta against the exact parent and at
minimum answer:

1. Does DA2 extend rather than duplicate every closed C3/DA1 boundary?
2. Are DT-063–DT-068 represented truthfully as Roadmap candidate labels?
3. Are all missing product decisions explicit and reserved for Human acceptance?
4. Can any client field, broad role, pool or query select another Organization?
5. Is the proposed role/RLS/function-owner split least privilege and auditable?
6. Can formula, delimiter, newline, Unicode or size input alter CSV rows/columns or execute in a
   spreadsheet?
7. Are range, started/stopped, duration and ordering semantics coherent and testable?
8. Does the audit meaning remain truthful across rollback and post-commit disconnect?
9. Can correction/reassignment/lifecycle races create mixed or misleading export truth?
10. Are AVS R3 V0–V4 gates complete and proportionate?
11. Are production, correction, UI and legal/privacy boundaries explicit?
12. Is any P0/P1/P2/P3 finding open?

## 14. Initial independent-review finding disposition

The first independent read-only review covered the original eight-file ADO-only candidate on exact
parent `e5978702eca7adb3de3fd85db37921b4a441ca59`, tree
`98ae795bbf4e1d3eb44e12db62024272e861a279`, and returned `CHANGES REQUIRED` with exactly
DA2-REV-01 (P2), no P0/P1/P3.

The Technical Lead dispositions DA2-REV-01 as **accepted with adjustment** because its central
multiple-history premise is false but its request for explicit mapping/fail-closed wording is useful:

1. migration `001` defines permanent `UNIQUE (organization_id, user_id)` as
   `memberships_organization_user_unique`;
2. migrations `002`–`010` do not drop or replace that constraint;
3. the partial `memberships_one_active_per_user` index is an additional global active-membership
   rule, not the only uniqueness rule;
4. the accepted C3E1 contract rejects redemption for any active or historical Membership and lists
   re-onboarding/Organization transfer as explicit non-goals; and
5. the current runtime provides no Membership re-grant path.

Consequently the same-Organization/User join in DA2-P06/P07 returns at most one Membership row; a
revoked row retains its stable ID and nullable name. Canonical TimeEntries are created only after
server-side current-Membership authorization, so their Organization/User pair has that retained
Membership row. The review's proposed current-or-latest selection and re-grant race do not describe
current repository truth and would invent unsupported product behavior.

DA2-P07 now explicitly requires the exact same-Organization/User join, stable retained Membership,
empty display name for `NULL` and disclosure-safe `service_unavailable` with zero bytes/audit if an
out-of-band integrity failure leaves no row. Migration and V1/V2 obligations preserve/prove the
permanent uniqueness constraint, revoked-row stability, one row per canonical TimeEntry and missing-
row rollback. No DA2-P13 or re-grant product behavior is added.

This Technical-Lead correction does not overrule the independent verdict. Only renewed independent
re-review could close DA2-REV-01. That re-review has now explicitly withdrawn the original
multiple-history premise, confirmed the adjusted DA2-P07/migration/race/test correction, closed
DA2-REV-01 and returned `APPROVED FOR CANDIDATE PUBLICATION` with zero open P0–P3.

## 15. Role handover

- Current Role: Technical Lead
- Status: Workstreams A–D published; Technical-Lead/AVS V0–V4 and exact-head CI 11/11 approved; independent exact-SHA review pending
- Completed Work: accepted contract, implementation authorization, neutral contract, migration `011`, isolated role/pool/coordinator/API, synthetic Setup-to-Export integration, isolated eleventh CI job and complete local R3 regression
- Created Artifacts: ADR-0013, this authorization, pre-implementation review and DA2 implementation evidence
- Known Risks: production personal-data/legal/retention/operational gates remain; existing 11 moderate Expo-toolchain findings remain unchanged
- Open Questions: no implementation-contract question; independent review may still raise findings
- Next Responsible Role: independent Review Agent for exact implementation commit/tree `f385814`/`48b5ba8`
- Reason for Handover: implementation and V4 are complete, but no DA2/DT closure is allowed before independent review
