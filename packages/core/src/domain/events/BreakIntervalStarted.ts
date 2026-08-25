import type { StartedBreakInterval } from '../BreakInterval';

export interface BreakIntervalStarted {
  readonly type: 'BreakIntervalStarted';
  readonly breakInterval: StartedBreakInterval;
}

export function breakIntervalStarted(breakInterval: StartedBreakInterval): BreakIntervalStarted {
  return { type: 'BreakIntervalStarted', breakInterval };
}
