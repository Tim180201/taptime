import {
  FormEvent,
  type RefObject,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import type {
  AdminSection,
  AdminWebCapability,
  SafeReviewItem,
} from './contracts';
import {
  adminViews,
  canonicalViewHash,
  type AdminView,
  viewFromHash,
} from './navigation';
import {
  formatExactZonedDateTime,
  formatZonedDateTime,
  parseZonedLocalTimestamp,
  resolveBrowserTimeZone,
  type TimeZoneContext,
  toZonedLocalInput,
} from './timeZone';
import { Confirmation, CountTruth, Panel, SectionBoundary } from './ui';
import './styles.css';

export function App({
  administration,
  resolveTimeZone = resolveBrowserTimeZone,
}: {
  readonly administration: AdminWebCapability;
  readonly resolveTimeZone?: () => TimeZoneContext;
}) {
  const state = useSyncExternalStore(
    (listener) => administration.subscribe(listener),
    () => administration.getState(),
    () => administration.getState(),
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const timezone = useCentralTimeZone(administration, resolveTimeZone);
  const [view, setView] = useState<AdminView>(() => currentView());
  const previousView = useRef(view);
  const mainHeading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const synchronize = () => {
      const next = currentView();
      if (typeof window !== 'undefined' && window.location.hash !== canonicalViewHash(next)) {
        window.history.replaceState(null, '', canonicalViewHash(next));
      }
      setView(next);
    };
    synchronize();
    window.addEventListener('hashchange', synchronize);
    return () => window.removeEventListener('hashchange', synchronize);
  }, []);

  useEffect(() => {
    if (
      previousView.current === 'beschaeftigte'
      && view !== 'beschaeftigte'
      && state.status === 'ready'
    ) administration.dismissInvitation();
    previousView.current = view;
    mainHeading.current?.focus();
  }, [administration, view]);

  if (state.status === 'signed_out' || state.status === 'signing_in') {
    return <main className="login-shell">
      <section className="login-card" aria-labelledby="login-title">
        <Brand />
        <h1 id="login-title">Einfach sauber eingerichtet.</h1>
        <p>Melde dich mit deinem Administrator-Konto an.</p>
        <form onSubmit={(event: FormEvent) => {
          event.preventDefault();
          const passwordSnapshot = password;
          setPassword('');
          void administration.signIn(email, passwordSnapshot);
        }}>
          <label htmlFor="login-email">E-Mail</label>
          <input id="login-email" type="email" autoComplete="username" required value={email}
            onChange={(event) => setEmail(event.target.value)} />
          <label htmlFor="login-password">Passwort</label>
          <input id="login-password" type="password" autoComplete="current-password" required
            value={password} onChange={(event) => setPassword(event.target.value)} />
          <button disabled={state.status === 'signing_in'}>
            {state.status === 'signing_in' ? 'Wird geprüft …' : 'Sicher anmelden'}
          </button>
        </form>
      </section>
    </main>;
  }
  if (state.status === 'loading') {
    return <main className="center" aria-busy="true">
      <Brand />
      <h1>Administration wird geladen …</h1>
    </main>;
  }
  if (state.status === 'forbidden' || state.status === 'unavailable') {
    return <main className="center">
      <Brand />
      <h1>Nicht verfügbar</h1>
      <p role="alert">{state.message}</p>
      <button onClick={() => void administration.signOut()}>Zur Anmeldung</button>
    </main>;
  }

  const activeView = adminViews.find((candidate) => candidate.slug === view)!;
  return <div className="app-shell">
    <aside className="sidebar">
      <Brand />
      <nav aria-label="Hauptnavigation">
        <ul>{adminViews.map((item) => <li key={item.slug}>
          <a
            href={canonicalViewHash(item.slug)}
            aria-current={item.slug === view ? 'page' : undefined}
          >{item.label}</a>
        </li>)}</ul>
      </nav>
      <div className="sidebar-footer">
        <span>Angemeldet für</span>
        <strong>{state.projection.organization.name}</strong>
      </div>
    </aside>
    <main className="workspace">
      <header className="workspace-header">
        <div>
          <p className="eyebrow">ADMINISTRATION</p>
          <h1 ref={mainHeading} tabIndex={-1}>{activeView.label}</h1>
        </div>
        <div className="header-actions">
          <button className="secondary" onClick={() => void administration.refresh()}>
            Alle Bereiche aktualisieren
          </button>
          <button className="quiet" onClick={() => void administration.signOut()}>Abmelden</button>
        </div>
      </header>
      <p className="timezone-declaration">
        Zeitdarstellung: {timezone.timeZone}
        {timezone.usedUtcFallback ? ' (sicherer UTC-Fallback)' : ''}
      </p>
      {state.notice ? <p role="status" aria-live="polite" className="notice">{state.notice}</p> : null}
      {view === 'uebersicht' ? <Overview state={state} administration={administration} /> : null}
      {view === 'einrichtung' ? <SetupView state={state} administration={administration} /> : null}
      {view === 'beschaeftigte' ? <EmployeesView state={state} administration={administration} timezone={timezone} /> : null}
      {view === 'arbeitszeiten' ? <TimeRecordsView state={state} administration={administration} timezone={timezone} /> : null}
      {view === 'pruefungen' ? <ReviewsView state={state} administration={administration} timezone={timezone} /> : null}
    </main>
  </div>;
}

