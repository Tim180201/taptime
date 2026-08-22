# EP-008 Repository Health Follow-up Plan

Status: Evidence — For Technical Lead Review
Document ID: EP-008-RHF-001
Epic: EP-008
Owner: Implementation Support (Claude / Cowork session, acting on behalf of Technical Lead per AGR-001)
Approval Authority: Technical Lead (ChatGPT) / Human Architect
Date: 2026-07-03
Branch: `feature/ep-008-developer-implementation-manual`
Related Standards: RHS-001, ADS-001, AIR-001, AVR-001, Decision Log
Related Artifacts: ADR-0007, FB-001, TS-001, TTAP-001, README.md, `ADO/00_Core/Project_Status.md`, `ADO/01_Architecture/Tech_Stack.md`

## Purpose

This document records Repository Health findings discovered while performing Repository Discovery for EP-008 (Developer Implementation Manual) on the local working copy, now checked out on `feature/ep-008-developer-implementation-manual`.

Per RHS-001:

> Repository Health findings shall always be documented before corrective actions are performed.

No corrections have been applied. This is a follow-up plan only, awaiting Technical Lead / Human Architect disposition.

## Method

Every artifact's own `Status:` metadata field was cross-checked against the Decision Log and AVR-001. Top-level status documents (`README.md`, `Project_Status.md`, `Tech_Stack.md`) were checked against the Decision Log's current repository status line (`READY FOR EP-008 – Solution Foundation`) and against EP-007's `Closed` status. Branch state was checked against `origin/main` via `git log` and `git diff --name-status`.

## Findings

| # | Finding | Source of Truth | Recommended Correction | Risk Level | Mechanical or Decision-Level | Proposed Order |
|---|---|---|---|---|---|---|
| 1 | `ADR-0007` header reads `Status: Draft`; its own closing section states it "requires evidence-based Review Agent approval before it may be marked as Validated." Decision Log lists it `Approved` (2026-06-30); AVR-001 lists it `Validated` (1.0), evidence: EP-007 Repository Reconciliation. | Decision Log + AVR-001 (both cite the same EP-007 evidence) | Align ADR-0007's own `Status:` field and closing `## Status` section to match Decision Log/AVR-001. | Low — metadata only, no behavior change | Mechanical | 1 |
| 2 | `FB-001` header reads `Status: Draft`; Decision Log lists it `Approved`; AVR-001 lists it `Validated`. FBS-001 itself requires "Blueprint status reflects engineering reality" and blocks implementation before `Approved` — the file currently fails its own standard. | Decision Log + AVR-001 | Update FB-001 `Status:` field to match the register. | Low | Mechanical | 2 |
| 3 | `TS-001` header reads `Status: Draft`; Decision Log/AVR-001 both record `Approved`/`Validated`. | Decision Log + AVR-001 | Update TS-001 `Status:` field to match. | Low | Mechanical | 3 |
| 4 | `TTAP-001` header reads `Status: Review Ready`, matching the Decision Log row — but AVR-001 records it `Validated` (1.0). Three-way drift: file and Decision Log agree with each other but not with the (more recent, evidence-backed) AVR-001 entry. | AVR-001 (most specific, evidence-backed register) | Update both the TTAP-001 file status and the Decision Log row to `Validated`/`Approved` so a single correction does not re-create the same drift a second time. | Low–Medium — touches two files, one of which (Decision Log) is the shared central index | Mechanical, but flag for Technical Lead sign-off before commit since Decision Log is shared | 4 |
| 5 | Root `README.md` ("Sprint 0 – Project Foundation", "blank project bootstrap phase") and `ADO/00_Core/Project_Status.md` ("Sprint 0 – Foundation", dated 2026-06-26) both predate EP-006/EP-007 entirely. Already flagged as a known gap in the archived EP-002 Repository Reconciliation evidence; never corrected on `main`. | Decision Log ("READY FOR EP-008 – Solution Foundation"); `EP-007_Product_Architecture_Foundation.md` (`Status: Closed`) | Rewrite both files against current Decision Log state instead of patching Sprint-0 language. | Low impact on systems, high visibility — first files any new agent/contributor reads | Decision-level for wording/tone; mechanical for the underlying factual status | 5 |
| 6 | `ADO/01_Architecture/Tech_Stack.md` still reads `Status: Not Decided` and points to an "expected `ADR-0002-mobile-and-backend-stack.md`" that does not exist — ADR-0007 (Technology Platform Baseline, approved 2026-06-30) already covers this ground. Same gap the EP-002 evidence flagged as a "live inconsistency on main," still unresolved. | ADR-0007 | Replace the "Not Decided" content with a pointer to ADR-0007 as governing decision; remove the obsolete ADR-0002 placeholder. | Low–Medium — a reader of only this file would wrongly conclude no stack decision exists | Decision-level — Technical Lead should confirm ADR-0007 is the intended final pointer before rewrite | 6 |
| 7 | `feature/ep-008-developer-implementation-manual` is 1 commit behind `main`: missing `c91f651` ("chore: adopt repository hygiene scaffolding from EP-002 branch"), which added `.gitignore`, `CODEOWNERS`, `CONTRIBUTING.md`, root `CHANGELOG.md`, `docs/README.md`, `.github/pull_request_template.md`. | `git log origin/feature/ep-008-developer-implementation-manual..origin/main` | Rebase/merge the EP-008 branch onto current `main` before the next push/PR. | Low — additive-only commit, no expected conflict | Mechanical, but is a Git integration action reserved for Human Architect per this project's stated Git-push authority | 7 (before next branch push, not before continued local chapter drafting) |

