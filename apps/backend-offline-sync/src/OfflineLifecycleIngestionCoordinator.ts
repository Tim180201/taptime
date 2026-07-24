import { createHash, randomUUID } from 'node:crypto';
import type { AccessTokenVerifier } from '@taptime/backend-identity';
import {
  B3_CONTENT_HASH_ALGORITHM,
  B3_CONTENT_HASH_VERSION,
  DA5_CONTENT_HASH_VERSION,
  workEventContentHash,
  workEventContentHashV2,
} from '@taptime/backend-schema';
import {
  BusinessEngine,
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
  projectWorkTarget,
  type BusinessEngineDecision,
  type StartedTimeEntry,
  type WorkEvent,
  type NfcWorkEvent,
  type ManualWorkEvent,
} from '@taptime/core';
import {
  OFFLINE_AUTOMATIC_EVALUATION_AFTER_EXPIRY_MILLISECONDS,
  OFFLINE_CLOCK_PROOF_VERSION,
  OFFLINE_CLOCK_TOLERANCE_MILLISECONDS,
  OFFLINE_PROVENANCE_VERSION,
  OFFLINE_PROVENANCE_VERSION_V2,
  isCanonicalOfflineUuid,
  isOfflineBase64Url32Bytes,
  isOfflineIsoTimestamp,
  isPositiveSafeInteger,
  type OfflineCanonicalDecision,
  type OfflineLifecycleEventCommand,
  type OfflineLifecycleEventCommandV2,
  type OfflineLifecycleEventResult,
  type OfflineReviewReason,
} from '@taptime/offline-sync-contract';
import type { Pool, PoolClient, QueryResultRow } from 'pg';
import { query, rollback, setOfflineActorContext } from './database.js';
import type {
  AuthenticatedOfflineLifecycleEventCommand,
  OfflineLifecycleIngestionControls,
  OfflineLifecycleIngestor,
} from './types.js';

export const OFFLINE_EVENT_ROLE = 'taptime_offline_event_ingestor';
const OFFLINE_ENGINE_VERSION = 'taptime-core-0.1.0-offline-v1';

interface ActorRow extends QueryResultRow {
  readonly identity_binding_id: string;
  readonly user_id: string;
  readonly organization_id: string;
  readonly membership_id: string;
  readonly membership_role: 'administrator' | 'employee';
  readonly membership_row_version: string;
  readonly identity_current: boolean;
  readonly membership_current: boolean;
}

interface InstallationRow extends QueryResultRow {
  readonly id: string;
  readonly identity_binding_id: string;
}

interface LeaseItemRow extends QueryResultRow {
  readonly lease_id: string;
  readonly installation_id: string;
  readonly identity_binding_id: string;
  readonly membership_id: string;
  readonly membership_row_version: string;
  readonly membership_role: 'administrator' | 'employee';
  readonly issued_at: Date;
  readonly expires_at: Date;
  readonly item_id: string;
  readonly lease_schema_version: number;
  readonly item_type: 'nfc_assignment' | 'manual_target';
  readonly assignment_id: string | null;
  readonly nfc_tag_id: string | null;
  readonly target_type: 'customer' | 'project' | 'general_work';
  readonly target_customer_id: string;
  readonly assignment_row_version: string | null;
  readonly target_row_version: string;
}

interface CursorRow extends QueryResultRow {
  readonly last_durable_sequence: string;
  readonly review_predecessor_sequence: string | null;
}

interface ExistingReconciliationRow extends QueryResultRow {
  readonly work_event_id: string;
  readonly receipt_id: string;
  readonly installation_id: string;
  readonly lease_id: string;
  readonly lease_item_id: string;
  readonly device_sequence: string;
  readonly request_content_hash: string;
  readonly result_status: 'synchronized' | 'review_pending';
  readonly review_reason: OfflineReviewReason | null;
}

interface ExistingLifecycleCollisionRow extends QueryResultRow {
  readonly work_event_exists: boolean;
  readonly receipt_exists: boolean;
}

interface ConfigurationRow extends QueryResultRow {
  readonly target_type: 'customer' | 'project' | 'general_work';
  readonly target_id: string;
  readonly target_active: boolean;
  readonly target_created_at: Date;
  readonly target_deactivated_at: Date | null;
  readonly target_row_version: string;
  readonly assignment_active: boolean | null;
  readonly assignment_valid_from: Date | null;
  readonly assignment_valid_to: Date | null;
  readonly assignment_row_version: string | null;
  readonly tag_created_at: Date | null;
}

interface ActiveTimeEntryRow extends QueryResultRow {
  readonly id: string;
  readonly organization_id: string;
  readonly user_id: string;
  readonly target_type: 'customer' | 'project' | 'general_work';
  readonly target_customer_id: string;
  readonly start_work_event_id: string;
  readonly started_at: Date;
}

interface WorkEventRow extends QueryResultRow {
  readonly id: string;
  readonly organization_id: string;
  readonly assignment_id: string | null;
  readonly nfc_tag_id: string | null;
  readonly target_type: 'customer' | 'project' | 'general_work';
  readonly target_customer_id: string;
  readonly triggered_by_user_id: string;
  readonly occurred_at: Date;
}

interface DecisionRow extends QueryResultRow {
  readonly decision_type: string;
  readonly reason: string | null;
  readonly time_entry_id: string | null;
  readonly active_time_entry_id: string | null;
  readonly previous_work_event_id: string | null;
}

export class OfflineLifecycleIngestionCoordinator implements OfflineLifecycleIngestor {
  private readonly businessEngine: BusinessEngine;

  constructor(
    private readonly pool: Pool,
    private readonly accessTokenVerifier: AccessTokenVerifier,
    createTimeEntryId: () => string = randomUUID,
  ) {
    this.businessEngine = new BusinessEngine(
      () => TimeEntryId(requireGeneratedUuid(createTimeEntryId())),
    );
  }

