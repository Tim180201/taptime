// @vitest-environment jsdom
import { createCanonicalNfcUidPayload } from '@taptime/core';
import { act, createElement, useEffect, useImperativeHandle, type ReactNode, type Ref } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { AdminSessionSnapshot, AdminSetupApiPort, AdminSetupState } from '../../src/administration/contracts';
import { AdminSetupCoordinator } from '../../src/administration/AdminSetupCoordinator';
import { TapTimeAdministrationApiClient } from '../../src/administration/TapTimeAdministrationApiClient';

const native = vi.hoisted(() => ({ scroll: vi.fn(), reduced: false, headingY: 648 }));
vi.mock('../../src/timeEditing/TimeVoidControls', () => ({ VoidedTimeRows: () => null }));
vi.mock('../../src/timeEditing/TimeEditingControls', () => ({ AddTimeControl: () => null, TimeRecordControls: () => null }));
vi.mock('react-native', () => {
  type Props = { children?: ReactNode; onPress?: () => void; disabled?: boolean; accessibilityRole?: string;
    accessibilityLabel?: string; accessibilityState?: { selected?: boolean }; onLayout?: (event: unknown) => void };
  const element = ({ children, onPress, disabled, accessibilityRole, accessibilityLabel, accessibilityState, onLayout }: Props) => {
    useEffect(() => { onLayout?.({ nativeEvent: { layout: { y: native.headingY } } }); }, []);
    return createElement(onPress ? 'button' : 'div', { onClick: onPress, disabled, role: accessibilityRole,
      'aria-label': accessibilityLabel, 'aria-selected': accessibilityState?.selected }, children);
  };
  return { View: element, Text: element, Pressable: element,
    ScrollView: ({ ref, children }: { ref?: Ref<unknown>; children?: ReactNode }) => {
      useImperativeHandle(ref, () => ({ scrollTo: native.scroll })); return createElement('div', {}, children);
    },
    TextInput: ({ value, onChangeText, accessibilityLabel }: { value: string; onChangeText: (value: string) => void; accessibilityLabel: string }) =>
      createElement('input', { value, 'aria-label': accessibilityLabel, onChange: (event: React.ChangeEvent<HTMLInputElement>) => onChangeText(event.target.value) }),
    StyleSheet: { create: (value: unknown) => value }, Platform: { OS: 'android' },
    BackHandler: { addEventListener: () => ({ remove() {} }) },
    AccessibilityInfo: { isReduceMotionEnabled: async () => native.reduced, addEventListener: () => ({ remove() {} }) },
  };
});
const { AdminSetupScreen } = await import('../../src/screens/AdminSetupScreen');
const { CustomersScreen } = await import('../../src/screens/CustomersScreen');
const { TimeCalendar } = await import('../../src/screens/TimeCalendar');
const locationA = '50000000-0000-4000-8000-000000000001';
const customer = { id: '40000000-0000-4000-8000-000000000001', displayName: 'Neuer Kunde', active: true };
const snapshot: AdminSessionSnapshot = { generation: 1, session: { userId: '10000000-0000-4000-8000-000000000001', membershipId: '20000000-0000-4000-8000-000000000001', organizationId: '30000000-0000-4000-8000-000000000001', role: 'standortleitung', nfcSetupAvailable: true, locationsEnabled: true } };
const empty = { status: 'succeeded' as const, organization: { id: snapshot.session.organizationId, name: 'Testbetrieb' }, customers: [] as typeof customer[], nfcTags: [], nextCursor: null };
function harness(locations = [{ id: locationA, displayName: 'Nord' }]) {
  let current = snapshot;
  const online = vi.fn(async () => true);
  const api = { manageCustomer: vi.fn<NonNullable<AdminSetupApiPort['manageCustomer']>>(async()=>({status:'succeeded'})), readProjection: vi.fn<AdminSetupApiPort['readProjection']>(async () => empty),
    readCustomerLocations: vi.fn(async () => ({ status: 'succeeded' as const, locations, nextCursor: null })),
    createCustomer: vi.fn<NonNullable<AdminSetupApiPort['createCustomer']>>(async () => ({ status: 'succeeded', customer })),
    provisionTag: vi.fn<AdminSetupApiPort['provisionTag']>(async () => ({ status: 'succeeded', validationFingerprint:'ABCDEF123456' })) };
  const nfc = { scan: vi.fn(async () => ({ status: 'captured' as const, payload: createCanonicalNfcUidPayload('04AABBCCDD1122') })), checkCapability: vi.fn(), cancelCapture: vi.fn(), stop: vi.fn() };
  const writer = { write: vi.fn<import('../../src/administration/NfcTagWriter').NfcTagWriter['write']>(async () => ({ status: 'written' })), cancel: vi.fn() };
  const coordinator = new AdminSetupCoordinator({ capture: () => current, isCurrent: candidate => candidate === current, subscribe: () => () => {} },
    nfc, api,
    () => '60000000-0000-4000-8000-000000000001', writer, online);
  return { api, coordinator, online, nfc, writer, replace() { current = { ...snapshot, generation: 2 }; } };
}
let root: Root, container: HTMLDivElement;
beforeEach(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); native.scroll.mockClear(); native.reduced = false;
  container = document.createElement('div'); document.body.append(container); root = createRoot(container); });
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
const click = async (label: string) => { const button = [...container.querySelectorAll('button')].find(node => node.textContent === label || node.getAttribute('aria-label') === label); if (!button) throw Error(label); await act(async () => button.click()); };
const fill = async (label: string, value: string) => { await act(async () => fireEvent.change(container.querySelector(`[aria-label="${label}"]`)!, { target: { value } })); };

