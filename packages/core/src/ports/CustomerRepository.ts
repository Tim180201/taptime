import type { Customer } from '../domain/Customer';
import type { CustomerId } from '../domain/ids';

export interface CustomerRepository {
  findById(customerId: CustomerId): Customer | null;
  save(customer: Customer): void;
}