  async ingest(
    request: AuthenticatedOfflineLifecycleEventCommand,
    controls: OfflineLifecycleIngestionControls = {},
  ): Promise<OfflineLifecycleEventResult> {
    validateCommand(request.command);
    const verification = await this.accessTokenVerifier.verify(request.accessToken);
    if (verification.status === 'rejected') {
      return { status: 'authority_rejected' };
    }
    const client = await this.pool.connect();
    let transactionOpen = false;
    try {
      await query(client, 'BEGIN ISOLATION LEVEL READ COMMITTED');
      transactionOpen = true;
      await query(client, `SET LOCAL ROLE ${OFFLINE_EVENT_ROLE}`);
      const actorResult = await query<ActorRow>(
        client,
        `SELECT identity_binding_id, user_id, organization_id, membership_id,
                membership_role, membership_row_version, identity_current, membership_current
         FROM taptime_server.lock_offline_historical_actor_v1($1, $2, $3::uuid)`,
        [
          verification.identity.issuer,
          verification.identity.subject,
          request.command.expectedMembershipId,
        ],
      );
      if (actorResult.rows.length !== 1) {
        await rollback(client);
        transactionOpen = false;
        return { status: 'authority_rejected' };
      }
      const actor = actorResult.rows[0]!;
      if (actor.organization_id !== request.command.organizationId) {
        await rollback(client);
        transactionOpen = false;
        return { status: 'authority_rejected' };
      }
      await setOfflineActorContext(client, actor);
      await query(
        client,
        `SELECT pg_catalog.pg_advisory_xact_lock(
           pg_catalog.hashtextextended($1::text, 0)
         )`,
        [`${actor.organization_id}\u001f${actor.user_id}`],
      );
      await controls.afterAuthorityLocked?.();

      const requestHash = offlineEventRequestHash(request.command);
      const bindingDigest = createHash('sha256')
        .update(decodeBase64Url32(request.command.installationBinding))
        .digest();
      const installation = await query<InstallationRow>(
        client,
        `SELECT id, identity_binding_id
         FROM taptime_server.offline_installations
         WHERE organization_id = $1::uuid
           AND user_id = $2::uuid
           AND membership_id = $3::uuid
           AND binding_digest = $4::bytea`,
        [actor.organization_id, actor.user_id, actor.membership_id, bindingDigest],
      );
      const installationRow = installation.rows[0];
      if (installationRow === undefined) {
        await rollback(client);
        transactionOpen = false;
        return { status: 'conflict', reason: 'lease_binding_conflict' };
      }

      const prior = await findExistingReconciliation(
        client,
        actor.organization_id,
        installationRow.id,
        request.command.workEvent.id,
        request.command.receipt.id,
        request.command.deviceSequence,
      );
      if (prior !== null) {
        const result = await priorResult(
          client,
          request.command,
          requestHash,
          prior,
        );
        await query(client, 'COMMIT');
        transactionOpen = false;
        return result;
      }

      const leaseItem = await query<LeaseItemRow>(
        client,
        `SELECT lease.id AS lease_id, lease.installation_id, lease.identity_binding_id,
                lease.membership_id, lease.membership_row_version, lease.membership_role,
                lease.lease_schema_version,
                lease.issued_at, lease.expires_at, item.id AS item_id, item.assignment_id,
                item.nfc_tag_id, item.target_type, item.target_customer_id,
                item.item_type, item.assignment_row_version, item.target_row_version
         FROM taptime_server.offline_capture_leases AS lease
         JOIN taptime_server.offline_capture_lease_items AS item
           ON item.organization_id = lease.organization_id
          AND item.lease_id = lease.id
          AND item.installation_id = lease.installation_id
         WHERE lease.organization_id = $1::uuid
           AND lease.id = $2::uuid
           AND lease.installation_id = $3::uuid
           AND item.id = $4::uuid`,
        [
          actor.organization_id,
          request.command.leaseId,
          installationRow.id,
          request.command.leaseItemId,
        ],
      );
      const lease = leaseItem.rows[0];
      if (
        lease === undefined
        || lease.lease_schema_version !== request.command.provenanceVersion
        || lease.target_type !== request.command.workEvent.target.targetType
        || lease.target_customer_id !== request.command.workEvent.target.targetId
        || !leaseTriggerMatches(lease, request.command)
      ) {
        await rollback(client);
        transactionOpen = false;
        return { status: 'conflict', reason: 'lease_binding_conflict' };
      }

      const persistedConflict = await findPersistedLifecycleConflict(
        client,
        actor,
        request.command,
      );
      if (persistedConflict !== null) {
        await rollback(client);
        transactionOpen = false;
        return { status: 'conflict', reason: persistedConflict };
      }
      const predecessorResult = await query<{ has_predecessor: boolean }>(
        client,
        `SELECT taptime_server.has_offline_review_predecessor_v1(
           $1::uuid, $2::uuid
         ) AS has_predecessor`,
        [actor.organization_id, actor.user_id],
      );
      const hasReviewPredecessor = predecessorResult.rows[0]?.has_predecessor;
      if (typeof hasReviewPredecessor !== 'boolean') {
        throw new Error('Offline review predecessor capability returned no result');
      }

      await query(
        client,
        `INSERT INTO taptime_server.offline_sync_cursors (
           organization_id, installation_id, user_id, membership_id
         ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid)
         ON CONFLICT DO NOTHING`,
        [actor.organization_id, installationRow.id, actor.user_id, actor.membership_id],
      );
      const cursorResult = await query<CursorRow>(
        client,
        `SELECT last_durable_sequence, review_predecessor_sequence
         FROM taptime_server.offline_sync_cursors
         WHERE organization_id = $1::uuid AND installation_id = $2::uuid
         FOR UPDATE`,
        [actor.organization_id, installationRow.id],
      );
      const cursor = cursorResult.rows[0];
      if (cursor === undefined) throw new Error('Offline sync cursor was not created');
      const expectedSequence = Number(cursor.last_durable_sequence) + 1;
      if (request.command.deviceSequence > expectedSequence) {
        await rollback(client);
        transactionOpen = false;
        return { status: 'pending', reason: 'sequence_gap' };
      }
      if (request.command.deviceSequence < expectedSequence) {
        await rollback(client);
        transactionOpen = false;
        return { status: 'conflict', reason: 'sequence_content_conflict' };
      }

      const configurationResult = request.command.provenanceVersion === 1
        ? await legacyConfiguration(client, actor.organization_id, lease)
        : await generalizedConfiguration(client, actor.organization_id, lease);
      const configuration = configurationResult.rows[0];
      if (configuration === undefined) {
        await rollback(client);
        transactionOpen = false;
        return { status: 'pending', reason: 'temporarily_unavailable' };
      }
      const serverTime = await query<{ now: Date }>(
        client,
        'SELECT pg_catalog.transaction_timestamp() AS now',
      );
      const reviewReason = automaticReviewReason({
        actor,
        installationIdentityBindingId: installationRow.identity_binding_id,
        lease,
        configuration,
        cursor,
        hasReviewPredecessor,
        command: request.command,
        serverNow: serverTime.rows[0]!.now,
      });
      const workEvent = authoritativeWorkEvent(request.command, actor, lease);
      const workEventHash = workEventHashForVersion(workEvent, request.command.provenanceVersion);

      let result: OfflineLifecycleEventResult;
      if (reviewReason !== null) {
        await persistWorkEvent(client, workEvent, workEventHash);
        await persistReceipt(client, request.command, workEvent, 'received', null);
        await persistAudit(client, request.command, workEvent, 'OfflineLifecycleReviewStored', {
          status: 'review_pending',
          reason: reviewReason,
        });
        await persistReconciliation(
          client,
          request.command,
          actor,
          installationRow.id,
          requestHash,
          'review_pending',
          reviewReason,
          null,
        );
        result = {
          status: 'review_pending',
          idempotentRetry: false,
          reason: reviewReason,
          workEventId: request.command.workEvent.id,
          receiptId: request.command.receipt.id,
          deviceSequence: request.command.deviceSequence,
        };
      } else {
        const activeTimeEntry = await findActiveTimeEntry(client, actor);
        const previousWorkEvent = await findPreviousCanonicalWorkEvent(client, workEvent);
        const decision = this.businessEngine.evaluate(workEvent, {
          activeTimeEntryForUser: activeTimeEntry,
          previousAcceptedWorkEventForUserAndTarget: previousWorkEvent,
        });
        await persistWorkEvent(client, workEvent, workEventHash);
        await persistTimeEntryMutation(client, decision);
        await persistDecision(client, workEvent, decision);
        const canonicalDecision = canonicalDecisionFromEngine(decision);
        await persistReceipt(
          client,
          request.command,
          workEvent,
          'synchronized',
          resultTimeEntryId(canonicalDecision),
        );
        await persistAudit(client, request.command, workEvent, 'OfflineLifecycleEvaluated', {
          status: 'synchronized',
          decision: canonicalDecision.status,
        });
        await persistReconciliation(
          client,
          request.command,
          actor,
          installationRow.id,
          requestHash,
          'synchronized',
          null,
          resultTimeEntryId(canonicalDecision),
        );
        result = {
          status: 'synchronized',
          idempotentRetry: false,
          decision: canonicalDecision,
          workEventId: request.command.workEvent.id,
          receiptId: request.command.receipt.id,
          deviceSequence: request.command.deviceSequence,
        };
      }
      await query(
        client,
        `UPDATE taptime_server.offline_sync_cursors
         SET last_durable_sequence = $3::bigint,
             review_predecessor_sequence = CASE
               WHEN review_predecessor_sequence IS NOT NULL THEN review_predecessor_sequence
               WHEN $4::boolean THEN $3::bigint
               ELSE NULL
             END,
             updated_at = pg_catalog.transaction_timestamp()
         WHERE organization_id = $1::uuid AND installation_id = $2::uuid`,
        [
          actor.organization_id,
          installationRow.id,
          request.command.deviceSequence,
          result.status === 'review_pending',
        ],
      );
      await query(client, 'COMMIT');
      transactionOpen = false;
      return result;
    } catch (error) {
      if (transactionOpen) await rollback(client);
      throw error;
    } finally {
      client.release();
    }
  }
}

