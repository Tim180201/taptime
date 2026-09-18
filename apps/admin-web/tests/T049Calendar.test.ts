import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as calendar from '@taptime/core';
import * as mobileCalendar from '../../mobile/src/screens/ownTimeCalendar';
describe('T049 e: a single Berlin calendar for mobile and Web',()=>{
 it('both clients import the same Core calendar instead of duplicating it',()=>{
   expect(readFileSync('../mobile/src/screens/TimeCalendar.tsx','utf8')).toMatch(/from '@taptime\/core'/);
   expect(readFileSync('../mobile/src/screens/ownTimeCalendar.ts','utf8')).not.toContain('function ');
   expect(readFileSync('src/TimeCalendar.tsx','utf8')).toMatch(/rangeSummary[\s\S]*from '@taptime\/core'/);
   expect(typeof calendar.rangeSummary).toBe('function');
   for(const name of Object.keys(mobileCalendar) as (keyof typeof mobileCalendar)[]) expect(mobileCalendar[name]).toBe(calendar[name]);
   expect(readFileSync('../mobile/src/screens/ownTimeCalendar.ts','utf8')).toContain("from '@taptime/core'");
 });
 it.each([
  ['2026-03-29','2026-03-30',23],['2026-10-25','2026-10-26',25],
  ['2026-12-31','2027-01-01',24],
 ])('measures %s in Berlin through the shared helper',(day,next,hours)=>{
   expect((calendar.dayStart(next)-calendar.dayStart(day))/3600000).toBe(hours);
   expect(calendar.businessDay(calendar.dayStart(day))).toBe(day);
 });
});
