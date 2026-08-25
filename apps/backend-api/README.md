# TapTim.e Backend API — C3C/C3E1/C3E2 and offline synchronization transport

This private Node 24 workspace exposes the authenticated product API, the three fixed C3C
administration capabilities, the separately bounded C3E1/C3E2 operations and the complete offline
synchronization boundary:

```text
GET  /v1/session
POST /v1/scan-context/resolve
POST /v1/lifecycle-events
POST /v1/lifecycle-events/deferred
POST /v1/offline-capture-leases
  { commandId, installationBinding, lookupKey }
POST /v1/offline-capture-leases/page
  { leaseId, cursor, limit }
POST /v1/lifecycle-events/offline
  { organizationId, expectedMembershipId, leaseId, leaseItemId, installationBinding,
    deviceSequence, provenanceVersion, clock, workEvent, receipt }
POST /v1/lifecycle-events/reconcile
  { workEventIds }

POST /v1/administration/customers
  { expectedMembershipId, commandId, displayName }
POST /v1/administration/nfc-tags/provision
  { expectedMembershipId, commandId, customerId, displayName, canonicalPayload }
POST /v1/administration/nfc-tags/reassign
  { expectedMembershipId, commandId, nfcTagId, expectedActiveAssignmentId, targetCustomerId }
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

The process owns ten PostgreSQL pools with ten distinct runtime login names:

- session: exactly `taptime_identity_resolver`;
- read model: `taptime_identity_resolver`, `taptime_employee` and `taptime_administrator`, with a
  read-only tenant transaction;
- lifecycle: `taptime_identity_resolver` and `taptime_server_lifecycle`;
- administration: only `taptime_identity_resolver` and `taptime_admin_setup`;
- Employee invitation/projection: only `taptime_identity_resolver` and
  `taptime_employee_invitation_creator`;
- pre-Membership redemption: only `taptime_employee_enrollment_redeemer`;
- NFC reassignment: only `taptime_identity_resolver` and `taptime_assignment_reassigner`;
- offline lease issue/page: only `taptime_identity_resolver` and
  `taptime_offline_lease_issuer`;
- offline lifecycle ingestion: only `taptime_identity_resolver` and
  `taptime_offline_event_ingestor`;
- offline reconciliation: only `taptime_identity_resolver` and
  `taptime_offline_reconciliation_reader`.

The runtime rejects duplicate database usernames. To prevent `node-postgres` query parameters from
silently replacing a login, endpoint, startup role or timeout, only TLS-related URL parameters are
accepted. Every administration operation receives the HTTP operation deadline, while its database
coordinator enforces transaction, statement and lock bounds before the HTTP timeout can be reported.
Infrastructure failures are generic; tokens, request bodies, database URLs, passwords and provider
or database errors are never diagnostic data.

Every `/v1` and `/v2` request is limited per client address to 300 attempts per minute. Invitation
redemption is additionally limited to five attempts per minute. The process keeps only an
ephemeral HMAC feature of the address; windows disappear after one minute and are never persisted
or sent to diagnostics. The process bounds active windows and fails closed until the earliest
window expires instead of growing without limit. Production uses
`TAPTIME_CLIENT_ADDRESS_MODE=trusted_proxy`: Caddy
overwrites both `X-Forwarded-For` and `X-TapTime-Proxy-Secret`, while the API rejects forwarded
addresses without the matching proof. Local direct access must explicitly use
`TAPTIME_CLIENT_ADDRESS_MODE=direct`; in that mode forwarded headers are ignored.

The managed-runtime entry point requires:

```text
TAPTIME_SESSION_DATABASE_URL
TAPTIME_READ_MODEL_DATABASE_URL
TAPTIME_LIFECYCLE_DATABASE_URL
TAPTIME_ADMINISTRATION_DATABASE_URL
TAPTIME_EMPLOYEE_INVITATION_DATABASE_URL
TAPTIME_EMPLOYEE_ENROLLMENT_DATABASE_URL
TAPTIME_REASSIGNMENT_DATABASE_URL
TAPTIME_OFFLINE_LEASE_DATABASE_URL
TAPTIME_OFFLINE_EVENT_DATABASE_URL
TAPTIME_OFFLINE_RECONCILIATION_DATABASE_URL
SUPABASE_ISSUER
TAPTIME_CLIENT_ADDRESS_MODE              # direct or trusted_proxy
PORT                                      # optional, default 3000
```

In trusted-proxy mode, both Caddy and the API read the same canonical 43-character base64url
secret from `/run/secrets/taptime_proxy_shared_secret`. On the server, Compose mounts the
root-owned source `/opt/taptime/secrets/proxy-shared-secret`. The source file must contain exactly
the value for 32 random bytes, with no trailing newline.

Local C2 regression tests use disposable PostgreSQL 17 data, local asymmetric JWKS infrastructure
and synthetic-only `C2_*` variables. The isolated administration and offline-synchronization
workspaces own their database, authority, receipt, audit, reconciliation and concurrency
integration matrices; this workspace owns the exact HTTP surface, status mapping, header/body
hardening, deadline propagation and runtime composition.

Production secrets/data and the production release remain separate gates.

Run after building the administration and offline contracts plus Core, schema, identity,
read-model, lifecycle, administration and offline-synchronization dependencies:

```bash
npm run typecheck --workspace=@taptime/backend-api
npm test --workspace=@taptime/backend-api
npm run build --workspace=@taptime/backend-api
```
