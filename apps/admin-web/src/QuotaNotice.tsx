import { useEffect, useRef, useState } from 'react';
import { businessDay } from '@taptime/core';
import { quotaStageLabel, unseenQuotaNotices, type QuotaNotice as Notice, type QuotaNoticeStorage } from '@taptime/mobile-work-contract';
import type { AdminWebCapability } from './contracts';
import { FeedbackBand } from './viewHelpers';
export const browserQuotaStorage:QuotaNoticeStorage={
  read:async key=>{try{return localStorage.getItem(key);}catch{return null;}},
  write:async key=>{localStorage.setItem(key,'1');},
};
export function CustomerQuotaNotice({administration,membership,role,authorityContext,onView,storage=browserQuotaStorage}:{
  administration:AdminWebCapability;membership:string;role:string;authorityContext:string;
  onView:(customerId:string,month:string)=>void;storage?:QuotaNoticeStorage;
}) {
  const active=useRef<typeof authorityContext|null>(authorityContext);active.current=authorityContext;
  const [loaded,setLoaded]=useState<{authorityContext:string;notices:Notice[];month:string}|null>(null),[error,setError]=useState('');
  useEffect(()=>{
    active.current=authorityContext;
    let cancelled=false;setLoaded(null);setError('');
    if(role==='employee')return;
    const month=businessDay(Date.now()).slice(0,7);
    void (async()=>{
      const result=await administration.readCustomerHours?.(month);
      if(result?.status!=='ready')return;
      const notices=await unseenQuotaNotices(result.value,membership,month,storage);
      if(!cancelled)setLoaded({authorityContext,notices,month});
    })().catch(()=>{});
    return ()=>{cancelled=true;active.current=null;};
  },[administration,membership,role,authorityContext,storage]);
  const notice=role!=='employee' && loaded?.authorityContext===authorityContext?loaded.notices[0]:null;
  if(!notice || !loaded)return null;
  const acknowledge=async(view:boolean)=>{
    try{await storage.write(notice.key);}catch{setError('Der Hinweis konnte nicht gespeichert werden. Bitte erlauben Sie lokalen Browserspeicher.');return;}
    if(active.current!==authorityContext)return;
    setLoaded(old=>old===loaded?{...old,notices:old.notices.slice(1)}:old);
    if(view)onView(notice.customerId,loaded.month);
  };
  return <div className="quota-notice"><FeedbackBand message={{kind:'info',text:`${notice.displayName}: ${quotaStageLabel(notice.stage)}`}}/>
    {error?<p role="alert">{error}</p>:null}<div className="toolbar"><button onClick={()=>void acknowledge(true)}>Ansehen</button><button className="quiet" onClick={()=>void acknowledge(false)}>Schließen</button></div></div>;
}
