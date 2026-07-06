# Development Sprint 008 Plan – Mobile Authentication Integration

Status: Planned
Role: Research / Implementation Support acting on behalf of Technical Lead (per AGR-001)
Epic: EP-007 – Product Architecture Foundation
Owner: Technical Lead
Approval Authority: Human Architect
Branch: `main`
Created Date: 2026-07-06
Related Development Task: **DT-014 (new — justified in Section 10)**; closes DT-013's remaining, unimplemented Acceptance Criteria
Related Artifacts: `EP-007_Development_Tasks.md`, `Development_Sprint_001_Plan.md`–`Development_Sprint_007_Plan.md`, `Development_Sprint_007_Closure.md`, `MVP_Readiness_Assessment.md`, TTAP-001, TS-001, FB-001, ADR-0006, ADR-0007

---

## 1. Executive Summary

Repository evidence does **not** support Persistence/Firestore, real NFC hardware, or Reporting as Sprint 008 — each is either explicitly gated on a Human Architect technology decision that still has not been made, or blocked on hardware that does not exist, or sequenced later in this role's own MVP roadmap. Instead, the highest-value, best-evidenced next sprint is to **finish what Development Sprint 007 deliberately left unfinished**: DT-013's own Acceptance Criteria still require a mobile `LoginScreen` and a composition root that accepts a real, session-derived `CallerContext` — neither was built, by explicit Human-Architect-instructed scope narrowing (`ADO/02_Development/Development_Sprint_007_Closure.md`). Today, `packages/core` can authenticate a credential and produce a `CallerContext`, and this has been proven at the pipeline-test level — but there is still **no way for an actual person to sign in through the app**. `MVP_Readiness_Assessment.md`'s MVP-B02 ("No authentication/identity implementation... 'authenticate' is impossible") is rated a **BLOCKER**, and it is not yet closed at the product level despite this task's own "Current Project State" describing Authentication & Session Foundation as "COMPLETE." Sprint 008 should close this gap before starting any new capability area, requires no new architecture decision, and directly follows "Continue, Never Recreate" / "Extend before Create" by wiring already-built, already-approved pieces together rather than starting something new.

## 2. Repository Evidence

- `git log --oneline` shows commit `ebce0c0` is explicitly labeled "(Development Sprint 007, partial scope)"; `EP-007_Development_Tasks.md`'s DT-013 section (verified by direct inspection, lines 258–280) states in its own Status line: "**This does not close DT-013's full Acceptance Criteria above** — '`apps/mobile` gains a `LoginScreen`...' and 'The scan composition root uses the signed-in session's `CallerContext`...' were explicitly not built this session... That remaining scope is carried forward as a proposed follow-up task (DT-014, not yet created or approved)."
- `find apps/mobile/src -type f` (verified by direct listing) shows only `navigation/AppNavigator.tsx` and `screens/ScanScreen.tsx` — no `LoginScreen`, no session-handling code of any kind exists in `apps/mobile` today.
- `packages/core/src/cli/runScan.ts`'s `buildScanDemoPipeline` still hard-codes `authenticatedCaller(UserId('demo-employee'), organizationId)` — verified by direct inspection; unchanged since Development Sprint 005. The composition root has never been extended to accept an externally-produced `CallerContext`, despite `SessionService`/`toCallerContext()` existing in `packages/core` since Sprint 007 specifically to produce one.
- `packages/core/src/application/SessionService.ts` and `packages/core/tests/application/SessionDerivedCallerPipeline.test.ts` (Development Sprint 007) already prove a `SessionService`-derived `CallerContext` reaches identical `AssignmentValidator` outcomes to the hard-coded fixture — the business-logic risk of this substitution is already retired; only the wiring (composition root + UI) remains.
- `MVP_Readiness_Assessment.md` (Section 9): "MVP-B02 | No authentication/identity implementation ('authenticate' is impossible) | **BLOCKER**"; this assessment predates Sprint 007's `packages/core`-only implementation and has not been revisited since. Per direct evidence above, MVP-B02 is **still not resolved** at the product/UI level today, contrary to the framing in this task's own "Current Project State" section.
- `MVP_Readiness_Assessment.md`'s MVP-B06/MVP-B07 (durable persistence, real synchronization target) are both rated **HIGH**, not BLOCKER, and both are explicitly "gated on... the same backend technology decision" — a Human Architect decision not yet made (confirmed again: no ADR update, no Decision Log entry naming a chosen backend/database exists).
- `ADR-0007-technology-platform-baseline.md`'s Decision section still defers "the exact implementation libraries and service configuration" for both authentication and persistence/backend to later refinement; nothing in the Decision Log or any ADR since has resolved this for persistence. Building real Firestore/persistence integration now would require inventing a technology decision that is not this role's, the Technical Lead's, or the Development Agent's to make.
- `MVP_Readiness_Assessment.md`'s MVP-B03 (real NFC hardware) remains blocked on the same missing native module/physical device that Sprint 005 and Sprint 006 already found and deferred — no new evidence changes this.
- `MVP_Readiness_Assessment.md`'s MVP-B04 (viewing capability) and MVP-B08 (DT-009 Error Handling) are rated BLOCKER-for-coherent-UX and MEDIUM respectively, but both are explicitly sequenced *after* a user can actually authenticate and scan (the original roadmap: "Dependencies: Sprint 007 (a screen to show it in) and Sprint 008 (real data to show)" for viewing) — neither is better-evidenced than closing the authentication gap first.
- `Decision_Log.md`'s Repository Status narrative (refreshed during the Sprint 007 closure) already states: "DT-013's remaining mobile-integration Acceptance Criteria are not yet satisfied and await a follow-up task" — this sprint is that follow-up task, not a new capability area.
- `AppNavigator.tsx`'s own Development Sprint 006 comment ("establishing the pattern and location for future navigation") was written specifically to anticipate a second screen being added later — this is that later point.

