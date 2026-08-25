import type { StoppedBreakInterval } from '../BreakInterval';

export interface BreakIntervalStopped {
  readonly type: 'BreakIntervalStopped';
  readonly breakInterval: StoppedBreakInterval;
}

export function breakIntervalStopped(breakInterval: StoppedBreakInterval): BreakIntervalStopped {
  return { type: 'BreakIntervalStopped', breakInterval };
}
