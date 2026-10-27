// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import CustomersView from '../src/views/CustomersView';
import { CustomerManagement } from '../src/views/CustomerManagement';
import { defaultRoute } from '../src/navigation';
import type { AdminWebCapability } from '../src/contracts';

const id=(n:number)=>`13800000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const customer={customerId:id(1),displayName:'Kunde A',active:true,workDurationSeconds:7200,running:false,quotaSeconds:null,quotaStage:'none'};
const person={membershipId:id(2),displayName:'Anna',workDurationSeconds:7200,running:false};
const detail={version:'customer-hours.detail.v1',scope:'people',asOf:'2026-10-27T09:00:00.000Z',customer,people:[person],nextCursor:null};
beforeEach(()=>{
  HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};
  HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};
});
afterEach(cleanup);

it('T138: deleting a customer opens a separate dialog with cancellation as the safe default',()=>{
  const manageCustomer=vi.fn();
  render(<CustomerManagement customer={customer} administration={{manageCustomer} as unknown as AdminWebCapability} onSaved={()=>{}}/>);
  const trigger=screen.getByRole('button',{name:'Kunde löschen'});
  fireEvent.click(trigger);
  const dialog=screen.getByRole('alertdialog');
  expect(dialog.tagName).toBe('DIALOG');
  const cancel=within(dialog).getByRole('button',{name:'Abbrechen'});
  expect(cancel).toHaveClass('primary-action');
  expect(cancel).toHaveFocus();
  expect(within(dialog).getByRole('button',{name:'Löschen bestätigen'})).not.toHaveFocus();
  fireEvent.click(trigger); // A repeated event on the initiating control must never delete.
  expect(manageCustomer).not.toHaveBeenCalled();
  fireEvent.click(cancel);
  expect(screen.queryByRole('alertdialog')).toBeNull();
});

it('T138: opens days for the selected person, keeps that person on month change, retries and returns',async()=>{
  const querySearch=vi.fn(async(kind:string,request:any)=>{
    if(kind==='customer_detail')return {status:'ready',value:detail};
    if(kind==='customer_person_days')return {status:'ready',value:{version:'customer-hours.person-days.v1',asOf:detail.asOf,
      customer:{customerId:customer.customerId,displayName:customer.displayName},person,
      days:request.fromInclusive.startsWith('2026-09-30')?[{date:'2026-10-02',workDurationSeconds:7200,running:false}]:[],nextCursor:null}};
    return {status:'unavailable'};
  });
  function View(){const [route,navigate]=useState({...defaultRoute('kunden'),month:'2026-10',customerId:customer.customerId});return <CustomersView administration={{querySearch,getState:()=>({status:'ready',role:'administrator'})} as any} route={route} navigate={navigate as any} authorityContext="admin"/>;}
  render(<View/>);
  fireEvent.click(await screen.findByRole('button',{name:/Tage von Anna/}));
  expect(await screen.findByRole('table',{name:'Stunden je Tag'})).toHaveTextContent('02.10.2026');
  expect(querySearch).toHaveBeenLastCalledWith('customer_person_days',expect.objectContaining({customerId:id(1),targetMembershipId:id(2)}));
  fireEvent.click(screen.getByRole('button',{name:'Voriger Monat'}));
  expect(await screen.findByText('In diesem Monat noch keine Stunden.')).toBeInTheDocument();
  expect(querySearch).toHaveBeenLastCalledWith('customer_person_days',expect.objectContaining({targetMembershipId:id(2),fromInclusive:'2026-08-31T22:00:00.000Z'}));
  querySearch.mockResolvedValueOnce({status:'unavailable'});
  fireEvent.click(screen.getByRole('button',{name:'Nächster Monat'}));
  fireEvent.click(await screen.findByRole('button',{name:'Erneut versuchen'}));
  expect(await screen.findByText('02.10.2026')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button',{name:'Zurück zum Kunden'}));
  await waitFor(()=>expect(screen.getByRole('button',{name:/Tage von Anna/})).toBeInTheDocument());
});
