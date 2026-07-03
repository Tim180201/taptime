import { describe, expect, it } from 'vitest';
import { InMemoryTimeEntryRepository } from '../../src/infrastructure/repositories/InMemoryTimeEntryRepository';
import { OrganizationId, CustomerId, WorkEventId, TimeEntryId } from '../../src/domain/ids';
import { customerAssignmentTarget } from '../../src/domain/AssignmentTarget';
import { createTimestamp } from '../../src/domain/Timestamp';
import type { TimeEntry } from '../../src/domain/TimeEntry';

const organizationId = OrganizationId('org-1');
const target = customerAssignmentTarget(CustomerId('customer-1'));
const otherTarget = customerAssignmentTarget(CustomerId('customer-2'));

describe('InMemoryTimeEntryRepository (DT-006 slice)', () => {
  it('returns null when no active TimeEntry exists for the target', () => {
    const repository = new InMemoryTimeEntryRepository();

    expect(repository.findActiveByTarget(organizationId, target)).toBeNull();
  });

  it('finds an active TimeEntry for the exact (organization, target) pair', () => {
    const repository = new InMemoryTimeEntryRepository();
    const timeEntry: TimeEntry = {
      id: TimeEntryId('time-entry-1'),
      workEventId: WorkEventId('work-event-1'),
      organizationId,
      target,
      status: 'started',
      startedAt: createTimestamp('2026-07-03T12:00:00.000Z'),
    };
    repository.save(timeEntry);

    expect(repository.findActiveByTarget(organizationId, target)).toEqual(timeEntry);
  });

  it('does not match a different target or a different organization', () => {
    const repository = new InMemoryTimeEntryRepository();
    const timeEntry: TimeEntry = {
      id: TimeEntryId('time-entry-1'),
      workEventId: WorkEventId('work-event-1'),
      organizationId,
      target,
      status: 'started',
      startedAt: createTimestamp('2026-07-03T12:00:00.000Z'),
    };
    repository.save(timeEntry);

    expect(repository.findActiveByTarget(organizationId, otherTarget)).toBeNull();
    expect(repository.findActiveByTarget(OrganizationId('org-2'), target)).toBeNull();
  });
});
