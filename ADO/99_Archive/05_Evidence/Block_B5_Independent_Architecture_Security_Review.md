# Block B5 Independent Architecture and Security Review

Status: Approved — No Blocking Findings
Review Date: 2026-07-13
Reviewer: Independent Claude review supplied by the Human Architect
Reviewed Branch: `main`
Reviewed Base Commit: `5e65e16`
Implementation Commit: `68b7f44`
Approval Authorities: Independent Security Reviewer and Technical Lead

## 1. Scope and Provenance

The independent reviewer verified a clean worktree at implementation commit `68b7f44`, exactly one
commit ahead of base `5e65e16`. The complete 18-file diff, `AGENTS.md`, ADR-0008, B5 plan and
evidence, every backend-read-model source/test/configuration file, the relevant B3 RLS policies,
the B4 JWT verifier, CI workflow and lockfile changes were reviewed. Core, Mobile, B1, B3
migrations and B4 identity sources were confirmed unchanged.

The independent environment could not execute PostgreSQL, Docker or GitHub Actions. It statically
counted all 41 B5 cases and performed adversarial analysis. Technical Lead execution on PostgreSQL
17.10 and GitHub Actions run `29264083804` compensate for that runtime limitation.

## 2. Independent Verdict

Verdict: **APPROVED**.

No P0/P1 defect was found. The reviewer found no concrete path that violates tenant isolation,
authority provenance, transaction/role hygiene or disclosure safety. B5 may be closed. This
approval does not authorize B6.

## 3. Confirmed Security Claims

The independent review confirmed that:

- every reader is scoped by the server-resolved Organization plus its requested business key;
- B4 JWT verification and the database resolver, not request/token role or tenant claims, establish
  current User, Membership, Organization and role authority;
- requested-Organization comparison completes before repository construction;
- role selection uses only fixed Employee/Administrator literals and actor GUCs are transaction
  local;
- `READ COMMITTED` plus B3 RLS observes concurrent Membership downgrade and revocation;
- the runtime login is non-owner, `NOINHERIT`, cannot bypass RLS or select the lifecycle role, and
  has no direct table access before application-role selection or after `RESET ROLE`;
- all SQL values are parameterized and guessed foreign identifiers remain indistinguishable from
  missing local rows;
- repository capabilities expire when the callback settles, before commit/rollback and pool-client
  release, preventing use through a later pool lease;
- authorization outcomes are disclosure-safe while callback/database infrastructure failures stay
  exceptional;
- B5 adds no writes, HTTP, B6 path, migration, Core behavior or productive cloud resource.

## 4. Non-Blocking Findings and Dispositions

### P2-1 — Stale test count in Project Status

Observation: `Immediate Next Steps` still called the B5 matrix a 39-test matrix although the suite
contains 41 cases and every other current artifact reported 41.

Disposition: **Corrected in the B5 closure change.** The stale count now reads 41.

### P2-2 — Organization root query readability

Observation: `organization.findById` intentionally compares the root `organizations.id` against
both the resolved and requested IDs because the tenant-root table has no `organization_id` column.
The intent was correct but less obvious than the other four queries.

Disposition: **Clarified in code.** A short comment records the root-table reason; query behavior is
unchanged.

### P2-3 — Structural authority carry-forward

Observation: B4's structurally constructible TypeScript context remains relevant to future write
work.

Disposition: **Closed for B5 and carried to B6.** B5 exposes only frozen, expiring reader
capabilities and no actor, role selector, Pool or PoolClient. B6 must retain this cohesive
resolution-to-transaction boundary and must not accept structurally supplied authority.

## 5. Confirmed Open Gates

B6 lifecycle ingestion, production API/cloud/Auth provisioning, Supavisor modes, privacy
retention/deletion/backups, NFC payload security and physical-device validation, observability,
load/performance and production personal data remain explicitly gated.

## 6. Closure Recommendation

Close B5 after recording GitHub Actions run `29264083804` and the P2 dispositions above. Keep B6
unauthorized until the Human Architect explicitly approves its narrow scope. Any B6
CanonicalDecision must be derived only from the genuine server-side `BusinessEngine.evaluate()`
result, never from client-supplied decision fields.
