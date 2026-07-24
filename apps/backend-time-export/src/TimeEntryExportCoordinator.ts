import { createHash, randomUUID } from 'node:crypto';
import type { AccessTokenVerifier } from '@taptime/backend-identity';
import {
  TIME_ENTRY_EXPORT_MAXIMUM_ROWS,
  TimeEntryExportLimitError,
  serializeTimeEntryExportCsv,
  serializeTimeEntryExportCsvV2,
  validateTimeEntryExportRequest,
  type TimeEntryExportRow,
  type TimeEntryExportRowV2,
} from '@taptime/time-entry-export-contract';
import type { Pool, PoolClient, QueryResultRow } from 'pg';
import type {
  TimeEntryExportCommand,
  TimeEntryExportCoordinatorControls,
  TimeEntryExportResult,
  TimeEntryExporter,
} from './types.js';

export const DA2_IDENTITY_RESOLVER_ROLE = 'taptime_identity_resolver';
export const DA2_TIME_EXPORTER_ROLE = 'taptime_time_exporter';

const canonicalUuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const DEFAULT_INTERNAL_DEADLINE_MILLISECONDS = 8_000;
const DEADLINE_SAFETY_MILLISECONDS = 100;

interface ResolvedActorRow extends QueryResultRow {
  readonly user_id: string;
  readonly organization_id: string;
  readonly membership_id: string;
  readonly membership_role: string;
}

interface ExportRow extends QueryResultRow {
  readonly organization_id: string | null;
  readonly organization_name: string | null;
  readonly time_entry_id: string;
  readonly employee_membership_id: string | null;
  readonly employee_display_name: string | null;
  readonly customer_id: string | null;
  readonly customer_display_name: string | null;
  readonly status: string;
  readonly started_at_utc: string;
  readonly stopped_at_utc: string | null;
  readonly duration_seconds: string | null;
}

interface ExportRowV2 extends QueryResultRow {
  readonly organization_id: string;
  readonly organization_name: string;
  readonly time_entry_id: string;
  readonly employee_membership_id: string;
  readonly employee_display_name: string;
  readonly record_source: 'canonical' | 'recovered';
  readonly target_type: 'customer' | 'project' | 'general_work';
  readonly target_id: string;
  readonly target_display_name: string;
  readonly status: 'started' | 'stopped';
  readonly started_via: 'nfc' | 'manual' | null;
  readonly stopped_via: 'nfc' | 'manual' | null;
  readonly started_at_utc: string;
  readonly stopped_at_utc: string | null;
  readonly duration_seconds: string | null;
}

export class TimeEntryExportCoordinator implements TimeEntryExporter {
  constructor(
    private readonly pool: Pool,
    private readonly accessTokenVerifier: AccessTokenVerifier,
  ) {}

  async exportTimeEntries(
    command: TimeEntryExportCommand,
    controls: TimeEntryExportCoordinatorControls = {},
  ): Promise<TimeEntryExportResult> {
    return this.exportVersion(command, controls, 1);
  }

  async exportTimeEntriesV2(
    command: TimeEntryExportCommand,
    controls: TimeEntryExportCoordinatorControls = {},
  ): Promise<TimeEntryExportResult> {
    return this.exportVersion(command, controls, 2);
  }

