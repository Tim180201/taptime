import type { Server } from 'node:http';
import {
  OFFLINE_LEASE_PAGE_RESPONSE_MAXIMUM_BYTES,
  type OfflineCaptureLeaseResult,
  type OfflineCaptureLeaseResultV2,
  type OfflineLifecycleEventResult,
} from '@taptime/offline-sync-contract';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBackendHttpServer } from '../src/BackendHttpServer.js';
import type { BackendApiDependencies, BackendApiDiagnostic } from '../src/types.js';
import { unavailableOfflineDependencies } from './offlineTestDependencies.js';

const ids = {
  command: '10000000-0000-4000-8000-000000000001',
  organization: '20000000-0000-4000-8000-000000000001',
  membership: '30000000-0000-4000-8000-000000000001',
  lease: '40000000-0000-4000-8000-000000000001',
  item: '50000000-0000-4000-8000-000000000001',
  installation: '60000000-0000-4000-8000-000000000001',
  binding: '70000000-0000-4000-8000-000000000001',
  user: '80000000-0000-4000-8000-000000000001',
  event: '90000000-0000-4000-8000-000000000001',
  receipt: 'a0000000-0000-4000-8000-000000000001',
  assignment: 'b0000000-0000-4000-8000-000000000001',
  tag: 'c0000000-0000-4000-8000-000000000001',
  customer: 'd0000000-0000-4000-8000-000000000001',
  timeEntry: 'e0000000-0000-4000-8000-000000000001',
} as const;

const binding = Buffer.alloc(32, 7).toString('base64url');
const lookupKey = Buffer.alloc(32, 9).toString('base64url');
const servers: Server[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map(close));
});

