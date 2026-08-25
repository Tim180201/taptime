import { randomUUID } from 'node:crypto';
import type { AccessTokenVerifier } from '@taptime/backend-identity';
import {
  B3_CONTENT_HASH_ALGORITHM,
  DA5_CONTENT_HASH_VERSION,
  T012_CONTENT_HASH_VERSION,
  breakWorkEventContentHashV3,
  workEventContentHashV2,
} from '@taptime/backend-schema';
import {
  BusinessEngine,
  BreakIntervalId,
  CustomerId,
  GeneralWorkTargetId,
  NfcAssignmentId,
  NfcTagId,
  OrganizationId,
  ProjectId,
  TimeEntryId,
  UserId,
  WorkEventId,
  createTimestamp,
  customerAssignmentTarget,
  generalWorkTarget,
  isBreakWorkEvent,
  projectWorkTarget,
  type BusinessEngineDecision,
  type ManualBreakWorkEvent,
  type ManualWorkEvent,
  type StartedBreakInterval,
  type StartedTimeEntry,
  type WorkEvent,
  type WorkTarget,
} from '@taptime/core';
import type { Pool, PoolClient, QueryResultRow } from 'pg';
import type {
  LifecycleIngestionResult,
  ManualBreakLifecycleIngestionCommand,
  ManualLifecycleIngestionCommand,
  PersistedLifecycleDecision,
} from './types.js';

export const DA5_MANUAL_LIFECYCLE_ROLE = 'taptime_server_lifecycle';
const IDENTITY_RESOLVER_ROLE = 'taptime_identity_resolver';
const ENGINE_VERSION = 'taptime-core-0.1.0-t012';
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

interface ActorRow extends QueryResultRow {
  readonly user_id: string;
  readonly organization_id: string;
  readonly membership_id: string;
  readonly membership_role: 'employee' | 'administrator';
}

interface TargetRow extends QueryResultRow {
  readonly target_type: 'customer' | 'project' | 'general_work';
  readonly target_id: string;
  readonly active: boolean;
}

interface ExistingEventRow extends QueryResultRow {
  readonly content_hash: string;
  readonly subject_type: 'work' | 'break';
  readonly target_type: 'customer' | 'project' | 'general_work' | null;
  readonly target_customer_id: string | null;
  readonly triggered_by_user_id: string;
  readonly occurred_at: Date;
  readonly trigger_type: string;
}

interface ActiveBreakRow extends QueryResultRow {
  readonly id: string;
  readonly organization_id: string;
  readonly user_id: string;
  readonly time_entry_id: string;
  readonly start_work_event_id: string;
  readonly started_at: Date;
  readonly started_via: 'nfc' | 'manual';
}

interface ActiveEntryRow extends QueryResultRow {
  readonly id: string;
  readonly organization_id: string;
  readonly user_id: string;
  readonly target_type: 'customer' | 'project' | 'general_work';
  readonly target_customer_id: string;
  readonly start_work_event_id: string;
  readonly started_at: Date;
  readonly started_via: 'nfc' | 'manual';
}

interface PreviousEventRow extends QueryResultRow {
  readonly id: string;
  readonly organization_id: string;
  readonly assignment_id: string | null;
  readonly nfc_tag_id: string | null;
  readonly subject_type: 'work' | 'break';
  readonly target_type: 'customer' | 'project' | 'general_work' | null;
  readonly target_customer_id: string | null;
  readonly triggered_by_user_id: string;
  readonly occurred_at: Date;
  readonly trigger_type: 'nfc' | 'manual';
}

interface DecisionRow extends QueryResultRow {
  readonly decision_type: PersistedLifecycleDecision['status'];
  readonly reason: string | null;
  readonly time_entry_id: string | null;
  readonly active_time_entry_id: string | null;
  readonly previous_work_event_id: string | null;
  readonly result_time_entry_id: string | null;
  readonly break_interval_id: string | null;
  readonly active_break_interval_id: string | null;
}

interface ReceiptRow extends QueryResultRow {
  readonly id: string;
  readonly work_event_id: string;
  readonly attempt_number: number;
  readonly status: string;
  readonly server_time_entry_id: string | null;
}

type ManualCommand = ManualLifecycleIngestionCommand | ManualBreakLifecycleIngestionCommand;
type ManualEvent = ManualWorkEvent | ManualBreakWorkEvent;

