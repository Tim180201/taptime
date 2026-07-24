# Development Assignment 4 — DA4-V5-F06 Independent Exact-SHA Review

- Status: **APPROVED — ZERO OPEN P0–P3 REVIEW FINDINGS**
- Date: 2026-07-24
- Owner: Independent Review Agent
- Scope: focused DA4-V5 AuditEvent-invariant correction

## 1. Exact review binding

The independent read-only review bound:

- baseline `c6c980120e882bda709118f65da12454f636207d`, tree
  `5b78e03569b358bbfdad675a93cc21b646cd4f86`;
- candidate `d0db46f8bd2081a357bc92395507c1978cca27ba`, tree
  `9f31c78138204f79ffc5db632b01ff5ef89c1b0a`;
- exact eight-file delta `+178/-22`;
- `origin/main` exactly at the candidate; and
- exact-head GitHub Actions run `30085075057`, attempt 1, 12/12 successful.

The tracked worktree outside the expressly excluded protected paths was clean before and after
focused verification. `research/` and the protected untracked user file `app.json` were excluded
from worktree queries and were neither read nor changed.

## 2. Authority and scope

The reviewed R3 correction is limited to:

- changing the Harness expectation for one real reassignment from `auditEvents +1` to `+2`;
- changing the final six-operation invariant from `initial +6` to `initial +7`;
- direct regression tests including permanent fail-closed behavior; and
- minimal status, runbook and Evidence synchronization.

The delta contains six ADO files, `Da4V5OperationSession.ts` and `Da4V5Profile.test.ts`.
Product code, schema, migrations, dependencies, lockfile, workflow, Admin Web and Mobile remain
unchanged. Human V5, production, production data, deployment and distribution are neither
executed nor claimed.

## 3. Independent correctness review

The corrected invariant matches the unchanged Repository truth:

- migration 009 emits `NfcAssignmentDeactivated` for the old-row UPDATE and `NfcTagAssigned` for
  the successor INSERT;
- receipt integrity requires exactly one correlated event of each type;
- the coordinator performs the UPDATE followed by the INSERT;
- the authoritative PostgreSQL test expects two AuditEvents, one of each type; and
- the accepted C3E2 authorization requires the same pair.

The unchanged operation deltas are Customer `+1`, invitation `+1`, correction `+1`, export `+1`
and adjudication `+1`. Together with reassignment `+2`, the final total is seven general
AuditEvents. `TimeEntryExportGenerated` remains one already-counted general event and is not
double-counted.

The added tests independently cover the full six-step sequence, reassignment exactly `+2`, final
`initial +7`, rejection of the stale one-event expectation and the permanent mismatch latch.

## 4. Verification

The review independently confirmed:

- `git diff --check` and exact eight-file scope;
- focused DA4-V5 tests 31/31;
- exact-head Synthetic Harness 80/80 with tests-inclusive typecheck and build;
- exact-head authoritative C3E2 reassignment tests 19/19 and complete job 121/121;
- exact-head CI 12/12;
- documented V3 with 1,827 tests, two optional B1 Supavisor skips, all 19 tests-inclusive
  typechecks and all 18 applicable builds; and
- documented complete cleanup of temporary Synthetic, B1 and DA3 state.

## 5. Security, tenancy and documentation truth

The correction changes no database, RLS, membership, authentication or tenant boundary. It makes
the operator checkpoint stricter and consistent with the existing tenant-bound transactional
C3E2 truth. Disclosure remains aggregate-only; no IDs, credentials, tokens, raw NFC values or CSV
content are newly exposed.

The operational documents consistently state reassignment `+2`, both event types, final
`initial +7`, export as a subset rather than an eighth event, consumed Human authority and no
authorization for a new Human V5. The historical Pre-Implementation Review explicitly identifies
its contemporaneous six-row assumption and the later F06 correction instead of rewriting history.

## 6. Verdict and remaining boundaries

Verdict: `APPROVED`.

Open review findings: zero P0, P1, P2 or P3.

This review validates only DA4-V5-F06 and does not close DA4. A new Human Browser Gate requires a
separate exact Human authorization. Production, production data, deployment and distribution
remain unauthorized.
