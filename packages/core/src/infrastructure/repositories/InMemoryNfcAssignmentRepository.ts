import type { NfcAssignmentRepository } from '../../ports/NfcAssignmentRepository';
import type { NfcAssignment } from '../../domain/NfcAssignment';
import type { NfcTagId } from '../../domain/ids';

export class InMemoryNfcAssignmentRepository implements NfcAssignmentRepository {
  private readonly assignments: NfcAssignment[];

  constructor(assignments: readonly NfcAssignment[] = []) {
    this.assignments = [...assignments];
  }

  findActiveByTagId(nfcTagId: NfcTagId): NfcAssignment | null {
    return this.assignments.find((assignment) => assignment.nfcTagId === nfcTagId && assignment.active) ?? null;
  }

  save(nfcAssignment: NfcAssignment): void {
    this.assignments.push(nfcAssignment);
  }
}
