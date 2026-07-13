import type { OrganizationRepository } from '../../ports/OrganizationRepository';
import type { Organization } from '../../domain/Organization';
import type { OrganizationId } from '../../domain/ids';

export class InMemoryOrganizationRepository implements OrganizationRepository {
  private readonly organizations: Organization[];

  constructor(organizations: readonly Organization[] = []) {
    this.organizations = [...organizations];
  }

  async findById(id: OrganizationId): Promise<Organization | null> {
    return this.organizations.find((organization) => organization.id === id) ?? null;
  }

  async save(organization: Organization): Promise<void> {
    this.organizations.push(organization);
  }
}
