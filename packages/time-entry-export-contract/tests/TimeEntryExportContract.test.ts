import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  TIME_ENTRY_EXPORT_GOLDEN_ROWS,
  TIME_ENTRY_EXPORT_HEADERS,
  TIME_ENTRY_EXPORT_HEADERS_V2,
  TIME_ENTRY_EXPORT_MAXIMUM_BYTES,
  TIME_ENTRY_EXPORT_MAXIMUM_RANGE_MILLISECONDS,
  TIME_ENTRY_EXPORT_MAXIMUM_ROWS,
  TimeEntryExportLimitError,
  neutralizeSpreadsheetFormula,
  serializeTimeEntryExportCsv,
  serializeTimeEntryExportCsvV2,
  validateTimeEntryExportRequest,
} from '../src/index.js';

const validRequest = {
  expectedMembershipId: '22222222-2222-4222-8222-222222222222',
  fromInclusive: '2026-07-01T00:00:00.000Z',
  toExclusive: '2026-07-31T00:00:00.000Z',
};

describe('time-entry export contract', () => {
  it('freezes the Human-accepted limits and exact header order', () => {
    expect(TIME_ENTRY_EXPORT_MAXIMUM_RANGE_MILLISECONDS).toBe(2_678_400_000);
    expect(TIME_ENTRY_EXPORT_MAXIMUM_ROWS).toBe(10_000);
    expect(TIME_ENTRY_EXPORT_MAXIMUM_BYTES).toBe(8_388_608);
    expect(TIME_ENTRY_EXPORT_HEADERS).toEqual([
      'schema_version', 'organization_id', 'organization_name', 'time_entry_id',
      'employee_membership_id', 'employee_display_name', 'customer_id',
      'customer_display_name', 'status', 'started_at_utc', 'stopped_at_utc',
      'duration_seconds',
    ]);
  });

  it('accepts only the exact canonical request shape and a positive range of at most 31 days', () => {
    expect(validateTimeEntryExportRequest(validRequest).status).toBe('valid');
    expect(validateTimeEntryExportRequest({
      ...validRequest,
      fromInclusive: '2026-07-01T00:00:00Z',
    }).status).toBe('invalid_request');
    expect(validateTimeEntryExportRequest({
      ...validRequest,
      toExclusive: '2026-08-02T00:00:00.000Z',
    }).status).toBe('invalid_request');
    expect(validateTimeEntryExportRequest({ ...validRequest, organizationId: 'forbidden' }).status)
      .toBe('invalid_request');
    expect(validateTimeEntryExportRequest({
      ...validRequest,
      expectedMembershipId: 'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA',
    }).status).toBe('invalid_request');
  });

  it('produces deterministic UTF-8 BOM, semicolon, quoted RFC-4180 cells and CRLF bytes', () => {
    const first = serializeTimeEntryExportCsv(TIME_ENTRY_EXPORT_GOLDEN_ROWS);
    const second = serializeTimeEntryExportCsv(TIME_ENTRY_EXPORT_GOLDEN_ROWS);
    const text = Buffer.from(first.bytes).toString('utf8');
    expect(Buffer.from(first.bytes).subarray(0, 3).toString('hex')).toBe('efbbbf');
    expect(text).toContain('"schema_version";"organization_id";"organization_name"');
    expect(text).toContain('"\'=Tap; ""Nord"""');
    expect(text).toContain('"\'@Kundschaft"');
    expect(text.endsWith('\r\n')).toBe(true);
    expect(text.replaceAll('\r\n', '').includes('\n')).toBe(false);
    expect(createHash('sha256').update(first.bytes).digest('hex'))
      .toBe(createHash('sha256').update(second.bytes).digest('hex'));
  });

  it('returns a valid header-only CSV for an empty result', () => {
    const result = serializeTimeEntryExportCsv([]);
    expect(result.rowCount).toBe(0);
    expect(Buffer.from(result.bytes).toString('utf8').split('\r\n')).toHaveLength(2);
  });

  it('serializes the exact generalized v2 schema and provenance truth', () => {
    expect(TIME_ENTRY_EXPORT_HEADERS_V2).toEqual([
      'schema_version', 'organization_id', 'organization_name', 'time_entry_id',
      'employee_membership_id', 'employee_display_name', 'record_source',
      'target_type', 'target_id', 'target_display_name', 'status', 'started_via',
      'stopped_via', 'started_at_utc', 'stopped_at_utc', 'duration_seconds',
    ]);
    const result = serializeTimeEntryExportCsvV2([{
      organizationId: '11111111-1111-4111-8111-111111111111',
      organizationName: 'TapTim.e',
      timeEntryId: '22222222-2222-4222-8222-222222222222',
      employeeMembershipId: '33333333-3333-4333-8333-333333333333',
      employeeDisplayName: 'Mitarbeiter',
      recordSource: 'canonical',
      targetType: 'project',
      targetId: '44444444-4444-4444-8444-444444444444',
      targetDisplayName: '=Innenausbau',
      status: 'stopped',
      startedVia: 'manual',
      stoppedVia: 'nfc',
      startedAtUtc: '2026-07-24T08:00:00.000000Z',
      stoppedAtUtc: '2026-07-24T09:00:00.000000Z',
      durationSeconds: '3600',
    }]);
    const text = Buffer.from(result.bytes).toString('utf8');
    expect(text).toContain('"2";');
    expect(text).toContain('"canonical";"project"');
    expect(text).toContain('"\'=Innenausbau"');
    expect(text).toContain('"manual";"nfc"');
  });

  it('rejects false v2 provenance combinations', () => {
    expect(() => serializeTimeEntryExportCsvV2([{
      organizationId: '11111111-1111-4111-8111-111111111111',
      organizationName: 'TapTim.e',
      timeEntryId: '22222222-2222-4222-8222-222222222222',
      employeeMembershipId: '33333333-3333-4333-8333-333333333333',
      employeeDisplayName: '',
      recordSource: 'recovered',
      targetType: 'general_work',
      targetId: '44444444-4444-4444-8444-444444444444',
      targetDisplayName: 'Allgemeine Arbeitszeit',
      status: 'stopped',
      startedVia: 'manual',
      stoppedVia: '',
      startedAtUtc: '2026-07-24T08:00:00.000000Z',
      stoppedAtUtc: '2026-07-24T09:00:00.000000Z',
      durationSeconds: '3600',
    }])).toThrow(/accepted contract/);
  });

  it.each(['=1+1', ' +SUM(A1)', '-2+3', '\t@cmd'])('neutralizes formula prefix %j', (value) => {
    expect(neutralizeSpreadsheetFormula(value)).toBe(`'${value}`);
  });

  it('orders rows by started timestamp and UUID without mutating input', () => {
    const later = {
      ...TIME_ENTRY_EXPORT_GOLDEN_ROWS[0]!,
      timeEntryId: '55555555-5555-4555-8555-555555555555',
      startedAtUtc: '2026-07-22T08:00:00.000000Z',
      stoppedAtUtc: '2026-07-22T09:00:00.000000Z',
      durationSeconds: '3600',
    };
    const input = [later, TIME_ENTRY_EXPORT_GOLDEN_ROWS[0]!];
    const text = Buffer.from(serializeTimeEntryExportCsv(input).bytes).toString('utf8');
    expect(text.indexOf(TIME_ENTRY_EXPORT_GOLDEN_ROWS[0]!.timeEntryId))
      .toBeLessThan(text.indexOf(later.timeEntryId));
    expect(input[0]).toBe(later);
  });

  it('rejects invalid row truth and row overflow', () => {
    expect(() => serializeTimeEntryExportCsv([{
      ...TIME_ENTRY_EXPORT_GOLDEN_ROWS[0]!,
      status: 'started',
    }])).toThrow(/accepted contract/);
    const repeated = Array.from(
      { length: TIME_ENTRY_EXPORT_MAXIMUM_ROWS + 1 },
      () => TIME_ENTRY_EXPORT_GOLDEN_ROWS[0]!,
    );
    expect(() => serializeTimeEntryExportCsv(repeated))
      .toThrow(TimeEntryExportLimitError);
  });
});
