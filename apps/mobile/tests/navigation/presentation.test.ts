import { describe, expect, it } from 'vitest';
import { productDestinations, syncIndicator } from '../../src/navigation/presentation';

describe('role navigation and synchronization status', () => {
  it.each([
    ['employee', false], ['standortleitung', false], ['administrator', false],
    ['standortleitung', true], ['administrator', true],
  ] as const)('T060 h: Tags follows capability for %s (%s)', (role, nfcSetupAvailable) => {
    expect(productDestinations({ role, nfcSetupAvailable })).toEqual(
      nfcSetupAvailable ? ['capture', 'manual', 'times', 'setup'] : ['capture', 'manual', 'times'],
    );
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
