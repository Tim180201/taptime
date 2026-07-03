import type { WorkEvent } from '../WorkEvent';

export interface WorkEventCreated {
  readonly type: 'WorkEventCreated';
  readonly workEvent: WorkEvent;
}

export function workEventCreated(workEvent: WorkEvent): WorkEventCreated {
  return { type: 'WorkEventCreated', workEvent };
}
