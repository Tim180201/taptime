import { describe, expect, it, vi } from 'vitest';
import { OrganizationAdministrationService } from '../../src/application/OrganizationAdministrationService';
import { MembershipAuthorizationValidator } from '../../src/business/MembershipAuthorizationValidator';
import { InMemoryCustomerRepository } from '../../src/infrastructure/repositories/InMemoryCustomerRepository';
import { CustomerId, MembershipId, OrganizationId, UserId } from '../../src/domain/ids';
import type { Membership } from '../../src/domain/Membership';
import type { CustomerRepository } from '../../src/ports/CustomerRepository';

describe('OrganizationAdministrationService.createCustomer (DT-023)', () => {
  it('accepted path: Administrator Membership for the same Organization saves the Customer and produces CustomerCreated', () => {
    const repository = new InMemoryCustomerRepository();
    const validator = new MembershipAuthorizationValidator();
    const service = new OrganizationAdministrationService(validator, repository, () => CustomerId('customer-fixed-1'));
    const membership: Membership = {
      id: MembershipId('membership-1'),
      organizationId: OrganizationId('org-1'),
      userId: UserId('user-1'),
      role: 'administrator',
    };

    const result = service.createCustomer(membership, OrganizationId('org-1'));

    expect(result).toEqual({
      status: 'accepted',
      customer: { id: CustomerId('customer-fixed-1'), organizationId: OrganizationId('org-1'), active: true },
      event: {
        type: 'CustomerCreated',
        customer: { id: CustomerId('customer-fixed-1'), organizationId: OrganizationId('org-1'), active: true },
      },
    });
    expect(repository.findById(CustomerId('customer-fixed-1'))).toEqual(
      result.status === 'accepted' ? result.customer : undefined,
    );
  });

  it('calls CustomerRepository.save exactly once with the constructed Customer on the accepted path', () => {
    const save = vi.fn();
    const repository: CustomerRepository = { findById: vi.fn().mockReturnValue(null), save };
    const validator = new MembershipAuthorizationValidator();
    const service = new OrganizationAdministrationService(validator, repository, () => CustomerId('customer-fixed-2'));
    const membership: Membership = {
      id: MembershipId('membership-1'),
      organizationId: OrganizationId('org-1'),
      userId: UserId('user-1'),
      role: 'administrator',
    };

    const result = service.createCustomer(membership, OrganizationId('org-1'));

    expect(save).toHaveBeenCalledTimes(1);
    expect(result.status).toBe('accepted');
    if (result.status === 'accepted') {
      expect(save).toHaveBeenCalledWith(result.customer);
      expect(result.event.customer).toEqual(result.customer);
    }
  });

  it('rejected: missing Membership returns membership_not_found and performs no write', () => {
    const repository = new InMemoryCustomerRepository();
    const validator = new MembershipAuthorizationValidator();
    const service = new OrganizationAdministrationService(validator, repository, () => CustomerId('customer-should-not-exist'));

    const result = service.createCustomer(null, OrganizationId('org-1'));

    expect(result).toEqual({ status: 'rejected', reason: 'membership_not_found' });
    expect(repository.findById(CustomerId('customer-should-not-exist'))).toBeNull();
  });

  it('rejected: Employee Membership returns membership_lacks_administrator_role and performs no write', () => {
    const repository = new InMemoryCustomerRepository();
    const validator = new MembershipAuthorizationValidator();
    const service = new OrganizationAdministrationService(validator, repository, () => CustomerId('customer-should-not-exist'));
    const membership: Membership = {
      id: MembershipId('membership-1'),
      organizationId: OrganizationId('org-1'),
      userId: UserId('user-1'),
      role: 'employee',
    };

    const result = service.createCustomer(membership, OrganizationId('org-1'));

    expect(result).toEqual({ status: 'rejected', reason: 'membership_lacks_administrator_role' });
    expect(repository.findById(CustomerId('customer-should-not-exist'))).toBeNull();
  });

  it('rejected: Administrator Membership of a different Organization returns cross_organization_access and performs no write', () => {
    const repository = new InMemoryCustomerRepository();
    const validator = new MembershipAuthorizationValidator();
    const service = new OrganizationAdministrationService(validator, repository, () => CustomerId('customer-should-not-exist'));
    const membership: Membership = {
      id: MembershipId('membership-1'),
      organizationId: OrganizationId('org-1'),
      userId: UserId('user-1'),
      role: 'administrator',
    };

    const result = service.createCustomer(membership, OrganizationId('org-2'));

    expect(result).toEqual({ status: 'rejected', reason: 'cross_organization_access' });
    expect(repository.findById(CustomerId('customer-should-not-exist'))).toBeNull();
  });

  it('never calls CustomerRepository.save for any rejection path (explicit spy proof)', () => {
    const save = vi.fn();
    const findById = vi.fn().mockReturnValue(null);
    const repository: CustomerRepository = { findById, save };
    const validator = new MembershipAuthorizationValidator();
    const service = new OrganizationAdministrationService(validator, repository, () => CustomerId('customer-should-not-exist'));
    const employeeMembership: Membership = {
      id: MembershipId('membership-1'),
      organizationId: OrganizationId('org-1'),
      userId: UserId('user-1'),
      role: 'employee',
    };
    const crossOrgMembership: Membership = {
      id: MembershipId('membership-2'),
      organizationId: OrganizationId('org-1'),
      userId: UserId('user-2'),
      role: 'administrator',
    };

    service.createCustomer(null, OrganizationId('org-1'));
    service.createCustomer(employeeMembership, OrganizationId('org-1'));
    service.createCustomer(crossOrgMembership, OrganizationId('org-2'));

    expect(save).not.toHaveBeenCalled();
  });
});
