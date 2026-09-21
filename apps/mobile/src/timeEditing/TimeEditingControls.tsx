import { createContext, useContext, useState, useSyncExternalStore, type ReactNode } from 'react';
import { View } from 'react-native';
import { BUSINESS_TIME_ZONE, parseZonedLocalTimestamp, toZonedLocalInput, shiftDay } from '@taptime/core';
import type { SafeOwnTimeRecord, SafeWorkTarget } from '@taptime/mobile-work-contract';
import type { MobileWorkCapability } from '../work/contracts';
import { ActionButton, AppText as Text, Card, TextField } from '../design/primitives';
import type { TimeEditKind, TimeEditResult, TimeEditingCapability } from './TimeEditingCoordinator';

export interface TimeEditingContextValue {
  readonly capability:TimeEditingCapability;
  readonly membershipId:string;
  readonly role:'employee'|'administrator'|'standortleitung';
  readonly targets:readonly SafeWorkTarget[];
  readonly online:boolean;
  readonly busy:boolean;
}
export const TimeEditingContext=createContext<TimeEditingContextValue|null>(null);
const inactive={status:'inactive'} as const;
const offline={online:false,busy:false};
const noSubscribe=()=>()=>{};
export function TimeEditingProvider({capability,work,membershipId,role,children}:{capability?:TimeEditingCapability;work?:MobileWorkCapability;membershipId:string;role:TimeEditingContextValue['role'];children:ReactNode}) {
  const state=useSyncExternalStore(capability?.subscribe??noSubscribe,capability?.getState??(()=>offline),()=>offline);
  const workState=useSyncExternalStore(work?(l)=>work.subscribe(l):noSubscribe,()=>work?.getState()??inactive,()=>inactive);
  return <TimeEditingContext.Provider value={capability?{capability,membershipId,role,targets:workState.status==='ready'?workState.targets.targets:[],...state}:null}>{children}</TimeEditingContext.Provider>;
}
const messages:Record<TimeEditResult['status'],string>={
  committed:'Gespeichert.',offline:'Zeit hinzufügen und ändern geht nur online. Deine Eingaben bleiben erhalten.',busy:'Ein Eintrag wird noch gespeichert.',
  authority_rejected:'Deine Berechtigung ist nicht mehr gültig. Aktualisiere deine Sitzung.',invalid_request:'Prüfe Datum, Uhrzeiten und die Texte (höchstens 500 Zeichen).',
  invalid_interval:'Die Zeit muss beendet sein, in der Vergangenheit liegen und darf höchstens 24 Stunden dauern.',outside_window:'Du kannst Zeiten im laufenden Monat und im Vormonat nachtragen.',
  reason_required:'Bitte begründe den Nachtrag.',invalid_comment:'Der Kommentar braucht 1 bis 500 Zeichen.',overlap:'Die Zeit überschneidet sich mit einem anderen Eintrag. Prüfe deine Zeiten.',
  command_id_conflict:'Dieser Speichervorgang wurde bereits mit anderen Angaben verwendet. Aktualisiere die Ansicht.',unavailable:'Die Speicherung konnte nicht bestätigt werden. Versuche es erneut; deine Eingaben bleiben erhalten.',
  conflict:'Der Eintrag wurde inzwischen geändert. Aktualisiere die Ansicht.',not_adjustable:'Dieser Eintrag kann nicht geändert werden. Aktualisiere die Ansicht.',
};
export function AddTimeControl({day,targetMembershipId,onSaved}:{day:string;targetMembershipId?:string;onSaved:()=>Promise<void>}) {
  const context=useContext(TimeEditingContext);
  const [open,setOpen]=useState(false);
  if(!context || context.role==='standortleitung') return null;
  return <Card><ActionButton title="Zeit hinzufügen" disabled={!context.online || context.busy} onPress={()=>setOpen(true)} />
    {!context.online?<Text>Nur online möglich. Verbinde dich mit dem Internet, um Zeit nachzutragen.</Text>:null}
    {open?<TimeEditForm kind="backfill" day={day} targetMembershipId={targetMembershipId??context.membershipId} onSaved={onSaved} onClose={()=>setOpen(false)} />:null}
  </Card>;
}
export function TimeRecordControls({record,targetMembershipId,onSaved}:{record:SafeOwnTimeRecord;targetMembershipId?:string;onSaved:()=>Promise<void>}) {
  const context=useContext(TimeEditingContext);
  const [form,setForm]=useState<'comment'|'correct'|null>(null);
  const details=record.details;
  const own=context && context.role!=='standortleitung' && (targetMembershipId===undefined || targetMembershipId===context.membershipId);
  return <View style={{gap:8}}>
    {details?.overlapsAnotherRecord?<Text accessibilityRole="alert">überschneidet sich</Text>:null}
    {details?.change?<Text>{details.changed?'Geändert':details.origin==='backfilled'?'Nachgetragen':'Wiederhergestellt'} · {new Intl.DateTimeFormat('de-DE',{dateStyle:'short',timeStyle:'short',timeZone:BUSINESS_TIME_ZONE}).format(new Date(details.change.at))} · {details.change.actor==='self'?'durch Beschäftigten':'durch Verwaltung'}: {details.change.reason}</Text>:null}
    {details?.comment?<Text>Kommentar: {details.comment}</Text>:null}
    {own && details?<ActionButton title="Kommentar schreiben" tone="quiet" disabled={!context?.online || context.busy} onPress={()=>setForm('comment')} />:null}
    {context?.role==='administrator' && details ? record.status==='stopped'
      ? <ActionButton title="Ändern" tone="quiet" disabled={!context.online || context.busy} onPress={()=>setForm('correct')} />
      : <Text>Läuft noch — erst beenden, dann ändern</Text> : null}
    {form && context?<TimeEditForm kind={form} record={record} targetMembershipId={targetMembershipId??context.membershipId} onSaved={onSaved} onClose={()=>setForm(null)} />:null}
  </View>;
}
function TimeEditForm({kind,day,record,targetMembershipId,onSaved,onClose}:{kind:TimeEditKind;day?:string;record?:SafeOwnTimeRecord;targetMembershipId:string;onSaved:()=>Promise<void>;onClose:()=>void}) {
  const context=useContext(TimeEditingContext)!;
  const [target,setTarget]=useState<SafeWorkTarget|null>(null);
  const [date,setDate]=useState(day??'');
  const [start,setStart]=useState(record?toZonedLocalInput(record.startedAt):'08:00');
  const [end,setEnd]=useState(record?.stoppedAt?toZonedLocalInput(record.stoppedAt):'17:00');
  const [comment,setComment]=useState(kind==='comment'?record?.details?.comment??'':'');
  const [reason,setReason]=useState('');
  const [notice,setNotice]=useState('');
  const [saving,setSaving]=useState(false);
  const save=async()=>{
    if(saving) return;
    if(!context.online) {setNotice(messages.offline);return;}
    const input:Record<string,unknown>={};
    if(kind==='comment') {input.timeRecordId=record!.timeRecordId;input.comment=comment;}
    else {
      const from=kind==='backfill'?`${date}T${start}`:start;
      if(!parseZonedLocalTimestamp(from)) {setNotice('Prüfe Datum und Uhrzeiten in Europe/Berlin. Eine nicht eindeutige Uhrzeit bei der Zeitumstellung kann nicht übernommen werden.');return;}
      const to=kind==='backfill'?`${end<=start?shiftDay(date,1):date}T${end}`:end;
      const startedAt=parseZonedLocalTimestamp(from),stoppedAt=parseZonedLocalTimestamp(to);
      if(!startedAt || !stoppedAt) {setNotice('Prüfe Datum und Uhrzeiten in Europe/Berlin. Eine nicht eindeutige Uhrzeit bei der Zeitumstellung kann nicht übernommen werden.');return;}
      Object.assign(input,{startedAt,stoppedAt,reason:context.role==='administrator'?reason:null});
      if(kind==='backfill') {
        if(!target) {setNotice('Wähle einen Kunden oder ein Projekt.');return;}
        Object.assign(input,{targetMembershipId,targetType:target.targetType,targetId:target.targetId,comment:context.role==='employee'&&comment.trim()?comment:null});
      } else Object.assign(input,{timeRecordId:record!.timeRecordId,expectedBaseRowVersion:record!.details!.baseRowVersion,expectedRevisionNumber:record!.details!.effectiveRevisionNumber});
    }
    setSaving(true);
    try {
      const result=await context.capability.save(kind,input);setNotice(messages[result.status]);
      if(result.status==='committed') {onClose();await onSaved();}
    } finally {setSaving(false);}
  };
  const field=(label:string,value:string,set:(s:string)=>void,multiline=false)=><View style={{gap:4}}><Text>{label}</Text><TextField accessibilityLabel={label} value={value} onChangeText={set} multiline={multiline} editable={!saving} /></View>;
  return <View style={{gap:12}}>
    {kind==='backfill'?<><Text accessibilityRole="header">Kunde oder Projekt</Text>
      {context.targets.map(t=><ActionButton key={`${t.targetType}/${t.targetId}`} title={`${target===t?'✓ ':''}${t.displayName}`} tone="quiet" disabled={saving} onPress={()=>setTarget(t)} />)}
      {context.targets.length===0?<Text>Arbeitsziele sind noch nicht geladen. Aktualisiere die Ansicht.</Text>:null}
      {field('Datum (JJJJ-MM-TT)',date,setDate)}</>:null}
    {kind!=='comment'?<>{field(kind==='backfill'?'Von (HH:MM)':'Von (JJJJ-MM-TTTHH:MM)',start,setStart)}
      {field(kind==='backfill'?'Bis (HH:MM)':'Bis (JJJJ-MM-TTTHH:MM)',end,setEnd)}
      <Text>Europe/Berlin{kind==='backfill'?' · Liegt „bis“ vor oder gleich „von“, endet die Zeit am Folgetag. Pausen bitte als Lücke zwischen zwei Einträgen lassen.':''}</Text></>:null}
    {kind==='comment'||(kind==='backfill'&&context.role==='employee')?field(kind==='comment'?'Kommentar':'Kommentar (optional)',comment,setComment,true):null}
    {kind!=='comment'&&context.role==='administrator'?field('Grund',reason,setReason,true):null}
    {notice?<Text accessibilityRole="alert">{notice}</Text>:null}
    {!context.online?<Text>Nur online möglich. Deine Eingaben bleiben erhalten.</Text>:null}
    <ActionButton title={saving?'Wird gespeichert …':'Speichern'} loading={saving} disabled={saving||!context.online} onPress={()=>{void save();}} />
    <ActionButton title="Abbrechen" tone="quiet" disabled={saving} onPress={onClose} />
  </View>;
}
