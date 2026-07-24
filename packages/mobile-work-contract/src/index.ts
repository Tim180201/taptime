export const MOBILE_OWN_TIME_LIMIT_MINIMUM = 1;
export const MOBILE_OWN_TIME_LIMIT_MAXIMUM = 20;
export const MOBILE_WORK_TARGET_LIMIT_MINIMUM = 1;
export const MOBILE_WORK_TARGET_LIMIT_MAXIMUM = 50;
export const MOBILE_CURSOR_MAXIMUM_ASCII_CHARACTERS = 256;
export const MOBILE_PROJECT_NAME_MAXIMUM_CHARACTERS = 120;

export type WorkTargetType = 'customer' | 'project' | 'general_work';
export type TriggerProvenance = 'nfc' | 'manual';
export type TimeRecordSource = 'canonical' | 'recovered';

export interface ClosedPageRequest {
  readonly expectedMembershipId: string;
  readonly limit: number;
  readonly cursor: string | null;
}

export type MobileOwnTimeQueryRequest = ClosedPageRequest;
export type MobileWorkTargetQueryRequest = ClosedPageRequest;
export type ProjectQueryRequest = ClosedPageRequest;

export interface SafeWorkTarget {
  readonly targetType: WorkTargetType;
  readonly targetId: string;
  readonly displayName: string;
}

export interface SafeOwnTimeRecord {
  readonly timeRecordId: string;
  readonly source: TimeRecordSource;
  readonly targetType: WorkTargetType;
  readonly targetDisplayName: string;
  readonly status: 'started' | 'stopped';
  readonly startedAt: string;
  readonly stoppedAt: string | null;
  readonly startedVia: TriggerProvenance | null;
  readonly stoppedVia: TriggerProvenance | null;
}

export interface MobileOwnTimeQueryResponse {
  readonly activeRecord: SafeOwnTimeRecord | null;
  readonly records: readonly SafeOwnTimeRecord[];
  readonly nextCursor: string | null;
  readonly windowStartedAt: string;
  readonly windowEndedAt: string;
}

export interface MobileWorkTargetQueryResponse {
  readonly targets: readonly SafeWorkTarget[];
  readonly nextCursor: string | null;
}

export interface ProjectSummary {
  readonly projectId: string;
  readonly displayName: string;
  readonly active: boolean;
  readonly rowVersion: number;
}

export interface ProjectCreateRequest {
  readonly expectedMembershipId: string;
  readonly commandId: string;
  readonly projectId: string;
  readonly displayName: string;
}

export interface ProjectDeactivateRequest {
  readonly expectedMembershipId: string;
  readonly commandId: string;
  readonly projectId: string;
  readonly expectedRowVersion: number;
}

