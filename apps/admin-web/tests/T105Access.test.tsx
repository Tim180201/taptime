// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeAll, expect, it, vi } from 'vitest';
import EmployeesView from '../src/views/EmployeesView';
const organization = { id: 'org', name: 'Beispielbetrieb' };
const makeMember = (id: string, active = true, role = 'employee') => ({ id, displayName: id, role, active, rowVersion: 1,
  location: { id: 'north', name: 'Nord' }, firstSignedInAt: null, lastSignedInAt: null });
const state: any = { status: 'ready', membershipId: 'self', role: 'administrator', managementScope: { kind: 'organization' },
  selectedLocation: null, locationsEnabled: true, assignableLocations: [{ id: 'north', name: 'Nord' }],
  projection: { organization }, employeeProjection: { organization, employeeMemberships: [], nextCursor: null }, sections: { employees: { status: 'ready' } },
  managedPeople: { status: 'ready', month: '2026-10', value: { totalCount: 12, runningCount: 0, people: [], nextCursor: null,
    packageUsage: { activeAccessCount: 12, packageSize: 10 } } }, notice: null };
beforeAll(() => { HTMLDialogElement.prototype.showModal = function () { this.open = true; }; HTMLDialogElement.prototype.close = function () { this.open = false; }; });
afterEach(() => { cleanup(); vi.useRealTimers(); });
function setup(role = 'administrator') {
  let members = [makeMember('Ada'), { ...makeMember('Berta'), firstSignedInAt: '2026-10-13T08:00:00.000Z', lastSignedInAt: '2026-10-14T08:00:00.000Z' }, makeMember('Entzogen', false)];
  const current = { ...state, role, managementScope: role === 'administrator' ? { kind: 'organization' } : { kind: 'locations', locations: [{ id: 'north', name: 'Nord' }] } };
  const querySearch = vi.fn(async (_kind: string, request: any) => ({ status: 'ready', value: { status: 'succeeded', organization,
    employeeMemberships: members.filter(m => (request.active == null || m.active === request.active) && (!request.search || m.displayName.includes(request.search))), nextCursor: null } }));
  const cap: any = { getState: () => current, querySearch, refresh: vi.fn(), refreshManagedPeople: vi.fn(), retrySection: vi.fn(async () => {}),
    changeMembershipRole: vi.fn(async (id: string, _: number, role: string) => { members = members.map(m => m.id === id ? { ...m, role, rowVersion: 2 } : m); }),
    revokeMembership: vi.fn(async (id: string) => { members = members.map(m => m.id === id ? { ...m, active: false } : m); }) };
  const invite = vi.fn(async (name: string) => { members.push(makeMember(name)); return { status: 'succeeded' as const }; });
  render(<EmployeesView state={current} administration={cap} accountInvitations={{ invite }} navigate={vi.fn()} />);
  return { cap, invite, querySearch };
}
it('T105 shows times and access tabs, one header action, package notice and server filters', async () => {
  const { querySearch } = setup();
  expect(screen.getByRole('tab', { name: 'Zeiten' })).toHaveAttribute('aria-selected', 'true');
  expect(screen.getByText('12 Zugänge · Paket 10')).toBeVisible();
  expect(screen.getByText('Paket überschritten, alle Zugänge bleiben nutzbar')).toHaveClass('access-notice');
  expect(document.querySelectorAll('.workspace-header .primary-action')).toHaveLength(1);
  fireEvent.click(screen.getByRole('tab', { name: 'Zugänge' }));
  const table = await screen.findByRole('table', { name: 'Zugänge' });
  expect(within(table).getAllByRole('columnheader').map(n => n.textContent)).toEqual(['Person', 'Rolle', 'Standort', 'Anmeldung', 'Zugang', 'Aktionen']);
  expect(screen.getAllByText('noch nicht angemeldet').length).toBeGreaterThan(0);
  expect(screen.getByText('zuletzt 14.10.')).toBeVisible();
  expect(within(table).queryByText('Entzogen')).toBeNull();
  expect(screen.queryByRole('group', { name: 'Zugangsfilter' })).toBeNull();
  expect(screen.getByRole('link', { name: 'Ehemalige im Archiv' })).toHaveAttribute('href', '/archiv');
  expect(querySearch).toHaveBeenLastCalledWith('memberships', expect.objectContaining({ active: true, cursor: null }));
});
it('T105 edits roles in a sheet through the existing command and links assigned locations', async () => {
  const { cap } = setup(); fireEvent.click(screen.getByRole('tab', { name: 'Zugänge' }));
  fireEvent.click((await screen.findAllByRole('button', { name: 'Rolle ändern' }))[0]!);
  const sheet = screen.getByRole('dialog', { name: 'Rolle ändern' });
  expect(within(sheet).getAllByRole('radio')).toHaveLength(3);
  fireEvent.click(within(sheet).getByRole('radio', { name: /Standortleitung/ }));
  fireEvent.click(within(sheet).getByRole('button', { name: 'Rolle speichern' }));
  await waitFor(() => expect(cap.changeMembershipRole).toHaveBeenCalledWith('Ada', 1, 'standortleitung'));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  fireEvent.click(screen.getAllByRole('button', { name: 'Rolle ändern' })[0]!);
  expect(within(screen.getByRole('dialog')).getByRole('link', { name: 'Verwaltete Standorte zuweisen' })).toHaveAttribute('href', expect.stringContaining('Ada'));
});
it('T105 keeps location managers without a primary action or role mutation', async () => {
  setup('standortleitung'); fireEvent.click(screen.getByRole('tab', { name: 'Zugänge' }));
  await screen.findByText('Ada');
  expect(document.querySelectorAll('.workspace-header .primary-action')).toHaveLength(0);
  expect(screen.queryByRole('button', { name: 'Rolle ändern' })).toBeNull();
  expect(screen.getByRole('button', { name: '+ Mitarbeiter einladen' })).toHaveClass('secondary');
});
it('T105 keeps one primary action during revocation and refreshes the final access state', async () => {
  const { cap } = setup(); fireEvent.click(screen.getByRole('tab', { name: 'Zugänge' }));
  fireEvent.click((await screen.findAllByRole('button', { name: 'Zugang entziehen' }))[0]!);
  expect(screen.getByRole('button', { name: '+ Mitarbeiter einladen' })).toHaveClass('secondary');
  const confirmation = screen.getByRole('alertdialog');
  expect(within(confirmation).getByText('Danach steht Ada im Archiv. Die Zeiten bleiben im Lohnexport und bei den Kundenzeiten. Das lässt sich nicht rückgängig machen.')).toBeVisible();
  expect(within(confirmation).getByText(/Läuft gerade eine Zeit/)).toBeVisible();
  fireEvent.click(within(confirmation).getByRole('button', { name: 'Zugang entziehen' }));
  await waitFor(() => expect(cap.revokeMembership).toHaveBeenCalledWith('Ada', 1));
  await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
  expect(screen.queryByText('Ada')).toBeNull();
  expect(screen.getByRole('button', { name: '+ Mitarbeiter einladen' })).toHaveClass('primary-action');
});
it('T105 reveals the invited person in the active access list', async () => {
  const { invite } = setup(); fireEvent.click(screen.getByRole('tab', { name: 'Zugänge' }));
  fireEvent.click(screen.getByRole('button', { name: '+ Mitarbeiter einladen' }));
  const sheet = screen.getByRole('dialog', { name: 'Mitarbeiter einladen' });
  fireEvent.change(within(sheet).getByLabelText('Name'), { target: { value: 'Zoe Neu' } });
  fireEvent.change(within(sheet).getByLabelText('E-Mail'), { target: { value: 'zoe@example.invalid' } });
  fireEvent.click(within(sheet).getByRole('button', { name: 'Einladung senden' }));
  await waitFor(() => expect(invite).toHaveBeenCalled());
  const person = await screen.findByText('Zoe Neu');
  expect(within(person.closest('tr')!).getByText('noch nicht angemeldet')).toBeVisible();
  expect(screen.queryByRole('group', { name: 'Zugangsfilter' })).toBeNull();
});
it('T105 refreshes access after invitation when that name is already the active search', async () => {
  const { querySearch } = setup(); fireEvent.click(screen.getByRole('tab', { name: 'Zugänge' }));
  fireEvent.change(screen.getByLabelText('Suchen'), { target: { value: 'Zoe Neu' } });
  await waitFor(() => expect(querySearch).toHaveBeenLastCalledWith('memberships', expect.objectContaining({ search: 'Zoe Neu' })));
  expect(screen.queryByText('Zoe Neu')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '+ Mitarbeiter einladen' }));
  const sheet = screen.getByRole('dialog', { name: 'Mitarbeiter einladen' });
  fireEvent.change(within(sheet).getByLabelText('Name'), { target: { value: 'Zoe Neu' } });
  fireEvent.change(within(sheet).getByLabelText('E-Mail'), { target: { value: 'zoe@example.invalid' } });
  fireEvent.click(within(sheet).getByRole('button', { name: 'Einladung senden' }));
  const row = (await screen.findByText('Zoe Neu')).closest('tr')!;
  expect(within(row).getByText('noch nicht angemeldet')).toBeVisible();
});
