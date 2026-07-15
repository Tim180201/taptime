# Block C3E1 — Identity-First Employee Membership Authorization Package

Status: **HUMAN-ACCEPTED — C3E1 REPOSITORY IMPLEMENTATION AUTHORIZED ON EXACT BASELINE; C3E2/PRODUCTION UNAUTHORIZED**
Package Authorization Date: 2026-07-15
Exact Package Baseline: `a0419866c2b992ae8fc5474144064bc0652d215a`
Independent Review Commit: `4e3ae76f4fdfad751e31b546aa4b1a63e04a67ee`
Independent Review Verdict: `CHANGES REQUIRED` — six P2 C3E1 contract findings; no P0/P1/P3
Corrected Review Commit: `70d163fa0473692f61555f1580f25382e1e807af`
Corrected Review Tree: `33e5f7a94d49fadcab4f8f14b6fa842a55aad928`
Corrected Exact-head CI: GitHub Actions `29410078768`, attempt 1, ten of ten jobs passed
Corrected Independent Re-review Verdict: `APPROVED` — no open P0/P1/P2/P3
Human Acceptance and Implementation Authorization Date: 2026-07-15
Exact Implementation Baseline: `70d163fa0473692f61555f1580f25382e1e807af`
Human Authority: Human Architect explicitly accepted every Section-12 product/policy decision and,
in a later separate statement, authorized the exact C3E1 repository implementation on the baseline
above. C3E2, production resources/data and any Physical Gate remain unauthorized.
Owner: Technical Lead
Governing Architecture: Accepted ADR-0008, ADR-0011, FB-002 v1.2 and TS-002 v1.3
Proposed Effort: Very High
Production authority: Not granted
C3E2 reassignment authority: Not granted

## 1. Objective

Prepare the smallest repository implementation slice that can add an Employee Membership without
accepting email, provider subject, User ID, Organization ID, role or a detached Membership object as
client-supplied authority.

C3E1 is separated from C3E2 because identity onboarding and Tag reassignment cross different
privileged boundaries. C3E1 concerns provider identity, User/IdentityBinding creation, Membership
authority and pre-Membership client state. C3E2 changes future time attribution and Assignment
history. Combining them would make independent authorization, rollback and security review weaker.

After independent zero-finding re-review and explicit Human acceptance, this document is the
normative authorization for the exact C3E1 repository slice described below. It authorizes migration
`008`, the named least-privilege roles/pools, the three exact backend operations, the bounded Admin
Web/Android changes and their tests. It does not authorize C3E2, a cloud resource, production data,
provider-account creation, deployment/distribution or a Physical Gate.

## 2. Repository evidence and rejected shortcuts

The current repository already provides:

- one active Membership per User and one Membership per Organization/User;
- issuer/subject-unique IdentityBindings and the concrete B4 verifier/resolver;
- forced-RLS Membership policies and append-only `MembershipGranted` audit behavior;
- C3C's current-Administrator transaction pattern, expected-Membership narrowing, receipts,
  deadlines and disclosure-safe transport; and
- Admin Web and Android session/capture surfaces proven by C3D.

It does not provide a safe bridge from a verified provider identity without a Membership to a
current Administrator. Existing `taptime_administrator` rights are intentionally too broad for a
new route. The following shortcuts are therefore rejected:

- administrator-entered email, provider subject, issuer or User UUID;
- Supabase service-role keys in Admin Web, Mobile or the normal API runtime;
- public/self-service Organization signup or automatic Membership on first login;
- direct use of the broad `taptime_administrator` role behind HTTP;
- a pending invitation that grants any Organization read or lifecycle authority;
- direct SQL seeding as product or Human-gate evidence; and
- adding revocation, role changes, additional Administrators or reassignment to this slice.

## 3. Proposed v1 enrollment contract

### 3.1 Administrator creates an Employee invitation

1. A signed-in Admin Web caller supplies only its current expected Membership ID, a cryptographic
   command UUID and an Organization-local Employee display name.
2. The server verifies the access token and resolves/locks the current exact Administrator
   Membership using the existing B4/C3C authority pattern. Organization, actor and role are derived
   only from that transaction.
