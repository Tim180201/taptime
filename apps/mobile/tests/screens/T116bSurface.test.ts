import {setupSearch} from '../search/fixtures';
// @vitest-environment jsdom
import { act, createElement as h, type ReactNode, type Ref } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { AdminSetupCapability } from '../../src/administration/contracts';
import type { MobileWorkCapability } from '../../src/work/contracts';
import type { OfflineManualCaptureCapability } from '../../src/offline/OfflineCaptureCoordinator';
const native=vi.hoisted(()=>({announce:vi.fn(),focus:vi.fn()}));
vi.mock('react-native',()=>{
 const view=({children,ref,style,focusable,accessible,accessibilityLabel}:{children?:ReactNode;ref?:Ref<HTMLDivElement>;style?:unknown;focusable?:boolean;accessible?:boolean;accessibilityLabel?:string})=>h('div',{ref,tabIndex:focusable?0:undefined,'aria-label':accessibilityLabel,'data-accessible':accessible,'data-style':JSON.stringify(style)},children);
 return {RefreshControl:()=>null,View:view,ScrollView:(props:Parameters<typeof view>[0])=>h('div',{'data-scroll':true},view(props)),StyleSheet:{create:(v:unknown)=>v},Platform:{OS:'android'},BackHandler:{addEventListener:()=>({remove(){}})},findNodeHandle:(node:unknown)=>node,AccessibilityInfo:{isReduceMotionEnabled:async()=>true,addEventListener:()=>({remove(){}}),announceForAccessibility:native.announce,setAccessibilityFocus:native.focus}};
});
vi.mock('../../src/design/LineIcon',()=>({LineIcon:()=>null}));
vi.mock('../../src/design/AppBuildIdentity',()=>({AppBuildIdentity:()=>null}));
vi.mock('../../src/design/primitives',()=>{
 const group=({children}:{children?:ReactNode})=>h('div',{},children);
 return {Card:({children}:{children?:ReactNode})=>h('div',{'data-card':true},children),Screen:group,AppText:({children,accessibilityRole,accessibilityLiveRegion}:{children?:ReactNode;accessibilityRole?:string;accessibilityLiveRegion?:string})=>h('span',{role:accessibilityRole,'aria-live':accessibilityLiveRegion},children),
 TextField:({ref,value,onChangeText,accessibilityLabel,accessibilityHint,editable}:{ref?:Ref<HTMLInputElement>;value:string;onChangeText:(s:string)=>void;accessibilityLabel?:string;accessibilityHint?:string;editable?:boolean})=>h('input',{ref,value,disabled:editable===false,'aria-label':accessibilityLabel,'aria-description':accessibilityHint,onChange:(e:React.ChangeEvent<HTMLInputElement>)=>onChangeText(e.target.value)}),
 ActionButton:({title,onPress,disabled}:{title:string;onPress:()=>void;disabled?:boolean})=>h('button',{onClick:onPress,disabled},title),TouchTarget:({children,onPress,disabled}:{children?:ReactNode;onPress:()=>void;disabled?:boolean})=>h('button',{onClick:onPress,disabled},children)};
});
let root:Root,box:HTMLDivElement;
beforeEach(()=>{vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);box=document.createElement('div');document.body.append(box);root=createRoot(box);native.announce.mockClear();native.focus.mockClear();});
afterEach(async()=>{await act(async()=>root.unmount());box.remove();vi.unstubAllGlobals();vi.useRealTimers();});
async function mount(ui:ReactNode){await act(async()=>root.render(ui));}
async function press(title:string){const button=Array.from(box.querySelectorAll('button')).find(b=>b.textContent===title)!;expect(button,title).toBeTruthy();expect(button.disabled).toBe(false);await act(async()=>{button.focus();button.click();});}
async function fill(label:string,value:string){const input=box.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!;expect(input,label).toBeTruthy();await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));});}

