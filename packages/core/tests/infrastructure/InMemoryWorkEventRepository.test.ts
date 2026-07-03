import { describe, expect, it } from 'vitest';
import { InMemoryWorkEventRepository } from '../../src/infrastructure/repositories/InMemoryWorkEventRepository';
import { NfcAssignmentId, NfcTagId, OrganizationId, CustomerId, UserId, WorkEventId } from '../../src/domain/ids';
import { customerAssignmentTarget } from '../../src/domain/AssignmentTarget';
import { createTimestamp } from '../../src/domain/Timestamp';
import type { WorkEvent } from '../../src/domain/WorkEvent';

describe('InMemoryWorkEventRepository (DT-006 slice)', () => {
  it('persists WorkEvents without interpreting their business meaning', () => {
    const repository = new InMemoryWorkEventRepository();
    const workEvent: WorkEvent = {
      id: WorkEventId('work-event-1'),
      organizationId: OrganizationId('org-1'),
      assignmentId: NfcAssignmentId('assignment-1'),
      nfcTagId: NfcTagId('tag-1'),
      target: customerAssignmentTarget(CustomerId('customer-1')),
      triggeredBy: UserId('user-1'),
      occurredAt: createTimestamp('2026-07-03T12:00:00.000Z'),
    };

    repository.save(workEvent);

    expect(repository.findAll()).toEqual([workEvent]);
  });
});
