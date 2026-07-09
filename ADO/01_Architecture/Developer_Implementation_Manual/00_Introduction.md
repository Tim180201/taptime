# EP-008 – Developer Implementation Manual

## Chapter 00 – Introduction

Status: Draft  
Document ID: EP-008-CH00  
Epic: EP-008  
Owner: Technical Lead  
Approval Authority: Human Architect  
Repository Scope: TapTim.e ADO  
Integration Status: Branch integration for Human Architect review  
Related Artifacts: Product Vision, Decision Log, AVR-001, ADRs, TTAP-001, Feature Blueprints, Technical Specifications, Development Task Profile, EOM-001, AGR-001

---

## 1. Purpose

This chapter introduces the TapTim.e Developer Implementation Manual.

EP-008 exists to help developers implement TapTim.e correctly from the approved engineering baseline. It is a practical implementation manual, not an architecture handbook and not a replacement for the Product Vision, Architecture Decision Records, Technical Architecture Profile, Feature Blueprints, Technical Specifications or Development Tasks.

The manual answers one operational question:

```text
How do developers build TapTim.e correctly from the approved repository knowledge?
```

The purpose of Chapter 00 is to establish how the manual shall be used, what authority it has, what it may explain and what it must not redefine.

A developer reading this chapter shall understand:

- where EP-008 belongs inside the TapTim.e ADO,
- which existing artifacts remain authoritative,
- how implementation guidance differs from architecture definition,
- how to use EP-008 during daily development,
- how to preserve traceability from source code back to approved engineering decisions,
- which boundaries prevent implementation work from drifting into architecture or product decision-making.

EP-008 turns approved engineering knowledge into implementable development guidance. It does not create new product intent, new architectural responsibilities, new feature behavior or new task scope.

---

## 2. Responsibilities

### 2.1 Responsibility of EP-008

EP-008 is responsible for implementation guidance.

It explains how developers should translate the approved TapTim.e engineering baseline into source code, tests, module boundaries, runtime behavior, adapters and implementation decisions.

EP-008 may define:

- implementation conventions derived from approved architecture,
- developer-facing rules for applying existing architecture,
- placement guidance for source code and tests,
- implementation patterns that preserve architectural intent,
- anti-patterns that would violate approved decisions,
- validation expectations for implementation work,
- traceability expectations from code to ADO artifacts,
- handover expectations for Development Agent work.

EP-008 may not define:

- product strategy,
- product vision,
- business scope,
- new feature behavior,
- new architecture,
- new ADRs,
- new technical specifications,
- new development tasks,
- new governance rules,
- new agent responsibilities.

### 2.2 Responsibility of Existing Artifacts

EP-008 depends on existing repository artifacts. Those artifacts retain their own responsibilities.

| Artifact Type | Responsibility | EP-008 Relationship |
|---|---|---|
| Product Vision | Defines why TapTim.e exists and what product intent it serves. | EP-008 must not reinterpret or expand it. |
| Decision Log | Records approved engineering and organizational decisions. | EP-008 references it for traceability. |
| AVR-001 | Records validation status of engineering artifacts. | EP-008 must respect validation state. |
| ADRs | Define durable architectural decisions. | EP-008 translates accepted decisions into implementation guidance. |
| TTAP-001 | Defines what the technical architecture is. | EP-008 explains how to implement according to it. |
| Feature Blueprints | Define what features do. | EP-008 may explain implementation handling but must not change behavior. |
| Technical Specifications | Define how specific features are implemented. | EP-008 must align with them and avoid duplication. |
| Development Tasks | Define assignable implementation work. | EP-008 supports task execution but does not create task scope. |
| EOM-001 | Defines engineering workflow and role responsibilities. | EP-008 follows it. |
| AGR-001 | Defines current agent role assignments. | EP-008 does not change them. |

### 2.3 Responsibility of Developers

Developers using EP-008 are responsible for implementing within the approved engineering boundaries.

A developer shall:

- verify the current repository state before implementation,
- read the relevant ADO artifacts before changing source code,
- use EP-008 as implementation guidance only,
- preserve boundaries defined by architecture and specifications,
- avoid inventing missing business rules,
- avoid deriving business meaning from UI, database or infrastructure details,
- keep implementation changes traceable to approved artifacts,
- escalate missing decisions instead of assuming them,
- create tests that verify behavior at the correct responsibility boundary.

A developer shall not:

- use EP-008 to bypass Feature Blueprints or Technical Specifications,
- treat example code as product behavior if the referenced specification does not define it,
- extend feature behavior without approval,
- place business interpretation into UI, persistence, synchronization or infrastructure adapters,
- create new architecture from implementation convenience.

---

## 3. Diagram

### 3.1 Manual Position in the ADO

```text
Product Vision
  -> Decision Log / ADRs
  -> Technical Architecture Profile
  -> Feature Blueprints
  -> Technical Specifications
  -> Development Tasks
  -> EP-008 Developer Implementation Manual
  -> Source Code / Tests / Evidence
```

EP-008 sits between approved engineering artifacts and implementation. It is downstream of architecture and upstream of source code.

### 3.2 Authority Flow

```text
Product Intent
  is defined by
Human Architect / Product Vision

Architecture
  is defined by
ADRs / TTAP / Technical Architecture artifacts

Feature Behavior
  is defined by
Feature Blueprints / Technical Specifications

Implementation Guidance
  is provided by
EP-008 Developer Implementation Manual

Implementation
  is produced by
Development Agent / Implementation Support Agent
```

No lower layer may redefine a higher layer.

Source code implements approved decisions. It must not silently replace them.

### 3.3 Daily Developer Use

```text
Start Development Task
  -> Identify related ADO artifacts
  -> Read EP-008 chapter for affected area
  -> Implement within approved boundaries
  -> Add tests at responsibility boundaries
  -> Record evidence
  -> Create role handover
```

EP-008 is intended to be used during implementation, not only during planning.

---

## 4. Dependencies

### 4.1 Required Repository Dependencies

Before using EP-008 for implementation, a developer shall identify the relevant source-of-truth artifacts for the task.

At minimum, a developer shall verify:

- the current repository branch,
- the current Decision Log status,
- relevant ADRs,
- relevant TTAP sections,
- relevant Feature Blueprint,
- relevant Technical Specification,
- related Development Tasks,
- applicable governance or operating model constraints.

EP-008 is valid only when used with the current repository baseline.

### 4.2 Implementation Dependency Rule

Implementation may begin only when the development task has enough approved context to answer:

```text
What behavior is being implemented?
Which component owns the behavior?
Which boundaries must not be crossed?
How will correctness be tested?
Which evidence must be produced?
```

If those questions cannot be answered from approved artifacts and EP-008 guidance, the developer must escalate the missing decision.

### 4.3 Dependency Priority

When documents appear to overlap, developers shall apply the following priority model:

