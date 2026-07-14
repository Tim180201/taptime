# Block C2 — Authenticated Server Transport Foundation Evidence

Status: Implemented — Awaiting Technical Lead Review

Date: 2026-07-14

Implementation baseline: `7b492341a6b7824ec81c6120cf09f68d79f3b431`

Authorization: `ADO/02_Development/Block_C2_Authenticated_Server_Transport_Foundation_Authorization.md`

## 1. Start gate and scope control

Before the first change, the branch was `main`, the worktree was clean and both local `HEAD` and
`origin/main` were exactly the authorized baseline. C2 changes only the private backend API,
Mobile authentication/transport composition, its isolated CI job and the necessary C2 governance
evidence. Core Business Rules, schema migrations `001`–`005`, B4/B5/B6 semantics and product NFC
behavior are unchanged. No migration `006`, cloud resource, production credential/data, C3,
DT-047/048, Block D/E implementation, commit, push or pull request was created.

## 2. Delivered backend boundary

The private C1 workspace is renamed from `@taptime/backend-session-api` to
`@taptime/backend-api`. Its 43 C1 tests remain recognizable and green. The product server exposes
exactly:

```text
GET  /v1/session
POST /v1/scan-context/resolve
POST /v1/lifecycle-events
```

One concrete B4 asymmetric verifier is composed with three separately configured pools and three
distinct login names: session/B4 resolver, B5 read model and B6 lifecycle. Missing, malformed,
non-PostgreSQL and duplicate-login URLs fail before startup. Because `node-postgres` permits query
parameters to override visible URL authority and timeout fields, runtime URLs accept only
TLS-related query parameters; `user`, host, deadline and startup-role overrides are explicitly
rejected before a pool exists.

The scan-context route accepts only requested `organizationId` and an opaque, case-sensitive,
non-empty payload of at most 1,024 UTF-8 bytes. It uses one genuine B5 tenant read session for Tag,
active Assignment and active Customer resolution and returns only Assignment ID, Tag ID and
AssignmentTarget. Missing, inactive, revoked and cross-tenant context collapses to the same
generic response.

The lifecycle route accepts only requested Organization, WorkEvent evidence, Receipt metadata and
the existing optional client TimeEntry ID. It delegates unchanged to the genuine B6 coordinator;
the real Core `BusinessEngine` remains the only Decision source. Start, Stop, Duplicate,
Other-Target Rejection and Escalation, plus deferred, conflict and idempotent retry mappings are
covered through PostgreSQL. A full request whose HTTP response is deliberately lost still commits
one complete canonical path; the identical WorkEvent/Receipt retry returns the same path as an
idempotent retry without duplicate rows.

The shared HTTP boundary enforces exact paths/methods and JSON shapes, one bounded Bearer header,
8 KiB aggregate header parsing, 64 headers, 16 KiB request bodies, fatal UTF-8 decoding, no content
encoding or cookies, no automatic disclosure and bounded dependency execution. Errors are generic
JSON with `no-store`, `nosniff` and a correlation ID. Diagnostics contain only a fixed code and
correlation ID; tokens, payloads, URLs, provider/database errors and personal fields are absent.

## 3. Delivered Mobile boundary

The product composition owns private typed scan-context and lifecycle clients behind one narrow
authenticated-request capability. React receives a separate frozen session facade and no token or
transport capability. An attempt-scoped token reader expires when its infrastructure callback
settles; requests put the token only in the Bearer header, omit cookies, use an abort deadline and
handle redirects manually without forwarding credentials.

One `401` may cause exactly one shared provider refresh, backend session re-resolution and one
retry. A renewed `401` clears product authority. Token generation/revision checks, a stable drain
of overlapping provider events and authenticated-state gating prevent cross-user replay, retry
before the latest server authority resolution, stale success and a second refresh after a shared
failure. Network, deadline, `429` and `5xx` outcomes remain transient and do not discard valid
refresh evidence. Clients accept only exact JSON result vocabularies; even a scan `404` is treated
as authoritative `not_resolved` only when it has the exact generic backend JSON shape.

`ScanScreen` remains a holding state with only sign-out. It explicitly states that NFC activation
follows Block D and contains no fake scan button, manual payload input, sync action or claimed NFC
function.

## 4. CI boundary

