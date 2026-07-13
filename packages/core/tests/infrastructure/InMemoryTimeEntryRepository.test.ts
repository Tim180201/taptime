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
  it('finds an active TimeEntry for the exact organization and user', async () => {
    const repository = new InMemoryTimeEntryRepository();
    const timeEntry = buildStartedTimeEntry();
    await repository.save(timeEntry);

    expect(await repository.findActiveByUser(organizationId, userId)).toEqual(timeEntry);
    expect(await repository.findActiveByUser(organizationId, otherUserId)).toBeNull();
    expect(await repository.findActiveByUser(OrganizationId('org-2'), userId)).toBeNull();
  });

  it('keeps two users on the same AssignmentTarget independent', async () => {
    const repository = new InMemoryTimeEntryRepository();
    const firstUserEntry = buildStartedTimeEntry();
    const secondUserEntry = buildStartedTimeEntry(TimeEntryId('time-entry-2'), otherUserId);
    await repository.save(firstUserEntry);
    await repository.save(secondUserEntry);

    expect(await repository.findActiveByUser(organizationId, userId)).toEqual(firstUserEntry);
    expect(await repository.findActiveByUser(organizationId, otherUserId)).toEqual(secondUserEntry);
  });

  it('finds the same user as active independently of the AssignmentTarget', async () => {
    const repository = new InMemoryTimeEntryRepository();
    const timeEntry = buildStartedTimeEntry(TimeEntryId('time-entry-other-target'), userId, otherTarget);
    await repository.save(timeEntry);

    expect(await repository.findActiveByUser(organizationId, userId)).toEqual(timeEntry);
  });

  it('does not return a stopped TimeEntry as active', async () => {
    const repository = new InMemoryTimeEntryRepository();
    const stoppedTimeEntry = stopTimeEntry(buildStartedTimeEntry());
    await repository.save(stoppedTimeEntry);

    expect(await repository.findActiveByUser(organizationId, userId)).toBeNull();
  });

  it('updates exactly the matching started TimeEntry to stopped without creating a duplicate', async () => {
    const repository = new InMemoryTimeEntryRepository();
    const startedTimeEntry = buildStartedTimeEntry();
    const stoppedTimeEntry = stopTimeEntry(startedTimeEntry);
    const unrelatedTimeEntry = buildStartedTimeEntry(TimeEntryId('time-entry-2'), otherUserId);
    await repository.save(startedTimeEntry);
    await repository.save(unrelatedTimeEntry);

    await repository.update(stoppedTimeEntry);

    expect(await repository.findAll()).toEqual([stoppedTimeEntry, unrelatedTimeEntry]);
    expect(await repository.findActiveByUser(organizationId, userId)).toBeNull();
  });

  it('throws an explicit error when updating an unknown TimeEntryId', async () => {
    const repository = new InMemoryTimeEntryRepository();
    const existingTimeEntry = buildStartedTimeEntry();
    const unknownTimeEntry = stopTimeEntry(buildStartedTimeEntry(TimeEntryId('time-entry-unknown')));
    await repository.save(existingTimeEntry);

    await expect(repository.update(unknownTimeEntry)).rejects.toThrowError(
      'Cannot update unknown TimeEntry: time-entry-unknown',
    );
    expect(await repository.findAll()).toEqual([existingTimeEntry]);
  });
});
