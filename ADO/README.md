# TapTim.e ADO

Status: Draft Navigation Entry Point  
Epic: EP-006  
Owner: Technical Lead  
Approval Authority: Human Architect

## Purpose

Completed C3D implementation/physical evidence:
`ADO/05_Evidence/Block_C3D_Implementation_Evidence.md` and
`ADO/05_Evidence/Block_C3D_Physical_Validation_Evidence.md`.
Independent review and Technical-Lead correction disposition:
`ADO/05_Evidence/Block_C3D_Independent_Architecture_Security_Review.md`.
Completed and independently closed C3E1 implementation, Human physical-gate and closure evidence:
`ADO/05_Evidence/Block_C3E1_Implementation_Evidence.md` and
`ADO/05_Evidence/Block_C3E1_Physical_Validation_Evidence.md`; independent final closure review:
`ADO/05_Evidence/Block_C3E1_Independent_Final_Closure_Review.md`.
C3E2 architecture/authorization, implementation, Human physical gate and governance closure are
independently complete for the authorized local repository/device scope:
`ADO/02_Development/Block_C3E2_Explicit_Tag_Reassignment_Authorization.md` and
`ADO/05_Evidence/Block_C3E2_Implementation_Evidence.md`; implementation review and physical
evidence: `ADO/05_Evidence/Block_C3E2_Independent_Implementation_Review.md` and
`ADO/05_Evidence/Block_C3E2_Physical_Validation_Evidence.md`; independent final closure review:
`ADO/05_Evidence/Block_C3E2_Independent_Final_Closure_Review.md`. Closure commit `a2fdebc`, tree
`1872f9f`, passed exact-head ten-of-ten run `29652072268`; independent final review returned
`APPROVED` with zero open P0–P3 after accepting the complete fresh Galaxy-A33/NTAG213 Human gate,
active-work rejection, post-stop A→B reassignment, exact historical attribution and cleanup.
Production resources/data and deployment/distribution remain unauthorized.

Development Assignment 1 repository Workstreams A–E were published and Technical-Lead approved
from exact authorized baseline `1800930`, tree `73e77b6`. Implementation commit `4f51918`, tree
`617081f`, passed exact-head GitHub Actions run `29675842388`, attempt 1, ten of ten jobs. The
independent implementation review of publication head `de89521` returned `CHANGES REQUIRED` with
one P2, `DA1-IMPL-01`, and no other P0–P3. The byte-identical B6/Offline Organization/User advisory
lock and real cross-route PostgreSQL serialization test were published as correction `c71399a`,
tree `7a159ce`, and passed exact-head GitHub Actions run `29692113159`, attempt 1, ten of ten jobs.
The complete corrected local regression passes 1,626 tests. Independent exact-delta re-review
bound final reviewed head `767043d`, tree `19c434a`, and final-head run `29692304824` and returned
`APPROVED` with zero open P0/P1/P2/P3; `DA1-IMPL-01` is closed. The Human Architect subsequently
authorized the complete fresh Physical Gate against ADO head `72dc39e` and exact-head run
`29692785824`. Gate A failed before lease activation: on the approved Galaxy A33/Android-15 device,
the exact hash-verified APK reproduced SQLCipher page-1 HMAC/decryption failure on clean first start
before authentication after package-scoped backup cleanup, app-data clear and a probe with Android
Backup Manager disabled. Focused correction `04399fa`, tree `ecf5e6f`, now keeps SQLCipher
keying, first-page creation and exclusive transactions on one runtime-owned connection, adds an
explicit Android backup/transfer exclusion boundary, passes 1,628 local tests, all 15 typechecks
and all available builds, and passed exact-head run `29695449737` ten of ten. Native Galaxy-A33
evidence passes clean first start, cold encrypted reopen and wrong/missing-key fail-closed checks.
Independent exact-delta review of head `76be116`, tree `d320db3`, and ten-of-ten run
`29695605706` returned `APPROVED` with zero open P0/P1/P2/P3 and closed `DA1-PHYS-01`.
The Human Architect then authorized a complete fresh restart on product `04399fa`, ADO head
`fb4a4e4` and exact-head run `29696026676`. Gate A obtained a complete two-item Employee lease,
then failed at step 4 after airplane-mode force-stop/relaunch without Auth/API reachability: the
app showed `TapTim.e ist derzeit nicht verfügbar` instead of the mandatory explicit offline state.
No tag was scanned, lifecycle mutation counts remained zero and Gates B–E were not started.
Focused correction `e17fcb3`, tree `44320bc`, and its cross-identity hardening
`869e10f`, tree `325fdd5`, are published; exact-head runs `29696949408` and
`29697397146` each passed ten of ten jobs. The correction adds the suspended/retryable
provider-restoration state, the narrowly gated offline-capture shell and foreground/network
restoration ordering. The hardening additionally proves that only stored-session restoration or
a previously resolved authenticated context may consult a local lease; an explicit new login
whose backend context is unavailable cannot open an old local lease. Storage failure, logout,
rejection, owner/install mismatch and invalid/expired lease remain fail-closed. `DA1-PHYS-02`
remains open pending independent exact-delta review. No corrected physical result is claimed, and
a new separate Human authorization remains mandatory before another complete fresh Gate-A–E run.
Implementation, review and physical evidence:
`ADO/05_Evidence/Development_Assignment_01_Implementation_Evidence.md` and
`ADO/05_Evidence/Development_Assignment_01_Independent_Implementation_Review.md` and
`ADO/05_Evidence/Development_Assignment_01_Physical_Validation_Evidence.md` and
`ADO/05_Evidence/Development_Assignment_01_DA1_PHYS_01_Independent_Exact_Delta_Review.md`.
Production, deployment and distribution remain unauthorized.

