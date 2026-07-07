# Product Readiness Assessment

Role: Research / Implementation Support acting on behalf of Technical Lead (per AGR-001)
Date: 2026-07-07
Repository State Verified Against: `main` at commit `7bea186` (Development Sprint 010, DT-015 Local Persistence Foundation), governance closure current through `DEV-SPRINT-010`
Scope: Product Readiness Assessment only. Complements, does not replace, the existing engineering process (Development Sprints, EP-008, MVP Readiness Assessment). No code implemented. No architecture, ADR, TTAP-001, FB-001, TS-001, Product Vision, or EP-008 content modified. No repository file other than this assessment and its companion roadmap was created or changed.

---

## 0. How to Read This Assessment

This assessment answers a different question than every prior evidence document in this repository. The `Repository_Readiness_Assessment.md` (2026-07-03) asked whether the repository was ready for engineering to *begin*. The `MVP_Readiness_Assessment.md` (2026-07-05) asked what remained before a demo could show the full user journey end to end. Both questions are now substantially answered: ten Development Sprints are Completed, the Business Core (NFC scan through WorkEvent, Business Engine decision, TimeEntry, offline queue, durable local persistence, error categorization) is real, tested (154 `packages/core` tests, all green) and reviewed. This assessment asks the next question: **what does TapTim.e still need before it is a professional commercial SaaS product that a real company can buy, run and depend on?** Engineering Readiness is therefore one of ten categories below, not the whole assessment — and, measured against the other nine, it is by a wide margin the most mature.

The short version, stated once here so it does not need repeating in every category: TapTim.e has built an unusually disciplined, well-governed engineering core, and has built almost nothing of the commercial product around it yet. That is not a criticism of the engineering work — it is a description of what an engineering-first roadmap correctly produces at this stage — but it means the work remaining to reach "professional commercial software product" is now concentrated almost entirely outside `packages/core` and outside this repository's existing Development Sprint model.

### 0.1 Strategic Frame: A Business Event Platform, Not a Time Tracking App

Repository evidence is explicit that TapTim.e's long-term identity is broader than the feature that has been built first. `Product_Vision.md` Section 2 states this directly: "TapTim.e entwickelt sich langfristig zu einer Plattform für Arbeitsereignisse, deren erste Kernanwendung die Zeiterfassung ist" — TapTim.e develops long-term into a platform for work events (business events), whose first core application is time tracking. Section 6 ("Langfristige Vision") repeats the same structure regardless of trigger mechanism: "Ein Ereignis wird erfasst. Die Business Engine interpretiert das Ereignis. Das System trifft nachvollziehbare Entscheidungen." (An event is captured. The Business Engine interprets the event. The system makes traceable decisions.) This assessment therefore evaluates readiness against that stated long-term identity, not only against the currently-shipped time-tracking feature — NFC is repository-evidenced as the first trigger mechanism, not the product's domain (`Product_Principles.md` Principle 6: "NFC is a Primary Trigger, Not the Domain"; ADR-0005: "TapTim.e will use an event-driven business engine... This structure separates user input, business interpretation and persistent records. It allows the product to support future triggers without rewriting time tracking rules").

Read this way, the Business Engine (`packages/core/src/business/BusinessEngine.ts` and its supporting `BusinessEngineDecision`/classification types) is not merely one component among eleven in TS-001's Architecture Flow — it is the strategic center of the product: the one component ADR-0005 names as the thing that must never be bypassed regardless of which trigger produced the event, and the one piece of the architecture every category below ultimately depends on remaining trigger-agnostic. Every finding in this assessment that reads as "NFC-specific" (real hardware integration, tag registration, the scan-to-WorkEvent flow) is, by the repository's own design intent, actually a finding about the *first* instance of a trigger-to-Business-Event pipeline that is meant to generalize. Section 12 below (Capability Perspective) makes this generalization explicit as a capability hierarchy, and Section 11.1 (added in this revision) revisits the assessment's original primary-bottleneck conclusion with this same frame in mind.

---

## 1. Engineering Readiness

### Current State

Strong, and the most mature category in this assessment. Ten Development Sprints are Completed with Review Agent verification and Human Architect approval recorded for each (DEV-SPRINT-001 through DEV-SPRINT-010 in the Decision Log, excepting DEV-SPRINT-002 and DEV-SPRINT-004, which remain implemented-but-unreviewed). The full NFC-scan-to-TimeEntry pipeline (`NfcScanAdapter -> NfcScanApplicationService -> AssignmentResolver -> AssignmentValidator -> WorkEventFactory -> BusinessEngine -> TimeEntryGenerator -> WorkEventRepository -> OfflineQueue -> SynchronizationService -> ScanResultPresenter`) named in TS-001 is fully implemented at the component level. Authentication/session foundation (DT-013/DT-014), error categorization (DT-009) and durable local persistence (DT-015) have all been added on top of that core. `packages/core` has zero runtime dependencies; `apps/mobile` is a working Expo/React Native app depending on it.

Notably for the platform's long-term identity (Section 0.1), the Business Engine sits at the architectural center of this maturity, not NFC. Every other component in TS-001's Architecture Flow either produces an input the Business Engine consumes (`NfcScanAdapter` through `WorkEventFactory`) or acts on an output it produces (`TimeEntryGenerator` through `ScanResultPresenter`); the Business Engine itself has no dependency on NFC, React Native, or any persistence API (verified across every Development Sprint's Role Handover since Sprint 001, and re-confirmed as recently as DT-015's closure, which changed a storage technology with zero changes to `BusinessEngine.ts`). This is the concrete engineering evidence behind ADR-0005's claim that the product can "support future triggers without rewriting time tracking rules" — the Business Engine has already been proven, across ten sprints of surrounding change, to be the stable center the Product Vision's long-term "Business Event Platform" framing requires it to be.

### Repository Evidence

154 `packages/core` tests pass; `npm run typecheck` is clean for both `packages/core` and `apps/mobile` (verified this session). `ADO/00_Core/Decision_Log.md` records ten `DEV-SPRINT-00X` rows, nine as "Completed." `ADO/02_Development/EP-007_Development_Tasks.md` documents DT-001 through DT-015 with explicit Acceptance Criteria and Implementation Notes. `ADO/01_Architecture/Developer_Implementation_Manual/` Chapters 00–03 document implemented reality through Development Sprint 010.

### Missing Capabilities

