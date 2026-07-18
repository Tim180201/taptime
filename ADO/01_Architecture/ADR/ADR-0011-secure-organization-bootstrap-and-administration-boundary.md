# ADR-0011: Secure Organization Bootstrap and Administration Boundary

Status: Accepted by Human Architect — C3B/C3C/C3D/C3E1/C3E2 independently closed for their
authorized scopes; production gated
Date: 2026-07-14
Acceptance: Accepted 2026-07-14
Roadmap: Core Roadmap v2, Block C3 and later setup slices DT-063–DT-066
Owner: Technical Lead
Approval Authority: Human Architect
Related Artifacts: ADR-0006, ADR-0008, ADR-0009, FB-002, TS-002,
`ADO/02_Development/Block_C3A_Organization_Administration_Architecture_Authorization.md`,
`ADO/02_Development/Block_C3B_Secure_Organization_Bootstrap_Authorization.md`,
`ADO/02_Development/Block_C3B_Secure_Organization_Bootstrap_Closure.md`,
`ADO/02_Development/Block_C3C_Normal_Administration_Backend_Authorization.md`,
`ADO/02_Development/Block_C3C_Normal_Administration_Backend_Closure.md`,
`ADO/02_Development/Block_C3D_Admin_Web_Android_Capture_Authorization.md`,
`ADO/02_Development/Block_C3E1_Identity_First_Employee_Membership_Authorization.md`,
`ADO/02_Development/Block_C3_Organization_Administration_Implementation_Plan.md`,
`ADO/05_Evidence/Block_C3A_Independent_Architecture_Security_Review.md`,
`ADO/05_Evidence/Block_C3B_Independent_Architecture_Security_Review.md`,
`ADO/05_Evidence/Block_C3B_Secure_Organization_Bootstrap_Evidence.md`,
`ADO/05_Evidence/Block_C3C_Independent_Architecture_Security_Review.md`,
`ADO/05_Evidence/Block_C3C_Normal_Administration_Backend_Evidence.md`,
`ADO/05_Evidence/Block_C3D_Implementation_Evidence.md`,
`ADO/05_Evidence/Block_C3D_Physical_Validation_Evidence.md`,
`ADO/05_Evidence/Block_C3E1_Physical_Validation_Evidence.md`

## Decision-time context (2026-07-14)

This section records the source/runtime gaps that existed when the decision was accepted, before
the separately authorized C3C implementation. It is retained as decision provenance rather than a
claim about the 2026-07-15 local worktree.

The DT-017–DT-026 Core foundation proves Organization, Membership, Customer, NFC Tag and NFC
Assignment behavior in process. B3–B6 and C1/C2 later established PostgreSQL tenancy, real identity,
authenticated transport and server-canonical lifecycle behavior. No product path currently exposes
Organization creation or administration.

That absence is a safety boundary. The existing Core services are not transport authority:
`MembershipService` deliberately performs no authorization; `OrganizationManagementService` can
create an Organization without an actor; and `OrganizationAdministrationService.assignNfcTag`
accepts detached `Membership` and `NfcTag` objects. The existing `taptime_administrator` database
role is also broader than a minimal setup API and cannot create the first Organization or first
Administrator because its RLS checks already require an active Administrator Membership.

The current model has three additional product gaps that must be resolved before a usable setup
surface is built:

- `Customer` has no human-readable name and `NfcTag` has no operator label, so a UI would expose
  opaque UUIDs or raw NFC payloads;
- the DT-025 in-process result calls a missing target `cross_organization_access`, conflating
  authorization with resource state;
- Core in-memory adapters do not implement the temporal one-active-assignment and tenant-local
  payload constraints already enforced by PostgreSQL.

**Current implementation note (2026-07-15):** C3C implements required Customer/Tag display names,
the narrow normal-administration coordinator/database role, exact setup commands and the safe
projection around the unchanged Core authority limitations above. Implementation commit
`b90729a0a4b325f523cd98ea5a741defb00155f6` passed the 1,394-test matrix, three independent
exact-SHA reviews with zero open P0/P1/P2/P3 and all ten jobs in exact-head GitHub Actions run
`29375259275`. C3C is closed for its repository scope; this is neither UI nor production authority.

