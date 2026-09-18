import { BUSINESS_TIME_ZONE } from '@taptime/core';
import type { MobileOwnTimeQueryResponse, SafeOwnTimeRecord } from '@taptime/mobile-work-contract';

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
export function timeRecords(ownTime: MobileOwnTimeQueryResponse): readonly SafeOwnTimeRecord[] {
  const records = [...ownTime.records];
  if (ownTime.activeRecord && !records.some((record) => record.timeRecordId === ownTime.activeRecord?.timeRecordId)) {
    records.push(ownTime.activeRecord);
  }
  return records;
}
export function intervalMilliseconds(record: SafeOwnTimeRecord, from: number, to: number): number {
  const start = Math.max(Date.parse(record.startedAt), from);
  const end = Math.min(record.stoppedAt === null ? to : Date.parse(record.stoppedAt), to);
  return Math.max(0, end - start);
}
export function rangeSummary(ownTime: MobileOwnTimeQueryResponse, firstDay: string, endDay: string) {
  const from = dayStart(firstDay);
  const to = Math.min(dayStart(endDay), Date.parse(ownTime.windowEndedAt));
  const complete = ownTime.nextCursor === null && from >= Date.parse(ownTime.windowStartedAt) && from < to;
  return { complete, milliseconds: timeRecords(ownTime)
    .reduce((sum, record) => sum + intervalMilliseconds(record, from, to), 0) };
}
export function recordsForDay(ownTime: MobileOwnTimeQueryResponse, day: string): readonly SafeOwnTimeRecord[] {
  const from = dayStart(day);
  const to = Math.min(dayStart(shiftDay(day, 1)), Date.parse(ownTime.windowEndedAt));
  return timeRecords(ownTime).filter((record) => intervalMilliseconds(record, from, to) > 0)
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt));
}
export function formatClock(value: string | number): string {
  return new Intl.DateTimeFormat('de-DE', { timeZone: BUSINESS_TIME_ZONE, hour: '2-digit', minute: '2-digit' })
    .format(new Date(value));
}
export function formatHours(milliseconds: number): string {
  return new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1, minimumFractionDigits: 1 })
    .format(milliseconds / 3_600_000);
}
export function formatDuration(milliseconds: number): string {
  const minutes = Math.floor(milliseconds / 60_000);
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, '0')} h`;
}
export function provenance(record: SafeOwnTimeRecord): string {
  if (record.startedVia === 'manual' || record.stoppedVia === 'manual') return 'manuell erfasst';
  if (record.startedVia === null) return 'wiederhergestellt';
  return 'gescannt';
}
