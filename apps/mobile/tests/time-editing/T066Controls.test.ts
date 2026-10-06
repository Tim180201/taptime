// @vitest-environment jsdom
import axe from 'axe-core';
import { act, createElement, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { SafeOwnTimeRecord } from '@taptime/mobile-work-contract';
vi.mock('../../src/design/LineIcon',()=>({LineIcon:()=>null}));
vi.mock('react-native',()=>({
  findNodeHandle:()=>null,
  View:({children,ref,style,focusable}:{children?:ReactNode;ref?:React.Ref<HTMLDivElement>;style?:unknown;focusable?:boolean})=>createElement('div',{ref,tabIndex:focusable?0:undefined,'data-style':JSON.stringify(style)},children),
  ScrollView:({children,ref,style,focusable}:{children?:ReactNode;ref?:React.Ref<HTMLDivElement>;style?:unknown;focusable?:boolean})=>createElement('div',{ref,tabIndex:focusable?0:undefined,'data-style':JSON.stringify(style)},children),
  AccessibilityInfo: { isReduceMotionEnabled: async () => true, addEventListener: () => ({ remove() {} }) },
    StyleSheet:{create:(v:unknown)=>v},
}));
vi.mock('../../src/design/primitives',()=>({
  Card:({children}:{children?:ReactNode})=>createElement('div',null,children),
  AppText:({children,accessibilityRole,accessibilityLiveRegion}:{children?:ReactNode;accessibilityRole?:string;accessibilityLiveRegion?:string})=>createElement('span',{role:accessibilityRole,'aria-live':accessibilityLiveRegion},children),
  TextField:({ref,value,onChangeText,accessibilityLabel}:{ref?:React.Ref<HTMLInputElement>;value:string;onChangeText:(s:string)=>void;accessibilityLabel:string})=>createElement('input',{ref,'aria-label':accessibilityLabel,value,onChange:(e:React.ChangeEvent<HTMLInputElement>)=>onChangeText(e.target.value)}),
  ActionButton:({title,onPress,disabled}:{title:string;onPress:()=>void;disabled?:boolean})=>createElement('button',{onClick:onPress,disabled},title),
  TouchTarget:({children,onPress,accessibilityLabel}:{children?:ReactNode;onPress:()=>void;accessibilityLabel?:string})=>createElement('button',{onClick:onPress,'aria-label':accessibilityLabel},children),
}));
const {TimeCalendar}=await import('../../src/screens/TimeCalendar');
const {TimeEditingContext}=await import('../../src/timeEditing/TimeEditingControls');
const id='10000000-0000-4000-8000-000000000001';
const record:SafeOwnTimeRecord={timeRecordId:id,source:'recovered',targetType:'customer',targetDisplayName:'Kunde',status:'stopped',startedAt:'2026-09-21T08:00:00.000Z',stoppedAt:'2026-09-21T09:00:00.000Z',startedVia:null,stoppedVia:null,
  details:{origin:'backfilled',baseRowVersion:0,effectiveRevisionNumber:2,changed:true,comment:'Vorhanden',change:{at:'2026-09-21T10:00:00.000Z',reason:'Ende berichtigt',actor:'administration'},overlapsAnotherRecord:true}};
let root:Root,container:HTMLDivElement;
const save=vi.fn(async()=>({status:'committed' as const,timeRecordId:id,idempotentRetry:false}));
const refresh=vi.fn(async()=>{});
beforeEach(()=>{vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);container=document.createElement('div');document.body.appendChild(container);root=createRoot(container);save.mockClear();refresh.mockClear();});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();vi.unstubAllGlobals();});
async function render(role:'employee'|'administrator'|'standortleitung',online=true,entry=record,targetMembershipId=role==='employee'?id:'10000000-0000-4000-8000-000000000002', scoped=true) {
  const state={online,busy:false};
  await act(async()=>root.render(createElement(TimeEditingContext.Provider,{value:{role,membershipId:id,managementScope:scoped?{kind:'location',locationId:id,locationName:'Eins'}:null,targets:[{targetType:'customer',targetId:id,displayName:'Kunde'}],...state,capability:{save,getState:()=>state,subscribe:()=>()=>{},loadBackfillTargets:async()=>({status:"ready" as const,targets:[{targetType:"customer" as const,targetId:"20000000-0000-4000-8000-000000000002",displayName:"Zielperson C2"}]})}}},
    createElement(TimeCalendar,{value:{activeRecord:entry.status==='started'?entry:null,records:entry.status==='stopped'?[entry]:[],nextCursor:null,windowStartedAt:'2026-08-01T00:00:00.000Z',windowEndedAt:'2026-09-21T12:00:00.000Z'},onRefresh:refresh,targetMembershipId}))));
}
function button(text:string) {return [...container.querySelectorAll('button')].find(b=>b.textContent===text);}
async function press(text:string) {expect(button(text),text).toBeDefined();await act(async()=>button(text)!.click());}
async function fill(label:string,value:string) {
  const input=container.querySelector(`input[aria-label="${label}"]`) as HTMLInputElement;
  expect(input,label).toBeTruthy();
  await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));});
}
it('shows durable provenance, correction reason, current comment and overlap; employee can save own comment',async()=>{
  await render('employee');
  for(const text of ['nachgetragen','Geändert','Ende berichtigt','Kommentar: Vorhanden','überschneidet sich']) expect(container.textContent).toContain(text);
  expect(button('Ändern')).toBeUndefined();
  await press('Kommentar schreiben');await fill('Kommentar','Neue Fassung');await press('Speichern');
  expect(save).toHaveBeenCalledWith('comment',{timeRecordId:id,comment:'Neue Fassung'});expect(refresh).toHaveBeenCalled();
});
it.each(['administrator','standortleitung'] as const)('%s corrects a completed entry with reason and concurrency versions',async role=>{
  await render(role);expect(button('Kommentar schreiben')).toBeUndefined();await press('Ändern');await fill('Grund','Prüfung');await press('Speichern');
  expect(save).toHaveBeenCalledWith('correct',expect.objectContaining({timeRecordId:id,expectedBaseRowVersion:0,expectedRevisionNumber:2,reason:'Prüfung'}));
});
it('running entries have the D-071 hint and no change action',async()=>{
  await render('administrator',true,{...record,status:'started',stoppedAt:null},id);
  expect(button('Ändern')).toBeUndefined();expect(container.textContent).toContain('Läuft noch — erst beenden, dann ändern');
});
it('location managers without a session scope have no management actions',async()=>{
  await render('standortleitung',true,record,'10000000-0000-4000-8000-000000000002',false);for(const text of ['Ändern','Zeit hinzufügen','Kommentar schreiben']) expect(button(text)).toBeUndefined();
  expect(container.textContent).toContain('überschneidet sich');
});
it('backfills with optional employee comment and preserves inputs after rejection; cancel closes',async()=>{
  await render('employee');await press('Zeit hinzufügen');await press('Kunde');await fill('Kommentar (optional)','Vergessen');
  save.mockResolvedValueOnce({status:'overlap'} as never);await press('Speichern');expect(container.textContent).toContain('überschneidet sich mit einem anderen');
  expect((container.querySelector('input[aria-label="Kommentar (optional)"]') as HTMLInputElement).value).toBe('Vergessen');
  await press('Speichern');expect(save).toHaveBeenLastCalledWith('backfill',expect.objectContaining({targetMembershipId:id,comment:'Vergessen',reason:null}));
  await press('Zeit hinzufügen');await press('Abbrechen');expect(button('Speichern')).toBeUndefined();
});
it('offline remains visibly disabled and sends nothing',async()=>{
  await render('employee',false);expect(button('Zeit hinzufügen')?.disabled).toBe(true);expect(button('Kommentar schreiben')?.disabled).toBe(true);
  expect(container.textContent).toContain('Nur online möglich');await press('Zeit hinzufügen');expect(save).not.toHaveBeenCalled();
});
it('invalid dates are shown as a field problem even for overnight time',async()=>{
  await render('employee');await press('Zeit hinzufügen');await press('Kunde');await fill('Datum (JJJJ-MM-TT)','falsch');await fill('Von (HH:MM)','22:00');await fill('Bis (HH:MM)','06:00');await press('Speichern');
  expect(container.textContent).toContain('Datum und Uhrzeit in Europe/Berlin');expect(save).not.toHaveBeenCalled();
});

