import { RequiredForm } from '../RequiredForm';
import { useState } from 'react';
import { formatHours, formatQuotaHours } from '@taptime/core';
import { parseQuotaHours, quotaStageLabel, type QuotaStage } from '@taptime/mobile-work-contract';
import type { AdminWebCapability } from '../contracts';
export interface QuotaCustomer {customerId:string;workDurationSeconds:number;quotaSeconds?:number|null;quotaStage?:QuotaStage}
export function QuotaProgress({customer}:{customer:QuotaCustomer}) {
  if(customer.quotaSeconds==null) return null;
  const label=quotaStageLabel(customer.quotaStage);
  return <div className={`quota-progress quota-${customer.quotaStage}`}>
    <strong>{formatHours(customer.workDurationSeconds*1000)} von {formatQuotaHours(customer.quotaSeconds)} h</strong>
    <progress aria-label="Monatskontingent" max={customer.quotaSeconds} value={Math.min(customer.workDurationSeconds,customer.quotaSeconds)}/>
    {label?<span>{label}</span>:null}
  </div>;
}
export function CustomerQuota({customer,administration,onSaved,editable}:{customer:QuotaCustomer;administration:AdminWebCapability;onSaved:()=>void;editable:boolean}) {
  const [editing,setEditing]=useState(false),[input,setInput]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const save=async()=>{
    const minutes=parseQuotaHours(input);
    if(minutes===undefined){setError('Bitte geben Sie 0,5 bis 744 Stunden in halben oder ganzen Stunden ein.');return;}
    setBusy(true);setError('');
    const result=await administration.setCustomerQuota?.(customer.customerId,minutes).catch(()=>({status:'unavailable'}));
    setBusy(false);
    if(result?.status==='succeeded'){setEditing(false);onSaved();}
    else setError(result?.status==='forbidden'?'Sie dürfen das Kontingent dieses Kunden nicht mehr ändern.':'Das Kontingent konnte nicht gespeichert werden. Bitte versuchen Sie es erneut. Ihre Eingabe bleibt erhalten.');
  };
  return <section aria-label="Kontingent"><p>Kontingent: {customer.quotaSeconds==null?'Kein Kontingent':`${formatQuotaHours(customer.quotaSeconds)} h pro Monat`}</p>
    <QuotaProgress customer={customer}/>
    {editing?<RequiredForm onSubmit={event=>{event.preventDefault();if(!busy)void save();}}>
      {error?<p role="alert">{error}</p>:null}
      <label>Stunden pro Monat (optional)<input data-field-error={parseQuotaHours(input)===undefined ? "Bitte 0,5 bis 744 Stunden in halben oder ganzen Stunden eingeben." : undefined} inputMode="decimal" value={input} disabled={busy} onChange={event=>setInput(event.target.value)}/></label>
      <p className="supporting">0,5 bis 744 Stunden. Leer lassen entfernt das Kontingent. Änderungen gelten ab dem laufenden Monat.</p>
      <div className="toolbar"><button disabled={busy} type="submit">{busy?'Speichert …':'Kontingent speichern'}</button><button type="button" className="quiet" disabled={busy} onClick={()=>setEditing(false)}>Abbrechen</button></div>
    </RequiredForm>:editable?<button className="quiet" onClick={()=>{setInput(customer.quotaSeconds==null?'':String(customer.quotaSeconds/3600).replace('.',','));setEditing(true);setError('');}}>Ändern</button>:<p className="supporting">Änderungen sind im laufenden Monat möglich.</p>}
  </section>;
}
