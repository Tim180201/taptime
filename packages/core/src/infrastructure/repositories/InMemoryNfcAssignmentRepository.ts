import type { NfcAssignmentRepository } from '../../ports/NfcAssignmentRepository';
import type { NfcAssignment } from '../../domain/NfcAssignment';
import type { NfcTagId } from '../../domain/ids';

export class InMemoryNfcAssignmentRepository implements NfcAssignmentRepository {
  constructor(private readonly assignments: readonly NfcAssignment[] = []) {}

  findActiveByTagId(nfcTagId: NfcTagId): NfcAssignment | null {
    return this.assignments.find((assignment) => assignment.nfcTagId === nfcTagId && assignment.active) ?? null;
  }
}
