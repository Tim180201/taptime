# Block C2 — Authenticated Server Transport Foundation Authorization

Status: Authorized — Awaiting Implementation
Authorization Date: 2026-07-14
Authorized Baseline: `e73787d8873ce2e8ca01b892586a94ac0cb348d3`
Human Architect Authorization: Explicitly supplied after C1 closure
Owner: Technical Lead
Architecture Authorities: ADR-0007, ADR-0008, Block B4–B6 and C1 closures
Roadmap Scope: Block C transport-enabling slice; no DT-047/048 or DT-053–062 completion claim

## 1. Authorized objective

Implement the narrow authenticated HTTP transport foundation over the already approved B5
tenant-safe read coordinator and B6 server-canonical lifecycle-ingestion coordinator, plus typed
Mobile infrastructure clients composed behind C1's private session/token boundary.

C2 makes the real server capabilities reachable through one cohesive managed-Node API without
making NFC, offline synchronization or Organization bootstrap appear complete. The product runtime
must remain truthful: an authenticated user may know that the server foundation is connected, but
no product scan trigger is enabled until Block D fixes the payload strategy, NFC in-flight,
timeout/cancellation and physical-device gates. DT-060–062 remain Block E work because C2 does not
add a durable native queue, synchronization scheduler or retry policy.

This is one cohesive slice because B5 resolution and B6 ingestion must share the same strict HTTP,
authentication, error, correlation and Mobile token-execution rules. Publishing only one of the
two would create an unusable or misleading half-path.

## 2. Fixed architecture decisions

### 2.1 One product API, three least-privilege capabilities

- Evolve the C1 `@taptime/backend-session-api` workspace into one clearly named private
  `@taptime/backend-api` workspace. Preserve all C1 session behavior and tests during the rename.
- The managed runtime exposes exactly three routes: the existing C1 session route and the two C2
  routes specified below. It is not a general proxy or CRUD API.
- The process uses three separately configured PostgreSQL pools and three distinct login names:
  session resolution, B5 read model and B6 lifecycle ingestion. A single broad or shared runtime
  credential is forbidden.
- Each pool retains its previously approved role graph and deadline behavior. Session resolution
  may use only the B4 resolver capability; read resolution may use only B5's fixed resolver plus
  Employee/Administrator read roles; lifecycle ingestion may use only B6's resolver plus lifecycle
  roles.
- Runtime composition must reject missing, malformed or non-PostgreSQL URLs and reject duplicate
  configured database usernames. Database URLs, passwords and provider details never enter
  responses or diagnostics.
- One configured Supabase issuer and the existing concrete B4 asymmetric verifier are reused. No
  service-role key, JWT signing secret or Supabase administrative capability is authorized.

### 2.2 Authority and decision provenance

- Every route independently verifies the current Bearer access token. C1 Mobile session context is
  request-scoping/presentation state only and never authorizes a C2 operation.
- `organizationId` supplied by Mobile is a requested scope that must equal the current
  server-resolved Membership Organization. It is never an authority source.
- B5 remains the only read capability used to resolve an opaque payload to current Tag,
  Assignment and active Customer context under RLS.
- B6 remains the only lifecycle write capability. Every CanonicalDecision and TimeEntry transition
  comes from the genuine server-side `BusinessEngine.evaluate()` path.
- Client fields named `triggeredBy`, User, Membership, role, decision, result, canonical decision,
  server TimeEntry or database role are invalid transport input and must be rejected before B6.
- JWKS, PostgreSQL, deadline and programming failures propagate as infrastructure failures and map
  to generic `503`; they must never be converted into caller rejection. Invalid/revoked authority
  maps to generic `401`.

## 3. Authorized HTTP contract

All routes use the C1 Bearer, header, correlation, no-store, nosniff and disclosure-safe response
rules. Non-exact paths, methods and content types fail closed. JSON bodies are bounded to 16 KiB,
must be one object with exactly the documented keys and accept no content encoding. Request body,
Bearer token and raw provider/database errors are never logged.

### 3.1 Existing session route

```text
GET /v1/session
Authorization: Bearer <Supabase access token>
```

The response and behavior remain exactly C1-compatible. C2 may refactor the shared server/router
but may not widen the response or weaken any C1 negative test.

### 3.2 Scan-context resolution

```text
POST /v1/scan-context/resolve
Authorization: Bearer <Supabase access token>
Content-Type: application/json

{
  "organizationId": "<uuid>",
  "payload": "<opaque normalized payload>"
}
```

- The payload is treated as an opaque, case-sensitive value. C2 does not decide UID versus NDEF
  and performs no trim, case conversion, hex conversion or other normalization.
- The transport accepts a non-empty payload bounded to 1,024 UTF-8 bytes. Block D may later narrow
  the normalized representation after the explicit payload-strategy decision.
- The backend uses one B5 tenant read session to find Tag by payload, active Assignment by Tag and
  the target Customer. A missing Tag, missing/inactive Assignment, missing/inactive Customer or
  otherwise unavailable context returns one generic not-resolved outcome.
- Success returns exactly:

```json
{
  "assignmentId": "<uuid>",
  "nfcTagId": "<uuid>",
  "target": { "targetType": "customer", "targetId": "<uuid>" }
}
```

- Success is `200`; unavailable scan context is generic `404`; all authority rejection is generic
  `401`; infrastructure failure is generic `503`. The response must not distinguish which tenant
  object was absent, inactive or inaccessible.

### 3.3 Server-canonical lifecycle ingestion

```text
POST /v1/lifecycle-events
Authorization: Bearer <Supabase access token>
Content-Type: application/json
```

