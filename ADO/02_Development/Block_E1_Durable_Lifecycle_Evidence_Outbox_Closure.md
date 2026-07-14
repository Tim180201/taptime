# Block E1 — Durable Lifecycle Evidence Outbox Closure

Status: Completed — Technical Lead, GitHub CI and Independent Security Approved; Five Non-blocking P3 Findings Dispositioned
Date: 2026-07-14
Owner: Technical Lead
Authorized Baseline: `9b2c8a5ed8b70a8aed5e367f6c919f439b5ac1ed`

## 1. Delivered scope

E1 closes Block D's process-death loss window for one already-resolved lifecycle action. The Mobile
product path writes the exact User/Organization-bound `LifecycleEventCommand` to one private native
SecureStore outbox record before its first C2 lifecycle request. Transient or locally unfinished work
survives app termination and can be retried only as the exact original WorkEvent/Receipt with the
original `occurredAt` and `attemptNumber = 1`.

The record is cleared only after a definitive server result and only when it matches the expected
evidence. All composite native outbox operations are serialized across adapter instances in the one
supported JavaScript runtime; another command therefore cannot replace unresolved evidence in the
product composition. SecureStore does not provide cross-process compare-and-swap, and E1 neither
claims nor supports a multi-process Mobile composition. Another User/Organization can neither send
the record nor see its identifiers. Invalid or unavailable persistence blocks NFC fail-closed.

The unchanged C2/B6/Core path remains the only lifecycle authority. Mobile persists no start/stop
decision, token, raw NFC payload or server result.

## 2. Technical Lead and independent-review corrections

The complete review sequence added these protections beyond the first draft:

1. durable-storage failure remains sticky across later session transitions;
2. occupied evidence cannot be overwritten, exact-record comparison is required before clear, and
   native outbox operations are serialized process-locally across adapter instances;
3. start generations prevent late SecureStore success or failure from a stopped runtime from
   changing current state, duplicating a subscription or leaking one;
4. the owning product runtime also rejects late start continuations and ignores stale start errors,
   while React cleanup invalidates its obsolete failure observer;
5. the payload limit is 2 KiB, platform semantics are documented accurately, and the Android target
   relies on expo-secure-store's Keystore-backed encrypted storage rather than an iOS-only option;
6. persistent secure-storage failure copy no longer promises recovery after restart and warns users
   not to delete the app or its data before contacting support.

The reconciliation mechanism for a permanently corrupt native record remains a separately
authorized E2+ concern. E1 intentionally fails closed and never auto-deletes possible work evidence.

## 3. Verification evidence

- Root tests-inclusive TypeScript check: passed for Core and Mobile.
- Mobile tests: 279/279 in 18 files passed.
- Core tests: 288/288 in 43 files passed.
- Complete workspace build: passed for Core, all backend workspaces and synthetic Android E2E.
- Expo production Android export: passed; 782 modules bundled to Hermes output.
- `git diff --check`: passed.
- Migrations remain exactly `001`–`005`; no SQL, backend, Core behavior or dependency changed.
- Initial implementation commit `e0f2898` passed all eight jobs in run `29340810743`.
- Its governance HEAD `dea043f` passed all eight jobs in run `29341021239`, closing E1-R-05.
- Corrective commit `2ff3991` passed all eight jobs in run `29343959552`.

The independent review of `9b2c8a5..dea043f` returned `APPROVED WITH NON-BLOCKING FINDINGS`: no
P0/P1/P2 and five P3 observations. Every observation is recorded and dispositioned in
`ADO/05_Evidence/Block_E1_Independent_Architecture_Security_Review.md`. A final targeted
Technical-Lead re-audit of the corrective diff found no remaining code finding.

## 4. Explicitly still open

E1 is not a full offline queue. A scan still requires live C2 scan-context resolution before durable
lifecycle evidence can be created. Multiple offline events, a tenant-safe configuration cache,
automatic retry/backoff, connectivity monitoring, background OS synchronization, DT-063–DT-068,
C3 and technical-pilot readiness remain open and separately gated.

Physical E1 process-death/restart recovery has not yet been repeated on Android. Existing physical
Block-D Start/Stop evidence, native-adapter tests and production bundle verification do not replace
that later device gate.

## 5. Recommended next step

Design E2 as the tenant-safe offline capture/cache slice. Its authorization must explicitly decide
assignment activation/revocation, cache staleness and supported reconciliation before implementation.
E1 must not be widened implicitly to answer those product/security questions.
