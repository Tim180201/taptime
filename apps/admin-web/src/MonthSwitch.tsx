import { businessDay, shiftMonth } from '@taptime/core';
import { useEffect, useId, useRef, useState } from 'react';
import { monthLabel, monthTimeWindow } from './navigation';

const months = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

export function MonthSwitch({ value, min, max, onChange, disabled = false, label = 'Monat' }: {
  value: string; min: string; max: string; onChange: (month: string) => void;
  disabled?: boolean; label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(Number(value.slice(0, 4)));
  const trigger = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const id = useId();
  // A click advances immediately, even when a parent batches its route updates.
  const latest = useRef(value);
  const previousValue = useRef(value);
  if (previousValue.current !== value) { previousValue.current = value; latest.current = value; }
  const allowed = (month: string) => !!monthTimeWindow(month) && month >= min && month <= max;
  const choose = (month: string) => {
    if (disabled || !allowed(month)) return;
    latest.current = month;
    onChange(month);
  };
  const current = businessDay(Date.now()).slice(0, 7);
  const previous = value > max ? max : shiftMonth(value, -1);
  const next = value < min ? min : shiftMonth(value, 1);
  useEffect(() => {
    if (!open) return;
    const node = dialog.current!;
    node.showModal();
    const focus = node.querySelector<HTMLButtonElement>('button[aria-pressed="true"]:not(:disabled)')
      ?? node.querySelector<HTMLButtonElement>('.month-grid button:not(:disabled)');
    focus?.focus();
    return () => { node.close(); trigger.current?.focus({ preventScroll: true }); };
  }, [open]);
  useEffect(() => { if (disabled) setOpen(false); }, [disabled]);
  return <div className="month-switch" role="group" aria-label={label}>
    <button type="button" className="icon-button" aria-label="Voriger Monat" title="Voriger Monat"
      disabled={disabled || !allowed(previous)} onClick={() => choose(latest.current > max ? max : shiftMonth(latest.current, -1))}>‹</button>
    <button type="button" className="secondary month-trigger" ref={trigger} title={monthLabel(value)}
      aria-label={`${label}: ${monthLabel(value)}`} aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? id : undefined}
      disabled={disabled} onClick={() => { setYear(Number((value < min ? min : value > max ? max : value).slice(0, 4))); setOpen(true); }}>
      {monthLabel(value)}
    </button>
    <button type="button" className="icon-button" aria-label="Nächster Monat" title="Nächster Monat"
      disabled={disabled || !allowed(next)} onClick={() => choose(latest.current < min ? min : shiftMonth(latest.current, 1))}>›</button>
    {open ? <dialog id={id} ref={dialog} className="mobile-sheet month-picker" aria-label={`${label} wählen`} aria-modal="true"
      onCancel={event => { event.preventDefault(); setOpen(false); }}
      onClick={event => {
        if (event.target !== event.currentTarget) return;
        const box = event.currentTarget.getBoundingClientRect();
        if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) setOpen(false);
      }}>
      <div className="month-year">
        <button type="button" className="icon-button" aria-label="Voriges Jahr" title="Voriges Jahr"
          disabled={year <= Number(min.slice(0, 4))} onClick={() => setYear(year - 1)}>‹</button>
        <strong aria-live="polite">{year}</strong>
        <button type="button" className="icon-button" aria-label="Nächstes Jahr" title="Nächstes Jahr"
          disabled={year >= Number(max.slice(0, 4))} onClick={() => setYear(year + 1)}>›</button>
      </div>
      <div className="month-grid">{months.map((name, index) => {
        const month = `${year}-${String(index + 1).padStart(2, '0')}`;
        return <button type="button" key={month} aria-pressed={month === value} disabled={!allowed(month)}
          aria-label={`${monthLabel(month)}${month === current ? ' · läuft noch' : ''}`}
          onClick={() => { choose(month); setOpen(false); }}>{name}{month === current ? <span className="month-current" aria-hidden="true">•</span> : null}</button>;
      })}</div>
      <button type="button" className="text-button" onClick={() => setOpen(false)}>Schließen</button>
    </dialog> : null}
  </div>;
}
