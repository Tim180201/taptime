# Block B5 — Tenant-safe Read-only Organization/Config Adapter Implementation Plan

Status: Completed — Technical Lead, GitHub CI and Independent Security Approved; B6 Not Authorized
Date: 2026-07-13
Owner: Implementation Agent
Approval Authority: Technical Lead
Architecture Authority: `ADO/01_Architecture/ADR/ADR-0008-backend-tenant-isolation-and-async-foundation.md`

## Objective

Implement only the first production-shaped, PostgreSQL-backed read slice for Organization-owned
configuration. A verified provider identity must be resolved again against the current database
Membership inside the same tenant transaction that executes the reads. No structurally supplied
actor, token claim, request field or callback may select database authority.

## Authorized Boundary

```text
raw access token + requested OrganizationId
  -> existing B4 asymmetric JWT verifier
  -> BEGIN READ COMMITTED READ ONLY
  -> SET LOCAL ROLE taptime_identity_resolver
  -> resolve_request_actor(verified issuer, verified subject)
  -> compare database Organization with requested Organization
  -> transaction-local database-derived User/Organization/Membership/role context
  -> fixed employee|administrator database role
  -> five tenant-qualified read-only repositories under existing B3 RLS
  -> COMMIT, or ROLLBACK on rejection/failure
```

## Implementation Slices

1. Add isolated Node 24 workspace `@taptime/backend-read-model` without changing Core or migrations.
2. Add one cohesive `TenantReadSessionCoordinator` which owns verification, current Membership
   resolution, requested-Organization comparison, fixed role selection, transaction context,
   cleanup and callback lifetime.
3. Expose exactly five read-only Core-port projections inside the callback:
   `Organization.findById`, active `Membership.findByUserId`, `Customer.findById`,
   `NfcTag.findByPayload` and active `NfcAssignment.findActiveByTagId`.
4. Scope every SQL query by the database-resolved Organization and the requested business key,
   use only parameters for values, and map rows to the existing Core Domain shapes.
5. Add PostgreSQL 17 adversarial tests with a synthetic `NOINHERIT` runtime login which has exactly
   the resolver, Employee and Administrator roles, plus real locally signed asymmetric JWT/JWKS
   verification through the B4 verifier.
6. Add an isolated B5 GitHub Actions job and publish truthful implementation evidence.

## Security Invariants

- The callback receives no Actor context, role selector, `Pool`, `PoolClient`, raw query method,
  list method or write method.
- Repository capabilities expire as soon as the callback settles and cannot be used through a
  released or subsequently re-leased pooled client.
- Only the fixed literals `taptime_employee` and `taptime_administrator` may be selected after the
  database returns the current Membership role.
- Token/body Organization, User, tenant and role claims are ignored.
- Unknown/revoked IdentityBinding or Membership returns one generic authorization rejection.
- The requested Organization is compared only after database resolution and before readers exist.
- Active Membership and role changes remain visible to each read because the transaction stays at
  PostgreSQL `READ COMMITTED`; existing B3 RLS remains the final per-statement gate.
- Expected authorization outcomes are typed results. B4 JWT verification/JWKS failures retain the
  approved B4 typed rejection taxonomy. Pool, SQL, mapping and callback failures are thrown as
  infrastructure/programming errors after rollback.
- Migration files `001`–`004`, Core Domain/Business/ports, lifecycle tables and product behavior
  remain unchanged.

## Verification Gates

- `npm ci` under Node 24.17.0.
- B5 tests-inclusive typecheck, complete PostgreSQL suite and build.
- B4 54 tests, B3 125 tests, Core 262 tests, Mobile 10 tests and B1 39 direct-PostgreSQL tests with
  the two explicitly unverified Supavisor modes skipped.
- Root/workspace build, CI YAML parse and `git diff --check`.
- Git proof that migrations `001`–`004` and Core Domain/Business/ports have no diff.

## Explicit Non-goals and Exit Status

No writes, HTTP/API route, Supabase/cloud resource, production credential/data, Mobile integration,
login UX, B6 lifecycle ingestion, synchronization, new migration or Business Rule is authorized.
The implementation phase ended at `Implemented — Awaiting Technical Lead Review`; the separate B5
closure records subsequent Technical Lead, GitHub CI and independent security approval. That
closure does not authorize B6.

## Implementation Outcome

The authorized slice is implemented with 41 passing direct-PostgreSQL/JWT tests. The coordinator,
five read-only Core-port projections, synthetic least-privilege runtime login, isolated CI job and
implementation evidence match the security invariants above. Full local Node 24 regression is
green. Technical Lead review, GitHub Actions run `29264083804` and the independent Claude review
subsequently approved the slice with no P0/P1 findings. No B6 authorization is inferred.
