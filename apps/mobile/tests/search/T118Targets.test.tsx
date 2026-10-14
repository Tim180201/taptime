// @vitest-environment jsdom
import { act, createElement, useState, type ReactNode } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
vi.mock('react-native',()=>{
  const element=({children,onPress,accessibilityLabel,accessibilityRole,role,disabled}:any)=>createElement(onPress?'button':'div',{onClick:onPress,'aria-label':accessibilityLabel,role:role??accessibilityRole,disabled},children);
  return {View:element,Text:element,Pressable:element,ScrollView:element,RefreshControl:()=>null,
    TextInput:({value,onChangeText,accessibilityLabel}:any)=>createElement('input',{value,'aria-label':accessibilityLabel,onChange:(e:any)=>onChangeText(e.target.value)}),
    StyleSheet:{create:(v:unknown)=>v},Platform:{OS:'android'},BackHandler:{addEventListener:()=>({remove(){}})},AccessibilityInfo:{announceForAccessibility(){},isReduceMotionEnabled:async()=>false,addEventListener:()=>({remove(){}})}};
});
vi.mock('react-native-safe-area-context',()=>({useSafeAreaInsets:()=>({top:0,bottom:0,left:0,right:0})}));
vi.mock('react-native-svg',()=>({default:({children}: {children:ReactNode})=>createElement('svg',{},children),Path:()=>null}));
import {ManualCaptureScreen} from '../../src/screens/ManualCaptureScreen';
import ManualView from '../../../admin-web/src/views/ManualView';
import {TimeEditingProvider,AddTimeControl as WebAdd} from '../../../admin-web/src/TimeEditingControls';
import {TimeEditingContext,AddTimeControl as AppAdd} from '../../src/timeEditing/TimeEditingControls';
const id=(n:number)=>`10000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const target=(n:number,name:string)=>({targetType:'customer' as const,targetId:id(n),displayName:name,assignedToMe:n!==1,assignedToPerson:n!==1});
const ownTime={activeRecord:null,records:[],nextCursor:null,windowStartedAt:'2026-09-30T22:00:00.000Z',windowEndedAt:'2026-10-14T08:00:00.000Z'};
afterEach(()=>{cleanup();vi.useRealTimers();});
it.each(['app-manual','web-manual','app-own','web-own','app-person','web-person'])('%s: assigned targets precede all, have independent pages and mark search hits',async mode=>{
 const other=mode.endsWith('person');
 const querySearch=vi.fn(async(kind:string,r:any)=>({status:'ready',value:{targets:r.search?[target(2,'Suchfund')]:r.assignedOnly?r.cursor?[target(3,'Zweiter Favorit')]:[target(2,'Mein Kunde')]:[target(1,'Alle')],nextCursor:r.assignedOnly&&!r.cursor?'mine-next':null}}));
 const state:any={status:'ready',membershipId:id(9),role:'administrator',availableSections:['time_records'],
  targets:{targets:[target(1,'Alle')],nextCursor:null},ownTime,submitting:false,loadingMore:false,outcome:null,
  workTargets:{status:'ready',value:[target(1,'Alle')],nextCursor:null},calendar:{status:'ready',targetMembershipId:null,value:ownTime}};
 const cap:any={querySearch,getState:()=>state,subscribe:()=>()=>{},refresh:async()=>{},loadWorkTargets:async()=>{},loadOwnTime:async()=>{},saveTimeEdit:vi.fn(),triggerManual:vi.fn(),captureManual:vi.fn()};
 if(mode==='app-manual')render(<ManualCaptureScreen work={cap}/>);
 else if(mode==='web-manual')render(<ManualView state={state} administration={cap}/>);
 else if(mode.startsWith('web'))render(<TimeEditingProvider state={state} administration={cap} targetMembershipId={other?id(8):id(9)}><WebAdd day="2026-10-13"/></TimeEditingProvider>);
 else render(<TimeEditingContext.Provider value={{membershipId:id(9),role:'administrator',capability:cap,online:true,busy:false,timeRecordsAvailable:true} as any}><AppAdd day="2026-10-13" targetMembershipId={other?id(8):id(9)} onSaved={async()=>{}}/></TimeEditingContext.Provider>);
 if(!mode.endsWith('manual'))fireEvent.click(screen.getByRole('button',{name:'Zeit hinzufügen'}));
 const heading=other?'Zugeordnete Kunden und Projekte':'Meine Kunden und Projekte';
 expect(await screen.findByText(heading)).toBeInTheDocument();
 expect(querySearch).toHaveBeenCalledWith(other?'backfill_targets':'work_targets',expect.objectContaining({assignedOnly:true,cursor:null,...(other?{targetMembershipId:id(8)}:{})}));
 expect(document.body.textContent!.indexOf(heading)).toBeLessThan(document.body.textContent!.indexOf('Alle Kunden und Projekte'));
 fireEvent.click(screen.getByRole('button',{name:'Weitere zugeordnete laden'}));
 expect(await screen.findByText('Zweiter Favorit')).toBeInTheDocument();
 expect(querySearch).toHaveBeenCalledWith(other?'backfill_targets':'work_targets',expect.objectContaining({assignedOnly:true,cursor:'mine-next'}));
 if(!mode.endsWith('manual')){
  fireEvent.change(screen.getByLabelText('Suchen'),{target:{value:'Such'}});
  expect(await screen.findByText('Suchfund · zugeordnet')).toBeInTheDocument();
  expect(screen.queryByText(heading)).toBeNull();
  expect(querySearch.mock.calls.filter(c=>c[1].search).every(c=>!Object.hasOwn(c[1],'assignedOnly'))).toBe(true);
 }
});
it.each(['app','web'])('%s: no assignment section when none exist',async mode=>{
 const state:any={status:'ready',targets:{targets:[],nextCursor:null},ownTime,submitting:false,loadingMore:false,outcome:null,workTargets:{status:'ready',value:[]},calendar:{status:'ready',value:ownTime,targetMembershipId:null}};
 const cap:any={getState:()=>state,subscribe:()=>()=>{},refresh:async()=>{},querySearch:vi.fn(async()=>({status:'ready',value:{targets:[],nextCursor:null}}))};
 render(mode==='app'?<ManualCaptureScreen work={cap}/>:<ManualView state={state} administration={cap}/>);
 await act(async()=>{});expect(cap.querySearch).toHaveBeenCalledWith('work_targets',{search:null,cursor:null,assignedOnly:true});
 expect(screen.queryByText('Meine Kunden und Projekte')).toBeNull();
});
it('T118 review: web favorite start waits for a failed next page to recover, while all targets remain usable',async()=>{
 const querySearch=vi.fn().mockResolvedValueOnce({status:'ready',value:{targets:[target(2,'Mein Kunde')],nextCursor:'next'}})
  .mockResolvedValueOnce({status:'unavailable'}).mockResolvedValueOnce({status:'ready',value:{targets:[target(3,'Weitere Zuordnung')],nextCursor:null}});
 const state:any={status:'ready',membershipId:id(9),role:'administrator',workTargets:{status:'ready',value:[target(1,'Alle')],nextCursor:null},calendar:{status:'ready',targetMembershipId:null,value:ownTime}};
 const administration:any={querySearch,captureManual:vi.fn()};render(<ManualView state={state} administration={administration}/>);
 fireEvent.click(await screen.findByRole('button',{name:'Mein Kunde'}));fireEvent.click(screen.getByRole('button',{name:'Weitere zugeordnete laden'}));
 await screen.findByText('Die Daten konnten nicht geladen werden.');
 expect(screen.getByRole('button',{name:'Zeit starten · Mein Kunde'})).toBeDisabled();
 expect(screen.getByRole('button',{name:'Alle'})).not.toBeDisabled();
 fireEvent.click(within(screen.getByRole('alert')).getByRole('button',{name:'Erneut versuchen'}));await screen.findByText('Weitere Zuordnung');
 expect(screen.getByRole('button',{name:'Zeit starten · Mein Kunde'})).not.toBeDisabled();
});
