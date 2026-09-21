// @vitest-environment jsdom
import { act, createElement, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MobileSessionCapability, MobileSessionState } from '../../src/auth/contracts';
import type { ProductScanCapability, ProductScanState } from '../../src/scan/contracts';
import type { MobileWorkCapability, MobileWorkState } from '../../src/work/contracts';
import type { AdminSetupCapability } from '../../src/administration/contracts';
import type { OfflineManualCaptureCapability } from '../../src/offline/OfflineCaptureCoordinator';

const native = vi.hoisted(() => ({ back: null as null | (() => boolean) }));
vi.mock('expo-constants', () => ({ default: { expoConfig: null } }));
vi.mock('../../src/design/ScanRing', () => ({ ScanRing: () => null }));
vi.mock('react-native', () => {
  const flatten = (value: unknown): Record<string, unknown> => Array.isArray(value)
    ? Object.assign({}, ...value.map(flatten)) : value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const element = ({ children, accessibilityRole, accessibilityLabel, style, onPress, disabled, accessibilityState, accessibilityHint, numberOfLines, adjustsFontSizeToFit, horizontal }: {
    children?: ReactNode; accessibilityRole?: string; accessibilityLabel?: string; style?: unknown;
    onPress?: () => void; disabled?: boolean; accessibilityState?: { selected?: boolean }; accessibilityHint?: string;
    numberOfLines?: number; adjustsFontSizeToFit?: boolean; horizontal?: boolean;
  }) => {
    const actualStyle = flatten(typeof style === 'function' ? style({ pressed: false }) : style);
    return createElement(onPress ? 'button' : 'div', { role: accessibilityRole,
      'aria-label': accessibilityLabel, 'aria-pressed': accessibilityState?.selected,
      'aria-description': accessibilityHint, onClick: onPress, disabled,
      style: { display: actualStyle.display as string }, 'data-style': JSON.stringify(actualStyle),
      'data-lines': numberOfLines, 'data-shrink': adjustsFontSizeToFit, 'data-horizontal': horizontal,
    }, children);
  };
  return { View: element, Text: element, Pressable: element, ScrollView: element, TextInput: element,
    StyleSheet: { create: (value: unknown) => value, flatten }, Platform: { OS: 'android' },
    Linking: { getInitialURL: async () => null, addEventListener: () => ({ remove() {} }) },
    BackHandler: { addEventListener: (_: string, listener: () => boolean) => {
      native.back = listener; return { remove() { if (native.back === listener) native.back = null; } };
    } },
  };
});
const { AppNavigator } = await import('../../src/navigation/AppNavigator');
const { TimeCalendar } = await import('../../src/screens/TimeCalendar');
const target = { targetType: 'customer' as const, targetId: 'customer', displayName: 'Testkunde' };
const ownTime = { activeRecord: null, records: [], nextCursor: null,
  windowStartedAt: '2026-09-01T00:00:00Z', windowEndedAt: '2026-09-21T12:00:00Z' };
let root: Root;
let container: HTMLDivElement;
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  container = document.createElement('div'); document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); });
function button(label: string) {
  const result = [...container.querySelectorAll('button')].find(node =>
    (node.getAttribute('aria-label') ?? node.textContent) === label
    && !node.closest('[style*="display: none"]'));
  expect(result, label).toBeDefined(); return result!;
}
async function press(label: string) { await act(async () => button(label).click()); }
function harness(role: 'employee' | 'administrator' | 'standortleitung' | 'offline', identityLabel?: string) {
  let sessionState: MobileSessionState = role === 'offline' ? { status: 'context_unavailable', identityLabel }
    : { status: 'authenticated', identityLabel, session: { userId: 'user', organizationId: 'business', membershipId: 'membership', role,
      nfcSetupAvailable: role !== 'employee', managementScope: role === 'employee' ? null : { kind: 'organization' } } };
  const listeners = new Set<() => void>();
  const session: MobileSessionCapability = { getState: () => sessionState, subscribe: listener => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    signIn: async () => ({ status: 'authenticated' }), signInForEmployeeEnrollment: async () => ({ status: 'authenticated' }),
    redeemEmployeeInvitation: async () => ({ status: 'enrolled' }), refresh: async () => {}, retryContext: async () => {}, signOut: async () => {} };
  const scanState: ProductScanState = { status: 'offline_ready', queueCount: 0, outcome: null };
  const scan: ProductScanCapability = { getState: () => scanState, subscribe: () => () => {}, scan: async () => {}, cancel: async () => {}, retry: async () => {} };
  const workState: MobileWorkState = { status: 'ready', submitting: false, loadingMore: false, outcome: null,
    targets: { targets: [target], nextCursor: null }, ownTime };
  const calls: string[] = [];
  const work: MobileWorkCapability = { getState: () => workState, subscribe: () => () => {}, refresh: vi.fn(async () => {}),
    loadMoreOwnTime: async () => {}, triggerManual: vi.fn(async value => { expect(value).toEqual(target); calls.push('work'); }),
    triggerBreak: vi.fn(async () => { calls.push('break'); }) };
  const offlineManual: OfflineManualCaptureCapability = { readOfflineManualTargets: async () => ({ status: 'ready', targets: [target] }),
    captureManual: vi.fn(async value => { expect(value).toEqual(target); calls.push('work'); return { status: 'saved' as const, workEventId: `event-${calls.length}` }; }),
    captureBreak: vi.fn(async () => { calls.push('break'); return { status: 'saved' as const, workEventId: `event-${calls.length}` }; }) };
  const administration: AdminSetupCapability = { getState: () => ({ status: 'inactive' }), subscribe: () => () => {},
    refresh: vi.fn(async () => {}), loadMore: async () => {}, provision: async () => {}, provisionBreak: async () => {}, cancel: async () => {} };
  return { props: { session, scan, work, offlineManual, administration }, calls,
    publish(state: MobileSessionState) { sessionState = state; listeners.forEach(listener => listener()); } };
}

