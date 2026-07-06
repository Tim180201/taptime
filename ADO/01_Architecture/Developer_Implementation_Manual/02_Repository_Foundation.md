# EP-008 – Developer Implementation Manual

## Chapter 02 – Repository Foundation

Status: Draft  
Document ID: EP-008-CH02  
Epic: EP-008  
Owner: Technical Lead  
Approval Authority: Human Architect  
Repository Scope: TapTim.e ADO  
Integration Status: Branch integration for Human Architect review  
Related Artifacts: ADO/README.md, Decision Log, AVR-001, Product Vision, ADRs, TTAP-001, Feature Blueprint Standard, Feature Blueprints, Technical Specifications, Development Task Profile, EOM-001, AGR-001

---

## 1. Purpose

This chapter explains how developers shall use the TapTim.e repository as their implementation foundation.

The repository is not only a place for source code. It is the engineering system of record for TapTim.e. It contains product intent, architecture decisions, governance, engineering standards, feature definitions, technical specifications, development work, evidence and implementation state.

Chapter 02 answers one practical question:

```text
Where do I find the correct repository truth for my implementation question?
```

It does not define product vision, architecture, feature behavior, technical specifications or task scope. It explains how developers navigate existing repository knowledge and apply it safely during implementation.

A new developer shall be able to use this chapter to locate the correct source-of-truth artifact, understand which artifact owns which responsibility, determine the correct reading order before implementation, avoid duplicate documents and parallel structures, preserve traceability from code to engineering decisions, identify missing or conflicting evidence and decide whether to extend existing knowledge or escalate.

This chapter is the repository navigation system for EP-008.

---

## 2. Responsibilities

### 2.1 Repository Foundation Responsibility

The Repository Foundation is responsible for developer orientation.

It defines how developers shall use the repository before, during and after implementation.

It may define how to identify the correct artifact for a question, how to order repository reading, how to preserve traceability, how to detect duplicate or conflicting knowledge, how to handle missing repository evidence and how to prepare implementation work for review.

It may not define product intent, architecture content, feature behavior, technical specification details, final source folder structure unless approved elsewhere, task scope, governance authority or agent responsibilities.

### 2.2 ADO Responsibility

The ADO is the structured engineering knowledge area for TapTim.e.

For developers, ADO is where approved or review-ready knowledge is found before implementation. A developer shall not treat ADO as separate from implementation work. Source code and ADO artifacts must remain connected.

ADO areas answer different questions:

| Area | Developer Question |
|---|---|
| Core | What baseline records and decisions exist? |
| Governance | What validation or approval state applies? |
| Architecture | What architecture, standards and specifications constrain implementation? |
| Development | What engineering work is active or completed? |
| Evidence | What proof, review output or reconciliation exists? |

The exact repository structure shall always be verified from current repository state.

### 2.3 Source Code Responsibility

Source code is implementation state.

It shows what currently exists, but it does not automatically approve itself as architecture or product truth. Developers shall inspect source code to understand repository reality. If source code conflicts with approved ADO artifacts, the conflict must be documented and resolved through the engineering workflow.

Source code may reveal existing implementation boundaries, technical debt, partial implementation, missing tests, outdated patterns and gaps between intended architecture and current reality.

Source code shall not silently redefine product intent, business rules, architecture responsibilities, feature behavior or governance decisions.

### 2.4 Developer Responsibility

Developers are responsible for performing repository discovery before implementation.

For each meaningful change, a developer shall identify the relevant task, locate related ADO artifacts, read relevant architecture and specification documents, inspect current source code reality, determine the owning responsibility boundary, implement inside approved scope, produce tests and document handover information.

Developers shall not implement directly from an issue title, informal conversation, UI observation or code search result when ADO artifacts exist.

---

## 3. Diagram

### 3.1 Repository as Engineering System

```text
TapTim.e Repository

  Product Intent
    -> Product Vision

  Engineering Decisions
    -> Decision Log
    -> ADRs

  Architecture
    -> TTAP
    -> Standards
    -> Profiles

  Feature Definition
    -> Feature Blueprints
    -> Technical Specifications

  Work Execution
    -> Development Tasks
    -> Engineering Packages
    -> Role Handovers

  Evidence
    -> Review Packages
    -> Validation Evidence
    -> Repository Reconciliation

  Implementation
    -> Source Code
    -> Tests
    -> Runtime Configuration
```

