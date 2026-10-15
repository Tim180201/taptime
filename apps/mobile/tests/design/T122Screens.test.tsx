// @vitest-environment jsdom
import { createElement as h, type ReactElement } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { readdir } from 'node:fs/promises';
import { customerSearch, setupSearch } from '../search/fixtures';
import { mobileThemes, type MobileTheme } from '../../src/design/tokens';
import { MobileThemeContext } from '../../src/design/useMobileTheme';
vi.mock('react-native', async () => ({ ...await vi.importActual<typeof import('react-native')>('react-native-web'),
  AccessibilityInfo: { announceForAccessibility: vi.fn(), isReduceMotionEnabled: async () => true, addEventListener: () => ({ remove() {} }) },
}));
vi.mock('react-native-safe-area-context', async () => {
  const { View } = await vi.importActual<typeof import('react-native')>('react-native-web');
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});
vi.mock('expo-constants', () => ({ default: { expoConfig: {} } }));
const { ScanScreen } = await import('../../src/screens/ScanScreen');
const { LoginScreen } = await import('../../src/screens/LoginScreen');
const { SynchronizationScreen } = await import('../../src/screens/SynchronizationScreen');
const { EmployeeEnrollmentScreen } = await import('../../src/screens/EmployeeEnrollmentScreen');
const { ManualCaptureScreen } = await import('../../src/screens/ManualCaptureScreen');
const { OfflineManualCaptureScreen } = await import('../../src/screens/OfflineManualCaptureScreen');
const { OwnTimeScreen } = await import('../../src/screens/OwnTimeScreen');
const { EmployeesScreen } = await import('../../src/screens/EmployeesScreen');
const { InviteEmployeeScreen } = await import('../../src/screens/InviteEmployeeScreen');
const { PersonTimeScreen } = await import('../../src/screens/PersonTimeScreen');
const { CustomersScreen } = await import('../../src/screens/CustomersScreen');
const { AdminSetupScreen } = await import('../../src/screens/AdminSetupScreen');
const ownTime = { records: [], activeRecord: null, nextCursor: null, windowStartedAt: '2026-09-30T22:00:00Z', windowEndedAt: '2026-10-31T23:00:00Z' };
const target = { targetId: 'customer', targetType: 'customer', displayName: 'Kunde Beispiel' };
const workState = { status: 'ready', ownTime, targets: { targets: [target], nextCursor: null }, outcome: null, submitting: false, loadingMore: false };
const scanState = { status: 'ready', outcome: null };
const subscribe = () => () => {};
const noop = async () => {};
const customerQuery = customerSearch(async () => ({ status: 'ready', value: { scope: 'self', asOf: '2026-10-15T12:00Z', customers: [] } }));
const work = { getState: () => workState, subscribe, refresh: noop, readCustomerQuotaNotices: async () => ({ status: 'unavailable' }),
  querySearch: (kind: string, request: any) => kind === 'work_targets'
    ? Promise.resolve({ status: 'ready', value: { targets: [target], nextCursor: null } })
    : customerQuery(kind as any, request) } as any;
