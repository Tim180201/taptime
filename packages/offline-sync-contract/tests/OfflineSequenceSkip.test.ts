import { describe,expect,it } from 'vitest';
import { isOfflineSequenceSkipCommand } from '../src/sequenceSkip.js';
const id='10000000-0000-4000-8000-000000000001';
const command={organizationId:id,expectedMembershipId:id,installationBinding:'B'.repeat(43),leaseId:id,
  leaseItemId:id,deviceSequence:1,workEventId:id,receiptId:id,occurredAt:'2026-10-05T08:00:00.000Z',
  reason:'http_400',evidenceSha256:'a'.repeat(64)};
describe('D-121 gap report boundary',()=>{
  it('accepts a complete report without any lifecycle payload',()=>expect(isOfflineSequenceSkipCommand(command)).toBe(true));
  it.each([{...command,deviceSequence:0},{...command,deviceSequence:Number.MAX_SAFE_INTEGER+1},
    {...command,evidenceSha256:'a'.repeat(63)},{...command,reason:'temporarily_unavailable'},
    {...command,occurredAt:'tomorrow'},{...command,targetId:id},{...command,receiptId:'invalid'}])(
    'rejects malformed, transient or extended input',invalid=>expect(isOfflineSequenceSkipCommand(invalid)).toBe(false));
});
