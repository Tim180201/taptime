import { expect, it, vi } from 'vitest';
import { TimeEditingCoordinator } from '../../src/timeEditing/TimeEditingCoordinator';
import type { InternalAuthenticatedSessionSnapshot } from '../../src/auth/contracts';
const snapshot={generation:1,session:{userId:'10000000-0000-4000-8000-000000000001',organizationId:'20000000-0000-4000-8000-000000000001',membershipId:'30000000-0000-4000-8000-000000000001',role:'employee',nfcSetupAvailable:false}} as InternalAuthenticatedSessionSnapshot;
const data={targetMembershipId:snapshot.session.membershipId,targetType:'customer' as const,targetId:'40000000-0000-4000-8000-000000000001',startedAt:'2026-09-20T08:00:00.000Z',stoppedAt:'2026-09-20T09:00:00.000Z',reason:null,comment:null};
it('never sends offline, retains command identity after uncertain response, and rejects a changed session',async()=>{
  let online=false,current=true;
  const requests={post:vi.fn(async()=>({status:'unavailable' as const}))};
  const coordinator=new TimeEditingCoordinator(new URL('https://example.invalid'),requests,{capture:()=>snapshot,isCurrent:()=>current,subscribe:()=>()=>{}},()=> '50000000-0000-4000-8000-000000000001',
    {get:async()=>online,subscribe:()=>()=>{}});
  await coordinator.start();
  expect((await coordinator.save('backfill',data)).status).toBe('offline'); expect(requests.post).not.toHaveBeenCalled();
  online=true; await coordinator.start();
  await coordinator.save('backfill',data); await coordinator.save('backfill',data);
  expect(requests.post.mock.calls.length).toBe(2);
  expect(requests.post.mock.calls[0]).toEqual(requests.post.mock.calls[1]);
  current=false; expect((await coordinator.save('backfill',data)).status).toBe('authority_rejected');
  coordinator.stop();
});

it('uses a fresh command for an intentional identical edit after confirmed success',async()=>{
  const createUuid=vi.fn().mockReturnValueOnce('50000000-0000-4000-8000-000000000001').mockReturnValueOnce('50000000-0000-4000-8000-000000000002');
  const post=vi.fn(async(_url:URL,_body:string)=>({status:'response' as const,statusCode:200,contentType:'application/json',body:JSON.stringify({status:'committed',timeRecordId:data.targetId,idempotentRetry:false})}));
  const coordinator=new TimeEditingCoordinator(new URL('https://example.invalid'),{post},{capture:()=>snapshot,isCurrent:()=>true,subscribe:()=>()=>{}},createUuid,{get:async()=>true,subscribe:()=>()=>{}});
  await coordinator.start();
  const comment={timeRecordId:data.targetId,comment:'Vor Ort'};
  expect((await coordinator.save('comment',comment)).status).toBe('committed');
  expect((await coordinator.save('comment',comment)).status).toBe('committed');
  expect(JSON.parse(post.mock.calls[0]![1]).commandId).not.toBe(JSON.parse(post.mock.calls[1]![1]).commandId);
  coordinator.stop();
});


it.each(['administrator','standortleitung'] as const)('T-069 posts a validated stop, retains its command on uncertain retry and reports the pause boundary (%s)',async role=>{
  const admin={...snapshot,session:{...snapshot.session,role,managementScope:{kind:'location' as const,locationId:data.targetId,locationName:'Eins'}}};
  const post=vi.fn(async(_url:URL,_body:string)=>({status:'response' as const,statusCode:422,contentType:'application/json',body:JSON.stringify({status:'end_before_break'})}));
  const coordinator=new TimeEditingCoordinator(new URL('https://example.invalid'),{post},{capture:()=>admin,isCurrent:()=>true,subscribe:()=>()=>{}},()=> '50000000-0000-4000-8000-000000000001',{get:async()=>true,subscribe:()=>()=>{}});
  await coordinator.start();
  const stop={targetMembershipId:data.targetMembershipId,timeRecordId:data.targetId,expectedRowVersion:2,stoppedAt:data.stoppedAt,reason:'Vergessen'};
  expect(await coordinator.save('stop',stop)).toEqual({status:'end_before_break'});
  expect(await coordinator.save('stop',stop)).toEqual({status:'end_before_break'});
  expect(post.mock.calls[0]![0].pathname).toBe('/v1/time-records/stop');expect(post.mock.calls[0]).toEqual(post.mock.calls[1]);
  coordinator.stop();
});

