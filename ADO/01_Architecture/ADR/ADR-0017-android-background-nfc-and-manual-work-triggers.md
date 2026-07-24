# ADR-0017: Android Background NFC and Manual Work Triggers

- Status: **HUMAN ACCEPTED — LOCAL IMPLEMENTATION CANDIDATE; V4, INDEPENDENT IMPLEMENTATION REVIEW AND HUMAN V5 PENDING**
- Date: 2026-07-24
- Implementation baseline commit: `fb32a2796e78c78ce12f856c908545de7ce7bf99`
- Implementation baseline tree: `53d6b5d6c2c86a8a3245539d821a12fae6850673`
- Baseline CI: 12/12 successful, as bound by the Human authorization
- Owner: Technical Lead
- Decision authority: Human Architect
- Roadmap: Development Assignment 5
- Revisits: ADR-0002, ADR-0004, ADR-0005, TS-001
- Related: ADR-0003, ADR-0007–ADR-0016, AVS-001
- Proposed implementation risk: AVS-001 **R3**

## 1. Context and accepted product intent

The Human Architect requires two additional Mobile capabilities:

1. scanning a supported NFC Tag while TapTim.e is not open should launch or resume the Android app
   and submit the scan to the normal Business Engine path only when the current authenticated
   authority may use the active assignment; and
2. a Mobile user must be able to trigger time capture manually by selecting a Customer, Project or
   Organization-wide General Work target. The resulting record must visibly and auditably retain
   that it was started manually.

The current implementation is narrower:

- Android NFC capture is foreground-only and explicitly started from `ScanScreen`;
- `WorkEvent` always requires NFC Tag and Assignment identifiers;
- `AssignmentTarget`, persistence and offline contracts are Customer-only;
- no Project or General Work entity exists; and
- the existing manual fallback is test/demo scan input, not a Product manual-work trigger.

Android's Tag Dispatch system can start a matching Activity while the screen is unlocked, but the
operating system cannot evaluate TapTim.e session, tenant, Membership or assignment authority
before it starts the Activity. Therefore “only when assigned” can and must govern creation and
submission of a WorkEvent, not the preceding operating-system launch.

## 2. Decisions

### DA5-T01 — One event-driven lifecycle

NFC and manual actions are trigger sources, never Start or Stop commands. Both create an immutable
candidate WorkEvent and reach the same server Business Engine. The existing decision order remains:

1. reject invalid or unauthorized evidence;
2. apply per-User/per-target duplicate protection;
3. start when no TimeEntry is active;
4. stop when the same target is active;
5. reject when another target is active; and
6. escalate inconsistent state.

No UI, Android adapter, offline component or API route may preselect Start/Stop or mutate a
TimeEntry directly.

### DA5-T02 — Generalized WorkTarget

The domain SHALL introduce a closed `WorkTarget` union:

```text
customer | project | general_work
```

- `customer` references an active Organization-owned Customer.
- `project` references an active Organization-owned Project with a bounded display name.
- `general_work` references the single built-in General Work target of that Organization.

Every target has an opaque target identity and exact Organization ownership. Existing Customer
identities and history remain stable. Project and General Work are first-class domain targets; they
must not be encoded as fake Customers, fake NFC assignments or magic display-name strings.

A tenant-qualified `work_targets` registry (or an exactly equivalent relational identity) SHALL
enforce `(organization_id, target_type, target_id)` as one canonical target identity. Existing
Customers are backfilled with the same Customer ID; Customer creation maintains both records
atomically. WorkEvent and TimeEntry reference that composite target identity directly; Decision,
Receipt, revision and effective projections retain it through their invariant
WorkEvent/TimeEntry links. No target ID from another Organization can satisfy the reference.

Every existing Organization receives exactly one built-in General Work target during migration and
every future Organization receives it in the same atomic bootstrap transaction. It is always
active, cannot be renamed, deactivated, deleted or duplicated, and its German v1 display label is
`Allgemeine Arbeitszeit`.

### DA5-T03 — Project administration boundary

Current Administrators may create, list and deactivate Projects through the existing protected
setup authority pattern. Project creation requires an expected current Membership and a bounded,
trimmed display name. Project names are immutable in DA5. Deactivation is atomic and fails closed
while any active TimeEntry in the Organization references the Project. Successful deactivation
prevents later selection but never changes historical WorkEvents or TimeEntries.

