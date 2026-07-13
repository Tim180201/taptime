# Block B3 — Versioned Server Schema, Constraints and RLS Implementation Plan

Status: Implemented — Technical Lead Approved; Awaiting Independent Security Review
Date: 2026-07-13
Owner: Implementation Agent
Approval Authorities: Technical Lead and Independent Security Reviewer
Architecture Authority: `ADO/01_Architecture/ADR/ADR-0008-backend-tenant-isolation-and-async-foundation.md`

## Objective

Create a production-shaped but not production-deployed PostgreSQL 17 schema with deterministic migrations, structural tenant/User integrity, least-privilege roles, forced RLS and an automated two-tenant negative matrix. Keep the disposable `apps/backend-b1-spike` unchanged and introduce no API, repository adapter, Auth provider, cloud resource or production data.

## Implementation Slices

1. Add an isolated `@taptime/backend-schema` Node 24 TypeScript workspace and deterministic migration runner with checksum/version ledger and transaction-per-migration behavior.
2. Add separately versioned SQL migrations for the logical v1 data model, constraints/indexes, then roles/grants/RLS policies.
3. Model Organization, User, IdentityBinding, Membership, Customer, NfcTag, NfcAssignment, WorkEvent, TimeEntry, CanonicalDecision, SyncReceipt and AuditEvent as persistence mappings from ADR-0008.
4. Prove structural Organization/User ownership, lifecycle traceability, immutable evidence, active-state uniqueness, hash/idempotency primitives and validity metadata.
5. Prove Employee, Administrator and server-lifecycle access through separate non-owner/non-superuser/non-`BYPASSRLS` synthetic logins with transaction-local request context.
6. Add a PostgreSQL 17 CI job which migrates an empty database, reruns the migration runner, validates the ledger and executes the full negative matrix.
7. Run all B3, Core, Mobile and B1 regression gates and record implementation evidence without authorizing B4.

## Technical-Lead Correction Loop

The uncommitted migrations were corrected in place after an initial six Technical-Lead findings:

1. Lifecycle mutation now requires an active Membership. A revoked User may still append the received WorkEvent and explicit Audit evidence, but no TimeEntry mutation is permitted; the absence of a fabricated CanonicalDecision or unsupported Receipt status is specified by correction round 2 below. No numeric grace or clock rule was introduced.
2. WorkEvent, TimeEntry, CanonicalDecision and SyncReceipt references now bind Organization, User, target type and target Customer. Receipt-to-Decision mapping additionally binds the exact server TimeEntry selected by the Decision.
3. Membership creators and AuditEvent User actors now require a Membership in the same Organization. `NULL` remains the explicit future bootstrap/system-actor representation; no cross-tenant operator is inferred.
4. Administrator UPDATE grants are column-specific. Trigger guards enforce exact `row_version` increments and one-way Membership revocation, Customer deactivation and Assignment deactivation; historical identity, tenant, creator, target and validity-start fields cannot be rewritten.
5. Every direct Administrator mutation that remains granted is paired with a fixed-allowlist, transaction-atomic AuditEvent trigger. The `SECURITY DEFINER` function has a fixed search path, no PUBLIC execution and emits only minimal payloads.
6. SyncReceipts are append-only attempt rows with stable IDs, positive per-WorkEvent attempt numbers and an Organization-scoped uniqueness constraint. Runtime roles cannot update or delete earlier attempts.

The test harness also revokes all application-role memberships before granting each synthetic login its single intended role, rejects socket-only runtime URLs, verifies `session_user`/effective role and releases each checked-out client exactly once.

### Technical-Lead Correction Round 2 — Truthful Decisions and Receipts

The second attack review showed that structural ownership alone did not prove that persisted CanonicalDecisions and SyncReceipts truthfully represented the Core result. The uncommitted migrations were therefore tightened without adding a SQL decision engine:

1. The persistence discriminator remains aligned to the exact Core names, including `duplicate_scan_ignored` (the shorthand `duplicate_ignored` is not a Core status).
2. CanonicalDecision now mirrors the Core union: Start/Stop use `time_entry_id`; other-target rejection uses a distinct `active_time_entry_id`; Duplicate uses only `previous_work_event_id`; Escalation uses exactly one of Core's seven reasons. A generated `result_time_entry_id` is reconciliation metadata, not a new business result.
3. A deferred, invoker-scoped constraint trigger validates only the selected result at transaction completion: start/stop state, WorkEvent traceability and engine-assigned lifecycle timestamps, same target for Start/Stop, and a still-started different-target entry for rejection. It does not choose an outcome or implement clock, offline-delay, duplicate-window or ordering rules.
4. SyncReceipt status shapes are explicit: `received` and `retryable_failure` carry no server result; `synchronized` requires its same-event CanonicalDecision; `conflict` requires a nonblank code. A Server-TimeEntry requires a Decision and, when supplied, must equal that Decision's generated result TimeEntry.
5. Revoked-Membership ingestion no longer fabricates a Core escalation reason. Because the current SyncReceipt vocabulary has no approved deferred/quarantine status, the safe representation is WorkEvent evidence plus a `LifecycleDeferred` AuditEvent, with no CanonicalDecision, no Receipt and no TimeEntry mutation. A genuine `escalation_required` result remains separately representable only when Core actually produced it.
6. TimeEntry Start/Stop traceability is reciprocal: deferred TimeEntry-to-Decision foreign keys require the exact Start Decision on insert and the exact Stop Decision on transition, while the existing deferred Decision-to-TimeEntry links validate the reverse direction. Start and Stop WorkEvent IDs must differ. This makes each lifecycle edge atomic and exclusive and prevents orphan, directly-stopped or multiply claimed TimeEntries without deciding a result in SQL.