function isBreakCommand(
  command: ManualCommand,
): command is ManualBreakLifecycleIngestionCommand {
  return 'subject' in command.workEvent && command.workEvent.subject.type === 'break';
}

function eventTargetType(event: ManualEvent): WorkTarget['targetType'] | null {
  return isBreakWorkEvent(event) ? null : event.target.targetType;
}

function eventTargetId(event: ManualEvent): string | null {
  return isBreakWorkEvent(event) ? null : event.target.targetId;
}

export class ManualLifecycleIngestionCoordinator {
  private readonly engine = new BusinessEngine(
    () => TimeEntryId(randomUUID()),
    () => BreakIntervalId(randomUUID()),
  );

  constructor(
    private readonly pool: Pool,
    private readonly accessTokenVerifier: AccessTokenVerifier,
  ) {}

  async ingestManual(command: ManualLifecycleIngestionCommand): Promise<LifecycleIngestionResult> {
    return this.ingest(command);
  }

  async ingestManualBreak(
    command: ManualBreakLifecycleIngestionCommand,
  ): Promise<LifecycleIngestionResult> {
    return this.ingest(command);
  }

  private async ingest(command: ManualCommand): Promise<LifecycleIngestionResult> {
    validateCommand(command);
    const verification = await this.accessTokenVerifier.verify(command.accessToken);
    if (verification.status === 'rejected') {
      return {
        status: 'rejected',
        reason: 'access_token_rejected',
        tokenReason: verification.reason,
      };
    }

    const client = await this.pool.connect();
    let transactionOpen = false;
    try {
      await client.query('BEGIN ISOLATION LEVEL READ COMMITTED');
      transactionOpen = true;
      await client.query(`SET LOCAL ROLE ${IDENTITY_RESOLVER_ROLE}`);
      const authority = await client.query<ActorRow>(
        `SELECT user_id, organization_id, membership_id, membership_role
         FROM taptime_server.lock_request_actor($1, $2)`,
        [verification.identity.issuer, verification.identity.subject],
      );
      const actor = authority.rows[0];
      if (authority.rows.length !== 1 || actor === undefined
        || actor.membership_id !== command.expectedMembershipId) {
        await client.query('ROLLBACK');
        transactionOpen = false;
        return { status: 'rejected', reason: 'identity_or_membership_unavailable' };
      }

      await setActorContext(client, actor, command.receipt.id);
      await client.query(`SET LOCAL ROLE ${DA5_MANUAL_LIFECYCLE_ROLE}`);

      const existing = await findExistingEvent(client, actor, command);
      if (existing !== null) {
        const replay = await exactReplay(client, actor, command, existing);
        await client.query(replay.status === 'conflict' ? 'ROLLBACK' : 'COMMIT');
        transactionOpen = false;
        return replay;
      }
      const receiptCollision = await client.query<{ work_event_id: string }>(
        `SELECT work_event_id
         FROM taptime_server.sync_receipts
         WHERE organization_id = $1::uuid AND user_id = $2::uuid
           AND id = $3::uuid`,
        [actor.organization_id, actor.user_id, command.receipt.id],
      );
      if (receiptCollision.rowCount !== 0) {
        await client.query('ROLLBACK');
        transactionOpen = false;
        return { status: 'conflict', reason: 'receipt_metadata_conflict' };
      }

      const target = isBreakCommand(command)
        ? null
        : await lockActiveTarget(client, actor.organization_id, command.workEvent.target);
      if (!isBreakCommand(command) && target === null) {
        await client.query('ROLLBACK');
        transactionOpen = false;
        return { status: 'deferred', evidenceStored: false, reason: 'configuration_unavailable_or_inactive' };
      }
      await client.query(
        'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
        [`${actor.organization_id}\u001f${actor.user_id}`],
      );
      const occurredAtResult = await client.query<{ occurred_at: Date }>(
        'SELECT transaction_timestamp() AS occurred_at',
      );
      const occurredAt = occurredAtResult.rows[0]!.occurred_at.toISOString();
      const base = {
        id: WorkEventId(command.workEvent.id),
        organizationId: OrganizationId(actor.organization_id),
        triggeredBy: UserId(actor.user_id),
        occurredAt: createTimestamp(occurredAt),
        trigger: { type: 'manual' as const },
      };
      const event: ManualEvent = isBreakCommand(command)
        ? { ...base, subject: { type: 'break' } }
        : {
            ...base,
            subject: { type: 'work' },
            target: targetFromRow(target!),
          };
      const contentHash = isBreakWorkEvent(event)
        ? breakWorkEventContentHashV3({
            id: event.id,
            organizationId: event.organizationId,
            triggeredBy: event.triggeredBy,
            occurredAt: event.occurredAt,
            triggerType: 'manual',
            assignmentId: null,
            nfcTagId: null,
          })
        : workEventContentHashV2({
            id: event.id,
            organizationId: event.organizationId,
            targetType: event.target.targetType,
            targetId: event.target.targetId,
            triggeredBy: event.triggeredBy,
            occurredAt: event.occurredAt,
            triggerType: 'manual',
            assignmentId: null,
            nfcTagId: null,
          });

      const active = await findActiveEntry(client, actor);
      const activeBreak = await findActiveBreak(client, actor, active);
      const previous = await findPreviousEvent(client, event);
      const decision = this.engine.evaluate(event, {
        activeTimeEntryForUser: active,
        activeBreakIntervalForUser: activeBreak,
        previousAcceptedWorkEventForUserAndTarget: previous,
      });

      await insertEvent(client, event, contentHash);
      await persistTimeEntry(client, decision);
      await insertDecision(client, event, decision);
      await insertReceipt(client, actor, command, event, decision);
      await insertAudit(client, actor, command, event, decision);
      await client.query('COMMIT');
      transactionOpen = false;

      const persisted = persistedDecision(decision);
      return {
        status: 'synchronized',
        idempotentRetry: false,
        decision: persisted,
        workEventId: event.id,
        receiptId: command.receipt.id,
        serverTimeEntryId: resultTimeEntryId(persisted),
      };
    } catch (error) {
      if (transactionOpen) {
        try {
          await client.query('ROLLBACK');
        } catch {
          // Preserve the original failure.
        }
      }
      throw error;
    } finally {
      client.release();
    }
  }
}

