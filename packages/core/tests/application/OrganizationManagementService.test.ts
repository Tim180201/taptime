import { describe, expect, it, vi } from 'vitest';
import { OrganizationManagementService } from '../../src/application/OrganizationManagementService';
import { InMemoryOrganizationRepository } from '../../src/infrastructure/repositories/InMemoryOrganizationRepository';
import { OrganizationId } from '../../src/domain/ids';
import type { OrganizationRepository } from '../../src/ports/OrganizationRepository';

describe('OrganizationManagementService (DT-017)', () => {
  it('constructs an Organization using the injected deterministic id generator, saves it, and produces OrganizationCreated with the correct fields', () => {
    const repository = new InMemoryOrganizationRepository();
    const service = new OrganizationManagementService(repository, () => OrganizationId('org-fixed-1'));

    const event = service.createOrganization('Acme Inc.');

    expect(event).toEqual({
      type: 'OrganizationCreated',
      organization: { id: OrganizationId('org-fixed-1'), name: 'Acme Inc.' },
    });
    expect(repository.findById(OrganizationId('org-fixed-1'))).toEqual({
      id: OrganizationId('org-fixed-1'),
      name: 'Acme Inc.',
    });
  });

  it('calls the repository save method with exactly the constructed Organization', () => {
    const save = vi.fn();
    const repository: OrganizationRepository = { findById: vi.fn().mockReturnValue(null), save };
    const service = new OrganizationManagementService(repository, () => OrganizationId('org-fixed-2'));

    const event = service.createOrganization('Beta LLC');

    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith(event.organization);
    expect(event.organization).toEqual({ id: OrganizationId('org-fixed-2'), name: 'Beta LLC' });
  });

  it('is deterministic: the same injected id generator and name always produce the same Organization', () => {
    const service = new OrganizationManagementService(new InMemoryOrganizationRepository(), () =>
      OrganizationId('org-fixed-3'),
    );

    const first = service.createOrganization('Gamma Co.');
    const second = new OrganizationManagementService(new InMemoryOrganizationRepository(), () =>
      OrganizationId('org-fixed-3'),
    ).createOrganization('Gamma Co.');

    expect(first).toEqual(second);
  });

  it('generates a unique id by default when no generator is injected (no hidden randomness required by the caller)', () => {
    const repository = new InMemoryOrganizationRepository();
    const service = new OrganizationManagementService(repository);

    const event = service.createOrganization('Delta GmbH');

    expect(event.organization.id.length).toBeGreaterThan(0);
    expect(event.organization.name).toBe('Delta GmbH');
  });

  it('has no precondition beyond the request itself: creating two Organizations with the same name succeeds independently', () => {
    const repository = new InMemoryOrganizationRepository();
    let counter = 0;
    const service = new OrganizationManagementService(repository, () => OrganizationId(`org-${++counter}`));

    const first = service.createOrganization('Duplicate Name Inc.');
    const second = service.createOrganization('Duplicate Name Inc.');

    expect(first.organization.id).not.toBe(second.organization.id);
    expect(repository.findById(first.organization.id)).not.toBeNull();
    expect(repository.findById(second.organization.id)).not.toBeNull();
  });
});
