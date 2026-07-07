import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { FileWorkEventRepository } from '../../../src/infrastructure/persistence/FileWorkEventRepository';
import { NfcAssignmentId, NfcTagId, OrganizationId, CustomerId, UserId, WorkEventId } from '../../../src/domain/ids';
import { customerAssignmentTarget } from '../../../src/domain/AssignmentTarget';
import { createTimestamp } from '../../../src/domain/Timestamp';
import type { WorkEvent } from '../../../src/domain/WorkEvent';

function buildWorkEvent(id = 'work-event-1'): WorkEvent {
  return {
    id: WorkEventId(id),
    organizationId: OrganizationId('org-1'),
    assignmentId: NfcAssignmentId('assignment-1'),
    nfcTagId: NfcTagId('tag-1'),
    target: customerAssignmentTarget(CustomerId('customer-1')),
    triggeredBy: UserId('user-1'),
    occurredAt: createTimestamp('2026-07-07T09:00:00.000Z'),
  };
}

// DT-015: mirrors InMemoryWorkEventRepository.test.ts's coverage exactly, plus a dedicated
// "survives restart" test.
describe('FileWorkEventRepository (DT-015)', () => {
  let tempDirectory: string;
  let filePath: string;

  beforeEach(() => {
    tempDirectory = mkdtempSync(join(tmpdir(), 'taptime-file-work-event-repository-'));
    filePath = join(tempDirectory, 'work-events.json');
  });

  afterEach(() => {
    rmSync(tempDirectory, { recursive: true, force: true });
  });

  it('persists WorkEvents without interpreting their business meaning', () => {
    const repository = new FileWorkEventRepository(filePath);
    const workEvent = buildWorkEvent();

    repository.save(workEvent);

    expect(repository.findAll()).toEqual([workEvent]);
  });

  it('appends across multiple saves rather than overwriting', () => {
    const repository = new FileWorkEventRepository(filePath);
    const first = buildWorkEvent('work-event-1');
    const second = buildWorkEvent('work-event-2');

    repository.save(first);
    repository.save(second);

    expect(repository.findAll()).toEqual([first, second]);
  });

  it('returns an empty list when nothing has been saved', () => {
    const repository = new FileWorkEventRepository(filePath);

    expect(repository.findAll()).toEqual([]);
  });

  it('survives a simulated process restart: a fresh instance reads what a previous instance wrote', () => {
    const firstInstance = new FileWorkEventRepository(filePath);
    const workEvent = buildWorkEvent();
    firstInstance.save(workEvent);

    const secondInstance = new FileWorkEventRepository(filePath);

    expect(secondInstance.findAll()).toEqual([workEvent]);
  });
});
