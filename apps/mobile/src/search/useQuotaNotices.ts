import { useEffect, useRef, useState } from 'react';
import { businessDay } from '@taptime/core';
import { quotaNoticeKey, type QuotaNotice, type QuotaNoticeStorage } from '@taptime/mobile-work-contract';
import type { QuotaAlertsCapability } from './search';

export function useQuotaNotices(capability:QuotaAlertsCapability,membership:string,role:string,authority:unknown,storage:QuotaNoticeStorage) {
  const [loaded,setLoaded]=useState<{authority:unknown;membership:string;month:string;notices:QuotaNotice[];nextCursor:string|null}|null>(null);
  const [error,setError]=useState(false);
  const active=useRef<() => boolean>(()=>false),loadNext=useRef<(cursor:string)=>Promise<void>>(async()=>{}),acknowledging=useRef(false);
  useEffect(()=>{
    let cancelled=false;const current=()=>!cancelled;active.current=current;acknowledging.current=false;
    setLoaded(null);setError(false);
    if(role==='employee')return ()=>{cancelled=true;};
    const month=businessDay(Date.now()).slice(0,7),seen=new Set<string|null>();
    const load=async(cursor:string|null)=>{
      while(current()&&!seen.has(cursor)) {
        seen.add(cursor);
        const result=await capability.readQuotaAlerts?.(month,cursor);
        if(!current()||result?.status!=='ready'||!result.value)return;
        const value=result.value,notices:QuotaNotice[]=[];
        if(value.scope!=='people')return;
        for(const customer of value.customers) {
          const stage=customer.quotaStage;
          if(stage!=='warning'&&stage!=='exceeded')continue;
          const key=quotaNoticeKey(membership,month,customer.customerId,stage);
          if(await storage.read(key)!=='1')notices.push({key,customerId:customer.customerId,displayName:customer.displayName,stage});
        }
        if(!current())return;
        setLoaded({authority,membership,month,notices,nextCursor:value.nextCursor});
        if(notices.length||value.nextCursor===null)return;
        cursor=value.nextCursor;
      }
    };
    loadNext.current=load;
    void load(null).catch(()=>{});
    return()=>{cancelled=true;};
  },[capability,membership,role,authority,storage]);
  const visible=role!=='employee'&&loaded!==null&&loaded.authority===authority&&loaded.membership===membership?loaded:null;
  const notice=visible?.notices[0];
  const acknowledge=async():Promise<string|null>=>{
    if(!notice||!visible||acknowledging.current)return null;
    const current=active.current;acknowledging.current=true;
    try {
      await storage.write(notice.key);
      if(!current())return null;
      setError(false);const notices=visible.notices.slice(1);
      setLoaded({...visible,notices});
      if(notices.length===0&&visible.nextCursor!==null)void loadNext.current(visible.nextCursor).catch(()=>{});
      return visible.month;
    }catch{if(current())setError(true);return null;}
    finally{if(current())acknowledging.current=false;}
  };
  return {notice,error,acknowledge};
}
