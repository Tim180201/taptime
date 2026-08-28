import {
  FormEvent,
  type MouseEvent as ReactMouseEvent,
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
  canonicalRoutePath,
  defaultRoute,
  monthLabel,
  monthTimeWindow,
  routeFromLocation,
  visibleAdminViews,
  type AdminRoute,
  type AdminView,
} from './navigation';
import {
  formatExactZonedDateTime,
  formatZonedDateTime,
  parseZonedLocalTimestamp,
  resolveBrowserTimeZone,
  type TimeZoneContext,
  toZonedLocalInput,
} from './timeZone';
import { Confirmation, CountTruth, DelayedSkeleton, Panel, SectionBoundary } from './ui';
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/latin-700.css';
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
  const [route, setRoute] = useState<AdminRoute>(() => currentRoute());
  const previousView = useRef(route.view);
  const appliedMonth = useRef<string | null>(null);
  const mainHeading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const synchronize = () => {
      const next = currentRoute();
      const canonical = canonicalRoutePath(next);
      if (`${window.location.pathname}${window.location.search}` !== canonical) {
        window.history.replaceState(null, '', canonical);
      }
      setRoute(next);
    };
    synchronize();
    window.addEventListener('popstate', synchronize);
    return () => window.removeEventListener('popstate', synchronize);
  }, []);

  useEffect(() => {
    if (
      previousView.current === 'beschaeftigte'
      && route.view !== 'beschaeftigte'
      && state.status === 'ready'
    ) administration.dismissInvitation();
    previousView.current = route.view;
    mainHeading.current?.focus();
  }, [administration, route.view]);

  useEffect(() => {
    if (state.status !== 'ready') return;
    if (route.month !== null && appliedMonth.current !== route.month) {
      const window = monthTimeWindow(route.month);
      if (window !== null) {
        appliedMonth.current = route.month;
        void administration.setTimeWindow(window.fromInclusive, window.toExclusive);
      }
    } else if (route.month === null && appliedMonth.current !== null) {
      appliedMonth.current = null;
      const window = recentTimeWindow();
      void administration.setTimeWindow(window.fromInclusive, window.toExclusive, false);
    }
  }, [administration, route.month, state.status]);

  useEffect(() => {
    void administration.selectLocation(route.locationId);
  }, [administration, route.locationId]);

  useEffect(() => {
    if (state.status !== 'ready') return;
    const visibleViews = visibleAdminViews(state.availableSections);
    const view = visibleViews.some((candidate) => candidate.slug === route.view)
      ? route.view : 'uebersicht';
    const locationId = state.locationsEnabled && state.managementScope.kind === 'locations'
      ? state.selectedLocation?.id ?? null
      : null;
    const canonicalRoute = view === route.view
      ? { ...route, locationId }
      : defaultRoute(view, locationId);
    const canonical = canonicalRoutePath(canonicalRoute);
    if (`${window.location.pathname}${window.location.search}` === canonical) return;
    window.history.replaceState(null, '', canonical);
    setRoute(canonicalRoute);
  }, [route, state]);

  const navigate = (next: AdminRoute) => {
    window.history.pushState(null, '', canonicalRoutePath(next));
    setRoute(next);
  };

  if (state.status === 'password_recovery') {
    return <PasswordRecovery administration={administration} completing={state.completing}
      notice={state.notice} />;
  }
  if (state.status === 'signed_out' || state.status === 'signing_in') {
    return <main className="login-shell">
      <section className="login-card" aria-labelledby="login-title">
        <Brand />
        <h1 id="login-title">Einfach sauber eingerichtet.</h1>
        <p>Melden Sie sich mit Ihrem Zugang zur Verwaltung an.</p>
        {state.status === 'signed_out' && state.notice
          ? <FeedbackBand message={state.notice} /> : null}
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
          <button disabled={state.status === 'signing_in'} aria-busy={state.status === 'signing_in'}>
            {state.status === 'signing_in' ? 'Wird geprüft …' : 'Sicher anmelden'}
          </button>
        </form>
        <button className="text-button" disabled={state.status === 'signing_in' || email.length < 3}
          aria-busy={state.status === 'signing_in'}
          onClick={() => void administration.requestPasswordReset(email)}>
          Passwort vergessen
        </button>
      </section>
    </main>;
  }
  if (state.status === 'loading') {
    return <main className="center loading-screen" aria-busy="true">
      <DelayedSkeleton label="Verwaltung wird geladen" rows={5} />
    </main>;
  }
  if (state.status === 'forbidden' || state.status === 'unavailable') {
    return <main className="center">
      <Brand />
      <h1>{state.status === 'forbidden' ? 'Zugang nicht möglich' : 'Verwaltung nicht erreichbar'}</h1>
      <p role="alert">{state.message}</p>
      <button onClick={() => void administration.signOut()}>Erneut anmelden</button>
    </main>;
  }

  const visibleViews = visibleAdminViews(state.availableSections);
  const activeRoute = visibleViews.some((candidate) => candidate.slug === route.view)
    ? route : defaultRoute('uebersicht', state.selectedLocation?.id ?? null);
  const activeView = visibleViews.find((candidate) => candidate.slug === activeRoute.view)!;
  const overviewDate = new Date();
  return <div className="app-shell">
    <aside className="sidebar">
      <Brand />
      <nav aria-label="Hauptnavigation">
        <ul>{visibleViews.map((item) => <li key={item.slug}>
          <a
            href={canonicalRoutePath(defaultRoute(item.slug, state.selectedLocation?.id ?? null))}
            aria-current={item.slug === activeRoute.view ? 'page' : undefined}
            onClick={(event) => navigateFromLink(
              event,
              defaultRoute(item.slug, state.selectedLocation?.id ?? null),
              navigate,
            )}
          >
            <SectionIcon view={item.slug} />
            <span>{item.label}</span>
          </a>
        </li>)}</ul>
      </nav>
      <div className="sidebar-footer">
        <span>Angemeldet für</span>
        <strong>{state.projection.organization.name}</strong>
      </div>
    </aside>
    <main className="workspace">
      <header className="workspace-header">
        <div className="workspace-title">
          <p className="eyebrow">{state.projection.organization.name}</p>
          <h1 ref={mainHeading} tabIndex={-1}>{activeView.label}</h1>
          {activeRoute.view === 'uebersicht'
            ? <p className="overview-greeting">
                <span>Guten Tag.</span>
                <time dateTime={localDateValue(overviewDate)}>
                  {overviewDateLabel(overviewDate)}
                </time>
              </p>
            : null}
        </div>
        {state.locationsEnabled && state.managementScope.kind === 'locations'
          && state.selectedLocation !== null
          ? <div className="location-context">
              <label htmlFor="management-location">Standort</label>
              {state.managementScope.locations.length > 1
                ? <select id="management-location" value={state.selectedLocation.id}
                    onChange={(event) => navigate({
                      ...activeRoute,
                      locationId: event.target.value,
                    })}>
                    {state.managementScope.locations.map((location) =>
                      <option key={location.id} value={location.id}>{location.name}</option>)}
                  </select>
                : <strong>{state.selectedLocation.name}</strong>}
            </div>
          : null}
        <div className="header-actions">
          <button className="header-primary" onClick={() => void administration.refresh()}>
            Alle Bereiche aktualisieren
          </button>
          <button className="quiet" onClick={() => void administration.signOut()}>Abmelden</button>
        </div>
      </header>
      <p className="timezone-declaration">
        Zeitdarstellung: {timezone.timeZone}
        {timezone.usedUtcFallback ? ' (sichere Ersatzdarstellung in UTC)' : ''}
      </p>
      {state.notice ? <FeedbackBand message={state.notice} /> : null}
      {activeRoute.view === 'uebersicht'
        ? <Overview state={state} administration={administration} navigate={navigate} /> : null}
      {activeRoute.view === 'einrichtung' ? <SetupView state={state} administration={administration} /> : null}
      {activeRoute.view === 'beschaeftigte' ? <EmployeesView state={state} administration={administration} timezone={timezone} /> : null}
      {activeRoute.view === 'arbeitszeiten'
        ? <TimeRecordsView state={state} administration={administration} timezone={timezone}
            route={activeRoute} navigate={navigate} /> : null}
      {activeRoute.view === 'pruefungen' ? <ReviewsView state={state} administration={administration} timezone={timezone} /> : null}
    </main>
  </div>;
}

