# Contributing to TapTim.e

This repository is developed under the FDOS methodology. This document is a short, discoverable entry point to a process that already exists in `ADO/` — it does not define new rules.

## Before You Start

Read, in order:

1. `README.md`
2. `ADO/00_Core/AI_Technical_Lead_Charter.md` — collaboration model and roles.
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

- **Human Architect** — owns product vision and final approval.
- **AI Technical Lead** — owns architecture quality, ADRs, Blueprint review.
- **Development Agent** — implements approved Blueprints/Specs.
- **Research Agent** — turns project evidence into knowledge candidates; does not modify the project.

Full definitions: `ADO/00_Core/AI_Technical_Lead_Charter.md` and `fdos-genesis/01_AI/`.

## Reporting Issues

Use the issue templates once implementation begins. Until then, log risks and known gaps in `ADO/00_Core/Risk_Register.md`.