3. A dedicated enrollment capability creates a short-lived Organization-bound invitation and a
   server-generated one-time secret. The stored row contains only a domain-separated digest of the
   secret, expiry, creator User/Membership, safe display name and lifecycle metadata.
4. The plaintext secret is returned exactly once. It is memory-only presentation state and is
   cleared on sign-out, navigation, explicit dismissal, timeout or coordinator replacement. It is
   never stored in a receipt, audit event, browser storage, URL, log or analytics event.
5. Creating an invitation grants no Membership and no read, scan, setup or lifecycle authority.

### 3.2 A verified provider identity redeems the invitation

1. The prospective Employee must already possess an email/password provider account. Provider
   account creation, email delivery and self-service signup are outside C3E1.
2. Android enters this path only after the user deliberately selects a volatile
   `employee_enrollment` intent and the existing private Supabase adapter returns a provider session.
   The normal `/v1/session` request still runs first. A 200 response creates the unchanged product
   session. A 401 in normal sign-in retains the existing clear-and-local-sign-out behavior; only a
   401 while the same generation is in explicit enrollment intent may retain the provider session
   inside an authority-free `enrollment_only` shell. That 401 is not proof of eligibility and grants
   no server or tenant context.
3. The private enrollment coordinator submits the one-time secret to a dedicated redemption route.
   The route verifies the provider token directly; it does not require or invent a Membership.
4. One transaction hashes and locks the invitation, revalidates the invitation creator's exact
   still-active Administrator Membership, locks the issuer/subject identity namespace and any
   Binding/User rows, and rejects the identity if its resolved User has **any Membership row ever** —
   active or revoked, in the invitation Organization or another Organization. C3E1 therefore does
   not implement re-onboarding or Organization transfer.
5. If the identity has no binding, the transaction creates the internal User and IdentityBinding
   first. It then creates exactly one active `employee` Membership using the invitation's derived
   Organization, creator and display name. User/IdentityBinding/Membership, invitation consumption,
   receipt and AuditEvent commit atomically or not at all.
6. After success, the normal C1 `/v1/session` path must independently resolve the new Employee
   Membership. The enrollment coordinator cannot construct a product session itself.

The historical-Membership rule is deliberately fail-closed: an active Binding whose User has zero
Membership rows may redeem; a revoked Binding, conflicting Binding, active Membership or historical
Membership always produces `enrollment_unavailable`. Re-onboarding, Membership transfer and reuse of
a formerly revoked User require a separate Human product/policy decision outside C3E1.

No request supplies Organization, User, Membership, creator, role or active state. The secret is a
single-use enrollment credential, not identity authority; the verified provider token and locked
current Administrator invitation are both mandatory.

## 4. Proposed schema and capability boundary

A later separately authorized implementation may add migration `008` with:

- nullable `memberships.display_name`, validated by the existing database-authoritative
  `taptime-name-v1` contract; every C3E1-created Employee Membership must have a non-null name,
  while existing bootstrap/synthetic Memberships are not fabricated or silently backfilled;
- an `employee_membership_invitations` table containing Organization, invitation ID, creator User
  and exact creator Membership, display name, token digest, created/expiry/consumed timestamps,
  consumed IdentityBinding/User/Membership IDs, redemption command ID and row version;
- append-only command receipts for invitation creation and redemption, bound to command type,
  actor/identity, invitation, canonical digest and safe result; and
- exact constraints for one-time consumption, expiry ordering, creator tenant binding and consumed
  Membership/User consistency.

The later implementation must use distinct least-privilege enrollment roles/pools for:

- current-Administrator invitation creation (`taptime_employee_invitation_creator`, a distinct
  LOGIN/pool, `taptime_employee_invitation_function_owner` and
  `taptime_employee_invitation_data_function_owner`); and
- provider-identity redemption before a Membership exists (`taptime_employee_enrollment_redeemer`,
  a distinct LOGIN/pool, `taptime_employee_redemption_function_owner` and
  `taptime_employee_redemption_data_function_owner`).

Neither role may inherit `taptime_administrator`, `taptime_admin_setup`, lifecycle, bootstrap or
identity-resolver table authority. Direct table access is denied except to narrowly separated
NOLOGIN function owners with exact column grants. Each runtime role may execute only its own public
entrypoint; each orchestration owner may execute only its own narrowly owned data helpers.
Security-definer functions use a fixed `pg_catalog, taptime_server` search path and no dynamic SQL.

