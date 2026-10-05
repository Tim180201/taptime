import {useEffect,useRef,useState} from 'react';
import {View} from 'react-native';
import {customerManagementMessage,type CustomerManagementChange} from '@taptime/mobile-work-contract';
import type {AdminSetupCapability} from '../administration/contracts';
import {ActionButton,AppText as Text,TextField} from '../design/primitives';
export function CustomerManagement({customer,administration,onSaved}:{readonly customer:{customerId:string;displayName:string};readonly administration:AdminSetupCapability;readonly onSaved:()=>void}){
  const [mode,setMode]=useState<'rename'|'delete'|null>(null),[name,setName]=useState(customer.displayName),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  const mounted=useRef(true),pending=useRef(false);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  const save=async(change:CustomerManagementChange)=>{
    if(pending.current)return;pending.current=true;setBusy(true);setMessage('');
    const result=await administration.manageCustomer?.(customer.customerId,change).catch(()=>({status:'unavailable' as const}))??{status:'unavailable' as const};
    pending.current=false;if(!mounted.current)return;setBusy(false);setMessage(customerManagementMessage(result));
    if(result.status==='succeeded'){setMode(null);onSaved();}
  };
  return <View style={{gap:8}}>
    {mode===null?<><ActionButton title="Kunde umbenennen" tone="quiet" onPress={()=>{setName(customer.displayName);setMode('rename');setMessage('');}}/><ActionButton title="Kunde löschen" tone="quiet" onPress={()=>{setMode('delete');setMessage('');}}/></>:mode==='rename'?<>
      <TextField accessibilityLabel="Neuer Kundenname" value={name} onChangeText={setName} editable={!busy}/>
      <ActionButton title="Namen speichern" disabled={busy} onPress={()=>void save({action:'rename',displayName:name})}/>
    </>:<><Text>Kunde {customer.displayName} löschen? Stunden bleiben erhalten.</Text><ActionButton title="Löschen bestätigen" disabled={busy} onPress={()=>void save({action:'deactivate'})}/></>}
    {mode!==null?<ActionButton title="Abbrechen" tone="quiet" disabled={busy} onPress={()=>{setMode(null);setMessage('');}}/>:null}
    {message?<Text accessibilityLiveRegion="polite">{message}</Text>:null}
  </View>;
}
