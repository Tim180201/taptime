# Block C3E2 — Explicit NFC Tag Reassignment Architecture and Authorization Candidate

Status: **INDEPENDENT IMPLEMENTATION REVIEW APPROVED AND COMPLETE FRESH HUMAN GATE PASSED —
TRUTHFUL CLOSURE PUBLICATION/EXACT-HEAD CI/FINAL CLOSURE REVIEW PENDING; PRODUCTION UNAUTHORIZED**
Date: 2026-07-18
Review Baseline Commit: `7d9aaf391aa3b0f22b160841b8942fdca8dddbe7`
Review Baseline Tree: `b74f640eed314e6a9cf4888acf7e732e49bf2452`
Independent Review Commit: `dbefc1cc2bab66bab87a00c3209bd8a1f926f731`
Independent Review Tree: `3bcc1539e428d684f88af5bd2c81c9c820a970de`
Independent Review Exact-head CI: GitHub Actions `29646684981`, attempt 1, ten of ten jobs passed
Independent Review Verdict: **APPROVED — zero open P0/P1/P2/P3**
Human Contract Acceptance Date: 2026-07-18
Implementation Baseline Commit: `5bc495107292d8cdd959c9c40319e8ae180099b3`
Implementation Baseline Tree: `0b8a2d01439af55d86696127ae1f1bc748c3a4ce`
Implementation Commit: `b783733658f4c88ba3081737f13198afe7e719aa`
Implementation Tree: `7c779ee222cdd221b2b0ee89a954e263d0155595`
CI Integration Correction Commit: `672b7ac35dfd676138dd6c3999366de9ce25c80e`
CI Integration Correction Tree: `8b4c601919187dadb4a976a9a2d7c5ff6a3ec1c1`
Implementation Exact-head CI: GitHub Actions `29649388470`, attempt 1, ten of ten jobs passed
Final Reviewed Head: `7050df43977fc79bba3483aada91b5f98ef0e3b0`
Final Reviewed Tree: `587ef8f5385d08af297a0c38322a2522cb7516a2`
Final Reviewed Exact-head CI: GitHub Actions `29649683173`, attempt 1, ten of ten jobs passed
Independent Implementation Review: **APPROVED — zero open P0/P1/P2/P3**
Fresh Human Physical Gate: **PASSED — Galaxy A33/Android 15/NTAG213**
Separate Repository Implementation Release Date: 2026-07-18
Owner: Technical Lead
Contract Acceptance Authority: Human Architect
Implementation Authority: **Granted for the bounded repository scope**
Production/Deployment Authority: **Not granted**

Related:

- `ADO/01_Architecture/ADR/ADR-0011-secure-organization-bootstrap-and-administration-boundary.md`
- `ADO/01_Architecture/Feature_Blueprints/FB-002-organization-management-foundation.md`
- `ADO/01_Architecture/Technical_Specifications/TS-002-organization-management-foundation.md`
- `ADO/02_Development/Block_C3C_Normal_Administration_Backend_Authorization.md`
- `ADO/02_Development/Block_C3D_Admin_Web_Android_Capture_Authorization.md`
- `ADO/02_Development/Block_C3E1_Identity_First_Employee_Membership_Authorization.md`
- `ADO/02_Development/Block_C3_Organization_Administration_Implementation_Plan.md`
- `ADO/05_Evidence/Block_C3E2_Independent_Architecture_Security_Review.md`
- `ADO/05_Evidence/Block_C3E2_Independent_Implementation_Review.md`
- `ADO/05_Evidence/Block_C3E2_Implementation_Evidence.md`
- `ADO/05_Evidence/Block_C3E2_Physical_Validation_Evidence.md`

## 1. Purpose and authority boundary

C3E2 is the smallest explicit operation that moves one already registered, currently assigned NFC
Tag from its current active Customer to a different active Customer in the same Organization while
preserving immutable Assignment and time-attribution history.

The Human Architect authorized preparation of this package on the exact baseline above. Independent
read-only architecture/security review of commit `dbefc1c`, tree `3bcc153`, returned `APPROVED`
with zero open P0/P1/P2/P3 after independently confirming the six-file ADO-only delta and exact-head
ten-of-ten CI run `29646684981`.

