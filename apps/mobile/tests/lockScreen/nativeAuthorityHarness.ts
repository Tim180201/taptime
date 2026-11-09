import {vi} from 'vitest';
import type {LockScreenState} from '@taptime/mobile-work-contract';
import type {LockScreenNativePort, LockScreenStand} from '../../src/lockScreen/contracts';
import type {AppStatePort} from '../../src/runtime/AppStateAutoRefreshLifecycle';

/** Native authority only; the integration uses the real work, capture and lock-screen coordinators.
 * iOS: LockScreenEngine.suspend/project/issue, runtime.render's canSend.
 * Android: LockScreenRuntime.awaitOwnCapture/project/issue (sessionId, not the button nonce).
 * Ordinary saves render but do not emit onStandChanged; only native actions emit it.
 */
export function nativeAuthorityHarness(platform:'ios'|'android', server:()=>LockScreenState|null) {
  let stand:LockScreenStand|null=null, appBlocked=true, key=false, nonce=0, sessionId=0;
  let appStatus:AppStatePort['currentState']='active', preview:LockScreenState|null|undefined;
  let appListener=(state:AppStatePort['currentState'])=>{}, nativeListener=()=>{};
  const trace:string[]=[];
  const foreground=()=>platform==='android'||appStatus==='active';
  const native:LockScreenNativePort={
    foregroundOnly:platform==='ios', read:()=>stand,
    bind:owner=>{
      if(!foreground())return false;
      if(stand?.owner!==owner){stand={owner,revision:`bind-${++sessionId}`,permissionAsked:true,permissionGranted:true};nonce++;key=false;appBlocked=true;}
      return true;
    },
    clear:()=>{stand=null;key=false;nonce++;sessionId++;return true;},
    suspend:()=>{if(stand){appBlocked=true;nonce++;if(platform==='android'&&!stand.pending&&stand.state?.status!=='stopped')sessionId++;}return true;},
    awaitOwnCapture:()=>{
      if(!stand)return true;
      if(platform==='android'&&stand.ownCapturePending)return true;
      trace.push('awaitOwnCapture');appBlocked=true;nonce++;key=false;
      if(platform==='android')sessionId++;
      stand={...stand,ownCapturePending:true,pending:undefined,display:'TRANSFERRING'};return true;
    },
    preview:(_owner,state,until)=>{if(!foreground())return false;preview=until?state:undefined;trace.push(until?'preview':'clearPreview');return true;},
    project:(owner,state,revision,discard)=>{
      if(!foreground()||!stand||stand.owner!==owner||stand.revision!==revision||stand.pending&&!discard)return false;
      trace.push('project');preview=undefined;appBlocked=true;key=false;nonce++;sessionId++;
      stand={...stand,state:state??undefined,pending:undefined,ownCapturePending:false,display:'STATE'};return true;
    },
    issue:vi.fn(async(owner,_token,request,revision)=>{
      if(!foreground()||!stand||stand.owner!==owner||stand.revision!==revision||stand.pending||stand.ownCapturePending)return 'superseded';
      const stamp=platform==='ios'?nonce:sessionId;
      trace.push('issue:start');await Promise.resolve();
      if(!foreground()||!stand||stand.owner!==owner||stand.revision!==revision||stand.pending||stand.ownCapturePending||stamp!==(platform==='ios'?nonce:sessionId)){
        trace.push('issue:superseded');return 'superseded';
      }
      const state=server();if(!state||state.status==='stopped'||request.timeEntryId!==state.timeEntryId)return 'unavailable';
      key=true;appBlocked=false;nonce++;stand={...stand,state,display:'STATE'};trace.push('issue:issued');return 'issued';
    }),
    retry:async()=>{},subscribe:listener=>{nativeListener=listener;return()=>{};},ensurePermission:async()=>{},openSettings:()=>{},
  };
  const app:AppStatePort={get currentState(){return appStatus;},addEventListener:(_event,listener)=>{appListener=listener;return {remove(){}};}};
  const nativeResult=(state:LockScreenState)=>{if(!stand)throw Error('Not bound');stand={...stand,state,revision:`action-${++sessionId}`,pending:undefined,ownCapturePending:false};nonce++;if(state.status==='stopped')key=false;nativeListener();};
  return {native,app,trace,
    inspect:()=>({key,appBlocked,ownCapturePending:stand?.ownCapturePending,canSend:key&&!appBlocked&&!stand?.ownCapturePending&&preview===undefined,state:stand?.state,nonce}),
    setAppState:(state:AppStatePort['currentState'])=>{appStatus=state;appListener(state);},
    nativeResult,
    async tap(action:'pause'|'resume'|'stop',buttonNonce:number,reply:()=>LockScreenState){
      // LockScreenEngine.action / LockScreenLogic.command: a stale label or nonce never toggles.
      if(!stand?.state||!key||appBlocked||stand.ownCapturePending||buttonNonce!==nonce||preview!==undefined
        ||action==='pause'&&stand.state.status!=='running'||action==='resume'&&stand.state.status!=='paused')return false;
      stand={...stand,pending:{commandId:`command-${++sessionId}`,action},display:'SENDING',revision:`sending-${sessionId}`};nonce++;nativeListener();
      await Promise.resolve();nativeResult(reply());return true;
    },
  };
}
