import type { BusinessEngineEscalationReason } from '@taptime/core';
import {
  OFFLINE_RECONCILIATION_MAXIMUM_EVENT_IDS,
  isCanonicalOfflineUuid,
  isValidRetryAfterSeconds,
  type OfflineCanonicalDecision,
  type OfflineLifecycleEventCommand,
  type OfflineLifecycleEventCommandV2,
  type OfflineLifecycleEventResult,
  type OfflineReconciliationRecord,
  type OfflineReconciliationResult,
} from '@taptime/offline-sync-contract';
import {
  validateMobileReviewStateRequest,
  type MobileReviewState,
  type MobileReviewStateRequest,
} from '@taptime/time-review-contract';
import type {
  AuthenticatedHttpResult,
  AuthenticatedJsonPostPort,
} from '../transport/AuthenticatedHttpRequestExecutor';
import {
  hasExactKeys,
  isJsonContentType,
  isObject,
  parseJsonObject,
} from '../transport/strictJson';

const OFFLINE_EVENT_PATH = '/v1/lifecycle-events/offline';
const OFFLINE_EVENT_V2_PATH = '/v2/lifecycle-events/offline';
const RECONCILIATION_PATH = '/v1/lifecycle-events/reconcile';
const REVIEW_STATE_PATH = '/v1/offline-review-state/query';

const reviewReasons = new Set([
  'identity_or_membership_not_current',
  'capture_time_out_of_bounds',
  'automatic_window_elapsed',
  'historical_configuration_not_valid',
  'predecessor_requires_review',
] as const);
const pendingReasons = new Set([
  'sequence_gap',
  'lock_retry',
  'temporarily_unavailable',
] as const);
const conflictReasons = new Set([
  'event_content_conflict',
  'sequence_content_conflict',
  'lease_binding_conflict',
  'receipt_metadata_conflict',
] as const);
const escalationReasons = new Set<BusinessEngineEscalationReason>([
  'active_time_entry_organization_mismatch',
  'active_time_entry_user_mismatch',
  'previous_work_event_organization_mismatch',
  'previous_work_event_user_mismatch',
  'previous_work_event_target_mismatch',
  'work_event_precedes_active_time_entry',
  'work_event_precedes_previous_accepted_work_event',
]);

export type OfflineLifecycleTransportResult =
  | OfflineLifecycleEventResult
  | { readonly status: 'unavailable'; readonly retryAfterSeconds?: number };

export type OfflineReconciliationTransportResult =
  | OfflineReconciliationResult
  | { readonly status: 'unavailable'; readonly retryAfterSeconds?: number };

export interface OfflineLifecycleApiPort {
  ingest(
    command: OfflineLifecycleEventCommand | OfflineLifecycleEventCommandV2,
  ): Promise<OfflineLifecycleTransportResult>;
  reconcile(workEventIds: readonly string[]): Promise<OfflineReconciliationTransportResult>;
  readReviewState(
    request: MobileReviewStateRequest,
  ): Promise<MobileReviewState | { readonly status: 'unavailable' }>;
}

export class OfflineLifecycleClient implements OfflineLifecycleApiPort {
  private readonly eventEndpoint: URL;
  private readonly eventV2Endpoint: URL;
  private readonly reconciliationEndpoint: URL;
  private readonly reviewStateEndpoint: URL;

  constructor(
    apiBaseUrl: URL,
    private readonly requests: AuthenticatedJsonPostPort,
  ) {
    this.eventEndpoint = new URL(OFFLINE_EVENT_PATH, apiBaseUrl);
    this.eventV2Endpoint = new URL(OFFLINE_EVENT_V2_PATH, apiBaseUrl);
    this.reconciliationEndpoint = new URL(RECONCILIATION_PATH, apiBaseUrl);
    this.reviewStateEndpoint = new URL(REVIEW_STATE_PATH, apiBaseUrl);
  }

  async ingest(
    command: OfflineLifecycleEventCommand | OfflineLifecycleEventCommandV2,
  ): Promise<OfflineLifecycleTransportResult> {
    const response = await this.post(
      command.provenanceVersion === 2 ? this.eventV2Endpoint : this.eventEndpoint,
      JSON.stringify(command),
    );
    if (response.status !== 'response') return transportFailure(response);
    if (!isJsonContentType(response.contentType)) return { status: 'unavailable' };
    const body = parseJsonObject(response.body);
    if (body === null) return { status: 'unavailable' };

    if (response.statusCode === 200) {
      return parseDurableResult(body, command, 'synchronized');
    }
    if (response.statusCode === 202) {
      if (body.status === 'review_pending') {
        return parseDurableResult(body, command, 'review_pending');
      }
      const pending = parsePendingResult(body);
      if (pending === null || !sameRetryAfter(pending.retryAfterSeconds, response.retryAfterSeconds)) {
        return { status: 'unavailable' };
      }
      return pending;
    }
    if (response.statusCode === 409) {
      return parseConflictResult(body) ?? { status: 'unavailable' };
    }
    return { status: 'unavailable' };
  }

