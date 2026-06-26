# ADR-0002: NFC Assignment Model

Status: Accepted  
Date: 2026-06-26

## Context

TapTim.e's core product advantage is fast, reliable and user-friendly time tracking through NFC scans on mobile devices.

The initial reference use case is derived from `frogs-zeiterfassung`:

- A teacher visits a student.
- The student has an NFC card.
- The teacher scans the card at the beginning of the lesson.
- The teacher scans the card again at the end of the lesson.
- The lesson time is started and stopped without manually searching for the student.

In this use case, it is intuitive to say: an NFC tag belongs to a customer/student.

However, TapTim.e is intended for small and medium-sized businesses beyond tutoring. Future customers may attach NFC tags to:

- customers
- projects
- rooms
- construction sites
- vehicles
- machines
- locations
- workflows

## Decision

NFC tags must not be modeled as directly belonging only to a customer.

Instead, TapTim.e will use an assignment model:

```text
NFC Tag
  -> Assignment
  -> Target
```

A target may initially be a customer, but the architecture must allow other target types later.

## Version 1 Scope

Version 1 may expose a simple product experience:

```text
Assign NFC tag to customer
```

Internally, this is still represented as:

```text
NFC Tag
  -> Assignment(targetType = customer, targetId = customerId)
```

## Rationale

This keeps the initial product simple while avoiding a long-term architecture lock-in.

The NFC tag itself should only identify a physical token. It should not contain business meaning.

The business meaning is resolved by the assignment and interpreted by the business engine.

## Consequences

Positive:

- The tutoring use case remains simple.
- Future use cases do not require a database redesign.
- NFC remains an input mechanism, not a hard-coded business concept.
- Business logic can process other trigger types later.

Negative:

- The internal model is slightly more abstract than the first UI requires.
- The Development Agent must avoid overengineering the first implementation.

## Implementation Rule

The first implementation may optimize the UI for customer assignments, but the domain model must keep `NfcTag`, `NfcAssignment`, `AssignmentTarget` and `WorkEvent` conceptually separate.

## Review Trigger

This ADR must be revisited before implementing non-customer NFC targets.