1. Repository reality and current approved content.
2. Product Vision for product intent.
3. Decision Log and ADRs for durable decisions.
4. TTAP for technical architecture responsibilities.
5. Feature Blueprints for feature behavior.
6. Technical Specifications for implementation detail of approved features.
7. Development Tasks for assigned implementation scope.
8. EP-008 for implementation guidance.
9. Source code for current implementation state.

If source code conflicts with approved architecture or specifications, reality must be documented, but the conflict must not be treated as architectural approval.

### 4.4 Missing Dependency Rule

Missing repository evidence shall not be replaced by memory or assumptions.

When required context is missing, the developer shall document:

- what is missing,
- which artifact should own the missing information,
- why implementation cannot safely decide it,
- what temporary mitigation is possible without changing behavior,
- which role must resolve it.

---

## 5. Rules

### 5.1 Repository Before Assumptions

Developers shall verify repository evidence before implementing behavior.

Examples:

- Read the relevant Feature Blueprint before implementing a user action.
- Read the relevant Technical Specification before implementing event flow.
- Read the relevant ADR before changing a technology boundary.
- Read the Decision Log before relying on a decision status.

Do not implement from memory, previous chats or informal summaries when repository artifacts exist.

### 5.2 Continue, Never Recreate

Implementation shall continue the current repository baseline.

Developers shall avoid creating parallel concepts, duplicate abstractions or replacement structures when an approved concept already exists.

Before creating a new module, interface, event type, rule object or adapter, verify whether the repository already contains or defines an equivalent concept.

### 5.3 Extend Before Create

New implementation structures shall extend approved architecture instead of introducing unrelated alternatives.

A developer may create new implementation code only when it is traceable to:

- an approved Development Task,
- an approved Technical Specification,
- an approved Feature Blueprint,
- an approved architecture decision,
- or an explicitly approved corrective action.

### 5.4 Reality Has Priority Over Architecture

Actual repository state must be inspected before changes are made.

If the codebase does not yet match an approved artifact, the developer shall document the gap and implement the assigned step without pretending the gap does not exist.

Architecture guides implementation, but repository reality determines the actual starting point.

### 5.5 Implementation Guidance Does Not Redefine Architecture

EP-008 can say how to implement an approved architectural responsibility.

EP-008 cannot say that a responsibility belongs somewhere else.

Example:

```text
Allowed:
Implement business interpretation inside the Business Engine boundary.

Not allowed:
Move business interpretation into the mobile UI because it is easier.
```

### 5.6 Business Meaning Boundary

No UI, persistence, synchronization, transport, adapter or infrastructure component may determine business meaning.

Business interpretation belongs to the approved business decision boundary. Infrastructure may transport facts. UI may capture facts. Persistence may store facts and results. None of them may decide what those facts mean.

This rule is central to later EP-008 chapters, especially the Business Engine Foundation.

### 5.7 Examples Are Guidance, Not Scope

Examples in EP-008 are implementation guidance.

They are not new product behavior.

When an example appears to introduce behavior not defined by an approved Feature Blueprint or Technical Specification, the approved artifact wins and the example shall be treated as illustrative only.

---

## 6. Examples

### 6.1 Correct Use of EP-008

A developer receives a task to implement NFC scan handling.

Correct workflow:

1. Verify the current branch and repository state.
2. Read the relevant Feature Blueprint.
3. Read the relevant Technical Specification.
4. Read relevant ADRs and TTAP sections.
5. Read EP-008 chapters covering domain, business engine, application and mobile guidance.
6. Implement only the approved task scope.
7. Add tests for the business decision boundary and application flow.
8. Produce implementation evidence and role handover.

Incorrect workflow:

1. Inspect the current UI.
2. Infer business behavior from button labels.
3. Implement decision logic directly in a screen component.
4. Store derived business results without rule evaluation.
5. Claim the implementation follows architecture because it works locally.

### 6.2 Correct Handling of Missing Guidance

A developer cannot determine whether a scanned fact should be accepted, rejected or deferred.

Correct response:

```text
Escalate the missing rule.
Do not invent the rule inside implementation.
Add only the infrastructure needed to pass the fact to the correct decision boundary.
Document the blocker in the role handover.
```

Incorrect response:

```text
Choose the behavior that is easiest to implement.
Hard-code the decision in UI.
Treat the first implementation as the product rule.
```

### 6.3 Correct Traceability

An implementation commit should be explainable in terms of approved artifacts.

Good traceability statement:

```text
Implements the application boundary for NFC scan fact submission according to the approved NFC Feature Blueprint and Technical Specification. Business interpretation remains outside the UI and is delegated to the business decision boundary.
```

Weak traceability statement:

```text
Adds NFC scan logic.
```

The first statement explains what architectural boundary is preserved. The second only describes activity.

### 6.4 Correct Boundary Between Manual and Architecture

EP-008 may explain:

```text
Use a small application use case to pass a NfcTagScanned fact into the business decision boundary.
Keep the use case free of business interpretation.
```

EP-008 may not define:

```text
NFC scans are always accepted when the tag exists.
```

That behavior belongs to approved feature and technical specification artifacts.

---

## 7. Implementation Notes

### 7.1 How to Read EP-008

Developers should not read EP-008 as a standalone architecture source.

Use it as an implementation companion:

- read source-of-truth artifacts first,
- use EP-008 to understand implementation responsibilities,
- apply the relevant chapter to code placement and boundary decisions,
- validate implementation through tests and evidence.

### 7.2 How to Use EP-008 During Development

For every implementation task, identify the affected implementation area:

| Area | EP-008 Chapter |
|---|---|
| Repository and code organization | Chapter 02 – Repository Foundation |
| System/module structure | Chapter 03 – Solution Architecture |
| Domain concepts and value objects | Chapter 04 – Domain Foundation |
| Business decisions and rule evaluation | Chapter 05 – Business Engine Foundation |
| Use cases and application orchestration | Chapter 06 – Application Foundation |
| Persistence, adapters and integrations | Chapter 07 – Infrastructure Foundation |
| Mobile client implementation | Chapter 08 – Mobile Foundation |
| Readiness and validation | Chapter 09 – Implementation Readiness |
| Repository integration and review preparation | Chapter 10 – Repository Integration |

### 7.3 Testing Expectations

EP-008 expects tests to verify behavior at the responsibility boundary where the behavior belongs.

Examples:

- Business decisions should be tested at the business decision boundary.
- Application orchestration should be tested at the use-case boundary.
- Infrastructure adapters should be tested for mapping and integration behavior, not business interpretation.
- UI should be tested for input capture, feedback and flow, not business meaning.

### 7.4 Error Handling Expectations

Implementation shall classify errors according to responsibility.

Examples:

- Invalid input shape is an input validation concern.
- Missing local data may be an application or infrastructure concern.
- Business rejection is not an infrastructure error.
- Synchronization delay is not a business rule failure.
- Unknown business meaning is a missing decision and shall be escalated.

