// Kept identical to the explicit character set in migration 049, independent of SQL locale.
export function hasVisibleText(value: unknown): value is string {
  return typeof value === 'string' && /[^\s\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u206f]/u.test(value);
}

export const CAPTURE_CLOCK_TOLERANCE_MILLISECONDS = 5 * 60 * 1_000;
export const MAXIMUM_EDITED_INTERVAL_MILLISECONDS = 24 * 60 * 60 * 1_000;

export function timeIntervalError(startedAt: string, stoppedAt: string, now = Date.now()): string | null {
  const start = Date.parse(startedAt), stop = Date.parse(stoppedAt);
  if (!Number.isFinite(start) || !Number.isFinite(stop) || stop < start) return 'Das Ende muss nach dem Beginn liegen.';
  if (stop > now) return 'Das Ende liegt in der Zukunft.';
  if (stop - start > MAXIMUM_EDITED_INTERVAL_MILLISECONDS) return 'Höchstens 24 Stunden.';
  return null;
}
