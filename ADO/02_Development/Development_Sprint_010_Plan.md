# Development Sprint 010 Plan – Local Persistence Foundation

Status: Planned
Role: Research / Implementation Support acting on behalf of Technical Lead (per AGR-001)
Epic: EP-007 – Product Architecture Foundation
Owner: Technical Lead
Approval Authority: Human Architect
Branch: `main`
Created Date: 2026-07-07
Related Development Task: **DT-015 (new — justified in Section 10)**; extends DT-006/DT-007's existing repository/queue ports, does not replace them
Related Artifacts: `EP-007_Development_Tasks.md`, `Development_Sprint_001_Plan.md`–`Development_Sprint_009_Plan.md`, `MVP_Readiness_Assessment.md`, TTAP-001, TS-001, FB-001, ADR-0004, ADR-0006, ADR-0007

---

## 1. Executive Summary

Repository evidence does **not** support Firestore or any cloud/backend persistence technology as Sprint 010 — the backend technology decision ADR-0007 defers is still not made (verified again: no such row exists in `Decision_Log.md`), so building toward it now would repeat the mistake every prior sprint since Sprint 005 has deliberately avoided. A viewing/reporting sprint remains ruled out for the same reason established in Sprint 009's planning: no TTAP-001/FB-001/TS-001 component exists for it.

Repository evidence instead surfaces a genuine, previously-uncorrected gap that this role's own prior `MVP_Readiness_Assessment.md` had conflated with the backend decision: **local, on-device persistence is architecturally distinct from cloud/backend persistence, and only the cloud half is actually deferred.** ADR-0007's Decision explicitly lists "Local offline-capable persistence" as part of the already-Approved React Native/Expo mobile baseline, separate from "Backend services for authentication, persistence and synchronization." ADR-0004 goes further and states a hard requirement: "The architecture must include a local event queue or equivalent offline-capable mechanism **before production release**." Today, `InMemoryOfflineQueue`, `InMemoryWorkEventRepository`, and `InMemoryTimeEntryRepository` are pure in-process JavaScript state — every queued WorkEvent, every TimeEntry, and the offline queue itself are lost the instant the process exits, on a CLI run or (if wired into the mobile app in a future sprint) on an app restart. This is the single largest gap between "demo-ready" and "production-ready" that this role's mandatory review can identify, and it requires **no** backend technology decision to close: `OfflineQueue`, `WorkEventRepository`, and `TimeEntryRepository` are already-approved, already-swappable ports (ADR-0006: "Firestore, or any other persistence technology, is infrastructure"), and DT-006's own Implementation Notes already state its in-memory work "satisfies them only for the in-memory slice, not the full repository surface" — anticipating exactly this follow-up.

Sprint 010 should implement durable, file-based (Node `fs`-backed, zero new dependencies) adapters for all three ports, proving the offline queue and repositories survive process restart — the local half of ADR-0004's production-readiness requirement — while leaving the cloud/backend technology decision, and the separate (smaller) choice of a mobile-native on-device storage library (e.g. `expo-sqlite` vs. `AsyncStorage`), both untouched and explicitly deferred to later sprints.

## 2. Repository Evidence

