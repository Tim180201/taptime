import { Linking, Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { isLockScreenState, isLockScreenActionRequest } from '@taptime/mobile-work-contract';
import type { IssueStatus, LockScreenNativePort, LockScreenStand, LockScreenTapDiagnostic } from './contracts';
import { isLockScreenCaptureLink } from './captureLink';

function readLastTap(value:unknown):LockScreenTapDiagnostic|undefined {
  if(!value||typeof value!=='object')return undefined;
  const v=value as Record<string,unknown>;
  if(Object.keys(v).sort().join(',')!=='appState,at,performRan,protectedDataAvailable,result'
    ||typeof v.at!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v.at)||!Number.isFinite(Date.parse(v.at))
    ||typeof v.performRan!=='boolean'||typeof v.protectedDataAvailable!=='boolean'
    ||!['active','inactive','background'].includes(v.appState as string)
    ||!['started','executed','state_changed','no_key','nonce_changed','blocked','storage','network',
      'unconfirmed','rejected','update_required','superseded'].includes(v.result as string))return undefined;
  return {at:v.at,performRan:v.performRan,appState:v.appState,protectedDataAvailable:v.protectedDataAvailable,result:v.result} as LockScreenTapDiagnostic;
}

interface IosModule {
  preview(owner:string,state:string|null,validUntil:string|null):boolean;
  read():string;
  bind(owner:string):boolean;
  clear():boolean;
  suspend():boolean;
  awaitOwnCapture():boolean;
  project(owner:string,state:string|null,revision:string,discard:boolean):boolean;
  issue(owner:string,token:string,body:string,baseUrl:string,version:string,revision:string):Promise<IssueStatus>;
  retry():Promise<void>;
  addListener(event:'onStandChanged',listener:()=>void):{remove():void};
}
export function createIosLockScreen(baseUrl:string,version:string,scheme:string|string[]|undefined):LockScreenNativePort|null {
  if (Platform.OS!=='ios') return null;
  const native=requireOptionalNativeModule<IosModule>('TapTimeIosLockScreen');
  if (!native) return null;
  return {
    preview:(owner,state,until)=>native.preview(owner,state?JSON.stringify(state):null,until),
    foregroundOnly:true,
    isCaptureUrl:url=>isLockScreenCaptureLink(url,'ios',scheme),
    read:():LockScreenStand|null=>{
      try {
        const value=JSON.parse(native.read());
        if (!value || typeof value.permissionGranted!=='boolean' || typeof value.permissionAsked!=='boolean'
          || value.state!==undefined&&!isLockScreenState(value.state)
          || value.pending!==undefined&&!isLockScreenActionRequest(value.pending)) return null;
        return {lastTap:readLastTap(value.lastTap),owner:value.owner,revision:value.revision,state:value.state,pending:value.pending,display:value.display,
          ownCapturePending:value.ownCapturePending===true,permissionGranted:value.permissionGranted,permissionAsked:value.permissionAsked};
      } catch {return null;}
    },
    bind:owner=>native.bind(owner),clear:()=>native.clear(),suspend:()=>native.suspend(),awaitOwnCapture:()=>native.awaitOwnCapture(),
    project:(owner,state,revision,discard)=>native.project(owner,state?JSON.stringify(state):null,revision,discard),
    issue:(owner,token,body,revision)=>native.issue(owner,token,JSON.stringify(body),baseUrl,version,revision),
    retry:()=>native.retry(),
    subscribe:listener=>{const subscription=native.addListener('onStandChanged',listener);return()=>subscription.remove();},
    // Live Activities have an OS setting, not a notification permission prompt.
    ensurePermission:async()=>{},openSettings:()=>{void Linking.openSettings().catch(()=>undefined);},
  };
}
