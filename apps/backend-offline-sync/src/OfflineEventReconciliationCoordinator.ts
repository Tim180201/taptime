import type { AccessTokenVerifier } from '@taptime/backend-identity';
import {
  OFFLINE_RECONCILIATION_MAXIMUM_EVENT_IDS,
  isCanonicalOfflineUuid,
  type OfflineCanonicalDecision,
  type OfflineReconciliationResult,
} from '@taptime/offline-sync-contract';
import type { Pool, QueryResultRow } from 'pg';
import { query, rollback, setOfflineActorContext } from './database.js';
import type {
  AuthenticatedOfflineReconciliationCommand,
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
      throw error;
    } finally {
      client.release();
    }
  }
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
