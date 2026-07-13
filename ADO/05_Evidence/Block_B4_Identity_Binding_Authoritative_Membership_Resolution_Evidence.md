# Block B4 — Identity Binding and Authoritative Membership Resolution Evidence

Status: Implemented — Awaiting Technical Lead Review; No B4 or B5 Approval Claimed
Date: 2026-07-13
Owner: Implementation Agent
Architecture authority: `ADO/01_Architecture/ADR/ADR-0008-backend-tenant-isolation-and-async-foundation.md`

## 1. Proven Slice

B4 implements and tests exactly this server boundary:

```text
asymmetrically signed provider access token
  -> exact issuer + subject
  -> active IdentityBinding
  -> stable TapTim.e User
  -> current active Membership
  -> immutable RequestActorContext
```

The verifier emits only verified issuer and subject. The PostgreSQL resolver derives User, Organization, Membership and current Membership role from server data. The orchestration service compares the requested Organization with that resolved Organization before any later tenant-owned lookup. Token or request claims cannot select or elevate TapTim.e User, Organization, tenant or role.

This is an implementation awaiting review, not approval of B4 and not authorization for B5.

## 2. Implementation Inventory

| Boundary | Implementation | Security property |
|---|---|---|
| Provider-neutral verification port | `AccessTokenVerifier` | Exact asynchronous result contract; no provider profile leaks into callers |
| Supabase v1 JWT verifier | `SupabaseJwtAccessTokenVerifier` | HTTPS asymmetric JWKS fixed to `<issuer>/.well-known/jwks.json`; HTTP only for numeric loopback tests; exact issuer, Audience `authenticated`, expiration/optional `nbf`, nonblank subject, `JWT` type, strict `RS256`/`ES256` runtime allowlist |
| Database resolver port | `IdentityMembershipResolver` | Accepts only verified issuer and subject |
| PostgreSQL resolver | `PostgresIdentityMembershipResolver` | Transaction-local `SET ROLE`; calls one function; typed resolved/not-resolved outcome |
| Server orchestrator | `RequestActorResolutionService` | Generic missing/revoked rejection; requested-Organization comparison after authoritative resolution |
| Request authority | frozen `RequestActorContext` | Contains only database-derived User ID, Organization ID, Membership ID and current role |
| Context propagation proof | `withRequestActorTransaction` | Uses transaction-local settings; commit and rollback cleanup proven on a reused connection |

No Core, Mobile, Business Engine, product behavior or completed B3 migration was changed.

## 3. Supabase Access-Token Profile

The accepted v1 profile is based only on official Supabase primary sources:

