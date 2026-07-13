import type { WorkEvent } from '../WorkEvent';

export interface DuplicateScanIgnored {
  readonly type: 'DuplicateScanIgnored';
  readonly workEvent: WorkEvent;
  readonly previousWorkEvent: WorkEvent;
}

export function duplicateScanIgnored(
  workEvent: WorkEvent,
  previousWorkEvent: WorkEvent,
): DuplicateScanIgnored {
  return { type: 'DuplicateScanIgnored', workEvent, previousWorkEvent };
}
