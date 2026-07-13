import type { Organization } from '../domain/Organization';
import type { OrganizationId } from '../domain/ids';

// DT-017 (TS-002 Ports). Mirrors CustomerRepository's minimal read shape, plus the one write
// method this specification's new repository needs.
export interface OrganizationRepository {
  findById(id: OrganizationId): Promise<Organization | null>;
  save(organization: Organization): Promise<void>;
}
