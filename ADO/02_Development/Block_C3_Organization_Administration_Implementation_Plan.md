# Block C3 — Organization Administration Implementation Plan

Status: Active — C3B/C3C/C3D completed for their authorized scopes; C3D closure sync Human-accepted;
C3E1 corrected contract independently approved with zero open P0–P3, Human-accepted and repository
implementation authorized on exact baseline `70d163f`; initial implementation `42b7c7a` published
with ten-of-ten exact-head CI, final review `CHANGES REQUIRED`, six-finding correction locally
verified and awaiting external exact-head CI confirmation plus independent delta re-review; C3E2
unauthorized
Date: 2026-07-15
Planning Baseline: `f7d38558e9a1e6d5f7c2cfd1f4a1ec6eed3ebd44`
Owner: Technical Lead
Architecture: Accepted ADR-0011, FB-002 v1.2 and TS-002 v1.3

## 1. Recommended sequence and Codex effort

| Slice | Scope | Codex effort | Current authority |
|---|---|---:|---|
| C3B | Isolated first Organization/Administrator bootstrap CLI, migration `006`, role graph, receipt/audit and security matrix | High | Completed — Technical Lead, independent review and nine-job CI passed |
| C3C | Tenant-safe normal setup backend/API, Customer/Tag display names, atomic Customer and NFC provision commands, resumable safe projection | Very High | Completed — implementation `b90729a0a4b325f523cd98ea5a741defb00155f6`, independent exact-SHA reviews and exact-head ten-job CI passed |
| C3D | Minimal Admin Web shell for Customer/assignment setup plus protected Android Administrator NFC capture | Extra High | Completed — final correction `e686578`, independent zero-finding review, exact-head ten-job CI and fresh Galaxy/NTAG213 Human gate passed |
| C3E1 | Identity-first Employee Membership setup through a separately reviewed least-privilege invitation/redemption boundary | Very High | Initial implementation `42b7c7a` published/10-job CI green; final review `CHANGES REQUIRED`; correction locally verified, external exact-head CI confirmation and independent delta re-review required before Human Gate |
| C3E2 | Explicit Tag reassignment with preserved Assignment history and future time attribution | Very High | Not authorized |

C3B and C3C repository implementation are closed. The C3C backend prerequisite is satisfied. The
Human Architect separately authorized C3D on exact baseline
`316f017973fbba18a58c2340c9c79a28f06573e5`; its dedicated authorization freezes Admin Web plus
protected Android capture without inventing backend semantics. C3E is not required for first
bootstrap/setup proof. It is now split into C3E1 identity-first Employee Membership setup and C3E2
explicit Tag reassignment so their distinct privileged boundaries receive separate decisions.

## 2. C3B — secure bootstrap implementation

### Deliverables

- isolated `@taptime/backend-bootstrap` Node 24 workspace and operator CLI;
- additive migration `006` with bootstrap executor/owner roles, hardened capability and append-only
  receipt;
- individual short-lived operator LOGINs, explicit executor assumption, TLS/host/secret handling and
  immutable `session_user` attribution in receipt/AuditEvent storage;
- reuse of the concrete issuer-bound B4 token verifier without B4 Membership resolution;
- exact replay/conflict result contract and safe ID-only output;
- three explicit operator-attributed audit events with `actor_user_id = NULL`;
- no public route and no dependency from Mobile, Admin Web or normal backend runtime.

### Mandatory tests

- valid verified identity and first bootstrap success;
- exact same-operator replay returns exact IDs and adds zero rows;
- cross-operator replay discloses no result, returns a typed non-rollback rejection and commits one
  schema-valid audit with receipt Organization, `BootstrapRequest`/request-ID entity, request-ID
  correlation, current operator and safe reason-only payload;
- same request ID/different content conflict;
- Organization-name Unicode-15.1 normalization/category/scalar+byte bounds and exact Node/SQL
  bootstrap-digest golden vectors;
- revoked/conflicting identity, existing Membership and concurrent distinct request rejection;
- request-ID and identity advisory-lock races;
- rollback after every User/Binding/Organization/Membership/Audit/receipt write stage;
- exact LOGIN → `SET LOCAL ROLE taptime_bootstrap_executor` → SECURITY DEFINER owner graph,
  executor schema-USAGE/function-EXECUTE only, owner exact SELECT/INSERT+BYPASSRLS only, PUBLIC revoke
  and fixed `pg_catalog` search path;
- named operator principal persists in both receipt and the constrained AuditEvent field from
  immutable `session_user`, never request data; shared LOGIN,
  expired credential, non-allowlisted host and non-`verify-full` remote TLS are rejected;
- token/issuer/subject/email are absent from output, logs, audit and receipt;
- migration checksum/order, complete workspace build and existing B1–B6/C1/C2 regressions.

### Stop conditions

Stop if implementation needs a public route, Supabase service-role key, email linking, client IDs,
normal API credential reuse, partial retry cleanup or unaudited bypass.

## 3. C3C — normal setup backend/API

