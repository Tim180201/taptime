import { expect, it } from 'vitest';
import { parseEditedZonedMinute, toZonedMinuteInput, formatZonedDateTime } from '../../src/domain/BusinessLocalTime';
it.each(['2026-09-23T10:00:37.123456Z','2026-10-25T00:30:37.123Z','2026-10-25T01:30:37.987Z'])('preserves an unchanged minute as the exact original %s', original=>{
  expect(parseEditedZonedMinute(toZonedMinuteInput(original),original)).toBe(original);
});
it.each(['2026-10-25T02:31','2027-03-28T02:30'])('rejects newly entered ambiguous or nonexistent %s',value=>{
  expect(parseEditedZonedMinute(value,'2026-10-25T00:30:37.123Z')).toBeNull();
});
it('changes only the edited minute and presents ordinary Berlin dates',()=>{
  expect(parseEditedZonedMinute('2026-09-23T12:01','2026-09-23T10:00:37.123Z')).toBe('2026-09-23T10:01:00.000Z');
  expect(formatZonedDateTime('2026-09-23T10:00:37.123Z')).toBe('23.09.2026, 12:00');
});
