# External CTO Review Triage – Core Prototype to Commercial Readiness

Role: Research / Implementation Support acting on behalf of Technical Lead (per AGR-001)
Date: 2026-07-10
Scope: Governance / roadmap integration only. No product code changed. No source file modified. No Development Sprint 020 implementation started.
Related Artifacts: `ADO/05_Evidence/Core_Roadmap_v2_Commercial_Readiness.md`, `ADO/00_Core/Project_Status.md`, `ADO/00_Core/Decision_Log.md`, `ADO/05_Evidence/Product_Readiness_Assessment.md`, `ADO/05_Evidence/Product_Readiness_Roadmap.md`, `ADO/02_Development/Development_Sprint_019_Closure.md`, `ADO/05_Evidence/EP-008/EP-008_Synchronization_Update_Sprint019.md`

---

## 1. Executive Summary

An external CTO review of the TapTim.e repository was conducted and reported back to the Technical Lead. Its conclusions are recorded here as repository evidence and independently re-verified against actual source code before being accepted:

- The external review confirms TapTim.e has a strong architecture foundation — hexagonal ports/adapters separation, disciplined orchestration-only Application Services, and a repository-verifiable test culture, all independently re-confirmed in Section 3 below.
- The external review confirms the current repository state is a **Core Prototype**, not a sales-ready product: the scan-to-WorkEvent pipeline and the Organization Management Foundation are both proven correct at the code/test-verification level (`Development_Sprint_019_Closure.md`), but no real backend, no real authentication, no installable app distribution, no CI, and no complete TimeEntry stop lifecycle exist yet, and the mobile runtime still runs against hard-coded demo fixtures rather than real Organization-owned data.
- **No rewrite is recommended.** The external review and this triage agree the architecture is sound; the work required is reprioritization and completion of runtime/product readiness, not architectural correction.
- The roadmap must be rebalanced toward runtime composition, backend, authentication, synchronization, distribution and commercial readiness — this is the purpose of `Core_Roadmap_v2_Commercial_Readiness.md`, created alongside this triage.

A note on the prior timeline this review supersedes: no repository artifact reviewed for this triage (`Product_Readiness_Roadmap.md`, `Product_Readiness_Assessment.md`, any Development Sprint Plan or Closure) contains a written "8–12 workday" commercial-readiness estimate. That figure predates this triage as an informal planning assumption outside the ADO record, not a documented repository claim. This triage does not need that estimate to have been written down to supersede it: it records, going forward, that the realistic path documented in `Core_Roadmap_v2_Commercial_Readiness.md` (6–9 weeks to technical pilot readiness, 3–5 months to sales readiness, 4–7 months to a first paying customer, all at approximately 4 hours/day) is now the authoritative planning baseline, replacing any prior informal estimate.

## 2. Review Scope

The external review, and this triage's own independent re-verification of it, inspected:

- Source code: `packages/core/src/domain/TimeEntry.ts`, `packages/core/src/business/BusinessEngine.ts`, `packages/core/src/application/WorkEventCreationService.ts`, `packages/core/src/application/NfcScanApplicationService.ts`, `packages/core/src/cli/runScan.ts`, `apps/mobile/src/screens/ScanScreen.tsx`, `apps/mobile/src/screens/LoginScreen.tsx`, `apps/mobile/src/nfc/RnNfcScanAdapter.ts`, `packages/core/src/infrastructure/persistence/JsonFileStore.ts`, `packages/core/tsconfig.json`, `packages/core/src/ports/` (checked for `async`/`Promise` usage), `.github/workflows/`, `apps/mobile/app.json`.
- Tests: `npm run test --workspace=@taptime/core` (221 tests) and `npm run test --workspace=apps/mobile` (10 tests), both re-run during this triage and confirmed passing.
- ADO documentation: `Project_Status.md`, `Decision_Log.md`, `EP-007_Development_Tasks.md`, `EP-009_Product_Readiness_Framework.md`, `Product_Readiness_Assessment.md`, `Product_Readiness_Roadmap.md`, EP-008 Chapters 00–03, `Development_Sprint_019_Closure.md`, `EP-008_Synchronization_Update_Sprint019.md`, root `README.md`, `package.json` (root, `packages/core`, `apps/mobile`).
- Runtime paths: how `apps/mobile`'s `ScanScreen`/`LoginScreen` actually construct and call the pipeline, as opposed to what the pipeline is capable of in isolation.

