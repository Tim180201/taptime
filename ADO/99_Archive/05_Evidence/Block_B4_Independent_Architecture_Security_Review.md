# Block B4 Independent Architecture and Security Review

Status: Approved — No Blocking Findings
Review Date: 2026-07-13
Reviewer: Independent Claude review supplied by the Human Architect
Reviewed Branch: `main`
Reviewed Base Commit: `13fd1c9`
Implementation Commit: `570fc0b`
Approval Authorities: Independent Security Reviewer and Technical Lead

## 1. Scope and Provenance

The independent reviewer verified that the complete B4 implementation was an uncommitted worktree diff on base commit `13fd1c9`. The review covered `AGENTS.md`, ADR-0008, the B4 plan/evidence, migration `004`, every backend-identity source/test/configuration file, the B3 fixture and security-test changes, CI workflow and dependency metadata. Migrations `001`–`003` were confirmed unchanged.

The review environment could not run PostgreSQL, Docker, tests or GitHub Actions. It independently counted the test structures as exactly 54 B4 and 125 B3 cases and performed complete adversarial static analysis. Technical Lead execution on PostgreSQL 17.10 and GitHub Actions run `29261459523` compensate for the independent environment's runtime limitation.

## 2. Independent Verdict

Verdict: **APPROVED**.

No blocking P0/P1 defect was found. B4 may be closed. This approval does not itself authorize B5.

## 3. Confirmed Security Claims

The independent review confirmed that:

- only RS256/ES256 are accepted and both header pre-check plus `jwtVerify` prevent algorithm confusion;
- issuer, audience, required Supabase claims, expiration and optional not-before are validated;
- JWKS is fixed to `<issuer>/.well-known/jwks.json`; HTTPS is mandatory outside numeric `127.0.0.0/8` and `::1` test loopback;
- only configured issuer plus verified subject leave the verifier;
- server IdentityBinding and current active Membership alone determine User, Organization and role;
- unknown, revoked and incomplete authority returns one disclosure-safe result;
- token/body User, tenant, Organization, role and TimeEntry claims cannot elevate or redirect authority;
- migration `004` normalizes a contaminated resolver role, removes all parent roles and grants only schema usage plus execution of the dedicated fixed-path resolver function;
- direct table, unrelated function, DDL and post-`RESET ROLE` access are denied;
- role and request settings are transaction-local and cleaned after commit/rollback;
- B4 adds no HTTP, cloud, Mobile, B5, B6 or CanonicalDecision path.

## 4. Non-Blocking Findings and Dispositions

### P2-1 — Structural RequestActorContext construction

Observation: a future caller could structurally construct a matching TypeScript object and call the context-propagation helper without using the authoritative resolution service.

Disposition: **Accepted as a mandatory B5 boundary gate.** B5 must use a nominal/opaque actor context or an equivalent cohesive API that prevents unverified data from becoming database authority. The current helper is explicitly documented as propagation-only and is not used for B5 in this slice.

### P2-2 — Resolver single-row guarantee

Observation: `ROWS 1` is a planner hint, not a database guarantee.

Disposition: **Accepted with no B4 change.** Migration 001 already enforces unique `(issuer, subject)` and one active Membership per User. The adapter additionally throws when more than one row is returned.

## 5. Confirmed Open Gates

Production API/adapters, B5 tenant transactions, B6 lifecycle ingestion, Supavisor modes, cloud key rotation/network failure behavior, real Auth provisioning, privacy retention/deletion/backups, NFC security/physical validation, monitoring, load/performance and production data remain explicitly open.

## 6. Closure Recommendation

Close B4. Consider B5 separately as the narrow read-only Organization/config adapter slice, with active Membership re-validation, a restricted database role, RLS and nominal request-authority provenance as mandatory acceptance gates.
