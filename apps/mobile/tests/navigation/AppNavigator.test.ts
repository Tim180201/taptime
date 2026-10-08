import { APP_NAME } from '../../../../shared/product';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { MobileSessionCapability, ProductMembershipRole } from '../../src/auth/contracts';
import type { ProductScanCapability } from '../../src/scan/contracts';
import type { AdminSetupCapability } from '../../src/administration/contracts';
import type { MobileWorkCapability } from '../../src/work/contracts';
import type { OfflineManualCaptureCapability } from '../../src/offline/OfflineCaptureCoordinator';

const presses=vi.hoisted(()=>new Map<string,()=>Promise<void>>());
vi.mock('expo-constants', () => ({ default: { expoConfig: null } }));
vi.mock('react-native', () => {
  const element = ({ children, accessibilityRole, accessibilityLabel, testID, onPress }: {
    children?: ReactNode; accessibilityRole?: string; accessibilityLabel?: string; testID?: string; onPress?:()=>Promise<void>;
  }) => {if(testID && onPress)presses.set(testID,onPress);return createElement('div', { role: accessibilityRole, 'aria-label': accessibilityLabel, 'data-testid': testID }, children);};
  return { View: element, Text: element, ScrollView: element, Pressable: element, TextInput: element,
    ActivityIndicator: element, Platform: { OS: 'android' },
    StyleSheet: { create: (value: unknown) => value, flatten: () => ({}) },
    Animated: { View: element, Value: class { interpolate() { return 1; } } },
    Easing: {}, AccessibilityInfo: {}, Linking: {}, BackHandler: {} };
});
const { AppNavigator } = await import('../../src/navigation/AppNavigator');
function markup(role: ProductMembershipRole, nfcSetupAvailable = role === 'administrator', paused = false, updateRequired = false, override?: import('../../src/auth/contracts').MobileSessionState, scanOverride?: import('../../src/scan/contracts').ProductScanState,retryContext=async()=>{}) {
  presses.clear();
  const session = { getState: () => override ?? (updateRequired ? {status: 'context_unavailable', updateRequired: true} : paused ? {status: 'context_unavailable', organizationPaused: true} : ({ status: 'authenticated', session: {
    userId: 'user', organizationId: 'business', membershipId: 'membership', role, nfcSetupAvailable,
  } })), subscribe: () => () => {}, signOut: async () => {}, signIn: async () => ({ status: 'authenticated' }),
    signInForEmployeeEnrollment: async () => ({ status: 'authenticated' }),
    redeemEmployeeInvitation: async () => ({ status: 'enrolled' }), retryContext, refresh: async () => {} } satisfies MobileSessionCapability;
  const scan = { getState: () => scanOverride ?? ({ status: 'offline_ready', queueCount: 0, outcome: null }),
    subscribe: () => () => {}, scan: async () => {}, cancel: async () => {}, retry: async () => {} } as ProductScanCapability;
  const administration = { getState: () => ({ status: 'inactive' }), subscribe: () => () => {}, refresh: async () => {}, loadMore: async () => {},
    provision: async () => {}, provisionBreak: async () => {}, prepareCustomer: async () => ({ status: 'unavailable' as const }), createCustomer: async () => {}, cancel: async () => {} } satisfies AdminSetupCapability;
  const work = { getState: () => ({ status: 'inactive' }), subscribe: () => () => {}, refresh: async () => {}, loadMoreOwnTime: async () => {},
    triggerManual: async () => {}, triggerBreak: async () => {}, stopActiveTime: async () => {} } satisfies MobileWorkCapability;
  return renderToStaticMarkup(createElement(AppNavigator, {
    session, scan, administration, work, offlineManual: {} as OfflineManualCaptureCapability,
  }));
}
describe('rendered navigation', () => {
  it('T-096 shows the update instruction even when an offline capture shell was ready', () => {
    const html = markup('employee', false, false, true);
    expect(html).toContain('Bitte App aktualisieren');
    expect(html).toContain('Deine Erfassungen bleiben auf dem Handy gespeichert.');
    expect(html).not.toContain('role="tab"');
    expect(html).not.toContain('Erneut versuchen');
  });
  it('T068a shows the pause notice even when an offline capture shell was ready', () => {
    const html = markup('employee', false, true);
    expect(html).toContain(`Dein Betrieb ist pausiert. Bitte wende dich an ${APP_NAME}.`);
    expect(html).not.toContain('role="tab"');
  });
  it.each(['standortleitung', 'administrator'] as const)('T060 h: renders Karten only with NFC capability (%s)', role => {
    expect(markup(role, true)).toContain('aria-label="Karten"');
    expect(markup(role, false)).not.toContain('aria-label="Karten"');
  });
  it.each(['employee', 'standortleitung', 'administrator'] as const)('renders the role-specific bottom tabs for %s', (role) => {
    const html = markup(role);
    const tabs = [...html.matchAll(/role="tab"[^>]*aria-label="([^"]+)"/g)].map((match) => match[1]);
    expect(tabs).toEqual(role === 'administrator'
      ? ['Erfassen', 'Meine Zeiten', 'Kunden', 'Karten'] : ['Erfassen', 'Meine Zeiten', 'Kunden']);
    expect(html).toContain('aria-label="Übertragung: alles bestätigt"');
  });
});


