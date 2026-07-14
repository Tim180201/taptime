# Block C3C — Normal Administration Backend/API Authorization

Status: Completed — authorized C3C repository implementation passed Technical-Lead verification,
exact-SHA independent reviews and exact-head ten-job CI
Authorization Date: 2026-07-14
Implementation Evidence and Closure Date: 2026-07-15
Authorized Baseline: `c1148d57edb12312a102f090715c4b28308f6347`
Baseline CI: GitHub Actions run `29364210818` — nine of nine jobs passed at the exact baseline
Implementation Commit: `b90729a0a4b325f523cd98ea5a741defb00155f6`
Implementation Tree: `671be72784f68b9437a9f53e251acbbb22ce3e97`
Implementation CI: GitHub Actions run `29375259275` — exact implementation SHA, ten of ten jobs passed
Human Architect Authorization: Explicit ("ist autorisiert, leg los chef!")
Owner: Technical Lead
Architecture Authority: Accepted ADR-0011, FB-002 v1.2 and TS-002 v1.3
Roadmap Scope: C3C only; C3D/C3E and production deployment remain unauthorized
Codex Effort: Very High

## 1. Authorized objective

Implement the smallest tenant-safe normal setup backend/API that lets a current server-derived
Administrator create a named Customer, atomically register and assign a named physical NFC Tag and
resume a bounded safe setup projection. The slice adds migration `007`, required Customer/Tag
display fields, one neutral C3 contract package, isolated `@taptime/backend-administration`, three
strict administration routes, a fourth least-privilege database pool and a tenth isolated CI job.

This authorization does not include Admin Web or presentation code, Android provisioning UI,
Membership CRUD, invitations, role changes, reassignment, delete, Organization rename/status,
generic CRUD/SQL, production infrastructure/data or any C3D/C3E behavior.

## 2. Exact transport and result contract

All three routes are authenticated `POST application/json` operations:

- `/v1/administration/customers` with
  `{ expectedMembershipId, commandId, displayName }`;
- `/v1/administration/nfc-tags/provision` with
  `{ expectedMembershipId, commandId, customerId, displayName, canonicalPayload }`;
- `/v1/administration/setup-projection` with
  `{ expectedMembershipId, cursor, limit }`.

C3C UUID inputs must already be canonical lowercase RFC-4122 text. Administration routes reject
the existing expected-Membership header; their single narrowing source is the exact body field.
No body may contain an Organization/User/role/active field, complete Membership/Customer/NfcTag
object or repository selector. Organization, actor, Membership and role are always derived.

Mutation success is HTTP 200 and returns only `status = succeeded`, `idempotentRetry` and the safe
generated result summary/IDs. Projection success is HTTP 200 and returns the Organization summary,
Customer summaries, safe Tag/Assignment summaries and a nullable next cursor. Fixed failures are:

| Result | HTTP |
|---|---:|
| `invalid_request` | 400 |
| `unauthorized` | 401 |
| `forbidden` | 403 |
| `assignment_target_unavailable` | 404 |
| `tag_payload_already_registered` | 409 |
| `command_id_conflict` | 409 |
| `service_unavailable` | 503 |

Raw canonical NFC payload is forbidden from every response, receipt, audit payload, diagnostic,
log, Web/React type or persistent Mobile record.

## 3. Fixed authority, transaction and deadline contract

The normal runtime uses a fourth database login/pool distinct from session, read-model and lifecycle.
Its only settable parents are `taptime_identity_resolver` and the new
`taptime_admin_setup NOLOGIN NOINHERIT NOBYPASSRLS`. The setup role has no User,
IdentityBinding, Membership, lifecycle, delete, update, DDL, generic SQL or raw-payload read
capability and never receives the existing broad `taptime_administrator` role.

Every mutation executes in one READ WRITE transaction:

1. strict transport and Node preflight;
2. verify token;
3. begin with bounded lock, statement and PostgreSQL-17 transaction deadlines;
4. assume only `taptime_identity_resolver` and call `lock_request_actor`;
5. missing/revoked binding or Membership is `unauthorized`;
6. require Administrator and exact expected Membership, otherwise `forbidden`;
7. take the versioned `(Organization, commandId)` transaction advisory lock;
8. set only derived transaction-local actor/tenant/Membership/role/correlation context;
9. assume only `taptime_admin_setup`;
10. database-authoritatively normalize the name and compute the command digest;
11. exact success receipt replay precedes resource checks; divergent authority/type/content is
    `command_id_conflict`;
12. provision checks tenant-local payload conflict before locking the active Customer;
13. write resources, success-only receipt and trigger-generated audit atomically;
14. check the deadline again before commit; every error/timeout rolls back and releases the client.

Projection locks and narrows the same current authority in an ordinary transaction because the
resolver uses `FOR SHARE`; it executes only bounded safe reads and creates no receipt or audit.

