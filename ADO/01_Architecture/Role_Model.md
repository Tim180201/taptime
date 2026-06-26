# Role Model

Status: Sprint 1 Draft  
Date: 2026-06-26

## Purpose

This document defines the initial role model for TapTim.e.

The role model must remain simple enough for small and medium-sized businesses while supporting professional permissions and future approval workflows.

## Initial Roles

| Role | Description | Primary Responsibilities |
|---|---|---|
| System Owner | Highest account-level owner for an organization. | Organization ownership, final administrative control, billing/governance later |
| Administrator | Operational admin within the organization. | Users, customers, NFC tags, assignments, settings |
| Team Lead | Person responsible for reviewing operational time data. | Review team time entries, approve/correct entries later, reports |
| Employee | Person whose work is tracked. | Scan NFC tags, create work events, view own time |

## Permission Principles

- Employees should not be able to manipulate organization-wide configuration.
- NFC tag assignment must be restricted to trusted roles.
- Time entry corrections must be auditable.
- Approval workflows should be introduced only after the basic time tracking flow is stable.
- System Owner and Administrator are separate roles to support future billing/governance distinction.

## Version 1 Minimal Permission Matrix

| Capability | System Owner | Administrator | Team Lead | Employee |
|---|---:|---:|---:|---:|
| Manage organization settings | Yes | Partial | No | No |
| Manage users | Yes | Yes | No | No |
| Manage customers | Yes | Yes | Partial later | No |
| Manage NFC tags | Yes | Yes | No | No |
| Assign NFC tags | Yes | Yes | No | No |
| Scan NFC tags | Yes | Yes | Yes | Yes |
| View own time entries | Yes | Yes | Yes | Yes |
| View team time entries | Yes | Yes | Yes | No |
| Export reports | Yes | Yes | Later | No |
| Approve time entries | Yes | Yes | Later | No |

## Open Questions

- Does TapTim.e need a customer-facing confirmation role later?
- Should Team Lead exist in v1 or only after approval workflows?
- Can one user have multiple roles?
- Are roles organization-specific or global?
