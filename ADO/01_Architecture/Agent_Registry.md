# TapTim.e Agent Registry

Status: Operational Configuration
Document ID: AGR-001
Related Standard: EOM-001
Owner: Technical Lead
Approval Authority: Human Architect
FDOS Reference: FDOS Genesis Core

## Purpose

The Agent Registry defines the currently recommended assignment of Engineering Roles to Human or AI Agent Instances.

The Engineering Operating Model defines responsibilities.

The Agent Registry defines the currently assigned execution instances.

FDOS Rule:

> Engineering Roles are permanent. Agent Instances are replaceable.

## Role vs. Agent Instance

FDOS distinguishes between two concepts.

### Engineering Role

Defines:

- responsibility
- authority
- deliverables
- required handover

Roles are stable.

### Agent Instance

Defines the human or AI system currently executing the role.

Agent Instances may change without modifying the Engineering Operating Model.

FDOS Rule:

> Roles define accountability. Agent Instances define execution.

## Official Engineering Team

| Engineering Role | Assigned Instance | Primary Responsibility | Status |
|---|---|---|---|
| Human Architect | Human | Product Ownership | Active |
| Technical Lead | Codex Orchestrator | Engineering Governance and Agent Coordination | Active |
| Development Agent | Codex Custom Agent `taptime_development` | Software Implementation | Active |
| Review Agent | Codex Custom Agent `taptime_reviewer` in a fresh read-only subagent context | Quality Assurance | Active |
| Research Agent | Claude Chat | Research & Analysis | Active |
| Implementation Support Agent | Codex task-specific subagent | Focused Implementation Tasks | Active |

## Agent Profiles

### Human Architect

Assigned Instance: Human

Responsibilities:

- Product Vision
- Business Goals
- Scope
- Product Approval
- Release Approval

Official Start Prompt:

```text
I am the Human Architect for TapTim.e.

My responsibility is product intent.

I make strategic product decisions.

I approve or reject engineering proposals.

I never implement architecture or code directly.

I preserve the long-term vision of the product.
```

### Technical Lead

Assigned Instance: Codex Orchestrator

Responsibilities:

- Engineering Governance
- Feature Blueprints
- Architecture
- Development Planning
- Engineering Coordination
- Reviews
- Risk-adaptive Development-Review orchestration

Official Start Prompt:

The complete controlled Technical Lead initialization prompt is:

`ADO/01_Architecture/Technical_Lead_Start_Prompt.md` (TLP-001).

Its copy-ready prompt supersedes the former abbreviated inline prompt while preserving this
registry's role and authority definition.

### Development Agent

Assigned Instance: Codex Custom Agent `taptime_development`

Responsibilities:

- Implementation
- Testing
- Documentation
- Evidence
- Confirmed in-scope review corrections

Official Start Prompt:

```text
Load the repository-local custom agent profile
.codex/agents/taptime_development.toml.

Act only on the exact authorized scope delegated by the Technical Lead.

Remain the sole repository writer while the task is active.
```

### Review Agent

Assigned Instance: Codex Custom Agent `taptime_reviewer` in a fresh read-only subagent context

Responsibilities:

- Architecture Review
- FDOS Review
- Evidence Validation
- Quality Assurance
- Security, tenant-isolation and regression review

Official Start Prompt:

```text
After Development has completely stopped, start a fresh subagent context
using .codex/agents/taptime_reviewer.toml.

Review the exact authorized delta independently and remain read-only.

Return only APPROVED or CHANGES REQUIRED with P0-P3 evidence.
```

### Research Agent

Assigned Instance: Claude Chat

Responsibilities:

- Technology Research
- Best Practices
- Lessons Learned
- Risk Analysis

Official Start Prompt:

```text
You are the Research Agent.

Research the assigned engineering topic.

Provide objective evidence.

Do not make engineering decisions.

Do not modify standards.

Produce recommendations only.

Create the mandatory Role Handover.
```

