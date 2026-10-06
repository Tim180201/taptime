import {CustomerManagement} from './CustomerManagement';
import { CustomerQuota, QuotaProgress } from './CustomerQuota';
import { businessDay, shiftMonth, formatHours } from '@taptime/core';
import type { CustomerHoursResult } from '@taptime/mobile-work-contract';
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
  const [loaded,setLoaded] = useState<{month: string; authorityContext?:string; result: CustomerHoursResult} | null>(null);
  const selected=route.customerId??null;
  const lastSelected=useRef<string|null>(null);
  const detailHeading=useRef<HTMLHeadingElement>(null);
  const cards=useRef(new Map<string,HTMLButtonElement>());
  const [refresh,setRefresh] = useState(0);

  useEffect(() => {
    let cancelled = false; setLoaded(null);
    void Promise.resolve(administration.readCustomerHours?.(month) ?? {status:'unavailable' as const})
      .catch(() => ({status:'unavailable' as const})).then(result => {if (!cancelled) setLoaded({month,authorityContext,result});});
    return () => {cancelled = true;};
  },[administration,month,refresh,authorityContext]);
  const result = loaded?.month === month && loaded.authorityContext===authorityContext ? loaded.result : null;
  const value = result?.status === 'ready' ? result.value : null;
  const customer = value?.customers.find(c => c.customerId === selected);
  useEffect(()=>{
    if(!value)return;
    if(customer){detailHeading.current?.focus();lastSelected.current=customer.customerId;}
    else if(!selected&&lastSelected.current){cards.current.get(lastSelected.current)?.focus();lastSelected.current=null;}
  },[customer?.customerId,selected,value]);
  const changeMonth = (next: string) => {navigate({...route,month:next});};
  return <div className="customers-view">
    <div className="toolbar customer-month">
      <button className="quiet" aria-label="Voriger Monat" disabled={month===months.at(-1)} onClick={()=>changeMonth(shiftMonth(month,-1))}>←</button>
      <label>Monat<select value={month} onChange={event=>changeMonth(event.target.value)}>{months.map(m=><option key={m} value={m}>{monthLabel(m)}</option>)}</select></label>
      <button className="quiet" aria-label="Nächster Monat" disabled={month===current} onClick={()=>changeMonth(shiftMonth(month,1))}>→</button>
    </div>
    {result === null ? <DelayedSkeleton label="Kundenstunden werden geladen"/> : !value ? <div role="alert"><p>Kundenstunden konnten nicht geladen werden. Bitte prüfen Sie Ihre Verbindung und versuchen Sie es erneut.</p><button onClick={()=>setRefresh(n=>n+1)}>Erneut versuchen</button></div>
      : <>
        <p className="supporting">{value.scope==='self' ? 'Ihre eigenen Stunden je Kunde.' : 'Geleistete Stunden je Kunde und Person.'} Stand {new Intl.DateTimeFormat('de-DE',{timeZone:'Europe/Berlin',hour:'2-digit',minute:'2-digit'}).format(new Date(value.asOf))}</p>
        {customer ? <section className="panel" aria-labelledby="customer-detail-title"><h2 id="customer-detail-title" ref={detailHeading} tabIndex={-1}>{customer.displayName}</h2>
          <button className="quiet" onClick={()=>navigate({...route,customerId:undefined})}>Zur Kundenliste</button>
          {!customer.active ? <span className="status-pill">inaktiv</span> : null}
          <p className="customer-total">{formatHours(customer.workDurationSeconds*1000)} h {customer.running ? <span className="status-pill">läuft</span> : null}</p>
          {customer.active && value.scope==='people'?<CustomerManagement key={`${authorityContext}/${customer.customerId}`} customer={customer} administration={administration} onSaved={()=>setRefresh(n=>n+1)}/>:null}
          {'quotaStage' in customer?<CustomerQuota key={`${month}/${customer.customerId}`} customer={customer} administration={administration} editable={month===current && administration.getState().status==='ready' && (administration.getState() as {role:string}).role!=='employee' && (customer.active || (administration.getState() as {role:string}).role==='administrator')} onSaved={()=>setRefresh(n=>n+1)}/>:null}
          <h3>{'people' in customer ? 'Stunden je Person' : 'Ihre Stunden je Tag'}</h3>
          <ul className="customer-rows">{('people' in customer ? customer.people.map(p=>({key:p.membershipId,label:p.displayName,...p})) : customer.days.map(d=>({key:d.date,label:d.date.split('-').reverse().join('.'),...d}))).map(p=><li key={p.key}><span>{p.label}{p.running ? <small> · läuft</small> : null}</span><strong>{formatHours(p.workDurationSeconds*1000)} h</strong></li>)}</ul>
          {customer.workDurationSeconds===0 ? <p>In diesem Monat noch keine Stunden.</p> : null}
          {'days' in customer ? <p className="supporting">Zuordnung nach dem Tag, an dem der Eintrag beginnt.</p> : null}
        </section> : selected ? <Panel title="Kunde nicht gefunden"><p>Für diesen Monat ist der Kunde nicht verfügbar.</p><button onClick={()=>navigate({...route,customerId:undefined})}>Zur Kundenliste</button></Panel> : value.customers.length===0 ? <Panel title="Keine Kunden in diesem Monat"><p>Für Ihren Bereich sind noch keine Kunden mit einer aktiven Zuordnung oder Stunden vorhanden.</p></Panel>
          : <ul className="customer-list">{value.customers.map(c=><li key={c.customerId}><button className="customer-card" ref={node=>{if(node)cards.current.set(c.customerId,node);else cards.current.delete(c.customerId);}} onClick={()=>navigate({...route,customerId:c.customerId})}><span><strong>{c.displayName}</strong>{!c.active ? <small>inaktiv</small> : null}{c.running ? <small>läuft</small> : null}</span>{'quotaStage' in c && c.quotaSeconds!=null?<QuotaProgress customer={c}/>:<strong>{formatHours(c.workDurationSeconds*1000)} h</strong>}<span aria-hidden="true">→</span></button></li>)}</ul>}
        <button className="quiet" onClick={()=>setRefresh(n=>n+1)}>Kundenstunden aktualisieren</button>
      </>}
  </div>;
}
