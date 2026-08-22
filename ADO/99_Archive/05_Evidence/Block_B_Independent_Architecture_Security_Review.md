# Block B Independent Architecture and Security Review

Status: Corrective Actions Verified by Technical Lead — Original Findings Resolved
Review Date: 2026-07-13
Correction Date: 2026-07-13
Technical Lead Verification Date: 2026-07-13
Reviewer: Independent Claude review supplied by the Human Architect
Reviewed Package: proposed ADR-0008, Block B Assessment, Decision Log, Project Status and Risk Register
Corrected Package: `ADO/01_Architecture/ADR/ADR-0008-backend-tenant-isolation-and-async-foundation.md`, `ADO/05_Evidence/Block_B_Backend_Tenant_Async_Architecture_Assessment.md`

## 1. Purpose

This artifact preserves the independent review verdict, findings and TapTim.e dispositions. It is evidence of review and correction, not Human Architect approval. ADR-0008 remains `Proposed` and no backend/async implementation is authorized.

Allowed dispositions in this correction cycle:

- `Accepted`
- `Accepted with Adjustment`

No finding was rejected or deferred.

## 2. Independent Verdict

Original verdict: **CHANGES REQUIRED**.

The reviewer found the main architecture direction sound:

- Supabase-managed PostgreSQL + Supabase Auth + a thin backend API is a viable and recommended direction.
- PostgreSQL constraints, transactions and RLS fit the Organization-scoped relational model better than the evaluated document-store alternative.
- AWS/Auth0 alternatives add disproportionate complexity for the current two-role/team scope.
- The existing Domain/Business architecture does not need a rewrite.
- The vertical-slice async migration and prohibition of `T | Promise<T>` are appropriate.

The reviewer required correction before Human Architect approval because privacy/immutability, device time, Membership revocation, identity linking and transaction/pooling consequences were incomplete.

## 3. Findings and Dispositions

### P0-1 — GDPR erasure versus immutable WorkEvent/audit evidence

Review finding: WorkEvents, decisions and audit events were described as immutable/append-only without resolving personal-data erasure, retention and backup copies.

Disposition: **Accepted**.

Correction:

- Append-only is limited to the approved operational/legal retention period and normal application mutation.
- A per-class purpose/legal-basis/retention schedule is now mandatory before production.
- Physical deletion, genuine anonymization, pseudonymization/restricted retention and legal holds are distinguished.
- Pseudonymized data is expressly still personal data and is not assumed to fulfill an erasure request.
- Backups/restore copies require retention, region, encryption and deletion/restriction replay.
- Exact Work/Time record periods require legal and Human Architect approval; indefinite retention is prohibited.

Traceability: ADR-0008 `Privacy, Retention and Immutability Decision Boundary`; Assessment Sections 10.3, 13, 14 and 16.

### P1-1 — Untrusted device time / missing clock-skew policy

Review finding: device `occurredAt` can manipulate derived working time; a tolerance and escalation policy was missing. The review suggested a maximum absolute `|occurredAt - receivedAt|` deviation.

Disposition: **Accepted with Adjustment**.

Adjustment rationale: a single absolute-difference threshold cannot distinguish clock manipulation from legitimate multi-day offline synchronization. Treating it as a rejection rule would contradict ADR-0004's offline-first requirement.

Correction:

- `occurredAt` is untrusted evidence; `receivedAt` is separate trusted receipt time.
- Clock skew, backwards time, unusual duration, long offline delay, multi-device ordering and historical validity are separate signals.
- Absolute delay alone does not decide acceptance.
- Suspicious cases escalate/quarantine without silently changing TimeEntry state.
- Concrete tolerances and review outcomes remain Human Architect decisions.

Traceability: ADR-0008 `Clock and Offline Anomaly Policy`; Assessment Sections 10.4, 13, 14 and 16.

### P1-2 — Membership revocation can lose legitimate offline work

Review finding: rejecting all revoked Membership requests before examining WorkEvent evidence implicitly discards scans captured before revocation.

Disposition: **Accepted**.

Correction:

- Ordinary tenant access still ends at revocation.
- A restricted sync-ingestion path can handle alleged pre-revocation evidence without granting ordinary access.
- Grace window, administrative review and categorical rejection are explicit options.
- `occurredAt < revokedAt` is insufficient by itself because device time can be manipulated.
- Historical Membership/Assignment validity and other clock evidence are required.
- Human Architect must choose the product behavior and durations.

Traceability: ADR-0008 `Membership Revocation and Offline Evidence`; Assessment Sections 8.2, 10.5 and 14.

### P1-3 — Edge Functions, pooling and advisory-lock semantics

Review finding: the original Edge-first compute recommendation did not address Supavisor session/transaction pooling, prepared statements or advisory lock behavior.

Disposition: **Accepted with Adjustment**.

Adjustment rationale: the corrected architecture goes beyond merely adding pooling to the spike. Managed Node is now the preferred primary transactional runtime. Edge Functions are narrow-task infrastructure unless the complete lifecycle spike proves suitability.

Correction:

- Managed persistent Node.js is the primary lifecycle runtime recommendation.
- Direct connection or Supavisor session mode is preferred for persistent backend traffic as deployment networking permits.
- Edge lifecycle use requires proof of real multi-table transaction and rollback, Core import, JWT/RLS context, connection reuse, pool exhaustion and no context leakage.
- Supavisor transaction mode's lack of prepared-statement support must be tested with driver preparation disabled.
- Only row locks or `pg_advisory_xact_lock` inside the same transaction are allowed.
- Session advisory locks are prohibited.
- Tenant/JWT variables must be transaction-local and leak-tested across reused connections.

