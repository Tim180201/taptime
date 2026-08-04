# ADR-0020: Optional Locations and Delegated Administration

- Status: **INDEPENDENTLY APPROVED FOR ADO CANDIDATE PUBLICATION; R1 P1 CLOSED; ONLY P1
  ASSIGNMENT DECISION HUMAN-ACCEPTED; REMAINING ADR-0020/DA6 HUMAN DISPOSITION PENDING; NO
  IMPLEMENTATION AUTHORITY**
- Date: 2026-08-04
- R1 reviewed candidate diff SHA-256 including this new file:
  `475edf4654fc23bd33e1e0c8db1306f98a0ec2cc83bf4fe1a00587cd66e49e4f`
- Corrected seven-file candidate Full-Index-Diff SHA-256:
  `e30591baf23f00bf4cc56ed1bf8fa0f7c4c9c86dfc0c962bd5a36f490791a9de`
- Independent re-review:
  `ADO/05_Evidence/Development_Assignment_06_Optional_Locations_Independent_Architecture_Authorization_Review.md`
- Human P1 disposition date: 2026-08-04
- Candidate preparation baseline commit: `90a5d1a3c90ee81aaeee335edd74a88c8fc904de`
- Candidate preparation baseline tree: `38d025a134cffe305017a1c845930d80115c1d3d`
- Owner: Technical Lead
- Decision authority: Human Architect
- Related: ADR-0008, ADR-0018, DA6, AVS-001, R-037
- Candidate risk: AVS-001 **R0/V0** for this ADO-only preparation; any later implementation is
  **R3**

## 1. Context and repository truth

TapTim.e currently treats an Organization as the hard tenant boundary. The repository has exactly
one Membership per Organization/User through the unique `(organization_id, user_id)` boundary,
and current Product role values are `administrator` and `employee`. Administrator capabilities
are Organization-wide. Customers, Projects, WorkTargets, NFC Assignments, time records,
correction/review data and exports have no implemented Location authorization dimension.

The Human Architect first authorized preparation of an ADO-only candidate for generic, optional
Locations and delegated Location administration as part of DA6. Independent Review Round 1 then
returned `CHANGES REQUIRED` with exactly one P1 because the normative Location-assignment model
was missing. The Human Architect subsequently accepted exactly the mandatory Home Location and
the described additional Work and Management Location assignment model in Section 2. The
remaining ADR-0020/DA6 values are not thereby accepted. No Product code, tests, schema,
dependencies, workflows, provisioning, hardware or operational action is authorized.

This ADR proposes only a generic TapTim.e capability. Customer-specific Frogs rules for students,
groups, tariffs, cancellations, ERP integration or other customer workflows are not repository
truth and are not part of this candidate.

## 2. Human-accepted R1 P1 disposition

The binding Human decision is:

> Ich akzeptiere die verpflichtende Hauptstandortzuordnung und die beschriebenen zusätzlichen
> Arbeits- und Verwaltungsstandorte für ADR-0020.

This resolves the missing Product/architecture decision behind the R1 P1. The following values are
Human-accepted requirements for any later implementation of the optional feature:

1. While the feature is effectively off, no Location assignment is required and all current
   behavior remains exactly unchanged.
2. A current Organization Administrator may prepare an inactive setup. Effective activation is
   one atomic, fail-closed transition and is allowed only after every active Organization user and
   active Membership has exactly one active Home Location and every active resource, WorkTarget
   and NFC Assignment relevant to Location operation has one unambiguous active Location binding.
   Until then the feature remains effectively off. No automatic inference or migration is allowed.
3. Every active Membership, including every Administrator and Location Manager Membership, has
   exactly one Home Location while the feature is on. It is an organizational default and
   responsibility, not a restriction of Organization-wide Administrator authority.
4. A Membership may have zero or more explicit active Work Location Grants for additional active
   Locations besides Home. They authorize only Employee self-service/work execution, never a
   delegated-administration capability. While the feature is on, work is allowed only at Home or
   a currently granted additional Work Location.
5. A Location Manager Membership may separately have zero, one or more active Management Location
   Grants. Work and Management Grants are distinct purpose/capability boundaries and never imply
   or inherit one another.
6. Each accepted WorkEvent/TimeRecord receives one server-derived immutable accepted Work
   Location under `DA6-L06`; this is organizational responsibility/work context, not GPS,
   geolocation or physical-presence evidence.