function validateCommand(command: ManualCommand): void {
  if (
    !uuidPattern.test(command.expectedMembershipId)
    || !uuidPattern.test(command.workEvent.id)
    || (!isBreakCommand(command) && (
      !uuidPattern.test(command.workEvent.target.targetId)
      || !['customer', 'project', 'general_work'].includes(command.workEvent.target.targetType)
    ))
    || !uuidPattern.test(command.receipt.id)
    || command.receipt.attemptNumber !== 1
  ) {
    throw new TypeError('Manual lifecycle command is not canonical');
  }
}

async function setActorContext(
  client: PoolClient,
  actor: ActorRow,
  correlationId: string,
): Promise<void> {
  await client.query(
    `SELECT set_config('app.user_id', $1, true),
            set_config('app.organization_id', $2, true),
            set_config('app.membership_id', $3, true),
            set_config('app.membership_role', $4, true),
            set_config('app.correlation_id', $5, true)`,
    [
      actor.user_id,
      actor.organization_id,
      actor.membership_id,
      actor.membership_role,
      correlationId,
    ],
  );
}

async function lockActiveTarget(
  client: PoolClient,
  organizationId: string,
  target: WorkTarget,
): Promise<TargetRow | null> {
  const result = await client.query<TargetRow>(
    `SELECT target_type, target_id, active
     FROM taptime_server.lock_active_work_target_v1($1::uuid, $2, $3::uuid)`,
    [organizationId, target.targetType, target.targetId],
  );
  const row = result.rows[0];
  return row?.active === true ? row : null;
}

function targetFromRow(row: TargetRow): WorkTarget {
  switch (row.target_type) {
    case 'customer':
      return customerAssignmentTarget(CustomerId(row.target_id));
    case 'project':
      return projectWorkTarget(ProjectId(row.target_id));
    case 'general_work':
      return generalWorkTarget(GeneralWorkTargetId(row.target_id));
  }
}

