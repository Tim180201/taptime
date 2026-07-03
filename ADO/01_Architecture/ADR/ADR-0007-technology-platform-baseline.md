# ADR-0007: Technology Platform Baseline

Status: Approved  
Date: 2026-06-30  
Epic: EP-007 – Product Architecture Foundation  
Owner: Technical Lead  
Approval Authority: Human Architect  
Related Artifacts: ADR-0001, ADR-0002, ADR-0003, ADR-0004, ADR-0005, ADR-0006, TTAP-001, FB-001, TS-001

## Context

TapTim.e is a mobile-first professional time tracking product whose core differentiating capability is NFC-based work event capture.

The current architectural baseline already establishes:

- a monorepo repository strategy,
- an NFC assignment model,
- a focused v1 product scope,
- offline-first core event capture,
- an event-driven Business Engine,
- domain-first architecture.

These decisions require a platform baseline before implementation begins.

The platform baseline must support:

- reliable NFC interaction on mobile devices,
- offline capture of core work events,
- explicit synchronization,
- user authentication,
- auditable persistence,
- testable domain logic,
- incremental development inside the TapTim.e monorepo.

FDOS Rule:

> Platform decisions shall support product architecture without redefining product behavior.

## Decision

TapTim.e will use a mobile-first platform baseline.

The implementation baseline is:

```text
Mobile Application
  -> React Native / Expo baseline
  -> Native NFC capability through platform-compatible modules
  -> Local offline-capable persistence
  -> Explicit synchronization boundary
  -> Backend services for authentication, persistence and synchronization
```

The backend baseline is:

```text
Authentication
  -> managed authentication provider

Persistence
  -> cloud-hosted operational persistence

Synchronization
  -> explicit application-controlled synchronization flow

Domain Logic
  -> implemented independently from UI, NFC libraries and persistence APIs
```

The exact implementation libraries and service configuration may be refined during Technical Specification and Development Tasks, but they must remain compatible with this platform baseline.

## Platform Boundaries

### Mobile Platform

The mobile platform shall support:

- NFC scan capture,
- local work event creation,
- offline-first event storage,
- user feedback after scans,
- synchronization when connectivity is available.

The mobile UI must not own business decisions.

### Domain Platform

The domain and Business Engine shall remain independent from:

- React Native components,
- Expo APIs,
- native NFC implementation details,
- Firestore or any persistence API,
- UI navigation.

### Backend Platform

Backend services shall provide:

- authenticated access,
- durable server-side persistence,
- synchronization targets,
- security rule enforcement,
- operational auditability.

Backend services shall not replace the Business Engine.

### Persistence Platform

Persistence shall support:

- local capture of core operational events,
- later synchronization,
- durable time entry state,
- traceable work event records,
- conflict-aware synchronization.

Persistence does not define product behavior.

## Rationale

The platform baseline follows the existing product and architecture decisions.

React Native / Expo is compatible with the mobile-first direction and the existing reference-project evidence, while still requiring explicit validation for NFC, offline persistence and synchronization.

Managed backend services reduce foundation effort and allow the project to focus early implementation on the product-specific Business Engine, event flow and offline-first work event capture.

The decision keeps platform concerns separate from domain architecture. Product behavior remains defined by Product Vision, Feature Blueprints, TTAP-001 and Technical Specifications.

## Consequences

Positive:

- Implementation can begin from a concrete mobile platform baseline.
- NFC, offline capture and synchronization are treated as first-class platform concerns.
- Domain logic remains testable outside UI and infrastructure.
- The monorepo can evolve without immediate repository restructuring.
- Technical Specifications can reference a stable platform baseline.

Negative:

- Native NFC capability must be validated early.
- Offline persistence and synchronization require deliberate architecture and tests.
- Platform-specific behavior must not leak into the Business Engine.
- Managed backend choices may create vendor coupling that must be monitored.

## Implementation Rules

- Do not implement core time tracking as an online-only database write.
- Do not place Business Rules in React Native screens.
- Do not bind domain logic directly to NFC library APIs.
- Do not use persistence document shapes as the domain model.
- Do not hide synchronization failures from the event flow.
- Do not introduce platform dependencies into the domain layer.

## Validation Requirements

Before production implementation proceeds, the Development Agent shall validate:

- NFC scan capability on the supported mobile platform,
- local offline event persistence,
- synchronization queue behavior,
- authentication integration,
- backend persistence integration,
- test isolation for Business Engine logic.

## Review Triggers

This ADR shall be revisited when:

- NFC capability cannot be supported within the chosen mobile baseline,
- offline-first requirements cannot be satisfied,
- synchronization behavior requires a different backend model,
- security requirements exceed the selected managed backend model,
- the Human Architect changes v1 product scope,
- implementation evidence contradicts this platform baseline.

## Status

This ADR was created as a platform baseline during EP-007 repository integration and has completed evidence-based Review Agent approval.

Validation record: `ADO/00_Governance/AVR-001_Artifact_Validation_Register.md` (Validated, 1.0, 2026-06-30), evidence `ADO/05_Evidence/EP-007/Repository_Reconciliation.md`.
