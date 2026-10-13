import {expect,it} from 'vitest';
import {isAdministrationStopRequest,isBackfillTimeRequest,isVoidTimeRequest,isVoidedTimeResponse} from '../src/index.js';
const id='10000000-0000-4000-8000-000000000001',at='2026-06-01T08:00:00.000Z',end='2026-06-01T09:00:00.000Z';
it.each([null,'',' \t\u200b','x'.repeat(500)])('D134 transports optional reason %j unchanged to authoritative SQL',reason=>{
 expect(isAdministrationStopRequest({expectedMembershipId:id,targetMembershipId:id,timeRecordId:id,expectedRowVersion:1,commandId:id,stoppedAt:end,reason})).toBe(true);
 expect(isBackfillTimeRequest({expectedMembershipId:id,targetMembershipId:id,commandId:id,targetType:'customer',targetId:id,startedAt:at,stoppedAt:end,reason,comment:null})).toBe(true);
});
it('D134 accepts null void reason, rejects a supplied none and reads server none history',()=>{
 const request={expectedMembershipId:id,commandId:id,timeRecordId:id,reasonCode:null,reasonText:null};
 expect(isVoidTimeRequest(request)).toBe(true);expect(isVoidTimeRequest({...request,reasonCode:'none'})).toBe(false);
 expect(isVoidTimeRequest({...request,reasonText:'unbound'})).toBe(false);
 expect(isVoidedTimeResponse({status:'ready',nextAfterId:null,records:[{timeRecordId:id,targetDisplayName:'Kunde',startedAt:at,stoppedAt:end,voidedAt:end,actorDisplayName:'Admin',reasonCode:'none',reasonText:null}]})).toBe(true);
});
