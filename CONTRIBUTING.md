# Contributing to TapTim.e

This repository is developed under the FDOS methodology. This document is a short, discoverable entry point to a process that already exists in `ADO/` — it does not define new rules.

## Before You Start

Read, in order:

1. `README.md`
2. `ADO/README.md` — official navigation entry point; startup sequence, roles and collaboration model.
3. `ADO/01_Architecture/Product_Vision.md` and `Product_Principles.md`
4. `ADO/01_Architecture/Feature_Blueprint_Standard.md` — mandatory before any feature work.
5. Relevant ADRs under `ADO/01_Architecture/ADR/`

## Mandatory Engineering Order

```text
Product Vision
  -> Feature Blueprint
  -> Technical Specification
  -> Development Tasks
  -> Implementation
  -> Testing
  -> Release
  -> Evidence
```

No code is written before the relevant Feature Blueprint is approved (per `Feature_Blueprint_Standard.md`).

## Git Workflow

- `main` is protected. Architecture and feature work happens on branches (`architecture/...`, `feature/...`).
- Every pull request must reference the Feature Blueprint or ADR it implements (see the PR template).
- Commit messages should be descriptive; documentation-only changes may be batched rather than committed per file.

## Roles

- **Human Architect** — owns product vision, prioritization, scope and final approval.
- **Technical Lead** — owns engineering governance, architecture quality, ADRs and Blueprint review.
- **Development Agent** — implements approved Blueprints/Specs within scope.
- **Review Agent** — verifies quality, architecture compliance and evidence; does not implement.
- **Research Agent** — turns project evidence into recommendations; does not modify standards or implementation directly.
- **Implementation Support Agent** — executes assigned, bounded implementation or maintenance tasks.

Full definitions and current instance assignments: `ADO/01_Architecture/Engineering_Operating_Model.md` (EOM-001) and `ADO/01_Architecture/Agent_Registry.md` (AGR-001).

## Reporting Issues

Use the issue templates once implementation begins. Until then, log risks and known gaps in `ADO/00_Core/Risk_Register.md`.
