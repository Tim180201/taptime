import type { TimeEntry } from '../TimeEntry';

export interface TimeEntryStarted {
  readonly type: 'TimeEntryStarted';
  readonly timeEntry: TimeEntry;
}

export function timeEntryStarted(timeEntry: TimeEntry): TimeEntryStarted {
  return { type: 'TimeEntryStarted', timeEntry };
}
