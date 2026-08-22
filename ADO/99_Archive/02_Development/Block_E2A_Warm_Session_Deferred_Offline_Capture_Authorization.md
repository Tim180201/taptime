# Block E2A — Warm-Session Deferred Offline Capture Authorization

Status: Completed — Technical Lead, GitHub CI, Human Physical Android and Independent Security Approved
Authorization Date: 2026-07-14
Authorized Baseline: `9f2f922fd46e33cb9d53d80e4a7dbedb73653ad1`
Implementation Commit: `4b5ecdc7d6605db3e231f9ead966ebf104900a30`
Implementation CI: GitHub Actions run `29348512506` — all eight jobs passed
Independent Final Review: `APPROVED`; no open P0/P1/P2/P3 findings
Human Architect Authorization: Explicit continuation under the delegated professional architecture
direction ("Wir machen es nach deiner Vorstellung" / "lass loslegen")
Owner: Technical Lead
Architecture Authorities: ADR-0004, ADR-0006, ADR-0008, ADR-0009, ADR-0010, B6/C2/E1 closures
Roadmap Scope: Narrow E2A advance of DT-060–DT-062; no completion claim for Block E

## 1. Authorized objective

Deliver the smallest tenant-safe offline product flow after E1:

```text
physical Android NFC capture
  -> live C2 scan-context attempt
  -> exact same-session one-slot fallback only after transient transport failure
  -> immutable Membership-bound E1 command persisted before send
  -> dedicated authenticated `POST /v1/lifecycle-events/deferred` endpoint
  -> current tenant/configuration revalidation
  -> atomic WorkEvent + received SyncReceipt + audit persistence
  -> exact durable deferred acknowledgement
  -> outbox clear and truthful "server review pending" presentation
```

No cached scan may invoke a new canonical lifecycle decision or mutate a TimeEntry.

## 2. Fixed implementation boundaries

- Introduce a private `SessionBoundScanContextResolver` between the live C2 transport and product
  orchestrator. It owns exactly one immutable in-memory positive context.
- Bind cache hits to exact session generation, User, Organization, Membership, role and canonical
  payload. Live resolution always runs first; only `transient_failure` may use the slot.
- Never use cache after `not_resolved`, `authority_rejected` or `unavailable`; invalidate as defined
  by ADR-0010.
- Persist no scan-context cache and no raw UID payload. Retain the existing 2-KiB SecureStore
  single-record model.
- Write outbox schema version 2 with exact Membership binding and submission mode. Parse version 1
  only as Membership-unknown protected evidence; never infer or migrate its Membership.
- Add the distinct `POST /v1/lifecycle-events/deferred` route that injects an internal defer-only
  ingestion policy. Its body stays the existing closed lifecycle command. A single strict
  `X-TapTime-Expected-Membership-Id` UUID header may narrow the request but never grants authority:
  B6 must compare it with the Membership derived and locked from the authenticated identity. Missing,
  duplicated, malformed or mismatched expectation fails closed. The canonical route may accept the
  same optional expectation for new v2 clients while remaining compatible with the existing body.
- Under defer-only policy, revalidate active current Membership and exact current tenant
  configuration. Durable storage requires the exact mapping, an active Assignment with `valid_to IS
  NULL`, and an active Customer with `deactivated_at IS NULL`; inactive/missing/mismatch returns
  non-durable deferred and leaves Mobile evidence retained. Only the durable branch atomically writes
  WorkEvent, `received` SyncReceipt and audit evidence. Do not call BusinessEngine, create
  CanonicalDecision or mutate TimeEntry.
- Make `deferred` acknowledgements an exact union. Durable is
  `{status:'deferred', evidenceStored:true, idempotentRetry, workEventId, receiptId}`;
  configuration-missing/mismatch rollback is
  `{status:'deferred', evidenceStored:false, reason:'configuration_unavailable_or_inactive'}`.
- Mobile clears only exact `synchronized` or durable `deferred` acknowledgement. It retains every
  other result, blocks a second scan and never changes identity binding.
