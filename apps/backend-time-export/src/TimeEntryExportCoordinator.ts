import { Readable } from 'node:stream';
import { exportConnection } from './ExportConnection.js';
import { isOrganizationPausedError } from '@taptime/backend-identity';
import { BUSINESS_TIME_ZONE } from '@taptime/core';
import { createHash, randomUUID } from 'node:crypto';
import type { AccessTokenVerifier } from '@taptime/backend-identity';
import {
  TIME_ENTRY_EXPORT_MAXIMUM_ROWS,
  TIME_ENTRY_EXPORT_MAXIMUM_BYTES,
  TIME_ENTRY_EXPORT_DEADLINE_MILLISECONDS,
  TimeEntryExportLimitError,
  serializeTimeEntryExportCsv,
  serializeTimeEntryExportCsvV2,
  serializeTimeEntryExportCsvV3,
  serializeTimeEntryExportCsvV4,
  serializeTimeEntryExportCsvV5,
  validateMonthlyExportRequest,
  validateTimeEntryExportRequest,
  type TimeEntryExportRow,
  type TimeEntryExportRowV2,
  type TimeEntryExportRowV3,
} from '@taptime/time-entry-export-contract';
import type { Pool, Client, QueryResultRow } from 'pg';
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
const DEFAULT_INTERNAL_DEADLINE_MILLISECONDS = TIME_ENTRY_EXPORT_DEADLINE_MILLISECONDS;
const EXPORT_BATCH_ROWS = 1_000;

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
  readonly stopped_via: 'nfc' | 'manual' | 'administration' | null;
  readonly started_at_utc: string;
  readonly stopped_at_utc: string | null;
  readonly duration_seconds: string | null;
}

interface ExportRowV3 extends QueryResultRow {
  readonly organization_id: string;
  readonly time_entry_id: string;
  readonly employee_membership_id: string;
  readonly employee_display_name: string;
  readonly target_type: 'customer' | 'project' | 'general_work';
  readonly target_display_name: string;
  readonly status: 'started' | 'stopped';
  readonly started_via: 'nfc' | 'manual';
  readonly stopped_via: 'nfc' | 'manual' | 'administration' | null;
  readonly local_date: string;
  readonly started_at_local: string;
  readonly stopped_at_local: string | null;
  readonly started_at_utc: string;
  readonly stopped_at_utc: string | null;
  readonly break_duration_seconds: string;
  readonly effective_work_duration_seconds: string;
  readonly effective_revision_number: string;
}

