# TapTim.e Development Task Profile

Status: Review Ready  
Document ID: DTP-001  
Epic: EP-004  
Owner: Technical Lead  
Approval Authority: Human Architect  
FDOS Reference: FDOS Genesis Core

## Purpose

The Development Task Profile defines the project standard for describing engineering work within TapTim.e.

A Development Task never describes product vision, user goals or architecture. It describes exactly one bounded engineering implementation unit.

Development Tasks transform approved architecture into controlled, reviewable and verifiable engineering work.

FDOS Rule:

> Development Tasks implement approved architecture without redefining product intent or architectural decisions.

## Relationship to Previous Standards

Development Tasks build upon approved project standards:

```text
Product Vision
  -> Feature Blueprint
  -> Technical Architecture Specification
  -> Development Task
```

A Development Task may not redefine product intent, Business Rules, architectural decisions or scope.

## Engineering Responsibility

Every Development Task has exactly one primary engineering responsibility.

A task describes one change, one objective and one implementation responsibility.

FDOS Rule:

> Every Development Task has exactly one primary engineering responsibility.

## Scope

Development Tasks describe engineering work only.

Examples include:

- implement components
- extend existing functionality
- add tests
- execute migrations
- update documentation

Development Tasks do not redefine product strategy, UX concepts or architecture.

## Development Lifecycle

Every Development Task follows this lifecycle:

```text
Planned
  -> Ready
  -> In Progress
  -> Review
  -> Testing
  -> Evidence
  -> Completed
```

## Completion Rule

A Development Task is complete only when:

- implementation is finished
- acceptance criteria are fulfilled
- code review is completed
- tests passed
- documentation is updated
- objective engineering evidence is available

FDOS Rule:

> Implementation alone never completes a Development Task.

## Task Information

Every Development Task contains standard metadata:

- Task ID
- Title
- Status
- Epic
- Related Feature
- Priority
- Owner
- Created Date
- Last Updated

FDOS Rule:

> Every Development Task shall have one unique Task ID.

## References

Every Development Task references the approved artifacts from which it originates:

- Product Vision
- Feature Blueprint
- Technical Architecture Specification
- relevant ADRs
- dependent tasks, if any

FDOS Rule:

> Every Development Task shall reference the approved engineering artifacts from which it originates.

## Objective

Every Development Task defines exactly one engineering objective.

Good objectives are specific, implementable and verifiable.

Examples:

- Implement NFC Scan Service
- Extend Work Event Repository
- Add Offline Synchronization Tests

FDOS Rule:

> Every Development Task defines exactly one engineering objective.

## Task Scope

Every Development Task documents:

### In Scope

Work that belongs to the task.

### Out of Scope

Work that explicitly does not belong to the task.

This prevents scope creep during implementation.

## Acceptance Criteria

Every Development Task defines objective acceptance criteria.

Examples:

- component implemented
- architecture followed
- tests passed
- code review completed
- documentation updated

FDOS Rule:

> Every Development Task defines objective acceptance criteria.

## Dependencies

Every Development Task documents:

- technical dependencies
- business dependencies
- blocking tasks
- follow-up tasks

Dependencies create a traceable engineering sequence.

## Risks

Every Development Task evaluates engineering risks, including:

- architecture change
- migration
- performance
- synchronization
- breaking change
- external API dependency

If no significant risk exists, the task documents that no significant engineering risks were identified.

## Engineering Effort

Engineering effort is described using a simple scale:

- Small
- Medium
- Large
- Extensive

The scale supports engineering planning without replacing project-specific sprint planning.

## Development Task Types

Every Development Task has exactly one primary Task Type.

FDOS Rule:

> Every Development Task shall have exactly one primary Task Type.

### Feature Task

Implements new approved functionality.

### Enhancement Task

Improves existing functionality without creating a new feature.

### Bug Fix Task

Corrects a defect and documents cause, solution, impact and regression verification.

### Refactoring Task

Improves internal implementation quality without changing approved product behavior.

FDOS Rule:

> Refactoring changes implementation quality without changing approved product behavior.

### Infrastructure Task

Implements technical platform work such as CI, deployment, monitoring, logging, database setup or security infrastructure.

### Testing Task

Creates or improves verification coverage such as unit tests, integration tests, synchronization tests, offline tests, performance tests or regression tests.

### Documentation Task

Preserves engineering knowledge through architecture documentation, ADRs, API documentation, migration notes or developer documentation.

### Research Spike

Answers open engineering questions before implementation begins. A spike produces learning, not product functionality.

### Migration Task

Changes existing data, APIs, events, versions or data models. Migration Tasks carry elevated risk and must be documented explicitly.

FDOS Rule:

> Task Types shall never be combined to hide multiple engineering responsibilities.

## Development Workflow

Every Development Task originates from an approved engineering chain:

