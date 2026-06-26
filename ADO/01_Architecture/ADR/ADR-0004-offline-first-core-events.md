# ADR-0004: Offline-first Core Events

Status: Accepted Draft  
Date: 2026-06-26

## Context

TapTim.e targets mobile work scenarios such as tutoring, home services, construction, cleaning, field service, care and other small to medium-sized business operations.

These environments may have unreliable network connectivity.

If core time tracking depends on permanent internet connectivity, the product fails exactly where it is needed most.

## Decision

TapTim.e will be offline-first for core work event capture.

Core operational events must be capturable locally and synchronized later.

## Scope

Offline-first applies to:

- NFC scan capture
- raw scan event storage
- work event creation
- pending time entry state
- synchronization queue
- conflict detection

Offline-first does not initially require full offline administration.

## Rationale

The user should never need to think:

> Do I have internet before I can track time?

Core time tracking must feel reliable under real-world mobile conditions.

## Consequences

Positive:

- Better reliability in the field.
- Stronger product fit for mobile work scenarios.
- Reduced risk of lost time tracking events.

Negative:

- Synchronization and conflict handling become core architecture concerns.
- More testing is required.
- Data model must distinguish local operational events from synced business records.

## Implementation Rule

The Development Agent must not implement core time tracking as a direct online-only database write.

The architecture must include a local event queue or equivalent offline-capable mechanism before production release.

## Review Trigger

This ADR must be revisited when finalizing the mobile stack and persistence strategy.
