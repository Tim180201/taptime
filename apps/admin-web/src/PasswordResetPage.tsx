import { useRef, useState } from 'react';
import type { Notice } from './contracts';
import type { RecoveryPasswordCapability, RecoveryPasswordResult } from './SupabaseRecoveryAuth';
import './styles.css';

export const expiredResetLinkMessage = 'Der Link ist abgelaufen oder wurde schon benutzt. Fordern Sie in der App oder hier unter „Passwort vergessen“ einen neuen an.';
const messages: Record<Exclude<RecoveryPasswordResult, 'succeeded'>, string> = {
  invalid_link: expiredResetLinkMessage,
  weak_password: 'Dieses Passwort wurde nicht angenommen. Bitte wählen Sie ein längeres, neues Passwort.',
  rate_limited: 'Zu viele Versuche. Bitte warten Sie kurz und versuchen Sie es erneut.',
  unavailable: 'Das Passwort konnte nicht gespeichert werden. Bitte versuchen Sie es erneut, sobald die Verbindung wieder funktioniert.',
  completion_unconfirmed: 'Ihr Passwort wurde geändert; der Abschluss ist noch nicht bestätigt. Bestätigen Sie die Änderung erneut.',
};

export function PasswordResetPage({ recovery }: { readonly recovery: RecoveryPasswordCapability | null }) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const [completed, setCompleted] = useState(false);
  const [awaitingCompletion, setAwaitingCompletion] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(recovery === null
    ? { kind: 'error', text: 'Die Passwortänderung ist nicht verfügbar. Bitte versuchen Sie es später erneut.' }
    : recovery.hasRecovery ? null : { kind: 'error', text: expiredResetLinkMessage });

  return <main className="login-shell">
    <section className="login-card" aria-labelledby="reset-title">
      <span className="eyebrow">Taptura</span>
      <h1 id="reset-title">Neues Passwort setzen</h1>
      {completed ? <p role="status">Passwort geändert. Melden Sie sich jetzt in der App oder hier mit dem neuen Passwort an.</p>
        : <>
          {notice === null ? null : <p role="alert">{notice.text}</p>}
          {recovery?.hasRecovery ? <form onSubmit={(event) => {
            event.preventDefault();
            if (submitting.current) return;
            submitting.current = true;
            setBusy(true);
            setNotice(null);
            void recovery.setPassword(password).catch(() => 'unavailable' as const).then((result) => {
              submitting.current = false;
              setBusy(false);
              if (result === 'succeeded') {
                setPassword('');
                setCompleted(true);
              } else {
                setAwaitingCompletion(result === 'completion_unconfirmed');
                setNotice({ kind: 'error', text: messages[result] });
              }
            });
          }}>
            <label htmlFor="reset-password">Neues Passwort</label>
            <input id="reset-password" type="password" autoComplete="new-password"
              required minLength={8} value={password} disabled={busy || awaitingCompletion}
              onChange={(event) => setPassword(event.target.value)} />
            <small>Mindestens 8 Zeichen. Ein längerer Satz ist leichter zu merken.</small>
            <button type="submit" aria-busy={busy} disabled={busy}>
              {busy ? 'Passwort wird gespeichert …' : awaitingCompletion ? 'Änderung abschließen' : 'Passwort ändern'}
            </button>
          </form> : null}
        </>}
      <p><a className="button-link secondary-link" href="/">Im Browser anmelden</a></p>
    </section>
  </main>;
}