## 3. Why Sprint 008 Is the Correct Next Sprint

**Repository evidence directly contradicts treating Firestore/persistence, real NFC, or any new capability area as the obvious next sprint**, and the task's own instruction not to assume so is well-founded: MVP-B06/B07 (persistence, sync backend) are gated on an undecided Human Architect technology choice, and MVP-B03 (real NFC) is blocked on hardware that does not exist in this environment — both are the same class of blocker that caused Sprint 005/006/007 to each correct their own scope away from a premature technology commitment. Building toward either now would either require making a decision that is not this role's to make, or attempting something structurally impossible in this environment, repeating a mistake already avoided three times.

By contrast, the highest-value, best-evidenced next step is unblocked, already-designed, and already partially built: complete DT-013's Acceptance Criteria. This directly retires MVP-B02, a **BLOCKER**-rated finding, using only already-approved architecture (ADR-0007's authentication baseline; TS-001's "user must be authenticated" requirement) and already-implemented, already-tested `packages/core` code (`SessionService`, `AuthenticationGateway`, `FakeAuthenticationGateway`). No new ADR, no new Human Architect technology decision, and no new business logic are required — only wiring what Sprint 007 explicitly deferred. This is also the most direct way to make this task's own "Current Project State" claim ("Authentication & Session Foundation COMPLETE") actually true at the product level, not just at the `packages/core` level.

This does not contradict `MVP_Readiness_Assessment.md`'s overall roadmap shape (which always placed Identity/Authentication before Persistence and Viewing); it simply recognizes that Sprint 007 only partially delivered the Authentication sprint, and that partial delivery — not a new sprint — is what must be completed before moving on.

## 4. Business Objective

Deliver on Sprint 007's own stated goal, which is not yet true: "a user can successfully authenticate and enter the TapTim.e application." Today, only a demo/CLI-level proof exists that authentication logic works; no person can open the mobile app and sign in. Closing this gap is the last step standing between "the Business Core and its session mechanism are correct" (proven since Sprint 007) and "the product exists as something an actual person can use," directly serving Product Vision's premise that a specific, identified person stands behind every scan.

## 5. Technical Objective

Wire the already-implemented `SessionService`/`AuthenticationGateway`/`FakeAuthenticationGateway` (DT-013) into `apps/mobile` via a new `LoginScreen`, extend `AppNavigator` to show it before `ScanScreen`, and extend the DT-011 composition root (`buildScanDemoPipeline`/`runScan.ts`) to accept an externally-produced `CallerContext` instead of always constructing its Sprint 005-era hard-coded demo caller — completing DT-013's Acceptance Criteria exactly as originally scoped in `Development_Sprint_007_Plan.md` Section 6, with no new business logic anywhere in this sprint.

