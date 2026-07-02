# Archive

Status: Active Index

This folder preserves superseded or historical TapTim.e artifacts. Per the Feature Blueprint Standard's Archive Rules, nothing here is deleted outright — it remains searchable evidence of how the project got to its current state.

## Contents

### EP-002-superseded-drafts/

`EP-002_Feature_Blueprint_Standard_working-draft.md` — the pre-consolidation, part-based working draft of the Feature Blueprint Standard (Status: Architecture Draft). It was superseded by the consolidated, Review Ready `ADO/01_Architecture/Feature_Blueprint_Standard.md` after the Architecture Consolidation Sprint documented in `ADO/02_Development/EP-002_Consolidation_Sprint.md` and `ADO/05_Evidence/EV-0002-feature-blueprint-standard.md`.

Archived 2026-07-02 during a repository hygiene pass. It was sitting alongside its own final replacement in `ADO/01_Architecture/`, which is exactly the duplicate-active-document risk `frogs-zeiterfassung` was bitten by (its BUG-008: duplicate root/utils files causing edits to the wrong copy). Moving it here removes that risk without deleting the historical record.

### superseded-by-EP-006-EP-007/

`AI_Technical_Lead_Charter.md` — a branch-local governance document written before this session discovered that `main` already has a validated, far more complete Agent Operations Framework (`ADO/README.md`, EOM-001, AGR-001, OAP-001, AVR-001, from EP-006/EP-007). Per the gap check in `ADO/05_Evidence/EP-002/Charter_Gap_Check.md`, every section is superseded except one: the informal "Chef" communication style, which is flagged there as an open question for the Technical Lead rather than silently discarded.

Archived 2026-07-02 following a CHANGES REQUIRED review (Review Agent / ChatGPT) that correctly identified this Charter as conflicting with the official governance model.

`Strategic_Review_2026-07-01.md` — a project status/roadmap document written before this session discovered `main`'s true EP-003–EP-008 state. Its content is materially outdated (assumed ADR-0007 was undecided, was unaware of FB-001/TS-001/the Agent Registry). Superseded by `ADO/05_Evidence/EP-002/Repository_Reconciliation.md`. Retained for historical traceability only.
