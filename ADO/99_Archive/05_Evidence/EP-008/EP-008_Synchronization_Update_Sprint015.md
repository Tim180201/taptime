# EP-008 Synchronization Update — Development Sprint 015 — Evidence Report

Role: Research / Implementation Support acting on behalf of Technical Lead (per AGR-001)
Date: 2026-07-08
Repository State Verified Against: `main` at commit `7db5ade` (DT-020/DT-021/DT-022: Repository Write Extensions, Development Sprint 015)
Scope: Synchronize EP-008 Chapters 00–03 with Development Sprint 015's three repository write extensions (DT-020, DT-021, DT-022). No code changes. No new chapters created. No future work introduced — only what Sprint 015 actually changed is documented; DT-023 and later Development Tasks are explicitly not documented as implemented.

---

## 1. Objective (as assigned)

> Synchronize EP-008 with the completed Development Sprint 015. Synchronize only actual implemented reality. Document DT-020, DT-021 and DT-022 only. Do NOT introduce future work. Do NOT document DT-023 or later tasks as implemented. Maintain the existing Developer Implementation Manual style. Update only EP-008 Chapters 00–03 where Sprint 015 materially changes implemented reality.

Chapters 00–03 were reviewed against: `Development_Sprint_015_Plan.md`, `Development_Sprint_015_Closure.md`, DT-020/DT-021/DT-022's Implementation Notes in `EP-007_Development_Tasks.md`, direct inspection of every new/changed file (three port files, three adapter files, three event files, three test files, `index.ts` diff), the existing EP-008 Chapters 00–03 text (as previously synchronized through Development Sprint 014), and FB-002/TS-002 (re-read to confirm no duplication and no new architecture content beyond what both documents already specify).

## 2. Review-Approval Status (Read Before Relying on This Report)

An independent Review Agent has verified Development Sprint 015's implementation, and the Technical Lead has authorized recording DT-020, DT-021, and DT-022 as Completed. As with DT-017/DT-018/DT-019, this synchronization carries no environment-constraint caveat: all three write extensions are pure, unit-testable `packages/core` changes with no simulator/device dependency, and their Acceptance Criteria are fully met by repository evidence gathered this session (typecheck clean, 197/197 `packages/core` tests passing, 10/10 `apps/mobile` tests passing, all nine changed/new production files and three new test files inspected directly). This synchronization documents implemented reality at the same confidence level that evidence supports — an unqualified "Completed" for all three tasks.

## 3. Implementation Traceability Summary

| Chapter | New/Changed Section | Traces To |
|---|---|---|
| Ch00 Introduction | 10.1 (updated verification basis/commit), 10.2 (table: DT-020/DT-021/DT-022 rows added, DT-023–DT-026 row narrowed), 10.17 (new — Sprint 015 note) | `EP-007_Development_Tasks.md` DT-020/DT-021/DT-022 Implementation Notes, commit `7db5ade`, `Decision_Log.md` `DEV-SPRINT-015` row |
| Ch01 Implementation Philosophy | 10.15 (new) — three same-shape write extensions verified independently confirm a "bundle" is safe only when files never overlap and no task depends on another | `CustomerRepository.ts`/`NfcTagRepository.ts`/`NfcAssignmentRepository.ts` diffs, the three adapter diffs, `git diff --stat` scope isolation |
| Ch02 Repository Foundation | 10.13 (new) — three existing repository ports each extended with one additive method, three existing in-memory adapters each upgraded to the defensive-copy constructor pattern, no new top-level grouping introduced | Direct inspection of `packages/core/src/ports/`, `infrastructure/repositories/`, `index.ts` diff |
| Ch03 Solution Architecture | Header updated to "(Development Sprint 001–004 & 006–015)"; 10.79–10.82 (new); 10.83 (renumbered/updated Known Gaps) | `CustomerCreated.ts`, `NfcTagRegistered.ts`, `NfcTagAssigned.ts`, the three port/adapter pairs, the three new test files, TS-002 "Extended Existing Ports"/"Business Events" sections, DT-020/DT-021/DT-022 Acceptance Criteria |

Every new sentence added to the four chapters cites a specific file, test, Development Task ID, or commit. No new architectural component is introduced beyond what TS-002 already named; `CustomerCreated`, `NfcTagRegistered`, and `NfcTagAssigned` implement exactly the three events TS-002's Business Events section already specifies, and the three write methods implement exactly TS-002's "Extended Existing Ports" section.

