# Development Assignment 2 — Local Implementation Evidence

- Status: **LOCAL IMPLEMENTATION CANDIDATE TECHNICAL-LEAD APPROVED — AVS V0–V3 GREEN; V4 EXACT-HEAD CI AND INDEPENDENT EXACT-SHA REVIEW PENDING**
- Date: 2026-07-21
- Authorized Baseline Commit: `30c4f5d1d8e6fedeb4b6c1f168d6e1f70a4fef76`
- Authorized Baseline Tree: `242331b6a34cd19a16fd8a9bea993b2349cbb6dc`
- Authorized Baseline CI: GitHub Actions `29843878706`, attempt 1, 10/10 successful
- Local Candidate Commit/Tree: pending focused publication
- Owner: Technical Lead
- Risk Class: AVS-001 R3
- Production/Production Data/Deployment/Distribution/Physical Gate/UI Productization: **UNAUTHORIZED**

## 1. Implemented scope

The local candidate implements the Human-accepted ADR-0013 and DA2-P01–DA2-P12 without changing
Core BusinessEngine decisions, Mobile/Admin-Web product behavior or existing C3 authority:

1. `@taptime/time-entry-export-contract` freezes request validation, exact schema/header order,
   deterministic UTF-8-BOM/semicolon/CRLF/quoted CSV, formula neutralization, stable ordering and
   31-day/10,000-row/8-MiB limits.
2. migration `011_tenant_safe_time_entry_export.sql` preserves migrations `001`–`010` and the
   permanent `memberships_organization_user_unique`, adds isolated NOLOGIN roles, forced-RLS
   policies, column-only grants, current-Administrator authority and a success-only generation audit
   capability.
3. `@taptime/backend-time-export` resolves current server authority, narrows by the exact expected
   Membership, reads one repeatable snapshot through the export role, fails closed on missing
   historical attribution, serializes/hashes/audits atomically and returns bytes only after commit.
4. the private backend API adds exactly `POST /v1/administration/time-entries/export`, one distinct
   validated runtime database login/pool, strict exact-body parsing, fixed status mapping and
   no-store/nosniff/sanitized attachment output.
5. the synthetic DA2 journey uses public C3B/C3C/C3E1/C3E2/B6/export coordinators with distinct
   least-privilege logins. It bootstraps an Organization, creates two Customers, provisions one Tag,
   enrolls an Employee, creates a stopped TimeEntry for Customer A, explicitly reassigns, creates a
   stopped TimeEntry for Customer B, exports both historical truths and removes schema, ledger and
   all journey roles.
6. CI gains an isolated Node-24/PostgreSQL-17 DA2 job; the neutral contract also runs in Quality and
   existing API/synthetic jobs build the new dependencies.

## 2. DA2-P01–DA2-P12 evidence map

| Contract | Evidence |
|---|---|
| P01 current Administrator only | identity lock, exact expected-Membership check, RLS authority function, Employee/stale/revoked/API status tests |
| P02/P03 started and stopped rows | direct PostgreSQL stopped/started tests and snapshot race test |
| P04/P05 UTC/range/duration | exact request validator, SQL UTC formatting/difference and golden/output assertions |
| P06/P07 exact columns and sole retained Membership | fixed header contract, same-Organization/User join, permanent-constraint assertion, revoked-row and missing-row rollback tests |
| P08 bounded range/rows/bytes | validator plus 10,001-row and greater-than-8-MiB fail-closed tests |
| P09 CSV/formula safety | golden vectors for BOM, semicolon, CRLF, quoting, Unicode and first-non-whitespace formula prefixes |
| P10 ordering/empty result | deterministic repetition/order tests and header-only audited export |
| P11 audit/hash truth | exact byte hash/metadata tests, audit-insert rollback and no-row-value assertions |
| P12 no retained artifact/safe response | in-memory bytes only, fixed filename, no-store/no-cache/nosniff API tests |

## 3. Failure, race and least-privilege evidence

- cross-tenant data is filtered by server-derived Organization and forced RLS;
- direct role access is default-deny outside exact columns/policies/functions;
- absent identity, Employee authority, stale expected Membership and later revocation fail safely;
- corrupted missing Membership attribution yields complete `service_unavailable`, zero bytes and zero
  success audit;
- Stop-after-snapshot preserves a truthful started row from one repeatable snapshot;
- active work blocks reassignment in the reused C3E2 boundary; after Stop, A-before/B-after history
  is immutable and exported as two rows;
- audit failure rolls back the request, row/byte limits never truncate success and pool reuse carries
  no role/tenant/context state; and
- the journey and existing synthetic Android harness complete disposable cleanup.

## 4. AVS V0–V3 verification

All checks below passed on 2026-07-21 against PostgreSQL 17 and Node 24:

| Surface | Result |
|---|---:|
| TimeEntry export contract | 10/10 |
| DA2 PostgreSQL/export/integration | 13/13 |
| Backend API | 220/220 |
| Backend schema | 125/125 |
| Backend identity | 55/55 |
| Backend read model | 42/42 |
| Backend lifecycle | 88/88 |
| Backend bootstrap | 189/189 |
| Backend administration | 121/121 |
| Existing synthetic Android E2E | 45/45 |
| Core | 290/290 |
| Mobile | 419/419 |
| Admin Web | 44/44 |
| Offline contract/backend | 20/20 |
| **Total** | **1,681/1,681** |

Additionally passed:

- tests-inclusive TypeScript checks for every affected workspace and root Core/Mobile/Admin Web;
- all workspace builds;
- clean migration `001`–`011` apply, rerun, immutable ledger and 125-case schema-security matrix;
- Android Expo export;
- CI YAML parse and `git diff --check`; and
- complete Technical-Lead source/diff/claim/security/dependency review.

`npm audit` still reports the already disclosed 11 moderate transitive `uuid@7.0.3` occurrences in
the Expo/Xcode toolchain. The DA2 lockfile delta adds only the two local workspaces and their existing
development type packages; it adds no new third-party runtime package. Applying the offered forced
audit remediation would make an unrelated breaking Expo downgrade and is outside DA2.

## 5. Scope and closure truth

- Workstreams A–D are locally implemented and Technical-Lead approved.
- DT-063–DT-066 remain open until independent review confirms that the composed local setup scope
  may close without implying new UI/physical/production capability.
- DT-067/DT-068 remain open until the export-backend implementation passes V4 and independent
  exact-SHA review.
- DA2 is not closed by this local evidence.
- No production resource/data, deployment, distribution, Physical Gate, legal-retention approval,
  Admin Web download UI, correction/payroll behavior or server-side export artifact is claimed.

## 6. Remaining mandatory gates

1. publish one focused Technical-Lead-approved implementation commit;
2. bind its exact SHA/tree and pass all eleven GitHub Actions jobs (AVS V4);
3. obtain an independent exact-SHA implementation review with every P0–P3 finding dispositioned;
4. correct and re-review if required; and
5. only then prepare exact-scope DA2/DT closure evidence.
