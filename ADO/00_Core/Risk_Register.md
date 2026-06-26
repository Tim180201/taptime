# Risk Register

Status: Active

| ID | Risk | Category | Severity | Status | Mitigation |
|---|---|---|---|---|---|
| R-001 | NFC behavior differs between devices and Android versions. | Technical | High | Open | Design NFC as isolated capability with real-device validation before release. |
| R-002 | Reusing frogs assumptions without review may import technical debt. | Architecture | High | Open | Treat frogs as evidence and reference only; document reuse decisions through ADRs. |
| R-003 | Stack decision made too early may reduce long-term maintainability. | Architecture | Medium | Open | Delay stack lock-in until architecture review and product capability mapping. |
| R-004 | Missing automated tests may block professional release quality. | Quality | High | Open | Define testing strategy before first production feature implementation. |
| R-005 | Firebase security rules may become product-critical and hard to validate manually. | Security | High | Open | Require security rules tests and release evidence before production release. |

## Risk Handling Rule

Risks are not backlog noise. A risk must either be accepted, mitigated, transferred or closed with evidence.
