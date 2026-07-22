# Core Roadmap v2 – Commercial Readiness

Role: Research / Implementation Support acting on behalf of Technical Lead (per AGR-001)
Date: 2026-07-10
Status: Active execution baseline — Block A, B1–B6, C1/C2, C3B, C3C, C3D, C3E1, C3E2 and Block D completed for their recorded scopes; Development Assignment 1 and DT-060–DT-062 completed for the authorized local Android/repository/synthetic-server scope after physical evidence `8d5b2bb`/run `29836085810`, final review `APPROVED` with zero open P0–P3 and closure publication `715889e`/run `29837556200` 10/10; Development Assignment 2 and DT-063–DT-068 completed for the authorized local setup-integration/export-backend scope after independent zero-finding review and closure publication `fa171a5`/run `29848853594` 11/11; pilot-operational setup, UI, production and legal/privacy gates remain open
Scope: Core platform roadmap only. Generic platform language throughout (Organization, Membership, Role, User, AssignmentTarget, Customer, NfcTag, NfcAssignment, TimeEntry, WorkEvent, BusinessEvent, Policy, AuditEvent, Export, Backend, Auth, Tenant Isolation, Mobile App, Admin Web, Website). No customer-specific product, company, or branch assumption is named anywhere in this document. The original 2026-07-10 creation implemented no code and modified no architecture/ADR/TTAP/FB/TS/Product Vision content; later dated synchronization updates change only current status/traceability, not accepted product or architecture rules.
Related Artifacts: `ADO/05_Evidence/External_CTO_Review_Triage_2026-07-10.md`, `ADO/05_Evidence/Product_Readiness_Assessment.md`, `ADO/05_Evidence/Product_Readiness_Roadmap.md`, `ADO/02_Development/Development_Sprint_019_Closure.md`, `ADO/02_Development/EP-007_Development_Tasks.md`, `ADO/00_Core/Project_Status.md`, `ADO/00_Core/Decision_Log.md`

---

## 1. Purpose

This roadmap supersedes the previous, undocumented "8–12 workday" commercial-readiness estimate — no repository artifact ever recorded that figure in writing (`External_CTO_Review_Triage_2026-07-10.md` Section 1), but it had circulated as an informal planning assumption and is corrected here with a calendar-based, evidence-grounded timeline. It integrates the External CTO Review's findings (`External_CTO_Review_Triage_2026-07-10.md`), each independently re-verified against repository source code at creation. It defines the path from the **Core Prototype** baseline recorded on 2026-07-10 (Section 2) to **Technical Pilot Readiness** and, beyond that, **Commercial Readiness**; the status header and block notes carry the later disposition.