export class TimeEntryExportCoordinator implements TimeEntryExporter {
  constructor(
    private readonly pool: Pool,
    private readonly accessTokenVerifier: AccessTokenVerifier,
    private readonly connect = exportConnection,
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

  async exportTimeEntriesV3(
    command: TimeEntryExportCommand,
    controls: TimeEntryExportCoordinatorControls = {},
  ): Promise<TimeEntryExportResult> {
    return this.exportVersion(command, controls, 3);
  }

  async exportTimeEntriesV4(command: TimeEntryExportCommand, controls: TimeEntryExportCoordinatorControls = {}): Promise<TimeEntryExportResult> {
    return this.exportVersion(command, controls, 4);
  }

  async exportTimeEntriesV5(command: TimeEntryExportCommand, controls: TimeEntryExportCoordinatorControls = {}): Promise<TimeEntryExportResult> {
    return this.exportVersion(command, controls, 5);
  }

  private async exportVersion(
    command: TimeEntryExportCommand,
    controls: TimeEntryExportCoordinatorControls,
    schemaVersion: 1 | 2 | 3 | 4 | 5,
  ): Promise<TimeEntryExportResult> {
    const validation = schemaVersion === 5 ? validateMonthlyExportRequest(command.request) : validateTimeEntryExportRequest(command.request);
    if (validation.status === 'invalid_request' || typeof command.accessToken !== 'string'
      || command.accessToken.length === 0 || !canonicalUuidPattern.test(command.correlationId)) {
      return { status: 'invalid_request' };
    }
    const request = validation.request;
    const deadline = Math.min(controls.deadlineEpochMilliseconds ?? Infinity,
      Date.now() + DEFAULT_INTERNAL_DEADLINE_MILLISECONDS);
    if (!isBeforeDeadline(deadline) || controls.signal?.aborted) return { status: 'service_unavailable' };
    const cancelled = new AbortController();
    const signal = AbortSignal.any([cancelled.signal, AbortSignal.timeout(Math.max(0, deadline - Date.now())),
      ...(controls.signal ? [controls.signal] : [])]);
    let session: Awaited<ReturnType<typeof exportConnection>> | undefined;
    let transactionOpen = false, transferred = false;
    let closing: Promise<void> | undefined;
    const close = () => closing ??= session?.close(transactionOpen) ?? Promise.resolve();
    try {
      const verification = await this.accessTokenVerifier.verify(command.accessToken);
      if (verification.status === 'rejected') return { status: 'unauthorized' };
      if (signal.aborted) return { status: 'service_unavailable' };
      session = await this.connect(this.pool, signal);
      const { client, assertActive } = session;
      await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ WRITE'); transactionOpen = true;
      await setDatabaseDeadlines(client, deadline);
      await client.query(`SET LOCAL ROLE ${DA2_IDENTITY_RESOLVER_ROLE}`);
      const authority = await client.query<ResolvedActorRow>(
        `SELECT user_id, organization_id, membership_id, membership_role
         FROM taptime_server.lock_request_actor($1, $2)`,
        [verification.identity.issuer, verification.identity.subject]);
      if (authority.rows.length > 1) throw new Error('Ambiguous export authority');
      const actor = authority.rows[0];
      if (!actor) return { status: 'unauthorized' };
      if (actor.membership_role !== 'administrator' || actor.membership_id !== request.expectedMembershipId) {
        return { status: 'forbidden' };
      }
      await controls.afterAuthorityLocked?.(); assertActive();
      await client.query(`SELECT set_config('app.user_id',$1,true),set_config('app.organization_id',$2,true),
        set_config('app.membership_id',$3,true),set_config('app.membership_role','administrator',true),set_config('app.correlation_id',$4,true)`,
      [actor.user_id, actor.organization_id, actor.membership_id, command.correlationId]);
      await client.query(`SET LOCAL ROLE ${DA2_TIME_EXPORTER_ROLE}`);
      if (schemaVersion === 1) {
        const compatible = await client.query<{ compatible: boolean }>(
          'SELECT taptime_server.time_entry_export_v1_is_compatible($1,$2,$3) compatible',
          [actor.organization_id, request.fromInclusive, request.toExclusive]);
        if (!compatible.rows[0]?.compatible) return { status: 'export_schema_incompatible' };
      }
      const count = (await client.query<{ count: number }>(
        'SELECT taptime_server.read_time_entry_export_size_v1($1,$2,$3) AS count',
        [actor.organization_id, request.fromInclusive, request.toExclusive])).rows[0]!.count;
      if (count > TIME_ENTRY_EXPORT_MAXIMUM_ROWS) return { status: 'export_limit_exceeded' };
      const query = schemaVersion === 5 ? {
        text: 'SELECT * FROM taptime_server.read_effective_time_entry_export_v5($1,$2,$3)',
        values: [actor.organization_id, request.fromInclusive, request.toExclusive],
      } : schemaVersion === 1 ? readV1Query(actor, request)
        : schemaVersion === 2 ? readV2Query(actor, request) : readV3Query(actor, request, schemaVersion);
      await client.query('DECLARE time_export NO SCROLL CURSOR FOR ' + query.text, query.values);
      await controls.afterSnapshotRead?.(); assertActive();
      const filename = exportFilename(request.fromInclusive, request.toExclusive, schemaVersion);
      const empty = schemaVersion === 1 ? serializeTimeEntryExportCsv([]) : schemaVersion === 2
        ? serializeTimeEntryExportCsvV2([]) : schemaVersion === 3 ? serializeTimeEntryExportCsvV3([])
          : schemaVersion === 4 ? serializeTimeEntryExportCsvV4([]) : serializeTimeEntryExportCsvV5([]);
      const hash = createHash('sha256');
      let rowCount = 0, sourceRowCount = 0, byteCount = 0, sha256 = '';
      // Keep only bounded batches. The final batch is released after the audit
      // commits, so a failed transaction cannot look like a completed CSV download.
      async function* chunks() {
        let pending = empty.bytes;
        try {
          for (;;) {
            assertActive();
            const rows = (await client.query(`FETCH FORWARD ${EXPORT_BATCH_ROWS} FROM time_export`)).rows;
            if (!rows.length) break;
            let serialized;
            if (schemaVersion === 1) serialized = serializeTimeEntryExportCsv(rows.map(row => mapExportRow(row as ExportRow, actor!)));
            else if (schemaVersion === 2) serialized = serializeTimeEntryExportCsvV2(rows.map(row => mapExportRowV2(row as ExportRowV2, actor!)));
            else if (schemaVersion === 3) serialized = serializeTimeEntryExportCsvV3(rows.map(row => mapExportRowV3(row as ExportRowV3, actor!)));
            else if (schemaVersion === 5) {
              serialized = serializeTimeEntryExportCsvV5(rows.map(row => {
                const sourceCount = Number(row.source_row_count);
                if (row.organization_id !== actor!.organization_id || !Number.isSafeInteger(sourceCount) || sourceCount < 1) {
                  throw new Error('Monthly export violates tenant or source integrity');
                }
                sourceRowCount += sourceCount;
                return { personIdentifier: row.employee_membership_id, personnelNumber: row.personnel_number,
                  employeeDisplayName: row.employee_display_name, month: row.payroll_month,
                  workDurationSeconds: row.work_duration_seconds, workWageType: row.work_wage_type, hasRunningTime: row.has_running_time };
              }));
            } else {
              serialized = serializeTimeEntryExportCsvV4(rows.map(row => {
                if (!['nfc','manual','backfilled','recovered'].includes(row.origin)
                  || typeof row.changed !== 'boolean'
                  || (row.comment !== null && typeof row.comment !== 'string')) throw new Error('Missing export details');
                return { ...mapExportRowV3(row as ExportRowV3, actor!),
                  origin: row.origin as 'nfc'|'manual'|'backfilled'|'recovered', changed: row.changed, comment: row.comment };
              }));
            }
            const bytes = serialized.bytes.subarray(empty.byteCount);
            rowCount += rows.length;
            if (rowCount > TIME_ENTRY_EXPORT_MAXIMUM_ROWS || byteCount + pending.byteLength + bytes.byteLength > TIME_ENTRY_EXPORT_MAXIMUM_BYTES) {
              throw new TimeEntryExportLimitError('bytes');
            }
            hash.update(pending); byteCount += pending.byteLength;
            yield pending;
            pending = bytes;
          }
          assertActive();
          if ((schemaVersion === 5 ? sourceRowCount : rowCount) !== count) throw new Error('Export snapshot count changed');
          hash.update(pending); byteCount += pending.byteLength; sha256 = hash.digest('hex');
          await controls.beforeAudit?.(); assertActive();
          await client.query(`SELECT taptime_server.append_time_entry_export_audit_v${schemaVersion}($1,$2,$3,$4,$5::timestamptz,$6::timestamptz,$7,$8,$9)`,
            [randomUUID(), actor!.organization_id, actor!.user_id, command.correlationId,
              request.fromInclusive, request.toExclusive, rowCount, byteCount, sha256]);
          await controls.beforeCommit?.(); assertActive();
          await client.query('COMMIT'); transactionOpen = false;
          yield pending;
        } finally { await close(); }
      }
      if (controls.streamResponse) {
        const stream = Readable.from(chunks(), { objectMode: false, highWaterMark: 64 * 1024, signal });
        // A deadline can win before HTTP attaches its pipeline. Preserve cleanup
        // without an unhandled error; consumers still receive the stream error.
        stream.on('error', () => {});
        // Also covers a response destroyed before the generator's first next().
        stream.once('close', () => { if (transactionOpen) cancelled.abort(); void close(); });
        transferred = true;
        return { status: 'streaming', stream, filename };
      }
      // Existing in-process consumers retain their byte result. HTTP always opts
      // into the bounded stream; no month-sized array or CSV exists on that path.
      const buffers: Uint8Array[] = [];
      for await (const bytes of chunks()) buffers.push(bytes);
      return Object.freeze({ status: 'succeeded', bytes: Buffer.concat(buffers), byteCount, rowCount, sha256, filename });
    } catch (error) {
      if (isOrganizationPausedError(error)) throw error;
      if (error instanceof TimeEntryExportLimitError) return { status: 'export_limit_exceeded' };
      return { status: 'service_unavailable' };
    } finally { if (!transferred) await close(); }
  }
}

function readV1Query(
  actor: ResolvedActorRow,
  request: { readonly fromInclusive: string; readonly toExclusive: string },
): { text: string; values: unknown[] } {
  return { text:
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
    values: [
      actor.organization_id,
      request.fromInclusive,
      request.toExclusive,
      TIME_ENTRY_EXPORT_MAXIMUM_ROWS + 1,
    ],
  };
}

function readV2Query(
  actor: ResolvedActorRow,
  request: { readonly fromInclusive: string; readonly toExclusive: string },
): { text: string; values: unknown[] } {
  return { text:
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
    values: [
      actor.organization_id,
      request.fromInclusive,
      request.toExclusive,
      TIME_ENTRY_EXPORT_MAXIMUM_ROWS + 1,
    ],
  };
}

function readV3Query(
  actor: ResolvedActorRow,
  request: { readonly fromInclusive: string; readonly toExclusive: string },
  version: 3 | 4,
): { text: string; values: unknown[] } {
  return { text:
    `SELECT
       entry.organization_id,
       entry.time_entry_id,
       entry.employee_membership_id,
       entry.employee_display_name,
       entry.target_type,
       entry.target_display_name,
       entry.status,
       entry.started_via,
       entry.stopped_via,
       pg_catalog.to_char(
         entry.started_at AT TIME ZONE $5, 'YYYY-MM-DD'
       ) AS local_date,
       pg_catalog.to_char(
         entry.started_at AT TIME ZONE $5, 'HH24:MI:SS.US'
       ) AS started_at_local,
       CASE WHEN entry.status = 'stopped' THEN pg_catalog.to_char(
         entry.stopped_at AT TIME ZONE $5, 'HH24:MI:SS.US'
       ) END AS stopped_at_local,
       pg_catalog.to_char(
         entry.started_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
       ) AS started_at_utc,
       CASE WHEN entry.status = 'stopped' THEN pg_catalog.to_char(
         entry.stopped_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'
       ) END AS stopped_at_utc,
       entry.break_duration_seconds::text,
       entry.effective_work_duration_seconds::text,
       entry.effective_revision_number::text${version === 4 ? ', entry.origin, entry.changed, entry.comment' : ''}
     FROM taptime_server.read_effective_time_entry_export_v${version}(
       $1, $2::timestamptz, $3::timestamptz, $4
     ) AS entry`,
    values: [
      actor.organization_id,
      request.fromInclusive,
      request.toExclusive,
      TIME_ENTRY_EXPORT_MAXIMUM_ROWS + 1,
      BUSINESS_TIME_ZONE,
    ],
  };
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
    stoppedVia: row.stopped_via === 'administration' ? 'manual' : row.stopped_via ?? '',
    startedAtUtc: row.started_at_utc,
    stoppedAtUtc: row.stopped_at_utc ?? '',
    durationSeconds: row.duration_seconds ?? '',
  });
}