describe('complete offline synchronization HTTP boundary', () => {
  it('accepts only the exact lease issue shape and forwards no header authority hint', async () => {
    const issue = vi.fn(async (): Promise<OfflineCaptureLeaseResult> => readyLease());
    const origin = await start({
      offlineCaptureLeaseIssuer: {
        issue,
        async readPage() {
          return { status: 'unavailable' };
        },
      },
    });

    const accepted = await post(origin, '/v1/offline-capture-leases', {
      commandId: ids.command,
      installationBinding: binding,
      lookupKey,
    });
    expect(accepted.status).toBe(200);
    expect(await accepted.json()).toEqual(readyLease());
    expect(issue).toHaveBeenCalledWith({
      accessToken: 'abc.def.ghi',
      command: {
        commandId: ids.command,
        installationBinding: binding,
        lookupKey,
      },
    });

    const extra = await post(origin, '/v1/offline-capture-leases', {
      commandId: ids.command,
      installationBinding: binding,
      lookupKey,
      organizationId: ids.organization,
    });
    await expectGenericError(extra, 400, 'invalid_request');

    const ambiguous = await post(
      origin,
      '/v1/offline-capture-leases',
      { commandId: ids.command, installationBinding: binding, lookupKey },
      { 'x-taptime-expected-membership-id': ids.membership },
    );
    await expectGenericError(ambiguous, 400, 'invalid_request');
    expect(issue).toHaveBeenCalledTimes(1);
  });

  it('keeps the generalized lease on an explicit additive v2 route', async () => {
    const issueV2 = vi.fn(async (): Promise<OfflineCaptureLeaseResultV2> => readyLeaseV2());
    const origin = await start({
      offlineCaptureLeaseIssuer: {
        async issue() { return { status: 'unavailable' }; },
        async readPage() { return { status: 'unavailable' }; },
        issueV2,
        async readPageV2() { return { status: 'unavailable' }; },
      },
    });

    const response = await post(origin, '/v2/offline-capture-leases', {
      commandId: ids.command,
      installationBinding: binding,
      lookupKey,
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(readyLeaseV2());
    expect(issueV2).toHaveBeenCalledOnce();
  });

  it('bounds lease page commands and permits the 64 KiB exception only on page responses',
    async () => {
      const readPage = vi.fn(async (): Promise<OfflineCaptureLeaseResult> => readyLease());
      const origin = await start({
        offlineCaptureLeaseIssuer: {
          async issue() {
            return { status: 'unavailable' };
          },
          readPage,
        },
      });
      const accepted = await post(origin, '/v1/offline-capture-leases/page', {
        leaseId: ids.lease,
        cursor: 'opaque-cursor',
        limit: 100,
      });
      expect(accepted.status).toBe(200);
      expect(readPage).toHaveBeenCalledTimes(1);

      await expectGenericError(await post(origin, '/v1/offline-capture-leases/page', {
        leaseId: ids.lease,
        cursor: '',
        limit: 100,
      }), 400, 'invalid_request');
      await expectGenericError(await post(origin, '/v1/offline-capture-leases/page', {
        leaseId: ids.lease,
        cursor: 'opaque-cursor',
        limit: 101,
      }), 400, 'invalid_request');

      const oversizeOrigin = await start({
        offlineCaptureLeaseIssuer: {
          async issue() {
            return oversizeReadyLease();
          },
          async readPage() {
            return oversizeReadyLease();
          },
        },
      });
      await expectGenericError(await post(oversizeOrigin, '/v1/offline-capture-leases/page', {
        leaseId: ids.lease,
        cursor: 'opaque-cursor',
        limit: 100,
      }), 503, 'service_unavailable');
      expect(Buffer.byteLength(JSON.stringify(oversizeReadyLease())))
        .toBeGreaterThan(OFFLINE_LEASE_PAGE_RESPONSE_MAXIMUM_BYTES);
    });

  it.each([
    [
      'synchronized',
      {
        status: 'synchronized',
        idempotentRetry: false,
        workEventId: ids.event,
        receiptId: ids.receipt,
        deviceSequence: 1,
        decision: { status: 'time_entry_started', timeEntryId: ids.timeEntry },
      } satisfies OfflineLifecycleEventResult,
      200,
    ],
    [
      'review',
      {
        status: 'review_pending',
        idempotentRetry: false,
        workEventId: ids.event,
        receiptId: ids.receipt,
        deviceSequence: 1,
        reason: 'capture_time_out_of_bounds',
      } satisfies OfflineLifecycleEventResult,
      202,
    ],
    [
      'conflict',
      { status: 'conflict', reason: 'event_content_conflict' },
      409,
    ],
  ])('maps a valid offline event %s result without changing its closed payload',
    async (_label, result, status) => {
      const ingest = vi.fn(async (): Promise<OfflineLifecycleEventResult> => (
        result as OfflineLifecycleEventResult
      ));
      const origin = await start({ offlineLifecycleIngestor: { ingest } });
      const response = await post(origin, '/v1/lifecycle-events/offline', offlineEventBody());
      expect(response.status).toBe(status);
      expect(await response.json()).toEqual(result);
      expect(ingest).toHaveBeenCalledWith({
        accessToken: 'abc.def.ghi',
        command: offlineEventBody(),
      });
    });

  it('validates the entire offline event envelope and exposes only a bounded Retry-After', async () => {
    const ingest = vi.fn(async (): Promise<OfflineLifecycleEventResult> => ({
      status: 'pending',
      reason: 'lock_retry',
      retryAfterSeconds: 17,
    }));
    const origin = await start({ offlineLifecycleIngestor: { ingest } });
    const pending = await post(origin, '/v1/lifecycle-events/offline', offlineEventBody());
    expect(pending.status).toBe(202);
    expect(pending.headers.get('retry-after')).toBe('17');

    const invalid = offlineEventBody() as Record<string, unknown>;
    invalid.clock = {
      ...(invalid.clock as Record<string, unknown>),
      monotonicDeltaMilliseconds: -1,
    };
    await expectGenericError(
      await post(origin, '/v1/lifecycle-events/offline', invalid),
      400,
      'invalid_request',
    );
    expect(ingest).toHaveBeenCalledTimes(1);
  });

  it('accepts only provenance-v2 trigger unions on the additive offline lifecycle route',
    async () => {
      const ingest = vi.fn(async (): Promise<OfflineLifecycleEventResult> => ({
        status: 'pending',
        reason: 'temporarily_unavailable',
      }));
      const origin = await start({ offlineLifecycleIngestor: { ingest } });
      const body = offlineEventBodyV2();
      const response = await post(origin, '/v2/lifecycle-events/offline', body);
      expect(response.status).toBe(202);
      expect(ingest).toHaveBeenCalledWith({
        accessToken: 'abc.def.ghi',
        command: body,
      });
      await expectGenericError(await post(origin, '/v2/lifecycle-events/offline', {
        ...body,
        workEvent: {
          ...body.workEvent,
          trigger: {
            type: 'manual',
            assignmentId: ids.assignment,
          },
        },
      }), 400, 'invalid_request');
      await expectGenericError(
        await post(origin, '/v1/lifecycle-events/offline', body),
        400,
        'invalid_request',
      );
      expect(ingest).toHaveBeenCalledTimes(1);
    });

  it('maps offline authority, reconciliation, timeout, and thrown failures without disclosure',
    async () => {
      const diagnostics: BackendApiDiagnostic[] = [];
      const origin = await start({
        offlineLifecycleIngestor: {
          async ingest() {
            return { status: 'authority_rejected' };
          },
        },
        offlineEventReconciliationReader: {
          async reconcile() {
            return {
              status: 'ready',
              records: [],
            };
          },
          async readReviewState() {
            return { status: 'unavailable' };
          },
        },
      }, diagnostics);
      await expectGenericError(
        await post(origin, '/v1/lifecycle-events/offline', offlineEventBody()),
        401,
        'unauthorized',
      );
      const reconciled = await post(origin, '/v1/lifecycle-events/reconcile', {
        workEventIds: [ids.event],
      });
      expect(reconciled.status).toBe(200);
      expect(await reconciled.json()).toEqual({ status: 'ready', records: [] });
      await expectGenericError(await post(origin, '/v1/lifecycle-events/reconcile', {
        workEventIds: [ids.event, ids.event],
      }), 400, 'invalid_request');

      const failedOrigin = await start({
        offlineCaptureLeaseIssuer: {
          async issue() {
            throw new Error('secret-offline-database-detail');
          },
          async readPage() {
            return { status: 'unavailable' };
          },
        },
      }, diagnostics);
      const failed = await post(failedOrigin, '/v1/offline-capture-leases', {
        commandId: ids.command,
        installationBinding: binding,
        lookupKey,
      });
      const failedCopy = failed.clone();
      await expectGenericError(failed, 503, 'service_unavailable');
      expect(await failedCopy.text()).not.toContain('secret');
      expect(diagnostics.at(-1)?.code).toBe('offline_synchronization_failed');

      const timedOutOrigin = await start({
        offlineEventReconciliationReader: {
          async reconcile() {
            return new Promise<never>(() => undefined);
          },
          async readReviewState() {
            return { status: 'unavailable' };
          },
        },
      }, diagnostics, 5);
      await expectGenericError(await post(timedOutOrigin, '/v1/lifecycle-events/reconcile', {
        workEventIds: [ids.event],
      }), 503, 'service_unavailable');
    });
});

function offlineEventBody() {
  return {
    organizationId: ids.organization,
    expectedMembershipId: ids.membership,
    leaseId: ids.lease,
    leaseItemId: ids.item,
    installationBinding: binding,
    deviceSequence: 1,
    provenanceVersion: 1,
    clock: {
      bootMarker: 'boot-marker',
      monotonicAnchorMilliseconds: 100,
      monotonicDeltaMilliseconds: 200,
      wallClockAnchor: '2026-07-18T10:00:00.000Z',
      clockProofStatus: 'verified_same_boot',
      clockProofVersion: 1,
    },
    workEvent: {
      id: ids.event,
      assignmentId: ids.assignment,
      nfcTagId: ids.tag,
      target: { targetType: 'customer', targetId: ids.customer },
      occurredAt: '2026-07-18T10:00:00.200Z',
    },
    receipt: { id: ids.receipt, attemptNumber: 1 },
  };
}

function offlineEventBodyV2() {
  return {
    organizationId: ids.organization,
    expectedMembershipId: ids.membership,
    leaseId: ids.lease,
    leaseItemId: ids.item,
    installationBinding: binding,
    deviceSequence: 1,
    provenanceVersion: 2,
    clock: {
      bootMarker: 'boot-v2',
      monotonicAnchorMilliseconds: 10,
      monotonicDeltaMilliseconds: 1,
      wallClockAnchor: '2026-07-24T10:00:00.000Z',
      clockProofStatus: 'verified_same_boot',
      clockProofVersion: 1,
    },
    workEvent: {
      id: ids.event,
      target: { targetType: 'project', targetId: ids.customer },
      occurredAt: '2026-07-24T10:00:00.001Z',
      trigger: { type: 'manual' },
    },
    receipt: { id: ids.receipt, attemptNumber: 1 },
  } as const;
}

function readyLease(): OfflineCaptureLeaseResult {
  return {
    status: 'ready',
    idempotentRetry: false,
    page: {
      leaseId: ids.lease,
      installationId: ids.installation,
      identityBindingId: ids.binding,
      userId: ids.user,
      organizationId: ids.organization,
      membershipId: ids.membership,
      membershipRowVersion: 1,
      role: 'employee',
      issuedAt: '2026-07-18T10:00:00.000Z',
      expiresAt: '2026-07-18T22:00:00.000Z',
      configurationRevision: '1'.repeat(64),
      itemCount: 0,
      serializedBytes: 2,
      manifestDigest: '2'.repeat(64),
      items: [],
      nextCursor: null,
    },
  };
}

function readyLeaseV2(): OfflineCaptureLeaseResultV2 {
  return {
    status: 'ready',
    idempotentRetry: false,
    page: {
      leaseSchemaVersion: 2,
      manifestVersion: 2,
      leaseId: ids.lease,
      installationId: ids.installation,
      identityBindingId: ids.binding,
      userId: ids.user,
      organizationId: ids.organization,
      membershipId: ids.membership,
      membershipRowVersion: 1,
      role: 'employee',
      issuedAt: '2026-07-18T10:00:00.000Z',
      expiresAt: '2026-07-18T22:00:00.000Z',
      configurationRevision: '1'.repeat(64),
      itemCount: 1,
      serializedBytes: 2,
      manifestDigest: '2'.repeat(64),
      items: [{
        itemType: 'manual_target',
        itemId: ids.item,
        targetType: 'general_work',
        targetId: ids.customer,
        displayName: 'Allgemeine Arbeitszeit',
        targetRowVersion: 1,
      }],
      nextCursor: null,
    },
  };
}

function oversizeReadyLease(): OfflineCaptureLeaseResult {
  const result = readyLease();
  if (result.status !== 'ready') throw new Error('Synthetic lease setup failed');
  return {
    ...result,
    page: {
      ...result.page,
      items: [{
        itemId: ids.item,
        lookup: '3'.repeat(64),
        assignmentId: ids.assignment,
        nfcTagId: ids.tag,
        targetType: 'customer',
        targetId: ids.customer,
        displayName: 'x'.repeat(OFFLINE_LEASE_PAGE_RESPONSE_MAXIMUM_BYTES),
      }],
    },
  };
}

async function start(
  overrides: Partial<BackendApiDependencies>,
  diagnostics: BackendApiDiagnostic[] = [],
  timeoutMilliseconds = 10_000,
): Promise<string> {
  const server = createBackendHttpServer(dependencies(overrides), {
    operationTimeoutMilliseconds: timeoutMilliseconds,
    onDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
  });
  servers.push(server);
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('Synthetic offline API has no TCP address');
  }
  return `http://127.0.0.1:${address.port}`;
}

function dependencies(
  overrides: Partial<BackendApiDependencies>,
): BackendApiDependencies {
  return {
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
    timeReview: overrides.timeReview ?? unavailableOfflineDependencies().timeReview,
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
      authorization: 'Bearer abc.def.ghi',
      'content-type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

async function expectGenericError(
  response: Response,
  status: number,
  code: string,
): Promise<void> {
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
