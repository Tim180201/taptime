import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { isPersonnelNumber, isWorkWageType, type PayrollSettings } from '@taptime/administration-contract/payroll';
import type { AdminWebCapability, PayrollReadResult, RenameMembershipResult } from '../contracts';
import { MobileSheet } from '../MobileSheet';
import { canonicalRoutePath, defaultRoute, type AdminRoute } from '../navigation';
import { navigateFromLink } from '../viewHelpers';

type Value = { value: string | null; rowVersion: number };
function PayrollValueSheet({ label, help, numeric, load, save, onCancel, onSaved }: {
  label: string; help: string; numeric: boolean; load: () => Promise<PayrollReadResult<Value>>;
  save: (version: number, value: string | null, command: string) => Promise<RenameMembershipResult>;
  onCancel: () => void; onSaved: () => void;
}) {
  const [loaded, setLoaded] = useState<Value | null>(null), [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null), [busy, setBusy] = useState(false), [retry, setRetry] = useState(0);
  const request = useRef<{ value: string | null; command: string } | null>(null);
  const input = useRef<HTMLInputElement>(null), id = useId();
  useEffect(() => {
    let cancelled = false;
    setLoaded(null); setError(null);
    void load().then(result => {
      if (cancelled) return;
      if (result.status === 'error') { setError(result.message); return; }
      setLoaded(result); setValue(result.value ?? '');
    }).catch(() => { if (!cancelled) setError('Die Angabe konnte nicht geladen werden. Bitte versuchen Sie es erneut.'); });
    return () => { cancelled = true; };
  }, [load, retry]);
  useEffect(() => { if (loaded) input.current?.focus(); }, [loaded]);
  const canonical = value === '' ? null : value;
  return <MobileSheet label={label} className="right-sheet" busy={busy} onCancel={onCancel}>
    <h2>{label}</h2>
    {!loaded ? <>{error ? <><p role="alert">{error}</p><button onClick={() => setRetry(n => n + 1)}>Erneut laden</button></> : <p role="status">Angabe wird geladen …</p>}
      <button className="secondary" onClick={onCancel}>Schließen</button></> :
      <form className="form-grid" noValidate onSubmit={event => {
        event.preventDefault(); if (busy) return;
        if (!(numeric ? isWorkWageType(canonical) : isPersonnelNumber(canonical))) {
          setError(numeric ? 'Bitte geben Sie 1 bis 6 Ziffern ein.' : 'Bitte verwenden Sie 1 bis 20 Zeichen: Buchstaben A–Z, Ziffern oder Bindestrich.');
          input.current?.focus(); return;
        }
        if (canonical === loaded.value) { setError('Die Angabe ist unverändert. Bitte ändern Sie sie oder brechen Sie ab.'); return; }
        if (!request.current || request.current.value !== canonical) request.current = {value:canonical,command:crypto.randomUUID()};
        setBusy(true); setError(null);
        void save(loaded.rowVersion,canonical,request.current.command).then(result => {
          if (result.status === 'saved') onSaved(); else setError(result.message);
        }).catch(() => setError('Ob die Angabe gespeichert wurde, ist noch unklar. Bitte versuchen Sie es erneut.')).finally(() => setBusy(false));
      }}>
        <label htmlFor={id}>{label}</label>
        <input id={id} ref={input} value={value} disabled={busy} inputMode={numeric ? 'numeric' : 'text'} autoComplete="off"
          spellCheck={false} aria-invalid={error ? true : undefined} aria-describedby={`${id}-help${error ? ` ${id}-error` : ''}`}
          onChange={event => {setValue(event.target.value);setError(null);}} />
        <p id={`${id}-help`} className="supporting">{help} Leer lassen, um die Angabe zu entfernen.</p>
        {error ? <p id={`${id}-error`} className="field-error" role="alert">{error}</p> : null}
        <button className="primary-action" disabled={busy} aria-busy={busy}>{numeric ? 'Lohnart speichern' : 'Personalnummer speichern'}</button>
        <button type="button" className="secondary" disabled={busy} onClick={onCancel}>Abbrechen</button>
      </form>}
  </MobileSheet>;
}

