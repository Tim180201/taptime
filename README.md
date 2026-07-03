# TapTim.e

Status: EP-008 – Developer Implementation Manual (EP-007 Product Architecture Foundation closed)  
Mode: FDOS-aligned product development  
Repository: `Tim180201/taptime`

TapTim.e is a professional time tracking product. Its defining product capability is NFC chip scanning on mobile devices.

## Mission

Build a stable, maintainable and scalable time tracking product with NFC-first mobile interaction.

## Current Phase

EP-007 (Product Architecture Foundation) is closed: the platform baseline (ADR-0007), the Technical Architecture Profile (TTAP-001), the first Feature Blueprint (FB-001) and its Technical Specification (TS-001) are approved. The repository is `READY FOR EP-008 – Solution Foundation` per the Decision Log.

EP-008 (Developer Implementation Manual) is in progress. See `ADO/01_Architecture/Developer_Implementation_Manual/` for the chapters completed so far.

For the authoritative current status, see `ADO/00_Core/Decision_Log.md` and `ADO/00_Core/Project_Status.md`. For the official agent/contributor entry point into the engineering knowledge base, see `ADO/README.md`.

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
