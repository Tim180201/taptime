// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { TimeCalendar } from '../src/TimeCalendar';
afterEach(cleanup);
vi.mock('../src/TimeEditingControls',()=>({AddTimeControl:()=>null,TimeRecordControls:()=> <div data-record-controls>Ändern Löschen Kommentar Verlauf</div>}));
vi.mock('../src/TimeVoidControls',()=>({VoidedTimeRows:()=>null}));

const calendarCases=[
 {name:'sections',start:'2026-10-04T06:00:00Z',end:'2026-10-04T10:00:00Z',work:12600,pause:1800,
  breaks:[{startedAt:'2026-10-04T08:00:00Z',stoppedAt:'2026-10-04T08:30:00Z'}],
  lines:['08:00–10:00 · Kunde X · 2:00 h','10:00–10:30 · Pause · 0:30 h','10:30–12:00 · Kunde X · 1:30 h']},
 {name:'midnight',start:'2026-10-03T21:00:00Z',end:'2026-10-04T01:00:00Z',work:3600,pause:10800,
  breaks:[{startedAt:'2026-10-03T21:30:00Z',stoppedAt:'2026-10-04T00:30:00Z'}],
  lines:['00:00–02:30 · Pause · 2:30 h','02:30–03:00 · Kunde X · 0:30 h']},
 {name:'running pause',start:'2026-10-04T06:00:00Z',end:null,work:9000,pause:1800,
  breaks:[{startedAt:'2026-10-04T08:30:00Z',stoppedAt:'2026-10-04T09:00:00Z'}],
  lines:['08:00–10:30 · Kunde X · 2:30 h','seit 10:30 · Pause']},
 {name:'ended pause',start:'2026-10-04T06:00:00Z',end:null,work:9000,pause:1800,breakStartedAt:null,
  breaks:[{startedAt:'2026-10-04T08:30:00Z',stoppedAt:'2026-10-04T09:00:00Z'}],
  lines:['08:00–10:30 · Kunde X · 2:30 h','10:30–11:00 · Pause · 0:30 h']},
 {name:'new pause',start:'2026-10-04T06:00:00Z',end:null,work:10800,pause:0,
  breaks:[{startedAt:'2026-10-04T09:00:00Z',stoppedAt:'2026-10-04T09:00:00Z'}],
  lines:['08:00–11:00 · Kunde X · 3:00 h','seit 11:00 · Pause']},
 {name:'without pause',start:'2026-10-04T06:00:00Z',end:'2026-10-04T10:00:00Z',work:14400,pause:0,breaks:[],lines:[]},
];

it.each(calendarCases)('T116b calendar $name keeps sections chronological and controls once',async scenario=>{
 const record={timeRecordId:'record',source:'canonical' as const,targetType:'customer' as const,targetDisplayName:'Kunde X',
  startedAt:scenario.start,stoppedAt:scenario.end,status:scenario.end===null?'started' as const:'stopped' as const,
  startedVia:'manual' as const,stoppedVia:scenario.end===null?null:'manual' as const,
  breakStartedAt:'breakStartedAt' in scenario?scenario.breakStartedAt:scenario.end===null?scenario.breaks.at(-1)?.startedAt:null,
  calendar:{asOf:'2026-10-04T09:00:00Z',workDurationSeconds:scenario.work,breakDurationSeconds:scenario.pause,breakIntervals:scenario.breaks}};
 const value={activeRecord:scenario.end===null?record:null,records:scenario.end===null?[]:[record],nextCursor:null,
  windowStartedAt:'2026-09-30T22:00:00Z',windowEndedAt:'2026-10-04T10:00:00Z'};
 const {container}=render(<TimeCalendar value={value} month="2026-10" onMonthChange={()=>{}} onRefresh={()=>{}}/>);
 const controls=container.querySelectorAll('[data-record-controls]');expect(controls).toHaveLength(1);
 const group=controls[0]!.closest('li')!;
 expect(group.textContent).not.toContain('0:00 h Pause');
 let previous=-1;
 for(const line of scenario.lines){const index=group.textContent!.indexOf(line);expect(index,line).toBeGreaterThan(previous);previous=index;}
 if(!scenario.breaks.length){expect(group.textContent).toContain('Kunde X');expect(group.textContent).toContain('4:00 h');expect(group.textContent).not.toContain('Pause');}
 expect(group.textContent!.match(/manuell/g)).toHaveLength(1);
});
