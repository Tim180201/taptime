# FB-002 — Organization Management: Scope Assessment

Role: Research / Implementation Support acting on behalf of Technical Lead (per AGR-001)
Date: 2026-07-07
Repository State Verified Against: `main`, working tree clean except this new evidence file
Type: Scope Assessment Only — this document does not create FB-002, TS-002, or any Development Task, and does not modify architecture or code.

Assessment Question (as assigned): **What is the smallest correct Organization Management scope that enables a real pilot customer without violating existing architecture? Answer this from repository evidence only.**

---

## 1. Current Repository Evidence

### 1.1 Product/Architecture-level approval

- ADR-0003 (Product Scope v1, Accepted Draft) already lists as **In Scope for v1**: Organization account, User authentication, Basic role model, Employee users, Customer records, NFC tag registration, NFC tag assignment to customers, Basic admin overview. It explicitly lists **Customer self-service portal** as **Out of Scope for v1**.
- `Technical_Architecture_Profile.md` names `Organization` as an **Aggregate Root** (line 172) and `OrganizationId` as a domain identifier (line 180), and states "Every WorkEvent belongs to exactly one Organization" (line 208) as an architectural invariant.
- `Role_Model.md` (Status: "Sprint 1 Draft," dated 2026-06-26, unchanged since) defines four roles — System Owner, Administrator, Team Lead, Employee — and a "Version 1 Minimal Permission Matrix," but this is documentation only; no corresponding code exists anywhere in the repository (confirmed by direct search, Section 1.3 below).
- `Domain_Model.md` lists `Organization` with Status "Draft" and lists System Owner/Administrator responsibilities narratively, consistent with `Role_Model.md`.
- Conclusion: Organization Management is not new product scope. It is already-approved v1 scope that has never been translated into a Feature Blueprint, consistent with the Product Readiness Assessment's (Section 11.1) finding that this is a governance-chain gap, not a product-strategy gap.

### 1.2 Product Readiness governance context

- `Product_Readiness_Assessment.md` Section 11.1 (as re-evaluated after Technical Lead review) identifies Organization Management as the primary bottleneck for reaching Pilot Customers, precisely because no Feature Blueprint or Technical Specification exists for it.
- `EP-009_Product_Readiness_Framework.md` and `Product_Readiness_Roadmap.md` both carry Organization Management / FB-002 drafting as a "Now" milestone item.
- `Development_Sprint_011_Closure.md` explicitly recommended, as one of two parallel next priorities, "Human Architect initiation of FB-002 (Organization Management) drafting" — this task is that initiation, at the scope-assessment stage only.

### 1.3 Repository code reality (direct inspection, this session)

Domain layer (`packages/core/src/domain/`):

- `Customer`, `NfcTag`, `NfcAssignment` all exist as concrete domain types and are **already `organizationId`-scoped** (each interface carries an `organizationId: OrganizationId` field).
- `AssignmentTarget` exists and is deliberately extensible (per ADR-0002), with `customer` as the only implemented target type.
- `OrganizationId` and `UserId` exist only as **branded opaque string identifiers** (`ids.ts`), used inside `CallerContext`. There is **no `Organization` domain object, entity, or aggregate anywhere in code** — only the ID type. There is likewise **no `User`, `Employee`, or `Administrator` domain object** — only `UserId`.
- There is **no `Role` type, enum, or permission-check code anywhere in `packages/core` or `apps/mobile`** (confirmed by repository-wide search). `Role_Model.md`'s permission matrix has zero corresponding implementation.

Ports and repositories (`packages/core/src/ports/`, `packages/core/src/infrastructure/repositories/`):

