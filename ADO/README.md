# TapTim.e ADO

Status: Draft Navigation Entry Point  
Epic: EP-006  
Owner: Technical Lead  
Approval Authority: Human Architect

## Purpose

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
| Architecture Decision Records (through ADR-0011) | `ADO/01_Architecture/ADR/` |
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
| Block C3A Organization Administration Architecture Authorization | `ADO/02_Development/Block_C3A_Organization_Administration_Architecture_Authorization.md` |
| Block C3B Secure Organization Bootstrap Authorization | `ADO/02_Development/Block_C3B_Secure_Organization_Bootstrap_Authorization.md` |
| Block C3B Secure Organization Bootstrap Closure | `ADO/02_Development/Block_C3B_Secure_Organization_Bootstrap_Closure.md` |
| Block C3C Normal Administration Backend/API Authorization | `ADO/02_Development/Block_C3C_Normal_Administration_Backend_Authorization.md` |
| Block C3C Normal Administration Backend/API Closure | `ADO/02_Development/Block_C3C_Normal_Administration_Backend_Closure.md` |
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
| Block C3A Independent Architecture/Security Review | `ADO/05_Evidence/Block_C3A_Independent_Architecture_Security_Review.md` |
| Block C3B Independent Architecture/Security Review | `ADO/05_Evidence/Block_C3B_Independent_Architecture_Security_Review.md` |
| Block C3B Secure Organization Bootstrap Evidence | `ADO/05_Evidence/Block_C3B_Secure_Organization_Bootstrap_Evidence.md` |
| Block C3C Independent Architecture/Security Review (exact-SHA final approved) | `ADO/05_Evidence/Block_C3C_Independent_Architecture_Security_Review.md` |
| Block C3C Normal Administration Backend/API Implementation and Closure Evidence | `ADO/05_Evidence/Block_C3C_Normal_Administration_Backend_Evidence.md` |
| EP-008 Evidence (incl. Repository Health Follow-up) | `ADO/05_Evidence/EP-008/` |
| Evidence Area | `ADO/05_Evidence/` |

## Navigation Rule

Agents shall not guess mandatory startup document paths. Agents shall locate this ADO navigation entry point through repository evidence, read it and then follow the documented startup sequence.
