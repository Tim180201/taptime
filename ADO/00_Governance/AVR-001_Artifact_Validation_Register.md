# AVR-001 – Artifact Validation Register

Status: Active  
Document ID: AVR-001  
Owner: Technical Lead  
Approval Authority: Human Architect  
Related Artifacts: Decision Log, EP-006, OAP-001

## Purpose

The Artifact Validation Register records the validation status of TapTim.e engineering artifacts.

It answers:

> Which engineering artifacts have been practically validated, when, by which method and with which evidence?

## Scope

AVR-001 applies to engineering standards, epics, profiles, operating models, agent standards, feature blueprints and other ADO artifacts whose maturity status affects engineering work.

AVR-001 does not replace the Decision Log.

The Decision Log records why decisions were made.

The Artifact Validation Register records whether an artifact has been practically validated.

## Status Model

| Status | Meaning |
|---|---|
| Draft | Artifact exists but has not yet been practically validated. |
| Validated | Artifact has been confirmed through at least one complete engineering cycle and evidence-based review. |
| Accepted | Artifact has been formally accepted as an active project standard or baseline. |
| Deprecated | Artifact is no longer active and is retained for historical traceability only. |

## Validation Rules

An artifact may be marked as `Validated` only when:

- an implementation or operational application has occurred,
- evidence exists,
- an evidence-based review has completed,
- the review decision is `APPROVED`,
- the Technical Lead confirms the engineering cycle is complete,
- validation evidence is traceable.

FDOS Rule:

> Validation requires evidence. Status shall never be upgraded by assumption.

## Register

| Artifact ID | Name | Version | Status | Validation Date | Validation Method | Evidence | Review Decision | Technical Lead | Review Agent | Notes |
|---|---|---|---|---|---|---|---|---|---|---|
| OAP-001 | Official Agent Prompt Standard | 1.0 | Validated | 2026-06-29 | Closed-loop engineering cycle | Technical Lead implementation, Review Agent finding, Technical Lead correction, follow-up Review Agent approval | APPROVED | Technical Lead | Review Agent | Validated distinction between `NOT REVIEWABLE` and `CHANGES REQUIRED`. |
| EP-006 | Agent Operations Framework | 1.0 | Validated | 2026-06-29 | Closed-loop engineering cycle | Agent bootstrap, ADO navigation, Review Agent initialization, evidence-based review, correction cycle and approval | APPROVED | Technical Lead | Review Agent | Validated practical agent startup and review workflow. |
| EP-006-FU-001 | Startup Sequence: Repository Discovery Before Bootstrap | 1.0 | Validated | 2026-06-30 | Follow-up repository integration and review | `ADO/05_Evidence/EP-006/Startup_Sequence_Followup.md`, PR #2, merge commit `9ff8a6db21a748df65d7b773a38968db862f77de` | APPROVED | Technical Lead | Review Agent | Initial Repository Discovery now occurs before ABS-001. |
| EP-006-FU-002 | Startup Sequence Authority Clarification | 1.0 | Validated | 2026-06-30 | Review finding resolution and review | `ADO/05_Evidence/EP-006/Startup_Sequence_Followup.md`, PR #2, merge commit `9ff8a6db21a748df65d7b773a38968db862f77de` | APPROVED | Technical Lead | Review Agent | Resolves EP006-001 by defining ADO/README as normative startup source and AOF/ALF as informative context. |

## Maintenance Rule

The Technical Lead maintains AVR-001.

The Review Agent provides review evidence but does not directly change validation status.

The Human Architect may approve promotion from `Validated` to `Accepted` where appropriate.
