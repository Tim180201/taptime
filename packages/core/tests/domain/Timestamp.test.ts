import { expect, it } from 'vitest';
import { createTimestamp } from '../../src/domain/Timestamp';
it.each(['2026-02-30T10:00:00Z', '2025-02-29T10:00:00Z', '1900-02-29T10:00:00Z',
  '2026-04-31T10:00:00Z', '2026-10-25T24:00:00Z', '2026-10-25T10:00:00', '1', '0000-01-01T00:00:00Z'])
('T106: rejects non-calendar or offset-free timestamp %s', value => expect(() => createTimestamp(value)).toThrow());
it.each(['2024-02-29T10:00:00Z','2000-02-29T10:00:00.123456Z','2026-10-25T02:30:00+02:00','2026-10-25T02:30:00+01:00'])
('T106: preserves valid timestamp evidence %s', value => expect(createTimestamp(value)).toBe(value));
