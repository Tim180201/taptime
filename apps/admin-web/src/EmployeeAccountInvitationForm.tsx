import { useEffect, useRef, useState } from 'react';
import { AdminWebApiClient } from './AdminWebApiClient';
import type { AdminWebAuthPort } from './AdminWebCoordinator';
import type { AdminWebState } from './contracts';
import { ACCOUNT_INVITATION_NOTICES, type AccountInvitationApiResult, type AccountInvitationSuccess } from './accountInvitation';

export interface EmployeeAccountInvitationCapability {
  invite(displayName: string, email: string, locationId: string | null): Promise<AccountInvitationApiResult>;
}

/** Uses the existing login capability without changing or extending the legacy coordinator. */
export class EmployeeAccountInvitationClient implements EmployeeAccountInvitationCapability {
  constructor(private readonly auth: Pick<AdminWebAuthPort, 'withAccessToken'>,
    private readonly api = new AdminWebApiClient()) {}

  async invite(displayName: string, email: string, locationId: string | null): Promise<AccountInvitationApiResult> {
    try {
      return await this.auth.withAccessToken(async (token): Promise<AccountInvitationApiResult> => {
        const session = await this.api.session(token);
        if (session.status !== 'succeeded') return session.status === 'rejected'
          ? { status: 'rejected' } : { status: 'unreachable' };
        return this.api.createEmployeeAccountInvitation(token, session.value.membershipId,
          crypto.randomUUID(), displayName, email, locationId);
      }) ?? { status: 'rejected' };
    } catch { return { status: 'unreachable' }; }
  }
}

type ReadyState = Extract<AdminWebState, { readonly status: 'ready' }>;
export function EmployeeAccountInvitationForm({ capability, state, open, setOpen, onCreated }: {
  readonly capability?: EmployeeAccountInvitationCapability;
  readonly state: Pick<ReadyState, 'locationsEnabled' | 'selectedLocation' | 'assignableLocations'>;
  readonly open: boolean;
  readonly setOpen: (open: boolean) => void;
  readonly onCreated: (status: AccountInvitationSuccess) => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [locationId, setLocationId] = useState(state.selectedLocation?.id
    ?? (state.assignableLocations.length === 1 ? state.assignableLocations[0]!.id : ''));
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const [notice, setNotice] = useState<{ error: boolean; text: string } | null>(null);
  const nameInput = useRef<HTMLInputElement>(null);
  useEffect(() => { if (open) nameInput.current?.focus(); }, [open]);

  return <>
    {notice === null ? null : <p role={notice.error ? 'alert' : 'status'}>{notice.text}</p>}
    {!open ? <button onClick={() => setOpen(true)}>Mitarbeiter hinzufügen</button>
      : <form className="inline-form" onSubmit={(event) => {
        event.preventDefault();
        if (submitting.current) return;
        submitting.current = true;
        setBusy(true); setNotice(null);
        const request = capability?.invite(name, email, state.locationsEnabled ? locationId : null)
          ?? Promise.resolve({ status: 'failed', code: 'account_creation_not_configured' } as const);
        void request.catch(() => ({ status: 'unreachable' } as const)).then(async (result) => {
          submitting.current = false; setBusy(false);
          if (result.status === 'succeeded' || result.status === 'succeeded_existing_account') {
            setName(''); setEmail(''); setOpen(false);
            await onCreated(result.status);
          } else {
            setNotice({ error: true, text: result.status === 'failed' ? ACCOUNT_INVITATION_NOTICES[result.code]
              : result.status === 'rejected' ? 'Ihre Sitzung ist abgelaufen. Bitte melden Sie sich erneut an.'
                : ACCOUNT_INVITATION_NOTICES.invitation_needs_attention });
          }
        });
      }}>
        <label htmlFor="employee-name">Name</label>
        <input ref={nameInput} id="employee-name" required maxLength={120} value={name}
          onChange={(event) => setName(event.target.value)} />
        <label htmlFor="employee-email">E-Mail</label>
        <input id="employee-email" type="email" autoComplete="email" required maxLength={254}
          value={email} onChange={(event) => setEmail(event.target.value)} />
        {state.locationsEnabled ? <>
          <label htmlFor="employee-location">Heimatstandort</label>
          <select id="employee-location" required value={locationId}
            onChange={(event) => setLocationId(event.target.value)}>
            <option value="">Standort auswählen</option>
            {state.assignableLocations.map((location) => <option key={location.id}
              value={location.id}>{location.name}</option>)}
          </select>
        </> : null}
        <button disabled={busy}>{busy ? 'Einladung wird versendet …' : 'Einladung senden'}</button>
      </form>}
  </>;
}