function validateCommand(
  command: OfflineLifecycleEventCommand | OfflineLifecycleEventCommandV2,
): void {
  const ids = [
    command.organizationId,
    command.expectedMembershipId,
    command.leaseId,
    command.leaseItemId,
    command.workEvent.id,
    command.workEvent.target.targetId,
    command.receipt.id,
  ];
  if (
    !ids.every(isCanonicalOfflineUuid)
    || !isOfflineBase64Url32Bytes(command.installationBinding)
    || !['customer', 'project', 'general_work'].includes(command.workEvent.target.targetType)
    || !isOfflineIsoTimestamp(command.workEvent.occurredAt)
    || command.receipt.attemptNumber !== 1
    || !isPositiveSafeInteger(command.deviceSequence)
    || (
      command.provenanceVersion !== OFFLINE_PROVENANCE_VERSION
      && command.provenanceVersion !== OFFLINE_PROVENANCE_VERSION_V2
    )
    || command.clock.clockProofVersion !== OFFLINE_CLOCK_PROOF_VERSION
    || (
      command.clock.clockProofStatus !== 'verified_same_boot'
      && command.clock.clockProofStatus !== 'review_only'
    )
    || !isOfflineIsoTimestamp(command.clock.wallClockAnchor)
    || command.clock.bootMarker.length < 1
    || Buffer.byteLength(command.clock.bootMarker, 'utf8') > 256
    || !Number.isSafeInteger(command.clock.monotonicAnchorMilliseconds)
    || command.clock.monotonicAnchorMilliseconds < 0
    || !Number.isSafeInteger(command.clock.monotonicDeltaMilliseconds)
    || command.clock.monotonicDeltaMilliseconds < 0
  ) {
    throw new TypeError('Invalid offline lifecycle event command');
  }
  if (command.provenanceVersion === 1) {
    if (
      command.workEvent.target.targetType !== 'customer'
      || !isCanonicalOfflineUuid(command.workEvent.assignmentId)
      || !isCanonicalOfflineUuid(command.workEvent.nfcTagId)
    ) throw new TypeError('Invalid offline lifecycle event command');
  } else if (
    command.workEvent.trigger.type === 'nfc'
      ? (
          command.workEvent.target.targetType !== 'customer'
          || !isCanonicalOfflineUuid(command.workEvent.trigger.assignmentId)
          || !isCanonicalOfflineUuid(command.workEvent.trigger.nfcTagId)
        )
      : command.workEvent.trigger.type !== 'manual'
  ) {
    throw new TypeError('Invalid offline lifecycle event command');
  }
}

