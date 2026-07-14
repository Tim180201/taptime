# Block C3C — Independent Architecture and Security Review

Status: Completed — pre-implementation, local post-correction, independent precommit and three
independent exact-SHA final-review tracks passed with zero open P0/P1/P2/P3
Pre-implementation Review Date: 2026-07-14
Local Mid-review Date: 2026-07-15
Independent Database/Security Precommit Re-review Date: 2026-07-15
Independent Exact-SHA Final Review Date: 2026-07-15
Reviewed Baseline: `c1148d57edb12312a102f090715c4b28308f6347`
Baseline CI: GitHub Actions `29364210818` — exact-head nine of nine jobs passed
Reviewed Implementation Commit: `b90729a0a4b325f523cd98ea5a741defb00155f6`
Reviewed Implementation Tree: `671be72784f68b9437a9f53e251acbbb22ce3e97`
Implementation CI: GitHub Actions `29375259275` — exact implementation SHA, ten of ten jobs passed
Review Type: Three independent read-only pre-implementation tracks, Technical-Lead local
implementation mid-review, independent database/security precommit re-review and independent
exact-SHA database/security, governance/CI and complete-diff final tracks
Owner: Technical Lead

## 1. Scope and independence

Independent database/security, API/application and governance/CI reviewers inspected the accepted
C3A contract, C3B boundary, migrations `001`–`006`, B4–B6/C2 runtime patterns and the proposed C3C
boundary. They changed no file. The pre-existing untracked `research/` directory was neither read
nor modified.

The initial governance track returned CHANGES REQUIRED because C3C remained marked unauthorized
and the exact transport, pagination, name ownership/backfill and closure contract were not frozen.
The Human Architect then explicitly authorized C3C on the exact baseline; TS-002 v1.3 and the C3C
authorization disposition those blockers before implementation publication.

## 2. Consolidated pre-implementation findings

| ID | Severity | Finding | Binding disposition |
|---|---:|---|---|
| C3C-PRE-01 | P1 | Existing audit trigger silently ignores setup-role writes. | Fail-closed allowlist for setup Customer/Tag/Assignment INSERT only; derived actor, null operator, command UUID, empty payload. |
| C3C-PRE-02 | P1 | Existing Administrator/B5 surface is too broad. | Fourth distinct login with exactly identity-resolver plus narrow setup role; no broad role or unrelated rights. |
| C3C-PRE-03 | P1 | B6 mismatch/requested-Organization semantics are wrong for administration. | New coordinator; no Organization input; absent authority 401, Employee/stale expected Membership 403 before receipt/resources. |
| C3C-PRE-04 | P1 | Node-only name/payload validation and SELECT-before-INSERT lose database/race authority. | SQL-authoritative canonical names/digests, setup-only UID insert guard and conflict-safe inserts. |
| C3C-PRE-05 | P2 | Receipt access cannot occur while still using identity-resolver privileges. | Actor lock/narrowing and command lock first; set derived context and setup role before receipt access. |
| C3C-PRE-06 | P2 | Tag table-wide SELECT leaks raw canonical payloads. | Stored generated safe fingerprint and column-only reads; no payload SELECT. |
| C3C-PRE-07 | P2 | Promise-race HTTP timeout can leave a write running. | Propagated deadline, DB lock/statement/transaction timeouts, pre-commit check and rollback/release proof. |
| C3C-PRE-08 | P2 | Receipt rejection persistence and response replay were undefined. | Success-only receipt with fixed ID shape; business rejections create no receipt/audit; mutation replay returns only stored safe result. |
| C3C-PRE-09 | P2 | Payload versus target precedence and target race were incomplete. | Exact/divergent receipt first, then payload conflict, then active Customer locked `FOR SHARE`; rollback all attempted writes on failure. |
| C3C-PRE-10 | P2 | Cursor/order/response bound was undefined. | One v1 global cursor; Customers then Tags by UUID; combined limit 1–20; cursor <=256 bytes; encoded response <16 KiB. |
| C3C-PRE-11 | P2 | Display-name change ripples through all fixtures and old grants. | Required Domain fields, ID-only ASCII backfill, explicit seed updates and only the needed historic insert-column extension. |
| C3C-PRE-12 | P2 | C3C remained canonically unauthorized and exact HTTP/success contract was absent. | Explicit Human authorization on `c1148d57`, exact three routes/results in authorization and TS-002 v1.3. |
| C3C-PRE-13 | P3 | Copying the privileged C3B name/digest code risks drift; importing bootstrap couples trust planes. | Neutral pure administration-contract workspace with stable C3B wrappers and shared golden vectors. |
| C3C-PRE-14 | P3 | Existing API README already understates its E2A route count. | Correct the README to describe the complete route inventory when C3C transport is added. |
| C3C-PRE-15 | P3 | Projection transaction cannot be B5 READ ONLY because authority resolver takes row locks. | Ordinary transaction with locked authority, fixed safe SELECT only and zero-write tests. |

No finding is waived. Duplicate observations from multiple reviewers are consolidated above at the
highest reported severity. Raw reviewer totals were: database track 0 P0 / 0 P1 / 7 P2 / 3 P3;
API track 0 P0 / 4 P1 / 5 P2 / 1 P3; governance track 0 P0 / 0 P1 / 3 P2 / 1 P3.

## 3. Pre-implementation verdict

