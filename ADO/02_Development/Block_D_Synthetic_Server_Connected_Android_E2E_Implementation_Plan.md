# Block D — Synthetic Server-connected Android E2E Implementation Plan

Status: Software Technical-Lead and GitHub-CI Approved after Five Corrections — Awaiting Local Android APK/Physical Run

Date: 2026-07-14

Authorized baseline: `b55c9f6f186374c4de987bfa6cfbd391ee03c833`

Authority: Human Architect instruction for the next Block-D slice

Related authorities: ADR-0008, ADR-0009, TS-001, C2 closure,
`Block_D_NFC_Runtime_Physical_Validation_Authorization.md`,
`Block_D_Physical_Validation_App_Authorization.md`

## 1. Objective and fixed boundary

Provide a reproducible, strictly local and non-production environment in which the unchanged
Android product composition can exercise this complete path with only synthetic identities and
tenant data:

```text
physical NTAG213
  -> real RnNfcScanAdapter.scan()
  -> canonical nfc:uid:v1 payload
  -> real Mobile email/password adapter
  -> cryptographically signed local synthetic access token
  -> real C2 HTTP routes
  -> B4/B5/B6 authority and PostgreSQL RLS/transactions
  -> genuine Core BusinessEngine decision
  -> truthful product ScanScreen outcome
```

This slice is test infrastructure. It does not create a production backend, C3 administration,
Block-E offline synchronization, cloud resources, a deployment path or a new Business Rule. It
does not alter migrations `001`–`005` or the Core decision model.

## 2. Connection decision — selected before implementation

### Selected: USB `adb reverse` to numeric device loopback

The Android test build shall address Auth and C2 only as `http://127.0.0.1:<port>`. A USB-connected,
explicitly trusted Android device maps those device-local ports to host processes with
`adb reverse`. Auth, C2 and PostgreSQL remain bound to host loopback; no service listens on the LAN.

This is the safest currently practical option because it:

- creates no cloud or tunnel resource and requires no router/firewall exposure;
- preserves Mobile's existing fail-closed rule that permits plaintext HTTP only for numeric
  loopback test infrastructure;
- avoids trusting a development certificate authority on the device;
- keeps PostgreSQL entirely host-local and forwards only the two narrow HTTP ports;
- is removable and observable through the Android Debug Bridge port table;
- works with the real native Android product graph rather than an emulator-only transport.

The dedicated synthetic Android variant has a distinct application ID and may opt into cleartext
only for loopback test traffic. Runtime configuration still rejects every remote HTTP host. The
ordinary product and physical-validation variants retain their existing transport behavior.

### Rejected for this slice

- **LAN binding:** exposes Auth/API traffic to the local network and conflicts with the current
  numeric-loopback-only Mobile security boundary.
- **Public tunnel:** creates an external resource and attack surface; the Human Architect has not
  authorized its creation.
- **Cloud Supabase/API:** would be deployment and cloud provisioning, both explicitly excluded.
- **Device-trusted self-signed HTTPS:** requires installing a trust anchor and adds certificate
  lifecycle/routing complexity without improving isolation over USB loopback for this one test.

If USB reverse forwarding proves unavailable on the target device, implementation stops at that
environmental gate. No tunnel or cloud fallback is created without new explicit approval.

Primary platform evidence: Android documents `adb reverse` for device-to-development-host port
forwarding and Network Security Configuration for narrowly scoped cleartext exceptions:
`https://developer.android.com/develop/ui/views/layout/webapps/access-local-server` and
`https://developer.android.com/privacy-and-security/security-config`.

## 3. Planned implementation

### 3.1 Isolated synthetic E2E workspace

Add one clearly named Node-24 workspace that is impossible to mistake for a production runtime. It
will:

- reject every non-loopback PostgreSQL host and every database name outside the dedicated
  `taptime_synthetic_android_e2e` namespace before destructive setup;
- apply only the existing migrations `001`–`005` to that disposable database;
- create synthetic-only least-privilege C2 and one-shot provisioning logins with generated runtime
  passwords that are never printed;
