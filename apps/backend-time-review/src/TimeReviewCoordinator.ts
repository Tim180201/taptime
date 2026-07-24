import { createHash } from 'node:crypto';
import type { AccessTokenVerifier } from '@taptime/backend-identity';
import {
  canonicalTimeReviewCommandPayload,
  isCanonicalTimeReviewTimestamp,
  isCanonicalTimeReviewUuid,
  validateReviewAdjudicationRequest,
  validateReviewItemQueryRequest,
  validateTimeRecordCorrectionRequest,
  validateTimeRecordQueryRequest,
  type CorrectedTimeRecord,
  type ReviewAdjudicationReceipt,
  type ReviewItemProjection,
  type TimeRecordProjection,
  type TimeRecordProjectionV2,
  type ReviewItemProjectionV2,
} from '@taptime/time-review-contract';
import type { Pool, PoolClient, QueryResultRow } from 'pg';
import type {
  AuthenticatedTimeReviewCommand,
  TimeReviewCoordinatorControls,
  TimeReviewPort,
} from './types.js';

export const TIME_REVIEW_IDENTITY_RESOLVER_ROLE = 'taptime_identity_resolver';
export const TIME_REVIEW_READER_ROLE = 'taptime_time_review_reader';
export const TIME_REVIEW_WRITER_ROLE = 'taptime_time_review_writer';

const DEFAULT_DEADLINE_MILLISECONDS = 8_000;
const DEADLINE_SAFETY_MILLISECONDS = 100;

interface ActorRow extends QueryResultRow {
  readonly user_id: string;
  readonly organization_id: string;
  readonly membership_id: string;
  readonly membership_role: string;
}

interface TimeRecordRow extends QueryResultRow {
  readonly time_record_id: string;
  readonly employee_membership_id: string | null;
  readonly employee_display_name: string | null;
  readonly customer_id: string | null;
  readonly customer_display_name: string | null;
  readonly source: 'canonical' | 'recovered';
  readonly status: 'started' | 'stopped';
  readonly started_at: Date;
  readonly stopped_at: Date | null;
  readonly base_row_version: string;
  readonly effective_revision_number: string;
  readonly overlaps_another_record: boolean;
}

interface TimeRecordRowV2 extends QueryResultRow {
  readonly time_record_id: string;
  readonly employee_membership_id: string | null;
  readonly employee_display_name: string | null;
  readonly target_type: 'customer' | 'project' | 'general_work';
  readonly target_id: string;
  readonly target_display_name: string;
  readonly source: 'canonical' | 'recovered';
  readonly status: 'started' | 'stopped';
  readonly started_via: 'nfc' | 'manual' | null;
  readonly stopped_via: 'nfc' | 'manual' | null;
  readonly started_at: Date;
  readonly stopped_at: Date | null;
  readonly base_row_version: string;
  readonly effective_revision_number: string;
  readonly overlaps_another_record: boolean;
}

interface ReviewItemRow extends QueryResultRow {
  readonly review_item_id: string;
  readonly source_family: 'offline_v2' | 'server_legacy';
  readonly employee_user_id: string;
  readonly employee_membership_id: string | null;
  readonly employee_display_name: string | null;
  readonly customer_id: string | null;
  readonly customer_display_name: string | null;
  readonly occurred_at: Date;
  readonly recorded_at: Date;
  readonly review_reason: ReviewItemProjection['reviewReason'];
  readonly device_sequence: string | null;
  readonly predecessor_blocked: boolean;
}

interface ReviewItemRowV2 extends QueryResultRow {
  readonly review_item_id: string;
  readonly source_family: 'offline_v2' | 'server_legacy';
  readonly employee_user_id: string;
  readonly employee_membership_id: string | null;
  readonly employee_display_name: string | null;
  readonly target_type: 'customer' | 'project' | 'general_work';
  readonly target_id: string;
  readonly target_display_name: string;
  readonly trigger_type: 'nfc' | 'manual';
  readonly occurred_at: Date;
  readonly recorded_at: Date;
  readonly review_reason: ReviewItemProjectionV2['reviewReason'];
  readonly device_sequence: string | null;
  readonly predecessor_blocked: boolean;
}

