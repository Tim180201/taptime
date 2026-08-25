import { randomUUID } from 'node:crypto';
import type { SupabaseJwtAccessTokenVerifier } from '@taptime/backend-identity';
import {
  B3_CONTENT_HASH_ALGORITHM,
  B3_CONTENT_HASH_VERSION,
  T012_CONTENT_HASH_VERSION,
  breakWorkEventContentHashV3,
  workEventContentHash,
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
  type BusinessEngineEscalationReason,
  type MembershipId,
  type StartedTimeEntry,
  type StartedBreakInterval,
  type NfcBreakWorkEvent,
  type NfcWorkEvent,
  type WorkEvent,
} from '@taptime/core';
import type { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import type {
  B6WriteStage,
  DurableDeferredLifecycleIngestionResult,
  DeferredLifecycleIngestionResult,
  LifecycleIngestionCommand,
  LifecycleIngestionControls,
  LifecycleIngestionResult,
  NonDurableDeferredLifecycleIngestionResult,
  PersistedLifecycleDecision,
} from './types.js';

export const B6_IDENTITY_RESOLVER_ROLE = 'taptime_identity_resolver';
export const B6_LIFECYCLE_ROLE = 'taptime_server_lifecycle';
export const B6_RUNTIME_LOGIN = 'taptime_b6_lifecycle_test_login';

const B6_ENGINE_VERSION = 'taptime-core-0.1.0-t012';
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface ResolvedActorRow extends QueryResultRow {
  readonly user_id: string;
  readonly organization_id: string;
  readonly membership_id: string;
  readonly membership_role: 'administrator' | 'employee';
}

interface ConfigurationRow extends QueryResultRow {
  readonly assignment_id: string;
  readonly nfc_tag_id: string;
  readonly assignment_type: 'work' | 'break';
  readonly target_type: 'customer' | null;
  readonly target_customer_id: string | null;
  readonly assignment_active: boolean;
  readonly assignment_valid_from: Date;
  readonly assignment_valid_to: Date | null;
  readonly tag_created_at: Date;
  readonly customer_active: boolean | null;
  readonly customer_activated_at: Date | null;
  readonly customer_deactivated_at: Date | null;
}

interface ExistingWorkEventRow extends QueryResultRow {
  readonly content_hash: string;
}

interface ActiveTimeEntryRow extends QueryResultRow {
  readonly id: string;
  readonly organization_id: string;
  readonly user_id: string;
  readonly target_type: 'customer' | 'project' | 'general_work';
  readonly target_customer_id: string;
  readonly start_work_event_id: string;
  readonly started_at: Date;
  readonly started_via: 'nfc' | 'manual';
}

interface ActiveBreakIntervalRow extends QueryResultRow {
  readonly id: string;
  readonly organization_id: string;
  readonly user_id: string;
  readonly time_entry_id: string;
  readonly start_work_event_id: string;
  readonly started_at: Date;
  readonly started_via: 'nfc' | 'manual';
}

interface WorkEventRow extends QueryResultRow {
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
  readonly decision_type: string;
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
  readonly server_decision_work_event_id: string | null;
  readonly client_time_entry_id: string | null;
  readonly server_time_entry_id: string | null;
}

export class InjectedB6Failure extends Error {
  constructor(readonly stage: B6WriteStage) {
    super(`Injected B6 failure after ${stage}`);
    this.name = 'InjectedB6Failure';
  }
}

export class ServerCanonicalLifecycleIngestionCoordinator {
  private readonly businessEngine = new BusinessEngine(
    () => TimeEntryId(randomUUID()),
    () => BreakIntervalId(randomUUID()),
  );

  constructor(
    private readonly pool: Pool,
    private readonly accessTokenVerifier: SupabaseJwtAccessTokenVerifier,
  ) {}

  async ingest(
    command: LifecycleIngestionCommand,
    expectedMembershipId?: MembershipId,
    controls: LifecycleIngestionControls = {},
  ): Promise<LifecycleIngestionResult> {
    return this.ingestWithPolicy(command, 'canonical', expectedMembershipId, controls);
  }

  async ingestDeferred(
    command: LifecycleIngestionCommand,
    expectedMembershipId: MembershipId,
    controls: LifecycleIngestionControls = {},
  ): Promise<DeferredLifecycleIngestionResult> {
    return this.ingestWithPolicy(command, 'defer_only', expectedMembershipId, controls);
  }

  private ingestWithPolicy(
    command: LifecycleIngestionCommand,
    policy: 'canonical',
    expectedMembershipId: MembershipId | undefined,
    controls: LifecycleIngestionControls,
  ): Promise<LifecycleIngestionResult>;

  private ingestWithPolicy(
    command: LifecycleIngestionCommand,
    policy: 'defer_only',
    expectedMembershipId: MembershipId,
    controls: LifecycleIngestionControls,
  ): Promise<DeferredLifecycleIngestionResult>;

  private async ingestWithPolicy(
    command: LifecycleIngestionCommand,
    policy: 'canonical' | 'defer_only',
    expectedMembershipId: MembershipId | undefined,
    controls: LifecycleIngestionControls,
  ): Promise<LifecycleIngestionResult | DeferredLifecycleIngestionResult> {
    validateCommand(command);
    validateExpectedMembershipId(expectedMembershipId, policy);
    if (policy === 'defer_only' && command.receipt.attemptNumber !== 1) {
      throw new TypeError('Deferred lifecycle receipt attemptNumber must be exactly 1');
    }

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
      await query(client, 'BEGIN ISOLATION LEVEL READ COMMITTED');
      transactionOpen = true;
      await query(client, `SET LOCAL ROLE ${B6_IDENTITY_RESOLVER_ROLE}`);
      const authority = await query<ResolvedActorRow>(
        client,
        `SELECT user_id, organization_id, membership_id, membership_role
         FROM taptime_server.lock_request_actor($1, $2)`,
        [verification.identity.issuer, verification.identity.subject],
      );
      if (authority.rows.length > 1) {
        throw new Error('Locked identity resolver returned more than one active Membership');
      }
      const actor = authority.rows[0];
      if (actor === undefined) {
        await rollback(client);
        transactionOpen = false;
        return { status: 'rejected', reason: 'identity_or_membership_unavailable' };
      }
      if (expectedMembershipId !== undefined && actor.membership_id !== expectedMembershipId) {
        await rollback(client);
        transactionOpen = false;
        return { status: 'rejected', reason: 'identity_or_membership_unavailable' };
      }
      if (actor.organization_id !== command.requestedOrganizationId) {
        await rollback(client);
        transactionOpen = false;
        return { status: 'rejected', reason: 'requested_organization_mismatch' };
      }

      await setActorContext(client, actor, command.receipt.id);
      await query(client, `SET LOCAL ROLE ${B6_LIFECYCLE_ROLE}`);
      await query(
        client,
        'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
        [`${actor.organization_id}\u001f${actor.user_id}`],
      );
      await controls.afterAuthorityLocked?.();

      const configuration = await lockConfiguration(client, actor.organization_id, command);
      await controls.afterConfigurationLocked?.();
      if (configuration === null || !configurationMatches(configuration, command)) {
        await rollback(client);
        transactionOpen = false;
        return nonDurableDeferredResult();
      }

      const workEvent = toAuthoritativeWorkEvent(command, actor, configuration);
      const contentHash = isBreakWorkEvent(workEvent)
        ? breakWorkEventContentHashV3({
            id: workEvent.id,
            organizationId: workEvent.organizationId,
            assignmentId: workEvent.assignmentId,
            nfcTagId: workEvent.nfcTagId,
            triggeredBy: workEvent.triggeredBy,
            occurredAt: workEvent.occurredAt,
            triggerType: 'nfc',
          })
        : workEventContentHash({
            id: workEvent.id,
            organizationId: workEvent.organizationId,
            assignmentId: workEvent.assignmentId,
            nfcTagId: workEvent.nfcTagId,
            targetType: workEvent.target.targetType,
            targetId: workEvent.target.targetId,
            triggeredBy: workEvent.triggeredBy,
            occurredAt: workEvent.occurredAt,
          });

      const existing = await findExistingWorkEvent(client, workEvent);
      if (existing !== null) {
        if (existing.content_hash.trim() !== contentHash) {
          await rollback(client);
          transactionOpen = false;
          return { status: 'conflict', reason: 'work_event_content_conflict' };
        }
        const persisted = await findPersistedDecision(client, workEvent);
        if (policy === 'defer_only' && persisted !== null) {
          await rollback(client);
          transactionOpen = false;
          return { status: 'conflict', reason: 'receipt_metadata_conflict' };
        }
        if (persisted === null) {
          const receiptResult = await ensureDeferredReceipt(
            client,
            command,
            workEvent,
            policy === 'canonical' || configurationIsCurrentlyActive(configuration),
          );
          if (receiptResult === 'conflict') {
            await rollback(client);
            transactionOpen = false;
            return { status: 'conflict', reason: 'receipt_metadata_conflict' };
          }
          if (receiptResult === 'unavailable') {
            await rollback(client);
            transactionOpen = false;
            return nonDurableDeferredResult();
          }
          await query(client, 'COMMIT');
          transactionOpen = false;
          return durableDeferredResult(command, true);
        }
        const receiptResult = await ensureRetryReceipt(
          client,
          command,
          workEvent,
          persisted,
        );
        if (receiptResult === 'conflict') {
          await rollback(client);
          transactionOpen = false;
          return { status: 'conflict', reason: 'receipt_metadata_conflict' };
        }
        await query(client, 'COMMIT');
        transactionOpen = false;
        return synchronizedResult(command, persisted, true);
      }

      if (policy === 'defer_only') {
        if (!configurationIsCurrentlyActive(configuration)) {
          await rollback(client);
          transactionOpen = false;
          return nonDurableDeferredResult();
        }
        const inserted = await insertWorkEvent(client, workEvent, contentHash);
        if (!inserted) {
          await rollback(client);
          transactionOpen = false;
          return { status: 'conflict', reason: 'work_event_content_conflict' };
        }
        await afterWrite('work_event', controls);

        if (!await insertDeferredReceipt(client, command, workEvent)) {
          await rollback(client);
          transactionOpen = false;
          return { status: 'conflict', reason: 'receipt_metadata_conflict' };
        }
        await afterWrite('sync_receipt', controls);

        await insertAuditEvent(client, command, workEvent, {
          eventType: 'LifecycleDeferred',
          payload: { reason: 'cached_context_requires_review' },
        });
        await afterWrite('audit_event', controls);

        await query(client, 'COMMIT');
        transactionOpen = false;
        return durableDeferredResult(command, false);
      }

      if (!configurationIsAutomaticallyEvaluable(configuration, command.workEvent.occurredAt)) {
        const inserted = await insertWorkEvent(client, workEvent, contentHash);
        if (!inserted) {
          await rollback(client);
          transactionOpen = false;
          return { status: 'conflict', reason: 'work_event_content_conflict' };
        }
        await afterWrite('work_event', controls);
        if (!await insertDeferredReceipt(client, command, workEvent)) {
          await rollback(client);
          transactionOpen = false;
          return { status: 'conflict', reason: 'receipt_metadata_conflict' };
        }
        await afterWrite('sync_receipt', controls);
        await insertAuditEvent(client, command, workEvent, {
          eventType: 'LifecycleDeferred',
          payload: { reason: configurationIsCurrentlyActive(configuration)
            ? 'configuration_not_valid_at_event_time'
            : 'current_configuration_inactive' },
        });
        await afterWrite('audit_event', controls);
        await query(client, 'COMMIT');
        transactionOpen = false;
        return durableDeferredResult(command, false);
      }

      const activeTimeEntry = await findActiveTimeEntry(client, actor);
      const activeBreakInterval = await findActiveBreakInterval(client, actor, activeTimeEntry);
      const previousWorkEvent = await findPreviousCanonicalWorkEvent(client, workEvent);
      await controls.beforeEngineEvaluation?.();
      const decision = this.businessEngine.evaluate(workEvent, {
        activeTimeEntryForUser: activeTimeEntry,
        activeBreakIntervalForUser: activeBreakInterval,
        previousAcceptedWorkEventForUserAndTarget: previousWorkEvent,
      });

      const inserted = await insertWorkEvent(client, workEvent, contentHash);
      if (!inserted) {
        await rollback(client);
        transactionOpen = false;
        return { status: 'conflict', reason: 'work_event_content_conflict' };
      }
      await afterWrite('work_event', controls);

      if (await persistTimeEntryMutation(client, decision)) {
        await afterWrite('time_entry', controls);
      }

      const persistedDecision = toPersistedDecision(decision);
      await insertDecision(client, workEvent, decision);
      await afterWrite('canonical_decision', controls);

      if (!await insertReceipt(client, command, workEvent, persistedDecision)) {
        await rollback(client);
        transactionOpen = false;
        return { status: 'conflict', reason: 'receipt_metadata_conflict' };
      }
      await afterWrite('sync_receipt', controls);

      await insertAuditEvent(client, command, workEvent, {
        eventType: 'LifecycleEvaluated',
        payload: decisionDiagnosticPayload(decision),
      });
      await afterWrite('audit_event', controls);

      await query(client, 'COMMIT');
      transactionOpen = false;
      return synchronizedResult(command, persistedDecision, false);
    } catch (error) {
      if (transactionOpen) {
        await rollbackPreservingOriginalError(client);
      }
      throw error;
    } finally {
      client.release();
    }
  }
}