- seed one synthetic User, Organization, Employee Membership and Customer;
- generate an ephemeral asymmetric signing key and expose only the matching local JWKS;
- verify a caller-supplied synthetic password and rotate opaque refresh tokens in memory;
- compose the real C2 router with the real B4, B5 and B6 implementations;
- bind Auth and C2 to `127.0.0.1` only and emit only fixed, non-sensitive status codes.

The local auth fixture is not a provider or production-auth substitute. Its purpose is to exercise
the real Mobile password adapter, asymmetric signature verification, issuer/subject binding,
server Membership resolution and refresh path without static bearer-token injection or a cloud
resource.

### 3.2 Controlled Tag-A assignment

No generic administration endpoint is added. The process exposes a local operator action only to
its own terminal. The operator arms one assignment using the already-observed 12-character
shortened SHA-256 validation fingerprint for Tag A. The next unresolved scan is assigned only if
its canonical payload hashes to that fingerprint.

Provisioning uses a separate non-superuser Administrator login, transaction-local User,
Organization, Membership and correlation context, the existing Administrator RLS policy and the
existing atomic audit triggers. The canonical payload is held only where technically required for
lookup and persistence; it is never printed, returned by the operator control or written to
Evidence. A mismatch stays unassigned and does not consume the one-shot arm.

The provisioning capture returns the normal disclosure-safe `tag_not_assigned` result and never
creates a WorkEvent. The subsequent product scan is therefore the first lifecycle scan for the now
assigned Tag A.

### 3.3 Android product test variant

Add a distinct `synthetic-e2e` build identity that still selects `ProductMobileApp` and the real
`ProductMobileRuntime`. It embeds only public loopback URLs and the synthetic publishable key. It
does not expose tokens, native manager, payload, provider errors or test provisioning controls to
React. Variant mismatch fails closed.

Local build/install helpers shall use Expo prebuild/Gradle and `adb`; no EAS or other remote build
is started by this task.

## 4. Required automated and manual evidence

Automated integration tests shall prove at minimum:

- valid password authentication through the real Mobile adapter and asymmetric C2 verification;
- invalid credentials fail without provider detail;
- Tag B remains server-side unresolved;
- only a matching armed fingerprint provisions Tag A and emits administrative audit evidence;
- provisioning creates no WorkEvent, Decision, Receipt or TimeEntry;
- first assigned Tag-A lifecycle command is server-canonical Start;
- a second command more than five seconds later is server-canonical Stop;
- database evidence contains the reciprocal WorkEvent/Decision/TimeEntry/Receipt/Audit links;
- the Mobile/client path submits evidence but contains no Start/Stop rule;
- services bind only loopback, runtime database logins remain least privilege and no sensitive
  value enters diagnostics.

The physical table remains human-observed. Automated tests, local builds and prior tag fingerprints
must not be reported as a physical server-connected result.

## 5. Security review gates

- no real email, person, Organization, UID, token, password or provider error in committed files,
  logs or Evidence;
- password supplied at runtime and validated as synthetic-test input; private signing key and
  refresh tokens are memory-only;
- no bearer token or canonical payload in command-line arguments;
- no database service, Auth service or API bound outside loopback;
- exact C2 least-privilege role graphs and B3 RLS/constraints remain active;
- one-shot provisioning is fingerprint-bound, Administrator-RLS constrained and audited;
- test database guard fails before reset on remote or non-synthetic targets;
- `research/` remains untouched.

## 6. Planned verification

- synthetic E2E tests-inclusive Typecheck, tests and build;
- Mobile tests-inclusive Typecheck and complete Mobile tests;
- C2/B1/B3/B4/B5/B6 regressions against local PostgreSQL;
- Core tests and workspace build;
- product Android Expo export plus local synthetic Android configuration/prebuild evidence where
  the installed Android SDK permits it;
- migration set/hash invariants, `git diff --check`, changed-file and `research/` scope checks.

Technical-Lead review returned `APPROVED` after five blocking corrections: an existing untracked
native Android project is now preserved fail-closed, successful USB reverse mappings have an exact
scoped disconnect helper, the five-test PostgreSQL harness is enforced by a dedicated CI job, and
that clean Linux job now builds every required workspace declaration before Typecheck and runs
PostgreSQL 17 on host loopback rather than weakening the server-address guard for Docker bridging.
Commit/push is therefore authorized. Physical completion remains gated on the separate checklist.