it.each([['nfc','gescannt'],['manual','manuell'],['backfilled','nachgetragen'],['recovered','wiederhergestellt']] as const)('shows the explicit %s provenance as %s',async(origin,label)=>{
  await render('employee',true,{...record,details:{...record.details!,origin,changed:false,change:null,overlapsAnotherRecord:false}});
  expect(container.textContent).toContain(label);expect(container.textContent).not.toContain('überschneidet sich');
});
it.each(['administrator','standortleitung'] as const)('%s backfills for the selected person with a required reason and no employee comment',async role=>{
  await render(role);await press('Zeit hinzufügen');await press('Zielperson C2');await fill('Grund','Tag ergänzt');await press('Speichern');
  expect(save).toHaveBeenCalledWith('backfill',expect.objectContaining({targetMembershipId:'10000000-0000-4000-8000-000000000002',reason:'Tag ergänzt',comment:null}));
  expect(container.querySelector('input[aria-label="Kommentar (optional)"]')).toBeNull();
});
it('a first self backfill remains visibly distinct from an administrative correction',async()=>{
  await render('employee',true,{...record,details:{...record.details!,changed:false,effectiveRevisionNumber:1,change:{at:'2026-09-21T10:00:00.000Z',reason:'Selbst nachgetragen',actor:'self'}}});
  expect(container.textContent).toContain('Nachgetragen');expect(container.textContent).toContain('durch Beschäftigten: Selbst nachgetragen');
});

