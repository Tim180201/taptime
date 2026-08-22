# Block C2 — Authenticated Server Transport Foundation Closure

Status: Completed — Technical Lead, GitHub CI and Independent Security Approved
Date: 2026-07-14
Owner: Technical Lead
Human Architect: Independent review supplied; no C3 or Block D/E authorization inferred

## 1. Closed scope

C2 delivered one private managed-Node API with exactly `GET /v1/session`, B5-backed
`POST /v1/scan-context/resolve` and B6-backed `POST /v1/lifecycle-events`, using one configured
issuer and three distinct least-privilege PostgreSQL pools/logins. C1 behavior is preserved; B5 is
the only opaque scan-context read path and B6 plus the unchanged Core BusinessEngine is the only
canonical lifecycle decision/write path.

Mobile now owns typed scan-context and lifecycle clients behind the C1 memory-only token boundary.
One `401` permits at most one shared refresh/session re-resolution and one retry. Tokens and
transport capabilities do not reach React. The product remains truthfully authenticated with no
NFC trigger, manual payload input or synchronization action.

No C3, Organization bootstrap, Block D/E, cloud/deployment, production credential/data, schema
migration or Business Rule entered C2.

## 2. Technical Lead and independent review

Technical Lead review reproduced the complete local matrix, found no blocking defect and published
implementation commit `9f5b127`. GitHub Actions run `29314305059` then passed all seven jobs,
including the new isolated Node 24.17.0/PostgreSQL 17.10 C2 API/Mobile transport job.

The independent review returned `APPROVED WITH NON-BLOCKING FINDINGS`, with no P0/P1 and one P2:
Mobile rejected an oversized response only after `response.text()` had fully buffered a lengthless
body. Technical Lead accepted and closed the finding before block closure by using Expo's native
response stream, incremental fatal UTF-8 decoding, a 16-KiB byte counter and immediate stream
cancel. A focused test proves a lengthless oversized response is canceled without calling
`response.text()`.

Full provenance and disposition are recorded in
`ADO/05_Evidence/Block_C2_Independent_Architecture_Security_Review.md`.

## 3. Published evidence

- Implementation commit: `9f5b127`
- Implementation GitHub Actions run: `29314305059` — all seven jobs passed
- C1/C2 API PostgreSQL/JWKS matrix: 127 passed (43 C1 plus 84 C2)
- Mobile matrix after review correction: 154 passed in 13 files
- Core matrix: 262 passed in 42 files
- B6/B5/B4/B3 regressions: 68/42/55/125 passed
- B1 regression: 39 passed; 2 Supavisor modes remain permitted skips
- Node 24 typechecks, complete workspace build, Expo Android export, clean lockfile install, workflow parse,
  migration immutability and `git diff --check`: passed
- Independent verdict: `APPROVED WITH NON-BLOCKING FINDINGS`; sole P2 corrected
- Migrations remain exactly `001`–`005`; Core production and test files remain unchanged

## 4. Closed contracts

- exact three-route managed runtime and strict disclosure-safe HTTP boundary;
- independently verified current authority per request;
- three distinct capability-specific database identities and pools;
- B5-only tenant-safe opaque payload resolution;
- B6/Core-only server-canonical lifecycle decision and atomic evidence persistence;
- exact idempotency, deferred, conflict, rejection and infrastructure outcome mapping;
- Mobile token privacy, one-renewal/one-retry concurrency boundary and strict result parsing;
- incrementally bounded Mobile response bodies, including lengthless/chunked responses;
- truthful authenticated UI with NFC explicitly deferred to Block D.

## 5. Remaining gates

Live provider, Supavisor, physical-device/NFC and deployment validation remain outstanding.
Production observability, rate policy, secrets/TLS, dependency findings, retention/erasure,
backups, support operations and production personal data remain pre-production gates. C3,
DT-047/048, Blocks D/E, durable native queue/synchronization and all cloud work remain unauthorized.

## 6. Next block

This closure authorizes no implementation automatically. C3, NFC Block D or another roadmap slice
requires a separate Human Architect authorization and a new fixed Technical Lead scope.
