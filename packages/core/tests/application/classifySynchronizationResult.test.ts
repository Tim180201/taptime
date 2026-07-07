import { describe, expect, it } from 'vitest';
import { classifySynchronizationResult } from '../../src/application/classifySynchronizationResult';
import type { SynchronizationResult } from '../../src/application/SynchronizationResult';

describe('classifySynchronizationResult (DT-009)', () => {
  it('returns null for a successful synchronization (not an error)', () => {
    const result: SynchronizationResult = { status: 'synchronized' };

    expect(classifySynchronizationResult(result)).toBeNull();
  });

  it('classifies a retryable_failure as retryable', () => {
    const result: SynchronizationResult = { status: 'retryable_failure', reason: 'network timeout' };

    expect(classifySynchronizationResult(result)).toBe('retryable');
  });

  it('classifies a conflict as conflict, distinct from retryable', () => {
    const result: SynchronizationResult = { status: 'conflict', reason: 'remote record already modified' };

    expect(classifySynchronizationResult(result)).toBe('conflict');
  });
});