it.each(['administrator','standortleitung'] as const)('%s can comment their own entry, never another person’s',async role=>{
  await render(role,true,record,id);
  await press('Kommentar schreiben');await fill('Kommentar','Eigene Notiz');await press('Speichern');
  expect(save).toHaveBeenCalledWith('comment',{timeRecordId:id,comment:'Eigene Notiz'});
  await render(role);expect(button('Kommentar schreiben')).toBeUndefined();
});


it.each(['administrator','standortleitung'] as const)('T-069 lets an %s stop another person online, preserves errors and reloads on success',async role=>{
  const active={...record,source:'canonical' as const,status:'started' as const,stoppedAt:null,details:{...record.details!,baseRowVersion:3}};
  await render(role,true,active);
  expect(container.textContent).not.toContain('Läuft noch — erst beenden');
  await press('Beenden');
  expect(container.querySelector('input[aria-label="Von (HH:MM)"]')).toBeNull();
  await fill('Ende am (JJJJ-MM-TT)','2026-09-21');await fill('Bis (HH:MM)','14:00');await press('Zeit beenden');
  expect(save).not.toHaveBeenCalled();expect(container.textContent).toContain('Grund');
  await fill('Grund','Pause vergessen');save.mockResolvedValueOnce({status:'end_before_break'} as never);
  await press('Zeit beenden');expect(container.textContent).toContain('Die Endzeit liegt vor einer erfassten Pause');
  expect((container.querySelector('input[aria-label="Grund"]') as HTMLInputElement).value).toBe('Pause vergessen');
  save.mockResolvedValueOnce({status:'committed',timeRecordId:id,idempotentRetry:false,requiredWalFile:'000000010000000000000002',offsiteArchived:true} as never);
  await press('Zeit beenden');
  expect(save).toHaveBeenLastCalledWith('stop',{targetMembershipId:'10000000-0000-4000-8000-000000000002',timeRecordId:id,
    expectedRowVersion:3,stoppedAt:'2026-09-21T12:00:00.000Z',reason:'Pause vergessen'});
  expect(refresh).toHaveBeenCalled();
});
it('T-069 retains own running hint and prevents offline stopping',async()=>{
  const active={...record,status:'started' as const,stoppedAt:null};
  await render('employee',true,active);expect(button('Beenden')).toBeUndefined();expect(container.textContent).toContain('Läuft noch');
  await render('administrator',false,active);expect(button('Beenden')?.disabled).toBe(true);
  await press('Beenden');expect(save).not.toHaveBeenCalled();
});
it('T-069 shows the employee the administration mark independently of later corrections',async()=>{
  await render('employee',true,{...record,stoppedVia:'administration',details:{...record.details!,administrationStop:{at:'2026-09-21T10:00:00.000Z',reason:'Stopp vergessen'}}});
  expect(container.textContent).toContain('Beendet durch Verwaltung');expect(container.textContent).toContain('Stopp vergessen');
  expect(container.textContent).toContain('Ende berichtigt');
});


