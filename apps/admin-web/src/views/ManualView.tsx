import { useEffect,useState } from 'react';
import type { AdminWebCapability,AdminWebState } from '../contracts';
import { DelayedSkeleton } from '../ui';
export default function ManualView({state,administration}: {
  readonly state:Extract<AdminWebState,{status:'ready'}>;readonly administration:AdminWebCapability;
}) {
  const [selected,setSelected]=useState('');
  useEffect(()=>{void administration.loadWorkTargets?.();},[administration]);
  const targets=state.workTargets;
  const target=targets?.status === 'ready' ? targets.value.find(item=>`${item.targetType}:${item.targetId}` === selected) : undefined;
  const locked=state.manual?.pending ?? false;
  return <section className="manual-capture" aria-label="Manuell erfassen">
    <p className="supporting">Wählen Sie ein Arbeitsziel oder Pause. Ob Start oder Stopp erkennt Taptura selbst. Das Ereignis wird als manuell gekennzeichnet.</p>
    {targets?.status === 'ready' ? <fieldset disabled={locked}><legend>Arbeitsziel oder Pause</legend>
      {targets.value.map(item=><label className="target-choice" key={`${item.targetType}:${item.targetId}`}>
        <input type="radio" name="manual-target" value={`${item.targetType}:${item.targetId}`}
          checked={selected === `${item.targetType}:${item.targetId}`} onChange={event=>setSelected(event.target.value)}/>
        <span>{item.displayName}</span></label>)}
      <label className="target-choice"><input type="radio" name="manual-target" value="break" checked={selected === 'break'}
        onChange={()=>setSelected('break')}/><span>Pause</span></label>
      {targets.value.length === 0 ? <p>Es sind keine Arbeitsziele verfügbar. Wenden Sie sich an Ihre Betriebsverwaltung.</p> : null}
    </fieldset> : targets?.status === 'unavailable' ? <p role="status">{targets.message}</p> : <DelayedSkeleton label="Arbeitsziele werden geladen"/>}
    <button className="capture-primary" disabled={state.manual?.busy || (!locked && selected !== 'break' && target === undefined)}
      onClick={()=>{if(locked || selected === 'break') void administration.captureManual?.('break');else if(target) void administration.captureManual?.(target);}}>
      {state.manual?.busy ? 'Bestätigung wird angefordert …' : locked ? 'Bestätigung erneut abrufen' : 'Jetzt erfassen'}</button>
    {state.manual?.message ? <p className="feedback-band" role="status" aria-live="polite">{state.manual.message}</p> : null}
    <button className="quiet" disabled={locked} onClick={()=>void administration.loadWorkTargets?.()}>Arbeitsziele aktualisieren</button>
  </section>;
}