The invitation creator is the Membership grant authority. A C3E1-created Membership stores
`created_by_user_id = invitation.creator_user_id`. The redeeming provider IdentityBinding is durable
redemption provenance, stored only as `consumed_identity_binding_id` on the invitation and the
redemption receipt; issuer, subject and provider metadata are never copied into invitation, receipt,
audit or response data.

Migration `008` must extend the existing `append_administrative_audit_event()` function, preserve
its SECURITY DEFINER owner/insertion boundary and attach it to the new invitation table. The
existing `taptime_administrator`/`taptime_admin_setup` behavior remains byte-for-byte equivalent;
the two new selected roles receive these exact additional allowlists:

- `taptime_employee_invitation_creator` may produce exactly one
  `EmployeeMembershipInvitationCreated` audit for one invitation INSERT, with
  `actor_user_id = creator_user_id`, the invitation as entity, the create command ID as correlation
  and safe expiry/display-name metadata only;
- `taptime_employee_enrollment_redeemer` may produce exactly one existing `MembershipGranted` audit
  for one `employee` Membership INSERT, with `actor_user_id = creator_user_id`, the new Membership as
  entity, the redemption command ID as correlation and role-only payload; and
- for either new selected role, every other table/operation combination raises `42501` before
  commit.

The redeem function derives the audit actor context from the locked invitation/creator Membership,
never from the provider request. Immediately before the audited Membership INSERT it sets the
transaction-local `app.organization_id`, `app.user_id`, `app.membership_id`,
`app.membership_role = 'administrator'` and `app.correlation_id` from that locked Organization,
creator User, creator Membership and redemption command. The trigger therefore continues to obtain
its actor from the existing database context helper while the new selected-role branch determines
the only permitted operation. User/IdentityBinding creation produces no administrative audit; their
provenance is the bound redemption receipt/invitation record. Exact replay, rejection and rollback
produce zero additional audit rows.

## 5. Invitation-secret, limit, replay and lock rules

- The server generates exactly 32 cryptographically random octets and encodes them as unpadded
  base64url. The only canonical plaintext form is exactly 43 ASCII characters matching
  `^[A-Za-z0-9_-]{43}$`. Decoding must produce exactly 32 bytes and re-encoding those bytes must
  reproduce the submitted text byte-for-byte, rejecting non-zero trailing pad bits as well as every
  alternate alphabet, padding or normalization.
- Storage uses exactly
  `sha256(convert_to('taptime:c3e1:employee-invitation:v1', 'UTF8') || decode('00', 'hex') ||
  secret_bytes)` and stores only the 32-byte digest. Plaintext storage, recoverable encryption and
  hashing the textual encoding instead of the decoded 32 bytes are prohibited.
- The server fixes `created_at = transaction_timestamp()` and
  `expires_at = transaction_timestamp() + interval '15 minutes'`; the client cannot select or extend
  TTL. At `transaction_timestamp() >= expires_at` the invitation is expired.
- An Organization may have at most **five** active invitations. Active means
  `consumed_at IS NULL AND expires_at > transaction_timestamp()`; expired and consumed historical
  rows remain immutable but do not count.
- Creation first serializes the exact Organization/command replay namespace, resolves exact receipt
  replay/conflict, then acquires an Organization-wide transaction advisory lock using
  `pg_advisory_xact_lock(hashtextextended('taptime:c3e1:invitation-cap:v1:' ||
  length(organization_id::text) || ':' || organization_id::text, 0))`. Under that lock it counts
  active rows and inserts only when the pre-insert count is below five. Different commands cannot
  race past the cap. Exact replay is evaluated before the cap and never inserts or counts twice.
- Expired, absent, already-used by another command/identity, wrong-Organization, stale creator,
  revoked/conflicting Binding, any active or historical Membership and every other inaccessible
  canonical-secret state map to the same external `enrollment_unavailable` result.
- Exact invitation-create retry never re-discloses the secret because plaintext is not stored. It
  returns `invitation_created_token_unavailable`; the UI may explicitly create a fresh invitation.
