# ADR-0010: Warm-Session Offline Evidence and Reconciliation

Status: Approved for E2A
Date: 2026-07-14
Approval Date: 2026-07-14
Roadmap: Core Roadmap v2, Block E (first offline-capture slice of DT-060–DT-062)
Owner: Technical Lead
Approval Authority: Human Architect
Related Artifacts: ADR-0004, ADR-0006, ADR-0008, ADR-0009, FB-001, TS-001,
`ADO/02_Development/Block_E2A_Warm_Session_Deferred_Offline_Capture_Authorization.md`,
`ADO/02_Development/Block_E2A_Warm_Session_Deferred_Offline_Capture_Closure.md`,
`ADO/05_Evidence/Block_E2A_Warm_Session_Deferred_Offline_Capture_Physical_Validation_Evidence.md`,
`ADO/05_Evidence/Block_E2A_Independent_Final_Architecture_Security_Review.md`

## Context

Block E1 made one already-resolved lifecycle command durable before transmission. It deliberately
left scan-context resolution online-only. Extending that outbox with arbitrary cached assignments
would be unsafe: an NFC Assignment, Membership or Customer may have changed; device time is
untrusted; and the approved numeric clock, offline-delay and post-revocation policies do not yet
exist.

The product nevertheless needs a truthful first offline slice. A common bounded case is an employee
who has already used the authenticated app and resolved a tag online, temporarily loses network
connectivity, and scans that same tag again before the authenticated runtime is replaced. The device
can preserve that action as evidence without deciding whether it starts or stops working time.

## Decision

### 1. Authority and product meaning

E2A permits Mobile to capture one candidate WorkEvent from one previously server-resolved scan
context during the same live authenticated session generation. The cached context is lookup evidence
only. It grants no Membership, Assignment, target or lifecycle authority and never permits Mobile to
derive a start, stop, duplicate or rejection decision.

Every cached-context submission made by the supported product composition follows a distinct server
ingestion policy at `POST /v1/lifecycle-events/deferred`. The server derives and locks the current
authenticated Membership, compares it with a client-supplied `X-TapTime-Expected-Membership-Id`
header that may only narrow access, and revalidates the current tenant-scoped
Assignment/Tag/target mapping. Durable storage additionally requires an active Assignment with no
`valid_to` and an active Customer with no `deactivated_at`; inactive, missing or mismatched
configuration returns a non-durable deferred result and Mobile retains the local evidence. If the
durable predicate holds, the server atomically persists the immutable WorkEvent, a `received`
SyncReceipt and an audit event, then returns an exact acknowledgement. This endpoint does not invoke
the Business Engine, write a CanonicalDecision or mutate a TimeEntry.

Until separately approved clock, offline-delay, historical-membership and administrative-review
policies exist, cached-context evidence always remains deferred. No numeric freshness threshold is
introduced by E2A.

### 2. Cache boundary

The Mobile cache contains exactly one positive scan context in volatile process memory:

- canonical NFC payload;
- Assignment ID, NFC Tag ID and AssignmentTarget returned by the server;
- exact session generation, User ID, Organization ID, Membership ID and role.

It is seeded or replaced only by a valid live `resolved` response. A live request is attempted for
every scan. Fallback is permitted only when that request ends in the transport-classified
`transient_failure` state and every cached field exactly matches the current session and payload.

`not_resolved` invalidates the matching slot. `authority_rejected` invalidates the slot for that
session and never falls back. `unavailable` also invalidates the slot and never falls back because it
can represent a malformed or protocol-invalid response. Logout, session-generation replacement,
identity replacement and runtime stop clear the slot; process termination removes it by construction.

The raw canonical payload is never written to SecureStore, a log, UI or server lifecycle body. It
exists only in the volatile comparison slot and in the already authorized live scan-context request.

### 3. Durable evidence and identity binding

The existing one-record E1 outbox remains the only durable Mobile evidence store. New records are
version 2 and bind the exact command, submission mode and expected Membership to User ID,
Organization ID and Membership ID. The header expectation must equal the local binding and must equal
the Membership locked by the server; it is never accepted as authority. The server-ready command,
physical `occurredAt`, UUIDs and `attemptNumber = 1` remain immutable across every retry.

