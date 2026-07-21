# ADR-0013: Tenant-Safe Setup Integration and Time-Entry Export Boundary

- Status: **PROPOSED — INDEPENDENT RE-REVIEW `APPROVED FOR CANDIDATE PUBLICATION`; DA2-REV-01 CLOSED; ZERO OPEN P0–P3; HUMAN ACCEPTANCE/IMPLEMENTATION AUTHORITY PENDING**
- Date: 2026-07-21
- Owner: Technical Lead
- Approval Authority: Human Architect
- Candidate Baseline Commit: `e5978702eca7adb3de3fd85db37921b4a441ca59`
- Candidate Baseline Tree: `98ae795bbf4e1d3eb44e12db62024272e861a279`
- Initial Independent Review Verdict: `CHANGES REQUIRED` — DA2-REV-01 (P2), no P0/P1/P3
- Final Independent Re-review Verdict: `APPROVED FOR CANDIDATE PUBLICATION` — DA2-REV-01 closed; zero open P0/P1/P2/P3
- Finding State: DA2-REV-01 multiple-history/re-grant premise withdrawn by the independent reviewer; explicit join/fail-closed clarity correction in DA2-P07 independently approved
- Related: ADR-0003, ADR-0008, ADR-0011, ADR-0012, FB-002 v1.2, TS-002 v1.3, AVS-001
- Assignment: Development Assignment 2 — Setup and Export Backend

## 1. Decision status and authority boundary

This document is an architecture proposal. It records the Technical Lead's recommended boundary for
Development Assignment 2, but none of its product-policy proposals is accepted merely because this
file exists.

The first independent pre-implementation review reported exactly one P2 contract gap,
DA2-REV-01, claiming that multiple revoked/re-granted Membership rows could exist for one
`(organization_id, user_id)` and make the exported Membership ID/name ambiguous. The Technical Lead
rejects that premise because migration `001` permanently enforces
`memberships_organization_user_unique`, migrations `002`–`010` do not remove it, and the accepted
C3E1 contract explicitly rejects re-onboarding or Organization transfer for any User with any
historical Membership. The existing DA2-P06/P07 join is therefore zero-or-one by schema and one for
canonical lifecycle-created TimeEntries. The reviewer is nevertheless correct that the mapping and
missing-row behavior should be explicit. DA2-P07 now freezes the exact same-Organization/User join,
stable retained Membership and fail-closed integrity behavior without inventing re-grant history or
a new product policy. The Technical-Lead disposition was not itself independent approval; the
renewed independent review confirmed it, explicitly withdrew the original multiple-history
premise, closed DA2-REV-01 and returned `APPROVED FOR CANDIDATE PUBLICATION` with zero open P0–P3.

The independent pre-implementation review gate is satisfied. Before implementation may begin, all
of the following remaining gates are mandatory:

1. focused publication of the approved candidate with green exact-head CI;
2. explicit Human Architect acceptance of the product decisions in Section 4; and
3. a separate Human Architect implementation authorization bound to an exact commit and tree.

This proposal authorizes no dependency, migration, source, test, workflow, build, physical,
deployment, production or production-data change.

## 2. Context

### 2.1 Setup truth that must be preserved

The remaining Roadmap-v2 labels DT-063–DT-066 do not describe an empty implementation area.
Repository truth already contains independently closed local/synthetic boundaries:

- C3B: private named-operator first Organization/Administrator bootstrap;
- C3C: current-Administrator Customer creation, atomic NFC Tag registration/first Assignment and a
  bounded safe setup projection;
- C3D: Admin Web Customer setup plus protected Android NFC capture/provisioning;
- C3E1: identity-first Employee invitation/redemption and safe Employee projection;
- C3E2: explicit, history-preserving NFC Tag reassignment; and
- DA1: complete offline/synchronization behavior for its authorized local Android/repository/
  synthetic-server scope.

Development Assignment 2 must extend and integrate those boundaries. It must not replace them with
generic CRUD, duplicate setup services, a broader Administrator database role or a second source of
identity, Membership, tenant or NFC authority.

DT-063–DT-066 remain Roadmap candidate labels rather than formal EP-007 Development Tasks. They may
be dispositioned only by a later DA2 closure that states the exact local/backend/integration scope
proved. Such a disposition is not a production-, pilot-, UI-productization- or deployment claim.

### 2.2 Export truth

ADR-0003 includes basic export/reporting in v1 and the Product Readiness Roadmap requires CSV time
records before a pilot. The repository currently has:

- canonical tenant-owned `time_entries` with started/stopped state and WorkEvent traceability;
- immutable Customer and Employee Membership display names for the current setup model;
- current server-derived User/Organization/Membership authority;
- fixed least-privilege setup, lifecycle and offline capabilities; and
- no time-entry export contract, export-specific database role, API route, CSV serializer, export
  audit event, result limit or export test matrix.