- Preserve all C1/C2/B3/B4/B5/B6 tenant, token, RLS, UUID, timestamp, body-size, timeout and strict
  JSON boundaries.
- The defer-only Mobile client must reject `synchronized`; the orchestrator must independently retain
  the evidence and suppress the Decision if a faulty adapter nevertheless returns it.
- Add no SQL migration and no dependency.

## 3. Required independent pre-implementation review

An independent reviewer must verify before product-code implementation:

- the cache cannot grant authority or survive a session/process boundary;
- the server route can only reduce authority and cannot bypass current Membership/RLS checks;
- the supported cache-hit composition can call only the defer endpoint, that endpoint has no
  BusinessEngine/TimeEntry path, and Mobile suppresses an invalid synchronized result;
- exact durable acknowledgement is representable with the existing schema;
- version-1 evidence cannot be silently rebound;
- the scope introduces no unapproved numeric freshness, clock or revocation rule.

The review must also verify the documented trust boundary: route choice is not client/device
attestation. E2A adds no new privilege to the pre-existing authenticated canonical endpoint.

Any P0/P1/P2 finding blocks implementation until corrected.

## 4. Mandatory automated verification

Tests must prove at minimum:

- live resolution seeds/replaces the one-slot cache;
- only exact same snapshot and payload fall back after `transient_failure`;
- every other identity/session/payload/result fails closed and definitive misses invalidate;
- cached-source command is persisted before the defer-only HTTP call;
- new outbox records include Membership and mode; v1 records remain protected;
- the dedicated route injects defer-only policy and rejects widened/malformed bodies;
- malformed, duplicate or mismatched Membership expectation cannot reach persistence, including a
  revoke/regrant replacement scenario;
- inactive Assignment or Customer configuration cannot produce a durable acknowledgement;
- offline evidence atomically writes WorkEvent, received Receipt and Audit with zero decisions and
  zero TimeEntry mutations, including rollback fault injection;
- retry returns an exact idempotent durable acknowledgement or conflict;
- non-durable deferred, conflict, authority rejection and failures never clear local evidence;
- exact synchronized/durable-deferred acknowledgement clears only the matching record;
- React receives no cache, UID, token, transport, storage or native NFC capability;
- all existing typechecks, unit/integration suites, workspace builds, Android export and migration
  guards remain green.

## 5. Required physical gate and closure truth

Before E2A closure, the supported Android device must prove:

1. sign in and resolve the pilot tag online;
2. disable connectivity without killing the app;
3. scan the same tag and receive only a pending/server-review message;
4. verify no local Start/Stop claim;
5. restore connectivity and submit the exact retained command;
6. verify durable server WorkEvent/Receipt/Audit evidence and no automatic TimeEntry mutation;
7. verify process restart still protects an already captured pending command.

Closure may claim only warm-session same-context offline evidence capture. DT-060–DT-062 and Block E
remain open until the durable multi-context/multi-event/reconciliation design is separately
authorized, implemented, physically validated and independently approved.

The Human Architect completed this gate on a Galaxy A33 5G / Android 15 with NTAG213 Tag A. The
controlled interruption removed only C2 USB reverse `tcp:3000`, not all device connectivity. The
already captured version-2 command survived Android force-stop/relaunch and exact explicit retry.
Final server state retained one active TimeEntry and one CanonicalDecision while the deferred delta
added only WorkEvent, `received` SyncReceipt and Audit evidence. Full details are in
`ADO/05_Evidence/Block_E2A_Warm_Session_Deferred_Offline_Capture_Physical_Validation_Evidence.md`.

## 6. Explicit non-goals

Cold-start offline use, persisted identity/configuration leases, multi-event queueing, automatic or
background retry, numeric staleness/clock rules, post-revocation ingestion, admin reconciliation,
server-issued scan-context proof, client/device attestation, C3, setup/Admin/export/correction flows,
iOS NFC, production deployment and production personal data remain gated.
