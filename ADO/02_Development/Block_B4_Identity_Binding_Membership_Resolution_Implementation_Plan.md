# Block B4 — Identity Binding and Authoritative Membership Resolution Implementation Plan

Status: Implemented — Awaiting Technical Lead Review; No B4 Approval or B5 Authorization Claimed
Date: 2026-07-13
Owner: Implementation Agent
Approval Authority: Technical Lead
Architecture Authority: `ADO/01_Architecture/ADR/ADR-0008-backend-tenant-isolation-and-async-foundation.md`

## Objective

Implement only the B4 server identity boundary:

```text
verified provider access token
  -> exact issuer + subject
  -> active IdentityBinding
  -> stable TapTim.e User
  -> current active Membership
  -> immutable server RequestActorContext
```

A token must never select or elevate a TapTim.e User, Organization, tenant or Membership role. No HTTP endpoint, Mobile integration, productive Supabase resource, B5 repository adapter or B6 lifecycle ingestion is part of this slice.

## Implementation Slices

1. Add migration `004` without changing completed migrations `001`–`003`.
2. Add the `taptime_identity_resolver` `NOLOGIN` role with no ownership, table grants, superuser privilege or `BYPASSRLS`.
3. Add one fixed-path `SECURITY DEFINER` function which resolves only a non-revoked `(issuer, subject)` binding joined to an existing User and current active Membership, returning only User ID, Organization ID, Membership ID and Membership role.
4. Add isolated Node 24 workspace `@taptime/backend-identity` with:
   - provider-neutral Access-Token-Verifier port;
   - production-shaped asymmetric-JWKS Supabase JWT verifier;
   - PostgreSQL Identity/Membership resolver;
   - request-actor orchestration service;
   - immutable `RequestActorContext` and discriminated accepted/rejected outcomes.
5. Add local asymmetric-key/JWKS and PostgreSQL adversarial tests for token validation, identity resolution, tenant/role claim rejection, least privilege and transaction/pool cleanup.
6. Add an isolated PostgreSQL 17 B4 CI job and record evidence without authorizing B5.

## Supabase User Access Token v1 Profile

Official Supabase documentation states that authenticated user Access Tokens are signed JWTs and that the required claims include `iss`, `aud`, `exp`, `iat`, `sub`, `role`, `aal`, `session_id`, `email`, `phone` and `is_anonymous`. Every Access Token contains a UUID `session_id`; authenticated user tokens use Audience and provider role `authenticated`, while anonymous/API/service-role examples do not represent a normal authenticated user session.

B4 therefore accepts only tokens which:

- have JOSE type `JWT` and a signature verified against the configured asymmetric JWKS;
- use an explicitly configured allowlist containing only `RS256` and/or `ES256`;
- match the exact configured issuer and Audience `authenticated`;
- bind JWKS exactly to `<issuer>/.well-known/jwks.json` and require HTTPS, except for numeric
  loopback HTTP used by synthetic local tests (`127.0.0.0/8` or `::1`);
- satisfy `exp` and optional `nbf` validation;
- contain a nonblank subject;
- contain the documented required user-Access-Token envelope, including a UUID `session_id`, provider role `authenticated`, `aal1` or `aal2`, and `is_anonymous = false`.

Email, phone, metadata, provider role and any custom Organization/User/role claims are not returned from the verifier and never participate in TapTim.e identity linking or authorization. Only verified `issuer + subject` cross into the resolver.

Primary sources:

- [Supabase JWT guide and JWKS verification](https://supabase.com/docs/guides/auth/jwts)
- [Supabase JWT Claims Reference](https://supabase.com/docs/guides/auth/jwt-fields)
- [Supabase User Sessions and mandatory `session_id`](https://supabase.com/docs/guides/auth/sessions)
- [Supabase Custom Access Token Hook required claims](https://supabase.com/docs/guides/auth/auth-hooks/custom-access-token-hook)

## Authorization and Disclosure Rules

- The resolver receives verified issuer and subject only.
- IdentityBinding and Membership must both be present and non-revoked; the referenced User must exist.
- Unknown, revoked and incomplete mappings produce the same no-resolution result and disclose no tenant data.
- Requested Organization is compared only after authoritative resolution and before any later tenant-owned lookup.
- Token/body User, Organization, tenant and TapTim.e role fields are ignored.
- Canonical Decision type, reason, actor, role, Organization and TimeEntry relations are never accepted as authoritative request values. B4 creates no CanonicalDecision and calls no lifecycle ingestion path.
- No custom email/profile matching or account linking exists.

## Database Security Shape

- Resolver role: `NOLOGIN`, `NOINHERIT`, non-owner, non-superuser, no database/role creation and no `BYPASSRLS`.
- Runtime login: synthetic test-only `NOINHERIT` login which may assume only the resolver role.
- Resolver role has schema usage plus execute on the single resolver function only.
- Resolver function has a fixed `pg_catalog, taptime_server, pg_temp` search path, fully qualified relations and `PUBLIC EXECUTE` revoked.
- Resolver role has no direct table `SELECT`, DML or DDL rights and cannot execute unrelated functions.
- Role and any request settings are transaction-local; commit and rollback cleanup are tested on reused pooled connections.

## Explicit Non-Goals and Gates

- No HTTP/API route, Supabase project, Auth user, secret, cloud resource or production data.
- No Mobile/UI login integration, secure token storage, refresh/offline-batch behavior or invitation/bootstrap flow.
- No B5 Organization/config adapter and no B6 WorkEvent/Decision/TimeEntry ingestion.
- No OAuth/multi-provider linking and no email-equality account merge.
- No retention, backup, clock or revocation-grace product rule.
- B5 remains unauthorized until B4 Technical Lead review is complete.

## Verification Gates

- B4 tests-inclusive TypeScript check, complete adversarial suite and build.
- Empty PostgreSQL migration through `001,002,003,004`, idempotent rerun and exact ledger verification.
- Backend-schema tests-inclusive TypeScript check, full 125-test B3 schema/RLS matrix and build.
- Root TypeScript check, 262 Core tests, 10 Mobile tests and workspace build.
- B1 TypeScript check, 39 direct PostgreSQL tests with two Supavisor skips permitted, and B1 build.
- `git diff --check`, exact file review and hash/diff proof that migrations `001`–`003` are unchanged.

## Implementation Outcome

The scoped implementation and its final security-correction round are complete in the uncommitted worktree. Migration `004` normalizes an existing resolver role and removes its parent roles; synthetic B3/B4 logins prove exact membership graphs; the JWKS endpoint is cryptographically anchored to the configured issuer and uses HTTPS except for numeric loopback test infrastructure; and the Context helper's non-authorizing boundary is explicit. The isolated `@taptime/backend-identity` workspace now has 54 adversarial JWT/PostgreSQL tests, while the B3 suite has 125. No HTTP API, cloud, Mobile, B5 or B6 behavior was added. The complete repository regression is recorded in `ADO/05_Evidence/Block_B4_Identity_Binding_Authoritative_Membership_Resolution_Evidence.md`. B4 remains awaiting Technical Lead review; B5 remains unauthorized.
