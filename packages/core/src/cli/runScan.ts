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

// Demo-only seed data (not production seed data): one Organization, one authenticated
// employee, one Customer, one NfcTag and one active NfcAssignment - sufficient to drive one
// realistic scenario (Development Sprint 005 Plan, Section 6).
export const DEMO_KNOWN_PAYLOAD = 'demo-tag-payload';

export type DemoSyncOutcome = 'success' | 'retryable_failure' | 'conflict';

export interface ScanDemoPipeline {
  scan(rawPayload: string | undefined, caller?: CallerContext): ScanPipelineOutcome;
  synchronizePending(outcome?: DemoSyncOutcome): void;
}

// DT-011 composition root. Wires DT-001-DT-008's existing, unmodified production classes
// into one runnable program driven by real (non-hard-coded-fixture) input. Introduces no new
// business decision logic - every accept/reject/escalate/sync decision remains exactly where
// AssignmentResolver/AssignmentValidator/BusinessEngine/SynchronizationService already put it.
export function buildScanDemoPipeline(output: (line: string) => void = (line) => console.log(line)): ScanDemoPipeline {
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

  const workEventRepository = new InMemoryWorkEventRepository();
  const timeEntryRepository = new InMemoryTimeEntryRepository();
  const offlineQueue = new InMemoryOfflineQueue();
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
    scan(rawPayload: string | undefined, caller: CallerContext = defaultCaller): ScanPipelineOutcome {
      adapter.setInput(rawPayload);
      const outcome = applicationService.submitScan(caller);
      output(presenter.presentScanOutcome(outcome));
      return outcome;
    },
    synchronizePending(outcome: DemoSyncOutcome = 'success'): void {
      if (outcome === 'retryable_failure') {
        synchronizationGateway.configureRetryableFailure('demo: simulated network timeout');
      } else if (outcome === 'conflict') {
        synchronizationGateway.configureConflict('demo: simulated remote conflict');
      } else {
        synchronizationGateway.configureSuccess();
      }
      synchronizationService.synchronizePending();
    },
  };
}

function isDemoSyncOutcome(value: string | undefined): value is DemoSyncOutcome {
  return value === 'success' || value === 'retryable_failure' || value === 'conflict';
}

// CLI entry point - only runs when this file is executed directly (as a Node CLI script),
// not when imported by tests or by a non-Node runtime such as Expo/Metro/Hermes, where
// `process.argv` does not exist in the Node CLI sense (Development Sprint 006, Section 12).
const isNodeCliInvocation =
  typeof process !== 'undefined' && Array.isArray(process.argv) && typeof process.argv[1] === 'string';

if (isNodeCliInvocation && import.meta.url === `file://${process.argv[1]}`) {
  const [, , rawPayload, syncOutcomeArg] = process.argv;
  const pipeline = buildScanDemoPipeline();
  pipeline.scan(rawPayload);
  pipeline.synchronizePending(isDemoSyncOutcome(syncOutcomeArg) ? syncOutcomeArg : 'success');
}
