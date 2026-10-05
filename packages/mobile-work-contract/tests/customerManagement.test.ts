import {expect,it} from 'vitest';
import {isManageCustomerRequest,isInspectTagRequest} from '../src/index.js';
const id='10000000-0000-4000-8000-000000000001';
const request={expectedMembershipId:id,commandId:id,customerId:id,action:'rename',displayName:'  Cafe\u0301  '};
it('uses the creation name contract and accepts existing names without a uniqueness field',()=>{
 expect(isManageCustomerRequest(request)).toBe(true);
 expect(isManageCustomerRequest({...request,displayName:'😀'.repeat(120)})).toBe(true);
 for(const displayName of ['', 'x'.repeat(121),'Ungültig\nName','\u0000'])expect(isManageCustomerRequest({...request,displayName})).toBe(false);
 expect(isManageCustomerRequest({...request,force:true})).toBe(false);
 expect(isManageCustomerRequest({...request,action:'reactivate'})).toBe(false);
 expect(isManageCustomerRequest({expectedMembershipId:id,commandId:id,customerId:id,action:'deactivate'})).toBe(true);
});
it('inspection accepts only a membership and canonical UID, never a mutation',()=>{
 const request={expectedMembershipId:id,canonicalPayload:'nfc:uid:v1:AA'};
 expect(isInspectTagRequest(request)).toBe(true);
 expect(isInspectTagRequest({...request,commandId:id})).toBe(false);
 expect(isInspectTagRequest({...request,canonicalPayload:'raw_uid'})).toBe(false);
});
