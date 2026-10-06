import { expect, it } from 'vitest';
import { isManagedActiveSummary, isManagedActiveSummaryV2, isManagedActiveSummaryV3 } from '../src/managedPeople.js';
const person={membershipId:'12000000-0000-4000-8000-000000000001',displayName:'Änne',role:'employee',location:null,isRunning:false,runningSince:null,runningTargetDisplayName:null};
const summary={serverTime:'2026-10-05T08:00:00.000Z',runningCount:0,totalCount:1,people:[person],nextCursor:null};
it('keeps v1/v2 strict and negotiates monthly seconds only in v3',()=>{
  const v2={...summary,people:[{...person,departedAt:null}]};
  const v3={...summary,people:[{...v2.people[0],monthWorkDurationSeconds:7200}]};
  expect(isManagedActiveSummary(summary)).toBe(true);expect(isManagedActiveSummaryV2(summary)).toBe(false);
  expect(isManagedActiveSummary(v2)).toBe(false);expect(isManagedActiveSummaryV2(v2)).toBe(true);
  expect(isManagedActiveSummaryV3(v2)).toBe(false);expect(isManagedActiveSummaryV3(v3)).toBe(true);
  expect(isManagedActiveSummary(v3)).toBe(false);expect(isManagedActiveSummaryV2(v3)).toBe(false);
  for(const seconds of [-1,0.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1,'2',null,undefined])
    expect(isManagedActiveSummaryV3({...v3,people:[{...v3.people[0],monthWorkDurationSeconds:seconds}]})).toBe(false);
  expect(isManagedActiveSummaryV3({...v3,people:[{...v3.people[0],monthWorkDurationSeconds:0}]})).toBe(true);
  expect(isManagedActiveSummaryV3({...v3,people:[{...v3.people[0],extra:true}]})).toBe(false);
  expect(isManagedActiveSummaryV3({...v3,extra:true})).toBe(false);
  for(const cursor of ['ü','x'.repeat(257),'line\nbreak'])expect(isManagedActiveSummaryV3({...v3,nextCursor:cursor})).toBe(false);
  expect(isManagedActiveSummaryV3({...v3,people:[v3.people[0],v3.people[0]]})).toBe(false);
});
