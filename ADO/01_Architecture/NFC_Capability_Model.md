# NFC Capability Model

Status: Sprint 1 Draft  
Date: 2026-06-26

## Purpose

This document defines NFC as a product capability for TapTim.e.

NFC is a primary interaction mechanism, but it must not own the business domain.

## Capability Boundary

The NFC capability is responsible for:

- detecting NFC tags on supported mobile devices
- reading a technical tag identifier
- creating a raw scan event
- passing the scan event to the business layer
- reporting scan errors and unsupported device states

The NFC capability is not responsible for:

- deciding whether work starts or stops
- deciding which customer or project is billed
- creating final time entries directly
- enforcing organization permissions alone
- owning the time tracking state machine

## Flow

```text
Mobile Device
  -> NFC Tag detected
  -> Scan Event created
  -> Assignment resolved
  -> Work Event created
  -> Business Rules evaluated
  -> Time Entry started/stopped/updated
```

## Version 1 UX

The user-facing version 1 flow may be:

```text
Employee opens app
  -> Employee scans customer NFC tag
  -> App starts time tracking
  -> Employee scans same tag again
  -> App stops time tracking
```

This UX is intentionally simple.

The internal architecture remains event-based.

## Required Failure States

The product must handle at least:

- NFC not available on device
- NFC disabled
- tag not assigned
- tag assigned to inaccessible target
- duplicate scan
- scan while another timer is active
- scan conflict caused by offline state
- invalid or retired tag assignment

## Audit Principle

A scan event should be treated as evidence. It should not be silently overwritten.

If a scan cannot become a valid time entry, the system should preserve enough information for debugging and operational support, subject to privacy and retention rules.

## Open Technical Questions

- Which NFC identifier should be used as stable tag identity?
- Do we need tag provisioning inside the app?
- Should tags be writeable or read-only?
- What is the minimum supported Android version?
- Is iOS NFC support in scope for v1?
- How do we validate behavior on real devices?
