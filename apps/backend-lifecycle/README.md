# TapTim.e Backend Lifecycle — Block B6

This private Node 24 workspace is the non-production Block B6 proof for server-canonical,
per-WorkEvent lifecycle ingestion. It accepts only a raw access token, requested Organization,
WorkEvent NFC evidence and Receipt metadata. User, Membership, role, target snapshot, server
TimeEntry and all five CanonicalDecision results remain server authority.

One cohesive `READ COMMITTED` transaction verifies the existing concrete B4 asymmetric JWT
boundary, locks IdentityBinding and current active Membership, selects the fixed lifecycle role,
serializes one Organization/User with `pg_advisory_xact_lock`, locks the Assignment/Tag/Customer
snapshot and evaluates the unchanged Core `BusinessEngine`. It then atomically persists the exact
WorkEvent, required TimeEntry mutation, CanonicalDecision, synchronized Receipt and allowlisted
AuditEvent. No database client, actor, role selector or raw query escapes this coordinator.
Automatic evaluation also requires `occurredAt` to be within the locked Assignment, Tag and
Customer validity starts; earlier evidence is persisted as deferred without a fabricated result.

This is not an HTTP API, production repository adapter, cloud deployment, Mobile integration,
batch synchronization endpoint, historical/offline review flow or production-data authorization.
Only synthetic local/CI identities, keys, credentials and data are allowed.

Required direct PostgreSQL environment:

```text
B6_DATABASE_URL=postgresql://<installer>@127.0.0.1:5432/taptime_b6
B6_RUNTIME_PASSWORD=<synthetic-test-only-password>
```

The suite initializes a disposable schema with migrations `001` through `008` and creates a
separate `LOGIN NOINHERIT` runtime principal with exactly `taptime_identity_resolver` and
`taptime_server_lifecycle`. Run:

```bash
npm run build --workspace=@taptime/backend-schema
npm run build --workspace=@taptime/backend-identity
npm run typecheck --workspace=@taptime/backend-lifecycle
npm test --workspace=@taptime/backend-lifecycle
npm run build --workspace=@taptime/backend-lifecycle
```

Migration `005` exposes only fixed-search-path, `PUBLIC`-revoked lock helpers to their exact roles.
It adds no application table-mutation grant or RLS mutation policy.
