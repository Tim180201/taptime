import type {ReactNode} from 'react';
import {formatHours} from '@taptime/core';
import {useCustomerPersonDays} from '../../../mobile/src/search/useCustomerPersonDays';
import {SearchStatus} from '../SearchControls';
import {PageHeader} from '../PageHeader';
import {DataTable,Metric,Pill} from '../ui';
import {monthLabel} from '../navigation';
import type {AdminWebCapability} from '../contracts';
import {useArchiveStatus} from '../archiveStatus';

export function CustomerPersonDays({administration,month,monthControl,customerId,personId,authority,refresh,onRefresh,onBack}:{
  administration:AdminWebCapability;month:string;monthControl:ReactNode;customerId:string;personId:string;
  authority:unknown;refresh:number;onRefresh:()=>void;onBack:()=>void;
}) {
  const {state,pager}=useCustomerPersonDays(administration,month,customerId,personId,authority,refresh);
  const value=state.value;
  const archive=useArchiveStatus(administration,value?[personId]:[],[],`${month}/${customerId}/${personId}`);
  return <div className="customer-person-days">
    <PageHeader title={value?`${value.person.displayName} · ${value.customer.displayName} · ${monthLabel(month)}`:'Stunden je Tag'}
      subtitle={<div className="customer-navigation">{monthControl}<button className="secondary" onClick={onBack}>Zurück zum Kunden</button></div>} onRefresh={onRefresh}/>
    <SearchStatus state={state} onRetry={()=>void pager.retry()} onClear={()=>{}}/>
    {value?<section className="panel" aria-label="Stunden je Tag">
      {archive.person(personId)?<Pill>ehemalig</Pill>:null}{archive.notice}
      <Metric label="Stunden im Monat" value={`${formatHours(value.person.workDurationSeconds*1000)} h`} action={value.person.running?<Pill kind="running">läuft</Pill>:undefined}/>
      <h2>Stunden je Tag</h2>
      <DataTable label="Stunden je Tag" headers={['Datum',{label:'Stunden',numeric:true},'Status']}>
        {state.items.map(day=><tr key={day.date} aria-label={`${day.date.split('-').reverse().join('.')}, ${formatHours(day.workDurationSeconds*1000)} Stunden${day.running?', läuft':''}`}>
          <td>{day.date.split('-').reverse().join('.')}</td><td className="numeric">{formatHours(day.workDurationSeconds*1000)} h</td><td>{day.running?<Pill kind="running">läuft</Pill>:<span className="muted">–</span>}</td>
        </tr>)}
      </DataTable>
      {state.items.length===0?<p>In diesem Monat noch keine Stunden.</p>:null}
      {state.nextCursor?<button disabled={state.busy} onClick={()=>void pager.loadMore()}>Weitere Tage laden</button>:null}
      <p className="supporting">Zuordnung nach dem Tag, an dem der Eintrag beginnt.</p>
    </section>:null}
  </div>;
}
