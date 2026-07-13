import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { FileWorkEventRepository } from '../../../src/infrastructure/persistence/FileWorkEventRepository';
import { NfcAssignmentId, NfcTagId, OrganizationId, CustomerId, UserId, WorkEventId } from '../../../src/domain/ids';
import { customerAssignmentTarget } from '../../../src/domain/AssignmentTarget';
import { createTimestamp } from '../../../src/domain/Timestamp';
import type { AssignmentTarget } from '../../../src/domain/AssignmentTarget';
import type { WorkEvent } from '../../../src/domain/WorkEvent';

const organizationId = OrganizationId('org-1');
const userId = UserId('user-1');
const target = customerAssignmentTarget(CustomerId('customer-1'));
const otherTarget = customerAssignmentTarget(CustomerId('customer-2'));

function buildWorkEvent(
  id: string,
  occurredAt = '2026-07-07T09:00:00.000Z',
  eventOrganizationId = organizationId,
  eventUserId = userId,
  eventTarget: AssignmentTarget = target,
): WorkEvent {
  return {
    id: WorkEventId(id),
    organizationId: eventOrganizationId,
    assignmentId: NfcAssignmentId(`assignment-${id}`),
    nfcTagId: NfcTagId(`tag-${id}`),
    target: eventTarget,
    triggeredBy: eventUserId,
    occurredAt: createTimestamp(occurredAt),
  };
}

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

  it('persists WorkEvents without interpreting their business meaning', async () => {
    const repository = new FileWorkEventRepository(filePath);
    const workEvent = buildWorkEvent('work-event-1');

    await repository.save(workEvent);

    expect(await repository.findAll()).toEqual([workEvent]);
  });

  it('appends across multiple saves rather than overwriting', async () => {
    const repository = new FileWorkEventRepository(filePath);
    const first = buildWorkEvent('work-event-1');
    const second = buildWorkEvent('work-event-2');

    await repository.save(first);
    await repository.save(second);

    expect(await repository.findAll()).toEqual([first, second]);
  });

  it('returns an empty list and no latest match when nothing has been saved', async () => {
    const repository = new FileWorkEventRepository(filePath);

    expect(await repository.findAll()).toEqual([]);
    expect(await repository.findLatestByUserAndTarget(organizationId, userId, target)).toBeNull();
  });

  it('returns the chronologically latest WorkEvent for the exact organization, user and target', async () => {
    const repository = new FileWorkEventRepository(filePath);
    const earlier = buildWorkEvent('work-event-earlier', '2026-07-07T09:00:00.000Z');
    const latest = buildWorkEvent('work-event-latest', '2026-07-07T11:00:00.000Z');
    await repository.save(latest);
    await repository.save(buildWorkEvent('other-org', '2026-07-07T12:00:00.000Z', OrganizationId('org-2')));
    await repository.save(buildWorkEvent('other-user', '2026-07-07T12:00:00.000Z', organizationId, UserId('user-2')));
    await repository.save(buildWorkEvent('other-target', '2026-07-07T12:00:00.000Z', organizationId, userId, otherTarget));
    await repository.save(earlier);

    expect(await repository.findLatestByUserAndTarget(organizationId, userId, target)).toEqual(latest);
  });

  it('preserves the latest matching WorkEvent query across repository instances', async () => {
    const firstInstance = new FileWorkEventRepository(filePath);
    const earlier = buildWorkEvent('work-event-earlier', '2026-07-07T09:00:00.000Z');
    const latest = buildWorkEvent('work-event-latest', '2026-07-07T11:00:00.000Z');
    await firstInstance.save(earlier);
    await firstInstance.save(latest);

    const secondInstance = new FileWorkEventRepository(filePath);

    expect(await secondInstance.findLatestByUserAndTarget(organizationId, userId, target)).toEqual(latest);
  });
});