function leaseTriggerMatches(
  lease: LeaseItemRow,
  command: OfflineLifecycleEventCommand | OfflineLifecycleEventCommandV2,
): boolean {
  if (command.provenanceVersion === 1) {
    return lease.item_type === 'nfc_assignment'
      && lease.assignment_id === command.workEvent.assignmentId
      && lease.nfc_tag_id === command.workEvent.nfcTagId;
  }
  return command.workEvent.trigger.type === 'manual'
    ? lease.item_type === 'manual_target'
      && lease.assignment_id === null
      && lease.nfc_tag_id === null
    : lease.item_type === 'nfc_assignment'
      && lease.assignment_id === command.workEvent.trigger.assignmentId
      && lease.nfc_tag_id === command.workEvent.trigger.nfcTagId;
}

async function legacyConfiguration(
  client: PoolClient,
  organizationId: string,
  lease: LeaseItemRow,
): Promise<{ readonly rows: readonly ConfigurationRow[] }> {
  if (lease.assignment_id === null || lease.nfc_tag_id === null) return { rows: [] };
  const result = await query<{
    readonly assignment_id: string;
    readonly nfc_tag_id: string;
    readonly target_type: 'customer';
    readonly target_customer_id: string;
    readonly assignment_active: boolean;
    readonly assignment_valid_from: Date;
    readonly assignment_valid_to: Date | null;
    readonly tag_created_at: Date;
    readonly customer_active: boolean;
    readonly customer_activated_at: Date;
    readonly customer_deactivated_at: Date | null;
  }>(
    client,
    `SELECT assignment_id, nfc_tag_id, target_type, target_customer_id,
            assignment_active, assignment_valid_from, assignment_valid_to,
            tag_created_at, customer_active, customer_activated_at,
            customer_deactivated_at
     FROM taptime_server.lock_offline_historical_configuration_v1(
       $1::uuid, $2::uuid, $3::uuid, $4::uuid
     )`,
    [organizationId, lease.assignment_id, lease.nfc_tag_id, lease.target_customer_id],
  );
  return {
    rows: result.rows.map((row) => ({
      target_type: row.target_type,
      target_id: row.target_customer_id,
      target_active: row.customer_active,
      target_created_at: row.customer_activated_at,
      target_deactivated_at: row.customer_deactivated_at,
      target_row_version: lease.target_row_version,
      assignment_active: row.assignment_active,
      assignment_valid_from: row.assignment_valid_from,
      assignment_valid_to: row.assignment_valid_to,
      assignment_row_version: lease.assignment_row_version,
      tag_created_at: row.tag_created_at,
    })),
  };
}

async function generalizedConfiguration(
  client: PoolClient,
  organizationId: string,
  lease: LeaseItemRow,
): Promise<{ readonly rows: readonly ConfigurationRow[] }> {
  return query<ConfigurationRow>(
    client,
    `SELECT target.target_type, target.target_id, target.target_active,
            target.target_created_at, target.target_deactivated_at,
            target.target_row_version, target.assignment_active,
            target.assignment_valid_from, target.assignment_valid_to,
            target.assignment_row_version, target.tag_created_at
     FROM taptime_server.lock_offline_historical_configuration_v2(
       $1::uuid, $2, $3::uuid, $4::uuid, $5::uuid
     ) AS target`,
    [
      organizationId,
      lease.target_type,
      lease.target_customer_id,
      lease.assignment_id,
      lease.nfc_tag_id,
    ],
  );
}

function workTarget(
  type: 'customer' | 'project' | 'general_work',
  id: string,
) {
  if (type === 'customer') return customerAssignmentTarget(CustomerId(id));
  if (type === 'project') return projectWorkTarget(ProjectId(id));
  return generalWorkTarget(GeneralWorkTargetId(id));
}

function workEventHashForVersion(
  event: WorkEvent,
  provenanceVersion: 1 | 2,
): string {
  if (provenanceVersion === 1) {
    if (
      event.trigger?.type === 'manual'
      || event.assignmentId === undefined
      || event.nfcTagId === undefined
    ) throw new Error('v1 WorkEvent cannot be manual');
    return workEventContentHash({
      id: event.id,
      organizationId: event.organizationId,
      assignmentId: event.assignmentId,
      nfcTagId: event.nfcTagId,
      targetType: event.target.targetType,
      targetId: event.target.targetId,
      triggeredBy: event.triggeredBy,
      occurredAt: event.occurredAt,
    });
  }
  const manual = event.trigger?.type === 'manual';
  const assignmentId = manual ? null : event.assignmentId;
  const nfcTagId = manual ? null : event.nfcTagId;
  if (!manual && (assignmentId === undefined || nfcTagId === undefined)) {
    throw new Error('NFC WorkEvent provenance is incomplete');
  }
  return workEventContentHashV2({
    id: event.id,
    organizationId: event.organizationId,
    targetType: event.target.targetType,
    targetId: event.target.targetId,
    triggeredBy: event.triggeredBy,
    occurredAt: event.occurredAt,
    triggerType: manual ? 'manual' : 'nfc',
    assignmentId: assignmentId ?? null,
    nfcTagId: nfcTagId ?? null,
  });
}

