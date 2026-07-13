# Block C1 — Real Runtime Composition and Authentication Evidence

Status: Technical Lead Approved — Awaiting CI and Independent Security Review

Date: 2026-07-13

Authorized baseline: `d13b993dd54fd7fc80d23e17d4397291e23c857e`

Related: `ADO/02_Development/Block_C1_Real_Runtime_Authentication_Authorization.md`,
`ADO/02_Development/Block_C1_Real_Runtime_Authentication_Implementation_Plan.md`, ADR-0008

## 1. Baseline and scope control

Before implementation, local `HEAD`, the clean worktree and `origin/main` all matched the
authorized baseline. C1 changes product Mobile composition/authentication, adds one private
session endpoint, adds its isolated CI job and records this evidence. Core Business Rules,
Lifecycle behavior, B5/B6 transports and migrations `001`–`005` are unchanged. No migration
`006`, cloud resource, production credential/data, commit, push or pull request was created.

## 2. Delivered backend boundary

`@taptime/backend-session-api` is a private Node 24 workspace with exactly one route:

```text
GET /v1/session
Authorization: Bearer <Supabase access token>
```

The route accepts no body, query, requested Organization/User/Membership or role. It composes the
concrete B4 `SupabaseJwtAccessTokenVerifier` and `PostgresIdentityMembershipResolver`; the latter
now uses an explicit `READ COMMITTED READ ONLY` transaction. A success returns exactly
`userId`, `membershipId`, `organizationId` and `role`. Invalid identity/authority maps to one
generic `401`; JWKS/PostgreSQL/authority infrastructure failure maps to one generic `503`.
Responses are JSON and `no-store`; bounded transport parsing and safe request IDs are applied.
Technical Lead review added an eight-second handler authority deadline plus five-second PostgreSQL
query and statement deadlines so an unavailable dependency cannot leave the HTTP operation open
indefinitely. The result remains the same generic `503` and safe diagnostic vocabulary.
The optional diagnostic hook receives only a fixed code and correlation ID and cannot prevent the
safe response even if the hook fails.

The runtime entry point reads only server-side `TAPTIME_DATABASE_URL`, `SUPABASE_ISSUER` and
optional `PORT`. Its database login is proven non-owner, non-superuser, `NOINHERIT`, without
`BYPASSRLS`/create rights and with exactly `taptime_identity_resolver` as parent. After
`RESET ROLE` it has no table/function/DDL access. Reused connections return to the login role with
no transaction-local Organization/User/Membership context.

## 3. Delivered Mobile boundary

The lockfile contains the Expo-compatible versions installed through `npx expo install`:

- `@supabase/supabase-js` `2.110.3`
- `expo-secure-store` `57.0.0`
- `react-native-url-polyfill` `3.0.0`

