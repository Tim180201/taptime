# ADR-0008: Scan Deduplication and State Transition Model

Status: Recommendation — pending Technical Lead review (see `ADO/05_Evidence/EP-002/Research_Agent_Recommendations.md`)
Date: 2026-07-02
Related: ADR-0002, ADR-0004, ADR-0005, `Domain_Model.md`, `EV-0007-time-tracking-market-research.md`

## Context

`Domain_Model.md` lists several open modeling questions that have not yet been resolved:

- Can one scan both start and stop time depending on current state?
- How should duplicate scans be handled?
- Can one NFC tag have multiple assignments over time?
- Should assignment history be immutable for auditability?

`EV-0007-time-tracking-market-research.md` shows that unresolved duplicate-entry handling is a concrete, named cause of user complaints in existing products (Toggl Track, Clockify: "double entries that didn't go away regardless of refreshing"). This ADR closes that gap before Sprint 4 (Work Event Engine) begins, so the Business Engine decision logic is designed correctly the first time rather than patched after implementation.

## Decision

### 1. Toggle-based state resolution

A scan of an assigned NFC tag resolves against the current state of the most recent open Work Event for that Assignment Target:

```text
No open session for this target
  -> scan starts a session

Open session exists for this target
  -> scan stops that session
```

This formalizes the behavior already implied informally in the Domain Model's "First Business Scenario" and makes it an explicit Business Engine rule rather than an assumption.

### 2. Debounce window for duplicate scans

A second scan of the same tag within a short configurable window (proposed default: 5 seconds) is treated as a single physical interaction, not two events. This covers accidental double-taps and NFC read bounce at the hardware level.

The debounce window applies at the raw Scan Event level, before the Work Event is created — it is a hardware-noise filter, not a business rule.

### 3. Idempotent event processing

Every Scan Event carries a client-generated idempotency key (device ID + local timestamp + tag ID). If the same key reaches the backend more than once — for example after an offline queue retry — it must resolve to the same Work Event outcome exactly once. This is required for ADR-0004 (offline-first) to function correctly: sync retries must never create duplicate Time Entries.

### 4. No silent drops

Per the Audit Principle already stated in `NFC_Capability_Model.md`, a scan that is debounced, rejected, or cannot resolve to a valid Time Entry must still be preserved as a raw Scan Event for operational visibility. It must not silently disappear. Rejected scans are surfaced to Team Lead/Administrator roles as diagnostic information, not shown as time tracking noise to the Employee.

### 5. Assignment history is immutable

An NFC Assignment is never overwritten. Reassigning a tag to a new target creates a new Assignment record with a validity period; the previous Assignment remains in history. This directly answers the open question and is required for auditability (Product Principle 5).

### 6. Assignment changes are restricted

Per the existing Role Model permission matrix, only System Owner and Administrator may create or change NFC Assignments. This ADR does not change that matrix — it confirms it applies here.

## Rationale

Resolving these rules now, before Sprint 4, avoids the exact failure pattern EV-0003 identifies in competing products: ambiguous duplicate handling discovered and patched after users already hit it. It also gives the Development Agent concrete, testable acceptance criteria instead of an implicit assumption.

## Consequences

Positive:
- Removes three of the four open Domain Model questions.
- Gives Sprint 4 concrete, testable business rules instead of ad hoc handling.
- Directly closes a named competitor failure mode before it can occur.

Negative:
- Requires client-side idempotency key generation, a small addition to the NFC capability and offline queue design.
- Debounce window default (5 seconds) is a guess and should be validated against real device behavior during Sprint 5/8 device testing.

## Open Follow-up

- Confirm the debounce window value with real NFC hardware testing (Sprint 5/8), not just this ADR's assumption.
- Decide whether rejected/duplicate scans need their own retention policy under the eventual Compliance & Legal Foundation work (Sprint 7).

## Review Trigger

This ADR must be revisited if a trigger type other than NFC/manual fallback is introduced, since the toggle-based resolution assumes one physical trigger per Assignment Target.
