# ADR-0018: Production-like Platform and Operational Readiness

- Status: **PROPOSED — HUMAN ACCEPTANCE AND SEPARATE IMPLEMENTATION AUTHORITY REQUIRED**
- Date: 2026-07-28
- Candidate baseline commit: `f0c51f2a30770c62fc4ba7463fa89a6624365612`
- Candidate baseline tree: `6c2cdbd3c9b20c8c24fdd7645d3504c210491484`
- Owner: Technical Lead
- Decision authority: Human Architect
- Roadmap: Development Assignment 6; production-like platform, security, observability,
  backup/recovery and operations
- Related: Product Vision, ADR-0008, ADR-0011–ADR-0017, AVS-001, Risk Register
- Proposed implementation risk: AVS-001 **R3**

## 1. Context

Development Assignments 1–5 establish the local Product, tenant, lifecycle, offline, Admin Web and
Android boundaries. They do not establish a deployable production platform.

ADR-0008 already selects Supabase-managed PostgreSQL/Auth, a persistent managed Node.js API and
Central EU (Frankfurt) as the intended v1 direction. It also requires legally approved retention,
erasure/restriction, backup and restore-replay behavior before production personal data.

The repository currently has:

- a complete local PostgreSQL schema and least-privilege role model;
- strict API, tenant/RLS and synthetic runtime verification;
- exact CI and artifact evidence;
- no production cloud project, production database, production credentials or customer data;
- no approved managed-Node deployment provider or connection mode;
- no production observability, backup/PITR, restore, incident or rollback evidence; and
- no legally approved numeric retention, recovery or service-level values.

DA6 must make these operational boundaries implementation-ready without treating architecture or
local simulation as production evidence.

## 2. Candidate decision

### DA6-P01 — Scope and hard stop

DA6 SHALL prepare and locally prove the production-like platform boundary for the already accepted
Product. It may add infrastructure definitions, deployment validation, operational adapters,
security controls, observability, backup/restore tooling and runbooks.

DA6 SHALL NOT create a production resource, process production/pilot personal data, deploy a
publicly reachable service, purchase a service, change a system account, or distribute an app
without a separate exact Human authorization.

### DA6-P02 — Four explicit environments

The platform SHALL distinguish:

1. **local** — disposable loopback-only development with synthetic data;
2. **CI** — ephemeral automated verification with synthetic data;
3. **staging** — production-like non-production, separately provisioned and synthetic-only until
   legal/privacy and personal-data authority exist; and
4. **production** — separately authorized real operation.

No database, Auth tenant/project, credential, signing key, encryption key, storage bucket, network
principal or backup chain may be shared between staging and production. Environment selection is
closed and validated before startup; implicit fallback to another environment is prohibited.

### DA6-P03 — Approved platform composition, unresolved provider binding

ADR-0008 remains controlling:

- Supabase-managed PostgreSQL and Supabase Auth are the v1 data/identity plane;
- a persistent managed Node.js service is the primary transactional API runtime;
- ordinary application requests use direct/session-pooled PostgreSQL behavior proven compatible
  with TapTim.e transactions and request-local tenant context; and
- Central EU (Frankfurt) is the intended initial region, subject to actual provider availability
  and final legal approval.

DA6 SHALL NOT silently select a paid plan, managed-Node vendor, DNS provider, email provider,
monitoring vendor or production connection mode. Exact providers, plans, prices, subprocessors and
regions are Human/cost/legal gates before provisioning.

### DA6-P04 — Reproducible infrastructure and immutable release identity

Every deployable resource and policy SHALL be defined through reviewable repository-owned
configuration or infrastructure-as-code. Manual console changes may be used only for a documented
bootstrap capability that cannot be automated safely; they require an attributed receipt and
drift detection.

Every release SHALL bind source commit/tree, dependency lock, database migration ledger, build
identity, configuration schema version and immutable artifact digest. Mutable tags such as
`latest` are not release authority. Production promotion SHALL use the already reviewed artifact;
it shall not rebuild from source during promotion.

