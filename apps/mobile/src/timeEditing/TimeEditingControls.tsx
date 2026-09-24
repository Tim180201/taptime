import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { View } from 'react-native';
import { BUSINESS_TIME_ZONE, parseZonedLocalTimestamp, toZonedLocalInput, shiftDay } from '@taptime/core';
import { awaitAdministrationStopArchive, ADMINISTRATION_ARCHIVE_PENDING, ADMINISTRATION_ARCHIVE_TIMEOUT, administrationStopMessage, isAdministrationStopResult, type BackfillTargetSelection, type SafeOwnTimeRecord, type SafeWorkTarget } from '@taptime/mobile-work-contract';
import type { MobileManagementScope } from '../auth/contracts';
import type { MobileWorkCapability } from '../work/contracts';
import { ActionButton, AppText as Text, Card, TextField } from '../design/primitives';
import type { TimeEditKind, TimeEditResult, TimeEditingCapability } from './TimeEditingCoordinator';

export interface TimeEditingContextValue {
  readonly capability:TimeEditingCapability;
  readonly membershipId:string;
  readonly role:'employee'|'administrator'|'standortleitung';
  readonly managementScope?: MobileManagementScope | null;
  readonly targets:readonly SafeWorkTarget[];
  readonly online:boolean;
  readonly busy:boolean;
}
export const TimeEditingContext=createContext<TimeEditingContextValue|null>(null);
const inactive={status:'inactive'} as const;
const offline={online:false,busy:false};
const noSubscribe=()=>()=>{};
export function TimeEditingProvider({capability,work,membershipId,role,managementScope,children}:{capability?:TimeEditingCapability;work?:MobileWorkCapability;membershipId:string;role:TimeEditingContextValue['role'];managementScope?:MobileManagementScope|null;children:ReactNode}) {
  const state=useSyncExternalStore(capability?.subscribe??noSubscribe,capability?.getState??(()=>offline),()=>offline);
  const workState=useSyncExternalStore(work?(l)=>work.subscribe(l):noSubscribe,()=>work?.getState()??inactive,()=>inactive);
  return <TimeEditingContext.Provider value={capability?{capability,membershipId,role,managementScope,targets:workState.status==='ready'?workState.targets.targets:[],...state}:null}>{children}</TimeEditingContext.Provider>;
}
const messages:Record<TimeEditResult['status'],string>={
  end_before_break:'Die Endzeit liegt vor einer erfassten Pause.',
  committed:'Gespeichert.',offline:'Zeit hinzufügen und ändern geht nur online. Deine Eingaben bleiben erhalten.',busy:'Ein Eintrag wird noch gespeichert.',
  authority_rejected:'Deine Berechtigung ist nicht mehr gültig. Aktualisiere deine Sitzung.',invalid_request:'Prüfe Datum, Uhrzeiten und die Texte (höchstens 500 Zeichen).',
  invalid_interval:'Die Zeit muss beendet sein, in der Vergangenheit liegen und darf höchstens 24 Stunden dauern.',outside_window:'Du kannst Zeiten im laufenden Monat und im Vormonat nachtragen.',
  reason_required:'Bitte begründe den Nachtrag.',invalid_comment:'Der Kommentar braucht 1 bis 500 Zeichen.',overlap:'Die Zeit überschneidet sich mit einem anderen Eintrag. Prüfe deine Zeiten.',
  command_id_conflict:'Dieser Speichervorgang wurde bereits mit anderen Angaben verwendet. Aktualisiere die Ansicht.',unavailable:'Die Speicherung konnte nicht bestätigt werden. Versuche es erneut; deine Eingaben bleiben erhalten.',
  conflict:'Der Eintrag wurde inzwischen geändert. Aktualisiere die Ansicht.',not_adjustable:'Dieser Eintrag kann nicht geändert werden. Aktualisiere die Ansicht.',
};
function canManageTime(context:TimeEditingContextValue) {
  return context.role==='administrator' || (context.role==='standortleitung' && context.managementScope!=null);
}
export function AddTimeControl({day,targetMembershipId,onSaved}:{day:string;targetMembershipId?:string;onSaved:()=>Promise<void>}) {
  const context=useContext(TimeEditingContext);
  const [open,setOpen]=useState(false);
  if(!context || (context.role==='standortleitung' && !canManageTime(context))) return null;
  return <Card><ActionButton title="Zeit hinzufügen" disabled={!context.online || context.busy} onPress={()=>setOpen(true)} />
    {!context.online?<Text>Nur online möglich. Verbinde dich mit dem Internet, um Zeit nachzutragen.</Text>:null}
    {open?<TimeEditForm key={`${context.membershipId}/${targetMembershipId??context.membershipId}/${context.role}`} kind="backfill" day={day} targetMembershipId={targetMembershipId??context.membershipId} onSaved={onSaved} onClose={()=>setOpen(false)} />:null}
  </Card>;
}
export function TimeRecordControls({record,targetMembershipId,onSaved}:{record:SafeOwnTimeRecord;targetMembershipId?:string;onSaved:()=>Promise<void>}) {
  const context=useContext(TimeEditingContext);
  const [form,setForm]=useState<'comment'|'correct'|'stop'|null>(null);
  const details=record.details;
  const own=context && (targetMembershipId===undefined || targetMembershipId===context.membershipId);
  const canEdit=context!==null && canManageTime(context);
  const canStop=canEdit && (!own || context?.role==='standortleitung');
  return <View style={{gap:8}}>
    {details?.overlapsAnotherRecord?<Text accessibilityRole="alert">überschneidet sich</Text>:null}
    {details?.change?<Text>{details.changed?'Geändert':details.origin==='backfilled'?'Nachgetragen':'Wiederhergestellt'} · {new Intl.DateTimeFormat('de-DE',{dateStyle:'short',timeStyle:'short',timeZone:BUSINESS_TIME_ZONE}).format(new Date(details.change.at))} · {details.change.actor==='self'?'durch Beschäftigten':'durch Verwaltung'}: {details.change.reason}</Text>:null}
    {details?.administrationStop?<Text>Beendet durch Verwaltung · {new Intl.DateTimeFormat('de-DE',{dateStyle:'short',timeStyle:'short',timeZone:BUSINESS_TIME_ZONE}).format(new Date(details.administrationStop.at))} · {details.administrationStop.reason}</Text>:null}
    {details?.comment?<Text>Kommentar: {details.comment}</Text>:null}
    {own && details?<ActionButton title="Kommentar schreiben" tone="quiet" disabled={!context?.online || context.busy} onPress={()=>setForm('comment')} />:null}
    {context && canEdit && details ? record.status==='stopped'
      ? <ActionButton title="Ändern" tone="quiet" disabled={!context.online || context.busy} onPress={()=>setForm('correct')} />
      : canStop ? <ActionButton title="Beenden" tone="quiet" disabled={!context.online || context.busy} onPress={()=>setForm('stop')} /> : null : null}
    {record.status==='started' && own && !canStop?<Text>Läuft noch — erst beenden, dann ändern</Text>:null}
    {record.status==='started' && context && canStop && !context.online?<Text>Nur online möglich. Verbinde dich mit dem Internet, um die Zeit zu beenden.</Text>:null}
    {form && context?<TimeEditForm key={`${context.membershipId}/${targetMembershipId??context.membershipId}/${context.role}/${record.timeRecordId}`} kind={form} record={record} targetMembershipId={targetMembershipId??context.membershipId} onSaved={onSaved} onClose={()=>setForm(null)} />:null}
  </View>;
}
function TimeEditForm({kind,day,record,targetMembershipId,onSaved,onClose}:{kind:TimeEditKind;day?:string;record?:SafeOwnTimeRecord;targetMembershipId:string;onSaved:()=>Promise<void>;onClose:()=>void}) {
  const context=useContext(TimeEditingContext)!;
  const [target,setTarget]=useState<SafeWorkTarget|null>(null);
  const managedBackfill=kind==='backfill' && context.role!=='employee' && targetMembershipId!==context.membershipId;
  const [targetPage,setTargetPage]=useState<BackfillTargetSelection|{status:'loading'}>({status:'loading'});
  const [targetReload,setTargetReload]=useState(0);
  const loadTargets=context.capability.loadBackfillTargets;
  useEffect(()=>{
    if(!managedBackfill) return;
    let current=true;setTarget(null);setTargetPage({status:'loading'});
    void (loadTargets?.call(context.capability,targetMembershipId) ?? Promise.resolve({status:'unavailable'} as const))
      .then(result=>{if(current) setTargetPage(result);}).catch(()=>{if(current) setTargetPage({status:'unavailable'});});
    return ()=>{current=false;};
  },[managedBackfill,targetMembershipId,context.capability,loadTargets,targetReload]);
  const targets=managedBackfill?(targetPage.status==='ready'?targetPage.targets:[]):context.targets;

  const [date,setDate]=useState(day??'');
  const [start,setStart]=useState(record?toZonedLocalInput(record.startedAt):'08:00');
  const [end,setEnd]=useState(()=>kind==='stop'?toZonedLocalInput(new Date().toISOString()):record?.stoppedAt?toZonedLocalInput(record.stoppedAt):'17:00');
  const [comment,setComment]=useState(kind==='comment'?record?.details?.comment??'':'');
  const [reason,setReason]=useState('');
  const [notice,setNotice]=useState('');
  const [saving,setSaving]=useState(false);
  const [archivePending,setArchivePending]=useState(false);
  const mounted=useRef(true);
  const member=useRef(context.membershipId);member.current=context.membershipId;
  const pendingInput=useRef<Record<string,unknown>|null>(null);
  useEffect(()=>{mounted.current=true;return ()=>{mounted.current=false;};},[]);
  const save=async()=>{
    if(saving) return;
    if(!context.online) {setNotice(messages.offline);return;}
    const input:Record<string,unknown>={};
    if(kind==='comment') {input.timeRecordId=record!.timeRecordId;input.comment=comment;}
    else if(kind==='stop') {
      const stoppedAt=parseZonedLocalTimestamp(end);
      if(!stoppedAt) {setNotice('Prüfe Datum und Uhrzeit in Europe/Berlin. Eine nicht eindeutige Uhrzeit bei der Zeitumstellung kann nicht übernommen werden.');return;}
      if(!reason.trim() || Array.from(reason).length>500) {setNotice('Bitte gib einen Grund mit 1 bis 500 Zeichen ein.');return;}
      Object.assign(input,{targetMembershipId,timeRecordId:record!.timeRecordId,expectedRowVersion:record!.details!.baseRowVersion,stoppedAt,reason});
    }
    else {
      const from=kind==='backfill'?`${date}T${start}`:start;
      if(!parseZonedLocalTimestamp(from)) {setNotice('Prüfe Datum und Uhrzeiten in Europe/Berlin. Eine nicht eindeutige Uhrzeit bei der Zeitumstellung kann nicht übernommen werden.');return;}
      const to=kind==='backfill'?`${end<=start?shiftDay(date,1):date}T${end}`:end;
      const startedAt=parseZonedLocalTimestamp(from),stoppedAt=parseZonedLocalTimestamp(to);
      if(!startedAt || !stoppedAt) {setNotice('Prüfe Datum und Uhrzeiten in Europe/Berlin. Eine nicht eindeutige Uhrzeit bei der Zeitumstellung kann nicht übernommen werden.');return;}
      Object.assign(input,{startedAt,stoppedAt,reason:context.role!=='employee'?reason:null});
      if(kind==='backfill') {
        if(!target || !targets.some(t=>t.targetType===target.targetType && t.targetId===target.targetId)) {setNotice('Wähle einen Kunden oder ein Projekt.');return;}
        Object.assign(input,{targetMembershipId,targetType:target.targetType,targetId:target.targetId,comment:context.role==='employee'&&comment.trim()?comment:null});
      } else Object.assign(input,{timeRecordId:record!.timeRecordId,expectedBaseRowVersion:record!.details!.baseRowVersion,expectedRevisionNumber:record!.details!.effectiveRevisionNumber});
    }
    setSaving(true);
    try {
      const stableInput=pendingInput.current??input;
      const owner=context.membershipId;
      const isCurrent=()=>mounted.current && member.current===owner;
      const initial=await context.capability.save(kind,stableInput);
      const result=kind==='stop'?await awaitAdministrationStopArchive(initial,()=>context.capability.save(kind,stableInput),isCurrent,()=>{
        if(isCurrent()) {pendingInput.current=stableInput;setArchivePending(true);setNotice(ADMINISTRATION_ARCHIVE_PENDING);}
      }):initial;
      if(!isCurrent()) return;
      if(kind==='stop' && result.status==='committed') {
        if(!isAdministrationStopResult(result) || !result.offsiteArchived) {setNotice(ADMINISTRATION_ARCHIVE_TIMEOUT);return;}
      }
      setNotice(kind==='stop' && isAdministrationStopResult(result)?administrationStopMessage(result,true):messages[result.status]);
      if(result.status==='committed') {onClose();await onSaved();}
    } finally {if(mounted.current) setSaving(false);}
  };
  const field=(label:string,value:string,set:(s:string)=>void,multiline=false)=><View style={{gap:4}}><Text>{label}</Text><TextField accessibilityLabel={label} value={value} onChangeText={set} multiline={multiline} editable={!saving&&!archivePending} /></View>;
  return <View style={{gap:12}}>
    {kind==='backfill'?<><Text accessibilityRole="header">Kunde oder Projekt</Text>
      {targets.map(t=><ActionButton key={`${t.targetType}/${t.targetId}`} title={`${target===t?'✓ ':''}${t.displayName}`} tone="quiet" disabled={saving} onPress={()=>setTarget(t)} />)}
      {targets.length===0?<Text>Arbeitsziele sind noch nicht geladen. Aktualisiere die Ansicht.</Text>:null}
      {managedBackfill && targetPage.status!=='ready' && targetPage.status!=='loading'?<>
        <Text accessibilityRole="alert">{messages[targetPage.status]}</Text>
        <ActionButton title="Aktualisieren" tone="quiet" disabled={!context.online} onPress={()=>setTargetReload(value=>value+1)} />
      </>:null}
      {field('Datum (JJJJ-MM-TT)',date,setDate)}</>:null}
    {kind!=='comment'?<>{kind!=='stop'?field(kind==='backfill'?'Von (HH:MM)':'Von (JJJJ-MM-TTTHH:MM)',start,setStart):null}
      {field(kind==='backfill'?'Bis (HH:MM)':'Bis (JJJJ-MM-TTTHH:MM)',end,setEnd)}
      <Text>Europe/Berlin{kind==='backfill'?' · Liegt „bis“ vor oder gleich „von“, endet die Zeit am Folgetag. Pausen bitte als Lücke zwischen zwei Einträgen lassen.':''}</Text></>:null}
    {kind==='comment'||(kind==='backfill'&&context.role==='employee')?field(kind==='comment'?'Kommentar':'Kommentar (optional)',comment,setComment,true):null}
    {kind!=='comment'&&context.role!=='employee'?field('Grund',reason,setReason,true):null}
    {notice?<Text accessibilityRole="alert">{notice}</Text>:null}
    {!context.online?<Text>Nur online möglich. Deine Eingaben bleiben erhalten.</Text>:null}
    <ActionButton title={saving?(archivePending?ADMINISTRATION_ARCHIVE_PENDING:'Wird gespeichert …'):archivePending?'Erneut prüfen':kind==='stop'?'Zeit beenden':'Speichern'} loading={saving} disabled={saving||!context.online} onPress={()=>{void save();}} />
    <ActionButton title="Abbrechen" tone="quiet" disabled={saving} onPress={onClose} />
  </View>;
}