### 7.5 Repository Placement Expectations

EP-008 does not define final folder names unless already approved by repository architecture.

However, it does require that source code placement reflect responsibility:

- domain concepts belong in the domain area,
- business decision rules belong in the business decision boundary,
- application orchestration belongs in the application area,
- infrastructure adapters belong in infrastructure,
- mobile presentation belongs in the mobile layer.

When the repository structure already defines exact locations, follow repository reality. When it does not, propose a placement through the approved engineering workflow rather than creating an untraceable structure.

### 7.6 Handover Expectations

Development work using EP-008 shall produce a role handover that includes:

- implemented scope,
- changed files,
- related ADO artifacts,
- tests performed,
- known deviations,
- unresolved questions,
- evidence produced,
- next responsible role.

This preserves the Engineering Operating Model and prevents context loss between roles.

---

## 8. Engineering Decision

### 8.1 Decision Statement

EP-008 is adopted as a Developer Implementation Manual for TapTim.e.

It provides implementation guidance derived from approved repository artifacts. It is not a source of product intent, architecture definition, feature behavior, technical specification or development task scope.

### 8.2 Rationale

TapTim.e now has an Engineering System and Product Architecture Foundation. Developers require a practical bridge between approved architecture and source code.

Without EP-008, implementation work risks:

- duplicating architecture inside code,
- interpreting product behavior from incomplete context,
- moving business meaning into UI or infrastructure,
- implementing features without traceability,
- creating inconsistent module boundaries,
- producing code that works locally but violates approved architecture.

EP-008 reduces those risks by giving developers actionable implementation guidance while preserving the authority of existing ADO artifacts.

### 8.3 Consequences

Developers shall use EP-008 as implementation guidance during development.

Technical Lead shall maintain EP-008 alignment with repository artifacts.

Review Agent shall review implementation against source-of-truth artifacts and may use EP-008 as supporting implementation guidance, but EP-008 does not replace review against approved architecture, Feature Blueprints or Technical Specifications.

Human Architect approval is required before EP-008 becomes accepted repository baseline.

### 8.4 Non-Decisions

This chapter does not decide:

- final runtime architecture,
- final source folder structure,
- final framework choices,
- feature behavior,
- database schema,
- synchronization protocol,
- UI behavior,
- deployment model.

Those decisions belong to existing or future approved artifacts.

---

## 9. Summary

EP-008 is the implementation bridge between TapTim.e engineering decisions and source code.

It helps developers build correctly without redefining the product or architecture.

The manual shall be used with the repository as the source of truth. Developers must verify relevant ADO artifacts, preserve responsibility boundaries, avoid assumptions and produce traceable implementation evidence.

Chapter 00 establishes the rules for using the manual. Later chapters provide practical guidance for repository structure, solution architecture, domain implementation, business decision handling, application orchestration, infrastructure, mobile implementation, readiness and repository integration.

The key rule for developers is:

```text
Implement approved decisions. Do not invent missing ones.
```

EP-008 is successful only when it enables developers to implement TapTim.e correctly while keeping Product Vision, architecture, feature behavior, technical specifications, development tasks and governance in their proper source-of-truth artifacts.

---

## 10. Implemented Reality (EP-008 Synchronization Update)

### 10.1 Verification Basis

This section was added as part of an EP-008 Synchronization Update and has since been extended repeatedly, most recently to cover Development Sprint 019. It reflects repository evidence verified on 2026-07-09 against `main` at commit `72e45f5` (DT-026: Existing Scan Pipeline Integration Verification, Development Sprint 019), preceded by `2c9cdab` (DT-025, Development Sprint 018), `eee9151` (DT-024, Development Sprint 017), `5f95573` (DT-023, Development Sprint 016), `7db5ade` (DT-020/DT-021/DT-022, Development Sprint 015), `874ecaf` (DT-019, Development Sprint 014), `b24144d` (Development Sprint 013), `5be51b5` (Development Sprint 012), `c5bae77` (Development Sprint 011), `7bea186` (Development Sprint 010), `77fa0c2` (Development Sprint 009), `740379f`/`6898a46` (Development Sprint 008), `d0167c4`/`ebce0c0` (Development Sprint 007), `2c79f45`/`f088e6b` (Development Sprint 005/006 governance closures), `43a628e`/`7fbc96e` (Development Sprint 006), and, further back, `e19de60` (Development Sprint 004), `03c04bd`/`90fdea8` (Development Sprint 003), `78be5c9` (Development Sprint 002) and `159d7f9` (Development Sprint 001). It does not restate Development Task detail; it points to the artifacts that own that detail.

### 10.2 Current Implementation Status

