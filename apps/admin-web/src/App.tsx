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
  const [correctionRecordId, setCorrectionRecordId] = useState('');
  const [correctionStartedAt, setCorrectionStartedAt] = useState('');
  const [correctionStoppedAt, setCorrectionStoppedAt] = useState('');
  const [correctionReason, setCorrectionReason] = useState('');
  const [reviewItemId, setReviewItemId] = useState('');
  const [reviewResolution, setReviewResolution] = useState<'no_time_record_change' | 'adjust_existing_time_record' | 'create_recovered_time_record'>('no_time_record_change');
  const [reviewRecordId, setReviewRecordId] = useState('');
  const [reviewStartedAt, setReviewStartedAt] = useState('');
  const [reviewStoppedAt, setReviewStoppedAt] = useState('');
  const [reviewReason, setReviewReason] = useState('');

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
      <article><strong>{state.timeRecords.length}</strong><span>Arbeitszeiten</span></article>
      <article><strong>{state.reviewItems.length}</strong><span>Offene Reviews</span></article>
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
      <section className="panel time-review-panel">
        <div className="panel-heading">
          <div>
            <h2>Arbeitszeiten</h2>
            <p className="muted">Begrenzt von {formatDateTime(state.timeWindow.fromInclusive)} bis {formatDateTime(state.timeWindow.toExclusive)}.</p>
          </div>
          <button
            className="secondary"
            disabled={state.timeReviewBusy}
            onClick={() => void administration.exportTimeRecords()}
          >CSV exportieren</button>
        </div>
        <div className="table-scroll">
          <table>
            <thead><tr><th>Beschäftigt</th><th>Kunde</th><th>Zeitraum</th><th>Quelle</th><th>Revision</th><th>Status</th></tr></thead>
            <tbody>{state.timeRecords.map((record) => <tr key={record.timeRecordId}>
              <td>{record.employeeDisplayName}</td><td>{record.customerDisplayName}</td>
              <td>{formatDateTime(record.startedAt)} – {record.stoppedAt === null ? 'läuft' : formatDateTime(record.stoppedAt)}</td>
              <td>{record.source === 'canonical' ? 'Kanonisch' : 'Wiederhergestellt'}</td>
              <td>{record.effectiveRevisionNumber}</td>
              <td>{record.status === 'started' ? 'Gestartet' : 'Gestoppt'}{record.overlapsAnotherRecord ? ' · Überschneidung' : ''}</td>
            </tr>)}</tbody>
          </table>
        </div>
        {state.timeRecords.length === 0 ? <p className="empty">Keine Arbeitszeiten im begrenzten Zeitraum.</p> : null}
        <form className="decision-form" onSubmit={(event) => {
          event.preventDefault();
          administration.prepareCorrection(
            correctionRecordId,
            toCanonicalTimestamp(correctionStartedAt),
            toCanonicalTimestamp(correctionStoppedAt),
            correctionReason,
          );
        }}>
          <h3>Abgeschlossene Arbeitszeit korrigieren</h3>
          <label>Arbeitszeit
            <select required value={correctionRecordId} disabled={state.timeReviewBusy || state.correctionIntent !== null} onChange={(event) => {
              const id = event.target.value;
              setCorrectionRecordId(id);
              const selected = state.timeRecords.find((record) => record.timeRecordId === id);
              setCorrectionStartedAt(selected === undefined ? '' : toLocalTimestamp(selected.startedAt));
              setCorrectionStoppedAt(selected?.stoppedAt === null || selected === undefined ? '' : toLocalTimestamp(selected.stoppedAt));
            }}>
              <option value="">Arbeitszeit auswählen</option>
              {state.timeRecords.filter((record) => record.status === 'stopped').map((record) => <option key={record.timeRecordId} value={record.timeRecordId}>
                {record.employeeDisplayName} · {record.customerDisplayName} · {formatDateTime(record.startedAt)}
              </option>)}
            </select>
          </label>
          <label>Neuer Beginn<input required type="datetime-local" step="0.001" value={correctionStartedAt} disabled={state.timeReviewBusy || state.correctionIntent !== null} onChange={(event) => setCorrectionStartedAt(event.target.value)} /></label>
          <label>Neues Ende<input required type="datetime-local" step="0.001" value={correctionStoppedAt} disabled={state.timeReviewBusy || state.correctionIntent !== null} onChange={(event) => setCorrectionStoppedAt(event.target.value)} /></label>
          <label>Begründung<textarea required maxLength={500} value={correctionReason} disabled={state.timeReviewBusy || state.correctionIntent !== null} onChange={(event) => setCorrectionReason(event.target.value)} /></label>
          <button disabled={state.timeReviewBusy || state.correctionIntent !== null}>Korrektur prüfen</button>
        </form>
        {state.correctionIntent === null ? null : <aside className="decision-confirmation" aria-label="Korrektur ausdrücklich bestätigen">
          <strong>Korrektur wirklich protokollieren?</strong>
          <dl>
            <dt>Vorher</dt><dd>{formatDateTime(state.correctionIntent.timeRecord.startedAt)} – {formatDateTime(state.correctionIntent.timeRecord.stoppedAt!)}</dd>
            <dt>Nachher</dt><dd>{formatDateTime(state.correctionIntent.startedAt)} – {formatDateTime(state.correctionIntent.stoppedAt)}</dd>
            <dt>Begründung</dt><dd>{state.correctionIntent.reason}</dd>
          </dl>
          <div className="confirmation-actions">
            <button disabled={state.timeReviewBusy} onClick={() => void administration.confirmCorrection()}>{state.timeReviewBusy ? 'Wird protokolliert …' : 'Korrektur ausdrücklich bestätigen'}</button>
            <button className="secondary" disabled={state.timeReviewBusy} onClick={() => administration.cancelCorrection()}>Abbrechen</button>
          </div>
        </aside>}
      </section>
      <section className="panel time-review-panel">
        <h2>Review-Evidence</h2>
        <ul className="review-list">{state.reviewItems.map((item) => <li key={item.reviewItemId}>
          <div><strong>{item.employeeDisplayName} · {item.customerDisplayName}</strong><small>{formatDateTime(item.occurredAt)} · {item.source === 'offline_v2' ? 'Offline V2' : 'Server Legacy'}</small></div>
          <span>{reviewReasonLabel(item.reviewReason)}{item.predecessorBlocked ? ' · Vorgänger blockiert' : ''}</span>
        </li>)}</ul>
        {state.reviewItems.length === 0 ? <p className="empty">Keine offene Review-Evidence.</p> : null}
        <form className="decision-form" onSubmit={(event) => {
          event.preventDefault();
          administration.prepareAdjudication(
            reviewItemId, reviewResolution,
            reviewResolution === 'adjust_existing_time_record' ? reviewRecordId : null,
            reviewResolution === 'no_time_record_change' ? null : toCanonicalTimestamp(reviewStartedAt),
            reviewResolution === 'no_time_record_change' ? null : toCanonicalTimestamp(reviewStoppedAt),
            reviewReason,
          );
        }}>
          <h3>Evidence entscheiden</h3>
          <label>Review-Evidence<select required value={reviewItemId} disabled={state.timeReviewBusy || state.adjudicationIntent !== null} onChange={(event) => setReviewItemId(event.target.value)}>
            <option value="">Evidence auswählen</option>
            {state.reviewItems.map((item) => <option key={item.reviewItemId} value={item.reviewItemId}>{item.employeeDisplayName} · {item.customerDisplayName} · {formatDateTime(item.occurredAt)}</option>)}
          </select></label>
          <label>Entscheidung<select value={reviewResolution} disabled={state.timeReviewBusy || state.adjudicationIntent !== null} onChange={(event) => setReviewResolution(event.target.value as typeof reviewResolution)}>
            <option value="no_time_record_change">Keine Arbeitszeit ändern</option>
            <option value="create_recovered_time_record">Arbeitszeit wiederherstellen</option>
            <option value="adjust_existing_time_record">Bestehende Arbeitszeit korrigieren</option>
          </select></label>
          {reviewResolution === 'adjust_existing_time_record' ? <label>Bestehende Arbeitszeit<select required value={reviewRecordId} disabled={state.timeReviewBusy || state.adjudicationIntent !== null} onChange={(event) => {
            const id = event.target.value;
            setReviewRecordId(id);
            const selected = state.timeRecords.find((record) => record.timeRecordId === id);
            setReviewStartedAt(selected === undefined ? '' : toLocalTimestamp(selected.startedAt));
            setReviewStoppedAt(selected?.stoppedAt === null || selected === undefined ? '' : toLocalTimestamp(selected.stoppedAt));
          }}><option value="">Arbeitszeit auswählen</option>{state.timeRecords.filter((record) => record.status === 'stopped').map((record) => <option key={record.timeRecordId} value={record.timeRecordId}>{record.employeeDisplayName} · {formatDateTime(record.startedAt)}</option>)}</select></label> : null}
          {reviewResolution === 'no_time_record_change' ? null : <>
            <label>Beginn<input required type="datetime-local" step="0.001" value={reviewStartedAt} disabled={state.timeReviewBusy || state.adjudicationIntent !== null} onChange={(event) => setReviewStartedAt(event.target.value)} /></label>
            <label>Ende<input required type="datetime-local" step="0.001" value={reviewStoppedAt} disabled={state.timeReviewBusy || state.adjudicationIntent !== null} onChange={(event) => setReviewStoppedAt(event.target.value)} /></label>
          </>}
          <label>Begründung<textarea required maxLength={500} value={reviewReason} disabled={state.timeReviewBusy || state.adjudicationIntent !== null} onChange={(event) => setReviewReason(event.target.value)} /></label>
          <button disabled={state.timeReviewBusy || state.adjudicationIntent !== null}>Review-Entscheidung prüfen</button>
        </form>
        {state.adjudicationIntent === null ? null : <aside className="decision-confirmation" aria-label="Review-Entscheidung ausdrücklich bestätigen">
          <strong>Review-Entscheidung wirklich protokollieren?</strong>
          <dl>
            <dt>Evidence</dt><dd>{state.adjudicationIntent.reviewItem.employeeDisplayName} · {formatDateTime(state.adjudicationIntent.reviewItem.occurredAt)}</dd>
            <dt>Entscheidung</dt><dd>{resolutionLabel(state.adjudicationIntent.resolution)}</dd>
            {state.adjudicationIntent.timeRecord === null ? null : <><dt>Vorher</dt><dd>{formatDateTime(state.adjudicationIntent.timeRecord.startedAt)} – {formatDateTime(state.adjudicationIntent.timeRecord.stoppedAt!)}</dd></>}
            {state.adjudicationIntent.startedAt === null ? null : <><dt>Nachher</dt><dd>{formatDateTime(state.adjudicationIntent.startedAt)} – {formatDateTime(state.adjudicationIntent.stoppedAt!)}</dd></>}
            <dt>Begründung</dt><dd>{state.adjudicationIntent.reason}</dd>
          </dl>
          <div className="confirmation-actions">
            <button disabled={state.timeReviewBusy} onClick={() => void administration.confirmAdjudication()}>{state.timeReviewBusy ? 'Wird protokolliert …' : 'Review ausdrücklich bestätigen'}</button>
            <button className="secondary" disabled={state.timeReviewBusy} onClick={() => administration.cancelAdjudication()}>Abbrechen</button>
          </div>
        </aside>}
      </section>
    </div>
    {state.projection.nextCursor === null ? null : <div className="more">
      <button className="secondary" onClick={() => administration.loadMore()}>
        Weitere Einrichtungsdaten laden
      </button>
    </div>}
  </main>;
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' });
}

function toLocalTimestamp(value: string): string {
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 23);
}

function toCanonicalTimestamp(value: string): string {
  const epoch = Date.parse(value);
  return Number.isFinite(epoch) ? new Date(epoch).toISOString() : '';
}

function reviewReasonLabel(value: string): string {
  const labels: Record<string, string> = {
    identity_or_membership_not_current: 'Identität oder Mitgliedschaft nicht aktuell',
    capture_time_out_of_bounds: 'Erfassungszeit außerhalb des Fensters',
    automatic_window_elapsed: 'Automatisches Zeitfenster abgelaufen',
    historical_configuration_not_valid: 'Historische Konfiguration ungültig',
    predecessor_requires_review: 'Vorgänger benötigt Review',
    server_lifecycle_deferred: 'Server-Lifecycle zurückgestellt',
  };
  return labels[value] ?? 'Review erforderlich';
}

function resolutionLabel(value: string): string {
  if (value === 'no_time_record_change') return 'Keine Arbeitszeit ändern';
  if (value === 'create_recovered_time_record') return 'Arbeitszeit wiederherstellen';
  return 'Bestehende Arbeitszeit korrigieren';
}
