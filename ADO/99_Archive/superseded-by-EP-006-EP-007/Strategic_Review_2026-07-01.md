# Strategic Review – TapTim.e

Status: SUPERSEDED — see `ADO/05_Evidence/EP-002/Repository_Reconciliation.md`
Date: 2026-07-01
Owner: Research Agent (written under an incorrect "AI Technical Lead" self-assignment — see Charter_Gap_Check.md)
Approval Authority: Human Architect

**This document was written without knowledge of `main`'s EP-003–EP-008 state (Agent Registry, Engineering Operating Model, ADR-0007, FB-001, TS-001). Its "Current State Summary" and roadmap are materially outdated. Retained for historical traceability only — do not use as a current status source.**

## Purpose

This document consolidates a full re-analysis of the TapTim.e project (Sprint 0–1 state), proposes a release roadmap, defines the agent model required to keep working FDOS-conform, lists content/idea gaps that must be closed, and recommends how the project should be structured going forward.

It is an input to Human Architect review, not an approved standard.

---

## 1. Current State Summary

TapTim.e has completed Sprint 0 (Foundation) and is in Sprint 1 (Product Architecture). No application code exists yet. What exists is a coherent, evidence-aware architecture baseline:

- Product Vision and Product Principles (EP-001, approved).
- ADR-0001 to ADR-0006: monorepo strategy, NFC assignment model, v1 scope, offline-first, event-driven engine, domain-first architecture.
- Domain Model, NFC Capability Model, Role Model (all Sprint 1 Draft).
- Feature Blueprint Standard (EP-002, Review Ready, consolidated 2026-06-28).
- AI Technical Lead Charter defining the Human Architect / AI Technical Lead collaboration model.

Reference project `frogs-zeiterfassung` is a real, 134-commit React Native/Expo/Firebase app (NFC time tracking for a single tutoring business) that is RC-blocked pending device and Firestore rules validation. It is evidence, not a code base to fork: its domain model is single-tenant and hard-coded to one business, while TapTim.e targets multi-tenant SMB customers.

One concrete doc hygiene issue found during this review:

- No Tech Stack ADR exists yet (`ADR-0007` is expected per `Tech_Stack.md`); this blocks Sprint 2.

**Correction (2026-07-02):** an earlier version of this review claimed `ADR-0002` and `Sprint_1_Product_Architecture.md` reference a standalone `NFC_Assignment_Model.md` file that doesn't exist. That was wrong — re-checked directly against the repository: neither document references a file by that name. Both only refer to "NFC Assignment Model" as the title of ADR-0002 itself and as a deliverable label in the Sprint 1 plan. There is no broken reference. Correcting this here rather than silently editing the earlier claim, consistent with the project's own no-silent-drops evidence discipline.

---

## 2. Release Roadmap

Extends the existing `ADO/00_Core/Roadmap.md` with concrete release-oriented milestones and lessons carried over from `frogs-zeiterfassung`'s risk register.

### Sprint 0 – Foundation — Done

### Sprint 1 – Product Architecture — Active, close-out needed
Remaining before this sprint can close:
- Resolve open Domain Model questions (duplicate-scan handling, tag reassignment, assignment history immutability).
- Decide iOS NFC support in v1 or later (currently an open question in `NFC_Capability_Model.md`).
- Freeze v1 scope explicitly (ADR-0003 is "Accepted Draft", not yet frozen per the Development Agent Hold Rule in `Sprint_1_Product_Architecture.md`).

### Sprint 2 – Stack Decision & Implementation Baseline
- ADR-0007: mobile + backend stack decision (frogs stack is a strong candidate, not an automatic choice).
- Mobile app skeleton, package layout, domain package baseline.
- Lint, test and CI scripts from day one. frogs' R-006 ("no test/lint/CI scripts") should not repeat here — this is cheap to set up now and expensive to retrofit later.
- One single version source of truth (frogs never resolved version drift across four files — TapTim.e should decide the mechanism now, e.g. a single `VERSION` file referenced everywhere).