type ReadyState = Extract<ReturnType<AdminWebCapability['getState']>, { readonly status: 'ready' }>;

function Overview({
  state,
  administration,
}: {
  readonly state: ReadyState;
  readonly administration: AdminWebCapability;
}) {
  const cards: readonly [AdminSection, string, number, boolean][] = [
    ['setup', 'Kunden geladen', state.projection.customers.length, state.projection.nextCursor === null],
    ['employees', 'Beschäftigte geladen', state.employeeProjection.employeeMemberships.length, state.employeeProjection.nextCursor === null],
    ['timeRecords', 'Arbeitszeiten geladen', state.timeRecords.length, state.timeRecordsNextCursor === null],
    ['reviewItems', 'Prüfungen geladen', state.reviewItems.length, state.reviewItemsNextCursor === null],
  ];
  return <section aria-label="Geladener Administrationsstand">
    <div className="metric-grid">{cards.map(([section, label, count, complete]) =>
      <article className="metric-card" key={section}>
        <span>{label}</span>
        <strong>{count}</strong>
        <small>{state.sections[section].status === 'loading'
          ? 'Wird neu geladen; angezeigter Stand ist nicht aktuell bestätigt'
          : state.sections[section].status === 'unavailable'
            ? 'Letzte Aktualisierung nicht bestätigt'
            : complete ? 'Ergebnis vollständig' : 'Weitere Seite verfügbar'}</small>
        {state.sections[section].status === 'unavailable'
          ? <button className="text-button" onClick={() => void administration.retrySection(section)}>
              Bereich erneut laden
            </button>
          : null}
      </article>)}
    </div>
    <Panel title="Sicherer Betriebsstatus" description="Geladene Daten, keine erfundenen Mandantensummen.">
      <dl className="status-list">
        <dt>Organisation</dt><dd>{state.projection.organization.name}</dd>
        <dt>Zeitfenster</dt><dd>Fest begrenzt auf die vergangenen 31 Tage</dd>
        <dt>Sitzung</dt><dd>Nur im Arbeitsspeicher · Neuladen meldet ab</dd>
        <dt>Export</dt><dd>Serverseitig erzeugtes CSV v1</dd>
      </dl>
    </Panel>
  </section>;
}