it.each([1, 2])('T100 creates from Customers and immediately assigns a tag (%s locations)', async count => {
  const h = harness(count === 1 ? undefined : [{ id: locationA, displayName: 'Nord' }, { id: '50000000-0000-4000-8000-000000000002', displayName: 'Süd' }]);
  await h.coordinator.start();
  await act(async () => root.render(createElement(CustomersScreen, { administration: h.coordinator, authorityContext: snapshot.session, work: {readCustomerHours: async () => ({status:'ready', value:{version:'customer-hours.v1',scope:'people',asOf:new Date().toISOString(),customers:[]}})} as unknown as import('../../src/work/contracts').MobileWorkCapability })));
  await click('+ Kunde hinzufügen'); await fill('Name des neuen Kunden', customer.displayName);
  if (count === 2) await click('Nord');
  h.api.readProjection.mockResolvedValue({ ...empty, customers: [customer] });
  await click('NFC-Tag zuordnen');
  expect(h.api.createCustomer).toHaveBeenCalledWith({ expectedMembershipId: snapshot.session.membershipId,
    commandId: '60000000-0000-4000-8000-000000000001', displayName: customer.displayName, locationId: locationA });
  expect(h.api.provisionTag).toHaveBeenCalledWith(expect.objectContaining({customerId:customer.id, displayName:customer.displayName}));
  expect(container.textContent).not.toContain('Admin-Web');
});
it('shows the offline hint, preserves the name and never queues or sends a customer command', async () => {
  const h = harness(); await h.coordinator.start();
  await act(async () => root.render(createElement(CustomersScreen, { administration: h.coordinator, authorityContext: snapshot.session, work: {readCustomerHours: async () => ({status:'ready', value:{version:'customer-hours.v1',scope:'people',asOf:new Date().toISOString(),customers:[]}})} as unknown as import('../../src/work/contracts').MobileWorkCapability })));
  await click('+ Kunde hinzufügen'); await fill('Name des neuen Kunden', 'Noch offline');
  h.online.mockResolvedValue(false); await click('Nur anlegen');
  expect(container.textContent).toContain('Du bist offline');
  expect((container.querySelector('[aria-label="Name des neuen Kunden"]') as HTMLInputElement).value).toBe('Noch offline');
  expect(h.api.createCustomer).not.toHaveBeenCalled();
  expect(h.coordinator.getState().status).toBe('ready');
});
it('retries an ambiguous result with the same command and ignores a late response after account change', async () => {
  const h = harness(); await h.coordinator.start();
  h.api.createCustomer.mockResolvedValueOnce({ status: 'transient_failure' });
  await h.coordinator.createCustomer(customer.displayName, locationA);
  await h.coordinator.createCustomer(customer.displayName, locationA);
  expect(h.api.createCustomer.mock.calls[0]).toEqual(h.api.createCustomer.mock.calls[1]);
  let resolve!: (result: Awaited<ReturnType<NonNullable<AdminSetupApiPort['createCustomer']>>>) => void;
  h.api.createCustomer.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  const pending = h.coordinator.createCustomer('Spät', locationA);
  await vi.waitFor(() => expect(resolve).toBeDefined()); h.replace(); resolve({ status: 'succeeded', customer }); await pending;
  expect((h.coordinator.getState() as Extract<AdminSetupState, { status: 'ready' }>).outcome).toBeUndefined();
});
it('uses the strict HTTP customer/location contract without altering the existing projection', async () => {
  const request = { post: vi.fn(async (_endpoint: URL, _body: string) => ({ status: 'response' as const, statusCode: 200, contentType: 'application/json',
    body: JSON.stringify({ status: 'succeeded', customer, idempotentRetry: false }) })) };
  const api = new TapTimeAdministrationApiClient('https://test.invalid/', request);
  const command = { expectedMembershipId: snapshot.session.membershipId, commandId: '60000000-0000-4000-8000-000000000001', displayName: customer.displayName, locationId: locationA };
  await expect(api.createCustomer(command)).resolves.toEqual({ status: 'succeeded', customer });
  expect(JSON.parse(request.post.mock.calls[0]![1] as string)).toEqual(command);
  request.post.mockResolvedValueOnce({ status: 'response', statusCode: 400, contentType: 'application/json', body: JSON.stringify({ error: { code: 'location_required' } }) });
  await expect(api.createCustomer(command)).resolves.toEqual({ status: 'location_required' });
});
it.each([false, true])('scrolls a selected calendar day to its measured heading (reduced motion: %s), never on month change', async reduced => {
  native.reduced = reduced;
  const changeMonth = vi.fn();
  const value = { records: [], activeRecord: null, nextCursor: null, windowStartedAt: '2026-09-01T00:00:00.000Z', windowEndedAt: '2026-09-30T22:00:00.000Z' };
  await act(async () => root.render(createElement(TimeCalendar, { value, onMonthChange: changeMonth, onRefresh: async () => {} })));
  expect(native.scroll).not.toHaveBeenCalled();
  const day = container.querySelector('[aria-label^="15.09.2026"]') as HTMLButtonElement;
  await act(async () => day.click());
  expect(native.scroll).toHaveBeenLastCalledWith({ y: native.headingY, animated: !reduced });
  native.scroll.mockClear(); await click('Voriger Monat');
  expect(changeMonth).toHaveBeenCalledWith('2026-08'); expect(native.scroll).not.toHaveBeenCalled();
});

