# Technical Roadmap

Status: Superseded by the EP-based engineering model — preserved for historical reference. `ADO/00_Core/Decision_Log.md` is authoritative for current engineering status.

## Current Engineering Model

This document originally planned TapTim.e using a Sprint 0–6 model. That model has been superseded by the EP-002…EP-008 epic-based engineering model used throughout the rest of the repository. The Sprint sections below are preserved unchanged as historical planning content and are not rewritten; they are not the current source of truth for engineering status.

Historical-to-current mapping, for traceability:

| Original Sprint (below, unchanged) | Corresponding current state |
|---|---|
| Sprint 0 – Foundation | Superseded by EP-002…EP-006 (repository, agent and governance foundation). |
| Sprint 1 – Product Architecture | Superseded by EP-007 (Product Architecture Foundation) — Closed. The `Status: Active` recorded below is historical and no longer reflects the current state. |
| Sprint 2 – Stack and Implementation Baseline | ADR-0007 (Technology Platform Baseline) — Approved, delivered as part of EP-007. |
| Sprint 3 – Identity and Data Foundation | Not yet mapped to an epic; no corresponding EP work exists yet. |
| Sprint 4 – Work Event Engine | Corresponds to the upcoming Development Sprint 001, tasks DT-004/DT-005. |
| Sprint 5 – NFC Engine | Corresponds to the upcoming Development Sprint 001, tasks DT-001–DT-003. |
| Sprint 6 – Offline Sync Foundation | Not yet mapped to an epic. |

For the authoritative current epic and Development Task status, see `ADO/00_Core/Decision_Log.md` and `ADO/00_Core/Project_Status.md`.

## Sprint 0 – Foundation

Goal: Establish repository, ADO and architecture governance.

Expected outcomes:

- GitHub repository connected
- Project ADO initialized
- ADR process initialized
- Initial risk register created
- Monorepo strategy documented

Status: Completed

## Sprint 1 – Product Architecture

Goal: Define the initial product and technical architecture before implementation.

Expected outcomes:

- Product principles
- Domain model draft
- NFC assignment model
- NFC capability model
- Role model
- Product scope v1
- Offline-first decision
- Event-driven business engine decision
- Domain-first architecture decision
- Stack decision proposal
- Testing strategy draft

Status: Active

## Sprint 2 – Stack and Implementation Baseline

Goal: Decide and initialize the implementation stack after architecture approval.

Expected outcomes:

- ADR-0007 stack decision
- Mobile app skeleton
- Package layout
- Domain package baseline
- Lint/test/build scripts
- Local development instructions

## Sprint 3 – Identity and Data Foundation

Goal: Establish authentication, data model and security foundations.

Expected outcomes:

- Auth model
- Organization/user/role model
- Persistence adapter strategy
- Security rules strategy
- Local/dev/prod environment separation

## Sprint 4 – Work Event Engine

Goal: Implement the core event-driven time tracking engine.

Expected outcomes:

- Work event model
- Business engine start/stop decision logic
- Time entry state model
- Unit tests for core rules
- Manual trigger fallback

## Sprint 5 – NFC Engine

Goal: Implement NFC scanning as isolated trigger capability.

Expected outcomes:

- NFC capability abstraction
- NFC assignment workflow
- Android real-device validation plan
- Failure handling model
- Scan event integration with work event engine

## Sprint 6 – Offline Sync Foundation

Goal: Make core work event capture offline-first.

Expected outcomes:

- Local event queue
- Sync state model
- Conflict handling draft
- Offline/online test scenarios