- Exact redemption retry returns the original safe success only for the same command ID and same
  still-active verified IdentityBinding/User/resulting Employee Membership recorded by the consumed
  invitation. It creates no write/audit. A different command or identity receives only
  `enrollment_unavailable`.
- Creator revocation after a successfully committed redemption does not retroactively revoke the
  Employee Membership. The exact same-identity/same-command replay above remains successful even if
  the creator is later revoked, because it confirms an existing result and grants no new authority.
  Creator revocation before the first successful consumption always fails closed.
- Tokens are prohibited from query strings, route parameters, crash reports, clipboard automation,
  persistent state, receipts and audit payloads. A deliberate user-initiated OS copy action remains
  outside this package and is not authorized.

### 5.1 First-redemption transaction lock order

After issuer-bound provider-token verification outside PostgreSQL, every first redemption uses this
fixed order; no implementation may reorder it:

1. decode/canonical-check the secret, compute the domain-separated digest and acquire a digest-bound
   transaction advisory lock;
2. select the invitation by digest `FOR UPDATE`;
3. select its exact creator Membership `(organization_id, membership_id, creator_user_id)`
   `FOR SHARE` and require active `administrator` authority;
4. acquire the **existing bootstrap-compatible** issuer/subject advisory namespace: calculate
   `sha256(convert_to('taptime:c3:identity:v1', 'UTF8') || decode('00', 'hex') ||
   int4send(octet_length(convert_to(issuer, 'UTF8'))) || convert_to(issuer, 'UTF8') ||
   int4send(octet_length(convert_to(subject, 'UTF8'))) || convert_to(subject, 'UTF8'))`, hex-encode
   that digest and lock `hashtextextended(encoded_digest, 0)` exactly as migration `006` does;
5. select any IdentityBinding for exact issuer/subject `FOR SHARE`; a revoked or conflicting Binding
   fails closed, otherwise derive its User ID or generate the new User ID while the namespace lock
   is held;
6. acquire the existing bootstrap-compatible User advisory lock
   `hashtextextended('taptime:c3:bootstrap:user:' || user_id::text, 0)`, then select an existing User
   `FOR SHARE` and require exact Binding/User consistency;
7. select **all** Membership rows for that User ordered by `(organization_id, id)` `FOR SHARE`; any
   row, active or revoked, fails closed;
8. only then create a new User/IdentityBinding when absent, create the Employee Membership, mark the
   invitation consumed and insert receipt/audit evidence.

Migration `008` must reuse, not fork, migration `006`'s identity and User advisory namespaces. All
C3E1 IdentityBinding creation and any later authorized C3E1 Binding mutation must acquire those
same locks in identity-then-User order. Existing Binding/User rows stay `FOR SHARE` locked so a
concurrent revocation/update cannot commit until redemption commits or rolls back. Two different
invitations redeemed concurrently by the same provider identity serialize at step 4: at most one
succeeds; the other observes the committed Binding/Membership and returns
`enrollment_unavailable` with zero partial write. Concurrent secure bootstrap for the same identity
or User serializes on the same existing namespace rather than relying on a unique-constraint race.

An exact consumed-invitation replay follows steps 1, 2 and 4–6, then locks the recorded resulting
Membership `FOR SHARE`. It returns safe success only when command, Binding, User and active
Membership match the consumed record. It deliberately does not revalidate the creator after the
original atomic grant, as specified above.

## 6. Proposed transport and safe projection

The later implementation is limited to three exact operations:

```text
POST /v1/administration/employee-invitations
  { expectedMembershipId, commandId, displayName }

POST /v1/employee-enrollment/redeem
  { commandId, invitationSecret }

POST /v1/administration/employee-memberships-projection
  { expectedMembershipId, cursor, limit }
```

All requests retain the existing strict JSON, exact-key, canonical-UUID, ten-second propagated
deadline, manual/error redirect, 16-KiB response and existing request-body bounds. Every response,
including the one-time secret success, sets `Cache-Control: no-store`, JSON UTF-8 content type,
`X-Content-Type-Options: nosniff` and the bounded request ID. No response sets cookies or allows
credential-mode transport.

