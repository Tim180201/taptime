import {HeaderOutlet,PageHeader} from './PageHeader';
import {ThemeSwitch} from './ThemeSwitch';
import { MIN_PASSWORD_LENGTH } from '../../../shared/authPolicy';
import { APP_NAME } from '../../../shared/product';
import { BrandMark } from '../../../shared/BrandMark';
import { AppDownloadSuccess } from './AppDownloadSuccess';
import { RequiredForm } from './RequiredForm';
import { CustomerQuotaNotice } from './QuotaNotice';
import type { Notice } from './contracts';
import { BUSINESS_TIME_ZONE,businessDay } from '@taptime/core';
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
import { MobileSheet, useCompactLayout } from './MobileSheet';
import { expiredResetLinkMessage } from './PasswordResetPage';

import { FeedbackBand,navigateFromLink } from './viewHelpers';
const Overview=lazy(()=>import('./views/Overview'));
const SetupView=lazy(()=>import('./views/SetupView'));
const EmployeesView=lazy(()=>import('./views/EmployeesView'));
const PersonView=lazy(()=>import('./views/PersonView'));
const TimeRecordsView=lazy(()=>import('./views/TimeRecordsView'));
const ReviewsView=lazy(()=>import('./views/ReviewsView'));
const CustomersView=lazy(()=>import('./views/CustomersView'));
const OwnTimeView=lazy(()=>import('./views/OwnTimeView'));
const ManualView=lazy(()=>import('./views/ManualView'));

