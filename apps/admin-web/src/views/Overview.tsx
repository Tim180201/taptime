import {useEffect,useMemo,useState} from 'react';
import type {AdminWebCapability} from '../contracts';
import {canonicalRoutePath,defaultRoute,type AdminRoute} from '../navigation';
import {DataTable,EmptyState,Metric,Panel,Person,Pill,SectionBoundary} from '../ui';
import {navigateFromLink,reviewReasonLabel} from '../viewHelpers';
import {businessDay,BUSINESS_TIME_ZONE} from '@taptime/core';
type ReadyState=Extract<ReturnType<AdminWebCapability['getState']>,{status:'ready'}>;
export default function Overview({state,administration,navigate}:{state:ReadyState;administration:AdminWebCapability;navigate:(route:AdminRoute)=>void}) {
  useEffect(()=>{void administration.refreshManagedPeople?.(true);},[administration,state.selectedLocation?.id]);
  const evidence=useGuidanceEvidence(state,administration),next=nextSetupStep(state,evidence),summary=state.managedPeople;
  const [quota,setQuota]=useState<{count:number;more:boolean}|null>(null);
  const [quotaFailed,setQuotaFailed]=useState(false);
  useEffect(()=>{
    let current=true;setQuota(null);setQuotaFailed(false);
    if(state.role!=='employee'&&administration.readQuotaAlerts)void administration.readQuotaAlerts(businessDay(Date.now()).slice(0,7),null).then(result=>{
      if(!current)return;
      if(result.status==='ready'&&result.value)setQuota({count:result.value.customers.length,more:result.value.nextCursor!==null});else setQuotaFailed(true);
    }).catch(()=>{if(current)setQuotaFailed(true);});
    return()=>{current=false;};
  },[administration,state.membershipId,state.role,state.selectedLocation?.id,state.projection]);
  const reviews=state.availableSections.includes('review_items');
  const go=(view:'kunden'|'pruefungen'|'beschaeftigte',label:string)=><a className="text-button" href={canonicalRoutePath(defaultRoute(view,state.selectedLocation?.id??null))} onClick={event=>navigateFromLink(event,defaultRoute(view,state.selectedLocation?.id??null),navigate)}>{label} →</a>;
  return <>
    {next?<section className="panel next-step" aria-labelledby="next-step-title"><h2 id="next-step-title">Ihr nächster Schritt</h2><p>{next.text}</p><a className="text-button" href={canonicalRoutePath(next.route)} onClick={event=>navigateFromLink(event,next.route,navigate)}>{next.label} →</a></section>:null}
    <div className="metric-grid">
      <Metric label="Gerade aktiv" value={summary?.status==='ready'?`${summary.value.runningCount} / ${summary.value.totalCount}`:summary?.status==='unavailable'?'Nicht verfügbar':'Wird geladen …'} action={<a className="text-button" href="#gerade-aktiv">Aktivübersicht →</a>}/>
      {reviews?<Metric label="Braucht Ihre Entscheidung" value={state.sections.reviewItems.status==='ready'?`${state.reviewItemsNextCursor?'≥ ':''}${state.reviewItems.length}`:state.sections.reviewItems.status==='unavailable'?'Nicht verfügbar':'Wird geladen …'} notice action={go('pruefungen','Zeiten prüfen')}/>:null}
      {state.role!=='employee'&&administration.readQuotaAlerts?<Metric label="Kontingent im Monat" value={quota?`${quota.more?'≥ ':''}${quota.count} ${quota.count===1?'Hinweis':'Hinweise'}`:quotaFailed?'Nicht verfügbar':'Wird geladen …'} action={go('kunden','Kunden')}/>:null}
    </div>
    <div className="overview-columns"><div id="gerade-aktiv"><Panel title="Gerade aktiv">
      {summary?.status==='ready'?<>{summary.value.people.length?<DataTable label="Laufende Zeiten" headers={['Person','Standort','Kunde oder Projekt','Seit','Status']}>
        {summary.value.people.map(person=><tr key={person.membershipId}><td><a className="person-link" href={canonicalRoutePath({...defaultRoute('beschaeftigte',state.selectedLocation?.id??null),personId:person.membershipId})} onClick={event=>navigateFromLink(event,{...defaultRoute('beschaeftigte',state.selectedLocation?.id??null),personId:person.membershipId},navigate)}><Person name={person.displayName}/></a></td><td>{person.location?.name??'–'}</td><td>{person.runningTargetDisplayName??'–'}</td><td className="numeric">{person.runningSince?new Intl.DateTimeFormat('de-DE',{timeZone:BUSINESS_TIME_ZONE,hour:'2-digit',minute:'2-digit'}).format(new Date(person.runningSince)):'–'}</td><td><Pill kind={person.isRunning?'running':undefined}>{person.isRunning?'läuft':'Keine Zeit'}</Pill></td></tr>)}
      </DataTable>:<EmptyState>Gerade läuft keine Zeit.</EmptyState>}{summary.value.nextCursor?<p className="supporting">{go('beschaeftigte','Alle anzeigen')}</p>:null}</>:summary?.status==='unavailable'?<EmptyState action={<button className="text-button" onClick={()=>void administration.refreshManagedPeople?.(true)}>Erneut versuchen</button>}>{summary.message}</EmptyState>:<p>Aktivübersicht wird geladen …</p>}
    </Panel></div>{reviews?<Panel title="Zu entscheiden"><SectionBoundary state={state.sections.reviewItems} onRetry={()=>void administration.retrySection('reviewItems')}>{state.reviewItems.length?<ul className="decision-summary">{state.reviewItems.map(item=><li key={item.reviewItemId}><div><strong>{item.employeeDisplayName}</strong><span className="supporting"> · {new Intl.DateTimeFormat('de-DE',{timeZone:BUSINESS_TIME_ZONE,day:'2-digit',month:'2-digit'}).format(new Date(item.occurredAt))}</span><p>{reviewReasonLabel(item.reviewReason)}</p></div><Pill kind="notice">prüfen</Pill></li>)}</ul>:<EmptyState>Keine offenen Fälle.</EmptyState>}{go('pruefungen','Zeiten prüfen')}</SectionBoundary></Panel>:null}</div>
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
