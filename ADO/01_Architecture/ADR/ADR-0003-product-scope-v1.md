# ADR-0003: Product Scope v1

Status: Accepted Draft  
Date: 2026-06-26

## Context

TapTim.e is intended to become a professional product for small and medium-sized businesses.

The project must avoid scope creep during the first implementation phase.

The product vision is broader than simple time tracking, but version 1 must remain focused and implementable.

## Decision

Version 1 of TapTim.e will focus on NFC-first time tracking for small and medium-sized businesses.

The core experience is:

```text
Employee scans assigned NFC tag
  -> System creates work event
  -> Engine decides start or stop
  -> Time entry is created or completed
```

## In Scope for v1

- Organization account
- User authentication
- Basic role model
- Employee users
- Customer records
- NFC tag registration
- NFC tag assignment to customers
- NFC scan event capture
- Work event creation
- Automatic start/stop decision for customer-related work
- Time entries
- Own time overview for employees
- Basic admin overview
- Basic export/reporting
- Offline capture of core work events

## Explicitly Out of Scope for v1

- Payroll processing
- Full ERP functionality
- Accounting integrations
- Advanced shift planning
- Vacation management
- Complex approval workflows
- Multi-trigger support beyond NFC/manual fallback
- GPS tracking as primary feature
- Public API
- Advanced billing
- Customer self-service portal

## Rationale

The first version must prove the core product promise:

> One Tap. One Decision.

If this experience is not excellent, additional features will not make the product successful.

## Consequences

Positive:

- Clear implementation boundary for the Development Agent.
- Reduced risk of building an unfocused ERP-like product.
- Stronger product identity around NFC-first time tracking.

Negative:

- Some common HR/time-tracking features are intentionally postponed.
- Customers needing full workforce management may not be served by v1.

## Review Trigger

This ADR must be reviewed before implementing any feature outside the v1 scope.

---

## Revision 2026-07-02 (Recommendation — not yet integrated, pending Technical Lead review, see `ADO/05_Evidence/EP-002/Research_Agent_Recommendations.md`)

### Context for Revision

`EV-0007-time-tracking-market-research.md` identifies forgotten clock-outs as roughly half of the largest quantified pain point across existing time tracking products (the other half, forgotten clock-in, is already addressed by NFC-first design). NFC solves "did I start tracking" through a physical trigger, but does nothing by itself for "did I remember to tap out."

### Proposed Addition to In Scope for v1

- **Open Session Reminder**: a local, time-based reminder (not GPS, not location-based) triggered when a Work Event has been open unusually long without a corresponding stop scan. Implemented as elapsed-time-on-an-open-session logic inside the Business Engine, surfaced as a device notification to the Employee.

This does not conflict with "GPS tracking as primary feature: out of scope" above, since it requires no location data — only the elapsed duration of an already-open Work Event, which the domain model already tracks.

### Rationale for Revision

Cheap to add now (it is a Business Engine rule plus a local notification, not a new subsystem), and it closes the one half of the industry's single biggest named complaint that NFC does not already solve by itself.

### Status

Recommendation only. Not reflected in "In Scope for v1" above pending Technical Lead review — see `ADO/05_Evidence/EP-002/Research_Agent_Recommendations.md`.

