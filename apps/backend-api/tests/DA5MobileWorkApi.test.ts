import type { Server } from 'node:http';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBackendHttpServer } from '../src/BackendHttpServer.js';
import {
  createBackendApiRuntime,
  type BackendApiRuntimeConfiguration,
} from '../src/runtime.js';
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
  it('requires and validates the server-only own-time cursor key during runtime composition',
    async () => {
      const configuration = mobileRuntimeConfiguration();
      expect(() => createBackendApiRuntime({
        ...configuration,
        mobileOwnTimeCursorHmacKey: undefined,
      })).toThrow('Backend API mobile own-time cursor HMAC key is required');

      const invalidKey = 'not-a-secret-key';
      expect(() => createBackendApiRuntime({
        ...configuration,
        mobileOwnTimeCursorHmacKey: invalidKey,
      })).toThrow('cursor HMAC key must be canonical unpadded base64url');
      try {
        createBackendApiRuntime({
          ...configuration,
          mobileOwnTimeCursorHmacKey: invalidKey,
        });
      } catch (error) {
        expect(String(error)).not.toContain(invalidKey);
      }

      const runtime = createBackendApiRuntime(configuration);
      await runtime.close();
    });

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

  it('keeps the server-issued own-time cursor opaque across separate HTTP requests', async () => {
    const cursor = `v1:${'a'.repeat(80)}.${'b'.repeat(43)}`;
    const queryOwnTime = vi.fn()
      .mockResolvedValueOnce({
        status: 'succeeded' as const,
        response: {
          activeRecord: null,
          records: [],
          nextCursor: cursor,
          windowStartedAt: '2026-06-23T10:00:00.000Z',
          windowEndedAt: '2026-07-24T10:00:00.000Z',
        },
      })
      .mockResolvedValueOnce({
        status: 'succeeded' as const,
        response: {
          activeRecord: null,
          records: [],
          nextCursor: null,
          windowStartedAt: '2026-06-23T10:00:00.000Z',
          windowEndedAt: '2026-07-24T10:00:00.000Z',
        },
      });
    const origin = await start({
      mobileWorkReader: {
        queryOwnTime,
        async queryWorkTargets() {
          return { status: 'forbidden' };
        },
      },
    });

    expect((await post(origin, '/v1/mobile/own-time/query', {
      expectedMembershipId: ids.membership,
      cursor: null,
      limit: 1,
    })).status).toBe(200);
    expect((await post(origin, '/v1/mobile/own-time/query', {
      expectedMembershipId: ids.membership,
      cursor,
      limit: 1,
    })).status).toBe(200);

    expect(queryOwnTime).toHaveBeenNthCalledWith(2, {
      accessToken: 'abc.def.ghi',
      request: { expectedMembershipId: ids.membership, cursor, limit: 1 },
    });
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

function mobileRuntimeConfiguration(): BackendApiRuntimeConfiguration {
  const databaseUrl = (login: string) => `postgresql://${login}@127.0.0.1/taptime`;
  return {
    sessionDatabaseUrl: databaseUrl('da5_cursor_session'),
    readModelDatabaseUrl: databaseUrl('da5_cursor_read_model'),
    lifecycleDatabaseUrl: databaseUrl('da5_cursor_lifecycle'),
    administrationDatabaseUrl: databaseUrl('da5_cursor_administration'),
    employeeInvitationDatabaseUrl: databaseUrl('da5_cursor_invitation'),
    employeeEnrollmentDatabaseUrl: databaseUrl('da5_cursor_enrollment'),
    reassignmentDatabaseUrl: databaseUrl('da5_cursor_reassignment'),
    offlineLeaseDatabaseUrl: databaseUrl('da5_cursor_offline_lease'),
    offlineEventDatabaseUrl: databaseUrl('da5_cursor_offline_event'),
    offlineReconciliationDatabaseUrl: databaseUrl('da5_cursor_offline_reconciliation'),
    timeEntryExportDatabaseUrl: databaseUrl('da5_cursor_export'),
    timeReviewReadDatabaseUrl: databaseUrl('da5_cursor_review_read'),
    timeReviewWriteDatabaseUrl: databaseUrl('da5_cursor_review_write'),
    mobileOwnTimeDatabaseUrl: databaseUrl('da5_cursor_own_time'),
    mobileTargetDatabaseUrl: databaseUrl('da5_cursor_targets'),
    mobileOwnTimeCursorHmacKey: Buffer.alloc(32, 0x61).toString('base64url'),
    supabaseIssuer: 'https://synthetic.supabase.co/auth/v1',
  };
}

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