describe('T-065 rendered navigation and manual lifecycle', () => {
  it.each(['employee', 'administrator', 'standortleitung', 'offline'] as const)('keeps all manual triggers one page from capture (%s)', async role => {
    const h = harness(role, 'confirmed@example.invalid');
    await act(async () => root.render(createElement(AppNavigator, h.props)));
    const tabs = [...container.querySelectorAll('[role="tab"]')].map(node => node.getAttribute('aria-label'));
    expect(tabs).not.toContain('Manuell');
    if (role === 'offline') {
      expect(tabs).toEqual(['Erfassen']);
      expect(h.props.work.refresh).not.toHaveBeenCalled();
      expect(h.props.administration.refresh).not.toHaveBeenCalled();
    }
    expect(container.textContent).toContain('confirmed@example.invalid');
    await press('Manuell starten');
    await press(target.displayName); await press('Jetzt erfassen'); // Start
    await press('Pause'); await press('Jetzt erfassen'); // Pause
    await press('Jetzt erfassen'); // Resume: same pause trigger; the server decides.
    await press(target.displayName); await press('Jetzt erfassen'); // Stop
    expect(h.calls).toEqual(['work', 'break', 'break', 'work']);
    if (role === 'offline') {
      expect(h.props.work.triggerManual).not.toHaveBeenCalled();
      expect(h.props.work.triggerBreak).not.toHaveBeenCalled();
      expect(container.textContent).toContain('Serverbestätigung ausstehend');
    } else {
      expect(h.props.offlineManual.captureManual).not.toHaveBeenCalled();
      expect(h.props.offlineManual.captureBreak).not.toHaveBeenCalled();
    }
    await act(async () => { expect(native.back?.()).toBe(true); });
    button('Manuell starten');
    await press('Manuell starten'); await press('Zurück');
    button('Manuell starten');
    await act(async () => { expect(native.back?.()).toBe(false); });
  });

  it('uses the offline fallback with no cached identity and reveals management only after confirmation', async () => {
    const h = harness('offline');
    await act(async () => root.render(createElement(AppNavigator, h.props)));
    expect(container.textContent).toContain('Offline');
    expect(container.textContent).toContain('Nachtragen ist nur online möglich.');
    expect(button('Zeit hinzufügen').disabled).toBe(true);
    expect(container.querySelector('[aria-label="Mitarbeiter"]')).toBeNull();
    await act(async () => h.publish({ status: 'authenticated', identityLabel: 'confirmed@example.invalid', session: {
      role: 'administrator', userId: 'user', membershipId: 'membership', organizationId: 'business', nfcSetupAvailable: true, managementScope: { kind: 'organization' },
    } }));
    expect(container.textContent).toContain('confirmed@example.invalid · Administrator');
    expect(container.querySelector('[aria-label="Mitarbeiter"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="Tags"]')).not.toBeNull();
    await act(async () => h.publish({ status: 'signed_out' }));
    expect(container.textContent).not.toContain('confirmed@example.invalid');
    expect(container.querySelector('[role="tablist"]')).toBeNull();
  });

  it('renders a calendar without a horizontal scroller or minimum grid width and fits single-line hours', async () => {
    await act(async () => root.render(createElement(TimeCalendar, { value: ownTime, onRefresh: async () => {} })));
    expect(container.querySelector('[data-horizontal="true"]')).toBeNull();
    const days = [...container.querySelectorAll('button')].filter(node => /\d{2}\.\d{2}\.\d{4},/.test(node.getAttribute('aria-label') ?? ''));
    // The month determines the expected cells; no fixed fixture count is the invariant.
    const end = new Date(Date.parse(ownTime.windowEndedAt) - 1);
    expect(days.length).toBe(new Date(end.getUTCFullYear(), end.getUTCMonth() + 1, 0).getDate());
    for (const day of days) {
      const style = JSON.parse(day.getAttribute('data-style')!);
      expect(style.minWidth).toBe(0);
      expect(style.minHeight).toBeGreaterThanOrEqual(44);
      expect(Number.parseFloat(style.width)).toBeCloseTo(100 / 7);
      expect(day.querySelector('[data-lines="1"][data-shrink="true"]')).not.toBeNull();
    }
  });
});
