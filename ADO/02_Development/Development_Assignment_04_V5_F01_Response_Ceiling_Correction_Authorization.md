# Development Assignment 4 — DA4-V5-F01 Response-Ceiling Correction Candidate

- Status: **INDEPENDENTLY APPROVED — LOCAL R3 V0–V3 GREEN; V4/REVIEW PENDING**
- Date: 2026-07-23
- Exact baseline commit: `decf806aeb2fd1619252a6efd62b71202e53eefb`
- Exact baseline tree: `519a1a703bf4c55861b4c25e95cd651b2f7a51ee`
- Exact-head CI: `30013796325`, attempt 1, 12/12 successful
- Reviewed candidate commit: `454b751f9668c4c1d526d4f78ad09d1a16e5aba5`
- Reviewed candidate tree: `c69717e50263cbc68da3207685f63bd8ef6b1313`
- Candidate exact-head CI: `30016627509`, attempt 1, 12/12 successful
- Owner: Technical Lead
- Decision authority: Human Architect
- Risk class: current ADO delta R0; proposed executable correction R3

## 1. Finding and disposition

The authorized DA4-V5 harness work reproduced `DA4-V5-F01`: a real 100-row
`/v1/administration/time-records/query` response exceeds 16 KiB and is replaced with HTTP 503.
`/v1/administration/review-items/query` uses the same success handler and has the same defect for
its accepted 100-row page.

Repository truth explains the mismatch:

- both accepted requests use a maximum page size of 100;
- Admin Web already permits `256 * 1024` response bytes for exactly these two reads; but
- `handleTimeReviewRead()` sends successful results through `respondJson()` without a specific
  ceiling, so it inherits the unrelated `OFFLINE_RESPONSE_MAXIMUM_BYTES` default of 16 KiB.

This is a technical response-ceiling defect, not a new Product or Business rule. The accepted
21/21/101/101 DA4-V5 fixture and 100/1 pagination arithmetic cannot be proved through the real
Product route until it is corrected. Proxy response reconstruction, reduced page sizes or fixture
payload manipulation are prohibited because they would not be Product evidence.

## 2. Proposed executable scope

After independent approval of this candidate with zero open P0–P3, the narrow executable delta is
limited to:

1. `apps/backend-api/src/BackendHttpServer.ts`;
2. `apps/backend-api/tests/TimeReviewApi.test.ts`; and
3. continuation of the already authorized DA4-V5 Synthetic Harness and truthful ADO evidence.

If repository truth requires a different existing Backend-API TimeReview test file, the Technical
Lead must record the exact file and reason before implementation. No other Product file is
authorized.

## 3. Correction contract

The correction SHALL:

- define one named server-side TimeReview-read response maximum of exactly `256 * 1024` bytes;
- apply it only to successful `handleTimeReviewRead()` responses for TimeRecord query and review
  item query;
- retain the existing 100-row request limit and unchanged response bodies;
- leave errors, authority failures, all write routes, offline response defaults and every other
  route unchanged; and
- fail closed with HTTP 503 when either successful serialized TimeReview-read body exceeds
  256 KiB.

No proxy, fixture or client workaround is allowed.

## 4. Required regression evidence

Backend-API tests must exercise the real server response path and prove:

- realistic 100-item TimeRecord and 100-item review responses larger than 16 KiB but no larger
  than 256 KiB return HTTP 200 with intact bodies;
- either TimeReview-read response larger than 256 KiB returns HTTP 503;
- existing small success, malformed request, authority rejection and unavailable behavior remains
  unchanged; and
- TimeReview writes plus every non-TimeReview route retain their existing ceiling and behavior.

The already authorized Harness must then resume and prove both real 100/1 cursor boundaries.

## 5. Discovery evidence

The paused local R3 work produced only development evidence:

- new focused DA4-V5 unit tests: 17/17 passed;
- existing Synthetic PostgreSQL tests: 13/13 passed with one explicit optional skip;
- exact DA4 initial aggregate, setup 20/1 and projected Employee 20/1 checks passed; and
- the first real 100-row TimeRecord query returned HTTP 503.

The review query shares the same `handleTimeReviewRead()` and `respondJson()` success path. It was
not falsely reported as executed after the first deterministic blocker. The uncommitted Harness
work is preserved and paused; none of it is part of this R0 candidate.

## 6. Verification and review

The executable correction is AVS R3:

- V1: focused response-ceiling and route-isolation regressions;
- V2: complete Backend API and Synthetic Harness affected boundaries, tests-inclusive typechecks
  and builds;
- V3: one complete locally executable repository regression;
- V4: focused publication, complete exact-head CI and independent exact-SHA implementation review.

The current five-file ADO candidate is R0 and receives V0 only.

Independent read-only exact-SHA review bound candidate `454b751f9668c4c1d526d4f78ad09d1a16e5aba5`,
tree `c69717e50263cbc68da3207685f63bd8ef6b1313`, and CI `30016627509`, attempt 1,
12/12. Verdict: `APPROVED`, `MERGE_READY / EXACT-SHA APPROVED`, zero open P0–P3.

The focused local correction now uses the named 256-KiB maximum only for the successful
TimeReview-read branch. Its real-server-path suite passes 6/6, including intact realistic
100-item responses above 16 KiB and fail-closed responses above 256 KiB for both query routes.
The resumed complete candidate passes local R3 V0–V3; V4 and independent exact-SHA
implementation review remain pending.

## 7. Authority and exclusions

This candidate did not authorize executable change by itself. Its required independent review
returned `APPROVED` with zero open P0–P3, so the documented Human standing rule permitted the
Technical Lead to implement this exact technical correction and resume the already authorized
DA4-V5 work without another confirmation prompt. That rule cannot supply a missing Product,
Business, Architecture or wider Scope decision.

Schema, migrations, contracts, Admin Web, dependencies, lockfile, workflows, Mobile, Android, NFC,
ADB, Human V5, production, production data, deployment and distribution remain unchanged or
separately unauthorized. `research/` remains protected.
