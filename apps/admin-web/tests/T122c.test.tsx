// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import '@testing-library/jest-dom/vitest';
import { MonthSwitch } from '../src/MonthSwitch';
import { AdministrationErrorBoundary, formatAccountLabel } from '../src/App';
import { monthRange, selectedMonth } from '../src/navigation';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-15T12:00:00Z'));
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); });

it.each(['Administrator', 'Standortleitung', 'Mitarbeiter', 'Beschäftigter', '', null, undefined])(
  'shows only the actual role for fallback name %s', name => {
    expect(formatAccountLabel(name, 'Standortleitung')).toBe('Standortleitung');
  });
it('retains a real name and the role', () => {
  expect(formatAccountLabel('  Alex Berger  ', 'Administrator')).toBe('Alex Berger · Administrator');
});

it('defaults only payroll to the previous Berlin month and retains valid links outside the range', () => {
  expect(selectedMonth(null, 'lohnexport')).toBe('2026-09');
  for (const page of ['beschaeftigte', 'kunden', 'meine-zeiten', 'pruefungen'] as const) {
    expect(selectedMonth(null, page)).toBe('2026-10');
    expect(selectedMonth('0002-10', page)).toBe('2026-10');
    expect(selectedMonth('2020-01', page)).toBe('2020-01');
  }
  for (const value of ['0002-10', '', '2026-13', 'garbage']) expect(selectedMonth(value, 'lohnexport')).toBe('2026-09');
  expect(selectedMonth(null, 'lohnexport', Date.parse('2026-12-31T23:30:00Z'))).toBe('2026-12');
  expect(monthRange()).toEqual({ min: '2024-10', max: '2026-10' });
});

function Controlled({ initial = '2026-09', onChange = (_: string) => {} }) {
  const [value, setValue] = useState(initial);
  return <MonthSwitch value={value} {...monthRange()} onChange={month => { setValue(month); onChange(month); }} />;
}
it('advances months, blocks the future and accumulates five rapid clicks', () => {
  const changed = vi.fn();
  render(<Controlled initial="2026-10" onChange={changed} />);
  expect(screen.getByRole('button', { name: 'Nächster Monat' })).toBeDisabled();
  const previous = screen.getByRole('button', { name: 'Voriger Monat' });
  act(() => { for (let i = 0; i < 5; i++) previous.click(); });
  expect(screen.getByRole('button', { name: 'Monat: Mai 2026' })).toBeVisible();
  expect(changed.mock.calls.map(([month]) => month)).toEqual(['2026-09', '2026-08', '2026-07', '2026-06', '2026-05']);
  fireEvent.click(screen.getByRole('button', { name: 'Nächster Monat' }));
  expect(changed).toHaveBeenLastCalledWith('2026-06');
});
it('opens on the selected month, marks the current month and restores focus on Escape and outside click', () => {
  render(<Controlled />);
  const opener = screen.getByRole('button', { name: 'Monat: September 2026' });
  fireEvent.click(opener);
  const dialog = screen.getByRole('dialog', { name: 'Monat wählen' });
  expect(within(dialog).getByRole('button', { name: 'September 2026' })).toHaveFocus();
  expect(within(dialog).getByRole('button', { name: 'Oktober 2026 · läuft noch' })).toBeEnabled();
  expect(within(dialog).getByRole('button', { name: 'November 2026' })).toBeDisabled();
  fireEvent(dialog, new Event('cancel', { bubbles: true, cancelable: true }));
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(opener).toHaveFocus();
  fireEvent.click(opener);
  fireEvent.click(screen.getByRole('dialog'), { clientX: -10, clientY: -10 });
  expect(opener).toHaveFocus();
});
it('offers only the allowed months in a boundary year and supports changing the year', () => {
  render(<Controlled />);
  fireEvent.click(screen.getByRole('button', { name: 'Monat: September 2026' }));
  fireEvent.click(screen.getByRole('button', { name: 'Voriges Jahr' }));
  fireEvent.click(screen.getByRole('button', { name: 'Voriges Jahr' }));
  expect(screen.getByRole('button', { name: 'Voriges Jahr' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'September 2024' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Oktober 2024' }));
  expect(screen.getByRole('button', { name: 'Monat: Oktober 2024' })).toHaveFocus();
  expect(screen.getByRole('button', { name: 'Voriger Monat' })).toBeDisabled();
});
it('shows an old linked or incident month without offering it and provides a path back into range', () => {
  render(<Controlled initial="2020-07" />);
  fireEvent.click(screen.getByRole('button', { name: 'Monat: Juli 2020' }));
  expect(screen.queryByRole('button', { name: 'Juli 2020' })).toBeNull();
  expect(screen.getByRole('button', { name: 'Oktober 2024' })).toHaveFocus();
  fireEvent.click(screen.getByRole('button', { name: 'Schließen' }));
  fireEvent.click(screen.getByRole('button', { name: 'Nächster Monat' }));
  expect(screen.getByRole('button', { name: 'Monat: Oktober 2024' })).toBeVisible();
});
it('limits own-time choices to the supplied server window', () => {
  render(<MonthSwitch value="2026-09" min="2026-09" max="2026-10" onChange={vi.fn()} />);
  expect(screen.getByRole('button', { name: 'Voriger Monat' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Monat: September 2026' }));
  expect(screen.getByRole('button', { name: 'August 2026' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'September 2026' })).toBeEnabled();
});
it('contains rendering failures, keeps diagnostics out of the UI and recovers on navigation', () => {
  const diagnostic = vi.spyOn(console, 'error').mockImplementation(() => {});
  function Broken(): never { throw new Error('synthetic internal details'); }
  const view = render(<><button>Navigation</button><AdministrationErrorBoundary resetKey="a"><Broken /></AdministrationErrorBoundary></>);
  expect(screen.getByRole('alert')).toHaveTextContent('Diese Seite konnte nicht angezeigt werden.');
  expect(screen.getByRole('button', { name: 'Neu laden' })).toBeEnabled();
  expect(screen.queryByText(/synthetic internal details/)).toBeNull();
  expect(screen.getByRole('button', { name: 'Navigation' })).toBeEnabled();
  expect(diagnostic).toHaveBeenCalled();
  view.rerender(<><button>Navigation</button><AdministrationErrorBoundary resetKey="b"><p>Andere Seite</p></AdministrationErrorBoundary></>);
  expect(screen.getByText('Andere Seite')).toBeVisible();
});