The exact request body is:

```json
{
  "organizationId": "<uuid>",
  "workEvent": {
    "id": "<uuid>",
    "assignmentId": "<uuid>",
    "nfcTagId": "<uuid>",
    "target": { "targetType": "customer", "targetId": "<uuid>" },
    "occurredAt": "<ISO-8601 timestamp>"
  },
  "receipt": {
    "id": "<uuid>",
    "attemptNumber": 1
  }
}
```

`receipt.clientTimeEntryId` may be accepted as the only optional field already present in the B6
contract. No other optional or additional field is authorized.

- The transport converts the validated body to the existing B6 command without adding or
  interpreting business meaning.
- `synchronized` returns `200` and the existing B6 server result exactly: idempotent-retry flag,
  server decision, WorkEvent/Receipt IDs and nullable server TimeEntry ID.
- `deferred` returns `202` with only the existing fixed deferred reason.
- content/receipt conflict returns `409` with the existing fixed conflict reason.
- authority rejection returns generic `401`; infrastructure failure returns generic `503`.
- Identical retries must preserve B6 idempotency. A response timeout or disconnected client must
  not cause an alternative write/decision path; retry uses the same WorkEvent and Receipt evidence.

## 4. Mobile transport composition

- Add typed scan-context and lifecycle API clients outside React screens. Both use the single
  validated `EXPO_PUBLIC_TAPTIME_API_BASE_URL` from C1.
- Access tokens remain private in the C1 coordinator/runtime. Screens, React state, URLs, request
  bodies, errors, analytics and persistence never receive them.
- Introduce one narrow internal authenticated-request capability owned by the Mobile composition
  root. It may pass an access token only to an infrastructure callback and must invalidate the
  callback after completion.
- On `401`, the capability performs at most one serialized provider refresh/re-resolution and one
  request retry. A second `401` clears local product authority through the existing C1 rejection
  path. Concurrent `401` operations share the refresh flight and never race a rotating token.
- Network, timeout, `429` and `5xx` outcomes remain typed transient operation failures. They do not
  clear a valid refresh token and do not open authority or silently mark lifecycle evidence as
  synchronized.
- Malformed success JSON fails closed as an unavailable operation. Clients accept only exact
  documented response fields and existing result vocabularies.
- Client requests use explicit abort deadlines, no automatic redirect and no cookies. A redirect
  is an unavailable operation and must not forward Bearer credentials to another origin.
- Compose both clients into the production runtime behind internal interfaces, but do not expose a
  product scan button, manual payload field or synchronization action in C2. `ScanScreen` remains a
  truthful authenticated holding state stating that NFC activation follows Block D.

## 5. Mandatory verification

The C2 implementation must add tests that prove:

- the workspace/package rename preserves all C1 session behavior and import/build consumers;
- exactly three routes exist and every other route/method is rejected;
- strict Bearer parsing, duplicate Authorization rejection, JSON content type, exact object shape,
  body/header/payload bounds, malformed/chunked/aborted requests and safe response headers;
- scan-context success comes only from B5 current tenant data and returns no Customer name,
  Membership, User, provider subject or database field;
- unknown, inactive, revoked and cross-tenant scan context is disclosure-safe;
- lifecycle transport rejects extra authority/decision/result fields before B6;
- all B6 synchronized decision variants, deferred, conflict and idempotent retry map exactly and
  no transport code recreates BusinessEngine rules;
- authority/JWKS/PostgreSQL/deadline failures map to `401` versus `503` correctly and diagnostics
  contain only a fixed code plus correlation ID;
- three distinct least-privilege database logins/pools are used, with role/GUC cleanup and no
  cross-capability query or role escalation;
- Mobile clients keep access tokens header-only, reject redirects/malformed JSON, apply deadlines
  and never persist or render credentials;
- concurrent Mobile `401` operations share one refresh, retry at most once and clear authority only
  after renewed server rejection;
- product screens and source graph contain no token, Supabase client, B5/B6 coordinator, fake/demo
  pipeline, manual payload or premature NFC/sync trigger;
- C1 43 backend/95 Mobile, B4 55, B5 42, B6 68, B3 125, B1 39 plus 2 permitted skips and Core 262
  regressions remain green; migrations remain exactly `001`–`005`.

CI receives one isolated C2 Node `24.17.0`/PostgreSQL `17.10` job using synthetic local JWT/JWKS
and three distinct least-privilege database logins. It must run clean install, migrations,
tests-inclusive typecheck, C1/C2 HTTP tests, Mobile transport tests and build without cloud secrets.

## 6. Explicit non-goals

C2 does not authorize:

- DT-047/048, C3, Organization/User/Membership creation or first-admin bootstrap;
- DT-053–059 payload-strategy choice, NFC adapter wiring/hardening, physical tags/devices or a
  product scan button;
- DT-060–062 `SynchronizationGateway`, durable native OfflineQueue, retry scheduler/backoff or
  offline-to-server orchestration;
- Customer/Tag/Assignment administration routes, exports, corrections or general CRUD;
- changing Core BusinessEngine, B6 lifecycle rules, B5/B6 result vocabulary, B3 schema, migrations
  `001`–`005` or C1 session semantics;
- CORS/browser session support, rate-limit product policy, production observability, deployment,
  cloud resources, real credentials, production data or production personal data;
- interpreting a client `QueuedWorkEventRecord.decision` or accepting it over HTTP.

Implementation ends at `Implemented — Awaiting Technical Lead Review`. An Implementation Agent
must not commit/push or infer Block D, Block E, C3, deployment or production-data authorization.
