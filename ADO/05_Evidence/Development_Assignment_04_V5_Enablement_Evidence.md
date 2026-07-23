# Development Assignment 4 — V5 Enablement Candidate Evidence

- Status: **ADO-ONLY CANDIDATE — EXECUTABLE ENABLEMENT AND HUMAN V5 UNAUTHORIZED**
- Date: 2026-07-23
- Candidate baseline commit: `4594529667fe1570045eea03fd7132bc27e2e479`
- Candidate baseline tree: `72338ec9b65dabdd71ab9011604817f61c13c288`
- Candidate baseline CI: GitHub Actions `30009920314`, attempt 1, 12/12 successful
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

## 4. Current R0 Change-Impact Record

- Intended behavior: documentation of a later optional V5 fixture, exact Human procedure and
  gates; no runtime behavior.
- Affected files: ADO Markdown only.
- Executable/schema/dependency/configuration/workflow/artifact impact: none.
- Selected verification: AVS V0.
- V1–V4: not run for this R0 candidate; carried product evidence is identified above.
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

- ADO-only candidate drafting: authorized and represented by this delta.
- Candidate publication/CI: not performed by this worktree.
- Executable harness implementation: **unauthorized**.
- Human V5: **unauthorized and not run**.
- DA4 closure: unavailable until a separately authorized V5 passes and receives final review.
- Production, production data, deployment and distribution: **unauthorized**.
