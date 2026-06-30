# Decision Log

Status: Active

This file is the index of important technical and organizational decisions for TapTim.e.

Full architecture decisions are documented as ADRs under `ADO/01_Architecture/ADR/`.

| ID | Title | Status | Date | Location |
|---|---|---|---|---|
| PV-0001 | Product Vision: Mission | Approved | 2026-06-26 | `ADO/01_Architecture/Product_Vision.md` |
| PV-0002 | Product Vision: Vision | Approved | 2026-06-26 | `ADO/01_Architecture/Product_Vision.md` |
| PV-0003 | Product Vision: Problem | Approved | 2026-06-26 | `ADO/01_Architecture/Product_Vision.md` |
| PV-0004 | Product Vision: Our Solution | Approved | 2026-06-26 | `ADO/01_Architecture/Product_Vision.md` |
| PV-0005 | Product Vision: Product Philosophy | Approved | 2026-06-26 | `ADO/01_Architecture/Product_Vision.md` |
| PV-0006 | Product Vision: Long-term Vision | Approved | 2026-06-26 | `ADO/01_Architecture/Product_Vision.md` |
| ADO-NAV-001 | ADO Navigation Entry Point | Draft | 2026-06-29 | `ADO/README.md` |
| AVR-001 | Artifact Validation Register | Active | 2026-06-29 | `ADO/00_Governance/AVR-001_Artifact_Validation_Register.md` |
| FBS-001 | Feature Blueprint Standard | Review Ready | 2026-06-28 | `ADO/01_Architecture/Feature_Blueprint_Standard.md` |
| TTAP-001 | TapTim.e Technical Architecture Profile | Review Ready | 2026-06-28 | `ADO/01_Architecture/Technical_Architecture_Profile.md` |
| DTP-001 | TapTim.e Development Task Profile | Review Ready | 2026-06-28 | `ADO/01_Architecture/Development_Task_Profile.md` |
| EOM-001 | TapTim.e Engineering Operating Model | Review Ready | 2026-06-28 | `ADO/01_Architecture/Engineering_Operating_Model.md` |
| AGR-001 | Official Engineering Agent Registry | Operational Configuration | 2026-06-28 | `ADO/01_Architecture/Agent_Registry.md` |
| AOF-001 | Agent Operations Framework | Validated | 2026-06-29 | `ADO/01_Architecture/Agent_Operations_Framework.md` |
| ABS-001 | Agent Bootstrap Standard | Draft | 2026-06-29 | `ADO/01_Architecture/Agent_Bootstrap_Standard.md` |
| AOS-001 | Agent Onboarding Standard | Draft | 2026-06-29 | `ADO/01_Architecture/Agent_Onboarding_Standard.md` |
| ADS-001 | Agent Discovery Standard | Draft | 2026-06-29 | `ADO/01_Architecture/Agent_Discovery_Standard.md` |
| AIR-001 | Agent Inventory Report | Draft | 2026-06-29 | `ADO/01_Architecture/Agent_Inventory_Report.md` |
| OAP-001 | Official Agent Prompt Standard | Validated | 2026-06-29 | `ADO/01_Architecture/Official_Agent_Prompt_Standard.md` |
| ALF-001 | Agent Lifecycle | Draft | 2026-06-29 | `ADO/01_Architecture/Agent_Lifecycle.md` |
| RHS-001 | Repository Health Standard | Draft | 2026-06-29 | `ADO/01_Architecture/Repository_Health_Standard.md` |
| AOG-001 | Agent Operational Guidelines | Draft | 2026-06-29 | `ADO/01_Architecture/Agent_Operational_Guidelines.md` |
| EP-006-FU-001 | Startup Sequence: Repository Discovery Before Bootstrap | Approved | 2026-06-30 | `ADO/05_Evidence/EP-006/Startup_Sequence_Followup.md` |
| EP-006-FU-002 | Startup Sequence Authority Clarification | Approved | 2026-06-30 | `ADO/05_Evidence/EP-006/Startup_Sequence_Followup.md` |
| ADR-0001 | Repository Strategy: Monorepo | Accepted | 2026-06-26 | `ADO/01_Architecture/ADR/ADR-0001-repository-strategy.md` |
| ADR-0002 | NFC Assignment Model | Accepted | 2026-06-26 | `ADO/01_Architecture/ADR/ADR-0002-nfc-assignment-model.md` |
| ADR-0003 | Product Scope v1 | Accepted Draft | 2026-06-26 | `ADO/01_Architecture/ADR/ADR-0003-product-scope-v1.md` |
| ADR-0004 | Offline-first Core Events | Accepted Draft | 2026-06-26 | `ADO/01_Architecture/ADR/ADR-0004-offline-first-core-events.md` |
| ADR-0005 | Event-driven Business Engine | Accepted Draft | 2026-06-26 | `ADO/01_Architecture/ADR/ADR-0005-event-driven-business-engine.md` |
| ADR-0006 | Domain-first Architecture | Accepted Draft | 2026-06-26 | `ADO/01_Architecture/ADR/ADR-0006-domain-first-architecture.md` |
| ADR-0007 | Technology Platform Baseline | Approved | 2026-06-30 | `ADO/01_Architecture/ADR/ADR-0007-technology-platform-baseline.md` |
| EP-007 | Product Architecture Foundation | Closed | 2026-06-30 | `ADO/02_Development/EP-007_Product_Architecture_Foundation.md` |
| FB-001 | NFC Scan Creates Work Event | Approved | 2026-06-30 | `ADO/01_Architecture/Feature_Blueprints/NFC_Scan_Creates_Work_Event.md` |
| TS-001 | NFC Scan Creates Work Event Technical Specification | Approved | 2026-06-30 | `ADO/01_Architecture/Technical_Specifications/TS-001-nfc-scan-creates-work-event.md` |

## Decision Rule

Every architectural decision must be explicit, traceable, evidence-based where possible, reversible where feasible and documented before implementation when it shapes long-term structure.

EP-006 startup follow-ups are approved and validated in AVR-001.

EP-007 established the initial Product Architecture Foundation for TapTim.e and is closed.

Repository Status:

```text
READY FOR EP-008 – Solution Foundation
```

AVR-001 records validation status for engineering artifacts.
