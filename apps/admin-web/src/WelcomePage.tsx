import { useRef, useState } from 'react';
import type { InvitePasswordCapability, InvitePasswordResult } from './SupabaseInviteAuth';
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/latin-700.css';
import './styles.css';

const messages: Record<Exclude<InvitePasswordResult, 'succeeded'>, string> = {
  invalid_invitation: 'Dieser Einladungslink ist ungültig oder abgelaufen. Bitte wenden Sie sich an Ihren Administrator.',
  weak_password: 'Dieses Passwort wurde nicht angenommen. Bitte wählen Sie ein längeres, neues Passwort.',
  rate_limited: 'Zu viele Versuche. Bitte warten Sie kurz und versuchen Sie es erneut.',
  unavailable: 'Das Passwort konnte nicht gespeichert werden. Bitte versuchen Sie es erneut, sobald die Verbindung wieder funktioniert.',
};

export function WelcomePage({ invitation }: { readonly invitation: InvitePasswordCapability | null }) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const [completed, setCompleted] = useState(false);
  const [notice, setNotice] = useState<string | null>(invitation === null
    ? 'Die Kontoeinrichtung ist nicht verfügbar. Bitte wenden Sie sich an Ihren Administrator.'
    : invitation.hasInvitation ? null : messages.invalid_invitation);

  if (completed) return <main className="login-shell">
    <p className="login-card" role="status">Jetzt die App öffnen und anmelden.</p>
  </main>;

  return <main className="login-shell">
    <section className="login-card" aria-labelledby="welcome-title">
      <span className="eyebrow">Taptura</span>
      <h1 id="welcome-title">Passwort setzen</h1>
      {notice === null ? null : <p role="alert">{notice}</p>}
      {invitation?.hasInvitation ? <form onSubmit={(event) => {
        event.preventDefault();
        if (submitting.current) return;
        submitting.current = true;
        setBusy(true);
        setNotice(null);
        void invitation.setPassword(password).catch(() => 'unavailable' as const).then((result) => {
          submitting.current = false;
          setBusy(false);
          if (result === 'succeeded') {
            setPassword('');
            setCompleted(true);
          } else {
            setNotice(messages[result]);
          }
        });
      }}>
        <label htmlFor="welcome-password">Neues Passwort</label>
        <input id="welcome-password" type="password" autoComplete="new-password"
          required minLength={8} value={password}
          onChange={(event) => setPassword(event.target.value)} />
        <small>Mindestens 8 Zeichen. Ein längerer Satz ist leichter zu merken.</small>
        <button type="submit" aria-busy={busy} disabled={busy}>
          {busy ? 'Passwort wird gespeichert …' : 'Passwort setzen'}
        </button>
      </form> : null}
    </section>
  </main>;
}
