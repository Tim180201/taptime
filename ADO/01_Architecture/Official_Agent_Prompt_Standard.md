# OAP-001 – Official Agent Prompt Standard

Status: Draft  
Document ID: OAP-001  
Epic: EP-006  
Owner: Technical Lead  
Approval Authority: Human Architect  
Related Standards: EOM-001, AGR-001, AOS-001, ADS-001, AIR-001

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
- performs mandatory onboarding
- performs Repository Discovery
- completes AIR-001
- follows the Engineering Operating Model
- produces mandatory Role Handovers

## Mandatory Prompt Structure

Every Official Agent Prompt shall contain:

1. Role Initialization
2. Repository Hierarchy
3. Mandatory Onboarding
4. Engineering References
5. Completion Requirements

## Repository Hierarchy

Every official prompt shall reference:

```text
FDOS Genesis
  -> Engineering Methodology

TapTim.e
  -> Project ADO

Assigned Engineering Role
```

## Mandatory Onboarding

Every prompt shall require completion of:

- AOS-001
- ADS-001
- AIR-001

Engineering work shall not begin before Operational Readiness has been confirmed.

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
