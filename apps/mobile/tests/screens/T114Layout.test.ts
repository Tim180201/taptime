// @vitest-environment jsdom
import { createElement as h, type ReactNode } from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SafeOwnTimeRecord } from '@taptime/mobile-work-contract';
import type { MobileWorkCapability } from '../../src/work/contracts';
import type { ProductScanCapability } from '../../src/scan/contracts';

const native = vi.hoisted(() => ({ layouts: new Map<string, (event: unknown) => void>(), textLayouts: new Map<string, (event: unknown) => void>() }));
vi.mock('react-native', () => {
  const flatten = (value: unknown): Record<string, unknown> => Array.isArray(value)
    ? Object.assign({}, ...value.map(flatten)) : value && typeof value === 'object' ? value as Record<string, unknown> : {};
  type Props = { children?: ReactNode; style?: unknown; contentContainerStyle?: unknown; testID?: string;
    accessibilityRole?: string; accessibilityLabel?: string; onLayout?: (event: unknown) => void;
    onTextLayout?: (event: unknown) => void;
    numberOfLines?: number; adjustsFontSizeToFit?: boolean; minimumFontScale?: number; maxFontSizeMultiplier?: number };
  const element = (text = false, scroll = false) => (props: Props) => {
    if (props.testID && props.onLayout) native.layouts.set(props.testID, props.onLayout);
    if (props.testID && props.onTextLayout) native.textLayouts.set(props.testID, props.onTextLayout);
    const style = typeof props.style === 'function' ? props.style({ pressed: false }) : props.style;
    return h('div', { 'data-style': JSON.stringify(flatten(style)), 'data-text': text || undefined,
      'data-testid': props.testID, role: props.accessibilityRole === 'header' ? 'heading' : props.accessibilityRole,
      'aria-label': props.accessibilityLabel,
      'data-text-props': text ? JSON.stringify({ numberOfLines: props.numberOfLines,
        adjustsFontSizeToFit: props.adjustsFontSizeToFit, minimumFontScale: props.minimumFontScale,
        maxFontSizeMultiplier: props.maxFontSizeMultiplier }) : undefined },
    scroll ? h('div', { 'data-style': JSON.stringify(flatten(props.contentContainerStyle)) }, props.children) : props.children);
  };
  return { View: element(), Text: element(true), ScrollView: element(false, true), Pressable: element(), TextInput: element(),
    Platform: { OS: 'android' }, StyleSheet: { create: (value: unknown) => value, flatten },
    BackHandler: { addEventListener: () => ({ remove() {} }) }, Linking: {},
    AccessibilityInfo: { isReduceMotionEnabled: async () => true, addEventListener: () => ({ remove() {} }) },
    Animated: { View: element(), Value: class { interpolate() { return 1; } stopAnimation() {} setValue() {} } }, Easing: {} };
});
vi.mock('../../src/design/AppBuildIdentity', () => ({ AppBuildIdentity: () => null }));
const { AppNavigator } = await import('../../src/navigation/AppNavigator');
const { ScanScreen, presentScanState } = await import('../../src/screens/ScanScreen');
const { ManualCaptureScreen } = await import('../../src/screens/ManualCaptureScreen');
const { ScanRing } = await import('../../src/design/ScanRing');

const active: SafeOwnTimeRecord = { timeRecordId: 'entry', source: 'canonical', targetType: 'customer', targetId: 'target',
  targetDisplayName: 'Kunde X', status: 'started', startedAt: '2026-10-08T06:12:00.000Z', stoppedAt: null,
  startedVia: 'nfc', stoppedVia: null, breakStartedAt: null,
  calendar: { asOf: '2026-10-08T08:42:00.000Z', workDurationSeconds: 9000, breakDurationSeconds: 0, breakIntervals: [] } };