function SetupView({
  state,
  administration,
}: {
  readonly state: ReadyState;
  readonly administration: AdminWebCapability;
}) {
  const [customerName, setCustomerName] = useState('');
  const [tagId, setTagId] = useState('');
  const [targetId, setTargetId] = useState('');
  const prepareButton = useRef<HTMLButtonElement>(null);
  useIntentFocusReturn(state.reassignmentIntent !== null, prepareButton);
  const customerNameById = new Map(
    state.projection.customers.map((customer) => [customer.id, customer.displayName]),
  );
  const selectedTag = state.projection.nfcTags.find((tag) => tag.id === tagId);
  const intentTag = state.reassignmentIntent === null
    ? null
    : state.projection.nfcTags.find((tag) => tag.id === state.reassignmentIntent?.nfcTagId) ?? null;
  const intentTarget = state.reassignmentIntent === null
    ? null
    : state.projection.customers.find(
        (customer) => customer.id === state.reassignmentIntent?.targetCustomerId,
      ) ?? null;
  return <SectionBoundary state={state.sections.setup}
    onRetry={() => void administration.retrySection('setup')}>
    <div className="content-grid">
      <Panel title="Kunden" description="Aktive und inaktive Kunden der geladenen Seiten.">
        <CountTruth count={state.projection.customers.length} noun="Kunden"
          complete={state.projection.nextCursor === null} />
        <form className="inline-form" onSubmit={(event) => {
          event.preventDefault();
          void administration.createCustomer(customerName);
          setCustomerName('');
        }}>
          <label htmlFor="customer-name">Neuen Kunden anlegen</label>
          <div className="input-action">
            <input id="customer-name" required maxLength={120} value={customerName}
              onChange={(event) => setCustomerName(event.target.value)} />
            <button disabled={state.creating}>
              {state.creating ? 'Wird angelegt …' : 'Kunde anlegen'}
            </button>
          </div>
        </form>
        <ul className="entity-list">{state.projection.customers.map((customer) => <li key={customer.id}>
          <span>{customer.displayName}</span>
          <small className={`pill ${customer.active ? 'success' : ''}`}>
            {customer.active ? 'Aktiv' : 'Inaktiv'}
          </small>
        </li>)}</ul>
        {state.projection.customers.length === 0 && state.projection.nextCursor === null
          ? <p className="empty">Keine Kunden vorhanden.</p> : null}
      </Panel>
      <Panel title="NFC-Tags" description="Sichere Fingerprints statt NFC-Rohdaten.">
        <CountTruth count={state.projection.nfcTags.length} noun="Tags"
          complete={state.projection.nextCursor === null} />
        <ul className="entity-list">{state.projection.nfcTags.map((tag) => <li key={tag.id}>
          <div><span>{tag.displayName}</span><small>Prüf-Fingerprint {tag.validationFingerprint}</small></div>
          <small>{tag.targetCustomerId === null
            ? 'Nicht zugeordnet'
            : customerNameById.get(tag.targetCustomerId) ?? 'Zugeordnet'}</small>
        </li>)}</ul>
        {state.projection.nfcTags.length === 0 && state.projection.nextCursor === null
          ? <p className="empty">Keine Tags registriert.</p> : null}
      </Panel>
      <Panel title="Tag neu zuordnen" description="Eine laufende Arbeitszeit blockiert die Änderung."
        className="full-width">
        <form className="form-grid" onSubmit={(event) => {
          event.preventDefault();
          administration.prepareReassignment(tagId, targetId);
        }}>
          <label>NFC-Tag
            <select required value={tagId}
              disabled={state.reassigning || state.reassignmentIntent !== null}
              onChange={(event) => setTagId(event.target.value)}>
              <option value="">Tag auswählen</option>
              {state.projection.nfcTags.filter((tag) => tag.assignmentState === 'assigned')
                .map((tag) => <option key={tag.id} value={tag.id}>
                  {tag.displayName} · {tag.validationFingerprint}
                </option>)}
            </select>
          </label>
          <label>Neuer aktiver Kunde
            <select required value={targetId}
              disabled={state.reassigning || state.reassignmentIntent !== null}
              onChange={(event) => setTargetId(event.target.value)}>
              <option value="">Ziel auswählen</option>
              {state.projection.customers.filter((customer) => customer.active)
                .map((customer) => <option key={customer.id} value={customer.id}
                  disabled={customer.id === selectedTag?.targetCustomerId}>
                  {customer.displayName}
                </option>)}
            </select>
          </label>
          <button ref={prepareButton} disabled={
            state.reassigning
            || state.reassignmentIntent !== null
            || selectedTag?.assignmentState !== 'assigned'
            || targetId.length === 0
            || selectedTag.targetCustomerId === targetId
          }>Zuordnung prüfen</button>
        </form>
        {state.reassignmentIntent !== null && intentTag !== null && intentTarget !== null
          ? <Confirmation
              label="Zuordnung ausdrücklich bestätigen"
              title="Zuordnung wirklich ändern?"
              confirmLabel="Änderung ausdrücklich bestätigen"
              busyLabel="Wird sicher geändert …"
              busy={state.reassigning}
              onConfirm={() => void administration.confirmReassignment()}
              onCancel={() => {
                administration.cancelReassignment();
                returnFocus(prepareButton);
              }}
            >
              <dl>
                <dt>Tag</dt><dd>{intentTag.displayName} · {intentTag.validationFingerprint}</dd>
                <dt>Vorher</dt><dd>{customerNameById.get(intentTag.targetCustomerId!) ?? 'Bisheriger Kunde'}</dd>
                <dt>Nachher</dt><dd>{intentTarget.displayName}</dd>
              </dl>
            </Confirmation>
          : null}
      </Panel>
    </div>
    {state.projection.nextCursor === null ? null
      : <button className="secondary load-more" onClick={() => void administration.loadMore()}>
          Weitere Einrichtungsdaten laden
        </button>}
  </SectionBoundary>;
}

