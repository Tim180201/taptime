import { TIME_REVIEW_REASONS } from '@taptime/time-review-contract';
import { expect, it, vi } from 'vitest';
import { AdminWebApiClient } from '../src/AdminWebApiClient';
import { reviewReasonLabel } from '../src/viewHelpers';
const id='10000000-0000-4000-8000-000000000001';
const item={reviewItemId:id,source:'server_legacy',employeeUserId:id,employeeMembershipId:id,
  employeeDisplayName:'Person',targetType:'customer',targetId:id,targetDisplayName:'Kunde',triggerType:'manual',
  occurredAt:'2026-10-01T08:00:00.000Z',recordedAt:'2026-10-01T08:00:00.000Z',
  reviewReason:'active_break_time_entry_mismatch',deviceSequence:null,predecessorBlocked:false};
it('T097: keeps known and unknown reasons on the same response page',async()=>{
  const fetcher=vi.fn<typeof fetch>(async()=>Response.json({status:'ready',items:[item,{...item,reviewItemId:'20000000-0000-4000-8000-000000000001',reviewReason:'future_reason'}],nextCursor:null}));
  const result=await new AdminWebApiClient(fetcher).reviewItems('token',id,null);
  expect(result).toMatchObject({status:'succeeded',value:{items:[{reviewReason:'active_break_time_entry_mismatch',employeeMembershipId:id},{reviewReason:'future_reason'}]}});
  expect(reviewReasonLabel('active_break_time_entry_mismatch')).not.toBe('Wird von der Verwaltung geprüft');
  expect(reviewReasonLabel('future_reason')).toBe('Sonstiger Prüfgrund');
});
it('T097: accepts a break without a fabricated target identifier',async()=>{
  const client=new AdminWebApiClient(async()=>Response.json({status:'ready',items:[{...item,targetType:'break',targetId:null,targetDisplayName:'Pause'}],nextCursor:null}));
  expect(await client.reviewItems('token',id,null)).toMatchObject({status:'succeeded',value:{items:[{targetDisplayName:'Pause'}]}});
});
it.each([{employeeMembershipId:null},{targetType:'customer',targetId:null},{reviewReason:42},{predecessorBlocked:'false'}])('T097: rejects malformed attribution, not merely unfamiliar reason codes (%j)',async patch=>{
  const client=new AdminWebApiClient(async()=>Response.json({status:'ready',items:[{...item,...patch}],nextCursor:null}));
  expect(await client.reviewItems('token',id,null)).toMatchObject({status:'invalid_response'});
});

it('T097: every current reason has a specific display',()=>{
  for(const reason of TIME_REVIEW_REASONS) expect(reviewReasonLabel(reason),reason).not.toBe('Sonstiger Prüfgrund');
});
