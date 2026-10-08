// @vitest-environment jsdom
import {createElement as h} from 'react';
import {act,cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import type {AdminSetupCapability} from '../../src/administration/contracts';
import type {MobileWorkCapability} from '../../src/work/contracts';
const native=vi.hoisted(()=>({backs:[] as (()=>boolean)[],refresh:null as null|{onRefresh:()=>void;enabled?:boolean}}));
vi.mock('react-native',async()=>({...await vi.importActual<typeof import('react-native')>('react-native-web'),
 RefreshControl:(props:{onRefresh:()=>void;enabled?:boolean;children?:import('react').ReactNode})=>{native.refresh=props;return h('div',{},props.children);},
 BackHandler:{addEventListener:(_event:string,callback:()=>boolean)=>{native.backs.push(callback);return{remove(){native.backs=native.backs.filter(c=>c!==callback);}};}},
 AccessibilityInfo:{announceForAccessibility:vi.fn(),isReduceMotionEnabled:async()=>true,addEventListener:()=>({remove(){}})},
}));
vi.mock('../../src/design/AppBuildIdentity',()=>({AppBuildIdentity:()=>null}));
const {CustomersScreen}=await import('../../src/screens/CustomersScreen');
const {AdminSetupScreen}=await import('../../src/screens/AdminSetupScreen');
const {SynchronizationScreen}=await import('../../src/screens/SynchronizationScreen');
const {ScanScreen}=await import('../../src/screens/ScanScreen');
vi.mock('../../src/design/ScanRing',()=>({ScanRing:()=>null}));
afterEach(()=>{cleanup();native.refresh=null;native.backs=[];vi.useRealTimers();});
const empty={status:'ready',projection:{organization:{name:'Beispielbetrieb'},customers:[],nfcTags:[],nextCursor:null},outcome:null} as const;
it('prevents list refresh while the customer form is open and refreshes after closing a changed form',async()=>{
 const readCustomerHours=vi.fn(async()=>({status:'ready',value:{scope:'people',asOf:'2026-10-06T08:42:00Z',customers:[]}}));
 let setupState:unknown=empty;
 const administration={getState:()=>setupState,subscribe:()=>()=>{},createCustomer:vi.fn(async()=>{setupState={...empty,outcome:{status:'customer_created',customerId:'new-customer'}};}),prepareCustomer:async()=>({status:'ready',locations:[],locationsEnabled:false})} as unknown as AdminSetupCapability;
 render(h(CustomersScreen,{work:{readCustomerHours} as unknown as MobileWorkCapability,authorityContext:{role:'administrator'},administration}));
 await screen.findByText(/Stand 10:42/);
 expect(native.refresh).not.toBeNull();
 await act(async()=>native.refresh!.onRefresh());
 expect(readCustomerHours).toHaveBeenCalledTimes(2);
 fireEvent.click(screen.getByRole('button',{name:'+ Kunde hinzufügen'}));
 await screen.findByLabelText('Name des neuen Kunden');
 const before=readCustomerHours.mock.calls.length;
 await act(async()=>native.refresh?.onRefresh());
 expect(readCustomerHours).toHaveBeenCalledTimes(before);
 fireEvent.change(screen.getByLabelText('Name des neuen Kunden'),{target:{value:'Neuer Kunde'}});
 await act(async()=>fireEvent.click(screen.getByRole('button',{name:'Nur anlegen'})));
 await waitFor(()=>expect(readCustomerHours).toHaveBeenCalledTimes(before+1));
 expect(screen.queryByLabelText('Name des neuen Kunden')).toBeNull();
});
it('Android back cancels a card scan before leaving the assignment form',async()=>{
 let state:unknown=empty;const listeners=new Set<()=>void>();
 const cancel=vi.fn(async()=>{state=empty;listeners.forEach(f=>f());});
 const administration={getState:()=>state,subscribe:(f:()=>void)=>{listeners.add(f);return()=>listeners.delete(f);},cancel,refresh:vi.fn(async()=>{})} as unknown as AdminSetupCapability;
 render(h(AdminSetupScreen,{administration}));
 fireEvent.click(screen.getByRole('button',{name:'Karte einrichten'}));
 await act(async()=>{state={...empty,status:'capturing'};listeners.forEach(f=>f());});
 await act(async()=>{[...native.backs].reverse().some(f=>f());});
 expect(cancel).toHaveBeenCalledOnce();
 expect(screen.getByLabelText('Bezeichnung der Karte')).toBeDefined();
 await act(async()=>{[...native.backs].reverse().some(f=>f());});
 expect(screen.queryByLabelText('Bezeichnung der Karte')).toBeNull();
});
it('puts sign out in an explicit account section',()=>{
 const state={status:'ready',outcome:null};const signOut=vi.fn();
 render(h(SynchronizationScreen,{scan:{subscribe:()=>()=>{},getState:()=>state} as never,signOut}));
 expect(screen.getByRole('heading',{name:'Konto'})).toBeDefined();
 fireEvent.click(screen.getByRole('button',{name:'Abmelden'}));expect(signOut).toHaveBeenCalledOnce();
});
it('explains why active controls are locked after an unconfirmed capture',()=>{
 const activeRecord={timeRecordId:'entry',targetDisplayName:'Beispielkunde',startedAt:'2026-10-06T07:00Z',breakStartedAt:null};
 const state={status:'ready',capturePending:true,submitting:false,ownTime:{activeRecord,records:[]},targets:{targets:[]}};
 const work={getState:()=>state,subscribe:()=>()=>{}} as never;
 const scanState={status:'ready' as const,outcome:null};
 const scan={getState:()=>scanState,subscribe:()=>()=>{}} as never;
 render(h(ScanScreen,{actor:'employee',work,scan,signOut:async()=>{},retryRecovery:async()=>{}}));
 expect(screen.getByText('Deine letzte Erfassung wartet noch auf Bestätigung.')).toBeDefined();
});

it('does not label a cached card projection with the reopening time or a failed refresh time',async()=>{
 vi.setSystemTime(new Date('2026-10-06T08:00:00Z'));
 let state:unknown=empty;const listeners=new Set<()=>void>();let finish!:(s:unknown)=>void;
 const refresh=vi.fn(()=>new Promise<void>(resolve=>{state={status:'loading'};listeners.forEach(f=>f());finish=next=>{state=next;listeners.forEach(f=>f());resolve();};}));
 const administration={getState:()=>state,subscribe:(f:()=>void)=>{listeners.add(f);return()=>listeners.delete(f);},refresh,cancel:vi.fn()} as unknown as AdminSetupCapability;
 const first=render(h(AdminSetupScreen,{administration}));
 expect(refresh).toHaveBeenCalledOnce();expect(screen.queryByText(/Stand /)).toBeNull();
 await act(async()=>finish({...empty,projection:{...empty.projection}}));
 expect(screen.getByText('Stand 10:00')).toBeDefined();first.unmount();
 vi.setSystemTime(new Date('2026-10-06T08:30:00Z'));
 render(h(AdminSetupScreen,{administration}));
 expect(refresh).toHaveBeenCalledTimes(2);expect(screen.queryByText('Stand 10:30')).toBeNull();
 await act(async()=>finish({status:'inactive'}));
 expect(screen.queryByText('Stand 10:30')).toBeNull();
});
it.each(['capturing','writing','submitting','creating_customer'])('entering cards preserves a protected %s operation',status=>{
 const refresh=vi.fn();const state={...empty,status};
 render(h(AdminSetupScreen,{administration:{getState:()=>state,subscribe:()=>()=>{},refresh,cancel:vi.fn()} as unknown as AdminSetupCapability}));
 expect(refresh).not.toHaveBeenCalled();
});
