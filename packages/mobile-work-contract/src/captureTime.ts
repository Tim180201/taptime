import { isCanonicalUuid, type SafeOwnTimeRecord, type MobileOwnTimeQueryResponse } from './index.js';
import { isCalendarTimeResponse, type DetailedTimeResponse, type DetailedTimeRecord } from './timeSupplement.js';

export const TIME_CALENDAR_ACCEPT_V2 = 'application/vnd.taptime.time-calendar.v2+json';
export type ActiveCaptureRecord = DetailedTimeRecord & {
  readonly targetId: string;
  readonly breakStartedAt: string | null;
};
export interface CaptureTimeResponse extends Omit<DetailedTimeResponse, 'activeRecord'> {
  readonly activeRecord: ActiveCaptureRecord | null;
}

export function isCaptureTimeResponse(value: unknown): value is CaptureTimeResponse {
  if (typeof value !== 'object' || value === null || !('activeRecord' in value)) return false;
  if (value.activeRecord === null) return isCalendarTimeResponse(value);
  if (typeof value.activeRecord !== 'object' || value.activeRecord === null) return false;
  const { targetId, breakStartedAt, ...record } = value.activeRecord as Record<string, unknown>;
  if (!isCanonicalUuid(targetId) || record.status !== 'started' || record.stoppedAt !== null
    || record.stoppedVia !== null || !Object.hasOwn(value.activeRecord, 'breakStartedAt')) return false;
  if (breakStartedAt !== null) {
    if (typeof breakStartedAt !== 'string' || !Number.isFinite(Date.parse(breakStartedAt))
      || new Date(breakStartedAt).toISOString() !== breakStartedAt
      || Date.parse(breakStartedAt) < Date.parse(String(record.startedAt))
      || typeof record.calendar !== 'object' || record.calendar === null
      || !('asOf' in record.calendar)) return false;
  }
  return isCalendarTimeResponse({ ...value, activeRecord: record });
}

export function captureClock(at: string): string {
  return new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit' }).format(new Date(at));
}
export function captureDuration(seconds: number): string {
  const minutes = Math.floor(Math.max(0, seconds) / 60);
  return minutes >= 60 ? `${Math.floor(minutes / 60)} h ${minutes % 60} min` : `${minutes} min`;
}
export function captureStatus(record: SafeOwnTimeRecord): string {
  return `${record.breakStartedAt ? 'Pause' : 'Läuft'} seit ${captureClock(record.breakStartedAt ?? record.startedAt)} · ${record.targetDisplayName}`;
}

/** Success text comes from the refreshed record, never from a client's event clock. */
export function captureFeedback(outcome: string, before: MobileOwnTimeQueryResponse, after: MobileOwnTimeQueryResponse): string | null {
  if (outcome === 'time_entry_started' && after.activeRecord) {
    const record = after.activeRecord;
    return `Zeit gestartet · ${record.targetDisplayName} · ${captureClock(record.startedAt)}`;
  }
  const record = [after.activeRecord, ...after.records].find(r => r !== null && r.timeRecordId === before.activeRecord?.timeRecordId);
  if (outcome === 'time_entry_stopped' && record?.stoppedAt && record.calendar) {
    return `Zeit beendet · ${record.targetDisplayName} · ${captureClock(record.startedAt)}–${captureClock(record.stoppedAt)} · ${captureDuration(record.calendar.workDurationSeconds)}`;
  }
  if (outcome === 'break_started' && record?.breakStartedAt) return `Pause gestartet · ${captureClock(record.breakStartedAt)}`;
  if (outcome === 'break_stopped' && record?.calendar && before.activeRecord?.breakStartedAt) {
    const pause = record.calendar.breakIntervals.find(b => b.startedAt === before.activeRecord!.breakStartedAt);
    if (pause) return `Pause beendet · ${captureClock(pause.startedAt)}–${captureClock(pause.stoppedAt)} · ${captureDuration((Date.parse(pause.stoppedAt) - Date.parse(pause.startedAt)) / 1000)}`;
  }
  return null;
}
