import { describe, expect, expectTypeOf, it, vi } from 'vitest';
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

const CUSTOMER_DISPLAY_NAME = 'Nordwerk Logistics';
const NFC_TAG_DISPLAY_NAME = 'Main Entrance';

describe('OrganizationAdministrationService.createCustomer (DT-023)', () => {
  it('accepted path: Administrator Membership for the same Organization saves the Customer and produces CustomerCreated', async () => {
    const repository = new InMemoryCustomerRepository();
    const validator = new MembershipAuthorizationValidator();
    const service = new OrganizationAdministrationService(validator, repository, new InMemoryNfcTagRepository(), new InMemoryNfcAssignmentRepository(), () => CustomerId('customer-fixed-1'));
    const membership: Membership = {
      id: MembershipId('membership-1'),
      organizationId: OrganizationId('org-1'),
      userId: UserId('user-1'),
      role: 'administrator',
    };

    const result = await service.createCustomer(membership, OrganizationId('org-1'), CUSTOMER_DISPLAY_NAME);

    expect(result).toEqual({
      status: 'accepted',
      customer: { id: CustomerId('customer-fixed-1'), organizationId: OrganizationId('org-1'), displayName: CUSTOMER_DISPLAY_NAME, active: true },
      event: {
        type: 'CustomerCreated',
        customer: { id: CustomerId('customer-fixed-1'), organizationId: OrganizationId('org-1'), displayName: CUSTOMER_DISPLAY_NAME, active: true },
      },
    });
    expect(await repository.findById(CustomerId('customer-fixed-1'))).toEqual(
      result.status === 'accepted' ? result.customer : undefined,
    );
  });

  it('requires and preserves the explicitly supplied Customer display name in the result, event, and repository', async () => {
    expectTypeOf<Parameters<OrganizationAdministrationService['createCustomer']>>().toEqualTypeOf<[
      Membership | null,
      OrganizationId,
      string,
    ]>();

    const repository = new InMemoryCustomerRepository();
    const service = new OrganizationAdministrationService(
      new MembershipAuthorizationValidator(),
      repository,
      new InMemoryNfcTagRepository(),
      new InMemoryNfcAssignmentRepository(),
      () => CustomerId('customer-explicit-name'),
    );
    const membership: Membership = {
      id: MembershipId('membership-explicit-customer-name'),
      organizationId: OrganizationId('org-1'),
      userId: UserId('user-explicit-customer-name'),
      role: 'administrator',
    };
    const displayName = 'Kronenwerk Services GmbH';

    const result = await service.createCustomer(membership, OrganizationId('org-1'), displayName);

    expect(result.status).toBe('accepted');
    if (result.status === 'accepted') {
      expect(result.customer.displayName).toBe(displayName);
      expect(result.event.customer.displayName).toBe(displayName);
    }
    expect((await repository.findById(CustomerId('customer-explicit-name')))?.displayName).toBe(displayName);
  });

  it('calls CustomerRepository.save exactly once with the constructed Customer on the accepted path', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const repository: CustomerRepository = { findById: vi.fn().mockResolvedValue(null), save };
    const validator = new MembershipAuthorizationValidator();
    const service = new OrganizationAdministrationService(validator, repository, new InMemoryNfcTagRepository(), new InMemoryNfcAssignmentRepository(), () => CustomerId('customer-fixed-2'));
    const membership: Membership = {
      id: MembershipId('membership-1'),
      organizationId: OrganizationId('org-1'),
      userId: UserId('user-1'),
      role: 'administrator',
    };

    const result = await service.createCustomer(membership, OrganizationId('org-1'), CUSTOMER_DISPLAY_NAME);

    expect(save).toHaveBeenCalledTimes(1);
    expect(result.status).toBe('accepted');
    if (result.status === 'accepted') {
      expect(save).toHaveBeenCalledWith(result.customer);
      expect(result.event.customer).toEqual(result.customer);
    }
  });

  it('rejected: missing Membership returns membership_not_found and performs no write', async () => {
    const repository = new InMemoryCustomerRepository();
    const validator = new MembershipAuthorizationValidator();
    const service = new OrganizationAdministrationService(validator, repository, new InMemoryNfcTagRepository(), new InMemoryNfcAssignmentRepository(), () => CustomerId('customer-should-not-exist'));

    const result = await service.createCustomer(null, OrganizationId('org-1'), CUSTOMER_DISPLAY_NAME);

    expect(result).toEqual({ status: 'rejected', reason: 'membership_not_found' });
    expect(await repository.findById(CustomerId('customer-should-not-exist'))).toBeNull();
  });

  it('rejected: Employee Membership returns membership_lacks_administrator_role and performs no write', async () => {
    const repository = new InMemoryCustomerRepository();
    const validator = new MembershipAuthorizationValidator();
    const service = new OrganizationAdministrationService(validator, repository, new InMemoryNfcTagRepository(), new InMemoryNfcAssignmentRepository(), () => CustomerId('customer-should-not-exist'));
    const membership: Membership = {
      id: MembershipId('membership-1'),
      organizationId: OrganizationId('org-1'),
      userId: UserId('user-1'),
      role: 'employee',
    };

    const result = await service.createCustomer(membership, OrganizationId('org-1'), CUSTOMER_DISPLAY_NAME);

    expect(result).toEqual({ status: 'rejected', reason: 'membership_lacks_administrator_role' });
    expect(await repository.findById(CustomerId('customer-should-not-exist'))).toBeNull();
  });

  it('rejected: Administrator Membership of a different Organization returns cross_organization_access and performs no write', async () => {
    const repository = new InMemoryCustomerRepository();
    const validator = new MembershipAuthorizationValidator();
    const service = new OrganizationAdministrationService(validator, repository, new InMemoryNfcTagRepository(), new InMemoryNfcAssignmentRepository(), () => CustomerId('customer-should-not-exist'));
    const membership: Membership = {
      id: MembershipId('membership-1'),
      organizationId: OrganizationId('org-1'),
      userId: UserId('user-1'),
      role: 'administrator',
    };

    const result = await service.createCustomer(membership, OrganizationId('org-2'), CUSTOMER_DISPLAY_NAME);

    expect(result).toEqual({ status: 'rejected', reason: 'cross_organization_access' });
    expect(await repository.findById(CustomerId('customer-should-not-exist'))).toBeNull();
  });

  it('never calls CustomerRepository.save for any rejection path (explicit spy proof)', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const findById = vi.fn().mockResolvedValue(null);
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

    await service.createCustomer(null, OrganizationId('org-1'), CUSTOMER_DISPLAY_NAME);
    await service.createCustomer(employeeMembership, OrganizationId('org-1'), CUSTOMER_DISPLAY_NAME);
    await service.createCustomer(crossOrgMembership, OrganizationId('org-2'), CUSTOMER_DISPLAY_NAME);

    expect(save).not.toHaveBeenCalled();
  });
});

