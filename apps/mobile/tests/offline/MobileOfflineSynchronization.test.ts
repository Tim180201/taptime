import { describe, expect, it, vi } from 'vitest';
import type {
  OfflineCaptureLeasePage,
  OfflineCaptureLeasePageV2,
  OfflineLifecycleEventCommand,
  OfflineReconciliationResult,
} from '@taptime/offline-sync-contract';
import type {
  AuthenticatedHttpResult,
  AuthenticatedJsonPostPort,
} from '../../src/transport/AuthenticatedHttpRequestExecutor';
import type {
  LifecycleEventApiPort,
  LifecycleEventResult,
} from '../../src/transport/contracts';
import type {
  LifecycleEvidenceOutbox,
  PendingLifecycleEvidence,
  StoredLifecycleEvidence,
} from '../../src/scan/LifecycleEvidenceOutbox';
import { OfflineCaptureDatabase } from '../../src/offline/OfflineCaptureDatabase';
import { OfflineCaptureLeaseClient } from '../../src/offline/OfflineCaptureLeaseClient';
import {
  OfflineLifecycleClient,
  type OfflineLifecycleApiPort,
} from '../../src/offline/OfflineLifecycleClient';
import { LegacyLifecycleEvidenceImporter } from '../../src/offline/LegacyLifecycleEvidenceImporter';
import {
  mobileManifestDigest,
  mobileManifestDigestV2,
} from '../../src/offline/MobileLookupHmac';
import {
  OfflineSyncScheduler,
  retryDelay,
} from '../../src/offline/OfflineSyncScheduler';

const ids = {
  command: '10000000-0000-4000-8000-000000000001',
  organization: '20000000-0000-4000-8000-000000000001',
  membership: '30000000-0000-4000-8000-000000000001',
  lease: '40000000-0000-4000-8000-000000000001',
  installation: '50000000-0000-4000-8000-000000000001',
  identity: '60000000-0000-4000-8000-000000000001',
  user: '70000000-0000-4000-8000-000000000001',
  item1: '80000000-0000-4000-8000-000000000001',
  item2: '80000000-0000-4000-8000-000000000002',
  assignment1: '90000000-0000-4000-8000-000000000001',
  assignment2: '90000000-0000-4000-8000-000000000002',
  tag1: 'a0000000-0000-4000-8000-000000000001',
  tag2: 'a0000000-0000-4000-8000-000000000002',
  customer1: 'b0000000-0000-4000-8000-000000000001',
  customer2: 'b0000000-0000-4000-8000-000000000002',
  event: 'c0000000-0000-4000-8000-000000000001',
  receipt: 'd0000000-0000-4000-8000-000000000001',
  timeEntry: 'e0000000-0000-4000-8000-000000000001',
} as const;

const installationBinding = 'B'.repeat(43);
const lookupKey = 'K'.repeat(43);

