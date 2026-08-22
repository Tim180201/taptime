# Agent Lifecycle

Status: Draft  
Document ID: ALF-001  
Epic: EP-006  
Owner: Technical Lead  
Approval Authority: Human Architect  
Related Standards: AOS-001, ADS-001, AIR-001, EOM-001

## Purpose

The Agent Lifecycle defines the complete lifecycle of every Human and AI Agent within an FDOS-managed engineering project.

ALF-001 describes lifecycle states and transitions. It does not define the normative startup sequence.

The mandatory startup sequence is defined exclusively in:

`ADO/README.md`

FDOS Rule:

> The ADO navigation entry point is the normative source for agent startup order.

## Lifecycle State Model (Informative)

The following model describes the agent lifecycle from initialization to completion.

It includes startup-related states, engineering execution and session completion. It is not intended to redefine the official startup sequence.

```text
New Agent
  -> GitHub Connector Verification
  -> Initial Repository Discovery
  -> Locate ADO Navigation Entry Point
  -> Read ADO/README.md
  -> ABS-001 Bootstrap
  -> AOS-001 Onboarding
  -> ADS-001 Discovery
  -> RHS-001 Repository Health Verification
  -> AIR-001 Inventory Report
  -> READY FOR WORK
  -> Engineering Execution
  -> Role Handover
  -> Session Pause / Resume
  -> Completed
```

## Agent States

- NEW
- CONNECTOR_VERIFICATION
- INITIAL_DISCOVERY
- BOOTSTRAP
- DISCOVERY
- READY FOR WORK
- IN PROGRESS
- BLOCKED
- WAITING
- REVIEW
- HANDOVER
- COMPLETED
- ARCHIVED

FDOS Rule:

> An agent may only transition between lifecycle states when the mandatory deliverables of the current state have been completed.

## READY FOR WORK Gate

An agent may enter READY FOR WORK only after:

- GitHub Connector Verification completed,
- initial Repository Discovery completed,
- official ADO navigation entry point located,
- `ADO/README.md` read,
- ABS-001 completed,
- AOS-001 completed,
- ADS-001 completed,
- RHS-001 repository health assessed,
- AIR-001 completed,
- role responsibilities understood.

## Session Resume

When a session is interrupted or restarted, the agent shall:

- verify repository state again,
- confirm the official ADO navigation entry point from repository evidence,
- review latest Decision Log entries,
- confirm whether prior AIR-001 remains valid,
- update AIR-001 if repository state changed,
- continue only after readiness is confirmed.

## Completion Criteria

An agent session is complete only when:

- assigned work is completed or explicitly blocked,
- evidence is documented,
- Role Handover is complete,
- next responsible role is identified,
- prompt for next role is created.
