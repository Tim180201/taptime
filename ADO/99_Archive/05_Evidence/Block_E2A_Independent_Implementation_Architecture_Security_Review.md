# Block E2A — Independent Implementation Architecture and Security Review

Status: APPROVED — Implementation Scope; Subsequent GitHub CI and Physical Android Gates Passed; Closure Verdict Separate
Review Date: 2026-07-14
Reviewed Baseline: `9f2f922fd46e33cb9d53d80e4a7dbedb73653ad1` plus the complete uncommitted E2A implementation and in-progress governance diff
Reviewer Independence: Read-only reviewer separate from the implementing streams
Owner: Technical Lead

## 1. Scope reviewed

The reviewer inspected ADR-0010, the E2A authorization/plan/pre-implementation review, TS-001,
the complete Mobile resolver/outbox/orchestrator/transport/UI implementation, the API and lifecycle
defer-only path, the synthetic Android harness, all changed tests, the migration inventory and the
current in-progress governance claims. `research/` was excluded and unchanged.

## 2. Initial findings

Severity count before disposition: P0 = 0, P1 = 0, P2 = 0, P3 = 2.

### E2A-IMPL-01 — P3 — dispositioned

The API accepted UUID syntax case-insensitively but originally forwarded the header spelling
unchanged. PostgreSQL renders UUID values in lowercase, so a semantically identical uppercase
expected-Membership header could be rejected by the later exact string comparison.

Disposition: the HTTP boundary now canonicalizes the validated UUID to lowercase. A regression
sends an uppercase UUID and proves that the capability receives the canonical lowercase value.

### E2A-IMPL-02 — P3 — dispositioned

The new synthetic defer-only integration case originally depended on Tag-A provisioning and
Start/Stop state created by the preceding test. The complete suite passed, but the case failed when
selected in isolation.

Disposition: the test now provisions Tag A itself when required and verifies relative evidence
deltas. The complete six-test suite and the isolated defer-only case both pass.

## 3. Verified boundaries

- the volatile cache is bound to exact session generation, User, Organization, Membership, role and
  payload, and is used only after a typed live transient failure;
- definitive misses and authority/protocol failures invalidate the cache as authorized;
- version-1 Membership-unknown evidence remains protected and is never rebound;
- version-2 evidence binds exact Membership and submission mode and is persisted before send;
- the defer-only route compares current locked Membership and exact active configuration;
- its durable transaction writes only WorkEvent, `received` SyncReceipt and AuditEvent;
- it does not evaluate the BusinessEngine, create a CanonicalDecision or mutate a TimeEntry;
- Mobile clears only an exact synchronized or exact durable-deferred acknowledgement and retains
  every ambiguous, conflicting, rejected, malformed or non-durable result;
- no token or raw NFC payload is persisted or logged, and no cache/native capability reaches React;
- migrations remain exactly `001`–`005`; no SQL or dependency changed.

## 4. Independent verification

- Mobile tests-inclusive TypeScript check: passed.
- Mobile: 310/310 tests in 19 files passed.
- Backend lifecycle: 88/88 tests plus TypeScript check and build passed.
- Backend API: 139/139 tests plus TypeScript check and build passed.
- Synthetic Android E2E: 6/6 complete suite and 1/1 isolated defer-only selection passed.
- Core: 288/288 tests passed.
- Complete workspace build and Android Expo export passed.
- `git diff --check`, migration inventory and dependency guards passed.

## 5. Verdict and remaining gates

**APPROVED** for the implemented E2A scope. Both non-blocking P3 findings are dispositioned and the
targeted independent follow-up found no new finding.

At the time of this implementation review, this was not E2A closure evidence and GitHub CI plus the
physical Galaxy A33 checklist remained mandatory. The endpoint is not client/device/physical-scan
attestation, DT-060–DT-062 and Block E remain open, and production or full-offline claims remain
unauthorized.

## 6. Subsequent gate record — not part of the original implementation verdict

Technical Lead record: the reviewed implementation was published as commit
`4b5ecdc7d6605db3e231f9ead966ebf104900a30`, which passed all eight jobs in GitHub Actions run
`29348512506`. The Human Architect subsequently completed the controlled Galaxy A33 / Android 15
C2-transport-loss, process-restart and deferred-evidence checklist. Those later facts are assessed
by the separate independent final review; they do not retroactively expand this implementation-only
review's provenance or scope.
