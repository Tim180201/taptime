# ADR-0014: Append-only Time-Record Correction and Human Review Adjudication

- Status: **HUMAN-ACCEPTED ON EXACT BASELINE; LOCAL IMPLEMENTATION CANDIDATE PASSES AVS V0–V3; V4 AND INDEPENDENT EXACT-SHA REVIEW PENDING**
- Date: 2026-07-21
- Owner: Technical Lead
- Decision authority: Human Architect
- Accepted/authorized baseline commit: `ff68f7a7d0ce69a65e88846ae1cca9abd5951f5d`
- Accepted/authorized baseline tree: `09ef169a68bb53420e07b6f3fcbbdc74e0c01d57`
- Applies to: Development Assignment 3; DT-069–DT-074 authorized local implementation scope,
  still open pending V4/review/closure
- Risk class: AVS-001 **R3**
- Supersedes: nothing
- Amends on acceptance: ADR-0012 review-adjudication continuation and ADR-0013 export-value semantics only as stated in DA3-P12
- Independent pre-implementation review: `APPROVED FOR CANDIDATE PUBLICATION`, zero open P0/P1/P2/P3
- Human acceptance: DA3-P01–DA3-P16 accepted on the exact baseline above on 2026-07-21
- Repository implementation authority: Workstreams A–D and AVS V0–V4 authorized on the exact
  baseline above; production, production data, deployment, distribution and Physical Gate excluded

## 1. Context

Development Assignment 1 closed the complete offline synchronization platform for its authorized
local Android/repository/synthetic-server scope. Its accepted ADR-0012 deliberately persists
`review_pending` evidence without a CanonicalDecision or TimeEntry mutation when automatic
evaluation is unsafe. It also makes later offline evidence review-only until the predecessor is
adjudicated and assigns the privileged correction/adjudication workflow plus append-only Human
decision to Development Assignment 3.

Development Assignment 2 closed setup integration and the Administrator CSV export backend for
its authorized local scope. CSV v1 currently reads canonical `time_entries` directly and has no
correction overlay.

The current repository has:

- immutable WorkEvents and CanonicalDecisions;
- lifecycle-owned `time_entries`, whose only allowed update is the exact `started` to `stopped`
  transition;
- immutable `offline_event_reconciliations`, including durable `review_pending` evidence;
- a sticky server `review_predecessor_sequence` and sticky encrypted-Mobile
  `review_pending_sequence`;
- append-only general `audit_events`;
- an Administrator-only, tenant-safe, bounded CSV export; and
- no correction, effective-time-record, review-adjudication or operator overview implementation.

Core Roadmap v2 Block F defines DT-069–DT-074: manual start/stop adjustment, required reason,
append-only audit, minimal overview, minimal correction interface and export trigger. The later
planning decision names Development Assignment 3 as the correction and append-only audit workflow
and Development Assignment 4 as professional Admin Web productization. Therefore DA3 must deliver a
minimal functional operator workflow without claiming DA4 polish or broader administration.

## 2. Decision drivers

1. Product Principle 5 requires corrections not to destroy original operational history.
2. The BusinessEngine remains the only automatic lifecycle decision authority.
3. Human adjudication is allowed only because ADR-0012 has already proved automatic evaluation
   unsafe and preserved the evidence.
4. A current Administrator must be able to correct stopped time records and resolve review evidence
   without direct database access.
5. Tenant, identity, Membership, lifecycle and offline ordering boundaries must fail closed.
6. Export and overview must show one coherent effective truth without mutating historical evidence.
7. DA3 must be usable but must not pre-empt professional DA4 UI/UX productization.

## 3. Decision

### DA3-P01 — Assignment boundary

DA3 SHALL deliver one cohesive minimal operator workflow comprising:

- a bounded current-Administrator time-record overview;
- append-only correction of stopped canonical or recovered time records;
- append-only Human adjudication of supported server-side lifecycle review evidence;
- safe release of resolved offline predecessor state;
- effective-time-record use by the existing CSV v1 export; and
- a minimal Admin Web surface for overview, correction, adjudication and triggering the existing
  export route.

DA3 is not professional Admin Web productization. Responsive visual polish, broad navigation,
analytics, dashboards, bulk operations and general CRUD belong to DA4 or a later separately
accepted scope.

DT-069–DT-074 may close only after exact implementation, operator-flow and review evidence. This
ADR does not close them.