The Human Architect subsequently accepted Sections 3–13 on that reviewed commit and explicitly
stated that this acceptance itself granted no implementation authority. After that separate
withholding statement, the Human Architect issued the distinct instruction `leg los!!!`, releasing
the bounded repository implementation from exact baseline `5bc4951`. That later release authorizes
migration `009`, code, tests, UI and strictly local harness work exactly as specified below. It does
not itself authorize production resources/data, deployment, distribution or the Human Physical
Gate. The subsequent independent implementation review of exact head `7050df4`, tree `587ef8f`,
and ten-of-ten run `29649683173` returned `APPROVED` with zero open P0/P1/P2/P3 and opened Gate 10.
The Technical Lead then confirmed exact APK/Web/harness binding, and the Human Architect completed
the complete fresh Section-11 physical sequence.

## 2. Repository evidence and constraints

The candidate is derived from current executable repository truth:

- `nfc_assignments` already stores `active`, `valid_from`, `valid_to`, `row_version` and an immutable
  Organization/Tag/target snapshot. A partial unique index permits only one active Assignment per
  `(organization_id, nfc_tag_id)`.
- The Assignment update trigger permits only active-to-inactive closure with an incremented
  `row_version`; it rejects target, Tag, Organization, creation-time or `valid_from` mutation.
- `work_events` references the complete Assignment snapshot
  `(organization_id, assignment_id, nfc_tag_id, target_type, target_customer_id)`. Historical
  WorkEvents therefore cannot silently follow a later active Assignment.
- `time_entries` retains its start and stop WorkEvents and target. The `BusinessEngine` rejects a
  scan for another target while a User has an active TimeEntry; it does not retarget or auto-stop.
- B5 resolves only the current active Assignment. B6 locks the submitted Assignment configuration
  `FOR SHARE`, validates the exact Assignment/Tag/target tuple and never substitutes another
  Assignment.
- An old configuration submitted after reassignment is not automatically evaluated. B6 preserves
  it as deferred evidence when durable storage is possible; it does not create a new Decision or
  TimeEntry under the new target.
- E2A's same-session cache stores the exact old Assignment snapshot and uses only the defer-only
  path after a transient live-resolution failure. Reassignment therefore must not add cache
  rewriting, historical reinterpretation or client-side time decisions.
- C3C already supplies server-derived current Administrator authority, expected-Membership
  narrowing, versioned command digests, command locks, append-only receipts, safe Tag summaries and
  disclosure-safe target lookup. Its setup role has no Assignment-update authority.
- The current safe Tag projection exposes `targetCustomerId` but not the active Assignment ID.
  Target alone is not a sufficient optimistic guard because an A→B→A history could return to the
  same target with a different active Assignment.
- Migrations `001`–`008` are the complete current migration set. Any accepted C3E2 schema change is
  additive migration `009`; no historical migration may be edited.

These facts rule out an in-place target update, a client-supplied Organization, an implicit
reassignment through the C3C provision route, and any mobile or server attempt to rewrite queued
evidence.

## 3. Human-accepted product decisions

The following independently reviewed decisions were explicitly accepted by the Human Architect on
2026-07-18. Their acceptance fixes the contract but does not authorize implementation:

1. **Operation.** C3E2 reassigns one already registered and currently assigned Tag to one different
   active Customer in the same Organization. It does not register a Tag, create a Customer, create
   an initially missing Assignment or provide a standalone unassign operation.
2. **Surface.** The supported operator surface is Admin Web. The operator selects a Tag from the
   existing safe projection and selects the new Customer. No NFC capture or raw payload is required
   to move an already known Tag. Android Administrator capture remains the C3C physical
   registration path and is not expanded by C3E2.
3. **Explicit confirmation.** Before submission, Admin Web shows the safe Tag label, shortened
   validation fingerprint, current Customer and proposed Customer, and requires an explicit
   confirmation action. The fingerprint remains a non-authoritative matching aid.