Version-1 E1 records are read for preservation but have no Membership ID. Mobile must never infer
one from the current session. Such a record remains protected and cannot be replayed or replaced
until a separately authorized reconciliation mechanism exists. The existing storage key is retained
so upgrading the app cannot silently abandon unresolved evidence.

### 4. Acknowledgement and reconciliation

The lifecycle response distinguishes:

- `synchronized`: an exact WorkEvent/Receipt acknowledgement with a canonical decision;
- durable `deferred`: an exact WorkEvent/Receipt acknowledgement proving evidence storage but no
  TimeEntry mutation;
- non-durable `deferred`: current configuration could not safely identify a storage target;
- `conflict`, authority rejection and infrastructure/protocol failure.

Mobile clears only the exact pending record after either canonical `synchronized` or durable
`deferred` with matching WorkEvent and Receipt IDs. A defer-only submission treats any
`synchronized` response as invalid, retains its evidence and never publishes its lifecycle Decision.
Mobile also retains evidence after non-durable `deferred`, `conflict`, authority rejection,
transient failure, malformed response or local-clear failure. Retained evidence blocks new scans and
is never rebound to another Membership.

The endpoint choice is not a cryptographic attestation of device state, physical presence or network
history. An authenticated modified client can still call the pre-existing canonical lifecycle API
within its existing employee capability. E2A adds no new privilege and guarantees defer-only
behavior for the supported product composition and for every request actually received by the new
endpoint. Server-issued per-event scan-context proof and anti-fraud policy require a separate ADR.

### 5. Explicit scope boundary

E2A is warm-session, one-context, one-pending-event capture. It does not authorize or claim:

- cold-start offline sign-in or a persisted identity lease;
- a durable assignment/configuration cache, multiple tags or a multi-event queue;
- automatic/background retry, connectivity monitoring or exponential backoff;
- local lifecycle decisions or provisional TimeEntries;
- post-revocation server ingestion, a grace window or an administrative review UI;
- general clock-skew, future-time or maximum-offline-delay tolerances;
- C3, setup/Admin, correction, export, production cloud or production personal data.

## Alternatives considered

### Durable multi-context cache and multi-event SQLite queue

This is the intended later Block-E direction, but it requires encryption-key lifecycle, transactional
migrations, capacity/backpressure, identity-lease expiry, corruption handling, FIFO reconciliation
and numeric freshness decisions. SecureStore is not a database. Implementing that surface before the
smaller server-deferred seam is proven would increase risk without improving authority.

### Numeric cache lifetime

An 8- or 24-hour cache was considered. Either value would be an unapproved product/security rule and
would still not make stale Assignment or device time authoritative. E2A instead binds the volatile
slot to the server-confirmed session generation and forces every cached submission to deferred.

### Reuse the normal lifecycle endpoint without product provenance

This would let the supported Mobile composition route stale cached context into automatic Business
Engine evaluation. A distinct endpoint selects a server-controlled defer-only policy and creates an
auditable product boundary. It deliberately does not claim to attest an unmodified client.

## Consequences

Positive:

- temporary network loss can no longer erase the employee's second physical action in the common
  warm-session/same-tag flow;
- server-canonical lifecycle authority remains intact;
- exact durable acknowledgement removes E1's ambiguous `deferred` clear behavior;
- Membership replacement and legacy records fail closed;
- no new dependency, SQL migration or arbitrary numeric policy is required.

Negative:

- the cached scan does not immediately display start or stop;
- only one context and one unresolved event are supported;
- process restart removes the cache, although an already captured command remains durable;
- current Membership revocation prevents server storage and leaves the local evidence protected;
- an administrative reconciliation workflow is still required for retained conflict/revocation
  evidence and for durable deferred evidence to affect working time later.

## Review triggers

Review this ADR before adding a persisted cache, cold-start offline mode, multiple events, background
execution, automatic evaluation of cached evidence, numeric age/clock tolerances, historical
Membership ingestion, administrative reconciliation, server-issued scan-context proof, client/device
attestation, iOS NFC or production data.
