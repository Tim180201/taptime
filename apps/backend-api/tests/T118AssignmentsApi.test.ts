import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BACKEND_HTTP_ROUTES, createBackendHttpServer, requestRateLimitScope } from '../src/BackendHttpServer.js';
import { createBackendApiDiagnosticLogSink } from '../src/diagnosticLog.js';
import type { BackendApiDependencies } from '../src/types.js';
import { closeServer, listen } from './fixtures.js';

const id = '00000000-0000-4000-8000-000000000001';
const page = { expectedMembershipId: id, cursor: null, limit: 50 };
const entries = [
  ['/v1/administration/target-assignments/change', 'changeTargetAssignment', { expectedMembershipId: id, commandId: id, membershipId: id, targetType: 'customer', targetId: id, assigned: true }],
  ['/v1/administration/target-assignments/query', 'queryTargetAssignments', { ...page, membershipId: id, search: 'private-search-term' }],
  ['/v2/customers/quota-alerts/query', 'queryQuotaAlerts', { ...page, fromInclusive: '2026-09-30T22:00:00.000Z', toExclusive: '2026-10-31T23:00:00.000Z' }],
] as const;
const servers: Server[] = [];
afterEach(async () => { for (const server of servers.splice(0)) await closeServer(server); });
describe.each(entries)('T118 HTTP %s', (path, method, body) => {
  async function start(status = 'succeeded', fail = false) {
    const log: string[] = [];
    const action = vi.fn(async () => { if (fail) throw new Error('private-search-term'); return { status, response: { items: [], nextCursor: null } }; });
    const deps = { administration: { [method]: action }, mobileWorkReader: { [method]: action } } as unknown as BackendApiDependencies;
    const server = createBackendHttpServer(deps, { onDiagnostic: createBackendApiDiagnosticLogSink({ output: { write: v => { log.push(String(v)); return true; } } }) });
    servers.push(server); await listen(server);
    const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const headers = { authorization: 'Bearer header.payload.signature', 'content-type': 'application/json' };
    return { action, log, post: (patch = {}, extra = {}) => fetch(origin + path, { method: 'POST', headers: { ...headers, ...extra }, body: JSON.stringify({ ...body, ...patch }) }) };
  }
  it('registers, rate-limits and dispatches the authenticated request', async () => {
    const test = await start();
    expect(Object.hasOwn(BACKEND_HTTP_ROUTES, path)).toBe(true);
    expect(requestRateLimitScope(path)).not.toBeNull();
    expect((await test.post()).status).toBe(200);
    expect(test.action).toHaveBeenCalledWith(method === 'changeTargetAssignment'
      ? { ...body, accessToken: 'header.payload.signature' }
      : { accessToken: 'header.payload.signature', request: body });
  });
  it('rejects extra fields and caller-supplied identity headers', async () => {
    const test = await start();
    expect((await test.post({ injected: true })).status).toBe(400);
    expect((await test.post({}, { 'x-taptime-expected-membership-id': id })).status).toBe(400);
    expect(test.action).not.toHaveBeenCalled();
  });
  it('preserves forbidden and never logs search terms or SQL messages', async () => {
    const denied = await start('forbidden'); expect((await denied.post()).status).toBe(403);
    const failed = await start('succeeded', true); const response = await failed.post();
    expect(response.status).toBe(503);
    expect(failed.log.length).toBeGreaterThan(0);
    expect(failed.log.join('')).not.toContain('private-search-term');
    expect(await response.text()).not.toContain('private-search-term');
  });
  if (method === 'changeTargetAssignment') it.each(['command_id_conflict', 'target_not_selectable'])('returns the business conflict %s', async status => {
    const test = await start(status), response = await test.post();
    expect(response.status).toBe(409); expect(await response.json()).toMatchObject({ status });
  });
});
