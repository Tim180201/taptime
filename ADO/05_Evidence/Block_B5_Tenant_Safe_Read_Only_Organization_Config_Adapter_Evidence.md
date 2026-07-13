# Block B5 — Tenant-safe Read-only Organization/Config Adapter Evidence

Status: Completed — Technical Lead, GitHub CI and Independent Security Approved; B6 Not Authorized
Date: 2026-07-13
Owner: Implementation Agent
Architecture Authority: `ADO/01_Architecture/ADR/ADR-0008-backend-tenant-isolation-and-async-foundation.md`
Plan: `ADO/02_Development/Block_B5_Tenant_Safe_Read_Only_Organization_Config_Adapter_Implementation_Plan.md`

## 1. Result and Scope

B5 adds the isolated Node 24 workspace `@taptime/backend-read-model` and implements the first
production-shaped PostgreSQL-backed Organization/configuration read slice. It reuses the approved
B4 `SupabaseJwtAccessTokenVerifier`, resolves the current IdentityBinding and active Membership in
the same transaction as the reads, selects one fixed B3 Application Role and lets existing B3 RLS
authorize every statement.

The implementation adds no HTTP/API route, write adapter, lifecycle ingestion, synchronization,
cloud resource, production data, Mobile integration, Business Rule or migration. Migrations
`001`–`004` and Core Domain/Business/port files have no diff.

## 2. Cohesive Authority and Transaction Boundary

`TenantReadSessionCoordinator.run(...)` is the only public execution boundary:

```text
raw access token + requested OrganizationId
  -> concrete existing B4 SupabaseJwtAccessTokenVerifier
  -> BEGIN ISOLATION LEVEL READ COMMITTED READ ONLY
  -> SET LOCAL ROLE taptime_identity_resolver
  -> resolve_request_actor(verified issuer, verified subject)
  -> generic rejection when binding/Membership is unavailable
  -> requested Organization comparison against the database result
  -> transaction-local database-derived User/Organization/Membership/role context
  -> fixed taptime_employee | taptime_administrator role
  -> five closed-over tenant-qualified read adapters under RLS
  -> COMMIT, or ROLLBACK on authorization/callback/infrastructure failure
```

The callback receives only a frozen `TenantReadRepositories` object. It receives no structurally
constructible Actor authority, User/Organization/role context, `Pool`, `PoolClient`, query method or
role selector. It therefore cannot turn B4's structurally constructible `RequestActorContext` P2
finding into authority. Role selection is a two-branch fixed literal allowlist; no token, request or
database string is interpolated as a role identifier.

Token verification failures, missing/revoked authority and requested-Organization mismatch are
typed discriminated rejections. PostgreSQL/pool failures, unexpected persisted enum values,
cardinality violations and callback errors remain thrown errors. The existing B4 verifier maps JWT
verification/JWKS failures to its approved typed token-rejection taxonomy; B5 does not reinterpret
those results. Connection
release occurs in `finally`; rollback preserves the original failure.

`READ COMMITTED` is deliberate. A Membership downgrade or revocation committed by another
connection after resolution but before a read is visible to the next statement. Existing B3 RLS
then denies that read. `READ ONLY` additionally prevents accidental writes even though the selected
Administrator role has separately approved write grants for other future use cases.

## 3. Exact Read Surface and Mapping

| Callback surface | Core projection | SQL tenant/key scope | Core mapping |
|---|---|---|---|
| `organization` | `Pick<OrganizationRepository, 'findById'>` | resolved Organization root ID plus requested Organization ID | `Organization` |
| `membership` | `Pick<MembershipRepository, 'findByUserId'>` | resolved `organization_id`, requested `user_id`, `revoked_at IS NULL` | active `Membership` |
| `customer` | `Pick<CustomerRepository, 'findById'>` | resolved `organization_id` plus requested Customer ID | `Customer` |
| `nfcTag` | `Pick<NfcTagRepository, 'findByPayload'>` | resolved `organization_id` plus exact payload value | `NfcTag` |
| `nfcAssignment` | `Pick<NfcAssignmentRepository, 'findActiveByTagId'>` | resolved `organization_id`, requested Tag ID and `active` | `NfcAssignment` with existing customer `AssignmentTarget` |

All values are query parameters. Every foreign, invisible or missing row returns `null`; no result
distinguishes a guessed foreign identifier from a missing local identifier. No list, raw-query,
write, unsupported-stub, lifecycle or synchronization method exists on the surface.

## 4. Least-privilege Runtime Evidence

The synthetic B5 test login is `LOGIN NOINHERIT`, non-owner, non-superuser, cannot create databases
or roles, has no replication or `BYPASSRLS`, and has exactly these three parents:

- `taptime_identity_resolver`
- `taptime_employee`
- `taptime_administrator`