## Decision

### 1. Separate bootstrap, normal administration and presentation

C3 uses three non-interchangeable trust planes:

1. **Bootstrap operations plane.** A private operator-only CLI creates the first Organization and
   first Administrator. It is not an HTTP route, Mobile capability, Admin Web capability or product
   role.
2. **Normal administration plane.** An authenticated Administrator may execute a small fixed set of
   tenant-scoped setup commands through a dedicated server coordinator and database role. It may
   never submit a Membership, Organization, User or role as authority.
3. **Presentation and physical-capture plane.** Admin Web creates Customers and receives safe
   projections only. The complete first-Tag provisioning interaction runs in authenticated Android:
   select Customer, enter Tag label, capture and submit. A browser form never accepts, pairs or
   displays a raw UID.

Credentials, roles, pools and capabilities are not shared across these planes.

### 2. First Organization and Administrator bootstrap

The first Organization and first Administrator are provisioned by an audited human operator. The
target Administrator first obtains a valid token from the approved identity provider. The CLI reads
that access token only through a protected interactive/stdin channel, verifies it with the existing
issuer-bound B4 JWT verifier and passes only the verified issuer and subject into the bootstrap
transaction. Email, a client-supplied User ID and unverified profile claims are never linking
authority.

The named operator is an explicit privileged identity-attestation authority for this one bootstrap
capability. PostgreSQL receives verified issuer/subject values but cannot cryptographically prove
that the official CLI, rather than a direct invocation by the same authorized operator, performed
JWT verification. Individual short-lived authority, exact least privilege and immutable
`session_user` attribution are the control. A separately signed proof whose key is unavailable to
the operator would be a new trust plane and is not part of C3B.

The database operator is a separate identity from the target Administrator. Every bootstrap operator
uses an individual, non-shared `LOGIN NOINHERIT` principal whose opaque principal name is registered
to exactly one human in the operations/IAM inventory. A platform security administrator owns role
creation, expiry, rotation and revocation; the operator may not create or delegate principals. The
credential is short-lived, has `VALID UNTIL`, is delivered through the approved secret channel and
is never accepted in argv, an environment variable, repository content or normal application
configuration. Non-loopback connections require an allowlisted hostname and TLS `verify-full`;
production has no plaintext or numeric-host fallback.

The bootstrap command contains:

- a UUID request ID;
- a normalized Organization display name;
- verified issuer and subject derived from the token;
- no requested user, binding, Organization, Membership or role ID.

Names use one versioned contract, `taptime-name-v1`, pinned to Unicode 15.1. Decode strict UTF-8,
normalize to NFC, remove leading/trailing code points in Unicode 15.1's `White_Space` property, then
reject any remaining code point in General Categories `Cc`, `Cf`, `Cs`, `Co`, `Cn`, `Zl` or `Zp`.
Length is measured in Unicode scalar values and UTF-8 bytes after normalization: Organization and
Customer names require 1–120 scalars and at most 480 bytes; Tag labels require 1–80 scalars and at
most 320 bytes. PostgreSQL 17 must report UTF8 and internal Unicode 15.1 or migration `006` fails.
The versioned database normalization capability is authoritative; Node uses pinned UCD-15.1
property tables, rejects post-15.1 assignments before its newer normalizer runs and shares golden
vectors, but may not override a database rejection. A later Unicode upgrade is
`taptime-name-v2` plus a separate migration, never a silent v1 change.
Organization names are not globally unique and are never identity or authority.

The server generates every resource ID. The role is fixed to `administrator` and
`memberships.created_by_user_id` is `NULL`, because the authenticated database operator is not a
TapTim.e user role. An existing active IdentityBinding may be reused only when it belongs to the same
verified identity and its User has no Membership. A revoked/conflicting binding, any existing
Membership, or an identity concurrently provisioned elsewhere fails closed. Only an exact receipt
replay is exempt.