## Overall Health Status

```text
YELLOW
```

Categories affected (RHS-001): Documentation Health, Traceability Health, Repository Activity (branch lag).

None of the findings are structural or block continued EP-008 chapter drafting. All are pre-existing (findings 5 and 6 were already identified during the EP-002 branch reconciliation and were never applied to `main`); none were introduced by this session.

## Recommendation

Findings 1–3 and 7 are mechanical corrections traceable to already-approved registers (Decision Log/AVR-001) or already-approved commits (main). They can be prepared as a single small commit for Technical Lead approval without new architectural or product content.

Findings 4, 5 and 6 involve a shared or product-facing document (Decision Log, README, Tech_Stack) and are recommended for explicit Technical Lead (and, for README tone, Human Architect) confirmation before edits are made, even though the underlying fact pattern is already established elsewhere in the repository.

No new ADRs, no architecture changes, and no merge are proposed by this plan.

## Role Handover

```text
ROLE HANDOVER

Current Role: Implementation Support (acting on behalf of Technical Lead per AGR-001, this session)
Status: COMPLETED
Completed Work: Repository Discovery for EP-008 on feature/ep-008-developer-implementation-manual;
  cross-check of artifact Status metadata against Decision Log and AVR-001;
  cross-check of top-level status documents against current Decision Log state;
  branch-lag check against origin/main; produced this Repository Health Follow-up Plan.
Created Artifacts: This document (ADO/05_Evidence/EP-008/Repository_Health_Followup.md).
Evidence: Decision Log, AVR-001, ADR-0007, FB-001, TS-001, TTAP-001, README.md, Project_Status.md,
  Tech_Stack.md, git log/diff against origin/main.
Known Risks: None of the findings are structural; all are documentation/traceability drift.
Open Questions: Disposition of findings 4–6 (Decision Log edit, README/Project_Status rewrite,
  Tech_Stack.md rewrite) requires explicit Technical Lead confirmation before any edit.
Next Responsible Role: Technical Lead (approve/adapt/reject corrections), Human Architect
  (approve README/Project_Status tone and branch rebase/push).
Reason for Handover: Per RHS-001, findings are documented before corrective action; per AGR-001,
  this session does not approve architecture or governance changes.
Prompt for Next Role: Review the findings table. Approve, adapt or reject each item. If approved,
  this session can apply the mechanical corrections (1-3, 7) and draft the decision-level ones
  (4-6) for review, or continue with EP-008 Chapter 04 - Domain Foundation, whichever is prioritized.
```
