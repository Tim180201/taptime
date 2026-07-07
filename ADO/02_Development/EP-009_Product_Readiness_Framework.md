# EP-009 – Product Readiness Framework

Status: Active (continuous / permanent — this Epic does not Close the way EP-007 closed)
Epic: EP-009
Owner: Technical Lead
Approval Authority: Human Architect
Previous Epic: EP-008 – Developer Implementation Manual (concurrent, not superseded)
Created Date: 2026-07-07
Related Artifacts: `ADO/05_Evidence/Product_Readiness_Assessment.md`, `ADO/05_Evidence/Product_Readiness_Roadmap.md`, EP-007, EP-008, `ADO/00_Core/Decision_Log.md`, `ADO/00_Governance/AVR-001_Artifact_Validation_Register.md`, `ADO/02_Development/EP-007_Development_Tasks.md`, Development Sprint 001–010 Plans and Closures

---

## 1. Purpose

EP-009 formally establishes Product Readiness as a permanent, ongoing governance activity alongside — not instead of — the engineering execution model that Development Sprints already provide.

The repository's Engineering Foundation, Repository Foundation and Governance Foundation are complete. Ten Development Sprints have been Completed (DEV-SPRINT-001 through DEV-SPRINT-010, `Decision_Log.md`). The `Product_Readiness_Assessment.md` and `Product_Readiness_Roadmap.md` (2026-07-07) have been reviewed and approved by the Technical Lead. Repository evidence at this point in the repository's history shows two distinct, equally necessary questions, neither of which the other answers:

```text
Engineering Readiness answers:
  Can we build it?

Product Readiness answers:
  Can customers successfully buy, deploy, operate and trust it?
```

Ten Development Sprints have answered the first question with increasing confidence (Section 1 of the Product Readiness Assessment: "Engineering Readiness... the most mature category in this assessment"). The same assessment's remaining nine categories show the second question has barely been asked in most areas (Section 14's Scorecard: nine of ten categories rated "Emerging"). EP-009 exists because a repository that only ever asks the first question will keep building a more sophisticated engineering core without closing the gap to a sellable, operable, trustworthy commercial product — and a repository that only asked the second question, without the engineering discipline EP-006/EP-007/EP-008 already established, would produce business planning with nothing real underneath it. Both are now required. Neither replaces the other.

## 2. Relationship to Existing Epics and Artifacts

EP-009 does not redefine, supersede, or duplicate any of the following. It sits alongside them as a second, permanent planning stream:

