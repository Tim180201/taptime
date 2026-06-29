# Agent Lifecycle

Status: Draft  
Document ID: ALF-001  
Epic: EP-006  
Owner: Technical Lead  
Approval Authority: Human Architect  
Related Standards: AOS-001, ADS-001, AIR-001, EOM-001

## Purpose

The Agent Lifecycle defines the complete lifecycle of every Human and AI Agent within an FDOS-managed engineering project.

## Lifecycle

```text
New Agent
  -> Repository Access
  -> AOS-001 Onboarding
  -> ADS-001 Discovery
  -> AIR-001 Inventory Report
  -> READY FOR WORK
  -> Engineering Execution
  -> Role Handover
  -> Session Pause / Resume
  -> Completed
```

## Agent States

- NEW
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

- AOS-001 completed
- ADS-001 completed
- AIR-001 completed
- repository health assessed
- role responsibilities understood

## Session Resume

When a session is interrupted or restarted, the agent shall:

- verify repository state again
- review latest Decision Log entries
- confirm whether prior AIR-001 remains valid
- update AIR-001 if repository state changed
- continue only after readiness is confirmed

## Completion Criteria

An agent session is complete only when:

- assigned work is completed or explicitly blocked
- evidence is documented
- Role Handover is complete
- next responsible role is identified
- prompt for next role is created