The repository is one engineering system. Implementation is not isolated from ADO.

### 3.2 Developer Discovery Flow

```text
Start Implementation Work
  -> Verify Branch and Repository State
  -> Read Decision Log
  -> Identify Related ADRs
  -> Read Relevant Architecture / TTAP
  -> Read Feature Blueprint
  -> Read Technical Specification
  -> Read Development Task
  -> Inspect Existing Source Code
  -> Apply EP-008 Guidance
  -> Implement
```

### 3.3 Traceability Chain

```text
Commit
  -> Changed Files
  -> Development Task
  -> Technical Specification
  -> Feature Blueprint
  -> TTAP / ADR
  -> Decision Log
  -> Product Vision
```

Traceability means a reviewer can reconstruct why the code exists and which approved responsibility it implements.

---

## 4. Dependencies

### 4.1 Repository Entry Point

Developers shall use the official ADO navigation entry point to locate mandatory engineering documents. Do not guess mandatory paths when the ADO index provides them.

### 4.2 Decision Log

The Decision Log indexes important technical and organizational decisions. Before implementation touches architecture, feature behavior, governance or repository structure, developers shall inspect the Decision Log for relevant records.

### 4.3 AVR-001

AVR-001 records validation status. Developers shall not assume an artifact is final because it exists. Validation state affects implementation confidence and review risk.

### 4.4 Product Vision

Product Vision defines product intent. Developers do not implement directly from Product Vision unless a task and technical guidance exist, but Product Vision helps verify that implementation work serves the intended product direction.

### 4.5 ADRs

ADRs define durable architecture decisions. Developers shall inspect relevant ADRs before changing platform baseline, event model, offline behavior, domain boundaries, architecture patterns or technology choices.

### 4.6 TTAP

TTAP defines the technical architecture profile. EP-008 explains implementation handling, but TTAP remains the source of architecture truth.

### 4.7 Feature Blueprints

Feature Blueprints define what a feature does. Developers shall read the relevant Feature Blueprint before implementing feature behavior.

### 4.8 Technical Specifications

Technical Specifications define how approved feature behavior is implemented. EP-008 may provide general implementation patterns, but the Technical Specification owns feature-specific implementation detail.

### 4.9 Development Tasks

Development Tasks define assigned work scope. A developer may not expand scope because related code is nearby or because a broader refactor seems useful.

### 4.10 Existing Code

Existing code defines current implementation reality. Developers shall inspect it after reading source-of-truth artifacts so reality can be reconciled with approved knowledge.

---

## 5. Rules

### 5.1 Start From Repository Evidence

No meaningful implementation starts from code alone. Code is inspected, but it is not the only authority.

### 5.2 Use the Correct Source of Truth

| Developer Question | Source of Truth |
|---|---|
| Why does TapTim.e exist? | Product Vision |
| Why was this technical direction chosen? | ADR / Decision Log |
| What is the technical architecture? | TTAP |
| What does this feature do? | Feature Blueprint |
| How is this feature implemented? | Technical Specification |
| What work am I assigned to do? | Development Task |
| How do I implement within approved boundaries? | EP-008 |
| Is an artifact validated? | AVR-001 |
| What actually exists now? | Source code and repository state |

If the correct source of truth is missing, do not use a lower-authority artifact to invent the answer.

### 5.3 Preserve Reading Order

For feature work, use this reading order unless the task clearly requires a narrower set:

```text
ADO/README.md
  -> Decision Log
  -> AVR-001
  -> Relevant ADRs
  -> TTAP / Standards
  -> Feature Blueprint
  -> Technical Specification
  -> Development Task
  -> Existing Source Code
  -> EP-008 Chapter Guidance
```

### 5.4 Extend Existing Knowledge Before Creating New Knowledge

Before creating a new artifact, folder or concept, verify whether existing repository knowledge already owns it. If the answer belongs in an existing document, extend that document through the proper workflow.

