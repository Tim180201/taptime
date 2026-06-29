# AOS-001 – Agent Onboarding Standard

Status: Draft  
Document ID: AOS-001  
Epic: EP-006  
Owner: Technical Lead  
Approval Authority: Human Architect  
Related Standards: ABS-001, AOF-001, EOM-001, AGR-001

## Purpose

The Agent Onboarding Standard defines how every Human or AI Agent becomes operational within an FDOS-managed project.

FDOS Rule:

> No engineering work shall begin before Agent Onboarding has successfully completed.

## Bootstrap Precondition

AOS-001 may only begin after ABS-001 has completed successfully.

ABS-001 verifies repository access and repository inventory capability.

If ABS-001 reports `STATUS: BLOCKED`, AOS-001 shall not begin.

FDOS Rule:

> Agent Onboarding requires a completed Agent Bootstrap.

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
ABS-001 Bootstrap Complete
  -> Repository Discovery
  -> Artifact Discovery
  -> Repository Verification
  -> Inventory Report
  -> Operational Readiness
  -> Engineering Work
```

Skipping phases is not permitted.

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

- ABS-001 completed
- Repository Discovery completed
- Artifact Discovery completed
- Repository Verification completed
- AIR-001 completed
- Role understood
- Required standards identified
- Operational readiness confirmed

## Completion Criteria

AOS-001 is complete when ABS-001 has completed, onboarding is successfully completed, AIR-001 is produced and operational readiness is confirmed.
