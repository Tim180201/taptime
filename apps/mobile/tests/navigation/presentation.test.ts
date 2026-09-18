import { describe, expect, it } from 'vitest';
import { productDestinations, syncIndicator } from '../../src/navigation/presentation';

describe('role navigation and synchronization status', () => {
  it.each([
    ['employee', ['capture', 'manual', 'times']],
    ['standortleitung', ['capture', 'manual', 'times']],
    ['administrator', ['capture', 'manual', 'times', 'setup']],
  ] as const)('offers the authorized destinations for %s, starting at capture', (role, destinations) => {
    expect(productDestinations(role)).toEqual(destinations);
    expect(productDestinations(role)).not.toContain('sync');
  });
  it('distinguishes no pending transmissions from pending transmissions, even while scanning', () => {
    expect(syncIndicator({ status: 'server_decision', outcome: { status: 'time_entry_started' }, queueCount: 0 }))
      .toEqual({ kind: 'confirmed', count: 0, label: 'Abgleich: alles bestätigt' });
    expect(syncIndicator({ status: 'saved_locally', queueCount: 3 })).toMatchObject({ kind: 'pending', count: 3 });
    expect(syncIndicator({ status: 'scanning' }, 3)).toMatchObject({ kind: 'pending', count: 3 });
  });
  it('does not turn an unknown or protected status into a green confirmation', () => {
    expect(syncIndicator({ status: 'checking' }).kind).toBe('checking');
    expect(syncIndicator({ status: 'ready', outcome: null }).kind).toBe('confirmed');
    expect(syncIndicator({ status: 'protected_pending', reason: 'identity_mismatch' }, 0).kind).toBe('protected');
    expect(syncIndicator({ status: 'server_review_pending', queueCount: 0 }).kind).toBe('review');
  });
});
