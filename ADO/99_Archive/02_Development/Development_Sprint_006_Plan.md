# Development Sprint 006 Plan – First User Interaction (Mobile Foundation)

Status: Planned
Role: Research / Implementation Support acting on behalf of Technical Lead (per AGR-001)
Epic: EP-007 – Product Architecture Foundation
Owner: Technical Lead
Approval Authority: Human Architect
Branch: `main`
Created Date: 2026-07-05
Related Development Task: **DT-012 (new — justified in Section 10)**; extends DT-011's composition root
Related Artifacts: `EP-007_Development_Tasks.md`, `Development_Sprint_001_Plan.md`–`Development_Sprint_005_Plan.md`, `MVP_Readiness_Assessment.md`, TTAP-001, TS-001, FB-001, ADR-0004, ADR-0006, ADR-0007

---

## 1. Executive Summary

The Technical Lead's proposal — make Sprint 006 the first user-facing sprint, scoped strictly to a Mobile Foundation (Expo/React Native scaffold, bootstrap, navigation shell, Composition Root integration, placeholder scan flow, no auth/backend/real NFC) — is **accepted, and repository evidence shows it is better-sequenced than the roadmap this Research/Implementation Support role proposed in `MVP_Readiness_Assessment.md`**. That prior assessment recommended Identity & Backend Foundation first; on review, ADR-0007 already decides the mobile framework (React Native/Expo) as an Approved architectural baseline — only the *exact* backend/auth technology is deferred. A Mobile Foundation scaffold therefore requires **no pending Human Architect decision** to begin, while Identity & Backend Foundation does. Repository evidence supports doing the unblocked work first: Sprint 006 as proposed.

## 2. Repository Evidence