interface CorrectionRow extends QueryResultRow {
  readonly result_status: string;
  readonly time_record_id: string | null;
  readonly revision_number: string | null;
  readonly effective_started_at: Date | null;
  readonly effective_stopped_at: Date | null;
  readonly idempotent_retry: boolean;
}

interface AdjudicationRow extends QueryResultRow {
  readonly result_status: string;
  readonly resolution: ReviewAdjudicationReceipt['resolution'];
  readonly adjudicated_review_item_ids: string[] | null;
  readonly time_record_id: string | null;
  readonly revision_number: string | null;
  readonly idempotent_retry: boolean;
}

interface CursorValue {
  readonly recordedAt: string;
  readonly id: string;
}

export class TimeReviewCoordinator implements TimeReviewPort {
  constructor(
    private readonly readPool: Pool,
    private readonly writePool: Pool,
    private readonly accessTokenVerifier: AccessTokenVerifier,
  ) {}

  async queryTimeRecords(
    command: AuthenticatedTimeReviewCommand<Parameters<TimeReviewPort['queryTimeRecords']>[0]['request']>,
    controls: TimeReviewCoordinatorControls = {},
  ): ReturnType<TimeReviewPort['queryTimeRecords']> {
    const validation = validateTimeRecordQueryRequest(command.request);
    if (validation.status === 'invalid_request') return { status: 'unavailable' };
    const cursor = decodeCursor(validation.request.cursor);
    if (cursor === undefined) return { status: 'unavailable' };
    return this.withAdministrator(
      this.readPool,
      command.accessToken,
      validation.request.expectedMembershipId,
      TIME_REVIEW_READER_ROLE,
      controls,
      async (client, actor) => {
        const result = await client.query<TimeRecordRow>(
          `SELECT time_record_id, employee_membership_id, employee_display_name,
                  customer_id, customer_display_name, source, status, started_at,
                  stopped_at, base_row_version, effective_revision_number,
                  overlaps_another_record
           FROM taptime_server.read_effective_time_records_v1(
             $1, $2, $3, $4::timestamptz, $5::timestamptz,
             $6::timestamptz, $7::uuid, $8
           )`,
          [
            actor.organization_id,
            actor.user_id,
            actor.membership_id,
            validation.request.fromInclusive,
            validation.request.toExclusive,
            cursor?.recordedAt ?? null,
            cursor?.id ?? null,
            validation.request.limit + 1,
          ],
        );
        const visible = result.rows.slice(0, validation.request.limit);
        const last = visible.at(-1);
        return {
          status: 'ready' as const,
          value: Object.freeze({
            records: Object.freeze(visible.map(mapTimeRecord)),
            nextCursor: result.rows.length > validation.request.limit && last !== undefined
              ? encodeCursor(last.started_at, last.time_record_id)
              : null,
          }),
        };
      },
    );
  }

