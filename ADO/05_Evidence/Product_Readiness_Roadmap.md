# Product Readiness Roadmap

Role: Research / Implementation Support acting on behalf of Technical Lead (per AGR-001)
Date: 2026-07-07
Companion Document: `ADO/05_Evidence/Product_Readiness_Assessment.md` (source of all evidence and category-level detail cited below)
Scope: Roadmap only, organized by commercial milestone rather than by category. No code implemented. No architecture, ADR, TTAP-001, FB-001, TS-001, Product Vision, or EP-008 content modified.

---

## How to Read This Roadmap

Each item below references the Product Readiness Assessment section it is drawn from. This roadmap does not introduce new findings; it resequences the same findings by *when they must be resolved*, rather than *what category they belong to*. Items are placed at the earliest milestone by which they must be resolved — an item listed "Before Pilot Customers" is a hard prerequisite for that milestone, not merely relevant to it. Where an item's owner is the Human Architect (a business, legal, or product-scope decision) rather than an engineering role, this is marked explicitly, since this roadmap cannot authorize or perform that decision itself.

**Strategic frame.** Consistent with the companion assessment's Section 0.1 and Section 12, "Product Capability" items below are read as extensions of TapTim.e's long-term Business Event Platform vision (Identity -> Organization -> People -> Assets -> NFC -> Business Events -> Business Engine -> Time Tracking), not as isolated feature requests — this is why, for example, "Organization Management" and "Customer/tag management" are grouped together below as capability work rather than described as unrelated features.

**Track structure (added in this revision, per Technical Lead review).** Within each milestone below, items are now grouped into three tracks so the type of work — and the type of owner it needs — is visible at a glance, without changing which milestone any item belongs to or reprioritizing existing work:

- **Engineering Track** — infrastructure, CI/CD, deployment, monitoring and operational tooling (Assessment Sections 1, 2, 6, 10).
- **Product Capability Track** — capability-hierarchy work per Assessment Section 12 (Identity, Organization, People, Assets/NFC registration, Business Events/Business Engine extensions, Time Tracking, Administration, Reports) (Assessment Sections 1, 3, 8).
- **Business, Legal & Go-To-Market Track** — pricing, legal/compliance, go-to-market and support-process decisions that are neither engineering implementation nor product-capability implementation (Assessment Sections 4, 5, 7, 9).

This grouping is an organizational presentation change only; it does not alter which milestone any item is assigned to, and it does not add, remove, or reprioritize any finding from the original roadmap.

---

## Now

Work that costs little, blocks nothing else, and should start immediately regardless of what else is prioritized next.

**Engineering Track**

