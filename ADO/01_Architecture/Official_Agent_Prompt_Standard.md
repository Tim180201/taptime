# OAP-001 – Official Agent Prompt Standard

Status: Draft  
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

- understands its assigned role
- understands repository hierarchy
- runs ABS-001 before onboarding
- reads ADO/README.md after bootstrap
- performs mandatory onboarding
- performs Repository Discovery
- completes AIR-001
- follows the Engineering Operating Model
- produces mandatory Role Handovers

## Mandatory Prompt Structure

Every Official Agent Prompt shall contain:

1. Role Initialization
2. Repository Hierarchy
3. Mandatory Bootstrap
4. ADO Navigation Entry Point
5. Mandatory Onboarding
6. Engineering References
7. Completion Requirements

## Repository Hierarchy

Every official prompt shall reference:

```text
FDOS Genesis
  -> Engineering Methodology

TapTim.e
  -> Project ADO

Assigned Engineering Role
```

## Mandatory Bootstrap

Every prompt shall require ABS-001 before AOS-001.

If ABS-001 cannot be completed, the agent shall stop and report `STATUS: BLOCKED`.

FDOS Rule:

> Official prompts start with Agent Bootstrap, not Agent Onboarding.

## ADO Navigation Entry Point

After ABS-001 completes successfully, every prompt shall require the agent to read:

`ADO/README.md`

This is the official TapTim.e ADO navigation entry point.

AOS-001 shall begin only after `ADO/README.md` has been read.

FDOS Rule:

> Official prompts navigate through the ADO entry point instead of guessing document paths.

## Mandatory Onboarding

Every prompt shall require completion of:

- ABS-001
- AOS-001
- ADS-001
- AIR-001

Engineering work shall not begin before Operational Readiness has been confirmed.

## Standard Startup Sequence

```text
GitHub Connection Verification
  -> ABS-001
  -> ADO/README.md
  -> AOS-001
  -> ADS-001
  -> RHS-001
  -> AIR-001
  -> READY FOR WORK
```

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
- Bootstrap sequence
- ADO navigation entry point
- Onboarding sequence
- Discovery sequence
- Operational Readiness
- Completion requirements

## Expected Outcome

Official prompts become lightweight initialization artifacts.

Engineering knowledge remains inside the version-controlled ADO.

The ADO remains the single authoritative engineering knowledge base.

FDOS Rule:

> Prompts reference standards. Standards define engineering.