function EmployeesView({
  state,
  administration,
  timezone,
}: {
  readonly state: ReadyState;
  readonly administration: AdminWebCapability;
  readonly timezone: TimeZoneContext;
}) {
  const [name, setName] = useState('');
  return <SectionBoundary state={state.sections.employees}
    onRetry={() => void administration.retrySection('employees')}>
    <Panel title="Beschäftigte" description="Aktive Beschäftigte und einmalige Einladungen.">
      <CountTruth count={state.employeeProjection.employeeMemberships.length}
        noun="Beschäftigte" complete={state.employeeProjection.nextCursor === null} />
      <form className="inline-form" onSubmit={(event) => {
        event.preventDefault();
        void administration.createEmployeeInvitation(name);
        setName('');
      }}>
        <label htmlFor="employee-name">Einladung für</label>
        <div className="input-action">
          <input id="employee-name" required maxLength={120} value={name}
            onChange={(event) => setName(event.target.value)} />
          <button disabled={state.creatingEmployee}>
            {state.creatingEmployee ? 'Wird erzeugt …' : 'Einladung erzeugen'}
          </button>
        </div>
      </form>
      {state.invitation === null ? null : <aside className="invitation" role="status">
        <strong>Nur jetzt sicher übergeben</strong>
        <code>{state.invitation.value}</code>
        <small>Gültig bis {formatZonedDateTime(state.invitation.expiresAt, timezone)}</small>
        <button className="secondary" onClick={() => administration.dismissInvitation()}>
          Geheimnis verwerfen
        </button>
      </aside>}
      <ul className="entity-list">{state.employeeProjection.employeeMemberships.map((membership) =>
        <li key={membership.id}><span>{membership.displayName}</span>
          <small className="pill success">Beschäftigt · Aktiv</small></li>)}</ul>
      {state.employeeProjection.employeeMemberships.length === 0
        && state.employeeProjection.nextCursor === null
        ? <p className="empty">Keine Beschäftigten vorhanden.</p> : null}
      {state.employeeProjection.nextCursor === null ? null
        : <button className="secondary load-more"
            onClick={() => void administration.loadMoreEmployees()}>
            Weitere Beschäftigte laden
          </button>}
    </Panel>
  </SectionBoundary>;
}

