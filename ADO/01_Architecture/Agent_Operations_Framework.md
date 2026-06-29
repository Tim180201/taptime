# EP-006 – Agent Operations Framework

Status: Validated  
Document ID: AOF-001  
Epic: EP-006  
Owner: Technical Lead  
Approval Authority: Human Architect  
Related Standards: EOM-001, AGR-001, AVR-001

## Purpose

The Agent Operations Framework standardizes how Human and AI Agents operate within an FDOS-managed engineering project.

It defines bootstrap, ADO navigation, onboarding, repository discovery, operational readiness, context recovery, repository health verification, prompt initialization and session continuity.

## Scope

EP-006 applies to every Human and AI Agent participating in TapTim.e engineering work.

It does not redefine engineering roles, engineering governance or product strategy. Those remain defined by FDOS Genesis, EOM-001 and AGR-001.

## Objectives

Every agent shall:

- verify technical repository access before onboarding
- verify repository inventory capability before onboarding
- use the official ADO navigation entry point before discovery
- understand the project before working
- continue existing documentation instead of recreating it
- verify repository state before decisions
- maintain engineering traceability
- recover context across new chats and interrupted sessions
- produce reproducible engineering results

## Core Principles

1. Bootstrap Before Onboarding
2. ADO Navigation Before Discovery
3. Repository Before Role
4. Discovery Before Decisions
5. Continue, Never Recreate
6. Evidence Before Assumptions
7. Operational Independence

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
  -> ABS-001 Bootstrap
  -> ADO/README.md
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

- completely new agents can verify technical repository access
- completely new agents can determine whether their environment supports full repository inventory
- completely new agents can locate mandatory documents through ADO/README.md
- completely new agents can onboard themselves
- repository discovery is reproducible
- operational readiness is measurable
- prompts are versioned and lightweight
- session continuity is supported
- repository health verification is standardized
- validation evidence exists

## Validation Status

EP-006 has been validated through a closed-loop engineering cycle.

Validation evidence is tracked in:

`ADO/00_Governance/AVR-001_Artifact_Validation_Register.md`

## Current Status

EP-006 is a Validated ADO baseline.

Promotion from `Validated` to `Accepted` requires Human Architect approval.