  async reconcile(
    workEventIds: readonly string[],
  ): Promise<OfflineReconciliationTransportResult> {
    if (
      workEventIds.length < 1
      || workEventIds.length > OFFLINE_RECONCILIATION_MAXIMUM_EVENT_IDS
      || !workEventIds.every(isCanonicalOfflineUuid)
      || new Set(workEventIds).size !== workEventIds.length
    ) return { status: 'unavailable' };
    const response = await this.post(
      this.reconciliationEndpoint,
      JSON.stringify({ workEventIds }),
    );
    if (response.status !== 'response') return transportFailure(response);
    if (response.statusCode !== 200 || !isJsonContentType(response.contentType)) {
      return { status: 'unavailable' };
    }
    const body = parseJsonObject(response.body);
    if (
      body === null
      || !hasExactKeys(body, ['records', 'status'])
      || body.status !== 'ready'
      || !Array.isArray(body.records)
      || body.records.length > workEventIds.length
    ) return { status: 'unavailable' };
    const allowed = new Set(workEventIds);
    const seen = new Set<string>();
    const records: OfflineReconciliationRecord[] = [];
    for (const candidate of body.records) {
      const record = parseReconciliationRecord(candidate);
      if (
        record === null
        || !allowed.has(record.workEventId)
        || seen.has(record.workEventId)
      ) return { status: 'unavailable' };
      seen.add(record.workEventId);
      records.push(record);
    }
    return { status: 'ready', records: Object.freeze(records) };
  }

  async readReviewState(
    request: MobileReviewStateRequest,
  ): Promise<MobileReviewState | { readonly status: 'unavailable' }> {
    const validation = validateMobileReviewStateRequest(request);
    if (validation.status === 'invalid_request') return { status: 'unavailable' };
    const response = await this.post(
      this.reviewStateEndpoint,
      JSON.stringify(validation.request),
    );
    if (
      response.status !== 'response'
      || response.statusCode !== 200
      || !isJsonContentType(response.contentType)
    ) return { status: 'unavailable' };
    const body = parseJsonObject(response.body);
    if (
      body === null
      || body.expectedMembershipId !== validation.request.expectedMembershipId
      || body.installationId !== validation.request.installationId
    ) return { status: 'unavailable' };
    if (
      body.status === 'review_pending'
      && hasExactKeys(body, [
        'earliestUnresolvedSequence', 'expectedMembershipId', 'installationId', 'status',
      ])
      && Number.isSafeInteger(body.earliestUnresolvedSequence)
      && Number(body.earliestUnresolvedSequence) > 0
    ) {
      return Object.freeze({
        status: 'review_pending',
        expectedMembershipId: validation.request.expectedMembershipId,
        installationId: validation.request.installationId,
        earliestUnresolvedSequence: Number(body.earliestUnresolvedSequence),
      });
    }
    if (
      body.status === 'clear'
      && hasExactKeys(body, [
        'confirmedThroughSequence', 'expectedMembershipId', 'installationId', 'status',
      ])
      && Number.isSafeInteger(body.confirmedThroughSequence)
      && Number(body.confirmedThroughSequence) >= 0
    ) {
      return Object.freeze({
        status: 'clear',
        expectedMembershipId: validation.request.expectedMembershipId,
        installationId: validation.request.installationId,
        confirmedThroughSequence: Number(body.confirmedThroughSequence),
      });
    }
    return { status: 'unavailable' };
  }

  private async post(endpoint: URL, body: string): Promise<AuthenticatedHttpResult> {
    try {
      return await this.requests.post(endpoint, body);
    } catch {
      return { status: 'unavailable' };
    }
  }
}

function parseDurableResult(
  body: Record<string, unknown>,
  command: OfflineLifecycleEventCommand | OfflineLifecycleEventCommandV2,
  expectedStatus: 'synchronized' | 'review_pending',
): OfflineLifecycleTransportResult {
  if (
    body.status !== expectedStatus
    || typeof body.idempotentRetry !== 'boolean'
    || body.workEventId !== command.workEvent.id
    || body.receiptId !== command.receipt.id
    || body.deviceSequence !== command.deviceSequence
  ) return { status: 'unavailable' };
  if (expectedStatus === 'review_pending') {
    if (
      !hasExactKeys(body, [
        'deviceSequence',
        'idempotentRetry',
        'reason',
        'receiptId',
        'status',
        'workEventId',
      ])
      || typeof body.reason !== 'string'
      || !reviewReasons.has(body.reason as never)
    ) return { status: 'unavailable' };
    return {
      status: 'review_pending',
      idempotentRetry: body.idempotentRetry,
      reason: body.reason as Extract<OfflineLifecycleEventResult, {
        status: 'review_pending';
      }>['reason'],
      workEventId: command.workEvent.id,
      receiptId: command.receipt.id,
      deviceSequence: command.deviceSequence,
    };
  }
  if (
    !hasExactKeys(body, [
      'decision',
      'deviceSequence',
      'idempotentRetry',
      'receiptId',
      'status',
      'workEventId',
    ])
  ) return { status: 'unavailable' };
  const decision = parseDecision(body.decision);
  return decision === null
    ? { status: 'unavailable' }
    : {
        status: 'synchronized',
        idempotentRetry: body.idempotentRetry,
        decision,
        workEventId: command.workEvent.id,
        receiptId: command.receipt.id,
        deviceSequence: command.deviceSequence,
      };
}

