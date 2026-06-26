# ADR-0005: Event-driven Business Engine

Status: Accepted Draft  
Date: 2026-06-26

## Context

TapTim.e's product identity is based on the principle:

> One Tap. One Decision.

A user should not manually decide whether an interaction is start, stop or another action when the system can determine it safely.

NFC is a trigger mechanism, but the product must not hard-code business decisions into the NFC layer.

## Decision

TapTim.e will use an event-driven business engine.

The core flow is:

```text
Trigger
  -> Raw Event
  -> Work Event
  -> Business Engine Decision
  -> Time Entry Result
```

The business engine is responsible for deciding what a work event means.

## Engine Responsibilities

The business engine may decide:

- start time tracking
- stop time tracking
- reject event
- flag ambiguity
- create pending correction state
- require later approval
- detect duplicates
- detect conflicts

## Non-Responsibilities

The business engine must not:

- directly depend on the NFC library
- directly depend on Firestore APIs
- own UI navigation
- hide events that failed validation

## Rationale

This structure separates user input, business interpretation and persistent records.

It allows the product to support future triggers without rewriting time tracking rules.

## Consequences

Positive:

- Strong separation of concerns.
- Testable business rules.
- Future support for QR, manual, GPS or API triggers.
- Better auditability.

Negative:

- Requires deliberate modeling of events and state transitions.
- Slightly more upfront architecture than direct scan-to-time-entry implementation.

## Implementation Rule

The Development Agent must implement business decisions as testable domain logic, not as UI-side conditional code.

## Review Trigger

This ADR must be revisited before implementing additional trigger types beyond NFC/manual fallback.