Existing RLS tenant/User predicates, grants, immutable evidence rules and administrative audit protections remain in place. No new revoked-Membership Receipt exception is introduced. The pre-existing no-TimeEntry path for an actual `escalation_required` Core result remains available; Membership revocation by itself is not converted into such a result.

### Technical-Lead Correction Round 3 — TimeEntry/WorkEvent Time Consistency

The third attack review showed that reciprocal WorkEvent/TimeEntry identity did not yet prove the timestamp assignment made by the Core engine. The existing deferred, invoker-scoped Decision validator was tightened in place:

1. A `time_entry_started` result requires `TimeEntry.started_at` to equal the current Start WorkEvent's `occurred_at` exactly.
2. A `time_entry_stopped` result requires `TimeEntry.stopped_at` to equal the current Stop WorkEvent's `occurred_at` exactly.
3. PostgreSQL `timestamptz` instant equality is authoritative, so different timezone representations of the same instant remain valid.
4. The validation deliberately does not use `received_at`, `decided_at`, transaction/server time or a tolerance. It does not infer clock skew, offline delay, duplicate windows, event order or a different Core outcome.
5. Deferred failures return `23514` and roll back the TimeEntry plus Decision transaction atomically; a rejected Stop therefore leaves the prior active TimeEntry unchanged.

All five Core outcomes, reciprocal links, RLS predicates, grants, immutable evidence, SyncReceipt shapes and AuditEvent protections remain unchanged. This correction validates only the timestamp content of an already selected Core result and adds no Business Rule.

## Migration Layout

- `001_foundation.sql`: schema, application roles and global/tenant roots.
- `002_domain_and_lifecycle.sql`: remaining persistence tables, composite keys, reciprocal deferred TimeEntry/Decision foreign keys, discriminated Decision/Receipt checks, the narrow deferred Decision consistency trigger and partial unique indexes.
- `003_grants_and_rls.sql`: context helpers, exact grants, forced RLS and per-operation policies.

Migration filenames are strictly numeric and immutable once reviewed. The runner records version, SHA-256 checksum and application time in `public.taptime_server_schema_migrations`, serializes execution with a transaction-scoped advisory lock, applies each pending file in its own transaction and rejects checksum drift.

## Security Model

- Installer/migration connection owns schema objects and is never a runtime credential.
- `taptime_employee`, `taptime_administrator` and `taptime_server_lifecycle` are `NOLOGIN`, non-owner, non-superuser, non-`BYPASSRLS` roles with exact table-operation grants.
- Tests use separate synthetic `NOINHERIT` logins, each able to assume only its matching role. `RESET ROLE` therefore has no table access.
- `app.organization_id` and `app.user_id` are set transaction-locally only.
- Tenant tables force RLS. Composite Organization/User foreign keys provide integrity independently of RLS.
- WorkEvent, CanonicalDecision, SyncReceipt and AuditEvent are append-only for runtime principals; TimeEntry mutation is limited to the server-lifecycle role and User-scoped policy.
- Administrative configuration writes are limited to an explicit operation/column allowlist and append their audit record in the same transaction; a rejected or rolled-back write leaves no AuditEvent.

## Explicit Gates and Non-Goals

- No retention/deletion operator path; legal retention, erasure/anonymization and backup controls remain pre-production gates.
- No numeric clock, offline-delay or Membership-revocation grace threshold.
- Historical Membership/Assignment validity is represented structurally; product handling of ambiguous delayed evidence remains deferred.
- Lifecycle validation is per WorkEvent transaction. A future sync batch must not collapse Start and Stop of the same TimeEntry into one final-state-only commit; B6 must preserve ordered per-event transactions or explicitly design equivalent intermediate validation.
- No productive lifecycle transaction, repository adapter, HTTP API, Auth integration, service-role client access, Supabase resource or Mobile composition change.
- Supavisor modes remain unverified.
- B4 is not authorized by B3 implementation or evidence.

## Verification Gates

- B3 tests-inclusive TypeScript check, build and complete PostgreSQL integration matrix.
- Empty-database migration, idempotent rerun, version/checksum ledger and rollback-on-failure proof.
- Root tests-inclusive TypeScript check; 262 Core tests; 10 Mobile tests; workspace build.
- B1 TypeScript check, 39 direct PostgreSQL tests with the two Supavisor tests permitted to remain skipped, and B1 build.
- `git diff --check`, expected-file review and explicit confirmation that B1 source/SQL is unchanged.
