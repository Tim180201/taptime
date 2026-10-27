import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BACKEND_HTTP_ROUTES, createBackendHttpServer, requestRateLimitScope } from '../src/BackendHttpServer.js';
import { createBackendApiDiagnosticLogSink } from '../src/diagnosticLog.js';
import type { BackendApiDependencies } from '../src/types.js';
import { closeServer, listen } from './fixtures.js';

const id = '00000000-0000-4000-8000-000000000001';
const month = { fromInclusive: '2026-09-30T22:00:00.000Z', toExclusive: '2026-10-31T23:00:00.000Z' };
const entries = [
  ['/v2/customers/hours/query', 'customer_hours', month],
  ['/v2/customers/hours/detail', 'customer_detail', { ...month, customerId: id }],
  ['/v1/customers/hours/person-days', 'customer_person_days', { ...month, customerId: id, targetMembershipId: id }],
  ['/v1/administration/managed-active-summary', 'managed_people', { ...month, locationId: null, isRunning: null }],
  ['/v3/administration/employee-memberships-projection', 'memberships', { locationId: null }],
  ['/v4/administration/employee-memberships-projection', 'memberships', { locationId: null, active: null }],
  ['/v3/administration/setup-projection', 'setup_customers', { kind: 'customers' }],
  ['/v3/administration/setup-projection', 'setup_tags', { kind: 'nfc_tags' }],
  ['/v2/mobile/work-targets/query', 'work_targets', {}],
  ['/v2/administration/time-records/backfill-targets/query', 'backfill_targets', { targetMembershipId: id }],
  ['/v2/administration/projects/query', 'projects', {}],
] as const;
const servers: Server[] = [];
afterEach(async () => { for (const server of servers.splice(0)) await closeServer(server); });
describe.each(entries)('T117 HTTP %s (%s)', (path, kind, fields) => {
  async function start(fail = false, status = 'succeeded') {
    const log: string[] = [];
    const querySearch = vi.fn(async () => {
      if (fail) throw new Error('private-search-term');
      return { status, response: { marker: 'passed' } };
    });
    const deps = { administration: { querySearch }, employeeEnrollment: { querySearch }, mobileWorkReader: { querySearch },
      projectAdministration: { querySearch }, timeReview: { querySearch } } as unknown as BackendApiDependencies;
    const server = createBackendHttpServer(deps, { onDiagnostic: createBackendApiDiagnosticLogSink({ output: { write: value => { log.push(String(value)); return true; } } }) });
    servers.push(server); await listen(server);
    const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const body = { expectedMembershipId: id, cursor: null, limit: 50, ...(['customer_detail','customer_person_days'].includes(kind) ? {} : { search: 'private-search-term' }), ...fields };
    const headers = { authorization: 'Bearer header.payload.signature', 'content-type': 'application/json', ...(kind === 'managed_people' ? { accept: 'application/vnd.taptime.managed-people.v6+json' } : {}) };
    return { querySearch, log, body, post: (patch = {}, extraHeaders = {}) => fetch(origin + path, { method: 'POST', headers: { ...headers, ...extraHeaders }, body: JSON.stringify({ ...body, ...patch }) }) };
  }
  it('registers a protected route and dispatches the new contract', async () => {
    expect(Object.hasOwn(BACKEND_HTTP_ROUTES, path)).toBe(true);
    expect(requestRateLimitScope(path)).not.toBeNull();
    const test = await start(); const response = await test.post();
    expect(response.status).toBe(200);
    expect(test.querySearch).toHaveBeenCalledWith(kind, { accessToken: 'header.payload.signature', request: test.body });
  });
  it('rejects a membership header instead of taking identity from it', async () => {
    const test = await start(); const response = await test.post({}, { 'x-taptime-expected-membership-id': id });
    expect(response.status).toBe(400); expect(test.querySearch).not.toHaveBeenCalled();
  });
  it('rejects invalid bodies before dispatch', async () => {
    const test = await start(); const response = await test.post({ limit: 51 });
    expect(response.status).toBe(400); expect(test.querySearch).not.toHaveBeenCalled();
  });
  it('does not put the search term or exception message into diagnostics', async () => {
    const test = await start(true); const response = await test.post();
    expect(response.status).toBe(503); expect(test.log.length).toBeGreaterThan(0);
    expect(test.log.join('')).not.toContain('private-search-term');
    expect(await response.text()).not.toContain('private-search-term');
  });
  if (kind === 'memberships') it('preserves the predecessor location_scope_forbidden response', async () => {
    const test = await start(false, 'location_scope_forbidden');
    const response = await test.post();
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: { code: 'location_scope_forbidden' } });
  });
});
