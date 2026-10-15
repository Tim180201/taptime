// @vitest-environment jsdom
import { createElement as h, useLayoutEffect } from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { APP_NAME } from '../../../../shared/product';
import type { MobileSessionState } from '../../src/auth/contracts';

const probe = vi.hoisted(() => ({ hide: vi.fn(), prevent: vi.fn(async () => true), creation: null as any }));
vi.mock('expo-splash-screen', () => ({ hide: probe.hide, preventAutoHideAsync: probe.prevent }));
vi.mock('../../src/runtime/ProductMobileRuntime', () => ({ createProductMobileRuntime: () => probe.creation }));
vi.mock('../../src/design/AppBuildIdentity', () => ({ AppBuildIdentity: () => null }));
vi.mock('@expo-google-fonts/manrope', () => ({ useFonts: () => [false], Manrope_400Regular: 1, Manrope_600SemiBold: 2, Manrope_800ExtraBold: 3 }));
vi.mock('expo-secure-store', () => ({ getItemAsync: async () => null }));
vi.mock('expo-status-bar', () => ({ StatusBar: () => null }));
vi.mock('../../src/demo/DemoMobileApp', () => ({ DemoMobileApp: () => h('div', {}, 'Demo bereit') }));
vi.mock('../../src/validation/PhysicalValidationMobileApp', () => ({ PhysicalValidationMobileApp: () => h('div', {}, 'Validierung bereit') }));
vi.mock('react-native', () => {
  const flatten = (value: any): any => Array.isArray(value) ? Object.assign({}, ...value.map(flatten)) : value ?? {};
  const element = ({ children, accessibilityLabel, accessibilityRole, testID, style, onLayout, ...props }: any) => {
    useLayoutEffect(() => { onLayout?.({ nativeEvent: { layout: { width: 390, height: 844 } } }); }, [onLayout]);
    return h('div', { 'aria-label': accessibilityLabel, role: accessibilityRole === 'header' ? 'heading' : accessibilityRole,
      'data-testid': testID, 'data-style': JSON.stringify(flatten(style)) }, children);
  };
  return { useColorScheme: () => 'dark', View: element, Text: element, ScrollView: element, Image: element, Pressable: element, TextInput: element,
    Platform: { OS: 'android' }, StyleSheet: { create: (s: any) => s, flatten },
    AppState: { currentState: 'active', addEventListener: () => ({ remove() {} }) },
    BackHandler: { addEventListener: () => ({ remove() {} }) }, Linking: {},
    AccessibilityInfo: { isReduceMotionEnabled: async () => true, addEventListener: () => ({ remove() {} }) },
    Animated: { View: element, Value: class { interpolate() { return 1; } stopAnimation() {} setValue() {} } }, Easing: {} };
});
const { ProductMobileApp } = await import('../../src/ProductMobileApp');

function runtime(initial: MobileSessionState = { status: 'initializing' }) {
  let state = initial;
  let finish!: () => void;
  let fail!: () => void;
  const listeners = new Set<() => void>();
  const inactive = { status: 'inactive' };
  probe.creation = { status: 'ready', runtime: {
    start: () => new Promise<void>((resolve, reject) => { finish = resolve; fail = () => reject(new Error('startup')); }), stop() {},
    session: { getState: () => state, subscribe: (listener: () => void) => { listeners.add(listener); return () => listeners.delete(listener); } },
    scan: { getState: () => inactive, subscribe: () => () => {} },
    administration: {}, offlineManual: {},
  } };
  return { finish: () => finish(), fail: () => fail(), publish(next: MobileSessionState) { state = next; listeners.forEach(listener => listener()); } };
}
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); probe.hide.mockClear(); });

it.each(['demo', 'physical-validation', 'forbidden'])('T120 releases the native splash for the %s composition too', async mode => {
  vi.stubGlobal('__DEV__', mode !== 'forbidden');
  vi.stubEnv('EXPO_PUBLIC_TAPTIME_RUNTIME_VARIANT', mode === 'physical-validation' ? mode : '');
  vi.stubEnv('EXPO_PUBLIC_TAPTIME_DEMO_MODE', mode === 'physical-validation' ? 'false' : 'true');
  const { default: App } = await import('../../App');
  await act(async () => { render(h(App)); });
  expect(probe.hide).toHaveBeenCalled();
});

it('T120 keeps the native image through runtime AND session startup, then reveals the login', async () => {
  vi.useFakeTimers(); const control = runtime(); render(h(ProductMobileApp));
  expect(probe.prevent).toHaveBeenCalledOnce();
  expect(probe.hide).not.toHaveBeenCalled();
  expect(screen.getByLabelText(`${APP_NAME} wird gestartet`)).toBeTruthy();
  expect(screen.queryByText('Sitzung wird sicher wiederhergestellt …')).toBeNull();
  await act(async () => { control.finish(); });
  expect(probe.hide).not.toHaveBeenCalled();
  await act(async () => { control.publish({ status: 'unauthenticated', reason: 'not_signed_in' }); });
  expect(screen.getByTestId('email-input')).toBeTruthy();
  expect(probe.hide).toHaveBeenCalled();
  expect(screen.queryByLabelText(`${APP_NAME} wird gestartet`)).toBeNull();
});

it('T120 hands over after three seconds without moving the image and clears its timer', async () => {
  vi.useFakeTimers(); runtime(); const view = render(h(ProductMobileApp));
  const image = screen.getByTestId('startup-image'); const before = image.getAttribute('data-style');
  await act(async () => { vi.advanceTimersByTime(2999); });
  expect(probe.hide).not.toHaveBeenCalled(); expect(screen.queryByText('Wird geladen …')).toBeNull();
  await act(async () => { vi.advanceTimersByTime(1); });
  expect(probe.hide).toHaveBeenCalled(); expect(screen.getByText('Wird geladen …')).toBeTruthy();
  expect(screen.getByTestId('startup-image').getAttribute('data-style')).toBe(before);
  view.unmount(); expect(vi.getTimerCount()).toBe(0);
});

it.each(['R1', 'R2', 'S1', 'S2', 'S3', 'S4', 'S5', 'S7'] as const)('T120 reveals the existing %s error without waiting for the timeout', async code => {
  vi.useFakeTimers();
  const states: Record<string, MobileSessionState> = {
    S1: { status: 'runtime_unavailable', reason: 'authentication_unavailable' },
    S2: { status: 'runtime_unavailable', reason: 'storage_unavailable' },
    S3: { status: 'recovery_required', reason: 'token_persistence' },
    S4: { status: 'recovery_required', reason: 'session_cleanup' },
    S5: { status: 'unauthenticated', reason: 'sign_in_unavailable' },
    S7: { status: 'context_unavailable' },
  };
  const control = runtime(states[code]);
  if (code === 'R1') probe.creation = { status: 'unavailable' };
  render(h(ProductMobileApp));
  if (code !== 'R1') await act(async () => { if (code === 'R2') control.fail(); else control.finish(); });
  expect(screen.getByText(`Code ${code}`)).toBeTruthy();
  expect(probe.hide).toHaveBeenCalled();
  expect(screen.queryByLabelText(`${APP_NAME} wird gestartet`)).toBeNull();
});
