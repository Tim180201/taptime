# Development Assignment 4 — Professional Admin Web Productization Authorization

- Status: **WORKSTREAMS A–D AND AVS V0–V4 INDEPENDENTLY APPROVED — HUMAN V5 REQUIRED BEFORE CLOSURE**
- Date: 2026-07-23
- Candidate baseline commit: `166de1b149a202092443e02c61761887fde8268d`
- Candidate baseline tree: `95355924c6ea65162de80cbbefaac6facc254b08`
- Baseline CI: GitHub Actions `29999268947`, attempt 2, 12/12 successful
- Human-accepted implementation baseline commit: `d9892435acbf7f45a96a9a01c8331afceb65f6f1`
- Human-accepted implementation baseline tree: `693bc9a5ca1c0d414ff196f9dfa3352757e45701`
- Human-accepted baseline CI: GitHub Actions `30000921765`, attempt 1, 12/12 successful
- Parent state: DA1–DA3 and DT-060–DT-074 closed for their exact authorized local scopes
- Owner: Technical Lead
- Decision authority: Human Architect
- Proposed architecture: `ADO/01_Architecture/ADR/ADR-0015-professional-admin-web-productization.md`
- Risk class: proposed implementation AVS-001 **R3**
- Implementation authority: **GRANTED FOR WORKSTREAMS A–D AND AVS V0–V4 ON THE EXACT HUMAN-ACCEPTED BASELINE**

## 1. Candidate objective

Turn the existing safe but minimal Admin Web into a professional, accessible and truthful
Administrator product surface without inventing new backend or business capabilities.

DA4 SHALL:

1. preserve all accepted C3/DA2/DA3 authority and operation semantics;
2. provide a coherent five-view application shell and repository-local design system;
3. remove silent first-100 incompleteness from TimeRecord and review-evidence presentation;
4. add section recovery, stale-response protection and professional interaction evidence; and
5. prepare a separately gated Human functional/visual/browser acceptance path.

## 2. Verified baseline

The candidate baseline contains:

- one 394-line `App.tsx`, one 849-line coordinator, one 646-line API client and minified CSS;
- no router, component library, interactive DOM test environment, accessibility test or browser E2E;
- secure memory-only Supabase authentication and same-origin `/v1` access;
- 52/52 Admin Web tests, tests-inclusive TypeScript and a successful Vite production build; and
- response parsers that receive TimeRecord/review continuation cursors while the current client
  returns only the first page.

No DA4 architecture, product decision or implementation authorization existed on this baseline.

## 3. Binding candidate contract

ADR-0015 DA4-P01–DA4-P12 are proposed as one indivisible implementation boundary. They preserve:

- current server-derived Administrator/Membership authority;
- raw-NFC exclusion and safe Tag fingerprint display;
- one-time, no-clipboard Employee invitation handling;
- active-work-safe explicit Tag reassignment;
- ADR-0013 CSV v1 generation and UTC interchange truth;
- ADR-0014 append-only correction/adjudication and final confirmation; and
- all production, legal/privacy, deployment and distribution gates.

## 4. Proposed workstreams

### Workstream A — product shell and design foundation

- implement the five ADR-0015 views and safe fragment navigation;
- extract semantic presentation components from `App.tsx`;
- add local tokens and accessible reusable primitives;
- implement responsive layout, visible focus and safe status/empty/error patterns; and
- preserve German copy and declared timezone behavior.

### Workstream B — setup and people productization

- productize Customer, safe Tag, reassignment and Employee views;
- preserve existing operation inputs, confirmation and server-result semantics;
- keep invitation plaintext volatile and destroy it on every ADR-0015 boundary; and
- retain explicit bounded pagination and loaded-versus-complete truth.

### Workstream C — time and review productization

- productize effective TimeRecord overview, stopped-record correction and CSV export;
- productize review evidence and append-only adjudication;
- retain server order and implement cursor-backed load-more for TimeRecords/review items;
- show exact source/revision/status/overlap and before/after/reason/confirmation truth; and
- add no batch operation, analytics, advanced filter or backend total.

### Workstream D — session safety and verification

- split authenticated data areas into explicit loading/error/retry boundaries;
- bind every asynchronous result to the active session/Membership generation;
- add interactive DOM, keyboard, focus and automated accessibility tests;
- run AVS V0–V4, production build and independent exact-SHA review; and
- prepare but do not execute a synthetic-data Human V5 browser gate.

## 5. Expected executable boundary

Expected changed executable files are limited to:

- `apps/admin-web/src/**`;
- `apps/admin-web/tests/**`;
- `apps/admin-web/package.json` and root lockfile only for reviewed test dependencies; and
- no other workspace unless a separately reviewed correction is authorized.

Expected unchanged areas:

- migrations `001`–`012`, database roles/RLS/functions and backend coordinators;
- API routes, request/response contracts and neutral packages;
- Core, Mobile, offline/sync, NFC capture and lifecycle decisions;
- `.github/workflows/ci.yml`;
- production/runtime secrets, endpoints, hosting and deployment; and
- `research/`.

Any need to cross an expected-unchanged boundary stops the workstream.

## 6. Change-Impact Record

### ADO-only candidate

- Classification: R0.
- Selected verification: V0 only.
- Executable impact: none.
- Carried evidence: exact baseline Admin Web 52/52 tests, typecheck, build and exact-head CI 12/12.

### Proposed implementation

- Classification: R3.
- Affected boundary: privileged Admin Web state, personal time/evidence display, session generation,
  disclosure, command confirmation and download.
- Unaffected server enforcement is carried only after exact diff verification.
- Unknown impact broadens verification and authority; it never narrows it.

