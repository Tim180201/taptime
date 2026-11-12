import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { encodeRestoreEvidenceV1, isRestoreEvidenceCommandV1, type RestoreEvidenceCommandV1 } from '../src/index.js';
const id = '10000000-0000-4000-8000-000000000001';
const base = { organizationId:id,expectedMembershipId:id,leaseId:id,leaseItemId:id,installationBinding:'A'.repeat(43),
  deviceSequence:1,clock:{bootMarker:'boot',monotonicAnchorMilliseconds:1,monotonicDeltaMilliseconds:0,
    wallClockAnchor:'2026-11-11T10:00:00.000Z',clockProofStatus:'verified_same_boot',clockProofVersion:1},
  receipt:{id,attemptNumber:1} };
const event = {id,occurredAt:'2026-11-11T10:00:00.000Z',target:{targetType:'customer',targetId:id}};
it('retains all installed provenance versions inside an exact recovery envelope', () => {
  for (const evidence of [
    {...base,provenanceVersion:1,workEvent:{...event,assignmentId:id,nfcTagId:id}},
    {...base,provenanceVersion:2,workEvent:{...event,trigger:{type:'manual'}}},
    {...base,provenanceVersion:3,workEvent:{id,occurredAt:event.occurredAt,subject:{type:'break'},trigger:{type:'manual'}}},
  ]) for (const localState of ['pending','confirmed']) {
    const envelope = {contractVersion:1,operationId:id,localState,evidence};
    expect(isRestoreEvidenceCommandV1(envelope)).toBe(true);
    for (const invalid of [ {...envelope,contractVersion:2},{...envelope,localState:'unknown'},
      {...envelope,operationId:''},{...envelope,extra:1},{...envelope,evidence:{...evidence,extra:1}},
      {...envelope,evidence:{...evidence,clock:{...base.clock,bootMarker:''}}},
      {...envelope,evidence:{...evidence,workEvent:{...evidence.workEvent,occurredAt:'2026-02-30T10:00:00.000Z'}}},
    ]) expect(isRestoreEvidenceCommandV1(invalid)).toBe(false);
    const digest = (value: unknown) => createHash('sha256').update(encodeRestoreEvidenceV1(value as RestoreEvidenceCommandV1)).digest('hex');
    expect(digest(envelope)).toBe(digest(Object.fromEntries(Object.entries(envelope).reverse())));
    expect(digest(envelope)).not.toBe(digest({...envelope,localState:localState==='pending'?'confirmed':'pending'}));
    expect(digest(envelope)).not.toBe(digest({...envelope,evidence:{...evidence,receipt:{...base.receipt,id:'20000000-0000-4000-8000-000000000002'}}}));
  }
});
