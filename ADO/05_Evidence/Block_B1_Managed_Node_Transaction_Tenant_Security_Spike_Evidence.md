# Block B1 — Managed Node Transaction and Tenant Security Spike Evidence

Status: Completed — Technical Lead Approved, B2 Authorized, Not Production Ready
Date: 2026-07-13
Architecture Authority: `ADO/01_Architecture/ADR/ADR-0008-backend-tenant-isolation-and-async-foundation.md`
Plan: `ADO/02_Development/Block_B1_Managed_Node_Transaction_Tenant_Security_Spike_Plan.md`

## 1. Review Verdict and Correction Status

The first Technical Lead review returned `CHANGES REQUIRED`. It correctly identified three security gaps: operation-wide grants/policies did not make evidence immutable, RLS SELECT was Organization-wide rather than User-scoped, and lifecycle tests used the privileged schema-owner pool. The first correction closed those gaps.

The second Technical Lead finding identified a remaining referential-integrity gap: Organization-qualified foreign keys could still associate User A's rows with User B's WorkEvent or TimeEntry inside the same Organization. The second correction adds owning-User-qualified unique keys and foreign keys to every lifecycle relationship. Same-Organization User isolation is described as complete only after this referential correction.

The corrected direct PostgreSQL test suite passes locally and in GitHub Actions. It proves operation-specific immutable evidence, RLS and referential same-Organization User isolation, and a separate least-privilege runtime login. Renewed Technical Lead review accepts the evidence; GitHub Actions run `29220424071` passed both required jobs. B1 is complete and B2 is authorized within the conditions below.

This is disposable technical evidence, not a production backend, schema migration, repository adapter, authentication integration or cloud deployment. No Supabase resource or real-person data was used.

## 2. Tested Stack

| Component | Actually tested |
|---|---|
| Runtime | Node.js `24.17.0` |
| Package manager | npm `11.13.0` |
| TypeScript | `6.0.3` workspace range |
| PostgreSQL driver | `pg` `8.22.0` |
| Direct database | PostgreSQL `17.10 (Homebrew)`, local disposable database |
| Core | Repository-local `@taptime/core`, imported through its public package entry point |
| Installer access | Separate privileged local pool used only for role/schema setup, cleanup and cross-user aggregate assertions |
| Runtime access | `taptime_b1_runtime` login: `NOINHERIT`, non-owner, non-superuser, no `BYPASSRLS`; membership only in `taptime_b1_app` |
| CI database definition | Official `postgres:17.10-alpine` service image; workflow added but no GitHub-hosted run exists in this uncommitted task |

The backend build bundles the unchanged source-published Core into the disposable Node artifact and leaves `pg` external. A direct Node 24 import of `dist/index.js` succeeded after build. This spike packaging is not a production Core packaging decision.

## 3. Transaction and Tenant-Security Design

The privileged installer creates the disposable schema and roles before the runtime pool is used. It supplies a synthetic password from test/CI environment input without logging it. The runtime login owns no schema/table, cannot create roles/schemas or alter policies, has no direct table access, and can only enter the non-login application role through explicit `SET ROLE`.

One runtime `BEGIN`/`COMMIT` boundary performs the following:

1. `SET LOCAL ROLE taptime_b1_app` selects the non-login, non-owner RLS role.
2. `set_config(..., true)` sets Organization and User only for the current transaction.
3. `pg_advisory_xact_lock(hashtextextended(organizationId + separator + userId, 0))` serializes the Organization/User lifecycle key. No session advisory lock exists.
4. Existing WorkEvent canonical hash is checked for identical retry or conflicting reuse.
5. Active TimeEntry and previous same-target WorkEvent are loaded under RLS; the active row is additionally row-locked.
6. The real Core `BusinessEngine.evaluate(...)` returns start, stop, duplicate, other-target rejection or escalation.
7. The transaction writes WorkEvent, any Core-directed TimeEntry mutation, WorkEventDecision, SyncReceipt and AuditEvent.
8. Commit exposes all evidence together; any error rolls every stage back.

SQL enforces only storage/security invariants: Organization-qualified foreign keys, RLS, stopped-state consistency and one active TimeEntry per `(organization_id, user_id)`. Lifecycle decision rules remain exclusively in Core.

The original Organization-qualified keys remain. Defense in depth now additionally requires:

- WorkEvent unique key `(organization_id, triggered_by, id)`;
- TimeEntry unique key `(organization_id, user_id, id)`;
- TimeEntry start/stop WorkEvent references qualified by `(organization_id, user_id, work_event_id)`;
- WorkEventDecision WorkEvent/TimeEntry references qualified by `actor_user_id`;
- SyncReceipt WorkEvent/server-TimeEntry references qualified by `actor_user_id`;
- AuditEvent WorkEvent reference qualified by `actor_user_id`.

These constraints reject RLS-valid but cross-User references with PostgreSQL `23503`; they do not depend on application query discipline.

Privileges and policies are operation-specific:

- `work_events`, `work_event_decisions`, `sync_receipts` and `audit_events`: User-scoped `SELECT` and `INSERT` only; no `UPDATE` or `DELETE` grant/policy.
- `time_entries`: User-scoped `SELECT` and `INSERT`; `UPDATE` is limited to `status`, `stopped_at` and `stop_work_event_id`, with both `USING` and `WITH CHECK` requiring the same Organization and current User; no `DELETE`.
- Every User-owned policy checks both Organization and the table's User/actor column. A future Administrator view is deliberately absent and requires a separate role/policy design.

Every lifecycle query uses the `pg` string-and-values API without a query `name`, SQL `PREPARE` or SQL `EXECUTE`. The code therefore creates no named or server-persistent prepared query in the transaction-pool-compatible path.

## 4. Connection-Mode Evidence

| Mode | Result | Evidence boundary |
|---|---|---|
| Direct PostgreSQL | **Passed locally, awaiting review** | Complete lifecycle/security suite with separate installer/runtime pools against PostgreSQL 17.10 |
| Supavisor Session Mode | **Unverified** | `B1_SUPAVISOR_SESSION_URL` absent; URL alone would not suffice |
| Supavisor Transaction Mode | **Unverified** | `B1_SUPAVISOR_TRANSACTION_URL` absent; URL alone would not suffice |
| Supabase Edge Functions | **Not tested** | Deliberately outside this managed-Node spike |

The two absent Supavisor modes appear as skipped tests and must not be described as verified. Before either optional test can produce evidence, the target must be prepared through the privileged installer with the disposable schema and exact least-privilege roles, and the URL must authenticate as the prepared runtime login. No cloud resource was created.

## 5. Automated Test Matrix

| Requirement | Result |
|---|---|
| Core start and complete five-record commit | Passed |
| Core stop, `stoppedAt`, start/stop WorkEvent traceability | Passed |
| Core duplicate without TimeEntry mutation | Passed |
| Core other-target rejection without TimeEntry mutation | Passed |
| Core escalation without TimeEntry mutation | Passed |
| Identical WorkEvent retry | Passed; no second write |
| Same WorkEventId with different canonical content | Passed; explicit conflict, original preserved |
| Failure after WorkEvent write | Passed; complete rollback |
| Failure after TimeEntry write | Passed; complete rollback |
| Failure after WorkEventDecision write | Passed; complete rollback |
| Failure after SyncReceipt write | Passed; complete rollback |
| Failure after AuditEvent write | Passed; complete rollback |
| Concurrent scans for the same Organization/User | Passed; second transaction observed waiting on advisory lock |
| No second active TimeEntry | Passed; database partial unique index also enforces the invariant |
| Different users on the same target | Passed; independent locks and two active entries |
| Same-Organization User isolation on all five lifecycle tables | Passed; each runtime User sees only its own rows |
| TimeEntry takeover by changing `user_id` | Passed; column privilege denies it and RLS hides another User's row |
| Required User-qualified unique/FK definitions | Passed; all nine named constraints verified through `pg_constraint` |
| User A TimeEntry using User B start WorkEvent | Passed; rejected with `23503`, no TimeEntry created |
| User A stop using User B WorkEvent | Passed; rejected with `23503`, original TimeEntry remains active |
| User A Decision/Receipt/Audit for User B WorkEvent | Passed; each rejected with `23503`, foreign row remains unreadable |
| User A Decision/Receipt referencing User B TimeEntry | Passed; each rejected with `23503`, foreign TimeEntry remains unreadable |
| Normal real Core start/stop for Users A and B in one Organization | Passed; both lifecycle chains remain independent and valid |
| Organization A read/write isolation from B | Passed through RLS |
| Cross-tenant foreign key | Passed; rejected with PostgreSQL `23503` |
| Guessed foreign identifiers | Passed; no WorkEvent, Decision, Receipt, Audit or TimeEntry row disclosed |
| Reused connection after commit and rollback | Passed; Organization/User GUC and role absent afterward |
| Lock release after commit and rollback | Passed |
| No named/persistent prepared query; transaction lock only | Passed |
| Immutable WorkEvent UPDATE/DELETE and unchanged original | Passed; both operations denied with `42501` |
| Immutable WorkEventDecision UPDATE/DELETE and unchanged original | Passed; both operations denied with `42501` |
| Immutable SyncReceipt UPDATE/DELETE and unchanged original | Passed; both operations denied with `42501` |
| Immutable AuditEvent UPDATE/DELETE and unchanged original | Passed; both operations denied with `42501` |
| Runtime role attributes, ownership and sole application-role membership | Passed |
| Exact operation-specific policy and table/column privilege matrix | Passed; no `ALL` policy or broad table UPDATE grant |
| Runtime direct access and access after `RESET ROLE` | Passed; denied with `42501` |
| Runtime `row_security=off` bypass attempt | Passed; denied with `42501` |
| Runtime role/schema/policy mutation attempts | Passed; denied and no object created |