7. New server decisions use current assignments and grants; accepted history is never rewritten.
   Manager access to historical records uses the current Management Grant for each record's
   immutable accepted Work Location.
8. Deactivation immediately removes every delegated or Location-scoped authority but retains
   assignments and history without deletion or rewrite. Reactivation repeats the complete atomic
   active-binding validation.

The corrected text below integrates these accepted requirements. Independent re-review of the
exact seven-file candidate returned `APPROVED` with zero open P0–P3 and closed the P1. R1 remains
historically `CHANGES REQUIRED`; the approval does not Human-accept any remaining candidate value
or grant implementation authority.

## 3. Candidate decision values and accepted P1 overlay

`DA6-L01`–`DA6-L11` remain the closed architecture candidate, with the exact assignment,
activation and accepted-Work-Location rules in Section 2 already Human-accepted as a mandatory
overlay. Every other value becomes controlling only if the Human Architect explicitly accepts or
adjusts it after ADO candidate publication.

### DA6-L01 — Organization-level opt-in, default off

Locations and delegated administration SHALL be one Organization-scoped feature, disabled by
default for every existing and future Organization. A current Organization Administrator (the
existing `administrator` authority) may prepare Locations, assignments and grants as an inactive
setup and is the only authority that may request effective activation or deactivation.

While effectively off:

- all existing Organizations, Memberships, role behavior, Product data, API behavior and UI
  behavior remain exactly unchanged;
- no Location assignment is required for current behavior and no Location Manager or
  Location-scoped authority exists;
- inactive setup data creates no Product visibility, work restriction or delegated capability;
- no row is automatically migrated, assigned, inferred or exposed through a Location scope; and
- an incomplete or failed activation request leaves the feature effectively off without partial
  enforcement.

Effective activation SHALL be one atomic server transaction. It revalidates that every active
Organization user and every active Membership has exactly one active Home Location, and that all
active Customers, Projects, resource-backed WorkTargets, other Location-relevant active
WorkTargets and NFC Assignments have one unambiguous active Location binding consistent with
their Organization and resource relationship. A missing, duplicate, inactive, contradictory or
cross-Organization binding rejects the whole transition. No deployment, configuration default or
migration may silently enable the feature.

Deactivation immediately revokes every delegated and Location-scoped capability for new server
decisions and restores current feature-off behavior. It does not delete assignments, grants,
accepted Work Locations or history. Reactivation repeats the complete current active-binding
validation atomically; retained setup is never assumed valid merely because it was valid before.

### DA6-L02 — Organization remains the tenant boundary

Organization remains the hard tenant and RLS boundary. A Location is a subordinate authorization
and data-scope dimension inside exactly one Organization; it is never a tenant replacement,
cross-Organization key or reason to weaken Organization predicates.

Every Location, grant, location-bound resource, accepted work record and audit event SHALL retain
an unambiguous Organization binding. Authorization SHALL prove Organization equality before
evaluating Location scope. A missing, stale, ambiguous or cross-Organization Location binding
fails closed.

### DA6-L03 — Membership identity, role and Location grants

The existing unique Membership per Organization/User remains conceptually unchanged. Duplicate
Memberships SHALL NOT be used to represent Location access.

While the feature is on, every active Membership has exactly one active Home Location, including
Organization Administrators and Location Managers. While it is effectively off, no Home Location
is required for current Product behavior. Home is an organizational default/responsibility and
does not narrow the Organization Administrator's Organization-wide authority.

Role, Home, Work scope and Management scope are separate:

- a Membership has one Product role;
- `Location Manager` is the candidate delegated role/profile and is not an Organization
  Administrator;
- a Membership may have zero or more explicit active Work Location Grants for additional active
  Locations besides its Home Location; these grant only Employee self-service/work execution;
- a Location Manager Membership may have zero, one or more separate explicit active Management
  Location Grants; these scope only the closed delegated capabilities in `DA6-L05`; and
- Home, Work Grants and Management Grants never imply, inherit, widen or substitute for one
  another.

The exact future schema representation of the candidate role and grants must preserve the single
Membership invariant and requires separate R3 implementation authority. No existing
`administrator` or `employee` Membership is automatically converted or assigned. A Location
Manager with no current Management Grant has no delegated-administration authority; a Management
Grant alone grants no right to execute Employee work at that Location.

