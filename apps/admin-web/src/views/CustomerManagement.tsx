import type {ReactNode} from 'react';
import {Confirmation} from '../ui';
import {MobileSheet} from '../MobileSheet';
import { RequiredForm } from '../RequiredForm';
import {useEffect,useRef,useState} from 'react';
import {customerManagementMessage,type CustomerManagementChange} from '@taptime/mobile-work-contract';
import type {AdminWebCapability} from '../contracts';
export function CustomerManagement({customer,administration,onSaved,children}:{readonly children?:ReactNode;readonly customer:{customerId:string;displayName:string};readonly administration:AdminWebCapability;readonly onSaved:()=>void}){
  const [mode,setMode]=useState<'rename'|'delete'|null>(null),[name,setName]=useState(customer.displayName),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  const mounted=useRef(true),pending=useRef(false);
  const deleteTrigger=useRef<HTMLButtonElement>(null);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  const save=async(change:CustomerManagementChange)=>{
    if(pending.current)return;pending.current=true;setBusy(true);setMessage('');
    const result=await administration.manageCustomer?.(customer.customerId,change).catch(()=>({status:'unavailable' as const}))??{status:'unavailable' as const};
    pending.current=false;if(!mounted.current)return;setBusy(false);setMessage(customerManagementMessage(result));
    if(result.status==='succeeded'){setMode(null);onSaved();}
  };
  return <div className="customer-management">
    <button className="secondary" onClick={()=>{setName(customer.displayName);setMode('rename');setMessage('');}}>Kunde umbenennen</button>
    {mode==='rename'?<MobileSheet label="Kunde umbenennen" className="right-sheet" busy={busy} onCancel={()=>{setMode(null);setMessage('');}}>
      <h2>Kunde umbenennen</h2>
      <RequiredForm className="form-grid" onSubmit={event=>{event.preventDefault();if(!busy)void save({action:'rename',displayName:name});}}>
        <label>Neuer Kundenname<input required data-field-label="Neuen Kundenname" value={name} onChange={event=>setName(event.target.value)} disabled={busy}/></label>
        <button className="primary-action" disabled={busy}>{busy?'Wird gesichert …':'Namen speichern'}</button>
      </RequiredForm>
      <button className="secondary" disabled={busy} onClick={()=>{setMode(null);setMessage('');}}>Abbrechen</button>
      {message?<p role="status">{message}</p>:null}
    </MobileSheet>:null}
    {children}
    <div className="customer-danger-zone"><button ref={deleteTrigger} className="warning-action" disabled={mode!==null} onClick={()=>{setMode('delete');setMessage('');}}>Kunde löschen</button></div>
    {mode==='delete'?<Confirmation trigger={deleteTrigger.current} label="Kunde löschen" title={`Kunde ${customer.displayName} löschen?`} confirmLabel="Löschen bestätigen" busyLabel="Wird gelöscht …" busy={busy} warning onConfirm={()=>void save({action:'deactivate'})} onCancel={()=>{setMode(null);setMessage('');}}>
      <p>Stunden bleiben erhalten. Danach steht {customer.displayName} im Archiv. Die Zeiten bleiben im Lohnexport und bei den Kundenzeiten. Zugeordnete Karten werden frei. Das lässt sich nicht rückgängig machen.</p>
      {message?<p role="status">{message}</p>:null}
    </Confirmation>:null}
    {message&&mode===null?<p role="status">{message}</p>:null}
  </div>;
}