  async queryTimeRecordsV2(
    command: AuthenticatedTimeReviewCommand<Parameters<TimeReviewPort['queryTimeRecords']>[0]['request']>,
    controls: TimeReviewCoordinatorControls = {},
  ) {
    const validation = validateTimeRecordQueryRequest(command.request);
    if (validation.status === 'invalid_request') return { status: 'unavailable' as const };
    const cursor = decodeCursor(validation.request.cursor);
    if (cursor === undefined) return { status: 'unavailable' as const };
    return this.withAdministrator(
      this.readPool,
      command.accessToken,
      validation.request.expectedMembershipId,
      TIME_REVIEW_READER_ROLE,
      controls,
      async (client, actor) => {
        const result = await client.query<TimeRecordRowV2>(
          `SELECT time_record_id, employee_membership_id, employee_display_name,
                  target_type, target_id, target_display_name, source, status,
                  started_via, stopped_via, started_at, stopped_at, base_row_version,
                  effective_revision_number, overlaps_another_record
           FROM taptime_server.read_effective_time_records_v2(
             $1, $2, $3, $4::timestamptz, $5::timestamptz,
             $6::timestamptz, $7::uuid, $8
           )`,
          [
            actor.organization_id,
            actor.user_id,
            actor.membership_id,
            validation.request.fromInclusive,
            validation.request.toExclusive,
            cursor?.recordedAt ?? null,
            cursor?.id ?? null,
            validation.request.limit + 1,
          ],
        );
        const visible = result.rows.slice(0, validation.request.limit);
        const last = visible.at(-1);
        return {
          status: 'ready' as const,
          value: Object.freeze({
            records: Object.freeze(visible.map(mapTimeRecordV2)),
            nextCursor: result.rows.length > validation.request.limit && last !== undefined
              ? encodeCursor(last.started_at, last.time_record_id)
              : null,
          }),
        };
      },
    );
  }

  async correctTimeRecord(
    command: AuthenticatedTimeReviewCommand<Parameters<TimeReviewPort['correctTimeRecord']>[0]['request']>,
    controls: TimeReviewCoordinatorControls = {},
  ): ReturnType<TimeReviewPort['correctTimeRecord']> {
    const validation = validateTimeRecordCorrectionRequest(command.request);
    if (validation.status === 'invalid_request') return { status: 'unavailable' };
    const requestHash = digest(validation.request);
    return this.withAdministrator(
      this.writePool,
      command.accessToken,
      validation.request.expectedMembershipId,
      TIME_REVIEW_WRITER_ROLE,
      controls,
      async (client, actor) => {
        const result = await client.query<CorrectionRow>(
          `SELECT result_status, time_record_id, revision_number, effective_started_at,
                  effective_stopped_at, idempotent_retry
           FROM taptime_server.correct_time_record_v1(
             $1, $2, $3, $4, $5, $6, $7, $8,
             $9::timestamptz, $10::timestamptz, $11
           )`,
          [
            actor.organization_id,
            actor.user_id,
            actor.membership_id,
            validation.request.commandId,
            requestHash,
            validation.request.timeRecordId,
            validation.request.expectedBaseRowVersion,
            validation.request.expectedRevisionNumber,
            validation.request.startedAt,
            validation.request.stoppedAt,
            validation.request.reason,
          ],
        );
        return mapCorrectionResult(requireSingleRow(result.rows));
      },
    );
  }

  async queryReviewItems(
    command: AuthenticatedTimeReviewCommand<Parameters<TimeReviewPort['queryReviewItems']>[0]['request']>,
    controls: TimeReviewCoordinatorControls = {},
  ): ReturnType<TimeReviewPort['queryReviewItems']> {
    const validation = validateReviewItemQueryRequest(command.request);
    if (validation.status === 'invalid_request') return { status: 'unavailable' };
    const cursor = decodeCursor(validation.request.cursor);
    if (cursor === undefined) return { status: 'unavailable' };
    return this.withAdministrator(
      this.readPool,
      command.accessToken,
      validation.request.expectedMembershipId,
      TIME_REVIEW_READER_ROLE,
      controls,
      async (client, actor) => {
        const result = await client.query<ReviewItemRow>(
          `SELECT review_item_id, source_family, employee_user_id,
                  employee_membership_id, employee_display_name, customer_id,
                  customer_display_name, occurred_at, recorded_at, review_reason,
                  device_sequence, predecessor_blocked
           FROM taptime_server.read_time_review_items_v1(
             $1, $2, $3, $4::timestamptz, $5::uuid, $6
           )`,
          [
            actor.organization_id,
            actor.user_id,
            actor.membership_id,
            cursor?.recordedAt ?? null,
            cursor?.id ?? null,
            validation.request.limit + 1,
          ],
        );
        const visible = result.rows.slice(0, validation.request.limit);
        const last = visible.at(-1);
        return {
          status: 'ready' as const,
          value: Object.freeze({
            items: Object.freeze(visible.map(mapReviewItem)),
            nextCursor: result.rows.length > validation.request.limit && last !== undefined
              ? encodeCursor(last.recorded_at, last.review_item_id)
              : null,
          }),
        };
      },
    );
  }

