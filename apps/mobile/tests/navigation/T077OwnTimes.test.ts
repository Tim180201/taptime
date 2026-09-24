// @vitest-environment jsdom
import { act, createElement, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MobileSessionCapability, MobileSessionState, ProductMembershipRole, ProductSessionContext } from '../../src/auth/contracts';
import type { MobileWorkApiPort, MobileWorkCapability, MobileWorkState } from '../../src/work/contracts';
import { MobileWorkCoordinator } from '../../src/work/MobileWorkCoordinator';
import type { ProductScanCapability, ProductScanState } from '../../src/scan/contracts';
import type { AdminSetupCapability } from '../../src/administration/contracts';
import type { EmployeesCapability, EmployeesState, ManagedPerson } from '../../src/employees/contracts';
import type { ManualOfflineAcknowledgement, ManualOfflineCaptureResult, OfflineManualCaptureCapability } from '../../src/offline/OfflineCaptureCoordinator';
import type { TimeEditingCapability } from '../../src/timeEditing/TimeEditingCoordinator';
import type { MobileOwnTimeQueryResponse } from '@taptime/mobile-work-contract';

vi.mock('expo-constants', () => ({ default: { expoConfig: null } }));
vi.mock('../../src/design/ScanRing', () => ({ ScanRing: () => null }));
vi.mock('react-native', () => {
  const flatten = (value: unknown): Record<string, unknown> => Array.isArray(value)
    ? Object.assign({}, ...value.map(flatten)) : value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const element = ({ children, accessibilityRole, accessibilityLabel, accessibilityState, style, onPress, disabled, numberOfLines }: {
    children?: ReactNode; accessibilityRole?: string; accessibilityLabel?: string;
    accessibilityState?: { selected?: boolean }; style?: unknown; onPress?: () => void; disabled?: boolean; numberOfLines?: number;
  }) => {
    const resolved = flatten(typeof style === 'function' ? style({ pressed: false }) : style);
    return createElement(onPress ? 'button' : 'div', { role: accessibilityRole, 'aria-label': accessibilityLabel,
      'aria-selected': accessibilityState?.selected, onClick: onPress, disabled,
      style: { display: resolved.display as string }, 'data-style': JSON.stringify(resolved), 'data-lines': numberOfLines }, children);
  };
  return { View: element, Text: element, ScrollView: element, Pressable: element,
    TextInput: ({ value, onChangeText, accessibilityLabel }: { value: string; onChangeText: (value: string) => void; accessibilityLabel: string }) =>
      createElement('input', { value, 'aria-label': accessibilityLabel, onChange: (event: React.ChangeEvent<HTMLInputElement>) => onChangeText(event.target.value) }),
    StyleSheet: { create: (value: unknown) => value, flatten }, Platform: { OS: 'android' },
    Linking: { getInitialURL: async () => null, addEventListener: () => ({ remove() {} }) },
    BackHandler: { addEventListener: () => ({ remove() {} }) },
  };
});
const { AppNavigator } = await import('../../src/navigation/AppNavigator');
const membershipId = '10000000-0000-4000-8000-000000000001';
const target = { targetType: 'customer' as const, targetId: '20000000-0000-4000-8000-000000000001', displayName: 'Testkunde' };
const value: MobileOwnTimeQueryResponse = { activeRecord: null, nextCursor: null,
  windowStartedAt: '2026-08-31T22:00:00.000Z', windowEndedAt: '2026-09-30T22:00:00.000Z', records: [{
    timeRecordId: '30000000-0000-4000-8000-000000000001', source: 'canonical', targetType: 'customer', targetDisplayName: target.displayName,
    status: 'stopped', startedAt: '2026-09-30T08:00:00.000Z', stoppedAt: '2026-09-30T09:00:00.000Z', startedVia: 'nfc', stoppedVia: 'nfc',
    details: { origin: 'nfc', baseRowVersion: 2, effectiveRevisionNumber: 1, changed: true, comment: 'Eigene Notiz',
      change: { at: '2026-09-30T10:00:00.000Z', reason: 'Ende berichtigt', actor: 'administration' }, overlapsAnotherRecord: false },
  }] };
