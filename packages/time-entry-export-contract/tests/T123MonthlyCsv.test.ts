import { describe, expect, it } from 'vitest';
import { serializeTimeEntryExportCsvV5, validateMonthlyExportRequest } from '../src/index.js';
const row = { personIdentifier: '11111111-1111-4111-8111-111111111111', personnelNumber: '001-A',
  employeeDisplayName: 'SYNTHETISCH Anna', month: '09.2026', workDurationSeconds: '3618', workWageType: '001', hasRunningTime: false };
describe('T123 monthly payroll CSV', () => {
  it('uses six German columns, UTF-8 BOM, semicolons, CRLF and half-up rounding after the sum', () => {
    const csv = serializeTimeEntryExportCsvV5([row]);
    expect([...csv.bytes.slice(0, 3)]).toEqual([239, 187, 191]);
    expect(new TextDecoder().decode(csv.bytes)).toBe('"Personalnummer";"Name";"Monat";"Stunden";"Lohnart";"Hinweis"\r\n"001-A";"SYNTHETISCH Anna";"09.2026";"1,01";"001";""\r\n');
    // Two 17-second entries round to 0.00 separately; their sum must round to 0.01.
    expect(new TextDecoder().decode(serializeTimeEntryExportCsvV5([{ ...row, workDurationSeconds: '34' }]).bytes)).toContain('"0,01"');
    for (const [seconds, hours] of [['17', '0,00'], ['18', '0,01'], ['3599', '1,00'], ['3600000', '1000,00']]) {
      expect(new TextDecoder().decode(serializeTimeEntryExportCsvV5([{ ...row, workDurationSeconds: seconds! }]).bytes)).toContain(`"${hours}"`);
    }
  });
  it('preserves both warnings and neutralizes formulas in personnel numbers and names', () => {
    const text = new TextDecoder().decode(serializeTimeEntryExportCsvV5([{ ...row, personnelNumber: null, hasRunningTime: true, employeeDisplayName: '=1+1' }]).bytes);
    expect(text).toContain('"\'=1+1"');
    expect(text).toContain('"Zeit läuft noch; Personalnummer fehlt"');
    expect(new TextDecoder().decode(serializeTimeEntryExportCsvV5([{ ...row, personnelNumber: '-01' }]).bytes)).toContain('"\'-01"');
  });
  it('rejects fractional, negative and invalid seconds instead of silently rounding invalid data', () => {
    for (const workDurationSeconds of ['-1', '1.5', 'NaN', '']) expect(() => serializeTimeEntryExportCsvV5([{ ...row, workDurationSeconds }])).toThrow();
  });
  it('requires a complete Berlin month, including both DST transitions', () => {
    const request = (fromInclusive: string, toExclusive: string) => ({ expectedMembershipId: row.personIdentifier, fromInclusive, toExclusive });
    for (const [from, to] of [['2026-02-28T23:00:00.000Z', '2026-03-31T22:00:00.000Z'], ['2026-09-30T22:00:00.000Z', '2026-10-31T23:00:00.000Z']]) {
      expect(validateMonthlyExportRequest(request(from!, to!)).status).toBe('valid');
    }
    for (const [from, to] of [['2026-09-01T00:00:00.000Z', '2026-10-01T00:00:00.000Z'], ['2026-08-31T22:00:00.000Z', '2026-09-29T22:00:00.000Z'], ['0000-01-01T00:00:00.000Z','0000-02-01T00:00:00.000Z']]) {
      expect(validateMonthlyExportRequest(request(from!, to!)).status).toBe('invalid_request');
    }
  });
});
