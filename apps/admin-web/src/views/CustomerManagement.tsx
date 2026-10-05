import {useEffect,useRef,useState} from 'react';
import {customerManagementMessage,type CustomerManagementChange} from '@taptime/mobile-work-contract';
import type {AdminWebCapability} from '../contracts';
export function CustomerManagement({customer,administration,onSaved}:{readonly customer:{customerId:string;displayName:string};readonly administration:AdminWebCapability;readonly onSaved:()=>void}){
  const [mode,setMode]=useState<'rename'|'delete'|null>(null),[name,setName]=useState(customer.displayName),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  const mounted=useRef(true),pending=useRef(false);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  const save=async(change:CustomerManagementChange)=>{
    if(pending.current)return;pending.current=true;setBusy(true);setMessage('');
    const result=await administration.manageCustomer?.(customer.customerId,change).catch(()=>({status:'unavailable' as const}))??{status:'unavailable' as const};
    pending.current=false;if(!mounted.current)return;setBusy(false);setMessage(customerManagementMessage(result));
    if(result.status==='succeeded'){setMode(null);onSaved();}
  };
  return <div className="customer-management">
    {mode===null?<><button className="quiet" onClick={()=>{setName(customer.displayName);setMode('rename');setMessage('');}}>Kunde umbenennen</button><button className="quiet" onClick={()=>{setMode('delete');setMessage('');}}>Kunde löschen</button></>:mode==='rename'?<>
      <label>Neuer Kundenname<input value={name} onChange={event=>setName(event.target.value)} disabled={busy}/></label>
      <button disabled={busy} onClick={()=>void save({action:'rename',displayName:name})}>Namen speichern</button>
    </>:<><p>Kunde {customer.displayName} löschen? Stunden bleiben erhalten.</p><button disabled={busy} onClick={()=>void save({action:'deactivate'})}>Löschen bestätigen</button></>}
    {mode!==null?<button className="quiet" disabled={busy} onClick={()=>{setMode(null);setMessage('');}}>Abbrechen</button>:null}
    {message?<p role="status">{message}</p>:null}
  </div>;
}