export interface ManualLifecycleRequest {
  readonly expectedMembershipId: string;
  readonly workEvent: {
    readonly id: string;
    readonly target: {
      readonly targetType: WorkTargetType;
      readonly targetId: string;
    };
  };
  readonly receipt: {
    readonly id: string;
    readonly attemptNumber: 1;
  };
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const asciiPattern = /^[\x20-\x7e]*$/;
const isoTimestampPattern =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/;
const exactKeys = (value: Record<string, unknown>, keys: readonly string[]): boolean => {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length
    && actual.every((key, index) => key === expected[index]);
};

export function isCanonicalUuid(value: unknown): value is string {
  return typeof value === 'string' && uuidPattern.test(value);
}

export function isWorkTargetType(value: unknown): value is WorkTargetType {
  return value === 'customer' || value === 'project' || value === 'general_work';
}

export function isMobileCursor(value: unknown): value is string | null {
  return value === null || (
    typeof value === 'string'
    && value.length > 0
    && value.length <= MOBILE_CURSOR_MAXIMUM_ASCII_CHARACTERS
    && asciiPattern.test(value)
  );
}

export function validateClosedPageRequest(
  value: unknown,
  maximumLimit: number,
): value is ClosedPageRequest {
  if (!isObject(value) || !exactKeys(value, ['expectedMembershipId', 'limit', 'cursor'])) {
    return false;
  }
  return isCanonicalUuid(value.expectedMembershipId)
    && Number.isSafeInteger(value.limit)
    && Number(value.limit) >= 1
    && Number(value.limit) <= maximumLimit
    && isMobileCursor(value.cursor);
}

export function validateMobileOwnTimeQueryRequest(
  value: unknown,
): value is MobileOwnTimeQueryRequest {
  return validateClosedPageRequest(value, MOBILE_OWN_TIME_LIMIT_MAXIMUM);
}

export function validateMobileWorkTargetQueryRequest(
  value: unknown,
): value is MobileWorkTargetQueryRequest {
  return validateClosedPageRequest(value, MOBILE_WORK_TARGET_LIMIT_MAXIMUM);
}

export function validateProjectCreateRequest(value: unknown): value is ProjectCreateRequest {
  if (
    !isObject(value)
    || !exactKeys(value, [
      'expectedMembershipId',
      'commandId',
      'projectId',
      'displayName',
    ])
  ) {
    return false;
  }
  return isCanonicalUuid(value.expectedMembershipId)
    && isCanonicalUuid(value.commandId)
    && isCanonicalUuid(value.projectId)
    && typeof value.displayName === 'string'
    && value.displayName === value.displayName.trim()
    && value.displayName.length > 0
    && [...value.displayName].length <= MOBILE_PROJECT_NAME_MAXIMUM_CHARACTERS;
}

export function validateProjectDeactivateRequest(
  value: unknown,
): value is ProjectDeactivateRequest {
  if (
    !isObject(value)
    || !exactKeys(value, [
      'expectedMembershipId',
      'commandId',
      'projectId',
      'expectedRowVersion',
    ])
  ) {
    return false;
  }
  return isCanonicalUuid(value.expectedMembershipId)
    && isCanonicalUuid(value.commandId)
    && isCanonicalUuid(value.projectId)
    && Number.isSafeInteger(value.expectedRowVersion)
    && Number(value.expectedRowVersion) > 0;
}

export function validateManualLifecycleRequest(value: unknown): value is ManualLifecycleRequest {
  if (
    !isObject(value)
    || !exactKeys(value, ['expectedMembershipId', 'workEvent', 'receipt'])
    || !isObject(value.workEvent)
    || !exactKeys(value.workEvent, ['id', 'target'])
    || !isObject(value.workEvent.target)
    || !exactKeys(value.workEvent.target, ['targetType', 'targetId'])
    || !isObject(value.receipt)
    || !exactKeys(value.receipt, ['id', 'attemptNumber'])
  ) {
    return false;
  }
  return isCanonicalUuid(value.expectedMembershipId)
    && isCanonicalUuid(value.workEvent.id)
    && isWorkTargetType(value.workEvent.target.targetType)
    && isCanonicalUuid(value.workEvent.target.targetId)
    && isCanonicalUuid(value.receipt.id)
    && value.receipt.attemptNumber === 1;
}

export function validateOwnTimeResponse(value: unknown): value is MobileOwnTimeQueryResponse {
  if (
    !isObject(value)
    || !exactKeys(value, [
      'activeRecord',
      'records',
      'nextCursor',
      'windowStartedAt',
      'windowEndedAt',
    ])
    || (value.activeRecord !== null && !isOwnTimeRecord(value.activeRecord))
    || !Array.isArray(value.records)
    || !value.records.every(isOwnTimeRecord)
    || !isMobileCursor(value.nextCursor)
    || !isIsoTimestamp(value.windowStartedAt)
    || !isIsoTimestamp(value.windowEndedAt)
  ) {
    return false;
  }
  return true;
}

export function validateWorkTargetResponse(
  value: unknown,
): value is MobileWorkTargetQueryResponse {
  return isObject(value)
    && exactKeys(value, ['targets', 'nextCursor'])
    && Array.isArray(value.targets)
    && value.targets.every((target) => (
      isObject(target)
      && exactKeys(target, ['targetType', 'targetId', 'displayName'])
      && isWorkTargetType(target.targetType)
      && isCanonicalUuid(target.targetId)
      && typeof target.displayName === 'string'
      && target.displayName.length > 0
    ))
    && isMobileCursor(value.nextCursor);
}

function isOwnTimeRecord(value: unknown): value is SafeOwnTimeRecord {
  if (
    !isObject(value)
    || !exactKeys(value, [
      'timeRecordId',
      'source',
      'targetType',
      'targetDisplayName',
      'status',
      'startedAt',
      'stoppedAt',
      'startedVia',
      'stoppedVia',
    ])
  ) {
    return false;
  }
  return isCanonicalUuid(value.timeRecordId)
    && (value.source === 'canonical' || value.source === 'recovered')
    && isWorkTargetType(value.targetType)
    && typeof value.targetDisplayName === 'string'
    && value.targetDisplayName.length > 0
    && (value.status === 'started' || value.status === 'stopped')
    && isIsoTimestamp(value.startedAt)
    && (value.stoppedAt === null || isIsoTimestamp(value.stoppedAt))
    && (value.startedVia === null || value.startedVia === 'nfc' || value.startedVia === 'manual')
    && (value.stoppedVia === null || value.stoppedVia === 'nfc' || value.stoppedVia === 'manual');
}

function isIsoTimestamp(value: unknown): value is string {
  return typeof value === 'string'
    && isoTimestampPattern.test(value)
    && Number.isFinite(Date.parse(value));
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