### 5.5 Do Not Duplicate Permanent Knowledge

Permanent engineering knowledge should exist in one authoritative location. EP-008 may reference and apply other artifacts. It shall not copy their full content into implementation guidance.

### 5.6 Separate Permanent Knowledge From Temporary Work Material

Permanent knowledge may include architecture documents, ADRs, standards, manuals, validated specifications and stable glossary entries. Temporary material may include Engineering Packages, Review Packages, handovers, integration checklists, draft ZIP packages and local analysis notes.

Temporary material may be retained as evidence when required, but it shall not become authoritative architecture by accident.

### 5.7 Document Repository Reality

When repository reality differs from expected architecture, document the difference. Do not hide mismatches by forcing code to appear compliant without evidence.

### 5.8 Avoid Parallel Structures

Do not create a parallel folder, duplicate document or second implementation path unless explicitly approved. Parallel structures create ambiguity.

### 5.9 Preserve Traceability in Commits

Commit messages shall describe the engineering purpose, not only the file operation.

Good:

```text
EP-008: add Chapter 02 – Repository Foundation
```

Weak:

```text
update files
```

### 5.10 Escalate Repository Ambiguity

Escalate when two artifacts conflict, the owning artifact is missing, source code contradicts approved decisions, validation status is unclear, a change would create permanent knowledge or a repository structure change is required.

---

## 6. Examples

### 6.1 Implementing NFC Behavior

Incorrect path:

```text
Open source code
  -> Find NFC screen
  -> Add business logic
  -> Test UI manually
  -> Commit
```

Correct path:

```text
Open repository
  -> Read Decision Log
  -> Verify artifact status in AVR-001
  -> Read relevant ADRs
  -> Read TTAP guidance
  -> Read FB-001
  -> Read TS-001
  -> Read assigned Development Task
  -> Inspect existing source code
  -> Apply EP-008 guidance
  -> Implement within boundary
  -> Add tests
  -> Produce evidence and handover
```

### 6.2 Existing Code Without Matching Artifact

If a source module appears to implement behavior not described by a Feature Blueprint or Technical Specification, document the mismatch, do not extend the behavior as if approved and escalate to Technical Lead for repository reconciliation.

### 6.3 Adding New Documentation

If implementation guidance for business decision testing is needed, first check whether EP-008 already owns that guidance. If yes, extend the relevant EP-008 chapter instead of creating a new standalone standard.

### 6.4 Contradictory Naming

If a Technical Specification uses one term and source code uses another for the same concept, document the mismatch, identify the owning terminology artifact and avoid introducing a third name.

### 6.5 Preparing a Commit

Good commit preparation includes changed files, related Development Task, related Technical Specification, related Feature Blueprint, relevant architecture reference, tests performed and known risks.

Poor commit preparation says only that it works locally.

---

## 7. Implementation Notes

### 7.1 Practical Reading Pattern

Use a layered reading pattern:

```text
Product Vision / Feature Blueprint
  -> Decision Log / ADRs / AVR-001
  -> TTAP / Standards / Profiles
  -> Technical Specification / Development Task
  -> Source Code / Tests / Evidence
  -> EP-008 relevant chapters
```

### 7.2 Placement Guidance

Place content where its responsibility belongs:

- Architecture knowledge belongs in ADO architecture areas.
- Validation status belongs in governance artifacts.
- Decisions belong in Decision Log or ADRs.
- Feature behavior belongs in Feature Blueprints.
- Feature implementation detail belongs in Technical Specifications.
- Assigned work belongs in Development Tasks.
- Review evidence belongs in Evidence.
- Implementation guidance belongs in EP-008.
- Source code belongs in the codebase according to approved structure.

### 7.3 When to Extend Existing Artifacts

Extend an existing artifact when the new information belongs to the same responsibility, the artifact already owns the concept, a separate artifact would duplicate knowledge and traceability can be preserved.

### 7.4 When to Create New Artifacts

Create a new artifact only when no existing artifact owns the responsibility, the information is permanent engineering knowledge, the artifact type fits the engineering model and creation is approved or clearly required by workflow.

