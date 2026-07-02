# Pricing Principles

Status: Accepted
Date: 2026-07-02
Approved by Human Architect: 2026-07-02
Related: `Product_Vision.md`, `Product_Principles.md`, `EV-0003-time-tracking-market-research.md`

## Purpose

No pricing or monetization model exists yet for TapTim.e, and building one is not urgent before implementation. But `EV-0003-time-tracking-market-research.md` shows that pricing behavior — not just product quality — is a recurring, trust-destroying failure mode in this market: Harvest's 600% price increase after an acquisition, and Clockify locking core-feeling functionality (approvals, GPS, time-off) behind paid tiers, are both cited as reasons users lose trust in a product they otherwise found adequate.

This document commits to a small number of pricing principles now, while they are free, rather than after a precedent has already been set that would be expensive or embarrassing to reverse.

## Principles

### 1. Core time tracking is never feature-gated.

The core promise — NFC scan, work event creation, start/stop decision, time entry — must be available on every paid plan. Reporting depth, integrations, or organizational scale (number of seats, locations) may reasonably differentiate plans. The act of tracking time itself must not.

### 2. Pricing changes are never retroactive on existing customers without notice and a grace period.

If pricing changes, existing customers are given advance notice and a defined transition period. Price changes are never applied silently or immediately to an active contract.

### 3. Pricing is predictable, not usage-anxiety-inducing.

Per-seat or per-organization pricing is acceptable. Pricing structures that make customers afraid to use the product fully (e.g. punitive per-scan or per-event pricing) are not consistent with the product's own "Zero Decision UX" philosophy — customers should not have to think about cost every time an employee taps a tag.

### 4. Transparency over promotional framing.

Pricing pages and quotes state what is and is not included plainly. No feature that is later paywalled should first be demonstrated as if freely included.

## Rationale

This is a Human Architect-owned business decision, not a technical one — it is documented here because `Product_Principles.md` already establishes that product trust and simplicity are core to TapTim.e's identity, and pricing is where several competitors visibly betrayed that same promise. Committing to this now costs nothing; reversing a bad pricing precedent later costs customer trust the same way it did for the competitors in EV-0003.

## Status

Approved as guiding principle. This does not require any implementation work at this stage; it binds future pricing decisions, not current architecture.

## Review Trigger

Revisit before Sprint 10 (GA Release), when a concrete pricing model must exist.
