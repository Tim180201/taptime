import { randomBytes, randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BACKEND_HTTP_ROUTES, createBackendHttpServer, requestRateLimitScope } from '../src/BackendHttpServer.js';
import { createBackendApiDiagnosticLogSink } from '../src/diagnosticLog.js';
import type { BackendApiDependencies } from '../src/types.js';
import type { LockScreenActionResult, LockScreenCapabilityResult } from '@taptime/mobile-work-contract';
import { closeServer, listen } from './fixtures.js';

const key = randomBytes(32).toString('base64url'), id = randomUUID();
const state = { timeEntryId: id, status: 'running' as const, startedAt: '2026-10-21T06:00:00.000Z', breakStartedAt: null,
  stoppedAt: null, asOf: '2026-10-21T06:01:00.000Z', workDurationSeconds: 60, breakDurationSeconds: 0,
  target: { targetType: 'customer' as const, targetId: id, displayName: 'Testkunde' } };
const servers: Server[] = [];
afterEach(async () => { for (const server of servers.splice(0)) await closeServer(server); });
async function start(result: LockScreenActionResult = { status: 'applied', state, idempotentRetry: false }, failure = false) {
  const logs: string[] = [];
  const issue = vi.fn(async (): Promise<LockScreenCapabilityResult> => ({ status: 'issued', capability: key, expiresAt: '2026-10-22T06:00:00.000Z', state }));
  const perform = vi.fn(async () => { if (failure) throw new Error(`SQL diagnostic containing ${key}`); return result; });
  const checkTenantAccess = vi.fn(async () => {});
  const server = createBackendHttpServer({ lockScreen: { issue, perform }, checkTenantAccess } as unknown as BackendApiDependencies,
    { onDiagnostic: createBackendApiDiagnosticLogSink({ output: { write: value => { logs.push(String(value)); return true; } } }) });
  servers.push(server); await listen(server);
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const post = (path: string, body: unknown, authorization = `Bearer ${key}`, extraHeaders = {}) => fetch(origin + path,
    { method: 'POST', headers: { 'content-type': 'application/json', authorization, ...extraHeaders }, body: JSON.stringify(body) });
  return { issue, perform, checkTenantAccess, logs, post, origin };
}
const command = { action: 'pause', commandId: id };
describe('T104a HTTP', () => {
  it('issues with the existing JWT authentication; actions use only the capability, without a session lookup', async () => {
    const test = await start();
    const request = { expectedMembershipId: id, timeEntryId: id, installationId: null };
    const issued = await test.post('/v1/lock-screen/capability', request, 'Bearer header.payload.signature');
    expect(issued.status).toBe(200); expect(issued.headers.get('cache-control')).toContain('no-store');
    expect(test.issue).toHaveBeenCalledWith('header.payload.signature', request);
    test.checkTenantAccess.mockClear();
    const response = await test.post('/v1/lock-screen/action', command);
    expect(response.status).toBe(200); expect(await response.json()).toEqual({ status: 'applied', state, idempotentRetry: false });
    expect(test.perform).toHaveBeenCalledWith(key, command); expect(test.checkTenantAccess).not.toHaveBeenCalled();
  });
  it.each(['/v1/lock-screen/capability', '/v1/lock-screen/action'])('protects %s and rejects URL credentials and GET', async path => {
    expect(Object.hasOwn(BACKEND_HTTP_ROUTES, path)).toBe(true); expect(requestRateLimitScope(path)).not.toBeNull();
    const test = await start();
    expect((await test.post(`${path}?key=${key}`, command)).status).toBe(404);
    expect((await fetch(test.origin + path)).status).toBe(405);
    expect(test.perform).not.toHaveBeenCalled(); expect(test.issue).not.toHaveBeenCalled();
    expect(test.logs.join('')).not.toContain(key);
  });
  it('rejects keys in the body, identity/target injection, missing authorization and JWTs used as capabilities', async () => {
    const test = await start();
    for (const extra of [{ capability: key }, { organizationId: id }, { userId: id }, { timeEntryId: id }, { expectedMembershipId: id }, { occurredAt: state.asOf }]) {
      expect((await test.post('/v1/lock-screen/action', { ...command, ...extra })).status).toBe(400);
    }
    for (const auth of ['', 'Bearer header.payload.signature', `Bearer ${key}x`]) expect((await test.post('/v1/lock-screen/action', command, auth)).status).toBe(401);
    expect((await test.post('/v1/lock-screen/action', command, `Bearer ${key}`, { 'x-taptime-expected-membership-id': id })).status).toBe(400);
    expect(test.perform).not.toHaveBeenCalled();
  });
  it('does not accept the lock screen key on authenticated routes', async () => {
    const test = await start();
    expect((await test.post('/v1/lock-screen/capability', { expectedMembershipId: id, timeEntryId: id, installationId: null })).status).toBe(401);
    expect((await test.post('/v1/lifecycle-events/manual', {})).status).toBe(401);
    expect(test.issue).not.toHaveBeenCalled();
  });
  it.each([
    [{ status: 'unauthorized' }, 401, 'unauthorized'],
    [{ status: 'command_id_conflict' }, 409, 'command_id_conflict'],
    [{ status: 'rate_limited', retryAfterSeconds: 42 }, 429, 'rate_limited'],
  ] as const)('maps bounded failure %j without disclosing key history', async (result, status, code) => {
    const test = await start(result); const response = await test.post('/v1/lock-screen/action', command);
    expect(response.status).toBe(status); expect(await response.json()).toEqual({ error: { code } });
    if (status === 429) expect(response.headers.get('retry-after')).toBe('42');
    expect(test.logs.join('')).not.toContain(key);
  });
  it('returns state_changed as a current-state response and strips unexpected service data', async () => {
    const test = await start({ status: 'state_changed', state, idempotentRetry: false });
    const response = await test.post('/v1/lock-screen/action', command);
    expect(await response.json()).toEqual({ status: 'state_changed', state, idempotentRetry: false });
    test.perform.mockResolvedValueOnce({ status: 'applied', state, idempotentRetry: false, capability: key } as LockScreenActionResult);
    const invalid = await test.post('/v1/lock-screen/action', command);
    expect(invalid.status).toBe(503); expect(await invalid.text()).not.toContain(key);
  });
  it('never logs the key or includes it in an error, even when a dependency throws it', async () => {
    const test = await start(undefined, true); const response = await test.post('/v1/lock-screen/action', command);
    expect(response.status).toBe(503); expect(await response.json()).toEqual({ error: { code: 'service_unavailable' } });
    expect(test.logs.length).toBeGreaterThan(0); expect(test.logs.join('')).toContain('lock_screen_failed');
    expect(test.logs.join('')).not.toContain(key); expect(test.logs.join('')).not.toContain('SQL diagnostic');
  });
});
