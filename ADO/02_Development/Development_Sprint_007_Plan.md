# Development Sprint 007 Plan – First Authenticated User (Authentication Foundation)

Status: Planned
Role: Research / Implementation Support acting on behalf of Technical Lead (per AGR-001)
Epic: EP-007 – Product Architecture Foundation
Owner: Technical Lead
Approval Authority: Human Architect
Branch: `main`
Created Date: 2026-07-06
Related Development Task: **DT-013 (new — justified in Section 10)**
Related Artifacts: `EP-007_Development_Tasks.md`, `Development_Sprint_001_Plan.md`–`Development_Sprint_006_Plan.md`, `MVP_Readiness_Assessment.md`, TTAP-001, TS-001, FB-001, ADR-0003, ADR-0006, ADR-0007, `Domain_Model.md`, `Role_Model.md`

---

## 1. Executive Summary

The Technical Lead's proposal — make Sprint 007 the sprint that introduces the first authenticated user — is **accepted, with one scope correction, directly analogous to the corrections made in Sprint 005 (no physical NFC hardware) and Sprint 006 (mobile framework already Approved, only backend/auth technology deferred)**. Repository evidence shows Authentication is not a new concept being invented for this sprint: `CallerContext` (domain type, Development Sprint 001) already models `authenticated`/`unauthenticated` states and is already consumed by `AssignmentValidator`, which already rejects unauthenticated callers (`employee_not_authenticated`) — tested, implemented, unchanged since Sprint 001. What has never been built is the piece that *establishes* that identity: today, `packages/core/src/cli/runScan.ts`'s composition root hard-codes `authenticatedCaller(UserId('demo-employee'), organizationId)` on every run. Sprint 007 should replace that hard-coded construction with a real (locally-implemented, fake-first) session/login mechanism — **not** a real managed authentication provider, since ADR-0007 approves only the *category* ("managed authentication provider") and explicitly defers the *specific* technology to later refinement, exactly as it deferred the specific synchronization backend that Sprint 004 satisfied with `FakeSynchronizationGateway`. Sprint 007 as scoped here follows that same, already-proven pattern.

## 2. Repository Evidence