### Sprint 3 – Identity & Data Foundation
- Auth model, Organization/User/Role model, multi-tenant data isolation model.
- Persistence adapter strategy (domain-first per ADR-0006).
- Security rules strategy with rules tests from the start — frogs' shared-default-password issue (R-004/R-005) came from provisioning logic that shipped without a security-first review. Build the provisioning path with that failure mode in mind from the outset.
- Start the Compliance & Legal Foundation (Sprint 7 below) in parallel from here, not after implementation.

### Sprint 4 – Work Event Engine
- Work event model, Business Engine start/stop decision logic, Time Entry state model.
- Unit tests for core rules (this is the one place where testability was designed in from ADR-0005/0006 — cash in on that now).
- Manual trigger fallback.

### Sprint 5 – NFC Engine
- NFC capability abstraction, NFC assignment workflow.
- Strict adherence to ADR-0001's directory strategy — frogs ended up with duplicate root-level and `utils/`-level copies of `_layout.jsx`, `scan.jsx`, `db.js`, `nfcService.js`, `permissions.js` (its own BUG-008). Enforce one location per module from the first commit.
- Android real-device validation plan defined before, not after, implementation.

### Sprint 6 – Offline Sync Foundation
- Local event queue, sync state model, conflict handling.
- Offline/online test scenarios.

### Sprint 7 – Compliance & Legal Foundation (new, run in parallel starting Sprint 3)
- Data inventory equivalent to frogs' `COMPLIANCE/Dateninventar.md`, adapted for multi-tenant SaaS.
- Data Processing Agreement (Auftragsverarbeitungsvertrag, Art. 28 GDPR) template for customers — TapTim.e is the processor, the customer company is the controller. This is structurally different from frogs' single-controller privacy policy and cannot reuse it directly.
- Sub-processor list (hosting/Firebase region, etc.).
- Retention and deletion concept.
- Works-council-readiness package (see Section 4) so sales conversations with customers that have a Betriebsrat aren't blocked later.

### Sprint 8 – Pilot / Design Partner Validation
- Recommendation: use `frogs. Nachhilfe UG` itself as the first real pilot customer. Tim already owns that business relationship, it already runs a comparable NFC time-tracking workflow, and it gives TapTim.e a real multi-tenant conversion test without a cold sales process.
- Real device NFC test matrix, executed the way frogs' `RR-001_NFC_Test_Protocol.md` was designed but actually run this time, not left open.

### Sprint 9 – Release Candidate Hardening
- Mirror frogs' Release Readiness Checklist model, but proactively: device matrix, Firestore/security rules test, load test, security review — done before RC is declared, not discovered as blockers afterward.

### Sprint 10 – GA Release v1
- First paying or contractually confirmed customer beyond the pilot.
- Evidence package written back to `fdos-genesis/04_Evidence/` (see Section 3), closing the FDOS learning loop the same way frogs' evidence already does.

---

## 3. Agent Model for FDOS-Conform Work

FDOS Core (`fdos-genesis/01_AI/`) formally defines two agent constitutions plus a collaboration standard:

- **Development Agent** — transforms validated organizational knowledge into working software. Execution-focused, does not define organizational truth.
- **Research Agent** — transforms validated project evidence into organizational knowledge candidates. Does not touch implementation.
- **AI Collaboration Standard** — Human Governance → Development Agent → Project ADO → Research Agent → Knowledge Candidate → Proposal → Human Review → FDOS Core.

TapTim.e's own `AI_Technical_Lead_Charter.md` additionally defines an **AI Technical Lead** role (architecture ownership, Blueprint/ADR quality, critical review of decisions) that has no equivalent chapter in `fdos-genesis`. This is a real gap: the role exists and is working in practice (this chat has been operating as it) but isn't yet formalized at FDOS Core level. Recommendation: once this role has proven itself across another sprint or two, write it back to `fdos-genesis/01_AI/` as a new constitution chapter — that is exactly the Research Agent's job, and exactly the kind of evidence-to-standard promotion FDOS is designed for.

Practical agent setup from here:

1. **Human Architect (Tim)** — vision, business decisions, final approval. Unchanged.
2. **AI Technical Lead (this chat)** — architecture, ADRs, Blueprint review, continuity across sessions. Keep using it for exactly this: planning, review, FDOS-conformance checks.
3. **Development Agent** — needed starting Sprint 2. Should run as a separate session/tool (e.g. Claude Code locally, since it needs git push, build tools and a device/emulator this chat's sandbox doesn't have — see the earlier discussion on Cowork's limitations). Important: keep it a distinct role from the Technical Lead. The Charter itself states "Agreement is never automatic" — that check only works if the reviewer isn't the same instance that wrote the code.
4. **Research Agent** — invoke deliberately at sprint/pilot boundaries, not continuously. First real task: the market-pain-analysis task already proposed in `Sprint_1_Product_Architecture.md` under "Research Agent Candidate Task" has not been executed yet. Run it before Sprint 2 stack decision, not after.
5. **No dedicated QA Agent exists in FDOS**, and it shows: frogs' RC is blocked almost entirely on manual device/rules validation that nobody automated. This does not need a new constitution chapter, but Sprint 2's CI setup should absorb this responsibility explicitly rather than leaving it implicit.
6. **Legal/compliance review remains human-owned.** GDPR processor agreements and Betriebsrat-facing material should be reviewed by a lawyer before being sent to a customer — no agent role should be assumed to cover this.

---

## 4. Content / Idea Gaps to Close

Ordered roughly by urgency:

1. **ADR-0007 (Tech Stack)** — blocks Sprint 2 entirely. Currently "Not Decided."
2. **Broken reference**: `NFC_Assignment_Model.md` is cited by ADR-0002 and Sprint 1 docs but does not exist as a file.
3. **Multi-tenant data isolation model** — `Organization` is currently just a "Draft" row in the Domain Model table with no dedicated model or ADR. This needs to exist before Sprint 3 starts, not during it.
4. **Privacy/legal foundation for a processor (not controller) model** — nothing exists yet for TapTim.e. frogs' legal docs are useful templates but built on the wrong legal role (controller vs. processor).
5. **Works-council (Betriebsrat) readiness** — not mentioned anywhere in either project. Under German law (§ 87 Abs. 1 Nr. 6 BetrVG), no employee monitoring-capable system can be introduced at a customer with a works council without its consent. TapTim.e should ship template co-determination material as a sales enabler, not scramble for it during a deal.
6. **iOS NFC decision** — explicitly open in `NFC_Capability_Model.md`. Needs its own ADR before Sprint 5, since it affects scope, UX and possibly excludes iOS from v1.
7. **Market/competitive research** — NFC-based time tracking is an established category (TimeDock since 2012, Connecteam, TimeTac, Ficha.Work, Jibble, OpenTimeClock). The Research Agent task proposed in Sprint 1 to analyze this has not been run. Differentiation needs to be explicit and evidence-based, not assumed.
8. **Pricing/monetization model** — not addressed anywhere; deferred under "billing/governance later" in the Role Model. Fine to defer implementation, but the model should be sketched before GA.
9. **Single version-of-truth mechanism** — decide now, before any code exists, exactly to avoid the four-way version drift (`package.json`/`app.json`/README/ADO) that frogs never resolved.

---

## 5. Recommended Project Structure Going Forward

- Keep governance and architecture (ADO, Blueprints, ADRs, this review) in this chat/session — it has direct file access to both repos and is well suited to documentation-heavy work.
- Move implementation (Sprint 2 onward) to a proper development environment with git push access, a build toolchain and eventually a physical Android device — this sandbox cannot do any of that (confirmed: no SSH access for git push/pull, no emulator, no device).
- Treat `frogs-zeiterfassung` as a pattern/evidence library, not a dependency: port lessons (NFC lifecycle handling, Firebase auth patterns, what broke and why) rather than code.
- Run the Compliance & Legal Foundation in parallel with engineering from Sprint 3, not as a pre-release scramble.
- Use `frogs. Nachhilfe UG` as the first pilot/design-partner customer to validate the multi-tenant conversion with a real, already-trusted business relationship.
- Close the loop back into `fdos-genesis`: once TapTim.e produces real evidence (pilot results, the AI Technical Lead role, any validated pattern), write it back as Knowledge Candidates the same way `04_Evidence/frogs/` already does. This is the mechanism that makes FDOS worth the overhead — use it, don't let it stay one-directional.
- Keep commit granularity coarser for documentation-only changes; the discipline is more valuable than the commit count.

---

## 6. Competitive Hardening — Response to EV-0003

Cross-checking `ADO/05_Evidence/EV-0003-time-tracking-market-research.md` against the current architecture: most named competitor failure modes are already structurally addressed. A few are not addressed at all and should become explicit decisions before Sprint 4–5, not left implicit.

### Already ahead by design — no change needed, just execution discipline
- **Offline reliability** (ADR-0004) already targets the exact failure that makes Connecteam a dealbreaker for field teams. Execution quality in Sprint 6 is what matters now, not the decision itself.
- **Narrow v1 scope** (ADR-0003) already avoids the feature-creep clutter that hurts Connecteam's and general full-suite tools' core UX. Keep enforcing this through Feature Blueprint Quality Gates as features get proposed.
- **NFC-first, low-friction trigger** already targets the single largest quantified pain point in the market (forgotten manual clock-ins). No architectural change needed; this is the product's central bet and the evidence supports it.
- **Mobile-only v1** sidesteps the "mobile app treated as second-class citizen" pattern seen at Clockify simply by not having a competing desktop product yet. Worth a note for whenever a web admin dashboard is added later: don't let it outrank the mobile clock-in experience in investment.

### Recognized but unresolved — should be closed before Sprint 4–5
- **Duplicate/conflicting scan handling.** `Domain_Model.md`'s own open questions already ask "How should duplicate scans be handled?" and "Can a scan both start and stop time depending on current state?" — this is exactly the failure mode behind Toggl's and Clockify's duplicate-entry complaints. Recommendation: resolve this as explicit Business Engine decision logic in Sprint 4 (Work Event Engine), with idempotency and duplicate-scan acceptance criteria written into that sprint's Feature Blueprint — not deferred to Sprint 6 sync work, since it's a business rule, not a sync problem.
- **Reporting/export quality.** Currently scoped as "basic export/reporting" in ADR-0003. TimeDock — the closest direct precedent, 92% satisfaction — is criticized specifically for weak reporting. If TapTime repeats "basic" reporting as an afterthought, it inherits the one real weakness of the product most similar to its own approach. Recommendation: treat v1 reporting as a genuine quality bar, not a checkbox.

### Not addressed at all — new gaps worth adding now
- **"Forgot to stop" safety net.** NFC solves forgetting to start (physical trigger) but does less for forgetting to stop, which is the other half of the missed-punch cost cited in EV-0003. Recommendation: consider a lightweight, non-GPS concept — e.g. a local reminder/notification after a session has been open unusually long — as a Domain concept for a future sprint. This does not conflict with "GPS tracking as primary feature: out of scope" since it requires no location data, only elapsed time on an open Work Event.
- **Pricing trust principle.** No pricing model exists yet, and none is urgent to build, but EV-0003 shows that opaque pricing and sudden hikes (Harvest's 600% increase) or paywalled core features (Clockify) cause lasting trust damage. Recommendation: write a short, non-binding Pricing Principle now — e.g. "core time tracking is never feature-gated; pricing changes are never retroactive on existing customers" — cheap to commit to early, expensive to promise credibly after a bad precedent.
- **Audit trail framing as protection, not surveillance.** Product Principle "Everything is Auditable" is currently written as an architectural rule. EV-0003 shows employee monitoring resentment is real but largely avoidable through transparent framing (92% acceptance when positioned as benefiting the employee). Recommendation: add a line to `Product_Principles.md` or a future UX guideline stating that audit trail and time records must be presented to employees as protection of their logged hours and pay accuracy, not oversight — this is a copy/onboarding decision that needs to exist before any UI is designed, not after.

### Answer to the underlying question
TapTime is not facing the same problems as most competitors, by construction — the architecture already made the right bets on offline-first, narrow scope and NFC-as-primary-trigger before this research existed, and the evidence retroactively supports those bets rather than contradicting them. The real risk is not the big architectural decisions; it's the smaller, still-open items above (duplicate scan handling, reporting quality, pricing trust, monitoring framing) that could quietly reintroduce competitor-grade problems if left as afterthoughts.