describe('Mobile complete offline clients', () => {
  it('assembles strict immutable lease pages and verifies the total manifest before returning',
    async () => {
      const complete = leasePage();
      const first = { ...complete, items: complete.items.slice(0, 1), nextCursor: 'next' };
      const second = { ...complete, items: complete.items.slice(1), nextCursor: null };
      const request = new FakeRequest(async (endpoint) => response(200, {
        status: 'ready',
        idempotentRetry: false,
        page: endpoint.pathname.endsWith('/page') ? second : first,
      }));
      const client = new OfflineCaptureLeaseClient(new URL('https://api.example/'), request);

      await expect(client.issueComplete({
        commandId: ids.command,
        installationBinding,
        lookupKey,
      })).resolves.toEqual({
        status: 'ready',
        idempotentRetry: false,
        page: complete,
      });
      expect(request.calls).toHaveLength(2);
      expect(request.calls[1]!.options).toEqual({ maximumResponseBytes: 65_536 });
    });

  it('fails a lease generation closed on duplicate cross-page lookup data', async () => {
    const complete = leasePage();
    const duplicate = {
      ...complete.items[1]!,
      lookup: complete.items[0]!.lookup,
    };
    const request = new FakeRequest(async (endpoint) => response(200, {
      status: 'ready',
      idempotentRetry: false,
      page: endpoint.pathname.endsWith('/page')
        ? { ...complete, items: [duplicate], nextCursor: null }
        : { ...complete, items: complete.items.slice(0, 1), nextCursor: 'next' },
    }));
    const client = new OfflineCaptureLeaseClient(new URL('https://api.example/'), request);

    await expect(client.issueComplete({
      commandId: ids.command,
      installationBinding,
      lookupKey,
    })).resolves.toEqual({ status: 'incomplete_or_oversize' });
  });

  it('assembles a strict v2 mixed NFC/manual lease and uses only additive routes', async () => {
    const complete = leasePageV2();
    const first = { ...complete, items: complete.items.slice(0, 1), nextCursor: 'next-v2' };
    const second = { ...complete, items: complete.items.slice(1), nextCursor: null };
    const request = new FakeRequest(async (endpoint) => response(200, {
      status: 'ready',
      idempotentRetry: false,
      page: endpoint.pathname.endsWith('/page') ? second : first,
    }));
    const client = new OfflineCaptureLeaseClient(new URL('https://api.example/'), request);
    await expect(client.issueCompleteV2({
      commandId: ids.command,
      installationBinding,
      lookupKey,
    })).resolves.toEqual({
      status: 'ready',
      idempotentRetry: false,
      page: complete,
    });
    expect(request.calls.map(({ endpoint }) => endpoint.pathname)).toEqual([
      '/v2/offline-capture-leases',
      '/v2/offline-capture-leases/page',
    ]);
  });

  it('fails a lease generation closed on a non-adjacent pagination cursor cycle', async () => {
    const complete = leasePage();
    let pageRequest = 0;
    const request = new FakeRequest(async (endpoint) => {
      if (!endpoint.pathname.endsWith('/page')) {
        return response(200, {
          status: 'ready',
          idempotentRetry: false,
          page: { ...complete, items: [], nextCursor: 'cursor-a' },
        });
      }
      pageRequest += 1;
      return response(200, {
        status: 'ready',
        idempotentRetry: true,
        page: {
          ...complete,
          items: [],
          nextCursor: pageRequest === 1 ? 'cursor-b' : 'cursor-a',
        },
      });
    });
    const client = new OfflineCaptureLeaseClient(new URL('https://api.example/'), request);

    await expect(client.issueComplete({
      commandId: ids.command,
      installationBinding,
      lookupKey,
    })).resolves.toEqual({ status: 'incomplete_or_oversize' });
    expect(request.calls).toHaveLength(3);
  });

  it('accepts only exact durable offline IDs and exact matching bounded Retry-After', async () => {
    const command = offlineCommand();
    const request = new FakeRequest(async () => response(202, {
      status: 'pending',
      reason: 'lock_retry',
      retryAfterSeconds: 17,
    }, 17));
    const client = new OfflineLifecycleClient(new URL('https://api.example/'), request);
    await expect(client.ingest(command)).resolves.toEqual({
      status: 'pending',
      reason: 'lock_retry',
      retryAfterSeconds: 17,
    });

    request.handler = async () => response(200, {
      status: 'synchronized',
      idempotentRetry: false,
      workEventId: ids.event,
      receiptId: ids.receipt,
      deviceSequence: 2,
      decision: { status: 'time_entry_started', timeEntryId: ids.timeEntry },
    });
    await expect(client.ingest(command)).resolves.toEqual({ status: 'unavailable' });
  });

  it('parses a tenant-scoped exact-ID reconciliation without accepting extras', async () => {
    const request = new FakeRequest(async () => response(200, {
      status: 'ready',
      records: [{
        workEventId: ids.event,
        receiptId: ids.receipt,
        deviceSequence: 1,
        result: {
          status: 'synchronized',
          decision: { status: 'time_entry_started', timeEntryId: ids.timeEntry },
        },
      }],
    }));
    const client = new OfflineLifecycleClient(new URL('https://api.example/'), request);
    await expect(client.reconcile([ids.event])).resolves.toMatchObject({
      status: 'ready',
      records: [{ workEventId: ids.event, deviceSequence: 1 }],
    });
    await expect(client.reconcile([ids.event, ids.event]))
      .resolves.toEqual({ status: 'unavailable' });
  });

  it('accepts only an exact echoed high-water review-state clear proof', async () => {
    const request = new FakeRequest(async () => response(200, {
      status: 'clear',
      expectedMembershipId: ids.membership,
      installationId: ids.installation,
      confirmedThroughSequence: 4,
    }));
    const client = new OfflineLifecycleClient(new URL('https://api.example/'), request);
    await expect(client.readReviewState({
      expectedMembershipId: ids.membership,
      installationId: ids.installation,
    })).resolves.toEqual({
      status: 'clear',
      expectedMembershipId: ids.membership,
      installationId: ids.installation,
      confirmedThroughSequence: 4,
    });
    request.handler = async () => response(200, {
      status: 'clear',
      expectedMembershipId: ids.membership,
      installationId: ids.installation,
      confirmedThroughSequence: -1,
    });
    await expect(client.readReviewState({
      expectedMembershipId: ids.membership,
      installationId: ids.installation,
    })).resolves.toEqual({ status: 'unavailable' });
  });
});

