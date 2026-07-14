# Block E2A — Warm-Session Deferred Offline Capture Implementation Plan

Status: Completed — Technical Lead, GitHub CI, Human Physical Android and Independent Security Approved
Date: 2026-07-14
Baseline: `9f2f922fd46e33cb9d53d80e4a7dbedb73653ad1`
Owner: Technical Lead / Codex implementation
Effort: High

## 1. Implementation sequence

1. Complete and record an independent architecture/security review of ADR-0010 and the E2A
   authorization. Stop on any P0/P1/P2 finding. **Completed: APPROVED, P0/P1/P2 = 0; two P3
   implementation observations accepted.**
2. Add the one-slot volatile session-bound scan-context resolver and its complete fail-closed test
   matrix. **Completed locally.**
3. Upgrade only new outbox writes to schema v2 with Membership, expected-Membership and
   submission-mode binding while preserving v1 as protected Membership-unknown evidence.
   **Completed locally.**
4. Add `POST /v1/lifecycle-events/deferred`, a single strict expected-Membership header comparison,
   active-current-configuration gating and the internal server defer-only policy. **Completed
   locally.**
5. Add durable deferred receipts and exact acknowledgement semantics without SQL migration.
   **Completed locally.**
6. Integrate the resolver/mode into the orchestrator, preserve write-before-send and clear only
   exact durable acknowledgement. **Completed locally.**
7. Update German UI copy so offline capture never claims Start/Stop and retained evidence never
   claims server acceptance. **Completed locally.**
8. Run tests-inclusive checks, integration/fault-injection tests, workspace builds, Android export,
   migration guards and diff/security scans. **Completed locally and in all eight jobs of GitHub
   Actions run `29348512506` for exact implementation commit `4b5ecdc`.**
9. Complete the physical Android gate, closure/security evidence and an independent final review.
   **Independent implementation review completed: APPROVED, both P3 findings dispositioned.
   Physical Galaxy A33 / Android 15 validation passed, including controlled C2 transport loss,
   force-stop/restart preservation, exact retry and no deferred TimeEntry mutation. Independent
   final review returned `APPROVED` with no open P0/P1/P2/P3.**
10. Commit and push only after Technical Lead approval; `research/` remains out of scope.
    **Completed for implementation commit `4b5ecdc`; pushed to `main`; `research/` remained
    untracked and untouched.**

## 2. Parallel work boundaries

- Backend stream: ingestion result contract, defer-only route/policy, durable deferred receipt and
  B6/API tests.
- Mobile cache stream: private resolver and exact session/payload fallback tests.
- Mobile reconciliation stream: outbox v2, orchestrator, transport parsing, UI and composition tests.
- Governance stream: ADR/spec/status/evidence updates and final claim audit.

Each stream owns disjoint files where practical. Cross-stream contract changes are reconciled by the
Technical Lead before verification.

## 3. Stop conditions

Stop and escalate if the slice requires a numeric cache/clock/revocation rule, a token or raw UID in
persistence, a local lifecycle decision, a SQL migration, a new dependency, automatic evidence
deletion, a Membership inference for v1 evidence, or automatic TimeEntry mutation from cached
context.

## 4. Closure truth

Completion does not mean full offline mode. It means one physical action against one context already
resolved in the same running authenticated session can survive transient C2 server-transport loss
as exact, server-stored, deferred evidence without granting Mobile lifecycle authority. The physical
gate removed only the synthetic Mobile API reverse mapping; it did not test airplane mode or total
device connectivity loss.