export function PersonnelNumberChange({ administration, membershipId, onSaved, className = 'secondary' }: {
  administration: AdminWebCapability; membershipId: string; onSaved?: () => void; className?: string;
}) {
  const [open, setOpen] = useState(false);
  const load = useCallback(async (): Promise<PayrollReadResult<Value>> => {
    const result = await administration.readMembershipPayroll!(membershipId);
    return result.status === 'ready' ? {status:'ready',value:result.personnelNumber,rowVersion:result.rowVersion} : result;
  }, [administration,membershipId]);
  return <><button type="button" className={className} onClick={() => setOpen(true)}>Personalnummer pflegen</button>
    {open ? <PayrollValueSheet label="Personalnummer" numeric={false} help="1 bis 20 Zeichen: Buchstaben A–Z, Ziffern oder Bindestrich."
      load={load} save={(version,value,command) => administration.setPersonnelNumber!(membershipId,version,value,command)}
      onCancel={() => setOpen(false)} onSaved={() => {setOpen(false);onSaved?.();}} /> : null}</>;
}

export function PayrollExportSettings({ administration, fromInclusive, toExclusive, refreshKey, navigate }: {
  administration: AdminWebCapability; fromInclusive: string; toExclusive: string; refreshKey: unknown; navigate: (route: AdminRoute) => void;
}) {
  const [settings,setSettings] = useState<PayrollReadResult<PayrollSettings> | null>(null), [retry,setRetry] = useState(0), [editing,setEditing] = useState(false);
  const load = useCallback(() => administration.readPayrollSettings!(fromInclusive,toExclusive),[administration,fromInclusive,toExclusive]);
  useEffect(() => {
    let cancelled = false; setSettings(null);
    void load().then(result => {if (!cancelled) setSettings(result);})
      .catch(() => {if (!cancelled) setSettings({status:'error',message:'Die Lohnangaben konnten nicht geladen werden.'});});
    return () => {cancelled = true;};
  }, [load,retry,refreshKey]);
  const loadWage = useCallback(async (): Promise<PayrollReadResult<Value>> => {
    const result = await load(); return result.status === 'ready' ? {status:'ready',value:result.workWageType,rowVersion:result.rowVersion} : result;
  },[load]);
  const people = defaultRoute('beschaeftigte');
  return <div className="payroll-settings">
    {!settings ? <p role="status">Lohnangaben werden geladen …</p> : settings.status === 'error' ?
      <><p role="alert">{settings.message}</p><button className="secondary" onClick={() => setRetry(n => n + 1)}>Lohnangaben erneut laden</button></> :
      <><p className={settings.missingPersonnelNumberCount ? 'access-notice' : 'supporting'}>
        {settings.missingPersonnelNumberCount} {settings.missingPersonnelNumberCount === 1 ? 'Person ohne Personalnummer' : 'Personen ohne Personalnummer'} in diesem Monat.{' '}
        <a href={canonicalRoutePath(people)} onClick={event => navigateFromLink(event,people,navigate)}>Personalnummern bei den Mitarbeitern pflegen</a>
      </p><div className="payroll-wage"><span>Lohnart für Arbeitsstunden: <strong>{settings.workWageType ?? 'Nicht angegeben'}</strong></span>{' '}
        <button className="secondary" onClick={() => setEditing(true)}>Lohnart pflegen</button></div></>}
    {editing ? <PayrollValueSheet key={fromInclusive} label="Lohnart für Arbeitsstunden" help="1 bis 6 Ziffern, wie vom Lohnbüro angegeben." numeric
      load={loadWage} save={(version,value,command) => administration.setWorkWageType!(version,value,command)}
      onCancel={() => setEditing(false)} onSaved={() => {setEditing(false);setRetry(n => n + 1);}} /> : null}
  </div>;
}