This file is the official navigation entry point for the TapTim.e ADO.

Every Human and AI Agent shall locate this document through repository evidence before executing ABS-001 and shall read it before AOS-001 begins.

FDOS Rule:

> Every engineering document required for agent initialization shall be reachable through one official ADO entry point.

FDOS Rule:

> Agents shall perform Repository Discovery and locate the official ADO navigation entry point before executing the bootstrap sequence.

## Startup Sequence Authority

`ADO/README.md` is the normative source for the official TapTim.e agent startup sequence.

Other EP-006 artifacts may include operational overviews, lifecycle models or prompt requirements. Those supporting diagrams shall not redefine the official startup sequence.

If an apparent conflict exists between this file and an overview or lifecycle diagram, this file is authoritative.

## Official Startup Sequence (Normative)

```text
GitHub Connector Verification
  -> Repository Discovery
  -> Locate the official ADO Navigation Entry Point
  -> Read ADO/README.md
  -> ABS-001 Agent Bootstrap Standard
  -> AOS-001 Agent Onboarding Standard
  -> ADS-001 Agent Discovery Standard
  -> RHS-001 Repository Health Standard
  -> AIR-001 Agent Inventory Report
  -> READY FOR WORK
  -> EOM-001 Engineering Operating Model
  -> AGR-001 Agent Registry
  -> Role Execution
```

## Discovery Compatibility Rule

The initial Repository Discovery before ABS-001 is limited to locating the official ADO navigation entry point and verifying that repository evidence supports the startup sequence.

ADS-001 remains the full Repository Discovery standard after AOS-001.

This preserves backward compatibility while removing the assumption that `ADO/README.md` is known before repository evidence has been inspected.

## Mandatory Agent Startup Documents

