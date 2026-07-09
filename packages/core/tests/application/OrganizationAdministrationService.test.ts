import { describe, expect, it, vi } from 'vitest';
import { OrganizationAdministrationService } from '../../src/application/OrganizationAdministrationService';
import { MembershipAuthorizationValidator } from '../../src/business/MembershipAuthorizationValidator';
import { InMemoryCustomerRepository } from '../../src/infrastructure/repositories/InMemoryCustomerRepository';
import { InMemoryNfcTagRepository } from '../../src/infrastructure/repositories/InMemoryNfcTagRepository';
import { InMemoryNfcAssignmentRepository } from '../../src/infrastructure/repositories/InMemoryNfcAssignmentRepository';
import { createNfcPayload } from '../../src/domain/NfcPayload';
import { customerAssignmentTarget } from '../../src/domain/AssignmentTarget';
import { CustomerId, MembershipId, NfcTagId, NfcAssignmentId, OrganizationId, UserId } from '../../src/domain/ids';
import type { Membership } from '../../src/domain/Membership';
import type { Customer } from '../../src/domain/Customer';
import type { NfcTag } from '../../src/domain/NfcTag';
import type { CustomerRepository } from '../../src/ports/CustomerRepository';
import type { NfcTagRepository } from '../../src/ports/NfcTagRepository';
import type { NfcAssignmentRepository } from '../../src/ports/NfcAssignmentRepository';

