import { describe, expect, it } from 'vitest';
import { InMemoryOrganizationRepository } from '../../src/infrastructure/repositories/InMemoryOrganizationRepository';
import { OrganizationId } from '../../src/domain/ids';
import type { Organization } from '../../src/domain/Organization';

describe('InMemoryOrganizationRepository (DT-017)', () => {
  it('returns null when no Organization was ever saved for the given id', () => {
    const repository = new InMemoryOrganizationRepository();

    expect(repository.findById(OrganizationId('org-1'))).toBeNull();
  });

  it('saves an Organization and finds it again by id (round-trip)', () => {
    const repository = new InMemoryOrganizationRepository();
    const organization: Organization = { id: OrganizationId('org-1'), name: 'Acme Inc.' };

    repository.save(organization);

    expect(repository.findById(OrganizationId('org-1'))).toEqual(organization);
  });

  it('does not find an Organization saved under a different id', () => {
    const repository = new InMemoryOrganizationRepository();
    repository.save({ id: OrganizationId('org-1'), name: 'Acme Inc.' });

    expect(repository.findById(OrganizationId('org-2'))).toBeNull();
  });

  it('supports constructor-seeded Organizations, matching InMemoryCustomerRepository\'s pattern', () => {
    const seeded: Organization = { id: OrganizationId('org-seed'), name: 'Seeded Org' };
    const repository = new InMemoryOrganizationRepository([seeded]);

    expect(repository.findById(OrganizationId('org-seed'))).toEqual(seeded);
  });

  it('does not mutate the array passed into its constructor', () => {
    const seed: Organization[] = [{ id: OrganizationId('org-seed'), name: 'Seeded Org' }];
    const repository = new InMemoryOrganizationRepository(seed);

    repository.save({ id: OrganizationId('org-2'), name: 'Second Org' });

    expect(seed).toHaveLength(1);
  });
});