## 4. Explicit Non-Duplication Check

The new sections cite, but do not reproduce, FB-002's own Decision 3/4/5 language and TS-002's "Extended Existing Ports"/"Business Events" sections — each referenced once as the authoritative source, not restated as if newly defined here. No ADR, TTAP-001, FB-001, TS-001, FB-002, or TS-002 content was otherwise reproduced. No future work (DT-023 `OrganizationAdministrationService` Customer registration, DT-024 NFC Tag Registration application flow, DT-025 NFC Tag Assignment application flow, DT-026 scan-pipeline integration verification) is introduced as planned or implemented scope in these chapters — each is mentioned only as an explicitly-named, explicitly-not-started open item (Ch00 §10.17, Ch03 §10.83), consistent with what this sprint itself disclosed.

## 5. Content Synchronized (Per Task Instruction: Only What Sprint 015 Actually Changed)

- **Three repository write extensions**: `CustomerRepository.save`, `NfcTagRepository.register`, `NfcAssignmentRepository.save`, each additive, each leaving its existing read method byte-for-byte unchanged (Ch03 §10.79).
- **Three new domain events**: `CustomerCreated`, `NfcTagRegistered`, `NfcTagAssigned`, each following the `WorkEventCreated`/`OrganizationCreated`/`MembershipGranted` constructor-function idiom exactly (Ch03 §10.79).
- **Adapter pattern upgrade, disclosed**: all three `InMemory*` adapters switched from a bare-reference constructor to the defensive-copy (`[...items]`) pattern `InMemoryOrganizationRepository`/`InMemoryMembershipRepository` already established, bringing the two older adapter pairs in line with the two newer ones (Ch01 §10.15, Ch02 §10.13).
- **First-time bundling of three Development Tasks in one sprint, and why it held up under independent verification**: each of DT-020/DT-021/DT-022 touches an entirely disjoint file set, confirmed by `git diff --stat`, and each was independently verifiable against its own Acceptance Criteria without reference to the other two (Ch01 §10.15).
- **Testing strategy**: 16 new unit tests across three new dedicated test files (5+5+6), the first-ever dedicated test coverage for these three repositories; 197/197 `packages/core` tests passing (181 pre-existing + 16 new); explicit non-regression confirmation that `AssignmentResolver.test.ts`/`AssignmentValidator.test.ts` pass unmodified; no composition-level or `apps/mobile` test exists for any of the three write methods, and no caller exists yet, consistent with DT-020/DT-021/DT-022's own Out of Scope (Ch03 §10.81).
- **Known limitations**: DT-023 through DT-026 not started; the Membership-granting bootstrap question unresolved; same-Organization assignment semantics, tag reassignment/history semantics, and tag payload collision semantics unresolved; no caller for any of the three new write methods (Ch03 §10.83, Ch00 §10.17).

## 6. Changed Artifacts

| File | Change |
|---|---|
| `ADO/01_Architecture/Developer_Implementation_Manual/00_Introduction.md` | Updated 10.1–10.2; added 10.17 |
| `ADO/01_Architecture/Developer_Implementation_Manual/01_Implementation_Philosophy.md` | Added Section 10.15 |
| `ADO/01_Architecture/Developer_Implementation_Manual/02_Repository_Foundation.md` | Added Section 10.13 |
| `ADO/01_Architecture/Developer_Implementation_Manual/03_Solution_Architecture.md` | Updated Section 10 header; added 10.79–10.82; renumbered/updated 10.78→10.83 (Known Gaps) |
| `ADO/00_Core/Decision_Log.md` | Added `DEV-SPRINT-015` row |
| `ADO/02_Development/EP-007_Development_Tasks.md` | DT-020/DT-021/DT-022 Implementation Notes updated with actual implementation summary, commit reference, test results, known limitations |
| `ADO/00_Core/Project_Status.md` | Updated to reflect Sprint 015 completion |
| `ADO/02_Development/Development_Sprint_015_Closure.md` | New — closure summary |
| `ADO/05_Evidence/EP-008/EP-008_Synchronization_Update_Sprint015.md` | New — this report |