  async queryReviewItemsV2(
    command: AuthenticatedTimeReviewCommand<Parameters<TimeReviewPort['queryReviewItems']>[0]['request']>,
    controls: TimeReviewCoordinatorControls = {},
  ) {
    const validation = validateReviewItemQueryRequest(command.request);
    if (validation.status === 'invalid_request') return { status: 'unavailable' as const };
    const cursor = decodeCursor(validation.request.cursor);
    if (cursor === undefined) return { status: 'unavailable' as const };
    return this.withAdministrator(
      this.readPool,
      command.accessToken,
      validation.request.expectedMembershipId,
      TIME_REVIEW_READER_ROLE,
      controls,
      async (client, actor) => {
        const result = await client.query<ReviewItemRowV2>(
          `SELECT review_item_id, source_family, employee_user_id,
                  employee_membership_id, employee_display_name, target_type,
                  target_id, target_display_name, trigger_type, occurred_at,
                  recorded_at, review_reason, device_sequence, predecessor_blocked
           FROM taptime_server.read_time_review_items_v2(
             $1, $2, $3, $4::timestamptz, $5::uuid, $6
           )`,
          [
            actor.organization_id,
            actor.user_id,
            actor.membership_id,
            cursor?.recordedAt ?? null,
            cursor?.id ?? null,
            validation.request.limit + 1,
          ],
        );
        const visible = result.rows.slice(0, validation.request.limit);
        const last = visible.at(-1);
        return {
          status: 'ready' as const,
          value: Object.freeze({
            items: Object.freeze(visible.map(mapReviewItemV2)),
            nextCursor: result.rows.length > validation.request.limit && last !== undefined
              ? encodeCursor(last.recorded_at, last.review_item_id)
              : null,
          }),
        };
      },
    );
  }

  async adjudicateReviewItems(
    command: AuthenticatedTimeReviewCommand<Parameters<TimeReviewPort['adjudicateReviewItems']>[0]['request']>,
    controls: TimeReviewCoordinatorControls = {},
  ): ReturnType<TimeReviewPort['adjudicateReviewItems']> {
    const validation = validateReviewAdjudicationRequest(command.request);
    if (validation.status === 'invalid_request') return { status: 'unavailable' };
    const requestHash = digest(validation.request);
    const resolution = validation.request.resolution;
    return this.withAdministrator(
      this.writePool,
      command.accessToken,
      validation.request.expectedMembershipId,
      TIME_REVIEW_WRITER_ROLE,
      controls,
      async (client, actor) => {
        const result = await client.query<AdjudicationRow>(
          `SELECT result_status, resolution, adjudicated_review_item_ids,
                  time_record_id, revision_number, idempotent_retry
           FROM taptime_server.adjudicate_time_review_items_v1(
             $1, $2, $3, $4, $5, $6::uuid[], $7, $8::uuid,
             $9::bigint, $10::bigint, $11::timestamptz, $12::timestamptz, $13
           )`,
          [
            actor.organization_id,
            actor.user_id,
            actor.membership_id,
            validation.request.commandId,
            requestHash,
            validation.request.reviewItemIds,
            resolution.type,
            resolution.type === 'adjust_existing_time_record' ? resolution.timeRecordId : null,
            resolution.type === 'adjust_existing_time_record'
              ? resolution.expectedBaseRowVersion : null,
            resolution.type === 'adjust_existing_time_record'
              ? resolution.expectedRevisionNumber : null,
            resolution.type === 'no_time_record_change' ? null : resolution.startedAt,
            resolution.type === 'no_time_record_change' ? null : resolution.stoppedAt,
            validation.request.reason,
          ],
        );
        return mapAdjudicationResult(requireSingleRow(result.rows), validation.request.commandId);
      },
    );
  }

