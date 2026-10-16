import { useEffect, useRef, useState } from 'react';
import { normalizeCustomerNameV1 } from '@taptime/administration-contract/names';
import type { AdminWebCapability } from '../contracts';
import { MobileSheet } from '../MobileSheet';
import { RequiredForm } from '../RequiredForm';

export function MembershipNameChange({ administration, membershipId, onSaved, className = 'secondary' }: {
  administration: AdminWebCapability; membershipId: string; onSaved?: () => void | Promise<void>; className?: string;
}) {
  const [open, setOpen] = useState(false);
  return <><button type="button" className={className} onClick={() => setOpen(true)}>Name ändern</button>
    {open ? <NameSheet administration={administration} membershipId={membershipId}
      onCancel={() => setOpen(false)} onSaved={async () => { setOpen(false); await onSaved?.(); }} /> : null}</>;
}
function NameSheet({ administration, membershipId, onCancel, onSaved }: {
  administration: AdminWebCapability; membershipId: string; onCancel: () => void; onSaved: () => Promise<void>;
}) {
  const [value, setValue] = useState('');
  const [original, setOriginal] = useState<string | null>(null);
  const [version, setVersion] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const request = useRef<{ name: string; id: string } | null>(null);
  useEffect(() => {
    let cancelled = false;
    void administration.readMembershipName?.(membershipId).then(result => {
      if (cancelled) return;
      if (result.status === 'error') { setError(result.message); return; }
      setValue(result.displayName ?? ''); setOriginal(result.displayName); setVersion(result.rowVersion);
    }).catch(() => { if (!cancelled) setError('Der Name konnte nicht geladen werden. Bitte schließen Sie das Blatt und öffnen Sie es erneut.'); });
    return () => { cancelled = true; };
  }, [administration, membershipId]);
  useEffect(() => { if (version !== null) input.current?.focus(); }, [version]);
  return <MobileSheet label="Name ändern" className="right-sheet" busy={busy} onCancel={onCancel}>
    <h2>Name ändern</h2>
    {error ? <p role="alert">{error}</p> : null}
    {version === null ? <>{!error ? <p role="status">Name wird geladen …</p> : null}<button type="button" className="secondary" onClick={onCancel}>Schließen</button></> :
      <RequiredForm className="form-grid" onSubmit={event => {
        event.preventDefault(); if (busy) return;
        const name = normalizeCustomerNameV1(value);
        if (name.status !== 'valid') { setError('Bitte geben Sie einen gültigen Namen ein.'); return; }
        if (name.canonicalName === original) { setError('Der Name ist unverändert. Bitte ändern Sie ihn oder brechen Sie ab.'); return; }
        if (request.current?.name !== name.canonicalName) request.current = { name: name.canonicalName, id: crypto.randomUUID() };
        setBusy(true); setError(null);
        void administration.renameMembership?.(membershipId, version, name.canonicalName, request.current.id).then(async result => {
          if (result.status === 'saved') await onSaved(); else setError(result.message);
        }).catch(() => setError('Ob der Name gespeichert wurde, ist noch unklar. Bitte versuchen Sie es erneut.')).finally(() => setBusy(false));
      }}>
        <label>Name<input ref={input} required disabled={busy} value={value} onChange={event => { setValue(event.target.value); setError(null); }} autoComplete="name" /></label>
        <button className="primary-action" disabled={busy}>Namen speichern</button>
        <button type="button" className="secondary" disabled={busy} onClick={onCancel}>Abbrechen</button>
      </RequiredForm>}
  </MobileSheet>;
}
