# Branch Repository Reconciliation — architecture/ep-002-feature-blueprint-standard vs. main

Status: Evidence — For Technical Lead Review
Owner: Research Agent (Claude Chat)
Date: 2026-07-02
Related: AGR-001, EOM-001, ADO/README.md, AVR-001, EP-007 Repository_Reconciliation.md (precedent format)
Review Reference: ChatGPT Review Package, EP-002 Feature Blueprint Standard Branch, decision CHANGES REQUIRED

## Purpose

This document reconciles `architecture/ep-002-feature-blueprint-standard` (66 commits behind `origin/main`, 19 ahead on its own line) against the current state of `main`, per the Human Architect's direction following the CHANGES REQUIRED review. It follows the same reconciliation method used in `ADO/05_Evidence/EP-007/Repository_Reconciliation.md`.

FDOS Rules applied: *Continue, Never Recreate*. *Extend before Create*. *Repository before Assumptions*.

This is Research Agent evidence: a classification and recommendation, not a standards decision. Per AGR-001/EOM-001, only the Technical Lead may accept, adapt or reject these recommendations into actual ADO standards.

## Method

Every artifact touched by the branch was classified by comparing branch content against `origin/main` directly (`git diff --name-status origin/main HEAD`, plus targeted content diffs), not by assumption.

## Reconciliation Matrix

