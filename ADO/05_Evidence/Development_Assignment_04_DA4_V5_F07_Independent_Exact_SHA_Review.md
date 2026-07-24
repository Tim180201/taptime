# Development Assignment 4 — DA4-V5-F07 Independent Exact-SHA Review

- Verdict: **APPROVED**
- Open findings: **none (P0–P3)**
- Date: 2026-07-24
- Exact baseline: `4b376043cbcd5739e6d32e562dd917159f86275b`
- Baseline tree: `60a3d181470dde8abc4059e36d4879ced1fbc138`
- Exact implementation: `60b8f1a3d9b9ec1275b004340dbb61a017a0b90e`
- Implementation tree: `7ab9643610c8af7d814044186cd9351b02fab808`
- Exact-head CI: `30092933085`, attempt 2, 12/12 successful

## Independent result

The read-only reviewer independently confirmed:

- exact parent, commit, tree, `main`, `origin/main` and nine-file `+419/-26` bindings;
- no Product, schema/migration, Backend API, Admin Web, Mobile, dependency, lockfile or workflow
  delta;
- one PostgreSQL-statement classification of unconsumed invitations into mutually exclusive
  active and expired-unconsumed counts at one transaction timestamp;
- exact immediate-active creation proof and a monotonic active-to-expired session latch;
- permanent fail-closed rejection of active reversion, missing, consumed, duplicate,
  unclassified or inconsistent state while every non-invitation aggregate remains exact;
- direct unit and disposable-PostgreSQL regressions, disclosure safety, tenant boundaries and
  cleanup truth; and
- exact-head CI attempt 2 at 12/12. Attempt 1 passed all 189 C3B assertions and failed only on a
  PostgreSQL `57P01` disposable-database teardown event; the unchanged failed job was rerun once.

No P0, P1, P2 or P3 finding remains open. `research/` and unrelated `app.json` were explicitly
excluded and untouched.

## Authority boundary

This approval validates only the exact DA4-V5-F07 implementation. It does not reuse or repair the
failed H03 run and does not authorize a new Human Browser Gate. Any fresh DA4 V5 remains separately
exact-bound and Human-authorized. Production, production data, deployment and distribution remain
unauthorized.
