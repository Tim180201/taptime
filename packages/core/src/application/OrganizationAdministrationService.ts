import type { MembershipAuthorizationValidator } from '../business/MembershipAuthorizationValidator';
import type { RejectedMembershipAuthorizationResult } from '../business/MembershipAuthorizationResult';
import type { CustomerRepository } from '../ports/CustomerRepository';
import type { NfcTagRepository } from '../ports/NfcTagRepository';
import type { Customer } from '../domain/Customer';
import type { NfcTag } from '../domain/NfcTag';
import type { NfcPayload } from '../domain/NfcPayload';
import type { Membership } from '../domain/Membership';
import { CustomerId, NfcTagId, type OrganizationId } from '../domain/ids';
import { generateId } from '../domain/generateId';
import { customerCreated, type CustomerCreated } from '../domain/events/CustomerCreated';
import { nfcTagRegistered, type NfcTagRegistered } from '../domain/events/NfcTagRegistered';

// DT-023/DT-024 (TS-002 Application Services, Capability 4 / FB-002 Decisions 3-4). Orchestrates
// but does not interpret (EP-008 Ch03 §2.3/5.4): the authorization decision belongs to
// MembershipAuthorizationValidator, persistence to CustomerRepository/NfcTagRepository, event
// shape to CustomerCreated/NfcTagRegistered. Deterministic id generation is injectable, mirroring
// OrganizationManagementService's/MembershipService's established constructor pattern.
export type CreateCustomerResult =
  | { readonly status: 'accepted'; readonly customer: Customer; readonly event: CustomerCreated }
  | RejectedMembershipAuthorizationResult;

export type RegisterNfcTagResult =
  | { readonly status: 'accepted'; readonly nfcTag: NfcTag; readonly event: NfcTagRegistered }
  | RejectedMembershipAuthorizationResult;

export class OrganizationAdministrationService {
  constructor(
    private readonly membershipAuthorizationValidator: MembershipAuthorizationValidator,
    private readonly customerRepository: CustomerRepository,
    private readonly nfcTagRepository: NfcTagRepository,
    private readonly newCustomerId: () => CustomerId = () => CustomerId(generateId()),
    private readonly newNfcTagId: () => NfcTagId = () => NfcTagId(generateId()),
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

  registerNfcTag(
    membership: Membership | null,
    organizationId: OrganizationId,
    payload: NfcPayload,
  ): RegisterNfcTagResult {
    const authorizationResult = this.membershipAuthorizationValidator.authorize(membership, organizationId);

    if (authorizationResult.status === 'rejected') {
      return authorizationResult;
    }

    const nfcTag: NfcTag = {
      id: this.newNfcTagId(),
      organizationId: authorizationResult.membership.organizationId,
      payload,
    };

    this.nfcTagRepository.register(nfcTag);

    return { status: 'accepted', nfcTag, event: nfcTagRegistered(nfcTag) };
  }
}
