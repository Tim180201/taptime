// @vitest-environment jsdom
import {act,cleanup,fireEvent,render,screen,within} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import SetupView from '../../src/views/SetupView';
import EmployeesView from '../../src/views/EmployeesView';
import ManualView from '../../src/views/ManualView';
import {PeopleTable} from '../../src/views/PeopleShared';
import {AddTimeControl,TimeEditingProvider} from '../../src/TimeEditingControls';
const id='10000000-0000-4000-8000-000000000001';
const organization={id,name:'Betrieb'};
const state:any={status:'ready',membershipId:id,role:'administrator',managementScope:{kind:'organization'},selectedLocation:null,locationsEnabled:false,assignableLocations:[],reassignmentIntent:null,completedAction:null,availableSections:['time_records'],projection:{organization,customers:[],nfcTags:[],nextCursor:null,customersComplete:true,nfcTagsComplete:true},employeeProjection:{organization,employeeMemberships:[],nextCursor:null},sections:{setup:{status:'ready'},employees:{status:'ready'}},workTargets:{status:'ready',value:[]},calendar:{status:'ready',targetMembershipId:null,value:{activeRecord:null,records:[],nextCursor:null}},locationSetup:null};
const page=(kind:string)=>kind==='projects'?{projects:[],nextCursor:null}:kind==='memberships'?{status:'succeeded',organization,employeeMemberships:[],nextCursor:null}:kind==='setup_tags'||kind==='setup_customers'?{status:'succeeded',organization,customers:[],nfcTags:[],nextCursor:null}:{targets:[],nextCursor:null};
const flush=async()=>{await act(async()=>{});};
beforeEach(()=>{HTMLDialogElement.prototype.showModal=function(){this.open=true;};HTMLDialogElement.prototype.close=function(){this.open=false;};vi.useFakeTimers();Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});});
afterEach(()=>{cleanup();vi.useRealTimers();});
it('web: setup has independent card/customer/project searches with one initial request each',async()=>{
 const querySearch=vi.fn(async(kind:string)=>({status:'ready',value:page(kind)}));
 render(<SetupView state={state} administration={{querySearch,getState:()=>state} as any}/>);await flush();
 expect(querySearch.mock.calls.map(([kind])=>kind).sort()).toEqual(['projects','setup_customers','setup_tags']);
 fireEvent.click(screen.getByRole('tab',{name:'Kunden und Projekte'}));
 const panel=screen.getByRole('tabpanel');
 fireEvent.change(within(panel).getByLabelText('Suchen'),{target:{value:'  Mu\u0308ller  '}});
 await act(()=>vi.advanceTimersByTimeAsync(299));expect(querySearch).toHaveBeenCalledTimes(3);
 await act(()=>vi.advanceTimersByTimeAsync(1));expect(querySearch).toHaveBeenCalledWith('setup_customers',expect.objectContaining({search:'Müller'}));expect(querySearch).toHaveBeenCalledWith('projects',expect.objectContaining({search:'Müller'}));
 expect(within(panel).getByText('Keine Treffer für „Müller“')).toBeInTheDocument();
});
it('T117 R1: revoking access refreshes the searched membership status',async()=>{
 let member={id:'member',displayName:'Ada',active:true,rowVersion:1,role:'employee',location:null};
 const querySearch=vi.fn(async()=>({status:'ready',value:{...page('memberships'),employeeMemberships:[member]}}));
 const revokeMembership=vi.fn(async()=>{member={...member,active:false,rowVersion:2};});
 render(<EmployeesView state={state} administration={{querySearch,revokeMembership,getState:()=>state} as any} navigate={()=>{}}/>);await flush();
 fireEvent.click(screen.getByRole('tab',{name:'Zugänge'}));
 expect(screen.getByText(/^aktiv$/)).toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:'Zugang entziehen'}));
 const confirmation=screen.getByRole('alertdialog',{name:'Zugangsentzug ausdrücklich bestätigen'});
 fireEvent.click(within(confirmation).getByRole('button',{name:'Zugang entziehen'}));await flush();
 expect(revokeMembership).toHaveBeenCalledWith('member',1);
 expect(screen.queryByText(/^aktiv$/)).toBeNull();expect(screen.getByText(/^entzogen$/)).toBeInTheDocument();
 expect(querySearch).toHaveBeenCalledTimes(2);
});
it('setup resets the displayed filter and both remote searches together on tab changes',async()=>{
 const querySearch=vi.fn(async(kind:string,request:any)=>({status:'ready',value:{...page(kind),...(kind==='setup_customers'?{customers:[{id:'alpha',displayName:'Alpha',active:true},...request.search?[]:[{id:'beta',displayName:'Beta',active:true}]]}:{})}}));
 render(<SetupView state={state} administration={{querySearch,getState:()=>state} as any}/>);await flush();
 fireEvent.click(screen.getByRole('tab',{name:'Kunden und Projekte'}));
 fireEvent.change(screen.getByLabelText('Suchen'),{target:{value:'Alpha'}});await act(()=>vi.advanceTimersByTimeAsync(300));
 expect(screen.queryByText('Beta')).toBeNull();
 fireEvent.click(screen.getByRole('tab',{name:'Karten'}));
 fireEvent.click(screen.getByRole('tab',{name:'Kunden und Projekte'}));await act(()=>vi.advanceTimersByTimeAsync(300));
 expect(screen.getByLabelText('Suchen')).toHaveValue('');expect(screen.getByText('Beta')).toBeVisible();
 expect(querySearch).toHaveBeenCalledWith('projects',expect.objectContaining({search:null}));
});

