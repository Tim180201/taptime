# Block E2A — Warm-Session Deferred Offline Capture Closure

Status: Completed — Technical Lead, GitHub CI, Human Physical Android and Independent Security Approved
Date: 2026-07-14
Owner: Technical Lead
Authorized Baseline: `9f2f922fd46e33cb9d53d80e4a7dbedb73653ad1`
Approved Implementation Commit: `4b5ecdc7d6605db3e231f9ead966ebf104900a30`

## 1. Delivered scope

E2A delivers one truthful offline-evidence action for the common case in which an authenticated
employee has already resolved a tag online in the same still-running Mobile session and C2 then
becomes transiently unreachable. The product first attempts live resolution. Only a typed transport
failure may fall back to one exact volatile session/payload context. Mobile creates no lifecycle
decision; it stores one exact Membership-bound command before transmission and presents only a
pending state.

Cached-context evidence can reach only the dedicated authenticated defer-only route. The server
locks and verifies current Membership plus exact active Assignment/Tag/Customer configuration. A
durable request atomically stores WorkEvent, `received` SyncReceipt and AuditEvent without invoking
the Business Engine, creating a CanonicalDecision or mutating a TimeEntry. Mobile removes the local
record only after an exact durable acknowledgement.

Version-1 Membership-unknown evidence stays protected and is never silently migrated or rebound.
No SQL migration, dependency, local lifecycle rule, clock threshold or revocation grace policy was
added.

## 2. Review and verification

- Independent pre-implementation review returned `APPROVED AFTER CORRECTIONS`; three P2 design
  findings were incorporated before product-code implementation.
- Independent implementation review returned `APPROVED`, P0/P1/P2 = 0 and P3 = 2. Both P3 findings
  were corrected; a targeted follow-up found no new finding.
- Core passed 288 tests; Mobile 310; backend lifecycle 88; backend API 139; synthetic Android E2E 6
  plus the defer-only test in isolation; B1/B3/B4/B5 regressions remained green.
- Tests-inclusive TypeScript checks, all affected builds, full workspace build, Android Expo export,
  Gradle release build, migration/dependency guards and `git diff --check` passed.
- Implementation commit `4b5ecdc7d6605db3e231f9ead966ebf104900a30` passed all eight GitHub
  Actions jobs in run `29348512506`.
- Closure-publication commit `de03a718e96a9df46b796f3770ca599cd57da8c5` passed all eight GitHub
  Actions jobs in run `29351043179`.

The independent final architecture/security review inspected the complete implementation, CI,
physical evidence and closure claims and returned `APPROVED`. E2A-FINAL-01, one P3 publication-sync
observation, was corrected during review; the final open count is P0/P1/P2/P3 = 0.

## 3. Physical Android result

The Human Architect completed the flow on a Samsung Galaxy A33 5G / Android 15 and NTAG213 Tag A
using the exact synthetic APK whose SHA-256 is
`fa969435ec8d6f95160e74e4a1fe8dbf315b33834192094bd3cfb20ad9be5af4`.

One online scan first produced server-confirmed Start. While the authenticated session and volatile
scan context remained warm, only the Mobile API USB reverse mapping `tcp:3000` was removed. The same
tag then produced `Übertragung noch offen`, no local Start/Stop claim and no server change. Android
force-stopped and relaunched the real package. After C2/session restoration, the exact protected
pending state remained and allowed only `Unveränderte Daten erneut senden`.

Explicit retry ended in `Scan sicher gespeichert` with server-review-only copy. Final sanitized
state was 2 WorkEvents, 2 SyncReceipts, 4 AuditEvents, 1 CanonicalDecision, 1 started TimeEntry and 0
stopped TimeEntries. Relative to the online Start, the deferred action added only one WorkEvent, one
`received` Receipt and one LifecycleDeferred AuditEvent; it added no Decision and did not stop or
otherwise mutate the TimeEntry.

This is a controlled physical C2 server-transport-loss test, not an airplane-mode or general
device-network-offline claim. Full evidence, APK binding and cleanup are in
`ADO/05_Evidence/Block_E2A_Warm_Session_Deferred_Offline_Capture_Physical_Validation_Evidence.md`.

## 4. Security disposition

E2A preserves the server-canonical authority boundary by reducing the cached-context action to
deferred evidence. The expected-Membership header can only narrow authority; active current
server configuration remains required; a defer request cannot create a lifecycle decision. The
single local record is immutable, exact-identity bound, protected across process restart and never
replaced or silently deleted on ambiguity.

The endpoint does not attest a genuine app, device, physical scan or network history. E2A also does
not decide whether or when deferred evidence later affects paid working time. Those remain separate
fraud, reconciliation, clock and labor-policy decisions.

## 5. Cleanup and repository scope

- Synthetic shutdown completed normally.
- The scoped reverse mappings were removed and `adb reverse --list` was empty.
- The temporary server schema was absent after cleanup and generated runtime-role count was zero.
- No production environment, production secret, cloud service, real-person data, SQL migration or
  dependency was introduced.
- The existing untracked `research/` directory was neither staged nor changed.

## 6. Explicitly still open

E2A is not full offline mode and does not complete DT-060–DT-062 or Block E. The following remain
separately gated:

- durable multi-context/configuration caching and cold-start offline identity;
- a transactional multi-event queue, capacity/backpressure and ordering;
- automatic retry/backoff, connectivity monitoring and background OS synchronization;
- support/admin reconciliation, later evaluation of deferred evidence and corrupt/legacy-record
  handling;
- numeric time, staleness and post-revocation policies;
- C3, DT-063–DT-068 setup/export, corrections, production deployment/data, iOS and broader device
  validation.

## 7. Closure disposition

The implementation, GitHub CI, physical Android and independent final-review gates satisfy the
authorized narrow warm-session, exact-same-context, one-pending-event behavior. Block E2A is
**COMPLETED** for that scope only. DT-060–DT-062 and Block E remain open.
