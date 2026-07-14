# Block C3A — Organization Administration Architecture Authorization

Status: Review Ready — independent re-review passed; Human acceptance pending
Authorization Date: 2026-07-14
Authorized Baseline: `220c55f72ffb0ba73c73c748af9701898529725a`
Human Architect Authorization: Explicit continuation under the delegated professional architecture
direction ("Wir machen es nach deiner Vorstellung" / "Leg los Chef")
Owner: Technical Lead
Architecture Authorities: ADR-0006, ADR-0008, ADR-0009, ADR-0011, FB-002, TS-002, B3–B6 and C1/C2
Roadmap Scope: C3A governance/architecture freeze only; C3B–C3E remain gated
Effort: Medium

## 1. Authorized objective

Reconcile FB-002/TS-002 with the implemented Core/backend reality and decide the security-sensitive
questions that block a real Organization/Admin runtime:

- first Organization/Administrator bootstrap authority;
- server-derived normal Administrator write authority;
- missing-target and cross-tenant result vocabulary;
- tenant-local Tag uniqueness and Assignment history;
- minimum human-readable Customer/Tag data;
- exact boundaries for the next implementation slices.

C3A is documentation and architecture only. It creates no SQL migration, server route, package,
cloud resource, UI, credential or production data.

## 2. Corrected C3A proposal

- FB-002 and TS-002 are independently validated and ready for Human Architect acceptance after explicit current-state
  reconciliation; their 2026-07-07
  repository snapshots remain labelled historical rather than being presented as current.
- First Organization/Admin creation is one private, operator-authenticated, idempotent and audited
  transaction. It is never a public API route or third product role.
- A verified provider token supplies issuer/subject; email and client-selected IDs are not identity
  authority.
- Migration `006` is reserved for C3B's isolated bootstrap role/capability, versioned name normalizer,
  immutable operator-attribution field and append-only receipt; migrations remain `001`–`005` in
  C3A.
- Bootstrap uses a short-lived named operator LOGIN, explicit execute-only role assumption and an
  exact limited BYPASSRLS function owner. `session_user` is stored in receipt/audit; cross-operator
  replay is denied and separately audited.
- Normal setup uses a distinct narrow write role and a B6-style current-Membership transaction. The
  existing broad Administrator role and detached Core objects are not transport authority.
- Expected Membership is mandatory narrowing for every Admin command/projection and is compared
  before receipt/resource access. Receipts bind tenant, actor, Membership, command type and the
  versioned canonical digest; divergent reuse is `command_id_conflict`.
- Customer and NfcTag gain required display names before a usable admin/setup claim. Raw NFC payload
  is never normal Admin presentation; only a labelled shortened validation fingerprint may be shown.
- A missing, inactive or inaccessible AssignmentTarget is externally
  `assignment_target_unavailable`, not `cross_organization_access`.
- NFC UID payload uniqueness is Organization-scoped. Initial provision is atomic register+assign;
  implicit reassignment is rejected. A later explicit reassignment preserves append-only history.
- One active Membership per User is the v1 invariant. Invitation, revocation, role change and
  last-Administrator workflows remain separately gated.

## 3. Independent review requirement

An independent read-only reviewer must verify:

- the operator plane cannot be reached by ordinary Mobile/Admin/API credentials;
- named operator LOGIN, TLS/credential ownership, role assumption, RLS bridge and durable
  `session_user` attribution are complete and non-shared;
- bootstrap replay, concurrency, audit actor truth and rollback have deterministic contracts;
- no request-supplied domain object grants identity, Membership, tenant or Tag authority;
- the normal setup role is narrower than the existing Administrator role;
- target/payload/reassignment outcomes do not disclose another tenant;
- Admin projections cannot leak raw payload, token, issuer or subject;
- stale Membership narrowing, receipt namespace/hash binding and result precedence cannot redirect
  or ambiguously replay a command;
- the proposed C3B/C3C split is implementable against migrations `001`–`005` plus one additive
  migration sequence without changing lifecycle authority.

Any open P0/P1/P2 finding blocks C3B authorization. Every review pass and its disposition is recorded in
`ADO/05_Evidence/Block_C3A_Independent_Architecture_Security_Review.md`.

## 4. C3A completion criteria

- The Human Architect accepts ADR-0011 after its independent review and confirms consistency with
  ADR-0008/ADR-0009.
- FB-002 and TS-002 no longer claim their historical repository baseline is current.
- Every formerly open FB-002 question is marked Resolved, Partially Resolved or Deferred with an
  explicit authority.
- DT-025's missing-target limitation has a stable C3 boundary result.
- Bootstrap, display-name, payload, assignment-history and Membership invariants are fixed.
- Project Status, Decision Log, Risk Register, roadmap and ADO navigation remain truthful.
- No product code, migration, dependency, cloud state or `research/` content changes.

## 5. Current truth

C3A passed independent technical re-review; it does not yet authorize implementation or make
setup operational. There is still no
Organization bootstrap CLI, normal setup API, Customer/Tag display-name migration, Admin Web or
mobile Administrator capture screen. C3B–C3E remain unauthorized; C3B may be considered first only
after the Human Architect explicitly accepts C3A and then separately continues into C3B.