  private async withAdministrator<T>(
    pool: Pool,
    accessToken: string,
    expectedMembershipId: string,
    runtimeRole: typeof TIME_REVIEW_READER_ROLE | typeof TIME_REVIEW_WRITER_ROLE,
    controls: TimeReviewCoordinatorControls,
    operation: (client: PoolClient, actor: ActorRow) => Promise<T>,
  ): Promise<T | { readonly status: 'authority_rejected' | 'unavailable' }> {
    if (typeof accessToken !== 'string' || accessToken.length === 0) {
      return { status: 'authority_rejected' };
    }
    const deadline = controls.deadlineEpochMilliseconds ?? Date.now() + DEFAULT_DEADLINE_MILLISECONDS;
    if (!isBeforeDeadline(deadline)) return { status: 'unavailable' };
    let verification;
    try {
      verification = await this.accessTokenVerifier.verify(accessToken);
    } catch {
      return { status: 'unavailable' };
    }
    if (verification.status === 'rejected') return { status: 'authority_rejected' };

    let client: PoolClient;
    try {
      client = await pool.connect();
    } catch {
      return { status: 'unavailable' };
    }
    let transactionOpen = false;
    let connectionFailure: Error | undefined;
    const onError = (error: Error): void => { connectionFailure ??= error; };
    client.on('error', onError);
    try {
      assertActive(deadline, connectionFailure);
      await client.query('BEGIN ISOLATION LEVEL READ COMMITTED READ WRITE');
      transactionOpen = true;
      await setDeadlines(client, deadline);
      await client.query(`SET LOCAL ROLE ${TIME_REVIEW_IDENTITY_RESOLVER_ROLE}`);
      const authority = await client.query<ActorRow>(
        `SELECT user_id, organization_id, membership_id, membership_role
         FROM taptime_server.lock_request_actor($1, $2)`,
        [verification.identity.issuer, verification.identity.subject],
      );
      const actor = authority.rows.length === 1 ? authority.rows[0] : undefined;
      if (
        actor === undefined
        || actor.membership_role !== 'administrator'
        || actor.membership_id !== expectedMembershipId
      ) {
        await client.query('ROLLBACK');
        transactionOpen = false;
        return { status: 'authority_rejected' };
      }
      await controls.afterAuthorityLocked?.();
      assertActive(deadline, connectionFailure);
      await client.query(
        `SELECT set_config('app.user_id', $1, true),
                set_config('app.organization_id', $2, true),
                set_config('app.membership_id', $3, true),
                set_config('app.membership_role', 'administrator', true)`,
        [actor.user_id, actor.organization_id, actor.membership_id],
      );
      await client.query(`SET LOCAL ROLE ${runtimeRole}`);
      const value = await operation(client, actor);
      await controls.beforeCommit?.();
      assertActive(deadline, connectionFailure);
      await client.query('COMMIT');
      transactionOpen = false;
      return value;
    } catch {
      if (transactionOpen) await rollback(client);
      return { status: 'unavailable' };
    } finally {
      client.off('error', onError);
      client.release(connectionFailure);
    }
  }
}

function mapTimeRecord(row: TimeRecordRow): TimeRecordProjection {
  if (
    row.employee_membership_id === null || row.employee_display_name === null
    || row.customer_id === null || row.customer_display_name === null
    || !isCanonicalTimeReviewUuid(row.employee_membership_id)
    || !isCanonicalTimeReviewUuid(row.customer_id)
  ) throw new Error('Effective time record attribution is incomplete');
  return Object.freeze({
    timeRecordId: row.time_record_id,
    employeeMembershipId: row.employee_membership_id,
    employeeDisplayName: row.employee_display_name,
    customerId: row.customer_id,
    customerDisplayName: row.customer_display_name,
    source: row.source,
    status: row.status,
    startedAt: row.started_at.toISOString(),
    stoppedAt: row.stopped_at?.toISOString() ?? null,
    baseRowVersion: safeInteger(row.base_row_version),
    effectiveRevisionNumber: safeInteger(row.effective_revision_number),
    overlapsAnotherRecord: row.overlaps_another_record,
  });
}

