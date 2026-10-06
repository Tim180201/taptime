import { expect, it } from 'vitest';
import { isManagedActiveSummaryRequest, isManagedActiveSummaryRequestV5 } from '../src/managedPeople.js';
const base={expectedMembershipId:'12000000-0000-4000-8000-000000000001',locationId:null,isRunning:null,cursor:null,limit:20};
it('v5 requires exactly one full Berlin month, including DST, while the old request stays exact',()=>{
  for(const [fromInclusive,toExclusive] of [['2026-09-30T22:00:00.000Z','2026-10-31T23:00:00.000Z'],['2026-02-28T23:00:00.000Z','2026-03-31T22:00:00.000Z']]) {
    const value={...base,fromInclusive,toExclusive};
    expect(isManagedActiveSummaryRequestV5(value)).toBe(true);
    expect(isManagedActiveSummaryRequest(value)).toBe(false);
    expect(isManagedActiveSummaryRequestV5({...value,extra:true})).toBe(false);
  }
  expect(isManagedActiveSummaryRequest(base)).toBe(true);
  expect(isManagedActiveSummaryRequestV5(base)).toBe(false);
  for(const [fromInclusive,toExclusive] of [['9999-12-01T00:00:00.000Z','9999-12-31T23:59:59.999Z'],['0000-01-01T00:00:00.000Z','0000-02-01T00:00:00.000Z'],['2026-10-01T00:00:00.000Z','2026-11-01T00:00:00.000Z'],['2026-09-30T22:00:00.000Z','2026-10-06T10:00:00.000Z'],['2026-09-30T22:00:00.000Z','2026-11-30T23:00:00.000Z'],['2026-02-30T23:00:00.000Z','2026-03-31T22:00:00.000Z']])
    expect(isManagedActiveSummaryRequestV5({...base,fromInclusive,toExclusive})).toBe(false);
});
