# EV-0003 – Time Tracking Market Research

Status: Evidence Candidate
Epic: Sprint 1 (Research Agent Candidate Task, originally proposed in `ADO/02_Development/Sprint_1_Product_Architecture.md`)
Role: Research Agent
Date: 2026-07-02

## Summary

This is the market-pain-analysis task proposed but not yet executed in Sprint 1. It analyzes existing time tracking products (Toggl Track, Clockify, Homebase, Harvest, Connecteam, TimeDock, TimeTac) for recurring complaints, what works, what fails, and pricing/trust patterns, to give the Product Vision and v1 scope an evidence base instead of assumption.

This document produces evidence candidates only. It does not modify architecture, scope or ADRs — any resulting change requires Human Architect review.

## What Fails (Recurring Complaints Across Products)

- **Reliability under real conditions**: sync bugs, crashes when clocking in or switching devices, duplicate entries, timesheet approvals silently not saving. Reported on Toggl Track and Clockify specifically.
- **Missed/forgotten clock-ins are the single most cited operational problem**, independent of product. Estimated cost: 1–5% of total labor cost lost to inaccurate manual entries, plus roughly 3–5 minutes of manager time per correction. A 20-person hourly team with 10 missed punches/week loses close to an hour of management time weekly on corrections alone.
- **No offline support is an explicit dealbreaker**: Connecteam, a direct NFC-clock-in competitor, does not support offline time tracking — reported as a dealbreaker for field/remote teams.
- **Feature-gating frustration**: approvals, time-off, GPS tracking and reporting locked behind paid tiers (Clockify) frustrate users who feel core functionality is withheld.
- **Cluttered UI from feature creep**: Connecteam's breadth of features makes the UI "comprehensive but cluttered" and "overwhelming." General pattern: the more a product tries to be full workforce management, the more its core clock-in UX suffers.
- **Mobile app treated as second-class**: Clockify's mobile app has slower sync and fewer reporting options than desktop — relevant since TapTime is mobile-first by design.
- **Pricing trust damage**: Harvest's post-acquisition 600% price increase is cited as a trust-breaking event; per-location/per-active-user pricing (Homebase) is criticized for unpredictable cost growth.
- **Support responsiveness**, especially around billing/cancellation, is a recurring trust issue (Clockify, Toggl).

## What Works

- **Minimal, fast, low-friction interaction** is consistently praised: Toggl Track ("clean interface, fewer clicks"), Memtime ("minimalist... one click"), Everhour ("zero training needed").
- **NFC/physical-token tracking earns real satisfaction when reliable**: TimeDock reports 92% user satisfaction, specifically praised for ease of setup and intuitive design — the closest direct precedent for TapTime's approach. Its main weaknesses are connectivity issues and limited reporting, not the NFC concept itself.
- **Reducing the number of steps between "I arrived" and "I am clocked in"** is explicitly named as the single most effective lever against missed punches — this is a direct, evidenced validation of TapTime's "One Tap. One Decision" thesis.

## Trust and Monitoring Perception

Excessive or opaque monitoring measurably damages trust: employees who feel over-surveilled report disengagement, stress and reduced discretionary effort. However, roughly 92% of employees accept monitoring when it is transparent and framed as benefiting them (accurate pay, fairness) rather than as surveillance. This is a UX/positioning requirement, not just a legal one: TapTime's audit trail (Product Principle "Everything is Auditable") should be presented to end users as protection and fairness, not oversight, in onboarding and in-app copy.

## Relevance to TapTime Product Decisions

- **ADR-0004 (Offline-first)** is directly validated: a named competitor (Connecteam) fails exactly here, and it is called a dealbreaker.
- **ADR-0003 (v1 scope)** exclusions (advanced scheduling, approvals, billing) are supported by evidence: feature breadth is what makes competitors' core UX suffer. Staying narrow is a competitive strength, not just discipline.
- **Product Principle "Zero Decision UX"** matches the single most effective mitigation named in the research (reduce steps between arrival and clock-in).
- **Open gap**: none of the researched products' failure modes are primarily about NFC itself — they are about reliability (sync/offline), UI clutter from scope creep, and pricing trust. This suggests TapTime's technical risk is concentrated in execution quality (sync, reporting, pricing transparency), not in the core NFC concept.
- **New consideration for onboarding/positioning**: explicitly frame the audit trail to end users (employees) as time-and-pay protection, not monitoring, given the measured resentment risk.

## Not Yet Covered

- No direct evidence gathered on tutoring/education-sector-specific competitors (frogs' actual vertical) or construction/field-service-specific tools beyond what's cited here.
- No direct source review of German-market-specific time tracking products (e.g., local Betriebsrat-focused vendors) was performed in this pass.

## Result

Evidence supports proceeding with the current v1 scope and architecture direction. No ADR changes are proposed at this time. Recommend Human Architect review before treating any point above as an accepted Product Rule.
