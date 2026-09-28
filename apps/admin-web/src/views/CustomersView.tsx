import { businessDay, shiftMonth, formatHours } from '@taptime/core';
import type { CustomerHoursResult } from '@taptime/mobile-work-contract';
import { useEffect, useState } from 'react';
import type { AdminWebCapability } from '../contracts';
import { monthLabel, type AdminRoute } from '../navigation';
import { DelayedSkeleton, Panel } from '../ui';

export default function CustomersView({ administration, route, navigate }: {
  readonly administration: AdminWebCapability; readonly route: AdminRoute; readonly navigate: (route: AdminRoute) => void;
}) {
  const current = businessDay(Date.now()).slice(0,7);
  const months = Array.from({length:24}, (_,i) => shiftMonth(current,-i));
  const month = route.month && months.includes(route.month) ? route.month : current;
  const [loaded,setLoaded] = useState<{month: string; result: CustomerHoursResult} | null>(null);
  const [selected,setSelected] = useState<string | null>(null);
  const [refresh,setRefresh] = useState(0);
  useEffect(() => {
    let cancelled = false; setLoaded(null);
    void Promise.resolve(administration.readCustomerHours?.(month) ?? {status:'unavailable' as const})
      .catch(() => ({status:'unavailable' as const})).then(result => {if (!cancelled) setLoaded({month,result});});
    return () => {cancelled = true;};
  },[administration,month,refresh]);
  const result = loaded?.month === month ? loaded.result : null;
  const value = result?.status === 'ready' ? result.value : null;
  const customer = value?.customers.find(c => c.customerId === selected);
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
        {customer ? <Panel title={customer.displayName}>
          <button className="quiet" onClick={()=>setSelected(null)}>Zur Kundenliste</button>
          {!customer.active ? <span className="status-pill">inaktiv</span> : null}
          <p className="customer-total">{formatHours(customer.workDurationSeconds*1000)} h {customer.running ? <span className="status-pill">läuft</span> : null}</p>
          <h3>{'people' in customer ? 'Stunden je Person' : 'Ihre Stunden je Tag'}</h3>
          <ul className="customer-rows">{('people' in customer ? customer.people.map(p=>({key:p.membershipId,label:p.displayName,...p})) : customer.days.map(d=>({key:d.date,label:d.date.split('-').reverse().join('.'),...d}))).map(p=><li key={p.key}><span>{p.label}{p.running ? <small> · läuft</small> : null}</span><strong>{formatHours(p.workDurationSeconds*1000)} h</strong></li>)}</ul>
          {customer.workDurationSeconds===0 ? <p>In diesem Monat noch keine Stunden.</p> : null}
          {'days' in customer ? <p className="supporting">Zuordnung nach dem Tag, an dem der Eintrag beginnt.</p> : null}
        </Panel> : value.customers.length===0 ? <Panel title="Keine Kunden in diesem Monat"><p>Für Ihren Bereich sind noch keine Kunden mit einer aktiven Zuordnung oder Stunden vorhanden.</p></Panel>
          : <ul className="customer-list">{value.customers.map(c=><li key={c.customerId}><button className="customer-card" onClick={()=>setSelected(c.customerId)}><span><strong>{c.displayName}</strong>{!c.active ? <small>inaktiv</small> : null}{c.running ? <small>läuft</small> : null}</span><strong>{formatHours(c.workDurationSeconds*1000)} h</strong><span aria-hidden="true">→</span></button></li>)}</ul>}
        <button className="quiet" onClick={()=>setRefresh(n=>n+1)}>Kundenstunden aktualisieren</button>
      </>}
  </div>;
}