Migration `006` shall be installed only by an out-of-band PostgreSQL superuser and shall introduce
`taptime_bootstrap_executor NOLOGIN NOINHERIT NOBYPASSRLS` with
schema `USAGE`, no table grants and EXECUTE on one hardened capability. Each named operator LOGIN
has database `CONNECT` plus membership in that executor only and must explicitly
`SET LOCAL ROLE taptime_bootstrap_executor` inside the transaction; because the LOGIN is NOINHERIT
and has no direct schema/function grant, it cannot execute the capability before that step.
`session_user` therefore remains the named operator while `current_user` becomes the executor before
entry.

The SECURITY DEFINER function is owned by a distinct
`taptime_bootstrap_function_owner NOLOGIN NOINHERIT BYPASSRLS`. That owner has only schema `USAGE`
and exact `SELECT`/`INSERT` privileges on User, IdentityBinding, Organization, Membership,
bootstrap-receipt and AuditEvent storage; it has no `UPDATE`, `DELETE`, `TRUNCATE`, generic function
or role-membership capability. BYPASSRLS is the single explicit bridge across the forced policies and
is reachable only through this function. PUBLIC execution is revoked, SQL names are schema-qualified,
`search_path` is fixed to `pg_catalog`, and no ordinary API/bootstrap LOGIN can assume the owner.

One transaction shall:

1. lock the request ID and verified identity against concurrent bootstrap;
2. compare the append-only bootstrap receipt using the request ID, operator principal and a
   versioned canonical SHA-256 request hash;
3. establish or safely reuse the User and IdentityBinding;
4. create the Organization;
5. create its first active Administrator Membership;
6. append exactly three audit events for first execution: identity binding established/reused,
   Organization bootstrapped and first Administrator Membership granted;
7. insert the completed receipt and return the generated IDs.

Migration `006` adds an immutable nullable `operator_principal` column to AuditEvent storage. The
three bootstrap events have `actor_user_id = NULL`, the request ID as correlation ID and exact
`session_user` in `operator_principal`; the bootstrap receipt stores the same principal. They contain
no token, issuer, subject, email or NFC payload. Exact same-operator replay returns the original IDs
with `idempotentRetry: true` and appends no data or audit event. A different operator may not replay
or receive the stored result: the capability returns a typed rejection rather than raising a
transaction-aborting exception, commits one allowlisted `BootstrapReplayRejected` security audit
with `organization_id` from the receipt, `entity_type = 'BootstrapRequest'`,
`entity_id = request_id`, request ID correlation, the new operator principal and a safe reason-only
payload. The required `organization_id` references the receipt Organization, but payload/output
contain no generated User/Binding/Membership or other result IDs and disclose no stored result. Same
request ID with different content is a conflict. Audit rows alone are not an idempotency receipt.

Both bootstrap and normal commands use a non-ambiguous versioned tuple digest. Each field is encoded
as four-byte unsigned big-endian UTF-8 byte length followed by its exact bytes, prefixed by the ASCII
domain separator plus NUL byte `taptime:c3:v1\0`. UUID fields use canonical lowercase RFC 4122 text;
fixed command kinds/payloads use their exact ASCII representation. Field order is normative:

- bootstrap: `bootstrapOrganization`, canonical Organization name, exact verified issuer, exact
  verified subject;
- Customer creation: `createCustomer`, derived Organization ID, derived actor User ID, expected
  Membership ID, canonical display name;
- Tag provision: `provisionNfcTag`, derived Organization ID, derived actor User ID, expected
  Membership ID, Customer ID, canonical Tag label, canonical ADR-0009 payload.

Request/command ID is the receipt key rather than a tuple field. The database capability computes
the authoritative digest; Node must match its golden vectors.

No Supabase service-role key is required or permitted for this operation.

### 3. Normal Administrator write-session authority

Normal setup commands use a fourth database pool/login, distinct from the session, read-model and
lifecycle pools. A narrow role such as `taptime_admin_setup` receives only the exact read/insert
rights required by the fixed proposed setup commands. It receives no User, IdentityBinding, Membership,
Organization-update, delete, lifecycle or generic query capability. The existing broad
`taptime_administrator` grant surface is not exposed unchanged behind C3 routes.

An `AdminWriteSessionCoordinator` follows the proven B6 pattern in one READ WRITE transaction:

