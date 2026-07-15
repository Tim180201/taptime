# Block C3D Physical Validation Evidence

**Date:** 2026-07-15

**Status:** Physical-validation harness published and exact-head CI passed; C3D-LOOPBACK-01
locally corrected after the first real browser start; correction delta review, exact-head CI and
the restarted Human physical sequence remain pending

**Harness baseline:** `e697d468cf36e34325cd4c61f85f398c51ec4429`

**Harness commit:** `032ae9603a13c81e1f8dd880c42aa81828f017a4`

**Harness tree:** `d15e5346d8eca34d404242491dd7ac4b80f35574`

**Harness CI:** GitHub Actions `29401264170`, attempt 2 — exact harness SHA, ten of ten jobs passed

**Authority:** Existing Block C3D Human physical closure gate in
`ADO/02_Development/Block_C3D_Admin_Web_Android_Capture_Authorization.md`

## Why a harness extension was required

The earlier Block-D synthetic Android harness was not sufficient for the C3D closure sequence. It
deliberately supplied no C3C administration coordinator and exposed only an Employee-bound local
Auth identity. Admin Web Customer creation and protected Android Administrator provisioning would
therefore have failed closed before any physical observation.

The scoped C3D extension changes only strictly local synthetic validation infrastructure. It does
not change Admin Web, Mobile product code, C3C, schema migrations, Core Business Rules, production
configuration or product authority.

## Delivered validation boundary

- The loopback-only harness now composes the real C3C `AdminWriteSessionCoordinator` through a
  dedicated runtime login holding exactly `taptime_identity_resolver` and `taptime_admin_setup`.
- The local password/JWKS fixture exposes separate reserved-domain Employee and Administrator
  identities bound to the existing synthetic tenant. Both use the same operator-supplied,
  memory-only synthetic password; refresh rotation remains identity-bound.
- Employee setup projection is denied by the real C3C authority path. The Administrator can read
  the safe projection, create a Customer and atomically register/assign a Tag.
- Browser Auth CORS is allowed only for `http://127.0.0.1:5173`; `localhost`, LAN and other origins
  are rejected, and credential-cookie mode is not enabled.
- Admin Web API calls remain same-origin through the Vite loopback proxy. Auth, API and Web bind
  only numeric host loopback; Android reaches Auth/API only through the existing two `adb reverse`
  mappings.
- Sanitized terminal status adds Customer and administration-receipt counts. It never prints a
  raw/canonical NFC payload, token, private key, password or database/provider error.
- The previous fingerprint-armed Block-D regression path remains available but is not used to
  satisfy C3D; two administration receipts distinguish the real C3C physical setup path.

## Local automated verification

- Synthetic C3D/legacy server-connected E2E: 9/9, including exact role graphs, separate identities,
  identity-bound Administrator refresh, Employee denial, exact-origin CORS, real Customer creation,
  atomic Tag provisioning, disclosure-safe results and the retained Start/Stop/defer regression.
- Core: 290/290; Mobile: 338/338; Admin Web: 26/26; neutral C3 contract: 3/3.
- Direct PostgreSQL C3C administration: 75/75; backend API: 172/172.
- Synthetic harness, backend API, backend administration, Mobile and Admin Web TypeScript checks
  passed; synthetic harness and Admin Web production builds passed; Android Expo export passed.
- A live main-entry smoke started Auth/API/Admin Web on `127.0.0.1`, proved exact-origin browser
  preflight, Administrator login, proxied `/v1/session` and safe setup projection, then shut down
  the harness and disposable schema.
- `git diff --check` passed.

The harness commit passed all ten jobs in exact-head GitHub Actions run `29401264170`, attempt 2.
Attempt 1 passed all 189 C3B assertions but reported the pre-existing late PostgreSQL forced-database
cleanup event (`57P01`); the unchanged SHA passed the failed-job rerun. No C3B or workflow source
was part of the harness change.

## C3D-LOOPBACK-01 physical-start correction

The first controlled Human sequence proved the Android Employee denial on the freshly built Galaxy
A33 app, then the actual Admin Web entry point displayed `TapTim.e ist nicht konfiguriert.` before
any Administrator credential or setup write. Repository reading showed that the Admin Web runtime
parser accepted only HTTPS while the authorized loopback harness necessarily supplied
`http://127.0.0.1:54321`. The earlier live smoke had exercised Auth/API/proxy behavior but not the
actual `main.tsx` runtime-configuration branch, so it had not exposed this mismatch.

The narrow correction accepts HTTP only for canonical origin `http://127.0.0.1:54321`; HTTPS
remains the general path, while alternate IPv4 spellings, IPv6/other loopback, `localhost`, a wrong
port, LAN/remote hosts, embedded credentials, paths, queries, fragments and short keys remain rejected. No Mobile, backend, C3C,
schema, Core rule, production endpoint or product authority changed. Local post-correction evidence
is Admin Web 26/26 plus build/typecheck, Core 290/290, Mobile 338/338, neutral contract 3/3,
synthetic harness 9/9 and their relevant TypeScript checks. Reloading the actual Vite entry point
then rendered the Administrator sign-in surface. The preliminary Employee observation is not
promoted in the checklist because the controlled sequence was intentionally aborted and will be
restarted on the reviewed exact-head correction.

## Human observation checklist

| Observation | Status |
|---|---|
| Galaxy A33 connected over authorized USB; NFC enabled; exact two reverse mappings | Pending |
| Employee login exposes no `NFC-Einrichtung` capability | Pending |
| Administrator Admin Web login and Customer creation | Pending |
| Safe Web projection contains no raw UID/canonical payload | Pending |
| Android Administrator projection sees the created Customer | Pending |
| Capture interrupted by force-stop/restart creates no Tag, Assignment or receipt | Pending |
| Physical NTAG213 capture/register/assign succeeds through real C3C | Pending |
| Web/Android show the same safe label, fingerprint and Customer assignment | Pending |
| Same Administrator scans the assigned Tag for server-backed Start then Stop | Pending |
| Fresh-run sanitized counts equal Customers 2, Tags 1, Assignments 1, admin receipts 2, WorkEvents 2, Decisions 2, lifecycle Receipts 2, stopped TimeEntries 1 and AuditEvents 5 | Pending |
| No raw UID/payload, token, password, provider/database error or real-person data disclosed | Pending |
| Web/Android sign-out, harness shutdown, schema cleanup and scoped reverse removal | Pending |

Only the Human Architect or a delegated physical tester may mark these observations passed. Until
then C3D remains open. C3E, production, distribution and personal data remain unauthorized.
