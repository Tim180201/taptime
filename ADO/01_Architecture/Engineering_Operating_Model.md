# TapTim.e Engineering Operating Model

Status: Review Ready  
Document ID: EOM-001  
Epic: EP-005  
Owner: Technical Lead  
Approval Authority: Human Architect  
FDOS Reference: FDOS Genesis Core

## Purpose

The Engineering Operating Model defines how humans and AI agents collaborate within the TapTim.e engineering process.

It defines roles, responsibilities, workflow, Engineering Packages, communication, governance and operational templates.

This document applies FDOS to TapTim.e operations. It does not redefine FDOS Core.

FDOS Rule:

> Every engineering role produces a complete handover to the next responsible role.

## Engineering Principle

No role works in isolation.

Every role receives artifacts, performs a defined responsibility and produces the input for the next role.

The result of one role becomes the working foundation of the next role.

## Roles

### Human Architect

Owns product intent and strategic product decisions.

Responsibilities:

- Product Vision
- Business Goals
- Prioritization
- Scope
- Product Approval
- Release Approval

The Human Architect may make product decisions, prioritize features, change the Product Vision and approve releases.

The Human Architect shall not implement architecture, change Business Rules during implementation or directly edit Development Tasks outside the approved process.

### Technical Lead

Owns engineering governance and translates approved product intent into technical execution.

Responsibilities:

- Feature Blueprints
- Technical Architecture Specifications
- Development Tasks
- Engineering Governance
- FDOS Alignment
- Quality Control

The Technical Lead may propose architecture, apply standards, prepare development work, coordinate reviews and define engineering handovers.

The Technical Lead shall not change product strategy, extend scope without approval or overrule the Human Architect.

### Development Agent

Owns technical implementation.

Responsibilities:

- Code
- Tests
- Refactoring within approved task scope
- Implementation documentation

The Development Agent may implement approved Development Tasks, write tests and perform technical optimization within scope.

The Development Agent shall not change architecture, reinterpret Business Rules, extend scope or make product decisions.

### Review Agent

Owns objective quality verification.

Responsibilities:

- Code Review
- Test Validation
- Architecture Compliance Review
- Evidence Review

The Review Agent may approve, reject or request changes based on evidence and standards.

The Review Agent shall not extend features, change implementation directly or make product decisions.

### Research Agent

Owns learning and continuous improvement.

Responsibilities:

- Lessons Learned
- Technology Evaluation
- Best Practices
- Improvement Proposals

Research provides recommendations only and never directly changes standards, architecture or implementation artifacts.

## Standard Engineering Workflow

Every feature follows the approved role sequence:

```text
Human Architect
  -> Technical Lead
  -> Human Architect
  -> Technical Lead
  -> Development Agent
  -> Review Agent
  -> Technical Lead
  -> Human Architect
```

FDOS Rule:

> Engineering work shall always follow the approved role sequence.

## Workflow Phases

### Product Definition

Responsible Role: Human Architect

Output:

- Product goal
- Business value
- Priority
- Approval

### Engineering Planning

Responsible Role: Technical Lead

Output:

- Feature Blueprint
- Technical Architecture Specification
- Development Tasks
- Risks
- Acceptance Criteria

### Development

Responsible Role: Development Agent

Output:

- Implementation
- Tests
- Documentation
- Evidence

### Review

Responsible Role: Review Agent

Output:

- Quality findings
- Test validation
- Architecture compliance result
- Evidence review

### Technical Acceptance

Responsible Role: Technical Lead

Output:

- Technical Approval
- Risk status
- Release readiness assessment

### Product Acceptance

Responsible Role: Human Architect

Output:

- Product Approval
- Release decision

## Engineering Packages

An Engineering Package is the standard handover unit between two engineering roles.

FDOS Rule:

> Every role handover shall be performed through exactly one Engineering Package.

Every Engineering Package contains:

- Package ID
- Current Role
- Next Responsible Role
- Objective
- Input Artifacts
- Output Artifacts
- Responsibilities
- Constraints
- Known Risks
- Open Questions
- Expected Deliverables
- Approval Status
- Prompt for Next Role

Engineering Packages create complete traceability between roles, artifacts, prompts and evidence.

FDOS Rule:

> Every Engineering Package shall be fully traceable across the engineering lifecycle.