function sessionContext(role: ProductMembershipRole, tags = false): ProductSessionContext {
  return { role, userId: 'user', organizationId: 'business', membershipId, nfcSetupAvailable: tags,
    managementScope: role === 'administrator' ? { kind: 'organization' } : role === 'standortleitung'
      ? { kind: 'location', locationId: 'location', locationName: 'Nord' } : null };
}
function store<T>(initial: T) {
  let state = initial;
  const listeners = new Set<() => void>();
  return { getState: () => state, subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    publish(next: T) { state = next; listeners.forEach(listener => listener()); } };
}
function harness(role: ProductMembershipRole | 'offline', tags = false) {
  const sessionStore = store<MobileSessionState>(role === 'offline' ? { status: 'context_unavailable' }
    : { status: 'authenticated', session: sessionContext(role, tags) });
  const session: MobileSessionCapability = { ...sessionStore, signIn: async () => ({ status: 'authenticated' }),
    signInForEmployeeEnrollment: async () => ({ status: 'authenticated' }), redeemEmployeeInvitation: async () => ({ status: 'enrolled' }),
    retryContext: async () => {}, refresh: async () => {}, signOut: async () => {} };
  const workStore = store<MobileWorkState>({ status: 'ready', ownTime: value, targets: { targets: [target], nextCursor: null },
    submitting: false, loadingMore: false, outcome: null });
  const work: MobileWorkCapability = { ...workStore, refresh: vi.fn(async () => {}), loadMoreOwnTime: vi.fn(async () => {}),
    triggerManual: async () => {}, triggerBreak: async () => {} };
  const scanStore = store<ProductScanState>({ status: 'offline_ready', queueCount: 0, outcome: null });
  const scan: ProductScanCapability = { ...scanStore, scan: async () => {}, cancel: async () => {}, retry: async () => {} };
  const administration: AdminSetupCapability = { ...store({ status: 'inactive' as const }),
    refresh: async () => {}, loadMore: async () => {}, provision: async () => {}, provisionBreak: async () => {}, cancel: async () => {} };
  const person: ManagedPerson = { membershipId, role: role === 'offline' ? 'employee' : role, displayName: 'Eigene Person',
    location: null, isRunning: false, runningSince: null, runningTargetDisplayName: null };
  const list: EmployeesState = { status: 'list', filter: false, busy: false, failed: false,
    summary: { people: [person], runningCount: 0, totalCount: 1, nextCursor: null, serverTime: value.windowEndedAt } };
  const peopleStore = store<EmployeesState>(list);
  const employees: EmployeesCapability = { ...peopleStore, refresh: vi.fn(async () => {}), filter: async () => {}, loadMore: async () => {},
    openPerson: vi.fn(async selected => peopleStore.publish({ status: 'person', person: selected, value, busy: false, failed: false })),
    loadPersonMonth: async () => {}, openInvitation: async () => {}, invite: async () => {},
    back: async () => peopleStore.publish(list), leave: () => peopleStore.publish(list) };
  const save = vi.fn<TimeEditingCapability['save']>(async () => ({ status: 'committed', timeRecordId: value.records[0]!.timeRecordId, idempotentRetry: false }));
  const editingStore = store({ online: true, busy: false });
  const timeEditing: TimeEditingCapability = { ...editingStore, save };
  const offlineManual: OfflineManualCaptureCapability = { readOfflineManualTargets: async () => ({ status: 'ready', targets: [target] }),
    captureManual: async () => ({ status: 'unavailable' }), captureBreak: async () => ({ status: 'unavailable' }) };
  return { props: { session, work, scan, administration, employees, timeEditing, offlineManual }, sessionStore, workStore, editingStore, save };
}
let root: Root, container: HTMLDivElement;
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); });
const visible = (node: Element) => !node.closest('[style*="display: none"]');
const buttons = () => [...container.querySelectorAll('button')].filter(visible);
const button = (label: string) => buttons().find(node => (node.getAttribute('aria-label') ?? node.textContent) === label);
async function press(label: string) { expect(button(label), label).toBeDefined(); await act(async () => button(label)!.click()); }
async function fill(label: string, text: string) {
  const input = container.querySelector(`input[aria-label="${label}"]`) as HTMLInputElement;
  expect(input, label).not.toBeNull();
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, text);
    input.dispatchEvent(new Event('input', { bubbles: true })); });
}
const tabs = () => [...container.querySelectorAll('[role="tablist"] [role="tab"]')].map(node => node.getAttribute('aria-label'));
const selected = () => container.querySelector('[role="tablist"] [aria-selected="true"]')?.getAttribute('aria-label');
const writeActions = () => buttons().map(node => node.textContent).filter(text => ['Zeit hinzufügen', 'Ändern', 'Kommentar schreiben', 'Beenden'].includes(text!));