| ID | Document | Location |
|---|---|---|
| ABS-001 | Agent Bootstrap Standard | `ADO/01_Architecture/Agent_Bootstrap_Standard.md` |
| AOS-001 | Agent Onboarding Standard | `ADO/01_Architecture/Agent_Onboarding_Standard.md` |
| ADS-001 | Agent Discovery Standard | `ADO/01_Architecture/Agent_Discovery_Standard.md` |
| RHS-001 | Repository Health Standard | `ADO/01_Architecture/Repository_Health_Standard.md` |
| AIR-001 | Agent Inventory Report | `ADO/01_Architecture/Agent_Inventory_Report.md` |
| EOM-001 | Engineering Operating Model | `ADO/01_Architecture/Engineering_Operating_Model.md` |
| AGR-001 | Agent Registry | `ADO/01_Architecture/Agent_Registry.md` |

## Governance

| ID | Document | Location |
|---|---|---|
| Decision Log | Decision Log | `ADO/00_Core/Decision_Log.md` |
| AVR-001 | Artifact Validation Register | `ADO/00_Governance/AVR-001_Artifact_Validation_Register.md` |

## EP-006 Agent Operations Framework

| ID | Document | Location |
|---|---|---|
| AOF-001 | Agent Operations Framework | `ADO/01_Architecture/Agent_Operations_Framework.md` |
| ABS-001 | Agent Bootstrap Standard | `ADO/01_Architecture/Agent_Bootstrap_Standard.md` |
| AOS-001 | Agent Onboarding Standard | `ADO/01_Architecture/Agent_Onboarding_Standard.md` |
| ADS-001 | Agent Discovery Standard | `ADO/01_Architecture/Agent_Discovery_Standard.md` |
| AIR-001 | Agent Inventory Report | `ADO/01_Architecture/Agent_Inventory_Report.md` |
| OAP-001 | Official Agent Prompt Standard | `ADO/01_Architecture/Official_Agent_Prompt_Standard.md` |
| ALF-001 | Agent Lifecycle | `ADO/01_Architecture/Agent_Lifecycle.md` |
| RHS-001 | Repository Health Standard | `ADO/01_Architecture/Repository_Health_Standard.md` |
| AOG-001 | Agent Operational Guidelines | `ADO/01_Architecture/Agent_Operational_Guidelines.md` |

## Engineering Core

| Document | Location |
|---|---|
| Decision Log | `ADO/00_Core/Decision_Log.md` |
| Product Vision | `ADO/01_Architecture/Product_Vision.md` |
| Engineering Operating Model | `ADO/01_Architecture/Engineering_Operating_Model.md` |
| Agent Registry | `ADO/01_Architecture/Agent_Registry.md` |

## Architecture

| Document | Location |
|---|---|
| Product Vision | `ADO/01_Architecture/Product_Vision.md` |
| Feature Blueprint Standard | `ADO/01_Architecture/Feature_Blueprint_Standard.md` |
| Technical Architecture Profile (TTAP-001) | `ADO/01_Architecture/Technical_Architecture_Profile.md` |
| Development Task Profile | `ADO/01_Architecture/Development_Task_Profile.md` |
| Architecture Decision Records (through Human-accepted ADR-0012; DA1-IMPL-01 and DA1-PHYS-01 independently closed; replacement DA1 Physical Gate separately gated) | `ADO/01_Architecture/ADR/` |
| Feature Blueprints (incl. FB-001, FB-002) | `ADO/01_Architecture/Feature_Blueprints/` |
| Technical Specifications (incl. TS-001, TS-002) | `ADO/01_Architecture/Technical_Specifications/` |
| Developer Implementation Manual (EP-008) | `ADO/01_Architecture/Developer_Implementation_Manual/` |

## Development