export function App({
  administration,
  accountInvitations,
  initialRecoveryLinkError = false,
}: {
  readonly administration: AdminWebCapability;
  readonly accountInvitations?: EmployeeAccountInvitationCapability;
  readonly initialRecoveryLinkError?: boolean;
}) {
  const state = useSyncExternalStore(
    (listener) => administration.subscribe(listener),
    () => administration.getState(),
    () => administration.getState(),
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [recoveryLinkError, setRecoveryLinkError] = useState(initialRecoveryLinkError);
  const [route, setRoute] = useState<AdminRoute>(() => currentRoute());
  const previousView = useRef(route.view);
  const mainHeading = useRef<HTMLHeadingElement>(null);
  const compact = useCompactLayout();
  const [moreOpen, setMoreOpen] = useState(false);
  const [helpOpen,setHelpOpen]=useState(false);
  const [headerHost,setHeaderHost]=useState<HTMLElement|null>(null);
  const [version,setVersion]=useState<string|null>(null);
  useEffect(()=>{let current=true;void fetch('/version.txt').then(r=>r.ok?r.text():null).then(v=>{if(current&&v&&/^[a-zA-Z0-9._-]{1,80}$/.test(v.trim()))setVersion(v.trim());}).catch(()=>{});return()=>{current=false;};},[]);
  useEffect(() => { setMoreOpen(false); }, [route.view, compact, state.status]);

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
    const month=route.month??businessDay(Date.now()).slice(0,7);
    const window=monthTimeWindow(month);
    if(window&&(state.timeWindow.fromInclusive!==window.fromInclusive||state.timeWindow.toExclusive!==window.toExclusive))
      void administration.setTimeWindow(window.fromInclusive,window.toExclusive);
  }, [administration,route.view,route.month,state.status,
    state.status==='ready'?state.timeWindow.fromInclusive:null,state.status==='ready'?state.timeWindow.toExclusive:null]);

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
  if (state.status === 'signed_out' && state.passwordResetCompleted) {
    return <main className="login-shell">
      <section className="login-card" aria-labelledby="recovery-title">
        <Brand />
        <h1 id="recovery-title">Neues Passwort setzen</h1>
        <AppDownloadSuccess />
        <p><a className="button-link secondary-link" href="/">Im Browser anmelden</a></p>
      </section>
    </main>;
  }
  if (state.status === 'signed_out' || state.status === 'signing_in') {
    return <main className="login-shell">
      <section className="login-card" aria-labelledby="login-title">
        <Brand />
        <ThemeSwitch/><h1 id="login-title">{APP_NAME} Verwaltung</h1>
        <p>Melden Sie sich mit Ihrem Zugang an.</p>
        {state.status === 'signed_out' && state.notice
          ? <FeedbackBand message={state.notice} /> : recoveryLinkError
            ? <FeedbackBand message={{ kind: 'error', text: expiredResetLinkMessage }} /> : null}
        <RequiredForm onSubmit={(event: FormEvent) => {
          event.preventDefault();
          setRecoveryLinkError(false);
          if((event.nativeEvent as SubmitEvent).submitter?.getAttribute('data-validation-scope')==='login-email'){void administration.requestPasswordReset(email);return;}
          const passwordSnapshot = password;
          setPassword('');
          void administration.signIn(email, passwordSnapshot);
        }}>
          <label htmlFor="login-email">E-Mail</label>
          <input id="login-email" type="email" inputMode="email" autoComplete="username" required value={email}
            onChange={(event) => setEmail(event.target.value)} />
          <label htmlFor="login-password">Passwort</label>
          <input id="login-password" type="password" autoComplete="current-password" required
            value={password} onChange={(event) => setPassword(event.target.value)} />
          <button className="primary-action" disabled={state.status === 'signing_in'} aria-busy={state.status === 'signing_in'}>
            {state.status === 'signing_in' ? 'Wird geprüft …' : 'Anmelden'}
          </button>
        <button className="text-button" type="submit" data-validation-scope="login-email" disabled={state.status === 'signing_in'}
          aria-busy={state.status === 'signing_in'}
          >
          Passwort vergessen
        </button></RequiredForm><p className="supporting">Noch keinen Zugang? Ihre Verwaltung lädt Sie per E-Mail ein.</p>
      </section>
    </main>;
  }
  if (state.status === 'loading') {
    return <main className="center loading-screen" aria-busy="true">
      <DelayedSkeleton label="Verwaltung wird geladen" rows={5} />
    </main>;
  }
  if (state.status === 'organization_paused') {
    return <main className="center"><Brand />
      <p role="alert">Ihr Betrieb ist pausiert. Bitte wenden Sie sich an {APP_NAME}.</p>
      <button onClick={() => void administration.refresh()}>Erneut versuchen</button>
      <button onClick={() => void administration.signOut()}>Abmelden</button>
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
  const directViews=visibleViews.slice(0,4);
  const remainingViews=visibleViews.slice(directViews.length);
  const roleLabel=state.role === 'administrator' ? 'Administrator' : state.role === 'standortleitung' ? 'Standortleitung' : 'Mitarbeiter';
  const personName=state.employeeProjection.employeeMemberships.find(person=>person.id===state.membershipId)?.displayName;
  const account=<><span>Angemeldet für</span><strong>{state.projection.organization.name}</strong><span>{personName?`${personName} · `:''}{roleLabel}</span></>;
  const groups=[{title:'Arbeit',items:visibleViews.filter(item=>!['einrichtung','lohnexport'].includes(item.slug))},{title:'Verwaltung',items:visibleViews.filter(item=>['einrichtung','lohnexport'].includes(item.slug))}];
  const navigation=(items:typeof visibleViews)=><nav aria-label="Hauptnavigation">{groups.map(group=>({...group,items:group.items.filter(item=>items.includes(item))})).filter(g=>g.items.length).map(group=><section key={group.title} className="navigation-group"><h2>{group.title}</h2><ul>{group.items.map(item=><li key={item.slug}><a href={canonicalRoutePath(defaultRoute(item.slug,state.selectedLocation?.id??null))} aria-current={item.slug===activeRoute.view?'page':undefined} onClick={event=>{navigateFromLink(event,defaultRoute(item.slug,state.selectedLocation?.id??null),navigate);if(event.defaultPrevented)setMoreOpen(false);}}><SectionIcon view={item.slug}/><span>{item.label}</span>{item.slug==='pruefungen'&&state.sections.reviewItems.status==='ready'&&state.reviewItems.length>0?<span className="nav-count">{state.reviewItemsNextCursor?'≥ ':''}{state.reviewItems.length}</span>:null}</a></li>)}</ul></section>)}</nav>;
  const accountBlock=<div className="sidebar-footer"><div className="sidebar-account">{account}</div><ThemeSwitch/><button className="text-button sidebar-signout" onClick={()=>void administration.signOut()}>Abmelden</button><button className="text-button" onClick={()=>{setMoreOpen(false);setHelpOpen(true);}}>So funktioniert {APP_NAME}</button></div>;
  const subtitles:Record<AdminView,string>={uebersicht:overviewDateLabel(),kunden:'Stunden und Kontingente Ihrer Kunden.',beschaeftigte:'Mitarbeiter und ihre Zeiten im gewählten Monat.',pruefungen:'Diese Erfassungen konnten noch keiner Arbeitszeit sicher zugeordnet werden.','meine-zeiten':'Ihre Zeiten im gewählten Monat.',manuell:'Starten und beenden Sie Ihre Zeit ohne Karte.',einrichtung:'Verwalten Sie Standorte, Mitarbeiter, Kunden und Karten.',lohnexport:'Laden Sie die Zeiten für Ihre Lohnabrechnung herunter.'};
  const ownHeader=['kunden','manuell','einrichtung','beschaeftigte','pruefungen','lohnexport'].includes(activeRoute.view);
  return <HeaderOutlet.Provider value={headerHost}><div className="app-shell">
    <div className="top-band"><Brand/><strong className="band-organization">{state.projection.organization.name}</strong><span className="band-account">{personName?`${personName} · `:''}{roleLabel}</span><button className="text-button" onClick={()=>void administration.signOut()}>Abmelden</button></div>
    <div className="mobile-top"><Brand/><span>{state.projection.organization.name}</span></div>
    <aside className="sidebar"><Brand/>{navigation(visibleViews)}{accountBlock}</aside>
    <main className="workspace">
      <header className="workspace-header" ref={setHeaderHost}/>
      {!ownHeader?<PageHeader organization={state.projection.organization.name} title={activeView.label} subtitle={<>{subtitles[activeRoute.view]}</>} onRefresh={()=>void administration.refresh()}/>:null}
      {state.locationsEnabled&&state.managementScope.kind==='locations'&&state.selectedLocation?<div className="location-context">{state.managementScope.locations.length===1?<span>Ihr Bereich: {state.selectedLocation.name}</span>:<label>Bereich<select value={state.selectedLocation.id} onChange={event=>navigate({...activeRoute,locationId:event.target.value})}>{state.managementScope.locations.map(location=><option key={location.id} value={location.id}>{location.name}</option>)}</select></label>}</div>:null}
      {state.membershipId?<CustomerQuotaNotice key={`${state.membershipId}/${state.role}`} administration={administration} membership={state.membershipId} role={state.role} authorityContext={JSON.stringify([state.membershipId,state.role,state.managementScope,state.locationsEnabled])} onView={(id,month)=>navigate({...defaultRoute('kunden'),month,customerId:id})}/>:null}
      {state.notice?<FeedbackBand message={state.notice}/>:null}
      <Suspense fallback={<DelayedSkeleton label="Bereich wird geladen"/>}>
        {activeRoute.view==='uebersicht'?<Overview state={state} administration={administration} navigate={navigate}/>:null}
        {activeRoute.view==='einrichtung'?<SetupView route={activeRoute} state={state} administration={administration}/>:null}
        {activeRoute.view==='beschaeftigte'?activeRoute.personId?<PersonView accountInvitations={accountInvitations} state={state} administration={administration} route={activeRoute} navigate={navigate}/>:<EmployeesView route={activeRoute} state={state} administration={administration} accountInvitations={accountInvitations} navigate={navigate}/>:null}
        {activeRoute.view==='lohnexport'?<TimeRecordsView state={state} administration={administration} route={activeRoute} navigate={navigate}/>:null}
        {activeRoute.view==='pruefungen'?<ReviewsView state={state} administration={administration}/>:null}
        {activeRoute.view==='kunden'?<CustomersView key={`${state.membershipId}/${state.role}`} authorityContext={JSON.stringify([state.membershipId,state.role,state.managementScope,state.locationsEnabled])} administration={administration} route={activeRoute} navigate={navigate}/>:null}
        {activeRoute.view==='meine-zeiten'?<OwnTimeView state={state} administration={administration} route={activeRoute} navigate={navigate}/>:null}
        {activeRoute.view==='manuell'?<ManualView state={state} administration={administration}/>:null}
      </Suspense>
      <footer className="workspace-footer"><span>Deutsche Ortszeit{state.managedPeople?.status==='ready'?` · Stand ${new Intl.DateTimeFormat('de-DE',{timeZone:BUSINESS_TIME_ZONE,hour:'2-digit',minute:'2-digit'}).format(new Date(state.managedPeople.value.serverTime))}`:''}</span>{version?<span>Version {version}</span>:null}</footer>
    </main>
    {compact?<nav className="mobile-navigation" aria-label="Hauptnavigation">{directViews.map(item=><a key={item.slug} href={canonicalRoutePath(defaultRoute(item.slug,state.selectedLocation?.id??null))} aria-current={item.slug===activeRoute.view?'page':undefined} onClick={event=>navigateFromLink(event,defaultRoute(item.slug,state.selectedLocation?.id??null),navigate)}><SectionIcon view={item.slug}/><span>{item.label}</span></a>)}
      <button className="quiet" aria-haspopup="dialog" aria-expanded={moreOpen} onClick={()=>setMoreOpen(true)}><svg className="section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true"><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></svg><span>Mehr</span></button>
    </nav>:null}
    {compact&&moreOpen?<MobileSheet label="Mehr" onCancel={()=>setMoreOpen(false)}><h2>Mehr</h2>{navigation(remainingViews)}{accountBlock}<button className="secondary" onClick={()=>setMoreOpen(false)}>Schließen</button></MobileSheet>:null}
    {helpOpen?<MobileSheet label={`So funktioniert ${APP_NAME}`} className="right-sheet" onCancel={()=>setHelpOpen(false)}><h2>So funktioniert {APP_NAME}</h2><dl className="help-terms">
      <dt>Erfassen mit Karte</dt><dd>Halten Sie Ihr Handy an die NFC-Karte. Die App zeigt Ihnen, ob Ihre Zeit gestartet oder beendet wurde.</dd>
      <dt>Zeit</dt><dd>Eine Zeit verbindet Beginn, Ende und einen Kunden oder ein Projekt. Ihre Zeiten sehen Sie unter „Meine Zeiten“.</dd>
      <dt>Pause</dt><dd>Eine Pause liegt innerhalb einer laufenden Zeit. Starten und beenden Sie sie über den Pausenknopf.</dd>
      <dt>Zeiten prüfen</dt><dd>Hier stehen Erfassungen, die noch keiner Arbeitszeit sicher zugeordnet werden konnten. Die Verwaltung prüft den Fall und legt die passende Zeit fest.</dd>
      <dt>Kontingent</dt><dd>Ein Kontingent ist die vereinbarte Stundenzahl eines Kunden im Monat. Ein Hinweis zeigt, wenn es fast erreicht oder überschritten ist.</dd>
    </dl><button className="secondary" onClick={()=>setHelpOpen(false)}>Schließen</button></MobileSheet>:null}
  </div></HeaderOutlet.Provider>;
}

