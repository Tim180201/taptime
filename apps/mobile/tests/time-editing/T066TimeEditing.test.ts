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