it('T100 removes customer creation from Tags and hides customer actions from employees', async () => {
  const h = harness(); await h.coordinator.start();
  await act(async () => root.render(createElement(AdminSetupScreen, {administration:h.coordinator})));
  await click('Tag zuordnen'); expect(container.textContent).not.toContain('+ Neuer Kunde');
  await act(async () => root.render(createElement(CustomersScreen, {administration:h.coordinator,
    authorityContext:{role:'employee'}, work:{} as unknown as import('../../src/work/contracts').MobileWorkCapability})));
  expect(container.textContent).not.toContain('+ Kunde hinzufügen');
});
it('T100 only creates without reading or writing a tag', async () => {
  const h = harness(); await h.coordinator.start();
  await act(async () => root.render(createElement(CustomersScreen, {administration:h.coordinator,
    authorityContext:snapshot.session, work:{} as unknown as import('../../src/work/contracts').MobileWorkCapability})));
  await click('+ Kunde hinzufügen'); await fill('Name des neuen Kunden', customer.displayName);
  h.api.readProjection.mockResolvedValue({...empty,customers:[customer]});
  await click('Nur anlegen'); expect(h.api.createCustomer).toHaveBeenCalledTimes(1);
  expect(h.api.provisionTag).not.toHaveBeenCalled(); expect(h.nfc.scan).not.toHaveBeenCalled(); expect(h.writer.write).not.toHaveBeenCalled(); expect(container.textContent).toContain('Kunde angelegt');
});