describe('Mobile FIFO scheduler and legacy migration', () => {
  it('clears only the exact encrypted marker covered by an authenticated server high-water proof',
    async () => {
      const clearReviewPendingSequence = vi.fn(async () => true);
      const database = fakeDatabase({
        queueCount: vi.fn(async () => 0),
        readReviewPendingSequence: vi.fn(async () => 3),
        readActiveCaptureContext: vi.fn(async () => ({
          membershipId: ids.membership,
          installationId: ids.installation,
        })),
        clearReviewPendingSequence,
      });
      const offline: OfflineLifecycleApiPort = {
        async ingest() { return { status: 'unavailable' }; },
        async reconcile() { return { status: 'ready', records: [] }; },
        async readReviewState() {
          return {
            status: 'clear',
            expectedMembershipId: ids.membership,
            installationId: ids.installation,
            confirmedThroughSequence: 3,
          };
        },
      };
      await expect(schedulerFor(database, offline).trigger('session_restored'))
        .resolves.toEqual({ status: 'idle', queueCount: 0 });
      expect(clearReviewPendingSequence).toHaveBeenCalledWith(3, 3);
    });

  it('recovers a lost response through reconciliation and never resubmits the event', async () => {
    const command = offlineCommand();
    const database = fakeDatabase({
      queueCount: vi.fn()
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(0),
      claimLegacyHead: vi.fn(async () => null),
      claimHead: vi.fn(async () => ({
        state: 'in_flight',
        attemptCount: 0,
        nextAttemptAt: null,
        command,
      })),
      acknowledgeHead: vi.fn(async () => undefined),
    });
    const ingest = vi.fn();
    const offline: OfflineLifecycleApiPort = {
      ingest,
      async reconcile(): Promise<OfflineReconciliationResult> {
        return {
          status: 'ready',
          records: [{
            workEventId: ids.event,
            receiptId: ids.receipt,
            deviceSequence: 1,
            result: {
              status: 'synchronized',
              decision: { status: 'time_entry_started', timeEntryId: ids.timeEntry },
            },
          }],
        };
      },
      async readReviewState() { return { status: 'unavailable' }; },
    };
    const scheduler = schedulerFor(database, offline);

    await expect(scheduler.trigger('runtime_start')).resolves.toEqual({
      status: 'server_decision',
      queueCount: 0,
      workEventId: ids.event,
      decision: { status: 'time_entry_started', timeEntryId: ids.timeEntry },
    });
    expect(ingest).not.toHaveBeenCalled();
    expect(database.acknowledgeHead).toHaveBeenCalledWith({
      workEventId: ids.event,
      receiptId: ids.receipt,
      deviceSequence: 1,
    }, 'synchronized');
  });

  it('persists a review result before deletion and never downgrades it on an empty later trigger',
    async () => {
      const command = offlineCommand();
      let reviewPendingSequence: number | null = null;
      const database = fakeDatabase({
        queueCount: vi.fn()
          .mockResolvedValueOnce(1)
          .mockResolvedValueOnce(0)
          .mockResolvedValueOnce(0),
        claimLegacyHead: vi.fn(async () => null),
        claimHead: vi.fn(async () => ({
          state: 'in_flight',
          attemptCount: 0,
          nextAttemptAt: null,
          command,
        })),
        acknowledgeHead: vi.fn(async (
          identity: { readonly deviceSequence: number },
          status: 'synchronized' | 'review_pending',
        ) => {
          if (status === 'review_pending') {
            reviewPendingSequence ??= identity.deviceSequence;
          }
        }),
        readReviewPendingSequence: vi.fn(async () => reviewPendingSequence),
      });
      const offline: OfflineLifecycleApiPort = {
        async reconcile() { return { status: 'ready', records: [] }; },
        async readReviewState() { return { status: 'unavailable' }; },
        async ingest() {
          return {
            status: 'review_pending',
            idempotentRetry: false,
            reason: 'historical_configuration_not_valid',
            workEventId: ids.event,
            receiptId: ids.receipt,
            deviceSequence: 1,
          };
        },
      };
      const scheduler = schedulerFor(database, offline);

      await expect(scheduler.trigger('network_hint')).resolves.toEqual({
        status: 'review_pending',
        queueCount: 0,
        workEventId: ids.event,
      });
      expect(database.acknowledgeHead).toHaveBeenCalledWith({
        workEventId: ids.event,
        receiptId: ids.receipt,
        deviceSequence: 1,
      }, 'review_pending');
      await expect(scheduler.trigger('session_restored')).resolves.toEqual({
        status: 'review_pending',
        queueCount: 0,
      });
      expect(database.claimHead).toHaveBeenCalledTimes(1);
    });

  it('coalesces overlapping triggers into one flight and retains the exact FIFO head', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const command = offlineCommand();
    const database = fakeDatabase({
      queueCount: vi.fn(async () => 1),
      claimLegacyHead: vi.fn(async () => null),
      claimHead: vi.fn(async () => ({
        state: 'in_flight',
        attemptCount: 0,
        nextAttemptAt: null,
        command,
      })),
      retainHeadForRetry: vi.fn(async () => undefined),
    });
    const offline: OfflineLifecycleApiPort = {
      async ingest() { return { status: 'unavailable' }; },
      async readReviewState() { return { status: 'unavailable' }; },
      async reconcile() {
        await gate;
        return { status: 'ready', records: [] };
      },
    };
    const timer = { schedule: vi.fn(() => 1), cancel: vi.fn() };
    const scheduler = schedulerFor(database, offline, timer);
    const first = scheduler.trigger('foreground');
    const second = scheduler.trigger('network_hint');
    expect(second).toBe(first);
    release();
    await first;
    expect(database.claimHead).toHaveBeenCalledTimes(1);
    expect(database.retainHeadForRetry).toHaveBeenCalledWith(
      {
        workEventId: ids.event,
        receiptId: ids.receipt,
        deviceSequence: 1,
      },
      1,
      10_000,
    );
  });

  it('uses full jitter with the accepted cap and exact Retry-After precedence', () => {
    expect(retryDelay(0, undefined, () => 0)).toBe(0);
    expect(retryDelay(0, undefined, () => 0.5)).toBe(1_000);
    expect(retryDelay(30, undefined, () => 0.999999)).toBeLessThanOrEqual(300_000);
    expect(retryDelay(4, 17, () => 0)).toBe(17_000);
  });

  it('imports and reads back exact v2 evidence before clearing the legacy key', async () => {
    const evidence = legacyEvidence();
    const clear = vi.fn(async () => undefined);
    const outbox: LifecycleEvidenceOutbox = {
      async read() { return evidence; },
      async write() {},
      clear,
    };
    const database = fakeDatabase({
      importLegacyReplayable: vi.fn(async () => ({ status: 'ready' })),
      verifyLegacyReplayable: vi.fn(async () => true),
      hasProtectedLegacy: vi.fn(async () => false),
    });
    const importer = new LegacyLifecycleEvidenceImporter(
      outbox,
      database,
      () => new Date('2026-07-18T12:00:00.000Z'),
    );

    await expect(importer.importOnce()).resolves.toEqual({ status: 'ready' });
    expect(database.verifyLegacyReplayable).toHaveBeenCalledWith(evidence.submission);
    expect(clear).toHaveBeenCalledWith(evidence);
  });

  it('retains the original legacy key and blocks capture when exact clear is ambiguous', async () => {
    const evidence = legacyEvidence();
    const outbox: LifecycleEvidenceOutbox = {
      async read() { return evidence; },
      async write() {},
      async clear() { throw new Error('synthetic clear interruption'); },
    };
    const database = fakeDatabase({
      importLegacyReplayable: vi.fn(async () => ({ status: 'ready' })),
      verifyLegacyReplayable: vi.fn(async () => true),
      hasProtectedLegacy: vi.fn(async () => false),
    });
    await expect(new LegacyLifecycleEvidenceImporter(outbox, database).importOnce())
      .resolves.toEqual({ status: 'protected', reason: 'legacy_clear_ambiguous' });
  });
});