## Agent Communication Protocol

Every engineering interaction follows the standard communication protocol.

FDOS Rule:

> Every engineering interaction shall follow the standard communication protocol.

Communication must be:

- clear
- complete
- traceable
- role-specific
- reproducible

### Mandatory Status Values

- CREATED
- READY
- IN PROGRESS
- BLOCKED
- WAITING
- REVIEW
- APPROVED
- REJECTED
- COMPLETED
- ARCHIVED

### Start Protocol

Before work begins, a role confirms:

```text
STATUS: READY
Input Package verified.
Responsibilities understood.
Constraints accepted.
Work started.
```

### Completion Protocol

After completion, a role confirms:

```text
STATUS: COMPLETED
Deliverables created.
Evidence attached.
Role Handover completed.
```

### Escalation Protocol

Missing information is escalated instead of assumed.

FDOS Rule:

> Missing information shall always be escalated instead of assumed.

Escalations include:

- Current Role
- Blocking Issue
- Missing Artifact
- Responsible Role
- Required Decision
- Impact
- Recommendation

## Governance and Decision Authority

Every engineering decision has exactly one accountable role.

FDOS Rule:

> Every engineering decision shall have exactly one accountable role.

### Human Architect Authority

Owns:

- Product Vision
- Business Goals
- Scope
- Feature Prioritization
- Product Approval
- Release Approval

FDOS Rule:

> Product intent remains under the authority of the Human Architect.

### Technical Lead Authority

Owns:

- Technical Architecture
- Engineering Standards within the project
- Development Task Structure
- Technical Risks
- Technical Approval

### Development Agent Authority

Owns:

- Implementation details within approved scope
- Tests
- Local code optimization

### Review Agent Authority

Owns:

- Quality verification
- Architecture compliance
- Evidence validation

### Research Agent Authority

Provides recommendations only.

## Approval Gates

Every feature passes through defined approval gates:

1. Product Approval
2. Architecture Approval
3. Development Ready
4. Technical Approval
5. Product Acceptance
6. Release Approval

FDOS Rule:

> Engineering decisions shall remain fully traceable throughout the project lifecycle.

## Standard Role Handover

Every role ends its work with a mandatory Role Handover.

Required fields:

```text
ROLE HANDOVER

Current Role
Status
Completed Work
Created Artifacts
Evidence
Known Risks
Open Questions
Next Responsible Role
Reason for Handover
Prompt for Next Role
```

FDOS Rule:

> No engineering role is complete without a validated Role Handover.

## Prompt Standard

The prompt for the next role always contains:

- Role
- Objective
- Input Artifacts
- Responsibilities
- Constraints
- Expected Deliverables
- Evidence Requirements
- Completion Criteria
- Next Role after Completion

## Operational Templates

All engineering activities use the official operational templates.

FDOS Rule:

> Every engineering activity shall use the official operational templates.

Templates include:

- Engineering Package Template
- Role Handover Template
- Prompt Template
- Status Message Template
- Review Template
- Escalation Template

## Engineering Package Template

```text
ENGINEERING PACKAGE

Package ID
Current Role
Next Responsible Role
Objective
Input Artifacts
Output Artifacts
Responsibilities
Constraints
Known Risks
Open Questions
Expected Deliverables
Approval Status
Prompt for Next Role
```

## Role Handover Template

```text
ROLE HANDOVER

Current Role
Status
Completed Work
Created Artifacts
Evidence
Known Risks
Open Questions
Next Responsible Role
Reason for Handover
Prompt for Next Role
```

## Operational Checklist

Before a role completes work, verify:

- responsibility fulfilled
- artifacts created
- documentation updated
- evidence attached
- risks documented
- handover created
- next role named
- prompt created

## Closing Principles

Clear accountability before speed.

Complete handover before role transition.

Traceability before assumptions.

Evidence before completion.

Collaboration before context loss.

## Engineering Execution Standard

All future TapTim.e features and engineering tasks shall follow:

- Role Model
- Engineering Workflow
- Engineering Packages
- Agent Communication Protocol
- Governance and Decision Authority
- Operational Templates

FDOS Rule:

> All implementation work within TapTim.e shall follow the Engineering Operating Model.

## Operating Baseline

This Engineering Operating Model establishes the operational baseline for all future human and AI-agent collaboration within TapTim.e.
