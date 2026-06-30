# EP-006 Startup Sequence Follow-up Evidence

Status: Evidence  
Evidence ID: EP-006-FU-001 / EP-006-FU-002  
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

## Sequence Authority Decision

Review finding EP006-001 identified that ADO/README, AOF-001, OAP-001 and ALF-001 used similar but not identical diagrams.

The correction does not force all diagrams to be identical.

Instead, the repository now defines one normative source and two supporting diagram types:

| Artifact | Diagram Type | Authority |
|---|---|---|
| `ADO/README.md` | Official Startup Sequence | Normative |
| `AOF-001` | Operational Lifecycle Overview | Informative |
| `ALF-001` | Lifecycle State Model | Informative |
| `OAP-001` | Official Startup Sequence Reference | References `ADO/README.md` |

`ADO/README.md` is the authoritative source for startup order.

AOF-001 and ALF-001 may include broader lifecycle context, but they shall not redefine the official startup sequence.

## Changed Artifacts

| Artifact | Change |
|---|---|
| `ADO/README.md` | Startup order updated, discovery compatibility rule added and normative authority clarified. |
| `AOF-001` | Framework flow renamed to informative Operational Lifecycle Overview and authority clarified. |
| `OAP-001` | Official prompt requirements updated and ADO/README authority clarified. |
| `ABS-001` | Bootstrap preconditions clarified after ADO navigation discovery. |
| `AOS-001` | Startup preconditions and ready checklist updated. |
| `ADS-001` | Initial vs full Repository Discovery defined. |
| `ALF-001` | Lifecycle diagram renamed to informative Lifecycle State Model. |
| `AOG-001` | Operational principles and mandatory guidelines updated. |
| `Decision Log` | Follow-up decisions added as EP-006-FU-001 and EP-006-FU-002. |
| `AVR-001` | Follow-up validation rows added with PENDING review status. |

## Consistency Verification

The normative startup sequence appears in:

- `ADO/README.md` as the official startup sequence,
- `OAP-001` as a reference to the official startup sequence.

Supporting diagrams are explicitly labelled as non-normative:

- `AOF-001` uses Operational Lifecycle Overview (Informative),
- `ALF-001` uses Lifecycle State Model (Informative).

The change does not introduce a new standard.

The change extends existing EP-006 artifacts.

## Review Requirement

Review Agent shall verify:

- `ADO/README.md` is clearly the normative startup sequence source,
- AOF-001 and ALF-001 no longer appear to redefine startup order,
- OAP-001 references the official startup sequence instead of redefining it,
- the distinction between initial Repository Discovery and ADS-001 full Repository Discovery is clear,
- no duplicate standard was created,
- backward compatibility is preserved,
- Decision Log and AVR-001 are consistent,
- READY FOR WORK requirements remain complete.

## Status

Implementation completed on branch:

`ep-006-startup-order`

Review finding EP006-001 has been addressed.

Review decision is pending.
