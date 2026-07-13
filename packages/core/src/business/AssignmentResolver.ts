import type { NfcTagScanned } from '../domain/facts/NfcTagScanned';
import {
  nfcAssignmentRejected,
  nfcAssignmentResolved,
  type NfcAssignmentResolution,
} from '../domain/events/NfcAssignmentResolution';
import type { NfcTagRepository } from '../ports/NfcTagRepository';
import type { NfcAssignmentRepository } from '../ports/NfcAssignmentRepository';

export class AssignmentResolver {
  constructor(
    private readonly nfcTagRepository: NfcTagRepository,
    private readonly nfcAssignmentRepository: NfcAssignmentRepository,
  ) {}

  async resolve(fact: NfcTagScanned): Promise<NfcAssignmentResolution> {
    const tag = await this.nfcTagRepository.findByPayload(fact.payload);
    if (tag === null) {
      return nfcAssignmentRejected(fact.payload, 'unknown_tag');
    }

    const assignment = await this.nfcAssignmentRepository.findActiveByTagId(tag.id);
    if (assignment === null) {
      return nfcAssignmentRejected(fact.payload, 'inactive_assignment');
    }

    return nfcAssignmentResolved(assignment);
  }
}