4. **No-op semantics.** A command whose exact expected active Assignment is already assigned to the
   requested Customer succeeds as a semantic no-op and returns that Assignment. It appends a
   success receipt but changes no Assignment and appends no Assignment audit events. Normal UI
   disables this unnecessary submission; the API behavior exists for deterministic semantic
   retries.
5. **Active-work guard.** A different-target reassignment is rejected while any active TimeEntry's
   start WorkEvent references the Assignment that would be closed. The command never retargets,
   stops or otherwise mutates that TimeEntry. This conservative rule ensures C3E2 cannot remove the
   Assignment through which an active work period began.
6. **Server cutover.** A successful different-target reassignment uses one PostgreSQL
   `transaction_timestamp()` as the old Assignment's exclusive `valid_to` boundary and the new
   Assignment's inclusive `valid_from` boundary. Client/device time is not authority.
7. **Historical truth.** Existing WorkEvents, Decisions, Receipts and TimeEntries retain the old
   Assignment and target snapshots. No historical record is deleted, overwritten, reparented or
   automatically reevaluated.
8. **Future scans.** A fresh post-commit B5 resolution returns the new active Assignment. A scan that
   already captured the old Assignment and loses the race is preserved as deferred evidence rather
   than interpreted under the new target.
9. **Physical closure.** Final C3E2 closure requires a fresh real Admin-Web/Galaxy-A33/NTAG213
   observation proving active-work rejection, successful post-stop reassignment and subsequent
   Start/Stop on the new Customer. Automated concurrency and rollback evidence remains mandatory
   before that Human gate.

## 4. Exact authenticated command and safe projection

### 4.1 Request

The only new mutation route is:

```text
POST /v1/administration/nfc-tags/reassign
{
  expectedMembershipId,
  commandId,
  nfcTagId,
  expectedActiveAssignmentId,
  targetCustomerId
}
```

All five values are required canonical lowercase UUID strings. The route rejects extra keys,
trailing-slash aliases, query strings, administration narrowing headers and bodies over the existing
administration limit.

`expectedMembershipId` and `expectedActiveAssignmentId` are narrowing values only. The server still
derives and locks the current User, Membership, Organization, role, Tag, current active Assignment
and target. The body cannot carry `organizationId`, `userId`, role, active state, validity
timestamps, row version, target type, raw/canonical NFC payload or a complete Domain object.

### 4.2 Projection extension

The setup-projection Tag item becomes a distinct projection DTO:

```text
AdminProjectedNfcTagSummary {
  id,
  displayName,
  validationFingerprint,
  assignmentState: "assigned" | "unassigned",
  targetCustomerId: UUID | null,
  activeAssignmentId: UUID | null
}
```

`targetCustomerId` and `activeAssignmentId` are both non-null exactly when `assignmentState` is
`assigned`; otherwise both are null. The server, Admin Web and Android parsers fail closed on any
other shape. This additive safe identifier contains no raw payload and permits the Web command to
detect stale A→B→A history.

The existing C3C provision-success `AdminNfcTagSummary` and its strict response shape do not gain
this field. Only `ReadSetupProjectionResult.nfcTags` moves to
`AdminProjectedNfcTagSummary`, preventing C3E2 from silently changing the closed provision result.

Android receives only the DTO compatibility update and regression coverage. C3E2 adds no Android
reassignment control, no new native capture path and no persistent Assignment-history cache.

### 4.3 Success

Success is HTTP 200:

```text
{
  status: "succeeded",
  idempotentRetry: boolean,
  assignmentChanged: boolean,
  resultAssignmentId: UUID,
  replacedAssignmentId: UUID | null,
  targetCustomerId: UUID,
  effectiveAt: RFC3339 UTC timestamp | null
}
```

- A first different-target success has `idempotentRetry: false`, `assignmentChanged: true`,
  the new result Assignment ID, the closed Assignment ID, the requested target ID and the one
  server cutover timestamp.
- Exact receipt replay returns the same immutable command outcome with only
  `idempotentRetry: true`. `resultAssignmentId` deliberately does not claim that the result remains
  current after some later, separately authorized reassignment; Admin Web refreshes the projection
  after every success.
