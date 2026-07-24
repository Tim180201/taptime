import { describe, expect, it, vi } from 'vitest';
vi.mock('react-native', () => ({
  AppState: {
    currentState: 'background',
    addEventListener: () => ({ remove() {} }),
  },
}));
vi.mock('expo-network', () => ({
  addNetworkStateListener: () => ({ remove() {} }),
}));
vi.mock('../../src/offline/registerOfflineBackgroundTask', () => ({
  registerOfflineBackgroundTask: async () => undefined,
}));

import {
  createCanonicalNfcUidPayload,
  createTimestamp,
  type NfcScanCaptureResult,
} from '@taptime/core';
import { MobileSessionCoordinator } from '../../src/auth/MobileSessionCoordinator';
import type {
  BackendSessionPort,
  BackendSessionResolution,
  EmployeeEnrollmentPort,
  ProviderAuthEvent,
  ProviderAuthPort,
  ProviderRefreshResult,
  ProviderSignInResult,
  RefreshTokenStore,
} from '../../src/auth/contracts';
import { AndroidMonotonicClock } from '../../src/offline/AndroidMonotonicClock';
import {
  OfflineCaptureCoordinator,
  type OfflineCaptureSessionReader,
} from '../../src/offline/OfflineCaptureCoordinator';
import {
  OfflineCaptureDatabase,
  type ActiveOfflineCaptureContext,
  type OfflineLifecycleEventDraft,
} from '../../src/offline/OfflineCaptureDatabase';
import type { OfflineCaptureLeaseApiPort } from '../../src/offline/OfflineCaptureLeaseClient';
import { OfflineInstallationIdentityStore } from '../../src/offline/OfflineInstallationIdentityStore';
import {
  OfflineSchedulingLifecycle,
  type OfflineSchedulingAppStatePort,
} from '../../src/offline/OfflineSchedulingLifecycle';
import { OfflineSyncScheduler } from '../../src/offline/OfflineSyncScheduler';
import type { LifecycleEvidenceOutbox } from '../../src/scan/LifecycleEvidenceOutbox';
import type { ProductScanSessionSnapshot } from '../../src/scan/contracts';
import { encodeBase64Url } from '../../src/offline/encoding';

const ids = {
  user: '10000000-0000-4000-8000-000000000001',
  organization: '20000000-0000-4000-8000-000000000001',
  membership: '30000000-0000-4000-8000-000000000001',
  event: '40000000-0000-4000-8000-000000000001',
  receipt: '50000000-0000-4000-8000-000000000001',
  lease: '60000000-0000-4000-8000-000000000001',
  installation: '70000000-0000-4000-8000-000000000001',
  identity: '80000000-0000-4000-8000-000000000001',
  item: '90000000-0000-4000-8000-000000000001',
  assignment: 'a0000000-0000-4000-8000-000000000001',
  tag: 'b0000000-0000-4000-8000-000000000001',
  customer: 'c0000000-0000-4000-8000-000000000001',
} as const;

describe('OfflineSchedulingLifecycle capture integration', () => {
  it('keeps exactly one owner-bound offline-store append through an unchanged foreground retry',
    async () => {
      const harness = await createHarness();
      harness.nfc.cancelCapture.mockClear();
      harness.scheduler.trigger.mockClear();

      const scan = harness.capture.scan();
      expect(harness.capture.getState()).toEqual({ status: 'scanning' });
      harness.appState.emit('active');

      await vi.waitFor(() => expect(harness.provider.refreshCalls).toBe(2));
      await vi.waitFor(() => (
        expect(harness.scheduler.trigger).toHaveBeenCalledWith('foreground')
      ));
      expect(harness.session.getState()).toEqual({ status: 'context_unavailable' });
      expect(harness.nfc.cancelCapture).not.toHaveBeenCalled();
      harness.nfc.deliver(capturedTag());

      await scan;
      expect(harness.database.appendEvent).toHaveBeenCalledTimes(1);
      expect(harness.databaseFactory).toHaveBeenCalledTimes(1);
      expect(harness.databaseFactory.mock.calls[0]![0]).toEqual(new Uint8Array(32).fill(8));
      expect(harness.capture.getState()).toEqual({ status: 'saved_locally', queueCount: 1 });
      expect(harness.scheduler.trigger).toHaveBeenCalledWith('foreground');
      await harness.stop();
    });

  it('cancels when new provider credentials end in the same public unavailable status',
    async () => {
      const harness = await createHarness();
      harness.provider.refreshImplementation = async () => ({
        status: 'refreshed',
        tokens: { accessToken: 'new-access', refreshToken: 'new-refresh' },
      });
      harness.backend.implementation = async () => ({ status: 'unavailable' });
      harness.nfc.cancelCapture.mockClear();

      const scan = harness.capture.scan();
      harness.appState.emit('active');
      await vi.waitFor(() => expect(harness.provider.refreshCalls).toBe(2));
      await vi.waitFor(() => expect(harness.nfc.cancelCapture).toHaveBeenCalledTimes(1));
      expect(harness.session.getState()).toEqual({ status: 'context_unavailable' });
      expect(harness.nfc.cancelCapture).toHaveBeenCalledTimes(1);

      harness.nfc.deliver(capturedTag());
      await scan;
      expect(harness.database.appendEvent).not.toHaveBeenCalled();
      expect(harness.capture.getState()).not.toEqual({ status: 'saved_locally', queueCount: 1 });
      await harness.stop();
    });

  it('keeps a late native result fail-closed after explicit logout', async () => {
    const harness = await createHarness();
    harness.nfc.cancelCapture.mockClear();

    const scan = harness.capture.scan();
    await harness.session.signOut();
    expect(harness.session.getState()).toEqual({ status: 'signed_out' });
    expect(harness.nfc.cancelCapture).toHaveBeenCalled();

    harness.nfc.deliver(capturedTag());
    await scan;
    expect(harness.database.appendEvent).not.toHaveBeenCalled();
    expect(harness.database.invalidateCapture).toHaveBeenCalled();
    expect(harness.removeActiveLookupKey).toHaveBeenCalledTimes(1);
    await harness.stop();
  });

  it('protects the queue when the owner-bound installation context changes during capture',
    async () => {
      const harness = await createHarness();
      harness.database.readActiveCaptureContext.mockResolvedValue({
        ...activeContext(),
        installationId: '70000000-0000-4000-8000-000000000099',
      });

      const scan = harness.capture.scan();
      harness.nfc.deliver(capturedTag());
      await scan;

      expect(harness.database.appendEvent).not.toHaveBeenCalled();
      expect(harness.capture.getState()).toEqual({
        status: 'protected_pending',
        reason: 'local_evidence_protected',
      });
      await harness.stop();
    });
});