async function findExistingEvent(
  client: PoolClient,
  actor: ActorRow,
  command: ManualCommand,
): Promise<ExistingEventRow | null> {
  const result = await client.query<ExistingEventRow>(
    `SELECT content_hash, subject_type, target_type, target_customer_id, triggered_by_user_id,
            occurred_at, trigger_type
     FROM taptime_server.work_events
     WHERE organization_id = $1::uuid AND id = $2::uuid`,
    [actor.organization_id, command.workEvent.id],
  );
  return result.rows[0] ?? null;
}

async function exactReplay(
  client: PoolClient,
  actor: ActorRow,
  command: ManualCommand,
  existing: ExistingEventRow,
): Promise<LifecycleIngestionResult> {
  const expectedHash = isBreakCommand(command)
    ? breakWorkEventContentHashV3({
        id: command.workEvent.id,
        organizationId: actor.organization_id,
        triggeredBy: actor.user_id,
        occurredAt: existing.occurred_at.toISOString(),
        triggerType: 'manual',
        assignmentId: null,
        nfcTagId: null,
      })
    : workEventContentHashV2({
        id: command.workEvent.id,
        organizationId: actor.organization_id,
        targetType: command.workEvent.target.targetType,
        targetId: command.workEvent.target.targetId,
        triggeredBy: actor.user_id,
        occurredAt: existing.occurred_at.toISOString(),
        triggerType: 'manual',
        assignmentId: null,
        nfcTagId: null,
      });
  if (
    existing.trigger_type !== 'manual'
    || existing.triggered_by_user_id !== actor.user_id
    || existing.subject_type !== (isBreakCommand(command) ? 'break' : 'work')
    || (!isBreakCommand(command) && (
      existing.target_type !== command.workEvent.target.targetType
      || existing.target_customer_id !== command.workEvent.target.targetId
    ))
    || existing.content_hash.trim() !== expectedHash
  ) {
    return { status: 'conflict', reason: 'work_event_content_conflict' };
  }
  const decisions = await client.query<DecisionRow>(
    `SELECT decision_type, reason, time_entry_id, active_time_entry_id,
            previous_work_event_id, result_time_entry_id, break_interval_id,
            active_break_interval_id
     FROM taptime_server.canonical_decisions
     WHERE organization_id = $1::uuid AND actor_user_id = $2::uuid
       AND work_event_id = $3::uuid`,
    [actor.organization_id, actor.user_id, command.workEvent.id],
  );
  const receipts = await client.query<ReceiptRow>(
    `SELECT id, work_event_id, attempt_number, status, server_time_entry_id
     FROM taptime_server.sync_receipts
     WHERE organization_id = $1::uuid AND user_id = $2::uuid
       AND (id = $3::uuid OR (work_event_id = $4::uuid AND attempt_number = 1))`,
    [actor.organization_id, actor.user_id, command.receipt.id, command.workEvent.id],
  );
  const decision = decisions.rows[0];
  const receipt = receipts.rows[0];
  if (
    decisions.rows.length !== 1
    || receipts.rows.length !== 1
    || decision === undefined
    || receipt === undefined
    || receipt.id !== command.receipt.id
    || receipt.work_event_id !== command.workEvent.id
    || receipt.attempt_number !== 1
    || receipt.status !== 'synchronized'
    || receipt.server_time_entry_id !== decision.result_time_entry_id
  ) {
    return { status: 'conflict', reason: 'receipt_metadata_conflict' };
  }
  const persisted = persistedDecisionFromRow(decision);
  return {
    status: 'synchronized',
    idempotentRetry: true,
    decision: persisted,
    workEventId: WorkEventId(command.workEvent.id),
    receiptId: command.receipt.id,
    serverTimeEntryId: resultTimeEntryId(persisted),
  };
}

async function findActiveEntry(
  client: PoolClient,
  actor: ActorRow,
): Promise<StartedTimeEntry | null> {
  const result = await client.query<ActiveEntryRow>(
    `SELECT id, organization_id, user_id, target_type, target_customer_id,
            start_work_event_id, started_at, started_via
     FROM taptime_server.time_entries
     WHERE organization_id = $1::uuid AND user_id = $2::uuid
       AND status = 'started'
     LIMIT 1 FOR UPDATE`,
    [actor.organization_id, actor.user_id],
  );
  const row = result.rows[0];
  if (row === undefined) return null;
  return {
    id: TimeEntryId(row.id),
    workEventId: WorkEventId(row.start_work_event_id),
    organizationId: OrganizationId(row.organization_id),
    userId: UserId(row.user_id),
    target: targetFromRow({
      target_type: row.target_type,
      target_id: row.target_customer_id,
      active: true,
    }),
    status: 'started',
    startedAt: createTimestamp(row.started_at.toISOString()),
    startedVia: row.started_via,
  };
}