  private async exportVersion(
    command: TimeEntryExportCommand,
    controls: TimeEntryExportCoordinatorControls,
    schemaVersion: 1 | 2,
  ): Promise<TimeEntryExportResult> {
    const validation = validateTimeEntryExportRequest(command.request);
    if (
      validation.status === 'invalid_request'
      || typeof command.accessToken !== 'string'
      || command.accessToken.length === 0
      || !canonicalUuidPattern.test(command.correlationId)
    ) {
      return { status: 'invalid_request' };
    }
    const deadline = controls.deadlineEpochMilliseconds
      ?? Date.now() + DEFAULT_INTERNAL_DEADLINE_MILLISECONDS;
    if (!isBeforeDeadline(deadline)) {
      return { status: 'service_unavailable' };
    }

    let verification;
    try {
      verification = await this.accessTokenVerifier.verify(command.accessToken);
    } catch {
      return { status: 'service_unavailable' };
    }
    if (verification.status === 'rejected') {
      return { status: 'unauthorized' };
    }
    if (!isBeforeDeadline(deadline)) {
      return { status: 'service_unavailable' };
    }

    let client: PoolClient;
    try {
      client = await this.pool.connect();
    } catch {
      return { status: 'service_unavailable' };
    }
    let connectionFailure: Error | undefined;
    const recordConnectionFailure = (error: Error): void => {
      connectionFailure ??= error;
    };
    const assertActive = (): void => {
      if (!isBeforeDeadline(deadline) || connectionFailure !== undefined) {
        throw connectionFailure ?? new Error('DA2 export deadline exceeded');
      }
    };
    client.on('error', recordConnectionFailure);
    let transactionOpen = false;
    try {
      assertActive();
      await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ WRITE');
      transactionOpen = true;
      await setDatabaseDeadlines(client, deadline);
      await client.query(`SET LOCAL ROLE ${DA2_IDENTITY_RESOLVER_ROLE}`);
      const authority = await client.query<ResolvedActorRow>(
        `SELECT user_id, organization_id, membership_id, membership_role
         FROM taptime_server.lock_request_actor($1, $2)`,
        [verification.identity.issuer, verification.identity.subject],
      );
      if (authority.rows.length > 1) {
        throw new Error('Locked identity resolver returned more than one active Membership');
      }
      const actor = authority.rows[0];
      if (actor === undefined) {
        await client.query('ROLLBACK');
        transactionOpen = false;
        return { status: 'unauthorized' };
      }
      if (
        actor.membership_role !== 'administrator'
        || actor.membership_id !== validation.request.expectedMembershipId
      ) {
        await client.query('ROLLBACK');
        transactionOpen = false;
        return { status: 'forbidden' };
      }
      await controls.afterAuthorityLocked?.();
      assertActive();

      await client.query(
        `SELECT
           set_config('app.user_id', $1, true),
           set_config('app.organization_id', $2, true),
           set_config('app.membership_id', $3, true),
           set_config('app.membership_role', 'administrator', true),
           set_config('app.correlation_id', $4, true)`,
        [actor.user_id, actor.organization_id, actor.membership_id, command.correlationId],
      );
      await client.query(`SET LOCAL ROLE ${DA2_TIME_EXPORTER_ROLE}`);

      let serialized;
      try {
        if (schemaVersion === 1) {
          const compatibility = await client.query<{ compatible: boolean }>(
            `SELECT taptime_server.time_entry_export_v1_is_compatible(
               $1::uuid, $2::timestamptz, $3::timestamptz
             ) AS compatible`,
            [
              actor.organization_id,
              validation.request.fromInclusive,
              validation.request.toExclusive,
            ],
          );
          if (compatibility.rows[0]?.compatible !== true) {
            await client.query('ROLLBACK');
            transactionOpen = false;
            return { status: 'export_schema_incompatible' };
          }
          const snapshot = await readV1Snapshot(client, actor, validation.request);
          await controls.afterSnapshotRead?.();
          assertActive();
          if (snapshot.length > TIME_ENTRY_EXPORT_MAXIMUM_ROWS) {
            await client.query('ROLLBACK');
            transactionOpen = false;
            return { status: 'export_limit_exceeded' };
          }
          serialized = serializeTimeEntryExportCsv(
            snapshot.map((row): TimeEntryExportRow => mapExportRow(row, actor)),
          );
        } else {
          const snapshot = await readV2Snapshot(client, actor, validation.request);
          await controls.afterSnapshotRead?.();
          assertActive();
          if (snapshot.length > TIME_ENTRY_EXPORT_MAXIMUM_ROWS) {
            await client.query('ROLLBACK');
            transactionOpen = false;
            return { status: 'export_limit_exceeded' };
          }
          serialized = serializeTimeEntryExportCsvV2(
            snapshot.map((row): TimeEntryExportRowV2 => mapExportRowV2(row, actor)),
          );
        }
      } catch (error) {
        if (error instanceof TimeEntryExportLimitError) {
          await client.query('ROLLBACK');
          transactionOpen = false;
          return { status: 'export_limit_exceeded' };
        }
        throw error;
      }
      const sha256 = createHash('sha256').update(serialized.bytes).digest('hex');
      await controls.beforeAudit?.();
      assertActive();
      await client.query(
        `SELECT taptime_server.append_time_entry_export_audit_v${schemaVersion}(
           $1, $2, $3, $4, $5::timestamptz, $6::timestamptz, $7, $8, $9
         )`,
        [
          randomUUID(),
          actor.organization_id,
          actor.user_id,
          command.correlationId,
          validation.request.fromInclusive,
          validation.request.toExclusive,
          serialized.rowCount,
          serialized.byteCount,
          sha256,
        ],
      );
      await controls.beforeCommit?.();
      assertActive();
      await client.query('COMMIT');
      transactionOpen = false;
      return Object.freeze({
        status: 'succeeded',
        bytes: serialized.bytes,
        byteCount: serialized.byteCount,
        rowCount: serialized.rowCount,
        sha256,
        filename: exportFilename(
          validation.request.fromInclusive,
          validation.request.toExclusive,
          schemaVersion,
        ),
      });
    } catch {
      if (transactionOpen) {
        await rollbackPreservingOriginalError(client);
      }
      return { status: 'service_unavailable' };
    } finally {
      client.off('error', recordConnectionFailure);
      client.release(connectionFailure);
    }
  }
}

