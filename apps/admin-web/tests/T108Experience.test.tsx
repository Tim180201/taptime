// @vitest-environment jsdom
import {useState} from 'react';
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import {canonicalRoutePath,defaultRoute,routeFromLocation,type AdminRoute} from '../src/navigation';
import type {AdminWebCapability} from '../src/contracts';
import CustomersView from '../src/views/CustomersView';
import PersonView from '../src/views/PersonView';
const id='40000000-0000-4000-8000-000000000001';
afterEach(cleanup);
it('roundtrips the selected customer and keeps the month and location',()=>{
 const path=`/kunden?monat=2026-10&kunde=${id}`;
 expect(canonicalRoutePath(routeFromLocation('/kunden',path.slice(7)))).toBe(path);
 expect(canonicalRoutePath(routeFromLocation('/kunden','?kunde=invalid'))).toBe('/kunden');
});
it('navigates to customer details and restores keyboard focus on return',async()=>{
 const navigate=vi.fn();
 const value={scope:'self',asOf:'2026-10-06T08:42:00Z',customers:[{customerId:id,displayName:'Beispielkunde',active:true,workDurationSeconds:0,running:false,days:[]}]};
 const administration={readCustomerHours:async()=>({status:'ready',value})} as unknown as AdminWebCapability;
 function Routed(){const [route,setRoute]=useState(defaultRoute('kunden'));return <CustomersView administration={administration} route={route} navigate={next=>{navigate(next);setRoute(next);}}/>;}
 render(<Routed/>);
 const card=await screen.findByRole('button',{name:/Beispielkunde/});
 card.focus();fireEvent.click(card);
 expect(navigate).toHaveBeenCalled();
 expect(canonicalRoutePath(navigate.mock.calls[0]![0] as AdminRoute)).toContain(`kunde=${id}`);
 await waitFor(()=>expect(screen.getByRole('heading',{name:'Beispielkunde'})).toHaveFocus());
 fireEvent.click(screen.getByRole('button',{name:'Zur Kundenliste'}));
 await waitFor(()=>expect(screen.getByRole('button',{name:/Beispielkunde/})).toHaveFocus());
});
it('does not expose an anonymous calendar or resend action while identity is unresolved',async()=>{
 const state={status:'ready',selectedLocation:null,managedPeople:undefined,calendar:{status:'ready',targetMembershipId:id,month:'2026-10',value:{activeRecord:null,records:[],nextCursor:null,windowStartedAt:'2026-09-30T22:00Z',windowEndedAt:'2026-10-06T08:00Z'}}} as unknown as Parameters<typeof PersonView>[0]['state'];
 const administration={getState:()=>state,loadPersonTime:vi.fn(),refreshManagedPeople:()=>new Promise<void>(()=>{})} as unknown as AdminWebCapability;
 render(<PersonView state={state} administration={administration} route={{...defaultRoute('beschaeftigte'),personId:id,month:'2026-10'}} navigate={()=>{}} accountInvitations={{resend:vi.fn()} as never}/>);
 expect(screen.getByText('Person wird geladen …')).toBeInTheDocument();
 expect(screen.queryByText('Zeit hinzufügen')).not.toBeInTheDocument();
 expect(screen.queryByText('Einladung erneut senden')).not.toBeInTheDocument();
});
it('resolves a direct link through authorized pages and shows not found when exhausted',async()=>{
 let state={status:'ready',selectedLocation:null,managedPeople:undefined} as unknown as Parameters<typeof PersonView>[0]['state'];
 const refreshManagedPeople=vi.fn(async(_filter?:boolean|null,append?:boolean)=>{
  state={...state,managedPeople:{status:'ready',isRunning:null,value:{people:append?[]:[{membershipId:'other'}],nextCursor:append?null:'next'}}} as never;
 });
 const administration={getState:()=>state,refreshManagedPeople,loadPersonTime:vi.fn()} as unknown as AdminWebCapability;
 render(<PersonView state={state} administration={administration} route={{...defaultRoute('beschaeftigte'),personId:id}} navigate={()=>{}}/>);
 expect(await screen.findByText('Person nicht gefunden')).toBeInTheDocument();
 expect(refreshManagedPeople).toHaveBeenCalledWith(null,true);
 expect(administration.loadPersonTime).not.toHaveBeenCalled();
});

it('loads the named person from a later page before enabling their calendar',async()=>{
 let state={status:'ready',membershipId:'manager',role:'administrator',selectedLocation:null} as unknown as Parameters<typeof PersonView>[0]['state'];
 const loadPersonTime=vi.fn();
 const refreshManagedPeople=vi.fn(async(_filter?:boolean|null,append?:boolean)=>{
  state={...state,managedPeople:{status:'ready',isRunning:null,value:{people:append?[{membershipId:id,displayName:'Erika Beispiel'}]:[],nextCursor:append?null:'next'}}} as never;
 });
 const administration={getState:()=>state,refreshManagedPeople,loadPersonTime,loadWorkTargets:vi.fn()} as unknown as AdminWebCapability;
 render(<PersonView state={state} administration={administration} route={{...defaultRoute('beschaeftigte'),personId:id,month:'2026-10'}} navigate={()=>{}}/>);
 expect(await screen.findByRole('heading',{name:'Erika Beispiel'})).toBeInTheDocument();
 expect(loadPersonTime).toHaveBeenCalledWith(id,'2026-10');
});
it('ignores a pending person lookup after the authority changes',async()=>{
 type Ready=Parameters<typeof PersonView>[0]['state'];
 let finish!:()=>void;
 let state={status:'ready',membershipId:'manager',role:'administrator',selectedLocation:null} as unknown as Ready;
 const refreshManagedPeople=vi.fn().mockImplementationOnce(()=>new Promise<void>(resolve=>{finish=resolve;})).mockImplementationOnce(async()=>{
   state={...state,managedPeople:{status:'ready',isRunning:null,value:{people:[],nextCursor:null}}} as never;
 });
 const administration={getState:()=>state,refreshManagedPeople,loadPersonTime:vi.fn()} as unknown as AdminWebCapability;
 const props={administration,route:{...defaultRoute('beschaeftigte'),personId:id},navigate:()=>{}};
 const view=render(<PersonView {...props} state={state}/>);
 state={...state,membershipId:'another-manager'};
 view.rerender(<PersonView {...props} state={state}/>);
 expect(await screen.findByText('Person nicht gefunden')).toBeInTheDocument();
 finish();
 await waitFor(()=>expect(screen.queryByRole('heading',{name:'Erika Beispiel'})).not.toBeInTheDocument());
 expect(administration.loadPersonTime).not.toHaveBeenCalled();
});
