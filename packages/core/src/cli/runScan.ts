import { OrganizationId, UserId, CustomerId, NfcTagId, NfcAssignmentId } from '../domain/ids';
import { createNfcPayload } from '../domain/NfcPayload';
import { customerAssignmentTarget } from '../domain/AssignmentTarget';
import { authenticatedCaller, type CallerContext } from '../domain/CallerContext';
import type { Customer } from '../domain/Customer';
import type { NfcTag } from '../domain/NfcTag';
import type { NfcAssignment } from '../domain/NfcAssignment';
import { InMemoryNfcTagRepository } from '../infrastructure/repositories/InMemoryNfcTagRepository';
import { InMemoryNfcAssignmentRepository } from '../infrastructure/repositories/InMemoryNfcAssignmentRepository';
import { InMemoryCustomerRepository } from '../infrastructure/repositories/InMemoryCustomerRepository';
import { InMemoryWorkEventRepository } from '../infrastructure/repositories/InMemoryWorkEventRepository';
import { InMemoryTimeEntryRepository } from '../infrastructure/repositories/InMemoryTimeEntryRepository';
import { InMemoryOfflineQueue } from '../infrastructure/repositories/InMemoryOfflineQueue';
import { CliNfcScanAdapter } from '../infrastructure/adapters/CliNfcScanAdapter';
import { FakeSynchronizationGateway } from '../infrastructure/adapters/FakeSynchronizationGateway';
import { AssignmentResolver } from '../business/AssignmentResolver';
import { AssignmentValidator } from '../business/AssignmentValidator';
import { WorkEventFactory } from '../business/WorkEventFactory';
import { BusinessEngine } from '../business/BusinessEngine';
import { NfcScanApplicationService } from '../application/NfcScanApplicationService';
import { WorkEventCreationService } from '../application/WorkEventCreationService';
import { SynchronizationService } from '../application/SynchronizationService';
import { ScanResultPresenter } from '../application/ScanResultPresenter';
import type { ScanPipelineOutcome } from '../application/ScanPipelineOutcome';
import type { OfflineQueue } from '../ports/OfflineQueue';
import type { WorkEventRepository } from '../ports/WorkEventRepository';
import type { TimeEntryRepository } from '../ports/TimeEntryRepository';

// Demo-only seed data (not production seed data): one Organization, one authenticated
// employee, one Customer, one NfcTag and one active NfcAssignment - sufficient to drive one
// realistic scenario (Development Sprint 005 Plan, Section 6).
export const DEMO_KNOWN_PAYLOAD = 'demo-tag-payload';

export type DemoSyncOutcome = 'success' | 'retryable_failure' | 'conflict';

export interface ScanDemoPipeline {
  scan(rawPayload: string | undefined, caller?: CallerContext): Promise<ScanPipelineOutcome>;
  synchronizePending(outcome?: DemoSyncOutcome): Promise<void>;
}

// DT-015: substitutes durable adapter instances for the default in-memory ones. Deliberately
// typed against the port interfaces only (WorkEventRepository/TimeEntryRepository/
// OfflineQueue), not a storage-technology-specific shape such as a directory path - type-only
// imports are erased at compile time, so this file never needs a runtime import of `fs`/
// `path` or the File*-adapter classes themselves. This is a required deviation from
// Development_Sprint_010_Plan.md Section 6's literal "directory/file path" wording: this
// module (via packages/core/src/index.ts's barrel export) is imported by apps/mobile, and a
// runtime `fs`/`path` import here breaks Metro bundling entirely (Node's `fs` has no React
// Native equivalent) - discovered and documented in this sprint's implementation notes.
// Building the actual durable instances (which does need `fs`/`path`) is the Node-only CLI's
// job - see runScanCli.ts.
export interface ScanDemoStorageOptions {
  readonly workEventRepository: WorkEventRepository;
  readonly timeEntryRepository: TimeEntryRepository;
  readonly offlineQueue: OfflineQueue;
}