Traceability: ADR-0008 Proposed Decision 3 and `Compute, Transactions, Pooling and Locks`; Assessment Sections 10.6, 11.5, 12.2, 13 and 16.

### P1-4 — Account linking and identity confusion

Review finding: provider-neutral identity binding was sound, but multi-provider linking behavior and unverified email takeover risk were not addressed.

Disposition: **Accepted**.

Correction:

- Supabase Auth's current automatic same-verified-email identity linking and safeguards are documented from official sources.
- V1 recommends one controlled login method.
- Additional providers/linking require explicit Human Architect approval and security review.
- No custom email-equality linking/merging is allowed.
- Provider-documented verified linking or authenticated explicit linking is required.
- Link/unlink changes are audited.

Traceability: ADR-0008 `Identity Linking and Provisioning`; Assessment Section 9.1 and Human Architect decisions.

### P2-1 — Canonical `content_hash` unspecified

Disposition: **Accepted**.

Correction: v1 hash fields, allowlist, fixed field order, UTF-8 encoding, UTC millisecond timestamp normalization, algorithm/version storage and cross-runtime test vectors are required.

Traceability: ADR-0008 Server Persistence Principles; Assessment `work_events` schema and acceptance gates.

### P2-2 — Local versus server TimeEntry IDs

Disposition: **Accepted**.

Correction: reconciliation is explicitly defined through `WorkEventId -> sync_receipt -> canonical decision -> server TimeEntryId`; receipts carry local/server IDs where applicable and silent identity replacement is prohibited.

Traceability: ADR-0008 Server Persistence Principles; Assessment `sync_receipts` schema.

### P2-3 — Multi-device and concurrent scans not explicit in tests

Disposition: **Accepted**.

Correction: same-User multi-device ordering, same/different target concurrency, different-User independence and no-second-active-entry cases are mandatory.

Traceability: Assessment Sections 8.4 and 16.

### P2-4 — Identity-binding provisioning moment / unregistered invitation

Disposition: **Accepted**.

Correction: identity-first, pending-invitation and reserved-inactive-User flows are documented as options. User, identity binding and Membership activation timing is a Human Architect decision; pending invitation never grants access.

Traceability: ADR-0008 `Identity Linking and Provisioning`; Assessment Sections 9.3, `users`/`identity_bindings` schema and 14.

### P2-5 — Token expiry and refresh failure during offline sync

Disposition: **Accepted**.

Correction: tests must cover expiry before and during a batch, failed refresh, no false synchronized state and idempotent resume after re-authentication.

Traceability: Assessment Sections 8.4 and 16.

### P2-6 — Backup encryption, residency and restore evidence

Disposition: **Accepted**.

Correction: backup encryption, region, rolling retention, off-site copy inventory, quarterly initial restore testing and post-restore deletion/revocation replay are required.

Traceability: ADR-0008 privacy boundary and Server Persistence Principles; Assessment Sections 10.3, 13, 14 and 16.

### P2-7 — RLS performance and safe security-definer helpers

Disposition: **Accepted**.

Correction: RLS predicate indexes, representative query plans, measured `(select auth.uid())`-style patterns and safe exceptional `SECURITY DEFINER` rules are required. Trusted fixed `search_path`, `pg_temp` last, schema qualification, revoked `PUBLIC` execute and least-privilege grants are explicit.

Traceability: Assessment Sections 8.3, 15 and 16.

## 4. Additional Correction Required by the Human Architect Prompt

Beyond the review's literal findings, the correction request required and the package now includes:

- explicit historical Assignment and Membership validity checks for delayed WorkEvents;
- separate handling of long offline delay versus clock skew;
- backup restore-copy handling for erasure/restriction;
- canonical hash schema fields and version;
- explicit local/server TimeEntry mapping fields;
- connection-context leakage tests;
- corrected Risk Register status for the previously open automated-test risk.

## 5. Remaining Decision State

All findings are incorporated, but several corrected areas intentionally remain product decisions. This review artifact does not choose:

- legal retention periods or lawful bases;
- deletion versus genuine anonymization versus legally required restricted retention;
- clock/offline tolerances;
- pre-revocation sync grace/review/rejection behavior;
- v1 login method or future linking methods;
- invitation/User/identity/Membership provisioning order;
- provider, pooled-tenancy or conflict product decisions already listed in ADR-0008.

## 6. Official Primary Sources Used for Disposition Verification

Accessed 2026-07-13:

- [EUR-Lex: GDPR Article 17](https://eur-lex.europa.eu/eli/reg/2016/679/art_17/oj/eng)
- [European Data Protection Board: anonymisation/pseudonymisation](https://www.edpb.europa.eu/topics/ai-and-technology/anonymisationpseudonymisation_en)
- [Supabase Auth identity linking](https://supabase.com/docs/guides/auth/auth-identity-linking)
- [Supabase database connection modes and Supavisor](https://supabase.com/docs/guides/database/connecting-to-postgres)
- [Supabase database backups](https://supabase.com/docs/guides/platform/backups)
- [Supabase regions](https://supabase.com/docs/guides/platform/regions)
- [PostgreSQL advisory locks](https://www.postgresql.org/docs/current/explicit-locking.html)
- [PostgreSQL safe `SECURITY DEFINER` functions](https://www.postgresql.org/docs/current/sql-createfunction.html)

## 7. Handover

Corrected status: **Technical Lead verification complete; decision package ready for Human Architect disposition**.

ADR-0008 remains `Proposed`. No Human Architect approval, provider commitment, dependency change, backend implementation, async migration, commit or push is represented by this evidence.
