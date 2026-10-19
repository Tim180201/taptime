// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeAll, expect, it, vi } from 'vitest';
import { App } from '../src/App';
import { useArchiveStatus } from '../src/archiveStatus';
import { AdminWebApiClient } from '../src/AdminWebApiClient';
import type { AdminWebCapability, AdminWebState } from '../src/contracts';
import { canonicalRoutePath, routeFromLocation, visibleAdminViews } from '../src/navigation';
import { archiveIds as id, archivePeople, createArchiveCapability } from './T127Capability';
beforeAll(() => { HTMLDialogElement.prototype.showModal = function () { this.open = true; }; HTMLDialogElement.prototype.close = function () { this.open = false; }; });
afterEach(() => { cleanup(); vi.useRealTimers(); window.history.replaceState(null, '', '/'); });
const open = async (path: string, role: 'administrator' | 'standortleitung' = 'administrator', empty = false) => {
  vi.setSystemTime(new Date('2026-10-19T12:00:00Z'));
  const fixture = await createArchiveCapability(role, empty);
  window.history.replaceState(null, '', path);
  render(<App administration={fixture.coordinator}/>);
  return fixture;
};
it.each(['administrator', 'standortleitung'] as const)('T127 archive for %s reads both tabs, search and last-time links in scope', async role => {
  const { requests } = await open('/archiv', role);
  const table = await screen.findByRole('table', { name: 'Ehemalige Mitarbeiter' });
  const row = within(table).getByText('Erika Ehemalig').closest('tr')!;
  expect(within(row).getAllByRole('cell').map(cell => cell.dataset.label)).toEqual(['Person', 'Standort', 'Ausgeschieden', 'Letzte Zeit', 'Zeiten']);
  expect(within(row).getByRole('link')).toHaveAttribute('href', expect.stringContaining(`beschaeftigte/${id.former}?`));
  expect(within(row).getByRole('link')).toHaveAttribute('href', expect.stringContaining('monat=2026-07'));
  expect(within(table).queryByRole('button')).toBeNull();
  if (role === 'administrator') {
    expect(within(table).getByText('Frieda Süd')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Weitere laden' }));
    await screen.findByText('Zara Ohne Zeiten');
  } else expect(screen.queryByText('Frieda Süd')).toBeNull();
  fireEvent.change(screen.getByLabelText('Suchen'), { target: { value: 'Erika' } });
  await waitFor(() => expect(requests.some(r => r.path.endsWith('/archive/people') && r.body.search === 'Erika')).toBe(true));
  expect(screen.queryByText('Zara Ohne Zeiten')).toBeNull();
  fireEvent.click(screen.getByRole('tab', { name: 'Gelöschte Kunden und Projekte' }));
  const targets = await screen.findByRole('table', { name: 'Gelöschte Kunden und Projekte' });
  expect(within(targets).getAllByRole('link')).toHaveLength(1);
  expect(within(targets).getByRole('link')).toHaveAttribute('href', expect.stringContaining(`kunde=${id.deleted}`));
  expect(within(within(targets).getByText('Projekt Sommer').closest('tr')!).queryByRole('link')).toBeNull();
  expect(window.location.search).toContain('bereich=ziele');
  expect(requests.filter(r => r.path.includes('/archive/')).every(r => r.body.expectedMembershipId === id.self)).toBe(true);
  if (role === 'standortleitung') expect(requests.filter(r => r.path.includes('/archive/')).every(r => r.body.locationId === id.north)).toBe(true);
});
it.each(['administrator', 'standortleitung'] as const)('T127 empty archive for %s has exact messages', async role => {
  await open('/archiv', role, true);
  await screen.findByText('Noch niemand im Archiv.');
  fireEvent.click(screen.getByRole('tab', { name: 'Gelöschte Kunden und Projekte' }));
  await screen.findByText('Noch nichts gelöscht.');
});
it('T127 former person is resolved outside the selected month, remains read-only and does not load assignments', async () => {
  const { requests } = await open(`/beschaeftigte/${id.former}?monat=2026-07`, 'standortleitung');
  await screen.findByRole('heading', { name: 'Erika Ehemalig', level: 1 });
  await screen.findByText('Diese Zeiten können nur noch angesehen werden.');
  expect(screen.getByText('ehemalig')).toBeVisible();
  expect(screen.getByText(/Ausgeschieden am 31.7.2026/)).toBeVisible();
  for (const name of ['Zeit hinzufügen', 'Ändern', 'Zeit löschen', 'Einladung erneut senden', 'Kunden und Projekte zuordnen']) expect(screen.queryByRole('button', { name })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Nächster Monat' }));
  await waitFor(() => expect(requests.some(r => r.path === '/v2/administration/managed-person-time' && r.body.fromInclusive === '2026-07-31T22:00:00.000Z')).toBe(true));
  expect(screen.getByRole('heading', { name: 'Erika Ehemalig', level: 1 })).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Zeit hinzufügen' })).toBeNull();
});
it('T127 shows write controls for an active person only after server confirmation', async () => {
  await open(`/beschaeftigte/${id.active}?monat=2026-07`);
  await screen.findByRole('button', { name: 'Zeit hinzufügen' });
  expect(screen.queryByText('Diese Zeiten können nur noch angesehen werden.')).toBeNull();
});
it('T127 running overview calls v2 and omits former people; July keeps former hours separately', async () => {
  const { coordinator, requests } = await open('/uebersicht');
  await screen.findByRole('table', { name: 'Laufende Zeiten' });
  expect(within(screen.getByRole('table', { name: 'Laufende Zeiten' })).queryByText('Erika Ehemalig')).toBeNull();
  expect(requests.some(r => r.path === '/v2/administration/managed-active-summary' && r.body.isRunning === true)).toBe(true);
  cleanup(); window.history.replaceState(null, '', '/beschaeftigte?monat=2026-07'); render(<App administration={coordinator}/>);
  await screen.findByRole('heading', { name: 'Ehemalige · Zeiten in diesem Monat' });
  expect(screen.getByText('Erika Ehemalig')).toBeVisible();
  fireEvent.click(screen.getByRole('tab', { name: 'Zugänge' }));
  await screen.findByRole('table', { name: 'Zugänge' });
  expect(screen.queryByRole('group', { name: 'Zugangsfilter' })).toBeNull();
  expect(screen.queryByText('Erika Ehemalig')).toBeNull();
});
it('T127 month views mark people and targets, customers split deleted rows and keep detail read-only', async () => {
  const { coordinator } = await open('/lohnexport?monat=2026-07');
  await screen.findByText('ehemalig'); await screen.findByText('gelöscht');
  cleanup(); window.history.replaceState(null, '', '/pruefungen'); render(<App administration={coordinator}/>);
  await screen.findByText('ehemalig'); await screen.findByText('gelöscht');
  cleanup(); window.history.replaceState(null, '', '/kunden?monat=2026-07'); render(<App administration={coordinator}/>);
  await screen.findByRole('heading', { name: 'Gelöschte Kunden · Zeiten in diesem Monat' });
  expect(within(screen.getByRole('table', { name: 'Kunden' })).queryByText('Alte Werkstatt')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Alte Werkstatt' }));
  await screen.findByText('ehemalig');
  expect(screen.queryByRole('button', { name: 'Kunde löschen' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Ändern' })).toBeNull();
});
it('T127 archive routes round-trip and employees have neither a link nor a readable capability', async () => {
  const route = routeFromLocation('/archiv', `?bereich=ziele&standort=${id.north}`);
  expect(route).toMatchObject({ archiveTab: 'ziele', locationId: id.north });
  expect(routeFromLocation('/archiv', new URL(canonicalRoutePath(route), 'https://example.invalid').search)).toEqual(route);
  expect(visibleAdminViews(['own_time', 'manual_capture']).some(view => view.slug === 'archiv')).toBe(false);
  const { coordinator, requests } = await createArchiveCapability('employee');
  expect(await coordinator.queryArchive('people', { search: null, cursor: null, locationId: null, membershipId: null })).toEqual({ status: 'authority_rejected' });
  expect(requests).toHaveLength(0);
});
it('T127 rejects missing server permission, foreign rows, unrequested status and malformed responses at the web boundary', async () => {
  let response: unknown = { activeRecord: null, records: [], nextCursor: null, windowStartedAt: '2026-07-01T00:00:00.000Z', windowEndedAt: '2026-07-31T00:00:00.000Z' };
  const client = new AdminWebApiClient(async () => Response.json(response));
  const time = { expectedMembershipId: id.self, targetMembershipId: id.former, fromInclusive: '2026-07-01T00:00:00.000Z', toExclusive: '2026-07-31T00:00:00.000Z', cursor: null, limit: 20 };
  expect(await client.managedPersonTime('synthetic', time)).toEqual({ status: 'invalid_response' });
  response = { ...response as object, canManageTime: false };
  expect(await client.managedPersonTime('synthetic', time)).toMatchObject({ status: 'succeeded', value: { canManageTime: false } });
  response = { people: [archivePeople[1]], nextCursor: null };
  expect(await client.queryArchive('synthetic', 'people', { expectedMembershipId: id.self, search: null, cursor: null, limit: 50, locationId: id.north, membershipId: null })).toEqual({ status: 'invalid_response' });
  response = { people: [{ membershipId: id.foreign, archived: true }], targets: [] };
  expect(await client.queryArchive('synthetic', 'status', { expectedMembershipId: id.self, membershipIds: [id.former], targets: [] })).toEqual({ status: 'invalid_response' });
});
it('T127 drops a late archive result after signing out', async () => {
  const { coordinator, api } = await createArchiveCapability();
  let resolve!: (value: any) => void;
  api.queryArchive = () => new Promise(done => { resolve = done; });
  const pending = coordinator.queryArchive('people', { search: null, cursor: null, locationId: null, membershipId: null });
  await waitFor(() => expect(resolve).toBeDefined());
  await coordinator.signOut();
  resolve({ status: 'succeeded', value: { people: archivePeople, nextCursor: null } });
  expect(await pending).toEqual({ status: 'authority_rejected' });
});
it('T127 batches status for loaded IDs, reports failures and discards stale status on scope change', async () => {
  const { coordinator } = await createArchiveCapability();
  let state = coordinator.getState() as Extract<AdminWebState, { status: 'ready' }>;
  const ids = Array.from({ length: 205 }, (_, index) => `70000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`);
  const query = vi.fn(async (_kind: string, request: { membershipIds: string[] }) => ({ status: 'ready', value: { people: request.membershipIds.map(membershipId => ({ membershipId, archived: true })), targets: [] } }));
  const cap = { getState: () => state, queryArchive: query } as unknown as AdminWebCapability;
  function Probe() { const archive = useArchiveStatus(cap, ids); return <>{archive.notice}<span>{archive.person(ids[0]) ? 'ehemalig' : 'ohne Markierung'}</span></>; }
  const view = render(<Probe/>);
  await screen.findByText('ehemalig'); expect(query.mock.calls.map(call => call[1].membershipIds.length)).toEqual([200, 5]);
  let resolve!: (value: any) => void;
  query.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  state = { ...state, membershipId: id.foreign }; view.rerender(<Probe/>);
  expect(screen.queryByText('ehemalig')).toBeNull();
  state = { ...state, role: 'employee' }; view.rerender(<Probe/>);
  await act(async () => resolve({ status: 'ready', value: { people: [{ membershipId: ids[0], archived: true }], targets: [] } }));
  expect(screen.queryByText('ehemalig')).toBeNull();
  query.mockImplementationOnce(async () => { throw new Error('Synthetic unavailable status'); });
  state = { ...state, role: 'administrator' }; view.rerender(<Probe/>);
  await screen.findByText('Archivmarkierungen konnten nicht geladen werden.');
  expect(screen.queryByText('ehemalig')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }));
  await screen.findByText('ehemalig');
});
