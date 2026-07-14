# Block E2A — Warm-Session Deferred Offline Capture Technical Lead Security Review

Status: TECHNICAL LEAD, GITHUB CI, HUMAN PHYSICAL AND INDEPENDENT SECURITY APPROVED — No Open P0/P1/P2/P3 Findings
Date: 2026-07-14
Reviewer: Technical Lead self-assessment plus independent pre-implementation, implementation and final reviews
Authorized Baseline: `9f2f922fd46e33cb9d53d80e4a7dbedb73653ad1`
Approved Implementation Commit: `4b5ecdc7d6605db3e231f9ead966ebf104900a30`
Scope: Narrow E2A warm-session/same-context/one-record flow; `research/` excluded and unchanged

## 1. Technical Lead result

The Technical Lead approves the E2A implementation and physical-gate result for its narrow authorized
scope. GitHub Actions run `29348512506` passed all eight jobs for exact implementation commit
`4b5ecdc7d6605db3e231f9ead966ebf104900a30`. The physical Galaxy A33 / Android 15 sequence then
proved that one same-tag action captured after a controlled C2 transport interruption is retained
durably across Android process termination, submitted only by explicit unchanged retry and stored by
the server as deferred evidence without another CanonicalDecision or TimeEntry mutation.

The prior independent implementation review returned `APPROVED`, with no P0/P1/P2 and two P3
findings. Both were corrected and independently reverified. The separate independent final review
then returned `APPROVED`. Its one P3 publication-sync observation was corrected during review, so
the final open severity count is P0/P1/P2/P3 = 0.

## 2. Verified authority boundaries

- Every supported scan attempts current C2 scan-context resolution first.
- The volatile positive context contains one canonical payload and exact session generation, User,
  Organization, Membership, role and resolved target. It is usable only after typed
  `transient_failure` and an exact snapshot/payload match.
- A cache hit grants no identity, Membership, Assignment, target or lifecycle authority. Definitive
  misses, authority/protocol failure, logout, session replacement and runtime stop invalidate it.
- New durable outbox records are version 2 and bind exact Membership and submission mode to the
  existing User/Organization binding. Version-1 Membership-unknown evidence is preserved but never
  inferred, rebound or replayed.
- The exact command is stored before transport. WorkEvent ID, Receipt ID, physical `occurredAt` and
  `attemptNumber = 1` remain immutable across retry.
- `POST /v1/lifecycle-events/deferred` accepts a strict single expected-Membership UUID that only
  narrows the request. The server derives and locks current identity/Membership and compares the
  canonical UUID before persistence.
- The durable branch requires exact current tenant configuration, an active Assignment with no
  `valid_to` and an active Customer with no `deactivated_at`.
- Its transaction can write only WorkEvent, `received` SyncReceipt and AuditEvent. It does not call
  the Business Engine, create a CanonicalDecision or mutate a TimeEntry.
- Mobile clears only an exact synchronized acknowledgement or exact durable-deferred acknowledgement
  matching the pending WorkEvent and Receipt. Every malformed, ambiguous, non-durable, conflicting
  or rejected result retains the evidence and blocks replacement.
- A defer-only Mobile adapter rejects `synchronized`; the orchestrator independently suppresses a
  faulty synchronized result and preserves evidence.

## 3. Automated and CI evidence

| Verification | Result |
|---|---|
| Core | 288/288 tests in 43 files passed |
| Mobile | 310/310 tests in 19 files plus tests-inclusive TypeScript check passed |
| Backend lifecycle | 88/88 tests, TypeScript check and build passed |
| Backend API | 139/139 tests, TypeScript check and build passed |
| Synthetic Android E2E | 6/6 suite and isolated defer-only case 1/1 passed |
| Backend regressions | B1 39 passed plus 2 permitted Supavisor skips; B3 125; B4 55; B5 42 |
| Workspace/build | Complete workspace build and Android Expo/Hermes export passed |
| Android native artifact | Release APK build passed all 598 Gradle tasks |
| Schema/dependencies | Migrations remain exactly `001`–`005`; no SQL migration or dependency changed |
| Repository hygiene | `git diff --check` passed; `research/` remained outside scope |
| GitHub Actions | Run `29348512506`, exact head `4b5ecdc7d6605db3e231f9ead966ebf104900a30`, eight of eight jobs passed |

