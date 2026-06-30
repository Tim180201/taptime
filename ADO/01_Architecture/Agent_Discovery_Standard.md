# ADS-001 – Agent Discovery Standard

Status: Draft  
Document ID: ADS-001  
Epic: EP-006  
Owner: Technical Lead  
Approval Authority: Human Architect  
Related Standards: AOS-001, AIR-001, RHS-001

## Purpose

The Agent Discovery Standard defines the mandatory repository discovery process every Human or AI Agent shall complete before engineering work.

FDOS Rule:

> Repository Discovery shall precede all engineering activities.

FDOS Rule:

> Agents shall perform Repository Discovery and locate the official ADO navigation entry point before executing the bootstrap sequence.

## Discovery Levels

ADS-001 distinguishes two discovery levels.

### Initial Repository Discovery

Initial Repository Discovery occurs before ABS-001.

Its purpose is limited to:

- verify that repository evidence is available,
- locate the official ADO navigation entry point,
- read `ADO/README.md`,
- determine the documented startup sequence.

Initial Repository Discovery prevents agents from assuming repository paths before repository evidence has been inspected.

### Full ADS-001 Repository Discovery

Full ADS-001 Repository Discovery occurs after AOS-001 begins.

Its purpose is to understand the repository baseline, engineering artifacts, repository health and operational readiness.

Initial Repository Discovery does not replace full ADS-001 Repository Discovery.

## Discovery Objectives

Repository Discovery shall enable an agent to:

- identify the current project state,
- locate relevant engineering artifacts,
- detect repository inconsistencies,
- avoid duplicate documentation,
- establish operational readiness.

## Discovery Principles

### Repository Before Memory

The repository is the authoritative source of project knowledge.

Previous conversations may provide context but shall never replace repository verification.

### Repository Before Assumptions

Agents shall not assume the location of mandatory documents before repository evidence has been inspected.

The official ADO navigation entry point shall be located through repository evidence before ABS-001 begins.

### Verify Before Creating

An agent shall verify whether an artifact already exists before proposing or creating a new one.

### Continue Existing Work

Engineering work continues the current baseline instead of replacing it.

### Evidence Before Conclusions

Conclusions shall be supported by repository evidence.

## Initial Repository Discovery Workflow

```text
GitHub Connector Verification
  -> Repository Access Evidence
  -> Locate ADO Navigation Entry Point
  -> Read ADO/README.md
  -> ABS-001
```

Skipping steps is not permitted.

## Full Discovery Workflow

```text
AOS-001
  -> Repository Structure
  -> Decision Log
  -> Architecture
  -> Development
  -> Evidence
  -> Repository Health
  -> Inventory Report
```

Skipping steps is not permitted.

## Repository Structure Discovery

Discovery is recursive for relevant engineering directories.

No relevant engineering directory may be skipped.

## Decision Discovery

Before reviewing individual documents during full ADS-001 discovery, the agent shall review the Decision Log.

The Decision Log establishes the current engineering baseline.

## Architecture Discovery

The agent identifies all relevant architecture artifacts, including Product Vision, engineering standards, ADRs, EOM-001, AGR-001 and EP-006 standards.

## Development Discovery

The agent identifies active Epics, Feature Blueprints, Development Tasks, Sprint Documentation and Release planning artifacts.

## Evidence Discovery

The agent identifies Evidence documents, Review reports, Validation artifacts and Lessons Learned.

## Repository Health Verification

The agent verifies duplicate artifacts, obsolete artifacts, broken references, inconsistent naming, incomplete traceability, missing evidence and unresolved conflicts.

All findings shall be included in AIR-001.

## Discovery Deliverables

Full ADS-001 Repository Discovery produces:

- Repository Inventory,
- Repository Health Assessment,
- Missing Artifact List, verified only,
- Existing Artifact Register,
- AIR-001.

Initial Repository Discovery produces:

- confirmed repository access evidence,
- located official ADO navigation entry point,
- confirmed startup sequence source.

## Completion Criteria

Initial Repository Discovery is complete when the official ADO navigation entry point has been located from repository evidence and read.

Full ADS-001 Repository Discovery is complete when repository structure is understood, active standards are identified, repository health is verified and AIR-001 is completed.
