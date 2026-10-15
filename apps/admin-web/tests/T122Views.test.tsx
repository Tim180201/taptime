// @vitest-environment jsdom
import {afterEach,beforeAll,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,within,waitFor} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {App} from '../src/App';
import ManualView from '../src/views/ManualView';
import SetupView from '../src/views/SetupView';
import CustomersView from '../src/views/CustomersView';
import {defaultRoute} from '../src/navigation';
import {stateSearch,customerSearch} from './searchFixtures';
import type {AdminWebCapability,AdminWebState} from '../src/contracts';
type Ready=Extract<AdminWebState,{status:'ready'}>;
const org={id:'30000000-0000-4000-8000-000000000001',name:'Beispielbetrieb'};
const target={targetType:'customer' as const,targetId:'40000000-0000-4000-8000-000000000001',displayName:'Werkstatt'};
export function state(overrides:Partial<Ready>={}):Ready{return {status:'ready',membershipId:'70000000-0000-4000-8000-000000000001',role:'administrator',projection:{organization:org,customers:[],nfcTags:[],nextCursor:null,customersComplete:true,nfcTagsComplete:true},employeeProjection:{organization:org,employeeMemberships:[],nextCursor:null},availableSections:['employees','setup','manual_capture','own_time','review_items','time_export'],managementScope:{kind:'organization'},selectedLocation:null,locationsEnabled:false,assignableLocations:[],creating:false,creatingEmployee:false,invitation:null,reassignmentIntent:null,reassigning:false,locationSetup:{locations:[],memberships:[],workTargets:[],activationGaps:[]},locationSetupBusy:false,timeRecords:[],timeRecordsNextCursor:null,reviewItems:[],reviewItemsNextCursor:null,sections:{setup:{status:'ready'},employees:{status:'ready'},timeRecords:{status:'ready'},reviewItems:{status:'ready'}},timeWindow:{fromInclusive:'2026-10-01T00:00:00.000Z',toExclusive:'2026-10-15T00:00:00.000Z'},timeReviewBusy:false,correctionIntent:null,adjudicationIntent:null,notice:null,completedAction:null,workTargets:{status:'ready',value:[target]},calendar:{status:'ready',targetMembershipId:null,month:'2026-10',value:{activeRecord:null,records:[],nextCursor:null,windowStartedAt:'2026-10-01T00:00:00.000Z',windowEndedAt:'2026-10-15T00:00:00.000Z'}},manual:{busy:false,pending:false,message:null},...overrides} as Ready;}
function capability(s:Ready){return {getState:()=>s,subscribe:()=>()=>{},selectLocation:vi.fn(async()=>{}),refresh:vi.fn(async()=>{}),signOut:vi.fn(),refreshLocationSetup:vi.fn(),refreshManagedPeople:vi.fn(),loadOwnTime:vi.fn(),loadWorkTargets:vi.fn(),captureManual:vi.fn(),querySearch:stateSearch(()=>s),createCustomer:vi.fn(async()=>{}),dismissInvitation:vi.fn()} as unknown as AdminWebCapability;}
afterEach(()=>{cleanup();window.history.replaceState(null,'','/');});
beforeAll(()=>{HTMLDialogElement.prototype.showModal=function(){this.open=true;};HTMLDialogElement.prototype.close=function(){this.open=false;};});
it('shell groups routes, exposes icon refresh, footer and accessible help',async()=>{
 const s=state();render(<App administration={capability(s)}/>);
 expect(await screen.findByText('Arbeit',{exact:true})).toBeVisible();expect(screen.getByText('Verwaltung',{exact:true})).toBeVisible();
 expect(screen.getByRole('button',{name:'Alle Bereiche aktualisieren'})).toHaveAttribute('title','Alle Bereiche aktualisieren');
 expect(screen.getByRole('contentinfo')).toHaveTextContent('Deutsche Ortszeit');
 fireEvent.click(screen.getByRole('button',{name:'So funktioniert Taptura'}));
 expect(screen.getByRole('dialog',{name:'So funktioniert Taptura'})).toHaveTextContent('Erfassen mit Karte');
});
it('manual separates choice and action, keeps event dispatch unchanged',()=>{
 const s=state(),cap=capability(s);render(<ManualView state={s} administration={cap}/>);
 expect(screen.getByRole('heading',{name:'1 · Wofür?'})).toBeVisible();expect(screen.getByRole('heading',{name:'2 · Starten'})).toBeVisible();
 fireEvent.click(screen.getByRole('button',{name:'Werkstatt'}));
 fireEvent.click(screen.getByRole('button',{name:/Zeit starten/}));expect(cap.captureManual).toHaveBeenCalledExactlyOnceWith(target);
});
it('running manual locks step one and has one filled stop action including while paused',()=>{
 const base=state();const s=state({calendar:{...base.calendar!,status:'ready',targetMembershipId:null,month:'2026-10',value:{...(base.calendar as any).value,activeRecord:{timeRecordId:'time',targetDisplayName:'Werkstatt',startedAt:'2026-10-15T06:00:00.000Z',breakStartedAt:'2026-10-15T07:00:00.000Z'}}}});
 const cap=capability(s);const {container}=render(<ManualView state={s} administration={cap}/>);
 expect(screen.getByRole('group',{name:'Wofür wird die Zeit erfasst?'})).toBeDisabled();
 expect(container.querySelectorAll('.primary-action')).toHaveLength(1);
 fireEvent.click(screen.getByRole('button',{name:'Zeit beenden'}));expect(cap.captureManual).toHaveBeenCalledWith('stop');
});
it('setup uses four tabs and customer creation has moved out',async()=>{
 const s=state();render(<SetupView state={s} administration={capability(s)}/>);
 expect(await screen.findByRole('tab',{name:'Standorte'})).toHaveAttribute('aria-selected','true');
 for(const name of ['Mitarbeiter','Kunden und Projekte','Karten'])expect(screen.getByRole('tab',{name})).toBeVisible();
 fireEvent.click(screen.getByRole('tab',{name:'Kunden und Projekte'}));
 expect(screen.queryByRole('button',{name:'Kunde anlegen'})).toBeNull();
 expect(screen.getByRole('button',{name:'+ Projekt'})).toBeVisible();
});
it('customer creation uses the existing capability, a labelled sheet and name/location',async()=>{
 const s=state({locationsEnabled:true,assignableLocations:[{id:'north',name:'Nord'}]});
 const cap=capability(s);cap.querySearch=customerSearch(async()=>({status:'ready',value:{version:'customer-hours.v2',asOf:'2026-10-15T12:00:00.000Z',scope:'people',customers:[]}}));
 render(<CustomersView administration={cap} route={defaultRoute('kunden')} navigate={vi.fn()}/>);
 fireEvent.click(await screen.findByRole('button',{name:'+ Kunde anlegen'}));
 const sheet=screen.getByRole('dialog',{name:'Kunde anlegen'});
 fireEvent.change(within(sheet).getByLabelText('Name'),{target:{value:'Familie Özkan'}});
 fireEvent.click(within(sheet).getByRole('button',{name:'Kunde anlegen'}));
 await waitFor(()=>expect(cap.createCustomer).toHaveBeenCalledExactlyOnceWith('Familie Özkan','north'));
});
it('puts the server-confirmed new customer first even beyond the first alphabetical page',async()=>{
 let current=state();
 const row=(id:string,name:string)=>({customerId:id,displayName:name,active:true,workDurationSeconds:0,running:false});
 const cap={...capability(current),getState:()=>current,createCustomer:vi.fn(async()=>{current={...current,completedAction:'customer_created'};}),querySearch:vi.fn(async(_kind:string,request:any)=>({status:'ready',value:{version:'customer-hours.v3',scope:'people',asOf:'2026-10-15T12:00:00.000Z',customers:request.search?[row('new','Zweiter Kunde')]:[row('old','Alpha')],nextCursor:request.search?null:'more'}}))} as unknown as AdminWebCapability;
 render(<CustomersView administration={cap} route={defaultRoute('kunden')} navigate={vi.fn()}/>);
 await screen.findByRole('button',{name:'Alpha'});
 fireEvent.click(screen.getByRole('button',{name:'+ Kunde anlegen'}));
 fireEvent.change(screen.getByLabelText('Name'),{target:{value:'Zweiter Kunde'}});
 fireEvent.click(screen.getByRole('button',{name:'Kunde anlegen'}));
 await waitFor(()=>expect(screen.queryByRole('dialog',{name:'Kunde anlegen'})).toBeNull());
 const rows=within(screen.getByRole('table')).getAllByRole('row');
 expect(rows[1]).toHaveTextContent('Zweiter Kunde');expect(rows[2]).toHaveTextContent('Alpha');
});
it('manual search failures leave retry and refresh reachable',()=>{
 const s=state({workTargets:{status:'ready',value:[target],failed:true}}),cap=capability(s);
 render(<ManualView state={s} administration={cap}/>);
 expect(screen.getByRole('button',{name:'Erneut versuchen'})).toBeEnabled();
 expect(screen.getByRole('button',{name:'Alle Bereiche aktualisieren'})).toBeEnabled();
 fireEvent.click(screen.getByRole('button',{name:'Erneut versuchen'}));
 expect(cap.loadWorkTargets).toHaveBeenLastCalledWith(null,true);
});
it.each(['loading','unavailable'] as const)('manual cannot submit before the own calendar is known (%s)',status=>{
 const s=state({calendar:{status,message:'Bitte erneut laden.'} as Ready['calendar']}),cap=capability(s);
 const {container}=render(<ManualView state={s} administration={cap}/>);
 fireEvent.click(screen.getByRole('button',{name:'Werkstatt'}));
 fireEvent.submit(container.querySelector('form')!);
 expect(cap.captureManual).not.toHaveBeenCalled();
});
it('customer rows open from their hours cell and detail uses metrics and a person table',async()=>{
 const s=state(),cap=capability(s),navigate=vi.fn();
 const customer={customerId:'one',displayName:'Werkstatt',active:true,workDurationSeconds:3600,running:false,quotaSeconds:null,quotaStage:'none',people:[{membershipId:'person',displayName:'Ada',workDurationSeconds:3600,running:false}]};
 cap.querySearch=customerSearch(async()=>({status:'ready',value:{version:'customer-hours.v2',asOf:'2026-10-15T12:00:00.000Z',scope:'people',customers:[customer]}})) as AdminWebCapability['querySearch'];
 const view=render(<CustomersView administration={cap} route={defaultRoute('kunden')} navigate={navigate}/>);
 fireEvent.click(await screen.findByText('1:00 h'));
 expect(navigate).toHaveBeenCalledWith(expect.objectContaining({customerId:'one'}));
 view.rerender(<CustomersView administration={cap} route={{...defaultRoute('kunden'),customerId:'one'}} navigate={navigate}/>);
 expect(await screen.findByRole('table',{name:'Stunden je Person'})).toBeVisible();
 expect(view.container.querySelectorAll('.metric-card')).toHaveLength(2);
 expect(within(screen.getByRole('banner')).getByRole('button',{name:'Kunde umbenennen'})).toBeVisible();
});