Before a role is selected and after `RESET ROLE`, direct table reads fail with PostgreSQL `42501`.
The login cannot select `taptime_server_lifecycle`, create schemas or disable RLS. The pooled
connection is reused with `current_user/current_role` reset to the login and all four `app.*` values
unset after successful commit, token rejection, database authorization rejection and callback
rollback.

## 5. Adversarial Test Matrix

The 41 B5 tests run against direct PostgreSQL 17.10 and an ephemeral numeric-loopback JWKS endpoint
with a locally generated RSA key pair. They prove:

- exact migration ledger `001,002,003,004` with no migration `005` and idempotent rerun;
- exact runtime role attributes, ownership and three-role membership graph;
- direct table denial before role selection, after `RESET ROLE`, lifecycle-role denial and DDL/RLS
  denial;
- Employee reads of its Organization, active Membership and visible Customer/Tag/Assignment;
- Administrator reads of current Organization configuration and Organization Memberships;
- same-Organization Employee Membership isolation;
- guessed Tenant B Organization/User/Customer/payload/Tag identifiers return `null`;
- equal payloads resolve only to the current Organization and a similar Tenant B payload is hidden;
- requested foreign Organization rejection occurs before callback construction;
- forged User/Organization/tenant/Administrator token claims do not affect authority;
- current database Administrator role overrides a stale Employee token hint;
- malformed token, unknown binding, revoked binding and revoked Membership use the approved typed or
  generic disclosure-safe rejection paths;
- an Administrator downgrade and Membership revocation committed during a controlled pause are
  visible to the subsequent read and denied by RLS under `READ COMMITTED`;
- injection-shaped NFC payload input remains a parameter value;
- callback surface is frozen and contains exactly five read methods with no raw/write/list/role or
  actor capability;
- retained repository references expire after callback success or failure and cannot query through
  a released or subsequently re-leased pooled client;
- callback and PostgreSQL infrastructure errors are thrown, not converted into Business results;
- commit/rejection/rollback leave no role or actor-GUC residue on a reused pooled connection;
- WorkEvent, CanonicalDecision, TimeEntry, SyncReceipt and AuditEvent counts remain unchanged.

The full path uses the real B4 asymmetric verifier. There is no signature bypass, provider test-key
factory in production source, cloud credential, real person or production data.

## 6. CI Shape

The single existing workflow receives one isolated `backend-b5-read-model` job with Node 24.17.0,
PostgreSQL `17.10-alpine`, `npm ci`, a B4 identity dependency build, migrations `001`–`004`,
idempotent rerun plus ledger verification, tests-inclusive B5 typecheck, all B5 tests and B5 build.
Only official checkout/setup-node Actions and the local PostgreSQL service are used. All database
credentials and JWT material are synthetic and job-local.

The YAML parsed locally. After publication, GitHub Actions run `29264083804` passed all five jobs,
including the isolated B5 PostgreSQL/JWT job on Node 24.17.0 and PostgreSQL 17.10.

## 7. Local Verification

Local verification used Node.js `v24.17.0`, npm `11.13.0` and PostgreSQL `17.10`.

| Check | Result |
|---|---|
| Install exactly from lockfile | Passed; 562 packages installed, 569 audited; existing 11 moderate findings unchanged |
| B5 tests-inclusive TypeScript check | Passed |
| B5 direct PostgreSQL/JWT suite | 41 passed |
| B5 build | Passed |
| B4 tests-inclusive TypeScript check and build | Passed |
| B4 identity/JWT regression | 54 passed |
| B3 tests-inclusive TypeScript check and build | Passed |
| B3 schema/RLS regression | 125 passed |
| Root tests-inclusive TypeScript check | Passed for configured Core and Mobile production/test sources |
| Core tests | 262 passed |
| Mobile tests | 10 passed |
| B1 tests-inclusive TypeScript check and build | Passed |
| B1 direct PostgreSQL regression | 39 passed, 2 Supavisor modes skipped/unverified |
| Workspace/root build | Passed, including Core, B1, B3, B4 and B5 |
| CI YAML parse | Passed |
| `git diff --check` | Passed |
| Migrations `001`–`004` | No diff; SHA-256 unchanged |
| Core Domain/Business/ports | No diff |

## 8. Remaining Gates and Review Recommendation

- Technical Lead attack review is complete. It found and closed one blocking escaped-repository
  pool-capability lifetime defect before publication.
- GitHub Actions run `29264083804` passed all five jobs for implementation commit `68b7f44`.
- The independent Claude architecture/security review returned `APPROVED` with no P0/P1 findings.
- B6 lifecycle ingestion, any HTTP/API boundary, Mobile/Auth runtime composition, synchronization,
  Supabase/cloud resources and production credentials/data remain unauthorized.
- Production pooling/Supavisor modes, performance/load, observability, privacy retention/deletion,
  backup/restore, NFC payload security and physical-device validation remain open gates.
- The existing 11 moderate dependency findings remain open and unchanged; no automatic fix ran.

The scoped B5 implementation is closed. B6 remains a separate Human Architect authorization and
must not begin from this status.
