import {useQuotaNotices} from '../search/useQuotaNotices';
import { quotaStageLabel, type QuotaNoticeStorage } from '@taptime/mobile-work-contract';
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
  const {notice,error:failed,acknowledge:markSeen}=useQuotaNotices(work,membership,role,authorityContext,storage);
  const error=failed?'Der Hinweis konnte nicht gespeichert werden. Versuche es erneut.':'';
  if(!notice)return null;
  const acknowledge=async(view:boolean)=>{
    const month=await markSeen();
    if(view&&month)onView(notice.customerId,month);
  };
  return <Card><Text accessibilityRole="alert">{notice.displayName}: {quotaStageLabel(notice.stage)}</Text>
    {error?<Text accessibilityRole="alert">{error}</Text>:null}<ActionButton title="Ansehen" onPress={()=>void acknowledge(true)}/><ActionButton title="Schließen" tone="quiet" onPress={()=>void acknowledge(false)}/></Card>;
}
