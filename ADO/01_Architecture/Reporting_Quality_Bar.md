# Reporting Quality Bar — v1

Status: Recommendation — pending Technical Lead review (see `ADO/05_Evidence/EP-002/Research_Agent_Recommendations.md`)
Date: 2026-07-02
Related: ADR-0003 (Product Scope v1), `EV-0007-time-tracking-market-research.md`

## Purpose

ADR-0003 currently scopes v1 reporting as "basic export/reporting" without further definition. `EV-0007-time-tracking-market-research.md` shows that TimeDock — the closest existing precedent to TapTim.e's own approach (NFC-token-based time tracking, 92% user satisfaction) — is criticized specifically for weak reporting. If TapTim.e treats reporting as an afterthought, it inherits the one significant weakness of the product most similar to it, while a genuinely reliable NFC layer goes unnoticed because the output around it is thin.

This document does not expand v1 scope. It defines what "basic" must actually mean so it isn't reinterpreted as "minimal effort" during implementation.

## Minimum v1 Reporting Requirements

- Export of Time Entries as CSV, filterable by date range, employee and customer/assignment target.
- A summary view (totals per employee, per customer, per period) and a detail view (individual Time Entries with start, end, duration, assignment target).
- Every exported Time Entry must be traceable back to the Work Event(s) and Scan Event(s) it originated from — consistent with the Audit Principle and ADR-0008's no-silent-drop rule.
- Corrections and manually entered Time Entries must be visibly distinguishable from NFC-derived ones in any report, not merged indistinguishably.
- Export must be usable by a non-technical Administrator without support intervention — this is a usability bar, not just a data bar.

## Explicitly Still Out of Scope for v1

- Custom report builders or configurable dashboards.
- Scheduled/automated report delivery (e.g. emailed weekly summaries).
- Payroll-system-specific export formats (DATEV, etc.) — noted as a candidate for a later sprint, not v1.

## Rationale

This keeps ADR-0003's scope discipline intact (no new features are added) while preventing "basic" from silently becoming "neglected" once implementation pressure hits. It is cheaper to define this now than to explain to an early pilot customer why exporting their own time data is painful.

## Review Trigger

Revisit before Sprint 8 (Pilot Validation) — the pilot (proposed: `frogs. Nachhilfe UG`) will be the first real test of whether this bar is sufficient for actual business use.
