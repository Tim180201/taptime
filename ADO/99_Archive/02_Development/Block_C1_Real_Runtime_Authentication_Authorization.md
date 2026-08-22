# Block C1 — Real Runtime Composition and Authentication Authorization

Status: Authorized — Awaiting Implementation
Authorization Date: 2026-07-13
Authorized Baseline: `0d574d4e6397a81f8046f3e2b1674468ccc646be`
Human Architect Authorization: Explicitly supplied after B6 closure
Owner: Technical Lead
Architecture Authorities: ADR-0007, ADR-0008, Block B3–B6 closures
Roadmap Scope: DT-045, DT-046, DT-049, DT-050, DT-051 and DT-052

## 1. Authorized objective

Implement the first production-shaped Block C vertical slice: a real Mobile composition root,
Supabase Auth email/password sign-in, secure native session restoration and one narrow backend HTTP
session-resolution endpoint that maps a verified provider identity to the current authoritative
TapTim.e User/Membership/Organization context.

The default product runtime must no longer instantiate `FakeAuthenticationGateway`, `SessionService`
or `buildScanDemoPipeline` inside a screen. Demo behavior may remain only behind an explicit
development-only composition path. Until C2 connects B5/B6 transports, the authenticated product
path must show a truthful unavailable/not-yet-wired scan state instead of silently using demo data.

This is one cohesive six-task bundle because the real login flow is not safe or useful unless
composition, session storage, backend Membership resolution and UI injection land together.

## 2. Fixed architecture decisions

### 2.1 Identity and authorization provenance

- Supabase Auth is the approved v1 identity provider.
- Email/password is the only authorized sign-in method. Sign-up, password reset, magic link, OTP,
  phone, OAuth, SSO, anonymous auth and identity linking are out of scope.
- The Mobile Supabase client may contain only the public project URL and publishable key. A service
  role, database credential, JWT signing secret or backend secret may never enter the app bundle.
- Supabase proves identity only. Token claims, email and Mobile state do not grant a TapTim.e role,
  User, Membership or Organization.
- The backend reuses the concrete B4 asymmetric JWT verifier and authoritative PostgreSQL
  IdentityBinding/Membership resolver. Its resolved server record is the only source for User,
  Membership, Organization and role.
- Caller/session state returned to Mobile is presentation and request-scoping context only. Every
  future B5/B6 request still re-verifies current authority and RLS; cached Mobile context never
  authorizes a server operation.

### 2.2 Session model and native storage

- Supabase access tokens remain memory-only and are sent to the TapTim.e backend only through the
  `Authorization: Bearer` header. They must never enter URLs, logs, analytics, error text or general
  application persistence.
- Only the current rotating refresh token may be persisted through `expo-secure-store` on native
  Android/iOS. The complete Supabase session JSON is not stored as one SecureStore value.
- Session restoration exchanges the stored refresh token through the official Supabase client,
  persists the newly rotated refresh token and then re-resolves TapTim.e Membership on the backend.
- Refresh/restore operations are single-flight so one rotating refresh token is not raced by two
  callers. Auth-state refresh updates must persist the newest token in order.
- Expected invalid credentials, absent session, unavailable/revoked Membership and explicit sign-out
  use typed states. Network/storage/programming failures remain distinguishable infrastructure
  failures and must not become authenticated state.
- Backend authority rejection clears the local product session. A transient backend/network failure
  may retain the provider refresh token for an explicit retry but must not expose the authenticated
  product route.
- App foreground/background handling starts and stops Supabase auto-refresh once at the composition
  boundary. Screen components do not own token refresh or storage.
- Web session persistence is not authorized in C1 because SecureStore has no web equivalent. The
  production C1 path is native Android/iOS and fails closed on unsupported platforms.

Official implementation references:

- Supabase React Native Auth: `https://supabase.com/docs/guides/auth/quickstarts/react-native`
- Supabase sessions and rotating refresh tokens: `https://supabase.com/docs/guides/auth/sessions`
- Supabase React Native auto-refresh lifecycle: `https://supabase.com/docs/reference/javascript/auth-startautorefresh`
- Expo SecureStore: `https://docs.expo.dev/versions/latest/sdk/securestore/`
- Expo authentication storage guidance: `https://docs.expo.dev/guides/authentication/`

### 2.3 Runtime composition

- Add one explicit Mobile runtime contract and one production composition root outside React screens.
- `AppNavigator` receives the composed runtime/session capability. `LoginScreen` receives a narrow
  sign-in capability and cannot construct infrastructure.
- Runtime configuration is validated before use. Missing/invalid Supabase URL, publishable key or
  TapTim.e API base URL produces a disclosure-safe fail-closed configuration state.
- The API base URL must use HTTPS outside numeric-loopback local tests. Credentials or tokens in URL
  authority, query or fragment are forbidden.
- Retain an explicit demo/dev composition only if it is unreachable from the default production
  composition and visibly identified as demo. Production configuration may not fall back to demo.