- A same-target semantic no-op has `assignmentChanged: false`, the existing Assignment as
  `resultAssignmentId`, the existing target as `targetCustomerId`, and null
  `replacedAssignmentId`/`effectiveAt`.
- A non-null `effectiveAt` is serialized as canonical `YYYY-MM-DDTHH:mm:ss.sssZ` from the stored
  PostgreSQL timestamp. The Assignment rows and receipt retain the database-authoritative value;
  the response never derives it from client or device time.
- No response includes a Domain Event, raw payload, token, issuer, subject, email, SQL text,
  database/provider message or another Organization's resource state.

## 5. Result vocabulary, HTTP mapping and precedence

| Condition | Public result | HTTP |
|---|---|---:|
| invalid/expired identity, missing/revoked binding or no active Membership | `unauthorized` | 401 |
| Employee, role mismatch or expected-Membership mismatch | `forbidden` | 403 |
| missing/inactive/inaccessible target Customer | `assignment_target_unavailable` | 404 |
| missing/unassigned/inaccessible Tag, stale expected Assignment or concurrent reassignment | `assignment_conflict` | 409 |
| an active TimeEntry started through the Assignment to be closed | `assignment_in_use` | 409 |
| command ID reused with different actor, Membership, type or canonical content | `command_id_conflict` | 409 |
| malformed/extra-key/over-limit request | `invalid_request` | 400 |
| deadline, database or infrastructure failure | `service_unavailable` | 503 |

Precedence is normative:

1. strict request-shape validation;
2. verified identity plus locked current Membership and Organization;
3. Administrator role plus exact expected-Membership comparison;
4. versioned `(organization_id, command_id)` transaction lock;
5. exact receipt replay or divergent-receipt rejection;
6. tenant-local Tag/current active Assignment lock and exact
   `expectedActiveAssignmentId` comparison;
7. tenant-local active target lock;
8. same-target semantic no-op;
9. active-TimeEntry guard;
10. atomic close-and-append.

Tag/Assignment absence, foreign ownership, an inactive historical Assignment and a stale expected
Assignment collapse to `assignment_conflict`. Target absence, inactivity and foreign ownership
collapse to `assignment_target_unavailable`. Internal diagnostics may retain an allowlisted category
without resource identifiers; public output cannot distinguish cross-Organization existence.

## 6. Authority, role and transaction boundary

C3E2 does not widen `taptime_admin_setup`, reuse its runtime credential or expose the existing broad
`taptime_administrator` role.

The authorized implementation adds:

- one distinct reassignment runtime database login/pool;
- one `LOGIN NOINHERIT` role graph that may assume only `taptime_identity_resolver` and the new
  `taptime_assignment_reassigner` role;
- a dedicated `NfcTagReassignmentCoordinator`;
- one new runtime configuration URL whose decoded database username must be distinct from all six
  existing runtime pool users;
- transaction-local User, Organization, Membership, role and command-correlation context;
- only the exact tenant-qualified SELECT/UPDATE/INSERT/receipt capabilities required by this
  command.

The reassignment role receives no User, IdentityBinding, Membership, Organization, Customer or Tag
mutation; no delete; no lifecycle WorkEvent/Decision/Receipt mutation; no bootstrap/enrollment
capability; no generic SQL/repository callback; and no access to raw `payload_value`.
Its only lifecycle-data read is tenant-qualified column-level SELECT of active TimeEntry status/start
WorkEvent and the corresponding WorkEvent Assignment ID for the fixed active-work guard. Those rows
are never returned by the C3E2 API or exposed to the UI.

The coordinator follows:

```text
verify token
  -> lock and derive current User/Membership/Organization
  -> require Administrator and exact expected Membership
  -> lock (Organization, command ID)
  -> inspect exact/divergent reassignment receipt
  -> set transaction-local actor/tenant/Membership/correlation
  -> SET LOCAL ROLE taptime_assignment_reassigner
  -> lock current Assignment and target
  -> apply semantic no-op or active-work guard
  -> close old + append new + receipt + audits atomically
```