// DT-011 composition root. Wires DT-001-DT-008's existing, unmodified production classes
// into one runnable program driven by real (non-hard-coded-fixture) input. Introduces no new
// business decision logic - every accept/reject/escalate/sync decision remains exactly where
// AssignmentResolver/AssignmentValidator/BusinessEngine/SynchronizationService already put it.
export function buildScanDemoPipeline(
  output: (line: string) => void = (line) => console.log(line),
  storage?: ScanDemoStorageOptions,
): ScanDemoPipeline {
  const organizationId = OrganizationId('demo-org');
  // Default demo caller, preserved for the existing CLI usage (npm run demo:scan) when no
  // externally-produced CallerContext (e.g. from a real SessionService sign-in, DT-013) is
  // supplied to scan() - see DT-014, Development Sprint 008 Plan Section 6.
  const defaultCaller = authenticatedCaller(UserId('demo-employee'), organizationId);

  const customerId = CustomerId('demo-customer');
  const customer: Customer = { id: customerId, organizationId, active: true };

  const tagId = NfcTagId('demo-tag');
  const tag: NfcTag = { id: tagId, organizationId, payload: createNfcPayload(DEMO_KNOWN_PAYLOAD) };

  const assignment: NfcAssignment = {
    id: NfcAssignmentId('demo-assignment'),
    organizationId,
    nfcTagId: tagId,
    target: customerAssignmentTarget(customerId),
    active: true,
  };

  // DT-015: durable adapters when supplied, in-memory otherwise - the exact
  // additive-parameter pattern established for CallerContext in Development Sprint 008. The
  // three ports/behavioral contracts are identical either way.
  const workEventRepository: WorkEventRepository = storage?.workEventRepository ?? new InMemoryWorkEventRepository();
  const timeEntryRepository: TimeEntryRepository = storage?.timeEntryRepository ?? new InMemoryTimeEntryRepository();
  const offlineQueue: OfflineQueue = storage?.offlineQueue ?? new InMemoryOfflineQueue();
  const synchronizationGateway = new FakeSynchronizationGateway();
  const presenter = new ScanResultPresenter();

  const resolver = new AssignmentResolver(
    new InMemoryNfcTagRepository([tag]),
    new InMemoryNfcAssignmentRepository([assignment]),
  );
  const validator = new AssignmentValidator(new InMemoryCustomerRepository([customer]));
  const workEventCreationService = new WorkEventCreationService(
    new WorkEventFactory(),
    new BusinessEngine(),
    workEventRepository,
    timeEntryRepository,
    offlineQueue,
    (event) => output(presenter.presentEvent(event)),
  );
  const adapter = new CliNfcScanAdapter(undefined);
  const applicationService = new NfcScanApplicationService(adapter, resolver, validator, workEventCreationService);
  const synchronizationService = new SynchronizationService(offlineQueue, synchronizationGateway, (event) =>
    output(presenter.presentEvent(event)),
  );

  return {
    async scan(rawPayload: string | undefined, caller: CallerContext = defaultCaller): Promise<ScanPipelineOutcome> {
      adapter.setInput(rawPayload);
      const outcome = await applicationService.submitScan(caller);
      output(presenter.presentScanOutcome(outcome));
      return outcome;
    },
    async synchronizePending(outcome: DemoSyncOutcome = 'success'): Promise<void> {
      if (outcome === 'retryable_failure') {
        synchronizationGateway.configureRetryableFailure('demo: simulated network timeout');
      } else if (outcome === 'conflict') {
        synchronizationGateway.configureConflict('demo: simulated remote conflict');
      } else {
        synchronizationGateway.configureSuccess();
      }
      await synchronizationService.synchronizePending();
    },
  };
}

export function isDemoSyncOutcome(value: string | undefined): value is DemoSyncOutcome {
  return value === 'success' || value === 'retryable_failure' || value === 'conflict';
}