- `ADR-0004-offline-first-core-events.md` Implementation Rule: "The architecture must include a local event queue or equivalent offline-capable mechanism **before production release**." This is the only ADR anywhere in the repository that names an explicit production-readiness gate — directly relevant to this task's own upgraded framing ("closest to the first production-ready employee workflow").
- `ADR-0007-technology-platform-baseline.md` Decision: "Mobile Application -> React Native / Expo baseline -> Native NFC capability... -> **Local offline-capable persistence** -> Explicit synchronization boundary -> Backend services for authentication, persistence and synchronization." Local persistence is listed as part of the mobile platform baseline (already Approved), *separate* from the backend baseline's "Persistence -> cloud-hosted operational persistence" (still deferred). Every prior sprint's "no backend technology decision" caution has correctly applied to the *cloud* half; this is the first review to note that the *local* half was never actually blocked.
- `ADR-0006-domain-first-architecture.md`: "Firestore, or any other persistence technology, is infrastructure" — already anticipates that any concrete storage technology (local or cloud) is a swappable adapter behind an existing port, not a new architectural decision each time one is added.
- `ADO/02_Development/EP-007_Development_Tasks.md` DT-006's own Implementation Notes (Development Sprint 002): "Only a minimal in-memory slice is in scope for Sprint 002... this sprint satisfies them [DT-006's Acceptance Criteria] only for the in-memory slice, not the full repository surface." This is a direct, existing acknowledgment that further persistence work was always anticipated as a follow-up, not a new invention.
- Direct inspection of `packages/core/src/ports/OfflineQueue.ts`, `WorkEventRepository.ts`, `TimeEntryRepository.ts` confirms all three ports are small, storage-technology-agnostic interfaces (`enqueue`/`findPending`/`updateSyncState`; `save`; `save`/`findActiveByTarget`) with no in-memory-specific detail leaking into their signatures — they are already correctly shaped to be implemented by a durable adapter with no port changes required.
- Direct inspection of `InMemoryOfflineQueue.ts`, `InMemoryWorkEventRepository.ts`, `InMemoryTimeEntryRepository.ts` confirms each is a thin wrapper over a JS `Map`/array with zero serialization, zero file/database I/O — verified by inspecting `packages/core/package.json`, which has no dependency of any kind beyond `@types/node`, `tsx`, `typescript`, `vitest` (all dev-only). Node's built-in `fs`/`fs/promises` modules are already available via `@types/node` with no new dependency required to implement a durable, file-based adapter.
- `MVP_Readiness_Assessment.md` Section 9: "MVP-B06 | No durable persistence — all data is lost on process exit | HIGH | Sprint 008 | Development Agent, backend technology decision by Human Architect." This assessment conflated local and cloud persistence under one blocker gated on the backend decision — repository evidence (Sections above) shows the local half of this finding does not actually require that decision, correcting this role's own prior framing.
- `packages/core/src/cli/runScan.ts`'s `buildScanDemoPipeline` already demonstrates the established pattern for making a composition-root dependency swappable without inventing new architecture: Sprint 008 added an optional `caller: CallerContext` parameter, defaulting to existing behavior when omitted. The same pattern (an optional, defaulted parameter or options object) is the natural extension point for swapping in durable repository/queue implementations.
- All 127 `packages/core` tests currently pass and `apps/mobile`/`packages/core` both typecheck cleanly (verified this session) — DT-015 can be implemented as new adapter classes with dedicated tests, without touching any of this passing baseline's behavior.

## 3. Why Sprint 010 Is the Correct Next Sprint

**Repository evidence rules out the two most obvious alternatives for the same reasons established in Sprints 005–009**: cloud/backend persistence and real managed authentication both remain gated on an undecided Human Architect technology choice, and a viewing/reporting sprint remains architecturally unspecified. What repository evidence newly surfaces, on this review, is that "Persistence" is not a single, monolithic, backend-gated blocker — ADR-0007 itself splits it into a local half (already Approved as part of the mobile baseline) and a cloud half (still deferred). This role's own prior `MVP_Readiness_Assessment.md` did not draw this distinction and gated MVP-B06 entirely on the backend decision; on closer reading of ADR-0004 and ADR-0007 together, that framing undersells what is actually buildable today.

Closing the local-persistence gap is also the most direct way to satisfy this task's own upgraded framing — "moves TapTim.e closest to the first **production-ready** employee workflow," not merely "MVP-demo-ready" — since ADR-0004 is the one ADR in this repository that names an explicit pre-production requirement ("must include a local event queue... before production release") that remains unimplemented today. No other unimplemented, unblocked piece of architecture makes as direct a claim on production-readiness specifically. This does not contradict the general MVP roadmap shape; it identifies the correctly-scoped, unblocked half of a blocker this role had previously described as fully blocked.

