# EP-008 Synchronization Update — Development Sprint 010 — Evidence Report

Role: Research / Implementation Support acting on behalf of Technical Lead (per AGR-001)
Date: 2026-07-07
Repository State Verified Against: `main` at commit `7bea186` ("feat(DT-015): implement JsonFileStore + durable file-based adapters; restructure runScan.ts/runScanCli.ts to fix Metro bundling regression (Development Sprint 010)")
Scope: Synchronize EP-008 Chapters 00–03 with Development Sprint 010's Local Persistence Foundation (DT-015). No code changes. No new chapters created. No review performed.

---

## 1. Objective (as assigned)

> Synchronize EP-008 with the completed Development Sprint 010. Document implemented repository reality only. At minimum synchronize: Local Persistence Foundation, repository adapter implementation, local persistence boundaries, persistence responsibilities, offline persistence flow, interaction with the Offline Queue, testing strategy, known limitations, developer guidance. Do not duplicate ADRs, TTAP, FB-001, TS-001. Do not redefine architecture.

Chapters 00–03 were reviewed against: `Development_Sprint_010_Plan.md`, DT-015's Implementation Notes in `EP-007_Development_Tasks.md`, direct inspection of every new/changed file (`packages/core/src/infrastructure/persistence/JsonFileStore.ts`, `FileOfflineQueue.ts`, `FileWorkEventRepository.ts`, `FileTimeEntryRepository.ts`, `packages/core/src/cli/runScan.ts` (diff), `packages/core/src/cli/runScanCli.ts`, `packages/core/package.json` (diff)), the existing EP-008 Chapters 00–03 text (as previously synchronized through Development Sprint 009), and ADR-0004/ADR-0006/ADR-0007 (re-read to confirm no duplication and no new architecture content).

## 2. Review-Approval Status (Read Before Relying on This Report)

An independent Review Agent has approved Development Sprint 010, and the Technical Lead has authorized recording DT-015 as Completed. As with DT-009, this closure carries no simulator/device or narrowed-scope caveat: DT-015 is a pure, unit-testable `packages/core` change with no mobile-launch dependency (`apps/mobile` was not modified), and its full, original Acceptance Criteria were implemented and reviewed in one pass, including manually re-verified cross-process durability.

## 3. Implementation Traceability Summary

| Chapter | New/Changed Section | Traces To |
|---|---|---|
| Ch00 Introduction | 10.1 (updated verification basis/commit), 10.2 (table: DT-015 row added), 10.12 (new — Sprint 010 note) | `EP-007_Development_Tasks.md` DT-015 section, commit `7bea186`, `Decision_Log.md` `DEV-SPRINT-010` row |
| Ch01 Implementation Philosophy | 10.10 (new) — storage-technology swap requires no business change; discovered bundling constraint documented and fixed, not guessed around | `runScan.ts` diff, `runScanCli.ts`, DT-015 Implementation Notes' documented deviation |
| Ch02 Repository Foundation | 10.8 (new) — new `infrastructure/persistence/` directory, `runScanCli.ts` placement | Direct inspection of `packages/core/src/infrastructure/persistence/` and `cli/runScanCli.ts` |
| Ch03 Solution Architecture | Header updated to "(Development Sprint 001–004 & 006–010)"; 10.51–10.56 (new); 10.57 (renumbered/updated Known Gaps) | `JsonFileStore.ts`, all three durable adapters, `runScan.ts`/`runScanCli.ts` split, ADR-0004/ADR-0006/ADR-0007, DT-015 Acceptance Criteria |

Every new sentence added to the four chapters cites a specific file, test, Development Task ID, ADR, or commit. No new architectural component is introduced; the durable adapters implement ports (`OfflineQueue`, `WorkEventRepository`, `TimeEntryRepository`) that already existed since Development Sprint 002/003.

## 4. Explicit Non-Duplication Check

The new sections cite, but do not reproduce, ADR-0004's Implementation Rule ("the architecture must include a local event queue or equivalent offline-capable mechanism before production release"), ADR-0006's "any persistence technology is infrastructure" framing, and ADR-0007's local-vs-backend persistence distinction — each quoted or paraphrased once as the authoritative source, not restated as if newly defined here. No ADR, TTAP-001, FB-001, or TS-001 content was otherwise reproduced.

## 5. Content Synchronized (Per Task Phase 2 Instruction)

- **Local Persistence Foundation**: `JsonFileStore` helper plus `FileOfflineQueue`/`FileWorkEventRepository`/`FileTimeEntryRepository`, closing the local half of ADR-0004's production-readiness requirement (Ch03 §10.51).
- **Repository adapter implementation**: each new adapter implements its existing port exactly, no port change, matching its in-memory counterpart's behavioral contract (Ch03 §10.51, §10.53).
- **Local persistence boundaries**: none of the three adapters read or branch on any business-decision value; they store and retrieve exactly the record type their port defines (Ch03 §10.53, Ch01 §10.10).
- **Persistence responsibilities**: `AssignmentResolver`, `AssignmentValidator`, `BusinessEngine`, `WorkEventFactory`, `SynchronizationService`, `SessionService` confirmed unchanged a sixth time (Ch03 §10.53).
- **Offline persistence flow / interaction with the Offline Queue**: `FileOfflineQueue` reproduces `InMemoryOfflineQueue`'s `already_queued` duplicate-enqueue semantics exactly; the composition root's `ScanDemoStorageOptions` extension and the `runScan.ts`/`runScanCli.ts` split governing how durable storage is selected (Ch03 §10.52, Ch01 §10.10, Ch02 §10.8).
- **Testing strategy**: per-adapter test files plus a dedicated "survives simulated restart" test per adapter, a composition-level `runScan.storageOverride.test.ts`, and manual cross-process verification (Ch03 §10.55).
- **Known limitations**: no concurrency/locking or atomic-write protection; mobile-native storage wiring and cloud/backend persistence technology both remain deferred (Ch03 §10.56, §10.57).
- **Developer guidance**: where the new files live and why (`infrastructure/persistence/` as a sibling to `infrastructure/repositories/`; `runScanCli.ts` beside `runScan.ts` with different runtime constraints) (Ch02 §10.8).