| Development Task | Sprint | Status per `EP-007_Development_Tasks.md` |
|---|---|---|
| DT-001 NFC Scan Adapter | Development Sprint 001 | Completed — Review Agent verified, Human Architect approved |
| DT-002 Assignment Resolver | Development Sprint 001 | Completed — Review Agent verified, Human Architect approved |
| DT-003 Assignment Validator | Development Sprint 001 | Completed — Review Agent verified, Human Architect approved |
| DT-004 WorkEvent Factory | Development Sprint 002 | Implemented and committed (`78be5c9`); no Review Agent/Human Architect approval recorded yet |
| DT-005 TimeEntry Generator | Development Sprint 002 | Partially implemented (deterministic branch only, gated by Finding F-01 for the remainder); no approval recorded yet |
| DT-006 Repository Layer | Development Sprint 002 | In-memory slice implemented; no approval recorded yet |
| DT-007 Offline Queue | Development Sprint 003 | Completed — Review Agent verified (one mechanical finding, corrected), Human Architect approved |
| DT-008 Synchronization Service | Development Sprint 004 | Implemented and committed (`e19de60`), typecheck clean, 53 tests pass; no Review Agent verification or Human Architect approval recorded yet — see Section 10.6 |
| DT-009 Error Handling | Development Sprint 009 | Completed — Review Agent verified, Human Architect approved (2026-07-07); `ErrorCategory` + five classification functions + `ScanResultPresenter` extension — see Section 10.11 |
| DT-010 | Not started | No implementation notes recorded |
| DT-011 Real Scan Composition Root & Result Presentation | Development Sprint 005 | Completed — Review Agent verified, Human Architect approved (2026-07-06) — narrative still not synchronized into this EP-008 chapter set, see Section 10.8 |
| DT-012 Mobile Application Foundation | Development Sprint 006 | Completed — Review Agent verified, Human Architect approved (2026-07-06) — see Section 10.7 (Resolved) |
| DT-013 Authentication & Session Foundation | Development Sprint 007 | Completed — Review Agent verified, Human Architect approved (2026-07-06); full Acceptance Criteria now satisfied across DT-013 + DT-014 together — see Section 10.9 (Resolved) |
| DT-014 Mobile Session Integration | Development Sprint 008 | Completed — Review Agent verified, Human Architect approved (2026-07-06); `LoginScreen`, `AppNavigator` Login → Scan flow, `runScan.ts` external-`CallerContext` support — see Section 10.10 |
| DT-015 Local Persistence Foundation | Development Sprint 010 | Completed — Review Agent verified, Human Architect approved (2026-07-07); `JsonFileStore` + `FileOfflineQueue`/`FileWorkEventRepository`/`FileTimeEntryRepository` + `runScan.ts`/`runScanCli.ts` split — see Section 10.12 |
| DT-016 Real NFC Hardware Integration | Development Sprint 011 | Completed — Review Agent verified, Human Architect approved (2026-07-07), **physical-device validation still outstanding**; `RnNfcScanAdapter` (`react-native-nfc-manager`), wired into `ScanScreen.tsx` — see Section 10.13 |
| DT-017 Organization Domain & Repository | Development Sprint 012 | Completed — Review Agent verified, Human Architect approved (2026-07-08); `Organization`, `OrganizationCreated`, `OrganizationRepository`, `InMemoryOrganizationRepository`, `OrganizationManagementService` — see Section 10.14 |
| DT-018 Membership Domain & Repository | Development Sprint 013 | Completed — Review Agent verified, Human Architect approved (2026-07-08); `MembershipId`, `MembershipRole`, `Membership`, `MembershipGranted`, `MembershipRepository`, `InMemoryMembershipRepository`, `MembershipService` — see Section 10.15 |
| DT-019 Membership Authorization Validator | Development Sprint 014 | Completed — Review Agent verified, Human Architect approved (2026-07-08); `MembershipAuthorizationResult`, `MembershipAuthorizationValidator` (no caller wired yet) — see Section 10.16 |
| DT-020 Customer Repository Write Extension | Development Sprint 015 | Completed — Review Agent verified, Human Architect approved (2026-07-08); `CustomerRepository.save`, `InMemoryCustomerRepository` updated, `CustomerCreated` (no caller wired yet) — see Section 10.17 |
| DT-021 NFC Tag Repository Write Extension | Development Sprint 015 | Completed — Review Agent verified, Human Architect approved (2026-07-08); `NfcTagRepository.register`, `InMemoryNfcTagRepository` updated, `NfcTagRegistered` (no caller wired yet) — see Section 10.17 |
| DT-022 NFC Assignment Repository Write Extension | Development Sprint 015 | Completed — Review Agent verified, Human Architect approved (2026-07-08); `NfcAssignmentRepository.save`, `InMemoryNfcAssignmentRepository` updated, `NfcTagAssigned` (no caller wired yet) — see Section 10.17 |
| DT-023 Organization Administration: Customer Registration | Development Sprint 016 | Completed — Review Agent verified, Human Architect approved (2026-07-09); `OrganizationAdministrationService.createCustomer(...)` (no caller wired yet) — see Section 10.18 |
| DT-024 Organization Administration: NFC Tag Registration | Development Sprint 017 | Completed — Review Agent verified, Human Architect approved (2026-07-09); `OrganizationAdministrationService.registerNfcTag(...)` (no caller wired yet); one disclosed mid-sprint constructor-arity correction, independently re-verified resolved — see Section 10.19 |
| DT-025 Organization Administration: NFC Tag Assignment | Development Sprint 018 | Completed — Review Agent verified, Human Architect approved (2026-07-09); `OrganizationAdministrationService.assignNfcTag(...)` (no caller wired yet); completes the three-method service TS-002 planned; constructor-arity discipline correctly applied, independently re-verified — see Section 10.20 |
| DT-026 Existing Scan Pipeline Integration Verification | Development Sprint 019 | Completed — Review Agent verified, Human Architect approved (2026-07-09); `OrganizationOwnedScanPipeline.test.ts` (2 new composition-level tests, zero production code added or modified); completes the DT-017–DT-026 TS-002 Organization Management Foundation Development Task sequence — see Section 10.21 |

The authoritative record for this table is `ADO/02_Development/EP-007_Development_Tasks.md`. This chapter does not duplicate its Acceptance Criteria; it only orients the developer to what "implemented reality" currently covers.

### 10.3 What "Implemented Reality" Currently Means for EP-008

Chapters 00–03 now include, in addition to implementation philosophy and architecture guidance, sections describing how DT-001 through DT-004 (and the in-scope part of DT-005/DT-006), DT-007, and now DT-008, were actually built in `packages/core`. Chapters 04–10 (Domain Foundation through Repository Integration) do not exist yet; the chapter mapping table in Section 7.2 is unchanged and still describes planned scope for those chapters, not implemented content.

### 10.4 Open Governance Note (Escalated, Not Resolved Here)

`ADO/00_Core/Decision_Log.md` currently records `DEV-SPRINT-002` as status "Planned", even though Development Sprint 002 code is already committed to `main` at `78be5c9`. This is a repository-reality/Decision-Log mismatch (EP-008 Ch01 §5.4, Reality Has Priority Over Architecture). It is noted here as a finding for Technical Lead/Human Architect action; it was not corrected during the Sprint 003 or Sprint 004 governance closures, since both were explicitly scoped to Sprint 003/Sprint 004 respectively, not Sprint 002.

### 10.5 Second Open Governance Note (Development Sprint 003) — Resolved

`ADO/02_Development/EP-007_Development_Tasks.md`'s DT-007 section previously carried a "Development Sprint 003 Implementation Notes" subsection with no completion status line, and the Decision Log had no `DEV-SPRINT-003` row. This was resolved during the Development Sprint 003 Governance Closure: DT-007 now carries "Status: Completed — Review Agent verified (one mechanical finding, corrected), Human Architect approved", and `DEV-SPRINT-003` is recorded in the Decision Log as Completed. Retained here for traceability of how the gap was closed.

### 10.6 Third Open Governance Note (Development Sprint 004, Not Yet Resolved)

Unlike Development Sprint 003, Development Sprint 004 has **not** been asserted as reviewed or approved at the time of this EP-008 update. Repository evidence (verified by direct search) shows: DT-008 in `EP-007_Development_Tasks.md` carries a "Status: Implemented and committed... pending Review Agent verification and Human Architect approval" line — not "Completed" — and the Decision Log's `DEV-SPRINT-004` row is marked "Implemented — Pending Review", not "Completed". This is deliberate: the task that produced this EP-008 update explicitly asked that the repository be prepared for an independent Review Agent review, not that the review be performed or assumed. This EP-008 update therefore documents DT-008's implementation as repository reality (it exists, typechecks, and is tested) without asserting a review/approval status that repository evidence does not yet support.

### 10.7 Fourth Open Governance Note (Development Sprint 006) — Resolved

