import { describe, expect, it } from 'vitest';
import { InMemoryTimeEntryRepository } from '../../src/infrastructure/repositories/InMemoryTimeEntryRepository';
import { OrganizationId, CustomerId, UserId, WorkEventId, TimeEntryId } from '../../src/domain/ids';
import { customerAssignmentTarget } from '../../src/domain/AssignmentTarget';
import { createTimestamp } from '../../src/domain/Timestamp';
import type { StartedTimeEntry, StoppedTimeEntry } from '../../src/domain/TimeEntry';

const organizationId = OrganizationId('org-1');
const userId = UserId('user-1');
const otherUserId = UserId('user-2');
const target = customerAssignmentTarget(CustomerId('customer-1'));
const otherTarget = customerAssignmentTarget(CustomerId('customer-2'));

function buildStartedTimeEntry(
  id = TimeEntryId('time-entry-1'),
  ownerId = userId,
  assignmentTarget = target,
  ownerOrganizationId = organizationId,
): StartedTimeEntry {
  return {
    id,
    workEventId: WorkEventId(`work-event-start-${id}`),
    organizationId: ownerOrganizationId,
    userId: ownerId,
    target: assignmentTarget,
    status: 'started',
    startedAt: createTimestamp('2026-07-03T12:00:00.000Z'),
  };
}

function stopTimeEntry(timeEntry: StartedTimeEntry): StoppedTimeEntry {
  return {
    ...timeEntry,
    status: 'stopped',
    stoppedAt: createTimestamp('2026-07-03T16:00:00.000Z'),
    stoppedByWorkEventId: WorkEventId(`work-event-stop-${timeEntry.id}`),
  };
}

describe('InMemoryTimeEntryRepository (DT-006 slice)', () => {
  it('finds an active TimeEntry for the exact organization and user', () => {
    const repository = new InMemoryTimeEntryRepository();
    const timeEntry = buildStartedTimeEntry();
    repository.save(timeEntry);

    expect(repository.findActiveByUser(organizationId, userId)).toEqual(timeEntry);
    expect(repository.findActiveByUser(organizationId, otherUserId)).toBeNull();
    expect(repository.findActiveByUser(OrganizationId('org-2'), userId)).toBeNull();
  });

  it('keeps two users on the same AssignmentTarget independent', () => {
    const repository = new InMemoryTimeEntryRepository();
    const firstUserEntry = buildStartedTimeEntry();
    const secondUserEntry = buildStartedTimeEntry(TimeEntryId('time-entry-2'), otherUserId);
    repository.save(firstUserEntry);
    repository.save(secondUserEntry);

    expect(repository.findActiveByUser(organizationId, userId)).toEqual(firstUserEntry);
    expect(repository.findActiveByUser(organizationId, otherUserId)).toEqual(secondUserEntry);
  });

  it('finds the same user as active independently of the AssignmentTarget', () => {
    const repository = new InMemoryTimeEntryRepository();
    const timeEntry = buildStartedTimeEntry(TimeEntryId('time-entry-other-target'), userId, otherTarget);
    repository.save(timeEntry);

    expect(repository.findActiveByUser(organizationId, userId)).toEqual(timeEntry);
  });

  it('does not return a stopped TimeEntry as active', () => {
    const repository = new InMemoryTimeEntryRepository();
    const stoppedTimeEntry = stopTimeEntry(buildStartedTimeEntry());
    repository.save(stoppedTimeEntry);

    expect(repository.findActiveByUser(organizationId, userId)).toBeNull();
  });

  it('updates exactly the matching started TimeEntry to stopped without creating a duplicate', () => {
    const repository = new InMemoryTimeEntryRepository();
    const startedTimeEntry = buildStartedTimeEntry();
    const stoppedTimeEntry = stopTimeEntry(startedTimeEntry);
    const unrelatedTimeEntry = buildStartedTimeEntry(TimeEntryId('time-entry-2'), otherUserId);
    repository.save(startedTimeEntry);
    repository.save(unrelatedTimeEntry);

    repository.update(stoppedTimeEntry);

    expect(repository.findAll()).toEqual([stoppedTimeEntry, unrelatedTimeEntry]);
    expect(repository.findActiveByUser(organizationId, userId)).toBeNull();
  });

  it('throws an explicit error when updating an unknown TimeEntryId', () => {
    const repository = new InMemoryTimeEntryRepository();
    const existingTimeEntry = buildStartedTimeEntry();
    const unknownTimeEntry = stopTimeEntry(buildStartedTimeEntry(TimeEntryId('time-entry-unknown')));
    repository.save(existingTimeEntry);

    expect(() => repository.update(unknownTimeEntry)).toThrowError(
      'Cannot update unknown TimeEntry: time-entry-unknown',
    );
    expect(repository.findAll()).toEqual([existingTimeEntry]);
  });
});
