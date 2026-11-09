import { indexCalendarDays } from '../../src/screens/indexCalendarDays';
import { describe, expect, it } from 'vitest';
import type { MobileOwnTimeQueryResponse, SafeOwnTimeRecord } from '@taptime/mobile-work-contract';
import { businessDay, dayStart, formatDuration, intervalMilliseconds, monthDays,
  provenance, rangeSummary, recordsForDay, shiftDay, shiftMonth, weekStart } from '../../src/screens/ownTimeCalendar';

const record: SafeOwnTimeRecord = { calendar:{asOf:'2026-10-02T00:00:00Z',workDurationSeconds:7200,breakDurationSeconds:0,breakIntervals:[]}, timeRecordId: 'record', source: 'canonical', targetType: 'customer',
  targetDisplayName: 'Werkstatt', status: 'stopped', startedAt: '2026-09-30T21:00:00Z',
  stoppedAt: '2026-09-30T23:00:00Z', startedVia: 'nfc', stoppedVia: 'manual' };
function projection(overrides: Partial<MobileOwnTimeQueryResponse> = {}): MobileOwnTimeQueryResponse {
  return { activeRecord: null, records: [record], nextCursor: null,
    windowStartedAt: '2026-09-01T00:00:00Z', windowEndedAt: '2026-10-02T00:00:00Z', ...overrides };
}
describe('Berlin calendar', () => {
  it('T142: an indexed frame retains Core seconds across DST, month boundaries, pauses and incomplete data', () => {
    const autumn = {...record,timeRecordId:'autumn',startedAt:'2026-10-24T21:30:00Z',stoppedAt:'2026-10-26T00:30:00Z',
      calendar:{asOf:'2026-10-26T01:00:00Z',workDurationSeconds:90_001,breakDurationSeconds:7_199,
        breakIntervals:[{startedAt:'2026-10-25T00:30:00Z',stoppedAt:'2026-10-25T02:30:00Z'}]}};
    const spring = {...autumn,timeRecordId:'spring',startedAt:'2026-03-28T22:30:00Z',stoppedAt:'2026-03-30T00:30:00Z',
      calendar:{...autumn.calendar,breakIntervals:[],workDurationSeconds:93_600,breakDurationSeconds:0}};
    for (const extra of [{}, {nextCursor:'more'}, {records:[record,{...autumn,calendar:undefined}]},
      {activeRecord:{...spring,status:'started' as const,stoppedAt:null,calendar:{...spring.calendar,asOf:spring.stoppedAt!}}}]) {
      const value=projection({records:[record,autumn,spring],windowStartedAt:'2026-03-01T00:00:00Z',windowEndedAt:'2026-11-01T00:00:00Z',...extra});
      const summary=indexCalendarDays(value);
      for(const month of ['2026-03','2026-09','2026-10','2026-11'])for(const day of monthDays(month))if(day){
        expect(summary(day,shiftDay(day,1))).toEqual(rangeSummary(value,day,shiftDay(day,1)));
        expect(summary(weekStart(day),shiftDay(weekStart(day),7))).toEqual(rangeSummary(value,weekStart(day),shiftDay(weekStart(day),7)));
      }
    }
    const old=indexCalendarDays(projection());
    const corrected=indexCalendarDays(projection({records:[{...record,calendar:{...record.calendar!,workDurationSeconds:3600}}]}));
    expect(old('2026-09-30','2026-10-02').milliseconds).toBe(7_200_000);
    expect(corrected('2026-09-30','2026-10-02').milliseconds).toBe(3_600_000);
  });
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