describe('OrganizationAdministrationService.createCustomer (DT-023)', () => {
  it('accepted path: Administrator Membership for the same Organization saves the Customer and produces CustomerCreated', () => {
    const repository = new InMemoryCustomerRepository();
    const validator = new MembershipAuthorizationValidator();
    const service = new OrganizationAdministrationService(validator, repository, new InMemoryNfcTagRepository(), new InMemoryNfcAssignmentRepository(), () => CustomerId('customer-fixed-1'));
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
    const service = new OrganizationAdministrationService(validator, repository, new InMemoryNfcTagRepository(), new InMemoryNfcAssignmentRepository(), () => CustomerId('customer-fixed-2'));
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
    const service = new OrganizationAdministrationService(validator, repository, new InMemoryNfcTagRepository(), new InMemoryNfcAssignmentRepository(), () => CustomerId('customer-should-not-exist'));

    const result = service.createCustomer(null, OrganizationId('org-1'));

    expect(result).toEqual({ status: 'rejected', reason: 'membership_not_found' });
    expect(repository.findById(CustomerId('customer-should-not-exist'))).toBeNull();
  });

  it('rejected: Employee Membership returns membership_lacks_administrator_role and performs no write', () => {
    const repository = new InMemoryCustomerRepository();
    const validator = new MembershipAuthorizationValidator();
    const service = new OrganizationAdministrationService(validator, repository, new InMemoryNfcTagRepository(), new InMemoryNfcAssignmentRepository(), () => CustomerId('customer-should-not-exist'));
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
    const service = new OrganizationAdministrationService(validator, repository, new InMemoryNfcTagRepository(), new InMemoryNfcAssignmentRepository(), () => CustomerId('customer-should-not-exist'));
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
    const service = new OrganizationAdministrationService(validator, repository, new InMemoryNfcTagRepository(), new InMemoryNfcAssignmentRepository(), () => CustomerId('customer-should-not-exist'));
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

describe('OrganizationAdministrationService.registerNfcTag (DT-024)', () => {
  it('accepted path: Administrator Membership for the same Organization registers the NfcTag and produces NfcTagRegistered', () => {
    const customerRepository = new InMemoryCustomerRepository();
    const nfcTagRepository = new InMemoryNfcTagRepository();
    const validator = new MembershipAuthorizationValidator();
    const service = new OrganizationAdministrationService(
      validator,
      customerRepository,
      nfcTagRepository,
      new InMemoryNfcAssignmentRepository(),
      () => CustomerId('customer-unused'),
      () => NfcTagId('tag-fixed-1'),
    );
    const membership: Membership = {
      id: MembershipId('membership-1'),
      organizationId: OrganizationId('org-1'),
      userId: UserId('user-1'),
      role: 'administrator',
    };
    const payload = createNfcPayload('payload-1');

    const result = service.registerNfcTag(membership, OrganizationId('org-1'), payload);

    expect(result).toEqual({
      status: 'accepted',
      nfcTag: { id: NfcTagId('tag-fixed-1'), organizationId: OrganizationId('org-1'), payload },
      event: {
        type: 'NfcTagRegistered',
        nfcTag: { id: NfcTagId('tag-fixed-1'), organizationId: OrganizationId('org-1'), payload },
      },
    });
    expect(nfcTagRepository.findByPayload(payload)).toEqual(
      result.status === 'accepted' ? result.nfcTag : undefined,
    );
  });

  it('calls NfcTagRepository.register exactly once with the constructed NfcTag on the accepted path', () => {
    const register = vi.fn();
    const nfcTagRepository: NfcTagRepository = { findByPayload: vi.fn().mockReturnValue(null), register };
    const customerRepository = new InMemoryCustomerRepository();
    const validator = new MembershipAuthorizationValidator();
    const service = new OrganizationAdministrationService(
      validator,
      customerRepository,
      nfcTagRepository,
      new InMemoryNfcAssignmentRepository(),
      () => CustomerId('customer-unused'),
      () => NfcTagId('tag-fixed-2'),
    );
    const membership: Membership = {
      id: MembershipId('membership-1'),
      organizationId: OrganizationId('org-1'),
      userId: UserId('user-1'),
      role: 'administrator',
    };

    const result = service.registerNfcTag(membership, OrganizationId('org-1'), createNfcPayload('payload-2'));

    expect(register).toHaveBeenCalledTimes(1);
    expect(result.status).toBe('accepted');
    if (result.status === 'accepted') {
      expect(register).toHaveBeenCalledWith(result.nfcTag);
      expect(result.event.nfcTag).toEqual(result.nfcTag);
    }
  });

  it('rejected: missing Membership returns membership_not_found and performs no write', () => {
    const customerRepository = new InMemoryCustomerRepository();
    const nfcTagRepository = new InMemoryNfcTagRepository();
    const validator = new MembershipAuthorizationValidator();
    const service = new OrganizationAdministrationService(
      validator,
      customerRepository,
      nfcTagRepository,
      new InMemoryNfcAssignmentRepository(),
      () => CustomerId('customer-unused'),
      () => NfcTagId('tag-should-not-exist'),
    );
    const payload = createNfcPayload('payload-3');

    const result = service.registerNfcTag(null, OrganizationId('org-1'), payload);

    expect(result).toEqual({ status: 'rejected', reason: 'membership_not_found' });
    expect(nfcTagRepository.findByPayload(payload)).toBeNull();
  });

  it('rejected: Employee Membership returns membership_lacks_administrator_role and performs no write', () => {
    const customerRepository = new InMemoryCustomerRepository();
    const nfcTagRepository = new InMemoryNfcTagRepository();
    const validator = new MembershipAuthorizationValidator();
    const service = new OrganizationAdministrationService(
      validator,
      customerRepository,
      nfcTagRepository,
      new InMemoryNfcAssignmentRepository(),
      () => CustomerId('customer-unused'),
      () => NfcTagId('tag-should-not-exist'),
    );
    const membership: Membership = {
      id: MembershipId('membership-1'),
      organizationId: OrganizationId('org-1'),
      userId: UserId('user-1'),
      role: 'employee',
    };
    const payload = createNfcPayload('payload-4');

    const result = service.registerNfcTag(membership, OrganizationId('org-1'), payload);

    expect(result).toEqual({ status: 'rejected', reason: 'membership_lacks_administrator_role' });
    expect(nfcTagRepository.findByPayload(payload)).toBeNull();
  });

  it('rejected: Administrator Membership of a different Organization returns cross_organization_access and performs no write', () => {
    const customerRepository = new InMemoryCustomerRepository();
    const nfcTagRepository = new InMemoryNfcTagRepository();
    const validator = new MembershipAuthorizationValidator();
    const service = new OrganizationAdministrationService(
      validator,
      customerRepository,
      nfcTagRepository,
      new InMemoryNfcAssignmentRepository(),
      () => CustomerId('customer-unused'),
      () => NfcTagId('tag-should-not-exist'),
    );
    const membership: Membership = {
      id: MembershipId('membership-1'),
      organizationId: OrganizationId('org-1'),
      userId: UserId('user-1'),
      role: 'administrator',
    };
    const payload = createNfcPayload('payload-5');

    const result = service.registerNfcTag(membership, OrganizationId('org-2'), payload);

    expect(result).toEqual({ status: 'rejected', reason: 'cross_organization_access' });
    expect(nfcTagRepository.findByPayload(payload)).toBeNull();
  });

  it('never calls NfcTagRepository.register for any rejection path (explicit spy proof)', () => {
    const register = vi.fn();
    const findByPayload = vi.fn().mockReturnValue(null);
    const nfcTagRepository: NfcTagRepository = { findByPayload, register };
    const customerRepository = new InMemoryCustomerRepository();
    const validator = new MembershipAuthorizationValidator();
    const service = new OrganizationAdministrationService(
      validator,
      customerRepository,
      nfcTagRepository,
      new InMemoryNfcAssignmentRepository(),
      () => CustomerId('customer-unused'),
      () => NfcTagId('tag-should-not-exist'),
    );
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

    service.registerNfcTag(null, OrganizationId('org-1'), createNfcPayload('payload-6'));
    service.registerNfcTag(employeeMembership, OrganizationId('org-1'), createNfcPayload('payload-7'));
    service.registerNfcTag(crossOrgMembership, OrganizationId('org-2'), createNfcPayload('payload-8'));

    expect(register).not.toHaveBeenCalled();
  });

  it('uses the injected deterministic NfcTagId generator for the registered NfcTag', () => {
    const customerRepository = new InMemoryCustomerRepository();
    const nfcTagRepository = new InMemoryNfcTagRepository();
    const validator = new MembershipAuthorizationValidator();
    const service = new OrganizationAdministrationService(
      validator,
      customerRepository,
      nfcTagRepository,
      new InMemoryNfcAssignmentRepository(),
      () => CustomerId('customer-unused'),
      () => NfcTagId('tag-deterministic-fixed'),
    );
    const membership: Membership = {
      id: MembershipId('membership-1'),
      organizationId: OrganizationId('org-1'),
      userId: UserId('user-1'),
      role: 'administrator',
    };

    const result = service.registerNfcTag(membership, OrganizationId('org-1'), createNfcPayload('payload-9'));

    expect(result.status).toBe('accepted');
    if (result.status === 'accepted') {
      expect(result.nfcTag.id).toBe(NfcTagId('tag-deterministic-fixed'));
    }
  });
});

describe('OrganizationAdministrationService.assignNfcTag (DT-025)', () => {
  const membership: Membership = {
    id: MembershipId('membership-1'),
    organizationId: OrganizationId('org-1'),
    userId: UserId('user-1'),
    role: 'administrator',
  };
  const matchingNfcTag: NfcTag = {
    id: NfcTagId('tag-1'),
    organizationId: OrganizationId('org-1'),
    payload: createNfcPayload('payload-tag-1'),
  };

  it('accepted path: Administrator Membership, matching NfcTag, and matching AssignmentTarget/Customer saves the NfcAssignment and produces NfcTagAssigned', () => {
    const customerRepository = new InMemoryCustomerRepository();
    const customer: Customer = { id: CustomerId('customer-1'), organizationId: OrganizationId('org-1'), active: true };
    customerRepository.save(customer);
    const save = vi.fn();
    const nfcAssignmentRepository: NfcAssignmentRepository = { findActiveByTagId: vi.fn().mockReturnValue(null), save };
    const validator = new MembershipAuthorizationValidator();
    const service = new OrganizationAdministrationService(
      validator,
      customerRepository,
      new InMemoryNfcTagRepository(),
      nfcAssignmentRepository,
      () => CustomerId('customer-unused'),
      () => NfcTagId('tag-unused'),
      () => NfcAssignmentId('assignment-fixed-1'),
    );
    const target = customerAssignmentTarget(customer.id);

    const result = service.assignNfcTag(membership, OrganizationId('org-1'), matchingNfcTag, target);

    expect(result).toEqual({
      status: 'accepted',
      nfcAssignment: {
        id: NfcAssignmentId('assignment-fixed-1'),
        organizationId: OrganizationId('org-1'),
        nfcTagId: NfcTagId('tag-1'),
        target,
        active: true,
      },
      event: {
        type: 'NfcTagAssigned',
        nfcAssignment: {
          id: NfcAssignmentId('assignment-fixed-1'),
          organizationId: OrganizationId('org-1'),
          nfcTagId: NfcTagId('tag-1'),
          target,
          active: true,
        },
      },
    });
    expect(save).toHaveBeenCalledTimes(1);
    expect(result.status).toBe('accepted');
    if (result.status === 'accepted') {
      expect(save).toHaveBeenCalledWith(result.nfcAssignment);
      expect(result.event.nfcAssignment).toEqual(result.nfcAssignment);
    }
  });

  it('rejected: missing Membership returns membership_not_found and performs no write', () => {
    const customerRepository = new InMemoryCustomerRepository();
    const customer: Customer = { id: CustomerId('customer-1'), organizationId: OrganizationId('org-1'), active: true };
    customerRepository.save(customer);
    const nfcAssignmentRepository = new InMemoryNfcAssignmentRepository();
    const validator = new MembershipAuthorizationValidator();
    const service = new OrganizationAdministrationService(
      validator,
      customerRepository,
      new InMemoryNfcTagRepository(),
      nfcAssignmentRepository,
      () => CustomerId('customer-unused'),
      () => NfcTagId('tag-unused'),
      () => NfcAssignmentId('assignment-should-not-exist'),
    );
    const target = customerAssignmentTarget(customer.id);

    const result = service.assignNfcTag(null, OrganizationId('org-1'), matchingNfcTag, target);

    expect(result).toEqual({ status: 'rejected', reason: 'membership_not_found' });
    expect(nfcAssignmentRepository.findActiveByTagId(matchingNfcTag.id)).toBeNull();
  });

  it('rejected: Employee Membership returns membership_lacks_administrator_role and performs no write', () => {
    const customerRepository = new InMemoryCustomerRepository();
    const customer: Customer = { id: CustomerId('customer-1'), organizationId: OrganizationId('org-1'), active: true };
    customerRepository.save(customer);
    const nfcAssignmentRepository = new InMemoryNfcAssignmentRepository();
    const validator = new MembershipAuthorizationValidator();
    const service = new OrganizationAdministrationService(
      validator,
      customerRepository,
      new InMemoryNfcTagRepository(),
      nfcAssignmentRepository,
      () => CustomerId('customer-unused'),
      () => NfcTagId('tag-unused'),
      () => NfcAssignmentId('assignment-should-not-exist'),
    );
    const employeeMembership: Membership = { ...membership, role: 'employee' };
    const target = customerAssignmentTarget(customer.id);

    const result = service.assignNfcTag(employeeMembership, OrganizationId('org-1'), matchingNfcTag, target);

    expect(result).toEqual({ status: 'rejected', reason: 'membership_lacks_administrator_role' });
    expect(nfcAssignmentRepository.findActiveByTagId(matchingNfcTag.id)).toBeNull();
  });

  it('rejected: Administrator Membership of a different Organization returns cross_organization_access and performs no write', () => {
    const customerRepository = new InMemoryCustomerRepository();
    const customer: Customer = { id: CustomerId('customer-1'), organizationId: OrganizationId('org-1'), active: true };
    customerRepository.save(customer);
    const nfcAssignmentRepository = new InMemoryNfcAssignmentRepository();
    const validator = new MembershipAuthorizationValidator();
    const service = new OrganizationAdministrationService(
      validator,
      customerRepository,
      new InMemoryNfcTagRepository(),
      nfcAssignmentRepository,
      () => CustomerId('customer-unused'),
      () => NfcTagId('tag-unused'),
      () => NfcAssignmentId('assignment-should-not-exist'),
    );
    const target = customerAssignmentTarget(customer.id);

    const result = service.assignNfcTag(membership, OrganizationId('org-2'), matchingNfcTag, target);

    expect(result).toEqual({ status: 'rejected', reason: 'cross_organization_access' });
    expect(nfcAssignmentRepository.findActiveByTagId(matchingNfcTag.id)).toBeNull();
  });

  it('rejected: NfcTag Organization mismatch returns cross_organization_access and performs no write', () => {
    const customerRepository = new InMemoryCustomerRepository();
    const customer: Customer = { id: CustomerId('customer-1'), organizationId: OrganizationId('org-1'), active: true };
    customerRepository.save(customer);
    const nfcAssignmentRepository = new InMemoryNfcAssignmentRepository();
    const validator = new MembershipAuthorizationValidator();
    const service = new OrganizationAdministrationService(
      validator,
      customerRepository,
      new InMemoryNfcTagRepository(),
      nfcAssignmentRepository,
      () => CustomerId('customer-unused'),
      () => NfcTagId('tag-unused'),
      () => NfcAssignmentId('assignment-should-not-exist'),
    );
    const mismatchedNfcTag: NfcTag = { id: NfcTagId('tag-2'), organizationId: OrganizationId('org-2'), payload: createNfcPayload('payload-tag-2') };
    const target = customerAssignmentTarget(customer.id);

    const result = service.assignNfcTag(membership, OrganizationId('org-1'), mismatchedNfcTag, target);

    expect(result).toEqual({ status: 'rejected', reason: 'cross_organization_access' });
    expect(nfcAssignmentRepository.findActiveByTagId(mismatchedNfcTag.id)).toBeNull();
  });

  it('rejected: AssignmentTarget/Customer Organization mismatch returns cross_organization_access and performs no write', () => {
    const customerRepository = new InMemoryCustomerRepository();
    const otherOrgCustomer: Customer = { id: CustomerId('customer-2'), organizationId: OrganizationId('org-2'), active: true };
    customerRepository.save(otherOrgCustomer);
    const nfcAssignmentRepository = new InMemoryNfcAssignmentRepository();
    const validator = new MembershipAuthorizationValidator();
    const service = new OrganizationAdministrationService(
      validator,
      customerRepository,
      new InMemoryNfcTagRepository(),
      nfcAssignmentRepository,
      () => CustomerId('customer-unused'),
      () => NfcTagId('tag-unused'),
      () => NfcAssignmentId('assignment-should-not-exist'),
    );
    const target = customerAssignmentTarget(otherOrgCustomer.id);

    const result = service.assignNfcTag(membership, OrganizationId('org-1'), matchingNfcTag, target);

    expect(result).toEqual({ status: 'rejected', reason: 'cross_organization_access' });
    expect(nfcAssignmentRepository.findActiveByTagId(matchingNfcTag.id)).toBeNull();
  });

  it('rejected: missing AssignmentTarget/Customer returns cross_organization_access and performs no write', () => {
    const customerRepository = new InMemoryCustomerRepository();
    const nfcAssignmentRepository = new InMemoryNfcAssignmentRepository();
    const validator = new MembershipAuthorizationValidator();
    const service = new OrganizationAdministrationService(
      validator,
      customerRepository,
      new InMemoryNfcTagRepository(),
      nfcAssignmentRepository,
      () => CustomerId('customer-unused'),
      () => NfcTagId('tag-unused'),
      () => NfcAssignmentId('assignment-should-not-exist'),
    );
    const target = customerAssignmentTarget(CustomerId('customer-does-not-exist'));

    const result = service.assignNfcTag(membership, OrganizationId('org-1'), matchingNfcTag, target);

    expect(result).toEqual({ status: 'rejected', reason: 'cross_organization_access' });
    expect(nfcAssignmentRepository.findActiveByTagId(matchingNfcTag.id)).toBeNull();
  });

  it('never calls NfcAssignmentRepository.save for any rejection path (explicit spy proof)', () => {
    const save = vi.fn();
    const findActiveByTagId = vi.fn().mockReturnValue(null);
    const nfcAssignmentRepository: NfcAssignmentRepository = { findActiveByTagId, save };
    const customerRepository = new InMemoryCustomerRepository();
    const otherOrgCustomer: Customer = { id: CustomerId('customer-2'), organizationId: OrganizationId('org-2'), active: true };
    customerRepository.save(otherOrgCustomer);
    const validator = new MembershipAuthorizationValidator();
    const service = new OrganizationAdministrationService(
      validator,
      customerRepository,
      new InMemoryNfcTagRepository(),
      nfcAssignmentRepository,
      () => CustomerId('customer-unused'),
      () => NfcTagId('tag-unused'),
      () => NfcAssignmentId('assignment-should-not-exist'),
    );
    const employeeMembership: Membership = { ...membership, role: 'employee' };
    const mismatchedNfcTag: NfcTag = { id: NfcTagId('tag-2'), organizationId: OrganizationId('org-2'), payload: createNfcPayload('payload-tag-2') };
    const matchingTarget = customerAssignmentTarget(CustomerId('customer-does-not-exist'));
    const otherOrgTarget = customerAssignmentTarget(otherOrgCustomer.id);

    service.assignNfcTag(null, OrganizationId('org-1'), matchingNfcTag, matchingTarget);
    service.assignNfcTag(employeeMembership, OrganizationId('org-1'), matchingNfcTag, matchingTarget);
    service.assignNfcTag(membership, OrganizationId('org-2'), matchingNfcTag, matchingTarget);
    service.assignNfcTag(membership, OrganizationId('org-1'), mismatchedNfcTag, matchingTarget);
    service.assignNfcTag(membership, OrganizationId('org-1'), matchingNfcTag, otherOrgTarget);
    service.assignNfcTag(membership, OrganizationId('org-1'), matchingNfcTag, matchingTarget);

    expect(save).not.toHaveBeenCalled();
  });

  it('uses the injected deterministic NfcAssignmentId generator for the saved NfcAssignment', () => {
    const customerRepository = new InMemoryCustomerRepository();
    const customer: Customer = { id: CustomerId('customer-1'), organizationId: OrganizationId('org-1'), active: true };
    customerRepository.save(customer);
    const nfcAssignmentRepository = new InMemoryNfcAssignmentRepository();
    const validator = new MembershipAuthorizationValidator();
    const service = new OrganizationAdministrationService(
      validator,
      customerRepository,
      new InMemoryNfcTagRepository(),
      nfcAssignmentRepository,
      () => CustomerId('customer-unused'),
      () => NfcTagId('tag-unused'),
      () => NfcAssignmentId('assignment-deterministic-fixed'),
    );
    const target = customerAssignmentTarget(customer.id);

    const result = service.assignNfcTag(membership, OrganizationId('org-1'), matchingNfcTag, target);

    expect(result.status).toBe('accepted');
    if (result.status === 'accepted') {
      expect(result.nfcAssignment.id).toBe(NfcAssignmentId('assignment-deterministic-fixed'));
    }
  });
});