The existing B5 tenant read model is intentionally limited to five point reads. The existing C3C
setup role is intentionally unable to read TimeEntries. Neither may be widened into export
authority.

### 2.3 Product decisions are missing

The repository does not currently decide the exact export actor, row set, open-entry behavior,
timestamp/filter semantics, CSV dialect, size limits, audit evidence or formula-injection handling.
Those are product and security boundaries, not implementation details. Section 4 proposes explicit
values for independent review and Human Architect acceptance; they must not be silently inferred.

## 3. Proposed decision

Development Assignment 2 shall have two deliberately different workstreams:

1. **Setup integration:** preserve C3B/C3C/C3D/C3E1/C3E2 and prove one data-free synthetic
   bootstrap-to-export chain without adding a second setup implementation; and
2. **Time-entry export:** add one Administrator-only, tenant-safe, bounded and audited backend CSV
   capability behind its own least-privilege database role and runtime pool.

The export is a fixed product capability, not a public API, reporting engine, generic query surface
or file-storage system. The backend produces the CSV bytes. Later Admin Web productization may
offer a download action without reimplementing CSV or authority rules.

## 4. Human decision candidates

The following proposals are **not accepted yet**. Each requires an explicit Human Architect
disposition after independent review.

| ID | Proposed v1 product decision |
|---|---|
| DA2-P01 | Only a current server-derived `administrator` Membership may export. Employees cannot export; System Owner and Team Lead are not implemented roles and gain no implied authority. |
| DA2-P02 | Export includes every current-Organization TimeEntry whose `started_at` is in the requested half-open interval, including both `started` and `stopped` entries. |
| DA2-P03 | A started entry is represented truthfully with `status=started` and empty `stopped_at_utc`/`duration_seconds`; it is never omitted, estimated or auto-closed. |
| DA2-P04 | Filtering and serialized timestamps use UTC only. Input is canonical millisecond RFC-3339 `...Z`; range semantics are `fromInclusive <= started_at < toExclusive`. UI-local time zones are deferred to later productization. |
| DA2-P05 | A stopped duration is the exact database timestamp difference in decimal seconds, with up to six fractional digits and no payroll, billing, legal or commercial rounding. |
| DA2-P06 | The exact column order is `schema_version`, `organization_id`, `organization_name`, `time_entry_id`, `employee_membership_id`, `employee_display_name`, `customer_id`, `customer_display_name`, `status`, `started_at_utc`, `stopped_at_utc`, `duration_seconds`. No raw NFC payload, Tag/Assignment/WorkEvent/IdentityBinding/provider identifier, token, email, audit payload or credential is exported. |
| DA2-P07 | Each TimeEntry maps by its exact `(organization_id, user_id)` to the sole retained Membership guaranteed by `memberships_organization_user_unique`; revocation updates that same row and never changes its stable ID. A `NULL` Membership display name produces an empty `employee_display_name`. A missing Membership is an internal integrity failure: the complete export fails with disclosure-safe `service_unavailable`, no CSV bytes and no success audit. The backend does not invent a name, expose provider identity, select a Membership from another Organization or introduce re-grant/current/latest fallback semantics. |
| DA2-P08 | One request spans at most 31 consecutive days, returns at most 10,000 rows and at most 8 MiB including header/BOM. A larger result fails closed with `export_limit_exceeded`; the caller must narrow the interval. |
| DA2-P09 | CSV v1 is UTF-8 with BOM, semicolon-delimited, CRLF-terminated and RFC-4180 quoted. Text cells whose first non-whitespace character is `=`, `+`, `-` or `@` are prefixed with one apostrophe to prevent spreadsheet formula execution. |
| DA2-P10 | Rows are ordered by `started_at`, then `time_entry_id`; an empty result returns one valid header-only CSV. |
| DA2-P11 | A successful generation appends exactly one `TimeEntryExportGenerated` audit event containing actor, Organization, correlation ID, UTC interval, row count, byte count and SHA-256 of the exact CSV, but no exported row values or names. Rejected/rolled-back requests append no success audit. |
| DA2-P12 | The backend retains no generated CSV artifact. The response is `no-store`, uses a fixed sanitized filename derived only from the UTC range and is produced only after the database transaction and audit succeed. |

Changing any accepted value later is an architecture/product review trigger, not an implementation
convenience.

## 5. Proposed component boundary

### 5.1 Neutral export contract

A new `@taptime/time-entry-export-contract` package owns only:

- schema version `1`;
- exact input/row/result types;
- canonical UTC, range and limit validation;
- deterministic CSV cell escaping, formula neutralization and byte serialization; and
- golden vectors shared by backend and later clients.

