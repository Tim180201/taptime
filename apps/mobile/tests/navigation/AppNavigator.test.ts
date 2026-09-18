import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { MobileSessionCapability, ProductMembershipRole } from '../../src/auth/contracts';
import type { ProductScanCapability } from '../../src/scan/contracts';
import type { AdminSetupCapability } from '../../src/administration/contracts';
import type { MobileWorkCapability } from '../../src/work/contracts';
import type { OfflineManualCaptureCapability } from '../../src/offline/OfflineCaptureCoordinator';

vi.mock('expo-constants', () => ({ default: { expoConfig: null } }));
vi.mock('react-native', () => {
  const element = ({ children, accessibilityRole, accessibilityLabel, testID }: {
    children?: ReactNode; accessibilityRole?: string; accessibilityLabel?: string; testID?: string;
  }) => createElement('div', { role: accessibilityRole, 'aria-label': accessibilityLabel, 'data-testid': testID }, children);
  return { View: element, Text: element, ScrollView: element, Pressable: element, TextInput: element,
    ActivityIndicator: element, Platform: { OS: 'android' },
    StyleSheet: { create: (value: unknown) => value, flatten: () => ({}) },
    Animated: { View: element, Value: class { interpolate() { return 1; } } },
    Easing: {}, AccessibilityInfo: {}, Linking: {}, BackHandler: {} };
});
const { AppNavigator } = await import('../../src/navigation/AppNavigator');
function markup(role: ProductMembershipRole, nfcSetupAvailable = role === 'administrator') {
  const session = { getState: () => ({ status: 'authenticated', session: {
    userId: 'user', organizationId: 'business', membershipId: 'membership', role, nfcSetupAvailable,
  } }), subscribe: () => () => {}, signOut: async () => {}, signIn: async () => ({ status: 'authenticated' }),
    signInForEmployeeEnrollment: async () => ({ status: 'authenticated' }),
    redeemEmployeeInvitation: async () => ({ status: 'enrolled' }), retryContext: async () => {}, refresh: async () => {} } satisfies MobileSessionCapability;
  const scan = { getState: () => ({ status: 'offline_ready', queueCount: 0, outcome: null }),
    subscribe: () => () => {}, scan: async () => {}, cancel: async () => {}, retry: async () => {} } as ProductScanCapability;
  const administration = { getState: () => ({ status: 'inactive' }), subscribe: () => () => {}, refresh: async () => {}, loadMore: async () => {},
    provision: async () => {}, provisionBreak: async () => {}, cancel: async () => {} } satisfies AdminSetupCapability;
  const work = { getState: () => ({ status: 'inactive' }), subscribe: () => () => {}, refresh: async () => {}, loadMoreOwnTime: async () => {},
    triggerManual: async () => {}, triggerBreak: async () => {} } satisfies MobileWorkCapability;
  return renderToStaticMarkup(createElement(AppNavigator, {
    session, scan, administration, work, offlineManual: {} as OfflineManualCaptureCapability,
  }));
}
describe('rendered navigation', () => {
  it.each(['standortleitung', 'administrator'] as const)('T060 h: renders Tags only with NFC capability (%s)', role => {
    expect(markup(role, true)).toContain('aria-label="Tags"');
    expect(markup(role, false)).not.toContain('aria-label="Tags"');
  });
  it.each(['employee', 'standortleitung', 'administrator'] as const)('renders the role-specific bottom tabs for %s', (role) => {
    const html = markup(role);
    const tabs = [...html.matchAll(/role="tab"[^>]*aria-label="([^"]+)"/g)].map((match) => match[1]);
    expect(tabs).toEqual(role === 'administrator'
      ? ['Erfassen', 'Manuell', 'Meine Zeiten', 'Tags'] : ['Erfassen', 'Manuell', 'Meine Zeiten']);
    expect(html).toContain('aria-label="Abgleich: alles bestätigt"');
  });
});
