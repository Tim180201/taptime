# Block D — NFC Runtime and Physical Validation Authorization

Status: Authorized — Awaiting Implementation
Authorization Date: 2026-07-14
Authorized Baseline: `4f540ca648b9ef98c5ad4ccf3798e0279fc8bb6c`
Human Architect Authorization: Explicitly supplied after C2 closure
Owner: Technical Lead
Architecture Authorities: ADR-0002, ADR-0008, ADR-0009, FB-001, TS-001, C1/C2 closures
Roadmap Scope: DT-053–DT-059; software completion remains gated by real-device evidence

## 1. Authorized objective

Activate the first real authenticated Android NFC product path:

```text
real Android NFC hardware
  -> actual NfcScanPort.scan()
  -> shared canonical UID codec
  -> private C2 scan-context client
  -> immutable WorkEvent/Receipt evidence
  -> private C2 lifecycle client
  -> server BusinessEngine decision
  -> truthful product UI result
```

This is one cohesive implementation task because payload representation, hardware capture lifetime,
server orchestration and UI truthfulness fail as one product interaction. It also closes the K2 port
bypass. It does not make the client a lifecycle authority and does not implement Block E's durable
offline queue or synchronization scheduler.

Codex may complete all software and automated verification. DT-058/DT-059 are complete only after a
Human Architect or delegated tester performs the recorded checklist on a real Android device with
real NFC tags. Until then, Block D must be reported as `Implemented — Awaiting Physical Device
Validation`, never as NFC-ready or pilot-ready.

## 2. Fixed payload and security decision

- Implement ADR-0009 exactly: Android UID, canonical `nfc:uid:v1:<UPPERCASE_HEX>`, no NDEF and no
  raw/legacy fallback.
- Put the pure codec in a shared non-React, non-native layer so this scan path and Block E's future
  registration path cannot diverge. Do not globally reinterpret existing arbitrary prototype
  `NfcPayload` fixtures.
- The codec accepts only an even 2–64 ASCII-hex sequence, canonicalizes lowercase to uppercase and
  rejects whitespace, separators, `0x`, odd length, Unicode lookalikes and out-of-bound values.
- The UID is a technical locator, not a secret or authenticator. Never put Customer, Organization,
  action, start/stop or personal data on the tag or derive it from the UID.
- C2 continues treating the canonical string as opaque. B5 tenant resolution and B6/Core remain the
  only assignment and lifecycle authorities. No migration `006` is authorized.
- Product NFC capture is Android-only. iOS/Web show a stable unsupported state and never instantiate
  an active native capture operation.

## 3. NFC adapter hardening

`RnNfcScanAdapter` remains the concrete `NfcScanPort`. Product orchestration must call its `scan()`
port method directly; `waitForNextTag()` must not remain as an alternative product entry point.

The adapter must:

- serialize `NfcManager.start()` with one shared start flight;
- allow exactly one native tag registration/listener at a time;
- coalesce concurrent `scan()` callers onto the same capture and never replace a live listener;
- apply one injected/testable default timeout of 20 seconds;
- expose a narrow cancellation/lifecycle capability owned by the runtime, not by the React screen;
- settle every caller on success, unreadable tag, registration failure, timeout, cancellation and
  runtime stop;
- remove the listener and await best-effort native unregistration exactly once before a later scan
  can register;
- tolerate late native callbacks and register/unregister races without double settlement, leaked
  listeners, unhandled rejections or a hanging Promise;
- map missing/invalid UID through the shared codec to `unreadable` without logging the raw UID.

Capability checks must distinguish `ready`, `not_supported` and `disabled`. Infrastructure errors
remain generic unavailable presentation and never become a business rejection.

## 4. Product scan orchestration

Add one Mobile application/runtime orchestrator outside React. It depends only on the actual
`NfcScanPort`, a narrow NFC lifecycle/capability port, the private C2 transport ports, an injected
session-context reader, clock and cryptographically secure UUID generator. Add a direct Expo-compatible
UUID dependency if the native runtime does not already guarantee `crypto.randomUUID()`; `Math.random`,
timestamps and device identifiers are forbidden as identity entropy.

For one accepted capture it must:

1. snapshot the current authenticated User/Organization/session generation and use its Organization
   only as requested scope;
2. call `NfcScanPort.scan()` once and retain the capture timestamp;
3. send only the canonical payload plus requested Organization to C2 scan-context resolution;
4. on resolved context, create one WorkEvent UUID, one Receipt UUID, `attemptNumber = 1` and the
   exact capture timestamp;
5. send only that immutable evidence to C2 lifecycle ingestion;
6. present the exact server outcome without re-evaluating, predicting or toggling start/stop.

The originating User/Organization/session generation must still match after every asynchronous
boundary and immediately before each C2 call. Sign-out, authority rejection, Membership-context
replacement or another user login cancels an active capture and invalidates every stale continuation.
A late NFC callback or server response from the old generation must never submit or publish state in
the new session. This protection is required even though every C2 request independently revalidates
its Bearer token, because a newly authenticated token must not adopt an older user's physical action.

No screen receives the C2 clients, access/refresh token, native manager or raw UID. The runtime exposes
one frozen scan facade with state subscription plus `scan`, `cancel` and same-evidence `retry` actions.
Rapid UI presses must not create a second capture or a second WorkEvent.

### Ambiguous transport result

