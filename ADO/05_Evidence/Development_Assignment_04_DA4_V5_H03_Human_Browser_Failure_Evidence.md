# Development Assignment 4 — DA4-V5-H03 Human Browser Failure Evidence

- Status: **FAILED CLOSED — AUTHORITY CONSUMED; F07 CANDIDATE REVIEW REQUIRED**
- Date: 2026-07-24
- Owner: Technical Lead
- Finding: `DA4-V5-F07`, P2, Human-gate invariant/reliability

## 1. Exact boundary

The one-time fresh run used the exact Product, enablement, prior failure synchronization,
DA4-V5-F06 correction/review and Admin-Web artifact bindings explicitly authorized by the Human
Architect. The current repository head was
`1140cc441b958d701a899a74924eac4cc41fefeb`, tree
`7a34423528b4a23753da8bc679eb5aee077dfa1d`, with exact-head CI `30085506578`,
attempt 1, 12/12. Preflight independently matched every authorized commit/tree/CI and artifact
binding.

## 2. Passed observations

- The exact Harness fixture started at Customers `21`, Employees `21`, TimeRecords `101`,
  unresolved reviews `101`, one Tag, Assignment history `1`/active `1`, active invitations `0`
  and general AuditEvents `101`.
- Safari passed its 320-pixel, 768-pixel at 200%, desktop keyboard, navigation, pagination,
  retry and `Europe/Berlin` checks.
- Customer creation, invitation creation including one-time secret destruction, and Tag
  reassignment each displayed the exact required UI success and passed the required Human
  handshake plus Harness checkpoint.
- After Safari the safe state included Customers `22`, one invitation receipt, Assignment history
  `2`/active `1`, one reassignment receipt and general AuditEvents `105`.
- Chrome passed its 320-pixel, 768-pixel at 200%, desktop keyboard/navigation, timezone and full
  Safari-state checks. An accidental second read-only “Alle Bereiche aktualisieren” action caused
  no receipt, AuditEvent or write-plan delta.

## 3. Fail-closed stop

Before the first Chrome write, read-only status reported active invitations `0` instead of the
runbook's fixed later expectation `1`. The invitation receipt and its AuditEvent remained exactly
present and unchanged; no Chrome write or irreversible Chrome checkpoint was sent.

Migration 008 fixes invitation lifetime at 15 minutes. The observed transition is therefore
consistent with natural expiry during the longer Human browser matrix. It proves a gate-invariant
defect, not a Product, security or data-integrity defect. The current Harness cannot validly
distinguish that accepted expiry from a missing or consumed invitation, so the run could not
continue.

The gate is failed, its one-time authority is consumed and none of its observations may be reused.
`DA4-V5-F07` is a P2 operational/gate-reliability finding.

## 4. Cleanup and next boundary

The Harness stopped normally and reported `da4_v5_stopped`. Credential state was destroyed and
the clipboard was cleared. Ports `54321`, `3000` and `5173` were free; disposable schema,
migration ledger and generated runtime roles were zero; no matching CSV remained. The tracked
worktree was clean with the mandatory protected-path exclusions; unrelated untracked
`app.json` was preserved and not read.

The focused ADO-only F07 candidate preserves the Product TTL and proposes a disclosure-safe,
time-aware gate invariant. Independent pre-implementation review is required. No executable
correction, new Human V5, production, production data, deployment or distribution is authorized
by this evidence.
