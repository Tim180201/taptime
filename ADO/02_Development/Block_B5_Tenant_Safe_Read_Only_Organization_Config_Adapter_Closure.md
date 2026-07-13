# Block B5 — Tenant-safe Read-only Organization/Config Adapter Closure

Status: Completed — Technical Lead, GitHub CI and Independent Security Approved
Date: 2026-07-13
Owner: Technical Lead
Human Architect: Independent review supplied; B6 subsequently authorized separately

## 1. Closed Scope

Block B5 delivered the narrow read-only Organization/configuration adapter slice defined by
ADR-0008. The isolated `@taptime/backend-read-model` workspace verifies a raw access token with the
approved B4 verifier, resolves current database authority in the same `READ COMMITTED READ ONLY`
transaction, selects one fixed restricted application role and exposes exactly five tenant-scoped
Core-port projections under B3 RLS.

The slice adds no write adapter, HTTP/API route, cloud resource, production data, Mobile
integration, B6 lifecycle ingestion, migration or Business Rule. Migrations `001`–`004`, Core and
product behavior remain unchanged.

## 2. Review History

The Technical Lead attack review found one blocking capability-lifetime defect before publication:
a retained repository closure could still reference a released and later re-leased `pg` client.
The implementation now expires all reader capabilities as soon as the callback settles and proves
both commit and rollback escape paths with dedicated tests. The review also corrected an inaccurate
claim about B4 JWKS/network failures: B5 preserves B4's typed verifier taxonomy rather than
reclassifying those outcomes as thrown infrastructure errors.

The independent Claude architecture/security review returned **APPROVED** with no P0/P1 findings.
Its three P2 observations are dispositioned in
`ADO/05_Evidence/Block_B5_Independent_Architecture_Security_Review.md`.

## 3. Published Evidence

- Implementation commit: `68b7f44`
- GitHub Actions implementation run: `29264083804` — passed
- GitHub jobs: Core/Mobile quality, B1 PostgreSQL, B3 schema security, B4 identity security and B5
  tenant-safe read model — all passed
- Local B5 adversarial matrix: 41 passed
- Local B4 regression: 54 passed
- Local B3 regression: 125 passed
- Local Core: 262 passed
- Local Mobile: 10 passed
- Local B1: 39 passed, 2 Supavisor modes skipped as explicit pre-production gates
- Clean-install Node 24 B5 typecheck/test/build and `git diff --check` passed
- Migrations `001`–`004` and Core Domain/Business/ports remain unchanged

## 4. Independent P2 Disposition

- The stale Project Status `39-test` reference is corrected to 41.
- The Organization root query now explains why both resolved and requested IDs constrain the same
  root `id` column; behavior is unchanged.
- B4 structural-context risk is closed for B5 by the cohesive coordinator and frozen, expiring
  reader surface. B6 must preserve the same authority provenance for every write.

## 5. Remaining Gates

Supavisor modes, production API/adapters and real Supabase resources, Auth provisioning,
retention/deletion/backups, device-time/offline/revocation policy, NFC payload security and physical
validation, monitoring, load/performance and production personal data remain gated.

## 6. Next Slice

B6 was not authorized by this closure. The Human Architect subsequently authorized the separate,
narrow scope in `Block_B6_Server_Canonical_Lifecycle_Ingestion_Authorization.md`. Its mandatory
trust rule is that every CanonicalDecision comes only from the genuine server-side
`BusinessEngine.evaluate()` result; client-supplied decision, TimeEntry transition or authority
fields may never become server truth.