Development Sprint 006 (DT-012) was originally recorded here as "Implemented — Pending Review", with an explicit environment constraint (no iOS/Android simulator or device available to manually verify launch). This was resolved during the Development Sprint 005 & 006 Governance Closure: the Technical Lead recorded that an independent Review Agent approved both sprints, and DT-012 now carries "Status: Completed — Review Agent verified, Human Architect approved (2026-07-06)" in `EP-007_Development_Tasks.md`, with `DEV-SPRINT-006` recorded as "Completed" in the Decision Log. The previously-recorded lack of simulator/device verification remains an accurate historical implementation note but no longer blocks Completed status, per the recorded review. Retained here for traceability of how the gap was closed.

### 10.8 Fifth Open Governance Note (Development Sprint 005 Narrative Gap, Carried Forward — Status Corrected, Narrative Still Outstanding)

Development Sprint 005 (DT-011: composition root and `ScanResultPresenter`) was implemented and is reflected in Section 10.2's status table. Its **governance status** was corrected during the Development Sprint 005 & 006 Governance Closure (DT-011 now "Completed — Review Agent verified, Human Architect approved", `DEV-SPRINT-005` now "Completed" in the Decision Log). Its **implementation narrative**, however, was never synchronized into Chapters 00–03's "Implemented Reality" sections — the last full narrative synchronization before this update was Development Sprint 004 (Sections 10.1–10.6 above; Chapter 03 Sections 10.1–10.28), extended for Sprint 006's Mobile Foundation only. This Sprint 007 closure is explicitly scoped to synchronizing the Authentication Foundation only (Section 10.9); it does not retroactively add Sprint 005's composition-root narrative. This remains a pre-existing, carried-forward finding for a future EP-008 update — status and narrative are tracked separately here precisely so this distinction stays visible rather than being conflated.

### 10.9 Sixth Open Governance Note (Development Sprint 007, Narrowed Scope) — Resolved

Development Sprint 007 (DT-013: Authentication & Session Foundation) was originally implemented for a Human-Architect-narrowed scope only (`AuthenticationGateway`, `FakeAuthenticationGateway`, `SessionService`, `AuthenticationResult` in `packages/core`; commit `ebce0c0`), with its mobile `LoginScreen` and composition-root wiring explicitly deferred. This was resolved during the Development Sprint 008 Governance Closure: Development Sprint 008 (DT-014, Section 10.10) implemented exactly that deferred scope, an independent Review Agent approved it, and DT-013's Status line in `EP-007_Development_Tasks.md` now records that its full Acceptance Criteria are satisfied across both Development Tasks together. Retained here for traceability of how the gap was closed.

### 10.10 Seventh Open Governance Note (Development Sprint 008, Mobile Session Integration) — Resolved at Governance Level; Manual Launch Verification Still Outstanding

Development Sprint 008 (DT-014) implemented the mobile-facing half of authentication deferred by Sprint 007: `LoginScreen` in `apps/mobile`, an `AppNavigator` Login → Scan flow, and a `runScan.ts` extension accepting an externally-produced `CallerContext` (commit `6898a46`). An independent Review Agent approved this sprint, and the Technical Lead authorized recording DT-014 and `DEV-SPRINT-008` as "Completed" in `EP-007_Development_Tasks.md`/`Decision_Log.md`. As with Sprint 006/007, no iOS/Android simulator or device was available in the environment that built this sprint, so on-device launch of the Login → Scan flow could not be manually verified there; this remains an accurate historical implementation note (Chapter 03 Section 10.44) but, consistent with the precedent set for DT-012, no longer blocks Completed status once Review Agent verification is recorded.

### 10.11 Eighth Open Governance Note (Development Sprint 009, Error Handling) — Resolved

Development Sprint 009 (DT-009) implements a Development Task that has existed in `EP-007_Development_Tasks.md`'s original task sequence since EP-007 was established, but was never started until this sprint (commit `77fa0c2`): a shared `ErrorCategory` type and five pure classification functions mapping every existing result/outcome type onto TTAP-001's Runtime Architecture error taxonomy ("recoverable, retryable, deferred, conflict or fatal"), plus an additive `ScanResultPresenter` extension surfacing the classification alongside its existing rendered messages. An independent Review Agent approved this sprint, and the Technical Lead authorized recording DT-009 and `DEV-SPRINT-009` as "Completed". Unlike DT-012/DT-013/DT-014, no simulator/device or environment constraint applies here — DT-009 is a pure, unit-testable `packages/core` change with no mobile-launch dependency; all 127 `packages/core` tests pass and no business/application logic that produces the classified result types was modified (verified by diff). This closes the last Development Task in the DT-001–DT-014 sequence that was both fully unblocked (no undecided technology, no Finding F-01 dependency) and still unstarted.

### 10.12 Ninth Open Governance Note (Development Sprint 010, Local Persistence Foundation) — Resolved

Development Sprint 010 (DT-015) implements durable, file-based adapters for the existing `OfflineQueue`, `WorkEventRepository` and `TimeEntryRepository` ports (commit `7bea186`): a shared, dependency-free `JsonFileStore` helper, and `FileOfflineQueue`/`FileWorkEventRepository`/`FileTimeEntryRepository`, each matching its in-memory counterpart's exact behavioral contract. This closes the local half of ADR-0004's Implementation Rule ("must include a local event queue or equivalent offline-capable mechanism before production release") without requiring the still-undecided cloud/backend persistence technology decision — ADR-0007 lists local offline-capable persistence and backend/cloud persistence as separate baseline components. An independent Review Agent approved this sprint, and the Technical Lead authorized recording DT-015 and `DEV-SPRINT-010` as "Completed". As with DT-009, no simulator/device or environment constraint applies: DT-015 is a pure `packages/core` change, verified by 154 passing `packages/core` tests (127 pre-existing + 27 new) and by manual cross-process durability verification (Chapter 03 Section 10.55). A Metro-bundling regression discovered mid-implementation (Node's `fs`/`path` are not resolvable by React Native/Hermes, and `runScan.ts` is part of `apps/mobile`'s static import graph) was corrected by keeping `runScan.ts` interface-typed only and moving `fs`/`path`-dependent construction into a new, Node-only `runScanCli.ts` — see Chapter 03 Section 10.54 for detail. Cloud/backend persistence technology and mobile-native on-device storage (`expo-sqlite`/`AsyncStorage`) both remain explicitly deferred, proposed follow-up work, not attempted this sprint.

### 10.13 Tenth Open Governance Note (Development Sprint 011, Real NFC Hardware Integration) — Resolved at Governance Level; Physical-Device Validation Still Outstanding

