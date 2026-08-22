# Block B1 — Managed Node Transaction and Tenant Security Spike Plan

Status: Completed — Technical Lead Approved, Not Production Ready
Date: 2026-07-13
Owner: Implementation Agent
Approval Authority: Technical Lead
Architecture Authority: `ADO/01_Architecture/ADR/ADR-0008-backend-tenant-isolation-and-async-foundation.md`

## Objective

Produce a reproducible, non-production proof that Node.js 24, the real `@taptime/core` `BusinessEngine` and PostgreSQL can execute TapTim.e's five-record lifecycle boundary atomically while enforcing Organization isolation, per-Organization/User serialization, idempotency and transaction-local request context.

No production backend, HTTP API, cloud resource, authentication integration, repository adapter or async-port migration is authorized by this spike.

## Implementation Slices

1. Add an isolated TypeScript workspace under `apps/` with Node.js 24 metadata, PostgreSQL driver, build/typecheck/test scripts and explicit spike warnings.
2. Add a disposable `b1_spike` PostgreSQL schema with tenant-owned WorkEvent, WorkEventDecision, TimeEntry, SyncReceipt and AuditEvent tables, composite tenant constraints, RLS and a one-active-TimeEntry invariant.
3. Implement one managed-Node transaction runner that imports the real Core `BusinessEngine`, uses transaction-local Organization/User context, serializes by `(organizationId, userId)` with `pg_advisory_xact_lock`, evaluates Core once and persists the resulting evidence atomically.
4. Add deterministic fault injection after every write stage and integration tests for lifecycle outcomes, rollback, idempotency, concurrency, cross-tenant denial, same-Organization User isolation including referential integrity, immutable evidence, least-privilege runtime credentials, context cleanup, lock release and unnamed-query compatibility.
5. Extend CI with an isolated PostgreSQL service job while preserving the existing Core/Mobile job.
6. Record tested runtime/database versions, connection modes, evidence, limitations and the B2 readiness assessment; update Project Status and Decision Log without claiming B1/B2 approval.

## Verification Gates

- Root TypeScript check.
- Full Core and Mobile tests.
- Core build.
- B1 workspace typecheck, PostgreSQL integration tests and build against a direct PostgreSQL URL.
- CI workflow structure and commands reviewed.
- `git diff --check` and scope review.

## Safety Boundaries

- Synthetic identifiers only; no real persons or production data.
- No Supabase cloud resource or secret required for local/CI evidence.
- Privileged schema installation and non-privileged runtime use separate pools and logins; the runtime is not owner, superuser or `BYPASSRLS` and has no inherited/direct table access.
- Supavisor Session and Transaction modes remain unverified unless matching runtime credentials are available and the disposable schema plus least-privilege roles have already been installed on the target.
- No session advisory lock, session-scoped tenant variable, named/prepared query or business-rule duplication outside Core.
- Spike schema and runtime are disposable and explicitly not production-ready.

## Implementation Result

The first Technical Lead review returned `CHANGES REQUIRED` because table grants/policies were overly broad, SELECT isolation was Organization-only and the direct test path used the privileged installer connection. The first correction added operation-specific immutable grants/policies, User-scoped RLS and a separate least-privilege runtime login. The second Technical Lead finding correctly identified that Organization-qualified foreign keys still allowed cross-User references inside one Organization. The second correction adds User-qualified unique keys and foreign keys throughout WorkEvent, TimeEntry, Decision, Receipt and Audit relationships while retaining the Organization constraints. Renewed Technical Lead review passed with 39 direct PostgreSQL tests; two Supavisor tests remain skipped. GitHub Actions run `29220424071` passed both the Core/Mobile and isolated Backend B1 PostgreSQL jobs. B1 is complete and B2 Async-Port Migration is authorized within ADR-0008's boundaries. Detailed evidence is recorded in `ADO/05_Evidence/Block_B1_Managed_Node_Transaction_Tenant_Security_Spike_Evidence.md`.