async function createHarness() {
  const provider = new OfflineProvider();
  const store = new MemoryRefreshTokenStore('retained-refresh');
  const backend = new BackendSession();
  const session = new MobileSessionCoordinator(
    provider,
    store,
    backend,
    unavailableEnrollment,
  );
  await session.start();
  expect(session.getState()).toEqual({ status: 'context_unavailable' });

  let queueCount = 0;
  const readActiveCaptureContext = vi.fn(async () => activeContext());
  const appendEvent = vi.fn(async (draft: OfflineLifecycleEventDraft) => {
    queueCount += 1;
    return {
      status: 'ready' as const,
      command: { ...draft, deviceSequence: queueCount },
    };
  });
  const database = {
    initialize: vi.fn(async () => ({ status: 'ready' as const })),
    hasProtectedLegacy: vi.fn(async () => false),
    readReviewPendingSequence: vi.fn(async () => null),
    readActiveCaptureContext,
    lookupActiveItem: vi.fn(async () => activeItem()),
    appendEvent,
    queueCount: vi.fn(async () => queueCount),
    invalidateCapture: vi.fn(async () => undefined),
    close: vi.fn(async () => undefined),
  } as unknown as OfflineCaptureDatabase & {
    appendEvent: typeof appendEvent;
    invalidateCapture: ReturnType<typeof vi.fn>;
    readActiveCaptureContext: typeof readActiveCaptureContext;
  };
  const databaseFactory = vi.fn((_databaseKey: Uint8Array) => database);
  const removeActiveLookupKey = vi.fn(async () => undefined);
  const scheduler = schedulerFake();
  const nfc = new DeferredNfcCapture();
  const sessionReader: OfflineCaptureSessionReader = {
    capture: () => session.captureAuthenticatedSessionSnapshot(),
    isCurrent: (snapshot: ProductScanSessionSnapshot) => (
      session.isAuthenticatedSessionSnapshotCurrent(snapshot)
    ),
    getState: () => session.getState(),
    isOfflineCaptureRestorationAllowed: () => session.isOfflineCaptureRestorationAllowed(),
    captureOfflineRestorationSnapshot: () => session.captureOfflineRestorationSnapshot(),
    isOfflineRestorationSnapshotCurrent: (snapshot) => (
      session.isOfflineRestorationSnapshotCurrent(snapshot)
    ),
    subscribe: (listener) => session.subscribe(listener),
    retryContext: () => session.retryContext(),
  };
  const capture = new OfflineCaptureCoordinator(
    nfc,
    nfc,
    sessionReader,
    {
      async loadOrCreate() {
        return {
          status: 'ready' as const,
          secrets: {
            installationBinding: encodeBase64Url(new Uint8Array(32).fill(6)),
            lookupKey: new Uint8Array(32).fill(7),
            databaseKey: new Uint8Array(32).fill(8),
          },
        };
      },
      removeActiveLookupKey,
    } as unknown as OfflineInstallationIdentityStore,
    databaseFactory,
    unavailableLeaseClient,
    new AndroidMonotonicClock({
      async sample() {
        return { bootMarker: 'boot-1', elapsedRealtimeMilliseconds: 600_100 };
      },
    }),
    () => scheduler,
    emptyOutbox,
    sequentialUuid([ids.event, ids.receipt]),
    { bind() {} },
    () => new Date('2026-07-18T10:10:00.000Z'),
  );
  await capture.start();
  expect(capture.getState()).toEqual({
    status: 'offline_ready',
    queueCount: 0,
    outcome: null,
  });

  const appState = new TestAppState();
  const lifecycle = new OfflineSchedulingLifecycle(
    capture,
    appState,
    { addNetworkStateListener: () => ({ remove() {} }) },
    async () => undefined,
  );
  lifecycle.start();
  return {
    provider,
    backend,
    session,
    capture,
    nfc,
    database,
    databaseFactory,
    removeActiveLookupKey,
    scheduler,
    appState,
    async stop() {
      lifecycle.stop();
      await capture.stop();
      session.stop();
    },
  };
}