async function readV1Snapshot(
  client: PoolClient,
  actor: ResolvedActorRow,
  request: { readonly fromInclusive: string; readonly toExclusive: string },
): Promise<readonly ExportRow[]> {
  const snapshot = await client.query<ExportRow>(
    `SELECT
       entry.organization_id,
       entry.organization_name,
       entry.time_entry_id,
       entry.employee_membership_id,
       entry.employee_display_name,
       entry.customer_id,
       entry.customer_display_name,
       entry.status,
       pg_catalog.to_char(
         entry.started_at AT TIME ZONE 'UTC',
         'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
       ) AS started_at_utc,
       CASE WHEN entry.status = 'stopped' THEN pg_catalog.to_char(
         entry.stopped_at AT TIME ZONE 'UTC',
         'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
       ) END AS stopped_at_utc,
       CASE WHEN entry.status = 'stopped' THEN
         EXTRACT(EPOCH FROM (entry.stopped_at - entry.started_at))::numeric(20, 6)::text
       END AS duration_seconds
     FROM taptime_server.read_effective_time_entry_export_v1(
       $1, $2::timestamptz, $3::timestamptz, $4
     ) AS entry`,
    [
      actor.organization_id,
      request.fromInclusive,
      request.toExclusive,
      TIME_ENTRY_EXPORT_MAXIMUM_ROWS + 1,
    ],
  );
  return snapshot.rows;
}

async function readV2Snapshot(
  client: PoolClient,
  actor: ResolvedActorRow,
  request: { readonly fromInclusive: string; readonly toExclusive: string },
): Promise<readonly ExportRowV2[]> {
  const snapshot = await client.query<ExportRowV2>(
    `SELECT
       entry.organization_id,
       entry.organization_name,
       entry.time_entry_id,
       entry.employee_membership_id,
       entry.employee_display_name,
       entry.record_source,
       entry.target_type,
       entry.target_id,
       entry.target_display_name,
       entry.status,
       entry.started_via,
       entry.stopped_via,
       pg_catalog.to_char(
         entry.started_at AT TIME ZONE 'UTC',
         'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
       ) AS started_at_utc,
       CASE WHEN entry.status = 'stopped' THEN pg_catalog.to_char(
         entry.stopped_at AT TIME ZONE 'UTC',
         'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
       ) END AS stopped_at_utc,
       CASE WHEN entry.status = 'stopped' THEN
         EXTRACT(EPOCH FROM (entry.stopped_at - entry.started_at))::numeric(20, 6)::text
       END AS duration_seconds
     FROM taptime_server.read_effective_time_entry_export_v2(
       $1, $2::timestamptz, $3::timestamptz, $4
     ) AS entry`,
    [
      actor.organization_id,
      request.fromInclusive,
      request.toExclusive,
      TIME_ENTRY_EXPORT_MAXIMUM_ROWS + 1,
    ],
  );
  return snapshot.rows;
}