class FakeRequest implements AuthenticatedJsonPostPort {
  calls: Array<{ endpoint: URL; body: string; options: unknown }> = [];

  constructor(
    public handler: (
      endpoint: URL,
      body: string,
    ) => Promise<AuthenticatedHttpResult>,
  ) {}

  async post(endpoint: URL, body: string, options?: unknown): Promise<AuthenticatedHttpResult> {
    this.calls.push({ endpoint, body, options });
    return this.handler(endpoint, body);
  }
}

function response(
  statusCode: number,
  body: unknown,
  retryAfterSeconds?: number,
): AuthenticatedHttpResult {
  return {
    status: 'response',
    statusCode,
    contentType: 'application/json',
    body: JSON.stringify(body),
    ...(retryAfterSeconds === undefined ? {} : { retryAfterSeconds }),
  };
}

function leasePage(): OfflineCaptureLeasePage {
  const items = [
    {
      itemId: ids.item1,
      lookup: '1'.repeat(64),
      assignmentId: ids.assignment1,
      nfcTagId: ids.tag1,
      targetType: 'customer' as const,
      targetId: ids.customer1,
      displayName: 'Kunde Eins',
    },
    {
      itemId: ids.item2,
      lookup: '2'.repeat(64),
      assignmentId: ids.assignment2,
      nfcTagId: ids.tag2,
      targetType: 'customer' as const,
      targetId: ids.customer2,
      displayName: 'Kunde Zwei',
    },
  ];
  return Object.freeze({
    leaseId: ids.lease,
    installationId: ids.installation,
    identityBindingId: ids.identity,
    userId: ids.user,
    organizationId: ids.organization,
    membershipId: ids.membership,
    membershipRowVersion: 1,
    role: 'employee',
    issuedAt: '2026-07-18T10:00:00.000Z',
    expiresAt: '2026-07-18T22:00:00.000Z',
    configurationRevision: '3'.repeat(64),
    itemCount: items.length,
    serializedBytes: new TextEncoder().encode(JSON.stringify(items)).byteLength,
    manifestDigest: mobileManifestDigest(items),
    items: Object.freeze(items),
    nextCursor: null,
  });
}

