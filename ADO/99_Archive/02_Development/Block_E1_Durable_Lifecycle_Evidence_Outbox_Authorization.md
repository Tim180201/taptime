# Block E1 — Durable Lifecycle Evidence Outbox Authorization

Status: Authorized — Implemented; Technical Lead, GitHub CI and Independent Security Review Passed
Authorization Date: 2026-07-14
Authorized Baseline: `9b2c8a5ed8b70a8aed5e367f6c919f439b5ac1ed`
Human Architect Authorization: Explicitly supplied after Block D closure ("der sinnvollste und professionellste Weg")
Owner: Technical Lead
Architecture Authorities: ADR-0004, ADR-0006, ADR-0008, ADR-0009, B6/C2/Block-D closures
Roadmap Scope: First prerequisite slice of DT-060–DT-062; no completion claim for full offline capture or Block E

## 1. Authorized objective

Replace Block D's deliberately volatile single pending lifecycle command with one crash-safe native
Mobile outbox record. The exact immutable command must be persisted before its first C2 lifecycle
request, retained across process termination for an ambiguous or locally unfinished transfer, and
removed only after a definitive server response can also be durably acknowledged locally.

The product flow remains:

```text
physical capture
  -> current server scan-context resolution
  -> immutable LifecycleEventCommand
  -> durable platform-secure native outbox write
  -> existing authenticated C2 lifecycle endpoint
  -> server-canonical BusinessEngine decision
  -> durable outbox clear
  -> truthful UI outcome
```

This is the smallest end-to-end Block-E slice that removes Block D's process-death data-loss window
without inventing offline assignment authority or reusing the legacy Core demo queue.

## 2. Fixed architecture and security boundaries

- Do not reuse `QueuedWorkEventRecord`, `FileOfflineQueue` or the legacy Core
  `SynchronizationService` in the product Mobile path. They predate the server-canonical B6 path and
  may contain a client-side `BusinessEngineDecision`.
- Persist only the existing `LifecycleEventCommand` plus its originating User/Organization binding.
  Never persist access tokens, refresh tokens, provider objects, raw NFC UID payloads, server
  decisions, Customer display data or database details.
- Use the already installed native `expo-secure-store` adapter with a fixed versioned key, strict
  schema validation and a bounded serialized payload. `WHEN_UNLOCKED_THIS_DEVICE_ONLY` configures
  iOS Keychain accessibility; Android relies on expo-secure-store's Keystore-backed encrypted native
  storage and does not interpret that iOS field. No new dependency or migration is authorized.
- The current UI blocks a second scan while evidence is unresolved. The first durable adapter must
  therefore model exactly one record and must not falsely claim a multi-event offline queue.
- Write the record before the first lifecycle HTTP request. A storage write failure sends no
  lifecycle request and permanently disables new scans for that runtime instance.
- A restored record may be retried only under the same User and Organization. A different identity
  receives a disclosure-free protected state and can neither send nor replace the record.
- Every retry reuses byte-equivalent WorkEvent, Receipt, `occurredAt` and `attemptNumber = 1` evidence.
  Transport retry count is not written into the server receipt contract.
- Clear the record only after `synchronized`, `deferred`, `conflict` or `authority_rejected`. If the
  local clear fails, retain the evidence and allow only the same idempotent reconciliation action.
- Invalid, corrupt, oversized or unavailable native storage fails closed. Automatic deletion of
  unreadable evidence is forbidden because it could silently discard a real work action.
- Mobile continues to present the server result only; no start/stop rule enters Mobile.

## 3. Mandatory verification

Automated tests must prove:

- native versioned key, platform-accurate options and exact schema round-trip;
- rejection of unknown versions, extra authority/decision fields, tenant mismatch, changed attempt
  number, oversized values and unavailable storage;
- persistence occurs before lifecycle submission and definitive results clear it;
- transient/unavailable results survive a simulated process restart and replay exact evidence;
- another User/Organization cannot inspect, replace, retry or bypass a restored record;
- write/read failures disable scanning and cannot be undone by a later session transition;
- a successful server response followed by local-clear failure retains the exact record for safe
  reconciliation;
- all existing Mobile, Core and affected workspace checks remain green, with migrations still
  exactly `001`–`005`.

## 4. Explicit non-goals and next gate

This slice does not authorize or claim:

- scanning while C2 scan-context resolution is unreachable;
- a tenant configuration/assignment cache, multiple queued events, background OS tasks, automatic
  retry scheduling, exponential backoff or connectivity monitoring;
- setup/Admin flows DT-063–DT-066, export DT-067/068, C3, iOS physical validation, production cloud
  deployment or personal production data;
- any Core BusinessEngine, B5/B6/C2 contract, schema, RLS or migration change.

Full offline capture requires a separately reviewed tenant-safe configuration-cache policy covering
assignment activation/revocation, staleness, identity binding and reconciliation. Block E and
DT-060–DT-062 remain open after E1.