function validateExpectedMembershipId(
  expectedMembershipId: MembershipId | undefined,
  policy: 'canonical' | 'defer_only',
): void {
  if (policy === 'defer_only' && expectedMembershipId === undefined) {
    throw new TypeError('Deferred lifecycle ingestion requires an expected Membership ID');
  }
  if (expectedMembershipId !== undefined && !uuidPattern.test(expectedMembershipId)) {
    throw new TypeError('Expected Membership ID must be a UUID');
  }
}

function validateCommand(command: LifecycleIngestionCommand): void {
  const identifiers = [
    command.requestedOrganizationId,
    command.workEvent.id,
    command.workEvent.assignmentId,
    command.workEvent.nfcTagId,
    ...(isBreakEvidence(command.workEvent) ? [] : [command.workEvent.target.targetId]),
    command.receipt.id,
    command.receipt.clientTimeEntryId,
  ].filter((value): value is string => value !== undefined);
  if (identifiers.some((value) => !uuidPattern.test(value))) {
    throw new TypeError('Lifecycle identifiers must be UUIDs');
  }
  if (!Number.isSafeInteger(command.receipt.attemptNumber) || command.receipt.attemptNumber <= 0) {
    throw new TypeError('Lifecycle receipt attemptNumber must be a positive safe integer');
  }
  createTimestamp(command.workEvent.occurredAt);
}

