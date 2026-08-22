# Development Assignment 1 — Independent Pre-Implementation Architecture and Security Review

Status: **APPROVED — ZERO OPEN P0/P1/P2/P3; SUBSEQUENT HUMAN CONTRACT ACCEPTANCE RECORDED;
SEPARATE IMPLEMENTATION RELEASE STILL REQUIRED**
Review Date: 2026-07-18
Candidate Parent: `1bb2d7d7b38928643cfd5c86b36c500c35f73276`
Candidate Commit: `592334160655cde2f4189712eaf327c8a7edcb0e`
Candidate Tree: `96fffb5bb5e2793041c36b8f793c38ab1c2e5428`
Candidate CI: GitHub Actions run `29653357355`, attempt 1, push to `main`, 10/10 jobs successful
Review Type: Independent read-only pre-implementation architecture/security review
Owner: Technical Lead
Final Decision Authority: Human Architect
Human Contract Acceptance Date: 2026-07-18
Implementation Authority: **Not granted**

## 1. Review scope and binding

The independent reviewer verified the exact parent, candidate commit, tree, subject, remote head and
CI binding. The reviewed delta contained exactly the following seven ADO files:

1. `ADO/README.md`;
2. `ADO/00_Core/Decision_Log.md`;
3. `ADO/00_Core/Project_Status.md`;
4. `ADO/01_Architecture/ADR/ADR-0012-complete-offline-synchronization-platform.md`;
5. `ADO/02_Development/Development_Assignment_01_Complete_Offline_Synchronization_Authorization.md`;
6. `ADO/05_Evidence/Core_Roadmap_v2_Commercial_Readiness.md`; and
7. `ADO/05_Evidence/Product_Readiness_Roadmap.md`.

The delta was `+988/-5`, `git diff --check` passed and no production source, test, SQL migration,
workflow, package, lockfile or build artifact changed. The existing ten-job CI matrix ran unchanged
on the documentation-only head. It proves non-regression of the existing repository, not
implementation of the candidate, which is the truthful expectation for this ADO-only review point.

## 2. Final verdict

**APPROVED.**

Open severity count:

- P0: 0;
- P1: 0;
- P2: 0; and
- P3: 0.

No finding was waived. The reviewer independently checked the existing Mobile, Core, backend,
schema, authentication, lifecycle, administration, Membership and Assignment-history boundaries
needed to validate the candidate's repository-truth claims.

## 3. Architecture and security disposition

### 3.1 Scope and governance

The candidate truthfully separates:

1. candidate preparation and publication;
2. independent pre-implementation review;
3. explicit Human acceptance;
4. a later separate exact-baseline implementation release;
5. implementation and Technical-Lead verification;
6. exact-head CI and independent implementation review;
7. the complete fresh Human physical gate; and
8. final closure publication and review.

Nothing in the reviewed candidate claims implementation, dependency installation, migration `010`,
APK/build authority, physical validation, production resources/data or DT-060–DT-062 completion.

### 3.2 Server-canonical authority

The client can create only immutable capture evidence and truthful local-pending state. It cannot
create a CanonicalDecision, provisional TimeEntry or Start/Stop claim. The server remains the sole
authority for current identity, Membership, Organization, Assignment, target and lifecycle
decisions. E2A defer-only and protected legacy evidence cannot be silently reinterpreted.

### 3.3 Lease, identity and revocation

The reviewed lease is bound to the exact installation, IdentityBinding, User, Organization,
Membership, Membership `rowVersion` and role. Role change, revocation, identity replacement,
reassignment, stale configuration, multi-device ordering or an unresolved predecessor fail closed
to durable review evidence rather than causing unauthorized lifecycle mutation. A lease item is
explicitly not device, physical-presence or NFC-possession attestation.

### 3.4 Cryptography

The reviewer accepted the 256-bit installation binding, transient 32-byte lookup key,
server-persisted key hash, HMAC-SHA-256 lookup values, canonical UTF-8 payload, lowercase hex
encoding, length-framed manifest digest and shared cross-runtime test vectors. Replay, collision,
canonicalization and key-loss behavior is either fail-closed or explicitly retained as a declared
platform residual risk.

### 3.5 Time and Android boot boundary

Android `SystemClock.elapsedRealtime()` behind a native port is the accepted monotonic primitive.
The same-boot requirement, reboot/unverifiable-marker review-only behavior and explicit rejection
of a JavaScript process clock as durable proof are coherent. The reviewer accepted the proposed
12-hour lease, plus/minus-five-minute clock tolerance and 72-hour automatic-evaluation window as
testable policies suitable for explicit Human decision.

