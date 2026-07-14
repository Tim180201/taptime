# Block D — Synthetic Server-connected Android E2E Evidence

Status: Software Technical-Lead Approved after Three Corrections — Awaiting GitHub CI and Local Android APK/Physical Run

Date: 2026-07-14

Authorized baseline: `b55c9f6f186374c4de987bfa6cfbd391ee03c833`

Implementation commit: pending first approved commit

## 1. Truthful outcome

A strictly local synthetic environment now exercises the real Mobile email/password adapter,
issuer-bound asymmetric JWT verification, real C2 routes, B4/B5/B6, PostgreSQL RLS/transactions and
the unchanged Core `BusinessEngine`. Its automated direct-PostgreSQL test proves generic unassigned
Tag B, fingerprint-bound audited Tag-A fixture assignment, no lifecycle mutation during
provisioning, then server-canonical Start and Stop six seconds apart.

No current-task physical Android run occurred. This implementation environment has no Android
SDK/JDK/ADB or connected device. Therefore the following are not claimed:

- no physical Tag-B unassigned product-screen observation;
- no physical Tag-A provisioning capture;
- no physical server-confirmed Start/Stop;
- no installed synthetic product APK or verified USB reverse table;
- no Supabase Cloud/provider or production deployment validation.

No external cloud/tunnel/build resource was created because the selected local approach does not
need one and the Human Architect explicitly gated such creation.

## 2. Connection and runtime architecture

Selected transport: numeric Android loopback over USB `adb reverse`.

```text
TapTim.e Synthetic E2E APK (distinct package, real ProductMobileApp)
  -> 127.0.0.1:54321 -> USB reverse -> local synthetic password/Auth/JWKS
  -> 127.0.0.1:3000  -> USB reverse -> local real C2 HTTP router
  -> B4 identity + active Membership
  -> B5 opaque assignment resolution
  -> B6 transaction + real Core BusinessEngine
  -> PostgreSQL 17 migrations 001–005 / RLS / audit
```

Both host HTTP listeners and PostgreSQL bind only loopback. The Android variant has a distinct
`com.tim180201.mobile.synthetic` identity, still selects the normal product composition, and adds a
native cleartext exception only for `127.0.0.1`. LAN binding, public tunnels, self-signed device
trust anchors and cloud resources were rejected in the implementation plan.

## 3. Synthetic data and assignment workflow

- one `.invalid` synthetic login identity;
- one synthetic Employee, one synthetic provisioning Administrator and one Organization;
- one active synthetic Customer;
- no initial NFC Tag/Assignment;
- no real person, Organization, Customer, credential or production record.

The operator supplies only Tag A's already displayed 12-character shortened SHA-256 validation
fingerprint. The next unresolved scan provisions only if its private canonical payload matches that
fingerprint. Tag B mismatch remains unresolved. The assignment uses the Administrator runtime role,
active Administrator Membership, transaction-local context, existing RLS and existing audit
triggers. No generic endpoint or product administration UI was added.

The provisioning capture deliberately returns generic not-resolved and creates no lifecycle
evidence. This makes the next Tag-A scan the first genuine lifecycle command.

## 4. Automated integration evidence

Runtime: Node `24.17.0`; PostgreSQL `17.10`; direct numeric-loopback connection.

| Automated case | Result |
|---|---|
| Remote/wrong database URL guard | Passed |
| Mobile lifecycle-authority source boundary | Passed |
| Exact four runtime role graphs and no inherited direct table access | Passed |
| Real Mobile password adapter: invalid credentials | Passed |
| Real Mobile password adapter: signed login and rotated refresh | Passed |
| B4 `/v1/session` User/Membership/Organization resolution | Passed |
| Tag B generic server-side `404 not_found` | Passed |
| Tag B cannot consume Tag-A fingerprint arm | Passed |
| Tag A one-shot assignment through Administrator RLS | Passed; two administrative AuditEvents |
| Provisioning capture lifecycle count | Passed; zero WorkEvents/Decisions/Receipts/TimeEntries |
| Assigned Tag-A context through B5 | Passed |
| First lifecycle command | Passed; genuine Core `time_entry_started` |
| Second command six seconds later | Passed; genuine Core `time_entry_stopped` |
| Final reciprocal database trace | Passed; 2 WorkEvents, 2 Decisions, 2 Receipts, 1 stopped TimeEntry, 4 AuditEvents |
| Safe diagnostics | Passed; fixed enum only, no payload/token |

Focused workspace result at evidence creation: 5 tests passed in one file; tests-inclusive
Typecheck passed; build passed. Mobile passed 253 tests in 16 files after adding the synthetic
variant boundary regression. Full repository regression results are recorded in Section 6 after the
completion run.

## 5. Physical server-connected checklist — outstanding

The prior Galaxy A33 5G / Android 15 / two-NTAG213 device-local validation remains valid evidence for
NFC stability and cleanup, but it did not use Auth/C2/PostgreSQL and cannot satisfy this table.

