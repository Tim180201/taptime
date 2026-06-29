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

## Discovery Objectives

Repository Discovery shall enable an agent to:

- identify the current project state
- locate relevant engineering artifacts
- detect repository inconsistencies
- avoid duplicate documentation
- establish operational readiness

## Discovery Principles

### Repository Before Memory

The repository is the authoritative source of project knowledge.

Previous conversations may provide context but shall never replace repository verification.

### Verify Before Creating

An agent shall verify whether an artifact already exists before proposing or creating a new one.

### Continue Existing Work

Engineering work continues the current baseline instead of replacing it.

### Evidence Before Conclusions

Conclusions shall be supported by repository evidence.

## Discovery Workflow

```text
Repository Access
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

Before reviewing individual documents, the agent shall review the Decision Log.

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

Repository Discovery produces:

- Repository Inventory
- Repository Health Assessment
- Missing Artifact List, verified only
- Existing Artifact Register
- AIR-001

## Completion Criteria

Repository Discovery is complete when repository structure is understood, active standards are identified, repository health is verified and AIR-001 is completed.
