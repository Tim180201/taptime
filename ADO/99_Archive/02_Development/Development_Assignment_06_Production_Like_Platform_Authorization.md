# Development Assignment 6 — Production-like Platform and Operational Readiness

- Status: **ADR-0020 INDEPENDENTLY APPROVED FOR ADO CANDIDATE PUBLICATION; R1 P1 CLOSED; ONLY
  P1 ASSIGNMENT DECISION HUMAN-ACCEPTED; REMAINING ADR-0020/DA6 HUMAN DISPOSITION PENDING; NO
  IMPLEMENTATION OR PROVISIONING AUTHORITY**
- Date: 2026-07-28
- ADR-0020 extension preparation date: 2026-08-04
- Exact preparation baseline commit: `f0c51f2a30770c62fc4ba7463fa89a6624365612`
- Exact preparation baseline tree: `6c2cdbd3c9b20c8c24fdd7645d3504c210491484`
- Exact ADR-0020 extension preparation baseline commit:
  `90a5d1a3c90ee81aaeee335edd74a88c8fc904de`
- Exact ADR-0020 extension preparation baseline tree:
  `38d025a134cffe305017a1c845930d80115c1d3d`
- Corrected ADR-0020 seven-file candidate Full-Index-Diff SHA-256:
  `e30591baf23f00bf4cc56ed1bf8fa0f7c4c9c86dfc0c962bd5a36f490791a9de`
- ADR-0020 independent re-review:
  `ADO/05_Evidence/Development_Assignment_06_Optional_Locations_Independent_Architecture_Authorization_Review.md`
- Owner: Technical Lead
- Decision authority: Human Architect
- Proposed architecture:
  `ADO/01_Architecture/ADR/ADR-0018-production-like-platform-and-operational-readiness.md`
- Proposed optional Location/delegation architecture:
  `ADO/01_Architecture/ADR/ADR-0020-optional-locations-and-delegated-administration.md`
- Proposed implementation risk: AVS-001 **R3**

## 1. Objective

Prepare a production-like, locally and independently verifiable operational platform around the
already accepted TapTim.e Product boundaries. The assignment stops before cloud/provider
provisioning, public endpoints, paid services, production credentials/data or deployment unless
each receives a later separate exact Human authorization.

ADR-0018 DA6-P01–P12 are the complete candidate contract. This document does not accept them.

ADR-0020 now adds `DA6-L01`–`DA6-L11` and Workstream E / Phase 0 as a separate generic,
Organization-opt-in candidate. It is default off and, while off, changes no Organization,
Membership, role, Product data, API or UI behavior. Only the subsequent exact P1 disposition below
is Human-accepted; the remaining values are not. It supersedes the prior unchanged-role/UI/
Product-behavior boundary only if, and only for the exact scope that, the Human Architect later
accepts. `DA6-P01`–`DA6-P12` remain unchanged.

After independent R1 returned `CHANGES REQUIRED` with exactly one P1 against reviewed candidate
diff SHA-256 `475edf4654fc23bd33e1e0c8db1306f98a0ec2cc83bf4fe1a00587cd66e49e4f`, the Human Architect
accepted exactly the mandatory one-Home assignment plus separate additional Work and Management
Location assignment model now integrated in ADR-0020. The remaining ADR-0020/DA6 values are not
thereby accepted, and no implementation authority follows.

Independent re-review of the exact corrected seven-file candidate returned `APPROVED` with zero
open P0–P3 and closed the R1 P1. It approves only ADO candidate publication and does not convert
the remaining Human-disposition or R3 implementation gates into authority.

## 2. Verified starting point

The preparation baseline has:

