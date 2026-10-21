import type { LockScreenAction, LockScreenState, LockScreenCapabilityRequest } from '@taptime/mobile-work-contract';

export interface LockScreenStand {
  readonly owner?: string;
  readonly revision?: string;
  readonly state?: LockScreenState;
  readonly pending?: {readonly commandId: string; readonly action: LockScreenAction};
  readonly display?: 'STATE'|'TRANSFERRING'|'SENDING'|'NOT_SENT'|'UNCONFIRMED'|'OPEN_APP'|'UPDATE_APP';
  readonly ownCapturePending?: boolean;
  readonly permissionGranted: boolean;
  readonly permissionAsked: boolean;
}
export type IssueStatus = 'issued'|'unauthorized'|'unavailable'|'superseded'|'update_required';
export interface LockScreenNativePort {
  read(): LockScreenStand | null;
  bind(owner: string): boolean;
  clear(): boolean;
  suspend(): boolean;
  awaitOwnCapture(): boolean;
  project(owner: string, state: LockScreenState|null, revision: string, discardPending: boolean): boolean;
  issue(owner: string, token: string, request: LockScreenCapabilityRequest, revision: string): Promise<IssueStatus>;
  retry(): Promise<void>;
  subscribe(listener:()=>void):()=>void;
  ensurePermission():Promise<void>;
  openSettings():void;
}
export interface CaptureRejection {readonly message:string;readonly blocked:boolean}
export interface CaptureBoundary {
  getCaptureRejection?(): CaptureRejection|null;
  beforeCapture(): Promise<boolean>;
  afterCapture(): Promise<void>;
}
export interface LockScreenUiState {readonly notificationsDenied:boolean;readonly blockedReason:string|null}
export interface LockScreenCapability {
  getState():LockScreenUiState;
  subscribe(listener:()=>void):()=>void;
  openSettings():void;
}
