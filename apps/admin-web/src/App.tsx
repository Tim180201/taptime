import { FormEvent, useState, useSyncExternalStore } from 'react';
import type { AdminWebCapability } from './contracts';
import './styles.css';

export function App({ administration }: { readonly administration: AdminWebCapability }) {
  const state = useSyncExternalStore(
    (listener) => administration.subscribe(listener),
    () => administration.getState(),
    () => administration.getState(),
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [employeeName, setEmployeeName] = useState('');
  const [reassignmentTagId, setReassignmentTagId] = useState('');
  const [reassignmentTargetCustomerId, setReassignmentTargetCustomerId] = useState('');

  if (state.status === 'signed_out' || state.status === 'signing_in') {
    return <main className="login"><section className="login-card">
      <p className="eyebrow">TAPTIM.E ADMIN</p>
      <h1>Einfach sauber eingerichtet.</h1>
      <p>Melde dich mit deinem Administrator-Konto an.</p>
      <form onSubmit={(event: FormEvent) => {
        event.preventDefault();
        void administration.signIn(email, password);
      }}>
        <label>E-Mail<input type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
        <label>Passwort<input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
        <button disabled={state.status === 'signing_in'}>
          {state.status === 'signing_in' ? 'Wird geprüft …' : 'Sicher anmelden'}
        </button>
      </form>
    </section></main>;
  }
  if (state.status === 'loading') {
    return <main className="center"><h1>Einrichtung wird geladen …</h1></main>;
  }
  if (state.status === 'forbidden' || state.status === 'unavailable') {
    return <main className="center"><h1>Nicht verfügbar</h1><p>{state.message}</p>
      <button onClick={() => administration.signOut()}>Zur Anmeldung</button>
    </main>;
  }

  const customerNameById = new Map(
    state.projection.customers.map((customer) => [customer.id, customer.displayName]),
  );
  const reassignmentTag = state.reassignmentIntent === null
    ? null
    : state.projection.nfcTags.find(
        (tag) => tag.id === state.reassignmentIntent?.nfcTagId,
      ) ?? null;
  const reassignmentTarget = state.reassignmentIntent === null
    ? null
    : state.projection.customers.find(
        (customer) => customer.id === state.reassignmentIntent?.targetCustomerId,
      ) ?? null;
  const selectedReassignmentTag = state.projection.nfcTags.find(
    (tag) => tag.id === reassignmentTagId,
  );
  const canPrepareReassignment = selectedReassignmentTag?.assignmentState === 'assigned'
    && reassignmentTargetCustomerId.length > 0
    && selectedReassignmentTag.targetCustomerId !== reassignmentTargetCustomerId;
  return <main>
    <header>
      <div><p className="eyebrow">TAPTIM.E ADMIN</p><h1>{state.projection.organization.name}</h1></div>
      <div className="header-actions">
        <button className="secondary" onClick={() => administration.refresh()}>Aktualisieren</button>
        <button className="secondary" onClick={() => administration.signOut()}>Abmelden</button>
      </div>
    </header>
    <section className="metrics">
      <article><strong>{state.projection.customers.length}</strong><span>Kunden</span></article>
      <article><strong>{state.projection.nfcTags.length}</strong><span>NFC-Tags</span></article>
      <article><strong>{state.employeeProjection.employeeMemberships.length}</strong><span>Beschäftigte</span></article>
    </section>
    {state.notice ? <p role="status" className="notice">{state.notice}</p> : null}
    <div className="grid">
      <section className="panel">
        <h2>Kunden</h2>
        <form className="inline" onSubmit={(event) => {
          event.preventDefault();
          void administration.createCustomer(customerName);
          setCustomerName('');
        }}>
          <label className="sr-only" htmlFor="customer-name">Kundenname</label>
          <input id="customer-name" required maxLength={120} placeholder="Neuer Kundenname" value={customerName} onChange={(event) => setCustomerName(event.target.value)} />
          <button disabled={state.creating}>{state.creating ? 'Wird angelegt …' : 'Kunde anlegen'}</button>
        </form>
        <ul>{state.projection.customers.map((customer) => <li key={customer.id}>
          <span>{customer.displayName}</span><small>{customer.active ? 'Aktiv' : 'Inaktiv'}</small>
        </li>)}</ul>
        {state.projection.customers.length === 0
          ? <p className="empty">Noch keine Kunden vorhanden.</p> : null}
      </section>
      <section className="panel">
        <h2>NFC-Tags</h2>
        <p className="muted">Neue Tags werden geschützt in der Android-App erfasst.</p>
        <form className="reassignment-form" onSubmit={(event) => {
          event.preventDefault();
          administration.prepareReassignment(
            reassignmentTagId,
            reassignmentTargetCustomerId,
          );
        }}>
          <label>Zuordnungsfähiger NFC-Tag
            <select
              required
              value={reassignmentTagId}
              onChange={(event) => setReassignmentTagId(event.target.value)}
              disabled={state.reassigning || state.reassignmentIntent !== null}
            >
              <option value="">Tag auswählen</option>
              {state.projection.nfcTags
                .filter((tag) => tag.assignmentState === 'assigned')
                .map((tag) => <option key={tag.id} value={tag.id}>
                  {tag.displayName} · {tag.validationFingerprint}
                </option>)}
            </select>
          </label>
          <label>Neuer aktiver Kunde
            <select
              required
              value={reassignmentTargetCustomerId}
              onChange={(event) => setReassignmentTargetCustomerId(event.target.value)}
              disabled={state.reassigning || state.reassignmentIntent !== null}
            >
              <option value="">Ziel auswählen</option>
              {state.projection.customers
                .filter((customer) => customer.active)
                .map((customer) => <option
                  key={customer.id}
                  value={customer.id}
                  disabled={customer.id === selectedReassignmentTag?.targetCustomerId}
                >
                  {customer.displayName}
                </option>)}
            </select>
          </label>
          <button disabled={
            state.reassigning
            || state.reassignmentIntent !== null
            || !canPrepareReassignment
          }>
            Zuordnung vorbereiten
          </button>
        </form>
        {state.reassignmentIntent !== null
          && reassignmentTag !== null
          && reassignmentTarget !== null
          ? <aside className="reassignment-confirmation" aria-label="Zuordnung ausdrücklich bestätigen">
              <strong>Zuordnung wirklich ändern?</strong>
              <p>
                <span>{reassignmentTag.displayName}</span>
                <small>Prüf-Fingerprint {reassignmentTag.validationFingerprint}</small>
              </p>
              <p>
                {reassignmentTag.targetCustomerId === null
                  ? 'Nicht zugeordnet'
                  : customerNameById.get(reassignmentTag.targetCustomerId) ?? 'Bisheriger Kunde'}
                {' → '}
                {reassignmentTarget.displayName}
              </p>
              <div className="confirmation-actions">
                <button
                  onClick={() => void administration.confirmReassignment()}
                  disabled={state.reassigning}
                >
                  {state.reassigning ? 'Wird sicher geändert …' : 'Änderung ausdrücklich bestätigen'}
                </button>
                <button
                  className="secondary"
                  onClick={() => administration.cancelReassignment()}
                  disabled={state.reassigning}
                >
                  Abbrechen
                </button>
              </div>
            </aside>
          : null}
        <ul>{state.projection.nfcTags.map((tag) => <li key={tag.id}>
          <div><span>{tag.displayName}</span><small>Prüf-Fingerprint {tag.validationFingerprint}</small></div>
          <small>{tag.targetCustomerId === null
            ? 'Nicht zugeordnet'
            : customerNameById.get(tag.targetCustomerId) ?? 'Zugeordnet'}</small>
        </li>)}</ul>
        {state.projection.nfcTags.length === 0
          ? <p className="empty">Noch keine Tags registriert.</p> : null}
      </section>
      <section className="panel employee-panel">
        <h2>Beschäftigte</h2>
        <p className="muted">Erzeuge eine 15 Minuten gültige Einmal-Einladung.</p>
        <form className="inline" onSubmit={(event) => {
          event.preventDefault();
          void administration.createEmployeeInvitation(employeeName);
          setEmployeeName('');
        }}>
          <label className="sr-only" htmlFor="employee-name">Name des Beschäftigten</label>
          <input id="employee-name" required maxLength={120} placeholder="Name des Beschäftigten" value={employeeName} onChange={(event) => setEmployeeName(event.target.value)} />
          <button disabled={state.creatingEmployee}>
            {state.creatingEmployee ? 'Wird erzeugt …' : 'Einladung erzeugen'}
          </button>
        </form>
        {state.invitation === null ? null : <aside className="invitation" aria-label="Einmaliges Einladungsgeheimnis">
          <strong>Nur jetzt sicher übergeben</strong>
          <code>{state.invitation.value}</code>
          <small>Gültig bis {new Date(state.invitation.expiresAt).toLocaleTimeString('de-DE')}</small>
          <button className="secondary" onClick={() => administration.dismissInvitation()}>Geheimnis verwerfen</button>
        </aside>}
        <ul>{state.employeeProjection.employeeMemberships.map((membership) => <li key={membership.id}>
          <span>{membership.displayName}</span><small>Beschäftigt · Aktiv</small>
        </li>)}</ul>
        {state.employeeProjection.employeeMemberships.length === 0
          ? <p className="empty">Noch keine Beschäftigten angelegt.</p> : null}
        {state.employeeProjection.nextCursor === null ? null
          : <button className="secondary" onClick={() => administration.loadMoreEmployees()}>
              Weitere Beschäftigte laden
            </button>}
      </section>
    </div>
    {state.projection.nextCursor === null ? null : <div className="more">
      <button className="secondary" onClick={() => administration.loadMore()}>
        Weitere Einrichtungsdaten laden
      </button>
    </div>}
  </main>;
}