The Employee projection accepts an integer limit from 1 through 20. It orders active Employee
Memberships by canonical UUID, uses only `null` or an exact `v1:e:<canonical-lowercase-uuid>` cursor
of at most 256 bytes and returns a cursor only when another row exists. A cursor outside that grammar
is `invalid_request`; Organization, active state and page continuity are always server-derived.

The normative result/HTTP/response contract is:

| Operation result | HTTP | Exact JSON shape |
|---|---:|---|
| create `succeeded` | 200 | `{ "status": "succeeded", "invitationSecret": "<exact 43-char base64url>", "expiresAt": "<24-char UTC RFC3339 milliseconds>" }` |
| create `invitation_created_token_unavailable` | 409 | `{ "error": { "code": "invitation_created_token_unavailable" } }` |
| create `invitation_limit_reached` | 409 | `{ "error": { "code": "invitation_limit_reached" } }` |
| create `command_id_conflict` | 409 | `{ "error": { "code": "command_id_conflict" } }` |
| create/projection `unauthorized` | 401 | `{ "error": { "code": "unauthorized" } }` |
| create/projection `forbidden` | 403 | `{ "error": { "code": "forbidden" } }` |
| create/redeem/projection `invalid_request` | 400 | `{ "error": { "code": "invalid_request" } }` |
| redeem `unauthorized` | 401 | `{ "error": { "code": "unauthorized" } }` |
| redeem `enrollment_unavailable` | 404 | `{ "error": { "code": "enrollment_unavailable" } }` |
| redeem `succeeded` | 200 | `{ "status": "succeeded", "organizationName": "<safe taptime-name-v1>", "membershipDisplayName": "<safe taptime-name-v1>", "role": "employee" }` |
| projection `succeeded` | 200 | `{ "status": "succeeded", "organization": { "id": "<canonical uuid>", "name": "<safe taptime-name-v1>" }, "employeeMemberships": [{ "id": "<canonical uuid>", "displayName": "<safe taptime-name-v1>", "role": "employee", "active": true }], "nextCursor": null }` or the identical object with `nextCursor` set to an exact `v1:e:<canonical uuid>` string |
| any `service_unavailable` | 503 | `{ "error": { "code": "service_unavailable" } }` |

Missing/malformed JSON, extra keys, non-canonical UUIDs and a secret that is not exactly the
canonical 43-character syntax are `invalid_request`. A syntactically canonical secret whose digest
is absent, expired, consumed by another command/identity, bound to a stale creator, presented by a
revoked/conflicting Binding or associated with any historical/active Membership always follows the
same database/result branch and returns the exact `404 enrollment_unavailable` body above. No state
specific header, body field, code or diagnostic is returned. Invalid/revoked provider tokens always
return `401 unauthorized` before invitation-state disclosure.

For creation, an exact command replay returns `invitation_created_token_unavailable`; reuse of that
command ID with a different canonical request returns `command_id_conflict`. For redemption, both a
different request under an existing command ID and any non-exact consumed-invitation replay collapse
to `enrollment_unavailable`, preserving the same disclosure boundary as every other canonical but
inaccessible secret.

Precedence is fixed: method/header/body-size and strict JSON/body syntax are checked first; provider
token verification follows; only an authenticated canonical request may query or lock invitation,
receipt or projection state. Thus malformed input may return 400 without authentication, but no
invitation lifecycle state is touched or disclosed before the 401 boundary.

The success shapes contain no email, issuer, subject, token digest, provider metadata, User ID,
audit payload or foreign Organization. Admin projection exposes active Employee Memberships only;
inactive/historical rows are not projected by C3E1.

## 7. Proposed client surfaces

### Admin Web

- Add Employee invitation creation and a separate bounded Employee Membership projection.
- Keep expected Membership compare-only and every token/access credential outside React except the
  one invitation secret that must be deliberately displayed once.
- Clear the invitation secret on every authority/session/generation transition and never restore it.
- The once-visible secret and expiry are cleared at the earlier of explicit dismissal, successful
  navigation away, authority change or the server-supplied expiry. Refresh/reload cannot recover it;
  exact command replay shows only `invitation_created_token_unavailable`.
- Do not add provider-account creation, email lookup, role selection, revoke, rename or generic CRUD.

### Android

