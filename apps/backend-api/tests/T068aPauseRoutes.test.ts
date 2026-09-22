import { afterAll, expect, it, vi } from 'vitest';
import { BACKEND_HTTP_ROUTES, createBackendHttpServer } from '../src/BackendHttpServer.js';
import type { BackendApiDependencies } from '../src/types.js';
import { closeServer, listen } from './fixtures.js';

let clock = 0;
const checkTenantAccess = vi.fn(async () => { throw Object.assign(new Error('organization_paused'), { code: 'P0068' }); });
const server = createBackendHttpServer({ checkTenantAccess } as unknown as BackendApiDependencies,
  { rateLimitClock: () => clock += 60_001 });
afterAll(() => closeServer(server));
it('returns the same transient pause response on every registered tenant route before dispatch', async () => {
  await listen(server); const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No address');
  const outcomes: Record<string, unknown> = {};
  for (const [path, route] of Object.entries(BACKEND_HTTP_ROUTES)) {
    if (route === 'health' || route.startsWith('operator_')) continue;
    const method = route === 'session' || route === 'session_v2' ? 'GET' : 'POST';
    const response = await fetch(`http://127.0.0.1:${address.port}${path}`, { method,
      headers: { authorization: 'Bearer a.b.c', 'content-type': 'application/json' },
      ...(method === 'POST' ? { body: '{}' } : {}) });
    outcomes[path] = [response.status, await response.json()];
  }
  expect(Object.values(outcomes).every(value => JSON.stringify(value) === JSON.stringify([403, { error: { code: 'organization_paused' } }]))).toBe(true);
  expect(checkTenantAccess).toHaveBeenCalledTimes(Object.keys(outcomes).length);
});

it.each(['stop', 'backfill', 'comment'] as const)('preserves pause detected inside the %s transaction after the preflight passed', async kind => {
  const id = '10000000-0000-4000-8000-000000000001';
  const execute = vi.fn(async () => { throw Object.assign(new Error('organization_paused'), { code: 'P0068' }); });
  const lateServer = createBackendHttpServer({ checkTenantAccess: async () => {},
    administrationStop: { execute }, timeSupplement: { execute } } as unknown as BackendApiDependencies);
  await listen(lateServer); const address = lateServer.address();
  if (!address || typeof address === 'string') throw new Error('No address');
  const body = kind === 'comment'
    ? { expectedMembershipId: id, commandId: id, timeRecordId: id, comment: 'Notiz' }
    : kind === 'stop' ? { expectedMembershipId: id, targetMembershipId: id, commandId: id, timeRecordId: id,
      expectedRowVersion: 1, stoppedAt: '2026-09-21T12:00:00.000Z', reason: 'Stopp vergessen' }
    : { expectedMembershipId: id, targetMembershipId: id, commandId: id, targetType: 'project', targetId: id,
      startedAt: '2026-09-20T08:00:00.000Z', stoppedAt: '2026-09-20T09:00:00.000Z', reason: null, comment: null };
  try {
    const response = await fetch(`http://127.0.0.1:${address.port}/v1/time-records/${kind}`, { method: 'POST',
      headers: { authorization: 'Bearer a.b.c', 'content-type': 'application/json' }, body: JSON.stringify(body) });
    expect(execute).toHaveBeenCalledOnce();
    expect([response.status, await response.json()]).toEqual([403, { error: { code: 'organization_paused' } }]);
  } finally { await closeServer(lateServer); }
});