Online manual ingestion, offline reconciliation and Project deactivation use one lock order:

1. resolve and lock current identity/Membership authority;
2. lock the exact `(organization_id, project_id)` Project/WorkTarget row and validate its row
   version/activity;
3. for a trigger, acquire the existing Organization/User lifecycle lock and evaluate/persist while
   retaining the Project lock through commit; or
4. for deactivation, while retaining the Project lock, reject if any active TimeEntry references
   it, otherwise deactivate and commit.

Thus a concurrent Start that obtains the Project lock first makes later deactivation observe and
reject the active entry; deactivation that commits first makes the later trigger reject the
inactive target. A concurrent Stop may finish first and then permit deactivation. No pre-lock
activity check is authoritative.

Project administration adds no project planning, customer-project relation, membership assignment,
budget, task, billing, scheduling or deletion capability.

The closed routes are:

```text
POST /v1/administration/projects/query
  { expectedMembershipId, limit, cursor }
POST /v1/administration/projects/create
  { expectedMembershipId, commandId, projectId, displayName }
POST /v1/administration/projects/deactivate
  { expectedMembershipId, commandId, projectId, expectedRowVersion }
```

`limit` is 1–20 and `cursor` follows the existing opaque 256-ASCII-character setup boundary.
Command and Project IDs are canonical UUIDs. Create/deactivate are idempotent only for an exact
matching receipt; stale row version or changed command content fails closed. Successful writes
return the safe Project projection plus the existing receipt identity and append exact
Administrator attribution.

### DA5-T04 — Manual target projection

The authenticated Mobile runtime receives one bounded safe projection of active Customers, active
Projects and the General Work target for the exact current Organization. Organization, target and
Membership authority are derived server-side; `expectedMembershipId` is compare-only.

The result exposes opaque target identity, target type and display name only. It contains no NFC
value, assignment history, foreign identity, audit record or privileged setup metadata.

Both current v1 roles, Employee and Administrator, may manually trigger work for a target returned
by this projection. No per-Employee target entitlement model is introduced by DA5.

The exact route is `POST /v1/mobile/work-targets/query` with closed request
`{ expectedMembershipId, limit, cursor }`; `limit` is 1–50 and `cursor` is null or an opaque
versioned value of at most 256 ASCII characters. Results are deterministically ordered by target
type, display name under the database's fixed `C` collation and target ID and distinguish loaded
from complete state.

### DA5-T05 — Manual interaction semantics

The Mobile **Manuell erfassen** action opens a searchable/selectable target list grouped as
Customers, Projects and General Work. Selecting a target shows the selected target and one
confirmation action named **Arbeitszeit auslösen**. The user does not choose Start or Stop.

Submitting creates exactly one manual WorkEvent command. Repeated taps are single-flight and use the
same idempotency and duplicate protections as NFC. The UI presents pending, rejected, started and
stopped truth using server acknowledgements; local pending evidence is never shown as confirmed
working time.

The online route is:

```text
POST /v1/lifecycle-events/manual
```

Its exact closed JSON request is:

```text
expectedMembershipId,
workEvent { id, target { targetType, targetId } },
receipt { id, attemptNumber }
```

The client creates UUIDs for WorkEvent and Receipt. `attemptNumber` is exactly `1`; every retry
resends the entire byte-identical command, including the same IDs and attempt number. Online manual
`occurredAt` is absent from the request and is the database transaction timestamp captured by the
server on the first accepted insert. An exact retry loads and reuses that immutable stored
timestamp; it never substitutes the retry time. Organization, User, role, trigger provenance,
Start/Stop meaning, event time and TimeEntry identity are absent and server-derived.

The response uses the existing synchronized/deferred/pending/conflict/authority-rejected envelope
and existing canonical decision discriminators. For a validated target, one transaction and the exact
per-User lifecycle lock atomically persist immutable WorkEvent, Decision, applicable TimeEntry
mutation, Receipt and AuditEvent. A pre-validation invalid or unauthorized target creates none of
those records.

### DA5-T06 — Immutable trigger provenance

`WorkEvent` SHALL carry a closed trigger union:

```text
nfc    -> assignmentId, nfcTagId
manual -> no NFC or Assignment identity
```

NFC fields are required for `nfc` and forbidden for `manual`. Manual provenance is immutable and
stored with the WorkEvent. A TimeEntry's effective projection SHALL expose `startedVia` and, after
stop, `stoppedVia`, each `nfc | manual`, derived from its exact start/stop WorkEvents.

This permits truthful mixed lifecycles, for example manual Start followed by NFC Stop. The Business
Engine outcome depends on User and target state, not trigger provenance. Corrections and recovered
records never rewrite provenance; a recovered record has its existing distinct recovery source.

The existing canonical WorkEvent content-hash v1 remains byte-for-byte unchanged for existing and
new Customer/NFC evidence. Additive content-hash v2 is mandatory for manual or non-Customer
evidence and hashes one UTF-8 JSON array in this exact order:

```text
id, organizationId, targetType, targetId, triggeredBy, occurredAtUtcMilliseconds,
triggerType, assignmentIdOrNull, nfcTagIdOrNull
```

`occurredAtUtcMilliseconds` is the canonical millisecond RFC-3339 `...Z` timestamp. For online
manual insertion it is the first database transaction timestamp; exact retries load the existing
row before hash comparison and reuse that stored value. The server derives `triggerType`. Database
checks enforce the exact legal union: `nfc` requires Assignment and Tag; `manual` requires both to
be null. The content-hash version is immutable and idempotent retries must match its exact bytes.

The existing canonical and persisted discriminator `duplicate_scan_ignored` remains byte-for-byte
unchanged for compatibility, including on the new manual route. Its semantics are generalized to
the same five-second per-User/WorkTarget window across trigger sources, so NFC then manual or
manual then NFC can be a duplicate. Manual UI copy says **Doppelter Auslöser ignoriert** and does
not expose the historical internal name. No Decision row is renamed or migrated.

Every authority- and target-validated trigger persists immutable WorkEvent/Decision/Receipt/Audit
evidence even when duplicate or another-target rejection produces no TimeEntry mutation.

### DA5-T07 — Existing NFC assignment authority

DA5 preserves the accepted Organization-scoped NFC model: a current authenticated Employee or
Administrator may submit a supported Tag only when it resolves to an exact active Assignment and
active target in that same current Organization. DA5 does not invent per-User Tag ownership.

No normal WorkEvent is created for signed-out, stale, revoked, cross-Organization, unknown,
inactive or unassigned evidence. Rejections disclose no raw UID or foreign assignment detail.

### DA5-T08 — Android Tag Dispatch boundary

ADR-0009 remains unchanged: the UID is the only v1 technical Tag locator and DA5 does not read,
write or require NDEF. Android SHALL register the narrowest practical manifest Tag Dispatch filter
for the supported v1 Tag technology. A repository-owned Expo configuration plugin may add only the
required NFC permission, `ACTION_TECH_DISCOVERED` ingress-Activity filter and reviewed technology
metadata. Generic `ACTION_TAG_DISCOVERED`, NDEF identity/routing, URI or broad deep-link behavior is
excluded.

The operating system may launch the Activity for a technically matching unrelated Tag. This is not
a TapTim.e authorization decision. The application must consume the launch Tag exactly once, pass
it into the protected NFC coordinator and reject it before WorkEvent creation when TapTim.e
authority or assignment validation fails.

Technology dispatch cannot filter by UID and another matching NDEF handler or Activity chooser may
take precedence. Therefore DA5 claims this behavior only for an exact Human-qualified device/Tag
matrix; it does not claim universal or exclusive Android launch routing.

Android support is bounded to:

- screen unlocked and NFC enabled;
- TapTim.e installed and not Android-force-stopped or disabled; and
- a supported Tag technology selected by the manifest filter.

Locked-screen execution, force-stop bypass, background services, wake locks, iOS background NFC and
claims covering every Android vendor/version are excluded.

### DA5-T09 — Cold/warm intent consumption and exclusive ownership

A minimal NFC ingress Activity and narrow native bridge SHALL take UID bytes plus native wall-clock
and monotonic capture time atomically into one process-memory slot, remove NFC extras before opening
the main Activity, expose one consume-once event and immediately clear the native reference. The
slot is `pending -> claimed -> consumed/cleared`, first-event-wins, bounded and never persisted.
Process loss before consumption means no WorkEvent and requires a new scan.

