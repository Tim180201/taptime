# TapTim.e Backend API — Block C2

This private Node 24 workspace exposes exactly three production-shaped transport boundaries:

```text
GET  /v1/session
POST /v1/scan-context/resolve
POST /v1/lifecycle-events
Authorization: Bearer <Supabase access token>
```

The session route preserves C1's server-authoritative User, Membership, Organization and role
projection. Scan-context resolution treats the submitted payload as an opaque, case-sensitive
value and runs only through the approved B5 tenant read session. Lifecycle evidence runs only
through B6, whose genuine Core `BusinessEngine` remains the canonical decision source.

Every route independently verifies the configured issuer's asymmetric access token. The process
uses three separate PostgreSQL pools and distinct runtime login names:

- session: exactly `taptime_identity_resolver`;
- read model: `taptime_identity_resolver`, `taptime_employee` and
  `taptime_administrator`, with B5 enforcing a read-only transaction;
- lifecycle: `taptime_identity_resolver` and `taptime_server_lifecycle`.

The runtime rejects duplicate database usernames. Request JSON is exact and bounded, responses are
JSON and `no-store`, and infrastructure failures are generic. Tokens, request payloads, database
URLs, passwords and provider/database errors are never diagnostic data.

The three URL usernames must be distinct after percent-decoding. To prevent `node-postgres`
query parameters from silently replacing a login, endpoint, startup role or fixed timeout, only
TLS-related URL query parameters are accepted; all other connection parameters fail before pool
creation.

The managed-runtime entry point requires:

```text
TAPTIME_SESSION_DATABASE_URL
TAPTIME_READ_MODEL_DATABASE_URL
TAPTIME_LIFECYCLE_DATABASE_URL
SUPABASE_ISSUER
PORT                                      # optional, default 3000
```

Local tests use a disposable PostgreSQL 17 database, local asymmetric JWKS infrastructure and the
synthetic-only variables `C2_DATABASE_URL`, `C2_SESSION_DATABASE_URL`,
`C2_READ_MODEL_DATABASE_URL`, `C2_LIFECYCLE_DATABASE_URL` plus their three corresponding
`C2_*_RUNTIME_PASSWORD` values. No cloud resource or production credential is required.

This reviewed C2 transport foundation is not yet a production deployment: production secrets/data,
Supavisor validation, observability/rate policy and Blocks C3/D/E remain separate gates.

Run after building Core, schema, identity, read-model and lifecycle dependencies:

```bash
npm run typecheck --workspace=@taptime/backend-api
npm test --workspace=@taptime/backend-api
npm run build --workspace=@taptime/backend-api
```
