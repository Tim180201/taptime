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
