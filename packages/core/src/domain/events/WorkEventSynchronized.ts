import type { QueuedWorkEventRecord } from '../QueuedWorkEventRecord';

export interface WorkEventSynchronized {
  readonly type: 'WorkEventSynchronized';
  readonly record: QueuedWorkEventRecord;
}

export function workEventSynchronized(record: QueuedWorkEventRecord): WorkEventSynchronized {
  return { type: 'WorkEventSynchronized', record };
}