### 3.6 Durable Mobile storage

The SQLCipher/Expo SQLite design, SecureStore-held database key, strictly validated internal
`PRAGMA key` value, WAL, foreign keys, exclusive migrations and single queue owner were accepted.
Uninstall, key loss, corruption and unknown schema versions remain protected states without silent
deletion. E1/E2A v2 import is transactional and readback-verified; v1 or unknown evidence is
quarantined. Queue limits are exact and fail closed without eviction.

### 3.7 FIFO, idempotency and reconciliation

Every online and offline scan is persist-first. Strict per-installation sequence, head-only
transmission, server-side next-contiguous enforcement and unresolved-predecessor blocking prevent
overtaking. Exact retries, divergent-retry conflicts, bounded reconciliation, full-jitter backoff
and validated `Retry-After` handling preserve evidence across lost responses and transient failure.

### 3.8 Backend and database isolation

The proposed migration, six tables, three executor roles, three function owners, three separate
pools and four API routes were judged sufficiently narrow for a future implementation plan. Forced
RLS, tenant-qualified integrity, lock-before-check ordering, append-only evidence, body/response
limits, bounded pagination, manifest verification, pool cleanup and fault-injection tests remain
mandatory.

### 3.9 Background and network truth

Network state is a scheduling hint, never proof of reachability or delivery. Background execution
is OS-controlled best effort and carries no immediate-delivery SLA. Foreground, app-start, event and
manual triggers remain the reliable synchronization opportunities. Native storage/background
behavior must be proven in the custom Android build rather than Expo Go or mocks alone.

### 3.10 Verification and physical gate

The required automated matrix covers success, denial, race, rollback, recovery, migration,
cryptography, tenant isolation, corruption and pooling. The fresh physical gate must prove airplane
mode, Force Stop, cold start, ordered A/B/A capture, lost-response recovery, stale
configuration/revocation, background development trigger, reconciliation and cleanup. It can begin
only after an implementation is separately authorized, completed, Technical-Lead verified,
published, exact-head CI green and independently approved.

## 4. Reviewed policy values

The independent review found no blocker in the following proposed Human-policy values:

- capture-lease lifetime: 12 hours;
- clock-anchor tolerance: plus/minus 5 minutes;
- automatic-evaluation window: no more than 72 hours after lease expiry;
- lease projection: at most 4,096 items and 4 MiB;
- local queue: at most 256 unresolved events, 4 KiB per event and 1 MiB total;
- lease pages: at most 100 items;
- reconciliation request: at most 25 event IDs;
- retry backoff: 2 seconds with full jitter, capped at 5 minutes; and
- accepted `Retry-After`: 1 through 900 seconds.

Independent technical approval did not itself make these accepted product policies. The subsequent
Human decision recorded below completed that contract-acceptance transition without granting
implementation authority.

## 5. Human-Architect gate and subsequent acceptance

The independent reviewer answered **Yes**: the Human Architect may accept ADR-0012 and Sections
3–13 of the authorization candidate, including the numeric policies above.

The Human Architect subsequently supplied the following exact decision:

> Ich akzeptiere ADR-0012 und die Sections 3–13 des
> Development-Assignment-1-Autorisierungskandidaten auf dem unabhängig geprüften
> Kandidaten-Commit 592334160655cde2f4189712eaf327c8a7edcb0e einschließlich aller darin
> festgelegten numerischen Policy-Grenzen. Noch keine Implementierungsfreigabe.

ADR-0012 and Sections 3–13 are therefore Human-accepted on the independently reviewed candidate.
The final sentence expressly withholds implementation. The Human Architect must issue a later
separate statement bound to the exact then-current baseline before Workstreams A–E may begin.

## 6. Current release gate

**STOP — HUMAN CONTRACT ACCEPTED; SEPARATE IMPLEMENTATION RELEASE PENDING.**

Until the remaining separate Human implementation release exists:

- ADR-0010/E1/E2A remains the only approved offline product behavior;
- no dependency may be installed;
- migration `010` may not be created;
- no product, backend, schema or native source may change;
- no APK/EAS build or physical gate may start;
- no production resource or personal data may be used; and
- DT-060–DT-062 remain open.

## 7. Exact next step

After this acceptance synchronization is published and exact-head CI is green, the Human Architect
may separately release Workstreams A–E for repository implementation on that exact baseline.
