# Development Assignment 3 — Local Implementation Evidence

- Status: **IMPLEMENTATION INDEPENDENTLY APPROVED — ZERO OPEN P0–P3; HUMAN V5 DISPOSITION REQUIRED BEFORE CLOSURE**
- Date: 2026-07-21
- Authorized Baseline Commit: `ff68f7a7d0ce69a65e88846ae1cca9abd5951f5d`
- Authorized Baseline Tree: `09ef169a68bb53420e07b6f3fcbbdc74e0c01d57`
- Implementation Commit: `0f71aca270969866037f2e31cc05ef8730e0ecd1`
- Implementation Tree: `e3e2ed780c217a520d382b98971991510bb99973`
- Implementation CI: GitHub Actions `29859522776`, attempt 1, 12/12 successful
- Owner: Technical Lead
- Risk Class: AVS-001 R3
- Authorized: DA3 Workstreams A–D and AVS V0–V4
- Unauthorized: production, production data, deployment, distribution, Physical Gate and V5

## 1. Implemented scope

The local candidate implements the Human-accepted ADR-0014 and DA3-P01–DA3-P16:

1. `@taptime/time-review-contract` freezes strict request/result unions, validation, canonical
   request payloads and golden digest vectors. Human reasons follow PostgreSQL `btrim` semantics
   exactly and are bounded to 1–500 Unicode code points.
2. migration `012_append_only_time_record_correction_and_review_adjudication.sql` preserves
   migrations `001`–`011`, adds forced-RLS append-only revision, adjudication and command-receipt
   ledgers, stable effective-record projections, distinct NOLOGIN roles/function owners and exact
   read/write/export capabilities.
3. `@taptime/backend-time-review` uses isolated read/write pools, server-derived current
   Administrator authority, exact expected-Membership narrowing, shared lifecycle advisory locks,
   deterministic idempotency digests, deadlines and connection retirement.
4. the backend API adds exactly five DA3 routes for overview, review items, correction,
   adjudication and exact current-installation review state with strict bodies and disclosure-safe
   mappings.
5. Admin Web gains the minimal bounded overview/correction/review/export operator flow with visible
   before/after values, mandatory reason, final confirmation, session-safe state and bounded CSV
   response streaming. This is not DA4 productization.
6. Mobile reconciles only its exact authenticated Installation marker and clears only the encrypted
   review marker after fresh server proof; FIFO/evidence rows are never cleared by this path.
7. DA2 export reads only the effective projection while retaining the accepted CSV v1 shape,
   ordering, limits, audit and formula-safety contract.
8. the disposable synthetic journey composes setup, enrollment, lifecycle, offline ingestion,
   correction, adjudication, predecessor release and effective export, including both lock orders.
9. CI adds an isolated PostgreSQL-17 DA3 job and includes the new contract/review dependencies in
   every affected existing job.

## 2. DA3-P01–DA3-P16 evidence map

| Contract | Local evidence |
|---|---|
| P01/P14 minimal operator workflow | five strict API routes plus bounded Admin Web overview, correction, review and export surfaces |
| P02 exact current authority | identity lock, exact expected Membership, Administrator/revocation checks, forced RLS and negative API/direct-role tests |
| P03 immutable original evidence | append-only triggers and hostile UPDATE/DELETE tests for lifecycle, offline and DA3 ledgers |
| P04/P05 stable records and stopped-only correction | stable logical IDs, contiguous full revisions, expected version and active-record rejection tests |
| P06 exact reason | shared validator/golden tests and PostgreSQL-equivalent U+0020 trim plus 1–500 Unicode-code-point enforcement |
| P07 idempotency/concurrency | UUID command receipts, SHA-256 canonical digests, exact retry/conflict tests and shared advisory-lock races |
| P08 bounded review projection | safe current-tenant projection, strict pagination and disclosure-negative tests |
| P09 append-only prefix adjudication | exact-prefix/mixed-source rejection and all no-change, adjust-existing and recovered-record outcomes |
| P10 predecessor release | database-proved cursor release, hostile false-clear rejection and exact authenticated Mobile retain/clear tests |
| P11 legacy/protected evidence | server legacy adjudication remains non-canonical; local-only legacy evidence is not browser-addressable |
| P12 effective CSV | unchanged CSV v1 contract over one repeatable effective snapshot with correction/export race coverage |
| P13 least privilege | distinct read/write/export roles, function owners and runtime pools with hostile direct-access and pool-reuse tests |
| P15 ledger/audit truth | one authoritative append-only ledger plus one exact success AuditEvent per command; rollback tests cover audit failure |
| P16 exclusions | no delete/retention/legal/payroll/production behavior or claim added |

