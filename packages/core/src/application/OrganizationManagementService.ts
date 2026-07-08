import type { OrganizationRepository } from '../ports/OrganizationRepository';
import type { Organization } from '../domain/Organization';
import { OrganizationId } from '../domain/ids';
import { generateId } from '../domain/generateId';
import { organizationCreated, type OrganizationCreated } from '../domain/events/OrganizationCreated';

// DT-017 (TS-002 Application Services, Capability 1 / FB-002 Decision 1). Orchestrates but
// does not interpret (EP-008 Ch03 §2.3/5.4): owns no business rule beyond "an Organization
// can always be created" - no name validation, no uniqueness check, no precondition beyond
// the request itself. Deterministic id generation is injectable, mirroring
// WorkEventFactory/BusinessEngine's established constructor pattern, so tests do not depend
// on hidden randomness.
export class OrganizationManagementService {
  constructor(
    private readonly organizationRepository: OrganizationRepository,
    private readonly newOrganizationId: () => OrganizationId = () => OrganizationId(generateId()),
  ) {}

  createOrganization(name: string): OrganizationCreated {
    const organization: Organization = {
      id: this.newOrganizationId(),
      name,
    };

    this.organizationRepository.save(organization);

    return organizationCreated(organization);
  }
}
