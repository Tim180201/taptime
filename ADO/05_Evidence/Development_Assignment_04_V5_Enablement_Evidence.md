# Development Assignment 4 — V5 Enablement Candidate Evidence

- Status: **LOCAL R3 V0–V3 GREEN AFTER DA4-V5-F01 — V4 AND INDEPENDENT IMPLEMENTATION REVIEW PENDING**
- Date: 2026-07-23
- Candidate baseline commit: `4594529667fe1570045eea03fd7132bc27e2e479`
- Candidate baseline tree: `72338ec9b65dabdd71ab9011604817f61c13c288`
- Candidate baseline CI: GitHub Actions `30009920314`, attempt 1, 12/12 successful
- Published candidate commit: `5774ab7971f1c5df6834be44ab556c8138cfcf54`
- Published candidate tree: `062ded6af067967a3019a7d5abe42428ca58af0e`
- Published candidate CI: GitHub Actions `30012402185`, attempt 1, 12/12 successful
- Risk class: current candidate R0; proposed executable enablement R3

## 1. Repository-confirmed gap

The current synthetic harness:

- binds Auth/API to numeric loopback and starts from migrations `001`–`012`;
- uses a memory-only synthetic password and reserved `.invalid` identities;
- seeds exactly two Customers;
- exposes the real administration, invitation, reassignment, time-review and export coordinators;
  and
- performs complete disposable database/runtime-role cleanup.

It does not contain a DA4-specific browser profile, a built-Admin-Web listener on port `5173`, or
fixture rows sufficient to produce continuation cursors for setup, Employee, TimeRecord and review
surfaces. The Admin Web requests real limits 20/20/100/100. The standard seed therefore cannot
exercise all ADR-0015 V5 observations without additional reviewed preparation.

## 2. Proposed delta and protected boundaries

The candidate proposes only:

- an explicit fail-closed `da4-v5` profile inside `apps/synthetic-android-e2e`;
- deterministic synthetic cursor-bearing state and disclosure-safe aggregate status;
- numeric-loopback serving/proxying of an exact manifest-bound built Admin Web;
- focused profile/isolation/disclosure/cleanup tests and README instructions; and
- the authorization candidate and non-executable runbook.

Protected and expected byte-identical boundaries are Admin Web source, backend/API product code,
contracts, schema/migrations, root dependencies/lockfile, CI workflow, Mobile/Android/NFC and all
production/deployment inputs. The default harness profile must remain behaviorally unchanged.

## 3. Carried product evidence

No new product-correctness claim is derived from this ADO-only delta.

- Human-accepted DA4 baseline: `d9892435acbf7f45a96a9a01c8331afceb65f6f1`, tree
  `693bc9a5ca1c0d414ff196f9dfa3352757e45701`, CI `30000921765`, attempt 1, 12/12.
- Final reviewed product: `f0f1e177628bd763c894a1d9c9c50a70168ffe1f`, tree
  `5259887894a0b97394c748a4556707c6582c93f8`, CI `30009111061`, attempt 1, 12/12.
- Fresh local final product evidence: 1,046 passed, 0 failed; all relevant tests-inclusive
  typechecks/builds; Admin Web 85/85; automated 320-pixel browser smoke; no Admin-Web-scoped
  dependency vulnerability.
- Independent exact-SHA implementation review: `APPROVED`, `MERGE_READY`, zero open P0–P3.
- Final status publication baseline: `4594529667fe1570045eea03fd7132bc27e2e479`, tree
  `72338ec9b65dabdd71ab9011604817f61c13c288`, CI `30009920314`, attempt 1, 12/12.

## 4. Original R0 Change-Impact Record

- Intended behavior: documentation of a later optional V5 fixture, exact Human procedure and
  gates; no runtime behavior.
- Affected files: ADO Markdown only.
- Executable/schema/dependency/configuration/workflow/artifact impact: none.
- Selected verification: AVS V0.
- V1–V3: not applicable to this R0 candidate.
- Publication CI: `30012402185`, attempt 1, passed 12/12 on the exact seven-file candidate; this
  creates no fresh product-correctness claim.
- Proposed R3 V4 at candidate publication: not applicable because executable enablement had not
  started.
- V5: not authorized and not run.
- Protected state: `research/` and the pre-existing untracked `app.json` are not inspected or
  changed.

## 5. Planned R3 evidence

A later authorized implementation must provide:

1. exact changed-file and default-profile isolation diff;
2. tests proving explicit opt-in, unknown-profile rejection and the exact fixture: shared setup
   page 1 is 20 Customers/zero Tags, page 2 adds one Customer/one Tag; Employees are 20/1 and
   TimeRecords/reviews are 100/1;
3. tests proving the public manifest labels, isolated correction interval, exact one-minute inward
   correction shift, uniquely oldest review target and browser-timezone/DST fail-closed boundary;
4. tests proving initial Assignment history total/active `1/1`, reassignment final `2/1` with the
   first row inactive, exactly one target cutover and no duplicate browser write;
5. tests proving exactly six new general AuditEvents for six operations, with the single
   `TimeEntryExportGenerated` row also—and only—counted by the export-audit subset;
6. tests proving the fixed serial Safari-three/Chromium-three allocation, refresh/aggregate stop
   points and read-only Firefox/browser-matrix boundary;
7. tests proving no raw ID/token/password/digest/invitation secret/CSV-body disclosure and exact
   initial/final named aggregate dimensions;
8. startup-failure, runtime-failure and normal cleanup tests;
9. exact Admin-Web production-build manifest and loopback-only listener/proxy proof;
10. complete harness and affected Admin-Web V1/V2, complete V3, exact-head V4 and independent
   exact-SHA review with zero open P0–P3; and