- [JWT guide and asymmetric JWKS verification](https://supabase.com/docs/guides/auth/jwts)
- [JWT Claims Reference](https://supabase.com/docs/guides/auth/jwt-fields)
- [User Sessions and `session_id`](https://supabase.com/docs/guides/auth/sessions)
- [Custom Access Token Hook required claims](https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook)

B4 requires JOSE type `JWT`; a verified asymmetric signature; configured algorithm `RS256` or `ES256`; exact configured `iss`; Audience `authenticated`; valid `exp`; valid `nbf` when present; nonblank `sub`; `iat`; a UUID `session_id`; provider role `authenticated`; `aal1` or `aal2`; `is_anonymous = false`; and documented email/phone fields. The JWKS URL must be exactly `<issuer>/.well-known/jwks.json`; combining an expected issuer with an unrelated key endpoint is rejected during configuration. Issuer and derived JWKS must use HTTPS in production. HTTP is accepted only for numeric loopback addresses (`127.0.0.0/8` and `::1`) used by synthetic local tests. Remote HTTP, `localhost`, loopback-lookalike DNS hosts and non-HTTP(S) protocols fail closed during configuration. Provider role, email, phone, metadata and all custom claims are discarded. In particular, email/profile equality never creates or changes an IdentityBinding.

The automated suite uses an ephemeral `127.0.0.1` HTTP JWKS endpoint backed by a locally generated RSA key pair; an additional configuration test proves `::1` is also accepted. This is the only unencrypted transport exception. The production code has no pinned-key/test factory or signature bypass. No Supabase project, cloud resource, real secret or personal data was used.

## 4. Migration 004 and Least Privilege

Migration `004_identity_membership_resolver.sql` is additive. It introduces:

- `taptime_identity_resolver`: unconditionally normalized to `NOLOGIN`, `NOINHERIT`, non-superuser, non-owner, no role/database creation, no replication and no `BYPASSRLS`, including when the role already exists;
- deterministic revocation of every parent-role membership held by the resolver role, followed by a fail-closed zero-membership assertion;
- `taptime_server.resolve_request_actor(text, text)`: a `STABLE SECURITY DEFINER` SQL function with fixed `pg_catalog, taptime_server, pg_temp` search path and fully qualified relations;
- exact function execution plus schema usage for the resolver role;
- explicit revocation of all table, sequence and other function privileges from that role and `PUBLIC EXECUTE` from the resolver function.

The test runtime login is synthetic, `NOINHERIT`, and has exactly one `pg_auth_members` parent: the resolver role. The resolver role itself has no parent role. The migration proof deliberately pre-contaminates the existing resolver with privileged attributes and a synthetic parent before applying migration `004`. Tests prove normalization, direct access to `identity_bindings`, `memberships`, `users` and `organizations` fails with `42501`, an unrelated schema function cannot be executed, and DDL/role/ownership changes are denied. The B3 fixture now revokes all four Application Roles before granting each target role; its contamination test proves every B3 login again owns exactly one intended parent role after repeated setup.

Migrations `001`–`003` have no Git diff. The ledger contains exactly `001,002,003,004`, all checksums are recorded, and a rerun reports every version already applied.

## 5. Adversarial Test Matrix

The 54 direct-PostgreSQL/JWT tests cover:

- valid asymmetric access-token verification and minimal frozen identity output;
- wrong signature, issuer and Audience; expired and not-yet-valid tokens; missing/blank subject; wrong JOSE type; malformed token;
- `none`, symmetric algorithm confusion, unsafe runtime algorithm configuration and issuer/JWKS mismatch configuration;
- successful HTTPS and numeric IPv4/IPv6-loopback configuration plus fail-closed remote HTTP,
  `localhost`, lookalike hostname, `ftp:` and `file:` configuration;
- unsuitable provider roles, anonymous session and missing provider session identifier;
- active, unknown, revoked and incomplete binding/Membership states with one generic disclosure-safe failure;
- immediate loss of normal access after Membership revocation;
- issuer-qualified identity when the same subject exists at another issuer;
- forged User, Organization, tenant, role and TimeEntry claims ignored;
- database Employee resisting claimed Administrator elevation and database Administrator overriding a stale Employee claim;
- foreign requested Organization rejected without Tenant B disclosure;
- no email/profile-based linking;
- request-supplied Decision/lifecycle fields ignored and no CanonicalDecision written;
- resolver role/login attributes, ownership, exact `pg_auth_members` graph, exact grant surface, safe function shape and direct table/function/DDL denials;
- `RESET ROLE` denial and pool role/context cleanup after success, commit and rollback;
- migration ordering, ledger checksums and idempotent rerun.

The B3 regression is now 125/125 passing. Its added test contaminates a B3 login with the resolver role, reruns synthetic-login setup and proves all three B3 logins have exactly their intended role. Migration `004` did not weaken existing constraints, RLS, grants, append-only evidence or audit behavior.

## 6. Carry-Forward and Block Boundaries

B4 defines no lifecycle ingestion contract and never persists a CanonicalDecision. The adversarial command test supplies `decision_type`, `reason`, User, Organization, role and TimeEntry fields at runtime; the resolver ignores them and the database contains zero Decisions afterward. For B6, these values remain mandatory server outputs derived from the real Core `BusinessEngine.evaluate()`, never request authority.

`withRequestActorTransaction` only propagates a `RequestActorContext` already produced by authoritative resolution into transaction-local settings. It performs neither role selection nor Membership resolution/authorization. B5 must verify active Membership and apply a restricted runtime role plus RLS inside the actual tenant transaction; this requirement is documented but not implemented because B5 remains unauthorized.

Deliberately not implemented or proven:

- HTTP endpoints, productive PostgreSQL/Supabase resources or real Auth users;
- Mobile login/token storage, refresh-token or offline-batch handling;
- B5 Organization/config adapters or B6 lifecycle ingestion;
- first-Administrator bootstrap, invitations or OAuth/multi-provider linking;
- production pooling/Supavisor modes, cloud key rotation/network failure behavior or deployment configuration;
- execution of the new GitHub-hosted B4 job, which cannot occur before the uncommitted worktree enters review; its YAML and local commands are verified;
- legal retention, erasure/anonymization, backup/restore, clock or revocation-grace product rules.

The existing 11 moderate dependency findings remain open and unchanged; no automated dependency remediation was performed.

## 7. Verification Evidence

Local direct verification used Node.js 24.17.0, npm 11.13.0 and PostgreSQL 17.10 with synthetic data only.

| Check | Result |
|---|---|
| B4 tests-inclusive TypeScript check | Passed |
| B4 adversarial suite | 54 passed |
| B4 build | Passed |
| Backend-schema tests-inclusive TypeScript check | Passed |
| Backend-schema constraint/RLS suite | 125 passed |
| Backend-schema build | Passed |
| Install exactly from lockfile | `npm ci` passed; 565 packages audited, existing 11 moderate findings remain |
| Migration rerun and ledger | `applied=none`, `existing=001,002,003,004`; exact ledger verified |
| Root TypeScript check | Passed; Core and Mobile test sources included by their configured checks |
| Core suite | 262 passed |
| Mobile suite | 10 passed |
| Workspace build | Passed for Core, B1, B3 and B4 workspaces with build scripts |
| B1 tests-inclusive TypeScript check | Passed |
| B1 direct PostgreSQL regression | 39 passed, 2 Supavisor modes skipped/unverified |
| B1 build | Passed |
| Workflow YAML structure | Parsed successfully |
| `git diff --check` | Passed |
| Completed B3 migrations `001`–`003` | No diff against `HEAD` |

The isolated GitHub Actions B4 job uses Node 24.17.0, PostgreSQL 17.10, `npm ci`, migrations `001`–`004`, migration rerun/ledger verification, B4 tests-inclusive typecheck, all adversarial tests and the B4 build. Credentials and keys are synthetic and local to the job.

## 8. Review Recommendation

B4 is ready for Technical Lead review after the final full repository regression recorded for this worktree. B5 remains unauthorized until that review explicitly accepts the identity boundary, JWT profile, resolver privilege surface and remaining gates.