```text
Product Vision
  -> Feature Blueprint
  -> Technical Architecture Specification
  -> Development Task
  -> Implementation
  -> Testing
  -> Review
  -> Evidence
  -> Completed
```

FDOS Rule:

> Development Tasks shall only originate from approved engineering artifacts.

## Task Creation

A Development Task is created after the relevant technical architecture is defined and approved.

It documents origin, objective, responsibility and expected result.

The task itself does not create architecture decisions.

## Implementation Phase

During implementation, development remains within the defined task scope.

Not allowed:

- spontaneous architecture changes
- new product decisions
- unauthorized scope expansion

New findings are returned to the Feature Blueprint or Technical Architecture Specification process.

FDOS Rule:

> Implementation shall never redefine approved architecture.

## Review Phase

The engineering review verifies:

- architecture compliance
- code quality
- acceptance criteria
- documentation completeness
- impact on existing components

A task without successful review is not complete.

## Testing Phase

Every task is verified according to its type, risk and impact.

The normative selection, escalation, evidence-reuse and exact-head rules are defined by
`ADO/03_Testing/Adaptive_Verification_Standard.md` (AVS-001). Every task records a Change-Impact
Record and the verification levels actually executed. Unknown impact expands verification; it is
never used to justify omission.

Possible verification includes:

- Unit Tests
- Integration Tests
- Business Engine Tests
- Event Flow Tests
- Synchronization Tests
- Offline Tests
- Regression Tests
- Manual Validation

## Evidence Generation

Every completed Development Task produces objective engineering evidence.

Examples:

- test results
- review outcomes
- build results
- migration validation
- logs
- screenshots, if relevant

FDOS Rule:

> Every completed Development Task produces objective engineering evidence.

## Definition of Done

A Development Task reaches Done only when:

- implementation completed
- acceptance criteria fulfilled
- code review passed
- tests passed
- documentation updated
- evidence generated

FDOS Rule:

> A Development Task is complete only when implementation quality has been objectively verified.

## Architecture Compliance

Every task verifies:

- layering respected
- responsibilities preserved
- no architecture violations
- interfaces documented
- Business Rules remain in the Business Engine

## Code Quality

Engineering quality requires:

- clear responsibilities
- readable code
- low coupling
- high cohesion
- consistent naming
- no unused artifacts

## Test Quality

Every task documents appropriate verification. The required test depth depends on task type, risk and impact.

## Documentation Quality

Engineering knowledge must be preserved with implementation.

Verify:

- documentation updated
- ADR updated if required
- architecture updated if required
- API documentation updated if required
- migration documentation updated if required

FDOS Rule:

> Engineering knowledge shall be preserved together with implementation.

## Risk Validation

Before completion:

- critical risks resolved
- remaining risks documented
- technical debt assessed
- impact understood

## Release Readiness

Every task assesses release impact:

- production readiness
- migration readiness
- rollback capability
- monitoring
- deployment documentation

## Official Development Task Template

Every Development Task follows this structure:

1. Task Information
2. References
3. Objective
4. Scope
5. Acceptance Criteria
6. Dependencies
7. Risks
8. Engineering Effort
9. Testing
10. Evidence
11. Completion Status

FDOS Rule:

> Every Development Task shall follow the official TapTim.e Development Task Template.

## Naming Convention

Task IDs follow a stable sequence:

```text
DT-0001
DT-0002
DT-0003
```

Titles describe engineering work clearly.

Good examples:

- Implement NFC Scan Service
- Refactor Work Event Repository
- Add Offline Synchronization Tests

Bad examples:

- Improve App
- Fix Everything
- New Stuff

## Definition of Ready

A Development Task may begin only when:

- Product Vision is referenced
- Feature Blueprint is approved
- Technical Architecture Specification is approved
- Acceptance Criteria are defined
- Risks are evaluated
- Dependencies are documented

FDOS Rule:

> No Development Task begins without an approved engineering foundation.

## Engineering Review Checklist

Before completion verify:

- scope fully implemented
- architecture followed
- Business Rules unchanged
- responsibilities correct
- tests passed
- documentation complete
- risks documented
- evidence present
- Definition of Done fulfilled

## Governance Rules

Development Tasks may never:

- change product decisions
- redefine architecture
- interpret Business Rules
- extend scope without approval

If new findings occur, they are returned to the relevant upstream artifact.

FDOS Rule:

> Development Tasks execute engineering decisions. They do not create them.

## Living Standard

The Development Task Profile evolves with TapTim.e through review, evidence and engineering learning.

The FDOS Core remains unchanged.

## Closing Principles

Development follows architecture.

Architecture follows approved product intent.

Quality precedes completion.

Evidence precedes acceptance.

Every completed Development Task contributes to the long-term engineering knowledge of TapTim.e.

## Engineering Baseline

This Development Task Profile establishes the engineering execution baseline for all future implementation work within TapTim.e.
