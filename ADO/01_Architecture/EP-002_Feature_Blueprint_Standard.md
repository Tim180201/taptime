# EP-002: Feature Blueprint Standard

Status: Architecture Draft  
Owner: Human Architect  
Maintainer: AI Technical Lead  
Methodology: FDOS  
Repository: `Tim180201/taptime`  
Branch: `architecture/ep-002-feature-blueprint-standard`

---

## 1. Purpose

This document defines the mandatory Feature Blueprint Standard for TapTim.e.

A Feature Blueprint is the first formal engineering artifact after product vision and product principles. It translates a product feature idea into a stable, reviewable, architecture-oriented description before any technical specification, development task, implementation, or testing work begins.

The standard exists to protect TapTim.e from premature implementation, unclear ownership, inconsistent feature descriptions, and architecture drift.

---

## 2. FDOS Position

The Feature Blueprint belongs to the FDOS sequence:

```text
Product Vision
↓
Product Principles
↓
Feature Blueprint
↓
Technical Specification
↓
Development Tasks
↓
Implementation
↓
Testing
↓
Release
↓
Evidence
```

A Feature Blueprint must not contain implementation tasks, source code, sprint commitments, or low-level technical design.

Its job is to define what the feature is, why it matters, how it behaves from a product and domain perspective, and what must be clarified before technical design starts.

---

## 3. Mandatory Blueprint Sections

Every TapTim.e Feature Blueprint must contain the following sections in this order:

1. Metadata
2. Feature Summary
3. User Problem
4. Product Goal
5. Scope
6. Out of Scope
7. User Roles
8. Core User Flow
9. Business Rules
10. Domain Concepts
11. UX Principles
12. Data Expectations
13. Integration Expectations
14. Non-Functional Expectations
15. Risks and Open Questions
16. Acceptance Criteria
17. Follow-Up Technical Specification Notes

The order is mandatory to keep all feature artifacts readable and comparable.

---

## 4. Section Requirements

### 4.1 Metadata

Metadata must identify the feature artifact clearly.

Required fields:

- Feature ID
- Feature Name
- Status
- Owner
- Maintainer
- Related Product Principle
- Related Domain
- Created Date
- Last Updated Date

Allowed statuses:

- Draft
- Architecture Review
- Approved
- Superseded
- Rejected

### 4.2 Feature Summary

The summary must explain the feature in one to three concise paragraphs.

It must be understandable by a new team member without additional product context.

### 4.3 User Problem

This section must describe the real user problem, not the proposed solution.

It must answer:

- Who has the problem?
- What is painful, slow, unclear, or error-prone today?
- Why does this problem matter for TapTim.e?

### 4.4 Product Goal

This section must define the intended product outcome.

It must not describe implementation mechanics.

### 4.5 Scope

Scope defines what belongs to the feature.

Every scope item must be concrete, testable at product level, and relevant to the feature goal.

### 4.6 Out of Scope

Out of scope protects architecture and delivery focus.

This section must explicitly list adjacent capabilities that are intentionally excluded.

### 4.7 User Roles

This section identifies all user roles affected by the feature.

Roles must use TapTim.e domain language and avoid generic labels unless no domain-specific role exists yet.

### 4.8 Core User Flow

The core flow describes the intended user experience at product level.

It must be written as an ordered sequence and reflect the philosophy:

**One Tap. One Decision.**

### 4.9 Business Rules

Business rules define decisions owned by the Business Engine or product domain.

They must be written independently from UI, database, or framework details.

### 4.10 Domain Concepts

This section lists relevant domain concepts introduced or touched by the feature.

Each concept must include a short definition.

### 4.11 UX Principles

This section defines feature-specific UX rules.

UX rules must support reduced user decision-making and operational clarity.

### 4.12 Data Expectations

This section describes expected information, records, events, or states at a conceptual level.

It must not define database schema unless the feature has already reached technical specification.

### 4.13 Integration Expectations

This section lists expected interactions with other systems, modules, devices, or services.

Examples include NFC, authentication, mobile device APIs, backend services, or notification systems.

### 4.14 Non-Functional Expectations

This section defines relevant quality expectations such as reliability, latency, offline tolerance, auditability, privacy, maintainability, and accessibility.

### 4.15 Risks and Open Questions

This section lists unresolved product, architecture, domain, UX, or compliance issues.

Every open question must be written so it can be answered by the Human Architect or resolved in a later technical specification.

### 4.16 Acceptance Criteria

Acceptance criteria define when the Feature Blueprint is complete and ready for technical specification.

They must validate clarity and architecture readiness, not implementation completion.

### 4.17 Follow-Up Technical Specification Notes

This section records topics that must be addressed later in the Technical Specification.

It prevents premature technical detail while preserving important engineering concerns.

---

## 5. Quality Rules

A Feature Blueprint is acceptable only if it satisfies all rules below:

- It is understandable without verbal explanation.
- It uses consistent TapTim.e domain language.
- It separates product intent from technical implementation.
- It includes clear scope and out-of-scope boundaries.
- It identifies relevant business rules.
- It avoids hidden implementation decisions.
- It exposes unresolved questions instead of burying them.
- It can be reviewed by both product and engineering leadership.
- It can safely feed a Technical Specification.