The command uses `READ COMMITTED READ WRITE`, the established eight-second internal deadline with
PostgreSQL lock/statement/transaction bounds, connection-error tracking and rollback-before-release.
A timeout is never reported while an uncontrolled write transaction can later commit.

## 7. Locking and race semantics

### 7.1 Command replay

The existing versioned command-lock construction is reused. A reassignment receipt is keyed by
`(organization_id, command_id)` and binds:

- current actor User ID;
- exact current Membership ID;
- command type `reassignNfcTag`;
- digest version;
- Organization ID;
- Tag ID;
- expected active Assignment ID;
- requested target Customer ID;
- safe result fields only.

Exact replay returns the stored success without new resource or audit rows. Any actor, Membership,
type or digest difference is `command_id_conflict`.

### 7.2 Same Tag, different commands

The current active Assignment row is locked `FOR UPDATE`. Two different command IDs racing the same
Tag cannot both close it:

- the winner closes the expected row and appends the new row;
- the waiter reloads current state after the lock and returns `assignment_conflict` because its
  expected active Assignment is stale;
- the unique active-Assignment index remains final defence in depth.

An exact retry of the winner succeeds from its receipt even though its expected Assignment is now
historical. Receipt lookup therefore precedes resource evaluation.

### 7.3 Lifecycle serialization

B6 takes a `FOR SHARE` lock on the submitted Assignment configuration before canonical evaluation.
C3E2's `FOR UPDATE` close therefore serializes with a scan using that Assignment:

- if B6 locks and commits first, C3E2 observes any newly active TimeEntry and returns
  `assignment_in_use`;
- if C3E2 commits first, B6 observes the old Assignment as inactive and preserves the old snapshot
  as deferred evidence without a Decision or TimeEntry mutation.

The active-work query is exact: it joins a `status = 'started'` TimeEntry through its
`start_work_event_id` to the old Assignment ID. It neither blocks on unrelated active work nor
infers from display/target names.

### 7.4 Target and history

The target Customer is locked tenant-locally and must remain active. The different-target mutation:

1. captures one `transaction_timestamp()`;
2. updates only old `active=false`, `valid_to`, `updated_at`, `row_version+1`;
3. inserts a new UUID Assignment with the same Organization/Tag, `target_type='customer'`, the new
   Customer, `active=true`, `valid_from` equal to the same timestamp;
4. inserts the success receipt;
5. commits both Assignment audit events and the receipt in the same transaction.

No Assignment row is deleted and no old target or validity start is changed.

## 8. Schema, receipt and audit contract

The authorized implementation adds only migration `009`. It must:

- add the dedicated reassignment executor/function-owner roles and exact PUBLIC revokes;
- add RLS/policies and grants for the narrow role;
- extend the existing append-only `admin_setup_command_receipts` command namespace with
  `reassignNfcTag` and narrowly typed reassignment result columns while preserving the exact
  create/provision checks and mappings. A separate table is prohibited because it would permit the
  same `(organization_id, command_id)` to succeed once in C3C and once in C3E2;
- add database-authoritative `admin_reassign_nfc_tag_digest_v1` and Node/SQL golden vectors;
- extend the administrative update/audit role allowlist only for
  `taptime_assignment_reassigner` on Assignment UPDATE/INSERT;
- preserve the existing update-shape trigger and one-active-Assignment index;
- reject receipt insertion unless exactly one command-type result shape applies and the referenced
  Assignment resources match the committed semantic no-op or close-and-append result;
- require exactly `NfcAssignmentDeactivated` for the old Assignment and `NfcTagAssigned` for the new
  Assignment on a changed result, with current actor, null operator principal and command ID
  correlation;
- require zero Assignment mutation/audit events for a same-target no-op;
- keep tokens, issuer, subject, email, raw payload, request JSON and display data out of receipts and
  audit payloads.

The receipt stores success only. `assignment_conflict`, `assignment_in_use`, target unavailability,
authority rejection and infrastructure failure create no receipt or Assignment audit event.

## 9. Admin Web behavior

The existing Admin Web session remains the only React authority source. C3E2 adds one focused
reassignment control to the authenticated setup projection:

