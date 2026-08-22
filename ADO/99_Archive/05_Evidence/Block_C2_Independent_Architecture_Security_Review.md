# Block C2 Independent Architecture and Security Review

Status: Approved — Technical Lead Disposition Complete
Review Date: 2026-07-14
Reviewer: Independent Claude review supplied by the Human Architect
Reviewed Branch: `main`
Reviewed Base Commit: `7b49234`
Implementation Commit: `9f5b127`
Implementation CI Run: `29314305059`
Approval Authorities: Independent Security Reviewer and Technical Lead

## 1. Scope and provenance

The independent reviewer inspected the complete `7b49234..9f5b127` C2 diff, the governing
authorization, implementation plan and evidence, the renamed three-route backend API, B4/B5/B6
authority boundaries, Mobile token/transport composition, tests and CI definition. The reviewer
confirmed exact local/remote commit identity and a clean tree and changed no repository file.

The review environment executed Mobile typecheck and all 153 implementation cases. PostgreSQL was
unavailable there, so the reviewer statically inspected and counted the 43 C1 plus 84 C2 API
cases. Technical Lead PostgreSQL 17.10 execution and GitHub Actions run `29314305059`, in which all
seven jobs passed for the exact implementation commit, supply the runtime evidence unavailable in
the independent sandbox.

## 2. Independent verdict

Verdict: **APPROVED WITH NON-BLOCKING FINDINGS**.

No P0 or P1 finding was identified. The reviewer confirmed exact C2 scope, strict HTTP parsing,
separate least-privilege pools, current tenant authority, B5-only scan resolution, genuine B6/Core
server-canonical lifecycle decisions, lost-response idempotency, private Mobile tokens, bounded
retry and concurrency defenses. One P2 Mobile response-bound observation required Technical Lead
disposition before final closure.

## 3. Confirmed security and architecture claims

The independent review confirmed that:

- the managed runtime exposes exactly the three authorized routes and preserves all 43 C1 cases;
- migrations, Core Business Rules and the B4/B5/B6 implementation packages are unchanged by C2;
- every route verifies current Bearer authority independently and treats requested Organization as
  scope rather than authority;
- three distinct URL usernames, pools and exact least-privilege role graphs are mandatory;
- PostgreSQL URL user/host/timeout/startup-role overrides and encoded duplicate users fail before
  pool creation;
- strict paths, methods, Bearer/header/body limits, fatal UTF-8, exact JSON keys and generic
  diagnostics fail closed without sensitive disclosure;
- scan context is resolved only through B5 and returns only Assignment, Tag and target IDs;
- lifecycle evidence is delegated only to B6 and the genuine Core `BusinessEngine.evaluate()`;
- five Decision variants, deferred/conflict/rejection/infrastructure mappings and a lost-response
  idempotent retry are proven through real PostgreSQL integration cases;
- React receives no token or transport capability, the attempt token reader expires, concurrent
  `401` operations share one renewal, one retry is the maximum and stale generations cannot replay;
- redirects, cookies, malformed result vocabularies and spoofed `404` responses fail closed;
- the authenticated holding screen remains truthful and contains no premature NFC/sync action.

## 4. Finding disposition

### P2 — Mobile response without `Content-Length` was buffered before its size check

Observation: the implementation rejected an oversized declared `Content-Length`, but for a
chunked or otherwise lengthless response it called `response.text()` before checking the resulting
UTF-8 length. A compromised or severely misconfigured trusted origin/proxy could therefore force
the legacy React Native fetch layer to buffer an arbitrarily large response. The reviewer judged
the constrained attack model non-blocking but recommended streaming enforcement before Blocks D/E.

Disposition: **Accepted and corrected before C2 closure.** The production composition now injects
Expo's native streaming fetch implementation rather than React Native's legacy fully buffered fetch
polyfill. `AuthenticatedHttpRequestExecutor` consumes the response `ReadableStream` incrementally,
uses fatal UTF-8 decoding, counts received bytes, cancels the native stream immediately above
16 KiB and never calls `response.text()`. The request retains explicit no-store semantics through
its header, omits cookies and preserves manual redirect handling.

A new adversarial case supplies an oversized streamed response without `Content-Length`, proves
that the transport returns only `unavailable`, proves `response.text()` is never called and proves
that the stream is canceled at the boundary. Mobile now passes 154 cases. This closes the only
independent P2 rather than deferring it into NFC or synchronization work.

### Prior shared-verifier observation

The reviewer rechecked the earlier C1 JWKS-infrastructure observation and confirmed that all three
C2 HTTP handlers catch propagated infrastructure failure and map it to generic `503`, distinct
from typed authority rejection and without disclosure. No new C2 finding remains.

## 5. Residual gates

Live Supabase/provider and Supavisor validation, physical SecureStore/AppState/NFC devices,
production observability/rate/deployment/TLS configuration, dependency maintenance, legal
retention/erasure/backup decisions, C3, Blocks D/E, cloud resources and production personal data
remain separately gated. An HTTP deadline still cannot cancel a B6 transaction that is already
executing; B6 atomicity and evidence idempotency remain the authorized retry protection.

## 6. Closure recommendation

Close C2 after recording the streaming correction, 154-case Mobile regression and a successful
closure CI run. This review does not authorize C3, NFC Block D, synchronization Block E, cloud
deployment, production credentials/data or any new Business Rule.
