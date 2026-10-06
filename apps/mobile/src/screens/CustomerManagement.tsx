import {useSubviewBack} from '../navigation/SubviewBack';
import { useRequiredForm, RequiredTextField } from '../design/RequiredField';
import {useEffect,useRef,useState} from 'react';
import {View} from 'react-native';
import {customerManagementMessage,type CustomerManagementChange} from '@taptime/mobile-work-contract';
import type {AdminSetupCapability} from '../administration/contracts';
import {ActionButton,AppText as Text} from '../design/primitives';
export function CustomerManagement({customer,administration,onSaved,onEditingChange}:{readonly customer:{customerId:string;displayName:string};readonly administration:AdminSetupCapability;readonly onSaved:()=>void;readonly onEditingChange?:(open:boolean)=>void}){
  const form = useRequiredForm();
  const [mode,setMode]=useState<'rename'|'delete'|null>(null),[name,setName]=useState(customer.displayName),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
  useEffect(()=>{onEditingChange?.(mode!==null);return()=>onEditingChange?.(false);},[mode,onEditingChange]);
  useSubviewBack(mode!==null?()=>{if(!busy){setMode(null);setMessage('');}}:null,2);
  const mounted=useRef(true),pending=useRef(false);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  const save=async(change:CustomerManagementChange)=>{
    if(pending.current || change.action==='rename' && !form.validate())return;pending.current=true;setBusy(true);setMessage('');
    const result=await administration.manageCustomer?.(customer.customerId,change).catch(()=>({status:'unavailable' as const}))??{status:'unavailable' as const};
    pending.current=false;if(!mounted.current)return;setBusy(false);setMessage(customerManagementMessage(result));
    if(result.status==='succeeded'){setMode(null);onSaved();}
  };
  return <View style={{gap:8}}>
    {mode===null?<><ActionButton title="Kunde umbenennen" tone="quiet" onPress={()=>{setName(customer.displayName);setMode('rename');form.reset();setMessage('');}}/><ActionButton title="Kunde löschen" tone="warning" onPress={()=>{setMode('delete');setMessage('');}}/></>:mode==='rename'?<>
      <RequiredTextField form={form} error={!name.trim() ? "Bitte Kundenname eingeben." : null} accessibilityLabel="Neuer Kundenname" value={name} onChangeText={setName} editable={!busy}/>
      <ActionButton title="Namen speichern" disabled={busy} onPress={()=>void save({action:'rename',displayName:name})}/>
    </>:<><Text>Kunde {customer.displayName} löschen? Stunden bleiben erhalten.</Text><ActionButton title="Löschen bestätigen" tone="warning" disabled={busy} onPress={()=>void save({action:'deactivate'})}/></>}
    {mode!==null?<ActionButton title="Abbrechen" tone="quiet" disabled={busy} onPress={()=>{setMode(null);setMessage('');}}/>:null}
    {message?<Text accessibilityLiveRegion="polite">{message}</Text>:null}
  </View>;
}
