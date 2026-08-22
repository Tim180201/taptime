# Block E1 — Durable Lifecycle Evidence Outbox Implementation Plan

Status: Completed — Technical Lead, GitHub CI and Independent Security Verification Passed
Date: 2026-07-14
Baseline: `9b2c8a5ed8b70a8aed5e367f6c919f439b5ac1ed`
Owner: Technical Lead / Codex implementation
Effort: High

## 1. Repository reconciliation

The post-Block-D product path already creates the correct immutable B6/C2 evidence and retries it
idempotently, but retains it only in `ProductScanOrchestrator.pendingEvidence`. Process termination
therefore loses an ambiguous command.

The older Core `OfflineQueue`/`SynchronizationService` is not a valid extension point for this path:
its `QueuedWorkEventRecord` includes a nullable client `BusinessEngineDecision`, its durable adapter
is Node file-system infrastructure, and its gateway is fake/demo-only. E1 introduces a narrow Mobile
port around the server-ready command rather than weakening the post-B6 authority boundary.

The 2026-07-14 market-research memo supports offline-first behavior with visible pending state and
server-canonical resolution, but remains non-authoritative research. E1 follows the already approved
roadmap and architecture; it does not derive a new product rule from that memo.

## 2. Implementation sequence

1. Add a single-record `LifecycleEvidenceOutbox` port containing only binding plus exact command.
2. Add a strict `ExpoSecureLifecycleEvidenceOutbox` adapter using a versioned native key,
   platform-accurate secure-storage semantics, a 2-KiB limit and closed schema.
3. Compose the adapter privately in `ProductMobileRuntime`; React receives no storage authority.
4. Load the record before NFC capability activation, persist before first lifecycle submission,
   clear before terminal UI publication, and fail closed on every persistence error.
5. Preserve Block D session-generation cancellation and same User/Organization protection.
6. Update truthful German UI copy to disclose restart durability without claiming full offline mode.
7. Add adapter, orchestrator, restart, identity-isolation, clear-failure and UI regression tests.
8. Run Mobile tests-inclusive TypeScript check, Mobile tests, Core regression, workspace build/export
   checks where applicable, migration-count guard and repository diff/security review.

## 3. Stop conditions

Stop and escalate if implementation would require a server contract/schema change, new client
business decision, automatic deletion of corrupt evidence, a raw UID/token in persistence, or a
policy choice for fully offline assignment validity. None is authorized by E1.

## 4. Closure truth

Completion may state only that one already-resolved lifecycle action is crash-safe and exactly
replayable. It must not state that TapTim.e supports arbitrary offline scanning, a multi-event queue,
background synchronization, technical-pilot readiness or full Block E completion.
