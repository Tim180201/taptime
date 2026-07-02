# TapTim.e

Status: Sprint 1 – Product Architecture (Sprint 0 complete)
Mode: FDOS-aligned product development  
Repository: `Tim180201/taptime`

TapTim.e is a professional time tracking product. Its defining product capability is NFC chip scanning on mobile devices.

## Mission

Build a stable, maintainable and scalable time tracking product with NFC-first mobile interaction.

## Current Phase

Product Vision, Product Principles, the Feature Blueprint Standard and ADR-0001 through ADR-0006 (plus ADR-0008) are Approved. No application stack has been finalized yet — see `ADO/01_Architecture/Tech_Stack.md`, which currently blocks Sprint 2.

For a full status snapshot, see `ADO/00_Core/Strategic_Review_2026-07-01.md` and `CHANGELOG.md`.

## Technical Leadership Principles

- Architecture before implementation
- Evidence before permanent standards
- Maintainability before speed
- Git as the technical source of truth
- Project ADO as the organizational knowledge base

## Repository Structure

```text
ADO/                 Project ADO and FDOS-aligned knowledge base
apps/                Product applications, e.g. mobile app later
packages/            Shared packages and domain modules later
docs/                General documentation outside ADO
infrastructure/      Deployment, cloud and environment definitions later
scripts/             Automation and maintenance scripts later
tests/               Cross-cutting test assets later
.github/             Pull request template; CI workflows follow the Sprint 2 stack decision
```

## Contributing

See `CONTRIBUTING.md` for the mandatory engineering order and roles. See `CHANGELOG.md` for a chronological summary of decisions.

## Reference Projects

- `Tim180201/fdos-genesis` is the FDOS reference baseline.
- `Tim180201/frogs-zeiterfassung` is a technical reference project for React Native, Expo, Firebase and NFC experience.

TapTim.e is not a copy of frogs. frogs is treated as evidence and implementation reference only.