- select one assigned Tag from safe projected data;
- show label and explicitly labelled shortened validation fingerprint;
- show current Customer;
- select an active target Customer;
- present an explicit current→target confirmation;
- generate one UUID command ID at intent creation and retain it across ambiguous retry;
- disable duplicate submission while one command is active;
- refresh the projection only after strict success parsing;
- on `assignment_conflict`, discard stale intent and require a fresh projection before retry;
- on `assignment_in_use`, state that the work period must be stopped before reassignment;
- on session/Membership change, sign-out or projection failure, destroy the pending intent and all
  selected IDs.

No raw UID entry, clipboard payload, NFC browser API, hidden Organization selector or optimistic
local reassignment is permitted. UI success is shown only after the server's exact safe success.

## 10. Mandatory verification matrix

### Contract and pure tests

- exact Node/SQL digest vectors bind Organization, actor, Membership, Tag, expected Assignment and
  target with unambiguous length framing;
- strict request/response DTO parsing, extra-key rejection and all result/HTTP mappings;
- safe projection requires the exact target/active-Assignment nullability invariant;
- the maximum 20-item projection remains below the existing 16-KiB encoded-response limit after the
  additional UUID field;
- Admin Web command ID retention across ambiguous retry and destruction on new intent/session
  transition;
- raw payload/token/provider-error absence from Web types, state, rendered output, receipts, audits
  and normal diagnostics.

### PostgreSQL and coordinator tests

- current Administrator success; Employee, revoked/replaced Membership and forged tenant/role
  denied before receipt/resource access;
- missing/foreign/unassigned Tag and stale/foreign Assignment collapse to `assignment_conflict`;
- missing/inactive/foreign target collapses to `assignment_target_unavailable`;
- same-target semantic no-op returns the existing Assignment, one receipt and zero mutation/audit;
- different-target success closes exactly one old row and appends exactly one active row with one
  timestamp/correlation;
- immutable old snapshot, row-version increment, new-row shape and unique-active invariant;
- exact receipt replay, divergent actor/Membership/type/content conflict and same command ID in
  another Organization;
- same-Tag concurrent different commands produce one success, one stale conflict and one history
  transition;
- active TimeEntry started through the old Assignment produces `assignment_in_use`, zero receipt,
  zero Assignment/audit change and remains stoppable;
- after that TimeEntry is stopped, the same new intent can succeed;
- B6/C3E2 races in both lock orders prove either old canonical completion followed by active-work
  rejection, or reassignment followed by old-snapshot deferred evidence; never new-target
  reinterpretation;
- already durable deferred evidence remains old and is not automatically reevaluated;
- rollback after old close, new insert, each audit and receipt stage leaves exact pre-command state;
- deadline, connection failure and commit ambiguity preserve retry safety;
- role graph, RLS, grants, owner, search path and PUBLIC revokes prove no C3C, Membership, lifecycle,
  delete, raw-payload or cross-tenant capability.

### API, client and regression tests

- exact route/method/content-type/body-size/UUID/CORS behavior and generic 503 diagnostics;
- Admin Web success, no-op, active-work, stale conflict, session transition, pagination and strict
  fail-closed parser behavior;
- Android setup projection remains compatible with `activeAssignmentId` but exposes no C3E2 action;
- C3C create/provision result shapes and C3E1 enrollment boundaries remain unchanged;
- B5 resolves the new active Assignment after commit;
- Core `BusinessEngine`, B6 lifecycle behavior, E1 outbox and E2A defer-only behavior remain
  unchanged;
- migration order/checksum, complete workspace tests/typechecks/builds, PostgreSQL harness and
  `git diff --check`.

## 11. Human Physical Gate

The physical gate may start only after:

1. an independently approved implementation commit;
2. a green exact-head GitHub Actions run;
3. Technical-Lead confirmation that the tested APK/Web/harness artifacts bind to that exact head.

The complete checklist must begin fresh:

1. start the local synthetic environment with numeric-loopback Auth/API and scoped USB reverse;
2. create two synthetic Customers and register/assign one real NTAG213 through the existing C3C
   protected Android path;