The eight successful GitHub jobs cover Core/Mobile typecheck, tests and Android export; B1; B3; B4;
B5; B6 lifecycle; C2 API/Mobile transport; and the synthetic Android E2E harness.

## 4. Independent implementation findings and dispositions

### E2A-IMPL-01 — P3 — closed

The first implementation forwarded a syntactically valid uppercase expected-Membership UUID while
PostgreSQL renders UUIDs canonically lowercase. The API now lowercases the validated UUID before the
exact coordinator comparison, and a regression proves uppercase input reaches the capability in
canonical form.

### E2A-IMPL-02 — P3 — closed

The initial synthetic defer-only test relied on state created by its predecessor. It now provisions
Tag A when necessary and checks relative evidence deltas. Both the complete six-case suite and the
isolated defer-only selection pass.

The targeted independent follow-up found no new issue and retained `APPROVED` for implementation.

## 5. Physical adversarial evidence

The physical test used the exact 69,592,419-byte synthetic release APK with SHA-256
`fa969435ec8d6f95160e74e4a1fe8dbf315b33834192094bd3cfb20ad9be5af4` on Galaxy A33 5G
`SM-A336B`, Android 15, with NTAG213 Tag A. The operator exposed only the shortened SHA-256
validation fingerprint, never the raw UID.

After one genuine online Start had created 1 WorkEvent, 1 synchronized Receipt, 1 Decision and 1
active TimeEntry, only the C2 USB reverse mapping `tcp:3000` was removed. The same-tag capture showed
only truthful pending copy and made no server change. A real `am force-stop`/relaunch did not discard
or replace the version-2 record. Restoring C2 and explicitly selecting `Unveränderte Daten erneut
senden` produced a durable deferred acknowledgement and the final server-review-only copy.

Final server state was exactly 2 WorkEvents, 2 Receipts (`synchronized = 1`, `received = 1`), 4
AuditEvents, 1 CanonicalDecision, 1 started TimeEntry and 0 stopped TimeEntries. The deferred delta
was therefore WorkEvent +1, received Receipt +1 and LifecycleDeferred Audit +1, with Decision +0,
TimeEntry +0 and stopped TimeEntry +0. This is direct evidence against an accidental client or
defer-route Stop decision.

Normal shutdown removed the synthetic schema and runtime roles and left `adb reverse --list` empty.
The complete chronology and sanitized trace are recorded in
`ADO/05_Evidence/Block_E2A_Warm_Session_Deferred_Offline_Capture_Physical_Validation_Evidence.md`.

## 6. Trust limits and risks that remain open

- Removing only `adb reverse tcp:3000` proves a real Mobile-to-C2 server-transport outage in the
  supported synthetic environment. It does not prove airplane mode or total device connectivity
  loss.
- Route selection is not device, app-integrity, physical-presence or NFC-scan attestation. A modified
  authenticated client retains only the capabilities already available to that identity; stronger
  anti-fraud claims require a separate design.
- The volatile cache cannot support cold-start offline resolution. Only an already captured durable
  command survives process termination.
- One protected record can block scanning indefinitely after legacy, identity, conflict,
  configuration or storage failure. There is no support/admin reconciliation workflow yet.
- No numeric device-clock, maximum offline delay, historical Membership or post-revocation policy
  was added. R-008, R-012, R-013, R-016 and R-017 remain open.
- No multi-context cache, multi-event queue, background retry, connectivity observer, iOS flow,
  production cloud or production personal data is authorized.

## 7. Gate disposition

Technical-Lead, implementation-CI, Human physical Android and independent final-review gates are
passed for E2A. The final reviewer approved only warm-session, exact-same-context, one-record
deferred evidence capture under controlled transient C2 unavailability. DT-060–DT-062 and Block E
remain open because E2A implements only one authority-reducing slice of those outcomes.
