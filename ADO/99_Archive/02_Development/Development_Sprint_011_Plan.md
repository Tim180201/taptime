# Development Sprint 011 Plan – Real NFC Hardware Integration

Status: Planned
Role: Research / Implementation Support acting on behalf of Technical Lead (per AGR-001)
Epic: EP-007 – Product Architecture Foundation (implementation), governed in priority by EP-009 – Product Readiness Framework
Owner: Technical Lead
Approval Authority: Human Architect
Branch: `main`
Created Date: 2026-07-07
Related Development Task: **DT-016 (new — justified in Section 10)**; extends DT-001 (NFC Scan Adapter), does not replace it
Related Artifacts: `EP-009_Product_Readiness_Framework.md`, `Product_Readiness_Assessment.md`, `Product_Readiness_Roadmap.md`, `EP-007_Development_Tasks.md`, `Development_Sprint_001_Plan.md`–`Development_Sprint_010_Plan.md`, TTAP-001, FB-001, TS-001, ADR-0007, `NFC_Capability_Model.md`

---

## 1. Executive Summary

This is the first Development Sprint planned directly against EP-009's Product Readiness priorities rather than against the next unstarted DT number alone. Repository evidence (`Product_Readiness_Assessment.md` Section 11.1) identifies **Organization Management** as the primary Product Capability bottleneck for reaching the first pilot customer. That finding is correct and is not revisited here — but repository evidence also shows Organization Management **cannot become a Development Sprint yet**: no Feature Blueprint or Technical Specification exists for it (Assessment Section 3), and this repository's own established engineering order (`Feature_Blueprint_Standard.md`: "No code is written before the relevant Feature Blueprint has been approved"; `CONTRIBUTING.md`'s "Mandatory Engineering Order") has never once been bypassed across ten prior Development Sprints. Planning a Development Sprint directly against Organization Management today would require this task to either invent Feature Blueprint content itself (a Human-Architect-owned decision this role does not have authority to make) or silently skip the Blueprint step (a violation of standing FDOS rule). Neither is acceptable; per this task's own repeated "Escalate Instead of Guessing" discipline, this is escalated rather than guessed at (Section 3 below).

Repository evidence instead identifies a second, independent Product Readiness Roadmap item — also named at the "Before Pilot Customers" milestone, also in the Product Capability Track — that **is** ready for a Development Sprint today: **real NFC hardware integration**. Unlike Organization Management, this item requires no new Feature Blueprint or Technical Specification: FB-001/TS-001 already name `NfcScanAdapter` as an approved component, and the `NfcScanPort` interface (`packages/core/src/ports/NfcScanPort.ts`) carries a comment, unchanged since Development Sprint 001, stating exactly this intent: "Contract implemented by both the fake test double (Development Sprint 001) and the future real NFC SDK adapter. Swapping implementations must not require changes above this boundary." This is the same "swap an adapter behind an already-approved port" pattern DT-015 (Local Persistence Foundation) already proved out for storage; Development Sprint 011 applies it to the NFC input boundary.

Development Sprint 011 therefore recommends implementing **DT-016 (Real NFC Hardware Integration)**: a native NFC adapter in `apps/mobile`, implementing the existing `NfcScanPort` contract, replacing `ScanScreen.tsx`'s manual text-input placeholder trigger with genuine NFC tag detection — while continuing to call `buildScanDemoPipeline`'s unmodified `pipeline.scan(...)` exactly as the placeholder does today. This is proposed alongside, not instead of, initiating Feature Blueprint/Technical Specification drafting for Organization Management as a parallel, non-Development-Sprint action (already recorded in the Product Readiness Roadmap's "Now" milestone) — both tracks can and should proceed in parallel, per EP-009 Section 2's own statement that engineering and product-capability work are not sequential.

## 2. Repository Evidence

- `packages/core/src/ports/NfcScanPort.ts`: the interface comment, written at Development Sprint 001 and unmodified since, explicitly anticipates this exact sprint: "Contract implemented by both the fake test double (Development Sprint 001) and the future real NFC SDK adapter. Swapping implementations must not require changes above this boundary."
- `ADO/01_Architecture/Technical_Specifications/TS-001-nfc-scan-creates-work-event.md` Component Responsibilities table already names `NfcScanAdapter` — "Read platform NFC payload and normalize it" — as an approved TS-001 component. A real, hardware-backed implementation of this exact, already-specified responsibility requires no Technical Specification change.
- `ADO/01_Architecture/ADR/ADR-0007-technology-platform-baseline.md` Decision: "Native NFC capability through platform-compatible modules" is part of the already-Approved mobile platform baseline — not a new or deferred technology decision, unlike the backend/cloud persistence choice.
- `ADO/01_Architecture/Tech_Stack.md` "Reference Evidence": `frogs-zeiterfassung` is cited as using `react-native-nfc-manager` specifically informing ADR-0007's platform baseline — this is the same reference-project evidence ADR-0007's own Rationale cites ("React Native / Expo is compatible with the mobile-first direction and the existing reference-project evidence"), giving a concrete, already-referenced library choice rather than an open technology decision requiring fresh Human Architect approval.
- `ADO/01_Architecture/NFC_Capability_Model.md`: defines the NFC capability boundary ("detecting NFC tags on supported mobile devices... reading a technical tag identifier... creating a raw scan event... passing the scan event to the business layer... reporting scan errors and unsupported device states") and lists Required Failure States ("NFC not available on device," "NFC disabled," and others) that a real adapter must surface — all already-approved guidance, not new architecture.
- `apps/mobile/src/screens/ScanScreen.tsx`'s own in-file comment confirms the current state is explicitly a stand-in: "Placeholder scan trigger (DT-012): a text input + button, not real NFC hardware — none exists yet (Development Sprint 006 Plan, Section 7)."
- `apps/mobile/package.json` has no native NFC dependency today (only `expo`, `expo-status-bar`, `react`, `react-dom`, `react-native`, `react-native-web`) — confirmed by direct inspection.
- `Product_Readiness_Assessment.md` Section 3 (Product Readiness) and Section 8 (Customer Readiness) both name real NFC hardware integration as a "Before Pilot Customers" blocker; `Product_Readiness_Roadmap.md`'s "Before Pilot Customers" milestone, Product Capability Track, lists it explicitly: "Real NFC hardware integration in `apps/mobile`... today only fake/CLI-simulated input exists; a pilot cannot scan a physical tag."
- By contrast, Organization Management has **no** Feature Blueprint or Technical Specification anywhere in the repository (`Product_Readiness_Assessment.md` Section 3: "TTAP-001/FB-001/TS-001 currently have no component for this"; Section 11.1: "no Feature Blueprint exists for it today"). `TTAP-001` names `Organization` only as an Aggregate Root and Ubiquitous Language term, with no operational definition of how one is created, configured, or populated.
- `ADR-0007` Validation Requirements: "Before production implementation proceeds, the Development Agent shall validate: NFC scan capability on the supported mobile platform..." — this Development Sprint's implementation must be explicit about what it can and cannot validate in an environment without physical device access (Section 12, Risks), consistent with the precedent set by every mobile-facing sprint since Development Sprint 006.

## 3. Why Sprint 011 Is Real NFC Hardware Integration, Not Organization Management

Repository evidence (`Product_Readiness_Assessment.md` Section 11.1, reaffirmed here) correctly identifies Organization Management as the more foundational Product Readiness bottleneck for reaching the first pilot. This Development Sprint Plan does not dispute that finding. What it evaluates is a narrower, different question: **which Product Readiness Roadmap item can correctly become a Development Sprint today?**

Every prior Development Sprint in this repository has implemented Development Tasks derived from an already-approved Feature Blueprint and Technical Specification (`Feature_Blueprint_Standard.md`'s mandatory workflow: `Product Vision -> Feature Blueprint -> Technical Specification -> Development Tasks -> Implementation`; this exact chain produced DT-001 through DT-015). No Development Sprint in this repository's history has ever originated a new Feature Blueprint itself — FB-001/TS-001 were produced during EP-007 (a Technical-Lead/Human-Architect-owned Epic activity), not during a Development Sprint. Organization Management has no Feature Blueprint. Proposing Development Tasks for it now would require this planning task to either author Blueprint-level product decisions itself (Business Goal, User Goal, Business Rules, Decision Logic, Acceptance Criteria for how an Organization is created and who may administer it) — decisions this role has no approval authority to make — or to implement it without a Blueprint, directly violating `Feature_Blueprint_Standard.md`'s explicit rule. Both options are rejected, consistent with the "Escalate Instead of Guessing" discipline every prior sprint plan in this repository has applied when a genuine product decision, not an engineering one, blocks the path forward (compare: Finding F-01, the backend/cloud technology decision, the viewing/reporting rejection in Development Sprint 009's own planning).

Real NFC hardware integration does not have this problem. It requires no new Feature Blueprint, no new Technical Specification, and no new ADR — FB-001/TS-001/ADR-0007 already specify and approve exactly this component and this platform capability; what has never been built is a *second, real implementation* of an *already-approved* interface, precisely the same pattern Development Sprint 010 (DT-015) already executed for persistence. This is also independently named, at the same "Before Pilot Customers" milestone, in the Product Readiness Roadmap's Product Capability Track (Section 2 above) — so choosing it does not deprioritize Organization Management, it selects the next item on the same milestone's list that this repository's own engineering order permits a Development Sprint to implement today.

This Development Sprint Plan therefore makes two recommendations together, not one instead of the other: (1) implement DT-016 (Real NFC Hardware Integration) as Development Sprint 011, and (2) recommend, separately and outside the Development Sprint mechanism, that the Technical Lead / Human Architect begin drafting FB-002 (Organization Management) now — exactly as the Product Readiness Roadmap's "Now" milestone already states ("Begin Feature Blueprint / Technical Specification drafting for Organization Management... specification work has no reason to wait"). Both tracks proceeding in parallel is consistent with EP-009 Section 2's explicit position that engineering and product-capability work are not sequential.

## 4. Business Objective

Enable a real employee, holding a real phone, to scan a real, physical NFC tag and have that scan reach the existing, unmodified Business Engine — closing the single most literal reading of TapTim.e's own product identity ("One Tap. One Decision.") that has not yet been demonstrated outside a text-input placeholder or a CLI argument.

## 5. Technical Objective

Implement a native NFC adapter in `apps/mobile` that satisfies the existing `NfcScanPort` contract (`packages/core/src/ports/NfcScanPort.ts`), replacing `ScanScreen.tsx`'s manual text-input trigger with genuine NFC tag detection, while continuing to call `buildScanDemoPipeline`'s `pipeline.scan(...)` exactly as today — no change to any business/application logic in `packages/core`.

## 6. Scope

- A native NFC adapter (e.g. `RnNfcScanAdapter` or similar naming, per Development Agent judgment — see Section 14) implementing `NfcScanPort`'s `scan(): NfcScanCaptureResult` contract, built on the platform-compatible NFC library already referenced as evidence for ADR-0007 (`react-native-nfc-manager`, per `Tech_Stack.md`'s own Reference Evidence — see Section 2), added as a new dependency in `apps/mobile/package.json` only (not `packages/core`, which must remain platform-independent per ADR-0007's Domain Platform boundary).
- Extension of `ScanScreen.tsx` to trigger a real NFC scan (detecting a tag, reading its identifier, normalizing it into an `NfcPayload`) instead of requiring manual text entry — the manual text input may be retained as a fallback/debug affordance (Development Agent judgment) but must no longer be the primary trigger.
- Handling of the `NFC_Capability_Model.md`-named Required Failure States relevant to hardware capture specifically: "NFC not available on device," "NFC disabled," and unreadable/failed tag reads — surfaced through the existing `NfcScanCaptureResult` `'unreadable'` status and/or a new, narrowly-scoped capability-check result, without inventing new business rejection reasons (those remain `AssignmentResolver`/`AssignmentValidator`'s domain, unchanged).
- Platform scope: Android first, consistent with `NFC_Capability_Model.md`'s own still-open question ("Is iOS NFC support in scope for v1?") — this Development Sprint does not resolve that open product question; it implements Android NFC capture, and documents iOS as an explicit, separate follow-up decision (see Section 12, Risks).
- Unit/composition tests proving the new adapter satisfies `NfcScanPort`'s contract with the same rigor `FakeNfcScanAdapter`/`CliNfcScanAdapter` are already tested with, to the extent testable outside real hardware (see Section 11, Testing Strategy, for the explicit boundary between what can be automated and what requires a physical device).

## 7. Out of Scope

- **Organization Management, or any Feature-Blueprint-requiring product capability** — explicitly deferred per Section 3; tracked as a parallel, non-Development-Sprint action, not part of this sprint.
- **iOS NFC support** — `NFC_Capability_Model.md`'s own open question is not resolved by this sprint; Android is the sole target.
- **NFC tag registration/provisioning** (writing to tags, assigning a tag to a Customer) — this remains a missing capability named in `Product_Readiness_Assessment.md` Section 3, but it depends on the same Organization/Customer/Asset management capability this sprint explicitly does not implement (Section 3). This sprint implements *reading* an already-provisioned demo tag's identifier only, using the same pre-seeded demo `NfcAssignment` fixture every prior sprint's CLI/fake adapter has used.
- **Any change to `AssignmentResolver`, `AssignmentValidator`, `BusinessEngine`, `WorkEventFactory`, `SynchronizationService`, `SessionService`, any classification function, or any of the three DT-015 durable-persistence adapters** — none consume the NFC adapter directly except through the existing, unchanged `NfcScanPort`/`NfcScanApplicationService` boundary.
- **Physical device validation performed by this role** — this environment has no iOS/Android simulator or physical NFC-capable device available, consistent with every prior mobile-facing sprint's documented constraint (Development Sprint 006/007/008). Physical validation is Out of Scope for what this role can perform and is named as an explicit, outstanding Definition of Done item for the Technical Lead/Human Architect (Section 13).
- **Any change to FB-001, TS-001, TTAP-001, any ADR, Product Vision, Product Principles, Domain Model, Role Model, or EP-008/EP-009.**

## 8. Existing Components (Reused, Not Recreated)

| Component | File | Reused As |
|---|---|---|
| `NfcScanPort` interface | `packages/core/src/ports/NfcScanPort.ts` | Implemented by the new native adapter unmodified — the interface's own comment anticipates exactly this. |
| `FakeNfcScanAdapter` | `packages/core/src/infrastructure/adapters/FakeNfcScanAdapter.ts` | Remains the default for tests; unmodified. |
| `CliNfcScanAdapter` | `packages/core/src/infrastructure/adapters/CliNfcScanAdapter.ts` | Remains the CLI demo's adapter; unmodified. |
| `NfcScanApplicationService` | `packages/core/src/application/NfcScanApplicationService.ts` | Consumes any `NfcScanPort` implementation identically; unmodified. |
| `NfcPayload`, `NfcAssignment`, `NfcTag` domain types | `packages/core/src/domain/` | Constructed by the new adapter exactly as `FakeNfcScanAdapter`/`CliNfcScanAdapter` already do; no shape changes. |
| `ScanScreen.tsx` (DT-012, extended DT-014) | `apps/mobile/src/screens/ScanScreen.tsx` | Extended (not rewritten) to call the real adapter instead of reading the text input; `pipeline.scan(...)` call itself is unchanged. |
| `buildScanDemoPipeline` composition root | `packages/core/src/cli/runScan.ts` | Unaffected — `apps/mobile` already supplies its own trigger (the screen), not the CLI's `NfcScanAdapter`; no composition-root change needed for this sprint. |

## 9. Components to Implement

| Component | Type | Location (proposed) |
|---|---|---|
| Native NFC adapter (e.g. `RnNfcScanAdapter`) | Infrastructure adapter, implements `NfcScanPort` | `apps/mobile/src/nfc/` (new subfolder) or `apps/mobile/src/infrastructure/` per Development Agent judgment |
| NFC capability/availability check (device support, NFC enabled/disabled) | Small supporting utility, mobile-only | Same location as the adapter |
| `ScanScreen.tsx` extension (real-scan trigger, capability-state feedback) | UI extension | `apps/mobile/src/screens/ScanScreen.tsx` (extended) |

## 10. Development Task Mapping

- **DT-016 (new) — Real NFC Hardware Integration.** Extends, but does not replace or duplicate, DT-001 (NFC Scan Adapter) — DT-001's Objective/Acceptance Criteria remain satisfied for the fake/CLI case; DT-016 adds a real, hardware-backed case behind the same `NfcScanPort`.
  - Objective: Implement a native NFC adapter for Android satisfying the existing `NfcScanPort` contract, wired into `apps/mobile`'s `ScanScreen`, proving a physical NFC tag scan reaches the unmodified Business Engine/composition pipeline.
  - Acceptance Criteria: a native adapter class exists, implements `NfcScanPort.scan()` exactly; `ScanScreen.tsx` triggers a real scan (not manual text entry) as its primary interaction; NFC-unavailable and NFC-disabled device states are surfaced distinctly rather than silently failing; no business/application logic (`AssignmentResolver`, `AssignmentValidator`, `BusinessEngine`, `WorkEventFactory`, `SynchronizationService`, `SessionService`, `NfcScanApplicationService`) is modified; `packages/core` gains no new dependency (the native library is `apps/mobile`-only, preserving ADR-0007's Domain Platform boundary); physical-device validation is explicitly logged as an outstanding item, not silently assumed complete.

## 11. Testing Strategy

- Unit tests for the new adapter's non-hardware-dependent logic (payload normalization, capability-check branching) using the native NFC library's own mockable/test surface where available, mirroring `FakeNfcScanAdapter.test.ts`/`CliNfcScanAdapter.test.ts`'s existing rigor for what can be tested without real hardware.
- A composition-level test proving `ScanScreen`'s wiring calls `pipeline.scan(...)` with a correctly-normalized `NfcPayload` once the adapter reports a `'captured'` result — using a test double for the native library's event callback, not requiring real hardware.
- No new tests are needed for `AssignmentResolver`, `AssignmentValidator`, `BusinessEngine`, `WorkEventFactory`, `SynchronizationService`, `SessionService`, `NfcScanApplicationService`, or any DT-009 classification function — none are modified.
- **Explicit boundary, stated up front rather than discovered late:** `npm run typecheck` and `npm run test` can verify everything above; they cannot verify that a real NFC tag, on a real Android device, is actually detected and read correctly. That verification requires a physical device and is named as an outstanding Definition of Done item (Section 13), exactly as ADR-0007's own Validation Requirements anticipate ("the Development Agent shall validate: NFC scan capability on the supported mobile platform") and exactly as every mobile-facing sprint since Development Sprint 006 has already had to document as a known limitation of this environment.

## 12. Risks

| Risk | Mitigation |
|---|---|
| No physical Android device or NFC-capable simulator available in this environment to validate real hardware behavior | Documented explicitly as an outstanding Definition of Done item (Section 13), not silently assumed complete — the same disclosure pattern every mobile-facing sprint since Development Sprint 006 has used. |
| NFC behavior differs between Android devices/versions (`Risk_Register.md` R-001) | Scope this sprint to the most common, broadly-compatible NFC read API surface the chosen library exposes; document device/version constraints found during implementation as a known limitation, not a defect to silently work around. |
| Treating this sprint as license to also resolve NFC tag registration/provisioning "since we're touching NFC again" | Out of Scope (Section 7) explicitly forbids this; tag registration depends on Organization/Customer/Asset management capability not yet specified. |
| Adding the native NFC dependency to `packages/core` instead of `apps/mobile` only | Scope (Section 6)/Acceptance Criteria (Section 10) explicitly require the dependency to live in `apps/mobile` only, preserving ADR-0007's Domain Platform boundary ("the domain and Business Engine shall remain independent from... native NFC implementation details"). |
| Silently deciding the iOS-vs-Android-first question as an implementation detail | Out of Scope (Section 7) explicitly names this as an unresolved, open product question (`NFC_Capability_Model.md`); this sprint targets Android only and documents iOS as a follow-up decision, not a decision made by default. |
| Modifying `ScanScreen.tsx` in a way that silently changes existing DT-012/DT-014 behavior (the signed-in `CallerContext` flow, the Synchronize control) | Scope (Section 6) requires the manual-entry fallback and the existing `pipeline.scan(payload, caller)`/`pipeline.synchronizePending(...)` calls to remain functionally reachable and unchanged in behavior; only the primary trigger mechanism changes. |

## 13. Definition of Done

- A native NFC adapter exists in `apps/mobile`, implements `NfcScanPort` exactly, and is wired into `ScanScreen.tsx` as the primary scan trigger.
- NFC-unavailable and NFC-disabled device states are surfaced distinctly to the user, per `NFC_Capability_Model.md`'s Required Failure States.
- No business/application logic (`AssignmentResolver`, `AssignmentValidator`, `BusinessEngine`, `WorkEventFactory`, `SynchronizationService`, `SessionService`, `NfcScanApplicationService`) is modified — verified by diff.
- No new dependency is added to `packages/core/package.json`; the native NFC library is an `apps/mobile`-only dependency.
- `npm run typecheck` and `npm run test` pass across the monorepo (all 154 pre-existing `packages/core` tests remain green; new adapter-level and composition-level tests added this sprint also pass).
- `EP-007_Development_Tasks.md` gets a new `## DT-016 – Real NFC Hardware Integration` section, explicitly noting: (a) Android-only scope, iOS deferred as an open product question; (b) physical-device validation not performed in this environment, named as an outstanding item for the Technical Lead/Human Architect with real device access — mirroring DT-012/DT-014's own precedent exactly, not a new kind of caveat; (c) Organization Management/tag-registration remain explicitly out of scope and unaffected.
- **Physical-device validation is recorded as an explicit outstanding item, not silently assumed complete** — this Development Sprint cannot be marked "Completed" in the unqualified sense DT-009/DT-015 were; it should be recorded the same way DT-012 originally was ("Completed... no simulator/device launch verification was performed during implementation") pending that validation, consistent with this repository's own established practice of never asserting a review/approval status that repository evidence does not support (AVR-001: "Validation requires evidence. Status shall never be upgraded by assumption").
- No change to FB-001, TS-001, TTAP-001, any ADR, Product Vision, Product Principles, Domain Model, Role Model, EP-008, or EP-009.
- Review Agent verification and Human Architect approval are recorded before DT-016 is marked Completed (DTP-001: "Implementation alone never completes a Development Task").

## 14. Recommended Implementation Order

1. Confirm the native NFC library choice (`react-native-nfc-manager`, per Section 2's evidence, unless the Development Agent finds a materially better-supported alternative for the current Expo SDK version — document the choice and rationale either way).
2. Implement the native adapter's non-hardware-dependent logic first (payload normalization from whatever raw tag data the library returns, capability-check branching), with unit tests, before wiring it into the UI — consistent with the "spike first" discipline Development Sprint 006/010 already established.
3. Wire the adapter into `ScanScreen.tsx`, replacing the manual text-input trigger as primary, retaining it as an optional fallback if useful for debugging.
4. Add composition-level tests proving the wiring is correct using a test double for the native library's scan-event callback.
5. Run `npm run typecheck` and `npm run test` for the whole monorepo.
6. Add the new `DT-016` section to `EP-007_Development_Tasks.md`, explicitly documenting the physical-device-validation gap per Section 13.
7. Produce implementation evidence and role handover; request Review Agent verification; flag physical-device validation as an outstanding item for the Technical Lead/Human Architect.

---

## 15. Development Agent Prompt

The following prompt is written to be given directly to Claude Code (Development Agent) to execute Development Sprint 011. It is self-contained and does not require this planning document to be re-explained.

```text
You are the Development Agent for TapTim.e, implementing Development Sprint 011 ("Real NFC Hardware Integration," DT-016) on branch `main`.

CONTEXT (verify before writing code):
- Read `ADO/02_Development/Development_Sprint_011_Plan.md` in full — it is the authoritative scope for this task, including why this sprint targets real NFC hardware integration and explicitly not Organization Management (Section 3).
- Read `packages/core/src/ports/NfcScanPort.ts` — this port is unchanged; your new adapter must implement it exactly. Its own comment already anticipates this sprint.
- Read `apps/mobile/src/screens/ScanScreen.tsx` — the current placeholder text-input trigger you are replacing as the primary interaction; do not remove the existing `pipeline.scan(payload, caller)`/`pipeline.synchronizePending(...)` calls' behavior.
- Read `ADO/01_Architecture/NFC_Capability_Model.md` — the capability boundary and Required Failure States your adapter must respect (it captures facts; it does not decide business meaning).
- Read `ADO/01_Architecture/ADR/ADR-0007-technology-platform-baseline.md` — confirms native NFC capability is already part of the approved mobile platform baseline; no new ADR is needed.
- Do not modify DT-001–DT-015 business/application logic, FB-001, TS-001, TTAP-001, any ADR, Product Vision, Product Principles, Domain Model, Role Model, or EP-008/EP-009.

IMPLEMENTATION SCOPE (do exactly this, nothing more):
1. Add a native NFC library (`react-native-nfc-manager`, per the plan's Section 2 evidence, unless you find and document a materially better-supported alternative) as an `apps/mobile`-only dependency — do not add it to `packages/core`.
2. Implement a native NFC adapter implementing `NfcScanPort.scan(): NfcScanCaptureResult` exactly, targeting Android only (iOS is an explicitly deferred, open product question — do not implement iOS support and do not silently decide it either way).
3. Surface "NFC not available on device" and "NFC disabled" states distinctly, per `NFC_Capability_Model.md`'s Required Failure States — do not invent new business rejection reasons; these are capability/technical states, not `AssignmentResolver`/`AssignmentValidator` outcomes.
4. Wire the adapter into `ScanScreen.tsx` as the primary scan trigger, calling the existing, unmodified `pipeline.scan(payload, caller)` exactly as the placeholder does today. You may retain the manual text-input as an optional fallback/debug affordance.
5. Do not touch `AssignmentResolver`, `AssignmentValidator`, `BusinessEngine`, `WorkEventFactory`, `SynchronizationService`, `SessionService`, `NfcScanApplicationService`, or any of the three DT-015 durable-persistence adapters.
6. Do not implement NFC tag registration/provisioning, Organization/Customer management, or any other capability out of this sprint's scope (Section 7 of the plan).

ARCHITECTURE BOUNDARIES (do not violate):
- Do not modify `NfcScanPort.ts`, `FakeNfcScanAdapter.ts`, or `CliNfcScanAdapter.ts`.
- Do not add the native NFC dependency to `packages/core/package.json` — ADR-0007 requires the domain/Business Engine to remain independent of native NFC implementation details.
- Do not touch FB-001, TS-001, TTAP-001, any ADR, Product Vision, Product Principles, Domain Model, Role Model, or EP-008/EP-009.
- Do not resolve the iOS-vs-Android question by default — document it as open if you encounter it.

TESTING REQUIREMENTS:
- Unit tests for the adapter's non-hardware-dependent logic (payload normalization, capability-check branching).
- A composition-level test proving `ScanScreen`'s wiring is correct using a test double for the native library's scan-event callback — you cannot and should not attempt to test real hardware behavior in this environment.
- Run `npm run typecheck` and `npm run test` at the repository root; both must pass (existing 154 tests remain green) before you consider the task done.

EXPECTED DELIVERABLES:
- The new native adapter, its tests, and the `ScanScreen.tsx` extension — committed with a clear commit message referencing DT-016 and Development Sprint 011.
- A new `## DT-016 – Real NFC Hardware Integration` section added to `ADO/02_Development/EP-007_Development_Tasks.md`, explicitly stating: Android-only scope; that physical-device validation was NOT performed in this environment (no simulator/device available) and remains an outstanding item; that Organization Management and tag registration/provisioning remain unaffected and out of scope.
- A short implementation summary (changed files, test results, library choice and rationale, and the explicit physical-device-validation gap) suitable for Review Agent evaluation.

STOP CONDITION:
Stop after completing the Implementation Scope, tests, and the EP-007_Development_Tasks.md update. Do not begin Organization Management, tag registration, iOS support, or any further sprint. Do not mark DT-016 "Completed" in the unqualified sense — record it the same way DT-012 originally was (implemented, but with real-device validation still outstanding). Wait for review.
```

---

## 16. Role Handover

Implemented scope in this task: Development Sprint 011 planning only — this document and the embedded Development Agent Prompt. No source code was written or modified. No architecture, ADR, TTAP-001, FB-001, TS-001, Product Vision, Product Principles, Domain Model, Role Model, or EP-008/EP-009 content was changed.

Changed artifacts: `ADO/02_Development/Development_Sprint_011_Plan.md` (new, this file). No other file was modified.

Related ADO artifacts consulted: `EP-009_Product_Readiness_Framework.md`, `Product_Readiness_Assessment.md` (Sections 3, 8, 11.1, 12), `Product_Readiness_Roadmap.md` ("Before Pilot Customers" / "Now" milestones), `Feature_Blueprint_Standard.md`, `CONTRIBUTING.md`, ADR-0007, `NFC_Capability_Model.md`, `Tech_Stack.md`, TTAP-001, FB-001, TS-001, `EP-007_Development_Tasks.md` (DT-001, DT-012, DT-014 sections), `Development_Sprint_001_Plan.md` through `Development_Sprint_010_Plan.md`, current `packages/core/src/ports/NfcScanPort.ts` and both existing adapter implementations, current `apps/mobile/src/screens/ScanScreen.tsx` and `apps/mobile/package.json`.

Tests performed: none (planning-only task; no code changed). Current repository test/typecheck state (154 `packages/core` tests passing, typecheck clean) was verified in the immediately preceding Development Sprint 010 Governance Closure session and is cited here, not re-run since no code changed.

Known deviations: none from the assigned task scope. One deliberate, disclosed judgment call: this task was asked to plan "against EP-009 Product Readiness priorities," and the top-identified priority (Organization Management) was evaluated and explicitly *not* selected as this sprint's implementation target, for the evidence-based reason detailed in Section 3 — this is not a disregard of EP-009's prioritization, but an application of the same "Escalate Instead of Guessing"/"no code before an approved Feature Blueprint" discipline this repository has applied consistently since Development Sprint 001.

Open findings carried forward (not resolved by this task): (1) Organization Management still has no Feature Blueprint or Technical Specification — recommended, not performed, as a parallel Technical Lead/Human Architect action; (2) Development Sprint 002/004 remain without recorded Review Agent verification or Human Architect approval; (3) Development Sprint 005's EP-008 implementation narrative remains unsynchronized; (4) Finding F-01 remains open; (5) the cloud/backend persistence technology decision remains undecided; (6) `QueuedWorkEventRecord.decision: null` still has no integration-level test coverage; (7) `DT-010` still has no explicit "Status:" line in `EP-007_Development_Tasks.md`; (8) the iOS-vs-Android NFC question, named again in Section 6/7 of this plan, remains an open product question this sprint does not resolve; (9) NFC tag registration/provisioning remains a missing capability, correctly deferred here since it depends on the not-yet-specified Organization/Customer/Asset management work.

Evidence produced: this plan document, including the repository-evidence basis for both recommending DT-016 as Sprint 011's implementation target and for not selecting Organization Management directly, plus the explicit disclosure of the physical-device-validation gap this sprint's implementation will not be able to close in this environment.

Next responsible role: Technical Lead / Human Architect review and approval of this Sprint 011 Plan, and separately, initiation of Feature Blueprint drafting for Organization Management (a parallel, non-Development-Sprint action, per the Product Readiness Roadmap's "Now" milestone). Per the assigned stop condition, implementation does not begin until Sprint 011 approval is given.

## 17. Stop Condition

Per task instruction (continuing this session's standing "planning only" discipline for Development Sprint Plans): this task stops after producing the Development Sprint 011 Plan and the embedded Development Agent Prompt and Role Handover above. No code was implemented. No architecture, ADRs, TTAP-001, Product Vision, Product Principles, Domain Model, Role Model, EP-008, or EP-009 were modified. Awaiting Technical Lead / Human Architect approval before implementation begins.
