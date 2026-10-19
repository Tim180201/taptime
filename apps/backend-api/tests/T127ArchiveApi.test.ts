import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BACKEND_HTTP_ROUTES, createBackendHttpServer, requestRateLimitScope } from '../src/BackendHttpServer.js';
import { createBackendApiDiagnosticLogSink } from '../src/diagnosticLog.js';
import type { BackendApiDependencies } from '../src/types.js';
import { closeServer, listen } from './fixtures.js';
const id = randomUUID();
const month = { fromInclusive: '2026-06-30T22:00:00.000Z', toExclusive: '2026-07-31T22:00:00.000Z' };
const page = { search: 'private-archive-name', cursor: null, limit: 50, locationId: null };
const entries = [
  ['/v1/administration/archive/people', 'people', { ...page, membershipId: null }],
  ['/v1/administration/archive/targets', 'targets', page],
  ['/v1/administration/archive/status', 'status', { membershipIds: [id], targets: [] }],
  ['/v2/administration/managed-active-summary', 'managed_people', { ...page, ...month, isRunning: null }],
  ['/v2/administration/managed-person-time', 'person_time', { ...month, targetMembershipId: id, cursor: null, limit: 20 }],
] as const;
const servers: Server[] = [];
afterEach(async () => { for (const server of servers.splice(0)) await closeServer(server); });
describe.each(entries)('T127 HTTP %s', (path, kind, fields) => {
  async function start(status = 'succeeded', fail = false, response: unknown = { marker: 'passed' }) {
    const logs: string[] = [];
    const queryArchive = vi.fn(async () => {
      if (fail) throw new Error('private-archive-name');
      return { status, response };
    });
    const server = createBackendHttpServer({ employeeEnrollment: { queryArchive } } as unknown as BackendApiDependencies,
      { onDiagnostic: createBackendApiDiagnosticLogSink({ output: { write: value => { logs.push(String(value)); return true; } } }) });
    servers.push(server); await listen(server);
    const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const body = { expectedMembershipId: id, ...fields };
    const headers = { authorization: 'Bearer header.payload.signature', 'content-type': 'application/json' };
    return { queryArchive, logs, body, post: (patch = {}, extraHeaders = {}) => fetch(origin + path, {
      method: 'POST', headers: { ...headers, ...extraHeaders }, body: JSON.stringify({ ...body, ...patch }),
    }) };
  }
  it('protects the route and dispatches the exact request', async () => {
    expect(Object.hasOwn(BACKEND_HTTP_ROUTES, path)).toBe(true); expect(requestRateLimitScope(path)).not.toBeNull();
    const test = await start(); expect((await test.post()).status).toBe(200);
    expect(test.queryArchive).toHaveBeenCalledWith(kind, { accessToken: 'header.payload.signature', request: test.body });
  });
  it('rejects invalid and identity-injecting requests before dispatch', async () => {
    const test = await start(); expect((await test.post({ organizationId: id })).status).toBe(400);
    expect((await test.post({}, { 'x-taptime-expected-membership-id': id })).status).toBe(400);
    expect((await test.post({}, { authorization: '' })).status).toBe(401);
    expect(test.queryArchive).not.toHaveBeenCalled();
  });
  it.each([['forbidden', 403], ['unauthorized', 401], ['invalid_request', 400]] as const)('maps %s to %s', async (status, code) => {
    const test = await start(status); const response = await test.post();
    expect(response.status).toBe(code); expect(await response.json()).toEqual({ error: { code: status } });
  });
  it('keeps search, IDs and SQL errors out of diagnostics', async () => {
    const test = await start('succeeded', true); const response = await test.post();
    expect(response.status).toBe(503); expect(test.logs.length).toBeGreaterThan(0);
    expect(test.logs.join('')).not.toContain('private-archive-name'); expect(test.logs.join('')).not.toContain(id);
    expect(await response.text()).not.toContain('private-archive-name');
  });
  if (kind === 'status') it('returns all 200 statuses even when the payload exceeds the legacy 16-KiB envelope', async () => {
    const targets = Array.from({ length: 200 }, () => ({ targetType: 'customer', targetId: randomUUID() }));
    const response = { people: [], targets: targets.map(t => ({ ...t, archived: true })) };
    expect(Buffer.byteLength(JSON.stringify(response))).toBeGreaterThan(16 * 1024);
    const test = await start('succeeded', false, response);
    const result = await test.post({ membershipIds: [], targets });
    expect(result.status).toBe(200); expect(await result.json()).toEqual(response);
  });
});
