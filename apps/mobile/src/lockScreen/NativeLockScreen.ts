import { Alert, Linking, PermissionsAndroid, Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { isLockScreenState, isLockScreenActionRequest, type LockScreenCapabilityRequest } from '@taptime/mobile-work-contract';
import type { IssueStatus, LockScreenNativePort, LockScreenStand } from './contracts';

interface NativeModule {
  read():string;
  bind(owner:string):boolean;
  clear():boolean;
  suspend():boolean;
  awaitOwnCapture():boolean;
  project(owner:string,state:string|null,revision:string,discardPending:boolean):boolean;
  issue(owner:string,token:string,body:string,baseUrl:string,appVersion:string,revision:string):Promise<IssueStatus>;
  retry():Promise<void>;
  claimPermissionPrompt():boolean;
  addListener(event:'onStandChanged',listener:()=>void):{remove():void};
}
/** No native lookup, permission prompt, subscriptions or requests on iOS. */
export function createNativeLockScreen(baseUrl:string,appVersion:string):LockScreenNativePort|null {
  if (Platform.OS !== 'android') return null;
  const native=requireOptionalNativeModule<NativeModule>('TapTimeLockScreen');
  if (!native) return null;
  const read=():LockScreenStand|null=>{
    try {
      const value=JSON.parse(native.read());
      if (!value || typeof value.permissionGranted!=='boolean' || typeof value.permissionAsked!=='boolean'
        || value.state!==undefined&&!isLockScreenState(value.state)
        || value.pending!==undefined&&!isLockScreenActionRequest(value.pending)) return null;
      // Deliberate allowlist on both sides of the bridge.
      return {owner:value.owner,revision:value.revision,state:value.state,pending:value.pending,display:value.display,ownCapturePending:value.ownCapturePending===true,
        permissionGranted:value.permissionGranted,permissionAsked:value.permissionAsked};
    } catch {return null;}
  };
  return {
    read,bind:owner=>native.bind(owner),clear:()=>native.clear(),suspend:()=>native.suspend(),awaitOwnCapture:()=>native.awaitOwnCapture(),
    project:(owner,state,revision,discard)=>native.project(owner,state?JSON.stringify(state):null,revision,discard),
    issue:(owner,token,request:LockScreenCapabilityRequest,revision)=>native.issue(owner,token,JSON.stringify(request),baseUrl,appVersion,revision),
    retry:()=>native.retry(),subscribe:listener=>{const subscription=native.addListener('onStandChanged',listener);return()=>subscription.remove();},
    openSettings:()=>{void Linking.openSettings().catch(()=>undefined);},
    async ensurePermission(){
      if (Number(Platform.Version)<33 || read()?.permissionGranted || !native.claimPermissionPrompt()) return;
      await new Promise<void>(resolve=>Alert.alert('Laufende Zeit auf dem Sperrbildschirm',
        'Du kannst dort pausieren und beenden. Der Name deines Arbeitsziels ist auch bei gesperrtem Handy sichtbar.',
        [{text:'Weiter',onPress:()=>resolve()}],{cancelable:false}));
      await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
    },
  };
}
