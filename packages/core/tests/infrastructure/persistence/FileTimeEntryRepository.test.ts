import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { FileTimeEntryRepository } from '../../../src/infrastructure/persistence/FileTimeEntryRepository';
import { OrganizationId, CustomerId, UserId, WorkEventId, TimeEntryId } from '../../../src/domain/ids';
import { customerAssignmentTarget } from '../../../src/domain/AssignmentTarget';
import { createTimestamp } from '../../../src/domain/Timestamp';
import type { TimeEntry } from '../../../src/domain/TimeEntry';

const organizationId = OrganizationId('org-1');
const target = customerAssignmentTarget(CustomerId('customer-1'));
const otherTarget = customerAssignmentTarget(CustomerId('customer-2'));

function buildTimeEntry(id = 'time-entry-1'): TimeEntry {
  return {
    id: TimeEntryId(id),
    workEventId: WorkEventId('work-event-1'),
    organizationId,
    userId: UserId('user-1'),
    target,
    status: 'started',
    startedAt: createTimestamp('2026-07-07T09:00:00.000Z'),
  };
}

// DT-015: mirrors InMemoryTimeEntryRepository.test.ts's coverage exactly, plus a dedicated
// "survives restart" test.
describe('FileTimeEntryRepository (DT-015)', () => {
  let tempDirectory: string;
  let filePath: string;

  beforeEach(() => {
    tempDirectory = mkdtempSync(join(tmpdir(), 'taptime-file-time-entry-repository-'));
    filePath = join(tempDirectory, 'time-entries.json');
  });

  afterEach(() => {
    rmSync(tempDirectory, { recursive: true, force: true });
  });

  it('returns null when no active TimeEntry exists for the target', () => {
    const repository = new FileTimeEntryRepository(filePath);

    expect(repository.findActiveByTarget(organizationId, target)).toBeNull();
  });

  it('finds an active TimeEntry for the exact (organization, target) pair', () => {
    const repository = new FileTimeEntryRepository(filePath);
    const timeEntry = buildTimeEntry();
    repository.save(timeEntry);

    expect(repository.findActiveByTarget(organizationId, target)).toEqual(timeEntry);
  });

  it('does not match a different target or a different organization', () => {
    const repository = new FileTimeEntryRepository(filePath);
    repository.save(buildTimeEntry());

    expect(repository.findActiveByTarget(organizationId, otherTarget)).toBeNull();
    expect(repository.findActiveByTarget(OrganizationId('org-2'), target)).toBeNull();
  });

  it('survives a simulated process restart: a fresh instance reads what a previous instance wrote', () => {
    const firstInstance = new FileTimeEntryRepository(filePath);
    const timeEntry = buildTimeEntry();
    firstInstance.save(timeEntry);

    const secondInstance = new FileTimeEntryRepository(filePath);

    expect(secondInstance.findActiveByTarget(organizationId, target)).toEqual(timeEntry);
  });
});