### DA3-P02 — Authority is current, exact and server-derived

Every Administrator overview/export/correction/adjudication read or command SHALL require:

- a verified access token;
- the exact expected Membership ID;
- server resolution of IdentityBinding, User, Organization and Membership;
- `membership.role = 'administrator'`; and
- a non-revoked Membership at transaction time.

Client Organization, role, actor User or target Membership claims are never authority. Employee,
missing, revoked, stale-Membership and cross-Organization requests fail closed without disclosing
row existence. Authority is rechecked under lock for every write.

The sole exception is DA3-P10's Mobile self-state query. It requires the exact current authenticated
Employee or Administrator IdentityBinding/Membership/installation tuple and returns only that
caller's unresolved-sequence-or-clear state. It cannot list evidence, another user or another
installation.

### DA3-P03 — Original lifecycle truth is immutable

DA3 SHALL NOT update or delete:

- WorkEvents;
- CanonicalDecisions;
- lifecycle SyncReceipts;
- existing `time_entries` historical columns;
- offline installations, leases, lease items, lease receipts or reconciliations; or
- existing AuditEvents.

Canonical `time_entries` remain the BusinessEngine/lifecycle result. Correction creates a separate
append-only revision. Human adjudication creates a separate append-only decision. No DA3 path may
fabricate a CanonicalDecision or retroactively run an old event through automatic evaluation.

### DA3-P04 — Stable logical record and append-only revision model

Migration `012` SHALL add an immutable time-record adjustment ledger. Each effective record has one
stable `time_record_id` and zero or more numbered append-only revisions:

- a canonical record uses its existing `time_entries.id` as `time_record_id`;
- a recovered record receives a new server-stored UUID and has no canonical TimeEntry foreign key;
- a revision stores the complete effective start and stop instants, Organization, Employee User,
  target, actor User/Membership, reason, previous revision, command/request binding and server
  timestamp; and
- the database enforces one contiguous revision chain per Organization/time record.

The effective record is the immutable canonical stopped row when no revision exists, otherwise the
highest committed revision. A recovered record exists only through its revision chain. No DA3 v1
record is deletable or voidable.

### DA3-P05 — Correction policy

A normal correction SHALL:

- target exactly one stopped canonical or recovered record in the current Organization;
- preserve its Employee User and Customer target;
- provide complete replacement `startedAt` and `stoppedAt` instants;
- require `startedAt <= stoppedAt` and `stoppedAt <= transaction_timestamp()`;
- change at least one effective instant;
- require the current base row version and effective revision number; and
- append exactly one revision and one correction audit in one transaction.

An active canonical TimeEntry is read-only in DA3 v1. It must first stop through the unchanged
lifecycle. DA3 introduces no duration rounding, break calculation, payroll classification, approval
or automatic overlap rule. Overview SHALL expose overlaps truthfully; it SHALL NOT silently rewrite
them.

### DA3-P06 — Mandatory reason

Every correction and every adjudication requires a Human-entered reason. The accepted value is a
PostgreSQL text value whose `btrim` length is 1–500 characters. The reason is stored verbatim in the
append-only ledger and audit payload after transport validation; it is never interpolated into SQL,
logs or CSV cells.

DA3 defines no reason taxonomy and no automatic reason. UI helper copy may suggest useful detail but
may not invent or preselect a substantive Human explanation.

### DA3-P07 — Idempotency and optimistic concurrency

Every write command SHALL include a UUID command ID and canonical versioned request digest. Exact
retry returns the original exact result. Reuse with different content returns
`command_id_conflict` without mutation.

Correction additionally requires expected base row version and expected effective revision.
Adjudication requires the exact ordered review-item set and expected unresolved state. Stale input
returns a bounded conflict and current safe projection, never an implicit overwrite.

All writes acquire the existing byte-identical
`hashtextextended(organization_id || U+001F || affected_user_id, 0)` transaction advisory lock
before mutable-row locks. This serializes DA3 with online lifecycle, offline ingestion and competing
DA3 commands for the same Organization/User while allowing unrelated users to proceed.

### DA3-P08 — Review item projection

The Administrator review queue SHALL expose bounded, same-Organization, server-side evidence only:

1. unresolved `offline_event_reconciliations.result_status = 'review_pending'`; and
2. protected legacy server evidence represented by a WorkEvent plus its existing defer-only Audit,
   with no CanonicalDecision and no offline-v2 reconciliation.