it.each([
  [{status:'runtime_unavailable',reason:'storage_unavailable'},'S2'],
  [{status:'runtime_unavailable',reason:'authentication_unavailable'},'S1'],
  [{status:'recovery_required',reason:'session_cleanup'},'S4'],
  [{status:'recovery_required',reason:'token_persistence'},'S3'],
] as const)('T-115 renders recovery action and non-sensitive code %s', (state,code)=>{
  const html=markup('employee',false,false,false,state);
  expect(html).toContain('Erneut versuchen');expect(html).toContain('Code '+code);
});
it('T-115 TL keeps recoverable P01 in Erfassen with the other destinations visible',()=>{
  const html=markup('employee',false,false,false,undefined,{status:'protected_pending',reason:'local_evidence_protected',protection:['P01'],identityRecovery:'secure_store'});
  expect(html).toContain('Sicherer Speicher gerade nicht lesbar');
  expect(html).toContain('Neue Scans sind gesperrt, bis der Speicher wieder lesbar ist. Deine Erfassungen bleiben erhalten.');
  expect(html).toContain('Erneut versuchen');expect(html).toContain('Code P01');
  expect(html).toContain('aria-label="Erfassen"');expect(html).toContain('aria-label="Meine Zeiten"');
  expect(html).toContain('aria-label="Kunden"');
});
it('T-115 TL preserves the product surface and support text for integrity P01',()=>{
  const html=markup('employee',false,false,false,undefined,{status:'protected_pending',reason:'local_evidence_protected',protection:['P01']});
  expect(html).toContain('Lokaler Speicher geschützt');
  expect(html).toContain('Die Vorgänge im lokalen Speicher können gerade nicht sicher gelesen oder verarbeitet werden. Lösche weder die App noch ihre Daten und wende dich an den Support.');
  expect(html).not.toContain('Erneut versuchen');expect(html).toContain('aria-label="Meine Zeiten"');
});
it.each([undefined,'secure_store'] as const)('T-115 TL leaves login accessible with P01 (%s)',identityRecovery=>{
  const html=markup('employee',false,false,false,{status:'unauthenticated',reason:'not_signed_in'},{status:'protected_pending',reason:'local_evidence_protected',protection:['P01'],identityRecovery});
  expect(html).toContain('E-Mail-Adresse');expect(html).not.toContain('Erneut versuchen');
});
it('T-115 keeps sign-in failure text and code on the login page',()=>{
  const html=markup('employee',false,false,false,{status:'unauthenticated',reason:'sign_in_unavailable'});
  expect(html).toContain('Anmeldung gerade nicht möglich. Prüfe die Verbindung und versuche es erneut.');
  expect(html).toContain('Code S5');expect(html).toContain('E-Mail-Adresse');
});

it('T-115 TL wires the Erfassen retry button to runtime session recovery',async()=>{
  const retry=vi.fn(async()=>{});
  markup('employee',false,false,false,undefined,{status:'secure_storage_unavailable',protection:['P01'],identityRecovery:'secure_store'},retry);
  const press=presses.get('retry-secure-storage-button');
  expect(press).toBeTypeOf('function');await press!();expect(retry).toHaveBeenCalledOnce();
});