function PasswordRecovery({
  administration,
  completing,
  notice,
}: {
  readonly administration: AdminWebCapability;
  readonly completing: boolean;
  readonly notice: Notice | null;
}) {
  const [password, setPassword] = useState('');
  return <main className="login-shell">
    <section className="login-card" aria-labelledby="recovery-title">
      <Brand />
      <h1 id="recovery-title">Neues Passwort setzen</h1>
      {notice ? <FeedbackBand message={notice} /> : null}
      <RequiredForm onSubmit={(event) => {
        event.preventDefault();
        const snapshot = password;
        setPassword('');
        void administration.completePasswordRecovery(snapshot);
      }}>
        <label htmlFor="recovery-password">Neues Passwort</label>
        <input id="recovery-password" type="password" autoComplete="new-password"
          minLength={MIN_PASSWORD_LENGTH} required value={password}
          onChange={(event) => setPassword(event.target.value)} />
        <button className="primary-action" disabled={completing} aria-busy={completing}>
          {completing ? 'Wird geändert …' : 'Passwort ändern'}
        </button>
      </RequiredForm>
    </section>
  </main>;
}

type ReadyState = Extract<ReturnType<AdminWebCapability['getState']>, { readonly status: 'ready' }>;

function Brand() {
  return <div className="brand">
    <BrandMark className="brand-mark" size={28} />
    <span><strong>{APP_NAME}</strong><small>ZEIT. EINFACH. KLAR.</small></span>
  </div>;
}

function SectionIcon({ view }: { readonly view: AdminView }) {
  const common = {
    className: 'section-icon',
    viewBox: '0 0 24 24',
    width: 16,
    height: 16,
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.75,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    focusable: 'false' as const,
  };
  if (view === 'kunden') return <svg {...common}><path d="M16 20V4a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-2M8 6h4M8 10h4M8 14h4M8 18h4"/></svg>;
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
