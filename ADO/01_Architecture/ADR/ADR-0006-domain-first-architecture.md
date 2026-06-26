# ADR-0006: Domain-first Architecture

Status: Accepted Draft  
Date: 2026-06-26

## Context

Many application projects let the database shape the product model.

For TapTim.e this would be risky because the domain contains important distinctions:

- raw scan event
- work event
- time entry
- NFC tag
- assignment
- target
- user
- role

If these concepts are collapsed into database documents too early, the product becomes harder to test, evolve and reason about.

## Decision

TapTim.e will use a domain-first architecture.

The Development Agent must model product concepts in the domain layer before binding them to storage implementation details.

## Rule

Application code must not treat Firestore collections or document shapes as the domain model.

Firestore, or any other persistence technology, is infrastructure.

The domain model is defined by TapTim.e business concepts.

## Rationale

Domain-first architecture supports:

- clearer business logic
- better tests
- easier future persistence changes
- better separation between product behavior and infrastructure
- stronger maintainability

## Consequences

Positive:

- Business rules become testable without Firebase.
- Product language remains stable even if storage changes.
- Development Agent has clearer boundaries.

Negative:

- Requires additional mapping between domain objects and persistence records.
- May feel slower at the beginning than directly writing Firestore documents.

## Implementation Rule

The Development Agent must not implement feature logic directly inside database access functions.

Persistence adapters may save and load data, but they must not own product decisions.

## Review Trigger

This ADR must be revisited when finalizing the stack and data model.
