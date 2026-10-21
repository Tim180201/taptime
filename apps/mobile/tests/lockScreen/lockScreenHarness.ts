import { expect, vi } from 'vitest';
import { LockScreenCoordinator } from '../../src/lockScreen/LockScreenCoordinator';
import { MobileWorkCoordinator } from '../../src/work/MobileWorkCoordinator';
import type { AuthenticatedRequestCapability, MobileSessionState } from '../../src/auth/contracts';
import type { LockScreenNativePort, LockScreenStand } from '../../src/lockScreen/contracts';
import type { MobileWorkApiPort } from '../../src/work/contracts';
import type { LockScreenState } from '@taptime/mobile-work-contract';
import type { ProductScanState } from '../../src/scan/contracts';
import type { AppStatePort } from '../../src/runtime/AppStateAutoRefreshLifecycle';

export const snapshot={generation:1,session:{userId:'10000000-0000-4000-8000-000000000001',membershipId:'12000000-0000-4000-8000-000000000001',organizationId:'00000000-0000-4000-8000-000000000001',role:'employee' as const,nfcSetupAvailable:false}};
export const owner=`${snapshot.session.organizationId}/${snapshot.session.membershipId}/${snapshot.session.userId}`;
export const initial:LockScreenState={timeEntryId:'60000000-0000-4000-8000-000000000001',status:'running',startedAt:'2026-10-21T06:00:00.000Z',stoppedAt:null,breakStartedAt:null,asOf:'2026-10-21T07:00:00.000Z',workDurationSeconds:3600,breakDurationSeconds:0,target:{targetType:'customer',targetId:'20000000-0000-4000-8000-000000000001',displayName:'Testziel'}};
export function harness(options:{queued?:boolean}={}){
  let stand:LockScreenStand={owner,revision:'initial',state:initial,permissionGranted:true,permissionAsked:true};
  let server={...initial},online=true,unconfirmed=false,sessionState:MobileSessionState={status:'authenticated',session:snapshot.session};
  let nativeListener=()=>{},sessionListener=()=>{},connectivityListener=(online:boolean)=>{},scanListener=()=>{};
  let scanState:ProductScanState={status:'ready',outcome:null};
  let appStatus:AppStatePort['currentState']='active',appListener=(state:AppStatePort['currentState'])=>{};
  const session={capture:()=>sessionState.status==='authenticated'?snapshot:null,isCurrent:()=>sessionState.status==='authenticated',subscribe:(fn:()=>void)=>{sessionListener=fn;return()=>{};},getState:()=>sessionState};
  const auth:AuthenticatedRequestCapability & {refresh():Promise<void>}={executeAuthenticatedRequest:async attempt=>attempt(()=> 'test-access'),refresh:vi.fn(async()=>{})};
  const native:LockScreenNativePort={read:()=>stand,bind:vi.fn(()=>true),clear:vi.fn(()=>{stand={permissionGranted:true,permissionAsked:true};return true;}),suspend:vi.fn(()=>true),
    awaitOwnCapture:vi.fn(()=>{stand={...stand,ownCapturePending:true,pending:undefined,display:'TRANSFERRING'};return true;}),
    project:vi.fn((bound,state,revision,discard)=>{if(bound!==stand.owner||revision!==stand.revision||stand.pending&&!discard)return false;stand={...stand,state:state??undefined,pending:undefined,display:state?'STATE':undefined,ownCapturePending:false};return true;}),
    issue:vi.fn(async()=> 'issued' as const),retry:vi.fn(async()=>{server={...server,status:'paused',breakStartedAt:server.asOf};stand={...stand,pending:undefined,revision:'retry-confirmed',state:server};nativeListener();}),
    subscribe:fn=>{nativeListener=fn;return()=>{};},ensurePermission:vi.fn(async()=>{}),openSettings:vi.fn()};
  const record=()=>({timeRecordId:server.timeEntryId,source:'canonical' as const,targetType:server.target.targetType,targetId:server.target.targetId,
    targetDisplayName:server.target.displayName,status:server.status==='stopped'?'stopped' as const:'started' as const,startedAt:server.startedAt,
    stoppedAt:server.stoppedAt,startedVia:'manual' as const,stoppedVia:server.stoppedAt?'manual' as const:null,breakStartedAt:server.breakStartedAt,
    calendar:{asOf:server.asOf,workDurationSeconds:server.workDurationSeconds,breakDurationSeconds:server.breakDurationSeconds,breakIntervals:[]}});
  const api:MobileWorkApiPort={read:vi.fn(async()=>({status:'ready' as const,ownTime:{activeRecord:server.status==='stopped'?null:record(),
    records:server.status==='stopped'?[record()]:[],nextCursor:null,windowStartedAt:'2026-09-30T22:00:00.000Z',windowEndedAt:server.asOf},targets:{targets:[],nextCursor:null}})),
    readOwnTimePage:async()=>({status:'unavailable'}),triggerManual:vi.fn(async()=>({status:'accepted' as const,outcome:'time_entry_stopped' as const})),
    triggerBreak:vi.fn(async()=>({status:'accepted' as const,outcome:'break_started' as const}))};
  const queue={captureManual:vi.fn(async()=>{unconfirmed=true;return {status:'saved' as const,workEventId:'99000000-0000-4000-8000-000000000004'};}),
    captureBreak:vi.fn(async()=>{unconfirmed=true;return {status:'saved' as const,workEventId:'99000000-0000-4000-8000-000000000005'};}),
    hasUnconfirmedCapture:async()=>unconfirmed};
  const work=new MobileWorkCoordinator(session,api,options.queued?queue:null);
  const controller=new LockScreenCoordinator(native,session,auth,work,{hasUnconfirmedCapture:async()=>unconfirmed,lockScreenInstallationId:async()=>null},
    {getState:()=>scanState,subscribe:fn=>{scanListener=fn;return()=>{};},scan:async()=>{},cancel:async()=>{},retry:async()=>{}},
    {get:async()=>online,subscribe:fn=>{connectivityListener=fn;return()=>{};}},{get currentState(){return appStatus;},addEventListener:(_type,listener)=>{appListener=listener;return {remove(){}};}});
  work.lockScreenBoundary=controller;
  return {native,api,work,controller,auth,queue,getStand:()=>stand,setStand:(value:Partial<LockScreenStand>,notify=false)=>{stand={...stand,...value};if(notify)nativeListener();},
    setOnline:(value:boolean)=>{online=value;connectivityListener(value);},setServer:(value:Partial<LockScreenState>)=>{server={...server,...value};},
    setAppState:(state:AppStatePort['currentState'])=>{appStatus=state;appListener(state);},
    setUnconfirmed:(value:boolean)=>{unconfirmed=value;},signOut:()=>{sessionState={status:'signed_out'};sessionListener();},setScan:(state:ProductScanState)=>{scanState=state;scanListener();}};
}
export async function ready(h:ReturnType<typeof harness>){h.controller.start();await h.controller.refresh();expect(h.native.issue).toHaveBeenCalled();}

