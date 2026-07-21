import type { Server } from 'node:http';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBackendHttpServer } from '../src/BackendHttpServer.js';
import type { BackendApiDependencies } from '../src/types.js';
import { unavailableOfflineDependencies } from './offlineTestDependencies.js';

const ids = {
  membership: '10000000-0000-4000-8000-000000000001',
  command: '20000000-0000-4000-8000-000000000001',
  record: '30000000-0000-4000-8000-000000000001',
  employeeMembership: '40000000-0000-4000-8000-000000000001',
  employeeUser: '50000000-0000-4000-8000-000000000001',
  customer: '60000000-0000-4000-8000-000000000001',
  reviewItem: '70000000-0000-4000-8000-000000000001',
  installation: '80000000-0000-4000-8000-000000000001',
} as const;

const servers: Server[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map(close));
});

describe('DA3 time-review HTTP boundary', () => {
  it('forwards the exact bounded overview command and emits only its closed ready result', async () => {
    const queryTimeRecords = vi.fn(async () => ({
      status: 'ready' as const,
      value: {
        records: [{
          timeRecordId: ids.record,
          employeeMembershipId: ids.employeeMembership,
          employeeDisplayName: 'Employee Alpha', customerId: ids.customer,
          customerDisplayName: 'Werkstatt', source: 'canonical' as const,
          status: 'stopped' as const, startedAt: '2026-07-20T08:00:00.000Z',
          stoppedAt: '2026-07-20T10:00:00.000Z', baseRowVersion: 1,
          effectiveRevisionNumber: 0, overlapsAnotherRecord: false,
        }],
        nextCursor: null,
      },
    }));
    const origin = await start({
      timeReview: { ...unavailableOfflineDependencies().timeReview, queryTimeRecords },
    });
    const body = {
      expectedMembershipId: ids.membership,
      fromInclusive: '2026-07-01T00:00:00.000Z',
      toExclusive: '2026-07-21T00:00:00.000Z', limit: 100, cursor: null,
    };
    const response = await post(origin, '/v1/administration/time-records/query', body);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: 'ready', records: [{ timeRecordId: ids.record }] });
    expect(queryTimeRecords).toHaveBeenCalledWith(
      { accessToken: 'abc.def.ghi', request: body },
      { deadlineEpochMilliseconds: expect.any(Number) },
    );
  });

  it('rejects extra body authority and the legacy expected-membership header before invocation', async () => {
    const queryTimeRecords = vi.fn(async () => ({ status: 'unavailable' as const }));
    const origin = await start({
      timeReview: { ...unavailableOfflineDependencies().timeReview, queryTimeRecords },
    });
    const body = {
      expectedMembershipId: ids.membership,
      fromInclusive: '2026-07-01T00:00:00.000Z',
      toExclusive: '2026-07-21T00:00:00.000Z', limit: 100, cursor: null,
    };
    await expectError(await post(origin, '/v1/administration/time-records/query', {
      ...body, organizationId: ids.customer,
    }), 400, 'invalid_request');
    await expectError(await post(
      origin, '/v1/administration/time-records/query', body,
      { 'x-taptime-expected-membership-id': ids.membership },
    ), 400, 'invalid_request');
    expect(queryTimeRecords).not.toHaveBeenCalled();
  });

  it('maps committed correction and review conflicts without leaking internal details', async () => {
    const correctTimeRecord = vi.fn(async () => ({
      status: 'committed' as const,
      value: {
        timeRecordId: ids.record, revisionNumber: 1,
        startedAt: '2026-07-20T08:15:00.000Z', stoppedAt: '2026-07-20T10:15:00.000Z',
        idempotentRetry: false,
      },
    }));
    const origin = await start({
      timeReview: {
        ...unavailableOfflineDependencies().timeReview,
        correctTimeRecord,
        async adjudicateReviewItems() { return { status: 'invalid_evidence' }; },
      },
    });
    const correction = {
      expectedMembershipId: ids.membership, commandId: ids.command,
      timeRecordId: ids.record, expectedBaseRowVersion: 1, expectedRevisionNumber: 0,
      startedAt: '2026-07-20T08:15:00.000Z', stoppedAt: '2026-07-20T10:15:00.000Z',
      reason: 'Beleg geprüft',
    };
    const corrected = await post(origin, '/v1/administration/time-records/correct', correction);
    expect(corrected.status).toBe(200);
    expect(await corrected.json()).toEqual({
      status: 'committed', timeRecordId: ids.record, revisionNumber: 1,
      startedAt: correction.startedAt, stoppedAt: correction.stoppedAt,
      idempotentRetry: false,
    });

    const adjudication = await post(origin, '/v1/administration/review-items/adjudicate', {
      expectedMembershipId: ids.membership, commandId: ids.command,
      reviewItemIds: [ids.reviewItem], resolution: { type: 'no_time_record_change' },
      reason: 'Evidence geprüft',
    });
    await expectError(adjudication, 422, 'invalid_evidence');
  });

  it('returns only exact current-installation review truth from the self-state route', async () => {
    const readReviewState = vi.fn(async () => ({
      status: 'ready' as const,
      value: {
        status: 'clear' as const, expectedMembershipId: ids.membership,
        installationId: ids.installation, confirmedThroughSequence: 14,
      },
    }));
    const origin = await start({
      offlineEventReconciliationReader: {
        ...unavailableOfflineDependencies().offlineEventReconciliationReader,
        readReviewState,
      },
    });
    const body = { expectedMembershipId: ids.membership, installationId: ids.installation };
    const response = await post(origin, '/v1/offline-review-state/query', body);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'clear', ...body, confirmedThroughSequence: 14 });
    expect(readReviewState).toHaveBeenCalledWith({ accessToken: 'abc.def.ghi', request: body });
  });
});

async function start(overrides: Partial<BackendApiDependencies>): Promise<string> {
  const server = createBackendHttpServer(dependencies(overrides));
  servers.push(server);
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('DA3 API has no TCP address');
  return `http://127.0.0.1:${address.port}`;
}

function dependencies(overrides: Partial<BackendApiDependencies>): BackendApiDependencies {
  return {
    ...unavailableOfflineDependencies(),
    sessionAuthority: { async resolve() { return { status: 'rejected' }; } },
    scanContextResolver: { async resolve() { return { status: 'not_resolved' }; } },
    lifecycleIngestor: { async ingest() { return {
      status: 'deferred', evidenceStored: false,
      reason: 'configuration_unavailable_or_inactive',
    }; } },
    deferredLifecycleIngestor: { async ingestDeferred() { return {
      status: 'deferred', evidenceStored: false,
      reason: 'configuration_unavailable_or_inactive',
    }; } },
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
    tagReassignment: { async reassignNfcTag() { return { status: 'unauthorized' }; } },
    ...overrides,
  };
}

function post(
  origin: string,
  path: string,
  body: unknown,
  headers: Record<string, string> = {},
): Promise<Response> {
  return fetch(`${origin}${path}`, {
    method: 'POST',
    headers: {
      authorization: 'Bearer abc.def.ghi', 'content-type': 'application/json', ...headers,
    },
    body: JSON.stringify(body),
  });
}

async function expectError(response: Response, status: number, code: string): Promise<void> {
  expect(response.status).toBe(status);
  expect(await response.json()).toEqual({ error: { code } });
  expect(response.headers.get('cache-control')).toBe('no-store');
}

async function close(server: Server): Promise<void> {
  if (!server.listening) return;
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error === undefined ? resolve() : reject(error));
  });
}