3. enroll/sign in the synthetic Employee through the closed C3E1 path;
4. scan the physical Tag to start work on Customer A;
5. attempt Admin Web reassignment to Customer B and observe the explicit active-work rejection;
6. prove counts/history are unchanged by that rejection;
7. scan the Tag again to stop Customer A;
8. submit one explicit Web reassignment and observe safe success plus updated Web/Android projection;
9. scan the same physical Tag twice and observe server-backed Start then Stop on Customer B;
10. verify sanitized final history: exactly two Assignments for the Tag, old inactive/new active,
    one shared cutover timestamp, pre-cutover WorkEvents/TimeEntry on A, post-cutover
    WorkEvents/TimeEntry on B, exact receipts/audits and no raw payload;
11. sign out both surfaces and complete schema/login/listener/reverse cleanup.

Any automatic rollback, expired setup state, wrong identity, uncontrolled clipboard transfer,
non-exact artifact or incomplete cleanup invalidates that attempt. No observation is carried into a
fresh run.

## 12. Explicit non-goals

C3E2 does not authorize:

- Tag registration, unassigned-Tag assignment, bulk reassignment or standalone unassign;
- Customer deactivation/delete, Tag delete, Assignment delete or history editing;
- TimeEntry correction, manual stop, retargeting, reporting, export or approval workflow;
- changes to `BusinessEngine`, duplicate suppression, AssignmentResolver/Validator, WorkEvent
  content, lifecycle Decision rules, E1/E2A persistence or deferred-evidence reconciliation;
- Android/iOS/Web NFC capture expansion, NDEF writing or browser raw UID handling;
- Membership invitation/revocation/role transfer, additional Administrator setup or
  multi-Organization Membership;
- production cloud resources, production data, deployment, distribution or legal/privacy closure.

## 13. Stop conditions

Stop and return to Technical Lead/Human Architect if implementation would require:

- rewriting or deleting Assignment/WorkEvent/TimeEntry history;
- client/device time as the cutover authority;
- changing a queued WorkEvent to the new Assignment/target;
- auto-stopping or retargeting an active TimeEntry;
- exposing `taptime_administrator`, the C3C credential, service-role authority or generic SQL;
- accepting Organization/User/role/payload/validity state from the Web command;
- a raw UID in Web, response, receipt, audit or normal diagnostics;
- broadening C3E2 into initial assignment, unassign, bulk CRUD or another C3E slice;
- editing migrations `001`–`008`;
- production resource/data access.

## 14. Authorization gates

Current gate state:

1. Exact candidate baseline recorded — **complete**.
2. Human authorization to prepare this package — **complete**.
3. Independent architecture/security review of commit `dbefc1c` — **complete; APPROVED with zero
   open P0/P1/P2/P3**.
4. Human Architect acceptance of Sections 3–13 — **complete on 2026-07-18; explicitly no
   implementation authority**.
5. Separate repository implementation authorization — **complete on 2026-07-18 through the later
   instruction `leg los!!!`, bound to implementation baseline `5bc4951`**.
6. Local implementation verification — **complete; 1,571 tests passed, two unchanged optional
   Supavisor skips, all workspace typechecks/builds and `git diff --check` passed**.
7. Technical-Lead implementation audit — **complete for the local candidate; no open finding**.
8. Implementation commit/push and exact-head CI — **complete; implementation `b783733`, CI-only
   correction `672b7ac`, exact-head run `29649388470`, ten of ten jobs passed**.
9. Independent implementation review — **complete; `APPROVED` with zero open P0/P1/P2/P3 on
   `7050df4`, tree `587ef8f`, exact-head run `29649683173` ten of ten**.
10. Fresh Human Physical Gate — **complete; passed on Galaxy A33/Android 15/NTAG213 with exact
    active-work rejection, unchanged rejection state, Customer-A Stop, A→B cutover, Customer-B
    Start/Stop, sanitized final history and complete cleanup**.
11. Truthful closure synchronization — **in progress; ADO-only closure candidate requires
    publication, exact-head CI and independent final closure review**.

Gate 11 is now the only remaining C3E2 repository-closure gate. Production resources/data,
deployment and distribution remain outside C3E2 authority.
