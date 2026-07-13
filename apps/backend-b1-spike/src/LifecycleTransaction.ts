import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient, QueryResultRow } from 'pg';
import {
  BusinessEngine,
  CustomerId,
  NfcAssignmentId,
  NfcTagId,
  OrganizationId,
  TimeEntryId,
  UserId,
  WorkEventId,
  createTimestamp,
  customerAssignmentTarget,
  type BusinessEngineDecision,
  type StartedTimeEntry,
  type WorkEvent,
} from '@taptime/core';
import {
  B1_APPLICATION_ROLE,
  B1_SCHEMA,
  executeUnnamedQuery,
  type B1QueryObserver,
} from './database.js';
import {
  B1_CONTENT_HASH_ALGORITHM,
  B1_CONTENT_HASH_VERSION,
  workEventContentHash,
} from './canonicalWorkEvent.js';
import type {
  B1LifecycleControls,
  B1LifecycleRequest,
  B1LifecycleResult,
  B1WriteStage,
} from './types.js';

const B1_ENGINE_VERSION = 'taptime-core-f01-b1';

interface ExistingWorkEventRow extends QueryResultRow {
  readonly content_hash: string;
}

interface ExistingDecisionRow extends QueryResultRow {
  readonly decision_status: BusinessEngineDecision['status'];
  readonly escalation_reason: string | null;
  readonly time_entry_id: string | null;
}

interface ActiveTimeEntryRow extends QueryResultRow {
  readonly id: string;
  readonly organization_id: string;
  readonly user_id: string;
  readonly target_type: 'customer';
  readonly target_id: string;
  readonly started_at: Date;
  readonly start_work_event_id: string;
}

interface WorkEventRow extends QueryResultRow {
  readonly id: string;
  readonly organization_id: string;
  readonly assignment_id: string;
  readonly nfc_tag_id: string;
  readonly target_type: 'customer';
  readonly target_id: string;
  readonly triggered_by: string;
  readonly occurred_at: Date;
}

export class WorkEventContentConflictError extends Error {
  readonly code = 'work_event_content_conflict';

  constructor(readonly workEventId: WorkEventId) {
    super(`WorkEvent ${workEventId} already exists with different canonical content`);
    this.name = 'WorkEventContentConflictError';
  }
}

export class InjectedB1Failure extends Error {
  constructor(readonly stage: B1WriteStage) {
    super(`Injected B1 failure after ${stage}`);
    this.name = 'InjectedB1Failure';
  }
}

export interface B1LifecycleTransactionOptions {
  readonly queryObserver?: B1QueryObserver;
  readonly newTimeEntryId?: () => TimeEntryId;
  readonly newAuditEventId?: () => string;
}

function toStartedTimeEntry(row: ActiveTimeEntryRow): StartedTimeEntry {
  return {
    id: TimeEntryId(row.id),
    organizationId: OrganizationId(row.organization_id),
    userId: UserId(row.user_id),
    target: customerAssignmentTarget(CustomerId(row.target_id)),
    status: 'started',
    startedAt: createTimestamp(row.started_at.toISOString()),
    workEventId: WorkEventId(row.start_work_event_id),
  };
}

function toWorkEvent(row: WorkEventRow): WorkEvent {
  return {
    id: WorkEventId(row.id),
    organizationId: OrganizationId(row.organization_id),
    assignmentId: NfcAssignmentId(row.assignment_id),
    nfcTagId: NfcTagId(row.nfc_tag_id),
    target: customerAssignmentTarget(CustomerId(row.target_id)),
    triggeredBy: UserId(row.triggered_by),
    occurredAt: createTimestamp(row.occurred_at.toISOString()),
  };
}

function escalationReason(decision: BusinessEngineDecision): string | null {
  return decision.status === 'escalation_required' ? decision.reason : null;
}

function referencedTimeEntryId(
  decision: BusinessEngineDecision,
  activeTimeEntry: StartedTimeEntry | null,
): TimeEntryId | null {
  switch (decision.status) {
    case 'time_entry_started':
    case 'time_entry_stopped':
      return decision.timeEntry.id;
    case 'active_entry_for_other_target_rejected':
      return decision.activeTimeEntry.id;
    case 'duplicate_scan_ignored':
    case 'escalation_required':
      return activeTimeEntry?.id ?? null;
    default:
      return decision satisfies never;
  }
}

export class B1LifecycleTransaction {
  private readonly businessEngine: BusinessEngine;
  private readonly newAuditEventId: () => string;

  constructor(
    private readonly pool: Pool,
    private readonly options: B1LifecycleTransactionOptions = {},
  ) {
    this.businessEngine = new BusinessEngine(options.newTimeEntryId ?? (() => TimeEntryId(randomUUID())));
    this.newAuditEventId = options.newAuditEventId ?? randomUUID;
  }