---

## 6. Forbidden Content

A Feature Blueprint must not include:

- Source code
- Database schemas
- API contracts
- Framework-specific implementation details
- Development task breakdowns
- Sprint plans
- Estimates
- Release dates
- UI pixel specifications
- Unapproved architecture standards

If such content is necessary, it belongs in a Technical Specification, Development Task, ADR, or implementation artifact.

---

## 7. Review Standard

A Feature Blueprint can move from Draft to Architecture Review only when:

- all mandatory sections exist,
- scope boundaries are explicit,
- business rules are separated from UI behaviour,
- open questions are clearly listed,
- follow-up technical specification notes are captured,
- and the AI Technical Lead confirms architectural readiness for review.

A Feature Blueprint can move from Architecture Review to Approved only when the Human Architect accepts the product intent and the Technical Lead accepts the architecture quality.

---

## 8. Part 4 Integration: Blueprint Lifecycle and Governance

Part 4 completes EP-002 by defining the operational lifecycle for Feature Blueprints and the governance rules that prevent blueprint artifacts from becoming informal notes.

### 8.1 Lifecycle States

Every Feature Blueprint must move through the following lifecycle:

```text
Draft
↓
Architecture Review
↓
Approved
↓
Technical Specification Ready
↓
Superseded or Maintained
```

Allowed terminal states:

- Approved
- Superseded
- Rejected

A Feature Blueprint must not be used as the basis for a Technical Specification unless it is Approved or explicitly marked Technical Specification Ready.

### 8.2 State Responsibilities

#### Draft

The feature idea is being structured.

Allowed work:

- capture product intent,
- define user problem,
- clarify scope,
- identify business rules,
- list risks and open questions.

Forbidden work:

- implementation design,
- development task breakdown,
- code or schema decisions.

#### Architecture Review

The blueprint is complete enough for architectural evaluation.

The Technical Lead reviews:

- FDOS sequence compliance,
- domain consistency,
- scope boundaries,
- business rule ownership,
- technical risk visibility,
- readiness for later technical specification.

#### Approved

The Human Architect has accepted the product intent and the Technical Lead has accepted the architecture quality.

Approved blueprints become stable input for Technical Specifications.

#### Technical Specification Ready

The blueprint is ready to feed a Technical Specification.

This state confirms that remaining technical questions are intentionally deferred and do not block specification work.

#### Superseded

The blueprint has been replaced by a newer artifact or decision.

A superseded blueprint must link to the replacement artifact.

#### Rejected

The blueprint was intentionally not pursued.

A rejected blueprint must include a short reason so future sessions do not reopen the same decision without new evidence.

### 8.3 Governance Rules

Feature Blueprint governance follows these rules:

- Architecture work must happen outside `main` until review is complete.
- Every blueprint must live in the ADO knowledge base.
- Every blueprint must use the mandatory section order from this standard.
- Every blueprint must preserve open questions until they are explicitly answered or moved into a follow-up artifact.
- Every blueprint must be reviewed for FDOS order before Technical Specification work starts.
- The Technical Lead may block progression if scope, business rules, or domain language are unclear.
- The Human Architect remains the final authority for product intent.

### 8.4 Change Rules After Approval

Approved Feature Blueprints are stable architecture artifacts.

Changes after approval are allowed only for:

- clarification without semantic change,
- correction of factual errors,
- linking follow-up artifacts,
- recording supersession,
- adding evidence discovered after implementation.

Material product or architecture changes require one of the following:

- a new blueprint version,
- an ADR,
- or a formal update reviewed by the Human Architect and Technical Lead.

### 8.5 Minimum Review Checklist

Before a Feature Blueprint can be marked Review Ready, the Technical Lead must verify:

- all mandatory sections are present,
- the feature problem is clearly separated from the solution,
- product goals are outcome-oriented,
- scope and out-of-scope sections do not overlap,
- business rules are explicit and implementation-independent,
- domain concepts are named consistently,
- UX principles support One Tap. One Decision.,
- data and integration expectations avoid premature technical design,
- non-functional expectations are relevant and testable later,
- risks and open questions are visible,
- follow-up Technical Specification notes are actionable,
- no forbidden content is present.

### 8.6 Architecture Consolidation Sprint Entry Criteria

EP-002 can enter Architecture Consolidation Sprint when:

- Parts 1, 2, 3, and 4 are integrated into this standard,
- the standard reads as one coherent document,
- lifecycle and governance rules are present,
- review checklist is complete,
- and no section contradicts FDOS order.

---

## 9. Review Ready Criteria for EP-002

EP-002 is Review Ready when:

- the AI Technical Lead Charter exists under `ADO/00_Core/`,
- this Feature Blueprint Standard exists under `ADO/01_Architecture/`,
- Part 4 lifecycle and governance rules are integrated,
- the document is internally consistent,
- and the next Architecture Consolidation Sprint can review wording, naming, and long-term maintainability.

---

## 10. Next Step

The next engineering step is the Architecture Consolidation Sprint for EP-002.

That sprint must review this document as a durable FDOS architecture standard, remove duplication, tighten terminology, and prepare it for Review Ready status before merge to `main`.
