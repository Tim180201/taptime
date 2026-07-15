# Block C3D Implementation Evidence

**Date:** 2026-07-15

**Status:** COMPLETED — all corrections independently approved, exact-head CI green and complete
fresh Human physical validation passed

**Authorization decision baseline:** `316f017973fbba18a58c2340c9c79a28f06573e5`

**Authorization publication and implementation parent:** `0af755a3678c3756cee31579cb563c8977b514af`

## Delivered slice

- A dedicated responsive `@taptime/admin-web` workspace provides memory-only Supabase sign-in,
  exact current-Administrator resolution, the disclosure-safe setup projection and idempotent
  Customer creation over same-origin `/v1` routes.
- The Web surface cannot capture NFC, never receives a canonical NFC payload, and exposes no
  tenant or role selector.
- Android provides an Administrator-only NFC setup surface. Customer and label are selected in
  React; native capture and the direct C3C provision request remain inside private coordinators.
- React state receives only safe projection fields and the 12-character validation fingerprint.
- One native NFC arbiter gives a capture to either lifecycle scanning or administration, never
  both. Session and exact Membership changes invalidate in-flight setup work.
- C3E Membership administration, reassignment, Web/iOS NFC, device attestation, production data,
  and durable raw-payload retries remain excluded.

## Automated evidence

- `npm run typecheck` — passed for Core, Mobile and Admin Web.
- `npm test` — Core 290/290, Mobile 338/338, Admin Web 27/27.
- Neutral administration contract 3/3, C3C direct-PostgreSQL administration 75/75 and C2/C3C
  backend API 172/172 passed locally.
- `npm run build --workspace=@taptime/admin-web` — passed; production Vite bundle emitted.
- `npx expo export --platform android` — passed; product Android graph bundled.
- `git diff --check` — passed.
- `npm audit --omit=dev --audit-level=high` — no high/critical finding. The existing Expo/native
  toolchain reports the known moderate transitive `uuid` advisory; the suggested forced downgrade
  of `react-native-nfc-manager` is not an acceptable fix.

Original implementation commit `35eb6441688b4c76ea0e89b7f1f2f69decca4a14` passed ten-of-ten
GitHub Actions run `29396350642`. The independently approved correction is published on `main` as
commit `293a0f4ff92fda38616476b66e600cc98fd20cdc`, tree
`d676669684b9cd3f3a5b5f2c88919e8533de3b7e`. Exact-head GitHub Actions run `29400109183`, attempt
2, passed all ten jobs. Attempt 1 had passed every C3B assertion (189/189) but failed that job on a
late PostgreSQL cleanup connection event (`57P01`); no C3B or workflow file differed from the prior
green head, and the failed-job rerun passed without a source change.

## Correction delivered after independent review

- Browser authentication ownership is serialized; late successful/stale sign-in work is cleared and
  cannot retain a hidden memory session or replace a newer visible state.
- Browser responses are incrementally decoded and canceled above 16 KiB rather than checked only
  after full buffering.
- Web and Android preserve the validated C3C global cursor and load at most one additional 20-item
  page per explicit user action, with Organization/progress/duplicate checks.
- Behavioral Web Auth/Coordinator/parser/bound/rendered-state tests, Android transport/error/replay
  tests, runtime-stop permutations and source guards now cover the C3D mandatory verification.
- The first independent delta review's sole P3, D-DELTA-01, is locally corrected by behavior tests
  that reject cross-Organization and duplicate-ID pagination pages on both Web and Android.
- Admin-Web build dependencies are pinned to the exact lockfile versions.
- Review and Technical-Lead disposition are recorded in
  `ADO/05_Evidence/Block_C3D_Independent_Architecture_Security_Review.md`.

## Human gate requirement

C3D was not closed until an Administrator proved against the approved server-connected environment:
Web sign-in, Customer creation, Android refresh, native capture/register/assign, safe fingerprint
visibility, then Start and Stop with that same assigned tag. Employee denial plus Android
process/session replacement must also be observed. No production-person data is authorized.

The earlier Block-D synthetic harness intentionally disabled C3C administration and could not run
this sequence. Its scoped C3D extension, verification and Human checklist are recorded
in `ADO/05_Evidence/Block_C3D_Physical_Validation_Evidence.md`. Harness commit
`032ae9603a13c81e1f8dd880c42aa81828f017a4`, tree
`d15e5346d8eca34d404242491dd7ac4b80f35574`, passed all ten jobs in exact-head run `29401264170`,
attempt 2.

The first actual physical-gate browser start subsequently exposed C3D-LOOPBACK-01: the Admin Web
runtime parser rejected the harness's exact numeric HTTP loopback Auth origin before login. The
narrow correction and adversarial origin tests are recorded in
`ADO/05_Evidence/Block_C3D_Physical_Validation_Evidence.md`. Commit
`ad64cec3660e9bf89bcff1c334d01dbd79081ad5`, tree
`71bd087d7f5ac27abb1540f0c0a39266e2cc86bf`, passed independent delta review with zero open
P0/P1/P2/P3 and exact-head GitHub Actions run `29402429508` with ten of ten jobs.

The permitted restart then exposed C3D-CORS-01 and C3D-FETCH-01 before any setup write or NFC
capture. The harness CORS allowlist omitted the Supabase SDK's mandatory
`X-Supabase-Api-Version` request header, and the Admin-Web client stored browser `fetch` unbound,
causing `TypeError: Illegal invocation` before `/v1/session`. The correction adds the exact
header/test, invokes `globalThis.fetch(...)` with its required receiver, preserves existing
fail-closed redirect handling and adds a receiver-sensitive regression test. Commit
`e686578751e8e09d7a8a48c3fd3058825dcedbf7`, tree
`f80e700fd3e6e519573954ac8004fd4bbedea1c4`, passed independent delta review with zero open
P0/P1/P2/P3 and exact-head GitHub Actions run `29405184995`, attempt 1, with ten of ten jobs.

## Human physical closure

The complete checklist then restarted from its first observation and passed on the approved Galaxy
A33/Android and physical NTAG213. Employee setup denial, Administrator Web Customer creation,
safe Web/Android projection agreement, force-stop interruption non-mutation, real C3C physical Tag
registration/assignment and same-Administrator server-backed Start/Stop were observed. The final
sanitized state was exactly Customers 2, Tags 1, Assignments 1, admin receipts 2, WorkEvents 2,
Decisions 2, lifecycle Receipts 2, one stopped TimeEntry and AuditEvents 5. Android/Web sign-out,
harness/schema shutdown and scoped reverse removal passed.

An initial Start attempt failed closed as `Zuordnung nicht erreichbar` with zero lifecycle delta.
Read-only Administrator and Employee probes each resolved the stored Tag with HTTP 200; a
disclosure-safe controlled retry proved the same safe fingerprint and completed exactly one Start,
then the restored direct connection completed exactly one Stop. No raw UID/canonical payload,
token, password, provider/database error or real-person data was disclosed. Detailed evidence is
recorded in `ADO/05_Evidence/Block_C3D_Physical_Validation_Evidence.md`.

C3D is completed for its authorized repository and Human physical scope. C3E, reassignment,
Web/iOS NFC, production operation/data and distribution remain unauthorized.