- **EP-007 – Product Architecture Foundation.** EP-007 answered "what do we build?" — it produced ADR-0007, TTAP-001's extension, FB-001 and TS-001, and remains Closed as the architecture foundation for the first feature. EP-009 does not reopen EP-007 or introduce new architecture on top of it (see Section 8, Non-Goals). Where EP-009's readiness domains reference architecture (e.g. the still-deferred backend technology decision named in ADR-0007), EP-009 tracks the decision's *readiness consequences*, not the architecture itself.
- **EP-008 – Developer Implementation Manual.** EP-008 answers "how do developers implement approved decisions correctly?" and remains the authoritative source of implementation guidance and of "Implemented Reality" narrative synchronized after every Development Sprint. EP-009 does not change EP-008's role, its chapters, or its synchronization process. A Development Sprint's governance closure continues to update EP-008 exactly as it has for Sprints 001–010; EP-009 adds a second, parallel question ("did this sprint also move a Product Readiness category forward?") without altering that existing closure process.
- **Development Sprints.** Development Sprints remain the sole implementation mechanism in this repository. EP-009 does not create Development Tasks, does not plan a Development Sprint, and does not implement code. It governs the readiness work that exists *outside* what any Development Sprint plan already covers (Technical Operations, Commercial, Legal & Compliance, Deployment, Go-To-Market, Customer, Support and Scaling Readiness — none of which are Development Task scope today, per the Product Readiness Assessment's own categorization).
- **Product Readiness Assessment.** The Assessment (2026-07-07, Technical-Lead-reviewed) is EP-009's evidentiary baseline, not a one-time deliverable EP-009 sits above. Section 4 (Working Model) and Section 6 (Lifecycle) below describe how this baseline is extended, not recreated, going forward.
- **Product Readiness Roadmap.** The Roadmap (2026-07-07) is EP-009's current execution plan across the Now / Before Pilot Customers / Before First Paying Customers / Before 100 Customers / Before 1,000 Customers milestones. EP-009 does not restate its content; it establishes the recurring governance process that keeps the Roadmap current as milestones are reached.

The clearest statement of the boundary EP-009 draws: **Development Sprints remain the implementation mechanism. EP-009 governs everything required outside implementation.**

## 3. Product Readiness Domains

EP-009 formally adopts the ten assessment categories already established by repository evidence in `Product_Readiness_Assessment.md` as the permanent Product Readiness domains:

1. Engineering Readiness
2. Technical Operations Readiness
3. Product Readiness
4. Commercial Readiness
5. Legal & Compliance Readiness
6. Deployment Readiness
7. Go-To-Market Readiness
8. Customer Readiness
9. Support Readiness
10. Scaling Readiness

**Business Readiness is explicitly NOT yet introduced as an official domain.** The Assessment's Section 13 evaluated this question directly and concluded that repository evidence is currently insufficient to populate it with the same evidentiary rigor as the ten domains above — only a Mission/Problem statement and an implicit customer segment exist at the Product Vision level, with no dedicated Ideal Customer Profile, competitive analysis, pilot strategy, or market-validation evidence anywhere in the repository. EP-009 retains this as an open, tracked question rather than adopting it prematurely: the Assessment's Section 13 already specifies what would need to exist (a documented Ideal Customer Profile, competitive analysis, pilot-strategy notes, market-validation evidence) before a future reassessment should promote it to an eleventh domain. EP-009's Scorecard deliverable (Section 5 below) carries this same domain forward as a tracked placeholder, consistent with the Assessment.

Each domain's current maturity is not restated here — see the Product Readiness Assessment (Sections 1–10) for repository evidence per domain and the Product Readiness Scorecard (Assessment Section 14) for the current qualitative rating of each. EP-009 governs *that these ten domains continue to be assessed together, on the cadence described in Section 4 below*; it does not re-derive their content.

## 4. Working Model

Product Readiness is not a milestone that is completed once. It is a continuously reassessed state, evolving in step with repository evidence — the same "Repository Before Assumptions" and "Reality Has Priority Over Architecture" principles EP-008 already applies to implementation guidance apply here to readiness evaluation.

The Product Readiness Assessment (2026-07-07) is the **baseline**. Future readiness work extends this baseline; it does not recreate it. This mirrors a pattern already proven in this repository: every EP-008 Synchronization Update since Development Sprint 001 has extended Chapters 00–03's "Implemented Reality" sections rather than rewriting them from a blank page, and AVR-001 exists specifically because validation claims decay and must be re-evidenced, not re-invented, over time (`AVR-001`: "Validation requires evidence. Status shall never be upgraded by assumption"). Product Readiness Assessment Section 15 already recommended this same continuity discipline for itself; EP-009 is the governance vehicle that makes that recommendation binding practice.

Typical reassessment triggers include, without limitation:

- completion of a new Development Sprint (Engineering Readiness domain, and often others depending on what the sprint touched — e.g. DT-015's Local Persistence Foundation materially changed the evidence basis for Scaling and Technical Operations Readiness),
- introduction of new architecture (a new ADR, a TTAP-001 extension, a new Feature Blueprint),
- acquisition of a new pilot customer (Customer Readiness, Support Readiness, and typically several others simultaneously),
- a commercial milestone (first paying customer, a pricing change, a new market entered),
- a major governance change (a new Epic, a change to EOM-001/AGR-001/DTP-001/AVR-001, or — as this document itself is an instance of — the formal adoption of a new permanent governance activity).

A reassessment is not required on a fixed calendar. It is triggered by evidence change, consistent with the assessment's own Section 15 recommendation ("A reassessment should be triggered by milestone, not by calendar").

## 5. Deliverables

EP-009 defines the following permanent deliverable types. Their content is produced by future Research/Implementation Support, Technical Lead, and Human Architect work under this Epic; EP-009 itself only establishes that they exist as a recognized, recurring artifact category, cross-referenced into the Decision Log where appropriate.

- **Product Readiness Assessment.** The full, ten-domain (plus tracked Business Readiness placeholder) evidence document. Current baseline: `ADO/05_Evidence/Product_Readiness_Assessment.md` (2026-07-07).
- **Product Readiness Roadmap.** The milestone-organized execution plan (Now / Before Pilot Customers / Before First Paying Customers / Before 100 Customers / Before 1,000 Customers), separated into Engineering Track, Product Capability Track, and Business/Legal/Go-To-Market Track. Current baseline: `ADO/05_Evidence/Product_Readiness_Roadmap.md` (2026-07-07).
- **Readiness Reviews.** Technical Lead and Human Architect review records for each Assessment/Roadmap revision or reassessment — the same review discipline already applied to the 2026-07-07 baseline and its Technical Lead Review Follow-up revision, made a named, repeatable deliverable type rather than an ad hoc practice.
- **Readiness Scorecard.** The qualitative (Emerging / Developing / Established / Advanced) maturity rating per domain, currently produced as Product Readiness Assessment Section 14, tracked as a standalone deliverable type so that successive scorecards can be compared side by side across reassessments to show trajectory.
- **Product Readiness Decisions.** Named decisions that resolve a specific readiness finding (for example: the backend/cloud persistence technology decision, the Organization Management scope decision, Finding F-01, a pricing/packaging decision) — each such decision, once made, shall receive a Decision Log entry cross-referencing the Product Readiness domain(s) it advances, following the same traceability discipline every ADR/Development Sprint closure already applies.

Cross-references into `ADO/00_Core/Decision_Log.md` are made for the Epic itself and for each baseline Assessment/Roadmap version (see Section 9, Changed Artifacts, for what this task adds); future Product Readiness Decisions shall receive their own Decision Log rows as they are made, per the pattern above.

## 6. Product Readiness Lifecycle

EP-009 establishes the following lifecycle, complementing — not replacing — the existing Development Sprint lifecycle (Plan -> Implementation -> Testing -> Governance Closure -> EP-008 Synchronization already used for Sprints 001–010):

```text
Product Readiness Assessment
  -> Technical Lead Review
  -> Human Architect Review
  -> Approved Roadmap
  -> Engineering / Product Execution
  -> Evidence
  -> Reassessment
  -> Roadmap Update
  (repeat)
```

Each stage maps to a step already exercised at least once by the 2026-07-07 baseline:

- **Product Readiness Assessment** — evidence-first evaluation across the ten domains (Section 3), producing findings, priorities, owners and timing per domain.
- **Technical Lead Review** — the review this Epic itself was requested in response to; the review that produced the seven-change Technical Lead Review Follow-up revision to the 2026-07-07 baseline.
- **Human Architect Review** — final approval authority over any resulting scope, roadmap, or Product Readiness Decision, mirroring the authority split already used for every other engineering artifact in this repository (EOM-001).
- **Approved Roadmap** — the milestone-organized, track-separated execution plan (Section 5), kept current through the working model in Section 4.
- **Engineering / Product Execution** — carried out through existing mechanisms: Development Sprints for engineering/product-capability implementation work, and direct Human Architect/Technical Lead action for the Business/Legal/Go-To-Market Track items the Roadmap identifies as non-engineering.
- **Evidence** — the same repository-evidence discipline (commits, test results, Decision Log rows, Feature Blueprints) already produced by every Development Sprint closure, now also tracked for its Product Readiness consequences.
- **Reassessment** — triggered per Section 4's trigger list, extending rather than recreating the prior Assessment.
- **Roadmap Update** — reflecting what the reassessment found, again extending rather than recreating the prior Roadmap.

This lifecycle does not redefine FDOS. It applies FDOS's existing evidence-based governance discipline to a second planning stream, exactly as TTAP-001 states FDOS should be applied at the project level ("FDOS provides the methodology. TapTim.e defines the concrete project architecture") — here, to readiness governance rather than technical architecture.

## 7. Success Criteria

EP-009 is successful when:

- Product Readiness becomes continuously maintained — reassessed on evidence-based triggers (Section 4), not left to go stale the way `Roadmap.md`, `Project_Status.md`, and the root `README.md` were independently found to have gone stale elsewhere in this repository (Product Readiness Assessment, Section 2).
- Engineering and Product Readiness remain synchronized — a Development Sprint's governance closure and its Product Readiness consequences (if any) are both visible in the Decision Log, without one process silently drifting ahead of the other the way EP-008's own Development Sprint 005 narrative synchronization gap has already demonstrated can happen if not deliberately maintained.
- Every Development Sprint increases customer readiness — not merely engineering completeness. A sprint that adds a new, well-tested capability but does nothing to move any of the ten Product Readiness domains forward should be a visible, discussable fact, not an invisible one.
- Every Product Readiness reassessment is repository-evidence based — no reassessment upgrades a domain's maturity rating (Section 5's Scorecard) without citing the specific new evidence (a commit, a Decision Log row, a new Feature Blueprint, a pilot outcome) that justifies the change, mirroring AVR-001's own rule that "Validation requires evidence. Status shall never be upgraded by assumption."
- No Product Readiness recommendation bypasses Human Architect approval — every Product Readiness Decision (Section 5) follows the same Human Architect approval authority already established for every other consequential decision in this repository (Product Vision changes, ADRs, Development Sprint closures).

## 8. Non-Goals

EP-009 does **not**:

- create implementation work — no code, no Development Task, no Feature Blueprint is created by this Epic;
- replace Development Sprints — Development Sprints remain the sole implementation mechanism (Section 2);
- replace `Product_Vision.md` — Product Vision remains the authoritative statement of product mission, vision and philosophy; EP-009 evaluates readiness against it, it does not redefine it;
- redefine FDOS — the lifecycle in Section 6 applies FDOS's existing evidence-based governance discipline, it does not introduce a new methodology;
- introduce new architecture — no ADR, no TTAP-001 change, no new domain model content is created by this Epic. Where EP-009's domains reference an open architectural decision (e.g. the backend technology decision), EP-009 tracks the decision's readiness consequences only, and any resulting architecture change must go through the existing ADR process, not through EP-009 directly.

## 9. Changed Artifacts (This Task)

| File | Change |
|---|---|
| `ADO/02_Development/EP-009_Product_Readiness_Framework.md` | New — this file |
| `ADO/00_Core/Decision_Log.md` | Added `EP-009` row and baseline rows for the Product Readiness Assessment/Roadmap; refreshed Repository Status narrative |
| `ADO/00_Core/Project_Status.md` | Refreshed to reflect current repository reality (ten completed Development Sprints, EP-008 status, EP-009 established) — see Role Handover for why this was judged appropriate despite being a larger change than a single cross-reference line |
| `ADO/README.md` | Added EP-009 to the Development navigation table; added Product Readiness Assessment/Roadmap to the Evidence navigation table |

No Feature Blueprint, Development Task, ADR, TTAP-001, or `Product_Vision.md` content was created or modified.

## 10. Role Handover

Implemented scope: creation of EP-009 as a permanent, ongoing Epic, plus the minimum required cross-references listed in Section 9. No code was written or modified. No architecture, ADR, TTAP-001, FB-001, TS-001, Product Vision, Product Principles, Domain Model, Role Model, or EP-008 content was changed. No Feature Blueprint or Development Task was created.

Note on `Project_Status.md`: this file was judged to require more than a single added line, because its existing content (dated 2026-07-03, "READY FOR DEVELOPMENT SPRINT 001... No application code yet") already actively contradicted the Decision Log before this task began — a state the Product Readiness Assessment itself had already flagged (Section 2: "root documentation actively describes a pre-Sprint-001 repository state"). Adding an EP-009 cross-reference to an otherwise-unchanged, already-contradicted document would have compounded rather than resolved that inconsistency, so this task's minimum-appropriate cross-reference was judged to include bringing the rest of the document's Current State into alignment with repository reality (ten completed Development Sprints, EP-008 chapters 00–03, EP-009 now established) rather than adding one more stale-adjacent line to it. This is a narrower action than the Product Readiness Roadmap's own already-tracked "Now" item to refresh root `README.md`/`CHANGELOG.md`/`Roadmap.md` as well — those three were left untouched, since they were not named as EP-009 cross-reference targets by this task and remain correctly tracked as separate, already-approved roadmap work.

Related ADO artifacts consulted: `Product_Readiness_Assessment.md`, `Product_Readiness_Roadmap.md`, `EP-007_Product_Architecture_Foundation.md` (structural template), `ADO/README.md`, `Decision_Log.md`, `Project_Status.md`, `AVR-001_Artifact_Validation_Register.md`, EP-008 Chapter 00 (`00_Introduction.md`), `EP-007_Development_Tasks.md`.

Tests performed: none (no code changed; this task is governance/documentation only).

Known deviations: none from the assigned task scope, beyond the `Project_Status.md` scope judgment explained above, which is disclosed rather than silently performed.

Open findings carried forward (not resolved by this task, unchanged from the Product Readiness Assessment/Roadmap): all findings in `Product_Readiness_Assessment.md` Sections 1–15 and `Product_Readiness_Roadmap.md` remain open exactly as recorded there; EP-009 formalizes the governance process for resolving them over time, it does not resolve any of them itself. Root `README.md`, `CHANGELOG.md`, and `Roadmap.md` remain stale (tracked separately in the Roadmap's "Now" milestone, Engineering Track).

Next responsible role: Technical Lead / Human Architect to review EP-009. Per the assigned stop condition, this task does not create any Feature Blueprint, Development Task, or implementation work, and does not perform a Product Readiness reassessment itself.

## 11. Stop Condition

Per task instruction: stop after EP-009 has been created and the minimum required cross-references (Section 9) have been made. No additional documents were created. No implementation, Feature Blueprint, or Development Task was created. Awaiting Technical Lead / Human Architect review.
