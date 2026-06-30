# EP-006 – Agent Operations Framework

Status: Validated  
Document ID: AOF-001  
Epic: EP-006  
Owner: Technical Lead  
Approval Authority: Human Architect  
Related Standards: EOM-001, AGR-001, AVR-001

## Purpose

The Agent Operations Framework standardizes how Human and AI Agents operate within an FDOS-managed engineering project.

It defines GitHub connector verification, initial repository discovery, ADO navigation, bootstrap, onboarding, repository discovery, operational readiness, context recovery, repository health verification, prompt initialization and session continuity.

## Scope

EP-006 applies to every Human and AI Agent participating in TapTim.e engineering work.

It does not redefine engineering roles, engineering governance or product strategy. Those remain defined by FDOS Genesis, EOM-001 and AGR-001.

## Objectives

Every agent shall:

- verify technical repository access before onboarding,
- locate the official ADO navigation entry point from repository evidence before bootstrap,
- verify repository inventory capability during bootstrap,
- use the official ADO navigation entry point before onboarding,
- understand the project before working,
- continue existing documentation instead of recreating it,
- verify repository state before decisions,
- maintain engineering traceability,
- recover context across new chats and interrupted sessions,
- produce reproducible engineering results.

## Core Principles

1. Repository Before Assumptions
2. Repository Discovery Before Bootstrap
3. ADO Navigation Before Bootstrap
4. Bootstrap Before Onboarding
5. Repository Before Role
6. Discovery Before Decisions
7. Continue, Never Recreate
8. Evidence Before Assumptions
9. Operational Independence

FDOS Rule:

> Agents shall perform Repository Discovery and locate the official ADO navigation entry point before executing the bootstrap sequence.

## Discovery Compatibility Rule

EP-006 distinguishes between two discovery moments:

```text
Initial Repository Discovery
  -> locate the official ADO navigation entry point before ABS-001

ADS-001 Repository Discovery
  -> perform full repository and artifact discovery after AOS-001
```

Initial Repository Discovery prevents agents from assuming that `ADO/README.md` is already known.

ADS-001 remains the authoritative full Repository Discovery standard.

## EP-006 Standards

EP-006 introduces the following draft standards and navigation artifacts:

- ADO/README.md – ADO Navigation Entry Point
- ABS-001 – Agent Bootstrap Standard
- AOS-001 – Agent Onboarding Standard
- ADS-001 – Agent Discovery Standard
- AIR-001 – Agent Inventory Report
- OAP-001 – Official Agent Prompt Standard
- RHS-001 – Repository Health Standard
- ALF-001 – Agent Lifecycle
- AOG-001 – Agent Operational Guidelines

## Framework Flow

```text
Agent Prompt
  -> GitHub Connector Verification
  -> Repository Discovery
  -> Locate the official ADO Navigation Entry Point
  -> Read ADO/README.md
  -> ABS-001 Bootstrap
  -> AOS-001 Onboarding
  -> ADS-001 Repository Discovery
  -> RHS-001 Repository Health Verification
  -> AIR-001 Operational Readiness Certificate
  -> READY FOR WORK
  -> Engineering Operating Model
  -> Agent Registry
  -> Role Handover
```

## Success Criteria

EP-006 is ready for final acceptance when:

- completely new agents can verify technical repository access,
- completely new agents can locate the official ADO navigation entry point using repository evidence before bootstrap,
- completely new agents can determine whether their environment supports full repository inventory,
- completely new agents can locate mandatory documents through ADO/README.md,
- completely new agents can onboard themselves,
- repository discovery is reproducible,
- operational readiness is measurable,
- prompts are versioned and lightweight,
- session continuity is supported,
- repository health verification is standardized,
- validation evidence exists.

## Validation Status

EP-006 has been validated through a closed-loop engineering cycle.

This follow-up change refines the startup sequence by moving initial Repository Discovery before ABS-001. The change requires Review Agent verification before the updated sequence is treated as validated.

Validation evidence is tracked in:

`ADO/00_Governance/AVR-001_Artifact_Validation_Register.md`

## Current Status

EP-006 is a Validated ADO baseline with a startup-sequence follow-up under review.

Promotion from `Validated` to `Accepted` requires Human Architect approval.
