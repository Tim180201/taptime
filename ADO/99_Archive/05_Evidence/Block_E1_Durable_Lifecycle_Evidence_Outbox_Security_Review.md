# Block E1 — Durable Lifecycle Evidence Outbox Technical Lead Security Review

Status: TECHNICAL LEAD, GITHUB CI AND INDEPENDENT SECURITY APPROVED — Five Non-blocking P3 Findings Dispositioned
Date: 2026-07-14
Reviewer: Technical Lead self-assessment plus independent Claude review
Scope: Block E1 from `9b2c8a5` through corrective commit `2ff3991`; `research/` excluded and unchanged

## 1. Review result

No P0/P1/P2 finding was reported by the independent reviewer. Its verdict was `APPROVED WITH
NON-BLOCKING FINDINGS`, comprising five P3 observations. The Technical Lead accepted all five,
implemented the proportionate corrections, verified both relevant GitHub runs and performed a final
targeted corrective-diff audit with no remaining code finding.

The independent report and dispositions are preserved separately in
`ADO/05_Evidence/Block_E1_Independent_Architecture_Security_Review.md`.

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
  key, a 2-KiB read/write limit and exact-key JSON validation. `WHEN_UNLOCKED_THIS_DEVICE_ONLY` is
  applied for iOS Keychain accessibility; Android ignores that iOS field and uses expo-secure-store's
  Keystore-backed encrypted SharedPreferences implementation.
- **Single-runtime concurrency:** read/write/clear operations are serialized across all adapter
  instances in the supported JavaScript runtime. SecureStore has no cross-process CAS; multi-process
  Mobile ownership is outside E1 and not claimed.
- **No silent loss/replacement:** corrupt evidence is not auto-deleted; occupied evidence cannot be
  overwritten in the supported composition; clear compares the expected record before deletion.
- **Lifecycle races:** stale outbox reads, failures and owning-runtime start continuations are
  invalidated by generation. React cleanup cannot publish a stale start failure.
- **Disclosure:** no token, provider object, database data, server decision, Customer display data or
  raw NFC payload is serialized or rendered.
- **Failure behavior:** read/write failure is sticky and disables new scans. A clear failure retains
  the exact command and exposes only same-evidence reconciliation.
- **Composition:** SecureStore, native NFC and transport ownership remain outside React; the public
  composition module exports only the narrow `ProductMobileRuntime` type and factory.

## 3. Adversarial verification

The 279-case Mobile suite includes restart recovery, cross-identity restored-record protection,
read/write/clear failure, session-transition stickiness, process-local concurrent occupancy refusal,
different-record clear refusal, unknown schema version, Organization mismatch, extra decision field,
attempt mutation, 2-KiB enforcement, unavailable native storage, stale start success/failure,
subscription cleanup, owning-runtime restart races and truthful persistent-failure copy. Existing NFC
concurrency, session-generation, transport and presentation regressions remain green.

Core remains 288/288 in 43 files. Tests-inclusive TypeScript checks, the complete workspace build,
Android Expo export and `git diff --check` pass. Migrations remain `001`–`005`.

GitHub Actions evidence:

- `29340810743` — initial implementation `e0f2898` — eight of eight jobs passed;
- `29341021239` — documented initial governance HEAD `dea043f` — eight of eight jobs passed;
- `29343959552` — corrective implementation `2ff3991` — eight of eight jobs passed;
- `29344464075` — E1 closure-publication commit `9f2f922` — eight of eight jobs passed.

## 4. Accepted limitations

- SecureStore is intentionally a single-record recovery slot, not a high-volume queue.
- It does not make scan-context resolution available offline.
- There is no automatic scheduler, backoff, connectivity observer or background OS task.
- There is no supported cross-process CAS or multi-runtime ownership model; the product composition
  owns one JavaScript runtime and one outbox.
- A permanently invalid record remains fail-closed. Users are directed to support and warned not to
  delete the app/data; an authorized reconciliation mechanism remains an E2+ gate.
- Physical E1 restart recovery has not yet been repeated on Android.
- Production data, cloud deployment, retention/erasure and pilot operations remain unauthorized.

### Follow-up — E2A physical version-2 evidence, 2026-07-14

Later E2A physical validation proved that an already captured Membership-bound version-2 record
survives Android force-stop/relaunch on Galaxy A33 / Android 15 and remains protected until exact
explicit retry. This supersedes only the earlier missing-device-evidence statement for that later
version-2 E2A path. It does not validate version-1 Membership-unknown replay, multi-record/full
offline behavior, automatic/background synchronization or support reconciliation, and it does not
expand the original E1 security verdict.

## 5. Final disposition

Block E1 is independently security approved with five corrected or explicitly bounded non-blocking
P3 observations and no P0/P1/P2. This status does not authorize E2, C3, production deployment,
production personal data or full offline behavior.