function PasswordRecovery({
  administration,
  completing,
  notice,
}: {
  readonly administration: AdminWebCapability;
  readonly completing: boolean;
  readonly notice: string | null;
}) {
  const [password, setPassword] = useState('');
  return <main className="login-shell">
    <section className="login-card" aria-labelledby="recovery-title">
      <Brand />
      <h1 id="recovery-title">Neues Passwort setzen</h1>
      {notice ? <FeedbackBand message={notice} /> : null}
      <form onSubmit={(event) => {
        event.preventDefault();
        const snapshot = password;
        setPassword('');
        void administration.completePasswordRecovery(snapshot);
      }}>
        <label htmlFor="recovery-password">Neues Passwort</label>
        <input id="recovery-password" type="password" autoComplete="new-password"
          minLength={8} required value={password}
          onChange={(event) => setPassword(event.target.value)} />
        <button disabled={completing} aria-busy={completing}>
          {completing ? 'Wird geändert …' : 'Passwort ändern'}
        </button>
      </form>
    </section>
  </main>;
}

type ReadyState = Extract<ReturnType<AdminWebCapability['getState']>, { readonly status: 'ready' }>;

function Overview({
  state,
  administration,
  navigate,
}: {
  readonly state: ReadyState;
  readonly administration: AdminWebCapability;
  readonly navigate: (route: AdminRoute) => void;
}) {
  const projectRequestStarted = useRef(false);
  useEffect(() => {
    if (
      !state.availableSections.includes('setup')
      || projectRequestStarted.current
      || state.projects !== undefined
    ) return;
    projectRequestStarted.current = true;
    void administration.refreshProjects?.();
  }, [administration, state.projects]);
  const cards: readonly (readonly [AdminSection, string, number, boolean])[] = ([
    ['setup', 'Kunden geladen', state.projection.customers.length, state.projection.nextCursor === null],
    ['employees', state.selectedLocation === null
      ? 'Beschäftigte geladen'
      : `Beschäftigte am Standort ${state.selectedLocation.name}`,
    state.employeeProjection.employeeMemberships.length, state.employeeProjection.nextCursor === null],
    ['timeRecords', 'Arbeitszeiten geladen', state.timeRecords.length, state.timeRecordsNextCursor === null],
    ['reviewItems', 'Prüfungen geladen', state.reviewItems.length, state.reviewItemsNextCursor === null],
  ] as const).filter(([section]) => state.sections[section].status !== 'closed'
    && state.sections[section].status !== 'unavailable');
  const sectionUnavailable = Object.values(state.sections).some(
    (section) => section.status === 'unavailable',
  );
  const setupAvailable = state.availableSections.includes('setup');
  const projectsKnown = !setupAvailable || state.projects !== undefined;
  const newOperation = setupAvailable && projectsKnown
    && !sectionUnavailable
    && state.projection.customers.length === 0
    && state.projection.nfcTags.length === 0
    && (state.projects?.length ?? 0) === 0
    && state.timeRecords.length === 0
    && state.reviewItems.length === 0;
  if (!projectsKnown && state.projectBusy === true) {
    return <DelayedSkeleton label="Betriebsstand wird geladen" />;
  }
  if (newOperation) {
    return <section className="first-empty" aria-labelledby="first-empty-title">
      <div className="empty-illustration" aria-hidden="true">✓</div>
      <h2 id="first-empty-title">Ihr Betrieb ist bereit</h2>
      <p>Legen Sie jetzt das erste Arbeitsziel an. Danach können Sie einen NFC-Tag zuordnen
        und die erste Arbeitszeit erfassen.</p>
      <a className="button-link"
        href={canonicalRoutePath(defaultRoute('einrichtung', state.selectedLocation?.id ?? null))}
        onClick={(event) => navigateFromLink(
          event,
          defaultRoute('einrichtung', state.selectedLocation?.id ?? null),
          navigate,
        )}>
        Erstes Arbeitsziel anlegen
      </a>
    </section>;
  }
  return <section aria-label="Geladener Verwaltungsstand">
    <div className="metric-grid">{cards.map(([section, label, count, complete]) =>
      <article className="metric-card" key={section}>
        <strong>{count}</strong>
        <span>{label}</span>
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
    <Panel title="Betriebsstatus" description="Geladene Daten ohne unbestätigte Gesamtsummen.">
      <dl className="status-list">
        <dt>Betrieb</dt><dd>{state.projection.organization.name}</dd>
        {state.selectedLocation === null ? null : <>
          <dt>Standort</dt><dd>{state.selectedLocation.name}</dd>
        </>}
        {state.availableSections.includes('time_records') ? <>
          <dt>Zeitfenster</dt><dd>Fest begrenzt auf die vergangenen 31 Tage</dd>
        </> : null}
        <dt>Sitzung</dt><dd>Nur im Arbeitsspeicher · Neuladen meldet ab</dd>
        {state.availableSections.includes('time_export') ? <>
          <dt>CSV-Datei</dt><dd>Vollständige Fassung 3 für die Lohnbuchhaltung</dd>
        </> : null}
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
  const [projectName, setProjectName] = useState('');
  const [tagId, setTagId] = useState('');
  const [targetId, setTargetId] = useState('');
  const prepareButton = useRef<HTMLButtonElement>(null);
  const tagSelect = useRef<HTMLSelectElement>(null);
  const targetSelect = useRef<HTMLSelectElement>(null);
  const sectionRetryButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (state.completedAction === 'customer_created') setCustomerName('');
    if (state.completedAction === 'project_created') setProjectName('');
  }, [state.completedAction]);
  useEffect(() => {
    void administration.refreshProjects?.();
    void administration.refreshLocationSetup?.();
  }, [administration]);
  useIntentFocusReturn(
    state.reassignmentIntent !== null,
    prepareButton,
    tagSelect,
    targetSelect,
    sectionRetryButton,
  );
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
  return <SectionBoundary state={state.sections.setup} retryButtonRef={sectionRetryButton}
    onRetry={() => void administration.retrySection('setup')}>
    <div className="content-grid">
      {state.managementScope.kind === 'organization'
        ? <LocationSetupPanel state={state} administration={administration} />
        : null}
      <Panel title="Kunden" description="Aktive und inaktive Kunden der geladenen Seiten.">
        <CountTruth count={state.projection.customers.length} noun="Kunden"
          complete={state.projection.nextCursor === null} />
        <form className="inline-form" onSubmit={(event) => {
          event.preventDefault();
          void administration.createCustomer(customerName);
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
      <Panel title="NFC-Tags" description="Sichere Prüffingerabdrücke statt NFC-Rohdaten.">
        <CountTruth count={state.projection.nfcTags.length} noun="NFC-Tags"
          complete={state.projection.nextCursor === null} />
        <ul className="entity-list">{state.projection.nfcTags.map((tag) => <li key={tag.id}>
          <div><span>{tag.displayName}</span><small>Prüffingerabdruck {tag.validationFingerprint}</small></div>
          <small>{tag.targetCustomerId === null
            ? 'Nicht zugeordnet'
            : customerNameById.get(tag.targetCustomerId) ?? 'Zugeordnet'}</small>
        </li>)}</ul>
        {state.projection.nfcTags.length === 0 && state.projection.nextCursor === null
          ? <p className="empty">Keine NFC-Tags registriert.</p> : null}
      </Panel>
      <Panel title="Projekte" description="Eigenständige Arbeitsziele ohne Kundenbeziehung.">
        <CountTruth count={state.projects?.length ?? 0} noun="Projekte"
          complete={state.projectsNextCursor === null} />
        <form className="inline-form" onSubmit={(event) => {
          event.preventDefault();
          void administration.createProject?.(projectName);
        }}>
          <label htmlFor="project-name">Neues Projekt anlegen</label>
          <div className="input-action">
            <input id="project-name" required maxLength={120} value={projectName}
              onChange={(event) => setProjectName(event.target.value)} />
            <button disabled={state.projectBusy === true}>
              {state.projectBusy === true ? 'Wird verarbeitet …' : 'Projekt anlegen'}
            </button>
          </div>
        </form>
        <ul className="entity-list">{(state.projects ?? []).map((project) =>
          <li key={project.projectId}>
            <span>{project.displayName}</span>
            <div>
              <small className={`pill ${project.active ? 'success' : ''}`}>
                {project.active ? 'Aktiv' : 'Inaktiv'}
              </small>
              {project.active
                ? <button className="text-button" disabled={state.projectBusy === true}
                    aria-label={`${project.displayName} deaktivieren`}
                    onClick={() => void administration.deactivateProject?.(project.projectId)}>
                    Deaktivieren
                  </button>
                : null}
            </div>
          </li>)}</ul>
        {(state.projects?.length ?? 0) === 0 && state.projectBusy !== true
          ? <p className="empty">Keine Projekte vorhanden.</p>
          : null}
        {state.projectsNextCursor === null || state.projectsNextCursor === undefined
          ? null
          : <button className="secondary load-more"
              disabled={state.projectBusy === true}
              onClick={() => void administration.loadMoreProjects?.()}>
              Weitere Projekte laden
            </button>}
        <p className="supporting">
          Projektnamen bleiben unverändert. Laufende Arbeitszeit blockiert die Deaktivierung.
        </p>
      </Panel>
      <Panel title="Tag neu zuordnen" description="Eine laufende Arbeitszeit blockiert die Änderung."
        className="full-width">
        <form className="form-grid" onSubmit={(event) => {
          event.preventDefault();
          administration.prepareReassignment(tagId, targetId);
        }}>
          <label>NFC-Tag
            <select ref={tagSelect} required value={tagId}
              disabled={state.reassigning || state.reassignmentIntent !== null}
              onChange={(event) => setTagId(event.target.value)}>
              <option value="">NFC-Tag auswählen</option>
              {state.projection.nfcTags.filter((tag) => tag.assignmentState === 'assigned')
                .map((tag) => <option key={tag.id} value={tag.id}>
                  {tag.displayName} · {tag.validationFingerprint}
                </option>)}
            </select>
          </label>
          <label>Neuer aktiver Kunde
            <select ref={targetSelect} required value={targetId}
              disabled={state.reassigning || state.reassignmentIntent !== null}
              onChange={(event) => setTargetId(event.target.value)}>
              <option value="">Arbeitsziel auswählen</option>
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
                returnFocus(prepareButton, tagSelect, targetSelect);
              }}
            >
              <dl>
                <dt>NFC-Tag</dt><dd>{intentTag.displayName} · {intentTag.validationFingerprint}</dd>
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

function LocationSetupPanel({
  state,
  administration,
}: {
  readonly state: ReadyState;
  readonly administration: AdminWebCapability;
}) {
  const [locationName, setLocationName] = useState('');
  const setup = state.locationSetup;
  const activeLocations = setup?.locations.filter((location) => location.active) ?? [];
  const gapLabels = {
    membership: 'Zugehörigkeit', customer: 'Kunde', project: 'Projekt',
    work_target: 'Arbeitsziel', nfc_assignment: 'NFC-Zuordnung',
  } as const;
  if (setup === null) {
    return <Panel title="Standorte" description="Standorte und Bindungen werden vollständig geladen."
      className="full-width">
      {state.locationSetupBusy
        ? <DelayedSkeleton label="Standort-Einrichtung wird geladen" />
        : <button className="secondary" onClick={() => void administration.refreshLocationSetup?.()}>
            Standort-Einrichtung laden
          </button>}
    </Panel>;
  }
  return <Panel title="Standorte"
    description="Standorte vorbereiten, Menschen und Arbeitsziele binden und danach atomar einschalten."
    className="full-width">
    <form className="inline-form" onSubmit={(event) => {
      event.preventDefault();
      void administration.createLocation?.(locationName).then(() => setLocationName(''));
    }}>
      <label htmlFor="location-name">Neuen Standort anlegen</label>
      <div className="input-action">
        <input id="location-name" required maxLength={120} value={locationName}
          onChange={(event) => setLocationName(event.target.value)} />
        <button disabled={state.locationSetupBusy}>Standort anlegen</button>
      </div>
    </form>
    <ul className="entity-list">{setup.locations.map((location) => <li key={location.id}>
      <form className="input-action" onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        void administration.renameLocation?.(
          location.id, location.rowVersion, String(form.get('displayName') ?? ''),
        );
      }}>
        <input name="displayName" aria-label={`${location.displayName} umbenennen`}
          defaultValue={location.displayName} disabled={!location.active || state.locationSetupBusy}
          maxLength={120} required />
        {location.active ? <button className="secondary" disabled={state.locationSetupBusy}>
          Namen speichern
        </button> : <small className="pill">Stillgelegt · historisch sichtbar</small>}
      </form>
      {location.active ? <button className="quiet" disabled={state.locationSetupBusy}
        onClick={() => void administration.deactivateLocation?.(location.id, location.rowVersion)}>
        Stilllegen
      </button> : null}
    </li>)}</ul>
    {setup.locations.length === 0 ? <p className="empty">Noch kein Standort vorhanden.</p> : null}

    <h3>Menschen zuweisen</h3>
    <ul className="entity-list">{setup.memberships.map((membership) => <li key={membership.id}>
      <div><strong>{membership.displayName}</strong><small>{membership.role === 'administrator'
        ? 'Administrator' : membership.role === 'standortleitung' ? 'Standortleitung' : 'Beschäftigter'}</small></div>
      <label>Heimatstandort
        <select value={membership.homeLocationId ?? ''} disabled={state.locationSetupBusy}
          onChange={(event) => {
            if (event.target.value.length > 0) void administration.setHomeLocation?.(
              membership.id, event.target.value,
            );
          }}>
          <option value="">Noch nicht zugewiesen</option>
          {activeLocations.map((location) => <option key={location.id} value={location.id}>
            {location.displayName}
          </option>)}
        </select>
      </label>
      <fieldset><legend>Zusätzliche Arbeitszuweisungen</legend>
        {activeLocations.filter((location) => location.id !== membership.homeLocationId)
          .map((location) => <label key={location.id}>
            <input type="checkbox" checked={membership.workLocationIds.includes(location.id)}
              disabled={state.locationSetupBusy}
              onChange={(event) => void administration.setWorkLocation?.(
                membership.id, location.id, event.target.checked,
              )} /> {location.displayName}
          </label>)}
      </fieldset>
      {membership.role === 'standortleitung' ? <fieldset>
        <legend>Verwaltungszuweisungen</legend>
        {activeLocations.map((location) => <label key={location.id}>
          <input type="checkbox" checked={membership.managementLocationIds.includes(location.id)}
            disabled={state.locationSetupBusy}
            onChange={(event) => void administration.setManagementLocation?.(
              membership.id, location.id, event.target.checked,
            )} /> {location.displayName}
        </label>)}
      </fieldset> : null}
    </li>)}</ul>

    <h3>Arbeitsziele zuweisen</h3>
    <ul className="entity-list">{setup.workTargets.map((target) => <li
      key={`${target.targetType}:${target.targetId}`}>
      <span>{target.displayName}</span>
      <small>{target.targetType === 'customer' ? 'Kunde' : target.targetType === 'project'
        ? 'Projekt' : 'Allgemeines Arbeitsziel'}</small>
      <select aria-label={`Standort für ${target.displayName}`} value={target.locationId ?? ''}
        disabled={state.locationSetupBusy}
        onChange={(event) => {
          if (event.target.value.length > 0) void administration.setWorkTargetLocation?.(
            target.targetType, target.targetId, event.target.value,
          );
        }}>
        <option value="">Noch nicht zugewiesen</option>
        {activeLocations.map((location) => <option key={location.id} value={location.id}>
          {location.displayName}
        </option>)}
      </select>
    </li>)}</ul>

    <section className="activation-check" aria-labelledby="location-activation-title">
      <h3 id="location-activation-title">Vor dem Einschalten</h3>
      {setup.activationGaps.length === 0
        ? <p>Alle aktiven Zugehörigkeiten, Kunden, Projekte, Arbeitsziele und NFC-Zuordnungen
          sind eindeutig gebunden.</p>
        : <><p><strong>Diese Bindungen fehlen noch:</strong></p>
          <ul>{setup.activationGaps.map((gap) => <li key={`${gap.kind}:${gap.id}`}>
            <strong>{gapLabels[gap.kind]}:</strong> {gap.displayName}
          </li>)}</ul></>}
      <button disabled={state.locationSetupBusy || (!state.locationsEnabled
        && setup.activationGaps.length > 0)}
        onClick={() => void administration.setLocationsEnabled?.(!state.locationsEnabled)}>
        {state.locationsEnabled ? 'Standort-Funktion ausschalten' : 'Standort-Funktion einschalten'}
      </button>
    </section>
  </Panel>;
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
  const [role, setRole] = useState<'administrator' | 'standortleitung' | 'employee'>('employee');
  const [invitationLocationId, setInvitationLocationId] = useState(
    state.selectedLocation?.id ?? '',
  );
  const [revocationIntent, setRevocationIntent] = useState<{
    readonly id: string;
    readonly displayName: string;
    readonly rowVersion: number;
  } | null>(null);
  const [revoking, setRevoking] = useState(false);
  const revocationTrigger = useRef<HTMLButtonElement>(null);
  const employeeNameInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (state.completedAction === 'invitation_created') setName('');
  }, [state.completedAction]);
  useEffect(() => {
    if (!state.locationsEnabled) setInvitationLocationId('');
    else if (state.selectedLocation !== null) setInvitationLocationId(state.selectedLocation.id);
  }, [state.locationsEnabled, state.selectedLocation]);
  useIntentFocusReturn(revocationIntent !== null, revocationTrigger);
  return <SectionBoundary state={state.sections.employees}
    onRetry={() => void administration.retrySection('employees')}>
    <Panel title="Beschäftigte" description={state.selectedLocation === null
      ? 'Aktive Beschäftigte und einmalige Einladungen.'
      : `Aktive Beschäftigte und einmalige Einladungen am Standort ${state.selectedLocation.name}.`}>
      <CountTruth count={state.employeeProjection.employeeMemberships.length}
        noun={state.selectedLocation === null
          ? state.locationsEnabled ? 'Beschäftigte im Betrieb' : 'Beschäftigte'
          : `Beschäftigte am Standort ${state.selectedLocation.name}`}
        complete={state.employeeProjection.nextCursor === null} />
      <form className="inline-form" onSubmit={(event) => {
        event.preventDefault();
        void administration.createEmployeeInvitation(
          name,
          role,
          state.locationsEnabled ? invitationLocationId : undefined,
        );
      }}>
        <label htmlFor="employee-name">Einladung für</label>
        <div className="input-action">
          <input ref={employeeNameInput} id="employee-name" required maxLength={120} value={name}
            onChange={(event) => setName(event.target.value)} />
          {state.managementScope.kind === 'organization' ? <>
            <label htmlFor="employee-role">Rolle</label>
            <select id="employee-role" value={role}
              onChange={(event) => setRole(event.target.value as typeof role)}>
              <option value="employee">Beschäftigter</option>
              <option value="standortleitung">Standortleitung</option>
              <option value="administrator">Administrator</option>
            </select>
          </> : null}
          {state.locationsEnabled ? <label htmlFor="employee-location">Heimatstandort</label> : null}
          {state.locationsEnabled ? <select id="employee-location" required
            value={invitationLocationId}
            onChange={(event) => setInvitationLocationId(event.target.value)}>
            <option value="">Standort auswählen</option>
            {state.assignableLocations.map((location) => <option key={location.id}
              value={location.id}>{location.name}</option>)}
          </select> : null}
          <button disabled={state.creatingEmployee
            || (state.locationsEnabled && invitationLocationId.length === 0)}>
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
          <small className={`pill ${membership.active ? 'success' : ''}`}>
            {membership.role === 'administrator'
              ? 'Administrator'
              : membership.role === 'standortleitung' ? 'Standortleitung' : 'Beschäftigter'}
            {' · '}{membership.active ? 'Aktiv' : 'Zugang entzogen'}
          </small>
          {state.locationsEnabled && membership.location !== null
            ? <small>Standort {membership.location.name}</small> : null}
          {membership.active
            && (state.managementScope.kind === 'organization' || membership.role === 'employee')
            ? <div className="entity-actions">
            {state.managementScope.kind === 'organization'
              ? <label>Rolle
                  <select value={membership.role}
                    aria-label={`Rolle für ${membership.displayName}`}
                    onChange={(event) => void administration.changeMembershipRole(
                      membership.id,
                      membership.rowVersion,
                      event.target.value as 'administrator' | 'standortleitung' | 'employee',
                    )}>
                    <option value="employee">Beschäftigter</option>
                    <option value="standortleitung">Standortleitung</option>
                    <option value="administrator">Administrator</option>
                  </select>
                </label>
              : null}
            <button className="quiet" onClick={(event) => {
              revocationTrigger.current = event.currentTarget;
              setRevocationIntent({
                id: membership.id,
                displayName: membership.displayName,
                rowVersion: membership.rowVersion,
              });
            }}>Zugang entziehen</button>
          </div> : null}
        </li>)}</ul>
      {revocationIntent === null ? null : <Confirmation
        label="Zugangsentzug ausdrücklich bestätigen"
        title={`Zugang für ${revocationIntent.displayName} wirklich entziehen?`}
        confirmLabel="Zugang entziehen"
        busyLabel="Zugang wird entzogen …"
        busy={revoking}
        onConfirm={() => {
          setRevoking(true);
          void administration.revokeMembership(
            revocationIntent.id,
            revocationIntent.rowVersion,
          ).finally(() => {
            setRevoking(false);
            setRevocationIntent(null);
          });
        }}
        onCancel={() => setRevocationIntent(null)}
      >
        <p>Der Beschäftigte kann sich danach nicht mehr anmelden.</p>
      </Confirmation>}
      {state.employeeProjection.employeeMemberships.length === 0
        && state.employeeProjection.nextCursor === null
        ? state.selectedLocation === null
          ? <p className="empty">Keine Beschäftigten vorhanden.</p>
          : <div className="empty first-list-empty">
              <strong>Noch keine Beschäftigten am Standort {state.selectedLocation.name}</strong>
              <p>Laden Sie die erste beschäftigte Person für diesen Standort ein.</p>
              <button className="secondary" onClick={() => employeeNameInput.current?.focus()}>
                Beschäftigte Person einladen
              </button>
            </div>
        : null}
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
  route,
  navigate,
}: {
  readonly state: ReadyState;
  readonly administration: AdminWebCapability;
  readonly timezone: TimeZoneContext;
  readonly route: AdminRoute;
  readonly navigate: (route: AdminRoute) => void;
}) {
  const [recordId, setRecordId] = useState('');
  const [startedAt, setStartedAt] = useState('');
  const [stoppedAt, setStoppedAt] = useState('');
  const [reason, setReason] = useState('');
  const [timeError, setTimeError] = useState<string | null>(null);
  const [month, setMonth] = useState(route.month ?? '');
  const [statusFilter, setStatusFilter] = useState(route.status);
  const [captureType, setCaptureType] = useState(route.captureType);
  const prepareButton = useRef<HTMLButtonElement>(null);
  const recordSelect = useRef<HTMLSelectElement>(null);
  const sectionRetryButton = useRef<HTMLButtonElement>(null);
  const previousTimeZone = useRef(timezone.timeZone);
  useIntentFocusReturn(
    state.correctionIntent !== null,
    prepareButton,
    recordSelect,
    sectionRetryButton,
  );
  useEffect(() => {
    if (previousTimeZone.current === timezone.timeZone) return;
    previousTimeZone.current = timezone.timeZone;
    setRecordId('');
    setStartedAt('');
    setStoppedAt('');
    setReason('');
    setTimeError(null);
  }, [timezone.timeZone]);
  useEffect(() => {
    setMonth(route.month ?? '');
    setStatusFilter(route.status);
    setCaptureType(route.captureType);
  }, [route.captureType, route.month, route.status]);
  const format = (value: string) => formatZonedDateTime(value, timezone);
  const formatExact = (value: string) => formatExactZonedDateTime(value, timezone);
  if (!state.availableSections.includes('time_records')) {
    return <Panel title="Arbeitszeiten herunterladen"
      description="Die vollständige CSV-Datei steht für die Lohnbuchhaltung bereit.">
      <button className="secondary" disabled={state.timeReviewBusy}
        aria-busy={state.timeReviewBusy}
        onClick={() => void administration.exportTimeRecords()}>CSV herunterladen</button>
    </Panel>;
  }
  const visibleRecords = state.timeRecords.filter((record) => {
    const statusMatches = route.status === 'alle'
      || (route.status === 'laufend' && record.status === 'started')
      || (route.status === 'abgeschlossen' && record.status === 'stopped');
    const captureMatches = route.captureType === 'alle'
      || (route.captureType === 'gescannt'
        && (record.startedVia === 'nfc' || record.stoppedVia === 'nfc'))
      || (route.captureType === 'manuell-erfasst'
        && (record.startedVia === 'manual' || record.stoppedVia === 'manual'));
    return statusMatches && captureMatches;
  });
  const hasFilters = route.month !== null
    || route.status !== 'alle'
    || route.captureType !== 'alle';
  return <SectionBoundary state={state.sections.timeRecords} retryButtonRef={sectionRetryButton}
    onRetry={() => void administration.retrySection('timeRecords')}>
    <Panel title="Arbeitszeiten"
      description={`Zeitraum: ${format(state.timeWindow.fromInclusive)} bis ${format(state.timeWindow.toExclusive)}.`}>
      <form className="filter-form" onSubmit={(event) => {
        event.preventDefault();
        navigate({
          view: 'arbeitszeiten',
          locationId: route.locationId,
          month: month.length === 0 ? null : month,
          status: statusFilter,
          captureType,
        });
      }}>
        <label>Monat
          <input type="month" value={month} min="2000-01" max="2200-12"
            onChange={(event) => setMonth(event.target.value)} />
        </label>
        <label>Status
          <select value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}>
            <option value="alle">Alle</option>
            <option value="laufend">Laufend</option>
            <option value="abgeschlossen">Abgeschlossen</option>
          </select>
        </label>
        <label>Erfassungsart
          <select value={captureType}
            onChange={(event) => setCaptureType(event.target.value as typeof captureType)}>
            <option value="alle">Alle</option>
            <option value="gescannt">Gescannt</option>
            <option value="manuell-erfasst">Manuell erfasst</option>
          </select>
        </label>
        <button>Filter anwenden</button>
      </form>
      {hasFilters ? <div className="filter-summary" aria-label="Aktive Filter">
        <div className="filter-chips">
          {route.month === null ? null : <span className="filter-chip">
            Monat {monthLabel(route.month)} <strong>{visibleRecords.length}</strong>
          </span>}
          {route.status === 'alle' ? null : <span className="filter-chip">
            {route.status === 'laufend' ? 'Laufend' : 'Abgeschlossen'}
            {' '}<strong>{visibleRecords.length}</strong>
          </span>}
          {route.captureType === 'alle' ? null : <span className="filter-chip">
            {route.captureType === 'gescannt' ? 'Gescannt' : 'Manuell erfasst'}
            {' '}<strong>{visibleRecords.length}</strong>
          </span>}
        </div>
        <button className="text-button" onClick={() => navigate(
          defaultRoute('arbeitszeiten', route.locationId),
        )}>
          Alle zurücksetzen
        </button>
      </div> : null}
      <div className="toolbar">
        <CountTruth count={visibleRecords.length} noun="Arbeitszeiten"
          complete={state.timeRecordsNextCursor === null} />
        {state.availableSections.includes('time_export')
          ? <button className="secondary" disabled={state.timeReviewBusy}
              aria-busy={state.timeReviewBusy}
              onClick={() => void administration.exportTimeRecords()}>CSV herunterladen</button>
          : null}
      </div>
      <div className="table-scroll" tabIndex={0} aria-label="Geladene Arbeitszeiten">
        <table>
          <thead><tr><th>Beschäftigte</th><th>Arbeitsziel</th><th>Zeitraum</th><th>Erfassungsart</th><th>Herkunft</th><th>Korrekturstand</th><th>Status</th></tr></thead>
          <tbody>{visibleRecords.map((record) => <tr key={record.timeRecordId}>
            <td>{record.employeeDisplayName}</td><td>{targetLabel(record.targetType)} · {record.targetDisplayName}</td>
            <td>{format(record.startedAt)} – {record.stoppedAt === null ? 'läuft' : format(record.stoppedAt)}</td>
            <td>{captureLabel(record.startedVia, record.stoppedVia)}</td>
            <td>{record.source === 'canonical' ? 'Regulär' : 'Wiederhergestellt'}</td>
            <td>{record.effectiveRevisionNumber}</td>
            <td>{record.status === 'started' ? 'Läuft' : 'Abgeschlossen'}
              {record.overlapsAnotherRecord ? ' · Überschneidung' : ''}</td>
          </tr>)}</tbody>
        </table>
      </div>
      {visibleRecords.length === 0 && state.timeRecordsNextCursor === null && hasFilters
        ? <div className="empty filter-empty">
            <strong>Keine Arbeitszeiten in dieser Auswahl</strong>
            <p>Für den gewählten Zeitraum und die aktiven Filter wurden keine Arbeitszeiten gefunden.</p>
            <button className="secondary" onClick={() => navigate(
              defaultRoute('arbeitszeiten', route.locationId),
            )}>
              Filter zurücksetzen
            </button>
          </div>
        : null}
      {visibleRecords.length === 0 && state.timeRecordsNextCursor === null && !hasFilters
        ? <div className="empty first-list-empty">
            <strong>Noch keine Arbeitszeiten</strong>
            <p>Sobald Beschäftigte ein Arbeitsziel auslösen, erscheinen ihre Arbeitszeiten hier.</p>
            <a className="button-link secondary-link"
              href={canonicalRoutePath(defaultRoute('einrichtung', route.locationId))}
              onClick={(event) => navigateFromLink(
                event,
                defaultRoute('einrichtung', route.locationId),
                navigate,
              )}>
              Arbeitsziel einrichten
            </a>
          </div>
        : null}
      {state.timeRecordsNextCursor === null ? null
        : <button className="secondary load-more"
            onClick={() => void administration.loadMoreTimeRecords()}>
            Weitere Arbeitszeiten laden
          </button>}
    </Panel>
    <Panel title="Abgeschlossene Arbeitszeit korrigieren"
      description={`Eingaben werden in ${timezone.timeZone} gelesen; gespeichert wird in UTC.`}>
      <form className="form-grid" onSubmit={(event) => {
        event.preventDefault();
        const canonicalStart = parseZonedLocalTimestamp(startedAt, timezone.timeZone);
        const canonicalStop = parseZonedLocalTimestamp(stoppedAt, timezone.timeZone);
        if (canonicalStart === null || canonicalStop === null) {
          setTimeError('Die Zeitangaben können nicht verwendet werden. Mindestens ein lokaler Zeitpunkt existiert nicht oder ist wegen der Zeitumstellung mehrdeutig. Prüfen Sie Beginn und Ende; Ihre Eingaben bleiben erhalten.');
          return;
        }
        setTimeError(null);
        administration.prepareCorrection(recordId, canonicalStart, canonicalStop, reason);
      }}>
        <label>Arbeitszeit
          <select ref={recordSelect} required value={recordId}
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
                {record.employeeDisplayName} · {targetLabel(record.targetType)} · {record.targetDisplayName} · {format(record.startedAt)}
              </option>)}
          </select>
        </label>
        {timeError === null ? null : <p id="correction-time-error"
          className="field-error" role="alert">{timeError}</p>}
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
        <button ref={prepareButton} disabled={state.timeReviewBusy || state.correctionIntent !== null}>
          Korrektur prüfen
        </button>
      </form>
      {state.correctionIntent === null ? null : <Confirmation
        label="Korrektur ausdrücklich bestätigen"
        title="Korrektur lückenlos protokollieren?"
        confirmLabel="Korrektur ausdrücklich bestätigen"
        busyLabel="Wird protokolliert …"
        busy={state.timeReviewBusy}
        onConfirm={() => void administration.confirmCorrection()}
        onCancel={() => {
          administration.cancelCorrection();
          returnFocus(prepareButton, recordSelect);
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
  const itemSelect = useRef<HTMLSelectElement>(null);
  const sectionRetryButton = useRef<HTMLButtonElement>(null);
  const previousTimeZone = useRef(timezone.timeZone);
  useIntentFocusReturn(
    state.adjudicationIntent !== null,
    prepareButton,
    itemSelect,
    sectionRetryButton,
  );
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
    retryButtonRef={sectionRetryButton}
    onRetry={() => void administration.retrySection('reviewItems')}>
    <Panel title="Offene Prüfungen" description="Die Reihenfolge des Servers bleibt unverändert.">
      <CountTruth count={state.reviewItems.length} noun="Prüfungen"
        complete={state.reviewItemsNextCursor === null} />
      <ul className="review-list">{state.reviewItems.map((item) =>
        <ReviewItem key={item.reviewItemId} item={item} format={format} />)}</ul>
      {state.reviewItems.length === 0 && state.reviewItemsNextCursor === null
        ? <p className="empty">Keine offenen Prüfungen.</p> : null}
      {state.reviewItemsNextCursor === null ? null
        : <button className="secondary load-more"
            onClick={() => void administration.loadMoreReviewItems()}>
            Weitere Prüfungen laden
          </button>}
    </Panel>
    <Panel title="Prüffall entscheiden"
      description={`Lokale Zeiteingaben verwenden ${timezone.timeZone}; übertragen wird in UTC.`}>
      <form className="form-grid" onSubmit={(event) => {
        event.preventDefault();
        let canonicalStart: string | null = null;
        let canonicalStop: string | null = null;
        if (resolution !== 'no_time_record_change') {
          canonicalStart = parseZonedLocalTimestamp(startedAt, timezone.timeZone);
          canonicalStop = parseZonedLocalTimestamp(stoppedAt, timezone.timeZone);
          if (canonicalStart === null || canonicalStop === null) {
            setTimeError('Die Zeitangaben können nicht verwendet werden. Mindestens ein lokaler Zeitpunkt existiert nicht oder ist wegen der Zeitumstellung mehrdeutig. Prüfen Sie Beginn und Ende; Ihre Eingaben bleiben erhalten.');
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
        <label>Prüffall
          <select ref={itemSelect} required value={itemId}
            disabled={state.timeReviewBusy || state.adjudicationIntent !== null}
            onChange={(event) => setItemId(event.target.value)}>
            <option value="">Prüffall auswählen</option>
            {state.reviewItems.map((item) => <option key={item.reviewItemId} value={item.reviewItemId}>
              {item.employeeDisplayName} · {targetLabel(item.targetType)} · {item.targetDisplayName} · {triggerLabel(item.triggerType)} · {format(item.occurredAt)}
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
          {timeError === null ? null : <p id="review-time-error"
            className="field-error" role="alert">{timeError}</p>}
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
        <button ref={prepareButton} disabled={state.timeReviewBusy || state.adjudicationIntent !== null}>
          Entscheidung prüfen
        </button>
      </form>
      {state.adjudicationIntent === null ? null : <Confirmation
        label="Entscheidung ausdrücklich bestätigen"
        title="Entscheidung lückenlos protokollieren?"
        confirmLabel="Entscheidung protokollieren"
        busyLabel="Wird protokolliert …"
        busy={state.timeReviewBusy}
        onConfirm={() => void administration.confirmAdjudication()}
        onCancel={() => {
          administration.cancelAdjudication();
          returnFocus(prepareButton, itemSelect);
        }}
      >
        <dl>
          <dt>Prüffall</dt><dd>{selectedItem?.employeeDisplayName ?? state.adjudicationIntent.reviewItem.employeeDisplayName} · {format(state.adjudicationIntent.reviewItem.occurredAt)}</dd>
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
      <strong>{item.employeeDisplayName} · {targetLabel(item.targetType)} · {item.targetDisplayName}</strong>
      <small>{format(item.occurredAt)} · {triggerLabel(item.triggerType)} · {item.source === 'offline_v2' ? 'Nachträglich übertragen' : 'Vom Server übernommen'}</small>
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

function SectionIcon({ view }: { readonly view: AdminView }) {
  const common = {
    className: 'section-icon',
    viewBox: '0 0 24 24',
    width: 20,
    height: 20,
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.75,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    focusable: 'false' as const,
  };
  if (view === 'uebersicht') {
    return <svg {...common}>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>;
  }
  if (view === 'einrichtung') {
    return <svg {...common}>
      <path d="M4 7h10" /><path d="M18 7h2" /><circle cx="16" cy="7" r="2" />
      <path d="M4 17h2" /><path d="M10 17h10" /><circle cx="8" cy="17" r="2" />
    </svg>;
  }
  if (view === 'beschaeftigte') {
    return <svg {...common}>
      <circle cx="9" cy="8" r="3" /><path d="M3.5 20c.4-4 2.2-6 5.5-6s5.1 2 5.5 6" />
      <path d="M15 5.5a3 3 0 0 1 0 5.8M16.5 14c2.5.5 3.8 2.5 4 6" />
    </svg>;
  }
  if (view === 'arbeitszeiten') {
    return <svg {...common}>
      <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" />
    </svg>;
  }
  return <svg {...common}>
    <path d="M8 4h8" /><path d="M9 3h6v3H9z" />
    <path d="M6 5h12a2 2 0 0 1 2 2v13H4V7a2 2 0 0 1 2-2z" />
    <path d="m8 13 2.5 2.5L16 10" />
  </svg>;
}

function overviewDateLabel(now = new Date()): string {
  return new Intl.DateTimeFormat('de-DE', { dateStyle: 'full' }).format(now);
}

function localDateValue(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function currentRoute(): AdminRoute {
  return typeof window === 'undefined'
    ? defaultRoute('uebersicht')
    : routeFromLocation(window.location.pathname, window.location.search);
}

function reviewReasonLabel(value: string): string {
  const labels: Record<string, string> = {
    identity_or_membership_not_current: 'Identität oder Mitgliedschaft nicht aktuell',
    capture_time_out_of_bounds: 'Erfassungszeit außerhalb des Fensters',
    automatic_window_elapsed: 'Automatisches Zeitfenster abgelaufen',
    historical_configuration_not_valid: 'Historische Konfiguration ungültig',
    predecessor_requires_review: 'Vorgänger muss geprüft werden',
    server_lifecycle_deferred: 'Verarbeitung auf dem Server zurückgestellt',
    active_time_entry_organization_mismatch: 'Laufende Arbeitszeit gehört zu einem anderen Betrieb',
    active_time_entry_user_mismatch: 'Laufende Arbeitszeit gehört zu einer anderen Person',
    previous_work_event_organization_mismatch: 'Vorherige Erfassung gehört zu einem anderen Betrieb',
    previous_work_event_user_mismatch: 'Vorherige Erfassung gehört zu einer anderen Person',
    previous_work_event_target_mismatch: 'Vorherige Erfassung gehört zu einem anderen Ziel',
    work_event_precedes_active_time_entry: 'Erfassung liegt vor dem Beginn der laufenden Arbeitszeit',
    work_event_precedes_previous_accepted_work_event: 'Erfassung liegt vor der vorherigen bestätigten Erfassung',
  };
  return labels[value] ?? 'Prüfung erforderlich';
}

function resolutionLabel(value: string): string {
  if (value === 'no_time_record_change') return 'Keine Arbeitszeit ändern';
  if (value === 'create_recovered_time_record') return 'Arbeitszeit wiederherstellen';
  return 'Bestehende Arbeitszeit korrigieren';
}

function targetLabel(value: 'customer' | 'project' | 'general_work'): string {
  if (value === 'customer') return 'Kunde';
  if (value === 'project') return 'Projekt';
  return 'Allgemeine Arbeitszeit';
}

function triggerLabel(value: 'nfc' | 'manual'): string {
  return value === 'nfc' ? 'Gescannt' : 'Manuell erfasst';
}

function captureLabel(
  startedVia: 'nfc' | 'manual' | null,
  stoppedVia: 'nfc' | 'manual' | null,
): string {
  const labels = [startedVia, stoppedVia]
    .filter((value): value is 'nfc' | 'manual' => value !== null)
    .map(triggerLabel);
  return labels.length === 0 ? 'Nicht überliefert' : [...new Set(labels)].join(' / ');
}

function navigateFromLink(
  event: ReactMouseEvent<HTMLAnchorElement>,
  route: AdminRoute,
  navigate: (route: AdminRoute) => void,
): void {
  if (
    event.button !== 0
    || event.metaKey
    || event.ctrlKey
    || event.shiftKey
    || event.altKey
  ) return;
  event.preventDefault();
  navigate(route);
}

function recentTimeWindow(): { readonly fromInclusive: string; readonly toExclusive: string } {
  const to = Date.now();
  return Object.freeze({
    fromInclusive: new Date(to - 31 * 24 * 60 * 60 * 1_000).toISOString(),
    toExclusive: new Date(to).toISOString(),
  });
}

function FeedbackBand({ message }: { readonly message: string }) {
  const error = isErrorMessage(message);
  return <section className={`notice ${error ? 'notice-error' : 'notice-success'}`}
    role={error ? 'alert' : 'status'} aria-live={error ? 'assertive' : 'polite'}>
    <strong>{error ? 'Die Aktion wurde nicht abgeschlossen' : 'Erledigt'}</strong>
    <p>{message}</p>
  </section>;
}

function isErrorMessage(message: string): boolean {
  return !new Set([
    'Falls das Konto existiert, wurde eine Wiederherstellungs-E-Mail versendet.',
    'Das Passwort wurde geändert. Melden Sie sich mit dem neuen Passwort an.',
    'Kunde wurde sicher angelegt.',
    'Projekt wurde sicher angelegt.',
    'Projekt wurde deaktiviert.',
    'Einladung wurde einmalig erzeugt.',
    'Zugang wurde entzogen.',
    'Rolle wurde geändert.',
    'Einladungsgeheimnis wurde verworfen.',
    'Änderung wurde verworfen.',
    'NFC-Tag wurde sicher neu zugeordnet.',
    'Die Zuordnung war bereits korrekt.',
    'Korrektur wurde verworfen.',
    'Die Arbeitszeit wurde korrigiert. Die ursprüngliche Fassung bleibt lückenlos erhalten.',
    'Die Prüfentscheidung wurde verworfen.',
    'Die Prüfentscheidung wurde lückenlos protokolliert.',
    'Die CSV-Datei wurde erstellt und heruntergeladen.',
  ]).has(message);
}

function returnFocus(...references: readonly RefObject<HTMLElement | null>[]): void {
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() => focusFirstAvailable(references));
  } else {
    focusFirstAvailable(references);
  }
}

function useIntentFocusReturn(
  intentPresent: boolean,
  ...targets: readonly RefObject<HTMLElement | null>[]
): void {
  const previousIntent = useRef(intentPresent);
  const pendingReturn = useRef(false);
  if (previousIntent.current && !intentPresent) pendingReturn.current = true;
  previousIntent.current = intentPresent;
  useEffect(() => {
    if (!pendingReturn.current) return;
    pendingReturn.current = !focusFirstAvailable(targets);
  });
}

function focusFirstAvailable(
  references: readonly RefObject<HTMLElement | null>[],
): boolean {
  for (const reference of references) {
    const element = reference.current;
    if (
      element === null
      || !element.isConnected
      || element.hasAttribute('disabled')
      || element.getAttribute('aria-disabled') === 'true'
    ) continue;
    element.focus();
    if (document.activeElement === element) return true;
  }
  return false;
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
