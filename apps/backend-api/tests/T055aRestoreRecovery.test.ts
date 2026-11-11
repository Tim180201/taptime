import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, expect, it, vi } from 'vitest';
import { parseRestoreRecoveryStateV1 } from '@taptime/offline-sync-contract';
import { createBackendHttpServer } from '../src/BackendHttpServer.js';
import type { BackendApiDependencies } from '../src/types.js';
import { closeServer, listen } from './fixtures.js';
const servers: Server[] = [];
afterEach(async () => { for (const server of servers.splice(0)) await closeServer(server); });
it('requires a resolved session, returns the new contract, and leaves v1/v2 sessions unchanged', async () => {
  const session = { userId: '10000000-0000-4000-8000-000000000001', organizationId: '10000000-0000-4000-8000-000000000002',
    membershipId: '10000000-0000-4000-8000-000000000003', role: 'employee' };
  const authority = { resolve: vi.fn(async () => ({ status: 'resolved', session })) };
  const restoreRecoveryReader = vi.fn(async () => ({ contractVersion: 1, operation: null }));
  const server = createBackendHttpServer({ sessionAuthority: authority, administrationSessionAuthority: authority,
    restoreRecoveryReader } as unknown as BackendApiDependencies);
  servers.push(server); await listen(server);
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const headers = { authorization: 'Bearer header.payload.signature' };
  expect((await fetch(origin + '/v1/restore-recovery')).status).toBe(401);
  expect(restoreRecoveryReader).not.toHaveBeenCalled();
  authority.resolve.mockResolvedValueOnce({ status: 'rejected' } as any);
  expect((await fetch(origin + '/v1/restore-recovery', { headers })).status).toBe(401);
  expect(restoreRecoveryReader).not.toHaveBeenCalled();
  const absent = await fetch(origin + '/v1/restore-recovery', { headers });
  expect(absent.status).toBe(200);
  expect(parseRestoreRecoveryStateV1(await absent.json())).toEqual({ contractVersion: 1, operation: null });
  expect(restoreRecoveryReader).toHaveBeenCalledWith(session);
  const state = { contractVersion: 1, operation: { id: session.userId, target: { kind: 'latest' }, activatedAt: '2026-11-11T12:00:00.000Z' } };
  restoreRecoveryReader.mockResolvedValueOnce(state as any);
  expect(parseRestoreRecoveryStateV1(await (await fetch(origin + '/v1/restore-recovery', { headers })).json())).toEqual(state);
  for (const path of ['/v1/session', '/v2/session']) {
    expect(await (await fetch(origin + path, { headers })).json()).toEqual(session);
  }
  expect((await fetch(origin + '/v1/restore-recovery', { method: 'POST', headers })).status).toBe(405);
  restoreRecoveryReader.mockRejectedValueOnce(new Error('private database detail'));
  const failed = await fetch(origin + '/v1/restore-recovery', { headers });
  expect(failed.status).toBe(503);
  expect(await failed.text()).not.toContain('private');
});