Development Sprint 011 (DT-016) implements a real, hardware-backed `NfcScanPort` adapter (`RnNfcScanAdapter`, commit `c5bae77`) using `react-native-nfc-manager`, wired into `apps/mobile`'s `ScanScreen.tsx` as the primary scan trigger, replacing the Development Sprint 006 placeholder text-input. This is the first Development Sprint planned directly against EP-009's Product Readiness priorities (`ADO/02_Development/EP-009_Product_Readiness_Framework.md`): repository evidence (`Product_Readiness_Assessment.md` Section 11.1) had identified Organization Management as the higher-ranked Product Readiness priority, but no Feature Blueprint exists for it, so this sprint correctly selected the next Roadmap item this repository's existing Product Vision -> Feature Blueprint -> Technical Specification -> Development Task order already permits — see `Development_Sprint_011_Plan.md` Section 3 for the full reasoning. An independent Review Agent approved this sprint, and the Technical Lead authorized recording DT-016 and `DEV-SPRINT-011` as "Completed." As with DT-012/DT-006/DT-008/DT-014, **physical Android device/NFC-tag validation could not be performed in this environment** (no simulator or physical NFC-capable device available) and remains an explicit, disclosed outstanding item — this does not block Completed status per the recorded review, but it does mean DT-016 is structurally, not yet functionally, proven, and closing this gap is the recommended immediate priority before further code-implementation Development Sprint work (`Development_Sprint_011_Closure.md`, Next Sprint Recommendation).

### 10.14 Eleventh Open Governance Note (Development Sprint 012, Organization Domain & Repository) — Resolved