The bridge SHALL:

- deduplicate cold launch, warm intent and foreground-reader delivery;
- enter the existing exclusive NFC capture arbiter before normalization or submission;
- never run concurrently with explicit lifecycle scan or Administrator setup capture;
- cancel on sign-out, session replacement, Membership mismatch or runtime-generation change; and
- keep canonical NFC payload lifetime inside the protected coordinator/transport boundary.

Raw UID, launch intent and native Tag objects must not enter navigation state, persistent UI state,
logs, analytics, URLs, clipboard, evidence or disclosure output.

### DA5-T10 — Session restoration and automatic submission

When launched by NFC, Mobile first restores the existing private authentication state and resolves
current Membership. A WorkEvent command may be submitted only after the exact current session or
an exact still-valid offline-capture authority has been established.

If no session can be restored, the app may show the normal sign-in surface and a safe explanation,
but it SHALL discard the captured Tag and SHALL NOT replay it after later sign-in. The user must
scan again. An intent received during or after sign-out is likewise discarded.

### DA5-T11 — Offline-first parity

Both new trigger paths remain subject to ADR-0004 and the accepted complete platform in ADR-0012:

- NFC background capture may use only the existing encrypted FIFO and exact current
  Membership/Organization/assignment lease rules;
- manual target selection may be used offline only from a versioned, encrypted, exact-owner lease
  issued by the server for active targets;
- every command is durably stored before attempted transmission;
- offline evidence never receives a local Start/Stop decision;
- protected, stale, mismatched or revoked evidence remains fail-closed; and
- server reconciliation revalidates current Membership, Organization and target authority before
  Business Engine evaluation.

The additive contract fixes:

- lease schema version `2` and manifest canonicalization version `2`;
- a discriminated lease-item union `nfc_assignment | manual_target`;
- offline provenance version `2`; and
- Mobile SQLite schema version `3`.

The v1 lease routes and exact seven-field manifest remain unchanged. Additive v2 routes are:

```text
POST /v2/offline-capture-leases
POST /v2/offline-capture-leases/page
```

Their request bodies remain respectively the exact existing issue and page commands. A v2 page has
only these header fields plus `items` and `nextCursor`:

```text
leaseSchemaVersion=2, manifestVersion=2, leaseId, installationId, identityBindingId,
userId, organizationId, membershipId, membershipRowVersion, role, issuedAt, expiresAt,
configurationRevision, itemCount, serializedBytes, manifestDigest
```

Its closed item union is:

```text
nfc_assignment {
  itemType, itemId, lookup, assignmentId, nfcTagId, targetType=customer, targetId,
  displayName, assignmentRowVersion, targetRowVersion
}
manual_target {
  itemType, itemId, targetType=customer|project|general_work, targetId,
  displayName, targetRowVersion
}
```

Row versions are positive safe integers. `manual_target` forbids lookup, Assignment, Tag and fake
HMAC fields. The manifest orders items by ASCII item-ID bytes and frames every UTF-8 field with the
existing unsigned four-byte big-endian byte-length prefix. Manifest-v2 fields are:

```text
nfc_assignment:
  itemType, itemId, lookup, assignmentId, nfcTagId, targetType, targetId, displayName,
  assignmentRowVersionDecimal, targetRowVersionDecimal
manual_target:
  itemType, itemId, targetType, targetId, displayName, targetRowVersionDecimal
```

Page boundaries and header fields are not hashed. The digest is lowercase SHA-256 over the complete
ordered framed item stream. Duplicate item IDs, NFC lookups or `(targetType,targetId)` manual items
make activation unavailable.

The additive route `POST /v2/lifecycle-events/offline` accepts only provenance version `2` and this
exact command shape:

```text
organizationId, expectedMembershipId, leaseId, leaseItemId, installationBinding,
deviceSequence, provenanceVersion=2,
clock {
  bootMarker, monotonicAnchorMilliseconds, monotonicDeltaMilliseconds,
  wallClockAnchor, clockProofStatus, clockProofVersion=1
},
workEvent {
  id, target { targetType, targetId }, occurredAt,
  trigger =
    { type=nfc, assignmentId, nfcTagId }
    | { type=manual }
},
receipt { id, attemptNumber=1 }
```

