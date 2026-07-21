import {
  TIME_ENTRY_EXPORT_HEADERS,
  TIME_ENTRY_EXPORT_MAXIMUM_BYTES,
  TIME_ENTRY_EXPORT_MAXIMUM_ROWS,
  TIME_ENTRY_EXPORT_SCHEMA_VERSION,
} from './constants.js';
import type { SerializedTimeEntryExport, TimeEntryExportRow } from './types.js';
import { isCanonicalTimeEntryExportUuid } from './validation.js';

const outputUtcPattern =
  /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d\.\d{3,6}Z$/;
const durationPattern = /^(?:0|[1-9]\d*)(?:\.\d{1,6})?$/;
const formulaPrefixPattern = /^\s*[=+\-@]/u;

export class TimeEntryExportLimitError extends Error {
  constructor(readonly limit: 'bytes' | 'rows') {
    super(`TimeEntry export exceeds the ${limit} limit`);
  }
}

export class InvalidTimeEntryExportRowError extends Error {
  constructor() {
    super('TimeEntry export row violates the accepted contract');
  }
}

export function serializeTimeEntryExportCsv(
  rows: readonly TimeEntryExportRow[],
): SerializedTimeEntryExport {
  if (rows.length > TIME_ENTRY_EXPORT_MAXIMUM_ROWS) {
    throw new TimeEntryExportLimitError('rows');
  }
  for (const row of rows) {
    assertValidRow(row);
  }
  const orderedRows = [...rows].sort((left, right) => (
    left.startedAtUtc.localeCompare(right.startedAtUtc)
    || left.timeEntryId.localeCompare(right.timeEntryId)
  ));
  const lines = [
    serializeCells(TIME_ENTRY_EXPORT_HEADERS),
    ...orderedRows.map((row) => serializeCells([
      TIME_ENTRY_EXPORT_SCHEMA_VERSION,
      row.organizationId,
      neutralizeSpreadsheetFormula(row.organizationName),
      row.timeEntryId,
      row.employeeMembershipId,
      neutralizeSpreadsheetFormula(row.employeeDisplayName),
      row.customerId,
      neutralizeSpreadsheetFormula(row.customerDisplayName),
      row.status,
      row.startedAtUtc,
      row.stoppedAtUtc,
      row.durationSeconds,
    ])),
  ];
  const bytes = new TextEncoder().encode(`\uFEFF${lines.join('\r\n')}\r\n`);
  if (bytes.byteLength > TIME_ENTRY_EXPORT_MAXIMUM_BYTES) {
    throw new TimeEntryExportLimitError('bytes');
  }
  return Object.freeze({ bytes, byteCount: bytes.byteLength, rowCount: rows.length });
}

export function neutralizeSpreadsheetFormula(value: string): string {
  return formulaPrefixPattern.test(value) ? `'${value}` : value;
}

function serializeCells(cells: readonly string[]): string {
  return cells.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(';');
}

function assertValidRow(row: TimeEntryExportRow): void {
  const stoppedShape = row.status === 'stopped'
    && outputUtcPattern.test(row.stoppedAtUtc)
    && durationPattern.test(row.durationSeconds);
  const startedShape = row.status === 'started'
    && row.stoppedAtUtc === ''
    && row.durationSeconds === '';
  if (
    !isCanonicalTimeEntryExportUuid(row.organizationId)
    || !isCanonicalTimeEntryExportUuid(row.timeEntryId)
    || !isCanonicalTimeEntryExportUuid(row.employeeMembershipId)
    || !isCanonicalTimeEntryExportUuid(row.customerId)
    || !outputUtcPattern.test(row.startedAtUtc)
    || (!startedShape && !stoppedShape)
    || typeof row.organizationName !== 'string'
    || typeof row.employeeDisplayName !== 'string'
    || typeof row.customerDisplayName !== 'string'
  ) {
    throw new InvalidTimeEntryExportRowError();
  }
}
