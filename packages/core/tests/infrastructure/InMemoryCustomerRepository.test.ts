import { describe, expect, it } from 'vitest';
import { InMemoryCustomerRepository } from '../../src/infrastructure/repositories/InMemoryCustomerRepository';
import { CustomerId, OrganizationId } from '../../src/domain/ids';
import type { Customer } from '../../src/domain/Customer';

describe('InMemoryCustomerRepository (DT-020)', () => {
  it('returns null when no Customer was ever saved for the given id', async () => {
    const repository = new InMemoryCustomerRepository();

    expect(await repository.findById(CustomerId('customer-1'))).toBeNull();
  });

  it('saves a Customer and finds it again by id (round-trip)', async () => {
    const repository = new InMemoryCustomerRepository();
    const customer: Customer = { id: CustomerId('customer-1'), organizationId: OrganizationId('org-1'), displayName: 'Synthetic Customer', active: true };

    await repository.save(customer);

    expect(await repository.findById(CustomerId('customer-1'))).toEqual(customer);
  });

  it('does not find a Customer saved under a different id', async () => {
    const repository = new InMemoryCustomerRepository();
    await repository.save({ id: CustomerId('customer-1'), organizationId: OrganizationId('org-1'), displayName: 'Synthetic Customer', active: true });

    expect(await repository.findById(CustomerId('customer-2'))).toBeNull();
  });

  it('supports constructor-seeded Customers (existing, unchanged behavior)', async () => {
    const seeded: Customer = { id: CustomerId('customer-seed'), organizationId: OrganizationId('org-1'), displayName: 'Synthetic Customer', active: true };
    const repository = new InMemoryCustomerRepository([seeded]);

    expect(await repository.findById(CustomerId('customer-seed'))).toEqual(seeded);
  });

  it('does not mutate the array passed into its constructor', async () => {
    const seed: Customer[] = [{ id: CustomerId('customer-seed'), organizationId: OrganizationId('org-1'), displayName: 'Synthetic Customer', active: true }];
    const repository = new InMemoryCustomerRepository(seed);

    await repository.save({ id: CustomerId('customer-2'), organizationId: OrganizationId('org-1'), displayName: 'Synthetic Customer', active: true });

    expect(seed).toHaveLength(1);
  });
});
