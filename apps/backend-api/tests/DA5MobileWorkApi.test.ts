import type { Server } from 'node:http';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBackendHttpServer } from '../src/BackendHttpServer.js';
import type { BackendApiDependencies } from '../src/types.js';
import { unavailableOfflineDependencies } from './offlineTestDependencies.js';

const ids = {
  membership: '10000000-0000-4000-8000-000000000001',
  project: '20000000-0000-4000-8000-000000000001',
  command: '30000000-0000-4000-8000-000000000001',
  event: '40000000-0000-4000-8000-000000000001',
  receipt: '50000000-0000-4000-8000-000000000001',
  timeEntry: '60000000-0000-4000-8000-000000000001',
} as const;

const servers: Server[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map(close));
});

describe('DA5 Mobile work HTTP boundaries', () => {
  it('forwards only the exact self-only own-time request and returns no-store', async () => {
    const queryOwnTime = vi.fn(async () => ({
      status: 'succeeded' as const,
      response: {
        activeRecord: null,
        records: [],
        nextCursor: null,
        windowStartedAt: '2026-06-23T10:00:00.000Z',
        windowEndedAt: '2026-07-24T10:00:00.000Z',
      },
    }));
    const origin = await start({
      mobileWorkReader: {
        queryOwnTime,
        async queryWorkTargets() {
          return { status: 'forbidden' };
        },
      },
    });

    const response = await post(origin, '/v1/mobile/own-time/query', {
      expectedMembershipId: ids.membership,
      cursor: null,
      limit: 20,
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(queryOwnTime).toHaveBeenCalledWith({
      accessToken: 'abc.def.ghi',
      request: {
        expectedMembershipId: ids.membership,
        cursor: null,
        limit: 20,
      },
    });
    await expectError(await post(origin, '/v1/mobile/own-time/query', {
      expectedMembershipId: ids.membership,
      cursor: null,
      limit: 20,
      userId: ids.project,
    }), 400, 'invalid_request');
  });

  it('maps strict Project create and active-use deactivation conflicts', async () => {
    const createProject = vi.fn(async () => ({
      status: 'succeeded' as const,
      idempotentRetry: false,
      project: {
        projectId: ids.project,
        displayName: 'Innenausbau',
        active: true,
        rowVersion: 1,
      },
      receiptId: ids.command,
    }));
    const origin = await start({
      projectAdministration: {
        async queryProjects() { return { status: 'forbidden' }; },
        createProject,
        async deactivateProject() { return { status: 'project_in_use' }; },
      },
    });

    const created = await post(origin, '/v1/administration/projects/create', {
      expectedMembershipId: ids.membership,
      commandId: ids.command,
      projectId: ids.project,
      displayName: 'Innenausbau',
    });
    expect(created.status).toBe(200);
    expect(await created.json()).toMatchObject({
      status: 'succeeded',
      project: { projectId: ids.project, active: true },
    });

    await expectError(await post(origin, '/v1/administration/projects/deactivate', {
      expectedMembershipId: ids.membership,
      commandId: ids.command,
      projectId: ids.project,
      expectedRowVersion: 1,
    }), 409, 'project_in_use');
    expect(createProject).toHaveBeenCalledOnce();
  });

  it('accepts a manual trigger without caller time or Start/Stop intent', async () => {
    const ingestManual = vi.fn(async () => ({
      status: 'synchronized' as const,
      idempotentRetry: false,
      decision: { status: 'time_entry_started' as const, timeEntryId: ids.timeEntry },
      workEventId: ids.event,
      receiptId: ids.receipt,
      serverTimeEntryId: ids.timeEntry,
    }));
    const origin = await start({
      manualLifecycleIngestor: { ingestManual: ingestManual as never },
    });
    const request = {
      expectedMembershipId: ids.membership,
      workEvent: {
        id: ids.event,
        target: { targetType: 'project', targetId: ids.project },
      },
      receipt: { id: ids.receipt, attemptNumber: 1 },
    };

    const accepted = await post(origin, '/v1/lifecycle-events/manual', request);

    expect(accepted.status).toBe(200);
    expect(ingestManual).toHaveBeenCalledOnce();
    await expectError(await post(origin, '/v1/lifecycle-events/manual', {
      ...request,
      workEvent: { ...request.workEvent, occurredAt: '2026-07-24T10:00:00.000Z' },
    }), 400, 'invalid_request');
    await expectError(await post(origin, '/v1/lifecycle-events/manual', {
      ...request,
      action: 'start',
    }), 400, 'invalid_request');
  });
});

async function start(overrides: Partial<BackendApiDependencies>): Promise<string> {
  const server = createBackendHttpServer({
    ...unavailableOfflineDependencies(),
    sessionAuthority: { async resolve() { return { status: 'rejected' }; } },
    scanContextResolver: { async resolve() { return { status: 'not_resolved' }; } },
    lifecycleIngestor: {
      async ingest() {
        return {
          status: 'deferred',
          evidenceStored: false,
          reason: 'configuration_unavailable_or_inactive',
        };
      },
    },
    deferredLifecycleIngestor: {
      async ingestDeferred() {
        return {
          status: 'deferred',
          evidenceStored: false,
          reason: 'configuration_unavailable_or_inactive',
        };
      },
    },
    administration: {
      async createCustomer() { return { status: 'unauthorized' }; },
      async provisionNfcTag() { return { status: 'unauthorized' }; },
      async readSetupProjection() { return { status: 'unauthorized' }; },
    },
    employeeEnrollment: {
      async createInvitation() { return { status: 'unauthorized' }; },
      async redeemInvitation() { return { status: 'unauthorized' }; },
      async readEmployeeMembershipsProjection() { return { status: 'unauthorized' }; },
    },
    tagReassignment: {
      async reassignNfcTag() { return { status: 'unauthorized' }; },
    },
    ...overrides,
  }, { operationTimeoutMilliseconds: 10_000 });
  servers.push(server);
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('No TCP address');
  return `http://127.0.0.1:${address.port}`;
}

function post(origin: string, path: string, body: unknown): Promise<Response> {
  return fetch(`${origin}${path}`, {
    method: 'POST',
    headers: {
      authorization: 'Bearer abc.def.ghi',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

async function expectError(
  response: Response,
  status: number,
  code: string,
): Promise<void> {
  expect(response.status).toBe(status);
  expect(await response.json()).toEqual({ error: { code } });
}

async function close(server: Server): Promise<void> {
  if (!server.listening) return;
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error === undefined ? resolve() : reject(error));
  });
}