### DA6-P05 — Identity, IAM and secrets

Human and workload identities SHALL be distinct. Required controls are:

- least-privilege roles with no shared Human administrator account;
- MFA for privileged Human access;
- short-lived workload identity or a managed secret store instead of repository/CI plaintext;
- separate bootstrap, migration, runtime, backup/restore and observability capabilities;
- no database owner/service-role credential in Mobile, Admin Web or normal API requests;
- key/secret rotation with overlap, revocation and rollback procedures; and
- a separately reviewed, time-bounded break-glass procedure with immutable audit evidence.

Repository, build output, CI logs, application logs and support exports must not contain secrets.

### DA6-P06 — Network, transport and exposed surface

Production-like services SHALL use TLS with verified hostnames. Database access is private or
source-restricted and is never exposed as a public Product interface. Only the exact versioned API,
minimal readiness/liveness endpoints and necessary Auth callback surface may be reachable.

Health endpoints disclose no version, environment secret, dependency address, tenant, user or
database detail. CORS, request size, timeout, redirect, security-header and rate-limit policies are
closed, environment-bound and fail closed.

### DA6-P07 — Disclosure-safe observability

Observability SHALL use a fixed allowlist schema rather than arbitrary object/error serialization.
Logs, metrics and traces must not contain:

- passwords, tokens, invitation secrets, connection strings or cryptographic material;
- raw NFC payloads or stable device identifiers;
- email addresses, free-form correction reasons or exported CSV content;
- database rows, request bodies or provider error payloads; or
- cross-tenant identifiers that are not required for a documented operational purpose.

Safe operational correlation uses generated request/operation IDs and approved pseudonymous,
rotation-capable references. Pseudonymized values remain personal data. Observability retention,
access and deletion/restriction propagation require explicit policy values before production.

### DA6-P08 — Backup, restore and recovery

The selected data platform SHALL provide encrypted, region-bound backups with a documented
retention/expiry schedule. Recovery SHALL be proven in an isolated environment from a selected
recovery point and must verify:

- exact schema/migration compatibility;
- tenant and least-privilege policy restoration;
- consistency of append-only lifecycle/correction/audit evidence;
- post-backup replay of deletion, restriction, anonymization and revocation actions before traffic;
- secret/key separation from the failed environment;
- no accidental outbound communication or real-user authentication; and
- complete cleanup of the recovery exercise.

RPO, RTO, backup retention, restore-test cadence and deletion-ledger retention are binding Human
and legal decisions. Until accepted, DA6 may implement only parameterized fail-closed mechanisms
and synthetic recovery tests; it may not claim a recovery service level.

### DA6-P09 — Retention, export and data-subject operations

One versioned data-class register SHALL bind each personal-data class to purpose, actor roles,
controller/processor disposition, source, recipients/subprocessors, region, legal basis candidate,
retention trigger, numeric period, expiry action and propagation targets.

The runtime SHALL NOT invent numeric retention. Legal hold, restriction, erasure and genuine
anonymization are distinct commands and evidence. Append-only Product history does not override
applicable law. Exports, logs, replicas and restored backups are included in the same lifecycle.

### DA6-P10 — Change, incident and rollback operations

DA6 SHALL define and locally exercise:

- pre-deployment verification and migration compatibility;
- canary or equivalent bounded activation;
- post-deployment health and tenant-isolation checks;
- application rollback and forward-only database recovery rules;
- dependency/provider outage and degraded-mode handling;
- credential compromise, personal-data breach and unauthorized-access response;
- evidence preservation without secret/personal-data leakage; and
- incident closure, corrective action and recurrence prevention.

No runbook may imply that a destructive database migration can be rolled back by deploying old
application code. Production incident notification timelines and responsibilities require legal
and operational review.

### DA6-P11 — Capacity, availability and cost guardrails