- `FakeAuthenticationGateway`, the legacy opaque sign-in-code contract and demo scan pipeline may
  remain for existing Core/CLI/tests, but they are not imported by the production Mobile screens or
  production composition root.

## 3. Authorized backend session endpoint

Add one isolated managed-Node backend transport workspace, or an equivalently isolated package,
with exactly one C1 route:

```text
GET /v1/session
Authorization: Bearer <Supabase access token>
```

The endpoint:

1. accepts no identity, Membership, Organization or role in query/body;
2. extracts exactly one syntactically valid Bearer credential without logging it;
3. invokes the concrete B4 verifier and authoritative current IdentityBinding/Membership resolver;
4. returns only the resolved `userId`, `membershipId`, `organizationId` and `role` on success;
5. maps expected missing/revoked identity/Membership and invalid-token outcomes to a small
   disclosure-safe HTTP/JSON vocabulary;
6. maps infrastructure failures to a generic server response while preserving the original error
   for server-side handling without token/credential content;
7. applies strict method/path/header/body limits, JSON content type, no-store response caching and
   request correlation without exposing secrets;
8. exposes no Pool, PoolClient, raw query, database role selector, provider identity or token claims.

The endpoint is a transport wrapper around B4 authority, not a new authorization source. No B5 read
route, B6 lifecycle route, administrative write or general-purpose proxy is authorized in C1.

## 4. Product runtime states

The Mobile composition must represent at least:

- initializing/restoring session;
- unauthenticated;
- signing in;
- authenticated with server-resolved Caller/Membership context;
- authenticated provider identity but backend context temporarily unavailable, with explicit retry;
- rejected/unavailable IdentityBinding or Membership, returning to unauthenticated state;
- fail-closed runtime configuration/storage error;
- signed out.

Passwords, tokens and provider error details are never rendered or retained in UI state. Login uses
email and password fields with password masking, duplicate-submit prevention and generic expected
credential rejection. No role or Organization selector is accepted from the user.

## 5. Demo removal and truthful product path

- The default Mobile entry point must use the production composition root.
- `LoginScreen` must not import or instantiate `FakeAuthenticationGateway` or `SessionService`.
- `ScanScreen` must not construct `buildScanDemoPipeline`.
- An authenticated user may reach only a truthful C1 home/scan-not-yet-connected state until C2.
- A demo composition may still exercise existing Core examples in development/tests, but requires an
  explicit non-production mode and unmistakable demo labeling; it cannot be an automatic fallback.

This closes the false product-runtime path without claiming that real scanning/synchronization is
already complete.

## 6. Mandatory verification

The C1 implementation must add tests that prove:

- email/password sign-in calls the official Supabase client contract and no other provider flow;
- invalid credentials, malformed provider responses and infrastructure failures remain distinct;
- only a refresh token is persisted and access tokens/passwords never reach the storage adapter;
- refresh-token rotation, serialized restore/refresh, sign-out deletion and restoration failure;
- backend session resolution is mandatory before authenticated product state;
- invalid/revoked/unknown authority and forged claims do not create Mobile authority;
- exact session endpoint method/path/Bearer parsing, body/header limits and no-store response shape;
- real B4 JWT verification plus direct PostgreSQL Membership resolution under a non-owner,
  least-privilege runtime login;
- cross-tenant/unknown/revoked Membership cases remain disclosure-safe;
- database role/GUC/pool cleanup and absence of token/secret logging;
- production source graph contains no Screen-level Fake Auth, SessionService or demo pipeline;
- missing/invalid runtime configuration and unsupported platform fail closed without demo fallback;
- existing B6, B5, B4, B3, B1, Core and Mobile regressions remain green.

CI receives one isolated C1 Node 24/PostgreSQL 17 job with clean install, migrations `001`–`005`,
tests-inclusive typecheck, endpoint/runtime tests and builds. Mobile typecheck/tests must cover the
new runtime sources. Any dependency install must be lockfile-exact and introduce no service secret.

## 7. Explicit non-goals

C1 does not authorize:

- DT-047 local Organization/Administration runtime wiring or DT-048 first-admin bootstrap code;
- creating Organizations, Users, IdentityBindings or Memberships from Mobile;
- B5/B6 HTTP routes, real scan configuration transport or WorkEvent synchronization transport;
- production cloud resources, Supabase project creation, database deployment or real credentials;
- sign-up, invitation, password reset, additional auth providers, identity linking or MFA;
- browser/web token persistence;
- production personal data, analytics, monitoring, rate-limit product policy or deployment;
- changing Core BusinessEngine, lifecycle rules, B3 schema, migrations `001`–`005` or B6 truth;
- Block D NFC payload/runtime behavior.

The first Organization/Administrator remains the ADR-0008-approved audited manual operator path and
will be specified separately in C3. C2 will authorize the narrow B5/B6 HTTP transports and real scan
composition only after C1 is independently reviewed.

Implementation ends at `Implemented — Awaiting Technical Lead Review`. An Implementation Agent must
not commit/push or infer C2, C3, Block D, deployment or production-data authorization.
