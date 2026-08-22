# Block B3 — Versioned Server Schema, Constraint and RLS Evidence

Status: Completed — Technical Lead and Independent Security Approved
Date: 2026-07-13
Owner: Implementation Agent
Approval Authorities: Technical Lead and Independent Security Reviewer
Architecture Authority: `ADO/01_Architecture/ADR/ADR-0008-backend-tenant-isolation-and-async-foundation.md`
Plan: `ADO/02_Development/Block_B3_Versioned_Server_Schema_Implementation_Plan.md`

## 1. Result

Block B3 introduces the isolated `@taptime/backend-schema` Node 24 workspace. It contains three deterministic PostgreSQL 17 migrations, a checksum/version-ledger runner, a production-shaped logical schema, structural Organization/User/AssignmentTarget integrity, truthful Core-Decision and SyncReceipt result mappings, column-specific grants, forced RLS on all twelve logical tables, transaction-atomic administrative audit evidence and a 124-test direct-PostgreSQL security matrix.

The package is not a production backend or adapter. The disposable B1 spike is unchanged. No API, Auth provider, Supabase/cloud resource, service-role client access, Mobile integration or production data exists. This implementation evidence did not authorize B4; the later approved B3 closure authorizes only the separate narrow B4 identity/Membership slice.

## 2. Migration Evidence

| Version | File | Responsibility |
|---|---|---|
| `001` | `001_foundation.sql` | Isolated schema, three `NOLOGIN` application roles, User/IdentityBinding/Organization/Membership roots, active-Membership invariant, Membership `row_version` and Organization-qualified creator FK |
| `002` | `002_domain_and_lifecycle.sql` | Configuration and lifecycle tables; tenant/User/target composite references; reciprocal deferred TimeEntry/Decision links; discriminated Decision/Receipt result shapes; deferred Decision consistency including exact Start/Stop WorkEvent timestamp binding; exact Receipt mapping; administrative mutation guards and atomic audit trigger; checks and partial unique indexes |
| `003` | `003_grants_and_rls.sql` | Safe context helpers, column-specific grants, active-Membership lifecycle gates, forced RLS and 45 operation-/role-specific policies |

The runner:

- accepts only strictly sortable `NNN_name.sql` files;
- calculates SHA-256 over each migration's UTF-8 source;
- records `version`, `name`, `checksum` and `applied_at` in `public.taptime_server_schema_migrations`;
- serializes concurrent runners with `pg_advisory_xact_lock` inside the migration transaction;
- checks the ledger again after acquiring the lock;
- applies a pending migration and ledger row atomically;
- returns already-applied versions without rerunning SQL;
- rejects checksum drift;
- rolls back both DDL and ledger write on failure.

Local PostgreSQL 17.10 evidence applied versions `001,002,003` from an empty schema, reran them with zero duplicate application and verified a deliberately failing migration left neither its table nor ledger row.

## 3. Complete Table and Constraint Matrix

| Table | Tenant/identity ownership | Principal constraints |
|---|---|---|
| `organizations` | tenant root | UUID PK, non-empty name, positive optimistic `row_version` |
| `users` | global provider-neutral identity root | UUID PK; no email, Organization or role authority |
| `identity_bindings` | global link to User | unique issuer/subject; revocation after creation; no email linking rule |
| `memberships` | mandatory `organization_id`, User | only `administrator`/`employee`; tenant composite keys; one row per Organization/User; one active Membership per User; Organization-qualified creator when non-null; grant/revoke timestamps; positive row version |
| `customers` | mandatory `organization_id` | tenant key; active/deactivated-state consistency; validity timestamps; positive row version |
| `nfc_tags` | mandatory `organization_id` | tenant key; Organization-scoped payload uniqueness; non-empty payload |
| `nfc_assignments` | mandatory `organization_id` | tenant-preserving Tag/Customer FKs; customer target only; one active assignment per Organization/Tag; validity-state consistency; immutable snapshot key for WorkEvent reference |
| `work_events` | mandatory `organization_id` and owning User | globally idempotent UUID plus tenant/User/target keys; assignment/tag/target snapshot FK; Membership/User FK; separate occurred/received time; SHA-256/version-1 hash checks |
| `time_entries` | mandatory `organization_id` and owning User | tenant/User/target-qualified start/stop WorkEvent FKs; reciprocal deferred links to the exact Start/Stop Decisions; exact `started_at`/`stopped_at` binding to the corresponding WorkEvent `occurred_at`; distinct Start/Stop events; one active entry per Organization/User; started/stopped shape; one-way versioned start-to-stop update; stop not before start; no duration column |
| `canonical_decisions` | mandatory `organization_id` and actor User | one per WorkEvent; exact five Core outcomes; Start/Stop `time_entry_id`; Rejection `active_time_entry_id`; Duplicate previous WorkEvent only; Escalation exact Core reason only; generated reconciliation ID; required engine version; deferred final-state, traceability and lifecycle-time validation plus reverse TimeEntry linkage |
| `sync_receipts` | mandatory `organization_id` and owning User | stable UUID per immutable attempt; unique positive attempt number per Organization/WorkEvent; target-qualified WorkEvent/Decision FKs; exact optional Decision-result TimeEntry mapping; explicit client/server TimeEntry IDs; complete four-status result-shape check |
| `audit_events` | mandatory `organization_id` | nullable future system/bootstrap actor; non-null User actor must have same-Organization Membership; lifecycle runtime must supply contextual actor and WorkEvent; User-qualified WorkEvent FK; immutable correlation/payload evidence |