it.each(['retry','cancel'])('T117 R5: an uncertain page-two card reassignment remains available for %s',async action=>{
 const customer={id:'customer',displayName:'Neuer Kunde',active:true};
 const tag=(id:string)=>({id,displayName:id,validationFingerprint:'AABBCCDDEEFF',assignmentType:'work',assignmentState:'assigned',activeAssignmentId:'assignment',targetCustomerId:'old',customerDisplayName:'Bisheriger Kunde'});
 let current={...state};let refreshView=()=>{};
 const querySearch=vi.fn(async(kind:string,request:any)=>({status:'ready',value:{...page(kind),...(kind==='setup_customers'?{customers:[customer]}:kind==='setup_tags'?{nfcTags:[tag(request.cursor?'Zweite Karte':'Erste Karte')],nextCursor:request.cursor?null:'next'}:{})}}));
 const prepareReassignment=vi.fn((nfcTagId:string,targetCustomerId:string)=>{current={...current,reassignmentIntent:{commandId:'same-command',nfcTagId,targetCustomerId,expectedActiveAssignmentId:'assignment'}};refreshView();});
 const confirmReassignment=vi.fn(async()=>{});
 const cancelReassignment=vi.fn(()=>{current={...current,reassignmentIntent:null};refreshView();});
 const administration={querySearch,prepareReassignment,confirmReassignment,cancelReassignment,getState:()=>current} as any;
 const view=render(<SetupView state={current} administration={administration}/>);
 refreshView=()=>view.rerender(<SetupView state={current} administration={administration}/>);await flush();
 fireEvent.click(screen.getByRole('tab',{name:'Karten'}));
 fireEvent.click(screen.getByRole('button',{name:'Weitere laden'}));await flush();
 fireEvent.click(screen.getByRole('button',{name:'Zuordnung für Zweite Karte ändern'}));
 const panel=screen.getByRole('dialog',{name:'Zuordnung ändern'});
 fireEvent.click(within(panel).getByRole('button',{name:'Neuer Kunde'}));
 fireEvent.click(within(panel).getByRole('button',{name:'Zuordnung ändern'}));await flush();
 fireEvent.click(screen.getByRole('button',{name:'Änderung ausdrücklich bestätigen'}));await flush();
 expect(current.reassignmentIntent).toMatchObject({commandId:'same-command',nfcTagId:'Zweite Karte'});
 expect(screen.getByRole('button',{name:'Änderung ausdrücklich bestätigen'})).toBeEnabled();
 if(action==='retry'){
  fireEvent.click(screen.getByRole('button',{name:'Änderung ausdrücklich bestätigen'}));await flush();expect(confirmReassignment).toHaveBeenCalledTimes(2);
 }else{
  fireEvent.click(screen.getByRole('button',{name:'Abbrechen'}));await flush();expect(cancelReassignment).toHaveBeenCalledTimes(1);expect(current.reassignmentIntent).toBeNull();
 }
 expect(querySearch.mock.calls.filter(([kind])=>kind==='setup_tags')).toHaveLength(2);
});

