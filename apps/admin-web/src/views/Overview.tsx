import {
	lazy,
	Suspense,
	useEffect
} from 'react';
import type {
	AdminWebCapability
} from '../contracts';
import {
	defaultRoute,
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
  const newOperation=state.availableSections.includes('setup') && state.projects !== undefined
    && Object.values(state.sections).every(section=>section.status === 'ready')
    && state.projection.nextCursor === null && state.projection.customersComplete && state.projection.nfcTagsComplete
    && state.projectsNextCursor === null && !state.projectBusy && state.timeRecordsNextCursor === null && state.reviewItemsNextCursor === null
    && state.projection.customers.length === 0 && state.projection.nfcTags.length === 0 && state.projects.length === 0
    && state.timeRecords.length === 0 && state.reviewItems.length === 0;
  if(newOperation) return <section className="first-empty" aria-labelledby="first-empty-title">
    <h2 id="first-empty-title">Ihr Betrieb ist bereit</h2><p>Legen Sie das erste Arbeitsziel an.</p>
    <a className="button-link" href="/einrichtung" onClick={event=>navigateFromLink(event,defaultRoute('einrichtung'),navigate)}>Erstes Arbeitsziel anlegen</a>
  </section>;
  const summary=state.managedPeople;
  const reviewsAvailable=state.availableSections.includes('review_items');
  const reviewCountKnown=reviewsAvailable && state.sections.reviewItems.status === 'ready'
    && state.reviewItemsNextCursor === null;
  return <>
    <div className="metric-grid">
      <ActivityTile state={state} administration={administration}/>
      {reviewCountKnown ? <article className="metric-card"><span>Braucht Ihre Entscheidung</span>
        <strong>{state.reviewItems.length}</strong><small>Offene Prüfungen · vollständig geladen</small>
        <a href="/pruefungen" onClick={event=>navigateFromLink(event,defaultRoute('pruefungen'),navigate)}>Prüfungen öffnen</a>
      </article> : null}
    </div>
    {summary?.status === 'ready' ? <Panel title="Gerade aktiv">
      <PeopleTable people={summary.value.people} navigate={navigate} locationId={state.selectedLocation?.id ?? null}/>
      {summary.value.nextCursor !== null ? <p className="supporting">Weitere Personen finden Sie unter Beschäftigte.</p> : null}
    </Panel> : null}
    {reviewsAvailable ? <Suspense fallback={<DelayedSkeleton label="Prüfungen werden geladen"/>}><ReviewsView state={state} administration={administration}/></Suspense> : null}
  </>;
}