function leasePageV2(): OfflineCaptureLeasePageV2 {
  const items = [
    {
      itemType: 'nfc_assignment' as const,
      itemId: ids.item1,
      lookup: '1'.repeat(64),
      assignmentId: ids.assignment1,
      nfcTagId: ids.tag1,
      targetType: 'customer' as const,
      targetId: ids.customer1,
      displayName: 'Kunde Eins',
      assignmentRowVersion: 1,
      targetRowVersion: 1,
    },
    {
      itemType: 'manual_target' as const,
      itemId: ids.item2,
      targetType: 'project' as const,
      targetId: ids.customer2,
      displayName: 'Projekt Zwei',
      targetRowVersion: 2,
    },
  ];
  return Object.freeze({
    leaseSchemaVersion: 2,
    manifestVersion: 2,
    leaseId: ids.lease,
    installationId: ids.installation,
    identityBindingId: ids.identity,
    userId: ids.user,
    organizationId: ids.organization,
    membershipId: ids.membership,
    membershipRowVersion: 1,
    role: 'employee',
    issuedAt: '2026-07-18T10:00:00.000Z',
    expiresAt: '2026-07-18T22:00:00.000Z',
    configurationRevision: '3'.repeat(64),
    itemCount: items.length,
    serializedBytes: new TextEncoder().encode(JSON.stringify(items)).byteLength,
    manifestDigest: mobileManifestDigestV2(items),
    items: Object.freeze(items),
    nextCursor: null,
  });
}

