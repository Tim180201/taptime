import { describe, expect, it } from 'vitest';
import { InMemoryWorkEventRepository } from '../../src/infrastructure/repositories/InMemoryWorkEventRepository';
import { NfcAssignmentId, NfcTagId, OrganizationId, CustomerId, UserId, WorkEventId } from '../../src/domain/ids';
import { customerAssignmentTarget } from '../../src/domain/AssignmentTarget';
import { createTimestamp } from '../../src/domain/Timestamp';
import type { AssignmentTarget } from '../../src/domain/AssignmentTarget';
import type { WorkEvent } from '../../src/domain/WorkEvent';

const organizationId = OrganizationId('org-1');
const userId = UserId('user-1');
const target = customerAssignmentTarget(CustomerId('customer-1'));
const otherTarget = customerAssignmentTarget(CustomerId('customer-2'));

function buildWorkEvent(
  id: string,
  occurredAt: string,
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

describe('InMemoryWorkEventRepository (DT-006 slice)', () => {
  it('persists WorkEvents without interpreting their business meaning', async () => {
    const repository = new InMemoryWorkEventRepository();
    const workEvent = buildWorkEvent('work-event-1', '2026-07-03T12:00:00.000Z');

    await repository.save(workEvent);

    expect(await repository.findAll()).toEqual([workEvent]);
  });

  it('returns null when no WorkEvent matches organization, user and target', async () => {
    const repository = new InMemoryWorkEventRepository();

    expect(await repository.findLatestByUserAndTarget(organizationId, userId, target)).toBeNull();
  });

  it('returns the chronologically latest WorkEvent for the exact organization, user and target', async () => {
    const repository = new InMemoryWorkEventRepository();
    const earlier = buildWorkEvent('work-event-earlier', '2026-07-03T09:00:00.000Z');
    const latest = buildWorkEvent('work-event-latest', '2026-07-03T11:00:00.000Z');
    await repository.save(latest);
    await repository.save(buildWorkEvent('other-org', '2026-07-03T12:00:00.000Z', OrganizationId('org-2')));
    await repository.save(buildWorkEvent('other-user', '2026-07-03T12:00:00.000Z', organizationId, UserId('user-2')));
    await repository.save(buildWorkEvent('other-target', '2026-07-03T12:00:00.000Z', organizationId, userId, otherTarget));
    await repository.save(earlier);

    expect(await repository.findLatestByUserAndTarget(organizationId, userId, target)).toEqual(latest);
  });
});