| Document | Location |
|---|---|
| EP-006 Validation Sprint | `ADO/02_Development/EP-006_Validation_Sprint.md` |
| EP-007 Development Tasks (DT-001–DT-026) | `ADO/02_Development/EP-007_Development_Tasks.md` |
| EP-009 Product Readiness Framework | `ADO/02_Development/EP-009_Product_Readiness_Framework.md` |
| EP-008 Post-Sprint-019 Block-Boundary Synchronization Plan | `ADO/02_Development/EP-008_Post_Sprint_019_Block_Boundary_Synchronization_Plan.md` |
| EP-008 Post-Sprint-019 Block-Boundary Synchronization Closure | `ADO/02_Development/EP-008_Post_Sprint_019_Block_Boundary_Synchronization_Closure.md` |
| EP-008 Post-Sprint-019 and EP-009 Reassessment Human Acceptance | `ADO/02_Development/EP-008_Post_Sprint_019_Human_Acceptance.md` |
| Block C3A Organization Administration Architecture Authorization | `ADO/02_Development/Block_C3A_Organization_Administration_Architecture_Authorization.md` |
| Block C3B Secure Organization Bootstrap Authorization | `ADO/02_Development/Block_C3B_Secure_Organization_Bootstrap_Authorization.md` |
| Block C3B Secure Organization Bootstrap Closure | `ADO/02_Development/Block_C3B_Secure_Organization_Bootstrap_Closure.md` |
| Block C3C Normal Administration Backend/API Authorization | `ADO/02_Development/Block_C3C_Normal_Administration_Backend_Authorization.md` |
| Block C3C Normal Administration Backend/API Closure | `ADO/02_Development/Block_C3C_Normal_Administration_Backend_Closure.md` |
| Block C3D Admin Web and Protected Android Capture Authorization | `ADO/02_Development/Block_C3D_Admin_Web_Android_Capture_Authorization.md` |
| Block C3E1 Identity-First Employee Membership Authorization Package | `ADO/02_Development/Block_C3E1_Identity_First_Employee_Membership_Authorization.md` |
| Block C3E2 Explicit Tag Reassignment Authorization Candidate | `ADO/02_Development/Block_C3E2_Explicit_Tag_Reassignment_Authorization.md` |
| Development Assignment 1 Human-Accepted Complete Offline Synchronization Contract and Repository Authorization | `ADO/02_Development/Development_Assignment_01_Complete_Offline_Synchronization_Authorization.md` |
| Development Assignment 1 Complete Offline Synchronization Implementation Plan | `ADO/02_Development/Development_Assignment_01_Complete_Offline_Synchronization_Implementation_Plan.md` |
| Block C3 Organization Administration Implementation Plan | `ADO/02_Development/Block_C3_Organization_Administration_Implementation_Plan.md` |
| Repository Health Sprint 001 | `ADO/02_Development/Repository_Health_Sprint_001.md` |
| Repository Maintenance Sprint 002 | `ADO/02_Development/Repository_Maintenance_Sprint_002.md` |
| Repository Freeze Sprint | `ADO/02_Development/Repository_Freeze_Sprint.md` |
| Development Sprint 001-010 Plans and Closures | `ADO/02_Development/Development_Sprint_001_Plan.md` through `Development_Sprint_010_Closure.md` |
| Development Area | `ADO/02_Development/` |

## Evidence

