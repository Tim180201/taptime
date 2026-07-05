import type { QueuedWorkEventRecord } from '../QueuedWorkEventRecord';

export interface WorkEventQueuedForSync {
  readonly type: 'WorkEventQueuedForSync';
  readonly record: QueuedWorkEventRecord;
}

export function workEventQueuedForSync(record: QueuedWorkEventRecord): WorkEventQueuedForSync {
  return { type: 'WorkEventQueuedForSync', record };
}