function TimeRecordsView({
  state,
  administration,
  timezone,
}: {
  readonly state: ReadyState;
  readonly administration: AdminWebCapability;
  readonly timezone: TimeZoneContext;
}) {
  const [recordId, setRecordId] = useState('');
  const [startedAt, setStartedAt] = useState('');
  const [stoppedAt, setStoppedAt] = useState('');
  const [reason, setReason] = useState('');
  const [timeError, setTimeError] = useState<string | null>(null);
  const prepareButton = useRef<HTMLButtonElement>(null);
  const previousTimeZone = useRef(timezone.timeZone);
  useIntentFocusReturn(state.correctionIntent !== null, prepareButton);
  useEffect(() => {
    if (previousTimeZone.current === timezone.timeZone) return;
    previousTimeZone.current = timezone.timeZone;
    setRecordId('');
    setStartedAt('');
    setStoppedAt('');
    setReason('');
    setTimeError(null);
  }, [timezone.timeZone]);
  const format = (value: string) => formatZonedDateTime(value, timezone);
  const formatExact = (value: string) => formatExactZonedDateTime(value, timezone);
  return <SectionBoundary state={state.sections.timeRecords}
    onRetry={() => void administration.retrySection('timeRecords')}>
    <Panel title="Arbeitszeiten"
      description={`Fest begrenzt: ${format(state.timeWindow.fromInclusive)} bis ${format(state.timeWindow.toExclusive)}.`}>
      <div className="toolbar">
        <CountTruth count={state.timeRecords.length} noun="Arbeitszeiten"
          complete={state.timeRecordsNextCursor === null} />
        <button className="secondary" disabled={state.timeReviewBusy}
          onClick={() => void administration.exportTimeRecords()}>CSV exportieren</button>
      </div>
      <div className="table-scroll" tabIndex={0} aria-label="Geladene Arbeitszeiten">
        <table>
          <thead><tr><th>Beschäftigt</th><th>Kunde</th><th>Zeitraum</th><th>Quelle</th><th>Revision</th><th>Status</th></tr></thead>
          <tbody>{state.timeRecords.map((record) => <tr key={record.timeRecordId}>
            <td>{record.employeeDisplayName}</td><td>{record.customerDisplayName}</td>
            <td>{format(record.startedAt)} – {record.stoppedAt === null ? 'läuft' : format(record.stoppedAt)}</td>
            <td>{record.source === 'canonical' ? 'Kanonisch' : 'Wiederhergestellt'}</td>
            <td>{record.effectiveRevisionNumber}</td>
            <td>{record.status === 'started' ? 'Gestartet' : 'Gestoppt'}
              {record.overlapsAnotherRecord ? ' · Überschneidung' : ''}</td>
          </tr>)}</tbody>
        </table>
      </div>
      {state.timeRecords.length === 0 && state.timeRecordsNextCursor === null
        ? <p className="empty">Keine Arbeitszeiten im begrenzten Zeitraum.</p> : null}
      {state.timeRecordsNextCursor === null ? null
        : <button className="secondary load-more"
            onClick={() => void administration.loadMoreTimeRecords()}>
            Weitere Arbeitszeiten laden
          </button>}
    </Panel>
    <Panel title="Abgeschlossene Arbeitszeit korrigieren"
      description={`Eingaben werden in ${timezone.timeZone} interpretiert; Speicherung bleibt UTC.`}>
      <form className="form-grid" onSubmit={(event) => {
        event.preventDefault();
        const canonicalStart = parseZonedLocalTimestamp(startedAt, timezone.timeZone);
        const canonicalStop = parseZonedLocalTimestamp(stoppedAt, timezone.timeZone);
        if (canonicalStart === null || canonicalStop === null) {
          setTimeError('Der lokale Zeitpunkt ist ungültig, nicht vorhanden oder durch Zeitumstellung mehrdeutig.');
          return;
        }
        setTimeError(null);
        administration.prepareCorrection(recordId, canonicalStart, canonicalStop, reason);
      }}>
        <label>Arbeitszeit
          <select required value={recordId}
            disabled={state.timeReviewBusy || state.correctionIntent !== null}
            onChange={(event) => {
              const id = event.target.value;
              const selected = state.timeRecords.find((record) => record.timeRecordId === id);
              setRecordId(id);
              setStartedAt(selected === undefined ? '' : toZonedLocalInput(selected.startedAt, timezone.timeZone));
              setStoppedAt(selected?.stoppedAt == null ? '' : toZonedLocalInput(selected.stoppedAt, timezone.timeZone));
            }}>
            <option value="">Arbeitszeit auswählen</option>
            {state.timeRecords.filter((record) => record.status === 'stopped').map((record) =>
              <option key={record.timeRecordId} value={record.timeRecordId}>
                {record.employeeDisplayName} · {record.customerDisplayName} · {format(record.startedAt)}
              </option>)}
          </select>
        </label>
        <label>Neuer Beginn
          <input required type="datetime-local" step="0.001" value={startedAt}
            aria-describedby={timeError === null ? undefined : 'correction-time-error'}
            disabled={state.timeReviewBusy || state.correctionIntent !== null}
            onChange={(event) => setStartedAt(event.target.value)} />
        </label>
        <label>Neues Ende
          <input required type="datetime-local" step="0.001" value={stoppedAt}
            aria-describedby={timeError === null ? undefined : 'correction-time-error'}
            disabled={state.timeReviewBusy || state.correctionIntent !== null}
            onChange={(event) => setStoppedAt(event.target.value)} />
        </label>
        <label className="full-field">Begründung
          <textarea required maxLength={500} value={reason}
            disabled={state.timeReviewBusy || state.correctionIntent !== null}
            onChange={(event) => setReason(event.target.value)} />
        </label>
        {timeError === null ? null : <p id="correction-time-error" className="field-error" role="alert">{timeError}</p>}
        <button ref={prepareButton} disabled={state.timeReviewBusy || state.correctionIntent !== null}>
          Korrektur prüfen
        </button>
      </form>
      {state.correctionIntent === null ? null : <Confirmation
        label="Korrektur ausdrücklich bestätigen"
        title="Korrektur wirklich append-only protokollieren?"
        confirmLabel="Korrektur ausdrücklich bestätigen"
        busyLabel="Wird protokolliert …"
        busy={state.timeReviewBusy}
        onConfirm={() => void administration.confirmCorrection()}
        onCancel={() => {
          administration.cancelCorrection();
          returnFocus(prepareButton);
        }}
      >
        <dl>
          <dt>Vorher</dt><dd>{formatExact(state.correctionIntent.timeRecord.startedAt)} – {formatExact(state.correctionIntent.timeRecord.stoppedAt!)}</dd>
          <dt>Nachher</dt><dd>{formatExact(state.correctionIntent.startedAt)} – {formatExact(state.correctionIntent.stoppedAt)}</dd>
          <dt>Begründung</dt><dd className="verbatim-reason">{state.correctionIntent.reason}</dd>
        </dl>
      </Confirmation>}
    </Panel>
  </SectionBoundary>;
}

