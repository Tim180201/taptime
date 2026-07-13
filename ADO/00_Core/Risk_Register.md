# Risk Register

Status: Active

| ID | Risk | Category | Severity | Status | Mitigation |
|---|---|---|---|---|---|
| R-001 | NFC behavior differs between devices and Android versions. | Technical | High | Open | Design NFC as isolated capability with real-device validation before release. |
| R-002 | Reusing frogs assumptions without review may import technical debt. | Architecture | High | Open | Treat frogs as evidence and reference only; document reuse decisions through ADRs. |
| R-003 | Stack decision made too early may reduce long-term maintainability. | Architecture | Medium | Open | Delay stack lock-in until architecture review and product capability mapping. |
| R-004 | Missing automated tests may block professional release quality. | Quality | High | Mitigated — Continuous | Root CI now runs lockfile install, Core/Mobile typecheck and tests, and Core build; tests are included in TypeScript checking. Preserve and extend coverage for every new backend/security slice. |
| R-005 | Firebase security rules may become product-critical and hard to validate manually. | Security | High | Open | Require security rules tests and release evidence before production release. |
| R-006 | A missing tenant filter, incorrect RLS policy or privileged bypass could expose one Organization's data to another. | Security | Critical | Open | Require default-deny RLS, composite tenant foreign keys, no client service credential, API plus direct-policy negative tests and independent security review before backend release. |
| R-007 | Migrating synchronous ports after backend adapters exist could create mixed contracts, unawaited writes and changed decision ordering. | Architecture | High | Open | Approve the async impact map first; migrate compiler-enforced vertical slices; prohibit `T \| Promise<T>` ports; test every failure point. |
| R-008 | Offline local TimeEntry state may conflict with the server-canonical result when WorkEvents arrive late or concurrently. | Product / Synchronization | High | Open | Use immutable/idempotent WorkEvent ingestion, server decision evidence and explicit conflict outcomes; obtain a Human Architect reconciliation decision before implementation. |
| R-009 | Provider roles or token claims could become a stale duplicate of TapTim.e Membership authorization. | Security / Architecture | High | Open | Treat Auth as identity only; resolve Organization and role from server Membership data for every request; use claims only as non-authoritative hints. |
| R-010 | Unrestricted backend service credentials could bypass database tenant policies. | Security | Critical | Open | Restrict bypass credentials to isolated audited bootstrap/worker paths; preserve user/RLS context for normal requests; test bypass endpoints explicitly. |
| R-011 | Append-only WorkEvent/decision/audit evidence may conflict with storage limitation, erasure and backup-copy obligations. | Privacy / Legal | Critical | Open | Require legally reviewed purpose/basis and numeric retention per data class; distinguish deletion, genuine anonymization, pseudonymization and restricted legal hold; replay deletions/restrictions after restore. |
| R-012 | Untrusted or manipulated device time may silently create, remove or distort payable working time. | Product / Security | Critical | Open | Keep `occurredAt` and `receivedAt` separate; detect clock skew, backwards time, unusual duration and offline delay independently; escalate suspicious evidence without TimeEntry mutation; Human Architect sets tolerances. |
| R-013 | Membership revocation may either discard legitimate pre-revocation offline work or accept forged backdated events. | Product / Security | Critical | Open | Decide grace/review/reject policy; verify historical Membership/Assignment validity plus multi-signal clock evidence; retain local evidence and observable outcomes. |
| R-014 | Automatic or custom account linking may bind the wrong person to a TapTim.e User or Membership. | Identity / Security | Critical | Open | Use one controlled v1 sign-in method; enable additional providers only after review; never merge on email equality alone; rely on verified provider linking/authenticated ceremony and audit all link changes. |
| R-015 | Pooling, session advisory locks or leaked request variables may carry tenant/JWT context across reused database connections. | Security / Reliability | Critical | Open | Prefer managed Node; use row locks or `pg_advisory_xact_lock` in the same transaction only; transaction-local context; test Supavisor modes, prepared-statement settings, rollback, reuse and cross-request leakage. |

## Risk Handling Rule

Risks are not backlog noise. A risk must either be accepted, mitigated, transferred or closed with evidence.
