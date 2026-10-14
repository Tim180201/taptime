import {useQuotaNotices} from '../../mobile/src/search/useQuotaNotices';
import { quotaStageLabel, type QuotaNoticeStorage } from '@taptime/mobile-work-contract';
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
  const {notice,error:failed,acknowledge:markSeen}=useQuotaNotices(administration,membership,role,authorityContext,storage);
  const error=failed?'Der Hinweis konnte nicht gespeichert werden. Bitte erlauben Sie lokalen Browserspeicher.':'';
  if(!notice)return null;
  const acknowledge=async(view:boolean)=>{
    const month=await markSeen();
    if(view&&month)onView(notice.customerId,month);
  };
  return <div className="quota-notice"><FeedbackBand message={{kind:'info',text:`${notice.displayName}: ${quotaStageLabel(notice.stage)}`}}/>
    {error?<p role="alert">{error}</p>:null}<div className="toolbar"><button onClick={()=>void acknowledge(true)}>Ansehen</button><button className="quiet" onClick={()=>void acknowledge(false)}>Schließen</button></div></div>;
}
