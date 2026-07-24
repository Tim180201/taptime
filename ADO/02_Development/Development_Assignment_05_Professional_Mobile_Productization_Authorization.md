# Development Assignment 5 — Professional Mobile Productization Authorization Candidate

- Status: **CORRECTED ADO-ONLY CANDIDATE — INDEPENDENT REVIEW REQUIRED; IMPLEMENTATION UNAUTHORIZED**
- Date: 2026-07-24
- Exact candidate baseline commit: `8e0cec7f86aaf740a4fa5fbc0465235acda1b328`
- Exact candidate baseline tree: `a1f57d7001b4355c6fc36b9f27c9296900eaa8cf`
- Baseline CI: GitHub Actions `30094046612`, attempt 1, 12/12 successful
- Owner: Technical Lead
- Decision authority: Human Architect
- Proposed architecture: `ADO/01_Architecture/ADR/ADR-0016-professional-mobile-productization.md`;
  `ADO/01_Architecture/ADR/ADR-0017-android-background-nfc-and-manual-work-triggers.md`
- Proposed implementation risk: AVS-001 **R3**

## 1. Objective

Deliver a professional Android Mobile product surface around the already accepted authentication,
enrollment, NFC lifecycle, offline synchronization and Administrator setup capabilities, plus the
already approved self-only effective-time read, screen-unlocked Android Tag Dispatch and
Human-directed manual Customer/Project/General Work triggers. Stop before a separately authorized
Human/hardware V5.

ADR-0016 DA5-P01–DA5-P12 and ADR-0017 DA5-T01–DA5-T15 are one binding candidate contract. No
workstream may reinterpret those decisions.

## 2. Verified starting point

The baseline has:

- four functional React screens and a state-based `AppNavigator`;
- real server-resolved auth/Membership, Android NFC and protected setup;
- a complete encrypted FIFO/offline scheduler and server reconciliation boundary;
- 31 Mobile test files and the repository's green exact-head 12-job matrix;
- a database invariant of at most one active TimeEntry per Organization/User;
- one DA3 effective-time view containing corrected/recovered truth; and
- no safe self-only effective-time endpoint, professional Mobile shell, Project/General target,
  Product manual trigger, Android Tag Dispatch registration or complete accessibility acceptance
  boundary.

The raw Employee TimeEntry RLS path is insufficient because it omits effective corrections and
recovered records. The Administrator DA3 reader is insufficient because it is Organization-wide
and exposes privileged fields.

## 3. Authorized workstreams after candidate approval

### Workstream A — generalized target and trigger foundation

- add the closed Customer/Project/General WorkTarget and NFC/manual trigger unions;
- add Project create/list/deactivate and the single built-in Organization General Work target;
- generalize append-only WorkEvent/TimeEntry persistence and provenance with deterministic
  backfill;
- preserve exact existing identifiers, timestamps, decisions, corrections and recovered records;
- version offline lease/command evidence additively with existing evidence compatibility; and
- prove constraints, migration replay, forced RLS, tenant negatives and illegal-shape rejection.

### Workstream B — self-only effective-time and manual target reads

- add a neutral closed own-time contract;
- add isolated execute-only reader roles/functions;
- resolve current identity/Membership and exact expected Membership in one read-only transaction;
- return one window-independent active record plus a bounded newest-first effective stopped page;
- return a separate bounded current-Organization manual target projection;
- add the exact `/v1/mobile/own-time/query` route, strict parser, no-store response and bounded body;
  add exact Project/manual-target routes with strict closed parsers; and
- prove same-user success plus stale/revoked/wrong-role/cross-user/cross-tenant denial, least
  privilege, coherent correction races and pool cleanup.

### Workstream C — Android Tag Dispatch and manual capture

- add a repository-owned narrow Expo configuration plugin for supported NFC technology dispatch;
- add a consume-once native launch/`onNewIntent` bridge with capture-time evidence;
- route cold/warm intents through the existing exclusive coordinator and normal Business Engine
  command path;
- discard on absent/replaced/signed-out authority and reject unassigned/foreign/inactive evidence;
- add **Manuell erfassen** with Customer/Project/General selection and one trigger action;
- persist-before-send through the versioned encrypted FIFO with no local lifecycle decision; and
- prove foreground/setup ownership, cold/warm dedupe, restart, session races and protected evidence.

### Workstream D — Mobile shell and operational product screens

- replace ad-hoc screen switching with the ADR-0016/ADR-0017 role-safe destination model;
- add Mobile-local semantic tokens and reusable native primitives;
- preserve enrollment and offline-capture shells as stricter capability subsets;
- bind asynchronous presentation to current session/runtime generation; and
- productize Erfassen without changing NFC or lifecycle authority;
- productize Manuell without caller-selected Start/Stop;
- add Meine Zeiten from the dedicated self-only effective projection;
- add Synchronisierung from existing queue/review/protection truth and unchanged retry;
- preserve current Administrator NFC-Einrichtung behavior and exclusive capture ownership; and
- implement German timezone-aware, provenance-visible, screen-reader-safe and scalable
  presentation.

### Workstream E — Admin/export integration

- expose bounded Project create/list/deactivate through the existing protected Administrator setup
  pattern;
- generalize safe Admin time/review target presentation without broadening correction authority;
- retain CSV v1 byte compatibility and reject non-Customer ranges explicitly;
- add opt-in fixed-schema CSV v2 for generalized targets and Start/Stop provenance; and
- preserve formula safety, snapshot, byte/row, audit, content-hash and tenant boundaries.

### Workstream F — verification and gate preparation