function mapExportRowV3(
  row: ExportRowV3,
  actor: ResolvedActorRow,
): TimeEntryExportRowV3 {
  if (
    row.organization_id !== actor.organization_id
    || row.employee_membership_id.length === 0
    || row.target_display_name.length === 0
    || row.effective_work_duration_seconds.length === 0
  ) {
    throw new Error('T-013 export snapshot violates tenant or payroll attribution integrity');
  }
  return Object.freeze({
    personIdentifier: row.employee_membership_id,
    employeeDisplayName: row.employee_display_name,
    timeEntryId: row.time_entry_id,
    localDate: row.local_date,
    startedAtLocal: row.started_at_local,
    stoppedAtLocal: row.stopped_at_local ?? '',
    startedAtUtc: row.started_at_utc,
    stoppedAtUtc: row.stopped_at_utc ?? '',
    breakDurationSeconds: row.break_duration_seconds,
    effectiveWorkDurationSeconds: row.effective_work_duration_seconds,
    targetType: row.target_type,
    targetDisplayName: row.target_display_name,
    startedVia: row.started_via,
    stoppedVia: row.stopped_via === 'administration' ? 'manual' : row.stopped_via ?? '',
    revisionNumber: row.effective_revision_number,
  });
}

function exportFilename(
  fromInclusive: string,
  toExclusive: string,
  schemaVersion: 1 | 2 | 3 | 4 | 5,
): string {
  const sanitize = (value: string): string => value.replaceAll(/[-:.]/g, '');
  const version = schemaVersion === 1 ? '' : `_v${schemaVersion}`;
  return `taptime-time-entries${version}_${sanitize(fromInclusive)}_${sanitize(toExclusive)}.csv`;
}

function isBeforeDeadline(deadlineEpochMilliseconds: number): boolean {
  return Number.isSafeInteger(deadlineEpochMilliseconds)
    && deadlineEpochMilliseconds > Date.now();
}

async function setDatabaseDeadlines(
  client: Client,
  deadlineEpochMilliseconds: number,
): Promise<void> {
  const remaining = deadlineEpochMilliseconds - Date.now();
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