| Branch Artefact | Already on main | Replaced by | Only on Branch | Recommendation |
|---|---|---|---|---|
| Product Vision, Product Principles 1–7, Domain Model (base), Role Model, NFC Capability Model, Coding Standards, System Overview, Glossary, Risk Register, Roadmap, Project Status, ADR-0001/0002/0004/0005/0006, Feature Blueprint Standard, Sprint_1_Product_Architecture, EP-002_Consolidation_Sprint, EV-0001 | ✓ (byte-identical) | — | ✗ | **Drop from reconciliation** — no divergence, nothing to integrate or discard. |
| ADR-0007, FB-001, TS-001, AVR-001, `ADO/README.md`, all Agent_* standards, Engineering_Operating_Model, Official_Agent_Prompt_Standard, Repository_Health_Standard, Technical_Architecture_Profile, Development_Task_Profile, EP-003–EP-007 dev/evidence docs | — | — | ✗ (main only) | **Not a branch concern** — this is main's independent EP-003–EP-008 buildout. Branch should be based on main going forward, not reconcile these individually. |
| `EV-0007-time-tracking-market-research.md` | ✗ | — | ✓ | **Integrate, with rename.** ID collides with main's own `EV-0003-technical-architecture-profile.md`. Rename to next free ID (EV-0007) before integration. Content itself (competitor pain-point research) is valid Research Agent output and not duplicated on main. |
| `ADR-0008-scan-deduplication-and-state-transitions.md` | Partially — FB-001's Business Rules already state "Duplicate scans inside the configured protection window shall not create duplicate TimeEntries" and TS-001 lists "duplicate scan protection" as a test requirement, but neither specifies a concrete mechanism. | FB-001 (business rule level), TS-001 (test requirement level) | Mechanism-level detail (toggle logic, debounce window, idempotency key design, immutable assignment history) | **Integrate as a TS-001 addendum proposal, not a new ADR.** The business rule is already approved; this branch's contribution is the missing implementation-level mechanism. Flag the Review Agent's F-004 finding before integration: the proposed idempotency key (`device ID + local timestamp + tag ID`) is not deterministic under clock drift/offline retry/device reset and should be replaced with a client-generated UUID assigned at event creation. |
| ADR-0003 Revision — Open Session Reminder | ✗ | — | ✓ | **Keep as a proposal.** Not addressed by FB-001 (scoped only to the scan-creates-WorkEvent flow) or anywhere else on main. Genuinely new, evidence-backed (EV-0003/EV-0007) recommendation. Propose to Technical Lead as a new Feature Blueprint candidate or ADR-0003 amendment — do not treat as already Approved, regardless of this branch's own (out-of-process) approval note. |
| `Pricing_Principles.md` | ✗ | — | ✓ | **Keep as a proposal.** No pricing/monetization topic exists anywhere on main at EP-007/008 stage either. Non-binding, non-implementation-affecting — low-risk to carry forward as guidance for the Human Architect to formally adopt later. |
| `Reporting_Quality_Bar.md` | ✗ | — | ✓ | **Keep as a proposal**, to be attached to whichever future Feature Blueprint covers reporting/export — FB-001 is scoped only to scan-to-WorkEvent and does not mention reporting. |
| Product Principle 8 (Auditability is Protection, Not Surveillance) | ✗ | — | ✓ | **Keep as a proposal.** FB-001's Product Rules cite "Everything is Auditable" but do not address employee-facing framing/trust. Additive, not duplicated. |
| `Strategic_Review_2026-07-01.md` | ✗ | — | ✓ (now superseded) | **Archive as superseded.** Written before this reconciliation; its "current state" section is materially wrong (did not know about EP-003–EP-008). Historical value only. |
| `AI_Technical_Lead_Charter.md` | ✗ (functionally replaced) | `ADO/README.md`, EOM-001, AGR-001, OAP-001 | ✓ | **Archive, pending gap-check** (tracked separately — see `ADO/05_Evidence/EP-002/Charter_Gap_Check.md`). |
| `.gitignore`, `CODEOWNERS`, `CONTRIBUTING.md`, `.github/pull_request_template.md`, `CHANGELOG.md`, `docs/README.md` | ✗ | — | ✓ | **Integrate directly into main** — main has none of these either. Pure repository hygiene, no governance conflict, no role-boundary concern. |
| `ADO/99_Archive/EP-002-superseded-drafts/...` (archived pre-consolidation draft) | ✗ | Feature_Blueprint_Standard.md (already identical on both) | ✓ | **Drop.** This was already-superseded branch-local history; main never had the stale draft in the first place, so there is nothing to archive on main. |
| `EV-0002-feature-blueprint-standard.md` wording diff ("ready for integration" vs. "is integrated") | ✓ (main's wording is newer/correct) | — | ✗ | **Drop branch version** — main's past-tense wording is simply the accurate, later state. |
| `Decision_Log.md` | Diverged independently on both sides | — | Partial | **Manual merge required by Technical Lead** if any branch proposals are accepted — watch for the EV-0003/EV-0007 ID collision above. |
| `README.md` | Diverged independently on both sides | — | Partial | **Neither version is accurate.** Main's root README still says "Sprint 0 – Project Foundation" and "blank project bootstrap phase" despite EP-007 being closed with ADR-0007/FB-001/TS-001 approved — this is a staleness gap on main itself, separate from this branch. Recommend Technical Lead rewrite README fresh against true current main state rather than adopting either branch's version. |

## Additional Observation (not part of the branch, found during reconciliation)

`ADO/01_Architecture/Tech_Stack.md` is identical on both branch and main, and still reads "Not Decided" — even though ADR-0007 (Technology Platform Baseline) is Approved and EP-007 is closed. This is a live inconsistency on `main` itself, independent of this branch. Flagging it here since it was discovered during this reconciliation; resolving it is a Technical Lead action.

## Recommended Disposition of the Branch

Do not continue development on `architecture/ep-002-feature-blueprint-standard`. Per the matrix above:

- The large majority of the branch (everything through EP-002) is already on `main`, byte-identical — no loss in dropping the branch itself.
- The genuinely new material produced in this session (EV-0007 market research, the Open Session Reminder proposal, Pricing Principles, Reporting Quality Bar, Product Principle 8 candidate, the TS-001 duplicate-scan mechanism addendum, and the repository hygiene files) should be extracted and handed to the Technical Lead as discrete proposals, each against current `main`, not as a branch merge.
- The AI Technical Lead Charter and the Strategic Review are branch-local artifacts that do not survive reconciliation as active documents; they are archived.
- After extraction, the branch can be closed without merging.

## Role Handover

```text
ROLE HANDOVER

Current Role: Research Agent
Status: COMPLETED
Completed Work: Reconciled architecture/ep-002-feature-blueprint-standard against main;
  produced classification matrix and disposition recommendation.
Created Artifacts: This document; ADO/05_Evidence/EP-002/Charter_Gap_Check.md (companion)
Evidence: git diff --name-status origin/main HEAD; targeted content diffs; FB-001/TS-001 read directly from origin/main
Known Risks: EV-0003 ID collision if merged without rename; ADR-0008 idempotency key design needs correction before any implementation use
Open Questions: Should Open Session Reminder become its own Feature Blueprint (FB-002) or an ADR-0003 amendment?
Next Responsible Role: Technical Lead
Reason for Handover: Only the Technical Lead may accept, adapt or reject these recommendations into ADO standards per EOM-001.
Prompt for Next Role: Review this reconciliation and the companion Charter Gap Check. Decide disposition for each "Keep as a proposal" item. Resolve the EV-0003 ID collision. Correct or replace the ADR-0008 idempotency key mechanism before any Development Agent uses it. Close the branch once extraction is complete.
```