```text
verify access token
  -> lock and derive current User/Membership/Organization
  -> require active Administrator role
  -> require and compare expected Membership (narrowing only)
  -> take transaction-scoped (Organization, command ID) command lock
  -> only then inspect any command receipt
  -> set transaction-local actor, tenant, Membership, role and correlation context
  -> SET LOCAL ROLE taptime_admin_setup
  -> execute one fixed capability
  -> persist resource changes + command receipt + audit atomically
```

Every command and projection request must carry `expectedMembershipId` from the current resolved
session. Missing/malformed values are `invalid_request`; a mismatch with the locked current
Membership is `forbidden`. This comparison happens before receipt lookup or resource access, so a
stale client cannot write into a replacement Membership's Organization. The request body never
carries `organizationId`, `userId`, `role`, `active`, a complete Membership, a complete NfcTag or a
repository/SQL selector. IDs identify requested resources only and never grant tenant access. Tag
and target rows are reloaded under the current tenant in the same transaction. Capability objects
expire when the transaction callback settles.

Every mutation has a UUID command ID and an append-only receipt keyed by
`(organization_id, command_id)`. It stores actor User ID, expected Membership ID, command type, hash
version, canonical digest, safe result code and only the applicable generated Customer/Tag/Assignment
IDs. It never stores the request body, display-name input before normalization, token, issuer,
subject, email or raw/canonical NFC payload. After current authority comparison, exact actor,
Membership, type and digest replay returns the same safe result. Any authority, command-type or
content difference returns `command_id_conflict`/409. Database constraints and RLS remain the final
race authority.

After current-authority and expected-Membership checks, but before receipt lookup, the database takes
one transaction-scoped advisory lock over the versioned `(organization_id, command_id)` key. Two
Administrators in the same Organization using the same command ID therefore serialize: the winner
may create the receipt; the waiter re-reads it and deterministically returns stored success only for
the same actor/Membership/type/digest, otherwise `command_id_conflict`. The unique constraint remains
defence in depth; a caught unique violation must re-read and apply the same mapping, never leak a raw
database error. Hash-lock collisions may only over-serialize unrelated commands, not merge receipts.

### 4. Minimal usable setup data

The C3 runtime extension adds these required business fields before any Admin Web claim:

- `Customer.displayName`: `taptime-name-v1`, 1–120 scalars and at most 480 UTF-8 bytes;
- `NfcTag.displayName`: `taptime-name-v1`, 1–80 scalars and at most 320 UTF-8 bytes.

Neither name is authority or unique. Duplicate Customer names and Tag labels are permitted within
an Organization. A later optional customer number is a separate product decision.

The NFC payload remains the ADR-0009 canonical locator and is not a display name. New physical v1
registration accepts only `nfc:uid:v1:<UPPERCASE_HEX>` produced by the shared codec. Normal API
responses, Admin Web state, audit payloads and logs never contain the raw canonical payload. Safe
tag summaries expose only ID, display name, assignment state and a 12-character uppercase prefix of
SHA-256 over the canonical payload, explicitly labelled as a non-authoritative validation
fingerprint. The fingerprint is not an identity, secret, uniqueness proof or authorization factor.

### 5. Initial setup command surface

The smallest normal setup API is fixed and non-generic:

- create Customer from `{ expectedMembershipId, commandId, displayName }`;
- atomically register and assign one physical NFC Tag from
  `{ expectedMembershipId, commandId, customerId, displayName, canonicalPayload }`;
- read a bounded, paginated setup projection from `{ expectedMembershipId, cursor, limit }`,
  containing Organization, Customer and safe Tag/Assignment summaries.

The atomic register-and-assign command prevents a failed second write from leaving an orphan Tag in
the supported v1 flow. The backend produces `NfcTagRegistered` and `NfcTagAssigned` audit evidence
inside the same transaction. The raw payload exists only in an ephemeral transport-internal Android
coordinator value between native capture and submission; it never enters a React component/state,
persistent mobile record, Web flow, response or receipt.

