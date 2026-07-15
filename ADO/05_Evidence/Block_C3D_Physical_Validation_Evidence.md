# Block C3D Physical Validation Evidence

**Date:** 2026-07-15

**Status:** PASSED — C3D-CORS-01/C3D-FETCH-01 correction independently approved, exact-head CI
green and complete fresh Human physical validation passed on the approved Galaxy A33/NTAG213 set

**Harness baseline:** `e697d468cf36e34325cd4c61f85f398c51ec4429`

**Harness commit:** `032ae9603a13c81e1f8dd880c42aa81828f017a4`

**Harness tree:** `d15e5346d8eca34d404242491dd7ac4b80f35574`

**Harness CI:** GitHub Actions `29401264170`, attempt 2 — exact harness SHA, ten of ten jobs passed

**Validated correction commit:** `e686578751e8e09d7a8a48c3fd3058825dcedbf7`

**Validated correction tree:** `f80e700fd3e6e519573954ac8004fd4bbedea1c4`

**Validated correction CI:** GitHub Actions `29405184995`, attempt 1 — exact correction SHA, ten
of ten jobs passed

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
- Core: 290/290; Mobile: 338/338; Admin Web: 27/27; neutral C3 contract: 3/3.
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
port, LAN/remote hosts, embedded credentials, paths, queries, fragments and short keys remain
rejected. No Mobile, backend, C3C, schema, Core rule, production endpoint or product authority
changed. Correction commit `ad64cec3660e9bf89bcff1c334d01dbd79081ad5`, tree
`71bd087d7f5ac27abb1540f0c0a39266e2cc86bf`, passed independent read-only delta review with zero
open P0/P1/P2/P3 and all ten jobs in exact-head GitHub Actions run `29402429508`, attempt 1.
The Human gate was therefore permitted to restart. The preliminary Employee observation is not
promoted in the checklist because the complete sequence must remain one fresh reviewed exact-head
run.

## C3D-CORS-01 and C3D-FETCH-01 restarted-gate corrections

The restarted real-browser sequence exposed two further runtime integration gaps before any setup
write or NFC capture:

- **C3D-CORS-01:** `@supabase/auth-js` sends `X-Supabase-Api-Version` on password-auth requests,
  but the loopback harness preflight allowlist omitted that header. The browser therefore blocked
  sign-in even though the visible form and credentials were valid. The harness now permits that
  exact SDK header in addition to its existing narrow set, while retaining exact-origin,
  no-credentials CORS. The PostgreSQL-backed harness test drives the real preflight and actual
  password request with the header and asserts the exact response allowlist.
- **C3D-FETCH-01:** `AdminWebApiClient` stored the browser's `fetch` function unbound. Real WebKit
  and Chromium reject that invocation with `TypeError: Illegal invocation`, so `/v1/session` was
  never sent after successful Auth. The default client now invokes `globalThis.fetch(...)` with
  its required receiver while preserving the existing fail-closed redirect handling.
  A receiver-sensitive regression test fails on an unbound invocation and passes only through the
  corrected default client.

Correction commit `e686578751e8e09d7a8a48c3fd3058825dcedbf7`, tree
`f80e700fd3e6e519573954ac8004fd4bbedea1c4`, passed independent read-only delta review with zero
open P0/P1/P2/P3 and all ten jobs in exact-head GitHub Actions run `29405184995`, attempt 1. The
review independently reproduced Core 290/290, Mobile 338/338, Admin Web 27/27, neutral contract
3/3 and PostgreSQL-backed harness 9/9 plus the relevant TypeScript checks, builds and
`git diff --check`. Those prerequisites authorized one complete fresh Human sequence; no
observation from either aborted browser attempt was carried forward.

## Completed Human physical validation

The Human Architect completed the fresh sequence against correction commit `e686578` on the
approved Galaxy A33/Android device and physical NTAG213. The installed synthetic APK SHA-256 was
`a0424934eaf85e4e9f92c8e84ab26abf89e64c147ba35d725e65aa173d076da1`. Auth and API were reachable
only through the exact scoped numeric-loopback reverse mappings during the run.

- Employee sign-in exposed no `NFC-Einrichtung`; sign-out succeeded.
- Administrator Admin Web sign-in created synthetic Customer `C3D Physischer Test 2026-07-15`.
  Web showed only the safe Organization/Customer/Tag projection and no raw UID/canonical payload.
- Android Administrator refresh showed the same new Customer. A capture interrupted by Android
  force-stop/restart preserved the valid session/projection and created no Tag, Assignment or
  administration receipt.
- Real C3C provisioning registered and assigned physical Tag label `C3D Eingang 2026-07-15` to the
  new Customer. Web and Android agreed on the safe fingerprint `B55E8B6AEB30`, label, Customer and
  assigned state.
- The first lifecycle attempt displayed the fail-closed `Zuordnung nicht erreichbar`; sanitized
  database evidence remained unchanged at zero WorkEvents, Decisions, lifecycle Receipts and
  TimeEntries. Read-only replay with both Administrator and Employee authority then resolved the
  stored Tag to its one active assignment with HTTP 200. A temporary disclosure-safe loopback proxy
  observed only route/status/body length and the approved 12-character fingerprint: the controlled
  retry carried fingerprint `B55E8B6AEB30`, resolution returned HTTP 200 and lifecycle Start returned
  HTTP 200. After restoring the normal direct `tcp:3000 -> tcp:3000` mapping and removing the proxy,
  the next scan returned `Arbeitszeit gestoppt`. No retry duplicated a lifecycle mutation.
- Final sanitized state was exactly Customers 2, Tags 1, Assignments 1, admin receipts 2,
  WorkEvents 2, canonical Decisions 2, lifecycle SyncReceipts 2, one stopped TimeEntry and
  AuditEvents 5. Decision distribution was exactly one `time_entry_started` and one
  `time_entry_stopped`, with no started TimeEntry remaining.
- Android and Admin Web sign-out succeeded. Harness/Auth/API/Web and the temporary proxy stopped;
  schema plus migration table were removed; ports 54321/3000/5173 had zero listeners; the two
  scoped reverse mappings and all C3D screen sessions were absent.
- No raw UID/canonical payload, token, password, private key, database/provider error or real-person
  data was displayed or written to evidence.

## Human observation checklist

| Observation | Status |
|---|---|
| Galaxy A33 connected over authorized USB; NFC enabled; exact two reverse mappings | Passed |
| Employee login exposes no `NFC-Einrichtung` capability | Passed |
| Administrator Admin Web login and Customer creation | Passed |
| Safe Web projection contains no raw UID/canonical payload | Passed |
| Android Administrator projection sees the created Customer | Passed |
| Capture interrupted by force-stop/restart creates no Tag, Assignment or receipt | Passed |
| Physical NTAG213 capture/register/assign succeeds through real C3C | Passed |
| Web/Android show the same safe label, fingerprint and Customer assignment | Passed |
| Same Administrator scans the assigned Tag for server-backed Start then Stop | Passed |
| Fresh-run sanitized counts equal Customers 2, Tags 1, Assignments 1, admin receipts 2, WorkEvents 2, Decisions 2, lifecycle Receipts 2, stopped TimeEntries 1 and AuditEvents 5 | Passed |
| No raw UID/payload, token, password, provider/database error or real-person data disclosed | Passed |
| Web/Android sign-out, harness shutdown, schema cleanup and scoped reverse removal | Passed |

The Human Architect supplied every physical observation above and confirmed both UI sign-outs.
This closes the C3D Human physical gate. C3E, production, distribution and personal data remain
unauthorized.
