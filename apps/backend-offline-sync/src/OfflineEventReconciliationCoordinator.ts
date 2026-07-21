import type { AccessTokenVerifier } from '@taptime/backend-identity';
import {
  OFFLINE_RECONCILIATION_MAXIMUM_EVENT_IDS,
  isCanonicalOfflineUuid,
  type OfflineCanonicalDecision,
  type OfflineReconciliationResult,
} from '@taptime/offline-sync-contract';
import {
  validateMobileReviewStateRequest,
  type MobileReviewState,
  type TimeReviewReadResult,
} from '@taptime/time-review-contract';
import type { Pool, QueryResultRow } from 'pg';
import { query, rollback, setOfflineActorContext } from './database.js';
import type {
  AuthenticatedOfflineReconciliationCommand,
  AuthenticatedMobileReviewStateCommand,
  OfflineEventReconciliationReader,
} from './types.js';

export const OFFLINE_RECONCILIATION_ROLE = 'taptime_offline_reconciliation_reader';

interface ActorRow extends QueryResultRow {
  readonly identity_binding_id: string;
  readonly user_id: string;
  readonly organization_id: string;
  readonly membership_id: string;
  readonly membership_role: 'administrator' | 'employee';
  readonly membership_row_version: string;
}

interface ReconciliationRow extends QueryResultRow {
  readonly work_event_id: string;
  readonly receipt_id: string;
  readonly device_sequence: string;
  readonly result_status: 'synchronized' | 'review_pending';
  readonly review_reason: string | null;
  readonly decision_type: string | null;
  readonly reason: string | null;
  readonly time_entry_id: string | null;
  readonly active_time_entry_id: string | null;
  readonly previous_work_event_id: string | null;
}

interface ReviewStateRow extends QueryResultRow {
  readonly review_status: 'review_pending' | 'clear';
  readonly earliest_unresolved_sequence: string | null;
  readonly confirmed_through_sequence: string;
}

export class OfflineEventReconciliationCoordinator
implements OfflineEventReconciliationReader {
  constructor(
    private readonly pool: Pool,
    private readonly accessTokenVerifier: AccessTokenVerifier,
  ) {}

  async reconcile(
    request: AuthenticatedOfflineReconciliationCommand,
  ): Promise<OfflineReconciliationResult> {
    const ids = request.command.workEventIds;
    if (
      ids.length < 1
      || ids.length > OFFLINE_RECONCILIATION_MAXIMUM_EVENT_IDS
      || new Set(ids).size !== ids.length
      || !ids.every(isCanonicalOfflineUuid)
    ) {
      throw new TypeError('Invalid offline reconciliation command');
    }
    const verification = await this.accessTokenVerifier.verify(request.accessToken);
    if (verification.status === 'rejected') {
      return { status: 'authority_rejected' };
    }
    const client = await this.pool.connect();
    let transactionOpen = false;
    try {
      await query(client, 'BEGIN ISOLATION LEVEL READ COMMITTED');
      transactionOpen = true;
      await query(client, `SET LOCAL ROLE ${OFFLINE_RECONCILIATION_ROLE}`);
      const actorResult = await query<ActorRow>(
        client,
        `SELECT identity_binding_id, user_id, organization_id, membership_id,
                membership_role, membership_row_version
         FROM taptime_server.lock_offline_active_actor_v1($1, $2)`,
        [verification.identity.issuer, verification.identity.subject],
      );
      if (actorResult.rows.length !== 1) {
        await rollback(client);
        transactionOpen = false;
        return { status: 'authority_rejected' };
      }
      await setOfflineActorContext(client, actorResult.rows[0]!);
      const result = await query<ReconciliationRow>(
        client,
        `SELECT work_event_id, receipt_id, device_sequence, result_status, review_reason,
                decision_type, reason, time_entry_id, active_time_entry_id,
                previous_work_event_id
         FROM taptime_server.read_offline_event_reconciliations_v1($1::uuid[])`,
        [ids],
      );
      await query(client, 'COMMIT');
      transactionOpen = false;
      return {
        status: 'ready',
        records: Object.freeze(result.rows.map((row) => Object.freeze({
          workEventId: row.work_event_id,
          receiptId: row.receipt_id,
          deviceSequence: Number(row.device_sequence),
          result: row.result_status === 'review_pending'
            ? {
                status: 'review_pending' as const,
                reason: requireReviewReason(row.review_reason),
              }
            : {
                status: 'synchronized' as const,
                decision: decisionFromRow(row),
              },
        }))),
      };
    } catch (error) {
      if (transactionOpen) await rollback(client);
      return postgresErrorCode(error) === '42501'
        ? { status: 'authority_rejected' }
        : { status: 'unavailable' };
    } finally {
      client.release();
    }
  }

  async readReviewState(
    command: AuthenticatedMobileReviewStateCommand,
  ): Promise<TimeReviewReadResult<MobileReviewState>> {
    const validation = validateMobileReviewStateRequest(command.request);
    if (validation.status === 'invalid_request') return { status: 'unavailable' };
    const verification = await this.accessTokenVerifier.verify(command.accessToken);
    if (verification.status === 'rejected') return { status: 'authority_rejected' };
    const client = await this.pool.connect();
    let transactionOpen = false;
    try {
      await query(client, 'BEGIN ISOLATION LEVEL READ COMMITTED');
      transactionOpen = true;
      await query(client, `SET LOCAL ROLE ${OFFLINE_RECONCILIATION_ROLE}`);
      const actorResult = await query<ActorRow>(
        client,
        `SELECT identity_binding_id, user_id, organization_id, membership_id,
                membership_role, membership_row_version
         FROM taptime_server.lock_offline_active_actor_v1($1, $2)`,
        [verification.identity.issuer, verification.identity.subject],
      );
      const actor = actorResult.rows.length === 1 ? actorResult.rows[0] : undefined;
      if (
        actor === undefined
        || actor.membership_id !== validation.request.expectedMembershipId
      ) {
        await rollback(client);
        transactionOpen = false;
        return { status: 'authority_rejected' };
      }
      await setOfflineActorContext(client, actor);
      const result = await query<ReviewStateRow>(
        client,
        `SELECT review_status, earliest_unresolved_sequence, confirmed_through_sequence
         FROM taptime_server.read_current_offline_review_state_v1($1)`,
        [validation.request.installationId],
      );
      if (result.rows.length !== 1 || result.rows[0] === undefined) {
        await rollback(client);
        transactionOpen = false;
        return { status: 'authority_rejected' };
      }
      const state = mapReviewState(result.rows[0], validation.request);
      await query(client, 'COMMIT');
      transactionOpen = false;
      return { status: 'ready', value: state };
    } catch (error) {
      if (transactionOpen) await rollback(client);
      return postgresErrorCode(error) === '42501'
        ? { status: 'authority_rejected' }
        : { status: 'unavailable' };
    } finally {
      client.release();
    }
  }
}

