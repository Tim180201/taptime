import {
  TimeEntryId,
  WorkEventId,
  type BusinessEngineEscalationReason,
} from '@taptime/core';
import type { AuthenticatedJsonPostPort } from './AuthenticatedHttpRequestExecutor';
import type {
  LifecycleEventApiPort,
  LifecycleEventCommand,
  LifecycleEventResult,
  LifecycleEventSubmission,
  ServerLifecycleDecision,
} from './contracts';
import {
  hasExactKeys,
  isIso8601Timestamp,
  isJsonContentType,
  isObject,
  isUuid,
  parseJsonObject,
} from './strictJson';

const escalationReasons = new Set<BusinessEngineEscalationReason>([
  'active_time_entry_organization_mismatch',
  'active_time_entry_user_mismatch',
  'previous_work_event_organization_mismatch',
  'previous_work_event_user_mismatch',
  'previous_work_event_target_mismatch',
  'work_event_precedes_active_time_entry',
  'work_event_precedes_previous_accepted_work_event',
]);

export class TapTimeLifecycleApiClient implements LifecycleEventApiPort {
  private readonly canonicalEndpoint: URL;
  private readonly deferredEndpoint: URL;

  constructor(baseUrl: string, private readonly request: AuthenticatedJsonPostPort) {
    const normalizedBaseUrl = withTrailingSlash(baseUrl);
    this.canonicalEndpoint = new URL('v1/lifecycle-events', normalizedBaseUrl);
    this.deferredEndpoint = new URL('v1/lifecycle-events/deferred', normalizedBaseUrl);
  }

  async ingest(submission: LifecycleEventSubmission): Promise<LifecycleEventResult> {
    if (!isValidSubmission(submission)) {
      return { status: 'unavailable' };
    }
    const command = submission.command;
    const response = await this.request.post(
      submission.mode === 'canonical' ? this.canonicalEndpoint : this.deferredEndpoint,
      serializeCommand(command),
      { expectedMembershipId: submission.expectedMembershipId },
    );
    if (response.status !== 'response') {
      return response;
    }
    if (!isJsonContentType(response.contentType)) {
      return { status: 'unavailable' };
    }
    const body = parseJsonObject(response.body);
    if (body === null) {
      return { status: 'unavailable' };
    }
    if (response.statusCode === 202) {
      return parseDeferredResult(body, command);
    }
    if (response.statusCode === 409) {
      return hasExactKeys(body, ['reason', 'status'])
        && body.status === 'conflict'
        && (body.reason === 'work_event_content_conflict'
          || body.reason === 'receipt_metadata_conflict')
        ? { status: 'conflict', reason: body.reason }
        : { status: 'unavailable' };
    }
    if (response.statusCode !== 200) {
      return { status: 'unavailable' };
    }
    if (submission.mode === 'defer_only') {
      return { status: 'unavailable' };
    }
    return parseSynchronizedResult(body, command);
  }
}

function isValidSubmission(submission: LifecycleEventSubmission): boolean {
  return (submission.mode === 'canonical' || submission.mode === 'defer_only')
    && isUuid(submission.expectedMembershipId)
    && isValidCommand(submission.command);
}

function isValidCommand(command: LifecycleEventCommand): boolean {
  return isUuid(command.organizationId)
    && isUuid(command.workEvent.id)
    && isUuid(command.workEvent.assignmentId)
    && isUuid(command.workEvent.nfcTagId)
    && command.workEvent.target.targetType === 'customer'
    && isUuid(command.workEvent.target.targetId)
    && isIso8601Timestamp(command.workEvent.occurredAt)
    && isUuid(command.receipt.id)
    && Number.isSafeInteger(command.receipt.attemptNumber)
    && command.receipt.attemptNumber > 0
    && (command.receipt.clientTimeEntryId === undefined
      || isUuid(command.receipt.clientTimeEntryId));
}

function serializeCommand(command: LifecycleEventCommand): string {
  return JSON.stringify({
    organizationId: command.organizationId,
    workEvent: {
      id: command.workEvent.id,
      assignmentId: command.workEvent.assignmentId,
      nfcTagId: command.workEvent.nfcTagId,
      target: {
        targetType: command.workEvent.target.targetType,
        targetId: command.workEvent.target.targetId,
      },
      occurredAt: command.workEvent.occurredAt,
    },
    receipt: {
      id: command.receipt.id,
      attemptNumber: command.receipt.attemptNumber,
      ...(command.receipt.clientTimeEntryId === undefined
        ? {}
        : { clientTimeEntryId: command.receipt.clientTimeEntryId }),
    },
  });
}

