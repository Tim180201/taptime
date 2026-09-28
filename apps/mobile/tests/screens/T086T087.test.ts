// @vitest-environment jsdom
import { act, createElement, useEffect, useImperativeHandle, type ReactNode, type Ref } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { AdminSessionSnapshot, AdminSetupApiPort, AdminSetupState } from '../../src/administration/contracts';
import { AdminSetupCoordinator } from '../../src/administration/AdminSetupCoordinator';
import { TapTimeAdministrationApiClient } from '../../src/administration/TapTimeAdministrationApiClient';

const native = vi.hoisted(() => ({ scroll: vi.fn(), reduced: false, headingY: 648 }));
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
const { TimeCalendar } = await import('../../src/screens/TimeCalendar');
const locationA = '50000000-0000-4000-8000-000000000001';
const customer = { id: '40000000-0000-4000-8000-000000000001', displayName: 'Neuer Kunde', active: true };
const snapshot: AdminSessionSnapshot = { generation: 1, session: { userId: '10000000-0000-4000-8000-000000000001', membershipId: '20000000-0000-4000-8000-000000000001', organizationId: '30000000-0000-4000-8000-000000000001', role: 'standortleitung', nfcSetupAvailable: true, locationsEnabled: true } };
const empty = { status: 'succeeded' as const, organization: { id: snapshot.session.organizationId, name: 'Testbetrieb' }, customers: [] as typeof customer[], nfcTags: [], nextCursor: null };
function harness(locations = [{ id: locationA, displayName: 'Nord' }]) {
  let current = snapshot;
  const online = vi.fn(async () => true);
  const api = { readProjection: vi.fn(async () => empty),
    readCustomerLocations: vi.fn(async () => ({ status: 'succeeded' as const, locations, nextCursor: null })),
    createCustomer: vi.fn<NonNullable<AdminSetupApiPort['createCustomer']>>(async () => ({ status: 'succeeded', customer })),
    provisionTag: vi.fn(async () => ({ status: 'unavailable' as const })) };
  const coordinator = new AdminSetupCoordinator({ capture: () => current, isCurrent: candidate => candidate === current, subscribe: () => () => {} },
    { scan: vi.fn(), checkCapability: vi.fn(), cancelCapture: vi.fn(), stop: vi.fn() }, api,
    () => '60000000-0000-4000-8000-000000000001', { write: vi.fn(), cancel: vi.fn() }, online);
  return { api, coordinator, online, replace() { current = { ...snapshot, generation: 2 }; } };
}
let root: Root, container: HTMLDivElement;
beforeEach(() => { Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true }); native.scroll.mockClear(); native.reduced = false;
  container = document.createElement('div'); document.body.append(container); root = createRoot(container); });
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
const click = async (label: string) => { const button = [...container.querySelectorAll('button')].find(node => node.textContent === label || node.getAttribute('aria-label') === label); if (!button) throw Error(label); await act(async () => button.click()); };
const fill = async (label: string, value: string) => { await act(async () => fireEvent.change(container.querySelector(`[aria-label="${label}"]`)!, { target: { value } })); };

it.each([1, 2])('creates in the form, preselects the customer after reload and keeps tag setup ready (%s locations)', async count => {
  const h = harness(count === 1 ? undefined : [{ id: locationA, displayName: 'Nord' }, { id: '50000000-0000-4000-8000-000000000002', displayName: 'Süd' }]);
  await h.coordinator.start();
  await act(async () => root.render(createElement(AdminSetupScreen, { administration: h.coordinator })));
  await click('Tag zuordnen'); await click('+ Neuer Kunde'); await fill('Name des neuen Kunden', customer.displayName);
  if (count === 2) await click('Nord');
  h.api.readProjection.mockResolvedValue({ ...empty, customers: [customer] });
  await click('Kunde anlegen');
  expect(h.api.createCustomer).toHaveBeenCalledWith({ expectedMembershipId: snapshot.session.membershipId,
    commandId: '60000000-0000-4000-8000-000000000001', displayName: customer.displayName, locationId: locationA });
  expect([...container.querySelectorAll('button')].find(node => node.textContent === customer.displayName)?.getAttribute('aria-selected')).toBe('true');
  expect(container.textContent).toContain('Der neue Kunde ist ausgewählt');
  expect(container.textContent).toContain('Tag erfassen');
  expect(container.textContent).not.toContain('Admin-Web');
});
it('shows the offline hint, preserves the name and never queues or sends a customer command', async () => {
  const h = harness(); await h.coordinator.start();
  await act(async () => root.render(createElement(AdminSetupScreen, { administration: h.coordinator })));
  await click('Tag zuordnen'); await click('+ Neuer Kunde'); await fill('Name des neuen Kunden', 'Noch offline');
  h.online.mockResolvedValue(false); await click('Kunde anlegen');
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
