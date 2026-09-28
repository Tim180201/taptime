// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { TimeCalendar } from '../src/TimeCalendar';
import { AdminWebApiClient } from '../src/AdminWebApiClient';
import SetupView from '../src/views/SetupView';
import type { AdminWebCapability, AdminWebState } from '../src/contracts';

vi.mock('../src/TimeVoidControls', () => ({ VoidedTimeRows: () => null }));
vi.mock('../src/TimeEditingControls', () => ({ AddTimeControl: () => null, TimeRecordControls: () => null }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const value = { records: [], activeRecord: null, nextCursor: null, windowStartedAt: '2026-09-01T00:00:00.000Z', windowEndedAt: '2026-09-30T22:00:00.000Z' };
it.each([[true, false, 'smooth'], [true, true, 'instant'], [false, false, null]] as const)(
  'scrolls only the stacked day list (narrow=%s, reduced=%s)', (narrow, reduced, behavior) => {
    const scroll = vi.fn();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: scroll });
    vi.stubGlobal('matchMedia', vi.fn((query: string) => ({ matches: query.includes('reduced') ? reduced : narrow })));
    const month = vi.fn();
    const { rerender } = render(<TimeCalendar value={value} month="2026-09" onMonthChange={month} onRefresh={() => {}} />);
    expect(scroll).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /^15.09.2026/ }));
    if (behavior === null) expect(scroll).not.toHaveBeenCalled();
    else {
      expect(scroll).toHaveBeenLastCalledWith({ block: 'start', behavior });
      expect((scroll.mock.instances[0] as HTMLElement).textContent).toContain('Dienstag, 15. September');
    }
    scroll.mockClear(); fireEvent.click(screen.getByRole('button', { name: 'Voriger Monat' }));
    rerender(<TimeCalendar value={value} month="2026-08" onMonthChange={month} onRefresh={() => {}} />);
    expect(month).toHaveBeenCalledWith('2026-08'); expect(scroll).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
it.each([[400, 'location_required'], [403, 'forbidden'], [400, 'invalid_request'], [409, 'command_id_conflict']] as const)(
  'keeps the create-customer error %s/%s distinct from an expired session', async (status, code) => {
    const fetcher = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ error: { code } }), { status, headers: { 'content-type': 'application/json' } }));
    const api = new AdminWebApiClient(fetcher);
    await expect(api.createCustomer('token', 'membership', 'command', 'Neuer Kunde', 'location')).resolves.toEqual({ status: 'conflict', code });
    expect(JSON.parse(fetcher.mock.calls[0]![1]!.body as string)).toEqual({ expectedMembershipId: 'membership', commandId: 'command', displayName: 'Neuer Kunde', locationId: 'location' });
  });
it.each([false, true])('offers the required location, preselecting the single choice (enabled=%s)', enabled => {
  const createCustomer = vi.fn(async () => {});
  const state = { status: 'ready', completedAction: null, creating: false, reassignmentIntent: null, managementScope: { kind: 'organization' },
    locationsEnabled: enabled, assignableLocations: [{ id: 'north', name: 'Nord' }],
    projection: { organization: { id: 'org', name: 'Test' }, customers: [], nfcTags: [], nextCursor: null, customersComplete: true, nfcTagsComplete: true },
    sections: { setup: { status: 'ready' } }, projects: [], projectsNextCursor: null, locationSetup: null,
  } as unknown as Extract<AdminWebState, { status: 'ready' }>;
  const administration = { createCustomer, refreshProjects: async () => {}, refreshLocationSetup: async () => {} } as unknown as AdminWebCapability;
  render(<SetupView state={state} administration={administration} />);
  fireEvent.change(screen.getByLabelText('Neuen Kunden anlegen'), { target: { value: 'Testkunde' } });
  if (enabled) expect(screen.getByRole('combobox', { name: 'Standort' })).toHaveValue('north');
  else expect(screen.queryByRole('combobox', { name: 'Standort' })).not.toBeInTheDocument();
  fireEvent.submit(screen.getByRole('button', { name: 'Kunde anlegen' }).closest('form')!);
  expect(createCustomer).toHaveBeenCalledWith('Testkunde', enabled ? 'north' : undefined);
});
