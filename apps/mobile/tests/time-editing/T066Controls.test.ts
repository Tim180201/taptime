// @vitest-environment jsdom
import { act, createElement, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { SafeOwnTimeRecord } from '@taptime/mobile-work-contract';
vi.mock('../../src/design/LineIcon',()=>({LineIcon:()=>null}));
vi.mock('react-native',()=>({
  View:({children}:{children?:ReactNode})=>createElement('div',null,children),
  ScrollView:({children}:{children?:ReactNode})=>createElement('div',null,children),
  StyleSheet:{create:(v:unknown)=>v},
}));
vi.mock('../../src/design/primitives',()=>({
  Card:({children}:{children?:ReactNode})=>createElement('div',null,children),
  AppText:({children}:{children?:ReactNode})=>createElement('span',null,children),
  TextField:({value,onChangeText,accessibilityLabel}:{value:string;onChangeText:(s:string)=>void;accessibilityLabel:string})=>createElement('input',{'aria-label':accessibilityLabel,value,onChange:(e:React.ChangeEvent<HTMLInputElement>)=>onChangeText(e.target.value)}),
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
async function render(role:'employee'|'administrator'|'standortleitung',online=true,entry=record,targetMembershipId=role==='administrator'?'10000000-0000-4000-8000-000000000002':id) {
  const state={online,busy:false};
  await act(async()=>root.render(createElement(TimeEditingContext.Provider,{value:{role,membershipId:id,targets:[{targetType:'customer',targetId:id,displayName:'Kunde'}],...state,capability:{save,getState:()=>state,subscribe:()=>()=>{}}}},
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
it('administrator corrects a completed entry with reason and concurrency versions',async()=>{
  await render('administrator');expect(button('Kommentar schreiben')).toBeUndefined();await press('Ändern');await fill('Grund','Prüfung');await press('Speichern');
  expect(save).toHaveBeenCalledWith('correct',expect.objectContaining({timeRecordId:id,expectedBaseRowVersion:0,expectedRevisionNumber:2,reason:'Prüfung'}));
});
it('running entries have the D-071 hint and no change action',async()=>{
  await render('administrator',true,{...record,status:'started',stoppedAt:null});
  expect(button('Ändern')).toBeUndefined();expect(container.textContent).toContain('Läuft noch — erst beenden, dann ändern');
});
it('location managers see marks but have no write actions',async()=>{
  await render('standortleitung');for(const text of ['Ändern','Zeit hinzufügen','Kommentar schreiben']) expect(button(text)).toBeUndefined();
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
  expect(container.textContent).toContain('Prüfe Datum und Uhrzeiten');expect(save).not.toHaveBeenCalled();
});

it.each([['nfc','gescannt'],['manual','manuell'],['backfilled','nachgetragen'],['recovered','wiederhergestellt']] as const)('shows the explicit %s provenance as %s',async(origin,label)=>{
  await render('employee',true,{...record,details:{...record.details!,origin,changed:false,change:null,overlapsAnotherRecord:false}});
  expect(container.textContent).toContain(label);expect(container.textContent).not.toContain('überschneidet sich');
});
it('administrator backfills for the selected person with a required reason and no employee comment',async()=>{
  await render('administrator');await press('Zeit hinzufügen');await press('Kunde');await fill('Grund','Tag ergänzt');await press('Speichern');
  expect(save).toHaveBeenCalledWith('backfill',expect.objectContaining({targetMembershipId:'10000000-0000-4000-8000-000000000002',reason:'Tag ergänzt',comment:null}));
  expect(container.querySelector('input[aria-label="Kommentar (optional)"]')).toBeNull();
});
it('a first self backfill remains visibly distinct from an administrative correction',async()=>{
  await render('employee',true,{...record,details:{...record.details!,changed:false,effectiveRevisionNumber:1,change:{at:'2026-09-21T10:00:00.000Z',reason:'Selbst nachgetragen',actor:'self'}}});
  expect(container.textContent).toContain('Nachgetragen');expect(container.textContent).toContain('durch Beschäftigten: Selbst nachgetragen');
});

it('administrator can comment their own entry, never another person’s',async()=>{
  await render('administrator',true,record,id);
  await press('Kommentar schreiben');await fill('Kommentar','Eigene Notiz');await press('Speichern');
  expect(save).toHaveBeenCalledWith('comment',{timeRecordId:id,comment:'Eigene Notiz'});
  await render('administrator');expect(button('Kommentar schreiben')).toBeUndefined();
});
