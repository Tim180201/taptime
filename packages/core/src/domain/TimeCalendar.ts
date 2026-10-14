import { BUSINESS_TIME_ZONE } from './BusinessTimeZone';
/** Structural inputs keep Core independent of transport contracts. */
export interface CalendarInterval {
  readonly calendar?: {
    readonly asOf: string;
    readonly workDurationSeconds: number;
    readonly breakDurationSeconds: number;
    readonly breakIntervals: readonly { readonly startedAt: string; readonly stoppedAt: string }[];
  };
  readonly timeRecordId: string;
  readonly startedAt: string;
  readonly stoppedAt: string | null;
  readonly startedVia: 'nfc' | 'manual' | null;
  readonly stoppedVia: 'nfc' | 'manual' | 'administration' | null;
}
export interface CalendarWindow<Record extends CalendarInterval> {
  readonly activeRecord: Record | null;
  readonly records: readonly Record[];
  readonly nextCursor: string | null;
  readonly windowStartedAt: string;
  readonly windowEndedAt: string;
}

const dayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: BUSINESS_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
});
export function businessDay(value: string | number): string {
  const parts = dayFormatter.formatToParts(new Date(value));
  return ['year', 'month', 'day'].map((type) => parts.find((part) => part.type === type)!.value).join('-');
}
export function shiftDay(day: string, offset: number): string {
  const date = new Date(`${day}T12:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}
export function shiftMonth(month: string, offset: number): string {
  const date = new Date(`${month}-01T12:00:00.000Z`);
  date.setUTCMonth(date.getUTCMonth() + offset);
  return date.toISOString().slice(0, 7);
}
/** Berlin midnight is before 00:00 UTC, including on both DST transition days. */
export function dayStart(day: string): number {
  const utcMidnight = Date.parse(`${day}T00:00:00.000Z`);
  const hour = new Intl.DateTimeFormat('en-GB', {
    timeZone: BUSINESS_TIME_ZONE, hour: '2-digit', hourCycle: 'h23',
  }).format(new Date(utcMidnight));
  return utcMidnight - Number(hour) * 3_600_000;
}
export function monthDays(month: string): readonly (string | null)[] {
  const first = `${month}-01`;
  const date = new Date(`${first}T12:00:00.000Z`);
  const leading = (date.getUTCDay() + 6) % 7;
  const days: (string | null)[] = Array.from({ length: leading }, () => null);
  for (let day = first; day.slice(0, 7) === month; day = shiftDay(day, 1)) days.push(day);
  while (days.length % 7 !== 0) days.push(null);
  return days;
}
export function weekStart(day: string): string {
  const weekday = new Date(`${day}T12:00:00.000Z`).getUTCDay();
  return shiftDay(day, -((weekday + 6) % 7));
}
export function timeRecords<Record extends CalendarInterval>(ownTime: CalendarWindow<Record>): readonly Record[] {
  const records = [...ownTime.records];
  if (ownTime.activeRecord && !records.some((record) => record.timeRecordId === ownTime.activeRecord?.timeRecordId)) {
    records.push(ownTime.activeRecord);
  }
  return records;
}
export function intervalMilliseconds(record: CalendarInterval, from: number, to: number): number {
  const start = Math.max(Date.parse(record.startedAt), from);
  const end = Math.min(record.stoppedAt === null ? to : Date.parse(record.stoppedAt), to);
  return Math.max(0, end - start);
}
/** D-095: authoritative seconds are allocated, never recalculated from JSON times. */
function allocateSeconds(total: number, weights: readonly number[]): number[] {
  const sum = weights.reduce((a,b)=>a+BigInt(b),0n);
  if (sum === 0n) return weights.map((_,i)=>i===0?total:0);
  const parts = weights.map((weight,index)=> {
    const product=BigInt(total)*BigInt(weight);
    return {index,seconds:Number(product/sum),remainder:product%sum};
  });
  const rest=total-parts.reduce((a,b)=>a+b.seconds,0);
  const ranked=[...parts].sort((a,b)=>a.remainder===b.remainder?a.index-b.index:a.remainder>b.remainder?-1:1);
  for(let i=0;i<rest;i++) ranked[i]!.seconds++;
  return parts.map(p=>p.seconds);
}
export function calendarDayAllocations(record: CalendarInterval): readonly {day:string;workSeconds:number;breakSeconds:number}[] {
  const data=record.calendar;
  if (!data) return [];
  const start=Date.parse(record.startedAt),end=Date.parse(record.stoppedAt??data.asOf);
  const first=businessDay(start),last=businessDay(Math.max(start,end-1));
  const weights:{day:string;work:number;pause:number}[]=[];
  for(let day=first;day<=last;day=shiftDay(day,1)) {
    const from=Math.max(start,dayStart(day)),to=Math.min(end,dayStart(shiftDay(day,1)));
    const pause=data.breakIntervals.reduce((sum,b)=>sum+Math.max(0,
      Math.min(to,Date.parse(b.stoppedAt))-Math.max(from,Date.parse(b.startedAt))),0);
    weights.push({day,work:Math.max(0,to-from-pause),pause});
  }
  const work=allocateSeconds(data.workDurationSeconds,weights.map(w=>w.work));
  const pauses=allocateSeconds(data.breakDurationSeconds,weights.map(w=>w.pause));
  return weights.map((w,i)=>({day:w.day,workSeconds:work[i]!,breakSeconds:pauses[i]!}));
}
export function recordDaySummary(record: CalendarInterval, day:string) {
  const portion=calendarDayAllocations(record).find(p=>p.day===day);
  return {milliseconds:(portion?.workSeconds??0)*1000,breakMilliseconds:(portion?.breakSeconds??0)*1000};
}
/** Display only: split a day's entry while preserving its allocated server seconds. */
export function recordDaySectionLabels(record: CalendarInterval & {
  readonly targetDisplayName: string; readonly breakStartedAt?: string | null;
}, day: string): readonly string[] {
  if (!record.calendar) return [];
  const from = Math.max(dayStart(day), Date.parse(record.startedAt));
  const to = Math.min(dayStart(shiftDay(day, 1)), Date.parse(record.stoppedAt ?? record.calendar.asOf));
  const breakStart = record.stoppedAt === null && record.breakStartedAt ? Date.parse(record.breakStartedAt) : null;
  const newPause = breakStart !== null && breakStart >= to && businessDay(breakStart) === day;
  const pauses = record.calendar.breakIntervals.map(pause => ({
    from: Math.max(from, Date.parse(pause.startedAt)), to: Math.min(to, Date.parse(pause.stoppedAt)),
  })).filter(pause => pause.to > pause.from).sort((a, b) => a.from - b.from);
  if (!pauses.length && !newPause) return [];
  const sections: { kind: 'work' | 'pause'; from: number; to: number }[] = [];
  let cursor = from;
  for (const pause of pauses) {
    if (pause.from > cursor) sections.push({ kind: 'work', from: cursor, to: pause.from });
    if (pause.to > cursor) sections.push({ kind: 'pause', from: Math.max(cursor, pause.from), to: pause.to });
    cursor = Math.max(cursor, pause.to);
  }
  if (cursor < to) sections.push({ kind: 'work', from: cursor, to });
  const daily = recordDaySummary(record, day);
  const work = allocateSeconds(daily.milliseconds / 1000, sections.map(s => s.kind === 'work' ? s.to - s.from : 0));
  const pause = allocateSeconds(daily.breakMilliseconds / 1000, sections.map(s => s.kind === 'pause' ? s.to - s.from : 0));
  const labels = sections.map((section, index) => {
    const ongoing = record.stoppedAt === null && section.to === Date.parse(record.calendar!.asOf)
      && (section.kind === 'work' || record.breakStartedAt !== null);
    if (section.kind === 'pause' && ongoing && record.breakStartedAt
      && Date.parse(record.breakStartedAt) <= section.to) return `seit ${formatClock(section.from)} · Pause`;
    return `${formatClock(section.from)}–${ongoing && !newPause ? 'läuft' : formatClock(section.to)} · ${section.kind === 'pause' ? 'Pause' : record.targetDisplayName} · ${formatDuration((work[index]! + pause[index]!) * 1000)}`;
  });
  if (newPause) labels.push(`seit ${formatClock(breakStart!)} · Pause`);
  return labels;
}
export function rangeSummary<Record extends CalendarInterval>(ownTime: CalendarWindow<Record>, firstDay: string, endDay: string) {
  const from=dayStart(firstDay),to=Math.min(dayStart(endDay),Date.parse(ownTime.windowEndedAt));
  const records=timeRecords(ownTime);
  const complete=ownTime.nextCursor===null && from>=Date.parse(ownTime.windowStartedAt) && from<to
    && records.every(r=>r.calendar!==undefined);
  const portions=records.flatMap(calendarDayAllocations).filter(p=>p.day>=firstDay && p.day<endDay);
  return {complete,milliseconds:portions.reduce((s,p)=>s+p.workSeconds,0)*1000,
    breakMilliseconds:portions.reduce((s,p)=>s+p.breakSeconds,0)*1000};
}
/** Same inclusion rule as payroll: effective start in the selected month. */
export function monthTimeSummary<Record extends CalendarInterval>(ownTime: CalendarWindow<Record>, month:string) {
  const records=timeRecords(ownTime).filter(r=>businessDay(r.startedAt).slice(0,7)===month);
  return {complete:ownTime.nextCursor===null && dayStart(`${month}-01`)>=Date.parse(ownTime.windowStartedAt)
      && dayStart(`${month}-01`)<Date.parse(ownTime.windowEndedAt) && records.every(r=>r.calendar!==undefined),
    milliseconds:records.reduce((s,r)=>s+(r.calendar?.workDurationSeconds??0),0)*1000,
    breakMilliseconds:records.reduce((s,r)=>s+(r.calendar?.breakDurationSeconds??0),0)*1000};
}
export function recordsForDay<Record extends CalendarInterval>(ownTime: CalendarWindow<Record>, day: string): readonly Record[] {
  const from = dayStart(day);
  const to = Math.min(dayStart(shiftDay(day, 1)), Date.parse(ownTime.windowEndedAt));
  return timeRecords(ownTime).filter((record) => intervalMilliseconds(record, from, to) > 0)
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt));
}
export function formatClock(value: string | number): string {
  return new Intl.DateTimeFormat('de-DE', { timeZone: BUSINESS_TIME_ZONE, hour: '2-digit', minute: '2-digit' })
    .format(new Date(value));
}
/** Display durations in whole minutes; totals and payroll retain their exact seconds. */
export function formatHours(milliseconds: number): string {
  const minutes = Math.floor(Math.max(0, milliseconds) / 60_000);
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')}`;
}
export function formatDuration(milliseconds: number): string {
  return `${formatHours(milliseconds)} h`;
}
/** A quota is an entered number of hours, not an elapsed duration. */
export function formatQuotaHours(seconds: number): string {
  return new Intl.NumberFormat('de-DE', { maximumFractionDigits: 10 }).format(seconds / 3600);
}
export function provenance(record: CalendarInterval): string {
  if (record.startedVia === 'manual' || record.stoppedVia === 'manual') return 'manuell erfasst';
  if (record.startedVia === null) return 'wiederhergestellt';
  return 'gescannt';
}
