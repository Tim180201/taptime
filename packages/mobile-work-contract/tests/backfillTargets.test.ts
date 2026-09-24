import { expect,it } from 'vitest';
import { isBackfillTargetQueryRequest,isBackfillTargetQueryResponse } from '../src/index.js';
const member='10000000-0000-4000-8000-000000000001',person='10000000-0000-4000-8000-000000000002';
it('binds the closed request to two memberships without accepting a caller-provided role',()=>{
 const request={expectedMembershipId:member,targetMembershipId:person,cursor:null,limit:50};
 expect(isBackfillTargetQueryRequest(request)).toBe(true);
 for(const invalid of [{...request,role:'administrator'},{...request,targetMembershipId:null},{...request,limit:51},{...request,cursor:''}]) expect(isBackfillTargetQueryRequest(invalid)).toBe(false);
});
it('accepts only the closed ready target page',()=>{
 const page={status:'ready',targets:[{targetType:'project',targetId:person,displayName:'Projekt P'}],nextCursor:null};
 expect(isBackfillTargetQueryResponse(page)).toBe(true);
 expect(isBackfillTargetQueryResponse({...page,targets:[{...page.targets[0],secret:'hidden'}]})).toBe(false);
 expect(isBackfillTargetQueryResponse({...page,organizationId:member})).toBe(false);
});
