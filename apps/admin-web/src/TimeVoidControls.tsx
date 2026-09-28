import {useContext,useEffect,useRef,useState} from 'react';
import {dayStart,shiftDay,formatZonedDateTime} from '@taptime/core';
import {VOID_REASONS,isVoidReason,type VoidReasonCode,type SafeOwnTimeRecord,type MobileOwnTimeQueryResponse,type VoidedTimeSelection} from '@taptime/mobile-work-contract';
import {TimeEditingContext} from './TimeEditingControls';
import {ResponsiveSheet} from './MobileSheet';
import {timeEditMessages} from './timeEditing';

export function VoidTimeForm({record,onClose}:{record:SafeOwnTimeRecord;onClose:()=>void}) {
  const context=useContext(TimeEditingContext)!;
  const [code,setCode]=useState<VoidReasonCode|''>(''),[text,setText]=useState(''),[error,setError]=useState(''),[saving,setSaving]=useState(false);
  const mounted=useRef(true);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  const save=async()=>{
    if(saving)return;
    if(!context.online||navigator.onLine===false){setError(timeEditMessages.offline);return;}
    const reasonText=code==='other'?text:null;
    if(!isVoidReason(code,reasonText)){setError('Wählen Sie einen Grund. Bei „Sonstiges“ sind 1 bis 500 Zeichen erforderlich.');return;}
    setSaving(true);setError('');
    try {
      const result=await context.administration.saveTimeEdit!({kind:'void',record,targetMembershipId:context.targetMembershipId,reasonCode:code as VoidReasonCode,reasonText});
      if(!mounted.current)return;
      if(result.status==='committed')onClose();else setError(timeEditMessages[result.status]);
    }catch{if(mounted.current)setError(timeEditMessages.unavailable);}
    finally{if(mounted.current)setSaving(false);}
  };
  return <ResponsiveSheet label="Zeiteintrag löschen" onCancel={onClose} busy={saving}>
    <form className="form-grid time-edit-form" aria-label="Zeiteintrag löschen" onSubmit={event=>{event.preventDefault();void save();}}>
      <h3 className="full-field">Zeiteintrag löschen</h3>
      <p className="full-field">Der Eintrag zählt danach nicht mehr. Er bleibt mit dem Grund in der Historie sichtbar. Das Löschen kann nicht rückgängig gemacht werden.</p>
      <label className="full-field">Grund<select aria-label="Grund" autoFocus value={code} disabled={saving} onChange={e=>setCode(e.target.value as VoidReasonCode|'')}>
        <option value="">Bitte auswählen</option>{Object.entries(VOID_REASONS).map(([value,label])=><option key={value} value={value}>{label}</option>)}
      </select></label>
      {code==='other'?<label className="full-field">Kurze Begründung<textarea aria-label="Kurze Begründung" value={text} disabled={saving} onChange={e=>setText(e.target.value)}/><small>1 bis 500 Zeichen</small></label>:null}
      {error?<p className="full-field field-error" role="alert">{error}</p>:null}
      {!context.online?<p role="status">Löschen geht nur online. Ihre Eingaben bleiben erhalten.</p>:null}
      <button disabled={saving} aria-busy={saving}>{saving?'Wird gelöscht …':'Löschen'}</button>
      <button type="button" className="quiet" disabled={saving} onClick={onClose}>Abbrechen</button>
    </form>
  </ResponsiveSheet>;
}

export function VoidedTimeRows({day,value}:{day:string;value:MobileOwnTimeQueryResponse}) {
  const context=useContext(TimeEditingContext);
  const load=context?.administration.loadVoidedTime,owner=context?.state.membershipId,target=context?.targetMembershipId;
  const [state,setState]=useState<VoidedTimeSelection|{status:'loading'}>({status:'loading'}),[reload,setReload]=useState(0);
  // Never render a previous person's/day's history while the next request loads.
  const key=`${owner}/${context?.state.role}/${target}/${day}`;
  const [loadedKey,setLoadedKey]=useState('');
  useEffect(()=>{
    let current=true;setLoadedKey('');setState({status:'loading'});
    const from=Math.max(dayStart(day),Date.parse(value.windowStartedAt)),to=Math.min(dayStart(shiftDay(day,1)),Date.parse(value.windowEndedAt));
    if(!load||!target||to<=from){setState({status:'ready',records:[]});setLoadedKey(key);return;}
    void load.call(context!.administration,target,new Date(from).toISOString(),new Date(to).toISOString())
      .then(result=>{if(current){setState(result);setLoadedKey(key);}}).catch(()=>{if(current){setState({status:'unavailable'});setLoadedKey(key);}});
    return()=>{current=false;};
  },[load,context?.administration,owner,target,day,key,value,reload]);
  if(!load)return null;
  if(loadedKey!==key||state.status==='loading')return <p className="supporting" role="status">Historie wird geladen …</p>;
  if(state.status!=='ready')return <p role="status">Die gelöschten Einträge konnten nicht geladen werden. <button className="quiet" onClick={()=>setReload(n=>n+1)}>Historie erneut laden</button></p>;
  return <ul className="time-day-list voided-time-list">{state.records.map(record=><li key={record.timeRecordId}>
    <strong>{record.targetDisplayName}</strong><p className="verbatim-reason">Gelöscht am {formatZonedDateTime(record.voidedAt)} von {record.actorDisplayName} · {VOID_REASONS[record.reasonCode]}{record.reasonText?`: ${record.reasonText}`:''}</p>
  </li>)}</ul>;
}