Corrected local Vitest result: one test file, **39 passed and 2 skipped**. The two skipped tests are exactly the unavailable Supavisor Session and Transaction modes.

## 6. Verification Performed

- Root TypeScript check: passed for Core and Mobile, including Core tests.
- Core/Mobile tests: passed, 262 Core plus 10 Mobile tests.
- Core build: passed.
- Backend B1 typecheck: passed, including spike tests.
- Backend B1 direct PostgreSQL tests: passed, 39 passed / 2 skipped.
- Backend B1 build: passed.
- Built Node artifact import: passed under Node 24.17.0.
- CI workflow: isolated PostgreSQL job added; local YAML/command validation performed. A hosted Actions run remains pending because this task does not commit or push.
- `git diff --check`: passed at task closure.

## 7. Deliberately Unproved

- Supavisor Session Mode behavior and connection reuse.
- Supavisor Transaction Mode behavior, including the provider path's exact prepared-statement handling.
- Supabase JWT verification, Auth identity mapping, cloud RLS configuration or service-role controls.
- Cryptographic binding of `app.user_id` to an authenticated JWT. B1 proves database isolation for the transaction-local context selected by the backend; authentication remains out of scope.
- Managed-Node deployment provider, network path, TLS and operational pool sizing.
- Edge Functions Core import, transaction, rollback, connection reuse or cold/warm behavior.
- Load, failover, PITR/restore, RLS query-plan performance and production observability.
- Production schema evolution, retention/erasure controls and personal-data processing.

## 8. Risks and Architecture Consequences

- The direct path proves PostgreSQL semantics but not Supavisor semantics. The selected production connection mode still requires real provider credentials and repeated tests.
- A Supavisor URL without the disposable schema, roles and runtime login is not a valid test target and must fail rather than be counted as evidence.
- Core is currently source-published for a bundler-based monorepo toolchain. The spike bundles it successfully, but production package/deployment structure needs an explicit Technical Lead decision.
- Advisory-hash collision would conservatively over-serialize unrelated users; it would not permit concurrent lifecycle mutation. Production monitoring and load evidence remain necessary.
- The disposable schema installer needs role/schema creation privileges and must not become an application startup migration mechanism.
- RLS correctness passed functional negative tests; performance and safe production administration remain open.
- The existing npm audit reports 11 moderate findings across the monorepo dependency graph. This spike neither auto-fixed nor suppressed them; dependency remediation requires a separately reviewed scope.

## 9. Managed Node versus Edge Functions

Managed Node remains the preferred primary lifecycle runtime. The direct Node/PostgreSQL path now has executable evidence for Core import, transaction rollback, per-user locking, RLS, connection reuse and context cleanup. No equivalent Edge Functions evidence exists, so this spike provides no basis to promote Edge Functions to the lifecycle runtime. Edge remains limited to narrow tasks unless its separate ADR-0008 gate is completed later.

## 10. B1/B2 Gate

**Technical Lead approves B1 and authorizes B2 Async-Port Migration** as compiler-enforced Core/Application boundary work without selecting or implementing a production database connection mode. The following conditions remain:

- B2 must not introduce a production backend adapter, HTTP API or cloud dependency.
- Supavisor Session/Transaction verification remains an open pre-production adapter/deployment gate, not a falsely completed B1 result.
- Core Business Rules remain synchronous/pure; only effectful ports and Application Services migrate to Promise contracts.
- GitHub Actions run `29220424071` is the first successful hosted B1 evidence: Core/Mobile job and Backend B1 PostgreSQL job both passed.
- A future regression in these jobs reopens the affected gate.
