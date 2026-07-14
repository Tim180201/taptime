# Block C1 Independent Architecture and Security Review

Status: Approved — Technical Lead Disposition Complete
Review Date: 2026-07-14
Reviewer: Independent Claude review supplied by the Human Architect
Reviewed Branch: `main`
Reviewed Base Commit: `d13b993`
Implementation Commit: `0a2a51b`
Approval Authorities: Independent Security Reviewer and Technical Lead

## 1. Scope and provenance

The independent reviewer inspected the complete `d13b993..0a2a51b` diff, governing C1
authorization, implementation plan and evidence, Mobile runtime/authentication graph, B4-backed
session API, shared B4 verifier/resolver changes, B3–B6 boundaries and regression tests. The
reviewer changed no repository file.

The review environment executed Mobile typecheck and all 95 Mobile cases. It could not run
PostgreSQL or fetch GitHub Actions, so it statically inspected and counted the 43 C1 backend cases.
Technical Lead execution on PostgreSQL 17.10 and GitHub Actions run `29279475547` supply the
independent runtime evidence unavailable in that sandbox.

## 2. Independent verdict

Verdict: **APPROVED WITH NON-BLOCKING FINDINGS**.

The reviewer found no P0 defect and approved C1 for closure. Mobile token handling, session races,
HTTP parsing, JWT/JWKS trust, current Membership authority, PostgreSQL least privilege, truthful
product composition and scope compliance were confirmed. One shared-verifier infrastructure
observation required Technical Lead disposition before closure; two UX/operations observations
remain non-blocking.

## 3. Confirmed security claims

The independent review confirmed that:

- C1 adds only `GET /v1/session`; no B5/B6 HTTP, scan, synchronization, bootstrap, cloud,
  production-data or migration `006` scope entered;
- Supabase email/password is the sole Mobile sign-in flow, provider persistence is disabled and
  only a rotating refresh token reaches native SecureStore;
- access tokens remain memory-only and are sent only as a bounded Bearer header;
- backend Membership resolution is mandatory before the authenticated product state;
- generation, token-revision, FIFO storage/provider operations and single-flight guards prevent
  stale restore, refresh, sign-out and provider-event authority;
- product configuration and unsupported Web runtime fail closed without demo fallback;
- the demo graph is explicit, lazy and development-only;
- exact method/path/body/header/Bearer rules, bounded dependency deadlines, generic responses and
  safe correlation diagnostics protect the session HTTP boundary;
- asymmetric JWT algorithms, exact issuer/JWKS binding and server-side current
  IdentityBinding/Membership data remain authoritative;
- the session runtime login is non-owner, `NOINHERIT`, non-superuser and limited to the resolver
  role; pooled transaction role and context cleanup are verified.

## 4. Finding dispositions

### P1 — Shared verifier now propagates JWKS infrastructure failure

Observation: `SupabaseJwtAccessTokenVerifier.verify()` now throws
`AccessTokenVerificationInfrastructureError` for JWKS infrastructure failure. B4/B5/B6
coordinators do not convert that error into their typed authorization-rejection results.

Disposition: **Security behavior accepted; missing regression evidence corrected.** Treating a JWKS
outage as an invalid caller token would incorrectly turn infrastructure failure into a `401`-class
authorization decision. The B4 service and B5/B6 coordinators already propagate PostgreSQL and
other infrastructure exceptions; their result unions intentionally describe business/authority
outcomes, not transport failures. An awaited rejected Promise is not intrinsically an unhandled
rejection. C1's concrete HTTP boundary owns the mapping and correctly converts the propagated
infrastructure failure to generic `503`.

Three real unavailable-JWKS regression cases now prove the contract at every affected layer:

- B4 actor resolution propagates the typed infrastructure error instead of returning identity
  rejection;
- B5 propagates it before opening the tenant callback;
- B6 propagates it without persisting lifecycle evidence.

The corrected regression totals are B4 55, B5 42 and B6 68. Any future C2 transport must catch
infrastructure errors at its own HTTP boundary; it may not convert them into caller rejection.

### P2 — Coarse provider login-error classification

Disposition: **Accepted non-blocking disclosure-safe behavior.** Only Supabase
`invalid_credentials` becomes the explicit invalid-credential state. Other provider policy,
throttling or account-state codes remain a generic unavailable state. This is fail-closed and does
not leak account status. A richer user-facing vocabulary requires a separate product/UX decision
and primary-provider contract matrix; it is not inferred during security closure.

### P3 — Backend `404` and infrastructure statuses share one Mobile state

Disposition: **Accepted non-blocking operations boundary.** Mobile deliberately maps every
non-`200`/`401` response to the same retryable `context_unavailable` state. This prevents backend
topology/configuration disclosure to the user. Deployment health checks and server-side
observability must distinguish misconfiguration later; Mobile authority must remain closed.

## 5. Residual risks

- Live Supabase Cloud/provider integration is not yet exercised.
- SecureStore, AppState and native lifecycle behavior still require physical-device validation.
- Eleven moderate npm dependency findings remain disclosed and unresolved.
- Production observability, deployment health, rate policy, C2/C3, NFC runtime and production
  personal data remain separately gated.

## 6. Closure recommendation

Close C1 after recording GitHub Actions run `29279475547`, the three shared-verifier regression
cases and the dispositions above. This approval does not authorize C2, C3, B5/B6 HTTP transport,
Organization bootstrap, real scan/sync, cloud provisioning or production personal data.
