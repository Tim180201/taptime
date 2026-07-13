# Core Roadmap v2 – Commercial Readiness

Role: Research / Implementation Support acting on behalf of Technical Lead (per AGR-001)
Date: 2026-07-10
Status: Active execution baseline — Block A and B1–B4 completed; B5 read-only Organization/config adapter slice authorized next as of 2026-07-13
Scope: Core platform roadmap only. Generic platform language throughout (Organization, Membership, Role, User, AssignmentTarget, Customer, NfcTag, NfcAssignment, TimeEntry, WorkEvent, BusinessEvent, Policy, AuditEvent, Export, Backend, Auth, Tenant Isolation, Mobile App, Admin Web, Website). No customer-specific product, company, or branch assumption is named anywhere in this document. No code implemented. No architecture, ADR, TTAP-001, FB-001/TS-001, FB-002/TS-002, or Product Vision content modified.
Related Artifacts: `ADO/05_Evidence/External_CTO_Review_Triage_2026-07-10.md`, `ADO/05_Evidence/Product_Readiness_Assessment.md`, `ADO/05_Evidence/Product_Readiness_Roadmap.md`, `ADO/02_Development/Development_Sprint_019_Closure.md`, `ADO/02_Development/EP-007_Development_Tasks.md`, `ADO/00_Core/Project_Status.md`, `ADO/00_Core/Decision_Log.md`

---

## 1. Purpose

This roadmap supersedes the previous, undocumented "8–12 workday" commercial-readiness estimate — no repository artifact ever recorded that figure in writing (`External_CTO_Review_Triage_2026-07-10.md` Section 1), but it had circulated as an informal planning assumption and is corrected here with a calendar-based, evidence-grounded timeline. It integrates the External CTO Review's findings (`External_CTO_Review_Triage_2026-07-10.md`), each independently re-verified against current repository source code before being incorporated below. It defines the realistic path from **Core Prototype** (the repository's current, actual state — see Section 2) to **Technical Pilot Readiness** and, beyond that, **Commercial Readiness**.