### DA6-L04 — Organization Administrator ownership

The Organization Administrator remains Organization-wide and is the only role allowed to:

- prepare inactive setup and atomically enable or disable the feature;
- create, change, deactivate or otherwise manage Locations;
- assign/change Home and Resource Locations;
- grant, change or revoke Work and Management Location Grants; and
- resolve unbound or ambiguous legacy data before delegated access.

An Administrator's mandatory Home Location while the feature is on does not constrain that
Administrator's Organization-wide authority. There is no implicit Administrator inheritance from
Home, a Work Grant or a Management Grant and no Location Manager escalation path. Delegation may
not grant Organization administration, Location lifecycle or delegation administration.

### DA6-L05 — Closed v1 Location Manager capability matrix

Every Location Manager action requires a current Membership with the candidate delegated role,
an active explicit Management Location Grant for every affected Location and server-derived
capability evaluation. Home and Work Location Grants do not satisfy this requirement. The client,
route name, navigation visibility or submitted Location identifier is never authority.

| Resource or action | Read | Manage or execute | Closed v1 boundary |
|---|---:|---:|---|
| Employees / Employee Membership projections | Yes | No | Full Location projection follows current Home; Work-Grant-only relation permits only the minimum projection required for the concrete Location operation |
| Location-bound Customers | Yes | Yes | Current unique active Resource Location and current Management Grant required |
| Location-bound Projects | Yes | Yes | Current unique active Resource Location and current Management Grant required |
| Location-bound WorkTargets | Yes | Yes | Current unique active Resource Location and current Management Grant required |
| Location-bound NFC Assignments | Yes | Yes | Scope follows the bound WorkTarget/resource Location; no Organization-wide or Cross-Location reassignment |
| Effective work-time records | Yes | Correction only under the current explicit Management Grant | Scope uses immutable accepted Work Location; never correct the actor's own time |
| Review data | Yes | Review/adjudication only under the current explicit Management Grant | Scope uses immutable accepted Work Location; never review the actor's own time or own review item |
| Location-bound exports | Yes | Export only for an explicit currently Management-granted Location scope | Immutable record Location; no Organization-wide, implicit mixed-scope or partial export |

Location Managers SHALL NOT manage Organization settings, Administrator authority, Memberships,
invitations, Locations, grants/delegation, security, identity/Auth providers, operational/provider
configuration or billing. They have no Organization-wide export, Cross-Location mutation or
implicit access to unbound/ambiguous data.

The authoritative scope mapping is:

- current master/resource reads and mutations use the resource's current unique active Resource
  Location;
- the normal Employee projection uses the Employee's current Home Location; an Employee connected
  only by an additional Work Grant exposes only the fixed minimum projection required for the
  concrete Location operation, never implicit full Employee access;
- TimeRecord, correction, review and export scope uses only each record's immutable accepted Work
  Location; and
- a command affecting more than one Location requires a current Management Grant for every
  affected Location. One missing, revoked, inactive or ambiguous grant rejects the complete
  command or result.

Existing Employee self-service semantics remain unchanged as constrained by the accepted
Home-plus-Work target catalog in `DA6-L08`. The Location Manager profile does not remove, replace
or broaden those rights.

### DA6-L06 — Separate Location concepts and immutable history

The following concepts SHALL remain distinct:

1. a Membership's exactly one current Home Location for organizational default/responsibility;
2. explicit additional Work Location Grants for Employee self-service/work execution;
3. separate Management Location Grants for delegated administration;
4. the current responsible Resource Location for a Customer, Project, WorkTarget or NFC
   Assignment; and
5. the immutable accepted Work Location fixed on an accepted WorkEvent/TimeRecord.

For every accepted WorkEvent/TimeRecord the server SHALL determine exactly one accepted Work
Location before acceptance and persist it immutably:

- a Customer-, Project- or other resource-backed WorkTarget uses the exact current active Resource
  Location of its bound resource; the actor must have that Location as Home or hold a current Work
  Location Grant for it;
- an NFC Assignment uses/inherits the unique Location of its bound WorkTarget/resource; a client
  cannot submit or override a different Location;
- General Work requires one explicit active Work Location context. Home is the UI default. When
  the actor has multiple allowed Locations, the actor consciously selects one and the server
  verifies that it is Home or a current Work Location Grant; and