function mapReviewState(
  row: ReviewStateRow,
  request: AuthenticatedMobileReviewStateCommand['request'],
): MobileReviewState {
  if (row.review_status === 'review_pending') {
    const earliest = safePositiveSequence(row.earliest_unresolved_sequence);
    return Object.freeze({
      status: 'review_pending',
      expectedMembershipId: request.expectedMembershipId,
      installationId: request.installationId,
      earliestUnresolvedSequence: earliest,
    });
  }
  if (row.review_status !== 'clear' || row.earliest_unresolved_sequence !== null) {
    throw new Error('Persisted offline review state is invalid');
  }
  const confirmed = Number(row.confirmed_through_sequence);
  if (!Number.isSafeInteger(confirmed) || confirmed < 0) {
    throw new Error('Persisted offline review high-water mark is invalid');
  }
  return Object.freeze({
    status: 'clear',
    expectedMembershipId: request.expectedMembershipId,
    installationId: request.installationId,
    confirmedThroughSequence: confirmed,
  });
}

function safePositiveSequence(value: string | null): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error('Persisted offline review sequence is invalid');
  }
  return parsed;
}

function postgresErrorCode(error: unknown): string | undefined {
  return error instanceof Error && 'code' in error ? String(error.code) : undefined;
}

function requireReviewReason(
  value: string | null,
): 'identity_or_membership_not_current'
  | 'capture_time_out_of_bounds'
  | 'automatic_window_elapsed'
  | 'historical_configuration_not_valid'
  | 'predecessor_requires_review' {
  switch (value) {
    case 'identity_or_membership_not_current':
    case 'capture_time_out_of_bounds':
    case 'automatic_window_elapsed':
    case 'historical_configuration_not_valid':
    case 'predecessor_requires_review':
      return value;
    default:
      throw new Error('Persisted offline review result is invalid');
  }
}

function decisionFromRow(row: ReconciliationRow): OfflineCanonicalDecision {
  switch (row.decision_type) {
    case 'time_entry_started':
    case 'time_entry_stopped':
      if (row.time_entry_id === null) throw new Error('Persisted TimeEntry decision is incomplete');
      return { status: row.decision_type, timeEntryId: row.time_entry_id };
    case 'duplicate_scan_ignored':
      if (row.previous_work_event_id === null) throw new Error('Persisted duplicate decision is incomplete');
      return {
        status: 'duplicate_scan_ignored',
        previousWorkEventId: row.previous_work_event_id,
      };
    case 'active_entry_for_other_target_rejected':
      if (row.active_time_entry_id === null) throw new Error('Persisted rejection is incomplete');
      return {
        status: 'active_entry_for_other_target_rejected',
        activeTimeEntryId: row.active_time_entry_id,
      };
    case 'escalation_required':
      if (row.reason === null) throw new Error('Persisted escalation decision is incomplete');
      return { status: 'escalation_required', reason: row.reason };
    default:
      throw new Error('Persisted offline canonical decision is invalid');
  }
}