class OfflineProvider implements ProviderAuthPort {
  refreshCalls = 0;
  refreshImplementation: () => Promise<ProviderRefreshResult> =
    async () => {
      throw new Error('synthetic offline');
    };
  private listener: ((event: ProviderAuthEvent) => void) | null = null;

  async signInWithPassword(): Promise<ProviderSignInResult> {
    return { status: 'invalid_credentials' };
  }

  async refreshSession(): Promise<ProviderRefreshResult> {
    this.refreshCalls += 1;
    return this.refreshImplementation();
  }

  async signOutLocal(): Promise<void> {}

  subscribe(listener: (event: ProviderAuthEvent) => void): () => void {
    this.listener = listener;
    return () => {
      if (this.listener === listener) this.listener = null;
    };
  }

  async startAutoRefresh(): Promise<void> {}

  async stopAutoRefresh(): Promise<void> {}
}

class MemoryRefreshTokenStore implements RefreshTokenStore {
  constructor(private value: string | null) {}

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async read(): Promise<string | null> {
    return this.value;
  }

  async write(value: string): Promise<void> {
    this.value = value;
  }

  async clear(): Promise<void> {
    this.value = null;
  }
}

class BackendSession implements BackendSessionPort {
  implementation: () => Promise<BackendSessionResolution> =
    async () => ({ status: 'unavailable' });

  async resolve(): Promise<BackendSessionResolution> {
    return this.implementation();
  }
}

class DeferredNfcCapture {
  readonly cancelCapture = vi.fn(async () => undefined);
  private pending: ReturnType<typeof deferred<NfcScanCaptureResult>> | null = null;

  async checkCapability() {
    return 'ready' as const;
  }

  scan(): Promise<NfcScanCaptureResult> {
    this.pending = deferred<NfcScanCaptureResult>();
    return this.pending.promise;
  }

  deliver(result: NfcScanCaptureResult): void {
    this.pending?.resolve(result);
    this.pending = null;
  }

  async stop(): Promise<void> {}
}

class TestAppState implements OfflineSchedulingAppStatePort {
  currentState: 'active' | 'background' | 'inactive' | 'unknown' | 'extension' = 'background';
  private listener: ((
    state: 'active' | 'background' | 'inactive' | 'unknown' | 'extension',
  ) => void) | null = null;

  addEventListener(
    _type: 'change',
    listener: (state: 'active' | 'background' | 'inactive' | 'unknown' | 'extension') => void,
  ) {
    this.listener = listener;
    return {
      remove: () => {
        if (this.listener === listener) this.listener = null;
      },
    };
  }

  emit(state: 'active'): void {
    this.currentState = state;
    this.listener?.(state);
  }
}

function schedulerFake() {
  return {
    start: vi.fn(),
    stop: vi.fn(),
    subscribe: vi.fn(() => () => undefined),
    getState: vi.fn(() => ({ status: 'idle' as const, queueCount: 0 })),
    trigger: vi.fn(async () => ({ status: 'idle' as const, queueCount: 0 })),
  } as unknown as OfflineSyncScheduler & {
    trigger: ReturnType<typeof vi.fn>;
  };
}

function activeContext(): ActiveOfflineCaptureContext {
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

function activeItem() {
  return {
    itemType: 'nfc_assignment' as const,
    leaseId: ids.lease,
    leaseItemId: ids.item,
    assignmentId: ids.assignment,
    nfcTagId: ids.tag,
    targetType: 'customer' as const,
    targetId: ids.customer,
    displayName: 'Kunde',
    issuedAt: '2026-07-18T10:00:00.000Z',
    expiresAt: '2026-07-18T22:00:00.000Z',
    activationBootMarker: 'boot-1',
    activationMonotonicMilliseconds: 100,
  };
}

function capturedTag(): NfcScanCaptureResult {
  return {
    status: 'captured',
    payload: createCanonicalNfcUidPayload('04AABBCC'),
    capturedAt: createTimestamp('2026-07-18T10:10:00.000Z'),
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

const unavailableEnrollment: EmployeeEnrollmentPort = {
  async redeem() {
    return { status: 'transient_failure' };
  },
};

const unavailableLeaseClient: OfflineCaptureLeaseApiPort = {
  async issueComplete() {
    return { status: 'unavailable' };
  },
  async issueCompleteV2() {
    return { status: 'unavailable' };
  },
};

const emptyOutbox: LifecycleEvidenceOutbox = {
  async read() { return null; },
  async write() {},
  async clear() {},
};
