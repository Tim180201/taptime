export type Brand<Value, BrandName extends string> = Value & { readonly __brand: BrandName };

function brandedNonEmptyString<BrandName extends string>(brandName: BrandName) {
  return (value: string): Brand<string, BrandName> => {
    if (!value || value.trim().length === 0) {
      throw new Error(`${brandName} must be a non-empty string`);
    }
    return value as Brand<string, BrandName>;
  };
}

export type OrganizationId = Brand<string, 'OrganizationId'>;
export const OrganizationId = brandedNonEmptyString<'OrganizationId'>('OrganizationId');

export type UserId = Brand<string, 'UserId'>;
export const UserId = brandedNonEmptyString<'UserId'>('UserId');

export type CustomerId = Brand<string, 'CustomerId'>;
export const CustomerId = brandedNonEmptyString<'CustomerId'>('CustomerId');

export type NfcTagId = Brand<string, 'NfcTagId'>;
export const NfcTagId = brandedNonEmptyString<'NfcTagId'>('NfcTagId');

// NfcAssignment is an Aggregate Root per TTAP-001 Domain Architecture; an identity value
// object is required even though TTAP-001's Value Objects list does not name it explicitly.
export type NfcAssignmentId = Brand<string, 'NfcAssignmentId'>;
export const NfcAssignmentId = brandedNonEmptyString<'NfcAssignmentId'>('NfcAssignmentId');

export type WorkEventId = Brand<string, 'WorkEventId'>;
export const WorkEventId = brandedNonEmptyString<'WorkEventId'>('WorkEventId');

export type TimeEntryId = Brand<string, 'TimeEntryId'>;
export const TimeEntryId = brandedNonEmptyString<'TimeEntryId'>('TimeEntryId');
