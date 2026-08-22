# RHS-001 – Repository Health Standard

Status: Draft  
Document ID: RHS-001  
Epic: EP-006  
Owner: Technical Lead  
Approval Authority: Human Architect  
Related Standards: ADS-001, AIR-001, EOM-001

## Purpose

The Repository Health Standard defines how every Human and AI Agent evaluates the operational health of a repository before and during engineering work.

Repository Health ensures that engineering activities are based on a consistent, traceable and maintainable project state.

FDOS Rule:

> Repository Health shall be verified before engineering work begins and whenever significant repository changes occur.

## Objectives

Repository Health Verification shall:

- detect structural inconsistencies
- identify outdated documentation
- verify engineering traceability
- identify missing evidence
- detect duplicate artifacts
- ensure repository integrity
- support operational readiness

## Health Categories

Repository Health consists of seven categories:

1. Repository Structure
2. Documentation Health
3. Traceability Health
4. Engineering Health
5. Standards Health
6. Repository Activity
7. Operational Readiness

## Repository Structure

Verify expected directory structure, missing directories, orphan directories, structural consistency and naming consistency.

## Documentation Health

Verify duplicate documents, obsolete documents, inconsistent naming, missing metadata, missing owners, missing approval authorities and unclear document status.

## Traceability Health

Verify broken references, missing links, missing Decision Log entries, missing Evidence references, missing ADR references and unsupported claims.

## Engineering Health

Verify Feature Blueprints, Technical Architecture documents, Development Tasks, Review artifacts and Evidence artifacts.

Engineering artifacts shall remain connected across the FDOS lifecycle.

## Standards Health

Verify obsolete standards, duplicate standards, conflicting standards, superseded standards and standards that redefine FDOS Core inside the project.

FDOS Genesis remains the authoritative methodology.

## Repository Activity

Verify active engineering work, completed work, archived work, abandoned work, unexpected files or folders, unexpected branches or pull requests.

## Operational Readiness

Verify Agent Registry, Onboarding standards, Official Prompt standard, Engineering Operating Model and Inventory Report requirements are current.

## Health Assessment Levels

- GREEN: Repository healthy. Engineering work may continue.
- YELLOW: Minor findings. Engineering work may continue. Corrective actions recommended.
- ORANGE: Significant findings. Engineering work should pause until review.
- RED: Critical repository integrity issue. Engineering work shall stop. Immediate escalation required.

## Health Report

Every Repository Health Assessment shall include:

- Repository Overview
- Health Category Results
- Findings
- Severity
- Impact
- Recommendations
- Overall Health Status
- Next Responsible Role

## Mandatory Triggers

Repository Health Verification shall be performed:

- before new engineering work
- during Agent Onboarding
- after major merges
- after architecture changes
- after standard updates
- after repository restructuring
- before release
- after completed Epics
- when unexpected repository state is detected

## Corrective Action Rule

Repository Health findings shall be documented before corrective actions are performed.

FDOS Rule:

> Repository Health findings shall always be documented before corrective actions are performed.

## Completion Criteria

Repository Health Verification is complete when all categories are reviewed, findings are documented, overall status is assigned, recommendations are produced and the next responsible role is identified.

FDOS Rule:

> Repository Health Verification is preventive engineering.