it.each(['administrator','standortleitung'] as const)('D-078 preserves the stop command while awaiting archival, including an intervening edit (%s)',async role=>{
 const admin={...snapshot,session:{...snapshot.session,role,managementScope:{kind:'location' as const,locationId:data.targetId,locationName:'Eins'}}};
 let archived=false;
 const post=vi.fn(async(url:URL,_body:string)=>({status:'response' as const,statusCode:200,contentType:'application/json',
  body:JSON.stringify(url.pathname.endsWith('/stop')?{status:'committed',timeRecordId:data.targetId,idempotentRetry:false,requiredWalFile:'000000010000000000000002',offsiteArchived:archived}:{status:'committed',timeRecordId:data.targetId,idempotentRetry:false})}));
 let sequence=0;
 const coordinator=new TimeEditingCoordinator(new URL('https://example.invalid'),{post},{capture:()=>admin,isCurrent:()=>true,subscribe:()=>()=>{}},()=>`50000000-0000-4000-8000-${String(++sequence).padStart(12,'0')}`,{get:async()=>true,subscribe:()=>()=>{}});
 await coordinator.start();
 const stop={targetMembershipId:data.targetMembershipId,timeRecordId:data.targetId,expectedRowVersion:2,stoppedAt:data.stoppedAt,reason:'Vergessen'};
 expect(await coordinator.save('stop',stop)).toMatchObject({offsiteArchived:false});
 await coordinator.save('comment',{timeRecordId:data.targetId,comment:'Notiz'});
 archived=true;expect(await coordinator.save('stop',stop)).toMatchObject({offsiteArchived:true});
 expect(post.mock.calls[0]).toEqual(post.mock.calls[2]);coordinator.stop();
});

it('D-092 pages target-person choices without changing own capture state and drops a stale session',async()=>{
 let current=true;
 const second={targetType:'project',targetId:'40000000-0000-4000-8000-000000000002',displayName:'Projekt P'};
 const first={targetType:'customer',targetId:data.targetId,displayName:'Kunde P'};
 const post=vi.fn(async(_url:URL,body:string)=>({status:'response' as const,statusCode:200,contentType:'application/json',body:JSON.stringify({status:'ready',targets:[JSON.parse(body).cursor===null?first:second],nextCursor:JSON.parse(body).cursor===null?'next':null})}));
 const coordinator=new TimeEditingCoordinator(new URL('https://example.invalid'),{post},{capture:()=>snapshot,isCurrent:()=>current,subscribe:()=>()=>{}},()=>'',{get:async()=>true,subscribe:()=>()=>{}});
 await coordinator.start();
 expect(await coordinator.loadBackfillTargets(data.targetMembershipId)).toEqual({status:'ready',targets:[first,second]});
 expect(post.mock.calls.map(([url,body])=>[url.pathname,JSON.parse(body).targetMembershipId])).toEqual(Array(2).fill(['/v1/administration/time-records/backfill-targets/query',data.targetMembershipId]));
 expect(coordinator.getState()).toEqual({online:true,busy:false});
 post.mockImplementationOnce(async()=>{current=false;return {status:'response',statusCode:200,contentType:'application/json',body:JSON.stringify({status:'ready',targets:[first],nextCursor:null})};});
 expect(await coordinator.loadBackfillTargets(data.targetMembershipId)).toEqual({status:'authority_rejected'});
 coordinator.stop();
});

it('D-092 maps an actual HTTP 403 target-scope rejection to the existing authority message',async()=>{
 const post=vi.fn(async()=>({status:'response' as const,statusCode:403,contentType:'application/json',body:JSON.stringify({error:{code:'forbidden'}})}));
 const coordinator=new TimeEditingCoordinator(new URL('https://example.invalid'),{post},{capture:()=>snapshot,isCurrent:()=>true,subscribe:()=>()=>{}},()=>'',{get:async()=>true,subscribe:()=>()=>{}});
 await coordinator.start();
 expect(await coordinator.loadBackfillTargets(data.targetMembershipId)).toEqual({status:'authority_rejected'});
 coordinator.stop();
});
