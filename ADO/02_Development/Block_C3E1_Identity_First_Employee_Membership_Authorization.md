# Block C3E1 — Identity-First Employee Membership Authorization Package

Status: **REVIEW READY — REPOSITORY IMPLEMENTATION NOT AUTHORIZED**
Package Authorization Date: 2026-07-15
Exact Package Baseline: `a0419866c2b992ae8fc5474144064bc0652d215a`
Human Authority: Human Architect authorized this ADO-only package and explicitly withheld C3E
product-code authority pending a later approval
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

This document is an authorization package for review. It does not authorize migration `008`, a new
runtime role, backend route, Admin Web/Mobile change, dependency, cloud resource or production data.

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
2. Android authenticates through the existing private Supabase adapter. If normal `/v1/session`
   resolution has no Membership, the provider session may enter only a narrow enrollment state; it
   must not reach the product, setup projection or lifecycle transports.
3. The private enrollment coordinator submits the one-time secret to a dedicated redemption route.
   The route verifies the provider token directly; it does not require or invent a Membership.
4. One transaction hashes and locks the invitation, revalidates the invitation creator's exact
   still-active Administrator Membership, resolves the issuer/subject binding, and rejects every
   existing active Membership without disclosing whether it belongs to another Organization.
5. If the identity has no binding, the transaction creates the internal User and IdentityBinding
   first. It then creates exactly one active `employee` Membership using the invitation's derived
   Organization, creator and display name. User/IdentityBinding/Membership, invitation consumption,
   receipt and AuditEvent commit atomically or not at all.
6. After success, the normal C1 `/v1/session` path must independently resolve the new Employee
   Membership. The enrollment coordinator cannot construct a product session itself.

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
  consumed User/Membership IDs and row version;
- append-only command receipts for invitation creation and redemption, bound to command type,
  actor/identity, invitation, canonical digest and safe result; and
- exact constraints for one-time consumption, expiry ordering, creator tenant binding and consumed
  Membership/User consistency.

The later implementation must use distinct least-privilege enrollment roles/pools for:

- current-Administrator invitation creation; and
- provider-identity redemption before a Membership exists.

Neither role may inherit `taptime_administrator`, `taptime_admin_setup`, lifecycle, bootstrap or
identity-resolver table authority. Direct table access is denied except to narrowly separated
function owners with exact column grants. Security-definer functions use a fixed
`pg_catalog, taptime_server` search path and no dynamic SQL.

## 5. Invitation-secret and replay rules

- The server generates at least 256 random bits and returns a canonical base64url secret over the
  bounded JSON response only.
- Storage uses a fixed domain-separated SHA-256 digest; high server-generated entropy, short
  lifetime and single use are mandatory. Plaintext storage or reversible encryption is prohibited.
- Maximum lifetime is 15 minutes. Expired, absent, already-used, wrong-Organization, stale-creator,
  existing-active-Membership and inaccessible states map to the same external
  `enrollment_unavailable` result.
- Invitation creation must be bounded per Organization. The exact active-invitation limit is fixed
  during independent pre-implementation review; implementation must stop if no fail-closed bound is
  accepted.
- Exact invitation-create retry never re-discloses the secret because plaintext is not stored. It
  returns `invitation_created_token_unavailable`; the UI may explicitly create a fresh invitation.
- Exact redemption retry by the same verified identity may return the original safe success. A
  different identity receives only `enrollment_unavailable`.
- Tokens are prohibited from query strings, route parameters, crash reports, clipboard automation,
  persistent state, receipts and audit payloads. An explicit user-initiated copy action may be
  considered during UI review but is not authorized by this package.

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

All requests retain the existing strict JSON, exact-key, canonical-UUID, deadline, redirect, body
and response bounds. Invitation creation/redeem results contain only fixed status values, safe
Organization name, Membership display name and role where required. Admin projection may expose
Membership ID, display name, `employee` role and active state. It must not expose email, issuer,
subject, token/digest, provider metadata, User ID, audit payload or another Organization.

The fixed external result vocabulary proposed for review is:

- invitation create: `succeeded`, `invitation_created_token_unavailable`, `invalid_request`,
  `forbidden`, `invitation_limit_reached`, `service_unavailable`;
- redemption: `succeeded`, `invalid_request`, `enrollment_unavailable`, `service_unavailable`; and
- projection: `succeeded`, `invalid_request`, `forbidden`, `service_unavailable`.

Invalid/revoked provider tokens remain HTTP 401. No result distinguishes an absent identity,
revoked binding, active Membership elsewhere, expired invitation, consumed invitation, stale
creator or cross-Organization state.

## 7. Proposed client surfaces

### Admin Web

- Add Employee invitation creation and a separate bounded Employee Membership projection.
- Keep expected Membership compare-only and every token/access credential outside React except the
  one invitation secret that must be deliberately displayed once.
- Clear the invitation secret on every authority/session/generation transition and never restore it.
- Do not add provider-account creation, email lookup, role selection, revoke, rename or generic CRUD.

### Android

- Preserve the provider token inside the existing private Auth/session boundary.
- Add a pre-Membership enrollment state reachable only after valid provider authentication and an
  unresolved normal Membership.
- Permit only invitation redemption from that state; product scanning and `NFC-Einrichtung` remain
  unavailable until normal `/v1/session` returns the new Employee Membership.
- After successful resolution, expose the normal Employee product surface and no Administrator
  capability.

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
- existing active Membership in same/other Organization, concurrent redemption and token race all
  fail closed without enumeration;
- exact create/redeem retry, divergent command reuse, expiry, reuse, unknown token and active-limit
  behavior;
- token plaintext absent from schema rows, receipts, audit, logs, diagnostics, source snapshots,
  URLs, React persistence and error output;
- exactly one safe invitation-created audit plus exactly one `MembershipGranted` audit on success;
  retries/rejections/rollback add no false success audit;
- Membership display-name Unicode normalization/golden vectors and bounded projection pagination;
- Admin Web auth/session-race, token-clear, rendered/error/accessibility and parser-bound tests;
- Android pre-Membership state, redemption, process/session replacement and authority-transition
  tests;
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
- auto-Membership on first login, self-service provider signup or access before atomic redemption;
- generic Membership CRUD, revocation/role transfer or C3E2 reassignment;
- production personal data or a live deployment; or
- a changed BusinessEngine, lifecycle Decision or NFC payload contract.

## 12. Authorization gates and next decision

Before any C3E1 repository implementation begins:

1. independent read-only architecture/security review must disposition every P0–P3 finding;
2. the Human Architect must explicitly accept the invitation/redemption product contract,
   Organization-local Membership display name and separation from C3E2;
3. the accepted package must be bound to the then-current exact implementation baseline; and
4. a separate statement must authorize repository implementation only.

Current verdict: **PACKAGE REVIEW READY; C3E1 IMPLEMENTATION REMAINS UNAUTHORIZED**.