## 6. Scope

- A `LoginScreen` in `apps/mobile/src/screens/`: a credential input (matching `Credentials`' single opaque `signInCode` shape, unchanged from Sprint 007) and a "Sign in" action that calls `SessionService.signIn(...)`, converts the result via the existing `toCallerContext()`, and on success passes the resulting `CallerContext` forward; on rejection, displays the gateway's `invalid_credentials` reason as-is, without inventing new rejection reasons.
- Extending `AppNavigator` to a Login → Scan flow: show `LoginScreen` first; after a successful sign-in, show `ScanScreen`, passing the session's `CallerContext` through — following Sprint 006's own precedent of avoiding a routing library dependency unless it proves genuinely necessary for two screens.
- Extending `buildScanDemoPipeline`'s composition (in `runScan.ts`, or a clean extraction if the Development Agent finds it warranted) so it can accept an externally-produced `CallerContext`, while preserving the existing CLI's current hard-coded-caller behavior for backward compatibility (`npm run demo:scan` must continue to work unchanged).
- Wiring `ScanScreen`'s existing `pipeline.scan(...)` call to use the signed-in session's `CallerContext` instead of whatever the composition root would otherwise default to.
- Extending existing tests (or adding a small, thin new one) to cover the `LoginScreen` → `SessionService` → `CallerContext` → composition root path, reusing `SessionDerivedCallerPipeline.test.ts`'s proof that this substitution is behavior-preserving.

## 7. Out of Scope

- **Firestore or any real persistence** — unchanged from every prior sprint's deferral; still gated on an undecided Human Architect technology decision (Section 2).
- **A real managed authentication provider** — `FakeAuthenticationGateway` remains the only implementation; the specific provider is still not a decision this sprint makes.
- **Real NFC hardware** — unaffected; `ScanScreen`'s placeholder scan trigger is unchanged except for now receiving a real, session-derived `CallerContext` instead of a hard-coded one.
- **User management UI, role/permission administration** — `Role_Model.md`'s full permission matrix remains unimplemented; this sprint authenticates and passes through a single Employee-shaped identity, exactly as DT-013 already scoped.
- **Session persistence across app restarts** — an in-memory session for the app's runtime lifetime remains sufficient, as originally scoped in Sprint 007's plan.
- **Registration, password reset, or any credential-management flow** — `FakeAuthenticationGateway`'s fixed demo-account model is unchanged.
- **DT-009 Error Handling, viewing/reporting capability, Admin Portal, production deployment** — none is touched.
- **Any change to DT-001–DT-013 business logic** (`AssignmentValidator`, `BusinessEngine`, `SynchronizationService`, `SessionService`'s own forwarding behavior), **FB-001, TS-001, TTAP-001, any ADR, Product Vision, Product Principles, Domain Model, Role Model, or EP-008.**

## 8. Existing Components (Reused, Not Recreated)

| Component | File | Reused As |
|---|---|---|
| `SessionService`, `toCallerContext()` (DT-013) | `packages/core/src/application/SessionService.ts` | Called directly from the new `LoginScreen`; unchanged. |
| `AuthenticationGateway` port + `FakeAuthenticationGateway` (DT-013) | `packages/core/src/ports/AuthenticationGateway.ts`, `infrastructure/adapters/FakeAuthenticationGateway.ts` | Supplies `SessionService`'s dependency exactly as already wired in its own tests; unchanged. |
| `AuthenticationResult`, `Credentials` (DT-013) | `packages/core/src/application/AuthenticationResult.ts`, `ports/AuthenticationGateway.ts` | The exact shapes `LoginScreen`'s input/output must match. |
| `CallerContext`, `authenticatedCaller()`, `UNAUTHENTICATED_CALLER` (Sprint 001) | `packages/core/src/domain/CallerContext.ts` | Unchanged; `toCallerContext()` already produces these. |
| `buildScanDemoPipeline` composition root (DT-011) | `packages/core/src/cli/runScan.ts` | Extended (not rewritten) to accept an external `CallerContext`; existing CLI behavior preserved. |
| `AppNavigator` single-screen foundation (DT-012) | `apps/mobile/src/navigation/AppNavigator.tsx` | Extended to two screens, using the pattern it was explicitly built to allow (its own Sprint 006 comment). |
| `ScanScreen` (DT-012) | `apps/mobile/src/screens/ScanScreen.tsx` | Receives a `CallerContext` prop/param instead of relying on the composition root's default; scan/synchronize actions unchanged. |
| `SessionDerivedCallerPipeline.test.ts` (DT-013) | `packages/core/tests/application/` | Already proves the substitution this sprint wires up is behavior-preserving; referenced, not rewritten. |

## 9. Components to Implement

| Component | Type | Location (proposed) |
|---|---|---|
| `LoginScreen` | Mobile app code | `apps/mobile/src/screens/LoginScreen.tsx` |
| `AppNavigator` Login → Scan extension | Mobile app code | `apps/mobile/src/navigation/AppNavigator.tsx` (extended) |
| Composition root external-`CallerContext` support | `packages/core` extension | `packages/core/src/cli/runScan.ts` (extended, or a small clean extraction if warranted) |
| `ScanScreen` session-context wiring | Mobile app code | `apps/mobile/src/screens/ScanScreen.tsx` (extended) |
| Login → Scan pipeline test | Test | `apps/mobile` (if a component-testing approach is adopted) or an additional `packages/core` composition-level test proving the mobile wiring path, per the Development Agent's judgment (Section 11) |

## 10. Development Task Mapping

- **DT-014 (new) — Mobile Session Integration.** Repository evidence (Section 2) shows this is not new scope invented for this sprint — it is DT-013's own remaining, unimplemented Acceptance Criteria, explicitly deferred by Human Architect instruction during Development Sprint 007 (`Development_Sprint_007_Closure.md` Section 3, `EP-007_Development_Tasks.md` DT-013 status line). Per the standing instruction to create new DT identifiers only when no existing DT covers the work, and per DTP-001's "one primary responsibility per DT" (DT-013 already closed for its `packages/core`-only responsibility; the mobile-integration responsibility is distinct and better tracked separately, consistent with how DT-011/DT-012/DT-013 were each split out previously): DT-014 is proposed here for Human Architect/Technical Lead approval, not yet implemented.
  - Objective: Complete the mobile-facing half of DT-013 — a `LoginScreen` in `apps/mobile` that calls the existing `SessionService`, and a composition root that accepts the resulting `CallerContext` instead of a hard-coded demo caller — so a real person can authenticate and enter the app.
  - Acceptance Criteria: `apps/mobile` gains a `LoginScreen` that calls `SessionService.signIn(...)` and, on success, navigates to `ScanScreen`, passing the resulting `CallerContext`; on rejection, the screen displays the gateway's rejection reason without inventing new business rules; `buildScanDemoPipeline`/`runScan.ts` accepts an externally-produced `CallerContext` while preserving existing CLI behavior; `ScanScreen`'s scan action uses the signed-in session's `CallerContext`; `AssignmentValidator`'s existing `employee_not_authenticated` behavior remains exercised, not modified; no persistence, network, or real managed-auth-provider code is added.

## 11. Testing Strategy

- Reuse `SessionDerivedCallerPipeline.test.ts`'s existing proof (Development Sprint 007) that a `SessionService`-derived `CallerContext` reaches identical `AssignmentValidator` outcomes to the hard-coded fixture — this sprint's job is to prove the *wiring* reaches that same proven path, not to re-prove the business-logic substitution itself.
- A composition-level test (in `packages/core/tests/cli/` or an equivalent location) confirming `buildScanDemoPipeline`'s extended signature, when given an externally-produced `CallerContext`, produces the same pipeline outcomes as the CLI's own hard-coded-caller default for equivalent input — proving the extension is additive, not a behavior change to existing callers.
- If `apps/mobile` remains without a component-testing framework (per DT-012's own documented justification, unchanged as of Sprint 007), a documented manual verification step is expected: launch the app (or document why not possible in this environment, consistent with DT-012's precedent), sign in via `LoginScreen`'s demo credentials, confirm navigation to `ScanScreen`, and confirm a scan performed afterward reflects the signed-in identity rather than any hard-coded value.
- `npm run typecheck` and `npm run test` must pass across the monorepo; the existing 94 `packages/core` tests must remain green.
- No new tests are needed for `SessionService`, `FakeAuthenticationGateway`, or `AssignmentValidator` — all unchanged and already covered by Sprint 007's tests.

## 12. Risks

| Risk | Mitigation |
|---|---|
| Re-implementing or duplicating any part of `SessionService`/`AuthenticationGateway` inside `apps/mobile` instead of calling the existing `packages/core` exports | DT-014's Acceptance Criteria explicitly require calling the existing `SessionService`; `apps/mobile` must not gain its own `ports/`/`application/` authentication code. |
| Business/authorization logic (role checks, permission matrix) creeping into `LoginScreen` "since we're touching auth again" | Out of Scope (Section 7) explicitly excludes `Role_Model.md`'s permission matrix; `LoginScreen` must only ever produce the existing binary `CallerContext`. |
| Breaking the existing CLI (`npm run demo:scan`) while extending `buildScanDemoPipeline`'s signature | Testing Strategy (Section 11) explicitly requires the composition-level test to prove existing CLI behavior is preserved; the extension must be additive (e.g. an optional parameter defaulting to today's behavior). |
| Two-screen navigation requiring a routing library sooner than needed | Follow Sprint 006's precedent: attempt a minimal conditional-render navigator first; document the decision if a routing library is found genuinely necessary. |
| No simulator/device available to manually verify the Login → Scan flow launches correctly (a recurring, documented constraint since Sprint 006) | Document as a known constraint (Section 11), consistent with DT-012/DT-013's own precedent, rather than silently claimed as verified. |
| Treating this sprint as an opportunity to also start persistence/Firestore "since we're in packages/core anyway" | Out of Scope (Section 7) explicitly excludes this; Section 3 explains why that would repeat a mistake already avoided in Sprints 005–007. |

## 13. Definition of Done

- `apps/mobile` gains a `LoginScreen`; `AppNavigator` shows it before `ScanScreen` and passes the resulting session/`CallerContext` through on success.
- `buildScanDemoPipeline`/`runScan.ts` accepts an externally-produced `CallerContext`; the existing CLI (`npm run demo:scan`) continues to work unchanged, proven by a dedicated test.
- `ScanScreen`'s scan action uses the signed-in session's `CallerContext` instead of any hard-coded value.
- `AssignmentValidator`'s existing `employee_not_authenticated` behavior remains exercised and unchanged.
- `npm run typecheck` and `npm run test` pass across the monorepo (existing 94 `packages/core` tests, plus any new tests added this sprint, all green); `apps/mobile`'s own typecheck passes.
- `EP-007_Development_Tasks.md` gets a new `## DT-014 – Mobile Session Integration` section (Objective/Acceptance Criteria as in Section 10) plus a "Development Sprint 008 Implementation Notes" subsection.
- DT-013's Acceptance Criteria, referenced from DT-014's own notes, are now fully satisfied across both tasks together.
- No change to DT-001–DT-013 business logic, FB-001, TS-001, TTAP-001, any ADR, Product Vision, Product Principles, Domain Model, Role Model, or EP-008.
- Review Agent verification and Human Architect approval are recorded before DT-014 is marked Completed (DTP-001: "Implementation alone never completes a Development Task").

## 14. Recommended Implementation Order

1. Extend `buildScanDemoPipeline`'s composition (in `runScan.ts`) to accept an optional externally-produced `CallerContext`, defaulting to today's hard-coded demo caller when none is supplied — proving the existing CLI is unaffected before touching `apps/mobile`.
2. Add a composition-level test proving both the new external-`CallerContext` path and the existing default path produce correct, distinct outcomes.
3. Build `LoginScreen` in `apps/mobile`, calling `SessionService.signIn(...)` and `toCallerContext(...)`.
4. Extend `AppNavigator` to a Login → Scan flow, passing the resulting `CallerContext` from `LoginScreen` to `ScanScreen`.
5. Wire `ScanScreen`'s scan action to use the passed-in `CallerContext` via the extended composition root.
6. Manually verify (or document why not possible) the full Login → Scan flow; compare a successful scan's rendered outcome against what the CLI/pipeline test already prove for the same identity.
7. Run `npm run typecheck` and `npm run test` for the whole monorepo.
8. Add the new `DT-014` section to `EP-007_Development_Tasks.md`, referencing DT-013's now-completed remaining Acceptance Criteria.
9. Produce implementation evidence and role handover; request Review Agent verification.

---

## 15. Development Agent Prompt

The following prompt is written to be given directly to Claude Code (Development Agent) to execute Development Sprint 008. It is self-contained and does not require this planning document to be re-explained.

```text
You are the Development Agent for TapTim.e, implementing Development Sprint 008 ("Mobile Authentication Integration") on branch `main`. This sprint completes Development Sprint 007's deliberately-deferred scope.

CONTEXT (verify before writing code):
- Read `ADO/02_Development/Development_Sprint_008_Plan.md` in full — it is the authoritative scope for this task.
- Read `ADO/02_Development/EP-007_Development_Tasks.md`'s DT-013 section — note its Acceptance Criteria for the mobile `LoginScreen` and composition-root wiring, and its Status line explaining these were explicitly deferred, not forgotten.
- Read `packages/core/src/application/SessionService.ts`, `AuthenticationResult.ts`, `packages/core/src/ports/AuthenticationGateway.ts`, `infrastructure/adapters/FakeAuthenticationGateway.ts` — these already exist; do not modify or duplicate them.
- Read `packages/core/tests/application/SessionDerivedCallerPipeline.test.ts` — it already proves a `SessionService`-derived `CallerContext` reaches identical `AssignmentValidator` outcomes to the hard-coded fixture; do not re-litigate this, just wire up to it.
- Read `packages/core/src/cli/runScan.ts` (`buildScanDemoPipeline`) — find the hard-coded `authenticatedCaller(UserId('demo-employee'), organizationId)` call; this is what you will make overridable.
- Read `apps/mobile/src/navigation/AppNavigator.tsx` and `apps/mobile/src/screens/ScanScreen.tsx` (Development Sprint 006) — your `LoginScreen` and navigator changes must follow the same minimal, no-business-logic pattern.
- Do not modify DT-001–DT-013 business logic, FB-001, TS-001, TTAP-001, any ADR, Product Vision, Product Principles, Domain Model, Role Model, or EP-008.

IMPLEMENTATION SCOPE (do exactly this, nothing more, in this order):
1. Extend `buildScanDemoPipeline`'s composition (in `runScan.ts`) so it can accept an optional externally-produced `CallerContext`, defaulting to the existing hard-coded demo caller when none is supplied. Do not break the existing `npm run demo:scan` script or its current behavior.
2. Add a test proving both the new external-`CallerContext` path and the pre-existing default path work correctly.
3. Build `LoginScreen` in `apps/mobile/src/screens/`: a credential input matching `Credentials`' `signInCode` shape, and a "Sign in" action calling `SessionService.signIn(...)` then `toCallerContext(...)`; on success, pass the resulting `CallerContext` to `ScanScreen`; on rejection, display the gateway's rejection reason as-is.
4. Extend `AppNavigator` to show `LoginScreen` before `ScanScreen`, without adding a routing library unless you find it genuinely necessary — document that decision if made.
5. Wire `ScanScreen`'s scan action to use the passed-in `CallerContext` via the extended composition root, instead of any hard-coded value.
6. Do not add persistence, network, real managed-auth-provider SDKs, or role/permission logic anywhere in this sprint.

ARCHITECTURE BOUNDARIES (do not violate):
- No business logic may be added to `LoginScreen`, `AppNavigator`, or the composition-root extension — they must only ever call existing `packages/core` exports and pass data through.
- Do not modify `SessionService.ts`, `AuthenticationGateway.ts`, `FakeAuthenticationGateway.ts`, `AuthenticationResult.ts`, `CallerContext.ts`, or `AssignmentValidator.ts`.
- Do not add Firebase, Firestore, any real auth SDK, or any HTTP client.
- Do not touch FB-001, TS-001, TTAP-001, any ADR, Product Vision, Product Principles, Domain Model, Role Model, or EP-008.

TESTING REQUIREMENTS:
- A composition-level test proving the extended `buildScanDemoPipeline` signature preserves existing CLI behavior and correctly uses an externally-provided `CallerContext` when given one.
- Run `npm run typecheck` and `npm run test` at the repository root; both must pass (existing 94 tests remain green) before you consider the task done.
- Manually launch the Expo app (or document precisely why that was not possible in this environment) and confirm the Login → Scan flow works end-to-end for at least one successful sign-in.

EXPECTED DELIVERABLES:
- The `runScan.ts` extension, `apps/mobile`'s `LoginScreen` and `AppNavigator`/`ScanScreen` changes, and their tests — committed with a clear commit message referencing DT-014 and Development Sprint 008.
- A new `## DT-014 – Mobile Session Integration` section added to `ADO/02_Development/EP-007_Development_Tasks.md` (Objective/Acceptance Criteria as defined in the plan's Section 10), plus a "Development Sprint 008 Implementation Notes" subsection, explicitly noting that DT-013's Acceptance Criteria are now satisfied across both tasks.
- A short implementation summary (changed files, test results, how to launch and manually verify the Login → Scan flow, and any environment limitations encountered) suitable for Review Agent evaluation.

STOP CONDITION:
Stop after completing the Implementation Scope, tests, and the EP-007_Development_Tasks.md update. Do not begin any further sprint (no persistence, no real NFC, no viewing/reporting). Do not mark DT-014 "Completed" yourself — that status requires Review Agent verification and Human Architect approval. Wait for review.
```

---

## 16. Role Handover

Implemented scope in this task: Development Sprint 008 planning only — this document and the embedded Development Agent Prompt. No source code was written or modified. No architecture, ADR, TTAP-001, FB-001, TS-001, Product Vision, Product Principles, Domain Model, Role Model, or EP-008 content was changed.

Changed artifacts: `ADO/02_Development/Development_Sprint_008_Plan.md` (new, this file). No other file was modified.

Related ADO artifacts consulted: Product Vision, Product Principles, Decision Log, AVR-001, ADR-0006, ADR-0007, TTAP-001, Domain Model, Role Model, FB-001, TS-001, Development Task Profile (DTP-001), `EP-007_Development_Tasks.md`, `Development_Sprint_001_Plan.md`–`Development_Sprint_007_Plan.md`, `Development_Sprint_007_Closure.md`, `MVP_Readiness_Assessment.md`, current `packages/core/src` (`cli/runScan.ts`, `application/SessionService.ts`, `AuthenticationResult.ts`, `ports/AuthenticationGateway.ts`, `infrastructure/adapters/FakeAuthenticationGateway.ts`), current `apps/mobile/src` (confirmed via direct listing: only `AppNavigator.tsx`/`ScanScreen.tsx` exist, no `LoginScreen`), EP-008 Chapters 00–03 (as synchronized through Development Sprint 007 — read for context, not modified per this task's explicit "Do not update EP-008" instruction).

Tests performed: none (planning-only task; no code changed). `packages/core`'s current test/typecheck state was last verified during the Sprint 007 governance closure (94 tests passing, typecheck clean); not re-run this turn since no code changed.

Known deviations: none from the assigned task scope. One correction to the task's own framing is documented in Sections 1–3: "Current Project State" describes "Authentication & Session Foundation" as COMPLETE, but repository evidence (DT-013's own status line, the Sprint 007 Closure Summary, and direct inspection of `apps/mobile`) shows this is only true for the `packages/core` half — a real user still cannot sign in through the app. This plan is framed accordingly as completing that gap, not as a new capability area.

Open findings carried forward (not resolved by this task): (1) Development Sprint 002 (DT-004/005/006) and Development Sprint 004 (DT-008) remain without recorded Review Agent verification or Human Architect approval; (2) Development Sprint 005's EP-008 implementation narrative remains unsynchronized (status only); (3) Finding F-01 (duplicate-scan/toggle mechanism) remains open; (4) `QueuedWorkEventRecord.decision: null` still has no integration-level test coverage; (5) the backend/persistence and real-managed-auth-provider technology decisions ADR-0007 defers are both still not made, and will gate Development Sprint 009+ (persistence/synchronization backend) exactly as they gated this analysis; (6) no simulator/device verification of `apps/mobile` has ever been performed in any environment this work has run in.

Evidence produced: this plan document, including the repository-evidence basis for recommending Sprint 008 as "finish DT-013" rather than "start Persistence/Firestore," and the DT-014 justification.

Next responsible role: Technical Lead / Human Architect review and approval of this Sprint 008 Plan. Per the assigned stop condition, implementation does not begin until that approval is given.

## 17. Stop Condition

Per task instruction: this task stops after producing the Development Sprint 008 Plan, the Development Agent Prompt and the Role Handover above. No code was implemented. No architecture, ADRs, TTAP-001, Product Vision, Product Principles, Domain Model, Role Model, or EP-008 were modified. Awaiting Technical Lead / Human Architect approval before implementation begins.
