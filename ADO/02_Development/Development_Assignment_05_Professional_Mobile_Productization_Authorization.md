# Development Assignment 5 — Professional Mobile Productization Authorization Candidate

- Status: **ADO-ONLY CANDIDATE — INDEPENDENT REVIEW REQUIRED; IMPLEMENTATION UNAUTHORIZED**
- Date: 2026-07-24
- Exact candidate baseline commit: `4bfbf8eb39e46b073b18c8d7ab502add44ad47f0`
- Exact candidate baseline tree: `17b7c4a6a8ec1bbdce9de6c99d0863acf6c47854`
- Baseline CI: GitHub Actions `30093494886`, attempt 1, 12/12 successful
- Owner: Technical Lead
- Decision authority: Human Architect
- Proposed architecture: `ADO/01_Architecture/ADR/ADR-0016-professional-mobile-productization.md`
- Proposed implementation risk: AVS-001 **R3**

## 1. Objective

Deliver a professional Android Mobile product surface around the already accepted authentication,
enrollment, NFC lifecycle, offline synchronization and Administrator setup capabilities, plus the
already approved self-only effective-time read. Stop before a separately authorized Human/hardware
V5.

ADR-0016 DA5-P01–DA5-P12 are one binding candidate contract. No workstream may reinterpret those
decisions.

## 2. Verified starting point

The baseline has:

- four functional React screens and a state-based `AppNavigator`;
- real server-resolved auth/Membership, Android NFC and protected setup;
- a complete encrypted FIFO/offline scheduler and server reconciliation boundary;
- 31 Mobile test files and the repository's green exact-head 12-job matrix;
- a database invariant of at most one active TimeEntry per Organization/User;
- one DA3 effective-time view containing corrected/recovered truth; and
- no safe self-only effective-time endpoint, professional Mobile shell or complete accessibility
  acceptance boundary.

The raw Employee TimeEntry RLS path is insufficient because it omits effective corrections and
recovered records. The Administrator DA3 reader is insufficient because it is Organization-wide
and exposes privileged fields.

## 3. Authorized workstreams after candidate approval

### Workstream A — self-only effective-time read

- add a neutral closed own-time contract;
- add migration `013` with one isolated execute-only reader role/function;
- resolve current identity/Membership and exact expected Membership in one read-only transaction;
- return one window-independent active record plus a bounded newest-first effective stopped page;
- add the exact `/v1/mobile/own-time/query` route, strict parser, no-store response and bounded body;
  and
- prove same-user success plus stale/revoked/wrong-role/cross-user/cross-tenant denial, least
  privilege, coherent correction races and pool cleanup.

### Workstream B — Mobile shell and local design foundation

- replace ad-hoc screen switching with the ADR-0016 role-safe destination model;
- add Mobile-local semantic tokens and reusable native primitives;
- preserve enrollment and offline-capture shells as stricter capability subsets;
- bind asynchronous presentation to current session/runtime generation; and
- implement German timezone-aware, screen-reader-safe and scalable presentation.

### Workstream C — operational product screens

- productize Erfassen without changing NFC or lifecycle authority;
- add Meine Zeiten from the dedicated self-only effective projection;
- add Synchronisierung from existing queue/review/protection truth and unchanged retry;
- preserve current Administrator NFC-Einrichtung behavior and exclusive capture ownership; and
- add active-session copy that invokes only the normal NFC scan and never predicts or commands
  Stop.

### Workstream D — verification and gate preparation

- add focused contract, PostgreSQL, API, coordinator, presenter, component and source-boundary tests;
- execute AVS V0–V4 with one final complete local candidate regression;
- publish an exact candidate, obtain exact-head CI and independent exact-SHA review;
- prepare a concise exact-artifact Android V5 runbook/evidence shell only after implementation
  approval; and
- stop before artifact installation, ADB/device/Tag use or Human V5 execution.

## 4. Expected executable delta

Expected changed areas are:

- `packages/own-time-contract/**`;
- `apps/backend-schema/migrations/013_*` and focused schema tests;
- `apps/backend-own-time/**`;
- exact own-time integration in `apps/backend-api/**`;
- `apps/mobile/src/**` and `apps/mobile/tests/**`;
- workspace metadata, root lockfile and `.github/workflows/ci.yml` only as required to build/test
  the new internal workspaces; and
- concise ADO evidence/status files.

Expected byte-stable behavior:

- Core BusinessEngine and Domain;
- migrations `001`–`012`;
- existing C1/C2/C3/DA1–DA4 public behavior;
- Admin Web, CSV, correction/adjudication and setup contracts;
- NFC payload codec, native adapter and exclusive-capture rules;
- offline queue schema/order/idempotency/retention and reconciliation semantics; and
- production/deployment/signing/distribution configuration.