Development Sprint 012 (DT-017) implements the first Organization Management Development Task: `Organization` as a real domain object, `OrganizationCreated` (a new domain event), an `OrganizationRepository` port with `InMemoryOrganizationRepository`, and an `OrganizationManagementService` exposing `createOrganization(name)` (commit `5be51b5`). Unlike DT-015/DT-016, which extended or swapped an adapter behind an already-approved port, DT-017 had no pre-existing Organization-related code to extend — it is the first Development Task to build a new domain/port/service triad entirely from nothing, and does so following the exact idioms already established elsewhere in the repository (`InMemoryCustomerRepository`'s constructor-seeded pattern, `WorkEventCreated`'s constructor-function event idiom, `WorkEventFactory`/`BusinessEngine`'s injectable-dependency constructor pattern). It implements only Capability 1 of FB-002/TS-002 (Organization Management Foundation) — no Membership, no Administration, and no change to the existing NFC scan pipeline, all of which are confirmed unchanged by direct inspection. An independent Review Agent approved this sprint, and the Technical Lead authorized recording DT-017 and `DEV-SPRINT-012` as "Completed." Unlike DT-016, DT-017 carries no simulator/device or environment constraint — it is a pure, unit-testable `packages/core` change; all 164 `packages/core` tests pass (154 pre-existing + 10 new) and typecheck is clean. DT-018 through DT-026 (Membership, `MembershipAuthorizationValidator`, the three repository write extensions, `OrganizationAdministrationService`, and scan-pipeline integration verification) remain entirely unstarted, as does the Membership-granting bootstrap question TS-002 surfaced and left open (`Development_Sprint_012_Closure.md`, Known Remaining Risks).

### 10.15 Twelfth Open Governance Note (Development Sprint 013, Membership Domain & Repository) — Resolved

Development Sprint 013 (DT-018) implements the second Organization Management Development Task: `MembershipId` (a new branded identifier), `MembershipRole` (a new value type, `'administrator' | 'employee'`), `Membership` (a new domain object carrying its own identity plus `organizationId`/`userId`/`role`, following ADR-0002's `NfcAssignment` association-identity precedent), `MembershipGranted` (a new domain event), a `MembershipRepository` port with `InMemoryMembershipRepository`, and a `MembershipService` exposing `grantMembership(organizationId, userId, role)` (commit `b24144d`). Like DT-017, DT-018 builds a new domain/port/service triad following the exact idioms DT-017 itself established one sprint ago (now the nearer precedent than the original DT-001–DT-016 idioms). It implements only the Membership foundation of FB-002/TS-002 Capability 2 — deliberately narrower than TS-002's own Sequence Diagram 2, which shows `MembershipService` delegating to `MembershipAuthorizationValidator`: that validator does not exist yet (DT-019), so `MembershipService.grantMembership(...)` here performs no authorization check and no first-Administrator bootstrap special-casing, both confirmed not just by code inspection but by two dedicated tests proving the absence of that behavior. An independent Review Agent approved this sprint, and the Technical Lead authorized recording DT-018 and `DEV-SPRINT-013` as "Completed." Like DT-017, DT-018 carries no simulator/device or environment constraint; all 175 `packages/core` tests pass (164 pre-existing + 11 new) and typecheck is clean. `Organization`/`OrganizationManagementService` (DT-017) are confirmed byte-for-byte unchanged, consumed only via the `OrganizationId` type. DT-019 through DT-026 remain entirely unstarted, as does the Membership-granting bootstrap question (`Development_Sprint_013_Closure.md`, Known Remaining Risks).

### 10.16 Thirteenth Open Governance Note (Development Sprint 014, Membership Authorization Validator) — Resolved

Development Sprint 014 (DT-019) implements the third Organization Management Development Task: `MembershipAuthorizationResult` (a new discriminated-union result type, mirroring `AssignmentValidationResult`'s shape exactly) and `MembershipAuthorizationValidator` (a new Business-area class exposing a single `authorize(membership, organizationId)` method), commit `874ecaf`. Unlike DT-017/DT-018, which each built a domain/port/adapter/service triad, DT-019 builds a single, standalone Business-area component with no repository, port, or Application Service dependency at all — a deliberate divergence from `AssignmentValidator`'s own constructor, which is injected with a `CustomerRepository`: DT-019's Acceptance Criteria explicitly require "no dependency on any repository directly inside its own decision logic," since its inputs (`Membership`, target `OrganizationId`) are passed in already resolved by a future caller. The validator answers exactly one question — may this Membership perform an administrative action for this Organization? — via three rejection reasons (`membership_not_found`, `membership_lacks_administrator_role`, `cross_organization_access`) plus an accepted case, exactly as FB-002 Decision 6/TS-002's New Business-Area Component section specify. It is not wired into `MembershipService` or any other Application Service, resolves no first-Administrator bootstrap question, and has no caller anywhere in the repository after this sprint — confirmed both by code inspection and by a dedicated test proving no bootstrap special-casing exists. An independent Review Agent approved this sprint, and the Technical Lead authorized recording DT-019 and `DEV-SPRINT-014` as "Completed." Like DT-017/DT-018, DT-019 carries no simulator/device or environment constraint; all 181 `packages/core` tests pass (175 pre-existing + 6 new) and typecheck is clean. `AssignmentValidator`, `MembershipService`, and `OrganizationManagementService` are all confirmed byte-for-byte unchanged. DT-020 through DT-026 remain entirely unstarted, as does the Membership-granting bootstrap question (`Development_Sprint_014_Closure.md`, Known Remaining Risks).

### 10.17 Fourteenth Open Governance Note (Development Sprint 015, Repository Write Extensions) — Resolved

Development Sprint 015 (DT-020, DT-021, DT-022) implements the fourth Organization Management Development step, and the first to bundle three Development Tasks into one sprint: `CustomerRepository.save`, `NfcTagRepository.register`, and `NfcAssignmentRepository.save`, each an additive write method on an existing, previously read-only port; `InMemoryCustomerRepository`, `InMemoryNfcTagRepository`, and `InMemoryNfcAssignmentRepository` each implement their new method and are upgraded to the defensive-copy constructor pattern `InMemoryOrganizationRepository`/`InMemoryMembershipRepository` already established; `CustomerCreated`, `NfcTagRegistered`, and `NfcTagAssigned` are added, each following the existing constructor-function event idiom exactly — commit `7db5ade`. Unlike DT-017/DT-018/DT-019, which each built new files from nothing, DT-020/DT-021/DT-022 each extend an already-existing port/adapter pair — the same "Extend Before Create" discipline applied to code that was already present since Development Sprint 001, rather than to a sibling precedent from an earlier Organization Management sprint. Bundling was justified and independently re-verified: `git diff --stat` against the pre-Sprint-015 commit confirms the three tasks touch entirely disjoint file sets, with `AssignmentResolver`, `AssignmentValidator`, and both of their test files confirmed byte-for-byte unchanged. An independent Review Agent approved this sprint, and the Technical Lead authorized recording DT-020, DT-021, DT-022, and `DEV-SPRINT-015` as "Completed." Like DT-017/DT-018/DT-019, this sprint carries no simulator/device or environment constraint; all 197 `packages/core` tests pass (181 pre-existing + 16 new, the first-ever dedicated test files for these three repositories) and typecheck is clean; `apps/mobile` remains untouched (10/10 tests still pass). None of the three new write methods has a caller anywhere in the repository after this sprint. DT-023 through DT-026 remain entirely unstarted, as does the Membership-granting bootstrap question and FB-002's remaining Open Questions on assignment/reassignment/collision semantics (`Development_Sprint_015_Closure.md`, Known Remaining Risks).

### 10.18 Fifteenth Open Governance Note (Development Sprint 016, Organization Administration: Customer Registration) — Resolved

Development Sprint 016 (DT-023) implements the fifth Organization Management Development step, and the first Application Service orchestration step for Organization Management: `OrganizationAdministrationService` (`packages/core/src/application/OrganizationAdministrationService.ts`), created for the first time, with exactly one method, `createCustomer(membership, organizationId)` — commit `5f95573`. Unlike `OrganizationManagementService`/`MembershipService`, which each construct-and-save with no authorization step, `createCustomer(...)` is the first Organization Management Application Service method to orchestrate a Business-area validator (`MembershipAuthorizationValidator`, DT-019) together with a repository write (`CustomerRepository.save`, DT-020) in one method: it calls `authorize(...)` first, returns the rejection unchanged and performs no write on rejection, and on acceptance constructs a `Customer` (`organizationId` sourced from the accepted Membership's own Organization), saves it, and produces `CustomerCreated`. `CreateCustomerResult` reuses `RejectedMembershipAuthorizationResult` verbatim for every rejection, adding only a new accepted variant — an evidence-based design choice traced to TS-002 Sequence Diagram 3, not an invented result category. An independent Review Agent approved this sprint, and the Technical Lead authorized recording DT-023 and `DEV-SPRINT-016` as "Completed." Like DT-017 through DT-022, this sprint carries no simulator/device or environment constraint; all 203 `packages/core` tests pass (197 pre-existing + 6 new) and typecheck is clean; `apps/mobile` remains untouched (10/10 tests still pass). `MembershipAuthorizationValidator`, `MembershipAuthorizationResult`, `Membership`, `MembershipRole`, `Customer`, `CustomerCreated`, `CustomerRepository`, `InMemoryCustomerRepository`, `OrganizationManagementService`, `MembershipService`, `AssignmentResolver`, and `AssignmentValidator` are all confirmed byte-for-byte unchanged. `registerNfcTag(...)` and `assignNfcTag(...)` do not exist; `createCustomer(...)` has no caller anywhere in the repository outside its own test file. DT-024 through DT-026 remain entirely unstarted, as does the Membership-granting bootstrap question (`Development_Sprint_016_Closure.md`, Known Remaining Risks).

### 10.19 Sixteenth Open Governance Note (Development Sprint 017, Organization Administration: NFC Tag Registration) — Resolved

Development Sprint 017 (DT-024) implements the sixth Organization Management Development step, and the second method on `OrganizationAdministrationService`: `registerNfcTag(membership, organizationId, payload)` — commit `eee9151`. Its orchestration mirrors `createCustomer(...)`'s (DT-023) exactly: it calls `authorize(...)` first, returns the rejection unchanged and performs no write on rejection, and on acceptance constructs an `NfcTag` (`organizationId` sourced from the accepted Membership's own Organization, `payload` taken from the already-normalized `NfcPayload` argument unchanged), calls `NfcTagRepository.register`, and produces `NfcTagRegistered`. `RegisterNfcTagResult` reuses `RejectedMembershipAuthorizationResult` verbatim, the same evidence-based design DT-023 established, now traced to TS-002 Sequence Diagram 4. **Disclosed mid-sprint correction:** an independent Review Agent found a real constructor-arity regression in the first implementation pass — a required `NfcTagRepository` parameter inserted after a defaulted `newCustomerId` parameter, which compiles but silently breaks positional 3-argument calls to the constructor, invisible to `npm run typecheck` because `packages/core/tsconfig.json`'s `"include": ["src"]` does not cover `tests/`, and invisible to `npm run test` because Vitest's esbuild transpilation does not type-check. A corrective Development Agent Prompt specified reordering the constructor (all required dependencies before all defaulted id generators, matching `OrganizationManagementService`'s/`MembershipService`'s existing idiom) plus the corresponding test call-site updates; commit `eee9151` already contains the corrected order, confirmed by direct inspection and by an out-of-band tests-inclusive `tsc --noEmit` run showing zero errors in `OrganizationAdministrationService.test.ts`. An independent Review Agent approved this sprint following that correction, and the Technical Lead authorized recording DT-024 and `DEV-SPRINT-017` as "Completed." Like DT-017 through DT-023, this sprint carries no simulator/device or environment constraint; all 210 `packages/core` tests pass (203 pre-existing + 7 new) and typecheck is clean; `apps/mobile` remains untouched (10/10 tests still pass). `MembershipAuthorizationValidator`, `MembershipAuthorizationResult`, `Membership`, `NfcTag`, `NfcPayload`, `NfcTagRegistered`, `NfcTagRepository`, `InMemoryNfcTagRepository`, `CustomerRepository`, `InMemoryCustomerRepository`, `AssignmentResolver`, and `AssignmentValidator` are all confirmed byte-for-byte unchanged. `assignNfcTag(...)` does not exist; `registerNfcTag(...)` has no caller anywhere in the repository outside its own test file. DT-025 and DT-026 remain entirely unstarted, as does the Membership-granting bootstrap question and `packages/core/tsconfig.json`'s standing `tests/`-typecheck-coverage gap (`Development_Sprint_017_Closure.md`, Known Remaining Risks, Lessons Learned).

### 10.20 Seventeenth Open Governance Note (Development Sprint 018, Organization Administration: NFC Tag Assignment) — Resolved

Development Sprint 018 (DT-025) implements the seventh Organization Management Development step, and the third and final method on `OrganizationAdministrationService` — commit `2c9cdab`. `assignNfcTag(membership, organizationId, nfcTag, target)` completes the three-method service TS-002 planned in full: it calls `authorize(...)` first, returns the rejection unchanged and performs no write on rejection, and on acceptance performs two additional same-Organization checks before any write — the supplied `NfcTag`'s own `organizationId` is compared directly against the accepted Membership's Organization (no repository call, since the `NfcTag` is accepted as an already-resolved value), and the supplied `AssignmentTarget`'s owning `Customer` is resolved via `CustomerRepository.findById(...)` (reusing `AssignmentValidator`'s own existing cross-check pattern) and its `organizationId` compared the same way, with a not-found `Customer` treated identically to an organization mismatch. Only if both checks pass does it construct an `NfcAssignment`, call `NfcAssignmentRepository.save`, and produce `NfcTagAssigned`. `AssignNfcTagResult` reuses `RejectedMembershipAuthorizationResult` verbatim — including for the missing-target case, a disclosed planning finding (`Development_Sprint_018_Plan.md` Section 8) resolved by treating "not found" and "wrong Organization" identically, since `MembershipAuthorizationResult` has no distinct "not found" category and FB-002 Decision 5 itself names only two outcomes. **Constructor-arity discipline correctly applied**: the constructor gained a fourth required dependency (`NfcAssignmentRepository`) and a third defaulted id generator (`newNfcAssignmentId`), with all four required dependencies positioned before all three defaults — exactly the fix `Development_Sprint_017_Closure.md`'s own disclosed regression established, applied deliberately this time (the plan specified the exact signature verbatim) and independently re-confirmed by this sprint's own out-of-band tests-inclusive typecheck showing zero `OrganizationAdministrationService`-related errors. An independent Review Agent approved this sprint, and the Technical Lead authorized recording DT-025 and `DEV-SPRINT-018` as "Completed." Like DT-017 through DT-024, this sprint carries no simulator/device or environment constraint; all 219 `packages/core` tests pass (210 pre-existing + 9 new) and typecheck is clean; `apps/mobile` remains untouched (10/10 tests still pass). `MembershipAuthorizationValidator`, `MembershipAuthorizationResult`, `Membership`, `NfcTag`, `NfcAssignment`, `AssignmentTarget`, `Customer`, `NfcTagAssigned`, `NfcAssignmentRepository`, `NfcTagRepository`, `CustomerRepository`, `AssignmentResolver`, and `AssignmentValidator` are all confirmed byte-for-byte unchanged; `NfcTagRepository` is not even called by `assignNfcTag(...)`. `assignNfcTag(...)` has no caller anywhere in the repository outside its own test file. DT-026 (Existing Scan Pipeline Integration Verification) remains entirely unstarted, now fully unblocked; the Membership-granting bootstrap question, tag reassignment/history semantics, tag payload collision semantics, and `packages/core/tsconfig.json`'s standing `tests/`-typecheck-coverage gap all remain unresolved (`Development_Sprint_018_Closure.md`, Known Remaining Risks, Lessons Learned).

### 10.21 Eighteenth Open Governance Note (Development Sprint 019, Existing Scan Pipeline Integration Verification) — Resolved

Development Sprint 019 (DT-026) implements the eighth and final Organization Management Development step, and the only Development Task in the DT-017–DT-026 sequence to add zero production code — commit `72e45f5`. A new composition-level test file, `packages/core/tests/application/OrganizationOwnedScanPipeline.test.ts`, contains exactly two tests, both using real (unmocked) production classes throughout: an accepted-path test constructs a real Organization, a real Administrator Membership and a real Employee Membership, a real Customer/NfcTag/NfcAssignment created via `OrganizationAdministrationService`'s three methods (DT-023/DT-024/DT-025), wires the same `CustomerRepository`/`NfcTagRepository`/`NfcAssignmentRepository` instances directly into a real `AssignmentResolver`/`AssignmentValidator`, and drives a scan through the unmodified `NfcScanApplicationService` pipeline, asserting the same accepted-outcome shape (`WorkEvent` saved, `TimeEntry` started) DT-011's existing fixture-based pipeline test already asserts; a cross-Organization rejection test proves the pipeline's existing `employee_lacks_organization_access` rejection (`AssignmentValidator`, unchanged since Development Sprint 001) still fires correctly against Administration-created data. **This closes the TS-002 Organization Management Foundation Development Task sequence in full** — DT-017 through DT-026 are all now Completed; no DT-027 or later task exists anywhere in FB-002, TS-002, or `EP-007_Development_Tasks.md`. Zero production code was added or modified, confirmed two independent ways: a single-commit file-list check and a full-range `git diff --stat` against Development Sprint 018's own commit, both empty for every file under `packages/core/src/` and `apps/mobile/src/`. An independent Review Agent approved this sprint, and the Technical Lead authorized recording DT-026 and `DEV-SPRINT-019` as "Completed." Like DT-017 through DT-025, this sprint carries no simulator/device or environment constraint; all 221 `packages/core` tests pass (219 pre-existing + 2 new) and typecheck is clean; `apps/mobile` remains untouched (10/10 tests still pass); `runScan.ts`'s own 14 CLI tests are confirmed passing with zero diff. `AssignmentResolver`, `AssignmentValidator`, `WorkEventFactory`, `BusinessEngine`, `NfcScanApplicationService`, `WorkEventCreationService`, `OrganizationAdministrationService`, `OrganizationManagementService`, `MembershipService`, `CallerContext`, and both pre-existing test files (`NfcScanToTimeEntryPipeline.test.ts`, `OrganizationAdministrationService.test.ts`) are all confirmed byte-for-byte unchanged. This proof is repository-internal only — no UI, CLI, or mobile entry point calls any Organization Management Application Service after this sprint either, and this sprint deliberately does not change that. The Membership-granting bootstrap question, tag reassignment/history semantics, tag payload collision semantics, the missing-target-Customer result-vocabulary limitation, and `packages/core/tsconfig.json`'s standing `tests/`-typecheck-coverage gap all remain unresolved (`Development_Sprint_019_Closure.md`, Known Remaining Risks, Lessons Learned). No Development Sprint 020 was created; `Development_Sprint_019_Closure.md` Section 14 instead recommends a Technical Lead/Human Architect decision point among several possible next tracks.