function offlineCommand(): OfflineLifecycleEventCommand {
  return {
    organizationId: ids.organization,
    expectedMembershipId: ids.membership,
    leaseId: ids.lease,
    leaseItemId: ids.item1,
    installationBinding,
    deviceSequence: 1,
    provenanceVersion: 1,
    clock: {
      bootMarker: 'boot-1',
      monotonicAnchorMilliseconds: 100,
      monotonicDeltaMilliseconds: 200,
      wallClockAnchor: '2026-07-18T10:00:00.000Z',
      clockProofStatus: 'verified_same_boot',
      clockProofVersion: 1,
    },
    workEvent: {
      id: ids.event,
      assignmentId: ids.assignment1,
      nfcTagId: ids.tag1,
      target: { targetType: 'customer', targetId: ids.customer1 },
      occurredAt: '2026-07-18T10:00:00.200Z',
    },
    receipt: { id: ids.receipt, attemptNumber: 1 },
  };
}

function fakeDatabase(
  overrides: Record<string, unknown>,
): OfflineCaptureDatabase & Record<string, ReturnType<typeof vi.fn>> {
  return {
    readReviewPendingSequence: vi.fn(async () => null),
    ...overrides,
  } as unknown as OfflineCaptureDatabase & Record<string, ReturnType<typeof vi.fn>>;
}

function schedulerFor(
  database: OfflineCaptureDatabase,
  offline: OfflineLifecycleApiPort,
  timer = { schedule: vi.fn(() => 1), cancel: vi.fn() },
): OfflineSyncScheduler {
  const legacy: LifecycleEventApiPort = {
    async ingest(): Promise<LifecycleEventResult> {
      return { status: 'transient_failure' };
    },
  };
  return new OfflineSyncScheduler(
    database,
    offline,
    legacy,
    { async rejectOfflineCapture() {} },
    () => 10_000,
    () => 0,
    timer,
  );
}

function legacyEvidence(): PendingLifecycleEvidence {
  return {
    kind: 'replayable',
    binding: {
      organizationId: ids.organization as PendingLifecycleEvidence['binding']['organizationId'],
      userId: ids.user as PendingLifecycleEvidence['binding']['userId'],
      membershipId: ids.membership as PendingLifecycleEvidence['binding']['membershipId'],
    },
    submission: {
      mode: 'canonical',
      expectedMembershipId: ids.membership as PendingLifecycleEvidence['submission']['expectedMembershipId'],
      command: offlineCommandToLegacy(),
    },
  };
}

function offlineCommandToLegacy(): PendingLifecycleEvidence['submission']['command'] {
  const command = offlineCommand();
  return {
    organizationId: command.organizationId as PendingLifecycleEvidence['submission']['command']['organizationId'],
    workEvent: command.workEvent as PendingLifecycleEvidence['submission']['command']['workEvent'],
    receipt: command.receipt,
  };
}
