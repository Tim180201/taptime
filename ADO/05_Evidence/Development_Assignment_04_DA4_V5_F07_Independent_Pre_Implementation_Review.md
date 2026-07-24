# Development Assignment 4 — DA4-V5-F07 Independent Pre-Implementation Review

- Verdict: **APPROVED**
- Open findings: **none (P0–P3)**
- Date: 2026-07-24
- Baseline: `1140cc441b958d701a899a74924eac4cc41fefeb`
- Baseline tree: `7a34423528b4a23753da8bc679eb5aee077dfa1d`
- Reviewed candidate: `7d8cee690af7fcd5c2f13b54f81b7ddc2ec2b736`
- Reviewed candidate tree: `f445d3c3151dd966f0a9ea9ab01b73b2c0c06441`
- Exact-head CI: `30090502331`, attempt 2, 12/12 successful

## Independent result

The read-only reviewer independently confirmed:

- candidate, tree, parent, `main` and `origin/main` bindings;
- the exact five-file ADO-only `+163/-4` delta and clean whitespace/scope checks;
- Migration 008's exact 15-minute invitation lifetime and active predicate of unconsumed plus
  `expires_at > transaction_timestamp()`;
- the current Harness limitation: status counts only active invitations and the write plan
  requires that count to remain one after the immediate creation checkpoint;
- the F07 correction contract's mutually exclusive active or expired-unconsumed later state;
- preservation of the immediate active checkpoint, every other exact write delta, permanent
  mismatch failure, disclosure boundary and all scope exclusions; and
- AVS R0/V0 for this candidate and R3 V0–V4 plus a separately authorized V5 for implementation.

CI attempt 1 passed all 121 tests in its only red job, then Vitest observed one PostgreSQL `57P01`
connection termination during disposable-database teardown. No executable input changed in the
candidate. The unchanged failed job was rerun once; attempt 2 completed all 12/12 jobs
successfully. The reviewer accepted this as an isolated teardown event, not a candidate finding.

`research/` and unrelated `app.json` remained explicitly excluded and untouched.

## Authority boundary

Under the repository standing rule, the exact F07 implementation scope may now proceed without
another confirmation prompt. It remains limited to the Synthetic DA4-V5 status/write invariant,
direct regressions, runbook/evidence synchronization and AVS V0–V4 with an independent Exact-SHA
implementation review.

No Human V5, retry/reuse of H03 evidence, Product-TTL change, production, production-data,
deployment or distribution action is authorized.