function mapTimeRecordV2(row: TimeRecordRowV2): TimeRecordProjectionV2 {
  if (
    row.employee_membership_id === null
    || row.employee_display_name === null
    || !isCanonicalTimeReviewUuid(row.employee_membership_id)
    || !isCanonicalTimeReviewUuid(row.target_id)
    || (
      row.source === 'canonical'
        ? row.started_via === null
          || (row.status === 'started' ? row.stopped_via !== null : row.stopped_via === null)
        : row.started_via !== null || row.stopped_via !== null
    )
  ) throw new Error('Effective time record v2 attribution is incomplete');
  return Object.freeze({
    timeRecordId: row.time_record_id,
    employeeMembershipId: row.employee_membership_id,
    employeeDisplayName: row.employee_display_name,
    targetType: row.target_type,
    targetId: row.target_id,
    targetDisplayName: row.target_display_name,
    source: row.source,
    status: row.status,
    startedVia: row.started_via,
    stoppedVia: row.stopped_via,
    startedAt: row.started_at.toISOString(),
    stoppedAt: row.stopped_at?.toISOString() ?? null,
    baseRowVersion: safeInteger(row.base_row_version),
    effectiveRevisionNumber: safeInteger(row.effective_revision_number),
    overlapsAnotherRecord: row.overlaps_another_record,
  });
}

function mapReviewItem(row: ReviewItemRow): ReviewItemProjection {
  if (
    row.employee_membership_id === null || row.employee_display_name === null
    || row.customer_id === null || row.customer_display_name === null
    || !isCanonicalTimeReviewUuid(row.employee_membership_id)
    || !isCanonicalTimeReviewUuid(row.customer_id)
  ) throw new Error('Review evidence attribution is incomplete');
  return Object.freeze({
    reviewItemId: row.review_item_id,
    source: row.source_family,
    employeeUserId: row.employee_user_id,
    employeeMembershipId: row.employee_membership_id,
    employeeDisplayName: row.employee_display_name,
    customerId: row.customer_id,
    customerDisplayName: row.customer_display_name,
    occurredAt: row.occurred_at.toISOString(),
    recordedAt: row.recorded_at.toISOString(),
    reviewReason: row.review_reason,
    deviceSequence: row.device_sequence === null ? null : safeInteger(row.device_sequence),
    predecessorBlocked: row.predecessor_blocked,
  });
}

function mapReviewItemV2(row: ReviewItemRowV2): ReviewItemProjectionV2 {
  if (
    row.employee_membership_id === null
    || row.employee_display_name === null
    || !isCanonicalTimeReviewUuid(row.employee_membership_id)
    || !isCanonicalTimeReviewUuid(row.target_id)
  ) throw new Error('Review evidence v2 attribution is incomplete');
  return Object.freeze({
    reviewItemId: row.review_item_id,
    source: row.source_family,
    employeeUserId: row.employee_user_id,
    employeeMembershipId: row.employee_membership_id,
    employeeDisplayName: row.employee_display_name,
    targetType: row.target_type,
    targetId: row.target_id,
    targetDisplayName: row.target_display_name,
    triggerType: row.trigger_type,
    occurredAt: row.occurred_at.toISOString(),
    recordedAt: row.recorded_at.toISOString(),
    reviewReason: row.review_reason,
    deviceSequence: row.device_sequence === null ? null : safeInteger(row.device_sequence),
    predecessorBlocked: row.predecessor_blocked,
  });
}