it('T100 retries tag writing without creating another customer', async () => {
  const h=harness(); await h.coordinator.start();
  await act(async()=>root.render(createElement(CustomersScreen,{administration:h.coordinator,
    authorityContext:snapshot.session,work:{} as import('../../src/work/contracts').MobileWorkCapability})));
  await click('+ Kunde hinzufügen'); await fill('Name des neuen Kunden', customer.displayName);
  h.api.readProjection.mockResolvedValue({...empty,customers:[customer]});
  h.writer.write.mockResolvedValueOnce({status:'failed',reason:'write_failed'});
  await click('NFC-Tag zuordnen'); expect(container.textContent).toContain('Tag konnte nicht beschrieben');
  await click('Tag-Zuordnung erneut versuchen');
  expect(h.api.createCustomer).toHaveBeenCalledTimes(1); expect(h.api.provisionTag).toHaveBeenCalledTimes(1);
  expect(container.textContent).toContain('Kunde angelegt und Tag zugeordnet');
});
it('T100 reloads a confirmed customer before retrying a failed list refresh, without another insert', async () => {
  const h=harness(); await h.coordinator.start();
  await act(async()=>root.render(createElement(CustomersScreen,{administration:h.coordinator,
    authorityContext:snapshot.session,work:{} as import('../../src/work/contracts').MobileWorkCapability})));
  await click('+ Kunde hinzufügen'); await fill('Name des neuen Kunden', customer.displayName);
  await click('NFC-Tag zuordnen'); expect(h.nfc.scan).not.toHaveBeenCalled();
  h.api.readProjection.mockResolvedValue({...empty,customers:[customer]});
  await click('Tag-Zuordnung erneut versuchen');
  expect(h.api.createCustomer).toHaveBeenCalledTimes(1); expect(h.api.provisionTag).toHaveBeenCalledTimes(1);
});
it('T100 cancels a running setup scan when leaving Customers', async () => {
  const h=harness(); await h.coordinator.start();
  await act(async()=>root.render(createElement(CustomersScreen,{administration:h.coordinator,
    authorityContext:snapshot.session,work:{} as import('../../src/work/contracts').MobileWorkCapability})));
  await click('+ Kunde hinzufügen'); await fill('Name des neuen Kunden', customer.displayName);
  h.api.readProjection.mockResolvedValue({...empty,customers:[customer]});
  h.nfc.scan.mockImplementationOnce(()=>new Promise(()=>{}));
  await click('NFC-Tag zuordnen'); h.nfc.cancelCapture.mockClear();
  await act(async()=>root.render(createElement('div')));
  expect(h.nfc.cancelCapture).toHaveBeenCalledTimes(1);
});

it('T100 finishes Only create even when the following list refresh fails', async () => {
  const h=harness(); await h.coordinator.start();
  await act(async()=>root.render(createElement(CustomersScreen,{administration:h.coordinator,
    authorityContext:snapshot.session,work:{} as import('../../src/work/contracts').MobileWorkCapability})));
  await click('+ Kunde hinzufügen'); await fill('Name des neuen Kunden', customer.displayName);
  await click('Nur anlegen'); expect(h.api.createCustomer).toHaveBeenCalledTimes(1);
  expect(container.querySelector('[aria-label="Name des neuen Kunden"]')).toBeNull();
  expect(container.textContent).toContain('Kunde angelegt');
  expect(h.nfc.scan).not.toHaveBeenCalled();
});

