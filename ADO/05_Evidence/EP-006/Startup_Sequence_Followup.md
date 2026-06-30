# EP-006 Startup Sequence Follow-up Evidence

Status: Evidence  
Evidence ID: EP-006-FU-001  
Owner: Technical Lead  
Date: 2026-06-30  
Review Target: EP-006 Startup Sequence Follow-up

## Purpose

This evidence document records the EP-006 follow-up change that moves initial Repository Discovery before ABS-001.

The change was triggered by Review Agent feedback identifying one remaining improvement in the EP-006 startup sequence.

## Problem

The previous startup sequence assumed that agents already knew the location of:

`ADO/README.md`

This conflicted with the engineering principle:

> Repository before Assumptions.

## Decision

The official startup sequence is updated to:

```text
GitHub Connector Verification
  -> Repository Discovery
  -> Locate the official ADO Navigation Entry Point
  -> Read ADO/README.md
  -> ABS-001
  -> AOS-001
  -> ADS-001
  -> RHS-001
  -> AIR-001
  -> READY FOR WORK
  -> EOM-001
  -> AGR-001
```

## New Engineering Rule

> Agents shall perform Repository Discovery and locate the official ADO navigation entry point before executing the bootstrap sequence.

## Compatibility Decision

To preserve backward compatibility, EP-006 now distinguishes:

```text
Initial Repository Discovery
  -> before ABS-001
  -> locates ADO/README.md and reads startup evidence

ADS-001 Repository Discovery
  -> after AOS-001
  -> performs full repository, artifact and health discovery
```

Initial Repository Discovery does not replace ADS-001.

## Changed Artifacts

| Artifact | Change |
|---|---|
| `ADO/README.md` | Startup order updated and discovery compatibility rule added. |
| `AOF-001` | Framework flow, objectives and core principles updated. |
| `OAP-001` | Official prompt requirements and startup sequence updated. |
| `ABS-001` | Bootstrap preconditions clarified after ADO navigation discovery. |
| `AOS-001` | Startup preconditions and ready checklist updated. |
| `ADS-001` | Initial vs full Repository Discovery defined. |
| `ALF-001` | Lifecycle states and READY FOR WORK gate updated. |
| `AOG-001` | Operational principles and mandatory guidelines updated. |
| `Decision Log` | Follow-up decision added as EP-006-FU-001. |
| `AVR-001` | Follow-up validation row added with PENDING review status. |

## Consistency Verification

The updated startup sequence appears consistently in:

- `ADO/README.md`,
- `AOF-001`,
- `OAP-001`,
- `ABS-001`,
- `AOS-001`,
- `ADS-001`,
- `ALF-001`,
- `AOG-001`.

The change does not introduce a new standard.

The change extends existing EP-006 artifacts.

## Review Requirement

Review Agent shall verify:

- the startup sequence is consistent across EP-006 artifacts,
- the distinction between initial Repository Discovery and ADS-001 full Repository Discovery is clear,
- no duplicate standard was created,
- backward compatibility is preserved,
- Decision Log and AVR-001 are consistent,
- READY FOR WORK requirements remain complete.

## Status

Implementation completed on branch:

`ep-006-startup-order`

Review decision is pending.
