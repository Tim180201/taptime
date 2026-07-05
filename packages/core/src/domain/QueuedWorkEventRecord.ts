import type { WorkEvent } from './WorkEvent';
import type { BusinessEngineDecision } from '../business/BusinessEngineDecision';
import type { SyncState } from './SyncState';
import type { Timestamp } from './Timestamp';

// References the existing WorkEvent/BusinessEngineDecision by value instead of redefining
// their fields (Extend before Create, EP-008 Ch01 5.4). The WorkEvent's own id is the queue's
// natural identity - no separate queue record id is introduced.
export interface QueuedWorkEventRecord {
  readonly workEvent: WorkEvent;
  readonly decision: BusinessEngineDecision | null;
  readonly syncState: SyncState;
  readonly queuedAt: Timestamp;
}