If scan-context resolution fails before a WorkEvent exists, a later new scan is safe. Once lifecycle
evidence exists, a transient/unavailable result is ambiguous: the server may have committed while the
response was lost. Keep that exact command in volatile runtime memory and permit only an explicit
same-evidence retry with identical WorkEvent, Receipt, timestamp and `attemptNumber = 1`. Block new
scans while it is pending. Never fabricate a successful result.

Bind volatile pending evidence to the originating User and Organization. It may be retried only while
the current resolved session matches both. A different authenticated user must neither see its
details nor submit it. Sign-out remains available. Volatile evidence is not persisted and may be lost
on app termination; the UI and evidence package must disclose this limitation. Durable persistence,
offline capture, new retry attempts, scheduling/backoff and reconciliation remain Block E.

Authority rejection is not an ambiguous successful write and follows C1/C2 session behavior. A
server-acknowledged `synchronized`, `deferred` or `conflict` result clears the volatile pending command
after its truthful terminal presentation.

## 5. Product UI states

Replace the C2 holding copy with a small functional authenticated scan screen. It must be usable and
presentable, but this block is not a visual redesign.

The screen must cover at least:

- checking, ready, scanning and submitting;
- Android NFC unsupported and disabled;
- timeout/unreadable/cancelled;
- tag not assigned without disclosing which server object is absent;
- server-confirmed started and stopped;
- duplicate ignored;
- active entry for another target rejected;
- escalation/deferred/conflict using plain, non-technical German copy;
- transient scan-context failure, ambiguous lifecycle failure with same-evidence retry, and session
  rejection;
- sign-out at all times and cancel only during active capture.

The scan button is disabled outside the eligible ready state. No manual payload field, fake Customer,
local start/stop toggle, optimistic success, raw identifiers, database/provider error or secret may be
rendered. Accessibility labels/test IDs and readable touch targets are mandatory.

## 6. Mandatory automated verification

Add adversarial tests proving:

- every accepted/rejected codec case and exact canonical scan/registration equivalence;
- the installed Android uppercase UID shape remains compatible with the codec;
- one native start/registration under concurrent calls and one settlement for all callers;
- success, registration failure, timeout, explicit cancellation, stop/unmount, late callback and
  register/unregister race cleanup;
- a later scan works after every terminal path and no stale callback resolves it;
- only the real adapter's `scan()` drives the product orchestrator, closing K2;
- exact scan-context then lifecycle ordering, capture-time binding, secure unique IDs and no request
  when capture/resolution fails;
- every C2 lifecycle result maps to truthful UI state and no Mobile code contains start/stop rules;
- duplicate press creates one evidence set; transient lifecycle retry reuses byte-equivalent evidence;
- sign-out/session replacement cancels capture and stale callbacks/responses cannot cross
  User/Organization/session-generation boundaries;
- pending evidence cannot be retried under another User or Organization;
- unsupported platforms do not register NFC; React/product source remains free of token, manager,
  transport-client and raw-payload authority;
- all 154 Mobile, 127 C1/C2 API, 262 Core, B1/B3/B4/B5/B6 and build/typecheck regressions remain
  green, with migrations still exactly `001`–`005`.

CI must include the new Block D Mobile tests and an Android Expo export/build-level check that proves
the native product graph bundles. Synthetic tests do not count as DT-058.

## 7. Physical-device gate and evidence

Create `ADO/05_Evidence/Block_D_NFC_Runtime_Physical_Validation_Evidence.md` with automated results
and an initially truthful physical-validation table. Never invent device observations.

The real-device checklist must record:

- tester/date, exact Android model and OS, app build type/version, NFC library version;
- exact tag product/type for at least two physical tags, with only redacted or hashed UID evidence;
- ten remove-and-retap reads per tag producing one stable canonical identity per tag and distinct
  identities between tags;
- disabled-NFC handling, timeout, cancel, rapid duplicate press and scan-after-cleanup;
- product-screen capture of an unassigned tag and, when synthetic operator provisioning is available,
  one server-confirmed start then stop using the same assigned physical tag;
- absence of raw UID/token/error disclosure and all observed device/tag limitations.

If the full server-confirmed start/stop cannot be exercised because no synthetic physical-test
environment is available, record that item as outstanding. Hardware capture evidence alone may close
DT-016's old adapter assumption, but Block D's end-to-end outcome remains open.

## 8. Explicit non-goals

Block D does not authorize:

- NDEF read/write/provisioning, iOS NFC, background NFC or a second identifier scheme;
- C3 Organization/Admin bootstrap or customer/tag/assignment CRUD;
- DT-060–062 durable OfflineQueue/synchronization gateway, background scheduler, backoff or offline
  lifecycle mutation;
- DT-063–068 setup, tag-registration UI, exports or operations;
- changes to BusinessEngine decisions, B5/B6 authority/result semantics, C1 authentication, C2 HTTP
  routes, B3 schema/RLS or migrations `001`–`005`;
- production cloud/deployment, production credentials/data, analytics or production observability;
- claiming pilot readiness from emulator, unit test, Expo export or mocked NFC evidence.

Implementation ends at `Implemented — Awaiting Technical Lead Review` or, if no real-device evidence
was supplied, `Implemented — Awaiting Physical Device Validation and Technical Lead Review`. An
Implementation Agent must not commit/push or infer Block E, C3, deployment or production-data
authorization.