async function findActiveBreak(
  client: PoolClient,
  actor: ActorRow,
  activeEntry: StartedTimeEntry | null,
): Promise<StartedBreakInterval | null> {
  if (activeEntry === null) return null;
  const result = await client.query<ActiveBreakRow>(
    `SELECT id, organization_id, user_id, time_entry_id, start_work_event_id,
            started_at, started_via
     FROM taptime_server.break_intervals
     WHERE organization_id = $1::uuid AND user_id = $2::uuid
       AND time_entry_id = $3::uuid AND status = 'started'
     LIMIT 1 FOR UPDATE`,
    [actor.organization_id, actor.user_id, activeEntry.id],
  );
  const row = result.rows[0];
  return row === undefined ? null : {
    id: BreakIntervalId(row.id),
    organizationId: OrganizationId(row.organization_id),
    userId: UserId(row.user_id),
    timeEntryId: TimeEntryId(row.time_entry_id),
    status: 'started',
    startedAt: createTimestamp(row.started_at.toISOString()),
    startedByWorkEventId: WorkEventId(row.start_work_event_id),
    startedVia: row.started_via,
  };
}

async function findPreviousEvent(
  client: PoolClient,
  event: ManualEvent,
): Promise<WorkEvent | null> {
  const result = await client.query<PreviousEventRow>(
    `SELECT event.id, event.organization_id, event.assignment_id, event.nfc_tag_id,
            event.subject_type,
            event.target_type, event.target_customer_id, event.triggered_by_user_id,
            event.occurred_at, event.trigger_type
     FROM taptime_server.work_events AS event
     JOIN taptime_server.canonical_decisions AS decision
       ON decision.organization_id = event.organization_id
      AND decision.actor_user_id = event.triggered_by_user_id
      AND decision.work_event_id = event.id
     WHERE event.organization_id = $1::uuid
       AND event.triggered_by_user_id = $2::uuid
       AND event.subject_type = $3
       AND ($3 = 'break' OR (
         event.target_type = $4 AND event.target_customer_id = $5::uuid
       ))
     ORDER BY event.occurred_at DESC, event.received_at DESC, event.id DESC
     LIMIT 1`,
    [
      event.organizationId,
      event.triggeredBy,
      isBreakWorkEvent(event) ? 'break' : 'work',
      eventTargetType(event),
      eventTargetId(event),
    ],
  );
  const row = result.rows[0];
  if (row === undefined) return null;
  const common = {
    id: WorkEventId(row.id),
    organizationId: OrganizationId(row.organization_id),
    triggeredBy: UserId(row.triggered_by_user_id),
    occurredAt: createTimestamp(row.occurred_at.toISOString()),
  };
  if (row.subject_type === 'break') {
    if (row.trigger_type === 'manual') {
      return { ...common, subject: { type: 'break' }, trigger: { type: 'manual' } };
    }
    if (row.assignment_id === null || row.nfc_tag_id === null) {
      throw new Error('NFC Break WorkEvent is missing immutable trigger evidence');
    }
    const assignmentId = NfcAssignmentId(row.assignment_id);
    const nfcTagId = NfcTagId(row.nfc_tag_id);
    return {
      ...common,
      subject: { type: 'break' },
      assignmentId,
      nfcTagId,
      trigger: { type: 'nfc', assignmentId, nfcTagId },
    };
  }
  if (row.target_type === null || row.target_customer_id === null) {
    throw new Error('Work WorkEvent is missing its target');
  }
  const workCommon = {
    ...common,
    target: targetFromRow({
      target_type: row.target_type,
      target_id: row.target_customer_id,
      active: true,
    }),
  };
  if (row.trigger_type === 'manual') {
    return { ...workCommon, trigger: { type: 'manual' } };
  }
  if (row.assignment_id === null || row.nfc_tag_id === null) {
    throw new Error('NFC WorkEvent is missing immutable trigger evidence');
  }
  return {
    ...workCommon,
    assignmentId: NfcAssignmentId(row.assignment_id),
    nfcTagId: NfcTagId(row.nfc_tag_id),
  };
}