The product configuration reads exactly `EXPO_PUBLIC_SUPABASE_URL`,
`EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `EXPO_PUBLIC_TAPTIME_API_BASE_URL`. Android/iOS require
complete values; HTTPS is mandatory outside numeric `127/8` or `::1` test loopback. Credentials,
query, fragment, foreign HTTP hosts, unsuitable key material and Web fail closed without echoing
configuration values.

The Supabase client exposes only email/password `signInWithPassword` through the Mobile port.
Provider persistence and URL session detection are disabled. Only the rotating refresh-token
string is stored under one versioned SecureStore key using device-only unlocked accessibility.
The access token remains private in memory and is sent only as the Bearer header to the TapTim.e
session route. Restore performs read → provider refresh → rotated refresh-token write → server
session resolution. Start/refresh/sign-in, provider operations and token writes are single-flight
or serialized. When the provider emits `TOKEN_REFRESHED` during an explicit refresh, that event is
the single leading rotation/resolution path instead of duplicating the write and backend lookup. A
token revision prevents an older backend response from overriding a newer provider session.
Backend rejection clears product/provider/storage state; transient backend failure remains a
closed, explicit `context_unavailable` state with retry.

The Mobile session lookup has a ten-second abort deadline. A stalled fetch therefore closes into
the same explicit retryable `context_unavailable` state without retaining product authority.

One Composition Root owns AppState auto-refresh transitions. Product screens receive only narrow
session/sign-in/sign-out capabilities and contain no token, storage, Supabase, fake authentication
or demo-pipeline responsibility. The successful product state truthfully says
“Authentifiziert – Scan-Verbindung folgt in C2”. The preserved demo graph is lazy-loaded only for
an explicit demo request in `__DEV__`, visibly labelled, and never used as a configuration or
authentication fallback.

The implementation follows the official primary guidance for
[Supabase React Native Auth](https://supabase.com/docs/guides/auth/quickstarts/react-native),
[refresh-session rotation](https://supabase.com/docs/reference/javascript/auth-refreshsession)
and [Expo SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/).

## 4. Automated evidence

The C1 backend suite uses PostgreSQL `17.10`, locally generated RS256 keys and a numeric-loopback
JWKS server. Its 43 tests cover active Employee/Administrator resolution, issuer/tenant/role
provenance, forged claims, invalid/expired/future/wrong/forged tokens, unknown/revoked
IdentityBinding/Membership, immediate revocation, strict method/path/Bearer/body/header bounds,
generic JSON mappings, `no-store`, safe diagnostics, unavailable JWKS/PostgreSQL, zero table
writes, exact least privilege, bounded stalled-authority handling, `RESET ROLE` denial and pooled
role/GUC cleanup.

The Mobile suite now has 95 passing tests: the pre-existing 10 NFC cases plus 85 C1 cases for
configuration attacks, exact SDK calls, refresh-only SecureStore use, token rotation/order,
restore/refresh/sign-in single flight, cleanup/races, backend authority retry/rejection, AppState
lifecycle, stalled-session abort, explicit demo selection and the production source graph.

The seventh isolated GitHub Actions job uses official checkout/setup actions, Node `24.17.0` and
PostgreSQL `17.10`. It installs with `npm ci`, builds required Core/schema/B4 dependencies, cleanly
applies migrations `001`–`005`, reruns/verifies the ledger, then typechecks/tests/builds C1 and
typechecks/tests Mobile. It requires no Supabase Cloud credential; its JWT/JWKS and passwords are
synthetic local/CI values.

## 5. Local verification

The Implementation Agent ran its consolidated matrix with Node `24.17.0`. Technical Lead review
then repeated the clean `npm ci` matrix with bundled Node `24.14.0`; GitHub CI remains pinned to
Node `24.17.0`. Final local results are:

| Verification | Result |
|---|---|
| C1 tests-inclusive typecheck | Passed |
| C1 PostgreSQL/JWKS tests | 43 passed |
| C1 build | Passed |
| Mobile tests-inclusive typecheck | Passed |
| Mobile tests | 95 passed |
| B6 tests | 67 passed |
| B5 tests | 41 passed |
| B4 tests | 54 passed |
| B3 tests | 125 passed |
| B1 tests | 39 passed; 2 explicitly permitted Supavisor skips |
| Core tests | 262 passed |
| Root typecheck/build | Passed |
| Migration `001`–`005` diff/checksum scope | Unchanged; no `006` |
| Lockfile install / audit | `npm ci` passed; 11 moderate findings remain open |
| Workflow YAML / commands | Parsed and workspace commands verified |
| `git diff --check` | Passed |

## 6. Remaining limits and gates

- No Supabase Cloud project or live provider account was used. The real SDK path is implemented,
  while provider end-to-end validation remains a later environment gate.
- SecureStore and AppState behavior are contract-tested without claiming physical-device Keychain,
  Keystore or background-lifecycle validation. An auto-refresh lifecycle provider failure is
  contained; successful refresh operation is not claimed for that rejected case.
- The existing Expo patch recommendation (`expo` installed as `57.0.2`, Expo tooling currently
  recommends `~57.0.4`) remains a disclosed dependency-maintenance item; C1 does not widen scope to
  upgrade the SDK.
- The repository still reports 11 moderate npm dependency findings; this task neither suppresses
  nor auto-fixes them.
- Rate limiting, production observability, deployment, provider configuration, production secrets,
  real data, B5/B6 HTTP routes, scan/sync transport, DT-047/048, C2/C3, Block D and physical NFC
  validation remain outside C1.

C1 is implemented and ready for Technical Lead review. No acceptance or authorization of C2/C3
is claimed.
