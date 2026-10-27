import type {ReactNode} from 'react';
import {DestructiveDialog} from '../design/DestructiveDialog';
import {useMobileTokens} from '../design/useMobileTheme';
import {useSubviewBack} from '../navigation/SubviewBack';
import { useRequiredForm, RequiredTextField } from '../design/RequiredField';
import {useEffect,useRef,useState} from 'react';
import {View} from 'react-native';
import {customerManagementMessage,type CustomerManagementChange} from '@taptime/mobile-work-contract';
import type {AdminSetupCapability} from '../administration/contracts';
import {ActionButton,AppText as Text} from '../design/primitives';
export function CustomerManagement({customer,administration,onSaved,onEditingChange,children}:{readonly children?:ReactNode;readonly customer:{customerId:string;displayName:string};readonly administration:AdminSetupCapability;readonly onSaved:()=>void;readonly onEditingChange?:(open:boolean)=>void}){
  const tokens=useMobileTokens();
  const [triggerY,setTriggerY]=useState<number>();
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
    {mode!=='rename'?<><ActionButton title="Kunde umbenennen" tone="quiet" onPress={()=>{setName(customer.displayName);setMode('rename');form.reset();setMessage('');}}/></>:mode==='rename'?<>
      <RequiredTextField form={form} error={!name.trim() ? "Bitte Kundenname eingeben." : null} accessibilityLabel="Neuer Kundenname" value={name} onChangeText={setName} editable={!busy}/>
      <ActionButton title="Namen speichern" disabled={busy} onPress={()=>void save({action:'rename',displayName:name})}/>
    </>:null}
    {mode==='rename'?<ActionButton title="Abbrechen" tone="quiet" disabled={busy} onPress={()=>{setMode(null);setMessage('');}}/>:null}
    {children}
    <View style={{marginTop:32,paddingTop:24,borderTopWidth:1,borderTopColor:tokens.color.border}}>
      <ActionButton title="Kunde löschen" tone="warning" disabled={mode!==null} onPress={event=>{setTriggerY(event.nativeEvent?.pageY);setMode('delete');setMessage('');}}/>
    </View>
    {mode==='delete'?<DestructiveDialog title={`Kunde ${customer.displayName} löschen?`} triggerY={triggerY} confirmLabel="Löschen bestätigen" busy={busy} onConfirm={()=>void save({action:'deactivate'})} onCancel={()=>{setMode(null);setMessage('');}}>
      <Text>Stunden bleiben erhalten. Zugeordnete Karten werden frei.</Text>
      {message?<Text accessibilityRole="alert">{message}</Text>:null}
    </DestructiveDialog>:null}
    {message&&mode!=='delete'?<Text accessibilityLiveRegion="polite">{message}</Text>:null}
  </View>;
}
