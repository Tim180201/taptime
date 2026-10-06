import {
	lazy,
	Suspense,
	useEffect
} from 'react';
import type {
	AdminWebCapability
} from '../contracts';
import {
	canonicalRoutePath, defaultRoute,
	type AdminRoute
} from '../navigation';
import { DelayedSkeleton,Panel } from '../ui';
import { navigateFromLink } from '../viewHelpers';
import { ActivityTile,PeopleTable } from './PeopleShared';
type ReadyState = Extract<ReturnType<AdminWebCapability['getState']>, { status: 'ready' }>;
const ReviewsView=lazy(()=>import('./ReviewsView'));
export default function Overview({state,administration,navigate}: {
  readonly state: ReadyState; readonly administration: AdminWebCapability;
  readonly navigate: (route: AdminRoute)=>void;
}) {
  useEffect(()=>{ void administration.refreshManagedPeople?.(true); },[administration,state.selectedLocation?.id]);
  useEffect(()=>{if(state.availableSections.includes('setup') && state.projects === undefined) void administration.refreshProjects?.();},[administration]);
  const next=nextSetupStep(state);
  const summary=state.managedPeople;
  const reviewsAvailable=state.availableSections.includes('review_items');
  const reviewCountKnown=reviewsAvailable && state.sections.reviewItems.status === 'ready'
    && state.reviewItemsNextCursor === null;
  return <>
    {next ? <section className="first-empty" aria-labelledby="next-step-title">
      <h2 id="next-step-title">Ihr nächster Schritt</h2><p>{next.text}</p>
      <a className="button-link" href={canonicalRoutePath(next.route)} onClick={event=>navigateFromLink(event,next.route,navigate)}>{next.label}</a>
    </section> : null}
    <div className="metric-grid">
      <ActivityTile state={state} administration={administration}/>
      {reviewCountKnown ? <article className="metric-card"><span>Braucht Ihre Entscheidung</span>
        <strong>{state.reviewItems.length}</strong><small>Zeiten prüfen · vollständig geladen</small>
        <a href="/pruefungen" onClick={event=>navigateFromLink(event,defaultRoute('pruefungen'),navigate)}>Zeiten prüfen</a>
      </article> : null}
    </div>
    {summary?.status === 'ready' ? <Panel title="Gerade aktiv">
      <PeopleTable people={summary.value.people} navigate={navigate} locationId={state.selectedLocation?.id ?? null}/>
      {summary.value.nextCursor !== null ? <p className="supporting">Weitere Personen finden Sie unter Mitarbeiter.</p> : null}
    </Panel> : null}
    {reviewsAvailable ? <Suspense fallback={<DelayedSkeleton label="Ungeklärte Erfassungen werden geladen"/>}><ReviewsView state={state} administration={administration}/></Suspense> : null}
  </>;
}

/** Derived only from the already loaded organization projections; never persists progress. */
export function nextSetupStep(state:ReadyState): {text:string;label:string;route:AdminRoute}|null {
  if (state.role!=='administrator' || state.selectedLocation!==null || state.locationSetup===null || state.locationSetupBusy
    || !['setup','employees','timeRecords'].every(section=>state.sections[section as 'setup'|'employees'|'timeRecords'].status==='ready')
    || state.projects===undefined || state.projectBusy || state.projectsNextCursor!==null
    || !state.projection.customersComplete || !state.projection.nfcTagsComplete
    || state.employeeProjection.nextCursor!==null || state.timeRecordsNextCursor!==null) return null;
  const locations={...defaultRoute('einrichtung'),setupTab:'standorte' as const};
  if (!state.locationsEnabled && state.locationSetup.locations.some(location=>location.active))
    return {text:'Ordnen Sie Mitarbeiter und Kunden ihren Standorten zu und schalten Sie die Standorte ein.',label:'Standorte zuordnen',route:locations};
  if (state.locationSetup.memberships.some(person=>person.role==='standortleitung' && person.managementLocationIds.length===0))
    return {text:'Weisen Sie den Standortleitungen ihren Bereich zu.',label:'Bereiche zuweisen',route:locations};
  if (state.projection.customers.length===0 && state.projects.length===0)
    return {text:'Legen Sie Kunden an.',label:'Kunden anlegen',route:defaultRoute('kunden')};
  if (state.projection.nfcTags.length===0)
    return {text:'Richten Sie in der App Karten ein.',label:'Karteneinrichtung ansehen',route:{...defaultRoute('einrichtung'),setupTab:'tags'}};
  if (!state.employeeProjection.employeeMemberships.some(person=>person.active && person.id!==state.membershipId))
    return {text:'Laden Sie Mitarbeiter ein.',label:'Mitarbeiter einladen',route:defaultRoute('beschaeftigte')};
  if (!state.timeRecords.some(record=>record.status==='stopped'))
    return {text:'Erfassen Sie die erste Arbeitszeit.',label:'Arbeitszeit erfassen',route:defaultRoute('manuell')};
  return null;
}