- Stand up a minimal CI pipeline (typecheck + test on every push/PR) — near-zero cost, closes the single largest silent-regression risk in the repository today. (Assessment Section 2.)
- Make the backend/cloud persistence technology decision that ADR-0007 deferred at EP-007's founding — this single decision unblocks Technical Operations, Deployment, and Scaling Readiness simultaneously (Assessment Section 11) and has no reason to wait for other roadmap items to resolve first. (Sections 2, 6, 10, Human Architect.) Per Assessment Section 11.1, this remains the primary bottleneck for what a pilot needs to become durable and scalable — it should proceed now, in parallel with, not after, the Product Capability Track item below.
- Clear the Development Sprint 002/004 governance backlog (Review Agent verification, Human Architect approval) so it does not continue accumulating underneath new work. (Section 1, Technical Lead.)
- Refresh the root `README.md`, `CHANGELOG.md`, `Project_Status.md`, and `Roadmap.md` — all four currently describe a pre-Sprint-001 repository state and would actively mislead anyone (engineer, investor, pilot customer's technical contact) who reads them today. (Section 2, Technical Lead — governance housekeeping, no architecture change.)

**Product Capability Track**

- Begin Feature Blueprint / Technical Specification drafting for Organization Management (Organization, People, Assets capability layers per Assessment Section 12). Per Assessment Section 11.1's re-evaluation, this — not the backend technology decision — is the more foundational bottleneck for reaching the very first pilot, because no Feature Blueprint exists for it today and full implementation remains scheduled at the Before Pilot Customers milestone below; specification work has no reason to wait for that milestone to begin. This does not reprioritize the implementation item itself, only its specification start date. (Sections 3, 11.1, Human Architect scope decision + Technical Lead specification.)
- Resolve Finding F-01 (the duplicate-scan/toggle rule) — a Human Architect product decision within the Business Engine/Time Tracking capability layers, with no engineering dependency; every sprint since Sprint 002 has correctly deferred rather than guessed at it, but it should not remain open once real users are shown the product. (Section 1, Human Architect.)

**Business, Legal & Go-To-Market Track**

- Make an explicit software license decision for the repository (even "proprietary, all rights reserved" is a decision; today there is none). (Section 5, Human Architect.)

## Before Pilot Customers

Work required before any real company, even one running an informal, unpaid pilot, can be handed the product.

**Product Capability Track** *(led by Organization Management — the primary bottleneck for this milestone per Assessment Section 11.1)*

- Organization onboarding: a way (even a manually-assisted one) for a new Organization, its Administrators, and its Employees to be set up — today every identity is a hard-coded demo fixture. (Section 3/8, requires a new Feature Blueprint — Human Architect scope decision, Technical Lead specification.) Per Section 11.1, this is the single most consequential open item for reaching this milestone at all.
- Customer/AssignmentTarget and NFC tag management: a way for an Administrator to register an NFC tag and assign it to a real customer/target, without editing source code. (Section 3, new Feature Blueprint required.)
- Real NFC hardware integration in `apps/mobile` (a native NFC library wired to the existing `NfcScanPort`) — today only fake/CLI-simulated input exists; a pilot cannot scan a physical tag. (Section 3, Development Agent, once the mobile NFC library choice is made.)
- A minimal "view own time entries" screen — closes the loop so a pilot employee can see that their scan produced something real. (Section 3, new Feature Blueprint required — TTAP-001/FB-001/TS-001 currently have no component for this.)

**Engineering Track**

- A real backend/persistence target reachable from a pilot's devices (depends on the "Now" backend technology decision) — the current file-based local persistence (DT-015) is explicitly not designed for multi-device or multi-user durability. (Section 2/6, Development Agent, gated on the backend decision.) Per Section 11.1, a single-device, single-organization pilot could in principle proceed on the existing local persistence while this is finalized, provided the Product Capability Track item above (Organization Management) exists to configure that pilot distinctly.
- A mobile release mechanism that does not require a locally-run `expo start` — app store developer accounts, bundle identifiers, and a build/distribution pipeline (e.g. EAS Build) so a pilot user can actually install the app. (Section 6, Technical Lead/Development Agent.)

**Business, Legal & Go-To-Market Track**

- At minimum a placeholder Privacy Policy and Terms of Service, and an explicit internal decision on the GDPR data-processing basis and retention policy for the employee time/scan data a pilot will generate — given the product's German/EU market framing, this should be resolved before, not after, the first pilot organization's real employee data is processed. (Section 5, Human Architect + legal counsel.)
- Explicit guidance for pilot customers regarding works-council/employee-representation approval, given the product's nature as an employee time-tracking (and potentially monitoring-adjacent) system in the German market. (Section 5, Human Architect + legal counsel.)
- A pricing/packaging hypothesis, even if not charged during the pilot itself — costs nothing to define now and avoids an awkward conversation later about what a pilot is expected to convert into. (Section 4, Human Architect.)
- A defined ideal customer profile and pilot-acquisition channel. (Section 7, Human Architect. See also the companion assessment's Section 13 — repository evidence does not yet support a full Business Readiness category, so this remains tracked here under Go-To-Market.)
- A minimal support channel and communication process for pilot users (even "email the founder"). (Section 9, Human Architect.)

## Before First Paying Customers

Work required before TapTim.e can be sold, invoiced, and depended upon commercially, beyond an informal pilot relationship.

**Product Capability Track**

- Basic admin/reporting/export capability, if pilot feedback confirms it is a purchase requirement rather than a nice-to-have (ADR-0003 already lists this as in v1 scope; whether it is a pre-paid-launch requirement or a fast-follow is a Human Architect prioritization call informed by pilot feedback). (Section 3, new Feature Blueprint required — this extends the Business Events/Time Tracking capability layers per Assessment Section 12, not a standalone reporting feature.)

**Engineering Track**

- A CI-gated, environment-separated (dev/staging/production) deployment pipeline for the chosen backend, plus monitoring, error tracking, and structured logging — an unpaid pilot can tolerate manual operational attention; a paying customer should not depend on it. (Section 2, Technical Lead/Development Agent.)
- Resolve the remaining Development Sprint 002/004/005-narrative governance backlog if not already cleared in the "Now" phase — a paying customer's technical due diligence (if any) should not find open review gaps in the engineering record. (Section 1, Technical Lead.)

**Business, Legal & Go-To-Market Track**

- A billing/subscription mechanism (or a manually-invoiced interim process, if simpler at this stage) implementing the pricing hypothesis validated during the pilot phase. (Section 4, Human Architect decision + Technical Lead/Development Agent integration.)
- Full GDPR documentation appropriate for a paying commercial relationship: a Data Processing Agreement template for customers, a finalized data retention/deletion policy, and a data residency commitment tied to whatever backend hosting decision was made. (Section 5, Human Architect + legal counsel.)
- Full go-to-market materials: positioning, a marketing/landing presence, and sales collateral distinct from the internal Product Vision document. (Section 7, Human Architect.)
- Formal support runbooks and, at minimum, an informal SLA commitment appropriate for the first paying customers' expectations. (Section 9, Human Architect.)

## Before 100 Customers

Work required to operate reliably at a scale where manual, founder-mediated processes for onboarding, support, and operations no longer hold.

**Product Capability Track**

- A self-serve or substantially automated onboarding flow, replacing whatever manually-assisted process was used for pilots and early paying customers. (Section 8, Technical Lead/Development Agent, once the onboarding model is proven with early customers — this is the Organization/Identity capability layers, per Assessment Section 12, maturing from manually-assisted to self-serve.)

**Engineering Track**

- Multi-tenant data isolation validated against the real, chosen backend under realistic concurrent load — not just the in-process unit tests that validate it today. (Section 10, Technical Lead.)
- A rate-limiting/quota strategy per organization, and a capacity/cost model that scales with customer count. (Section 10, Technical Lead.)
- Mobile-native local storage (`expo-sqlite`/`AsyncStorage` or equivalent), if not already done earlier, so on-device durability does not depend on the desktop-oriented `packages/core` file adapters built in Development Sprint 010 — this was always scoped as a smaller, separate follow-up to DT-015. (Section 1/10, Development Agent.)

**Business, Legal & Go-To-Market Track**

- A status page and more formal incident-communication process. (Section 9, Human Architect/Technical Lead.)
- Consideration of a formal compliance certification (SOC 2, ISO 27001), typically driven by customer procurement requirements appearing around this scale, not before. (Section 5, Human Architect — cost/benefit decision informed by actual customer demand.)

## Before 1,000 Customers

Work required for TapTim.e to operate as a mature, scaled SaaS platform.

**Product Capability Track**

- Reassess whether TapTim.e's long-term vision (`Product_Vision.md` Section 6 — "eine Plattform für Arbeitsereignisse," a broader work-events platform beyond time tracking) should begin architecturally, now that a large, real customer base provides validated demand signal for which direction to extend. (Section 3, Human Architect — this is explicitly a future product-strategy decision, not something this roadmap resolves.) This is the natural point to evaluate extending the capability hierarchy (Assessment Section 12) beyond NFC and Time Tracking into additional trigger types or Business Event applications.

**Engineering Track**

- Full horizontal scaling strategy and load testing for the chosen backend/compute model under realistic 1,000-organization concurrent usage. (Section 10, Technical Lead.)
- A mature, tested disaster-recovery and backup strategy, exercised (not just documented) at this scale. (Section 2, Technical Lead.)
- Revisit ADR-0007's platform baseline and every other ADR/TTAP-001 assumption made at Sprint 1 scale (a standing "Review Trigger" already exists on several ADRs — e.g. ADR-0005 "must be revisited before implementing additional trigger types," ADR-0007 "shall be revisited when... implementation evidence contradicts this platform baseline") against several years of real production evidence, rather than assuming Sprint-1-era decisions still hold unchanged. (Section 1, Technical Lead + Human Architect.) This is also the natural trigger point for a scheduled reassessment per the companion assessment's Section 15 (Long-term Governance).

**Business, Legal & Go-To-Market Track**

- A dedicated support/customer-success function, distinct from the founding engineering team. (Section 9, Human Architect.)

---

## Addendum (2026-07-10)

Following an external CTO review of the repository (`ADO/05_Evidence/External_CTO_Review_Triage_2026-07-10.md`) and the resulting `ADO/05_Evidence/Core_Roadmap_v2_Commercial_Readiness.md`, this addendum reprioritizes the "Now" and "Before Pilot Customers" sections above to reflect twelve independently re-verified findings (K1–K12). This is an addendum, not a rewrite: no existing item's wording is removed, and Core Roadmap v2 is the authoritative sequencing document going forward for the items named below — this roadmap's own milestone structure and per-category detail (Sections above) remain the reference for everything this addendum does not touch.

**Now (reprioritized, per Core Roadmap v2 Block A):**

- F-01 TimeEntry Start/Stop resolution — no longer merely "should not remain open once real users are shown the product" (original wording above); this is now the single highest-priority item, since `TimeEntry`'s own type only supports a `started` state and every repeat scan escalates with no resolution path (Finding K3). See Core Roadmap v2 Block A, DT-029–DT-033.
- Backend technology ADR — unchanged in substance from the original "Now" item above, now additionally scoped to explicitly address the async port migration risk (Finding K7): every port in the repository is currently synchronous, and this must be resolved before, not after, backend persistence work begins. See Core Roadmap v2 Block B, DT-036/DT-038/DT-039.
- CI/test typecheck enforcement — the original "Now" item ("stand up a minimal CI pipeline") is reaffirmed and extended: `.github/workflows/` still contains no workflow (Finding K8), and `packages/core/tsconfig.json`'s `"include": ["src"]` still excludes `tests/` from typecheck (Finding K9, a standing finding since DT-024). See Core Roadmap v2 Block A, DT-034/DT-035.
- Runtime composition root — a new item, not present in the original "Now" section: Organization Management (DT-017–DT-026) is code/test-complete but not runtime-reachable, and the mobile app's `ScanScreen` still runs a hard-coded demo pipeline (Finding K1). See Core Roadmap v2 Block C, DT-045–DT-047.
- Real authentication — a new item: `LoginScreen` constructs `FakeAuthenticationGateway` directly (Finding K4). See Core Roadmap v2 Block C, DT-049–DT-052.
- NFC payload strategy and physical NFC validation — the original "real NFC hardware integration" item (listed under "Before Pilot Customers" below) is split: the payload strategy decision moves to "Now" because it is a prerequisite decision, not implementation effort, while physical validation remains gated on real NFC port wiring first (Finding K2). See Core Roadmap v2 Block D, DT-053/DT-058.

**Before Pilot Customers (reprioritized, per Core Roadmap v2 Blocks D–G):**

- Server persistence and tenant isolation — reaffirms the original "a real backend/persistence target reachable from a pilot's devices" item, now explicitly gated on the Backend Technology ADR and the async port migration (both moved to "Now" above). See Core Roadmap v2 Block B, DT-040–DT-044.
- Organization setup flow — reaffirms the original "Organization onboarding" item; now explicitly scoped as a generic, code-edit-free setup flow for Organization/Membership/Customer/NfcTag/NfcAssignment. See Core Roadmap v2 Block E, DT-063–DT-066.
- Mobile distribution — reaffirms the original "a mobile release mechanism that does not require a locally-run `expo start`" item; confirmed still entirely absent (no `eas.json`, placeholder `app.json`, Finding K11). See Core Roadmap v2 Block G, DT-075–DT-078.
- Sync gateway — a new item, not distinctly named in the original "Before Pilot Customers" section: `FakeSynchronizationGateway` is the only implementation in the repository (Finding K6). See Core Roadmap v2 Block E, DT-060–DT-062.
- Correction/audit — a new item: manual TimeEntry correction with a reason and an append-only audit log, both prerequisites for a credible pilot once Start/Stop exists. See Core Roadmap v2 Block F, DT-069–DT-071.
- Export — a new item: CSV export of time records, closing the loop so a pilot employee/administrator can see and extract real data. See Core Roadmap v2 Block E, DT-067/DT-068.
- Legal/privacy external review — reaffirms the original "Privacy Policy/Terms of Service/GDPR data-processing basis" items; explicitly reframed as elapsed-calendar-time work, not sprint-time work (Finding K12), and sequenced to partially overlap Blocks F/G rather than strictly follow them. See Core Roadmap v2 Block H, DT-079–DT-084.

**Before First Paying Customers (unchanged in substance, cross-referenced):** the original items above (admin/reporting/export if pilot feedback confirms it, CI-gated deployment pipeline, billing, full GDPR documentation, go-to-market materials, support runbooks) remain valid and are now cross-referenced to Core Roadmap v2 Block H (DT-085–DT-089) and Block I (UI/UX productization, explicitly sequenced last/parallel, not before the runtime foundation).

This addendum does not change the "Before 100 Customers" or "Before 1,000 Customers" milestones above; neither was materially touched by the external CTO review's findings.

## Addendum (2026-07-13 — Block A K3/K8/K9 Disposition)

The original "Now" items and the 2026-07-10 reprioritization above are retained as creation-time
chronology, not current open work. Core Roadmap v2 Block A subsequently closed K3, K8 and K9:
DT-029–DT-033 delivered the engine-driven started/stopped TimeEntry lifecycle in commits `f5a0027`,
`d8d3833` and `72eb03d`; DT-034 added `.github/workflows/ci.yml` for push/PR CI in `b2004ea`; and
DT-035 added `packages/core/tsconfig.typecheck.json` plus the tests-inclusive Core typecheck script in
`2493f17`. GitHub Actions run `29216961546` passed.

These three findings are completed, not current "Now" backlog. The source-only
`packages/core/tsconfig.json` remains the build configuration and does not contradict the separate
tests-inclusive typecheck configuration. This disposition closes no later roadmap item and grants no
additional authority. Evidence:
`ADO/02_Development/Block_A_Core_Truth_and_Reliability_Closure.md`.

## Addendum (2026-07-14 — C3A Organization Administration Architecture)

The historical "Now" and 2026-07-10 findings above remain provenance, but their implementation-state
claims have advanced. CI, engine Start/Stop, backend/Auth/tenant foundations, real product Mobile
composition and Android NFC validation are now complete for their recorded scopes. FB-002 v1.2,
TS-002 v1.2 and ADR-0011 passed independent C3A re-review/Human Architect acceptance plus the narrow
C3B feasibility pre-review. C3B alone passed implementation, independent final review and exact-head
nine-job CI; C3C–C3E remain gated.

Organization setup remains a Before-Pilot prerequisite and is now sequenced more precisely:

1. **C3B:** private operator-only first Organization/Administrator bootstrap, migration `006`,
   durable receipt, truthful audit and security matrix;
2. **C3C:** normal tenant-safe Admin setup backend/API with required Customer/Tag display names,
   protected canonical UID handling and atomic first Tag registration/Assignment;
3. **C3D:** minimal Admin Web plus protected Android Administrator capture after the C3C contract is
   approved;
4. **C3E:** later, separately authorized identity-first Employee Membership setup and explicit
   reassignment after their policy gates.

C3A itself implemented none of these surfaces. Its later acceptance did not authorize them
automatically; only C3B received and completed a separate implementation authorization.
DT-063–DT-066 remain open until the end-to-end
operational setup flow and its human/physical gates pass. Core Roadmap v2 remains the authoritative
execution sequence.

## Addendum (2026-07-15 — C3C Local Implementation Checkpoint)

The 2026-07-14 C3A/C3B addendum above remains the state recorded at that date. The Human Architect
subsequently authorized C3C on exact baseline `c1148d57`; TS-002 v1.3 froze its transport and
deadline details. The normal tenant-safe Admin setup backend/API is now implemented locally and its
Node-24/PostgreSQL-17 matrix passes 1,394 tests plus complete workspace typechecks/builds and Android
export. Every implementation/precommit finding reported so far was corrected, including the
receipt/resource binding, race, normalization and C3B function-owner compatibility cases.

This is not a C3C closure. No implementation SHA or CI run is claimed; independent final review and
exact-head ten-of-ten GitHub Actions CI remain pending. C3D/C3E and production remain unauthorized.
DT-063–DT-066 remain open because a backend alone is not the complete code-edit-free operational
setup flow: the Admin Web, protected Android Administrator capture and required human/physical gates
still have to be separately authorized, implemented and approved.

## Addendum (2026-07-15 — C3C Repository Closure)

The local checkpoint above is retained as chronology. C3C implementation commit
`b90729a0a4b325f523cd98ea5a741defb00155f6`, parent
`c1148d57edb12312a102f090715c4b28308f6347` and tree
`671be72784f68b9437a9f53e251acbbb22ce3e97` subsequently passed the complete 1,394-test matrix,
all workspace checks and three independent exact-SHA final-review tracks. Database/security,
governance/CI and complete-diff review each returned `APPROVED` with zero open P0/P1/P2/P3.
GitHub Actions run `29375259275` is bound to that exact implementation SHA on `main` and passed all
ten jobs.

C3C repository implementation is therefore closed. This changes no roadmap order and does not
claim operational setup, production readiness, cloud deployment or production-data authority.
C3D Admin Web/protected Android capture and C3E Membership/reassignment remain separately
unauthorized; DT-063–DT-066 remain open until their UI, identity, human and physical gates pass.
ADO-only closure-publication commit `9c79c6d2f2166d22cc61bfbc03ba79c434bbbfe0` subsequently passed all
ten jobs in exact-head GitHub Actions run `29376668158`; this publication fact changes no roadmap
order or authority.

## Addendum (2026-07-15 — EP-009 Evidence-Triggered Reassessment)

The additive reassessment at
`ADO/05_Evidence/Product_Readiness_Reassessment_2026-07-15.md` evaluates current tracked evidence
through final C3C baseline `fda5e5b9e878311b0caa647c6b49ab14943b706e`. It preserves every earlier
dated item above as chronology and supplies the current K1–K12 disposition and ten-domain scorecard.

K1–K5 and K7–K9 are closed for their explicitly approved repository/device scopes. K6 remains open
outside the narrow E1/E2A evidence path; K10 remains as a legacy-adapter risk despite removal from the
product Mobile authority path; K11 has internal EAS/APK evidence but no pilot/store distribution; and
K12 remains open. Engineering stays Established. Product, Deployment, Technical Operations, Customer
and Scaling advance to Developing based on real repository evidence, while Business, Commercial,
Legal/Compliance and Support remain Emerging. No domain is Advanced.

The current critical path remains C3D, C3E, the rest of Block E, then Blocks F/G and the parallel
elapsed-time Block-H/legal-commercial work. This addendum does not reorder Core Roadmap v2, authorize
the next slice, claim a live Supabase/production system or authorize production personal data.

Independent final review of exact closure head
`9c9144fa468cbaa6d1195a172f92e746ad3eb265` approved the complete K1–K12 disposition, scorecard and
authority boundaries. No repository finding remains open after disposition. The Human Architect
accepted the reassessment on 2026-07-15. Evidence:
`ADO/05_Evidence/EP-008/EP-008_Post_Sprint_019_Independent_Final_Review.md` and
`ADO/02_Development/EP-008_Post_Sprint_019_Human_Acceptance.md`.

## Addendum (2026-07-15 — C3D Closure Delta and C3E Split)

The Human-accepted additive delta at
`ADO/05_Evidence/Product_Readiness_Reassessment_2026-07-15_C3D_Closure_Delta.md`
is the formal current readiness baseline. That delta is triggered by C3D's
later completed repository/Human physical scope on closure baseline
`a0419866c2b992ae8fc5474144064bc0652d215a`, including exact-head ten-of-ten run `29407078949`.

The proposed scorecard does not upgrade any domain: Engineering remains Established; Product,
Deployment, Technical Operations, Customer and Scaling remain Developing; Business, Commercial,
Legal/Compliance and Support remain Emerging. C3D materially closes the first protected setup UI
and physical provisioning proof, but it does not establish production deployment, pilot operation,
legal readiness, support maturity or market validation.

Independent read-only review of publication commit `4e3ae76` found this scorecard and critical-path
delta acceptable. Its overall `CHANGES REQUIRED` verdict concerned six separate C3E1 contract P2
findings only; the Human Architect subsequently accepted this readiness delta.

The former C3E planning item is split into separately governed boundaries: C3E1 identity-first
Employee Membership setup has a zero-finding reviewed, Human-accepted contract. Initial
implementation `42b7c7a` was published and passed exact-head ten-of-ten run `29414515751`, but final
review returned `CHANGES REQUIRED`; the six-finding correction is locally verified while external
exact-head CI confirmation and independent delta re-review remain pending. C3E2 explicit Tag
reassignment remains unauthorized. The current critical path is therefore C3E1 correction
CI/delta re-review and its later Human Gate, C3E2, the rest of Block E, Blocks F/G
and parallel elapsed-time Block-H/legal-commercial work. This
addendum changes no original roadmap milestone. C3E1 implementation authority is governed only by
its separate accepted package; no production-data authority follows.

## Revision Note (Technical Lead Review Follow-up, 2026-07-07)

This roadmap was updated once, after Technical Lead review, to: (1) add the "Strategic frame" paragraph above, connecting roadmap items to the companion assessment's Business Event Platform framing (Section 0.1) and capability hierarchy (Section 12); (2) organize every milestone's existing items into an Engineering Track, a Product Capability Track, and a Business, Legal & Go-To-Market Track, without adding, removing, or reprioritizing any item, and without moving any item to a different milestone; (3) note, within the Now and Before Pilot Customers milestones, the re-evaluated primary-bottleneck finding from the companion assessment's Section 11.1 (Organization Management as the more foundational blocker for reaching the first pilot, alongside — not instead of — the backend technology decision). No original roadmap item's wording, milestone assignment, or substance was changed; this revision only added track labels, short cross-reference notes, and this closing note.

## Role Handover

See `ADO/05_Evidence/Product_Readiness_Assessment.md` Section 16 for the full Role Handover covering both documents produced in this task and this revision.

## Stop Condition

Per original task instruction, the 2026-07-07 roadmap stopped after the roadmap and companion assessment. The 2026-07-10 addendum was added later as a targeted roadmap update following the External CTO Review and Core Roadmap v2 rebaseline. No implementation was created by this addendum. Awaiting Technical Lead / Human Architect review.
