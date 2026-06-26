# Technical Roadmap

Status: Draft

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
