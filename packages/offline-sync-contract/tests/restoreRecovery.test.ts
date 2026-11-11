import { expect, it } from 'vitest';
import { parseRestoreRecoveryStateV1 } from '../src/index.js';
const operation = { id: '10000000-0000-4000-8000-000000000001', target: { kind: 'latest' }, activatedAt: '2026-11-11T12:00:00.000Z' };
it('reads absent, latest and intentional point-in-time recovery without extending old contracts', () => {
  for (const value of [null, operation, { ...operation, target: { kind: 'point_in_time', time: '2026-11-10T12:00:00.123456Z' } }]) {
    const state = { contractVersion: 1, operation: value };
    expect(parseRestoreRecoveryStateV1(state)).toEqual(state);
  }
});
it('rejects unknown versions, fields, incomplete targets and invalid timestamps', () => {
  for (const value of [
    { contractVersion: 2, operation }, { contractVersion: 1, operation, cluster: 'private' },
    { contractVersion: 1, operation: { ...operation, timeline: 1 } },
    { contractVersion: 1, operation: { ...operation, target: { kind: 'point_in_time' } } },
    { contractVersion: 1, operation: { ...operation, target: { kind: 'latest', time: null } } },
    { contractVersion: 1, operation: { ...operation, activatedAt: '2026-02-30T12:00:00.000Z' } },
    { contractVersion: 1, operation: { ...operation, id: '' } },
  ]) expect(parseRestoreRecoveryStateV1(value)).toBeNull();
});
