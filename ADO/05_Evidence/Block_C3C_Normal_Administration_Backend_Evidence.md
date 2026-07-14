# Block C3C — Normal Administration Backend/API Implementation Evidence

Status: Local implementation and Technical-Lead verification passed — independent final review,
implementation commit/head and exact-head ten-job GitHub CI pending
Evidence Date: 2026-07-15
Authorized Baseline: `c1148d57edb12312a102f090715c4b28308f6347`
Runtime Under Test: Node.js 24 and PostgreSQL 17
Owner: Technical Lead
Authority: `ADO/02_Development/Block_C3C_Normal_Administration_Backend_Authorization.md`

## 1. Evidence boundary

This document records local implementation evidence for the authorized C3C slice only. It is not a
closure and does not claim an implementation commit, published implementation head, exact-head CI
run, independent final approval, C3D/C3E authority or production readiness. Those gates remain
pending and must be recorded only from their real identifiers and results.

The implementation remains bound to the exact baseline and contract in the C3C authorization:

- additive migration `007` and unchanged migrations `001`–`006`;
- required Customer and NfcTag display names plus shared Unicode-15.1 name/digest contract;
- fourth distinct least-privilege normal-administration database pool and role boundary;
- current server-derived Administrator plus exact expected-Membership narrowing;
- atomic create-Customer and register-plus-assign commands with success-only receipts and audit;
- bounded safe setup projection and the exact three `/v1/administration/` routes;
- no raw canonical NFC payload in responses, receipts, audit payloads or normal diagnostics.

No Admin Web, Android Administrator capture UI, Membership CRUD, invitations, role changes,
reassignment, delete/update, production infrastructure/data or C3D/C3E behavior is included.

## 2. Local implementation result

The local implementation contains the authorized neutral administration contract, migration `007`,
isolated normal-administration coordinator, API/runtime integration, fourth pool, strict transport
parsing and a dedicated tenth PostgreSQL-backed CI job definition. Customer creation, atomic Tag
registration/assignment, idempotent success replay, divergent-command rejection and safe paginated
projection are covered through the database and HTTP boundaries.

Authority remains server-derived. The normal setup login receives neither the broad Administrator
role nor generic SQL, Membership mutation, lifecycle mutation, delete/update, raw-payload read or
bootstrap capability. Projection returns safe names, IDs, state and the stored validation
fingerprint only.

## 3. PostgreSQL integration findings corrected before publication

Iterative Technical-Lead and independent precommit review found the concrete defects below. Every
reported finding is corrected and none is waived.

| ID | Finding observed during integration | Corrective disposition and proof |
|---|---|---|
| C3C-IMPL-FIX-01 | PostgreSQL `text` rejects NUL in the advisory-lock key (`22021`). | The command-lock key is now unambiguous length-framed, NUL-free text; command serialization and replay tests pass. |
| C3C-IMPL-FIX-02 | Direct `INSERT ... ON CONFLICT` against payload uniqueness required forbidden raw-payload `SELECT` (`42501`). | A fixed `SECURITY DEFINER` Tag-insert capability owns only that insert/conflict decision; the setup role still has no raw-payload read. |
| C3C-IMPL-FIX-03 | Direct active-Customer `FOR SHARE` required a forbidden broad table privilege (`42501`). | A fixed `SECURITY DEFINER` active-Customer-lock capability returns only the availability decision needed by provisioning. |
| C3C-IMPL-FIX-04 | PostgreSQL `transaction_timeout` can terminate the session with `FATAL`, leaving client-error handling unsafe. | A temporary client error listener, health/deadline guards and mandatory destruction of a failed client prevent reuse and preserve rollback/release behavior. |
| C3C-IMPL-FIX-05 | SQL previously received the Node-canonicalized name rather than the original input, while SQL `NULL` three-valued comparisons could leave authority gaps. | SQL now normalizes the original name in a CTE; explicit `NULL` and `IS DISTINCT FROM` checks require Node/SQL canonical-name and digest agreement. |
| C3C-IMPL-FIX-06 | Receipt `ON CONFLICT` used a generic throw and did not deterministically classify the race. | The coordinator re-reads the receipt, distinguishes exact replay from divergent conflict and rolls back local writes; four adversarial tests cover the corrected path. |
| C3C-IMPL-FIX-07 | Role-contamination checks covered membership edges but not database role settings or all schema ACL state. | Tests now inspect `pg_shdepend`, explicitly reject `pg_db_role_setting` contamination for all three internal roles and reset schema ACLs; four contamination tests pass. |
| C3C-IMPL-FIX-08 | Organization names were neither database-canonical nor fail-closed in the setup projection. | Migration `007` adds the shared canonical-name constraint; projection checks both SQL and Node contracts and invalid pre-`007` data blocks migration until remediated. |
| C3C-IMPL-FIX-09 | Core Customer/Tag display-name defaults could silently create synthetic production labels. | Both Domain shapes now require explicit names; every composition/fixture supplies one and persistence/event tests protect the value. |
| C3C-IMPL-FIX-10 | A setup login could otherwise insert a syntactically valid success receipt not bound to the actual resources, digest and audits. | An `AFTER INSERT`, trigger-only, minimal-column `SECURITY DEFINER` integrity capability recomputes the full digest and requires exact resource and audit provenance. |
| C3C-IMPL-FIX-11 | Receipt replay initially trusted stored result IDs without independently remapping their resource relation. | Customer and Tag replay now verify exact Organization/name/resource/Assignment binding and only the safe derived fingerprint before returning stored success. |
| C3C-IMPL-FIX-12 | Boundary, duplicate-name, cross-Organization command, same-payload concurrency and target-lock races lacked direct coverage. | PostgreSQL tests now cover exact name limits, legitimate duplicates, Organization-scoped receipts, payload races, rollback, deactivation and lock-to-commit behavior. |
| C3C-IMPL-FIX-13 | Lost-response proof stopped below the real HTTP/JWT/database composition. | A real route-to-JWT-to-fourth-pool-to-PostgreSQL test destroys the socket after the local write, then proves exact retry and single Customer/receipt/audit persistence. |
| C3C-IMPL-FIX-14 | A receipt committed after the initial lookup but before a conflicting Tag insert could be misclassified as payload conflict. | The insert-conflict branch re-reads and securely maps the raced receipt; exact and divergent post-miss races are deterministic tests. |
| C3C-IMPL-FIX-15 | Direct non-HTTP coordinator callers could pass a non-string payload into Core and receive an exception. | Runtime type checking now precedes canonical-payload parsing; missing and numeric adversarial values return `invalid_request`. |
| C3C-IMPL-FIX-16 | The new Organization-name constraint broke C3B because its isolated function owner lacked normalizer execution. | Exactly one minimal normalizer `EXECUTE` grant was added to the bootstrap function owner with exact ACL/dependency proof; C3B passes 189 tests. |
| C3C-IMPL-FIX-17 | SQL `NOT IN` treated a `NULL` name kind as unknown and fell into the Tag branch. | `requested_kind IS NULL` is explicitly fail-closed and covered by the shared SQL-contract test. |
| C3C-IMPL-FIX-18 | The normative promise that exact success replay survives later resource deactivation lacked a direct regression. | Customer and Tag/Assignment tests deactivate the stored resources after success and prove the exact retry returns the original success without new rows, audits or receipts. |
| C3C-IMPL-FIX-19 | Package/README/CI labels and dependencies understated the complete C3C boundary. | Unused dependency/constant hygiene, dependency prebuild instructions, trigger documentation and C2/C3C CI labels now match the actual graph. |

