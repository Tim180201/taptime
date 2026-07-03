import type { CustomerRepository } from '../../ports/CustomerRepository';
import type { Customer } from '../../domain/Customer';
import type { CustomerId } from '../../domain/ids';

export class InMemoryCustomerRepository implements CustomerRepository {
  constructor(private readonly customers: readonly Customer[] = []) {}

  findById(customerId: CustomerId): Customer | null {
    return this.customers.find((customer) => customer.id === customerId) ?? null;
  }
}