it('T100 recovers customer creation after initial setup loading failed', async () => {
  const h=harness(); h.api.readProjection.mockResolvedValueOnce({status:'unavailable'});
  await h.coordinator.start(); expect(h.coordinator.getState().status).toBe('inactive');
  await act(async()=>root.render(createElement(CustomersScreen,{administration:h.coordinator,
    authorityContext:snapshot.session,work:{} as import('../../src/work/contracts').MobileWorkCapability})));
  await click('+ Kunde hinzufügen'); await fill('Name des neuen Kunden',customer.displayName);
  h.api.readProjection.mockResolvedValue({...empty,customers:[customer]});
  await click('Nur anlegen'); expect(h.api.createCustomer).toHaveBeenCalledTimes(1);
  expect(container.textContent).toContain('Kunde angelegt');
});
it('T100 shows and retries a failed setup reload without losing the name', async () => {
  const h=harness(); h.api.readProjection.mockResolvedValue({status:'unavailable'});
  await h.coordinator.start();
  await act(async()=>root.render(createElement(CustomersScreen,{administration:h.coordinator,
    authorityContext:snapshot.session,work:{} as import('../../src/work/contracts').MobileWorkCapability})));
  await click('+ Kunde hinzufügen'); await fill('Name des neuen Kunden',customer.displayName);
  expect(container.textContent).toContain('Kundeneinrichtung konnte nicht geladen');
  expect(h.api.createCustomer).not.toHaveBeenCalled();
  h.api.readProjection.mockResolvedValue(empty); await click('Erneut laden');
  expect((container.querySelector('[aria-label="Name des neuen Kunden"]') as HTMLInputElement).value).toBe(customer.displayName);
  await click('Nur anlegen'); expect(h.api.createCustomer).toHaveBeenCalledTimes(1);
});

it.each(['succeeded','unavailable'] as const)('T100 keeps confirmed creation during a deferred management reload (%s)',async reloadStatus=>{
 const h=harness();await h.coordinator.start();
 let finishManagement!:(value:{status:'succeeded'})=>void;
 let finishCreation!:(value:{status:'succeeded';customer:typeof customer})=>void;
 let finishReload!:(value:Awaited<ReturnType<AdminSetupApiPort['readProjection']>>)=>void;
 h.api.manageCustomer.mockImplementationOnce(()=>new Promise(resolve=>{finishManagement=resolve;}));
 h.api.createCustomer.mockImplementationOnce(()=>new Promise(resolve=>{finishCreation=resolve;}));
 const management=h.coordinator.manageCustomer('40000000-0000-4000-8000-000000000002',{action:'deactivate'});
 await vi.waitFor(()=>expect(finishManagement).toBeDefined());
 await act(async()=>root.render(createElement(CustomersScreen,{administration:h.coordinator,
   authorityContext:snapshot.session,work:{} as import('../../src/work/contracts').MobileWorkCapability})));
 await click('+ Kunde hinzufügen');await fill('Name des neuen Kunden',customer.displayName);
 await click('Nur anlegen');expect(h.api.createCustomer).toHaveBeenCalledOnce();
 await act(async()=>{finishManagement({status:'succeeded'});await management;});
 h.api.readProjection.mockResolvedValueOnce({...empty,customers:[customer]})
   .mockImplementationOnce(()=>new Promise(resolve=>{finishReload=resolve;}));
 await act(async()=>finishCreation({status:'succeeded',customer}));
 expect(h.coordinator.getState().status).toBe('loading');
 await act(async()=>finishReload(reloadStatus==='succeeded'?{...empty,customers:[customer]}:{status:'unavailable'}));
 expect(container.textContent).toContain('Kunde angelegt.');
 expect(container.querySelector('[aria-label="Name des neuen Kunden"]')).toBeNull();
 expect(h.api.createCustomer).toHaveBeenCalledOnce();
});
