# Product Principles

Status: Accepted Draft  
Date: 2026-06-26  
Owner: Human Architect + Technical Lead  
Source: `ADO/01_Architecture/Product_Vision.md`

## Purpose

This document defines the product principles that guide TapTim.e decisions.

When product behavior, UX or architecture is unclear, decisions should be checked against these principles before implementation.

These principles derive from the completed EP-001 Product Vision and must support its mission, vision and product philosophy.

## Principle 1: One Tap. One Decision.

A single user interaction should create one clear work event.

The user should not need to decide whether the action is a start, stop, pause or correction unless the engine cannot decide safely.

## Principle 2: The Engine Decides.

The business engine decides what a trigger means.

A trigger does not directly create final business records.

```text
Trigger
  -> Work Event
  -> Business Engine
  -> Time Entry
```

## Principle 3: Zero Decision UX.

TapTim.e should minimize user decisions during operational work.

Dialogs, confirmations and manual selection flows are acceptable only when they reduce real risk or resolve ambiguity.

## Principle 4: Offline by Default.

The user should not need to think about network availability during core time tracking.

Core work events must be capturable offline and synchronized later.

## Principle 5: Everything is Auditable.

Work events and time entries must be traceable.

Corrections should not destroy the original operational history.

## Principle 6: NFC is a Primary Trigger, Not the Domain.

NFC is the first and most important trigger mechanism, but the domain must remain trigger-agnostic.

The business model is based on work events and time entries, not on NFC records directly.

## Principle 7: Professional Simplicity.

The product should feel simple to the user while remaining internally robust, testable and extensible.

Simplicity must not mean hidden data loss, missing auditability or untestable business rules.

## Product Identity

TapTim.e should feel like:

```text
Tap
  -> Time
```

But internally it behaves like:

```text
Tap
  -> Work Event
  -> Engine Decision
  -> Time Result
```
