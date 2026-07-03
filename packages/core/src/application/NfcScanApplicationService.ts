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

  submitScan(caller: CallerContext): ScanPipelineOutcome {
    const captureResult = this.nfcScanPort.scan();
    if (captureResult.status === 'unreadable') {
      return { stage: 'capture', status: 'unreadable' };
    }

    const fact = nfcTagScanned(captureResult.payload, this.now());
    const resolution = this.assignmentResolver.resolve(fact);
    if (resolution.type === 'NfcAssignmentRejected') {
      return { stage: 'resolution', status: 'rejected', reason: resolution.reason };
    }

    const validationResult = this.assignmentValidator.validate(resolution.assignment, caller);
    if (validationResult.status === 'accepted') {
      this.workEventCreationPort.handleValidatedAssignment(validationResult);
    }

    return { stage: 'validation', result: validationResult };
  }
}
