import { expect, it } from 'vitest';
import * as contract from '../src/index.js';

const at = '2026-10-04T08:30:00.000Z';
const active = {timeRecordId:'10000000-0000-4000-8000-000000000001',source:'canonical',
  targetType:'customer',targetDisplayName:'Kunde X',status:'started',startedAt:'2026-10-04T06:12:00.000Z',
  stoppedAt:null,startedVia:'manual',stoppedVia:null,
  details:{origin:'manual',baseRowVersion:1,effectiveRevisionNumber:0,comment:null,changed:false,change:null,overlapsAnotherRecord:false},
  calendar:{asOf:at,workDurationSeconds:8280,breakDurationSeconds:0,breakIntervals:[]}} as const;
const page = {activeRecord:active,records:[],nextCursor:null,windowStartedAt:'2026-08-31T22:00:00.000Z',windowEndedAt:at};

it('negotiates a strict v2 active capture record without loosening v1', () => {
  const v2={...page,activeRecord:{...active,targetId:'20000000-0000-4000-8000-000000000001',breakStartedAt:at}};
  expect(contract.TIME_CALENDAR_ACCEPT_V2).toBe('application/vnd.taptime.time-calendar.v2+json');
  expect(contract.isCaptureTimeResponse(v2)).toBe(true);
  expect(contract.isCalendarTimeResponse(page)).toBe(true);
  expect(contract.isCalendarTimeResponse(v2)).toBe(false);
  expect(contract.isCaptureTimeResponse(page)).toBe(false);
  expect(contract.isCaptureTimeResponse({...v2,activeRecord:{...v2.activeRecord,breakStartedAt:null}})).toBe(true);
  for (const extra of [{targetId:'foreign'}, {breakStartedAt:'2026-10-04T06:00:00.000Z'},
    {breakStartedAt:'invalid-date'}, {unexpected:true}]) {
    expect(contract.isCaptureTimeResponse({...v2,activeRecord:{...v2.activeRecord,...extra}})).toBe(false);
  }
});

it('accepts the engine-confirmed pause when the source device clock is ahead of the read clock', () => {
  expect(contract.isCaptureTimeResponse({...page,activeRecord:{...active,
    targetId:'20000000-0000-4000-8000-000000000001',breakStartedAt:'2026-10-04T08:31:00.000Z'}})).toBe(true);
});

it('uses newly loaded server durations and pause intervals in confirmed feedback', () => {
  const before={...page,activeRecord:{...active,targetId:'20000000-0000-4000-8000-000000000001',breakStartedAt:'2026-10-04T08:30:00.000Z'}};
  const record={...active,status:'stopped' as const,stoppedAt:'2026-10-04T09:47:00.000Z',stoppedVia:'manual' as const,
    calendar:{asOf:'2026-10-04T09:47:00.000Z',workDurationSeconds:12900,breakDurationSeconds:1320,
      breakIntervals:[{startedAt:'2026-10-04T08:30:00.000Z',stoppedAt:'2026-10-04T08:52:00.000Z'}]}};
  const after={...page,activeRecord:null,records:[record]};
  expect(contract.captureFeedback('time_entry_stopped',before,after)).toBe('Zeit beendet · Kunde X · 08:12–11:47 · 3:35 h');
  expect(contract.captureFeedback('break_stopped',before,after)).toBe('Pause beendet · 10:30–10:52 · 0:22 h');
});
