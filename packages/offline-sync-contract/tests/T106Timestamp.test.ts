import { expect, it } from 'vitest';
import { isOfflineIsoTimestamp } from '../src/index.js';
it.each(['2026-02-30T10:00:00Z','2026-02-31T24:00:00Z','2026-10-25T10:00:00'])
('T106: rejects invalid offline timestamp %s', value => expect(isOfflineIsoTimestamp(value)).toBe(false));
