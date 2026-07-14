# Block D — NFC Runtime and Physical Validation Evidence

Status: Completed — Software/GitHub-CI, Physical Android Product E2E and Independent Review Approved
Date: 2026-07-14
Implementation Baseline: `bac5f4868ecf36364d62629ed312306fa29dc9d7`
Authorization Commit Parent: `4f540ca648b9ef98c5ad4ccf3798e0279fc8bb6c`
Authority: ADR-0009 and `Block_D_NFC_Runtime_Physical_Validation_Authorization.md`
Scope: DT-053–DT-059; DT-016/DT-058 and the physical portion of DT-059 are now evidenced on the approved Android device/tag set

Technical Lead Review Date: 2026-07-14
Technical Lead Verdict: `APPROVED` for the software slice after three blocking corrections
Approved Implementation Commit: `fac778da8540dc744718ff583256d138aa1d874d`
GitHub Actions: Run `29319811973` — all seven jobs passed

## 1. Truthful result

The authorized Android software path is implemented, automated regressions pass and the Human
Architect completed both physical gates on a Samsung Galaxy A33 5G / Android 15 with two NTAG213
tags. The device-local validation proved ten stable/distinct reads per tag, disabled-NFC behavior,
timeout, cancellation, cleanup and duplicate coalescing. The later strictly local product E2E then
proved real synthetic login, physical Tag-B unassigned handling, fingerprint-bound Tag-A
provisioning with zero lifecycle mutation, and server-confirmed Start then Stop through the real
Mobile/Auth/C2/B4/B5/B6/PostgreSQL/Core path.

DT-016/DT-058's recorded Android physical gate and the physical portion of DT-059 are therefore
evidenced for this approved device/tag set. This is not pilot readiness, a broad device matrix,
production cloud/provider validation, iOS validation or Block-E synchronization evidence. The
independent final review approved the combined code/evidence with no P0/P1/P2 and one corrected
documentation-only P3; Block D is therefore closed for its authorized Android-v1 scope.

## 2. Implemented architecture

```text
authenticated ProductMobileRuntime
  -> frozen ProductScanCapability exposed to React
  -> ProductScanOrchestrator (session snapshot + generation guard)
  -> RnNfcScanAdapter.scan()
  -> Android Tag.id
  -> shared createCanonicalNfcUidPayload()
  -> private C2 ScanContextApiPort
  -> immutable WorkEvent/Receipt command
  -> private C2 LifecycleEventApiPort
  -> server result mapped to truthful ScanScreen presentation
```

The screen receives no token, native manager, raw UID, scan-context client or lifecycle client.
The Mobile orchestrator does not import or invoke `BusinessEngine`, select Start/Stop, inspect an
active TimeEntry or reproduce the five-second rule. It only maps the already returned server result
to presentation state.

## 3. Payload and native capture evidence

- The shared pure codec is exported from `@taptime/core` without changing the existing opaque
  `createNfcPayload()` behavior.
- Accepted raw input is exactly 2–64 ASCII hexadecimal characters with even length; lowercase is
  canonicalized to uppercase.
- Stored/transported form is exactly `nfc:uid:v1:<UPPERCASE_HEX>`.
- Empty, whitespace-bearing, separated, `0x`-prefixed, odd-length, non-ASCII-lookalike, non-hex and
  out-of-range inputs are rejected without trimming or repair.
- The Android adapter reads only `Tag.id`. NDEF content is ignored and never used as fallback.
- Concurrent `scan()` callers share one capture, one listener and one result.
- The native manager start is single-flight per product adapter; capture uses a testable default
  20-second timeout.
- Success, unreadable input, register failure, timeout, explicit cancel and runtime stop remove the
  listener. A settled registration awaits exactly one best-effort unregistration before completion.
- Cancellation before native start completes, late callbacks, register/unregister races and
  unregister rejection are covered without stale settlement or hanging Promises. If the native
  registration call itself remains pending, the caller settles fail-closed and the adapter blocks
  reuse until that old attempt settles and is unregistered; it cannot clean up a newer capture.
- The physical discovery callback records `capturedAt` together with the canonical payload before
  asynchronous native cleanup. Product submission rejects a captured result without that timestamp.

`scan()` is the adapter's only product capture entry point. The former `waitForNextTag()` alternative
has been removed, closing the prior K2 bypass globally rather than only in the composition root.

## 4. Session, tenant and retry boundaries

The orchestrator snapshots User, Organization, Membership context and private session generation.
It verifies that snapshot after every asynchronous boundary and immediately before each C2 call.
Sign-out, User/Organization replacement, Membership-context replacement and generation changes
invalidate the operation and cancel a pending native capture. A new session remains in `checking`
until the old operation has settled, so no late old-session continuation is adopted by the new
identity.

