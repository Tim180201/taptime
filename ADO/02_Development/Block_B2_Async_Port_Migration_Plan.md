# Block B2 — Async Port Migration Implementation Plan

Status: Technical Lead Review Passed — Publication CI Pending, No Production Adapter
Date: 2026-07-13
Owner: Implementation Agent
Approval Authority: Technical Lead
Architecture Authority: `ADO/01_Architecture/ADR/ADR-0008-backend-tenant-isolation-and-async-foundation.md`

## Objective

Migrate every effectful Core boundary and every caller to an unambiguous Promise contract so future backend/network adapters cannot be called synchronously. Preserve all current decisions, events, ordering and result types. No production adapter, HTTP API, Supabase integration, cloud resource or Block D runtime composition is introduced.

## Port Inventory and Target Contract

| Port | Effectful methods migrated to Promise |
|---|---|
| `AuthenticationGateway` | `authenticate` |
| `CustomerRepository` | `findById`, `save` |
| `MembershipRepository` | `findByUserId`, `save` |
| `NfcAssignmentRepository` | `findActiveByTagId`, `save` |
| `NfcScanPort` | `scan` |
| `NfcTagRepository` | `findByPayload`, `register` |
| `OfflineQueue` | `enqueue`, `findPending`, `updateSyncState` |
| `OrganizationRepository` | `findById`, `save` |
| `SynchronizationGateway` | `synchronize` |
| `TimeEntryRepository` | `findActiveByUser`, `save`, `update` |
| `WorkEventCreationPort` | `handleValidatedAssignment` |
| `WorkEventRepository` | `findLatestByUserAndTarget`, `save` |

Every method returns exactly `Promise<T>` or `Promise<void>`; `T | Promise<T>` is prohibited.

## Implementation and Caller Inventory

- In-memory repositories: Customer, Membership, NfcAssignment, NfcTag, OfflineQueue, Organization, TimeEntry and WorkEvent.
- File adapters: OfflineQueue, TimeEntryRepository and WorkEventRepository; their shared `JsonFileStore` remains an internal synchronous filesystem helper hidden behind async port methods.
- Gateways/adapters: FakeAuthenticationGateway, FakeSynchronizationGateway, FakeNfcScanAdapter, CliNfcScanAdapter and Mobile `RnNfcScanAdapter`.
- Orchestrators/services: SessionService, NfcScanApplicationService, WorkEventCreationService, SynchronizationService, OrganizationManagementService, MembershipService and OrganizationAdministrationService.
- Repository-dependent business-area coordinators: AssignmentResolver and AssignmentValidator become async only because they await repository I/O; their decision functions and result semantics remain unchanged.
- Composition/callers: `runScan` pipeline, `runScanCli`, Mobile LoginScreen/ScanScreen/AppNavigator flows and all Core/Mobile tests/test doubles.

## Slices

1. Change all twelve port interfaces to exact Promise contracts.
2. Migrate every adapter/repository implementation without changing stored data or behavior.
3. Propagate `async`/`await` through services, resolver/validator and orchestration in the existing operation order.
4. Update CLI/Mobile composition roots and every test caller; prohibit fire-and-forget.
5. Use the tests-inclusive TypeScript configuration as the completeness gate and search for synchronous effect calls or union Promise contracts.
6. Run Core/Mobile and B1 regression suites, then record B2 evidence and governance status.

## Preserved Synchronous Boundaries

`BusinessEngine`, `WorkEventFactory`, `MembershipAuthorizationValidator`, domain objects/events, classifiers, presenters and other I/O-free functions remain synchronous and pure.

## Verification Gates

- Root TypeScript check including Core tests and Mobile.
- All Core and Mobile tests with exact counts.
- Core build.
- Backend B1 typecheck, direct PostgreSQL tests and build.
- Static inventory checks: no effectful synchronous port signature, no `T | Promise<T>`, no un-awaited effect call.
- `git diff --check`, product-semantics diff review and expected-file scope review.

## Non-Goals

- No productive PostgreSQL/Supabase repository adapter, HTTP API, Auth provider or cloud configuration.
- No new Business Rule, event/result variant, synchronization meaning or rejection reason.
- No Block D mobile runtime composition or physical NFC validation.
- No commit or push.

## Implementation Result

All twelve inventoried effectful ports, their existing adapters/test doubles and every repository caller have been migrated to exact Promise contracts. Awaited sequencing is explicit from Mobile/CLI entry points through Application Services to repositories and gateways; synchronous Domain and Business Rules remain unchanged. Verification and residual gates are recorded in `ADO/05_Evidence/Block_B2_Async_Port_Migration_Evidence.md`. This implementation does not authorize Block B3.
