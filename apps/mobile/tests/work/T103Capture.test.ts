import { expect, it, vi } from 'vitest';
import { MobileWorkCoordinator } from '../../src/work/MobileWorkCoordinator';
import type { ManualTriggerResult, MobileWorkApiPort, MobileWorkSessionReader } from '../../src/work/contracts';
const target={targetType:'customer' as const,targetId:'20000000-0000-4000-8000-000000000001',displayName:'Kunde X'};
const snapshot={generation:1,session:{userId:'10000000-0000-4000-8000-000000000001',membershipId:'12000000-0000-4000-8000-000000000001',organizationId:'00000000-0000-4000-8000-000000000001',role:'employee' as const,nfcSetupAvailable:false}};
const session:MobileWorkSessionReader={capture:()=>snapshot,isCurrent:()=>true,subscribe:()=>()=>{}};
const active={timeRecordId:'60000000-0000-4000-8000-000000000001',source:'canonical' as const,targetType:target.targetType,targetId:target.targetId,targetDisplayName:target.displayName,status:'started' as const,startedAt:'2026-10-04T06:12:00.000Z',stoppedAt:null,startedVia:'manual' as const,stoppedVia:null,breakStartedAt:null as string|null};
const ownTime={activeRecord:active,records:[],nextCursor:null,windowStartedAt:'2026-08-31T22:00:00.000Z',windowEndedAt:'2026-10-04T09:47:00.000Z'};
function setup(pause:boolean,outcome='break_stopped') {
 const order:string[]=[];
 const api:MobileWorkApiPort={read:vi.fn(async()=>({status:'ready' as const,ownTime:{...ownTime,activeRecord:{...active,breakStartedAt:pause?'2026-10-04T08:30:00.000Z':null}},targets:{targets:[],nextCursor:null}})),readOwnTimePage:async()=>({status:'unavailable'}),
 triggerBreak:vi.fn(async()=>{order.push('break');return {status:'accepted' as const,outcome:outcome as 'break_stopped'};}),
 triggerManual:vi.fn(async()=>{order.push('work');return {status:'accepted' as const,outcome:'time_entry_stopped' as const};})};
 return {api,order,work:new MobileWorkCoordinator(session,api)};
}
it('stops the active target without requiring it in the selectable list',async()=>{
 const {api,order,work}=setup(false);await work.refresh();await work.stopActiveTime();
 expect(order).toEqual(['work']);expect(api.triggerManual).toHaveBeenCalledExactlyOnceWith(snapshot.session.membershipId,target);
});
it.each(['break_stopped','duplicate_scan_ignored','pending','rejected','escalation_required'])('chains only after %s confirms the pause ended',async(outcome)=>{
 const {order,work}=setup(true,outcome);await work.refresh();await work.stopActiveTime();
 expect(order).toEqual(outcome==='break_stopped'?['break','work']:['break']);
});
it('keeps every action locked until confirmation and the refreshed read finish',async()=>{
 const {api,work}=setup(false);await work.refresh();let release!:()=>void;
 api.triggerManual=vi.fn(()=>new Promise<ManualTriggerResult>(resolve=>{release=()=>resolve({status:'accepted',outcome:'time_entry_stopped'});}));
 const flight=work.stopActiveTime();expect(work.getState()).toMatchObject({submitting:true});
 await work.stopActiveTime();await work.triggerBreak();expect(api.triggerManual).toHaveBeenCalledTimes(1);expect(api.triggerBreak).not.toHaveBeenCalled();
 release();await flight;expect(work.getState()).toMatchObject({submitting:false});
});
it('blocks pagination during capture and discards a page started before capture after the confirmed reload',async()=>{
 const {api,work}=setup(false);
 const initial={...ownTime,nextCursor:'old-page'};
 api.read=vi.fn(async()=>({status:'ready' as const,ownTime:initial,targets:{targets:[],nextCursor:null}}));
 let releasePage!:()=>void;
 api.readOwnTimePage=vi.fn(()=>new Promise<import('../../src/work/contracts').MobileOwnTimePageResult>(resolve=>{releasePage=()=>resolve({status:'ready',ownTime:{...ownTime,records:[]}});}));
 await work.refresh();const oldPage=work.loadMoreOwnTime();
 let releaseStop!:()=>void;
 api.triggerManual=vi.fn(()=>new Promise<ManualTriggerResult>(resolve=>{releaseStop=()=>resolve({status:'accepted',outcome:'time_entry_stopped'});}));
 api.read=vi.fn(async()=>({status:'ready' as const,ownTime:{...ownTime,activeRecord:null},targets:{targets:[],nextCursor:null}}));
 const stop=work.stopActiveTime();await work.loadMoreOwnTime();
 expect(api.readOwnTimePage).toHaveBeenCalledTimes(1);
 releaseStop();await stop;releasePage();await oldPage;
 expect(work.getState()).toMatchObject({status:'ready',submitting:false,loadingMore:false,outcome:'time_entry_stopped',ownTime:{activeRecord:null}});
});
it('requires a fresh read before another capture after a confirmed action cannot be reloaded',async()=>{
 const {api,work}=setup(false);await work.refresh();
 api.read=vi.fn(async()=>({status:'unavailable' as const}));
 await work.stopActiveTime();await work.stopActiveTime();await work.triggerBreak();
 expect(work.getState()).toMatchObject({status:'unavailable'});
 expect(api.triggerManual).toHaveBeenCalledTimes(1);expect(api.triggerBreak).not.toHaveBeenCalled();
});
it('keeps a saved queue event locked until its exact confirmation and chains only the confirmed pause',async()=>{
 const {api}=setup(true);const order:string[]=[];
 let notify=()=>{};
 const acknowledgements=new Map<string,import('../../src/offline/OfflineCaptureCoordinator').ManualOfflineAcknowledgement>();
 const queue={captureManual:vi.fn(async()=>{order.push('work');acknowledgements.set('work',{status:'pending'});return {status:'saved' as const,workEventId:'work'};}),
 captureBreak:vi.fn(async()=>{order.push('break');acknowledgements.set('break',{status:'pending'});return {status:'saved' as const,workEventId:'break'};}),
 readManualAcknowledgement:(id:string)=>acknowledgements.get(id)??null,
 subscribeManualAcknowledgements:(listener:()=>void)=>{notify=listener;return()=>{};}};
 const work=new MobileWorkCoordinator(session,api,queue);work.start();await work.refresh();await work.stopActiveTime();
 expect(order).toEqual(['break']);expect(work.getState()).toMatchObject({submitting:true});
 await work.stopActiveTime();expect(order).toEqual(['break']);
 acknowledgements.set('break',{status:'server_decision',outcome:'break_stopped'});notify();
 await vi.waitFor(()=>expect(order).toEqual(['break','work']));
 expect(work.getState()).toMatchObject({submitting:true});
 await work.stopActiveTime();expect(order).toEqual(['break','work']);
 acknowledgements.set('work',{status:'server_decision',outcome:'time_entry_stopped'});notify();
 await vi.waitFor(()=>expect(work.getState()).toMatchObject({submitting:false,outcome:'time_entry_stopped'}));work.stop();
});
it('processes an acknowledgement arriving as the previous acknowledgement check completes',async()=>{
 const {api}=setup(false);let notify=()=>{};
 let acknowledgement:import('../../src/offline/OfflineCaptureCoordinator').ManualOfflineAcknowledgement={status:'pending'};
 const queue={captureManual:vi.fn(async()=>{
   queueMicrotask(()=>queueMicrotask(()=>queueMicrotask(()=>{
     acknowledgement={status:'server_decision',outcome:'time_entry_stopped'};notify();
   })));
   return {status:'saved' as const,workEventId:'work'};
 }),readManualAcknowledgement:()=>acknowledgement,
 subscribeManualAcknowledgements:(listener:()=>void)=>{notify=listener;return()=>{};}};
 const work=new MobileWorkCoordinator(session,api,queue);work.start();await work.refresh();await work.stopActiveTime();
 await vi.waitFor(()=>expect(work.getState()).toMatchObject({status:'ready',submitting:false,outcome:'time_entry_stopped'}));
 expect(api.read).toHaveBeenCalledTimes(2);work.stop();
});