The projection includes only the fields needed to make a decision: stable review item ID/source,
Employee display attribution, Customer attribution, event occurrence/recording time, closed review
reason where available, device sequence where available and whether later evidence is predecessor-
blocked. It excludes tag payload/UID, credential material, lease lookup keys, HMAC values and raw
provider diagnostics.

Ordering is deterministic by server evidence recording time then WorkEvent ID. Reads are bounded to
100 rows and use opaque continuation. Cross-tenant identifiers produce the same empty/not-found
shape as absent identifiers.

### DA3-P09 — Append-only adjudication and recovered closed records

One adjudication command SHALL process 1–25 currently unresolved review items for one
Organization/User and one source family. Offline-v2 items must be the exact deterministic unresolved
offline prefix for that Organization/User; legacy items use their own deterministic server-evidence
order and never participate in offline predecessor release. Offline-v2 and legacy items cannot be
mixed in one command. The Human chooses exactly one resolution:

- `no_time_record_change`; or
- `adjust_existing_time_record`; or
- `create_recovered_time_record`.

`adjust_existing_time_record` follows DA3-P05 and atomically links all selected evidence to the new
revision. `create_recovered_time_record` is allowed only from selected review evidence, requires all
selected items to resolve to one Employee and Customer, requires a closed non-future interval and
creates revision 1 of one new stable logical record. It is not a generic manual-entry creation API.

Every selected item receives one immutable Human adjudication row containing actor, Membership,
resolution, reason, command, optional adjustment/recovered-record link and server time. A review item
cannot be adjudicated twice. A mistaken later time value may be corrected by another record revision;
the original Human adjudication itself remains historical truth.

If the selected items are not the exact unresolved prefix, cross user/target boundaries incorrectly,
or cannot support the chosen resolution, the entire command fails with zero mutation.

### DA3-P10 — Safe predecessor release and Mobile truth

An offline review predecessor is unresolved only while no adjudication row exists for that immutable
reconciliation. Migration `012` SHALL replace the current predicate accordingly without updating the
reconciliation.

After an adjudication transaction, the server may clear an installation cursor's
`review_predecessor_sequence` only when no unresolved review reconciliation remains for that exact
Organization/User/installation. The cursor transition trigger and grants SHALL permit only this
proved security-definer transition; offline ingestion cannot arbitrarily clear it.

An exact current-actor review-state query SHALL return either the earliest unresolved sequence or a
clear result for the exact installation. Mobile may clear its encrypted local
`review_pending_sequence` only after an authenticated matching clear result for the same
Organization/User/Membership/installation. Lost, malformed, stale or unavailable responses retain
the local marker. This change removes a status marker, never local lifecycle evidence.

New offline events remain governed by unchanged ADR-0012 automatic predicates. Adjudication does not
make an old event automatically eligible.

### DA3-P11 — Legacy evidence boundary

Server-side legacy defer-only WorkEvents may receive an append-only Human adjudication and may
support a recovered record under DA3-P09. They are never assigned a device sequence, converted into
offline-v2 reconciliation or retroactively evaluated.

Protected records that exist only on a Mobile device and cannot be matched to server evidence remain
protected. DA3 SHALL NOT guess, delete or import them through an Administrator browser. Any future
device-assisted recovery is a separate architecture and Human authorization.

### DA3-P12 — Effective overview and CSV export semantics

On acceptance, ADR-0013 CSV v1's columns, delimiter, encoding, quoting, ordering, range, row, byte,
hash and audit contract remain unchanged. Its row source changes from raw canonical TimeEntries to
the DA3 effective time-record projection:

- corrected canonical records retain the canonical TimeEntry UUID;
- recovered records use their stable logical time-record UUID;
- `started_at`, `stopped_at`, `status` and `duration_seconds` reflect the latest committed revision;
- uncorrected active canonical entries remain truthful `started` rows;
- each logical record appears at most once; and
- the repeatable-read export snapshot cannot mix revision states.

Range inclusion and row ordering use the effective `started_at`, so a committed correction may move
a record into or out of a later export query without duplicating it.

CSV v1 intentionally adds no provenance, reason or actor column. Those remain available only through
the privileged overview/audit workflow. Export cannot observe an uncommitted correction and a
successful export audit continues to hash the exact returned bytes.

