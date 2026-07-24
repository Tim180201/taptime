import type { NfcAssignmentId, NfcTagId, OrganizationId, UserId, WorkEventId } from './ids';
import type { WorkTarget } from './AssignmentTarget';
import type { Timestamp } from './Timestamp';

interface WorkEventBase {
  readonly id: WorkEventId;
  readonly organizationId: OrganizationId;
  readonly target: WorkTarget;
  readonly triggeredBy: UserId;
  readonly occurredAt: Timestamp;
}

/**
 * The optional discriminator preserves the exact v1 Core object bytes while making new NFC
 * evidence explicitly representable. Missing `trigger` is canonical legacy NFC.
 */
export interface NfcWorkEvent extends WorkEventBase {
  readonly assignmentId: NfcAssignmentId;
  readonly nfcTagId: NfcTagId;
  readonly trigger?: {
    readonly type: 'nfc';
    readonly assignmentId: NfcAssignmentId;
    readonly nfcTagId: NfcTagId;
  };
}

export interface ManualWorkEvent extends WorkEventBase {
  readonly trigger: { readonly type: 'manual' };
  readonly assignmentId?: never;
  readonly nfcTagId?: never;
}

export type WorkEvent = NfcWorkEvent | ManualWorkEvent;

export type WorkEventTriggerType = 'nfc' | 'manual';

export function workEventTriggerType(workEvent: WorkEvent): WorkEventTriggerType {
  return workEvent.trigger?.type ?? 'nfc';
}
