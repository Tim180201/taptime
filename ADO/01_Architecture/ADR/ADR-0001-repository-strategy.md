# ADR-0001: Repository Strategy

Status: Accepted  
Date: 2026-06-26

## Context

TapTim.e is planned as a professional time tracking product with NFC chip scanning as a core differentiating capability.

The product may evolve beyond a single mobile app and include shared domain logic, backend functions, admin tooling, exports, infrastructure configuration and automated tests.

The reference project `frogs-zeiterfassung` already contains relevant experience with React Native, Expo, Firebase and NFC, but TapTim.e must not inherit its structure without review.

## Decision

TapTim.e will use a monorepo repository strategy from the first project foundation.

Initial structure:

```text
apps/             Applications, e.g. mobile app later
packages/         Shared packages, domain modules and reusable code later
infrastructure/   Cloud, deployment and environment assets later
scripts/          Automation scripts
tests/            Cross-cutting tests and validation assets
ADO/              FDOS-aligned project knowledge base
docs/             General documentation outside ADO
.github/          GitHub automation and repository templates
```

## Rationale

A monorepo allows the project to scale without later restructuring when shared code, backend functions, a web interface or infrastructure modules become necessary.

The cost of starting with this structure is low. The cost of migrating to it later may be high.

## Consequences

Positive:

- Clear long-term structure from the beginning.
- Shared code can be introduced without repository fragmentation.
- Architecture, documentation and implementation remain in one technical source of truth.

Negative:

- The repository may look larger than the initial implementation requires.
- Governance is required to prevent unused folders from becoming noise.

## Follow-up Actions

- Keep initial folders intentionally minimal.
- Do not add app implementation until architecture baseline is documented.
- Document future stack decisions in separate ADRs.
