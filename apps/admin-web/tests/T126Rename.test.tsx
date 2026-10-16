// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeAll, expect, it, vi } from 'vitest';
import { createRenameCapability, renameSelf, renameEmployee } from './T126Capability';
import { App } from '../src/App';
import { MembershipNameChange } from '../src/views/MembershipNameChange';
import type { AdminWebState } from '../src/contracts';
import { defaultRoute, monthTimeWindow } from '../src/navigation';
import TimeRecordsView from '../src/views/TimeRecordsView';
import ReviewsView from '../src/views/ReviewsView';
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
  window.matchMedia = vi.fn().mockImplementation(() => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); window.history.replaceState(null, '', '/'); });
it('T126 opens an empty legacy name, validates locally and reuses the command after uncertain delivery', async () => {
  const cap = await createRenameCapability();
  const save = vi.spyOn(cap.coordinator, 'renameMembership').mockResolvedValueOnce({ status: 'error', message: 'Bitte erneut versuchen.' });
  render(<MembershipNameChange administration={cap.coordinator} membershipId={renameSelf} />);
  fireEvent.click(screen.getByRole('button', { name: 'Name ändern' }));
  const input = await screen.findByRole('textbox', { name: 'Name' }); expect(input).toHaveValue('');
  fireEvent.change(input, { target: { value: '  André Beispiel  ' } });
  fireEvent.click(screen.getByRole('button', { name: 'Namen speichern' }));
  await screen.findByText('Bitte erneut versuchen.');
  fireEvent.click(screen.getByRole('button', { name: 'Namen speichern' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  expect(save).toHaveBeenCalledTimes(2); expect(save.mock.calls[0]).toEqual(save.mock.calls[1]);
  expect(cap.commands[0]).toMatchObject({ id: renameSelf, version: 1, name: 'André Beispiel' });
});
it('T126 prefills the real name, rejects unchanged and invalid input, and cancels without saving', async () => {
  const { coordinator, commands } = await createRenameCapability();
  render(<MembershipNameChange administration={coordinator} membershipId={renameEmployee} />);
  fireEvent.click(screen.getByRole('button', { name: 'Name ändern' }));
  const input = await screen.findByRole('textbox', { name: 'Name' }); expect(input).toHaveValue('Clara Beispiel');
  fireEvent.click(screen.getByRole('button', { name: 'Namen speichern' }));
  expect(screen.getByRole('alert')).toHaveTextContent('unverändert');
  fireEvent.change(input, { target: { value: '  ' } });
  fireEvent.click(screen.getByRole('button', { name: 'Namen speichern' }));
  expect(screen.getByText('Bitte Name eingeben.')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' })); expect(commands).toEqual([]);
});
it('T126 refreshes the real coordinator caches and the own header name without a page reload', async () => {
  const { coordinator } = await createRenameCapability();
  await coordinator.refreshManagedPeople();
  const result = await coordinator.renameMembership(renameSelf, 1, 'Alex Neu', crypto.randomUUID()); expect(result).toEqual({ status: 'saved' });
  const state = coordinator.getState(); expect(state.status).toBe('ready'); if (state.status !== 'ready') return;
  expect(state.ownDisplayName).toBe('Alex Neu');
  expect(state.employeeProjection.employeeMemberships.find(p => p.id === renameSelf)?.displayName).toBe('Alex Neu');
  expect(state.managedPeople?.value?.people.find(p => p.membershipId === renameSelf)?.displayName).toBe('Alex Neu');
  expect(state.timeRecords[0]?.employeeDisplayName).toBe('Alex Neu'); expect(state.reviewItems[0]?.employeeDisplayName).toBe('Alex Neu');
});
it('T126 exposes row and person actions to administrators and restricts location managers to employees', async () => {
  window.history.replaceState(null, '', '/beschaeftigte');
  const { coordinator } = await createRenameCapability('standortleitung');
  render(<App administration={coordinator} />);
  fireEvent.click(await screen.findByRole('tab', { name: 'Zugänge' }));
  const table = await screen.findByRole('table', { name: 'Zugänge' });
  await waitFor(() => expect(within(table).getAllByRole('button', { name: 'Name ändern' })).toHaveLength(1));
  expect(within(within(table).getByText('Clara Beispiel').closest('tr')!).getByRole('button', { name: 'Name ändern' })).toBeVisible();
});
it('T126 shows missing-name links and the notice for loaded payroll and review data', async () => {
  const { coordinator } = await createRenameCapability();
  let state = coordinator.getState() as Extract<AdminWebState, { status: 'ready' }>;
  state = { ...state, timeWindow: monthTimeWindow('2026-09')! };
  const navigate = vi.fn();
  const view = render(<TimeRecordsView state={state} administration={coordinator} route={{ ...defaultRoute('lohnexport'), month: '2026-09' }} navigate={navigate} />);
  expect(screen.getByText(/Bei mindestens einer Person fehlt der Name/)).toBeVisible();
  fireEvent.click(screen.getByRole('link', { name: 'Name fehlt' })); expect(navigate).toHaveBeenCalledWith(expect.objectContaining({ personId: renameSelf }));
  view.rerender(<ReviewsView state={state} administration={coordinator} navigate={navigate} />);
  expect(screen.getByRole('link', { name: 'Name fehlt' })).toHaveClass('access-notice');
  expect(screen.getByText(/In der CSV bleibt er dann leer/)).toBeVisible();
});
it('T126 late name reads cannot update a signed-out session', async () => {
  const { coordinator, api } = await createRenameCapability();
  let finish!: () => void;
  vi.spyOn(api, 'readMembershipName').mockImplementationOnce(() => new Promise(resolve => { finish = () => resolve({ status: 'succeeded', value: { displayName: 'Spät', rowVersion: 1 } }); }));
  const pending = coordinator.readMembershipName(renameSelf); await coordinator.signOut(); finish();
  expect((await pending).status).toBe('error'); expect(coordinator.getState().status).toBe('signed_out');
});
it('T126 late saves cannot refresh a signed-out session', async () => {
  const { coordinator, api } = await createRenameCapability();
  let finish!: () => void;
  vi.spyOn(api, 'renameMembership').mockImplementationOnce(() => new Promise(resolve => { finish = () => resolve({ status: 'succeeded', value: true }); }));
  const pending = coordinator.renameMembership(renameSelf, 1, 'Spät', crypto.randomUUID());
  await coordinator.signOut(); finish();
  expect((await pending).status).toBe('error'); expect(coordinator.getState().status).toBe('signed_out');
});