- Preserve access/refresh tokens inside the existing private Auth/session boundary. The new
  `employee_enrollment` intent is explicit, volatile, generation-bound and never stored.
- Normal sign-in behavior is unchanged: `/v1/session` 401 clears provider tokens, SecureStore and
  local provider state. Only when the user selected enrollment intent before provider sign-in may a
  same-generation `/v1/session` 401 transition to `enrollment_only` without clearing the provider
  session. The shell contains no User, Membership, Organization or role and cannot call product,
  setup-projection, scan-context or lifecycle transports.
- A `/v1/session` transport/5xx failure never enters enrollment-only; it remains
  `context_unavailable`. A provider verification/refresh rejection, provider sign-out, redemption
  401, identity/provider event, generation replacement or explicit sign-out clears enrollment
  input, provider tokens and local state through the existing fail-closed path.
- Successful provider refresh may replace tokens inside the same enrollment generation but grants
  no context. App/process restart does not restore enrollment intent or secret input; restored
  provider state follows the unchanged normal session-resolution path, whose 401 clears it.
- The invitation input is held only while the enrollment screen is mounted, passed directly to the
  private redemption coordinator and cleared on submit completion, unmount, background authority
  replacement or every transition above. It is never written to SecureStore, outbox, AsyncStorage,
  logs, analytics, URL, clipboard automation or crash state.
- Redemption 404 keeps only the authority-free enrollment shell and clears the submitted secret so
  the user may deliberately enter another. Redemption 503 clears the submitted secret and exposes a
  retryable unavailable state without product authority. Redemption 401 signs out as above.
- On redemption 200, clear the secret and enrollment intent, then call the unchanged normal
  `/v1/session`. Only its 200 response creates the Employee product session. A subsequent 401 clears
  provider state; a transient failure remains context-unavailable and may retry normal session
  resolution, never redemption replay automatically.
- After successful normal resolution, expose the normal Employee product surface and no
  Administrator or `NFC-Einrichtung` capability.

## 8. Mandatory security and behavior verification

The later implementation authorization must require at least:

- migration checksum/order/replay and migrations `001`–`007` byte stability;
- exact role graphs, PUBLIC revocation, owner grants, fixed search paths and pool cleanup;
- current Administrator accepted; Employee, revoked/stale/replaced Membership and forged role/
  tenant rejected before invitation visibility;
- provider identity accepted without Membership only on redemption; invalid issuer/audience/
  signature/subject and revoked/conflicting binding rejected;
- User then IdentityBinding then Employee Membership atomic ordering with rollback after every write;
- inviter revocation/replacement between create and redeem fails with zero Membership mutation;
- every active **and historical** Membership in the same or another Organization fails closed; no
  C3E1 re-onboarding or Organization transfer is possible;
- Binding revocation/update while redemption is paused blocks on the row lock and then produces one
  deterministic pre- or post-transaction state; no grant may commit against a revoked Binding;
- two different invitations redeemed concurrently by the same provider identity serialize on the
  identity namespace: exactly one grant/audit succeeds and the other returns the generic unavailable
  result with its invitation unconsumed;
- C3B secure bootstrap and C3E1 redemption for the same issuer/subject or existing User serialize on
  the shared migration-006 identity/User namespace and cannot produce two Membership grants;
- exact 32-byte/43-character token vectors, invalid alphabet/padding/length/trailing pad bits,
  decoded-byte digest golden vectors and plaintext leakage rejection;
- exact create/redeem retry, divergent command reuse, exact 15-minute boundary, reuse and canonical
  unknown-token behavior;
- creator revocation immediately before first redemption returns unavailable with zero mutation;
  creator revocation after committed success does not revoke the Employee and exact same-identity/
  same-command replay returns the original safe success with zero new audit;
- Organization cap cases at four/five invitations, exact replay while full, expiry freeing one slot
  and concurrent distinct commands unable to exceed five;
- token plaintext absent from schema rows, receipts, audit, logs, diagnostics, source snapshots,
  URLs, React persistence and error output;
- exactly one safe invitation-created audit with creator Administrator actor plus exactly one
  `MembershipGranted` audit with the same creator actor on redemption; invitation/receipt bind the
  redeeming IdentityBinding as provenance; retries/rejections/rollback add no false audit;