it('T-069 stop form has no axe violations in the accessible native-control DOM harness',async()=>{
  await render('administrator',true,{...record,status:'started',stoppedAt:null});await press('Beenden');
  expect((await axe.run(container,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']},rules:{'color-contrast':{enabled:false}}})).violations).toEqual([]);
});

it('D-078 keeps the form pending and polls before reloading the calendar',async()=>{
  vi.useFakeTimers();
  try {
    await render('administrator',true,{...record,status:'started',stoppedAt:null});await press('Beenden');
    await fill('Grund','Vergessen');
    const pending={status:'committed',timeRecordId:id,idempotentRetry:false,requiredWalFile:'000000010000000000000002',offsiteArchived:false};
    save.mockResolvedValueOnce(pending as never).mockResolvedValueOnce({...pending,idempotentRetry:true,offsiteArchived:true} as never);
    await press('Zeit beenden');
    expect(container.textContent).toContain('Wird gesichert …');expect(refresh).not.toHaveBeenCalled();
    await act(async()=>{await vi.advanceTimersByTimeAsync(5000);});
    expect(save.mock.calls[0]).toEqual(save.mock.calls[1]);expect(refresh).toHaveBeenCalled();
  } finally {vi.useRealTimers();}
});
it('D-078 stops polling after three minutes, retains the command inputs and permits checking again',async()=>{
  vi.useFakeTimers();
  try {
    await render('administrator',true,{...record,status:'started',stoppedAt:null});await press('Beenden');await fill('Grund','Vergessen');
    save.mockResolvedValue({status:'committed',timeRecordId:id,idempotentRetry:true,requiredWalFile:'000000010000000000000002',offsiteArchived:false} as never);
    await press('Zeit beenden');await act(async()=>{await vi.advanceTimersByTimeAsync(180000);});
    expect(container.textContent).toContain('Noch nicht extern gesichert — bitte später prüfen');expect(refresh).not.toHaveBeenCalled();
    const calls=save.mock.calls.length;await act(async()=>{await vi.advanceTimersByTimeAsync(60000);});expect(save).toHaveBeenCalledTimes(calls);
    save.mockResolvedValue({status:'committed',timeRecordId:id,idempotentRetry:true,requiredWalFile:'000000010000000000000002',offsiteArchived:true} as never);
    await press('Erneut prüfen');expect(refresh).toHaveBeenCalled();
  } finally {save.mockResolvedValue({status:'committed',timeRecordId:id,idempotentRetry:false});vi.useRealTimers();}
});

it('T-062 manager can stop their own entry and retains the existing rejection text',async()=>{
 await render('standortleitung',true,{...record,status:'started',stoppedAt:null},id);
 await press('Beenden');await fill('Grund','Vergessen');
 save.mockResolvedValueOnce({status:'authority_rejected'} as never);await press('Zeit beenden');
 expect(save).toHaveBeenCalledWith('stop',expect.objectContaining({targetMembershipId:id,reason:'Vergessen'}));
 expect(container.textContent).toContain('Die Berechtigung zum Beenden fehlt.');
 expect(refresh).not.toHaveBeenCalled();
});

it.each(['administrator','standortleitung'] as const)('D-092 %s uses the target person choices, not the actor choices',async role=>{
 await render(role);await press('Zeit hinzufügen');
 expect(button('Zielperson C2')).toBeDefined();expect(button('Kunde')).toBeUndefined();
 await press('Zielperson C2');await fill('Grund','Zielperson');await press('Speichern');
 expect(save).toHaveBeenCalledWith('backfill',expect.objectContaining({targetId:'20000000-0000-4000-8000-000000000002'}));
});

it('T079 splits dates and minute clocks while preserving exact unchanged values',async()=>{
 const precise={...record,startedAt:'2026-09-21T08:00:37.123Z',stoppedAt:'2026-09-21T09:00:48.987Z'};
 await render('administrator',true,precise);await press('Ändern');
 for(const [label,value] of [['Beginn am (JJJJ-MM-TT)','2026-09-21'],['Ende am (JJJJ-MM-TT)','2026-09-21'],['Von (HH:MM)','10:00'],['Bis (HH:MM)','11:00']])
  expect((container.querySelector(`input[aria-label="${label}"]`) as HTMLInputElement).value).toBe(value);
 await fill('Grund','Nur Grund');await press('Speichern');
 expect(save).toHaveBeenCalledWith('correct',expect.objectContaining({startedAt:precise.startedAt,stoppedAt:precise.stoppedAt}));
});
it.each(['2026-10-25','2027-03-28'])('T079 rejects newly edited ambiguous or absent time on %s',async day=>{
 await render('administrator');await press('Ändern');await fill('Beginn am (JJJJ-MM-TT)',day);await fill('Von (HH:MM)','02:30');await fill('Grund','Prüfung');await press('Speichern');
 expect(save).not.toHaveBeenCalled();expect(container.textContent).toContain('Zeitumstellung');
 expect((container.querySelector('input[aria-label="Von (HH:MM)"]') as HTMLInputElement).value).toBe('02:30');
});

it.each(['employee','administrator','standortleitung'] as const)('T-088 %s requires a reason and preserves the form until confirmed success',async role=>{
 await render(role);await press('Zeiteintrag löschen');await press('Löschen');expect(save).not.toHaveBeenCalled();expect(container.textContent).toContain('Wähle einen Grund');
 await press('Sonstiges');await press('Löschen');expect(save).not.toHaveBeenCalled();await fill('Kurze Begründung','Falscher Tag');
 save.mockResolvedValueOnce({status:'review_open'} as never);await press('Löschen');expect(container.textContent).toContain('noch eine Prüfung offen');
 expect((container.querySelector('input[aria-label="Kurze Begründung"]') as HTMLInputElement).value).toBe('Falscher Tag');
 await press('Löschen');expect(save).toHaveBeenLastCalledWith('void',{timeRecordId:id,reasonCode:'other',reasonText:'Falscher Tag'});expect(refresh).toHaveBeenCalled();
});
it('T-088 running time has no void action; offline cannot send and cancellation keeps data',async()=>{
 await render('employee',true,{...record,status:'started',stoppedAt:null});expect(button('Zeiteintrag löschen')).toBeUndefined();
 await render('employee',false);await press('Zeiteintrag löschen');await press('Fehlscan');await press('Löschen');expect(save).not.toHaveBeenCalled();expect(container.textContent).toContain('Löschen geht nur online');
 await press('Abbrechen');expect(button('Löschen')).toBeUndefined();
});
it('T-088 renders separate cancellation history with who and why, without a duration',async()=>{
 const {VoidedTimeRows}=await import('../../src/timeEditing/TimeVoidControls');
 const loadVoided=vi.fn(async()=>({status:'ready' as const,records:[{timeRecordId:id,targetDisplayName:'Gelöschter Kunde',startedAt:record.startedAt,stoppedAt:record.stoppedAt!,voidedAt:'2026-09-21T10:00:00.000Z',actorDisplayName:'Alex Beispiel',reasonCode:'misscan' as const,reasonText:null}]}));
 await act(async()=>root.render(createElement(TimeEditingContext.Provider,{value:{membershipId:id,role:'employee',targets:[],online:true,busy:false,capability:{save,getState:()=>({online:true,busy:false}),subscribe:()=>()=>{},loadVoided}}},createElement(VoidedTimeRows,{day:'2026-09-21',value:{records:[],activeRecord:null,nextCursor:null,windowStartedAt:'2026-09-01T00:00:00.000Z',windowEndedAt:'2026-09-21T12:00:00.000Z'}}))));
 expect(container.textContent).toContain('Gelöscht am');expect(container.textContent).toContain('von Alex Beispiel · Fehlscan');expect(container.textContent).not.toMatch(/1,0 h|1:00 h|08:00|09:00/);
 expect(loadVoided).toHaveBeenCalledWith(id,'2026-09-20T22:00:00.000Z','2026-09-21T12:00:00.000Z');
});

it.each(['backfill','correct','stop','comment'] as const)('T101 %s marks each required input, focuses the first and clears on valid input',async kind=>{
 await render('administrator',true,kind==='stop'?{...record,status:'started',stoppedAt:null}:record,kind==='stop'?'10000000-0000-4000-8000-000000000002':id);
 await press(kind==='backfill'?'Zeit hinzufügen':kind==='correct'?'Ändern':kind==='stop'?'Beenden':'Kommentar schreiben');
 if(kind==='backfill')await press('Kunde');
 const labels=kind==='comment'?['Kommentar']:kind==='stop'?['Ende am (JJJJ-MM-TT)','Bis (HH:MM)','Grund']:kind==='correct'?['Beginn am (JJJJ-MM-TT)','Von (HH:MM)','Ende am (JJJJ-MM-TT)','Bis (HH:MM)','Grund']:['Datum (JJJJ-MM-TT)','Von (HH:MM)','Bis (HH:MM)','Grund'];
 for(const label of labels)await fill(label,'');await press(kind==='stop'?'Zeit beenden':'Speichern');expect(save).not.toHaveBeenCalled();
 expect(document.activeElement).toBe(container.querySelector(`input[aria-label="${labels[0]}"]`));
 for(const label of labels){const input=container.querySelector(`input[aria-label="${label}"]`)!;expect(input.parentElement?.getAttribute('data-style')).toContain('#FF8F8F');expect(input.parentElement?.querySelector('[role="alert"]')?.getAttribute('aria-live')).toBe('polite');}
 for(const label of labels)await fill(label,label.includes('JJJJ')?'2026-09-21':label==='Von (HH:MM)'?'10:00':label==='Bis (HH:MM)'?'11:00':'Berichtigt');
 for(const label of labels)expect(container.querySelector(`input[aria-label="${label}"]`)?.parentElement?.querySelector('[role="alert"]')).toBeNull();
});

it('T101 review: an empty clock leaves the valid date alone and focuses Von',async()=>{
 await render('employee',true,record,id);await press('Zeit hinzufügen');await press('Kunde');await fill('Von (HH:MM)','');await press('Speichern');expect(save).not.toHaveBeenCalled();
 const date=container.querySelector('input[aria-label="Datum (JJJJ-MM-TT)"]')!,clock=container.querySelector('input[aria-label="Von (HH:MM)"]')!;
 expect(date.parentElement?.querySelector('[role="alert"]')).toBeNull();expect(clock.parentElement?.querySelector('[role="alert"]')).not.toBeNull();expect(document.activeElement).toBe(clock);
});
it.each([
 ['2026-09-22','11:01','Höchstens 24 Stunden.'],
 ['2099-09-21','11:00','Das Ende liegt in der Zukunft.'],
])('T106: correction end %s %s is rejected at the field',async(date,time,message)=>{
 await render('administrator');await press('Ändern');
 await fill('Ende am (JJJJ-MM-TT)',date);await fill('Bis (HH:MM)',time);await fill('Grund','Beleg geprüft');await press('Speichern');
 expect(save).not.toHaveBeenCalled();expect(container.textContent).toContain(message);
});
it('T106: required reasons cannot consist only of controls and spaces',async()=>{
 await render('administrator');await press('Ändern');await fill('Grund','\u00a0\t\u0001');await press('Speichern');
 expect(save).not.toHaveBeenCalled();expect(container.textContent).toContain('Bitte Grund eingeben.');
});

it('T106 shows invisible void reason at the required field',async()=>{
 await render('employee');await press('Zeiteintrag löschen');await press('Sonstiges');await fill('Kurze Begründung','\u0001\u0085\u200b');await press('Löschen');
 expect(save).not.toHaveBeenCalled();expect(document.body.textContent).toContain('Bitte gib eine Begründung mit 1 bis 500 Zeichen ein.');
});