function automaticReviewReason(input: {
  readonly actor: ActorRow;
  readonly installationIdentityBindingId: string;
  readonly lease: LeaseItemRow;
  readonly configuration: ConfigurationRow;
  readonly cursor: CursorRow;
  readonly hasReviewPredecessor: boolean;
  readonly command: OfflineLifecycleEventCommand | OfflineLifecycleEventCommandV2;
  readonly serverNow: Date;
}): OfflineReviewReason | null {
  const {
    actor,
    installationIdentityBindingId,
    lease,
    configuration,
    cursor,
    hasReviewPredecessor,
    command,
    serverNow,
  } = input;
  if (cursor.review_predecessor_sequence !== null || hasReviewPredecessor) {
    return 'predecessor_requires_review';
  }
  if (
    !actor.identity_current
    || !actor.membership_current
    || actor.identity_binding_id !== installationIdentityBindingId
    || actor.identity_binding_id !== lease.identity_binding_id
    || actor.membership_id !== lease.membership_id
    || actor.membership_role !== lease.membership_role
    || actor.membership_row_version !== lease.membership_row_version
  ) {
    return 'identity_or_membership_not_current';
  }
  const occurredAt = Date.parse(command.workEvent.occurredAt);
  const issuedAt = lease.issued_at.getTime();
  const expiresAt = lease.expires_at.getTime();
  if (
    command.clock.clockProofStatus !== 'verified_same_boot'
    ||
    occurredAt < issuedAt - OFFLINE_CLOCK_TOLERANCE_MILLISECONDS
    || occurredAt > expiresAt + OFFLINE_CLOCK_TOLERANCE_MILLISECONDS
    || !clockProofIsConsistent(command, issuedAt, occurredAt)
  ) {
    return 'capture_time_out_of_bounds';
  }
  if (
    serverNow.getTime()
    > expiresAt + OFFLINE_AUTOMATIC_EVALUATION_AFTER_EXPIRY_MILLISECONDS
  ) {
    return 'automatic_window_elapsed';
  }
  if (
    occurredAt < configuration.target_created_at.getTime()
    || (
      configuration.target_deactivated_at !== null
      && occurredAt >= configuration.target_deactivated_at.getTime()
    )
    || configuration.target_row_version !== lease.target_row_version
    || (
      lease.item_type === 'nfc_assignment'
      && (
        configuration.assignment_valid_from === null
        || configuration.tag_created_at === null
        || configuration.assignment_row_version !== lease.assignment_row_version
        || occurredAt < configuration.assignment_valid_from.getTime()
        || (
          configuration.assignment_valid_to !== null
          && occurredAt >= configuration.assignment_valid_to.getTime()
        )
        || occurredAt < configuration.tag_created_at.getTime()
      )
    )
  ) {
    return 'historical_configuration_not_valid';
  }
  return null;
}

function clockProofIsConsistent(
  command: OfflineLifecycleEventCommand | OfflineLifecycleEventCommandV2,
  leaseIssuedAt: number,
  occurredAt: number,
): boolean {
  const wallAnchor = Date.parse(command.clock.wallClockAnchor);
  const expectedOccurredAt = wallAnchor + command.clock.monotonicDeltaMilliseconds;
  return Math.abs(wallAnchor - leaseIssuedAt) <= OFFLINE_CLOCK_TOLERANCE_MILLISECONDS
    && Math.abs(expectedOccurredAt - occurredAt) <= OFFLINE_CLOCK_TOLERANCE_MILLISECONDS
    && Number.isSafeInteger(
      command.clock.monotonicAnchorMilliseconds + command.clock.monotonicDeltaMilliseconds,
    );
}

function authoritativeWorkEvent(
  command: OfflineLifecycleEventCommand | OfflineLifecycleEventCommandV2,
  actor: ActorRow,
  lease: LeaseItemRow,
): NfcWorkEvent | ManualWorkEvent {
  const base = {
    id: WorkEventId(command.workEvent.id),
    organizationId: OrganizationId(actor.organization_id),
    target: workTarget(lease.target_type, lease.target_customer_id),
    triggeredBy: UserId(actor.user_id),
    occurredAt: createTimestamp(command.workEvent.occurredAt),
  };
  if (lease.item_type === 'manual_target') {
    return { ...base, trigger: { type: 'manual' } };
  }
  if (lease.assignment_id === null || lease.nfc_tag_id === null) {
    throw new Error('NFC lease item is incomplete');
  }
  return {
    ...base,
    assignmentId: NfcAssignmentId(lease.assignment_id),
    nfcTagId: NfcTagId(lease.nfc_tag_id),
    trigger: {
      type: 'nfc',
      assignmentId: NfcAssignmentId(lease.assignment_id),
      nfcTagId: NfcTagId(lease.nfc_tag_id),
    },
  };
}

async function findExistingReconciliation(
  client: PoolClient,
  organizationId: string,
  installationId: string,
  workEventId: string,
  receiptId: string,
  deviceSequence: number,
): Promise<ExistingReconciliationRow | null> {
  const result = await query<ExistingReconciliationRow>(
    client,
    `SELECT work_event_id, receipt_id, installation_id, lease_id, lease_item_id,
            device_sequence, request_content_hash, result_status, review_reason
     FROM taptime_server.offline_event_reconciliations
     WHERE organization_id = $1::uuid
       AND (
         work_event_id = $2::uuid
         OR (installation_id = $3::uuid AND device_sequence = $4::bigint)
         OR receipt_id = $5::uuid
       )
     ORDER BY CASE
       WHEN work_event_id = $2::uuid THEN 0
       WHEN receipt_id = $5::uuid THEN 1
       ELSE 2
     END
     LIMIT 1`,
    [organizationId, workEventId, installationId, deviceSequence, receiptId],
  );
  return result.rows[0] ?? null;
}