- missing, inactive, contradictory or multiple Location resolution rejects the Start/WorkEvent.

`Work Location` means organizational responsibility/work context. It is not geolocation, GPS or
proof that the person was physically present at that Location.

Changing a Home Location, Work Grant, Management Grant or Resource Location affects only new
server decisions. It SHALL NOT rewrite historical events, accepted time records, corrections,
reviews, exports or audit history. Later corrections/reviews/exports retain the record's immutable
accepted Work Location.

While the feature is on, a user may execute work only at Home or a currently granted additional
Work Location. Work-Grant revocation prevents new work decisions for that additional Location but
does not remove or reinterpret accepted history. A Location Manager may access historical
privileged data only with a current Management Grant for each record's immutable accepted Work
Location; revocation removes both new and historical privileged access decisions immediately.

### DA6-L07 — Explicit legacy assignment before delegation

An Organization Administrator may prepare inactive setup, but effective activation SHALL NOT make
pre-existing data visible automatically. Before the atomic activation transaction may commit:

- every active Organization user and active Membership has exactly one active same-Organization
  Home Location, including Administrators and Location Managers;
- every Location-relevant active Customer, Project, resource-backed WorkTarget, other active
  WorkTarget and NFC Assignment has one unique active same-Organization Location binding; and
- every relationship needed to derive a WorkTarget or NFC Assignment Location is complete,
  mutually consistent and unambiguous.

Delegated access additionally requires an explicit current Management Grant and a complete,
tenant-safe assignment/provenance set for the concrete operation.

Unbound, partially bound, contradictory or ambiguous data remains Organization-Administrator-only
and fails closed for Location Managers. There is no automatic assignment by creator, employee,
customer, project name, NFC relationship, current activity, prior access or UI selection.

If any activation precondition fails, the complete transition is rejected, the feature remains
effectively off and current behavior remains unchanged. Before delegated access, a Resource
Location assignment is explicit and unambiguous. Where a requested operation depends on multiple
resources or historical records, the complete dependency set must have compatible explicit
Location responsibility/provenance. An incomplete graph cannot produce a partial result.

Deactivation retains these assignments and immutable accepted Work Locations but makes them
non-authoritative for Location-scoped/delegated behavior. Reactivation must revalidate the entire
current active set; retained setup receives no grandfathered validity.

### DA6-L08 — Server-side authorization and scoped result truth

Every API read, mutation, correction, review and export SHALL derive current Membership, role,
Organization, Home Location, active Work or Management Grants for the requested capability,
resource responsibility and immutable accepted Work Location on the server and enforce them in
the data boundary. Work Grants and Management Grants are purpose-distinct and never satisfy each
other's checks. RLS, least-privilege roles and transactional checks must preserve both
Organization and Location isolation.

Employee self-service Start/Stop/One-Tap and Business Engine semantics remain unchanged. While
the feature is on, only the target catalog is narrowed: it contains WorkTargets whose exact active
Location is the actor's Home or a current additional Work Location Grant. General Work follows
the explicit-context rule in `DA6-L06`. Revocation applies to every new server decision; already
accepted history remains immutable.

Location-filtered results must be explicit and truthful:

- requests name the intended Location scope; an omitted or `all` scope is not delegated authority;
- an unauthorized, revoked, inactive, ambiguous or mixed scope rejects the complete request;
- corrections/reviews/exports do not silently omit inaccessible rows and present a partial result
  as complete;
- Manager history reads, corrections, reviews and exports use only immutable accepted Work
  Location and require a current Management Grant for every included record Location;
- writes cannot move or connect data across Locations unless the exact Cross-Location operation
  is later explicitly accepted and the actor has current authority for every side; and
- revocation takes effect for every new server decision and cannot be bypassed by cached client
  navigation or stale tokens.

### DA6-L09 — Append-only, disclosure-safe audit

Append-only audit evidence is required for inactive setup changes, activation attempts and their
fail-closed outcome, effective activation/deactivation, Home/Resource Location assignment,
Location lifecycle, Work and Management Grant/change/revocation and every delegated privileged
action, including correction, review and export. It records the Organization, relevant Location
reference, current actor Membership, purpose-specific grant class where applicable, action,
outcome, time and safe operation correlation needed for accountability.