The trigger union must exactly match the referenced lease-item discriminant and target. Manual
`occurredAt` is captured at button confirmation through the same native wall/monotonic clock proof
as NFC and cannot be edited. The server applies ADR-0012's accepted time, historical-authority and
review rules; no client timestamp alone is authoritative.

Existing v1 pages, provenance-v1 queue commands and SQLite-v2 rows remain byte-for-byte
readable/reconcilable and continue through the unchanged v1 routes. SQLite-v3 migration adds
discriminator/version columns without rewriting stored command bytes. The scheduler chooses the
route only from the immutable provenance version. One owner-bound FIFO, device sequence and
scheduler serve both sources.

Existing limits remain: 100 items per page, 4,096 activated items, 4 MiB activated lease, 12-hour
lease, accepted clock-proof/tolerance/review windows, queue count/byte ceilings and fail-closed
predecessor handling. No existing protected record may be deleted, rebound or silently upgraded.

### DA5-T12 — Persistence and tenant isolation

The schema SHALL add first-class Projects, generalized target references and trigger provenance
without weakening existing append-only evidence or RLS.

All write/read functions use server-derived current User, Organization and role, exact expected
Membership comparison, `NOLOGIN`/`NOINHERIT`/`NOBYPASSRLS` runtime roles, forced RLS, narrowly owned
`SECURITY DEFINER` functions and isolated validated pools. Check constraints enforce target and
trigger unions. Foreign-tenant target identifiers, stale Memberships and illegal field
combinations fail closed.

Migration and backfill are deterministic: existing Customer/NFC WorkEvents and TimeEntries retain
their identifiers and become `customer`/`nfc` provenance without rewriting business timestamps or
audit history.

### DA5-T13 — Read surfaces and export truth

Mobile own-time and Administrator time/review v2 projections SHALL identify the generalized target
by safe `targetType` and `targetDisplayName` and expose closed record/provenance values:

- canonical started: `source=canonical`, `startedVia=nfc|manual`, `stoppedVia=null`;
- canonical stopped: `source=canonical`, both trigger fields `nfc|manual`;
- recovered stopped: `source=recovered`, `startedVia=null`, `stoppedVia=null`.

Existing privileged correction/review omissions remain unchanged.

Existing DA2 CSV v1 serialization remains byte-compatible. Because its accepted fixed schema cannot
truthfully represent Project or General Work, a v1 request whose complete interval contains either
fails with `export_schema_incompatible`, HTTP 409, zero CSV bytes and no success audit; it never
omits or mislabels a row. This is a proposed Human product amendment to DA2-P02 and requires the
explicit acceptance recorded in Section 4 before implementation.

The additive opt-in route:

```text
POST /v2/time-entries/export
```

uses the unchanged three-field request and emits every effective TimeRecord in the interval with
this exact fixed column order:

```text
schema_version, organization_id, organization_name, time_entry_id,
employee_membership_id, employee_display_name, record_source, target_type, target_id,
target_display_name, status, started_via, stopped_via, started_at_utc, stopped_at_utc,
duration_seconds
```

`record_source` is `canonical | recovered`. For canonical records, `started_via` is
`nfc | manual`; `stopped_via` is empty while started and `nfc | manual` once stopped. For recovered
records, both provenance cells are empty because no trigger created them. Correction revisions
retain the record's source and trigger provenance.

Formula-safety, deterministic ordering, UTC, snapshot, row/byte limits, content hash, tenant
authority and success-audit requirements remain unchanged. The v2 success AuditEvent identifies
export schema version `2`; rejection appends no success audit. Existing Customer-shaped Admin
time/review v1 routes remain unchanged. Additive v2 projections expose generalized target and
provenance fields; DA5 Admin Web adopts those v2 reads.

No caller-selected arbitrary columns or silent v1 behavior change is allowed.

### DA5-T14 — Audit and observability

Successful Project creation/deactivation and accepted manual WorkEvents produce the existing
append-only receipt/audit style with current actor attribution. Rejected or duplicate actions
follow the existing safe result vocabulary and logging policy. Observability may include trigger
type, target type and safe aggregate result, but never raw NFC, credentials or foreign identifiers.