## 4. Business Objective

Ensure that a WorkEvent, TimeEntry, or pending synchronization record an employee's scan produces is never silently lost to a crashed process, a closed CLI session, or (in a future mobile-wiring follow-up) an app restart — directly satisfying ADR-0004's offline-first promise ("the user should never need to think: do I have internet before I can track time?") extended to its natural corollary: the user should also never need to wonder whether closing the app lost their tracked time.

## 5. Technical Objective

Implement durable, file-based (Node `fs`-backed, dependency-free) adapters for the existing `OfflineQueue`, `WorkEventRepository`, and `TimeEntryRepository` ports, and extend `buildScanDemoPipeline`'s composition root with an optional, defaulted parameter (or options object) to select between the existing in-memory adapters (default, preserving all current behavior) and the new durable ones — following exactly the additive-parameter pattern Sprint 008 already established for `CallerContext`.

## 6. Scope

- A new durable adapter for `OfflineQueue` (e.g. `FileOfflineQueue`), persisting `QueuedWorkEventRecord`s to a JSON file on disk, implementing `enqueue`/`findPending`/`updateSyncState` with the exact same behavior/semantics as `InMemoryOfflineQueue` (including its existing `already_queued` duplicate handling), but surviving process restart.
- A new durable adapter for `WorkEventRepository` (e.g. `FileWorkEventRepository`) and `TimeEntryRepository` (e.g. `FileTimeEntryRepository`), each persisting to their own JSON file, implementing exactly the same port methods (`save`, plus `findActiveByTarget` for `TimeEntryRepository`) with identical semantics to their in-memory counterparts.
- A small, shared, minimal file-storage helper (e.g. reading/writing a JSON array to a given file path, creating the file if absent) reused by all three adapters — following "Extend Before Create" by writing one small internal utility once, not three ad hoc copies.
- An extension to `buildScanDemoPipeline`'s composition (in `runScan.ts`) so it can accept an optional configuration selecting durable file-based storage (with a configurable directory/file path) instead of its current, always-in-memory defaults — preserving the existing CLI's default in-memory behavior exactly when no durable option is supplied.
- A CLI-level way to exercise the durable path for manual verification (e.g. an environment variable or additional CLI argument selecting a storage directory), sufficient to demonstrate that a queued record, run twice with the same storage directory across two separate process invocations, is still present on the second run.
- Unit tests for each new adapter, covering the same behavioral guarantees their in-memory counterparts already test (enqueue/already_queued, findPending, updateSyncState, save, findActiveByTarget) plus a dedicated test proving data survives being written by one adapter instance and read by a fresh one (simulating a process restart) against a temporary directory.

## 7. Out of Scope