function isBreakEvidence(
  evidence: LifecycleIngestionCommand['workEvent'],
): evidence is Extract<LifecycleIngestionCommand['workEvent'], {
  readonly subject: { readonly type: 'break' };
}> {
  return evidence.subject?.type === 'break';
}

function eventTargetType(workEvent: WorkEvent): 'customer' | 'project' | 'general_work' | null {
  return isBreakWorkEvent(workEvent) ? null : workEvent.target.targetType;
}

function eventTargetId(workEvent: WorkEvent): string | null {
  return isBreakWorkEvent(workEvent) ? null : workEvent.target.targetId;
}

async function setActorContext(
  client: PoolClient,
  actor: ResolvedActorRow,
  correlationId: string,
): Promise<void> {
  await query(
    client,
    `SELECT
       set_config('app.user_id', $1, true),
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

async function lockConfiguration(
  client: PoolClient,
  organizationId: string,
  command: LifecycleIngestionCommand,
): Promise<ConfigurationRow | null> {
  const result = await query<ConfigurationRow>(
    client,
    `SELECT assignment_id, nfc_tag_id, assignment_type, target_type, target_customer_id,
            assignment_active, assignment_valid_from, assignment_valid_to,
            tag_created_at, customer_active, customer_activated_at,
            customer_deactivated_at
     FROM taptime_server.lock_lifecycle_configuration($1::uuid, $2::uuid)`,
    [organizationId, command.workEvent.assignmentId],
  );
  if (result.rows.length > 1) {
    throw new Error('Assignment snapshot query returned more than one row');
  }
  return result.rows[0] ?? null;
}

function configurationMatches(
  row: ConfigurationRow,
  command: LifecycleIngestionCommand,
): boolean {
  return row.assignment_id === command.workEvent.assignmentId
    && row.nfc_tag_id === command.workEvent.nfcTagId
    && row.assignment_type === (isBreakEvidence(command.workEvent) ? 'break' : 'work')
    && (
      isBreakEvidence(command.workEvent)
        ? row.target_type === null && row.target_customer_id === null
        : row.target_type === command.workEvent.target.targetType
          && row.target_customer_id === command.workEvent.target.targetId
    );
}

function configurationIsCurrentlyActive(row: ConfigurationRow): boolean {
  return row.assignment_active
    && row.assignment_valid_to === null
    && (
      row.assignment_type === 'break'
      || (row.customer_active === true && row.customer_deactivated_at === null)
    );
}

function configurationIsAutomaticallyEvaluable(
  row: ConfigurationRow,
  occurredAt: string,
): boolean {
  const eventTime = Date.parse(occurredAt);
  return configurationIsCurrentlyActive(row)
    && eventTime >= row.assignment_valid_from.getTime()
    && eventTime >= row.tag_created_at.getTime()
    && (
      row.assignment_type === 'break'
      || (row.customer_activated_at !== null && eventTime >= row.customer_activated_at.getTime())
    );
}

function toAuthoritativeWorkEvent(
  command: LifecycleIngestionCommand,
  actor: ResolvedActorRow,
  configuration: ConfigurationRow,
): NfcWorkEvent | NfcBreakWorkEvent {
  if (configuration.assignment_type === 'break') {
    const assignmentId = NfcAssignmentId(configuration.assignment_id);
    const nfcTagId = NfcTagId(configuration.nfc_tag_id);
    return {
      id: WorkEventId(command.workEvent.id),
      organizationId: OrganizationId(actor.organization_id),
      subject: { type: 'break' },
      assignmentId,
      nfcTagId,
      triggeredBy: UserId(actor.user_id),
      occurredAt: createTimestamp(command.workEvent.occurredAt),
      trigger: { type: 'nfc', assignmentId, nfcTagId },
    };
  }
  if (configuration.target_customer_id === null) {
    throw new Error('Work Assignment has no target');
  }
  return {
    id: WorkEventId(command.workEvent.id),
    organizationId: OrganizationId(actor.organization_id),
    assignmentId: NfcAssignmentId(configuration.assignment_id),
    nfcTagId: NfcTagId(configuration.nfc_tag_id),
    target: customerAssignmentTarget(CustomerId(configuration.target_customer_id)),
    triggeredBy: UserId(actor.user_id),
    occurredAt: createTimestamp(command.workEvent.occurredAt),
  };
}

async function findExistingWorkEvent(
  client: PoolClient,
  workEvent: WorkEvent,
): Promise<ExistingWorkEventRow | null> {
  const result = await query<ExistingWorkEventRow>(
    client,
    `SELECT content_hash
     FROM taptime_server.work_events
     WHERE organization_id = $1::uuid
       AND triggered_by_user_id = $2::uuid
       AND id = $3::uuid`,
    [workEvent.organizationId, workEvent.triggeredBy, workEvent.id],
  );
  return result.rows[0] ?? null;
}

async function findPersistedDecision(
  client: PoolClient,
  workEvent: WorkEvent,
): Promise<PersistedLifecycleDecision | null> {
  const result = await query<DecisionRow>(
    client,
    `SELECT decision_type, reason, time_entry_id, active_time_entry_id,
            previous_work_event_id, result_time_entry_id, break_interval_id,
            active_break_interval_id
     FROM taptime_server.canonical_decisions
     WHERE organization_id = $1::uuid
       AND actor_user_id = $2::uuid
       AND work_event_id = $3::uuid`,
    [workEvent.organizationId, workEvent.triggeredBy, workEvent.id],
  );
  const row = result.rows[0];
  return row === undefined ? null : persistedDecisionFromRow(row);
}

async function findActiveBreakInterval(
  client: PoolClient,
  actor: ResolvedActorRow,
  activeTimeEntry: StartedTimeEntry | null,
): Promise<StartedBreakInterval | null> {
  if (activeTimeEntry === null) return null;
  const result = await query<ActiveBreakIntervalRow>(
    client,
    `SELECT id, organization_id, user_id, time_entry_id, start_work_event_id,
            started_at, started_via
     FROM taptime_server.break_intervals
     WHERE organization_id = $1::uuid
       AND user_id = $2::uuid
       AND time_entry_id = $3::uuid
       AND status = 'started'
     LIMIT 1
     FOR UPDATE`,
    [actor.organization_id, actor.user_id, activeTimeEntry.id],
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

async function findActiveTimeEntry(
  client: PoolClient,
  actor: ResolvedActorRow,
): Promise<StartedTimeEntry | null> {
  const result = await query<ActiveTimeEntryRow>(
    client,
    `SELECT id, organization_id, user_id, target_type, target_customer_id,
            start_work_event_id, started_at, started_via
     FROM taptime_server.time_entries
     WHERE organization_id = $1::uuid
       AND user_id = $2::uuid
       AND status = 'started'
     LIMIT 1
     FOR UPDATE`,
    [actor.organization_id, actor.user_id],
  );
  const row = result.rows[0];
  if (row === undefined) {
    return null;
  }
  return {
    id: TimeEntryId(row.id),
    workEventId: WorkEventId(row.start_work_event_id),
    organizationId: OrganizationId(row.organization_id),
    userId: UserId(row.user_id),
    target: targetFromStored(row.target_type, row.target_customer_id),
    status: 'started',
    startedAt: createTimestamp(row.started_at.toISOString()),
    startedVia: row.started_via,
  };
}

async function findPreviousCanonicalWorkEvent(
  client: PoolClient,
  workEvent: WorkEvent,
): Promise<WorkEvent | null> {
  const result = await query<WorkEventRow>(
    client,
    `SELECT event.id, event.organization_id, event.assignment_id, event.nfc_tag_id,
            event.subject_type,
            event.target_type, event.target_customer_id, event.triggered_by_user_id,
            event.occurred_at, event.trigger_type
     FROM taptime_server.work_events AS event
     INNER JOIN taptime_server.canonical_decisions AS decision
       ON decision.organization_id = event.organization_id
      AND decision.actor_user_id = event.triggered_by_user_id
      AND decision.work_event_id = event.id
     WHERE event.organization_id = $1::uuid
       AND event.triggered_by_user_id = $2::uuid
       AND event.subject_type = $3
       AND ($3 = 'break' OR (
         event.target_type = $4
         AND event.target_customer_id = $5::uuid
       ))
     ORDER BY event.occurred_at DESC, event.received_at DESC, event.id DESC
     LIMIT 1`,
    [
      workEvent.organizationId,
      workEvent.triggeredBy,
      workEvent.subject?.type ?? 'work',
      eventTargetType(workEvent),
      eventTargetId(workEvent),
    ],
  );
  const row = result.rows[0];
  if (row === undefined) {
    return null;
  }
  const base = {
    id: WorkEventId(row.id),
    organizationId: OrganizationId(row.organization_id),
    triggeredBy: UserId(row.triggered_by_user_id),
    occurredAt: createTimestamp(row.occurred_at.toISOString()),
  };
  if (row.subject_type === 'break') {
    if (row.trigger_type === 'manual') {
      return { ...base, subject: { type: 'break' }, trigger: { type: 'manual' } };
    }
    if (row.assignment_id === null || row.nfc_tag_id === null) {
      throw new Error('Persisted NFC Break WorkEvent has no Assignment provenance');
    }
    const assignmentId = NfcAssignmentId(row.assignment_id);
    const nfcTagId = NfcTagId(row.nfc_tag_id);
    return {
      ...base,
      subject: { type: 'break' },
      assignmentId,
      nfcTagId,
      trigger: { type: 'nfc', assignmentId, nfcTagId },
    };
  }
  if (row.target_type === null || row.target_customer_id === null) {
    throw new Error('Persisted Work WorkEvent has no WorkTarget');
  }
  const workBase = { ...base, target: targetFromStored(row.target_type, row.target_customer_id) };
  if (row.trigger_type === 'manual') {
    return { ...workBase, trigger: { type: 'manual' } };
  }
  if (row.assignment_id === null || row.nfc_tag_id === null) {
    throw new Error('Persisted NFC WorkEvent has no Assignment provenance');
  }
  return {
    ...workBase,
    assignmentId: NfcAssignmentId(row.assignment_id),
    nfcTagId: NfcTagId(row.nfc_tag_id),
    trigger: { type: 'nfc', assignmentId: NfcAssignmentId(row.assignment_id),
      nfcTagId: NfcTagId(row.nfc_tag_id) },
  };
}

function targetFromStored(
  targetType: 'customer' | 'project' | 'general_work',
  targetId: string,
) {
  if (targetType === 'customer') return customerAssignmentTarget(CustomerId(targetId));
  if (targetType === 'project') return projectWorkTarget(ProjectId(targetId));
  return generalWorkTarget(GeneralWorkTargetId(targetId));
}

async function insertWorkEvent(
  client: PoolClient,
  workEvent: WorkEvent,
  contentHash: string,
): Promise<boolean> {
  const result = await query(
    client,
    `INSERT INTO taptime_server.work_events (
       id, organization_id, assignment_id, nfc_tag_id, target_type, target_customer_id,
       triggered_by_user_id, occurred_at, content_hash, content_hash_algorithm,
       content_hash_version, trigger_type, subject_type
     ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5, $6::uuid, $7::uuid,
       $8::timestamptz, $9, $10, $11, 'nfc', $12)
     ON CONFLICT DO NOTHING`,
    [
      workEvent.id,
      workEvent.organizationId,
      workEvent.assignmentId,
      workEvent.nfcTagId,
      eventTargetType(workEvent),
      eventTargetId(workEvent),
      workEvent.triggeredBy,
      workEvent.occurredAt,
      contentHash,
      B3_CONTENT_HASH_ALGORITHM,
      isBreakWorkEvent(workEvent) ? T012_CONTENT_HASH_VERSION : B3_CONTENT_HASH_VERSION,
      workEvent.subject?.type ?? 'work',
    ],
  );
  return result.rowCount === 1;
}

async function persistTimeEntryMutation(
  client: PoolClient,
  decision: BusinessEngineDecision,
): Promise<boolean> {
  if (decision.status === 'time_entry_started') {
    const entry = decision.timeEntry;
    await query(
      client,
      `INSERT INTO taptime_server.time_entries (
         id, organization_id, user_id, target_type, target_customer_id, status,
         start_work_event_id, started_at, started_via
       ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5::uuid, 'started',
         $6::uuid, $7::timestamptz, $8)`,
      [
        entry.id,
        entry.organizationId,
        entry.userId,
        entry.target.targetType,
        entry.target.targetId,
        entry.workEventId,
        entry.startedAt,
        entry.startedVia ?? 'nfc',
      ],
    );
    return true;
  }
  if (decision.status === 'time_entry_stopped') {
    const entry = decision.timeEntry;
    const result = await query(
      client,
      `UPDATE taptime_server.time_entries
       SET status = 'stopped',
           stop_work_event_id = $4::uuid,
           stopped_at = $5::timestamptz,
           stopped_via = $6,
           row_version = row_version + 1
       WHERE organization_id = $1::uuid
         AND user_id = $2::uuid
         AND id = $3::uuid
         AND status = 'started'`,
      [
        entry.organizationId,
        entry.userId,
        entry.id,
        entry.stoppedByWorkEventId,
        entry.stoppedAt,
        entry.stoppedVia ?? 'nfc',
      ],
    );
    if (result.rowCount !== 1) {
      throw new Error('Core Stop result did not map to exactly one active TimeEntry');
    }
    return true;
  }
  if (decision.status === 'break_started') {
    const interval = decision.breakInterval;
    await query(
      client,
      `INSERT INTO taptime_server.break_intervals (
         id, organization_id, user_id, time_entry_id, status,
         start_work_event_id, started_at, started_via
       ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, 'started',
         $5::uuid, $6::timestamptz, $7)`,
      [
        interval.id,
        interval.organizationId,
        interval.userId,
        interval.timeEntryId,
        interval.startedByWorkEventId,
        interval.startedAt,
        interval.startedVia,
      ],
    );
    return true;
  }
  if (decision.status === 'break_stopped') {
    const interval = decision.breakInterval;
    const result = await query(
      client,
      `UPDATE taptime_server.break_intervals
       SET status = 'stopped',
           stop_work_event_id = $4::uuid,
           stopped_at = $5::timestamptz,
           stopped_via = $6,
           row_version = row_version + 1
       WHERE organization_id = $1::uuid
         AND user_id = $2::uuid
         AND id = $3::uuid
         AND status = 'started'`,
      [
        interval.organizationId,
        interval.userId,
        interval.id,
        interval.stoppedByWorkEventId,
        interval.stoppedAt,
        interval.stoppedVia,
      ],
    );
    if (result.rowCount !== 1) {
      throw new Error('Core Break Stop result did not map to exactly one active BreakInterval');
    }
    return true;
  }
  return false;
}

async function insertDecision(
  client: PoolClient,
  workEvent: WorkEvent,
  decision: BusinessEngineDecision,
): Promise<void> {
  const mapping = decisionColumns(decision);
  await query(
    client,
    `INSERT INTO taptime_server.canonical_decisions (
       work_event_id, organization_id, actor_user_id, target_type, target_customer_id,
       decision_type, reason, time_entry_id, active_time_entry_id, previous_work_event_id,
       engine_version, decision_payload, subject_type, break_interval_id,
       active_break_interval_id
     ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5::uuid, $6, $7,
       $8::uuid, $9::uuid, $10::uuid, $11, $12::jsonb, $13, $14::uuid, $15::uuid)`,
    [
      workEvent.id,
      workEvent.organizationId,
      workEvent.triggeredBy,
      eventTargetType(workEvent),
      eventTargetId(workEvent),
      decision.status,
      mapping.reason,
      mapping.timeEntryId,
      mapping.activeTimeEntryId,
      mapping.previousWorkEventId,
      B6_ENGINE_VERSION,
      JSON.stringify(decisionDiagnosticPayload(decision)),
      workEvent.subject?.type ?? 'work',
      mapping.breakIntervalId,
      mapping.activeBreakIntervalId,
    ],
  );
}

function decisionColumns(decision: BusinessEngineDecision): {
  readonly reason: string | null;
  readonly timeEntryId: string | null;
  readonly activeTimeEntryId: string | null;
  readonly previousWorkEventId: string | null;
  readonly breakIntervalId: string | null;
  readonly activeBreakIntervalId: string | null;
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
    case 'escalation_required':
      return {
        reason: decision.reason,
        timeEntryId: null,
        activeTimeEntryId: null,
        previousWorkEventId: null,
        breakIntervalId: null,
        activeBreakIntervalId: null,
      };
    default:
      return decision satisfies never;
  }
}

function decisionDiagnosticPayload(decision: BusinessEngineDecision): Readonly<Record<string, string>> {
  return decision.status === 'escalation_required'
    ? Object.freeze({ status: decision.status, reason: decision.reason })
    : Object.freeze({ status: decision.status });
}

async function insertReceipt(
  client: PoolClient,
  command: LifecycleIngestionCommand,
  workEvent: WorkEvent,
  decision: PersistedLifecycleDecision,
): Promise<boolean> {
  const serverTimeEntryId = resultTimeEntryId(decision);
  const result = await query(
    client,
    `INSERT INTO taptime_server.sync_receipts (
       id, organization_id, user_id, target_type, target_customer_id, work_event_id,
       attempt_number, status, server_decision_work_event_id, client_time_entry_id,
       server_time_entry_id, subject_type
     ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5::uuid, $6::uuid, $7,
       'synchronized', $6::uuid, $8::uuid, $9::uuid, $10)
     ON CONFLICT DO NOTHING`,
    [
      command.receipt.id,
      workEvent.organizationId,
      workEvent.triggeredBy,
      eventTargetType(workEvent),
      eventTargetId(workEvent),
      workEvent.id,
      command.receipt.attemptNumber,
      command.receipt.clientTimeEntryId ?? null,
      serverTimeEntryId,
      workEvent.subject?.type ?? 'work',
    ],
  );
  return result.rowCount === 1;
}

async function insertDeferredReceipt(
  client: PoolClient,
  command: LifecycleIngestionCommand,
  workEvent: WorkEvent,
): Promise<boolean> {
  const result = await query(
    client,
    `INSERT INTO taptime_server.sync_receipts (
       id, organization_id, user_id, target_type, target_customer_id, work_event_id,
       attempt_number, status, client_time_entry_id, subject_type
     ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5::uuid, $6::uuid, $7,
       'received', $8::uuid, $9)
     ON CONFLICT DO NOTHING`,
    [
      command.receipt.id,
      workEvent.organizationId,
      workEvent.triggeredBy,
      eventTargetType(workEvent),
      eventTargetId(workEvent),
      workEvent.id,
      command.receipt.attemptNumber,
      command.receipt.clientTimeEntryId ?? null,
      workEvent.subject?.type ?? 'work',
    ],
  );
  return result.rowCount === 1;
}

async function ensureDeferredReceipt(
  client: PoolClient,
  command: LifecycleIngestionCommand,
  workEvent: WorkEvent,
  allowInsert: boolean,
): Promise<'accepted' | 'conflict' | 'unavailable'> {
  const existing = await query<ReceiptRow>(
    client,
    `SELECT id, work_event_id, attempt_number, status, server_decision_work_event_id,
            client_time_entry_id, server_time_entry_id
     FROM taptime_server.sync_receipts
     WHERE organization_id = $1::uuid
       AND user_id = $2::uuid
       AND (
         id = $3::uuid
         OR (work_event_id = $4::uuid AND attempt_number = $5)
       )`,
    [
      workEvent.organizationId,
      workEvent.triggeredBy,
      command.receipt.id,
      workEvent.id,
      command.receipt.attemptNumber,
    ],
  );
  if (existing.rows.length > 0) {
    if (existing.rows.length !== 1) {
      return 'conflict';
    }
    const row = existing.rows[0]!;
    return row.id === command.receipt.id
      && row.work_event_id === workEvent.id
      && row.attempt_number === command.receipt.attemptNumber
      && row.status === 'received'
      && row.server_decision_work_event_id === null
      && row.client_time_entry_id === (command.receipt.clientTimeEntryId ?? null)
      && row.server_time_entry_id === null
      ? 'accepted'
      : 'conflict';
  }
  if (!allowInsert) {
    return 'unavailable';
  }
  return await insertDeferredReceipt(client, command, workEvent) ? 'accepted' : 'conflict';
}

async function ensureRetryReceipt(
  client: PoolClient,
  command: LifecycleIngestionCommand,
  workEvent: WorkEvent,
  decision: PersistedLifecycleDecision,
): Promise<'accepted' | 'conflict'> {
  const existing = await query<ReceiptRow>(
    client,
    `SELECT id, work_event_id, attempt_number, status, server_decision_work_event_id,
            client_time_entry_id, server_time_entry_id
     FROM taptime_server.sync_receipts
     WHERE organization_id = $1::uuid
       AND user_id = $2::uuid
       AND (
         id = $3::uuid
         OR (work_event_id = $4::uuid AND attempt_number = $5)
       )`,
    [
      workEvent.organizationId,
      workEvent.triggeredBy,
      command.receipt.id,
      workEvent.id,
      command.receipt.attemptNumber,
    ],
  );
  const expectedServerTimeEntryId = resultTimeEntryId(decision);
  if (existing.rows.length > 0) {
    if (existing.rows.length !== 1) {
      return 'conflict';
    }
    const row = existing.rows[0]!;
    const expectedClientTimeEntryId = command.receipt.clientTimeEntryId ?? null;
    return row.id === command.receipt.id
      && row.work_event_id === workEvent.id
      && row.attempt_number === command.receipt.attemptNumber
      && row.status === 'synchronized'
      && row.server_decision_work_event_id === workEvent.id
      && row.client_time_entry_id === expectedClientTimeEntryId
      && row.server_time_entry_id === expectedServerTimeEntryId
      ? 'accepted'
      : 'conflict';
  }
  return await insertReceipt(client, command, workEvent, decision) ? 'accepted' : 'conflict';
}

async function insertAuditEvent(
  client: PoolClient,
  command: LifecycleIngestionCommand,
  workEvent: WorkEvent,
  audit: {
    readonly eventType: 'LifecycleDeferred' | 'LifecycleEvaluated';
    readonly payload: Readonly<Record<string, string>>;
  },
): Promise<void> {
  await query(
    client,
    `INSERT INTO taptime_server.audit_events (
       id, organization_id, actor_user_id, work_event_user_id, work_event_id,
       event_type, entity_type, entity_id, occurred_at, correlation_id, payload
     ) VALUES ($1::uuid, $2::uuid, $3::uuid, $3::uuid, $4::uuid, $5,
       'WorkEvent', $4::uuid, transaction_timestamp(), $6, $7::jsonb)`,
    [
      randomUUID(),
      workEvent.organizationId,
      workEvent.triggeredBy,
      workEvent.id,
      audit.eventType,
      command.receipt.id,
      JSON.stringify(audit.payload),
    ],
  );
}

function toPersistedDecision(decision: BusinessEngineDecision): PersistedLifecycleDecision {
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
    case 'break_without_active_time_entry_rejected':
      return { status: decision.status };
    case 'work_trigger_during_break_rejected':
      return {
        status: decision.status,
        activeTimeEntryId: decision.activeTimeEntry.id,
        activeBreakIntervalId: decision.activeBreakInterval.id,
      };
    case 'escalation_required':
      return { status: decision.status, reason: decision.reason };
    default:
      return decision satisfies never;
  }
}

function persistedDecisionFromRow(row: DecisionRow): PersistedLifecycleDecision {
  switch (row.decision_type) {
    case 'time_entry_started':
    case 'time_entry_stopped':
      if (row.time_entry_id === null) {
        throw new Error('Persisted lifecycle Decision is missing its TimeEntry');
      }
      return { status: row.decision_type, timeEntryId: TimeEntryId(row.time_entry_id) };
    case 'break_started':
    case 'break_stopped':
      if (row.time_entry_id === null || row.break_interval_id === null) {
        throw new Error('Persisted Break Decision is missing its interval or TimeEntry');
      }
      return {
        status: row.decision_type,
        timeEntryId: TimeEntryId(row.time_entry_id),
        breakIntervalId: row.break_interval_id,
      };
    case 'duplicate_scan_ignored':
      if (row.previous_work_event_id === null) {
        throw new Error('Persisted duplicate Decision is missing its previous WorkEvent');
      }
      return {
        status: row.decision_type,
        previousWorkEventId: WorkEventId(row.previous_work_event_id),
      };
    case 'active_entry_for_other_target_rejected':
      if (row.active_time_entry_id === null) {
        throw new Error('Persisted rejection Decision is missing its active TimeEntry');
      }
      return {
        status: row.decision_type,
        activeTimeEntryId: TimeEntryId(row.active_time_entry_id),
      };
    case 'break_without_active_time_entry_rejected':
      return { status: row.decision_type };
    case 'work_trigger_during_break_rejected':
      if (row.active_time_entry_id === null || row.active_break_interval_id === null) {
        throw new Error('Persisted work-during-break rejection is missing active state');
      }
      return {
        status: row.decision_type,
        activeTimeEntryId: TimeEntryId(row.active_time_entry_id),
        activeBreakIntervalId: row.active_break_interval_id,
      };
    case 'escalation_required':
      if (!isEscalationReason(row.reason)) {
        throw new Error('Persisted escalation Decision has an unsupported reason');
      }
      return { status: row.decision_type, reason: row.reason };
    default:
      throw new Error('Persisted canonical Decision has an unsupported type');
  }
}

function isEscalationReason(value: string | null): value is BusinessEngineEscalationReason {
  return value !== null && [
    'active_time_entry_organization_mismatch',
    'active_time_entry_user_mismatch',
    'previous_work_event_organization_mismatch',
    'previous_work_event_user_mismatch',
    'previous_work_event_target_mismatch',
    'previous_work_event_subject_mismatch',
    'active_break_organization_mismatch',
    'active_break_user_mismatch',
    'active_break_time_entry_mismatch',
    'work_event_precedes_active_break',
    'work_event_precedes_active_time_entry',
    'work_event_precedes_previous_accepted_work_event',
  ].includes(value);
}

function resultTimeEntryId(decision: PersistedLifecycleDecision): TimeEntryId | null {
  switch (decision.status) {
    case 'time_entry_started':
    case 'time_entry_stopped':
    case 'break_started':
    case 'break_stopped':
      return decision.timeEntryId;
    case 'active_entry_for_other_target_rejected':
    case 'work_trigger_during_break_rejected':
      return decision.activeTimeEntryId;
    case 'break_without_active_time_entry_rejected':
    case 'duplicate_scan_ignored':
    case 'escalation_required':
      return null;
    default:
      return decision satisfies never;
  }
}

function synchronizedResult(
  command: LifecycleIngestionCommand,
  decision: PersistedLifecycleDecision,
  idempotentRetry: boolean,
): LifecycleIngestionResult {
  return {
    status: 'synchronized',
    idempotentRetry,
    decision,
    workEventId: command.workEvent.id,
    receiptId: command.receipt.id,
    serverTimeEntryId: resultTimeEntryId(decision),
  };
}

function durableDeferredResult(
  command: LifecycleIngestionCommand,
  idempotentRetry: boolean,
): DurableDeferredLifecycleIngestionResult {
  return {
    status: 'deferred',
    evidenceStored: true,
    idempotentRetry,
    workEventId: command.workEvent.id,
    receiptId: command.receipt.id,
  };
}

function nonDurableDeferredResult(): NonDurableDeferredLifecycleIngestionResult {
  return {
    status: 'deferred',
    evidenceStored: false,
    reason: 'configuration_unavailable_or_inactive',
  };
}

async function afterWrite(
  stage: B6WriteStage,
  controls: LifecycleIngestionControls,
): Promise<void> {
  await controls.afterWrite?.(stage);
  if (controls.failAfter === stage) {
    throw new InjectedB6Failure(stage);
  }
}

function query<Row extends QueryResultRow = QueryResultRow>(
  client: PoolClient,
  text: string,
  values: readonly unknown[] = [],
): Promise<QueryResult<Row>> {
  return client.query<Row>(text, [...values]);
}

async function rollback(client: PoolClient): Promise<void> {
  await query(client, 'ROLLBACK');
}

async function rollbackPreservingOriginalError(client: PoolClient): Promise<void> {
  try {
    await rollback(client);
  } catch {
    // Preserve the original verifier, mapping, PostgreSQL or injected failure.
  }
}