Once lifecycle evidence exists, transient or unavailable transport is treated as ambiguous. The
frozen command remains only in volatile runtime memory. Explicit retry passes the identical command
object with the same WorkEvent ID, Receipt ID, capture timestamp and `attemptNumber = 1`; a new scan
is blocked. The evidence is retryable only for the same User and Organization. Another identity
receives only a generic `protected_pending` state and can neither inspect, retry nor replace it with
a new scan. If the original User/Organization returns while the process remains alive, the exact
same evidence is restored for explicit retry. App termination can lose it; durable queue,
reconciliation, scheduling and new attempts remain Block E.

## 5. Technical Lead corrections

The final review found and corrected three software blockers before approval:

1. Native cancellation could unregister before a deferred `registerTagEvent()` completed, allowing
   a late native registration to survive cleanup. The adapter now drains that attempt before reuse
   while still settling callers if the native Promise stalls.
2. `occurredAt` was created after native cleanup rather than at physical discovery. The adapter now
   binds a validated timestamp inside the discovery callback and the orchestrator requires it.
3. Ambiguous evidence was discarded after another User authenticated. It is now retained for its
   original identity, hidden behind a disclosure-free protected state, and restored only when the
   same User and Organization return.

Secure UUID generation is additionally guarded fail-closed if the native entropy provider throws,
and the legacy Core application boundary consumes an adapter-supplied capture time when available.

## 6. Automated test evidence

Runtime used: Node `24.17.0`; PostgreSQL `17.10`; Expo `57.0.2`; `react-native-nfc-manager`
`3.17.2`; `expo-crypto` `57.0.0`.

| Area | Result |
|---|---|
| `npm ci` | Passed from the updated lockfile; 11 existing moderate findings reported |
| Root tests-inclusive Typecheck | Passed |
| Core tests | 288 passed in 43 files (262 existing plus 26 canonical-codec cases) |
| Mobile tests | 245 passed in 15 files (154 existing plus 91 Block-D/regression cases) |
| C1/C2 API | 127 passed in 2 files |
| B1 | 39 passed, 2 permitted Supavisor skips |
| B3 | 125 passed |
| B4 | 55 passed |
| B5 | 42 passed |
| B6 | 68 passed |
| Workspace build | Passed |
| Android Expo export | Passed; Hermes bundle generated from 777 modules |
| GitHub Actions YAML parse | Passed locally |
| Migration scope | Exactly `001`–`005`; no migration changed or added |
| `git diff --check` | Passed |

Focused automated evidence includes:

- every ADR-0009 accepted/rejected codec class and scan/registration codec equivalence;
- real `scan()` ordering before scan-context and lifecycle calls, exact timestamp binding, two
  distinct Expo cryptographic UUIDs and no server call on capture/resolution failure;
- native start/capture single-flight, timeout, cancellation, runtime stop, cleanup, late callback,
  subsequent scan and register/unregister race behavior;
- all synchronized Core result presentations plus duplicate, other-target rejection, escalation,
  deferred, conflict, authority rejection and both pre-/post-evidence transient failures;
- duplicate UI press produces one evidence set; retry reuses byte-equivalent evidence;
- sign-out, User/Organization, Membership and generation invalidation at capture, scan-context and
  lifecycle boundaries;
- non-Android unsupported state performs no active native capture;
- source-boundary checks keep tokens, C2 clients, native manager and raw UID out of React and keep
  Mobile free of lifecycle-decision rules.

CI's existing quality job now runs the expanded Root Typecheck/Mobile tests and additionally executes
`npx expo export --platform android` from `apps/mobile`.

Implementation commit `fac778d` passed all seven jobs in GitHub Actions run `29319811973`, including
the new Android product bundle gate and every PostgreSQL/API regression job.

### 6.1 Internal physical-validation APK tooling

On 2026-07-14 the Human Architect authorized a narrow internal build/tooling addition so the
physical test can run without Metro or a development client. The implementation adds:

- EAS profile `physical-validation` with internal distribution and explicit APK output;
- a distinct Android package `com.tim180201.mobile.validation`, app name
  `TapTim.e Validation` and URI scheme `taptime-validation`;
- a fail-closed build/runtime variant match and mutual exclusion from the development demo;
- a local-only two-tag validation controller with one production-adapter capture entry point,
  stable-read counters, mismatch detection, explicit cancel/reset and rapid-request coalescing;
- a purpose-built phone UI that explicitly states it performs neither time tracking nor server
  transmission and receives only a 12-hex-character SHA-256 fingerprint, never the canonical
  payload or raw UID.