Deactivation is audited as an immediate authority transition. Retained assignments/grants and
immutable accepted Work Locations remain historical/configuration truth but grant no effective
Location-scoped authority while off. Reactivation receives its own complete validation and audit
outcome; it is never an unaudited restoration of the prior effective state.

Audit output SHALL use fixed allowlisted fields and SHALL NOT expose secrets, credentials, raw NFC
payloads, exported content, free-form correction reasons, arbitrary request bodies or foreign
tenant data. Audit retention and legally binding lifecycle values remain part of ADR-0018's
separate Human/legal gates.

### DA6-L10 — Capability-consistent API and UI

API responses and UI state SHALL reflect server-derived capability and Location-scope truth.
Navigation may hide unavailable actions for clarity, but hiding, showing or disabling UI is not an
authorization control. Every privileged action revalidates authority on the server.

The future UX must distinguish Organization-wide Administrator state, selected Location scope,
inactive/incomplete setup versus effective activation, Home versus additional Work Locations,
Management scope, unassigned/ambiguous Administrator-only data and revoked/inactive delegation
without implying that an empty or partial list is complete. General Work defaults visibly to Home;
when multiple Home-plus-Work Locations are allowed, the user must make a conscious Location choice
and the server revalidates it. This candidate implements no UI.

### DA6-L11 — DA6 integration and mandatory R3 gates

This capability SHALL be handled as **Workstream E / Phase 0** ahead of, and then integrated into,
ADR-0018 Workstreams A–D. It SHALL NOT be implemented as an incidental part of provider
provisioning.

Workstream E establishes the complete feature, tenant, data, authorization, migration and audit
contract first; at this stage only the R1 P1 disposition in Section 2 is Human-accepted.
Workstreams A–D must then explicitly verify the resulting Location dimension in:

- atomic activation/deactivation/reactivation, complete active-binding validation and exact
  feature-off compatibility;
- one-Home invariants plus non-inheriting Work/Management Grant separation;
- target-catalog and accepted Work Location derivation for resource, NFC and General Work paths;
- RLS, tenant/Location isolation and least-privilege IAM;
- logs, metrics, traces and incident evidence;
- backup, restore, historical provenance and lifecycle replay;
- deletion, restriction, retention and export behavior; and
- operational configuration, rollout, rollback and recovery.

Any implementation is R3 and requires an exact accepted authorization, AVS V0–V4, adversarial
Cross-Tenant/Cross-Location/authentication/authorization tests, atomic incomplete-setup failure,
Home/Work/Management separation, grant revocation, immutable accepted Work Location and
deactivation/reactivation proof, migration and default-off proof, complete candidate regression,
exact-head CI and independent architecture/security/operations review. Human, hardware,
provisioning, production, production-data, deployment and distribution gates remain separate.

## 4. Consequences

### Positive

- Single-Organization customers keep exactly the current Product behavior while the feature is
  off.
- Organizations that explicitly opt in can delegate bounded operational work without granting
  Organization administration.
- Tenant isolation stays anchored at Organization while Location scope is explicit and auditable.
- Home, Work and Management purposes are deterministic and non-inheriting.
- Every accepted work record has one immutable server-derived organizational Location context.
- Historical work truth does not drift when people or resources move.

### Trade-offs

- Safe delegation requires explicit assignment/provenance rather than automatic visibility.
- Activation requires complete current classification of all active Memberships and
  Location-relevant active resources before any Location rule becomes effective.
- Authorization, RLS, backup/restore, export and retention verification gain a second scope
  dimension.
- Multi-Location operations must fail closed until their exact semantics are accepted.
- Existing data remains Administrator-only until deliberately and completely classified.

## 5. Explicit exclusions

This candidate does not include:

- Frogs-specific students, groups, tariffs, cancellation rules, ERP integration or other
  customer-specific workflows;
- automatic Location inference, migration, assignment or delegation;
- payroll, billing, scheduling, analytics, employee scoring or surveillance;
- changes to Employee self-service Start/Stop/One-Tap, NFC dispatch, offline ordering or Business
  Engine semantics beyond the Human-accepted Home-plus-Work target catalog and server-derived
  accepted Work Location boundary;