- `packages/core/src/domain/CallerContext.ts` (Development Sprint 001) already defines `CallerContext` as `{ status: 'authenticated'; userId; organizationId } | { status: 'unauthenticated' }`, with an in-file comment: "The pipeline receives caller identity, it does not establish one (Development Sprint 001 Plan, Section 7)." This is a design seam deliberately left open since Sprint 001, not a gap discovered late.
- `packages/core/src/business/AssignmentValidator.ts` already branches on `caller.status !== 'authenticated'`, returning `{ status: 'rejected', reason: 'employee_not_authenticated' }` — verified by direct inspection; this logic is implemented, tested, and must not change (Section 7).
- `packages/core/src/cli/runScan.ts`'s `buildScanDemoPipeline` hard-codes `const caller = authenticatedCaller(UserId('demo-employee'), organizationId);` — verified by direct inspection. This is the exact, single point where a real session/login result would need to be substituted for the hard-coded fixture; there is no other place in the repository that "establishes" caller identity today.
- TS-001 Security Requirements: "user must be authenticated, organization context must be verified, employee must have permission to create WorkEvents..." — an already-Approved requirement of the very feature (FB-001/TS-001) all prior sprints have implemented, not a new requirement invented for this sprint.
- TTAP-001 Glossary: "User | A person authenticated in TapTim.e" — the architecture already names authentication as a first-class concept, without a dedicated component ever having been assigned to build it.
- `ADR-0007-technology-platform-baseline.md` Decision: backend baseline includes "Authentication -> managed authentication provider" and "The exact implementation libraries and service configuration may be refined during Technical Specification and Development Tasks, but they must remain compatible with this platform baseline." The *category* (a managed provider will eventually back this) is Approved and Validated (AVR-001); the *specific provider* (e.g., Firebase Auth, referenced only as `Tech_Stack.md`'s non-binding reference-project evidence) is not yet chosen. This mirrors exactly how ADR-0007 treated synchronization and persistence technology before Sprint 004/003 built fakes against approved ports.
- `MVP_Readiness_Assessment.md` Section 5 (Implemented/Missing Capabilities): "Authentication and login (no auth provider, no session, no credential of any kind — `CallerContext` is a plain data object constructed directly in code)" — confirms, from a prior independent review, that zero authentication engineering investment exists yet.
- `MVP_Readiness_Assessment.md`'s original roadmap recommended Identity & Backend Foundation immediately after Mobile Foundation, citing: "every other missing capability (mobile login, durable storage, real synchronization, viewing data) depends on a real Organization/User/Employee existing somewhere other than hard-coded test fixtures... the one area with zero prior engineering investment." Mobile Foundation (Sprint 006) is now Completed, so this is the next item in that same evidence-based sequence.
- `Domain_Model.md` contains no `CallerContext`, `Session`, or authentication-related entity — verified by direct search (no matches). This is a documentation gap relative to `packages/core/src/domain/CallerContext.ts`'s existing implementation, flagged here (Section 15) but out of scope to correct, since this task's Do-Not list excludes architecture/domain documents.
- `Role_Model.md`'s Employee/Administrator/Team Lead/System Owner permission matrix has no backing implementation anywhere in `packages/core` — verified by direct search for role-checking logic (none exists beyond the binary `authenticated`/`unauthenticated` status). This confirms the sprint's Out of Scope boundary (no user/role management) is not merely a preference but a reflection of what does not exist yet to build against.
- `apps/mobile/src/screens/ScanScreen.tsx` (Development Sprint 006) is the only existing screen; `AppNavigator` (Development Sprint 006) is a deliberately minimal single-screen "navigator" with the explicit comment "establishing the pattern and location for future navigation" — an intentional extension point for exactly the kind of second screen (a Login/session screen) this sprint would add.
- `EP-007_Development_Tasks.md`'s Task Sequence (DT-001–DT-012) contains no task for authentication, session, or identity establishment — verified by re-reading every DT's Objective; this is a genuine gap, not a duplicate of existing scope (Section 10).
- Decision Log / `EP-007_Development_Tasks.md`: Development Sprint 005 and 006 (DT-011, DT-012) are both recorded as "Completed — Review Agent verified, Human Architect approved" (2026-07-06); Development Sprint 004 (DT-008) remains "Implemented — Pending Review" — an open item, unaffected by and not resolved by this sprint (Section 15).

## 3. Why Sprint 007 Is the Correct Next Sprint

**Accepted as proposed, with a scope correction on *how* authentication is built, not *whether* it should be built now.** The Technical Lead's proposal matches this role's own prior `MVP_Readiends_Assessment.md` roadmap (Identity & Backend Foundation as the sprint immediately following Mobile Foundation), and repository evidence reinforces it further than that assessment could at the time: the Business Core has had an `authenticated`/`unauthenticated` seam sitting unused since Sprint 001, `AssignmentValidator` already enforces it, and the only thing standing between "hard-coded demo caller" and "first authenticated user" is the single `authenticatedCaller(UserId('demo-employee'), ...)` call site in the composition root. No other candidate sprint is better supported by evidence: `DT-009` (Error Handling) has no Sprint-level urgency evidence (its Acceptance Criteria are substantially already satisfied in practice by the explicit-typed-result pattern — `BusinessEngineDecision`, `EnqueueResult`, `SynchronizationResult`, `ScanPipelineOutcome`, `AssignmentValidationResult` — used consistently since Sprint 001; it is a documentation/formalization task, not a blocked capability), and real persistence/synchronization (`MVP_Readiness_Assessment.md`'s Sprint 008 candidate) is explicitly gated on a Human Architect backend-technology decision that has still not been made — the same class of decision this sprint must avoid making prematurely for authentication too.

The correction: ADR-0007 approves "managed authentication provider" as a category, not a specific product. Building a real integration with, say, Firebase Auth this sprint would require a Human Architect technology decision that has not been made (mirrored in `Tech_Stack.md`'s treatment of the `frogs-zeiterfassung` reference project as non-binding evidence, not a source baseline) and would introduce real credentials/project configuration this environment cannot exercise. Per "Extend before Create," "Reality has priority over architecture," and the repository's own established, repeatedly-successful pattern (`FakeNfcScanAdapter`, `InMemory*Repository`, `FakeSynchronizationGateway`), Sprint 007 should define an `AuthenticationGateway`-style port plus a fake/local implementation and a `SessionService`/current-user context — establishing the seam and proving the end-to-end flow (login screen → session → real `CallerContext` reaching `AssignmentValidator`) without picking, or requiring the Human Architect to pick, the eventual managed provider. This is the same discipline that let Sprint 003/004 build a complete, testable Offline Queue and Synchronization Service years before any real backend exists.

## 4. Business Objective

Give the product what Product Vision's "One Tap. One Decision." already assumes exists: a specific person, not an anonymous demo fixture, standing behind every scan. A user opens the mobile app, signs in, and the identity they establish is the one `AssignmentValidator` and every downstream Business Rule already evaluate — closing the gap between "the Business Core enforces authentication" (true since Sprint 001) and "a real person can actually authenticate" (not yet true).

## 5. Technical Objective

Introduce a `Session`/current-user concept in `packages/core` backed by a new `AuthenticationGateway` port and a fake/local implementation (mirroring `FakeSynchronizationGateway`'s role for DT-008), and a minimal Login screen in `apps/mobile` that calls it and produces a real `CallerContext` — replacing `runScan.ts`'s hard-coded `authenticatedCaller(...)` call with the actual result of a session, without altering `AssignmentValidator`, `BusinessEngine`, or any other already-implemented business logic in any way.

## 6. Scope

- A new `CredentialSet`/`AuthenticationGateway` port in `packages/core/src/ports/` describing "verify credentials, return an authenticated session or an explicit rejection" — following the same explicit-typed-result discipline as `SynchronizationResult`/`EnqueueResult` (e.g. `AuthenticationResult = { status: 'authenticated'; userId; organizationId } | { status: 'rejected'; reason: 'invalid_credentials' | ... }`).
- A fake/local implementation of that port (e.g. `FakeAuthenticationGateway`, in `packages/core/src/infrastructure/adapters/`) that authenticates one or more clearly-labeled demo users against in-memory credentials — mirroring `FakeSynchronizationGateway`'s configurable-double role, not a placeholder built by omission.
- A small `SessionService` (or equivalently named application-layer class) that calls the `AuthenticationGateway` and, on success, produces a real `CallerContext` via the existing `authenticatedCaller(userId, organizationId)` helper (already defined in `CallerContext.ts`, unchanged) — no new `CallerContext` shape is introduced.
- Extending `buildScanDemoPipeline` (or introducing a small, clearly-scoped composition change) so the composition root can accept a `CallerContext` produced by a real session instead of always constructing the hard-coded demo caller — an extension of DT-011's existing composition root, not a rewrite of it.
- A minimal Login screen in `apps/mobile` (e.g. `src/screens/LoginScreen.tsx`): a credential input (matching whatever minimal shape the fake gateway expects) and a "Sign in" button that calls the new `SessionService`, and, on success, navigates to the existing `ScanScreen` carrying the resulting session/`CallerContext`; on rejection, displays the rejection reason without inventing new business rules about *why* a login is rejected beyond what the fake gateway's explicit result already states.
- A minimal extension of `AppNavigator` to conditionally show `LoginScreen` before `ScanScreen` — the "single-screen navigator" from Sprint 006 becomes a two-screen navigator, still without a routing library if avoidable (per Sprint 006's precedent of deferring that dependency until genuinely needed).
- Passing the now-real `CallerContext` from `apps/mobile` into the composition root's scan call, so `ScanScreen`'s scan action uses the signed-in user's identity rather than the Sprint 005/006 hard-coded fixture.

## 7. Out of Scope

- **Firestore or any real persistence** for users, credentials, or sessions — unchanged from every prior sprint's deferral (ADR-0006/ADR-0007); credentials and sessions live only in the fake gateway's in-memory store this sprint.
- **A real managed authentication provider** (e.g. Firebase Auth) — the specific technology remains a Human Architect decision not yet made (Section 3); this sprint builds the port and a fake implementation only, exactly as Sprint 004 did for synchronization.
- **Real NFC hardware** — untouched; `ScanScreen`'s placeholder scan trigger is unaffected by this sprint except for now receiving a real `CallerContext`.
- **User management UI, role/permission administration** — `Role_Model.md`'s full permission matrix (Administrator, Team Lead, System Owner capabilities) is not built; this sprint authenticates a single Employee-shaped user sufficient to exercise the existing `AssignmentValidator` checks, nothing more.
- **Reporting, Admin Portal** — untouched.
- **Production deployment** — no app store submission, no build signing, no CI/CD changes.
- **Session persistence across app restarts** — an in-memory session for the lifetime of the app run is sufficient to prove the flow; durable session storage is a persistence concern deferred with everything else in Section 7.
- **Any change to DT-001–DT-012 business logic, FB-001, TS-001, TTAP-001, any ADR, Product Vision, Product Principles, Domain Model, Role Model, or EP-008.**

## 8. Existing Components (Reused, Not Recreated)

| Component | File | Reused As |
|---|---|---|
| `CallerContext` type + `authenticatedCaller()`/`UNAUTHENTICATED_CALLER` | `packages/core/src/domain/CallerContext.ts` | The exact shape a real session must produce; unchanged. |
| `AssignmentValidator`'s `employee_not_authenticated` rejection | `packages/core/src/business/AssignmentValidator.ts` | Continues to be the single place authentication status is enforced for business purposes; unchanged. |
| `buildScanDemoPipeline` composition root (DT-011) | `packages/core/src/cli/runScan.ts` | Extended (not rewritten) to accept a real `CallerContext` instead of always constructing the demo one. |
| `AppNavigator` single-screen foundation (DT-012) | `apps/mobile/src/navigation/AppNavigator.tsx` | Extended to a two-screen (Login → Scan) flow, using the pattern it was explicitly built to allow. |
| Explicit-typed-result pattern (`BusinessEngineDecision`, `EnqueueResult`, `SynchronizationResult`) | `packages/core/src/{business,application}/*` | Directly reused as the template for the new `AuthenticationResult` type — no new error-handling idiom invented. |
| `FakeSynchronizationGateway`'s configurable-double pattern (DT-008) | `packages/core/src/infrastructure/adapters/FakeSynchronizationGateway.ts` | Directly reused as the template for `FakeAuthenticationGateway`'s shape and testing style. |

## 9. Authentication Components (New This Sprint)

| Component | Type | Location (proposed) |
|---|---|---|
| `AuthenticationGateway` port | Port interface | `packages/core/src/ports/AuthenticationGateway.ts` |
| `AuthenticationResult` (explicit typed result) | Application/domain type | `packages/core/src/application/AuthenticationResult.ts` (or `domain/`, per Development Agent's judgment, consistent with where `SynchronizationResult` lives) |
| `FakeAuthenticationGateway` | Infrastructure adapter (fake) | `packages/core/src/infrastructure/adapters/FakeAuthenticationGateway.ts` |
| `SessionService` (or equivalently named) | Application service | `packages/core/src/application/SessionService.ts` |
| `LoginScreen` | Mobile app code | `apps/mobile/src/screens/LoginScreen.tsx` |
| `AppNavigator` extension (Login → Scan flow) | Mobile app code | `apps/mobile/src/navigation/AppNavigator.tsx` (extended) |

## 10. Development Task Mapping

- **Composition root extension (reused, not a new DT)** — extending `buildScanDemoPipeline` to accept an externally-produced `CallerContext` is a minor extension of DT-011's existing Acceptance Criteria, not new business logic; it does not warrant a separate Development Task.
- **DT-013 (new) — Authentication & Session Foundation.** Repository evidence (Section 2) shows no existing DT-001–DT-012 Objective covers establishing caller identity, sessions, or login. Per the standing instruction to create new DT identifiers only when no existing DT covers the work, and to propose new IDs after the existing sequence pending approval: DT-013 is proposed here for Human Architect/Technical Lead approval, not yet implemented.
  - Objective: Establish a `Session`/current-user mechanism — an `AuthenticationGateway` port, a fake/local implementation, a `SessionService`, and a mobile Login screen — that produces a real `CallerContext` for the existing scan composition root, without changing any business decision logic that already depends on `CallerContext`.
  - Acceptance Criteria: `AuthenticationGateway` port and `FakeAuthenticationGateway` exist and are tested in isolation; `SessionService` calls the gateway and returns/produces a `CallerContext` using the existing `authenticatedCaller()`/`UNAUTHENTICATED_CALLER` helpers, unchanged; `apps/mobile` gains a `LoginScreen` that calls `SessionService` and, on success, navigates to `ScanScreen` carrying the resulting `CallerContext`; the scan composition root uses the signed-in session's `CallerContext` instead of the Sprint 005/006 hard-coded demo caller; `AssignmentValidator`'s existing `employee_not_authenticated` behavior is exercised, not modified; no persistence, network, or real managed-auth-provider code is added.

## 11. Testing Strategy

- `AuthenticationGateway`/`FakeAuthenticationGateway` unit tests: successful authentication, invalid-credentials rejection, and (if the fake models it) an "already signed in"/idempotency case — following `FakeSynchronizationGateway.test.ts`'s pattern of testing the double's configurability, not business logic.
- `SessionService` unit tests: verify it forwards the gateway's result faithfully and produces the same `CallerContext` shape `authenticatedCaller()` already produces — a dedicated test, mirroring `SynchronizationService.test.ts`'s "does not read or branch on decision" boundary test, should assert `SessionService` does not itself decide anything beyond "did the gateway say authenticated or not."
- A pipeline-level test extending `NfcScanToTimeEntryPipeline.test.ts` (or a sibling test) to confirm a scan performed with a `SessionService`-derived `CallerContext` reaches the same outcomes as one performed with the existing hard-coded `authenticatedCaller(...)` fixture — proving the substitution is behavior-preserving, not behavior-changing.
- No new tests are needed for `AssignmentValidator`'s existing authentication check — it is unchanged and already covered by DT-003's tests.
- Manual verification (documented, consistent with Sprint 006's precedent given this environment's lack of a simulator/device): launch `apps/mobile`, sign in via `LoginScreen`'s fake credentials, confirm navigation to `ScanScreen`, and confirm a scan performed afterward produces the same outcome shapes the CLI/Sprint 006 screen already proved for an authenticated caller.
- If the Development Agent's environment cannot run a full Expo/Metro build or launch a simulator, that limitation must be documented explicitly (as DT-012's own notes already do), not silently skipped.

## 12. Risks

| Risk | Mitigation |
|---|---|
| Building toward a real managed authentication provider prematurely, before the Human Architect has chosen one | Section 3/7 explicitly restrict this sprint to a fake/local `AuthenticationGateway` implementation; the port is designed so a real provider can be substituted later without changing `SessionService` or any business code. |
| Business/authorization logic (role checks, permission matrix) creeping into the authentication layer "since we're building login anyway" | Section 7 explicitly excludes `Role_Model.md`'s permission matrix; `SessionService`/`LoginScreen` must produce only the existing binary `CallerContext`, not a new role-bearing type. |
| Re-implementing or altering `AssignmentValidator`'s existing `employee_not_authenticated` check | DT-013's Acceptance Criteria explicitly require this check be exercised, not modified; a regression test should assert its behavior is unchanged. |
| Session state management inside `apps/mobile` growing into a general-purpose state library dependency | Scope explicitly allows the minimal in-memory session needed for one Login → Scan transition; do not add a state-management library not required by this sprint. |
| Two-screen navigation requiring a routing library sooner than needed | Follow Sprint 006's precedent: attempt a minimal conditional-render navigator first; only introduce a routing library if the Development Agent finds it genuinely necessary, and document that decision if made. |
| No simulator/device available to manually verify the Login → Scan flow launches correctly | Documented as a known constraint (Section 11), consistent with DT-012's own precedent, rather than silently claimed as verified. |

## 13. Definition of Done

- `AuthenticationGateway` port and `FakeAuthenticationGateway` exist in `packages/core`, are tested in isolation, and follow the existing explicit-typed-result pattern.
- `SessionService` exists, is tested, and produces `CallerContext` values using the existing, unchanged `authenticatedCaller()`/`UNAUTHENTICATED_CALLER` helpers.
- `apps/mobile` gains a `LoginScreen`; `AppNavigator` shows it before `ScanScreen` and passes the resulting session/`CallerContext` through.
- The scan composition root's hard-coded `authenticatedCaller(UserId('demo-employee'), ...)` call site is replaced by (or made conditional on) a real session-derived `CallerContext`, with no change to any downstream business decision logic.
- `AssignmentValidator`'s existing `employee_not_authenticated` behavior remains exercised and unchanged, confirmed by existing/extended tests.
- `npm run typecheck` and `npm run test` pass across the monorepo (existing 81 `packages/core` tests, plus any new tests added this sprint, all green); `apps/mobile`'s own typecheck passes.
- `EP-007_Development_Tasks.md` gets a new `## DT-013 – Authentication & Session Foundation` section (Objective/Acceptance Criteria as in Section 10) plus a "Development Sprint 007 Implementation Notes" subsection.
- No change to DT-001–DT-012 business logic, FB-001, TS-001, TTAP-001, any ADR, Product Vision, Product Principles, Domain Model, Role Model, or EP-008.
- Review Agent verification and Human Architect approval are recorded before DT-013 is marked Completed (DTP-001: "Implementation alone never completes a Development Task").

## 14. Recommended Implementation Order

1. Define the `AuthenticationResult` explicit typed result and the `AuthenticationGateway` port in `packages/core`.
2. Implement `FakeAuthenticationGateway` with a small, clearly-labeled set of demo credentials (mirroring the existing demo Organization/Employee/Customer/NfcTag/NfcAssignment seed data already used by `buildScanDemoPipeline`).
3. Implement `SessionService`, calling the gateway and producing a `CallerContext` via the existing helper functions, unchanged.
4. Extend `buildScanDemoPipeline` (or its composition wiring) to accept a `CallerContext` produced externally, defaulting to today's hard-coded demo caller only where no session has been established yet — preserving backward compatibility for the existing CLI usage.
5. Add tests for the gateway, `SessionService`, and the pipeline-level substitution proof.
6. Build the minimal `LoginScreen` in `apps/mobile` and extend `AppNavigator` to a Login → Scan flow.
7. Wire `ScanScreen`'s scan action to use the session-derived `CallerContext` instead of any hard-coded value.
8. Manually verify (or document why not possible) the full Login → Scan flow in this environment; compare outcomes against prior CLI/Sprint 006 screen results for the same scan input.
9. Run `npm run typecheck` and `npm run test` for the whole monorepo.
10. Add the new `DT-013` section to `EP-007_Development_Tasks.md` with Sprint 007 implementation notes.
11. Produce implementation evidence and role handover; request Review Agent verification.

---

## 15. Development Agent Prompt

The following prompt is written to be given directly to Claude Code (Development Agent) to execute Development Sprint 007. It is self-contained and does not require this planning document to be re-explained.

```text
You are the Development Agent for TapTim.e, implementing Development Sprint 007 ("First Authenticated User" / Authentication Foundation) on branch `main`.

CONTEXT (verify before writing code):
- Read `ADO/02_Development/Development_Sprint_007_Plan.md` in full — it is the authoritative scope for this task, including why this sprint builds a FAKE/local authentication mechanism, not a real managed provider integration (Sections 3 and 7).
- Read `packages/core/src/domain/CallerContext.ts` — this is the exact type your session mechanism must produce. Do not change its shape.
- Read `packages/core/src/business/AssignmentValidator.ts` — note its existing `employee_not_authenticated` rejection. Do not modify this file's logic; your changes must make this check exercised with real sessions, not alter what it does.
- Read `packages/core/src/cli/runScan.ts` (`buildScanDemoPipeline`) — find the hard-coded `authenticatedCaller(UserId('demo-employee'), organizationId)` call. This is the exact substitution point for a real session's `CallerContext`.
- Read `packages/core/src/application/SynchronizationService.ts` and `packages/core/src/infrastructure/adapters/FakeSynchronizationGateway.ts` — use these as the direct template for your new `AuthenticationGateway`/`FakeAuthenticationGateway`/`SessionService` (explicit typed result, configurable fake double).
- Read `apps/mobile/src/navigation/AppNavigator.tsx` and `apps/mobile/src/screens/ScanScreen.tsx` (Development Sprint 006) — your `LoginScreen` and navigator changes must follow the same minimal, no-business-logic pattern.
- Do not modify DT-001–DT-012 business logic, FB-001, TS-001, TTAP-001, any ADR, Product Vision, Product Principles, Domain Model, Role Model, or EP-008.

IMPLEMENTATION SCOPE (do exactly this, nothing more, in this order):
1. Define `AuthenticationResult` (explicit typed result, e.g. `{ status: 'authenticated'; userId; organizationId } | { status: 'rejected'; reason: 'invalid_credentials' }`) and an `AuthenticationGateway` port (`authenticate(credentials): AuthenticationResult`) in `packages/core/src/ports/`.
2. Implement `FakeAuthenticationGateway` in `packages/core/src/infrastructure/adapters/`, seeded with a small, clearly-labeled set of demo credentials consistent with the existing demo Organization/Employee data already used by `buildScanDemoPipeline`.
3. Implement `SessionService` in `packages/core/src/application/`, calling `AuthenticationGateway` and producing a `CallerContext` via the existing `authenticatedCaller()`/`UNAUTHENTICATED_CALLER` helpers — do not invent a new identity type.
4. Extend `buildScanDemoPipeline`'s composition (in `runScan.ts`, or a clean extraction if warranted) so it can accept an externally-produced `CallerContext`, defaulting to the existing hard-coded demo caller only for the current CLI usage (do not break the existing `npm run demo:scan` script).
5. Build `LoginScreen` in `apps/mobile/src/screens/`: a minimal credential input and "Sign in" action calling `SessionService`; on success, navigate to `ScanScreen`, passing the resulting `CallerContext` through so the scan action uses it instead of any hard-coded value; on rejection, display the gateway's rejection reason as-is.
6. Extend `AppNavigator` to show `LoginScreen` before `ScanScreen`, without adding a routing library unless you find it genuinely necessary — document that decision if made.
7. Do not add persistence, network, real managed-auth-provider SDKs, or role/permission logic anywhere in this sprint.

ARCHITECTURE BOUNDARIES (do not violate):
- No business logic (assignment resolution, validation, WorkEvent creation, Business Engine decisions, queueing, synchronization) may be written inside the authentication layer or `apps/mobile`. `SessionService` and `AuthenticationGateway` must only ever produce or reject a `CallerContext` — they must never branch on organization/assignment/WorkEvent business meaning.
- Do not modify `AssignmentValidator.ts`'s existing authentication check.
- Do not add Firebase, Firestore, any real auth SDK, or any HTTP client.
- Do not touch FB-001, TS-001, TTAP-001, any ADR, Product Vision, Product Principles, Domain Model, Role Model, or EP-008.
- Do not build role/permission enforcement beyond the existing binary authenticated/unauthenticated check.

TESTING REQUIREMENTS:
- Unit tests for `FakeAuthenticationGateway` (success, rejection cases) and `SessionService` (forwards the gateway's result faithfully; does not itself decide anything).
- A pipeline-level test proving a scan performed with a `SessionService`-derived `CallerContext` reaches the same outcomes as the existing hard-coded-caller path.
- Run `npm run typecheck` and `npm run test` at the repository root; both must pass (existing tests remain green) before you consider the task done.
- Manually launch the Expo app (or document precisely why that was not possible in this environment) and confirm the Login → Scan flow works for at least one successful and one rejected credential.

EXPECTED DELIVERABLES:
- New `packages/core` files (`AuthenticationGateway`, `AuthenticationResult`, `FakeAuthenticationGateway`, `SessionService`) and their tests; `apps/mobile`'s `LoginScreen` and `AppNavigator` extension; the `runScan.ts` composition extension — committed with a clear commit message referencing DT-013 and Development Sprint 007.
- A new `## DT-013 – Authentication & Session Foundation` section added to `ADO/02_Development/EP-007_Development_Tasks.md` (Objective/Acceptance Criteria as defined in the plan's Section 10), plus a "Development Sprint 007 Implementation Notes" subsection.
- A short implementation summary (changed files, test results, how to launch and manually verify the Login → Scan flow, and any environment limitations encountered) suitable for Review Agent evaluation.

STOP CONDITION:
Stop after completing the Implementation Scope, tests, and the EP-007_Development_Tasks.md update. Do not begin any further sprint (no real managed auth provider, no persistence, no role/permission UI, no real NFC). Do not mark DT-013 "Completed" yourself — that status requires Review Agent verification and Human Architect approval. Wait for review.
```

---

## 16. Role Handover

Implemented scope in this task: Development Sprint 007 planning only — this document and the embedded Development Agent Prompt. No source code was written or modified. No architecture, ADR, TTAP-001, FB-001, TS-001, Product Vision, Product Principles, Domain Model, Role Model, or EP-008 content was changed.

Changed artifacts: `ADO/02_Development/Development_Sprint_007_Plan.md` (new, this file). No other file was modified.

Related ADO artifacts consulted: Product Vision, Product Principles, Decision Log, AVR-001, ADR-0003, ADR-0006, ADR-0007, TTAP-001, Domain Model, Role Model, FB-001, TS-001, Development Task Profile (DTP-001), `EP-007_Development_Tasks.md`, `Development_Sprint_001_Plan.md`–`Development_Sprint_006_Plan.md`, `Development_Sprint_005_Closure.md`, `Development_Sprint_006_Closure.md`, `Development_Sprint_006_Governance_Closure.md`, `MVP_Readiness_Assessment.md`, current `packages/core/src` (`domain/CallerContext.ts`, `business/AssignmentValidator.ts`, `cli/runScan.ts`, `index.ts`), current `apps/mobile/src` (`navigation/AppNavigator.tsx`, `screens/ScanScreen.tsx`), EP-008 Chapters 00–03 (as synchronized through Development Sprint 006's Mobile Foundation; Sprint 005's own narrative sync remains an open, carried-forward gap — see EP-008 Ch00 Section 10.8).

Tests performed: none (planning-only task; no code changed). `packages/core`'s current test/typecheck state was last verified during the Sprint 006 governance closure (81 tests passing, typecheck clean); not re-run this turn since no code changed.

Known deviations: none from the assigned task scope. One scope correction is documented in Section 3, directly analogous to the Sprint 005/006 self-corrections already on record: Authentication Foundation is accepted as the correct next sprint, but scoped as a fake/local `AuthenticationGateway` and `SessionService`, not a real managed-authentication-provider integration, since ADR-0007 defers the specific provider choice to a Human Architect decision not yet made.

Open findings carried forward (not resolved by this task): (1) Development Sprint 002 (DT-004/005/006) and Development Sprint 004 (DT-008) remain without recorded Review Agent verification or Human Architect approval; (2) Development Sprint 005's EP-008 implementation narrative has still never been synchronized into EP-008 Chapters 00–03 (only a status-table row and Decision Log row exist for it); (3) Finding F-01 (duplicate-scan/toggle mechanism) remains open; (4) `QueuedWorkEventRecord.decision: null` still has no integration-level test coverage; (5) `Domain_Model.md` does not document `CallerContext` even though it has existed in `packages/core` since Sprint 001 — a documentation gap noted here, not corrected, since Domain Model is on this task's Do-Not-modify list; (6) the backend/auth technology decision ADR-0007 defers is still not made, and will gate whichever future sprint attempts to replace `FakeAuthenticationGateway` with a real managed provider.

Evidence produced: this plan document, including the repository-evidence basis for accepting Sprint 007 as proposed and the scope correction restricting it to a fake/local authentication mechanism.

Next responsible role: Technical Lead / Human Architect review and approval of this Sprint 007 Plan. Per the assigned stop condition, implementation does not begin until that approval is given.

## 17. Stop Condition

Per task instruction: this task stops after producing the Development Sprint 007 Plan, the Development Agent Prompt and the Role Handover above. No code was implemented. No architecture, ADRs, TTAP-001, Product Vision, Product Principles, Domain Model, Role Model, or EP-008 were modified. Awaiting Technical Lead / Human Architect approval before implementation begins.