## 3. Failure, race and security evidence

- missing, Employee, revoked, stale-Membership and cross-tenant requests fail closed without
  privileged data or mutation;
- active-record correction, stale version and changed-content idempotency retry are rejected with
  zero duplicate ledger/audit state;
- competing corrections serialize to one revision winner and one stale loser;
- Stop/correction and offline-ingestion/adjudication are proved in both lock orders with observed
  PostgreSQL lock waiting rather than timing assumptions;
- correction/export returns one repeatable old-or-new effective snapshot;
- non-prefix, out-of-order, mixed-user and mixed-source adjudication are rejected completely;
- a hostile write-role helper cannot clear a cursor while unresolved evidence remains;
- stale, lost, malformed and still-pending Mobile responses retain the encrypted marker;
- timeouts, disconnects, audit failures and reused pools leave no partial mutation or leaked actor,
  tenant, role or deadline context; and
- the Admin Web client enforces declared and streamed 8-MiB CSV limits before creating a Blob.

## 4. AVS V0–V3 verification

All final checks below passed locally on 2026-07-21 against Node 24 and PostgreSQL 17:

| Surface | Result |
|---|---:|
| Administration contract | 4/4 |
| Core | 290/290 |
| Offline synchronization contract | 7/7 |
| TimeEntry export contract | 10/10 |
| Time review contract | 5/5 |
| Mobile | 421/421 |
| Admin Web | 52/52 |
| Backend schema/security | 128/128 |
| B1 PostgreSQL spike | 39 passed, 2 explicit environment-dependent skips |
| Backend identity | 55/55 |
| Backend read model | 42/42 |
| Backend lifecycle | 88/88 |
| Backend bootstrap | 189/189 |
| Backend administration | 121/121 |
| Backend offline synchronization | 13/13 |
| Backend time review | 10/10 |
| Backend time export and complete DA3 journey | 14/14 |
| Backend API | 224/224 |
| Synthetic Android E2E | 45/45 |
| **Total** | **1,757 passed, 2 explicit skips, 0 failed** |

Additionally passed:

- all build and tests-inclusive typecheck scripts exposed by all 19 workspaces; Core uses its
  dedicated `tsconfig.typecheck.json`, which includes both `src` and `tests`;
- clean migration `001`–`012` apply on a new database, exact ledger verification and idempotent
  rerun; migrations `001`–`011` are unchanged from the authorized baseline;
- Android Expo production export;
- dependency graph validation, CI YAML parse, `git diff --check` and focused
  source/diff/claim/security review; and
- complete disposal of both Technical-Lead-created DA3 verification databases.

An initial final-regression pass correctly exposed a missing DA3 dependency stub in the existing
synthetic harness. The harness now supplies an explicit fail-closed unavailable stub and diagnostic;
the complete build/typecheck and 45-test synthetic suite then passed. A preliminary synthetic test
invocation against a noncanonical database name failed its exact-name preflight before schema/test
mutation; the required named disposable database subsequently passed 45/45. Neither failed attempt
is counted as successful evidence.

`npm audit` reports the already disclosed 11 moderate transitive advisories in the Expo/Xcode
toolchain. The offered forced remediation requires an unrelated breaking Expo change and was not
applied. DA3 adds local workspace dependencies and the existing `pg`/type packages, not a new
browser or Mobile runtime dependency.

## 5. Change-Impact Record

- Baseline: exact accepted/authorized commit and tree recorded above.
- Impact: durable schema/RLS/roles, backend review/export/API, Admin Web, Mobile reconciliation,
  synthetic journey, dependencies, tests, CI and truthful ADO status/evidence.
- Risk: R3 because append-only employee time evidence, tenant authority, offline ordering and
  export truth cross durable security and concurrency boundaries.
- Verification selected: complete V0–V3; no adaptive narrowing at final regression.
- Carried evidence: closed DA1/DA2/C3 foundations only where byte-identical or exercised through
  their public boundaries; it is not substituted for DA3 correctness evidence.
