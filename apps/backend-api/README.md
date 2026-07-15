# TapTim.e Backend API — C3C/C3E1 transport

This private Node 24 workspace exposes the authenticated product API, the three fixed C3C
administration capabilities and the three separately bounded C3E1 operations:

```text
GET  /v1/session
POST /v1/scan-context/resolve
POST /v1/lifecycle-events
POST /v1/lifecycle-events/deferred

POST /v1/administration/customers
  { expectedMembershipId, commandId, displayName }
POST /v1/administration/nfc-tags/provision
  { expectedMembershipId, commandId, customerId, displayName, canonicalPayload }
POST /v1/administration/setup-projection
  { expectedMembershipId, cursor, limit }
POST /v1/administration/employee-invitations
  { expectedMembershipId, commandId, displayName }
POST /v1/administration/employee-memberships-projection
  { expectedMembershipId, cursor, limit }
POST /v1/employee-enrollment/redeem
  { commandId, invitationSecret }

Authorization: Bearer <Supabase access token>
```

Administration JSON is exact and bounded. Its UUID inputs must already be canonical lowercase text.
The expected Membership in the body is only a narrowing value: the server derives and locks the
current User, Organization, Membership and Administrator role. The lifecycle
`X-TapTime-Expected-Membership-Id` header is rejected on every administration route, so the body is
the single narrowing source. Raw NFC payloads are accepted only by the provision request and are
never returned or written to transport diagnostics.

The process owns six PostgreSQL pools with six distinct runtime login names:

- session: exactly `taptime_identity_resolver`;
- read model: `taptime_identity_resolver`, `taptime_employee` and `taptime_administrator`, with a
  read-only tenant transaction;
- lifecycle: `taptime_identity_resolver` and `taptime_server_lifecycle`;
- administration: only `taptime_identity_resolver` and `taptime_admin_setup`.
- Employee invitation/projection: only `taptime_identity_resolver` and
  `taptime_employee_invitation_creator`;
- pre-Membership redemption: only `taptime_employee_enrollment_redeemer`.

The runtime rejects duplicate database usernames. To prevent `node-postgres` query parameters from
silently replacing a login, endpoint, startup role or timeout, only TLS-related URL parameters are
accepted. Every administration operation receives the HTTP operation deadline, while its database
coordinator enforces transaction, statement and lock bounds before the HTTP timeout can be reported.
Infrastructure failures are generic; tokens, request bodies, database URLs, passwords and provider
or database errors are never diagnostic data.

The managed-runtime entry point requires:

```text
TAPTIME_SESSION_DATABASE_URL
TAPTIME_READ_MODEL_DATABASE_URL
TAPTIME_LIFECYCLE_DATABASE_URL
TAPTIME_ADMINISTRATION_DATABASE_URL
TAPTIME_EMPLOYEE_INVITATION_DATABASE_URL
TAPTIME_EMPLOYEE_ENROLLMENT_DATABASE_URL
SUPABASE_ISSUER
PORT                                      # optional, default 3000
```

Local C2 regression tests use disposable PostgreSQL 17 data, local asymmetric JWKS infrastructure
and synthetic-only `C2_*` variables. C3C's isolated administration workspace owns the database,
authority, receipt, audit and concurrency integration matrix; this workspace owns the exact HTTP
surface, status mapping, header/body hardening, deadline propagation and runtime composition.

This is not a production deployment: production secrets/data, Supavisor validation,
observability/rate policy and later C3E2 surfaces remain separate gates.

Run after building the administration contract, Core, schema, identity, read-model, lifecycle and
administration dependencies:

```bash
npm run typecheck --workspace=@taptime/backend-api
npm test --workspace=@taptime/backend-api
npm run build --workspace=@taptime/backend-api
```