| Required observation | Status | Evidence |
|---|---|---|
| Synthetic product APK built locally and installed | Outstanding | Android SDK/JDK/ADB unavailable in the implementation environment |
| USB reverse contains only Auth 54321 and C2 3000 | Outstanding | Requires attached authorized Android device |
| Real synthetic password login and Membership screen | Outstanding | No device run in this task |
| Physical NTAG213 Tag B is server-side unassigned | Outstanding | Automated synthetic payload proof is not physical evidence |
| Physical Tag A matches approved shortened fingerprint | Outstanding | Raw UID must not be recorded |
| Tag-A provisioning capture creates audit but no lifecycle evidence | Outstanding | Requires server-connected device run |
| First post-provision Tag-A scan shows server-confirmed Start | Outstanding | Requires server-connected device run |
| Second Tag-A scan after at least six seconds shows server-confirmed Stop | Outstanding | Requires server-connected device run |
| No raw UID/token/provider error in UI, terminal or captured Evidence | Outstanding | Source/automated boundary passed; physical observation still required |
| Tester/date/device/OS/app build/PostgreSQL/runtime versions recorded | Outstanding | Human/delegated observation required |

## 6. Complete verification results

All automated checks below ran under Node `24.17.0`. Direct database suites used one disposable,
host-loopback PostgreSQL `17.10` cluster; no remote or cloud service was contacted.

| Verification | Result |
|---|---|
| `npm ci` | Passed; lockfile-exact install, 605 packages audited; existing 11 moderate findings remain |
| Root tests-inclusive Typecheck | Passed; Core test sources and Mobile sources included |
| Core tests | 288/288 passed in 43 files |
| Mobile tests | 253/253 passed in 16 files |
| B1 Typecheck/tests | Passed; 39 passed, 2 permitted Supavisor-mode skips |
| B3 Typecheck/tests | Passed; 125/125 |
| B4 Typecheck/tests | Passed; 55/55 |
| B5 Typecheck/tests | Passed; 42/42 |
| B6 Typecheck/tests | Passed; 68/68 |
| C1/C2 API Typecheck/tests | Passed; 127/127 in 2 files |
| Synthetic Android E2E Typecheck/tests | Passed; 5/5 in 1 file |
| Dedicated synthetic PostgreSQL 17 CI job | Added; remote push execution pending |
| Compiled harness startup/normal shutdown | Passed; loopback services started, `stop` returned and cleanup completed |
| Root/workspace build | Passed, including Core and every backend workspace |
| Product Android Expo export | Passed; Hermes bundle generated from 780 modules |
| Synthetic Android Expo export | Passed; Hermes bundle generated from 780 modules |
| Synthetic Expo config and variant mismatch | Passed; exact package/name/scheme, inconsistent variant rejected |
| Disposable synthetic Android prebuild inspection | Passed; distinct application ID, base cleartext denied, only `127.0.0.1` allowed |
| Local release APK/installation | Unavailable; Android SDK/JDK/ADB and attached device absent; helper stopped before prebuild |
| Native-project preservation guard | Passed in source/regression review; any existing tracked or untracked `apps/mobile/android` directory is refused without deletion |
| USB reverse cleanup helper | Passed in source/regression review; removes only approved ports `54321` and `3000`, refuses unexpected targets and preserves unrelated mappings |
| Migrations `001`–`005` | Unchanged by repository diff |
| `git diff --check` | Passed |

The generated Expo output and disposable prebuild directory were verification artifacts outside the
repository and were removed after inspection. The tracked implementation neither creates nor invokes
an EAS/cloud/tunnel resource. The pre-existing untracked `research/` directory remained outside every
read, write, test and diff scope used for this implementation.

## 7. Boundaries and remaining gates

- The local Auth fixture proves real password checking, asymmetric token verification and refresh
  through the production Mobile adapter. It is not hosted Supabase/GoTrue operational evidence.
- The synthetic assignment mechanism is a one-shot test fixture, not C3 or an Administration API.
- There is no durable offline queue, retry scheduler, background synchronization or Block-E work.
- There is no production deployment, cloud configuration, real personal data or production secret.
- A normal shutdown removes synthetic schema data and generated runtime logins; crash recovery uses
  the dedicated database reset/drop procedure.
- The existing eleven moderate dependency findings and two unverified Supavisor modes remain open.
- `research/` was neither read nor changed for implementation.

## 8. Gate status

Technical-Lead review returned `APPROVED` after correcting three blocking review findings: the
build helper can no longer replace an existing untracked native Android project, successful
installations now name and implement a mandatory scoped USB-reverse cleanup action, and the full
five-test PostgreSQL harness has its own CI job. The truthful status before the first push is:

`Software Technical-Lead Approved after Three Corrections — Awaiting GitHub CI and Local Android APK/Physical Run`

Commit/push is authorized. No GitHub-CI success is claimed until the pushed workflow completes, and
no physical completion is claimed until the Human Architect or delegated tester records the table
above.
