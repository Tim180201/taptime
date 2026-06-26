# System Overview

Status: Draft

## Product Summary

TapTim.e is a time tracking product centered around mobile NFC chip scanning.

## Initial System Boundary

The system is expected to contain at least:

- Mobile application
- NFC scan capability
- Authentication
- Time entry domain
- User and role management
- Data storage
- Reporting/export capabilities

## Current Architecture State

No implementation architecture is finalized yet.

The following references are acknowledged:

- `frogs-zeiterfassung`: technical reference for React Native, Expo, Firebase and NFC handling.
- `fdos-genesis`: organizational and governance reference.

## Architecture Principles

- NFC must be isolated as a capability, not scattered across UI screens.
- Time tracking domain logic must be separable from UI implementation.
- Data access must be abstracted from product workflows.
- Security rules and permission checks must be testable.
- Release readiness requires evidence, not assumptions.

## Open Questions

- Final mobile stack: React Native/Expo or alternative?
- Backend model: Firebase-only, serverless functions or custom backend?
- User roles and permission model?
- Offline behavior requirements?
- NFC tag provisioning and assignment model?
