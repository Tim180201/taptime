# Block B6 — Server-canonical Lifecycle Ingestion Closure

Status: Completed — Technical Lead, GitHub CI and Independent Security Approved
Date: 2026-07-13
Owner: Technical Lead
Human Architect: Independent review supplied; no Block C authorization inferred

## 1. Closed scope

Block B6 delivered the authorized non-HTTP, per-WorkEvent managed-Node ingestion boundary in
`@taptime/backend-lifecycle` plus additive migration `005`. Verified current identity/Membership
authority, locked current configuration, transaction-local least privilege, per-User serialization,
active-TimeEntry locking and the unchanged genuine Core `BusinessEngine.evaluate()` now produce one
atomic WorkEvent/TimeEntry/CanonicalDecision/SyncReceipt/Audit mapping.

No HTTP/API, cloud resource, Mobile integration, batch synchronization, historical reconciliation,
new Business Rule, production data or Block C runtime composition was added. Migrations `001`–`004`
and Core/Mobile product behavior remain unchanged.

## 2. Technical Lead review history

The Technical Lead review found and corrected one approval-blocking historical-authority defect
before publication: an active configuration could initially be used even when WorkEvent
`occurredAt` preceded Assignment validity, Tag creation or Customer activation. Migration `005`
now returns all three authoritative start timestamps and the coordinator persists such evidence as
deferred without a Decision, Receipt or TimeEntry. Three direct negative cases cover the boundaries.

After the independent review, a fourth case was added to make the authorized retry semantics
explicit: temporally invalid evidence remains deferred because its fixed event time does not become
historically valid through passage of server time. Automatic later evaluation would be the
historical interpretation expressly excluded by the authorization.

## 3. Published evidence

- Implementation commit: `9531672`
- GitHub Actions implementation run: `29269282536` — all six jobs passed
- Local B6 adversarial matrix after review disposition: 67 passed
- Local B5 regression: 41 passed
- Local B4 regression: 54 passed
- Local B3 regression: 125 passed
- Local B1 regression: 39 passed, 2 Supavisor modes skipped as explicit pre-production gates
- Local Core: 262 passed
- Local Mobile: 10 passed
- Node 24 typechecks/builds, clean lockfile install and `git diff --check`: passed
- Independent architecture/security verdict: `APPROVED`
- Migrations `001`–`004` retain their authorized SHA-256 values

## 4. Independent finding disposition

- The deferred-retry P1 observation is confirmed as intentional authorization behavior, not a
  correctness defect; a dedicated test and explicit evidence now prevent ambiguity.
- Both stale 63-count references are corrected to the final 67-test matrix.
- The disclosed absence of a Tag active/deactivated lifecycle remains a separately gated model
  boundary and is not silently inferred by B6.

Full provenance is recorded in
`ADO/05_Evidence/Block_B6_Independent_Architecture_Security_Review.md`.

## 5. Remaining gates

Supavisor validation, production Auth/API/cloud provisioning, retention/deletion/backups, Tag
lifecycle and NFC payload security, offline/revocation/historical review policy, physical-device
validation, observability, load/performance and production personal data remain gated.

## 6. Next block

Block C is not authorized by this closure. Runtime composition and authentication wiring require a
separate explicit Human Architect authorization with scope, trust boundary, UI/Mobile limits and
verification gates before implementation begins.