Local evidence: Mobile typecheck passed; 252 tests in 16 files passed; Core 288 tests passed;
workspace build passed; the validation Expo configuration resolved to the distinct
package/name/scheme; Android Hermes export generated from 780 modules. EAS generated a dedicated
remote Android keystore during the configuration proof. The initial uncommitted-source build
`3efa9b86-512f-4ebb-8468-49fafc9931bd` was deliberately canceled before completion so the final APK
could be tied to reviewed commit `7ac4fa4a7bd28777ea763438fb9a2ff2eff8e796`.

The commit-bound EAS internal-distribution build
`c459616c-3e90-49f5-a508-8044d05e1c25` then finished successfully. Its 66-MB APK is available at
`https://expo.dev/artifacts/eas/YRZhVIul94iI8CFxF72C96Qb1v-Hy8ddTAwdN63EKp4.apk`, passed ZIP
integrity verification and has SHA-256
`005f6cee512f0ec6ad27b50a170e8076cf97cf8523918b99bd034452a8c3cecf`. GitHub Actions run
`29322368886` passed all seven jobs for the same commit. Installation and device observations were
recorded later in the physical table below.

This tooling alone did not upgrade Block D readiness. It has no authentication, C2/B5/B6 client,
assignment, lifecycle decision, durable storage or production cloud/data path. The Human Architect
later completed the device-local and separate synthetic server-connected observations recorded
below.

### 6.2 Synthetic server-connected Android E2E test environment

On 2026-07-14 the Human Architect authorized a separate, strictly non-production environment for
the still-open product-server observations. USB `adb reverse` was selected before implementation so
the distinct synthetic package can reach host-loopback Auth and C2 without LAN, tunnel, cloud or
device trust-anchor configuration. The variant still selects the real `ProductMobileApp` and real
NFC/C2 product composition; its native cleartext exception is restricted to numeric loopback.

Five automated tests pass: three direct PostgreSQL integration cases cover exact roles, real Mobile
authentication/session refresh and the complete lifecycle; two non-database guards cover the
loopback database URL and Mobile lifecycle-authority source boundary. Together they prove Tag B stays
unassigned, Tag A can be armed once by shortened validation fingerprint and provisioned through
Administrator RLS/audit without creating lifecycle evidence, and the following two commands produce
server-canonical Start then Stop. Core/Mobile are 288/253; all backend regressions remain green.

The later physical run used Java 17, Android SDK 36, ADB and the authorized `SM_A336B`. Its 66-MB
release APK built in 6m12s and installed successfully. The guarded helper applied exactly the two
approved USB reverse mappings. The Human Architect then observed Tag B as unassigned, controlled
Tag-A assignment with 2 AuditEvents and no lifecycle evidence, `Arbeitszeit gestartet`, and after
at least six seconds `Arbeitszeit gestoppt`. Final sanitized status was exactly 1 stopped TimeEntry,
2 WorkEvents, 2 Decisions, 2 Receipts, 1 Tag, 1 Assignment and 4 AuditEvents. Normal shutdown and
the disconnect helper succeeded; the final reverse table was empty. Full implementation,
verification and security boundaries are in
`ADO/05_Evidence/Block_D_Synthetic_Server_Connected_Android_E2E_Evidence.md` and
`ADO/05_Evidence/Block_D_Synthetic_Server_Connected_Android_E2E_Security_Review.md`.

## 7. Physical validation table — passed for approved Android device/tag set

