import { createHash, randomUUID } from 'node:crypto';
import type { AccessTokenVerifier } from '@taptime/backend-identity';
import {
  TIME_ENTRY_EXPORT_MAXIMUM_ROWS,
  TimeEntryExportLimitError,
  serializeTimeEntryExportCsv,
  validateTimeEntryExportRequest,
  type TimeEntryExportRow,
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

export class TimeEntryExportCoordinator implements TimeEntryExporter {
  constructor(
    private readonly pool: Pool,
    private readonly accessTokenVerifier: AccessTokenVerifier,
  ) {}

  async exportTimeEntries(
    command: TimeEntryExportCommand,
    controls: TimeEntryExportCoordinatorControls = {},
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

      const snapshot = await client.query<ExportRow>(
        `SELECT
           organization.id AS organization_id,
           organization.name AS organization_name,
           entry.id AS time_entry_id,
           membership.id AS employee_membership_id,
           membership.display_name AS employee_display_name,
           customer.id AS customer_id,
           customer.display_name AS customer_display_name,
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
         FROM taptime_server.time_entries AS entry
         LEFT JOIN taptime_server.organizations AS organization
           ON organization.id = entry.organization_id
         LEFT JOIN taptime_server.memberships AS membership
           ON membership.organization_id = entry.organization_id
          AND membership.user_id = entry.user_id
         LEFT JOIN taptime_server.customers AS customer
           ON customer.organization_id = entry.organization_id
          AND customer.id = entry.target_customer_id
         WHERE entry.organization_id = $1
           AND entry.started_at >= $2::timestamptz
           AND entry.started_at < $3::timestamptz
         ORDER BY entry.started_at, entry.id
         LIMIT $4`,
        [
          actor.organization_id,
          validation.request.fromInclusive,
          validation.request.toExclusive,
          TIME_ENTRY_EXPORT_MAXIMUM_ROWS + 1,
        ],
      );
      await controls.afterSnapshotRead?.();
      assertActive();
      if (snapshot.rows.length > TIME_ENTRY_EXPORT_MAXIMUM_ROWS) {
        await client.query('ROLLBACK');
        transactionOpen = false;
        return { status: 'export_limit_exceeded' };
      }

      const rows = snapshot.rows.map((row): TimeEntryExportRow => mapExportRow(row, actor));
      let serialized;
      try {
        serialized = serializeTimeEntryExportCsv(rows);
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
        `SELECT taptime_server.append_time_entry_export_audit_v1(
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

function exportFilename(fromInclusive: string, toExclusive: string): string {
  const sanitize = (value: string): string => value.replaceAll(/[-:.]/g, '');
  return `taptime-time-entries_${sanitize(fromInclusive)}_${sanitize(toExclusive)}.csv`;
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