Defense in depth does not rely on RLS alone:

- every non-root tenant row has non-null `organization_id`;
- configuration references use `(organization_id, id)` foreign keys;
- lifecycle references use `(organization_id, owning_user_id, target_type, target_customer_id, id)` where User and AssignmentTarget ownership matter;
- WorkEvent assignment FK binds assignment, tag, target type and Customer snapshot together;
- every persisted TimeEntry must be created atomically with its exact Start Decision and identical Start-WorkEvent instant, and every Stop transition atomically with its exact Stop Decision and identical Stop-WorkEvent instant; the one-Decision-per-WorkEvent key prevents an event from being reused across lifecycle edges;
- Receipt mapping binds its Decision and exact server TimeEntry rather than merely two independently valid same-target rows;
- cross-Organization, cross-User and cross-target references fail with PostgreSQL `23503`;
- guessed foreign IDs are invisible through Employee/Administrator policies.

### CanonicalDecision result truth

The schema uses the exact Core discriminator `duplicate_scan_ignored`; `duplicate_ignored` is only shorthand in the Technical-Lead task and is not persisted. The five shapes are:

| Core result | Required relation | Forbidden relations/values | Deferred consistency validation |
|---|---|---|---|
| `time_entry_started` | `time_entry_id` | Reason, active entry and previous WorkEvent | entry was started by the current WorkEvent, is started at Decision commit, same User/Organization/target, and `started_at = WorkEvent.occurred_at` |
| `time_entry_stopped` | `time_entry_id` | Reason, active entry and previous WorkEvent | entry was stopped by the current WorkEvent, is stopped at Decision commit, same User/Organization/target, and `stopped_at = WorkEvent.occurred_at` |
| `duplicate_scan_ignored` | distinct `previous_work_event_id` | Reason and both TimeEntry relations | previous WorkEvent FK preserves same Organization/User/target; no five-second rule is implemented in SQL |
| `active_entry_for_other_target_rejected` | `active_time_entry_id` | Reason, result TimeEntry and previous WorkEvent | referenced entry is started, same Organization/User and has a different target |
| `escalation_required` | one of the seven `BusinessEngineEscalationReason` literals | all TimeEntry and previous WorkEvent relations | no SQL inference of whether the reason is true; Core remains the decision authority |

`result_time_entry_id` is generated as `COALESCE(time_entry_id, active_time_entry_id)` and exists solely to make Receipt reconciliation referentially exact. The constraint trigger is `DEFERRABLE INITIALLY DEFERRED`, non-`SECURITY DEFINER`, fully schema-qualified and unavailable for direct Runtime execution. It validates the final transaction state and uses PostgreSQL `timestamptz` equality to compare lifecycle instants, so equivalent timezone representations are equal. It compares Start/Stop only with the corresponding WorkEvent `occurred_at`, never with `received_at`, `decided_at` or server time, and never computes Start, Stop, Duplicate, Rejection, Escalation, clock skew, offline delay or event order. No reciprocal TimeEntry trigger is added: a later legitimate Stop must not invalidate historical Start/Rejection evidence.

Two reciprocal `DEFERRABLE INITIALLY DEFERRED` foreign keys bind each TimeEntry's `start_work_event_id` and optional `stop_work_event_id` back to the exact CanonicalDecision/result-TimeEntry mapping. Thus Start is committed only with a matching `time_entry_started` result, and Stop only with a matching `time_entry_stopped` result; the Decision validator supplies the discriminator/state check while the foreign keys supply bidirectional existence and identity. A directly inserted stopped row cannot satisfy the historical Start check because the deferred Start-Decision validator observes the final stopped state. Distinct lifecycle-event IDs and the one-Decision-per-WorkEvent key make both edges exclusive.

