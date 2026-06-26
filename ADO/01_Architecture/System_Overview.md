# System Overview

Status: Sprint 1 Draft  
Date: 2026-06-26

## Product Summary

TapTim.e is an event-based time tracking product for small and medium-sized businesses.

Its primary version 1 interaction is mobile NFC scanning, but its architecture is based on work events and business engine decisions rather than direct NFC-to-time-entry writes.

## Product Identity

```text
One Tap. One Decision.
```

A user scans or triggers an action. The system decides whether this means start, stop, reject, pending correction or another time tracking result.

## Initial System Boundary

The system is expected to contain at least:

- Mobile application
- Trigger layer
- NFC scan capability
- Work event model
- Business engine
- Time entry domain
- Authentication
- User and role management
- Local offline event capture
- Synchronization mechanism
- Data storage
- Reporting/export capabilities

## Logical Architecture

```text
Trigger Layer
  -> Raw Event
  -> Work Event
  -> Business Engine
  -> Time Engine
  -> Time Entry
```

## Current Architecture State

Implementation architecture is not finalized yet.

The following references are acknowledged:

- `frogs-zeiterfassung`: technical reference for React Native, Expo, Firebase and NFC handling.
- `fdos-genesis`: organizational and governance reference.

## Architecture Principles

- Product decisions follow `Product_Principles.md`.
- NFC must be isolated as a trigger capability, not scattered across UI screens.
- Time tracking domain logic must be separable from UI implementation.
- Data access must be abstracted from product workflows.
- Business rules must be testable without Firebase.
- Core work events must be capturable offline.
- Security rules and permission checks must be testable.
- Release readiness requires evidence, not assumptions.

## Open Questions

- Final mobile stack: React Native/Expo or alternative?
- Backend model: Firebase-only, serverless functions or custom backend?
- Local persistence strategy for offline event queue?
- Conflict handling strategy for offline sync?
- Is iOS NFC in v1 or later?
- Which reporting/export scope belongs to v1?
