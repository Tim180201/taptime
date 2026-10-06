// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { CustomerHoursResponse } from '@taptime/mobile-work-contract';
import { isCustomerHoursResponse, parseQuotaHours, unseenQuotaNotices } from '@taptime/mobile-work-contract';
import type { AdminWebCapability } from '../src/contracts';
import CustomerPage from '../src/views/CustomersView';
import {useState, type ComponentProps} from 'react';
function CustomersView(props:ComponentProps<typeof CustomerPage>){
 const [route,setRoute]=useState(props.route);
 return <CustomerPage {...props} route={route} navigate={next=>{setRoute(next);props.navigate(next);}}/>;
}
import { CustomerQuotaNotice } from '../src/QuotaNotice';
import { defaultRoute } from '../src/navigation';
const cid='40000000-0000-4000-8000-000000000001',mid='70000000-0000-4000-8000-000000000001';
const quota:CustomerHoursResponse={version:'customer-hours.v2',scope:'people',asOf:'2026-09-28T08:00:00.000Z',customers:[{customerId:cid,displayName:'Werkstatt',active:true,workDurationSeconds:129600,running:true,quotaSeconds:144000,quotaStage:'warning',people:[{membershipId:mid,displayName:'Person B',workDurationSeconds:129600,running:true}]}]};
afterEach(()=>{cleanup();vi.useRealTimers();});
it('administrator edits half hours, invalid input and removal; list and detail show progress',async()=>{
 vi.setSystemTime(new Date('2026-09-28T08:00Z'));
 const setCustomerQuota=vi.fn(async()=>({status:'succeeded' as const}));
 const administration={getState:()=>({status:'ready',role:'administrator'}),readCustomerHours:async()=>({status:'ready',value:quota}),setCustomerQuota} as unknown as AdminWebCapability;
 render(<CustomersView administration={administration} route={defaultRoute('kunden')} navigate={()=>{}}/>);
 expect(await screen.findByText('36:00 von 40 h')).toBeInTheDocument();expect(screen.getByText('Kontingent fast erreicht')).toBeInTheDocument();
 fireEvent.click(screen.getByRole('button',{name:/Werkstatt/}));fireEvent.click(screen.getByText('Ändern'));
 fireEvent.change(screen.getByLabelText('Stunden pro Monat (optional)'),{target:{value:'40,25'}});fireEvent.click(screen.getByText('Kontingent speichern'));
 expect(await screen.findByRole('alert')).toHaveTextContent('halben oder ganzen');expect(setCustomerQuota).not.toHaveBeenCalled();
 fireEvent.change(screen.getByLabelText('Stunden pro Monat (optional)'),{target:{value:'40,5'}});fireEvent.click(screen.getByText('Kontingent speichern'));
 await waitFor(()=>expect(setCustomerQuota).toHaveBeenCalledWith(cid,2430));await screen.findByText('Ändern');fireEvent.click(screen.getByText('Ändern'));
 fireEvent.change(screen.getByLabelText('Stunden pro Monat (optional)'),{target:{value:''}});fireEvent.click(screen.getByText('Kontingent speichern'));
 await waitFor(()=>expect(setCustomerQuota).toHaveBeenLastCalledWith(cid,null));
});
it('notice appears once per member/customer/month/stage; opening detail acknowledges',async()=>{
 vi.setSystemTime(new Date('2026-09-28T08:00Z'));
 const saved=new Map<string,string>(),storage={read:async(key:string)=>saved.get(key)??null,write:async(key:string)=>{saved.set(key,'1');}};
 const administration={readCustomerHours:vi.fn(async()=>({status:'ready',value:quota}))} as unknown as AdminWebCapability,onView=vi.fn();
 const props={administration,membership:mid,role:'administrator',authorityContext:'one',onView,storage};
 const view=render(<CustomerQuotaNotice {...props}/>);expect(await screen.findByText(/fast erreicht/)).toBeInTheDocument();
 fireEvent.click(screen.getByText('Ansehen'));await waitFor(()=>expect(onView).toHaveBeenCalledWith(cid,'2026-09'));
 view.rerender(<CustomerQuotaNotice {...props} authorityContext="two"/>);await waitFor(()=>expect(administration.readCustomerHours).toHaveBeenCalledTimes(2));expect(screen.queryByText(/fast erreicht/)).toBeNull();
 view.rerender(<CustomerQuotaNotice {...props} membership={cid}/>);expect(await screen.findByText(/fast erreicht/)).toBeInTheDocument();
 view.rerender(<CustomerQuotaNotice {...props} role="employee"/>);expect(screen.queryByText(/fast erreicht/)).toBeNull();
 const exceeded:CustomerHoursResponse={...quota,scope:'people',customers:quota.scope==='people'?quota.customers.map(c=>({...c,quotaStage:'exceeded'})):[]};
 expect(await unseenQuotaNotices(exceeded,mid,'2026-09',storage)).toHaveLength(1);
 expect(await unseenQuotaNotices(quota,mid,'2026-10',storage)).toHaveLength(1);
});
it('late result from previous membership never displays after account or role change',async()=>{
 let finish!:(v:unknown)=>void;
 const administration={readCustomerHours:()=>new Promise(resolve=>{finish=resolve;})} as unknown as AdminWebCapability;
 const view=render(<CustomerQuotaNotice administration={administration} membership={mid} role="administrator" authorityContext="old" onView={()=>{}}/>);
 view.rerender(<CustomerQuotaNotice administration={administration} membership={cid} role="employee" authorityContext="new" onView={()=>{}}/>);
 finish({status:'ready',value:quota});await waitFor(()=>expect(screen.queryByText(/Kontingent/)).toBeNull());
});
it('strict v2 parser never accepts quota fields for employees and validates stage from seconds',()=>{
 expect(isCustomerHoursResponse(quota)).toBe(true);
 const employee={...quota,scope:'self',customers:quota.customers.map(c=>{const {people,...base}=c as any;return {...base,days:[{date:'2026-09-28',workDurationSeconds:c.workDurationSeconds,running:true}]};})};
 expect(isCustomerHoursResponse(employee)).toBe(false);
 expect(isCustomerHoursResponse({...quota,customers:quota.customers.map(c=>({...c,quotaStage:'ok'}))})).toBe(false);
 expect(['0','744,5','-1','0,25'].map(parseQuotaHours)).toEqual([undefined,undefined,undefined,undefined]);
});