## 6. Changed Artifacts

| File | Change |
|---|---|
| `ADO/01_Architecture/Developer_Implementation_Manual/00_Introduction.md` | Updated 10.1–10.2; added 10.12 |
| `ADO/01_Architecture/Developer_Implementation_Manual/01_Implementation_Philosophy.md` | Added Section 10.10 |
| `ADO/01_Architecture/Developer_Implementation_Manual/02_Repository_Foundation.md` | Added Section 10.8 |
| `ADO/01_Architecture/Developer_Implementation_Manual/03_Solution_Architecture.md` | Updated Section 10 header; added 10.51–10.56; renumbered/updated 10.50→10.57 (Known Gaps) |
| `ADO/00_Core/Decision_Log.md` | Added `DEV-SPRINT-010` row; refreshed Repository Status narrative |
| `ADO/02_Development/EP-007_Development_Tasks.md` | DT-015 status line updated to "Completed" |
| `ADO/02_Development/Development_Sprint_010_Closure.md` | New — closure summary |
| `ADO/05_Evidence/EP-008/EP-008_Synchronization_Update_Sprint010.md` | New — this report |

No code, test, ADR, TTAP-001, FB-001, TS-001, or Product Vision file was modified. All four EP-008 chapters retain their original header Status ("Draft") and Integration Status fields — only body content was extended.

## 7. Role Handover

Implemented scope: governance closure (DT-015 marked Completed, unqualified) and EP-008 Chapters 00–03 synchronized with Development Sprint 010's Local Persistence Foundation. No source code was written or modified at any point in this closure task — the code itself (commit `7bea186`) was implemented in a prior session per the approved Development Sprint 010 Plan and independently reviewed before this closure task began.

Changed files: see Section 6 above and `Development_Sprint_010_Closure.md` Section 5.

Related ADO artifacts consulted: `EP-007_Development_Tasks.md` (DT-015), `Development_Sprint_010_Plan.md`, `Decision_Log.md`, ADR-0004 (Offline-first Core Events), ADR-0006 (Domain-first Architecture), ADR-0007 (Technology Platform Baseline), `Role_Model.md`, `System_Overview.md`, DTP-001, current `packages/core/src/infrastructure/persistence/` (all three adapters plus `JsonFileStore.ts`), `packages/core/src/cli/runScan.ts`/`runScanCli.ts`, `packages/core/package.json`, EP-008 Chapters 00–03.

Tests performed: `npm run typecheck --workspace=@taptime/core`, `npm run typecheck --workspace=@taptime/mobile`, `npm run test --workspace=@taptime/core` (154 tests pass). Run to verify claims made in this update are accurate, not to change anything.

Known deviations: none from the assigned task scope. As with Sprints 007–009, no interim "Implemented — Pending Review" `DEV-SPRINT-010` row existed before this closure; a `DEV-SPRINT-010` row was added directly as "Completed," narrated with the same evidence an interim row would have carried. Separately, DT-015's own implementation (prior session) documented one required deviation from the plan's literal wording (moving directory-to-adapter construction from `runScan.ts` into a new `runScanCli.ts` to avoid breaking `apps/mobile`'s Metro bundling) — this is not a deviation introduced by this closure task, but is carried into this EP-008 synchronization as implemented reality (Ch01 §10.10, Ch03 §10.52/§10.54).

Unresolved questions / open findings carried forward: (1) Development Sprint 002 and Development Sprint 004 remain without recorded Review Agent verification or Human Architect approval; (2) Development Sprint 005's EP-008 implementation narrative remains unsynchronized (status only); (3) Finding F-01 remains open; (4) `QueuedWorkEventRecord.decision: null` integration-coverage gap remains open; (5) the local persistence adapters have no concurrency/locking or atomic-write protection, by explicit design this sprint; (6) mobile-native on-device storage wiring (`expo-sqlite`/`AsyncStorage`) remains a proposed, smaller follow-up, not attempted; (7) cloud/backend persistence technology and a real managed authentication provider both remain undecided Human Architect decisions; (8) a viewing/reporting capability remains named at the product level with no approved architectural component; (9) `DT-010` still has no explicit "Status:" line in `EP-007_Development_Tasks.md`, a minor documentation-consistency gap noted again, not corrected here.

Evidence produced: this report, `Development_Sprint_010_Closure.md`, and the diffs to the four EP-008 chapter files, `EP-007_Development_Tasks.md`, and the Decision Log.

Next responsible role: Technical Lead / Human Architect to review this closure, then decide Development Sprint 011's direction (candidates remain gated on the still-undecided backend/persistence technology decision, on a future FB-001/TS-001 extension for viewing/reporting, on the smaller mobile-native storage follow-up, or on other unblocked work). Per the assigned stop condition, this task does not begin Development Sprint 011 and does not commit or push.

## 8. Stop Condition

Per task instruction: stop after Sprint 010 Governance Closure, EP-008 Synchronization, and Review Preparation. Do not commit. Do not push. Do not begin Development Sprint 011. Await Technical Lead / Human Architect review.
