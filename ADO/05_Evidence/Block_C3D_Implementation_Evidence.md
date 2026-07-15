# Block C3D Implementation Evidence

**Date:** 2026-07-15

**Status:** Repository implementation complete; physical Human closure gate open

**Authorized baseline:** `0af755a3678c3756cee31579cb563c8977b514af`

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
- `npm test` — Core 290/290, Mobile 315/315, Admin Web 3/3.
- `npm run build --workspace=@taptime/admin-web` — passed; production Vite bundle emitted.
- `npx expo export --platform android` — passed; product Android graph bundled.
- `git diff --check` — passed.
- `npm audit --omit=dev --audit-level=high` — no high/critical finding. The existing Expo/native
  toolchain reports the known moderate transitive `uuid` advisory; the suggested forced downgrade
  of `react-native-nfc-manager` is not an acceptable fix.

## Open Human gate

C3D is not closed until an Administrator proves against the approved server-connected environment:
Web sign-in, Customer creation, Android refresh, native capture/register/assign, safe fingerprint
visibility, then Start and Stop with that same assigned tag. Employee denial plus Android
process/session replacement must also be observed. No production-person data is authorized.
