import { expect, it } from 'vitest';
import { isVoidTimeRequest, isVoidedTimeResponse } from '../src/index.js';
const id='10000000-0000-4000-8000-000000000001';
it.each(['\u0001','\u0085','\u200b','\u00a0\t'])('T106 rejects invisible new void reason %j but keeps historical responses readable', reasonText=>{
  expect(isVoidTimeRequest({expectedMembershipId:id,commandId:id,timeRecordId:id,reasonCode:'other',reasonText})).toBe(false);
  if(reasonText.trim().length)expect(isVoidedTimeResponse({status:'ready',nextAfterId:null,records:[{
    timeRecordId:id,targetDisplayName:'Kunde',startedAt:'2026-07-20T08:00:00.000Z',stoppedAt:'2026-07-20T09:00:00.000Z',
    voidedAt:'2026-07-21T09:00:00.000Z',actorDisplayName:'Verwaltung',reasonCode:'other',reasonText}]})).toBe(true);
});