- DA1–DA3 closed for their exact local scopes;
- DA4 and DA5 software independently approved, with their Human gates still open;
- PostgreSQL migrations `001`–`013`, least-privilege roles/RLS and exact backend APIs;
- email/password identity, Admin Web, Android, offline synchronization, correction/review/export;
- a 12-job exact-head CI matrix and exact local artifact verification;
- ADR-0008's approved Supabase/PostgreSQL/Auth and managed-Node direction; and
- no production resource, data, provider binding, deployment, observability or recovery evidence.

The baseline does not establish service levels, legal retention values, a processor agreement,
production IAM, production connection mode, paid plan or production-data authority.

It has no implemented Location model or delegated Location role. Repository truth remains one
Membership per Organization/User, role values `administrator`/`employee`, Organization-wide
Administrator authority and no Location authorization column, grant or scope. Only the
architecture requirement for mandatory Home plus separate Work/Management assignments and its
activation/provenance rules is Human-accepted; it has no runtime effect.

## 3. Proposed workstreams

### Workstream E / Phase 0 — optional Locations and delegated administration

- preserve Organization as the hard tenant boundary and Location only as a subordinate scope;
- keep the feature Organization-wise default off and activatable only by a current Organization
  Administrator;
- permit inactive Administrator setup but activate only atomically after exactly one active Home
  Location per active user/Membership and unique active bindings for every relevant active
  resource/WorkTarget/NFC Assignment;
- preserve one Membership per Organization/User while separating exactly one Home, zero/many
  additional Work Location Grants and separate zero/one/many Management Location Grants;
- implement a closed v1 capability matrix only after its remaining values are Human-accepted,
  with server-derived fail-closed authorization and no implicit Administrator inheritance;
- derive and immutably fix accepted Work Location for every accepted WorkEvent/TimeRecord from
  resource/NFC/explicit General Work context without GPS/geolocation claims or historical rewrite;
- require complete explicit legacy-data assignment before delegated visibility;
- add tenant-safe Location-scoped correction, review and export truth plus append-only
  disclosure-safe audit; and
- feed the accepted Location dimension into Workstreams A–D instead of mixing it into provider
  provisioning.

The assignment/provenance P1 decision is Human-accepted. The corrected ADO candidate is
independently approved for publication; the full workstream is not blanket Human-accepted and
remains without implementation authority.

### Workstream A — reproducible environments and delivery

- implement a closed local/CI/staging/production configuration contract;
- add repository-owned provider-neutral infrastructure modules with zero default provisioning;
- bind release source, schema, dependency, configuration and artifact identity;
- prove environment isolation and drift detection;
- preserve production promotion as a separately authorized action; and
- provide a cost-free local/synthetic verification path.

### Workstream B — security and disclosure-safe observability

- add least-privilege IAM and workload-identity policy contracts;
- add secret inventory/rotation/revocation and break-glass validation without real secrets;
- add network/TLS/CORS/header/rate/timeout policy validation;
- add fixed allowlist structured logging, metrics and tracing contracts;
- prove no secret, token, raw NFC, email, free-form reason or row/body leakage; and
- add supply-chain provenance, SBOM and deployable-artifact verification.

### Workstream C — backup, restore and personal-data lifecycle

- add provider-neutral backup/PITR metadata and recovery contracts;
- implement isolated synthetic restore drills with exact cleanup;
- add post-recovery deletion/restriction/revocation replay proof;
- add a versioned data-class/retention policy input with no invented numeric defaults;
- prove restored tenant/RLS/role/migration and append-only evidence integrity; and
- stop before real backups, real personal data or irreversible legal-lifecycle operations.

### Workstream D — operational readiness

- add deployment, migration, rollback/forward-recovery and provider-outage runbooks;
- add incident, credential-compromise and personal-data-breach starter procedures;
- add synthetic load/capacity/failure checks and cost-budget policy validation;
- prepare a non-executable operational V5 runbook/evidence shell;
- execute AVS V0–V4 and independent reviews after separate implementation authority; and
- stop before production/deployment.

## 4. Expected implementation boundary

Expected future changed areas are limited to:

- an explicitly accepted, default-off Location/delegation schema and server authorization boundary
  under Workstream E;
- new internal deployment/operations contracts and scripts;
- provider-neutral infrastructure definitions;
- configuration/schema validation and release manifests;
- backend observability adapters with fixed safe DTOs;
- backup/restore/deletion-ledger tooling against disposable synthetic PostgreSQL;
- focused operational/security tests and CI commands;
- concise operational runbooks and evidence; and
- dependency/lockfile changes only when separately justified and reviewed.

Expected unchanged Product behavior, except only for exact ADR-0020 values if later
Human-accepted and separately implemented:

- Business Engine Start/Stop/duplicate/rejection decisions;
- the Organization tenant boundary and one-Membership-per-Organization/User invariant;
- NFC and manual-trigger semantics;
- offline ordering, retention, protection and reconciliation;
- append-only correction/review and export truth;
- Admin Web and Mobile information architecture; and
- production signing/distribution and public website behavior.

While ADR-0020 is off, tenant/Membership authority, the current role model, API responses, Admin
Web/Mobile information architecture and all Product behavior remain exactly unchanged. No
existing Membership or data is migrated, inferred, assigned or newly exposed.

## 5. Acceptance criteria for a later implementation

Technical approval would require:

1. Human acceptance of the remaining ADR-0018, ADR-0020 `DA6-L01`–`DA6-L11`, Workstreams A–E
   and this exact assignment values, excluding the already accepted P1 assignment rules;
2. an exact implementation baseline and bounded authority;
3. no real provider/resource/account/cost/deployment action;
4. closed, fail-closed environment selection and strict staging/production separation;
5. immutable artifact promotion and schema/config compatibility;
6. least-privilege IAM/secret/network boundaries and adversarial tests;
7. disclosure-safe observability with negative leakage evidence;
8. isolated synthetic backup/restore and post-restore lifecycle replay;
9. parameterized retention/RPO/RTO values with no invented policy;
10. explicit cost and provider gates;
11. AVS V0–V4 plus independent exact-SHA/security/operations `APPROVED`; and
12. default-off, atomic complete activation/deactivation/reactivation and legacy-preservation proof
    plus adversarial Cross-Tenant/Cross-Location, missing/duplicate Home, Work-versus-Management
    grant separation, stale/revoked-grant, own-time, partial-result and historical-provenance
    verification;
13. exact server-authoritative capability and scoped correction/review/export enforcement with no
    implicit or Cross-Location authority; and
14. a stop before Human operational V5, production, deployment and distribution.

## 6. Adaptive Verification candidate

### V0

- exact scope/diff and protected-boundary check;
- authority and no-provisioning/no-cost review;
- configuration, documentation and reference validation.

### V1

- focused configuration/environment/release-manifest tests;
- IAM/secret/logging/network policy tests;
- backup/restore/deletion-ledger unit/integration tests;
- focused default-off/atomic activation, Home/Work/Management grant/capability, accepted Work
  Location, own-time and historical-provenance tests;
- tests-inclusive typechecks and script syntax checks.

### V2

- complete affected operational/security workspaces;
- disposable PostgreSQL restore, migration and RLS/tenant verification;
- adversarial leakage, secret, drift, provider-failure and partial-cleanup tests;
- adversarial Cross-Tenant/Cross-Location, revoked-grant, unbound/ambiguous legacy-data and
  partial/mixed-result tests;
- local production-like composition with synthetic data.

### V3

- exactly one complete local candidate regression;
- all applicable tests-inclusive typechecks/builds;
- complete disposable restore/recovery drill and cleanup;
- dependency/provenance/license/disclosure audit.

### V4

- focused publication;
- exact-head CI;
- independent exact-SHA architecture/security/operations review;
- fresh affected evidence after every confirmed R3 correction.

### V5

Separately authorized operational evidence only. It does not authorize production data,
deployment or distribution.

## 7. Current authority