async function priorResult(
  client: PoolClient,
  command: OfflineLifecycleEventCommand | OfflineLifecycleEventCommandV2,
  requestHash: string,
  prior: ExistingReconciliationRow,
): Promise<OfflineLifecycleEventResult> {
  if (prior.work_event_id !== command.workEvent.id) {
    return {
      status: 'conflict',
      reason: prior.receipt_id === command.receipt.id
        ? 'receipt_metadata_conflict'
        : 'sequence_content_conflict',
    };
  }
  if (
    prior.receipt_id !== command.receipt.id
    || prior.installation_id.length === 0
    || prior.lease_id !== command.leaseId
    || prior.lease_item_id !== command.leaseItemId
    || Number(prior.device_sequence) !== command.deviceSequence
    || prior.request_content_hash !== requestHash
  ) {
    return { status: 'conflict', reason: 'event_content_conflict' };
  }
  if (prior.result_status === 'review_pending') {
    if (prior.review_reason === null) throw new Error('Stored review result has no reason');
    return {
      status: 'review_pending',
      idempotentRetry: true,
      reason: prior.review_reason,
      workEventId: prior.work_event_id,
      receiptId: prior.receipt_id,
      deviceSequence: Number(prior.device_sequence),
    };
  }
  const decisionResult = await query<DecisionRow>(
    client,
    `SELECT decision_type, reason, time_entry_id, active_time_entry_id,
            previous_work_event_id
     FROM taptime_server.canonical_decisions
     WHERE organization_id = $1::uuid
       AND actor_user_id = pg_catalog.current_setting('app.user_id')::uuid
       AND work_event_id = $2::uuid`,
    [command.organizationId, command.workEvent.id],
  );
  const decision = decisionResult.rows[0];
  if (decision === undefined) throw new Error('Stored synchronized result has no decision');
  return {
    status: 'synchronized',
    idempotentRetry: true,
    decision: canonicalDecisionFromRow(decision),
    workEventId: prior.work_event_id,
    receiptId: prior.receipt_id,
    deviceSequence: Number(prior.device_sequence),
  };
}

async function findPersistedLifecycleConflict(
  client: PoolClient,
  actor: ActorRow,
  command: OfflineLifecycleEventCommand | OfflineLifecycleEventCommandV2,
): Promise<'event_content_conflict' | 'receipt_metadata_conflict' | null> {
  const result = await query<ExistingLifecycleCollisionRow>(
    client,
    `SELECT
       EXISTS (
         SELECT 1
         FROM taptime_server.work_events AS event
         WHERE event.organization_id = $1::uuid
           AND event.triggered_by_user_id = $2::uuid
           AND event.id = $3::uuid
       ) AS work_event_exists,
       EXISTS (
         SELECT 1
         FROM taptime_server.sync_receipts AS receipt
         WHERE receipt.organization_id = $1::uuid
           AND receipt.user_id = $2::uuid
           AND receipt.id = $4::uuid
       ) AS receipt_exists`,
    [
      actor.organization_id,
      actor.user_id,
      command.workEvent.id,
      command.receipt.id,
    ],
  );
  const row = result.rows[0];
  if (row === undefined) throw new Error('Offline collision check returned no result');
  if (row.work_event_exists) return 'event_content_conflict';
  if (row.receipt_exists) return 'receipt_metadata_conflict';
  return null;
}

async function findActiveTimeEntry(
  client: PoolClient,
  actor: ActorRow,
): Promise<StartedTimeEntry | null> {
  const result = await query<ActiveTimeEntryRow>(
    client,
    `SELECT id, organization_id, user_id, target_type, target_customer_id,
            start_work_event_id, started_at
     FROM taptime_server.time_entries
     WHERE organization_id = $1::uuid
       AND user_id = $2::uuid
       AND status = 'started'
     LIMIT 1
     FOR UPDATE`,
    [actor.organization_id, actor.user_id],
  );
  const row = result.rows[0];
  return row === undefined ? null : {
    id: TimeEntryId(row.id),
    workEventId: WorkEventId(row.start_work_event_id),
    organizationId: OrganizationId(row.organization_id),
    userId: UserId(row.user_id),
    target: workTarget(row.target_type, row.target_customer_id),
    status: 'started',
    startedAt: createTimestamp(row.started_at.toISOString()),
  };
}

async function findPreviousCanonicalWorkEvent(
  client: PoolClient,
  workEvent: WorkEvent,
): Promise<WorkEvent | null> {
  const result = await query<WorkEventRow>(
    client,
    `SELECT event.id, event.organization_id, event.assignment_id, event.nfc_tag_id,
            event.target_type, event.target_customer_id, event.triggered_by_user_id,
            event.occurred_at
     FROM taptime_server.work_events AS event
     JOIN taptime_server.canonical_decisions AS decision
       ON decision.organization_id = event.organization_id
      AND decision.actor_user_id = event.triggered_by_user_id
      AND decision.work_event_id = event.id
     WHERE event.organization_id = $1::uuid
       AND event.triggered_by_user_id = $2::uuid
       AND event.target_type = $3
       AND event.target_customer_id = $4::uuid
     ORDER BY event.occurred_at DESC, event.received_at DESC, event.id DESC
     LIMIT 1`,
    [
      workEvent.organizationId,
      workEvent.triggeredBy,
      workEvent.target.targetType,
      workEvent.target.targetId,
    ],
  );
  const row = result.rows[0];
  if (row === undefined) return null;
  const base = {
    id: WorkEventId(row.id),
    organizationId: OrganizationId(row.organization_id),
    target: workTarget(row.target_type, row.target_customer_id),
    triggeredBy: UserId(row.triggered_by_user_id),
    occurredAt: createTimestamp(row.occurred_at.toISOString()),
  };
  return row.assignment_id === null || row.nfc_tag_id === null
    ? { ...base, trigger: { type: 'manual' as const } }
    : {
        ...base,
        assignmentId: NfcAssignmentId(row.assignment_id),
        nfcTagId: NfcTagId(row.nfc_tag_id),
        trigger: {
          type: 'nfc' as const,
          assignmentId: NfcAssignmentId(row.assignment_id),
          nfcTagId: NfcTagId(row.nfc_tag_id),
        },
      };
}