it('web: employee and access searches are independent',async()=>{
 const querySearch=vi.fn(async()=>({status:'ready',value:page('memberships')})),refreshManagedPeople=vi.fn();
 render(<EmployeesView state={state} administration={{querySearch,refreshManagedPeople} as any} navigate={()=>{}}/>);await flush();
 fireEvent.change(screen.getByLabelText('Suchen'),{target:{value:'  Mu\u0308ller  '}});await act(()=>vi.advanceTimersByTimeAsync(300));
 expect(refreshManagedPeople).toHaveBeenLastCalledWith(null,false,expect.any(String),'Müller');
 fireEvent.click(screen.getByRole('tab',{name:'Zugänge'}));
 expect(screen.getByLabelText('Suchen')).toHaveValue('');
 fireEvent.change(screen.getByLabelText('Suchen'),{target:{value:'  Ada  '}});await act(()=>vi.advanceTimersByTimeAsync(300));
 expect(querySearch).toHaveBeenLastCalledWith('memberships',expect.objectContaining({search:'Ada'}));
 fireEvent.click(screen.getByRole('tab',{name:'Zeiten'}));expect(screen.getByLabelText('Suchen')).toHaveValue('  Mu\u0308ller  ');
});
it('web: manual search goes to the server after the delay',async()=>{
 const loadWorkTargets=vi.fn();render(<ManualView state={state} administration={{loadWorkTargets} as any}/>);await flush();
 expect(loadWorkTargets).toHaveBeenCalledTimes(1);
 fireEvent.change(screen.getByLabelText('Suchen'),{target:{value:'  Mu\u0308ller  '}});await act(()=>vi.advanceTimersByTimeAsync(300));
 expect(loadWorkTargets).toHaveBeenLastCalledWith('Müller');
});
it.each([false,true])('web: adding time loads only its own first target page (managed=%s)',async managed=>{
 const querySearch=vi.fn(async(kind:string)=>({status:'ready',value:page(kind)})),loadWorkTargets=vi.fn();
 render(<TimeEditingProvider state={state} administration={{querySearch,loadWorkTargets,saveTimeEdit:vi.fn()} as any} targetMembershipId={managed?'20000000-0000-4000-8000-000000000001':id}><AddTimeControl day="2026-10-13"/></TimeEditingProvider>);
 expect(loadWorkTargets).not.toHaveBeenCalled();expect(querySearch).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Zeit hinzufügen'}));await flush();
 expect(querySearch).toHaveBeenCalledTimes(2);expect(querySearch).toHaveBeenCalledWith(managed?'backfill_targets':'work_targets',expect.objectContaining({cursor:null,search:null}));
 expect(screen.getByLabelText('Suchen')).toBeInTheDocument();
});

