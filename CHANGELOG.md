# Changelog

All notable decisions and structural changes to TapTim.e are recorded here. Full architecture rationale lives in `ADO/01_Architecture/` and `ADO/00_Core/Decision_Log.md`; this file is a chronological summary, not a replacement for either.

## Unreleased

No application code exists yet. EP-007 (Product Architecture Foundation) is closed; EP-008 (Developer Implementation Manual) is in progress; Development Sprint 001 (first implementation) is ready to begin pending Technical Lead / Human Architect direction.

### Added
- EP-001 Product Vision and Product Principles (Approved).
- ADR-0001 through ADR-0007: repository strategy, NFC assignment model, v1 scope, offline-first, event-driven engine, domain-first architecture, technology platform baseline (Approved).
- Feature Blueprint Standard, Development Task Profile, Engineering Operating Model, Agent Registry (EP-002-EP-005).
- EP-006 Agent Operations Framework and official startup sequence (`ADO/README.md`).
- EP-007: TTAP-001 extension, FB-001 (NFC Scan Creates Work Event), TS-001, EP-007 Development Tasks (DT-001-DT-010) — first Feature Blueprint/Technical Specification pair, all Approved.
- EP-008 Developer Implementation Manual, Chapters 00-03 (Draft).
- Repository Health Sprint 001 and Repository Maintenance Sprint 002: closed known status/traceability inconsistencies ahead of implementation.
- Repository scaffolding: `.gitignore`, `CODEOWNERS`, `CONTRIBUTING.md`, PR template.

### Changed
- Consolidated the Feature Blueprint Standard into one Review Ready document (superseded the part-based working draft).
- Superseded the pre-EP-006/EP-007 `AI Technical Lead Charter` and an earlier strategic review with `ADO/README.md`, EOM-001 and AGR-001. Note: on this branch's history, `ADO/99_Archive/` currently contains no files (only `.gitkeep`) — the superseded documents were archived on a separate branch (`architecture/ep-002-feature-blueprint-standard` and variants) and have not been carried into `main`. See Repository Maintenance Sprint 002 for this finding.

### Resolved
- ADR-0007 (Technology Platform Baseline): Approved (previously tracked here as "Not Decided").
