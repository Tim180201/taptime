import type { StoppedTimeEntry } from '../TimeEntry';

export interface TimeEntryStopped {
  readonly type: 'TimeEntryStopped';
  readonly timeEntry: StoppedTimeEntry;
}

export function timeEntryStopped(timeEntry: StoppedTimeEntry): TimeEntryStopped {
  return { type: 'TimeEntryStopped', timeEntry };
}