async function persistWorkEvent(
  client: PoolClient,
  event: WorkEvent,
  contentHash: string,
): Promise<void> {
  const result = await query(
    client,
    `INSERT INTO taptime_server.work_events (
       id, organization_id, assignment_id, nfc_tag_id, target_type, target_customer_id,
       triggered_by_user_id, occurred_at, content_hash, content_hash_algorithm,
       content_hash_version, trigger_type
     ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5, $6::uuid, $7::uuid,
       $8::timestamptz, $9, $10, $11, $12)
     ON CONFLICT DO NOTHING`,
    [
      event.id,
      event.organizationId,
      event.trigger?.type === 'manual' ? null : event.assignmentId,
      event.trigger?.type === 'manual' ? null : event.nfcTagId,
      event.target.targetType,
      event.target.targetId,
      event.triggeredBy,
      event.occurredAt,
      contentHash,
      B3_CONTENT_HASH_ALGORITHM,
      event.trigger?.type === 'manual' || event.target.targetType !== 'customer'
        ? DA5_CONTENT_HASH_VERSION
        : B3_CONTENT_HASH_VERSION,
      event.trigger?.type ?? 'nfc',
    ],
  );
  if (result.rowCount !== 1) throw new Error('Offline WorkEvent conflict');
}

async function persistTimeEntryMutation(
  client: PoolClient,
  decision: BusinessEngineDecision,
): Promise<void> {
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
  } else if (decision.status === 'time_entry_stopped') {
    const entry = decision.timeEntry;
    const result = await query(
      client,
      `UPDATE taptime_server.time_entries
       SET status = 'stopped', stop_work_event_id = $4::uuid,
           stopped_at = $5::timestamptz, stopped_via = $6,
           row_version = row_version + 1
       WHERE organization_id = $1::uuid AND user_id = $2::uuid
         AND id = $3::uuid AND status = 'started'`,
      [
        entry.organizationId,
        entry.userId,
        entry.id,
        entry.stoppedByWorkEventId,
        entry.stoppedAt,
        entry.stoppedVia ?? 'nfc',
      ],
    );
    if (result.rowCount !== 1) throw new Error('Offline Stop did not map to an active TimeEntry');
  }
}

async function persistDecision(
  client: PoolClient,
  event: WorkEvent,
  decision: BusinessEngineDecision,
): Promise<void> {
  const canonical = canonicalDecisionFromEngine(decision);
  await query(
    client,
    `INSERT INTO taptime_server.canonical_decisions (
       work_event_id, organization_id, actor_user_id, target_type, target_customer_id,
       decision_type, reason, time_entry_id, active_time_entry_id, previous_work_event_id,
       engine_version, decision_payload
     ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5::uuid, $6, $7,
       $8::uuid, $9::uuid, $10::uuid, $11, $12::jsonb)`,
    [
      event.id,
      event.organizationId,
      event.triggeredBy,
      event.target.targetType,
      event.target.targetId,
      canonical.status,
      canonical.status === 'escalation_required' ? canonical.reason : null,
      canonical.status === 'time_entry_started' || canonical.status === 'time_entry_stopped'
        ? canonical.timeEntryId : null,
      canonical.status === 'active_entry_for_other_target_rejected'
        ? canonical.activeTimeEntryId : null,
      canonical.status === 'duplicate_scan_ignored'
        ? canonical.previousWorkEventId : null,
      OFFLINE_ENGINE_VERSION,
      JSON.stringify(canonical.status === 'escalation_required'
        ? { status: canonical.status, reason: canonical.reason }
        : { status: canonical.status }),
    ],
  );
}

async function persistReceipt(
  client: PoolClient,
  command: OfflineLifecycleEventCommand | OfflineLifecycleEventCommandV2,
  event: WorkEvent,
  status: 'received' | 'synchronized',
  serverTimeEntryId: string | null,
): Promise<void> {
  await query(
    client,
    `INSERT INTO taptime_server.sync_receipts (
       id, organization_id, user_id, target_type, target_customer_id, work_event_id,
       attempt_number, status, server_decision_work_event_id, server_time_entry_id
     ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5::uuid, $6::uuid, 1, $7,
       CASE WHEN $7 = 'synchronized' THEN $6::uuid ELSE NULL END, $8::uuid)`,
    [
      command.receipt.id,
      event.organizationId,
      event.triggeredBy,
      event.target.targetType,
      event.target.targetId,
      event.id,
      status,
      serverTimeEntryId,
    ],
  );
}

async function persistAudit(
  client: PoolClient,
  command: OfflineLifecycleEventCommand | OfflineLifecycleEventCommandV2,
  event: WorkEvent,
  eventType: string,
  payload: Readonly<Record<string, string>>,
): Promise<void> {
  await query(
    client,
    `INSERT INTO taptime_server.audit_events (
       id, organization_id, actor_user_id, work_event_user_id, work_event_id,
       event_type, entity_type, entity_id, occurred_at, correlation_id, payload
     ) VALUES ($1::uuid, $2::uuid, $3::uuid, $3::uuid, $4::uuid,
       $5, 'WorkEvent', $4::uuid, pg_catalog.transaction_timestamp(), $6, $7::jsonb)`,
    [
      randomUUID(),
      event.organizationId,
      event.triggeredBy,
      event.id,
      eventType,
      `offline:${command.receipt.id}`,
      JSON.stringify({ ...payload, deviceSequence: String(command.deviceSequence) }),
    ],
  );
}

