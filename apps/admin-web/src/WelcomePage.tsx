import type { Notice } from './contracts';
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
  const [notice, setNotice] = useState<Notice | null>(invitation === null
    ? { kind: 'error', text: 'Die Kontoeinrichtung ist nicht verfügbar. Bitte wenden Sie sich an Ihren Administrator.' }
    : invitation.hasInvitation ? null : { kind: 'error', text: messages.invalid_invitation });

  if (completed) return <main className="login-shell">
    <section className="login-card" aria-label="Passwort gespeichert">
      <p role="status">Ihr Passwort ist gespeichert.</p>
      <a className="button-link" href="/">Im Browser anmelden</a>
      <p>In der App anmelden; die App erhalten Sie von Ihrem Betrieb.</p>
    </section>
  </main>;

  return <main className="login-shell">
    <section className="login-card" aria-labelledby="welcome-title">
      <span className="eyebrow">Taptura</span>
      <h1 id="welcome-title">Passwort setzen</h1>
      {notice === null ? null : <p role="alert">{notice.text}</p>}
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
            setNotice({ kind: 'error', text: messages[result] });
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
