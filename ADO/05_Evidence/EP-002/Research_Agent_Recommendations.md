# Research Agent Recommendations Package — For Technical Lead Review

Status: Recommendations, not standards
Owner: Research Agent (Claude Chat)
Date: 2026-07-02
Related: `ADO/05_Evidence/EP-002/Repository_Reconciliation.md`, `EV-0007-time-tracking-market-research.md` (recommend renaming to EV-0007 to avoid ID collision with main's existing EV-0003)

## Purpose

Per AGR-001/EOM-001, the Research Agent provides recommendations only and does not modify standards, architecture or implementation artifacts. This package collects everything of genuine, non-duplicated value produced during a recent session that was mistakenly conducted under a self-assigned "Technical Lead" role. Each item below is a proposal for the Technical Lead to accept, adapt or reject — none are pre-approved, regardless of any prior "Accepted" status recorded on the now-abandoned branch.

Full source material and reasoning live in `ADO/05_Evidence/EP-002/Repository_Reconciliation.md`. This document is the short, actionable version.

## 1. Duplicate-scan mechanism detail for TS-001

FB-001 already states duplicate scans within a protection window shall not create duplicate TimeEntries; TS-001 lists "duplicate scan protection" as a test requirement but does not specify a mechanism. Proposal: toggle-based resolution (scan starts if no open session exists for the target, stops if one does), a short debounce window for accidental double-taps, and idempotent event processing for offline retry.

**Known defect requiring correction before use:** the original proposal suggested an idempotency key of `device ID + local timestamp + tag ID`. This is not deterministic under clock drift, offline retry or device reset. Use a client-generated UUID assigned once at event creation instead.

## 2. Open Session Reminder (candidate new Feature Blueprint or ADR-0003 amendment)

Market research (competitor pain-point analysis) found that forgotten clock-outs are roughly half of the largest quantified complaint across existing time tracking products; NFC-first design already addresses forgotten clock-*in*, not clock-*out*. Proposal: a local, time-based reminder (no GPS, no location data) triggered when a WorkEvent has been open unusually long. Does not conflict with the existing "GPS tracking as primary feature: out of scope" boundary.

## 3. Pricing Principles (forward-looking, non-binding)

No pricing/monetization topic exists yet anywhere in the project. Proposal, based on competitor research showing pricing-trust failures (sudden price hikes, core features paywalled) as a recurring cause of customer distrust: core time tracking should never be feature-gated, pricing changes should never be retroactive without notice, and pricing should be predictable rather than usage-anxiety-inducing. No implementation impact; this is guidance for whenever monetization is designed.

## 4. Reporting Quality Bar (for whichever future Feature Blueprint covers reporting/export)

The closest competitor precedent to TapTim.e's own approach (NFC-token-based time tracking) is well-liked overall but specifically criticized for weak reporting. Proposal: treat v1 reporting as a defined quality bar (filterable export, summary + detail views, traceability back to source events) rather than an afterthought, whenever that Feature Blueprint is written. FB-001 does not cover reporting, so this has no immediate conflict.

## 5. Product Principle candidate — Auditability is Protection, Not Surveillance

FB-001's Product Rules already cite "Everything is Auditable" but do not address how that traceability is presented to the employee being tracked. Market research shows employee monitoring is broadly accepted when transparently framed as protecting the employee (accurate pay/hours) rather than as oversight, and creates resentment when it isn't. Proposal: any future employee-facing screen touching the audit trail (onboarding, correction flows) should carry this framing as a Product Rule check.

## 6. Repository hygiene (low-risk, recommend direct adoption)

`main` currently has no `.gitignore`, `CODEOWNERS`, `CONTRIBUTING.md`, PR template, or root `CHANGELOG.md`. These were built this session and carry no governance conflict — pure hygiene. Files available in the (to-be-closed) branch: `.gitignore`, `CODEOWNERS`, `CONTRIBUTING.md`, `.github/pull_request_template.md`, `CHANGELOG.md`, `docs/README.md` (clarifies the ADO vs. docs split, referencing `CONTRIBUTING.md`).

## 7. Observation (not a recommendation, a defect report)

`ADO/01_Architecture/Tech_Stack.md` and the root `README.md` on `main` both still describe the project as pre-stack-decision / "Sprint 0" / "blank bootstrap," despite ADR-0007 being Approved and EP-007 being closed. This is a staleness gap on `main` itself, unrelated to the branch being closed. Flagging for Technical Lead awareness.

## Not Included

Everything else produced on the branch (Strategic Review, AI Technical Lead Charter, and anything already identical to `main`) is archived or dropped per the Repository Reconciliation — not carried forward, to avoid re-introducing already-resolved or already-superseded material.
