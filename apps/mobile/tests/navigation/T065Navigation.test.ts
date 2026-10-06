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
    AccessibilityInfo: { isReduceMotionEnabled: async () => true, addEventListener: () => ({ remove() {} }) },
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
const unavailableState={status:'unavailable' as const,message:'Arbeitsdaten sind derzeit nicht erreichbar.'};
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
  let workState: MobileWorkState = { status: 'ready', submitting: false, loadingMore: false, outcome: null,
    targets: { targets: [target], nextCursor: null }, ownTime };
  const calls: string[] = [];
  const workListeners=new Set<()=>void>();
  const publishWork=()=>workListeners.forEach(listener=>listener());
  const work: MobileWorkCapability = { getState: () => workState, subscribe: listener=>{workListeners.add(listener);return()=>{workListeners.delete(listener);};}, refresh: vi.fn(async () => {}),
    loadMoreOwnTime: async () => {}, triggerManual: vi.fn(async value => { expect(value).toEqual(target); calls.push('work');
      if(workState.status!=='ready')return;
      const active=workState.ownTime.activeRecord;
      workState={...workState,ownTime:{...ownTime,activeRecord:active?null:{timeRecordId:'entry',source:'canonical',targetType:target.targetType,targetId:target.targetId,targetDisplayName:target.displayName,status:'started',startedAt:'2026-09-21T08:00:00Z',stoppedAt:null,startedVia:'manual',stoppedVia:null,breakStartedAt:null}}};publishWork(); }),
    stopActiveTime:vi.fn(async()=>{calls.push('work');if(workState.status==='ready')workState={...workState,ownTime};publishWork();}),
    triggerBreak: vi.fn(async () => { calls.push('break');if(workState.status==='ready' && workState.ownTime.activeRecord) {
      workState={...workState,ownTime:{...workState.ownTime,activeRecord:{...workState.ownTime.activeRecord,breakStartedAt:workState.ownTime.activeRecord.breakStartedAt?null:'2026-09-21T09:00:00Z'}}};publishWork();} }) };
  const offlineManual: OfflineManualCaptureCapability = { readOfflineManualTargets: async () => ({ status: 'ready', targets: [target] }),
    captureManual: vi.fn(async value => { expect(value).toEqual(target); calls.push('work'); return { status: 'saved' as const, workEventId: `event-${calls.length}` }; }),
    captureBreak: vi.fn(async () => { calls.push('break'); return { status: 'saved' as const, workEventId: `event-${calls.length}` }; }) };
  const administration: AdminSetupCapability = { getState: () => ({ status: 'inactive' }), subscribe: () => () => {},
    refresh: vi.fn(async () => {}), loadMore: async () => {}, provision: async () => {}, provisionBreak: async () => {}, prepareCustomer: async () => ({ status: 'unavailable' as const }), createCustomer: async () => {}, cancel: async () => {} };
  return { props: { session, scan, work, offlineManual, administration }, calls,
    publish(state: MobileSessionState) { sessionState = state; listeners.forEach(listener => listener()); } };
}