- Excluded path: `research/` remained unread and untouched.
- Generated artifact: local ignored Mobile `dist/` from the successful Android export; no
  distributable release artifact, signing or deployment was produced.

## 6. Current gate and honest closure status

- Technical-Lead local review finds no open P0/P1/P2/P3 in the candidate.
- The focused implementation is published at the exact commit/tree above and AVS V4 exact-head
  GitHub Actions run `29859522776`, attempt 1, passed all 12 jobs.
- Independent exact-SHA review of implementation `0f71aca` and reviewed Evidence head `350503a`
  returned `APPROVED` with zero open P0/P1/P2/P3.
- DA3 and DT-069–DT-074 remain open until the Human Architect disposes V5 and the later exact ADO
  closure gate is complete.
- The independent reviewer recommends retaining V5. V5/Physical Gate remains separately
  unauthorized; this evidence neither executes nor authorizes it.
- Production, production data, deployment and distribution remain unauthorized.

## 7. Subsequent V5 enablement authorization — 2026-07-22

After the independent implementation approval above, the Human Architect separately authorized
focused local V5 enablement and later DA3-V5-F01 on exact review-synchronized baseline `0b0d040`,
tree `eee2650`. That later harness/runbook/correction candidate, its AVS V0–V4 ledger and its
physical-run stop boundary are recorded in
`ADO/05_Evidence/Development_Assignment_03_V5_Enablement_Evidence.md`. Product `6eb68a3` and
Evidence `f4e2eeb` each passed exact-head CI 12/12; independent exact-SHA V5 review returned
`APPROVED` with zero open P0–P3. This addendum does not alter the historical implementation totals
or authorize the Human Physical Gate.

## 8. Subsequent first V5 physical run — 2026-07-22

After independent V5 enablement approval and separate exact-bound Human authorization, the first
physical run passed artifact/device/setup preconditions but failed closed at Gate A with
`DA3-PHYS-01` (P1). The Administrator setup identity had bound the encrypted offline store; the
following Employee identity was correctly refused as `identity_mismatch`. Server lifecycle and DA3
counts remained zero, Gates B/C did not start and complete cleanup passed. This later physical
finding does not alter the historical implementation test totals or independent implementation
approval, but it blocks DA3/DT-069–DT-074 closure and any replacement run pending a new reviewed
correction and Human authorization. Full record:
`ADO/05_Evidence/Development_Assignment_03_Physical_Validation_Evidence.md`.

## 9. Subsequent DA3-PHYS-01 operational correction — 2026-07-22

The Human Architect selected the operational clean exact-artifact reinstall boundary on exact
baseline `f0c9db3`, tree `27cabe6`, and authorized Runbook/Evidence, AVS V0–V4 and independent
review while keeping V5 closed. The ADO-only candidate does not alter this implementation, its
test totals, the encrypted owner rule or Product `6eb68a3`. It requires a package-clean boundary
between Administrator setup and Employee Gate A. Local correction V0–V3 passed; publication
`f7a2b1e`, tree `a8caed6`, passed V4 exact-head run `29935693909` 12/12. Independent review returned
`APPROVED FOR DA3-PHYS-01 OPERATIONAL CORRECTION` with zero P0–P3; any replacement run remains
separately Human-gated. Evidence:
`ADO/05_Evidence/Development_Assignment_03_DA3_PHYS_01_Operational_Reinstall_Correction_Evidence.md`.

## 10. Subsequent replacement V5 run — 2026-07-22

The Human Architect later authorized one exact-bound complete fresh replacement run. Exact
preflight and first installation passed, but the run failed closed during prerequisite setup with
`DA3-PHYS-02` (P1). The harness already seeded two Customers; the runbook also instructed creation
of two Customers while requiring an exact two-receipt/four-audit final setup aggregate that is
reachable only without those additional writes. After one correct Tag-A assignment, status was
four Customers, one Tag/Assignment, three administration receipts, four AuditEvents and zero
lifecycle/DA3 rows. Tag B, clean reinstall and Gates A–C were not started; cleanup passed.

This operational finding changes no product source, implementation approval or historical test
total. `DA3-PHYS-01` and `DA3-PHYS-02` remain open and block DA3/DT-069–DT-074 closure. The consumed
run authorizes no correction or retry; a focused ADO-only procedure correction, independent review
and new exact-bound Human authorization are required. Full record:
`ADO/05_Evidence/Development_Assignment_03_Physical_Validation_Evidence.md`.
