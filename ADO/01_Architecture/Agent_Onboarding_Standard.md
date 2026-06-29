# AOS-001 – Agent Onboarding Standard

Status: Draft  
Document ID: AOS-001  
Epic: EP-006  
Owner: Technical Lead  
Approval Authority: Human Architect  
Related Standards: AOF-001, EOM-001, AGR-001

## Purpose

The Agent Onboarding Standard defines how every Human or AI Agent becomes operational within an FDOS-managed project.

FDOS Rule:

> No engineering work shall begin before Agent Onboarding has successfully completed.

## Scope

AOS-001 applies to all engineering roles defined by EOM-001 and AGR-001.

No engineering role is exempt.

## Onboarding Objectives

Every agent shall:

- understand the engineering methodology
- understand the project
- identify existing artifacts
- verify repository state
- verify engineering standards
- determine operational readiness

## Onboarding Phases

```text
Repository Access
  -> Repository Discovery
  -> Artifact Discovery
  -> Repository Verification
  -> Inventory Report
  -> Operational Readiness
  -> Engineering Work
```

Skipping phases is not permitted.

## Repository Access

Before engineering work begins, the agent verifies:

- repository access
- branch
- permissions
- repository availability

If access is incomplete, the agent reports `STATUS: BLOCKED`.

## Repository Discovery

The agent performs Repository Discovery according to ADS-001.

Discovery includes:

- FDOS Genesis methodology
- TapTim.e repository structure
- TapTim.e ADO
- relevant architecture, development and evidence artifacts

## Artifact Discovery

The agent identifies all existing artifacts relevant to its role.

Existing artifacts always have priority over creating new ones.

## Repository Verification

The agent verifies:

- duplicate documents
- conflicting standards
- missing references
- obsolete artifacts
- broken links
- inconsistent documentation

## Inventory Report

Every onboarding ends with an AIR-001 report.

Without AIR-001, onboarding is incomplete.

## Ready Checklist

Before engineering work begins:

- Repository accessible
- Repository Discovery completed
- Artifact Discovery completed
- Repository Verification completed
- AIR-001 completed
- Role understood
- Required standards identified
- Operational readiness confirmed

## Completion Criteria

AOS-001 is complete when onboarding is successfully completed, AIR-001 is produced and operational readiness is confirmed.