### 7.5 When Not to Integrate Material Permanently

Do not integrate temporary work material as permanent knowledge unless it becomes evidence by explicit repository decision.

### 7.6 Source Code Inspection

When inspecting source code, look for module boundaries, naming conventions, dependency direction, test structure, implementation gaps, accidental business logic in UI or infrastructure, duplicate concepts and mismatch with approved terminology.

### 7.7 Test Placement

Tests should be placed where they prove the responsibility being changed. Business rule tests belong near the business decision boundary. Use case tests belong near orchestration. Adapter tests belong near infrastructure. UI tests belong near presentation flow.

### 7.8 Evidence

Implementation evidence shall connect implementation to repository artifacts. Evidence may include test results, changed file list, implementation summary, known risks, unresolved questions, reconciliation notes and role handover.

### 7.9 Repository Health Findings

If developers find repository health issues during implementation, they shall document them before corrective action. Not every finding must be fixed immediately, but it must not be ignored when it affects implementation correctness.

### 7.10 Daily Workflow

```text
Pull latest branch state
  -> Verify assigned task
  -> Identify relevant ADO artifacts
  -> Read source-of-truth documents
  -> Inspect current code reality
  -> Identify responsibility boundary
  -> Implement smallest correct change
  -> Add or update tests
  -> Run validation
  -> Record evidence
  -> Commit with traceable message
  -> Prepare role handover
```

---

## 8. Engineering Decision

### 8.1 Decision Statement

TapTim.e developers shall treat the repository as the engineering system of record.

Implementation work shall begin from repository evidence, preserve artifact responsibility, avoid duplicate permanent knowledge, maintain traceability and reconcile source code reality with approved ADO artifacts.

### 8.2 Rationale

TapTim.e uses FDOS and ADO to keep product intent, architecture, development and evidence connected.

If developers implement directly from source code or informal context, the repository can drift into inconsistent architecture and untraceable behavior.

A repository foundation chapter is required so developers know where to find the correct answer, which artifact owns each decision type, when to extend existing artifacts, when to escalate missing knowledge and how to connect code changes back to approved decisions.

### 8.3 Consequences

Developers must spend time reading repository evidence before implementation. This increases upfront discipline but reduces rework, architecture drift and review ambiguity.

New files, folders and concepts require responsibility checks before creation.

Review can evaluate implementation more reliably because changes are connected to source-of-truth artifacts.

### 8.4 Non-Decisions

This chapter does not decide final source folder structure, ADO restructuring, governance standards, product scope, feature behavior, architecture responsibilities, development tasks or repository tooling.

---

## 9. Summary

The TapTim.e repository is the engineering system of record.

Developers shall use it as a connected system of product intent, decisions, architecture, feature definitions, technical specifications, development work, evidence and source code.

The practical rule is:

```text
Find the artifact that owns the answer before implementing the code that depends on it.
```

Developers shall preserve reading order, avoid duplicate knowledge, distinguish permanent knowledge from temporary work material, document repository reality and maintain traceability from implementation back to approved engineering decisions.

This chapter prepares developers for the following EP-008 chapters by ensuring they know where implementation authority comes from before applying architecture, domain, business engine, application, infrastructure or mobile guidance.

---

## 10. Implemented Reality (EP-008 Synchronization Update)

### 10.1 Actual `packages/core/src` Structure (as of `main` commit `e19de60`)

Development Sprint 001 through Development Sprint 004 are the implementation work in the repository so far, so this is the first point at which "repository reality" (Section 2.3) exists as source code rather than only as ADO artifacts. The current structure, verified by direct inspection, is:

```text
packages/core/src/
  domain/
    ids.ts, Timestamp.ts, NfcPayload.ts, CallerContext.ts, AssignmentTarget.ts,
    Customer.ts, NfcTag.ts, NfcAssignment.ts, WorkEvent.ts, TimeEntry.ts,
    SyncState.ts, QueuedWorkEventRecord.ts, generateId.ts
    domain/facts/        (NfcTagScanned.ts)
    domain/events/        (NfcAssignmentResolution.ts, WorkEventCreated.ts, TimeEntryStarted.ts,
                            WorkEventQueuedForSync.ts, WorkEventSynchronized.ts, WorkEventSyncFailed.ts)
  business/
    AssignmentResolver.ts, AssignmentValidator.ts, AssignmentValidationResult.ts,
    WorkEventFactory.ts, BusinessEngine.ts, BusinessEngineDecision.ts
  application/
    NfcScanApplicationService.ts, ScanPipelineOutcome.ts, WorkEventCreationService.ts,
    SynchronizationService.ts, SynchronizationResult.ts
  ports/
    NfcScanPort.ts, NfcTagRepository.ts, NfcAssignmentRepository.ts,
    CustomerRepository.ts, WorkEventCreationPort.ts, WorkEventRepository.ts,
    TimeEntryRepository.ts, OfflineQueue.ts, SynchronizationGateway.ts
  infrastructure/
    infrastructure/adapters/     (FakeNfcScanAdapter.ts, FakeSynchronizationGateway.ts)
    infrastructure/repositories/ (InMemory*Repository.ts for NfcTag, NfcAssignment,
                                   Customer, WorkEvent, TimeEntry, and InMemoryOfflineQueue.ts)
```

This is the direct source for Section 3.1's "Repository as Engineering System" diagram at implementation depth: `domain` holds facts/events and stable concepts (now including `WorkEventSynchronized`/`WorkEventSyncFailed`), `business` holds decision logic (DT-002/003/004/005, unchanged by DT-008), `application` holds orchestration (DT-001/003 seam, DT-004/005/007 wiring, and now `SynchronizationService`), `ports` holds the interfaces both sides depend on (now including `SynchronizationGateway`), and `infrastructure` holds the fake/in-memory adapters implementing those ports for this stage of the project (now including `FakeSynchronizationGateway`).

### 10.2 Reconciliation With Chapter 03's Suggested Structure

Chapter 03, Section 7.2 suggests `domain/ application/ business/ infrastructure/ mobile/ shared/` as a non-binding placement guide. The implemented structure matches this closely but adds a top-level `ports/` directory that Chapter 03 does not name explicitly (Chapter 03 Section 7.3 discusses ports/adapters conceptually without prescribing a folder). Per Section 5.7 of this chapter ("Document Repository Reality"), this is recorded here rather than silently treated as a deviation: the actual repository groups all port interfaces under `ports/`, separate from the `business`/`application` code that depends on them and the `infrastructure` code that implements them. DT-007 (Offline Queue) and DT-008 (Synchronization Service) both followed this same pattern exactly (`OfflineQueue`/`SynchronizationGateway` in `ports/`, their fake/in-memory implementations in `infrastructure/`) rather than introducing a new top-level grouping for queue- or sync-related code — a direct, repeated application of "Extend Before Create" to repository structure itself. No `mobile/` or `shared/` directories exist yet, consistent with DT-009/DT-010 and the mobile client not having started.

### 10.3 Traceability Chain, Worked Example

Applying Section 3.3's traceability chain to a concrete file: `packages/core/src/business/BusinessEngine.ts` traces to Development Task DT-005 (`EP-007_Development_Tasks.md`), which traces to Development Sprint 002 Plan Section 8/12 (`Development_Sprint_002_Plan.md`), which traces to TS-001's Business Engine component responsibility and FB-001's Decision Logic 4 (Derive TimeEntry Outcome), which trace to TTAP-001's Business Engine architecture responsibility and Decision Log record `DEV-SPRINT-002`. Applying the same chain to `packages/core/src/ports/OfflineQueue.ts`: it traces to DT-007, to Development Sprint 003 Plan Sections 6/10/16, to TS-001's `OfflineQueue` component responsibility and TTAP-001's Runtime Architecture flow, and to FB-001's Business Rule "Offline operation shall preserve the WorkEvent locally" — now with Decision Log record `DEV-SPRINT-003` (Completed). Applying the same chain to `packages/core/src/ports/SynchronizationGateway.ts`: it traces to DT-008, to Development Sprint 004 Plan Sections 6/10/16 (`Development_Sprint_004_Plan.md`), to TS-001's `SynchronizationService` component responsibility and TTAP-001's Runtime Architecture flow, and to FB-001's Edge Case "Synchronization conflict after offline capture" — with Decision Log record `DEV-SPRINT-004`, currently "Implemented — Pending Review" rather than "Completed" (see Chapter 00 Section 10.6).