## 3. Confirmed Strengths

Independently re-verified, not merely accepted from the external review's own report:

- **Clean hexagonal architecture.** `NfcScanApplicationService`, `WorkEventCreationService`, and `OrganizationAdministrationService` all orchestrate only — no business decision is made inside an Application Service (confirmed by direct inspection; every accept/reject/escalate decision is delegated to `AssignmentResolver`/`AssignmentValidator`/`BusinessEngine`/`MembershipAuthorizationValidator`).
- **Disciplined ports/adapters separation.** Every port under `packages/core/src/ports/` is a plain interface; `InMemory*`/`File*`/`Cli*`/`Fake*`/`Rn*` adapters each implement one port without leaking adapter-specific concerns into the business or application layers.
- **Honest governance documentation.** Every Development Sprint Closure since Sprint 003 discloses known limitations, deviations, and open findings explicitly rather than omitting them (e.g. `Development_Sprint_019_Closure.md` Section 7's own Known Remaining Risks) — this is why the gaps this triage records were already independently visible in the repository's own governance record before this external review, not newly discovered by it.
- **No rewrite required.** Confirmed: every finding below (Section 4) is a missing or incomplete capability, not a structural defect in the existing architecture. The scan pipeline, the Business Engine decision boundary, and the ports/adapters seams are all sound and are reused, unchanged, by the roadmap in Section 5.
- **Organization Management Foundation valid at code/test-verification level.** DT-017–DT-026 are all Completed (`Development_Sprint_019_Closure.md`); `OrganizationOwnedScanPipeline.test.ts` proves Organization-owned data composes correctly with the existing FB-001 scan pipeline. This is real, tested evidence — its limitation (Section 4, K1) is that it is not yet reachable from the actual mobile runtime, not that it is incorrect.

## 4. Confirmed Critical Findings

Each finding below was independently re-verified against current source code during this triage, not accepted from the external review's report alone.

**K1 – Demo pipeline is still the production/mobile runtime path.** Confirmed by direct inspection of `apps/mobile/src/screens/ScanScreen.tsx`: `pipeline = useMemo(() => buildScanDemoPipeline(...), [])` constructs the pipeline from `packages/core/src/cli/runScan.ts`'s `buildScanDemoPipeline(...)`, which hard-codes `organizationId = 'demo-org'`, a single demo `Customer`/`NfcTag`/`NfcAssignment` (`DEMO_KNOWN_PAYLOAD = 'demo-tag-payload'`), all seeded directly into fresh `InMemory*Repository` instances at construction time. A real scanned tag cannot resolve to an accepted outcome unless its payload literally equals `'demo-tag-payload'`. No Organization, Membership, Customer, NfcTag, or NfcAssignment created via `OrganizationManagementService`/`MembershipService`/`OrganizationAdministrationService` is reachable from the mobile runtime today.

**K2 – NFC port architecture is bypassed in mobile runtime.** Confirmed by direct inspection of `ScanScreen.tsx`: `RnNfcScanAdapter` (which correctly implements `NfcScanPort`) is constructed separately from the pipeline (`nfcAdapter = useMemo(() => new RnNfcScanAdapter(), [])`), and `handleNfcScan()` calls `nfcAdapter.waitForNextTag()` directly to get a raw payload string, then passes that string into `pipeline.scan(result.payload, caller)` — which internally feeds it to a *different* `NfcScanPort` implementation, `CliNfcScanAdapter`, via `adapter.setInput(rawPayload)` inside `buildScanDemoPipeline`. `RnNfcScanAdapter`'s own `scan()` method (the actual `NfcScanPort` contract method) is never called by `NfcScanApplicationService.submitScan(...)` in the mobile runtime — only `waitForNextTag()`, a method outside the `NfcScanPort` interface, is used, and only to extract a string that is then routed through an unrelated port instance.

**K3 – TimeEntry has no stop lifecycle.** Confirmed by direct inspection of `packages/core/src/domain/TimeEntry.ts`: `status: 'started'` is the only value the type permits (the file's own comment states "Only the 'started' status is implemented this sprint... 'stopped'/'pending' depend on Finding F-01 and are not modeled yet"). `BusinessEngine.evaluate(...)` (`packages/core/src/business/BusinessEngine.ts`) returns `{ status: 'escalation_required', reason: 'duplicate_scan_rule_undefined' }` for any repeat scan against a target with an already-active `TimeEntry` — this escalation has no consumer-facing resolution path; it is observability-only (classified `'deferred'` per DT-009). This blocks any real time-tracking use: an employee cannot end a shift through the product today.

**K4 – No real authentication.** Confirmed by direct inspection of `apps/mobile/src/screens/LoginScreen.tsx`: `sessionService = useMemo(() => new SessionService(new FakeAuthenticationGateway()), [])` is constructed directly inside the screen component. `FakeAuthenticationGateway` is demo/test code, bundled directly into the shipped app; no real identity provider, credential store, or token/session model exists.

**K5 – Backend/server missing.** Confirmed by absence: no server, no real network-reachable persistence, no server-side security rule, and no tenant-isolation enforcement exists anywhere in the repository outside in-process unit tests. `InMemory*`/`File*` adapters are the only persistence implementations; both are single-process, single-device.

**K6 – Sync implementation missing.** Confirmed: `FakeSynchronizationGateway` (`packages/core/src/infrastructure/adapters/FakeSynchronizationGateway.ts`) is the only `SynchronizationGateway` implementation in the repository; it simulates success/retryable-failure/conflict outcomes but performs no real network call. No real server-backed sync gateway exists.

**K7 – Async port migration risk.** Confirmed by direct inspection: `grep -r "Promise\|async" packages/core/src/ports/` returns zero matches — every port in the repository (`OfflineQueue`, `WorkEventRepository`, `TimeEntryRepository`, `CustomerRepository`, `NfcTagRepository`, `NfcAssignmentRepository`, `OrganizationRepository`, `MembershipRepository`, `NfcScanPort`, `SynchronizationGateway`, `AuthenticationGateway`) is fully synchronous. `JsonFileStore.ts` uses `readFileSync`/`writeFileSync` synchronously, consistent with this. Any real backend adapter (a network call to a real server) is inherently asynchronous — every port, every Application Service method signature, and every calling test will need to change from a synchronous to an async-compatible contract before a real backend adapter can be written. This is a structural migration, not a small edit, and doing it after backend work has begun would be materially more expensive than planning for it first (Section 5, Block B).

**K8 – No CI.** Confirmed: `.github/workflows/` contains only a `.gitkeep` file — no workflow file exists. Neither `npm run typecheck` nor `npm run test` is enforced on push or pull request; both currently pass only because they are run manually and disclosed in each Development Sprint Closure.

**K9 – Tests are excluded from TypeScript typecheck.** Confirmed: `packages/core/tsconfig.json`'s `"include": ["src"]` does not cover `tests/`. This is a standing, previously-disclosed repository-hygiene finding (first surfaced by DT-024's constructor-arity regression, `Development_Sprint_017_Closure.md`) — every closure since has run a supplementary, temporary tests-inclusive `tsc --noEmit` check to work around it, but the underlying `tsconfig.json` setting itself has never been changed.

**K10 – JsonFileStore is not safe enough for durable local truth.** Confirmed by direct inspection of `packages/core/src/infrastructure/persistence/JsonFileStore.ts`: `writeJsonArray(...)` performs a direct `writeFileSync` to the target path with no atomic temp-file-then-rename pattern, so a crash or power loss mid-write can leave a truncated or corrupted file; `readJsonArray(...)` calls `JSON.parse(raw)` with no `try`/`catch`, so a corrupted file throws an uncaught exception rather than failing gracefully. The file's own comment already discloses this: "no atomic-write or file-locking handling (documented limitation, Development Sprint 010 Plan Section 12)."

**K11 – Mobile app is not distributable for real users yet.** Confirmed: no `eas.json` exists in `apps/mobile`; `apps/mobile/app.json` uses placeholder values (`"name": "mobile"`, `"slug": "mobile"`) with no configured bundle identifier, package name, or signing credentials appropriate for a real build. The app can currently only be run via `expo start` in a development client or simulator — there is no path for a real test user to install it.

**K12 – Legal/privacy review cannot be compressed into sprint time.** Not a code finding: an external legal/privacy review (GDPR data-processing basis, TOMs, AVV/DPA, works-council guidance per `Product_Readiness_Roadmap.md`'s existing "Before Pilot Customers"/"Before First Paying Customers" milestones) proceeds on **elapsed calendar time**, not implementation effort — it cannot be scheduled as if it were another sprint of engineering work, and its own duration is a primary driver of the difference between "technical pilot readiness" and "first paying customer" in Section 4 of `Core_Roadmap_v2_Commercial_Readiness.md`.

## 5. Severity Classification

**Critical** (block any real product usage, must resolve before technical pilot readiness):

- K3 — TimeEntry stop lifecycle
- K1 — demo pipeline as runtime path
- K4 — missing real authentication
- K5 — missing backend/tenant isolation
- K6 — missing sync
- K7 — async port migration

**High** (block a credible technical pilot or safe ongoing development, but do not make the existing architecture wrong):

- K2 — NFC port wiring (real hardware capture is not actually driving the real pipeline path)
- DT-016 physical NFC validation (previously disclosed, `Development_Sprint_011_Closure.md` onward; still outstanding)
- K8 — no CI
- K9 — tests excluded from typecheck
- K11 — mobile distribution missing
- K10 — JsonFileStore safety (relevant only if local durable persistence remains part of the near-term path; see Section 6)

**Medium** (real, but not on the critical path to a first pilot or first sale; sequencing risk if pulled forward too early):

- Policy engine overengineering risk — no generic policy engine exists yet; none should be built before simple admin rules are proven necessary.
- Large admin dashboard built too early — a minimal overview/correction/export surface is sufficient before pilot; a full dashboard is not.
- Website/design-system built too early — a landing page is sufficient before sale; a full design system is not.
- Governance overhead risk — the Development Sprint Plan/Closure/EP-008-sync template that served Sprints 012–019 well is heavier than the next phase's 4-hours/day capacity can sustain at the same cadence (Section 8).

## 6. Technical Lead Assessment

- The prior roadmap direction (`Product_Readiness_Roadmap.md`, 2026-07-07) was directionally useful — it correctly named the backend technology decision, CI, and Organization Management as near-term priorities — but did not anticipate how much runtime-composition, authentication, and async-migration work sits between "Organization Management is code/test-complete" and "a real user can use the product," and it did not carry an explicit time estimate that this triage can point to and correct. `Core_Roadmap_v2_Commercial_Readiness.md` corrects this by naming that work explicitly (Blocks B/C/D) and by attaching a realistic, calendar-based timeline.
- Start/Stop (K3, F-01's resolution) remains the immediate next core product priority — it is the single missing piece of domain logic blocking any real time-tracking use, and every other Block in the new roadmap assumes it exists.
- Backend, authentication, async port migration, and runtime composition (removing the demo pipeline as the product path) must move much earlier in the sequence than the prior roadmap implied, because K1/K2/K4/K5/K6/K7 are all interconnected: none of them can be meaningfully finished in isolation from the others, and K7 in particular is cheaper to resolve before backend work begins than after.
- UI/UX and the public website remain important but must follow the product/runtime foundations (Block I in the new roadmap is explicitly sequenced last, in parallel with, not ahead of, Blocks A–D).
- Governance must remain traceable — the Decision Log and Project Status must stay current — but must not consume a disproportionate share of the available 4-hours/day capacity during this phase; Section 8 records a specific, temporary adjustment to the sprint-closure template for this reason.

## 7. Disposition

| Finding | Disposition | Rationale |
|---|---|---|
| K1 — demo pipeline as runtime | **Accept** | Confirmed by direct inspection; addressed by Block C (DT-046/DT-047). |
| K2 — NFC port bypassed | **Accept** | Confirmed by direct inspection; addressed by Block D (DT-055). |
| K3 — no TimeEntry stop lifecycle | **Accept** | Confirmed by direct inspection; addressed first, Block A (DT-029–DT-033), per Section 6. |
| K4 — no real authentication | **Accept** | Confirmed by direct inspection; addressed by Block C (DT-049–DT-052). |
| K5 — no backend/server | **Accept** | Confirmed by absence; addressed by Block B (DT-036–DT-044). |
| K6 — no real sync | **Accept** | Confirmed by absence; addressed by Block E (DT-060–DT-062), gated on Block B. |
| K7 — async port migration risk | **Accept** | Confirmed by direct inspection (zero `Promise`/`async` in `ports/`); addressed by Block B (DT-038/DT-039), sequenced before backend persistence implementation for exactly the reason the finding names. |
| K8 — no CI | **Accept** | Confirmed by absence; addressed first, Block A (DT-034), lowest-cost highest-value item available. |
| K9 — tests excluded from typecheck | **Accept** | Confirmed by direct inspection; addressed alongside K8, Block A (DT-035). |
| K10 — JsonFileStore safety | **Accept with Adjustment** | Confirmed by direct inspection. Adjustment: this is only worth hardening if local file-based persistence remains part of the near-term path once the backend decision (Block B) is made; if the backend decision retires local file persistence as the durable source of truth, this finding is superseded rather than fixed. Not scheduled into a specific Block in Section 5 of `Core_Roadmap_v2_Commercial_Readiness.md` for this reason; re-evaluate after DT-036 (Backend Technology ADR). |
| K11 — mobile distribution missing | **Accept** | Confirmed by absence (`eas.json` missing, placeholder `app.json`); addressed by Block G (DT-075–DT-078), sequenced after the runtime/auth/NFC foundations it depends on. |
| K12 — legal/privacy elapsed time | **Accept** | Not a code finding; this is precisely why Block H is scheduled by calendar weeks, not sprint count, and overlaps rather than strictly follows Blocks F/G. |
| DT-016 physical NFC validation | **Accept** (already disclosed) | Not a new finding — carried forward from `Development_Sprint_011_Closure.md` onward; re-confirmed still outstanding; addressed by Block D (DT-058/DT-059). |
| Policy engine / admin dashboard / website / design-system "too early" observations | **Accept** | These are sequencing findings, not defects; addressed by placing this work in Block I, explicitly after, not instead of, Blocks A–D. |
| Governance overhead risk | **Accept with Adjustment** | Adjustment: apply the compressed sprint-closure template (Section 8) starting with the next implementation sprint, while keeping Decision Log/Project Status current — not a full suspension of governance. |

No finding is Deferred or Rejected. Every Critical and High finding is addressed by a specific Block in `Core_Roadmap_v2_Commercial_Readiness.md`, cited above.

## 8. Impact on Roadmap

- The road to commercial readiness moves from an undocumented, informal "8–12 workday" estimate to a realistic, calendar-based baseline: **6–9 weeks to technical pilot readiness, 3–5 months to sales readiness, 4–7 months to a first paying customer**, all at approximately 4 hours/day (`Core_Roadmap_v2_Commercial_Readiness.md` Section 4).
- The next governance artifact is **Core Roadmap v2** (`Core_Roadmap_v2_Commercial_Readiness.md`, created alongside this triage), which supersedes `Product_Readiness_Roadmap.md`'s milestone sequencing for the specific items this triage's findings touch (Section 5 of that roadmap remains the authoritative per-category detail and is not rewritten; `Product_Readiness_Roadmap.md` itself receives only a targeted addendum, Section 9 below).
- The next implementation sprint should not begin until Core Roadmap v2 is recorded and reviewed by the Technical Lead / Human Architect. This triage and the roadmap it accompanies are governance artifacts only; per the assigning task's own Stop Condition, no Development Sprint 020 implementation begins as part of this task.

## 9. Product Readiness Roadmap Cross-Reference

`ADO/05_Evidence/Product_Readiness_Roadmap.md` receives a targeted addendum (not a rewrite) reprioritizing its "Now" and "Before Pilot Customers" sections to reflect K1–K12 — see that file's own new "Addendum (2026-07-10)" section for the specific reprioritized items, cross-referenced back to this triage and to `Core_Roadmap_v2_Commercial_Readiness.md`.

## 10. Role Handover

Implemented scope: this triage document only. No product code was written, read for the purpose of modification, or changed. Source files were read strictly to independently re-verify the external review's own findings against current repository reality before accepting them (Section 4).

Changed artifacts: `ADO/05_Evidence/External_CTO_Review_Triage_2026-07-10.md` (new, this file). Cross-referenced by `ADO/05_Evidence/Core_Roadmap_v2_Commercial_Readiness.md`, `ADO/00_Core/Decision_Log.md`, `ADO/00_Core/Project_Status.md`, `ADO/05_Evidence/Product_Readiness_Roadmap.md` (Section 9 above; see those files' own change records).

Tests performed: `npm run test --workspace=@taptime/core` (221/221 passing, re-confirmed unaffected) and `npm run test --workspace=apps/mobile` (10/10 passing, re-confirmed unaffected) — run to confirm the repository's own baseline was accurately described in Section 2, not to validate any new code, since none was written.

Known deviations: none from the assigned task's own scope. One disclosed observation (Section 1): no repository artifact contains a written "8–12 workday" estimate for this triage to literally supersede; this is stated plainly rather than silently assumed to exist, consistent with this engagement's "reasoning is recorded, not hidden" discipline (EP-008 Ch01 §10.9 and successors).

Unresolved questions / open findings carried forward: DT-016 physical-device validation remains outstanding (Section 5/7); the Membership-granting bootstrap question, tag reassignment/history semantics, tag payload collision semantics, and the missing-target-Customer result-vocabulary limitation (all pre-existing, disclosed at DT-025/DT-026's own closures) remain unresolved and unaffected by this triage; FB-002's/TS-002's own header "Status" fields remain "Draft"; the software license decision (`Product_Readiness_Roadmap.md`, "Now," Business/Legal/Go-To-Market Track) remains open; K10's disposition (Section 7) is explicitly conditional on the Block B backend decision, not yet resolved.

Evidence produced: this triage document and `Core_Roadmap_v2_Commercial_Readiness.md`.

Next responsible role: Technical Lead / Human Architect to review this triage and the accompanying Core Roadmap v2, and to confirm the Block A starting point (`Development Sprint 020 – External CTO Review Triage and Core Roadmap v2 Rebaseline`, governance-only if not already completed by this task, followed by `Development Sprint 021 – F-01 / TimeEntry Lifecycle Decision + Plan` as the first implementation sprint, not created by this task).

## 11. Stop Condition

Per task instruction: stop after creating/updating the roadmap/evidence/status files this task and `Core_Roadmap_v2_Commercial_Readiness.md` together produce. Do not commit. Do not push. Do not start Development Sprint 020 implementation. Wait for Technical Lead review.