- Product code, tests, schema, migrations, dependencies, lockfile, workflow or UI implementation;
- cloud/provider selection, cost, accounts, provisioning, legal conclusions or production data;
- hardware, ADB, installation, deployment, signing or distribution; or
- any claim based on external pilot or repository documentation as TapTim.e Product truth.

## 6. Historical reviews and current authority boundary

The archived
`ADO/05_Evidence/Development_Assignment_06_Independent_Pre_Implementation_Review.md` remains
truthful for the earlier ADR-0018/Workstreams A–D candidate that it reviewed. It did not review ADR-0020,
`DA6-L01`–`DA6-L11`, Workstream E or this synchronization and SHALL NOT be cited as approval of
them.

Independent Review Round 1 reviewed candidate diff SHA-256
`475edf4654fc23bd33e1e0c8db1306f98a0ec2cc83bf4fe1a00587cd66e49e4f` including the new ADR file
and returned `CHANGES REQUIRED` with exactly one P1: the normative Location assignment model was
missing. That verdict remains historical truth and is not `APPROVED`.

The Human Architect then accepted exactly the mandatory Home Location and described additional
Work and Management Location assignment decision recorded in Section 2. This correction applies
that decision throughout the candidate. Independent re-review of the exact seven-file
Full-Index-Diff SHA-256
`e30591baf23f00bf4cc56ed1bf8fa0f7c4c9c86dfc0c962bd5a36f490791a9de` returned `APPROVED` with
zero open P0–P3 and closed the R1 P1, as archived in
`ADO/05_Evidence/Development_Assignment_06_Optional_Locations_Independent_Architecture_Authorization_Review.md`.
It does not constitute blanket Human acceptance of `DA6-L01`–`DA6-L11`, Workstream E or DA6, and
it grants no implementation authority.

The current DA5 hardware candidate, its source and its artifacts remain byte-exact and are not
blocked or modified by this ADO-only candidate. After any focused ADO publication, a future DA5
hardware action still requires a new exact ADO-head binding and separate one-time Human authority.
This ADR grants neither.

Provider, plan, cost, cloud, region, legal/privacy, retention and production decisions remain
separately open under ADR-0018.

## 7. Required Human disposition

After focused ADO candidate publication, the next binding Product/architecture decision is:

```text
accept, adjust or reject the remaining ADR-0020 DA6-L01–DA6-L11 values and
DA6 Workstream E / Phase 0, excluding the already Human-accepted Section-2 P1 assignment rules
```

Acceptance must state the exact accepted values. It does not itself authorize implementation;
any R3 implementation requires a separate exact baseline and bounded authorization.

## 8. Change-Impact Record

- Baseline: commit `90a5d1a3c90ee81aaeee335edd74a88c8fc904de`, tree
  `38d025a134cffe305017a1c845930d80115c1d3d`.
- Reviewed candidate boundary: seven ADO Markdown files, +766/-23, Full-Index-Diff SHA-256
  `e30591baf23f00bf4cc56ed1bf8fa0f7c4c9c86dfc0c962bd5a36f490791a9de`.
- Current closure boundary: eight ADO Markdown files only (the reviewed seven-file candidate plus
  its review archive/status synchronization); no executable, schema, migration, dependency,
  lockfile, configuration, workflow, script or artifact input.
- Product/runtime effect: none; feature remains nonexistent and therefore disabled.
- Security/data boundary: documentation candidate for a future R3 Location authorization layer;
  no enforcement change is claimed.
- Risk/verification: R0/V0 for this preparation; exact scope/diff, whitespace,
  Markdown/reference/navigation and status/authority consistency only.
- Product suites, CI and V1–V5: not run; not relevant to this ADO-only delta and not authorized.
- Carried evidence: historical ADR-0018/DA6 review remains bound only to its earlier candidate;
  R1 `CHANGES REQUIRED` is bound to predecessor diff SHA-256
  `475edf4654fc23bd33e1e0c8db1306f98a0ec2cc83bf4fe1a00587cd66e49e4f`; corrected-candidate
  re-review is `APPROVED` with zero open P0–P3 on the exact seven-file digest above. Current DA5
  source/artifact evidence remains unchanged and is not fresh ADR-0020 evidence.
- Next gates: focused ADO publication, remaining exact Human disposition and only then a separately
  exact-bound R3 implementation authorization. No publication commit/tree or CI is claimed for
  this uncommitted eight-file closure state.