11. a copy-ready separately exact-bound Human V5 authorization package.

## 6. Current gates

- ADO-only candidate: published at `5774ab7971f1c5df6834be44ab556c8138cfcf54`, tree
  `062ded6af067967a3019a7d5abe42428ca58af0e`; CI `30012402185`, attempt 1, passed
  12/12.
- Independent pre-implementation review: `APPROVED`, `MERGE_READY / EXACT-SHA APPROVED`, zero open
  P0–P3; archive:
  `ADO/05_Evidence/Development_Assignment_04_V5_Enablement_Independent_Pre_Implementation_Review.md`.
- Human candidate acceptance and separate exact-baseline R3 implementation authority:
  **granted on `decf806a` / tree `519a1a7`**.
- Executable harness implementation: **authorized, resumed after independent F01 approval, and
  locally V0–V3 green**.
- Human V5: **unauthorized and not run**.
- DA4 closure: unavailable until a separately authorized V5 passes and receives final review.
- Production, production data, deployment and distribution: **unauthorized**.

## 7. Human acceptance, authorized discovery and DA4-V5-F01

The Human Architect accepted the independently approved DA4-V5 candidate and separately authorized
its R3 implementation on exact baseline `decf806aeb2fd1619252a6efd62b71202e53eefb`, tree
`519a1a703bf4c55861b4c25e95cd651b2f7a51ee`, exact-head CI `30013796325`, attempt 1, 12/12.

Local work then passed 17/17 new DA4 unit tests and 13/13 existing Synthetic PostgreSQL tests with
one optional skip. The exact initial aggregate, setup 20/1 and projected Employee 20/1 checks
passed. The real 100-row TimeRecord query returned HTTP 503 before its cursor assertion.

`DA4-V5-F01` is the confirmed cause: both TimeReview reads share `handleTimeReviewRead()`, whose
success response inherits the 16-KiB offline default, while the unchanged Admin Web already accepts
256 KiB for exactly these reads. The review 100-row response is blocked by the same code path; it
was not separately claimed as executed. The Harness WIP is preserved and paused. No proxy or
fixture workaround was used.

The focused R0 correction candidate is
`ADO/02_Development/Development_Assignment_04_V5_F01_Response_Ceiling_Correction_Authorization.md`.
Independent exact-SHA review bound commit `454b751f9668c4c1d526d4f78ad09d1a16e5aba5`,
tree `c69717e50263cbc68da3207685f63bd8ef6b1313`, and CI `30016627509`, attempt 1,
12/12. It returned `APPROVED`, `MERGE_READY / EXACT-SHA APPROVED`, with zero open P0–P3.
The standing rule therefore allowed the narrow correction and Harness continuation.

## 8. Current local R3 evidence

- Backend-API TimeReview real-server-path suite: 6/6 passed. Both realistic 100-item bodies are
  explicitly larger than 16 KiB and no larger than 256 KiB, return HTTP 200 and remain intact;
  both defensive over-256-KiB cases return HTTP 503.
- Focused DA4-V5 unit/adversarial suite: 25/25 passed. It covers exact opt-in and unknown-profile
  rejection, credential digest, single-owner hidden credential input, permanent operator
  fail-stop, strict all-resource cleanup, timezone/DST rejection, manifest/path/drift validation,
  fixed-port production-build serving, same-origin proxy/header isolation, security headers on
  local failures, single-use read fault, write exclusion, listener cleanup and the exact
  Safari-three/Chromium-three aggregate checkpoint sequence.
- Complete Synthetic Harness suite with disposable PostgreSQL: 74/74 passed. The exact fixture is
  21/21/101/101; real API cursor boundaries are setup 20/1 with Customer-before-Tag truth,
  Employees 20/1, TimeRecords 100/1 and review items 100/1. Normal and startup-failure cleanup
  remove schema, migration ledger, generated roles and listeners.
- Backend API and Synthetic Harness tests-inclusive typechecks passed; both builds passed.

V2 passed the complete affected boundaries: Backend API 226/226, Synthetic Harness 74/74 and
protected Admin Web 85/85, with tests-inclusive typechecks and builds for all three.

The first 1,815-test V3 remains transparent pre-correction evidence. Technical-Lead Pre-V4 review
then required seven in-scope corrections: strict cleanup failure truth, permanent no-retry
fail-stop, exclusive Readline ownership, pre-mutation runtime-profile validation, defensive
over-ceiling fixture naming, governance/status truth and local JSON security headers. No Product,
schema, dependency, workflow or Mobile scope was added.

One new final corrected-candidate V3 was then executed:

- clean migrations 001–012 applied and replay/ledger verification passed;
- all locally executable workspace suites passed 1,821 tests with two explicit optional B1
  Supavisor environment skips;
- all 19 workspace tests-inclusive typechecks and all 18 applicable builds passed; and
- the disposable target ended with no `taptime_server` schema, migration ledger or DA4-created B1
  schema; the temporarily created missing `taptime_da3` database and its two runtime roles were
  also removed.

The final workspace invocation reached only the DA3 PostgreSQL workspace without its absent
dedicated local disposable database after all preceding suites had passed. The missing
`taptime_da3` database was created, only the ten blocked DA3 tests were continued and passed, and
the full workspace regression was not duplicated. This was an operational precondition failure,
not a Product failure. Typechecks, builds and cleanup then completed once. No executable file
changed afterward.

V0 final diff/scope, whitespace, reference, authority and protected-path checks passed. V4
publication/CI and independent exact-SHA implementation review remain pending. Human V5,
production, production data, deployment and distribution remain unauthorized.
