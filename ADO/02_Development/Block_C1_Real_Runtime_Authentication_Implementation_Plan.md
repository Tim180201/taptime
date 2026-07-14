# Block C1 — Real Runtime Composition and Authentication Implementation Plan

Status: Completed — Technical Lead, GitHub CI and Independent Security Approved

Date: 2026-07-13

Implementation baseline: `d13b993dd54fd7fc80d23e17d4397291e23c857e`

## 1. Objective and fixed boundary

C1 implements DT-045/046 and DT-049–052 as one production-shaped vertical slice. The default
Mobile runtime uses Supabase email/password identity, native refresh-token-only storage and one
server-authoritative TapTim.e session lookup. It stops at the truthful state “Authenticated — scan
connection follows in C2”. It does not expose B5/B6 transports, real scan/sync wiring, Organization
bootstrap, cloud provisioning or new Business Rules.

The only backend route is `GET /v1/session`. It accepts exactly one Bearer access token and no
request identity, Organization, Membership, role, query or body. Its successful JSON contains only
`userId`, `membershipId`, `organizationId` and `role` resolved by the existing B4 verifier and
PostgreSQL resolver.

## 2. Backend implementation

- Add private Node 24 workspace `@taptime/backend-session-api`.
- Wrap the concrete `SupabaseJwtAccessTokenVerifier` and
  `PostgresIdentityMembershipResolver` in a cohesive session authority service.
- Enforce exact method/path, one syntactically valid bounded Bearer header, no body/query,
  disclosure-safe JSON errors, server-generated correlation IDs and `Cache-Control: no-store`.
- Keep provider identity, token, database pool/client/query and role selection behind the
  coordinator; infrastructure errors are reported without request credentials and map to one
  generic server response.
- Use a synthetic `NOINHERIT`, non-owner/non-superuser runtime login having exactly
  `taptime_identity_resolver` in local/CI tests. Do not add migration `006` or alter migrations
  `001`–`005`.

## 3. Mobile implementation

- Install only `@supabase/supabase-js`, `expo-secure-store` and
  `react-native-url-polyfill` through Expo-compatible dependency resolution.
- Compose the Supabase client with email/password only, `persistSession: false`, no Supabase
  storage adapter, URL detection disabled and native auto-refresh controlled once at the
  composition boundary.
- Persist only the rotating refresh-token string under one versioned SecureStore key. Access
  tokens remain private in memory and are sent only as the backend Authorization header.
- Serialize restore/refresh and every refresh-token write. Backend authority rejection clears
  provider/local product state; transient backend failure retains an explicit retryable
  `context_unavailable` state without opening the authenticated product route.
- Validate the three public runtime values fail-closed. HTTPS is mandatory outside numeric
  loopback tests; credentials, query and fragments are rejected; Web is unsupported in C1.
- Inject the composed session capability into `AppNavigator` and narrow screen props. Product
  screens import no fake authentication, `SessionService`, demo pipeline, token storage or
  provider client.
- Retain demo behavior only in a separately named, visibly labelled development composition that
  requires both an explicit demo request and `__DEV__ === true`; never use it as a fallback.

## 4. Verification

Backend tests use PostgreSQL 17, generated asymmetric keys and a numeric-loopback JWKS server to
cover successful server provenance, invalid/expired/forged tokens, missing/revoked authority,
least privilege, request boundaries, generic errors, no-store, credential-safe diagnostics and
pool/role cleanup.

Mobile tests use narrow fakes to cover exact email/password calls, typed credential/provider
failures, refresh-only persistence, rotation/order/single-flight, restore and retry paths,
authority rejection, sign-out, AppState lifecycle, fail-closed configuration/Web behavior and the
production source graph. Existing B1, B3–B6, Core and Mobile suites, all relevant typechecks/builds,
clean migration reruns and `git diff --check` remain mandatory.

## 5. Remaining gates

DT-047/048, C2/C3, B5/B6 HTTP routes, real scan/synchronization composition, sign-up/reset/other
providers, cloud resources, production credentials/data, deployment, observability/rate policy,
Block D and physical NFC validation remain unauthorized.

## 6. Implemented result

- The private Node 24 workspace exposes only `GET /v1/session`, composes the concrete B4 verifier
  and PostgreSQL Membership resolver, and has an executable managed-runtime entry point without
  adding a migration or B5/B6 transport.
- Technical Lead review added bounded Mobile fetch, HTTP authority, PostgreSQL query and statement
  deadlines so a stalled dependency reaches the same retryable/fail-closed state instead of
  leaving authentication or session resolution open indefinitely.
- The default Mobile path is the validated product composition. It uses Supabase
  `signInWithPassword`, refresh-token-only SecureStore persistence, serialized restore/rotation,
  backend authority gating and one AppState-owned auto-refresh lifecycle. Access tokens remain
  private in memory.
- The previous fake/demo scan flow now loads lazily only when the explicit demo flag and
  `__DEV__` are both true, with a visible warning. It is neither default nor fallback.
- The product route stops truthfully at “Authentifiziert – Scan-Verbindung folgt in C2”. C2/C3
  remain unauthorized and no scan/synchronization/backend-data route was composed.

Closure and independent finding dispositions are recorded in
`ADO/02_Development/Block_C1_Real_Runtime_Authentication_Closure.md` and
`ADO/05_Evidence/Block_C1_Independent_Architecture_Security_Review.md`.
