import { BUSINESS_TIME_ZONE } from '@taptime/core';
import {
	FormEvent,
	lazy,
	Suspense,
	useEffect,
	useRef,
	useState,
	useSyncExternalStore
} from 'react';
import { type EmployeeAccountInvitationCapability } from './EmployeeAccountInvitationForm';
import type {
	AdminWebCapability
} from './contracts';
import {
	canonicalRoutePath,
	defaultRoute,
	monthTimeWindow,
	routeFromLocation,
	visibleAdminViews,
	type AdminRoute,
	type AdminView
} from './navigation';
import './styles.css';
import {
	toZonedLocalInput
} from './timeZone';
import { DelayedSkeleton } from './ui';

import { FeedbackBand,navigateFromLink,recentTimeWindow } from './viewHelpers';
const Overview=lazy(()=>import('./views/Overview'));
const SetupView=lazy(()=>import('./views/SetupView'));
const EmployeesView=lazy(()=>import('./views/EmployeesView'));
const PersonView=lazy(()=>import('./views/PersonView'));
const TimeRecordsView=lazy(()=>import('./views/TimeRecordsView'));
const ReviewsView=lazy(()=>import('./views/ReviewsView'));
const OwnTimeView=lazy(()=>import('./views/OwnTimeView'));
const ManualView=lazy(()=>import('./views/ManualView'));

export function App({
  administration,
  accountInvitations,
}: {
  readonly administration: AdminWebCapability;
  readonly accountInvitations?: EmployeeAccountInvitationCapability;
}) {
  const state = useSyncExternalStore(
    (listener) => administration.subscribe(listener),
    () => administration.getState(),
    () => administration.getState(),
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
    if (state.status !== 'ready' || route.view !== 'lohnexport') return;
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
  }, [administration, route.view, route.month, state.status]);

  useEffect(() => {
    void administration.selectLocation(route.locationId);
  }, [administration, route.locationId]);

  useEffect(() => {
    if (state.status !== 'ready') return;
    const visibleViews = visibleAdminViews(state.availableSections);
    const view = visibleViews.some((candidate) => candidate.slug === route.view)
      ? route.view : visibleViews[0]!.slug;
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
        <p>Melden Sie sich mit Ihrem Zugang an.</p>
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
    ? route : defaultRoute(visibleViews[0]!.slug, state.selectedLocation?.id ?? null);
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
        <span>{state.role === 'administrator' ? 'Administrator' : state.role === 'standortleitung' ? 'Standortleitung' : 'Beschäftigte/r'}</span>
        <button className="quiet" onClick={() => void administration.signOut()}>Abmelden</button>
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
          </div>
      </header>
      <p className="timezone-declaration">
        Zeitdarstellung: {BUSINESS_TIME_ZONE}
      </p>
      {state.notice ? <FeedbackBand message={state.notice} /> : null}
      <Suspense fallback={<DelayedSkeleton label="Bereich wird geladen"/>}>
      {activeRoute.view === 'uebersicht'
        ? <Overview state={state} administration={administration} navigate={navigate} /> : null}
      {activeRoute.view === 'einrichtung' ? <SetupView state={state} administration={administration} /> : null}
      {activeRoute.view === 'beschaeftigte' ? activeRoute.personId
        ? <PersonView state={state} administration={administration} route={activeRoute} navigate={navigate}/>
        : <EmployeesView state={state} administration={administration} accountInvitations={accountInvitations} navigate={navigate}/> : null}
      {activeRoute.view === 'lohnexport'
        ? <TimeRecordsView state={state} administration={administration}
            route={activeRoute} navigate={navigate} /> : null}
      {activeRoute.view === 'pruefungen' ? <ReviewsView state={state} administration={administration} /> : null}
      {activeRoute.view === 'meine-zeiten' ? <OwnTimeView state={state} administration={administration} route={activeRoute} navigate={navigate}/> : null}
      {activeRoute.view === 'manuell' ? <ManualView state={state} administration={administration}/> : null}
      </Suspense>
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

function Brand() {
  return <div className="brand">
    <span className="brand-mark" aria-hidden="true">T</span>
    <span><strong>Taptura</strong><small>ZEIT. EINFACH. KLAR.</small></span>
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
  if (view === 'meine-zeiten') {
    return <svg {...common}>
      <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" />
    </svg>;
  }
  if (view === 'lohnexport') return <svg {...common}><path d="M12 3v13m-5-5 5 5 5-5M4 20h16"/></svg>;
  if (view === 'manuell') return <svg {...common}><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>;
  return <svg {...common}>
    <path d="M8 4h8" /><path d="M9 3h6v3H9z" />
    <path d="M6 5h12a2 2 0 0 1 2 2v13H4V7a2 2 0 0 1 2-2z" />
    <path d="m8 13 2.5 2.5L16 10" />
  </svg>;
}

function overviewDateLabel(now = new Date()): string {
  return new Intl.DateTimeFormat('de-DE', { dateStyle: 'full', timeZone: BUSINESS_TIME_ZONE }).format(now);
}

function localDateValue(now = new Date()): string {
  return toZonedLocalInput(now.toISOString()).slice(0, 10);
}

function currentRoute(): AdminRoute {
  return typeof window === 'undefined'
    ? defaultRoute('uebersicht')
    : routeFromLocation(window.location.pathname, window.location.search);
}
