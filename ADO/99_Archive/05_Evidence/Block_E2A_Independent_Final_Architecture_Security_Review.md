# Block E2A — Independent Final Architecture and Security Review

Status: APPROVED — No Open P0/P1/P2/P3 Findings
Review Date: 2026-07-14
Reviewer: Independent read-only reviewer separate from the implementation and governance streams
Reviewed Baseline: `9f2f922fd46e33cb9d53d80e4a7dbedb73653ad1`
Reviewed Implementation Head: `4b5ecdc7d6605db3e231f9ead966ebf104900a30`
Approval Authorities: Independent Security Reviewer, Technical Lead and Human Architect

## 1. Scope and provenance

The reviewer inspected the complete E2A implementation range, ADR-0010, TS-001, authorization and
implementation plan, independent pre-implementation and implementation reviews, Mobile
resolver/outbox/orchestrator/transport/UI code, the API/lifecycle defer-only path, synthetic Android
E2E support, tests, CI, the physical validation record and the candidate closure/security claims.

The local and remote `main` implementation state were verified at exact commit
`4b5ecdc7d6605db3e231f9ead966ebf104900a30`, based on `9f2f922`. The implementation diff contains
41 files and no SQL migration or dependency change; migrations remain exactly `001`–`005`.
`research/` was excluded and was neither read nor changed.

## 2. Findings and disposition

Initial final-review severity count: P0 = 0, P1 = 0, P2 = 0, P3 = 1.

### E2A-FINAL-01 — P3 — closed during review

The current Authorization, Implementation Plan and repository status surfaces still described
implementation CI, physical validation or publication as pending while the new physical and closure
drafts already recorded those gates as passed.

Disposition: **Accepted and corrected before final verdict.** Authorization, Implementation Plan,
Project Status, Decision Log, Core Roadmap and the historical implementation-review record now
separate the passed implementation/CI/physical gates from the then-running independent final review.
No code, SQL or dependency file changed. `git diff --check` passed after the correction.

Final open severity count: **P0 = 0, P1 = 0, P2 = 0, P3 = 0**.

## 3. Independently verified implementation and CI facts

- GitHub Actions run `29348512506` is bound to exact head SHA
  `4b5ecdc7d6605db3e231f9ead966ebf104900a30` on `main`, completed with `success`, and all eight
  expected jobs passed.
- The reviewed implementation preserves one volatile exact-session/payload context, uses it only
  after typed transient C2 failure and never treats it as authority.
- Version-2 evidence is bound to exact User, Organization, Membership and submission mode; version-1
  Membership-unknown evidence remains protected and cannot be rebound.
- The strict expected-Membership header can only narrow server-derived authority.
- The defer-only transaction persists only WorkEvent, `received` SyncReceipt and AuditEvent. It has
  no BusinessEngine, CanonicalDecision or TimeEntry-mutation path.
- Mobile clears only an exact durable acknowledgement and suppresses a faulty synchronized result
  on the defer-only path.
- The APK is 69,592,419 bytes with SHA-256
  `fa969435ec8d6f95160e74e4a1fe8dbf315b33834192094bd3cfb20ad9be5af4`; package
  `com.tim180201.mobile.synthetic`, version `1.0.0`, min SDK 24 and target SDK 36.
- The recorded device is Samsung `SM-A336B`, Android 15 / SDK 35.

## 4. Physical evidence assessment

The controlled removal only of `adb reverse tcp:3000` created a real Mobile-to-C2 transport outage
in the same warm authenticated session. This supports the narrow authorized transient-C2-unavailable
claim. It does not prove airplane mode, device-wide network loss, cold-start offline operation or a
general offline mode.

The reviewer found the physical sequence, UI copy and database transitions internally consistent.
After the one online canonical Start, the deferred physical action changed the server trace by
exactly:

```text
WorkEvent             +1
received SyncReceipt  +1
LifecycleDeferred     +1
CanonicalDecision     +0
TimeEntry             +0
stopped TimeEntry     +0
```

Android force-stop/restart proves persistence of the already captured version-2 outbox record. It
does not prove that the volatile scan context survives process termination; the evidence documents
that distinction correctly. Explicit retry produced server-review-only copy and left the original
TimeEntry started.

Cleanup was independently confirmed: ADB reverse state was empty, the synthetic schema was removed
and generated synthetic roles were zero.

## 5. Trust boundary and remaining gates

The new endpoint is not app, device, physical-scan or network-history attestation. E2A does not
define clock trust, maximum offline age, historical Membership acceptance, post-revocation handling
or later evaluation of deferred evidence. It provides no persisted scan context, multi-event queue,
automatic/background synchronization or admin reconciliation.

DT-060, DT-061, DT-062 and Block E remain open. Cold-start offline operation, multi-context caching,
multi-event ordering/backpressure, flight-mode/device-wide outage validation, iOS, C3, production
cloud/data and broader device coverage remain separately gated.

## 6. Final verdict

Verdict: **APPROVED**.

Block E2A may close only as:

> warm-session, exact-same-context, one-record deferred evidence capture under controlled transient
> C2 unavailability.

This verdict does not authorize or complete DT-060–DT-062, Block E, C3, production deployment or a
general offline feature.
