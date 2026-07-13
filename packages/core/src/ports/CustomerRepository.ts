import type { Customer } from '../domain/Customer';
import type { CustomerId } from '../domain/ids';

export interface CustomerRepository {
  findById(customerId: CustomerId): Promise<Customer | null>;
  save(customer: Customer): Promise<void>;
}