- `CustomerRepository`: `findById(customerId): Customer | null` — **read-only**.
- `NfcTagRepository`: `findByPayload(payload): NfcTag | null` — **read-only**.
- `NfcAssignmentRepository`: `findActiveByTagId(nfcTagId): NfcAssignment | null` — **read-only**.
- All three concrete `InMemory*Repository` implementations only accept a fixed array in their constructor; none has a `save`/`create`/`add` method. **No repository in the codebase today can create or persist a Customer, NfcTag, or NfcAssignment.** This is a uniform pattern across all three, not an omission specific to one.
- `AuthenticationGateway`: `authenticate(credentials): AuthenticationResult` — a single opaque `signInCode`, explicitly documented (DT-013) as building "no password flow, no registration, no credential management."
- The only concrete `AuthenticationGateway` implementation is `FakeAuthenticationGateway`, which authenticates against a **hard-coded in-memory map** of `{ signInCode, userId, organizationId }` demo accounts (`DEFAULT_DEMO_ACCOUNT` = `demo-employee-code` → `demo-employee` / `demo-org`). This is the **entire mechanism by which "an employee belongs to an organization" exists today** — it is a source-code fixture, exactly the kind of fixture the Technical Lead's guidance asks FB-002 to eliminate from the scan pipeline, but the fixture actually lives one layer up, in identity/membership, not in the NFC tag/assignment data itself.

Business layer (`packages/core/src/business/`):

- `AssignmentResolver.resolve()`: looks up a tag by payload, then an active assignment by tag ID. Pure read orchestration; no organization check of its own.
- `AssignmentValidator.validate()`: **this is the one piece of organization-scoped authorization that already exists and already works** — it rejects with `employee_lacks_organization_access` when `caller.organizationId !== assignment.organizationId`, and separately rejects `missing_assignment_target` / `assignment_target_disabled` via `CustomerRepository.findById`. This logic requires no change for FB-002; it already assumes an authenticated caller carries a correct `organizationId` and already enforces the boundary once that assumption holds.

Demo/CLI composition (`packages/core/src/cli/runScan.ts`):

- `buildScanDemoPipeline()` hard-codes exactly one Organization (`'demo-org'`), one Customer, one NfcTag, and one active NfcAssignment as literal in-memory objects — explicitly commented as "Demo-only seed data (not production seed data)." This is the second, independent fixture (alongside `FakeAuthenticationGateway`) that stands in for Organization Management today.

---

## 2. Existing Domain Concepts

Already modeled, already organization-scoped, requiring no new domain modeling for FB-002:

- `Customer` (`id`, `organizationId`, `active`)
- `NfcTag` (`id`, `organizationId`, `payload`)
- `NfcAssignment` (`id`, `organizationId`, `nfcTagId`, `target`, `active`)
- `AssignmentTarget` (extensible target-type union; `customer` implemented)
- `CallerContext` (`authenticated` variant already carries `userId` + `organizationId`; "the pipeline receives caller identity, it does not establish one")
- `AssignmentValidator`'s organization-membership check (`employee_lacks_organization_access`)

Named in documentation but with **no corresponding domain type in code at all**:

- `Organization` (Aggregate Root per `Technical_Architecture_Profile.md`, but only its ID exists in code)
- `User` / `Employee` / `Administrator` / `System Owner` / `Team Lead` (only `UserId` exists in code)
- `Role` (no type, no enum, no permission-check function exists anywhere)
- Organization membership as a *relationship* (today it exists only as two parallel hard-coded fixtures — `FakeAuthenticationGateway`'s account map and `buildScanDemoPipeline`'s literal objects — not as any queryable or persistable domain relationship)

---

## 3. Missing Capability

Three distinct categories of gap, of materially different size:

**Category A — Identity and membership (largest gap, no existing code at all).** There is no `Organization` entity, no `User`/`Employee`/`Administrator` entity, and no `Role` concept anywhere in `packages/core`. This is not a missing write-port on an existing type (as in Category B) — it is the complete absence of a domain object. Building this is genuinely new domain modeling, not an extension of something that already exists.

