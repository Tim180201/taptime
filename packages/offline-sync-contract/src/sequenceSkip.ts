import { isCanonicalOfflineUuid, isOfflineBase64Url32Bytes, isOfflineIsoTimestamp, isPositiveSafeInteger } from './validation.js';

/** A report of unchanged local evidence; never a lifecycle event. */
export interface OfflineSequenceSkipCommand {
  readonly organizationId: string;
  readonly expectedMembershipId: string;
  readonly installationBinding: string;
  readonly leaseId: string;
  readonly leaseItemId: string;
  readonly deviceSequence: number;
  readonly workEventId: string;
  readonly receiptId: string;
  readonly occurredAt: string;
  readonly reason: string;
  readonly evidenceSha256: string;
}
export type OfflineSequenceSkipResult =
  | { readonly status: 'reported'; readonly workEventId: string; readonly receiptId: string;
      readonly deviceSequence: number; readonly evidenceSha256: string; readonly idempotentRetry: boolean }
  | { readonly status: 'conflict' }
  | { readonly status: 'authority_rejected' };
export function isOfflineQuarantineReason(value: unknown): value is string {
  return typeof value === 'string' && (['event_content_conflict','sequence_content_conflict',
    'lease_binding_conflict','receipt_metadata_conflict','invalid_response'].includes(value)
    || /^http_(400|409|422)$/.test(value));
}
export function isOfflineSequenceSkipCommand(value: unknown): value is OfflineSequenceSkipCommand {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  const keys = ['organizationId','expectedMembershipId','installationBinding','leaseId','leaseItemId',
    'deviceSequence','workEventId','receiptId','occurredAt','reason','evidenceSha256'];
  return Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v,k))
    && ['organizationId','expectedMembershipId','leaseId','leaseItemId','workEventId','receiptId'].every(k => isCanonicalOfflineUuid(v[k]))
    && isOfflineBase64Url32Bytes(v.installationBinding) && isPositiveSafeInteger(v.deviceSequence)
    && isOfflineIsoTimestamp(v.occurredAt) && isOfflineQuarantineReason(v.reason)
    && typeof v.evidenceSha256 === 'string' && /^[0-9a-f]{64}$/.test(v.evidenceSha256);
}
