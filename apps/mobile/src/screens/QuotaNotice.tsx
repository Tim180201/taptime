import { useEffect, useRef, useState } from 'react';
import { businessDay } from '@taptime/core';
import { quotaStageLabel, unseenQuotaNotices, type QuotaNotice as Notice, type QuotaNoticeStorage } from '@taptime/mobile-work-contract';
import type { MobileWorkCapability } from '../work/contracts';
import { ActionButton, AppText as Text, Card } from '../design/primitives';
export const deviceQuotaStorage:QuotaNoticeStorage={
  read:async key=>(await import('expo-secure-store')).getItemAsync(key),
  write:async key=>{const store=await import('expo-secure-store');await store.setItemAsync(key,'1',{keychainAccessible:store.WHEN_UNLOCKED_THIS_DEVICE_ONLY});},
};
export function CustomerQuotaNotice({work,membership,role,authorityContext,onView,storage=deviceQuotaStorage}:{
  work:MobileWorkCapability;membership:string;role:string;authorityContext:object;
  onView:(customerId:string,month:string)=>void;storage?:QuotaNoticeStorage;
}) {
  const active=useRef<typeof authorityContext|null>(authorityContext);active.current=authorityContext;
  const [loaded,setLoaded]=useState<{authorityContext:object;notices:Notice[];month:string}|null>(null),[error,setError]=useState('');
  useEffect(()=>{
    active.current=authorityContext;
    let cancelled=false;setLoaded(null);setError('');
    if(role==='employee')return;
    const month=businessDay(Date.now()).slice(0,7);
    void (async()=>{
      const result=await work.readCustomerHours?.(month);
      if(result?.status!=='ready')return;
      const notices=await unseenQuotaNotices(result.value,membership,month,storage);
      if(!cancelled)setLoaded({authorityContext,notices,month});
    })().catch(()=>{});
    return ()=>{cancelled=true;active.current=null;};
  },[work,membership,role,authorityContext,storage]);
  const notice=role!=='employee' && loaded?.authorityContext===authorityContext?loaded.notices[0]:null;
  if(!notice || !loaded)return null;
  const acknowledge=async(view:boolean)=>{
    try{await storage.write(notice.key);}catch{setError('Der Hinweis konnte nicht gespeichert werden. Versuche es erneut.');return;}
    if(active.current!==authorityContext)return;
    setLoaded(old=>old===loaded?{...old,notices:old.notices.slice(1)}:old);
    if(view)onView(notice.customerId,loaded.month);
  };
  return <Card><Text accessibilityRole="alert">{notice.displayName}: {quotaStageLabel(notice.stage)}</Text>
    {error?<Text accessibilityRole="alert">{error}</Text>:null}<ActionButton title="Ansehen" onPress={()=>void acknowledge(true)}/><ActionButton title="Schließen" tone="quiet" onPress={()=>void acknowledge(false)}/></Card>;
}
