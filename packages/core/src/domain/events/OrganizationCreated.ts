import type { Organization } from '../Organization';

export interface OrganizationCreated {
  readonly type: 'OrganizationCreated';
  readonly organization: Organization;
}

export function organizationCreated(organization: Organization): OrganizationCreated {
  return { type: 'OrganizationCreated', organization };
}