  async process(
    request: B1LifecycleRequest,
    controls: B1LifecycleControls = {},
  ): Promise<B1LifecycleResult> {
    const client = await this.pool.connect();
    try {
      await this.query(client, 'BEGIN');
      await this.query(client, `SET LOCAL ROLE ${B1_APPLICATION_ROLE}`);
      await this.query(
        client,
        "SELECT set_config('app.organization_id', $1, true), set_config('app.user_id', $2, true)",
        [request.context.organizationId, request.context.userId],
      );
      await this.query(
        client,
        'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
        [`${request.context.organizationId}\u001f${request.context.userId}`],
      );
      await controls.afterLockAcquired?.();

      const workEvent: WorkEvent = {
        ...request.workEvent,
        organizationId: request.context.organizationId,
        triggeredBy: request.context.userId,
      };
      const contentHash = workEventContentHash(workEvent);
      const retry = await this.findExistingResult(client, workEvent, contentHash);
      if (retry !== null) {
        await this.query(client, 'COMMIT');
        return retry;
      }

      const activeTimeEntry = await this.findActiveTimeEntry(client, request);
      const previousWorkEvent = await this.findPreviousWorkEvent(client, request);
      const decision = this.businessEngine.evaluate(workEvent, {
        activeTimeEntryForUser: activeTimeEntry,
        previousAcceptedWorkEventForUserAndTarget: previousWorkEvent,
      });

      await this.writeWorkEvent(client, workEvent, contentHash);
      await this.afterWrite('work_event', controls);

      await this.persistTimeEntryMutation(client, decision);
      if (decision.status === 'time_entry_started' || decision.status === 'time_entry_stopped') {
        await this.afterWrite('time_entry', controls);
      }

      const serverTimeEntryId = referencedTimeEntryId(decision, activeTimeEntry);
      await this.writeDecision(client, request, decision, serverTimeEntryId);
      await this.afterWrite('work_event_decision', controls);

      await this.writeSyncReceipt(client, request, decision, serverTimeEntryId);
      await this.afterWrite('sync_receipt', controls);

      await this.writeAuditEvent(client, request, decision, serverTimeEntryId);
      await this.afterWrite('audit_event', controls);

      await this.query(client, 'COMMIT');
      return {
        decisionStatus: decision.status,
        escalationReason: escalationReason(decision),
        serverTimeEntryId,
        idempotentRetry: false,
      };
    } catch (error) {
      await this.query(client, 'ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private async findExistingResult(
    client: PoolClient,
    workEvent: WorkEvent,
    contentHash: string,
  ): Promise<B1LifecycleResult | null> {
    const existing = await this.query<ExistingWorkEventRow>(
      client,
      `SELECT content_hash
       FROM ${B1_SCHEMA}.work_events
       WHERE organization_id = $1 AND id = $2`,
      [workEvent.organizationId, workEvent.id],
    );
    const existingRow = existing.rows[0];
    if (existingRow === undefined) {
      return null;
    }
    if (existingRow.content_hash.trim() !== contentHash) {
      throw new WorkEventContentConflictError(workEvent.id);
    }

    const persisted = await this.query<ExistingDecisionRow>(
      client,
      `SELECT decision_status, escalation_reason, time_entry_id
       FROM ${B1_SCHEMA}.work_event_decisions
       WHERE organization_id = $1 AND work_event_id = $2`,
      [workEvent.organizationId, workEvent.id],
    );
    const row = persisted.rows[0];
    if (row === undefined) {
      throw new Error(`Atomicity violation: WorkEvent ${workEvent.id} has no decision`);
    }

    return {
      decisionStatus: row.decision_status,
      escalationReason: row.escalation_reason,
      serverTimeEntryId: row.time_entry_id === null ? null : TimeEntryId(row.time_entry_id),
      idempotentRetry: true,
    };
  }

  private async findActiveTimeEntry(
    client: PoolClient,
    request: B1LifecycleRequest,
  ): Promise<StartedTimeEntry | null> {
    const result = await this.query<ActiveTimeEntryRow>(
      client,
      `SELECT id, organization_id, user_id, target_type, target_id, started_at, start_work_event_id
       FROM ${B1_SCHEMA}.time_entries
       WHERE organization_id = $1 AND user_id = $2 AND status = 'started'
       LIMIT 1
       FOR UPDATE`,
      [request.context.organizationId, request.context.userId],
    );
    return result.rows[0] === undefined ? null : toStartedTimeEntry(result.rows[0]);
  }

  private async findPreviousWorkEvent(
    client: PoolClient,
    request: B1LifecycleRequest,
  ): Promise<WorkEvent | null> {
    const result = await this.query<WorkEventRow>(
      client,
      `SELECT id, organization_id, assignment_id, nfc_tag_id, target_type, target_id, triggered_by, occurred_at
       FROM ${B1_SCHEMA}.work_events
       WHERE organization_id = $1
         AND triggered_by = $2
         AND target_type = $3
         AND target_id = $4
       ORDER BY occurred_at DESC, received_at DESC
       LIMIT 1`,
      [
        request.context.organizationId,
        request.context.userId,
        request.workEvent.target.targetType,
        request.workEvent.target.targetId,
      ],
    );
    return result.rows[0] === undefined ? null : toWorkEvent(result.rows[0]);
  }

  private async writeWorkEvent(client: PoolClient, workEvent: WorkEvent, contentHash: string): Promise<void> {
    await this.query(
      client,
      `INSERT INTO ${B1_SCHEMA}.work_events (
         organization_id, id, assignment_id, nfc_tag_id, target_type, target_id,
         triggered_by, occurred_at, content_hash, content_hash_algorithm, content_hash_version
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        workEvent.organizationId,
        workEvent.id,
        workEvent.assignmentId,
        workEvent.nfcTagId,
        workEvent.target.targetType,
        workEvent.target.targetId,
        workEvent.triggeredBy,
        workEvent.occurredAt,
        contentHash,
        B1_CONTENT_HASH_ALGORITHM,
        B1_CONTENT_HASH_VERSION,
      ],
    );
  }

  private async persistTimeEntryMutation(client: PoolClient, decision: BusinessEngineDecision): Promise<void> {
    if (decision.status === 'time_entry_started') {
      const entry = decision.timeEntry;
      await this.query(
        client,
        `INSERT INTO ${B1_SCHEMA}.time_entries (
           organization_id, id, user_id, target_type, target_id, status, started_at, start_work_event_id
         ) VALUES ($1, $2, $3, $4, $5, 'started', $6, $7)`,
        [
          entry.organizationId,
          entry.id,
          entry.userId,
          entry.target.targetType,
          entry.target.targetId,
          entry.startedAt,
          entry.workEventId,
        ],
      );
      return;
    }

    if (decision.status === 'time_entry_stopped') {
      const entry = decision.timeEntry;
      const result = await this.query(
        client,
        `UPDATE ${B1_SCHEMA}.time_entries
         SET status = 'stopped', stopped_at = $3, stop_work_event_id = $4
         WHERE organization_id = $1 AND id = $2 AND status = 'started'`,
        [entry.organizationId, entry.id, entry.stoppedAt, entry.stoppedByWorkEventId],
      );
      if (result.rowCount !== 1) {
        throw new Error(`Expected exactly one active TimeEntry update for ${entry.id}`);
      }
    }
  }

  private async writeDecision(
    client: PoolClient,
    request: B1LifecycleRequest,
    decision: BusinessEngineDecision,
    serverTimeEntryId: TimeEntryId | null,
  ): Promise<void> {
    await this.query(
      client,
      `INSERT INTO ${B1_SCHEMA}.work_event_decisions (
         organization_id, work_event_id, actor_user_id, decision_status,
         escalation_reason, time_entry_id, engine_version, decision_payload
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
      [
        request.context.organizationId,
        request.workEvent.id,
        request.context.userId,
        decision.status,
        escalationReason(decision),
        serverTimeEntryId,
        B1_ENGINE_VERSION,
        JSON.stringify(decision),
      ],
    );
  }

  private async writeSyncReceipt(
    client: PoolClient,
    request: B1LifecycleRequest,
    decision: BusinessEngineDecision,
    serverTimeEntryId: TimeEntryId | null,
  ): Promise<void> {
    await this.query(
      client,
      `INSERT INTO ${B1_SCHEMA}.sync_receipts (
         organization_id, work_event_id, actor_user_id, request_id, outcome,
         local_time_entry_id, server_time_entry_id
       ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        request.context.organizationId,
        request.workEvent.id,
        request.context.userId,
        request.requestId,
        decision.status,
        request.localTimeEntryId ?? null,
        serverTimeEntryId,
      ],
    );
  }

  private async writeAuditEvent(
    client: PoolClient,
    request: B1LifecycleRequest,
    decision: BusinessEngineDecision,
    serverTimeEntryId: TimeEntryId | null,
  ): Promise<void> {
    await this.query(
      client,
      `INSERT INTO ${B1_SCHEMA}.audit_events (
         organization_id, id, work_event_id, actor_user_id, event_type, payload
       ) VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
      [
        request.context.organizationId,
        this.newAuditEventId(),
        request.workEvent.id,
        request.context.userId,
        `lifecycle.${decision.status}`,
        JSON.stringify({
          decisionStatus: decision.status,
          escalationReason: escalationReason(decision),
          serverTimeEntryId,
        }),
      ],
    );
  }

  private async afterWrite(stage: B1WriteStage, controls: B1LifecycleControls): Promise<void> {
    await controls.afterWrite?.(stage);
    if (controls.failAfter === stage) {
      throw new InjectedB1Failure(stage);
    }
  }

  private query<Row extends QueryResultRow = QueryResultRow>(
    client: PoolClient,
    text: string,
    values: readonly unknown[] = [],
  ) {
    return executeUnnamedQuery<Row>(client, text, values, this.options.queryObserver);
  }
}
