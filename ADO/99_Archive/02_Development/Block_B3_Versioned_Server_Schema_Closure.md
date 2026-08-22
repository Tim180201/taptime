# Block B3 — Versioned Server Schema, Constraints and RLS Closure

Status: Completed — Technical Lead and Independent Security Approved
Date: 2026-07-13
Owner: Technical Lead
Human Architect: Approval supplied through the continuing Block B execution mandate

## 1. Closed Scope

Block B3 delivered an isolated `@taptime/backend-schema` workspace with three deterministic PostgreSQL 17 migrations, checksum/version ledger, twelve logical tables, composite tenant/User/target integrity, five truthful Core Decision shapes, reciprocal TimeEntry/Decision traceability, SyncReceipt shapes, active-Membership mutation gates, least-privilege grants, forced RLS, atomic administrative audit evidence and a 124-test two-tenant security matrix.

It did not add a production API, Auth integration, cloud resource, repository adapter, Mobile integration or production data.

## 2. Review History

Three Technical Lead attack rounds corrected:

1. lifecycle authorization, tenant/User-qualified references, audit atomicity, immutable attempts and test-harness role isolation;
2. truthful five-way Decision mappings, reciprocal lifecycle links and SyncReceipt status/result integrity;
3. exact `started_at`/`stopped_at` binding to the corresponding WorkEvent instant.

The independent Claude architecture/security review returned **APPROVED** with no blocking findings. Its complete disposition is recorded in `ADO/05_Evidence/Block_B3_Independent_Architecture_Security_Review.md`.

## 3. Published Evidence

- Implementation commit: `903917c`
- Technical Lead approval documentation: `9dd98d6`
- GitHub Actions implementation run: `29243934150` — passed
- GitHub Actions approval-documentation run: `29244042186` — passed
- Local B3 matrix: 124 passed
- Local Core: 262 passed
- Local Mobile: 10 passed
- Local B1 regression: 39 passed, 2 Supavisor modes skipped as explicit pre-production gates
- Both Technical Lead timestamp attacks rejected with PostgreSQL `23514`
- Working tree and `origin/main` matched at approval handoff

## 4. Independent P2 Disposition

- Server Decisions must be derived only from server-side `BusinessEngine.evaluate()`; no client Decision fields become authoritative.
- Optional synchronized Receipt TimeEntry mapping is deferred to the typed B6 reconciliation contract.
- Two additional direct-trigger-execution negative tests are optional defense-in-depth hardening, not a B3 blocker.
- Productive administration must use the exact restricted role and prove fail-closed atomic auditing before that path is called complete.

## 5. Remaining Gates

Supavisor mode validation, productive Auth/API/adapters, retention/deletion/backups, device-time/offline/revocation policy, NFC security, load/performance, monitoring and production data remain gated exactly as documented by ADR-0008 and the Block B assessment.

## 6. Next Authorized Slice

B4 is authorized as a narrow identity-binding plus current-Membership-resolution server slice. Its exit evidence is that a verified provider identity cannot cross or escalate tenant, User, Organization or Membership role. B4 must not implement B5 repository expansion or B6 WorkEvent lifecycle ingestion.