const {LoginScreen}=await import('../../src/screens/LoginScreen');
const {InviteEmployeeScreen}=await import('../../src/screens/InviteEmployeeScreen');
const {AdminSetupScreen}=await import('../../src/screens/AdminSetupScreen');
const {ManualCaptureScreen}=await import('../../src/screens/ManualCaptureScreen');
const target={targetType:'customer' as const,targetId:'customer',displayName:'Kunde A'};
const ownTime={records:[],activeRecord:null,nextCursor:null,windowStartedAt:'2026-09-01T00:00:00Z',windowEndedAt:'2026-09-30T12:00:00Z'};
const ready={status:'ready' as const,targets:{targets:[target],nextCursor:null},ownTime,submitting:false,capturePending:false,outcome:null};
it('T116b manual selection has a fixed, announced footer and is cleared when filtered out',async()=>{
 vi.useFakeTimers();let current=ready;const listeners=new Set<()=>void>();
 const capture=vi.fn();const work={getState:()=>current,subscribe:(fn:()=>void)=>{listeners.add(fn);return()=>listeners.delete(fn);},searchTargets:async(search:string|null)=>{current={...ready,targets:{targets:search?[]:[target],nextCursor:null}};listeners.forEach(fn=>fn());},refresh:vi.fn(async()=>{}),triggerManual:capture} as unknown as MobileWorkCapability;
 await mount(h(ManualCaptureScreen,{work}));
 expect([...box.querySelectorAll('button')].some(b=>b.textContent==='Zeit starten')).toBe(false);
 await press('Kunde A');
 expect(native.announce).toHaveBeenCalledWith('Ausgewählt: Kunde A');
 const start=[...box.querySelectorAll('button')].find(b=>b.textContent==='Zeit starten')!;
 expect(start.closest('[data-scroll]')).toBeNull();
 expect(start.parentElement?.textContent).toContain('Kunde A');
 await fill('Suchen','anderer Kunde');await act(()=>vi.advanceTimersByTimeAsync(300));
 expect([...box.querySelectorAll('button')].some(b=>b.textContent==='Zeit starten')).toBe(false);
 await fill('Suchen','');await act(()=>vi.advanceTimersByTimeAsync(300));
 expect([...box.querySelectorAll('button')].some(b=>b.textContent==='Zeit starten')).toBe(false);
 expect(capture).not.toHaveBeenCalled();
 await press('Kunde A');await press('Zeit starten');expect(capture).toHaveBeenCalledExactlyOnceWith(target);
});
it('T116b manual footer disappears when a time starts',async()=>{
 let current:unknown=ready;
 const work={getState:()=>current,subscribe:()=>()=>{},refresh:vi.fn(async()=>{})} as unknown as MobileWorkCapability;
 await mount(h(ManualCaptureScreen,{work}));await press('Kunde A');
 current={...ready,ownTime:{...ownTime,activeRecord:{timeRecordId:'active',targetId:'customer',targetDisplayName:'Kunde A',startedAt:'2026-09-30T08:00:00Z',stoppedAt:null,breakStartedAt:null}}};
 await mount(h(ManualCaptureScreen,{work}));
 expect([...box.querySelectorAll('button')].some(b=>b.textContent==='Zeit starten')).toBe(false);
});
it.each(['succeeded','succeeded_existing_account'] as const)('T116b invitation %s disables send and clears the form for another person',async outcome=>{
 const openInvitation=vi.fn(async()=>{}),employees={invite:vi.fn(),back:vi.fn(),openInvitation} as never;
 const state={status:'invite' as const,busy:false,outcome:null,locationsReady:true,locations:[{id:'loc',name:'Nord'}]};
 const props={employees,state,scope:{kind:'organization' as const},locationsEnabled:true};
 await mount(h(InviteEmployeeScreen,props));await fill('Name','Alex');await fill('E-Mail','alex@example.test');await press('Nord');
 await mount(h(InviteEmployeeScreen,{...props,state:{...state,outcome}}));
 expect([...box.querySelectorAll('button')].find(b=>b.textContent==='Einladung senden')?.disabled).toBe(true);
 await press('Weitere Person einladen');expect(openInvitation).toHaveBeenCalledOnce();
 await mount(h(InviteEmployeeScreen,props));
 expect([...box.querySelectorAll('input')].every(input=>input.value==='')).toBe(true);
 await fill('Name','Bea');await fill('E-Mail','bea@example.test');await press('Einladung senden');
 expect(box.textContent).toContain('Bitte einen Standort wählen.');
});
it('T116b retry shows the unavailable login message only once and keeps Code S5',async()=>{
 const signIn=vi.fn(async()=>({status:'infrastructure_error' as const}));
 await mount(h(LoginScreen,{signIn,signInForEmployeeEnrollment:signIn,requestPasswordReset:vi.fn(async()=> 'unavailable' as const),disabled:false,unavailable:true}));
 await fill('E-Mail-Adresse','test@example.test');await fill('Passwort','secret');await press('Anmelden');
 expect(box.textContent?.match(/Anmeldung gerade nicht möglich/g)).toHaveLength(1);
 expect(box.textContent).toContain('Code S5');
});
it.each(['ready','capturing'] as const)('T116b card actions, result and removal precede the list (%s)',async status=>{
 const tag={id:'tag',displayName:'Kartenliste beginnt hier',activeAssignmentId:'assignment',assignmentState:'assigned',assignmentType:'work',targetCustomerId:'customer'};
 const projection={organization:{id:'org',name:'Betrieb'},customers:[{id:'customer',displayName:'Prüfergebnis',active:true}],nfcTags:[tag],nextCursor:'next'};
 const state={status,projection,outcome:status==='ready'?{status:'tag_checked',assignment:'customer',customerName:'Prüfergebnis',locationName:null,nfcTagId:'tag',activeAssignmentId:'assignment'}:null};
 const administration={querySearch:setupSearch(()=>state),getState:()=>state,subscribe:()=>()=>{},refresh:vi.fn(async()=>{}),cancel:vi.fn(async()=>{})} as unknown as AdminSetupCapability;
 await mount(h(AdminSetupScreen,{administration}));
 const listLabel=()=>[...box.querySelectorAll('span')].find(node=>node.textContent===tag.displayName)!;
 const before=(label:string)=>{const node=[...box.querySelectorAll('button,span')].find(node=>node.textContent===label)!;expect(node,label).toBeTruthy();expect(node.compareDocumentPosition(listLabel()) & Node.DOCUMENT_POSITION_FOLLOWING,label).toBeTruthy();};
 before('Karte einrichten');before('Karte prüfen');
 if(status==='ready'){before('Standort: Ohne Standortzuordnung');before('Karte entfernen');await press('Karte entfernen');before('Entfernen bestätigen');}
 else before('Scan abbrechen');
 for(const label of ['Weitere laden','Aktualisieren'])expect(box.textContent!.indexOf(label)).toBeGreaterThan(box.textContent!.indexOf(tag.displayName));
});