async function insertEvent(
  client: PoolClient,
  event: ManualEvent,
  contentHash: string,
): Promise<void> {
  const result = await client.query(
    `INSERT INTO taptime_server.work_events (
       id, organization_id, assignment_id, nfc_tag_id, target_type, target_customer_id,
       triggered_by_user_id, occurred_at, content_hash, content_hash_algorithm,
       content_hash_version, trigger_type, subject_type
     ) VALUES ($1::uuid, $2::uuid, NULL, NULL, $3, $4::uuid, $5::uuid,
       $6::timestamptz, $7, $8, $9, 'manual', $10)
     ON CONFLICT DO NOTHING`,
    [
      event.id,
      event.organizationId,
      eventTargetType(event),
      eventTargetId(event),
      event.triggeredBy,
      event.occurredAt,
      contentHash,
      B3_CONTENT_HASH_ALGORITHM,
      isBreakWorkEvent(event) ? T012_CONTENT_HASH_VERSION : DA5_CONTENT_HASH_VERSION,
      isBreakWorkEvent(event) ? 'break' : 'work',
    ],
  );
  if (result.rowCount !== 1) throw new Error('Manual WorkEvent conflict');
}

async function persistTimeEntry(
  client: PoolClient,
  decision: BusinessEngineDecision,
): Promise<void> {
  if (decision.status === 'time_entry_started') {
    const entry = decision.timeEntry;
    await client.query(
      `INSERT INTO taptime_server.time_entries (
         id, organization_id, user_id, target_type, target_customer_id, status,
         start_work_event_id, started_at, started_via
       ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5::uuid, 'started',
         $6::uuid, $7::timestamptz, 'manual')`,
      [
        entry.id,
        entry.organizationId,
        entry.userId,
        entry.target.targetType,
        entry.target.targetId,
        entry.workEventId,
        entry.startedAt,
      ],
    );
  } else if (decision.status === 'time_entry_stopped') {
    const entry = decision.timeEntry;
    const result = await client.query(
      `UPDATE taptime_server.time_entries
       SET status = 'stopped', stop_work_event_id = $4::uuid,
           stopped_at = $5::timestamptz, stopped_via = 'manual',
           row_version = row_version + 1
       WHERE organization_id = $1::uuid AND user_id = $2::uuid
         AND id = $3::uuid AND status = 'started'`,
      [
        entry.organizationId,
        entry.userId,
        entry.id,
        entry.stoppedByWorkEventId,
        entry.stoppedAt,
      ],
    );
    if (result.rowCount !== 1) throw new Error('Manual Stop did not map to active TimeEntry');
  } else if (decision.status === 'break_started') {
    const interval = decision.breakInterval;
    await client.query(
      `INSERT INTO taptime_server.break_intervals (
         id, organization_id, user_id, time_entry_id, status,
         start_work_event_id, started_at, started_via
       ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, 'started',
         $5::uuid, $6::timestamptz, 'manual')`,
      [
        interval.id,
        interval.organizationId,
        interval.userId,
        interval.timeEntryId,
        interval.startedByWorkEventId,
        interval.startedAt,
      ],
    );
  } else if (decision.status === 'break_stopped') {
    const interval = decision.breakInterval;
    const result = await client.query(
      `UPDATE taptime_server.break_intervals
       SET status = 'stopped', stop_work_event_id = $4::uuid,
           stopped_at = $5::timestamptz, stopped_via = 'manual',
           row_version = row_version + 1
       WHERE organization_id = $1::uuid AND user_id = $2::uuid
         AND id = $3::uuid AND status = 'started'`,
      [
        interval.organizationId,
        interval.userId,
        interval.id,
        interval.stoppedByWorkEventId,
        interval.stoppedAt,
      ],
    );
    if (result.rowCount !== 1) throw new Error('Manual Break Stop did not map to active interval');
  }
}

