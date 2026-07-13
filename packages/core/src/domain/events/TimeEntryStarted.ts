import type { StartedTimeEntry } from '../TimeEntry';

export interface TimeEntryStarted {
  readonly type: 'TimeEntryStarted';
  readonly timeEntry: StartedTimeEntry;
}

export function timeEntryStarted(timeEntry: StartedTimeEntry): TimeEntryStarted {
  return { type: 'TimeEntryStarted', timeEntry };
}
