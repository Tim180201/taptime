import {expect,it} from 'vitest';
import {resolveTimeFields} from '../src/TimeFields';
it.each([
 ['seconds','2026-09-21T08:00:37.123Z','2026-09-21T09:00:48.987Z','2026-09-21','10:00','11:00'],
 ['autumn fold','2025-10-26T00:30:37.123Z','2025-10-26T01:30:48.987Z','2025-10-26','02:30','02:30'],
 ['spring 23h','2026-03-28T07:00:37.123Z','2026-03-29T06:00:37.123Z','2026-03-28','08:00','08:00'],
])('preserves unchanged %s',(_,originalStart,originalEnd,date,start,end)=>{
 expect(resolveTimeFields({date,start,end,originalStart,originalEnd})).toEqual({startedAt:originalStart,stoppedAt:originalEnd});
});
it('editing only end on an overnight record preserves the start and rolls the end forward',()=>{
 expect(resolveTimeFields({date:'2026-09-21',start:'22:00',end:'07:00',originalStart:'2026-09-21T20:00:37.123Z',originalEnd:'2026-09-22T04:00:48.987Z'})).toEqual({startedAt:'2026-09-21T20:00:37.123Z',stoppedAt:'2026-09-22T05:00:00.000Z'});
});
it.each(['2026-10-25','2026-03-29'])('rejects new ambiguous or nonexistent minutes on %s',date=>{
 expect(resolveTimeFields({date,start:'02:30',end:'04:00'}).startedAt).toBeNull();
});