function workFor(record: SafeOwnTimeRecord | null): MobileWorkCapability {
  const state = { status: 'ready' as const, ownTime: { activeRecord: record, records: [], nextCursor: null,
    windowStartedAt: '2026-09-30T22:00:00.000Z', windowEndedAt: '2026-10-31T23:00:00.000Z' },
    targets: { targets: [], nextCursor: null }, submitting: false, loadingMore: false, outcome: null };
  return { getState: () => state, subscribe: () => () => {}, refresh: async () => {}, loadMoreOwnTime: async () => {},
    triggerManual: async () => {}, triggerBreak: async () => {}, stopActiveTime: async () => {} };
}
const scanState = { status: 'ready' as const, outcome: null };
const scan: ProductScanCapability = { getState: () => scanState, subscribe: () => () => {},
  scan: async () => {}, cancel: async () => {}, retry: async () => {} };
function shell(record: SafeOwnTimeRecord | null) {
  const sessionState = { status: 'authenticated', session: { userId: 'user', organizationId: 'business',
    membershipId: 'membership', role: 'administrator', nfcSetupAvailable: true, managementScope: { kind: 'organization' } } };
  const session = { getState: () => sessionState,
    subscribe: () => () => {}, signOut: async () => {} };
  const setupState = { status: 'inactive' };
  return h(AppNavigator, { session: session as never, scan, work: workFor(record), offlineManual: {} as never,
    administration: { getState: () => setupState, subscribe: () => () => {} } as never });
}
const style = (node: Element) => JSON.parse(node.getAttribute('data-style') ?? '{}') as Record<string, number | string>;
// A conservative two-line allowance for the scan instruction. All dimensions come
// from the rendered native styles; real wrapping is verified separately in RN-Web.
function height(node: Element): number {
  const s = style(node);
  if (s.display === 'none' || s.position === 'absolute') return 0;
  if (typeof s.height === 'number') return s.height;
  if (node.tagName.toLowerCase() === 'svg') return Number(node.getAttribute('height'));
  const children = [...node.children];
  const textHeight = node.hasAttribute('data-text') ? Number(s.lineHeight) * (node.parentElement?.getAttribute('data-testid') === 'scan-copy' && s.fontSize === 13 ? 2 : 1) : 0;
  const inner = textHeight || (s.flexDirection === 'row' ? Math.max(0, ...children.map(height))
    : children.reduce((sum, child) => sum + height(child), 0) + Math.max(0, children.length - 1) * Number(s.gap ?? 0));
  return Math.max(Number(s.minHeight ?? 0), inner + Number(s.paddingTop ?? s.paddingVertical ?? s.padding ?? 0)
    + Number(s.paddingBottom ?? s.paddingVertical ?? s.padding ?? 0) + Number(s.borderTopWidth ?? s.borderWidth ?? 0)
    + Number(s.borderBottomWidth ?? s.borderWidth ?? 0));
}
async function layout(id: string, width: number, measuredHeight: number) {
  expect(native.layouts.has(id), `${id} measures the available content`).toBe(true);
  await act(async () => native.layouts.get(id)!({ nativeEvent: { layout: { width, height: measuredHeight } } }));
}
afterEach(() => { cleanup(); native.layouts.clear(); native.textLayouts.clear(); });

