import {expect,it} from 'vitest';
import {isCalendarTimeResponse,isDetailedTimeResponse,validateOwnTimeResponse} from '../src/index';
const record={timeRecordId:'10000000-0000-4000-8000-000000000001',source:'canonical',targetType:'customer',targetDisplayName:'Kunde',status:'stopped',startedAt:'2026-09-23T08:00:00.000Z',stoppedAt:'2026-09-23T09:00:00.000Z',startedVia:'manual',stoppedVia:'manual',details:{origin:'manual',baseRowVersion:2,effectiveRevisionNumber:0,comment:null,changed:false,change:null,overlapsAnotherRecord:false},calendar:{asOf:'2026-09-23T10:00:00.000Z',workDurationSeconds:3599,breakDurationSeconds:0,breakIntervals:[]}};
const page=(r:unknown=record)=>({records:[r],activeRecord:null,nextCursor:null,windowStartedAt:'2026-09-01T00:00:00.000Z',windowEndedAt:'2026-09-23T10:00:00.000Z'});
it('accepts authoritative seconds without recalculating JSON intervals and keeps legacy parsers strict',()=>{
 expect(isCalendarTimeResponse(page())).toBe(true);expect(isDetailedTimeResponse(page())).toBe(false);expect(validateOwnTimeResponse(page())).toBe(false);
 const {calendar,...legacy}=record;expect(isCalendarTimeResponse(page(legacy))).toBe(false);
});
it.each([-1,0.5,Number.MAX_SAFE_INTEGER+1])('rejects invalid work seconds %s',workDurationSeconds=>{
 expect(isCalendarTimeResponse(page({...record,calendar:{...record.calendar,workDurationSeconds}}))).toBe(false);
});
it('rejects unknown keys and breaks outside the effective entry',()=>{
 expect(isCalendarTimeResponse(page({...record,calendar:{...record.calendar,secret:true}}))).toBe(false);
 expect(isCalendarTimeResponse(page({...record,calendar:{...record.calendar,breakIntervals:[{startedAt:record.startedAt,stoppedAt:'2026-09-23T10:00:00.000Z'}]}}))).toBe(false);
});