- trigger/role negative matrix proves creator role can audit only invitation INSERT, redeemer role
  can audit only one Employee Membership INSERT, setup/broad roles are not reused and every other
  table/operation fails `42501`;
- Membership display-name Unicode normalization/golden vectors and bounded projection pagination;
- Admin Web auth/session-race, token-clear, rendered/error/accessibility and parser-bound tests;
- Android normal-sign-in 401 unchanged, explicit enrollment-intent 401 shell, 5xx exclusion,
  refresh success/rejection, provider event, process restart, redemption 401/404/503/200, secret
  clearing and post-success normal-session resolution tests;
- complete Core, Mobile, Admin Web, schema, B4, C3C, API and synthetic harness regressions;
- production builds, Android export, `git diff --check` and exact-head CI; and
- independent architecture/security review before implementation plus independent final review
  before any Human gate.

## 9. Human closure gate for a later implementation

Only after implementation review and exact-head CI may a fresh controlled synthetic flow prove:

1. an Administrator creates one invitation with a synthetic Employee display name;
2. no secret appears in URL, storage, logs, terminal evidence or Admin projection;
3. the pre-existing synthetic provider account signs in on Android but receives no product or
   setup authority before redemption;
4. wrong and interrupted redemption produce no User/Binding/Membership partial state;
5. correct redemption creates exactly one Employee Membership;
6. normal `/v1/session` then resolves Employee, while `NFC-Einrichtung` remains absent;
7. the Employee can use the already assigned physical Tag for one server-confirmed Start/Stop;
8. invitation reuse and a second identity fail closed without disclosure; and
9. sign-out, harness/schema cleanup and scoped reverse removal succeed.

This gate uses reserved-domain synthetic identities only. It is not self-service signup, email
delivery, production onboarding, real-person data, pilot distribution or legal acceptance.

## 10. Explicit non-goals

- C3E2 Tag reassignment or any Assignment mutation;
- Membership revoke, role change, rename, additional Administrator, last-Administrator transfer or
  multiple active Memberships;
- re-onboarding a User with any historical Membership or moving a User between Organizations;
- provider account creation, email invitation delivery, magic links, OAuth/additional providers or
  public signup;
- Organization rename/suspension, delete, generic User/Membership search or CRUD;
- Web/iOS NFC, production cloud resources, service-role keys, production secrets or personal data;
- support/legal/commercial/pilot claims; and
- any access to or change under untracked `research/`.

## 11. Stop conditions

Stop and return to Human Architect/independent review if implementation would require:

- email/provider claims or request-supplied IDs as Membership authority;
- a Supabase service-role key in a product client or normal API runtime;
- reuse of the broad Administrator/setup/bootstrap roles;
- plaintext/recoverable invitation storage or unbounded active invitations;
- a token form, TTL, cap, result mapping, lock order or audit actor different from this corrected
  contract without a new independent review/Human decision;
- auto-Membership on first login, self-service provider signup or access before atomic redemption;
- generic Membership CRUD, revocation/role transfer or C3E2 reassignment;
- production personal data or a live deployment; or
- a changed BusinessEngine, lifecycle Decision or NFC payload contract.

## 12. Authorization gates and implementation authority

The pre-implementation gates are satisfied as follows:

1. renewed independent read-only architecture/security review verified every P2 correction on
   commit `70d163fa0473692f61555f1580f25382e1e807af` and returned `APPROVED` with no open P0–P3;
2. the Human Architect explicitly accepted all proposed product/policy decisions: a bearer
   invitation may be redeemed by any verified pre-existing provider identity that possesses it;
   every historical Membership fails closed; `memberships.display_name` is nullable only for legacy
   rows and mandatory for C3E1 grants; TTL is exactly 15 minutes; the Organization cap is five;
   clipboard/copy support is excluded; exact replay survives later creator revocation without a new
   grant; the creator Administrator is the audit actor while the redeeming IdentityBinding is bound
   provenance; and C3E2 remains separate;
3. the accepted package is bound to exact implementation baseline
   `70d163fa0473692f61555f1580f25382e1e807af`; and
4. the Human Architect separately stated that C3E1 is released and instructed implementation to
   begin. That statement authorizes repository implementation only within this package.

