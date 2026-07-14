# Block E1 — Durable Lifecycle Evidence Outbox Technical Lead Security Review

Status: TECHNICAL LEAD AND GITHUB CI APPROVED — Independent Review Pending
Date: 2026-07-14
Reviewer: Technical Lead self-assessment
Scope: Block E1 diff from `9b2c8a5`; `research/` excluded and unchanged

## 1. Review result

No P0/P1/P2/P3 finding remains in the Technical Lead review. E1 preserves server-canonical lifecycle
authority and converts only Block D's volatile pending-command slot into a strict native durable
slot. This document is not an independent review and must not be presented as one.

## 2. Verified boundaries

- **Persistence before network:** the outbox write completes before `lifecycle.ingest`; a write
  failure sends no lifecycle request.
- **Exact idempotency:** retry never changes WorkEvent ID, Receipt ID, capture timestamp or
  `attemptNumber = 1`; the adapter rejects another attempt number on recovery.
- **Authority separation:** persisted content contains binding plus command only. There is no Mobile
  BusinessEngine decision, optimistic result or lifecycle toggle.
- **Identity isolation:** restored evidence is usable only for the same User and Organization;
  another session receives `protected_pending` without identifiers.
- **Native storage boundary:** the adapter uses the existing SecureStore dependency, one versioned
  key, `WHEN_UNLOCKED_THIS_DEVICE_ONLY`, a 4-KiB limit and exact-key JSON validation.
- **No silent loss/replacement:** corrupt evidence is not auto-deleted; existing evidence cannot be
  overwritten; clear compares the expected record before deletion.
- **Disclosure:** no token, provider object, database data, server decision, Customer display data or
  raw NFC payload is serialized or rendered.
- **Failure behavior:** read/write failure is sticky and disables new scans. A clear failure retains
  the exact command and exposes only same-evidence reconciliation.
- **Composition:** SecureStore remains private in `ProductMobileRuntime`; React sees the unchanged
  narrow state/action scan facade.

## 3. Adversarial verification

The 269-case Mobile suite includes restart recovery, cross-identity restored-record protection,
read/write/clear failure, session-transition stickiness, occupied-record refusal, different-record
clear refusal, unknown schema version, Organization mismatch, extra decision field, attempt mutation,
oversized payload and unavailable native storage. Existing NFC concurrency, session-generation,
transport and presentation regressions remain green.

Core remains 288/288. The complete workspace build and Android Expo export pass. Migrations remain
`001`–`005`. GitHub Actions run `29340810743`, bound to implementation commit `e0f2898`, passed all
eight jobs.

## 4. Accepted limitations

- SecureStore is intentionally a single-record recovery slot, not a high-volume queue.
- It does not make scan-context resolution available offline.
- There is no automatic scheduler, backoff, connectivity observer or background OS task.
- Physical restart recovery has not yet been repeated on Android for E1; automated native-adapter
  contract tests and bundle verification are present, but physical evidence remains a later gate.
- Production data, cloud deployment, retention/erasure and pilot operations remain unauthorized.

## 5. Independent review request

Independent review should focus on process-death timing, SecureStore semantics, exact replay,
User/Organization isolation, record replacement/deletion races, truthful UI and whether any old
client-decision queue entered the product graph. Findings must be dispositioned before E1 receives
an independent-security-approved status.
