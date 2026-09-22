import { expect, it } from 'vitest';
import { isTimeRecordDetails, isDetailedTimeResponse, validateOwnTimeResponse } from '../src/index.js';
it.each([' '+ 'x'.repeat(500)+' ', '\t'])('preserves an existing valid correction reason: %s',reason=>{
  expect(isTimeRecordDetails({origin:'nfc',baseRowVersion:2,effectiveRevisionNumber:1,comment:null,changed:true,
    change:{at:'2026-09-21T10:00:00.000Z',reason,actor:'administration'},overlapsAnotherRecord:false})).toBe(true);
});
it('T-069: v2 carries the true source and stop mark while the legacy parser stays closed',()=>{
  const record={timeRecordId:'60000000-0000-4000-8000-000000000302',source:'canonical',targetType:'customer',targetDisplayName:'Ziel',
    status:'stopped',startedAt:'2026-07-21T08:00:00.000Z',stoppedAt:'2026-07-21T12:00:00.000Z',startedVia:'nfc',stoppedVia:'administration'};
  const response={activeRecord:null,records:[record],nextCursor:null,windowStartedAt:'2026-07-21T00:00:00.000Z',windowEndedAt:'2026-07-22T00:00:00.000Z'};
  expect(validateOwnTimeResponse(response)).toBe(false);
  expect(validateOwnTimeResponse({...response,records:[{...record,stoppedVia:'manual'}]})).toBe(true);
  const details={origin:'nfc',baseRowVersion:2,effectiveRevisionNumber:0,comment:null,changed:true,change:null,overlapsAnotherRecord:false,
    administrationStop:{at:'2026-07-21T13:00:00.000Z',reason:'Stopp vergessen'}};
  expect(isDetailedTimeResponse({...response,records:[{...record,details}]})).toBe(true);
  expect(isTimeRecordDetails({...details,administrationStop:{...details.administrationStop,reason:''}})).toBe(false);
});
