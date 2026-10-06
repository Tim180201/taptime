import { expect, it } from 'vitest';
import { hasVisibleText, timeIntervalError } from '../../src/domain/InputPlausibility';
it('measures elapsed hours across the October clock change',()=>{
  const now=Date.parse('2026-10-26T00:00:00Z');
  expect(timeIntervalError('2026-10-24T12:00:00+02:00','2026-10-25T11:00:00+01:00',now)).toBeNull();
  expect(timeIntervalError('2026-10-24T12:00:00+02:00','2026-10-25T12:00:00+01:00',now)).toBe('Höchstens 24 Stunden.');
  expect(timeIntervalError('2026-10-25T02:30:00+02:00','2026-10-25T02:30:00+01:00',now)).toBeNull();
  expect(timeIntervalError('2026-10-26T00:00:00Z','2026-10-26T00:00:00.001Z',now)).toBe('Das Ende liegt in der Zukunft.');
});
it('requires visible text without changing the evidence',()=>{
  for(const text of ['\t\n\u00a0','\u0001\u007f\u0085','\u200b\ufeff']) expect(hasVisibleText(text)).toBe(false);
  expect(hasVisibleText(' \tBegründung\n ')).toBe(true);
});
