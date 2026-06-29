# EP-006 – Agent Operations Framework

Status: Draft  
Document ID: AOF-001  
Epic: EP-006  
Owner: Technical Lead  
Approval Authority: Human Architect  
Related Standards: EOM-001, AGR-001

## Purpose

The Agent Operations Framework standardizes how Human and AI Agents operate within an FDOS-managed engineering project.

It defines onboarding, repository discovery, operational readiness, context recovery, repository health verification, prompt initialization and session continuity.

## Scope

EP-006 applies to every Human and AI Agent participating in TapTim.e engineering work.

It does not redefine engineering roles, engineering governance or product strategy. Those remain defined by FDOS Genesis, EOM-001 and AGR-001.

## Objectives

Every agent shall:

- understand the project before working
- continue existing documentation instead of recreating it
- verify repository state before decisions
- maintain engineering traceability
- recover context across new chats and interrupted sessions
- produce reproducible engineering results

## Core Principles

1. Repository Before Role
2. Discovery Before Decisions
3. Continue, Never Recreate
4. Evidence Before Assumptions
5. Operational Independence

## EP-006 Standards

EP-006 introduces the following draft standards:

- AOS-001 – Agent Onboarding Standard
- ADS-001 – Agent Discovery Standard
- AIR-001 – Agent Inventory Report
- OAP-001 – Official Agent Prompt Standard
- RHS-001 – Repository Health Standard
- Agent Lifecycle
- Operational Guidelines

## Framework Flow

```text
Agent Prompt
  -> AOS-001 Onboarding
  -> ADS-001 Repository Discovery
  -> RHS-001 Repository Health Verification
  -> AIR-001 Operational Readiness Certificate
  -> READY FOR WORK
  -> Engineering Operating Model
  -> Role Handover
```

## Success Criteria

EP-006 is ready for final acceptance when:

- completely new agents can onboard themselves
- repository discovery is reproducible
- operational readiness is measurable
- prompts are versioned and lightweight
- session continuity is supported
- repository health verification is standardized
- validation evidence exists

## Current Status

EP-006 is integrated as a Draft ADO baseline for practical validation with new agents.

Final Evidence and acceptance shall be created only after validation.
