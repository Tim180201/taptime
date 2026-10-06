// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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
afterEach(()=>{cleanup();vi.useRealTimers();});
it.each([own,people])('shows server-delivered $scope breakdown, running state and month controls',async value=>{
  vi.setSystemTime(new Date('2026-09-28T08:00Z'));
  const readCustomerHours=vi.fn(async()=>({status:'ready' as const,value})),navigate=vi.fn();
  render(<CustomersView administration={{readCustomerHours} as unknown as AdminWebCapability} route={defaultRoute('kunden')} navigate={navigate}/>);
  fireEvent.click(await screen.findByRole('button',{name:/Werkstatt/}));
  expect(screen.getByRole('heading',{name:value.scope==='self'?'Ihre Stunden je Tag':'Stunden je Person'})).toBeInTheDocument();
  expect(screen.getByText(value.scope==='self'?'28.09.2026':'Person B')).toBeInTheDocument();
  expect(screen.getAllByText(/läuft/).length).toBeGreaterThan(0);
  expect(screen.getByText('inaktiv')).toBeInTheDocument();
  expect(screen.getByLabelText('Nächster Monat')).toBeDisabled();
  expect(screen.getAllByRole('option')).toHaveLength(24);
  fireEvent.change(screen.getByRole('combobox',{name:'Monat'}),{target:{value:'2026-08'}});
  expect(navigate).toHaveBeenCalledWith({...defaultRoute('kunden'),customerId:cid,month:'2026-08'});
});
it('distinguishes empty and unavailable, retries and does not show stale response after a month change',async()=>{
 const readCustomerHours=vi.fn<NonNullable<AdminWebCapability['readCustomerHours']>>().mockResolvedValueOnce({status:'unavailable'}).mockResolvedValueOnce({status:'ready',value:{...own,customers:[]}});
 render(<CustomersView administration={{readCustomerHours} as unknown as AdminWebCapability} route={defaultRoute('kunden')} navigate={()=>{}}/>);
 expect(await screen.findByRole('alert')).toHaveTextContent('konnten nicht geladen');
 fireEvent.click(screen.getByText('Erneut versuchen'));
 expect(await screen.findByRole('heading',{name:'Keine Kunden in diesem Monat'})).toBeInTheDocument();
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
 render(<CustomersView administration={{readCustomerHours,manageCustomer} as unknown as AdminWebCapability} route={defaultRoute('kunden')} navigate={()=>{}}/>);
 fireEvent.click(await screen.findByRole('button',{name:/Werkstatt/}));
 fireEvent.click(screen.getByText('Kunde löschen'));
 expect(screen.getByText('Kunde Werkstatt löschen? Der Kunde verschwindet aus der Auswahl; zugeordnete Karten werden frei. Bisherige Stunden bleiben erhalten.')).toBeInTheDocument();
 expect(manageCustomer).not.toHaveBeenCalled();
 fireEvent.click(screen.getByText('Löschen bestätigen'));
 expect(await screen.findByText('Erst die laufende Zeit beenden')).toBeInTheDocument();
 expect(manageCustomer).toHaveBeenCalledWith(cid,{action:'deactivate'});
 fireEvent.click(screen.getByText('Abbrechen'));
 fireEvent.click(screen.getByText('Kunde umbenennen'));
 fireEvent.change(screen.getByLabelText('Neuer Kundenname'),{target:{value:'Bestehender Name'}});
 manageCustomer.mockResolvedValueOnce({status:'succeeded'});
 fireEvent.click(screen.getByText('Namen speichern'));
 await screen.findByText('Kunde umbenennen');
 expect(manageCustomer).toHaveBeenLastCalledWith(cid,{action:'rename',displayName:'Bestehender Name'});
 expect(readCustomerHours).toHaveBeenCalledTimes(2);
});
