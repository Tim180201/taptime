import { describe, expect, it } from 'vitest';
import { InMemoryNfcAssignmentRepository } from '../../src/infrastructure/repositories/InMemoryNfcAssignmentRepository';
import { NfcAssignmentId, NfcTagId, OrganizationId, CustomerId } from '../../src/domain/ids';
import { customerAssignmentTarget } from '../../src/domain/AssignmentTarget';
import type { NfcAssignment } from '../../src/domain/NfcAssignment';

const organizationId = OrganizationId('org-1');
const target = customerAssignmentTarget(CustomerId('customer-1'));

describe('InMemoryNfcAssignmentRepository (DT-022)', () => {
  it('returns null when no NfcAssignment was ever saved for the given tag', async () => {
    const repository = new InMemoryNfcAssignmentRepository();

    expect(await repository.findActiveByTagId(NfcTagId('tag-1'))).toBeNull();
  });

  it('saves an active NfcAssignment and finds it again by tag id (round-trip)', async () => {
    const repository = new InMemoryNfcAssignmentRepository();
    const assignment: NfcAssignment = {
      id: NfcAssignmentId('assignment-1'),
      organizationId,
      nfcTagId: NfcTagId('tag-1'),
      target,
      active: true,
    };

    await repository.save(assignment);

    expect(await repository.findActiveByTagId(NfcTagId('tag-1'))).toEqual(assignment);
  });

  it('does not return an inactive assignment via findActiveByTagId (existing, unchanged behavior)', async () => {
    const repository = new InMemoryNfcAssignmentRepository();
    await repository.save({
      id: NfcAssignmentId('assignment-1'),
      organizationId,
      nfcTagId: NfcTagId('tag-1'),
      target,
      active: false,
    });

    expect(await repository.findActiveByTagId(NfcTagId('tag-1'))).toBeNull();
  });

  it('does not find an NfcAssignment saved under a different tag id', async () => {
    const repository = new InMemoryNfcAssignmentRepository();
    await repository.save({
      id: NfcAssignmentId('assignment-1'),
      organizationId,
      nfcTagId: NfcTagId('tag-1'),
      target,
      active: true,
    });

    expect(await repository.findActiveByTagId(NfcTagId('tag-2'))).toBeNull();
  });

  it('supports constructor-seeded NfcAssignments (existing, unchanged behavior)', async () => {
    const seeded: NfcAssignment = {
      id: NfcAssignmentId('assignment-seed'),
      organizationId,
      nfcTagId: NfcTagId('tag-seed'),
      target,
      active: true,
    };
    const repository = new InMemoryNfcAssignmentRepository([seeded]);

    expect(await repository.findActiveByTagId(NfcTagId('tag-seed'))).toEqual(seeded);
  });

  it('does not mutate the array passed into its constructor', async () => {
    const seed: NfcAssignment[] = [
      { id: NfcAssignmentId('assignment-seed'), organizationId, nfcTagId: NfcTagId('tag-seed'), target, active: true },
    ];
    const repository = new InMemoryNfcAssignmentRepository(seed);

    await repository.save({
      id: NfcAssignmentId('assignment-2'),
      organizationId,
      nfcTagId: NfcTagId('tag-2'),
      target,
      active: true,
    });

    expect(seed).toHaveLength(1);
  });
});