DA6 SHALL define measurable synthetic load and failure tests for the accepted critical paths,
including authentication, session resolution, setup reads, lifecycle ingestion, synchronization,
own-time, review and export.

SLOs, alert thresholds, capacity limits and rate limits remain proposed until Human acceptance.
Every future paid environment requires an explicit monthly budget ceiling, cost-alert thresholds
and shutdown/escalation ownership. Architecture or implementation authority is not spending
authority.

### DA6-P12 — Verification and release gates

DA6 is R3. A later implementation requires:

- AVS V0–V4;
- adversarial IAM, secret, tenant, transport, logging and configuration tests;
- disposable infrastructure and restore drills with synthetic data;
- one complete production-like candidate regression;
- exact-head CI and independent exact-SHA/security/operations review; and
- a separate Human operational V5 before any production candidate can be accepted.

Cloud provisioning, paid services, DNS/public endpoints, production credentials/data, deployment
and distribution remain separately authorized actions even after local implementation approval.

## 3. Proposed workstreams

### Workstream A — environment and delivery foundation

- closed environment/configuration schema;
- repository-owned infrastructure definitions and drift checks;
- immutable artifact/release manifest and promotion proof;
- least-privilege CI/workload identity boundary; and
- local/CI production-like composition using synthetic data only.

### Workstream B — security and observability

- IAM/secret/network/transport policies;
- fixed disclosure-safe log/metric/trace contracts;
- operational correlation and access controls;
- dependency/image/provenance/SBOM verification; and
- negative leakage, cross-tenant and degraded-dependency tests.

### Workstream C — backup, restore and data lifecycle

- provider-neutral backup/restore contract;
- isolated synthetic restore drill;
- deletion/restriction/revocation replay ledger;
- data-class/retention configuration boundary; and
- recovery integrity and cleanup evidence.

### Workstream D — operations and readiness

- deployment/rollback/failure runbooks;
- incident and breach-response starter procedures;
- synthetic load/capacity and cost-control checks;
- operational V5 runbook/evidence preparation; and
- final exact review and gate handover.

## 4. Explicit exclusions

DA6 excludes:

- new Product behavior, Business Engine rules or UI productization;
- payroll, billing, analytics, advertising, employee-performance scoring or surveillance;
- changes to existing NFC, offline, correction, review or export semantics;
- production/pilot personal data;
- final legal conclusions or publication of legal text;
- DA7 Product signing/store distribution and DA8 public website implementation;
- any provider purchase, account/resource creation or system mutation without separate authority;
- access to `research/`; and
- any claim that local/staging evidence is production evidence.

## 5. Human decisions required before implementation or provisioning

Architecture acceptance requires the Human Architect to accept or adjust:

1. DA6-P01–P12 and Workstreams A–D;
2. whether the commercial Product remains B2B-only for v1;
3. candidate service objectives and operational ownership;
4. the separation between cost-free local implementation and separately authorized provisioning.

Before any paid/cloud provisioning, additional exact decisions are required:

1. managed-Node, monitoring, DNS/email and other provider/plan selection;
2. monthly cost ceiling and alert/escalation values;
3. exact region and approved subprocessor chain;
4. IAM inventory, privileged Human operators and break-glass ownership;
5. RPO/RTO, backup retention and restore cadence; and
6. legally approved data-class retention/expiry and incident responsibilities.

## 6. Review triggers

Renewed architecture/Human/legal review is required before:

- production or pilot personal data;
- changing provider, region, tenant topology or connection mode;
- adding analytics, session replay, advertising, location or employee scoring;
- adding a new Auth provider or identity-linking behavior;
- accepting raw/free-form Product data into logs or support tools;
- implementing irreversible deletion/anonymization or legal hold;
- changing backup region/retention/restore behavior;
- public endpoints, production deployment, production signing or distribution; or
- accepting costs beyond an exact approved ceiling.