async function persistReconciliation(
  client: PoolClient,
  command: OfflineLifecycleEventCommand | OfflineLifecycleEventCommandV2,
  actor: ActorRow,
  installationId: string,
  requestHash: string,
  status: 'synchronized' | 'review_pending',
  reviewReason: OfflineReviewReason | null,
  serverTimeEntryId: string | null,
): Promise<void> {
  await query(
    client,
    `INSERT INTO taptime_server.offline_event_reconciliations (
       organization_id, work_event_id, receipt_id, installation_id, lease_id,
       lease_item_id, user_id, membership_id, device_sequence, request_content_hash,
       boot_marker, monotonic_anchor_milliseconds, monotonic_delta_milliseconds,
       wall_clock_anchor, clock_proof_status, clock_proof_version, provenance_version, result_status,
       review_reason, decision_work_event_id, server_time_entry_id
     ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid, $6::uuid,
       $7::uuid, $8::uuid, $9::bigint, $10, $11, $12::bigint, $13::bigint,
       $14::timestamptz, $15, 1, $16, $17, $18,
       CASE WHEN $17 = 'synchronized' THEN $2::uuid ELSE NULL END, $19::uuid)`,
    [
      actor.organization_id,
      command.workEvent.id,
      command.receipt.id,
      installationId,
      command.leaseId,
      command.leaseItemId,
      actor.user_id,
      actor.membership_id,
      command.deviceSequence,
      requestHash,
      command.clock.bootMarker,
      command.clock.monotonicAnchorMilliseconds,
      command.clock.monotonicDeltaMilliseconds,
      command.clock.wallClockAnchor,
      command.clock.clockProofStatus,
      command.provenanceVersion,
      status,
      reviewReason,
      serverTimeEntryId,
    ],
  );
}

function canonicalDecisionFromEngine(decision: BusinessEngineDecision): OfflineCanonicalDecision {
  switch (decision.status) {
    case 'time_entry_started':
    case 'time_entry_stopped':
      return { status: decision.status, timeEntryId: decision.timeEntry.id };
    case 'duplicate_scan_ignored':
      return {
        status: 'duplicate_scan_ignored',
        previousWorkEventId: decision.previousWorkEvent.id,
      };
    case 'active_entry_for_other_target_rejected':
      return {
        status: 'active_entry_for_other_target_rejected',
        activeTimeEntryId: decision.activeTimeEntry.id,
      };
    case 'escalation_required':
      return { status: 'escalation_required', reason: decision.reason };
  }
}

function canonicalDecisionFromRow(row: DecisionRow): OfflineCanonicalDecision {
  switch (row.decision_type) {
    case 'time_entry_started':
    case 'time_entry_stopped':
      if (row.time_entry_id === null) throw new Error('Incomplete persisted TimeEntry decision');
      return { status: row.decision_type, timeEntryId: row.time_entry_id };
    case 'duplicate_scan_ignored':
      if (row.previous_work_event_id === null) throw new Error('Incomplete persisted duplicate');
      return {
        status: 'duplicate_scan_ignored',
        previousWorkEventId: row.previous_work_event_id,
      };
    case 'active_entry_for_other_target_rejected':
      if (row.active_time_entry_id === null) throw new Error('Incomplete persisted rejection');
      return {
        status: 'active_entry_for_other_target_rejected',
        activeTimeEntryId: row.active_time_entry_id,
      };
    case 'escalation_required':
      if (row.reason === null) throw new Error('Incomplete persisted escalation');
      return { status: 'escalation_required', reason: row.reason };
    default:
      throw new Error('Unknown persisted canonical decision');
  }
}

function resultTimeEntryId(decision: OfflineCanonicalDecision): string | null {
  return decision.status === 'time_entry_started' || decision.status === 'time_entry_stopped'
    ? decision.timeEntryId
    : decision.status === 'active_entry_for_other_target_rejected'
      ? decision.activeTimeEntryId
      : null;
}

function offlineEventRequestHash(
  command: OfflineLifecycleEventCommand | OfflineLifecycleEventCommandV2,
): string {
  const triggerFields = command.provenanceVersion === 1
    ? [command.workEvent.assignmentId, command.workEvent.nfcTagId]
    : command.workEvent.trigger.type === 'nfc'
      ? ['nfc', command.workEvent.trigger.assignmentId, command.workEvent.trigger.nfcTagId]
      : ['manual', null, null];
  return createHash('sha256').update(JSON.stringify([
    command.organizationId,
    command.expectedMembershipId,
    command.leaseId,
    command.leaseItemId,
    command.installationBinding,
    command.deviceSequence,
    command.provenanceVersion,
    command.clock.bootMarker,
    command.clock.monotonicAnchorMilliseconds,
    command.clock.monotonicDeltaMilliseconds,
    command.clock.wallClockAnchor,
    command.clock.clockProofStatus,
    command.clock.clockProofVersion,
    command.workEvent.id,
    ...triggerFields,
    command.workEvent.target.targetType,
    command.workEvent.target.targetId,
    new Date(command.workEvent.occurredAt).toISOString(),
    command.receipt.id,
    command.receipt.attemptNumber,
  ]), 'utf8').digest('hex');
}

function decodeBase64Url32(value: string): Buffer {
  const bytes = Buffer.from(value, 'base64url');
  if (bytes.byteLength !== 32 || bytes.toString('base64url') !== value) {
    throw new TypeError('Offline installation binding is not canonical');
  }
  return bytes;
}

function requireGeneratedUuid(value: string): string {
  if (!isCanonicalOfflineUuid(value)) {
    throw new Error('Secure UUID generator returned a non-canonical UUID');
  }
  return value;
}