vi.mock('../../src/timeEditing/TimeEditingControls',()=>({AddTimeControl:()=>null,TimeRecordControls:()=>h('div',{'data-record-controls':true},'Ändern Löschen Kommentar Verlauf')}));
vi.mock('../../src/timeEditing/TimeVoidControls',()=>({VoidedTimeRows:()=>null}));
const {TimeCalendar}=await import('../../src/screens/TimeCalendar');

const calendarCases=[
 {name:'sections',start:'2026-10-04T06:00:00Z',end:'2026-10-04T10:00:00Z',work:12600,pause:1800,
  breaks:[{startedAt:'2026-10-04T08:00:00Z',stoppedAt:'2026-10-04T08:30:00Z'}],
  lines:['08:00–10:00 · Kunde X · 2:00 h','10:00–10:30 · Pause · 0:30 h','10:30–12:00 · Kunde X · 1:30 h']},
 {name:'midnight',start:'2026-10-03T21:00:00Z',end:'2026-10-04T01:00:00Z',work:3600,pause:10800,
  breaks:[{startedAt:'2026-10-03T21:30:00Z',stoppedAt:'2026-10-04T00:30:00Z'}],
  lines:['00:00–02:30 · Pause · 2:30 h','02:30–03:00 · Kunde X · 0:30 h']},
 {name:'running pause',start:'2026-10-04T06:00:00Z',end:null,work:9000,pause:1800,
  breaks:[{startedAt:'2026-10-04T08:30:00Z',stoppedAt:'2026-10-04T09:00:00Z'}],
  lines:['08:00–10:30 · Kunde X · 2:30 h','seit 10:30 · Pause']},
 {name:'ended pause',start:'2026-10-04T06:00:00Z',end:null,work:9000,pause:1800,breakStartedAt:null,
  breaks:[{startedAt:'2026-10-04T08:30:00Z',stoppedAt:'2026-10-04T09:00:00Z'}],
  lines:['08:00–10:30 · Kunde X · 2:30 h','10:30–11:00 · Pause · 0:30 h']},
 {name:'new pause',start:'2026-10-04T06:00:00Z',end:null,work:10800,pause:0,
  breaks:[{startedAt:'2026-10-04T09:00:00Z',stoppedAt:'2026-10-04T09:00:00Z'}],
  lines:['08:00–11:00 · Kunde X · 3:00 h','seit 11:00 · Pause']},
 {name:'without pause',start:'2026-10-04T06:00:00Z',end:'2026-10-04T10:00:00Z',work:14400,pause:0,breaks:[],lines:[]},
];

it.each(calendarCases)('T116b calendar $name keeps sections chronological and controls once',async scenario=>{
 const record={timeRecordId:'record',source:'canonical' as const,targetType:'customer' as const,targetDisplayName:'Kunde X',
  startedAt:scenario.start,stoppedAt:scenario.end,status:scenario.end===null?'started' as const:'stopped' as const,
  startedVia:'manual' as const,stoppedVia:scenario.end===null?null:'manual' as const,
  breakStartedAt:'breakStartedAt' in scenario?scenario.breakStartedAt:scenario.end===null?scenario.breaks.at(-1)?.startedAt:null,
  calendar:{asOf:'2026-10-04T09:00:00Z',workDurationSeconds:scenario.work,breakDurationSeconds:scenario.pause,breakIntervals:scenario.breaks}};
 const value={activeRecord:scenario.end===null?record:null,records:scenario.end===null?[]:[record],nextCursor:null,
  windowStartedAt:'2026-09-30T22:00:00Z',windowEndedAt:'2026-10-04T10:00:00Z'};
 await mount(h(TimeCalendar,{value,onRefresh:async()=>{},targetMembershipId:'person'}));
 const controls=box.querySelectorAll('[data-record-controls]');expect(controls).toHaveLength(1);
 const group=controls[0]!.closest('[data-card]')!;
 expect(group.textContent).not.toContain('0:00 h Pause');
 let previous=-1;
 for(const line of scenario.lines){const index=group.textContent!.indexOf(line);expect(index,line).toBeGreaterThan(previous);previous=index;}
 if(!scenario.breaks.length){expect(group.textContent).toContain('Kunde X');expect(group.textContent).toContain('4:00 h');expect(group.textContent).not.toContain('Pause');}
 expect(group.textContent!.match(/manuell/g)).toHaveLength(1);
});
