import type { OfflineLifecycleEventCommand, OfflineLifecycleEventCommandV2, OfflineLifecycleEventCommandV3,
  OfflineLifecycleEventResultV4 } from './types.js';
import { isCanonicalOfflineUuid, isOfflineLifecycleEventCommandV2, isOfflineLifecycleEventCommandV3 } from './validation.js';

export interface RestoreEvidenceCommandV1 {
  readonly contractVersion: 1;
  readonly operationId: string;
  readonly localState: 'confirmed' | 'pending';
  readonly evidence: OfflineLifecycleEventCommand | OfflineLifecycleEventCommandV2 | OfflineLifecycleEventCommandV3;
}
export interface RestoreEvidenceReceiptV1 {
  readonly status: 'recovery_pending';
  readonly operationId: string;
  readonly evidenceId: string;
  readonly evidenceDigest: string;
  readonly workEventId: string;
  readonly receiptId: string;
  readonly deviceSequence: number;
  readonly reason: 'origin_lost' | 'decision_lost';
  readonly archiveStatus: 'archive_pending' | 'offsite_archived';
  readonly idempotentRetry: boolean;
}
export type RestoreEvidenceResultV1 = OfflineLifecycleEventResultV4 | RestoreEvidenceReceiptV1
  | { readonly status: 'recovery_rejected'; readonly reason: 'operation_unavailable' | 'capture_after_activation' };

export function isRestoreEvidenceCommandV1(value: unknown): value is RestoreEvidenceCommandV1 {
  if (!fields(value,['contractVersion','operationId','localState','evidence']) || value.contractVersion !== 1
    || !isCanonicalOfflineUuid(value.operationId) || !['confirmed','pending'].includes(value.localState as string)) return false;
  const e = value.evidence;
  if (!record(e)) return false;
  if (e.provenanceVersion === 2) return isOfflineLifecycleEventCommandV2(e);
  if (e.provenanceVersion === 3) return isOfflineLifecycleEventCommandV3(e);
  if (e.provenanceVersion !== 1 || !fields(e,['organizationId','expectedMembershipId','leaseId','leaseItemId',
    'installationBinding','deviceSequence','provenanceVersion','clock','workEvent','receipt'])
    || !fields(e.workEvent,['id','assignmentId','nfcTagId','target','occurredAt'])) return false;
  const w = e.workEvent;
  return isOfflineLifecycleEventCommandV2({ ...e,provenanceVersion: 2,workEvent: {
    id:w.id,target:w.target,occurredAt:w.occurredAt,trigger:{type:'nfc',assignmentId:w.assignmentId,nfcTagId:w.nfcTagId},
  } });
}
function record(value: unknown): value is Record<string,unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
function fields(value: unknown,keys: string[]): value is Record<string,unknown> {
  return record(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value,key));
}

/** Canonical UTF-8 envelope bytes for the receipt digest (SHA-256, lowercase hex).
 * Sorting object keys makes independent serializers agree; arrays preserve order.
 * The operationId in a retry receipt is the original accepting operation.
 */
export function encodeRestoreEvidenceV1(command: RestoreEvidenceCommandV1): Uint8Array {
  if (!isRestoreEvidenceCommandV1(command)) throw new TypeError('Invalid recovery evidence');
  const ordered = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(ordered);
    if (record(value)) return Object.fromEntries(Object.keys(value).sort().map(key => [key,ordered(value[key])]));
    return value;
  };
  return new TextEncoder().encode(JSON.stringify(ordered(command)));
}
