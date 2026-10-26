import { isIsoTimestamp } from '@taptime/core';

export type LockScreenAction = 'pause' | 'resume' | 'stop';
export const LOCK_SCREEN_V2_ACCEPT = 'application/vnd.taptime.lock-screen.v2+json';
export type LockScreenResponseVersion = 'lock-screen-action.v1' | 'lock-screen-action.v2';
export type LockScreenArchiveStatus = 'pending' | 'archived';
export interface LockScreenCapabilityRequest {
  readonly expectedMembershipId: string;
  readonly timeEntryId: string;
  readonly installationId: string | null;
}
export interface LockScreenActionRequest {
  readonly action: LockScreenAction;
  readonly commandId: string;
}
export interface LockScreenState {
  readonly timeEntryId: string;
  readonly status: 'running' | 'paused' | 'stopped';
  readonly startedAt: string;
  readonly breakStartedAt: string | null;
  readonly stoppedAt: string | null;
  readonly asOf: string;
  readonly workDurationSeconds: number;
  readonly breakDurationSeconds: number;
  readonly target: { readonly targetType: 'customer' | 'project' | 'general_work'; readonly targetId: string; readonly displayName: string };
}
export type LockScreenCapabilityResult = {
  readonly status: 'issued';
  readonly capability: string;
  readonly expiresAt: string;
  readonly state: LockScreenState;
} | { readonly status: 'unauthorized' };
export type LockScreenActionResult = {
  readonly status: 'applied' | 'state_changed';
  readonly state: LockScreenState;
  readonly idempotentRetry: boolean;
} | { readonly status: 'unauthorized' | 'command_id_conflict' }
  | { readonly status: 'rate_limited'; readonly retryAfterSeconds: number };
export type LockScreenCapabilityResultV2 =
  | (Extract<LockScreenCapabilityResult, { status: 'issued' }> & { readonly archiveStatus: LockScreenArchiveStatus })
  | Extract<LockScreenCapabilityResult, { status: 'unauthorized' }>;
export type LockScreenActionResultV2 =
  | (Extract<LockScreenActionResult, { state: LockScreenState }> & { readonly archiveStatus: LockScreenArchiveStatus })
  | Exclude<LockScreenActionResult, { state: LockScreenState }>;
export interface LockScreenHistoryEvent {
  readonly workEventId: string;
  readonly action: LockScreenAction;
  readonly at: string;
}

const object = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const keys = (value: Record<string, unknown>, fields: string[]) => Object.keys(value).length === fields.length && fields.every(field => Object.hasOwn(value, field));
const uuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
const timestamp = (value: unknown): value is string => typeof value === 'string' && isIsoTimestamp(value);
const seconds = (value: unknown) => Number.isSafeInteger(value) && Number(value) >= 0;
export const isLockScreenAction = (value: unknown): value is LockScreenAction => value === 'pause' || value === 'resume' || value === 'stop';
// Exactly 32 bytes, canonical unpadded base64url (including zero padding bits).
export const isLockScreenCapability = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/.test(value);
export function isLockScreenCapabilityRequest(value: unknown): value is LockScreenCapabilityRequest {
  return object(value) && keys(value, ['expectedMembershipId', 'timeEntryId', 'installationId'])
    && uuid(value.expectedMembershipId) && uuid(value.timeEntryId) && (value.installationId === null || uuid(value.installationId));
}
export function isLockScreenActionRequest(value: unknown): value is LockScreenActionRequest {
  return object(value) && keys(value, ['action', 'commandId']) && isLockScreenAction(value.action) && uuid(value.commandId);
}
export function isLockScreenState(value: unknown): value is LockScreenState {
  if (!object(value) || !keys(value, ['timeEntryId', 'status', 'startedAt', 'breakStartedAt', 'stoppedAt', 'asOf', 'workDurationSeconds', 'breakDurationSeconds', 'target'])
    || !uuid(value.timeEntryId) || !timestamp(value.startedAt) || !timestamp(value.asOf)
    || !seconds(value.workDurationSeconds) || !seconds(value.breakDurationSeconds)
    || !object(value.target) || !keys(value.target, ['targetType', 'targetId', 'displayName'])
    || !['customer', 'project', 'general_work'].includes(String(value.target.targetType))
    || !uuid(value.target.targetId) || typeof value.target.displayName !== 'string' || value.target.displayName.length === 0) return false;
  if (Date.parse(value.asOf) < Date.parse(value.startedAt)) return false;
  if (value.status === 'stopped') return value.breakStartedAt === null && timestamp(value.stoppedAt)
    && Date.parse(value.stoppedAt) >= Date.parse(value.startedAt) && Date.parse(value.stoppedAt) <= Date.parse(value.asOf);
  return value.stoppedAt === null && (value.status === 'running' ? value.breakStartedAt === null
    : value.status === 'paused' && timestamp(value.breakStartedAt) && Date.parse(value.breakStartedAt) >= Date.parse(value.startedAt)
      && Date.parse(value.breakStartedAt) <= Date.parse(value.asOf));
}
export function isLockScreenCapabilityResult(value: unknown): value is LockScreenCapabilityResult {
  return object(value) && (value.status === 'issued'
    ? keys(value, ['status', 'capability', 'expiresAt', 'state']) && isLockScreenCapability(value.capability)
      && timestamp(value.expiresAt) && isLockScreenState(value.state) && value.state.status !== 'stopped'
    : keys(value, ['status']) && value.status === 'unauthorized');
}
export function isLockScreenActionResult(value: unknown): value is LockScreenActionResult {
  return object(value) && (value.status === 'applied' || value.status === 'state_changed'
    ? keys(value, ['status', 'state', 'idempotentRetry']) && isLockScreenState(value.state) && typeof value.idempotentRetry === 'boolean'
    : value.status === 'rate_limited'
      ? keys(value, ['status', 'retryAfterSeconds']) && Number.isSafeInteger(value.retryAfterSeconds) && Number(value.retryAfterSeconds) > 0
      : keys(value, ['status']) && (value.status === 'unauthorized' || value.status === 'command_id_conflict'));
}
export function isLockScreenCapabilityResultV2(value: unknown): value is LockScreenCapabilityResultV2 {
  if (!object(value) || value.status !== 'issued') return isLockScreenCapabilityResult(value);
  const { archiveStatus, ...legacy } = value;
  return (archiveStatus === 'pending' || archiveStatus === 'archived') && isLockScreenCapabilityResult(legacy);
}
export function isLockScreenActionResultV2(value: unknown): value is LockScreenActionResultV2 {
  if (!object(value) || (value.status !== 'applied' && value.status !== 'state_changed')) return isLockScreenActionResult(value);
  const { archiveStatus, ...legacy } = value;
  return (archiveStatus === 'pending' || archiveStatus === 'archived') && isLockScreenActionResult(legacy);
}
export function isLockScreenHistory(value: unknown): value is readonly LockScreenHistoryEvent[] {
  return Array.isArray(value) && value.every(event => object(event) && keys(event, ['workEventId', 'action', 'at'])
    && uuid(event.workEventId) && isLockScreenAction(event.action) && timestamp(event.at));
}
