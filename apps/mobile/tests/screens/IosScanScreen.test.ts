import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { ProductScanState } from '../../src/scan/contracts';

const presses = vi.hoisted(() => new Map<string, () => void>());
vi.mock('react-native', () => ({ Platform: { OS: 'ios' }, ScrollView: 'section', View: 'div',
  StyleSheet: { create: (value: unknown) => value } }));
vi.mock('../../src/design/primitives', () => ({
  AppText: 'span', Card: 'aside',
  TouchTarget: ({ children, accessibilityLabel, onPress }: { children: React.ReactNode; accessibilityLabel: string; onPress: () => void }) => {
    presses.set(accessibilityLabel, onPress);
    return createElement('button', { 'aria-label': accessibilityLabel }, children);
  },
  ActionButton: ({ title }: { title: string }) => createElement('button', {}, title),
}));
vi.mock('../../src/design/ScanRing', () => ({ ScanRing: () => createElement('div') }));
vi.mock('../../src/screens/RecentTimeCard', () => ({ RecentTimeCard: () => null }));
import { ScanScreen, presentScanState } from '../../src/screens/ScanScreen';
import { presentAdminSetupState } from '../../src/screens/AdminSetupScreen';

describe('iPhone capture screen', () => {
  it('opens no session on render and offers an explicit Tag scannen action', () => {
    const state: ProductScanState = { status: 'ready', outcome: null };
    const scan = { getState: () => state, subscribe: () => () => {}, scan: vi.fn(async () => {}), cancel: vi.fn(async () => {}), retry: vi.fn(async () => {}) };
    const html = renderToStaticMarkup(createElement(ScanScreen, { actor: 'employee', scan, signOut: async () => {} }));
    expect(html).toContain('aria-label="Tag scannen"');
    expect(html).toContain('Tag scannen');
    expect(scan.scan).not.toHaveBeenCalled();
    presses.get('Tag scannen')!();
    expect(scan.scan).toHaveBeenCalledOnce();
  });
  it('explains iPhone availability and scanning without Android instructions', () => {
    expect(presentScanState({ status: 'not_supported' }, 'ios').message).not.toContain('Android');
    expect(presentScanState({ status: 'scanning' }, 'ios').message).toContain('iPhone');
    expect(presentScanState({ status: 'not_supported' }, 'android').message).toContain('Android');
  });
  it('names the iPhone during tag setup and preserves the Android instruction', () => {
    const state = { status: 'capturing' as const, projection: {
      organization: { id: 'synthetic', name: 'Test' }, customers: [], nfcTags: [], nextCursor: null,
    } };
    expect(presentAdminSetupState(state, 'ios').message).toContain('iPhone');
    expect(presentAdminSetupState(state, 'android').message).toContain('Android');
  });
});