It owns no token verification, database access, React code, business decision or file persistence.

### 5.2 Migration `011`

One versioned migration proposes:

- `taptime_time_exporter NOLOGIN NOINHERIT NOBYPASSRLS`;
- isolated function-owner capability only where required for fail-closed audit insertion;
- column-level reads of Organization, Membership, Customer and TimeEntry data required by the exact
  Section-4 projection;
- forced-RLS policies bound to current transaction-local actor/Organization/Membership context;
- no NFC Tag, Assignment, raw payload, WorkEvent body, CanonicalDecision body, IdentityBinding,
  invitation, receipt, credential, delete, update, DDL or generic SQL authority; and
- an explicit audit allowlist entry for `TimeEntryExportGenerated`.
- explicit preservation and verification of `memberships_organization_user_unique`; migration `011`
  adds no Membership re-grant/history model.

Migrations `001`–`010` remain byte-identical. Migration execution remains out-of-band and never
runs at application startup.

### 5.3 Export coordinator

A new isolated `@taptime/backend-time-export` workspace owns one coordinator and no generic
repository. It:

1. verifies the Supabase access token as identity only;
2. begins one bounded PostgreSQL `REPEATABLE READ` transaction;
3. assumes `taptime_identity_resolver` only to lock and resolve the current actor;
4. requires the exact body Membership and current Administrator role;
5. sets only derived transaction-local context;
6. assumes only `taptime_time_exporter`;
7. maps TimeEntry `(organization_id, user_id)` to the sole retained Membership under DA2-P07, then
   reads and serializes the exact bounded Section-4 projection;
8. rejects before audit if row/byte/range limits are exceeded;
9. computes the exact CSV SHA-256 and appends the success audit through the fixed capability;
10. commits; and
11. returns the already bounded bytes.

No response byte is sent before commit. Revocation, role change, timeout, serialization failure,
audit failure or client cancellation before commit rolls back the operation.

### 5.4 Backend API

One authenticated route is proposed:

```text
POST /v1/administration/time-entries/export
Content-Type: application/json
Authorization: Bearer <Supabase access token>

{
  "expectedMembershipId": "<canonical lowercase UUID>",
  "fromInclusive": "<canonical millisecond UTC timestamp>",
  "toExclusive": "<canonical millisecond UTC timestamp>"
}
```

No Organization, User, role, employee, Customer, SQL, sort or column selector is accepted.

Success is HTTP 200 with exact `text/csv; charset=utf-8`, `Content-Disposition: attachment`,
`Cache-Control: no-store`, `Pragma: no-cache` and `X-Content-Type-Options: nosniff`.

Fixed failures are:

| Result | HTTP |
|---|---:|
| `invalid_request` | 400 |
| `unauthorized` | 401 |
| `forbidden` | 403 |
| `export_limit_exceeded` | 422 |
| `service_unavailable` | 503 |

Errors remain small exact JSON responses and never include CSV fragments, tokens, identifiers from
another tenant, raw provider/database errors or requested data.

### 5.5 Runtime isolation

The managed Node runtime receives one additional, distinctly named export database URL and pool.
Its username must differ from every existing session/read/lifecycle/administration/enrollment/
reassignment/offline username. URL-parameter, TLS and timeout validation remains at least as strict
as the current backend runtime. No existing pool receives the export role.

## 6. Setup integration contract

DA2 setup work is verification and composition, not feature reinvention. The supported synthetic
integration chain is:

```text
private C3B Organization/Administrator bootstrap
  -> current Administrator session
  -> C3C Customer creation
  -> C3E1 Employee invitation/redemption
  -> C3C Android Tag provision/first Assignment
  -> C3E2 optional explicit reassignment with immutable history
  -> online or DA1-offline server-canonical Start/Stop
  -> Administrator time-entry CSV export
```

The chain must prove tenant isolation, current authority, exact setup projection, historical
Customer attribution after reassignment, export correctness and complete disposable cleanup. It
uses synthetic identities and data only.

DA2 adds no Organization self-signup, Customer/Tag update/delete, Membership revocation/demotion,
role editor, browser NFC, raw UID entry, second setup coordinator or generic administration API.

## 7. Security and privacy invariants

1. Auth is identity only; every export derives and locks current Membership authority server-side.
2. The body Membership is compare-only and cannot grant or select authority.
3. Tenant scope comes only from the resolved Membership; no export query accepts a tenant selector.
4. Export authority is isolated from setup, lifecycle, offline and broad Administrator roles.
5. RLS and composite tenant joins remain defence in depth; direct-role negative tests are mandatory.
6. CSV injection mitigation applies after canonical product-name validation and before byte hashing.
7. Logs and diagnostics contain only a generated correlation ID and fixed code.
8. The response and audit contain no raw NFC, provider identity, credential or foreign-tenant data.
9. No generated file is stored server-side, in repository evidence or in normal diagnostics.
10. Production personal data remains prohibited until later legal/privacy, deployment and
    production-operation gates are separately accepted.
