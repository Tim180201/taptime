# Block C1 — Real Runtime Composition and Authentication Closure

Status: Completed — Technical Lead, GitHub CI and Independent Security Approved
Date: 2026-07-14
Owner: Technical Lead
Human Architect: Independent review supplied; no C2/C3 authorization inferred

## 1. Closed scope

C1 delivered the authorized first production-shaped Mobile vertical slice: external composition,
Supabase email/password authentication, refresh-token-only native SecureStore restoration,
serialized token rotation, AppState refresh ownership and mandatory server-authoritative current
User/Membership/Organization context through exactly one private `GET /v1/session` route.

The product path no longer constructs fake authentication or demo scan infrastructure and stops
truthfully at authenticated-but-scan-not-yet-connected. Demo behavior is explicit, lazy,
development-only and never a fallback. No B5/B6 HTTP route, real scan/sync composition,
Organization bootstrap, cloud resource, production credential/data, migration `006`, C2 or C3
scope was added.

## 2. Technical Lead review history

Before publication, Technical Lead review added explicit Mobile fetch, HTTP authority and
PostgreSQL query/statement deadlines so stalled dependencies enter the same retryable/fail-closed
state instead of leaving session resolution open indefinitely.

The independent review then raised one shared-verifier P1 observation. Technical Lead disposition
confirmed the intended contract: invalid tokens return typed authority rejection while JWKS and
PostgreSQL infrastructure errors propagate to the owning transport boundary. C1's session HTTP
server maps that distinction to generic `401` versus `503`. Three additional real unavailable-JWKS
tests now prevent B4/B5/B6 from silently regressing infrastructure failure into authorization
rejection.

## 3. Published evidence

- Implementation commit: `0a2a51b`
- GitHub Actions implementation run: `29279475547` — all seven jobs passed
- Local C1 PostgreSQL/JWKS matrix: 43 passed
- Local Mobile matrix: 95 passed
- Local B6 regression after review disposition: 68 passed
- Local B5 regression after review disposition: 42 passed
- Local B4 regression after review disposition: 55 passed
- Local B3 regression: 125 passed
- Local B1 regression: 39 passed, 2 Supavisor modes skipped as explicit pre-production gates
- Local Core regression: 262 passed
- Node 24 typechecks/builds, clean lockfile install, migrations `001`–`005` and
  `git diff --check`: passed
- Independent verdict: `APPROVED WITH NON-BLOCKING FINDINGS`; C1 accepted for closure
- Migrations `001`–`005` remain unchanged by C1

## 4. Independent finding disposition

- Shared JWKS infrastructure propagation is the correct non-authorization behavior; new B4/B5/B6
  cases close the reviewer's evidence gap and make the future transport obligation explicit.
- Coarse non-credential Supabase login errors remain generic and fail-closed without account-state
  disclosure; richer UX requires a separately approved provider-error vocabulary.
- Mobile intentionally maps non-`200`/`401` session responses to one retryable unavailable state;
  deployment diagnostics belong to future server-side operations/observability.

Full provenance is recorded in
`ADO/05_Evidence/Block_C1_Independent_Architecture_Security_Review.md`.

## 5. Remaining gates

Live Supabase/provider validation, physical SecureStore/AppState/NFC-device testing, dependency
maintenance, Supavisor validation, production observability/rate/deployment policy, retention and
backup decisions, C2/C3, Organization bootstrap, B5/B6 transports, real scan/sync and production
personal data remain gated.

## 6. Next block

C2 and C3 are not authorized by this closure. Any next implementation block requires explicit
Human Architect authorization and a new fixed scope. In particular, C2 must define narrow B5/B6
HTTP transports, catch propagated infrastructure failures at those transport boundaries and
preserve B6 as the only server-canonical lifecycle decision source.