function parseDeferredResult(
  body: Record<string, unknown>,
  command: LifecycleEventCommand,
): LifecycleEventResult {
  if (
    hasExactKeys(body, [
      'evidenceStored',
      'idempotentRetry',
      'receiptId',
      'status',
      'workEventId',
    ])
    && body.status === 'deferred'
    && body.evidenceStored === true
    && typeof body.idempotentRetry === 'boolean'
    && body.workEventId === command.workEvent.id
    && body.receiptId === command.receipt.id
  ) {
    return {
      status: 'deferred',
      evidenceStored: true,
      idempotentRetry: body.idempotentRetry,
      workEventId: WorkEventId(command.workEvent.id),
      receiptId: command.receipt.id,
    };
  }
  if (
    hasExactKeys(body, ['evidenceStored', 'reason', 'status'])
    && body.status === 'deferred'
    && body.evidenceStored === false
    && body.reason === 'configuration_unavailable_or_inactive'
  ) {
    return {
      status: 'deferred',
      evidenceStored: false,
      reason: body.reason,
    };
  }
  return { status: 'unavailable' };
}

function parseSynchronizedResult(
  body: Record<string, unknown>,
  command: LifecycleEventCommand,
): LifecycleEventResult {
  if (
    !hasExactKeys(body, [
      'decision',
      'idempotentRetry',
      'receiptId',
      'serverTimeEntryId',
      'status',
      'workEventId',
    ])
    || body.status !== 'synchronized'
    || typeof body.idempotentRetry !== 'boolean'
    || body.workEventId !== command.workEvent.id
    || body.receiptId !== command.receipt.id
    || !isObject(body.decision)
  ) {
    return { status: 'unavailable' };
  }
  const decision = parseDecision(body.decision);
  if (decision === null || !hasConsistentTimeEntry(decision, body.serverTimeEntryId)) {
    return { status: 'unavailable' };
  }
  return {
    status: 'synchronized',
    idempotentRetry: body.idempotentRetry,
    decision,
    workEventId: WorkEventId(command.workEvent.id),
    receiptId: command.receipt.id,
    serverTimeEntryId: body.serverTimeEntryId === null
      ? null
      : TimeEntryId(body.serverTimeEntryId as string),
  };
}

function parseDecision(value: Record<string, unknown>): ServerLifecycleDecision | null {
  if (
    (value.status === 'time_entry_started' || value.status === 'time_entry_stopped')
    && hasExactKeys(value, ['status', 'timeEntryId'])
    && isUuid(value.timeEntryId)
  ) {
    return { status: value.status, timeEntryId: TimeEntryId(value.timeEntryId) };
  }
  if (
    value.status === 'duplicate_scan_ignored'
    && hasExactKeys(value, ['previousWorkEventId', 'status'])
    && isUuid(value.previousWorkEventId)
  ) {
    return {
      status: 'duplicate_scan_ignored',
      previousWorkEventId: WorkEventId(value.previousWorkEventId),
    };
  }
  if (
    value.status === 'active_entry_for_other_target_rejected'
    && hasExactKeys(value, ['activeTimeEntryId', 'status'])
    && isUuid(value.activeTimeEntryId)
  ) {
    return {
      status: 'active_entry_for_other_target_rejected',
      activeTimeEntryId: TimeEntryId(value.activeTimeEntryId),
    };
  }
  if (
    value.status === 'escalation_required'
    && hasExactKeys(value, ['reason', 'status'])
    && typeof value.reason === 'string'
    && escalationReasons.has(value.reason as BusinessEngineEscalationReason)
  ) {
    return {
      status: 'escalation_required',
      reason: value.reason as BusinessEngineEscalationReason,
    };
  }
  return null;
}

function hasConsistentTimeEntry(
  decision: ServerLifecycleDecision,
  serverTimeEntryId: unknown,
): boolean {
  switch (decision.status) {
    case 'time_entry_started':
    case 'time_entry_stopped':
      return isUuid(serverTimeEntryId) && serverTimeEntryId === decision.timeEntryId;
    case 'active_entry_for_other_target_rejected':
      return isUuid(serverTimeEntryId) && serverTimeEntryId === decision.activeTimeEntryId;
    case 'duplicate_scan_ignored':
    case 'escalation_required':
      return serverTimeEntryId === null;
    default:
      return decision satisfies never;
  }
}

function withTrailingSlash(value: string): string {
  return value.endsWith('/') ? value : `${value}/`;
}