11. An export is not payroll, invoice, legal retention, approval or correction evidence.
12. DA3 correction/audit must explicitly review how corrected records appear without rewriting
    this export boundary silently.

## 8. Failure, race and truth rules

- Authority is locked before TimeEntry visibility.
- A Membership revocation/role change that wins the actor lock rejects the export.
- A lifecycle Stop committed before the repeatable-read snapshot is visible as stopped; a later Stop
  is not partially observed and the row remains started in that export.
- Customer and Membership display values are read from the same snapshot as TimeEntries.
- A revoked Membership retains its stable ID/name source for historical TimeEntries. A missing
  Membership is an integrity failure that rolls back with disclosure-safe `service_unavailable`, no
  CSV bytes and no success audit; no cross-Organization/current/latest fallback is permitted.
- Cross-tenant UUID collisions or guesses never affect or disclose results.
- Row/byte limits are enforced before audit/commit and never return a truncated CSV as success.
- An audit failure makes the entire export fail; a CSV response is never claimed without its exact
  content hash evidence.
- A client disconnect after commit may leave an audit of generated bytes that were not received.
  The audit event therefore means "generated", not "downloaded" or "opened".
- A later correction creates a new export snapshot; previous hashes remain truthful for the bytes
  generated at that time.

## 9. Verification consequences

The proposed implementation is AVS-001 risk class R3 because it changes migration/RLS/role
authority and handles personal time data. Minimum gates are:

- complete contract golden vectors including Unicode, quotes, delimiters, CRLF, formula prefixes,
  empty values and byte-limit edges;
- PostgreSQL-17 migration/ledger/immutability, ACL, RLS, role graph, PUBLIC and direct-query negative
  tests;
- current Administrator/Employee/revoked/stale/forged/cross-tenant authority matrices;
- direct PostgreSQL proof that `memberships_organization_user_unique` remains effective, every
  canonical TimeEntry joins to exactly one same-Organization/User Membership, a revoked Membership
  retains its stable attribution and a deliberately corrupted missing-Membership fixture fails the
  complete export without bytes/audit;
- started/stopped, empty, ordering, boundary timestamp, 31-day, 10,000-row and 8-MiB matrices;
- repeatable-read lifecycle race, timeout, cancellation, pool-reuse and audit rollback tests;
- exact HTTP method/path/header/body/content-type/UUID/timestamp/result/header/error tests;
- disclosure and spreadsheet-injection source/behavior guards;
- fresh synthetic setup-to-export integration including reassignment attribution and DA1-produced
  TimeEntries;
- complete candidate regression, tests-inclusive TypeScript checks, builds and Android export;
- exact-head GitHub Actions with an isolated Node-24/PostgreSQL-17 DA2 job;
- Technical-Lead diff/claim/security audit; and
- independent pre-implementation and implementation reviews with every P0–P3 finding dispositioned
  before closure.

Because DA2 changes no NFC/native/user-interface behavior, this proposal does not require a new
physical-device gate. Any Human functional validation must be separately authorized, data-free and
cannot substitute for the R3 automated/database/security matrix.

## 10. Consequences

### Positive

- Existing setup/security work is preserved rather than duplicated.
- Basic v1 export becomes exact, tenant-safe, bounded, auditable and reusable by later Admin Web.
- CSV bytes have deterministic contract evidence and formula-injection protection.
- Production, corrections and UI productization remain cleanly separated.

### Negative

- One more isolated runtime pool/role/workspace increases operational configuration.
- The 31-day/10,000-row/8-MiB limits require users to split larger exports.
- UTC-only backend output is less friendly until later Admin Web productization.
- Historical Memberships without names remain visibly incomplete rather than receiving invented
  identity data.

## 11. Explicit non-goals

- implementation under this candidate-preparation task;
- production Supabase/PostgreSQL/Node resources or real personal data;
- Admin Web download UI, Mobile export, visual design or productization;
- employee self-export, Team Lead/System Owner roles or permission management;
- correction, approval, payroll, billing, rounding or legal retention policy;
- generic reporting, filtering, analytics, public API or scheduled/email exports;
- server-side CSV artifact storage, object storage or download links;
- Organization self-service signup/status/rename;
- setup CRUD beyond the already accepted C3 boundaries;
- deployment, observability, backup/recovery, distribution or support process; and
- any access to `research/`.

## 12. Review triggers

Review ADR-0013 before changing actor roles, exported columns, timestamp/range semantics, duration,
CSV dialect, formula mitigation, limits, audit meaning, persistence, public availability,
correction representation, production processing or any setup authority boundary.