Current verdict: **C3E1 IMPLEMENTATION CORRECTION `450d767` INDEPENDENTLY APPROVED AND EXACT-HEAD
CI GREEN; THE COMPLETE FRESH HUMAN PHYSICAL GATE IS AUTHORIZED. C3E2 AND PRODUCTION REMAIN
UNAUTHORIZED**.

## 13. Independent review findings and corrective disposition

Independent read-only review of commit `4e3ae76f4fdfad751e31b546aa4b1a63e04a67ee` returned overall
`CHANGES REQUIRED`: C3D closure synchronization and the EP-009 delta were acceptable, while C3E1
had six P2 contract gaps and no P0/P1/P3. All six findings are accepted and corrected in this
candidate:

| Finding | Disposition |
|---|---|
| C3E1-REV-01 | Any active or historical Membership anywhere now fails closed; re-onboarding/Organization transfer are explicit non-goals with same-/cross-Organization tests. |
| C3E1-REV-02 | The exact volatile enrollment-intent state machine preserves normal 401 sign-out, grants no context and specifies refresh, retry, restart, provider-event and sign-out transitions. |
| C3E1-REV-03 | Secret is exactly 32 random bytes/43 unpadded base64url characters, TTL exactly 15 minutes, active cap exactly five, with an Organization-wide advisory-lock/count contract. |
| C3E1-REV-04 | Every internal result now has a normative HTTP code, exact JSON shape and `no-store`; malformed and canonical-unavailable secret states are explicitly separated without enumeration. |
| C3E1-REV-05 | First redemption and exact replay now have fixed invitation/creator/identity/Binding/User/Membership lock orders plus revocation and dual-invitation race tests. |
| C3E1-REV-06 | Creator Administrator is the grant/audit actor; redeeming IdentityBinding is durable receipt/invitation provenance; dedicated-role trigger allowlists and exact audit counts are fixed. |

Independent delta re-review of corrected commit
`70d163fa0473692f61555f1580f25382e1e807af`, tree
`33e5f7a94d49fadcab4f8f14b6fa842a55aad928`, closed every finding and returned `APPROVED` with no
open P0/P1/P2/P3. The Human Architect then accepted the complete contract and separately authorized
its repository implementation. The later implementation and focused correction completed their
required verification, independent review and exact-head CI as recorded below.

## 14. Repository implementation checkpoint

The authorized repository implementation was published as commit `42b7c7a81d5a36bdce2842863f4cfdf637ea5e49`,
tree `22c47b6c8a36f22787dd50c86b89b03d8008a6a2`, and passed exact-head ten-of-ten GitHub Actions run
`29414515751`, attempt 1. Independent final review then returned `CHANGES REQUIRED` with three P2
and three P3 findings and no P0/P1.

The focused correction retains migration `008`, the exact isolated capability/owner roles,
invitation/redemption/projection backend and transport and the explicit Android pre-Membership
enrollment shell without C3E2 or production expansion. It adds error-aware checked-out-client
retirement, stale-secret tombstones, strict Employee projection safety, exact JSON media-type
checking, the normative ten-second backend deadline and truthful ADO synchronization. Fresh
`npm ci` plus focused final evidence was 1,527 passing tests with two approved Supavisor-mode skips,
all workspace typechecks/builds, Android export, migration-ledger and built-CLI checks. Detailed
evidence is `ADO/05_Evidence/Block_C3E1_Implementation_Evidence.md`.

Correction commit `450d7673431d3201dd02b2887f98ff6a1754e553`, tree
`a60d306ad063e4117b2685bb578742bb0a46bccb`, passed independent delta re-review with no open
P0/P1/P2/P3 and exact-head ten-of-ten GitHub Actions run `29416554531`, attempt 1. The Human Gate is
therefore authorized. First strictly local physical-harness commit `ee522a5` passed exact-head run
`29418851293`, but independent review returned `CHANGES REQUIRED` with two P2 and two P3 findings.
Its credential-free-latch/lifecycle-test correction is 16/16 locally and adds no product authority;
correction publication, exact-head CI and independent delta re-review must pass before observations.
C3E2,
production resources/data, deployment and distribution remain unauthorized.
