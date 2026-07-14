# Block E1 — Durable Lifecycle Evidence Outbox Closure

Status: Implemented — Technical Lead Approved; GitHub CI and Independent Review Pending
Date: 2026-07-14
Owner: Technical Lead
Authorized Baseline: `9b2c8a5ed8b70a8aed5e367f6c919f439b5ac1ed`

## 1. Delivered scope

E1 closes Block D's process-death loss window for one already-resolved lifecycle action. The Mobile
product path now writes the exact User/Organization-bound `LifecycleEventCommand` to a private
device-only SecureStore outbox before its first C2 lifecycle request. Transient or locally unfinished
work survives app termination and can be retried only as the exact original WorkEvent/Receipt with
the original `occurredAt` and `attemptNumber = 1`.

The record is cleared only after a definitive server result and only when the stored record matches
the expected evidence. Another runtime command cannot overwrite it; another User/Organization can
neither send it nor see its identifiers. Invalid/unavailable persistence blocks NFC fail-closed.

The unchanged C2/B6/Core path remains the only lifecycle authority. Mobile persists no start/stop
decision, token, raw NFC payload or server result.

## 2. Technical Lead corrections

The implementation review added three protections beyond the first draft:

1. a durable-storage failure remains sticky across later session transitions and cannot silently
   re-enable scanning;
2. a new command cannot replace an existing unresolved native record;
3. clearing requires the exact expected record, preventing accidental deletion of different
   evidence.

UI copy now truthfully states that the one pending action survives app restart. It does not claim
full offline mode or background synchronization.

## 3. Local evidence

- Mobile tests-inclusive TypeScript check: passed.
- Mobile tests: 269/269 in 17 files passed (253 Block-D baseline plus 16 E1 regressions).
- Core TypeScript check and tests: passed; 288/288 in 43 files.
- Complete workspace build: passed for Core, all backend workspaces and synthetic Android E2E.
- Expo production Android export: passed; 781 modules bundled to Hermes output.
- `git diff --check`: passed.
- Migrations remain exactly `001`–`005`; no SQL, backend, Core behavior or dependency changed.

GitHub Actions and an independent architecture/security review remain pending at this pre-publication
closure point and must not be reported as passed until their evidence exists.

## 4. Explicitly still open

E1 is not a full offline queue. A scan still requires live C2 scan-context resolution before durable
lifecycle evidence can be created. Multiple offline events, a tenant-safe configuration cache,
automatic retry/backoff, connectivity monitoring, background OS synchronization, DT-063–DT-068,
C3 and technical-pilot readiness remain open and separately gated.

## 5. Recommended next step

After CI and independent review, design E2 as the tenant-safe offline capture/cache slice. That
review must explicitly decide assignment activation/revocation and cache-staleness behavior before
implementation. E1 must not be widened implicitly to answer those product/security questions.
