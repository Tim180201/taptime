# Block C3 — Organization Administration Implementation Plan

Status: Active — C3B completed; C3C–C3E remain separately gated and unauthorized
Date: 2026-07-14
Planning Baseline: `f7d38558e9a1e6d5f7c2cfd1f4a1ec6eed3ebd44`
Owner: Technical Lead
Architecture: Accepted ADR-0011, FB-002 v1.2 and TS-002 v1.2

## 1. Recommended sequence and Codex effort

| Slice | Scope | Codex effort | Current authority |
|---|---|---:|---|
| C3B | Isolated first Organization/Administrator bootstrap CLI, migration `006`, role graph, receipt/audit and security matrix | High | Completed — Technical Lead, independent review and nine-job CI passed |
| C3C | Tenant-safe normal setup backend/API, Customer/Tag display names, atomic Customer and NFC provision commands, resumable safe projection | Very High | Not authorized |
| C3D | Minimal Admin Web shell for Customer/assignment setup plus protected Android Administrator NFC capture | Very High | Not authorized |
| C3E | Explicit reassignment and identity-first employee Membership setup after their separate policy gates | Very High | Not authorized |

C3B is closed. C3C must close before a product UI is allowed to claim operational setup.
C3D may be visually scaffolded only after the C3C contract is frozen; it must not invent backend
semantics. C3E is not required for first bootstrap/setup proof.

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

## 5. Independent review and publication gates

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