**Category B — Write-capable ports for already-modeled types (smaller gap, mechanical extension).** `Customer`, `NfcTag`, and `NfcAssignment` are fully modeled, organization-scoped domain types today, but their repositories are read-only. Adding `save`/`create` methods to `CustomerRepository`, `NfcTagRepository`, and `NfcAssignmentRepository` (and corresponding `InMemory*`/durable implementations) is the same kind of extension already proven twice in this repository — DT-015 (durable persistence adapters for `WorkEventRepository`/`TimeEntryRepository`/`OfflineQueue`) and DT-016 (`RnNfcScanAdapter` as a new `NfcScanPort` implementation) — except that here the port interface itself must gain a new method, not just a new implementation of an existing method. This is a real difference from the "swap the adapter" pattern used by DT-015/DT-016, but it is still additive to an existing, approved port shape rather than net-new modeling.

**Category C — Non-fixture identity/membership resolution.** Even if Category A is built, something must replace `FakeAuthenticationGateway`'s hard-coded account map with a real (even if still simple/manual) way to know which Organization a User belongs to and what Role they hold. Without this, "the existing scan pipeline can resolve assignments without source-code fixtures" (the Technical Lead's stated goal) is only half achieved — the NFC/Customer side would no longer be a fixture, but the identity/membership side still would be.

---

## 4. Possible Scope Options

**Option 1 — Full admin platform.** Organization signup, self-service onboarding, multi-role permission enforcement, Customer/NFC-tag self-service management UI, billing hooks (System Owner vs. Administrator distinction). Rejected: contradicts ADR-0003's explicit exclusion of "Customer self-service portal" from v1, and contradicts the Technical Lead's stated preference for "a small foundation, not a full admin platform." Repository evidence agrees this is too large for a pilot-enabling FB-002.

**Option 2 — Identity + membership only (Category A), no write ports for Customer/NfcTag/NfcAssignment.** Would define `Organization`/`User`/`Employee`/`Administrator`/`Role` domain types and replace the `FakeAuthenticationGateway` fixture, but leave Customer/NfcTag/NfcAssignment creation as hard-coded fixtures. Rejected: this does not enable a real pilot customer, because a pilot organization still could not have its own customers or tags — only the demo org's fixture data would exist.

**Option 3 — Write ports only (Category B), no Organization/User/Role modeling.** Would add `save` methods to the three existing repositories, letting a pilot organization's Customers/NfcTags/NfcAssignments be created, while leaving Organization/User/Role identity entirely fixture-based (i.e., still one hard-coded `FakeAuthenticationGateway` account per organization). Rejected as a *complete* answer, but identified below as a legitimate first increment if Category A must be sequenced separately — see Section 5.

**Option 4 — Minimal foundation: Category A + Category B + Category C, manual/admin-driven provisioning, no self-service onboarding.** Organization/User/Employee/Administrator/Role as domain types (Category A); write-capable repositories for Customer/NfcTag/NfcAssignment (Category B); a non-fixture (but still simple — e.g., an internal/admin-only creation path, not a public signup flow) way to establish Organization membership (Category C). This matches the Technical Lead's stated preferred scope and is supported, not contradicted, by repository evidence — see Section 5 and Section 8.

---

## 5. Recommended Minimal Scope

Repository evidence supports the following as the smallest scope that enables a real pilot customer without violating existing architecture (Option 4 above):

