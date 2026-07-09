import type { MembershipAuthorizationValidator } from '../business/MembershipAuthorizationValidator';
import type { RejectedMembershipAuthorizationResult } from '../business/MembershipAuthorizationResult';
import type { CustomerRepository } from '../ports/CustomerRepository';
import type { Customer } from '../domain/Customer';
import type { Membership } from '../domain/Membership';
import { CustomerId, type OrganizationId } from '../domain/ids';
import { generateId } from '../domain/generateId';
import { customerCreated, type CustomerCreated } from '../domain/events/CustomerCreated';

// DT-023 (TS-002 Application Services, Capability 4 / FB-002 Decision 3). Orchestrates but
// does not interpret (EP-008 Ch03 §2.3/5.4): the authorization decision belongs to
// MembershipAuthorizationValidator, persistence to CustomerRepository, event shape to
// CustomerCreated. Deterministic id generation is injectable, mirroring
// OrganizationManagementService's/MembershipService's established constructor pattern.
export type CreateCustomerResult =
  | { readonly status: 'accepted'; readonly customer: Customer; readonly event: CustomerCreated }
  | RejectedMembershipAuthorizationResult;

export class OrganizationAdministrationService {
  constructor(
    private readonly membershipAuthorizationValidator: MembershipAuthorizationValidator,
    private readonly customerRepository: CustomerRepository,
    private readonly newCustomerId: () => CustomerId = () => CustomerId(generateId()),
  ) {}

  createCustomer(membership: Membership | null, organizationId: OrganizationId): CreateCustomerResult {
    const authorizationResult = this.membershipAuthorizationValidator.authorize(membership, organizationId);

    if (authorizationResult.status === 'rejected') {
      return authorizationResult;
    }

    const customer: Customer = {
      id: this.newCustomerId(),
      organizationId: authorizationResult.membership.organizationId,
      active: true,
    };

    this.customerRepository.save(customer);

    return { status: 'accepted', customer, event: customerCreated(customer) };
  }
}
