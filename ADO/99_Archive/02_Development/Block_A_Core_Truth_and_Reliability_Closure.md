# Core Roadmap v2 – Block A Closure

Status: Completed
Date: 2026-07-13
Owner: Human Architect + Technical Lead

## Scope and outcome

Block A – Core Truth and Reliability is complete. An NFC scan remains a trigger; the Business Engine decides the outcome from explicit Organization, User, AssignmentTarget, WorkEvent time, duplicate history and active TimeEntry state.

Implemented outcomes:

- no active TimeEntry starts a new entry;
- the same User and target stops the active entry;
- a scan for another target is rejected while the User has an active entry;
- scans by different Users remain independent;
- a repeated scan for the same User and target inside five seconds is recorded but ignored for TimeEntry mutation;
- exactly five seconds is outside the duplicate window;
- inconsistent or non-monotonic state escalates without mutating time;
- start and stop timestamps come from their WorkEvents and both WorkEvent identifiers remain traceable;
- CI runs dependency installation, typecheck, Core/Mobile tests and Core build on `main` pushes and pull requests;
- Core tests are included in TypeScript checking.

## Evidence

| Capability | Commit |
|---|---|
| Repository instructions and Technical Lead publish authority | `764aa2c`, `a154253` |
| Tests-inclusive TypeScript check | `2493f17` |
| GitHub Actions CI baseline | `b2004ea` |
| TimeEntry lifecycle domain states | `f5a0027` |
| User-aware TimeEntry repository update path | `d8d3833` |
| Engine-driven lifecycle and integration | `72eb03d` |

Final verification:

- `npm run typecheck`: passed;
- `npm test`: 262 Core tests and 10 Mobile tests passed;
- `npm run build --workspace=@taptime/core`: passed;
- `git diff --check`: passed before publication;
- GitHub Actions run `29216961546`: passed.

## Review disposition

Technical Lead decision: **APPROVED**. No unresolved Block A defect is carried forward. The original external CTO findings K3 (missing stop lifecycle), K8 (missing CI) and K9 (tests excluded from typecheck) are resolved.

## Known limitations outside Block A

TapTim.e remains a Core Prototype. No real backend, tenant enforcement, real authentication, real synchronization, runtime-reachable Organization setup, physical NFC validation, export, installable pilot distribution or commercial/legal package is claimed by this closure.

## Next block

Block B – Backend and Async Foundation. The next gate is an explicit backend technology, responsibility, tenant-isolation, authorization and async-migration decision package. Because these choices affect product-wide security and data boundaries, an independent Claude architecture/security review is recommended before implementation approval.
