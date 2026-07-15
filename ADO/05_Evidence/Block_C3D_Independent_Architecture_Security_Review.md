# Block C3D — Independent Architecture/Security Review and Correction Disposition

Status: **Independent delta re-review APPROVED with zero open P0/P1/P2/P3; exact correction
commit/tree published and exact-head CI passed; Human physical closure pending**
Review Date: 2026-07-15
Reviewed Implementation Commit: `35eb6441688b4c76ea0e89b7f1f2f69decca4a14`
Reviewed Implementation Parent: `0af755a3678c3756cee31579cb563c8977b514af`
Original Implementation CI: GitHub Actions `29396350642` — exact reviewed SHA, ten of ten jobs passed
Correction Commit: `293a0f4ff92fda38616476b66e600cc98fd20cdc`
Correction Tree: `d676669684b9cd3f3a5b5f2c88919e8533de3b7e`
Correction CI: GitHub Actions `29400109183`, attempt 2 — exact correction SHA, ten of ten jobs passed
Owner: Technical Lead

## 1. Independent review result

The Human Architect supplied an independent, read-only final review of the complete
`0af755a..35eb644` C3D implementation diff. The reviewer returned **APPROVED WITH NON-BLOCKING
FINDINGS** and confirmed that C3C remained unchanged, C3E was absent, raw NFC payload remained
outside React/Web/persistence and the shared native NFC arbiter preserved single-owner capture.
The untracked `research/` directory was neither read nor modified.

The review recorded these findings:

| ID | Severity | Finding |
|---|---:|---|
| F-C3D-01 | P2 | Admin Web had no behavioral `AdminWebCoordinator` authority, sign-out, race or create/refresh tests. |
| F-C3D-02 | P3 | Mobile runtime tests omitted stop/failure while `administrationCoordinator.start()` was pending. |
| F-C3D-03 | P3 | Admin Web declared Vite and the React plugin as `latest` instead of the lockfile-resolved versions. |

## 2. Technical-Lead disposition

The Technical Lead did not accept the review's final approval wording. F-C3D-01 covered tests made
mandatory by the C3D authorization and the review simultaneously called that correction mandatory
before the Human physical gate. A mandatory open P2 cannot be treated as non-blocking for technical
closure.

Targeted source verification also identified three concrete dispositions not closed by the review:

| ID | Severity | Disposition |
|---|---:|---|
| C3D-TL-01 | P2 | Serialize complete browser authentication ownership. A late successful sign-in must be cleared after sign-out/generation replacement and must not overwrite a newer attempt. |
| C3D-TL-02 | P2 | Replace post-buffer `response.text()` length checking with incremental 16-KiB reading and cancellation; reject invalid declared lengths. |
| C3D-TL-03 | P2 | Preserve the C3C global cursor in both clients and provide explicit one-page-at-a-time loading; rejecting or discarding `nextCursor` made organizations beyond the first 20 combined items permanently incomplete. |
| C3D-TL-04 | P3 | Correct the evidence label: `316f017` is the authorization decision baseline; `0af755a` is its publication and the implementation parent. |

Technical-Lead verdict on reviewed commit `35eb644`: **CHANGES REQUIRED**. The Human physical gate
remains open as a closure requirement but shall not begin until the correction has passed delta
re-review and exact-head CI.

## 3. Implemented correction

The local C3D correction:

- serializes complete Admin-Web sign-in ownership, immediately invalidates visible state on sign-out
  and safely clears late/stale memory sessions without allowing stale state replacement;
- incrementally reads browser responses, cancels above 16 KiB and rejects invalid length metadata;
- validates the exact C3C cursor shape and exposes one explicit bounded next-page action in Web and
  Android, with Organization consistency, duplicate-ID and non-progress checks;
- adds behavioral Admin-Web Auth, Coordinator, response parser/bound, safe-error, rendered-state,
  accessibility and pagination tests;
- adds Android administration transport success/error/idempotent-replay/parser tests, Coordinator
  error/pagination tests, explicit raw-data source guards and runtime-stop permutations;
- pins `vite` to `8.1.3` and `@vitejs/plugin-react` to `6.0.3`, matching `package-lock.json`; and
- corrects the authorization baseline evidence without changing C3C, schema, backend routes, Core
  Business Rules, C3E or production authority.

## 4. Local correction evidence

- Core: 290/290 tests in 43 files.
- Mobile: 338/338 tests in 22 files.
- Admin Web: 26/26 tests in 5 files.
- Neutral C3 administration contract: 3/3 tests.
- C3C direct PostgreSQL administration regression: 75/75 tests.
- C2/C3C backend API regression: 172/172 tests.
- Core, Mobile, Admin Web, administration-contract, backend-administration and backend-api
  TypeScript checks passed; the Workspace checks include their configured test sources.
- Admin Web production build and Android Expo export passed.
- `npm audit --omit=dev --audit-level=high` reported no high/critical issue; the known moderate Expo
  toolchain `uuid` advisory remains and its forced breaking downgrade is not authorized.
- `git diff --check` passed. No production/personal data or cloud resource was used.

## 5. First independent delta review and correction

The first independent delta re-review confirmed all production corrections but returned
**CHANGES REQUIRED** for one test-only P3, D-DELTA-01. Both `mergeProjection()` implementations
already rejected Organization mismatch, a non-progressing cursor and duplicate IDs, but Android had
only a happy-path pagination test and Web covered only cursor non-progression.

D-DELTA-01 is locally corrected without production-code change. One new behavior test per platform
now drives both an altered Organization and an overlapping Customer ID through the real Coordinator
and asserts the existing fail-closed `unavailable`/`request_failed` result. Current counts are Mobile
338 and Admin Web 26.

## 6. Renewed independent delta re-review

The renewed independent read-only review inspected the unchanged working-tree correction on HEAD
`35eb6441688b4c76ea0e89b7f1f2f69decca4a14`. It confirmed that both new tests drive Organization
mismatch and duplicate Customer IDs through the real Web/Mobile Coordinators and prove the existing
fail-closed outcomes. No production line changed for D-DELTA-01.

The reviewer independently reproduced Core 290/290, Mobile 338/338, Admin Web 26/26, the neutral
administration contract 3/3, all workspace TypeScript checks and `git diff --check`. The Technical
Lead separately reproduced the locally available C3C 75/75 and backend API 172/172 PostgreSQL
matrices, product builds and Android export.

Final renewed-review verdict: **APPROVED — zero open P0/P1/P2/P3**.

## 7. Publication and pending Human gate

The corrected tree was published on `main` as commit
`293a0f4ff92fda38616476b66e600cc98fd20cdc`, tree
`d676669684b9cd3f3a5b5f2c88919e8533de3b7e`. Exact-head GitHub Actions run `29400109183`, attempt
2, passed all ten jobs. Attempt 1 passed all 189 C3B assertions but reported one late PostgreSQL
cleanup connection event (`57P01`) after a forced dirty-database teardown; the failed-job rerun on
the unchanged SHA passed, and neither C3B nor the workflow differed from the previous green head.

The automated prerequisites are therefore satisfied and the Human physical gate may begin. C3D is
not final or closed until that server-connected device/browser gate is recorded as passed.

C3E, Membership CRUD/reassignment, Web/iOS NFC, production operation/data and distribution remain
unauthorized.
