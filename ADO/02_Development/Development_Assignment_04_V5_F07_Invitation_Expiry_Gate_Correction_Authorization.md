# Development Assignment 4 — DA4-V5-F07 Invitation-Expiry Gate Correction Candidate

- Status: **ADO-ONLY CANDIDATE — INDEPENDENT REVIEW REQUIRED**
- Date: 2026-07-24
- Owner: Technical Lead
- Candidate baseline: `1140cc441b958d701a899a74924eac4cc41fefeb`
- Candidate baseline tree: `7a34423528b4a23753da8bc679eb5aee077dfa1d`
- Candidate baseline CI: `30085506578`, attempt 1, 12/12
- Proposed implementation risk: AVS R3

## 1. Confirmed problem

The fresh exact-bound `DA4-V5-H03` Human Browser Gate passed preflight, the complete Safari
read-only matrix and all three Safari write checkpoints. Chrome then passed its read-only
responsive, zoom, keyboard, navigation and timezone checks. Before the first Chrome write, the
read-only Harness status reported that the single invitation was no longer active while the
invitation receipt and AuditEvent remained unchanged.

This is the accepted Product behavior, not a Product defect. Migration 008 fixes invitation
lifetime at exactly 15 minutes and defines active as unconsumed with `expires_at` later than the
current transaction time. The current gate instead requires `activeInvitations = 1` at every later
checkpoint and at the final invariant, although its Human browser matrix can legitimately take
longer than 15 minutes.

The run stopped before a Chrome write or checkpoint and completed the prescribed cleanup.
Its one-time authority is consumed. Evidence is recorded in
`ADO/05_Evidence/Development_Assignment_04_DA4_V5_H03_Human_Browser_Failure_Evidence.md`.

## 2. Proposed correction contract

`DA4-V5-F07` proposes only the following technical gate correction:

1. Keep the Product invitation TTL exactly 15 minutes. Do not extend, freeze, refresh or recreate
   an invitation for the gate.
2. Extend disclosure-safe Harness status with exact unconsumed and expired-unconsumed invitation
   counts. Do not expose invitation IDs, timestamps, digests, tokens or plaintext.
3. At the immediate invitation checkpoint require exactly one unconsumed invitation, exactly one
   active invitation and zero expired-unconsumed invitations, plus the existing exact receipt and
   AuditEvent deltas.
4. At every later checkpoint and final status require exactly one unconsumed invitation and accept
   only one of two mutually exclusive, database-consistent states:
   - active `1`, expired-unconsumed `0`; or
   - active `0`, expired-unconsumed `1`.
5. Treat that single time-driven transition as independent of the six write-plan deltas. Every
   other aggregate remains exact and fail-closed.
6. A consumed, missing, duplicated or otherwise ambiguous invitation remains a mismatch. Natural
   expiry does not authorize a retry, repair, replacement invitation or skipped checkpoint.
7. Update the final runbook invariant to prove invitation creation through the durable receipt and
   AuditEvent and to report the exact safe state `active` or `expired`; it must not require the
   15-minute row to remain active for a longer Human run.
8. Preserve the existing serial browser allocation, six privileged writes, checkpoint handshake,
   CSV stop points, credential controls, exact artifact, cleanup and disclosure boundaries.

## 3. Proposed implementation scope

Authorized only after independent approval under the repository standing rule:

- the DA4-V5 status projection and write-session invariant in
  `apps/synthetic-android-e2e`;
- direct unit and disposable-PostgreSQL regressions for both valid invitation states and
  fail-closed invalid states;
- the DA4 V5 runbook and minimal status/evidence synchronization; and
- AVS V0–V4 plus an independent Exact-SHA implementation review.

Explicitly excluded:

- Product invitation behavior or the 15-minute TTL;
- Admin Web, Backend API, schema/migrations, Mobile, dependencies, lockfiles or workflows;
- a Human V5 run, retry, repair, resume or reuse of `DA4-V5-H03` observations; and
- production, production data, pilot operations, deployment or distribution.

## 4. Verification contract

- **V0:** exact scope/diff, authority, reference, disclosure, whitespace and protected-path checks.
- **V1:** focused status/write-session tests proving immediate-active, later-active,
  later-expired and invalid/consumed/missing/duplicate fail-closed behavior.
- **V2:** complete Synthetic Harness suite with disposable PostgreSQL and complete cleanup.
- **V3:** one fresh complete applicable workspace regression, all tests-inclusive typechecks and
  builds, migrations/replay and disposable cleanup.
- **V4:** focused publication, exact-head CI and independent Exact-SHA implementation review.
- **V5:** separately authorized later Human Browser Gate only.

This document is a correction candidate. It does not itself authorize executable changes or any
Human, production, production-data, deployment or distribution action.