### DA5-T15 — Verification and Human gate

Implementation is R3 and requires AVS V0–V4, including:

- pure Business Engine parity across all targets and both trigger sources;
- direct PostgreSQL role/RLS/function-owner/constraint/migration/backfill tests;
- cross-user/cross-tenant/revoked/inactive/stale/hostile-shape negative matrices;
- v1 queue/evidence compatibility plus manual/background offline ordering, restart and dedupe;
- cold-launch, warm-intent, foreground/setup exclusivity and sign-out/session-race tests;
- Customer/Project/General projection and Admin Project tests;
- own-time/Admin/CSV v1 rejection/CSV v2 formula-safety and snapshot tests;
- complete affected tests-inclusive typechecks/builds and one full local regression;
- exact-head CI and independent exact-SHA review with zero open P0–P3.

A fresh exact-artifact Android Human V5 is mandatory and separately authorized. It must cover
screen-unlocked cold launch, background/resume, unrelated/unassigned and signed-out rejection,
same-Tag dedupe, manual Customer/Project/General online and controlled offline paths, mixed
provenance, accessibility, process restart, setup-capture exclusion and cleanup.

## 3. Explicit exclusions

DA5 adds no:

- manual selection of Start versus Stop, editable TimeEntry or unreviewed correction;
- per-User Tag/target entitlement, Team Lead, approval, payroll, billing, task or schedule model;
- Project-customer relation, Project deletion or NFC assignment to Project;
- location/machine/vehicle/workflow target;
- background service, locked-screen or force-stop bypass;
- iOS/Web NFC, universal-device support or fraud/physical-presence attestation claim;
- production resource/data, deployment, distribution, signing, pilot or legal/privacy approval; or
- access to `research/`.

## 4. Human product acceptance

On 2026-07-24 the Human Architect expressly accepted the following exact v1 values as one product
amendment and authorized the bounded local DA5 implementation on baseline
`fb32a2796e78c78ce12f856c908545de7ce7bf99`, tree
`53d6b5d6c2c86a8a3245539d821a12fae6850673`:

1. Projects are standalone Organization targets without Customer relation; Administrators may
   create/list/deactivate them, names are immutable, and deactivation is rejected while work is
   active on that Project.
2. Current Employees and Administrators may use manual Customer/Project/General Work triggers.
3. Every Organization has exactly one immutable, always-active `general_work` target labelled
   `Allgemeine Arbeitszeit`.
4. Online manual event time is the first server database transaction timestamp; callers cannot
   supply or edit it, and exact retries retain it.
5. Manual capture is offline-first; offline button-confirmation time uses ADR-0012's exact native
   clock proof, lease, FIFO, review and reconciliation boundaries.
6. NFC and manual triggers may start or stop the same target and share the five-second
   cross-trigger duplicate window; the user never selects Start or Stop.
7. V1 background launch remains UID-only `ACTION_TECH_DISCOVERED`, screen-unlocked and
   best-effort for the exact qualified Android/Tag matrix; tags are not rewritten with NDEF.
8. Existing Organization-scoped Tag Assignment remains authoritative; no per-User Tag entitlement
   is introduced.
9. CSV v1 remains byte-compatible but fails the complete request with
   `export_schema_incompatible` when its interval contains non-Customer targets; additive CSV v2
   is the complete generalized export defined above.

These accepted values remain binding. No later implementation or review may reinterpret them.

## 5. Current authority

The Human Architect explicitly accepted the complete ADR-0016/ADR-0017 values and authorized the
bounded DA5 sequence through local AVS V0–V3, Technical-Lead acceptance, focused publication,
exact-head V4 and independent exact-SHA implementation review on the baseline above. The
Development Agent itself was delegated no commit, push, publication, V4 or review action.
Human/hardware V5, production, production data, deployment and distribution remain separately
unauthorized.

The Development-Agent local implementation delta and its V0–V3 pre-publication evidence are
recorded in
`ADO/05_Evidence/Development_Assignment_05_Local_Implementation_Evidence.md`. Exact-head V4 and an
independent exact-SHA implementation review with zero open P0–P3 remain mandatory before any
separately authorized Human/hardware V5.
