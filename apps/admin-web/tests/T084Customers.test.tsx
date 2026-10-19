import {customerSearch} from './searchFixtures';
// @vitest-environment jsdom
import { beforeAll, afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { CustomerHoursResponse } from '@taptime/mobile-work-contract';
import type { AdminWebCapability } from '../src/contracts';
import CustomerPage from '../src/views/CustomersView';
import {useState, type ComponentProps} from 'react';
function CustomersView(props:ComponentProps<typeof CustomerPage>){
 const [route,setRoute]=useState(props.route);
 return <CustomerPage {...props} route={route} navigate={next=>{setRoute(next);props.navigate(next);}}/>;
}
import { defaultRoute } from '../src/navigation';
import { AdminWebApiClient } from '../src/AdminWebApiClient';
const cid='40000000-0000-4000-8000-000000000001',mid='70000000-0000-4000-8000-000000000001';
const customer={customerId:cid,displayName:'Werkstatt',active:false,workDurationSeconds:7200,running:true};
const own:CustomerHoursResponse={version:'customer-hours.v1',scope:'self',asOf:'2026-09-28T08:00:00.000Z',customers:[{...customer,days:[{date:'2026-09-28',workDurationSeconds:7200,running:true}]}]};
const people:CustomerHoursResponse={...own,scope:'people',customers:[{...customer,people:[{membershipId:mid,displayName:'Person B',workDurationSeconds:7200,running:true}]}]};
beforeAll(()=>{HTMLDialogElement.prototype.showModal=function(){this.open=true;};HTMLDialogElement.prototype.close=function(){this.open=false;};});
afterEach(()=>{cleanup();vi.useRealTimers();});
it.each([own,people])('shows server-delivered $scope breakdown, running state and month controls',async value=>{
  vi.setSystemTime(new Date('2026-09-28T08:00Z'));
  const readCustomerHours=vi.fn(async()=>({status:'ready' as const,value})),navigate=vi.fn();
  render(<CustomersView administration={{getState:()=>({status:'ready',role:'administrator'}),readCustomerHours,querySearch:customerSearch(readCustomerHours)} as unknown as AdminWebCapability} route={defaultRoute('kunden')} navigate={navigate}/>);
  fireEvent.click(await screen.findByRole('button',{name:/Werkstatt/}));
  expect(await screen.findByRole('heading',{name:value.scope==='self'?'Ihre Stunden je Tag':'Stunden je Person'})).toBeInTheDocument();
  expect(screen.getByText(value.scope==='self'?'28.09.2026':'Person B')).toBeInTheDocument();
  expect(screen.getAllByText(/läuft/).length).toBeGreaterThan(0);
  expect(screen.getByText('gelöscht')).toBeInTheDocument();
  expect(screen.getByRole('button',{name:'Monat: September 2026'})).toBeVisible();
  fireEvent.click(screen.getByRole('button',{name:'Voriger Monat'}));
  expect(navigate).toHaveBeenCalledWith({...defaultRoute('kunden'),customerId:cid,month:'2026-08'});
});
it('distinguishes empty and unavailable, retries and does not show stale response after a month change',async()=>{
 const readCustomerHours=vi.fn<NonNullable<AdminWebCapability['readCustomerHours']>>().mockResolvedValueOnce({status:'unavailable'}).mockResolvedValueOnce({status:'ready',value:{...own,customers:[]}});
 render(<CustomersView administration={{getState:()=>({status:'ready',role:'administrator'}),readCustomerHours,querySearch:customerSearch(readCustomerHours)} as unknown as AdminWebCapability} route={defaultRoute('kunden')} navigate={()=>{}}/>);
 expect(await screen.findByRole('alert')).toHaveTextContent('konnten nicht geladen');
 fireEvent.click(screen.getByText('Erneut versuchen'));
 expect(await screen.findByText('Für Ihren Bereich sind noch keine Kunden mit einer aktiven Zuordnung oder Stunden vorhanden.')).toBeInTheDocument();
});
it('web client accepts exact self schema and rejects a person breakdown in self scope',async()=>{
 const fetcher=vi.fn<typeof fetch>(async()=>new Response(JSON.stringify(own),{headers:{'content-type':'application/json'}}));
 const api=new AdminWebApiClient(fetcher),request={expectedMembershipId:mid,fromInclusive:'2026-08-31T22:00:00.000Z',toExclusive:'2026-09-30T22:00:00.000Z'};
 await expect(api.customerHours('synthetic',request)).resolves.toEqual({status:'succeeded',value:own});
 fetcher.mockResolvedValueOnce(new Response(JSON.stringify({...people,scope:'self'}),{headers:{'content-type':'application/json'}}));
 await expect(api.customerHours('synthetic',request)).resolves.toEqual({status:'invalid_response'});
 expect(fetcher.mock.calls[0]![0]).toBe('/v1/customers/hours/query');
});
it('T100 allows rename and requires explicit deletion confirmation, preserving the running-time message',async()=>{
 const value:CustomerHoursResponse={...people,customers:people.customers.map(c=>({...c,active:true}))};
 const manageCustomer=vi.fn<NonNullable<AdminWebCapability['manageCustomer']>>().mockResolvedValue({status:'running_time'});
 const readCustomerHours=vi.fn(async()=>({status:'ready' as const,value}));
 render(<CustomersView administration={{getState:()=>({status:'ready',role:'administrator'}),readCustomerHours,querySearch:customerSearch(readCustomerHours),manageCustomer} as unknown as AdminWebCapability} route={defaultRoute('kunden')} navigate={()=>{}}/>);
 fireEvent.click(await screen.findByRole('button',{name:/Werkstatt/}));
 fireEvent.click(await screen.findByText('Kunde löschen'));
 expect(screen.getByRole('alertdialog',{name:'Kunde löschen'})).toHaveTextContent('Kunde Werkstatt löschen?Danach steht Werkstatt im Archiv. Die Zeiten bleiben im Lohnexport und bei den Kundenzeiten. Zugeordnete Karten werden frei. Das lässt sich nicht rückgängig machen.');
 expect(manageCustomer).not.toHaveBeenCalled();
 fireEvent.click(screen.getByText('Löschen bestätigen'));
 expect(await screen.findByText('Erst die laufende Zeit beenden')).toBeInTheDocument();
 expect(manageCustomer).toHaveBeenCalledWith(cid,{action:'deactivate'});
 fireEvent.click(screen.getByText('Abbrechen'));
 fireEvent.click(screen.getByText('Kunde umbenennen'));
 fireEvent.change(screen.getByLabelText('Neuer Kundenname'),{target:{value:'Bestehender Name'}});
 manageCustomer.mockResolvedValueOnce({status:'succeeded'});
 fireEvent.click(screen.getByText('Namen speichern'));
 await screen.findByRole('button',{name:'Kunde umbenennen'});
 expect(manageCustomer).toHaveBeenLastCalledWith(cid,{action:'rename',displayName:'Bestehender Name'});
 await waitFor(()=>expect(readCustomerHours).toHaveBeenCalledTimes(3));
});
