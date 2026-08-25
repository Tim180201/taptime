import type { NfcAssignmentId, NfcTagId, OrganizationId, UserId, WorkEventId } from './ids';
import type { WorkTarget } from './AssignmentTarget';
import type { Timestamp } from './Timestamp';

interface WorkEventBase {
  readonly id: WorkEventId;
  readonly organizationId: OrganizationId;
  readonly triggeredBy: UserId;
  readonly occurredAt: Timestamp;
}

interface WorkTargetEventBase extends WorkEventBase {
  /** Missing on legacy events; absence remains canonical `work`. */
  readonly subject?: { readonly type: 'work' };
  readonly target: WorkTarget;
}

/**
 * The optional discriminator preserves the exact v1 Core object bytes while making new NFC
 * evidence explicitly representable. Missing `trigger` is canonical legacy NFC.
 */
export interface NfcWorkEvent extends WorkTargetEventBase {
  readonly assignmentId: NfcAssignmentId;
  readonly nfcTagId: NfcTagId;
  readonly trigger?: {
    readonly type: 'nfc';
    readonly assignmentId: NfcAssignmentId;
    readonly nfcTagId: NfcTagId;
  };
}

export interface ManualWorkEvent extends WorkTargetEventBase {
  readonly trigger: { readonly type: 'manual' };
  readonly assignmentId?: never;
  readonly nfcTagId?: never;
}

export interface NfcBreakWorkEvent extends WorkEventBase {
  readonly subject: { readonly type: 'break' };
  readonly target?: never;
  readonly assignmentId: NfcAssignmentId;
  readonly nfcTagId: NfcTagId;
  readonly trigger: {
    readonly type: 'nfc';
    readonly assignmentId: NfcAssignmentId;
    readonly nfcTagId: NfcTagId;
  };
}

export interface ManualBreakWorkEvent extends WorkEventBase {
  readonly subject: { readonly type: 'break' };
  readonly target?: never;
  readonly trigger: { readonly type: 'manual' };
  readonly assignmentId?: never;
  readonly nfcTagId?: never;
}

export type WorkTargetEvent = NfcWorkEvent | ManualWorkEvent;
export type BreakWorkEvent = NfcBreakWorkEvent | ManualBreakWorkEvent;
export type WorkEvent = WorkTargetEvent | BreakWorkEvent;
export type WorkEventSubjectType = 'work' | 'break';

export type WorkEventTriggerType = 'nfc' | 'manual';

export function workEventTriggerType(workEvent: WorkEvent): WorkEventTriggerType {
  return workEvent.trigger?.type ?? 'nfc';
}

export function workEventSubjectType(workEvent: WorkEvent): WorkEventSubjectType {
  return workEvent.subject?.type ?? 'work';
}

export function isBreakWorkEvent(workEvent: WorkEvent): workEvent is BreakWorkEvent {
  return workEventSubjectType(workEvent) === 'break';
}