async function insertDecision(
  client: PoolClient,
  event: ManualEvent,
  decision: BusinessEngineDecision,
): Promise<void> {
  const values = decisionValues(decision);
  await client.query(
    `INSERT INTO taptime_server.canonical_decisions (
       work_event_id, organization_id, actor_user_id, target_type, target_customer_id,
       decision_type, reason, time_entry_id, active_time_entry_id, previous_work_event_id,
       engine_version, decision_payload, subject_type, break_interval_id,
       active_break_interval_id
     ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5::uuid, $6, $7,
       $8::uuid, $9::uuid, $10::uuid, $11, $12::jsonb, $13, $14::uuid, $15::uuid)`,
    [
      event.id,
      event.organizationId,
      event.triggeredBy,
      eventTargetType(event),
      eventTargetId(event),
      decision.status,
      values.reason,
      values.timeEntryId,
      values.activeTimeEntryId,
      values.previousWorkEventId,
      ENGINE_VERSION,
      JSON.stringify({ status: decision.status, triggerType: 'manual' }),
      isBreakWorkEvent(event) ? 'break' : 'work',
      values.breakIntervalId,
      values.activeBreakIntervalId,
    ],
  );
}

async function insertReceipt(
  client: PoolClient,
  actor: ActorRow,
  command: ManualCommand,
  event: ManualEvent,
  decision: BusinessEngineDecision,
): Promise<void> {
  const persisted = persistedDecision(decision);
  await client.query(
    `INSERT INTO taptime_server.sync_receipts (
       id, organization_id, user_id, target_type, target_customer_id, work_event_id,
       attempt_number, status, server_decision_work_event_id, server_time_entry_id,
       subject_type
     ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5::uuid, $6::uuid, 1,
       'synchronized', $6::uuid, $7::uuid, $8)`,
    [
      command.receipt.id,
      actor.organization_id,
      actor.user_id,
      eventTargetType(event),
      eventTargetId(event),
      event.id,
      resultTimeEntryId(persisted),
      isBreakWorkEvent(event) ? 'break' : 'work',
    ],
  );
}

async function insertAudit(
  client: PoolClient,
  actor: ActorRow,
  command: ManualCommand,
  event: ManualEvent,
  decision: BusinessEngineDecision,
): Promise<void> {
  await client.query(
    `INSERT INTO taptime_server.audit_events (
       id, organization_id, actor_user_id, work_event_user_id, work_event_id,
       event_type, entity_type, entity_id, occurred_at, correlation_id, payload
     ) VALUES (
       $1::uuid, $2::uuid, $3::uuid, $3::uuid, $4::uuid,
       'LifecycleEvaluated', 'WorkEvent', $4::uuid,
       transaction_timestamp(), $5, $6::jsonb
     )`,
    [
      randomUUID(),
      actor.organization_id,
      actor.user_id,
      event.id,
      command.receipt.id,
      JSON.stringify({
        status: decision.status,
        triggerType: 'manual',
        subjectType: isBreakWorkEvent(event) ? 'break' : 'work',
      }),
    ],
  );
}

function decisionValues(decision: BusinessEngineDecision): {
  reason: string | null;
  timeEntryId: string | null;
  activeTimeEntryId: string | null;
  previousWorkEventId: string | null;
  breakIntervalId: string | null;
  activeBreakIntervalId: string | null;
} {
  switch (decision.status) {
    case 'time_entry_started':
    case 'time_entry_stopped':
      return {
        reason: null,
        timeEntryId: decision.timeEntry.id,
        activeTimeEntryId: null,
        previousWorkEventId: null,
        breakIntervalId: null,
        activeBreakIntervalId: null,
      };
    case 'break_started':
    case 'break_stopped':
      return {
        reason: null,
        timeEntryId: decision.timeEntry.id,
        activeTimeEntryId: null,
        previousWorkEventId: null,
        breakIntervalId: decision.breakInterval.id,
        activeBreakIntervalId: null,
      };
    case 'break_without_active_time_entry_rejected':
      return {
        reason: null,
        timeEntryId: null,
        activeTimeEntryId: null,
        previousWorkEventId: null,
        breakIntervalId: null,
        activeBreakIntervalId: null,
      };
    case 'work_trigger_during_break_rejected':
      return {
        reason: null,
        timeEntryId: null,
        activeTimeEntryId: decision.activeTimeEntry.id,
        previousWorkEventId: null,
        breakIntervalId: null,
        activeBreakIntervalId: decision.activeBreakInterval.id,
      };
    case 'duplicate_scan_ignored':
      return {
        reason: null,
        timeEntryId: null,
        activeTimeEntryId: null,
        previousWorkEventId: decision.previousWorkEvent.id,
        breakIntervalId: null,
        activeBreakIntervalId: null,
      };
    case 'active_entry_for_other_target_rejected':
      return {
        reason: null,
        timeEntryId: null,
        activeTimeEntryId: decision.activeTimeEntry.id,
        previousWorkEventId: null,
        breakIntervalId: null,
        activeBreakIntervalId: null,
      };
    case 'escalation_required':
      return {
        reason: decision.reason,
        timeEntryId: null,
        activeTimeEntryId: null,
        previousWorkEventId: null,
        breakIntervalId: null,
        activeBreakIntervalId: null,
      };
  }
}

