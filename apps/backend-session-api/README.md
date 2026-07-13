# TapTim.e Backend Session API — Block C1

This private Node 24 workspace exposes exactly one production-shaped transport boundary:

```text
GET /v1/session
Authorization: Bearer <Supabase access token>
```

The route accepts no request body, query, Organization, User, Membership or role. It composes the
existing B4 asymmetric verifier and PostgreSQL IdentityBinding/Membership resolver and returns only
the current server-authoritative `userId`, `membershipId`, `organizationId` and `role`. Every
response is JSON and `no-store`; invalid authority is disclosure-safe and infrastructure failure is
generic. No token, Authorization header, password or provider detail is logged.

The runtime database principal must be a non-owner `LOGIN NOINHERIT` principal with exactly
`taptime_identity_resolver`. This workspace contains no B5/B6 route, generic proxy, migration,
cloud setup, productive credential or production-data authorization.

The built managed-runtime entry point reads `TAPTIME_DATABASE_URL`, `SUPABASE_ISSUER` and an
optional `PORT` (default `3000`). It logs no request credentials or provider details.

Local tests require a disposable PostgreSQL 17 database and synthetic password:

```text
C1_DATABASE_URL=postgresql://<installer>@127.0.0.1:5432/taptime_c1
C1_RUNTIME_PASSWORD=<synthetic-test-only-password>
```

Run after building Core, schema and identity dependencies:

```bash
npm run typecheck --workspace=@taptime/backend-session-api
npm test --workspace=@taptime/backend-session-api
npm run build --workspace=@taptime/backend-session-api
```