### SyncReceipt result truth

| Status | Required | Forbidden | Server result rule |
|---|---|---|---|
| `received` | immutable attempt metadata | server Decision, server TimeEntry, conflict code | ingestion/deferred acknowledgement only |
| `retryable_failure` | immutable attempt metadata | server Decision, server TimeEntry, conflict code | retry evidence; no canonical result claimed |
| `synchronized` | same-event CanonicalDecision | conflict code | optional Server-TimeEntry, when supplied, equals the Decision result exactly |
| `conflict` | nonblank `conflict_code` | Server-TimeEntry without Decision | Decision optional; any supplied Server-TimeEntry equals that Decision result exactly |

The WorkEvent, Decision and TimeEntry FKs continue to bind Organization and User. Current-event target binding remains on WorkEvent/Decision; the result TimeEntry may intentionally have another target only for `active_entry_for_other_target_rejected`. Received/retryable rows cannot smuggle canonical result associations.

### Canonical hash v1

The v1 representation deliberately matches the B1-proven ordering. UTF-8 bytes of a JSON array contain exactly:

1. `id`
2. `organizationId`
3. `assignmentId`
4. `nfcTagId`
5. `target.targetType`
6. `target.targetId`
7. `triggeredBy`
8. `occurredAt` normalized with UTC ISO-8601 millisecond precision

`received_at` and all transport/server metadata are excluded. Algorithm is `sha256`; stored version is `1`. A fixed automated test vector produces `4107ef70b8a57aff9dfa05cebaa04ddc77efa76ebf7088cb55b884c376e02048`.

An identical WorkEvent-ID retry is demonstrably a no-op under `ON CONFLICT (id) DO NOTHING`; a different hash for that ID produces `23505`, is detected as conflicting content and leaves original evidence unchanged. B3 provides the persistence primitive and evidence; the typed API conflict mapping belongs to the later lifecycle endpoint.

## 4. Role, Grant and Policy Matrix

| Principal | Login/ownership | Granted operations | RLS scope |
|---|---|---|---|
| Installer/migration connection | external privileged connection; CI uses separate synthetic `taptime_b3_installer` | schema/migration DDL and test fixture inspection | never a runtime credential; no credential shared with runtime pools |
| `taptime_employee` | `NOLOGIN`, non-owner, non-superuser, no `BYPASSRLS` | SELECT only on self/minimum configuration, own TimeEntry and SyncReceipt tables | active Membership, transaction-local Organization/User; no other User/tenant evidence |
| `taptime_administrator` | `NOLOGIN`, non-owner, non-superuser, no `BYPASSRLS` | SELECT own-tenant configuration/evidence; Organization `name,row_version` UPDATE; Membership INSERT and `role,revoked_at,row_version` UPDATE; Customer INSERT, `active,deactivated_at,row_version` UPDATE and DELETE; Tag INSERT/DELETE; Assignment INSERT and `active,valid_to,row_version` UPDATE | active Administrator Membership and current Organization only; every granted write is audit-allowlisted |
| `taptime_server_lifecycle` | `NOLOGIN`, non-owner, non-superuser, no `BYPASSRLS` | scoped reads; append-only evidence INSERT; TimeEntry INSERT and column-limited stop UPDATE | current Organization/User; active Membership for every TimeEntry mutation/link; revoked Membership permits WorkEvent plus Audit evidence without a fabricated result, or the pre-existing no-TimeEntry path when Core actually produced `escalation_required` |
| Synthetic test logins | separate `NOINHERIT` logins, one per role | may `SET ROLE` only to the assigned role | after `RESET ROLE`, commit or rollback they have no table access/context |

All twelve logical tables have both `ENABLE ROW LEVEL SECURITY` and `FORCE ROW LEVEL SECURITY`. Forty-five policies separate SELECT/INSERT/UPDATE/DELETE by role and operation. No broad `ALL TABLES` grant or `FOR ALL` policy exists.

Runtime immutability:

