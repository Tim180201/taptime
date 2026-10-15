import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, expect, it, vi } from 'vitest';
import { createBackendHttpServer } from '../src/BackendHttpServer.js';
import { createBackendApiDiagnosticLogSink } from '../src/diagnosticLog.js';
import type { BackendApiDependencies } from '../src/types.js';
import { closeServer, listen } from './fixtures.js';
const servers: Server[] = [];
afterEach(async () => { for (const server of servers.splice(0)) await closeServer(server); });
const session = { userId: '00000000-0000-4000-8000-000000000001', organizationId: '00000000-0000-4000-8000-000000000002',
  membershipId: '00000000-0000-4000-8000-000000000003', role: 'employee' };
it.each(['/v1/session', '/v2/session'])('T105 %s records only successful sessions and survives a recording failure', async path => {
  const log: string[] = [];
  const recordMembershipSignIn = vi.fn(async () => {});
  const authority = { resolve: vi.fn(async () => ({ status: 'resolved', session })) };
  const server = createBackendHttpServer({ sessionAuthority: authority, administrationSessionAuthority: authority,
    recordMembershipSignIn } as unknown as BackendApiDependencies, { onDiagnostic: createBackendApiDiagnosticLogSink({
      output: { write: value => { log.push(String(value)); return true; } } }) });
  servers.push(server); await listen(server);
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const get = () => fetch(origin + path, { headers: { authorization: 'Bearer header.payload.signature' } });
  expect((await get()).status).toBe(200);
  expect(recordMembershipSignIn).toHaveBeenCalledWith(session);
  recordMembershipSignIn.mockRejectedValueOnce(new Error('private 2026-10-15T10:00:00.000Z'));
  const failedWrite = await get();
  expect(failedWrite.status).toBe(200); expect(await failedWrite.json()).toEqual(session);
  expect(log).toHaveLength(1);
  expect(JSON.parse(log[0]!)).toMatchObject({ error_class: 'membership_sign_in_failed', route: path === '/v1/session' ? 'session' : 'session_v2' });
  expect(log.join('')).not.toMatch(/private|2026-10-15T10:00|membership_id|organization_id|user_id/);
  authority.resolve.mockResolvedValueOnce({ status: 'rejected' } as any);
  expect((await get()).status).toBe(401);
  expect(recordMembershipSignIn).toHaveBeenCalledTimes(2);
});
