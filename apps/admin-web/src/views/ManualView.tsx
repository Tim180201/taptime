import {businessDay} from '@taptime/core';
import {PageHeader} from '../PageHeader';
import {DataTable,EmptyState,Panel,Pill} from '../ui';
import {useAssignedTargets,combineTargets,targetLabel} from '../../../mobile/src/search/useAssignedTargets';
import {SearchStatus} from '../SearchControls';
import {SearchField} from '../SearchControls';
import {useDebouncedSearch} from '../../../mobile/src/search/useSearchPages';
import { RequiredForm } from '../RequiredForm';
import { useEffect,useState } from 'react';
import { captureStatus, captureDuration } from '@taptime/mobile-work-contract';
import type { AdminWebCapability,AdminWebState } from '../contracts';
import { DelayedSkeleton } from '../ui';
export default function ManualView({state,administration}: {
  readonly state:Extract<AdminWebState,{status:'ready'}>;readonly administration:AdminWebCapability;
}) {
  const [selected,setSelected]=useState(''),[search,setSearch]=useState('');
  const query=useDebouncedSearch(search);
  useEffect(()=>{void administration.loadWorkTargets?.(query);},[administration,query]);
  useEffect(()=>{
    const month=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit'}).format(new Date());
    void administration.loadOwnTime?.(month);
  },[administration]);
  const assigned=useAssignedTargets(administration,null,query,[state.membershipId,state.role,JSON.stringify(state.managementScope),state.selectedLocation?.id]);
  const favorites=query===null?assigned.state.items:[];
  const targets=state.workTargets,calendar=state.calendar;
  const active=calendar?.status==='ready' && calendar.targetMembershipId===null ? calendar.value.activeRecord : null;
  const ownReady=calendar?.status==='ready' && calendar.targetMembershipId===null;
  const visibleTargets=targets?.status==='ready' ? targets.value : [];
  const target=combineTargets(visibleTargets,favorites).find(item=>`${item.targetType}:${item.targetId}` === selected);
  useEffect(()=>{if(targets?.status==='ready'&&!targets.busy&&!targets.failed&&!assigned.state.busy&&selected && !target)setSelected('');},[selected,target,targets]);
  const captureLocked=(state.manual?.pending ?? false)||(state.manual?.busy ?? false);
  const locked=!!targets?.busy||!!targets?.failed||captureLocked;
  const assignedStartLocked=query===null&&!!target&&!visibleTargets.some(t=>t.targetType===target.targetType&&t.targetId===target.targetId)
    &&(assigned.state.busy||assigned.state.failed);
  const choose=(item:(typeof visibleTargets)[number])=><button type="button" className="target-choice secondary" disabled={locked||!!active} aria-pressed={selected===`${item.targetType}:${item.targetId}`} onClick={()=>setSelected(`${item.targetType}:${item.targetId}`)}><span>{targetLabel(item,query)}</span>{selected===`${item.targetType}:${item.targetId}`?<span className="selected-tick" aria-hidden="true">✓</span>:null}</button>;
  const weekStart=new Date(`${businessDay(Date.now())}T12:00:00Z`);weekStart.setUTCDate(weekStart.getUTCDate()-(weekStart.getUTCDay()+6)%7);
  const weekComplete=ownReady&&calendar.value.nextCursor===null&&!!calendar.value.windowStartedAt&&businessDay(Date.parse(calendar.value.windowStartedAt))<=weekStart.toISOString().slice(0,10);
  const records=ownReady?calendar.value.records.filter(record=>(record.startedVia==='manual'||record.details?.origin==='manual')&&businessDay(Date.parse(record.startedAt))>=weekStart.toISOString().slice(0,10)):[];
  return <section className="manual-capture" aria-label="Manuell erfassen">
    <PageHeader organization={state.projection?.organization.name} title="Manuell" refreshDisabled={captureLocked||!!targets?.busy} subtitle="Die Zeit wird als manuell erfasst gekennzeichnet." actions={ownReady?<Pill kind={active?'running':undefined}>{active?'läuft':'Keine Zeit läuft'}</Pill>:undefined} onRefresh={()=>{void administration.refresh?.();void administration.loadWorkTargets?.(query);void administration.loadOwnTime?.(businessDay(Date.now()).slice(0,7));}}/>
    <RequiredForm className="manual-steps" onSubmit={event=>{event.preventDefault();if(ownReady&&target&&!locked&&!assignedStartLocked&&!active)void administration.captureManual?.(target);}}>
      <section className="panel manual-choice"><h2>1 · Wofür?</h2>
        <fieldset data-required-choice tabIndex={-1} data-field-error={active||target?'':'Bitte einen Kunden oder ein Projekt wählen.'} disabled={captureLocked||!!active}><legend className="sr-only">Wofür wird die Zeit erfasst?</legend>
          <SearchField value={search} onChange={setSearch} disabled={captureLocked||!!active}/>
          {query===null&&assigned.state.failed?<SearchStatus state={assigned.state} onRetry={assigned.pager.retry}/>:null}
          {targets?.failed?<button type="button" className="text-button" disabled={captureLocked||!!targets.busy} onClick={()=>void administration.loadWorkTargets?.(query,targets.status==='ready')}>Erneut versuchen</button>:null}
          {targets?.status==='ready'?<>
            {favorites.length?<><h3>Meine Kunden und Projekte</h3><ul className="target-list">{favorites.map(item=><li key={`${item.targetType}:${item.targetId}`}>{choose(item)}</li>)}</ul>{assigned.state.nextCursor?<button type="button" className="text-button" disabled={assigned.state.busy} onClick={()=>void assigned.pager.loadMore()}>Weitere zugeordnete laden</button>:null}<p className="supporting">Weitere Kunden und Projekte über die Suche</p>{visibleTargets.filter(item=>item.targetType==='general_work').map(item=><div key={item.targetId}>{choose(item)}</div>)}</>:<><h3>{query?'Treffer':'Alle Kunden und Projekte'}</h3>
              {(['customer','project','general_work'] as const).map(type=>{const visible=visibleTargets.filter(item=>item.targetType===type);return visible.length?<div key={type}><h3>{type==='customer'?'Kunden':type==='project'?'Projekte':'Allgemeine Arbeitszeit – ohne Kunde oder Projekt'}</h3><ul className="target-list">{visible.map(item=><li key={`${item.targetType}:${item.targetId}`}>{choose(item)}</li>)}</ul></div>:null;})}
              {visibleTargets.length===0&&search.trim()?<EmptyState action={<button type="button" className="text-button" onClick={()=>setSearch('')}>Suche löschen</button>}>{`Keine Treffer für „${query}“`}</EmptyState>:null}
              {visibleTargets.length===0&&!search.trim()?<EmptyState>Es sind keine Kunden oder Projekte verfügbar. Wenden Sie sich an Ihre Betriebsverwaltung.</EmptyState>:null}
              {targets.nextCursor?<button type="button" className="text-button" disabled={targets.busy} onClick={()=>void administration.loadWorkTargets?.(query,true)}>Weitere laden</button>:null}
            </>}
          </>:targets?.status==='unavailable'?<p role="status">{targets.message}</p>:<DelayedSkeleton label="Kunden und Projekte werden geladen"/>}
        </fieldset>
      </section>
      <section className="panel manual-action"><h2>2 · Starten</h2>
        {!ownReady?calendar?.status==='unavailable'?<p role="status">{calendar.message}</p>:<DelayedSkeleton label="Ihre Zeiten werden geladen"/>:active?<>
          <strong className="target-name">{active.targetDisplayName}</strong><p>{captureStatus(active)}</p>{active.calendar?<p className="manual-clock">{captureDuration(active.calendar.workDurationSeconds)}</p>:null}
          <button type="button" className="primary-action" disabled={captureLocked} onClick={()=>void administration.captureManual?.('stop')}>Zeit beenden</button>
          <button type="button" className="secondary" disabled={captureLocked} onClick={()=>void administration.captureManual?.('break')}>{active.breakStartedAt?'Pause beenden':'Pause starten'}</button>
        </>:<>
          {target?<><strong className="target-name">{target.displayName}</strong><time className="manual-clock">{new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',hour:'2-digit',minute:'2-digit'}).format(new Date())}</time><p className="supporting">Start jetzt · als manuell gekennzeichnet</p></>:<EmptyState>Wählen Sie links einen Kunden oder ein Projekt.</EmptyState>}
          <div className="manual-start-bar"><button className={target?'primary-action':'secondary'} aria-label={target?`Zeit starten · ${target.displayName}`:'Zeit starten'} disabled={locked||assignedStartLocked}>Zeit starten</button></div>
        </>}
      </section>
    </RequiredForm>
    {state.manual?.busy?<p className="notice" role="status">Bestätigung wird angefordert …</p>:state.manual?.pending?<div className="notice"><button className="text-button" onClick={()=>void administration.captureManual?.('break')}>Bestätigung erneut abrufen</button></div>:null}
    {state.manual?.message?<p className="notice" role="status" aria-live="polite">{state.manual.message}</p>:null}
    <Panel title="Zuletzt manuell" description="Diese Woche">{records.length?<DataTable label="Zuletzt manuell" headers={['Kunde oder Projekt','Beginn','Ende']}>
      {records.map(record=><tr key={record.timeRecordId}><td>{record.targetDisplayName}</td><td>{new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(record.startedAt))}</td><td>{record.stoppedAt?new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',hour:'2-digit',minute:'2-digit'}).format(new Date(record.stoppedAt)):<Pill kind="running">läuft</Pill>}</td></tr>)}
    </DataTable>:<EmptyState>{weekComplete?'Diese Woche noch keine manuell gestartete Zeit.':'Ihre Zeiten finden Sie unter „Meine Zeiten“.'}</EmptyState>}</Panel>
  </section>;
}
