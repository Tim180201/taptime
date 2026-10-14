import {expect,it,vi} from 'vitest';
import {TapTimeAdministrationApiClient} from '../../src/administration/TapTimeAdministrationApiClient';
import {TimeEditingCoordinator} from '../../src/timeEditing/TimeEditingCoordinator';
import type {AuthenticatedJsonPostPort} from '../../src/transport/AuthenticatedHttpRequestExecutor';
const id='10000000-0000-4000-8000-000000000001';
const setup={status:'succeeded',organization:{id,name:'Betrieb'},customers:[],nfcTags:[],nextCursor:null};
it.each(['setup_tags','setup_customers'] as const)('queries %s independently without following pages',async kind=>{
  const post=vi.fn<AuthenticatedJsonPostPort['post']>().mockResolvedValue({status:'response',statusCode:200,contentType:'application/json',body:JSON.stringify(setup)});
  const api=new TapTimeAdministrationApiClient('https://example.invalid',{post});
  expect(typeof api.querySearch).toBe('function');
  await expect(api.querySearch(kind,{expectedMembershipId:id,limit:50,cursor:null,search:'  Mu\u0308ller  ',kind:kind==='setup_tags'?'nfc_tags':'customers'})).resolves.toMatchObject({status:'ready'});
  expect(post).toHaveBeenCalledTimes(1);
  expect(post.mock.calls[0]![0].pathname).toBe('/v3/administration/setup-projection');
  expect(JSON.parse(post.mock.calls[0]![1])).toMatchObject({search:'Müller',kind:kind==='setup_tags'?'nfc_tags':'customers'});
});
it.each(['work_targets','backfill_targets'] as const)('loads only one %s page when adding time',async kind=>{
  const value={targets:[{targetType:'customer',targetId:id,displayName:'Müller',[kind==='work_targets'?'assignedToMe':'assignedToPerson']:false}],nextCursor:'next'};
  const post=vi.fn<AuthenticatedJsonPostPort['post']>().mockResolvedValue({status:'response',statusCode:200,contentType:'application/json',body:JSON.stringify(value)});
  const snapshot={generation:1,session:{userId:id,membershipId:id,organizationId:id,role:'administrator' as const,nfcSetupAvailable:true}};
  const coordinator=new TimeEditingCoordinator(new URL('https://example.invalid'),{post},{capture:()=>snapshot,isCurrent:()=>true,subscribe:()=>()=>{}},()=>id,{get:async()=>true,subscribe:()=>()=>{}});
  expect(typeof coordinator.querySearch).toBe('function');
  await expect(coordinator.querySearch(kind,{cursor:null,search:'Müller',...(kind==='backfill_targets'?{targetMembershipId:id}:{})})).resolves.toEqual({status:'ready',value});
  expect(post).toHaveBeenCalledTimes(1);
  expect(post.mock.calls[0]![0].pathname).toBe(kind==='work_targets'?'/v2/mobile/work-targets/query':'/v2/administration/time-records/backfill-targets/query');
});