### Deliverables

- additive Domain/schema fields for `Customer.displayName` and `NfcTag.displayName`, including safe
  synthetic-fixture backfill and the Unicode-15.1 `taptime-name-v1` normalization capability;
- distinct setup database pool/login/role and RLS/policy/audit changes with no Membership/delete/
  lifecycle capability;
- explicit `taptime_admin_setup` audit-trigger allowlist with fixed Customer/Tag/Assignment events,
  derived User actor, null operator principal and command-ID correlation;
- B6-style `AdminWriteSessionCoordinator` with current locked Administrator authority and mandatory
  expected-Membership narrowing before receipts/resources;
- exact create-Customer and atomic register+assign commands with UUID receipts bound to Organization,
  actor, Membership, command type and canonical digest;
- bounded paginated setup projection with Organization, Customer and safe Tag/Assignment summaries;
- strict `/v1/administration/` transport and disclosure-safe result mapping;
- raw canonical payload absent from every response, receipt, audit payload, normal log, Web type,
  React component/state and persistent Mobile record.

### Mandatory tests

- current Administrator accepted; Employee, revoked/replaced Membership and forged tenant/role denied;
- missing expected Membership is invalid and stale/replaced Membership is forbidden before receipt
  lookup, projection or resource access;
- no body field can supply Organization, User, Membership, role or active state;
- exact and divergent command replay across actor/Membership/type/content, concurrent duplicate
  payload and rollback after every write;
- two Administrators racing the same Organization/command ID serialize on the transaction lock: one
  success, one deterministic `command_id_conflict`, one resource/audit set and no raw SQL error;
- same command ID in another Organization remains an independent namespace and discloses no receipt;
- tenant-local payload conflict while identical payload across Organizations remains allowed and
  undisclosed;
- missing/inactive/cross-tenant target maps identically to `assignment_target_unavailable`;
- exact replay precedes resource checks; another command with an existing tenant payload always maps
  to `tag_payload_already_registered`; `assignment_conflict` is not an initial provision result;
- Unicode-15.1 normalization order/categories/scalar+byte limits, Node/SQL digest golden vectors and
  duplicate display-name allowance;
- raw payload leakage scans across DTOs, receipts, diagnostics, audit, source logs and UI state;
- setup-role audit allowlist and exact evidence: create Customer = one `CustomerCreated`; provision
  Tag = one `NfcTagRegistered` plus one `NfcTagAssigned`; derived User actor, null operator principal,
  command-ID correlation; exact replay/rollback = zero additional events; no raw UID in audit/receipt;
- bounded cursor/limit behavior, stable ordering and cross-tenant projection denial;
- pool context cleanup, deadlines, body/header bounds, extra-key rejection and all repository CI.

### Stop conditions

Stop if the slice requires Membership CRUD, delete, Organization rename/status, implicit
reassignment, generic SQL/CRUD, browser UID entry, production data or a broader role than the fixed
setup capability.

### Local implementation checkpoint (2026-07-15)

The authorized C3C scope is implemented locally. Node-24/PostgreSQL-17 verification passed 1,394
tests plus all workspace typechecks/builds and Android export. The workflow parses with ten jobs,
migrations `001`–`006` are unchanged and every reported implementation/precommit finding has been
corrected locally. Evidence:
`ADO/05_Evidence/Block_C3C_Normal_Administration_Backend_Evidence.md`.

C3C is not complete or closed. An implementation commit/head, independent final review and exact-head
ten-of-ten GitHub Actions result remain mandatory. DT-063–DT-066 therefore remain open, and no C3D,
C3E or production implementation is authorized by this checkpoint.

### Repository closure checkpoint (2026-07-15)

Implementation commit `b90729a0a4b325f523cd98ea5a741defb00155f6`, tree
`671be72784f68b9437a9f53e251acbbb22ce3e97`, subsequently passed three independent exact-SHA reviews
with zero open P0/P1/P2/P3 and exact-head GitHub Actions run `29375259275` with ten of ten jobs.
C3C repository implementation is therefore closed. ADO-only closure-publication commit
`9c79c6d2f2166d22cc61bfbc03ba79c434bbbfe0` passed all ten jobs in exact-head GitHub Actions run
`29376668158`; DT-063–DT-066 remain open, and no C3D, C3E or production implementation is authorized
by this closure or its publication. Evidence:
`ADO/02_Development/Block_C3C_Normal_Administration_Backend_Closure.md`.

## 4. C3D — first real setup UI

The Admin Web owns safe Customer creation and setup presentation. It displays Organization name,
Customers, Tag labels, validation fingerprints and assignment state. It never receives a raw UID,
database credential, pairing token or generic role/tenant selector. Authenticated Android owns the
complete first-Tag flow: current Administrator selects Customer, enters Tag label, starts native
capture and submits directly to C3C. The raw canonical value stays ephemeral inside a non-React
application/transport coordinator; only the safe summary reaches presentation. "Protected" claims
supported-client/session gating, not device attestation or proof of physical origin.

