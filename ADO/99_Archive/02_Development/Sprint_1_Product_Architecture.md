# Sprint 1 – Product Architecture

Status: Active  
Date: 2026-06-26

## Sprint Goal

Define the professional, implementable product architecture for TapTim.e before application code is generated.

## Technical Lead Position

TapTim.e should not be modeled as a simple NFC app.

TapTim.e should be modeled as an event-based time tracking product for small and medium-sized businesses, with NFC as the primary version 1 trigger mechanism.

## Scope

In scope:

- Domain model refinement
- NFC assignment model
- Role model
- Product architecture assumptions
- Open technical questions
- Development Agent task preparation

Out of scope:

- App implementation
- Firebase implementation
- NFC library setup
- UI design
- Production release planning

## Core Product Hypothesis

Small and medium-sized businesses need time tracking that is faster, easier to confirm and less error-prone than manual search/start/stop workflows.

NFC improves time tracking because it can:

- reduce manual selection effort
- create a physical confirmation moment
- increase belonging and customer interaction
- reduce incorrect time assignments
- simplify mobile work scenarios

## Sprint Deliverables

- Updated Domain Model
- ADR-0002 NFC Assignment Model
- NFC Capability Model
- Role Model
- Research task candidates for market pain analysis
- Development Agent task candidates for later implementation

## Development Agent Hold Rule

The Development Agent must not start application implementation until:

1. ADR-0002 is reviewed by the Human Architect.
2. Stack ADR is created.
3. Basic domain entities are accepted.
4. v1 scope is explicitly frozen.

## Research Agent Candidate Task

Analyze existing time tracking systems for small and medium-sized businesses and identify recurring user complaints, missing workflows, role models, pricing patterns, NFC/QR/geofence patterns and compliance concerns.

The Research Agent must produce evidence candidates only. It must not modify the TapTim.e project.