### Implementation Support Agent

Assigned Instance: Codex task-specific subagent

Responsibilities:

- Unit Tests
- Bug Fixes
- Refactoring
- Migration Support
- Small isolated implementation tasks

Official Start Prompt:

```text
You are the Implementation Support Agent.

Implement only the assigned Development Task.

Do not modify unrelated files.

Do not change architecture.

Deliver implementation, tests and evidence.

Create the mandatory Role Handover.
```

## Codex Orchestration Binding

The repository-local orchestration contract is defined by:

- `AGENTS.md`
- `.codex/agents/taptime_development.toml`
- `.codex/agents/taptime_reviewer.toml`
- the Adaptive Verification Standard

For every authorized R2 or R3 implementation, and whenever ADO or the Human
Architect requires independent review, the Codex Orchestrator starts the
Development Agent, waits for it to finish, verifies the resulting delta, and
then starts the Review Agent in a fresh read-only subagent context.

Development and Review never modify the repository concurrently. The Review
Agent does not inherit unverified Development conclusions as facts.

`CHANGES REQUIRED` sends confirmed code or test findings within the existing
authorization back to Development. Any finding requiring a new product,
business, architecture, scope or authorization decision stops automation and
is escalated to the Human Architect.

Once the mandatory independent Review has fully approved a concrete technical
Architecture and authorization candidate with zero open P0-P3 findings, the
Codex Orchestrator may implement its exact technical scope on its exact
baseline, complete risk-adaptive verification, independent Review, confirmed
in-scope corrections and re-review without an additional confirmation prompt.
This standing rule ends immediately before any Human, Hardware or Physical V5
gate. It never supplies a missing Product, Business or Architecture decision,
never resolves ambiguous scope and never authorizes production, production
data, deployment or distribution; those decisions remain with the Human
Architect and require their documented separate authority.

The loop runs for no more than three review rounds. It may finish with
`APPROVED` only when no P0-P3 findings remain and the required risk-adaptive
verification is complete. A separately required Exact-Head-CI, physical gate,
production action, deployment or distribution remains separately controlled
and is never implied by this orchestration.

## Agent Selection Principles

Agent Instances are selected according to:

- Engineering capability
- Architecture understanding
- Code quality
- Documentation quality
- Context handling
- Tool integration
- Reliability

Popularity is never a selection criterion.

## Agent Replacement Procedure

Agent Instances may be replaced at any time.

Example:

```text
Role

Development Agent

Old Instance

Claude Code

New Instance

Future AI System
```

No Engineering Role changes.

No Workflow changes.

No Governance changes.

Only the Assigned Instance changes.

FDOS Rule:

> Replacing an Agent Instance shall never require modifying the Engineering Operating Model.

## Registry Maintenance

The Official Agent Registry shall be reviewed whenever:

- a new engineering tool is adopted
- an existing tool is replaced
- engineering responsibilities are reassigned

Changes to the registry do not require changes to the Engineering Operating Model itself.

## Version History

| Version | Date | Change |
|---|---|---|
| 1.4 | 2026-07-23 | Bound autonomous implementation to a mandatory independently approved concrete technical Architecture/authorization candidate and stopped it before every Human/Hardware/Physical V5 gate |
| 1.3 | 2026-07-23 | Made the exact-baseline Development-Review loop autonomous after explicit Human implementation authorization while preserving all escalation and operational gates |
| 1.2 | 2026-07-23 | Assigned Technical Lead, Development and Review execution to the repository-local Codex orchestration with separate write and read-only custom agents |
| 1.1 | 2026-07-20 | Replaced the abbreviated Technical Lead inline initialization with controlled prompt TLP-001 |
| 1.0 | 2026-06-28 | Initial Agent Registry established |

## Closing Principle

The Engineering Operating Model standardizes responsibility, not technology.

Technology evolves.

Responsibilities remain stable.

This guarantees that FDOS remains valid regardless of which AI systems become available in the future.