Development Sprint 002 (DT-004/DT-005/DT-006) and Development Sprint 004 (DT-008) remain implemented but never Review-Agent-verified or Human-Architect-approved. Development Sprint 005's composition-root/`ScanResultPresenter` narrative has never been synchronized into EP-008's Chapters 00–03 (status only). Finding F-01 (the duplicate-scan/toggle rule — how a second scan of the same tag stops rather than escalates) remains an open Human Architect product decision; without it, the Business Engine can only ever "start" a session, never coherently "stop" one, which is a direct gap against Product Principle 1 ("One Tap. One Decision.") for any session longer than a single scan. `DT-010` (Tests) has no explicit "Status:" line in `EP-007_Development_Tasks.md`, unlike every other Development Task, despite having substantial recorded coverage. `ErrorCategory` (DT-009) is observability-only — nothing in the system yet acts differently based on a category. The local persistence adapters (DT-015) have no concurrency/locking or atomic-write protection, by explicit, documented design choice for this sprint only.

### Business Impact

Low immediate business impact — none of these gaps block further engineering work, and none represent an architectural defect. The compounding risk is that unreviewed Development Sprints and unsynchronized EP-008 narrative accumulate the longer they are deferred, and Finding F-01 is the one open item in this category with a direct, visible product consequence (a demo cannot show a full start/stop cycle for one tag) if a real customer is shown the product before it is resolved.

### Recommended Priority

Medium. High only for Finding F-01, which should be resolved before any pilot customer is shown the product.

### Recommended Owner

Technical Lead (governance backlog); Human Architect (Finding F-01, a product decision).

### Estimated Timing

Now / ongoing housekeeping (governance backlog); Finding F-01 before Pilot Customers.

---

## 2. Technical Operations Readiness

### Current State

Effectively nonexistent. There is no CI/CD pipeline, no deployment infrastructure, no environment separation, and no operational tooling of any kind.

### Repository Evidence

`.github/workflows/` contains only `.gitkeep` — no GitHub Actions workflow file exists, so no test, typecheck, lint, or build step runs automatically on any commit or pull request today, despite `CONTRIBUTING.md` describing a pull-request-based workflow and `main` being described as "protected." `infrastructure/` contains only `.gitkeep` (per ADR-0001's own repository strategy, this folder is reserved for "Cloud, deployment and environment assets later" — that "later" has not arrived). `scripts/` and `tests/` (the root-level, cross-cutting one, distinct from `packages/core/tests`) also contain only `.gitkeep`. No Dockerfile, docker-compose file, or infrastructure-as-code of any kind exists anywhere in the repository (verified by direct search). No `.env`/environment-configuration file exists for any of dev/staging/production. `apps/mobile/app.json` has no `ios.bundleIdentifier` or `android.package` set — the app is not yet configured to be built for any app store target. No monitoring, logging aggregation, error-tracking (e.g. Sentry), or alerting integration exists in either `packages/core` or `apps/mobile`.

### Missing Capabilities

A CI pipeline (at minimum: typecheck + test on every PR, matching what `CONTRIBUTING.md` already implies exists); a deployment pipeline for whichever backend technology is eventually chosen (ADR-0007 defers this); environment separation (dev/staging/production) for both the backend and the mobile app's configuration; secrets management; infrastructure-as-code for whatever hosting model is chosen; crash reporting and error tracking for the mobile app; structured logging and log aggregation for any backend service; a backup and disaster-recovery strategy for durable data once real (non-file, non-in-memory) persistence exists; branch protection rules on `main` (described in `CONTRIBUTING.md` but not verified from a local clone — this assessment cannot confirm whether GitHub's actual repository settings match the documented policy).

### Business Impact

High and rising. Every day the product runs without CI is a day a regression can reach `main` unnoticed (there is currently no automated gate at all — verification depends entirely on a human or agent remembering to run `npm run test`/`npm run typecheck` manually, which every Development Sprint closure in this repository has in fact done, but which is not enforced). Before any pilot customer relies on the product even informally, the complete absence of monitoring means an outage or data-loss event would be discovered by the customer, not by the team.

### Recommended Priority

Critical for CI (near-zero cost, prevents regressions immediately); High for deployment/monitoring (blocks any real customer-facing pilot).

### Recommended Owner

Technical Lead / Development Agent for CI; Technical Lead + Human Architect (backend technology decision) for deployment infrastructure.

### Estimated Timing

CI: Now. Deployment pipeline, environment separation, monitoring: Before Pilot Customers.

---

## 3. Product Readiness

### Current State

Partial and narrow. The single implemented feature (FB-001/TS-001, "NFC Scan Creates Work Event") works end to end for the "first scan, no active session" case, using a fake/CLI-simulated NFC input rather than a real device scan. Nothing beyond that one feature exists.

Consistent with Section 0.1's framing, it is important not to read this narrowness as an "NFC feature is incomplete" problem. The missing capabilities below are overwhelmingly not NFC-specific — they are the Organization/Identity/Asset management layer that any trigger (NFC today, QR codes, manual entry, API calls or other future triggers per `Domain_Model.md`'s own "Core Domain Idea") would need in order to resolve to a real business context. Section 12 (Capability Perspective) restates this same gap as a capability hierarchy rather than a feature list.

### Repository Evidence

`ADR-0003` (Product Scope v1) lists as **In Scope for v1**: "Organization account," "User authentication," "Basic role model," "Employee users," "Customer records," "NFC tag registration," "NFC tag assignment to customers," "...Own time overview for employees," "Basic admin overview," "Basic export/reporting," in addition to the scan-to-time-entry flow itself. Of this list, only authentication (partially — DT-013/DT-014, fake provider) and the scan-to-time-entry flow have any implementation. Organization account management, customer record management, NFC tag registration/assignment management (as opposed to assignment *resolution*, which is implemented), any time overview, any admin overview, and any export/reporting have **zero** implementation and, more significantly, **no Feature Blueprint or Technical Specification exists for any of them** — TTAP-001/FB-001/TS-001 cover only the scan-to-WorkEvent-to-TimeEntry flow. This is a real, evidenced gap between ADR-0003's approved v1 scope and the architecture layer (TTAP-001/FB-001/TS-001) that is supposed to translate that scope into buildable specifications — not an engineering oversight, but an unfinished architecture-coverage question for the Human Architect/Technical Lead. `Domain_Model.md`, `Role_Model.md`, `System_Overview.md`, and `NFC_Capability_Model.md` are all still `Status: Sprint 1 Draft`, dated 2026-06-26, unchanged despite ten Development Sprints of implementation since.

