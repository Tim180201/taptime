# OAP-001 – Official Agent Prompt Standard

Status: Validated  
Document ID: OAP-001  
Epic: EP-006  
Owner: Technical Lead  
Approval Authority: Human Architect  
Related Standards: ABS-001, EOM-001, AGR-001, AOS-001, ADS-001, AIR-001

## Purpose

The Official Agent Prompt Standard defines the mandatory structure and minimum requirements for every engineering agent prompt used within an FDOS-managed project.

Official prompts initialize engineering roles.

They do not replace engineering standards.

FDOS Rule:

> Official Agent Prompts initialize engineering agents. They shall never replace authoritative engineering documentation.

## Scope

OAP-001 applies to every engineering role defined by EOM-001 and AGR-001.

It applies equally to Human and AI Agents.

## Relationship to Existing Standards

OAP-001 does not define engineering roles, responsibilities, authorities or deliverables.

These are already defined by EOM-001 and AGR-001.

OAP-001 defines only how an official prompt initializes an engineering role.

## Prompt Objectives

Every Official Agent Prompt shall ensure that an agent:

- understands its assigned role,
- understands repository hierarchy,
- verifies the GitHub connector,
- performs initial Repository Discovery before ABS-001,
- locates the official ADO navigation entry point using repository evidence,
- reads ADO/README.md before ABS-001,
- runs ABS-001 before onboarding,
- performs mandatory onboarding,
- performs ADS-001 Repository Discovery,
- completes AIR-001,
- follows the Engineering Operating Model,
- produces mandatory Role Handovers.

## Mandatory Prompt Structure

Every Official Agent Prompt shall contain:

1. Role Initialization
2. Repository Hierarchy
3. GitHub Connector Verification
4. Initial Repository Discovery
5. ADO Navigation Entry Point
6. Mandatory Bootstrap
7. Mandatory Onboarding
8. Engineering References
9. Completion Requirements

## Repository Hierarchy

Every official prompt shall reference:

```text
FDOS Genesis
  -> Engineering Methodology

TapTim.e
  -> Project ADO

Assigned Engineering Role
```

## GitHub Connector Verification

Every prompt shall require the agent to verify that the integrated GitHub connector can access the required repositories before using repository content.

If connector access cannot be verified, the agent shall stop and report `STATUS: BLOCKED`.

## Initial Repository Discovery

Every prompt shall require initial Repository Discovery before ABS-001.

The purpose of initial Repository Discovery is to locate the official ADO navigation entry point using repository evidence.

FDOS Rule:

> Agents shall perform Repository Discovery and locate the official ADO navigation entry point before executing the bootstrap sequence.

## ADO Navigation Entry Point

Before ABS-001 begins, every prompt shall require the agent to locate and read:

`ADO/README.md`

This is the official TapTim.e ADO navigation entry point.

The agent shall not assume this path without repository evidence.

FDOS Rule:

> Official prompts navigate through the ADO entry point instead of guessing document paths.

## Mandatory Bootstrap

Every prompt shall require ABS-001 after GitHub Connector Verification, initial Repository Discovery, ADO navigation location and `ADO/README.md` reading.

If ABS-001 cannot be completed, the agent shall stop and report `STATUS: BLOCKED`.

FDOS Rule:

> Official prompts start bootstrap only after the ADO navigation entry point has been located through repository evidence.

## Mandatory Onboarding

Every prompt shall require completion of:

- ABS-001,
- AOS-001,
- ADS-001,
- RHS-001,
- AIR-001.

Engineering work shall not begin before Operational Readiness has been confirmed.

## Standard Startup Sequence

```text
GitHub Connector Verification
  -> Repository Discovery
  -> Locate the official ADO Navigation Entry Point
  -> Read ADO/README.md
  -> ABS-001
  -> AOS-001
  -> ADS-001
  -> RHS-001
  -> AIR-001
  -> READY FOR WORK
  -> EOM-001
  -> AGR-001
```

## Review Agent Prompt Requirement

Official Review Agent prompts shall define explicit review preconditions.

A Review Agent may only review a concrete review target, such as:

- Pull Request
- Branch
- Commit
- Implementation Package
- Engineering Package
- Feature Blueprint
- Development Task
- explicit Technical Lead review scope

If no concrete review target is supplied, the Review Agent shall not perform a repository-wide review.

If no concrete review target is supplied, the Review Agent shall produce a Review Package with the decision:

```text
NOT REVIEWABLE
```

Reason:

```text
No review target was supplied.
```

If a concrete review target exists but the available review evidence is insufficient to perform an objective evidence-based review, the Review Agent shall produce a Review Package with the decision:

```text
NOT REVIEWABLE
```

Reason:

```text
Review evidence is incomplete.
```

Examples of insufficient review evidence include:

- commit cannot be inspected
- changed files cannot be verified
- engineering package is missing
- implementation evidence is incomplete
- validation evidence is unavailable

`NOT REVIEWABLE` means:

- Agent initialization completed successfully.
- The Review Agent reached READY FOR WORK.
- No reviewable implementation artifact, review scope or review evidence was supplied.
- No implementation approval or rejection has occurred.

FDOS Rule:

> Missing review targets or incomplete review evidence are not failed implementations. They are not reviewable.

FDOS Rule:

> A Review Agent shall never infer implementation correctness from incomplete evidence.

## Prompt Versioning

Official prompts are controlled engineering artifacts.

Every prompt shall include:

- Version
- Owner
- Approval Authority
- Related Standards
- Revision History

## Prompt Validation

Every prompt shall be validated before operational use.

Validation includes:

- Repository hierarchy
- Standard references
- GitHub connector verification
- Initial Repository Discovery
- ADO navigation entry point location
- ADO/README.md reading
- Bootstrap sequence
- Onboarding sequence
- Discovery sequence
- Operational Readiness
- Completion requirements
- role-specific preconditions where applicable

## Expected Outcome

Official prompts become lightweight initialization artifacts.

Engineering knowledge remains inside the version-controlled ADO.

The ADO remains the single authoritative engineering knowledge base.

FDOS Rule:

> Prompts reference standards. Standards define engineering.