### 10.4 Workspace Structure Extended With `apps/mobile` (Development Sprint 006)

Development Sprint 006 (DT-012) added the repository's first `apps/*` workspace package, verified by direct inspection:

```text
apps/mobile/
  App.tsx, index.ts, app.json, package.json, tsconfig.json
  src/
    navigation/AppNavigator.tsx
    screens/ScanScreen.tsx
```

The root workspaces glob already included `apps/*` before Sprint 006 (no root `package.json` change was needed to add it). `apps/mobile`'s `package.json` depends on `@taptime/core` via the workspace protocol (`"@taptime/core": "*"`) and on `expo`, `react`, `react-native`, `react-native-web`/`react-dom` (the last two added in a follow-up commit, `43a628e`, to support `expo start --web`). Its own `tsconfig.json` extends `expo/tsconfig.base`, not this repository's root `tsconfig.base.json` — documented as a deliberate deviation (Chapter 03 Section 10.34), since Expo's base config is required for JSX/React Native module resolution that the root Node-oriented config does not provide. No persistence or network code exists inside `apps/mobile` — verified by the directory listing above containing no `infrastructure/` or `ports/` files of its own. (As of Development Sprint 008, `apps/mobile` gains its first authentication-adjacent file, `screens/LoginScreen.tsx` — Section 10.6; it remains a UI-only call into `packages/core`'s existing `SessionService`, not a new implementation of authentication logic.)

### 10.5 `packages/core/src` Structure Extended for Authentication (Development Sprint 007)

Development Sprint 007 (DT-013) added four files to the structure listed in Section 10.1, following its existing grouping exactly — no new top-level directory was introduced:

```text
packages/core/src/
  ports/AuthenticationGateway.ts        (port + Credentials shape)
  application/AuthenticationResult.ts   (explicit typed result)
  application/SessionService.ts         (signIn(), toCallerContext())
  infrastructure/adapters/FakeAuthenticationGateway.ts
```

This follows the same pattern DT-007/DT-008 already established (Section 10.2): the port lives in `ports/`, its fake/local implementation in `infrastructure/adapters/`, and its orchestration in `application/` — no new top-level grouping was added for authentication, consistent with "Extend Before Create" applied to repository structure itself. `packages/core/src/domain/CallerContext.ts` (Section 10.1's original listing, Development Sprint 001) is unchanged; `SessionService.toCallerContext()` produces values through its existing, exported helper functions only. The mobile-side half of DT-013's Acceptance Criteria (a `LoginScreen` in `apps/mobile`) was completed the following sprint (Section 10.6).

### 10.6 `apps/mobile/src` Structure Extended for Login (Development Sprint 008)

Development Sprint 008 (DT-014) added one new file and extended two existing ones, verified by direct inspection:

```text
apps/mobile/src/
  screens/LoginScreen.tsx        (new)
  navigation/AppNavigator.tsx    (extended: single-screen -> Login -> Scan conditional render)
  screens/ScanScreen.tsx         (extended: now receives `caller: CallerContext` as a prop)
```

No new top-level grouping was added inside `apps/mobile/src` (still just `navigation/` and `screens/`), and no `ports/`, `infrastructure/`, or business-logic directory was introduced — `LoginScreen`'s only `@taptime/core` imports remain the public root export (`SessionService`, `toCallerContext`, `FakeAuthenticationGateway`, the `CallerContext` type), matching `ScanScreen`'s existing import discipline (Section 10.4). `packages/core/src/cli/runScan.ts` gained one new, optional parameter to `scan()` (Section 10.5's `SessionService`/`AuthenticationGateway`/`FakeAuthenticationGateway`/`AuthenticationResult` files are otherwise unchanged) — no new file was added to `packages/core` this sprint; the only `packages/core` change is the composition root's signature extension.
