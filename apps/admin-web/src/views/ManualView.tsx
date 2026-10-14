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
  const locked=!!targets?.busy || !!targets?.failed || (state.manual?.pending ?? false) || (state.manual?.busy ?? false);
  const assignedStartLocked=query===null&&!!target&&!visibleTargets.some(t=>t.targetType===target.targetType&&t.targetId===target.targetId)
    &&(assigned.state.busy||assigned.state.failed);
  return <section className="manual-capture" aria-label="Manuell erfassen">
    <p className="supporting">Die Zeit wird als manuell erfasst gekennzeichnet.</p>
    <SearchField value={search} onChange={setSearch}/>
    <p role="status">{targets?.status==='ready'?`${targets.nextCursor?'mehr als ':''}${targets.value.length} Treffer`:'Wird geladen …'}</p>
    {targets?.failed?<button type="button" onClick={()=>void administration.loadWorkTargets?.(query,targets.status==='ready')}>Erneut versuchen</button>:null}
    {!ownReady ? calendar?.status==='unavailable' ? <p role="status">{calendar.message}</p>
      : <DelayedSkeleton label="Ihre Zeiten werden geladen"/> : active ? <div className="feedback-band">
      <p>{captureStatus(active)}</p>
      {active.calendar ? <p>{captureDuration(active.calendar.workDurationSeconds)}</p> : null}
      <button className="capture-primary" disabled={locked} onClick={()=>void administration.captureManual?.(active.breakStartedAt?'break':'stop')}>
        {active.breakStartedAt?'Pause beenden':'Zeit beenden'}</button>
      <button disabled={locked} onClick={()=>void administration.captureManual?.(active.breakStartedAt?'stop':'break')}>
        {active.breakStartedAt?'Zeit beenden':'Pause starten'}</button>
    </div> : <RequiredForm onSubmit={event=>{event.preventDefault();if(target && !locked&&!assignedStartLocked)void administration.captureManual?.(target);}}>
      {targets?.status === 'ready' ? <fieldset data-required-choice tabIndex={-1} data-field-error={target ? "" : "Bitte einen Kunden oder ein Projekt wählen."} disabled={locked}><legend>Wofür wird die Zeit erfasst?</legend><p>Kunde, Projekt oder allgemeine Arbeit</p>
        {query===null&&assigned.state.failed?<SearchStatus state={assigned.state} onRetry={assigned.pager.retry}/>:null}
        {favorites.length?<div><h3>Meine Kunden und Projekte</h3><ul>{favorites.map(item=><li key={`${item.targetType}:${item.targetId}`}><button type="button" className="target-choice secondary" disabled={assigned.state.busy||assigned.state.failed} aria-pressed={selected===`${item.targetType}:${item.targetId}`} onClick={()=>setSelected(`${item.targetType}:${item.targetId}`)}>{item.displayName}</button></li>)}</ul>
          {assigned.state.nextCursor?<button type="button" disabled={assigned.state.busy} onClick={()=>void assigned.pager.loadMore()}>Weitere zugeordnete laden</button>:null}</div>:null}
        <h3>{query?'Treffer':'Alle Kunden und Projekte'}</h3>
        {(['customer','project','general_work'] as const).map(type=>{
          const visible=visibleTargets.filter(item=>item.targetType===type);
          return visible.length===0?null:<div key={type}><h3>{type==='customer'?'Kunden':type==='project'?'Projekte':'Allgemeine Arbeitszeit – ohne Kunde oder Projekt'}</h3>
            <ul>{visible.map(item=><li key={`${item.targetType}:${item.targetId}`}><button type="button" className="target-choice secondary" aria-pressed={selected===`${item.targetType}:${item.targetId}`} key={`${item.targetType}:${item.targetId}`}
              onClick={()=>setSelected(`${item.targetType}:${item.targetId}`)}>{targetLabel(item,query)}</button></li>)}</ul></div>;
        })}
        {visibleTargets.length===0 && search.trim() ? <p>{`Keine Treffer für „${query}“`} <button type="button" onClick={()=>setSearch('')}>Suche löschen</button></p> : null}
        {targets.value.length===0 && !search.trim()?<p>Es sind keine Arbeitsziele verfügbar. Wenden Sie sich an Ihre Betriebsverwaltung.</p>:null}
        {targets.nextCursor?<button type="button" disabled={targets.busy} onClick={()=>void administration.loadWorkTargets?.(query,true)}>Weitere laden</button>:null}
      </fieldset> : targets?.status==='unavailable'?<p role="status">{targets.message}</p>:<DelayedSkeleton label="Arbeitsziele werden geladen"/>}
      <div className="manual-start-bar"><button className="capture-primary" disabled={locked||assignedStartLocked}>{target ? `Zeit starten · ${target.displayName}` : 'Zeit starten'}</button></div>
    </RequiredForm>}
    {state.manual?.busy ? <p role="status">Bestätigung wird angefordert …</p> : state.manual?.pending ?
      <button className="capture-primary" onClick={()=>void administration.captureManual?.('break')}>Bestätigung erneut abrufen</button> : null}
    {state.manual?.message ? <p className="feedback-band" role="status" aria-live="polite">{state.manual.message}</p> : null}
    <button className="quiet" disabled={locked} onClick={()=>{void administration.loadWorkTargets?.(query);void administration.loadOwnTime?.(new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit'}).format(new Date()));}}>Erneut versuchen</button>
  </section>;
}