1. **Organization creation** — In scope. `Organization` must become a real domain object (Aggregate Root, per `Technical_Architecture_Profile.md`), not only an ID. A pilot cannot exist without one real Organization distinct from `'demo-org'`.
2. **Administrator identity** — In scope, at minimal fidelity. At least one identifiable Administrator per Organization is required to satisfy ADR-0003's "Basic admin overview" and to have someone capable of provisioning the rest. Full Role enforcement (Team Lead, System Owner/Administrator separation) is not required for a single pilot organization — see Out of Scope.
3. **Employee identity** — In scope. Required for `CallerContext`'s existing `authenticated` shape to be populated for real people rather than the fixed demo account.
4. **Organization membership** — In scope. This is what Category C closes: replacing `FakeAuthenticationGateway`'s hard-coded map with a real (manual-entry is acceptable) association of User → Organization → Role.
5. **Role assignment** — In scope, but minimally. Evidence (`AssignmentValidator`) shows only one role-shaped check exists today (`employee_lacks_organization_access`, i.e., "is this caller in this organization at all"). A full four-role permission matrix (`Role_Model.md`) is not required to unblock a pilot; a coarse Administrator/Employee distinction is sufficient to decide who may create Customers/NfcTags/NfcAssignments.
6. **Customer/AssignmentTarget creation** — In scope. Required so a pilot organization is not limited to the one hard-coded demo Customer. This is Category B, additive to the existing `Customer` type and `CustomerRepository`.
7. **NFC Tag registration** — In scope. Same reasoning and same category as Customer creation; required so a pilot organization is not limited to the one hard-coded demo tag.
8. **NFC Tag assignment** — In scope. `NfcAssignment`/`AssignmentTarget` already model this; only a write path is missing (Category B).
9. **Organization-scoped authorization** — Already substantially in scope today (`AssignmentValidator`'s existing check). FB-002 must preserve this check exactly and extend it only to the extent that new write operations (Customer/NfcTag/NfcAssignment creation) also need an equivalent "does this caller belong to this organization" gate before writing, not just before reading/validating a scan.
10. **Demo/manual setup versus self-service onboarding** — Repository evidence supports **manual/admin-driven provisioning**, not self-service onboarding, for this minimal scope. ADR-0003 explicitly places "Customer self-service portal" out of v1 scope, and no self-service signup flow is named anywhere in the repository's approved scope. An internal/admin-operated creation path (however implemented — this assessment takes no position on UI vs. script vs. tool, since that is FB-002/TS-002 territory) satisfies both the Technical Lead's "small foundation" preference and ADR-0003.
11. **Pilot-only versus production-ready scope** — Repository evidence supports **pilot-only** framing. Nothing in the repository (ADR-0003, Role_Model.md, the Product Readiness Assessment) calls for production-hardened multi-tenant self-service account management as a precondition for a first pilot customer; it calls for enough real Organization/User/Customer/Tag data to stop depending on hard-coded fixtures.

---

## 6. Out of Scope

Explicitly excluded from the recommended minimal FB-002 scope, per repository evidence:

- Self-service Organization signup/registration flow (ADR-0003: "Customer self-service portal" explicitly out of v1 scope).
- Full four-role permission matrix enforcement (`Role_Model.md`'s System Owner / Administrator / Team Lead / Employee distinctions) — only a coarse Administrator/Employee distinction is required to unblock a pilot; the full matrix remains a documented but not-yet-implementable target.
- Billing, governance, or account-tier features associated with "System Owner" (`Role_Model.md` itself defers these: "billing/governance later").
- Multi-organization membership per user, or cross-organization data access — no evidence anywhere calls for this; `CallerContext` already models exactly one `organizationId` per authenticated caller.
- Any change to `AssignmentResolver`, `BusinessEngine`, `WorkEventFactory`, or the WorkEvent/TimeEntry pipeline — none of this is affected by Organization Management and none is evidenced as needing to change.
- Approval workflows, time-entry correction, reporting/export UI (`Role_Model.md`'s "Open Questions" and ADR-0003's "Explicitly Out of Scope for v1" both defer these).
- Any specific backend/cloud persistence technology choice for the new writable repositories — ADR-0007 leaves this deferred generally, and nothing about FB-002 requires resolving it first; the existing `InMemory*`-then-durable-adapter pattern (DT-015) can apply identically here.
- Physical Android device/NFC-tag validation of tag *registration* hardware flows — out of scope for this assessment and likely for FB-002 itself; DT-016 already carries an open, separate physical-validation item for tag *scanning*.

---

## 7. Risks

- **Port-shape change risk.** Unlike DT-015/DT-016, which only swapped an implementation behind an unchanged port, Category B requires widening `CustomerRepository`, `NfcTagRepository`, and `NfcAssignmentRepository` themselves (new `save`/`create` methods). This is a larger, less mechanical change than either prior Development Task and should not be underestimated in a future TS-002/Development Task sizing exercise.
- **Category A has no existing code to extend.** `Organization`/`User`/`Employee`/`Administrator`/`Role` do not exist as domain types at all. "Extend Before Create" does not apply here in the usual sense — there is nothing to extend for these five concepts; they must be created. This is the single largest source of estimation risk for FB-002.
- **Two independent fixtures must both be retired.** `FakeAuthenticationGateway` (identity/membership) and `buildScanDemoPipeline` (Customer/NfcTag/NfcAssignment) are separate, independently hard-coded fixtures. Retiring only one leaves the scan pipeline only partially "real" for a pilot organization; a future TS-002 should treat both as in-scope removal targets, not just the NFC-side one the Technical Lead's guidance named explicitly.
- **`AssignmentValidator`'s existing check must not regress.** Any new write path for Customer/NfcTag/NfcAssignment must preserve `employee_lacks_organization_access`, `missing_assignment_target`, and `assignment_target_disabled` behavior exactly; these are tested, working business rules with no evidence they need to change.
- **Role_Model.md drift risk.** The document is unchanged since 2026-06-26 and still asks its own "Open Questions" (e.g., "Can one user have multiple roles? Are roles organization-specific or global?"). A future FB-002 will need Human Architect answers to these before Role assignment can be specified precisely, even at minimal fidelity.
- **Scope-creep risk toward Option 1.** Because ADR-0003 already lists a broad list of "In Scope for v1" items (admin overview, reporting, etc.), there is a real risk that FB-002 drafting expands toward a fuller admin platform than the Technical Lead's stated preference or this assessment's recommendation. This risk should be named explicitly when FB-002 is drafted.

---

## 8. Open Human Architect Decisions

The following are not resolved by repository evidence and require explicit Human Architect decision before or during FB-002 drafting:

1. How is Organization membership initially established for a pilot — direct database/config entry, an internal admin tool, or a minimal Administrator-only UI? (This assessment recommends "manual/admin-driven," per Section 5 item 10, but not a specific mechanism.)
2. Does v1 need more than the coarse Administrator/Employee distinction, or is the full four-role matrix (`Role_Model.md`) required before any pilot, even if enforcement is minimal?
3. Can a User belong to more than one Organization, ever (even post-pilot)? `Role_Model.md`'s own Open Questions ask this; `CallerContext`'s current shape assumes no.
4. Is "Administrator" a per-Organization role only, or could a future System-Owner-level cross-organization role exist? (Affects whether Category A's `Role` type should be modeled as organization-scoped from the start.)
5. What replaces `FakeAuthenticationGateway` for a pilot — is a real managed authentication provider (ADR-0007's deferred category) required at pilot stage, or is a still-simple-but-non-fixture mechanism acceptable for a single pilot organization?
6. Should NFC Tag registration in FB-002 include any physical-provisioning workflow (e.g., writing a payload to a blank tag), or only registering an already-encoded payload string into the system, mirroring today's `createNfcPayload(DEMO_KNOWN_PAYLOAD)` pattern?

---

## 9. Recommended Next Artifact

Per the assigned Stop Condition, this assessment recommends but does not create:

- **FB-002 – Organization Management Foundation**, scoped per Section 5 above (Organization creation, Administrator/Employee identity, Organization membership, coarse Role assignment, Customer/NFC Tag/NFC Tag Assignment creation, preserved organization-scoped authorization, manual/admin-driven provisioning, pilot-only framing) — to be drafted only after Human Architect disposition of the Open Decisions in Section 8, following the Mandatory Blueprint Structure in `Feature_Blueprint_Standard.md`.

No TS-002, no Development Task, and no code or architecture change is recommended to be created directly from this assessment; each depends on FB-002 first being drafted and approved, per the mandatory FDOS delivery chain.

---

## 10. Addendum — Should Identity & Membership Be Split From FB-002?

Follow-up question (Technical Lead, 2026-07-07, verbatim): *"Überprüfe, ob Identity & Membership wirklich Bestandteil von FB-002 sein müssen oder ob sie sinnvoll als eigener nachfolgender Capability-Blueprint getrennt werden können. Repository-Evidenz entscheidet."* This repository has no separate "Capability Blueprint" artifact type; the question is read as asking whether Identity and Membership should become a distinct, later **Feature Blueprint** rather than part of FB-002, using the capability-layer language `Product_Readiness_Assessment.md` Section 12 already established. Repository evidence gives a split answer for "Identity" versus "Membership" — they are not one undifferentiated gap.

### 10.1 Repository evidence already treats Identity and Organization/Membership as separate layers

`Product_Readiness_Assessment.md` Section 12.2's Capability Hierarchy (Technical-Lead-reviewed, already Active governance content, not new analysis) places them as two distinct, adjacent layers, not one:

```text
Identity            (who is acting: User, authentication, session)
  |
  v
Organization        (which business account: Organization, roles, membership)
```

Section 12.2's own wording assigns "roles, membership" to the **Organization** layer, not the Identity layer. This is direct, already-approved repository evidence that Membership is not a natural fit for a split-out Identity blueprint — it already belongs with Organization, i.e., with FB-002.

### 10.2 Identity and Organization/Membership are also at different implementation maturity, not just different conceptual layers

Section 12.3's per-layer status table records: Identity — "Partially implemented — real, tested session/authentication flow, but only a fake/local provider (DT-013/DT-014)"; Organization — "Modeled as a domain concept and Aggregate Root only; no creation, configuration or management capability exists"; People — "only the Employee role has any code-level presence, and only via a hard-coded fixture." Direct inspection in this session confirms this is still accurate: `SessionService`, `CallerContext`, `AuthenticationGateway`, and `AuthenticationResult` are real, tested, Completed Development Task output (DT-013 Development Sprint 007, DT-014 Development Sprint 008). By contrast, `Organization`/`User`/`Employee`/`Administrator`/`Role` have **no domain type at all** (Section 1.3/Section 2 above). Bundling a "swap the provider" gap (Identity) with a "build the domain type from nothing" gap (Organization/People) inside one Feature Blueprint mixes two structurally different sizes of work.

### 10.3 The remaining Identity gap is gated by a separate, already-deferred architecture decision

ADR-0007 already defers "the specific [authentication] provider" as its own not-yet-made Human Architect/Technical Lead decision, independent of any Organization Management scope question. Replacing `FakeAuthenticationGateway` with a real provider is therefore blocked on an architecture decision that FB-002 cannot and should not resolve — a further, independent reason to keep it out of FB-002.

### 10.4 The two capabilities are not implementation-coupled today

`FakeAuthenticationGateway`'s constructor already accepts an array of `DemoAuthenticationAccount` (not just the single `DEFAULT_DEMO_ACCOUNT`). This means FB-002's Organization/Customer/NfcTag/NfcAssignment write capability can be built and even piloted while Identity continues to use a fake/local provider extended with more manually-configured accounts — confirming the two capabilities are separable at the implementation level, not just conceptually. What must move out of pure source-code fixtures for a pilot is the **association** of a `userId` to the correct `organizationId` and Role (Membership) — not the cryptographic/session mechanics of authentication (Identity) itself.

### 10.5 Conclusion

- **Identity** (the authentication mechanism/provider — `AuthenticationGateway`'s concrete implementation) **should be split out** of FB-002 into its own, later Feature Blueprint. Repository evidence supports this on three independent grounds: the already-approved capability hierarchy treats it as a separate layer; it is already substantially implemented (DT-013/DT-014) unlike Organization/People, which have nothing; and its remaining gap is gated by ADR-0007's own separately-deferred provider decision. This refines, not reverses, Section 3's Category C framing above — Category C should be read as two parts: (a) *Membership resolution*, which stays in FB-002, and (b) *real authentication provider selection*, which does not.
- **Membership** (which Organization and Role an authenticated `userId` belongs to) **should stay in FB-002**. Repository evidence — Section 12.2's own already-reviewed hierarchy wording, "roles, membership," placed explicitly under the Organization layer — assigns it there directly, not to Identity. Splitting it out would contradict already-approved governance content rather than extend it.
- Practical effect on Section 5's recommended minimal scope: no item changes. "Organization membership" (item 4) and "Role assignment" (item 5) remain in FB-002 as written. What this addendum adds is a boundary clarification for a *future* Feature Blueprint (not created here) that would replace `FakeAuthenticationGateway` with a real provider — that future work is now more precisely scoped as an Identity-layer blueprint, sequenced after or alongside FB-002, not inside it.

This addendum does not change Sections 1–9, the Recommended Minimal Scope, or the Out of Scope list; it answers the specific follow-up question using evidence already gathered plus `Product_Readiness_Assessment.md` Section 12, without creating FB-002, TS-002, or any Development Task.

---

## Technical Lead Preferred-Scope Evaluation (explicit, as required by task instruction)

The Technical Lead's stated preferred scope was: *"Organization exists; Administrator can manage one Organization; Employees belong to one Organization; Customers / AssignmentTargets belong to one Organization; NFC Tags can be assigned to AssignmentTargets; Existing scan pipeline can resolve assignments without source-code fixtures."*

Repository evidence **largely supports** this preferred scope — it matches Section 5's recommended minimal scope closely, and does not need to be overridden. Two refinements, not contradictions, are required:

- **"Customers / AssignmentTargets belong to one Organization"** and **"NFC Tags can be assigned to AssignmentTargets"** are, in one specific sense, *already true today* at the domain-modeling level (`Customer`, `NfcTag`, `NfcAssignment`, `AssignmentTarget` are all already `organizationId`-scoped and already relate to each other exactly this way). What repository evidence adds is that the missing piece is narrower than the wording implies: only the **write path** (Category B) is missing, not the modeling.
- **"Administrator can manage one Organization" and "Employees belong to one Organization"** understate the size of the gap, not overstate it: repository evidence shows there is currently **no `Organization`, `User`, `Employee`, `Administrator`, or `Role` domain type at all** (Category A) — this is the largest, not the smallest, part of the preferred scope, and is larger in effort than the NFC/Customer side the guidance emphasizes.
- One necessary inclusion is implicit but unstated in the preferred scope: **"the existing scan pipeline can resolve assignments without source-code fixtures"** cannot be fully achieved by addressing only `NfcTagRepository`/`NfcAssignmentRepository`/`CustomerRepository` (Category B). `FakeAuthenticationGateway`'s hard-coded account map (Category C) is an equally real, independent fixture on the identity/membership side and must also be retired for the stated goal to be fully met.

Repository evidence does **not** contradict the Technical Lead's preferred scope in the sense of recommending something smaller or different in kind; it refines it by showing that the identity/membership half (Category A/C) is the larger and riskier half of the work, not the NFC/Customer half (Category B) that the "swap an adapter" precedent (DT-015/DT-016) might make appear more familiar.

---

## Stop Condition

Per task instruction: stop after this assessment. Do not create FB-002. Do not create TS-002. Do not create Development Tasks. Do not modify architecture. Do not modify code. Await Technical Lead review.
