import { describe, expect, it, vi } from 'vitest';
import {
  createCanonicalNfcUidPayload,
  createTimestamp,
  type NfcScanCaptureResult,
} from '@taptime/core';
import type {
  MobileSessionState,
  ProductSessionContext,
} from '../../src/auth/contracts';
import type { NfcCaptureLifecyclePort } from '../../src/nfc/RnNfcScanAdapter';
import type { ProductScanSessionSnapshot } from '../../src/scan/contracts';
import type { LifecycleEvidenceOutbox } from '../../src/scan/LifecycleEvidenceOutbox';
import { AndroidMonotonicClock } from '../../src/offline/AndroidMonotonicClock';
import {
  OfflineCaptureCoordinator,
  type OfflineCaptureSessionReader,
} from '../../src/offline/OfflineCaptureCoordinator';
import { OfflineCaptureDatabase } from '../../src/offline/OfflineCaptureDatabase';
import type { OfflineCaptureLeaseApiPort } from '../../src/offline/OfflineCaptureLeaseClient';
import { OfflineInstallationIdentityStore } from '../../src/offline/OfflineInstallationIdentityStore';
import { OfflineSyncScheduler } from '../../src/offline/OfflineSyncScheduler';
import { encodeBase64Url } from '../../src/offline/encoding';

const ids = {
  user: '10000000-0000-4000-8000-000000000001',
  organization: '20000000-0000-4000-8000-000000000001',
  membership: '30000000-0000-4000-8000-000000000001',
  command: '40000000-0000-4000-8000-000000000001',
  event: '50000000-0000-4000-8000-000000000001',
  receipt: '60000000-0000-4000-8000-000000000001',
  lease: '70000000-0000-4000-8000-000000000001',
  installation: '80000000-0000-4000-8000-000000000001',
  identity: '90000000-0000-4000-8000-000000000001',
  item: 'a0000000-0000-4000-8000-000000000001',
  assignment: 'b0000000-0000-4000-8000-000000000001',
  tag: 'c0000000-0000-4000-8000-000000000001',
  customer: 'd0000000-0000-4000-8000-000000000001',
} as const;

const session: ProductSessionContext = {
  userId: ids.user,
  organizationId: ids.organization,
  membershipId: ids.membership,
  role: 'employee',
};
const snapshot: ProductScanSessionSnapshot = { generation: 1, session };
const binding = encodeBase64Url(new Uint8Array(32).fill(6));

