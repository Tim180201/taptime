# Block E2A — Independent Pre-Implementation Architecture and Security Review

Status: APPROVED
Review Date: 2026-07-14
Reviewed Baseline: `9f2f922fd46e33cb9d53d80e4a7dbedb73653ad1` plus uncommitted E2A
architecture/authorization artifacts
Reviewer Independence: Read-only reviewer separate from the implementing stream
Owner: Technical Lead

## 1. Scope reviewed

The review inspected ADR-0010, the E2A Authorization and Implementation Plan, the TS-001 offline
amendment, AGENTS/ADO governance rules, the current Mobile resolver/orchestrator/outbox/transport
composition, C2 HTTP boundary, B6 transaction coordinator and migrations `002`/`003` receipt/RLS
constraints. `research/` was not read or modified.

## 2. Initial findings and dispositions

### E2A-PRE-01 — P2 — resolved before implementation

The first draft bound Membership only in Mobile while leaving the defer request unable to compare
the originating Membership with B6's current locked Membership. A revoke/regrant race could
therefore store evidence under a replacement Membership.

Disposition: the stable design requires exactly one strict
`X-TapTime-Expected-Membership-Id` UUID header. It is compared with the server-derived locked actor
and can only narrow access. Missing, duplicated, malformed or mismatched values fail closed; Mobile
retains the evidence. The lifecycle JSON body remains closed.

### E2A-PRE-02 — P2 — resolved before implementation

The first draft said "current configuration" without acknowledging that the existing lock helper
also returns inactive historical rows. Exact ID matching alone could have produced a durable
acknowledgement for inactive configuration before a historical-review policy exists.

Disposition: the defer-only durable predicate now explicitly requires exact tenant mapping, active
Assignment, `valid_to IS NULL`, active Customer and `deactivated_at IS NULL`. Missing, mismatched or
inactive configuration returns non-durable deferred and leaves Mobile evidence retained.

### E2A-PRE-03 — P2 — resolved before implementation

The first draft overstated the dedicated route as provenance enforcement even though endpoint choice
is client-controlled and the existing canonical endpoint remains an employee capability.

Disposition: ADR-0010 now states the exact trust boundary. The supported product composition routes
cache hits only to the defer endpoint; every request actually received there is defer-only. This is
not cryptographic device/network/physical-presence attestation. E2A adds no privilege to the existing
canonical API; server-issued per-event proof requires a separate ADR.

## 3. Non-blocking implementation observations

- E2A-PRE-04 — P3: exact deferred response semantics must also remain truthful for the existing
  canonical persisted-deferred branch. Persisted evidence must either receive an atomic exact
  `received` Receipt and durable acknowledgement or remain locally retained; it must never be
  described as `evidenceStored:false`.
- E2A-PRE-05 — P3: `unavailable` can mean malformed/protocol-invalid response and must invalidate the
  volatile context slot, with regression evidence.

Both observations are mandatory implementation tests but do not block the corrected design.

## 4. Feasibility and authority verification

- The existing schema supports `WorkEvent + SyncReceipt(status='received') + AuditEvent` in one B6
  transaction with null CanonicalDecision/TimeEntry links; no migration is required.
- Existing active-Membership resolution, role switching, RLS and tenant constraints remain in force.
- Expected Membership is compare-only and cannot supply actor, tenant or role authority.
- The defer endpoint has no authorized BusinessEngine/TimeEntry path.
- No numeric cache age, clock skew, offline delay, grace period or revocation policy is introduced.
- Version-1 Membership-unknown Mobile evidence remains protected and cannot be silently rebound.
- Tokens, raw NFC payloads and local lifecycle decisions remain outside durable evidence.

## 5. Verdict

**APPROVED FOR IMPLEMENTATION**

Final severity count after design corrections: P0 = 0, P1 = 0, P2 = 0, P3 = 2 non-blocking
implementation observations. Any implementation deviation from the reviewed Membership,
active-configuration, acknowledgement or trust boundaries requires renewed review.