| Document | Location |
|---|---|
| Repository Readiness Assessment | `ADO/05_Evidence/Repository_Readiness_Assessment.md` |
| MVP Readiness Assessment | `ADO/05_Evidence/MVP_Readiness_Assessment.md` |
| Product Readiness Assessment (EP-009 baseline) | `ADO/05_Evidence/Product_Readiness_Assessment.md` |
| Product Readiness Roadmap (EP-009 baseline) | `ADO/05_Evidence/Product_Readiness_Roadmap.md` |
| Product Readiness Reassessment (2026-07-15) | `ADO/05_Evidence/Product_Readiness_Reassessment_2026-07-15.md` |
| EP-008 Post-Sprint-019 Block-Boundary Synchronization Evidence | `ADO/05_Evidence/EP-008/EP-008_Post_Sprint_019_Block_Boundary_Synchronization_Evidence.md` |
| EP-008 Post-Sprint-019 Independent Final Review | `ADO/05_Evidence/EP-008/EP-008_Post_Sprint_019_Independent_Final_Review.md` |
| Block C3A Independent Architecture/Security Review | `ADO/05_Evidence/Block_C3A_Independent_Architecture_Security_Review.md` |
| Block C3B Independent Architecture/Security Review | `ADO/05_Evidence/Block_C3B_Independent_Architecture_Security_Review.md` |
| Block C3B Secure Organization Bootstrap Evidence | `ADO/05_Evidence/Block_C3B_Secure_Organization_Bootstrap_Evidence.md` |
| Block C3C Independent Architecture/Security Review (exact-SHA final approved) | `ADO/05_Evidence/Block_C3C_Independent_Architecture_Security_Review.md` |
| Block C3C Normal Administration Backend/API Implementation and Closure Evidence | `ADO/05_Evidence/Block_C3C_Normal_Administration_Backend_Evidence.md` |
| Block C3D Independent Architecture/Security Review and Correction Disposition | `ADO/05_Evidence/Block_C3D_Independent_Architecture_Security_Review.md` |
| Block C3D Physical Validation Evidence | `ADO/05_Evidence/Block_C3D_Physical_Validation_Evidence.md` |
| Block C3D Closure Synchronization Evidence | `ADO/05_Evidence/Block_C3D_Closure_Synchronization_Evidence.md` |
| C3D Closure Sync / C3E1 Independent Architecture-Security Review | `ADO/05_Evidence/Block_C3D_C3E1_Independent_Architecture_Security_Review.md` |
| Block C3E1 Implementation Evidence | `ADO/05_Evidence/Block_C3E1_Implementation_Evidence.md` |
| Block C3E1 Physical Validation Evidence | `ADO/05_Evidence/Block_C3E1_Physical_Validation_Evidence.md` |
| Block C3E1 Independent Final Closure Review | `ADO/05_Evidence/Block_C3E1_Independent_Final_Closure_Review.md` |
| Block C3E2 Independent Pre-Implementation Architecture/Security Review | `ADO/05_Evidence/Block_C3E2_Independent_Architecture_Security_Review.md` |
| Block C3E2 Independent Final Implementation Review | `ADO/05_Evidence/Block_C3E2_Independent_Implementation_Review.md` |
| Block C3E2 Local Implementation Evidence | `ADO/05_Evidence/Block_C3E2_Implementation_Evidence.md` |
| Block C3E2 Physical Validation Evidence | `ADO/05_Evidence/Block_C3E2_Physical_Validation_Evidence.md` |
| Block C3E2 Independent Final Closure Review | `ADO/05_Evidence/Block_C3E2_Independent_Final_Closure_Review.md` |
| Development Assignment 1 Independent Pre-Implementation Review | `ADO/05_Evidence/Development_Assignment_01_Independent_Pre_Implementation_Review.md` |
| Development Assignment 1 Local Implementation Evidence | `ADO/05_Evidence/Development_Assignment_01_Implementation_Evidence.md` |
| Development Assignment 1 Independent Implementation Review and Correction Disposition | `ADO/05_Evidence/Development_Assignment_01_Independent_Implementation_Review.md` |
| Development Assignment 1 Human Physical Validation Evidence — second fresh Gate A failed at step 4; DA1-PHYS-02 correction published/CI green, independent review pending | `ADO/05_Evidence/Development_Assignment_01_Physical_Validation_Evidence.md` |
| Development Assignment 1 DA1-PHYS-01 Independent Exact-Delta Review — approved, finding closed | `ADO/05_Evidence/Development_Assignment_01_DA1_PHYS_01_Independent_Exact_Delta_Review.md` |
| Product Readiness Reassessment — C3D Closure Delta | `ADO/05_Evidence/Product_Readiness_Reassessment_2026-07-15_C3D_Closure_Delta.md` |
| EP-008 Evidence (incl. Repository Health Follow-up) | `ADO/05_Evidence/EP-008/` |
| Evidence Area | `ADO/05_Evidence/` |

## Navigation Rule

Agents shall not guess mandatory startup document paths. Agents shall locate this ADO navigation entry point through repository evidence, read it and then follow the documented startup sequence.
