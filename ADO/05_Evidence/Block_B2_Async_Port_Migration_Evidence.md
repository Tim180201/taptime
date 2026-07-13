# Block B2 — Async Port Migration Implementation Evidence

Status: Technical Lead Review Passed — Publication CI Pending, B3 Not Authorized
Date: 2026-07-13
Owner: Implementation Agent
Approval Authority: Technical Lead
Architecture Authority: `ADO/01_Architecture/ADR/ADR-0008-backend-tenant-isolation-and-async-foundation.md`
Plan: `ADO/02_Development/Block_B2_Async_Port_Migration_Plan.md`

## 1. Result

Block B2 migrates every currently effectful Core port to an exact Promise contract and propagates explicit `await` through all existing adapters, Application Services, composition roots, Mobile/CLI callers and tests. No signature uses `T | Promise<T>`. Domain objects and pure Business Rules remain synchronous. Observable scan, lifecycle, authorization and synchronization semantics are unchanged.

Technical Lead follow-up finding closed: `RnNfcScanAdapter.scan()` no longer returns a buffered prior result. It delegates to the native asynchronous capture path, waits for tag detection, maps `registerTagEvent()` failure to the unchanged `unreadable` result and shares the adapter's one-time NFC-manager startup guard with `waitForNextTag()` and capability checks.

No productive PostgreSQL/Supabase adapter, HTTP API, cloud resource, authentication provider or new dependency is introduced. Block B3 is not started or authorized by this evidence.

## 2. Complete Port Inventory

| Effectful port | Async contract after B2 |
|---|---|
| `AuthenticationGateway` | `authenticate(...) -> Promise<AuthenticationResult>` |
| `CustomerRepository` | `findById(...) -> Promise<Customer \| null>`; `save(...) -> Promise<void>` |
| `MembershipRepository` | `findByUserId(...) -> Promise<Membership \| null>`; `save(...) -> Promise<void>` |
| `NfcAssignmentRepository` | `findActiveByTagId(...) -> Promise<NfcAssignment \| null>`; `save(...) -> Promise<void>` |
| `NfcScanPort` | `scan() -> Promise<NfcScanCaptureResult>` |
| `NfcTagRepository` | `findByPayload(...) -> Promise<NfcTag \| null>`; `register(...) -> Promise<void>` |
| `OfflineQueue` | `enqueue(...)`, `findPending(...)`, `updateSyncState(...)` return Promises |
| `OrganizationRepository` | `findById(...) -> Promise<Organization \| null>`; `save(...) -> Promise<void>` |
| `SynchronizationGateway` | `synchronize(...) -> Promise<SynchronizationResult>` |
| `TimeEntryRepository` | `findActiveByUser(...)`, `save(...)`, `update(...)` return Promises |
| `WorkEventCreationPort` | `handleValidatedAssignment(...) -> Promise<void>` |
| `WorkEventRepository` | `findLatestByUserAndTarget(...)`, `save(...)` return Promises |

The inventory was derived from all interfaces under `packages/core/src/ports` and all source imports/usages. Pure value types and inbound presenter/classifier contracts without I/O were not made asynchronous.

## 3. Migrated Implementations

| Boundary | Implementations |
|---|---|
| In-memory repositories | Customer, Membership, NfcAssignment, NfcTag, OfflineQueue, Organization, TimeEntry, WorkEvent |
| File adapters | OfflineQueue, TimeEntryRepository, WorkEventRepository |
| Authentication/sync doubles | FakeAuthenticationGateway, FakeSynchronizationGateway |
| Scan adapters | FakeNfcScanAdapter, CliNfcScanAdapter, Mobile `RnNfcScanAdapter` |
| Test doubles | Inline Vitest mocks and repository/gateway doubles in Core and Mobile tests |

The file adapters retain synchronous private file-store helpers as implementation details but expose only asynchronous port methods. In-memory and fake adapters also return Promises so tests exercise the same caller contract required by future remote adapters.

## 4. Migrated Callers and Ordering

| Caller layer | Migrated callers |
|---|---|
| Application Services | SessionService, NfcScanApplicationService, WorkEventCreationService, SynchronizationService, OrganizationManagementService, MembershipService, OrganizationAdministrationService |
| Repository-dependent coordinators | AssignmentResolver, AssignmentValidator |
| Composition roots and CLI | `buildScanDemoPipeline`, `runScanCli` |
| Mobile | LoginScreen and ScanScreen event handlers; AppNavigator continues to consume the resulting session state |
| Tests | All affected Core and Mobile callers and assertions |

The existing order remains explicit:

1. NFC scan, assignment resolution, assignment validation and WorkEvent creation are awaited sequentially.
2. WorkEvent creation awaits prior event lookup, pure BusinessEngine evaluation, WorkEvent persistence, TimeEntry save/update and offline enqueue in the pre-existing order.
3. Synchronization processes pending records sequentially and awaits gateway completion before updating each queue state.
4. Organization administration awaits authorization-dependent repository reads before writes; rejected paths still perform no write.

No production call site intentionally discards a Promise and no fire-and-forget path was introduced.

## 5. Preserved Synchronous Boundaries

`BusinessEngine`, `WorkEventFactory`, `MembershipAuthorizationValidator`, domain objects/events, classifiers and presenters remain synchronous. AssignmentResolver and AssignmentValidator are asynchronous only at their repository boundary; their classifications and result vocabularies are unchanged.

`NfcScanPort.scan()` is honestly asynchronous: the Mobile adapter delegates it to the native capture path and resolves only after tag detection or capture-registration failure. The former `latestResult` buffer has been removed. The existing `waitForNextTag()` helper remains available and uses the same capture path; the current `ScanScreen` composition is intentionally unchanged. Block C/D runtime composition and physical NFC validation remain outstanding.

## 6. Verification Evidence

| Check | Result |
|---|---|
| Root tests-inclusive TypeScript check | Passed |
| Core tests | 262 passed |
| Mobile tests | 10 passed |
| Core build | Passed |
| Backend B1 TypeScript check | Passed |
| Backend B1 direct PostgreSQL tests | 39 passed, 2 Supavisor-mode tests skipped |
| Backend B1 build | Passed |
| Promise-contract/static caller inventory | No mixed `T | Promise<T>` contract; no un-awaited effect call found |
| `git diff --check` | Passed |

The direct B1 regression used the existing disposable local PostgreSQL setup and synthetic B1 runtime credential. Supavisor Session and Transaction modes were not retested and remain unverified.

## 7. Boundaries and Remaining Gates

- Technical Lead review accepts the corrected B2 diff locally; successful publication CI remains the closure gate.
- No productive backend adapter exists; B1 remains a spike, not a production repository implementation.
- Supavisor Session/Transaction compatibility remains a pre-production deployment gate.
- Block B3 must not begin without explicit authorization after this review.
- Mobile still uses the current demo/runtime composition; real Auth, HTTP, Sync and physical NFC validation are later blocks.
- The migration deliberately does not add cancellation, retries, parallel synchronization or new error mapping because each could change observable behavior.

## 8. Recommendation

The Technical Lead accepts the corrected B2 implementation locally because the complete effectful boundary is Promise-based, all current callers await it, regression suites retain their exact counts, the native NFC adapter now performs a real asynchronous capture and the pure Core boundary remains synchronous. B2 closes only after successful publication CI. This acceptance is not approval for B3.
