import type { NfcScanPort } from '../ports/NfcScanPort';
import type { WorkEventCreationPort } from '../ports/WorkEventCreationPort';
import type { AssignmentResolver } from '../business/AssignmentResolver';
import type { AssignmentValidator } from '../business/AssignmentValidator';
import type { CallerContext } from '../domain/CallerContext';
import { createTimestamp, type Timestamp } from '../domain/Timestamp';
import { nfcTagScanned } from '../domain/facts/NfcTagScanned';
import type { ScanPipelineOutcome } from './ScanPipelineOutcome';

// Orchestrates adapter -> resolver -> validator. Owns no business decision itself
// (EP-008 Ch03 5.4, "Application Orchestrates But Does Not Interpret").
export class NfcScanApplicationService {
  constructor(
    private readonly nfcScanPort: NfcScanPort,
    private readonly assignmentResolver: AssignmentResolver,
    private readonly assignmentValidator: AssignmentValidator,
    private readonly workEventCreationPort: WorkEventCreationPort,
    private readonly now: () => Timestamp = () => createTimestamp(new Date().toISOString()),
  ) {}

  async submitScan(caller: CallerContext): Promise<ScanPipelineOutcome> {
    const captureResult = await this.nfcScanPort.scan();
    // The legacy/local pipeline has one capture-failure presentation. Block D's product runtime
    // preserves the more precise technical terminal state before this application boundary.
    if (captureResult.status !== 'captured') {
      return { stage: 'capture', status: 'unreadable' };
    }

    const fact = nfcTagScanned(captureResult.payload, captureResult.capturedAt ?? this.now());
    const resolution = await this.assignmentResolver.resolve(fact);
    if (resolution.type === 'NfcAssignmentRejected') {
      return { stage: 'resolution', status: 'rejected', reason: resolution.reason };
    }

    const validationResult = await this.assignmentValidator.validate(resolution.assignment, caller);
    if (validationResult.status === 'accepted') {
      await this.workEventCreationPort.handleValidatedAssignment(validationResult);
    }

    return { stage: 'validation', result: validationResult };
  }
}