C3C must extend the administrative audit trigger's explicit role allowlist to
`taptime_admin_setup`; the current exact-`taptime_administrator` check is insufficient. In the same
transaction, create Customer appends exactly one `CustomerCreated`; provision Tag appends exactly
one `NfcTagRegistered` and one `NfcTagAssigned`. Each uses the current derived User as
`actor_user_id`, `operator_principal = NULL` and command ID as correlation. Exact receipt replay and
every rollback append zero events. Audit payloads contain no raw UID, receipt digest or foreign ID.

The transport may use routes under `/v1/administration/`, but controller names do not grant generic
CRUD semantics. Extra JSON keys, duplicate security headers, malformed IDs, oversized bodies and
unsupported content types fail before the capability runs.

### 6. Result and disclosure vocabulary

Authorization and resource state are separate typed outcomes.

- invalid/expired identity, missing/revoked IdentityBinding or no active Membership returns
  disclosure-safe `unauthorized`;
- a current Employee, expected-Membership mismatch or role mismatch returns `forbidden` without
  revealing the reason;
- a missing, inactive or inaccessible Customer/AssignmentTarget returns
  `assignment_target_unavailable`; this exact result replaces DT-025's use of
  `cross_organization_access` for a missing Customer at the public C3 boundary;
- a tenant-local duplicate canonical payload under a different command returns
  `tag_payload_already_registered`;
- a reused command ID with different authority, type or normalized content returns
  `command_id_conflict`;
- infrastructure and deadline failures return `service_unavailable` and create no partial success.

Outcome precedence is fixed: current authority and expected Membership are checked first; an exact
receipt replay returns its stored success; a divergent receipt is `command_id_conflict`; then a
tenant-local existing payload under another command is always `tag_payload_already_registered`,
regardless of that Tag's Assignment state. `assignment_conflict` is reserved for the later explicit
assign/reassign capability and is not an initial provision result.

The same payload may exist in another Organization and is neither a conflict nor disclosed. Internal
diagnostics may distinguish absent, inactive and RLS-inaccessible states without including raw
identifiers or making that distinction observable to the caller. The legacy Core
`AssignNfcTagResult` remains historical in-process evidence and must not be serialized as the C3 API
contract.

### 7. Assignment history and later reassignment

V1 payload uniqueness is Organization-scoped. PostgreSQL's temporal Assignment model is normative:
one active Assignment per `(organization_id, nfc_tag_id)`, immutable historical rows and explicit
`valid_from`/`valid_to`.

The initial C3 setup command does not implicitly reassign a Tag. A later explicit reassignment
capability must lock the active Assignment and target, return the existing Assignment for an exact
same-target semantic retry, or atomically deactivate the old Assignment and append a new active one
for a different target using one timestamp and correlation ID. Historical WorkEvents retain their
old Assignment snapshot. Delete/overwrite is prohibited. That later command requires its own
authorization and tests.

### 8. Membership rules

The existing schema's one-active-Membership-per-User invariant is ratified for v1. The bootstrap
path is the only exception to normal Administrator authorization. Later normal Membership grants
require identity-first verified User provisioning and a currently active server-derived
Administrator. No pending invitation grants access. A last active Administrator may not be revoked
or demoted without an atomic transfer that leaves another active Administrator.

Membership invitation, revocation, self-revocation, role-change UI and general Membership CRUD are
not part of the initial C3 setup API and remain separately gated.

### 9. Organization state and physical provisioning

Organization existence is sufficient for v1; no active/inactive Organization status is introduced
by C3. Organization suspension requires a separate product/security decision because it affects
login, offline evidence, exports and retention.

ADR-0009 already decides the Android UID source and canonical codec. C3 registers an already encoded
physical Tag; it does not write NDEF content or claim iOS/Web NFC support. The supported initial
capture surface is authenticated Android and owns the complete provision interaction. "Protected"
means supported-client/session and current-Administrator gating, not device attestation or proof to
the server that a physical scan occurred. A future browser-only flow requires a short-lived,
single-use server claim token and separate review; raw UID copy/paste is not an approved fallback.

## Alternatives considered

### Public first-Organization signup

Rejected for the pilot. It would combine provider account creation, identity linking, privileged
tenant creation, abuse/rate limits and legal onboarding before those policies exist.

### Use `taptime_administrator` directly behind new routes

Rejected. Its current rights include Membership changes and deletes that exceed the setup surface,
and its RLS cannot bootstrap the first Administrator.

