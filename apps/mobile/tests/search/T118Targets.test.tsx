// @vitest-environment jsdom
import { act, createElement, useSyncExternalStore, type ReactNode } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
const dismissKeyboard = vi.hoisted(() => vi.fn());
vi.mock('react-native',()=>{
  const element=({children,onPress,accessibilityLabel,accessibilityRole,role,disabled}:any)=>createElement(onPress?'button':'div',{onClick:onPress,'aria-label':accessibilityLabel,role:role??accessibilityRole,disabled},children);
  return {View:element,Text:element,Pressable:element,ScrollView:element,RefreshControl:()=>null,Keyboard:{dismiss:dismissKeyboard},
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
afterEach(()=>{cleanup();vi.useRealTimers();dismissKeyboard.mockClear();});
it.each(['app','web'])('T121 %s backfill keeps the target query error and retry visible beside assignments', async mode=>{
 let failed=true;
 const querySearch=vi.fn(async(_kind:string,request:any)=>request.assignedOnly
  ?{status:'ready',value:{targets:[target(2,'Mein Kunde')],nextCursor:null}}
  :failed?{status:'unavailable'}:{status:'ready',value:{targets:[target(1,'Alle')],nextCursor:null}});
 const state:any={status:'ready',membershipId:id(9),role:'administrator',availableSections:['time_records'],calendar:{status:'ready',targetMembershipId:null,value:ownTime}};
 const cap:any={querySearch,saveTimeEdit:vi.fn()};
 if(mode==='web')render(<TimeEditingProvider state={state} administration={cap}><WebAdd day="2026-10-13"/></TimeEditingProvider>);
 else render(<TimeEditingContext.Provider value={{membershipId:id(9),role:'administrator',capability:cap,online:true,busy:false,timeRecordsAvailable:true} as any}><AppAdd day="2026-10-13" onSaved={async()=>{}}/></TimeEditingContext.Provider>);
 fireEvent.click(screen.getByRole('button',{name:'Zeit hinzufügen'}));
 fireEvent.click(await screen.findByRole('button',{name:'Mein Kunde'}));
 expect(await screen.findByText('Die Daten konnten nicht geladen werden.')).toBeVisible();
 failed=false;fireEvent.click(screen.getByRole('button',{name:'Erneut versuchen'}));
 await act(async()=>{});
 expect(screen.queryByText('Die Daten konnten nicht geladen werden.')).toBeNull();
 expect(screen.queryByText('Alle Kunden und Projekte')).toBeNull();
 expect(screen.getByRole('button',{name:'Mein Kunde'})).toBeVisible();
});
it.each(['app-manual','web-manual','app-own','web-own','app-person','web-person'])('T121 %s: assignments replace the all list; search and no assignments keep all targets accessible',async mode=>{
 const other=mode.endsWith('person');
 let hasAssignments=true;
 const querySearch=vi.fn(async(kind:string,r:any)=>({status:'ready',value:{targets:r.search?[target(2,'Suchfund'),target(1,'Vertretung')]:r.assignedOnly?hasAssignments?r.cursor?[target(3,'Zweiter Favorit')]:[target(2,'Mein Kunde')]:[]:[target(1,'Alle')],nextCursor:r.assignedOnly&&hasAssignments&&!r.cursor?'mine-next':null}}));
 let state:any={status:'ready',membershipId:id(9),role:'administrator',availableSections:['time_records'],
  targets:{targets:[target(1,'Alle')],nextCursor:null},ownTime,submitting:false,loadingMore:false,outcome:null,
  workTargets:{status:'ready',value:[target(1,'Alle')],nextCursor:null},calendar:{status:'ready',targetMembershipId:null,value:ownTime}};
 const listeners=new Set<()=>void>();
 const searchTargets=async(search:string|null)=>{const result=await querySearch('work_targets',{search});state={...state,targets:result.value,workTargets:{status:'ready',value:result.value.targets,nextCursor:null}};listeners.forEach(listener=>listener());};
 const cap:any={querySearch,getState:()=>state,subscribe:(listener:()=>void)=>{listeners.add(listener);return()=>listeners.delete(listener);},refresh:async()=>{},searchTargets,loadWorkTargets:searchTargets,loadOwnTime:async()=>{},saveTimeEdit:vi.fn(),triggerManual:vi.fn(),captureManual:vi.fn()};
 function Surface(){const current=useSyncExternalStore(cap.subscribe,cap.getState);return mode==='app-manual'?<ManualCaptureScreen work={cap}/>:mode==='web-manual'?<ManualView state={current as any} administration={cap}/>:mode.startsWith('web')?<TimeEditingProvider state={current as any} administration={cap} targetMembershipId={other?id(8):id(9)}><WebAdd day="2026-10-13"/></TimeEditingProvider>:<TimeEditingContext.Provider value={{membershipId:id(9),role:'administrator',capability:cap,online:true,busy:false,timeRecordsAvailable:true} as any}><AppAdd day="2026-10-13" targetMembershipId={other?id(8):id(9)} onSaved={async()=>{}}/></TimeEditingContext.Provider>;}
 render(<Surface/>);
 if(!mode.endsWith('manual'))fireEvent.click(screen.getByRole('button',{name:'Zeit hinzufügen'}));
 const heading=other?'Zugeordnete Kunden und Projekte':'Meine Kunden und Projekte';
 expect(await screen.findByText(heading)).toBeInTheDocument();
 expect(querySearch).toHaveBeenCalledWith(other?'backfill_targets':'work_targets',expect.objectContaining({assignedOnly:true,cursor:null,...(other?{targetMembershipId:id(8)}:{})}));
 expect(screen.queryByText('Alle Kunden und Projekte')).toBeNull();
 expect(screen.queryByText('Alle')).toBeNull();
 expect(screen.getByText('Weitere Kunden und Projekte über die Suche')).toBeVisible();
 fireEvent.click(screen.getByRole('button',{name:'Weitere zugeordnete laden'}));
 expect(await screen.findByText('Zweiter Favorit')).toBeInTheDocument();
 expect(querySearch).toHaveBeenCalledWith(other?'backfill_targets':'work_targets',expect.objectContaining({assignedOnly:true,cursor:'mine-next'}));
 fireEvent.change(screen.getByLabelText('Suchen'),{target:{value:'Such'}});
  expect(await screen.findByText('Suchfund · zugeordnet')).toBeInTheDocument();
  expect(screen.queryByText(heading)).toBeNull();
  expect(await screen.findByText('Vertretung')).toBeInTheDocument();
  expect(screen.queryByText('Weitere Kunden und Projekte über die Suche')).toBeNull();
  expect(querySearch.mock.calls.filter(c=>c[1].search).every(c=>!Object.hasOwn(c[1],'assignedOnly'))).toBe(true);
 fireEvent.change(screen.getByLabelText('Suchen'),{target:{value:''}});
 expect(await screen.findByText(heading)).toBeVisible();
 expect(screen.queryByText('Alle Kunden und Projekte')).toBeNull();
 // Re-enter without assignments: the ordinary list returns, and search still finds substitutes.
 fireEvent.change(screen.getByLabelText('Suchen'),{target:{value:'Such'}});
 await screen.findByText('Suchfund · zugeordnet');hasAssignments=false;
 fireEvent.change(screen.getByLabelText('Suchen'),{target:{value:''}});
 expect(await screen.findByText('Alle Kunden und Projekte')).toBeVisible();
 expect(await screen.findByText('Alle')).toBeInTheDocument();
 expect(screen.queryByText(heading)).toBeNull();
 fireEvent.change(screen.getByLabelText('Suchen'),{target:{value:'Such'}});
 expect(await screen.findByText('Vertretung')).toBeInTheDocument();
});
it.each(['app','web'])('%s: no assignment section when none exist',async mode=>{
 const state:any={status:'ready',targets:{targets:[],nextCursor:null},ownTime,submitting:false,loadingMore:false,outcome:null,workTargets:{status:'ready',value:[]},calendar:{status:'ready',value:ownTime,targetMembershipId:null}};
 const cap:any={getState:()=>state,subscribe:()=>()=>{},refresh:async()=>{},querySearch:vi.fn(async()=>({status:'ready',value:{targets:[],nextCursor:null}}))};
 render(mode==='app'?<ManualCaptureScreen work={cap}/>:<ManualView state={state} administration={cap}/>);
 await act(async()=>{});expect(cap.querySearch).toHaveBeenCalledWith('work_targets',{search:null,cursor:null,assignedOnly:true});
 expect(screen.queryByText('Meine Kunden und Projekte')).toBeNull();
});
it.each([
 ['manual',false],['manual',true],['backfill',false],['backfill',true],
] as const)('T121 %s closes the keyboard when choosing a target (search=%s)',async(mode,search)=>{
 const item=target(1,'Suchkunde');
 const state:any={status:'ready',targets:{targets:[item],nextCursor:null},ownTime,submitting:false,loadingMore:false,outcome:null};
 const cap:any={getState:()=>state,subscribe:()=>()=>{},refresh:async()=>{},searchTargets:async()=>{},
  querySearch:vi.fn(async(_kind:string,request:any)=>({status:'ready',value:{targets:request.assignedOnly?[target(2,'Mein Kunde')]:[item],nextCursor:null}}))};
 if(mode==='manual')render(<ManualCaptureScreen work={cap}/>);
 else {render(<TimeEditingContext.Provider value={{membershipId:id(9),role:'administrator',capability:cap,online:true,busy:false} as any}><AppAdd day="2026-10-13" onSaved={async()=>{}}/></TimeEditingContext.Provider>);fireEvent.click(screen.getByRole('button',{name:'Zeit hinzufügen'}));}
 await screen.findByText('Meine Kunden und Projekte');
 const field=screen.getByLabelText('Suchen');fireEvent.focus(field);
 if(search){fireEvent.change(field,{target:{value:'Such'}});await act(async()=>{await new Promise(resolve=>setTimeout(resolve,300));});}
 fireEvent.click(await screen.findByRole('button',{name:search?'Suchkunde':'Mein Kunde'}));
 expect(dismissKeyboard).toHaveBeenCalledOnce();
 expect(field).toHaveValue(search?'Such':'');
});
it('T121 web favorite start waits for a failed next page to recover, without revealing the all list',async()=>{
 const querySearch=vi.fn().mockResolvedValueOnce({status:'ready',value:{targets:[target(2,'Mein Kunde')],nextCursor:'next'}})
  .mockResolvedValueOnce({status:'unavailable'}).mockResolvedValueOnce({status:'ready',value:{targets:[target(3,'Weitere Zuordnung')],nextCursor:null}});
 const state:any={status:'ready',membershipId:id(9),role:'administrator',workTargets:{status:'ready',value:[target(1,'Alle')],nextCursor:null},calendar:{status:'ready',targetMembershipId:null,value:ownTime}};
 const administration:any={querySearch,captureManual:vi.fn()};render(<ManualView state={state} administration={administration}/>);
 fireEvent.click(await screen.findByRole('button',{name:'Mein Kunde'}));fireEvent.click(screen.getByRole('button',{name:'Weitere zugeordnete laden'}));
 await screen.findByText('Die Daten konnten nicht geladen werden.');
 expect(screen.getByRole('button',{name:'Zeit starten · Mein Kunde'})).toBeDisabled();
 expect(screen.queryByRole('button',{name:'Alle'})).toBeNull();
 fireEvent.click(within(screen.getByRole('alert')).getByRole('button',{name:'Erneut versuchen'}));await screen.findByText('Weitere Zuordnung');
 expect(screen.getByRole('button',{name:'Zeit starten · Mein Kunde'})).not.toBeDisabled();
});