| Required observation | Status | Evidence |
|---|---|---|
| Tester and date | Observed | Human Architect reported the physical run in the Technical-Lead task on 2026-07-14 |
| Android model and OS | Observed | Samsung Galaxy A33 5G running Android 15 |
| App build type/version | Observed | Internal `TapTim.e Validation` APK from EAS build `c459616c-3e90-49f5-a508-8044d05e1c25`, commit `7ac4fa4` |
| NFC library version | Prepared | `react-native-nfc-manager` 3.17.2 from lockfile |
| Physical tag product/type A | Observed | NTAG213; ten stable reads on the recorded Galaxy A33 5G |
| Physical tag product/type B | Observed | NTAG213; ten stable reads on the recorded Galaxy A33 5G and distinct from Tag A |
| Ten remove-and-retap reads per tag | Observed | Human Architect confirmed 10 successful reads for Tag A and 10 for Tag B; raw identifiers were not supplied |
| Stable identity per tag and distinct A/B identities | Observed | Validation app completed its guarded stability result, which requires 10 matching reads per slot, zero mismatches and distinct shortened fingerprints |
| Disabled-NFC behavior | Observed | With Android NFC disabled and the app reopened, the Human Architect confirmed the explicit disabled state and blocked scan action; after re-enabling NFC and reopening, the app returned to ready and scanning remained available |
| Timeout, cancel and scan-after-cleanup | Observed | Human Architect confirmed the 20-second no-tag timeout completed without incrementing the counter, explicit cancellation reported cleanly and the immediately following Tag-A scan succeeded, proving physical scan-after-cleanup |
| Rapid duplicate press | Observed | Human Architect double-pressed the validation scan action, presented Tag A once and confirmed the counter remained exactly `1`; presenting the tag again without a new app scan did not increment TapTim.e |
| Synthetic product build/install and exact USB loopback | Observed | 66-MB `TapTim.e Synthetic E2E` APK, SHA-256 `52257c14df918136ca689d15f10bcf1ccc84bbc911c1cb2f7977a116696e2624`, installed on `SM_A336B`; exactly ports 54321 and 3000 were reversed |
| Unassigned-tag product screen | Observed | Physical NTAG213 Tag B showed `Tag nicht zugeordnet`; both pre-arm and armed negative controls left Tags, Assignments and lifecycle counts at zero |
| Fingerprint-bound Tag-A provisioning | Observed | Only the 12-character shortened validation fingerprint was armed; capture produced 1 Tag, 1 Assignment and 2 AuditEvents with zero WorkEvents/Decisions/Receipts/TimeEntries |
| Server-confirmed Start then Stop | Observed | Product showed `Arbeitszeit gestartet` then, after at least six seconds, `Arbeitszeit gestoppt`; final server status showed 2 WorkEvents, 2 Decisions, 2 Receipts and 1 stopped TimeEntry |
| No raw UID/token/provider-error disclosure | Observed | Human Architect explicitly confirmed no raw UID, token, database/provider error or real person data was displayed |
| Normal shutdown and scoped transport cleanup | Observed | `synthetic_e2e_stopped`, `synthetic_e2e_loopback_reverse_removed`, shell variables unset and final `adb reverse --list` empty |

## 8. Remaining limits and gates

- Physical UID stability is proven for the recorded Galaxy A33/NTAG213 pair; behavior across a
  broader Android device/tag matrix remains unknown.
- UID cloning, emulation and unsuitable random/no-ID tags remain ADR-0009 limitations.
- Ambiguous evidence is volatile and can be lost when the app process terminates.
- There is no Block E offline queue/scheduler, C3 administration flow, iOS capture, NDEF flow,
  production cloud configuration, production data or deployment evidence.
- Operator provisioning must use canonical payloads; no in-product registration UI exists yet.
- After the active TapTim.e capture cleaned up, presenting the tag again caused Android to show
  the system prompt `Aktion wählen` on the Galaxy A33 5G. The same prompt appears when an NTAG213 is
  presented without first pressing `Tag A scannen`. This confirms that no second TapTim.e capture
  remained active; Android owns dispatch outside an explicit app capture. The behavior must be
  considered in pilot instructions and the later product NFC interaction design.
- The tester initially considered the unlabeled 12-character shortened SHA-256 value potentially to
  be a UID. This was a real presentation ambiguity, not raw-UID disclosure. The follow-up build now
  labels it explicitly as `PRÜF-FINGERPRINT · SHA-256 GEKÜRZT` and auto-increments its Android build
  version so an installed validation app can be upgraded unambiguously.
- Corrective commit `56790c2d52cd6a1a2fa2ecd3d8bb9740d9b1708b` passed all seven jobs in
  GitHub Actions run `29324366418`. EAS build `6969b72b-8f01-496e-95ff-4e481019bdf8` finished as
  Android build 2. Its 66-MB APK is available at
  `https://expo.dev/artifacts/eas/C3gI1SSOUM2gyC5QsiL1aJcWxpLOxYc4WaK_D7k3WL4.apk`, passed ZIP
  integrity verification and has SHA-256
  `14886c68a095b4ff92159e67ff4757524875018e5b624d81d9daceed7acf3121`.
- The existing 11 moderate dependency findings remain open; this task did not apply audit fixes.
- Two Supavisor connection modes remain unverified.
- The independent review accepted these limits, found no P0/P1/P2 and reported one corrected
  documentation-only P3 about the exact three-database-plus-two-guard test composition.

## 9. Required next action

The device-local and server-connected physical checklists are complete for one Galaxy A33 5G /
Android 15 and two NTAG213 tags. Correction commit `59c4ac7` passed all eight jobs in GitHub Actions
run `29333578360`; the strictly local physical product path and cleanup passed as recorded above.
The independent final architecture/security review of `4f540ca..ac5eeba` returned
`APPROVED WITH NON-BLOCKING FINDINGS`; D-FINAL-01's test-count wording is corrected and no blocker
remains. Block D is closed for the authorized Android-v1 device/tag scope. C3, Block E, production
cloud/data, iOS and broader pilot-device validation remain separately gated.