Any material need outside ADR-0016 stops implementation and returns to architecture review.

## 5. Change-Impact Record

### Current ADO-only candidate

- Risk: R0.
- Verification: V0, exact diff/claim/reference checks.
- Executable impact: none.
- Carried evidence: baseline commit/tree and exact-head CI 12/12.

### Proposed implementation

- Risk: R3.
- Boundaries: current identity/Membership and tenant isolation; effective personal-time read;
  backend API/pool; Mobile session/NFC/offline state; native accessibility.
- Verification: V0–V4 and mandatory independent review.
- V5: separate Human/hardware authorization and fresh exact-artifact evidence.

## 6. Acceptance criteria

Technical approval requires:

1. independent pre-implementation review of this exact ADO candidate with zero open P0–P3;
2. exact implementation authority under the repository's standing independently-approved-candidate
   rule;
3. no business capability beyond ADR-0016;
4. current actor/Organization derived server-side and expected Membership compare-only;
5. no cross-user/cross-tenant/Administrator-detail visibility;
6. active record independent of the bounded history window;
7. only effective corrected/recovered values in own history;
8. no manual lifecycle command or local/server authority confusion;
9. unchanged protected FIFO, retry, credential and NFC ownership boundaries;
10. complete native accessibility and session-generation regression evidence;
11. AVS V0–V4 plus exact-head CI and independent exact-SHA implementation `APPROVED`;
12. no Human V5 or closure claim before a fresh separately authorized Android gate; and
13. no production, production-data, deployment, distribution, signing or pilot claim.

## 7. Adaptive Verification Plan

### V0

- exact diff/status with `research/` excluded;
- authority, baseline, protected-file and claim review;
- whitespace, migration order/checksum and dependency inventory.

### V1

- own-time contract parser/golden vectors;
- focused role/function/coordinator/API tests;
- Mobile screen/presenter/navigation/session-generation tests;
- tests-inclusive typechecks for every changed workspace.

### V2

- complete schema security and migration replay;
- complete own-time/backend API/Mobile suites and builds;
- cross-user/cross-tenant/revocation/pool-reuse matrix;
- correction/read and session/NFC/offline race/failure boundaries;
- Android export if native Product configuration changed.

### V3

- one complete locally executable repository regression on the final candidate;
- all applicable tests-inclusive typechecks and builds;
- clean PostgreSQL migrations/replay and disposable cleanup;
- dependency/license/source/disclosure and protected-boundary audit.

### V4

- focused commit/tree publication;
- complete exact-head GitHub Actions matrix;
- independent exact-SHA implementation review;
- fresh V3/V4 after every R3 correction.

### V5

Separately authorized Human Android evidence only. It must use a reviewed exact artifact, synthetic
accounts/data and approved device/Tags, and end with complete cleanup. No V5 observation is
authorized or reusable by this candidate.

## 8. Independent review mandate

The read-only reviewer must independently verify:

- exact repository/baseline/CI truth and ADO-only delta;
- that own-time is already accepted v1 capability and no new Business Rule is invented;
- self-only/effective/active-record contract and every omitted privileged field;
- role/function/pool/RLS least privilege and negative-test sufficiency;
- scan, active-session, sync, protected-evidence, auth/enrollment/setup preservation;
- Mobile navigation, locale/timezone, accessibility and Human V5 measurability;
- DA4 gate separation and DA6–DA8 exclusions; and
- whether any DA5-P decision still genuinely requires a new Human product decision.

Allowed verdicts: `APPROVED` or `CHANGES REQUIRED`, with P0–P3 findings.

## 9. Required sequence and current authority

```text
ADO-only candidate
  -> R0/V0
  -> focused publication and exact-head CI
  -> independent read-only exact-SHA review
  -> correction/re-review until zero open P0–P3
  -> standing-rule release of the exact approved scope
  -> sole Development writer; V1–V3
  -> Technical-Lead acceptance
  -> focused publication; V4
  -> independent exact-SHA implementation review
  -> stop before separately authorized Human Android V5
```

The Human Architect has instructed autonomous Roadmap execution through independently approved
work and a stop at the next Human/hardware gate. That standing instruction does not waive a genuine
missing product decision, expand this candidate or authorize V5/production/deployment.

Until independent pre-implementation review returns `APPROVED` with zero open P0–P3, implementation
is unauthorized. Human V5, production, production data, deployment and distribution remain
separately unauthorized.