- **Any cloud/backend persistence technology (Firestore or otherwise)** — still gated on an undecided Human Architect technology decision; this sprint implements only local, on-device-equivalent (here: local-filesystem, standing in for the eventual mobile device) durable storage.
- **A specific mobile-native storage library (`expo-sqlite`, `AsyncStorage`, or similar) inside `apps/mobile`** — this sprint's durable adapters live in `packages/core` (Node-testable, CLI-demonstrable) as the proof that the ports support durable storage at all; wiring an actual React-Native-native storage backend into `apps/mobile` (replacing the composition root's in-memory defaults there) is a natural, smaller follow-up task, analogous to the DT-013→DT-014 split, and is explicitly not attempted this sprint.
- **Real synchronization backend / real managed authentication provider** — both remain unchanged and unaffected; `FakeSynchronizationGateway` and `FakeAuthenticationGateway` are untouched.
- **Retry scheduling, backoff policies, or any new business/application logic** — the durable adapters must reproduce their in-memory counterparts' exact existing behavior/semantics, not add new capability.
- **Any change to `AssignmentResolver`, `AssignmentValidator`, `BusinessEngine`, `WorkEventFactory`, `SynchronizationService`, `SessionService`, or any of the five DT-009 result/outcome types** — none consume storage directly except through the existing repository/queue ports, which are unchanged.
- **Concurrency/locking, migrations, or schema versioning for the file storage format** — a single-process, single-writer scenario (matching the CLI demo's current usage) is sufficient for this sprint; anything beyond that is a follow-up concern once a real multi-process/mobile usage pattern is defined.
- **Any change to FB-001, TS-001, TTAP-001, any ADR, Product Vision, Product Principles, Domain Model, Role Model, or EP-008.**

## 8. Existing Components (Reused, Not Recreated)

| Component | File | Reused As |
|---|---|---|
| `OfflineQueue` port | `packages/core/src/ports/OfflineQueue.ts` | Implemented by the new durable adapter unmodified. |
| `WorkEventRepository` port | `packages/core/src/ports/WorkEventRepository.ts` | Implemented by the new durable adapter unmodified. |
| `TimeEntryRepository` port | `packages/core/src/ports/TimeEntryRepository.ts` | Implemented by the new durable adapter unmodified. |
| `InMemoryOfflineQueue`/`InMemoryWorkEventRepository`/`InMemoryTimeEntryRepository` | `packages/core/src/infrastructure/repositories/` | Remain the default; their exact behavioral contract (semantics of `enqueue`, `findPending`, `updateSyncState`, `save`, `findActiveByTarget`) is the specification the new durable adapters must match. |
| `buildScanDemoPipeline` composition root (DT-011, extended DT-014) | `packages/core/src/cli/runScan.ts` | Extended again (not rewritten) with an optional storage-selection parameter, following the same additive pattern as the `CallerContext` override. |
| `QueuedWorkEventRecord`, `WorkEvent`, `TimeEntry` domain types | `packages/core/src/domain/` | Serialized/deserialized as-is by the new adapters; no shape changes. |

## 9. Components to Implement

| Component | Type | Location (proposed) |
|---|---|---|
| Shared JSON file-storage helper | Internal utility | `packages/core/src/infrastructure/persistence/` (new subfolder, or `infrastructure/adapters/`, per Development Agent judgment — see Section 14 step 1) |
| `FileOfflineQueue` | Infrastructure adapter | `packages/core/src/infrastructure/persistence/FileOfflineQueue.ts` |
| `FileWorkEventRepository` | Infrastructure adapter | `packages/core/src/infrastructure/persistence/FileWorkEventRepository.ts` |
| `FileTimeEntryRepository` | Infrastructure adapter | `packages/core/src/infrastructure/persistence/FileTimeEntryRepository.ts` |
| `buildScanDemoPipeline` storage-selection extension | Composition root extension | `packages/core/src/cli/runScan.ts` (extended) |

## 10. Development Task Mapping

- **DT-015 (new) — Local Persistence Foundation.** Repository evidence (Section 2) shows this is not a new architectural decision, but the direct, previously-anticipated follow-up to DT-006's own "in-memory slice only" acknowledgment and DT-007's Known Remaining Risk discussion. Per the standing instruction to create new DT identifiers only when no existing DT covers the work, and per DTP-001's "one primary responsibility per DT": DT-015 is proposed here for Human Architect/Technical Lead approval, not yet implemented. It extends, but does not replace or duplicate, DT-006 (Repository Layer) and DT-007 (Offline Queue) — those tasks' Objectives/Acceptance Criteria remain satisfied for the in-memory case; DT-015 adds a durable case behind the same ports.
  - Objective: Implement durable, file-based adapters for the existing `OfflineQueue`, `WorkEventRepository`, and `TimeEntryRepository` ports, proving queued WorkEvents, TimeEntries, and offline-queue state survive process restart, without introducing any cloud/backend persistence technology or new business logic.
  - Acceptance Criteria: `FileOfflineQueue`, `FileWorkEventRepository`, and `FileTimeEntryRepository` exist, implement their respective ports exactly, and are tested in isolation, including a dedicated test proving data survives a simulated process restart (a fresh adapter instance reading what a previous instance wrote); `buildScanDemoPipeline` can be configured to use the durable adapters instead of its in-memory defaults, with the in-memory defaults unchanged when no durable option is supplied; no new dependency is added to `packages/core/package.json`; no business/application logic (`AssignmentResolver`, `AssignmentValidator`, `BusinessEngine`, `WorkEventFactory`, `SynchronizationService`, `SessionService`) is modified.

## 11. Testing Strategy

- Unit tests for each new adapter (`FileOfflineQueue`, `FileWorkEventRepository`, `FileTimeEntryRepository`), each covering the exact same behavioral guarantees as its in-memory counterpart's existing test file (e.g. `FileOfflineQueue.test.ts` should cover `enqueue`/`already_queued`/`findPending`/`updateSyncState` exactly as `InMemoryOfflineQueue.test.ts` already does), using a temporary directory (created and cleaned up per test) rather than any shared or committed file path.
- A dedicated "survives restart" test per adapter: write data via one adapter instance pointed at a temp directory, construct a **second, fresh instance** pointed at the same directory, and confirm it reads back exactly what was written — this is the core proof this sprint exists to deliver.
- A composition-level test confirming `buildScanDemoPipeline`'s extended configuration correctly wires the durable adapters when requested, and that omitting the option preserves today's in-memory-only behavior unchanged (mirroring `runScan.callerOverride.test.ts`'s proof style from Sprint 008).
- No new tests are needed for `AssignmentResolver`, `AssignmentValidator`, `BusinessEngine`, `WorkEventFactory`, `SynchronizationService`, `SessionService`, or any DT-009 classification function — none are modified.
- `npm run typecheck` and `npm run test` must pass across the monorepo; all 127 pre-existing `packages/core` tests must remain green.

## 12. Risks

| Risk | Mitigation |
|---|---|
| Treating this sprint as license to also pick a cloud/backend technology "since we're doing persistence now" | Out of Scope (Section 7) explicitly forbids this; the backend technology decision remains a Human Architect decision not made by this sprint. |
| Silently changing `InMemoryOfflineQueue`/`InMemoryWorkEventRepository`/`InMemoryTimeEntryRepository`'s existing behavior while building the new adapters | Scope (Section 6) explicitly requires the new adapters to match existing semantics exactly; the in-memory classes themselves must remain untouched, verified by diff. |
| File I/O introducing partial-write/corruption risk on process crash mid-write | For this sprint's scope (proving durability across a clean process restart, not crash-resilience), a straightforward "read whole file, modify, write whole file" approach is sufficient; the Development Agent should note file-locking/atomic-write concerns as a documented limitation for a future sprint rather than over-engineering this one. |
| Multiple concurrent processes/instances writing to the same file causing a race condition | Explicitly out of scope (Section 7) — the CLI demo's existing single-process usage pattern does not exercise this; document as a known limitation, not a defect to fix now. |
| Scope creep into building the actual `expo-sqlite`/`AsyncStorage` mobile-native adapter | Out of Scope (Section 7) explicitly defers this to a smaller, separate follow-up task; this sprint's durable adapters live in `packages/core` only. |
| Adding a new npm dependency for JSON/file handling when Node's built-in `fs` module already suffices | Scope (Section 6)/Acceptance Criteria (Section 10) explicitly require no new dependency; Node's built-ins are sufficient for this sprint's needs. |

## 13. Definition of Done

- `FileOfflineQueue`, `FileWorkEventRepository`, and `FileTimeEntryRepository` exist in `packages/core`, each implementing their respective port exactly, with no port interface changes.
- Each new adapter is tested in isolation, including a dedicated test proving data survives being read by a fresh adapter instance pointed at the same storage location (simulating a process restart).
- `buildScanDemoPipeline` can be configured to use the durable adapters; its default (no configuration supplied) behavior is unchanged, proven by a dedicated test.
- No new dependency is added to `packages/core/package.json`.
- No business/application logic (`AssignmentResolver`, `AssignmentValidator`, `BusinessEngine`, `WorkEventFactory`, `SynchronizationService`, `SessionService`, any DT-009 classification function) is modified — verified by diff.
- `InMemoryOfflineQueue`, `InMemoryWorkEventRepository`, `InMemoryTimeEntryRepository` remain unchanged and remain the default.
- `npm run typecheck` and `npm run test` pass across the monorepo (all 127 pre-existing tests, plus new tests added this sprint, all green); `apps/mobile`'s own typecheck passes (unaffected, since no `apps/mobile` file changes are in scope).
- `EP-007_Development_Tasks.md` gets a new `## DT-015 – Local Persistence Foundation` section (Objective/Acceptance Criteria as in Section 10) plus a "Development Sprint 010 Implementation Notes" subsection, explicitly noting that DT-006/DT-007's Objectives now have both an in-memory and a durable local implementation, and that mobile-native wiring and cloud/backend persistence both remain explicitly deferred, proposed follow-up work.
- No change to FB-001, TS-001, TTAP-001, any ADR, Product Vision, Product Principles, Domain Model, Role Model, or EP-008.
- Review Agent verification and Human Architect approval are recorded before DT-015 is marked Completed (DTP-001: "Implementation alone never completes a Development Task").

## 14. Recommended Implementation Order

1. **Spike first:** write the shared JSON file-storage helper and prove it can write and re-read a small array of plain objects from a temp directory, before building any of the three adapters on top of it — establishing the lowest-risk foundation first, consistent with the "spike-first" precedent set in Sprint 006.
2. Implement `FileOfflineQueue`, matching `InMemoryOfflineQueue`'s exact behavior; write its full test suite, including the restart-survival test.
3. Implement `FileWorkEventRepository` and `FileTimeEntryRepository`, matching their in-memory counterparts' exact behavior; write their test suites, including restart-survival tests.
4. Extend `buildScanDemoPipeline`'s composition to accept an optional durable-storage configuration, defaulting to today's in-memory behavior when omitted.
5. Add a composition-level test proving both the default (in-memory) and durable-storage paths behave correctly, and that a queued record written in one CLI invocation is still present when a second invocation reads the same storage location.
6. Run `npm run typecheck` and `npm run test` for the whole monorepo.
7. Add the new `DT-015` section to `EP-007_Development_Tasks.md` with Sprint 010 implementation notes, explicitly flagging mobile-native wiring and cloud/backend persistence as deferred follow-ups.
8. Produce implementation evidence and role handover; request Review Agent verification.

---

## 15. Development Agent Prompt

The following prompt is written to be given directly to Claude Code (Development Agent) to execute Development Sprint 010. It is self-contained and does not require this planning document to be re-explained.

```text
You are the Development Agent for TapTim.e, implementing Development Sprint 010 ("Local Persistence Foundation," DT-015) on branch `main`.

CONTEXT (verify before writing code):
- Read `ADO/02_Development/Development_Sprint_010_Plan.md` in full — it is the authoritative scope for this task, including why this sprint builds LOCAL file-based persistence only, not a cloud/backend technology (Sections 3 and 7).
- Read `ADO/01_Architecture/ADR/ADR-0004-offline-first-core-events.md` — its Implementation Rule ("must include a local event queue... before production release") is the primary justification for this sprint.
- Read `packages/core/src/ports/OfflineQueue.ts`, `WorkEventRepository.ts`, `TimeEntryRepository.ts` — these ports are unchanged; your new adapters must implement them exactly.
- Read `packages/core/src/infrastructure/repositories/InMemoryOfflineQueue.ts`, `InMemoryWorkEventRepository.ts`, `InMemoryTimeEntryRepository.ts` — these define the exact behavioral contract your new durable adapters must match. Do not modify any of them.
- Read `packages/core/src/cli/runScan.ts` (`buildScanDemoPipeline`) and its existing `caller: CallerContext` optional-parameter extension (Development Sprint 008) — use the identical additive pattern for the new storage-selection option.
- Do not modify DT-001–DT-014 business/application logic, FB-001, TS-001, TTAP-001, any ADR, Product Vision, Product Principles, Domain Model, Role Model, or EP-008.

IMPLEMENTATION SCOPE (do exactly this, nothing more, in this order):
1. Spike first: write a small, shared JSON file-storage helper (read a JSON array from a file, creating it if absent; write a JSON array to a file) and prove it round-trips correctly against a temp directory before building anything on top of it.
2. Implement `FileOfflineQueue` implementing the `OfflineQueue` port, matching `InMemoryOfflineQueue`'s exact behavior (including its `already_queued` duplicate handling), backed by the file-storage helper.
3. Implement `FileWorkEventRepository` and `FileTimeEntryRepository` implementing their respective ports, matching their in-memory counterparts' exact behavior.
4. Extend `buildScanDemoPipeline`'s composition (in `runScan.ts`) with an optional parameter/options object selecting durable file-based storage at a given directory, defaulting to today's in-memory adapters when omitted. Do not break the existing CLI's default behavior.
5. Do not add any new npm dependency — Node's built-in `fs`/`fs/promises` modules are sufficient.
6. Do not build a mobile-native storage adapter (`expo-sqlite`, `AsyncStorage`, etc.) inside `apps/mobile` — that is explicitly out of scope for this sprint.

ARCHITECTURE BOUNDARIES (do not violate):
- Do not modify `OfflineQueue.ts`, `WorkEventRepository.ts`, `TimeEntryRepository.ts` (the ports), or `InMemoryOfflineQueue.ts`, `InMemoryWorkEventRepository.ts`, `InMemoryTimeEntryRepository.ts` (the existing in-memory adapters).
- Do not modify `AssignmentResolver`, `AssignmentValidator`, `BusinessEngine`, `WorkEventFactory`, `SynchronizationService`, `SessionService`, or any DT-009 classification function.
- Do not introduce Firestore, any cloud database client, or any real managed authentication provider.
- Do not touch FB-001, TS-001, TTAP-001, any ADR, Product Vision, Product Principles, Domain Model, Role Model, or EP-008.
- Do not add retry scheduling, concurrency/locking, or schema migration handling — a single-process, single-writer scenario is sufficient this sprint; document anything beyond that as a known limitation rather than building it.

TESTING REQUIREMENTS:
- Unit tests for each new adapter, covering the same behavioral guarantees as its in-memory counterpart's existing tests, using a temp directory created and cleaned up per test.
- A dedicated "survives restart" test per adapter: write via one instance, read via a second, fresh instance pointed at the same location.
- A composition-level test proving `buildScanDemoPipeline`'s extended configuration works correctly for both the default (in-memory) and durable-storage paths.
- Run `npm run typecheck` and `npm run test` at the repository root; both must pass (existing 127 tests remain green) before you consider the task done.

EXPECTED DELIVERABLES:
- The new file-storage helper, three new adapters, the `runScan.ts` extension, and their tests — committed with a clear commit message referencing DT-015 and Development Sprint 010.
- A new `## DT-015 – Local Persistence Foundation` section added to `ADO/02_Development/EP-007_Development_Tasks.md` (Objective/Acceptance Criteria as defined in the plan's Section 10), plus a "Development Sprint 010 Implementation Notes" subsection, explicitly noting that cloud/backend persistence and mobile-native storage wiring both remain deferred, proposed follow-up work.
- A short implementation summary (changed files, test results, and any limitations such as no concurrency handling) suitable for Review Agent evaluation.

STOP CONDITION:
Stop after completing the Implementation Scope, tests, and the EP-007_Development_Tasks.md update. Do not begin any further sprint (no cloud/backend persistence, no mobile-native storage wiring, no viewing/reporting, no real NFC). Do not mark DT-015 "Completed" yourself — that status requires Review Agent verification and Human Architect approval. Wait for review.
```

---

## 16. Role Handover

Implemented scope in this task: Development Sprint 010 planning only — this document and the embedded Development Agent Prompt. No source code was written or modified. No architecture, ADR, TTAP-001, FB-001, TS-001, Product Vision, Product Principles, Domain Model, Role Model, or EP-008 content was changed.

Changed artifacts: `ADO/02_Development/Development_Sprint_010_Plan.md` (new, this file). No other file was modified.

Related ADO artifacts consulted: Product Vision, Product Principles, Decision Log, AVR-001, ADR-0004, ADR-0006, ADR-0007, TTAP-001, Domain Model, Role Model, System_Overview.md, FB-001, TS-001, Development Task Profile (DTP-001), `EP-007_Development_Tasks.md` (DT-006/DT-007 sections specifically, and DT-001–DT-014 for completeness), `Development_Sprint_001_Plan.md`–`Development_Sprint_009_Plan.md`, `Development_Sprint_009_Closure.md`, `MVP_Readiness_Assessment.md`, current `packages/core/src/ports/OfflineQueue.ts`/`WorkEventRepository.ts`/`TimeEntryRepository.ts`, current `packages/core/src/infrastructure/repositories/` (all three in-memory adapters), `packages/core/package.json`, `packages/core/src/cli/runScan.ts`, EP-008 Chapters 00–03 (read for context only, not modified per this task's explicit "Do not update EP-008" instruction).

Tests performed: none (planning-only task; no code changed). `packages/core`'s current test/typecheck state was verified this session (127 tests passing, typecheck clean for both `packages/core` and `apps/mobile`); not re-run after this document was written since no code changed.

Known deviations: none from the assigned task scope. One correction to this role's own prior framing is documented explicitly in Sections 1–3: `MVP_Readiness_Assessment.md`'s MVP-B06 finding gated "durable persistence" entirely on the undecided backend technology decision — on this review, ADR-0004 and ADR-0007 together show that *local* on-device persistence is architecturally distinct from the *cloud/backend* persistence technology, and only the latter is actually deferred. Sprint 010 is recommended to close the local half now, using only already-approved architecture and zero new dependencies, while continuing to defer the cloud/backend decision exactly as every prior sprint has.

Open findings carried forward (not resolved by this task): (1) Development Sprint 002 (DT-004/005/006) and Development Sprint 004 (DT-008) remain without recorded Review Agent verification or Human Architect approval; (2) Development Sprint 005's EP-008 implementation narrative remains unsynchronized; (3) Finding F-01 (duplicate-scan/toggle mechanism) remains open, still a Human Architect product decision; (4) `QueuedWorkEventRecord.decision: null` still has no integration-level test coverage; (5) `DT-010` (Tests) has substantial existing coverage from Sprint 005 but has never received an explicit "Status:" line in `EP-007_Development_Tasks.md`, unlike every other Development Task — a minor documentation-consistency gap noted here, not corrected, since this task is planning-only; (6) the cloud/backend persistence technology decision and the real managed authentication provider decision both remain unmade, and will continue to gate any sprint attempting real backend integration; (7) a mobile-native local storage adapter (wiring `FileOfflineQueue`-equivalent durability into `apps/mobile` itself, using `expo-sqlite`/`AsyncStorage` or similar) is a natural, smaller follow-up to this sprint, not attempted here; (8) a viewing/reporting capability remains a named product requirement with no approved architectural component to build against.

Evidence produced: this plan document, including the repository-evidence basis for rejecting cloud/backend persistence and viewing, and for recommending local durable persistence instead, plus the correction to this role's own prior MVP-B06 framing.

Next responsible role: Technical Lead / Human Architect review and approval of this Sprint 010 Plan. Per the assigned stop condition, implementation does not begin until that approval is given.

## 17. Stop Condition

Per task instruction: this task stops after producing the Development Sprint 010 Plan, the Development Agent Prompt and the Role Handover above. No code was implemented. No architecture, ADRs, TTAP-001, Product Vision, Product Principles, Domain Model, Role Model, or EP-008 were modified. Awaiting Technical Lead / Human Architect approval before implementation begins.
