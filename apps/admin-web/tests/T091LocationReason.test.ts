import { expect, it } from 'vitest';
import { reviewReasonLabel } from '../src/viewHelpers';
import { manualResultMessage, parseManualResult } from '../src/manualCapture';

it('preserves and displays a durable location rejection in manual capture and review',()=>{
  const request={expectedMembershipId:'12000000-0000-4000-8000-000000000001',
    workEvent:{id:'50000000-0000-4000-8000-000000000001',subject:{type:'break' as const}},
    receipt:{id:'65000000-0000-4000-8000-000000000001',attemptNumber:1 as const}};
  const parsed=parseManualResult({status:'synchronized',idempotentRetry:false,
    workEventId:request.workEvent.id,receiptId:request.receipt.id,serverTimeEntryId:null,
    decision:{status:'escalation_required',reason:'work_location_unavailable'}},request);
  expect(parsed).toEqual({status:'synchronized',decision:'escalation_required',reason:'work_location_unavailable'});
  expect(manualResultMessage(parsed!)).toContain('keinem für Sie berechtigten Standort');
  expect(reviewReasonLabel('work_location_unavailable')).toBe('Die Person durfte an dem zugeordneten Standort keine Zeit erfassen.');
});