- `apps/` contains only `.gitkeep` (verified by direct listing) — no mobile app of any kind exists yet.
- `ADR-0007-technology-platform-baseline.md` Decision section: "Mobile Application → React Native / Expo baseline → Native NFC capability... → Local offline-capable persistence → Explicit synchronization boundary → Backend services." This is an **Approved, Validated** decision (AVR-001: "ADR-0007 | ... | Validated | ... | APPROVED"), not an open question — only "the exact implementation libraries and service configuration" are deferred to later Technical Specification/Development Tasks. Scaffolding an Expo/React Native project therefore implements an already-approved decision; it does not require a new one.
- `ADR-0007` Platform Boundaries, "Domain Platform": "The domain and Business Engine shall remain independent from: React Native components, Expo APIs, native NFC implementation details, Firestore or any persistence API, UI navigation." This directly requires what the sprint goal already states: no business logic duplicated in the mobile app.
- `packages/core/src/index.ts` already exports the full Business Core surface (domain types, ports, business classes, application services, in-memory/fake infrastructure) — verified by direct inspection; every class Sprint 001–005 built is a public export of `@taptime/core` today, ready to be consumed by another workspace package.
- `packages/core/src/cli/runScan.ts`'s `buildScanDemoPipeline` (DT-011, Development Sprint 005) is the **first and only composition root** in the repository; it is currently **not** re-exported from `packages/core/src/index.ts` (verified by direct inspection of the export list) — it can only be run via the CLI script today, not imported by another package. This is the one small, justified extension this sprint needs from `packages/core` itself (Section 8).
- Root `package.json` workspaces glob is already `["packages/*", "apps/*"]` — an `apps/mobile` package will be picked up by the existing npm workspace configuration with no root-level change required.
- `packages/core/tsconfig.json`/`tsconfig.base.json` use `"module": "ESNext"`, `"moduleResolution": "Bundler"` — this is the first time in the repository that another package (Metro/Expo's bundler) would need to resolve `@taptime/core` from outside its own test runner; no prior sprint has exercised this cross-package consumption path, which is flagged as a risk (Section 11), not assumed to work.
- `MVP_Readiness_Assessment.md` Section 9.1 (MVP-B01) already identifies "No mobile application exists" as a BLOCKER; this sprint directly closes that blocker's foundation, without yet closing MVP-B03 (real NFC hardware), which the sprint goal itself defers ("no real NFC yet").
- FB-001 Out of Scope: "Detailed UI design," "Database schema," "Backend implementation" — consistent with this sprint's own Out of Scope list; TS-001's Deployment/Security/Persistence sections are not exercised by a foundation-only sprint.
- `EP-007_Development_Tasks.md` Task Sequence (DT-001–DT-011) contains no task for mobile application scaffolding — verified by re-reading every DT's Objective; this is a genuine gap, not a duplicate of existing scope (Section 10).

## 3. Why Sprint 006 Is the Correct Next Sprint

**Accepted, with a self-correction relative to prior guidance.** `MVP_Readiness_Assessment.md` (this same role, previous turn) recommended "Sprint 006 — Identity & Backend Foundation" before "Sprint 007 — Mobile App Skeleton." Re-reading ADR-0007 for this task shows that recommendation under-weighted one fact: the mobile *framework* choice (React Native/Expo) is already Approved and Validated — it is not one of the open decisions ADR-0007 defers. Only the backend/auth *technology* (Firebase vs. an alternative) is genuinely undecided, and only that piece requires a Human Architect decision before implementation can begin. A Mobile Foundation scaffold that explicitly excludes auth/backend/Firebase/Firestore (this sprint's own Out of Scope list) has **no undecided dependency** standing in its way today. Per "Repository before Assumptions" and "Reality has priority over architecture," the correct action is to update the recommendation: do the unblocked work (Mobile Foundation) now, and treat Identity & Backend Foundation as the sprint that follows once the Human Architect has made the deferred technology decision — not the other way around. This does not contradict the MVP Readiness Assessment's overall roadmap shape; it re-orders two adjacent, mutually-independent sprints based on which one is actually blocked.

This is also the most direct way to retire `MVP_Readiness_Assessment.md`'s MVP-B01 finding ("No mobile application exists ('install the app' is impossible)") using only already-approved architecture, and it gives Sprint 007 onward a real runtime to build against instead of a second, parallel "what if we had a mobile app" design exercise.

## 4. Business Objective

Give a developer (and, once Sprint 007+ add real auth/NFC, eventually an employee) something they can actually launch on a device or simulator and tap, closing the gap between "the Business Core works" (proven in Sprint 005) and "the product exists as an app" — without inventing any new business behavior, per Product Vision's "One Tap. One Decision." applying equally to however the tap is captured.

## 5. Technical Objective

Stand up `apps/mobile` as an Expo/React Native project (per ADR-0007), depending on `@taptime/core` as a workspace package, with a minimal navigation shell and one screen that invokes the existing DT-011 composition root (extended just enough to be importable) and renders its outcome — proving the Business Core can run inside a real mobile JavaScript runtime, not only inside Vitest or Node's `tsx`.

## 6. Scope

- A new `apps/mobile` Expo/React Native project (TypeScript template), added to the existing npm workspaces.
- A dependency from `apps/mobile` on `@taptime/core` (workspace reference), with no copy-pasted or re-implemented business logic.
- Minimal application bootstrap (Expo entry point, root component).
- A minimal navigation foundation (even a single-screen "navigator" is acceptable — the point is establishing the pattern, not building out multiple screens).
- One small, justified extension to `packages/core`: re-export the existing DT-011 composition root factory (`buildScanDemoPipeline`, or a neutrally-renamed equivalent) from `packages/core/src/index.ts` so `apps/mobile` can import and call it — this is exposing existing DT-011 code, not writing new business logic.
- One placeholder scan screen: a button or text input (not real NFC hardware — none exists yet, per Section 2) that triggers the same composition root already proven in Sprint 005, and a way to render its outcome (reusing `ScanResultPresenter`'s output strings in a native `Text` component — not a redesign of presentation logic, just displaying the existing strings).
- Minimal project-level tooling needed for the above to run and be testable (Expo config, TypeScript config extending `tsconfig.base.json`, a package.json with the appropriate scripts).

## 7. Out of Scope

- Firebase, Firestore, any backend or database — unchanged from every prior sprint's deferral (ADR-0006/ADR-0007); this sprint adds no new persistence or network code.
- Authentication / login — `apps/mobile` invokes the composition root with the same hard-coded demo `CallerContext` pattern DT-011 already established; no login screen, no session.
- Real NFC hardware / native modules — explicitly deferred per the sprint goal ("no real NFC yet if repository evidence does not support it"); repository evidence (Section 2) confirms no native NFC integration exists to build on, so this remains a placeholder (button/text-input) trigger, matching `CliNfcScanAdapter`'s shape conceptually but adapted for a mobile UI event instead of CLI argv/stdin.
- Synchronization backend — `SynchronizationService` continues to run only against `FakeSynchronizationGateway`, unchanged.
- Admin Web, Reporting — no such capability is touched.
- Production deployment — no app store submission, no build signing, no CI/CD pipeline changes.
- Final UI design — the screen(s) built this sprint are functional placeholders, not a designed product UI; this is explicit in the sprint goal.
- Any change to DT-001–DT-011 business logic, FB-001, TS-001, TTAP-001, ADRs, or EP-008.

## 8. Existing Components (Reused, Not Recreated)

| Component | File | Reused As |
|---|---|---|
| `buildScanDemoPipeline` composition root (DT-011) | `packages/core/src/cli/runScan.ts` | The one and only place scan-to-sync wiring exists; re-exported (not rewritten) for mobile consumption. |
| `ScanResultPresenter` (DT-011) | `packages/core/src/application/ScanResultPresenter.ts` | Its rendered strings are displayed as-is in a native `Text` component; no new presentation logic. |
| `CliNfcScanAdapter` (DT-001 extension) | `packages/core/src/infrastructure/adapters/CliNfcScanAdapter.ts` | Reference pattern for the mobile placeholder trigger's shape (`NfcScanPort` with a settable input), not reused directly since its input source (argv/stdin) is CLI-specific. |
| Every DT-001–DT-008 business/application/infrastructure class | `packages/core/src/{domain,business,application,infrastructure,ports}` | Consumed unmodified via the `@taptime/core` package export; none of it is duplicated inside `apps/mobile`. |
| npm workspaces configuration | root `package.json` | Already includes `apps/*`; no root change needed. |

## 9. Mobile Components (New This Sprint)

| Component | Type | Location (proposed) |
|---|---|---|
| Expo/React Native app scaffold | Project | `apps/mobile/` (Expo TypeScript template) |
| Application bootstrap / root component | Mobile app code | `apps/mobile/App.tsx` (or Expo Router equivalent) |
| Navigation foundation | Mobile app code | `apps/mobile/src/navigation/` (minimal — single screen acceptable) |
| Placeholder scan screen | Mobile app code | `apps/mobile/src/screens/ScanScreen.tsx` (or equivalent) — invokes the composition root, displays its outcome |
| Mobile-side placeholder scan trigger | Mobile app code | Part of `ScanScreen`; a button/text-input event, not a new `NfcScanPort` implementation unless the Development Agent finds the existing composition root's input shape awkward to drive from a UI event (see Section 16) |

## 10. Development Task Mapping

- **`packages/core` export extension (reused, not a new DT)** — re-exporting `buildScanDemoPipeline` from `index.ts` is a direct, minor extension of DT-011's existing Acceptance Criteria ("A runnable entry point exists...") to also be *importable*, not new business logic; it does not warrant a separate Development Task.
- **DT-012 (new) — Mobile Application Foundation.** Repository evidence (Section 2) shows no existing DT-001–DT-011 Objective covers mobile application scaffolding, bootstrap, navigation, or a mobile-hosted composition-root screen. Per the standing instruction to create new DT identifiers only when no existing DT covers the work, and to propose new IDs after the existing sequence without implementing them without approval: DT-012 is proposed here for Human Architect/Technical Lead approval, not yet implemented.
  - Objective: Establish `apps/mobile` as a runnable Expo/React Native application that depends on `@taptime/core` and invokes its existing DT-011 composition root from a real mobile JavaScript runtime, without duplicating any business logic.
  - Acceptance Criteria: `apps/mobile` exists as a workspace package and launches in the Expo development environment; it depends on `@taptime/core` and imports the composition root rather than re-implementing any part of it; a placeholder scan interaction (button/text-input, not real NFC) triggers the composition root and displays its outcome on-screen; no persistence, network, or auth code is added inside `apps/mobile`; `packages/core`'s business/application/domain code is unchanged except for the export extension described above.

## 11. Testing Strategy

- Unit tests for any new, genuinely new logic only — the scan screen's event handler mapping a UI event to the composition root's existing `scan(payload)` call should be thin enough to need at most a shallow render/interaction test, not a business-logic test suite (all business logic remains tested where it already lives, in `packages/core`).
- No new tests are needed for `packages/core`'s business logic — it is unchanged.
- A manual verification step is expected and should be documented: launch `apps/mobile` in the Expo development client/simulator, trigger the placeholder scan, and confirm the on-screen result matches what `npm run demo:scan` already produces via the CLI for the same input — proving the mobile runtime produces identical outcomes to the already-proven Sprint 005 demonstration, not a divergent implementation.
- If the Development Agent's environment cannot run a full Expo/Metro build (e.g. no simulator/device available in this environment), that limitation must be documented explicitly as a known constraint in the implementation notes rather than silently skipped or worked around by weakening scope.

## 12. Risks

| Risk | Mitigation |
|---|---|
| `@taptime/core`'s ESM/Bundler TypeScript output may not resolve cleanly through Metro (Expo's bundler) — this cross-package consumption path has never been exercised before (Section 2) | Treat "prove `apps/mobile` can import and call one function from `@taptime/core`" as the first implementation step (Section 17), before building any UI, so this risk is discovered immediately rather than after a full screen is built. |
| Business logic quietly gets re-implemented inside `apps/mobile` "just to make the UI event work" | DT-012's Acceptance Criteria explicitly forbid this; the mobile screen must call the existing composition root, not reconstruct any part of the pipeline. |
| Scope creep into real NFC, auth, or backend "since we're in the mobile app now" | Section 7's Out of Scope list is explicit and mirrors the sprint goal's own instruction; a placeholder trigger only. |
| No device/simulator available in the Development Agent's execution environment to prove a real launch | Documented as a known constraint (Section 11) rather than silently claimed as verified; Review Agent/Human Architect should confirm on a real environment before DT-012 is marked Completed. |
| Navigation foundation over-built for a one-screen sprint | Scope explicitly allows "even a single-screen 'navigator'"; do not add multi-screen flows not required by this sprint. |

## 13. Definition of Done

- `apps/mobile` exists, is picked up by the existing npm workspaces configuration, and launches in the Expo development environment (or the limitation is explicitly documented per Section 11).
- `apps/mobile` depends on `@taptime/core` and imports its composition root; no business logic is duplicated inside `apps/mobile` (verified by review: `apps/mobile` should contain no `business/`, `domain/`, or persistence code of its own).
- A placeholder scan screen exists, triggers the composition root, and displays its outcome.
- `packages/core/src/index.ts` re-exports the composition root; `npm run typecheck` and `npm run test` still pass across the monorepo (existing 81 tests unaffected).
- `EP-007_Development_Tasks.md` gets a new `## DT-012 – Mobile Application Foundation` section (Objective/Acceptance Criteria as in Section 10) plus a "Development Sprint 006 Implementation Notes" subsection under it.
- No change to DT-001–DT-011 business logic, FB-001, TS-001, TTAP-001, any ADR, Product Vision, or EP-008.
- Review Agent verification and Human Architect approval are recorded before DT-012 is marked Completed (DTP-001: "Implementation alone never completes a Development Task").

## 14. Recommended Implementation Order

1. **Spike first:** scaffold the bare minimum Expo/TypeScript project under `apps/mobile`, add a dependency on `@taptime/core`, and prove a single import + function call resolves and runs (Section 12's top risk) before building any screen.
2. Once resolved, extend `packages/core/src/index.ts` to re-export the DT-011 composition root factory.
3. Build the minimal application bootstrap / root component.
4. Add the minimal navigation foundation (single screen is acceptable).
5. Build the placeholder scan screen: a button/text-input trigger, calling the composition root, rendering its outcome via the existing `ScanResultPresenter` strings.
6. Manually verify the mobile app's output matches the CLI demo's output for the same input.
7. Run `npm run typecheck` and `npm run test` for the whole monorepo.
8. Add the new `DT-012` section to `EP-007_Development_Tasks.md` with Sprint 006 implementation notes.
9. Produce implementation evidence (including how to launch and manually verify the app) and role handover; request Review Agent verification.

---

## 15. Development Agent Prompt

The following prompt is written to be given directly to Claude Code (Development Agent) to execute Development Sprint 006. It is self-contained and does not require this planning document to be re-explained.

```text
You are the Development Agent for TapTim.e, implementing Development Sprint 006 ("First User Interaction" / Mobile Foundation) on branch `main`. This introduces the repository's first `apps/*` package.

CONTEXT (verify before writing code):
- Read `ADO/02_Development/Development_Sprint_006_Plan.md` in full — it is the authoritative scope for this task, including why this sprint does NOT include auth, backend, or real NFC hardware (Sections 3 and 7).
- Read `ADO/01_Architecture/ADR/ADR-0007-technology-platform-baseline.md` for the approved mobile baseline (React Native/Expo) and its Platform Boundaries ("domain and Business Engine shall remain independent from React Native components, Expo APIs...").
- Read `packages/core/src/index.ts` for the full current export surface of `@taptime/core`.
- Read `packages/core/src/cli/runScan.ts` (`buildScanDemoPipeline`) — this is the composition root you will expose to and invoke from the mobile app. Do not reimplement it.
- Read `packages/core/src/application/ScanResultPresenter.ts` for how outcomes are already rendered as strings.
- Do not modify any DT-001–DT-011 business logic, FB-001, TS-001, TTAP-001, any ADR, Product Vision, or EP-008.

IMPLEMENTATION SCOPE (do exactly this, nothing more, in this order):
1. FIRST, as a spike: scaffold a minimal Expo TypeScript app under `apps/mobile`, add `@taptime/core` as a workspace dependency, and prove that a single import and function call from `@taptime/core` resolves and runs inside the Expo/Metro toolchain. If this does not work cleanly, stop and document the exact blocker in your implementation notes rather than working around it with a duplicated/simplified reimplementation of business logic.
2. Once the import path is proven, extend `packages/core/src/index.ts` to re-export `buildScanDemoPipeline` from `./cli/runScan` (rename it if a clearer public name is warranted, e.g. `createScanCompositionRoot`, but keep its behavior identical).
3. Build a minimal application bootstrap (Expo entry point / root component) and a minimal navigation foundation — a single-screen "navigator" is sufficient; do not build multiple screens or flows not required by this sprint.
4. Build one placeholder scan screen: a button or text input representing a scan trigger (not real NFC — no native NFC module exists yet and none should be added), which calls the composition root's `scan(...)` function and then its `synchronizePending(...)` function, and displays the resulting outcome strings (from `ScanResultPresenter`, already returned/consumed inside the composition root) in a `Text` component.
5. Do not add any persistence, network, authentication, or backend code anywhere in `apps/mobile`.

ARCHITECTURE BOUNDARIES (do not violate):
- No business logic (assignment resolution, validation, WorkEvent creation, Business Engine decisions, queueing, synchronization state transitions) may be written inside `apps/mobile`. All of it must be invoked from `@taptime/core` via the composition root.
- `apps/mobile` must not import from `packages/core/src/business/*`, `domain/*`, `application/*`, `infrastructure/*` directly to reimplement wiring — it should depend on the composition root export (and, if needed for typing, the public exported types) only.
- Do not add Firebase, Firestore, any HTTP client, any auth SDK, or any native NFC library.
- Do not touch `FB-001`, `TS-001`, `TTAP-001`, any ADR, Product Vision, or `EP-008`.
- Do not attempt to resolve Finding F-01 or add a "stop" scan outcome — the demo continues to exercise exactly the outcomes DT-011 already proved.

TESTING REQUIREMENTS:
- No new tests are needed for business logic (unchanged, already tested in `packages/core`).
- Add a thin test (or documented manual verification, if Expo/React Native component testing is not already configured in this repository) confirming the scan screen's trigger reaches the composition root and its outcome is rendered.
- Run `npm run typecheck` and `npm run test` at the repository root; both must still pass (existing 81 tests must remain green) before you consider the task done.
- Manually launch the Expo app (or document precisely why that was not possible in this environment) and confirm the on-screen outcome for at least one scan matches what `npm run demo:scan --workspace=@taptime/core -- <same payload>` already produces via the CLI.

EXPECTED DELIVERABLES:
- The new `apps/mobile` package, the `packages/core/src/index.ts` export extension, committed with a clear commit message referencing DT-012 and Development Sprint 006.
- A new `## DT-012 – Mobile Application Foundation` section added to `ADO/02_Development/EP-007_Development_Tasks.md` (Objective/Acceptance Criteria as defined in the plan's Section 10), plus a "Development Sprint 006 Implementation Notes" subsection.
- A short implementation summary (changed files, test results, how to launch and manually verify the app, and any environment limitations encountered) suitable for Review Agent evaluation.

STOP CONDITION:
Stop after completing the Implementation Scope, tests, and the EP-007_Development_Tasks.md update. Do not begin any further sprint (no auth, no backend, no real NFC). Do not mark DT-012 "Completed" yourself — that status requires Review Agent verification and Human Architect approval. Wait for review.
```

---

## 16. Role Handover

Implemented scope in this task: Development Sprint 006 planning only — this document and the embedded Development Agent Prompt. No source code was written or modified. No architecture, ADR, TTAP-001, FB-001, TS-001, Product Vision, or EP-008 content was changed.

Changed artifacts: `ADO/02_Development/Development_Sprint_006_Plan.md` (new, this file). No other file was modified.

Related ADO artifacts consulted: Product Vision, Product Principles, Decision Log, AVR-001, ADR-0004, ADR-0006, ADR-0007, TTAP-001, Domain Model, FB-001, TS-001, Development Task Profile (DTP-001), `EP-007_Development_Tasks.md`, `Development_Sprint_001_Plan.md`–`Development_Sprint_005_Plan.md`, `MVP_Readiness_Assessment.md`, current `packages/core/src`/`packages/core/tests` source tree (including `src/index.ts`'s export list and `tsconfig.base.json`/`packages/core/tsconfig.json`), EP-008 Chapters 00–03 (as synchronized through Development Sprint 004 — see the open finding below).

Tests performed: none (planning-only task; no code changed). `packages/core`'s existing test/typecheck state was not re-run this turn since no code changed; it was last verified in the MVP Readiness Assessment turn (81 tests passing, typecheck clean).

Known deviations: none from the assigned task scope. One explicit self-correction is documented in Section 3: this role's own prior `MVP_Readiness_Assessment.md` roadmap ordered Identity & Backend Foundation before Mobile Foundation; this plan reorders them based on which one is actually blocked by an undecided technology choice, and states why.

Open findings carried forward (not resolved by this task): (1) `DEV-SPRINT-002` Decision Log entry remains stale ("Planned"); (2) Decision Log has no `DEV-SPRINT-005` entry and its Repository Status narrative is stale (raised in `MVP_Readiness_Assessment.md`, still unresolved); (3) EP-008 not yet synchronized past Development Sprint 004 (also raised in the MVP assessment); (4) DT-004/DT-005/DT-006/DT-008/DT-011 remain implemented but not Review-Agent-verified or Human-Architect-approved; (5) Finding F-01 (duplicate-scan/toggle mechanism) remains open; (6) the backend/auth technology decision ADR-0007 defers is still not made, and will gate whatever sprint follows this one (Identity & Backend Foundation).

Evidence produced: this plan document, including the repository-evidence-based self-correction to the sprint ordering and the DT-012 justification.

Next responsible role: Technical Lead / Human Architect review and approval of this Sprint 006 Plan. Per the assigned stop condition, implementation does not begin until that approval is given.

## 17. Stop Condition

Per task instruction: this task stops after producing the Development Sprint 006 Plan, the Development Agent Prompt and the Role Handover above. No code was implemented. No architecture, ADRs, TTAP-001, Product Vision, or EP-008 were modified. Awaiting Technical Lead / Human Architect approval before implementation begins.