function parsePendingResult(
  body: Record<string, unknown>,
): Extract<OfflineLifecycleEventResult, { status: 'pending' }> | null {
  const hasRetryAfter = Object.hasOwn(body, 'retryAfterSeconds');
  if (
    !hasExactKeys(body, hasRetryAfter
      ? ['reason', 'retryAfterSeconds', 'status']
      : ['reason', 'status'])
    || body.status !== 'pending'
    || typeof body.reason !== 'string'
    || !pendingReasons.has(body.reason as never)
    || (
      hasRetryAfter
      && !isValidRetryAfterSeconds(body.retryAfterSeconds)
    )
  ) return null;
  return {
    status: 'pending',
    reason: body.reason as Extract<OfflineLifecycleEventResult, {
      status: 'pending';
    }>['reason'],
    ...(hasRetryAfter ? { retryAfterSeconds: body.retryAfterSeconds as number } : {}),
  };
}

function parseConflictResult(
  body: Record<string, unknown>,
): Extract<OfflineLifecycleEventResult, { status: 'conflict' }> | null {
  return hasExactKeys(body, ['reason', 'status'])
    && body.status === 'conflict'
    && typeof body.reason === 'string'
    && conflictReasons.has(body.reason as never)
    ? {
        status: 'conflict',
        reason: body.reason as Extract<OfflineLifecycleEventResult, {
          status: 'conflict';
        }>['reason'],
      }
    : null;
}

function parseReconciliationRecord(value: unknown): OfflineReconciliationRecord | null {
  if (
    !isObject(value)
    || !hasExactKeys(value, [
      'deviceSequence',
      'receiptId',
      'result',
      'workEventId',
    ])
    || !isCanonicalOfflineUuid(value.workEventId)
    || !isCanonicalOfflineUuid(value.receiptId)
    || !Number.isSafeInteger(value.deviceSequence)
    || Number(value.deviceSequence) < 1
    || !isObject(value.result)
  ) return null;
  if (
    value.result.status === 'synchronized'
    && hasExactKeys(value.result, ['decision', 'status'])
  ) {
    const decision = parseDecision(value.result.decision);
    return decision === null ? null : {
      workEventId: value.workEventId,
      receiptId: value.receiptId,
      deviceSequence: value.deviceSequence as number,
      result: { status: 'synchronized', decision },
    };
  }
  if (
    value.result.status === 'review_pending'
    && hasExactKeys(value.result, ['reason', 'status'])
    && typeof value.result.reason === 'string'
    && reviewReasons.has(value.result.reason as never)
  ) {
    return {
      workEventId: value.workEventId,
      receiptId: value.receiptId,
      deviceSequence: value.deviceSequence as number,
      result: {
        status: 'review_pending',
        reason: value.result.reason as Extract<OfflineReconciliationRecord['result'], {
          status: 'review_pending';
        }>['reason'],
      },
    };
  }
  return null;
}

function parseDecision(value: unknown): OfflineCanonicalDecision | null {
  if (!isObject(value) || typeof value.status !== 'string') return null;
  if (
    (value.status === 'time_entry_started' || value.status === 'time_entry_stopped')
    && hasExactKeys(value, ['status', 'timeEntryId'])
    && isCanonicalOfflineUuid(value.timeEntryId)
  ) return { status: value.status, timeEntryId: value.timeEntryId };
  if (
    value.status === 'duplicate_scan_ignored'
    && hasExactKeys(value, ['previousWorkEventId', 'status'])
    && isCanonicalOfflineUuid(value.previousWorkEventId)
  ) return { status: value.status, previousWorkEventId: value.previousWorkEventId };
  if (
    value.status === 'active_entry_for_other_target_rejected'
    && hasExactKeys(value, ['activeTimeEntryId', 'status'])
    && isCanonicalOfflineUuid(value.activeTimeEntryId)
  ) return { status: value.status, activeTimeEntryId: value.activeTimeEntryId };
  if (
    value.status === 'escalation_required'
    && hasExactKeys(value, ['reason', 'status'])
    && typeof value.reason === 'string'
    && escalationReasons.has(value.reason as BusinessEngineEscalationReason)
  ) return { status: value.status, reason: value.reason };
  return null;
}

function transportFailure(
  response: Exclude<AuthenticatedHttpResult, { status: 'response' }>,
): (
  | { readonly status: 'authority_rejected' }
  | { readonly status: 'unavailable'; readonly retryAfterSeconds?: number }
) {
  if (response.status === 'authority_rejected') return response;
  return {
    status: 'unavailable',
    ...(response.status === 'transient_failure' && response.retryAfterSeconds !== undefined
      ? { retryAfterSeconds: response.retryAfterSeconds }
      : {}),
  };
}

function sameRetryAfter(
  body: number | undefined,
  header: number | undefined,
): boolean {
  return body === header;
}