describe('OrganizationAdministrationService.registerNfcTag (DT-024)', () => {
  it('accepted path: Administrator Membership for the same Organization registers the NfcTag and produces NfcTagRegistered', async () => {
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

    const result = await service.registerNfcTag(membership, OrganizationId('org-1'), payload, NFC_TAG_DISPLAY_NAME);

    expect(result).toEqual({
      status: 'accepted',
      nfcTag: {
        id: NfcTagId('tag-fixed-1'),
        organizationId: OrganizationId('org-1'),
        displayName: NFC_TAG_DISPLAY_NAME,
        payload,
      },
      event: {
        type: 'NfcTagRegistered',
        nfcTag: {
          id: NfcTagId('tag-fixed-1'),
          organizationId: OrganizationId('org-1'),
          displayName: NFC_TAG_DISPLAY_NAME,
          payload,
        },
      },
    });
    expect(await nfcTagRepository.findByPayload(payload)).toEqual(
      result.status === 'accepted' ? result.nfcTag : undefined,
    );
  });

  it('requires and preserves the explicitly supplied NFC tag display name in the result, event, and repository', async () => {
    expectTypeOf<Parameters<OrganizationAdministrationService['registerNfcTag']>>().toEqualTypeOf<[
      Membership | null,
      OrganizationId,
      ReturnType<typeof createNfcPayload>,
      string,
    ]>();

    const nfcTagRepository = new InMemoryNfcTagRepository();
    const service = new OrganizationAdministrationService(
      new MembershipAuthorizationValidator(),
      new InMemoryCustomerRepository(),
      nfcTagRepository,
      new InMemoryNfcAssignmentRepository(),
      () => CustomerId('customer-unused'),
      () => NfcTagId('tag-explicit-name'),
    );
    const membership: Membership = {
      id: MembershipId('membership-explicit-tag-name'),
      organizationId: OrganizationId('org-1'),
      userId: UserId('user-explicit-tag-name'),
      role: 'administrator',
    };
    const payload = createNfcPayload('payload-explicit-tag-name');
    const displayName = 'Haupteingang Lager Nord';

    const result = await service.registerNfcTag(membership, OrganizationId('org-1'), payload, displayName);

    expect(result.status).toBe('accepted');
    if (result.status === 'accepted') {
      expect(result.nfcTag.displayName).toBe(displayName);
      expect(result.event.nfcTag.displayName).toBe(displayName);
    }
    expect((await nfcTagRepository.findByPayload(payload))?.displayName).toBe(displayName);
  });

  it('calls NfcTagRepository.register exactly once with the constructed NfcTag on the accepted path', async () => {
    const register = vi.fn().mockResolvedValue(undefined);
    const nfcTagRepository: NfcTagRepository = { findByPayload: vi.fn().mockResolvedValue(null), register };
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

    const result = await service.registerNfcTag(
      membership,
      OrganizationId('org-1'),
      createNfcPayload('payload-2'),
      NFC_TAG_DISPLAY_NAME,
    );

    expect(register).toHaveBeenCalledTimes(1);
    expect(result.status).toBe('accepted');
    if (result.status === 'accepted') {
      expect(register).toHaveBeenCalledWith(result.nfcTag);
      expect(result.event.nfcTag).toEqual(result.nfcTag);
    }
  });

  it('rejected: missing Membership returns membership_not_found and performs no write', async () => {
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

    const result = await service.registerNfcTag(null, OrganizationId('org-1'), payload, NFC_TAG_DISPLAY_NAME);

    expect(result).toEqual({ status: 'rejected', reason: 'membership_not_found' });
    expect(await nfcTagRepository.findByPayload(payload)).toBeNull();
  });

  it('rejected: Employee Membership returns membership_lacks_administrator_role and performs no write', async () => {
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

    const result = await service.registerNfcTag(membership, OrganizationId('org-1'), payload, NFC_TAG_DISPLAY_NAME);

    expect(result).toEqual({ status: 'rejected', reason: 'membership_lacks_administrator_role' });
    expect(await nfcTagRepository.findByPayload(payload)).toBeNull();
  });

  it('rejected: Administrator Membership of a different Organization returns cross_organization_access and performs no write', async () => {
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

    const result = await service.registerNfcTag(membership, OrganizationId('org-2'), payload, NFC_TAG_DISPLAY_NAME);

    expect(result).toEqual({ status: 'rejected', reason: 'cross_organization_access' });
    expect(await nfcTagRepository.findByPayload(payload)).toBeNull();
  });

  it('never calls NfcTagRepository.register for any rejection path (explicit spy proof)', async () => {
    const register = vi.fn().mockResolvedValue(undefined);
    const findByPayload = vi.fn().mockResolvedValue(null);
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

    await service.registerNfcTag(null, OrganizationId('org-1'), createNfcPayload('payload-6'), NFC_TAG_DISPLAY_NAME);
    await service.registerNfcTag(employeeMembership, OrganizationId('org-1'), createNfcPayload('payload-7'), NFC_TAG_DISPLAY_NAME);
    await service.registerNfcTag(crossOrgMembership, OrganizationId('org-2'), createNfcPayload('payload-8'), NFC_TAG_DISPLAY_NAME);

    expect(register).not.toHaveBeenCalled();
  });

  it('uses the injected deterministic NfcTagId generator for the registered NfcTag', async () => {
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

    const result = await service.registerNfcTag(
      membership,
      OrganizationId('org-1'),
      createNfcPayload('payload-9'),
      NFC_TAG_DISPLAY_NAME,
    );

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
    displayName: 'Synthetic Tag',
    payload: createNfcPayload('payload-tag-1'),
  };

  it('accepted path: Administrator Membership, matching NfcTag, and matching AssignmentTarget/Customer saves the NfcAssignment and produces NfcTagAssigned', async () => {
    const customerRepository = new InMemoryCustomerRepository();
    const customer: Customer = { id: CustomerId('customer-1'), organizationId: OrganizationId('org-1'), displayName: 'Synthetic Customer', active: true };
    await customerRepository.save(customer);
    const save = vi.fn().mockResolvedValue(undefined);
    const nfcAssignmentRepository: NfcAssignmentRepository = { findActiveByTagId: vi.fn().mockResolvedValue(null), save };
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

    const result = await service.assignNfcTag(membership, OrganizationId('org-1'), matchingNfcTag, target);

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

  it('rejected: missing Membership returns membership_not_found and performs no write', async () => {
    const customerRepository = new InMemoryCustomerRepository();
    const customer: Customer = { id: CustomerId('customer-1'), organizationId: OrganizationId('org-1'), displayName: 'Synthetic Customer', active: true };
    await customerRepository.save(customer);
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

    const result = await service.assignNfcTag(null, OrganizationId('org-1'), matchingNfcTag, target);

    expect(result).toEqual({ status: 'rejected', reason: 'membership_not_found' });
    expect(await nfcAssignmentRepository.findActiveByTagId(matchingNfcTag.id)).toBeNull();
  });

  it('rejected: Employee Membership returns membership_lacks_administrator_role and performs no write', async () => {
    const customerRepository = new InMemoryCustomerRepository();
    const customer: Customer = { id: CustomerId('customer-1'), organizationId: OrganizationId('org-1'), displayName: 'Synthetic Customer', active: true };
    await customerRepository.save(customer);
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

    const result = await service.assignNfcTag(employeeMembership, OrganizationId('org-1'), matchingNfcTag, target);

    expect(result).toEqual({ status: 'rejected', reason: 'membership_lacks_administrator_role' });
    expect(await nfcAssignmentRepository.findActiveByTagId(matchingNfcTag.id)).toBeNull();
  });

  it('rejected: Administrator Membership of a different Organization returns cross_organization_access and performs no write', async () => {
    const customerRepository = new InMemoryCustomerRepository();
    const customer: Customer = { id: CustomerId('customer-1'), organizationId: OrganizationId('org-1'), displayName: 'Synthetic Customer', active: true };
    await customerRepository.save(customer);
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

    const result = await service.assignNfcTag(membership, OrganizationId('org-2'), matchingNfcTag, target);

    expect(result).toEqual({ status: 'rejected', reason: 'cross_organization_access' });
    expect(await nfcAssignmentRepository.findActiveByTagId(matchingNfcTag.id)).toBeNull();
  });

  it('rejected: NfcTag Organization mismatch returns cross_organization_access and performs no write', async () => {
    const customerRepository = new InMemoryCustomerRepository();
    const customer: Customer = { id: CustomerId('customer-1'), organizationId: OrganizationId('org-1'), displayName: 'Synthetic Customer', active: true };
    await customerRepository.save(customer);
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
    const mismatchedNfcTag: NfcTag = { id: NfcTagId('tag-2'), organizationId: OrganizationId('org-2'), displayName: 'Synthetic Tag', payload: createNfcPayload('payload-tag-2') };
    const target = customerAssignmentTarget(customer.id);

    const result = await service.assignNfcTag(membership, OrganizationId('org-1'), mismatchedNfcTag, target);

    expect(result).toEqual({ status: 'rejected', reason: 'cross_organization_access' });
    expect(await nfcAssignmentRepository.findActiveByTagId(mismatchedNfcTag.id)).toBeNull();
  });

  it('rejected: AssignmentTarget/Customer Organization mismatch returns cross_organization_access and performs no write', async () => {
    const customerRepository = new InMemoryCustomerRepository();
    const otherOrgCustomer: Customer = { id: CustomerId('customer-2'), organizationId: OrganizationId('org-2'), displayName: 'Synthetic Customer', active: true };
    await customerRepository.save(otherOrgCustomer);
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

    const result = await service.assignNfcTag(membership, OrganizationId('org-1'), matchingNfcTag, target);

    expect(result).toEqual({ status: 'rejected', reason: 'cross_organization_access' });
    expect(await nfcAssignmentRepository.findActiveByTagId(matchingNfcTag.id)).toBeNull();
  });

  it('rejected: missing AssignmentTarget/Customer returns cross_organization_access and performs no write', async () => {
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

    const result = await service.assignNfcTag(membership, OrganizationId('org-1'), matchingNfcTag, target);

    expect(result).toEqual({ status: 'rejected', reason: 'cross_organization_access' });
    expect(await nfcAssignmentRepository.findActiveByTagId(matchingNfcTag.id)).toBeNull();
  });

  it('never calls NfcAssignmentRepository.save for any rejection path (explicit spy proof)', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const findActiveByTagId = vi.fn().mockResolvedValue(null);
    const nfcAssignmentRepository: NfcAssignmentRepository = { findActiveByTagId, save };
    const customerRepository = new InMemoryCustomerRepository();
    const otherOrgCustomer: Customer = { id: CustomerId('customer-2'), organizationId: OrganizationId('org-2'), displayName: 'Synthetic Customer', active: true };
    await customerRepository.save(otherOrgCustomer);
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
    const mismatchedNfcTag: NfcTag = { id: NfcTagId('tag-2'), organizationId: OrganizationId('org-2'), displayName: 'Synthetic Tag', payload: createNfcPayload('payload-tag-2') };
    const matchingTarget = customerAssignmentTarget(CustomerId('customer-does-not-exist'));
    const otherOrgTarget = customerAssignmentTarget(otherOrgCustomer.id);

    await service.assignNfcTag(null, OrganizationId('org-1'), matchingNfcTag, matchingTarget);
    await service.assignNfcTag(employeeMembership, OrganizationId('org-1'), matchingNfcTag, matchingTarget);
    await service.assignNfcTag(membership, OrganizationId('org-2'), matchingNfcTag, matchingTarget);
    await service.assignNfcTag(membership, OrganizationId('org-1'), mismatchedNfcTag, matchingTarget);
    await service.assignNfcTag(membership, OrganizationId('org-1'), matchingNfcTag, otherOrgTarget);
    await service.assignNfcTag(membership, OrganizationId('org-1'), matchingNfcTag, matchingTarget);

    expect(save).not.toHaveBeenCalled();
  });

  it('uses the injected deterministic NfcAssignmentId generator for the saved NfcAssignment', async () => {
    const customerRepository = new InMemoryCustomerRepository();
    const customer: Customer = { id: CustomerId('customer-1'), organizationId: OrganizationId('org-1'), displayName: 'Synthetic Customer', active: true };
    await customerRepository.save(customer);
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

    const result = await service.assignNfcTag(membership, OrganizationId('org-1'), matchingNfcTag, target);

    expect(result.status).toBe('accepted');
    if (result.status === 'accepted') {
      expect(result.nfcAssignment.id).toBe(NfcAssignmentId('assignment-deterministic-fixed'));
    }
  });
});
