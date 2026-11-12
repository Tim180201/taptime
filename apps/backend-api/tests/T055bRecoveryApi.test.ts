import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { randomUUID } from 'node:crypto';
import { afterEach, expect, it, vi } from 'vitest';
import { createBackendHttpServer } from '../src/BackendHttpServer.js';
import type { BackendApiDependencies } from '../src/types.js';
import { closeServer, listen } from './fixtures.js';

const servers: Server[] = [];
afterEach(async () => { for (const server of servers.splice(0)) await closeServer(server); });
it('exposes recovery only through a new authenticated and validated endpoint', async () => {
  const recover = vi.fn();
  const server = createBackendHttpServer({ offlineLifecycleIngestor: { recover } } as unknown as BackendApiDependencies);
  servers.push(server); await listen(server);
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1/restore-recovery/evidence`;
  expect((await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })).status).toBe(401);
  expect((await fetch(url, { method: 'POST', headers: { authorization: 'Bearer header.payload.signature',
    'content-type': 'application/json' }, body: '{}' })).status).toBe(400);
  expect(recover).not.toHaveBeenCalled();
  const id = randomUUID();
  const body = {contractVersion:1,operationId:id,localState:'pending',evidence:{organizationId:id,
    expectedMembershipId:id,leaseId:id,leaseItemId:id,installationBinding:'A'.repeat(43),deviceSequence:1,provenanceVersion:2,
    clock:{bootMarker:'boot',monotonicAnchorMilliseconds:1,monotonicDeltaMilliseconds:0,wallClockAnchor:'2026-11-11T10:00:00.000Z',
      clockProofStatus:'verified_same_boot',clockProofVersion:1},
    workEvent:{id,trigger:{type:'manual'},target:{targetType:'customer',targetId:id},occurredAt:'2026-11-11T10:00:00.000Z'},
    receipt:{id,attemptNumber:1}}};
  const post = () => fetch(url,{method:'POST',headers:{authorization:'Bearer header.payload.signature','content-type':'application/json'},body:JSON.stringify(body)});
  for (const [status,result] of [
    [200,{status:'recovery_pending',operationId:id,evidenceId:id,evidenceDigest:'a'.repeat(64),workEventId:id,
      receiptId:id,deviceSequence:1,reason:'origin_lost',archiveStatus:'archive_pending',idempotentRetry:false}],
    [401,{status:'authority_rejected'}],[409,{status:'conflict',reason:'event_content_conflict'}],
    [422,{status:'recovery_rejected',reason:'operation_unavailable'}],
  ] as const) {
    recover.mockResolvedValueOnce(result); const response = await post();
    expect(response.status).toBe(status); expect(await response.json()).toEqual(result);
    expect(recover).toHaveBeenLastCalledWith({accessToken:'header.payload.signature',command:body});
  }
  recover.mockRejectedValueOnce(Object.assign(new Error('paused'),{code:'P0068'}));
  const paused = await post(); expect(paused.status).toBe(403); expect(await paused.json()).toEqual({error:{code:'organization_paused'}});
  recover.mockRejectedValueOnce(new Error('private evidence')); const failed = await post();
  expect(failed.status).toBe(503); expect(await failed.text()).not.toContain('private');

});