All findings reported through this local precommit checkpoint are corrected. The independent
database/security track returned **PASS with zero open P0/P1/P2/P3**. This remains local precommit
evidence, not the independent final review against a published implementation SHA.

## 4. Local verification matrix

All counts below were observed locally on Node.js 24/PostgreSQL 17 after the corrections above.

| Verification target | Result |
|---|---:|
| `@taptime/administration-contract` | 3 passed |
| `@taptime/core` | 290 passed |
| `@taptime/mobile` | 310 passed |
| B1 managed-Node PostgreSQL matrix | 39 passed; 2 external Supavisor modes skipped |
| `@taptime/backend-schema` | 125 passed |
| `@taptime/backend-identity` | 55 passed |
| `@taptime/backend-read-model` | 42 passed |
| `@taptime/backend-lifecycle` | 88 passed |
| `@taptime/backend-bootstrap` | 189 passed |
| `@taptime/backend-administration` | 75 passed |
| `@taptime/backend-api` | 172 passed |
| `@taptime/synthetic-android-e2e` | 6 passed |
| **Total executed tests** | **1,394 passed** |

The two B1 Supavisor skips are the standing external-mode limitation and are not counted as passes.

Additional local verification passed:

- every workspace typecheck;
- every workspace build;
- Android export;
- CI workflow YAML validation with exactly ten defined jobs, including the isolated C3C
  PostgreSQL-17/Node-24 job;
- migration ledger/order/repeat checks through `001`–`007`;
- byte/diff verification that migrations `001`–`006` are unchanged from the authorized baseline;
- repository `git diff --check` whitespace/error validation;
- strict route, authorization, idempotency, concurrency, rollback, role/ACL, pagination,
  response-bound and raw-payload non-disclosure matrices recorded by the C3C tests.

## 5. Gate status

| Gate | State |
|---|---|
| Human authorization on exact baseline | Passed |
| Independent pre-implementation review | Passed with all dispositions implemented locally |
| Local implementation and regression verification | Passed |
| Technical-Lead post-correction mid-review | Passed; every reported finding corrected |
| Independent precommit database/security re-review | Passed; zero open P0/P1/P2/P3 |
| Implementation commit and exact implementation head | **Pending — no SHA recorded** |
| Independent final architecture/security/governance review | **Pending** |
| Exact-head GitHub Actions CI | **Pending — no run ID recorded; ten of ten required** |
| C3C closure | **Not created / not authorized yet** |

C3D, C3E, production deployment and production personal data remain gated. DT-063–DT-066 remain
open until the complete operational setup surfaces and their required human/device validation have
been implemented and approved.
