import { describe, expect, it } from 'vitest';
import type { MobileOwnTimeQueryResponse, SafeOwnTimeRecord } from '@taptime/mobile-work-contract';
import { businessDay, dayStart, formatDuration, intervalMilliseconds, monthDays,
  provenance, rangeSummary, recordsForDay, shiftMonth, weekStart } from '../../src/screens/ownTimeCalendar';

const record: SafeOwnTimeRecord = { calendar:{asOf:'2026-10-02T00:00:00Z',workDurationSeconds:7200,breakDurationSeconds:0,breakIntervals:[]}, timeRecordId: 'record', source: 'canonical', targetType: 'customer',
  targetDisplayName: 'Werkstatt', status: 'stopped', startedAt: '2026-09-30T21:00:00Z',
  stoppedAt: '2026-09-30T23:00:00Z', startedVia: 'nfc', stoppedVia: 'manual' };
function projection(overrides: Partial<MobileOwnTimeQueryResponse> = {}): MobileOwnTimeQueryResponse {
  return { activeRecord: null, records: [record], nextCursor: null,
    windowStartedAt: '2026-09-01T00:00:00Z', windowEndedAt: '2026-10-02T00:00:00Z', ...overrides };
}
describe('Berlin calendar', () => {
  it('assigns the same UTC instant to the Berlin month and week, independently of device time', () => {
    expect(businessDay('2026-09-30T22:30:00Z')).toBe('2026-10-01');
    expect(weekStart('2026-10-01')).toBe('2026-09-28');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(monthDays('2028-02').filter((day) => day !== null).at(-1)).toBe('2028-02-29');
    expect(monthDays('2026-09').slice(0, 3)).toEqual([null, '2026-09-01', '2026-09-02']);
  });
  it.each([
    ['2026-03-29', '2026-03-30', '2026-03-28T23:00:00.000Z', 23],
    ['2026-10-25', '2026-10-26', '2026-10-24T22:00:00.000Z', 25],
  ] as const)('counts actual elapsed time on %s', (day, next, start, hours) => {
    expect(new Date(dayStart(day)).toISOString()).toBe(start);
    expect(dayStart(next) - dayStart(day)).toBe(hours * 3_600_000);
    const entry = { ...record, startedAt: start, stoppedAt: new Date(dayStart(next)).toISOString() };
    expect(intervalMilliseconds(entry, dayStart(day), dayStart(next))).toBe(hours * 3_600_000);
  });
  it('splits an interval crossing a Berlin month boundary without double counting', () => {
    const september = rangeSummary(projection(), '2026-09-30', '2026-10-01');
    const october = rangeSummary(projection(), '2026-10-01', '2026-10-02');
    expect(september).toEqual({ complete: true, milliseconds: 3_600_000, breakMilliseconds: 0 });
    expect(october).toEqual({ complete: true, milliseconds: 3_600_000, breakMilliseconds: 0 });
    expect(recordsForDay(projection(), '2026-10-01')).toEqual([record]);
    expect(formatDuration(september.milliseconds + october.milliseconds)).toBe('2:00 h');
    expect(provenance(record)).toBe('manuell erfasst');
  });
  it('never represents missing pages or dates outside the supplied window as a complete zero', () => {
    expect(rangeSummary(projection({ nextCursor: 'more' }), '2026-09-30', '2026-10-01').complete).toBe(false);
    expect(rangeSummary(projection(), '2026-08-31', '2026-09-01').complete).toBe(false);
    expect(rangeSummary(projection(), '2026-10-03', '2026-10-04').complete).toBe(false);
  });
  it('clips running records to the server snapshot and includes an active record only once', () => {
    const active = { ...record, calendar:{asOf:'2026-09-30T22:30:00Z',workDurationSeconds:5400,breakDurationSeconds:0,breakIntervals:[]}, stoppedAt: null, status: 'started' as const };
    const ownTime = projection({ records: [active], activeRecord: active, windowEndedAt: '2026-09-30T22:30:00Z' });
    expect(rangeSummary(ownTime, '2026-10-01', '2026-10-02').milliseconds).toBe(30 * 60_000);
  });
});