- add focused contract, PostgreSQL, API, coordinator, presenter, component and source-boundary tests;
- add Android manifest/plugin/native intent unit/integration checks and exact export verification;
- execute AVS V0–V4 with one final complete local candidate regression;
- publish an exact candidate, obtain exact-head CI and independent exact-SHA review;
- prepare a concise exact-artifact Android V5 runbook/evidence shell only after implementation
  approval; and
- stop before artifact installation, ADB/device/Tag use or Human V5 execution.

## 4. Expected executable delta

Expected changed areas are:

- `packages/core/**` for the closed WorkTarget/trigger unions and unchanged decision parity;
- versioned lifecycle/offline, own-time, setup and export contract packages;
- additive `apps/backend-schema/migrations/013_*` onward and focused schema tests;
- exact Project/manual-target/own-time/export coordinators and API integration;
- narrow Admin Web Project and generalized target/provenance presentation;
- `apps/mobile/plugins/**` and the minimum Android native bridge/configuration;
- `apps/mobile/src/**` and `apps/mobile/tests/**`;
- workspace metadata, root lockfile and `.github/workflows/ci.yml` only as required to build/test
  the new internal workspaces; and
- concise ADO evidence/status files.

Expected byte-stable behavior:

- Core BusinessEngine decision table and server-only authority;
- migrations `001`–`012`;
- existing C1/C2/C3/DA1–DA4 public behavior;
- correction/adjudication semantics and existing setup authority;
- NFC payload codec and exclusive-capture rules;
- offline queue ordering/idempotency/retention/protection and reconciliation semantics;
- CSV v1 for Customer-only ranges; and
- production/deployment/signing/distribution configuration.

Any material need outside ADR-0016 and ADR-0017 stops implementation and returns to architecture
review.

## 5. Change-Impact Record

### Current ADO-only candidate

- Risk: R0.
- Verification: V0, exact diff/claim/reference checks.
- Executable impact: none.
- Carried evidence: baseline commit/tree and exact-head CI 12/12.

### Proposed implementation

- Risk: R3.
- Boundaries: current identity/Membership and tenant isolation; WorkTarget/Project/General schema;
  trigger provenance and Business Engine compatibility; lifecycle/offline/export contracts;
  effective own/Admin-time reads; Project administration; backend API/pools; Mobile
  session/NFC/manual/offline state; generated Android manifest/native ingress; accessibility.
- Verification: V0–V4 and mandatory independent review.
- V5: separate Human/hardware authorization and fresh exact-artifact evidence.

## 6. Acceptance criteria

Technical approval requires:

1. independent pre-implementation review of this exact ADO candidate with zero open P0–P3;
2. exact implementation authority under the repository's standing independently-approved-candidate
   rule;
3. no business capability beyond ADR-0016 and ADR-0017;
4. current actor/Organization derived server-side and expected Membership compare-only;
5. no cross-user/cross-tenant/Administrator-detail visibility;
6. active record independent of the bounded history window;
7. only effective corrected/recovered values in own history;
8. manual action selects only a target and never Start/Stop;
9. no Tag-derived WorkEvent before exact restored authority and active-assignment validation;
10. immutable `startedVia`/`stoppedVia` truth across own-time, Admin and CSV v2;
11. backward-compatible protected FIFO and CSV v1 boundaries;
12. complete native accessibility, intent-consumption, exclusive-capture and session-generation
    regression evidence;
13. AVS V0–V4 plus exact-head CI and independent exact-SHA implementation `APPROVED`;
14. no Human V5 or closure claim before a fresh separately authorized Android gate; and
15. no production, production-data, deployment, distribution, signing or pilot claim.

## 7. Adaptive Verification Plan

### V0

- exact diff/status with `research/` excluded;
- authority, baseline, protected-file and claim review;
- whitespace, migration order/checksum and dependency inventory.

### V1

- own-time contract parser/golden vectors;
- WorkTarget/trigger/offline/export parser and compatibility vectors;
- focused role/function/coordinator/API tests;
- Mobile screen/presenter/navigation/session-generation tests;
- Android config-plugin/intent/consume-once/dedupe/cancellation tests;
- tests-inclusive typechecks for every changed workspace.

### V2

- complete schema security and migration replay;
- complete Core/schema/setup/export/own-time/backend API/Admin Web/Mobile suites and builds;
- cross-user/cross-tenant/revocation/pool-reuse matrix;
- correction/read and session/NFC/manual/offline race/failure boundaries;
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
accounts/data and approved device/Tags; cover ADR-0017 DA5-T15 in addition to ADR-0016; and end
with complete cleanup. No V5 observation is authorized or reusable by this candidate.

## 8. Independent review mandate

The read-only reviewer must independently verify:

- exact repository/baseline/CI truth and ADO-only delta;
- that own-time is already accepted v1 capability and no new Business Rule is invented;
- self-only/effective/active-record contract and every omitted privileged field;
- generalized target/trigger semantics, Project/General scope and immutable provenance;
- Android Tag Dispatch limitations, consume-once ownership, session restoration and rejection;
- role/function/pool/RLS least privilege, migration compatibility and negative-test sufficiency;
- manual/NFC online-offline parity, CSV v1 rejection and CSV v2 truth;
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

The Human Architect has instructed inclusion of the two ADR-0017 product requirements and
autonomous Roadmap execution through independently approved work, with a stop at the next
Human/hardware gate. That standing instruction does not waive a genuine missing product decision,
expand this candidate or authorize V5/production/deployment.

Until independent pre-implementation review returns `APPROVED` with zero open P0–P3, implementation
is unauthorized. Human V5, production, production data, deployment and distribution remain
separately unauthorized.
