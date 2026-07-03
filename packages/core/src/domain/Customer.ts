import type { CustomerId, OrganizationId } from './ids';

export interface Customer {
  readonly id: CustomerId;
  readonly organizationId: OrganizationId;
  readonly active: boolean;
}