const scan = { getState: () => scanState, subscribe, scan: noop, retry: noop } as any;
const person = { membershipId: 'person', displayName: 'Alex Beispiel', role: 'employee', location: null, isRunning: false, runningSince: null, runningTargetDisplayName: null };
const employeesState = { status: 'list', busy: false, summary: { people: [person], totalCount: 1, runningCount: 0, nextCursor: null, serverTime: '2026-10-15T12:00Z' } };
const employees = { subscribe, refresh: noop, leave() {}, getState: () => employeesState } as any;
const administrationState = { status: 'ready', outcome: null, projection: { organization: { id: 'org', locationsEnabled: false }, customers: [], nfcTags: [], nextCursor: null } };
const administration = { subscribe, getState: () => administrationState, refresh: noop, querySearch: setupSearch(() => administrationState) } as any;
const fixtures: Record<string, () => ReactElement> = {
  ScanScreen: () => h(ScanScreen, { actor: 'employee', scan, work, signOut: noop, retryRecovery: noop }),
  LoginScreen: () => h(LoginScreen, { signIn: noop, signInForEmployeeEnrollment: noop, disabled: false } as any),
  SynchronizationScreen: () => h(SynchronizationScreen, { scan, signOut: noop }),
  EmployeeEnrollmentScreen: () => h(EmployeeEnrollmentScreen, { notice: null, redeem: async () => ({ status: 'context_unavailable' as const }), signOut: noop }),
  ManualCaptureScreen: () => h(ManualCaptureScreen, { work }),
  OfflineManualCaptureScreen: () => h(OfflineManualCaptureScreen, { restorationKey: 'test', manual: { readOfflineManualTargets: async () => ({ status: 'ready', targets: [target] }) } as any }),
  OwnTimeScreen: () => h(OwnTimeScreen, { work, scan }),
  EmployeesScreen: () => h(EmployeesScreen, { employees, scope: { kind: 'organization' }, locationsEnabled: false }),
  InviteEmployeeScreen: () => h(InviteEmployeeScreen, { employees, state: { status: 'invite', busy: false, outcome: null, locationsReady: true, locations: [] }, scope: { kind: 'organization' }, locationsEnabled: false }),
  PersonTimeScreen: () => h(PersonTimeScreen, { person, value: ownTime, onBack() {}, onRefresh: noop } as any),
  CustomersScreen: () => h(CustomersScreen, { work, authorityContext: { role: 'employee' } }),
  AdminSetupScreen: () => h(AdminSetupScreen, { administration }),
};
function themed(theme: MobileTheme, child: ReactElement) {
  return h(MobileThemeContext.Provider, { value: { theme, tokens: mobileThemes[theme], preference: theme, setPreference() {} } }, child);
}
function rgb(hex: string) { return `rgb(${[1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`; }
afterEach(cleanup);
it('covers every product Screen file from the source inventory', async () => {
  const sources = (await readdir('src/screens')).filter(name => name.endsWith('Screen.tsx')).map(name => name.slice(0, -4));
  expect(Object.keys(fixtures).sort()).toEqual(sources.sort());
});
for (const [name, fixture] of Object.entries(fixtures)) it.each(['dark', 'light'] as const)(`${name} renders its theme (%s)`, async theme => {
  const { container } = render(themed(theme, fixture()));
  await waitFor(() => expect(container.textContent?.length).toBeGreaterThan(0));
  const elements = Array.from(container.querySelectorAll<HTMLElement>('*'));
  expect(elements.some(e => getComputedStyle(e).backgroundColor === rgb(mobileThemes[theme].color.ground)), name).toBe(true);
  expect(elements.some(e => getComputedStyle(e).color === rgb(mobileThemes[theme].color.text)), name).toBe(true);
});
it('changes the visible screen without resetting a form or issuing work', () => {
  const login = fixtures.LoginScreen!(); const view = render(themed('dark', login));
  fireEvent.change(screen.getByLabelText('E-Mail-Adresse'), { target: { value: 'alex@example.invalid' } });
  view.rerender(themed('light', login));
  expect((screen.getByLabelText('E-Mail-Adresse') as HTMLInputElement).value).toBe('alex@example.invalid');
});
it.each(['dark', 'light'] as const)('keeps the capture disc dark and the signal legible (%s)', theme => {
  render(themed(theme, fixtures.ScanScreen!()));
  const ring = screen.getByTestId('scan-ring');
  expect(Array.from(ring.querySelectorAll('*')).some(e => getComputedStyle(e).backgroundColor === rgb(mobileThemes[theme].color.scanDisc))).toBe(true);
  expect(ring.querySelector('svg')?.getAttribute('color')).toBe(mobileThemes[theme].color.scanAccent);
});