it.each(['setup_customers','setup_tags','projects','memberships','work_targets','backfill_targets'])
('web %s: current search owns the result, more appends and errors retry the failed page',async kind=>{
 const field=kind==='setup_customers'?'customers':kind==='setup_tags'?'nfcTags':kind==='memberships'?'employeeMemberships':kind==='projects'?'projects':'targets';
 const row=(name:string,n:number)=>({id:`row-${n}`,displayName:name,active:true,role:'employee',rowVersion:1,location:null,projectId:`row-${n}`,targetType:'customer',targetId:`row-${n}`,assignmentState:'unassigned',assignmentType:null,customerDisplayName:null});
 const value=(rows:unknown[],nextCursor:string|null=null)=>({...page(kind),[field]:rows,nextCursor});
 let finishOld!:(v:unknown)=>void;
 const read=vi.fn().mockResolvedValueOnce({status:'ready',value:value([row('Alpha',1)],'page-2')})
  .mockResolvedValueOnce({status:'unavailable'})
  .mockResolvedValueOnce({status:'ready',value:value([row('Zeta',2)])})
  .mockImplementationOnce(()=>new Promise(resolve=>{finishOld=resolve;}))
  .mockResolvedValueOnce({status:'ready',value:value([])})
  .mockResolvedValueOnce({status:'ready',value:value([row('Wieder da',3)])});
 const querySearch=vi.fn((requested:string,request:any)=>request.assignedOnly?Promise.resolve({status:'ready',value:{targets:[],nextCursor:null}}):requested===kind?read(request):Promise.resolve({status:'ready',value:page(requested)}));
 const administration={querySearch,getState:()=>state,refreshManagedPeople:vi.fn(),saveTimeEdit:vi.fn()} as any;
 let panel:HTMLElement;
 if(kind.startsWith('setup_')||kind==='projects'){
  render(<SetupView state={state} administration={administration}/>);
  fireEvent.click(screen.getByRole('tab',{name:kind==='setup_tags'?'Karten':'Kunden und Projekte'}));panel=screen.getByRole('tabpanel');
 }else if(kind==='memberships'){
  render(<EmployeesView state={state} administration={administration} navigate={()=>{}}/>);
  fireEvent.click(screen.getByRole('tab',{name:'Zugänge'}));panel=screen.getByRole('tabpanel');
 }else{
  render(<TimeEditingProvider state={state} administration={administration} targetMembershipId={kind==='backfill_targets'?'another-member':id}><AddTimeControl day="2026-10-13"/></TimeEditingProvider>);
  expect(read).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Zeit hinzufügen'}));panel=document.body;
 }
 await flush();expect(read).toHaveBeenCalledTimes(1);
 const view=within(panel);
 expect(view.getAllByText('Alpha').length).toBeGreaterThan(0);
 fireEvent.click(view.getByText(kind==='projects'?'Weitere Projekte laden':'Weitere laden'));await flush();
 expect(view.getAllByText('Alpha').length).toBeGreaterThan(0);
 fireEvent.click(view.getByText('Erneut versuchen'));await flush();
 expect(read).toHaveBeenLastCalledWith(expect.objectContaining({search:null,cursor:'page-2'}));
 expect(view.getAllByText('Alpha').length).toBeGreaterThan(0);expect(view.getAllByText('Zeta').length).toBeGreaterThan(0);
 fireEvent.change(view.getByLabelText('Suchen'),{target:{value:'  Mu\u0308ller  '}});
 await act(()=>vi.advanceTimersByTimeAsync(299));expect(read).toHaveBeenCalledTimes(3);
 await act(()=>vi.advanceTimersByTimeAsync(1));expect(read).toHaveBeenLastCalledWith(expect.objectContaining({search:'Müller',cursor:null}));
 fireEvent.change(view.getByLabelText('Suchen'),{target:{value:'Neu'}});await act(()=>vi.advanceTimersByTimeAsync(300));
 await act(async()=>finishOld({status:'ready',value:value([row('Veraltet',4)])}));
 expect(view.queryByText('Veraltet')).toBeNull();expect(view.getByText('Keine Treffer für „Neu“')).toBeInTheDocument();
 fireEvent.click(view.getByText('Suche löschen'));await act(()=>vi.advanceTimersByTimeAsync(300));
 expect(read).toHaveBeenLastCalledWith(expect.objectContaining({search:null,cursor:null}));expect(view.getAllByText('Wieder da').length).toBeGreaterThan(0);
});

it('web: employee pages merge into an alphabetic table with a location column, with departed people last',()=>{
 const person=(n:number,name:string,location:string,departedAt:string|null=null)=>({membershipId:`member-${n}`,displayName:name,role:'employee' as const,location:{id:location,name:location},departedAt,isRunning:false,runningSince:null,runningTargetDisplayName:null,monthWorkDurationSeconds:3600});
 const pageOne=[person(1,'Anna','Zürich')],pageTwo=[person(2,'Berta','Aachen'),person(3,'Carla','Zürich'),person(4,'Dora','Aachen','2026-10-13T12:00:00.000Z')];
 const view=render(<PeopleTable people={pageOne} navigate={()=>{}} locationId={null} locationsEnabled month="2026-10"/>);
 view.rerender(<PeopleTable people={[...pageOne,...pageTwo]} navigate={()=>{}} locationId={null} locationsEnabled month="2026-10"/>);
 expect(screen.getAllByRole('heading').map(node=>node.textContent)).toEqual(['Ausgeschiedene Mitarbeiter']);
 expect(screen.getAllByRole('table')).toHaveLength(2);
 expect(screen.getAllByRole('link').map(node=>node.textContent?.slice(1))).toEqual(['Anna','Berta','Carla','Dora']);
});
