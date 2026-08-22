# Block D — Synthetic Server-connected Android E2E Evidence

Status: Completed — Technical-Lead/GitHub-CI, Physical Android E2E and Independent Review Approved

Date: 2026-07-14

Authorized baseline: `b55c9f6f186374c4de987bfa6cfbd391ee03c833`

Approved implementation commits: `3fe76ed`, `b584568`, `d32702b`, `59c4ac7`

## 1. Truthful outcome

A strictly local synthetic environment now exercises the real Mobile email/password adapter,
issuer-bound asymmetric JWT verification, real C2 routes, B4/B5/B6, PostgreSQL RLS/transactions and
the unchanged Core `BusinessEngine`. Three direct PostgreSQL integration cases prove exact runtime
roles, real Mobile authentication/session refresh and generic unassigned Tag B, fingerprint-bound
audited Tag-A fixture assignment, no lifecycle mutation during provisioning, then server-canonical
Start and Stop six seconds apart. Two additional non-database guards enforce the loopback database
URL and Mobile lifecycle-authority source boundary.

The Human Architect completed the physical run on the approved Galaxy A33 5G / Android 15 with two
NTAG213 tags. Java 17, Android SDK/API 36, Build Tools 36.0.0, NDK 27.1, CMake 3.22.1 and ADB were
used. The distinct `com.tim180201.mobile.synthetic` release APK built in 6m12s, installed through
the guarded helper, authenticated with the per-run synthetic account, rejected physical Tag B,
provisioned physical Tag A without lifecycle mutation, and then displayed server-confirmed Start
and Stop. Final PostgreSQL evidence was exactly 2 WorkEvents, 2 canonical Decisions, 2 Receipts,
1 stopped TimeEntry, 1 Tag, 1 Assignment and 4 AuditEvents.

This proves the approved strictly local Android product path on the recorded device/tag set. It
does not claim Supabase Cloud/provider operations, production deployment, production secrets/data,
iOS support, broad Android device coverage or Block-E synchronization.

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

Focused workspace result at evidence creation: 5 tests passed in one file — 3 direct PostgreSQL
integration cases and 2 non-database safety/source guards; tests-inclusive Typecheck passed; build
passed. Mobile passed 253 tests in 16 files after adding the synthetic variant boundary regression.
Full repository regression results are recorded in Section 6 after the completion run.

## 5. Physical server-connected checklist — passed

The prior Galaxy A33 5G / Android 15 / two-NTAG213 device-local validation remains valid evidence for
NFC stability and cleanup, but it did not use Auth/C2/PostgreSQL and cannot satisfy this table.