No code, test, ADR, TTAP-001, FB-001, TS-001, FB-002, TS-002, or Product Vision file was modified. All four EP-008 chapters retain their original header Status ("Draft") and Integration Status fields — only body content was extended.

## 7. Role Handover

Implemented scope: governance closure (DT-020, DT-021, and DT-022 marked Completed with repository evidence gathered and recorded this session) and EP-008 Chapters 00–03 synchronized with Development Sprint 015's three repository write extensions. No source code was written or modified at any point.

Changed files: see Section 6 above and `Development_Sprint_015_Closure.md` Section 9.

Related ADO artifacts consulted: `EP-007_Development_Tasks.md` (DT-020/DT-021/DT-022), `Development_Sprint_015_Plan.md`, `Development_Sprint_014_Closure.md`, `Decision_Log.md`, FB-002, TS-002, `EP-009_Product_Readiness_Framework.md`, `Product_Readiness_Assessment.md`, current `packages/core/src/ports/CustomerRepository.ts`/`NfcTagRepository.ts`/`NfcAssignmentRepository.ts`, `infrastructure/repositories/InMemoryCustomerRepository.ts`/`InMemoryNfcTagRepository.ts`/`InMemoryNfcAssignmentRepository.ts`, `domain/events/CustomerCreated.ts`/`NfcTagRegistered.ts`/`NfcTagAssigned.ts`, `business/AssignmentResolver.ts`/`AssignmentValidator.ts` (confirmed unchanged), the three new test files, `packages/core/src/index.ts`, EP-008 Chapters 00–03.

Tests performed: `npm run typecheck --workspace=@taptime/core` (clean), `npm run test --workspace=@taptime/core` (197/197 pass), `npm run typecheck --workspace=apps/mobile` (clean), `npm run test --workspace=apps/mobile` (10/10 pass). Run this session to verify claims made in this update are accurate, not to change anything.

Known deviations: none from the assigned task scope. As with Sprints 012–014, no interim "Implemented — Pending Review" `DEV-SPRINT-015` row existed before this closure; a `DEV-SPRINT-015` row was added directly with its final status ("Completed"), narrated with the evidence gathered this session. One disclosed observation carried forward from the Sprint 014 precedent: commit `7db5ade` bundles the DT-020/021/022 implementation together with the Sprint 015 Plan document and its own disclosed `Project_Status.md` update — a Technical Lead commit, not a deviation in this task's own scope, but disclosed here for the same reason it was disclosed in `Development_Sprint_014_Closure.md`.

Unresolved questions / open findings carried forward: (1) DT-023 through DT-026 remain entirely unimplemented; (2) the Membership-granting bootstrap question remains unresolved; (3) same-Organization assignment semantics, tag reassignment/history semantics, and tag payload collision semantics remain unresolved; (4) `CustomerRepository.save`/`NfcTagRepository.register`/`NfcAssignmentRepository.save` have no caller anywhere in the repository; (5) DT-016 physical Android device/NFC-tag validation remains outstanding; (6) FB-002's and TS-002's own header "Status" fields remain "Draft," unchanged by this closure; (7) Development Sprint 002 and Development Sprint 004 remain without recorded Review Agent verification or Human Architect approval; (8) Development Sprint 005's EP-008 implementation narrative remains unsynchronized; (9) Finding F-01 remains open; (10) `QueuedWorkEventRecord.decision: null` integration-coverage gap remains open; (11) the cloud/backend persistence technology decision remains undecided; (12) a viewing/reporting capability remains named at the product level with no approved architectural component.

Evidence produced: this report, `Development_Sprint_015_Closure.md`, and the diffs to the four EP-008 chapter files, `EP-007_Development_Tasks.md`, the Decision Log, and `Project_Status.md`.

Next responsible role: Technical Lead / Human Architect to review this closure, then act on `Development_Sprint_015_Closure.md` Section 15's recommendation — Development Sprint 016 planning for DT-023 alone, and/or DT-016 physical-device validation, and/or FB-002/TS-002 status reconciliation, each independently actionable. Per the assigned stop condition, this task does not begin Development Sprint 016, does not start DT-023, and does not commit or push.

## 8. Stop Condition

Per task instruction: stop after Sprint 015 Governance Closure, EP-008 Synchronization, and the required repository updates. Do not commit. Do not push. Do not create Development Sprint 016. Do not start DT-023. Await Technical Lead / Human Architect review.