describe('T-065 rendered navigation and manual lifecycle', () => {
  it('T-095 endpoint pause offers retry without blaming or quarantining an individual capture',async()=>{
    const h=harness('employee');
    const paused={status:'saved_locally' as const,queueCount:1,transmissionPaused:true,transmissionRetryAvailable:true};
    h.props.scan.getState=()=>paused;h.props.scan.retry=vi.fn(async()=>{});
    await act(async()=>root.render(createElement(AppNavigator,h.props)));
    expect(container.textContent).toContain('Übertragung angehalten');
    expect(container.textContent).not.toContain('1 Erfassung konnte nicht übertragen werden');
    expect(container.textContent).not.toContain('Sicher lokal gespeichert');
    await press('Erneut versuchen');expect(h.props.scan.retry).toHaveBeenCalledOnce();
    await press('Abgleich: Übertragung angehalten');
    await press('Erneut versuchen');expect(h.props.scan.retry).toHaveBeenCalledTimes(2);
  });
  it('T-095 D-121 displays the halted transfer with target/time and no progress message',async()=>{
    const h=harness('employee');
    const halted={status:'saved_locally' as const,queueCount:1,transmissionPaused:true,untransferred:[{workEventId:'failed',occurredAt:'2026-10-05T06:12:00Z',displayName:'Kunde X',reason:'lease_binding_conflict'}]};
    h.props.scan.getState=()=>halted;
    await act(async()=>root.render(createElement(AppNavigator,h.props)));
    expect(container.textContent).toContain('Übertragung angehalten: 1 Erfassung konnte nicht übertragen werden. Bitte wende dich an deine Verwaltung.');
    expect(container.textContent).toContain('Kunde X · 08:12');
    expect(container.textContent).not.toContain('Sicher lokal gespeichert');
    expect(container.textContent).not.toContain('Wird übertragen');
    await press('Abgleich: Übertragung angehalten');
    expect(container.textContent).toContain('Bitte wende dich an deine Verwaltung.');
    expect(container.textContent).not.toContain('Wird nachgereicht');
  });
  it('T-095 D-120 shows the waiting notice and the forced sign-out action',async()=>{
    const h=harness('employee');
    const waiting={status:'archive_signout_pending' as const};
    h.props.scan.getState=()=>waiting;
    h.props.session.signOutImmediately=vi.fn(async()=>{});
    h.props.session.cancelSignOut=vi.fn(async()=>{});
    await act(async()=>root.render(createElement(AppNavigator,h.props)));
    expect(container.textContent).toContain('Deine Erfassungen werden noch gesichert. Abmelden ist gleich möglich.');
    await press('Angemeldet bleiben');expect(h.props.session.cancelSignOut).toHaveBeenCalledOnce();
    await press('Trotzdem abmelden');expect(h.props.session.signOutImmediately).toHaveBeenCalledOnce();
    expect(container.querySelector('[aria-label="Manuell erfassen"]')).toBeNull();
  });
  it.each([false,true])('T-095 displays quarantined targets in capture and own times with unavailable API %s', async unavailable => {
    const h=harness('employee');
    const scanState={status:'ready' as const,outcome:null,untransferred:[{workEventId:'protected',occurredAt:'2026-10-04T06:12:00Z',displayName:'Kunde X',reason:'event_content_conflict'}]};
    h.props.scan.getState=()=>scanState;
    if(unavailable)h.props.work.getState=()=>unavailableState;
    await act(async()=>root.render(createElement(AppNavigator,h.props)));
    expect(container.textContent).toContain('1 Erfassung konnte nicht übertragen werden');
    expect(container.textContent).toContain('Kunde X · 08:12');
    await press('Meine Zeiten');
    expect(container.textContent).toContain('nicht übertragen');expect(container.textContent).toContain('Zeit hinzufügen');
    expect(container.textContent).toContain('sperrt den Kontowechsel');
  });
  it('T-095 leaves the offline manual path available while a confirmed-state action is pending',async()=>{
    const h=harness('employee');
    const before=h.props.work.getState();
    const pending=before.status==='ready'?{...before,capturePending:true,submitting:false,outcome:'pending' as const}:before;
    h.props.work.getState=()=>pending;
    await act(async()=>root.render(createElement(AppNavigator,h.props)));
    await press('Manuell erfassen');
    expect(container.textContent).toContain('Wird übertragen …');
    await press(target.displayName);await press('Jetzt erfassen');
    expect(h.props.offlineManual.captureManual).toHaveBeenCalledOnce();
    expect(h.props.work.triggerManual).not.toHaveBeenCalled();
    expect(container.textContent).toContain('gespeichert, wird übertragen');
  });
  it('T103 shows only the last confirmed own status offline and discards it after logout', async () => {
    const h = harness('employee');
    await act(async()=>root.render(createElement(AppNavigator,h.props)));
    await press('Manuell erfassen');await press(target.displayName);await press('Zeit starten');await press('Pause starten');
    await act(async()=>h.publish({status:'context_unavailable'}));await press('Manuell erfassen');
    expect(container.textContent).toContain('Pause seit 11:00 · Testkunde');
    expect(container.textContent).toContain('Stand 14:00, offline');
    await press(target.displayName);await press('Jetzt erfassen');
    expect(container.textContent).toContain('Pause seit 11:00 · Testkunde');
    expect(h.props.offlineManual.captureManual).toHaveBeenCalledTimes(1);
    await act(async()=>h.publish({status:'signed_out'}));
    await act(async()=>h.publish({status:'context_unavailable'}));await press('Manuell erfassen');
    expect(container.textContent).toContain('Noch kein bestätigter Stand verfügbar');
    expect(container.textContent).not.toContain('Pause seit 11:00');
  });
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
    await press('Manuell erfassen');
    if(role==='offline') {
      await press(target.displayName);await press('Jetzt erfassen');
      await press('Pause');await press('Jetzt erfassen');await press('Jetzt erfassen');
      await press(target.displayName);await press('Jetzt erfassen');
    } else {
      await press(target.displayName);await press('Zeit starten');
      await press('Pause starten');await press('Pause beenden');await press('Zeit beenden');
    }
    expect(h.calls).toEqual(['work', 'break', 'break', 'work']);
    if (role === 'offline') {
      expect(h.props.work.triggerManual).not.toHaveBeenCalled();
      expect(h.props.work.triggerBreak).not.toHaveBeenCalled();
      expect(container.textContent).toContain('gespeichert, wird übertragen');
    } else {
      expect(h.props.offlineManual.captureManual).not.toHaveBeenCalled();
      expect(h.props.offlineManual.captureBreak).not.toHaveBeenCalled();
    }
    await act(async () => { expect(native.back?.()).toBe(true); });
    button('Manuell erfassen');
    await press('Manuell erfassen'); await press('Zurück');
    button('Manuell erfassen');
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
      expect(style.flex).toBe(1);
      expect(day.querySelector('[data-lines="1"][data-shrink="true"]')).not.toBeNull();
    }
  });
});
