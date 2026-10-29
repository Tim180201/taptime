/** Optional payroll identifiers remain strings: leading zeroes are significant. */
export function isPersonnelNumber(value: unknown): value is string | null {
  return value === null || typeof value === 'string' && /^[0-9A-Za-z-]{1,20}$/.test(value);
}

export function isWorkWageType(value: unknown): value is string | null {
  return value === null || typeof value === 'string' && /^[0-9]{1,6}$/.test(value);
}

export interface MembershipPayroll {
  readonly personnelNumber: string | null;
  readonly rowVersion: number;
}

export interface PayrollSettings {
  readonly workWageType: string | null;
  readonly rowVersion: number;
  readonly missingPersonnelNumberCount: number;
}

export type PayrollMutationStatus = 'succeeded' | 'invalid_request' | 'forbidden'
  | 'target_unavailable' | 'already_departed' | 'stale_row_version' | 'command_id_conflict'
  | 'personnel_number_conflict';

export type PayrollMutationResult = { readonly status: 'succeeded'; readonly rowVersion: number; readonly idempotentRetry: boolean }
  | { readonly status: Exclude<PayrollMutationStatus, 'succeeded'> | 'unauthorized' };
