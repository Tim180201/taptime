import type { CustomerRepository } from '../../ports/CustomerRepository';
import type { Customer } from '../../domain/Customer';
import type { CustomerId } from '../../domain/ids';

export class InMemoryCustomerRepository implements CustomerRepository {
  private readonly customers: Customer[];

  constructor(customers: readonly Customer[] = []) {
    this.customers = [...customers];
  }

  async findById(customerId: CustomerId): Promise<Customer | null> {
    return this.customers.find((customer) => customer.id === customerId) ?? null;
  }

  async save(customer: Customer): Promise<void> {
    this.customers.push(customer);
  }
}