This document does not replace `Product_Readiness_Assessment.md`'s per-category detail or `Product_Readiness_Roadmap.md`'s milestone structure; it sits alongside both, translating the External CTO Review's specific findings into a sequenced, block-based execution plan. `Product_Readiness_Roadmap.md` receives a targeted addendum, not a rewrite, reflecting this roadmap's reprioritization (see that file's own "Addendum (2026-07-10)" section).

## 2. Current Baseline

TapTim.e currently has, confirmed by direct repository evidence as of Development Sprint 019 (`Development_Sprint_019_Closure.md`; `External_CTO_Review_Triage_2026-07-10.md` Section 2–4):

- A strong core architecture: hexagonal ports/adapters separation, orchestration-only Application Services, no business decision leaking into an Application Service anywhere.
- A tested scan pipeline: `NfcScanApplicationService` → `AssignmentResolver` → `AssignmentValidator` → `WorkEventCreationService` → `WorkEventFactory`/`BusinessEngine`, 221 `packages/core` tests passing, typecheck clean.
- A tested Organization Management foundation: `OrganizationManagementService`, `MembershipService`, `OrganizationAdministrationService` (DT-017–DT-025), and `OrganizationOwnedScanPipeline.test.ts` (DT-026) proving Organization-owned data composes correctly with the unmodified scan pipeline — all at the code/test-verification level only.
- **No real product runtime**: the mobile app's `ScanScreen` runs against a hard-coded demo pipeline (`buildScanDemoPipeline`), not against real Organization/Membership/Customer/NfcTag/NfcAssignment data (External CTO Review Finding K1).
- **No real backend**: no server, no network-reachable persistence, no tenant-isolation enforcement exists outside in-process unit tests (Finding K5).
- **No real auth**: `LoginScreen` constructs a fake authentication gateway directly (Finding K4).
- **No stop lifecycle**: `TimeEntry` supports only a `started` state; repeated scans escalate with no resolution path (Finding K3).
- **No installable app distribution**: no build/signing configuration exists for a real device install outside a development client (Finding K11).
- **No CI**: `.github/workflows/` is empty (Finding K8).
- **No sales-ready legal package**: no data inventory, TOMs, AVV/DPA, or privacy notice exists yet; this work is calendar-gated, not sprint-gated (Finding K12).

## 3. Planning Assumptions

- Approximately **4 hours/day** available work time.
- Governance and review overhead is included in that time, not additional to it — see Section 8's Governance Adjustment for how this roadmap keeps that overhead proportionate.
- Implementation complexity varies materially by Block; not every Block is equally sized, and ranges below are ranges, not fixed commitments.
- External legal review (Block H) proceeds on **elapsed calendar time**, not implementation time, and can run partly in parallel with later engineering Blocks rather than strictly after them.
- Mobile distribution (Block G) and physical NFC validation (Block D) both introduce calendar risk independent of engineering effort — device availability, store review turnaround, and physical test scheduling are not compressible by working more hours per day.
- Backend, security, and authentication work (Blocks B/C) are not single-sprint-trivial; they are treated as their own multi-sprint Blocks, not folded into existing Blocks as an afterthought.

## 4. Updated Timeline

| Milestone | Estimate |
|---|---|
| Technical Pilot Readiness | 6–9 weeks |
| Commercial / Sales Readiness | 3–5 months |
| First Paying Customer (including pilot, legal review, and sales elapsed time) | 4–7 months |
| SaaS v1 | 8–12 months |

These are calendar estimates at approximately 4 hours/day, consistent with Section 3's planning assumptions, not effort-hour totals divided evenly across a fixed sprint count.

## 5. Roadmap Principles

- **Core platform first, not customer-specific platform.** Every Block below is scoped in generic platform language (Organization, Membership, AssignmentTarget, NfcTag, TimeEntry, and so on); no Block assumes a specific customer, industry, or branch.
- **Runtime reality over documentation completion.** A capability is not "done" because a Development Task's tests pass in isolation — Block C exists specifically because Organization Management is code/test-complete but not yet runtime-reachable (Finding K1).
- **Server/auth/security before sales.** Blocks B and C (backend, async migration, tenant isolation, real auth) are sequenced before Blocks E–H (setup, distribution, legal, commercial), not after.
- **App installability before pilot.** Block G is a hard prerequisite for Technical Pilot Readiness — a pilot cannot begin with `expo start` as the only installation path.
- **Real NFC validation before claiming NFC readiness.** Block D's physical validation (DT-058) is required before NFC is described as pilot-ready anywhere, consistent with DT-016's own long-carried-forward disclosed limitation.
- **Stop lifecycle before commercial time tracking.** Block A is first for a reason: no other Block's outcome is commercially meaningful if an employee cannot end a shift (Finding K3).
- **Reduce governance overhead where safe.** Section 8 defines a temporary, lighter closure template for this phase — full EP-008 synchronization is not repeated after every micro-sprint.
- **Defer non-essential polish until runtime product works.** Block I (UI/UX productization) is explicitly sequenced last/parallel, not first, per Section 7 (Can Come After First Sale) and the External CTO Review's own "policy engine/admin dashboard/website too early" observations.

## 6. Roadmap Blocks

Blocks are ranges, not fixed sprint-by-sprint commitments; candidate Development Tasks (DTs) are named to make scope concrete, not to overclaim exact duration per DT. Sprint numbers are candidate ranges only, continuing from Development Sprint 019 (the last completed sprint).

### Block A – Core Truth and Reliability

**Status: Completed (2026-07-13).** DT-027/028 were delivered by the review triage and this roadmap; DT-029–033 were completed through the approved F-01 decision and commits `f5a0027`, `d8d3833`, and `72eb03d`; DT-034/035 were completed by commits `b2004ea` and `2493f17`. See `ADO/02_Development/Block_A_Core_Truth_and_Reliability_Closure.md`.

**Target:** Week 1–2 · **Candidate Sprints:** 020–024

| DT | Title | Description |
|---|---|---|
| DT-027 | External CTO Review Triage | Record and classify external CTO findings. |
| DT-028 | Core Roadmap v2 Rebaseline | Replace the informal optimistic timeline with a realistic roadmap and update status. |
| DT-029 | F-01 / TimeEntry Lifecycle Decision | Decide scan toggle behavior: first scan starts, next scan stops the active entry. |
| DT-030 | TimeEntry State Model | Add completed/stopped lifecycle state, `stoppedAt`, duration semantics. |
| DT-031 | TimeEntryRepository Update Path | Enable an active TimeEntry to be updated/stopped. |
| DT-032 | BusinessEngine Start/Stop Decision | BusinessEngine evaluates whether a scan starts or stops time. |
| DT-033 | TimeEntry Lifecycle Integration Tests | Start → stop → restart must work, proven by tests. |
| DT-034 | CI Baseline | Add CI (GitHub Actions or equivalent) for typecheck/test on push/PR. |
| DT-035 | Tests-inclusive TypeScript Check | Ensure tests are typechecked, not only `src`. |

**Outcome:** Time tracking core is usable; repeated scans no longer permanently escalate; CI starts protecting the repository; tests are typechecked.

### Block B – Backend and Async Foundation

**Status: Architecture approved; B1–B4 completed; B5 read-only Organization/config adapter slice authorized next (2026-07-13).** ADR-0008 was approved after independent architecture/security review and corrective Technical Lead verification. B1's managed-Node transaction/security spike passed 39 direct-PostgreSQL tests locally and in GitHub Actions after two security correction rounds. B2 completed the Promise migration across all twelve effectful ports and passed GitHub Actions run `29221790966` after one Technical Lead correction. B3 provides three versioned PostgreSQL 17 migrations, twelve forced-RLS tables, reciprocal TimeEntry/Decision traceability, truthful five-way Core Decision/SyncReceipt mappings, exact Start/Stop WorkEvent `occurred_at` binding and its original 124-test negative matrix after three Technical-Lead correction rounds. B4 adds migration `004` plus the isolated Node 24 identity workspace: the corrected migration normalizes an existing resolver role and removes parent-role contamination; JWT verification binds JWKS to the exact issuer path and requires HTTPS outside numeric loopback tests; and current active server Membership data authoritatively supplies User, Organization and role. Its local suite passes 54 B4 tests and the extended B3 suite passes 125; implementation commit `570fc0b` passed GitHub Actions run `29261459523`; the independent Claude review returned `APPROVED` with no P0/P1 findings. No HTTP API, productive Auth/cloud resource, B5 adapter or B6 ingestion is present. The Human Architect authorized B5 only as the narrow read-only Organization/config adapter slice; writes, HTTP and B6 ingestion remain outside scope. Supavisor-mode validation and production personal data remain gated, the latter until legal/privacy retention and backup requirements are approved.

**Target:** Week 2–4 · **Candidate Sprints:** 025–030

| DT | Title | Description |
|---|---|---|
| DT-036 | Backend Technology ADR | Decide backend technology. |
| DT-037 | Backend Responsibility Model | Define what belongs in core, mobile, admin web, backend. |
| DT-038 | Async Port Migration Plan | Plan migration from synchronous repository ports to async-compatible ports. |
| DT-039 | Async Port Migration Implementation | Migrate repositories/services/tests to async where required for a real backend. |
| DT-040 | Server Data Model v1 | Define server data model for Organization, Membership, Customer, NfcTag, NfcAssignment, TimeEntry, WorkEvent, AuditEvent. |
| DT-041 | Tenant Isolation Model | Define hard tenant separation. |
| DT-042 | Role-based Server Security Rules | Define and implement first server-side access rules. |
| DT-043 | Server-backed Repository Adapter Skeleton | Create adapter skeletons for backend persistence. |
| DT-044 | Server-backed Core Persistence v1 | Implement first server-backed persistence for critical aggregates. |

**Outcome:** Backend decision made; async backend feasibility addressed before it becomes a larger migration; tenant/security model exists; server persistence path begins.

### Block C – Runtime Composition, Auth and Real Product Path

**Target:** Week 4–6 · **Candidate Sprints:** 031–036

| DT | Title | Description |
|---|---|---|
| DT-045 | Runtime Composition Root | Create a real composition root for mobile/core runtime. |
| DT-046 | Remove Demo Pipeline from Product Runtime | Move the demo pipeline into an explicit demo/dev-only path. |
| DT-047 | Organization/Membership Runtime Wiring | Use `OrganizationManagementService`, `MembershipService`, and `OrganizationAdministrationService` in a real runtime/setup path. |
| DT-048 | Bootstrap First Organization/Admin | Define safe bootstrap for the first Organization and first Administrator Membership. |
| DT-049 | Real Authentication Architecture | Select and design a real auth provider/token/session model. |
| DT-050 | Real Authentication Implementation v1 | Replace `FakeAuthenticationGateway` for real app runtime. |
| DT-051 | Session/Membership Resolution | On login, resolve the authenticated User into a Membership/Organization context. |
| DT-052 | Mobile Composition Root / Session Injection | `LoginScreen` no longer directly instantiates `FakeAuthenticationGateway` or `SessionService`. |

**Outcome:** No more demo pipeline as the product path; Organization/Membership code becomes runtime-relevant, not test-only; a real auth path exists; a user-to-membership context exists.

### Block D – NFC Runtime and Physical Validation

**Target:** Week 5–7 · **Candidate Sprints:** 037–041

| DT | Title | Description |
|---|---|---|
| DT-053 | NFC Payload Strategy Decision | Decide UID vs. NDEF payload and document security/operational implications. |
| DT-054 | NFC Payload Normalization | Normalize scan and registration consistently. |
| DT-055 | Mobile NFC Port Wiring | Use the real NFC adapter as the actual `NfcScanPort` in the pipeline (closes Finding K2). |
| DT-056 | NFC Adapter In-flight Guard | Prevent hanging promises on duplicate calls. |
| DT-057 | NFC Adapter Timeout / Cancellation / Cleanup | Add timeout, cancellation, and listener cleanup. |
| DT-058 | Physical NFC Validation | Test real hardware with real tags — closes the DT-016 gap disclosed since Development Sprint 011. |
| DT-059 | NFC Validation Evidence Package | Record tested devices, tags, payload type, results, and limitations. |

**Outcome:** A real NFC path exists; physical NFC assumptions are validated; payload matching works consistently; the mobile scan path follows the intended architecture.

### Block E – Sync, Setup, Export and Minimal Operations

**Target:** Week 6–9 · **Candidate Sprints:** 042–048

| DT | Title | Description |
|---|---|---|
| DT-060 | Real Synchronization Gateway | Implement a real sync gateway against the backend. |
| DT-061 | Offline-to-Server Sync Flow | Define/implement how local events reach the server. |
| DT-062 | Retry and Idempotency Rules | Prevent duplicate events and define retry behavior. |
| DT-063 | Minimal Organization Setup Flow | Create a generic setup for Organization, users, Memberships. |
| DT-064 | AssignmentTarget Setup Flow | Create a generic setup for Customer/AssignmentTarget. |
| DT-065 | NFC Tag Registration Setup Flow | Register tags in runtime. |
| DT-066 | NFC Assignment Setup Flow | Assign tags to AssignmentTargets. |
| DT-067 | Exportable Time Records | Define an exportable time-record model. |
| DT-068 | CSV Export v1 | Implement CSV export for time entries. |

**Outcome:** Backend sync exists; setup no longer requires code edits; time records are exportable; the product can be operated for a technical pilot.

### Block F – Corrections, Audit and Minimal Admin Capability

**Target:** Week 8–11 · **Candidate Sprints:** 049–054

| DT | Title | Description |
|---|---|---|
| DT-069 | Manual TimeEntry Adjustment v1 | Admin-only correction of start/stop time. |
| DT-070 | Adjustment Reason | Require a reason for manual corrections. |
| DT-071 | Append-only TimeEntry Audit Log | Record who changed what, when, from/to, and why. |
| DT-072 | TimeEntry Overview Minimal UI | Admin/web or CLI minimal overview of time records. |
| DT-073 | Manual Correction UI or CLI | Minimal interface for corrections. |
| DT-074 | Export UI or CLI | Minimal interface to trigger export. |

**Outcome:** Correction is possible; an audit trail exists; export is usable by operators; the admin surface is minimal but functional.

### Block G – App Distribution and Pilot Installability

**Target:** Week 9–12 · **Candidate Sprints:** 055–058

| DT | Title | Description |
|---|---|---|
| DT-075 | Mobile Build Pipeline | Configure the build process for an installable app. |
| DT-076 | Signing and Environment Configuration | Prepare signing/secrets/environments. |
| DT-077 | Internal Distribution Track | Enable internal installation for test users. |
| DT-078 | App Runtime Smoke Test | Install app, login, scan, sync, export across a real environment. |

**Outcome:** The app can be installed by real test users; the runtime environment is testable end-to-end, not just in a simulator/dev mode.

### Block H – Privacy, Legal and Commercial Readiness

**Target:** Week 10–16 · **Candidate Sprints:** 059–066

| DT | Title | Description |
|---|---|---|
| DT-079 | Data Inventory | Document processed data, purpose, retention, and access. |
| DT-080 | TOMs Draft | Prepare technical and organizational measures. |
| DT-081 | AVV / DPA Draft | Prepare a data processing agreement draft. |
| DT-082 | Privacy Notice Draft | Prepare privacy notices for website/app/customer use. |
| DT-083 | External Legal Review Package | Package data inventory, TOMs, AVV, privacy notes, and architecture summary for external review. |
| DT-084 | Legal Feedback Implementation | Implement required changes from external review. |
| DT-085 | Support / Incident Process | Define support, data-incident, and correction processes. |
| DT-086 | Sales One-Pager | Create a product sales summary. |
| DT-087 | Demo Script | Create a realistic demo path. |
| DT-088 | Pricing / Offer Structure | Define the first commercial offer. |
| DT-089 | Commercial Readiness Review | Go/No-Go decision for the first sale. |

**Outcome:** A legal/privacy package is externally reviewable; sales material exists; a commercial go/no-go decision is possible.

### Block I – UI/UX Productization v1

**Target:** Parallel, after the runtime foundation — not before.

| DT | Title |
|---|---|
| DT-090 | Mobile UX Blueprint |
| DT-091 | Admin Web UX Blueprint |
| DT-092 | Website Structure v1 |
| DT-093 | Design System v1 |
| DT-094 | Mobile Scan UI v1 |
| DT-095 | Mobile Active Session / Stop UI |
| DT-096 | Mobile Sync Status UI |
| DT-097 | Admin Web App Shell |
| DT-098 | TimeEntry Overview UI |
| DT-099 | Manual Correction UI |
| DT-100 | Export UI |
| DT-101 | Landing Page v1 |
| DT-102 | Trust / Privacy Pages |
| DT-103 | Product Copy Polish |

**Guidance:** UI/UX must not lead architecture. This Block begins once the runtime path (Blocks A–D) is real enough to support genuine product screens, not before. A lightweight website is acceptable before the first sale, but must not promise unsupported functionality.

## 7. Must-Have Before First Sale

- TimeEntry start/stop lifecycle
- Real authentication
- First admin/bootstrap flow
- Backend/server persistence
- Tenant isolation/security rules
- Async-ready repository boundary
- Real sync or server source-of-truth
- Real NFC runtime wiring
- Physical NFC validation
- Installable mobile app
- Organization/tag/assignment setup without code edits
- Manual correction with simple audit
- CSV export
- CI/typecheck/test enforcement
- Privacy/legal package externally reviewed
- Support/incident process
- Basic sales offer

## 8. Can Come After First Sale

- Generic policy engine beyond simple admin rules
- Advanced admin dashboard KPIs
- Full design system
- Polished public website beyond a landing page
- Advanced audit read models
- Advanced reporting
- Self-service onboarding
- Billing automation
- iOS support
- Enterprise role matrix
- Advanced sync conflict UI
- Large-scale monitoring/analytics beyond the minimum

## 9. Governance Adjustment

The Development Sprint Plan → Implementation → Review → Closure → EP-008 Synchronization process used for Development Sprints 012–019 was valuable — it produced an honest, evidence-backed record and caught real defects (e.g. the DT-024 constructor-arity regression) — but it is heavier than the next phase's approximately 4-hours/day capacity can sustain at the same cadence across the ~80 candidate DTs above.

For the next product-readiness phase, this roadmap recommends a temporary, lighter cycle per sprint:

- **Short Sprint Plan** — scope, acceptance criteria, and a Development Agent Prompt, without the full 18–20-section template used for Development Sprints 012–019.
- **Implementation summary** — what was built, what was tested, what deviated.
- **Review finding log** — issues found during review, and their disposition.
- **Closure note** — a short confirmation of scope, test results, and known limitations, not a 15–16-section closure document.

**Avoid full EP-008 synchronization after every micro-sprint** unless architecture or developer-manual reality materially changes — reserve it for Block boundaries or genuinely new architectural decisions (e.g. the Block B backend technology ADR), not for every individual DT.

**Keep the Decision Log and Project Status current** at every sprint regardless — this is the minimum traceability floor this roadmap does not relax.

This adjustment is temporary, scoped to the roadmap execution phase (Blocks A–I), and can be revisited once Commercial Readiness is reached.

## 10. Role Handover

Implemented scope: this roadmap document only, created alongside `External_CTO_Review_Triage_2026-07-10.md`. No product code was written or modified. No architecture, ADR, TTAP-001, FB-001/TS-001, FB-002/TS-002, or Product Vision content was changed. No Development Sprint 020 (or later) implementation was started; no new Development Task was created inside `EP-007_Development_Tasks.md` — every DT-027 and later reference above is a **candidate** DT for future planning, not yet added to that file, consistent with the assigning task's own instruction to keep this roadmap as evidence/planning first.

Changed artifacts: `ADO/05_Evidence/Core_Roadmap_v2_Commercial_Readiness.md` (new, this file). Cross-referenced by `External_CTO_Review_Triage_2026-07-10.md`, `ADO/00_Core/Decision_Log.md`, `ADO/00_Core/Project_Status.md`, `ADO/05_Evidence/Product_Readiness_Roadmap.md` (addendum only).

Known deviations: none from the assigned task's own scope. This roadmap deliberately does not create Development Sprint 020's own Plan document — per the assigning task's Output instructions and Stop Condition, only the roadmap/evidence/status artifacts are produced here.

Unresolved questions / open findings carried forward: every item in Section 7 (Must-Have Before First Sale) is, by definition, not yet resolved; K10 (JsonFileStore safety)'s disposition remains conditional on the Block B backend decision (`External_CTO_Review_Triage_2026-07-10.md` Section 7); the exact Block boundaries and candidate-DT scopes above are planning estimates, subject to revision once Block A's own short-form sprint cycle (Section 9) is actually exercised.

Evidence produced: this roadmap and the accompanying triage document.

Next responsible role: Technical Lead / Human Architect to review this roadmap and the accompanying triage, then confirm Development Sprint 020's scope (governance-only, if not already fully completed by this task) before Development Sprint 021 (F-01 / TimeEntry Lifecycle Decision + Plan) is created as a separate, later task.

## 11. Progress Update – 2026-07-13

Core Roadmap v2 Block A is complete. The repository now has an engine-driven TimeEntry lifecycle, duplicate suppression, user-aware active-entry handling, started/stopped persistence, lifecycle integration tests, GitHub Actions CI, and tests-inclusive TypeScript checks. The verified baseline is 262 passing Core tests, 10 passing Mobile tests, clean typecheck and a successful Core build. The next execution gate is Block B's backend technology and security architecture decision package; backend implementation must not begin by silently choosing a provider or tenancy model.

## 12. Original Creation Stop Condition (Historical)

The original 2026-07-10 roadmap-creation task ended after producing the roadmap and accompanying evidence/status updates, without committing, pushing or starting implementation. That creation-time stop condition was satisfied and is retained only as provenance; it is not an active instruction after the 2026-07-13 Block A progress update.