## 7. Acceptance criteria

Implementation may be technically approved only when:

1. independent pre-implementation review reports zero open P0–P3;
2. the Human Architect explicitly accepts ADR-0015 and DA4-P01–DA4-P12 on an exact commit/tree;
3. a separate implementation authorization releases Workstreams A–D on that exact baseline;
4. no new business/backend authority is introduced;
5. all five views remain operable by keyboard and at the accepted responsive targets;
6. TimeRecord/review pagination never silently claims completeness;
7. stale responses cannot restore data after sign-out, identity change or newer refresh;
8. invitation, token, URL, download and confirmation boundaries match ADR-0015;
9. focused and complete Admin Web tests, tests-inclusive typecheck and production build pass;
10. the complete relevant local candidate regression and exact-head CI pass;
11. independent exact-SHA implementation review has zero open P0–P3;
12. any required Human V5 is separately authorized and passed before closure; and
13. no production, deployment, distribution, legal/privacy or DA5–DA8 claim is made.

## 8. Adaptive Verification Plan

### V0 — every delta

- exact baseline/status/diff excluding `research/`;
- changed-file, lockfile and generated-artifact inventory;
- whitespace, reference, authority and claim checks; and
- preservation of `app.json` and all unrelated user work.

### V1 — focused implementation feedback

- changed component and state tests;
- API-client/coordinator cursor and stale-generation tests;
- interactive keyboard/focus and automated accessibility tests;
- CSS/static boundary checks; and
- Admin Web tests-inclusive typecheck.

### V2 — affected boundary

- complete Admin Web suite;
- relevant time-review/export/administration API-consumer contract tests;
- auth/session/sign-out/identity-replacement negative matrix;
- pagination, partial failure and privileged-action interaction matrix; and
- Admin Web production build.

### V3 — final local candidate

- all locally executable workspace tests, typechecks and builds required by AVS impact analysis;
- lockfile/dependency and bundle review;
- responsive/keyboard/accessibility browser checks available locally;
- final authority, disclosure, source and documentation audit; and
- no unsupported production or closure claim.

### V4 — publication gate

- focused product commit/tree;
- complete exact-head GitHub Actions matrix;
- independent exact-SHA implementation review; and
- fresh V3/V4 after every R3 correction.

### V5 — separate Human browser gate

V5 uses only synthetic local data and the reviewed exact build. It covers the five views, narrow/
tablet/desktop layout, Safari/Chromium plus Firefox smoke, keyboard/focus, completeness messaging,
session/sign-out, invitation destruction and every privileged confirmation.

V5 is not authorized by this candidate and is not an NFC Physical Gate.

## 9. Explicit non-goals

- backend, schema, migration, API, role, RLS or business-rule changes;
- new CRUD, analytics, totals, search, arbitrary sorting, bulk or batch behavior;
- selectable time range, Organization timezone or CSV change;
- persistent browser authentication or clipboard handling;
- Mobile, production-like platform, signing/distribution or public website work;
- production resources/data, deployment or hosting;
- payroll, billing, retention or legal/privacy approval; and
- access to `research/`.

## 10. Required sequence and current gate

```text
Technical Lead ADO-only candidate
  -> AVS R0/V0
  -> independent read-only pre-implementation review
  -> correction/re-review until zero open P0–P3
  -> focused candidate publication and exact-head CI
  -> explicit Human acceptance of ADR-0015 and DA4-P01–P12
  -> separate exact-baseline implementation authorization
  -> Workstreams A–D with AVS V1–V3
  -> Technical-Lead approval
  -> focused implementation publication and V4
  -> independent exact-SHA implementation review
  -> separately authorized V5 if retained
  -> exact-scope closure
```

No arrow authorizes a later arrow.

## 11. Independent pre-implementation review mandate

The reviewer must independently verify:

- repository truth and exact candidate delta;
- compatibility with ADR-0011/0013/0014 and DA1–DA3 closure;
- all DA4-P decisions, omissions and scope exclusions;
- first-100 completeness, timezone/DST, cursor and partial-failure semantics;
- auth/session/invitation/URL/download/disclosure safety;
- accessibility, responsive and browser acceptance measurability;
- R3 verification sufficiency; and
- absence of hidden implementation, production or deployment authority.

Allowed verdicts are `APPROVED` or `CHANGES REQUIRED`, with P0–P3 findings.

## 12. Current authority

The independent pre-implementation review returned `APPROVED` with zero open P0–P3 and is archived
in `ADO/05_Evidence/Development_Assignment_04_Independent_Pre_Implementation_Review.md`. The Human
Architect then accepted ADR-0015 and DA4-P01–P12 and separately authorized Workstreams A–D plus
AVS V0–V4 on exact commit `d9892435acbf7f45a96a9a01c8331afceb65f6f1`, tree
`693bc9a5ca1c0d414ff196f9dfa3352757e45701`.

The final implementation is published as `f0f1e177628bd763c894a1d9c9c50a70168ffe1f`, tree
`5259887894a0b97394c748a4556707c6582c93f8`; exact-head run `30009111061`, attempt 1, passed
12/12. Independent exact-SHA implementation review returned `APPROVED`, `MERGE_READY` and zero
open P0–P3; it is archived in
`ADO/05_Evidence/Development_Assignment_04_Independent_Implementation_Review.md`.

Workstreams A–D and AVS V0–V4 are technically approved for their exact authorized local scope.
ADR-0015 still requires a separately authorized Human V5 browser gate before DA4 closure. Human
V5, production, production data, deployment and distribution remain separately unauthorized.
