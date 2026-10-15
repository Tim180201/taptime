// @vitest-environment jsdom
import { createElement as h, useSyncExternalStore } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const native = vi.hoisted(() => ({ scheme: 'light' as 'light' | 'dark' | null, listeners: new Set<() => void>(),
  get: vi.fn<() => Promise<string | null>>(), set: vi.fn<(...args: unknown[]) => Promise<void>>(), remove: vi.fn<(...args: unknown[]) => Promise<void>>() }));
vi.mock('expo-secure-store', () => ({ getItemAsync: native.get, setItemAsync: native.set, deleteItemAsync: native.remove }));
vi.mock('react-native', async () => ({ ...await vi.importActual<typeof import('react-native')>('react-native-web'),
  useColorScheme: () => useSyncExternalStore(fn => { native.listeners.add(fn); return () => { native.listeners.delete(fn); }; }, () => native.scheme),
}));
vi.mock('expo-status-bar', () => ({ StatusBar: ({ style }: { style: string }) => h('span', { 'data-testid': 'status-bar' }, style) }));
vi.mock('expo-navigation-bar', () => ({ NavigationBar: ({ style }: { style: string }) => h('span', { 'data-testid': 'navigation-bar' }, style) }));
const { MobileThemeProvider } = await import('../../src/design/MobileThemeProvider');
const { useMobileTheme } = await import('../../src/design/useMobileTheme');
const { ThemeSwitch } = await import('../../src/design/ThemeSwitch');
const { StartupBoundary } = await import('../../src/design/StartupBoundary');
function Probe() { const { theme, preference } = useMobileTheme(); return h('output', {}, `${preference}:${theme}`); }
const mount = () => render(h(MobileThemeProvider, {}, h(Probe), h(ThemeSwitch)));
const system = async (scheme: typeof native.scheme) => act(async () => { native.scheme = scheme; native.listeners.forEach(fn => fn()); });
beforeEach(() => { native.scheme = 'light'; native.get.mockReset().mockResolvedValue(null); native.set.mockReset().mockResolvedValue(); native.remove.mockReset().mockResolvedValue(); });
afterEach(cleanup);
it('follows the system by default and reacts immediately to a system change', async () => {
  mount(); expect(await screen.findByText('automatic:light')).toBeDefined(); await system('dark');
  expect(screen.getByText('automatic:dark')).toBeDefined();
});
it('switches immediately, saves per device, restores, and removes the override for automatic', async () => {
  const view = mount(); await screen.findByText('automatic:light');
  fireEvent.click(screen.getByRole('radio', { name: 'Dunkel' }));
  expect(screen.getByText('dark:dark')).toBeDefined(); await waitFor(() => expect(native.set).toHaveBeenCalledWith('taptime.theme', 'dark'));
  await system('light'); expect(screen.getByText('dark:dark')).toBeDefined(); view.unmount();
  native.get.mockResolvedValue('dark'); mount(); await screen.findByText('dark:dark');
  fireEvent.click(screen.getByRole('radio', { name: 'Hell' })); await screen.findByText('light:light');
  fireEvent.click(screen.getByRole('radio', { name: 'Automatisch' })); await screen.findByText('automatic:light');
  await waitFor(() => expect(native.remove).toHaveBeenCalledWith('taptime.theme'));
});
it.each(['invalid', 'read failure', 'write failure', 'remove failure'])('uses automatic on %s', async failure => {
  if (failure === 'invalid') native.get.mockResolvedValue('invalid');
  if (failure === 'read failure') native.get.mockRejectedValue(new Error('locked'));
  if (failure === 'write failure') native.set.mockRejectedValue(new Error('full'));
  if (failure === 'remove failure') { native.get.mockResolvedValue('dark'); native.remove.mockRejectedValue(new Error('locked')); }
  mount();
  if (failure === 'write failure') fireEvent.click(screen.getByRole('radio', { name: 'Dunkel' }));
  if (failure === 'remove failure') { await screen.findByText('dark:dark'); fireEvent.click(screen.getByRole('radio', { name: 'Automatisch' })); }
  await screen.findByText('automatic:light'); await system('dark'); expect(screen.getByText('automatic:dark')).toBeDefined();
});
it('does not overwrite a user choice with a late storage read', async () => {
  let finish!: (value: string) => void; native.get.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  mount(); fireEvent.click(screen.getByRole('radio', { name: 'Dunkel' }));
  await act(async () => finish('light')); expect(screen.getByText('dark:dark')).toBeDefined();
});
it('serializes fast choices and ignores a stale write failure', async () => {
  let fail!: (reason: Error) => void; native.set.mockImplementationOnce(() => new Promise((_, reject) => { fail = reject; }));
  mount(); await act(async () => {}); fireEvent.click(screen.getByRole('radio', { name: 'Dunkel' }));
  await waitFor(() => expect(native.set).toHaveBeenCalledOnce());
  fireEvent.click(screen.getByRole('radio', { name: 'Hell' }));
  await act(async () => fail(new Error('unavailable'))); expect(screen.getByText('light:light')).toBeDefined();
  expect(native.set.mock.calls.map(call => call[1])).toEqual(['dark', 'light']);
});
it('keeps both system bars light during startup, then follows live theme changes', async () => {
  const view = render(h(MobileThemeProvider, {}, h(StartupBoundary, { loading: true })));
  expect(screen.getByTestId('status-bar').textContent).toBe('light');
  expect(screen.getByTestId('navigation-bar').textContent).toBe('light');
  view.rerender(h(MobileThemeProvider, {}, h(StartupBoundary, { loading: false }, h(Probe))));
  expect(screen.getByTestId('status-bar').textContent).toBe('dark');
  expect(screen.getByTestId('navigation-bar').textContent).toBe('dark');
  await system('dark');
  expect(screen.getByTestId('status-bar').textContent).toBe('light');
  expect(screen.getByTestId('navigation-bar').textContent).toBe('light');
  await system('light');
  expect(screen.getByTestId('status-bar').textContent).toBe('dark');
  expect(screen.getByTestId('navigation-bar').textContent).toBe('dark');
});