### DA3-P13 — Isolated database capabilities

Migration `012` SHALL add distinct NOLOGIN/NOINHERIT/NOBYPASSRLS application roles for DA3 reads and
writes plus narrowly owned security-definer functions. Runtime uses distinct validated pools/URLs;
it does not reuse `taptime_administrator`, lifecycle, offline-ingestion or export credentials.

The Administrator read role receives only bounded projection functions. The write role receives only exact
correction/adjudication functions. Function owners receive only the columns/tables required by each
capability. New tables use forced RLS, tenant-qualified keys, immutable update/delete triggers and
direct hostile-role tests. Existing roles gain no broad DA3 table access.

DA3-P10's self-state capability is granted only as one exact function to the existing isolated
offline reconciliation reader and uses its existing runtime pool; it receives no Administrator
review projection or write access.

The existing `taptime_time_exporter` receives only the minimum effective-projection execution/read
capability needed for DA3-P12; it receives no reason, adjudication or audit-detail access.

### DA3-P14 — Exact API and minimal Admin Web surface

DA3 SHALL add strict authenticated endpoints for:

- bounded time-record query;
- one correction command;
- bounded review-item query;
- one adjudication command; and
- exact Mobile review-state query.

All body routes require exact JSON media type and closed schemas, bounded bodies, exact expected-
Membership binding, operation deadlines and disclosure-safe error mapping. The existing export route
is reused unchanged at the HTTP boundary.

The minimal Admin Web surface SHALL provide:

- a bounded date-window overview;
- explicit source/revision/status display;
- correction with visible before/after values, mandatory reason and final confirmation;
- review evidence with explicit selected resolution, mandatory reason and final confirmation; and
- an export action using the existing DA2 route.

It SHALL not cache privileged data across sign-out/identity change, expose raw IDs as authority or
perform optimistic success before the server's committed result. Accessibility and safe failure copy
are required; DA4 visual/product polish is not claimed.

### DA3-P15 — Audit meaning

The append-only ledgers are authoritative correction/adjudication history. Each successful command
also appends exactly one summary AuditEvent with the command ID as correlation ID. Audit payloads
record who, what, when, from/to and why, plus exact affected evidence/record IDs and schema version.

Failed, stale, unauthorized or rolled-back commands create no success ledger or success AuditEvent.
An exact idempotent retry creates no duplicate. Audit times are server transaction times. UI receipt
does not claim that a Human viewed or downloaded an export; DA2's `generated` meaning remains.

### DA3-P16 — Retention and professional-use boundary

DA3 records are append-only with no deletion API or retention job. This preserves evidence but is not
a legal retention decision. Production personal data, subject-right workflows, legal basis,
retention periods, payroll use, billing, approvals and external compliance review remain separately
gated.

## 4. Schema and component shape

The accepted implementation is expected to add:

- migration `012_append_only_time_record_correction_and_review_adjudication.sql`;
- a neutral time-review contract package;
- an isolated backend time-review coordinator;
- API composition for the five exact DA3 routes and distinct pools;
- effective-projection integration in backend time export;
- minimal Admin Web pages/components;
- narrowly required Mobile review-marker reconciliation; and
- focused PostgreSQL, contract, API, Web, Mobile and synthetic workflow tests.

Exact names may change only for implementation mechanics without changing DA3-P01–DA3-P16. Any
material behavior change requires impact analysis and renewed independent/Human review.

## 5. Transaction and lock order

Write transactions SHALL use this order:

1. begin with bounded transaction/statement/lock timeouts;
2. set and verify exact actor context and isolated role;
3. lock current IdentityBinding/Membership authority;
4. acquire Organization/User advisory lock using the existing lifecycle key bytes;
5. lock command receipt/idempotency state;
6. lock target TimeEntry/latest revision or exact unresolved review rows;
7. for adjudication, lock affected offline cursor rows in deterministic installation order;
8. revalidate authority, expected versions, review prefix and effective values;
9. append revision/adjudication, summary audit and receipt;
10. clear only proved-resolved server cursor markers; and
11. commit before returning success.

No DA3 lock may be acquired before the shared Organization/User advisory lock if online/offline
lifecycle can acquire it later. Cross-route tests SHALL prove both race orders.

## 6. Failure and race contract

