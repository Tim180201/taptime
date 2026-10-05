import { expect, it } from 'vitest';
import { isTimeReviewRole, parseReviewItemQueryResponseV4, TIME_REVIEW_REASONS, TIME_REVIEW_ROLES } from '../src/index.js';
it('derives the review role guard from the shared list and excludes non-review roles',()=>{
 for(const role of TIME_REVIEW_ROLES) expect(isTimeReviewRole(role)).toBe(true);
 for(const role of ['employee','future_role',null,['administrator'],{}]) expect(isTimeReviewRole(role)).toBe(false);
});
const id='10000000-0000-4000-8000-000000000001';
const item={reviewItemId:id,source:'offline_v2',employeeUserId:id,employeeMembershipId:id,employeeDisplayName:'Person',
 targetType:'break',targetId:null,targetDisplayName:'Pause',triggerType:'manual',occurredAt:'2026-10-01T08:00:00.000Z',
 recordedAt:'2026-10-01T08:00:00.000Z',reviewReason:'future_reason',deviceSequence:1,predecessorBlocked:true};
const page=(entry:unknown)=>({status:'ready',items:[entry],nextCursor:null});
it('keeps unknown reasons, validates all known reasons and freezes the parsed response',()=>{
 for(const reviewReason of [...TIME_REVIEW_REASONS,'future_reason']) {
  const result=parseReviewItemQueryResponseV4(page({...item,reviewReason}));
  expect(result?.items[0]?.reviewReason).toBe(reviewReason);
  expect(Object.isFrozen(result?.items)).toBe(true);
 }
});
it.each([{source:['offline_v2']},{targetType:['break'],targetId:id},{targetId:id},{targetType:'customer'},
 {employeeMembershipId:''},{deviceSequence:0},{recordedAt:'2026-02-30T08:00:00.000Z'},
 {reviewReason:undefined},{reviewReason:''},{extra:'field'}])('rejects malformed review evidence: %j',patch=>{
 expect(parseReviewItemQueryResponseV4(page({...item,...patch}))).toBeNull();
});
it('rejects duplicate items and malformed continuation tokens',()=>{
 expect(parseReviewItemQueryResponseV4({status:'ready',items:[item,item],nextCursor:null})).toBeNull();
 expect(parseReviewItemQueryResponseV4({...page(item),nextCursor:'has space'})).toBeNull();
 expect(parseReviewItemQueryResponseV4({...page(item),extra:true})).toBeNull();
});
