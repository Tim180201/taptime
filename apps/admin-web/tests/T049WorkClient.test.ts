import {describe,it,expect,vi} from 'vitest';
import {AdminWebApiClient} from '../src/AdminWebApiClient';
const member='20000000-0000-4000-8000-000000000001',event='20000000-0000-4000-8000-000000000002',receipt='20000000-0000-4000-8000-000000000003';
const request={expectedMembershipId:member,workEvent:{id:event,subject:{type:'break' as const}},receipt:{id:receipt,attemptNumber:1 as const}};
const active={calendar:{asOf:"2026-11-02T09:00:00.000Z",workDurationSeconds:3600,breakDurationSeconds:0,breakIntervals:[]},details:{origin:"manual",baseRowVersion:1,effectiveRevisionNumber:0,changed:false,change:null,comment:null,overlapsAnotherRecord:false},timeRecordId:event,source:'canonical',targetType:'customer',targetDisplayName:'Werkstatt',status:'started',startedAt:'2026-11-02T08:00:00.000Z',stoppedAt:null,startedVia:'manual',stoppedVia:null};
describe('T049 real Web transport contracts',()=>{
 it('uses the exact break route and accepts only acknowledgements for this event',async()=>{
  const value={status:'synchronized',idempotentRetry:false,workEventId:event,receiptId:receipt,serverTimeEntryId:member,
    decision:{status:'break_started',timeEntryId:member,breakIntervalId:receipt}};
  const fetcher=vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json(value)).mockResolvedValueOnce(Response.json({...value,workEventId:member}));
  const client=new AdminWebApiClient(fetcher);
  expect(await client.manualLifecycle('token',request)).toEqual({status:'succeeded',value:{status:'synchronized',decision:'break_started'}});
  expect(fetcher.mock.calls[0]![0]).toBe('/v1/lifecycle-events/manual-break');
  expect(fetcher.mock.calls[0]![1]).toMatchObject({credentials:'omit',redirect:'manual',cache:'no-store'});
  expect(JSON.parse(String(fetcher.mock.calls[0]![1]?.body))).toEqual(request);
  expect(await client.manualLifecycle('token',request)).toEqual({status:'invalid_response'});
 });
 it.each([true,false])('keeps 202 evidenceStored=%s distinct from a confirmed time entry',async evidenceStored=>{
  const body=evidenceStored?{status:'deferred',evidenceStored,idempotentRetry:false,workEventId:event,receiptId:receipt}
    :{status:'deferred',evidenceStored,reason:'configuration_unavailable_or_inactive'};
  const client=new AdminWebApiClient(async()=>Response.json(body,{status:202}));
  expect(await client.manualLifecycle('token',request)).toEqual({status:'succeeded',value:{status:'deferred',evidenceStored}});
 });
 it('accepts the live active record outside a historical person month without adding it to that month',async()=>{
  const value={activeRecord:active,records:[],nextCursor:null,windowStartedAt:'2026-09-30T22:00:00.000Z',windowEndedAt:'2026-10-31T23:00:00.000Z'};
  const fetcher=vi.fn<typeof fetch>(async()=>Response.json(value));
  const client=new AdminWebApiClient(fetcher);
  expect(await client.managedPersonTime('token',{expectedMembershipId:member,targetMembershipId:receipt,
    fromInclusive:value.windowStartedAt,toExclusive:value.windowEndedAt,cursor:null,limit:20})).toMatchObject({status:'succeeded'});
 });
 it('never broadens own-time requests to a person or client-defined window',async()=>{
  const fetcher=vi.fn<typeof fetch>(async()=>Response.json({activeRecord:null,records:[],nextCursor:null,
    windowStartedAt:'2026-10-01T00:00:00.000Z',windowEndedAt:'2026-10-20T00:00:00.000Z'}));
  const client=new AdminWebApiClient(fetcher);
  const body={expectedMembershipId:member,cursor:null,limit:20};
  expect(await client.ownTime('token',body)).toMatchObject({status:'succeeded'});
  expect(fetcher.mock.calls[0]![0]).toBe('/v1/mobile/own-time/query');
  expect(JSON.parse(String(fetcher.mock.calls[0]![1]?.body))).toEqual(body);
  expect(await client.ownTime('token',{...body,targetMembershipId:receipt} as typeof body)).toEqual({status:'invalid_response'});
  expect(fetcher).toHaveBeenCalledOnce();
 });
});