describe('T-114 height and navigation', () => {
  it.each(['ready', 'running', 'pause'] as const)('fits %s in the 360 × 568 dp area using the rendered styles', async state => {
    render(shell(state === 'ready' ? null : { ...active, breakStartedAt: state === 'pause' ? '2026-10-08T08:30:00.000Z' : null }));
    const header = screen.getByRole('heading', { name: 'Erfassen' }).parentElement!.parentElement!;
    const tabs = screen.getByRole('tablist');
    const available = 568 - height(header) - height(tabs);
    const scroll = screen.getByTestId('scan-scroll');
    const content = scroll.firstElementChild!;
    const width = 360 - 2 * 20;
    await layout('scan-scroll', width, available);
    for (const id of ['scan-before', 'scan-copy', 'scan-after']) {
      const node = screen.queryByTestId(id);
      if (node) await layout(id, width, height(node));
    }
    expect(height(content)).toBeLessThanOrEqual(available);
    expect(style(scroll).flex).toBe(1);
    expect(style(screen.getByTestId('scan-ring')).height).toBeLessThan(300);
    if (state !== 'ready') {
      expect(screen.getByRole('button', { name: 'Zeit beenden' }).parentElement)
        .toBe(screen.getByRole('button', { name: state === 'pause' ? 'Pause beenden' : 'Pause starten' }).parentElement);
    }
  });

  it('scales every ring layer while preserving its animation clearance', () => {
    render(h(ScanRing, { size: 144, animate: false, scanning: false, result: null } as never));
    const ring = screen.getByTestId('scan-ring');
    expect(style(ring)).toMatchObject({ width: 144, height: 144 });
    const inner = style(ring.firstElementChild!);
    expect(Number(inner.width) * 1.25).toBeLessThanOrEqual(144);
    expect(style(ring.querySelector('svg')!).width ?? Number(ring.querySelector('svg')!.getAttribute('width'))).toBeLessThan(Number(inner.width));
  });

  it('keeps all five tab names accessible with one line, 80% fitting and a 1.3 font limit', () => {
    render(shell(null));
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map(tab => tab.getAttribute('aria-label'))).toEqual(['Erfassen', 'Meine Zeiten', 'Kunden', 'Mitarbeiter', 'Karten']);
    for (const tab of tabs) {
      const label = tab.querySelector('[data-text]')!;
      expect(JSON.parse(label.getAttribute('data-text-props')!)).toEqual({ numberOfLines: 1, adjustsFontSizeToFit: false,
        minimumFontScale: 0.8, maxFontSizeMultiplier: 1.3 });
      expect(style(label).alignSelf).toBe('stretch');
    }
  });

  it.each([0.5, 0.9, 1.2])('bounds the applied tab font when native text needs a %s fit factor', async requested => {
    render(shell(null));
    const label = screen.getByRole('tab', { name: 'Meine Zeiten' }).querySelector('[data-text]')!;
    const originalSize = Number(style(label).fontSize);
    await layout('tab-label-Meine Zeiten', 72, height(label));
    const measureId = 'tab-measure-Meine Zeiten';
    expect(native.textLayouts.has(measureId)).toBe(true);
    await act(async () => native.textLayouts.get(measureId)!({ nativeEvent: { lines: [{ width: 72 / requested }] } }));
    expect(Number(style(label).fontSize)).toBeCloseTo(originalSize * Math.max(0.8, Math.min(1, requested)));
    expect(JSON.parse(label.getAttribute('data-text-props')!).adjustsFontSizeToFit).toBe(false);
  });

  it.each([true, false])('removes Zuletzt and its fallback from Erfassen (work: %s)', withWork => {
    render(h(ScanScreen, { actor: 'employee', scan, work: withWork ? workFor(active) : undefined, signOut: async () => {}, embedded: true }));
    expect(screen.queryByText('Zuletzt')).toBeNull();
    expect(screen.queryByText('Bestätigte Zeiten siehst du nach der Übertragung.')).toBeNull();
  });

  it('preserves Zuletzt and the vertical active actions in Manuell', () => {
    render(h(ManualCaptureScreen, { work: workFor(active) }));
    expect(screen.getByText('Zuletzt')).toBeDefined();
    const stop = screen.getByRole('button', { name: 'Zeit beenden' });
    expect(style(stop.parentElement!).flexDirection).not.toBe('row');
  });
});

describe('T-114 queue copy', () => {
  it.each([0, 1, 2])('uses the right number for %s retained captures', count => {
    const offline = presentScanState({ status: 'offline_ready', outcome: null, queueCount: count }).message;
    const saved = presentScanState({ status: 'saved_locally', queueCount: count }).message;
    const syncing = presentScanState({ status: 'synchronizing', queueCount: count }).message;
    if (count === 0) {
      expect(offline).not.toMatch(/0 Erfassung|wartet|warten/);
      expect(saved).not.toMatch(/0 Erfassung|wartet|warten/);
      expect(syncing).not.toMatch(/0 Vorg/);
    } else {
      expect(offline).toContain(count === 1 ? '1 Erfassung wartet auf Bestätigung' : '2 Erfassungen warten auf Bestätigung');
      expect(saved).toContain(count === 1 ? '1 Erfassung ist' : '2 Erfassungen sind');
      expect(saved).toContain(count === 1 ? 'wartet auf Bestätigung' : 'warten auf Bestätigung');
      expect(syncing).toContain(count === 1 ? '1 Vorgang wird' : '2 Vorgänge werden');
    }
  });
});
