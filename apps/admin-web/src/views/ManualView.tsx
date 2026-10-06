import { RequiredForm } from '../RequiredForm';
import { useEffect,useState } from 'react';
import { captureStatus, captureDuration } from '@taptime/mobile-work-contract';
import type { AdminWebCapability,AdminWebState } from '../contracts';
import { DelayedSkeleton } from '../ui';
export default function ManualView({state,administration}: {
  readonly state:Extract<AdminWebState,{status:'ready'}>;readonly administration:AdminWebCapability;
}) {
  const [selected,setSelected]=useState(''),[search,setSearch]=useState('');
  useEffect(()=>{
    void administration.loadWorkTargets?.();
    const month=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit'}).format(new Date());
    void administration.loadOwnTime?.(month);
  },[administration]);
  const targets=state.workTargets,calendar=state.calendar;
  const active=calendar?.status==='ready' && calendar.targetMembershipId===null ? calendar.value.activeRecord : null;
  const ownReady=calendar?.status==='ready' && calendar.targetMembershipId===null;
  const visibleTargets=targets?.status==='ready' ? targets.value.filter(item=>item.displayName.toLocaleLowerCase('de-DE').includes(search.trim().toLocaleLowerCase('de-DE'))) : [];
  const target=visibleTargets.find(item=>`${item.targetType}:${item.targetId}` === selected);
  useEffect(()=>{if(selected && !target)setSelected('');},[selected,target]);
  const locked=(state.manual?.pending ?? false) || (state.manual?.busy ?? false);
  return <section className="manual-capture" aria-label="Manuell erfassen">
    <p className="supporting">Die Zeit wird als manuell erfasst gekennzeichnet.</p>
    {!ownReady ? calendar?.status==='unavailable' ? <p role="status">{calendar.message}</p>
      : <DelayedSkeleton label="Ihre Zeiten werden geladen"/> : active ? <div className="feedback-band">
      <p>{captureStatus(active)}</p>
      {active.calendar ? <p>{captureDuration(active.calendar.workDurationSeconds)}</p> : null}
      <button className="capture-primary" disabled={locked} onClick={()=>void administration.captureManual?.(active.breakStartedAt?'break':'stop')}>
        {active.breakStartedAt?'Pause beenden':'Zeit beenden'}</button>
      <button disabled={locked} onClick={()=>void administration.captureManual?.(active.breakStartedAt?'stop':'break')}>
        {active.breakStartedAt?'Zeit beenden':'Pause starten'}</button>
    </div> : <RequiredForm onSubmit={event=>{event.preventDefault();if(target && !locked)void administration.captureManual?.(target);}}>
      {targets?.status === 'ready' ? <fieldset data-required-choice tabIndex={-1} data-field-error={target ? "" : "Bitte einen Kunden oder ein Projekt wählen."} disabled={locked}><legend>Wofür wird die Zeit erfasst?</legend><p>Kunde, Projekt oder allgemeine Arbeit</p>
        <label>Arbeitsziel suchen<input type="search" value={search} onChange={event=>setSearch(event.target.value)} placeholder="Kunde oder Projekt suchen"/></label>
        {(['customer','project','general_work'] as const).map(type=>{
          const visible=visibleTargets.filter(item=>item.targetType===type);
          return visible.length===0?null:<div key={type}><h3>{type==='customer'?'Kunden':type==='project'?'Projekte':'Allgemeine Arbeitszeit – ohne Kunde oder Projekt'}</h3>
            {visible.map(item=><button type="button" className="target-choice secondary" aria-pressed={selected===`${item.targetType}:${item.targetId}`} key={`${item.targetType}:${item.targetId}`}
              onClick={()=>setSelected(`${item.targetType}:${item.targetId}`)}>{item.displayName}</button>)}</div>;
        })}
        {visibleTargets.length===0 && search.trim() ? <p>Keine Arbeitsziele für ‚{search.trim()}‘ gefunden. <button type="button" onClick={()=>setSearch('')}>Suche löschen</button></p> : null}
        {targets.value.length===0 && !search.trim()?<p>Es sind keine Arbeitsziele verfügbar. Wenden Sie sich an Ihre Betriebsverwaltung.</p>:null}
      </fieldset> : targets?.status==='unavailable'?<p role="status">{targets.message}</p>:<DelayedSkeleton label="Arbeitsziele werden geladen"/>}
      <button className="capture-primary" disabled={locked}>{target ? `Zeit starten · ${target.displayName}` : 'Zeit starten'}</button>
    </RequiredForm>}
    {state.manual?.busy ? <p role="status">Bestätigung wird angefordert …</p> : state.manual?.pending ?
      <button className="capture-primary" onClick={()=>void administration.captureManual?.('break')}>Bestätigung erneut abrufen</button> : null}
    {state.manual?.message ? <p className="feedback-band" role="status" aria-live="polite">{state.manual.message}</p> : null}
    <button className="quiet" disabled={locked} onClick={()=>{void administration.loadWorkTargets?.();void administration.loadOwnTime?.(new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit'}).format(new Date()));}}>Erneut laden</button>
  </section>;
}