describe('OfflineCaptureCoordinator', () => {
  it('persists a changed-boot scan as review-only before triggering synchronization', async () => {
    const order: string[] = [];
    const appendEvent = vi.fn(async (draft) => {
      order.push('append');
      return { status: 'ready', command: { ...draft, deviceSequence: 1 } };
    });
    const database = databaseFake({
      initialize: vi.fn(async () => ({ status: 'ready' })),
      hasProtectedLegacy: vi.fn(async () => false),
      bindOwner: vi.fn(async () => ({ status: 'ready' })),
      activateLease: vi.fn(async () => ({ status: 'ready' })),
      queueCount: vi.fn(async () => 1),
      lookupActiveItem: vi.fn(async () => ({
        leaseId: ids.lease,
        leaseItemId: ids.item,
        assignmentId: ids.assignment,
        nfcTagId: ids.tag,
        targetType: 'customer',
        targetId: ids.customer,
        displayName: 'Kunde',
        issuedAt: '2026-07-18T10:00:00.000Z',
        expiresAt: '2026-07-18T22:00:00.000Z',
        activationBootMarker: 'boot-1',
        activationMonotonicMilliseconds: 100,
      })),
      readActiveCaptureContext: vi.fn(async () => activeContext()),
      appendEvent,
      invalidateCapture: vi.fn(async () => undefined),
      close: vi.fn(async () => undefined),
    });
    const scheduler = schedulerFake(order);
    const monotonicSamples = [
      { bootMarker: 'boot-1', elapsedRealtimeMilliseconds: 100 },
      { bootMarker: 'boot-2', elapsedRealtimeMilliseconds: 50 },
    ];
    const coordinator = new OfflineCaptureCoordinator(
      {
        async scan(): Promise<NfcScanCaptureResult> {
          return {
            status: 'captured',
            payload: createCanonicalNfcUidPayload('04AABBCC'),
            capturedAt: createTimestamp('2026-07-18T10:05:00.000Z'),
          };
        },
      },
      nfcLifecycle(),
      sessionReader({ status: 'authenticated', session }, snapshot),
      identityStore(),
      () => database,
      leaseClient(),
      new AndroidMonotonicClock({
        async sample() { return monotonicSamples.shift()!; },
      }),
      () => scheduler,
      emptyOutbox(),
      sequentialUuid([ids.command, ids.event, ids.receipt]),
    );

    await coordinator.start();
    expect(coordinator.getState()).toEqual({ status: 'ready', outcome: null });
    await coordinator.scan();
    const draft = appendEvent.mock.calls[0]![0];
    expect(draft.clock).toMatchObject({
      bootMarker: 'boot-2',
      monotonicDeltaMilliseconds: 0,
      clockProofStatus: 'review_only',
    });
    expect(draft.workEvent).toMatchObject({
      id: ids.event,
      assignmentId: ids.assignment,
      nfcTagId: ids.tag,
    });
    expect(order.indexOf('append')).toBeLessThan(order.lastIndexOf('trigger'));
    expect(coordinator.getState()).toEqual({ status: 'saved_locally', queueCount: 1 });
  });

  it('opens cold-start capture only for a typed transient context failure and same-boot lease',
    async () => {
      const database = databaseFake({
        initialize: vi.fn(async () => ({ status: 'ready' })),
        hasProtectedLegacy: vi.fn(async () => false),
        readActiveCaptureContext: vi.fn(async () => activeContext()),
        queueCount: vi.fn(async () => 0),
        close: vi.fn(async () => undefined),
      });
      const issueComplete = vi.fn();
      const coordinator = new OfflineCaptureCoordinator(
        { async scan() { return { status: 'cancelled' }; } },
        nfcLifecycle(),
        sessionReader({ status: 'context_unavailable' }, null),
        identityStore(),
        () => database,
        { issueComplete },
        new AndroidMonotonicClock({
          async sample() {
            return { bootMarker: 'boot-1', elapsedRealtimeMilliseconds: 600_100 };
          },
        }),
        () => schedulerFake([]),
        emptyOutbox(),
        sequentialUuid([]),
        { bind() {} },
        () => new Date('2026-07-18T10:10:00.000Z'),
      );

      await coordinator.start();
      expect(coordinator.getState()).toEqual({
        status: 'offline_ready',
        queueCount: 0,
        outcome: null,
      });
      expect(issueComplete).not.toHaveBeenCalled();
    });

  it.each([
    [{ status: 'context_unavailable' }, null],
    [
      { status: 'runtime_unavailable', reason: 'authentication_unavailable' },
      activeContext(),
    ],
    [
      { status: 'runtime_unavailable', reason: 'storage_unavailable' },
      activeContext(),
    ],
  ] satisfies Array<[MobileSessionState, ReturnType<typeof activeContext> | null]>)(
    'keeps cold-start capture closed for session $status without an eligible local context',
    async (sessionState, localContext) => {
      const database = databaseFake({
        initialize: vi.fn(async () => ({ status: 'ready' })),
        hasProtectedLegacy: vi.fn(async () => false),
        readActiveCaptureContext: vi.fn(async () => localContext),
        queueCount: vi.fn(async () => 0),
        close: vi.fn(async () => undefined),
      });
      const coordinator = new OfflineCaptureCoordinator(
        { async scan() { return { status: 'cancelled' }; } },
        nfcLifecycle(),
        sessionReader(sessionState, null),
        identityStore(),
        () => database,
        leaseClient(),
        new AndroidMonotonicClock({
          async sample() {
            return { bootMarker: 'boot-1', elapsedRealtimeMilliseconds: 600_100 };
          },
        }),
        () => schedulerFake([]),
        emptyOutbox(),
        sequentialUuid([]),
        { bind() {} },
        () => new Date('2026-07-18T10:10:00.000Z'),
      );

      await coordinator.start();
      expect(coordinator.getState()).toEqual({ status: 'inactive' });
    },
  );

  it('retries a suspended session before scheduling work on a network hint', async () => {
    const database = databaseFake({
      initialize: vi.fn(async () => ({ status: 'ready' })),
      hasProtectedLegacy: vi.fn(async () => false),
      readActiveCaptureContext: vi.fn(async () => activeContext()),
      queueCount: vi.fn(async () => 0),
      close: vi.fn(async () => undefined),
    });
    const scheduler = schedulerFake([]);
    const trigger = vi.mocked(scheduler.trigger);
    const retryComplete = deferred<void>();
    const retryContext = vi.fn(() => retryComplete.promise);
    const coordinator = new OfflineCaptureCoordinator(
      { async scan() { return { status: 'cancelled' }; } },
      nfcLifecycle(),
      {
        ...sessionReader({ status: 'context_unavailable' }, null),
        retryContext,
      },
      identityStore(),
      () => database,
      leaseClient(),
      new AndroidMonotonicClock({
        async sample() {
          return { bootMarker: 'boot-1', elapsedRealtimeMilliseconds: 600_100 };
        },
      }),
      () => scheduler,
      emptyOutbox(),
      sequentialUuid([]),
      { bind() {} },
      () => new Date('2026-07-18T10:10:00.000Z'),
    );
    await coordinator.start();
    trigger.mockClear();

    coordinator.triggerNetworkHint();
    expect(retryContext).toHaveBeenCalledTimes(1);
    expect(trigger).not.toHaveBeenCalled();
    retryComplete.resolve();

    await vi.waitFor(() => expect(trigger).toHaveBeenCalledWith('network_hint'));
  });

  it('invalidates capture and removes only the active lookup key on explicit logout', async () => {
    const database = databaseFake({
      initialize: vi.fn(async () => ({ status: 'ready' })),
      hasProtectedLegacy: vi.fn(async () => false),
      queueCount: vi.fn(async () => 0),
      invalidateCapture: vi.fn(async () => undefined),
      close: vi.fn(async () => undefined),
    });
    const removeActiveLookupKey = vi.fn(async () => undefined);
    const coordinator = new OfflineCaptureCoordinator(
      { async scan() { return { status: 'cancelled' }; } },
      nfcLifecycle(),
      sessionReader({ status: 'unauthenticated', reason: 'not_signed_in' }, null),
      identityStore(removeActiveLookupKey),
      () => database,
      leaseClient(),
      new AndroidMonotonicClock({
        async sample() { return { bootMarker: 'boot-1', elapsedRealtimeMilliseconds: 100 }; },
      }),
      () => schedulerFake([]),
      emptyOutbox(),
      sequentialUuid([]),
    );
    await coordinator.start();
    await coordinator.onExplicitLogout();
    expect(database.invalidateCapture).toHaveBeenCalledTimes(1);
    expect(removeActiveLookupKey).toHaveBeenCalledTimes(1);
    expect(coordinator.getState()).toEqual({ status: 'inactive' });
  });
});