### Missing Capabilities

An Organization onboarding/setup flow (create an organization, invite users, assign roles — today `CallerContext`/`SessionService` assume a pre-existing, hard-coded Organization and User). A Customer/AssignmentTarget management UI or API (today assignments exist only as pre-seeded demo fixtures; nothing lets an Administrator create a Customer or assign an NFC tag to it). An NFC tag registration/provisioning flow (nothing writes or registers a physical tag; `NFC_Capability_Model.md`'s own "Open Technical Questions" — "Do we need tag provisioning inside the app? Should tags be writeable or read-only?" — remain unanswered). Real NFC hardware integration (`apps/mobile/package.json` has no `react-native-nfc-manager` or equivalent native NFC dependency; only `FakeNfcScanAdapter`/`CliNfcScanAdapter` exist). A "view own time entries" screen (named as a v1 permission in `Role_Model.md` for every role; zero implementation anywhere). A basic admin/reporting/export capability (named in ADR-0003; zero implementation, and no architecture artifact defines it). Resolution of Finding F-01 (see Section 1). Multi-organization/multi-tenant behavior has never been exercised outside a single hard-coded demo Organization.

### Business Impact

Critical. Today's product cannot be handed to a real Administrator to configure (no way to add a customer, register a tag, or invite an employee) or to a real Employee to use meaningfully beyond a single demo scan (no way to see the result of their own work). The core "One Tap. One Decision." promise is real and provably works, but it is currently surrounded by nothing a non-technical user could operate.

### Recommended Priority

Critical — this is the largest single gap between "impressive engineering demo" and "usable product."

### Recommended Owner

Human Architect (scope/prioritization decision: which of Organization onboarding, Customer/tag management, or viewing should come first) and Technical Lead (translating the chosen scope into new Feature Blueprints/Technical Specifications, since none currently exist for this work).

### Estimated Timing

Organization/Customer/tag management and a minimal viewing capability: Before Pilot Customers. Admin/export/reporting: Before First Paying Customers, unless a pilot customer specifically requires it earlier.

---

## 4. Commercial Readiness

### Current State

Not started. No pricing, packaging, billing, or subscription mechanism exists in any form, documented or implemented.

### Repository Evidence

`Role_Model.md` explicitly defers this: "System Owner — ...billing/governance later." ADR-0003 explicitly excludes "Advanced billing" from v1 scope but does not define what *basic* billing (if any) v1 requires, and no ADR, Feature Blueprint or Development Task addresses billing, subscription tiers, seat-based pricing, or payment processing at any level, minimal or otherwise. `Product_Vision.md` defines mission and long-term vision but does not address monetization or pricing model.

### Missing Capabilities

A pricing model and packaging decision (per-seat, per-organization, per-tag, usage-based, or otherwise). A billing/subscription system or third-party billing integration (e.g. Stripe Billing) if a self-serve model is intended. A trial/pilot-to-paid conversion mechanism. An invoicing or payment-collection flow if sales-assisted. A defined free tier or trial period, if any. Contract/terms-of-service framework for a paying customer relationship (see also Section 5).

### Business Impact

Critical for any first paying customer, but not blocking for pilot customers if pilots are run without payment (common for early-stage B2B SaaS validation). The absence of even a documented pricing hypothesis makes it impossible to have a commercial conversation with a prospective customer today.

### Recommended Priority

High, but sequenced after Product Readiness (Section 3) — pricing a product that cannot yet be configured or used by a real Administrator is premature.

### Recommended Owner

Human Architect (business model decision), with Technical Lead input on billing integration feasibility once a technology/backend decision is made.

### Estimated Timing

Pricing/packaging hypothesis: Before Pilot Customers (can be validated informally without code). Billing/subscription implementation: Before First Paying Customers.

---

## 5. Legal & Compliance Readiness

### Current State

Not started. No legal, privacy, or compliance artifact of any kind exists in the repository.

### Repository Evidence

No `LICENSE` file exists anywhere in the repository (verified by direct search). No Terms of Service, Privacy Policy, Data Processing Agreement (DPA) template, or cookie/consent documentation exists. No `SECURITY.md` exists. `Product_Vision.md`'s Mission and Vision sections are written in German and describe a product for German/DACH-region small and medium-sized businesses tracking employee work time — this is a domain (workplace time tracking) that is directly subject to GDPR (employee time and location data is personal data) and, in Germany specifically, typically subject to Betriebsrat (works council) co-determination rights under §87 BetrVG when an employer introduces technical systems capable of monitoring employee behavior — neither GDPR data-processing documentation nor any note acknowledging the Betriebsrat/co-determination question appears anywhere in the repository. TTAP-001 and TS-001 both list "security enforcement"/"Security Requirements" as backend responsibilities in the abstract ("user must be authenticated," "organization context must be verified") but neither defines a concrete data retention policy, data residency commitment, or breach-notification process. `ADR-0007`'s "backend platform" section requires "security rule enforcement" and "operational auditability" but does not commit to a specific compliance framework (e.g. GDPR Article 28 processor obligations, SOC 2, ISO 27001).

### Missing Capabilities

A software license decision for the repository itself (currently unlicensed, which by default means no one outside the copyright holder has any usage rights — worth an explicit decision even if the product is not open-sourced). Terms of Service and a Privacy Policy for end users and customer organizations. A GDPR-compliant data processing basis and documentation, given the product processes employee time/location-adjacent data for EU-domiciled SMBs. A data retention and deletion policy (how long is scan/rejection "evidence," per `NFC_Capability_Model.md`'s own "Audit Principle," retained, and how is it deleted on request). A data processing agreement template for B2B customers (standard requirement for any GDPR-relevant SaaS sold to EU businesses). Explicit acknowledgment and guidance for customers regarding works council/employee-representation approval requirements before deploying a time-tracking system that could be construed as monitoring (a German-market-specific but material legal consideration given the product's stated mission and language). A defined data residency commitment once a real backend/cloud provider is chosen (relevant to the still-open ADR-0007 backend decision).

### Business Impact

Critical and currently the least-visible risk in the repository, because it requires no code to become urgent — a single pilot customer processing real employee data without any of this in place is a genuine legal exposure for both TapTim.e and the pilot customer, particularly given the German/EU market context and the works-council consideration specific to employee time-tracking systems.

### Recommended Priority

Critical — should be addressed in parallel with, not after, Product Readiness work, since it does not depend on further engineering and the risk is present from the very first pilot.

### Recommended Owner

Human Architect, with external legal counsel (this is explicitly outside any engineering role's competence, including this assessment's own).

### Estimated Timing

License decision, and at minimum a placeholder Privacy Policy/Terms of Service: Now/Before Pilot Customers. Full GDPR documentation, DPA template, and works-council guidance: Before Pilot Customers (not after) given the employee-data and German-market context. Formal compliance certification (SOC 2/ISO 27001), if pursued at all: Before 100 Customers, typically driven by customer procurement requirements at that scale.

---

## 6. Deployment Readiness

### Current State

Not started beyond the architectural decision to eventually have a deployment. No backend exists to deploy, no mobile build/release pipeline exists, and no hosting decision has been made.

### Repository Evidence

ADR-0007 defers "the exact implementation libraries and service configuration" for the backend to "Technical Specification and Development Tasks," and this has not yet happened for anything beyond the fake/local adapters built in Development Sprints 001–010. `apps/mobile/app.json` has no `ios.bundleIdentifier`, no `android.package`, and no EAS (Expo Application Services) or other build-service configuration — the app cannot currently be submitted to the Apple App Store or Google Play Store in its present configuration. No backend hosting target (Firebase, a custom cloud provider, or otherwise) has been chosen; `System_Overview.md`'s own "Open Questions" ("Backend model: Firebase-only, serverless functions or custom backend?") remain unresolved since Sprint 1, unchanged through ten Development Sprints. Section 2 (Technical Operations Readiness) covers the CI/CD and infrastructure gap in more depth; this section focuses on the release/distribution mechanics specifically.

### Missing Capabilities

A concrete backend hosting decision (this single decision also unblocks Technical Operations Readiness's deployment pipeline and Scaling Readiness, Section 10 — it is the most consequential single undecided item across three of the ten categories in this assessment). App store developer accounts (Apple Developer Program, Google Play Console) and app identifiers. A mobile release pipeline (e.g. EAS Build/Submit, or an equivalent) capable of producing installable builds for pilot users without requiring a locally-run `expo start`. A versioning and release-notes process for both the mobile app and any backend service. A rollback strategy for a bad release. Over-the-air update capability (Expo supports this natively) or an explicit decision not to use it.

### Business Impact

Critical for reaching any pilot user who is not physically handed a development machine — today, the only way to run the mobile app is `expo start` from a local clone (`npm run android`/`ios`/`web` in `apps/mobile/package.json`), which is a developer workflow, not a distribution mechanism.

### Recommended Priority

Critical — this is a hard blocker for any pilot beyond the current engineering team.

### Recommended Owner

Human Architect (backend technology decision), Technical Lead / Development Agent (build pipeline, app store setup).

### Estimated Timing

Before Pilot Customers.

---

## 7. Go-To-Market Readiness

### Current State

Not started. No market-facing material of any kind exists in this repository (which is appropriate for an engineering repository, but the assessment notes the complete absence since GTM readiness was explicitly requested).

### Repository Evidence

`Product_Vision.md` defines a target market ("kleine und mittelständische Unternehmen" / small and medium-sized businesses) and a differentiator (NFC-based confirmation) at the mission level, but no market sizing, competitive positioning beyond the internal `frogs-zeiterfassung` technical reference (explicitly not a competitive analysis — `README.md`: "TapTim.e is not a copy of frogs. frogs is treated as evidence and implementation reference only"), ideal-customer-profile definition, or launch plan exists anywhere in the repository.

### Missing Capabilities

A defined ideal customer profile beyond "SMB" (industry, company size range, geography — the teacher/student NFC example in `Domain_Model.md`'s "First Business Scenario" suggests tutoring/education as one plausible initial vertical, but this is a domain-modeling example, not a validated go-to-market decision). Competitive positioning against existing time-tracking products. A marketing website or landing page. Sales collateral or a demo script for prospective customers. A defined pilot-customer acquisition channel (referral, outbound, existing network). Launch messaging distinct from the internal Product Vision document.

### Business Impact

High, but appropriately sequenced last among the commercial categories — GTM material describing a product that cannot yet be configured, installed, or paid for (Sections 3, 4, 6) would be premature and would need to be rewritten once those gaps close.

### Recommended Priority

Medium now (a lightweight ideal-customer-profile and pilot-acquisition-channel decision costs little and can run in parallel); High once Product/Deployment/Commercial Readiness are closer to resolved.

### Recommended Owner

Human Architect.

### Estimated Timing

Ideal customer profile and pilot channel: Before Pilot Customers. Full GTM materials (website, sales collateral, positioning): Before First Paying Customers.

---

## 8. Customer Readiness

### Current State

Not started. There is no path today for a customer organization to begin using TapTim.e independently.

### Repository Evidence

As established in Section 3, no Organization onboarding/signup flow exists — every `CallerContext`/`SessionService` usage in the current codebase constructs or authenticates against a single, hard-coded demo Organization and User. No customer-facing documentation, help center, or in-app guidance exists (the only "documentation" a user could encounter is `ScanResultPresenter`'s plain-text outcome strings, explicitly built as a developer-facing proof, not end-user UX — MVP Readiness Assessment Section 6). No mechanism exists for a customer to self-provision NFC tags, add employees, or configure their own Organization's data.

### Missing Capabilities

A self-serve or sales-assisted Organization onboarding flow. Employee invitation and account setup. A minimal customer-facing help resource (even a simple FAQ or getting-started guide). An in-app first-run/empty-state experience (today the app has no onboarding state at all — it assumes a fully pre-configured demo Organization exists). A defined process for a customer to request their NFC tags to be provisioned, if provisioning remains an admin-mediated process rather than self-service.

### Business Impact

Critical — this is the literal mechanism by which "MVP-B01" (per the MVP Readiness Assessment) style blockers translate into "a real company could actually start using this." Without it, every pilot customer requires bespoke, hands-on setup by the engineering team, which does not scale even to a handful of pilots.

### Recommended Priority

High.

### Recommended Owner

Human Architect (scope decision: sales-assisted vs. self-serve onboarding for early pilots is a reasonable, common choice) and Technical Lead (translating the chosen onboarding model into new Feature Blueprints once decided).

### Estimated Timing

A minimal, even manually-assisted onboarding process: Before Pilot Customers. A polished self-serve flow: Before 100 Customers (manually-assisted onboarding is an entirely reasonable choice for pilots and even early paying customers).

---

## 9. Support Readiness

### Current State

Not started. No customer support process, tooling, or role exists.

### Repository Evidence

`AGR-001` (Agent Registry) and `EOM-001` (Engineering Operating Model) define engineering roles only (Human Architect, Technical Lead, Development Agent, Review Agent, Research Agent, Implementation Support Agent) — no customer support or customer success role exists in any governance artifact. `CONTRIBUTING.md`'s "Reporting Issues" section explicitly states: "Use the issue templates once implementation begins. Until then, log risks and known gaps in `ADO/00_Core/Risk_Register.md`" — this is an internal engineering-issue process, not a customer-support process, and even that internal process is informal (the Risk Register currently has five entries, all engineering/architecture risks from Sprint 1, none updated since).

### Missing Capabilities

A customer support channel (email, chat, or ticketing system). A defined support SLA, even an informal one for pilot customers. Runbooks for common operational incidents (e.g. "a customer's synchronization queue is stuck," "an employee cannot sign in") — none can exist yet in detail since the underlying real backend/sync target does not exist, but the absence should be tracked now so it is not discovered for the first time during a real incident. A status page or incident-communication process. A known-issues/FAQ resource for early customers.

### Business Impact

High once any pilot is running with real users depending on the product daily for time tracking (a business-critical, compliance-adjacent function for the customer) — but zero support process is a normal and acceptable state for a pre-pilot engineering-stage product, so this is not urgent today.

### Recommended Priority

Medium now; High once Pilot Customers begin.

### Recommended Owner

Human Architect (support model decision — likely founder/technical-team-provided support for early pilots, which is standard for early-stage B2B SaaS).

### Estimated Timing

A minimal support channel and pilot-facing communication process: Before Pilot Customers. Formal runbooks, SLAs, and status page: Before First Paying Customers.

---

## 10. Scaling Readiness

### Current State

Not evaluated in practice, and not yet evaluable meaningfully, because no real (non-fake, non-in-memory) backend exists to load-test. The current durable-persistence implementation (DT-015) is explicitly and deliberately scoped to a single-process, single-writer use case.

### Repository Evidence

`Development_Sprint_010_Plan.md` Section 12 (Risks) and `EP-007_Development_Tasks.md`'s DT-015 Implementation Notes both explicitly document: "no concurrency/locking or atomic-write handling... a crash mid-write is not protected against" and "multiple concurrent processes/instances writing to the same file causing a race condition" as an out-of-scope, documented limitation, not an oversight. `FakeSynchronizationGateway` is the only synchronization target that has ever been exercised; no real backend has ever received concurrent writes from more than one simulated user. ADR-0007's backend technology decision (Firebase/Firestore, a custom backend, or otherwise) remains undecided, which means no real answer exists yet to fundamental scaling questions: how is multi-tenant data isolation enforced at the storage layer (today, `Organization` scoping is enforced only in `AssignmentValidator`'s in-process logic, never tested against a real multi-tenant datastore); what is the expected write/read volume per organization; what rate limiting or quota model applies per tenant.

### Missing Capabilities

A chosen, real backend technology capable of concurrent multi-tenant writes (blocked on the same ADR-0007 decision named in Sections 2 and 6). Load testing of the Business Engine/synchronization path under realistic concurrent scan volume (e.g. many employees scanning near-simultaneously across many organizations). A rate-limiting or quota strategy per organization/tenant. A defined data-isolation guarantee tested against a real multi-tenant datastore, not just unit-tested in-process logic. A capacity/cost model for the eventual hosting choice as customer count grows. Horizontal scaling strategy for whatever backend/compute model is eventually chosen.

### Business Impact

Low today (there is no load to handle), rising sharply and specifically once customer count moves from single digits to dozens or more — at that point, the currently-untested assumption that `Organization` boundaries hold under real concurrent multi-tenant load becomes a genuine data-integrity and customer-trust risk if wrong.

### Recommended Priority

Low now; High before scaling past early pilots.

### Recommended Owner

Technical Lead (once the backend technology decision is made by the Human Architect).

### Estimated Timing

Not a blocker Before Pilot Customers or Before First Paying Customers (a handful of low-concurrency pilots can validate the product without this work). Should be substantially addressed Before 100 Customers, and fully load-tested and capacity-planned Before 1,000 Customers.

---

## 11. Cross-Cutting Observation: One Decision Blocks Three Categories

The backend/cloud persistence technology decision that ADR-0007 explicitly deferred at EP-007's founding, and which every Development Sprint since has correctly continued to defer rather than guess at, is now the single most consequential open decision in this assessment. It directly blocks or substantially shapes: Technical Operations Readiness (Section 2 — deployment pipeline, environment separation), Deployment Readiness (Section 6 — where does the mobile app actually talk to), and Scaling Readiness (Section 10 — multi-tenant data isolation and concurrency). This is not a new finding — the MVP Readiness Assessment (2026-07-05) already identified it as the "single largest blocking decision for MVP progress" — but this assessment's broader, ten-category lens makes its downstream reach across the commercial readiness picture, not just the engineering one, more visible. Making this decision does not require completing Product Readiness (Section 3) first; it can and arguably should be made in parallel, since Sections 2, 6 and 10 cannot meaningfully progress without it.

### 11.1 Re-evaluation: Backend Technology Decision vs. Organization Management as the Primary Bottleneck

Technical Lead review of this assessment raised an objective question worth answering directly: is the backend/cloud persistence technology decision (above) really the single largest strategic bottleneck, or does repository evidence point instead to Organization Management — the capability gap already identified as "Critical... the largest single gap between 'impressive engineering demo' and 'usable product'" in Section 3 — as the more fundamental one? Per this assessment's own standing rule, repository evidence decides this, not either party's prior framing.

Evidence supports refining, not reversing, the original conclusion. The two blockers are not in competition for the same milestone — they gate different points on the roadmap, and repository evidence shows Organization Management is the more upstream one:

- **Effort and specification status differ.** The backend technology decision is, by ADR-0007's own design, a single, well-scoped choice: TTAP-001, FB-001 and TS-001 already describe what the backend must do (authentication, durable persistence, synchronization, security enforcement); what remains is naming a concrete provider, not writing new architecture. Organization Management, by contrast, has **no Feature Blueprint or Technical Specification at all** (Section 3) — `TTAP-001`'s Ubiquitous Language already names `Organization` as an Aggregate Root, but no artifact anywhere in the repository defines how an Organization is created, configured, or populated with Users, Customers or NFC tags. Closing this gap requires new specification work before it requires new code, which is a slower, more foundational unblock than "make a technology decision."
- **Milestone dependency differs.** Repository evidence (Section 3, Section 8) shows that no pilot, however minimal, can begin without some way to represent a real Organization, a real Customer/AssignmentTarget and a real NFC tag outside of hard-coded source-code fixtures — today, every `CallerContext`, every assignment, and every demo scenario in `packages/core`'s tests and CLI demo is a fixture written directly in code. The backend technology decision, by contrast, does not block a first, single-device pilot in the same absolute way: Development Sprint 010's file-based durable persistence (DT-015) was built specifically to prove that local durability works today, without the cloud/backend decision having been made, and a single-organization pilot could in principle run on it (with its documented single-writer limitation) while the backend decision is still being finalized in parallel. Organization Management therefore sits earlier on the critical path to the "Before Pilot Customers" milestone than the backend decision does.
- **The backend decision remains the larger blocker for what comes after.** This re-evaluation does not weaken Section 11's original finding — it remains accurate and is not retracted: the backend technology decision is still the single decision that most directly blocks Technical Operations Readiness, Deployment Readiness and Scaling Readiness (Sections 2, 6, 10), and none of that work can proceed meaningfully without it. What changes is the sequencing conclusion: Organization Management is the primary bottleneck for reaching the first pilot at all; the backend technology decision is the primary bottleneck for what a pilot needs to become a durable, scalable commercial product afterward. Both should proceed in parallel — repository evidence gives no reason to sequence one strictly before the other — but if forced to name a single "most consequential" gap for the very next milestone (Before Pilot Customers), Organization Management is the better-supported answer.

This refinement is reflected in the Product Readiness Roadmap's Product Capability Track (see the companion document), where Organization Management is placed first among product-capability items for the Before Pilot Customers milestone, alongside the backend technology decision continuing to lead the Engineering Track for the same milestone.

---

## 12. Capability Perspective

### 12.1 Purpose of This Section

Sections 1–11 evaluate TapTim.e primarily as a set of features and readiness categories. This section adds a second, complementary lens, requested explicitly during Technical Lead review: a capability-oriented view of the same repository evidence. It does not introduce new architecture, and it does not modify TTAP-001, any ADR, or `Product_Vision.md` — it is an assessment-level reading of what those documents already establish, organized as a hierarchy so that future feature requests can be evaluated against "which capability does this extend?" rather than treated as isolated implementation work.

### 12.2 The Capability Hierarchy

Repository evidence (TTAP-001's Ubiquitous Language and Aggregate Roots, `Domain_Model.md`, `Role_Model.md`, ADR-0002, ADR-0005, and Section 0.1's Business Event Platform framing) supports organizing TapTim.e's domain as a layered capability hierarchy, with the long-term platform vision at the top and today's one shipped feature at the bottom:

```text
Business Event Platform
  |
  v
Identity            (who is acting: User, authentication, session)
  |
  v
Organization        (which business account: Organization, roles, membership)
  |
  v
People              (Employee, Admin, Team Lead — Role_Model.md's permission holders)
  |
  v
Assets               (Customer, AssignmentTarget, NfcTag — the things work is tracked against)
  |
  v
NFC                 (the first trigger mechanism — Raw Scan Event, NfcAssignment resolution)
  |
  v
Business Events      (WorkEvent — the normalized, trigger-agnostic business fact)
  |
  v
Business Engine      (interprets Business Events, produces decisions — the strategic center, Section 0.1)
  |
  v
Time Tracking        (TimeEntry — the first Business Engine output/product surface)
```

### 12.3 Current Implementation Status Per Capability Layer

| Capability Layer | Current State | Repository Evidence |
|---|---|---|
| Business Event Platform | Long-term vision only; not yet a distinct architectural layer beyond the time-tracking application. | `Product_Vision.md` Sections 2 and 6. |
| Identity | Partially implemented — real, tested session/authentication flow, but only a fake/local provider (DT-013/DT-014). | `SessionService`, `FakeAuthenticationGateway`, `AuthenticationResult`, `CallerContext`. |
| Organization | Modeled as a domain concept and Aggregate Root only; no creation, configuration or management capability exists. | TTAP-001 Aggregate Roots ("Organization"); `Domain_Model.md` ("Organization | ... | Draft"); Section 3's finding that no Organization onboarding flow exists. |
| People | Role Model fully drafted (System Owner/Administrator/Team Lead/Employee with a permission matrix); only the Employee role has any code-level presence, and only via a hard-coded fixture. | `Role_Model.md` (`Status: Sprint 1 Draft`); no user/role-management code found anywhere in `packages/core`. |
| Assets | NFC assignment model (`NfcTag -> NfcAssignment -> AssignmentTarget`) is well-implemented for *resolution* (`AssignmentResolver`); no registration/management capability exists for creating a Customer or assigning a tag. | ADR-0002; `AssignmentResolver.ts`; Section 3's finding on missing tag registration/management. |
| NFC | Implemented as a fake/CLI-simulated trigger only; no real hardware/native module integration exists. | `FakeNfcScanAdapter`, `CliNfcScanAdapter`; Section 3's finding on missing `react-native-nfc-manager`-equivalent dependency. |
| Business Events | Fully implemented — `WorkEvent` creation from a valid, resolved and validated trigger, trigger-agnostic by design. | `WorkEventFactory.ts`, `WorkEventCreated` domain event. |
| Business Engine | Fully implemented and the most mature layer in the entire hierarchy — trigger-independent, extensively tested, proven stable across ten Development Sprints of surrounding change (Section 1). | `BusinessEngine.ts`, `BusinessEngineDecision.ts`, Section 1 (this document). |
| Time Tracking | Implemented for the "start" outcome only; the "stop" outcome remains blocked by the still-open Finding F-01 (Section 1). | `TimeEntryGenerator`, `TimeEntry`; Finding F-01 (Sections 1, 3). |

### 12.4 Why This View Matters for Future Feature Work

The capability hierarchy makes an implicit repository principle explicit: every capability layer above Time Tracking already exists conceptually or partially in code, and every future feature request should be evaluated first against "which layer does this extend?" rather than built as a standalone feature. For example: a future "view own time entries" screen (Section 3, Section 8) is not merely a UI feature — it is the first read-oriented capability at the Time Tracking / Business Events boundary, and should be built as an extension of those layers' existing types rather than a new, parallel query mechanism. A future QR-code trigger (explicitly anticipated by `Domain_Model.md`'s "Core Domain Idea" and ADR-0005's "future triggers") is not a new domain — it is a second implementation of the NFC layer's existing trigger contract, sitting below the same, unchanged Business Events / Business Engine layers. This reasoning directly supports Section 0.1's Business Event Platform framing and Section 3's caution against reading TapTim.e's current gaps as "NFC feature gaps": the gaps are concentrated in the Identity/Organization/People/Assets layers, which are prerequisites for *any* future capability the platform adds, not just for NFC-based time tracking specifically. This does not change TTAP-001, any ADR, or `Product_Vision.md` — it is offered here as an assessment-level lens for the Human Architect/Technical Lead to apply when scoping future Feature Blueprints, consistent with TTAP-001's own "Extend before Create" principle.

---

## 13. Business Readiness — Should It Be a Separate Category?

Technical Lead review asked whether Commercial Readiness (Section 4) should remain a single category, or whether repository evidence supports splitting out a distinct "Business Readiness" category covering Ideal Customer Profile, Customer Problem, Business Value/ROI, Competitive Position, Pilot Strategy, Market Validation, Decision Makers and Buying Process.

**Finding: repository evidence is insufficient to populate a Business Readiness category with the same evidentiary rigor as the other ten, and this assessment explicitly declines to invent that content rather than assess it from evidence that does not exist.** What the repository does establish, at the Product Vision level, is a Mission and Problem statement (`Product_Vision.md` Sections 1 and 3 — administrative burden, error-prone manual time tracking, and workflow interruption as the customer problem) and an implicit customer profile (small and medium-sized businesses, per Section 2's Vision statement, with `Domain_Model.md`'s teacher/student scenario suggesting tutoring/education as one illustrative vertical). This is real evidence, and it already appears in Section 7 (Go-To-Market Readiness) of this assessment. Beyond it, no repository artifact addresses Business Value/ROI quantification, competitive positioning against named alternatives, a documented pilot strategy, market validation evidence (e.g. customer interviews, letters of intent), a defined decision-maker/buyer persona within a prospective customer organization, or a buying-process/procurement-cycle expectation.

Given this, the more defensible conclusion is: **do not create a separate Business Readiness category populated with assessment content the repository cannot support.** Doing so would require this assessment to originate business strategy rather than evaluate it against evidence — exactly what this task's own rules forbid ("Do not invent business strategy"). Instead, this section is retained as a placeholder marker: if and when the Human Architect produces the underlying artifacts (a documented Ideal Customer Profile, a competitive analysis, pilot-strategy notes, market-validation evidence), a future reassessment (Section 15) should promote this into a full tenth-plus category with the same Current State / Repository Evidence / Missing Capabilities / Business Impact / Recommended Priority / Recommended Owner / Estimated Timing structure used throughout Sections 1–10. Until then, Section 7 (Go-To-Market Readiness) remains the correct home for the thin evidence that does exist, and Commercial Readiness (Section 4) remains a single category as originally assessed.

---

## 14. Product Readiness Scorecard

The scorecard below assigns a qualitative maturity rating to each of the ten assessed categories (plus the placeholder Business Readiness category from Section 13), for at-a-glance tracking and for comparison against future reassessments (see Section 15). Ratings use four qualitative levels only, per Technical Lead instruction: **Emerging** (little or no work exists yet), **Developing** (real work exists but with significant, evidenced gaps), **Established** (the category substantially meets what is needed for the current stage, i.e. reaching pilot/early paying customers), **Advanced** (the category would support scaling to hundreds or thousands of customers without material rework). No numeric score is assigned; the rating is a direct, evidence-traceable restatement of each section's own Current State and Recommended Priority above, not a new judgment.

| Category | Maturity | Basis |
|---|---|---|
| Engineering Readiness | **Established** | Ten Development Sprints Completed, 154 passing tests, clean typecheck, disciplined governance (Section 1). Not "Advanced" because of the open Sprint 002/004 review backlog and Finding F-01. |
| Product Readiness | **Emerging** | One feature fully implemented; Organization/Identity/Asset/viewing/reporting capabilities named in ADR-0003 remain entirely unimplemented and, in most cases, unspecified (Section 3). |
| Business Readiness (placeholder — Section 13) | **Emerging** | Only the Product Vision's Mission/Problem statement and an implicit customer segment exist; no dedicated business-strategy artifact exists to assess further. |
| Commercial Readiness | **Emerging** | No pricing, packaging or billing mechanism exists in any form (Section 4). |
| Legal & Compliance Readiness | **Emerging** | No license, Privacy Policy, Terms of Service, or GDPR/works-council documentation exists (Section 5) — the least-visible risk in this assessment precisely because it requires no code to become urgent. |
| Deployment Readiness | **Emerging** | No backend hosting decision, no app store configuration, no release pipeline (Section 6). |
| Technical Operations Readiness | **Emerging** | No CI/CD, no monitoring, no environment separation; root documentation actively describes a pre-Sprint-001 state (Section 2). |
| Customer Readiness | **Emerging** | No Organization onboarding path exists at all — every identity in the system today is a hard-coded fixture (Section 8). |
| Support Readiness | **Emerging** | No support channel, process, or role exists yet — appropriately so at this pre-pilot stage (Section 9). |
| Scaling Readiness | **Emerging** | Not yet meaningfully evaluable; current durable persistence (DT-015) is explicitly single-writer only and no real multi-tenant backend has ever been exercised (Section 10). |

This scorecard is intended to be re-produced, not re-invented, at each future reassessment (Section 15) — the same ten-plus-one category list, the same four-level scale, compared against this baseline to show trajectory over time rather than a static snapshot.

---

## 15. Long-term Governance: Should This Become a Continuously Maintained Framework?

Technical Lead review raised a final question: should this assessment and its companion roadmap become a one-time deliverable, or should they evolve into a permanent, continuously maintained governance artifact — a Business Readiness Framework alongside the repository's existing engineering governance (EOM-001, AGR-001, DTP-001, AVR-001)?

**Finding: repository evidence supports this evolution, and the case for it is direct.** The repository already has a proven precedent for exactly this pattern in the engineering domain: AVR-001 (Artifact Validation Register) exists specifically because one-time validation claims decay — its own Validation Rule states "Validation requires evidence. Status shall never be upgraded by assumption," and it is designed to be revisited every time a new artifact reaches a validation milestone, not written once and left static. The same logic applies with equal force to product/commercial/legal/operational readiness: every category in Sections 1–10 above will change materially as Development Sprints continue, as the backend technology and Organization Management decisions (Sections 3, 6, 11.1) are resolved, and as the first pilot customers generate real evidence where today there is only an evidenced absence. A readiness assessment that is produced once and never repeated would go stale in the same way `Roadmap.md`, `Project_Status.md`, and the root `README.md` were independently found to have gone stale elsewhere in this repository (Section 2) — this assessment should not repeat that pattern for itself.

**Recommendation for how future reassessments should be performed**, offered as a recommendation only — this does not create a new governance standard, and does not modify FDOS:

- A reassessment should be triggered by milestone, not by calendar: at minimum, before each roadmap milestone in the companion Product Readiness Roadmap (Before Pilot Customers, Before First Paying Customers, Before 100 Customers, Before 1,000 Customers), and additionally whenever a cross-cutting decision named in this assessment (the backend technology decision, Finding F-01, Organization Management scope) is resolved, since resolving any one of them changes the evidence basis for multiple categories at once.
- Each reassessment should reuse this document's exact structure (Sections 1–10's seven-field category format, the Section 12 capability-hierarchy table, and the Section 14 scorecard) rather than being rewritten from a blank page, so that maturity trajectory is directly comparable across reassessments — this is the same "Continue, Never Recreate" principle EP-008 already applies to code, applied here to an evidence document.
- Each reassessment should explicitly cite what changed in repository evidence since the prior assessment (new Development Sprints closed, new ADRs/Feature Blueprints created, new Decision Log entries) as its update basis, mirroring how each EP-008 Synchronization Update in this repository already cites the specific commit and Development Sprint it synchronizes against.
- Ownership of triggering and commissioning each reassessment should sit with the Technical Lead, with the Human Architect retaining approval authority over any resulting scope or roadmap changes — the same authority split already used for every other engineering artifact in this repository (EOM-001).
- This recommendation is a suggested evolution of practice, not a new standard: it does not itself create a governance document, does not modify EOM-001/AGR-001/DTP-001/AVR-001, and requires Technical Lead/Human Architect adoption before it becomes binding practice.

---

## 16. Role Handover

Implemented scope: this assessment and its companion roadmap document (`Product_Readiness_Roadmap.md`) only, including a subsequent Technical Lead Review Follow-up revision (see the Revision Note above) that extended both documents with the seven changes described there. No code was written or modified in either the original assessment or the follow-up revision. No architecture, ADR, TTAP-001, FB-001, TS-001, Product Vision, Product Principles, Domain Model, Role Model, or EP-008 content was changed. No Development Sprint was created.

Changed artifacts: `ADO/05_Evidence/Product_Readiness_Assessment.md` (new, this file), `ADO/05_Evidence/Product_Readiness_Roadmap.md` (new, companion document). No other file was modified.

Related ADO artifacts consulted: Product Vision, Product Principles, Domain Model, Role Model, System_Overview.md, NFC_Capability_Model.md, Tech_Stack.md, Glossary.md, Risk_Register.md, Roadmap.md, Project_Status.md, Decision Log, AVR-001, ADR-0001 through ADR-0007, TTAP-001, FB-001, TS-001, EP-007_Development_Tasks.md (DT-001–DT-015), Development_Sprint_001_Plan.md through Development_Sprint_010_Plan.md and their Closure documents, EP-008 Chapters 00–03, MVP_Readiness_Assessment.md, Repository_Readiness_Assessment.md, root README.md/CHANGELOG.md/CONTRIBUTING.md/CODEOWNERS/package.json, apps/mobile/package.json and app.json, full repository directory structure (including confirming `.github/workflows/`, `infrastructure/`, `scripts/`, root `tests/` and `docs/` contain only `.gitkeep`/placeholder content).

Tests performed: none specific to this assessment (no code changed); the current 154-passing-test/clean-typecheck state was verified as part of the immediately preceding Development Sprint 010 Governance Closure and is cited here, not re-verified independently in this session.

Known deviations: none from the assigned task scope.

Open findings raised by this assessment, organized by category, are detailed in each section above and consolidated in the companion roadmap. The single most consequential cross-cutting finding is Section 11 (the deferred backend technology decision blocking three separate readiness categories).

Next responsible role: Technical Lead / Human Architect to review this assessment and the companion roadmap, and to decide which readiness gaps to convert into new Feature Blueprints, ADRs, Development Sprints, or non-engineering workstreams (legal, commercial, GTM). Per the assigned stop condition, this task does not begin any implementation, create any Development Sprint, or modify any architecture.

## 17. Stop Condition

Per task instruction: stop after producing this assessment and the companion roadmap. No implementation was created. No repository content other than these two new files was modified. Awaiting Technical Lead / Human Architect review. Do not continue automatically.

---

## Revision Note (Technical Lead Review Follow-up, 2026-07-07)

This assessment was updated once, after Technical Lead review, to incorporate seven specific requested changes without rewriting, weakening, or removing any prior finding: Section 0.1 (Business Event Platform strategic frame), Section 1 and Section 3 (Business Engine centrality and NFC-as-first-trigger framing added in place), Section 11.1 (re-evaluation of the primary strategic bottleneck — Organization Management identified as the more foundational blocker for reaching Pilot Customers, without retracting the backend technology decision's standing finding for later milestones), Section 12 (Capability Perspective, new), Section 13 (Business Readiness category evaluation, new — found not supportable by current evidence and retained as a placeholder rather than invented), Section 14 (Product Readiness Scorecard, new), and Section 15 (Long-term Governance recommendation, new). All content from the original assessment (Sections 1–11 as originally numbered) is preserved; this revision only renumbered the closing Role Handover and Stop Condition sections to accommodate the five new sections inserted before them, and lightly extended three existing sections (0, 1, 3) with additional framing paragraphs. See the companion `Product_Readiness_Roadmap.md`'s own Revision Note for the corresponding roadmap-side changes (Engineering Track / Product Capability Track separation, per the same review).
