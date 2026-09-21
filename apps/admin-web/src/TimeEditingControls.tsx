import { createContext,useContext,useEffect,useRef,useState,type ReactNode } from 'react';
import { BUSINESS_TIME_ZONE,formatZonedDateTime,parseZonedLocalTimestamp,shiftDay,toZonedLocalInput } from '@taptime/core';
import type { SafeOwnTimeRecord,SafeWorkTarget } from '@taptime/mobile-work-contract';
import type { AdminWebCapability,AdminWebState } from './contracts';
import { timeEditMessages,type TimeEditInput } from './timeEditing';

type ReadyState=Pick<Extract<AdminWebState,{status:'ready'}>,'role'|'membershipId'|'timeEditBusy'|'workTargets'>;
type Context={state:ReadyState;administration:AdminWebCapability;targetMembershipId:string;online:boolean};
const TimeEditingContext=createContext<Context|null>(null);
export function TimeEditingProvider({state,administration,targetMembershipId,children}:{state:ReadyState;administration:AdminWebCapability;targetMembershipId?:string;children:ReactNode}) {
  const [online,setOnline]=useState(()=>navigator.onLine);
  useEffect(()=>{const update=()=>setOnline(navigator.onLine);window.addEventListener('online',update);window.addEventListener('offline',update);return()=>{window.removeEventListener('online',update);window.removeEventListener('offline',update);};},[]);
  useEffect(()=>{if(state.role!=='standortleitung') void administration.loadWorkTargets?.();},[administration,state.role]);
  return <TimeEditingContext.Provider value={state.membershipId?{state,administration,targetMembershipId:targetMembershipId??state.membershipId,online}:null}>{children}</TimeEditingContext.Provider>;
}
export function AddTimeControl({day}:{day:string}) {
  const context=useContext(TimeEditingContext),[open,setOpen]=useState(false),button=useRef<HTMLButtonElement>(null);
  if(!context || context.state.role==='standortleitung' || !context.administration.saveTimeEdit) return null;
  const close=()=>{setOpen(false);button.current?.focus();};
  return <div className="time-edit-controls">
    <button ref={button} disabled={!context.online||context.state.timeEditBusy} onClick={()=>setOpen(true)}>Zeit hinzufügen</button>
    {!context.online?<p role="status">Nur online möglich. Verbinden Sie sich mit dem Internet, um Zeit nachzutragen.</p>:null}
    {open?<TimeEditForm kind="backfill" day={day} onClose={close}/>:null}
  </div>;
}
export function TimeRecordControls({record}:{record:SafeOwnTimeRecord}) {
  const context=useContext(TimeEditingContext),[form,setForm]=useState<'comment'|'correct'|null>(null);
  const opener=useRef<HTMLButtonElement|null>(null);
  const own=context && context.state.role!=='standortleitung' && context.targetMembershipId===context.state.membershipId;
  const canEdit=context?.state.role==='administrator';
  const details=record.details;
  const close=()=>{setForm(null);opener.current?.focus();};
  return <div className="time-edit-controls">
    {details?.overlapsAnotherRecord?<p className="time-overlap">überschneidet sich</p>:null}
    {details?.change?<p className="verbatim-reason">{details.changed?'Geändert':details.origin==='backfilled'?'Nachgetragen':'Wiederhergestellt'} · {formatZonedDateTime(details.change.at)} · {details.change.actor==='self'?'durch Beschäftigten':'durch Verwaltung'}: {details.change.reason}</p>:null}
    {details?.comment?<p className="verbatim-reason">Kommentar: {details.comment}</p>:null}
    {own && details && context.administration.saveTimeEdit?<button className="quiet" disabled={!context.online||context.state.timeEditBusy} onClick={e=>{opener.current=e.currentTarget;setForm('comment');}}>Kommentar schreiben</button>:null}
    {canEdit && details && context.administration.saveTimeEdit && record.status==='stopped'?<button className="quiet" disabled={!context.online||context.state.timeEditBusy} onClick={e=>{opener.current=e.currentTarget;setForm('correct');}}>Ändern</button>:null}
    {record.status==='started'?<p>Läuft noch — erst beenden, dann ändern</p>:null}
    {form?<TimeEditForm kind={form} record={record} onClose={close}/>:null}
  </div>;
}
function TimeEditForm({kind,day,record,onClose}:{kind:TimeEditInput['kind'];day?:string;record?:SafeOwnTimeRecord;onClose:()=>void}) {
  const context=useContext(TimeEditingContext)!;
  const [date,setDate]=useState(day??'');
  const [start,setStart]=useState(record?toZonedLocalInput(record.startedAt):'08:00');
  const [end,setEnd]=useState(record?.stoppedAt?toZonedLocalInput(record.stoppedAt):'17:00');
  const [selected,setSelected]=useState(''),[comment,setComment]=useState(kind==='comment'?record?.details?.comment??'':'');
  const [reason,setReason]=useState(''),[notice,setNotice]=useState(''),[saving,setSaving]=useState(false);
  const form=useRef<HTMLFormElement>(null),mounted=useRef(true);
  useEffect(()=>{mounted.current=true;form.current?.querySelector<HTMLElement>('select,input,textarea')?.focus();return()=>{mounted.current=false;};},[]);
  const targets=context.state.workTargets;
  const target:SafeWorkTarget|undefined=targets?.status==='ready'?targets.value.find(t=>`${t.targetType}:${t.targetId}`===selected):undefined;
  const administrator=context.state.role==='administrator';
  const save=async()=>{
    if(saving) return;
    if(!context.online || navigator.onLine===false){setNotice(timeEditMessages.offline);return;}
    let input:TimeEditInput;
    if(kind==='comment') input={kind,record:record!,targetMembershipId:context.targetMembershipId,comment};
    else {
      const startedAt=parseZonedLocalTimestamp(kind==='backfill'?`${date}T${start}`:start);
      const stoppedAt=startedAt?parseZonedLocalTimestamp(kind==='backfill'?`${end<=start?shiftDay(date,1):date}T${end}`:end):null;
      if(!startedAt || !stoppedAt){setNotice('Prüfen Sie Datum und Uhrzeiten in Europe/Berlin. Nicht eindeutige Zeiten bei der Zeitumstellung können nicht übernommen werden.');return;}
      if(kind==='backfill') {
        if(!target){setNotice('Wählen Sie einen Kunden oder ein Projekt.');return;}
        input={kind,targetMembershipId:context.targetMembershipId,target,startedAt,stoppedAt,reason:administrator?reason:null,comment:!administrator&&comment.trim()?comment:null};
      } else input={kind,record:record!,targetMembershipId:context.targetMembershipId,startedAt,stoppedAt,reason};
    }
    setSaving(true);
    try {
      const result=await context.administration.saveTimeEdit!(input);
      if(!mounted.current)return;
      if(result.status==='committed') onClose();else setNotice(timeEditMessages[result.status]);
    } catch {if(mounted.current)setNotice(timeEditMessages.unavailable);}
    finally {if(mounted.current)setSaving(false);}
  };
  return <form ref={form} className="form-grid time-edit-form" aria-label={kind==='backfill'?'Zeit hinzufügen':kind==='comment'?'Kommentar schreiben':'Zeit ändern'} onSubmit={e=>{e.preventDefault();void save();}}>
    {kind==='backfill'?<><label>Kunde oder Projekt<select required value={selected} disabled={saving} onChange={e=>setSelected(e.target.value)}><option value="">Bitte auswählen</option>{targets?.status==='ready'?targets.value.map(t=><option key={`${t.targetType}:${t.targetId}`} value={`${t.targetType}:${t.targetId}`}>{t.displayName}</option>):null}</select></label>
      {targets?.status!=='ready'?<p role="status">{targets?.status==='unavailable'?targets.message:'Arbeitsziele werden geladen.'} <button type="button" className="quiet" disabled={saving} onClick={()=>void context.administration.loadWorkTargets?.()}>Arbeitsziele erneut laden</button></p>:targets.value.length===0?<p>Es sind keine Arbeitsziele verfügbar.</p>:null}
      <label>Datum<input type="date" required value={date} disabled={saving} onChange={e=>setDate(e.target.value)}/></label></>:null}
    {kind!=='comment'?<><label>Von<input required type={kind==='backfill'?'time':'datetime-local'} step={kind==='backfill'?'60':'0.001'} value={start} disabled={saving} onChange={e=>setStart(e.target.value)}/></label>
      <label>Bis<input required type={kind==='backfill'?'time':'datetime-local'} step={kind==='backfill'?'60':'0.001'} value={end} disabled={saving} onChange={e=>setEnd(e.target.value)}/></label>
      <p className="full-field supporting">{BUSINESS_TIME_ZONE}{kind==='backfill'?' · Liegt „bis“ vor oder gleich „von“, endet die Zeit am Folgetag. Pausen bitte als Lücke zwischen zwei Einträgen lassen.':''}</p></>:null}
    {kind==='comment'||(kind==='backfill'&&!administrator)?<label className="full-field">{kind==='comment'?'Kommentar':'Kommentar (optional)'}<textarea required={kind==='comment'} value={comment} disabled={saving} onChange={e=>setComment(e.target.value)}/></label>:null}
    {kind!=='comment'&&administrator?<label className="full-field">Grund<textarea required value={reason} disabled={saving} onChange={e=>setReason(e.target.value)}/></label>:null}
    {notice?<p className="full-field field-error" role="alert">{notice}</p>:null}
    {!context.online?<p role="status">Nur online möglich. Ihre Eingaben bleiben erhalten.</p>:null}
    <button disabled={saving||!context.online} aria-busy={saving}>{saving?'Wird gespeichert …':'Speichern'}</button>
    <button className="quiet" type="button" disabled={saving} onClick={onClose}>Abbrechen</button>
  </form>;
}
