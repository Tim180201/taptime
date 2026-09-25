import {expect,it} from 'vitest';
import {calendarDayAllocations,monthTimeSummary,rangeSummary,type CalendarInterval} from '../../src/domain/TimeCalendar';
const entry=(changes:Partial<CalendarInterval>={}):CalendarInterval=>({timeRecordId:'one',startedAt:'2026-09-20T22:59:58.900+02:00',stoppedAt:'2026-09-21T01:00:00.200+02:00',startedVia:'nfc',stoppedVia:'nfc',calendar:{asOf:'2026-09-22T12:00:00.000Z',workDurationSeconds:7200,breakDurationSeconds:1,breakIntervals:[{startedAt:'2026-09-20T23:59:59.050+02:00',stoppedAt:'2026-09-21T00:00:00.150+02:00'}]},...changes});
it('D-095 distributes the 7200-second midnight example without inventing a second',()=>{
 const days=calendarDayAllocations(entry());expect(days).toEqual([{day:'2026-09-20',workSeconds:3600,breakSeconds:1},{day:'2026-09-21',workSeconds:3600,breakSeconds:0}]);
});
it('ties give the earlier day the remainder; one-day entries use the authoritative total',()=>{
 const r=entry({startedAt:'2026-09-20T23:00:00+02:00',stoppedAt:'2026-09-21T01:00:00+02:00',calendar:{asOf:'2026-09-22T00:00:00Z',workDurationSeconds:5,breakDurationSeconds:0,breakIntervals:[]}});
 expect(calendarDayAllocations(r).map(d=>d.workSeconds)).toEqual([3,2]);
 expect(calendarDayAllocations({...r,stoppedAt:'2026-09-20T23:00:00.001+02:00'}).map(d=>d.workSeconds)).toEqual([5]);
});
it.each([['2026-10-25T00:00:00+02:00','2026-10-27T00:00:00+01:00',25,24],['2027-03-28T00:00:00+01:00','2027-03-30T00:00:00+02:00',23,24]] as const)('uses Berlin DST days for %s', (startedAt,stoppedAt,a,b)=>{
 const r=entry({startedAt,stoppedAt,calendar:{asOf:stoppedAt,workDurationSeconds:(a+b)*3600,breakDurationSeconds:0,breakIntervals:[]}});
 expect(calendarDayAllocations(r).map(d=>d.workSeconds)).toEqual([a*3600,b*3600]);
});
it('zero JSON weights retain SQL seconds on the start day, including separately floored fractional pauses',()=>{
 const r=entry({startedAt:'2026-09-20T23:59:59.999+02:00',stoppedAt:'2026-09-21T00:00:00.000+02:00',calendar:{asOf:'2026-09-21T00:00:00.000+02:00',workDurationSeconds:1,breakDurationSeconds:0,breakIntervals:[{startedAt:'2026-09-20T23:59:59.999+02:00',stoppedAt:'2026-09-21T00:00:00.000+02:00'}]}});
 expect(calendarDayAllocations(r)).toEqual([{day:'2026-09-20',workSeconds:1,breakSeconds:0}]);
});
it('running entry uses its server asOf, not the query window or device clock',()=>{
 const r=entry({stoppedAt:null,calendar:{asOf:'2026-09-21T01:00:00.200+02:00',workDurationSeconds:7200,breakDurationSeconds:1,breakIntervals:entry().calendar!.breakIntervals}});
 const value={records:[],activeRecord:r,nextCursor:null,windowStartedAt:'2026-09-01T00:00:00Z',windowEndedAt:'2026-10-01T00:00:00Z'};
 expect(monthTimeSummary(value,'2026-09').milliseconds).toBe(7200000);
 expect(rangeSummary(value,'2026-09-21','2026-09-22').milliseconds).toBe(3600000);
});
it('month attribution is effective start, never clipped interval arithmetic',()=>{
 const r=entry({startedAt:'2026-09-30T23:00:00+02:00',stoppedAt:'2026-10-01T01:00:00+02:00'});
 const value={records:[r],activeRecord:null,nextCursor:null,windowStartedAt:'2026-08-31T22:00:00Z',windowEndedAt:'2026-11-01T00:00:00Z'};
 expect(monthTimeSummary(value,'2026-09').milliseconds).toBe(7200000);expect(monthTimeSummary(value,'2026-10').milliseconds).toBe(0);
});