### Let the request send Core Membership/NfcTag objects

Rejected. Detached client objects are not current server authority and can create tenant, state and
existence-confusion defects.

### Display UUIDs or raw UID payloads until UI polish

Rejected. Customer/Tag names are a product contract required for usable setup, not decoration. A raw
UID is a technical locator and must not become normal presentation state.

### Silently reassign when a Tag already has an Assignment

Rejected. Reassignment changes future time attribution and must be explicit, transactional and
auditable.

## Consequences

Positive:

- first-tenant privilege is isolated from every normal product runtime;
- normal admin commands derive authority from current server state and least-privilege roles;
- exact receipts make bootstrap and setup retries durable and deterministic;
- missing/cross-tenant resources cannot be enumerated through result wording;
- setup data is human-readable without exposing raw NFC identifiers;
- current PostgreSQL assignment history and tenant constraints become the runtime authority.

Negative:

- C3 requires at least one additive migration and two isolated server capabilities before UI work;
- a protected Android capture step remains necessary for physical Tag registration;
- Membership management and reassignment are not available in the first setup slice;
- the current Core Customer/NfcTag shapes and in-memory administration service require additive C3
  reconciliation before they can support the real runtime.

## Implementation gates

C3B bootstrap implementation completed after Human Architect acceptance of this ADR, separate
continuation, implementation plan, direct PostgreSQL security matrix, rollback/concurrency tests,
Technical-Lead review, exact-head nine-job GitHub CI and independent security review. C3C normal
administration also completed its separately authorized repository cycle at implementation commit
`b90729a0a4b325f523cd98ea5a741defb00155f6`, after exact-SHA independent review and exact-head
ten-job GitHub CI. Admin Web/Mobile setup, production deployment and production personal data remain
outside this ADR's implementation authority at decision time. C3D later received its own exact
authorization and completed independent review, exact-head CI and the fresh Human physical gate.
That later closure does not authorize C3E1/C3E2 or production.

## C3D closure and C3E planning reconciliation (2026-07-15)

C3D realizes only the already accepted safe Admin Web/protected Android initial-setup boundary. It
does not change this ADR's Membership or Assignment-history decisions.

The former combined C3E planning label is now separated for review:

- **C3E1** defines identity-first Employee Membership enrollment through a separately reviewed,
  short-lived invitation/redemption capability. Its first package review returned six P2 contract
  findings and no P0/P1/P3; corrected commit `70d163f` passed zero-finding independent re-review and
  exact-head ten-of-ten CI. The Human Architect accepted the exact contract and separately authorized
  repository implementation on that baseline. Product correction `450d767`, harness correction
  `4338910` and the complete fresh Human physical gate later passed their required review, CI and
  observation gates. Closure commit `fe0781b` passed exact-head ten-of-ten run `29645336694`; its
  independent final review returned `APPROVED` with zero open P0/P1/P2/P3.
- **C3E2** remains the later explicit Tag reassignment capability. It must lock/deactivate/append
  Assignment history atomically and remains completely unauthorized.

The separation narrows authorization and review scope. The exact C3E1 token/cap,
historical-Membership, pre-Membership state, display-name, schema, HTTP, lock and audit contract is
accepted only as recorded in the C3E1 authorization package. C3E2 and production remain separate.

## C3E2 closure synchronization (2026-07-18)

The preceding C3E2 authorization wording is historical. The separately authorized explicit
reassignment implementation closed through final head `7050df4`, complete fresh
Galaxy-A33/NTAG213 Human Gate and ADO-only closure commit `a2fdebc`, tree `1872f9f`. Closure run
`29652072268` passed ten of ten and independent final review returned `APPROVED` with zero open
P0/P1/P2/P3. C3E2 is closed for its authorized local repository/device scope without changing this
ADR's accepted rules or granting production/deployment authority.

## Review triggers

Review this ADR before self-service signup, multiple active Memberships, invitations, additional
identity providers, Organization suspension, Membership revocation/demotion UI, explicit
reassignment, Web/iOS NFC capture, raw payload exposure, generic admin CRUD, production personal data
or a different bootstrap credential model.