describe('T-077 own times through the product navigation', () => {
  it.each([
    ['employee', false, ['Erfassen', 'Meine Zeiten']],
    ['standortleitung', false, ['Erfassen', 'Meine Zeiten', 'Mitarbeiter']],
    ['standortleitung', true, ['Erfassen', 'Meine Zeiten', 'Mitarbeiter', 'Tags']],
    ['administrator', false, ['Erfassen', 'Meine Zeiten', 'Mitarbeiter']],
    ['administrator', true, ['Erfassen', 'Meine Zeiten', 'Mitarbeiter', 'Tags']],
    ['offline', false, ['Erfassen']],
  ] as const)('orders destinations for %s with tags=%s', async (role, tagsAvailable, expected) => {
    const h = harness(role, tagsAvailable);
    await act(async () => root.render(createElement(AppNavigator, h.props)));
    expect(tabs()).toEqual(expected);
    expect(selected()).toBe('Erfassen');
    await press('Abgleich: alles bestätigt');
    expect(container.textContent).toContain('Abgleich');
    expect(selected()).toBeUndefined();
    await press('Erfassen');
    expect(button('Manuell starten')).toBeDefined();
  });

  it.each(['administrator', 'standortleitung'] as const)('opens the own Berlin calendar in one tap and keeps self in employees (%s)', async role => {
    const h = harness(role, true);
    await act(async () => root.render(createElement(AppNavigator, h.props)));
    await press('Meine Zeiten');
    expect(selected()).toBe('Meine Zeiten');
    for (const text of ['September 2026', '10:00 – 11:00', 'Europe/Berlin', 'Eigene Notiz', 'Ende berichtigt']) expect(container.textContent).toContain(text);
    const ownActions = writeActions();
    expect(ownActions).toEqual(role === 'administrator' ? ['Zeit hinzufügen', 'Kommentar schreiben', 'Ändern'] : []);
    expect(h.props.employees.refresh).not.toHaveBeenCalled();
    await press('Mitarbeiter'); await press('Eigene Person, inaktiv');
    expect(writeActions()).toEqual(ownActions);
    expect(h.props.employees.openPerson).toHaveBeenCalledWith(expect.objectContaining({ membershipId }));
  });

  it.each(['administrator', 'standortleitung'] as const)('distinguishes an empty month from a failed read and refreshes (%s)', async role => {
    const h = harness(role);
    h.workStore.publish({ status: 'ready', ownTime: { ...value, records: [] }, targets: { targets: [], nextCursor: null },
      submitting: false, loadingMore: false, outcome: null });
    await act(async () => root.render(createElement(AppNavigator, h.props)));
    await press('Meine Zeiten');
    expect(container.textContent).toContain('Für diesen Tag sind keine Zeiten erfasst.');
    expect(container.textContent).toContain('0,0 h');
    await act(async () => h.workStore.publish({ status: 'unavailable', message: 'Arbeitsdaten sind derzeit nicht erreichbar.' }));
    expect(container.querySelector('[role="alert"]')?.textContent).toBe('Arbeitsdaten sind derzeit nicht erreichbar.');
    expect(container.textContent).not.toContain('Für diesen Tag sind keine Zeiten erfasst.');
    vi.mocked(h.props.work.refresh).mockClear();
    await press('Aktualisieren'); expect(h.props.work.refresh).toHaveBeenCalledOnce();
  });

  it('follows role/scope and Tags changes in the same session, and resets when a destination disappears', async () => {
    const h = harness('administrator', true);
    await act(async () => root.render(createElement(AppNavigator, h.props)));
    await press('Mitarbeiter');
    await act(async () => h.sessionStore.publish({ status: 'authenticated', session: sessionContext('employee') }));
    expect(selected()).toBe('Erfassen'); expect(tabs()).toEqual(['Erfassen', 'Meine Zeiten']);
    await press('Meine Zeiten');
    await act(async () => h.sessionStore.publish({ status: 'authenticated', session: sessionContext('standortleitung', true) }));
    expect(selected()).toBe('Meine Zeiten'); expect(writeActions()).toEqual([]);
    await act(async () => h.sessionStore.publish({ status: 'authenticated', session: { ...sessionContext('standortleitung', true), managementScope: null } }));
    expect(selected()).toBe('Meine Zeiten'); expect(tabs()).toEqual(['Erfassen', 'Meine Zeiten', 'Tags']);
    await press('Tags');
    await act(async () => h.sessionStore.publish({ status: 'authenticated', session: sessionContext('standortleitung') }));
    expect(selected()).toBe('Erfassen');
    await press('Meine Zeiten');
    await act(async () => h.sessionStore.publish({ status: 'context_unavailable' }));
    expect(tabs()).toEqual(['Erfassen']); expect(selected()).toBe('Erfassen');
    expect(container.textContent).not.toContain('Eigene Notiz');
  });

  it('preserves self membership, correction versions, rejection messages and online checks for administrator edits', async () => {
    const h = harness('administrator');
    await act(async () => root.render(createElement(AppNavigator, h.props)));
    await press('Meine Zeiten'); await press('Zeit hinzufügen'); await press(target.displayName);
    await fill('Grund', 'Vergessen');
    h.save.mockResolvedValueOnce({ status: 'reason_required' });
    await press('Speichern');
    expect(container.textContent).toContain('Bitte begründe den Nachtrag.');
    expect((container.querySelector('input[aria-label="Grund"]') as HTMLInputElement).value).toBe('Vergessen');
    await press('Speichern');
    expect(h.save).toHaveBeenLastCalledWith('backfill', expect.objectContaining({ targetMembershipId: membershipId, reason: 'Vergessen', comment: null }));
    await press('Ändern'); await fill('Grund', 'Korrigiert'); await press('Speichern');
    expect(h.save).toHaveBeenLastCalledWith('correct', expect.objectContaining({ timeRecordId: value.records[0]!.timeRecordId,
      expectedBaseRowVersion: 2, expectedRevisionNumber: 1, reason: 'Korrigiert' }));
    await press('Kommentar schreiben'); await fill('Kommentar', 'Neue Notiz'); await press('Speichern');
    expect(h.save).toHaveBeenLastCalledWith('comment', { timeRecordId: value.records[0]!.timeRecordId, comment: 'Neue Notiz' });
    await act(async () => h.editingStore.publish({ online: false, busy: false }));
    h.save.mockClear();
    for (const label of ['Zeit hinzufügen', 'Ändern', 'Kommentar schreiben']) { expect(button(label)?.disabled).toBe(true); await press(label); }
    expect(h.save).not.toHaveBeenCalled();
  });

  it('reloads own times after a correction under the own person in employees', async () => {
    const h = harness('administrator');
    await act(async () => root.render(createElement(AppNavigator, h.props)));
    await press('Mitarbeiter'); await press('Eigene Person, inaktiv');
    await press('Ändern'); await fill('Grund', 'Zeit berichtigt'); await press('Speichern');
    expect(h.props.employees.refresh).toHaveBeenCalled();
    const previous = h.workStore.getState();
    expect(previous.status).toBe('ready');
    if (previous.status !== 'ready') throw new Error('Expected ready fixture');
    vi.mocked(h.props.work.refresh).mockClear().mockImplementation(async () => {
      h.workStore.publish({ ...previous, ownTime: { ...value, records: [{ ...value.records[0]!, stoppedAt: '2026-09-30T10:00:00.000Z' }] } });
    });
    await press('Meine Zeiten');
    expect(h.props.work.refresh).toHaveBeenCalledOnce();
    expect(container.textContent).toContain('10:00 – 12:00');
  });

  it.each(['capturing', 'awaiting_confirmation'] as const)('does not interrupt manual work when entering own times while %s', async phase => {
    const h = harness('administrator');
    const snapshot = { generation: 1, session: sessionContext('administrator') };
    let acknowledge = () => {};
    let acknowledgement: ManualOfflineAcknowledgement = { status: 'pending' };
    let finishCapture!: (result: ManualOfflineCaptureResult) => void;
    const read = vi.fn<MobileWorkApiPort['read']>(async () => ({ status: 'ready', ownTime: value, targets: { targets: [target], nextCursor: null } }));
    const work = new MobileWorkCoordinator({ capture: () => snapshot, isCurrent: candidate => candidate === snapshot, subscribe: () => () => {} },
      { read, readOwnTimePage: async () => ({ status: 'unavailable' }), triggerManual: async () => ({ status: 'unavailable' }) },
      { captureManual: () => new Promise(resolve => { finishCapture = resolve; }),
        readManualAcknowledgement: () => acknowledgement,
        subscribeManualAcknowledgements: listener => { acknowledge = listener; return () => { acknowledge = () => {}; }; } });
    work.start();
    try {
      await act(async () => root.render(createElement(AppNavigator, { ...h.props, work })));
      await press('Manuell starten'); await press(target.displayName); await press('Jetzt erfassen');
      if (phase === 'awaiting_confirmation') await act(async () => finishCapture({ status: 'saved', workEventId: 'manual-event' }));
      // A navigation read must not replace capture's generation or overtake its acknowledgement.
      await press('Meine Zeiten');
      expect(read).toHaveBeenCalledOnce();
      if (phase === 'capturing') await act(async () => finishCapture({ status: 'saved', workEventId: 'manual-event' }));
      expect(work.getState()).toMatchObject({ status: 'ready', submitting: false, outcome: 'pending' });
      const activeRecord = { ...value.records[0]!, status: 'started' as const, stoppedAt: null };
      read.mockResolvedValueOnce({ status: 'ready', ownTime: { ...value, records: [], activeRecord }, targets: { targets: [target], nextCursor: null } });
      await act(async () => { acknowledgement = { status: 'server_decision', outcome: 'time_entry_started' }; acknowledge(); });
      expect(read).toHaveBeenCalledTimes(2);
      expect(work.getState()).toMatchObject({ status: 'ready', outcome: 'time_entry_started', ownTime: { activeRecord } });
      expect(container.textContent).toContain('läuft');
    } finally { await act(async () => work.stop()); }
  });

  it('keeps an already loading work projection when entering own times', async () => {
    const h = harness('administrator');
    await act(async () => root.render(createElement(AppNavigator, h.props)));
    await act(async () => h.workStore.publish({ status: 'loading' }));
    vi.mocked(h.props.work.refresh).mockClear();
    await press('Meine Zeiten');
    expect(h.props.work.refresh).not.toHaveBeenCalled();
    expect(container.textContent).toContain('Arbeitszeiten werden geladen …');
  });
});
