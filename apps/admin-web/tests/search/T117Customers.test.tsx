// @vitest-environment jsdom
import { act, createElement, useState, type ReactNode } from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import WebCustomers from '../../src/views/CustomersView';
import { CustomerQuotaNotice as WebNotice } from '../../src/QuotaNotice';
import { defaultRoute } from '../../src/navigation';
import type { AdminWebCapability } from '../../src/contracts';
const authority={role:'administrator'};
const id=(n:number)=>`10000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const asOf='2026-10-14T08:00:00.000Z';
const customer=(n:number,name:string)=>({customerId:id(n),displayName:name,active:true,workDurationSeconds:0,running:false,quotaSeconds:null,quotaStage:'none' as const});
const first=customer(1,'Alpha'),last=customer(2,'Zeta');
const page=(customers:unknown[],nextCursor:string|null=null)=>({version:'customer-hours.v3',scope:'people',asOf,customers,nextCursor});
const person=(n:number)=>({membershipId:id(n+10),displayName:`Person ${n}`,workDurationSeconds:0,running:false});
const detail=(people:unknown[],nextCursor:string|null=null)=>({version:'customer-hours.detail.v1',scope:'people',asOf,customer:last,people,nextCursor});
function Web({cap,selected}:{cap:AdminWebCapability;selected?:string}){const [route,navigate]=useState<import('../../src/navigation').AdminRoute>({...defaultRoute('kunden'),customerId:selected});return <WebCustomers administration={cap} route={route} navigate={navigate} authorityContext="admin"/>;}
function View({cap,selected}:{mode:string;cap:any;selected?:string}){return <Web cap={cap} selected={selected}/>;}
beforeEach(()=>{Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});vi.useFakeTimers();vi.setSystemTime(new Date(asOf));});
afterEach(()=>{cleanup();vi.useRealTimers();});
const flush=async()=>{await act(async()=>{await Promise.resolve();});};
for(const mode of ['web']) {
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
    render(<><View mode={mode} cap={cap}/>{<WebNotice administration={cap as unknown as AdminWebCapability} membership={id(5)} role="administrator" authorityContext="admin" storage={storage} onView={onView}/>}</>);await flush();
    expect(screen.getByText(/Zeta: Kontingent überschritten/)).toBeInTheDocument();expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(querySearch).toHaveBeenCalledTimes(1);expect(readCustomerHours).toHaveBeenCalledWith('2026-10');
    fireEvent.click(screen.getByRole('button',{name:'Ansehen'}));await flush();expect(onView).toHaveBeenCalledWith(last.customerId,'2026-10');
  });
}