function mapExportRow(row: ExportRow, actor: ResolvedActorRow): TimeEntryExportRow {
  if (
    row.organization_id === null
    || row.organization_id !== actor.organization_id
    || row.organization_name === null
    || row.employee_membership_id === null
    || row.customer_id === null
    || row.customer_display_name === null
    || (row.status !== 'started' && row.status !== 'stopped')
  ) {
    throw new Error('DA2 export snapshot violates tenant or attribution integrity');
  }
  return Object.freeze({
    organizationId: row.organization_id,
    organizationName: row.organization_name,
    timeEntryId: row.time_entry_id,
    employeeMembershipId: row.employee_membership_id,
    employeeDisplayName: row.employee_display_name ?? '',
    customerId: row.customer_id,
    customerDisplayName: row.customer_display_name,
    status: row.status,
    startedAtUtc: row.started_at_utc,
    stoppedAtUtc: row.stopped_at_utc ?? '',
    durationSeconds: row.duration_seconds ?? '',
  });
}

function mapExportRowV2(
  row: ExportRowV2,
  actor: ResolvedActorRow,
): TimeEntryExportRowV2 {
  if (
    row.organization_id !== actor.organization_id
    || row.organization_name.length === 0
    || row.employee_membership_id.length === 0
    || row.target_display_name.length === 0
  ) {
    throw new Error('DA5 export snapshot violates tenant or attribution integrity');
  }
  return Object.freeze({
    organizationId: row.organization_id,
    organizationName: row.organization_name,
    timeEntryId: row.time_entry_id,
    employeeMembershipId: row.employee_membership_id,
    employeeDisplayName: row.employee_display_name,
    recordSource: row.record_source,
    targetType: row.target_type,
    targetId: row.target_id,
    targetDisplayName: row.target_display_name,
    status: row.status,
    startedVia: row.started_via ?? '',
    stoppedVia: row.stopped_via ?? '',
    startedAtUtc: row.started_at_utc,
    stoppedAtUtc: row.stopped_at_utc ?? '',
    durationSeconds: row.duration_seconds ?? '',
  });
}

function exportFilename(
  fromInclusive: string,
  toExclusive: string,
  schemaVersion: 1 | 2,
): string {
  const sanitize = (value: string): string => value.replaceAll(/[-:.]/g, '');
  const version = schemaVersion === 1 ? '' : '_v2';
  return `taptime-time-entries${version}_${sanitize(fromInclusive)}_${sanitize(toExclusive)}.csv`;
}

function isBeforeDeadline(deadlineEpochMilliseconds: number): boolean {
  return Number.isSafeInteger(deadlineEpochMilliseconds)
    && deadlineEpochMilliseconds > Date.now();
}

async function setDatabaseDeadlines(
  client: PoolClient,
  deadlineEpochMilliseconds: number,
): Promise<void> {
  const remaining = deadlineEpochMilliseconds - Date.now() - DEADLINE_SAFETY_MILLISECONDS;
  if (remaining < 1) {
    throw new Error('DA2 export deadline exceeded');
  }
  const milliseconds = `${remaining}ms`;
  await client.query(
    `SELECT
       set_config('lock_timeout', $1, true),
       set_config('statement_timeout', $1, true),
       set_config('transaction_timeout', $1, true)`,
    [milliseconds],
  );
}

async function rollbackPreservingOriginalError(client: PoolClient): Promise<void> {
  try {
    await client.query('ROLLBACK');
  } catch {
    // Preserve the original authorization, database, deadline or serialization failure.
  }
}