function mapCorrectionResult(row: CorrectionRow) {
  switch (row.result_status) {
    case 'committed': {
      if (
        row.time_record_id === null || row.revision_number === null
        || row.effective_started_at === null || row.effective_stopped_at === null
      ) throw new Error('Committed correction result is incomplete');
      const value: CorrectedTimeRecord = Object.freeze({
        timeRecordId: row.time_record_id,
        revisionNumber: safeInteger(row.revision_number),
        startedAt: row.effective_started_at.toISOString(),
        stoppedAt: row.effective_stopped_at.toISOString(),
        idempotentRetry: row.idempotent_retry,
      });
      return { status: 'committed' as const, value };
    }
    case 'authority_rejected': return { status: 'authority_rejected' as const };
    case 'not_adjustable': return { status: 'not_adjustable' as const };
    case 'conflict': return { status: 'conflict' as const };
    case 'command_id_conflict': return { status: 'command_id_conflict' as const };
    default: throw new Error('Unknown correction result');
  }
}

function mapAdjudicationResult(row: AdjudicationRow, commandId: string) {
  switch (row.result_status) {
    case 'committed': {
      if (row.adjudicated_review_item_ids === null) {
        throw new Error('Committed adjudication result is incomplete');
      }
      const value: ReviewAdjudicationReceipt = Object.freeze({
        commandId,
        resolution: row.resolution,
        adjudicatedReviewItemIds: Object.freeze(row.adjudicated_review_item_ids),
        timeRecordId: row.time_record_id,
        revisionNumber: row.revision_number === null ? null : safeInteger(row.revision_number),
        idempotentRetry: row.idempotent_retry,
      });
      return { status: 'committed' as const, value };
    }
    case 'authority_rejected': return { status: 'authority_rejected' as const };
    case 'conflict': return { status: 'conflict' as const };
    case 'command_id_conflict': return { status: 'command_id_conflict' as const };
    case 'invalid_evidence': return { status: 'invalid_evidence' as const };
    default: throw new Error('Unknown adjudication result');
  }
}

function digest(request: Parameters<typeof canonicalTimeReviewCommandPayload>[0]): string {
  return createHash('sha256').update(canonicalTimeReviewCommandPayload(request)).digest('hex');
}

function encodeCursor(timestamp: Date, id: string): string {
  return Buffer.from(JSON.stringify([timestamp.toISOString(), id]), 'utf8').toString('base64url');
}

function decodeCursor(value: string | null): CursorValue | null | undefined {
  if (value === null) return null;
  try {
    const decoded: unknown = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    if (
      !Array.isArray(decoded)
      || decoded.length !== 2
      || !isCanonicalTimeReviewTimestamp(decoded[0])
      || !isCanonicalTimeReviewUuid(decoded[1])
    ) return undefined;
    return { recordedAt: decoded[0], id: decoded[1] };
  } catch {
    return undefined;
  }
}

function safeInteger(value: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error('Unsafe database integer');
  return parsed;
}

function requireSingleRow<T>(rows: T[]): T {
  if (rows.length !== 1 || rows[0] === undefined) throw new Error('Expected one database result');
  return rows[0];
}

function isBeforeDeadline(deadline: number): boolean {
  return Number.isSafeInteger(deadline) && deadline > Date.now();
}

function assertActive(deadline: number, failure: Error | undefined): void {
  if (!isBeforeDeadline(deadline) || failure !== undefined) {
    throw failure ?? new Error('Time review deadline exceeded');
  }
}

async function setDeadlines(client: PoolClient, deadline: number): Promise<void> {
  const remaining = deadline - Date.now() - DEADLINE_SAFETY_MILLISECONDS;
  if (remaining < 1) throw new Error('Time review deadline exceeded');
  const value = `${remaining}ms`;
  await client.query(
    `SELECT set_config('lock_timeout', $1, true),
            set_config('statement_timeout', $1, true),
            set_config('transaction_timeout', $1, true)`,
    [value],
  );
}

async function rollback(client: PoolClient): Promise<void> {
  try { await client.query('ROLLBACK'); } catch { /* Preserve the original failure. */ }
}