function databaseFake(
  methods: Record<string, ReturnType<typeof vi.fn>>,
): OfflineCaptureDatabase & Record<string, ReturnType<typeof vi.fn>> {
  return methods as unknown as OfflineCaptureDatabase
    & Record<string, ReturnType<typeof vi.fn>>;
}

function schedulerFake(order: string[]): OfflineSyncScheduler {
  const listeners = new Set<() => void>();
  const scheduler = {
    start: vi.fn(),
    stop: vi.fn(),
    subscribe: vi.fn((listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }),
    getState: vi.fn(() => ({ status: 'idle', queueCount: 0 })),
    trigger: vi.fn(async () => {
      order.push('trigger');
      return { status: 'idle', queueCount: 0 };
    }),
  };
  return scheduler as unknown as OfflineSyncScheduler;
}

function identityStore(removeActiveLookupKey = vi.fn(async () => undefined)) {
  return {
    async loadOrCreate() {
      return {
        status: 'ready',
        secrets: {
          installationBinding: binding,
          lookupKey: new Uint8Array(32).fill(7),
          databaseKey: new Uint8Array(32).fill(8),
        },
      };
    },
    removeActiveLookupKey,
  } as unknown as OfflineInstallationIdentityStore;
}

function leaseClient(): OfflineCaptureLeaseApiPort {
  return {
    async issueComplete() {
      const items = [{
        itemId: ids.item,
        lookup: '1'.repeat(64),
        assignmentId: ids.assignment,
        nfcTagId: ids.tag,
        targetType: 'customer' as const,
        targetId: ids.customer,
        displayName: 'Kunde',
      }];
      return {
        status: 'ready',
        idempotentRetry: false,
        page: {
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
          configurationRevision: '2'.repeat(64),
          itemCount: 1,
          serializedBytes: new TextEncoder().encode(JSON.stringify(items)).byteLength,
          manifestDigest: '3'.repeat(64),
          items,
          nextCursor: null,
        },
      };
    },
  };
}

function sessionReader(
  state: MobileSessionState,
  authenticatedSnapshot: ProductScanSessionSnapshot | null,
): OfflineCaptureSessionReader {
  return {
    getState: () => state,
    capture: () => authenticatedSnapshot,
    isCurrent: (candidate) => candidate === authenticatedSnapshot,
    subscribe: () => () => undefined,
    retryContext: vi.fn(async () => undefined),
  };
}

function nfcLifecycle(): NfcCaptureLifecyclePort {
  return {
    async checkCapability() { return 'ready'; },
    async cancelCapture() {},
    async stop() {},
  };
}

function emptyOutbox(): LifecycleEvidenceOutbox {
  return {
    async read() { return null; },
    async write() {},
    async clear() {},
  };
}

function sequentialUuid(values: readonly string[]): () => string {
  let index = 0;
  return () => values[index++] ?? 'ffffffff-ffff-4fff-8fff-ffffffffffff';
}

function deferred<Value>() {
  let resolve!: (value: Value) => void;
  const promise = new Promise<Value>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function activeContext() {
  return {
    organizationId: ids.organization,
    userId: ids.user,
    membershipId: ids.membership,
    role: 'employee' as const,
    leaseId: ids.lease,
    installationId: ids.installation,
    identityBindingId: ids.identity,
    issuedAt: '2026-07-18T10:00:00.000Z',
    expiresAt: '2026-07-18T22:00:00.000Z',
    activationBootMarker: 'boot-1',
    activationMonotonicMilliseconds: 100,
  };
}