The Human Architect authorized preparation of DA6. That permits this ADO-only candidate and its
read-only review. It does not yet authorize Workstreams A–D implementation.

The Human Architect additionally authorized ADO-only preparation of ADR-0020 and Workstream E.
After R1 `CHANGES REQUIRED`, the Human Architect accepted exactly the mandatory Home Location and
described additional Work/Management Location P1 decision. That does not blanket-accept
`DA6-L01`–`DA6-L11`, Workstream E or any Location/delegation implementation. Independent re-review
of Full-Index-Diff SHA-256
`e30591baf23f00bf4cc56ed1bf8fa0f7c4c9c86dfc0c962bd5a36f490791a9de` returned `APPROVED` with
zero open P0–P3 and closed the R1 P1 for ADO candidate publication only; the review is archived in
`ADO/05_Evidence/Development_Assignment_06_Optional_Locations_Independent_Architecture_Authorization_Review.md`.

The historical DA6 independent pre-implementation `APPROVED` review remains truthful only for the
earlier ADR-0018/Workstreams A–D candidate. It did not review ADR-0020, Workstream E or this delta
and is not approval of them.

No cloud/provider account or resource, paid service, DNS/public endpoint, secret, production or
pilot data, deployment, system change, DA7 signing/distribution or DA8 website implementation is
authorized.

Product code, tests, schema, dependencies, lockfile, workflow, hardware, ADB and installation are
also outside this preparation. Frogs-specific students, groups, tariffs, cancellation rules, ERP
integration and customer-specific workflows are excluded.

The current DA5 hardware candidate remains byte-, source- and artifact-identical and is not
blocked by this ADO-only preparation. After focused ADO publication, any DA5 hardware action needs
a new exact ADO-head binding and separate one-time Human authority; this assignment grants none.

## 8. Required Human disposition

The next binding decision is:

```text
accept, adjust or reject ADR-0018 DA6-P01–P12, the remaining ADR-0020 DA6-L01–DA6-L11 values,
and DA6 Workstreams A–E including Workstream E / Phase 0, excluding the already Human-accepted
P1 Home/Work/Management assignment and accepted-Work-Location rules
```

The disposition must bind every remaining Location/default-off/role/capability/provenance/
legacy-assignment value; only the stated P1 assignment/provenance rules are already accepted. If
the remainder is accepted, a separate R3 implementation authorization must bind an exact commit
and tree. Cost, cloud provisioning, legal values, production, production data, deployment and
distribution remain separately gated even after local implementation authority.

## 9. ADO-only Change-Impact Record

- Baseline: `90a5d1a3c90ee81aaeee335edd74a88c8fc904de`, tree
  `38d025a134cffe305017a1c845930d80115c1d3d`.
- Reviewed candidate scope: exactly seven ADO Markdown files, +766/-23, Full-Index-Diff SHA-256
  `e30591baf23f00bf4cc56ed1bf8fa0f7c4c9c86dfc0c962bd5a36f490791a9de`.
- Current closure scope: eight ADO Markdown files only (the reviewed candidate plus Review archive
  and minimal status/reference synchronization); no executable, schema, migration, dependency,
  lockfile, configuration, workflow, script or artifact input.
- Risk/verification: R0/V0 for this preparation; future implementation R3.
- Product suites, CI and V1–V5: not run and not authorized for this ADO-only delta.
- Review: R1 `CHANGES REQUIRED` with exactly one P1 on predecessor diff SHA-256
  `475edf4654fc23bd33e1e0c8db1306f98a0ec2cc83bf4fe1a00587cd66e49e4f`; exact corrected-candidate
  re-review `APPROVED` with zero open P0–P3; R1 P1 closed.
- Remaining gates: focused ADO publication, exact remaining Human disposition and only then a
  separately exact-bound R3 implementation authorization. No publication commit/tree or CI is
  claimed for this uncommitted eight-file closure state.
