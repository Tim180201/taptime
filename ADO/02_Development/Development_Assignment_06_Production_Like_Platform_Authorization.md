# Development Assignment 6 — Production-like Platform and Operational Readiness

- Status: **ADO-ONLY CANDIDATE — NOT HUMAN ACCEPTED; NO IMPLEMENTATION OR PROVISIONING AUTHORITY**
- Date: 2026-07-28
- Exact preparation baseline commit: `f0c51f2a30770c62fc4ba7463fa89a6624365612`
- Exact preparation baseline tree: `6c2cdbd3c9b20c8c24fdd7645d3504c210491484`
- Owner: Technical Lead
- Decision authority: Human Architect
- Proposed architecture:
  `ADO/01_Architecture/ADR/ADR-0018-production-like-platform-and-operational-readiness.md`
- Proposed implementation risk: AVS-001 **R3**

## 1. Objective

Prepare a production-like, locally and independently verifiable operational platform around the
already accepted TapTim.e Product boundaries. The assignment stops before cloud/provider
provisioning, public endpoints, paid services, production credentials/data or deployment unless
each receives a later separate exact Human authorization.

ADR-0018 DA6-P01–P12 are the complete candidate contract. This document does not accept them.

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

## 3. Proposed workstreams

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

- new internal deployment/operations contracts and scripts;
- provider-neutral infrastructure definitions;
- configuration/schema validation and release manifests;
- backend observability adapters with fixed safe DTOs;
- backup/restore/deletion-ledger tooling against disposable synthetic PostgreSQL;
- focused operational/security tests and CI commands;
- concise operational runbooks and evidence; and
- dependency/lockfile changes only when separately justified and reviewed.

Expected unchanged Product behavior:

- Business Engine Start/Stop/duplicate/rejection decisions;
- tenant/Membership authority and role model;
- NFC and manual-trigger semantics;
- offline ordering, retention, protection and reconciliation;
- append-only correction/review and export truth;
- Admin Web and Mobile information architecture; and
- production signing/distribution and public website behavior.

## 5. Acceptance criteria for a later implementation

Technical approval would require:

1. Human acceptance of ADR-0018 and this exact assignment;
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
12. a stop before Human operational V5, production, deployment and distribution.

## 6. Adaptive Verification candidate

### V0

- exact scope/diff and protected-boundary check;
- authority and no-provisioning/no-cost review;
- configuration, documentation and reference validation.

### V1

- focused configuration/environment/release-manifest tests;
- IAM/secret/logging/network policy tests;
- backup/restore/deletion-ledger unit/integration tests;
- tests-inclusive typechecks and script syntax checks.

### V2

- complete affected operational/security workspaces;
- disposable PostgreSQL restore, migration and RLS/tenant verification;
- adversarial leakage, secret, drift, provider-failure and partial-cleanup tests;
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

No cloud/provider account or resource, paid service, DNS/public endpoint, secret, production or
pilot data, deployment, system change, DA7 signing/distribution or DA8 website implementation is
authorized.

## 8. Required Human disposition

The next binding decision is:

```text
accept, adjust or reject ADR-0018 DA6-P01–P12 and DA6 Workstreams A–D
```

If accepted, a separate implementation authorization must bind an exact commit and tree. Cost or
cloud provisioning remains separately gated even after local implementation authority.