- `work_events`: SELECT where authorized, lifecycle INSERT; never UPDATE/DELETE.
- `canonical_decisions`: Administrator/lifecycle SELECT, lifecycle INSERT; never UPDATE/DELETE.
- `sync_receipts`: Employee own/Admin tenant/lifecycle own SELECT, lifecycle INSERT; never UPDATE/DELETE.
- `audit_events`: Administrator tenant SELECT, contextual lifecycle INSERT; never UPDATE/DELETE.
- `time_entries`: Employee own/Admin tenant/lifecycle own SELECT; lifecycle INSERT and column-limited UPDATE only; never DELETE.
- Membership and Assignment history cannot be deleted through runtime roles; revocation/deactivation uses explicit validity fields.

Administrator mutation guards reject historical/ownership rewrites, incorrect `row_version` changes, un-revoke and reactivation. Granted direct writes emit one of a fixed set of AuditEvent types in the same transaction: Organization update; Membership grant/role-change/revoke; Customer create/deactivate/delete; NfcTag register/delete; NfcAssignment assign/deactivate. The audit payload includes only allowlisted state such as role, active/revoked flags and row version; it never copies NFC payloads, credentials or tokens. A rejected write and a deliberately rolled-back write both produce no audit row.

The three membership-query helpers are `SECURITY DEFINER` only to avoid recursive Membership RLS. The administrative audit trigger function is `SECURITY DEFINER` only to append immutable evidence that the Administrator role itself cannot insert. All four have fixed `pg_catalog,taptime_server` search paths and PUBLIC execution revoked; the query helpers have narrow role grants, while the audit function is trigger-only. The candidate-User helper additionally enforces current Organization plus active Administrator context, preventing direct boolean probing of another tenant.

## 5. Automated Access and Negative Matrix

The 124 integration tests use two Organizations, an Administrator and Employee in each, a second Employee in Organization A, IdentityBindings, Memberships, Customers, equal cross-tenant NFC payloads, Tags, Assignments and lifecycle evidence.

| Area | Allowed evidence | Rejected/hidden evidence |
|---|---|---|
| Migrations | empty apply; exact ledger; safe rerun | checksum drift; failed-DDL rollback |
| Employee | own active Organization/config, Membership, TimeEntry, SyncReceipt | other Employee, other tenant, WorkEvent/direct lifecycle mutation, administration write |
| Administrator | own-tenant configuration CRUD within grants; Organization-wide evidence read | foreign Organization SELECT/INSERT/UPDATE/DELETE; guessed foreign User; authoritative lifecycle mutation |
| Lifecycle | contextual config/state reads; explicit evidence insert and TimeEntry transition columns | cross-tenant INSERT; same-Organization other-User WorkEvent/TimeEntry/Decision/Receipt/Audit references |
| Context | transaction-local role/Organization/User; clean connection after commit/rollback | missing or malformed context; `RESET ROLE` access; Employee role escalation; runtime DDL |
| Evidence | append-only inserts and authorized reads | UPDATE/DELETE on all four immutable tables; original rows verified unchanged |
| Constraints | valid tenant-independent NFC payloads and lifecycle mappings | invalid role, second active Membership, duplicate tenant payload, cross-tenant FK, second active TimeEntry, invalid state/order/hash version |
| Idempotency | identical ID/content no duplicate | same ID/different hash `23505`, original hash preserved |
| Revocation | post-revocation WorkEvent plus `LifecycleDeferred` AuditEvent; zero CanonicalDecisions, zero Receipts and zero TimeEntry mutation for the deferred path | TimeEntry INSERT/UPDATE, invented/non-Core escalation reason, TimeEntry-linked Decision, no-Decision Receipt when no actual persisted `escalation_required` Decision exists |
| Target integrity | same Organization/User/target lifecycle and exact Decision/server-TimeEntry mapping | same User with other target at start/stop/Decision/Receipt; unrelated same-target server TimeEntry |
| Administrative integrity | exact one-way versioned changes and atomically appended allowlisted AuditEvents | 24 forbidden historical/ownership column writes, un-revoke/reactivation, cross-tenant write, rolled-back data/audit |
| Receipt retries | first/retryable/further/terminal attempts, Employee/Admin reads | duplicate attempt number, cross-User/cross-tenant attempts, UPDATE/DELETE of prior attempt |
| Harness | exact one-role membership, TCP runtime URL, expected `session_user` and effective role | socket-only runtime URL, RESET ROLE access, role escalation, stale transaction context |
| Decision truth | valid atomic Start/Stop with exact WorkEvent instants, equivalent timezone representations, Duplicate, other-target Rejection and all seven Escalation reasons | orphan TimeEntry; direct stopped INSERT even with two Decisions; reused or identical Start/Stop WorkEvent; active entry claimed stopped; wrong start/stop WorkEvent; mismatched `started_at`/`stopped_at` with atomic rollback and active-state preservation; stopped entry claimed started; foreign/stopped/same-target active entry; extra relations; blank/non-Core reason |
| Receipt truth | synchronized Decision mapping; exact optional result TimeEntry; received/retryable retry path; coded conflict | synchronized without Decision; TimeEntry without Decision; mismatched Decision TimeEntry; missing/blank conflict code; server data on received/retryable |

