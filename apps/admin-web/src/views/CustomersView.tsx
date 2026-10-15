import {normalizeCustomerNameV1} from '@taptime/administration-contract/names';
import {PageHeader} from '../PageHeader';
import {MobileSheet} from '../MobileSheet';
import {RequiredForm} from '../RequiredForm';
import {DataTable,EmptyState,Metric,Person,Pill} from '../ui';
import TargetAssignments from './TargetAssignments';
import { useCustomerSearch } from '../../../mobile/src/search/useCustomerSearch';
import { SearchField, SearchStatus } from '../SearchControls';
import {CustomerManagement} from './CustomerManagement';
import { CustomerQuota, QuotaProgress } from './CustomerQuota';
import { businessDay, dayStart, shiftMonth, formatHours } from '@taptime/core';
import type { CustomerHoursSummary,CustomerHoursQuotaSummary } from '@taptime/mobile-work-contract';
import { useEffect, useRef, useState } from 'react';
import type { AdminWebCapability } from '../contracts';
import { monthLabel, type AdminRoute } from '../navigation';
import { DelayedSkeleton, Panel } from '../ui';

export default function CustomersView({ administration, route, navigate, authorityContext }: {
  readonly authorityContext?:string;
  readonly administration: AdminWebCapability; readonly route: AdminRoute; readonly navigate: (route: AdminRoute) => void;
}) {
  const current = businessDay(Date.now()).slice(0,7);
  const months = Array.from({length:24}, (_,i) => shiftMonth(current,-i));
  const month = route.month && months.includes(route.month) ? route.month : current;
  const selected=route.customerId??null;
  const lastSelected=useRef<string|null>(null);
  const cards=useRef(new Map<string,HTMLButtonElement>());
  const [refresh,setRefresh] = useState(0);
  const ready=administration.getState?.();
  const canCreate=ready?.status==='ready'&&ready.availableSections?.includes('setup');
  const [creating,setCreating]=useState(false),[name,setName]=useState(''),[location,setLocation]=useState('');
  const [created,setCreated]=useState<CustomerHoursSummary|CustomerHoursQuotaSummary|null>(null);
  const requestScope=useRef({authorityContext,month});
  const scope=requestScope.current;
  if(scope.authorityContext!==authorityContext||scope.month!==month)requestScope.current={authorityContext,month};
  useEffect(()=>{requestScope.current={authorityContext,month};setCreated(null);return()=>{requestScope.current={authorityContext:undefined,month:''};};},[authorityContext,month]);
  const locationId=location||(ready?.status==='ready'&&ready.assignableLocations?.length===1?ready.assignableLocations[0]!.id:'');
  const create=async()=>{
    if(ready?.status!=='ready')return;
    const normalized=normalizeCustomerNameV1(name);
    if(normalized.status!=='valid')return;
    const request=requestScope.current;
    await administration.createCustomer(name,ready.locationsEnabled?locationId||undefined:undefined);
    const latest=administration.getState();
    if(requestScope.current!==request||latest.status!=='ready'||latest.membershipId!==ready.membershipId||latest.completedAction!=='customer_created')return;
    // Read the real customer returned by the existing search, never synthesize a row.
    const result=await administration.querySearch?.('customer_hours',{fromInclusive:new Date(dayStart(`${month}-01`)).toISOString(),toExclusive:new Date(dayStart(`${shiftMonth(month,1)}-01`)).toISOString(),search:normalized.canonicalName,cursor:null}).catch(()=>undefined);
    if(requestScope.current!==request)return;
    if(result?.status==='ready'&&result.value){
      const matches=result.value.customers.filter(c=>c.displayName===normalized.canonicalName);
      if(matches.length===1)setCreated(matches[0]!);
    }
    setCreating(false);setName('');list.setSearch('');setRefresh(n=>n+1);
  };

  const {list,detail,value,customer,active}=useCustomerSearch(administration,month,selected,authorityContext,refresh);
  const result=active.state.status;
  const shownCustomers=created&&!list.state.search?[list.state.items.find(c=>c.customerId===created.customerId)??created,...list.state.items.filter(c=>c.customerId!==created.customerId)]:list.state.items;
  useEffect(()=>{
    if(!value)return;
    if(customer){lastSelected.current=customer.customerId;}
    else if(!selected&&lastSelected.current){cards.current.get(lastSelected.current)?.focus();lastSelected.current=null;}
  },[customer?.customerId,selected,value]);
  const changeMonth = (next: string) => {navigate({...route,month:next});};
  const monthControl=<label><span className="sr-only">Monat</span><select className="month-select" value={month} onChange={event=>changeMonth(event.target.value)}>{months.map(m=><option key={m} value={m}>{monthLabel(m)}</option>)}</select></label>;
  const onSaved=()=>{setCreated(null);setRefresh(n=>n+1);};
  return <div className="customers-view">
    <PageHeader organization={ready?.status==='ready'?ready.projection?.organization.name:undefined} title={customer?.displayName??'Kunden'} subtitle={selected?<div className="customer-navigation">{monthControl}<button className="secondary" onClick={()=>navigate({...route,customerId:undefined})}>Zur Kundenliste</button></div>:monthLabel(month)} onRefresh={()=>{onSaved();void administration.refresh();}} actions={selected?<>{customer?.active&&value?.scope==='people'?<CustomerManagement key={`${authorityContext}/${customer.customerId}`} customer={customer} administration={administration} onSaved={onSaved}/>:null}</>:<>
      {monthControl}{canCreate?<button className={creating?'secondary':'primary-action'} onClick={()=>setCreating(true)}>+ Kunde anlegen</button>:null}
    </>}/>
    <div className="customer-search-tools">{selected===null?<SearchField value={list.input} onChange={list.setSearch}/>:null}
    <SearchStatus state={selected===null?{...active.state,items:shownCustomers}:active.state} onRetry={()=>void active.pager.retry()} onClear={()=>list.setSearch('')}/></div>
    {value ? <>
        <p className="supporting">{value.scope==='self' ? 'Ihre eigenen Stunden je Kunde.' : 'Geleistete Stunden je Kunde und Person.'} Stand {new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',hour:'2-digit',minute:'2-digit'}).format(new Date(value.asOf))}</p>
        {customer ? <section className="panel" aria-label="Kundendetails">
          {!customer.active ? <span className="status-pill">inaktiv</span> : null}
          <div className="customer-metrics">
            <Metric label="Stunden im Monat" value={`${formatHours(customer.workDurationSeconds*1000)} h`} action={customer.running?<Pill kind="running">läuft</Pill>:undefined}/>
            {'quotaStage' in customer?<CustomerQuota key={`${month}/${customer.customerId}`} customer={customer} administration={administration} editable={month===current && administration.getState().status==='ready' && (administration.getState() as {role:string}).role!=='employee' && (customer.active || (administration.getState() as {role:string}).role==='administrator')} onSaved={onSaved}/>:null}
          </div>
          {customer.active&&value.scope==='people'?<TargetAssignments administration={administration} selector={{targetType:'customer',targetId:customer.customerId}} targetName={customer.displayName}/>:null}
          <h3>{'people' in customer ? 'Stunden je Person' : 'Ihre Stunden je Tag'}</h3>
          <DataTable label={'people' in customer?'Stunden je Person':'Ihre Stunden je Tag'} headers={['people' in customer?'Person':'Datum',{label:'Stunden',numeric:true},'Status']}>
            {('people' in customer?customer.people.map(p=>({key:p.membershipId,label:p.displayName,...p})):customer.days.map(d=>({key:d.date,label:d.date.split('-').reverse().join('.'),...d}))).map(p=><tr key={p.key}><td>{'people' in customer?<Person name={p.label}/>:p.label}</td><td className="numeric">{formatHours(p.workDurationSeconds*1000)} h</td><td>{p.running?<Pill kind="running">läuft</Pill>:<span className="muted">–</span>}</td></tr>)}
          </DataTable>
          {detail.state.nextCursor!==null?<button disabled={detail.state.busy} onClick={()=>void detail.pager.loadMore()}>Weitere Personen laden</button>:null}
          {customer.workDurationSeconds===0 ? <p>In diesem Monat noch keine Stunden.</p> : null}
          {'days' in customer ? <p className="supporting">Zuordnung nach dem Tag, an dem der Eintrag beginnt.</p> : null}
        </section> : selected ? <Panel title="Kunde nicht gefunden"><p>Für diesen Monat ist der Kunde nicht verfügbar.</p><button onClick={()=>navigate({...route,customerId:undefined})}>Zur Kundenliste</button></Panel> : shownCustomers.length===0 && !list.state.search ? <EmptyState action={canCreate?<button className="text-button" onClick={()=>setCreating(true)}>Kunde anlegen</button>:undefined}>Für Ihren Bereich sind noch keine Kunden mit einer aktiven Zuordnung oder Stunden vorhanden.</EmptyState>
          : <DataTable label="Kunden" headers={['Kunde','Kontingent',{label:'Stunden',numeric:true},'Zustand']}>
            {shownCustomers.map(c=><tr key={c.customerId} className="customer-row" onClick={event=>{if(!(event.target as HTMLElement).closest('button,a,input,select'))navigate({...route,customerId:c.customerId});}}>
              <td><button className="text-button customer-name" ref={node=>{if(node)cards.current.set(c.customerId,node);else cards.current.delete(c.customerId);}} onClick={()=>navigate({...route,customerId:c.customerId})}>{c.displayName}</button>{!c.active?<small> · inaktiv</small>:null}</td>
              <td>{'quotaStage' in c&&c.quotaSeconds!=null?<QuotaProgress customer={c}/>:<span className="muted">kein Kontingent</span>}</td>
              <td className="numeric">{formatHours(c.workDurationSeconds*1000)} h</td>
              <td>{c.running?<Pill kind="running">läuft</Pill>:'quotaStage' in c&&c.quotaStage==='exceeded'?<Pill kind="error">überschritten</Pill>:'quotaStage' in c&&c.quotaStage==='warning'?<Pill kind="notice">prüfen</Pill>:<Pill>{c.active?'aktiv':'inaktiv'}</Pill>}</td>
            </tr>)}
          </DataTable>}

        {selected===null&&list.state.nextCursor!==null?<button className="text-button" disabled={list.state.busy} onClick={()=>void list.pager.loadMore()}>Weitere laden</button>:null}

      </>:null}
    {creating&&ready?.status==='ready'?<MobileSheet label="Kunde anlegen" className="right-sheet" busy={ready.creating} onCancel={()=>setCreating(false)}>
      <h2>Kunde anlegen</h2><RequiredForm className="form-grid" onSubmit={event=>{event.preventDefault();void create();}}>
        <label>Name<input required maxLength={120} value={name} disabled={ready.creating} onChange={event=>setName(event.target.value)}/></label>
        {ready.locationsEnabled?<label>Standort<select required value={locationId} disabled={ready.creating} onChange={event=>setLocation(event.target.value)}><option value="">Standort wählen</option>{ready.assignableLocations.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label>:null}
        {ready.notice?<p role={ready.notice.kind==='error'?'alert':'status'}>{ready.notice.text}</p>:null}
        <button className="primary-action" disabled={ready.creating}>{ready.creating?'Wird angelegt …':'Kunde anlegen'}</button>
        <button type="button" className="secondary" disabled={ready.creating} onClick={()=>setCreating(false)}>Abbrechen</button>
      </RequiredForm>
    </MobileSheet>:null}
  </div>;
}
