import {
	lazy,
	Suspense,
	useEffect,
	useMemo,
	useState
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
  const evidence=useGuidanceEvidence(state,administration);
  const next=nextSetupStep(state,evidence);
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

type Check='yes'|'no'|'unknown';
type Evidence={customers:Check;projects:Check;tags:Check};
const missing=(found:boolean,complete:boolean):Check=>found?'no':complete?'yes':'unknown';
function mixedEvidence(state:ReadyState):Pick<Evidence,'customers'|'tags'> {
  if(state.sections.setup.status!=='ready')return {customers:'unknown',tags:'unknown'};
  return {
    customers:missing(state.projection.customers.length>0,state.projection.customersComplete&&state.projection.nextCursor===null),
    tags:missing(state.projection.nfcTags.length>0,state.projection.nfcTagsComplete&&state.projection.nextCursor===null),
  };
}
function useGuidanceEvidence(state:ReadyState,administration:AdminWebCapability):Evidence {
  // A new projection or authority discards prior answers immediately, before effects run.
  const scope=useMemo(()=>({
    enabled:state.role==='administrator'&&state.selectedLocation===null&&state.availableSections.includes('setup'),
    initial:{...mixedEvidence(state),projects:'unknown' as Check},
  }),[administration,state.membershipId,state.role,state.selectedLocation,state.projection,state.sections.setup.status]);
  const [answers,setAnswers]=useState<{scope:typeof scope;value:Evidence}|null>(null);
  useEffect(()=>{
    let current=true;
    const read=async(key:keyof Evidence)=>{
      let answer:Check='unknown';
      try {
        const result=key==='customers'
          ?await administration.querySearch?.('setup_customers',{kind:'customers',search:null,cursor:null})
          :key==='tags'?await administration.querySearch?.('setup_tags',{kind:'nfc_tags',search:null,cursor:null})
          :await administration.querySearch?.('projects',{search:null,cursor:null});
        if(result?.status==='ready'&&result.value){
          const page=result.value;
          const items='projects' in page?page.projects:key==='customers'?page.customers:page.nfcTags;
          answer=missing(items.length>0,page.nextCursor===null);
        }
      }catch{/* A failed existence check is unknown; later checks can still answer yes. */}
      if(current)setAnswers(old=>({scope,value:{...(old?.scope===scope?old.value:scope.initial),[key]:answer}}));
    };
    if(scope.enabled){
      if(scope.initial.customers==='unknown')void read('customers');
      if(scope.initial.customers!=='no')void read('projects');
      if(scope.initial.tags==='unknown')void read('tags');
    }
    return()=>{current=false;};
  },[scope]);
  return answers?.scope===scope?answers.value:scope.initial;
}

/** Unknown checks are skipped, never promoted to a setup recommendation. */
export function nextSetupStep(state:ReadyState,evidence?:Evidence): {text:string;label:string;route:AdminRoute}|null {
  if(state.role!=='administrator'||state.selectedLocation!==null)return null;
  const setup=!state.locationSetupBusy&&!state.locationSetupFailed?state.locationSetup:null;
  const locations={...defaultRoute('einrichtung'),setupTab:'standorte' as const};
  const locationCheck=setup?(!state.locationsEnabled&&setup.locations.some(location=>location.active)?'yes':'no'):'unknown';
  if(locationCheck==='yes')
    return {text:'Ordnen Sie Mitarbeiter und Kunden ihren Standorten zu und schalten Sie die Standorte ein.',label:'Standorte zuordnen',route:locations};
  const managementCheck=setup?(setup.memberships.some(person=>person.role==='standortleitung'&&person.managementLocationIds.length===0)?'yes':'no'):'unknown';
  if(managementCheck==='yes')
    return {text:'Weisen Sie den Standortleitungen ihren Bereich zu.',label:'Bereiche zuweisen',route:locations};
  const checks=evidence??{...mixedEvidence(state),projects:state.projects!==undefined&&!state.projectBusy
    ?missing(state.projects.length>0,state.projectsNextCursor===null):'unknown'};
  if(checks.customers==='yes'&&checks.projects==='yes')
    return {text:'Legen Sie Kunden an.',label:'Kunden anlegen',route:defaultRoute('kunden')};
  if(checks.tags==='yes')
    return {text:'Richten Sie in der App Karten ein.',label:'Karteneinrichtung ansehen',route:{...defaultRoute('einrichtung'),setupTab:'tags'}};
  const people=state.sections.employees.status==='ready'
    ?missing(state.employeeProjection.employeeMemberships.some(person=>person.active&&person.id!==state.membershipId),state.employeeProjection.nextCursor===null):'unknown';
  if(people==='yes')
    return {text:'Laden Sie Mitarbeiter ein.',label:'Mitarbeiter einladen',route:defaultRoute('beschaeftigte')};
  const times=state.sections.timeRecords.status==='ready'
    ?missing(state.timeRecords.some(record=>record.status==='stopped'),state.timeRecordsNextCursor===null):'unknown';
  if(times==='yes')
    return {text:'Erfassen Sie die erste Arbeitszeit.',label:'Arbeitszeit erfassen',route:defaultRoute('manuell')};
  return null;
}