function ReviewsView({
  state,
  administration,
  timezone,
}: {
  readonly state: ReadyState;
  readonly administration: AdminWebCapability;
  readonly timezone: TimeZoneContext;
}) {
  const [itemId, setItemId] = useState('');
  const [resolution, setResolution] = useState<'no_time_record_change' | 'adjust_existing_time_record' | 'create_recovered_time_record'>('no_time_record_change');
  const [recordId, setRecordId] = useState('');
  const [startedAt, setStartedAt] = useState('');
  const [stoppedAt, setStoppedAt] = useState('');
  const [reason, setReason] = useState('');
  const [timeError, setTimeError] = useState<string | null>(null);
  const prepareButton = useRef<HTMLButtonElement>(null);
  const previousTimeZone = useRef(timezone.timeZone);
  useIntentFocusReturn(state.adjudicationIntent !== null, prepareButton);
  useEffect(() => {
    if (previousTimeZone.current === timezone.timeZone) return;
    previousTimeZone.current = timezone.timeZone;
    setItemId('');
    setResolution('no_time_record_change');
    setRecordId('');
    setStartedAt('');
    setStoppedAt('');
    setReason('');
    setTimeError(null);
  }, [timezone.timeZone]);
  const format = (value: string) => formatZonedDateTime(value, timezone);
  const formatExact = (value: string) => formatExactZonedDateTime(value, timezone);
  const selectedItem = state.reviewItems.find((item) => item.reviewItemId === itemId);
  return <SectionBoundary state={state.sections.reviewItems}
    onRetry={() => void administration.retrySection('reviewItems')}>
    <Panel title="Offene Prüfungen" description="Server-Reihenfolge bleibt unverändert.">
      <CountTruth count={state.reviewItems.length} noun="Prüfungen"
        complete={state.reviewItemsNextCursor === null} />
      <ul className="review-list">{state.reviewItems.map((item) =>
        <ReviewItem key={item.reviewItemId} item={item} format={format} />)}</ul>
      {state.reviewItems.length === 0 && state.reviewItemsNextCursor === null
        ? <p className="empty">Keine offene Review-Evidence.</p> : null}
      {state.reviewItemsNextCursor === null ? null
        : <button className="secondary load-more"
            onClick={() => void administration.loadMoreReviewItems()}>
            Weitere Prüfungen laden
          </button>}
    </Panel>
    <Panel title="Review-Evidence entscheiden"
      description={`Lokale Zeiteingaben verwenden ${timezone.timeZone}; die API bleibt UTC.`}>
      <form className="form-grid" onSubmit={(event) => {
        event.preventDefault();
        let canonicalStart: string | null = null;
        let canonicalStop: string | null = null;
        if (resolution !== 'no_time_record_change') {
          canonicalStart = parseZonedLocalTimestamp(startedAt, timezone.timeZone);
          canonicalStop = parseZonedLocalTimestamp(stoppedAt, timezone.timeZone);
          if (canonicalStart === null || canonicalStop === null) {
            setTimeError('Der lokale Zeitpunkt ist ungültig, nicht vorhanden oder durch Zeitumstellung mehrdeutig.');
            return;
          }
        }
        setTimeError(null);
        administration.prepareAdjudication(
          itemId,
          resolution,
          resolution === 'adjust_existing_time_record' ? recordId : null,
          canonicalStart,
          canonicalStop,
          reason,
        );
      }}>
        <label>Review-Evidence
          <select required value={itemId}
            disabled={state.timeReviewBusy || state.adjudicationIntent !== null}
            onChange={(event) => setItemId(event.target.value)}>
            <option value="">Evidence auswählen</option>
            {state.reviewItems.map((item) => <option key={item.reviewItemId} value={item.reviewItemId}>
              {item.employeeDisplayName} · {item.customerDisplayName} · {format(item.occurredAt)}
            </option>)}
          </select>
        </label>
        <label>Entscheidung
          <select value={resolution}
            disabled={state.timeReviewBusy || state.adjudicationIntent !== null}
            onChange={(event) => setResolution(event.target.value as typeof resolution)}>
            <option value="no_time_record_change">Keine Arbeitszeit ändern</option>
            <option value="create_recovered_time_record">Arbeitszeit wiederherstellen</option>
            <option value="adjust_existing_time_record">Bestehende Arbeitszeit korrigieren</option>
          </select>
        </label>
        {resolution === 'adjust_existing_time_record' ? <label>Bestehende Arbeitszeit
          <select required value={recordId}
            disabled={state.timeReviewBusy || state.adjudicationIntent !== null}
            onChange={(event) => {
              const id = event.target.value;
              const selected = state.timeRecords.find((record) => record.timeRecordId === id);
              setRecordId(id);
              setStartedAt(selected === undefined ? '' : toZonedLocalInput(selected.startedAt, timezone.timeZone));
              setStoppedAt(selected?.stoppedAt == null ? '' : toZonedLocalInput(selected.stoppedAt, timezone.timeZone));
            }}>
            <option value="">Arbeitszeit auswählen</option>
            {state.timeRecords.filter((record) => record.status === 'stopped').map((record) =>
              <option key={record.timeRecordId} value={record.timeRecordId}>
                {record.employeeDisplayName} · {format(record.startedAt)}
              </option>)}
          </select>
        </label> : null}
        {resolution === 'no_time_record_change' ? null : <>
          <label>Beginn
            <input required type="datetime-local" step="0.001" value={startedAt}
              aria-describedby={timeError === null ? undefined : 'review-time-error'}
              disabled={state.timeReviewBusy || state.adjudicationIntent !== null}
              onChange={(event) => setStartedAt(event.target.value)} />
          </label>
          <label>Ende
            <input required type="datetime-local" step="0.001" value={stoppedAt}
              aria-describedby={timeError === null ? undefined : 'review-time-error'}
              disabled={state.timeReviewBusy || state.adjudicationIntent !== null}
              onChange={(event) => setStoppedAt(event.target.value)} />
          </label>
        </>}
        <label className="full-field">Begründung
          <textarea required maxLength={500} value={reason}
            disabled={state.timeReviewBusy || state.adjudicationIntent !== null}
            onChange={(event) => setReason(event.target.value)} />
        </label>
        {timeError === null ? null : <p id="review-time-error" className="field-error" role="alert">{timeError}</p>}
        <button ref={prepareButton} disabled={state.timeReviewBusy || state.adjudicationIntent !== null}>
          Review-Entscheidung prüfen
        </button>
      </form>
      {state.adjudicationIntent === null ? null : <Confirmation
        label="Review-Entscheidung ausdrücklich bestätigen"
        title="Review-Entscheidung wirklich append-only protokollieren?"
        confirmLabel="Review ausdrücklich bestätigen"
        busyLabel="Wird protokolliert …"
        busy={state.timeReviewBusy}
        onConfirm={() => void administration.confirmAdjudication()}
        onCancel={() => {
          administration.cancelAdjudication();
          returnFocus(prepareButton);
        }}
      >
        <dl>
          <dt>Evidence</dt><dd>{selectedItem?.employeeDisplayName ?? state.adjudicationIntent.reviewItem.employeeDisplayName} · {format(state.adjudicationIntent.reviewItem.occurredAt)}</dd>
          <dt>Entscheidung</dt><dd>{resolutionLabel(state.adjudicationIntent.resolution)}</dd>
          {state.adjudicationIntent.timeRecord === null ? null : <>
            <dt>Vorher</dt><dd>{formatExact(state.adjudicationIntent.timeRecord.startedAt)} – {formatExact(state.adjudicationIntent.timeRecord.stoppedAt!)}</dd>
          </>}
          {state.adjudicationIntent.startedAt === null ? null : <>
            <dt>Nachher</dt><dd>{formatExact(state.adjudicationIntent.startedAt)} – {formatExact(state.adjudicationIntent.stoppedAt!)}</dd>
          </>}
          <dt>Begründung</dt><dd className="verbatim-reason">{state.adjudicationIntent.reason}</dd>
        </dl>
      </Confirmation>}
    </Panel>
  </SectionBoundary>;
}

