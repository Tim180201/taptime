# Block C2 — Authenticated Server Transport Foundation Implementation Plan

Status: Implemented — Awaiting Technical Lead Review

Date: 2026-07-14

Implementation baseline: `7b492341a6b7824ec81c6120cf09f68d79f3b431`

Authorization: `ADO/02_Development/Block_C2_Authenticated_Server_Transport_Foundation_Authorization.md`

## 1. Objective and fixed boundary

C2 evolves the private C1 session workspace into one managed-Node API with exactly three routes:
unchanged `GET /v1/session`, B5-backed `POST /v1/scan-context/resolve` and B6-backed
`POST /v1/lifecycle-events`. It also composes private Mobile transport clients behind C1's
memory-only access-token boundary. C2 enables transport only; it does not enable NFC capture,
manual payload input, offline synchronization, Organization bootstrap or any client-side
lifecycle decision.

## 2. Backend implementation

- Rename `@taptime/backend-session-api` to private workspace `@taptime/backend-api`, preserving the
  complete C1 session contract and regression suite.
- Compose the concrete B4 verifier once with three separately configured PostgreSQL pools/logins:
  B4 session resolution, B5 tenant reads and B6 lifecycle ingestion. Reject missing, malformed,
  non-PostgreSQL or duplicate-login configurations before serving traffic.
- Route scan-context requests only through `TenantReadSessionCoordinator`; resolve Tag, active
  Assignment and active Customer without returning names, Membership, User or database fields.
- Route lifecycle evidence unchanged into `ServerCanonicalLifecycleIngestionCoordinator`; never
  accept a client Decision, authority assertion, lifecycle action or server result.
- Apply one bounded HTTP parser with exact routes/methods, one Bearer header, JSON-only POST bodies,
  16 KiB body and 1,024-byte opaque payload limits, no content encoding/cookies, exact DTO keys,
  bounded dependency execution and disclosure-safe response/diagnostic mappings.

## 3. Mobile implementation

- Add a narrow authenticated HTTP capability owned by the product composition. It injects the
  current memory-only access token itself; typed clients and screens never receive the token.
- Add exact scan-context and lifecycle clients with bounded requests, manual redirect handling,
  omitted credentials, strict response schemas and typed transient/authority outcomes.
- On `401`, compare the rejected token revision, share at most one provider refresh plus backend
  session re-resolution, then retry exactly once. A renewed `401` clears local authority. Network,
  timeout, `429` and `5xx` remain unavailable outcomes and do not clear a valid refresh token.
- Compose both clients outside React screens. Keep the authenticated product screen as a truthful
  holding state that says NFC activation follows Block D; add no trigger or payload field.

## 4. Verification and evidence

- Add adversarial transport tests for all request/response shapes, five B6 Decision variants,
  deferred/conflict/idempotent mappings, B5 tenant isolation, three exact runtime role graphs,
  diagnostics, deadlines, aborted/chunked requests and pool/context cleanup.
- Add Mobile tests for header-only credentials, strict clients, redirects/timeouts, concurrent
  `401` single-flight, one retry, second-rejection cleanup and product source-graph isolation.
- Replace the isolated C1 CI job with an isolated C2 Node `24.17.0`/PostgreSQL `17.10` job that
  provisions all three synthetic least-privilege logins and runs migrations `001`–`005`, API and
  Mobile typechecks/tests/builds without cloud secrets.
- Run the complete C1/C2, Mobile, B1, B3–B6 and Core regression matrix, all relevant builds,
  migration immutability checks and `git diff --check`. Record only observed results in C2
  Evidence, Project Status, Decision Log and Commercial Readiness Roadmap.

## 5. Explicit gates

DT-047/048, C3, Blocks D/E, NFC payload strategy/runtime, durable queue/sync orchestration,
administration routes, migrations, cloud/deployment, real credentials/data and BusinessEngine
semantics remain unchanged and unauthorized.

## 6. Implemented result

The authorized package rename, exact three-route API, three distinct least-privilege pool
composition, strict transport, B5/B6 delegation and private Mobile clients are implemented. An
adversarial implementation audit additionally closed PostgreSQL URL authority-override,
non-authoritative `404`, concurrent token-rotation, role/GUC cleanup and lost-response retry
evidence gaps before handoff. The complete observed result, exact test counts and remaining gates
are recorded in
`ADO/05_Evidence/Block_C2_Authenticated_Server_Transport_Foundation_Evidence.md`. No approval of
C2, C3 or Blocks D/E is inferred from implementation.
