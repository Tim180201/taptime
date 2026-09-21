import { expect, it } from 'vitest';
import { isTimeRecordDetails } from '../src/index.js';
it.each([' '+ 'x'.repeat(500)+' ', '\t'])('preserves an existing valid correction reason: %s',reason=>{
  expect(isTimeRecordDetails({origin:'nfc',baseRowVersion:2,effectiveRevisionNumber:1,comment:null,changed:true,
    change:{at:'2026-09-21T10:00:00.000Z',reason,actor:'administration'},overlapsAnotherRecord:false})).toBe(true);
});