PostgreSQL codes asserted where security/integrity evidence depends on them: `22P02`, `23502`, `23503`, `23505`, `23514` and `42501`.

## 6. CI and Local Verification

GitHub Actions retains the Core/Mobile quality job and B1 PostgreSQL job and adds an isolated `backend-b3-schema` job with PostgreSQL `17.10-alpine`. It installs from the lockfile, typechecks B3, applies migrations to the empty database, reruns the runner, verifies `001,002,003`, runs the complete matrix and builds the package. Only official checkout/setup-node actions are used; the database credentials are explicitly synthetic CI-only values.

Technical-Lead-approved implementation commit `903917c` passed GitHub Actions run `29243934150`: Core/Mobile quality, the unchanged B1 PostgreSQL spike and the new isolated B3 PostgreSQL 17 schema-security job all completed successfully.

Local evidence on Node `v24.17.0` and PostgreSQL `17.10`:

| Check | Result |
|---|---|
| B3 tests-inclusive TypeScript check | Passed |
| Empty schema migration | Passed; `001,002,003` |
| Repeated migration runner and version check | Passed; zero duplicate application |
| B3 PostgreSQL matrix | 124 passed |
| B3 build | Passed |
| Root tests-inclusive TypeScript check | Passed |
| Core tests | 262 passed |
| Mobile tests | 10 passed |
| Workspace build | Passed |
| B1 tests-inclusive TypeScript check | Passed |
| B1 direct PostgreSQL tests | 39 passed, 2 Supavisor modes skipped |
| B1 build | Passed |
| `git diff --check` | Passed |

## 7. Explicitly Open Gates

- Technical Lead review completed after three adversarial correction rounds; the independent security review returned `APPROVED` with no blocking findings.
- This implementation evidence does not authorize B4; the subsequent B3 closure records its separate narrow authorization.
- No production personal data until legally approved retention, erasure/anonymization, restriction, backup region/encryption/expiry and restore-replay controls exist.
- No numeric clock-skew, long-offline, unusual-duration or Membership-revocation grace threshold is implemented.
- Historical Membership/Customer/Assignment boundaries are stored, but ambiguous delayed evidence remains deferred/no-mutation until the approved product policy is implemented.
- No privileged legal deletion/retention operator path is implemented.
- No first-Administrator bootstrap, employee invitation/provisioning or additional identity-linking path is implemented.
- NFC payload representation/security remains a Block D gate; B3 enforces only the approved provisional Organization-scoped uniqueness.
- Supavisor Session/Transaction modes remain unverified.
- The repository's existing 11 moderate npm dependency findings remain open and unchanged; B3 does not run an automatic dependency fix or alter their disposition.
- No production lifecycle transaction/API/repository adapter, Auth integration, cloud provisioning, monitoring, backup or RLS performance/load evidence exists.
- `retryable_failure` currently records the typed status but has no dedicated persisted reason field; adding one requires an approved server receipt contract rather than overloading `conflict_code`.
- The current SyncReceipt vocabulary has no approved deferred/quarantine status. B3 therefore preserves the pre-existing revoked-Membership RLS gate and records the no-result deferred path as WorkEvent plus Audit evidence, not as a fabricated Receipt result.
- Attempt gaps, post-terminal retries and terminality across multiple immutable Receipt rows remain transport-policy decisions and are not inferred by B3.
- `decision_payload` remains opaque JSON evidence because no separately approved canonical payload serialization contract exists; relational discriminator/references, not JSON contents, are authoritative.
- The reciprocal final-state checks intentionally validate one WorkEvent transaction at a time. B6 must preserve ordered per-event commits (as B1 did) or explicitly design equivalent intermediate validation; a naive single commit that collapses both Start and later Stop of the same TimeEntry would not preserve the Start Decision's commit-time started state.

## 8. Review Recommendation

B3 is Technical-Lead and independently security approved. The independent review confirmed the composite FK, Decision/Receipt truth, SECURITY DEFINER, grant, RLS, revocation and timestamp claims and recorded only non-blocking P2 carry-forwards. B4 authorization is recorded separately in the B3 closure and current Project Status; no later Block is inferred as approved.
