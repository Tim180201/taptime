import { useState } from 'react';
import { View } from 'react-native';
import { formatHours } from '@taptime/core';
import { parseQuotaHours, quotaStageLabel, type QuotaStage } from '@taptime/mobile-work-contract';
import { ActionButton, AppText as Text, TextField } from '../design/primitives';
import { mobileTokens } from '../design/tokens';
import type { MobileWorkCapability } from '../work/contracts';
export interface QuotaCustomer {customerId:string;workDurationSeconds:number;quotaSeconds?:number|null;quotaStage?:QuotaStage}
export function QuotaProgress({customer}:{customer:QuotaCustomer}) {
  if(customer.quotaSeconds==null) return null;
  const label=quotaStageLabel(customer.quotaStage),color=label?mobileTokens.color.warning:mobileTokens.color.accent;
  return <View style={{gap:8,flex:1}}><Text style={{fontWeight:'800'}}>{formatHours(customer.workDurationSeconds*1000)} / {formatHours(customer.quotaSeconds*1000)} h</Text>
    <View accessibilityRole="progressbar" accessibilityLabel="Monatskontingent" accessibilityValue={{min:0,max:customer.quotaSeconds,now:Math.min(customer.workDurationSeconds,customer.quotaSeconds)}} style={{height:8,backgroundColor:mobileTokens.color.border,borderRadius:4,overflow:'hidden'}}>
      <View style={{height:8,width:`${Math.min(100,customer.workDurationSeconds/customer.quotaSeconds*100)}%`,backgroundColor:color}}/>
    </View>{label?<Text style={{color}}>{label}</Text>:null}</View>;
}
export function CustomerQuota({customer,work,onSaved,editable}:{customer:QuotaCustomer;work:MobileWorkCapability;onSaved:()=>void;editable:boolean}) {
  const [editing,setEditing]=useState(false),[input,setInput]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const save=async()=>{
    const minutes=parseQuotaHours(input);
    if(minutes===undefined){setError('Gib 0,5 bis 744 Stunden in halben oder ganzen Stunden ein.');return;}
    setBusy(true);setError('');
    const result=await work.setCustomerQuota?.(customer.customerId,minutes).catch(()=>({status:'unavailable'}));
    setBusy(false);
    if(result?.status==='succeeded'){setEditing(false);onSaved();}
    else setError(result?.status==='forbidden'?'Du darfst das Kontingent dieses Kunden nicht mehr ändern.':'Das Kontingent konnte nicht gespeichert werden. Versuche es erneut. Deine Eingabe bleibt erhalten.');
  };
  return <View style={{gap:12}}><Text>Kontingent: {customer.quotaSeconds==null?'Kein Kontingent':`${formatHours(customer.quotaSeconds*1000)} h pro Monat`}</Text><QuotaProgress customer={customer}/>
    {editing?<><Text>Stunden pro Monat (optional)</Text><TextField accessibilityLabel="Stunden pro Monat (optional)" keyboardType="decimal-pad" value={input} editable={!busy} onChangeText={setInput}/>
      <Text>0,5 bis 744 Stunden. Leer lassen entfernt das Kontingent. Änderungen gelten ab dem laufenden Monat.</Text>
      {error?<Text accessibilityRole="alert">{error}</Text>:null}
      <ActionButton title={busy?'Speichert …':'Kontingent speichern'} disabled={busy} onPress={()=>void save()}/><ActionButton title="Abbrechen" tone="quiet" disabled={busy} onPress={()=>setEditing(false)}/>
    </>:editable?<ActionButton title="Ändern" tone="quiet" onPress={()=>{setInput(customer.quotaSeconds==null?'':String(customer.quotaSeconds/3600).replace('.',','));setEditing(true);setError('');}}/>:<Text>Änderungen sind im laufenden Monat möglich.</Text>}
  </View>;
}
