// @vitest-environment jsdom
import { act, createElement, useState, type ReactNode } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
vi.mock('react-native',()=>{
  const element=({children,onPress,accessibilityLabel,accessibilityRole,role,disabled}:any)=>createElement(onPress?'button':'div',{onClick:onPress,'aria-label':accessibilityLabel,role:role??accessibilityRole,disabled},children);
  return {View:element,Text:element,Pressable:element,ScrollView:element,RefreshControl:()=>null,
    TextInput:({value,onChangeText,accessibilityLabel}:any)=>createElement('input',{value,'aria-label':accessibilityLabel,onChange:(e:any)=>onChangeText(e.target.value)}),
    StyleSheet:{create:(v:unknown)=>v},Platform:{OS:'android'},BackHandler:{addEventListener:()=>({remove(){}})},AccessibilityInfo:{announceForAccessibility(){},isReduceMotionEnabled:async()=>false,addEventListener:()=>({remove(){}})}};
});
vi.mock('react-native-safe-area-context',()=>({useSafeAreaInsets:()=>({top:0,bottom:0,left:0,right:0})}));
vi.mock('react-native-svg',()=>({default:({children}: {children:ReactNode})=>createElement('svg',{},children),Path:()=>null}));
import { CustomersScreen } from '../../src/screens/CustomersScreen';
import { CustomerQuotaNotice as AppNotice } from '../../src/screens/QuotaNotice';
import type { MobileWorkCapability } from '../../src/work/contracts';
const authority={role:'administrator'};
const id=(n:number)=>`10000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const asOf='2026-10-14T08:00:00.000Z';
const customer=(n:number,name:string)=>({customerId:id(n),displayName:name,active:true,workDurationSeconds:0,running:false,quotaSeconds:null,quotaStage:'none' as const});
const first=customer(1,'Alpha'),last=customer(2,'Zeta');
const page=(customers:unknown[],nextCursor:string|null=null)=>({version:'customer-hours.v3',scope:'people',asOf,customers,nextCursor});
const person=(n:number)=>({membershipId:id(n+10),displayName:`Person ${n}`,workDurationSeconds:0,running:false});
const detail=(people:unknown[],nextCursor:string|null=null)=>({version:'customer-hours.detail.v1',scope:'people',asOf,customer:last,people,nextCursor});
function View({cap,selected}:{mode:string;cap:any;selected?:string}){return <CustomersScreen work={cap} authorityContext={authority} openCustomer={selected?{customerId:selected,month:'2026-10'}:undefined}/>;}
beforeEach(()=>{Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});vi.useFakeTimers();vi.setSystemTime(new Date(asOf));});
afterEach(()=>{cleanup();vi.useRealTimers();});
const flush=async()=>{await act(async()=>{await Promise.resolve();});};
for(const mode of ['app']) {
  it(`${mode}: customer search waits, sends normalized terms, rejects old replies, pages and retries`,async()=>{
    let finishOld!:(v:unknown)=>void;
    const querySearch=vi.fn().mockResolvedValueOnce({status:'ready',value:page([first],'next')})
      .mockResolvedValueOnce({status:'ready',value:page([last])})
      .mockImplementationOnce(()=>new Promise(resolve=>{finishOld=resolve;}))
      .mockResolvedValueOnce({status:'ready',value:page([])})
      .mockResolvedValueOnce({status:'unavailable'})
      .mockResolvedValueOnce({status:'ready',value:page([last])});
    render(<View mode={mode} cap={{querySearch}}/>);await flush();
    expect(querySearch).toHaveBeenCalledTimes(1);expect(screen.getByText('Alpha')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'Weitere laden'}));await flush();expect(screen.getByText('Zeta')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Suchen'),{target:{value:'  Mu\u0308ller  '}});
    await act(()=>vi.advanceTimersByTimeAsync(299));expect(querySearch).toHaveBeenCalledTimes(2);
    await act(()=>vi.advanceTimersByTimeAsync(1));expect(querySearch).toHaveBeenLastCalledWith('customer_hours',expect.objectContaining({search:'Müller',cursor:null}));
    fireEvent.change(screen.getByLabelText('Suchen'),{target:{value:'Neu'}});await act(()=>vi.advanceTimersByTimeAsync(300));
    await act(async()=>finishOld({status:'ready',value:page([first])}));expect(screen.queryByText('Alpha')).toBeNull();
    expect(screen.getByText('Keine Treffer für „Neu“')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'Suche löschen'}));await act(()=>vi.advanceTimersByTimeAsync(300));
    fireEvent.click(screen.getByRole('button',{name:'Erneut versuchen'}));await flush();expect(screen.getByText('Zeta')).toBeInTheDocument();
  });
  it(`${mode}: a quota link opens detail directly and appends person pages`,async()=>{
    const querySearch=vi.fn().mockResolvedValueOnce({status:'ready',value:detail([person(1)],'people-next')}).mockResolvedValueOnce({status:'ready',value:detail([person(2)])});
    render(<View mode={mode} cap={{querySearch,getState:()=>({status:'ready',role:'administrator'})}} selected={last.customerId}/>);await flush();
    expect(querySearch).toHaveBeenCalledTimes(1);expect(querySearch).toHaveBeenLastCalledWith('customer_detail',expect.objectContaining({customerId:last.customerId,cursor:null}));
    expect(screen.getByText('Person 1')).toBeInTheDocument();fireEvent.click(screen.getByRole('button',{name:'Weitere Personen laden'}));await flush();
    expect(screen.getByText('Person 1')).toBeInTheDocument();expect(screen.getByText('Person 2')).toBeInTheDocument();
  });
  it(`${mode}: global quota notices still include a customer beyond the first search page (K1–K3)`,async()=>{
    const readCustomerHours=vi.fn().mockResolvedValue({status:'ready',value:{version:'customer-hours.v2',scope:'people',asOf,customers:[{...last,workDurationSeconds:1800,quotaSeconds:1800,quotaStage:'exceeded',people:[]}]}});
    const querySearch=vi.fn().mockResolvedValue({status:'ready',value:page([first],'next')});
    const cap={readCustomerHours,querySearch},storage={read:async()=>null,write:async()=>{}},onView=vi.fn();
    render(<><View mode={mode} cap={cap}/>{<AppNotice work={cap as unknown as MobileWorkCapability} membership={id(5)} role="administrator" authorityContext={authority} storage={storage} onView={onView}/>}</>);await flush();
    expect(screen.getByText(/Zeta: Kontingent überschritten/)).toBeInTheDocument();expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(querySearch).toHaveBeenCalledTimes(1);expect(readCustomerHours).toHaveBeenCalledWith('2026-10');
    fireEvent.click(screen.getByRole('button',{name:'Ansehen'}));await flush();expect(onView).toHaveBeenCalledWith(last.customerId,'2026-10');
  });
}

it('app: employee list exposes a debounced server search',async()=>{
  const {EmployeesScreen}=await import('../../src/screens/EmployeesScreen');
  const search=vi.fn();const employeeState={status:'list',month:'2026-10',filter:true,busy:false,failed:false,summary:{people:[],nextCursor:null,runningCount:0,totalCount:0,serverTime:asOf}};const employees={getState:()=>employeeState,subscribe:()=>()=>{},refresh:async()=>{},leave(){},search};
  render(<EmployeesScreen employees={employees as any} scope={{kind:'organization'}} locationsEnabled={false}/>);
  fireEvent.change(screen.getByLabelText('Suchen'),{target:{value:'  Mu\u0308ller  '}});
  await act(()=>vi.advanceTimersByTimeAsync(299));expect(search).not.toHaveBeenCalled();
  await act(()=>vi.advanceTimersByTimeAsync(1));expect(search).toHaveBeenCalledWith('Müller');
});
it('app: adding own time loads its own bounded target list when opened',async()=>{
  const {AddTimeControl,TimeEditingContext}=await import('../../src/timeEditing/TimeEditingControls');
  const querySearch=vi.fn().mockResolvedValue({status:'ready',value:{targets:[{targetType:'customer',targetId:id(9),displayName:'Suchkunde'}],nextCursor:'more'}});
  const context={role:'employee',membershipId:id(1),targets:[],online:true,busy:false,capability:{querySearch,save:vi.fn(),getState:()=>({online:true,busy:false}),subscribe:()=>()=>{}}};
  render(<TimeEditingContext.Provider value={context as any}><AddTimeControl day="2026-10-13" onSaved={async()=>{}}/></TimeEditingContext.Provider>);
  expect(querySearch).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Zeit hinzufügen'}));await flush();
  expect(querySearch).toHaveBeenCalledTimes(1);expect(querySearch).toHaveBeenCalledWith('work_targets',{cursor:null,search:null});
  expect(screen.getByLabelText('Suchen')).toBeInTheDocument();expect(screen.getByText('Suchkunde')).toBeInTheDocument();
});
it('app: an inspected card outside loaded results can be removed as diese Karte',async()=>{
  const {AdminSetupScreen}=await import('../../src/screens/AdminSetupScreen');
  const value={status:'ready',projection:{organization:{id:id(1),name:'Betrieb'},customers:[],nfcTags:[],nextCursor:null},outcome:{status:'tag_checked',nfcTagId:id(4),activeAssignmentId:id(5),assignment:'customer',customerName:'Kunde',locationName:null}};
  const removeTag=vi.fn().mockResolvedValue({status:'succeeded',removedAt:asOf});
  const cap={getState:()=>value,subscribe:()=>()=>{},refresh:async()=>{},querySearch:async()=>({status:'ready',value:{status:'succeeded',...value.projection}}),removeTag};
  render(<AdminSetupScreen administration={cap as any}/>);await flush();
  fireEvent.click(screen.getByRole('button',{name:'Karte entfernen'}));expect(screen.getByText('Karte „diese Karte“ entfernen?')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Entfernen bestätigen'}));await flush();expect(removeTag).toHaveBeenCalledWith(id(4),id(5));
});

it('T117 R2: an initial card load failure offers a retry that recovers the list',async()=>{
 const {AdminSetupScreen}=await import('../../src/screens/AdminSetupScreen');
 let value:any={status:'inactive'};const listeners=new Set<()=>void>();
 const projection={organization:{id:id(1),name:'Betrieb'},customers:[],nfcTags:[{id:id(4),displayName:'Wieder erreichbare Karte',customerDisplayName:null,assignmentState:'unassigned'}],nextCursor:null};
 const refresh=vi.fn(async()=>{value={status:'ready',projection,outcome:null};listeners.forEach(listener=>listener());});
 const querySearch=vi.fn(async()=>({status:'ready',value:{status:'succeeded',...projection}}));
 const cap={getState:()=>value,subscribe:(listener:()=>void)=>{listeners.add(listener);return()=>listeners.delete(listener);},refresh,querySearch};
 render(<AdminSetupScreen administration={cap as any}/>);await flush();
 expect(querySearch).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Erneut versuchen'}));await flush();
 expect(refresh).toHaveBeenCalledTimes(1);expect(screen.getByText('Wieder erreichbare Karte')).toBeInTheDocument();
 expect(querySearch).toHaveBeenCalledTimes(1);
});

it('app: returning after provisioning refreshes the card results',async()=>{
 const {AdminSetupScreen}=await import('../../src/screens/AdminSetupScreen');
 let value:any={status:'ready',projection:{organization:{id:id(1),name:'Betrieb'},customers:[],nfcTags:[],nextCursor:null},outcome:null};
 const listeners=new Set<()=>void>();
 const querySearch=vi.fn(async(kind:string)=>({status:'ready',value:{status:'succeeded',...value.projection,customers:[],nfcTags:kind==='setup_tags'?value.projection.nfcTags:[]}}));
 const cap={getState:()=>value,subscribe:(listener:()=>void)=>{listeners.add(listener);return()=>listeners.delete(listener);},querySearch};
 render(<AdminSetupScreen administration={cap as any}/>);await flush();
 fireEvent.click(screen.getByRole('button',{name:'Karte einrichten'}));await flush();
 await act(async()=>{value={...value,outcome:{status:'tag_provisioned',validationFingerprint:'AABBCCDDEEFF'},projection:{...value.projection,nfcTags:[{id:id(4),displayName:'Neue Karte',customerDisplayName:null,assignmentState:'unassigned'}]}};listeners.forEach(listener=>listener());});
 await flush();expect(screen.getByText('Neue Karte')).toBeInTheDocument();
 expect(querySearch.mock.calls.filter(([kind])=>kind==='setup_tags')).toHaveLength(2);
});

it('app: an uncertain registration retries its fixed customer outside the first result page',async()=>{
 const {AdminSetupScreen}=await import('../../src/screens/AdminSetupScreen');
 const value={status:'ready',pendingTag:{customerId:id(99),displayName:'Eingang'},projection:{organization:{id:id(1),name:'Betrieb'},customers:[],nfcTags:[],nextCursor:null},outcome:null};
 const provision=vi.fn(),cap={getState:()=>value,subscribe:()=>()=>{},provision,querySearch:async()=>({status:'ready',value:{status:'succeeded',...value.projection}})};
 render(<AdminSetupScreen administration={cap as any}/>);await flush();
 fireEvent.click(screen.getByRole('button',{name:'Zuordnung erneut versuchen'}));await flush();
 expect(provision).toHaveBeenCalledWith(id(99),'Eingang');
});

it('app: losing authority clears cached card results before another session can show them',async()=>{
 const {AdminSetupScreen}=await import('../../src/screens/AdminSetupScreen');
 const initial={status:'ready',projection:{organization:{id:id(1),name:'Betrieb'},customers:[],nfcTags:[{id:id(4),displayName:'Vertrauliche Karte',customerDisplayName:null,assignmentState:'unassigned'}],nextCursor:null},outcome:null};
 let value:any=initial;const listeners=new Set<()=>void>();
 const querySearch=vi.fn().mockResolvedValueOnce({status:'ready',value:{status:'succeeded',...initial.projection}}).mockResolvedValue({status:'unavailable'});
 const cap={getState:()=>value,subscribe:(listener:()=>void)=>{listeners.add(listener);return()=>listeners.delete(listener);},querySearch};
 render(<AdminSetupScreen administration={cap as any}/>);await flush();expect(screen.getByText('Vertrauliche Karte')).toBeInTheDocument();
 await act(async()=>{value={status:'inactive'};listeners.forEach(listener=>listener());});
 await act(async()=>{value={...initial,projection:{...initial.projection,nfcTags:[]}};listeners.forEach(listener=>listener());});await flush();
 expect(screen.queryByText('Vertrauliche Karte')).toBeNull();expect(querySearch).toHaveBeenCalledTimes(2);
});

it('app: employee pages form alphabetic location lists with departed people last',async()=>{
 const {EmployeesScreen}=await import('../../src/screens/EmployeesScreen');
 const person=(n:number,name:string,location:string,departedAt:string|null=null)=>({membershipId:id(n),displayName:name,location:{id:location,name:location},departedAt,isRunning:false,monthWorkDurationSeconds:3600});
 let value:any={status:'list',month:'2026-10',filter:false,busy:false,failed:false,summary:{people:[person(1,'Anna','Zürich')],nextCursor:'next',runningCount:12,totalCount:31,serverTime:asOf}};
 const listeners=new Set<()=>void>();
 const employees={getState:()=>value,subscribe:(listener:()=>void)=>{listeners.add(listener);return()=>listeners.delete(listener);},refresh:async()=>{},leave(){},
  loadMore:async()=>{value={...value,summary:{...value.summary,nextCursor:null,people:[...value.summary.people,person(2,'Berta','Aachen'),person(3,'Carla','Zürich'),person(4,'Dora','Aachen',asOf)]}};listeners.forEach(listener=>listener());}};
 render(<EmployeesScreen employees={employees as any} scope={{kind:'organization'}} locationsEnabled/>);
 fireEvent.click(screen.getByRole('button',{name:'Weitere laden'}));await flush();
 expect(Array.from(document.querySelectorAll('[role="header"]')).map(node=>node.textContent).filter(text=>['Aachen','Zürich','Ausgeschiedene Mitarbeiter'].includes(text??''))).toEqual(['Aachen','Zürich','Ausgeschiedene Mitarbeiter','Aachen']);
 expect(screen.getAllByRole('list')).toHaveLength(3);expect(screen.getAllByRole('listitem')).toHaveLength(4);
 expect(screen.getByText('12 / 31')).toBeInTheDocument();
});

it.each(['setup_tags','setup_customers','work_targets','backfill_targets'])
('app %s: normalizes delayed search, ignores late answers, appends and retries pages',async kind=>{
 const field=kind==='setup_tags'?'nfcTags':kind==='setup_customers'?'customers':'targets';
 const projection={organization:{id:id(1),name:'Betrieb'},customers:[],nfcTags:[],nextCursor:null};
 const row=(name:string,n:number)=>({id:id(n),targetId:id(n),targetType:'customer',displayName:name,active:true,assignmentState:'unassigned',customerDisplayName:null});
 const page=(rows:unknown[],nextCursor:string|null=null)=>({...projection,[field]:rows,nextCursor});
 let finishOld!:(v:unknown)=>void;
 const read=vi.fn().mockResolvedValueOnce({status:'ready',value:page([row('Alpha',2)],'next')})
  .mockResolvedValueOnce({status:'unavailable'})
  .mockResolvedValueOnce({status:'ready',value:page([row('Zeta',3)])})
  .mockImplementationOnce(()=>new Promise(resolve=>{finishOld=resolve;}))
  .mockResolvedValueOnce({status:'ready',value:page([])})
  .mockResolvedValueOnce({status:'ready',value:page([row('Wieder da',4)])});
 const querySearch=vi.fn((requested:string,request:unknown)=>requested===kind?read(request):Promise.resolve({status:'ready',value:projection}));
 if(kind.startsWith('setup_')){
  const {AdminSetupScreen}=await import('../../src/screens/AdminSetupScreen');
  const value={status:'ready',projection,outcome:null};
  render(<AdminSetupScreen administration={{getState:()=>value,subscribe:()=>()=>{},querySearch} as any}/>);await flush();
  if(kind==='setup_customers'){expect(read).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Karte einrichten'}));}
 }else{
  const {AddTimeControl,TimeEditingContext}=await import('../../src/timeEditing/TimeEditingControls');
  const context={role:'administrator',membershipId:id(1),online:true,busy:false,targets:[],capability:{querySearch,save:vi.fn(),getState:()=>({online:true,busy:false}),subscribe:()=>()=>{}}};
  render(<TimeEditingContext.Provider value={context as any}><AddTimeControl targetMembershipId={kind==='backfill_targets'?id(99):id(1)} day="2026-10-13" onSaved={async()=>{}}/></TimeEditingContext.Provider>);
  expect(read).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Zeit hinzufügen'}));
 }
 await flush();expect(read).toHaveBeenCalledTimes(1);expect(screen.getByText('Alpha')).toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'Weitere laden'}));await flush();
 expect(screen.getByText('Alpha')).toBeInTheDocument();fireEvent.click(screen.getByRole('button',{name:'Erneut versuchen'}));await flush();
 expect(read).toHaveBeenLastCalledWith(expect.objectContaining({search:null,cursor:'next'}));expect(screen.getByText('Zeta')).toBeInTheDocument();
 fireEvent.change(screen.getByLabelText('Suchen'),{target:{value:'  Mu\u0308ller  '}});
 await act(()=>vi.advanceTimersByTimeAsync(299));expect(read).toHaveBeenCalledTimes(3);
 await act(()=>vi.advanceTimersByTimeAsync(1));expect(read).toHaveBeenLastCalledWith(expect.objectContaining({search:'Müller',cursor:null}));
 fireEvent.change(screen.getByLabelText('Suchen'),{target:{value:'Neu'}});await act(()=>vi.advanceTimersByTimeAsync(300));
 await act(async()=>finishOld({status:'ready',value:page([row('Veraltet',5)])}));
 expect(screen.queryByText('Veraltet')).toBeNull();expect(screen.getByText('Keine Treffer für „Neu“')).toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'Suche löschen'}));await act(()=>vi.advanceTimersByTimeAsync(300));
 expect(read).toHaveBeenLastCalledWith(expect.objectContaining({search:null,cursor:null}));expect(screen.getByText('Wieder da')).toBeInTheDocument();
});
