import type { MembershipAuthorizationValidator } from '../business/MembershipAuthorizationValidator';
import type { RejectedMembershipAuthorizationResult } from '../business/MembershipAuthorizationResult';
import type { CustomerRepository } from '../ports/CustomerRepository';
import type { NfcTagRepository } from '../ports/NfcTagRepository';
import type { NfcAssignmentRepository } from '../ports/NfcAssignmentRepository';
import type { Customer } from '../domain/Customer';
import type { NfcTag } from '../domain/NfcTag';
import type { NfcPayload } from '../domain/NfcPayload';
import type { NfcAssignment } from '../domain/NfcAssignment';
import type { AssignmentTarget } from '../domain/AssignmentTarget';
import type { Membership } from '../domain/Membership';
import { CustomerId, NfcTagId, NfcAssignmentId, type OrganizationId } from '../domain/ids';
import { generateId } from '../domain/generateId';
import { customerCreated, type CustomerCreated } from '../domain/events/CustomerCreated';
import { nfcTagRegistered, type NfcTagRegistered } from '../domain/events/NfcTagRegistered';
import { nfcTagAssigned, type NfcTagAssigned } from '../domain/events/NfcTagAssigned';

// DT-023/DT-024/DT-025 (TS-002 Application Services, Capability 4 / FB-002 Decisions 3-5).
// Orchestrates but does not interpret (EP-008 Ch03 §2.3/5.4): the authorization decision belongs
// to MembershipAuthorizationValidator, persistence to CustomerRepository/NfcTagRepository/
// NfcAssignmentRepository, event shape to CustomerCreated/NfcTagRegistered/NfcTagAssigned.
// Deterministic id generation is injectable, mirroring OrganizationManagementService's/
// MembershipService's established constructor pattern.
export type CreateCustomerResult =
  | { readonly status: 'accepted'; readonly customer: Customer; readonly event: CustomerCreated }
  | RejectedMembershipAuthorizationResult;

export type RegisterNfcTagResult =
  | { readonly status: 'accepted'; readonly nfcTag: NfcTag; readonly event: NfcTagRegistered }
  | RejectedMembershipAuthorizationResult;

export type AssignNfcTagResult =
  | { readonly status: 'accepted'; readonly nfcAssignment: NfcAssignment; readonly event: NfcTagAssigned }
  | RejectedMembershipAuthorizationResult;

export class OrganizationAdministrationService {
  constructor(
    private readonly membershipAuthorizationValidator: MembershipAuthorizationValidator,
    private readonly customerRepository: CustomerRepository,
    private readonly nfcTagRepository: NfcTagRepository,
    private readonly nfcAssignmentRepository: NfcAssignmentRepository,
    private readonly newCustomerId: () => CustomerId = () => CustomerId(generateId()),
    private readonly newNfcTagId: () => NfcTagId = () => NfcTagId(generateId()),
    private readonly newNfcAssignmentId: () => NfcAssignmentId = () => NfcAssignmentId(generateId()),
  ) {}

  async createCustomer(
    membership: Membership | null,
    organizationId: OrganizationId,
  ): Promise<CreateCustomerResult> {
    const authorizationResult = this.membershipAuthorizationValidator.authorize(membership, organizationId);

    if (authorizationResult.status === 'rejected') {
      return authorizationResult;
    }

    const customer: Customer = {
      id: this.newCustomerId(),
      organizationId: authorizationResult.membership.organizationId,
      active: true,
    };

    await this.customerRepository.save(customer);

    return { status: 'accepted', customer, event: customerCreated(customer) };
  }

  async registerNfcTag(
    membership: Membership | null,
    organizationId: OrganizationId,
    payload: NfcPayload,
  ): Promise<RegisterNfcTagResult> {
    const authorizationResult = this.membershipAuthorizationValidator.authorize(membership, organizationId);

    if (authorizationResult.status === 'rejected') {
      return authorizationResult;
    }

    const nfcTag: NfcTag = {
      id: this.newNfcTagId(),
      organizationId: authorizationResult.membership.organizationId,
      payload,
    };

    await this.nfcTagRepository.register(nfcTag);

    return { status: 'accepted', nfcTag, event: nfcTagRegistered(nfcTag) };
  }

  async assignNfcTag(
    membership: Membership | null,
    organizationId: OrganizationId,
    nfcTag: NfcTag,
    target: AssignmentTarget,
  ): Promise<AssignNfcTagResult> {
    const authorizationResult = this.membershipAuthorizationValidator.authorize(membership, organizationId);

    if (authorizationResult.status === 'rejected') {
      return authorizationResult;
    }

    if (nfcTag.organizationId !== authorizationResult.membership.organizationId) {
      return { status: 'rejected', reason: 'cross_organization_access' };
    }

    // A missing target Customer is treated as cross_organization_access, not a distinct
    // "not found" reason - MembershipAuthorizationResult has no such category, and this task
    // must not add one (Development_Sprint_018_Plan.md Section 8).
    const resolvedCustomer = await this.customerRepository.findById(target.targetId);
    if (resolvedCustomer === null || resolvedCustomer.organizationId !== authorizationResult.membership.organizationId) {
      return { status: 'rejected', reason: 'cross_organization_access' };
    }

    const nfcAssignment: NfcAssignment = {
      id: this.newNfcAssignmentId(),
      organizationId: authorizationResult.membership.organizationId,
      nfcTagId: nfcTag.id,
      target,
      active: true,
    };

    await this.nfcAssignmentRepository.save(nfcAssignment);

    return { status: 'accepted', nfcAssignment, event: nfcTagAssigned(nfcAssignment) };
  }
}
