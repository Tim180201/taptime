import { expect, it } from 'vitest';
import { validateWorkTargetResponse } from '@taptime/mobile-work-contract';
import { parseSearchResponse } from '../../src/search/search';

const target = {targetType:'customer', targetId:'10000000-0000-4000-8000-000000000001', displayName:'Müller'};
it.each(['work_targets', 'backfill_targets'] as const)('%s requires its assignment boolean while v1 stays closed', kind => {
  const marker = kind === 'work_targets' ? 'assignedToMe' : 'assignedToPerson';
  const page = {targets:[{...target, [marker]:true}], nextCursor:'q1:next'};
  expect(parseSearchResponse(kind, page)).toEqual(page);
  expect(parseSearchResponse(kind, {...page, targets:[{...target, [marker]:false}]})).not.toBeNull();
  for (const row of [target, {...target, [marker]:'true'}, {...target, [marker]:null},
    {...target, assignedToMe:true, assignedToPerson:true}, {...target, [marker]:true, extra:1}]) {
    expect(parseSearchResponse(kind, {...page, targets:[row]})).toBeNull();
  }
  expect(validateWorkTargetResponse({targets:[target],nextCursor:null})).toBe(true);
  expect(validateWorkTargetResponse({...page,nextCursor:null})).toBe(false);
});
