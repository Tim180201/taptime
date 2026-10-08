// @vitest-environment jsdom
import { createElement as h } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
const native = vi.hoisted(() => ({ openURL: vi.fn(async () => {}) }));
vi.mock('react-native', async () => ({ ...await vi.importActual<typeof import('react-native')>('react-native-web'),
  Linking: { openURL: native.openURL },
  AccessibilityInfo: { announceForAccessibility: vi.fn(), isReduceMotionEnabled: async () => true, addEventListener: () => ({ remove() {} }) },
}));
vi.mock('../../src/design/AppBuildIdentity', () => ({ AppBuildIdentity: () => null }));
vi.mock('../../src/design/ScanRing', () => ({ ScanRing: () => null }));
const { AppNavigator } = await import('../../src/navigation/AppNavigator');
const { ScanScreen } = await import('../../src/screens/ScanScreen');
const { SynchronizationScreen } = await import('../../src/screens/SynchronizationScreen');
afterEach(() => { cleanup(); vi.clearAllMocks(); });
const scanState = { status: 'offline_ready', queueCount: 1, outcome: null, updateRequired: true };
const scan = { subscribe: () => () => {}, getState: () => scanState } as never;
it.each(['session', 'scan', 'sync'])('opens the fixed download URL from the %s update notice', async surface => {
  const sessionState = { status: 'context_unavailable', updateRequired: true };
  render(surface === 'session'
    ? h(AppNavigator, { session: { subscribe: () => () => {}, getState: () => sessionState } as never, scan, administration: {} as never, offlineManual: {} as never })
    : surface === 'scan' ? h(ScanScreen, { scan, actor: 'employee', signOut: async () => {}, retryRecovery: async () => {} })
    : h(SynchronizationScreen, { scan }));
  fireEvent.click(screen.getByRole('button', { name: 'App aktualisieren' }));
  await waitFor(() => expect(native.openURL).toHaveBeenCalledExactlyOnceWith('https://tb-infra.de/app'));
});
it('keeps the user informed when opening the browser fails', async () => {
  native.openURL.mockRejectedValueOnce(new Error('synthetic'));
  render(h(SynchronizationScreen, { scan }));
  fireEvent.click(screen.getByRole('button', { name: 'App aktualisieren' }));
  await screen.findByText('Der Link konnte nicht geöffnet werden. Versuche es erneut.');
  fireEvent.click(screen.getByRole('button', { name: 'App aktualisieren' }));
  await waitFor(() => expect(native.openURL).toHaveBeenCalledTimes(2));
});
