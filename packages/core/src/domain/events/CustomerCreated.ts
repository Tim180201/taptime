import type { Customer } from '../Customer';

export interface CustomerCreated {
  readonly type: 'CustomerCreated';
  readonly customer: Customer;
}

export function customerCreated(customer: Customer): CustomerCreated {
  return { type: 'CustomerCreated', customer };
}
