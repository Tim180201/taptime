# TapTim.e ADO

Status: Draft Navigation Entry Point  
Epic: EP-006  
Owner: Technical Lead  
Approval Authority: Human Architect

## Purpose

This file is the official navigation entry point for the TapTim.e ADO.

Every Human and AI Agent shall read this document after ABS-001 has completed successfully and before AOS-001 begins.

FDOS Rule:

> Every engineering document required for agent initialization shall be reachable through one official ADO entry point.

## Agent Startup Order

```text
GitHub Connection Verification
  -> ABS-001 Agent Bootstrap Standard
  -> ADO/README.md
  -> AOS-001 Agent Onboarding Standard
  -> ADS-001 Agent Discovery Standard
  -> RHS-001 Repository Health Standard
  -> AIR-001 Agent Inventory Report
  -> READY FOR WORK
  -> EOM-001 Engineering Operating Model
  -> AGR-001 Agent Registry
  -> Role Execution
```

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
| Technical Architecture Profile | `ADO/01_Architecture/Technical_Architecture_Profile.md` |
| Development Task Profile | `ADO/01_Architecture/Development_Task_Profile.md` |
| Architecture Decision Records | `ADO/01_Architecture/ADR/` |

## Development

| Document | Location |
|---|---|
| EP-006 Validation Sprint | `ADO/02_Development/EP-006_Validation_Sprint.md` |
| Development Area | `ADO/02_Development/` |

## Evidence

| Document | Location |
|---|---|
| Evidence Area | `ADO/05_Evidence/` |

## Agent Rule

If this ADO entry point cannot be found, the agent shall report:

```text
STATUS: BLOCKED
Reason: ADO navigation entry point unavailable.
Required Action: Provide ADO/README.md or repository inventory.
```

## Navigation Rule

Agents shall not guess mandatory startup document paths when this index provides a stable path.