function ReviewItem({
  item,
  format,
}: {
  readonly item: SafeReviewItem;
  readonly format: (value: string) => string;
}) {
  return <li>
    <div>
      <strong>{item.employeeDisplayName} · {item.customerDisplayName}</strong>
      <small>{format(item.occurredAt)} · {item.source === 'offline_v2' ? 'Offline V2' : 'Server Legacy'}</small>
    </div>
    <span>{reviewReasonLabel(item.reviewReason)}
      {item.predecessorBlocked ? ' · Vorgänger blockiert' : ''}</span>
  </li>;
}

function Brand() {
  return <div className="brand" aria-label="TapTim.e">
    <span className="brand-mark" aria-hidden="true">T</span>
    <span><strong>TapTim.e</strong><small>ZEIT. EINFACH. KLAR.</small></span>
  </div>;
}

function currentView(): AdminView {
  return typeof window === 'undefined' ? 'uebersicht' : viewFromHash(window.location.hash);
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

function returnFocus(reference: RefObject<HTMLElement | null>): void {
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() => reference.current?.focus());
  } else {
    reference.current?.focus();
  }
}

function useIntentFocusReturn(
  intentPresent: boolean,
  trigger: RefObject<HTMLButtonElement | null>,
): void {
  const previousIntent = useRef(intentPresent);
  const pendingReturn = useRef(false);
  if (previousIntent.current && !intentPresent) pendingReturn.current = true;
  previousIntent.current = intentPresent;
  useEffect(() => {
    if (!pendingReturn.current || trigger.current === null || trigger.current.disabled) return;
    trigger.current.focus();
    pendingReturn.current = false;
  });
}

function useCentralTimeZone(
  administration: AdminWebCapability,
  resolveTimeZone: () => TimeZoneContext,
): TimeZoneContext {
  const [context, setContext] = useState(resolveTimeZone);
  useEffect(() => {
    const synchronize = () => {
      const next = resolveTimeZone();
      if (
        next.timeZone === context.timeZone
        && next.usedUtcFallback === context.usedUtcFallback
      ) return;
      administration.invalidateTimeBoundIntents();
      setContext(next);
    };
    window.addEventListener('focus', synchronize);
    document.addEventListener('visibilitychange', synchronize);
    return () => {
      window.removeEventListener('focus', synchronize);
      document.removeEventListener('visibilitychange', synchronize);
    };
  }, [administration, context, resolveTimeZone]);
  return context;
}