This document does not replace `Product_Readiness_Assessment.md`'s per-category detail or `Product_Readiness_Roadmap.md`'s milestone structure; it sits alongside both, translating the External CTO Review's specific findings into a sequenced, block-based execution plan. `Product_Readiness_Roadmap.md` receives a targeted addendum, not a rewrite, reflecting this roadmap's reprioritization (see that file's own "Addendum (2026-07-10)" section).

## 2. Historical Creation Baseline (2026-07-10; Development Sprint 019)

At roadmap creation, TapTim.e had the following state, confirmed by direct repository evidence as of
Development Sprint 019 (`Development_Sprint_019_Closure.md`;
`External_CTO_Review_Triage_2026-07-10.md` Section 2–4). These bullets are historical; later block
status sections and the document header are current:

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

**Status: Architecture approved; B1–B6, C1/C2, C3C, C3D, C3E1, C3E2, Block D and narrow E2A completed after their recorded Technical Lead, GitHub CI, independent security and applicable Human gates (2026-07-18).** ADR-0008 was approved after independent architecture/security review and corrective Technical Lead verification. B1's managed-Node transaction/security spike passed 39 direct-PostgreSQL tests locally and in GitHub Actions after two security correction rounds. B2 completed the Promise migration across all twelve effectful ports and passed GitHub Actions run `29221790966` after one Technical Lead correction. B3 provides three versioned PostgreSQL 17 migrations, twelve forced-RLS tables, reciprocal TimeEntry/Decision traceability, truthful five-way Core Decision/SyncReceipt mappings, exact Start/Stop WorkEvent `occurred_at` binding and its 125-test current negative matrix. B4 adds migration `004` plus the isolated Node 24 identity workspace; B5 adds the tenant-safe read-only coordinator; B6 adds the non-HTTP server-canonical lifecycle coordinator and migration `005`. Their approved implementation/closure evidence remains authoritative. C1 implements DT-045/046 and DT-049–DT-052 with default product Mobile composition, Supabase email/password, refresh-token-only SecureStore restoration and B4-backed session resolution. C2 implements the strict three-route B4/B5/B6 API and private Mobile transport foundation with three distinct least-privilege pools. Implementation commit `9f5b127` passed all seven jobs in run `29314305059`; independent review found no P0/P1 and its sole P2 was corrected through incrementally bounded Expo native response streaming. Direct C2 evidence is 127 API tests (43 C1 + 84 C2) and 154 Mobile tests. Block D implementation commit `fac778d` passed all seven jobs in run `29319811973`; the Galaxy A33/NTAG213 device-local and server-connected product checklists passed. The strictly local harness uses five automated tests — three direct PostgreSQL integration cases and two non-database safety/source guards — and passed all eight jobs. Independent final review found no P0/P1/P2; its sole P3 test-count wording finding was corrected at closure. E2A implementation commit `4b5ecdc` passed all eight jobs in run `29348512506`, and controlled Galaxy A33 warm-session C2-transport-loss plus force-stop/restart validation passed without a deferred lifecycle decision or TimeEntry mutation. Its independent final review returned `APPROVED` with no open finding. C3C implementation commit `b90729a0a4b325f523cd98ea5a741defb00155f6` adds migration `007` and the fourth least-privilege administration plane; the 1,394-test matrix and complete workspace verification passed, three independent exact-SHA reviews returned APPROVED with zero P0/P1/P2/P3 and exact-head run `29375259275` passed ten of ten jobs. C3D's final correction and complete Human physical gate are recorded in Section 14. C3E1's product/harness corrections and complete Human physical gate are recorded in the current update below. C3E2's independently closed implementation/Human-gate disposition is recorded in Section 15. Block E outside E2A, Supavisor validation and production personal data remain gated.

The preceding C3E1 “implementation gated” wording is superseded by the exact current update below;
C3E1 is independently closed for its authorized repository/device scope.

**C3E1 implementation and physical-closure update (2026-07-18):** the authorized migration-008/six-pool/Web/Android
implementation was published as `42b7c7a` and passed ten-of-ten run `29414515751`, but final review
returned `CHANGES REQUIRED`. Correction `450d767` then passed zero-finding independent delta review
and exact-head ten-of-ten run `29416554531`. First local harness `ee522a5` passed exact-head CI but
review returned `CHANGES REQUIRED`; focused correction `4338910` passed zero-finding independent
delta re-review and exact-head ten-of-ten run `29420832927`. The complete fresh Human Gate then
passed. Closure commit `fe0781b`, tree `76284e5`, passed exact-head ten-of-ten run `29645336694`;
independent final review returned `APPROVED` with zero open P0/P1/P2/P3.

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

**Status: C1, C2, C3B, C3C, C3D, C3E1 and C3E2 independently completed for their recorded scopes; no-code C3A passed independent re-review and Human acceptance (2026-07-18).** The default Mobile path uses the real Supabase email/password adapter, refresh-token-only SecureStore restoration and server-authoritative Membership session resolution. C2 adds only the earlier session/scan/lifecycle/defer routes and private Mobile transport. The later Block-D slice wires the authenticated NFC product path without changing C2's lifecycle boundary. Accepted FB-002 v1.2, TS-002 v1.3 and ADR-0011 define named-operator first Organization/Admin bootstrap, a distinct narrow normal Admin write session, bound receipts, required Customer/Tag display names, protected raw UID handling, disclosure-safe results and append-only Assignment history. C3C realizes that normal setup backend through exact create-Customer, atomic provision-Tag and safe setup-projection routes. C3D completed the Admin Web and protected Android capture surfaces without changing C3C semantics or granting production authority. C3E1 adds the separately accepted invitation/redemption Membership boundary. C3E2 adds only the separately accepted explicit reassignment boundary and does not alter lifecycle/NFC semantics.

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

**C3 execution note (updated 2026-07-18):** DT-048's architecture decision passed independent
validation and Human acceptance. C3B private bootstrap passed implementation, independent review and
exact-head nine-job CI and remains the closed bootstrap-only plane. C3C's normal setup backend/API
repository implementation passed its separate authorization, exact-SHA independent review and
exact-head ten-job CI cycle and is closed. C3D (Admin Web plus protected Android capture)
subsequently completed independent review, exact-head CI and its complete fresh Human physical gate.
C3E1 identity-first Employee Membership correction `450d767` passed independent zero-finding review
and exact-head ten-of-ten run `29416554531`. Harness correction `4338910` passed independent
zero-finding review and exact-head ten-of-ten run `29420832927`; the complete fresh Human Gate then
passed. Closure commit `fe0781b` passed exact-head ten-of-ten run `29645336694` and independent
zero-finding final review. C3E2 final implementation head `7050df4` then passed zero-finding
independent implementation review and exact-head ten-of-ten run `29649683173`; its complete fresh
Galaxy-A33/NTAG213 Human Gate passed. Closure commit `a2fdebc`, tree `1872f9f`, passed exact-head
ten-of-ten run `29652072268` and zero-finding independent final review.
DT-063–DT-066 remain open as Roadmap candidates because pilot-grade operational onboarding is not
complete, even though C3D and C3E2 closed their recorded physical UI/capture/reassignment proofs.

### Block D – NFC Runtime and Physical Validation

**Status: Completed after Software/GitHub-CI, Device-local NFC, Synthetic Server-connected Physical Android and Independent Security Approval (2026-07-14).** V1 uses only the versioned canonical Android UID payload `nfc:uid:v1:<UPPERCASE_HEX>`. The real `NfcScanPort.scan()` drives the private C2 server path with single-flight timeout/cancellation cleanup, physical-discovery timestamp binding, session-generation isolation, protected same-evidence ambiguous retry and truthful UI presentation. The Galaxy A33 5G / Android 15 / two-NTAG213 device-local checklist passed. The five-test local harness comprises three direct PostgreSQL integration cases and two non-database safety/source guards and proves synthetic Auth, C2, PostgreSQL and genuine Core Start/Stop without LAN/tunnel/cloud. Review added native-project preservation, scoped USB reverse cleanup, dedicated PostgreSQL-17 CI enforcement, its clean-Linux dependency build sequence, strict host-loopback database execution and exact restoration of Expo's tracked prebuild rewrite. Correction commit `59c4ac7` passed all eight jobs in run `29333578360`. The 66-MB APK installed on `SM_A336B`; real Tag B remained unassigned, Tag A was provisioned without lifecycle mutation, and the next scans produced server-confirmed Start then Stop with 1 stopped TimeEntry. Normal shutdown and scoped USB cleanup passed. Independent review of `4f540ca..ac5eeba` returned `APPROVED WITH NON-BLOCKING FINDINGS`, no P0/P1/P2; D-FINAL-01's test-count wording was corrected. Core/Mobile pass 288/253. This closes DT-053–DT-059 and the recorded DT-016 physical gate for the approved device/tag set, not production, broad device-matrix, iOS or pilot readiness.

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

**Status: E1 and narrow E2A completed after Technical-Lead, GitHub CI, Human physical Android and
independent security approval (2026-07-14).** E1 replaces Block D's volatile ambiguous-command slot
with one strict platform-secure lifecycle outbox record; closure-publication commit `9f2f922` passed
eight-job run `29344464075`. E2A adds only one volatile exact-session scan context,
Membership-bound outbox v2 evidence and a dedicated defer-only server path that can atomically store
WorkEvent, `received` Receipt and Audit without a CanonicalDecision or TimeEntry mutation.
Independent implementation review returned `APPROVED`; its two P3 findings were corrected and
independently reverified. Mobile 310, Core 288, lifecycle 88, API 139 and synthetic E2E 6 plus
workspace build and Android export passed; commit `4b5ecdc` passed all eight jobs in run
`29348512506`. Controlled Galaxy A33 / Android 15 validation removed only C2 reverse `tcp:3000`,
preserved the pending command across force-stop/restart and stored the deferred delta without another
Decision or TimeEntry stop. Independent final review returned `APPROVED`; its publication-sync P3
was corrected and no finding remains open. This is not airplane mode or full offline. E2A itself
advanced but did not complete DT-060–DT-062 or Block E. C3C/C3D prove the initial
Customer/Tag/Assignment backend, UI/capture and Human physical flow for their controlled synthetic
scope. Development Assignment 1 later completed durable multi-context caching, multiple events,
scheduling/backoff, supported reconciliation and background synchronization, closing DT-060–DT-062
for its independently approved local Android/repository/synthetic-server scope. Development
Assignment 2 later closed DT-063–DT-068 for the independently approved local setup-integration/
export-backend scope. Pilot-operational setup, UI, production and legal/privacy gates stay open and
separately gated.

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

**Current completion:** DT-060, DT-061 and DT-062 are completed for the independently approved
Development-Assignment-1 local Android/repository/synthetic-server scope after closure publication
`715889e` passed exact-head run `29837556200`, attempt 1, ten of ten. DA2 closure publication
`fa171a5` later passed exact-head run `29848853594`, attempt 1, eleven of eleven. DT-063–DT-068 are
therefore completed for the authorized local setup-integration/export-backend scope. This Block-E
engineering closure does not authorize pilot operations, production resources/data, UI
productization, legal/privacy approval, deployment or distribution.

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

**Current implementation state (2026-07-21):** ADR-0014/DA3-P01–P16 are Human-accepted and DA3
Workstreams A–D plus AVS V0–V4 are authorized on exact baseline `ff68f7a`, tree `09ef169`. The
published implementation `0f71aca`, tree `e3e2ed7`, supplies the minimal Administrator
overview/correction/review/export workflow and append-only effective/audit truth while preserving
automatic lifecycle/offline evidence. AVS V0–V4 is green with 1,757 local tests and exact-head run
`29859522776` 12/12. Independent exact-SHA review returned `APPROVED` with zero open P0–P3 and
recommends retaining V5. Human V5 disposition and DT-069–DT-074 closure remain pending.

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

## 13. Progress Update – 2026-07-15 Governance Synchronization

The post-Sprint-019 EP-008 block-boundary trigger was acted on as an ADO-only maintenance slice.
Chapters 00–03 preserve their historical Sprint-019 narratives and add current reconciliations
through Blocks A, B1–B6, C1/C2, D, E1/E2A and C3A–C3C on baseline
`fda5e5b9e878311b0caa647c6b49ab14943b706e`. Chapters 04–10 remain a separate documentation backlog.
Synchronization publication `d9060fe96bcb9d2e3282d5cb08a455d113b86307` passed all ten jobs in
exact-head GitHub Actions run `29394356224` on `main`; closure
`9c9144fa468cbaa6d1195a172f92e746ad3eb265` passed ten-of-ten run `29394550988`. Independent final
review returned `APPROVED` with no open repository finding after disposition. The Human Architect
accepted EP-008 Chapters 00–03 and the EP-009 reassessment on 2026-07-15. At that synchronization
point C3D remained separately gated; its later disposition is recorded below.

EP-009's additive 2026-07-15 reassessment dispositions K1–K12 and extends the qualitative scorecard
without rewriting the 2026-07-07 baseline. That governance maintenance changed no Roadmap order
and granted no C3D/C3E or production authority at that time.

## 14. Progress Update – 2026-07-15 C3D Closure and C3E Split

C3D subsequently completed its separately authorized repository and Human physical scope. Final
browser-runtime correction `e686578751e8e09d7a8a48c3fd3058825dcedbf7` passed independent
zero-finding review and exact-head ten-of-ten GitHub Actions run `29405184995`. The complete fresh
Galaxy A33/NTAG213 sequence then passed Employee setup denial, Administrator Web Customer creation,
safe Web/Android projection agreement, force-stop non-mutation, real Tag provisioning/assignment,
same-Administrator server-backed Start/Stop and final cleanup. ADO closure commit
`a0419866c2b992ae8fc5474144064bc0652d215a` passed exact-head ten-of-ten run `29407078949`.

The former combined C3E label is now split so that distinct privileged boundaries cannot be
silently coupled:

- **C3E1:** identity-first Employee Membership setup. Its first independent review returned six P2
  contract findings and no P0/P1/P3. Corrected commit `70d163f` passed zero-finding independent
  re-review/exact-head CI and received Human acceptance plus exact-baseline implementation authority;
  product correction `450d767`, harness correction `4338910` and the fresh Human physical gate later
  passed their required reviews/CI/observations.
- **C3E2:** explicit Tag reassignment. It remains separately unauthorized and must preserve
  Assignment history and future time-attribution rules through its own policy and review gates.

The completed C3D evidence triggered an additive EP-009 readiness delta. The proposed rating
disposition remains unchanged from the accepted C3C reassessment: Engineering is Established;
Product, Deployment, Technical Operations, Customer and Scaling are Developing; Business,
Commercial, Legal/Compliance and Support are Emerging. Independent review found that delta
acceptable and the Human Architect accepted it.
The current engineering critical path is C3E2 policy/authorization, the remaining Block-E work,
then Blocks F/G and the parallel elapsed-time Block-H/legal-commercial path.
No production cloud resource, production personal data, pilot or market-readiness claim follows.

## 15. Progress Update – 2026-07-18 C3E2 Human Gate and Comprehensive Assignment Plan

C3E2's separately authorized implementation was published through `b783733` and CI-only correction
`672b7ac`. Final implementation head `7050df4`, tree `587ef8f`, passed exact-head ten-of-ten run
`29649683173`; independent read-only implementation review returned `APPROVED` with zero open
P0/P1/P2/P3. The complete fresh Galaxy-A33/Android-15/NTAG213 Human Gate then passed real C3C
Customer-A assignment, closed C3E1 Employee enrollment, Customer-A Start, active-work rejection
with zero mutation, Customer-A Stop, explicit A→B reassignment, matching Web/Android projection and
Customer-B Start/Stop. Sanitized evidence proved exactly two immutable Assignment-history rows, one
shared server cutover timestamp, A-before/B-after lifecycle attribution, exact receipts/audits and
complete sign-out/schema/login/listener/reverse cleanup.

C3E2 ADO-only closure commit `a2fdebc`, tree `1872f9f`, passed exact-head ten-of-ten run
`29652072268`; independent final closure review returned `APPROVED` with zero open P0/P1/P2/P3 and
accepted the complete Human Gate, attempt separation, safe-data evidence and cleanup. C3E2 is
independently closed for its authorized local repository/device scope. Production resources/data,
deployment and distribution remain unauthorized.

For the remaining implementation path, the Human Architect and Technical Lead agreed to use eight
larger Development assignments rather than additional micro-sprints:

1. complete offline/synchronization platform;
2. setup and export backend;
3. correction and append-only audit workflow;
4. professional Admin Web productization;
5. professional Mobile productization;
6. production-like platform, security, observability, backup/recovery and operations;
7. app build, signing and distribution; and
8. public website plus final cross-surface hardening.

This grouping changes coordination granularity only. Every privileged or materially risky boundary
still requires an exact authorization/baseline, complete automated verification, Technical-Lead
audit, focused publication, exact-head CI, independent review and applicable Human/physical gate.
The current critical path is therefore the eight assignments above plus the
parallel elapsed-time Block-H legal/commercial track. No quality, security or professional-release
gate is waived.

## 16. Progress Update – 2026-07-18 Development Assignment 1 Candidate

The Human Architect authorized preparation of the first comprehensive assignment candidate, not
its implementation. On exact clean baseline
`1bb2d7d7b38928643cfd5c86b36c500c35f73276`, tree
`c5c20f67155cdc0b4197908b4d1283cb7e619597`, the Technical Lead reconciled the actual E1/E2A
one-record Mobile outbox, volatile same-session context, defer-only server evidence, C3E2 historical
Assignment model and the decision-bearing legacy Core demo queue.

Proposed ADR-0012 and
`Development_Assignment_01_Complete_Offline_Synchronization_Authorization.md` define the complete
DT-060–DT-062 candidate boundary as one assignment:

- a server-issued, exact-owner 12-hour offline capture lease and atomic multi-context projection;
- five-minute clock-anchor tolerance, Android same-boot monotonic proof and a 72-hour
  automatic-evaluation window, all requiring explicit Human acceptance;
- SQLCipher-backed Expo SQLite with SecureStore-held key, crash-safe legacy E1/E2A import and
  protected corruption/key-loss handling;
- a 256-event persist-first FIFO used for every online and offline product scan;
- single-flight foreground/manual/network-hint/background scheduling with exact backoff and no
  false immediate-background guarantee;
- an isolated least-privilege offline ingestion/reconciliation route that either invokes the
  unchanged server BusinessEngine under every authority/time/order predicate or stores review
  evidence with zero TimeEntry mutation;
- complete automated, native Android SQLCipher/background and fresh Galaxy-A33 multi-event
  cold-start/airplane-mode Human gates.

Independent read-only review of exact candidate commit
`592334160655cde2f4189712eaf327c8a7edcb0e`, tree
`96fffb5bb5e2793041c36b8f793c38ab1c2e5428`, returned `APPROVED` with zero open
P0/P1/P2/P3; exact-head push run `29653357355`, attempt 1, passed 10/10 jobs. The Human Architect
subsequently accepted ADR-0012 and Sections 3–13 on the reviewed commit, including every numeric
policy, while explicitly withholding implementation authority. A separate exact-baseline
implementation release must follow before dependency, migration `010`,
product/backend/native code, APK or physical-gate work begins. DT-060–DT-062 and Block E remain
open; production resources/data, Assignment 2–8 scope and the legal/commercial track remain
separately gated. Evidence:
`ADO/05_Evidence/Development_Assignment_01_Independent_Pre_Implementation_Review.md`.

## 17. Progress Update – 2026-07-21 Development Assignment 1 Closure

Development Assignment 1 completed its exact separately authorized implementation, correction,
artifact and Human-gate chain. The sixth complete fresh Gate A–E run passed on product `48a21a7`,
artifact correction `0fdddbc` and the exact runtime-complete APK. Physical-evidence publication
`8d5b2bb`, tree `592f9da`, passed exact-head run `29836085810`, attempt 1, ten of ten.

Independent final closure review verified the exact seven-file `+297/-75` evidence delta, all Gate
A–E observations, mathematical counts, disclosure boundary, cleanup and complete governance
chronology. Verdict: `APPROVED`, zero open P0/P1/P2/P3. Closure publication `715889e`, tree
`b9fc3ac`, passed exact-head run `29837556200`, attempt 1, ten of ten. DT-060–DT-062 are therefore
closed for the authorized local Android/repository/synthetic-server scope.

This does not close DT-063–DT-068 or the remaining setup/export Block-E scope and does not authorize
production resources/data, deployment, distribution, iOS/Web NFC, review adjudication or
Assignments 2–8. Development Assignment 2 remains a separately gated future candidate.

## 18. Progress Update – 2026-07-21 Development Assignment 2 Candidate Preparation

The Human Architect authorized ADO-only preparation of Development Assignment 2, not
implementation. On exact baseline `e5978702eca7adb3de3fd85db37921b4a441ca59`, tree
`98ae795bbf4e1d3eb44e12db62024272e861a279`, the Technical Lead reconciled the current C3B/C3C/
C3D/C3E1/C3E2 setup implementation, DA1 lifecycle/offline closure, TimeEntry schema, role graph,
backend API and Roadmap candidate semantics.

The resulting finding is that setup is not an empty implementation area: the closed C3 boundaries
already provide the local/synthetic bootstrap, Customer, Employee, physical Tag, first Assignment
and explicit reassignment flow. Development Assignment 2 must integrate and evidence those
boundaries rather than create duplicate setup authority. The material missing backend capability is
the v1 time-record export required by ADR-0003 and this Roadmap's DT-067/DT-068 labels.

Proposed ADR-0013 and
`ADO/02_Development/Development_Assignment_02_Setup_And_Export_Backend_Authorization.md` define a
current-Administrator-only, tenant-safe, bounded, deterministic and audited CSV backend behind its
own role/pool, plus a synthetic setup-to-export integration chain. DA2-P01–DA2-P12 expose the exact
actor, row, timestamp, duration, column, limit, CSV, audit and retention-within-response proposals
that require Human acceptance.

The first independent pre-implementation review returned `CHANGES REQUIRED` with exactly
DA2-REV-01 (P2), no P0/P1/P3, alleging ambiguous exported Membership ID/name across multiple
historical same-Organization/User rows. Technical-Lead verification rejects that premise because
migration `001` permanently enforces `UNIQUE (organization_id, user_id)`, migrations `002`–`010`
retain it and accepted C3E1 forbids historical re-onboarding/Organization transfer. The Technical
Lead accepts the useful clarity part with adjustment: DA2-P07 now fixes the exact same-Organization/
User join, stable retained Membership, nullable-name output and fail-closed missing-row integrity.
No DA2-P13 or unsupported re-grant behavior is added. The independent re-review explicitly withdrew
the original premise, approved the adjusted correction, closed DA2-REV-01 and returned
`APPROVED FOR CANDIDATE PUBLICATION` with zero open P0–P3.

The Human Architect subsequently accepted ADR-0013 and DA2-P01–DA2-P12 on published candidate
`30c4f5d`, tree `242331b`, and separately authorized repository implementation on that exact
baseline.

## 19. Progress Update – 2026-07-21 Development Assignment 2 Published Implementation

The Technical Lead completed and published Workstreams A–D at `f385814`, tree `48b5ba8`; exact-head
run `29847593708` passed 11/11. The scope is reuse-only setup integration, migration
`011`, neutral deterministic CSV contract, isolated current-Administrator role/pool/coordinator/API,
fully disposable Setup-to-Export journey and an isolated eleventh CI job. AVS V0–V3 passes 1,681
tests and all applicable typechecks/builds, migration/security checks and Android export.

DT-063–DT-068 remain open Roadmap labels pending
independent exact-SHA implementation review. Production resources/data, deployment, distribution,
correction, UI productization and legal/privacy approval remain separately gated.

## 20. Progress Update – 2026-07-21 Development Assignment 2 Independent Approval

Independent exact-SHA implementation review bound executable implementation `f385814`, tree
`48b5ba8`, reviewed evidence head `1e4dee2`, tree `d6c3adf`, and exact-head eleven-job runs
`29847593708` and `29847934091`. Verdict: `APPROVED`, zero open P0/P1/P2/P3.

Closure publication `fa171a5`, tree `be13e0c`, passed exact-head run `29848853594`, attempt 1,
eleven of eleven. DA2 and DT-063–DT-068 are therefore completed: DT-063–DT-066 only for evidenced
local reuse-only setup integration, and DT-067/DT-068 only for the local tenant-safe export backend.
Pilot-grade operational onboarding, Admin Web download UI, production resources/data,
legal/privacy approval, deployment, distribution and Physical validation are not closed or
authorized by this engineering boundary.

## 21. Progress Update – 2026-07-21 Development Assignment 3 Local Implementation Candidate

The Human Architect accepted ADR-0014 and DA3-P01–DA3-P16 and separately authorized Workstreams
A–D plus AVS V0–V4 on exact published baseline
`ff68f7a7d0ce69a65e88846ae1cca9abd5951f5d`, tree
`09ef169a68bb53420e07b6f3fcbbdc74e0c01d57`.

The Technical Lead completed the local focused candidate: neutral time-review contract, migration
`012`, forced-RLS append-only revision/adjudication/receipt ledgers, effective overview/export,
isolated review read/write roles and pools, five strict API routes, minimal Admin Web correction and
adjudication flow, exact Mobile review-marker reconciliation, a complete disposable operator
journey and a twelfth CI job. AVS V0–V3 passes 1,757 tests plus two explicit environment-dependent
B1 skips, all workspace typechecks/builds, clean/replay migration verification and Android export.
The existing 11 moderate Expo/Xcode toolchain advisories remain disclosed.

Implementation `0f71aca270969866037f2e31cc05ef8730e0ecd1`, tree
`e3e2ed780c217a520d382b98971991510bb99973`, is published; exact-head V4 run `29859522776`, attempt
1, passed 12/12. Independent exact-SHA implementation review returned `APPROVED` with zero open
P0–P3. The reviewer recommends retaining separately authorized V5; Human disposition is pending,
so DA3 and DT-069–DT-074 remain open. V5, Physical Gate,
production, production data, deployment, distribution, legal/privacy approval and DA4
productization remain unauthorized or separately gated.

## 22. Progress Update – 2026-07-21 Development Assignment 3 Independent Approval

Independent exact-SHA review bound baseline `ff68f7a`/tree `09ef169`, implementation
`0f71aca`/tree `e3e2ed7`, reviewed Evidence head `350503a`/tree `015faeb` and exact-head runs
`29859522776` and `29859875195`, both attempt 1 and 12/12 successful. Verdict: `APPROVED`, zero open
P0/P1/P2/P3.

The reviewer recommends retaining the separately authorized V5 operator/Android marker gate before
closure. This is not an implementation finding and does not authorize V5. DA3 and DT-069–DT-074
remain open until the Human Architect either authorizes and completes V5 or explicitly decides it is
not required, followed by exact ADO closure evidence.

## 23. Progress Update – 2026-07-22 Development Assignment 3 V5 Enablement

The Human Architect separately authorized focused local V5 enablement on exact review-synchronized
baseline `0b0d040`, tree `eee2650`: harness, runbook, AVS V0–V4 and independent review. The first
real PostgreSQL operator journey exposed DA3-V5-F01, a fail-closed exact-shape mismatch in the
Backend API export adapter. The Human Architect separately authorized its focused three-field
adapter correction and regression tests on the same baseline.

The candidate composes real export/review coordinators in the disposable harness and defines the
future correction/export plus Android marker retain/clear procedure. Product `6eb68a3` and Evidence
`f4e2eeb` each passed exact-head CI 12/12; independent exact-SHA V5 review returned `APPROVED` with
zero open P0–P3 and confirmed the bound read-only APK. The physical run itself is not authorized,
and DA3/DT-069–DT-074 remain open. Production, production data, deployment, distribution,
legal/privacy approval and DA4 productization remain separately gated.

## 24. Progress Update – 2026-07-22 Development Assignment 3 First V5 Physical Run

The Human Architect separately authorized one run bound to Product `6eb68a3`, Evidence `f4e2eeb`,
review publication `b142626`, the exact CI/artifact bindings and the approved local
Galaxy-A33/two-NTAG213 set. Artifact/device/setup preflight passed. Gate A then failed closed with
`DA3-PHYS-01` (P1) before an unambiguous Start result: the Administrator setup session had bound
the encrypted offline-store owner and the following Employee session on the same installation was
correctly refused as an identity mismatch. Server lifecycle and DA3 counts remained zero, Gates
B/C did not start and complete cleanup passed.

DA3 and DT-069–DT-074 remain open. Independent review approved the failure synchronization with
zero findings. The Human Architect then selected and authorized the operational clean exact-artifact
reinstall correction on `f0c9db3`/tree `27cabe6`; local V0–V3 passed and
publication `f7a2b1e`/tree `a8caed6` passed V4 run `29935693909` 12/12. Independent review approved
it with zero P0–P3. At that checkpoint no replacement run was authorized. Production, production data,
deployment, distribution, legal/privacy approval and DA4 productization remain separately gated.

## 25. Progress Update – 2026-07-22 Development Assignment 3 Replacement V5 Failure

The Human Architect later authorized one complete fresh replacement run bound to the independently
approved operational correction and all exact Product/Evidence/review/CI/artifact/device/tag
bindings. Exact preflight and first installation passed. The run failed closed during prerequisite
setup with `DA3-PHYS-02` (P1): the harness already seeded two Customers, while the runbook also
instructed creation of two Customers even though its exact two-receipt/four-audit setup aggregate
is reachable only without those additional writes. After one correct Tag-A assignment, status was
four Customers, one Tag/Assignment, three administration receipts, four AuditEvents and zero
lifecycle/DA3 rows. Tag B, clean reinstall and Gates A–C did not start; cleanup passed.

This changes no readiness-domain rating. `DA3-PHYS-01`, `DA3-PHYS-02`, DA3 and DT-069–DT-074
remain open. Failure synchronization, a focused ADO-only correction, independent review and new
exact-bound Human authorization are required before another run. Production, production data,
deployment, distribution, legal/privacy approval and DA4 productization remain separately gated.

## 26. Progress Update – 2026-07-22 DA3-PHYS-02 Focused ADO Correction

Independent review of `abd58be3`/tree `b2cb210`/run `29939539390` approved the replacement-failure
synchronization and correction candidate with zero open P0–P3. The Human Architect accepted the
review and authorized the focused ADO-only correction. The runbook now requires the two seeded
Customers, prohibits additional Customer creation and preserves the exact two-receipt/four-audit
invariant. Focused publication `4d54dc2`, tree `ad9b6ba`, passed exact-head run `29941019865`,
attempt 1, 12/12.

This changes no readiness-domain rating or executable artifact. `DA3-PHYS-01`, `DA3-PHYS-02`, DA3
and DT-069–DT-074 remain open. Independent re-review and a new separate exact-bound Human
authorization remain mandatory before another run. Production, production data, deployment,
distribution, legal/privacy approval and DA4 productization remain separately gated.

## 27. Progress Update – 2026-07-22 DA3-PHYS-02 Correction Independent Re-Review

Independent exact-delta re-review bound the complete ADO-only correction and Evidence chain at
`4d54dc2`/tree `ad9b6ba` and `53ec139`/tree `9963960`, including exact-head runs `29941019865`
and `29941415806`, both 12/12, plus the unchanged APK. It verified the two exact seeded Customers,
the prohibition of additional Customer creation, Tag mapping, unchanged two-receipt/four-audit
invariant and all authority exclusions. Verdict `APPROVED FOR DA3-PHYS-02 ADO CORRECTION`; no open
P0–P3 review findings.

Review archive `030dbf6`, tree `8695708`, passed exact-head run `29942397982`, attempt 1, 12/12.
This changes no readiness-domain rating, executable artifact or physical result. `DA3-PHYS-01`,
`DA3-PHYS-02`, DA3 and DT-069–DT-074 remain open. At that checkpoint explicit Human acceptance and
a new separate exact-bound authorization remained mandatory before another run; Section 28 records
the later acceptance without execution authority. Production, production data, deployment,
distribution, legal/privacy approval and DA4 productization remain separately gated.

## 28. Progress Update – 2026-07-22 DA3-PHYS-02 Review Human Acceptance

The Human Architect accepted exact review archive `030dbf6`, tree `8695708`, run `29942397982`
12/12, and final Evidence sync `22ee463`, tree `3d70d5d`, run `29942786556` 12/12, as the binding
DA3-PHYS-02 correction review basis. The acceptance explicitly granted no Physical Gate.

This changes no readiness-domain rating, executable artifact or physical result. `DA3-PHYS-01`,
`DA3-PHYS-02`, DA3 and DT-069–DT-074 remain open. A later complete fresh V5 run still requires a
new separate exact-bound Human authorization. Installation, ADB/loopback, retry/resume,
production, production data, deployment, distribution, legal/privacy approval and DA4
productization remain unauthorized or separately gated.
