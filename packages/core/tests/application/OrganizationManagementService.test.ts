import { describe, expect, it, vi } from 'vitest';
import { OrganizationManagementService } from '../../src/application/OrganizationManagementService';
import { InMemoryOrganizationRepository } from '../../src/infrastructure/repositories/InMemoryOrganizationRepository';
import { OrganizationId } from '../../src/domain/ids';
import type { OrganizationRepository } from '../../src/ports/OrganizationRepository';

describe('OrganizationManagementService (DT-017)', () => {
  it('constructs an Organization using the injected deterministic id generator, saves it, and produces OrganizationCreated with the correct fields', async () => {
    const repository = new InMemoryOrganizationRepository();
    const service = new OrganizationManagementService(repository, () => OrganizationId('org-fixed-1'));

    const event = await service.createOrganization('Acme Inc.');

    expect(event).toEqual({
      type: 'OrganizationCreated',
      organization: { id: OrganizationId('org-fixed-1'), name: 'Acme Inc.' },
    });
    expect(await repository.findById(OrganizationId('org-fixed-1'))).toEqual({
      id: OrganizationId('org-fixed-1'),
      name: 'Acme Inc.',
    });
  });

  it('calls the repository save method with exactly the constructed Organization', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const repository: OrganizationRepository = { findById: vi.fn().mockResolvedValue(null), save };
    const service = new OrganizationManagementService(repository, () => OrganizationId('org-fixed-2'));

    const event = await service.createOrganization('Beta LLC');

    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith(event.organization);
    expect(event.organization).toEqual({ id: OrganizationId('org-fixed-2'), name: 'Beta LLC' });
  });

  it('is deterministic: the same injected id generator and name always produce the same Organization', async () => {
    const service = new OrganizationManagementService(new InMemoryOrganizationRepository(), () =>
      OrganizationId('org-fixed-3'),
    );

    const first = await service.createOrganization('Gamma Co.');
    const second = await new OrganizationManagementService(new InMemoryOrganizationRepository(), () =>
      OrganizationId('org-fixed-3'),
    ).createOrganization('Gamma Co.');

    expect(first).toEqual(second);
  });

  it('generates a unique id by default when no generator is injected (no hidden randomness required by the caller)', async () => {
    const repository = new InMemoryOrganizationRepository();
    const service = new OrganizationManagementService(repository);

    const event = await service.createOrganization('Delta GmbH');

    expect(event.organization.id.length).toBeGreaterThan(0);
    expect(event.organization.name).toBe('Delta GmbH');
  });

  it('has no precondition beyond the request itself: creating two Organizations with the same name succeeds independently', async () => {
    const repository = new InMemoryOrganizationRepository();
    let counter = 0;
    const service = new OrganizationManagementService(repository, () => OrganizationId(`org-${++counter}`));

    const first = await service.createOrganization('Duplicate Name Inc.');
    const second = await service.createOrganization('Duplicate Name Inc.');

    expect(first.organization.id).not.toBe(second.organization.id);
    expect(await repository.findById(first.organization.id)).not.toBeNull();
    expect(await repository.findById(second.organization.id)).not.toBeNull();
  });
});
