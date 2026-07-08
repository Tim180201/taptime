import type { CustomerRepository } from '../../ports/CustomerRepository';
import type { Customer } from '../../domain/Customer';
import type { CustomerId } from '../../domain/ids';

export class InMemoryCustomerRepository implements CustomerRepository {
  private readonly customers: Customer[];

  constructor(customers: readonly Customer[] = []) {
    this.customers = [...customers];
  }

  findById(customerId: CustomerId): Customer | null {
    return this.customers.find((customer) => customer.id === customerId) ?? null;
  }

  save(customer: Customer): void {
    this.customers.push(customer);
  }
}