| Scenario | Required result |
|---|---|
| Employee/revoked/stale/cross-tenant actor | disclosure-safe denial, zero visibility and mutation |
| Active canonical TimeEntry correction | `not_adjustable`, zero mutation |
| Stale row/revision or competing correction | one winner; loser conflict with no audit/revision |
| Same command/content retry | exact stored result, no duplicate |
| Same command/different content | `command_id_conflict`, zero mutation |
| Lifecycle stop races correction | shared lock yields either not-adjustable-before-stop or correction-after-stop; never mixed |
| Export races correction | repeatable-read raw-old or effective-new complete snapshot, never mixed |
| Review ingestion races adjudication | deterministic shared lock/prefix result; no skipped unresolved item |
| Review batch is not exact prefix | conflict, zero mutation |
| Recovered record uses mixed Employee/Customer evidence | invalid request/conflict, zero mutation |
| Cursor clear while unresolved evidence remains | rejected by database invariant |
| Mobile clear response lost/stale/malformed | local review marker retained |
| Audit/receipt/cursor update fails | complete rollback |
| Client disconnect after commit | durable ledger/audit remains; retry is idempotent |
| Pool reuse after success/failure | no role/actor/tenant/deadline context leakage |
| Legacy local-only evidence | remains protected; no inferred adjudication |

## 7. Consequences

### Positive

- Operational history and automatic engine truth stay intact.
- Human corrections and review decisions are attributable and tamper-evident at the application
  boundary.
- Operators receive one minimal usable workflow before DA4 polish.
- Export becomes operationally truthful after corrections without breaking CSV v1 shape.
- Resolved offline predecessor state can clear without rewriting original evidence.

### Negative

- Effective truth becomes a projection across canonical rows and revision ledgers.
- Export, offline synchronization, Mobile status and Admin Web become transitive DA3 consumers.
- Recovered time records are not Canonical TimeEntries and require precise provenance/audit
  language.
- Append-only mistaken Human decisions cannot be erased; later corrections add history.
- R3 verification and independent review are broad and implementation effort is high to very high.

## 8. Rejected alternatives

### Update `time_entries` in place

Rejected because it destroys original lifecycle truth, conflicts with existing stop-only triggers and
weakens auditability.

### Put corrected timestamps only in AuditEvents

Rejected because AuditEvents alone do not provide a constrained revision chain or one deterministic
effective projection.

### Automatically replay `review_pending` through the BusinessEngine

Rejected because ADR-0012 persisted it precisely when automatic predicates failed; later state may
make retroactive evaluation unsafe and misleading.

### Let administrators use SQL/CLI credentials

Rejected because it bypasses tenant, idempotency, audit and product authorization boundaries.

### Defer every operator interface to DA4

Rejected because ADR-0012 and Block F require an actually usable privileged workflow; DA4 remains
responsible for professional productization, not first functional reachability.

### Change CSV v1 columns to include correction metadata

Rejected for DA3 because it would break the accepted DA2 interchange contract. Privileged overview
holds provenance; a future CSV v2 requires a separate decision.

## 9. Verification and review trigger

DA3 is AVS-001 R3. Before Technical-Lead approval it requires direct PostgreSQL role/RLS/function-
owner/immutability/rollback/concurrency evidence; complete affected contract/backend/API/export/Web/
Mobile verification; and a synthetic setup-to-lifecycle-to-review/correction-to-export journey.

Before publication it requires one complete V3 local candidate regression, exact-head V4 CI and
independent exact-SHA implementation review. Human-visible Web/Mobile review-state behavior requires
a separately authorized fresh V5 gate before final scope closure if the accepted authorization keeps
that gate.

Review is triggered again by any proposal to:

- mutate canonical evidence;
- allow active-entry correction, deletion/voiding, generic manual record creation or automatic
  overlap decisions;
- broaden roles, batch size, tenant scope or export schema;
- automatically replay review evidence;
- clear local/server review markers without exact server proof; or
- use production resources/data, deploy or distribute.

## 10. Current authority

The Human Architect authorized preparation of this ADO-only candidate. Independent read-only
pre-implementation review approved the exact seven-file `+833/-5` candidate for publication with
zero open P0/P1/P2/P3. DA3-P01–DA3-P16 remain proposals, not accepted product decisions. No
migration, dependency, source, test, workflow, build, Admin Web/Mobile implementation, Physical
Gate, production access, deployment or distribution is authorized by this document alone.
