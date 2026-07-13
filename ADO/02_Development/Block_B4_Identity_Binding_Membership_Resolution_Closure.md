# Block B4 — Identity Binding and Authoritative Membership Resolution Closure

Status: Completed — Technical Lead, GitHub CI and Independent Security Approved
Date: 2026-07-13
Owner: Technical Lead
Human Architect: Approval supplied through the continuing Block B execution mandate

## 1. Closed Scope

Block B4 delivered the narrow authenticated identity boundary defined by ADR-0008: asymmetric Supabase-shaped JWT verification yields only exact issuer and subject; a least-privilege PostgreSQL resolver maps those values through a current, non-revoked IdentityBinding and Membership to the authoritative TapTim.e User, Organization and role.

The slice adds migration `004`, the isolated `@taptime/backend-identity` workspace and an isolated PostgreSQL 17 CI job. It does not add HTTP endpoints, cloud resources, real users or data, Mobile integration, B5 repository adapters, B6 lifecycle ingestion or CanonicalDecision persistence.

## 2. Review History

Technical Lead attack rounds corrected:

1. B3 synthetic-login role contamination, pre-existing resolver-role attributes and parent-role membership;
2. issuer/JWKS trust-anchor binding and explicit separation of context propagation from authorization;
3. fail-closed HTTPS enforcement outside numeric IPv4/IPv6 loopback test infrastructure.

The independent Claude architecture/security review returned **APPROVED** with no P0/P1 findings. Its disposition is recorded in `ADO/05_Evidence/Block_B4_Independent_Architecture_Security_Review.md`.

## 3. Published Evidence

- Implementation commit: `570fc0b`
- GitHub Actions implementation run: `29261459523` — passed
- GitHub jobs: Core/Mobile quality, B1 PostgreSQL, B3 PostgreSQL schema security and B4 identity/Membership security — all passed
- Local B4 adversarial matrix: 54 passed
- Local B3 matrix after contamination hardening: 125 passed
- Local Core: 262 passed
- Local Mobile: 10 passed
- Local B1 regression: 39 passed, 2 Supavisor modes skipped as explicit pre-production gates
- `npm ci`, tests-inclusive TypeScript checks, migration ledger verification, builds and `git diff --check` passed
- Migrations `001`–`003` remain unchanged

## 4. Independent P2 Disposition

- `RequestActorContext` remains structurally constructible in TypeScript. B5 must prevent unverified construction from becoming authority by using a nominal/opaque context or an equivalent cohesive resolution-to-transaction boundary.
- Resolver uniqueness depends correctly on B3's `identity_bindings_issuer_subject_unique` and `memberships_one_active_per_user` constraints; the PostgreSQL adapter also rejects more than one returned row defensively. No additional B4 change is required.
- B3's carried trust rule remains mandatory for B6: every CanonicalDecision must come from the genuine server-side `BusinessEngine.evaluate()` result, never client fields.

## 5. Remaining Gates

Supavisor modes, production API/adapters, real Supabase resources and Auth provisioning, retention/deletion/backups, device-time/offline/revocation policy, NFC payload security and physical validation, monitoring, load/performance and production personal data remain gated.

## 6. Next Authorized Slice

The Human Architect explicitly authorized B5 after this closure on 2026-07-13. B5 is limited to the narrow read-only Organization/config repository-adapter slice from the approved Block B sequence. It must re-check active Membership in the actual tenant transaction, select only the restricted runtime role, enforce RLS, expose no unscoped query and prove cross-tenant denial. B5 must not add writes, HTTP, cloud resources or B6 lifecycle ingestion.