| Required observation | Status | Evidence |
|---|---|---|
| Synthetic product APK built locally and installed | Passed | 66-MB release APK; SHA-256 `52257c14df918136ca689d15f10bcf1ccc84bbc911c1cb2f7977a116696e2624`; version 1.0.0/code 1; target SDK 36; guarded streamed install returned `Success` |
| USB reverse contains only Auth 54321 and C2 3000 | Passed | Authorized device `SM_A336B`; install helper verified exactly `tcp:54321 -> tcp:54321` and `tcp:3000 -> tcp:3000` |
| Real synthetic password login and Membership screen | Passed | Real Mobile password adapter authenticated the `.invalid` fixture and enabled the Employee product scan screen; sensitive values were not printed or captured |
| Physical NTAG213 Tag B is server-side unassigned | Passed | Product showed `Tag nicht zugeordnet`; before arming and while armed, status remained zero across Tags, Assignments and lifecycle evidence |
| Physical Tag A matches approved shortened fingerprint | Passed | Operator armed only the previously displayed 12-character shortened SHA-256 validation fingerprint; no raw UID was recorded |
| Tag-A provisioning capture creates audit but no lifecycle evidence | Passed | Status moved to 1 Tag, 1 Assignment and 2 AuditEvents while WorkEvents, Decisions, Receipts and TimeEntries remained zero |
| First post-provision Tag-A scan shows server-confirmed Start | Passed | Product showed `Arbeitszeit gestartet`; status showed 1 WorkEvent, 1 Decision, 1 Receipt and 1 active TimeEntry |
| Second Tag-A scan after at least six seconds shows server-confirmed Stop | Passed | Product showed `Arbeitszeit gestoppt`; final status showed 2 WorkEvents, 2 Decisions, 2 Receipts and 1 stopped TimeEntry |
| No raw UID/token/provider error in UI, terminal or captured Evidence | Passed | Human Architect explicitly confirmed no raw UID, token, database/provider error or real person data was displayed |
| Tester/date/device/OS/app build/PostgreSQL/runtime versions recorded | Passed | Human Architect; 2026-07-14; Samsung Galaxy A33 5G (`SM_A336B`), Android 15; app 1.0.0/code 1; Node 24.17.0; PostgreSQL 17.10; Java 17.0.19 |

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
| Synthetic Android E2E Typecheck/tests | Passed; 5/5 in 1 file: 3 direct PostgreSQL integration cases and 2 non-database safety/source guards |
| Dedicated synthetic PostgreSQL 17 CI job | Passed in GitHub Actions runs `29329906106` and `29333578360`; latest implementation run is bound to correction commit `59c4ac7`; Typecheck, all 3 direct PostgreSQL cases, both guards, build and loopback container cleanup are green |
| Compiled harness startup/normal shutdown | Passed; loopback services started, `stop` returned and cleanup completed |
| Root/workspace build | Passed, including Core and every backend workspace |
| Product Android Expo export | Passed; Hermes bundle generated from 780 modules |
| Synthetic Android Expo export | Passed; Hermes bundle generated from 780 modules |
| Synthetic Expo config and variant mismatch | Passed; exact package/name/scheme, inconsistent variant rejected |
| Disposable synthetic Android prebuild inspection | Passed; distinct application ID, base cleartext denied, only `127.0.0.1` allowed |
| Local release APK/installation | Passed; 66-MB release APK built in 6m12s, integrity hash recorded above and guarded streamed install succeeded on `SM_A336B` |
| Tracked prebuild-state preservation | Passed after Technical-Lead correction; the first real prebuild rewrite was reverted and the helper now restores exact `package.json` content even on failure |
| Native-project preservation guard | Passed in source/regression review; any existing tracked or untracked `apps/mobile/android` directory is refused without deletion |
| USB reverse cleanup helper | Passed in source/regression review; removes only approved ports `54321` and `3000`, refuses unexpected targets and preserves unrelated mappings |
| Physical normal shutdown and transport cleanup | Passed; `stop` returned `synthetic_e2e_stopped`, disconnect returned `synthetic_e2e_loopback_reverse_removed`, password/database variables were unset and final `adb reverse --list` was empty |
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
- Physical evidence covers the recorded Galaxy A33 5G / Android 15 and two NTAG213 tags, not a
  broader Android compatibility matrix or production pilot fleet.
- Independent review of `4f540ca..ac5eeba` returned `APPROVED WITH NON-BLOCKING FINDINGS`: no
  P0/P1/P2 and one accepted/corrected documentation-only P3 about the exact test composition.

## 8. Gate status

Technical-Lead review returned `APPROVED` after six blocking corrections: native-project
preservation, scoped USB reverse cleanup, dedicated CI enforcement, clean-Linux dependency builds,
strict host-loopback PostgreSQL execution and exact tracked-state restoration after Expo prebuild.
The first five corrections passed all eight jobs in run `29329906106`; correction commit `59c4ac7`
passed all eight jobs in run `29333578360`. The Human Architect then completed and explicitly
confirmed every physical checklist outcome above. The truthful status is:

`Completed — Technical-Lead/GitHub-CI, Physical Android E2E and Independent Review Approved`

The local implementation, physical gate and independent review are complete. D-FINAL-01 corrected
the claim from five direct database tests to the truthful three database cases plus two guards. No
blocker remains. C3, Block E and cloud/production operations remain outside this evidence and
unauthorized.