Verdict: **PASS TO IMPLEMENT ONLY WITH THE C3C AUTHORIZATION AND ALL DISPOSITIONS ABOVE**.

The former governance CHANGES REQUIRED verdict is satisfied by the exact-baseline Human
authorization, TS-002 v1.3 amendment and fixed block contract. Implementation must still prove every
disposition. This verdict does not approve final code, close C3C, authorize C3D/C3E or grant
production authority.

## 4. Local implementation mid-review

Local Node-24/PostgreSQL-17 verification exercised every pre-review disposition. Iterative
Technical-Lead and independent precommit review exposed the following concrete defects, all
corrected before publication:

| ID | Corrected implementation finding |
|---|---|
| C3C-IMPL-FIX-01 | Replaced the NUL-bearing advisory-key encoding rejected by PostgreSQL `text` with unambiguous length-framed NUL-free text. |
| C3C-IMPL-FIX-02 | Replaced direct conflict insert requiring raw-payload `SELECT` with a fixed least-privilege `SECURITY DEFINER` Tag-insert capability. |
| C3C-IMPL-FIX-03 | Replaced direct Customer `FOR SHARE` requiring broad privilege with a fixed safe active-Customer-lock capability. |
| C3C-IMPL-FIX-04 | Added temporary client-error handling, deadline/health guards and destruction of clients terminated by PostgreSQL `transaction_timeout`. |
| C3C-IMPL-FIX-05 | Made SQL normalize the original name through a CTE and closed `NULL`/three-valued comparison gaps with explicit `NULL` and `IS DISTINCT FROM` checks. |
| C3C-IMPL-FIX-06 | Replaced generic receipt-conflict throwing with deterministic re-read, exact/divergent classification and rollback proof. |
| C3C-IMPL-FIX-07 | Extended contamination proof to `pg_shdepend`, `pg_db_role_setting` for all three internal roles and reset schema ACL state. |
| C3C-IMPL-FIX-08 | Made Organization names database-canonical and setup projection fail-closed across SQL and Node. |
| C3C-IMPL-FIX-09 | Removed synthetic Core display-name defaults and made every Customer/Tag construction explicit. |
| C3C-IMPL-FIX-10 | Added trigger-only receipt integrity that binds the full digest, exact resources and exact audits under minimal column grants. |
| C3C-IMPL-FIX-11 | Made replay remap stored Customer/Tag/Assignment resources before returning safe results. |
| C3C-IMPL-FIX-12 | Added the missing boundary, duplicate, cross-Organization, payload/target race and lock-to-commit PostgreSQL matrix. |
| C3C-IMPL-FIX-13 | Added real HTTP/JWT/fourth-pool/PostgreSQL lost-response retry proof. |
| C3C-IMPL-FIX-14 | Re-read a receipt raced after initial miss when the Tag insert loses, with exact/divergent tests. |
| C3C-IMPL-FIX-15 | Added direct-coordinator runtime type closure for non-string canonical payloads. |
| C3C-IMPL-FIX-16 | Restored C3B compatibility through exactly one normalizer capability grant and exact ACL/dependency proof. |
| C3C-IMPL-FIX-17 | Made a `NULL` SQL name kind explicitly fail closed. |
| C3C-IMPL-FIX-18 | Proved exact Customer replay after Customer deactivation and exact Tag replay after Assignment/target deactivation. |
| C3C-IMPL-FIX-19 | Synchronized package, README and CI labels/dependencies with the implemented graph. |

Post-correction local status: every reported finding is corrected. The independent precommit
database/security re-review returned **PASS — zero open P0/P1/P2/P3**.

The complete local matrix is recorded in
`ADO/05_Evidence/Block_C3C_Normal_Administration_Backend_Evidence.md`. This mid-review is not an
independent final approval and does not close C3C.

## 5. Independent final review

The final review inspected exact implementation commit
`b90729a0a4b325f523cd98ea5a741defb00155f6`, parent
`c1148d57edb12312a102f090715c4b28308f6347` and tree
`671be72784f68b9437a9f53e251acbbb22ce3e97`. The tree matched the post-correction precommit state;
migrations `001`–`006` remained byte-identical and migration `007` had exact SHA-256
`c64c22ac915f5bc29857a8fac1a316586af47d70e8eb34926b8ce6ad8063f595`.

Three independent read-only final tracks returned **APPROVED**:

- database/security exact-SHA review verified migration `007`, roles, ACLs, RLS, capability owners,
  receipt integrity, audit provenance, concurrency/race behavior and C3B compatibility;
- governance/CI exact-SHA review verified ADO, README, package, workflow, test-count, link, scope and
  non-closure claims; and
- complete implementation-diff review verified the entire authorized source/diff/evidence boundary
  without scope expansion.

Final open severity is **P0 = 0, P1 = 0, P2 = 0, P3 = 0**. No finding was waived.

GitHub Actions run `29375259275` is a completed successful `push` run on `main` with `headSha`
exactly `b90729a0a4b325f523cd98ea5a741defb00155f6`. All ten defined jobs completed successfully, and
the logs align with the complete 1,394-test matrix.

Final verdict: **APPROVED FOR C3C REPOSITORY CLOSURE**.

This approval grants no production/cloud/data authority and no C3D/C3E, Admin Web, Android capture,
Membership CRUD or reassignment authority. The ADO-only closure-publication commit and its exact-head
CI remain pending and are not represented by the implementation commit/run above.