## 4. Data, receipt, audit and pagination contract

- A neutral `@taptime/administration-contract` owns the pinned Unicode-15.1 name and C3 tuple-digest
  logic. C3B keeps stable wrappers; normal runtime never imports `@taptime/backend-bootstrap`.
- Migration `007` repeats the PostgreSQL-17/UTF8/Unicode-15.1 gate, backfills names from IDs only,
  then requires canonical non-null `display_name`. Duplicate names remain permitted.
- Existing legacy payload rows remain valid. New setup-role Tag inserts alone must match exact
  ADR-0009 canonical UID syntax.
- `validation_fingerprint` is generated/stored as the first 12 uppercase SHA-256 hex characters.
  Setup has column-level safe read rights and no `payload_value` SELECT right.
- Receipts are append-only, success-only and keyed by `(organization_id, command_id)`. They bind
  actor, expected Membership, command type, hash version/digest and the exact safe result-ID shape.
  They store no input body, name, identity claim or payload.
- Setup-trigger auditing is fail-closed and allowlists only Customer INSERT, NfcTag INSERT and
  NfcAssignment INSERT. Evidence is exactly one `CustomerCreated` or one `NfcTagRegistered` plus
  one `NfcTagAssigned`, with derived actor, null operator, UUID command correlation and `{}` payload.
- Projection uses one versioned cursor over the stable global order Customers by UUID, then Tags by
  UUID. Limit is an integer 1–20 across both kinds, cursor input is at most 256 UTF-8 bytes and every
  response remains below the existing 16-KiB Mobile response cap.

## 5. Result precedence and race rules

Current authority and expected Membership always precede receipt/resource visibility. After the
command lock and role/context switch, exact receipt replay returns the stored success even if a
resource later becomes inactive; divergent receipt returns command conflict. Another command with
an existing same-tenant payload always returns payload conflict before target state. Missing,
inactive and cross-tenant Customers collapse to the same target-unavailable result. The same payload
or command ID in another Organization is an independent namespace and is not disclosed.

`INSERT ... ON CONFLICT DO NOTHING` plus deterministic re-read/mapping owns concurrent payload and
receipt races; raw PostgreSQL uniqueness errors never cross the public boundary. Receipts are not
written for business rejections, so later legitimate state changes can be retried under a new
command. Initial provision never returns `assignment_conflict` and never reassigns.

## 6. Mandatory verification and closure gates

- migrations exactly `001`–`007`, repeat/ledger and byte-identical `001`–`006`;
- exact role/login/ACL/RLS/function-owner/PUBLIC negative matrix and pool context cleanup;
- database plus Node Unicode/digest golden vectors, bounds, duplicates and direct bad-input denial;
- Administrator/Employee/revoked/stale/forged authority matrix before receipt/resource access;
- exact/divergent/cross-actor/cross-Membership/cross-type/cross-tenant receipt behavior;
- same-command and same-payload concurrency, target-state race and no raw SQL errors;
- exact audit counts and rollback after every resource/receipt/audit stage;
- safe stable pagination, response-size bound and cross-tenant non-disclosure;
- strict route/method/key/header/body/UTF-8/content-type/UUID/deadline/lost-response matrix;
- raw-payload leakage/isolation scan and complete Core/Mobile/B1/B3–B6/C1/C2/bootstrap/synthetic
  regression;
- isolated PostgreSQL-17/Node-24 C3C CI job, Technical-Lead diff/claim audit and independent final
  architecture/security/governance review with no open P0/P1/P2 before closure.

The Node-24/PostgreSQL-17 implementation and regression matrix passed on 2026-07-15 with
1,394 executed tests, complete workspace typechecks/builds, Android export, ten-job workflow YAML
validation, unchanged migrations `001`–`006`, clean package-graph validation and a clean diff check.
Implementation commit `b90729a0a4b325f523cd98ea5a741defb00155f6` then passed three independent
exact-SHA final-review tracks with zero open P0/P1/P2/P3 and all ten exact-head jobs in GitHub Actions
run `29375259275`. The implementation evidence is
`ADO/05_Evidence/Block_C3C_Normal_Administration_Backend_Evidence.md` and the closure is
`ADO/02_Development/Block_C3C_Normal_Administration_Backend_Closure.md`.

These gates close only the authorized C3C repository implementation. The ADO-only closure-publication
commit and its exact-head CI are still pending and have no identifier yet. No C3D/C3E or production
authority follows from C3C closure.

## 7. Stop conditions

Stop if implementation needs the broad Administrator role, payload SELECT, a public/bootstrap
credential, Membership mutation, reassignment, delete/update, generic SQL/CRUD, browser UID entry,
production data, a transaction that can continue beyond its reported timeout or any C3D/C3E scope.

`research/` is outside this authorization and must remain untracked, unread and unstaged.