The Human Architect performs a real bootstrap → Administrator sign-in → create Customer →
Android capture/register/assign Tag → the same Administrator's product scan Start/Stop gate before
C3D closure. This avoids an unauthorized Employee-seeding path; identity-first Employee provisioning
remains C3E. Responsive accessibility, loading/error/empty states and Android process/session
replacement are mandatory. iOS/Web NFC remains outside the first physical gate.

### Physical-start correction checkpoint (2026-07-15)

The exact-loopback correction `ad64cec3660e9bf89bcff1c334d01dbd79081ad5`, tree
`71bd087d7f5ac27abb1540f0c0a39266e2cc86bf`, passed independent delta review with zero open
P0/P1/P2/P3 and exact-head ten-of-ten run `29402429508`. The permitted restart then exposed two
further browser-runtime integration gaps before setup mutation or NFC capture: the local Auth
harness did not allow the Supabase SDK's `X-Supabase-Api-Version` preflight header, and the Admin
Web API client stored browser `fetch` without its required global receiver. Both are locally
corrected with exact-header/real-preflight and receiver-sensitive tests while preserving the
existing fail-closed redirect behavior. Current local evidence is Core 290, Mobile 338, Admin Web 27,
contract 3 and PostgreSQL-backed harness 9 plus relevant TypeScript checks and builds. A real
browser smoke reaches the safe one-Customer/zero-Tag projection.

The newest correction was published as `e686578751e8e09d7a8a48c3fd3058825dcedbf7`, tree
`f80e700fd3e6e519573954ac8004fd4bbedea1c4`. Its independent read-only delta review returned
`APPROVED` with zero open P0/P1/P2/P3, and exact-head GitHub Actions run `29405184995`, attempt 1,
passed all ten jobs.

### Physical closure checkpoint (2026-07-15)

The Human Architect then restarted the complete observation sequence from its first row and passed
it on the approved Galaxy A33/NTAG213. Employee setup denial, Administrator Web Customer creation,
safe projection agreement, force-stop non-mutation, real C3C Tag registration/assignment and the
same Administrator's server-backed Start/Stop all passed. Final sanitized state was exactly
Customers 2, Tags 1, Assignments 1, admin receipts 2, WorkEvents 2, Decisions 2, lifecycle Receipts
2, one stopped TimeEntry and AuditEvents 5. Android/Web sign-out, schema/harness shutdown and scoped
reverse removal passed. The one initial fail-closed lifecycle attempt created no server mutation;
controlled read-only diagnosis and retry proved one Start and one Stop without duplication.

C3D is therefore completed for its authorized repository and Human physical scope. This does not
authorize C3E1 implementation, C3E2, Web/iOS NFC, production operation/data or distribution.

## 5. C3E1 — identity-first Employee Membership setup

The Human-accepted implementation authorization is
`ADO/02_Development/Block_C3E1_Identity_First_Employee_Membership_Authorization.md`. It proposes a
two-step boundary: a current Administrator creates a short-lived Organization-bound Employee
invitation, and a pre-existing verified provider identity with no Membership redeems it. The
transaction must revalidate the inviter's exact active Administrator Membership and create any
required User/IdentityBinding plus exactly one Employee Membership atomically.

The package deliberately rejects email, provider subject, request-supplied User/Organization/role,
Supabase service-role authority and the existing broad `taptime_administrator` database role as
authorization sources. It excludes provider-account creation, generic Membership CRUD,
revocation/role change, last-Administrator policy, email delivery and all Tag reassignment.

The exact token, schema, route, role, receipt, audit and UI contracts were independently re-reviewed
on corrected commit `70d163f` with no open P0/P1/P2/P3 and accepted by the Human Architect. Migration
`008` and the bounded repository implementation were authorized on that exact baseline. Initial
implementation `42b7c7a` was published and passed exact-head run `29414515751`; independent final
review returned `CHANGES REQUIRED` with three P2 and three P3 findings. The six-finding correction
is locally verified as recorded in `ADO/05_Evidence/Block_C3E1_Implementation_Evidence.md`. The
remaining gates are:

1. preserve the accepted package with no C3E2/production expansion while publishing the correction;
2. externally confirm green exact-head CI for the correction SHA;
3. obtain independent delta architecture/security/code re-review of the exact correction; and
4. only then a separately started fresh Human identity/device gate before closure.

C3E2 remains outside this package and requires its own Assignment-history and time-attribution
policy decision before implementation planning.

## 6. Independent review and publication gates

Each slice receives:

1. a short authorization bound to an exact baseline;
2. pre-implementation architecture/security review for every new privileged boundary;
3. local unit/integration/security verification and complete workspace checks;
4. Technical-Lead diff/claim audit;
5. targeted commit/push and exact-head GitHub CI;
6. independent implementation review;
7. physical/human gate where a real capture or UI behavior is claimed;
8. truthful closure that does not expand into later slices.

`research/` remains outside every implementation diff unless the Human Architect explicitly scopes
it into a separate research task.