function persistedDecision(decision: BusinessEngineDecision): PersistedLifecycleDecision {
  switch (decision.status) {
    case 'time_entry_started':
    case 'time_entry_stopped':
      return { status: decision.status, timeEntryId: decision.timeEntry.id };
    case 'break_started':
    case 'break_stopped':
      return {
        status: decision.status,
        timeEntryId: decision.timeEntry.id,
        breakIntervalId: decision.breakInterval.id,
      };
    case 'break_without_active_time_entry_rejected':
      return { status: decision.status };
    case 'work_trigger_during_break_rejected':
      return {
        status: decision.status,
        activeTimeEntryId: decision.activeTimeEntry.id,
        activeBreakIntervalId: decision.activeBreakInterval.id,
      };
    case 'duplicate_scan_ignored':
      return {
        status: decision.status,
        previousWorkEventId: decision.previousWorkEvent.id,
      };
    case 'active_entry_for_other_target_rejected':
      return {
        status: decision.status,
        activeTimeEntryId: decision.activeTimeEntry.id,
      };
    case 'escalation_required':
      return { status: decision.status, reason: decision.reason };
  }
}

function persistedDecisionFromRow(row: DecisionRow): PersistedLifecycleDecision {
  switch (row.decision_type) {
    case 'time_entry_started':
    case 'time_entry_stopped':
      if (row.time_entry_id === null) throw new Error('Lifecycle Decision lacks TimeEntry');
      return { status: row.decision_type, timeEntryId: TimeEntryId(row.time_entry_id) };
    case 'duplicate_scan_ignored':
      if (row.previous_work_event_id === null) throw new Error('Duplicate Decision lacks predecessor');
      return {
        status: row.decision_type,
        previousWorkEventId: WorkEventId(row.previous_work_event_id),
      };
    case 'break_started':
    case 'break_stopped':
      if (row.time_entry_id === null || row.break_interval_id === null) {
        throw new Error('Break Decision lacks TimeEntry or interval');
      }
      return {
        status: row.decision_type,
        timeEntryId: TimeEntryId(row.time_entry_id),
        breakIntervalId: row.break_interval_id,
      };
    case 'break_without_active_time_entry_rejected':
      return { status: row.decision_type };
    case 'work_trigger_during_break_rejected':
      if (row.active_time_entry_id === null || row.active_break_interval_id === null) {
        throw new Error('Work-during-break rejection lacks active state');
      }
      return {
        status: row.decision_type,
        activeTimeEntryId: TimeEntryId(row.active_time_entry_id),
        activeBreakIntervalId: row.active_break_interval_id,
      };
    case 'active_entry_for_other_target_rejected':
      if (row.active_time_entry_id === null) throw new Error('Rejection lacks active TimeEntry');
      return {
        status: row.decision_type,
        activeTimeEntryId: TimeEntryId(row.active_time_entry_id),
      };
    case 'escalation_required':
      if (row.reason === null) throw new Error('Escalation lacks reason');
      return {
        status: row.decision_type,
        reason: row.reason as Extract<PersistedLifecycleDecision, {
          status: 'escalation_required';
        }>['reason'],
      };
  }
}

function resultTimeEntryId(decision: PersistedLifecycleDecision): TimeEntryId | null {
  return decision.status === 'time_entry_started' || decision.status === 'time_entry_stopped'
    || decision.status === 'break_started' || decision.status === 'break_stopped'
    ? decision.timeEntryId
    : decision.status === 'active_entry_for_other_target_rejected'
      || decision.status === 'work_trigger_during_break_rejected'
      ? decision.activeTimeEntryId
      : null;
}