The existing isolated C1 job is evolved into `backend-c2-api`; the other six jobs and global
trigger/concurrency model remain. The job uses Node `24.17.0`, PostgreSQL `17.10-alpine`, a
15-minute timeout, repository `contents: read`, npm lockfile caching and `npm ci`. It provisions
three distinct synthetic C2 runtime logins, builds Core/B3/B4/B5/B6, applies migrations
`001`–`005`, reruns and verifies the ledger, then typechecks/tests/builds the API and
typechecks/tests Mobile. It uses local asymmetric JWKS infrastructure and needs no cloud secret.

Local YAML parsing found seven jobs and ten C2 steps and verified the exact workspace commands.
The new workflow has not yet run on GitHub because this implementation is intentionally
uncommitted and unpushed.

## 5. Adversarial implementation-review dispositions

The implementation audit found and closed these pre-handoff gaps:

- PostgreSQL query parameters could override the URL username, target or fixed timeout while the
  startup check inspected only the URL username. Runtime URLs now reject every non-TLS connection
  parameter; adversarial user/host/timeout/role-option cases pass.
- The Mobile scan client initially accepted every `404` as a B5 result. It now requires exact
  JSON `{ "error": { "code": "not_found" } }`; proxy HTML, malformed JSON, another code and
  extra disclosure fields fail closed.
- Three Mobile concurrency races could replay an old request under a new generation, overtake the
  latest token's server authority check or start another refresh after a shared failure. Stable
  event-flight draining plus generation/revision/state gates and focused race tests close them.
- New C2 login role graphs were proven, but their own pooled cleanup needed direct evidence.
  Reused `max: 1` read/lifecycle connections now prove login-role restoration and empty
  Organization/User/Membership/role/correlation GUCs after commit and rollback. C1 retains the
  equivalent session-pool proof.
- Ordinary idempotency was covered, but not a lost response after B6 began writing. The new
  disconnect test proves one canonical row set followed by an idempotent identical retry.

## 6. Local verification

All commands used Node `24.17.0`, npm `11.13.0` and direct local PostgreSQL `17.10` with synthetic
data and credentials.

| Verification | Observed result |
|---|---|
| Fresh lockfile install | `npm ci` passed; 584 packages installed, 593 audited; existing 11 moderate findings remain |
| Root tests-inclusive typecheck | Passed for Core and Mobile |
| Core tests | 262 passed in 42 files |
| Mobile tests-inclusive typecheck | Passed |
| Mobile tests | 153 passed in 13 files; includes the existing 10 NFC tests |
| C2 API tests-inclusive typecheck | Passed |
| C1/C2 API tests | 127 passed in 2 files: 43 preserved C1 plus 84 C2 |
| C2 API build | Passed |
| B3 typecheck/tests/build | Passed; 125 tests |
| B4 typecheck/tests/build | Passed; 55 tests |
| B5 typecheck/tests/build | Passed; 42 tests |
| B6 typecheck/tests/build | Passed; 68 tests |
| B1 typecheck/tests/build | Passed; 39 direct-PostgreSQL tests, 2 permitted Supavisor skips |
| Core build and complete workspace build | Passed |
| Workflow YAML and npm commands | Parsed and verified; 7 jobs, 10 C2 steps, Node 24.17.0, PostgreSQL 17.10 |
| Migrations | Exactly `001`–`005`, byte-for-byte unchanged from baseline; no `006` |
| `git diff --check` | Passed after implementation and again after documentation |

Supavisor Session and Transaction modes remain unverified because no prepared target URLs and
roles/schema were available; no cloud resource was created.

## 7. Remaining limits and gates

- Technical Lead review and a real GitHub Actions run are still required; no approval is claimed.
- No live Supabase project/provider, Supavisor connection or deployed API was tested.
- SecureStore/AppState and NFC remain contract-tested, not physically device-validated. NFC
  capture is intentionally not connected to the new transport until Block D.
- The B3 schema has no separate NFC-Tag active/revoked state. C2 checks the existing Assignment
  and Customer activity model and does not invent a new Tag rule.
- An HTTP deadline cannot cancel a PostgreSQL transaction already running inside B6. B6's
  WorkEvent/Receipt idempotency and the lost-response integration test make identical retry safe;
  operational cancellation remains a later runtime concern.
- Production observability/rate policy, database TLS/deployment configuration, retention/privacy,
  backups, provider linking, dependency maintenance and the 11 moderate npm findings remain
  pre-production gates outside C2.
- DT-047/048, C3, Blocks D/E, durable offline queue/sync orchestration, Organization bootstrap,
  cloud/deployment, production data and new Business Rules remain unauthorized.

Implementation status: **Implemented — Awaiting Technical Lead Review**.
